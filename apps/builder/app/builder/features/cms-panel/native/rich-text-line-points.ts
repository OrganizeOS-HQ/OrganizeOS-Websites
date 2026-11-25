// The point resolver, the selection-change step, the caret-line mark, the after-commit check, the empty-line sweep and the arrow steps.
import { $isListItemNode } from "@lexical/list";
import { $isQuoteNode } from "@lexical/rich-text";
import { $isParentElementRTL } from "@lexical/selection";
import { $dfs, $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $addUpdateTag,
  $createNodeSelection,
  $createRangeSelectionFromDom,
  $getEditor,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type EditorState,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type PointType,
  type RangeSelection,
} from "lexical";
import {
  $atContentEdge,
  $childAtEdge,
  $createCmsLineNode,
  $isCmsLineNode,
  CmsLineNode,
  holdsSelection,
  isBlockDecorator,
  isInlineContent,
  isLineBreak,
  isLinedContainer,
  lineSpike,
} from "./rich-text-line-node";

/** SPIKE: the rule violations seen, for the probe. */
export const lineRuleViolations: string[] = [];

/** The last check after a commit left a point on a lined container. */
let checkFailed = false;

/**
 * Each element point on a lined container moves into the line beside it:
 * the start of the line after, else the end of the line before. With
 * `create`, a point with no line beside it gets an empty line of its own
 * there.
 */
export const $liftPointsIntoLines = (create: boolean, depth = 0): boolean => {
  if (lineSpike.on === false) {
    return false;
  }
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return false;
  }
  const made = new Map<string, CmsLineNode>();
  const collapsed = selection.isCollapsed();
  let gaveBack = false;
  for (const point of collapsed
    ? [selection.anchor]
    : [selection.anchor, selection.focus]) {
    if (point.type !== "element") {
      continue;
    }
    const held = point.getNode();
    if (
      collapsed &&
      $isCmsLineNode(held) &&
      isLinedContainer(held.getParent())
    ) {
      const at = held.getIndexWithinParent();
      const before = held.getPreviousSibling();
      const after = held.getNextSibling();
      const isBeside = (node: LexicalNode | null) =>
        node !== null &&
        ($isCmsLineNode(node) ||
          ($isElementNode(node) && node.isInline() === false));
      if (held.isEmpty() && (isBeside(before) || isBeside(after))) {
        // C2: an empty line holds the caret only while D13 holds at its
        // place: with a line or a block beside it, the point goes back to
        // the container there and resolves, and the line goes
        const container = held.getParentOrThrow();
        point.set(container.getKey(), at, "element");
        held.remove();
        gaveBack = true;
      } else {
        continue;
      }
    }
    const container = point.getNode();
    if (isLinedContainer(container) === false) {
      continue;
    }
    // D18: a line at the point (its start), else a line directly before
    // it (its end); else a block at the point (its start), else a block
    // directly before it (its end); else an empty line
    const lineAt = container.getChildAtIndex(point.offset);
    const lineBefore =
      point.offset > 0 ? container.getChildAtIndex(point.offset - 1) : null;
    if ($isCmsLineNode(lineAt) || $isCmsLineNode(lineBefore)) {
      const line = (
        $isCmsLineNode(lineAt) ? lineAt : lineBefore
      ) as CmsLineNode;
      const atStart = $isCmsLineNode(lineAt);
      const edge = atStart
        ? line.getFirstDescendant()
        : line.getLastDescendant();
      if ($isTextNode(edge)) {
        point.set(
          edge.getKey(),
          atStart ? 0 : edge.getTextContentSize(),
          "text"
        );
      } else {
        point.set(
          line.getKey(),
          atStart ? 0 : line.getChildrenSize(),
          "element"
        );
      }
      continue;
    }
    if ($pointIntoBlockBeside(point)) {
      continue;
    }
    if (create === false) {
      continue;
    }
    const at = `${container.getKey()}@${point.offset}`;
    let line = made.get(at);
    if (line === undefined) {
      line = $createCmsLineNode();
      made.set(at, line);
      const offset = point.offset;
      const other =
        point === selection.anchor ? selection.focus : selection.anchor;
      container.splice(offset, 0, [line]);
      if (
        other.type === "element" &&
        other.key === container.getKey() &&
        other.offset > offset
      ) {
        other.set(other.key, other.offset + 1, "element");
      }
    }
    point.set(line.getKey(), 0, "element");
  }
  if (collapsed) {
    const { anchor, focus } = selection;
    if (anchor.is(focus) === false) {
      focus.set(anchor.key, anchor.offset, anchor.type);
    }
  }
  // J: a point moved into a nested container (an item that holds only a
  // nested list) resolves there in turn, so one resolver serves all three
  // places
  const again =
    depth < 4 &&
    [selection.anchor, selection.focus].some(
      (point) => point.type === "element" && isLinedContainer(point.getNode())
    );
  const deeper = again ? $liftPointsIntoLines(create, depth + 1) : false;
  return made.size > 0 || gaveBack || deeper;
};

