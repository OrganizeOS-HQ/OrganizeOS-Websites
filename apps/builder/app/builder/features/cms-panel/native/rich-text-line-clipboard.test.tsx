import { afterEach, describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { cdp, commands, userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COPY_COMMAND,
  type ElementNode,
  type LexicalNode,
  type PointType,
  type RangeSelection,
  type TextNode,
} from "lexical";
import { $isCmsLineNode } from "./rich-text-line-node";
import { comparableState, sameState } from "./rich-text-line-test-compare";
import {
  $rangeOracle,
  IMG,
  at,
  backspace,
  caretKey,
  clipboard,
  copy,
  cut,
  del,
  doubleClick,
  expectEdit,
  expectSameLines,
  type Held,
  keys,
  LI,
  letter,
  mount,
  mountExtraField,
  pasteClip,
  range,
  rangeToLineStart,
  short,
  type Step,
  then,
} from "./rich-text-line-test-kit";
import { forcedFailure, undoDepth } from "./rich-text-line-test-kit-branch";
import {
  editable,
  editorOf,
  expectFixedPoint,
  lastHtml,
  plain,
  settle,
} from "./rich-text-test-harness";
import { exportRichTextHtml } from "./rich-text-html";
import {
  type Case,
  placeRange,
  UNLINED_CASES,
} from "./rich-text-line-writer-cases";
import fixture1511CopyJson from "./__fixtures__/rich-text-line-base-1511-copy.json";
import { ITEM_NOT_WHOLE_MARK } from "./rich-text-line-clipboard";

declare module "@vitest/browser/context" {
  interface BrowserCommands {
    grantClipboard: () => Promise<void>;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

type Parts = { p: Held; h: Held; s: Held };

/** The oracle's P, H and S of the committed range: before it, in it, after it. */
const oracleParts = (): Parts =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection() as RangeSelection;
      expect($isRangeSelection(selection)).toBe(true);
      const h = $rangeOracle(selection);
      const [first, last] =
        h.order === "backward"
          ? [selection.focus, selection.anchor]
          : [selection.anchor, selection.focus];
      const root = $getRoot();
      const span = (
        from: Pick<PointType, "key" | "offset" | "type">,
        to: Pick<PointType, "key" | "offset" | "type">
      ) => {
        const between = $createRangeSelection();
        between.anchor.set(from.key, from.offset, from.type);
        between.focus.set(to.key, to.offset, to.type);
        return $rangeOracle(between);
      };
      const start = { key: root.getKey(), offset: 0, type: "element" as const };
      const end = {
        key: root.getKey(),
        offset: root.getChildrenSize(),
        type: "element" as const,
      };
      return { p: span(start, first), h, s: span(last, end) };
    });

/** The oracle of the whole committed document. */
const documentHeld = (): Held =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const root = $getRoot();
      const all = $createRangeSelection();
      all.anchor.set(root.getKey(), 0, "element");
      all.focus.set(root.getKey(), root.getChildrenSize(), "element");
      return $rangeOracle(all);
    });

/** The removal took exactly the range's content, and the clipboard holds it. */
const expectExactCut = (before: Parts) => {
  const after = documentHeld();
  expect(after.text, "the document keeps P and S").toBe(
    before.p.text + before.s.text
  );
  expect(after.images, "images").toBe(before.p.images + before.s.images);
  expect(after.rules, "rules").toBe(before.p.rules + before.s.rules);
  const held = clipboard();
  expect(held["text/plain"]?.replace(/\n/g, ""), "text/plain").toBe(
    before.h.text
  );
  expect(held["text/html"] ?? "", "text/html written").not.toBe("");
};

const shiftRightUntil =
  (focus: string): Step =>
  async () => {
    for (let press = 0; press < 14; press += 1) {
      if (caretKey().endsWith(`|${focus}`)) {
        return;
      }
      await keys("{Shift>}{ArrowRight}{/Shift}")();
    }
    expect(caretKey(), "the walk's focus").toMatch(new RegExp(`\\|${focus}$`));
  };

