import { afterEach, describe, expect, test, vi } from "vitest";
import { commands, userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type PointType,
  type RangeSelection,
} from "lexical";
import {
  $rangeOracle,
  IMG,
  at,
  caretKey,
  clipboard,
  copy,
  cut,
  expectEdit,
  type Held,
  keys,
  letter,
  mount,
  range,
  type Step,
} from "./rich-text-line-test-kit";
import { forcedFailure, undoDepth } from "./rich-text-line-test-kit-branch";
import { editorOf, lastHtml, plain, settle } from "./rich-text-test-harness";
import { exportRichTextHtml } from "./rich-text-html";

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

const shiftRightUntil = (focus: string): Step => async () => {
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
          action: cut,
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
        await cut();
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
      await cut();
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
      await copy();
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
      await cut();
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
