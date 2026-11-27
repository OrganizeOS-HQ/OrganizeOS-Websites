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
import { stateSpaceValues } from "./rich-text-line-test-kit";

const BASE = "2a96a451309fdb15aa54b6e291f49a12a9cdba99";

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
      JSON.stringify({ base: BASE, entries }, null, 2) + "\n"
    ).toMatchFileSnapshot("./__fixtures__/rich-text-line-baseline.json");
  });
});
