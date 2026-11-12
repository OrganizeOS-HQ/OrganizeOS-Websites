import { describe, expect, test } from "vitest";
import { enableMapSet } from "immer";
import { createDefaultPages } from "@webstudio-is/project-build";
import type { Resource, WebstudioData } from "@webstudio-is/sdk";
import { findCatalogResources } from "~/shared/organizeos-preset-ids";
import {
  buildCollectionResourcePresets,
  buildOrgResourcePresets,
} from "~/shared/db/resource-presets.server";
import type { CollectionSchema } from "./collection-schema";
import {
  addCollectionToSitemapMutable,
  createItemPageMutable,
} from "./collection-pages";
import {
  getCollectionSlug,
  joinCatalog,
  joinCmsCatalog,
} from "./collection-catalog";
import organizeosPanelSource from "./organizeos-panel.tsx?raw";

enableMapSet();

const projectId = "project-1";
const apiBase = "https://app.example.org/api/public/v1";
const authorization = `"Bearer osk_token"`;
const { resources: orgCatalog } = await buildOrgResourcePresets({
  projectId,
  apiBaseUrl: apiBase,
  readToken: "osk_token",
});
const { resources: newsAndEvents } = await buildCollectionResourcePresets({
  projectId,
  apiBase,
  authHeaderExpression: authorization,
  collections: [
    { slug: "news", name: "News" },
    { slug: "events", name: "Events" },
  ],
});

const schemaOf = (slug: string, name: string): CollectionSchema => ({
  slug,
  name,
  singularName: name,
  fields: [{ key: "title", label: "Title", kind: "text", isTitle: true }],
});

/**
 * A build with the org's catalog and the news and events collections; an
 * item page for news; an item page named "Old template" whose collection no
 * catalog Resource has; and a sitemap listing news, events and gone.
 */
const buildData = () => {
  const pages = createDefaultPages({ rootInstanceId: "bodyId" });
  const data: WebstudioData = {
    pages,
    assets: new Map(),
    dataSources: new Map(),
    resources: new Map(
      [...orgCatalog, ...newsAndEvents].map((resource) => [
        resource.id,
        resource,
      ])
    ),
    instances: new Map([
      [
        "bodyId",
        {
          type: "instance",
          id: "bodyId",
          component: "ws:element",
          tag: "body",
          children: [],
        },
      ],
    ]),
    props: new Map(),
    breakpoints: new Map([["base", { id: "base", label: "Base" }]]),
    styleSourceSelections: new Map(),
    styleSources: new Map(),
    styles: new Map(),
  };
  const catalog = { apiBase, authorization };
  createItemPageMutable(data, {
    pageId: "newsPage",
    schema: schemaOf("news", "News"),
    catalog,
  });
  createItemPageMutable(data, {
    pageId: "oldPage",
    schema: schemaOf("old", "Old"),
    catalog,
  });
  for (const [slug, name] of [
    ["news", "News"],
    ["events", "Events"],
    ["gone", "Gone"],
  ]) {
    addCollectionToSitemapMutable(data, {
      schema: { slug, name },
      catalog,
    });
  }
  return data;
};

const loadCatalog = (data: WebstudioData) =>
  findCatalogResources(projectId, data.resources.values());

const resourceNamed = (name: string) =>
  newsAndEvents.find((resource) => resource.name === name) as Resource;

describe("joinCatalog", () => {
  test("joinCatalog: the tab's join", async () => {
    const data = buildData();
    const catalog = await loadCatalog(data);
    // the org's presets are in the catalog, products among them
    expect(catalog.some(({ key }) => key === "products")).toBe(true);
    const join = joinCatalog(catalog, data);
    expect([...join.catalogSlugs].sort()).toEqual(["events", "news"]);
    // News's own item page reads a slug the catalog has: not stale
    expect(join.isStaleFor(resourceNamed("News"))).toBe(false);
    // a Resource named for the stale page's template is
    expect(join.isStaleFor({ ...resourceNamed("News"), name: "Old" })).toBe(
      true
    );
    expect(join.unmatchedStalePages.map(({ page }) => page.name)).toEqual([
      "Old template",
    ]);
    expect(join.unmatchedStalePages.map(({ slug }) => slug)).toEqual(["old"]);
    // news has an item page
    expect(join.sitemapOrphans).toEqual(["events", "gone"]);
  });

  test("getCollectionSlug reads a collection entry's slug, and nothing for the org's presets", async () => {
    const catalog = await loadCatalog(buildData());
    expect(catalog.map(getCollectionSlug).filter(Boolean)).toEqual([
      "news",
      "events",
    ]);
    expect(
      getCollectionSlug(catalog.find(({ key }) => key === "products")!)
    ).toBeUndefined();
  });
});

