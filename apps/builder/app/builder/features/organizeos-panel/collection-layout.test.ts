import { describe, expect, test } from "vitest";
import { type CollectionField, pickRoles } from "./collection-layout";

// The curated templates' `fields`, copied verbatim from the OrganizeOS repo's
// `client/lib/collections/registry.ts` (lines 11-90). `url` is the registry's
// legacy spelling of `link`, and `referenceType` the template's reference,
// which materialising resolves.
const registry: Record<
  string,
  Array<CollectionField & { help?: string; referenceType?: string }>
> = {
  blog: [
    {
      key: "title",
      label: "Title",
      kind: "text",
      required: true,
      isTitle: true,
    },
    {
      key: "summary",
      label: "Summary",
      kind: "textarea",
      help: "Shown in lists and previews.",
    },
    { key: "body", label: "Body", kind: "richtext", required: true },
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
  team: [
    { key: "name", label: "Name", kind: "text", required: true, isTitle: true },
    { key: "role", label: "Role", kind: "text" },
    { key: "bio", label: "Bio", kind: "textarea" },
    { key: "image", label: "Photo", kind: "image" },
  ],
  endorsements: [
    { key: "name", label: "Name", kind: "text", required: true, isTitle: true },
    { key: "title", label: "Title", kind: "text" },
    { key: "organization", label: "Organization", kind: "text" },
    { key: "quote", label: "Quote", kind: "textarea" },
    { key: "image", label: "Photo", kind: "image" },
  ],
  issues: [
    {
      key: "title",
      label: "Title",
      kind: "text",
      required: true,
      isTitle: true,
    },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "image", label: "Image", kind: "image" },
    { key: "link", label: "Learn-more link", kind: "url" },
  ],
  faq: [
    {
      key: "question",
      label: "Question",
      kind: "text",
      required: true,
      isTitle: true,
    },
    { key: "answer", label: "Answer", kind: "textarea", required: true },
  ],
  testimonials: [
    { key: "quote", label: "Quote", kind: "textarea", required: true },
    {
      key: "author",
      label: "Author",
      kind: "text",
      required: true,
      isTitle: true,
    },
    { key: "role", label: "Role", kind: "text" },
    { key: "image", label: "Photo", kind: "image" },
  ],
  categories: [
    { key: "name", label: "Name", kind: "text", required: true, isTitle: true },
    { key: "description", label: "Description", kind: "textarea" },
  ],
};

// The roles as field keys, so each template's pin reads at a glance.
const keysOf = (fields: CollectionField[]) => {
  const roles = pickRoles(fields);
  return {
    title: roles.title?.key,
    date: roles.date === "publishedAt" ? "publishedAt" : roles.date.key,
    image: roles.image?.key,
    body: roles.body?.key,
    summary: roles.summary?.key,
    rest: roles.rest.map(({ field, kind }) => `${field.key}:${kind}`),
    references: roles.references.map(({ key }) => key),
    unplaced: roles.unplaced.map(({ key }) => key),
  };
};

describe("pickRoles, for every curated template", () => {
  test("blog", () => {
    expect(keysOf(registry.blog)).toEqual({
      title: "title",
      date: "publishedOn",
      image: "cover",
      body: "body",
      // a summary only stands in for the body when there is none
      summary: undefined,
      rest: ["summary:textarea"],
      references: ["author"],
      unplaced: ["categories"],
    });
  });

  test("team", () => {
    expect(keysOf(registry.team)).toEqual({
      title: "name",
      date: "publishedAt",
      image: "image",
      body: undefined,
      summary: "bio",
      rest: ["role:text"],
      references: [],
      unplaced: [],
    });
  });

  test("endorsements", () => {
    expect(keysOf(registry.endorsements)).toEqual({
      title: "name",
      date: "publishedAt",
      image: "image",
      body: undefined,
      summary: "quote",
      rest: ["title:text", "organization:text"],
      references: [],
      unplaced: [],
    });
  });

  test("issues, whose legacy url field reads as a link", () => {
    expect(keysOf(registry.issues)).toEqual({
      title: "title",
      date: "publishedAt",
      image: "image",
      body: undefined,
      summary: "description",
      rest: ["link:link"],
      references: [],
      unplaced: [],
    });
  });

  test("faq", () => {
    expect(keysOf(registry.faq)).toEqual({
      title: "question",
      date: "publishedAt",
      image: undefined,
      body: undefined,
      summary: "answer",
      rest: [],
      references: [],
      unplaced: [],
    });
  });

  test("testimonials, whose title is not the first field", () => {
    expect(keysOf(registry.testimonials)).toEqual({
      title: "author",
      date: "publishedAt",
      image: "image",
      body: undefined,
      summary: "quote",
      rest: ["role:text"],
      references: [],
      unplaced: [],
    });
  });

  test("categories", () => {
    expect(keysOf(registry.categories)).toEqual({
      title: "name",
      date: "publishedAt",
      image: undefined,
      body: undefined,
      summary: "description",
      rest: [],
      references: [],
      unplaced: [],
    });
  });
});

describe("pickRoles, for a custom schema", () => {
  const custom: CollectionField[] = [
    { key: "headline", label: "Headline", kind: "text", isTitle: true },
    { key: "starts", label: "Starts", kind: "datetime" },
    { key: "ends", label: "Ends", kind: "date" },
    { key: "hero", label: "Hero", kind: "image" },
    { key: "gallery", label: "Gallery", kind: "image" },
    { key: "intro", label: "Intro", kind: "textarea" },
    { key: "story", label: "Story", kind: "richtext" },
    { key: "notes", label: "Notes", kind: "richtext" },
    { key: "contact", label: "Contact", kind: "email" },
    { key: "phone", label: "Phone", kind: "phone" },
    { key: "seats", label: "Seats", kind: "number" },
    {
      key: "level",
      label: "Level",
      kind: "option",
      options: [{ value: "a", label: "A" }],
    },
    { key: "site", label: "Site", kind: "link" },
    { key: "featured", label: "Featured", kind: "switch" },
    { key: "legacyFlag", label: "Legacy flag", kind: "boolean" },
    { key: "accent", label: "Accent", kind: "color" },
    {
      key: "host",
      label: "Host",
      kind: "reference",
      reference: { collectionSlug: "team", multiple: false },
    },
    {
      key: "tags",
      label: "Tags",
      kind: "multireference",
      reference: { collectionSlug: "tags", multiple: true },
    },
    { key: "future", label: "Future", kind: "hologram" },
  ];

  test("takes the first of each kind, and keeps the rest in schema order", () => {
    expect(keysOf(custom)).toEqual({
      title: "headline",
      date: "starts",
      image: "hero",
      body: "story",
      summary: undefined,
      rest: [
        "intro:textarea",
        "contact:email",
        "phone:phone",
        "seats:number",
        "level:option",
        "site:link",
      ],
      references: ["host"],
      unplaced: [
        "ends",
        "gallery",
        "notes",
        "featured",
        "legacyFlag",
        "accent",
        "tags",
        "future",
      ],
    });
  });

  test("a schema with no title field has no title role", () => {
    expect(
      pickRoles([{ key: "body", label: "Body", kind: "text" }]).title
    ).toBeUndefined();
  });
});
