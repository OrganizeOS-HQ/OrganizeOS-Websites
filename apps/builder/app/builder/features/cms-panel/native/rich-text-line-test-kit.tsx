// The line tests' kit: the drivers lifted from the prototype's record
// harness, the baseline offsets, and the checks every assertion test runs
// through. It imports nothing from the line modules, so the same file runs
// at fork main.
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, vi } from "vitest";
import { cdp, userEvent } from "@vitest/browser/context";
import {
  $createNodeSelection,
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  createEditor,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type PointType,
  type RangeSelection,
  type SerializedEditorState,
} from "lexical";
import {
  $getClipboardDataFromSelection,
  $insertDataTransferForRichText,
} from "@lexical/clipboard";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";
import {
  exportRichTextHtml,
  importRichTextHtml,
  parseHtml,
  registerRichTextTransforms,
  richTextHtmlConfig,
  richTextNodes,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import {
  byLabel,
  click,
  editable,
  editorOf,
  expectFixedPoint,
  fieldContainer,
  fontsLoaded,
  lastHtml,
  plain,
  renderField,
  settle,
  unmountField,
} from "./rich-text-test-harness";
import { sameState } from "./rich-text-line-test-compare";

export type Step = () => Promise<void>;

type Session = { send: (method: string, params?: object) => Promise<unknown> };
const session = () => cdp() as unknown as Session;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Values

/** The stored image tag. */
export const IMG =
  '<img src="https://cdn.example.org/x.png" alt="" width="2" height="3" />';

/** The clipboard namespace the kit passes to every field it mounts (T14.1). */
export const KIT_NAMESPACE = "cms-rich-text-kit";

/** The check's P and N items around a middle item. */
export const LI = (middle: string) =>
  `<ul><li>Pw</li><li>${middle}</li><li>Nw</li></ul>`;
export const W = (fragment: string) =>
  `<ul><li>Pw</li>${fragment}<li>Nw</li></ul>`;
export const WJ = (fragment: string) => `<ul>${fragment}<li>Nw</li></ul>`;
export const WN = (fragment: string) => `<ul><li>Pw</li>${fragment}</ul>`;

/** A write as the tables give it: images as `<img />`, links as `<a>`. */
export const short = (html: string) =>
  plain(html)
    .replace(/<img\b[^>]*>/g, "<img />")
    .replace(/<a\b[^>]*>/g, "<a>");

const PARTS: Array<(i: number) => string> = [
  (i) => `T${i}w`,
  () => "<br>",
  (i) => `<blockquote>Q${i}w</blockquote>`,
  (i) => `<blockquote><p>Q${i}a</p><p>Q${i}b</p></blockquote>`,
  (i) => `<h3>H${i}w</h3>`,
  (i) => `<pre><code>C${i}w</code></pre>`,
  () => "<hr>",
  (i) => `<ul><li>N${i}w</li></ul>`,
];
const PLACES: Array<(x: string) => string> = [
  (x) => `<ul><li>Pw</li><li>${x}</li><li>Zw</li></ul>`,
  (x) => `<ul><li>Aw<ul><li>${x}</li></ul></li></ul>`,
  (x) => `<blockquote><ul><li>${x}</li></ul></blockquote>`,
  (x) => `<blockquote>${x}</blockquote>`,
];

/**
 * The state-space grid: every sequence of up to `maxParts` parts in each of
 * the four places, sanitised as stored.
 */
export const stateSpaceValues = (maxParts: number) => {
  const sequences: number[][] = [];
  const walk = (prefix: number[]) => {
    if (prefix.length > 0) {
      sequences.push(prefix);
    }
    if (prefix.length === maxParts) {
      return;
    }
    for (let part = 0; part < PARTS.length; part += 1) {
      walk([...prefix, part]);
    }
  };
  walk([]);
  return sequences.flatMap((sequence) =>
    PLACES.map((place) =>
      sanitizeRichTextHtml(
        place(sequence.map((part, i) => PARTS[part](i)).join(""))
      )
    )
  );
};

// ---------------------------------------------------------------------------
// Mounting

const uploads: Promise<unknown>[] = [];
const defaultUpload = async () => ({
  url: "https://cdn.example.org/x.png",
  path: "org/x.png",
});
let uploadImpl: (file: File) => Promise<unknown> = defaultUpload;

/** Replaces the kit's upload for the test that calls it. */
export const setUpload = (impl: (file: File) => Promise<unknown>) => {
  uploadImpl = impl;
};

/** The image upload source every field the kit mounts gets. */
export const kitSource = {
  uploadImage: (file: File) => {
    const result = uploadImpl(file);
    uploads.push(result);
    return result;
  },
} as unknown as NonNullable<RichTextFieldProps["source"]>;

/**
 * Mounts `html` (as stored) in the harness's field, through the kit, in
 * place of any field the test mounted before.
 */
export const mount = (
  html: string,
  props: Partial<RichTextFieldProps> = {}
) => {
  unmountField();
  for (const field of [...extraFields]) {
    field.unmount();
  }
  return renderField(sanitizeRichTextHtml(html), {
    source: kitSource,
    namespace: KIT_NAMESPACE,
    ...props,
  });
};

type LexicalElement = HTMLElement & { __lexicalEditor?: LexicalEditor };

export type ExtraField = {
  onChange: ReturnType<typeof vi.fn>;
  editor: LexicalEditor;
  element: HTMLElement;
  unmount: () => void;
};
export type In = { in?: HTMLElement };

const extraFields = new Set<ExtraField>();

/** A second field, beside the harness's own, in its own container and root. */
export const mountExtraField = async (html: string): Promise<ExtraField> => {
  const onChange = vi.fn();
  const container = document.createElement("div");
  container.style.width = "480px";
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      createElement(
        TooltipProvider,
        null,
        createElement(RichTextField, {
          id: `cms-field-extra-${extraFields.size}`,
          labelId: `cms-field-extra-${extraFields.size}-label`,
          value: { html: sanitizeRichTextHtml(html) },
          onChange,
          onOpenClassic: vi.fn(),
          source: kitSource,
          namespace: KIT_NAMESPACE,
        })
      )
    );
  });
  await settle();
  const element = container.querySelector<HTMLElement>(
    '[contenteditable="true"]'
  )!;
  const field: ExtraField = {
    onChange,
    editor: (element as LexicalElement).__lexicalEditor!,
    element,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
      extraFields.delete(field);
    },
  };
  extraFields.add(field);
  return field;
};

