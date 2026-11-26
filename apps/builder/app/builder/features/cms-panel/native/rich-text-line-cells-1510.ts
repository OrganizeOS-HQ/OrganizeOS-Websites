// The cells of `base-1510` and `base-1510-mirror` (Task 5 Step 6; T10.2,
// T12.4, T12.8, T14.9, T15.3): check 5's generated sets of
// `check-5-probes/keys/cells2.ts`, whole. Five kinds of block before a
// root-level rule (a quote, a list, a list at depth two, a paragraph, a
// heading), ending in text, an image, a link or a line break (the last three
// in a quote or a list only), the rule followed by a paragraph, a quote
// (text ends only) or nothing: 27 shapes. To the right: the anchors `end`,
// `back` and `prev`, 0 to 3 presses of Shift+ArrowRight, eight actions
// (1,920 cells), and three named keys at the `end` anchor after 0 and 1
// presses (T15.3). The mirror: the 16 shapes with something after the rule,
// a real click at `Nw@0`, 0 to 3 presses of Shift+ArrowLeft, the same eight
// actions (512 cells). The runner imports only the kit, so it records at
// `<base>` too.
import { expect, vi } from "vitest";
import {
  $createRangeSelectionFromDom,
  $getEditor,
  $getSelection,
  $isRangeSelection,
} from "lexical";
import { userEvent } from "@vitest/browser/context";
import {
  at,
  caretKey,
  clipboard,
  copy,
  cut,
  imageButton,
  keys,
  mount,
  pasteHtml,
  pasteText,
  short,
  type Step,
} from "./rich-text-line-test-kit";
import {
  editable,
  editorOf,
  fontsLoaded,
  lastHtml,
  settle,
} from "./rich-text-test-harness";
import { exportRichTextHtml } from "./rich-text-html";
import {
  $documentTokens,
  $tokenPosition,
} from "./rich-text-line-cells-removal";

const IMG40 =
  '<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />';
const END: Record<string, string> = {
  text: "",
  img: IMG40,
  link: '<a href="https://example.org/l">Lw</a>',
  br: "<br>",
};
const BLOCK: Record<string, (end: string) => string> = {
  quote: (end) => `<blockquote><p>Pw${end}</p></blockquote>`,
  list: (end) => `<ul><li>Pw${end}</li></ul>`,
  list2: (end) => `<ul><li>Aw<ul><li>Pw${end}</li></ul></li></ul>`,
  para: (end) => `<p>Pw${end}</p>`,
  heading: (end) => `<h3>Pw${end}</h3>`,
};
const FOLLOW: Record<string, string> = {
  para: "<p>Nw</p>",
  quote: "<blockquote><p>Nw</p></blockquote>",
  none: "",
};

export type Shape = { id: string; html: string; block: string; end: string };

export const shapes1510 = (): Shape[] => {
  const out: Shape[] = [];
  for (const [block, html] of Object.entries(BLOCK)) {
    for (const [end, endHtml] of Object.entries(END)) {
      if (end !== "text" && block !== "quote" && block !== "list") {
        continue;
      }
      for (const [follow, followHtml] of Object.entries(FOLLOW)) {
        if (follow === "quote" && end !== "text") {
          continue;
        }
        out.push({
          id: `${block}|${end}|${follow}`,
          html: `${html(endHtml)}<hr>${followHtml}`,
          block,
          end,
        });
      }
    }
  }
  return out;
};

export const ACTIONS_1510 = [
  "k",
  "bs",
  "del",
  "enter",
  "plain",
  "htmlPaste",
  "cut",
  "copy",
] as const;
export const NAMED_1510 = ["shiftEnter", "wordB", "wordF"] as const;
/** The keys beside the fixture's set that the mirror's rule covers too. */
export const KEYS_MIRROR = ["shiftEnter", "image"] as const;
export type Action =
  | (typeof ACTIONS_1510)[number]
  | (typeof NAMED_1510)[number]
  | (typeof KEYS_MIRROR)[number];

