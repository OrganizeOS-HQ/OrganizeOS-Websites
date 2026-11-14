// The editor's read-only rule against the platform, over the shared corpus
// (OrganizeOS client/tests/fixtures/site-components/rich-text-corpus.json,
// copied byte for byte) and the round-trip fixture's nodes: the copied
// modules give the platform's nodes, every entry's read-only result is the
// pinned one, and an editable entry keeps its nodes, links and images and
// saves stably.
import { describe, expect, test } from "vitest";
import corpus from "./__fixtures__/rich-text-corpus.json";
import fixture from "./__fixtures__/rich-text-roundtrip.json";
import {
  getRichTextReadOnlyReason,
  writeRichTextHeadless,
} from "./rich-text-html";
import { toRichTextNodes } from "./rich-text-nodes";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";

const attributesOf = (tag: string) =>
  (tag.match(/\s[a-z-]+="[^"]*"/g) ?? []).sort().join("");
const linksOf = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(
      (match) =>
        /\shref="/.test(match[1]) &&
        (/<img\b/.test(match[2]) || match[2].replace(/<[^>]*>/g, "") !== "")
    )
    .map((match) => attributesOf(match[1]));
const imagesOf = (html: string) =>
  [...html.matchAll(/<img\b[^>]*>/g)].map((match) => attributesOf(match[0]));

describe("the copied nodes module gives the platform's nodes", () => {
  test.each(fixture.cases.map((entry) => [entry.name, entry] as const))(
    "round-trip case %s",
    (_name, entry) => {
      expect(toRichTextNodes(entry.stored ?? "")).toStrictEqual(entry.nodes);
    }
  );
  test.each(fixture.readOnly.map((entry) => [entry.name, entry] as const))(
    "read-only entry %s",
    (_name, entry) => {
      expect(toRichTextNodes(entry.input)).toStrictEqual(entry.nodes);
    }
  );
  test.each(fixture.cases.map((entry) => [entry.name, entry] as const))(
    "the copied sanitiser stores %s's editor HTML as the platform does",
    (_name, entry) => {
      // a value with no text and no image is stored as nothing at all
      if (entry.stored !== null) {
        expect(sanitizeRichTextHtml(entry.editor)).toBe(entry.stored);
      }
    }
  );
});

describe("the corpus", () => {
  test("its entries are stored values with platform nodes", () => {
    for (const entry of corpus.entries) {
      expect(sanitizeRichTextHtml(entry.input)).toBe(entry.input);
      expect(toRichTextNodes(entry.input)).toStrictEqual(entry.nodes);
    }
  });

  test.each(corpus.entries.map((entry, index) => [index, entry] as const))(
    "entry %i reads as pinned, and an editable one keeps what it shows and saves stably",
    (_index, entry) => {
      const reason = getRichTextReadOnlyReason(entry.input);
      expect(reason === "lossy" ? "lossy" : "editable").toBe(entry.verdict);
      if (reason !== undefined) {
        return;
      }
      const saved = sanitizeRichTextHtml(writeRichTextHeadless(entry.input));
      expect(sanitizeRichTextHtml(saved)).toBe(saved);
      expect(toRichTextNodes(saved)).toStrictEqual(entry.nodes);
      expect(linksOf(saved)).toStrictEqual(linksOf(entry.input));
      expect(imagesOf(saved)).toStrictEqual(imagesOf(entry.input));
      expect(getRichTextReadOnlyReason(saved)).toBeUndefined();
      expect(sanitizeRichTextHtml(writeRichTextHeadless(saved))).toBe(saved);
    }
  );
});
