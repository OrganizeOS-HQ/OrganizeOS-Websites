// 5.1, 5.5, D3 cases 1 to 3, D19 outside Enter, the split's points, the
// figure rule and the headless link rule.
import { describe, expect, test } from "vitest";
import { $createListItemNode, $createListNode } from "@lexical/list";
import { $createQuoteNode } from "@lexical/rich-text";
import { $createHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  createEditor,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type PointType,
} from "lexical";
import {
  at,
  backspace,
  blockType,
  cut,
  del,
  enter,
  expectEdit,
  IMG,
  LI,
  pasteHtml,
  range,
  sameUpdate,
  W,
} from "./rich-text-line-test-kit";
import {
  registerRichTextTransforms,
  richTextHtmlConfig,
  richTextNodes,
  writeRichTextHeadless,
} from "./rich-text-html";
import { registerLineTransforms } from "./rich-text-line-normalise";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { $createCmsLineNode, $isCmsLineNode } from "./rich-text-line-node";

const paragraph = blockType("Paragraph");

/** The value's items as "depth:text", in reading order (as the structure test reads them). */
const outline = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  const lines: string[] = [];
  const walk = (node: Element, depth: number) => {
    for (const child of node.children) {
      if (child.tagName === "UL" || child.tagName === "OL") {
        walk(child, depth + 1);
      } else if (child.tagName === "LI") {
        const own = [...child.childNodes]
          .filter(
            (entry) =>
              entry.nodeType === Node.TEXT_NODE ||
              (entry instanceof Element &&
                ["UL", "OL"].includes(entry.tagName) === false)
          )
          .map((entry) => entry.textContent)
          .join("");
        if (own !== "") {
          lines.push(`${depth}:${own}`);
        }
        walk(child, depth);
      } else if (child.tagName === "BLOCKQUOTE") {
        walk(child, depth + 1);
      } else if (child.tagName === "HR") {
        lines.push(`${depth}:---`);
      } else {
        lines.push(`${depth}:${child.textContent}`);
      }
    }
  };
  walk(template.content as unknown as Element, 0);
  return lines;
};

