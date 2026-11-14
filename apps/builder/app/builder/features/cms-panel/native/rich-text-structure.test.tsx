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
        })
      )
    );
  });
  await settle();
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
