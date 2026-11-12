import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  chunk,
  emptyItemData,
  formatPageRange,
  getChangedFieldKeys,
  getKeptDifferences,
  getStatusChip,
  getTitleField,
  getToastText,
  isItemDirty,
  isoToLocalInput,
  keepAside,
  localInputToIso,
  slugFollowsTitle,
  slugify,
  toItemData,
  validateItem,
} from "./cms-logic";
import type { CmsField } from "./cms-source";
import { POSTS_DETAIL } from "./fake-cms-source";

describe("getStatusChip", () => {
  test.each([
    ["draft", false, "Draft", "neutral"],
    ["published", false, "Published", "outline"],
    ["published", true, "Staged changes", "purple"],
    ["archived", false, "Archived", "outline"],
  ] as const)(
    "%s (staged %s) is %s, %s",
    (status, hasStagedChanges, label, color) =>
      expect(getStatusChip({ status, hasStagedChanges })).toEqual({
        label,
        color,
      })
  );

  test("staged changes only count on a published item", () => {
    expect(
      getStatusChip({ status: "draft", hasStagedChanges: true }).label
    ).toBe("Draft");
  });
});

describe("slugify", () => {
  test("follows the platform's rule", () => {
    expect(slugify("Safe Staffing Now")).toBe("safe-staffing-now");
    expect(slugify("  Café --- Workers' Rally! ")).toBe("cafe-workers-rally");
    expect(slugify("Bargaining update: session 12")).toBe(
      "bargaining-update-session-12"
    );
    expect(slugify("")).toBe("item");
    expect(slugify("!!!", "campaign")).toBe("campaign");
  });

  test("caps at 48 characters with no trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(47)} b`);
    expect(slug).toBe("a".repeat(47));
    expect(slugify("word ".repeat(20)).length).toBeLessThanOrEqual(48);
  });
});

describe("slugFollowsTitle", () => {
  test("a new item follows its title", () => {
    expect(slugFollowsTitle({ isNew: true, slug: "", title: "" })).toBe(true);
  });

  test("an item follows while its address equals the derivation", () => {
    expect(
      slugFollowsTitle({
        isNew: false,
        slug: "fair-contract-2027",
        title: "Fair Contract 2027",
      })
    ).toBe(true);
    expect(
      slugFollowsTitle({
        isNew: false,
        slug: "contract",
        title: "Fair Contract 2027",
      })
    ).toBe(false);
  });
});

const fields: CmsField[] = [
  { key: "name", label: "Name", kind: "text", isTitle: true, required: true },
  { key: "summary", label: "Summary", kind: "textarea" },
  { key: "featured", label: "Featured", kind: "switch" },
  { key: "tags", label: "Tags", kind: "multireference" },
  { key: "cover", label: "Cover", kind: "image" },
  { key: "contact", label: "Contact", kind: "email" },
];

describe("dirty tracking", () => {
  const baseline = {
    name: "Fair Contract 2027",
    summary: null,
    featured: false,
    tags: ["a"],
    cover: { url: "https://example.com/a.png", alt: "", width: 1, height: 1 },
    contact: null,
  };

  test("loaded values are clean", () => {
    expect(
      isItemDirty({
        fields,
        baseline,
        values: structuredClone(baseline),
        baselineSlug: "fair-contract-2027",
        slug: "fair-contract-2027",
      })
    ).toBe(false);
  });

  test("blank and unset are one value", () => {
    expect(
      getChangedFieldKeys(fields, baseline, { ...baseline, summary: "" })
    ).toEqual([]);
    expect(
      getChangedFieldKeys(fields, baseline, { ...baseline, summary: undefined })
    ).toEqual([]);
  });

  test("a changed field, list or object is dirty, in schema order", () => {
    expect(
      getChangedFieldKeys(fields, baseline, {
        ...baseline,
        cover: { ...baseline.cover, alt: "Members at the rally" },
        tags: ["a", "b"],
        name: "Fair Contract",
      })
    ).toEqual(["name", "tags", "cover"]);
  });

  test("an edited address alone is dirty", () => {
    expect(
      isItemDirty({
        fields,
        baseline,
        values: baseline,
        baselineSlug: "fair-contract-2027",
        slug: "contract",
      })
    ).toBe(true);
  });
});

describe("formatPageRange", () => {
  test("shows the range and the total", () => {
    expect(formatPageRange(1, 50, 120)).toBe("1-50 of 120");
    expect(formatPageRange(3, 50, 120)).toBe("101-120 of 120");
    expect(formatPageRange(1, 50, 0)).toBe("");
  });
});

describe("datetime, in a fixed zone", () => {
  const zone = process.env.TZ;
  beforeAll(() => {
    // 5 hours behind UTC in November
    process.env.TZ = "America/New_York";
  });
  afterAll(() => {
    process.env.TZ = zone;
  });

  test("converts to and from the browser's zone", () => {
    expect(isoToLocalInput("2026-11-17T22:00:00.000Z")).toBe(
      "2026-11-17T17:00"
    );
    expect(localInputToIso("2026-11-17T17:00")).toBe(
      "2026-11-17T22:00:00.000Z"
    );
  });

  test("empty is null, and garbage is empty", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput("not a date")).toBe("");
    expect(localInputToIso("")).toBe(null);
  });
});

