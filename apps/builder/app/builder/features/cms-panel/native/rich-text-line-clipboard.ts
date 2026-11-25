// The clipboard writer, the plain text of a selection, the line edges of a node selection and the drag's data.
import {
  $getClipboardDataFromSelection,
  $getLexicalContent,
  setLexicalClipboardDataTransfer,
} from "@lexical/clipboard";
import { $isCodeNode } from "@lexical/code";
import { $dfs, $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type BaseSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  createEditor,
  CUT_COMMAND,
  DRAGSTART_COMMAND,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type SerializedEditorState,
  type SerializedLexicalNode,
} from "lexical";
import {
  markRichTextCopy,
  richTextHtmlConfig,
  richTextNodes,
} from "./rich-text-html";
import {
  $isCmsLineNode,
  CmsLineNode,
  isLineBreak,
  isLineContainer,
  isLinedContainer,
  lineSpike,
  PLACE_ATTRIBUTE,
  PLACE_TYPES,
  placeNodes,
} from "./rich-text-line-node";
import { $headPathOverNodeSelection } from "./rich-text-line-node-selection";
import { $unwrapLines } from "./rich-text-line-normalise";
import {
  $endsIntoText,
  $lastPointToBlockEnd,
  $nodesInRange,
  $tagRemoval,
} from "./rich-text-line-removal";

/** What a range or node selection holds: its text (no new lines), images and rules. */
export type HeldContent = { text: string; images: number; rules: number };