describe("the one cut handler (T11.1, T11.2, T11.5; T12.3)", () => {
  const cells: Array<{
    name: string;
    stored: string;
    place: Step;
    write?: string;
    plainText?: string;
  }> = [
    {
      name: "ab from abac",
      stored: "<p>abac</p>",
      place: range("abac", 0, "abac", 2),
      write: "<p>ac</p>",
      plainText: "ab",
    },
    {
      name: "the from the theme",
      stored: "<p>the theme</p>",
      place: range("the theme", 0, "the theme", 4),
      write: "<p>theme</p>",
      plainText: "the ",
    },
    {
      name: "ab from xabay",
      stored: "<p>xabay</p>",
      place: range("xabay", 1, "xabay", 3),
      write: "<p>xay</p>",
      plainText: "ab",
    },
    {
      name: "ab from abac, backward",
      stored: "<p>abac</p>",
      place: range("abac", 2, "abac", 0),
      write: "<p>ac</p>",
      plainText: "ab",
    },
    {
      name: "across two items",
      stored: "<ul><li>ab</li><li>ca</li></ul>",
      place: range("ab", 1, "ca", 1),
      write: "<ul><li>aa</li></ul>",
    },
    {
      name: "X6 lined item aba cut ab",
      stored: "<ul><li>T0w<blockquote><p>Q1w</p></blockquote>aba</li></ul>",
      place: range("aba", 0, "aba", 2),
      write: "<ul><li>T0w<blockquote><p>Q1w</p></blockquote>a</li></ul>",
      plainText: "ab",
    },
    {
      name: "the Shift walk from Pw to the start of Q2w",
      stored:
        "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr><blockquote><p>Q2w</p></blockquote></li></ul>",
      place: async () => {
        await at("Pw", 0)();
        await shiftRightUntil("text:Q2w@0")();
      },
    },
  ];

  for (const cell of cells) {
    test(`16.4: a valid cut is never refused: ${cell.name}`, async () => {
      if (cell.write !== undefined) {
        await expectEdit({
          stored: cell.stored,
          place: cell.place,
          action: cutChecked,
          write: cell.write,
          source: "check 5, 16.4; T11.1",
        });
      } else {
        // the walk: its write is the oracle's, checked below
        const onChange = await mount(cell.stored);
        await cell.place();
        const before = oracleParts();
        const errors: string[] = [];
        vi.spyOn(console, "error").mockImplementation((...args) => {
          const text = args.map(String).join(" ");
          if (text.includes("not wrapped in act") === false) {
            errors.push(text);
          }
        });
        onChange.mockClear();
        await cutChecked();
        expect(onChange.mock.calls.length, "calls").toBe(1);
        expect(errors, "console errors").toEqual([]);
        expect(plain(lastHtml(onChange))).not.toBe(plain(cell.stored));
        expectExactCut(before);
        return;
      }
      if (cell.plainText !== undefined) {
        expect(clipboard()["text/plain"], "text/plain").toBe(cell.plainText);
      }
      expect(clipboard()["text/html"] ?? "", "text/html written").not.toBe("");
    });
  }

  for (const cell of cells) {
    test(`16.4: the removal is exact by the oracle: ${cell.name}`, async () => {
      await mount(cell.stored);
      await cell.place();
      const before = oracleParts();
      await cutChecked();
      expectExactCut(before);
    });
  }

  for (const stored of [
    "<p>abac</p><p>Zw</p>",
    "<p>abac</p><pre><code>C0w</code></pre><p>Zw</p>",
  ]) {
    test(`a failed cut check acts as a copy: ${stored}`, async () => {
      // a copy of the same range, for its three formats
      await mount(stored);
      await range("abac", 0, "abac", 2)();
      await copyChecked();
      const copied = clipboard();
      // the forced failure changes Zw, outside the range, in the cut's
      // removal
      forcedFailure("cut-removal-differs");
      const onChange = await mount(stored);
      await range("abac", 0, "abac", 2)();
      const valueBefore = exportRichTextHtml(editorOf()!);
      const caretBefore = caretKey();
      const depthBefore = undoDepth();
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        const text = args.map(String).join(" ");
        if (text.includes("not wrapped in act") === false) {
          errors.push(text);
        }
      });
      onChange.mockClear();
      await cutChecked();
      expect(onChange.mock.calls.length, "no onChange").toBe(0);
      expect(exportRichTextHtml(editorOf()!), "nothing removed").toBe(
        valueBefore
      );
      expect(undoDepth(), "no undo step").toEqual(depthBefore);
      expect(caretKey(), "the selection as it was").toBe(caretBefore);
      expect(errors.length, "the development assertion, once").toBe(1);
      expect(errors[0]).toContain("does not take what its clipboard holds");
      expect(clipboard(), "the clipboard of a copy").toEqual(copied);
      // the next letter writes what it writes over the range with no cut
      await letter();
      const typed = plain(lastHtml(onChange));
      vi.restoreAllMocks();
      const fresh = await mount(stored);
      await range("abac", 0, "abac", 2)();
      await letter();
      expect(typed, "the next letter").toBe(plain(lastHtml(fresh)));
    });
  }

  for (const key of ["x", "c"]) {
    test(`16.3, 16.9: Ctrl+${key} at a caret leaves the clipboard as it was`, async () => {
      await commands.grantClipboard();
      const onChange = await mount("<p>Pw</p>");
      await at("Pw", 1)();
      await navigator.clipboard.writeText("Zz");
      const valueBefore = exportRichTextHtml(editorOf()!);
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        const text = args.map(String).join(" ");
        if (text.includes("not wrapped in act") === false) {
          errors.push(text);
        }
      });
      onChange.mockClear();
      await userEvent.keyboard(`{Control>}${key}{/Control}`);
      await settle();
      expect(await navigator.clipboard.readText(), "the clipboard").toBe("Zz");
      expect(errors, "console errors").toEqual([]);
      expect(onChange.mock.calls.length, "no onChange").toBe(0);
      expect(exportRichTextHtml(editorOf()!), "the value").toBe(valueBefore);
    });
  }

  // 15.10's one-press range (base-1510's `end` anchor): a click on Pw,
  // {End}, one Shift+ArrowRight; the range holds nothing
  for (const stored of [
    "<blockquote><p>Pw</p></blockquote><hr><p>Nw</p>",
    "<ul><li>Pw</li></ul><hr><p>Nw</p>",
    "<blockquote><p>Pw</p></blockquote><hr>",
    `<blockquote><p>Pw${IMG}</p></blockquote><hr><p>Nw</p>`,
  ]) {
    for (const key of ["x", "c"]) {
      test(`16.3, 16.9: Ctrl+${key} over 15.10's one-press range leaves the clipboard as it was: ${stored}`, async () => {
        await commands.grantClipboard();
        const onChange = await mount(stored);
        await at("Pw", 1)();
        await keys("{End}")();
        await keys("{Shift>}{ArrowRight}{/Shift}")();
        expect(caretKey(), "the focus past the block's end").toMatch(
          /\|element:root@1$/
        );
        const caretBefore = caretKey();
        await navigator.clipboard.writeText("Zz");
        const valueBefore = exportRichTextHtml(editorOf()!);
        const errors: string[] = [];
        vi.spyOn(console, "error").mockImplementation((...args) => {
          const text = args.map(String).join(" ");
          if (text.includes("not wrapped in act") === false) {
            errors.push(text);
          }
        });
        onChange.mockClear();
        await userEvent.keyboard(`{Control>}${key}{/Control}`);
        await settle();
        expect(await navigator.clipboard.readText(), "the clipboard").toBe(
          "Zz"
        );
        expect(errors, "console errors").toEqual([]);
        expect(onChange.mock.calls.length, "no onChange").toBe(0);
        expect(exportRichTextHtml(editorOf()!), "the value").toBe(valueBefore);
        expect(caretKey(), "the selection stays").toBe(caretBefore);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Task 18: one writer for every range (D6, V13, F7, FS6, FS9; T10.9, T11.21)

/** The head's clipboards, measured at `<base>` (Task 5; M records) and P29's as ruled. */
const RECORDED = {
  M41a: {
    "text/plain": "T0w\n\nQ2w",
    "text/html":
      '<span style="white-space: pre-wrap;">T0w</span><hr><blockquote class="c-fraHYm c-dyRBZJ" dir="ltr"><p class="c-fraHYm" dir="ltr"><span style="white-space: pre-wrap;">Q2w</span></p></blockquote>',
    "application/x-lexical-editor":
      '{"namespace":"cms-rich-text-kit","nodes":[{"detail":0,"format":0,"mode":"normal","style":"","text":"T0w","type":"text","version":1},{"type":"horizontalrule","version":1},{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Q2w","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":"ltr","format":"","indent":0,"type":"quote","version":1}]}',
  },
  M41b: {
    "text/plain": "T0w\n\nQ2w",
    "text/html":
      '<span style="white-space: pre-wrap;">T0w</span><hr><blockquote class="c-fraHYm c-dyRBZJ" dir="ltr"><p class="c-fraHYm" dir="ltr"><span style="white-space: pre-wrap;">Q2w</span></p></blockquote>',
    "application/x-lexical-editor":
      '{"namespace":"cms-rich-text-kit","nodes":[{"detail":0,"format":0,"mode":"normal","style":"","text":"T0w","type":"text","version":1},{"type":"horizontalrule","version":1},{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Q2w","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":"ltr","format":"","indent":0,"type":"quote","version":1}]}',
  },
  M42a: {
    "text/plain": "Aw\n\n\nBw",
    "text/html":
      '<p class="c-fraHYm" dir="ltr"><span style="white-space: pre-wrap;">Aw</span></p><p class="c-fraHYm" dir="ltr"><br></p><p class="c-fraHYm" dir="ltr"><span style="white-space: pre-wrap;">Bw</span></p>',
    "application/x-lexical-editor":
      '{"namespace":"cms-rich-text-kit","nodes":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Aw","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""},{"children":[{"type":"linebreak","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Bw","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}]}',
  },
  M42b: {
    "text/plain": "T0w\nQ1w",
    "text/html":
      '<span style="white-space: pre-wrap;">T0w</span><blockquote class="c-fraHYm c-dyRBZJ" dir="ltr"><p class="c-fraHYm" dir="ltr"><span style="white-space: pre-wrap;">Q1w</span></p></blockquote>',
    "application/x-lexical-editor":
      '{"namespace":"cms-rich-text-kit","nodes":[{"detail":0,"format":0,"mode":"normal","style":"","text":"T0w","type":"text","version":1},{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Q1w","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":"ltr","format":"","indent":0,"type":"quote","version":1}]}',
  },
  M59: {
    "text/plain": "Q0w\n\n\nNw",
    "text/html":
      '<ul class="c-fraHYm c-UzEEt"><li value="1"><blockquote class="c-fraHYm c-dyRBZJ" dir="ltr"><p class="c-fraHYm" dir="ltr"><span style="white-space: pre-wrap;">Q0w</span></p></blockquote><br></li><li value="2"><span style="white-space: pre-wrap;">Nw</span></li></ul>',
    "application/x-lexical-editor":
      '{"namespace":"cms-rich-text-kit","nodes":[{"children":[{"children":[{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Q0w","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":"ltr","format":"","indent":0,"type":"quote","version":1},{"type":"linebreak","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Nw","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":2}],"direction":"ltr","format":"","indent":0,"type":"list","version":1,"listType":"bullet","start":1,"tag":"ul"}]}',
  },
  M61: {
    "text/plain": "C0w\n",
    "text/html": "<pre><code>C0w</code></pre>",
    "application/x-lexical-editor":
      '{"namespace":"cms-rich-text-kit","nodes":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"C0w","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"code","version":1,"language":null}]}',
  },
  P29: {
    "text/plain": "\n",
    "text/html":
      '<blockquote class="c-fraHYm c-dyRBZJ" dir="ltr"><p class="c-fraHYm" dir="ltr"><span style="white-space: pre-wrap;"></span></p></blockquote>',
    "application/x-lexical-editor":
      '{"namespace":"cms-rich-text-kit","nodes":[{"children":[{"children":[],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":"ltr","format":"","indent":0,"type":"quote","version":1}]}',
  },
} as const;

const EDITOR_DATA = "application/x-lexical-editor";

/** The editor data's nodes, compared under D7. */
const dataNodes = (json: string | undefined) =>
  comparableState({
    root: { children: JSON.parse(json ?? "{}").nodes ?? [] },
  } as never);

/** The three formats equal the record's. */
const expectFormats = (
  held: Record<string, string>,
  record: Record<string, string>
) => {
  expect(held["text/html"], "text/html").toBe(record["text/html"]);
  expect(dataNodes(held[EDITOR_DATA]), "the editor data").toEqual(
    dataNodes(record[EDITOR_DATA])
  );
  expect(held["text/plain"], "text/plain").toBe(record["text/plain"]);
};

/** The editor data holds no line (D6), checked after every copy and cut of this file. */
const expectNoLine = () => {
  const json = clipboard()[EDITOR_DATA];
  if (json !== undefined) {
    expect(json, "the editor data holds no line").not.toContain(
      '"type":"cms-line"'
    );
  }
  expect(
    clipboard()["text/html"] ?? "",
    "no line leaves the field"
  ).not.toContain("data-cms-line");
};

/** A copy: no onChange, no undo step, the selection as it was; no line in the data. */
const copyKeeps =
  (onChange?: ReturnType<typeof vi.fn>): Step =>
  async () => {
    const value = exportRichTextHtml(editorOf()!);
    const caret = caretKey();
    const depth = undoDepth();
    const calls = onChange?.mock.calls.length;
    await copy();
    expect(exportRichTextHtml(editorOf()!), "a copy changes nothing").toBe(
      value
    );
    expect(caretKey(), "the selection as it was").toBe(caret);
    expect(undoDepth(), "no undo step").toEqual(depth);
    if (onChange !== undefined) {
      expect(onChange.mock.calls.length, "no onChange").toBe(calls);
    }
    expectNoLine();
  };
const copyChecked = copyKeeps();
const cutChecked: Step = async () => {
  await cut();
  expectNoLine();
};

const shiftRight = keys("{Shift>}{ArrowRight}{/Shift}");
const MIXED = LI("T0w<hr><blockquote><p>Q2w</p></blockquote>");
const FS9 = "<ul><li><blockquote><p>Q0w</p></blockquote><br></li></ul>";
const FS9_ITEM =
  "<ul><li><blockquote><p>Q0w</p></blockquote><br></li><li>Iw</li></ul>";
const CODE_LINE =
  "<ul><li><pre><code>C0w</code></pre><br></li><li>Nw</li></ul>";
const fs9Place = then(at("Q0w"), shiftRight);

describe("Task 18: the one writer (D6, V13, F7, FS9)", () => {
  test("V13: a copy of a whole mixed item carries the head's HTML and editor data", async () => {
    const onChange = await mount(MIXED);
    await range("T0w", 0, "Q2w", 3)();
    await copyKeeps(onChange)();
    expectFormats(clipboard(), RECORDED.M41a);
    expect(clipboard()["text/plain"]).toBe("T0w\n\nQ2w");
  });

  test("V13: the same cut", async () => {
    await expectEdit({
      stored: MIXED,
      place: range("T0w", 0, "Q2w", 3),
      action: cutChecked,
      write: "<ul><li>Pw</li><li></li><li>Nw</li></ul>",
      source: "from M41b; check V13",
    });
    expectFormats(clipboard(), RECORDED.M41b);
  });

  test("V13: a backward copy", async () => {
    const onChange = await mount(MIXED);
    await range("Q2w", 3, "T0w", 0)();
    await copyKeeps(onChange)();
    expectFormats(clipboard(), RECORDED.M41a);
    expect(clipboard()["text/plain"]).toBe("T0w\n\nQ2w");
  });

  test("V13: a backward cut", async () => {
    await expectEdit({
      stored: MIXED,
      place: range("Q2w", 3, "T0w", 0),
      action: cutChecked,
      write: "<ul><li>Pw</li><li></li><li>Nw</li></ul>",
      source: "from M41b; check V13, both directions",
    });
    expectFormats(clipboard(), RECORDED.M41b);
  });

  test("a copy the head writes with three new lines keeps them", async () => {
    const onChange = await mount("<p>Aw</p><p><br></p><p>Bw</p>");
    await at("Aw", 1)();
    await keys("{Control>}a{/Control}")();
    await copyKeeps(onChange)();
    expect(clipboard()["text/plain"]).toBe(RECORDED.M42a["text/plain"]);
  });

  test("a copy across a quote, a trailing line break and the next item keeps the head's new lines", async () => {
    const onChange = await mount(
      "<ul><li><blockquote><p>Q0w</p></blockquote><br></li><li>Nw</li></ul>"
    );
    await range("Q0w", 0, "Nw", 2)();
    expect(
      editorOf()!
        .getEditorState()
        .read(() => $getSelection()!.getNodes().some($isCmsLineNode)),
      "the selection holds a line"
    ).toBe(true);
    await copyKeeps(onChange)();
    expect(clipboard()["text/plain"]).toBe(RECORDED.M59["text/plain"]);
  });

  test("D6: a selection that ends at a line's start holds nothing of that line", async () => {
    const onChange = await mount(CODE_LINE);
    await rangeToLineStart("C0w", 0)();
    await copyKeeps(onChange)();
    expectFormats(clipboard(), RECORDED.M61);
  });

  test("D6: a selection extended by keys to a line's start holds nothing of that line", async () => {
    const onChange = await mount(CODE_LINE);
    await at("C0w", 0)();
    for (let press = 0; press < 5; press += 1) {
      if (caretKey().endsWith("|element:listitem@1")) {
        break;
      }
      await shiftRight();
    }
    expect(caretKey(), "the line's start").toMatch(/\|element:listitem@1$/);
    await copyKeeps(onChange)();
    expectFormats(clipboard(), RECORDED.M61);
  });

  test("F7: one new line between a line and the block beside it", async () => {
    const onChange = await mount(LI("T0w<blockquote><p>Q1w</p></blockquote>"));
    await range("T0w", 0, "Q1w", 3)();
    await copyKeeps(onChange)();
    const head = RECORDED.M42b["text/plain"];
    expect(clipboard()["text/plain"]).toBe(
      head.includes("T0w\nQ1w") ? head : head.replace("T0wQ1w", "T0w\nQ1w")
    );
  });

  for (const stored of [FS9, FS9_ITEM]) {
    test(`FS9: a copy by keys at a line's edge is the quote's shell: ${stored}`, async () => {
      const onChange = await mount(stored);
      await fs9Place();
      expect(caretKey(), "the selection starts at the end of Q0w").toMatch(
        /^text:Q0w@3\|/
      );
      await copyKeeps(onChange)();
      const held = clipboard();
      expect(held["text/html"], "P29's text/html").toBe(
        RECORDED.P29["text/html"]
      );
      expect(held["text/plain"], "P29's text/plain").toBe(
        RECORDED.P29["text/plain"]
      );
      expect(short(held["text/html"] ?? "")).toBe(
        "<blockquote><p></p></blockquote>"
      );
      expect(held["text/plain"]).toBe("\n");
      expectSameLines(held);
    });
  }

  test("D6 for a drag: the drag carries what a copy of the same selection carries", async () => {
    await mount(FS9);
    await fs9Place();
    await copyChecked();
    const copied = clipboard();
    await mount(FS9);
    await fs9Place();
    const transfer = new DataTransfer();
    const paragraph = editable()!.querySelector("blockquote p")!;
    await act(async () => {
      paragraph.dispatchEvent(
        new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        })
      );
    });
    await settle();
    expect(transfer.getData("text/html"), "text/html").toBe(
      copied["text/html"]
    );
    expect(transfer.getData(EDITOR_DATA), "the editor data").toBe(
      copied[EDITOR_DATA]
    );
    expect(transfer.getData("text/html")).not.toContain("data-cms-line");
  });

  test("FS9: into a second field", async () => {
    await mount(FS9);
    await fs9Place();
    await copyChecked();
    const b = await mountExtraField(
      "<ul><li>Pw</li><li>Iw</li><li>Nw</li></ul>"
    );
    const htmlB = exportRichTextHtml(b.editor);
    await at("Iw", 1, undefined, { in: b.element })();
    const stateB = b.editor.getEditorState().toJSON();
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      const text = args.map(String).join(" ");
      if (text.includes("not wrapped in act") === false) {
        errors.push(text);
      }
    });
    b.onChange.mockClear();
    await pasteClip();
    expect(b.onChange.mock.calls.length, "one onChange").toBe(1);
    const written = lastHtml(b.onChange);
    expect(short(written)).toBe(
      "<ul><li>Pw</li><li>I</li></ul><blockquote><p>w</p></blockquote><ul><li>Nw</li></ul>"
    );
    const count = (html: string, selector: string) =>
      new DOMParser()
        .parseFromString(html, "text/html")
        .querySelectorAll(selector).length;
    expect(count(written, "blockquote"), "one more quote").toBe(
      count(htmlB, "blockquote") + 1
    );
    expect(count(written, "br"), "no more line breaks").toBeLessThanOrEqual(
      count(htmlB, "br")
    );
    const letters = (html: string) =>
      new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
    // T18.7: every letter of Iw stays, in order
    expect(letters(written)).toMatch(/I.*w/);
    expect(letters(written).replace(/[^Iw]/g, "")).toBe(
      letters(htmlB).replace(/[^Iw]/g, "")
    );
    expectFixedPoint(written);
    expect(errors, "console errors").toEqual([]);
    await keys("{Control>}z{/Control}")();
    expect(sameState(stateB, b.editor.getEditorState().toJSON()), "undo").toBe(
      true
    );
    await keys("{Control>}y{/Control}")();
    expect(short(lastHtml(b.onChange)), "redo").toBe(short(written));
  });

  // the copy and the click are part of the place, so undo restores the
  // state the paste ran in
  test("FS9: in the same field, a copy by keys pastes P8's write", async () => {
    await expectEdit({
      stored: FS9_ITEM,
      place: async () => {
        await fs9Place();
        await copyChecked();
        expect(short(clipboard()["text/html"] ?? "")).toBe(
          "<blockquote><p></p></blockquote>"
        );
        await at("Iw", 1)();
      },
      action: pasteClip,
      write:
        "<ul><li><blockquote><p>Q0w</p></blockquote><br /></li><li>I</li></ul><blockquote><p>w</p></blockquote>",
      source: "from P8; spec 5.7, D6",
    });
  });

  test("FS6: a block-only item copied to the root's end", async () => {
    await expectEdit({
      stored:
        "<ul><li>Aw</li><li><blockquote><p>bbq</p></blockquote></li></ul><p>sq</p>",
      place: async () => {
        await range("Aw", 2, "bbq", 3)();
        await copyChecked();
        await at("sq")();
      },
      action: pasteClip,
      write:
        "<ul><li>Aw</li><li><blockquote><p>bbq</p></blockquote></li></ul><p>sq</p><ul><li></li><li><blockquote><p>bbq</p></blockquote></li></ul><p></p>",
      source: "from M19a; spec 5.7",
    });
  });
});

