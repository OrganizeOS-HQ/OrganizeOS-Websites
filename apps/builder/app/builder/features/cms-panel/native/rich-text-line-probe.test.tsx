// SPIKE: one-off trace of the selection around a node-selected removal.
import { test } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { $getSelection, $isNodeSelection, $isRangeSelection, TextNode } from "lexical";
import { ListItemNode } from "@lexical/list";
import { clickInWord, editable, editorOf, lastHtml, renderField, settle } from "./rich-text-test-harness";

const sel = () =>
  editorOf()!.getEditorState().read(() => {
    const s = $getSelection();
    if ($isNodeSelection(s)) return `node ${[...s._nodes]}`;
    if ($isRangeSelection(s)) return `${s.anchor.type}:${s.anchor.getNode().getType()}:${s.anchor.key}:"${s.anchor.getNode().getTextContent()}"@${s.anchor.offset} dirty=${s.dirty}`;
    return "none";
  });
const dom = () => {
  const s = window.getSelection()!;
  const n = s.anchorNode;
  return `DOM ${n?.nodeName}:"${(n?.textContent ?? "").slice(0, 10)}"@${s.anchorOffset}`;
};

for (const [name, run] of [
  ["cut", async () => {
    const clip = new DataTransfer();
    await act(async () => {
      editable()!.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: clip }));
    });
  }],
  ["Backspace", async () => {
    await userEvent.keyboard("{Backspace}");
  }],
] as const) {
  test(`trace ${name}`, async () => {
    const onChange = await renderField("<ul><li>xq<hr>yq</li></ul>");
    await clickInWord("xq");
    for (let i = 0; i < 3; i += 1) {
      await userEvent.keyboard("{ArrowRight}");
      await settle();
      if (sel().startsWith("node")) break;
    }
    const log: string[] = [];
    const original = Selection.prototype.setBaseAndExtent;
    Selection.prototype.setBaseAndExtent = function (a: Node, ao: number, f: Node, fo: number) {
      log.push(`setBaseAndExtent ${a.nodeName}:"${(a.textContent ?? "").slice(0, 10)}"@${ao}`);
      return original.call(this, a, ao, f, fo);
    };
    const onSel = () => log.push(`selectionchange ${dom()} | state ${sel()}`);
    document.addEventListener("selectionchange", onSel);
    const off = editorOf()!.registerUpdateListener(({ tags, dirtyElements, dirtyLeaves, prevEditorState }) => {
      const prev = prevEditorState.read(() => { const s = $getSelection(); return s?.constructor.name; });
      log.push(`update tags=[${[...tags]}] dirty=${dirtyElements.size}/${dirtyLeaves.size} prev=${prev} state ${sel()} ${dom()}`);
    });
    const now = () => {
      const s = $getSelection();
      if ($isRangeSelection(s)) return `${s.anchor.type}:${s.anchor.key}:"${s.anchor.getNode().getTextContent()}"@${s.anchor.offset}`;
      return s?.constructor.name ?? "null";
    };
    const t1 = editorOf()!.registerNodeTransform(ListItemNode, (node) => log.push(`  item transform ${node.getKey()} children=${node.getChildrenSize()} sel ${now()}`));
    const t2 = editorOf()!.registerNodeTransform(TextNode, (node) => log.push(`  text transform ${node.getKey()} "${node.getTextContent()}" attached=${node.isAttached()} sel ${now()}`));
    await settle();
    log.push(`start state ${sel()} ${dom()}`);
    await run();
    await settle();
    log.push(`end state ${sel()} ${dom()} html ${lastHtml(onChange).replace(/<[^>]*span[^>]*>|class="[^"]*"| value="\d"/g, "")}`);
    off();
    t1();
    t2();
    document.removeEventListener("selectionchange", onSel);
    Selection.prototype.setBaseAndExtent = original;
    console.log(`TRACE ${name}\n${log.join("\n")}`);
  });
}
