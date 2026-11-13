import { afterEach, describe, expect, test, vi } from "vitest";
import {
  encodeDataSourceVariable,
  type DataSource,
  type Instance,
  type Prop,
  type Resource,
} from "@webstudio-is/sdk";
import {
  getCatalogRootBindingId,
  getResourcePresetIds,
} from "../organizeos-preset-ids";
import {
  buildCollectionResourcePresets,
  buildMissingCatalogResources,
  createBindingReferenceTest,
  planCatalogRootBindings,
  buildOrgResourcePresets,
  COLLECTION_SLUG_RE,
  readV1PresetSeed,
  removeUnusedPresetBindings,
  seedProjectResourcePresets,
  syncCatalogRootBindings,
  upsertById,
  V1_RESOURCE_PRESETS,
} from "./resource-presets.server";
import {
  buildSignupFormData,
  SIGNUP_RESOURCE_NAME,
} from "./signup-form-preset.server";

describe("buildOrgResourcePresets", () => {
  const args = {
    projectId: "project-1",
    apiBaseUrl: "https://app.example.org/api/public/v1",
    readToken: "osk_secrettoken",
  };

  test("emits one GET Resource per preset, and no binding", async () => {
    const presets = await buildOrgResourcePresets(args);

    expect(presets.resources).toHaveLength(V1_RESOURCE_PRESETS.length);
    // the catalog is Resources only: a use brings its own binding
    expect(Object.keys(presets)).toEqual(["resources"]);

    for (const resource of presets.resources) {
      expect(resource.method).toBe("get");
    }
  });

  test("inlines the token as a literal auth header on every resource", async () => {
    const { resources } = await buildOrgResourcePresets(args);

    for (const resource of resources) {
      expect(resource.headers).toEqual([
        { name: "Authorization", value: `"Bearer osk_secrettoken"` },
      ]);
    }
  });

  test("builds quoted-literal URLs and trims a trailing slash on the base", async () => {
    const { resources } = await buildOrgResourcePresets({
      ...args,
      apiBaseUrl: "https://app.example.org/api/public/v1/",
    });
    const urls = resources.map((r) => r.url).sort();
    expect(urls).toEqual(
      [
        `"https://app.example.org/api/public/v1/events"`,
        `"https://app.example.org/api/public/v1/fundraisers"`,
        `"https://app.example.org/api/public/v1/stats"`,
        `"https://app.example.org/api/public/v1/forms"`,
        `"https://app.example.org/api/public/v1/events?upcoming=true"`,
        `"https://app.example.org/api/public/v1/products"`,
      ].sort()
    );
  });

  test("ids are deterministic per project and differ across projects", async () => {
    const a1 = await buildOrgResourcePresets(args);
    const a2 = await buildOrgResourcePresets(args);
    const b = await buildOrgResourcePresets({
      ...args,
      projectId: "project-2",
    });

    expect(a1.resources.map((r) => r.id)).toEqual(
      a2.resources.map((r) => r.id)
    );
    // Different project -> different ids (no cross-project collision).
    expect(a1.resources[0].id).not.toBe(b.resources[0].id);
  });

  test("keeps the ids live projects already carry, and gives Forms the one the builder panel uses", async () => {
    const { resources } = await buildOrgResourcePresets(args);
    const events = resources.find((resource) => resource.name === "Events");
    const forms = resources.find(
      (resource) => resource.name === "OrganizeOS Forms"
    );
    // Derived by the node:crypto implementation this replaced.
    expect(events?.id).toBe("385fcd4c-92f8-5d7c-abfe-cb941b8f2449");
    expect(forms?.id).toBe("5bd1e1fb-1480-5d7a-ad4b-75e9cbeec7dd");
  });

  test("builds Upcoming Events as Events with the upcoming filter, under the id the builder uses", async () => {
    const { resources } = await buildOrgResourcePresets(args);
    const upcoming = resources.find(
      (resource) => resource.name === "Upcoming Events"
    );
    expect(upcoming).toEqual({
      id: (await getResourcePresetIds(args.projectId, "upcoming-events"))
        .resourceId,
      name: "Upcoming Events",
      method: "get",
      url: `"https://app.example.org/api/public/v1/events?upcoming=true"`,
      headers: [{ name: "Authorization", value: `"Bearer osk_secrettoken"` }],
    });
    expect(
      V1_RESOURCE_PRESETS.find((preset) => preset.key === "upcoming-events")
    ).toEqual({
      key: "upcoming-events",
      label: "Upcoming Events",
      path: "/events?upcoming=true",
      seeding: "always",
    });
  });
});

type BuildRow = {
  id: string;
  version: number;
  updatedAt: string | null;
  instances: string;
  props: string;
  dataSources: string;
  resources: string;
  pages: string;
};

type Write = {
  payload: Record<string, unknown>;
  options: unknown;
  match: Record<string, unknown>;
};

/**
 * Stateful fake of the Build table. The update honours its match on id,
 * version and updatedAt the way PostgREST does (no row matches, count 0); a
 * `filter(column, "is", null)` adds a null condition. Each `builderSaves`
 * entry is a builder save that lands just before a write: it bumps the
 * version (and may change the build), so that write loses. Each
 * `versionKeepingWrites` entry is a write of another catalog writer that
 * keeps the version (the entry re-sync, collections-sync): it changes the
 * build and its updatedAt only.
 */
const makeBuildContext = ({
  build,
  builderSaves = [],
  versionKeepingWrites = [],
}: {
  build: Partial<BuildRow> | null;
  builderSaves?: Array<(row: BuildRow) => void>;
  versionKeepingWrites?: Array<(row: BuildRow) => void>;
}) => {
  const row: BuildRow | null =
    build === null
      ? null
      : {
          id: "build-1",
          version: 7,
          updatedAt: "2026-11-01T00:00:00.000Z",
          instances: "[]",
          props: "[]",
          dataSources: "[]",
          resources: "[]",
          pages: "{}",
          ...build,
        };
  const state = {
    row,
    reads: 0,
    selects: [] as string[],
    writes: [] as Write[],
  };
  const pendingSaves = [...builderSaves];
  const pendingOtherWrites = [...versionKeepingWrites];
  const read = async () => {
    state.reads += 1;
    return state.row === null
      ? { data: null, error: { message: "not found" } }
      : { data: { ...state.row }, error: null };
  };
  const client = {
    from: () => ({
      select: (columns: string) => {
        state.selects.push(columns);
        return {
          eq: () => ({
            is: () => ({
              single: read,
              maybeSingle: async () =>
                state.row === null ? { data: null, error: null } : read(),
            }),
          }),
        };
      },
      update: (payload: Record<string, unknown>, options: unknown) => ({
        match: (match: Record<string, unknown>) => {
          const conditions = { ...match };
          const run = async () => {
            state.writes.push({ payload, options, match: conditions });
            const save = pendingSaves.shift();
            if (save !== undefined && state.row !== null) {
              save(state.row);
              state.row.version += 1;
            }
            const other = pendingOtherWrites.shift();
            if (other !== undefined && state.row !== null) {
              other(state.row);
            }
            const current = state.row;
            if (
              current === null ||
              Object.entries(conditions).some(
                ([column, value]) => current[column as keyof BuildRow] !== value
              )
            ) {
              return { error: null, count: 0 };
            }
            Object.assign(current, payload);
            return { error: null, count: 1 };
          };
          const query = {
            filter: (column: string, _operator: string, value: unknown) => {
              conditions[column] = value;
              return query;
            },
            then: <Result>(
              resolve: (value: { error: null; count: number }) => Result,
              reject?: (reason: unknown) => Result
            ) => run().then(resolve, reject),
          };
          return query;
        },
      }),
    }),
  };
  return { context: { postgrest: { client } } as never, state };
};