describe("D3: lines that meet (5.8)", () => {
  test("D3 case 1: a rule between two lines goes, no break", async () => {
    await expectEdit({
      stored: LI("T0w<hr>T2w"),
      place: at("T2w", 0),
      action: backspace,
      write: W("<li>T0wT2w</li>"),
      source: "D3",
    });
  });

  test("D3 case 1, Delete form", async () => {
    await expectEdit({
      stored: LI("T0w<hr>T2w"),
      place: at("T0w"),
      action: del,
      // M10b
      write: "<ul><li>Pw</li><li>T0wT2w</li><li>Nw</li></ul>",
      calls: 1,
      source: "KS2, D3, M10b",
    });
  });

  test("D3 case 1: a quote removed whole, no break", async () => {
    await expectEdit({
      stored: LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"),
      place: range("T0w", 3, "T2w", 0),
      action: backspace,
      write: W("<li>T0wT2w</li>"),
      source: "derived (D3 case 1); measured",
    });
  });

  test("two lines that meet take no line break when the moved text equals the removed block's text", async () => {
    await expectEdit({
      stored: LI("Ax<blockquote><p>Bx</p></blockquote>Bx"),
      place: range("Ax", 2, "Bx", 0, { to: 1 }),
      action: backspace,
      write: W("<li>AxBx</li>"),
      source: 'derived (D3 case 1; 5.8 "from the nodes"); measured',
    });
  });

  test("D3 case 2: Backspace at a line's start joins the block before", async () => {
    await expectEdit({
      stored: LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"),
      place: at("T2w", 0),
      action: backspace,
      write: W("<li>T0w<blockquote><p>Q1wT2w</p></blockquote></li>"),
      source: "D3",
    });
  });

  test("D3 case 2, Delete form", async () => {
    await expectEdit({
      stored: LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"),
      place: at("Q1w"),
      action: del,
      write: W("<li>T0w<blockquote><p>Q1wT2w</p></blockquote></li>"),
      source: "D3",
    });
  });

  test("D3 case 2: QT, Delete at the quote's end (K5's join)", async () => {
    await expectEdit({
      stored: LI("<blockquote><p>Q0w</p></blockquote>T1w"),
      place: at("Q0w"),
      action: del,
      write: W("<li><blockquote><p>Q0wT1w</p></blockquote></li>"),
      source: "D3",
    });
  });

  test("D3 case 1: an empty block removed between two lines takes no break (check 3, 14.6)", async () => {
    const record = await expectEdit({
      stored: LI("T0w<h3></h3>T2w"),
      place: range("T0w", 3, "T2w", 0),
      action: backspace,
      write: W("<li>T0wT2w</li>"),
      source:
        'derived (D3 case 1; 5.8 "from the block\'s nodes, never from the shape alone"); measured',
    });
    // the stored value holds the empty heading
    expect(record.htmlBefore).toBe(LI("T0w<h3></h3>T2w"));
  });

  test("D3: a block of only a line break joins that break as the separator", async () => {
    await expectEdit({
      stored: LI("T0w<h3><br></h3>T2w"),
      place: at("T0w"),
      action: del,
      write: W("<li>T0w<br />T2w</li>"),
      source: 'D3 (check 4, "Ruled with no change")',
    });
  });

  test("D3 case 2: a line joins a quote that holds only an image, and the image stays", async () => {
    await expectEdit({
      stored: LI(`<blockquote><p>${IMG}</p></blockquote>T1w`),
      place: at("T1w", 0),
      action: backspace,
      write: W("<li><blockquote><p><img />T1w</p></blockquote></li>"),
      source: "check 3, Round 14 as reported, 14.6",
    });
  });

  test("D3 case 3: a block's text joins the line before", async () => {
    await expectEdit({
      stored: LI("T0w<pre><code>C1w</code></pre>T2w"),
      place: at("C1w", 0),
      action: backspace,
      write: W("<li>T0wC1w<br />T2w</li>"),
      source: "D3",
    });
  });

  test("D3 case 3, Delete form", async () => {
    await expectEdit({
      stored: LI("T0w<pre><code>C1w</code></pre>T2w"),
      place: at("T0w"),
      action: del,
      write: W("<li>T0wC1w<br />T2w</li>"),
      source: "D3",
    });
  });

  test("D3 case 3: a heading's text joins the line before, Backspace", async () => {
    await expectEdit({
      stored: LI("T0w<h3>H1w</h3>T2w"),
      place: at("H1w", 0),
      action: backspace,
      write: W("<li>T0wH1w<br />T2w</li>"),
      source: "derived (D3 case 3); measured",
    });
  });

  test("D3 case 3: a heading's text joins the line before, Delete", async () => {
    await expectEdit({
      stored: LI("T0w<h3>H1w</h3>T2w"),
      place: at("T0w"),
      action: del,
      write: W("<li>T0wH1w<br />T2w</li>"),
      source: "derived (D3 case 3); measured",
    });
  });

  test("D3 case 3: a heading's text joins a line that ends in a link, outside the link", async () => {
    // P30, ruled by its properties (D3 case 3, 5.8 "outside any link")
    await expectEdit({
      stored: LI('<a href="https://example.org/a">Aw</a><h3>H1w</h3>'),
      place: at("H1w", 0),
      action: backspace,
      writeMatches: (written) => {
        const body = new DOMParser().parseFromString(written, "text/html").body;
        const middle = body.querySelectorAll("li")[1];
        const link = middle.querySelector("a");
        expect(link?.getAttribute("href"), written).toBe(
          "https://example.org/a"
        );
        const walker = document.createTreeWalker(middle, NodeFilter.SHOW_TEXT);
        let moved: Text | undefined;
        for (
          let node = walker.nextNode();
          node !== null;
          node = walker.nextNode()
        ) {
          if ((node as Text).data.includes("H1w")) {
            moved = node as Text;
            break;
          }
        }
        expect(moved, `H1w in ${written}`).toBeDefined();
        expect(moved!.parentElement?.closest("a"), "H1w in no a").toBeNull();
        expect(moved!.parentElement?.closest("li"), "in the same li").toBe(
          middle
        );
        // directly after the link: the li's child that holds it follows the a
        let top: Node = moved!;
        while (top.parentNode !== middle) {
          top = top.parentNode!;
        }
        expect(top.previousSibling, written).toBe(link);
        expect(top.textContent?.startsWith("H1w"), written).toBe(true);
        expect(written.includes("<br"), written).toBe(false);
      },
      source: 'P30: derived (D3 case 3, 5.8 "outside any link"); measured',
    });
  });

  test("D3 case 3 in a quote: a code block's text joins the line before", async () => {
    await expectEdit({
      stored: "<blockquote>X0w<pre><code>C1w</code></pre>X2w</blockquote>",
      place: at("C1w", 0),
      action: backspace,
      write: "<blockquote>X0wC1w<br />X2w</blockquote>",
      source: "derived (D3 case 3); measured",
    });
  });

  test("D3 case 3: Paragraph on a heading in an item", async () => {
    await expectEdit({
      stored: LI("T0w<h3>H1w</h3>T2w"),
      place: at("H1w", 1),
      action: paragraph,
      write: W("<li>T0w<br />H1w<br />T2w</li>"),
      source: "derived (D3 case 3, 5.5); measured",
    });
  });

  test("D3 case 3: Paragraph on a heading after a line that ends in a line break adds none", async () => {
    await expectEdit({
      stored: LI("T0w<br><h3>H1w</h3>T2w"),
      place: at("H1w", 1),
      action: paragraph,
      write: W("<li>T0w<br />H1w<br />T2w</li>"),
      source:
        "derived (D3 case 3: none is added where a line break already stands at that edge); measured",
    });
  });

  test("D3 case 3: Paragraph on a heading after a D19 empty line adds none", async () => {
    await expectEdit({
      stored: LI("<br><h3>H1w</h3>T2w"),
      place: at("H1w", 1),
      action: paragraph,
      write: W("<li><br />H1w<br />T2w</li>"),
      source:
        "derived (D3 case 3 as spec 5.7 applies it at BQ el1; ruling of 2026-11-20); measured",
    });
  });
});

