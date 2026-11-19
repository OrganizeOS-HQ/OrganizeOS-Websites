// Lists and quotes the editor shapes (backstop-round verification: B4,
// B5, B6): a paste never nests past the platform's depth limit, a paste into
// a nested item keeps the untouched items where they were, and a list over
// part of a quote takes only the covered blocks out of it.
import "@webstudio-is/design-system/global.css";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  PASTE_COMMAND,
  type LexicalEditor,
} from "lexical";
import { $isLinkNode } from "@lexical/link";
import { $findMatchingParent } from "@lexical/utils";
import { $generateJSONFromSelectedNodes } from "@lexical/clipboard";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import {
  getRichTextReadOnlyReason,
  writeRichTextHeadless,
} from "./rich-text-html";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
});

const settle = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const editable = () =>
  document.querySelector<HTMLElement>('[contenteditable="true"]');

const editorOf = () =>
  (editable() as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null)
    ?.__lexicalEditor;

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await userEvent.click(element!);
  await settle();
};

/** Mounts the field holding `html`, with `props` added. */
const renderField = async (
  html: string,
  props: Partial<RichTextFieldProps> = {}
) => {
  const onChange = vi.fn<RichTextFieldProps["onChange"]>();
  container = document.createElement("div");
  container.style.width = "480px";
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(RichTextField, {
          id: "cms-field-body",
          labelId: "cms-field-body-label",
          value: { html },
          onChange,
          onOpenClassic: vi.fn(),
          ...props,
        })
      )
    );
  });
  await settle();
  return onChange;
};

/**
 * Mounts `html` and puts the selection from the text `from` at `fromOffset`
 * to the text `to` at `toOffset` (a caret when `to` is left out). An offset
 * left out is the text's end.
 */
const mountAt = async (
  html: string,
  from: string,
  fromOffset?: number,
  to?: string,
  toOffset?: number
) => {
  const onChange = await renderField(html);
  await click(editable());
  await act(async () => {
    editorOf()!.update(() => {
      const texts = $getRoot().getAllTextNodes();
      const find = (word: string) => {
        const node = texts.find((text) => text.getTextContent() === word);
        expect(node, word).toBeDefined();
        return node!;
      };
      if (from === "") {
        $getRoot().selectEnd();
        return;
      }
      const start = find(from);
      const end = find(to ?? from);
      const selection = start.select(
        fromOffset ?? start.getTextContentSize(),
        fromOffset ?? start.getTextContentSize()
      );
      if (to !== undefined) {
        selection.focus.set(
          end.getKey(),
          toOffset ?? end.getTextContentSize(),
          "text"
        );
      }
    });
  });
  await settle();
  return onChange;
};

const lastHtml = (onChange: ReturnType<typeof vi.fn>) =>
  (onChange.mock.lastCall?.[0] as { html: string } | null)?.html ?? "";

const paste = (data: Record<string, string>) => {
  const clipboardData = new DataTransfer();
  for (const [format, text] of Object.entries(data)) {
    clipboardData.setData(format, text);
  }
  act(() => {
    editable()!.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      })
    );
  });
};

const undo = async () => {
  await userEvent.keyboard("{Control>}z{/Control}");
  await settle();
};

/** The saved value reopens editable, and a load and save keeps it. */
const expectFixedPoint = (html: string) => {
  const stored = sanitizeRichTextHtml(html);
  expect(getRichTextReadOnlyReason(stored)).toBeUndefined();
  expect(sanitizeRichTextHtml(writeRichTextHeadless(stored))).toBe(stored);
};

/** The value's items as "depth:text", in reading order. */
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

// B5: the untouched items keep their order and level
describe("blocks pasted into a nested item keep the untouched items in place", () => {
  test.each([
    {
      name: "depth 2, two paragraphs",
      html: "<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>",
      at: "b",
      paste: "<p>one</p><p>two</p>",
      outline: ["1:a", "2:bone", "1:two", "2:c"],
    },
    {
      name: "depth 3, two paragraphs",
      html: "<ul><li>a<ul><li>b<ul><li>c</li><li>d</li></ul></li><li>e</li></ul></li></ul>",
      at: "c",
      paste: "<p>one</p><p>two</p>",
      outline: ["1:a", "2:b", "3:cone", "2:two", "3:d", "2:e"],
    },
    {
      name: "depth 3, a rule",
      html: "<ul><li>a<ul><li>b<ul><li>c</li></ul></li><li>e</li></ul></li></ul>",
      at: "c",
      paste: "<p>one</p><hr><p>two</p>",
      outline: ["1:a", "2:b", "3:cone", "0:---", "0:two", "2:e"],
    },
    {
      name: "depth 3, a rule before the rest of the list",
      html: "<ul><li>a<ul><li>b<ul><li>c</li><li>d</li></ul></li><li>e</li></ul></li><li>f</li></ul>",
      at: "c",
      paste: "<p>one</p><hr><p>two</p>",
      outline: ["1:a", "2:b", "3:cone", "0:---", "0:two", "3:d", "2:e", "1:f"],
    },
    {
      name: "depth 4, two paragraphs",
      html: "<ul><li>a<ul><li>b<ul><li>c<ul><li>d</li><li>x</li></ul></li><li>y</li></ul></li><li>z</li></ul></li></ul>",
      at: "d",
      paste: "<p>one</p><p>two</p>",
      outline: ["1:a", "2:b", "3:c", "4:done", "3:two", "4:x", "3:y", "2:z"],
    },
  ])("$name", async ({ html, at, paste: pasted, outline: expected }) => {
    const onChange = await mountAt(html, at);
    paste({ "text/html": pasted, "text/plain": "x" });
    await settle();
    const written = lastHtml(onChange);
    expect(outline(sanitizeRichTextHtml(written))).toEqual(expected);
    expectFixedPoint(written);
  });
});

/** `levels` lists, each item named `${name}${level}`, nested in one another. */
const nestedList = (levels: number, name = "L") => {
  let html = "";
  for (let level = levels; level >= 1; level -= 1) {
    html = `<ul><li>${name}${level}${html}</li></ul>`;
  }
  return html;
};

/** The items' and blocks' texts in reading order. */
const texts = (html: string) =>
  outline(html)
    .map((line) => line.slice(line.indexOf(":") + 1))
    .filter((text) => text !== "");

/** The field's content as drawn, for comparing before and after an undo. */
const drawn = () => outline(editable()!.innerHTML);

// B4: the depth limit holds whatever made the nesting
describe("a paste never nests a list or quote past the depth limit", () => {
  const LIMIT_CASES = [
    {
      name: "a 7-level list into a level-2 item",
      html: "<ul><li>s1<ul><li>s2</li></ul></li></ul>",
      at: "s2",
      paste: nestedList(7),
      order: ["s1", "s2", "L1", "L2", "L3", "L4", "L5", "L6", "L7"],
    },
    {
      name: "a 6-level list into a level-3 item",
      html: "<ul><li>s1<ul><li>s2<ul><li>s3</li></ul></li></ul></li></ul>",
      at: "s3",
      paste: nestedList(6),
      order: ["s1", "s2", "s3", "L1", "L2", "L3", "L4", "L5", "L6"],
    },
    {
      name: "a 5-level list into a level-4 item",
      html: nestedList(4, "s"),
      at: "s4",
      paste: nestedList(5),
      order: ["s1", "s2", "s3", "s4", "L1", "L2", "L3", "L4", "L5"],
    },
    {
      name: "a 9-level list after a quote's paragraph",
      html: "<blockquote><p>s</p></blockquote>",
      at: "s",
      paste: nestedList(9),
      order: ["s", "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9"],
    },
    {
      name: "lists held directly in lists, 9 deep, into an empty field",
      html: "<p></p>",
      at: "",
      paste:
        "<ul><li>L1</li><ul><li>L2</li><ul><li>L3</li><ul><li>L4</li><ul><li>L5</li><ul><li>L6</li><ul><li>L7</li><ul><li>L8</li><ul><li>L9</li></ul></ul></ul></ul></ul></ul></ul></ul></ul>",
      order: ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9"],
    },
    {
      name: "a 12-level list into an empty field",
      html: "<p></p>",
      at: "",
      paste: nestedList(12),
      order: Array.from({ length: 12 }, (_, index) => `L${index + 1}`),
    },
    {
      name: "8 nested quotes after a paragraph",
      html: "<p>s</p>",
      at: "s",
      paste: `${"<blockquote>".repeat(8)}<p>q</p>${"</blockquote>".repeat(8)}`,
      order: ["s", "q"],
    },
  ];

  test.each(LIMIT_CASES)(
    "$name",
    async ({ html, at, paste: pasted, order }) => {
      const onChange = await mountAt(html, at);
      const before = drawn();
      paste({ "text/html": pasted, "text/plain": "x" });
      await settle();
      const written = lastHtml(onChange);
      expectFixedPoint(written);
      expect(texts(sanitizeRichTextHtml(written)).join("|")).toBe(
        order.join("|")
      );
      await undo();
      expect(drawn()).toEqual(before);
    }
  );

  test("the field's own copy of a 7-level list, at the end of a level-3 item", async () => {
    const onChange = await mountAt(
      `<ul><li>s1<ul><li>s2<ul><li>s3</li></ul></li></ul></li></ul><p>p</p>${nestedList(7)}`,
      "L1",
      0,
      "L7"
    );
    let copied = "";
    // as the field's Copy writes it
    await act(async () => {
      editorOf()!.update(() => {
        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        copied = JSON.stringify(
          $generateJSONFromSelectedNodes(editorOf()!, selection)
        );
      });
    });
    await act(async () => {
      editorOf()!.update(() => {
        const s3 = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === "s3")!;
        s3.select(2, 2);
      });
    });
    await settle();
    const before = drawn();
    paste({
      "application/x-lexical-editor": copied,
      "text/html": nestedList(7),
      "text/plain": "x",
    });
    await settle();
    const written = lastHtml(onChange);
    expectFixedPoint(written);
    expect(texts(sanitizeRichTextHtml(written)).slice(0, 11).join("|")).toBe(
      "s1|s2|s3|L1|L2|L3|L4|L5|L6|L7|p"
    );
    await undo();
    expect(drawn()).toEqual(before);
  });
});

/** The value as the platform stores it, with the editor's own attributes gone. */
const plain = (html: string) =>
  sanitizeRichTextHtml(html).replace(/ value="\d+"/g, "");

// B6: a list over part of a quote takes only the covered blocks out of it
describe("a list over part of a quote", () => {
  test.each([
    {
      name: "A, from before the quote into its second block",
      html: "<p>before</p><blockquote><p>one</p><p>two</p><p>three</p></blockquote><p>after</p>",
      from: ["before", 2],
      to: ["two", 1],
      list: "Bulleted list",
      written:
        "<ul><li>before</li><li>one</li><li>two</li></ul><blockquote><p>three</p></blockquote><p>after</p>",
    },
    {
      name: "A, from its second block to after the quote",
      html: "<p>before</p><blockquote><p>one</p><p>two</p><p>three</p></blockquote><p>after</p>",
      from: ["two", 1],
      to: ["after", 2],
      list: "Bulleted list",
      written:
        "<p>before</p><blockquote><p>one</p></blockquote><ul><li>two</li><li>three</li><li>after</li></ul>",
    },
    {
      name: "B, across two quotes",
      html: "<blockquote><p>a1</p><p>a2</p></blockquote><blockquote><p>b1</p><p>b2</p></blockquote>",
      from: ["a2", 1],
      to: ["b1", 1],
      list: "Bulleted list",
      written:
        "<blockquote><p>a1</p></blockquote><ul><li>a2</li><li>b1</li></ul><blockquote><p>b2</p></blockquote>",
    },
    {
      name: "C, in nested quotes",
      html: "<blockquote><blockquote><p>aa</p><p>bb</p></blockquote><p>cc</p></blockquote>",
      from: ["bb", 1],
      to: undefined,
      list: "Bulleted list",
      written:
        "<blockquote><blockquote><p>aa</p></blockquote></blockquote><ul><li>bb</li></ul><blockquote><p>cc</p></blockquote>",
    },
    {
      name: "D, a quote in a list item",
      html: "<ul><li><p>x1</p><blockquote><p>a1</p><p>b1</p></blockquote></li></ul>",
      from: ["a1", 1],
      to: undefined,
      list: "Numbered list",
      written:
        "<ol><li>x1<blockquote><p>a1</p><p>b1</p></blockquote></li></ol>",
    },
  ])("$name", async ({ html, from, to, list, written: expected }) => {
    const onChange = await mountAt(
      html,
      from[0] as string,
      from[1] as number,
      to?.[0] as string | undefined,
      to?.[1] as number | undefined
    );
    const before = drawn();
    await click(byLabel(list));
    const written = lastHtml(onChange);
    expect(plain(written)).toBe(expected);
    expectFixedPoint(written);
    await undo();
    expect(drawn()).toEqual(before);
  });
});

// Round 6
/** Puts the anchor on the first link as an element point at its start. */
const anchorOnLink = (to: string) => async () => {
  await act(async () => {
    editorOf()!.update(() => {
      const link = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === to)!;
      const linkNode = $findMatchingParent(
        $getRoot()
          .getAllTextNodes()
          .find((node) => $isLinkNode(node.getParent()))!,
        $isLinkNode
      )!;
      const selection = $createRangeSelection();
      selection.anchor.set(linkNode.getKey(), 0, "element");
      selection.focus.set(link.getKey(), link.getTextContentSize(), "text");
      $setSelection(selection);
    });
  });
  await settle();
};

const cut = async () => {
  await act(async () => {
    editable()!.dispatchEvent(
      new ClipboardEvent("cut", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer(),
      })
    );
  });
  await settle();
};

describe("an edit from an element point on a link (K1)", () => {
  const STORED =
    '<p>Keep before</p><p>Read more:<a href="https://example.org/"><br />our site</a></p><p>Next para</p><p>Keep after</p>';
  test.each([
    ["Backspace", () => userEvent.keyboard("{Backspace}")],
    ["Delete", () => userEvent.keyboard("{Delete}")],
    ["Cut", cut],
    ["Enter", () => userEvent.keyboard("{Enter}")],
    [
      "a paste",
      async () => {
        paste({ "text/html": "<p>z</p>", "text/plain": "z" });
      },
    ],
  ])(
    "%s keeps the text outside the selection and finishes within a second",
    async (_name, run) => {
      const onChange = await mountAt(STORED, "Keep before");
      await anchorOnLink("Next para")();
      const start = performance.now();
      await run();
      await settle();
      expect(performance.now() - start).toBeLessThan(1000);
      const text = editable()!.textContent ?? "";
      expect(text).toContain("Keep before");
      expect(text).toContain("Read more:");
      expect(text).toContain("Keep after");
      expect(text).not.toContain("our site");
      const written = lastHtml(onChange);
      expect(written).toContain("Read more:");
      expectFixedPoint(written);
    },
    60_000
  );

  test("Backspace over a link holding a line break and the next block keeps the text before it", async () => {
    const onChange = await mountAt(
      '<p>x<a href="https://example.org/"><br />yy</a></p><p>stray</p>',
      "x"
    );
    await anchorOnLink("stray")();
    await userEvent.keyboard("{Backspace}");
    await settle();
    expect(editable()!.textContent).toBe("x");
    expect(lastHtml(onChange)).toContain("x");
  });
});

