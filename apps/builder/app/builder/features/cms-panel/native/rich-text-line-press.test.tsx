// SPIKE: round 15, 15.14: the press's own caret survives the press. Nothing
// the field does while a pointer is down in it takes away or moves the
// selection that press made: the field focuses the editor through one
// function that does not focus during a press, and a popover closed by a
// press inside the editor does not hand focus back (a). Also the pins
// around the cut's abandon-by-throw (E (2)).
import { expect, test, vi } from "vitest";
import { cdp, userEvent } from "@vitest/browser/context";
import { act } from "react-dom/test-utils";
import { $getSelection, $isNodeSelection } from "lexical";
import { byLabel, click, clickInWord, editable, editorOf, lastHtml, renderField, settle, unmountField } from "./rich-text-test-harness";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { lineMarkCount, lineSpike } from "./rich-text-line-node";

const send = (m: string, p: object) => (cdp() as unknown as { send: (m: string, p: object) => Promise<unknown> }).send(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const IMG = `<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />`;
const LINK = `<a href="https://example.org/l">Lw</a>`;
const SHAPES: Record<string, (node: string) => string> = {
  ordinary: (node) => `<p>Aw${LINK}</p>${node.startsWith("<img") ? `<p>${node}</p>` : node}<p>Cw</p>`,
  lined: (node) => `<ul><li>Aw${LINK}${node}Cw</li></ul>`,
};
const nodeSelected = () => editorOf()!.getEditorState().read(() => $isNodeSelection($getSelection()));
const pointIn = (word: string, at: number) => {
  const span = [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find((e) => e.textContent === word)!;
  const range = document.createRange(); range.setStart(span.firstChild!, at); range.setEnd(span.firstChild!, at);
  const r = range.getBoundingClientRect(); const b = span.getBoundingClientRect();
  return { x: r.left, y: b.top + b.height / 2 };
};
const mouse = (type: "mousePressed" | "mouseReleased", x: number, y: number) =>
  send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mousePressed" ? 1 : 0, clickCount: 1 });
const writeOf = (onChange: Parameters<typeof lastHtml>[0]) =>
  onChange.mock.calls.length ? sanitizeRichTextHtml(lastHtml(onChange)).replace(/<img[^>]*>/g, "I") : "NOOP";
/** A press at Aw@1, held `held` ms (0: a click), then a letter. */
const pressAtAw = async (held: number) => {
  const at = pointIn("Aw", 1);
  await mouse("mousePressed", at.x, at.y);
  if (held > 0) { await settle(); await wait(held); }
  await mouse("mouseReleased", at.x, at.y);
  await settle();
  await userEvent.keyboard("k"); await settle();
};
type Opener = "link" | "image";
const open = async (opener: Opener) => {
  if (opener === "link") {
    // 14.2's order: a rule selected by arrow, then Link
    await clickInWord("Cw", 0);
    for (let i = 0; i < 3 && !nodeSelected(); i++) { await userEvent.keyboard("{ArrowLeft}"); await settle(); }
    expect(nodeSelected()).toBe(true);
    await click(byLabel("Link"));
    expect(byLabel("URL")).not.toBeNull();
    return;
  }
  await userEvent.click(editable()!.querySelector("img")!); await settle();
  expect([...document.querySelectorAll("label")].some((l) => l.textContent === "Alt")).toBe(true);
};
/** Runs `runs` presses, each on a fresh field; answers the writes counted. */
const runPresses = async (opener: Opener, shape: string, held: number, runs: number, switches: { guardOff: boolean; fixOff: boolean }) => {
  const counts: Record<string, number> = {};
  try {
    for (let run = 0; run < runs; run++) {
      lineSpike.focusGuardOff = switches.guardOff;
      lineSpike.closeFocusFixOff = switches.fixOff;
      const onChange = await renderField(SHAPES[shape](opener === "image" ? IMG : "<hr>"));
      await open(opener);
      await pressAtAw(held);
      const write = writeOf(onChange);
      counts[write] = (counts[write] ?? 0) + 1;
      unmountField();
    }
  } finally {
    lineSpike.focusGuardOff = false;
    lineSpike.closeFocusFixOff = false;
  }
  return counts;
};
const akw = (opener: Opener, shape: string) =>
  sanitizeRichTextHtml(SHAPES[shape](opener === "image" ? IMG : "<hr>").replace("Aw<a", "Akw<a")).replace(/<img[^>]*>/g, "I");

// the bad order forced: the press is held, so the popover's close (at the
// press) and any focus it hands back land before the release
const MODES = [
  ["both fixes", { guardOff: false, fixOff: false }],
  ["the guard only", { guardOff: false, fixOff: true }],
  ["(a) only", { guardOff: true, fixOff: false }],
] as const;
for (const shape of Object.keys(SHAPES)) {
  for (const [mode, switches] of MODES) test(`15.14 ${shape}, Link popover open, a press in text held 150 ms: the letter at the pressed place, 20 of 20, with ${mode}`, async () => {
    expect(await runPresses("link", shape, 150, 20, switches)).toEqual({ [akw("link", shape)]: 20 });
  }, 600_000);
  test(`15.14 ${shape}, Link popover open, a press in text held 150 ms: without either fix the letter lands at the content's start, 20 of 20`, async () => {
    const wrong = sanitizeRichTextHtml(SHAPES[shape]("<hr>").replace("Aw<a", "kAw<a"));
    expect(await runPresses("link", shape, 150, 20, { guardOff: true, fixOff: true })).toEqual({ [wrong]: 20 });
  }, 600_000);
  test(`15.14 ${shape}, Link popover open, a real click in text: the letter at the click, 60 of 60`, async () => {
    expect(await runPresses("link", shape, 0, 60, { guardOff: false, fixOff: false })).toEqual({ [akw("link", shape)]: 60 });
  }, 600_000);
  test(`15.14 ${shape}, Image popover open, a real click in text: the letter at the click, 60 of 60`, async () => {
    expect(await runPresses("image", shape, 0, 60, { guardOff: false, fixOff: false })).toEqual({ [akw("image", shape)]: 60 });
  }, 600_000);
  // the Image popover hands focus back only when closed by a key or when
  // the focus was lost: a press in the editor keeps it, with or without
  // the fixes
  test(`15.14 ${shape}, Image popover open, a press in text held 150 ms: the letter at the pressed place without either fix too, 20 of 20`, async () => {
    expect(await runPresses("image", shape, 150, 20, { guardOff: true, fixOff: true })).toEqual({ [akw("image", shape)]: 20 });
  }, 600_000);
  // the block-type menu is the design system's modal Select: a press
  // outside it closes it and does not reach the editor, and the focus goes
  // back to the menu's button. Pinned as it is (a7f8121fd the same)
  test(`15.14 ${shape}, block-type menu open, a real click in text: closes the menu, the focus on its button, the letter writes nothing`, async () => {
    const onChange = await renderField(SHAPES[shape]("<hr>"));
    await clickInWord("Cw", 1);
    await click(byLabel("Block type"));
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    const calls = onChange.mock.calls.length;
    await pressAtAw(0);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Block type");
    expect(onChange.mock.calls.length).toBe(calls);
  }, 60_000);
  // an upload that finishes while a press in the editor is held
  for (const guardOff of [false, true]) test(`15.14 ${shape}, an upload finishing during a press in text: ${guardOff ? "without the guard the letter follows the new image" : "the image where Image was chosen, the letter at the pressed place"}`, async () => {
    try {
      lineSpike.focusGuardOff = guardOff;
      let resolve: (value: unknown) => void = () => {};
      const uploadImage = vi.fn(() => new Promise((r) => { resolve = r; }));
      const onChange = await renderField(SHAPES[shape]("<hr>"), { source: { uploadImage } as never });
      await clickInWord("Cw", 1);
      const canvas = document.createElement("canvas"); canvas.width = 2; canvas.height = 3;
      const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
      await act(async () => { byLabel("Image")!.click(); });
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      const transfer = new DataTransfer(); transfer.items.add(new File([blob], "a.png", { type: "image/png" }));
      await act(async () => { input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true })); });
      for (let round = 0; round < 50 && uploadImage.mock.calls.length === 0; round++) await settle();
      expect(uploadImage).toHaveBeenCalled();
      const at = pointIn("Aw", 1);
      await mouse("mousePressed", at.x, at.y); await settle(); await wait(50);
      await act(async () => { resolve({ url: "https://cdn.example.org/y.png", path: "org/y.png" }); });
      for (let round = 0; round < 100 && lastHtml(onChange)?.includes("y.png") !== true; round++) await settle();
      await mouse("mouseReleased", at.x, at.y); await settle();
      await userEvent.keyboard("k"); await settle();
      const html = SHAPES[shape]("<hr>");
      const want = guardOff ? html.replace(">Cw<", ">CIkw<").replace("Cw</li>", "CIkw</li>") : html.replace("Aw<a", "Akw<a").replace(">Cw<", ">CIw<").replace("Cw</li>", "CIw</li>");
      expect(writeOf(onChange)).toBe(sanitizeRichTextHtml(want));
    } finally {
      lineSpike.focusGuardOff = false;
    }
  }, 60_000);
}