/**
 * An element point on a list item or quote moves into the block at it
 * (its start), else the block directly before it (its end); a block is
 * any non-inline element, a line included. True when it moved.
 */
export const $pointIntoBlockBeside = (point: PointType) => {
  if (point.type !== "element") {
    return false;
  }
  const parent = point.getNode();
  if ($isQuoteNode(parent) === false && $isListItemNode(parent) === false) {
    return false;
  }
  const isBlock = (node: LexicalNode | null): node is ElementNode =>
    $isElementNode(node) && node.isInline() === false;
  const at = parent.getChildAtIndex(point.offset);
  const before =
    point.offset > 0 ? parent.getChildAtIndex(point.offset - 1) : null;
  const atEnd = isBlock(at) === false;
  let block = isBlock(at) ? at : isBlock(before) ? before : undefined;
  if (block === undefined) {
    return false;
  }
  for (;;) {
    const child: LexicalNode | null = atEnd
      ? block.getLastChild()
      : block.getFirstChild();
    if ($isElementNode(child)) {
      block = child;
      continue;
    }
    if ($isTextNode(child)) {
      point.set(child.getKey(), atEnd ? child.getTextContentSize() : 0, "text");
      return true;
    }
    point.set(block.getKey(), atEnd ? block.getChildrenSize() : 0, "element");
    return true;
  }
};

/**
 * Whether this update already changed a node: a selection change Lexical
 * dispatches inside an edit keeps the edit's undo step and onChange.
 * SPIKE: reads the editor's dirty sets, which Lexical keeps private.
 */
const $updateHasEdits = () => {
  const editor = $getEditor() as unknown as {
    _dirtyElements: Map<string, boolean>;
    _dirtyLeaves: Set<string>;
  };
  return editor._dirtyElements.size > 0 || editor._dirtyLeaves.size > 0;
};

/**
 * 15.14: the press's own caret survives the press. A press in progress in
 * an editor, per editor (15.13's flag), and the one way the field focuses
 * an editor: during a press in it the field does not focus it (the press
 * does) and does not run what would place the caret after the focus.
 */
const pressing = new WeakSet<LexicalEditor>();

export const isPressing = (editor: LexicalEditor) => pressing.has(editor);

export const focusEditor = (
  editor: LexicalEditor,
  $before?: () => void,
  focusRoot = false
) => {
  if (pressing.has(editor) && lineSpike.focusGuardOff === false) {
    return;
  }
  if ($before !== undefined) {
    editor.update($before);
  }
  if (focusRoot) {
    editor.getRootElement()?.focus({ preventScroll: true });
  }
  editor.focus();
};

/**
 * 15.13 (a): empty lines a press's caret left, per editor. A press does not
 * remove the line its caret left (the content would move between the
 * presses of a double click); the next key in the field, or the next edit
 * or clipboard command, removes it first. A press back into a kept line
 * makes it the caret's line again.
 */
const keptLines = new WeakMap<LexicalEditor, Set<NodeKey>>();

const keptOf = (editor: LexicalEditor) => {
  let kept = keptLines.get(editor);
  if (kept === undefined) {
    kept = new Set();
    keptLines.set(editor, kept);
  }
  return kept;
};

/** Empty lines that hold no point of the selection, by whether a press kept them. */
const $leftEmptyLines = () => {
  const kept = keptOf($getEditor());
  const left: CmsLineNode[] = [];
  for (const { node } of $dfs()) {
    if ($isCmsLineNode(node) && node.isAttached() && node.isEmpty()) {
      if (holdsSelection(node)) {
        kept.delete(node.getKey());
      } else {
        left.push(node);
      }
    }
  }
  return { kept, left };
};

/** Harness: empty lines that hold no point of the selection and no press kept. */
export const unkeptEmptyLines = (editor: LexicalEditor) => {
  const kept = keptOf(editor);
  return editor
    .getEditorState()
    .read(
      () =>
        $dfs().filter(
          ({ node }) =>
            $isCmsLineNode(node) &&
            node.isEmpty() &&
            holdsSelection(node) === false &&
            kept.has(node.getKey()) === false
        ).length
    );
};

/** Empty lines that hold no point of the selection go, except kept ones. True when any did. */
const $removeLeftEmptyLines = (only?: Set<string>) => {
  const { kept, left } = $leftEmptyLines();
  let removed = false;
  for (const line of left) {
    if (
      kept.has(line.getKey()) === false &&
      (only === undefined || only.has(line.getKey()))
    ) {
      line.remove();
      removed = true;
    }
  }
  return removed;
};

/** A press's end: the empty lines its caret left are kept. */
const $keepLeftEmptyLines = () => {
  const { kept, left } = $leftEmptyLines();
  for (const line of left) {
    kept.add(line.getKey());
  }
};

/** Kept lines that hold no point of the selection go. True when any did. */
const $removeKeptLines = () => {
  const { kept, left } = $leftEmptyLines();
  let removed = false;
  for (const line of left) {
    if (kept.has(line.getKey())) {
      line.remove();
      removed = true;
    }
  }
  kept.clear();
  return removed;
};