describe("D19 in a lined quote (5.5, 5.8)", () => {
  test("D19: Enter at a paragraph's start in a lined quote leaves a line", async () => {
    await expectEdit({
      stored: "<blockquote><p>X1w</p>X2w</blockquote>",
      place: at("X1w", 0),
      action: enter,
      write: "<blockquote><br /><p>X1w</p>X2w</blockquote>",
      caret: "text:X1w@0",
      source: "ruled, not built at the carry: spec D19 and 5.5, 5.8; T14.14",
    });
  });

  test("D19 in a lined quote: a paste leaves an empty paragraph without the caret", async () => {
    await expectEdit({
      stored: "<blockquote><p>X0w</p>X1w</blockquote>",
      place: at("X0w"),
      action: pasteHtml("<p>Aq</p><p><br></p><p>Bq</p>"),
      write: "<blockquote><p>X0wAq</p><br /><p>Bq</p>X1w</blockquote>",
      source:
        "ruled, not built at the carry: spec D19, 5.5, 5.8; T14.14 (from M53a by D19)",
    });
  });

  test("D19 in a lined quote: a removal leaves an empty paragraph without the caret", async () => {
    await expectEdit({
      stored: "<blockquote><p>X0w</p><p>X1w</p>X2w</blockquote>",
      place: range("X0w", 3, "X1w", 3),
      action: cut,
      // M53b
      write: "<blockquote><p>X0w</p>X2w</blockquote>",
      source: "ruled, not built at the carry: T11.1 (D19, 5.8); T14.14",
    });
  });
});

