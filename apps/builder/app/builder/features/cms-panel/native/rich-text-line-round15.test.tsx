// SPIKE: round 15 (prototype round 15). 15.1: only a composition's own end
// counts; an undo during it voids what the field kept and the result is the
// head's. 15.2: a cancelled composition leaves the history exactly as it was
// (undo stack length and redo stack). 15.3 and 15.4: Shift steps and steps
// off a selected rule in right-to-left and mixed-direction items. 15.5 and
// 15.6: a heading that holds only an image.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField } from "./rich-text-field";
import { act } from "react-dom/test-utils";
import { cdp, userEvent } from "@vitest/browser/context";
import { $createRangeSelection, $createRangeSelectionFromDom, $setSelection, KEY_DOWN_COMMAND, type BaseSelection, type ElementNode, type LexicalNode, $getRoot, $getSelection, $isElementNode, $isNodeSelection, $isRangeSelection, $isTextNode, type PointType, CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_CRITICAL, type LexicalEditor } from "lexical";
import { byLabel, click, clickInWord, editable, editorOf, lastHtml, renderField, settle, unmountField } from "./rich-text-test-harness";
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

// 15.2: a composition that ended with text is decided at its end; the next
// edit (a Backspace, a cut, an undo) is the person's own: the head's steps,
// plus F12's step for the composition
const WRITTEN_THEN: Record<string, unknown> = {
 "W-ORD-one-bs": {
  "composed": {
   "value": "<p>A0w</p><p>B1wxa</p>",
   "st": "2/0"
  },
  "afterEdit": {
   "value": "<p>A0w</p><p>B1wx</p>",
   "st": "3/0"
  },
  "u": [
   "<p>A0w</p><p>B1wxa</p>",
   "<p>A0w</p><p>B1wx</p>",
   "<p>A0w</p><p>B1w</p>"
  ],
  "r": [
   "<p>A0w</p><p>B1wx</p>",
   "<p>A0w</p><p>B1wxa</p>",
   "<p>A0w</p><p>B1wx</p>"
  ]
 },
 "W-ORD-one-cut": {
  "composed": {
   "value": "<p>A0w</p><p>B1wxa</p>",
   "st": "2/0"
  },
  "afterEdit": {
   "value": "<p>A0w</p><p>B1wx</p>",
   "st": "3/0"
  },
  "u": [
   "<p>A0w</p><p>B1wxa</p>",
   "<p>A0w</p><p>B1wx</p>",
   "<p>A0w</p><p>B1w</p>"
  ],
  "r": [
   "<p>A0w</p><p>B1wx</p>",
   "<p>A0w</p><p>B1wxa</p>",
   "<p>A0w</p><p>B1wx</p>"
  ]
 },
 "W-ORD-one-undo": {
  "composed": {
   "value": "<p>A0w</p><p>B1wxa</p>",
   "st": "2/0"
  },
  "afterEdit": {
   "value": "<p>A0w</p><p>B1wx</p>",
   "st": "1/1"
  },
  "u": [
   "<p>A0w</p><p>B1w</p>"
  ],
  "r": [
   "<p>A0w</p><p>B1wx</p>",
   "<p>A0w</p><p>B1wxa</p>"
  ]
 },
 "W-ORD-two-bs": {
  "composed": {
   "value": "<p>A0w</p><p>B1wxab</p>",
   "st": "2/0"
  },
  "afterEdit": {
   "value": "<p>A0w</p><p>B1wx</p>",
   "st": "3/0"
  },
  "u": [
   "<p>A0w</p><p>B1wxab</p>",
   "<p>A0w</p><p>B1wx</p>",
   "<p>A0w</p><p>B1w</p>"
  ],
  "r": [
   "<p>A0w</p><p>B1wx</p>",
   "<p>A0w</p><p>B1wxab</p>",
   "<p>A0w</p><p>B1wx</p>"
  ]
 },
 "W-TQT-one-bs": {
  "composed": {
   "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxa</li>",
   "st": "2/0"
  },
  "afterEdit": {
   "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "st": "3/0"
  },
  "u": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxa</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li>"
  ],
  "r": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxa</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>"
  ]
 },
 "W-TQT-one-cut": {
  "composed": {
   "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxa</li>",
   "st": "2/0"
  },
  "afterEdit": {
   "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "st": "3/0"
  },
  "u": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxa</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li>"
  ],
  "r": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxa</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>"
  ]
 },
 "W-TQT-one-undo": {
  "composed": {
   "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxa</li>",
   "st": "2/0"
  },
  "afterEdit": {
   "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "st": "1/1"
  },
  "u": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li>"
  ],
  "r": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxa</li>"
  ]
 },
 "W-TQT-two-bs": {
  "composed": {
   "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxab</li>",
   "st": "2/0"
  },
  "afterEdit": {
   "value": "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "st": "3/0"
  },
  "u": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxab</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li>"
  ],
  "r": [
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wxab</li>",
   "<li>T0w<blockquote><p>Q1w</p></blockquote>T2wx</li>"
  ]
 }
};
const cutEvent = async () => { await act(async () => { document.querySelector<HTMLElement>("[contenteditable=true]")!.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: new DataTransfer() })); }); await settle(); };
for (const [name, html, word] of [["TQT", LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"), "T2w"], ["ORD", "<p>A0w</p><p>B1w</p>", "B1w"]] as const) for (const [kind, t, after] of [
  ["one-bs", "a", async () => { await userEvent.keyboard("{Backspace}"); await settle(); }],
  ["two-bs", "ab", async () => { await userEvent.keyboard("{Backspace}"); await settle(); await userEvent.keyboard("{Backspace}"); await settle(); }],
  ["one-cut", "a", async () => { await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}"); await settle(); await cutEvent(); }],
  ["one-undo", "a", async () => { await userEvent.keyboard(UNDO); await settle(); }],
] as const) {
  const id = `W-${name}-${kind}`;
  test(id, async () => {
    const spy = await renderField(html); const e = editorOf()!; const h = watch(e);
    await clickInWord(word, 3);
    await userEvent.keyboard("x"); await settle(); await wait(150);
    await ime(t.slice(0, 1)); if (t.length > 1) await ime(t); await commit(t); await wait(60); await settle();
    const composed = { value: val(spy.mock.calls.at(-1)), st: stacks(e) };
    await wait(150);
    await after();
    const afterEdit = { value: val(spy.mock.calls.at(-1)), st: stacks(e) };
    const u = await presses(spy, h, e, "u"); const r = await presses(spy, h, e, "r");
    expect({ composed, afterEdit, u, r }).toEqual(WRITTEN_THEN[id]);
  }, 60_000);
}

// 15.3: with Shift held, a focus on an empty caret line beside a rule passes
// it, in either direction of text (the moving point goes by the focus's
// block). 15.4: off a selected rule, a key steps as a caret in the direction
// of the content on both sides; where the sides differ, Lexical's rule
// (ArrowLeft to the previous place, ArrowRight to the next)
const ptOf = (p: PointType) => { const n = p.getNode(); if (p.type === "text") return `"${n.getTextContent()}"@${p.offset}`; const c = $isElementNode(n) ? n.getChildAtIndex(p.offset) : null; return `${n.getType()}@${p.offset}[${c ? ($isTextNode(c) ? c.getTextContent() : c.getType()) : "-"}]`; };
const walkSel = () => editorOf()!.getEditorState().read(() => { const s = $getSelection(); if ($isNodeSelection(s)) return "node:" + s.getNodes().map((n) => n.getType()).join(","); if ($isRangeSelection(s)) return s.isCollapsed() ? ptOf(s.anchor) : `${ptOf(s.anchor)}->${ptOf(s.focus)}`; return String(s); });
const QR = LI("<blockquote><p>קבג</p></blockquote><hr>").replace("Pw", "פא").replace("Nw", "נו");
const RQR = LI("<hr><blockquote><p>קדה</p></blockquote><hr>").replace("Pw", "פא").replace("Nw", "נו");
const TQR = LI("תאב<blockquote><p>קדה</p></blockquote><hr>").replace("Pw", "פא").replace("Nw", "נו");
const WALKS: [string, string, string, number, string][] = [
  ["F3-QR-back", QR, "נו", 0, "{Shift>}{ArrowRight}{/Shift}"],
  ["F3-RQR-back", RQR, "נו", 0, "{Shift>}{ArrowRight}{/Shift}"],
  ["F3-TQR-back", TQR, "נו", 0, "{Shift>}{ArrowRight}{/Shift}"],
  ["F3-RQR-fwd", RQR, "פא", 2, "{Shift>}{ArrowLeft}{/Shift}"],
  ["F3-QR-ltr-back", LI("<blockquote><p>Q0w</p></blockquote><hr>"), "Nw", 0, "{Shift>}{ArrowLeft}{/Shift}"],
  ["F3-RQR-ltr-fwd", LI("<hr><blockquote><p>Q1w</p></blockquote><hr>"), "Pw", 2, "{Shift>}{ArrowRight}{/Shift}"],
  // K8, an accepted difference (owned by R2 for the whole field): between a
  // left-to-right line and a right-to-left quote the walk alternates
  // between the rule and the quote's start (TRQrtl), and the reverse shape
  // (QRT) between the rule and the right-to-left line's start; the right
  // rule needs memory of how the rule was entered. R2's change shows here
  ["F4-TRQrtl", LI("T0w<hr><blockquote><p>קבג</p></blockquote>"), "Pw", 2, "{ArrowRight}"],
  ["F4-QRTrtl", LI("<blockquote><p>Q0w</p></blockquote><hr>תגד"), "Pw", 2, "{ArrowRight}"],
  ["F4-TRQrtl-back", LI("T0w<hr><blockquote><p>קבג</p></blockquote>"), "Nw", 0, "{ArrowLeft}"],
  ["F4-rtlRrtl", LI("תאב<hr><blockquote><p>קבג</p></blockquote>").replace("Pw", "פא").replace("Nw", "נו"), "פא", 2, "{ArrowLeft}"],
];
const WALK_STOPS: Record<string, { stops: string[]; k: string }> = {
 "F3-QR-back": {
  "stops": [
   "\"נו\"@0",
   "\"נו\"@0->cms-line@0[-]",
   "\"נו\"@0->\"קבג\"@3",
   "\"נו\"@0->\"קבג\"@2",
   "\"נו\"@0->\"קבג\"@1",
   "\"נו\"@0->\"קבג\"@0",
   "\"נו\"@0->\"פא\"@2",
   "\"נו\"@0->\"פא\"@1",
   "\"נו\"@0->\"פא\"@0",
   "\"נו\"@0->\"פא\"@0",
   "\"נו\"@0->\"פא\"@0"
  ],
  "k": "<ul><li>kנו</li></ul>"
 },
 "F3-QR-ltr-back": {
  "stops": [
   "\"Nw\"@0",
   "\"Nw\"@0->cms-line@0[-]",
   "\"Nw\"@0->\"Q0w\"@3",
   "\"Nw\"@0->\"Q0w\"@2",
   "\"Nw\"@0->\"Q0w\"@1",
   "\"Nw\"@0->\"Q0w\"@0",
   "\"Nw\"@0->\"Pw\"@2",
   "\"Nw\"@0->\"Pw\"@1",
   "\"Nw\"@0->\"Pw\"@0",
   "\"Nw\"@0->\"Pw\"@0",
   "\"Nw\"@0->\"Pw\"@0"
  ],
  "k": "<ul><li>kNw</li></ul>"
 },
 "F3-RQR-back": {
  "stops": [
   "\"נו\"@0",
   "\"נו\"@0->cms-line@0[-]",
   "\"נו\"@0->\"קדה\"@3",
   "\"נו\"@0->\"קדה\"@2",
   "\"נו\"@0->\"קדה\"@1",
   "\"נו\"@0->\"קדה\"@0",
   "\"נו\"@0->cms-line@0[-]",
   "\"נו\"@0->\"פא\"@2",
   "\"נו\"@0->\"פא\"@1",
   "\"נו\"@0->\"פא\"@0",
   "\"נו\"@0->\"פא\"@0"
  ],
  "k": "<ul><li>kנו</li></ul>"
 },
 "F3-RQR-fwd": {
  "stops": [
   "\"פא\"@2",
   "\"פא\"@2->cms-line@0[-]",
   "\"פא\"@2->\"קדה\"@0",
   "\"פא\"@2->\"קדה\"@1",
   "\"פא\"@2->\"קדה\"@2",
   "\"פא\"@2->\"קדה\"@3",
   "\"פא\"@2->cms-line@0[-]",
   "\"פא\"@2->\"נו\"@0",
   "\"פא\"@2->\"נו\"@1",
   "\"פא\"@2->\"נו\"@2",
   "\"פא\"@2->\"נו\"@2"
  ],
  "k": "<ul><li>פאk</li></ul>"
 },
 "F3-RQR-ltr-fwd": {
  "stops": [
   "\"Pw\"@2",
   "\"Pw\"@2->cms-line@0[-]",
   "\"Pw\"@2->\"Q1w\"@0",
   "\"Pw\"@2->\"Q1w\"@1",
   "\"Pw\"@2->\"Q1w\"@2",
   "\"Pw\"@2->\"Q1w\"@3",
   "\"Pw\"@2->cms-line@0[-]",
   "\"Pw\"@2->\"Nw\"@0",
   "\"Pw\"@2->\"Nw\"@1",
   "\"Pw\"@2->\"Nw\"@2",
   "\"Pw\"@2->\"Nw\"@2"
  ],
  "k": "<ul><li>Pwk</li></ul>"
 },
 "F3-TQR-back": {
  "stops": [
   "\"נו\"@0",
   "\"נו\"@0->cms-line@0[-]",
   "\"נו\"@0->\"קדה\"@3",
   "\"נו\"@0->\"קדה\"@2",
   "\"נו\"@0->\"קדה\"@1",
   "\"נו\"@0->\"קדה\"@0",
   "\"נו\"@0->\"תאב\"@3",
   "\"נו\"@0->\"תאב\"@2",
   "\"נו\"@0->\"תאב\"@1",
   "\"נו\"@0->\"תאב\"@0",
   "\"נו\"@0->\"פא\"@2"
  ],
  "k": "<ul><li>פאkנו</li></ul>"
 },
 "F4-QRTrtl": {
  "stops": [
   "\"Pw\"@2",
   "\"Q0w\"@0",
   "\"Q0w\"@1",
   "\"Q0w\"@2",
   "\"Q0w\"@3",
   "node:horizontalrule",
   "\"תגד\"@0",
   "node:horizontalrule",
   "\"תגד\"@0",
   "node:horizontalrule",
   "\"תגד\"@0"
  ],
  "k": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><hr />kתגד</li><li>Nw</li></ul>"
 },
 "F4-TRQrtl": {
  "stops": [
   "\"Pw\"@2",
   "\"T0w\"@0",
   "\"T0w\"@1",
   "\"T0w\"@2",
   "\"T0w\"@3",
   "node:horizontalrule",
   "quote@0[paragraph]",
   "node:horizontalrule",
   "quote@0[paragraph]",
   "node:horizontalrule",
   "quote@0[paragraph]"
  ],
  "k": "<ul><li>Pw</li><li>T0w<hr /><blockquote><p>kקבג</p></blockquote></li><li>Nw</li></ul>"
 },
 "F4-TRQrtl-back": {
  "stops": [
   "\"Nw\"@0",
   "\"קבג\"@3",
   "\"Nw\"@0",
   "\"קבג\"@3",
   "\"Nw\"@0",
   "\"קבג\"@3",
   "\"Nw\"@0",
   "\"קבג\"@3",
   "\"Nw\"@0",
   "\"קבג\"@3",
   "\"Nw\"@0"
  ],
  "k": "<ul><li>Pw</li><li>T0w<hr /><blockquote><p>קבג</p></blockquote></li><li>kNw</li></ul>"
 },
 "F4-rtlRrtl": {
  "stops": [
   "\"פא\"@2",
   "\"תאב\"@0",
   "\"תאב\"@1",
   "\"תאב\"@2",
   "\"תאב\"@3",
   "node:horizontalrule",
   "quote@0[paragraph]",
   "\"קבג\"@1",
   "\"קבג\"@2",
   "\"קבג\"@3",
   "\"נו\"@0"
  ],
  "k": "<ul><li>פא</li><li>תאב<hr /><blockquote><p>קבג</p></blockquote></li><li>kנו</li></ul>"
 }
};
for (const [id, html, word, off, key] of WALKS) test(id, async () => {
  const onChange = await renderField(html);
  await clickInWord(word, off);
  const stops = [walkSel()];
  for (let i = 0; i < 10; i++) { await userEvent.keyboard(key); await settle(); stops.push(walkSel()); }
  await userEvent.keyboard("k"); await settle();
  expect({ stops, k: onChange.mock.calls.length ? sanitizeRichTextHtml(lastHtml(onChange)) : "NOOP" }).toEqual(WALK_STOPS[id]);
}, 60_000);

// 15.5, 15.6: a heading that holds only an image, between two lines: the
// word forms at the lines' edges do what the character forms do, as with
// the heading holding a word (the twin)
const IMAGE_HEADING: Record<string, { w: string; k: string }> = {
 "image bs": {
  "w": "<ul><li>Pw</li><li>T0w<h3><img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />T2w</h3></li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0w<h3><img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />kT2w</h3></li><li>Nw</li></ul>"
 },
 "image del": {
  "w": "<ul><li>Pw</li><li>T0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0wk<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />T2w</li><li>Nw</li></ul>"
 },
 "image wordBs": {
  "w": "<ul><li>Pw</li><li>T0w<h3><img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />T2w</h3></li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0w<h3><img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />kT2w</h3></li><li>Nw</li></ul>"
 },
 "image wordDel": {
  "w": "<ul><li>Pw</li><li>T0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0wk<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br />T2w</li><li>Nw</li></ul>"
 },
 "twin bs": {
  "w": "<ul><li>Pw</li><li>T0w<h3>X1wT2w</h3></li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0w<h3>X1wkT2w</h3></li><li>Nw</li></ul>"
 },
 "twin del": {
  "w": "<ul><li>Pw</li><li>T0wX1w<br />T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0wkX1w<br />T2w</li><li>Nw</li></ul>"
 },
 "twin wordBs": {
  "w": "<ul><li>Pw</li><li>T0w<h3>X1wT2w</h3></li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0w<h3>X1wkT2w</h3></li><li>Nw</li></ul>"
 },
 "twin wordDel": {
  "w": "<ul><li>Pw</li><li>T0wX1w<br />T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0wkX1w<br />T2w</li><li>Nw</li></ul>"
 }
};
const HEADING_IMG = '<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />';
for (const [shape, block] of [["image", `<h3>${HEADING_IMG}</h3>`], ["twin", "<h3>X1w</h3>"]] as const) for (const [act, word, off, key] of [
  ["bs", "T2w", 0, "{Backspace}"],
  ["wordBs", "T2w", 0, "{Control>}{Backspace}{/Control}"],
  ["wordDel", "T0w", 3, "{Control>}{Delete}{/Control}"],
  ["del", "T0w", 3, "{Delete}"],
] as const) {
  const id = `${shape} ${act}`;
  test(`a heading of ${shape === "image" ? "only an image" : "a word"}: ${act}`, async () => {
    const onChange = await renderField(LI(`T0w${block}T2w`));
    await clickInWord(word, off);
    await userEvent.keyboard(key); await settle();
    const w = onChange.mock.calls.length ? sanitizeRichTextHtml(lastHtml(onChange)) : "NOOP";
    await userEvent.keyboard("k"); await settle();
    expect({ w, k: sanitizeRichTextHtml(lastHtml(onChange)) }).toEqual(IMAGE_HEADING[id]);
  }, 30_000);
}

// 15.7: Shift and a press on text while a node is selected: the caret where
// pressed, decided at the press, whichever of the page's selectionchange and
// the click comes first (the two orders forced)
const SC_IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const SC_LINK = `<a href="https://example.org/l">Lw</a>`;
const SC_SHAPES: Record<string, (node: string) => string> = {
  ordinary: (node) => `<p>Aw${SC_LINK}</p>${node.startsWith("<img") ? `<p>${node}</p>` : node}<p>Cw</p>`,
  lined: (node) => `<ul><li>Aw${SC_LINK}${node}Cw</li></ul>`,
};
const scNodeSelected = () => editorOf()!.getEditorState().read(() => $isNodeSelection($getSelection()));
const selectByArrow = async () => { await clickInWord("Cw", 0); for (let i = 0; i < 3 && !scNodeSelected(); i++) { await userEvent.keyboard("{ArrowLeft}"); await settle(); } };
const pointIn = (word: string, at: number) => {
  const span = [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find((e) => e.textContent === word)!;
  const range = document.createRange(); range.setStart(span.firstChild!, at); range.setEnd(span.firstChild!, at);
  const r = range.getBoundingClientRect(); const b = span.getBoundingClientRect();
  return { span, x: r.left, y: b.top + b.height / 2, node: span.firstChild!, at };
};
const N = 5;
for (const shape of Object.keys(SC_SHAPES)) for (const nodeName of ["rule", "image"]) for (const [word, at] of [["Aw", 1], ["Lw", 1], ["Cw", 1]] as const) {
  test(`15.7 Shift+press after a node selection, repeated: ${shape} ${nodeName} ${word}`, async () => {
    const results: string[] = [];
    for (let rep = 0; rep < N; rep++) {
      const html = SC_SHAPES[shape](nodeName === "rule" ? "<hr>" : SC_IMG);
      const onChange = await renderField(html);
      await selectByArrow();
      const sel0 = scNodeSelected();
      await userEvent.keyboard("{Shift>}");
      await clickInWord(word, at);
      await userEvent.keyboard("{/Shift}"); await settle();
      await userEvent.keyboard("k"); await settle();
      results.push(`${sel0}|${sanitizeRichTextHtml(lastHtml(onChange))}`);
      unmountField();
    }
    const want = `true|${sanitizeRichTextHtml(SC_SHAPES[shape](nodeName === "rule" ? "<hr>" : SC_IMG).replace(`>${word}<`, `>${word[0]}k${word[1]}<`))}`;
    expect(results).toEqual(Array(N).fill(want));
  }, 300_000);
  for (const order of ["selectionchange-first", "click-first"]) test(`15.7 Shift+press after a node selection, ${order} ${shape} ${nodeName} ${word}`, async () => {
    const html = SC_SHAPES[shape](nodeName === "rule" ? "<hr>" : SC_IMG);
    const onChange = await renderField(html);
    await selectByArrow();
    const sel0 = scNodeSelected();
    const p = pointIn(word, at);
    const opts = { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, shiftKey: true, button: 0 };
    await act(async () => {
      p.span.dispatchEvent(new PointerEvent("pointerdown", { ...opts, pointerType: "mouse" }));
      const down = new MouseEvent("mousedown", opts);
      p.span.dispatchEvent(down);
      // the page's extension from its anchor (the content's first text) to the point
      const extend = () => { const dom = window.getSelection()!; const first = editable()!.querySelector("[data-lexical-text]")!.firstChild!; dom.setBaseAndExtent(first, 0, p.node, p.at); };
      if (order === "selectionchange-first") {
        if (!down.defaultPrevented) extend();
        await new Promise((r) => setTimeout(r, 20));
        p.span.dispatchEvent(new MouseEvent("mouseup", opts));
        p.span.dispatchEvent(new MouseEvent("click", opts));
      } else {
        p.span.dispatchEvent(new MouseEvent("mouseup", opts));
        p.span.dispatchEvent(new MouseEvent("click", opts));
        if (!down.defaultPrevented) extend();
        await new Promise((r) => setTimeout(r, 20));
      }
    });
    await settle();
    await userEvent.keyboard("k"); await settle();
    expect(`${sel0}|${sanitizeRichTextHtml(lastHtml(onChange))}`).toBe(`true|${sanitizeRichTextHtml(html.replace(`>${word}<`, `>${word[0]}k${word[1]}<`))}`);
  }, 60_000);
}

const all = (): LexicalNode[] => {
  const out: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    out.push(node);
    if ($isElementNode(node)) node.getChildren().forEach(walk);
  };
  walk($getRoot());
  return out;
};

// 15.8: Divider at any caret in a quote, heading or code block of a lined
// item splits up to the root at the caret, nothing empty left; between a
// quote's paragraphs the quote splits there; a caret after an image that
// ends a quote is the quote's end (A1)
const DIV_IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const DIVIDER_CELLS: [string, string, () => Promise<void>][] = [
  ["QQ at Q0w end", LI("<blockquote><p>Q0w</p><p>Q1w</p></blockquote>T2w"), () => clickInWord("Q0w")],
  ["QQ at Q1w start", LI("<blockquote><p>Q0w</p><p>Q1w</p></blockquote>T2w"), () => clickInWord("Q1w", 0)],
  ["QQ mid Q0w", LI("<blockquote><p>Q0w</p><p>Q1w</p></blockquote>T2w"), () => clickInWord("Q0w", 1)],
  ["Q at end", LI("<blockquote><p>Q0w</p></blockquote>T1w"), () => clickInWord("Q0w")],
  ["Q at start", LI("T0w<blockquote><p>Q1w</p></blockquote>"), () => clickInWord("Q1w", 0)],
  ["H mid", LI("T0w<h3>H1w</h3>T2w"), () => clickInWord("H1w", 1)],
  ["Q image end", LI(`<blockquote><p>Q0w${DIV_IMG}</p></blockquote>T1w`), async () => { await click(editable()); await act(async () => { editorOf()!.update(() => { const img = all().find((n) => n.getType() === "cms-image")!; const r = $createRangeSelection(); const p = img.getParentOrThrow(); r.anchor.set(p.getKey(), p.getChildrenSize(), "element"); r.focus.set(p.getKey(), p.getChildrenSize(), "element"); $setSelection(r); }); }); await settle(); }],
  ["QQ image end of first", LI(`<blockquote><p>Q0w${DIV_IMG}</p><p>Q1w</p></blockquote>T2w`), async () => { await click(editable()); await act(async () => { editorOf()!.update(() => { const img = all().find((n) => n.getType() === "cms-image")!; const r = $createRangeSelection(); const p = img.getParentOrThrow(); r.anchor.set(p.getKey(), p.getChildrenSize(), "element"); r.focus.set(p.getKey(), p.getChildrenSize(), "element"); $setSelection(r); }); }); await settle(); }],
];
const DIVIDER_WRITES: Record<string, { w: string; k: string }> = {
 "H mid": {
  "w": "<ul><li>Pw</li><li>T0w<h3>H</h3></li></ul><hr /><ul><li><h3>1w</h3>T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0w<h3>H</h3></li></ul><hr /><ul><li><h3>k1w</h3>T2w</li><li>Nw</li></ul>"
 },
 "Q at end": {
  "w": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li>T1w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li>kT1w</li><li>Nw</li></ul>"
 },
 "Q at start": {
  "w": "<ul><li>Pw</li><li>T0w</li></ul><hr /><ul><li><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li>T0w</li></ul><hr /><ul><li><blockquote><p>kQ1w</p></blockquote></li><li>Nw</li></ul>"
 },
 "Q image end": {
  "w": "<ul><li>Pw</li><li><blockquote><p>Q0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p></blockquote></li></ul><hr /><ul><li>T1w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li><blockquote><p>Q0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p></blockquote></li></ul><hr /><ul><li>kT1w</li><li>Nw</li></ul>"
 },
 "QQ at Q0w end": {
  "w": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li><blockquote><p>kQ1w</p></blockquote>T2w</li><li>Nw</li></ul>"
 },
 "QQ at Q1w start": {
  "w": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li></ul><hr /><ul><li><blockquote><p>kQ1w</p></blockquote>T2w</li><li>Nw</li></ul>"
 },
 "QQ image end of first": {
  "w": "<ul><li>Pw</li><li><blockquote><p>Q0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p></blockquote></li></ul><hr /><ul><li><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li><blockquote><p>Q0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p></blockquote></li></ul><hr /><ul><li><blockquote><p>kQ1w</p></blockquote>T2w</li><li>Nw</li></ul>"
 },
 "QQ mid Q0w": {
  "w": "<ul><li>Pw</li><li><blockquote><p>Q</p></blockquote></li></ul><hr /><ul><li><blockquote><p>0w</p><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>",
  "k": "<ul><li>Pw</li><li><blockquote><p>Q</p></blockquote></li></ul><hr /><ul><li><blockquote><p>k0w</p><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>"
 }
};
for (const [id, html, place] of DIVIDER_CELLS) test(`15.8 Divider: ${id}`, async () => {
  const onChange = await renderField(html);
  await place();
  await click(byLabel("Divider")); await settle();
  const w = onChange.mock.calls.length ? sanitizeRichTextHtml(lastHtml(onChange)) : "NOOP";
  await userEvent.keyboard("k"); await settle();
  expect({ w, k: sanitizeRichTextHtml(lastHtml(onChange)) }).toEqual(DIVIDER_WRITES[id]);
}, 30_000);

// 15.12: a key handled from its keydown (an arrow, Backspace, Delete, Enter)
// at a caret in text starts from the page's caret: the page's step read back
// first, or the key first, the write is the same
type KeyCell = [string, string, string, number, "Right" | "Down" | "Up", string];
const KEY_CELLS: KeyCell[] = [
  ["ord Abcw Right Backspace", "<p>Abcw</p>", "Abcw", 1, "Right", "Backspace"],
  ["ord Abcw Right Delete", "<p>Abcw</p>", "Abcw", 1, "Right", "Delete"],
  ["ord Abcw Right Enter", "<p>Abcw</p>", "Abcw", 1, "Right", "Enter"],
  ["lined HB Right Delete", LI("<h3>Bw</h3><br>"), "Bw", 1, "Right", "Delete"],
  ["lined HB Right Enter", LI("<h3>Bw</h3><br>"), "Bw", 1, "Right", "Enter"],
  ["ord heading Right Enter", "<h3>Bw</h3><p>Cw</p>", "Bw", 1, "Right", "Enter"],
  ["ord two lines Down Backspace", "<p>A0w</p><p>B1w</p>", "A0w", 3, "Down", "Backspace"],
  ["ord two lines Up Backspace", "<p>A0w</p><p>B1w</p>", "B1w", 3, "Up", "Backspace"],
  ["lined two lines Down Backspace", LI("T0w<br>T1w"), "T0w", 3, "Down", "Backspace"],
  ["lined two lines Up Backspace", LI("T0w<br>T1w"), "T1w", 3, "Up", "Backspace"],
];
const placeIn = async (word: string, at: number) => {
  const span = [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find((e) => e.textContent === word)!;
  await userEvent.click(span); await settle();
  await act(async () => { editorOf()!.update(() => { const t = all().find((nd) => $isTextNode(nd) && nd.getTextContent() === word)!; (t as unknown as { select: (a: number, b: number) => void }).select(at, at); }); });
  await settle();
};
const writeOf = (onChange: Parameters<typeof lastHtml>[0]) => (onChange.mock.calls.length ? sanitizeRichTextHtml(lastHtml(onChange)) : "NOOP");
const modifyFor = { Right: ["forward", "character"], Down: ["forward", "line"], Up: ["backward", "line"] } as const;
const KEY_WRITES: Record<string, string> = {
 "lined HB Right Delete": "<ul><li>Pw</li><li><h3>Bw</h3></li><li>Nw</li></ul>",
 "lined HB Right Enter": "<ul><li>Pw</li><li><h3>Bw</h3><br /><br /></li><li>Nw</li></ul>",
 "lined two lines Down Backspace": "<ul><li>Pw</li><li>T0w<br />T1</li><li>Nw</li></ul>",
 "lined two lines Up Backspace": "<ul><li>Pw</li><li>T0<br />T1w</li><li>Nw</li></ul>",
 "ord Abcw Right Backspace": "<p>Acw</p>",
 "ord Abcw Right Delete": "<p>Abw</p>",
 "ord Abcw Right Enter": "<p>Ab</p><p>cw</p>",
 "ord heading Right Enter": "<h3>Bw</h3><p></p><p>Cw</p>",
 "ord two lines Down Backspace": "<p>A0w</p><p>B1</p>",
 "ord two lines Up Backspace": "<p>A0</p><p>B1w</p>"
};
for (const [id, html, word, at, step, key] of KEY_CELLS) for (const order of ["keydownFirst", "readbackFirst"]) test(`15.12 ${id}, ${order}`, async () => {
  const onChange = await renderField(html);
  await placeIn(word, at);
  await act(async () => {
    const [dir, gran] = modifyFor[step];
    (window.getSelection() as unknown as { modify: (a: string, b: string, c: string) => void }).modify("move", dir, gran);
    if (order === "readbackFirst") await new Promise((r) => setTimeout(r, 30));
    editable()!.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true }));
  });
  await settle();
  expect(writeOf(onChange)).toBe(KEY_WRITES[id]);
}, 30_000);