describe("the rest of a split list nests in its own item (K2)", () => {
  /** Whether a drawn item holding text also holds a list. */
  const itemWithTextAndList = () =>
    [...editable()!.querySelectorAll("li")].some(
      (item) =>
        item.querySelector(":scope > ul, :scope > ol") !== null &&
        [...item.childNodes].some(
          (child) =>
            child instanceof Element &&
            ["UL", "OL"].includes(child.tagName) === false &&
            (child.textContent ?? "") !== ""
        )
    );
  const placeCaret = async (text: string, offset: number) => {
    await act(async () => {
      editorOf()!.update(() => {
        $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === text)!
          .select(offset, offset);
      });
    });
    await settle();
  };

  test.each([
    ["Backspace at d's start", "d", 0, "{Backspace}"],
    ["Backspace twice at d's end", "d", 1, "{Backspace}{Backspace}"],
  ])(
    "depth 3, then %s, keeps the pasted text",
    async (_name, at, offset, keys) => {
      const onChange = await mountAt(
        "<ul><li>a<ul><li>b<ul><li>c</li><li>d</li></ul></li><li>e</li></ul></li></ul>",
        "c"
      );
      paste({ "text/html": "<p>one</p><p>two</p>", "text/plain": "x" });
      await settle();
      expect(itemWithTextAndList()).toBe(false);
      await placeCaret(at, offset);
      await userEvent.keyboard(keys);
      await settle();
      const written = lastHtml(onChange);
      expect(written).toContain("two");
      expectFixedPoint(written);
    }
  );

  test("depth 2, then Heading 2 on the next item, keeps the pasted text", async () => {
    const onChange = await mountAt(
      "<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>",
      "b"
    );
    paste({ "text/html": "<p>one</p><p>two</p>", "text/plain": "x" });
    await settle();
    expect(itemWithTextAndList()).toBe(false);
    await placeCaret("c", 1);
    await click(byLabel("Block type"));
    await click(
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (option) => option.textContent === "Heading 2"
      )
    );
    const written = lastHtml(onChange);
    expect(written).toContain("two");
    expect(written).toContain("c");
  });
});

describe("a figure pasted into a nested list item (K4)", () => {
  const figureNode = (alt: string) => ({
    type: "cms-figure",
    version: 1,
    attributes: {
      src: `https://example.org/${alt}.png`,
      alt,
      width: null,
      height: null,
      title: null,
    },
    caption: `Cap${alt}`,
  });
  const pasteNodes = (nodes: unknown[]) =>
    paste({
      "application/x-lexical-editor": JSON.stringify({
        namespace: editorOf()!._config.namespace,
        nodes,
      }),
      "text/plain": "x",
    });
  const nested = (outer: string, middle: string, inner: string) =>
    `<${outer}><li>aa<${middle}><li>bb<${inner}><li>qqrr</li><li>dd</li></${inner}></li><li>ee</li></${middle}></li><li>ff</li></${outer}>`;

  test.each([
    ["ul", "ul", "ul"],
    ["ol", "ol", "ol"],
    ["ol", "ul", "ol"],
  ])(
    "one figure in a %s/%s/%s list keeps each untouched item's level and type",
    async (outer, middle, inner) => {
      const html = nested(outer, middle, inner);
      const onChange = await mountAt(html, "qqrr", 2);
      pasteNodes([figureNode("F")]);
      await settle();
      const written = sanitizeRichTextHtml(lastHtml(onChange));
      expect(outline(written)).toEqual([
        "1:aa",
        "2:bb",
        "3:qq",
        "0:CapF",
        "3:rr",
        "3:dd",
        "2:ee",
        "1:ff",
      ]);
      // the list types, outermost first, of each untouched item
      const typesOf = (text: string) => {
        const template = document.createElement("template");
        template.innerHTML = written;
        const item = [...template.content.querySelectorAll("li")].find(
          (li) => li.firstChild?.textContent === text
        )!;
        const types: string[] = [];
        for (let at: Element | null = item; at; at = at.parentElement) {
          if (at.tagName === "UL" || at.tagName === "OL") {
            types.unshift(at.tagName.toLowerCase());
          }
        }
        return types.join("/");
      };
      expect(typesOf("dd")).toBe(`${outer}/${middle}/${inner}`);
      expect(typesOf("ee")).toBe(`${outer}/${middle}`);
      expect(typesOf("ff")).toBe(outer);
      expectFixedPoint(lastHtml(onChange));
    }
  );

  test.each([
    ["two figures", [figureNode("F"), figureNode("G")]],
    [
      "a figure, a paragraph and a figure",
      [
        figureNode("F"),
        {
          type: "paragraph",
          version: 1,
          children: [
            {
              type: "text",
              version: 1,
              text: "mid",
              format: 0,
              detail: 0,
              mode: "normal",
              style: "",
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
        },
        figureNode("G"),
      ],
    ],
  ])("%s pasted into a level-2 item keep every image", async (_name, nodes) => {
    const onChange = await mountAt(
      "<ul><li>aa<ul><li>bb</li><li>cc</li></ul></li><li>ff</li></ul>",
      "bb"
    );
    pasteNodes(nodes);
    await settle();
    const written = lastHtml(onChange);
    expect(written.match(/<figure/g)).toHaveLength(2);
    expect(written).toContain("cc");
    expect(written).toContain("ff");
    expectFixedPoint(written);
  });
});

describe("the depth lift keeps the reading order (K5)", () => {
  test("a quote holding a list, pasted at the end of a 7-level list", async () => {
    const onChange = await mountAt(nestedList(7), "L7");
    paste({
      "text/html":
        "<ul><li>a<blockquote><p>q</p><ul><li>x</li></ul><p>z</p></blockquote></li></ul>",
      "text/plain": "x",
    });
    await settle();
    const written = lastHtml(onChange);
    expect(texts(sanitizeRichTextHtml(written)).join("|")).toBe(
      "L1|L2|L3|L4|L5|L6|L7|a|q|x|z"
    );
    expectFixedPoint(written);
  });
});

describe("a list never stays in a heading or paragraph (K6)", () => {
  test("a list item in a heading, pasted at the depth limit, writes an editable value", async () => {
    const onChange = await mountAt("<p>s</p>", "s");
    let quotes = "";
    for (let level = 8; level >= 1; level -= 1) {
      quotes = `<blockquote><p>e${level}</p>${quotes}</blockquote>`;
    }
    paste({ "text/html": quotes, "text/plain": "x" });
    await settle();
    await act(async () => {
      editorOf()!.update(() => {
        const e8 = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === "e8")!;
        e8.select(2, 2);
      });
    });
    await settle();
    paste({ "text/html": "<h2><li>hx</li></h2>", "text/plain": "hx" });
    await settle();
    const written = lastHtml(onChange);
    expect(written).toContain("hx");
    expect(written).not.toMatch(/<h2[^>]*>(<[^>]+>)*<(ul|ol)/);
    expectFixedPoint(written);
  });
});

describe("a list's type changes in place inside a quote (K8)", () => {
  test("Numbered list on a bulleted list in a quote keeps it in the quote", async () => {
    const onChange = await mountAt(
      "<blockquote><p>Steps:</p><ul><li>one</li><li>two</li></ul><p>end</p></blockquote>",
      "one",
      1
    );
    await click(byLabel("Numbered list"));
    expect(sanitizeRichTextHtml(lastHtml(onChange))).toBe(
      "<blockquote><p>Steps:</p><ol><li>one</li><li>two</li></ol><p>end</p></blockquote>"
    );
  });
});

describe("what follows a pasted item's nested list stays after it (K5)", () => {
  test("an item's quote after its nested list, pasted at the end of a 7-level list", async () => {
    const onChange = await mountAt(nestedList(7), "L7");
    paste({
      "text/html":
        "<ul><li>a<ul><li>x</li></ul><blockquote><p>z</p></blockquote></li></ul>",
      "text/plain": "x",
    });
    await settle();
    const written = lastHtml(onChange);
    expect(texts(sanitizeRichTextHtml(written)).join("|")).toBe(
      "L1|L2|L3|L4|L5|L6|L7|a|x|z"
    );
    expectFixedPoint(written);
  });
});

describe("a block pasted at the end of a deep list's last item leaves no empty item (K18)", () => {
  test.each([
    {
      name: "depth 4, nothing after",
      html: nestedList(4),
      at: "L4",
      paste: "<p>one</p><hr><p>two</p>",
      order: "L1|L2|L3|L4one|---|two",
    },
    {
      name: "depth 7, nothing after",
      html: nestedList(7),
      at: "L7",
      paste: "<p>one</p><hr><p>two</p>",
      order: "L1|L2|L3|L4|L5|L6|L7one|---|two",
    },
    {
      name: "depth 7, a quote, nothing after",
      html: nestedList(7),
      at: "L7",
      paste: "<p>one</p><blockquote><p>q</p></blockquote>",
      order: "L1|L2|L3|L4|L5|L6|L7one|q",
    },
    {
      name: "depth 4, a top-level item after",
      html: "<ul><li>a1<ul><li>a2<ul><li>a3<ul><li>a4</li></ul></li></ul></li></ul></li><li>top2</li></ul>",
      at: "a4",
      paste: "<p>one</p><hr><p>two</p>",
      order: "a1|a2|a3|a4one|---|two|top2",
    },
  ])("$name", async ({ html, at, paste: pasted, order }) => {
    const onChange = await mountAt(html, at);
    paste({ "text/html": pasted, "text/plain": "x" });
    await settle();
    const written = sanitizeRichTextHtml(lastHtml(onChange));
    expect(written).not.toMatch(/<li[^>]*><\/li>/);
    expect(
      outline(written)
        .map((line) => line.slice(line.indexOf(":") + 1))
        .join("|")
    ).toBe(order);
    expectFixedPoint(written);
  });
});

describe("quotes pasted into a nested item keep their levels at the top (K19)", () => {
  test("7 nested quotes at the end of a level-3 item", async () => {
    const onChange = await mountAt(
      "<ul><li>s1<ul><li>s2<ul><li>s3</li></ul></li></ul></li></ul>",
      "s3"
    );
    let quotes = "";
    for (let level = 7; level >= 1; level -= 1) {
      quotes = `<blockquote><p>q${level}</p>${quotes}</blockquote>`;
    }
    paste({ "text/html": quotes, "text/plain": "x" });
    await settle();
    const written = sanitizeRichTextHtml(lastHtml(onChange));
    const lines = outline(written);
    expect(lines.filter((line) => /:q\d$/.test(line))).toEqual(
      Array.from({ length: 7 }, (_, index) => `${index + 1}:q${index + 1}`)
    );
    expectFixedPoint(written);
  });
});

describe("what follows a pasted item's nested list and imports to nothing adds no item (H1)", () => {
  const steps = (after: string) =>
    `<ol><li>Open the settings:<ul><li>Click the gear</li></ul>${after}</li><li>Save.</li></ol>`;
  test.each([
    ["an image", '<img src="https://example.org/shot.png" alt="Screenshot">'],
    ["a line break", "<br>"],
    ["an empty span", "<span></span>"],
    ["an empty paragraph", "<p></p>"],
    ["a paragraph holding a line break", "<p><br></p>"],
    ["a space in a span", "<span> </span>"],
    [
      "a figure",
      '<figure><img src="https://example.org/shot.png" alt="Shot"></figure>',
    ],
  ])("%s after the nested list", async (_name, after) => {
    const onChange = await mountAt("<p></p>", "");
    paste({ "text/html": steps(after), "text/plain": "x" });
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).toBe(
      "<ol><li>Open the settings:<ul><li>Click the gear</li></ul></li><li>Save.</li></ol>"
    );
    expectFixedPoint(written);
  });

  test("a rule alone after the nested list adds no item", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({ "text/html": steps("<hr>"), "text/plain": "x" });
    await settle();
    expect(plain(lastHtml(onChange))).toBe(
      "<ol><li>Open the settings:<br /><hr /><ul><li>Click the gear</li></ul></li><li>Save.</li></ol>"
    );
  });

  test("an image after the last pasted item's nested list: typing lands after the list's text", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html":
        '<ul><li>Open<ul><li>Click</li></ul><img src="https://example.org/shot.png" alt="Shot"></li></ul>',
      "text/plain": "x",
    });
    await settle();
    await userEvent.keyboard("z");
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).not.toMatch(/<li[^>]*><\/li>/);
    expect(written).toContain("Clickz");
  });
});

describe("a pasted item starting with a block leaves no empty item (H2)", () => {
  test.each([
    {
      name: "a quote, then text, into a numbered list",
      html: "<ol><li>r1</li><li>s1</li></ol>",
      paste: "<ul><li><blockquote><p>Z1</p></blockquote>Z2</li></ul>",
    },
    {
      name: "a heading, then bold text",
      html: "<ul><li>s1</li><li>t1</li></ul>",
      paste: "<ul><li><h2>Z1</h2><b>Z2</b></li></ul>",
    },
    {
      name: "a quote, then text, at depth 3",
      html: "<ul><li>a<ul><li>b<ul><li>s1</li><li>t1</li></ul></li></ul></li></ul>",
      paste: "<ul><li><blockquote><p>Z1</p></blockquote>Z2</li></ul>",
    },
    {
      name: "an item holding a quote, then text",
      html: "<ul><li>s1</li><li>t1</li></ul>",
      paste: "<ul><li><blockquote><p>Z1</p></blockquote>Z2</li></ul>",
    },
  ])("$name", async ({ html, paste: pasted }) => {
    const onChange = await mountAt(html, "s1");
    paste({ "text/html": pasted, "text/plain": "x" });
    await settle();
    await userEvent.keyboard("q");
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).not.toMatch(/<li[^>]*><\/li>/);
    expect(written).toMatch(/Z2(<[^>]+>)*q/);
    expectFixedPoint(written);
  });
});

describe("a paste into a list item keeps the empty items that were already there (H2)", () => {
  const emptyItems = (html: string) =>
    (plain(html).match(/<li[^>]*><\/li>/g) ?? []).length;

  test.each([
    {
      name: "an empty item before the caret's item",
      html: "<ul><li>a</li><li></li><li>s1</li><li>t1</li></ul>",
      paste: "<p>word</p>",
      texts: "a|s1word|t1",
    },
    {
      name: "an empty item in another list",
      html: "<ul><li>k</li><li></li></ul><p>mid</p><ul><li>s1</li><li>t1</li></ul>",
      paste: "<b>bold</b>",
      texts: null,
    },
    {
      name: "an empty item inside the pasted list",
      html: "<ul><li>s1</li><li>t1</li></ul>",
      paste: "<ul><li>A</li><li></li><li>B</li></ul>",
      texts: null,
    },
  ])("$name", async ({ html, paste: pasted, texts: expected }) => {
    const onChange = await mountAt(html, "s1");
    paste({ "text/html": pasted, "text/plain": "x" });
    await settle();
    const written = lastHtml(onChange);
    expect(emptyItems(written)).toBe(1);
    if (expected !== null) {
      expect(texts(sanitizeRichTextHtml(written)).join("|")).toBe(expected);
    }
  });
});

