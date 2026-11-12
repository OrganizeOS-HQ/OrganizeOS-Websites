import { describe, expect, test } from "vitest";
import roundTrip from "./__fixtures__/rich-text-roundtrip.json";
import { getKeptDifferences, isSameStoredValue, keepAside } from "./cms-logic";
import type { CmsField } from "./cms-source";

type Case = { name: string; editor: string; stored: string | null };

const cases = (roundTrip.cases as Case[]).filter(
  (entry): entry is Case & { stored: string } => entry.stored !== null
);

describe("rich text in the stored form", () => {
  test.each(cases.map((entry) => [entry.name, entry] as const))(
    "%s: the editor's HTML equals what the platform stored",
    (_name, entry) =>
      expect(
        isSameStoredValue(
          "richtext",
          { html: entry.editor },
          { html: entry.stored }
        )
      ).toBe(true)
  );

  test.each([
    ["<p>x</p>", "<p><strong>x</strong></p>"],
    ["<p>x</p>", "<h2>x</h2>"],
    ['<p><a href="/a">x</a></p>', '<p><a href="/b">x</a></p>'],
    ["<p>x</p>", "<p>y</p>"],
  ])("%s differs from %s", (left, right) =>
    expect(isSameStoredValue("richtext", { html: left }, { html: right })).toBe(
      false
    )
  );

  test("attributes outside the platform's allowlist and spans never differ", () =>
    expect(
      isSameStoredValue(
        "richtext",
        {
          html: '<p class="a" dir="ltr"><span style="white-space: pre-wrap;">x</span></p>',
        },
        { html: "<p>x</p>" }
      )
    ).toBe(true));

  test("a rich-text edit the platform stored sanitised is no kept difference", () => {
    const fields: CmsField[] = [
      { key: "body", label: "Body", kind: "richtext" },
    ];
    const kept = keepAside({
      fields,
      kept: undefined,
      baseline: { body: { html: "<p>One</p>", text: "One" } },
      baselineSlug: "a",
      values: {
        body: {
          html: '<p><span style="white-space: pre-wrap;">Two</span></p>',
        },
      },
      slug: "a",
    });
    expect(kept.values).toHaveProperty("body");
    expect(
      getKeptDifferences({
        fields,
        kept,
        values: { body: { html: "<p>Two</p>", text: "Two" } },
        slug: "a",
      })
    ).toEqual([]);
  });
});