describe("seedProjectResourcePresets", () => {
  const projectId = "project-1";
  const args = {
    projectId,
    apiBaseUrl: "https://app.example.org/api/public/v1",
    readToken: "osk_secrettoken",
  };

  const parseRow = (row: BuildRow | null) => ({
    resources: JSON.parse(row?.resources ?? "[]") as Resource[],
    dataSources: JSON.parse(row?.dataSources ?? "[]") as DataSource[],
  });

  // Events, Fundraisers, Stats, Forms and Upcoming Events, as every
  // provision seeds them (OrganizeOS fork: Forms and Upcoming Events for
  // every org since the catalog's :root bindings).
  const getAlwaysSeeded = async (token = "osk_secrettoken") => {
    const resources: Resource[] = [];
    for (const [key, name, path] of [
      ["events", "Events", "events"],
      ["fundraisers", "Fundraisers", "fundraisers"],
      ["stats", "Stats", "stats"],
      ["forms", "OrganizeOS Forms", "forms"],
      ["upcoming-events", "Upcoming Events", "events?upcoming=true"],
    ] as const) {
      const { resourceId } = await getResourcePresetIds(projectId, key);
      resources.push({
        id: resourceId,
        name,
        method: "get",
        url: `"https://app.example.org/api/public/v1/${path}"`,
        headers: [{ name: "Authorization", value: `"Bearer ${token}"` }],
      });
    }
    return resources;
  };
  // What a provision appends to a build that holds `present`.
  const getAppended = async (present: Resource[]) =>
    (await getAlwaysSeeded()).filter(
      ({ id }) => present.some((resource) => resource.id === id) === false
    );

  // The unscoped bindings older provisioning wrote next to each Resource.
  const getOldBindings = async () => {
    const bindings: DataSource[] = [];
    for (const [key, name] of [
      ["events", "Events"],
      ["fundraisers", "Fundraisers"],
      ["stats", "Stats"],
    ] as const) {
      const { resourceId, bindingId } = await getResourcePresetIds(
        projectId,
        key
      );
      bindings.push({ type: "resource", id: bindingId, name, resourceId });
    }
    return bindings;
  };

  const userVariable: DataSource = {
    type: "variable",
    id: "user-var",
    name: "My variable",
    value: { type: "string", value: "keep me" },
  };
  const userResource: Resource = {
    id: "user-resource",
    name: "Mine",
    method: "get",
    url: `"https://example.org/data"`,
    headers: [{ name: "Authorization", value: `"Bearer mine"` }],
  };

  test("seeds Events, Fundraisers, Stats, Forms and Upcoming Events into an empty build, and no binding", async () => {
    const { context, state } = makeBuildContext({ build: {} });
    await seedProjectResourcePresets(context, args);

    expect(parseRow(state.row)).toEqual({
      resources: await getAlwaysSeeded(),
      dataSources: [],
    });
  });

  test("writes with compare-and-swap on the version it read, and bumps it", async () => {
    const { context, state } = makeBuildContext({ build: {} });
    await seedProjectResourcePresets(context, args);

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].options).toEqual({ count: "exact" });
    expect(state.writes[0].match).toEqual({
      id: "build-1",
      version: 7,
      updatedAt: "2026-11-01T00:00:00.000Z",
    });
    expect(state.writes[0].payload.version).toBe(8);
    expect(state.row?.version).toBe(8);
    // cleared with the bump, so an open tab's next save cannot read the new
    // version as its own already-applied retry
    expect(state.writes[0].payload).toHaveProperty("lastTransactionId", null);
  });

  test("is idempotent: a second run writes nothing and bumps nothing", async () => {
    const { context, state } = makeBuildContext({ build: {} });
    await seedProjectResourcePresets(context, args);
    await seedProjectResourcePresets(context, args);

    expect(state.writes).toHaveLength(1);
    expect(state.row?.version).toBe(8);
  });

  test("retries after a builder save lands first, and keeps what it saved", async () => {
    const { context, state } = makeBuildContext({
      build: {},
      builderSaves: [
        (row) => {
          row.dataSources = JSON.stringify([userVariable]);
        },
      ],
    });
    await seedProjectResourcePresets(context, args);

    expect(state.reads).toBe(2);
    expect(state.writes.map((write) => write.match.version)).toEqual([7, 8]);
    expect(state.row?.version).toBe(9);
    expect(parseRow(state.row)).toEqual({
      resources: await getAlwaysSeeded(),
      dataSources: [userVariable],
    });
  });

  test("gives up after three attempts when the builder keeps saving", async () => {
    const { context, state } = makeBuildContext({
      build: {},
      builderSaves: [() => {}, () => {}, () => {}],
    });
    await expect(seedProjectResourcePresets(context, args)).rejects.toThrow(
      "kept changing"
    );
    expect(state.writes).toHaveLength(3);
    expect(parseRow(state.row).resources).toEqual([]);
  });

  test("rewrites the presets in place, keeping every other entry and the order", async () => {
    const [events, , stats] = await getAlwaysSeeded("osk_old");
    const { context, state } = makeBuildContext({
      build: {
        dataSources: JSON.stringify([userVariable]),
        resources: JSON.stringify([
          { ...stats, name: "My stats" },
          userResource,
          events,
        ]),
      },
    });
    await seedProjectResourcePresets(context, args);

    const [newEvents, newFundraisers, newStats, newForms, newUpcoming] =
      await getAlwaysSeeded();
    expect(parseRow(state.row)).toEqual({
      resources: [
        newStats,
        userResource,
        newEvents,
        newFundraisers,
        newForms,
        newUpcoming,
      ],
      dataSources: [userVariable],
    });
  });

  describe("Forms, which every provision seeds", () => {
    const getForms = async (token = "osk_secrettoken") => {
      const { resourceId, bindingId } = await getResourcePresetIds(
        projectId,
        "forms"
      );
      const resource: Resource = {
        id: resourceId,
        name: "OrganizeOS Forms",
        method: "get",
        url: `"https://app.example.org/api/public/v1/forms"`,
        headers: [{ name: "Authorization", value: `"Bearer ${token}"` }],
      };
      return { resource, bindingId };
    };

    test("is rewritten whole, in place, when the build has it", async () => {
      const forms = await getForms("osk_old");
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify([
            {
              ...forms.resource,
              name: "My forms",
              searchParams: [{ name: "kind", value: `"membership"` }],
            },
          ]),
        },
      });
      await seedProjectResourcePresets(context, args);

      const forms2 = (await getForms()).resource;
      expect(parseRow(state.row).resources).toEqual([
        forms2,
        ...(await getAppended([forms2])),
      ]);
    });

    test("is created under its own id, and a lookalike under another id is left alone", async () => {
      const forms = await getForms();
      const lookalike = { ...forms.resource, id: "user" };
      const { context, state } = makeBuildContext({
        build: {
          // the binding the branch before this one wrote, with no resource
          dataSources: JSON.stringify([
            {
              type: "resource",
              id: forms.bindingId,
              scopeInstanceId: ":root",
              name: "OrganizeOS Forms",
              resourceId: forms.resource.id,
            },
          ]),
          resources: JSON.stringify([lookalike]),
        },
      });
      await seedProjectResourcePresets(context, args);

      expect(parseRow(state.row)).toEqual({
        resources: [lookalike, ...(await getAlwaysSeeded())],
        // unreferenced, so removed
        dataSources: [],
      });
    });
  });

  describe("Upcoming Events, which every provision seeds", () => {
    const getUpcoming = async (token = "osk_secrettoken") => {
      const { resourceId, bindingId } = await getResourcePresetIds(
        projectId,
        "upcoming-events"
      );
      const resource: Resource = {
        id: resourceId,
        name: "Upcoming Events",
        method: "get",
        url: `"https://app.example.org/api/public/v1/events?upcoming=true"`,
        headers: [{ name: "Authorization", value: `"Bearer ${token}"` }],
      };
      return { resource, bindingId };
    };

    test("is rewritten whole, in place, with the new token, when the build has it", async () => {
      const upcoming = await getUpcoming("osk_old");
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify([
            {
              ...upcoming.resource,
              name: "My upcoming events",
              searchParams: [{ name: "limit", value: `"3"` }],
            },
          ]),
        },
      });
      await seedProjectResourcePresets(context, args);

      const upcoming2 = (await getUpcoming()).resource;
      expect(parseRow(state.row).resources).toEqual([
        upcoming2,
        ...(await getAppended([upcoming2])),
      ]);
    });

    test("is added to a build that lacks it", async () => {
      const { context, state } = makeBuildContext({ build: {} });
      await seedProjectResourcePresets(context, args);

      const resources = parseRow(state.row).resources;
      expect(resources).toEqual(await getAlwaysSeeded());
      expect(resources.at(-1)).toEqual((await getUpcoming()).resource);
    });

    test("is created under its own id beside a lookalike under another id", async () => {
      const lookalike = { ...(await getUpcoming()).resource, id: "user" };
      const { context, state } = makeBuildContext({
        build: { resources: JSON.stringify([lookalike]) },
      });
      await seedProjectResourcePresets(context, args);

      expect(parseRow(state.row).resources).toEqual([
        lookalike,
        ...(await getAlwaysSeeded()),
      ]);
    });

    test("leaves the rest of the catalog as it is written without it", async () => {
      const upcoming = await getUpcoming("osk_old");
      const withIt = makeBuildContext({
        build: { resources: JSON.stringify([upcoming.resource]) },
      });
      const without = makeBuildContext({ build: {} });
      await seedProjectResourcePresets(withIt.context, args);
      await seedProjectResourcePresets(without.context, args);

      const [, ...seeded] = parseRow(withIt.state.row).resources;
      expect(seeded).toEqual(await getAppended([upcoming.resource]));
      expect(seeded).toEqual(
        parseRow(without.state.row).resources.filter(
          ({ id }) => id !== upcoming.resource.id
        )
      );
    });

    test("counts its old unscoped binding as a preset binding: removed where nothing references it", async () => {
      const upcoming = await getUpcoming();
      const old: DataSource = {
        type: "resource",
        id: upcoming.bindingId,
        name: "Upcoming Events",
        resourceId: upcoming.resource.id,
      };
      const { context, state } = makeBuildContext({
        build: {
          dataSources: JSON.stringify([userVariable, old]),
          resources: JSON.stringify([upcoming.resource]),
        },
      });
      await seedProjectResourcePresets(context, args);

      expect(parseRow(state.row).dataSources).toEqual([userVariable]);
    });

    test("counts its old unscoped binding as a preset binding: kept where something references it", async () => {
      const upcoming = await getUpcoming();
      const old: DataSource = {
        type: "resource",
        id: upcoming.bindingId,
        name: "Upcoming Events",
        resourceId: upcoming.resource.id,
      };
      const props: Prop[] = [
        {
          id: "list",
          instanceId: "list",
          name: "data",
          type: "expression",
          value: `${encodeDataSourceVariable(old.id)}.data.data`,
        },
      ];
      const { context, state } = makeBuildContext({
        build: {
          props: JSON.stringify(props),
          dataSources: JSON.stringify([old]),
          resources: JSON.stringify([upcoming.resource]),
        },
      });
      await seedProjectResourcePresets(context, args);

      expect(parseRow(state.row).dataSources).toEqual([old]);
    });

    test("leaves the binding an Event List brought alone", async () => {
      const upcoming = await getUpcoming();
      const use: DataSource = {
        type: "resource",
        id: "block-binding",
        scopeInstanceId: "event-list",
        name: "OrganizeOS Upcoming Events",
        resourceId: upcoming.resource.id,
      };
      const { context, state } = makeBuildContext({
        build: {
          dataSources: JSON.stringify([use]),
          resources: JSON.stringify([upcoming.resource]),
        },
      });
      await seedProjectResourcePresets(context, args);

      expect(parseRow(state.row).dataSources).toEqual([use]);
    });

    test("a copy Webstudio made of it gets the new token", async () => {
      const upcoming = await getUpcoming("osk_t1");
      const copy: Resource = { ...upcoming.resource, id: "copied-upcoming" };
      const { context, state } = makeBuildContext({
        build: { resources: JSON.stringify([upcoming.resource, copy]) },
      });
      await seedProjectResourcePresets(context, {
        ...args,
        readToken: "osk_t2",
      });

      const resources = parseRow(state.row).resources;
      expect(resources[0]).toEqual((await getUpcoming("osk_t2")).resource);
      expect(resources[1]).toEqual({
        ...copy,
        headers: [{ name: "Authorization", value: `"Bearer osk_t2"` }],
      });
    });
  });

  describe("the bindings older provisioning wrote", () => {
    test("are removed where nothing references them, and no binding is added", async () => {
      const { context, state } = makeBuildContext({
        build: {
          dataSources: JSON.stringify([
            userVariable,
            ...(await getOldBindings()),
          ]),
          resources: JSON.stringify(await getAlwaysSeeded()),
        },
      });
      await seedProjectResourcePresets(context, args);

      expect(parseRow(state.row)).toEqual({
        resources: await getAlwaysSeeded(),
        dataSources: [userVariable],
      });
    });

    test("are kept, as they are, where something references them", async () => {
      const [events, fundraisers, stats] = await getOldBindings();
      const instances: Instance[] = [
        {
          type: "instance",
          id: "text",
          component: "Text",
          children: [
            {
              type: "expression",
              value: `${encodeDataSourceVariable(stats.id)}.data.total`,
            },
          ],
        },
      ];
      const props: Prop[] = [
        {
          id: "list",
          instanceId: "list",
          name: "data",
          type: "expression",
          value: `${encodeDataSourceVariable(events.id)}.data`,
        },
      ];
      const scopedEvents = { ...events, scopeInstanceId: "body" };
      const { context, state } = makeBuildContext({
        build: {
          instances: JSON.stringify(instances),
          props: JSON.stringify(props),
          dataSources: JSON.stringify([scopedEvents, fundraisers, stats]),
          // a resource of the admin's that reads Fundraisers
          resources: JSON.stringify([
            {
              ...userResource,
              url: `"https://example.org/?" + ${encodeDataSourceVariable(
                fundraisers.id
              )}.status`,
            },
          ]),
        },
      });
      await seedProjectResourcePresets(context, args);

      expect(parseRow(state.row).dataSources).toEqual([
        scopedEvents,
        fundraisers,
        stats,
      ]);
    });

    test("leave a binding a use brought alone, whatever its scope", async () => {
      const [events] = await getAlwaysSeeded();
      const uses: DataSource[] = [
        {
          type: "resource",
          id: "page-binding",
          scopeInstanceId: "page-body",
          name: "Events",
          resourceId: events.id,
        },
        {
          type: "resource",
          id: "block-binding",
          scopeInstanceId: "signup-form",
          name: "OrganizeOS Forms",
          resourceId: (await getResourcePresetIds(projectId, "forms"))
            .resourceId,
        },
      ];
      const { context, state } = makeBuildContext({
        build: { dataSources: JSON.stringify(uses) },
      });
      await seedProjectResourcePresets(context, args);

      expect(parseRow(state.row).dataSources).toEqual(uses);
    });
  });

  describe("a rotated token", () => {
    test("reaches every collection Resource, with the new API base, in place", async () => {
      const t1 = await buildCollectionResourcePresets({
        projectId,
        apiBase: "https://old.example.org/v1",
        authHeaderExpression: `"Bearer osk_t1"`,
        collections: [
          { slug: "blog", name: "Journal" },
          { slug: "team", name: "Team" },
        ],
      });
      const [blog, team] = t1.resources;
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify([blog, userResource, team]),
        },
      });
      await seedProjectResourcePresets(context, {
        ...args,
        readToken: "osk_t2",
      });

      const [newBlog, kept, newTeam] = parseRow(state.row).resources;
      expect(newBlog).toEqual({
        ...blog,
        url: `"https://app.example.org/api/public/v1/collections/blog/items"`,
        headers: [{ name: "Authorization", value: `"Bearer osk_t2"` }],
      });
      expect(newTeam).toEqual({
        ...team,
        url: `"https://app.example.org/api/public/v1/collections/team/items"`,
        headers: [{ name: "Authorization", value: `"Bearer osk_t2"` }],
      });
      expect(kept).toEqual(userResource);
    });

    test("reaches the copies Webstudio made of catalog Resources, and nothing else", async () => {
      const [events] = await getAlwaysSeeded("osk_t1");
      // a duplicated block's own copy of the Forms Resource
      const copy: Resource = {
        id: "copied-forms",
        name: "OrganizeOS Forms",
        method: "get",
        url: `"https://app.example.org/api/public/v1/forms"`,
        headers: [
          { name: "Accept", value: `"application/json"` },
          { name: "Authorization", value: `"Bearer osk_t1"` },
        ],
      };
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify([events, copy, userResource]),
        },
      });
      await seedProjectResourcePresets(context, {
        ...args,
        readToken: "osk_t2",
      });

      const resources = parseRow(state.row).resources;
      expect(resources[1]).toEqual({
        ...copy,
        headers: [
          { name: "Accept", value: `"application/json"` },
          { name: "Authorization", value: `"Bearer osk_t2"` },
        ],
      });
      expect(resources[2]).toEqual(userResource);
    });

    test("reaches a collection's item page Resource, whose url is an expression", async () => {
      const t1 = await buildCollectionResourcePresets({
        projectId,
        apiBase: "https://app.example.org/api/public/v1",
        authHeaderExpression: `"Bearer osk_t1"`,
        collections: [{ slug: "blog", name: "Blog posts" }],
      });
      // as Create item page writes it (organizeos-panel/collection-pages.ts)
      const itemPage: Resource = {
        id: "item-page-resource",
        name: "Current Blog post",
        method: "get",
        url: `"https://app.example.org/api/public/v1/collections/blog/items/" + ($ws$system.params.slug ?? "-")`,
        headers: [{ name: "Authorization", value: `"Bearer osk_t1"` }],
      };
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify([...t1.resources, itemPage, userResource]),
        },
      });
      await seedProjectResourcePresets(context, {
        ...args,
        readToken: "osk_t2",
      });

      const resources = parseRow(state.row).resources;
      expect(resources.find(({ id }) => id === itemPage.id)).toEqual({
        ...itemPage,
        headers: [{ name: "Authorization", value: `"Bearer osk_t2"` }],
      });
      expect(resources.find(({ id }) => id === "user-resource")).toEqual(
        userResource
      );
    });

    test("reaches a collection list block's Resource, with its search params", async () => {
      const t1 = await buildCollectionResourcePresets({
        projectId,
        apiBase: "https://app.example.org/api/public/v1",
        authHeaderExpression: `"Bearer osk_t1"`,
        collections: [{ slug: "blog", name: "Blog posts" }],
      });
      // as Add list writes it (organizeos-panel/collection-list.ts)
      const list: Resource = {
        id: "list-resource",
        name: "Blog posts list",
        method: "get",
        url: `"https://app.example.org/api/public/v1/collections/blog/items"`,
        searchParams: [
          { name: "sort", value: `"-publishedAt"` },
          { name: "limit", value: `"6"` },
          { name: "fields", value: `"cover,publishedOn,summary"` },
        ],
        headers: [{ name: "Authorization", value: `"Bearer osk_t1"` }],
      };
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify([...t1.resources, list, userResource]),
        },
      });
      await seedProjectResourcePresets(context, {
        ...args,
        readToken: "osk_t2",
      });

      const resources = parseRow(state.row).resources;
      expect(resources.find(({ id }) => id === list.id)).toEqual({
        ...list,
        headers: [{ name: "Authorization", value: `"Bearer osk_t2"` }],
      });
    });

    test("reaches the generated sitemap's /slugs Resource", async () => {
      const t1 = await buildCollectionResourcePresets({
        projectId,
        apiBase: "https://app.example.org/api/public/v1",
        authHeaderExpression: `"Bearer osk_t1"`,
        collections: [{ slug: "blog", name: "Blog posts" }],
      });
      // as Create item page writes it (organizeos-panel/collection-pages.ts)
      const slugs: Resource = {
        id: "sitemap-slugs-resource",
        name: "Blog posts slugs",
        method: "get",
        url: `"https://app.example.org/api/public/v1/collections/blog/slugs"`,
        headers: [{ name: "Authorization", value: `"Bearer osk_t1"` }],
      };
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify([...t1.resources, slugs, userResource]),
        },
      });
      await seedProjectResourcePresets(context, {
        ...args,
        readToken: "osk_t2",
      });

      const resources = parseRow(state.row).resources;
      expect(resources.find(({ id }) => id === slugs.id)).toEqual({
        ...slugs,
        headers: [{ name: "Authorization", value: `"Bearer osk_t2"` }],
      });
    });

    // OrganizeOS fork, D15 of the 0.309.0 merge: the /newsletter form is a
    // ResourceForm whose action Resource posts to /v1/signups; an org
    // provisioned before it still has a Form whose action Resource took the
    // Form's id. A rotated token reaches either, keeping its form's body.
    test("reaches the signup form's action Resource, the ResourceForm's and the earlier Form's alike", async () => {
      const { data } = await buildSignupFormData({
        ...args,
        readToken: "osk_old",
      });
      const signup = [...data.resources.values()].find(
        ({ name }) => name === SIGNUP_RESOURCE_NAME
      )!;
      const earlier: Resource = {
        id: "c716572d-0000-5000-8000-000000000000",
        name: "action",
        method: "post",
        url: `"https://app.example.org/api/public/v1/signups"`,
        headers: [
          { name: "Content-Type", value: `"application/json"` },
          { name: "Authorization", value: `"Bearer osk_old"` },
        ],
      };
      const { context, state } = makeBuildContext({
        build: { resources: JSON.stringify([signup, earlier]) },
      });
      await seedProjectResourcePresets(context, args);

      const resources = parseRow(state.row).resources;
      const rotated = (resource: Resource) => ({
        ...resource,
        headers: resource.headers.map((header) =>
          header.name === "Authorization"
            ? { ...header, value: `"Bearer ${args.readToken}"` }
            : header
        ),
      });
      expect(resources.find(({ id }) => id === signup.id)).toEqual(
        rotated(signup)
      );
      expect(resources.find(({ id }) => id === earlier.id)).toEqual(
        rotated(earlier)
      );
    });

    test("replaces another org's token on a Resource pasted onto this org's API", async () => {
      // a Signup Form copied from another org's project brings its own copy
      // of that org's Forms Resource, with that org's token
      const pasted: Resource = {
        id: "pasted-forms",
        name: "OrganizeOS Forms",
        method: "get",
        url: `"https://app.example.org/api/public/v1/forms"`,
        headers: [{ name: "Authorization", value: `"Bearer osk_other_org"` }],
      };
      const { context, state } = makeBuildContext({
        build: { resources: JSON.stringify([pasted, userResource]) },
      });
      await seedProjectResourcePresets(context, args);

      const resources = parseRow(state.row).resources;
      expect(resources.find(({ id }) => id === "pasted-forms")).toEqual({
        ...pasted,
        headers: [
          { name: "Authorization", value: `"Bearer ${args.readToken}"` },
        ],
      });
      // a Resource on another host keeps its own header
      expect(resources.find(({ id }) => id === "user-resource")).toEqual(
        userResource
      );
    });
  });

  test("throws when the dev build cannot be loaded", async () => {
    const { context } = makeBuildContext({ build: null });
    await expect(seedProjectResourcePresets(context, args)).rejects.toEqual({
      message: "not found",
    });
  });
});

