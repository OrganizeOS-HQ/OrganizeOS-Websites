/**
 * The tests' scripted `CmsStructureSource`: one `vi.fn` per method, with
 * sample answers a test replaces as it needs. Tests only.
 */
import { vi, type Mock } from "vitest";
import type {
  CmsStructureCollection,
  CmsStructureSource,
  CmsTemplate,
} from "./cms-structure-source";
import { POSTS, POSTS_DETAIL, VERSION } from "./fake-cms-source";

/** E20's seven, in `TEMPLATE_ORDER`. */
export const TEMPLATES: CmsTemplate[] = [
  { type: "blog", label: "Blog posts" },
  { type: "team", label: "Team Members" },
  { type: "endorsements", label: "Endorsements" },
  { type: "issues", label: "Issues" },
  { type: "faq", label: "FAQ" },
  { type: "testimonials", label: "Testimonials" },
  { type: "categories", label: "Categories" },
];

export const POSTS_STRUCTURE: CmsStructureCollection = {
  id: POSTS.id,
  slug: POSTS.slug,
  name: POSTS.name,
  singularName: POSTS.singularName,
  isPublic: POSTS.isPublic,
  updatedAt: VERSION,
  total: 2,
  fields: POSTS_DETAIL.fields,
  referencedBy: [],
};

export type FakeCmsStructureSource = {
  [M in keyof CmsStructureSource]: Mock<CmsStructureSource[M]>;
};

export const createFakeCmsStructureSource = (): FakeCmsStructureSource => ({
  getStructure: vi.fn<CmsStructureSource["getStructure"]>(async () => ({
    templates: structuredClone(TEMPLATES),
    limits: { fields: 30, customCollections: 5, customCount: 0 },
  })),
  // a fresh copy per call, as each answer of the platform is
  getCollectionStructure: vi.fn<CmsStructureSource["getCollectionStructure"]>(
    async (collectionId) =>
      collectionId === POSTS.id
        ? { collection: structuredClone(POSTS_STRUCTURE) }
        : { error: "not_found" }
  ),
  createCollection: vi.fn<CmsStructureSource["createCollection"]>(async () => ({
    error: "unavailable",
  })),
  updateCollection: vi.fn<CmsStructureSource["updateCollection"]>(async () => ({
    error: "unavailable",
  })),
  updateSchema: vi.fn<CmsStructureSource["updateSchema"]>(async () => ({
    error: "unavailable",
  })),
  deleteCollection: vi.fn<CmsStructureSource["deleteCollection"]>(async () => ({
    error: "unavailable",
  })),
});
