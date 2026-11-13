/**
 * The structure screens' sample data: an in-memory `CmsStructureSource`
 * over the slice-1 sample (`sample-cms-source.ts`), and a `CmsSource` that
 * lists what it holds, so a collection made, renamed or deleted here shows
 * in the column and the items view. Items stay in the slice-1 sample; a
 * collection made here has none.
 *
 * It refuses what the platform refuses (`manage-collection.ts`): the plan's
 * caps (`limit`), an address in use (`slug_taken`), a schema
 * `validateFieldSchema` rejects (`invalid` with the field's key), a removed
 * field not named in `removeKeys`, a stale `expectedUpdatedAt`
 * (`conflict`), and deleting a collection another references
 * (`referenced`). A `clientId` already made answers that collection.
 */
import { isSlug, slugify } from "./cms-logic";
import {
  isCmsFailure,
  type CmsCollectionSummary,
  type CmsFailure,
  type CmsSource,
} from "./cms-source";
import {
  FIELD_KEY_RE,
  getFieldCap,
  isReferenceKind,
} from "./cms-structure-logic";
import {
  CUSTOM_COLLECTION_TYPE,
  type CmsStructureCollection,
  type CmsStructureField,
  type CmsStructureLimits,
  type CmsStructureSource,
  type CmsTemplate,
} from "./cms-structure-source";
import {
  columnsOf,
  filterFieldOf,
  SAMPLE_COLLECTION_IDS,
  type SampleCmsSource,
} from "./sample-cms-source";

/** `limits.ts` `CMS_LIMITS`, for the tiers the website builder serves. */
export const SAMPLE_PLANS = {
  core: { customCollections: 5, fields: 30 },
  pro: { customCollections: 20, fields: 60 },
} as const;

export type SamplePlan = keyof typeof SAMPLE_PLANS;

/** A registry template field: `referenceType` names the template it targets. */
type SampleTemplateField = {
  key: string;
  label: string;
  kind: CmsStructureField["kind"];
  referenceType?: string;
};

/** E20's template, with what the sample needs to make one. */
type SampleTemplate = CmsTemplate & {
  itemLabel: string;
  fields: SampleTemplateField[];
};

/** `registry.ts` `CURATED_TYPES` in `TEMPLATE_ORDER`. */
export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    type: "blog",
    label: "Blog posts",
    itemLabel: "Blog post",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "summary", label: "Summary", kind: "textarea" },
      { key: "body", label: "Body", kind: "richtext" },
      { key: "cover", label: "Cover image", kind: "image" },
      { key: "publishedOn", label: "Published on", kind: "date" },
      {
        key: "author",
        label: "Author",
        kind: "reference",
        referenceType: "team",
      },
      {
        key: "categories",
        label: "Categories",
        kind: "multireference",
        referenceType: "categories",
      },
    ],
  },
  {
    type: "team",
    label: "Team Members",
    itemLabel: "Member",
    fields: [
      { key: "name", label: "Name", kind: "text" },
      { key: "role", label: "Role", kind: "text" },
      { key: "bio", label: "Bio", kind: "textarea" },
      { key: "image", label: "Photo", kind: "image" },
    ],
  },
  {
    type: "endorsements",
    label: "Endorsements",
    itemLabel: "Endorsement",
    fields: [
      { key: "name", label: "Name", kind: "text" },
      { key: "title", label: "Title", kind: "text" },
      { key: "organization", label: "Organization", kind: "text" },
      { key: "quote", label: "Quote", kind: "textarea" },
      { key: "image", label: "Photo", kind: "image" },
    ],
  },
  {
    type: "issues",
    label: "Issues",
    itemLabel: "Issue",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "image", label: "Image", kind: "image" },
      { key: "link", label: "Learn-more link", kind: "link" },
    ],
  },
  {
    type: "faq",
    label: "FAQ",
    itemLabel: "Question",
    fields: [
      { key: "question", label: "Question", kind: "text" },
      { key: "answer", label: "Answer", kind: "textarea" },
    ],
  },
  {
    type: "testimonials",
    label: "Testimonials",
    itemLabel: "Testimonial",
    fields: [
      { key: "quote", label: "Quote", kind: "textarea" },
      { key: "author", label: "Author", kind: "text" },
      { key: "role", label: "Role", kind: "text" },
      { key: "image", label: "Photo", kind: "image" },
    ],
  },
  {
    type: "categories",
    label: "Categories",
    itemLabel: "Category",
    fields: [
      { key: "name", label: "Name", kind: "text" },
      { key: "description", label: "Description", kind: "textarea" },
    ],
  },
];

