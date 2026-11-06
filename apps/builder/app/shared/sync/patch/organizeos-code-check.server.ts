/**
 * OrganizeOS fork: patch save refuses an entry that writes a value failing
 * input validation for expressions and generated names (code-check.ts in
 * @organizeos/site-components). The builder's editors run the same check
 * first, so an honest editor never reaches this; it is the backstop for a
 * client that skips them.
 *
 * Each entry's changes are applied, in request order, to a copy of the build's
 * pages, instances, props, resources and data sources, and the records it
 * touches are checked before and after. An entry is refused only when a record
 * fails after it in a way it did not before, so an entry that leaves a saved
 * failing value alone applies (prebuild and the canvas cover saved data).
 * Nothing here writes to the database.
 */
import { applyPatches, enableMapSet, enablePatches, type Patch } from "immer";
import type {
  DataSource,
  Instance,
  Pages,
  Prop,
  Resource,
} from "@webstudio-is/sdk";
import { SYSTEM_VARIABLE_ID } from "@webstudio-is/sdk";
import { parseData, parsePages } from "@webstudio-is/project-build";
import {
  checkInstance,
  checkPage,
  checkProp,
  checkResource,
  pagesToCheck,
} from "@organizeos/site-components/org-script";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import type { PatchEntry } from "./patch-normalize.server";

enableMapSet();
enablePatches();

const checkedNamespaces = new Set([
  "pages",
  "instances",
  "props",
  "resources",
  "dataSources",
]);

const columns = "pages, instances, props, resources, dataSources";

type CheckedData = {
  pages: Pages;
  instances: Map<Instance["id"], Instance>;
  props: Map<Prop["id"], Prop>;
  resources: Map<Resource["id"], Resource>;
  dataSources: Map<DataSource["id"], DataSource>;
};

type Namespace = keyof CheckedData;

type Change = { namespace: string; patches: Patch[] };

const changesOf = (entry: PatchEntry) =>
  (entry.transaction.payload as Change[]).filter(
    (change) =>
      checkedNamespaces.has(change.namespace) && change.patches.length > 0
  );

/** Whether any entry writes to a namespace whose values are checked. */
export const writesCheckedValues = (entries: PatchEntry[]) =>
  entries.some((entry) => changesOf(entry).length > 0);

/** The failures of the records touched, each as a stable key. */
const failuresOf = (
  data: CheckedData,
  touched: Map<Namespace, Set<string>>
): Set<string> => {
  const failures = new Set<string>();
  const dataSourceIds = new Set([
    SYSTEM_VARIABLE_ID,
    ...data.dataSources.keys(),
  ]);
  if (touched.has("pages")) {
    for (const page of pagesToCheck(data.pages)) {
      const failure = checkPage(page);
      if (failure) {
        failures.add(`page:${page.id}:${failure.field}:${failure.reason}`);
      }
    }
  }
  for (const id of touched.get("instances") ?? []) {
    const instance = data.instances.get(id);
    const failure = instance && checkInstance(instance);
    if (failure) {
      failures.add(`instance:${id}:${failure.field}:${failure.reason}`);
    }
  }
  // a changed data source can change which actions name a known variable
  const propIds = touched.has("dataSources")
    ? data.props.keys()
    : (touched.get("props") ?? []);
  for (const id of propIds) {
    const prop = data.props.get(id);
    const result = prop && checkProp(prop, { dataSourceIds });
    if (result && result.ok === false) {
      failures.add(`prop:${id}:${result.reason}`);
    }
  }
  for (const id of touched.get("resources") ?? []) {
    const resource = data.resources.get(id);
    const failure = resource && checkResource(resource);
    if (failure) {
      failures.add(`resource:${id}:${failure.field}:${failure.reason}`);
    }
  }
  return failures;
};

const reasonOf = (key: string) => key.slice(key.lastIndexOf(":") + 1);

/**
 * The entries to refuse, each with the reason, applying the others in order.
 * `build` holds the columns as the database stores them.
 */
export const findRefusedEntries = (
  build: Record<"pages" | Exclude<Namespace, "pages">, string | null>,
  entries: PatchEntry[]
): Map<PatchEntry, string> => {
  const refused = new Map<PatchEntry, string>();
  let data: CheckedData = {
    pages: parsePages(build.pages ?? ""),
    instances: parseData<Instance>(build.instances ?? "[]"),
    props: parseData<Prop>(build.props ?? "[]"),
    resources: parseData<Resource>(build.resources ?? "[]"),
    dataSources: parseData<DataSource>(build.dataSources ?? "[]"),
  };
  for (const entry of entries) {
    const changes = changesOf(entry);
    if (changes.length === 0) {
      continue;
    }
    const touched = new Map<Namespace, Set<string>>();
    let next: CheckedData = data;
    try {
      for (const { namespace, patches } of changes) {
        const keys = touched.get(namespace as Namespace) ?? new Set<string>();
        for (const patch of patches) {
          if (patch.path.length > 0) {
            keys.add(String(patch.path[0]));
          }
        }
        touched.set(namespace as Namespace, keys);
        next = {
          ...next,
          [namespace]: applyPatches(next[namespace as Namespace], patches),
        };
      }
    } catch {
      // a patch that does not apply fails where upstream applies it
      continue;
    }
    const before = failuresOf(data, touched);
    const added = [...failuresOf(next, touched)].find(
      (key) => before.has(key) === false
    );
    if (added !== undefined) {
      refused.set(entry, reasonOf(added));
      continue;
    }
    data = next;
  }
  return refused;
};

/** Loads what findRefusedEntries reads, only when an entry writes it. */
export const findRefusedPatchEntries = async (
  context: AppContext,
  buildId: string,
  entries: PatchEntry[]
): Promise<Map<PatchEntry, string>> => {
  if (writesCheckedValues(entries) === false) {
    return new Map();
  }
  const build = await context.postgrest.client
    .from("Build")
    .select(columns)
    .eq("id", buildId)
    .single();
  if (build.error) {
    throw build.error;
  }
  return findRefusedEntries(
    build.data as unknown as Parameters<typeof findRefusedEntries>[0],
    entries
  );
};
