// SPIKE: one-off probes of the editor state after a key.
import { test } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { $getSelection, $isNodeSelection, $isRangeSelection } from "lexical";
import { clickInWord, editable, editorOf, lastHtml, renderField, settle } from "./rich-text-test-harness";

const sel = () =>
  editorOf()!.getEditorState().read(() => {
    const s = $getSelection();
    if ($isNodeSelection(s)) return `node ${[...s._nodes]}`;
    if ($isRangeSelection(s)) return `${s.anchor.type}:${s.anchor.getNode().getType()}:${s.anchor.key}@${s.anchor.offset}`;
    return "none";
  });

test("CS6 trace", async () => {
  const onChange = await renderField("<ul><li>xq<hr>yq</li></ul>");
  await clickInWord("xq");
  for (let i = 0; i < 3; i += 1) {
    await userEvent.keyboard("{ArrowRight}");
    await settle();
    if (sel().startsWith("node")) break;
  }
  console.log("SEL1", sel());
  const clip = new DataTransfer();
  await act(async () => {
    editable()!.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: clip }));
  });
  await settle();
  console.log("SEL2", sel(), lastHtml(onChange), onChange.mock.calls.length);
  console.log("STATE", JSON.stringify(editorOf()!.getEditorState().toJSON().root).replace(/"(format|style|detail|mode|direction|indent|version|textFormat|textStyle)":[^,}]*,?/g, ""));
});