describe("an item's run of nested lists splits in one pass (H5)", () => {
  test("40 nested lists, then text: one more paste dispatch at most", async () => {
    const onChange = await mountAt("<p></p>", "");
    let dispatches = 0;
    const unregister = editorOf()!.registerCommand(
      PASTE_COMMAND,
      () => {
        dispatches += 1;
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
    const lists = Array.from(
      { length: 40 },
      (_, index) => `<ul><li>y${index}</li></ul>`
    ).join("");
    paste({ "text/html": `<ul><li>A${lists}Z</li></ul>`, "text/plain": "x" });
    await settle();
    unregister();
    expect(dispatches).toBeLessThanOrEqual(2);
    const written = lastHtml(onChange);
    expect(texts(sanitizeRichTextHtml(written)).join("|")).toBe(
      ["A", ...Array.from({ length: 40 }, (_, index) => `y${index}`), "Z"].join(
        "|"
      )
    );
    expect(sanitizeRichTextHtml(written)).not.toMatch(/<li[^>]*><\/li>/);
    expectFixedPoint(written);
  });
});

/** `item` nested in `levels` lists, each around it named `${name}${level}`. */
const aroundItem = (levels: number, item: string, name = "w") => {
  let html = `<ul><li>${item}</li></ul>`;
  for (let level = levels; level >= 1; level -= 1) {
    html = `<ul><li>${name}${level}${html}</li></ul>`;
  }
  return html;
};

const DEEP = Array.from({ length: 6 }, (_, index) => `s${index + 1}`);
const AROUND = Array.from({ length: 5 }, (_, index) => `w${index + 1}`);

/** The value's texts in reading order. */
const readingOrder = (html: string) =>
  sanitizeRichTextHtml(html)
    .split(/<[^>]+>/)
    .filter((text) => text.trim() !== "")
    .join("|");

describe("text after a lifted list moves to its own item (H7)", () => {
  test.each([
    {
      name: "text after a quote holding a list",
      item: "a.<blockquote><ul><li>x.</li></ul></blockquote>t.",
    },
    {
      name: "a paragraph after a quote holding a list",
      item: "a.<blockquote><ul><li>x.</li></ul></blockquote><p>t.</p>",
    },
    {
      name: "bold text after a quote holding a list",
      item: "a.<blockquote><ul><li>x.</li></ul></blockquote><b>t.</b>",
    },
    {
      name: "text after two quotes holding a list",
      item: "a.<blockquote><blockquote><ul><li>x.</li></ul></blockquote></blockquote>t.",
    },
  ])("$name, at the end of a 6-level list", async ({ item }) => {
    const onChange = await mountAt(nestedList(6, "s"), "s6");
    paste({ "text/html": `<ul><li>${item}</li></ul>`, "text/plain": "x" });
    await settle();
    const written = lastHtml(onChange);
    expect(readingOrder(written)).toBe([...DEEP, "a.", "x.", "t."].join("|"));
    expectFixedPoint(written);
  });

  test("text after a quote holding a list, in 5 levels, into an empty field", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html": aroundItem(
        5,
        "a.<blockquote><ul><li>x.</li></ul></blockquote>t."
      ),
      "text/plain": "x",
    });
    await settle();
    const written = lastHtml(onChange);
    expect(readingOrder(written)).toBe([...AROUND, "a.", "x.", "t."].join("|"));
    expectFixedPoint(written);
  });
});

describe("text after a block lifted out of the lists lands (H8)", () => {
  test.each([
    {
      name: "a quote, then text",
      second: "<blockquote><p>y.</p></blockquote>",
      tail: "t.",
    },
    {
      name: "a heading, then bold text",
      second: "<h2>y.</h2>",
      tail: "<b>t.</b>",
    },
    {
      name: "code, then a paragraph",
      second: "<pre><code>y.</code></pre>",
      tail: "<p>t.</p>",
    },
  ])("$name, at the end of a 6-level list", async ({ second, tail }) => {
    const onChange = await mountAt(nestedList(6, "s"), "s6");
    const errors = vi.spyOn(console, "error");
    paste({
      "text/html": `<ul><li>a.<blockquote><ul><li>x.</li></ul></blockquote>${second}${tail}</li></ul>`,
      "text/plain": "x",
    });
    await settle();
    expect(errors).not.toHaveBeenCalled();
    const written = lastHtml(onChange);
    expect(readingOrder(written)).toBe(
      [...DEEP, "a.", "x.", "y.", "t."].join("|")
    );
    expectFixedPoint(written);
  });

  test("a quote, then text, in 5 levels, into an empty field", async () => {
    const onChange = await mountAt("<p></p>", "");
    const errors = vi.spyOn(console, "error");
    paste({
      "text/html": aroundItem(
        5,
        "a.<blockquote><ul><li>x.</li></ul></blockquote><blockquote><p>y.</p></blockquote>t."
      ),
      "text/plain": "x",
    });
    await settle();
    expect(errors).not.toHaveBeenCalled();
    const written = lastHtml(onChange);
    expect(readingOrder(written)).toBe(
      [...AROUND, "a.", "x.", "y.", "t."].join("|")
    );
    expectFixedPoint(written);
  });
});

describe("a list in two quotes at the depth limit keeps the reading order (H6)", () => {
  const DEEP7 = Array.from({ length: 7 }, (_, index) => `s${index + 1}`);
  test.each([
    {
      name: "a list, then a paragraph",
      inner: "<ul><li>x.</li></ul><p>z.</p>",
      after: "",
      order: ["a.", "x.", "z."],
    },
    {
      name: "a list and a quote, then a paragraph after the quotes",
      inner: "<ol><li>x.</li></ol><blockquote><p>y.</p></blockquote>",
      after: "<p>z.</p>",
      order: ["a.", "x.", "y.", "z."],
    },
    {
      name: "a paragraph, a list and a paragraph",
      inner: "<p>w.</p><ul><li>x.</li></ul><p>z.</p>",
      after: "",
      order: ["a.", "w.", "x.", "z."],
    },
  ])("$name", async ({ inner, after, order }) => {
    const onChange = await mountAt(nestedList(7, "s"), "s7");
    paste({
      "text/html": `<ul><li>a.<blockquote><blockquote>${inner}</blockquote></blockquote>${after}</li></ul>`,
      "text/plain": "x",
    });
    await settle();
    const written = lastHtml(onChange);
    expect(readingOrder(written)).toBe([...DEEP7, ...order].join("|"));
    expectFixedPoint(written);
  });
});

describe("a list of the other type pasted into a nested item keeps its nesting at the top (H9)", () => {
  test("a numbered list with a nested item, at the end of a 7-level list", async () => {
    const onChange = await mountAt(nestedList(7, "s"), "s7");
    paste({
      "text/html": "<ol><li>A<ul><li>X</li></ul>Z</li><li>B</li></ol>",
      "text/plain": "x",
    });
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).toContain(
      "<ol><li>A<ul><li>X</li></ul></li><li>Z</li><li>B</li></ol>"
    );
    expectFixedPoint(written);
  });
});

describe("dropped HTML gets the paste's list passes (H3)", () => {
  test("an item's quote after its nested list, dropped after a paragraph", async () => {
    const onChange = await mountAt("<p>pp</p><p>after</p>", "pp");
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(
      "text/html",
      "<ul><li>A<ul><li>X</li></ul><blockquote><p>Z</p></blockquote></li><li>B</li></ul>"
    );
    dataTransfer.setData("text/plain", "x");
    await act(async () => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromDrop",
          dataTransfer,
        })
      );
    });
    await settle();
    const written = lastHtml(onChange);
    expect(readingOrder(written)).toBe("pp|A|X|Z|B|after");
    expectFixedPoint(written);
  });
});

describe("a nested list in a wrapper in a pasted item keeps what follows after it (H4)", () => {
  test.each([
    [
      "the list in a wrapper",
      "<ul><li>A<div><ul><li>X</li></ul></div>Z</li><li>B</li></ul>",
    ],
    [
      "the item's content in a wrapper",
      "<ul><li><div>A<ul><li>X</li></ul>Z</div></li><li>B</li></ul>",
    ],
  ])("%s", async (_name, html) => {
    const onChange = await mountAt("<p></p>", "");
    paste({ "text/html": html, "text/plain": "x" });
    await settle();
    const written = lastHtml(onChange);
    expect(readingOrder(written)).toBe("A|X|Z|B");
    expectFixedPoint(written);
  });
});

/** Whether each text reads with the mark or link `kind` in the field. */
const marked = (kind: string, words: string[]) =>
  editorOf()!
    .getEditorState()
    .read(() =>
      words.map((word) => {
        const node = $getRoot()
          .getAllTextNodes()
          .find((text) => text.getTextContent() === word);
        if (node === undefined) {
          return `${word}: missing`;
        }
        const has =
          kind === "link"
            ? $findMatchingParent(node, $isLinkNode) !== null
            : node.hasFormat(kind as "bold");
        return `${word}: ${has}`;
      })
    );

describe("marks and links around a pasted item's nested list stay (R1)", () => {
  const MARKS = [
    ["b", "<b>", "</b>", "bold"],
    ["strong", "<strong>", "</strong>", "bold"],
    ["i", "<i>", "</i>", "italic"],
    ["em", "<em>", "</em>", "italic"],
    ["u", "<u>", "</u>", "underline"],
    ["s", "<s>", "</s>", "strikethrough"],
    ["code", "<code>", "</code>", "code"],
    ["a", '<a href="https://example.org/a">', "</a>", "link"],
    ["bold span", '<span style="font-weight:700">', "</span>", "bold"],
    ["b in a div", "<div><b>", "</b></div>", "bold"],
  ];
  const SHAPES = [
    {
      shape: "around the item's content",
      html: (open: string, close: string) =>
        `<ul><li>${open}A<ul><li>X</li></ul>Z${close}</li><li>B</li></ul>`,
      words: ["A", "X", "Z"],
      order: "A|X|Z|B",
    },
    {
      shape: "around the list alone",
      html: (open: string, close: string) =>
        `<ul><li>A${open}<ul><li>X</li></ul>${close}Z</li><li>B</li></ul>`,
      words: ["X"],
      order: "A|X|Z|B",
    },
    {
      shape: "around an item with nothing after its list",
      html: (open: string, close: string) =>
        `<ul><li>${open}A<ul><li>X</li></ul>${close}</li><li>B<ul><li>Y</li></ul>Z</li></ul>`,
      words: ["A", "X"],
      order: "A|X|B|Y|Z",
    },
  ];
  test.each(
    MARKS.flatMap(([name, open, close, kind]) =>
      SHAPES.map((shape) => ({ name, open, close, kind, ...shape }))
    )
  )("$name $shape", async ({ open, close, kind, html, words, order }) => {
    const onChange = await mountAt("<p></p>", "");
    paste({ "text/html": html(open, close), "text/plain": "x" });
    await settle();
    expect(marked(kind, words)).toEqual(words.map((word) => `${word}: true`));
    expect(readingOrder(lastHtml(onChange))).toBe(order);
  });

  test("bold around a step's text and its nested list", async () => {
    await mountAt("<p></p>", "");
    paste({
      "text/html":
        "<ol><li><strong>Step one<ul><li>detail</li></ul></strong></li><li>Step two<ul><li>detail</li></ul>note</li></ol>",
      "text/plain": "x",
    });
    await settle();
    expect(marked("bold", ["Step one"])).toEqual(["Step one: true"]);
    const details = editorOf()!
      .getEditorState()
      .read(() =>
        $getRoot()
          .getAllTextNodes()
          .filter((text) => text.getTextContent() === "detail")
          .map((text) => text.hasFormat("bold"))
      );
    expect(details).toEqual([true, false]);
  });

  test("a link around a heading, a list and a span", async () => {
    await mountAt("<p></p>", "");
    paste({
      "text/html":
        '<ul><li><a href="https://example.org/a"><h3>Title A</h3><ul><li>tag1</li></ul><span>Read more</span></a></li></ul>',
      "text/plain": "x",
    });
    await settle();
    expect(marked("link", ["Title A", "tag1", "Read more"])).toEqual([
      "Title A: true",
      "tag1: true",
      "Read more: true",
    ]);
  });
});

/** The deepest nesting of lists and quotes in a value. */
const deepest = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  let most = 0;
  for (const element of template.content.querySelectorAll("*")) {
    let depth = 0;
    for (let at: Element | null = element; at; at = at.parentElement) {
      if (/^(UL|OL|BLOCKQUOTE)$/.test(at.tagName)) {
        depth += 1;
      }
    }
    most = Math.max(most, depth);
  }
  return most;
};

describe("a list pasted after a block into a nested item keeps the depth limit (R2)", () => {
  const cases = [
    {
      name: "a rule and a 7-level list into a depth-2 item",
      html: "<ul><li>a<ul><li>b</li></ul></li></ul>",
      at: "b",
      lead: "<hr>",
      levels: 7,
    },
    {
      name: "a paragraph, a heading and a 5-level list into a depth-4 item",
      html: nestedList(4, "s"),
      at: "s4",
      lead: "<p>one.</p><h2>two.</h2>",
      levels: 5,
    },
  ];
  for (const depth of [2, 3, 5, 6, 7]) {
    for (const lead of [
      "<hr>",
      "<p>p.</p><hr>",
      "<p>p.</p><blockquote><p>q.</p></blockquote>",
      "<p>p.</p><pre><code>c.</code></pre>",
      "<h2>h.</h2><h3>i.</h3>",
      "<p>p.</p><ol><li>o.</li></ol>",
    ]) {
      cases.push({
        name: `${lead} and a 7-level list into a depth-${depth} item`,
        html: nestedList(depth, "s"),
        at: `s${depth}`,
        lead,
        levels: 7,
      });
    }
  }
  test.each(cases)("$name", async ({ html, at, lead, levels }) => {
    const onChange = await mountAt(html, at);
    paste({
      "text/html": `${lead}${nestedList(levels, "k")}`,
      "text/plain": "x",
    });
    await settle();
    const written = sanitizeRichTextHtml(lastHtml(onChange));
    expect(deepest(written)).toBeLessThanOrEqual(7);
    expectFixedPoint(written);
    expect(readingOrder(written)).toContain(
      Array.from({ length: levels }, (_, index) => `k${index + 1}`).join("|")
    );
  });
});

