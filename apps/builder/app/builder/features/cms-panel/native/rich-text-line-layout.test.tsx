// Section 10: the place and size of every text node and block, mounted and not
// focused, equal the baseline recorded at `main` (1 px tolerance).
import { describe, expect, test } from "vitest";
import { server } from "@vitest/browser/context";
import corpus from "./__fixtures__/rich-text-corpus.json";
import roundtrip from "./__fixtures__/rich-text-roundtrip.json";
import recorded from "./__fixtures__/rich-text-line-layout.json";
import { getRichTextReadOnlyReason } from "./rich-text-html";
import {
  editable,
  fontsLoaded,
  renderField,
  settle,
  unmountField,
} from "./rich-text-test-harness";
import { stateSpaceValues } from "./rich-text-line-test-kit";

const BASE = "2a96a451309fdb15aa54b6e291f49a12a9cdba99";

const editableValues = (): string[] => {
  const all: unknown[] = [
    ...corpus.entries.map((entry) => entry.input),
    ...roundtrip.cases.flatMap((entry) => [entry.input, entry.stored]),
    ...roundtrip.readOnly.map((entry) => entry.input),
    ...stateSpaceValues(2),
  ];
  const seen = new Set<string>();
  for (const value of all) {
    if (
      typeof value === "string" &&
      value !== "" &&
      getRichTextReadOnlyReason(value) === undefined
    ) {
      seen.add(value);
    }
  }
  return [...seen];
};

const TAGS = new Set(
  "p h1 h2 h3 h4 h5 h6 pre blockquote ul ol li hr img figure a strong em u s code br".split(
    " "
  )
);

type Rect = [number, number, number, number];
type Entry = { kind: string; text?: string; rect: Rect };

const measure = (): Entry[] => {
  const root = editable()!;
  const origin = root.getBoundingClientRect();
  const rectOf = (box: DOMRect): Rect => [
    Math.round(box.left - origin.left),
    Math.round(box.top - origin.top),
    Math.round(box.width),
    Math.round(box.height),
  ];
  const entries: Entry[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.selectNodeContents(node);
      entries.push({
        kind: "text",
        text: node.textContent ?? "",
        rect: rectOf(range.getBoundingClientRect()),
      });
      return;
    }
    if (node instanceof HTMLElement) {
      const tag = node.tagName.toLowerCase();
      // The reconciler's own line break, which the head also adds to an
      // element whose last child is a line break.
      const isOwnBreak =
        tag === "br" &&
        (
          node.parentElement as
            | (HTMLElement & { __lexicalLineBreak?: unknown })
            | null
        )?.__lexicalLineBreak === node;
      if (TAGS.has(tag) && isOwnBreak === false) {
        entries.push({
          kind: tag,
          rect: rectOf(node.getBoundingClientRect()),
        });
      }
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };
  for (const child of Array.from(root.childNodes)) {
    walk(child);
  }
  return entries;
};

const measureAll = async () => {
  const values: Array<{ html: string; entries: Entry[] }> = [];
  for (const html of editableValues()) {
    await renderField(html);
    await settle();
    const element = editable()!;
    await fontsLoaded(element);
    await Promise.all(
      Array.from(element.querySelectorAll("img")).map((img) =>
        img.decode().catch(() => {})
      )
    );
    values.push({ html, entries: measure() });
    unmountField();
  }
  return values;
};

const recording = () =>
  (
    server.config as unknown as {
      snapshotOptions?: { updateSnapshot?: string };
    }
  ).snapshotOptions?.updateSnapshot === "all";

const differs = (entry: Entry, other: Entry | undefined) =>
  other === undefined ||
  entry.kind !== other.kind ||
  entry.text !== other.text ||
  entry.rect.some((number, n) => Math.abs(number - other.rect[n]) > 1);

describe("section 10: layout equals the baseline recorded at main", () => {
  test("every editable stored value lays out as at the baseline, to the pixel", async () => {
    const values = await measureAll();
    if (recording()) {
      await expect(
        JSON.stringify({ base: BASE, values }, null, 1)
      ).toMatchFileSnapshot("./__fixtures__/rich-text-line-layout.json");
      return;
    }
    const baseline = recorded.values as unknown as typeof values;
    expect(values.map((value) => value.html)).toEqual(
      baseline.map((value) => value.html)
    );
    const failures: string[] = [];
    values.forEach((value, index) => {
      const wanted = baseline[index].entries;
      const at = value.entries.findIndex((entry, i) =>
        differs(entry, wanted[i])
      );
      if (at !== -1 || value.entries.length !== wanted.length) {
        const place = at === -1 ? value.entries.length : at;
        failures.push(
          `${value.html}: entry ${place} is ${JSON.stringify(value.entries[place])} but the baseline has ${JSON.stringify(wanted[place])} (${value.entries.length} entries against ${wanted.length})`
        );
      }
    });
    expect(failures).toEqual([]);
  }, 600_000);
});