export const $heldContent = (selection: BaseSelection): HeldContent => {
  const held: HeldContent = { text: "", images: 0, rules: 0 };
  const count = (node: LexicalNode) => {
    if (node.getType() === "cms-image") {
      held.images += 1;
    } else if (node.getType() === "horizontalrule") {
      held.rules += 1;
    }
  };
  if ($isRangeSelection(selection)) {
    const { nodes, start, end } = $nodesInRange(selection);
    for (const node of nodes) {
      if ($isTextNode(node)) {
        const text = node.getTextContent();
        const from =
          start.type === "text" && start.key === node.getKey()
            ? start.offset
            : 0;
        const to =
          end.type === "text" && end.key === node.getKey()
            ? end.offset
            : text.length;
        held.text += text.slice(from, to);
      } else {
        count(node);
      }
    }
    return held;
  }
  const walk = (node: LexicalNode) => {
    if ($isTextNode(node)) {
      held.text += node.getTextContent();
      return;
    }
    count(node);
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  selection.getNodes().forEach(walk);
  return held;
};

export const $plainTextOf = (selection: BaseSelection): string => {
  if ($isRangeSelection(selection) === false) {
    return selection.getTextContent();
  }
  const { nodes, start, end } = $nodesInRange(selection);
  // a range that ends at the start of a line after a block holds the break
  // between them (F7): text/plain ends with a new line. The end is on the
  // line at its start, or the container's point just before the line
  const endNode = end.getNode();
  let endLine: LexicalNode | null = null;
  if (end.offset === 0 && $isCmsLineNode(endNode)) {
    endLine = endNode;
  } else if (end.offset === 0 && end.type === "text") {
    const line = $findMatchingParent(endNode, $isCmsLineNode);
    endLine = line?.getFirstDescendant()?.is(endNode) === true ? line : null;
  } else if (end.type === "element" && isLinedContainer(endNode)) {
    const at = endNode.getChildAtIndex(end.offset);
    endLine = $isCmsLineNode(at) ? at : null;
  }
  const blockBefore = endLine?.getPreviousSibling() ?? null;
  const breakAtEnd =
    $isElementNode(blockBefore) &&
    $isCmsLineNode(blockBefore) === false &&
    blockBefore.isInline() === false;
  if (nodes.length === 0) {
    return breakAtEnd ? "\n" : "";
  }
  const last = nodes[nodes.length - 1];
  let text = "";
  let prevWasElement = true;
  // whether the last leaf read stood in a block's text, not in a line
  let lastInBlockText = false;
  for (const node of nodes) {
    if ($isCmsLineNode(node)) {
      continue;
    }
    if ($isElementNode(node) && node.isInline() === false) {
      if (prevWasElement === false) {
        text += "\n";
      }
      prevWasElement = node.isEmpty() === false;
      continue;
    }
    const line = $findMatchingParent(node, $isCmsLineNode);
    if (
      line !== null &&
      prevWasElement === false &&
      lastInBlockText &&
      isLineBreak(node) === false &&
      text.endsWith("\n") === false
    ) {
      text += "\n";
    }
    lastInBlockText = line === null;
    prevWasElement = false;
    if ($isTextNode(node)) {
      const part = node.getTextContent();
      const from =
        start.type === "text" && start.key === node.getKey() ? start.offset : 0;
      const to =
        end.type === "text" && end.key === node.getKey()
          ? end.offset
          : part.length;
      text += part.slice(from, to);
    } else if (
      ($isDecoratorNode(node) || isLineBreak(node)) &&
      (node !== last || selection.isCollapsed() === false)
    ) {
      text += node.getTextContent();
    }
  }
  if (breakAtEnd && text.endsWith("\n") === false) {
    text += "\n";
  }
  return text;
};

/**
 * The selection a copy, a cut or a drag writes from: a point at the edge
 * of a line counts as the same point on the line's container (D6), so the
 * copied data holds the list item wherever the head's does.
 */
export const $mapLineEdges = (selection: BaseSelection): BaseSelection => {
  if ($isRangeSelection(selection) === false) {
    return selection;
  }
  const mapped = selection.clone();
  const endPoint = selection.isBackward() ? mapped.anchor : mapped.focus;
  let endsAtLineStart: CmsLineNode | null = null;
  for (const point of [mapped.anchor, mapped.focus]) {
    const node = point.getNode();
    const line = $isCmsLineNode(node)
      ? node
      : $findMatchingParent(node, $isCmsLineNode);
    if (line === null || isLineContainer(line.getParent()) === false) {
      continue;
    }
    const first = line.getFirstDescendant();
    const last = line.getLastDescendant();
    const atStart =
      point.offset === 0 && (line.is(node) || first === null || first.is(node));
    const atEnd = line.is(node)
      ? point.offset === line.getChildrenSize()
      : last !== null &&
        last.is(node) &&
        point.offset === node.getTextContentSize();
    if (atStart === false && atEnd === false) {
      continue;
    }
    const container = line.getParentOrThrow();
    if (atStart && point === endPoint && selection.isCollapsed() === false) {
      endsAtLineStart = line;
    }
    point.set(
      container.getKey(),
      line.getIndexWithinParent() + (atStart ? 0 : 1),
      "element"
    );
  }
  // a selection that ends at a line's start holds nothing of that line: it
  // ends at the container's point before the line, where the head's nodes
  // step back to the child before it (D6)
  const line = endsAtLineStart;
  if (line !== null) {
    const nodes = mapped.getNodes();
    const kept = nodes.filter(
      (node) => line.is(node) === false && line.isParentOf(node) === false
    );
    const before = line.getPreviousSibling();
    if (before !== null && kept.some((node) => node.is(before)) === false) {
      kept.push(before);
    }
    mapped.getNodes = () => kept;
  }
  return mapped;
};

/** The clipboard type of Lexical's own copy, whose nodes carry their links. */
export const LEXICAL_CLIPBOARD_TYPE = "application/x-lexical-editor";

/** Whether a clipboard's editor data holds the given content. */
const sameContent = (
  data: ReturnType<typeof $getClipboardDataFromSelection>,
  held: HeldContent
) => {
  const json = data["application/x-lexical-editor"];
  if (json === undefined || json === "" || lineSpike.cutCheckFails) {
    return false;
  }
  const found: HeldContent = { text: "", images: 0, rules: 0 };
  const walk = (node: {
    type?: string;
    text?: string;
    children?: unknown[];
  }) => {
    if (typeof node.text === "string") {
      found.text += node.text;
    }
    if (node.type === "cms-image") {
      found.images += 1;
    } else if (node.type === "horizontalrule") {
      found.rules += 1;
    }
    for (const child of node.children ?? []) {
      walk(child as typeof node);
    }
  };
  try {
    for (const node of (JSON.parse(json) as { nodes: unknown[] }).nodes) {
      walk(node as Parameters<typeof walk>[0]);
    }
  } catch {
    return false;
  }
  return (
    found.text === held.text &&
    found.images === held.images &&
    found.rules === held.rules
  );
};

/** A node and its descendants as the editor state's JSON holds them. */
const $treeJSON = (node: LexicalNode): SerializedLexicalNode => {
  const json = node.exportJSON() as SerializedLexicalNode & {
    children?: SerializedLexicalNode[];
  };
  if ($isElementNode(node)) {
    json.children = node.getChildren().map($treeJSON);
  }
  return json;
};

/**
 * The clipboard Lexical writes for `selection` on the head's form of the
 * tree: a scratch editor with the field's nodes and namespace holds the
 * state the command runs in, with every line replaced by its children, the
 * selection carried over by path (an element point on a line goes to its
 * container with the line's children). Null when it cannot write: a throw,
 * or an end that does not carry over or does not fit its node.
 */
/** The document's content in order: each character, and each leaf that is not text by its type. */
const $contentTokens = () => {
  const tokens: string[] = [];
  const walk = (node: LexicalNode) => {
    if ($isTextNode(node)) {
      for (const character of node.getTextContent()) {
        tokens.push(character);
      }
    } else if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    } else {
      tokens.push(`[${node.getType()}]`);
    }
  };
  walk($getRoot());
  return tokens;
};