export type Cell1510 = {
  id: string;
  shape: Shape;
  side: "R" | "L";
  anchor: "end" | "back" | "prev" | "start";
  presses: number;
  action: Action;
  html: string;
};

const nestedBlocks = new Set(["quote", "list", "list2"]);

/** The cells of `base-1510`: the generated set whole, then the named ones. */
export const cells1510 = (): Cell1510[] => {
  const cells: Cell1510[] = [];
  for (const shape of shapes1510()) {
    for (const anchor of ["end", "back", "prev"] as const) {
      if (
        anchor === "prev" &&
        (shape.end !== "text" ||
          (shape.block !== "quote" && shape.block !== "list"))
      ) {
        continue;
      }
      for (let presses = 0; presses <= 3; presses += 1) {
        for (const action of ACTIONS_1510) {
          cells.push({
            id: `R|${shape.id}|${anchor}|${presses}|${action}`,
            shape,
            side: "R",
            anchor,
            presses,
            action,
            html: anchor === "prev" ? `<p>Aw</p>${shape.html}` : shape.html,
          });
        }
      }
    }
  }
  for (const shape of shapes1510()) {
    for (const presses of [0, 1]) {
      for (const action of NAMED_1510) {
        cells.push({
          id: `R|${shape.id}|end|${presses}|${action}`,
          shape,
          side: "R",
          anchor: "end",
          presses,
          action,
          html: shape.html,
        });
      }
    }
  }
  return cells;
};

/** The cells of `base-1510-mirror`. */
export const cells1510Mirror = (): Cell1510[] => {
  const cells: Cell1510[] = [];
  for (const shape of shapes1510()) {
    if (shape.id.endsWith("|none")) {
      continue;
    }
    for (let presses = 0; presses <= 3; presses += 1) {
      for (const action of ACTIONS_1510) {
        cells.push({
          id: `L|${shape.id}|start|${presses}|${action}`,
          shape,
          side: "L",
          anchor: "start",
          presses,
          action,
          html: shape.html,
        });
      }
    }
  }
  return cells;
};

/**
 * Shift+Enter and Image over each range the mirror's walk leaves at the head
 * (the fixture's letter cell holds a range): not in `base-1510-mirror`, so
 * they are checked against the mirror's rule only.
 */
export const cells1510MirrorKeys = (fixture: Fixture1510): Cell1510[] =>
  cells1510Mirror()
    .filter(
      (cell) =>
        cell.action === "k" && fixture[cell.id].before.includes("|") === true
    )
    .flatMap((cell) =>
      KEYS_MIRROR.map((action) => ({
        ...cell,
        id: withAction(cell, action),
        action,
      }))
    );

/** The block of the shape is a nested one (a quote or a list). */
export const isNested = (cell: Cell1510) => nestedBlocks.has(cell.shape.block);

