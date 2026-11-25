// Section 10: the place and size of every text node and block, mounted and not
// focused, equal the baseline recorded at `main` (1 px tolerance).
import { describe, expect, test } from "vitest";
import { server } from "@vitest/browser/context";
import corpus from "./__fixtures__/rich-text-corpus.json";
import roundtrip from "./__fixtures__/rich-text-roundtrip.json";
import recorded from "./__fixtures__/rich-text-line-layout.json";
import {
  exportRichTextHtml,
  getRichTextReadOnlyReason,
} from "./rich-text-html";
import { act } from "react-dom/test-utils";
import {
  $createRangeSelection,
  $getRoot,
  $setSelection,
  type ElementNode,
} from "lexical";
import {
  click,
  editable,
  editorOf,
  fontsLoaded,
  renderField,
  settle,
  unmountField,
} from "./rich-text-test-harness";
import {
  $baselinePoint,
  at,
  itemPoint,
  keys,
  letter,
  LI,
  mount,
  short,
  stateSpaceValues,
} from "./rich-text-line-test-kit";

const BASE = "2a96a451309fdb15aa54b6e291f49a12a9cdba99";

const editableValues = (): string[] => {
  const all: unknown[] = [
    ...corpus.entries.map((entry) => entry.input),
    ...roundtrip.cases.flatMap((entry) => [entry.input, entry.stored]),
    ...roundtrip.readOnly.map((entry) => entry.input),
    ...stateSpaceValues(2),
  ];
  const seen = new Set<string>();
  for (const value of all) {
    if (
      typeof value === "string" &&
      value !== "" &&
      getRichTextReadOnlyReason(value) === undefined
    ) {
      seen.add(value);
    }
  }
  return [...seen];
};

const TAGS = new Set(
  "p h1 h2 h3 h4 h5 h6 pre blockquote ul ol li hr img figure a strong em u s code br".split(
    " "
  )
);

type Rect = [number, number, number, number];
type Entry = { kind: string; text?: string; rect: Rect };

/** Values under which an element carries the caret-line mark. */
const markedValues: string[] = [];

const measure = (): Entry[] => {
  const root = editable()!;
  const origin = root.getBoundingClientRect();
  const rectOf = (box: DOMRect): Rect => [
    Math.round(box.left - origin.left),
    Math.round(box.top - origin.top),
    Math.round(box.width),
    Math.round(box.height),
  ];
  const entries: Entry[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.selectNodeContents(node);
      entries.push({
        kind: "text",
        text: node.textContent ?? "",
        rect: rectOf(range.getBoundingClientRect()),
      });
      return;
    }
    if (node instanceof HTMLElement) {
      const tag = node.tagName.toLowerCase();
      // The reconciler's own line break, which the head also adds to an
      // element whose last child is a line break.
      const isOwnBreak =
        tag === "br" &&
        (
          node.parentElement as
            | (HTMLElement & { __lexicalLineBreak?: unknown })
            | null
        )?.__lexicalLineBreak === node;
      if (TAGS.has(tag) && isOwnBreak === false) {
        entries.push({
          kind: tag,
          rect: rectOf(node.getBoundingClientRect()),
        });
      }
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };
  for (const child of Array.from(root.childNodes)) {
    walk(child);
  }
  return entries;
};

const measureAll = async () => {
  const values: Array<{ html: string; entries: Entry[] }> = [];
  for (const html of editableValues()) {
    await renderField(html);
    await settle();
    const element = editable()!;
    await fontsLoaded(element);
    await Promise.all(
      Array.from(element.querySelectorAll("img")).map((img) =>
        img.decode().catch(() => {})
      )
    );
    values.push({ html, entries: measure() });
    if (element.querySelector("[data-cms-caret]") !== null) {
      markedValues.push(html);
    }
    unmountField();
  }
  return values;
};

const recording = () =>
  (
    server.config as unknown as {
      snapshotOptions?: { updateSnapshot?: string };
    }
  ).snapshotOptions?.updateSnapshot === "all";

const differs = (entry: Entry, other: Entry | undefined) =>
  other === undefined ||
  entry.kind !== other.kind ||
  entry.text !== other.text ||
  entry.rect.some((number, n) => Math.abs(number - other.rect[n]) > 1);

