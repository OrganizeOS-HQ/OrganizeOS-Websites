import { describe, expect, test } from "vitest";
import type { SerializedEditorState } from "lexical";
import { sameState } from "./rich-text-line-test-compare";

const text = (value: string) => ({
  type: "text",
  text: value,
  detail: 0,
  format: 0,
  mode: "normal",
  style: "",
  version: 1,
});
const rule = { type: "horizontalrule", version: 1 };
const state = (
  children: unknown[],
  direction: "ltr" | null = null
): SerializedEditorState =>
  ({
    root: {
      type: "root",
      direction,
      format: "",
      indent: 0,
      version: 1,
      children,
    },
  }) as unknown as SerializedEditorState;
const item = (children: unknown[]) => ({
  type: "listitem",
  direction: null,
  format: "",
  indent: 0,
  value: 1,
  version: 1,
  children,
});
const line = (children: unknown[]) => ({
  type: "cms-line",
  direction: null,
  format: "",
  indent: 0,
  version: 1,
  children,
});

describe("D7's comparator", () => {
  test("a state that differs only in direction is the same", () => {
    const paragraph = (direction: "ltr" | null) => ({
      type: "paragraph",
      direction,
      format: "",
      indent: 0,
      textFormat: 0,
      textStyle: "",
      version: 1,
      children: [text("T0w")],
    });
    expect(
      sameState(
        state([paragraph("ltr")], "ltr"),
        state([paragraph(null)], null)
      )
    ).toBe(true);
  });

  test("an empty line left in one state is the same", () => {
    expect(
      sameState(
        state([item([text("T0w"), rule])]),
        state([item([text("T0w"), rule, line([])])])
      )
    ).toBe(true);
  });

  test("a line holding a line break is content", () => {
    expect(
      sameState(
        state([item([text("T0w"), rule])]),
        state([
          item([text("T0w"), rule, line([{ type: "linebreak", version: 1 }])]),
        ])
      )
    ).toBe(false);
  });

  test("different text is different", () => {
    expect(
      sameState(state([item([text("T0w")])]), state([item([text("T0x")])]))
    ).toBe(false);
  });

  test("the order of keys does not matter", () => {
    const reordered = Object.fromEntries(Object.entries(text("T0w")).reverse());
    expect(
      sameState(state([item([text("T0w")])]), state([item([reordered])]))
    ).toBe(true);
  });
});
