import { describe, expect, test } from "vitest";
import type { Instance } from "@webstudio-is/sdk";
import {
  flattenText,
  listImages,
  readOverview,
  readPage,
  readSectionType,
  readStaticTitle,
  resolveAgentProject,
} from "./organizeos-agent.server";
import { deriveProjectId } from "./provision.server";

const organizationId = "org-1";
const projectId = deriveProjectId(organizationId);
const otherProjectId = deriveProjectId("org-2");

type Call = { method: string; args: unknown[] };
type Query = { table: string; calls: Call[] };
type Answer = { data: unknown; error: unknown; count?: number };

// A fake PostgREST client: every chain records its calls, and awaiting it (or
// calling maybeSingle) asks `resolve` for the answer. The queries are kept, so
// a test can assert the column lists and filters the code sent.
const makeClient = (resolve: (query: Query) => Answer) => {
  const queries: Query[] = [];
  const client = {
    from: (table: string) => {
      const query: Query = { table, calls: [] };
      queries.push(query);
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "not", "order", "limit"]) {
        chain[method] = (...args: unknown[]) => {
          query.calls.push({ method, args });
          return chain;
        };
      }
      chain.maybeSingle = async () => {
        query.calls.push({ method: "maybeSingle", args: [] });
        return resolve(query);
      };
      chain.then = (
        onFulfilled: (value: Answer) => unknown,
        onRejected: (reason: unknown) => unknown
      ) => Promise.resolve(resolve(query)).then(onFulfilled, onRejected);
      return chain;
    },
  };
  return { client: client as never, queries };
};

const hasCall = (query: Query, method: string, ...args: unknown[]) =>
  query.calls.some(
    (call) =>
      call.method === method &&
      JSON.stringify(call.args.slice(0, args.length)) === JSON.stringify(args)
  );

const eqValue = (query: Query, column: string) =>
  query.calls.find((call) => call.method === "eq" && call.args[0] === column)
    ?.args[1];

const text = (value: string) => ({ type: "text" as const, value });
const id = (value: string) => ({ type: "id" as const, value });
const expression = (value: string) => ({ type: "expression" as const, value });
const instance = (
  instanceId: string,
  component: string,
  children: Instance["children"],
  extra: Partial<Instance> = {}
): Instance => ({
  type: "instance",
  id: instanceId,
  component,
  children,
  ...extra,
});

const longText = "word ".repeat(500);

// Fixture build, stored the way the Build row stores it: JSON strings.
const fixtureInstances: Instance[] = [
  instance("home-body", "Body", [
    id("hero"),
    id("about"),
    id("long"),
    text("stray root text"),
  ]),
  instance("hero", "Box", [id("hero-heading"), id("hero-text")], {
    label: "os-section:hero",
  }),
  instance("hero-heading", "Heading", [text("Welcome  to\nour  site")]),
  instance("hero-text", "Paragraph", [
    text("We "),
    id("hero-bold"),
    text(" together."),
    expression("$ws$dataSource$abc.name"),
  ]),
  instance("hero-bold", "Bold", [text("organize")]),
  instance("about", "Box", [id("about-inner")], { label: "About us" }),
  instance("about-inner", "Box", [id("about-text"), id("about-empty")]),
  instance("about-text", "Paragraph", [text("We started in 2010.")]),
  instance("about-empty", "Paragraph", [
    { type: "text", value: "Paragraph", placeholder: true },
  ]),
  instance("long", "Box", [text(longText)], { label: "os-section:Bad Type" }),
  instance("events-body", "Body", [id("events-list")]),
  instance("events-list", "Box", [text("Upcoming events")], {
    label: "os-section:event-list",
  }),
];