/**
 * Before an edit command from outside the field's own keys and clipboard
 * events (a toolbar button), kept lines go in an update of their own: not
 * an edit (no undo step, no onChange).
 */
/**
 * D: the one way the field runs an update that can change a node while a
 * node selection is current. With a node selected, the page's own range is
 * what the browser types at (the field takes that input); Lexical's commit
 * of a node selection drops the page's ranges, so the range the page held
 * before the update is put back after it, when the node selection stands
 * and the page holds none. `update` commits at once (discrete).
 */
export const keepPageRange = (editor: LexicalEditor, update: () => void) => {
  const dom = window.getSelection();
  const root = editor.getRootElement();
  const saved =
    dom !== null &&
    dom.rangeCount > 0 &&
    root !== null &&
    root.contains(dom.anchorNode)
      ? dom.getRangeAt(0).cloneRange()
      : null;
  const nodeSelected = () =>
    editor.getEditorState().read(() => $isNodeSelection($getSelection()));
  const before = saved !== null && nodeSelected();
  update();
  if (
    before &&
    saved !== null &&
    dom !== null &&
    dom.rangeCount === 0 &&
    saved.startContainer.isConnected &&
    saved.endContainer.isConnected &&
    nodeSelected() &&
    lineSpike.pageRangeKeepOff === false
  ) {
    dom.addRange(saved);
  }
};

export const removeKeptLines = (editor: LexicalEditor) => {
  if (keptOf(editor).size === 0 || editor.isComposing()) {
    return;
  }
  keepPageRange(editor, () =>
    editor.update(
      () => {
        if ($removeKeptLines()) {
          $addUpdateTag("history-merge");
        }
      },
      { discrete: true }
    )
  );
};

/** Whether a committed selection breaks the point rule (5.3). */
const $pointRuleBroken = () => {
  const selection = $getSelection();
  if ($isRangeSelection(selection) === false) {
    return null;
  }
  for (const point of [selection.anchor, selection.focus]) {
    const node = $getNodeByKey(point.key);
    if (point.type === "element" && node !== null && isLinedContainer(node)) {
      return `${node.getType()}@${point.offset}`;
    }
  }
  return null;
};

/** Whether a line holds a non-inline child (5.5). */
const $lineHoldsBlock = () =>
  $dfs().some(
    ({ node }) =>
      $isCmsLineNode(node) &&
      node.getChildren().some((child) => isInlineContent(child) === false)
  );

/**
 * The outermost inline element whose content's start (end) a point is at,
 * climbing through inline elements only; null when the point is not at
 * the edge of one.
 */
export const $inlineEdgeOf = (point: PointType, atStart: boolean) => {
  let found: ElementNode | null = null;
  for (
    let at: ElementNode | null = point.getNode().getParent();
    at !== null && at.isInline();
    at = at.getParent()
  ) {
    if ($atContentEdge(point, at, atStart) === false) {
      break;
    }
    found = at;
  }
  if (point.type === "element") {
    const holder = point.getNode();
    if (
      $isElementNode(holder) &&
      holder.isInline() &&
      $atContentEdge(point, holder, atStart)
    ) {
      found ??= holder;
    }
  }
  return found;
};

/**
 * The focus at a block's edge in a lined container, with a rule directly
 * beside the block in the direction of the key, moves past the rule: the
 * container point on the rule's far side, resolved by D18. True when it moved.
 */
const $focusPastRule = (selection: RangeSelection, isBackward: boolean) => {
  const focus = selection.focus;
  const node = focus.getNode();
  let child: LexicalNode | null = node;
  while (child !== null && isLinedContainer(child.getParent()) === false) {
    child = child.getParent();
  }
  // a block, or an empty caret line (15.3), at whose edge the focus stands
  if (
    child === null ||
    $isElementNode(child) === false ||
    ($isCmsLineNode(child) && child.isEmpty() === false)
  ) {
    return false;
  }
  if ($atContentEdge(focus, child, isBackward) === false) {
    return false;
  }
  const rule = isBackward ? child.getPreviousSibling() : child.getNextSibling();
  if (isBlockDecorator(rule) === false) {
    return false;
  }
  const container = child.getParentOrThrow();
  const index = rule.getIndexWithinParent();
  focus.set(container.getKey(), isBackward ? index : index + 1, "element");
  $liftPointsIntoLines(false);
  return true;
};

/**
 * 14.7: the direction an arrow key moves the caret, as Lexical's own
 * character move takes it: by the direction of the block the selection is
 * in, where ArrowLeft moves forward in right-to-left text. Every arrow rule
 * of the line code reads its direction here.
 */
/**
 * 15.4: the directions of the content directly before and after a node (a
 * rule), skipping none: a side with no content, or a rule, has none. True
 * when both sides have one and they differ.
 */