const spanOf = (word: string) =>
  [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find(
    (span) => span.textContent === word
  )!;

/** A real Shift+click at the end of `word`. */
const shiftClick =
  (word: string): Step =>
  async () => {
    const span = spanOf(word);
    expect(span, word).toBeDefined();
    await fontsLoaded(span);
    const range = document.createRange();
    range.setStart(span.firstChild!, word.length);
    range.setEnd(span.firstChild!, word.length);
    const rect = range.getBoundingClientRect();
    const box = span.getBoundingClientRect();
    await userEvent.keyboard("{Shift>}");
    await userEvent.click(span, {
      position: {
        x: Math.min(Math.max(rect.left - box.left, 1), box.width - 1),
        y: box.height / 2,
      },
    } as never);
    await userEvent.keyboard("{/Shift}");
    await settle();
  };

const presses = (cell: Cell1510) => {
  if (cell.presses === 0) {
    return "";
  }
  const arrow = cell.side === "R" ? "{ArrowRight}" : "{ArrowLeft}";
  return `{Shift>}${arrow.repeat(cell.presses)}{/Shift}`;
};

/** The real input that places the cell's selection. */
export const place1510 =
  (cell: Cell1510): Step =>
  async () => {
    const textEnd = cell.shape.end === "text";
    let typed = "";
    if (cell.side === "L") {
      await at("Nw", 0)();
    } else if (cell.anchor === "end") {
      await at("Pw")();
      typed = textEnd ? "" : "{End}";
    } else if (cell.anchor === "back") {
      await at("Pw", 1)();
      typed = "{Shift>}{End}{/Shift}";
    } else {
      await at("Aw", 1)();
      await shiftClick("Pw")();
      typed = textEnd ? "" : "{Shift>}{End}{/Shift}";
    }
    typed += presses(cell);
    if (typed !== "") {
      await keys(typed)();
    }
  };

const ACTION_STEPS: Record<Action, Step> = {
  k: keys("k"),
  bs: keys("{Backspace}"),
  del: keys("{Delete}"),
  enter: keys("{Enter}"),
  plain: pasteText("Zq"),
  htmlPaste: pasteHtml("<b>Hq</b>", "Hq"),
  cut,
  copy,
  shiftEnter: keys("{Shift>}{Enter}{/Shift}"),
  wordB: keys("{Control>}{Backspace}{/Control}"),
  wordF: keys("{Control>}{Delete}{/Control}"),
  image: imageButton,
};

export type Record1510 = {
  /** The selection the presses left, as `caretKey` reads it. */
  before: string;
  /** The value handed out last, short, or null with no onChange. */
  write: string | null;
  /** The value as it stands after the action, short (live runs only). */
  value?: string;
  calls: number;
  /** The selection after the action. */
  caret: string;
  /** A copy's or a cut's clipboard: text/html short and text/plain. */
  clip?: {
    html: string | null;
    plain: string | null;
    data: boolean;
    /** The editor data itself (live runs only, not in the fixtures). */
    lexical?: string;
  };
  errors: string[];
  ms: number;
  /** The page's focus before the action: `text:<text>@<offset>`, or the element's. */
  page?: string;
  /** With `depth`: whether the action added an undo step. */
  undoAdded?: boolean;
  /** With `oracle`: the document's tokens, the range's, and after. */
  tokens?: { before: string; start: number; end: number; after: string };
};

export type RunOptions = {
  /** The history's depth (the branch's `undoDepth`). */
  depth?: () => { undo: number };
  /** Read the range's tokens before the action and the document's after. */
  oracle?: boolean;
  /** A step between the placement and the action (Backspace, the oracle's). */
  first?: Step;
};

/**
 * The range's tokens. The key acts at the place the page's selection is at
 * (15.12, read back at the key), so where both of the page's ends are in
 * the field's text the range is read from them; elsewhere a page point
 * beside an image or a line break names no one place, and the field's
 * selection is read.
 */
const $tokensOfRange = () => {
  const tokens = $documentTokens();
  const page = window.getSelection();
  const inText = (node: Node | null | undefined) =>
    node?.nodeType === Node.TEXT_NODE && editable()?.contains(node) === true;
  const selection =
    (page !== null && inText(page.anchorNode) && inText(page.focusNode)
      ? $createRangeSelectionFromDom(page, $getEditor())
      : null) ?? $getSelection();
  if ($isRangeSelection(selection) === false) {
    return { before: tokens.out, start: -1, end: -1 };
  }
  const a = $tokenPosition(tokens, selection.anchor);
  const f = $tokenPosition(tokens, selection.focus);
  return { before: tokens.out, start: Math.min(a, f), end: Math.max(a, f) };
};

/** The page's focus, as `text:<text>@<offset>` or `element:<name>@<offset>`. */
const pageFocus = () => {
  const selection = window.getSelection();
  const node = selection?.focusNode;
  if (selection === null || node === null || node === undefined) {
    return "none";
  }
  return node.nodeType === Node.TEXT_NODE
    ? `text:${node.textContent}@${selection.focusOffset}`
    : `element:${node.nodeName.toLowerCase()}@${selection.focusOffset}`;
};

/** Mounts the cell, places it by real input, runs its action and records. */
export const runCell1510 = async (
  cell: Cell1510,
  options: RunOptions = {}
): Promise<Record1510> => {
  const onChange = await mount(cell.html);
  const errors: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (text.includes("not wrapped in act") === false) {
        errors.push(text.slice(0, 300));
      }
    });
  try {
    await place1510(cell)();
    await options.first?.();
    const before = caretKey();
    const page = pageFocus();
    const range = options.oracle ? editorOf()!.read($tokensOfRange) : undefined;
    const depth = options.depth?.().undo;
    onChange.mockClear();
    const start = performance.now();
    try {
      await ACTION_STEPS[cell.action]();
    } catch (error) {
      errors.push(`throw: ${String(error).slice(0, 300)}`);
    }
    const ms = Math.round(performance.now() - start);
    const calls = onChange.mock.calls.length;
    const record: Record1510 = {
      before,
      page,
      write: calls > 0 ? short(lastHtml(onChange)) : null,
      value: short(exportRichTextHtml(editorOf()!)),
      calls,
      caret: caretKey(),
      errors,
      ms,
    };
    if (options.depth !== undefined) {
      record.undoAdded = options.depth().undo !== depth;
    }
    if (range !== undefined) {
      record.tokens = {
        ...range,
        after: editorOf()!
          .getEditorState()
          .read(() => $documentTokens().out),
      };
    }
    if (cell.action === "copy" || cell.action === "cut") {
      const data = clipboard();
      record.clip = {
        html: data["text/html"] === undefined ? null : short(data["text/html"]),
        plain: data["text/plain"] ?? null,
        data: (data["application/x-lexical-editor"] ?? "") !== "",
      };
      if (options.oracle || options.depth) {
        record.clip.lexical = data["application/x-lexical-editor"];
      }
    }
    return record;
  } finally {
    spy.mockRestore();
  }
};