describe("removeUnusedPresetBindings", () => {
  const projectId = "project-1";

  test("finds collection bindings by their Resource, and references in any form", async () => {
    const { resources } = await buildCollectionResourcePresets({
      projectId,
      apiBase: "https://app.example.org/v1",
      authHeaderExpression: `"Bearer x"`,
      collections: [
        { slug: "blog", name: "Blog" },
        { slug: "team", name: "Team" },
      ],
    });
    const blog = await getResourcePresetIds(projectId, "collection:blog");
    const team = await getResourcePresetIds(projectId, "collection:team");
    const dataSources: DataSource[] = [
      {
        type: "resource",
        id: blog.bindingId,
        name: "Blog",
        resourceId: blog.resourceId,
      },
      {
        type: "resource",
        id: team.bindingId,
        name: "Team",
        resourceId: team.resourceId,
      },
    ];
    // a Collection's item parameter names the binding by its raw id
    const props: Prop[] = [
      {
        id: "p",
        instanceId: "collection",
        name: "data",
        type: "parameter",
        value: team.bindingId,
      },
    ];

    expect(
      await removeUnusedPresetBindings({
        projectId,
        dataSources,
        resources,
        searchable: [JSON.stringify(props)],
      })
    ).toEqual([dataSources[1]]);
  });
});

