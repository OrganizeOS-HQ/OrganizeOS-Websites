// D7's history: mount, redo, composition and undo; F12's step and the
// cancelled compositions (Task 20).
import { describe, expect, test, vi } from "vitest";
import {
  at,
  chooseBlockType,
  clickItemCorner,
  expectEdit,
  ime,
  imeCancel,
  itemPoint,
  keys,
  letter,
  LI,
  mount,
  caretKey,
  quiet,
  short,
  type Step,
  then,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { sameState } from "./rich-text-line-test-compare";
import { exportRichTextHtml } from "./rich-text-html";
import {
  click,
  editable,
  editorOf,
  expectFixedPoint,
  lastHtml,
  settle,
} from "./rich-text-test-harness";
import measured from "./__records__/r1-measurements.head.json";

const undo = keys("{Control>}z{/Control}");
const redo = keys("{Control>}y{/Control}");
const now = () => short(exportRichTextHtml(editorOf()!));

type Measured = {
  id: string;
  write?: string;
  calls?: number;
  afterUndo?: string;
};
const M = (id: string) => {
  const record = (measured as Measured[]).find((entry) => entry.id === id);
  expect(record, id).toBeDefined();
  return record!;
};

/** The values the field handed out, in order (16.10: none repeats the one before). */
const valuesOf = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.map(([value]) =>
    value === null ? null : short((value as { html: string }).html)
  );
const expectNoRepeat = (values: (string | null)[], before: string) => {
  values.forEach((value, index) => {
    expect(value, `value ${index + 1} repeats the one before it`).not.toBe(
      index === 0 ? before : values[index - 1]
    );
  });
};

describe("D7: lines made at mount", () => {
  for (const stored of [
    LI("T0w<hr>"),
    "<blockquote>X1w<p>X2w</p></blockquote>",
    LI("<br><blockquote><p>Q1w</p></blockquote>"),
  ]) {
    test(`lines made at mount are no undo step: ${stored}`, async () => {
      const onChange = await mount(stored);
      await click(editable());
      const kept = editorOf()!.getEditorState().toJSON();
      for (let press = 0; press < 5; press += 1) {
        await undo();
      }
      expect(onChange).not.toHaveBeenCalled();
      expect(sameState(kept, editorOf()!.getEditorState().toJSON())).toBe(true);
      expect(undoDepth().undo).toBe(0);
    });
  }
});

describe("a cancelled composition adds nothing beyond the head's", () => {
  // the head's calls (M62a 4, M62b 4, M62c 2) hold repeats, which 16.10
  // takes out: the values are pinned without repeats (P20-1)
  for (const [how, id] of [
    ["empty", "M62a"],
    ["commit", "M62b"],
    ["escape", "M62c"],
  ] as const) {
    test(`imeCancel("${how}") (${id})`, async () => {
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        const text = args.map(String).join(" ");
        if (text.includes("not wrapped in act") === false) {
          errors.push(text.slice(0, 300));
        }
      });
      const onChange = await mount("<p>Pw</p><p>T0w</p>");
      await then(at("Pw", 2), letter, at("T0w", 1))();
      expect(await quiet()).toBeGreaterThan(30);
      const before = now();
      onChange.mockClear();
      await imeCancel(how)();
      await settle();
      const values = valuesOf(onChange);
      expectNoRepeat(values, before);
      if (how !== "escape") {
        // Escape leaves the page's composition open under CDP: M62c's
        // afterUndo is an undo during it (15.1)
        expect(now(), "the value as it stood").toBe(before);
      }
      await undo();
      expect(now(), "after one Ctrl+Z").toBe(M(id).afterUndo);
      expect(errors, "console errors").toEqual([]);
    });
  }
});

/**
 * A composition's checks where its write is pinned and its count is 16.10's
 * (T29.6): the values hand out no repeat and no composition-start
 * character, and the last is the write; undo restores the state and the
 * caret before, redo the write; no console error; under 2,000 ms; the write
 * reopens as a fixed point.
 */
const expectComposition = async (edit: {
  stored: string;
  place: Step;
  action: Step;
  write: string;
}) => {
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (text.includes("not wrapped in act") === false) {
      errors.push(text.slice(0, 300));
    }
  });
  const onChange = await mount(edit.stored);
  await edit.place();
  expect(await quiet()).toBeGreaterThan(30);
  const editor = editorOf()!;
  const before = editor.getEditorState().toJSON();
  const caretBefore = caretKey(editor);
  const valueBefore = now();
  onChange.mockClear();
  const start = performance.now();
  await edit.action();
  expect(performance.now() - start, "the composition in ms").toBeLessThan(2000);
  const values = valuesOf(onChange);
  expect(values.length, "an onChange").toBeGreaterThan(0);
  expectNoRepeat(values, valueBefore);
  for (const [value] of onChange.mock.calls) {
    expect((value as { html: string }).html).not.toContain("\u200b");
  }
  expect(values.at(-1), "write").toBe(edit.write);
  const written = lastHtml(onChange);
  const after = editor.getEditorState().toJSON();
  await undo();
  expect(sameState(before, editor.getEditorState().toJSON()), "undo").toBe(
    true
  );
  expect(caretKey(editor), "the caret after undo").toBe(caretBefore);
  await redo();
  expect(sameState(after, editor.getEditorState().toJSON()), "redo").toBe(true);
  expect(now(), "redo").toBe(edit.write);
  expect(errors, "console errors").toEqual([]);
  expectFixedPoint(written);
};

describe("D7: compositions at an element point and Block type at BQ el1", () => {
  const TR = LI("T0w<hr>");
  test("a composition at TR's end (M49a)", async () => {
    await expectComposition({
      stored: TR,
      place: itemPoint(1, 2),
      action: ime("a"),
      write: M("M49a").write!,
    });
  });
  test("a composition at TR's end after a real click (M49b)", async () => {
    await expectComposition({
      stored: TR,
      place: then(at("Pw"), clickItemCorner(1)),
      action: ime("a"),
      write: M("M49b").write!,
    });
  });
  test("a composition at RT el0 (M49c)", async () => {
    await expectComposition({
      stored: LI("<hr>T1w"),
      place: itemPoint(1, 0),
      action: ime("a"),
      write: M("M49c").write!,
    });
  });
  test("F12: one Ctrl+Z after a composition in an ordinary paragraph", async () => {
    await expectEdit({
      stored: "<p>Pw</p><p>T0w</p><p>Nw</p>",
      place: then(at("T0w", 1), async () => {
        expect(await quiet()).toBeGreaterThan(30);
      }),
      action: ime("a"),
      write: "<p>Pw</p><p>Ta0w</p><p>Nw</p>",
      // the value as it stood at the composition's start, the first after
      // mount (T42.1), then the composed one; no repeat (16.10)
      calls: 2,
      source: "section 8 (F12); P16-2, T42.1",
    });
  });
  const BQ = LI("<br><blockquote><p>Q1w</p></blockquote>");
  for (const [name, write] of [
    [
      "Heading 2",
      "<ul><li>Pw</li><li><h2><br /></h2><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
    ],
    [
      "Quote",
      "<ul><li>Pw</li><li><blockquote><br /></blockquote><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
    ],
    [
      "Code",
      "<ul><li>Pw</li><li><pre><code>\n</code></pre><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
    ],
  ] as const) {
    test(`${name} at BQ el1 (P7-${name})`, async () => {
      await expectEdit({
        stored: BQ,
        place: itemPoint(1, 1),
        action: chooseBlockType(name),
        write,
        source: `from P7-${name} (spec 14, D7)`,
      });
    });
  }
});
