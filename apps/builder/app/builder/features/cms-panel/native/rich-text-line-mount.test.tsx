// D8: no onChange and no console error on mount and a click over the
// state-space grid, and no undo step for lines made at mount (D7).
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { getRichTextReadOnlyReason } from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { click, editable, renderField, settle } from "./rich-text-test-harness";

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

const editableValues = stateSpaceValues(2).filter(
  (html) => getRichTextReadOnlyReason(html) === undefined
);

describe("D8: mount and a click over the state-space grid", () => {
  test.each(editableValues)(
    "the editable value %s mounts and takes a click with no onChange and no console error",
    async (html) => {
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        errors.push(args.map(String).join(" "));
      });
      const onChange = await renderField(html);
      await click(editable());
      await settle();
      expect(onChange).not.toHaveBeenCalled();
      expect(
        errors.filter((message) => !message.includes("not wrapped in act"))
      ).toEqual([]);
      for (let press = 0; press < 5; press += 1) {
        await userEvent.keyboard("{Control>}z{/Control}");
      }
      await settle();
      expect(onChange).not.toHaveBeenCalled();
    }
  );
});
