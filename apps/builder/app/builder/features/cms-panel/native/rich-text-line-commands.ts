// The one registration of every handler that shares a command and a
// priority with a line handler, in one stated order (COMMAND_ORDER).
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/react/LexicalHorizontalRuleNode";
import { mergeRegister } from "@lexical/utils";
import {
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  COPY_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  type EditorThemeClasses,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_DOWN_COMMAND,
  type Klass,
  type LexicalCommand,
  type LexicalEditor,
  type LexicalNode,
  PASTE_COMMAND,
  REMOVE_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
} from "lexical";
import { $dragStart, $writeCopyCut } from "./rich-text-line-clipboard";
import {
  $blockEdge,
  $breakLedLineStart,
  $deleteEdgeForms,
  $emptyLine,
  $itemStartJoin,
  $joinBeforeEndingImage,
  $lineEndIntoBlock,
  $wordBesideRule,
} from "./rich-text-line-deletes";
import { compositionStartChar } from "./rich-text-line-history";
import {
  $headPathOnRemove,
  $nodeSelectionPaste,
  $typeIntoLine,
} from "./rich-text-line-node-selection";
import { pointRules, registerCaretLineMark } from "./rich-text-line-points";
import {
  $enterInHeading,
  $enterRangeWithBreak,
  $nothingHeldKey,
  $removalMark,
} from "./rich-text-line-removal";
import { $divider } from "./rich-text-line-toolbar";

export const FIELD_HANDLER_IDS = [
  "pinImageAnchor", // 451f20f04 RF 2697 (ImageEditingPlugin), SELECTION_CHANGE (reads the plugin's pinnedAnchor ref)
  "selectionIntoAdjacentBlocks", // 451f20f04 RF 4359 (PasteRulesPlugin, `$selectionIntoAdjacentBlocks`), the editing commands
  "caretBesideSelectedImage", // 451f20f04 RF 2525 and 2536 (ImageEditingPlugin; reads the plugin's lastArrow)
  "markCopy", // 451f20f04 RF 2739 and 2747, until Task 18 Step 5
  "deleteAfterLineBreak", // 451f20f04 RF 2644
  "imageArrow", // 451f20f04 RF 2438
  "caretBesideImageOnKey", // 451f20f04 RF 2501 (ImageEditingPlugin), KEY_DOWN: typing with an image selected puts a caret beside it; reads lastArrow
  "pinAnchorOnExtend", // 451f20f04 RF 2668 (ImageEditingPlugin), KEY_DOWN: sets pinnedAnchor
] as const;
export type FieldHandlerId = (typeof FIELD_HANDLER_IDS)[number];

export const LINE_HANDLER_IDS = [
  "points.resolveOnSelectionChange",
  "points.arrowPastLineBreak",
  "points.arrowOffSelectedNode",
  "points.rememberPageSelection", // 451f20f04 LN 2634: pageSelection = pageSnapshot()
  "points.readBack", // 451f20f04 LN 2642: $readBack (15.12)
  "points.clickAfterNodeSelection", // 451f20f04 LN 2695: group L
  "removal.nothingHeldKey", // 451f20f04 LN 3032-3047 (15.10): $lastPointToBlockEnd; where the range then holds nothing, preventDefault, $setSelection(moved), true
  "removal.mark",
  "enter.heading", // `$enterInHeading()` (INSERT_PARAGRAPH only), from the Divider handler at `451f20f04` (rich-text-line-node.ts 2895-2897)
  "enter.rangeWithBreak", // E1: Enter or Shift+Enter over a range from a line into a block, `$removeRangeWithBreak` (451f20f04 2902-2913); returns false so the key runs at the caret
  "nodeSelection.typeIntoLine",
  "nodeSelection.paste",
  "nodeSelection.headPath",
  "toolbar.divider",
  "deletes.edgeForms", // round 14's delete forms of the remove handler at `451f20f04` (rich-text-line-node.ts 3061-3087), in their carried order
  "deletes.emptyLine",
  "deletes.blockEdge",
  "deletes.lineEndIntoBlock", // D3's third case, Delete form (round 9, LN 1619-1670)
  "deletes.breakLedLineStart", // 451f20f04 LN 3246, group C
  "deletes.joinBeforeEndingImage", // 451f20f04 LN 3287, D3's second case (15.5, 16.12)
  "deletes.itemStartJoin",
  "deletes.wordBesideRule",
  "clipboard.writeCopyCut",
  "clipboard.dragStart",
  "history.compositionStartChar", // 451f20f04 LN 3844, registered by registerCompositionStep at the carry
] as const;
type LineHandlerId = (typeof LINE_HANDLER_IDS)[number];