/** Template types a template references, in field order, once each. */
const getTemplateReferenceTypes = (template: SampleTemplate) => {
  const types: string[] = [];
  for (const field of template.fields) {
    if (
      field.referenceType !== undefined &&
      types.includes(field.referenceType) === false
    ) {
      types.push(field.referenceType);
    }
  }
  return types;
};

/** Each template's title and required fields (`registry.ts`). */
const templateFlags: Record<string, { title: string; required: string[] }> = {
  blog: { title: "title", required: ["body"] },
  team: { title: "name", required: [] },
  endorsements: { title: "name", required: [] },
  issues: { title: "title", required: [] },
  faq: { title: "question", required: ["answer"] },
  testimonials: { title: "author", required: ["quote"] },
  categories: { title: "name", required: [] },
};

/** Collections the structure sample adds beside the slice-1 four. */
export const SAMPLE_STRUCTURE_IDS = {
  ...SAMPLE_COLLECTION_IDS,
  faq: "0000000a-0000-4000-8000-000000000000",
  survey: "0000000b-0000-4000-8000-000000000000",
  shifts: "0000000c-0000-4000-8000-000000000000",
} as const;

/** Thirty questions: a Core plan's whole allowance. */
const surveyLabels = [
  "Member name",
  "Local",
  "Worksite",
  "Department",
  "Job title",
  "Years of service",
  "Shift",
  "Hours a week",
  "Hourly wage",
  "Overtime last month",
  "Mandatory overtime",
  "Staffing on your unit",
  "Breaks taken",
  "Safety incidents",
  "Injury reported",
  "Retaliation witnessed",
  "Childcare needs",
  "Commute",
  "Health plan",
  "Dental and vision",
  "Pension",
  "Top priority",
  "Second priority",
  "Strike readiness",
  "Willing to steward",
  "Willing to phone bank",
  "Preferred contact",
  "Phone",
  "Email",
  "Comments",
];

const surveyKind = (index: number): CmsStructureField["kind"] => {
  if (index === 0 || index === 1 || index === 2) {
    return "text";
  }
  if (index >= 5 && index <= 9) {
    return "number";
  }
  if (index === 23) {
    return "option";
  }
  if (index === 24 || index === 25 || index === 14) {
    return "switch";
  }
  if (index === 27) {
    return "phone";
  }
  if (index === 28) {
    return "email";
  }
  if (index === 29) {
    return "textarea";
  }
  return "text";
};

const surveyFields = (): CmsStructureField[] =>
  surveyLabels.map((label, index) => {
    const kind = surveyKind(index);
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)/g, (_, next: string) => next.toUpperCase());
    return {
      key,
      label,
      kind,
      ...(index === 0 ? { isTitle: true, required: true } : {}),
      ...(kind === "option"
        ? {
            options: [
              { value: "ready", label: "Ready" },
              { value: "maybe", label: "Not sure" },
              { value: "no", label: "Not yet" },
            ],
          }
        : {}),
    };
  });

const LONG_FIELD_LABEL =
  "Signature goal for the petition to the county board of supervisors and the mayor";

type SampleStructure = Omit<CmsStructureCollection, "referencedBy"> & {
  /** The registry type, or `custom`. */
  type: string;
  kind: "curated" | "custom";
  /** The create-once key it was made under. */
  clientId?: string;
};

export type SampleStructureOptions = {
  plan?: SamplePlan;
  /** No collections at all: the first run. */
  empty?: boolean;
  /** A field name of about 80 characters, in Campaigns. */
  longFieldName?: boolean;
};

export type SampleCmsStructure = {
  /** The slice-1 sample, listing this one's collections. */
  source: CmsSource;
  structure: CmsStructureSource;
};