const editableOf = (where?: In) => where?.in ?? editable()!;
const editorIn = (where?: In) =>
  where?.in === undefined
    ? editorOf()!
    : (where.in as LexicalElement).__lexicalEditor!;

/** The editable element that holds the focus, or the harness's. */
const activeEditable = () =>
  (document.activeElement?.closest?.(
    '[contenteditable="true"]'
  ) as HTMLElement | null) ?? editable()!;
const activeEditor = () =>
  (activeEditable() as LexicalElement).__lexicalEditor ?? editorOf()!;

// ---------------------------------------------------------------------------
// Places

const spanOf = (root: HTMLElement, word: string, nth = 0) => {
  const span = [
    ...root.querySelectorAll<HTMLElement>("[data-lexical-text]"),
  ].filter((element) => element.textContent === word)[nth];
  expect(span, word).toBeDefined();
  return span;
};

/** A real click in the `nth` text `word` at `offset` (its end when left out). */
export const at =
  (word: string, offset?: number, nth = 0, where?: In): Step =>
  async () => {
    const span = spanOf(editableOf(where), word, nth);
    await fontsLoaded(span);
    const range = document.createRange();
    const point = offset ?? word.length;
    range.setStart(span.firstChild!, point);
    range.setEnd(span.firstChild!, point);
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

const $texts = (word: string) =>
  $getRoot()
    .getAllTextNodes()
    .filter((text) => text.getTextContent() === word);

/** Sets the selection directly, after a real click on the field. */
const setSelection = async (
  editor: LexicalEditor,
  element: HTMLElement,
  $select: () => void
) => {
  await click(element);
  await act(async () => {
    editor.update($select);
  });
  await settle();
};

/** A range from `from` at `fromOffset` to `to` at `toOffset`, set directly. */
export const range =
  (
    from: string,
    fromOffset: number,
    to: string,
    toOffset: number,
    nth: { from?: number; to?: number } = {}
  ): Step =>
  () =>
    setSelection(editorOf()!, editable()!, () => {
      const start = $texts(from)[nth.from ?? 0];
      const end = $texts(to)[nth.to ?? 0];
      expect(start, from).toBeDefined();
      expect(end, to).toBeDefined();
      const selection = $createRangeSelection();
      selection.anchor.set(start.getKey(), fromOffset, "text");
      selection.focus.set(end.getKey(), toOffset, "text");
      $setSelection(selection);
    });

const isLine = (node: LexicalNode) => node.getType() === "cms-line";

/**
 * A range from `word` at `offset` to the point directly before the first
 * line break after `word`: on the break's container at its index, or at the
 * start of the line the break leads.
 */
export const rangeToLineStart =
  (word: string, offset: number): Step =>
  () =>
    setSelection(editorOf()!, editable()!, () => {
      const text = $texts(word)[0];
      expect(text, word).toBeDefined();
      const order: LexicalNode[] = [];
      const walk = (node: LexicalNode) => {
        order.push(node);
        if ($isElementNode(node)) {
          node.getChildren().forEach(walk);
        }
      };
      walk($getRoot());
      const brk = order
        .slice(order.indexOf(text) + 1)
        .find((node) => node.getType() === "linebreak");
      expect(brk, "a line break after the word").toBeDefined();
      const parent = brk!.getParentOrThrow();
      const index = brk!.getIndexWithinParent();
      const selection = $createRangeSelection();
      selection.anchor.set(text.getKey(), offset, "text");
      if (isLine(parent) && index === 0) {
        selection.focus.set(parent.getKey(), 0, "element");
      } else {
        selection.focus.set(parent.getKey(), index, "element");
      }
      $setSelection(selection);
    });

/** The children of `container` as the head has them: a line's one by one. */
const headUnits = (container: ElementNode) => {
  const units: Array<{ top: number; line: ElementNode | null; index: number }> =
    [];
  container.getChildren().forEach((child, top) => {
    if (isLine(child) && $isElementNode(child)) {
      child.getChildren().forEach((_inner, index) => {
        units.push({ top, line: child, index });
      });
    } else {
      units.push({ top, line: null, index: top });
    }
  });
  return units;
};

/**
 * The point at baseline offset `offset` on `container`: the offset counted
 * with every inline node as its own child, as the container's children are
 * at the head (spec section 10, "How a point is named").
 */
export const $baselinePoint = (
  container: ElementNode,
  offset: number
): { key: NodeKey; offset: number } => {
  const children = container.getChildren();
  if (children.some(isLine) === false) {
    return { key: container.getKey(), offset };
  }
  const units = headUnits(container);
  const before = units[offset - 1];
  const after = units[offset];
  if (
    before !== undefined &&
    after !== undefined &&
    before.line !== null &&
    before.line === after.line
  ) {
    return { key: after.line.getKey(), offset: after.index };
  }
  const from = before === undefined ? -1 : before.top;
  const to = after === undefined ? children.length : after.top;
  const empty = children
    .slice(from + 1, to)
    .find((child) => isLine(child) && $isElementNode(child) && child.isEmpty());
  if (empty !== undefined) {
    return { key: empty.getKey(), offset: 0 };
  }
  return { key: container.getKey(), offset: to };
};

/** The container's child count at the head: a line's children one by one. */
export const baselineChildCount = (container: ElementNode) =>
  headUnits(container).length;

export type Where = number | { before: number } | { after: number } | "end";

/** The point a `Where` names on `container` (T8). */
export const $wherePoint = (
  container: ElementNode,
  where: Where
): { key: NodeKey; offset: number } => {
  if (typeof where === "number") {
    return $baselinePoint(container, where);
  }
  if (where === "end") {
    return { key: container.getKey(), offset: container.getChildrenSize() };
  }
  const blocks = container
    .getChildren()
    .filter(
      (child) =>
        isLine(child) === false &&
        ($isElementNode(child) || $isDecoratorNode(child)) &&
        child.isInline() === false
    );
  const n = "before" in where ? where.before : where.after;
  const block = blocks[n];
  expect(block, `block child ${n}`).toBeDefined();
  return {
    key: container.getKey(),
    offset: block.getIndexWithinParent() + ("after" in where ? 1 : 0),
  };
};

const $setPoint = (point: { key: NodeKey; offset: number }) => {
  const selection = $createRangeSelection();
  selection.anchor.set(point.key, point.offset, "element");
  selection.focus.set(point.key, point.offset, "element");
  $setSelection(selection);
};

const $items = () => {
  const items: ElementNode[] = [];
  const walk = (node: LexicalNode) => {
    if (node.getType() === "listitem" && $isElementNode(node)) {
      items.push(node);
    }
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  walk($getRoot());
  return items;
};

/** An element point on the `item`-th list item (0-based, document order). */
export const itemPoint =
  (item: number, where: Where, field?: In): Step =>
  () =>
    setSelection(editorIn(field), editableOf(field), () => {
      const target = $items()[item];
      expect(target, `item ${item}`).toBeDefined();
      $setPoint($wherePoint(target, where === "end" ? "end" : where));
    });

/** The item's end, after its last child: its baseline child count. */
export const itemEnd =
  (item: number, field?: In): Step =>
  () =>
    setSelection(editorIn(field), editableOf(field), () => {
      const target = $items()[item];
      expect(target, `item ${item}`).toBeDefined();
      $setPoint($baselinePoint(target, baselineChildCount(target)));
    });

/** An element point on the list item or quote that holds `word`. */
export const containerPoint =
  (word: string, where: Where, field?: In): Step =>
  () =>
    setSelection(editorIn(field), editableOf(field), () => {
      const text = $texts(word)[0];
      expect(text, word).toBeDefined();
      let container: LexicalNode | null = text;
      while (
        container !== null &&
        container.getType() !== "listitem" &&
        container.getType() !== "quote"
      ) {
        container = container.getParent();
      }
      expect(container, `the container of ${word}`).not.toBeNull();
      $setPoint($wherePoint(container as ElementNode, where));
    });

const isNodeSelected = (editor: LexicalEditor) =>
  editor.getEditorState().read(() => $isNodeSelection($getSelection()));

/** A click at the end of `word`, then ArrowRight until a node is selected. */
export const nodeAfter =
  (word: string): Step =>
  async () => {
    await at(word)();
    for (let press = 0; press < 3; press += 1) {
      await userEvent.keyboard("{ArrowRight}");
      await settle();
      if (isNodeSelected(editorOf()!)) {
        return;
      }
    }
  };

/** The first image, by a real click on it, then Escape. */
export const imageNode =
  (where?: In): Step =>
  async () => {
    const image = editableOf(where).querySelector<HTMLElement>("img");
    expect(image, "an image").not.toBeNull();
    await userEvent.click(image!);
    await settle();
    await userEvent.keyboard("{Escape}");
    await settle();
  };

/** A node selection of the first node of `type`, set directly. */
export const nodeSelect =
  (type: "horizontalrule" | "cms-image"): Step =>
  () =>
    setSelection(editorOf()!, editable()!, () => {
      const find = (node: LexicalNode): LexicalNode | undefined => {
        if (node.getType() === type) {
          return node;
        }
        if ($isElementNode(node)) {
          for (const child of node.getChildren()) {
            const found = find(child);
            if (found !== undefined) {
              return found;
            }
          }
        }
        return undefined;
      };
      const target = find($getRoot());
      expect(target, type).toBeDefined();
      const selection = $createNodeSelection();
      selection.add(target!.getKey());
      $setSelection(selection);
    });

/**
 * A collapsed element point directly before or after a node, set directly:
 * the first (or last) node of `type` in document order, or with `text`
 * the first whose text is `text`.
 */
export const beside =
  (
    type: string,
    side: "before" | "after",
    which: { last?: boolean; text?: string } = {}
  ): Step =>
  () =>
    setSelection(editorOf()!, editable()!, () => {
      const found: LexicalNode[] = [];
      const walk = (node: LexicalNode) => {
        if (
          node.getType() === type &&
          (which.text === undefined || node.getTextContent() === which.text)
        ) {
          found.push(node);
        }
        if ($isElementNode(node)) {
          node.getChildren().forEach(walk);
        }
      };
      walk($getRoot());
      const target = which.last ? found[found.length - 1] : found[0];
      expect(target, type).toBeDefined();
      const parent = target.getParentOrThrow();
      $setPoint({
        key: parent.getKey(),
        offset: target.getIndexWithinParent() + (side === "after" ? 1 : 0),
      });
    });

/** A real triple click on the text `word`. */
export const tripleClick =
  (word: string): Step =>
  async () => {
    await at(word, 1)();
    await userEvent.tripleClick(spanOf(editable()!, word));
    await settle();
  };

/** A real double click on the text `word`. */
export const doubleClick =
  (word: string): Step =>
  async () => {
    await at(word, 1)();
    await userEvent.dblClick(spanOf(editable()!, word));
    await settle();
  };

/** A real click in the bottom right corner of the `item`-th `li`. */
export const clickItemCorner =
  (item: number): Step =>
  async () => {
    const li = editable()!.querySelectorAll("li")[item] as HTMLElement;
    const box = li.getBoundingClientRect();
    await userEvent.click(li, {
      position: { x: box.width - 2, y: box.height - 2 },
    } as never);
    await settle();
  };

// ---------------------------------------------------------------------------
// Actions

let unsettled = false;
let lastKeydown: number | undefined;
window.addEventListener(
  "keydown",
  () => {
    lastKeydown = performance.now();
  },
  { capture: true }
);

export const keys =
  (k: string): Step =>
  async () => {
    await userEvent.keyboard(k);
    if (unsettled === false) {
      await settle();
    }
  };
export const letter = keys("k");
export const enter = keys("{Enter}");
export const shiftEnter = keys("{Shift>}{Enter}{/Shift}");
export const backspace = keys("{Backspace}");
export const del = keys("{Delete}");
export const wordBack = keys("{Control>}{Backspace}{/Control}");
export const wordForward = keys("{Control>}{Delete}{/Control}");

const beforeInput = async (init: InputEventInit) => {
  await act(async () => {
    activeEditable().dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        ...init,
      })
    );
  });
  await settle();
};