/** What a removal took: the tokens between the common start and the common end. */
const $removedTokens = (before: string[], after: string[]) => {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start += 1;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end += 1;
  return before.slice(start, before.length - end);
};

const $tokensHeld = (tokens: string[]) => {
  const held = { text: "", images: 0, rules: 0 };
  for (const token of tokens) {
    if (token === "[cms-image]") held.images += 1;
    else if (token === "[horizontalrule]") held.rules += 1;
    else if (token.length === 1 && token !== "\n") held.text += token;
  }
  return held;
};

/** 15.11 (2, E): the nodes the scratch editor made to give an end its place leave nothing. */
const dropPlaces = (
  data: ReturnType<typeof $getClipboardDataFromSelection>
) => {
  const json = data["application/x-lexical-editor"];
  if (json !== undefined && json !== "") {
    const parsed = JSON.parse(json) as { nodes: SerializedLexicalNode[] };
    const drop = (nodes: SerializedLexicalNode[]): SerializedLexicalNode[] =>
      nodes.flatMap((node) => {
        const item = node as SerializedLexicalNode & {
          children?: SerializedLexicalNode[];
        };
        if (PLACE_TYPES.has(item.type)) {
          return [];
        }
        if (item.children !== undefined) {
          const had = item.children.length;
          item.children = drop(item.children);
          // a list the made item alone filled goes with it
          if (had > 0 && item.children.length === 0 && item.type === "list") {
            return [];
          }
        }
        return [item];
      });
    parsed.nodes = drop(parsed.nodes);
    data["application/x-lexical-editor"] = JSON.stringify(parsed);
  }
  const html = data["text/html"];
  if (html !== undefined && html.includes(PLACE_ATTRIBUTE)) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const element of [
      ...doc.body.querySelectorAll(`[${PLACE_ATTRIBUTE}]`),
    ]) {
      if (element.isConnected === false) {
        continue;
      }
      // the made node, and any span or list it alone fills
      let at: Element = element;
      while (
        at.parentElement !== null &&
        at.parentElement !== doc.body &&
        at.parentElement.childNodes.length === 1 &&
        (at.parentElement.tagName === "SPAN" ||
          ["UL", "OL"].includes(at.parentElement.tagName))
      ) {
        at = at.parentElement;
      }
      at.remove();
    }
    data["text/html"] = doc.body.innerHTML;
  }
  return data;
};