// 15.12: the step runs only when the page has moved since the field last
// wrote or read the selection. Where the page's read-back differs from the
// field's caret without a page move, the key starts from the field's caret.
const selText = (sel: BaseSelection | null) => {
  if ($isRangeSelection(sel) === false) return String(sel);
  return `${ptOf(sel.anchor)}->${ptOf(sel.focus)} format=${sel.format}`;
};
const watchStep = () => {
  const ed = editorOf()!;
  const seen: { before: string; atKey: string; page: string }[] = [];
  const unregister = ed.registerCommand(KEY_DOWN_COMMAND, () => {
    const dom = window.getSelection();
    const page = dom === null ? null : $createRangeSelectionFromDom(dom, ed);
    seen.push({
      before: ed.getEditorState().read(() => selText($getSelection())),
      atKey: selText($getSelection()),
      page: page === null ? "null" : `${ptOf(page.anchor)}->${ptOf(page.focus)} format=${page.format}`,
    });
    return false;
  }, COMMAND_PRIORITY_CRITICAL);
  return { seen, unregister };
};
const NOT_MOVED_LINK = `<a href="https://example.org/l">Lw</a>`;
const NOT_MOVED_WRITES: Record<string, string> = {
  "link Enter": '<ul><li>Pw</li><li><br /><h3><a href="https://example.org/l">Lw</a>X0w</h3>T1w</li><li>Nw</li></ul>',
  "link Backspace": '<ul><li>Pw<a href="https://example.org/l">Lw</a>X0w</li><li>T1w</li><li>Nw</li></ul>',
  "pending format": "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2wx<b><strong>y</strong></b></li><li>Nw</li></ul>",
  "field focus": "<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>",
};
for (const key of ["Enter", "Backspace"]) test(`15.12 the page has not moved, the step does nothing: a text point at a link's start, ${key}`, async () => {
  const onChange = await renderField(LI(`<h3>${NOT_MOVED_LINK}X0w</h3>T1w`));
  await clickInWord("X0w", 1);
  await act(async () => { editorOf()!.update(() => { const heading = all().find((nd) => nd.getType() === "link")!.getParentOrThrow(); const r = $createRangeSelection(); r.anchor.set(heading.getKey(), 0, "element"); r.focus.set(heading.getKey(), 0, "element"); $setSelection(r); }); });
  await settle();
  const { seen, unregister } = watchStep();
  await userEvent.keyboard(`{${key}}`); await settle();
  unregister();
  expect(seen[0].atKey).toBe("heading@0[link]->heading@0[link] format=0");
  expect(seen[0].page).toBe('"Lw"@0->"Lw"@0 format=0');
  expect(seen[0].atKey).toBe(seen[0].before);
  expect(seen[0].page).not.toBe(seen[0].atKey);
  expect(writeOf(onChange)).toBe(NOT_MOVED_WRITES[`link ${key}`]);
}, 30_000);
test("15.12 the page has not moved, the step does nothing: a pending format", async () => {
  const onChange = await renderField(LI("T0w<blockquote><p>Q1w</p></blockquote>T2w"));
  await clickInWord("T2w"); await userEvent.keyboard("x"); await settle();
  await userEvent.keyboard("{Control>}b{/Control}"); await settle();
  const { seen, unregister } = watchStep();
  await userEvent.keyboard("y"); await settle();
  unregister();
  expect(seen[0].atKey).toMatch(/ format=1$/);
  expect(seen[0].atKey).toBe(seen[0].before);
  expect(seen[0].page).toMatch(/ format=0$/);
  expect(writeOf(onChange)).toBe(NOT_MOVED_WRITES["pending format"]);
}, 30_000);
test("15.12 the page has not moved, the step does nothing: a focus the field set", async () => {
  const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote><hr>T2w"));
  await clickInWord("Nw", 0);
  const focusIsQuote = () => editorOf()!.getEditorState().read(() => { const sel = $getSelection(); return $isRangeSelection(sel) && sel.focus.type === "element" && sel.focus.getNode().getType() === "quote"; });
  for (let i = 0; i < 10 && focusIsQuote() === false; i++) { await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}"); await settle(); }
  const { seen, unregister } = watchStep();
  await userEvent.keyboard("k"); await settle();
  unregister();
  expect(seen[0].atKey).toBe('"Nw"@0->quote@1[-] format=0');
  expect(seen[0].atKey).toBe(seen[0].before);
  expect(seen[0].page).toBe('"Nw"@0->"Q0w"@3 format=0');
  expect(writeOf(onChange)).toBe(NOT_MOVED_WRITES["field focus"]);
}, 30_000);

