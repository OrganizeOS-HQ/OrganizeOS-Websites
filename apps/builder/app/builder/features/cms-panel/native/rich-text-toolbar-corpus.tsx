// Every toolbar command over editable corpus values: each saves a value that
// reopens editable. The command tests split across two files.
import { expect, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { getRichTextReadOnlyReason } from "./rich-text-html";
import corpus from "./__fixtures__/rich-text-corpus.json";
import {
  byLabel,
  click,
  editable,
  lastHtml,
  renderField,
  settle,
  unmountField,
} from "./rich-text-test-harness";

// every twentieth editable corpus value (the corpus orders its matrix by
// shape, so this spans every shape it crosses), plus each value a run over
// the whole set found locking
const corpusSample = [
  ...corpus.entries
    .filter((entry) => entry.verdict === "editable")
    .filter((_entry, index) => index % 20 === 0)
    .map((entry) => entry.input),
  // the values the full set (every editable entry, every command) locked
  "<p>z</p><ul><li> <ul><li>n</li></ul></li></ul>",
];

const selectAll = async () => {
  await userEvent.keyboard("{Control>}a{/Control}");
  await settle();
};

const chooseBlock = async (label: string) => {
  await click(byLabel("Block type"));
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((element) => element.textContent === label);
  await click(option);
};

const applyLink = async (href: string) => {
  await click(byLabel("Link"));
  await userEvent.fill(byLabel("URL") as HTMLInputElement, href);
  await click(
    [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Apply"
    )
  );
};

export const inlineActions: Array<[string, () => Promise<void>]> = [
  ["Bold", () => click(byLabel("Bold"))],
  ["Italic", () => click(byLabel("Italic"))],
  ["Bulleted list", () => click(byLabel("Bulleted list"))],
  ["Numbered list", () => click(byLabel("Numbered list"))],
  ["Link", () => applyLink("https://example.org/")],
];

export const blockActions: Array<[string, () => Promise<void>]> = [
  ["Quote", () => chooseBlock("Quote")],
  ["Heading 2", () => chooseBlock("Heading 2")],
  ["Code", () => chooseBlock("Code")],
  ["Paragraph", () => chooseBlock("Paragraph")],
];

/** Runs `run` over all of each corpus value; every value written reopens editable. */
export const checkOverCorpus = async (run: () => Promise<void>) => {
  const locked: string[] = [];
  for (const html of corpusSample) {
    const onChange: ReturnType<typeof vi.fn> = await renderField(html);
    const first = editable()?.querySelector<HTMLElement>(
      "p, li, h2, h3, h4, blockquote, code"
    );
    if (first !== null && first !== undefined) {
      await click(first);
      await selectAll();
      await run();
      const written = lastHtml(onChange);
      if (
        written !== "" &&
        getRichTextReadOnlyReason(sanitizeRichTextHtml(written)) !== undefined
      ) {
        locked.push(html);
      }
    }
    unmountField();
  }
  expect(locked).toEqual([]);
};
