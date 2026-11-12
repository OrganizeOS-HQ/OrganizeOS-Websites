// OrganizeOS fork: the Variables registry (docs/ORGANIZEOS-FORK.md section 7).
import { z } from "zod";

/**
 * The registry of the builder's Variables manager, stored at
 * `projectSettings.organizeos.variables` (spec 4.2). Values live in Global
 * Root's `--css-name` declarations; the registry only describes them:
 * collections, types, display names and order.
 *
 * The schema never transforms what it reads: no defaults, no filters, no
 * deduplication. Registry writes are index-based patches applied to the
 * stored JSON, so a parse-time transform would make a client's indexes hit
 * the wrong stored rows. Every object keeps keys it does not know, so a later
 * part's keys (modes, brand links) survive a builder that predates them.
 */

export const variableTypes = [
  "color",
  "size",
  "percentage",
  "number",
  "fontFamily",
] as const;

export type VariableType = (typeof variableTypes)[number];

export const BRAND_COLLECTION_ID = "brand";

export const SITE_COLLECTION_ID = "site";

export const registryCollection = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  system: z.enum(["brand", "site"]).optional(),
});

export const registryVariable = z.looseObject({
  cssName: z.string().min(1),
  collectionId: z.string().min(1),
  type: z.enum(variableTypes),
  name: z.string().min(1).max(128),
});

export const variablesRegistry = z.looseObject({
  version: z.literal(1),
  collections: z.array(registryCollection),
  variables: z.array(registryVariable),
});

export type RegistryCollection = z.infer<typeof registryCollection>;

export type RegistryVariable = z.infer<typeof registryVariable>;

export type VariablesRegistry = z.infer<typeof variablesRegistry>;

export type RegistryState =
  | { status: "absent" }
  | { status: "readable"; registry: VariablesRegistry }
  | { status: "unreadable" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

/**
 * Reads `projectSettings.organizeos`. Absent: no `organizeos`, or no
 * `variables` in it. Unreadable: anything the schema refuses, a later
 * version included; the manager then writes no registry patch (spec 4.2).
 */
export const readVariablesRegistry = (organizeos: unknown): RegistryState => {
  if (organizeos === undefined) {
    return { status: "absent" };
  }
  if (isRecord(organizeos) === false) {
    return { status: "unreadable" };
  }
  if (organizeos.variables === undefined) {
    return { status: "absent" };
  }
  const parsed = variablesRegistry.safeParse(organizeos.variables);
  return parsed.success
    ? { status: "readable", registry: parsed.data }
    : { status: "unreadable" };
};