/** Chromium on Linux sends no line delete by key: Lexical's DELETE_LINE. */
export const lineBack: Step = () =>
  beforeInput({ inputType: "deleteSoftLineBackward" });
export const lineForward: Step = () =>
  beforeInput({ inputType: "deleteSoftLineForward" });

/** A real composition through the browser's input-method interface. */
export const ime =
  (text: string): Step =>
  async () => {
    await session().send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
    await settle();
    await session().send("Input.insertText", { text });
    await settle();
  };

/** A composition of `a` that ends with nothing (round 10). */
export const imeCancel =
  (how: "empty" | "commit" | "escape"): Step =>
  async () => {
    await session().send("Input.imeSetComposition", {
      text: "a",
      selectionStart: 1,
      selectionEnd: 1,
    });
    await settle();
    if (how === "empty") {
      await session().send("Input.imeSetComposition", {
        text: "",
        selectionStart: 0,
        selectionEnd: 0,
      });
    } else if (how === "commit") {
      await session().send("Input.imeSetComposition", {
        text: "",
        selectionStart: 0,
        selectionEnd: 0,
      });
      await session().send("Input.insertText", { text: "" });
    } else {
      await userEvent.keyboard("{Escape}");
    }
    await settle();
  };

const textOf = (html: string) => html.replace(/<[^>]+>/g, "");

