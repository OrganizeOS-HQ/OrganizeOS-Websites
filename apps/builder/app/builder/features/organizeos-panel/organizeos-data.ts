import { type Page, type WebstudioData, getAllPages } from "@webstudio-is/sdk";

/**
 * The item-page helpers: which pages read a collection's item, and which of
 * them name a collection address the catalog no longer has. The CMS column's
 * catalog join reads them (collection-catalog.ts).
 */

/**
 * The collection an item page's Resource reads, from its url expression,
 * `"{base}/collections/{slug}/items/" + (...)` (collection-pages.ts): the
 * slug in its first string literal, when that literal ends in
 * `/collections/{slug}/items/`. Undefined for any other url, among them a
 * list block's, whose literal ends in `/items` with no slash
 * (`parseCollectionUrl` reads only that literal form).
 */
export const parseItemResourceSlug = (url: string): undefined | string => {
  const literal = /"(?:[^"\\]|\\.)*"/.exec(url)?.[0];
  if (literal === undefined) {
    return;
  }
  let value: unknown;
  try {
    value = JSON.parse(literal);
  } catch {
    return;
  }
  if (typeof value !== "string") {
    return;
  }
  const match = /\/collections\/([^/]+)\/items\/$/.exec(value);
  if (match === null) {
    return;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return;
  }
};

type PagesData = Pick<WebstudioData, "pages" | "dataSources" | "resources">;

/**
 * The pages whose own Resource, a binding scoped to the page's root, reads a
 * collection's item: each with the collection slug that Resource names.
 */
export const findItemResourcePages = (
  data: PagesData
): Array<{ page: Page; slug: string }> => {
  const pages = getAllPages(data.pages);
  const found: Array<{ page: Page; slug: string }> = [];
  for (const page of pages) {
    for (const dataSource of data.dataSources.values()) {
      if (
        dataSource.type !== "resource" ||
        dataSource.scopeInstanceId !== page.rootInstanceId
      ) {
        continue;
      }
      const resource = data.resources.get(dataSource.resourceId);
      const slug =
        resource === undefined
          ? undefined
          : parseItemResourceSlug(resource.url);
      if (slug !== undefined) {
        found.push({ page, slug });
        break;
      }
    }
  }
  return found;
};

/**
 * The item pages whose Resource names a collection slug no catalog Resource
 * has: what a renamed collection address leaves behind (design 2.1, Q7).
 */
export const findStaleItemPages = (
  data: PagesData,
  catalogSlugs: ReadonlySet<string>
) =>
  findItemResourcePages(data).filter(
    ({ slug }) => catalogSlugs.has(slug) === false
  );