describe("joinCmsCatalog", () => {
  test("joinCmsCatalog: a row per platform slug with a catalog collection, never products", async () => {
    const data = buildData();
    const catalog = await loadCatalog(data);
    const { rows } = joinCmsCatalog(["news", "members"], catalog, data);
    expect([...rows.keys()]).toEqual(["news"]);
    const news = rows.get("news");
    expect(news?.entry.resource).toEqual(resourceNamed("News"));
    expect(news?.itemPage?.id).toEqual("newsPage");
    expect(news?.isStale).toBe(false);
    expect(news?.isSitemapOrphan).toBe(false);
    expect(rows.has("products")).toBe(false);
    // a platform slug that only a non-collection entry would match gets no row
    const withProducts = joinCmsCatalog(
      ["news", "members", "products", "events"],
      catalog,
      data
    );
    expect([...withProducts.rows.keys()]).toEqual(["news", "events"]);
  });

  test("joinCmsCatalog: the orphans, in order", async () => {
    const data = buildData();
    const catalog = await loadCatalog(data);
    const { orphans } = joinCmsCatalog(["news", "members"], catalog, data);
    expect(orphans).toEqual([
      { kind: "stale_page", key: "oldPage", name: "Old template" },
      { kind: "sitemap", key: "sitemap:gone", slug: "gone" },
      {
        kind: "no_collection",
        key: resourceNamed("Events").id,
        name: "Events",
        isStale: false,
      },
    ]);
  });

  test("a sitemap orphan with a catalog row is the row's flag, not an orphan", async () => {
    const data = buildData();
    const catalog = await loadCatalog(data);
    const { rows, orphans } = joinCmsCatalog(["news", "events"], catalog, data);
    expect(rows.get("events")?.isSitemapOrphan).toBe(true);
    expect(rows.get("events")?.itemPage).toBeUndefined();
    expect(
      orphans.some(
        (orphan) => orphan.kind === "sitemap" && orphan.slug === "events"
      )
    ).toBe(false);
    expect(orphans.map(({ key }) => key)).toEqual(["oldPage", "sitemap:gone"]);
  });

  test("a row is stale when a stale page carries its Resource's template name", async () => {
    const data = buildData();
    // the news collection now answers at "fresh", under the same name
    const { resources: renamed } = await buildCollectionResourcePresets({
      projectId,
      apiBase,
      authHeaderExpression: authorization,
      collections: [{ slug: "fresh", name: "News" }],
    });
    data.resources.delete(resourceNamed("News").id);
    for (const resource of renamed) {
      data.resources.set(resource.id, resource);
    }
    const catalog = await loadCatalog(data);
    const { rows, orphans } = joinCmsCatalog(["fresh"], catalog, data);
    expect(rows.get("fresh")?.isStale).toBe(true);
    // News template is the row's line, not an orphan of its own
    expect(
      orphans.flatMap((orphan) =>
        orphan.kind === "stale_page" ? [orphan.name] : []
      )
    ).toEqual(["Old template"]);
  });

  test("a catalog collection with no platform row keeps its stale line", async () => {
    const data = buildData();
    // the news collection now answers at "fresh", which the platform lacks
    const { resources: renamed } = await buildCollectionResourcePresets({
      projectId,
      apiBase,
      authHeaderExpression: authorization,
      collections: [{ slug: "fresh", name: "News" }],
    });
    data.resources.delete(resourceNamed("News").id);
    for (const resource of renamed) {
      data.resources.set(resource.id, resource);
    }
    const catalog = await loadCatalog(data);
    const { orphans } = joinCmsCatalog([], catalog, data);
    expect(
      orphans.flatMap((orphan) =>
        orphan.kind === "no_collection" ? [[orphan.name, orphan.isStale]] : []
      )
    ).toEqual([
      ["Events", false],
      ["News", true],
    ]);
  });
});

describe("the move", () => {
  test("organizeos-panel.tsx imports the helpers from collection-catalog.ts and defines none of them", () => {
    const imports =
      /import\s*\{([^}]*)\}\s*from\s*"\.\/collection-catalog"/.exec(
        organizeosPanelSource
      );
    expect(imports).not.toBeNull();
    const names = imports![1].split(",").map((name) => name.trim());
    for (const name of ["useCatalog", "getCollectionSlug", "joinCatalog"]) {
      expect(names, name).toContain(name);
      expect(organizeosPanelSource, name).not.toMatch(
        new RegExp(`(const|function|let)\\s+${name}\\b`)
      );
    }
  });
});
