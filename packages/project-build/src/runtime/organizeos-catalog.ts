// OrganizeOS fork (docs/ORGANIZEOS-FORK.md section 9, "Catalog Resources
// outlive their bindings"). Provisioning seeds an org's data catalog Resources
// under ids derived as RFC 4122 v5 UUIDs; Webstudio's own ids are nanoids. A
// catalog Resource is shared by every block and page that binds it, so the
// runtime never deletes one with a binding, and resources.delete refuses one.
//
// The catalog is also locked in the builder (the data-automatic plan's D8): a
// change guard, not an id guard. The runtime refuses an operation only when it
// would change a catalog Resource's fields or a catalog `:root` binding, and
// never writes an existing catalog Resource itself (keepOrganizeosCatalog).
// It binds the builder UI, the API and MCP; the patch sync and undo apply raw
// patches, so it is not a security control.
//
// A copy of isPresetId in apps/builder/app/shared/organizeos-preset-ids.ts,
// which this package cannot import; organizeos-preset-ids.node.test.ts pins
// the two to agree.
import deepEqual from "fast-deep-equal";
import {
  ROOT_INSTANCE_ID,
  type DataSource,
  type Resource,
} from "@webstudio-is/sdk";
import type { BuilderPatchChange } from "../contracts/patch";
import { applyBuilderNamespacePatches } from "../state/patch";
import { throwBuilderRuntimeError } from "./errors";

const UUID_V5_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const isOrganizeosCatalogResourceId = (id: string): boolean =>
  UUID_V5_RE.test(id);

/** The one message of every refusal, the runtime's and the panels'. */
export const catalogChangeMessage =
  "Cannot change your organization's data catalog.";

/**
 * A catalog `:root` binding: a resource DataSource at `:root` whose id and
 * resourceId are v5 ids. It also matches the legacy pre-deploy `:root` Forms
 * binding, which the runtime cannot tell apart.
 */
export const isOrganizeosCatalogRootBinding = (dataSource: DataSource) =>
  dataSource.type === "resource" &&
  dataSource.scopeInstanceId === ROOT_INSTANCE_ID &&
  isOrganizeosCatalogResourceId(dataSource.id) &&
  isOrganizeosCatalogResourceId(dataSource.resourceId);

/**
 * The fields a change to a catalog Resource is judged on: with `id` and
 * `name`, the whole Resource schema (a test fails when upstream adds one).
 * The name is not compared: the resource editor writes its variable's name
 * into it, and a pass writes nothing.
 */
export const catalogResourceFields = [
  "method",
  "url",
  "searchParams",
  "headers",
  "body",
  "bodyFormat",
  "control",
  "email",
] as const;

const normalizeCatalogField = (
  resource: Resource,
  field: (typeof catalogResourceFields)[number]
): unknown => {
  // what the HTTP resource editor emits for a Resource provisioning wrote
  // without these fields
  if (field === "searchParams") {
    return resource.searchParams ?? [];
  }
  if (field === "bodyFormat") {
    return resource.bodyFormat ?? "auto";
  }
  return resource[field];
};

/** Whether `next` differs from the stored catalog Resource in a compared field. */
export const isCatalogResourceChange = (stored: Resource, next: Resource) =>
  catalogResourceFields.some(
    (field) =>
      deepEqual(
        normalizeCatalogField(stored, field),
        normalizeCatalogField(next, field)
      ) === false
  );

/**
 * Refuses when a catalog `:root` binding of `before` is missing from `after`,
 * or differs in type, scope, name or resourceId. A binding counts only when
 * `resources` holds its Resource: a foreign one a cross-project paste brought
 * without its Resource stays deletable and renamable.
 */
export const assertCatalogRootBindingsKept = (
  before: undefined | ReadonlyMap<DataSource["id"], DataSource>,
  after: undefined | ReadonlyMap<DataSource["id"], DataSource>,
  resources: undefined | ReadonlyMap<Resource["id"], unknown>
) => {
  for (const [id, dataSource] of before ?? []) {
    if (
      dataSource.type !== "resource" ||
      isOrganizeosCatalogRootBinding(dataSource) === false ||
      resources?.has(dataSource.resourceId) !== true
    ) {
      continue;
    }
    const next = after?.get(id);
    if (
      next?.type !== "resource" ||
      next.scopeInstanceId !== dataSource.scopeInstanceId ||
      next.name !== dataSource.name ||
      next.resourceId !== dataSource.resourceId
    ) {
      throwBuilderRuntimeError("BAD_REQUEST", catalogChangeMessage);
    }
  }
};

const getNamespacePatches = (
  payload: readonly BuilderPatchChange[],
  namespace: BuilderPatchChange["namespace"]
) =>
  payload
    .filter((change) => change.namespace === namespace)
    .flatMap((change) => change.patches);

/**
 * The guard of the runtime's data operations, run on the payload an operation
 * would write. Refuses a payload that changes a catalog Resource's compared
 * fields (isCatalogResourceChange), or deletes one, or changes a catalog
 * `:root` binding (assertCatalogRootBindingsKept). Otherwise returns the
 * payload without its patches to existing catalog Resources, so the runtime
 * never writes one: the stored Resource stays whole, name included. Creating
 * a missing catalog Resource is not a change.
 */
export const keepOrganizeosCatalog = (
  state: {
    dataSources?: ReadonlyMap<DataSource["id"], DataSource>;
    resources?: ReadonlyMap<Resource["id"], Resource>;
  },
  payload: BuilderPatchChange[]
): BuilderPatchChange[] => {
  const resourcePatches = getNamespacePatches(payload, "resources");
  const kept = new Set<Resource["id"]>();
  if (resourcePatches.length > 0 && state.resources !== undefined) {
    const after = applyBuilderNamespacePatches(
      state.resources,
      resourcePatches
    );
    for (const [id, stored] of state.resources) {
      if (isOrganizeosCatalogResourceId(id) === false) {
        continue;
      }
      const next = after.get(id);
      if (next === stored) {
        continue;
      }
      if (next === undefined || isCatalogResourceChange(stored, next)) {
        throwBuilderRuntimeError("BAD_REQUEST", catalogChangeMessage);
      }
      kept.add(id);
    }
  }
  const dataSourcePatches = getNamespacePatches(payload, "dataSources");
  if (dataSourcePatches.length > 0 && state.dataSources !== undefined) {
    assertCatalogRootBindingsKept(
      state.dataSources,
      applyBuilderNamespacePatches(state.dataSources, dataSourcePatches),
      state.resources
    );
  }
  if (kept.size === 0) {
    return payload;
  }
  return payload.flatMap((change) => {
    if (change.namespace !== "resources") {
      return [change];
    }
    const patches = change.patches.filter(
      (patch) => kept.has(String(patch.path[0])) === false
    );
    return patches.length === 0 ? [] : [{ ...change, patches }];
  });
};
