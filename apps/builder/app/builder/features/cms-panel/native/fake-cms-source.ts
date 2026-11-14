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
  CmsItemsPage,
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

/** A collection with a field of each kind the table shows. */
export const EVENTS: CmsCollectionSummary = {
  id: "44444444-4444-4444-8444-444444444444",
  slug: "events",
  name: "Events",
  singularName: "Event",
  isPublic: true,
  total: 3,
};

export const EVENTS_DETAIL: CmsCollection = {
  ...withoutTotal(EVENTS),
  fields: [
    { key: "title", label: "Title", kind: "text", isTitle: true },
    {
      key: "kind",
      label: "Kind",
      kind: "option",
      options: [
        { value: "Q&A night", label: "Q&A night" },
        { value: "Café", label: "Café" },
      ],
    },
    { key: "online", label: "Online", kind: "switch" },
    { key: "day", label: "Day", kind: "date" },
    { key: "seats", label: "Seats", kind: "number" },
    { key: "starts", label: "Starts", kind: "datetime" },
    {
      key: "host",
      label: "Host",
      kind: "reference",
      reference: { collectionId: PEOPLE.id, multiple: false },
    },
    {
      key: "tags",
      label: "Tags",
      kind: "multireference",
      reference: { collectionId: EVENTS.id, multiple: true },
    },
    { key: "body", label: "Body", kind: "richtext" },
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
  live: null,
  modifiedByName: null,
  ...overrides,
});

export const rowOf = (item: CmsItem): CmsItemRow => ({
  id: item.id,
  slug: item.slug,
  title: typeof item.data.title === "string" ? item.data.title : "",
  status: item.status,
  hasStagedChanges: item.hasStagedChanges,
  updatedAt: item.updatedAt,
  publishedAt: item.publishedAt,
  values: {},
});

/** An E3 page, the slice 2 keys at their defaults unless `extra` sets them. */
export const itemsPageOf = (
  items: CmsItemRow[],
  total: number,
  page: number,
  extra: Partial<CmsItemsPage> = {}
): CmsItemsPage => ({
  items,
  total,
  page,
  columns: [],
  filterField: null,
  applied: {
    status: "all",
    sort: "order",
    direction: "asc",
    optionKey: null,
    optionValue: null,
  },
  ...extra,
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
  // a fresh copy per call, as each answer of the platform is
  getCollection: vi.fn<CmsSource["getCollection"]>(async (collectionId) => {
    if (collectionId === POSTS.id) {
      return { collection: structuredClone(POSTS_DETAIL) };
    }
    if (collectionId === PEOPLE.id) {
      return { collection: structuredClone(PEOPLE_DETAIL) };
    }
    if (collectionId === EVENTS.id) {
      return { collection: structuredClone(EVENTS_DETAIL) };
    }
    return { error: "not_found" };
  }),
  listItems: vi.fn<CmsSource["listItems"]>(async () =>
    itemsPageOf([rowOf(itemOf())], 1, 1)
  ),
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
  publishItems: vi.fn<CmsSource["publishItems"]>(async () => ({
    error: "unavailable",
  })),
  setItemsStatus: vi.fn<CmsSource["setItemsStatus"]>(async () => ({
    error: "unavailable",
  })),
  deleteItems: vi.fn<CmsSource["deleteItems"]>(async () => ({
    error: "unavailable",
  })),
  reorderItems: vi.fn<CmsSource["reorderItems"]>(async () => ({
    error: "unavailable",
  })),
  uploadImage: vi.fn<CmsSource["uploadImage"]>(async () => ({
    error: "unavailable",
  })),
});
