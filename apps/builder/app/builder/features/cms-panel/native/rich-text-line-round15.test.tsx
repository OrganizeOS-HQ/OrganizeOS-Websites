// SPIKE: round 15 (prototype round 15). 15.1: only a composition's own end
// counts; an undo during it voids what the field kept and the result is the
// head's. 15.2: a cancelled composition leaves the history exactly as it was
// (undo stack length and redo stack). 15.3 and 15.4: Shift steps and steps
// off a selected rule in right-to-left and mixed-direction items. 15.5 and
// 15.6: a heading that holds only an image.
import { expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { cdp, userEvent } from "@vitest/browser/context";
import { $createRangeSelection, $createRangeSelectionFromDom, $setSelection, KEY_DOWN_COMMAND, type BaseSelection, type LexicalNode, $getRoot, $getSelection, $isElementNode, $isNodeSelection, $isRangeSelection, $isTextNode, type PointType, CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_CRITICAL, type LexicalEditor } from "lexical";
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