const pasteData = async (clipboardData: DataTransfer) => {
  await act(async () => {
    activeEditable().dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      })
    );
  });
  await settle();
};
const transfer = (data: Record<string, string>) => {
  const clipboardData = new DataTransfer();
  for (const [format, text] of Object.entries(data)) {
    clipboardData.setData(format, text);
  }
  return clipboardData;
};

export const pasteHtml =
  (html: string, text = "Aq"): Step =>
  () =>
    pasteData(transfer({ "text/html": html, "text/plain": text }));
export const pasteText =
  (text: string): Step =>
  () =>
    pasteData(transfer({ "text/plain": text }));

/**
 * A real own-node paste: `html` copied whole from a headless editor in the
 * kit's namespace, pasted with all three formats.
 */
export const pasteOwn =
  (html: string): Step =>
  async () => {
    const editor = createEditor({
      namespace: KIT_NAMESPACE,
      nodes: [...richTextNodes],
      html: richTextHtmlConfig,
      onError: (error) => {
        throw error;
      },
    });
    registerRichTextTransforms(editor);
    editor.update(
      () => importRichTextHtml(editor, sanitizeRichTextHtml(html)),
      {
        discrete: true,
      }
    );
    let data: Record<string, string> = {};
    editor.update(
      () => {
        const root = $getRoot();
        root.select(0, root.getChildrenSize());
        data = { ...$getClipboardDataFromSelection() } as Record<
          string,
          string
        >;
      },
      { discrete: true }
    );
    await pasteData(transfer(data));
  };

export const pasteFiles: Step = async () => {
  const clipboardData = new DataTransfer();
  clipboardData.items.add(new File(["x"], "a.txt", { type: "text/plain" }));
  await pasteData(clipboardData);
};

/** A drop of `html` with its text, as beforeinput insertFromDrop. */
export const drop =
  (html: string): Step =>
  () =>
    beforeInput({
      inputType: "insertFromDrop",
      dataTransfer: transfer({ "text/html": html, "text/plain": textOf(html) }),
    });

let clip: Record<string, string> | undefined;
const readTransfer = (data: DataTransfer | null) => {
  const out: Record<string, string> = {};
  for (const format of data?.types ?? []) {
    out[format] = data!.getData(format);
  }
  return out;
};
const clipboardEvent = async (type: "copy" | "cut") => {
  const clipboardData = new DataTransfer();
  await act(async () => {
    activeEditable().dispatchEvent(
      new ClipboardEvent(type, {
        bubbles: true,
        cancelable: true,
        clipboardData,
      })
    );
  });
  clip = readTransfer(clipboardData);
  await settle();
};
export const copy: Step = () => clipboardEvent("copy");
export const cut: Step = () => clipboardEvent("cut");

/** A real Ctrl+X; the clipboard is read as the event leaves the page. */
export const cutByKey: Step = async () => {
  const read = (event: Event) => {
    clip = readTransfer((event as ClipboardEvent).clipboardData);
  };
  window.addEventListener("cut", read);
  try {
    await userEvent.keyboard("{Control>}x{/Control}");
    await settle();
  } finally {
    window.removeEventListener("cut", read);
  }
};

/** What the last copy or cut put on the clipboard. */
export const clipboard = () => ({ ...(clip ?? {}) });

const BLOCK_TAGS = new Set(
  "P H1 H2 H3 H4 H5 H6 PRE BLOCKQUOTE UL OL LI HR DIV".split(" ")
);

/**
 * The lines of a text/html (T65): the html parsed, each element that is a
 * block and holds no block (p, a heading, pre, blockquote, a list, li, hr)
 * is one line of its text, and so is each run of inline content standing
 * beside a block or alone, in document order; inside a line, a `<br>` ends
 * the line. The result is those lines, joined by new lines and split again.
 */