// 15.13: the field moves no content under a pointer that is down. While a
// press is in progress the point rule makes and removes no caret line; it
// runs when the press's own events are over
const mouse = (type: "mousePressed" | "mouseReleased" | "mouseMoved", x: number, y: number, buttons = type === "mousePressed" ? 1 : 0) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? (buttons ? "left" : "none") : "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1 });
const centre = (element: Element) => { const box = element.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; };
/** A press held for `ms` (0: released at once), at the element's centre or the given point. */
const hold = async (at: { x: number; y: number }, ms: number) => {
  await mouse("mousePressed", at.x, at.y);
  if (ms > 0) { await settle(); await wait(ms); }
  await mouse("mouseReleased", at.x, at.y);
  await settle();
};
const selectedElement = () => editorOf()!.getEditorState().read(() => { const s = $getSelection(); return $isNodeSelection(s) && s.getNodes().length === 1 ? editorOf()!.getElementByKey(s.getNodes()[0].getKey()) : null; });
const PRESS_RQR = LI("<hr><blockquote><p>Q1w</p></blockquote><hr>");
for (const ms of [0, 50, 200]) test(`15.13 RQR's first rule pressed for ${ms} ms, 20 times: the rule is selected every time`, async () => {
  let selected = 0;
  for (let run = 0; run < 20; run++) {
    const onChange = await renderField(PRESS_RQR);
    const rule = editable()!.querySelector("hr")!;
    await hold(centre(rule), ms);
    if (selectedElement() === rule && writeOf(onChange) === "NOOP") selected += 1;
    unmountField();
  }
  expect(selected).toBe(20);
}, 120_000);
const NESTED_RQ = "<ul><li>Pw<ul><li><hr><blockquote><p>Q1w</p></blockquote></li></ul></li><li>Nw</li></ul>";
const Q15 = (w: string) => `<blockquote><p>${w}</p></blockquote>`;
const PRESS_SHAPES: [string, string, number][] = [
  ["a rule first in an item, a quote after", LI(`<hr>${Q15("Q1w")}`), 0],
  ["RQR, the first rule", PRESS_RQR, 0],
  ["RQR, the last rule", PRESS_RQR, 1],
  ["two rules, the first", LI("<hr><hr>"), 0],
  ["two rules, the second (between two rules)", LI("<hr><hr>"), 1],
  ["a rule alone in an item", LI("<hr>"), 0],
  ["QRR, the first rule", LI(`${Q15("Q0w")}<hr><hr>`), 0],
  ["QRR, the second rule (between two rules)", LI(`${Q15("Q0w")}<hr><hr>`), 1],
  ["a rule last in an item, after text", LI("T0w<hr>"), 0],
  ["a rule last in an item, after a quote", LI(`${Q15("Q0w")}<hr>`), 0],
  ["depth two, a rule first in a nested item", NESTED_RQ, 0],
];
for (const [name, html, index] of PRESS_SHAPES) for (const ms of [0, 50, 200]) test(`15.13 a press of ${ms} ms on ${name}: the rule is selected, nothing moves`, async () => {
  const onChange = await renderField(html);
  const rule = editable()!.querySelectorAll("hr")[index];
  const before = rule.getBoundingClientRect().top;
  await mouse("mousePressed", centre(rule).x, centre(rule).y);
  await settle(); await wait(ms);
  // the pressed rule stays where it was while the pointer is down
  expect(rule.getBoundingClientRect().top).toBe(before);
  await mouse("mouseReleased", centre(rule).x, centre(rule).y);
  await settle();
  expect(selectedElement()).toBe(rule);
  expect(writeOf(onChange)).toBe("NOOP");
}, 30_000);
// the mirror: the caret in an empty caret line, then a press below it. The
// line the caret leaves stays while the pointer is down
const caretLineAt = async (index: number) => {
  await userEvent.click(editable()!.querySelector("[data-lexical-text]")!); await settle();
  await act(async () => { editorOf()!.update(() => { const item = all().filter((node) => node.getType() === "listitem")[1]; const range = $createRangeSelection(); range.anchor.set(item.getKey(), index, "element"); range.focus.set(item.getKey(), index, "element"); $setSelection(range); }); });
  await settle();
  expect(walkSel()).toBe("cms-line@0[-]");
};
const MIRROR_IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const MIRROR_LINK = `<a href="https://example.org/l">Lw</a>`;
const MIRROR: [string, string, number, "rule" | "image" | "link" | "text"][] = [
  ["at the start of a rule-led item: a rule below", LI(`<hr>${Q15("Q1w")}<hr>`), 0, "rule"],
  ["at the start of a rule-led item: an image below", LI(`<hr>${MIRROR_IMG}T2w`), 0, "image"],
  ["at the start of a rule-led item: a link below", LI(`<hr>${MIRROR_LINK}T2w`), 0, "link"],
  ["at the start of a rule-led item: text below", LI("<hr>Abcdefghw"), 0, "text"],
  ["between two rules: a rule below", LI(`<hr><hr>${Q15("Q2w")}<hr>`), 1, "rule"],
  ["between two rules: an image below", LI(`<hr><hr>${MIRROR_IMG}T3w`), 1, "image"],
  ["between two rules: a link below", LI(`<hr><hr>${MIRROR_LINK}T3w`), 1, "link"],
  ["between two rules: text below", LI("<hr><hr>Abcdefghw"), 1, "text"],
];
const emptyLines = () => editorOf()!.getEditorState().read(() => all().filter((node) => node.getType() === "cms-line" && $isElementNode(node) && node.isEmpty()).length);
const mirrorTarget = (target: "rule" | "image" | "link" | "text") => {
  const words = [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")];
  const element =
    target === "rule" ? [...editable()!.querySelectorAll("hr")].at(-1)!
      : target === "image" ? editable()!.querySelector("img")!
        : words.find((span) => span.textContent === (target === "link" ? "Lw" : "Abcdefghw"))!;
  const box = element.getBoundingClientRect();
  const at = target === "text" ? { x: box.left + box.width * 0.55, y: box.top + box.height / 2 } : centre(element);
  return { element, box, at };
};
/** The same press and key with no caret line in the field: the write a kept line must not change. */
const mirrorWithoutLine = async (html: string, target: "rule" | "image" | "link" | "text", textPoint: [string, number] | null, key: string) => {
  const onChange = await renderField(html);
  if (textPoint !== null) {
    await clickInWord(textPoint[0], textPoint[1]);
    await act(async () => { editorOf()!.update(() => { $getRoot().getAllTextNodes().find((t) => t.getTextContent() === textPoint[0])!.select(textPoint[1], textPoint[1]); }); });
    await settle();
  } else {
    const { at } = mirrorTarget(target);
    await hold(at, 50);
  }
  if (target === "image") { await userEvent.keyboard("{Escape}"); await settle(); }
  await userEvent.keyboard(key); await settle();
  const write = writeOf(onChange);
  unmountField();
  return write;
};
for (const [name, html, index, target] of MIRROR) for (const ms of [0, 50, 200]) for (const key of ["{ArrowLeft}", "k"]) test(`15.13 the caret in an empty caret line ${name}, pressed for ${ms} ms, then ${key === "k" ? "a letter" : "ArrowLeft"}`, async () => {
  const onChange = await renderField(html);
  await caretLineAt(index);
  const { element, box, at } = mirrorTarget(target);
  const under = document.caretRangeFromPoint(at.x, at.y);
  const want = target === "text" ? `"Abcdefghw"@${under?.startOffset}` : "";
  await mouse("mousePressed", at.x, at.y);
  await settle(); await wait(ms);
  expect(element.getBoundingClientRect().top).toBe(box.top);
  await mouse("mouseReleased", at.x, at.y);
  await settle();
  if (target === "rule") expect(selectedElement()).toBe(element);
  if (target === "image") {
    expect([...document.querySelectorAll("label")].some((label) => label.textContent === "Alt")).toBe(true);
    expect(editorOf()!.getEditorState().read(() => $getSelection())).toBeNull();
  }
  if (target === "link") expect(walkSel()).toBe('"Lw"@1');
  if (target === "text") expect(walkSel()).toBe(want);
  // the line is still there after the press, nothing has moved; it is gone
  // after the next key
  expect(emptyLines()).toBe(1);
  expect(element.getBoundingClientRect().top).toBe(box.top);
  expect(writeOf(onChange)).toBe("NOOP");
  const textPoint: [string, number] | null = target === "link" ? ["Lw", 1] : target === "text" ? ["Abcdefghw", under!.startOffset] : null;
  if (target === "image") { await userEvent.keyboard("{Escape}"); await settle(); }
  await userEvent.keyboard(key); await settle();
  expect(emptyLines()).toBe(0);
  const write = writeOf(onChange);
  unmountField();
  if (key === "k") expect(write).toBe(await mirrorWithoutLine(html, target, textPoint, key));
}, 30_000);
// a press on the item's padding beside its leading rule: the page caret on
// the item
const besideLeadingRule = () => {
  const rule = editable()!.querySelector("hr")!;
  const box = rule.getBoundingClientRect();
  return { x: box.left - 6, y: box.top + box.height / 2 };
};
const PADDING_WRITES: Record<string, unknown> = {
  // the range from the item's start to the pressed character; the letter
  // replaces it (the removal step's class)
  drag: { sel: '"kcdw"@1', w: "<ul><li>Pw</li><li>kcdw</li><li>Nw</li></ul>" },
  // the held step runs first: the letter lands in a line before the rule
  key: { during: { sel: '"k"@1', w: "<ul><li>Pw</li><li>k<hr />T1w</li><li>Nw</li></ul>" }, after: '"k"@1', w: "<ul><li>Pw</li><li>k<hr />T1w</li><li>Nw</li></ul>" },
};
test("15.13 a drag from the padding beside a leading rule into text below", async () => {
  const onChange = await renderField(LI("<hr>T1w<br>Tabcdw"));
  const from = besideLeadingRule();
  const word = [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find((span) => span.textContent === "Tabcdw")!;
  const box = word.getBoundingClientRect();
  const to = { x: box.left + box.width * 0.5, y: box.top + box.height / 2 };
  await mouse("mousePressed", from.x, from.y);
  await settle(); await wait(50);
  const top = word.getBoundingClientRect().top;
  for (const step of [0.25, 0.5, 0.75, 1]) {
    await mouse("mouseMoved", from.x + (to.x - from.x) * step, from.y + (to.y - from.y) * step, 1);
    await settle();
  }
  expect(word.getBoundingClientRect().top).toBe(top);
  await mouse("mouseReleased", to.x, to.y);
  await settle();
  await userEvent.keyboard("k"); await settle();
  expect({ sel: walkSel(), w: writeOf(onChange) }).toEqual(PADDING_WRITES.drag);
}, 30_000);
test("15.13 a key while the pointer is down on the padding beside a leading rule", async () => {
  const onChange = await renderField(LI("<hr>T1w"));
  const from = besideLeadingRule();
  await mouse("mousePressed", from.x, from.y);
  await settle(); await wait(50);
  await userEvent.keyboard("k"); await settle();
  const during = { sel: walkSel(), w: writeOf(onChange) };
  await mouse("mouseReleased", from.x, from.y);
  await settle();
  expect({ during, after: walkSel(), w: writeOf(onChange) }).toEqual(PADDING_WRITES.key);
}, 30_000);
// the hold cannot stick: each way a press ends with no click ends it, and
// the held step then runs (the caret on the item gets its line)
const ENDS: [string, () => Promise<void>][] = [
  ["a cancelled pointer", async () => { window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true })); }],
  ["a native drag's end", async () => { window.dispatchEvent(new DragEvent("dragend", { bubbles: true })); }],
  ["a drop", async () => { window.dispatchEvent(new DragEvent("drop", { bubbles: true })); }],
  ["a context menu", async () => { window.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })); }],
  ["the window's blur", async () => { window.dispatchEvent(new FocusEvent("blur")); }],
  ["a second pointer", async () => { editable()!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7, button: 0, pointerType: "touch" })); }],
  ["a release outside the window (a pointer seen with no button down)", async () => { window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, buttons: 0 })); }],
];
for (const [name, end] of ENDS) test(`15.13 the hold ends at ${name}`, async () => {
  const onChange = await renderField(LI("<hr>T1w"));
  const from = besideLeadingRule();
  await mouse("mousePressed", from.x, from.y);
  await settle(); await wait(50);
  expect(walkSel()).toBe("listitem@0[horizontalrule]");
  await act(end);
  await settle();
  expect(walkSel()).toBe("cms-line@0[-]");
  expect(writeOf(onChange)).toBe("NOOP");
  await mouse("mouseReleased", from.x, from.y);
  await settle();
}, 30_000);
test("15.13 the hold is the field's own: a press held in one field leaves another field's point rule running", async () => {
  await renderField(LI("<hr>T1w"));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(TooltipProvider, null, createElement(RichTextField, { id: "cms-field-second", labelId: "cms-field-second-label", value: { html: LI("<hr>T1w") }, onChange: vi.fn(), onOpenClassic: vi.fn() })));
  });
  await settle();
  const other = (container.querySelector('[contenteditable="true"]') as HTMLElement & { __lexicalEditor?: LexicalEditor }).__lexicalEditor!;
  const otherSel = () => other.getEditorState().read(() => { const sel = $getSelection(); return $isRangeSelection(sel) ? ptOf(sel.anchor) : String(sel); });
  try {
    const from = besideLeadingRule();
    await mouse("mousePressed", from.x, from.y);
    await settle(); await wait(50);
    expect(walkSel()).toBe("listitem@0[horizontalrule]");
    await act(async () => {
      other.update(() => { const item = $getRoot().getAllTextNodes().find((t) => t.getTextContent() === "T1w")!.getParentOrThrow().getParentOrThrow(); const range = $createRangeSelection(); range.anchor.set(item.getKey(), 0, "element"); range.focus.set(item.getKey(), 0, "element"); $setSelection(range); });
    });
    await settle();
    expect(otherSel()).toBe("cms-line@0[-]");
    expect(walkSel()).toBe("listitem@0[horizontalrule]");
    await mouse("mouseReleased", from.x, from.y);
    await settle();
    expect(walkSel()).toBe("cms-line@0[-]");
  } finally {
    act(() => root.unmount());
    container.remove();
  }
}, 30_000);