describe("Enter and paste in an item starting with a block (R3)", () => {
  const BLOCK_LED_PASTE =
    "<ul><li><blockquote><p>Z1</p></blockquote>Z2</li></ul>";
  /** Runs `step`, which must finish in under two seconds. */
  const quickly = async (step: () => Promise<void>) => {
    const start = performance.now();
    await step();
    expect(performance.now() - start).toBeLessThan(2000);
  };
  const enterAndType = () =>
    quickly(async () => {
      await userEvent.keyboard("{Enter}e");
      await settle();
    });
  /** A real click in the text `word` at `offset` (its end when left out). */
  const clickText = async (word: string, offset?: number) => {
    const span = [
      ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
    ].find((element) => element.textContent === word)!;
    const range = document.createRange();
    const at = offset ?? word.length;
    range.setStart(span.firstChild!, at);
    range.setEnd(span.firstChild!, at);
    const rect = range.getBoundingClientRect();
    const box = span.getBoundingClientRect();
    await userEvent.click(span, {
      position: {
        x: Math.min(Math.max(rect.left - box.left, 1), box.width - 1),
        y: box.height / 2,
      },
    } as never);
    await settle();
  };

  test("Enter after the pasted item's text makes an item", async () => {
    const onChange = await mountAt("<ul><li>s1</li><li>t1</li></ul>", "s1");
    paste({ "text/html": BLOCK_LED_PASTE, "text/plain": "x" });
    await settle();
    await enterAndType();
    const written = plain(lastHtml(onChange));
    expect(written).toMatch(/Z2<\/li><li>e<\/li><li>t1<\/li>/);
    expectFixedPoint(written);
  }, 60000);

  test("a second paste after the pasted item's text lands", async () => {
    const onChange = await mountAt("<ul><li>s1</li><li>t1</li></ul>", "s1");
    paste({ "text/html": BLOCK_LED_PASTE, "text/plain": "x" });
    await settle();
    await quickly(async () => {
      paste({ "text/html": "<p>more</p><p>again</p>", "text/plain": "x" });
      await settle();
    });
    const written = plain(lastHtml(onChange));
    expect(readingOrder(written)).toBe("s1|Z1|Z2more|again|t1");
  }, 60000);

  test.each([
    ["two paragraphs", "<p>more</p><p>again</p>", "q1|q2more|again|t1"],
    ["a list", "<ul><li>k1</li><li>k2</li></ul>", "q1|q2|k1|k2|t1"],
  ])(
    "a paste of %s at the end of a stored item starting with a quote",
    async (_name, pasted, order) => {
      const onChange = await mountAt(
        "<ul><li><blockquote><p>q1</p></blockquote>q2</li><li>t1</li></ul>",
        "q1"
      );
      await clickText("q2");
      const errors = vi.spyOn(console, "error");
      await quickly(async () => {
        paste({ "text/html": pasted, "text/plain": "x" });
        await settle();
      });
      expect(errors).not.toHaveBeenCalled();
      const written = plain(lastHtml(onChange));
      expect(written).not.toMatch(/<li[^>]*><\/li>/);
      expect(readingOrder(written)).toBe(order);
      expectFixedPoint(written);
    },
    60000
  );

  test.each([
    ["at its end", undefined, "q2xy</li><li>e</li><li>t1"],
    ["in its middle", 3, "q2x</li><li>ey</li><li>t1"],
  ])(
    "Enter %s in a stored item starting with a quote",
    async (_name, offset, expected) => {
      const onChange = await mountAt(
        "<ul><li><blockquote><p>q1</p></blockquote>q2xy</li><li>t1</li></ul>",
        "q1"
      );
      await clickText("q2xy", offset);
      await enterAndType();
      expect(plain(lastHtml(onChange))).toContain(expected);
    },
    60000
  );

  test("Enter at the end of a stored item starting with a quote, as the last item", async () => {
    const onChange = await mountAt(
      "<ul><li><blockquote><p>q1</p></blockquote>q2</li></ul>",
      "q1"
    );
    await clickText("q2");
    await enterAndType();
    expect(plain(lastHtml(onChange))).toBe(
      "<ul><li><blockquote><p>q1</p></blockquote>q2</li><li>e</li></ul>"
    );
  }, 60000);

  test.each([
    [
      "an ordinary item",
      "<ul><li>aa</li><li>bb</li></ul>",
      "aa",
      "<ul><li>aa</li><li>e</li><li>bb</li></ul>",
    ],
    [
      "the quote's own paragraph",
      "<ul><li><blockquote><p>q1</p></blockquote>q2</li></ul>",
      "q1",
      "<ul><li><blockquote><p>q1</p><p>e</p></blockquote>q2</li></ul>",
    ],
  ])(
    "Enter in %s is the editor's own",
    async (_name, html, word, expected) => {
      const onChange = await mountAt(html, word);
      await clickText(word);
      await enterAndType();
      expect(plain(lastHtml(onChange))).toBe(expected);
    },
    60000
  );
});

describe("a paste over a backward selection from a list item leaves no empty item (R7)", () => {
  test("from a paragraph's end back to an item's end", async () => {
    const onChange = await mountAt(
      "<ul><li>r1</li><li>s1</li></ul><p>p9</p>",
      "p9",
      undefined,
      "s1"
    );
    paste({
      "text/html": "<ul><li><blockquote><p>Z1</p></blockquote>Z2</li></ul>",
      "text/plain": "x",
    });
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).not.toMatch(/<li[^>]*><\/li>/);
    expect(readingOrder(written)).toBe("r1|s1|Z1|Z2");
  });
});

describe("nothing stays after a lifted list in its item (H7, R8)", () => {
  test.each([
    ["two line breaks", "<br><br>", "a.|x."],
    ["three line breaks", "<br><br><br>", "a.|x."],
    ["bold line breaks", "<b><br><br></b>", "a.|x."],
    [
      "a link around line breaks",
      '<a href="https://example.org/a"><br><br></a>',
      "a.|x.",
    ],
    [
      "two spans each holding a line break",
      "<span><br></span><span><br></span>",
      "a.|x.",
    ],
    ["an italic space and line breaks", "<i> </i><br><br>", "a.|x."],
    ["a non-breaking space", "&nbsp;", "a.|x."],
    ["line breaks around text", "<br><br>t.<br>", "a.|x.|t."],
  ])(
    "%s after a quote holding a list, at the end of a 6-level list",
    async (_name, after, order) => {
      const onChange = await mountAt(nestedList(6, "s"), "s6");
      paste({
        "text/html": `<ul><li>a.<blockquote><ul><li>x.</li></ul></blockquote>${after}</li></ul>`,
        "text/plain": "x",
      });
      await settle();
      const written = lastHtml(onChange);
      expect(readingOrder(written)).toBe([...DEEP, order].join("|"));
      expect(sanitizeRichTextHtml(written)).not.toMatch(/<\/(ul|ol)><br/);
      expectFixedPoint(written);
    }
  );
});

describe("what imports to nothing after a pasted nested list adds no item (R6)", () => {
  test.each([
    [
      "a style",
      "<ul><li>A<ul><li>X</li></ul><style>p{color:red}</style></li><li>B</li></ul>",
      2,
    ],
    [
      "a script",
      "<ul><li>A<ul><li>X</li></ul><script>var a = 1;</script></li><li>B</li></ul>",
      2,
    ],
    [
      "a zero-width space",
      "<ul><li>A<ul><li>X</li></ul>&#8203;</li><li>B</li></ul>",
      2,
    ],
    [
      "a line break between two lists",
      "<ul><li>A<ul><li>X1</li></ul><br><ul><li>X2</li></ul></li><li>B</li></ul>",
      2,
    ],
    [
      "a space between two lists",
      "<ul><li>A<ul><li>X1</li></ul>&nbsp;<ul><li>X2</li></ul></li><li>B</li></ul>",
      2,
    ],
  ])("%s", async (_name, html, items) => {
    const onChange = await mountAt("<p></p>", "");
    paste({ "text/html": html, "text/plain": "x" });
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).not.toMatch(/<li[^>]*><\/li>/);
    expect(written).not.toMatch(/<li><br/);
    const template = document.createElement("template");
    template.innerHTML = written;
    expect(template.content.firstElementChild!.children).toHaveLength(items);
  });

  test("a line break, then text after the list: the new item starts with the text", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html": "<ul><li>A<ul><li>X</li></ul><br>Z</li><li>B</li></ul>",
      "text/plain": "x",
    });
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).toBe(
      "<ul><li>A<ul><li>X</li></ul></li><li>Z</li><li>B</li></ul>"
    );
  });
});

describe("inline content after a lifted block keeps to its own runs (R4)", () => {
  test.each([
    ["two line breaks", "<br><br>", "a.|x.|y."],
    ["line breaks around a heading", "<br><h2>h.</h2><br>", "a.|x.|y.|h."],
    ["a rule, then a paragraph", "<hr><p>t.</p>", "a.|x.|y.|t."],
    ["text, then two line breaks", "t.<br><br>", "a.|x.|y.|t."],
  ])("%s after the second quote", async (_name, after, order) => {
    const onChange = await mountAt(nestedList(6, "s"), "s6");
    paste({
      "text/html": `<ul><li>a.<blockquote><ul><li>x.</li></ul></blockquote><blockquote><p>y.</p></blockquote>${after}</li></ul>`,
      "text/plain": "x",
    });
    await settle();
    const written = sanitizeRichTextHtml(lastHtml(onChange));
    expect(written).not.toMatch(/<p><br \/>|<br \/><\/p>|<p><\/p>/);
    expect(readingOrder(written)).toBe([...DEEP, order].join("|"));
    expectFixedPoint(written);
  });

  const text = (value: string) => ({
    type: "text",
    text: value,
    format: 0,
    style: "",
    mode: "normal",
    detail: 0,
    version: 1,
  });
  const block = { direction: null, format: "", indent: 0, version: 1 };
  const list = (...children: unknown[]) => ({
    ...block,
    type: "list",
    listType: "bullet",
    start: 1,
    tag: "ul",
    children,
  });
  const item = (...children: unknown[]) => ({
    ...block,
    type: "listitem",
    value: 1,
    children,
  });
  const quote = (value: string) => ({
    ...block,
    type: "quote",
    children: [
      {
        ...block,
        type: "paragraph",
        textFormat: 0,
        textStyle: "",
        children: [text(value)],
      },
    ],
  });
  test.each([
    ["white space", [text("  ")], "a.|x.|y."],
    [
      "text, a list and text",
      [text("t."), list(item(text("k."))), text("u.")],
      undefined,
    ],
  ])(
    "the field's own item with %s after a lifted quote",
    async (_name, tail, order) => {
      const onChange = await mountAt(nestedList(6, "s"), "s6");
      paste({
        "application/x-lexical-editor": JSON.stringify({
          namespace: editorOf()!._config.namespace,
          nodes: [
            list(
              item(text("a."), list(item(text("x."))), quote("y."), ...tail)
            ),
          ],
        }),
        "text/plain": "x",
      });
      await settle();
      const written = sanitizeRichTextHtml(lastHtml(onChange));
      expect(written).not.toMatch(/<p><\/p>|t\.u\./);
      if (order === undefined) {
        expect(written).toMatch(/<p>t\.<\/p>/);
        expect(written).toMatch(/<p>u\.<\/p>/);
        expect(written).toContain("k.");
      } else {
        expect(readingOrder(written)).toBe([...DEEP, order].join("|"));
      }
    }
  );
});

describe("a wrapper that gives way in a pasted item keeps its lines (R5)", () => {
  test("text before and after a wrapper holding a nested list", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html":
        "<ul><li>P<div>A<ul><li>X</li></ul>Z</div>Q</li><li>B</li></ul>",
      "text/plain": "x",
    });
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).toBe(
      "<ul><li>P<br />A<ul><li>X</li></ul></li><li>Z<br />Q</li><li>B</li></ul>"
    );
    expectFixedPoint(written);
  });

  test("a table around a nested list keeps its cells apart", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html":
        "<ul><li>A<table><tbody><tr><td>C1</td><td><ul><li>X</li></ul></td><td>C3</td></tr><tr><td>D1</td><td>D2</td></tr></tbody></table>Z</li><li>B</li></ul>",
      "text/plain": "x",
    });
    await settle();
    const written = plain(lastHtml(onChange));
    expect(written).not.toMatch(/AC1|C3D1|D1D2|D2Z/);
  });
});

/** A real click in the text `word` at `offset` (its end when left out). */
const clickInWord = async (word: string, offset?: number) => {
  const span = [
    ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
  ].find((element) => element.textContent === word)!;
  const range = document.createRange();
  const at = offset ?? word.length;
  range.setStart(span.firstChild!, at);
  range.setEnd(span.firstChild!, at);
  const rect = range.getBoundingClientRect();
  const box = span.getBoundingClientRect();
  await userEvent.click(span, {
    position: {
      x: Math.min(Math.max(rect.left - box.left, 1), box.width - 1),
      y: box.height / 2,
    },
  } as never);
  await settle();
};