export const htmlLines = (html: string) => {
  const body = parseHtml(html).body;
  const isBlock = (node: Node) =>
    node instanceof Element && BLOCK_TAGS.has(node.tagName);
  const inline = (node: Node): string =>
    node.nodeType === Node.TEXT_NODE
      ? (node.textContent ?? "")
      : node instanceof Element && node.tagName === "BR"
        ? "\n"
        : [...node.childNodes].map(inline).join("");
  const lines = (parent: Node): string[] => {
    const children = [...parent.childNodes];
    if (children.some(isBlock) === false) {
      return [inline(parent)];
    }
    const out: string[] = [];
    let run: Node[] = [];
    const flush = () => {
      if (run.length > 0) {
        out.push(run.map(inline).join(""));
        run = [];
      }
    };
    for (const child of children) {
      if (isBlock(child)) {
        flush();
        out.push(...lines(child));
      } else {
        run.push(child);
      }
    }
    flush();
    return out;
  };
  return lines(body).join("\n").split("\n");
};

/**
 * T65 as T71.4 restates it: the lines of text/plain that hold text are, in
 * order, the texts of text/html's blocks and lines (`htmlLines`), and
 * neither flavour holds text the other lacks; the number of new lines is
 * pinned by each test's own literal, not here.
 */
export const expectSameLines = (data: Record<string, string>) =>
  expect(
    (data["text/plain"] ?? "").split("\n").filter((line) => line !== ""),
    `T65: text/plain holds the texts of text/html ${data["text/html"]}`
  ).toEqual(htmlLines(data["text/html"] ?? "").filter((line) => line !== ""));

export const pasteClip: Step = () => pasteData(transfer(clipboard()));

/**
 * Chooses `name` in the Block type select, then hands the keys back to the
 * field the select belongs to. The toolbar's change handler focuses the
 * editor, but the select's close focuses its trigger after it, so a key
 * pressed next would reach the select. A person goes on in the editor with
 * the selection the command left: the driver makes the toolbar's own call,
 * `editor.focus()`, once the close has settled, and moves no point.
 */
export const blockType =
  (name: string): Step =>
  async () => {
    const trigger = byLabel("Block type");
    await click(trigger);
    await click(
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (option) => option.textContent === name
      )
    );
    let field = trigger?.parentElement ?? null;
    while (
      field !== null &&
      field.querySelector('[contenteditable="true"]') === null
    ) {
      field = field.parentElement;
    }
    const element = field?.querySelector<LexicalElement>(
      '[contenteditable="true"]'
    );
    if (element === null || element === undefined) {
      return;
    }
    if (document.activeElement !== element) {
      await act(async () => {
        element.__lexicalEditor?.focus();
      });
      await settle();
    }
  };
/**
 * Chooses `name` in the Block type select and nothing else: the keys go
 * wherever the select's close leaves the focus (T10, T18.8).
 */
export const chooseBlockType =
  (name: string): Step =>
  async () => {
    await click(byLabel("Block type"));
    await click(
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (option) => option.textContent === name
      )
    );
    await settle();
  };
export const button =
  (label: string): Step =>
  () =>
    click(byLabel(label));

/** Clicks Link, fills the address and confirms. */
export const link =
  (url = "https://example.org/"): Step =>
  async () => {
    await click(byLabel("Link"));
    const input = byLabel("URL") as HTMLInputElement | null;
    if (input === null) {
      return;
    }
    await userEvent.fill(input, url);
    await userEvent.keyboard("{Enter}");
    await settle();
  };

/**
 * Image with a file chosen: waits for the upload the kit's source started,
 * then for the field's next committed update after it resolved, bounded at
 * 2,000 ms. An insert that writes nothing returns without failing.
 */
export const imageButton: Step = async () => {
  const editor = editorOf()!;
  let resolved = false;
  let committed = false;
  const unregister = editor.registerUpdateListener(() => {
    if (resolved) {
      committed = true;
    }
  });
  const started = uploads.length;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 3;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((result) => resolve(result!), "image/png")
    );
    const file = new File([blob], "a.png", { type: "image/png" });
    const input =
      fieldContainer()!.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      byLabel("Image")!.click();
    });
    const files = new DataTransfer();
    files.items.add(file);
    const deadline = performance.now() + 2000;
    await act(async () => {
      input.files = files.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    while (uploads.length === started && performance.now() < deadline) {
      await wait(5);
    }
    const upload = uploads[started];
    if (upload !== undefined) {
      // the field's insert runs several steps after the upload resolves,
      // so this flag is set before its commit
      void upload.then(
        () => {
          resolved = true;
        },
        () => {
          resolved = true;
        }
      );
      await Promise.race([
        upload.catch(() => undefined),
        wait(Math.max(0, deadline - performance.now())),
      ]);
    }
    while (committed === false && performance.now() < deadline) {
      await act(async () => {
        await wait(5);
      });
    }
  } finally {
    unregister();
  }
  await settle();
};

/** Safari's text replacement: insertText with no data and a dataTransfer. */
export const replaceText =
  (text: string): Step =>
  () =>
    beforeInput({
      inputType: "insertText",
      data: null,
      dataTransfer: transfer({ "text/plain": text }),
    });
export const lineBreakInput: Step = () =>
  beforeInput({ inputType: "insertLineBreak" });
/** beforeinput insertText with data "\n" (K15, K16). */
export const newlineInput: Step = () =>
  beforeInput({ inputType: "insertText", data: "\n" });

type Swapped = {
  onChange: ReturnType<typeof vi.fn>;
  editor: LexicalEditor;
  before: SerializedEditorState;
  caretBefore: string;
  htmlBefore: string;
  valueBefore: string;
};
let swapped: Swapped | undefined;

/**
 * Pastes the clipboard into a second field holding `html`, at `word` and
 * `offset`, with the first field still mounted; recordEdit reads the second
 * field's onChange and editor.
 */
