// SPIKE: round 15's composition history (prototype round 15). 15.1: only a
// composition's own end counts; an undo during it voids what the field kept
// and the result is the head's. 15.2: a cancelled composition leaves the
// history exactly as it was (undo stack length and redo stack).
import { expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { cdp, userEvent } from "@vitest/browser/context";
import { $getRoot, CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_CRITICAL, type LexicalEditor } from "lexical";
import { clickInWord, editorOf, renderField, settle } from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { cmsHistory } from "./rich-text-line-node";
const UNDO = "{Control>}z{/Control}";
const REDO = "{Control>}{Shift>}z{/Shift}{/Control}";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const send = (m: string, p: object) => (cdp() as unknown as { send: (m: string, p: object) => Promise<unknown> }).send(m, p);
const ime = async (text: string) => { await send("Input.imeSetComposition", { text, selectionStart: text.length, selectionEnd: text.length }); await settle(); };
const commit = async (text: string) => { await send("Input.insertText", { text }); await settle(); };
const LI = (mid: string) => `<ul><li>Pw</li><li>${mid}</li><li>Nw</li></ul>`;
type Spy = { mock: { calls: unknown[][] } };
const val = (c: unknown[] | undefined) => { const v = c?.[0] as { html: string } | null | undefined; return v == null ? String(v) : sanitizeRichTextHtml(v.html).replace('<ul><li>Pw</li>', '').replace('<li>Nw</li></ul>', ''); };
const watch = (e: LexicalEditor) => { const h = { u: false, r: false }; e.registerCommand(CAN_UNDO_COMMAND, (p) => ((h.u = p), false), COMMAND_PRIORITY_CRITICAL); e.registerCommand(CAN_REDO_COMMAND, (p) => ((h.r = p), false), COMMAND_PRIORITY_CRITICAL); return h; };
const stacks = (e: LexicalEditor) => { const h = cmsHistory.get(e); return h ? `${h.undoStack.length}/${h.redoStack.length}` : "-"; };
const text = (e: LexicalEditor) => e.getEditorState().read(() => $getRoot().getTextContent().replace(/\n+/g, "|"));
const presses = async (spy: Spy, h: { u: boolean; r: boolean }, _e: LexicalEditor, dir: "u" | "r") => {
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (dir === "u" ? !h.u : !h.r) break;
    await userEvent.keyboard(dir === "u" ? UNDO : REDO); await settle();
    out.push(val(spy.mock.calls.at(-1)));
  }
  return out;
};
const EXPECTED: Record<string, { value: string; st: string; u: string[]; r: string[] }> = {
 "F1-ORD-cancel": {
  "value": "<p>A0w</p><p>B1w</p>",
  "st": "0/1",
  "u": [],
  "r": [
   "<p>A0w</p><p>B1wxya</p>"
  ]
 },
 "F1-ORD-text": {
  "value": "<p>A0w</p><p>B1wab</p>",
  "st": "0/1",
  "u": [],
  "r": [
   "<p>A0w</p><p>B1wxya</p>"
  ]
 },
 "F1-TQT-cancel": {
  "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li>",
  "st": "0/1",
  "u": [],
  "r": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxya</li>"
  ]
 },
 "F1-TQT-text": {
  "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wab</li>",
  "st": "0/1",
  "u": [],
  "r": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxya</li>"
  ]
 },
 "F2-format-cancel": {
  "value": "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
  "st": "1/0",
  "u": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2w</li>"
  ],
  "r": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>"
  ]
 },
 "F2-format-text": {
  "value": "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx<b><strong>ab</strong></b></li>",
  "st": "2/0",
  "u": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2w</li>"
  ],
  "r": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx<b><strong>ab</strong></b></li>"
  ]
 },
 "F2-linkLed-cancel": {
  "value": "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
  "st": "1/0",
  "u": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2w</li>"
  ],
  "r": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>"
  ]
 },
 "F2-linkLed-text": {
  "value": "<li><blockquote><p>Q0w</p></blockquote>ab<a href=\"https://example.org/\">L1w</a>T2wx</li>",
  "st": "2/0",
  "u": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2w</li>"
  ],
  "r": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
   "<li><blockquote><p>Q0w</p></blockquote>ab<a href=\"https://example.org/\">L1w</a>T2wx</li>"
  ]
 },
 "F2-pause-cancel": {
  "value": "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
  "st": "1/0",
  "u": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2w</li>"
  ],
  "r": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>"
  ]
 },
 "F2-pause-text": {
  "value": "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wxab</li>",
  "st": "3/0",
  "u": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wxa</li>",
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2w</li>"
  ],
  "r": [
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wx</li>",
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wxa</li>",
   "<li><blockquote><p>Q0w</p></blockquote><a href=\"https://example.org/\">L1w</a>T2wxab</li>"
  ]
 }
};
const save = (id: string, x: { after: { value: string; st: string }; u: string[]; r: string[] }) => {
  const want = EXPECTED[id];
  expect({ value: x.after.value, st: x.after.st, u: x.u, r: x.r }).toEqual(want);
};
for (const [name, html, word] of [["TQT", LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"), "T2w"], ["ORD", "<p>A0w</p><p>B1w</p>", "B1w"]] as const) for (const cancel of [false, true]) {
  const id = `F1-${name}-${cancel ? "cancel" : "text"}`;
  test(id, async () => {
    const spy = await renderField(html); const e = editorOf()!; const h = watch(e);
    await clickInWord(word, 3);
    await userEvent.keyboard("x"); await settle(); await wait(150);
    await userEvent.keyboard("y"); await settle(); await wait(150);
    const typed = stacks(e);
    await ime("a");
    await userEvent.keyboard(UNDO); await settle();
    const t = cancel ? "" : "ab";
    await ime(t); await commit(t); await wait(60); await settle();
    const after = { value: val(spy.mock.calls.at(-1)), st: stacks(e) };
    const u = await presses(spy, h, e, "u"); const r = await presses(spy, h, e, "r");
    void typed;
    save(id, { after, u, r });
  }, 60_000);
}
const F2 = LI('<blockquote><p>Q0w</p></blockquote><a href="https://example.org/">L1w</a>T2w');
for (const [kind, prep] of [
  ["linkLed", async () => { await clickInWord("T2w", 3); await userEvent.keyboard("x"); await settle(); await act(async () => { editorOf()!.update(() => { $getRoot().getAllTextNodes().find((x) => x.getTextContent() === "L1w")!.select(0, 0); }); }); await settle(); await wait(150); }],
  ["pause", async () => { await clickInWord("T2w", 3); await userEvent.keyboard("x"); await settle(); await wait(150); }],
  ["format", async () => { await clickInWord("T2w", 3); await userEvent.keyboard("x"); await settle(); await wait(150); await userEvent.keyboard("{Control>}b{/Control}"); await settle(); await wait(150); }],
] as const) for (const t of ["", "ab"]) {
  const id = `F2-${kind}-${t === "" ? "cancel" : "text"}`;
  test(id, async () => {
    const spy = await renderField(F2); const e = editorOf()!; const h = watch(e);
    await prep();
    const before = { text: text(e), st: stacks(e) };
    await ime("a");
    if (kind === "pause") await wait(1200);
    await ime(t === "" ? "" : "ab"); await commit(t); await wait(60); await settle();
    const after = { value: val(spy.mock.calls.at(-1)), st: stacks(e) };
    const u = await presses(spy, h, e, "u"); const r = await presses(spy, h, e, "r");
    void before;
    save(id, { after, u, r });
  }, 60_000);
}