describe("COLLECTION_SLUG_RE", () => {
  test.each(["blog", "a", "team-2", "0", "a-b-c", "a".repeat(63)])(
    "accepts %s",
    (slug) => {
      expect(COLLECTION_SLUG_RE.test(slug)).toBe(true);
    }
  );

  test.each([
    "",
    "Blog Posts",
    "Blog",
    "-blog",
    "blog-",
    "blog_posts",
    "a/b",
    "a.b",
    "a".repeat(64),
  ])("rejects %s", (slug) => {
    expect(COLLECTION_SLUG_RE.test(slug)).toBe(false);
  });
});

describe("buildCollectionResourcePresets", () => {
  const args = {
    projectId: "project-1",
    apiBase: "https://app.example.org/api/public/v1",
    authHeaderExpression: `"Bearer osk_secrettoken"`,
    collections: [
      { slug: "blog", name: "Blog posts", kind: "curated" },
      { slug: "team", name: "Team", kind: "platform" },
    ],
  };

  test("emits one GET Resource per collection, and no binding", async () => {
    const presets = await buildCollectionResourcePresets(args);

    expect(presets).toEqual({
      resources: [
        {
          id: expect.any(String),
          name: "Blog posts",
          method: "get",
          url: `"https://app.example.org/api/public/v1/collections/blog/items"`,
          headers: [
            { name: "Authorization", value: `"Bearer osk_secrettoken"` },
          ],
        },
        {
          id: expect.any(String),
          name: "Team",
          method: "get",
          url: `"https://app.example.org/api/public/v1/collections/team/items"`,
          headers: [
            { name: "Authorization", value: `"Bearer osk_secrettoken"` },
          ],
        },
      ],
    });
  });

  test("ids are deterministic per project and differ across projects", async () => {
    const a1 = await buildCollectionResourcePresets(args);
    const a2 = await buildCollectionResourcePresets(args);
    const b = await buildCollectionResourcePresets({
      ...args,
      projectId: "project-2",
    });

    expect(a1.resources.map((r) => r.id)).toEqual(
      a2.resources.map((r) => r.id)
    );
    expect(a1.resources[0].id).not.toBe(b.resources[0].id);
  });

  test("ids differ per collection and from the static presets", async () => {
    const collections = await buildCollectionResourcePresets({
      ...args,
      collections: [
        { slug: "blog", name: "Blog" },
        { slug: "events", name: "Events" },
      ],
    });
    const statics = await buildOrgResourcePresets({
      projectId: args.projectId,
      apiBaseUrl: args.apiBase,
      readToken: "osk_secrettoken",
    });
    const ids = [collections, statics].flatMap((presets) =>
      presets.resources.map((r) => r.id)
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("a rename keeps the ids and changes the names", async () => {
    const before = await buildCollectionResourcePresets(args);
    const after = await buildCollectionResourcePresets({
      ...args,
      collections: [{ slug: "blog", name: "Journal" }],
    });
    expect(after.resources[0].id).toBe(before.resources[0].id);
    expect(after.resources[0].name).toBe("Journal");
  });

  test("url-encodes the slug in the url expression", async () => {
    const { resources } = await buildCollectionResourcePresets({
      ...args,
      collections: [{ slug: "a b/c?d", name: "Odd" }],
    });
    expect(resources[0].url).toBe(
      `"https://app.example.org/api/public/v1/collections/a%20b%2Fc%3Fd/items"`
    );
  });

  test("trims a trailing slash on the base", async () => {
    const { resources } = await buildCollectionResourcePresets({
      ...args,
      apiBase: "https://app.example.org/api/public/v1/",
    });
    expect(resources[0].url).toBe(
      `"https://app.example.org/api/public/v1/collections/blog/items"`
    );
  });

  test("copies the auth expression verbatim", async () => {
    // Not necessarily a plain literal: whatever expression the static presets hold.
    const authHeaderExpression = `"Bearer " + "osk_x"`;
    const { resources } = await buildCollectionResourcePresets({
      ...args,
      authHeaderExpression,
    });
    for (const resource of resources) {
      expect(resource.headers).toEqual([
        { name: "Authorization", value: authHeaderExpression },
      ]);
    }
  });

  test.each(V1_RESOURCE_PRESETS.map((preset) => preset.key))(
    "skips the platform %s collection: a static preset covers it",
    async (key) => {
      const { resources } = await buildCollectionResourcePresets({
        ...args,
        collections: [
          { slug: key, name: "Covered", kind: "platform" },
          { slug: "blog", name: "Blog posts", kind: "curated" },
        ],
      });
      expect(resources.map((r) => r.name)).toEqual(["Blog posts"]);
    }
  );

  test("seeds a platform collection with any other slug", async () => {
    const { resources } = await buildCollectionResourcePresets({
      ...args,
      collections: [{ slug: "team", name: "Team", kind: "platform" }],
    });
    expect(resources.map((r) => r.name)).toEqual(["Team"]);
  });

  test("seeds a non-platform collection that shares a static preset's slug", async () => {
    const { resources } = await buildCollectionResourcePresets({
      ...args,
      collections: [{ slug: "events", name: "My events", kind: "custom" }],
    });
    expect(resources.map((r) => r.name)).toEqual(["My events"]);
  });

  test("a slug listed twice keeps the last entry", async () => {
    const { resources } = await buildCollectionResourcePresets({
      ...args,
      collections: [
        { slug: "blog", name: "First" },
        { slug: "team", name: "Team" },
        { slug: "blog", name: "Last" },
      ],
    });
    expect(resources.map((r) => r.name).sort()).toEqual(["Last", "Team"]);
  });

  test("no collections, no presets", async () => {
    expect(
      await buildCollectionResourcePresets({ ...args, collections: [] })
    ).toEqual({ resources: [] });
  });
});

describe("readV1PresetSeed", async () => {
  const projectId = "project-1";
  const staticPresets = await buildOrgResourcePresets({
    projectId,
    apiBaseUrl: "https://app.example.org/api/public/v1",
    readToken: "osk_secrettoken",
  });
  const byName = (name: string) =>
    staticPresets.resources.find((resource) => resource.name === name)!;

  test("reads the base and the auth expression from Events", async () => {
    expect(
      await readV1PresetSeed({ projectId, resources: staticPresets.resources })
    ).toEqual({
      apiBase: "https://app.example.org/api/public/v1",
      authHeaderExpression: `"Bearer osk_secrettoken"`,
    });
  });

  test("falls back to Fundraisers when Events is missing", async () => {
    const fundraisers: Resource = {
      ...byName("Fundraisers"),
      url: `"https://other.example.org/v1/fundraisers"`,
      headers: [{ name: "Authorization", value: `"Bearer from-fundraisers"` }],
    };
    expect(
      await readV1PresetSeed({
        projectId,
        resources: [fundraisers, byName("Stats")],
      })
    ).toEqual({
      apiBase: "https://other.example.org/v1",
      authHeaderExpression: `"Bearer from-fundraisers"`,
    });
  });

  test("falls back when Events cannot be parsed", async () => {
    const broken: Resource = { ...byName("Events"), url: "`${base}/events`" };
    expect(
      await readV1PresetSeed({
        projectId,
        resources: [broken, byName("Fundraisers")],
      })
    ).toMatchObject({ apiBase: "https://app.example.org/api/public/v1" });
  });

  test("matches the Authorization header name case-insensitively", async () => {
    const events: Resource = {
      ...byName("Events"),
      headers: [
        { name: "Accept", value: `"application/json"` },
        { name: "authorization", value: `"Bearer lower"` },
      ],
    };
    expect(await readV1PresetSeed({ projectId, resources: [events] })).toEqual({
      apiBase: "https://app.example.org/api/public/v1",
      authHeaderExpression: `"Bearer lower"`,
    });
  });

  test("skips a preset without an Authorization header", async () => {
    const events: Resource = { ...byName("Events"), headers: [] };
    const seed = await readV1PresetSeed({
      projectId,
      resources: [events, byName("Stats")],
    });
    expect(seed?.authHeaderExpression).toBe(`"Bearer osk_secrettoken"`);
  });

  test("skips a url that is not a string ending in the preset path", async () => {
    const resources: Resource[] = [
      { ...byName("Events"), url: JSON.stringify(42) },
      { ...byName("Fundraisers"), url: `"https://app.example.org/v1/other"` },
      { ...byName("Stats"), url: "not json" },
    ];
    expect(await readV1PresetSeed({ projectId, resources })).toBeUndefined();
  });

  test("skips a base that is not a URL", async () => {
    const events: Resource = { ...byName("Events"), url: `"/relative/events"` };
    expect(
      await readV1PresetSeed({ projectId, resources: [events] })
    ).toBeUndefined();
  });

  test("ignores the presets of another project", async () => {
    expect(
      await readV1PresetSeed({
        projectId: "project-2",
        resources: staticPresets.resources,
      })
    ).toBeUndefined();
  });

  test("returns undefined when the build holds no preset", async () => {
    const userResource: Resource = {
      id: "user-resource",
      name: "Mine",
      method: "get",
      url: `"https://example.org/events"`,
      headers: [{ name: "Authorization", value: `"Bearer x"` }],
    };
    expect(
      await readV1PresetSeed({ projectId, resources: [] })
    ).toBeUndefined();
    expect(
      await readV1PresetSeed({ projectId, resources: [userResource] })
    ).toBeUndefined();
  });
});

describe("upsertById", () => {
  test("replaces in place and appends new items at the end", () => {
    const merged = upsertById(
      [
        { id: "a", value: "old-a" },
        { id: "b", value: "old-b" },
        { id: "c", value: "old-c" },
      ],
      [
        { id: "d", value: "new-d" },
        { id: "b", value: "new-b" },
      ]
    );
    expect(merged).toEqual([
      { id: "a", value: "old-a" },
      { id: "b", value: "new-b" },
      { id: "c", value: "old-c" },
      { id: "d", value: "new-d" },
    ]);
  });

  test("returns an equal list when nothing changes", () => {
    const items = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ];
    expect(upsertById(items, [{ id: "a", value: 1 }])).toEqual(items);
  });
});

describe("Products, the Shop blocks' catalog Resource", () => {
  const projectId = "project-1";
  const base = "https://app.example.org/api/public/v1";
  const args = { projectId, apiBaseUrl: base, readToken: "osk_secrettoken" };
  const parseResources = (row: { resources: string } | null) =>
    JSON.parse(row?.resources ?? "[]") as Resource[];
  const getProducts = async (token = "osk_secrettoken"): Promise<Resource> => ({
    id: (await getResourcePresetIds(projectId, "products")).resourceId,
    name: "Products",
    method: "get",
    url: `"${base}/products"`,
    headers: [{ name: "Authorization", value: `"Bearer ${token}"` }],
  });
  // a Product Card's own copy of the request, under a nanoid, picking a product
  const cardResource = (token: string): Resource => ({
    id: "card-own-resource",
    name: "Product",
    method: "get",
    url: `"${base}/products?id=34efeec7-ef26-4210-946f-866b46b94f46"`,
    headers: [{ name: "Authorization", value: `"Bearer ${token}"` }],
  });
  const byName = (resources: Resource[], name: string) =>
    resources.find((resource) => resource.name === name);

  test("is the last preset, at /products, seeded as the Shop blocks switch says", () => {
    expect(V1_RESOURCE_PRESETS.at(-1)).toEqual({
      key: "products",
      label: "Products",
      path: "/products",
      seeding: "shop-blocks",
    });
  });

  test("buildOrgResourcePresets builds it in provisioning's shape", async () => {
    const { resources } = await buildOrgResourcePresets(args);
    expect(byName(resources, "Products")).toEqual(await getProducts());
  });

  test("with the switch on, a token provision adds it to a build without it, and rewrites it in place", async () => {
    const empty = makeBuildContext({ build: {} });
    await seedProjectResourcePresets(empty.context, {
      ...args,
      shopBlocks: true,
    });
    expect(byName(parseResources(empty.state.row), "Products")).toEqual(
      await getProducts()
    );

    const stale = await getProducts("osk_old");
    const present = makeBuildContext({
      build: {
        resources: JSON.stringify([
          { ...stale, name: "My products", url: `"${base}/products?x=1"` },
        ]),
      },
    });
    await seedProjectResourcePresets(present.context, {
      ...args,
      shopBlocks: true,
    });
    const resources = parseResources(present.state.row);
    expect(resources[0]).toEqual(await getProducts());
    expect(resources.filter((r) => r.name === "Products")).toHaveLength(1);
  });

  test.each([undefined, false])(
    "with the switch %s, a token provision adds none, and rewrites one an insert created (URL and token)",
    async (shopBlocks) => {
      const empty = makeBuildContext({ build: {} });
      await seedProjectResourcePresets(empty.context, { ...args, shopBlocks });
      expect(byName(parseResources(empty.state.row), "Products")).toBe(
        undefined
      );

      const stale = await getProducts("osk_old");
      const present = makeBuildContext({
        build: {
          resources: JSON.stringify([
            { ...stale, url: `"https://old.example.org/v1/products"` },
          ]),
        },
      });
      await seedProjectResourcePresets(present.context, {
        ...args,
        shopBlocks,
      });
      expect(parseResources(present.state.row)[0]).toEqual(await getProducts());
    }
  );

  test.each([true, false])(
    "the rotation rewrites Products and a card's own Resource, switch %s",
    async (shopBlocks) => {
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify([
            await getProducts("osk_old"),
            cardResource("osk_old"),
          ]),
        },
      });
      await seedProjectResourcePresets(context, { ...args, shopBlocks });
      const resources = parseResources(state.row);
      expect(resources[0]).toEqual(await getProducts());
      expect(resources[1]).toEqual(cardResource("osk_secrettoken"));
    }
  );

  test("readV1PresetSeed reads a seed from Products alone", async () => {
    expect(
      await readV1PresetSeed({ projectId, resources: [await getProducts()] })
    ).toEqual({
      apiBase: base,
      authHeaderExpression: `"Bearer osk_secrettoken"`,
    });
  });

  test("a platform collection with slug products is skipped; a custom one is seeded beside the preset", async () => {
    const { resources } = await buildCollectionResourcePresets({
      projectId,
      apiBase: base,
      authHeaderExpression: `"Bearer osk_secrettoken"`,
      collections: [
        { slug: "products", name: "Platform products", kind: "platform" },
      ],
    });
    expect(resources).toEqual([]);
    const custom = await buildCollectionResourcePresets({
      projectId,
      apiBase: base,
      authHeaderExpression: `"Bearer osk_secrettoken"`,
      collections: [{ slug: "products", name: "Our goods", kind: "custom" }],
    });
    expect(custom.resources.map((resource) => resource.name)).toEqual([
      "Our goods",
    ]);
    expect(custom.resources[0].id).not.toBe((await getProducts()).id);
  });
});

