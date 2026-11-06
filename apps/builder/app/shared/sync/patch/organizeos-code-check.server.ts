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
 * failing value alone applies (prebuild and the canvas cover saved data). An
 * entry whose patch does not apply to the build is refused. The build is
 * checked at the version the client writes, which the write itself matches,
 * so the check sees the data the write changes. Nothing here writes to the
 * database.
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
import { parseData, parsePages } from "@webstudio-is/project-build/persistence";
import {
  checkInstance,
  checkPage,
  checkProp,
  checkResource,
  pagesToCheck,
} from "@organizeos/site-components/org-script";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import { singlePlayerVersionMismatchResult } from "@webstudio-is/project/build-patch-core.server";
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

const columns =
  "version, lastTransactionId, pages, instances, props, resources, dataSources";

/** The reason an entry whose patch does not apply is refused for. */
export const unappliedPatchReason = "This change cannot be applied";

type CheckedData = {
  pages: Pages;
  instances: Map<Instance["id"], Instance>;
  props: Map<Prop["id"], Prop>;
  resources: Map<Resource["id"], Resource>;
  dataSources: Map<DataSource["id"], DataSource>;
};

type Namespace = keyof CheckedData;

type Change = { namespace: string; patches: Patch[] };

/** What the check reads of an entry: its transaction's changes. */
type CheckedEntry = {
  transaction: Pick<PatchEntry["transaction"], "id" | "payload">;
};

const changesOf = (entry: CheckedEntry) =>
  (entry.transaction.payload as Change[]).filter(
    (change) =>
      checkedNamespaces.has(change.namespace) && change.patches.length > 0
  );

/** Whether any entry writes to a namespace whose values are checked. */
export const writesCheckedValues = (entries: CheckedEntry[]) =>
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

/**
 * A record namespace as a map by id: a namespace replaced whole may hold a
 * map, an array of records or an array of [id, record] entries.
 */
const recordsOf = (value: unknown): Map<string, unknown> => {
  if (value instanceof Map) {
    return value;
  }
  if (Array.isArray(value)) {
    return new Map(
      value.map((item) =>
        Array.isArray(item)
          ? [String(item[0]), item[1]]
          : [String((item as { id: unknown }).id), item]
      )
    );
  }
  throw new Error("Not a record namespace");
};

const reasonOf = (key: string) => key.slice(key.lastIndexOf(":") + 1);

/**
 * The entries to refuse, each with the reason, applying the others in order.
 * `build` holds the columns as the database stores them.
 */
export const findRefusedEntries = <Entry extends CheckedEntry>(
  build: Record<"pages" | Exclude<Namespace, "pages">, string | null>,
  entries: Entry[]
): Map<Entry, string> => {
  const refused = new Map<Entry, string>();
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
    const replacedWhole = new Set<Namespace>();
    let next: CheckedData = data;
    try {
      for (const change of changes) {
        const namespace = change.namespace as Namespace;
        const keys = touched.get(namespace) ?? new Set<string>();
        for (const patch of change.patches) {
          if (patch.path.length > 0) {
            keys.add(String(patch.path[0]));
          } else {
            replacedWhole.add(namespace);
          }
        }
        touched.set(namespace, keys);
        const patched = applyPatches(next[namespace], change.patches);
        next = {
          ...next,
          [namespace]: namespace === "pages" ? patched : recordsOf(patched),
        };
      }
    } catch {
      refused.set(entry, unappliedPatchReason);
      continue;
    }
    // a namespace replaced whole touches every record before and after
    for (const namespace of replacedWhole) {
      if (namespace !== "pages") {
        touched.set(
          namespace,
          new Set([...data[namespace].keys(), ...next[namespace].keys()])
        );
      }
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

type CheckResult<Entry> =
  | typeof singlePlayerVersionMismatchResult
  | { status: "checked"; refused: Map<Entry, string> };

/**
 * Loads what findRefusedEntries reads, only when an entry writes it. A build
 * whose version is not the client's answers the version conflict a stale
 * client gets from the write, so the client reloads, except for the retry of
 * a request already saved (a client behind the build whose last transaction
 * is the build's last): that write changes nothing, as in patchLoadedBuild.
 */
export const findRefusedPatchEntries = async <Entry extends CheckedEntry>(
  context: AppContext,
  buildId: string,
  clientVersion: number,
  entries: Entry[]
): Promise<CheckResult<Entry>> => {
  if (writesCheckedValues(entries) === false) {
    return { status: "checked", refused: new Map() };
  }
  const build = await context.postgrest.client
    .from("Build")
    .select(columns)
    .eq("id", buildId)
    .single();
  if (build.error) {
    throw build.error;
  }
  const data = build.data as unknown as {
    version: number;
    lastTransactionId: string | null;
  } & Parameters<typeof findRefusedEntries>[0];
  if (data.version !== clientVersion) {
    const lastTransactionId = entries.at(-1)?.transaction.id;
    const savedRetry =
      clientVersion < data.version &&
      lastTransactionId !== undefined &&
      lastTransactionId === data.lastTransactionId;
    return savedRetry
      ? { status: "checked", refused: new Map() }
      : singlePlayerVersionMismatchResult;
  }
  return { status: "checked", refused: findRefusedEntries(data, entries) };
};

/**
 * Checks a set of transactions written together, in order: every build write
 * that is not a patch request (the API's build patch, the runtime operations
 * and restoring a restore point) commits only when the check passes.
 */
export const checkBuildTransactions = async (
  context: AppContext,
  buildId: string,
  clientVersion: number,
  transactions: Array<CheckedEntry["transaction"]>
): Promise<
  typeof singlePlayerVersionMismatchResult | { status: "passed" | "refused" }
> => {
  const result = await findRefusedPatchEntries(
    context,
    buildId,
    clientVersion,
    transactions.map((transaction) => ({ transaction }))
  );
  if (result.status === "version_mismatched") {
    return result;
  }
  return { status: result.refused.size === 0 ? "passed" : "refused" };
};