// E (2): the cut's abandon-by-throw. Around the throw: the event's default
// is prevented before anything can throw (no native cut), the marks are
// cleared, and after a refused cut the next letter lands where the
// selection was
const CUT_HTML = `<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>`;
const selectCutRange = async () => {
  await clickInWord("T0w", 1);
  await userEvent.keyboard("{Shift>}");
  await clickInWord("T2w", 2);
  await userEvent.keyboard("{/Shift}");
  await settle();
};
test("E (2) a refused cut: default prevented, nothing removed, no marks left, text/plain only, and the next letter lands where the selection was", async () => {
  // the control: the same range and the letter, with no cut
  const control = await renderField(CUT_HTML);
  await selectCutRange();
  await userEvent.keyboard("k"); await settle();
  const want = writeOf(control);
  unmountField();
  const onChange = await renderField(CUT_HTML);
  await selectCutRange();
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const calls = onChange.mock.calls.length;
  lineSpike.cutTakesCheckFails = true;
  try {
    const data = new DataTransfer();
    const event = new ClipboardEvent("cut", { bubbles: true, cancelable: true, clipboardData: data });
    act(() => { editable()!.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    await settle();
    expect(lineMarkCount(editorOf()!)).toBe(0);
    expect(errors.mock.calls.some((args) => String(args[0] instanceof Error ? args[0].message : args[0]).includes("does not take what its clipboard holds"))).toBe(true);
    expect(data.getData("text/html")).toBe("");
    expect(data.getData("text/plain")).not.toBe("");
    expect(onChange.mock.calls.length).toBe(calls);
  } finally {
    lineSpike.cutTakesCheckFails = false;
    errors.mockRestore();
  }
  await userEvent.keyboard("k"); await settle();
  expect(writeOf(onChange)).toBe(want);
}, 60_000);