// OrganizeOS fork (fork doc section 9, "The catalog in provisioning"): one
// `:root` resource binding per catalog Resource, planned by the server.
describe("planCatalogRootBindings", () => {
  const projectId = "project-1";
  const base = "https://app.example.org/api/public/v1";
  const auth = `"Bearer osk_secrettoken"`;
  const catalogResource = async (
    key: string,
    name: string,
    path: string
  ): Promise<Resource> => ({
    id: (await getResourcePresetIds(projectId, key)).resourceId,
    name,
    method: "get",
    url: JSON.stringify(`${base}${path}`),
    headers: [{ name: "Authorization", value: auth }],
  });
  const getCatalog = async () => [
    await catalogResource("events", "Events", "/events"),
    await catalogResource("fundraisers", "Fundraisers", "/fundraisers"),
    await catalogResource("stats", "Stats", "/stats"),
    await catalogResource("collection:blog", "Blog", "/collections/blog/items"),
    await catalogResource("forms", "OrganizeOS Forms", "/forms"),
    await catalogResource(
      "upcoming-events",
      "Upcoming Events",
      "/events?upcoming=true"
    ),
  ];
  const keys = [
    "events",
    "fundraisers",
    "stats",
    "collection:blog",
    "forms",
    "upcoming-events",
  ];
  const rootBinding = async (
    key: string,
    name: string,
    resourceId: string
  ): Promise<DataSource> => ({
    type: "resource",
    id: await getCatalogRootBindingId(projectId, key),
    scopeInstanceId: ":root",
    name,
    resourceId,
  });
  const getExpected = async (resources: Resource[]) =>
    Promise.all(
      resources.map((resource, index) =>
        rootBinding(keys[index], resource.name, resource.id)
      )
    );
  const userVariable: DataSource = {
    type: "variable",
    id: "user-var",
    scopeInstanceId: "body",
    name: "My variable",
    value: { type: "string", value: "keep me" },
  };
  const plan = (
    dataSources: DataSource[],
    resources: Resource[],
    wanted = true,
    isReferenced?: (dataSource: DataSource) => boolean
  ) =>
    planCatalogRootBindings({
      projectId,
      dataSources,
      resources,
      wanted,
      isReferenced,
    });

  describe("wanted", () => {
    test("one binding per catalog Resource, in catalog order, after the existing data sources", async () => {
      const resources = await getCatalog();
      // the build's order is not the catalog's
      const shuffled = [resources[4], resources[3], ...resources.slice(0, 3)];
      shuffled.push(resources[5]);
      expect(await plan([userVariable], shuffled)).toEqual([
        userVariable,
        ...(await getExpected(resources)),
      ]);
    });

    test("Products, where the build has it, gets a seventh, last; nothing creates it", async () => {
      const resources = await getCatalog();
      const products = await catalogResource(
        "products",
        "Products",
        "/products"
      );
      const card: Resource = {
        ...products,
        id: "card-own-resource",
        name: "Product",
      };
      const withProducts = await plan([], [...resources, products, card]);
      expect(withProducts).toHaveLength(7);
      expect(withProducts.at(-1)).toEqual(
        await rootBinding("products", "Products", products.id)
      );
      const without = await plan([], resources);
      expect(without).toHaveLength(6);
      expect(without.map(({ name }) => name)).not.toContain("Products");
    });

    test("is idempotent", async () => {
      const resources = await getCatalog();
      const first = await plan([userVariable], resources);
      expect(JSON.stringify(await plan(first, resources))).toBe(
        JSON.stringify(first)
      );
    });

    test("keeps a stored binding whose fields match, whatever its key order", async () => {
      const resources = await getCatalog();
      const [events] = await getExpected(resources);
      const reordered = {
        resourceId: events.type === "resource" ? events.resourceId : "",
        name: events.name,
        id: events.id,
        scopeInstanceId: ":root",
        type: "resource",
      } as DataSource;
      const planned = await plan([reordered], resources.slice(0, 1));
      expect(planned).toHaveLength(1);
      expect(planned[0]).toBe(reordered);
    });

    test("restores in place a binding changed outside the builder", async () => {
      const resources = await getCatalog();
      const expected = await getExpected(resources);
      const [events] = expected;
      const changed: DataSource[] = [
        {
          type: "variable",
          id: events.id,
          scopeInstanceId: ":root",
          name: "Events",
          value: { type: "string", value: "retyped" },
        },
        {
          type: "resource",
          id: events.id,
          scopeInstanceId: "body",
          name: "Events",
          resourceId: resources[0].id,
        },
        {
          type: "resource",
          id: events.id,
          scopeInstanceId: ":root",
          name: "My events",
          resourceId: resources[0].id,
        },
        {
          type: "resource",
          id: events.id,
          scopeInstanceId: ":root",
          name: "Events",
          resourceId: resources[1].id,
        },
      ];
      for (const stored of changed) {
        expect(await plan([userVariable, stored], resources)).toEqual([
          userVariable,
          ...expected,
        ]);
      }
      // its position is kept
      expect(
        await plan([changed[2], userVariable], resources.slice(0, 1))
      ).toEqual([events, userVariable]);
    });

    test("a designer's :root variable takes the name first; a page-root one does not", async () => {
      const resources = await getCatalog();
      const rootEvents: DataSource = {
        ...userVariable,
        id: "designer",
        scopeInstanceId: ":root",
        name: "Events",
      };
      const pageEvents: DataSource = {
        ...userVariable,
        id: "page",
        scopeInstanceId: "body",
        name: "Events",
      };
      const fromRoot = await plan([rootEvents], resources);
      expect(fromRoot[1].name).toBe("Events 2");
      const fromPage = await plan([pageEvents], resources);
      expect(fromPage[1].name).toBe("Events");
    });

    test("two catalog Resources with one name become <name> and <name> 2, in catalog order", async () => {
      const resources = await getCatalog();
      resources[3] = { ...resources[3], name: "Events" };
      const planned = await plan([], resources);
      expect(planned[0].name).toBe("Events");
      expect(planned[3].name).toBe("Events 2");
      // and the next free number after that
      const third = await plan(
        [{ ...userVariable, scopeInstanceId: ":root", name: "Events 2" }],
        resources
      );
      expect(third[1].name).toBe("Events");
      expect(third[4].name).toBe("Events 3");
    });

    test("a renamed collection's binding is renamed and keeps its id", async () => {
      const resources = await getCatalog();
      const first = await plan([], resources);
      resources[3] = { ...resources[3], name: "News" };
      const second = await plan(first, resources);
      expect(second[3]).toEqual({ ...first[3], name: "News" });
    });

    test("a kept legacy :root Forms binding makes the new one OrganizeOS Forms 2", async () => {
      const resources = await getCatalog();
      const { bindingId } = await getResourcePresetIds(projectId, "forms");
      const legacy: DataSource = {
        type: "resource",
        id: bindingId,
        scopeInstanceId: ":root",
        name: "OrganizeOS Forms",
        resourceId: resources[4].id,
      };
      const planned = await plan([legacy], resources);
      expect(planned[0]).toBe(legacy);
      expect(planned[5]).toEqual(
        await rootBinding("forms", "OrganizeOS Forms 2", resources[4].id)
      );
    });

    test("page-root, block and legacy-id bindings come back byte-identical", async () => {
      const resources = await getCatalog();
      const { bindingId } = await getResourcePresetIds(projectId, "events");
      const others: DataSource[] = [
        {
          type: "resource",
          id: "page-events",
          scopeInstanceId: "body",
          name: "Events",
          resourceId: resources[0].id,
        },
        {
          type: "resource",
          id: "block-forms",
          scopeInstanceId: "signup-form",
          name: "OrganizeOS Forms",
          resourceId: resources[4].id,
        },
        {
          type: "resource",
          id: bindingId,
          name: "Events",
          resourceId: resources[0].id,
        },
      ];
      const planned = await plan(others, resources);
      expect(JSON.stringify(planned.slice(0, 3))).toBe(JSON.stringify(others));
    });

    test("a build with no catalog comes back unchanged", async () => {
      const mine: Resource = {
        id: "mine",
        name: "Mine",
        method: "get",
        url: `"https://example.org"`,
        headers: [],
      };
      const dataSources = [userVariable];
      expect(await plan(dataSources, [mine])).toBe(dataSources);
    });
  });

  describe("not wanted", () => {
    test("removes unreferenced catalog :root bindings, keeps referenced ones", async () => {
      const resources = await getCatalog();
      const bindings = await getExpected(resources);
      const [events, fundraisers, stats] = bindings;
      const props: Prop[] = [
        {
          id: "p",
          instanceId: "text",
          name: "title",
          type: "expression",
          value: `${encodeDataSourceVariable(events.id)}.data`,
        },
      ];
      const userResource: Resource = {
        id: "mine",
        name: "Mine",
        method: "get",
        url: `"https://example.org/" + ${encodeDataSourceVariable(fundraisers.id)}.data`,
        headers: [],
      };
      const dataSources = [userVariable, ...bindings];
      const planned = await plan(
        dataSources,
        [...resources, userResource],
        false,
        createBindingReferenceTest({
          dataSources,
          resources: [...resources, userResource],
          searchable: [JSON.stringify(props)],
        })
      );
      expect(planned).toEqual([userVariable, events, fundraisers]);
      expect(planned).not.toContain(stats);
    });

    test("removes nothing without a reference test", async () => {
      const resources = await getCatalog();
      const dataSources = [userVariable, ...(await getExpected(resources))];
      expect(await plan(dataSources, resources, false)).toBe(dataSources);
    });

    test("adds nothing; a build without a catalog :root binding comes back identical", async () => {
      const resources = await getCatalog();
      const { bindingId } = await getResourcePresetIds(projectId, "forms");
      const dataSources: DataSource[] = [
        userVariable,
        {
          type: "resource",
          id: bindingId,
          scopeInstanceId: ":root",
          name: "OrganizeOS Forms",
          resourceId: resources[4].id,
        },
      ];
      expect(await plan(dataSources, resources, false, () => false)).toBe(
        dataSources
      );
    });
  });
});

