import { describe, expect, test } from "vitest";
import {
  encodeDataSourceVariable,
  type DataSource,
  type Instance,
  type Prop,
  type Resource,
} from "@webstudio-is/sdk";
import { getResourcePresetIds } from "../organizeos-preset-ids";
import {
  buildCollectionResourcePresets,
  buildOrgResourcePresets,
  COLLECTION_SLUG_RE,
  readV1PresetSeed,
  removeUnusedPresetBindings,
  seedProjectResourcePresets,
  upsertById,
  V1_RESOURCE_PRESETS,
} from "./resource-presets.server";

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
});

type BuildRow = {
  id: string;
  version: number;
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
 * Stateful fake of the Build table. The update honours its match on version
 * the way PostgREST does (no row matches, count 0). Each `builderSaves` entry
 * is a builder save that lands just before a write: it bumps the version (and
 * may change the build), so that write loses.
 */
const makeBuildContext = ({
  build,
  builderSaves = [],
}: {
  build: Partial<BuildRow> | null;
  builderSaves?: Array<(row: BuildRow) => void>;
}) => {
  const row: BuildRow | null =
    build === null
      ? null
      : {
          id: "build-1",
          version: 7,
          instances: "[]",
          props: "[]",
          dataSources: "[]",
          resources: "[]",
          pages: "{}",
          ...build,
        };
  const state = { row, reads: 0, writes: [] as Write[] };
  const pendingSaves = [...builderSaves];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            single: async () => {
              state.reads += 1;
              return state.row === null
                ? { data: null, error: { message: "not found" } }
                : { data: { ...state.row }, error: null };
            },
          }),
        }),
      }),
      update: (payload: Record<string, unknown>, options: unknown) => ({
        match: async (match: Record<string, unknown>) => {
          state.writes.push({ payload, options, match });
          const save = pendingSaves.shift();
          if (save !== undefined && state.row !== null) {
            save(state.row);
            state.row.version += 1;
          }
          if (state.row === null || state.row.version !== match.version) {
            return { error: null, count: 0 };
          }
          Object.assign(state.row, payload);
          return { error: null, count: 1 };
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

  // Events, Fundraisers and Stats as every provision seeds them.
  const getAlwaysSeeded = async (token = "osk_secrettoken") => {
    const resources: Resource[] = [];
    for (const [key, name] of [
      ["events", "Events"],
      ["fundraisers", "Fundraisers"],
      ["stats", "Stats"],
    ] as const) {
      const { resourceId } = await getResourcePresetIds(projectId, key);
      resources.push({
        id: resourceId,
        name,
        method: "get",
        url: `"https://app.example.org/api/public/v1/${key}"`,
        headers: [{ name: "Authorization", value: `"Bearer ${token}"` }],
      });
    }
    return resources;
  };

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

  test("seeds Events, Fundraisers and Stats into an empty build, and neither Forms nor a binding", async () => {
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
    expect(state.writes[0].match).toEqual({ id: "build-1", version: 7 });
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

    const [newEvents, newFundraisers, newStats] = await getAlwaysSeeded();
    expect(parseRow(state.row)).toEqual({
      resources: [newStats, userResource, newEvents, newFundraisers],
      dataSources: [userVariable],
    });
  });

  describe("Forms, which only the panel creates", () => {
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

      expect(parseRow(state.row).resources).toEqual([
        (await getForms()).resource,
        ...(await getAlwaysSeeded()),
      ]);
    });

    test("is never created, whatever else the build has", async () => {
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
              url: `"https://example.org/?" + ${encodeDataSourceVariable(fundraisers.id)}.status`,
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