export const secondField =
  (html: string, word: string, offset?: number): Step =>
  async () => {
    const extra = await mountExtraField(html);
    await at(word, offset, 0, { in: extra.element })();
    swapped = {
      onChange: extra.onChange,
      editor: extra.editor,
      before: extra.editor.getEditorState().toJSON(),
      caretBefore: caretKey(extra.editor),
      htmlBefore: short(exportRichTextHtml(extra.editor)),
      valueBefore: exportRichTextHtml(extra.editor),
    };
    extra.onChange.mockClear();
    await pasteClip();
  };

/** A real Ctrl+A. */
export const selectAll = keys("{Control>}a{/Control}");

/**
 * One update that types `text` and pastes `html` at the selection (section
 * 10: a paste into an item edited in the same update).
 */
export const sameUpdate =
  (text: string, html: string): Step =>
  async () => {
    const editor = activeEditor();
    await act(async () => {
      editor.update(() => {
        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        (selection as RangeSelection).insertText(text);
        $insertDataTransferForRichText(
          transfer({ "text/html": html, "text/plain": textOf(html) }),
          $getSelection()!,
          editor
        );
      });
    });
    await settle();
  };

const mouse = (
  type: "mousePressed" | "mouseReleased",
  x: number,
  y: number,
  clickCount = 1,
  modifiers = 0
) =>
  session().send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons: type === "mousePressed" ? 1 : 0,
    clickCount,
    modifiers,
  });
const centre = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

/** A real click at page coordinates. */
export const clickAt =
  (x: number, y: number): Step =>
  async () => {
    await mouse("mousePressed", x, y);
    await mouse("mouseReleased", x, y);
    await settle();
  };

export const then =
  (...steps: Step[]): Step =>
  async () => {
    for (const step of steps) {
      await step();
    }
  };

// rounds 13 to 15

/** Real keys back to back with no settle between them (15.12). */
export const noWait =
  (...steps: Step[]): Step =>
  async () => {
    unsettled = true;
    try {
      for (const step of steps) {
        await step();
      }
    } finally {
      unsettled = false;
    }
    await settle();
  };

/** The same keys with settle() and 150 ms after each. */
export const waited =
  (...steps: Step[]): Step =>
  async () => {
    for (const step of steps) {
      await step();
      await settle();
      await wait(150);
    }
  };

/** A real press held `ms`, then released at the same place. */
export const hold =
  (target: Element, ms: number, point?: { x: number; y: number }): Step =>
  async () => {
    const { x, y } = point ?? centre(target);
    await mouse("mousePressed", x, y);
    if (ms > 0) {
      await wait(ms);
    }
    await mouse("mouseReleased", x, y);
    await settle();
  };

/** A real double or triple click, its presses `gapMs` apart. */
export const realClicks =
  (target: Element, count: 2 | 3, gapMs: number): Step =>
  async () => {
    const { x, y } = centre(target);
    for (let n = 1; n <= count; n += 1) {
      await mouse("mousePressed", x, y, n);
      await mouse("mouseReleased", x, y, n);
      if (n < count) {
        await wait(gapMs);
      }
    }
    await settle();
  };

/** A real press with Shift held through it. */
export const shiftPress =
  (target: Element, point?: { x: number; y: number }): Step =>
  async () => {
    const { x, y } = point ?? centre(target);
    await userEvent.keyboard("{Shift>}");
    await mouse("mousePressed", x, y, 1, 8);
    await mouse("mouseReleased", x, y, 1, 8);
    await userEvent.keyboard("{/Shift}");
    await settle();
  };

const forceCleanups = new Set<() => void>();

/**
 * Runs `step` with the page's selectionchange delivered before the step's
 * event named by `on` ("selectionchange-first"), or held until that event has
 * been handled and delivered after it ("key-first").
 */