describe("an item the paste makes after a nested list stays editable (T1)", () => {
  const pasteAfter = (behind: string) => async () => {
    const onChange = await mountAt("<ul><li>s1</li><li>t1</li></ul>", "s1");
    paste({
      "text/html": `<ul><li>A<ul><li>X</li></ul>${behind}</li></ul>`,
      "text/plain": "x",
    });
    await settle();
    return onChange;
  };
  const SETUPS = [
    ["a quote", pasteAfter("<blockquote><p>Z1</p></blockquote>Z2")],
    ["a heading", pasteAfter("<h2>Z1</h2>Z2")],
    ["a rule", pasteAfter("<hr>Z2")],
    [
      "nothing (an ordinary item)",
      () => mountAt("<ul><li>s1</li><li>Z2</li><li>t1</li></ul>", "Z2"),
    ],
  ] as const;
  const plainPaste = (text: string) => paste({ "text/plain": text });
  const drop = async (text: string) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    await act(async () => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromDrop",
          dataTransfer,
        })
      );
    });
  };
  const STEPS: [string, () => Promise<void>, RegExp][] = [
    ["Enter", () => userEvent.keyboard("{Enter}e"), /Z2<\/li><li>e<\/li>/],
    [
      "Shift+Enter",
      () => userEvent.keyboard("{Shift>}{Enter}{/Shift}e"),
      /Z2<br \/>e/,
    ],
    [
      "a two-line plain-text paste",
      async () => plainPaste("L1\nL2"),
      /Z2L1.*L2/,
    ],
    [
      "a three-line CRLF plain-text paste",
      async () => plainPaste("L1\r\nL2\r\nL3"),
      /Z2L1.*L2.*L3/,
    ],
    ["a plain-text paste with a tab", async () => plainPaste("a\tb"), /Z2a.*b/],
    ["a two-line plain-text drop", () => drop("L1\nL2"), /Z2L1.*L2/],
    ["Delete at the item's end", () => userEvent.keyboard("{Delete}"), /Z2t1/],
    [
      "Backspace at the next item's start",
      async () => {
        await clickInWord("t1", 0);
        await userEvent.keyboard("{Backspace}");
      },
      /Z2t1/,
    ],
    [
      "Heading 2",
      async () => {
        await userEvent.click(byLabel("Block type")!);
        await settle();
        const option = [
          ...document.querySelectorAll<HTMLElement>('[role="option"]'),
        ].find((element) => element.textContent === "Heading 2");
        await userEvent.click(option!);
      },
      /<h2>Z2<\/h2>/,
    ],
  ];
  test.each(
    SETUPS.flatMap(([setup, mount]) =>
      STEPS.map(([step, run, written]) => ({
        setup,
        mount,
        step,
        run,
        written,
      }))
    )
  )(
    "after $setup: $step",
    async ({ mount, run, written }) => {
      const onChange = await mount();
      const errors = vi.spyOn(console, "error");
      const start = performance.now();
      await run();
      await settle();
      expect(performance.now() - start).toBeLessThan(2000);
      expect(
        errors.mock.calls
          .map((args) => String(args[0]))
          .filter((message) => message.includes("not wrapped in act") === false)
      ).toEqual([]);
      expect(plain(lastHtml(onChange)).replace(/\n/g, "")).toMatch(written);
    },
    60000
  );

  test.each([
    [
      "a quote, then text",
      "<blockquote><p>Z1</p></blockquote>Z2",
      "<ul><li>s1</li><li>A<ul><li>X</li></ul></li><li><blockquote><p>Z1</p></blockquote></li><li>Z2</li><li>t1</li></ul>",
    ],
    [
      "a heading, then text",
      "<h2>Z1</h2>Z2",
      "<ul><li>s1</li><li>A<ul><li>X</li></ul></li><li><h2>Z1</h2></li><li>Z2</li><li>t1</li></ul>",
    ],
    [
      "code, then text",
      "<pre><code>c1</code></pre>Z2",
      "<ul><li>s1</li><li>A<ul><li>X</li></ul></li><li><pre><code>c1</code></pre></li><li>Z2</li><li>t1</li></ul>",
    ],
  ])("%s after the nested list writes", async (_name, behind, expected) => {
    const onChange = await pasteAfter(behind)();
    expect(plain(lastHtml(onChange))).toBe(expected);
    await userEvent.keyboard("q");
    await settle();
    expect(plain(lastHtml(onChange))).toContain("<li>Z2q</li>");
  });

  test("a rule, then text: the rule stays in the item, the text takes its own", async () => {
    const onChange = await pasteAfter("<hr>Z2")();
    const written = plain(lastHtml(onChange));
    expect(written).toMatch(/<li>A(<br \/>)?<hr \/>/);
    expect(written).toMatch(/<\/li><li>Z2<\/li><li>t1<\/li><\/ul>$/);
  });

  test("a rule alone after a nested list: Enter, Shift+Enter and a plain-text paste finish at once", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html": "<ul><li>Open<ul><li>Click</li></ul><hr></li></ul>",
      "text/plain": "x",
    });
    await settle();
    expect(plain(lastHtml(onChange))).toBe(
      "<ul><li>Open<br /><hr /><ul><li>Click</li></ul></li></ul>"
    );
    const start = performance.now();
    await userEvent.keyboard("{Enter}e{Shift>}{Enter}{/Shift}f");
    await settle();
    paste({ "text/plain": "L1\nL2" });
    await settle();
    expect(performance.now() - start).toBeLessThan(3000);
    expect(lastHtml(onChange)).toContain("L2");
  }, 60000);
});

describe("items under marks or wrappers in a pasted list stay its items (T4)", () => {
  const drop = async (html: string) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/html", html);
    dataTransfer.setData("text/plain", "x");
    await act(async () => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromDrop",
          dataTransfer,
        })
      );
    });
  };
  const SHAPES: [string, string, string | undefined][] = [
    [
      "links",
      '<ul><a href="https://example.org/a"><li>Aq</li></a><a href="https://example.org/b"><li>Bq</li></a></ul>',
      "link",
    ],
    [
      "bold in a bulleted list",
      "<ul><b><li>Aq</li><li>Bq</li></b></ul>",
      "bold",
    ],
    [
      "bold in a numbered list",
      "<ol><b><li>Aq</li><li>Bq</li></b></ol>",
      "bold",
    ],
    ["a div", "<ul><div><li>Aq</li><li>Bq</li></div></ul>", undefined],
    ["a span", "<ul><span><li>Aq</li><li>Bq</li></span></ul>", undefined],
  ];
  test.each(
    SHAPES.flatMap(([name, html, mark]) =>
      ["drop", "paste"].map((how) => ({ name, html, mark, how }))
    )
  )("$name, by $how", async ({ html, mark, how }) => {
    const onChange = await mountAt("<p></p>", "");
    if (how === "drop") {
      await drop(html);
    } else {
      paste({ "text/html": html, "text/plain": "x" });
    }
    await settle();
    const written = plain(lastHtml(onChange));
    const template = document.createElement("template");
    template.innerHTML = written;
    const list = template.content.firstElementChild!;
    expect(/^(UL|OL)$/.test(list.tagName)).toBe(true);
    expect(list.querySelectorAll("ul, ol")).toHaveLength(0);
    expect(list.children).toHaveLength(2);
    expect(readingOrder(written)).toBe("Aq|Bq");
    if (mark !== undefined) {
      expect(marked(mark, ["Aq", "Bq"])).toEqual(["Aq: true", "Bq: true"]);
    }
  });
});

describe("a new item starts at its content (T3)", () => {
  test.each([
    ["an image", '<img src="https://example.org/a.png" alt="alt">'],
    ["a comment", "<!-- note -->"],
    ["an empty span", "<span></span>"],
    ["a style", "<style>p{color:red}</style>"],
    ["a bold line break", "<b><br></b>"],
  ])("%s and a line break before the text", async (_name, before) => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html": `<ol><li>T1q<ul><li>T2q</li></ul>${before}<br>T3q</li><li>T4q</li></ol>`,
      "text/plain": "x",
    });
    await settle();
    expect(plain(lastHtml(onChange))).toBe(
      "<ol><li>T1q<ul><li>T2q</li></ul></li><li>T3q</li><li>T4q</li></ol>"
    );
  });

  test.each(
    [
      "\u200e",
      "\u200f",
      "\u00ad",
      "\u061c",
      "\u202a",
      "\u202e",
      "\u2066",
      "\u2069",
      "\u2062",
      "\ufe0f",
      "\u180e",
    ].map((char) => [char.codePointAt(0)!.toString(16).padStart(4, "0"), char])
  )("U+%s after the nested list adds no item", async (_code, char) => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html": `<ul><li>Aq<ul><li>Xq</li></ul>${char}</li><li>Bq</li></ul>`,
      "text/plain": "x",
    });
    await settle();
    const template = document.createElement("template");
    template.innerHTML = plain(lastHtml(onChange));
    expect(template.content.firstElementChild!.children).toHaveLength(2);
  });
});

describe("a wrapper's lines follow the wrapper (T2)", () => {
  /** The written value with only its line breaks left as tags. */
  const lines = (html: string) => html.replace(/<(?!br\b)[^>]*>/g, "");
  test.each([
    [
      "small text on either side",
      "<ul><li><small>Pq</small><div>Aq<ul><li>Xq</li></ul>Zq</div><small>Qq</small></li></ul>",
    ],
    [
      "white space between the tags",
      "<ul><li><b>Pq</b> <div>Aq<ul><li>Xq</li></ul>Zq</div> <i>Qq</i></li></ul>",
    ],
    [
      "an image and a comment beside it",
      '<ul><li>Pq<img src="https://example.org/a.png" alt="a"><section>Aq<ul><li>Xq</li></ul>Zq</section><!-- c --><span></span>Qq</li></ul>',
    ],
  ])(
    "a block wrapper with %s keeps a line break at each edge",
    async (_name, html) => {
      const onChange = await mountAt("<p></p>", "");
      paste({ "text/html": html, "text/plain": "x" });
      await settle();
      const written = lines(plain(lastHtml(onChange)));
      expect(written).toContain("Pq<br />Aq");
      expect(written).toContain("Zq<br />Qq");
    }
  );

  test.each(["font", "small", "sup", "mark", "label"])(
    "an inline %s wrapper gives way with no line break",
    async (tag) => {
      const onChange = await mountAt("<p></p>", "");
      paste({
        "text/html": `<ul><li>Pq<${tag}>Aq<ul><li>Xq</li></ul>Zq</${tag}>Qq</li><li>Bq</li></ul>`,
        "text/plain": "x",
      });
      await settle();
      const written = lines(plain(lastHtml(onChange)));
      expect(written).toContain("PqAq");
      expect(written).toContain("ZqQq");
    }
  );
});

describe("the caret after a paste whose line breaks the lift removed (U1)", () => {
  const THREE =
    "<ul><li>a.<blockquote><ul><li>x1.</li><li>x2.<ul><li>x3.</li></ul></li></ul></blockquote><br><br></li></ul>";
  const ONE =
    "<ul><li>a.<blockquote><ul><li>x.</li></ul></blockquote><br><br></li></ul>";
  const pasted = async (html: string) => {
    const onChange = await mountAt(nestedList(6, "s"), "s6");
    paste({ "text/html": html, "text/plain": "x" });
    await settle();
    return onChange;
  };
  /** Presses `keys`, which must finish in under two seconds. */
  const press = async (keys: string) => {
    const start = performance.now();
    await userEvent.keyboard(keys);
    await settle();
    expect(performance.now() - start).toBeLessThan(2000);
  };
  const FORMS = [
    ["three nested items", THREE, ["a.", "x1.", "x2."], "x3."],
    ["one nested item", ONE, ["a."], "x."],
  ] as const;
  const STEPS = [
    ["Backspace", "{Backspace}", (last: string) => [last.slice(0, -1)]],
    ["Delete", "{Delete}", (last: string) => [last]],
    // the word before the caret is the final full stop
    [
      "Ctrl+Backspace",
      "{Control>}{Backspace}{/Control}",
      (last: string) => [last.slice(0, -1)],
    ],
    ["typing", "z", (last: string) => [`${last}z`]],
  ] as const;
  test.each(
    FORMS.flatMap(([form, html, before, last]) =>
      STEPS.map(([step, keys, result]) => ({
        form,
        step,
        html,
        keys,
        expected: [...DEEP, ...before, ...result(last)].join("|"),
      }))
    )
  )(
    "$form: $step",
    async ({ html, keys, expected }) => {
      const onChange = await pasted(html);
      await press(keys);
      expect(readingOrder(lastHtml(onChange))).toBe(expected);
    },
    60000
  );

  test("a second quote, then two line breaks: typing lands after its text", async () => {
    const onChange = await pasted(
      "<ul><li>a.<blockquote><ul><li>x.</li></ul></blockquote><blockquote><p>y.</p></blockquote><br><br></li></ul>"
    );
    await press("z");
    expect(readingOrder(lastHtml(onChange))).toBe(
      [...DEEP, "a.", "x.", "y.z"].join("|")
    );
  }, 60000);

  test.each([
    [
      "one line break",
      "<ul><li>a.<blockquote><ul><li>x.</li></ul></blockquote><br></li></ul>",
      [...DEEP, "a.", "x.z"],
    ],
  ])(
    "%s: typing lands after the nested text",
    async (_name, html, expected) => {
      const onChange = await pasted(html);
      await press("z");
      expect(readingOrder(lastHtml(onChange))).toBe(expected.join("|"));
    },
    60000
  );

  test("a plain-text paste keeps its caret", async () => {
    const onChange = await mountAt(nestedList(6, "s"), "s6");
    paste({ "text/plain": "pp" });
    await settle();
    await press("z");
    expect(readingOrder(lastHtml(onChange))).toBe(
      [...DEEP.slice(0, -1), "s6ppz"].join("|")
    );
  }, 60000);
});

describe("rules after a pasted nested list (V1)", () => {
  test.each([
    ["in a div", "<div><hr></div>Zq"],
    ["in a font", '<font color="red"><hr></font>Zq'],
    ["in a center", "<center><hr></center>Zq"],
    ["in a quote", "<blockquote><hr></blockquote>Zq"],
    [
      "in a table cell",
      "<table><tbody><tr><td><hr></td></tr></tbody></table>Zq",
    ],
    ["in a div before a div", "<div><hr></div><div>Zq</div>"],
    [
      "after a leading quote",
      "<blockquote><p>Z1q</p></blockquote><div><hr></div>Zq",
    ],
    ["in a later run", "Mq<ul><li>Yq</li></ul><div><hr></div>Zq"],
  ])("a rule %s is kept", async (_name, behind) => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html": `<ul><li>Aq<ul><li>Xq</li></ul>${behind}</li><li>Bq</li></ul>`,
      "text/plain": "x",
    });
    await settle();
    const written = sanitizeRichTextHtml(lastHtml(onChange));
    expect(written.match(/<hr/g)).toHaveLength(1);
    expect(written).toContain("Zq");
  });

  const SEQUENCES = [
    [
      "a rule and text in a div, into an item",
      "<ul><li>s1</li><li>t1</li></ul>",
      "s1",
      "<ul><li>A<ul><li>X</li></ul><div><hr>Z2</div></li></ul>",
    ],
    [
      "a rule and a paragraph in a section, into an item",
      "<ul><li>s1</li><li>t1</li></ul>",
      "s1",
      "<ul><li>A<ul><li>X</li></ul><section><hr><p>Z2</p></section></li></ul>",
    ],
    [
      "a quote, then a rule, into an empty field",
      "<p></p>",
      "",
      "<ul><li>A<ul><li>X</li></ul><blockquote><p>Z1</p></blockquote><hr></li></ul>",
    ],
    [
      "a heading, then a rule, into an empty field",
      "<p></p>",
      "",
      "<ul><li>A<ul><li>X</li></ul><h2>Z1</h2><hr></li></ul>",
    ],
    [
      "a quote and text in a div, into an empty field",
      "<p></p>",
      "",
      "<ul><li>A<ul><li>X</li></ul><div><blockquote><p>Z1</p></blockquote>Z2</div></li></ul>",
    ],
  ];
  test.each(
    SEQUENCES.flatMap(([name, html, at, pasted]) =>
      (["a two-line plain-text paste", "Shift+Enter"] as const).map((step) => ({
        name,
        html,
        at,
        pasted,
        step,
      }))
    )
  )(
    "$name, then $step",
    async ({ html, at, pasted, step }) => {
      const onChange = await mountAt(html, at);
      paste({ "text/html": pasted, "text/plain": "x" });
      await settle();
      expect(lastHtml(onChange)).not.toMatch(/<li[^>]*><hr/);
      const errors = vi.spyOn(console, "error");
      const start = performance.now();
      if (step === "Shift+Enter") {
        await userEvent.keyboard("{Shift>}{Enter}{/Shift}e");
      } else {
        paste({ "text/plain": "L1\nL2" });
      }
      await settle();
      expect(performance.now() - start).toBeLessThan(2000);
      expect(
        errors.mock.calls
          .map((args) => String(args[0]))
          .filter((message) => message.includes("not wrapped in act") === false)
      ).toEqual([]);
      const written = plain(lastHtml(onChange));
      expect(written).toMatch(step === "Shift+Enter" ? /<br \/>e/ : /L1.*L2/);
    },
    60000
  );
});