const $sidesDiffer = (first: LexicalNode, last: LexicalNode = first) => {
  const directionOf = (node: LexicalNode | null) => {
    if (node === null || isBlockDecorator(node)) {
      return null;
    }
    for (let at: LexicalNode | null = node; at !== null; at = at.getParent()) {
      if (
        $isElementNode(at) &&
        at.isInline() === false &&
        at.getDirection() !== null
      ) {
        return at.getDirection();
      }
    }
    return null;
  };
  const before = directionOf(first.getPreviousSibling());
  const after = directionOf(last.getNextSibling());
  return before !== null && after !== null && before !== after;
};

const $arrowMovesBackward = (isLeftKey: boolean, byFocus = false) => {
  const selection = $getSelection();
  let isRtl = false;
  if ($isRangeSelection(selection) && byFocus) {
    // 15.3: a range's moving point goes by the block the focus is in
    let at: LexicalNode | null = selection.focus.getNode();
    while (
      at !== null &&
      ($isElementNode(at) === false ||
        at.isInline() ||
        at.getDirection() === null)
    ) {
      at = at.getParent();
    }
    isRtl = $isElementNode(at) && at.getDirection() === "rtl";
  } else if ($isRangeSelection(selection)) {
    isRtl = $isParentElementRTL(selection);
  } else if ($isNodeSelection(selection)) {
    // 15.4: off a selected node, the key steps the way it moves a caret in
    // the direction of the content directly before and after the node; where
    // the two sides differ, Lexical's own rule: ArrowLeft to the previous
    // place, ArrowRight to the next
    const nodes = selection.getNodes();
    const first = nodes[0];
    const last = nodes.at(-1);
    if (first === undefined || last === undefined) {
      return isLeftKey;
    }
    if ($sidesDiffer(first, last)) {
      return isLeftKey;
    }
    const side = [first.getPreviousSibling(), last.getNextSibling()].find(
      (node) => node !== null && isBlockDecorator(node) === false
    );
    const block = $isElementNode(side)
      ? side
      : (side?.getParent() ?? first.getParent());
    isRtl = block?.getDirection() === "rtl";
  }
  return isLeftKey !== isRtl;
};

/** The page's caret position at a point of the viewport. */
const caretAtPoint = (
  x: number,
  y: number
): { node: Node; offset: number } | null => {
  const withPosition = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };
  const position = withPosition.caretPositionFromPoint?.(x, y);
  if (position !== undefined && position !== null) {
    return { node: position.offsetNode, offset: position.offset };
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range === null || range === undefined
    ? null
    : { node: range.startContainer, offset: range.startOffset };
};

/**
 * A caret in an empty line stands on the line's container for an edit
 * that reads leaf nodes only (the list commands): the empty line goes and
 * the caret takes its place; the line rules restore the line after.
 */
export const $caretOffEmptyLine = () => {
  const selection = $getSelection();
  if (
    $isRangeSelection(selection) === false ||
    selection.isCollapsed() === false
  ) {
    return;
  }
  const line = selection.anchor.getNode();
  if ($isCmsLineNode(line) === false || line.isEmpty() === false) {
    return;
  }
  const container = line.getParentOrThrow();
  const index = line.getIndexWithinParent();
  line.remove();
  selection.anchor.set(container.getKey(), index, "element");
  selection.focus.set(container.getKey(), index, "element");
};

/** D7's document: `direction` and empty lines left out. */
export const d7Document = (state: EditorState) => {
  const strip = (node: Record<string, unknown>): Record<string, unknown> => {
    const { direction: _direction, ...rest } = node;
    if (Array.isArray(rest.children)) {
      rest.children = (rest.children as Record<string, unknown>[])
        .filter(
          (child) =>
            (child.type === CmsLineNode.getType() &&
              (child.children as unknown[]).length === 0) === false
        )
        .map(strip);
    }
    return rest;
  };
  return JSON.stringify(
    strip(state.toJSON().root as unknown as Record<string, unknown>)
  );
};

