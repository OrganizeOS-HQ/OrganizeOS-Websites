import { describe, expect, test } from "vitest";
import {
  formatPageRange,
  getChangedFieldKeys,
  getStatusChip,
  isItemDirty,
  isoToLocalInput,
  localInputToIso,
  slugFollowsTitle,
  slugify,
  validateItem,
} from "./cms-logic";
import type { CmsField } from "./cms-source";

describe("getStatusChip", () => {
  test("maps the live status and staged changes", () => {
    expect(getStatusChip({ status: "draft", hasStagedChanges: false })).toEqual(
      { label: "Draft", color: "neutral" }
    );
    expect(
      getStatusChip({ status: "published", hasStagedChanges: false })
    ).toEqual({ label: "Published", color: "green" });
    expect(
      getStatusChip({ status: "published", hasStagedChanges: true })
    ).toEqual({ label: "Staged changes", color: "purple" });
    expect(
      getStatusChip({ status: "archived", hasStagedChanges: false })
    ).toEqual({ label: "Archived", color: "neutral" });
  });

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

describe("datetime", () => {
  test("round-trips through the local input", () => {
    const iso = "2026-11-17T22:00:00.000Z";
    expect(localInputToIso(isoToLocalInput(iso))).toBe(iso);
    expect(isoToLocalInput(null)).toBe("");
    expect(localInputToIso("")).toBe(null);
  });
});

describe("validateItem", () => {
  test("words each error in a few words", () => {
    expect(
      validateItem(
        fields,
        { name: "", contact: "not-an-email", featured: false },
        "Bad Address"
      )
    ).toEqual({
      name: "Required",
      contact: "Not an email",
      slug: "Not an address",
    });
  });
});