describe("D19 in a lined quote: the empty paragraph that holds the caret", () => {
  test("D19 in a lined quote: Enter at a paragraph's end leaves the empty paragraph that holds the caret", async () => {
    await expectEdit({
      stored: "<blockquote><p>X0w</p>X1w</blockquote>",
      place: at("X0w"),
      action: enter,
      write: "<blockquote><p>X0w</p><p></p>X1w</blockquote>",
      calls: 1,
      caret: "element:paragraph@0",
      source: "from M36b, ruled T19.2",
    });
  });

  test("D19 in a lined quote: a stored empty paragraph is not turned into a line by a later edit", async () => {
    await expectEdit({
      stored: "<blockquote><p>X0w</p>X1w<p></p></blockquote>",
      place: at("X0w"),
      action: enter,
      write: "<blockquote><p>X0w</p><p></p>X1w<p></p></blockquote>",
      caret: "element:paragraph@0",
      source:
        'derived (D19 "does not become a line later", from M36b): measured at <proto> and <base> (T12.9)',
    });
  });
});

describe("5.5: the lift and the line step", () => {
  test("5.5: two paragraphs pasted after a nested list", async () => {
    await expectEdit({
      stored: "<ul><li>Aw</li></ul>",
      place: at("Aw"),
      action: pasteHtml("<ul><li>Bq</li></ul><p>H1</p><p>H2</p>"),
      // M33
      write: "<ul><li>Aw</li><li>Bq</li></ul><p>H1</p><p>H2</p>",
      calls: 1,
      source: "section 10, 5.5, M33",
    });
  });

  test("5.5: a paste into an item edited in the same update", async () => {
    await expectEdit({
      stored: LI("T0w<blockquote><p>Q1w</p></blockquote>"),
      place: at("T0w"),
      action: sameUpdate("k", "<p>Aq</p><p>Bq</p>"),
      // M34
      write:
        "<ul><li>Pw</li><li>T0wkAq</li></ul><p>Bq</p><blockquote><p>Q1w</p></blockquote><ul><li>Nw</li></ul>",
      calls: 1,
      source: "section 10, M34",
    });
  });

  test("5.5: two paragraphs pasted into a nested item (the lift runs before the line step)", async () => {
    // the input and outline of rich-text-structure.test.tsx's "depth 2,
    // two paragraphs" (spec section 14)
    await expectEdit({
      stored: "<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>",
      place: at("b"),
      action: pasteHtml("<p>one</p><p>two</p>", "x"),
      writeMatches: (written) => {
        expect(outline(sanitizeRichTextHtml(written)), written).toEqual([
          "1:a",
          "2:bone",
          "1:two",
          "2:c",
        ]);
      },
      source: "rich-text-structure.test.tsx, depth 2, two paragraphs (5.5)",
    });
  });
});

// ---------------------------------------------------------------------------
// Node-level cases, in a headless editor

const headless = () => {
  const editor = createEditor({
    namespace: "cms-rich-text-normalise-test",
    nodes: [...richTextNodes],
    html: richTextHtmlConfig,
    onError: (error) => {
      throw error;
    },
  });
  registerRichTextTransforms(editor);
  registerLineTransforms(editor);
  return editor;
};

const discrete = (editor: LexicalEditor, update: () => void) =>
  editor.update(update, { discrete: true });

type Built = { item: string; line: string; a: string; b: string };

/** `<ul><li><blockquote><p>Q0w</p></blockquote>` + a line (bold `Aw`, `Bw`). */
const buildSplitCase = (editor: LexicalEditor): Built => {
  let built: Built | undefined;
  discrete(editor, () => {
    const root = $getRoot();
    root.clear();
    const list = $createListNode("bullet");
    const item = $createListItemNode();
    const quote = $createQuoteNode();
    const inner = $createParagraphNode();
    inner.append($createTextNode("Q0w"));
    quote.append(inner);
    const line = $createCmsLineNode();
    const a = $createTextNode("Aw");
    a.toggleFormat("bold");
    const b = $createTextNode("Bw");
    line.append(a, b);
    item.append(quote, line);
    list.append(item);
    root.append(list);
    built = {
      item: item.getKey(),
      line: line.getKey(),
      a: a.getKey(),
      b: b.getKey(),
    };
  });
  return built!;
};

/**
 * A collapsed element point on the line at `offset`, then a rule spliced
 * into the line at `index`. A headless editor keeps no selection from one
 * update to the next (there is no page selection to read it back from), so
 * the point is set first in the same update, before the splice.
 */