export const pointRules = (editor: LexicalEditor) => {
  type PageSelection = {
    anchorNode: Node;
    anchorOffset: number;
    focusNode: Node;
    focusOffset: number;
  };
  // the page's selection as Lexical last wrote or read it
  let pageSelection: PageSelection | null = null;
  const pageSnapshot = (): PageSelection | null => {
    const dom = window.getSelection();
    const root = editor.getRootElement();
    if (
      dom === null ||
      root === null ||
      dom.anchorNode === null ||
      dom.focusNode === null ||
      root.contains(dom.anchorNode) === false ||
      root.contains(dom.focusNode) === false
    ) {
      return null;
    }
    return {
      anchorNode: dom.anchorNode,
      anchorOffset: dom.anchorOffset,
      focusNode: dom.focusNode,
      focusOffset: dom.focusOffset,
    };
  };
  let shiftPressTaken = false;
  const onShiftPress = (event: PointerEvent) => {
    shiftPressTaken = false;
    if (event.shiftKey === false || event.button !== 0) {
      return;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("hr, img, figure") !== null
    ) {
      return;
    }
    const isNodeSelected = editor
      .getEditorState()
      .read(() => $isNodeSelection($getSelection()));
    const root = editor.getRootElement();
    const dom = window.getSelection();
    const clicked = caretAtPoint(event.clientX, event.clientY);
    if (
      isNodeSelected === false ||
      dom === null ||
      clicked === null ||
      root?.contains(clicked.node) !== true
    ) {
      return;
    }
    shiftPressTaken = true;
    dom.collapse(clicked.node, clicked.offset);
    editor.update(
      () => {
        const range = $createRangeSelectionFromDom(dom, editor);
        if (range !== null) {
          $setSelection(range);
        }
      },
      { discrete: true }
    );
  };
  // the press the field took: the page does not extend its own selection
  const onShiftMouseDown = (event: MouseEvent) => {
    if (shiftPressTaken) {
      shiftPressTaken = false;
      event.preventDefault();
    }
  };
  // 15.13: while a press is in progress in the field, the point rule makes
  // and removes no caret line, so no content moves under the pointer; it
  // runs when the press's own events are over (after the click, so the
  // pressed node's own click handler has run, else when the press ends
  // some other way), on the selection as it is then
  let pressId: number | null = null;
  const $resolvePoint = () => {
    const edited = $updateHasEdits();
    const made = $liftPointsIntoLines(true);
    const removed = $removeLeftEmptyLines();
    if ((made || removed) && edited === false) {
      $addUpdateTag("history-merge");
    }
  };
  // the press's end makes the line a caret needs; a line the caret left
  // is kept (15.13 (a))
  const $resolveAfterPress = () => {
    const edited = $updateHasEdits();
    const made = $liftPointsIntoLines(true);
    $keepLeftEmptyLines();
    if (made && edited === false) {
      $addUpdateTag("history-merge");
    }
    $selectionBackOnPage();
  };
  // A: an end of the page's selection inside a decorator's DOM (an image's
  // own element, where Chrome takes no typed text) while Lexical holds a
  // range: Lexical's own selection goes back on the page, which then types
  // over the range. Selection-only; the page's next selection change reads
  // a place outside the decorator, so it does not repeat
  const pageEndInDecorator = () => {
    const root = editor.getRootElement();
    const page = window.getSelection();
    if (root === null || page === null || page.rangeCount === 0) {
      return false;
    }
    return [page.anchorNode, page.focusNode].some((node) => {
      const element =
        node instanceof Element ? node : (node?.parentElement ?? null);
      const decorator = element?.closest("[data-lexical-decorator]") ?? null;
      return decorator !== null && root.contains(decorator);
    });
  };
  const $selectionBackOnPage = () => {
    const selection = $getSelection();
    if (
      $isRangeSelection(selection) &&
      selection.isCollapsed() === false &&
      pageEndInDecorator()
    ) {
      $setSelection(selection.clone());
    }
  };
  const endPress = () => {
    if (pressId === null) {
      return;
    }
    pressId = null;
    pressing.delete(editor);
    if (editor.getRootElement() === null) {
      return;
    }
    keepPageRange(editor, () =>
      editor.update($resolveAfterPress, { discrete: true })
    );
  };
  const onPressStart = (event: PointerEvent) => {
    // a second pointer ends the press in progress
    endPress();
    if (event.button === 0) {
      pressId = event.pointerId;
      pressing.add(editor);
    }
  };
  // 15.12: the page's selection is read back where the page has moved
  // since Lexical last wrote or read it
  const pageMoved = () => {
    if (editor.isComposing() || lineSpike.resyncOff) {
      return false;
    }
    const now = pageSnapshot();
    const was = pageSelection;
    // a range the page shows where Lexical last left none (a node
    // selection's commit removes the page's range, and the browser puts a
    // caret back on its own) is no step of the person's
    return !(
      now === null ||
      was === null ||
      (was !== null &&
        now.anchorNode === was.anchorNode &&
        now.anchorOffset === was.anchorOffset &&
        now.focusNode === was.focusNode &&
        now.focusOffset === was.focusOffset)
    );
  };
  const $readBack = () => {
    if (pageMoved() === false) {
      return false;
    }
    const now = pageSnapshot();
    const selection = $getSelection();
    const dom = window.getSelection();
    if ($isRangeSelection(selection) === false || dom === null) {
      return false;
    }
    const page = $createRangeSelectionFromDom(dom, editor);
    if (page !== null) {
      $setSelection(page);
      // the read-back never writes the page's selection: the page already
      // shows it, and a write (Lexical writes an element point back even
      // when it is unchanged) drops the page's goal column for the next
      // vertical step
      page.dirty = false;
    }
    pageSelection = now;
    return page !== null;
  };
  // a key, or an edit or clipboard event, in the field: in an update of its
  // own before the key's or the edit's (not an edit: no undo step, no
  // onChange), in this order: the page's read-back (15.12), the kept lines
  // go, the held step of a press in progress (15.13); the rules then read
  // the selection
  const beforeKeyOrEditEvents = [
    "keydown",
    "beforeinput",
    "paste",
    "cut",
    "copy",
    "drop",
  ] as const;
  const beforeKeyOrEdit = () => {
    // the page's read-back applies to a range Lexical holds
    const rangeHeld = editor
      .getEditorState()
      .read(() => $isRangeSelection($getSelection()));
    if (
      editor.isComposing() ||
      (keptOf(editor).size === 0 &&
        pressId === null &&
        (rangeHeld === false || pageMoved() === false))
    ) {
      return;
    }
    keepPageRange(editor, () =>
      editor.update(
        () => {
          // a page step read back here is the selection change the page has
          // not reported yet: its step runs as at that change (a line the
          // caret left goes) before the key or edit reads the selection
          const readBack = $readBack();
          let changed = $removeKeptLines();
          if (readBack && pressId === null) {
            changed = $liftPointsIntoLines(true) || changed;
            changed = $removeLeftEmptyLines() || changed;
          }
          if (pressId !== null) {
            changed = $liftPointsIntoLines(true) || changed;
            changed = $removeLeftEmptyLines() || changed;
          }
          if (changed) {
            $addUpdateTag("history-merge");
          }
        },
        { discrete: true }
      )
    );
  };
  // a pointer seen with no button down: the press ended where the page
  // reported no release (outside the window, or no click followed)
  const onPointerMove = (event: PointerEvent) => {
    if (pressId !== null && (event.buttons & 1) === 0) {
      endPress();
    }
  };
  // a caret that arrives with no line beside it gets an empty line, and
  // an empty line the caret left goes: not an edit (no undo step, no
  // onChange: the field's change plugin skips history-merge updates)
  const resolveOnSelectionChange = () => {
    if (pressId === null) {
      $resolvePoint();
      $selectionBackOnPage();
    }
    return false;
  };
  // an arrow off a node-selected rule in a lined container steps beside
  // it and resolves the point there (5.3)
  const arrowOffSelectedNode = (
    event: KeyboardEvent,
    isLeftKey: boolean
  ): boolean => {
    const isBackward = $arrowMovesBackward(isLeftKey);
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    const selection = $getSelection();
    if ($isNodeSelection(selection) === false) {
      return false;
    }
    const node = selection.getNodes().at(isBackward ? 0 : -1);
    if (
      node === undefined ||
      isBlockDecorator(node) === false ||
      isLinedContainer(node.getParent()) === false
    ) {
      return false;
    }
    event.preventDefault();
    if (isBackward) {
      node.selectPrevious();
    } else {
      node.selectNext();
    }
    // a caret move, not an edit: a caret line made or removed is merged
    // into the history's current step (the lift is true only then)
    const edited = $updateHasEdits();
    if ($liftPointsIntoLines(true) && edited === false) {
      $addUpdateTag("history-merge");
    }
    return true;
  };
  // an arrow from a block's edge into a line that starts (going right) or
  // ends (going left) with a line break steps past the break: the point
  // before or after it is the block's edge at the head (V10)
  const arrowPastLineBreak = (
    event: KeyboardEvent,
    isLeftKey: boolean
  ): boolean => {
    const isBackward = $arrowMovesBackward(isLeftKey, event.shiftKey);
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    const selection = $getSelection();
    if ($isRangeSelection(selection) === false) {
      return false;
    }
    // 14.3: with Shift held, from a block's edge toward a rule
    // directly beside it the focus takes the caret's step and passes
    // the rule, to where D18 resolves the container point on its far
    // side; the rule is inside the selection
    if (event.shiftKey && $focusPastRule(selection, isBackward)) {
      event.preventDefault();
      return true;
    }
    // B: from the edge of a block's text toward a rule directly beside
    // the block, the arrow node-selects the rule
    if (event.shiftKey === false && selection.isCollapsed()) {
      const edge = $childAtEdge(isBackward);
      const rule =
        edge === null
          ? null
          : isBackward
            ? edge.child.getPreviousSibling()
            : edge.child.getNextSibling();
      if (isBlockDecorator(rule)) {
        event.preventDefault();
        const nodes = $createNodeSelection();
        nodes.add(rule.getKey());
        $setSelection(nodes);
        return true;
      }
    }
    // going right from the end of a line that ends in a break, with a
    // block directly after the line: the block's start is the same
    // place, so the next stop is one character into the block, as at
    // the head
    if (
      event.shiftKey === false &&
      isBackward === false &&
      selection.isCollapsed()
    ) {
      const at = selection.anchor;
      const atNode = at.getNode();
      const line = $isCmsLineNode(atNode)
        ? atNode
        : $findMatchingParent(atNode, $isCmsLineNode);
      const last = $isCmsLineNode(line) ? line.getLastChild() : null;
      const block = line?.getNextSibling() ?? null;
      const atEnd =
        $isCmsLineNode(line) &&
        isLineBreak(last) &&
        at.type === "element" &&
        atNode.is(line) &&
        at.offset === line.getChildrenSize();
      const first = $isElementNode(block) ? block.getFirstDescendant() : null;
      if (
        atEnd &&
        $isElementNode(block) &&
        $isCmsLineNode(block) === false &&
        block.isInline() === false &&
        $isTextNode(first) &&
        first.getTextContentSize() > 0
      ) {
        event.preventDefault();
        first.select(1, 1);
        return true;
      }
    }
    const focus = selection.focus;
    const node = focus.getNode();
    let child: LexicalNode | null = node;
    while (child !== null && isLinedContainer(child.getParent()) === false) {
      child = child.getParent();
    }
    if (
      child === null ||
      $isCmsLineNode(child) ||
      $isElementNode(child) === false
    ) {
      return false;
    }
    if ($atContentEdge(focus, child, isBackward) === false) {
      return false;
    }
    const line = isBackward
      ? child.getPreviousSibling()
      : child.getNextSibling();
    if ($isCmsLineNode(line) === false) {
      return false;
    }
    const brk = isBackward ? line.getLastChild() : line.getFirstChild();
    if (isLineBreak(brk) === false) {
      return false;
    }
    event.preventDefault();
    // with Shift going right the focus stops before the break, where
    // the head's does (the container's point beside the block)
    // going right the walk stops before the break after a quote and
    // past it after a heading or code block, as the head's does
    const offset = isBackward
      ? line.getChildrenSize() - 1
      : $isQuoteNode(child) || event.shiftKey
        ? 0
        : 1;
    focus.set(line.getKey(), offset, "element");
    if (event.shiftKey === false) {
      selection.anchor.set(line.getKey(), offset, "element");
    }
    return true;
  };
  const rememberPageSelection = () => {
    pageSelection = pageSnapshot();
    return false;
  };
  const readBackOnKey = () => {
    $readBack();
    return false;
  };
  // L: a click on text after a node was selected gives a real caret, as
  // Lexical already does for a touch; with Shift held too, a caret at the
  // click, never the page's range (14.2)
  const clickAfterNodeSelection = (event: MouseEvent) => {
    const selection = $getSelection();
    if (selection !== null && $isNodeSelection(selection) === false) {
      return false;
    }
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("hr, img, figure") !== null
    ) {
      return false;
    }
    const dom = window.getSelection();
    const root = editor.getRootElement();
    if (dom !== null && event.shiftKey) {
      const clicked = caretAtPoint(event.clientX, event.clientY);
      if (clicked !== null && root?.contains(clicked.node) === true) {
        dom.collapse(clicked.node, clicked.offset);
      }
    }
    const at = dom?.anchorNode ?? null;
    if (dom === null || at === null || root?.contains(at) !== true) {
      return false;
    }
    const range = $createRangeSelectionFromDom(dom, editor);
    if (range !== null) {
      $setSelection(range);
    }
    return false;
  };
  return {
    handlers: {
      resolveOnSelectionChange,
      arrowOffSelectedNode,
      arrowPastLineBreak,
      rememberPageSelection,
      readBack: readBackOnKey,
      clickAfterNodeSelection,
    },
    // the rules' registrations that are not commands, in their carried order
    register: () =>
      mergeRegister(
        // 15.12: a key starts from where the page's caret is when the page has
        // moved it since Lexical last wrote or read the selection. A step the
        // page took itself (a caret move inside text) reaches Lexical only when
        // the page's selectionchange is read back, and Lexical's keydown update
        // keeps its last selection; a key that comes before that read would act
        // at the place the page has left (an Enter splitting there, a delete
        // deciding from there). Where the page has not moved, Lexical's own
        // selection stands as it is (a point the page cannot draw apart, a
        // pending format)
        editor.registerUpdateListener(({ editorState, prevEditorState }) => {
          // a commit that wrote the selection
          const next = editorState.read(() => $getSelection());
          const prev = prevEditorState.read(() => $getSelection());
          if (
            next === prev ||
            (next !== null && prev !== null && next.is(prev))
          ) {
            return;
          }
          pageSelection = pageSnapshot();
        }),
        editor.registerRootListener((root, previous) => {
          previous?.removeEventListener("pointerdown", onPressStart, true);
          root?.addEventListener("pointerdown", onPressStart, true);
          for (const type of beforeKeyOrEditEvents) {
            previous?.removeEventListener(type, beforeKeyOrEdit, true);
            root?.addEventListener(type, beforeKeyOrEdit, true);
          }
        }),
        (() => {
          // the press's own end: the click (bubbling, after the node's own
          // handler), or a way a press ends with no click
          const ends = [
            "click",
            "pointercancel",
            "dragend",
            "drop",
            "contextmenu",
          ] as const;
          // the window losing focus (an element's blur is not the press's end)
          const onBlur = (event: FocusEvent) => {
            if (event.target === window) {
              endPress();
            }
          };
          for (const type of ends) {
            window.addEventListener(
              type,
              endPress,
              type === "click" ? false : true
            );
          }
          window.addEventListener("pointermove", onPointerMove, true);
          window.addEventListener("blur", onBlur, true);
          return () => {
            endPress();
            for (const type of ends) {
              window.removeEventListener(
                type,
                endPress,
                type === "click" ? false : true
              );
            }
            window.removeEventListener("pointermove", onPointerMove, true);
            window.removeEventListener("blur", onBlur, true);
          };
        })(),
        // 15.7: Shift and a press on text while a node is selected: the field
        // takes the pressed point when the pointer goes down, so the page's
        // extension from its own anchor never becomes the selection, whichever
        // of the page's selectionchange and the click comes first
        editor.registerRootListener((root, previous) => {
          previous?.removeEventListener("pointerdown", onShiftPress, true);
          previous?.removeEventListener("mousedown", onShiftMouseDown, true);
          root?.addEventListener("pointerdown", onShiftPress, true);
          root?.addEventListener("mousedown", onShiftMouseDown, true);
        }),
        // the third place of 5.3: after every commit, a point that rests on a
        // lined container resolves at once, in an update of its own that makes
        // no undo step and fires no onChange; the rule then holds (5.3, 5.5)
        editor.registerUpdateListener(({ editorState, prevEditorState }) => {
          const report = (message: string) => {
            console.error(message);
            lineRuleViolations.push(message);
          };
          if (editorState.read($lineHoldsBlock)) {
            report("cms-line rule: a line holds a block");
          }
          // held while a composition runs: it adds no update between the
          // composition's own; the commit that ends it is checked
          if (
            editor.isComposing() ||
            lineSpike.thirdPlaceOff ||
            pressId !== null
          ) {
            return;
          }
          const broken = editorState.read($pointRuleBroken);
          if (broken === null) {
            checkFailed = false;
            // a line the caret left by a key or by code, where no selection
            // change of the page followed (the field moved the caret in the
            // key's own update), goes at once
            // goes at once: only a line the selection was in before this
            // commit, never a kept one (a press holds this check off)
            const kept = keptOf(editor);
            const was = prevEditorState.read(
              () =>
                new Set(
                  $dfs()
                    .filter(
                      ({ node }) => $isCmsLineNode(node) && holdsSelection(node)
                    )
                    .map(({ node }) => node.getKey())
                )
            );
            const left = editorState.read(() =>
              $dfs().some(
                ({ node }) =>
                  $isCmsLineNode(node) &&
                  was.has(node.getKey()) &&
                  node.isEmpty() &&
                  holdsSelection(node) === false &&
                  kept.has(node.getKey()) === false
              )
            );
            if (left) {
              keepPageRange(editor, () =>
                editor.update(
                  () => {
                    if ($removeLeftEmptyLines(was)) {
                      $addUpdateTag("history-merge");
                    }
                  },
                  { discrete: true }
                )
              );
            }
            return;
          }
          // a check that could not resolve the point has reported it already
          if (checkFailed) {
            checkFailed = false;
            return;
          }
          keepPageRange(editor, () =>
            editor.update(
              () => {
                // a point moved and nothing else changed is no edit (no onChange, no
                // step) and carries no tag; a caret line made or removed is merged
                // into the history's current step and fires no onChange
                if ($liftPointsIntoLines(true)) {
                  $addUpdateTag("history-merge");
                }
                const still = $pointRuleBroken();
                if (still !== null) {
                  checkFailed = true;
                  report(`cms-line point rule: a point on ${still}`);
                }
              },
              { discrete: true }
            )
          );
        })
      ),
  };
};

