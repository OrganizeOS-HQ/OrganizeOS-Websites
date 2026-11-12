import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import type { Page, Resource, WebstudioData } from "@webstudio-is/sdk";
import {
  type CatalogEntry,
  findCatalogResources,
  getCollectionPresetKey,
  parseCollectionUrl,
} from "~/shared/organizeos-preset-ids";
import { $project, $resources } from "~/shared/sync/data-stores";
import { findStaleItemPages } from "./organizeos-data";
import {
  findCollectionItemPage,
  listSitemapCollections,
} from "./collection-pages";

/**
 * The org's catalog in a build and its join with the build's pages, shared by
 * the OrganizeOS data tab and the CMS column.
 */

/**
 * The project's catalog, found by its deterministic ids, which take a hash to
 * derive, so it is refreshed asynchronously whenever the resources change.
 * Undefined until it first resolves, and with no project.
 */
export const useCatalog = () => {
  const project = useStore($project);
  const resources = useStore($resources);
  const [catalog, setCatalog] = useState<CatalogEntry[]>();
  useEffect(() => {
    if (project === undefined) {
      setCatalog(undefined);
      return;
    }
    let isCurrent = true;
    findCatalogResources(project.id, resources.values()).then(
      (entries) => {
        if (isCurrent) {
          setCatalog(entries);
        }
      },
      (error) => console.error(error)
    );
    return () => {
      isCurrent = false;
    };
  }, [project, resources]);
  return catalog;
};

/** A catalog entry's collection slug, when it is a collection's Resource. */
export const getCollectionSlug = ({ key, resource }: CatalogEntry) => {
  const slug = parseCollectionUrl(resource.url)?.slug;
  return slug !== undefined && key === getCollectionPresetKey(slug)
    ? slug
    : undefined;
};

export type CatalogData = Pick<
  WebstudioData,
  "pages" | "instances" | "props" | "dataSources" | "resources"
>;

export type CatalogJoin = {
  /** The collection entries' slugs; never the org's other presets. */
  catalogSlugs: ReadonlySet<string>;
  /** A stale item page carries this Resource's template name. */
  isStaleFor: (resource: Resource) => boolean;
  /** Stale item pages whose template name no catalog entry has. */
  unmatchedStalePages: Array<{ page: Page; slug: string }>;
  /** Collections the generated sitemap lists that have no item page. */
  sitemapOrphans: string[];
};

export const joinCatalog = (
  catalog: readonly CatalogEntry[],
  data: CatalogData
): CatalogJoin => {
  const catalogSlugs = new Set(
    catalog.flatMap((entry) => getCollectionSlug(entry) ?? [])
  );
  // an item page left at an old address shows on the row of its collection's
  // new address, found by the name Create item page gave the page, or on a
  // row of its own
  const stalePages = findStaleItemPages(data, catalogSlugs);
  const isStaleFor = (resource: Resource) =>
    stalePages.some(({ page }) => page.name === `${resource.name} template`);
  const unmatchedStalePages = stalePages.filter(
    ({ page }) =>
      catalog.some(
        ({ resource }) => page.name === `${resource.name} template`
      ) === false
  );
  const sitemapOrphans = listSitemapCollections(data).filter(
    (slug) => findCollectionItemPage(slug, data.pages) === undefined
  );
  return { catalogSlugs, isStaleFor, unmatchedStalePages, sitemapOrphans };
};

export type CmsCatalogRow = {
  entry: CatalogEntry;
  itemPage: Page | undefined;
  isStale: boolean;
  isSitemapOrphan: boolean;
};

export type CmsCatalogOrphan =
  | { kind: "stale_page"; key: string; name: string }
  | { kind: "sitemap"; key: string; slug: string }
  | { kind: "no_collection"; key: string; name: string; isStale: boolean };

/**
 * The CMS column's join: a row for each platform collection whose catalog
 * Resource exists, matched by slug, and the orphans for the column's foot:
 * stale item pages, then sitemap orphans outside the catalog, then catalog
 * collections with no platform row.
 */
export const joinCmsCatalog = (
  collectionSlugs: readonly string[],
  catalog: readonly CatalogEntry[],
  data: CatalogData
): {
  rows: ReadonlyMap<string, CmsCatalogRow>;
  orphans: CmsCatalogOrphan[];
} => {
  const join = joinCatalog(catalog, data);
  const entriesBySlug = new Map<string, CatalogEntry>();
  for (const entry of catalog) {
    const slug = getCollectionSlug(entry);
    if (slug !== undefined && entriesBySlug.has(slug) === false) {
      entriesBySlug.set(slug, entry);
    }
  }
  const rows = new Map<string, CmsCatalogRow>();
  for (const slug of collectionSlugs) {
    const entry = entriesBySlug.get(slug);
    if (entry === undefined || rows.has(slug)) {
      continue;
    }
    rows.set(slug, {
      entry,
      itemPage: findCollectionItemPage(slug, data.pages),
      isStale: join.isStaleFor(entry.resource),
      isSitemapOrphan: join.sitemapOrphans.includes(slug),
    });
  }
  const orphans: CmsCatalogOrphan[] = [
    ...join.unmatchedStalePages.map(
      ({ page }): CmsCatalogOrphan => ({
        kind: "stale_page",
        key: page.id,
        name: page.name,
      })
    ),
    ...join.sitemapOrphans
      .filter((slug) => join.catalogSlugs.has(slug) === false)
      .map(
        (slug): CmsCatalogOrphan => ({
          kind: "sitemap",
          key: `sitemap:${slug}`,
          slug,
        })
      ),
    ...[...entriesBySlug]
      .filter(([slug]) => rows.has(slug) === false)
      .map(
        ([, { resource }]): CmsCatalogOrphan => ({
          kind: "no_collection",
          key: resource.id,
          name: resource.name,
          // its stale item page is no orphan of its own: the line is here
          isStale: join.isStaleFor(resource),
        })
      ),
  ];
  return { rows, orphans };
};
