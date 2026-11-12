import { afterEach, describe, expect, test, vi } from "vitest";
import {
  encodeDataSourceVariable,
  type DataSource,
  type Resource,
} from "@webstudio-is/sdk";
import {
  getCatalogRootBindingId,
  getResourcePresetIds,
} from "../organizeos-preset-ids";
import { syncOrgCollectionPresets } from "./collections-sync.server";
import { deriveProjectId } from "./provision.server";
import {
  buildOrgResourcePresets,
  seedProjectResourcePresets,
  upsertById,
  V1_RESOURCE_PRESETS,
} from "./resource-presets.server";
import collectionsFixture from "./__fixtures__/v1/collections.json";

const organizationId = "org-1";
const projectId = deriveProjectId(organizationId);
const apiBaseUrl = "https://app.example.org/api/public/v1";

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

// Stateful fake of the two tables the sync touches. The Build update honours
// its match on id, version and updatedAt the way PostgREST does: no row
// matches, count 0. Each `builderSaves` entry is a builder save that lands
// just before a write: it bumps the version (and may add to the build), so
// that write loses. Each `versionKeepingWrites` entry is the entry re-sync's
// write, which changes the build and updatedAt and keeps the version.
const makeContext = ({
  project = { id: projectId, isDeleted: false },
  build,
  builderSaves = [],
  versionKeepingWrites = [],
  writeError = null,
}: {
  project?: { id: string; isDeleted: boolean } | null;
  build: Partial<BuildRow> | null;
  builderSaves?: Array<(row: BuildRow) => void>;
  versionKeepingWrites?: Array<(row: BuildRow) => void>;
  writeError?: { message: string } | null;
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
  const state = { row, reads: 0, writes: [] as Write[] };
  const pendingSaves = [...builderSaves];
  const pendingOtherWrites = [...versionKeepingWrites];

  const client = {
    from: (table: string) => {
      if (table === "Project") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: project, error: null }),
            }),
          }),
        };
      }
      return {
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
          match: (match: Record<string, unknown>) => {
            const conditions = { ...match };
            const run = async () => {
              state.writes.push({ payload, options, match: conditions });
              if (writeError !== null) {
                return { error: writeError, count: null };
              }
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
                  ([column, value]) =>
                    current[column as keyof BuildRow] !== value
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
                resolve: (value: {
                  error: { message: string } | null;
                  count: number | null;
                }) => Result,
                reject?: (reason: unknown) => Result
              ) => run().then(resolve, reject),
            };
            return query;
          },
        }),
      };
    },
  };
  return { context: { postgrest: { client } } as never, state };
};

// What a provision wrote before Forms and Upcoming Events were seeded for
// every org: Events, Fundraisers and Stats, and no binding. (OrganizeOS fork:
// a provision now writes Forms and Upcoming Events too; the sync copies its
// seed from any of them alike.)
const provisionedPresets = async (
  args: Parameters<typeof buildOrgResourcePresets>[0]
) => {
  const all = await buildOrgResourcePresets(args);
  const names = new Set(
    V1_RESOURCE_PRESETS.filter((preset) =>
      ["events", "fundraisers", "stats"].includes(preset.key)
    ).map((preset) => preset.label)
  );
  return {
    resources: all.resources.filter((item) => names.has(item.name)),
  };
};

const staticPresets = await provisionedPresets({
  projectId,
  apiBaseUrl,
  readToken: "osk_secrettoken",
});

const provisionedBuild = (): Partial<BuildRow> => ({
  resources: JSON.stringify(staticPresets.resources),
});

const collections = [
  { slug: "blog", name: "Blog posts", kind: "curated" },
  { slug: "team", name: "Team", kind: "platform" },
];

const parseRow = (row: BuildRow | null) => ({
  dataSources: JSON.parse(row?.dataSources ?? "[]") as DataSource[],
  resources: JSON.parse(row?.resources ?? "[]") as Resource[],
});

const userVariable: DataSource = {
  type: "variable",
  id: "user-var",
  name: "My variable",
  value: { type: "string", value: "keep me" },
};

const userResource: Resource = {
  id: "user-resource",
  name: "My resource",
  method: "get",
  url: `"https://example.org/data"`,
  headers: [],
};

