import { describe, expect, test } from "vitest";
import type { DataSource, Resource } from "@webstudio-is/sdk";
import { getResourcePresetIds } from "../organizeos-preset-ids";
import {
  buildCollectionResourcePresets,
  buildOrgResourcePresets,
  COLLECTION_SLUG_RE,
  readV1PresetSeed,
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

  test("emits one GET Resource per preset plus bindings", async () => {
    const { dataSources, resources } = await buildOrgResourcePresets(args);

    expect(resources).toHaveLength(V1_RESOURCE_PRESETS.length);
    // one resource binding per preset; no variable indirection
    expect(dataSources).toHaveLength(V1_RESOURCE_PRESETS.length);

    for (const resource of resources) {
      expect(resource.method).toBe("get");
    }
  });

  test("inlines the token as a literal auth header on every resource", async () => {
    const { dataSources, resources } = await buildOrgResourcePresets(args);

    // No variable indirection: variables are instance-scoped and page codegen
    // drops out-of-scope ones, which broke published pages.
    expect(dataSources.some((source) => source.type === "variable")).toBe(
      false
    );

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

  test("every resource binding references a real resource id", async () => {
    const { dataSources, resources } = await buildOrgResourcePresets(args);
    const resourceIds = new Set(resources.map((r) => r.id));
    const bindings = dataSources.filter((s) => s.type === "resource");
    expect(bindings).toHaveLength(V1_RESOURCE_PRESETS.length);
    for (const binding of bindings) {
      expect(resourceIds.has(binding.resourceId)).toBe(true);
    }
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
    expect(a1.dataSources.map((d) => d.id)).toEqual(
      a2.dataSources.map((d) => d.id)
    );
    // Different project -> different ids (no cross-project collision).
    expect(a1.resources[0].id).not.toBe(b.resources[0].id);
  });

  test("keeps the ids live projects already carry, and gives Forms the ones the builder panel uses", async () => {
    const { dataSources, resources } = await buildOrgResourcePresets(args);
    const events = resources.find((resource) => resource.name === "Events");
    const forms = resources.find(
      (resource) => resource.name === "OrganizeOS Forms"
    );
    // Derived by the node:crypto implementation this replaced.
    expect(events?.id).toBe("385fcd4c-92f8-5d7c-abfe-cb941b8f2449");
    expect(forms?.id).toBe("5bd1e1fb-1480-5d7a-ad4b-75e9cbeec7dd");
    expect(
      dataSources.find((source) => source.name === "OrganizeOS Forms")
    ).toEqual({
      type: "resource",
      id: "fb5d31a4-caab-5681-b150-3a1059d89124",
      scopeInstanceId: ":root",
      name: "OrganizeOS Forms",
      resourceId: "5bd1e1fb-1480-5d7a-ad4b-75e9cbeec7dd",
    });
  });

  test("scopes Forms at :root, so it loads, and leaves Events, Fundraisers and Stats unscoped", async () => {
    const { dataSources } = await buildOrgResourcePresets(args);
    expect(
      dataSources.map((source) => [source.name, source.scopeInstanceId])
    ).toEqual([
      ["Events", undefined],
      ["Fundraisers", undefined],
      ["Stats", undefined],
      ["OrganizeOS Forms", ":root"],
    ]);
  });
});

describe("seedProjectResourcePresets", () => {
  const args = {
    projectId: "project-1",
    apiBaseUrl: "https://app.example.org/api/public/v1",
    readToken: "osk_secrettoken",
  };

  // Minimal chainable Build-table mock: select().eq().is().single() resolves the
  // stored row; update().eq() records the written payload.
  const makeContext = (row: {
    dataSources: string | null;
    resources: string | null;
  }) => {
    const updates: Array<Record<string, unknown>> = [];
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              single: async () => ({
                data: { id: "build-1", ...row },
                error: null,
              }),
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      }),
    };
    return { context: { postgrest: { client } } as never, updates };
  };

  const getWritten = (updates: Array<Record<string, unknown>>) => ({
    resources: JSON.parse(updates[0].resources as string) as Resource[],
    dataSources: JSON.parse(updates[0].dataSources as string) as DataSource[],
  });

  // Events, Fundraisers and Stats as every provision has seeded them: their
  // ids, their shapes, and no scope.
  const getAlwaysSeeded = async () => {
    const resources: Resource[] = [];
    const dataSources: DataSource[] = [];
    for (const [key, name] of [
      ["events", "Events"],
      ["fundraisers", "Fundraisers"],
      ["stats", "Stats"],
    ] as const) {
      const { resourceId, bindingId } = await getResourcePresetIds(
        args.projectId,
        key
      );
      resources.push({
        id: resourceId,
        name,
        method: "get",
        url: `"https://app.example.org/api/public/v1/${key}"`,
        headers: [{ name: "Authorization", value: `"Bearer osk_secrettoken"` }],
      });
      dataSources.push({ type: "resource", id: bindingId, name, resourceId });
    }
    return { resources, dataSources };
  };

  test("seeds Events, Fundraisers and Stats into an empty build, as before, and not Forms", async () => {
    const { context, updates } = makeContext({
      dataSources: "[]",
      resources: "[]",
    });
    await seedProjectResourcePresets(context, args);

    expect(updates).toHaveLength(1);
    expect(getWritten(updates)).toEqual(await getAlwaysSeeded());
  });

  test("is idempotent: re-seeding replaces presets in place, not duplicating", async () => {
    const first = await buildOrgResourcePresets(args);
    const { context, updates } = makeContext({
      dataSources: JSON.stringify(first.dataSources),
      resources: JSON.stringify(first.resources),
    });
    await seedProjectResourcePresets(context, args);

    const writtenResources = JSON.parse(updates[0].resources as string);
    const writtenDataSources = JSON.parse(updates[0].dataSources as string);
    expect(writtenResources).toHaveLength(V1_RESOURCE_PRESETS.length);
    expect(writtenDataSources).toHaveLength(V1_RESOURCE_PRESETS.length);
  });

  test("preserves unrelated user-authored dataSources and resources", async () => {
    const userVariable: DataSource = {
      type: "variable",
      id: "user-var",
      name: "My variable",
      value: { type: "string", value: "keep me" },
    };
    const { context, updates } = makeContext({
      dataSources: JSON.stringify([userVariable]),
      resources: "[]",
    });
    await seedProjectResourcePresets(context, args);

    const writtenDataSources = JSON.parse(
      updates[0].dataSources as string
    ) as DataSource[];
    expect(writtenDataSources.some((d) => d.id === "user-var")).toBe(true);
    // user var + one binding per preset every build gets
    expect(writtenDataSources).toEqual([
      userVariable,
      ...(await getAlwaysSeeded()).dataSources,
    ]);
  });

  describe("Forms, seeded only where a block uses it", () => {
    // As the builder's panel or a provision writes it.
    const getForms = async () => {
      const { resourceId, bindingId } = await getResourcePresetIds(
        args.projectId,
        "forms"
      );
      const resource: Resource = {
        id: resourceId,
        name: "OrganizeOS Forms",
        method: "get",
        url: `"https://app.example.org/api/public/v1/forms"`,
        headers: [{ name: "Authorization", value: `"Bearer osk_secrettoken"` }],
      };
      const binding: DataSource = {
        type: "resource",
        id: bindingId,
        scopeInstanceId: ":root",
        name: "OrganizeOS Forms",
        resourceId,
      };
      return { resource, binding };
    };

    test.each([
      ["its binding, unscoped", "binding"],
      ["its resource", "resource"],
      ["both, edited by a designer", "both"],
    ])(
      "is rewritten in place, both records whole, when the build has %s",
      async (_case, present) => {
        const forms = await getForms();
        const { binding, resource } = forms;
        const existing = {
          dataSources:
            present === "resource"
              ? []
              : [{ ...binding, scopeInstanceId: undefined, name: "My forms" }],
          resources:
            present === "binding"
              ? []
              : [
                  {
                    ...resource,
                    name: "My forms",
                    searchParams: [{ name: "kind", value: `"membership"` }],
                    headers: [
                      { name: "Authorization", value: `"Bearer osk_old"` },
                    ],
                  },
                ],
        };
        const { context, updates } = makeContext({
          dataSources: JSON.stringify(existing.dataSources),
          resources: JSON.stringify(existing.resources),
        });

        await seedProjectResourcePresets(context, args);

        const always = await getAlwaysSeeded();
        expect(getWritten(updates)).toEqual({
          resources: [...always.resources, resource],
          dataSources: [...always.dataSources, binding],
        });
      }
    );

    test("is never added to a build that has neither, whatever its records are named", async () => {
      const forms = await getForms();
      const lookalike = {
        binding: { ...forms.binding, id: "user-binding", resourceId: "user" },
        resource: { ...forms.resource, id: "user" },
      };
      const { context, updates } = makeContext({
        dataSources: JSON.stringify([lookalike.binding]),
        resources: JSON.stringify([lookalike.resource]),
      });

      await seedProjectResourcePresets(context, args);

      const always = await getAlwaysSeeded();
      expect(getWritten(updates)).toEqual({
        resources: [lookalike.resource, ...always.resources],
        dataSources: [lookalike.binding, ...always.dataSources],
      });
    });
  });

  test("throws when the dev build cannot be loaded", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              single: async () => ({
                data: null,
                error: { message: "not found" },
              }),
            }),
          }),
        }),
      }),
    };
    await expect(
      seedProjectResourcePresets({ postgrest: { client } } as never, args)
    ).rejects.toBeTruthy();
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

  test("emits one GET Resource and one binding per collection", async () => {
    const { dataSources, resources } =
      await buildCollectionResourcePresets(args);

    expect(resources).toEqual([
      {
        id: expect.any(String),
        name: "Blog posts",
        method: "get",
        url: `"https://app.example.org/api/public/v1/collections/blog/items"`,
        headers: [{ name: "Authorization", value: `"Bearer osk_secrettoken"` }],
      },
      {
        id: expect.any(String),
        name: "Team",
        method: "get",
        url: `"https://app.example.org/api/public/v1/collections/team/items"`,
        headers: [{ name: "Authorization", value: `"Bearer osk_secrettoken"` }],
      },
    ]);
    expect(dataSources).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        name: "Blog posts",
        resourceId: resources[0].id,
      },
      {
        type: "resource",
        id: expect.any(String),
        name: "Team",
        resourceId: resources[1].id,
      },
    ]);
    // Project-level, like the static presets.
    for (const dataSource of dataSources) {
      expect(dataSource).not.toHaveProperty("scopeInstanceId");
    }
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
    expect(a1.dataSources.map((d) => d.id)).toEqual(
      a2.dataSources.map((d) => d.id)
    );
    expect(a1.resources[0].id).not.toBe(b.resources[0].id);
    expect(a1.dataSources[0].id).not.toBe(b.dataSources[0].id);
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
    const ids = [collections, statics].flatMap((presets) => [
      ...presets.resources.map((r) => r.id),
      ...presets.dataSources.map((d) => d.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("a rename keeps the ids and changes the names", async () => {
    const before = await buildCollectionResourcePresets(args);
    const after = await buildCollectionResourcePresets({
      ...args,
      collections: [{ slug: "blog", name: "Journal" }],
    });
    expect(after.resources[0].id).toBe(before.resources[0].id);
    expect(after.dataSources[0].id).toBe(before.dataSources[0].id);
    expect(after.resources[0].name).toBe("Journal");
    expect(after.dataSources[0].name).toBe("Journal");
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
      const { dataSources, resources } = await buildCollectionResourcePresets({
        ...args,
        collections: [
          { slug: key, name: "Covered", kind: "platform" },
          { slug: "blog", name: "Blog posts", kind: "curated" },
        ],
      });
      expect(resources.map((r) => r.name)).toEqual(["Blog posts"]);
      expect(dataSources.map((d) => d.name)).toEqual(["Blog posts"]);
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
    const { dataSources, resources } = await buildCollectionResourcePresets({
      ...args,
      collections: [
        { slug: "blog", name: "First" },
        { slug: "team", name: "Team" },
        { slug: "blog", name: "Last" },
      ],
    });
    expect(resources.map((r) => r.name).sort()).toEqual(["Last", "Team"]);
    expect(dataSources.map((d) => d.name).sort()).toEqual(["Last", "Team"]);
  });

  test("no collections, no presets", async () => {
    expect(
      await buildCollectionResourcePresets({ ...args, collections: [] })
    ).toEqual({ dataSources: [], resources: [] });
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