// ---------------------------------------------------------------------------
// Task 18 Step 4: one writer, one cut handler, the check by the two ends

/** The raw text/html with classes, directions, styles, values and spans left out (round 13's reading). */
const bare = (html: string | undefined) =>
  (html ?? "")
    .replace(/ (class|dir|style|value)="[^"]*"/g, "")
    .replace(/<\/?span>/g, "");

/** A range set by structure, after a real click on the field. */
const setRange =
  (
    $anchor: () => { key: string; offset: number; type: "text" | "element" },
    $focus: () => { key: string; offset: number; type: "text" | "element" }
  ): Step =>
  async () => {
    await userEvent.click(editable()!);
    await settle();
    await act(async () => {
      editorOf()!.update(() => {
        const anchor = $anchor();
        const focus = $focus();
        const selection = $createRangeSelection();
        selection.anchor.set(anchor.key, anchor.offset, anchor.type);
        selection.focus.set(focus.key, focus.offset, focus.type);
        $setSelection(selection);
      });
    });
    await settle();
  };

const $textPoint = (word: string, offset: number) => () => {
  const text = $getRoot()
    .getAllTextNodes()
    .find((node) => node.getTextContent() === word);
  expect(text, word).toBeDefined();
  return { key: text!.getKey(), offset, type: "text" as const };
};