describe("section 10: layout equals the baseline recorded at main", () => {
  test("every editable stored value lays out as at the baseline, to the pixel", async () => {
    const values = await measureAll();
    if (recording()) {
      await expect(
        JSON.stringify({ base: BASE, values }, null, 2) + "\n"
      ).toMatchFileSnapshot("./__fixtures__/rich-text-line-layout.json");
      return;
    }
    const baseline = recorded.values as unknown as typeof values;
    expect(values.map((value) => value.html)).toEqual(
      baseline.map((value) => value.html)
    );
    const failures: string[] = [];
    values.forEach((value, index) => {
      const wanted = baseline[index].entries;
      const at = value.entries.findIndex((entry, i) =>
        differs(entry, wanted[i])
      );
      if (at !== -1 || value.entries.length !== wanted.length) {
        const place = at === -1 ? value.entries.length : at;
        failures.push(
          `${value.html}: entry ${place} is ${JSON.stringify(value.entries[place])} but the baseline has ${JSON.stringify(wanted[place])} (${value.entries.length} entries against ${wanted.length})`
        );
      }
    });
    expect(failures).toEqual([]);
    // with no caret in the field, no element carries the caret-line mark
    expect(markedValues).toEqual([]);
  }, 600_000);
});

// ---------------------------------------------------------------------------
// Section 4: the reconciler's added line break and the caret-line mark

type WithLineBreak = HTMLElement & { __lexicalLineBreak?: HTMLElement | null };

const textRect = (word: string, offset = 0, length = word.length) => {
  const root = editable()!;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const at = (node as Text).data.indexOf(word);
    if (at !== -1) {
      const range = document.createRange();
      range.setStart(node, at + offset);
      range.setEnd(node, at + offset + length);
      return range.getBoundingClientRect();
    }
  }
  throw new Error(`no text ${word}`);
};

/** The line element that holds `word`, or the middle item's only line. */
const lineElement = (word?: string): WithLineBreak => {
  const lines = Array.from(
    editable()!.querySelectorAll<WithLineBreak>("[data-cms-line]")
  );
  const line =
    word === undefined
      ? lines[0]
      : lines.find((each) => (each.textContent ?? "").includes(word));
  expect(line, `the line of ${word ?? "the item"}`).toBeDefined();
  return line!;
};

const middleItem = () => editable()!.querySelectorAll("li")[1];
const quoteTop = () =>
  editable()!.querySelector("blockquote")!.getBoundingClientRect().top;
/** One row: the field's line height. */
const rowHeight = () => parseFloat(getComputedStyle(middleItem()).lineHeight);
const marked = () => editable()!.querySelectorAll("[data-cms-caret]").length;

const ready = async () => {
  await settle();
  await fontsLoaded(editable()!);
};

/** The caret's first client rect, or the reconciler's added break's rect. */
const caretRect = (line: WithLineBreak) => {
  const range = window.getSelection()!.getRangeAt(0);
  const rects = range.getClientRects();
  if (rects.length > 0 && rects[0].height > 0) {
    return rects[0];
  }
  return line.__lexicalLineBreak!.getBoundingClientRect();
};

const near = (value: number, wanted: number, label: string) =>
  expect(
    Math.abs(value - wanted),
    `${label}: ${value} against ${wanted}`
  ).toBeLessThanOrEqual(1);