describe("an item under a quote, code, heading or table in a list stays stray (V3)", () => {
  const drop = async (html: string) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/html", html);
    dataTransfer.setData("text/plain", "x");
    await act(async () => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromDrop",
          dataTransfer,
        })
      );
    });
    await settle();
  };
  test("items in a quote, by drop", async () => {
    const onChange = await mountAt("<p></p>", "");
    await drop("<ul><blockquote><li>Aq</li><li>Bq</li></blockquote></ul>");
    expect(plain(lastHtml(onChange))).toBe(
      "<ul><li><blockquote><ul><li>Aq</li><li>Bq</li></ul></blockquote></li></ul>"
    );
  });
  test("items in code, by drop", async () => {
    const onChange = await mountAt("<p></p>", "");
    await drop("<ul><pre><li>Aq</li><li>Bq</li></pre></ul>");
    const written = plain(lastHtml(onChange));
    expect(written).toMatch(/^<ul><li><pre/);
    expect(written.match(/<li>/g)).toHaveLength(1);
  });
  test("items in table cells, by drop", async () => {
    const onChange = await mountAt("<p></p>", "");
    await drop(
      "<ul><table><tbody><tr><td><li>Aq</li></td><td>Cq</td></tr><tr><td>Dq</td><td><li>Bq</li></td></tr></tbody></table></ul>"
    );
    expect(plain(lastHtml(onChange))).not.toContain("CqDq");
  });
  test("items in a heading, by paste", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html": "<ul><h2>Tq<li>Aq</li><li>Bq</li></h2></ul>",
      "text/plain": "x",
    });
    await settle();
    expect(plain(lastHtml(onChange))).toContain("<h2>Tq");
  });
});

describe("default-ignorable characters after a nested list add no item (V4)", () => {
  test.each([
    "\u3164",
    "\u034f",
    "\u115f",
    "\uffa0",
    "\u17b4",
    "\u180b",
    "\u{e0100}",
  ])("%j", async (char) => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html": `<ul><li>Aq<ul><li>Xq</li></ul>${char}</li><li>Bq</li></ul>`,
      "text/plain": "x",
    });
    await settle();
    const template = document.createElement("template");
    template.innerHTML = plain(lastHtml(onChange));
    expect(template.content.firstElementChild!.children).toHaveLength(2);
  });
});

describe("block wrapper edges beside inline elements holding blocks (V2)", () => {
  const lines = (html: string) => html.replace(/<(?!br\b)[^>]*>/g, "");
  test.each([
    [
      "a font holding the list in a div",
      '<ul><li>Pq<div><font color="red">Aq<ul><li>Xq</li></ul>Zq</font></div>Qq</li><li>Bq</li></ul>',
      ["Pq<br />Aq", "Zq<br />Qq"],
    ],
    [
      "a font holding a list after a div",
      '<ul><li><div>Aq<ul><li>Xq</li></ul>Zq</div><font color="red">Sq<ul><li>Vq</li></ul>Qq</font></li></ul>',
      ["Zq<br />Sq"],
    ],
    [
      "bold in a font in a section",
      '<ul><li>Pq<section><font color="red"><b>Aq<ul><li>Xq</li></ul>Zq</b></font></section>Qq</li></ul>',
      ["Pq<br />Aq", "Zq<br />Qq"],
    ],
    [
      "a figure",
      "<ul><li>Pq<figure>Aq<ul><li>Xq</li></ul>Zq</figure>Qq</li></ul>",
      ["Pq<br />Aq", "Zq<br />Qq"],
    ],
  ])("%s keeps its lines", async (_name, html, expected) => {
    const onChange = await mountAt("<p></p>", "");
    paste({ "text/html": html, "text/plain": "x" });
    await settle();
    const written = lines(plain(lastHtml(onChange)));
    for (const line of expected) {
      expect(written).toContain(line);
    }
  });
});

