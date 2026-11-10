/**
 * The structure screens' data seam (slice 3 of OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 4.1): collections, their fields, templates and the plan's caps.
 *
 * The door has no structure endpoints yet. Each method mirrors one of the
 * platform's collection actions (`client/lib/actions/collections/
 * manage-collection.ts`), answering with the success body or a
 * `CmsFailure` of the codes in 5.7. The storybook preview uses the
 * in-memory `createSampleCmsStructureSource`.
 */
import type {
  CmsField,
  CmsFieldKind,
  CmsRawFieldKind,
  CmsResult,
} from "./cms-source";

/** A schema field with the editor-only flags the field sheet sets. */
export type CmsStructureField<Kind extends string = CmsFieldKind> =
  CmsField<Kind> & {
    /**
     * From a template: the name stays editable; the field is never removed,
     * and its reference never retargeted, so blocks bound by key keep
     * working.
     */
    locked?: boolean;
    /** A column in the items table (slice 2); never on the title field. */
    showInTable?: boolean;
  };

/** One collection, as the structure screens use it: kinds normalised. */
export type CmsStructureCollection = {
  id: string;
  slug: string;
  name: string;
  singularName: string;
  isPublic: boolean;
  /** `curated`: made from a template. */
  kind: "curated" | "custom";
  fields: CmsStructureField[];
  /** Every item, any status: what removing a field touches. */
  total: number;
  /** Collections with a reference field that targets this one. */
  referencedBy: Array<{ id: string; name: string }>;
};

/** As the door would return it: legacy kind spellings kept. */
export type CmsRawStructureCollection = Omit<
  CmsStructureCollection,
  "fields"
> & {
  fields: CmsStructureField<CmsRawFieldKind>[];
};

/** A registry template field: `referenceType` names the template it targets. */
export type CmsTemplateField = {
  key: string;
  label: string;
  kind: CmsRawFieldKind;
  referenceType?: string;
};

/** `registry.ts` `CURATED_TYPES`, in `TEMPLATE_ORDER`. */
export type CmsTemplate = {
  type: string;
  label: string;
  itemLabel: string;
  fields: CmsTemplateField[];
};

/** `limits.ts` for the org's tier; null is unlimited. */
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
  getLimits: () => Promise<CmsResult<CmsStructureLimits>>;
  listTemplates: () => Promise<CmsResult<{ templates: CmsTemplate[] }>>;
  getStructure: (
    collectionId: string
  ) => Promise<CmsResult<{ collection: CmsRawStructureCollection }>>;
  /**
   * `updateCollectionSchema`: the whole schema. A field missing from it is
   * refused unless its key is in `removeKeys`, which strips it from every
   * item.
   */
  updateSchema: (
    collectionId: string,
    body: { fields: CmsStructureField[]; removeKeys?: string[] }
  ) => Promise<CmsResult<{ fields: CmsStructureField[] }>>;
  /** `updateCollection`; `slug_taken` when the address is in use. */
  updateCollection: (
    collectionId: string,
    body: CmsCollectionSettings
  ) => Promise<CmsResult<{ slug: string }>>;
  /**
   * `createCollection`: a template's type or `custom`. A template that
   * references another creates that one too when the org has none.
   */
  createCollection: (body: {
    type: string;
    name: string;
    singularName?: string;
  }) => Promise<CmsResult<{ id: string }>>;
  /** `deleteCollection`: refused while another collection references it. */
  deleteCollection: (collectionId: string) => Promise<CmsResult<object>>;
};

export const CUSTOM_COLLECTION_TYPE = "custom";