const spliceRule = (
  editor: LexicalEditor,
  key: string,
  offset: number,
  index: number
) =>
  discrete(editor, () => {
    const selection = $createRangeSelection();
    selection.anchor.set(key, offset, "element");
    selection.focus.set(key, offset, "element");
    $setSelection(selection);
    const line = $getNodeByKey(key);
    expect($isCmsLineNode(line)).toBe(true);
    (line as ElementNode).splice(index, 0, [$createHorizontalRuleNode()]);
  });

type Point = { key: string; offset: number; type: string };
type Shape = {
  children: string[];
  lines: string[];
  anchor: Point;
  focus: Point;
  emptyLines: number;
};

const shapeOf = (editor: LexicalEditor, itemKey: string): Shape =>
  editor.getEditorState().read(() => {
    const item = $getNodeByKey(itemKey) as ElementNode;
    const children = item.getChildren().map((child: LexicalNode) =>
      $isCmsLineNode(child)
        ? `line(${child
            .getChildren()
            .map((each) => each.getTextContent())
            .join(",")})`
        : child.getType()
    );
    const lines = item
      .getChildren()
      .filter($isCmsLineNode)
      .map((line) => line.getKey());
    const selection = $getSelection();
    if ($isRangeSelection(selection) === false) {
      throw new Error("no range selection");
    }
    const describe = (point: PointType): Point => ({
      key: point.key,
      offset: point.offset,
      type: point.type,
    });
    const emptyLines = item
      .getChildren()
      .filter((child) => $isCmsLineNode(child) && child.isEmpty()).length;
    return {
      children,
      lines,
      anchor: describe(selection.anchor),
      focus: describe(selection.focus),
      emptyLines,
    };
  });

/** The point is `line` at `offset`, or `text` at `textOffset`. */
const expectPointAt = (
  point: Point,
  line: string,
  offset: number,
  text: string,
  textOffset: number
) => {
  const asLine = point.type === "element" && point.key === line;
  const asText = point.type === "text" && point.key === text;
  expect(
    (asLine && point.offset === offset) ||
      (asText && point.offset === textOffset),
    JSON.stringify(point)
  ).toBe(true);
};

describe("a line split around a block carries its points (5.8)", () => {
  test("a line split around a rule carries an element point before the rule", () => {
    const editor = headless();
    const built = buildSplitCase(editor);
    spliceRule(editor, built.line, 1, 1);
    const shape = shapeOf(editor, built.item);
    expect(shape.children).toEqual([
      "quote",
      "line(Aw)",
      "horizontalrule",
      "line(Bw)",
    ]);
    const [first] = shape.lines;
    for (const point of [shape.anchor, shape.focus]) {
      expect(point.key).not.toBe(built.line);
      expectPointAt(point, first, 1, built.a, 2);
    }
  });

  test("the same, an element point after the rule", () => {
    const editor = headless();
    const built = buildSplitCase(editor);
    spliceRule(editor, built.line, 2, 1);
    const shape = shapeOf(editor, built.item);
    expect(shape.children).toEqual([
      "quote",
      "line(Aw)",
      "horizontalrule",
      "line(Bw)",
    ]);
    const second = shape.lines[1];
    for (const point of [shape.anchor, shape.focus]) {
      expect(point.key).not.toBe(built.line);
      expectPointAt(point, second, 0, built.b, 0);
    }
  });

  test("a line split at its first child leaves no empty half", () => {
    const editor = headless();
    const built = buildSplitCase(editor);
    spliceRule(editor, built.line, 0, 0);
    const shape = shapeOf(editor, built.item);
    expect(shape.children).toEqual(["quote", "horizontalrule", "line(Aw,Bw)"]);
    expect(shape.emptyLines).toBe(0);
    const [only] = shape.lines;
    for (const point of [shape.anchor, shape.focus]) {
      expectPointAt(point, only, 0, built.a, 0);
    }
  });

  test("a line split at its last child leaves no empty half", () => {
    const editor = headless();
    const built = buildSplitCase(editor);
    spliceRule(editor, built.line, 2, 2);
    const shape = shapeOf(editor, built.item);
    expect(shape.children).toEqual(["quote", "line(Aw,Bw)", "horizontalrule"]);
    expect(shape.emptyLines).toBe(0);
    const [only] = shape.lines;
    for (const point of [shape.anchor, shape.focus]) {
      expectPointAt(point, only, 2, built.b, 2);
    }
  });
});