export type HandlerId = `field.${FieldHandlerId}` | LineHandlerId;

export type CommandOrderRow = {
  command: string; // the command's type string, e.g. "DELETE_CHARACTER_COMMAND"
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  handlers: readonly HandlerId[];
};

/**
 * The order the field's and the line rules' handlers run in, one row per
 * command and priority (Task 7's table, written from the registrations at
 * 451f20f04 in their carried order; a row of the table that names two
 * commands is two rows here). Within a row the first handler that
 * returns true ends the command.
 */
export const COMMAND_ORDER: ReadonlyArray<CommandOrderRow> = [
  {
    command: "SELECTION_CHANGE_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.pinImageAnchor",
      "points.resolveOnSelectionChange",
      "points.rememberPageSelection",
    ],
  },
  {
    // KEY_DOWN_COMMAND: Lexical 0.21 names its type KEYDOWN_COMMAND
    command: "KEYDOWN_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.caretBesideImageOnKey",
      "field.pinAnchorOnExtend",
      "points.readBack",
    ],
  },
  {
    command: "CLICK_COMMAND",
    priority: "LOW",
    handlers: ["points.clickAfterNodeSelection"],
  },
  {
    command: "CONTROLLED_TEXT_INSERTION_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "field.caretBesideSelectedImage",
      "removal.mark",
      "nodeSelection.typeIntoLine",
      "history.compositionStartChar",
    ],
  },
  {
    command: "INSERT_PARAGRAPH_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "removal.mark",
      "enter.heading",
      "enter.rangeWithBreak",
    ],
  },
  {
    command: "INSERT_LINE_BREAK_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "removal.mark",
      "enter.rangeWithBreak",
    ],
  },
  {
    command: "INSERT_HORIZONTAL_RULE_COMMAND",
    priority: "CRITICAL",
    handlers: ["removal.mark", "toolbar.divider"],
  },
  {
    command: "PASTE_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "field.caretBesideSelectedImage",
      "removal.mark",
      "nodeSelection.paste",
    ],
  },
  {
    command: "DROP_COMMAND",
    priority: "CRITICAL",
    handlers: ["field.caretBesideSelectedImage"],
  },
  {
    command: "SELECTION_INSERT_CLIPBOARD_NODES_COMMAND",
    priority: "CRITICAL",
    handlers: ["removal.mark", "nodeSelection.paste"],
  },
  {
    command: "COPY_COMMAND",
    priority: "CRITICAL",
    handlers: ["field.markCopy"],
  },
  {
    command: "CUT_COMMAND",
    priority: "CRITICAL",
    handlers: ["field.markCopy"],
  },
  {
    command: "COPY_COMMAND",
    priority: "HIGH",
    handlers: ["clipboard.writeCopyCut"],
  },
  {
    command: "CUT_COMMAND",
    priority: "HIGH",
    handlers: ["clipboard.writeCopyCut"],
  },
  {
    command: "KEY_BACKSPACE_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "removal.nothingHeldKey",
      "nodeSelection.headPath",
      "removal.mark",
    ],
  },
  {
    command: "KEY_DELETE_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "removal.nothingHeldKey",
      "nodeSelection.headPath",
      "removal.mark",
    ],
  },
  {
    command: "REMOVE_TEXT_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "nodeSelection.headPath",
      "removal.mark",
    ],
  },
  {
    command: "DELETE_CHARACTER_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "nodeSelection.headPath",
      "deletes.edgeForms",
      "removal.mark",
    ],
  },
  {
    command: "DELETE_CHARACTER_COMMAND",
    priority: "NORMAL",
    handlers: [
      "field.deleteAfterLineBreak",
      "deletes.emptyLine",
      "deletes.joinBeforeEndingImage",
    ],
  },
  {
    command: "DELETE_CHARACTER_COMMAND",
    priority: "LOW",
    handlers: [
      "deletes.blockEdge",
      "deletes.lineEndIntoBlock",
      "deletes.breakLedLineStart",
      "deletes.itemStartJoin",
    ],
  },
  {
    command: "DELETE_WORD_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "nodeSelection.headPath",
      "deletes.edgeForms",
      "removal.mark",
    ],
  },
  {
    command: "DELETE_LINE_COMMAND",
    priority: "CRITICAL",
    handlers: [
      "field.selectionIntoAdjacentBlocks",
      "nodeSelection.headPath",
      "deletes.edgeForms",
      "removal.mark",
    ],
  },
  {
    command: "DELETE_WORD_COMMAND",
    priority: "NORMAL",
    handlers: ["deletes.emptyLine"],
  },
  {
    command: "DELETE_LINE_COMMAND",
    priority: "NORMAL",
    handlers: ["deletes.emptyLine"],
  },
  {
    command: "DELETE_WORD_COMMAND",
    priority: "LOW",
    handlers: [
      "deletes.wordBesideRule",
      "deletes.blockEdge",
      "deletes.lineEndIntoBlock",
      "deletes.breakLedLineStart",
      "deletes.itemStartJoin",
    ],
  },
  {
    command: "DELETE_LINE_COMMAND",
    priority: "LOW",
    handlers: [
      "deletes.wordBesideRule",
      "deletes.blockEdge",
      "deletes.lineEndIntoBlock",
      "deletes.breakLedLineStart",
      "deletes.itemStartJoin",
    ],
  },
  {
    command: "KEY_ARROW_LEFT_COMMAND",
    priority: "NORMAL",
    handlers: ["points.arrowPastLineBreak"],
  },
  {
    command: "KEY_ARROW_RIGHT_COMMAND",
    priority: "NORMAL",
    handlers: ["points.arrowPastLineBreak"],
  },
  {
    command: "KEY_ARROW_LEFT_COMMAND",
    priority: "LOW",
    handlers: ["field.imageArrow", "points.arrowOffSelectedNode"],
  },
  {
    command: "KEY_ARROW_RIGHT_COMMAND",
    priority: "LOW",
    handlers: ["field.imageArrow", "points.arrowOffSelectedNode"],
  },
  {
    command: "DRAGSTART_COMMAND",
    priority: "CRITICAL",
    handlers: ["clipboard.dragStart"],
  },
];