describe("buildMissingCatalogResources", () => {
  const projectId = "project-1";
  const base = "https://app.example.org/api/public/v1";

  test("builds Forms and Upcoming Events from Events, as provisioning does", async () => {
    const presets = await buildOrgResourcePresets({
      projectId,
      apiBaseUrl: base,
      readToken: "osk_secrettoken",
    });
    const byName = (name: string) =>
      presets.resources.find((resource) => resource.name === name);
    const events = byName("Events");
    if (events === undefined) {
      throw new Error("no events");
    }
    expect(await buildMissingCatalogResources(projectId, [events])).toEqual([
      byName("OrganizeOS Forms"),
      byName("Upcoming Events"),
    ]);
  });

  test("returns only the missing ones", async () => {
    const presets = await buildOrgResourcePresets({
      projectId,
      apiBaseUrl: base,
      readToken: "osk_secrettoken",
    });
    const [events, , , forms, upcoming] = presets.resources;
    expect(
      await buildMissingCatalogResources(projectId, [events, forms])
    ).toEqual([upcoming]);
    expect(
      await buildMissingCatalogResources(projectId, [events, forms, upcoming])
    ).toEqual([]);
  });

  test("no usable seed returns none", async () => {
    expect(await buildMissingCatalogResources(projectId, [])).toEqual([]);
    const { resourceId } = await getResourcePresetIds(projectId, "events");
    expect(
      await buildMissingCatalogResources(projectId, [
        {
          id: resourceId,
          name: "Events",
          method: "get",
          url: `"https://app.example.org/api/public/v1/events"`,
          headers: [],
        },
      ])
    ).toEqual([]);
  });
});