/** What each action puts in the document, as tokens (a copy puts nothing). */
export const PUT_1510: Record<Action, string> = {
  k: "k",
  bs: "",
  del: "",
  enter: "",
  plain: "Zq",
  htmlPaste: "Hq",
  cut: "",
  copy: "",
  shiftEnter: "↵",
  wordB: "",
  wordF: "",
  image: "▣",
};

export type Fixture1510 = Record<
  string,
  Pick<Record1510, "before" | "write" | "calls" | "caret" | "clip"> & {
    errors?: string[];
  }
>;

/**
 * 15.10's cells: the focus the head's presses leave is on the root directly
 * after the nested block (a quote, a list, a list at depth two).
 */
export const isRuled1510 = (cell: Cell1510, fixture: Fixture1510) => {
  if (isNested(cell) === false || cell.side !== "R") {
    return false;
  }
  const focus = fixture[cell.id].before.split("|").pop();
  return focus === `element:root@${cell.anchor === "prev" ? 2 : 1}`;
};

/** The cell one press earlier. */
export const earlierId = (cell: Cell1510) => {
  const parts = cell.id.split("|");
  parts[5] = String(cell.presses - 1);
  return parts.join("|");
};

/** The same cell with another action. */
export const withAction = (cell: Cell1510, action: Action) => {
  const parts = cell.id.split("|");
  parts[6] = action;
  return parts.join("|");
};

const sameClip = (a: Record1510["clip"], b: Record1510["clip"]) =>
  a?.html === b?.html && a?.plain === b?.plain && a?.data === b?.data;