// 15.13 (a): a caret line the caret left by a press is not removed by that
// press; it goes at the next key in the field, or before the next edit or
// clipboard command. A double click's second press lands where its first
// did
const wordAt = (text: string, word: string) => {
  const span = [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find((element) => element.textContent === text)!;
  const node = span.firstChild!;
  const start = text.indexOf(word);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + word.length);
  const box = range.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2, left: box.left + 1, right: box.right - 1 };
};
/** Presses with a real gap between them, one click sequence. */
const clicks = async (at: { x: number; y: number }, count: number, gap = 150) => {
  for (let n = 1; n <= count; n++) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", buttons: 1, clickCount: n });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", buttons: 0, clickCount: n });
    await settle();
    if (n < count) await wait(gap);
  }
  await settle();
};
const KEPT_SHAPES: [string, string, number][] = [
  ["at the start of a rule-led item", LI("<hr>Aw Bw Cw<br>Dw"), 0],
  ["between two rules", LI("<hr><hr>Aw Bw Cw<br>Dw"), 1],
];
for (const [name, html, index] of KEPT_SHAPES) {
  test(`15.13 (a) the caret in an empty caret line ${name}: a double click with a 150 ms gap on the word below selects the pressed word, 20 times`, async () => {
    let pressed = 0;
    for (let run = 0; run < 20; run++) {
      await renderField(html);
      await caretLineAt(index);
      await clicks(wordAt("Aw Bw Cw", "Bw"), 2);
      if (window.getSelection()?.toString() === "Bw" && walkSel() === '"Aw Bw Cw"@3->"Aw Bw Cw"@5') pressed += 1;
      unmountField();
    }
    expect(pressed).toBe(20);
  }, 120_000);
  test(`15.13 (a) the caret in an empty caret line ${name}: a triple click with 150 ms gaps selects the pressed line, as with no caret line`, async () => {
    const run = async (withLine: boolean) => {
      await renderField(html);
      if (withLine) await caretLineAt(index);
      await clicks(wordAt("Aw Bw Cw", "Bw"), 3);
      const out = { page: window.getSelection()?.toString(), sel: walkSel() };
      unmountField();
      return out;
    };
    expect(await run(true)).toEqual(await run(false));
  }, 30_000);
  test(`15.13 (a) the caret in an empty caret line ${name}: a double click with a 150 ms gap on a link's text below selects its word`, async () => {
    await renderField(html.replace("Aw Bw Cw", 'Aw <a href="https://example.org/l">Lw</a> Cw'));
    await caretLineAt(index);
    await clicks(wordAt("Lw", "Lw"), 2);
    expect(window.getSelection()?.toString()).toBe("Lw");
  }, 30_000);
  test(`15.13 (a) the caret in an empty caret line ${name}: a press and drag across a word below selects what it crossed, as with no caret line`, async () => {
    const run = async (withLine: boolean) => {
      await renderField(html);
      if (withLine) await caretLineAt(index);
      const from = wordAt("Aw Bw Cw", "Aw");
      const to = wordAt("Aw Bw Cw", "Cw");
      await mouse("mousePressed", from.left, from.y);
      await settle(); await wait(50);
      for (const step of [0.5, 1]) { await mouse("mouseMoved", from.left + (to.right - from.left) * step, from.y, 1); await settle(); }
      await mouse("mouseReleased", to.right, to.y);
      await settle();
      const out = { page: window.getSelection()?.toString(), sel: walkSel(), lines: emptyLines() };
      unmountField();
      return out;
    };
    const kept = await run(true);
    const plain = await run(false);
    expect({ page: kept.page, sel: kept.sel }).toEqual({ page: plain.page, sel: plain.sel });
    expect(kept.lines).toBe(1);
  }, 30_000);
  test(`15.13 (a) the caret in an empty caret line ${name}: an arrow walk after a press into the text below stops where it stops with no caret line`, async () => {
    const walk = async (withLine: boolean) => {
      await renderField(html);
      if (withLine) {
        await caretLineAt(index);
        await clicks(wordAt("Aw Bw Cw", "Bw"), 1);
        expect(emptyLines()).toBe(1);
      } else {
        await clickInWord("Aw Bw Cw", 0);
      }
      await act(async () => { editorOf()!.update(() => { $getRoot().getAllTextNodes().find((t) => t.getTextContent() === "Aw Bw Cw")!.select(4, 4); }); });
      await settle();
      const stops: string[] = [];
      for (const key of ["{ArrowUp}", "{ArrowUp}", "{ArrowDown}", "{ArrowLeft}", "{ArrowLeft}", "{ArrowLeft}", "{ArrowLeft}", "{ArrowLeft}"]) { await userEvent.keyboard(key); await settle(); stops.push(walkSel()); }
      unmountField();
      return stops;
    };
    expect(await walk(true)).toEqual(await walk(false));
  }, 30_000);
}
/** A press into "T2w" below, with the caret first in an empty caret line at the item's start: one kept line. */
const KEPT_EDIT = LI("<hr>Aw T2w");
const keepOne = async () => {
  await caretLineAt(0);
  await clicks(wordAt("Aw T2w", "T2w"), 1);
  expect(emptyLines()).toBe(1);
};
const placeAt = async (word: string, from: number, to: number) => {
  await act(async () => { editorOf()!.update(() => { const text = $getRoot().getAllTextNodes().find((t) => t.getTextContent() === word)!; text.select(from, to); }); });
  await settle();
};
const KEPT_EDITS: [string, () => Promise<void>][] = [
  ["Divider", async () => { await placeAt("Aw T2w", 4, 4); await click(byLabel("Divider")); }],
  ["Bold", async () => { await placeAt("Aw T2w", 3, 6); await click(byLabel("Bold")); }],
  ["a menu paste", async () => { await placeAt("Aw T2w", 4, 4); const data = new DataTransfer(); data.setData("text/plain", "Zq"); await act(async () => { editable()!.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data })); }); await settle(); }],
  ["a menu cut", async () => { await placeAt("Aw T2w", 3, 6); await act(async () => { editable()!.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: new DataTransfer() })); }); await settle(); }],
];
for (const [name, edit] of KEPT_EDITS) test(`15.13 (a) ${name} with a kept line elsewhere writes what it writes with no kept line`, async () => {
  const run = async (withLine: boolean) => {
    const onChange = await renderField(KEPT_EDIT);
    if (withLine) await keepOne(); else await clickInWord("Aw T2w", 4);
    await edit();
    const out = { w: writeOf(onChange), lines: emptyLines() };
    unmountField();
    return out;
  };
  const kept = await run(true);
  expect(kept).toEqual(await run(false));
  expect(kept.lines).toBe(0);
}, 30_000);
test("15.13 (a) Image with a kept line elsewhere writes what it writes with no kept line", async () => {
  const run = async (withLine: boolean) => {
    const source = { uploadImage: vi.fn(async () => ({ url: "https://cdn.example.org/y.png", path: "org/y.png" })) } as never;
    const onChange = await renderField(KEPT_EDIT, { source });
    if (withLine) await keepOne(); else await clickInWord("Aw T2w", 4);
    await placeAt("Aw T2w", 4, 4);
    const canvas = document.createElement("canvas");
    canvas.width = 2; canvas.height = 3;
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((result) => resolve(result!), "image/png"));
    await click(byLabel("Image"));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "a.png", { type: "image/png" }));
    await act(async () => { input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true })); });
    for (let round = 0; round < 200 && writeOf(onChange).includes("y.png") === false; round += 1) await settle();
    const out = { w: writeOf(onChange), lines: emptyLines() };
    unmountField();
    return out;
  };
  const kept = await run(true);
  expect(kept).toEqual(await run(false));
  expect(kept.w).toContain("y.png");
}, 60_000);
test("15.13 (a) a copy of a range dragged across a kept line holds no more than with no kept line", async () => {
  const html = LI("T0w<hr><hr>T3w");
  const run = async (withLine: boolean) => {
    await renderField(html);
    if (withLine) {
      await caretLineAt(2);
      await clicks(wordAt("T3w", "T3w"), 1);
      expect(emptyLines()).toBe(1);
    }
    const from = wordAt("T0w", "T0w");
    const to = wordAt("T3w", "T3w");
    await mouse("mousePressed", from.x, from.y);
    await settle(); await wait(50);
    for (const step of [0.5, 1]) { await mouse("mouseMoved", from.x + (to.x - from.x) * step, from.y + (to.y - from.y) * step, 1); await settle(); }
    await mouse("mouseReleased", to.x, to.y);
    await settle();
    const data = new DataTransfer();
    await act(async () => { editable()!.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: data })); });
    await settle();
    const out = { plain: data.getData("text/plain"), html: data.getData("text/html").replace(/ class="[^"]*"/g, ""), sel: walkSel() };
    unmountField();
    return out;
  };
  const kept = await run(true);
  const plain = await run(false);
  expect(kept).toEqual(plain);
}, 30_000);
test("15.13 (a) two kept lines, then one key: both go", async () => {
  await renderField("<ul><li>Pw</li><li><hr>T1w</li><li><hr>T2w</li><li>Nw</li></ul>");
  await caretLineAt(0);
  const second = editable()!.querySelectorAll("hr")[1].getBoundingClientRect();
  await clicks({ x: second.left - 6, y: second.top + second.height / 2 }, 1);
  await clicks(wordAt("T2w", "T2w"), 1);
  expect(emptyLines()).toBe(2);
  await userEvent.keyboard("{ArrowLeft}"); await settle();
  expect(emptyLines()).toBe(0);
}, 30_000);
test("15.13 (a) a button below the field, pressed with the caret in a caret line, does not move during its press", async () => {
  await renderField(LI("<hr>T1w"));
  const button = document.createElement("button");
  button.textContent = "Below";
  editable()!.closest("div")!.parentElement!.insertAdjacentElement("afterend", button);
  try {
    await caretLineAt(0);
    const top = button.getBoundingClientRect().top;
    const at = centre(button);
    await mouse("mousePressed", at.x, at.y);
    await settle(); await wait(50);
    expect(button.getBoundingClientRect().top).toBe(top);
    await mouse("mouseReleased", at.x, at.y);
    await settle();
    expect(button.getBoundingClientRect().top).toBe(top);
  } finally {
    button.remove();
  }
}, 30_000);


