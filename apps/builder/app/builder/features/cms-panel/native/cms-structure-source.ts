/**
 * The structure screens' data seam (OrganizeOS design
 * docs/superpowers/specs/2026-11-13-native-cms-slice-3-design.md, 5.1):
 * collections, their fields, templates and the plan's caps.
 *
 * One method per door endpoint, E20 to E25, returning what the endpoint
 * returns: the success body, or `{ error: code, field? }`. E22's success
 * adds `created`, true on a 201 and false on a 200, a create already made.
 * `createCmsStructureApi` (`cms-structure-api.ts`) calls the builder routes;
 * the storybook preview uses the in-memory `createSampleCmsStructure`.
 */
import type { CmsCollectionSummary, CmsField, CmsResult } from "./cms-source";

/** A schema field with the flags the field sheet sets. */
export type CmsStructureField = CmsField & {
  /**
   * From a template: the name stays editable; the field is never removed,
   * and its reference never retargeted.
   */
  locked?: boolean;
  /** A column in the items table; never on the title field. */
  showInTable?: boolean;
};

/** E21's collection. */
export type CmsStructureCollection = {
  id: string;
  slug: string;
  name: string;
  singularName: string;
  isPublic: boolean;
  /** The raw PostgREST string: the structure lock. Never parsed. */
  updatedAt: string;
  /** Every item, any status: what removing a field touches. */
  total: number;
  fields: CmsStructureField[];
  /** Collections with a reference field that targets this one. */
  referencedBy: Array<{ id: string; name: string }>;
};

/** E20's template, in `TEMPLATE_ORDER`. */
export type CmsTemplate = { type: string; label: string };

/** E20's caps for the org's plan; `customCollections` null is unlimited. */
export type CmsStructureLimits = {
  fields: number;
  customCollections: number | null;
  customCount: number;
};

export type CmsCollectionSettings = {
  name: string;
  singularName: string;
  slug: string;
  isPublic: boolean;
};

export type CmsStructureSource = {
  /** E20 `GET /structure` */
  getStructure: () => Promise<
    CmsResult<{ templates: CmsTemplate[]; limits: CmsStructureLimits }>
  >;
  /** E21 `GET /collections/{collectionId}/structure` */
  getCollectionStructure: (
    collectionId: string
  ) => Promise<CmsResult<{ collection: CmsStructureCollection }>>;
  /**
   * E22 `POST /collections`. `clientId` is minted when the form opens and
   * sent with every attempt until one succeeds.
   */
  createCollection: (body: {
    clientId: string;
    type: string;
    name: string;
    singularName?: string;
  }) => Promise<
    CmsResult<{ collection: CmsCollectionSummary; created: boolean }>
  >;
  /** E23 `PUT /collections/{collectionId}` */
  updateCollection: (
    collectionId: string,
    body: CmsCollectionSettings & { expectedUpdatedAt: string }
  ) => Promise<
    CmsResult<{
      collection: CmsCollectionSettings & { id: string; updatedAt: string };
    }>
  >;
  /**
   * E24 `PUT /collections/{collectionId}/schema`: the whole schema. A field
   * missing from it is refused unless its key is in `removeKeys`.
   */
  updateSchema: (
    collectionId: string,
    body: {
      fields: CmsStructureField[];
      removeKeys?: string[];
      expectedUpdatedAt: string;
    }
  ) => Promise<CmsResult<{ fields: CmsStructureField[]; updatedAt: string }>>;
  /** E25 `POST /collections/{collectionId}/delete` */
  deleteCollection: (collectionId: string) => Promise<CmsResult<object>>;
};

export const CUSTOM_COLLECTION_TYPE = "custom";
