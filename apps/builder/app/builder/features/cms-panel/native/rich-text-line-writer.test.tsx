// 15.11: one writer for every range (candidate iii), and a removal that
// uses the same ends. Each range of prototype check 4's element-point sweep,
// its unlined twins and its real-input ranges: the copy's editor data and
// text/html hold exactly what the oracle reads between the two ends (text
// without new lines, images, rules, line breaks, in order), the cut's
// clipboard too, and the cut removes exactly that range.
import { expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { editable, renderField, settle, unmountField } from "./rich-text-test-harness";
import {
  LINED_CASES,
  UNLINED_CASES,
  dataSeq,
  htmlSeq,
  liveTokens,
  oracleNow,
  placeRange,
  realInput,
  type Case,
} from "./rich-text-line-writer-cases";

const clip = (type: "copy" | "cut") => {
  const clipboardData = new DataTransfer();
  act(() => {
    editable()!.dispatchEvent(new ClipboardEvent(type, { bubbles: true, cancelable: true, clipboardData }));
  });
  return clipboardData;
};

export const judge = async (c: Case) => {
  await renderField(c.html);
  await userEvent.click(editable()!);
  await settle();
  if ("real" in c) {
    await realInput(c.real);
  } else {
    expect(await placeRange(c.anchor, c.focus)).toBeNull();
  }
  const oracle = oracleNow();
  const before = liveTokens();
  const copy = clip("copy");
  await settle();
  const cut = clip("cut");
  await settle();
  const after = liveTokens().filter((token) => token !== "\n");
  unmountField();
  if (oracle === null || "error" in oracle) {
    return { oracle: null };
  }
  const [lo, hi] = [Math.min(...(oracle.pos as number[])), Math.max(...(oracle.pos as number[]))];
  const expected = [...before.slice(0, lo), ...before.slice(hi)].filter((token) => token !== "\n");
  const noBreak = (tokens: string[]) => tokens.filter((token) => token !== "[br]");
  const removal =
    JSON.stringify(after) === JSON.stringify(expected)
      ? "exact"
      : JSON.stringify(after) === JSON.stringify(before.filter((token) => token !== "\n"))
        ? "nothing"
      : JSON.stringify(noBreak(after)) === JSON.stringify(noBreak(expected)) && after.length - expected.length === 1
        ? "exact+br"
        : `other: ${after.join("")} want ${expected.join("")}`;
  return {
    oracle: oracle.seq,
    copyData: dataSeq(copy.getData("application/x-lexical-editor"))?.seq ?? null,
    copyHtml: htmlSeq(copy.getData("text/html"))?.seq ?? null,
    cutData: dataSeq(cut.getData("application/x-lexical-editor"))?.seq ?? null,
    cutHtml: htmlSeq(cut.getData("text/html"))?.seq ?? null,
    removal: removal === "exact+br" ? "exact" : removal,
  };
};

// 15.11 (4): a point on the root beside a root-level rule, where no text
// can stand, keeps the present writer (R2's in ordinary content): its copy
// holds more than the range, and the cut's check takes nothing
const R2_PINS: Record<string, unknown> = {
 "rootRule | afterRule -> nextP B2w@1": {
  "copyData": "2w",
  "copyHtml": "2w",
  "cutData": null,
  "cutHtml": null,
  "oracle": "B",
  "removal": "nothing"
 },
 "rootRule | afterRule -> prevP A0w@1": {
  "copyData": "0w#B2w",
  "copyHtml": "0w#B2w",
  "cutData": null,
  "cutHtml": null,
  "oracle": "0w#",
  "removal": "nothing"
 },
 "rootRule | beforeRule -> nextP B2w@1": {
  "copyData": "#B",
  "copyHtml": "#B",
  "cutData": "#B",
  "cutHtml": "#B",
  "oracle": "#B",
  "removal": "exact"
 },
 "rootRule | beforeRule -> prevP A0w@1": {
  "copyData": "0w",
  "copyHtml": "0w",
  "cutData": "0w",
  "cutHtml": "0w",
  "oracle": "0w",
  "removal": "exact"
 },
 "rootRule | nextP B2w@1 -> afterRule": {
  "copyData": "2w",
  "copyHtml": "2w",
  "cutData": null,
  "cutHtml": null,
  "oracle": "B",
  "removal": "nothing"
 },
 "rootRule | nextP B2w@1 -> beforeRule": {
  "copyData": "#B",
  "copyHtml": "#B",
  "cutData": "#B",
  "cutHtml": "#B",
  "oracle": "#B",
  "removal": "exact"
 },
 "rootRule | pair beforeRule..afterRule": {
  "copyData": "#B2w",
  "copyHtml": "#B2w",
  "cutData": null,
  "cutHtml": null,
  "oracle": "#",
  "removal": "nothing"
 },
 "rootRule | pair-back beforeRule..afterRule": {
  "copyData": "#B2w",
  "copyHtml": "#B2w",
  "cutData": null,
  "cutHtml": null,
  "oracle": "#",
  "removal": "nothing"
 },
 "rootRule | prevP A0w@1 -> afterRule": {
  "copyData": "0w#B2w",
  "copyHtml": "0w#B2w",
  "cutData": null,
  "cutHtml": null,
  "oracle": "0w#",
  "removal": "nothing"
 },
 "rootRule | prevP A0w@1 -> beforeRule": {
  "copyData": "0w",
  "copyHtml": "0w",
  "cutData": "0w",
  "cutHtml": "0w",
  "oracle": "0w",
  "removal": "exact"
 }
};
for (const [set, cases] of [["lined", LINED_CASES], ["unlined", UNLINED_CASES]] as const) {
  for (const c of cases) {
    test(`15.11 ${set}: ${c.id}`, async () => {
      const result = await judge(c);
      // a Shift+click on an image opens its popover and selects nothing
      // (14.2's controls): no range; every other case has its two ends
      const shiftClickOnImage = "real" in c && c.real.k === "shiftclickImg";
      expect(result.oracle === null).toBe(shiftClickOnImage);
      if (result.oracle === null) {
        return;
      }
      const want = result.oracle;
      if (c.id.startsWith("rootRule")) {
        expect(result).toEqual(R2_PINS[c.id]);
        return;
      }
      expect(result).toEqual({ oracle: want, copyData: want, copyHtml: want, cutData: want, cutHtml: want, removal: "exact" });
    }, 30_000);
  }
}