describe("an edit at a caret where the editor finds no block (X1)", () => {
  const ITEM_QUOTE =
    "<ul><li><blockquote><p>q1</p></blockquote>q2</li><li>t1</li></ul>";
  const ITEM_RULE = "<ul><li><hr /></li><li>t1</li></ul>";
  /** A real click at the start of `word`, then `keys`. */
  const fromStartOf = (word: string, keys: string) => async () => {
    await clickInWord(word, 0);
    await userEvent.keyboard(keys);
    await settle();
  };
  /** A real click on the rule, then Left. */
  const beforeRule = async () => {
    await userEvent.click(editable()!.querySelector<HTMLElement>("hr")!);
    await settle();
    await userEvent.keyboard("{ArrowLeft}");
    await settle();
  };
  /** The caret as "text:<text>@<offset>" or "element:<type>@<offset>". */
  const caret = () =>
    editorOf()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) === false) {
          return "none";
        }
        const { anchor } = selection;
        const node = anchor.getNode();
        return anchor.type === "text"
          ? `text:${node.getTextContent()}@${anchor.offset}`
          : `element:${node.getType()}@${anchor.offset}`;
      });
  type Caret = [string, string, () => Promise<void>, string];
  const CARETS: Caret[] = [
    [
      "the end of an item's text after a quote",
      ITEM_QUOTE,
      () => clickInWord("q2"),
      "text:q2@2",
    ],
    [
      "the middle of an item's text after a quote",
      ITEM_QUOTE,
      () => clickInWord("q2", 1),
      "text:q2@1",
    ],
    [
      "the start of an item's text after a quote",
      ITEM_QUOTE,
      () => clickInWord("q2", 0),
      "text:q2@0",
    ],
    [
      "the end of an item's text after a heading",
      "<ul><li><h3>Title</h3>desc</li><li>t1</li></ul>",
      () => clickInWord("desc"),
      "text:desc@4",
    ],
    [
      "the end of an item's text after a code block",
      "<ul><li><pre><code>cmd</code></pre>after</li><li>t1</li></ul>",
      () => clickInWord("after"),
      "text:after@5",
    ],
    [
      "the end of an item's text after a rule",
      "<ul><li><hr />Z</li><li>t1</li></ul>",
      () => clickInWord("Z"),
      "text:Z@1",
    ],
    [
      "the start of an item holding a rule, then text",
      "<ul><li><hr />Z</li><li>t1</li></ul>",
      beforeRule,
      "element:listitem@0",
    ],
    [
      "the end of an item holding only a rule",
      ITEM_RULE,
      fromStartOf("t1", "{ArrowLeft}"),
      "element:listitem@1",
    ],
    [
      "the start of an item holding only a rule",
      ITEM_RULE,
      fromStartOf("t1", "{ArrowUp}"),
      "element:listitem@0",
    ],
    [
      "the end of an item holding a quote, then a rule",
      "<ul><li><blockquote><p>Z1</p></blockquote><hr /></li><li>t1</li></ul>",
      fromStartOf("t1", "{ArrowLeft}"),
      "element:listitem@2",
    ],
    [
      "the end of a quote holding a paragraph, then a rule",
      "<blockquote><p>a</p><hr /></blockquote><p>t1</p>",
      fromStartOf("t1", "{ArrowLeft}"),
      "element:quote@2",
    ],
    [
      "the end of a numbered item's text after a quote",
      "<ol><li><blockquote><p>q1</p></blockquote>q2</li><li>t1</li></ol>",
      () => clickInWord("q2"),
      "text:q2@2",
    ],
    [
      "the end of an item's text after a quote, three levels deep",
      "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2</li><li>t1</li></ul></li></ul></li></ul>",
      () => clickInWord("q2"),
      "text:q2@2",
    ],
    [
      "the end of an item's text after a heading, in a quote",
      "<blockquote><ul><li><h3>T</h3>q2</li><li>t1</li></ul></blockquote>",
      () => clickInWord("q2"),
      "text:q2@2",
    ],
  ];
  const CONTROLS: Caret[] = [
    [
      "the end of an ordinary item",
      "<ul><li>aa</li><li>bb</li></ul>",
      () => clickInWord("aa"),
      "text:aa@2",
    ],
    [
      "an empty item",
      "<ul><li>aa</li><li></li><li>bb</li></ul>",
      fromStartOf("bb", "{ArrowUp}"),
      "element:listitem@0",
    ],
    [
      "the end of a paragraph",
      "<p>pp</p><p>t1</p>",
      () => clickInWord("pp"),
      "text:pp@2",
    ],
    [
      "the end of a quote's paragraph",
      "<blockquote><p>qq</p></blockquote><p>t1</p>",
      () => clickInWord("qq"),
      "text:qq@2",
    ],
  ];
  const plainPaste = (text: string) => async () => {
    paste({ "text/plain": text });
    await settle();
  };
  const plainDrop = (text: string) => async () => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    await act(async () => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertFromDrop",
          dataTransfer,
        })
      );
    });
    await settle();
  };
  const pngFile = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 3;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((result) => resolve(result!), "image/png")
    );
    return new File([blob], "a.png", { type: "image/png" });
  };
  const image = (onChange: ReturnType<typeof vi.fn>) => async () => {
    const file = await pngFile();
    await act(async () => {
      byLabel("Image")!.click();
    });
    const input =
      container!.querySelector<HTMLInputElement>('input[type="file"]')!;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    await act(async () => {
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await vi.waitFor(() => expect(lastHtml(onChange)).toContain("<img"));
    await settle();
  };
  type Edit = [
    string,
    (onChange: ReturnType<typeof vi.fn>) => () => Promise<void>,
  ];
  const EDITS: Edit[] = [
    [
      "Shift+Enter",
      () => async () => {
        await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
        await settle();
      },
    ],
    ["a two-line plain-text paste", () => plainPaste("L1\nL2")],
    ["a three-line plain-text paste", () => plainPaste("L1\nL2\nL3")],
    ["a CRLF plain-text paste", () => plainPaste("L1\r\nL2")],
    ["a two-line plain-text drop", () => plainDrop("L1\nL2")],
    ["a plain-text paste holding a tab", () => plainPaste("a\tb")],
    ["the Image button", image],
    [
      "Enter",
      () => async () => {
        await userEvent.keyboard("{Enter}");
        await settle();
      },
    ],
    [
      "an HTML paste of two paragraphs",
      () => async () => {
        paste({ "text/html": "<p>H1</p><p>H2</p>", "text/plain": "x" });
        await settle();
      },
    ],
  ];
  const IMG =
    '<img src="https://cdn.example.org/x.png" alt="" width="2" height="3" />';
  /** What each edit writes at each caret: as at a caret in an ordinary item. */
  const WRITES: Record<string, Record<string, string>> = {
    "the end of an item's text after a quote": {
      "Shift+Enter":
        "<ul><li><blockquote><p>q1</p></blockquote>q2<br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><blockquote><p>q1</p></blockquote>q2a\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><blockquote><p>q1</p></blockquote>q2${IMG}</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><blockquote><p>q1</p></blockquote>q2</li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><blockquote><p>q1</p></blockquote>q2H1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the middle of an item's text after a quote": {
      "Shift+Enter":
        "<ul><li><blockquote><p>q1</p></blockquote>q<br />2</li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>qL1</li><li>L22</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>qL1</li><li>L2</li><li>L32</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>qL1</li><li>L22</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><blockquote><p>q1</p></blockquote>qL1</li><li>L22</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><blockquote><p>q1</p></blockquote>qa\tb2</li><li>t1</li></ul>",
      "the Image button": `<ul><li><blockquote><p>q1</p></blockquote>q${IMG}2</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><blockquote><p>q1</p></blockquote>q</li><li>2</li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><blockquote><p>q1</p></blockquote>qH1</li></ul><p>H22</p><ul><li>t1</li></ul>",
    },
    "the start of an item's text after a quote": {
      "Shift+Enter":
        "<ul><li><blockquote><p>q1</p></blockquote><br />q2</li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>L1</li><li>L2q2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>L1</li><li>L2</li><li>L3q2</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><blockquote><p>q1</p></blockquote>L1</li><li>L2q2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><blockquote><p>q1</p></blockquote>L1</li><li>L2q2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><blockquote><p>q1</p></blockquote>a\tbq2</li><li>t1</li></ul>",
      "the Image button": `<ul><li><blockquote><p>q1</p></blockquote>${IMG}q2</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><blockquote><p>q1</p></blockquote></li><li>q2</li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><blockquote><p>q1</p></blockquote>H1</li></ul><p>H2q2</p><ul><li>t1</li></ul>",
    },
    "the end of an item's text after a heading": {
      "Shift+Enter": "<ul><li><h3>Title</h3>desc<br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><h3>Title</h3>descL1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><h3>Title</h3>descL1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><h3>Title</h3>descL1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><h3>Title</h3>descL1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><h3>Title</h3>desca\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><h3>Title</h3>desc${IMG}</li><li>t1</li></ul>`,
      Enter: "<ul><li><h3>Title</h3>desc</li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><h3>Title</h3>descH1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the end of an item's text after a code block": {
      "Shift+Enter":
        "<ul><li><pre><code>cmd</code></pre>after<br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><pre><code>cmd</code></pre>afterL1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><pre><code>cmd</code></pre>afterL1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><pre><code>cmd</code></pre>afterL1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><pre><code>cmd</code></pre>afterL1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><pre><code>cmd</code></pre>aftera\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><pre><code>cmd</code></pre>after${IMG}</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><pre><code>cmd</code></pre>after</li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><pre><code>cmd</code></pre>afterH1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the end of an item's text after a rule": {
      "Shift+Enter": "<ul><li><hr />Z<br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><hr />ZL1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><hr />ZL1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><hr />ZL1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><hr />ZL1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><hr />Za\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><hr />Z${IMG}</li><li>t1</li></ul>`,
      Enter: "<ul><li><hr />Z</li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><hr />ZH1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the start of an item holding a rule, then text": {
      "Shift+Enter": "<ul><li><br /><hr />Z</li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li>L1</li><li>L2<hr />Z</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li>L1</li><li>L2</li><li>L3<hr />Z</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li>L1</li><li>L2<hr />Z</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li>L1</li><li>L2<hr />Z</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li>a\tb<hr />Z</li><li>t1</li></ul>",
      "the Image button": `<ul><li>${IMG}<hr />Z</li><li>t1</li></ul>`,
      Enter: "<ul><li></li><li><hr />Z</li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>H1</li></ul><p>H2</p><hr /><p>Z</p><ul><li>t1</li></ul>",
    },
    "the end of an item holding only a rule": {
      "Shift+Enter": "<ul><li><hr /><br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><hr />L1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><hr />a\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><hr />${IMG}</li><li>t1</li></ul>`,
      Enter: "<ul><li><hr /></li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><hr />H1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the start of an item holding only a rule": {
      "Shift+Enter": "<ul><li><br /><hr /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li>L1</li><li>L2<hr /></li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li>L1</li><li>L2</li><li>L3<hr /></li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li>L1</li><li>L2<hr /></li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li>L1</li><li>L2<hr /></li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li>a\tb<hr /></li><li>t1</li></ul>",
      "the Image button": `<ul><li>${IMG}<hr /></li><li>t1</li></ul>`,
      Enter: "<ul><li></li><li><hr /></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>H1</li></ul><p>H2</p><hr /><ul><li>t1</li></ul>",
    },
    "the end of an item holding a quote, then a rule": {
      "Shift+Enter":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr /><br /></li><li>t1</li></ul>",
      "a two-line plain-text paste":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a three-line plain-text paste":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />L1</li><li>L2</li><li>L3</li><li>t1</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a two-line plain-text drop":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />L1</li><li>L2</li><li>t1</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />a\tb</li><li>t1</li></ul>",
      "the Image button": `<ul><li><blockquote><p>Z1</p></blockquote><hr />${IMG}</li><li>t1</li></ul>`,
      Enter:
        "<ul><li><blockquote><p>Z1</p></blockquote><hr /></li><li></li><li>t1</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li><blockquote><p>Z1</p></blockquote><hr />H1</li></ul><p>H2</p><ul><li>t1</li></ul>",
    },
    "the end of a quote holding a paragraph, then a rule": {
      "Shift+Enter":
        "<blockquote><p>a</p><hr /><p><br /></p></blockquote><p>t1</p>",
      "a two-line plain-text paste":
        "<blockquote><p>a</p><hr /><p>L1</p><p>L2</p></blockquote><p>t1</p>",
      "a three-line plain-text paste":
        "<blockquote><p>a</p><hr /><p>L1</p><p>L2</p><p>L3</p></blockquote><p>t1</p>",
      "a CRLF plain-text paste":
        "<blockquote><p>a</p><hr /><p>L1</p><p>L2</p></blockquote><p>t1</p>",
      "a two-line plain-text drop":
        "<blockquote><p>a</p><hr /><p>L1</p><p>L2</p></blockquote><p>t1</p>",
      "a plain-text paste holding a tab":
        "<blockquote><p>a</p><hr /><p>a\tb</p></blockquote><p>t1</p>",
      "the Image button": `<blockquote><p>a</p><hr /><p>${IMG}</p></blockquote><p>t1</p>`,
      Enter: "<blockquote><p>a</p><hr /><p></p></blockquote><p>t1</p>",
      "an HTML paste of two paragraphs":
        "<blockquote><p>a</p><hr /><p>H1</p><p>H2</p></blockquote><p>t1</p>",
    },
    "the end of a numbered item's text after a quote": {
      "Shift+Enter":
        "<ol><li><blockquote><p>q1</p></blockquote>q2<br /></li><li>t1</li></ol>",
      "a two-line plain-text paste":
        "<ol><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ol>",
      "a three-line plain-text paste":
        "<ol><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>L3</li><li>t1</li></ol>",
      "a CRLF plain-text paste":
        "<ol><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ol>",
      "a two-line plain-text drop":
        "<ol><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ol>",
      "a plain-text paste holding a tab":
        "<ol><li><blockquote><p>q1</p></blockquote>q2a\tb</li><li>t1</li></ol>",
      "the Image button": `<ol><li><blockquote><p>q1</p></blockquote>q2${IMG}</li><li>t1</li></ol>`,
      Enter:
        "<ol><li><blockquote><p>q1</p></blockquote>q2</li><li></li><li>t1</li></ol>",
      "an HTML paste of two paragraphs":
        "<ol><li><blockquote><p>q1</p></blockquote>q2H1</li></ol><p>H2</p><ol><li>t1</li></ol>",
    },
    "the end of an item's text after a quote, three levels deep": {
      "Shift+Enter":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2<br /></li><li>t1</li></ul></li></ul></li></ul>",
      "a two-line plain-text paste":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul></li></ul></li></ul>",
      "a three-line plain-text paste":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>L3</li><li>t1</li></ul></li></ul></li></ul>",
      "a CRLF plain-text paste":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul></li></ul></li></ul>",
      "a two-line plain-text drop":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2L1</li><li>L2</li><li>t1</li></ul></li></ul></li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2a\tb</li><li>t1</li></ul></li></ul></li></ul>",
      "the Image button": `<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2${IMG}</li><li>t1</li></ul></li></ul></li></ul>`,
      Enter:
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2</li><li></li><li>t1</li></ul></li></ul></li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>a<ul><li>b<ul><li><blockquote><p>q1</p></blockquote>q2H1</li></ul></li><li>H2<ul><li>t1</li></ul></li></ul></li></ul>",
    },
    "the end of an item's text after a heading, in a quote": {
      "Shift+Enter":
        "<blockquote><ul><li><h3>T</h3>q2<br /></li><li>t1</li></ul></blockquote>",
      "a two-line plain-text paste":
        "<blockquote><ul><li><h3>T</h3>q2L1</li><li>L2</li><li>t1</li></ul></blockquote>",
      "a three-line plain-text paste":
        "<blockquote><ul><li><h3>T</h3>q2L1</li><li>L2</li><li>L3</li><li>t1</li></ul></blockquote>",
      "a CRLF plain-text paste":
        "<blockquote><ul><li><h3>T</h3>q2L1</li><li>L2</li><li>t1</li></ul></blockquote>",
      "a two-line plain-text drop":
        "<blockquote><ul><li><h3>T</h3>q2L1</li><li>L2</li><li>t1</li></ul></blockquote>",
      "a plain-text paste holding a tab":
        "<blockquote><ul><li><h3>T</h3>q2a\tb</li><li>t1</li></ul></blockquote>",
      "the Image button": `<blockquote><ul><li><h3>T</h3>q2${IMG}</li><li>t1</li></ul></blockquote>`,
      Enter:
        "<blockquote><ul><li><h3>T</h3>q2</li><li></li><li>t1</li></ul></blockquote>",
      "an HTML paste of two paragraphs":
        "<blockquote><ul><li><h3>T</h3>q2H1</li></ul><p>H2</p><ul><li>t1</li></ul></blockquote>",
    },
  };
  /** What each edit writes at an ordinary caret, unchanged. */
  const CONTROL_WRITES: Record<string, Record<string, string>> = {
    "the end of an ordinary item": {
      "Shift+Enter": "<ul><li>aa<br /></li><li>bb</li></ul>",
      "a two-line plain-text paste":
        "<ul><li>aaL1</li><li>L2</li><li>bb</li></ul>",
      "a three-line plain-text paste":
        "<ul><li>aaL1</li><li>L2</li><li>L3</li><li>bb</li></ul>",
      "a CRLF plain-text paste": "<ul><li>aaL1</li><li>L2</li><li>bb</li></ul>",
      "a two-line plain-text drop":
        "<ul><li>aaL1</li><li>L2</li><li>bb</li></ul>",
      "a plain-text paste holding a tab": "<ul><li>aaa\tb</li><li>bb</li></ul>",
      "the Image button": `<ul><li>aa${IMG}</li><li>bb</li></ul>`,
      Enter: "<ul><li>aa</li><li></li><li>bb</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>aaH1</li></ul><p>H2</p><ul><li>bb</li></ul>",
    },
    "an empty item": {
      "Shift+Enter": "<ul><li>aa</li><li><br /></li><li>bb</li></ul>",
      "a two-line plain-text paste":
        "<ul><li>aa</li><li>L1</li><li>L2</li><li>bb</li></ul>",
      "a three-line plain-text paste":
        "<ul><li>aa</li><li>L1</li><li>L2</li><li>L3</li><li>bb</li></ul>",
      "a CRLF plain-text paste":
        "<ul><li>aa</li><li>L1</li><li>L2</li><li>bb</li></ul>",
      "a two-line plain-text drop":
        "<ul><li>aa</li><li>L1</li><li>L2</li><li>bb</li></ul>",
      "a plain-text paste holding a tab":
        "<ul><li>aa</li><li>a\tb</li><li>bb</li></ul>",
      "the Image button": `<ul><li>aa</li><li>${IMG}</li><li>bb</li></ul>`,
      Enter: "<ul><li>aa</li></ul><p></p><ul><li>bb</li></ul>",
      "an HTML paste of two paragraphs":
        "<ul><li>aa</li><li>H1</li></ul><p>H2</p><ul><li>bb</li></ul>",
    },
    "the end of a paragraph": {
      "Shift+Enter": "<p>pp<br /></p><p>t1</p>",
      "a two-line plain-text paste": "<p>ppL1</p><p>L2</p><p>t1</p>",
      "a three-line plain-text paste": "<p>ppL1</p><p>L2</p><p>L3</p><p>t1</p>",
      "a CRLF plain-text paste": "<p>ppL1</p><p>L2</p><p>t1</p>",
      "a two-line plain-text drop": "<p>ppL1</p><p>L2</p><p>t1</p>",
      "a plain-text paste holding a tab": "<p>ppa\tb</p><p>t1</p>",
      "the Image button": `<p>pp${IMG}</p><p>t1</p>`,
      Enter: "<p>pp</p><p></p><p>t1</p>",
      "an HTML paste of two paragraphs": "<p>ppH1</p><p>H2</p><p>t1</p>",
    },
    "the end of a quote's paragraph": {
      "Shift+Enter": "<blockquote><p>qq<br /></p></blockquote><p>t1</p>",
      "a two-line plain-text paste":
        "<blockquote><p>qqL1</p><p>L2</p></blockquote><p>t1</p>",
      "a three-line plain-text paste":
        "<blockquote><p>qqL1</p><p>L2</p><p>L3</p></blockquote><p>t1</p>",
      "a CRLF plain-text paste":
        "<blockquote><p>qqL1</p><p>L2</p></blockquote><p>t1</p>",
      "a two-line plain-text drop":
        "<blockquote><p>qqL1</p><p>L2</p></blockquote><p>t1</p>",
      "a plain-text paste holding a tab":
        "<blockquote><p>qqa\tb</p></blockquote><p>t1</p>",
      "the Image button": `<blockquote><p>qq${IMG}</p></blockquote><p>t1</p>`,
      Enter: "<blockquote><p>qq</p><p></p></blockquote><p>t1</p>",
      "an HTML paste of two paragraphs":
        "<blockquote><p>qqH1</p><p>H2</p></blockquote><p>t1</p>",
    },
  };
  const run = async ([, html, place, at]: Caret, [name, edit]: Edit) => {
    const onChange = await renderField(html, {
      source: {
        uploadImage: vi.fn(async () => ({
          url: "https://cdn.example.org/x.png",
          path: "org/x.png",
        })),
      } as never,
    });
    await place();
    expect(caret()).toBe(at);
    const before = JSON.stringify(editorOf()!.getEditorState().toJSON());
    const errors = vi.spyOn(console, "error");
    const start = performance.now();
    await edit(onChange)();
    expect(performance.now() - start, name).toBeLessThan(2000);
    expect(
      errors.mock.calls
        .map((args) => String(args[0]))
        .filter((message) => message.includes("not wrapped in act") === false)
    ).toEqual([]);
    const written = plain(lastHtml(onChange));
    editable()!.focus();
    await undo();
    expect(JSON.stringify(editorOf()!.getEditorState().toJSON())).toBe(before);
    return written;
  };
  const cases = (carets: Caret[]) =>
    carets.flatMap((place) =>
      EDITS.map((edit) => ({
        caret: place[0],
        edit: edit[0],
        place,
        run: edit,
      }))
    );
  test.each(cases(CARETS))(
    "$edit at $caret finishes at once and lands at the caret",
    async ({ caret: name, edit, place, run: step }) => {
      const written = await run(place, step);
      expect(written).toBe(WRITES[name][edit]);
      // a tab reloads as a space in any block
      if (written.includes("\t") === false) {
        expectFixedPoint(written);
      }
    },
    60000
  );
  test.each(cases(CONTROLS))(
    "$edit at $caret writes what it wrote before",
    async ({ caret: name, edit, place, run: step }) => {
      const written = await run(place, step);
      expect(written).toBe(CONTROL_WRITES[name][edit]);
    },
    60000
  );
});

describe("the caret after a paste into the middle of a nested item's text (Y1)", () => {
  const STORED =
    "<ul><li>a1<ul><li>b1<ul><li>s1</li><li>t1</li></ul></li></ul></li><li>a2</li></ul>";
  const BEFORE = "<ul><li>a1<ul><li>b1<ul><li>s</li></ul></li></ul></li></ul>";
  const AFTER =
    "<ul><li><ul><li><ul><li>t1</li></ul></li></ul></li><li>a2</li></ul>";
  test.each([
    [
      "a numbered list",
      "<ol><li>A</li><li>B</li></ol>",
      `${BEFORE}<ol><li>A</li><li>B~1</li></ol>${AFTER}`,
    ],
    [
      "a quote",
      "<blockquote><p>A</p></blockquote>",
      `${BEFORE}<blockquote><p>A~1</p></blockquote>${AFTER}`,
    ],
    [
      "a quote holding a list",
      "<blockquote><ul><li>A</li><li>B</li></ul></blockquote>",
      `${BEFORE}<blockquote><ul><li>A</li><li>B~1</li></ul></blockquote>${AFTER}`,
    ],
    [
      "two lists, one after the other",
      "<ul><li>A</li></ul><ol><li>B</li></ol>",
      `<ul><li>a1<ul><li>b1<ul><li>s</li><li>A</li></ul></li></ul></li></ul><ol><li>B~1</li></ol>${AFTER}`,
    ],
    [
      "a nested list, then a paragraph",
      "<ol><li>A<ul><li>X</li></ul></li><li>B</li></ol><p>C</p>",
      `${BEFORE}<ol><li>A<ul><li>X</li></ul></li><li>B</li></ol><p>C~1</p>${AFTER}`,
    ],
  ])(
    "typing after %s pasted lands right after it",
    async (_name, html, expected) => {
      const onChange = await mountAt(STORED, "s1", 1);
      paste({ "text/html": html, "text/plain": "x" });
      await settle();
      await userEvent.keyboard("~");
      await settle();
      expect(plain(lastHtml(onChange))).toBe(expected);
    },
    60000
  );

  test("typing after a numbered list pasted in the middle of a depth-3 item's text lands right after it", async () => {
    const onChange = await mountAt(nestedList(3, "s"), "s3", 1);
    paste({ "text/html": "<ol><li>A</li><li>B</li></ol>", "text/plain": "x" });
    await settle();
    await userEvent.keyboard("~");
    await settle();
    expect(plain(lastHtml(onChange))).toBe(
      "<ul><li>s1<ul><li>s2<ul><li>s</li></ul></li></ul></li></ul><ol><li>A</li><li>B~3</li></ol>"
    );
  }, 60000);

  test("typing after a pasted tree ending in a stray item lands right after its last text", async () => {
    const onChange = await mountAt(STORED, "s1", 1);
    paste({
      "text/html":
        "<div><ol><li><p>T1q</p></li><li><ol><li>T2q <hr></li><li>T3q</li></ol>T4qT5qT6q</li></ol></div><li><div><ol><li>T7qT8q</li><li><p>T9q</p>T10q<ul><li><p>T11q</p><p>T12q</p><hr></li></ul></li></ol>T13q</div></li>",
      "text/plain": "x",
    });
    await settle();
    await userEvent.keyboard("~");
    await settle();
    expect(plain(lastHtml(onChange))).toBe(
      "<ul><li>a1<ul><li>b1<ul><li>s</li></ul></li></ul></li></ul><ol><li>T1q<ol><li>T2q<hr /></li><li>T3q</li></ol></li><li>T4qT5qT6q</li></ol><ul><li><ul><li><ul><li><ol><li>T7qT8q</li><li>T9q<br />T10q<ul><li>T11q<br />T12q<br /><hr /></li></ul></li></ol></li><li>T13q~1</li><li>t1</li></ul></li></ul></li><li>a2</li></ul>"
    );
  }, 60000);

  test("typing after a rule and a line break lifted after a pasted list lands after the rule", async () => {
    const onChange = await mountAt(nestedList(6, "s"), "s6");
    paste({
      "text/html":
        "<ul><li>a.<blockquote><ul><li>x.</li></ul></blockquote><hr><br></li></ul>",
      "text/plain": "x",
    });
    await settle();
    await userEvent.keyboard("z");
    await settle();
    expect(plain(lastHtml(onChange))).toBe(
      "<ul><li>s1<ul><li>s2<ul><li>s3<ul><li>s4<ul><li>s5<ul><li>s6</li><li>a.<ul><li>x.</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul><hr /><p>z</p>"
    );
  }, 60000);
});

/** Drops `html` (with plain text) at the selection. */
const dropHtml = async (html: string) => {
  const dataTransfer = new DataTransfer();
  dataTransfer.setData("text/html", html);
  dataTransfer.setData("text/plain", "x");
  await act(async () => {
    editable()!.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertFromDrop",
        dataTransfer,
      })
    );
  });
  await settle();
};

describe("a rule after an item's leading nested list stays behind content (Y2)", () => {
  const SHAPES = [
    [
      "a paragraph, a list, then a rule",
      "<ul><li><ul><li>Xq</li></ul><p>Tq</p><ul><li>Yq</li></ul><hr></li><li>Bq</li></ul>",
      "<ul><li><ul><li>Xq</li></ul></li><li>Tq<br /><hr /><ul><li>Yq</li></ul></li><li>Bq</li></ul>",
    ],
    [
      "a paragraph, a list, then two rules",
      "<ul><li><ul><li>Xq</li></ul><p>Tq</p><ul><li>Yq</li></ul><hr><hr></li><li>Bq</li></ul>",
      "<ul><li><ul><li>Xq</li></ul></li><li>Tq<br /><hr /><hr /><ul><li>Yq</li></ul></li><li>Bq</li></ul>",
    ],
    [
      "a quote, a list, then a rule",
      "<ul><li><ul><li>Xq</li></ul><blockquote><p>Tq</p></blockquote><ul><li>Yq</li></ul><hr></li><li>Bq</li></ul>",
      "<ul><li><ul><li>Xq</li></ul></li><li><blockquote><p>Tq</p></blockquote><hr /><ul><li>Yq</li></ul></li><li>Bq</li></ul>",
    ],
    [
      "a quote, a rule, then a paragraph",
      "<ul><li><ul><li>Xq</li></ul><blockquote><p>Tq</p></blockquote><hr><p>Zq</p></li><li>Bq</li></ul>",
      "<ul><li><ul><li>Xq</li></ul></li><li><blockquote><p>Tq</p></blockquote><hr /></li><li>Zq</li><li>Bq</li></ul>",
    ],
    [
      "a paragraph, a list, a rule, then a paragraph",
      "<ul><li><ul><li>Xq</li></ul><p>Tq</p><ul><li>Yq</li></ul><hr><p>Uq</p></li><li>Bq</li></ul>",
      "<ul><li><ul><li>Xq</li></ul></li><li>Tq<br /><hr /><ul><li>Yq</li></ul></li><li>Uq</li><li>Bq</li></ul>",
    ],
    [
      "a rule before the paragraph",
      "<ul><li><ul><li>Xq</li></ul><hr><p>Tq</p><ul><li>Yq</li></ul></li><li>Bq</li></ul>",
      "<ul><li><ul><li>Xq</li></ul></li><li><hr /><br />Tq<ul><li>Yq</li></ul></li><li>Bq</li></ul>",
    ],
    [
      "a rule on each side of the paragraph",
      "<ul><li><ul><li>Xq</li></ul><hr><p>Tq</p><hr></li><li>Bq</li></ul>",
      "<ul><li><ul><li>Xq</li></ul></li><li><hr /><br />Tq<br /><hr /></li><li>Bq</li></ul>",
    ],
    [
      "text of the item's own before its list",
      "<ul><li>Aq<ul><li>Xq</li></ul><p>Tq</p><ul><li>Yq</li></ul><hr></li><li>Bq</li></ul>",
      "<ul><li>Aq<br /><hr /><ul><li>Xq</li></ul></li><li>Tq<ul><li>Yq</li></ul></li><li>Bq</li></ul>",
    ],
  ] as const;
  test.each(
    SHAPES.flatMap(([shape, html, expected]) =>
      (["paste", "drop"] as const).map((how) => ({
        shape,
        how,
        html,
        expected,
      }))
    )
  )("$how of $shape writes", async ({ how, html, expected }) => {
    const onChange = await mountAt("<p></p>", "");
    if (how === "paste") {
      paste({ "text/html": html, "text/plain": "x" });
      await settle();
    } else {
      await dropHtml(html);
    }
    expect(plain(lastHtml(onChange))).toBe(expected);
  });
});

describe("a block wrapper that gives way keeps its own last line break only before line content (Y3)", () => {
  test.each([
    [
      "a div, then a div",
      "<ul><li><div>Aq<ul><li>Xq</li></ul>Zq<br></div><div>Qq</div></li><li>Bq</li></ul>",
      "<ul><li>Aq<ul><li>Xq</li></ul></li><li>Zq<br />Qq</li><li>Bq</li></ul>",
    ],
    [
      "a div after a quote, then a div",
      "<ul><li><div>Aq<ul><li>Xq</li></ul><blockquote><p>Z1q</p></blockquote>Z2q<br></div><div>Qq</div></li><li>Bq</li></ul>",
      "<ul><li>Aq<ul><li>Xq</li></ul></li><li><blockquote><p>Z1q</p></blockquote></li><li>Z2q<br />Qq</li><li>Bq</li></ul>",
    ],
    [
      "an inner div holding a quote, then a div",
      "<ul><li><div>Aq<ul><li>Xq</li></ul><div><blockquote><p>Z1q</p></blockquote>Z2q<br></div><div>Qq</div></div></li><li>Bq</li></ul>",
      "<ul><li>Aq<ul><li>Xq</li></ul></li><li><blockquote><p>Z1q</p></blockquote></li><li>Z2q<br />Qq</li><li>Bq</li></ul>",
    ],
    [
      "a section ending in white space and a comment, then a paragraph",
      "<ul><li><section>Aq<ul><li>Xq</li></ul>Zq<br> <!-- c --> </section><p>Qq</p></li><li>Bq</li></ul>",
      "<ul><li>Aq<ul><li>Xq</li></ul></li><li>Zq<br />Qq</li><li>Bq</li></ul>",
    ],
    [
      "a figure, then a div",
      "<ul><li><figure>Aq<ul><li>Xq</li></ul>Zq<br></figure><div>Qq</div></li><li>Bq</li></ul>",
      "<ul><li>Aq<ul><li>Xq</li></ul></li><li>Zq<br />Qq</li><li>Bq</li></ul>",
    ],
    [
      "a div ending in two line breaks, then a div",
      "<ul><li><div>Aq<ul><li>Xq</li></ul>Zq<br><br></div><div>Qq</div></li><li>Bq</li></ul>",
      "<ul><li>Aq<ul><li>Xq</li></ul></li><li>Zq<br /><br />Qq</li><li>Bq</li></ul>",
    ],
    [
      "a div, then text",
      "<ul><li><div>Aq<ul><li>Xq</li></ul>Zq<br></div>Qq</li><li>Bq</li></ul>",
      "<ul><li>Aq<ul><li>Xq</li></ul></li><li>Zq<br />Qq</li><li>Bq</li></ul>",
    ],
  ])("%s writes", async (_name, html, expected) => {
    const onChange = await mountAt("<p></p>", "");
    paste({ "text/html": html, "text/plain": "x" });
    await settle();
    expect(plain(lastHtml(onChange))).toBe(expected);
  });
});

describe("items between a list and a quote, code or table it holds read as dropped before (Y4)", () => {
  const SHAPES = [
    [
      "items in table cells",
      "<ul><table><tbody><tr><td><li>Aq</li></td><td>Cq</td></tr><tr><td>Dq</td><td><li>Bq</li></td></tr></tbody></table></ul>",
      "<ul><li>Aq</li><li>Cq</li><li>Dq</li><li>Bq</li></ul>",
    ],
    [
      "items and text in a quote",
      "<ul><blockquote>Tq<li>Aq</li>Uq<li>Bq</li>Vq</blockquote></ul>",
      "<ul><li><blockquote>Tq<ul><li>Aq</li></ul>Uq<ul><li>Bq</li></ul>Vq</blockquote></li></ul>",
    ],
    [
      "items and text in code",
      "<ul><pre>Tq<li>Aq</li>Uq<li>Bq</li>Vq</pre></ul>",
      "<ul><li><pre><code>Tq\nAq\nUq\nBq\nVq</code></pre></li></ul>",
    ],
    [
      "items and text in a heading",
      "<ul><h2>Tq<li>Aq</li>Uq<li>Bq</li>Vq</h2></ul>",
      "<ul><li><h2>Tq</h2><ul><li>Aq</li><li>Bq</li></ul></li></ul><h2>UqVq</h2>",
    ],
  ] as const;
  test.each(
    SHAPES.flatMap(([shape, html, expected]) =>
      (["drop", "paste"] as const).map((how) => ({
        shape,
        how,
        html,
        expected,
      }))
    )
  )("$how of $shape writes", async ({ how, html, expected }) => {
    const onChange = await mountAt("<p></p>", "");
    const errors = vi.spyOn(console, "error");
    if (how === "paste") {
      paste({ "text/html": html, "text/plain": "x" });
      await settle();
    } else {
      await dropHtml(html);
    }
    expect(
      errors.mock.calls
        .map((args) => String(args[0]))
        .filter((message) => message.includes("not wrapped in act") === false)
    ).toEqual([]);
    expect(plain(lastHtml(onChange))).toBe(expected);
  });
});

describe("edits after a pasted item's quote ending in a rule finish at once (Y5)", () => {
  test("a two-line plain-text paste, then Shift+Enter", async () => {
    const onChange = await mountAt("<p></p>", "");
    paste({
      "text/html":
        "<ul><li>A<ul><li>X</li></ul><blockquote><p>Z1</p><hr></blockquote></li></ul>",
      "text/plain": "x",
    });
    await settle();
    expect(
      editorOf()!
        .getEditorState()
        .read(() => {
          const selection = $getSelection();
          return $isRangeSelection(selection)
            ? `${selection.anchor.type}:${selection.anchor.getNode().getType()}@${selection.anchor.offset}`
            : "none";
        })
    ).toBe("element:quote@2");
    const errors = vi.spyOn(console, "error");
    for (const step of [
      async () => {
        paste({ "text/plain": "L1\nL2" });
        await settle();
      },
      async () => {
        await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
        await settle();
      },
    ]) {
      const start = performance.now();
      await step();
      expect(performance.now() - start).toBeLessThan(2000);
    }
    expect(
      errors.mock.calls
        .map((args) => String(args[0]))
        .filter((message) => message.includes("not wrapped in act") === false)
    ).toEqual([]);
    expect(plain(lastHtml(onChange))).toBe(
      "<ul><li>A<ul><li>X</li></ul></li><li><blockquote><p>Z1</p><hr /><p>L1</p><p>L2<br /></p></blockquote></li></ul>"
    );
  }, 60000);
});

describe("an item with no content before its nested list leaves no item holding only rules (Z1)", () => {
  const PARTS: Record<string, (index: number) => string> = {
    L: (index) => `<ul><li>L${index}q</li></ul>`,
    O: (index) => `<ol><li>O${index}q</li></ol>`,
    R: () => "<hr>",
    T: (index) => `T${index}q`,
    Q: (index) => `<blockquote><p>Q${index}q</p></blockquote>`,
    B: () => "<br>",
    D: (index) => `<div><hr>D${index}q</div>`,
  };
  const KEYS = Object.keys(PARTS);
  /** Shapes with a list, a rule and text, none before the first list. */
  const isShape = (shape: string[]) =>
    /[LO]/.test(shape.join("")) &&
    /[RD]/.test(shape.join("")) &&
    /[TQD]/.test(shape.join("")) &&
    shape
      .slice(
        0,
        shape.findIndex((part) => /[LO]/.test(part))
      )
      .every((part) => /[TQD]/.test(part) === false);
  const shapesOf = (length: number): string[][] =>
    length === 0
      ? [[]]
      : shapesOf(length - 1).flatMap((shape) =>
          KEYS.map((key) => [...shape, key])
        );
  const SHORT = [1, 2, 3].flatMap(shapesOf).filter(isShape);
  // a fixed sample of the longer shapes
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const sample = (all: string[][], count: number) => {
    const picked: string[][] = [];
    const pool = [...all];
    while (picked.length < count && pool.length > 0) {
      picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    return picked;
  };
  const LONG = sample([4, 5].flatMap(shapesOf).filter(isShape), 240);
  const htmlOf = (shape: string[]) =>
    `<ul><li>${shape.map((part, index) => PARTS[part](index + 1)).join("")}</li><li>Bq</li></ul>`;
  const onlyRules = (html: string) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return [...template.content.querySelectorAll("li")]
      .filter((item) => {
        const own = [...item.childNodes].filter(
          (node) =>
            (node instanceof Element && /^(UL|OL)$/.test(node.tagName)) ===
            false
        );
        return (
          own.some(
            (node) =>
              node instanceof Element &&
              (node.tagName === "HR" || node.querySelector("hr") !== null)
          ) && own.every((node) => (node.textContent ?? "").trim() === "")
        );
      })
      .map((item) => item.outerHTML);
  };
  const check = async (shape: string[], how: "paste" | "drop") => {
    const html = htmlOf(shape);
    const onChange = await mountAt("<p></p>", "");
    if (how === "paste") {
      paste({ "text/html": html, "text/plain": "x" });
      await settle();
    } else {
      await dropHtml(html);
    }
    const written = plain(lastHtml(onChange));
    expect(onlyRules(written), written).toEqual([]);
    expect(written.match(/<hr/g)?.length ?? 0, written).toBe(
      html.match(/<hr/g)?.length ?? 0
    );
    const order = (value: string) => readingOrder(value).replace(/\|/g, "");
    expect(order(written), written).toBe(order(html));
  };
  test.each(SHORT.map((shape) => shape.join(" ")))(
    "paste of %s",
    async (shape) => check(shape.split(" "), "paste")
  );
  test.each(LONG.map((shape) => shape.join(" ")))(
    "paste of %s",
    async (shape) => check(shape.split(" "), "paste")
  );
  test.each(sample([...SHORT, ...LONG], 40).map((shape) => shape.join(" ")))(
    "drop of %s",
    async (shape) => check(shape.split(" "), "drop")
  );
});