export const createSampleCmsStructure = (
  base: SampleCmsSource,
  {
    plan = "pro",
    empty = false,
    longFieldName = false,
  }: SampleStructureOptions = {}
): SampleCmsStructure => {
  const limits = SAMPLE_PLANS[plan];
  let collections: SampleStructure[] | undefined;
  let sequence = 0;
  let clock = Date.parse("2026-11-01T09:00:00Z");
  /** A PostgREST timestamp, moved on by each write. */
  const nextVersion = () => {
    clock += 1000;
    return new Date(clock).toISOString().replace("Z", "000+00:00");
  };

  const wait = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, base.flags.latency ?? 0);
    });

  const refusal = async (write: boolean): Promise<CmsFailure | undefined> => {
    await wait();
    if (base.flags.refuse !== undefined) {
      return { error: base.flags.refuse };
    }
    if (write && base.flags.refuseWrites !== undefined) {
      return { error: base.flags.refuseWrites };
    }
    return undefined;
  };

  /** The slice-1 four, read once, then the three this sample adds. */
  const load = async (): Promise<SampleStructure[]> => {
    if (collections !== undefined) {
      return collections;
    }
    if (empty) {
      collections = [];
      return collections;
    }
    const listed = await base.listCollections();
    if (isCmsFailure(listed)) {
      return [];
    }
    const loaded: SampleStructure[] = [];
    for (const summary of listed.collections) {
      const detail = await base.getCollection(summary.id);
      if (isCmsFailure(detail)) {
        continue;
      }
      const { collection } = detail;
      const isLeadership = summary.id === SAMPLE_STRUCTURE_IDS.leadership;
      const fields: CmsStructureField[] = collection.fields.map((field) => {
        // Leadership came from the Team template: its fields stay
        if (
          isLeadership &&
          ["name", "role", "bio", "photo"].includes(field.key)
        ) {
          return { ...field, locked: true };
        }
        if (
          summary.id === SAMPLE_STRUCTURE_IDS.news &&
          (field.key === "publishedOn" || field.key === "category")
        ) {
          return { ...field, showInTable: true };
        }
        if (
          longFieldName &&
          summary.id === SAMPLE_STRUCTURE_IDS.campaigns &&
          field.key === "signatureGoal"
        ) {
          return { ...field, label: LONG_FIELD_LABEL };
        }
        return field;
      });
      loaded.push({
        ...collection,
        fields,
        updatedAt: nextVersion(),
        kind: isLeadership ? "curated" : "custom",
        type: isLeadership ? "team" : CUSTOM_COLLECTION_TYPE,
        total: summary.total,
      });
    }
    loaded.push(
      {
        id: SAMPLE_STRUCTURE_IDS.faq,
        slug: "faq",
        name: "FAQ",
        singularName: "Question",
        isPublic: true,
        kind: "curated",
        type: "faq",
        updatedAt: nextVersion(),
        total: 0,
        fields: [
          {
            key: "question",
            label: "Question",
            kind: "text",
            isTitle: true,
            required: true,
            locked: true,
          },
          {
            key: "answer",
            label: "Answer",
            kind: "textarea",
            required: true,
            locked: true,
          },
        ],
      },
      {
        id: SAMPLE_STRUCTURE_IDS.survey,
        slug: "member-survey",
        name: "Member survey",
        singularName: "Response",
        isPublic: false,
        kind: "custom",
        type: CUSTOM_COLLECTION_TYPE,
        updatedAt: nextVersion(),
        total: 0,
        fields: surveyFields(),
      },
      {
        id: SAMPLE_STRUCTURE_IDS.shifts,
        slug: "volunteer-shifts",
        name: "Volunteer shifts",
        singularName: "Shift",
        isPublic: true,
        kind: "custom",
        type: CUSTOM_COLLECTION_TYPE,
        updatedAt: nextVersion(),
        total: 0,
        fields: [
          {
            key: "name",
            label: "Name",
            kind: "text",
            isTitle: true,
            required: true,
          },
          {
            key: "startsAt",
            label: "Starts",
            kind: "datetime",
            required: true,
          },
          { key: "spots", label: "Spots", kind: "number" },
        ],
      }
    );
    collections = loaded;
    return collections;
  };

  const referencedBy = (all: SampleStructure[], collectionId: string) =>
    all
      .filter(
        (other) =>
          other.id !== collectionId &&
          other.fields.some(
            (field) => field.reference?.collectionId === collectionId
          )
      )
      .map(({ id, name }) => ({ id, name }));

  const customCount = (all: SampleStructure[]) =>
    all.filter((entry) => entry.kind === "custom").length;

  const newId = () => {
    sequence += 1;
    return `000000ff-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
  };

  const uniqueSlug = (base: string, taken: Set<string>) => {
    if (taken.has(base) === false) {
      return base;
    }
    let next = 2;
    while (taken.has(`${base}-${next}`)) {
      next += 1;
    }
    return `${base}-${next}`;
  };

  /** `validateFieldSchema` against the schema in force. */
  const checkSchema = (
    all: SampleStructure[],
    existing: SampleStructure["fields"],
    fields: CmsStructureField[],
    removeKeys: string[]
  ): CmsFailure | undefined => {
    if (fields.length === 0) {
      return { error: "invalid" };
    }
    if (fields.length > getFieldCap(limits.fields)) {
      return { error: "limit" };
    }
    const seen = new Set<string>();
    let titles = 0;
    for (const field of fields) {
      const lower = field.key.toLowerCase();
      if (FIELD_KEY_RE.test(field.key) === false || seen.has(lower)) {
        return { error: "invalid", field: field.key };
      }
      seen.add(lower);
      const before = existing.find((entry) => entry.key === field.key);
      if (before !== undefined && before.kind !== field.kind) {
        return { error: "invalid", field: field.key };
      }
      if (field.isTitle) {
        titles += 1;
        if (field.kind !== "text") {
          return { error: "invalid", field: field.key };
        }
      }
      if (field.kind === "option" && (field.options ?? []).length === 0) {
        return { error: "invalid", field: field.key };
      }
      if (
        isReferenceKind(field.kind) &&
        all.some((entry) => entry.id === field.reference?.collectionId) ===
          false
      ) {
        return { error: "reference_invalid", field: field.key };
      }
    }
    if (titles !== 1) {
      return { error: "invalid" };
    }
    for (const before of existing) {
      if (seen.has(before.key.toLowerCase())) {
        continue;
      }
      if (before.locked || removeKeys.includes(before.key) === false) {
        return { error: "invalid", field: before.key };
      }
    }
    return undefined;
  };

  const summaryOf = (entry: SampleStructure): CmsCollectionSummary => ({
    id: entry.id,
    slug: entry.slug,
    name: entry.name,
    singularName: entry.singularName,
    isPublic: entry.isPublic,
    total: entry.total,
  });

  const structure: CmsStructureSource = {
    async getStructure() {
      const failure = await refusal(false);
      if (failure) {
        return failure;
      }
      const all = await load();
      const result: CmsStructureLimits = {
        fields: getFieldCap(limits.fields),
        customCollections: limits.customCollections,
        customCount: customCount(all),
      };
      return {
        templates: SAMPLE_TEMPLATES.map(({ type, label }) => ({ type, label })),
        limits: result,
      };
    },

    async getCollectionStructure(collectionId) {
      const failure = await refusal(false);
      if (failure) {
        return failure;
      }
      const all = await load();
      const found = all.find((entry) => entry.id === collectionId);
      if (found === undefined) {
        return { error: "not_found" };
      }
      const { type: _type, kind: _kind, clientId: _clientId, ...rest } = found;
      return {
        collection: structuredClone({
          ...rest,
          referencedBy: referencedBy(all, collectionId),
        }),
      };
    },

    async updateSchema(
      collectionId,
      { fields, removeKeys = [], expectedUpdatedAt }
    ) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const all = await load();
      const found = all.find((entry) => entry.id === collectionId);
      if (found === undefined) {
        return { error: "not_found" };
      }
      if (found.updatedAt !== expectedUpdatedAt) {
        return { error: "conflict" };
      }
      const problem = checkSchema(all, found.fields, fields, removeKeys);
      if (problem) {
        return problem;
      }
      found.fields = structuredClone(fields);
      found.updatedAt = nextVersion();
      return { fields: structuredClone(fields), updatedAt: found.updatedAt };
    },

    async updateCollection(collectionId, { expectedUpdatedAt, ...body }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const all = await load();
      const found = all.find((entry) => entry.id === collectionId);
      if (found === undefined) {
        return { error: "not_found" };
      }
      if (found.updatedAt !== expectedUpdatedAt) {
        return { error: "conflict" };
      }
      if (body.name.trim() === "") {
        return { error: "invalid", field: "name" };
      }
      if (body.singularName.trim() === "") {
        return { error: "invalid", field: "singularName" };
      }
      if (isSlug(body.slug) === false) {
        return { error: "invalid", field: "slug" };
      }
      if (
        all.some(
          (entry) => entry.id !== collectionId && entry.slug === body.slug
        )
      ) {
        return { error: "slug_taken" };
      }
      found.name = body.name.trim();
      found.singularName = body.singularName.trim();
      found.slug = body.slug;
      found.isPublic = body.isPublic;
      found.updatedAt = nextVersion();
      return {
        collection: {
          id: found.id,
          name: found.name,
          singularName: found.singularName,
          slug: found.slug,
          isPublic: found.isPublic,
          updatedAt: found.updatedAt,
        },
      };
    },

    async createCollection({ clientId, type, name, singularName }) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const all = await load();
      const already = all.find((entry) => entry.clientId === clientId);
      if (already !== undefined) {
        return { collection: summaryOf(already), created: false };
      }
      const taken = new Set(all.map((entry) => entry.slug));
      if (type === CUSTOM_COLLECTION_TYPE) {
        if (
          limits.customCollections !== null &&
          customCount(all) >= limits.customCollections
        ) {
          return { error: "limit" };
        }
        const custom: SampleStructure = {
          id: newId(),
          slug: uniqueSlug(slugify(name, "collection"), taken),
          name: name.trim(),
          singularName: singularName?.trim() || name.trim(),
          isPublic: true,
          kind: "custom",
          type,
          clientId,
          updatedAt: nextVersion(),
          total: 0,
          fields: [
            {
              key: "name",
              label: "Name",
              kind: "text",
              required: true,
              isTitle: true,
            },
          ],
        };
        all.push(custom);
        return { collection: summaryOf(custom), created: true };
      }
      const template = SAMPLE_TEMPLATES.find((entry) => entry.type === type);
      if (template === undefined) {
        return { error: "invalid" };
      }
      const make = (from: SampleTemplate, label: string): SampleStructure => {
        const targets: Record<string, string> = {};
        for (const targetType of getTemplateReferenceTypes(from)) {
          const existing = all.find((entry) => entry.type === targetType);
          if (existing !== undefined) {
            targets[targetType] = existing.id;
            continue;
          }
          const targetTemplate = SAMPLE_TEMPLATES.find(
            (entry) => entry.type === targetType
          );
          if (targetTemplate !== undefined) {
            const target = make(targetTemplate, targetTemplate.label);
            all.push(target);
            targets[targetType] = target.id;
          }
        }
        const flags = templateFlags[from.type];
        const slug = uniqueSlug(slugify(label, from.type), taken);
        taken.add(slug);
        return {
          id: newId(),
          slug,
          name: label.trim(),
          singularName: from.itemLabel,
          isPublic: true,
          kind: "curated",
          type: from.type,
          updatedAt: nextVersion(),
          total: 0,
          fields: from.fields.map(({ referenceType, ...field }) => ({
            ...field,
            locked: true,
            ...(field.key === flags?.title
              ? { isTitle: true, required: true }
              : {}),
            ...(flags?.required.includes(field.key) ? { required: true } : {}),
            ...(referenceType === undefined
              ? {}
              : {
                  reference: {
                    collectionId: targets[referenceType],
                    multiple: field.kind === "multireference",
                  },
                }),
          })),
        };
      };
      const made = { ...make(template, name), clientId };
      all.push(made);
      return { collection: summaryOf(made), created: true };
    },

    async deleteCollection(collectionId) {
      const failure = await refusal(true);
      if (failure) {
        return failure;
      }
      const all = await load();
      if (all.some((entry) => entry.id === collectionId) === false) {
        return { error: "not_found" };
      }
      if (referencedBy(all, collectionId).length > 0) {
        return { error: "referenced" };
      }
      collections = all.filter((entry) => entry.id !== collectionId);
      return {};
    },
  };

  const source: CmsSource = {
    ...base,
    async listCollections() {
      const failure = await refusal(false);
      if (failure) {
        return failure;
      }
      const all = await load();
      const listed = await base.listCollections();
      const totals = new Map(
        isCmsFailure(listed)
          ? []
          : listed.collections.map((entry) => [entry.id, entry.total])
      );
      return {
        collections: all.map((entry) => ({
          ...summaryOf(entry),
          total: totals.get(entry.id) ?? entry.total,
        })),
      };
    },
    async getCollection(collectionId) {
      const failure = await refusal(false);
      if (failure) {
        return failure;
      }
      const found = (await load()).find((entry) => entry.id === collectionId);
      if (found === undefined) {
        return { error: "not_found" };
      }
      return {
        collection: structuredClone({
          id: found.id,
          slug: found.slug,
          name: found.name,
          singularName: found.singularName,
          isPublic: found.isPublic,
          fields: found.fields,
        }),
      };
    },
    async listItems(collectionId, query) {
      const found = (await load()).find((entry) => entry.id === collectionId);
      if (found === undefined) {
        return { error: "not_found" };
      }
      const result = await base.listItems(collectionId, query);
      if (isCmsFailure(result) && result.error === "not_found") {
        // a collection made here: no items yet, its columns from its schema
        const filterField = filterFieldOf(found.fields)?.key ?? null;
        const sort = query.sort ?? "order";
        return {
          items: [],
          total: 0,
          page: 1,
          columns: columnsOf(found.fields),
          filterField,
          applied: {
            status: query.status ?? "all",
            sort: sort.startsWith("field:") ? "order" : sort,
            direction:
              sort === "order" || sort.startsWith("field:")
                ? "asc"
                : (query.direction ?? (sort === "updated" ? "desc" : "asc")),
            optionKey: null,
            optionValue: null,
          },
        };
      }
      return result;
    },
  };

  return { source, structure };
};