describe("syncOrgCollectionPresets", () => {
  test("no project for the organization", async () => {
    const { context, state } = makeContext({ project: null, build: {} });
    expect(
      await syncOrgCollectionPresets(context, { organizationId, collections })
    ).toEqual({ status: "no-project" });
    expect(state.reads).toBe(0);
    expect(state.writes).toEqual([]);
  });

  test("a soft-deleted project counts as no project", async () => {
    const { context, state } = makeContext({
      project: { id: projectId, isDeleted: true },
      build: provisionedBuild(),
    });
    expect(
      await syncOrgCollectionPresets(context, { organizationId, collections })
    ).toEqual({ status: "no-project" });
    expect(state.writes).toEqual([]);
  });

  test("no static presets to copy from: nothing is written", async () => {
    const { context, state } = makeContext({
      build: {
        dataSources: JSON.stringify([userVariable]),
        resources: JSON.stringify([userResource]),
      },
    });
    expect(
      await syncOrgCollectionPresets(context, { organizationId, collections })
    ).toEqual({ status: "no-presets" });
    expect(state.writes).toEqual([]);
  });

  test("seeds one Resource per collection after the static presets, and no binding", async () => {
    const { context, state } = makeContext({ build: provisionedBuild() });

    expect(
      await syncOrgCollectionPresets(context, { organizationId, collections })
    ).toEqual({ status: "ok", collections: 2 });

    const { dataSources, resources } = parseRow(state.row);
    expect(resources.map((resource) => resource.name)).toEqual([
      "Events",
      "Fundraisers",
      "Stats",
      "Blog posts",
      "Team",
    ]);
    expect(dataSources).toEqual([]);
    // Base and token come from the static presets, verbatim.
    expect(resources[3]).toMatchObject({
      method: "get",
      url: `"${apiBaseUrl}/collections/blog/items"`,
      headers: [{ name: "Authorization", value: `"Bearer osk_secrettoken"` }],
    });
  });

  test("removes the bindings an older sync or provision wrote where nothing references them", async () => {
    const blog = await getResourcePresetIds(projectId, "collection:blog");
    const team = await getResourcePresetIds(projectId, "collection:team");
    const events = await getResourcePresetIds(projectId, "events");
    const oldBindings: DataSource[] = [
      {
        type: "resource",
        id: events.bindingId,
        name: "Events",
        resourceId: events.resourceId,
      },
      {
        type: "resource",
        id: blog.bindingId,
        name: "Blog posts",
        resourceId: blog.resourceId,
      },
      {
        type: "resource",
        id: team.bindingId,
        name: "Team",
        resourceId: team.resourceId,
      },
    ];
    const { context, state } = makeContext({
      build: {
        ...provisionedBuild(),
        dataSources: JSON.stringify([userVariable, ...oldBindings]),
        // the admin bound Team's
        props: JSON.stringify([
          {
            id: "prop",
            instanceId: "list",
            name: "data",
            type: "expression",
            value: `${encodeDataSourceVariable(team.bindingId)}.data`,
          },
        ]),
      },
    });

    await syncOrgCollectionPresets(context, { organizationId, collections });

    expect(parseRow(state.row).dataSources).toEqual([
      userVariable,
      oldBindings[2],
    ]);
  });

  test("a re-sync leaves the bindings uses brought, in their scopes", async () => {
    const seeded = makeContext({ build: provisionedBuild() });
    await syncOrgCollectionPresets(seeded.context, {
      organizationId,
      collections,
    });
    const blog = await getResourcePresetIds(projectId, "collection:blog");
    const uses: DataSource[] = [
      {
        type: "resource",
        id: "page-binding",
        scopeInstanceId: "page-body",
        name: "Blog posts",
        resourceId: blog.resourceId,
      },
      {
        type: "resource",
        id: "copied-binding",
        scopeInstanceId: "box",
        name: "Blog posts",
        resourceId: "copied-blog",
      },
    ];
    const { context, state } = makeContext({
      build: {
        dataSources: JSON.stringify(uses),
        resources: seeded.state.row?.resources,
      },
    });

    await syncOrgCollectionPresets(context, {
      organizationId,
      collections: [{ slug: "blog", name: "Journal" }, collections[1]],
    });

    const after = parseRow(state.row);
    expect(after.dataSources).toEqual(uses);
    expect(
      after.resources.find((resource) => resource.id === blog.resourceId)?.name
    ).toBe("Journal");
  });

  test("writes with compare-and-swap on the version and updatedAt it read, without bumping it", async () => {
    const { context, state } = makeContext({ build: provisionedBuild() });
    await syncOrgCollectionPresets(context, { organizationId, collections });

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].options).toEqual({ count: "exact" });
    expect(state.writes[0].match).toEqual({
      id: "build-1",
      version: 7,
      updatedAt: "2026-11-01T00:00:00.000Z",
    });
    expect(Object.keys(state.writes[0].payload).sort()).toEqual([
      "dataSources",
      "resources",
      "updatedAt",
    ]);
    expect(state.row?.version).toBe(7);
  });

  test("keeps user-authored entries untouched and in their order", async () => {
    const { context, state } = makeContext({
      build: {
        dataSources: JSON.stringify([userVariable]),
        resources: JSON.stringify([userResource, ...staticPresets.resources]),
      },
    });
    await syncOrgCollectionPresets(context, { organizationId, collections });

    const { dataSources, resources } = parseRow(state.row);
    expect(dataSources).toEqual([userVariable]);
    expect(resources[0]).toEqual(userResource);
    expect(resources.slice(1, 4)).toEqual(staticPresets.resources);
    expect(resources).toHaveLength(6);
  });

  test("a preset stays ahead of entries the admin added after it", async () => {
    const seeded = makeContext({ build: provisionedBuild() });
    await syncOrgCollectionPresets(seeded.context, {
      organizationId,
      collections,
    });
    const afterSeed = parseRow(seeded.state.row);

    // The admin adds a variable and a resource behind the collection presets.
    const { context, state } = makeContext({
      build: {
        dataSources: JSON.stringify([...afterSeed.dataSources, userVariable]),
        resources: JSON.stringify([...afterSeed.resources, userResource]),
      },
    });

    // Unchanged snapshot: still no write, so the panel is not reshuffled.
    await syncOrgCollectionPresets(context, { organizationId, collections });
    expect(state.writes).toEqual([]);

    await syncOrgCollectionPresets(context, {
      organizationId,
      collections: [{ slug: "blog", name: "Journal" }, collections[1]],
    });
    const after = parseRow(state.row);
    expect(after.dataSources).toEqual([userVariable]);
    expect(after.resources.map((resource) => resource.name)).toEqual([
      "Events",
      "Fundraisers",
      "Stats",
      "Journal",
      "Team",
      "My resource",
    ]);
  });

  test("a second identical run performs no write", async () => {
    const { context, state } = makeContext({ build: provisionedBuild() });
    await syncOrgCollectionPresets(context, { organizationId, collections });
    expect(state.writes).toHaveLength(1);

    expect(
      await syncOrgCollectionPresets(context, { organizationId, collections })
    ).toEqual({ status: "ok", collections: 2 });
    expect(state.writes).toHaveLength(1);
  });

  test("a rename updates the names in place and keeps the ids and order", async () => {
    const { context, state } = makeContext({
      build: {
        dataSources: JSON.stringify([userVariable]),
        resources: provisionedBuild().resources,
      },
    });
    await syncOrgCollectionPresets(context, { organizationId, collections });
    const before = parseRow(state.row);

    await syncOrgCollectionPresets(context, {
      organizationId,
      collections: [{ slug: "blog", name: "Journal" }, collections[1]],
    });
    const after = parseRow(state.row);

    expect(after.resources.map((resource) => resource.id)).toEqual(
      before.resources.map((resource) => resource.id)
    );
    expect(after.dataSources).toEqual(before.dataSources);
    expect(after.resources.map((resource) => resource.name)).toEqual([
      "Events",
      "Fundraisers",
      "Stats",
      "Journal",
      "Team",
    ]);
    expect(after.dataSources).toEqual([userVariable]);
  });

  test("follows a token rotated by a re-provision on the next sync", async () => {
    const { context, state } = makeContext({ build: provisionedBuild() });
    await syncOrgCollectionPresets(context, { organizationId, collections });

    // Provisioning with a new token rewrites the static presets in place.
    const rotated = await provisionedPresets({
      projectId,
      apiBaseUrl,
      readToken: "osk_rotated",
    });
    const stored = parseRow(state.row);
    if (state.row !== null) {
      state.row.resources = JSON.stringify(
        upsertById(stored.resources, rotated.resources)
      );
    }

    await syncOrgCollectionPresets(context, { organizationId, collections });

    expect(state.writes).toHaveLength(2);
    for (const resource of parseRow(state.row).resources) {
      expect(resource.headers).toEqual([
        { name: "Authorization", value: `"Bearer osk_rotated"` },
      ]);
    }
  });

  test("a re-provision rotates the token of the collections a sync seeded", async () => {
    const { context, state } = makeContext({ build: {} });
    await seedProjectResourcePresets(context, {
      projectId,
      apiBaseUrl,
      readToken: "osk_t1",
    });
    await syncOrgCollectionPresets(context, { organizationId, collections });
    const before = parseRow(state.row).resources;

    await seedProjectResourcePresets(context, {
      projectId,
      apiBaseUrl,
      readToken: "osk_t2",
    });

    const after = parseRow(state.row).resources;
    expect(after.map((resource) => [resource.id, resource.name])).toEqual(
      before.map((resource) => [resource.id, resource.name])
    );
    for (const resource of after) {
      expect(resource.headers).toEqual([
        { name: "Authorization", value: `"Bearer osk_t2"` },
      ]);
    }
    // provisioning bumped the version both times, the sync never
    expect(state.writes.map((write) => write.payload.version)).toEqual([
      8,
      undefined,
      9,
    ]);
  });

  test("skips a platform collection a static preset covers, and counts the rest", async () => {
    const { context, state } = makeContext({ build: provisionedBuild() });
    expect(
      await syncOrgCollectionPresets(context, {
        organizationId,
        collections: [
          { slug: "events", name: "Events", kind: "platform" },
          { slug: "blog", name: "Blog posts", kind: "curated" },
        ],
      })
    ).toEqual({ status: "ok", collections: 1 });
    expect(parseRow(state.row).resources).toHaveLength(4);
  });

  test("retries after a builder save lands first, and keeps what it saved", async () => {
    const { context, state } = makeContext({
      build: provisionedBuild(),
      builderSaves: [
        (row) => {
          row.dataSources = JSON.stringify([
            ...JSON.parse(row.dataSources),
            userVariable,
          ]);
        },
      ],
    });

    expect(
      await syncOrgCollectionPresets(context, { organizationId, collections })
    ).toEqual({ status: "ok", collections: 2 });

    expect(state.reads).toBe(2);
    expect(state.writes.map((write) => write.match.version)).toEqual([7, 8]);
    // The builder's own save survived: the retry re-read it.
    expect(
      parseRow(state.row).dataSources.map((dataSource) => dataSource.id)
    ).toContain(userVariable.id);
    expect(parseRow(state.row).resources).toHaveLength(5);
    expect(state.row?.version).toBe(8);
  });

  test("gives up after three attempts when the builder keeps saving", async () => {
    const { context, state } = makeContext({
      build: provisionedBuild(),
      builderSaves: [() => {}, () => {}, () => {}],
    });

    expect(
      await syncOrgCollectionPresets(context, { organizationId, collections })
    ).toEqual({ status: "conflict" });
    expect(state.reads).toBe(3);
    expect(state.writes).toHaveLength(3);
    // Nothing of ours landed.
    expect(parseRow(state.row).resources).toHaveLength(3);
  });

  test("throws when the dev build cannot be loaded", async () => {
    const { context } = makeContext({ build: null });
    await expect(
      syncOrgCollectionPresets(context, { organizationId, collections })
    ).rejects.toBeTruthy();
  });

  test("throws on a write error", async () => {
    const writeError = { message: "write failed" };
    const { context } = makeContext({ build: provisionedBuild(), writeError });
    await expect(
      syncOrgCollectionPresets(context, { organizationId, collections })
    ).rejects.toBe(writeError);
  });

  // The payload OrganizeOS sends today: /v1/collections as the API returns it,
  // with the extras (itemCount, options, references) the builder ignores.
  test("seeds the three collections of the canonical OrganizeOS fixture", async () => {
    const { context, state } = makeContext({ build: provisionedBuild() });

    expect(
      await syncOrgCollectionPresets(context, {
        organizationId,
        collections: collectionsFixture.data,
      })
    ).toEqual({ status: "ok", collections: 3 });

    const { dataSources, resources } = parseRow(state.row);
    expect(resources.slice(3).map((resource) => resource.name)).toEqual([
      "Blog posts",
      "Team",
      "Tags",
    ]);
    expect(resources.slice(3).map((resource) => resource.url)).toEqual([
      `"${apiBaseUrl}/collections/blog/items"`,
      `"${apiBaseUrl}/collections/team/items"`,
      `"${apiBaseUrl}/collections/tags/items"`,
    ]);
    expect(dataSources).toEqual([]);
  });
});

