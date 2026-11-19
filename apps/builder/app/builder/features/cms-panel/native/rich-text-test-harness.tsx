// The rich-text field mounted in a test page, and the paste, drop, click and
// read helpers its browser tests share.
import "@webstudio-is/design-system/global.css";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  $getRoot,
  CLEAR_HISTORY_COMMAND,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import {
  getRichTextReadOnlyReason,
  writeRichTextHeadless,
} from "./rich-text-html";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

/** True while a field mounted by `sharedField` stays across tests. */
let isShared = false;

/** Unmounts the field. */
export const unmountField = () => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
};

afterEach(() => {
  if (isShared === false) {
    unmountField();
  }
  vi.restoreAllMocks();
});

export const settle = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

export const editable = () =>
  document.querySelector<HTMLElement>('[contenteditable="true"]');

export const editorOf = () =>
  (editable() as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null)
    ?.__lexicalEditor;

export const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

export const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await userEvent.click(element!);
  await settle();
};

/** Mounts the field holding `html`, with `props` added. */
export const renderField = async (
  html: string,
  props: Partial<RichTextFieldProps> = {}
) => {
  const onChange = vi.fn<RichTextFieldProps["onChange"]>();
  container = document.createElement("div");
  container.style.width = "480px";
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(RichTextField, {
          id: "cms-field-body",
          labelId: "cms-field-body-label",
          value: { html },
          onChange,
          onOpenClassic: vi.fn(),
          ...props,
        })
      )
    );
  });
  await settle();
  return onChange;
};

/**
 * Mounts `html` and puts the selection from the text `from` at `fromOffset`
 * to the text `to` at `toOffset` (a caret when `to` is left out). An offset
 * left out is the text's end.
 */
export const mountAt = async (
  html: string,
  from: string,
  fromOffset?: number,
  to?: string,
  toOffset?: number
) => {
  const onChange = await renderField(html);
  await click(editable());
  await act(async () => {
    editorOf()!.update(() => {
      const texts = $getRoot().getAllTextNodes();
      const find = (word: string) => {
        const node = texts.find((text) => text.getTextContent() === word);
        expect(node, word).toBeDefined();
        return node!;
      };
      if (from === "") {
        $getRoot().selectEnd();
        return;
      }
      const start = find(from);
      const end = find(to ?? from);
      const selection = start.select(
        fromOffset ?? start.getTextContentSize(),
        fromOffset ?? start.getTextContentSize()
      );
      if (to !== undefined) {
        selection.focus.set(
          end.getKey(),
          toOffset ?? end.getTextContentSize(),
          "text"
        );
      }
    });
  });
  await settle();
  return onChange;
};

export const lastHtml = (onChange: ReturnType<typeof vi.fn>) =>
  (onChange.mock.lastCall?.[0] as { html: string } | null)?.html ?? "";

export const paste = (data: Record<string, string>) => {
  const clipboardData = new DataTransfer();
  for (const [format, text] of Object.entries(data)) {
    clipboardData.setData(format, text);
  }
  act(() => {
    editable()!.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      })
    );
  });
};

export const undo = async () => {
  await userEvent.keyboard("{Control>}z{/Control}");
  await settle();
};

/** The saved value reopens editable, and a load and save keeps it. */
export const expectFixedPoint = (html: string) => {
  const stored = sanitizeRichTextHtml(html);
  expect(getRichTextReadOnlyReason(stored)).toBeUndefined();
  expect(sanitizeRichTextHtml(writeRichTextHeadless(stored))).toBe(stored);
};

/** The value as the platform stores it, with the editor's own attributes gone. */
export const plain = (html: string) =>
  sanitizeRichTextHtml(html).replace(/ value="\d+"/g, "");

/** The value's texts in reading order. */
export const readingOrder = (html: string) =>
  sanitizeRichTextHtml(html)
    .split(/<[^>]+>/)
    .filter((text) => text.trim() !== "")
    .join("|");

/**
 * Lays out `element` and waits for the web fonts its text loads: a point
 * measured in the fallback font misses the text once the font arrives.
 */
export const fontsLoaded = async (element: Element) => {
  element.getBoundingClientRect();
  await document.fonts.ready;
};

/** A real click in the text `word` at `offset` (its end when left out). */
export const clickInWord = async (word: string, offset?: number) => {
  const span = [
    ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
  ].find((element) => element.textContent === word)!;
  await fontsLoaded(span);
  const range = document.createRange();
  const at = offset ?? word.length;
  range.setStart(span.firstChild!, at);
  range.setEnd(span.firstChild!, at);
  const rect = range.getBoundingClientRect();
  const box = span.getBoundingClientRect();
  await userEvent.click(span, {
    position: {
      x: Math.min(Math.max(rect.left - box.left, 1), box.width - 1),
      y: box.height / 2,
    },
  } as never);
  await settle();
};

/** Drops `html` (with plain text) at the selection. */
export const dropHtml = async (html: string) => {
  const dataTransfer = new DataTransfer();
  dataTransfer.setData("text/html", html);
  dataTransfer.setData("text/plain", "x");
  await act(async () => {
    editable()!.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertFromDrop",
        dataTransfer,
      })
    );
  });
  await settle();
};

/** The element the field is mounted in. */
export const fieldContainer = () => container;

/**
 * One empty field for many pure-write cases: `fresh` brings it back to the
 * state it had when mounted, with the caret in its empty paragraph and no
 * history, and returns its onChange with no calls; `release` unmounts it.
 */
export const sharedField = () => {
  let onChange: ReturnType<typeof vi.fn> | undefined;
  let mounted: EditorState | undefined;
  return {
    fresh: async () => {
      if (onChange === undefined || mounted === undefined) {
        isShared = true;
        onChange = await mountAt("<p></p>", "");
        mounted = editorOf()!.getEditorState();
        return onChange;
      }
      const state = mounted;
      await act(async () => {
        editorOf()!.setEditorState(state);
        editorOf()!.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
      });
      await settle();
      onChange.mockClear();
      return onChange;
    },
    release: () => {
      isShared = false;
      unmountField();
    },
  };
};
