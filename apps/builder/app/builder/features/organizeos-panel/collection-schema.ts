import type { Resource, ResourceRequest } from "@webstudio-is/sdk";
import { fetch } from "~/shared/fetch.client";
import {
  findCatalogResources,
  getCollectionPresetKey,
  parseCollectionUrl,
} from "~/shared/organizeos-preset-ids";
import { getResourceKey } from "~/shared/resources";
import { restResourcesLoader } from "~/shared/router-utils";
import { $project, $resources } from "~/shared/sync/data-stores";
import type { CollectionField } from "./collection-layout";

/**
 * The live reads the CMS page generators make when the person clicks
 * (OrganizeOS design `2026-10-27-cms-page-templates-design.md` sections 3.1
 * and 3.6). The builder stores no field schema, so it is read from
 * `GET {base}/collections` with the collection catalog Resource's
 * `Authorization`, as every canvas fetch sends it.
 *
 * The builder's resources queue (`loadResources` in `shared/resources.ts`) is
 * module-private and drains itself, so these reads post one request each to
 * the same loader, `/rest/resources-loader`, through `fetch.client`, which
 * adds the CSRF and api-client headers the loader checks.
 */

/** A collection's catalog Resource, with the parts its generators copy. */
export type CollectionCatalog = {
  resource: Resource;
  /** The API base, `https://…/api/public/v1`, from the Resource's url. */
  apiBase: string;
  /** The `Authorization` header's value expression, copied exactly. */
  authorization: string;
};

/**
 * The catalog Resource of the public collection `slug` in the open project,
 * found by its deterministic id (`findCatalogResources`), or undefined.
 */
export const findCollectionCatalog = async (
  slug: string
): Promise<undefined | CollectionCatalog> => {
  const project = $project.get();
  if (project === undefined) {
    return;
  }
  const key = getCollectionPresetKey(slug);
  const catalog = await findCatalogResources(
    project.id,
    $resources.get().values()
  );
  const resource = catalog.find((entry) => entry.key === key)?.resource;
  if (resource === undefined) {
    return;
  }
  const collection = parseCollectionUrl(resource.url);
  const authorization = resource.headers.find(
    (header) => header.name.toLowerCase() === "authorization"
  )?.value;
  if (collection === undefined || authorization === undefined) {
    return;
  }
  return { resource, apiBase: collection.apiBase, authorization };
};

/** The evaluated value of a literal header expression, or undefined. */
const evaluateLiteral = (expression: string) => {
  try {
    const value: unknown = JSON.parse(expression);
    return typeof value === "string" ? value : undefined;
  } catch {
    return;
  }
};

/** What the resources loader answers for one request. */
type LoadedResource = {
  ok: boolean;
  status?: number;
  data: unknown;
};

/**
 * One GET with the catalog's `Authorization`, through the builder's
 * resources loader. Undefined when the read fails in any way.
 */
export const loadCatalogRequest = async (
  catalog: CollectionCatalog,
  {
    url,
    searchParams = [],
  }: { url: string; searchParams?: ResourceRequest["searchParams"] }
): Promise<undefined | LoadedResource> => {
  const authorization = evaluateLiteral(catalog.authorization);
  if (authorization === undefined) {
    return;
  }
  const request: ResourceRequest = {
    name: catalog.resource.name,
    method: "get",
    url,
    searchParams,
    headers: [{ name: "Authorization", value: authorization }],
  };
  try {
    const response = await fetch(restResourcesLoader(), {
      method: "POST",
      body: JSON.stringify([request]),
    });
    if (response.ok === false) {
      return;
    }
    const results = new Map<string, unknown>(await response.json());
    const result = results.get(getResourceKey(request));
    if (
      typeof result !== "object" ||
      result === null ||
      typeof (result as LoadedResource).ok !== "boolean"
    ) {
      return;
    }
    return result as LoadedResource;
  } catch {
    return;
  }
};

/** The list inside a `/v1` answer, `{ data: [...] }`, or undefined. */
const readList = (
  loaded: undefined | LoadedResource
): undefined | unknown[] => {
  if (loaded?.ok !== true) {
    return;
  }
  const body = loaded.data as undefined | { data?: unknown };
  const list =
    typeof body === "object" && body !== null ? body.data : undefined;
  return Array.isArray(list) ? list : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

// The platform's rule for a field key (`^[a-zA-Z][a-zA-Z0-9]*$`). The
// generators write keys into expressions as member names, so a key outside it
// is dropped rather than trusted.
const FIELD_KEY_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;

const readField = (value: unknown): undefined | CollectionField => {
  if (
    isRecord(value) === false ||
    typeof value.key !== "string" ||
    FIELD_KEY_RE.test(value.key) === false ||
    typeof value.label !== "string" ||
    typeof value.kind !== "string"
  ) {
    return;
  }
  const field: CollectionField = {
    key: value.key,
    label: value.label,
    kind: value.kind,
  };
  if (value.isTitle === true) {
    field.isTitle = true;
  }
  if (value.required === true) {
    field.required = true;
  }
  if (Array.isArray(value.options)) {
    field.options = value.options.flatMap((option) =>
      isRecord(option) &&
      typeof option.value === "string" &&
      typeof option.label === "string"
        ? [{ value: option.value, label: option.label }]
        : []
    );
  }
  if (
    isRecord(value.reference) &&
    typeof value.reference.collectionSlug === "string"
  ) {
    field.reference = {
      collectionSlug: value.reference.collectionSlug,
      multiple: value.reference.multiple === true,
    };
  }
  return field;
};

export type CollectionSchema = {
  slug: string;
  name: string;
  singularName: string;
  fields: CollectionField[];
};

/** The one error every failed read shows. */
export const loadCollectionError = "Could not load the collection";

/**
 * The public schema of the collection `slug`: `GET {base}/collections`, the
 * entry whose slug it is. `{ error }` when the project has no catalog
 * Resource for it, the read fails, or the answer does not list it.
 */
export const loadCollectionSchema = async (
  slug: string
): Promise<CollectionSchema | { error: string }> => {
  const catalog = await findCollectionCatalog(slug);
  if (catalog === undefined) {
    return { error: loadCollectionError };
  }
  const list = readList(
    await loadCatalogRequest(catalog, {
      url: `${catalog.apiBase}/collections`,
    })
  );
  const entry = list?.find(
    (collection) => isRecord(collection) && collection.slug === slug
  );
  if (
    isRecord(entry) === false ||
    typeof entry.name !== "string" ||
    typeof entry.singularName !== "string" ||
    Array.isArray(entry.fields) === false
  ) {
    return { error: loadCollectionError };
  }
  return {
    slug,
    name: entry.name,
    singularName: entry.singularName,
    fields: entry.fields.flatMap((field) => readField(field) ?? []),
  };
};

/**
 * The slug of the collection's first item, from
 * `GET {base}/collections/{slug}/items?limit=1&fields=slug`, a canvas fetch
 * that the loader preview-signs, so a draft counts. Undefined with no items
 * or a failed read.
 */
export const loadFirstItemSlug = async (
  catalog: CollectionCatalog,
  slug: string
): Promise<undefined | string> => {
  const list = readList(
    await loadCatalogRequest(catalog, {
      url: `${catalog.apiBase}/collections/${encodeURIComponent(slug)}/items`,
      searchParams: [
        { name: "limit", value: "1" },
        { name: "fields", value: "slug" },
      ],
    })
  );
  const first = list?.[0];
  return isRecord(first) && typeof first.slug === "string" && first.slug !== ""
    ? first.slug
    : undefined;
};