/** The cell equals the fixture's: its write, its onChange count and its clipboard. */
export const sameAsFixture = (
  record: Record1510,
  fixture: Fixture1510[string]
) =>
  record.write === fixture.write &&
  record.calls === fixture.calls &&
  sameClip(record.clip, fixture.clip);

const inlineCount = (html: string | null, tag: "img" | "br") =>
  (html ?? "").split(`<${tag}`).length - 1;
const withoutInline = (html: string | null) =>
  (html ?? "").replace(/<(img|br)\b[^>]*>/g, "");

/**
 * The name of a difference from the head's cell (T14.9: a cell that differs
 * is named with the head's loss or throw, or with the rule that differs).
 * `null` when no class names it.
 */
export const differenceOf = (
  record: Record1510,
  fixture: Fixture1510[string]
): string | null => {
  const errors = fixture.errors ?? [];
  if (errors.some((error) => error.includes("to have a parent"))) {
    return "the head throws and loses the letter (15.10)";
  }
  if (errors.some((error) => error.includes("selection has been lost"))) {
    return "the head loses the selection and writes nothing";
  }
  const head = fixture.write;
  const built = record.write;
  if (
    head !== null &&
    head.includes("<blockquote></blockquote>") &&
    built === head.replaceAll("<blockquote></blockquote>", "")
  ) {
    return "the head leaves an emptied quote (5.4)";
  }
  if (
    head !== null &&
    built !== null &&
    withoutInline(head) === withoutInline(built) &&
    inlineCount(head, "img") + inlineCount(head, "br") <
      inlineCount(built, "img") + inlineCount(built, "br")
  ) {
    return "the head takes an image or a line break outside the range (check 3)";
  }
  // the head's paste there also drops the pasted bold
  const unquoted = (html: string) =>
    html.replace(/<\/?(blockquote|b|strong)>/g, "");
  if (
    head !== null &&
    built !== null &&
    unquoted(head) === unquoted(built) &&
    head.split("<blockquote>").length < built.split("<blockquote>").length
  ) {
    return "the head takes the block the range ends in out of its quote (15.10's mirror)";
  }
  if (
    head !== null &&
    built !== null &&
    /<hr/.test(built) &&
    !/<hr/.test(head)
  ) {
    return "the head loses the rule and what follows (15.10)";
  }
  // the Shift step past a rule moves the focus at the key (T29.7), and the
  // key reads the page's selection back (15.12), whichever the field's
  // selection shows when it is read. The field's selection after the
  // presses depends on timing, so this class comes after the classes the
  // write names: a cell's name is then the same whatever the timing.
  if (
    fixture.before !== record.before ||
    (record.page?.startsWith("text:") === true &&
      record.before.split("|").pop()?.startsWith("element:") === true)
  ) {
    return "the presses end elsewhere (the Shift step past a rule, T29.7; the page's selection read back at the key, 15.12)";
  }
  if (head === built && fixture.calls === record.calls) {
    if (
      fixture.clip?.html === "" &&
      record.clip?.html === null &&
      fixture.before.includes("|") === false
    ) {
      return "a copy or a cut at a caret leaves the clipboard as it was (T11.5)";
    }
    if (
      fixture.clip?.html === record.clip?.html &&
      fixture.clip?.data === record.clip?.data
    ) {
      return "text/plain is read from the structure (D6)";
    }
    if (
      withoutInline(fixture.clip?.html ?? null) ===
        withoutInline(record.clip?.html ?? null) &&
      inlineCount(fixture.clip?.html ?? null, "img") +
        inlineCount(fixture.clip?.html ?? null, "br") >
        inlineCount(record.clip?.html ?? null, "img") +
          inlineCount(record.clip?.html ?? null, "br")
    ) {
      return "the head copies an image or a line break outside the range (check 3)";
    }
    if ((fixture.clip?.html ?? "").includes("</p></blockquote>")) {
      return "the head copies past an end directly before a block (FS9, K14)";
    }
  }
  return null;
};
