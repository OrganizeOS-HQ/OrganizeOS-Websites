import { z } from "zod";
import { cmsDoorPath, request } from "./cms-api";
import { cmsFieldKinds, type CmsCollectionSummary } from "./cms-source";
import type {
  CmsCollectionSettings,
  CmsStructureCollection,
  CmsStructureField,
  CmsStructureLimits,
  CmsStructureSource,
  CmsTemplate,
} from "./cms-structure-source";

/**
 * The structure screens' calls to the door, E20 to E25 (fork doc section 5,
 * "The CMS door"), through `cms-api.ts`'s `request`: it never throws, and
 * anything it cannot read, a client timeout included, is `unavailable`.
 * E22's success adds `created`, true on a 201 and false on a 200.
 */

const fieldSchema: z.ZodType<CmsStructureField> = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(cmsFieldKinds),
  required: z.boolean().optional(),
  help: z.string().optional(),
  isTitle: z.boolean().optional(),
  options: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional(),
  reference: z
    .object({ collectionId: z.string(), multiple: z.boolean() })
    .optional(),
  maxLength: z.number().optional(),
  locked: z.boolean().optional(),
  showInTable: z.boolean().optional(),
});

const templateSchema: z.ZodType<CmsTemplate> = z.object({
  type: z.string(),
  label: z.string(),
});

const limitsSchema: z.ZodType<CmsStructureLimits> = z.object({
  fields: z.number(),
  customCollections: z.number().nullable(),
  customCount: z.number(),
});

const structureAnswer = z.object({
  templates: z.array(templateSchema),
  limits: limitsSchema,
});

const collectionStructureSchema: z.ZodType<CmsStructureCollection> = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  singularName: z.string(),
  isPublic: z.boolean(),
  updatedAt: z.string(),
  total: z.number(),
  fields: z.array(fieldSchema),
  referencedBy: z.array(z.object({ id: z.string(), name: z.string() })),
});

const collectionStructureAnswer = z.object({
  collection: collectionStructureSchema,
});

const summarySchema: z.ZodType<CmsCollectionSummary> = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  singularName: z.string(),
  isPublic: z.boolean(),
  total: z.number(),
});

const createAnswer = z.object({ collection: summarySchema });

const settingsAnswer: z.ZodType<{
  collection: CmsCollectionSettings & { id: string; updatedAt: string };
}> = z.object({
  collection: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    singularName: z.string(),
    isPublic: z.boolean(),
    updatedAt: z.string(),
  }),
});

const schemaAnswer = z.object({
  fields: z.array(fieldSchema),
  updatedAt: z.string(),
});

const deleteAnswer = z.object({});

export const createCmsStructureApi = (
  projectId: string
): CmsStructureSource => {
  const path = (rest: string) => cmsDoorPath(projectId, rest);
  const collection = (c: string) => `collections/${encodeURIComponent(c)}`;

  return {
    getStructure: () =>
      request(path("structure"), structureAnswer, { method: "GET" }),
    getCollectionStructure: (c) =>
      request(path(`${collection(c)}/structure`), collectionStructureAnswer, {
        method: "GET",
      }),
    // E22 answers 201 when it made the collection, 200 for a clientId
    // already made
    createCollection: (body) =>
      request(
        path("collections"),
        createAnswer,
        { method: "POST", json: body },
        ({ collection: made }, status) => ({
          collection: made,
          created: status === 201,
        })
      ),
    updateCollection: (c, body) =>
      request(path(collection(c)), settingsAnswer, {
        method: "PUT",
        json: body,
      }),
    updateSchema: (c, body) =>
      request(path(`${collection(c)}/schema`), schemaAnswer, {
        method: "PUT",
        json: body,
      }),
    deleteCollection: (c) =>
      request(path(`${collection(c)}/delete`), deleteAnswer, {
        method: "POST",
        json: {},
      }),
  };
};
