// SPIKE: the line invariant against a generated grid of mixed containers,
// headless and mounted.
import { describe, expect, test } from "vitest";
import { $getRoot, $isElementNode, createEditor, type LexicalNode } from "lexical";
import {
  clearRichTextReadOnlyMemo,
  getRichTextReadOnlyReason,
  importRichTextHtml,
  registerRichTextTransforms,
  richTextHtmlConfig,
  richTextNodes,
  writeRichTextHeadless,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { lineSpike, $isCmsLineNode } from "./rich-text-line-node";
import { click, editable, renderField, settle, unmountField } from "./rich-text-test-harness";

const PARTS: Array<(i: number) => string> = [
  (i) => `T${i}w`,
  () => "<br>",
  (i) => `<blockquote>Q${i}w</blockquote>`,
  (i) => `<blockquote><p>Q${i}a</p><p>Q${i}b</p></blockquote>`,
  (i) => `<h3>H${i}w</h3>`,
  (i) => `<pre><code>C${i}w</code></pre>`,
  () => "<hr>",
  (i) => `<ul><li>N${i}w</li></ul>`,
];
const PLACES: Array<(x: string) => string> = [
  (x) => `<ul><li>Pw</li><li>${x}</li><li>Zw</li></ul>`,
  (x) => `<ul><li>Aw<ul><li>${x}</li></ul></li></ul>`,
  (x) => `<blockquote><ul><li>${x}</li></ul></blockquote>`,
  (x) => `<blockquote>${x}</blockquote>`,
];
const sequences = (max: number) => {
  const out: number[][] = [];
  const walk = (prefix: number[]) => {
    if (prefix.length > 0) out.push(prefix);
    if (prefix.length === max) return;
    for (let k = 0; k < PARTS.length; k += 1) walk([...prefix, k]);
  };
  walk([]);
  return out;
};
const values = (max: number) =>
  sequences(max).flatMap((seq) =>
    PLACES.map((place) =>
      sanitizeRichTextHtml(place(seq.map((k, i) => PARTS[k](i)).join("")))
    )
  );

const check = (html: string, on: boolean) => {
  lineSpike.on = on;
  lineSpike.noEmptied = on;
  clearRichTextReadOnlyMemo();
  const reason = getRichTextReadOnlyReason(html);
  let written = "";
  try {
    written = sanitizeRichTextHtml(writeRichTextHeadless(html));
  } catch (error) {
    written = `THROW ${String(error)}`;
  }
  return { editable: reason === undefined, written };
};

const lineCount = (html: string) => {
  const editor = createEditor({
    nodes: [...richTextNodes],
    html: richTextHtmlConfig,
    onError: (error) => {
      throw error;
    },
  });
  registerRichTextTransforms(editor);
  editor.update(() => importRichTextHtml(editor, html), { discrete: true });
  return editor.getEditorState().read(() => {
    let count = 0;
    const walk = (node: LexicalNode) => {
      if ($isCmsLineNode(node)) count += 1;
      if ($isElementNode(node)) node.getChildren().forEach(walk);
    };
    walk($getRoot());
    return count;
  });
};

describe("line grid", () => {
  test("headless: 1 to 3 parts in 4 places", () => {
    const all = values(3);
    let offEditable = 0;
    let onEditable = 0;
    let lostEditable: string[] = [];
    let gainedEditable: string[] = [];
    let writtenChanged: string[] = [];
    let withLines = 0;
    for (const html of all) {
      const off = check(html, false);
      const on = check(html, true);
      if (off.editable) offEditable += 1;
      if (on.editable) onEditable += 1;
      if (off.editable && on.editable === false) lostEditable.push(html);
      if (off.editable === false && on.editable) gainedEditable.push(html);
      if (off.editable && on.written !== html) writtenChanged.push(`${html} -> ${on.written}`);
      if (lineCount(html) > 0) withLines += 1;
    }
    lineSpike.on = true;
    lineSpike.noEmptied = true;
    console.log(
      JSON.stringify(
        {
          values: all.length,
          withLines,
          offEditable,
          onEditable,
          lost: lostEditable.length,
          gained: gainedEditable.length,
          writtenChanged: writtenChanged.length,
          lostSample: lostEditable.slice(0, 10),
          gainedSample: gainedEditable.slice(0, 10),
          changedSample: writtenChanged.slice(0, 10),
        },
        null,
        1
      )
    );
    expect(lostEditable).toEqual([]);
    expect(writtenChanged).toEqual([]);
  });

  test("mounted: 1 to 2 parts, no onChange on mount or focus", async () => {
    clearRichTextReadOnlyMemo();
    const fired: string[] = [];
    let mounted = 0;
    for (const html of values(2)) {
      if (getRichTextReadOnlyReason(html) !== undefined) continue;
      const onChange = await renderField(html);
      await click(editable());
      await settle();
      mounted += 1;
      if (onChange.mock.calls.length > 0) fired.push(html);
      unmountField();
    }
    console.log(JSON.stringify({ mounted, fired: fired.length, sample: fired.slice(0, 10) }));
    expect(fired).toEqual([]);
  }, 600_000);
});

import corpus from "./__fixtures__/rich-text-corpus.json";
import roundtrip from "./__fixtures__/rich-text-roundtrip.json";

describe("D8: the read-only check and the headless bytes, lines on and off", () => {
  test("corpus, round-trip fixture, grid", () => {
    const all: string[] = [
      ...(corpus as { entries: Array<{ input: string }> }).entries.map(
        (entry) => entry.input
      ),
      ...(roundtrip as { cases: Array<{ input: string; stored: string }> }).cases.flatMap(
        (entry) => [entry.input, entry.stored]
      ),
      ...(roundtrip as { readOnly: Array<{ input: string }> }).readOnly.map((entry) => entry.input),
      ...values(3),
    ].filter((html) => typeof html === "string" && html !== "");
    const differ: string[] = [];
    for (const html of all) {
      const answer = (on: boolean) => {
        lineSpike.on = on;
        clearRichTextReadOnlyMemo();
        let bytes = "";
        try {
          bytes = sanitizeRichTextHtml(writeRichTextHeadless(html));
        } catch (error) {
          bytes = `THROW ${String(error)}`;
        }
        return `${getRichTextReadOnlyReason(html) ?? "editable"}|${bytes}`;
      };
      if (answer(true) !== answer(false)) differ.push(html);
    }
    lineSpike.on = true;
    console.log(`D8 ${JSON.stringify({ values: all.length, differ: differ.length, sample: differ.slice(0, 5) })}`);
    expect(differ).toEqual([]);
  });
});