/** The commands by their type string (a production build's command carries none). */
const COMMANDS: Record<string, LexicalCommand<unknown>> = {
  SELECTION_CHANGE_COMMAND,
  KEYDOWN_COMMAND: KEY_DOWN_COMMAND,
  CLICK_COMMAND,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_HORIZONTAL_RULE_COMMAND,
  PASTE_COMMAND,
  DROP_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
  COPY_COMMAND,
  CUT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  REMOVE_TEXT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_WORD_COMMAND,
  DELETE_LINE_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  DRAGSTART_COMMAND,
} as Record<string, LexicalCommand<unknown>>;

const PRIORITIES = {
  CRITICAL: COMMAND_PRIORITY_CRITICAL,
  HIGH: COMMAND_PRIORITY_HIGH,
  NORMAL: COMMAND_PRIORITY_NORMAL,
  LOW: COMMAND_PRIORITY_LOW,
} as const;

/**
 * A field handler: a command listener, told the command it runs for (one
 * handler serves both arrows, both clipboard commands, the paste and the
 * drop).
 */
type FieldHandler = (
  payload: unknown,
  editor: LexicalEditor,
  command: LexicalCommand<unknown>
) => boolean;

const fieldHandlers = new WeakMap<
  LexicalEditor,
  Map<FieldHandlerId, FieldHandler>
>();

/**
 * Hands one plugin's handlers to this editor's registration. Per editor:
 * a WeakMap<LexicalEditor, Map<FieldHandlerId, CommandListener<unknown>>>.
 * Returns a function that removes exactly these entries.
 */
export const provideFieldHandlers = (
  editor: LexicalEditor,
  handlers: Partial<Record<FieldHandlerId, FieldHandler>>
): (() => void) => {
  let provided = fieldHandlers.get(editor);
  if (provided === undefined) {
    provided = new Map();
    fieldHandlers.set(editor, provided);
  }
  const entries = Object.entries(handlers) as Array<
    [FieldHandlerId, FieldHandler]
  >;
  for (const [id, handler] of entries) {
    provided.set(id, handler);
  }
  return () => {
    for (const [id, handler] of entries) {
      if (provided.get(id) === handler) {
        provided.delete(id);
      }
    }
  };
};

/**
 * The field handler ids this editor has a provider for (read by the
 * listener and by the runtime test).
 */
export const fieldHandlersOf = (
  editor: LexicalEditor
): ReadonlySet<FieldHandlerId> =>
  new Set(fieldHandlers.get(editor)?.keys() ?? []);

const noProvider = (id: FieldHandlerId) =>
  new Error(`cms rich text: no provider for field handler ${id}`);

/** The scratch editor's config, passed in by the field (no read of editor._config). */
export type ScratchConfig = {
  namespace: string;
  theme: EditorThemeClasses;
  nodes: ReadonlyArray<Klass<LexicalNode>>;
};