// OrganizeOS fork (fork doc sections 5.1 and 9): the writers of the catalog's
// `:root` bindings, and their compare-and-set on { id, version, updatedAt }.
describe("the catalog's :root bindings, written", () => {
  const projectId = "project-1";
  const base = "https://app.example.org/api/public/v1";
  const token = `"Bearer osk_secrettoken"`;
  const now = "2026-11-12T10:00:00.000Z";
  const read = "2026-11-01T00:00:00.000Z";

  afterEach(() => {
    vi.useRealTimers();
  });

  const preset = async (key: string, name: string, path: string) =>
    ({
      id: (await getResourcePresetIds(projectId, key)).resourceId,
      name,
      method: "get",
      url: JSON.stringify(`${base}${path}`),
      headers: [{ name: "Authorization", value: token }],
    }) satisfies Resource;
  const getStatic = async () => [
    await preset("events", "Events", "/events"),
    await preset("fundraisers", "Fundraisers", "/fundraisers"),
    await preset("stats", "Stats", "/stats"),
  ];
  const getFull = async () => [
    ...(await getStatic()),
    await preset("forms", "OrganizeOS Forms", "/forms"),
    await preset("upcoming-events", "Upcoming Events", "/events?upcoming=true"),
  ];
  const keys = ["events", "fundraisers", "stats", "forms", "upcoming-events"];
  const getBindings = async (resources: Resource[]) =>
    Promise.all(
      resources.map(
        async (resource, index): Promise<DataSource> => ({
          type: "resource",
          id: await getCatalogRootBindingId(projectId, keys[index]),
          scopeInstanceId: ":root",
          name: resource.name,
          resourceId: resource.id,
        })
      )
    );
  const parse = (row: BuildRow | null) => ({
    resources: JSON.parse(row?.resources ?? "[]") as Resource[],
    dataSources: JSON.parse(row?.dataSources ?? "[]") as DataSource[],
  });

  describe("a token provision", () => {
    const args = {
      projectId,
      apiBaseUrl: base,
      readToken: "osk_secrettoken",
    };

    test("wanted: the Resources and the bindings in one version-bumped write on { id, version, updatedAt }", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(now));
      const { context, state } = makeBuildContext({ build: {} });
      await seedProjectResourcePresets(context, { ...args, wanted: true });

      expect(state.writes).toHaveLength(1);
      const [write] = state.writes;
      expect(write.match).toEqual({
        id: "build-1",
        version: 7,
        updatedAt: read,
      });
      expect(write.payload).toMatchObject({
        version: 8,
        lastTransactionId: null,
        updatedAt: now,
      });
      const full = await getFull();
      expect(parse(state.row)).toEqual({
        resources: full,
        dataSources: await getBindings(full),
      });
    });

    test("not wanted: no binding, and the unreferenced ones go", async () => {
      const full = await getFull();
      const bindings = await getBindings(full);
      const props: Prop[] = [
        {
          id: "p",
          instanceId: "text",
          name: "title",
          type: "expression",
          value: `${encodeDataSourceVariable(bindings[1].id)}.data`,
        },
      ];
      const { context, state } = makeBuildContext({
        build: {
          props: JSON.stringify(props),
          resources: JSON.stringify(full),
          dataSources: JSON.stringify(bindings),
        },
      });
      await seedProjectResourcePresets(context, { ...args, wanted: false });
      expect(parse(state.row).dataSources).toEqual([bindings[1]]);
    });
  });

  describe("the entry re-sync (syncCatalogRootBindings)", () => {
    test("wanted: the missing Forms and Upcoming Events and the bindings, in one write that keeps the version", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(now));
      const { context, state } = makeBuildContext({
        build: { resources: JSON.stringify(await getStatic()) },
      });
      await syncCatalogRootBindings(context, { projectId, wanted: true });

      expect(state.writes).toHaveLength(1);
      const [write] = state.writes;
      expect(write.match).toEqual({
        id: "build-1",
        version: 7,
        updatedAt: read,
      });
      expect(write.payload.updatedAt).toBe(now);
      expect(write.payload).not.toHaveProperty("version");
      expect(write.payload).not.toHaveProperty("lastTransactionId");
      expect(state.row?.version).toBe(7);
      const full = await getFull();
      expect(parse(state.row)).toEqual({
        resources: full,
        dataSources: await getBindings(full),
      });
    });

    test("wanted: writes nothing when the build already holds them", async () => {
      const full = await getFull();
      const { context, state } = makeBuildContext({
        build: {
          resources: JSON.stringify(full),
          dataSources: JSON.stringify(await getBindings(full)),
        },
      });
      await syncCatalogRootBindings(context, { projectId, wanted: true });
      expect(state.writes).toEqual([]);
    });

    test("a read stale by updatedAt alone loses, re-reads, and keeps the other writer's change", async () => {
      const blog = await preset(
        "collection:blog",
        "Blog",
        "/collections/blog/items"
      );
      const { context, state } = makeBuildContext({
        build: { resources: JSON.stringify(await getFull()) },
        versionKeepingWrites: [
          (row) => {
            // collections-sync, same version
            row.resources = JSON.stringify([
              ...(JSON.parse(row.resources) as Resource[]),
              blog,
            ]);
            row.updatedAt = "2026-11-02T00:00:00.000Z";
          },
        ],
      });
      await syncCatalogRootBindings(context, { projectId, wanted: true });

      expect(state.writes).toHaveLength(2);
      expect(state.writes[0].match.updatedAt).toBe(read);
      expect(state.writes[1].match.updatedAt).toBe("2026-11-02T00:00:00.000Z");
      expect(state.row?.version).toBe(7);
      const { resources, dataSources } = parse(state.row);
      expect(resources.at(-1)).toEqual(blog);
      expect(dataSources.map(({ name }) => name)).toEqual([
        "Events",
        "Fundraisers",
        "Stats",
        "Blog",
        "OrganizeOS Forms",
        "Upcoming Events",
      ]);
    });

    test("matches a null updatedAt with is null", async () => {
      const { context, state } = makeBuildContext({
        build: { updatedAt: null, resources: JSON.stringify(await getFull()) },
      });
      await syncCatalogRootBindings(context, { projectId, wanted: true });
      expect(state.writes[0].match).toEqual({
        id: "build-1",
        version: 7,
        updatedAt: null,
      });
      expect(state.writes).toHaveLength(1);
    });

    test("not wanted, with no catalog :root binding: one small read, no write", async () => {
      const { context, state } = makeBuildContext({
        build: { resources: JSON.stringify(await getFull()) },
      });
      await syncCatalogRootBindings(context, { projectId, wanted: false });
      expect(state.selects).toEqual([
        "id, version, updatedAt, dataSources, resources",
      ]);
      expect(state.writes).toEqual([]);
    });

    test("not wanted, with one: reads the instances, props and pages, and removes it when unreferenced", async () => {
      const full = await getFull();
      const bindings = await getBindings(full);
      const instances: Instance[] = [
        {
          type: "instance",
          id: "text",
          component: "Text",
          children: [
            {
              type: "expression",
              value: `${encodeDataSourceVariable(bindings[0].id)}.data`,
            },
          ],
        },
      ];
      const { context, state } = makeBuildContext({
        build: {
          instances: JSON.stringify(instances),
          resources: JSON.stringify(full),
          dataSources: JSON.stringify(bindings),
        },
      });
      await syncCatalogRootBindings(context, { projectId, wanted: false });
      expect(state.selects).toEqual([
        "id, version, updatedAt, dataSources, resources",
        "instances, props, pages",
      ]);
      expect(parse(state.row)).toEqual({
        resources: full,
        dataSources: [bindings[0]],
      });
      expect(state.writes[0].payload).not.toHaveProperty("resources");
      expect(state.row?.version).toBe(7);
    });

    test("gives up after three lost compare-and-sets", async () => {
      const lose = (row: BuildRow) => {
        row.updatedAt = `${row.updatedAt}+`;
      };
      const { context, state } = makeBuildContext({
        build: { resources: JSON.stringify(await getFull()) },
        versionKeepingWrites: [lose, lose, lose],
      });
      await expect(
        syncCatalogRootBindings(context, { projectId, wanted: true })
      ).rejects.toThrow("kept changing");
      expect(state.writes).toHaveLength(3);
    });

    test("no build, or no catalog: no write", async () => {
      const missing = makeBuildContext({ build: null });
      await syncCatalogRootBindings(missing.context, {
        projectId,
        wanted: true,
      });
      expect(missing.state.writes).toEqual([]);

      const empty = makeBuildContext({ build: {} });
      await syncCatalogRootBindings(empty.context, { projectId, wanted: true });
      expect(empty.state.writes).toEqual([]);
    });
  });
});