describe("where a line may stand (5.1)", () => {
  test("a line outside an item or quote becomes a paragraph", () => {
    const editor = headless();
    buildSplitCase(editor);
    discrete(editor, () => {
      const line = $createCmsLineNode();
      line.append($createTextNode("Zw"));
      $getRoot().append(line);
    });
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const last = root.getLastChild();
      expect(last?.getType()).toBe("paragraph");
      expect(last?.getTextContent()).toBe("Zw");
      expect(root.getChildren().some($isCmsLineNode)).toBe(false);
    });
  });

  test("a figure never stands in a list item or a quote", () => {
    const figure = `<figure>${IMG}<figcaption>Cw</figcaption></figure>`;
    for (const html of [
      `<ul><li>T0w${figure}</li></ul>`,
      `<blockquote>${figure}</blockquote>`,
    ]) {
      const out = writeRichTextHeadless(html);
      const body = new DOMParser().parseFromString(out, "text/html").body;
      for (const each of Array.from(body.querySelectorAll("figure"))) {
        expect(each.closest("li, blockquote"), out).toBeNull();
      }
    }
  });

  test("control: the headless writer registers the link rule", () => {
    const out = writeRichTextHeadless(
      '<ul><li>T0w<a href="https://example.org/">L<hr>w</a><blockquote><p>Q1w</p></blockquote></li></ul>'
    );
    const body = new DOMParser().parseFromString(out, "text/html").body;
    const rules = body.querySelectorAll("hr");
    expect(rules.length, out).toBe(1);
    for (const link of Array.from(body.querySelectorAll("a"))) {
      expect(link.querySelector("hr"), out).toBeNull();
    }
    const item = body.querySelector("li")!;
    expect(rules[0].parentElement, out).toBe(item);
    expect(item.textContent).toContain("L");
    expect(item.textContent).toContain("w");
    const linked = (letter: string) =>
      Array.from(item.querySelectorAll("a")).some(
        (link) =>
          link.getAttribute("href") === "https://example.org/" &&
          (link.textContent ?? "").includes(letter)
      );
    expect(linked("L"), out).toBe(true);
    expect(linked("w"), out).toBe(true);
    const quote = body.querySelector("blockquote");
    expect(quote?.textContent, out).toContain("Q1w");
  });
});

describe("D3 case 3: a block's text joins the line before, and an empty line after the block stays (T59 defect 9)", () => {
  // The line break that is the whole of an empty line does not stand at
  // the edge (D3): the join adds its line break, and the empty line keeps
  // its own (T23.1: a line of one line break is an empty paragraph).
  const cases = [
    ["a heading", LI("T0w<h3>H1w</h3><br>"), "H1w"],
    ["a code block", LI("T0w<pre><code>C1w</code></pre><br>"), "C1w"],
  ] as const;
  for (const [name, stored, word] of cases) {
    test(`${name}, Backspace at its start`, async () => {
      await expectEdit({
        stored,
        place: at(word, 0),
        action: backspace,
        write: W(`<li>T0w${word}<br /><br /></li>`),
        source: "D3 case 3; acceptance check defect 9",
      });
    });
    test(`${name}, Delete at the line's end`, async () => {
      await expectEdit({
        stored,
        place: at("T0w"),
        action: del,
        write: W(`<li>T0w${word}<br /><br /></li>`),
        source: "D3 case 3; acceptance check defect 9",
      });
    });
    test(`${name}, Backspace over a range from the line into the block`, async () => {
      await expectEdit({
        stored,
        place: range("T0w", 1, word, 2),
        action: backspace,
        write: W("<li>Tw<br /><br /></li>"),
        source: "D3 case 3; acceptance check defect 9",
      });
    });
  }
});