export const forceOrder =
  (
    order: "selectionchange-first" | "key-first",
    step: Step,
    on: "keydown" | "pointerdown" | "pointerup" = "keydown"
  ): Step =>
  async () => {
    let done = false;
    const deliver = () => {
      document.dispatchEvent(new Event("selectionchange"));
    };
    const onEvent = () => {
      if (done) {
        return;
      }
      done = true;
      if (order === "selectionchange-first") {
        deliver();
      } else {
        setTimeout(deliver, 0);
      }
    };
    const hold = (event: Event) => {
      if (done === false) {
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener(on, onEvent, { capture: true });
    if (order === "key-first") {
      window.addEventListener("selectionchange", hold, { capture: true });
    }
    const cleanup = () => {
      window.removeEventListener(on, onEvent, { capture: true });
      window.removeEventListener("selectionchange", hold, { capture: true });
      forceCleanups.delete(cleanup);
    };
    forceCleanups.add(cleanup);
    try {
      await step();
      await settle();
    } finally {
      cleanup();
    }
  };

/** Waits until more than 30 ms have passed since the last keydown. */
export const quiet = async () => {
  for (;;) {
    const gap =
      lastKeydown === undefined
        ? Number.POSITIVE_INFINITY
        : performance.now() - lastKeydown;
    if (gap > 30) {
      return gap;
    }
    await wait(31 - gap);
  }
};

// ---------------------------------------------------------------------------
// Oracles

export type Held = {
  text: string;
  images: number;
  rules: number;
  breaks: number;
  order: "forward" | "backward";
};

/**
 * What a range holds, read from the structure in document order (T10.2,
 * T10.9); the order of its ends is their document position.
 */
export const $rangeOracle = (selection: RangeSelection): Held => {
  const leaves: LexicalNode[] = [];
  const firstLeaf = new Map<NodeKey, number>();
  const afterLeaf = new Map<NodeKey, number>();
  const walk = (node: LexicalNode) => {
    firstLeaf.set(node.getKey(), leaves.length);
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    } else {
      leaves.push(node);
    }
    afterLeaf.set(node.getKey(), leaves.length);
  };
  walk($getRoot());
  const position = (point: PointType): [number, number] => {
    const node = point.getNode();
    if (point.type === "text") {
      return [firstLeaf.get(node.getKey())!, point.offset];
    }
    if ($isElementNode(node)) {
      const child = node.getChildAtIndex(point.offset);
      return [
        child === null
          ? afterLeaf.get(node.getKey())!
          : firstLeaf.get(child.getKey())!,
        0,
      ];
    }
    return [firstLeaf.get(node.getKey())!, point.offset];
  };
  const anchor = position(selection.anchor);
  const focus = position(selection.focus);
  const isBackward =
    focus[0] < anchor[0] || (focus[0] === anchor[0] && focus[1] < anchor[1]);
  const [start, end] = isBackward ? [focus, anchor] : [anchor, focus];
  const held: Held = {
    text: "",
    images: 0,
    rules: 0,
    breaks: 0,
    order: isBackward ? "backward" : "forward",
  };
  for (
    let index = start[0];
    index <= end[0] && index < leaves.length;
    index += 1
  ) {
    const leaf = leaves[index];
    if ($isTextNode(leaf)) {
      const text = leaf.getTextContent();
      held.text += text.slice(
        index === start[0] ? start[1] : 0,
        index === end[0] ? end[1] : text.length
      );
      continue;
    }
    if (index === end[0] || (index === start[0] && start[1] > 0)) {
      continue;
    }
    const type = leaf.getType();
    if (type === "cms-image") {
      held.images += 1;
    } else if (type === "horizontalrule") {
      held.rules += 1;
    } else if (type === "linebreak") {
      held.breaks += 1;
    }
  }
  return held;
};

const EDGES = {
  img: /<img\b[^>]*>/g,
  br: /<br\b[^>]*>/g,
  "a-outside": /<a\b[^>]*>[\s\S]*?<\/a>/g,
  "a-inside": /<a\b[^>]*>[\s\S]*?<\/a>/g,
};

/**
 * The shape with the word `Ew` in place of its edge child: an image, a line
 * break, or a link (T10.3). `occurrence` is the child's 0-based index among
 * the matches of that kind in document order; it is required when the shape
 * holds more than one.
 */
export const twinOf = (
  stored: string,
  edge: "img" | "br" | "a-outside" | "a-inside",
  occurrence?: number
) => {
  const matches = [...stored.matchAll(EDGES[edge])];
  if (occurrence === undefined && matches.length > 1) {
    throw new Error(
      `twinOf: ${matches.length} matches of ${edge} in ${stored}; name the occurrence`
    );
  }
  const match = matches[occurrence ?? 0];
  if (match === undefined) {
    throw new Error(`twinOf: no ${edge} at ${occurrence ?? 0} in ${stored}`);
  }
  return (
    stored.slice(0, match.index) +
    "Ew" +
    stored.slice(match.index! + match[0].length)
  );
};

// ---------------------------------------------------------------------------
// Grid commands

export type GridLabel =
  | "Enter"
  | "Shift+Enter"
  | "letter"
  | "ime"
  | "Bold"
  | "Italic"
  | "Underline"
  | "Strikethrough"
  | "Heading 2"
  | "Quote"
  | "Code"
  | "Paragraph"
  | "Image"
  | "Divider"
  | "Link"
  | "Bulleted list"
  | "Numbered list"
  | "Backspace"
  | "Delete"
  | "Ctrl+Backspace"
  | "Ctrl+Delete"
  | "lineBack"
  | "lineForward"
  | "cut"
  | "paste HTML"
  | "paste text"
  | "paste own"
  | "drop"
  | "Tab"
  | "Shift+Tab";

export const GRID_COMMANDS: ReadonlyArray<readonly [GridLabel, Step]> = [
  ["Enter", enter],
  ["Shift+Enter", shiftEnter],
  ["letter", letter],
  ["ime", ime("a")],
  ["Bold", button("Bold")],
  ["Italic", button("Italic")],
  ["Underline", button("Underline")],
  ["Strikethrough", button("Strikethrough")],
  ["Heading 2", blockType("Heading 2")],
  ["Quote", blockType("Quote")],
  ["Code", blockType("Code")],
  ["Paragraph", blockType("Paragraph")],
  ["Image", imageButton],
  ["Divider", button("Divider")],
  ["Link", link()],
  ["Bulleted list", button("Bulleted list")],
  ["Numbered list", button("Numbered list")],
  ["Backspace", backspace],
  ["Delete", del],
  ["Ctrl+Backspace", wordBack],
  ["Ctrl+Delete", wordForward],
  ["lineBack", lineBack],
  ["lineForward", lineForward],
  ["cut", cut],
  ["paste HTML", pasteHtml("<p>Aq</p><p>Bq</p>")],
  ["paste text", pasteText("Aq")],
  ["paste own", pasteOwn("<p>Aq</p><p>Bq</p>")],
  ["drop", drop("<p>Dq</p>")],
  ["Tab", keys("{Tab}")],
  ["Shift+Tab", keys("{Shift>}{Tab}{/Shift}")],
];

// ---------------------------------------------------------------------------
// Checks

const describePoint = (point: PointType) => {
  const node = point.getNode();
  if (point.type === "text") {
    return `text:${node.getTextContent()}@${point.offset}`;
  }
  if (isLine(node)) {
    const parent = node.getParentOrThrow();
    let index = point.offset;
    for (const sibling of parent.getChildren()) {
      if (sibling.is(node)) {
        break;
      }
      index +=
        isLine(sibling) && $isElementNode(sibling)
          ? sibling.getChildrenSize()
          : 1;
    }
    return `element:${parent.getType()}@${index}`;
  }
  return `element:${node.getType()}@${point.offset}`;
};

/**
 * The committed selection: `none`, `node:<types>`, or a range's anchor (and
 * focus when it is not collapsed). A point in a line is written as the
 * point its parent has at the head (D1).
 */
export const caretKey = (editor: LexicalEditor = editorOf()!) =>
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isNodeSelection(selection)) {
      return `node:${selection
        .getNodes()
        .map((node) => node.getType())
        .sort()
        .join(",")}`;
    }
    if ($isRangeSelection(selection) === false) {
      return "none";
    }
    const anchor = describePoint(selection.anchor);
    const focus = describePoint(selection.focus);
    return anchor === focus ? anchor : `${anchor}|${focus}`;
  });