const $nodesOf = (type: string) => {
  const found: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    if (node.getType() === type) {
      found.push(node);
    }
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  walk($getRoot());
  return found;
};

/** The point on `type`'s parent directly before (or after) its `nth` node. */
const $besideNode =
  (type: string, side: "before" | "after", nth = 0) =>
  () => {
    const node = $nodesOf(type)[nth];
    expect(node, type).toBeDefined();
    return {
      key: node.getParentOrThrow().getKey(),
      offset: node.getIndexWithinParent() + (side === "after" ? 1 : 0),
      type: "element" as const,
    };
  };

/** A copy and, after a remount and the same place, a cut: the two clipboards. */
const copyThenCut = async (stored: string, place: Step) => {
  const onCopy = await mount(stored);
  await place();
  await copyKeeps(onCopy)();
  const copied = clipboard();
  const onChange = await mount(stored);
  await place();
  onChange.mockClear();
  await cutChecked();
  return { copied, cutData: clipboard(), calls: onChange.mock.calls.length };
};

/** A code block elsewhere in the field (16.14: it tells a wrong writer apart). */
const CODE_ELSEWHERE = "<pre><code>Zc</code></pre>";

describe("Task 18: 16.5, a cut's clipboard is the copy's", () => {
  test("the rule alone between two headings copies and cuts as <hr>", async () => {
    const place = setRange(
      $besideNode("horizontalrule", "before"),
      $besideNode("horizontalrule", "after")
    );
    const { copied, cutData, calls } = await copyThenCut(
      "<h2>Aw</h2><hr><h2>Bw</h2>",
      place
    );
    expect(copied["text/html"], "the copy").toBe("<hr>");
    expect(cutData, "the cut's clipboard is the copy's").toEqual(copied);
    expect(calls, "the cut is not refused").toBe(1);
  });

  test("a range whose end is an element point on a link: the cut's clipboard equals the copy's", async () => {
    const place = setRange($textPoint("Aw", 1), () => {
      const link = $nodesOf("link")[0] as ElementNode;
      return {
        key: link.getKey(),
        offset: link.getChildrenSize(),
        type: "element" as const,
      };
    });
    const { copied, cutData, calls } = await copyThenCut(
      '<p>Aw<a href="https://example.org/">Lw</a>Bw</p>',
      place
    );
    expect(cutData, "the cut's clipboard is the copy's").toEqual(copied);
    expect(calls, "the cut is not refused").toBe(1);
    expect(copied["text/plain"]).toBe("wLw");
  });
});

/** The ten ranges of `base-1511-copy` (`rootRule` of the writer's oracle ranges). */
const ROOT_RULE_CASES = UNLINED_CASES.filter(
  (cell): cell is Extract<Case, { anchor: unknown }> =>
    cell.id.startsWith("rootRule") && "anchor" in cell
);
const fixture1511Copy = fixture1511CopyJson as Record<
  string,
  { before: string; clipboard: Record<string, string> }
>;
/** The six cells whose end is after the rule: the head copies more than the range. */
const HEAD_COPIES_MORE = new Set([
  "afterRule -> prevP A0w@1",
  "prevP A0w@1 -> afterRule",
  "afterRule -> nextP B2w@1",
  "nextP B2w@1 -> afterRule",
  "pair beforeRule..afterRule",
  "pair-back beforeRule..afterRule",
]);

/**
 * T39.1 (P18-1): a last point on the root after a top-level paragraph stays
 * for the writer, so these two cells copy as `<base>` does, in all three
 * formats.
 */
const HEAD_COPIES_THE_SAME = new Set([
  "beforeRule -> prevP A0w@1",
  "prevP A0w@1 -> beforeRule",
]);

/** The three formats: the bare text/html, the editor data's nodes, text/plain. */
const threeFormats = (data: Record<string, string>) => ({
  html: bare(data["text/html"]),
  data: JSON.parse(data[EDITOR_DATA] ?? "{}").nodes,
  text: data["text/plain"],
});

/** The editor data as a shape: `type(children)`, a text as `'text'`. */
const dataShape = (json: string | undefined) => {
  type J = { type: string; text?: string; children?: J[] };
  const walk = (node: J): string =>
    node.text !== undefined
      ? `'${node.text}'`
      : node.children === undefined
        ? node.type
        : `${node.type}(${node.children.map(walk).join(",")})`;
  return (JSON.parse(json ?? "{}").nodes as J[]).map(walk).join(",");
};

