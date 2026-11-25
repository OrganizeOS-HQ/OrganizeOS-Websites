import { describe, expect, test, vi } from "vitest";
import { createEditor } from "lexical";
import { richTextNodes } from "./rich-text-html";
import {
  COMMAND_ORDER,
  FIELD_HANDLER_IDS,
  LINE_HANDLER_IDS,
  provideFieldHandlers,
  registerRichTextCommands,
} from "./rich-text-line-commands";

// the field's nodes reach the design system (the image node's popover),
// which needs a DOM on load; no test here renders it, so every name it
// exports stands in as an inert value
vi.mock("@webstudio-is/design-system", () => {
  const inert: unknown = new Proxy(() => inert, {
    get: (_target, key) =>
      key === "then"
        ? undefined
        : key === Symbol.toPrimitive
          ? () => ""
          : inert,
  });
  return Object.fromEntries(
    [
      "Button",
      "css",
      "cssVar",
      "Flex",
      "Grid",
      "InputField",
      "Label",
      "Popover",
      "PopoverAnchor",
      "PopoverContent",
      "Text",
      "theme",
    ].map((name) => [name, inert])
  );
});

describe("the one registration of the field's and the line rules' handlers", () => {
  test("the handler order is the one this plan states", () => {
    expect(COMMAND_ORDER).toEqual([
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
    ]);
  });

  test("every id is defined", () => {
    const known = new Set<string>([
      ...FIELD_HANDLER_IDS.map((id) => `field.${id}`),
      ...LINE_HANDLER_IDS,
    ]);
    const used = new Set(COMMAND_ORDER.flatMap((row) => row.handlers));
    for (const id of used) {
      expect(known.has(id), id).toBe(true);
    }
    for (const id of known) {
      expect(used.has(id as never), id).toBe(true);
    }
  });

  test("a field handler with no provider is an error at registration", () => {
    const editor = createEditor({
      nodes: [...richTextNodes],
      onError: (error) => {
        throw error;
      },
    });
    provideFieldHandlers(
      editor,
      Object.fromEntries(
        FIELD_HANDLER_IDS.filter((id) => id !== "imageArrow").map((id) => [
          id,
          () => false,
        ])
      )
    );
    expect(() =>
      registerRichTextCommands(editor, {
        namespace: "t",
        theme: {},
        nodes: richTextNodes,
      })
    ).toThrow(/imageArrow/);
  });
});