describe("section 4: the reconciler's added line break and the caret-line mark", () => {
  test("a stored line break before a block is drawn and the reconciler's is not", async () => {
    await mount(LI("T0w<br><blockquote><p>Q2w</p></blockquote>"));
    await ready();
    const h = textRect("T0w").height;
    const line = lineElement("T0w");
    near(line.getBoundingClientRect().height, h, "the line's height");
    const added = line.__lexicalLineBreak;
    expect(added, "the reconciler's added break").toBeTruthy();
    const stored = Array.from(line.querySelectorAll("br")).find(
      (br) => br !== added
    );
    expect(stored, "the stored break").toBeDefined();
    expect(getComputedStyle(stored!).display).not.toBe("none");
    expect(getComputedStyle(added!).display).toBe("none");

    await mount(LI("<br><blockquote><p>Q1w</p></blockquote>"));
    await ready();
    near(
      quoteTop() - middleItem().getBoundingClientRect().top,
      rowHeight(),
      "the quote's top below the item's top"
    );
  });

  test("the one break of an empty caret line is drawn", async () => {
    await mount(LI("T0w<hr>"));
    await ready();
    const unfocused = middleItem().getBoundingClientRect().height;
    const row = rowHeight();
    await itemPoint(1, 2)();
    await ready();
    const empty = Array.from(
      editable()!.querySelectorAll<HTMLElement>("[data-cms-line]")
    ).find((line) => (line.textContent ?? "") === "");
    expect(empty, "the empty caret line").toBeDefined();
    expect(empty!.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      row - 1
    );
    // one row taller: the empty line's row, and the rule's bottom margin,
    // which collapsed through the item's end while the rule ended the item
    const margin = parseFloat(
      getComputedStyle(editable()!.querySelector("hr")!).marginBottom
    );
    near(
      middleItem().getBoundingClientRect().height,
      unfocused + row + margin,
      "the item with the caret line"
    );
    await at("Nw")();
    await ready();
    near(
      middleItem().getBoundingClientRect().height,
      unfocused,
      "the item once the caret left"
    );
  });

  test("a caret after the stored break in a line before a block stands on the row the next letter lands on", async () => {
    await mount(LI("T0w<br><blockquote><p>Q2w</p></blockquote>"));
    await ready();
    await itemPoint(1, 2)();
    await ready();
    const line = lineElement("T0w");
    expect(line.hasAttribute("data-cms-caret"), "the mark").toBe(true);
    const caret = caretRect(line);
    expect(caret.top).toBeGreaterThanOrEqual(textRect("T0w").bottom - 1);
    expect(caret.bottom).toBeLessThanOrEqual(quoteTop() + 1);
    await letter();
    await ready();
    near(textRect("k").top, caret.top, "the letter's row");
  });

  test("the caret-line mark: the caret and the next letter share a row at BQ el1", async () => {
    await mount(LI("<br><blockquote><p>Q1w</p></blockquote>"));
    await ready();
    await itemPoint(1, 1)();
    await ready();
    const line = lineElement();
    expect(line.hasAttribute("data-cms-caret"), "the mark").toBe(true);
    const caret = caretRect(line);
    await letter();
    await ready();
    near(textRect("k").top, caret.top, "the letter's row");
  });

  test("the caret-line mark: moving the caret out of the line removes the mark", async () => {
    await mount(LI("<br><blockquote><p>Q1w</p></blockquote>"));
    await ready();
    const row = rowHeight();
    await itemPoint(1, 1)();
    await ready();
    expect(lineElement().hasAttribute("data-cms-caret"), "the mark").toBe(true);
    near(
      quoteTop() - middleItem().getBoundingClientRect().top,
      2 * row,
      "two rows with the mark"
    );
    await at("Q1w", 1)();
    await ready();
    expect(marked(), "no mark").toBe(0);
    near(
      quoteTop() - middleItem().getBoundingClientRect().top,
      row,
      "one row without it"
    );
  });

  test("the caret-line mark is not editor state", async () => {
    const onChange = await mount(LI("<br><blockquote><p>Q1w</p></blockquote>"));
    await ready();
    onChange.mockClear();
    await itemPoint(1, 1)();
    await ready();
    const set = marked();
    await at("Q1w", 1)();
    await ready();
    expect(set, "the mark was set").toBe(1);
    expect(marked(), "and cleared").toBe(0);
    expect(onChange).not.toHaveBeenCalled();
    await keys("{Control>}z{/Control}")();
    await ready();
    expect(onChange, "no undo step").not.toHaveBeenCalled();
    const editor = editorOf()!;
    expect(short(exportRichTextHtml(editor))).not.toContain("data-cms-");
    expect(JSON.stringify(editor.getEditorState().toJSON())).not.toContain(
      "data-cms-caret"
    );
  });

  test("the caret-line mark: a range with one end there counts as the caret does", async () => {
    await mount(LI("<br><blockquote><p>Q1w</p></blockquote>"));
    await ready();
    const row = rowHeight();
    const editor = editorOf()!;
    await click(editable());
    await act(async () => {
      editor.update(() => {
        const items = $getRoot().getAllTextNodes();
        const pw = items.find((text) => text.getTextContent() === "Pw")!;
        const item = pw.getParentOrThrow().getNextSibling() as ElementNode;
        const end = $baselinePoint(item, 1);
        const selection = $createRangeSelection();
        selection.anchor.set(pw.getKey(), 1, "text");
        selection.focus.set(end.key, end.offset, "element");
        $setSelection(selection);
      });
    });
    await ready();
    expect(lineElement().hasAttribute("data-cms-caret"), "the mark").toBe(true);
    near(
      quoteTop() - middleItem().getBoundingClientRect().top,
      2 * row,
      "the added break is drawn"
    );
  });
});