/** A real drag from the start of `word` onto the root-level rule (check 4, 15.11: it ends before the rule). */
const dragOntoRule =
  (word: string): Step =>
  async () => {
    const send = (
      type: "mousePressed" | "mouseMoved" | "mouseReleased",
      x: number,
      y: number
    ) =>
      (
        cdp() as unknown as {
          send: (method: string, params: unknown) => Promise<unknown>;
        }
      ).send("Input.dispatchMouseEvent", {
        type,
        x,
        y,
        button: "left",
        buttons: type === "mouseReleased" ? 0 : 1,
        clickCount: 1,
      });
    const span = [
      ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
    ].find((element) => element.textContent === word)!;
    const box = span.getBoundingClientRect();
    const rule = editable()!.querySelector("hr")!.getBoundingClientRect();
    const x = rule.left + rule.width / 2;
    const y = rule.top + rule.height / 2;
    await send("mousePressed", box.left + 2, box.top + box.height / 2);
    await settle();
    await send("mouseMoved", x, (box.top + y) / 2);
    await settle();
    await send("mouseMoved", x, y);
    await settle();
    await send("mouseReleased", x, y);
    await settle();
  };

/** The copy, the removal (Backspace) and the cut of the range `place` makes each equal the oracle. */
const expectRootRuleCell = async (stored: string, place: Step) => {
  // the copy holds exactly the range
  const onCopy = await mount(stored);
  await place();
  const before = oracleParts();
  await copyKeeps(onCopy)();
  const copied = clipboard();
  const h = before.h;
  expect(
    {
      text: (copied["text/plain"] ?? "").replace(/\n/g, ""),
      ...heldOfHtml(copied["text/html"]),
    },
    "the copy holds H"
  ).toEqual({ text: h.text, images: h.images, rules: h.rules, html: h.text });
  // the removal takes exactly the range
  await mount(stored);
  await place();
  await keys("{Backspace}")();
  const removed = documentHeld();
  expect(removed.text, "the removal keeps P and S").toBe(
    before.p.text + before.s.text
  );
  expect(removed.rules, "rules").toBe(before.p.rules + before.s.rules);
  // the cut takes exactly what its clipboard holds, the copy's
  await mount(stored);
  await place();
  await cutChecked();
  expect(clipboard(), "the cut's clipboard is the copy's").toEqual(copied);
  expectExactCut(before);
  return copied;
};

/** The text and the rules of a raw text/html. */
const heldOfHtml = (html: string | undefined) => {
  const doc = new DOMParser().parseFromString(html ?? "", "text/html");
  return {
    images: doc.body.querySelectorAll("img").length,
    rules: doc.body.querySelectorAll("hr").length,
    html: doc.body.textContent ?? "",
  };
};

describe("Task 18: the ten ranges beside a root-level rule (base-1511-copy)", () => {
  for (const cell of ROOT_RULE_CASES) {
    const name = cell.id.replace("rootRule | ", "");
    const afterTheRule = name.includes("afterRule");
    const title = afterTheRule
      ? `${name}: placed by structure: no real input reaches`
      : `${name}: placed by structure`;
    test(title, async () => {
      const copied = await expectRootRuleCell(cell.html, async () => {
        await userEvent.click(editable()!);
        await settle();
        expect(await placeRange(cell.anchor, cell.focus)).toBeNull();
      });
      const head = fixture1511Copy[name];
      expect(head, "the fixture's cell").toBeDefined();
      // the head's copy holds what the range holds except in the six
      // cells whose end is after the rule, where it copies more
      const headHeld = {
        text: (head.clipboard["text/plain"] ?? "").replace(/\n/g, ""),
        ...heldOfHtml(head.clipboard["text/html"]),
      };
      const ownHeld = {
        text: (copied["text/plain"] ?? "").replace(/\n/g, ""),
        ...heldOfHtml(copied["text/html"]),
      };
      if (HEAD_COPIES_THE_SAME.has(name)) {
        expect(threeFormats(copied), "T39.1: the head's copy").toEqual(
          threeFormats(head.clipboard)
        );
      }
      if (HEAD_COPIES_MORE.has(name)) {
        expect(ownHeld, "the head copies more than the range").not.toEqual(
          headHeld
        );
      } else {
        expect(ownHeld, "what the head's copy holds").toEqual(headHeld);
      }
    });
  }

  // the real input that reaches the point before the rule: a drag from the
  // word that ends on the rule
  for (const word of ["A0w", "B2w"]) {
    test(`a real drag from ${word} onto the rule: the copy, the removal and the cut equal the oracle`, async () => {
      const copied = await expectRootRuleCell(
        "<p>A0w</p><hr><p>B2w</p>",
        async () => {
          await dragOntoRule(word)();
          expect(caretKey(), "the drag ends before the rule").toMatch(
            /element:root@1/
          );
        }
      );
      if (word === "A0w") {
        // T39.1: the paragraph before the rule is top-level, so the copy
        // keeps it, as the head's does
        expect({
          html: bare(copied["text/html"]),
          data: dataShape(copied[EDITOR_DATA]),
          text: copied["text/plain"],
        }).toEqual({
          html: "<p>A0w</p>",
          data: "paragraph('A0w')",
          text: "A0w\n",
        });
      }
    });
  }
});