/**
 * The caret-line mark (section 4): while a point of the selection stands
 * after the last line break of a line that has a block directly after it,
 * the line's element carries `data-cms-caret`, so the break the reconciler
 * adds there is drawn and the caret stands on the row the next letter lands
 * on. The mark is on the page only: setting or clearing it runs no editor
 * update, adds no history step and fires no onChange.
 */
export const registerCaretLineMark = (editor: LexicalEditor) => {
  let marked = new Set<string>();
  const unregister = editor.registerUpdateListener(({ editorState }) => {
    const next = new Set<string>();
    editorState.read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return;
      }
      for (const point of [selection.anchor, selection.focus]) {
        const line = point.getNode();
        const after = $isCmsLineNode(line) ? line.getNextSibling() : null;
        if (
          $isCmsLineNode(line) &&
          point.type === "element" &&
          point.offset === line.getChildrenSize() &&
          isLineBreak(line.getLastChild()) &&
          after !== null &&
          isInlineContent(after) === false
        ) {
          next.add(line.getKey());
        }
      }
    });
    for (const key of marked) {
      if (next.has(key) === false) {
        editor.getElementByKey(key)?.removeAttribute("data-cms-caret");
      }
    }
    for (const key of next) {
      editor.getElementByKey(key)?.setAttribute("data-cms-caret", "");
    }
    marked = next;
  });
  return () => {
    unregister();
    for (const key of marked) {
      editor.getElementByKey(key)?.removeAttribute("data-cms-caret");
    }
    marked = new Set();
  };
};