const fixturePages = {
  homePageId: "page-home",
  rootFolderId: "root",
  pages: [
    {
      id: "page-events",
      name: "Events",
      path: "/events",
      title: "$ws$dataSource$title",
      meta: {},
      rootInstanceId: "events-body",
    },
    {
      id: "page-home",
      name: "Home",
      path: "",
      title: `"Home"`,
      meta: {},
      rootInstanceId: "home-body",
    },
  ],
  folders: [
    {
      id: "root",
      name: "Root",
      slug: "",
      children: ["page-home", "page-events"],
    },
  ],
};

type Fixture = {
  project?: { id: string; isDeleted: boolean } | null;
  devUpdatedAt?: string;
  deployedCreatedAt?: string | null;
  assets?: unknown[];
};

const makeFixture = ({
  project = { id: projectId, isDeleted: false },
  devUpdatedAt = "2026-10-20T12:00:00.000Z",
  deployedCreatedAt = null,
  assets = [],
}: Fixture = {}) =>
  makeClient((query) => {
    if (query.table === "Project") {
      // Only the derived project exists in this store.
      const data = eqValue(query, "id") === projectId ? project : null;
      return { data, error: null };
    }
    if (query.table === "Build") {
      if (hasCall(query, "is", "deployment", null)) {
        return {
          data: {
            id: "build-dev",
            version: 4,
            updatedAt: devUpdatedAt,
            pages: JSON.stringify(fixturePages),
            instances: JSON.stringify(fixtureInstances),
          },
          error: null,
        };
      }
      return {
        data:
          deployedCreatedAt === null ? null : { createdAt: deployedCreatedAt },
        error: null,
      };
    }
    if (query.table === "Asset") {
      return { data: assets, error: null };
    }
    throw new Error(`unexpected table ${query.table}`);
  });

const resolveFixture = async (fixture?: Fixture) => {
  const { client, queries } = makeFixture(fixture);
  const resolved = await resolveAgentProject(client, organizationId);
  if (resolved.ok === false) {
    throw new Error("fixture did not resolve");
  }
  return { project: resolved.result, queries };
};