describe("Task 18: real empty blocks and whole items (check 4, 15.11)", () => {
  type J = { type: string; text?: string; children?: J[] };
  const shape = (json: string | undefined) => {
    const walk = (node: J): string =>
      node.text !== undefined
        ? `'${node.text}'`
        : node.children === undefined
          ? node.type
          : `${node.type}(${node.children.map(walk).join(",")})`;
    return (JSON.parse(json ?? "{}").nodes as J[]).map(walk).join(",");
  };

  test("15.11 (E) a range across a real empty paragraph keeps it in the clipboard", async () => {
    const onChange = await mount("<p>A0w</p><p><br></p><p>B2w</p>");
    await range("A0w", 1, "B2w", 1)();
    await copyKeeps(onChange)();
    expect(shape(clipboard()[EDITOR_DATA])).toBe(
      "paragraph('0w'),paragraph(linebreak),paragraph('B')"
    );
    expect(bare(clipboard()["text/html"])).toBe("<p>0w</p><p><br></p><p>B</p>");
  });

  test("15.11 (E) a range that starts in a real empty item keeps the item in the clipboard", async () => {
    const onChange = await mount("<ul><li>Aw</li><li></li><li>Bw</li></ul>");
    await setRange(
      () => {
        const item = $nodesOf("listitem")[1];
        return { key: item.getKey(), offset: 0, type: "element" as const };
      },
      $textPoint("Bw", 1)
    )();
    await copyKeeps(onChange)();
    expect(shape(clipboard()[EDITOR_DATA])).toBe(
      "list(listitem(),listitem('B'))"
    );
    expect(bare(clipboard()["text/html"])).toBe("<ul><li></li><li>B</li></ul>");
  });

  test("a range that holds a whole list item copies with its list and item (accepted; check 4, 15.11, ruled 5)", async () => {
    const onChange = await mount(`<ul><li>U0w${IMG}</li></ul>`);
    await at("U0w", 1)();
    await keys("{Control>}a{/Control}")();
    await copyKeeps(onChange)();
    expect(shape(clipboard()[EDITOR_DATA])).toBe(
      "list(listitem('U0w',cms-image))"
    );
    expect(bare(clipboard()["text/html"])).toMatch(
      /^<ul><li>U0w<img [^>]*><\/li><\/ul>$/
    );
  });

  // T59 defect 11 (probe clip-d real05): the selection holds U1w and not the
  // image that leads the item, so it does not hold the whole item
  const shiftHomeAfterImage = then(
    at("U1w", 3),
    keys("{Shift>}{Home}{/Shift}")
  );

  // T68.3: the writer's made-up character never reaches the clipboard
  const expectNoMark = () => {
    const held = clipboard();
    for (const type of ["text/plain", "text/html", EDITOR_DATA]) {
      expect(held[type], type).toBeDefined();
      expect(held[type], type).not.toContain(ITEM_NOT_WHOLE_MARK);
    }
  };

  test("a range that holds an item's text but not the image leading it copies the text alone (D6; T59 defect 11)", async () => {
    const onChange = await mount(LI(`${IMG}U1w`));
    await shiftHomeAfterImage();
    await copyKeeps(onChange)();
    expect(shape(clipboard()[EDITOR_DATA])).toBe("'U1w'");
    expect(bare(clipboard()["text/html"])).toBe("U1w");
    expect(clipboard()["text/plain"]).toBe("U1w");
    expectNoMark();
  });

  test("that range cut and pasted back gives the item back whole (D6; T59 defect 11)", async () => {
    const onChange = await mount(LI(`${IMG}U1w`));
    await shiftHomeAfterImage();
    await cut();
    await settle();
    expectNoMark();
    expect(plain(lastHtml(onChange))).toBe(
      `<ul><li>Pw</li><li>${IMG}</li><li>Nw</li></ul>`
    );
    await pasteClip();
    await settle();
    expect(plain(lastHtml(onChange))).toBe(LI(`${IMG}U1w`));
  });

  // T69.4: an item the range holds whole, an image at its edge included,
  // is copied whole as before (accepted; check 4, 15.11, ruled 5)
  test("rec-49: Shift+End from U0w@0 over the trailing image copies the item whole (T69.4)", async () => {
    const onChange = await mount(LI(`U0w${IMG}`));
    await at("U0w", 0)();
    await keys("{Shift>}{End}{/Shift}")();
    await copyKeeps(onChange)();
    expect(shape(clipboard()[EDITOR_DATA])).toBe(
      "list(listitem('U0w',cms-image))"
    );
    expect(bare(clipboard()["text/html"])).toMatch(
      /^<ul><li>U0w<img [^>]*><\/li><\/ul>$/
    );
    expectNoMark();
  });

  test("a range that starts before the image leading the item copies the item whole (T69.4)", async () => {
    const onChange = await mount(LI(`${IMG}U1w`));
    await setRange(
      () => {
        const item = $nodesOf("listitem")[1];
        return { key: item.getKey(), offset: 0, type: "element" as const };
      },
      $textPoint("U1w", 3)
    )();
    await copyKeeps(onChange)();
    expect(shape(clipboard()[EDITOR_DATA])).toBe(
      "list(listitem(cms-image,'U1w'))"
    );
    expect(bare(clipboard()["text/html"])).toMatch(
      /^<ul><li><img [^>]*>U1w<\/li><\/ul>$/
    );
    expectNoMark();
  });

  // T69.1, measured at both builds: a double click selects U1w by its two
  // text ends. The head copies list(listitem('U1w')) and its paste back at
  // the cut's caret adds an item after the image (<li><img /></li><li>U1w</li>),
  // so R1's value stands: the copy holds the text and no item (D6)
  test("a double click on an item's text after a leading image copies the text alone (T69.1)", async () => {
    const onChange = await mount(LI(`${IMG}U1w`));
    await doubleClick("U1w")();
    expect(caretKey(), "the double click selects U1w by text ends").toBe(
      "text:U1w@0|text:U1w@3"
    );
    await copyKeeps(onChange)();
    expect(shape(clipboard()[EDITOR_DATA])).toBe("'U1w'");
    expect(bare(clipboard()["text/html"])).toBe("U1w");
    expect(clipboard()["text/plain"]).toBe("U1w");
    expectNoMark();
  });

  // T74.1: the trailing shape is pinned like the leading one. The head copies
  // list(listitem('U1w')) here too (P68-1); R1's copy holds the text and no
  // item (D6), whichever side the image is on
  test("a double click on an item's text before a trailing image copies the text alone (T74.1)", async () => {
    const onChange = await mount(LI(`U1w${IMG}`));
    await doubleClick("U1w")();
    expect(caretKey(), "the double click selects U1w by text ends").toBe(
      "text:U1w@0|text:U1w@3"
    );
    await copyKeeps(onChange)();
    expect(shape(clipboard()[EDITOR_DATA])).toBe("'U1w'");
    expect(bare(clipboard()["text/html"])).toBe("U1w");
    expect(clipboard()["text/plain"]).toBe("U1w");
    expectNoMark();
  });

  for (const stored of [LI(`${IMG}U1w`), LI(`U1w${IMG}`)]) {
    test(`a double click's cut pasted back at its caret gives the stored value: ${short(stored)} (T69.1)`, async () => {
      const onChange = await mount(stored);
      await doubleClick("U1w")();
      await cut();
      await settle();
      expectNoMark();
      expect(plain(lastHtml(onChange))).toBe(
        `<ul><li>Pw</li><li>${IMG}</li><li>Nw</li></ul>`
      );
      await pasteClip();
      await settle();
      expect(plain(lastHtml(onChange))).toBe(stored);
    });
  }
});

describe("Task 18: 16.7, the shell rule holds in a list item and a quote", () => {
  test("K14 on the root: the clipboard holds the paragraph and the figure and nothing of the heading", async () => {
    const onChange = await mount(
      '<p>xx</p><figure><img src="https://e.org/f.png" alt="F" /><figcaption>Cap</figcaption></figure><h2>hh</h2>'
    );
    await setRange($textPoint("xx", 0), () => ({
      key: $getRoot().getKey(),
      offset: 2,
      type: "element" as const,
    }))();
    await copyKeeps(onChange)();
    const held = clipboard();
    expect(held["text/html"]).not.toContain("<h2");
    expect(held["text/html"]).toContain("<figure");
    expect(shape16(held[EDITOR_DATA])).toEqual(["paragraph", "cms-figure"]);
  });

  test("a last point on a quote directly before a list carries no shell of the list", async () => {
    const onChange = await mount(
      "<blockquote><p>Q0w</p><ul><li>Lw</li></ul></blockquote><p>Zw</p>"
    );
    await setRange($textPoint("Q0w", 1), () => {
      const quote = $nodesOf("quote")[0];
      return { key: quote.getKey(), offset: 1, type: "element" as const };
    })();
    await copyKeeps(onChange)();
    expect(clipboard()["text/html"]).not.toContain("<ul");
    expect(clipboard()["text/html"]).not.toContain("<li");
  });

  // K14 in a lined item. The cells whose end is a point between two quotes
  // (P18-2) or before an item (P18-3) carry the next block's empty shell
  // (T39.2) and are pinned in the describe below
  type Shell = { tag: string; type: string; most: number };
  const inLine: Array<{
    name: string;
    stored: string;
    from: string;
    $end: () => { key: string; offset: number; type: "element" };
    shells: Shell[];
  }> = [
    {
      name: "a range that ends after a quote at its item's end carries no shell of the next item's list",
      stored: LI("T0w<blockquote><p>Q1w</p></blockquote><ul><li>Lw</li></ul>"),
      from: "T0w",
      $end: $besideNode("quote", "after"),
      shells: [
        { tag: "ul", type: "list", most: 1 },
        { tag: "li", type: "listitem", most: 1 },
      ],
    },
    {
      name: "a range that ends after a quote's text in a lined item carries no shell of the next item's list",
      stored: LI("T0w<blockquote><p>Q1w</p></blockquote><ul><li>Lw</li></ul>"),
      from: "Q1w",
      $end: $besideNode("quote", "after"),
      shells: [
        { tag: "ul", type: "list", most: 0 },
        { tag: "li", type: "listitem", most: 0 },
      ],
    },
    {
      name: "a range that ends before a quote's list in a lined item carries no shell of the list",
      stored: LI("T0w<blockquote><p>Q1w</p><ul><li>Lw</li></ul></blockquote>"),
      from: "T0w",
      $end: $besideNode("list", "before", 1),
      shells: [
        { tag: "ul", type: "list", most: 0 },
        { tag: "li", type: "listitem", most: 0 },
      ],
    },
    {
      name: "a range from a quote's text to the point before its list in a lined item carries no shell of the list",
      stored: LI("T0w<blockquote><p>Q1w</p><ul><li>Lw</li></ul></blockquote>"),
      from: "Q1w",
      $end: $besideNode("list", "before", 1),
      shells: [
        { tag: "ul", type: "list", most: 0 },
        { tag: "li", type: "listitem", most: 0 },
      ],
    },
  ];
  const countTypes = (json: string | undefined, type: string) => {
    let count = 0;
    const walk = (node: { type: string; children?: unknown[] }) => {
      count += node.type === type ? 1 : 0;
      (node.children as Array<typeof node> | undefined)?.forEach(walk);
    };
    (JSON.parse(json ?? "{}").nodes as Array<{ type: string }>).forEach(walk);
    return count;
  };
  for (const cell of inLine) {
    for (const backward of [false, true]) {
      test(`16.7 in a lined item: ${cell.name}${backward ? ", backward" : ""}`, async () => {
        const onChange = await mount(cell.stored);
        const $start = $textPoint(cell.from, 1);
        await (
          backward ? setRange(cell.$end, $start) : setRange($start, cell.$end)
        )();
        const { h } = oracleParts();
        await copyKeeps(onChange)();
        const held = clipboard();
        const doc = new DOMParser().parseFromString(
          held["text/html"] ?? "",
          "text/html"
        );
        expect(doc.body.textContent, "the oracle's text").toBe(h.text);
        expect(doc.querySelectorAll("img").length, "images").toBe(h.images);
        expect(doc.querySelectorAll("hr").length, "rules").toBe(h.rules);
        for (const shell of cell.shells) {
          expect(
            doc.querySelectorAll(shell.tag).length,
            `no shell in text/html: ${shell.tag}`
          ).toBeLessThanOrEqual(shell.most);
          expect(
            countTypes(held[EDITOR_DATA], shell.type),
            `no shell in the editor data: ${shell.type}`
          ).toBeLessThanOrEqual(shell.most);
        }
      });
    }
  }
});