describe("validateItem", () => {
  test("words each error in a few words", () => {
    expect(
      validateItem({
        fields,
        values: { name: "", contact: "not-an-email", featured: false },
        slug: "Bad Address",
        isNew: false,
      })
    ).toEqual({
      name: "Required",
      contact: "Not an email",
      slug: "Not an address",
    });
  });

  test("an existing item's address is required; a new one's is derived", () => {
    const values = { name: "Fair Contract 2027" };
    expect(validateItem({ fields, values, slug: "", isNew: false }).slug).toBe(
      "Required"
    );
    expect(
      validateItem({ fields, values, slug: "", isNew: true }).slug
    ).toBeUndefined();
  });

  test("maxLength applies where the platform applies it, and never hides an earlier error", () => {
    const capped: CmsField[] = [
      { key: "name", label: "Name", kind: "text", maxLength: 5 },
      { key: "site", label: "Site", kind: "link", maxLength: 5 },
      { key: "mail", label: "Mail", kind: "email", maxLength: 5 },
    ];
    expect(
      validateItem({
        fields: capped,
        values: {
          name: "Too long a name",
          site: "https://eastbrookworkers.example",
          mail: "not an email at all",
        },
        slug: "item",
        isNew: false,
      })
    ).toEqual({ name: "Too long", mail: "Not an email" });
  });
});

describe("canonical kinds", () => {
  test("link and switch take their empty values, and the title field is found", () => {
    const fields: CmsField[] = [
      { key: "name", label: "Name", kind: "text", isTitle: true },
      { key: "source", label: "Source", kind: "link" },
      { key: "urgent", label: "Urgent", kind: "switch" },
    ];
    expect(emptyItemData(fields)).toEqual({
      name: null,
      source: null,
      urgent: false,
    });
    expect(getTitleField(fields)?.key).toBe("name");
  });
});

describe("the data a write sends", () => {
  const body: CmsField = { key: "body", label: "Body", kind: "richtext" };
  const image = '<p><img src="https://x/a.png" /></p>';

  test("toItemData sends the schema's keys only, a missing one at its empty value", () =>
    expect(toItemData(POSTS_DETAIL.fields, { title: "A", old: "x" })).toEqual({
      title: "A",
      summary: null,
      author: null,
    }));

  test("toItemData sends rich text as { html }, and null without text or image", () => {
    expect(
      toItemData([body], { body: { html: "<p>a</p>", text: "a" } })
    ).toEqual({ body: { html: "<p>a</p>" } });
    expect(toItemData([body], { body: { html: "<p></p>", text: "" } })).toEqual(
      { body: null }
    );
    expect(toItemData([body], { body: { html: image, text: "" } })).toEqual({
      body: { html: image },
    });
    expect(toItemData([body], { body: null })).toEqual({ body: null });
  });

  test("a required image-only rich-text field passes validateItem", () => {
    const required: CmsField[] = [{ ...body, required: true }];
    expect(
      validateItem({
        fields: required,
        values: { body: { html: image, text: "" } },
        slug: "item",
        isNew: false,
      })
    ).toEqual({});
    expect(
      validateItem({
        fields: required,
        values: { body: { html: "<p></p>", text: "" } },
        slug: "item",
        isNew: false,
      })
    ).toEqual({ body: "Required" });
  });
});

describe("kept values", () => {
  const baseline = { name: "Theirs", summary: "Their summary" };

  test("Reload sets the person's values aside, and they count until used", () => {
    const kept = keepAside({
      fields,
      kept: undefined,
      baseline,
      baselineSlug: "theirs",
      values: { name: "Mine", summary: "Their summary" },
      slug: "mine",
    });
    // after Reload the editor shows the platform's values
    expect(
      getKeptDifferences({
        fields,
        kept,
        values: { name: "Theirs", summary: "Their summary" },
        slug: "theirs",
      })
    ).toEqual(["name", "slug"]);
    // "Use my edit" on both: nothing differs
    expect(
      getKeptDifferences({
        fields,
        kept,
        values: { name: "Mine", summary: "Their summary" },
        slug: "mine",
      })
    ).toEqual([]);
  });

  test("a second Reload keeps an edit still waiting for Use my edit", () => {
    const first = { values: { name: "Mine", summary: "Mine too" }, slug: "x" };
    const second = keepAside({
      fields,
      kept: first,
      baseline,
      baselineSlug: "theirs",
      // the person changed only the summary since the first Reload
      values: { name: "Theirs", summary: "Newer" },
      slug: "theirs",
    });
    expect(second.values.name).toBe("Mine");
    expect(second.values.summary).toBe("Newer");
    expect(second.slug).toBe("x");
  });
});

describe("chunk", () => {
  test("splits E5's ids into calls of at most 100", () => {
    const ids = Array.from({ length: 201 }, (_, index) => String(index));
    expect(chunk(ids, 100).map((part) => part.length)).toEqual([100, 100, 1]);
    expect(chunk([], 100)).toEqual([]);
  });
});

describe("getToastText", () => {
  test("refused waits a minute, as the other transient codes", () => {
    expect(getToastText("refused")).toBe("Try again in a minute");
    expect(getToastText("unavailable")).toBe("Try again in a minute");
  });
});
