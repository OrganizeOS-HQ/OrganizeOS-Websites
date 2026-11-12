/**
 * The tests' scripted `CmsSource`: one `vi.fn` per method, with sample
 * answers a test replaces as it needs. Tests only.
 */
import { vi, type Mock } from "vitest";
import type {
  CmsCollection,
  CmsCollectionSummary,
  CmsItem,
  CmsItemRow,
  CmsSource,
} from "./cms-source";

export const POSTS: CmsCollectionSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "posts",
  name: "Posts",
  singularName: "Post",
  isPublic: true,
  total: 2,
};

export const PEOPLE: CmsCollectionSummary = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "people",
  name: "People",
  singularName: "Person",
  isPublic: false,
  total: 1,
};

const withoutTotal = ({
  total: _total,
  ...summary
}: CmsCollectionSummary): Omit<CmsCollectionSummary, "total"> => summary;

export const POSTS_DETAIL: CmsCollection = {
  ...withoutTotal(POSTS),
  fields: [
    {
      key: "title",
      label: "Title",
      kind: "text",
      isTitle: true,
      required: true,
      maxLength: 80,
    },
    { key: "summary", label: "Summary", kind: "textarea" },
    {
      key: "author",
      label: "Author",
      kind: "reference",
      reference: { collectionId: PEOPLE.id, multiple: false },
    },
  ],
};

const PEOPLE_DETAIL: CmsCollection = {
  ...withoutTotal(PEOPLE),
  fields: [
    { key: "name", label: "Name", kind: "text", isTitle: true, required: true },
  ],
};

export const VERSION = "2026-11-12T10:00:00.123456+00:00";

export const itemOf = (overrides: Partial<CmsItem> = {}): CmsItem => ({
  id: "33333333-3333-4333-8333-333333333333",
  slug: "hello",
  status: "draft",
  hasStagedChanges: false,
  data: { title: "Hello", summary: null, author: null },
  updatedAt: VERSION,
  createdAt: VERSION,
  publishedAt: null,
  ...overrides,
});

export const rowOf = (item: CmsItem): CmsItemRow => ({
  id: item.id,
  slug: item.slug,
  title: typeof item.data.title === "string" ? item.data.title : "",
  status: item.status,
  hasStagedChanges: item.hasStagedChanges,
  updatedAt: item.updatedAt,
});

export type FakeCmsSource = { [M in keyof CmsSource]: Mock<CmsSource[M]> };

export const createFakeCmsSource = (): FakeCmsSource => ({
  getAccess: vi.fn<CmsSource["getAccess"]>(async () => ({
    canEdit: true,
    canPublish: true,
    canManageSettings: true,
  })),
  listCollections: vi.fn<CmsSource["listCollections"]>(async () => ({
    collections: [POSTS, PEOPLE],
  })),
  getCollection: vi.fn<CmsSource["getCollection"]>(async (collectionId) => {
    if (collectionId === POSTS.id) {
      return { collection: POSTS_DETAIL };
    }
    if (collectionId === PEOPLE.id) {
      return { collection: PEOPLE_DETAIL };
    }
    return { error: "not_found" };
  }),
  listItems: vi.fn<CmsSource["listItems"]>(async () => ({
    items: [rowOf(itemOf())],
    total: 1,
    page: 1,
  })),
  getItem: vi.fn<CmsSource["getItem"]>(async () => ({ item: itemOf() })),
  searchItems: vi.fn<CmsSource["searchItems"]>(async () => ({ items: [] })),
  createItem: vi.fn<CmsSource["createItem"]>(async () => ({
    error: "unavailable",
  })),
  updateItem: vi.fn<CmsSource["updateItem"]>(async () => ({
    error: "unavailable",
  })),
  publishItem: vi.fn<CmsSource["publishItem"]>(async () => ({
    error: "unavailable",
  })),
  discardItemChanges: vi.fn<CmsSource["discardItemChanges"]>(async () => ({
    error: "unavailable",
  })),
  uploadImage: vi.fn<CmsSource["uploadImage"]>(async () => ({
    error: "unavailable",
  })),
});