type LineHandler = (
  payload: unknown,
  command: LexicalCommand<unknown>
) => boolean;

/**
 * One listener per (command, priority) row of COMMAND_ORDER, and the
 * non-command registrations of the line rules' points, once each in their
 * carried order. The config reaches clipboard.writeCopyCut, which is
 * $writeCopyCut(config).
 */
export const registerRichTextCommands = (
  editor: LexicalEditor,
  config: ScratchConfig
): (() => void) => {
  const missing = FIELD_HANDLER_IDS.filter(
    (id) => fieldHandlersOf(editor).has(id) === false
  );
  if (missing.length > 0) {
    throw noProvider(missing[0]);
  }
  const field = (id: FieldHandlerId): FieldHandler => {
    const handler = fieldHandlers.get(editor)?.get(id);
    if (handler === undefined) {
      throw noProvider(id);
    }
    return handler;
  };
  const points = pointRules(editor);
  const writeCopyCut = $writeCopyCut(config);
  const line: Record<LineHandlerId, LineHandler> = {
    "points.resolveOnSelectionChange": () =>
      points.handlers.resolveOnSelectionChange(),
    "points.arrowPastLineBreak": (payload, command) =>
      points.handlers.arrowPastLineBreak(
        payload as KeyboardEvent,
        command === KEY_ARROW_LEFT_COMMAND
      ),
    "points.arrowOffSelectedNode": (payload, command) =>
      points.handlers.arrowOffSelectedNode(
        payload as KeyboardEvent,
        command === KEY_ARROW_LEFT_COMMAND
      ),
    "points.rememberPageSelection": () =>
      points.handlers.rememberPageSelection(),
    "points.readBack": () => points.handlers.readBack(),
    "points.clickAfterNodeSelection": (payload) =>
      points.handlers.clickAfterNodeSelection(payload as MouseEvent),
    "removal.nothingHeldKey": (payload) =>
      $nothingHeldKey(payload as KeyboardEvent | null),
    "removal.mark": (payload, command) => $removalMark(command, payload),
    "enter.heading": () => $enterInHeading(),
    "enter.rangeWithBreak": () => $enterRangeWithBreak(),
    "nodeSelection.typeIntoLine": (payload) => $typeIntoLine(payload),
    "nodeSelection.paste": (payload, command) =>
      $nodeSelectionPaste(command, payload),
    "nodeSelection.headPath": () => $headPathOnRemove(),
    "toolbar.divider": () => $divider(),
    "deletes.edgeForms": (payload, command) =>
      $deleteEdgeForms(command, payload as boolean),
    "deletes.emptyLine": (payload) => $emptyLine(payload as boolean),
    "deletes.blockEdge": (payload, command) =>
      $blockEdge(payload as boolean, command),
    "deletes.lineEndIntoBlock": (payload) =>
      $lineEndIntoBlock(payload as boolean),
    "deletes.breakLedLineStart": (payload) =>
      $breakLedLineStart(payload as boolean),
    "deletes.joinBeforeEndingImage": (payload) =>
      $joinBeforeEndingImage(payload as boolean),
    "deletes.itemStartJoin": (payload) => $itemStartJoin(payload as boolean),
    "deletes.wordBesideRule": (payload) => $wordBesideRule(payload as boolean),
    // a cut's removal step starts with the field's own move of an end
    // between blocks into the block beside it, after the clipboard is
    // written (T11.2)
    "clipboard.writeCopyCut": (payload, command) =>
      writeCopyCut(
        payload as ClipboardEvent | KeyboardEvent | null,
        command as typeof COPY_COMMAND,
        () => {
          field("selectionIntoAdjacentBlocks")(payload, editor, command);
        }
      ),
    "clipboard.dragStart": (payload) => $dragStart(payload as DragEvent),
    "history.compositionStartChar": (payload) =>
      compositionStartChar(editor, payload),
  };
  const run = (
    id: HandlerId,
    payload: unknown,
    command: LexicalCommand<unknown>
  ) =>
    id.startsWith("field.")
      ? field(id.slice("field.".length) as FieldHandlerId)(
          payload,
          editor,
          command
        )
      : line[id as LineHandlerId](payload, command);
  return mergeRegister(
    ...COMMAND_ORDER.map(({ command: type, priority, handlers }) => {
      const command = COMMANDS[type];
      return editor.registerCommand(
        command,
        (payload) => {
          for (const id of handlers) {
            if (run(id, payload, command)) {
              return true;
            }
          }
          return false;
        },
        PRIORITIES[priority]
      );
    }),
    registerCaretLineMark(editor),
    points.register()
  );
};
