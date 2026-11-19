// SPIKE: one-off probes of the editor state after a key.
import { test } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { editorOf, mountAt, settle } from "./rich-text-test-harness";

test("A6 state", async () => {
  const onChange = await mountAt("<ul><li>T0w<hr /></li></ul>", "T0w", 0, "T0w", 3);
  console.log("BEFORE", JSON.stringify(editorOf()!.getEditorState().toJSON().root));
  await userEvent.keyboard("{Enter}");
  await settle();
  console.log("CALLS", JSON.stringify(onChange.mock.calls));
  console.log("AFTER", JSON.stringify(editorOf()!.getEditorState().toJSON().root));
});