describe("resolveAgentProject", () => {
  test("reads the derived project, the dev build and the newest deployment, with explicit columns", async () => {
    const { project, queries } = await resolveFixture({
      deployedCreatedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(project.projectId).toBe(projectId);
    expect(project.build.id).toBe("build-dev");
    expect(project.lastPublishedAt).toBe("2026-10-01T00:00:00.000Z");

    const [projectQuery, devQuery, deployedQuery] = queries;
    expect(projectQuery.table).toBe("Project");
    expect(hasCall(projectQuery, "select", "id, isDeleted")).toBe(true);
    expect(eqValue(projectQuery, "id")).toBe(projectId);

    expect(devQuery.table).toBe("Build");
    expect(
      hasCall(devQuery, "select", "id, version, updatedAt, pages, instances")
    ).toBe(true);
    expect(eqValue(devQuery, "projectId")).toBe(projectId);
    expect(hasCall(devQuery, "is", "deployment", null)).toBe(true);

    expect(deployedQuery.table).toBe("Build");
    expect(hasCall(deployedQuery, "select", "createdAt")).toBe(true);
    expect(eqValue(deployedQuery, "projectId")).toBe(projectId);
    expect(hasCall(deployedQuery, "not", "deployment", "is", null)).toBe(true);
    expect(
      hasCall(deployedQuery, "order", "createdAt", { ascending: false })
    ).toBe(true);
    expect(hasCall(deployedQuery, "limit", 1)).toBe(true);

    for (const query of queries) {
      const select = query.calls.find((call) => call.method === "select");
      expect(String(select?.args[0])).not.toContain("*");
    }
  });

  test("a missing project answers not_found", async () => {
    const { client } = makeFixture({ project: null });
    expect(await resolveAgentProject(client, organizationId)).toEqual({
      ok: false,
      code: "not_found",
    });
  });

  test("a deleted project answers not_found", async () => {
    const { client, queries } = makeFixture({
      project: { id: projectId, isDeleted: true },
    });
    expect(await resolveAgentProject(client, organizationId)).toEqual({
      ok: false,
      code: "not_found",
    });
    // Nothing is read from a deleted project's builds.
    expect(queries.map((query) => query.table)).toEqual(["Project"]);
  });

  test("another org's id derives another project", async () => {
    const { client } = makeFixture();
    expect(await resolveAgentProject(client, "org-2")).toEqual({
      ok: false,
      code: "not_found",
    });
  });

  test("a store error is thrown, not answered", async () => {
    const { client } = makeClient(() => ({
      data: null,
      error: { message: "boom" },
    }));
    await expect(resolveAgentProject(client, organizationId)).rejects.toEqual({
      message: "boom",
    });
  });
});

describe("readOverview", () => {
  test("lists the home page first, then the rest in order, with static titles", async () => {
    const { project } = await resolveFixture();
    const overview = readOverview(project);
    expect(overview.hasWebsite).toBe(true);
    expect(overview.pages).toEqual([
      { id: "page-home", name: "Home", path: "", title: "Home" },
      { id: "page-events", name: "Events", path: "/events", title: null },
    ]);
  });

  test("with no deployment, the draft has unpublished changes", async () => {
    const { project } = await resolveFixture({ deployedCreatedAt: null });
    const overview = readOverview(project);
    expect(overview.hasUnpublishedChanges).toBe(true);
    expect(overview.lastPublishedAt).toBeNull();
  });

  test("a deployment older than the draft's last change leaves unpublished changes", async () => {
    const { project } = await resolveFixture({
      devUpdatedAt: "2026-10-20T12:00:00.000Z",
      deployedCreatedAt: "2026-10-19T12:00:00.000Z",
    });
    const overview = readOverview(project);
    expect(overview.hasUnpublishedChanges).toBe(true);
    expect(overview.lastPublishedAt).toBe("2026-10-19T12:00:00.000Z");
  });

  test("a deployment newer than the draft's last change leaves none", async () => {
    const { project } = await resolveFixture({
      devUpdatedAt: "2026-10-20T12:00:00.000Z",
      deployedCreatedAt: "2026-10-21T12:00:00.000Z",
    });
    expect(readOverview(project).hasUnpublishedChanges).toBe(false);
  });
});

describe("readStaticTitle", () => {
  test("a JSON string literal is the title", () => {
    expect(readStaticTitle(`"Home"`)).toBe("Home");
  });
  test("an expression, a non-string literal or no title answers null", () => {
    expect(readStaticTitle("$ws$dataSource$title")).toBeNull();
    expect(readStaticTitle("`Hello ${name}`")).toBeNull();
    expect(readStaticTitle("42")).toBeNull();
    expect(readStaticTitle(undefined)).toBeNull();
  });
});

describe("readPage", () => {
  test("sections are the root's direct children, in order, with flattened text", async () => {
    const { project } = await resolveFixture();
    const answer = readPage(project, { pageId: "page-home" });
    expect(answer.ok).toBe(true);
    if (answer.ok === false) {
      return;
    }
    expect(answer.result.page).toEqual({
      id: "page-home",
      name: "Home",
      path: "",
    });
    expect(answer.result.sections.map((section) => section.id)).toEqual([
      "hero",
      "about",
      "long",
    ]);
    const [hero, about] = answer.result.sections;
    // Inline formatting runs with its text, the expression is skipped, and
    // whitespace collapses; the heading and the paragraph stay apart.
    expect(hero).toEqual({
      id: "hero",
      type: "hero",
      label: null,
      text: "Welcome to our site We organize together.",
      truncated: false,
      slots: [],
    });
    // Nested text is found, a placeholder is not content.
    expect(about).toEqual({
      id: "about",
      type: "custom",
      label: "About us",
      text: "We started in 2010.",
      truncated: false,
      slots: [],
    });
  });

  test("text over 2,000 characters is capped and marked truncated", async () => {
    const { project } = await resolveFixture();
    const answer = readPage(project, { pageId: "page-home" });
    if (answer.ok === false) {
      throw new Error("expected a page");
    }
    const long = answer.result.sections[2];
    expect(long.text).toHaveLength(2_000);
    expect(long.truncated).toBe(true);
    // A label that is not the marker's form reads as custom.
    expect(long.type).toBe("custom");
    expect(long.label).toBe("os-section:Bad Type");
  });

  test("a labelled os-section instance reports its type", async () => {
    const { project } = await resolveFixture();
    const answer = readPage(project, { pageId: "page-events" });
    if (answer.ok === false) {
      throw new Error("expected a page");
    }
    expect(answer.result.sections).toEqual([
      {
        id: "events-list",
        type: "event-list",
        label: null,
        text: "Upcoming events",
        truncated: false,
        slots: [],
      },
    ]);
  });

  test("a page id that is not in this project's build answers not_found", async () => {
    const { project } = await resolveFixture();
    expect(readPage(project, { pageId: "page-of-another-project" })).toEqual({
      ok: false,
      code: "not_found",
    });
    // An instance id is not a page id.
    expect(readPage(project, { pageId: "hero" })).toEqual({
      ok: false,
      code: "not_found",
    });
  });
});

describe("readSectionType", () => {
  test("reads the marker's type, and anything else as custom", () => {
    expect(readSectionType("os-section:hero")).toBe("hero");
    expect(readSectionType("os-section:call-to-action")).toBe("call-to-action");
    expect(readSectionType(undefined)).toBe("custom");
    expect(readSectionType("Hero")).toBe("custom");
    expect(readSectionType("os-section:")).toBe("custom");
    expect(readSectionType("x os-section:hero")).toBe("custom");
  });
});

describe("flattenText", () => {
  test("survives a cycle and a missing child", () => {
    const instances = new Map<string, Instance>([
      ["a", instance("a", "Box", [text("one"), id("b"), id("missing")])],
      ["b", instance("b", "Box", [text("two"), id("a")])],
    ]);
    expect(flattenText(instances, "a")).toEqual({
      text: "one two",
      truncated: false,
    });
  });

  test("a rich text element tag runs inline, a block tag does not", () => {
    const instances = new Map<string, Instance>([
      [
        "p",
        instance("p", "ws:element", [text("a"), id("strong"), id("div")], {
          tag: "p",
        }),
      ],
      ["strong", instance("strong", "ws:element", [text("b")], { tag: "b" })],
      ["div", instance("div", "ws:element", [text("c")], { tag: "div" })],
    ]);
    expect(flattenText(instances, "p").text).toBe("ab c");
  });
});

const asset = ({
  assetId,
  filename,
  name,
  meta = { width: 800, height: 600 },
  createdAt,
}: {
  assetId: string;
  filename: string | null;
  name: string;
  meta?: unknown;
  createdAt: string;
}) => ({
  id: assetId,
  filename,
  file: { name, meta: JSON.stringify(meta), createdAt },
});

describe("listImages", () => {
  test("lists uploaded images newest first by display name, never the storage key", async () => {
    const assets = [
      asset({
        assetId: "asset-old",
        filename: "team.jpg",
        name: "team_abc123.jpg",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      asset({
        assetId: "asset-new",
        filename: null,
        name: "logo_def456.png",
        meta: { width: 120, height: 40 },
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
      asset({
        assetId: "asset-font",
        filename: "Inter.woff2",
        name: "inter_1.woff2",
        meta: { family: "Inter", style: "normal", weight: 400 },
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
      asset({
        assetId: "asset-video",
        filename: "clip.mp4",
        name: "clip_1.mp4",
        createdAt: "2026-03-02T00:00:00.000Z",
      }),
      asset({
        assetId: "asset-pdf",
        filename: "report.pdf",
        name: "report_1.pdf",
        meta: {},
        createdAt: "2026-03-03T00:00:00.000Z",
      }),
    ];
    const { client, queries } = makeFixture({ assets });
    const answer = await listImages(client, organizationId);
    expect(answer).toEqual({
      ok: true,
      result: {
        images: [
          {
            id: "asset-new",
            name: null,
            alt: null,
            width: 120,
            height: 40,
          },
          {
            id: "asset-old",
            name: "team.jpg",
            alt: null,
            width: 800,
            height: 600,
          },
        ],
      },
    });
    if (answer.ok === false) {
      return;
    }
    const storageKeys = new Set(assets.map((item) => item.file.name));
    for (const image of answer.result.images) {
      expect(storageKeys.has(String(image.name))).toBe(false);
    }
    expect(JSON.stringify(answer)).not.toContain("_abc123");

    const assetQuery = queries.find((query) => query.table === "Asset");
    if (assetQuery === undefined) {
      throw new Error("expected an asset query");
    }
    expect(
      hasCall(
        assetQuery,
        "select",
        "id, filename, file:File!inner(name, meta, createdAt)"
      )
    ).toBe(true);
    expect(eqValue(assetQuery, "projectId")).toBe(projectId);
    // Uploaded files only: an UPLOADING file never joins.
    expect(hasCall(assetQuery, "eq", "file.status", "UPLOADED")).toBe(true);
  });

  test("an UPLOADING file is absent", async () => {
    // The fake honours the inner join's status filter the way PostgREST does.
    const rows = [
      {
        ...asset({
          assetId: "done",
          filename: "a.png",
          name: "a_1.png",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
        status: "UPLOADED",
      },
      {
        ...asset({
          assetId: "pending",
          filename: "b.png",
          name: "b_1.png",
          createdAt: "2026-01-02T00:00:00.000Z",
        }),
        status: "UPLOADING",
      },
    ];
    const { client } = makeClient((query) => {
      if (query.table === "Project") {
        return { data: { id: projectId, isDeleted: false }, error: null };
      }
      const status = eqValue(query, "file.status");
      return {
        data: rows
          .filter((row) => status === undefined || row.status === status)
          .map(({ status: _status, ...row }) => row),
        error: null,
      };
    });
    const answer = await listImages(client, organizationId);
    if (answer.ok === false) {
      throw new Error("expected images");
    }
    expect(answer.result.images.map((image) => image.id)).toEqual(["done"]);
  });

  test("keeps at most 100, the newest", async () => {
    const assets = Array.from({ length: 130 }, (_, index) =>
      asset({
        assetId: `asset-${index}`,
        filename: `image-${index}.png`,
        name: `key-${index}.png`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      })
    );
    const { client } = makeFixture({ assets });
    const answer = await listImages(client, organizationId);
    if (answer.ok === false) {
      throw new Error("expected images");
    }
    expect(answer.result.images).toHaveLength(100);
    expect(answer.result.images[0].id).toBe("asset-129");
    expect(answer.result.images[99].id).toBe("asset-30");
  });

  test("a missing or deleted project answers not_found and reads no assets", async () => {
    for (const project of [null, { id: projectId, isDeleted: true }]) {
      const { client, queries } = makeFixture({ project });
      expect(await listImages(client, organizationId)).toEqual({
        ok: false,
        code: "not_found",
      });
      expect(queries.some((query) => query.table === "Asset")).toBe(false);
    }
  });

  test("another org's id never reads this project's assets", async () => {
    const { client, queries } = makeFixture({
      assets: [
        asset({
          assetId: "asset-1",
          filename: "a.png",
          name: "a.png",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      ],
    });
    expect(await listImages(client, "org-2")).toEqual({
      ok: false,
      code: "not_found",
    });
    const projectQuery = queries.find((query) => query.table === "Project");
    expect(projectQuery && eqValue(projectQuery, "id")).toBe(otherProjectId);
  });
});
