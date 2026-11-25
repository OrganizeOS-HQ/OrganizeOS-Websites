// The line rules' command registrations, composed in the carried order.
import { mergeRegister } from "@lexical/utils";
import { type LexicalEditor } from "lexical";
import { registerDeleteCommands } from "./rich-text-line-deletes";
import { linesOff } from "./rich-text-line-node";
import { registerPointCommands } from "./rich-text-line-points";
import { registerEditMarks } from "./rich-text-line-removal";
import { registerDividerMarks } from "./rich-text-line-toolbar";

/**
 * The field's key rules at a line's start: Backspace outdents a nested
 * item; Ctrl+Backspace after a rule removes the rule only; Backspace at an
 * item's start after an item that ends in a rule removes the rule and
 * joins the item, as after an item that ends in text.
 */
export const registerLineCommands = (editor: LexicalEditor) => {
  if (linesOff) {
    return () => {};
  }
  return mergeRegister(
    registerPointCommands(editor),
    registerEditMarks(editor),
    registerDividerMarks(editor),
    registerDeleteCommands(editor)
  );
};