export type EditCase = {
  stored: string;
  place?: Step;
  action: Step;
  calls?: number;
  caret?: string;
  typed?: string;
  fixedPoint?: boolean;
  source?: unknown;
} & (
  | { write: string | null; writeMatches?: undefined }
  | {
      write?: undefined;
      /**
       * A write ruled by its properties, not by a literal: in place of the
       * comparison with `write`, called with the value handed out (as the
       * field wrote it). Every other check runs unchanged; `calls` defaults
       * to 1.
       */
      writeMatches: (written: string) => void;
    }
);
export type EditRecord = {
  write: string | null;
  calls: number;
  caret: string;
  typed?: string;
  htmlBefore: string;
  /**
   * The value as it stood after `place` and the value the action handed
   * out last (the value before when it handed out none), as the field
   * wrote them: what D19 compares, links' addresses and images included.
   */
  valueBefore: string;
  written: string;
  /** Every value the action handed out, in order, as the field wrote them. */
  values: string[];
  caretBefore: string;
  undoRestores?: boolean;
  redoEquals?: boolean;
  errors: string[];
  slowest: number;
};
export type RecordOptions = {
  /** After undo and redo, type `k` and record `typed`. */
  typeAfter?: boolean;
  /** A grid cell: no undo, no redo, no fixed point; `k` typed right after the action. */
  short?: boolean;
};

/** The value the last recorded action handed out, as the field wrote it. */
let writtenHtml = "";

const timed = async (step: Step) => {
  const start = performance.now();
  await step();
  return performance.now() - start;
};

/** Mounts, places, acts, and records the write, undo and redo. */
export const recordEdit = async (
  edit: Pick<EditCase, "stored" | "place" | "action">,
  options: RecordOptions = {}
): Promise<EditRecord> => {
  let onChange = await mount(edit.stored);
  await edit.place?.();
  let editor = editorOf()!;
  let before = editor.getEditorState().toJSON();
  let caretBefore = caretKey(editor);
  let valueBefore = exportRichTextHtml(editor);
  let htmlBefore = short(valueBefore);
  const errors: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(" ");
    if (text.includes("not wrapped in act") === false) {
      errors.push(text.slice(0, 300));
    }
  });
  onChange.mockClear();
  swapped = undefined;
  const times = [await timed(edit.action)];
  if (swapped !== undefined) {
    ({ onChange, editor, before, caretBefore, htmlBefore, valueBefore } =
      swapped);
    swapped = undefined;
  }
  const calls = onChange.mock.calls.length;
  const write = calls > 0 ? short(lastHtml(onChange)) : null;
  const caret = caretKey(editor);
  // with nothing written, the value as it stood after `place`
  writtenHtml = calls > 0 ? lastHtml(onChange) : valueBefore;
  const record: EditRecord = {
    write,
    calls,
    caret,
    htmlBefore,
    valueBefore,
    written: writtenHtml,
    values: onChange.mock.calls
      .slice(0, calls)
      .map((call) => (call[0] as { html: string } | null)?.html ?? ""),
    caretBefore,
    errors,
    slowest: 0,
  };
  if (options.short) {
    times.push(await timed(letter));
    record.typed = short(lastHtml(onChange));
    record.slowest = Math.max(...times);
    return record;
  }
  const afterAction = editor.getEditorState().toJSON();
  times.push(await timed(keys("{Control>}z{/Control}")));
  // an edit: the state and caret before it; none: Ctrl+Z changes nothing
  // and fires no onChange
  record.undoRestores =
    sameState(before, editor.getEditorState().toJSON()) &&
    (write === null
      ? onChange.mock.calls.length === calls
      : caretKey(editor) === caretBefore);
  const callsBeforeRedo = onChange.mock.calls.length;
  times.push(await timed(keys("{Control>}y{/Control}")));
  record.redoEquals =
    sameState(afterAction, editor.getEditorState().toJSON()) &&
    (write === null
      ? onChange.mock.calls.length === callsBeforeRedo
      : short(lastHtml(onChange)) === write);
  if (options.typeAfter) {
    times.push(await timed(letter));
    record.typed = short(lastHtml(onChange));
  }
  record.slowest = Math.max(...times);
  return record;
};

/** Records the edit and asserts every check of an assertion test. */
export const expectEdit = async (edit: EditCase) => {
  const {
    write,
    writeMatches,
    calls,
    caret,
    typed,
    fixedPoint,
    source: _source,
    ...rest
  } = edit;
  const record = await recordEdit(rest, { typeAfter: typed !== undefined });
  if (writeMatches === undefined) {
    expect(record.calls, "calls").toBe(calls ?? (write === null ? 0 : 1));
    expect(record.write, "write").toBe(write);
  } else {
    expect(record.calls, "calls").toBe(calls ?? 1);
    writeMatches(writtenHtml);
  }
  if (record.calls > 0) {
    expect(record.write, "D19: a write that changes the value").not.toBe(
      record.htmlBefore
    );
  }
  if (caret !== undefined) {
    expect(record.caret, "caret").toBe(caret);
  }
  if (typed !== undefined) {
    expect(record.typed, "typed").toBe(typed);
  }
  expect(record.undoRestores, "undo restores the state before").toBe(true);
  expect(record.redoEquals, "redo equals the write").toBe(true);
  expect(record.errors, "console errors").toEqual([]);
  expect(record.slowest, "slowest step in ms").toBeLessThan(2000);
  if (fixedPoint !== false) {
    expectFixedPoint(writtenHtml);
  }
  return record;
};

afterEach(() => {
  for (const field of [...extraFields]) {
    field.unmount();
  }
  for (const cleanup of [...forceCleanups]) {
    cleanup();
  }
  uploadImpl = defaultUpload;
  uploads.length = 0;
  unsettled = false;
  swapped = undefined;
  clip = undefined;
});