/** "fallback": an element end where no text can stand (15.11 (4)): the present writer runs. */
const $headFormClipboard = (
  editor: LexicalEditor,
  selection: RangeSelection,
  give = false
): ReturnType<typeof $getClipboardDataFromSelection> | null | "fallback" => {
  let fellBack = false;
  const pathOf = (node: LexicalNode) => {
    const path: number[] = [];
    let at: LexicalNode = node;
    while (at.getParent() !== null) {
      path.unshift(at.getIndexWithinParent());
      at = at.getParentOrThrow();
    }
    return path;
  };
  // a point in a code block is carried by its character offset in the
  // block: the scratch editor's code block holds the same text, split into
  // nodes its own way
  const ends = [selection.anchor, selection.focus].map((point) => {
    const node = point.getNode();
    const code = $findMatchingParent(node, $isCodeNode);
    if (code !== null) {
      let chars = 0;
      if (point.type === "element" && node.is(code)) {
        for (const child of code.getChildren().slice(0, point.offset)) {
          chars += child.getTextContentSize();
        }
      } else {
        for (const child of code.getChildren()) {
          if (child.is(node) || child.isParentOf(node)) break;
          chars += child.getTextContentSize();
        }
        chars += point.type === "text" ? point.offset : 0;
      }
      return { path: pathOf(code), kind: "code", offset: chars, code: true };
    }
    return {
      path: pathOf(node),
      kind: node.getType(),
      offset: point.offset,
      type: point.type,
      code: false,
    };
  });
  const scratch = createEditor({
    namespace: editor._config.namespace,
    theme: editor._config.theme,
    nodes: [...richTextNodes, ...placeNodes],
    html: richTextHtmlConfig,
    onError: (error: Error) => {
      throw error;
    },
  });
  const state = {
    root: $treeJSON($getRoot()),
  } as unknown as SerializedEditorState;
  scratch.setEditorState(scratch.parseEditorState(state));
  let data: ReturnType<typeof $getClipboardDataFromSelection> | null = null;
  try {
    scratch.update(
      () => {
        const resolve = (path: number[]) =>
          path.reduce<LexicalNode | null>(
            (node, index) =>
              $isElementNode(node) ? node.getChildAtIndex(index) : null,
            $getRoot()
          );
        const range = $createRangeSelection();
        const anchorNode = resolve(ends[0].path);
        const focusNode = resolve(ends[1].path);
        // an end that does not carry over: no clipboard
        if (
          anchorNode === null ||
          focusNode === null ||
          anchorNode.getType() !== ends[0].kind ||
          focusNode.getType() !== ends[1].kind
        ) {
          return;
        }
        const place = (
          point: typeof range.anchor,
          node: LexicalNode,
          end: (typeof ends)[number]
        ) => {
          if (end.code === false) {
            point.set(node.getKey(), end.offset, end.type ?? "text");
            return;
          }
          // the character offset in the scratch editor's code block
          let left = end.offset;
          const children = (node as ElementNode).getChildren();
          for (const [index, child] of children.entries()) {
            const size = child.getTextContentSize();
            if ($isTextNode(child) && left <= size) {
              point.set(child.getKey(), left, "text");
              return;
            }
            if (left === 0) {
              point.set(node.getKey(), index, "element");
              return;
            }
            left -= size;
          }
          point.set(node.getKey(), children.length, "element");
        };
        place(range.anchor, anchorNode, ends[0]);
        place(range.focus, focusNode, ends[1]);
        // an end that does not fit the node it lands on: no clipboard
        const fits = (point: typeof range.anchor) => {
          const node = point.getNode();
          return point.type === "text"
            ? $isTextNode(node) && point.offset <= node.getTextContentSize()
            : $isElementNode(node) && point.offset <= node.getChildrenSize();
        };
        if (fits(range.anchor) === false || fits(range.focus) === false) {
          return;
        }
        $setSelection(range);
        // 15.11: each element end a place of its own in text, before the
        // lines give way
        if (give && $endsIntoText(range, true) === null) {
          fellBack = true;
          return;
        }
        for (const { node } of $dfs()) {
          if ($isCmsLineNode(node) && node.isAttached()) {
            $unwrapLines([node]);
          }
        }
        // a code block reached partway writes its selected text, read from
        // this editor's selection
        if (lineSpike.scratchClipboardFails) {
          throw new Error("cms-line clipboard: forced failure");
        }
        markRichTextCopy($getSelection());
        data = dropPlaces({
          ...$getClipboardDataFromSelection($getSelection()),
        });
      },
      { discrete: true }
    );
  } catch {
    return null;
  }
  if (fellBack) {
    return "fallback";
  }
  return data as ReturnType<typeof $getClipboardDataFromSelection> | null;
};