// T39.2 (P18-2, P18-3): an end that reaches the writer as a text end at the
// next block's start (the field's point step, or Lexical's own) copies that
// block's empty shell (check 4, 15.11, D6), and the copy holds exactly what
// the range holds
describe("Task 18: an end at the next block's start carries its empty shell (T39.2)", () => {
  const TQQT = LI(
    "T0w<blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote>T3w"
  );
  const TQ = LI("T0w<blockquote><p>Q1w</p></blockquote>");
  const cells: Array<{
    name: string;
    stored: string;
    from: string;
    $end: () => { key: string; offset: number; type: "element" };
    html: string;
    data: string;
    text: string;
    /** `<base>` copies the whole second quote here (P18-2). */
    notQ2?: boolean;
  }> = [
    {
      name: "P18-2: T0w@1 to the point between two quotes",
      stored: TQQT,
      from: "T0w",
      $end: $besideNode("quote", "after", 0),
      html: "0w<blockquote><p>Q1w</p></blockquote><blockquote><p></p></blockquote>",
      data: "'0w',quote(paragraph('Q1w')),quote(paragraph())",
      text: "0w\nQ1w\n",
      notQ2: true,
    },
    {
      name: "P18-2: Q1w@1 to the point between two quotes",
      stored: TQQT,
      from: "Q1w",
      $end: $besideNode("quote", "after", 0),
      html: "<blockquote><p>1w</p></blockquote><blockquote><p></p></blockquote>",
      data: "quote(paragraph('1w')),quote(paragraph())",
      text: "1w\n",
      notQ2: true,
    },
    {
      name: "P18-2: Pw@1 to the point between two quotes",
      stored: TQQT,
      from: "Pw",
      $end: $besideNode("quote", "after", 0),
      html: "<ul><li>w</li><li>T0w<blockquote><p>Q1w</p></blockquote><blockquote><p></p></blockquote></li></ul>",
      data: "list(listitem('w'),listitem('T0w',quote(paragraph('Q1w')),quote(paragraph())))",
      text: "w\nT0w\nQ1w\n",
      notQ2: true,
    },
    {
      name: "P18-3: T0w@1 to the list's point before the next item",
      stored: TQ,
      from: "T0w",
      $end: $besideNode("listitem", "before", 2),
      html: "<ul><li>0w<blockquote><p>Q1w</p></blockquote></li><li></li></ul>",
      data: "list(listitem('0w',quote(paragraph('Q1w'))),listitem())",
      text: "0w\nQ1w\n",
    },
    {
      name: "P18-3: Q1w@1 to the list's point before the next item",
      stored: TQ,
      from: "Q1w",
      $end: $besideNode("listitem", "before", 2),
      html: "<ul><li><blockquote><p>1w</p></blockquote></li><li></li></ul>",
      data: "list(listitem(quote(paragraph('1w'))),listitem())",
      text: "1w\n",
    },
    {
      name: "P18-3: Pw@1 to the list's point before the next item",
      stored: TQ,
      from: "Pw",
      $end: $besideNode("listitem", "before", 2),
      html: "<ul><li>w</li><li>T0w<blockquote><p>Q1w</p></blockquote></li><li></li></ul>",
      data: "list(listitem('w'),listitem('T0w',quote(paragraph('Q1w'))),listitem())",
      text: "w\nT0w\nQ1w\n",
    },
    {
      name: "P18-3: an unlined list, Aw@1 to the point before the next item",
      stored: "<ul><li>Aw</li><li>Bw</li></ul><p>Zw</p>",
      from: "Aw",
      $end: $besideNode("listitem", "before", 1),
      html: "<ul><li>w</li><li></li></ul>",
      data: "list(listitem('w'),listitem())",
      text: "w\n",
    },
  ];
  for (const cell of cells) {
    for (const backward of [false, true]) {
      test(`${cell.name}${backward ? ", backward" : ""}`, async () => {
        const onChange = await mount(cell.stored);
        const $start = $textPoint(cell.from, 1);
        await (
          backward ? setRange(cell.$end, $start) : setRange($start, cell.$end)
        )();
        const { h } = oracleParts();
        await copyKeeps(onChange)();
        const held = clipboard();
        expect({
          html: bare(held["text/html"]),
          data: dataShape(held[EDITOR_DATA]),
          text: held["text/plain"],
        }).toEqual({ html: cell.html, data: cell.data, text: cell.text });
        // the copy holds exactly what the range holds
        expect(
          {
            text: (held["text/plain"] ?? "").replace(/\n/g, ""),
            ...heldOfHtml(held["text/html"]),
          },
          "the copy holds H"
        ).toEqual({
          text: h.text,
          images: h.images,
          rules: h.rules,
          html: h.text,
        });
        if (cell.notQ2 === true) {
          expect(held["text/html"], "not the whole second quote").not.toContain(
            "Q2w"
          );
          expect(held[EDITOR_DATA], "not the whole second quote").not.toContain(
            "Q2w"
          );
        }
      });
    }
  }
});

/** The editor data's top-level node types. */
const shape16 = (json: string | undefined) =>
  (JSON.parse(json ?? "{}").nodes as Array<{ type: string }>).map(
    (node) => node.type
  );

// Step 4b (16.14; T11.10): with the old writer restored for a range with
// two text ends, four of these fail in each variant; the three titled
// "control:" pass with it too, so they do not guard the one writer
describe("Task 18: group G (round 13), each also with a code block elsewhere", () => {
  for (const elsewhere of ["", CODE_ELSEWHERE]) {
    const suffix = elsewhere === "" ? "" : ", a code block elsewhere";
    const copyOf = async (stored: string, place: Step) => {
      const onChange = await mount(stored + elsewhere);
      await place();
      await copyKeeps(onChange)();
      return {
        html: bare(clipboard()["text/html"]),
        text: clipboard()["text/plain"],
      };
    };

    test(`control: G with a code block: a whole lined item TC copies as the head does${suffix}`, async () => {
      expect(
        await copyOf(
          "<ul><li>T0w<pre><code>C1w</code></pre></li></ul>",
          range("T0w", 0, "C1w", 3)
        )
      ).toEqual({ html: "T0w<pre><code>C1w</code></pre>", text: "T0w\nC1w" });
    });
    test(`control: G with a code block: a whole lined item CT copies as the head does${suffix}`, async () => {
      expect(
        await copyOf(
          "<ul><li><pre><code>C0w</code></pre>T1w</li></ul>",
          range("C0w", 0, "T1w", 3)
        )
      ).toEqual({ html: "<pre><code>C0w</code></pre>T1w", text: "C0w\nT1w" });
    });
    test(`G with a code block: a line's whole text before a code block copies only that text${suffix}`, async () => {
      expect(
        await copyOf(
          "<ul><li>xxq<pre><code>cc</code></pre>yyq</li></ul>",
          range("xxq", 0, "xxq", 3)
        )
      ).toEqual({ html: "xxq", text: "xxq" });
    });
    test(`control: G with a code block: a cut that ends in code text removes exactly what its clipboard holds${suffix}`, async () => {
      await expectEdit({
        stored: LI("T0w<pre><code>C1w</code></pre>") + elsewhere,
        place: range("T0w", 1, "C1w", 2),
        action: cutChecked,
        write: LI("Tw") + (elsewhere === "" ? "" : CODE_ELSEWHERE),
        source: "round 13, group G",
      });
      expect(clipboard()["text/plain"]).toBe("0w\nC1");
    });
    test(`G: a line's whole text before a quote copies the text only${suffix}`, async () => {
      expect(
        await copyOf(
          "<ul><li>xxq<blockquote><p>qq</p></blockquote>yyq</li></ul>",
          range("xxq", 0, "xxq", 3)
        )
      ).toEqual({ html: "xxq", text: "xxq" });
    });
    test(`G: a whole lined item copies with its list item${suffix}`, async () => {
      expect(
        await copyOf("<ul><li>xq<hr>yq</li></ul>", range("xq", 0, "yq", 2))
      ).toEqual({ html: "<ul><li>xq<hr>yq</li></ul>", text: "xq\nyq" });
    });
    test(`G: a cut from the item before to the end of the line before a trailing rule${suffix}`, async () => {
      await expectEdit({
        stored: LI("<blockquote><p>Q0w</p></blockquote>T1w<hr>") + elsewhere,
        place: range("Pw", 0, "T1w", 3),
        action: cutChecked,
        write:
          "<ul><li><hr /></li><li>Nw</li></ul>" +
          (elsewhere === "" ? "" : CODE_ELSEWHERE),
        source: "round 13, group G",
      });
      expect(clipboard()["text/plain"]).toContain("T1w");
    });
  }
});