// OrganizeOS fork (fork doc section 5.7): the sync writes each catalog
// Resource's :root binding for a wanted org, in the same write.
describe("syncOrgCollectionPresets and the catalog's :root bindings", () => {
  const ALLOWED_ORG = "f0e1d2c3-b4a5-4697-8877-665544332211";
  const allowedProjectId = deriveProjectId(ALLOWED_ORG);
  const on = { switchValue: "true", denyList: undefined };
  const now = "2026-11-12T10:00:00.000Z";

  afterEach(() => {
    vi.useRealTimers();
  });

  const allowedBuild = async () => {
    const all = await buildOrgResourcePresets({
      projectId: allowedProjectId,
      apiBaseUrl,
      readToken: "osk_secrettoken",
    });
    return {
      resources: JSON.stringify(
        all.resources.filter(({ name }) => name !== "Products")
      ),
    };
  };
  const blogBindingId = () =>
    getCatalogRootBindingId(allowedProjectId, "collection:blog");
  const sync = (
    context: Parameters<typeof syncOrgCollectionPresets>[0],
    catalogRootBindings?: { switchValue?: string; denyList?: string }
  ) =>
    syncOrgCollectionPresets(context, {
      organizationId: ALLOWED_ORG,
      collections: [{ slug: "blog", name: "Blog posts", kind: "curated" }],
      catalogRootBindings,
    });

  test("a new collection gets its Resource and its :root binding in one write, version unchanged", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    const { context, state } = makeContext({
      project: { id: allowedProjectId, isDeleted: false },
      build: await allowedBuild(),
    });
    expect(await sync(context, on)).toEqual({ status: "ok", collections: 1 });

    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].match).toEqual({
      id: "build-1",
      version: 7,
      updatedAt: "2026-11-01T00:00:00.000Z",
    });
    expect(state.writes[0].payload.updatedAt).toBe(now);
    expect(state.writes[0].payload).not.toHaveProperty("version");
    expect(state.row?.version).toBe(7);
    const { dataSources, resources } = parseRow(state.row);
    const blog = await getResourcePresetIds(
      allowedProjectId,
      "collection:blog"
    );
    expect(resources.map(({ id }) => id)).toContain(blog.resourceId);
    expect(dataSources.map(({ name }) => name)).toEqual([
      "Events",
      "Fundraisers",
      "Stats",
      "Blog posts",
      "OrganizeOS Forms",
      "Upcoming Events",
    ]);
    expect(dataSources[3]).toEqual({
      type: "resource",
      id: await blogBindingId(),
      scopeInstanceId: ":root",
      name: "Blog posts",
      resourceId: blog.resourceId,
    });
  });

  test("a write whose read is stale by updatedAt alone loses and retries, keeping the other write", async () => {
    const { context, state } = makeContext({
      project: { id: allowedProjectId, isDeleted: false },
      build: await allowedBuild(),
      versionKeepingWrites: [
        (row) => {
          row.dataSources = JSON.stringify([userVariable]);
          row.updatedAt = "2026-11-02T00:00:00.000Z";
        },
      ],
    });
    expect(await sync(context, on)).toEqual({ status: "ok", collections: 1 });
    expect(state.writes).toHaveLength(2);
    expect(state.writes[1].match.updatedAt).toBe("2026-11-02T00:00:00.000Z");
    const { dataSources } = parseRow(state.row);
    expect(dataSources[0]).toEqual(userVariable);
    expect(dataSources).toHaveLength(7);
    expect(state.row?.version).toBe(7);
  });

  test.each([
    ["the switch off", { switchValue: undefined, denyList: undefined }],
    ["a denied org", { switchValue: "true", denyList: ALLOWED_ORG }],
  ])("%s: the Resource, no binding", async (_label, catalogRootBindings) => {
    const { context, state } = makeContext({
      project: { id: allowedProjectId, isDeleted: false },
      build: await allowedBuild(),
    });
    await sync(context, catalogRootBindings);
    const { dataSources, resources } = parseRow(state.row);
    expect(resources.map(({ name }) => name)).toContain("Blog posts");
    expect(dataSources).toEqual([]);
  });

  test("an unchanged snapshot with the bindings present writes nothing", async () => {
    const { context, state } = makeContext({
      project: { id: allowedProjectId, isDeleted: false },
      build: await allowedBuild(),
    });
    await sync(context, on);
    expect(state.writes).toHaveLength(1);
    expect(await sync(context, on)).toEqual({ status: "ok", collections: 1 });
    expect(state.writes).toHaveLength(1);
  });
});