// the field writes the clipboard from the selection with line edges
// mapped to their containers (D6), and a cut removes in this same
// update, marked as a removal (5.4)
export const registerCopyCutWriter = (editor: LexicalEditor): (() => void) =>
  mergeRegister(
    ...([COPY_COMMAND, CUT_COMMAND] as const).map((command) =>
      editor.registerCommand(
        command,
        (event: ClipboardEvent | KeyboardEvent | null) => {
          if (
            lineSpike.on === false ||
            event instanceof ClipboardEvent === false ||
            event.clipboardData === null
          ) {
            return false;
          }
          let selection = $getSelection();
          if (selection === null) {
            return false;
          }
          // no native copy or cut, whatever follows (a refused cut
          // abandons its update by a throw)
          event.preventDefault();
          // 15.10: the writer takes the place the removal takes for a
          // range's last point on a container after a nested block; a cut
          // removes from there
          // K14: the writer's ends part from the removal's at a last
          // point directly before a block (it stays)
          if ($isRangeSelection(selection)) {
            if (command === CUT_COMMAND) {
              const removal = selection.clone();
              if ($lastPointToBlockEnd(removal)) {
                $setSelection(removal);
              }
            }
            const moved = selection.clone();
            if ($lastPointToBlockEnd(moved, "writer")) {
              selection = moved;
            }
          }
          // G (D6), 14.9: a range whose two ends are text points copies
          // what the head copies for the same two ends: text/html and the
          // editor data are written on the head's form of the tree, by the
          // one writer; text/plain is read from the structure. A range
          // with an element-point end, and a node selection, keep the
          // mapped writer: on the head's form of the tree Lexical's own
          // walk copies past an element end at a line's start (FS9)
          // 15.11: one writer for every range (candidate iii): each
          // element end takes a place of its own in text in the scratch
          // editor; where no text can stand the present writer runs
          const range =
            $isRangeSelection(selection) && selection.isCollapsed() === false;
          let data: ReturnType<typeof $getClipboardDataFromSelection> | null;
          let plain: string;
          const written = range
            ? $headFormClipboard(editor, selection as RangeSelection, true)
            : "fallback";
          const textEnds =
            range &&
            (selection as RangeSelection).anchor.type === "text" &&
            (selection as RangeSelection).focus.type === "text";
          if (written !== "fallback" || textEnds) {
            data =
              written === "fallback"
                ? ($headFormClipboard(
                    editor,
                    selection as RangeSelection
                  ) as typeof data)
                : written;
            plain = $plainTextOf(selection);
            if (data === null && import.meta.env.DEV) {
              console.error(
                "cms-line clipboard: the head-form copy could not be written"
              );
            }
          } else {
            const mapped = $mapLineEdges(selection);
            markRichTextCopy(mapped);
            data = $getClipboardDataFromSelection(mapped);
            plain = $plainTextOf(mapped);
          }
          // 14.9 (b): a cut writes, and removes, only when its clipboard
          // holds what its selection holds (text without new lines, images
          // and rules, read by the structure reader)
          if (
            data !== null &&
            command === CUT_COMMAND &&
            sameContent(data, $heldContent(selection)) === false
          ) {
            if (import.meta.env.DEV) {
              console.error(
                "cms-line clipboard: the cut's clipboard does not hold its selection"
              );
            }
            data = null;
          }
          if (data === null) {
            // the safe result: text/plain only, and a cut removes nothing
            markRichTextCopy(null);
            setLexicalClipboardDataTransfer(event.clipboardData, {
              "text/plain": plain,
            });
            return true;
          }
          data["text/plain"] = plain;
          if (command === CUT_COMMAND && $isRangeSelection(selection)) {
            // E (2): the cut's check compares the clipboard with what the
            // removal actually takes, the document before and after it in
            // this update, before the clipboard is written. Where they
            // differ nothing is removed: the update is abandoned by a throw,
            // which Lexical answers by keeping the state before it (no
            // onChange, no undo step, the selection as it was) and reports
            // to the editor's onError (the dev assertion); the clipboard
            // holds text/plain only
            const before = $contentTokens();
            $tagRemoval();
            const live = $getSelection();
            if ($isRangeSelection(live)) {
              live.removeText();
            }
            const taken = $tokensHeld($removedTokens(before, $contentTokens()));
            if (
              sameContent(data, taken) === false ||
              lineSpike.cutTakesCheckFails
            ) {
              markRichTextCopy(null);
              setLexicalClipboardDataTransfer(event.clipboardData, {
                "text/plain": plain,
              });
              throw new Error(
                "cms-line clipboard: the cut's removal does not take what its clipboard holds"
              );
            }
            setLexicalClipboardDataTransfer(event.clipboardData, data);
            return true;
          }
          setLexicalClipboardDataTransfer(event.clipboardData, data);
          if (command === CUT_COMMAND) {
            $tagRemoval();
            if ($isNodeSelection(selection)) {
              $headPathOverNodeSelection();
              for (const node of selection.getNodes()) {
                node.remove();
              }
            }
          }
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
    )
  );

// a drag inside the editor carries its nodes, as a copy does
export const registerDragStart = (editor: LexicalEditor): (() => void) =>
  editor.registerCommand(
    DRAGSTART_COMMAND,
    (event) => {
      const selection = $getSelection();
      if (event.dataTransfer !== null && selection !== null) {
        const content = $getLexicalContent(editor, selection);
        if (content !== null) {
          event.dataTransfer.setData(LEXICAL_CLIPBOARD_TYPE, content);
        }
      }
      return false;
    },
    COMMAND_PRIORITY_CRITICAL
  );