describe("Task 18: the writer's state and its failures", () => {
  test("a copy inside an uncommitted update writes from the state the command runs in", async () => {
    await mount("<p>Aw</p><p>Bw</p>");
    await range("Aw", 0, "Bw", 1)();
    const transfer = new DataTransfer();
    await act(async () => {
      editorOf()!.update(() => {
        const selection = $getSelection() as RangeSelection;
        const text = selection.anchor.getNode();
        expect($isTextNode(text)).toBe(true);
        (text as TextNode).spliceText(0, 0, "k", false);
        editorOf()!.dispatchCommand(
          COPY_COMMAND,
          new ClipboardEvent("copy", {
            bubbles: true,
            cancelable: true,
            clipboardData: transfer,
          })
        );
      });
    });
    await settle();
    expect(transfer.getData("text/plain")).toContain("k");
    expect(transfer.getData("text/html")).toContain("k");
    expect(transfer.getData(EDITOR_DATA)).toContain("k");
  });

  for (const elsewhere of ["", CODE_ELSEWHERE]) {
    const stored = `<p>abac</p><p>Zw</p>${elsewhere}`;
    const suffix = elsewhere === "" ? "" : ", a code block elsewhere";
    for (const kind of ["copy", "cut"] as const) {
      test(`a failure of the writer itself: text/plain only, nothing removed (${kind}${suffix})`, async () => {
        const onChange = await mount(stored);
        await range("abac", 0, "abac", 2)();
        const valueBefore = exportRichTextHtml(editorOf()!);
        const caretBefore = caretKey();
        const depthBefore = undoDepth();
        const errors: string[] = [];
        vi.spyOn(console, "error").mockImplementation((...args) => {
          const text = args.map(String).join(" ");
          if (text.includes("not wrapped in act") === false) {
            errors.push(text);
          }
        });
        onChange.mockClear();
        const restore = forcedFailure("scratch-write");
        try {
          await (kind === "copy" ? copy : cut)();
        } finally {
          restore();
        }
        const calls = onChange.mock.calls.length;
        vi.restoreAllMocks();
        expect(errors.length, "the development assertion, once").toBe(1);
        expect(errors[0]).toContain("could not be written");
        expect(clipboard(), "text/plain only").toEqual({ "text/plain": "ab" });
        expect(calls, "no onChange").toBe(0);
        expect(exportRichTextHtml(editorOf()!), "nothing removed").toBe(
          valueBefore
        );
        expect(undoDepth(), "no undo step").toEqual(depthBefore);
        expect(caretKey(), "the selection as it was").toBe(caretBefore);
        // the copy mark is cleared: the next copy writes whole
        await copyChecked();
        expect(clipboard()["text/plain"]).toBe("ab");
        expect(clipboard()["text/html"] ?? "").not.toBe("");
      });
    }
  }
});

describe("T59 defect 1: text/plain keeps the head's new line after a start at a block's end (D6, 5.8, T39.5)", () => {
  const S2B =
    "<ul><li>xq<blockquote><p>qq</p></blockquote>yq</li><li>oq</li></ul><blockquote><p>zq</p></blockquote><p>rq</p><ul><li><blockquote><p>bbq</p></blockquote></li></ul><p>sq</p><ul><li>pq<ul><li>nq</li></ul></li></ul>";
  const shiftLeft = keys("{Shift>}{ArrowLeft}{/Shift}");

  test("S2b: a copy from rq@2 to bbq@3 is the head's \\nbbq", async () => {
    const onChange = await mount(S2B);
    await range("rq", 2, "bbq", 3)();
    await copyKeeps(onChange)();
    expect(short(clipboard()["text/html"] ?? "")).toBe(
      "<p></p><ul><li><blockquote><p>bbq</p></blockquote></li></ul>"
    );
    expect(clipboard()["text/plain"]).toBe("\nbbq");
    expectSameLines(clipboard());
  });

  test("c1 S3: Shift+Right twice from Q0w's end copies the head's two new lines", async () => {
    const onChange = await mount(FS9);
    await at("Q0w", 3)();
    await shiftRight();
    await shiftRight();
    await copyKeeps(onChange)();
    expect(short(clipboard()["text/html"] ?? "")).toBe(
      "<blockquote><p></p></blockquote><br />"
    );
    expect(clipboard()["text/plain"]).toBe("\n\n");
    expectSameLines(clipboard());
  });

  const QR = LI("<blockquote><p>Q0w</p></blockquote><hr>");
  const cells: Array<[string, string, Step, Step, string]> = [
    [
      "QR, forward from Pw's end",
      QR,
      at("Pw", 2),
      shiftRight,
      "<ul><li>PwQ0w</li><li><hr /></li><li>Nw</li></ul>",
    ],
    [
      "RQ, forward from Pw's end",
      LI("<hr><blockquote><p>Q1w</p></blockquote>"),
      at("Pw", 2),
      shiftRight,
      "<ul><li>Pw<hr /><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
    ],
    [
      "QR, backward from Nw's start",
      QR,
      at("Nw", 0),
      shiftLeft,
      "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />Nw</li></ul>",
    ],
    [
      "Rlast, backward from Nw's start",
      LI("T0w<hr>"),
      at("Nw", 0),
      shiftLeft,
      "<ul><li>Pw</li><li>T0w<hr />Nw</li></ul>",
    ],
  ];
  for (const [name, stored, place, press, joined] of cells) {
    test(`a cut walk's first stop that joins two items writes one new line: ${name}`, async () => {
      const onChange = await mount(stored);
      await place();
      await press();
      onChange.mockClear();
      await cut();
      expect(plain(lastHtml(onChange)), "the cut joins two items").toBe(joined);
      expect(clipboard()["text/plain"]).toBe("\n");
      expectSameLines(clipboard());
    });
  }
});

describe("T70.2 (measurement 6): c1 S3, a removal from Q0w's end to the start of the line that holds only the break", () => {
  // T23.1 for every entry point of a removal: the line and its break go,
  // nothing is added to the quote; one onChange, one undo step, the caret
  // stays at Q0w@3. The cut's clipboard is FS9's.
  const removed = "<ul><li><blockquote><p>Q0w</p></blockquote></li></ul>";
  const placed = then(fs9Place, async () => {
    expect(caretKey(), "Q0w@3 to the break's line start").toMatch(
      /^text:Q0w@3\|/
    );
  });
  const actions: Array<[string, Step]> = [
    ["Backspace", backspace],
    ["Delete", del],
    [
      "a cut",
      then(cut, async () => {
        const held = clipboard();
        expect(
          short(held["text/html"] ?? ""),
          "text/html: the quote's shell"
        ).toBe("<blockquote><p></p></blockquote>");
        expect(held["text/plain"], "text/plain: one new line").toBe("\n");
      }),
    ],
  ];
  for (const [name, action] of actions) {
    test(name, async () => {
      await expectEdit({
        stored: FS9,
        place: placed,
        action,
        write: removed,
        caret: "text:Q0w@3",
        source: "T70.2; T23.1; FS9",
      });
    });
  }
});