// 15.10: a range whose last point rests on the root, a list or a quote
// directly after a nested block holds what the range ending at the block's
// content end holds. The oracle is the same input one press earlier; where
// the range holds nothing (x1) Backspace, Delete, their word forms and cut
// remove nothing, and a letter, Enter and paste act at that caret
type R10At = { text: string; at: number } | { el: string; nth: number; at: number };
type R10Shape = { id: string; html: string; anchor: R10At; holder: { el: string; nth: number }; index: number; real: boolean };
const IMG = MIRROR_IMG;
const R10: R10Shape[] = [
  { id: "q R p", html: "<blockquote><p>Pw</p></blockquote><hr><p>Nw</p>", anchor: { text: "Pw", at: 2 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
  { id: "q R end", html: "<blockquote><p>Pw</p></blockquote><hr>", anchor: { text: "Pw", at: 2 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
  { id: "q R q", html: "<blockquote><p>Pw</p></blockquote><hr><blockquote><p>Nw</p></blockquote>", anchor: { text: "Pw", at: 2 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
  { id: "l R p", html: "<ul><li>Pw</li></ul><hr><p>Nw</p>", anchor: { text: "Pw", at: 2 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
  { id: "l2 R p", html: "<ul><li>Aw<ul><li>Pw</li></ul></li></ul><hr><p>Nw</p>", anchor: { text: "Pw", at: 2 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
  { id: "q-img R p", html: `<blockquote><p>Pw${IMG}</p></blockquote><hr><p>Nw</p>`, anchor: { el: "paragraph", nth: 0, at: 2 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
  { id: "q-link R p", html: `<blockquote><p>Pw<a href="https://example.org/l">Lw</a></p></blockquote><hr><p>Nw</p>`, anchor: { text: "Lw", at: 2 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
  { id: "q-br R p", html: `<blockquote><p>Pw<br><br></p></blockquote><hr><p>Nw</p>`, anchor: { el: "paragraph", nth: 0, at: 3 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
  { id: "text-back q R p", html: "<p>Aw</p><blockquote><p>Pw</p></blockquote><hr><p>Nw</p>", anchor: { text: "Aw", at: 1 }, holder: { el: "root", nth: 0 }, index: 2, real: false },
  { id: "text-back in q R p", html: "<blockquote><p>Pw</p></blockquote><hr><p>Nw</p>", anchor: { text: "Pw", at: 1 }, holder: { el: "root", nth: 0 }, index: 1, real: true },
];
const R10_ENTRY = ["k", "Backspace", "Delete", "CtrlBackspace", "CtrlDelete", "Enter", "ShiftEnter", "paste", "cut", "copy"] as const;
const R10_PINS: Record<string, { w: string; clip: string }> = {
 "l2 R p | k": {
  "w": "<ul><li>Aw<ul><li>Pwk</li></ul></li></ul><hr /><p>Nw</p>",
  "clip": "-"
 },
 "l2 R p | Backspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "l2 R p | Delete": {
  "w": "NOOP",
  "clip": "-"
 },
 "l2 R p | CtrlBackspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "l2 R p | CtrlDelete": {
  "w": "NOOP",
  "clip": "-"
 },
 "l2 R p | Enter": {
  "w": "<ul><li>Aw<ul><li>Pw</li><li></li></ul></li></ul><hr /><p>Nw</p>",
  "clip": "-"
 },
 "l2 R p | ShiftEnter": {
  "w": "<ul><li>Aw<ul><li>Pw<br /></li></ul></li></ul><hr /><p>Nw</p>",
  "clip": "-"
 },
 "l2 R p | paste": {
  "w": "<ul><li>Aw<ul><li>PwZq</li></ul></li></ul><hr /><p>Nw</p>",
  "clip": "-"
 },
 "l2 R p | cut": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "l2 R p | copy": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "l R p | k": {
  "w": "<ul><li>Pwk</li></ul><hr /><p>Nw</p>",
  "clip": "-"
 },
 "l R p | Backspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "l R p | Delete": {
  "w": "NOOP",
  "clip": "-"
 },
 "l R p | CtrlBackspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "l R p | CtrlDelete": {
  "w": "NOOP",
  "clip": "-"
 },
 "l R p | Enter": {
  "w": "<ul><li>Pw</li><li></li></ul><hr /><p>Nw</p>",
  "clip": "-"
 },
 "l R p | ShiftEnter": {
  "w": "<ul><li>Pw<br /></li></ul><hr /><p>Nw</p>",
  "clip": "-"
 },
 "l R p | paste": {
  "w": "<ul><li>PwZq</li></ul><hr /><p>Nw</p>",
  "clip": "-"
 },
 "l R p | cut": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "l R p | copy": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q-br R p | k": {
  "w": "<blockquote><p>Pw<br /><br />k</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-br R p | Backspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-br R p | Delete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-br R p | CtrlBackspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-br R p | CtrlDelete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-br R p | Enter": {
  "w": "<blockquote><p>Pw<br /><br /></p><p></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-br R p | ShiftEnter": {
  "w": "<blockquote><p>Pw<br /><br /><br /></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-br R p | paste": {
  "w": "<blockquote><p>Pw<br /><br />Zq</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-br R p | cut": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q-br R p | copy": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q-img R p | k": {
  "w": "<blockquote><p>Pw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />k</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-img R p | Backspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-img R p | Delete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-img R p | CtrlBackspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-img R p | CtrlDelete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-img R p | Enter": {
  "w": "<blockquote><p>Pw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p><p></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-img R p | ShiftEnter": {
  "w": "<blockquote><p>Pw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /><br /></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-img R p | paste": {
  "w": "<blockquote><p>Pw<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" />Zq</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-img R p | cut": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q-img R p | copy": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q-link R p | k": {
  "w": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a>k</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-link R p | Backspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-link R p | Delete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-link R p | CtrlBackspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-link R p | CtrlDelete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q-link R p | Enter": {
  "w": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a></p><p></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-link R p | ShiftEnter": {
  "w": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a><br /></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-link R p | paste": {
  "w": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a>Zq</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q-link R p | cut": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q-link R p | copy": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q R end | k": {
  "w": "<blockquote><p>Pwk</p></blockquote><hr />",
  "clip": "-"
 },
 "q R end | Backspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R end | Delete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R end | CtrlBackspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R end | CtrlDelete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R end | Enter": {
  "w": "<blockquote><p>Pw</p><p></p></blockquote><hr />",
  "clip": "-"
 },
 "q R end | ShiftEnter": {
  "w": "<blockquote><p>Pw<br /></p></blockquote><hr />",
  "clip": "-"
 },
 "q R end | paste": {
  "w": "<blockquote><p>PwZq</p></blockquote><hr />",
  "clip": "-"
 },
 "q R end | cut": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q R end | copy": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q R p | k": {
  "w": "<blockquote><p>Pwk</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q R p | Backspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R p | Delete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R p | CtrlBackspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R p | CtrlDelete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R p | Enter": {
  "w": "<blockquote><p>Pw</p><p></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q R p | ShiftEnter": {
  "w": "<blockquote><p>Pw<br /></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q R p | paste": {
  "w": "<blockquote><p>PwZq</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "q R p | cut": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q R p | copy": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q R q | k": {
  "w": "<blockquote><p>Pwk</p></blockquote><hr /><blockquote><p>Nw</p></blockquote>",
  "clip": "-"
 },
 "q R q | Backspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R q | Delete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R q | CtrlBackspace": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R q | CtrlDelete": {
  "w": "NOOP",
  "clip": "-"
 },
 "q R q | Enter": {
  "w": "<blockquote><p>Pw</p><p></p></blockquote><hr /><blockquote><p>Nw</p></blockquote>",
  "clip": "-"
 },
 "q R q | ShiftEnter": {
  "w": "<blockquote><p>Pw<br /></p></blockquote><hr /><blockquote><p>Nw</p></blockquote>",
  "clip": "-"
 },
 "q R q | paste": {
  "w": "<blockquote><p>PwZq</p></blockquote><hr /><blockquote><p>Nw</p></blockquote>",
  "clip": "-"
 },
 "q R q | cut": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "q R q | copy": {
  "w": "NOOP",
  "clip": "[\"\",\"\"]"
 },
 "text-back in q R p | k": {
  "w": "<blockquote><p>Pk</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back in q R p | Backspace": {
  "w": "<blockquote><p>P</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back in q R p | Delete": {
  "w": "<blockquote><p>P</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back in q R p | CtrlBackspace": {
  "w": "<blockquote><p>P</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back in q R p | CtrlDelete": {
  "w": "<blockquote><p>P</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back in q R p | Enter": {
  "w": "<blockquote><p>P</p><p></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back in q R p | ShiftEnter": {
  "w": "<blockquote><p>P<br /></p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back in q R p | paste": {
  "w": "<blockquote><p>PZq</p></blockquote><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back in q R p | cut": {
  "w": "<blockquote><p>P</p></blockquote><hr /><p>Nw</p>",
  "clip": "[\"w\",\"<span style=\\\"white-space: pre-wrap;\\\">w</span>\"]"
 },
 "text-back in q R p | copy": {
  "w": "NOOP",
  "clip": "[\"w\",\"<span style=\\\"white-space: pre-wrap;\\\">w</span>\"]"
 },
 "text-back q R p | k": {
  "w": "<p>Ak</p><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back q R p | Backspace": {
  "w": "<p>A</p><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back q R p | Delete": {
  "w": "<p>A</p><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back q R p | CtrlBackspace": {
  "w": "<p>A</p><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back q R p | CtrlDelete": {
  "w": "<p>A</p><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back q R p | Enter": {
  "w": "<p>A</p><p></p><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back q R p | ShiftEnter": {
  "w": "<p>A<br /></p><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back q R p | paste": {
  "w": "<p>AZq</p><hr /><p>Nw</p>",
  "clip": "-"
 },
 "text-back q R p | cut": {
  "w": "<p>A</p><hr /><p>Nw</p>",
  "clip": "[\"w\\nPw\",\"<p dir=\\\"ltr\\\"><span style=\\\"white-space: pre-wrap;\\\">w</span></p><blockquote dir=\\\"ltr\\\"><p dir=\\\"ltr\\\"><span style=\\\"white-space: pre-wrap;\\\">Pw</span></p></blockquote>\"]"
 },
 "text-back q R p | copy": {
  "w": "NOOP",
  "clip": "[\"w\\nPw\",\"<p dir=\\\"ltr\\\"><span style=\\\"white-space: pre-wrap;\\\">w</span></p><blockquote dir=\\\"ltr\\\"><p dir=\\\"ltr\\\"><span style=\\\"white-space: pre-wrap;\\\">Pw</span></p></blockquote>\"]"
 }
};
// the head's write for the same input (lines off; a7f8121fd gives the same
// six results): the "before" record of each cell
const R10_HEAD: Record<string, string> = {
 "l R p | Backspace": "<ul><li>Pw</li></ul>",
 "l R p | CtrlBackspace": "<ul><li>Pw</li></ul>",
 "l R p | CtrlDelete": "<ul><li>Pw</li></ul>",
 "l R p | Delete": "<ul><li>Pw</li></ul>",
 "l R p | Enter": "<ul><li>Pw</li><li></li></ul>",
 "l R p | ShiftEnter": "<ul><li>Pw<br /></li></ul>",
 "l R p | copy": "NOOP",
 "l R p | cut": "<ul><li>Pw</li></ul>",
 "l R p | k": "THROWS: Expected node root to have a parent",
 "l R p | paste": "THROWS: Expected node root to have a parent",
 "l2 R p | Backspace": "<ul><li>Aw<ul><li>Pw</li></ul></li></ul>",
 "l2 R p | CtrlBackspace": "<ul><li>Aw<ul><li>Pw</li></ul></li></ul>",
 "l2 R p | CtrlDelete": "<ul><li>Aw<ul><li>Pw</li></ul></li></ul>",
 "l2 R p | Delete": "<ul><li>Aw<ul><li>Pw</li></ul></li></ul>",
 "l2 R p | Enter": "<ul><li>Aw<ul><li>Pw</li><li></li></ul></li></ul>",
 "l2 R p | ShiftEnter": "<ul><li>Aw<ul><li>Pw<br /></li></ul></li></ul>",
 "l2 R p | copy": "NOOP",
 "l2 R p | cut": "<ul><li>Aw<ul><li>Pw</li></ul></li></ul>",
 "l2 R p | k": "THROWS: Expected node root to have a parent",
 "l2 R p | paste": "THROWS: Expected node root to have a parent",
 "q R end | Backspace": "<blockquote><p>Pw</p></blockquote>",
 "q R end | CtrlBackspace": "<blockquote><p>Pw</p></blockquote>",
 "q R end | CtrlDelete": "<blockquote><p>Pw</p></blockquote>",
 "q R end | Delete": "<blockquote><p>Pw</p></blockquote>",
 "q R end | Enter": "<blockquote><p>Pw</p><p></p></blockquote>",
 "q R end | ShiftEnter": "<blockquote><p>Pw<br /></p></blockquote>",
 "q R end | copy": "NOOP",
 "q R end | cut": "<blockquote><p>Pw</p></blockquote>",
 "q R end | k": "THROWS: Expected node root to have a parent",
 "q R end | paste": "THROWS: Expected node root to have a parent",
 "q R p | Backspace": "<blockquote><p>Pw</p></blockquote>",
 "q R p | CtrlBackspace": "<blockquote><p>Pw</p></blockquote>",
 "q R p | CtrlDelete": "<blockquote><p>Pw</p></blockquote>",
 "q R p | Delete": "<blockquote><p>Pw</p></blockquote>",
 "q R p | Enter": "<blockquote><p>Pw</p><p></p></blockquote>",
 "q R p | ShiftEnter": "<blockquote><p>Pw<br /></p></blockquote>",
 "q R p | copy": "NOOP",
 "q R p | cut": "<blockquote><p>Pw</p></blockquote>",
 "q R p | k": "THROWS: Expected node root to have a parent",
 "q R p | paste": "THROWS: Expected node root to have a parent",
 "q R q | Backspace": "<blockquote><p>Pw</p></blockquote>",
 "q R q | CtrlBackspace": "<blockquote><p>Pw</p></blockquote>",
 "q R q | CtrlDelete": "<blockquote><p>Pw</p></blockquote>",
 "q R q | Delete": "<blockquote><p>Pw</p></blockquote>",
 "q R q | Enter": "<blockquote><p>Pw</p><p></p></blockquote>",
 "q R q | ShiftEnter": "<blockquote><p>Pw<br /></p></blockquote>",
 "q R q | copy": "NOOP",
 "q R q | cut": "<blockquote><p>Pw</p></blockquote>",
 "q R q | k": "THROWS: Expected node root to have a parent",
 "q R q | paste": "THROWS: Expected node root to have a parent",
 "q-br R p | Backspace": "<blockquote><p>Pw<br /></p></blockquote>",
 "q-br R p | CtrlBackspace": "<blockquote><p>Pw<br /></p></blockquote>",
 "q-br R p | CtrlDelete": "<blockquote><p>Pw<br /></p></blockquote>",
 "q-br R p | Delete": "<blockquote><p>Pw<br /></p></blockquote>",
 "q-br R p | Enter": "<blockquote><p>Pw<br /></p><p></p></blockquote>",
 "q-br R p | ShiftEnter": "<blockquote><p>Pw<br /><br /></p></blockquote>",
 "q-br R p | copy": "NOOP",
 "q-br R p | cut": "<blockquote><p>Pw<br /></p></blockquote>",
 "q-br R p | k": "THROWS: Expected node root to have a parent",
 "q-br R p | paste": "THROWS: Expected node root to have a parent",
 "q-img R p | Backspace": "<blockquote><p>Pw</p></blockquote>",
 "q-img R p | CtrlBackspace": "<blockquote><p>Pw</p></blockquote>",
 "q-img R p | CtrlDelete": "<blockquote><p>Pw</p></blockquote>",
 "q-img R p | Delete": "<blockquote><p>Pw</p></blockquote>",
 "q-img R p | Enter": "<blockquote><p>Pw</p><p></p></blockquote>",
 "q-img R p | ShiftEnter": "<blockquote><p>Pw<br /></p></blockquote>",
 "q-img R p | copy": "NOOP",
 "q-img R p | cut": "<blockquote><p>Pw</p></blockquote>",
 "q-img R p | k": "THROWS: Expected node root to have a parent",
 "q-img R p | paste": "THROWS: Expected node root to have a parent",
 "q-link R p | Backspace": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a></p></blockquote>",
 "q-link R p | CtrlBackspace": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a></p></blockquote>",
 "q-link R p | CtrlDelete": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a></p></blockquote>",
 "q-link R p | Delete": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a></p></blockquote>",
 "q-link R p | Enter": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a></p><p></p></blockquote>",
 "q-link R p | ShiftEnter": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a><br /></p></blockquote>",
 "q-link R p | copy": "NOOP",
 "q-link R p | cut": "<blockquote><p>Pw<a href=\"https://example.org/l\">Lw</a></p></blockquote>",
 "q-link R p | k": "THROWS: Expected node root to have a parent",
 "q-link R p | paste": "THROWS: Expected node root to have a parent",
 "text-back in q R p | Backspace": "<blockquote><p>P</p></blockquote>",
 "text-back in q R p | CtrlBackspace": "<blockquote><p>P</p></blockquote>",
 "text-back in q R p | CtrlDelete": "<blockquote><p>P</p></blockquote>",
 "text-back in q R p | Delete": "<blockquote><p>P</p></blockquote>",
 "text-back in q R p | Enter": "<blockquote><p>P</p><p></p></blockquote>",
 "text-back in q R p | ShiftEnter": "<blockquote><p>P<br /></p></blockquote>",
 "text-back in q R p | copy": "NOOP",
 "text-back in q R p | cut": "<blockquote><p>P</p></blockquote>",
 "text-back in q R p | k": "THROWS: Expected node root to have a parent",
 "text-back in q R p | paste": "THROWS: Expected node root to have a parent",
 "text-back q R p | Backspace": "<p>A</p><hr /><p>Nw</p>",
 "text-back q R p | CtrlBackspace": "<p>A</p><hr /><p>Nw</p>",
 "text-back q R p | CtrlDelete": "<p>A</p><hr /><p>Nw</p>",
 "text-back q R p | Delete": "<p>A</p><hr /><p>Nw</p>",
 "text-back q R p | Enter": "<p>A</p><p></p><hr /><p>Nw</p>",
 "text-back q R p | ShiftEnter": "<p>A<br /></p><hr /><p>Nw</p>",
 "text-back q R p | copy": "NOOP",
 "text-back q R p | cut": "<p>A</p><hr /><p>Nw</p>",
 "text-back q R p | k": "<p>Ak</p><hr /><p>Nw</p>",
 "text-back q R p | paste": "<p>AZq</p><hr /><p>Nw</p>"
};
const r10Find = (el: string, nth: number) => (el === "root" ? $getRoot() : (all().filter((node) => node.getType() === el)[nth] as ElementNode));
const r10Run = async (shape: R10Shape, form: "range" | "oracle", entry: (typeof R10_ENTRY)[number]) => {
  const onChange = await renderField(shape.html);
  await userEvent.click(editable()!.querySelector("[data-lexical-text]")!); await settle();
  // the input one press earlier: the anchor, the focus at the block's content end
  await act(async () => { editorOf()!.update(() => {
    const range = $createRangeSelection();
    const anchor = shape.anchor;
    if ("text" in anchor) { const text = $getRoot().getAllTextNodes().find((t) => t.getTextContent() === anchor.text)!; range.anchor.set(text.getKey(), anchor.at, "text"); }
    else range.anchor.set(r10Find(anchor.el, anchor.nth).getKey(), anchor.at, "element");
    const block = r10Find(shape.holder.el, shape.holder.nth).getChildAtIndex(shape.index - 1) as ElementNode;
    const end = block.getLastDescendant()!;
    if ($isTextNode(end)) range.focus.set(end.getKey(), end.getTextContentSize(), "text");
    else range.focus.set(end.getParentOrThrow().getKey(), end.getIndexWithinParent() + 1, "element");
    $setSelection(range);
  }, { discrete: true }); });
  await settle();
  if (form === "range") {
    if (shape.real) { await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}"); await settle(); }
    else { await act(async () => { editorOf()!.update(() => { const sel = $getSelection(); if ($isRangeSelection(sel)) sel.focus.set(r10Find(shape.holder.el, shape.holder.nth).getKey(), shape.index, "element"); }, { discrete: true }); }); await settle(); }
    expect(walkSel()).toMatch(/->root@/);
  }
  const before = onChange.mock.calls.length;
  let clip = "-";
  if (entry === "k") await userEvent.keyboard("k");
  else if (entry === "CtrlBackspace") await userEvent.keyboard("{Control>}{Backspace}{/Control}");
  else if (entry === "CtrlDelete") await userEvent.keyboard("{Control>}{Delete}{/Control}");
  else if (entry === "ShiftEnter") await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
  else if (entry === "paste") { const data = new DataTransfer(); data.setData("text/plain", "Zq"); await act(async () => { editable()!.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data })); }); }
  else if (entry === "cut" || entry === "copy") { const data = new DataTransfer(); await act(async () => { editable()!.dispatchEvent(new ClipboardEvent(entry, { bubbles: true, cancelable: true, clipboardData: data })); }); clip = JSON.stringify([data.getData("text/plain"), data.getData("text/html").replace(/ class="[^"]*"/g, "").slice(0, 160)]); }
  else await userEvent.keyboard(`{${entry}}`);
  await settle();
  const out = { w: onChange.mock.calls.length > before ? sanitizeRichTextHtml(lastHtml(onChange)) : "NOOP", clip };
  unmountField();
  return out;
};
for (const shape of R10) for (const entry of R10_ENTRY) test(`15.10 ${shape.id}: ${entry} over the range to the root after the block`, async () => {
  const range = await r10Run(shape, "range", entry);
  expect(range).toEqual(R10_PINS[`${shape.id} | ${entry}`]);
  expect(R10_HEAD[`${shape.id} | ${entry}`]).toBeDefined();
  // the range holds text: it gives what the range one press earlier gives
  if (shape.id.startsWith("text-back")) expect(range).toEqual(await r10Run(shape, "oracle", entry));
}, 30_000);

// 15.13 (a): a rule node-selected by a press with a kept line beside it, or
// in another item: each key gives what it gives with the rule selected by
// an arrow and no kept line
type KeptNode = { name: string; html: string; rule: number; keep: () => Promise<void>; arrow: () => Promise<void> };
const nodeSelectedNow = () => editorOf()!.getEditorState().read(() => $isNodeSelection($getSelection()));
const arrowUntilSelected = async (key: string) => {
  for (let press = 0; press < 4 && nodeSelectedNow() === false; press++) { await userEvent.keyboard(key); await settle(); }
  expect(nodeSelectedNow()).toBe(true);
};
const KEPT_NODE: KeptNode[] = [
  {
    name: "the kept line directly before the rule",
    html: LI("<hr>T1w"),
    rule: 0,
    keep: async () => { await clickInWord("T1w", 1); await hold(besideLeadingRule(), 50); expect(walkSel()).toBe("cms-line@0[-]"); },
    arrow: async () => { await clickInWord("T1w", 0); await arrowUntilSelected("{ArrowLeft}"); },
  },
  {
    name: "the kept line directly after the rule",
    html: LI("<hr><hr>T2w"),
    rule: 0,
    keep: async () => { await caretLineAt(1); },
    arrow: async () => { await clickInWord("Pw", 2); await arrowUntilSelected("{ArrowRight}"); },
  },
  {
    name: "the kept line in another item",
    html: "<ul><li>Pw</li><li><hr>T1w</li><li><hr>T2w</li><li>Nw</li></ul>",
    rule: 1,
    keep: async () => { await caretLineAt(0); },
    arrow: async () => { await clickInWord("T2w", 0); await arrowUntilSelected("{ArrowLeft}"); },
  },
];
const KEPT_NODE_KEYS: [string, () => Promise<void>][] = [
  ["a letter", async () => { await userEvent.keyboard("k"); }],
  ["Backspace", async () => { await userEvent.keyboard("{Backspace}"); }],
  ["Delete", async () => { await userEvent.keyboard("{Delete}"); }],
  ["Enter", async () => { await userEvent.keyboard("{Enter}"); }],
  ["a paste", async () => { const data = new DataTransfer(); data.setData("text/plain", "Zq"); await act(async () => { editable()!.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data })); }); }],
  ["ArrowLeft", async () => { await userEvent.keyboard("{ArrowLeft}"); }],
  ["ArrowRight", async () => { await userEvent.keyboard("{ArrowRight}"); }],
];
for (const shape of KEPT_NODE) for (const [keyName, key] of KEPT_NODE_KEYS) test(`15.13 (a) a rule selected by a press, ${shape.name}: ${keyName} as with the rule selected by an arrow`, async () => {
  const run = async (kept: boolean) => {
    const onChange = await renderField(shape.html);
    if (kept) {
      await shape.keep();
      const rule = editable()!.querySelectorAll("hr")[shape.rule];
      await hold(centre(rule), 50);
      expect(selectedElement()).toBe(rule);
      expect(emptyLines()).toBe(1);
    } else {
      await shape.arrow();
      expect(selectedElement()).toBe(editable()!.querySelectorAll("hr")[shape.rule]);
    }
    await key();
    await settle();
    const out = { w: writeOf(onChange), sel: walkSel(), lines: emptyLines() };
    unmountField();
    return out;
  };
  expect(await run(true)).toEqual(await run(false));
}, 30_000);
// 15.10: the copy at x1 is the copy at a plain caret at that place, the
// clipboard written or left exactly as there
test("15.10 a copy at x1 writes what a copy at the caret there writes", async () => {
  const copyAt = async (range: boolean) => {
    await renderField("<blockquote><p>Pw</p></blockquote><hr><p>Nw</p>");
    await clickInWord("Pw", 2);
    await act(async () => { editorOf()!.update(() => { $getRoot().getAllTextNodes().find((t) => t.getTextContent() === "Pw")!.select(2, 2); }); });
    await settle();
    if (range) { await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}"); await settle(); expect(walkSel()).toBe('"Pw"@2->root@1[horizontalrule]'); }
    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData: data });
    await act(async () => { editable()!.dispatchEvent(event); });
    await settle();
    const out = { prevented: event.defaultPrevented, types: [...data.types], values: [...data.types].map((type) => data.getData(type).replace(/cms-rich-text-[0-9a-f-]{36}/g, "NS")) };
    unmountField();
    return out;
  };
  expect(await copyAt(true)).toEqual(await copyAt(false));
}, 30_000);

// 15.12: the read-back never writes the page's selection: across the
// read-back's commit no call sets the page's selection (an element point
// above all), and the page's anchor and focus are unchanged, so the
// page's goal column survives the next vertical step
const pageWrites = () => {
  const calls: string[] = [];
  const proto = Selection.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
  const original: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of ["setBaseAndExtent", "addRange", "removeAllRanges", "collapse", "extend", "removeRange"]) {
    original[name] = proto[name];
    proto[name] = function (this: Selection, ...args: unknown[]) {
      calls.push(name);
      return original[name].apply(this, args);
    };
  }
  return { calls, restore: () => { for (const name of Object.keys(original)) proto[name] = original[name]; } };
};
const pageEnds = () => { const page = window.getSelection()!; return [page.anchorNode, page.anchorOffset, page.focusNode, page.focusOffset]; };
const READ_BACK_CELLS: [string, string, string, number, [string, string, string]][] = [
  ["an empty line (an element point)", LI("<h3>H0w</h3><br>"), "H0w", 3, ["move", "forward", "line"]],
  ["a link's start", '<p>Aw <a href="https://example.org/l">Lw</a></p>', "Aw ", 3, ["move", "forward", "character"]],
  ["a container focus", LI("<blockquote><p>Q0w</p></blockquote><hr>T2w"), "Q0w", 3, ["extend", "forward", "line"]],
];
for (const [name, html, word, at, [alter, direction, granularity]] of READ_BACK_CELLS) test(`15.12 the read-back writes nothing to the page: ${name}`, async () => {
  await renderField(html);
  await placeIn(word, at);
  const before = walkSel();
  (window.getSelection() as unknown as { modify: (a: string, b: string, c: string) => void }).modify(alter, direction, granularity);
  const ends = pageEnds();
  const writes = pageWrites();
  try {
    await act(async () => {
      editable()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", code: "ShiftLeft", shiftKey: true, bubbles: true, cancelable: true }));
    });
  } finally {
    writes.restore();
  }
  expect(walkSel()).not.toBe(before);
  expect(writes.calls).toEqual([]);
  expect(pageEnds()).toEqual(ends);
  await settle();
}, 30_000);
/** A Down walk, with a wait between the presses or none, then a letter: the write. */
const downWalk = async (html: string, word: string, at: number, presses: number, wait: boolean) => {
  const onChange = await renderField(html);
  await placeIn(word, at);
  if (wait) {
    for (let press = 0; press < presses; press++) { await userEvent.keyboard("{ArrowDown}"); await settle(); }
    await userEvent.keyboard("k");
  } else {
    await userEvent.keyboard("{ArrowDown}".repeat(presses) + "k");
  }
  await settle();
  const write = writeOf(onChange);
  unmountField();
  return write;
};
test("15.12 a goal-column walk: Down from a long line's end through an empty line and a short line to a long one lands in the same place, fast or with a wait", async () => {
  const html = "<p>Along line of words</p><p><br></p><p>Sw</p><p>Blong line of words</p>";
  const waited = await downWalk(html, "Along line of words", 19, 4, true);
  // the column kept: the walk ends at the long line's end
  expect(waited).toBe("<p>Along line of words</p><p><br /></p><p>Sw</p><p>Blong line of wordsk</p>");
  for (let run = 0; run < 10; run++) expect(await downWalk(html, "Along line of words", 19, 4, false)).toBe(waited);
}, 120_000);
// ACCEPTED (R2's list): a vertical walk that passes an empty caret line
// loses its column. The field sets the caret line's element point, and
// Lexical writes it to the page; the next Down lands at the line's start
test("15.12 ACCEPTED: a vertical walk that passes an empty caret line loses its column", async () => {
  const html = "<ul><li>Along line of words<hr><hr>Blong line of words</li></ul>";
  const waited = await downWalk(html, "Along line of words", 19, 2, true);
  expect(waited).toBe("<ul><li>Along line of words<hr /><hr />kBlong line of words</li></ul>");
  expect(await downWalk(html, "Along line of words", 19, 2, false)).toBe(waited);
}, 30_000);
// the walk the sweep once stopped on (S QRL, Shift+ArrowRight, press 11):
// it ends, in bounded time
test("15.12 S QRL Shift+ArrowRight x11 then a letter ends in bounded time", async () => {
  const onChange = await renderField(LI("<blockquote><p>Q0w</p></blockquote><hr><ul><li>L2w</li></ul>"));
  await placeIn("Pw", 2);
  const started = performance.now();
  await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}".repeat(11) + "k");
  await settle();
  expect(performance.now() - started).toBeLessThan(10_000);
  expect(writeOf(onChange)).toBe("<ul><li>Pwkw</li></ul>");
}, 30_000);