describe("the browser's collection Resource", async () => {
  const projectId = "project-1";
  const staticPresets = await buildOrgResourcePresets({
    projectId,
    apiBaseUrl: "https://app.example.org/api/public/v1/",
    readToken: "osk_secrettoken",
  });

  test("the browser builder's Resource equals the server's for the same snapshot and seed", async () => {
    const seed = await readV1PresetSeed({
      projectId,
      resources: staticPresets.resources,
    });
    expect(seed).toBeDefined();
    // CMS collections, as the sync sends them: kind unset; one whose slug is
    // a static preset's key
    const collections = [
      { slug: "news", name: "News" },
      { slug: "events", name: "Our events" },
      { slug: "board-members", name: "Board members" },
    ];
    const server = await buildCollectionResourcePresets({
      projectId,
      apiBase: seed!.apiBase,
      authHeaderExpression: seed!.authHeaderExpression,
      collections,
    });
    const { buildCollectionResource } =
      await import("../organizeos-collection-resource");
    const browser = await Promise.all(
      collections.map((collection) =>
        buildCollectionResource({ projectId, seed: seed!, collection })
      )
    );
    expect(browser).toEqual(server.resources);
    expect(browser.map((resource) => resource?.id)).toEqual(
      server.resources.map((resource) => resource.id)
    );
    expect(browser).toHaveLength(3);
  });
});
