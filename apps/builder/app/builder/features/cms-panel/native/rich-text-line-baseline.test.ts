// D8: the read-only check's answers and the sanitised headless bytes equal the
// baseline recorded at `main`. The values are the corpus, the round-trip
// fixture and the state-space grid.
import { describe, expect, test } from "vitest";
import corpus from "./__fixtures__/rich-text-corpus.json";
import roundtrip from "./__fixtures__/rich-text-roundtrip.json";
import {
  getRichTextReadOnlyReason,
  writeRichTextHeadless,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const BASE = "2a96a451309fdb15aa54b6e291f49a12a9cdba99";

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

const stateSpaceValues = (maxParts: number): string[] => {
  const sequences: number[][] = [];
  const walk = (prefix: number[]) => {
    if (prefix.length > 0) {
      sequences.push(prefix);
    }
    if (prefix.length === maxParts) {
      return;
    }
    for (let k = 0; k < PARTS.length; k += 1) {
      walk([...prefix, k]);
    }
  };
  walk([]);
  return sequences.flatMap((sequence) =>
    PLACES.map((place) =>
      sanitizeRichTextHtml(place(sequence.map((k, i) => PARTS[k](i)).join("")))
    )
  );
};

const storedValues = (): string[] => {
  const all: unknown[] = [
    ...corpus.entries.map((entry) => entry.input),
    ...roundtrip.cases.flatMap((entry) => [entry.input, entry.stored]),
    ...roundtrip.readOnly.map((entry) => entry.input),
    ...stateSpaceValues(3),
  ];
  const seen = new Set<string>();
  for (const value of all) {
    if (typeof value === "string" && value !== "") {
      seen.add(value);
    }
  }
  return [...seen];
};

describe("D8: the read-only check and the headless bytes equal the baseline recorded at main", () => {
  test("every stored value of the corpus, the round-trip fixture and the state-space grid gives the baseline's answer and bytes", async () => {
    const entries = storedValues().map((html) => {
      let bytes: string;
      try {
        bytes = sanitizeRichTextHtml(writeRichTextHeadless(html));
      } catch (error) {
        bytes = `THROW ${error instanceof Error ? error.message : String(error)}`;
      }
      return {
        html,
        answer: getRichTextReadOnlyReason(html) ?? "editable",
        bytes,
      };
    });
    await expect(
      JSON.stringify({ base: BASE, entries }, null, 1)
    ).toMatchFileSnapshot("./__fixtures__/rich-text-line-baseline.json");
  });
});
