// D7's comparator for the line tests: two editor states are the same when
// their JSON is, with every "direction" key and every empty line left out.
// No DOM and no Lexical runtime: it runs in node tests too.
import type { SerializedEditorState } from "lexical";

export type ComparableState = unknown;

const strip = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .filter(
        (child) =>
          (typeof child === "object" &&
            child !== null &&
            (child as { type?: unknown }).type === "cms-line" &&
            Array.isArray((child as { children?: unknown }).children) &&
            (child as { children: unknown[] }).children.length === 0) === false
      )
      .map(strip);
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key !== "direction") {
        out[key] = strip(entry);
      }
    }
    return out;
  }
  return value;
};

/**
 * toJSON() of an editor state with every "direction" key and every
 * "cms-line" node whose children are [] left out (D7).
 */
export const comparableState = (json: SerializedEditorState): ComparableState =>
  strip(json);

const sorted = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sorted);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sorted((value as Record<string, unknown>)[key])])
    );
  }
  return value;
};

export const sameState = (a: SerializedEditorState, b: SerializedEditorState) =>
  JSON.stringify(sorted(comparableState(a))) ===
  JSON.stringify(sorted(comparableState(b)));
