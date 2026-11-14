// The keyboard and focus around images (round 5 review): closing the image
// settings, text input with an image selected, Home and End beside line
// breaks, arrows over a range, and paste with an image selected.
// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cdp, userEvent } from "@vitest/browser/context";
import {
  $createNodeSelection,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  type ElementNode,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
});

const settle = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

/** The field, with a Title input and a Save button beside it. */
const mountField = (html: string, width = 480) => {
  const onChange = vi.fn<RichTextFieldProps["onChange"]>();
  container = document.createElement("div");
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(
          Fragment,
          null,
          createElement("input", { "aria-label": "Title" }),
          createElement(RichTextField, {
            id: "cms-field-body",
            labelId: "cms-field-body-label",
            value: { html },
            onChange,
          }),
          createElement("button", { type: "button" }, "Save")
        )
      )
    );
  });
  return onChange;
};

const editable = () =>
  document.querySelector<HTMLElement>('[contenteditable="true"]');

const editorOf = () =>
  (editable() as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null)
    ?.__lexicalEditor;

const lastHtml = (onChange: ReturnType<typeof vi.fn>) =>
  (onChange.mock.lastCall?.[0] as { html: string } | null)?.html ?? "";

const title = () =>
  document.querySelector<HTMLInputElement>('[aria-label="Title"]')!;

const inputByLabel = (text: string) => {
  const label = [...document.querySelectorAll("label")].find(
    (element) => element.textContent === text
  );
  return label === undefined
    ? null
    : (document.getElementById(label.htmlFor) as HTMLInputElement | null);
};

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );

const imageByAlt = (alt: string) =>
  editable()!.querySelector<HTMLElement>(`img[alt="${alt}"]`)!;

const type = async (text: string) => {
  await userEvent.keyboard(text);
  await settle();
};

const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await userEvent.click(element!);
  await settle();
};

const update = async (fn: () => void) => {
  await act(async () => {
    editorOf()!.update(fn);
  });
  await settle();
};

const textNode = (text: string) =>
  $getRoot()
    .getAllTextNodes()
    .find((node) => node.getTextContent() === text) as TextNode;

const inEditor = () => editable()?.contains(document.activeElement) === true;

const img = (name: string) =>
  `<img src="https://example.org/${name.toLowerCase()}.png" alt="${name}">`;
const A = img("A");
const B = img("B");
const FIGURE =
  '<figure><img src="https://example.org/f.png" alt="F"><figcaption>Cap</figcaption></figure>';

/** Mounts `html` with the editor focused and a text caret at `word`'s end. */
const caretAfter = async (html: string, word: string, at?: number) => {
  const onChange = mountField(html);
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p, h2"));
  await update(() => {
    const text = textNode(word);
    const offset = at ?? text.getTextContentSize();
    text.select(offset, offset);
  });
  return onChange;
};

describe("closing the image settings (R5-2)", () => {
  test("a click on another input keeps the focus there, and typing lands in it", async () => {
    const onChange = mountField(`<p>a${A}b</p>`);
    await settle();
    await click(imageByAlt("A"));
    expect(inputByLabel("Alt")).not.toBeNull();
    const calls = onChange.mock.calls.length;
    await click(title());
    expect(inputByLabel("Alt")).toBeNull();
    await type("abc");
    expect(title().value).toBe("abc");
    expect(document.activeElement).toBe(title());
    expect(onChange.mock.calls.length).toBe(calls);
  });

  test("a click on another button keeps the focus there", async () => {
    const onChange = mountField(`<p>a${A}b</p>`);
    await settle();
    await click(imageByAlt("A"));
    const calls = onChange.mock.calls.length;
    await click(buttonByText("Save"));
    expect(inputByLabel("Alt")).toBeNull();
    expect(document.activeElement).toBe(buttonByText("Save"));
    await type("abc");
    expect(onChange.mock.calls.length).toBe(calls);
  });

  test("a click on a second image opens its settings, with the focus in its Alt", async () => {
    const onChange = mountField(`<p>a${A}b${B}c</p>`);
    await settle();
    await click(imageByAlt("A"));
    expect(inputByLabel("Alt")?.value).toBe("A");
    await click(imageByAlt("B"));
    await settle();
    const alt = inputByLabel("Alt");
    expect(alt?.value).toBe("B");
    expect(document.activeElement).toBe(alt);
    await type("Z");
    expect(lastHtml(onChange)).toContain('alt="BZ"');
    expect(editable()!.textContent).toBe("abc");
  });

  test("a second click on the same image never moves the caret to the field's end", async () => {
    const onChange = mountField(`<p>a${A}b</p><p>end</p>`);
    await settle();
    await click(imageByAlt("A"));
    await click(imageByAlt("A"));
    await settle();
    if (inputByLabel("Alt") !== null) {
      await userEvent.keyboard("{Escape}");
      await settle();
    }
    await type("xy");
    const written = lastHtml(onChange);
    expect(written).not.toMatch(/endxy/);
  });

  test("Remove after a click puts the caret where the image was", async () => {
    const onChange = mountField(`<p>a${A}b</p><p>end</p>`);
    await settle();
    await click(imageByAlt("A"));
    await click(buttonByText("Remove"));
    expect(inEditor()).toBe(true);
    await type("xy");
    expect(lastHtml(onChange)).toMatch(/>a(<[^>]+>)*xy(<[^>]+>)*b</);
  });

  test.each([
    ["a figure as the last block", `<p>Before</p>${FIGURE}`],
    ["a value holding only a figure", FIGURE],
  ])("%s: Enter, Escape, then typing lands after it", async (_name, html) => {
    const onChange = mountField(html);
    await settle();
    await click(editable()!);
    await update(() => {
      const selection = $createNodeSelection();
      selection.add(
        $getRoot()
          .getChildren()
          .find((node) => node.getType() === "cms-figure")!
          .getKey()
      );
      $setSelection(selection);
    });
    await type("{Enter}");
    expect(inputByLabel("Alt")).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    await settle();
    expect(inEditor()).toBe(true);
    await type("xy");
    expect(lastHtml(onChange)).toMatch(/<\/figure><p[^>]*>(<[^>]+>)*xy/);
  });

  test("a figure as the last block, closed by a click on a blank area: typing lands after it", async () => {
    const onChange = mountField(`<p>Before</p>${FIGURE}`);
    await settle();
    await click(imageByAlt("F"));
    expect(inputByLabel("Alt")).not.toBeNull();
    await userEvent.click(document.body, { position: { x: 5, y: 600 } });
    await settle();
    expect(inputByLabel("Alt")).toBeNull();
    expect(inEditor()).toBe(true);
    await type("xy");
    expect(lastHtml(onChange)).toMatch(/<\/figure><p[^>]*>(<[^>]+>)*xy/);
  });
});

/** Chromium's DevTools session: input with no key events. */
const session = () =>
  cdp() as unknown as {
    send: (method: string, params: object) => Promise<unknown>;
  };

const insertText = async (text: string) => {
  await session().send("Input.insertText", { text });
  await settle();
};

const compose = async (text: string) => {
  await session().send("Input.imeSetComposition", {
    text: text.slice(0, 1),
    selectionStart: 1,
    selectionEnd: 1,
  });
  await settle();
  await session().send("Input.imeSetComposition", {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await settle();
  await session().send("Input.insertText", { text });
  await settle();
};

describe("text input with an image selected lands beside it (R5-3)", () => {
  test.each(["Dead", "Process"])(
    "a %s key down with an inline image selected by ArrowLeft puts the caret before it",
    async (key) => {
      await caretAfter(`<p>See ${A}here</p>`, "here", 0);
      await type("{ArrowLeft}");
      expect(
        editorOf()!
          .getEditorState()
          .read(() => $isNodeSelection($getSelection()))
      ).toBe(true);
      await act(async () => {
        editable()!.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
        );
      });
      await settle();
      const caret = editorOf()!
        .getEditorState()
        .read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) === false) {
            return "none";
          }
          const node = selection.anchor.getNode();
          return `${node.getTextContent()}@${selection.anchor.offset}`;
        });
      expect(caret).toBe("See @4");
    }
  );

  const shapes = [
    {
      name: "an inline image",
      html: `<p>See ${A}here</p>`,
      word: "See ",
      typed: /See (<[^>]+>)*<img[^>]*>(<[^>]+>)*xy(<[^>]+>)*here/,
    },
    {
      name: "a figure",
      html: `<p>Before</p>${FIGURE}<p>After</p>`,
      word: "Before",
      typed: /<\/figure><p[^>]*>(<[^>]+>)*xy(<[^>]+>)*After/,
    },
  ];
  test.each(shapes)(
    "$name: inserted text (dictation, emoji) lands after it",
    async ({ html, word, typed }) => {
      const onChange = await caretAfter(html, word);
      await type("{ArrowRight}");
      await insertText("xy");
      expect(lastHtml(onChange)).toMatch(typed);
    }
  );
  test.each(shapes)(
    "$name: an IME composition lands after it",
    async ({ html, word, typed }) => {
      const onChange = await caretAfter(html, word);
      await type("{ArrowRight}");
      await compose("xy");
      expect(lastHtml(onChange)).toMatch(typed);
    }
  );
});

/** Mounts `html` and puts a caret by `place`, the editor focused. */
const caretBy = async (html: string, place: () => void, width = 480) => {
  const onChange = mountField(html, width);
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await update(place);
  return onChange;
};

const paragraph = () => $getRoot().getFirstChild() as ElementNode;

/** The paragraph's end: an element caret after its last child. */
const atParagraphEnd = () => {
  const block = paragraph();
  const last = block.getLastChild();
  if (last !== null && last.getType() === "text") {
    (last as TextNode).select(
      last.getTextContentSize(),
      last.getTextContentSize()
    );
    return;
  }
  block.select(block.getChildrenSize(), block.getChildrenSize());
};

const LINE_SHAPES = [
  { html: `<p>${A}<br>${B}</p>`, before: "", after: "" },
  { html: `<p>aa ${A}<br>${B} cc</p>`, before: "aa ", after: " cc" },
];

describe("Home from a caret on a line after a line break (R5-4)", () => {
  test.each(LINE_SHAPES)(
    "Home, then typing, lands at the line's start: $html",
    async ({ html }) => {
      const onChange = await caretBy(html, atParagraphEnd);
      await type("{Home}x");
      const written = lastHtml(onChange);
      expect(written.match(/<img/g)?.length).toBe(2);
      expect(written).toMatch(/<br>(<[^>]+>)*x(<[^>]+>)*<img[^>]*b\.png/);
    }
  );

  test.each(LINE_SHAPES)(
    "Shift+Home, then Backspace, keeps the line above and its image: $html",
    async ({ html, before }) => {
      const onChange = await caretBy(html, atParagraphEnd);
      await type("{Shift>}{Home}{/Shift}{Backspace}");
      const written = lastHtml(onChange);
      expect(written).toContain("a.png");
      expect(written).toContain("<br>");
      if (before !== "") {
        expect(written).toContain(before.trim());
      }
      expect(written).not.toContain("b.png");
      expect(written).not.toContain("cc");
    }
  );

  test("Home after two arrows back from the line's text lands after the line break", async () => {
    const onChange = await caretBy(`<p>${A}<br>${B} cc</p>`, () => {
      textNode(" cc").select(0, 0);
    });
    await type("{ArrowLeft}{ArrowLeft}{Home}x");
    expect(lastHtml(onChange)).toMatch(
      /a\.png[^>]*>(<[^>]+>)*<br>(<[^>]+>)*x(<[^>]+>)*<img[^>]*b\.png/
    );
  });

  test("Shift+Home after two arrows back selects nothing, and Backspace takes the line break", async () => {
    const onChange = await caretBy(`<p>${A}<br>${B} cc</p>`, () => {
      textNode(" cc").select(0, 0);
    });
    await type("{ArrowLeft}{ArrowLeft}{Shift>}{Home}{/Shift}{Backspace}");
    // nothing was selected: Backspace joins the two lines
    const written = lastHtml(onChange);
    expect(written).toMatch(/a\.png[^>]*>(<[^>]+>)*<img[^>]*b\.png/);
    expect(written).not.toContain("<br>");
  });
});

const LONG =
  "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen";

describe("Home and End on a line after a line break that wraps (R5-6)", () => {
  const afterBreak = () => {
    const block = paragraph();
    const index = block
      .getChildren()
      .findIndex((child) => child.getType() === "linebreak");
    block.select(index + 1, index + 1);
  };

  test("Shift+End, then Backspace, takes only the first visual line", async () => {
    const onChange = await caretBy(
      `<p>${A}<br>${B}${LONG}</p>`,
      afterBreak,
      240
    );
    await type("{Shift>}{End}{/Shift}{Backspace}");
    const text = editable()!.textContent ?? "";
    expect(text).not.toBe("");
    expect(LONG.endsWith(text.trim())).toBe(true);
    expect(text.trim().length).toBeLessThan(LONG.length);
    expect(lastHtml(onChange)).toContain("a.png");
  });

  test("End, then typing, lands on the first visual line", async () => {
    const onChange = await caretBy(
      `<p>${A}<br>${B}${LONG}</p>`,
      afterBreak,
      240
    );
    await type("{End}Q");
    const text = editable()!.textContent ?? "";
    expect(text.endsWith("Q")).toBe(false);
    expect(text.replace("Q", "")).toBe(LONG);
    expect(lastHtml(onChange)).toContain("a.png");
  });

  test("Shift+Home from the paragraph's end, then Backspace, takes only the last visual line", async () => {
    const onChange = await caretBy(
      `<p>${A}<br>${LONG}</p>`,
      atParagraphEnd,
      240
    );
    await type("{Shift>}{Home}{/Shift}{Backspace}");
    const text = editable()!.textContent ?? "";
    expect(text.trim()).not.toBe("");
    expect(LONG.startsWith(text)).toBe(true);
    expect(text.length).toBeLessThan(LONG.length);
    expect(lastHtml(onChange)).toContain("a.png");
  });

  test("Home from the paragraph's end, then typing, lands on the last visual line", async () => {
    await caretBy(`<p>${A}<br>${B}${LONG}</p>`, atParagraphEnd, 240);
    await type("{Home}Q");
    const text = editable()!.textContent ?? "";
    expect(text.startsWith("Q")).toBe(false);
    expect(text.replace("Q", "")).toBe(LONG);
  });
});

describe("a selection extended from right after a line break keeps its anchor (R5-9)", () => {
  const afterBreak = () => {
    const block = paragraph();
    const index = block
      .getChildren()
      .findIndex((child) => child.getType() === "linebreak");
    block.select(index + 1, index + 1);
  };
  test.each([
    ["Shift+End twice", "{Shift>}{End}{End}{/Shift}"],
    ["Shift+End, then Shift+Left", "{Shift>}{End}{ArrowLeft}{/Shift}"],
    ["Shift+Right twice", "{Shift>}{ArrowRight}{ArrowRight}{/Shift}"],
  ])(
    "%s, then Backspace, keeps the line break and the line above",
    async (_name, keys) => {
      const onChange = await caretBy(`<p>${A}<br>${B} cc</p>`, afterBreak);
      await type(keys);
      await type("{Backspace}");
      const written = lastHtml(onChange);
      expect(written).toContain("a.png");
      expect(written).toMatch(/a\.png[^>]*>(<[^>]+>)*<br>/);
      expect(written).not.toContain("b.png");
    }
  );
});

describe("a range with a plain arrow collapses toward the arrow (R5-5)", () => {
  const selectText =
    (text: string, backward = false) =>
    () => {
      const node = textNode(text);
      const size = node.getTextContentSize();
      if (backward) {
        node.select(size, 0);
      } else {
        node.select(0, size);
      }
    };
  test.each([
    {
      name: "before an inline image",
      html: `<p>See ${A}here</p>`,
      text: "See ",
      typed: /See xy(<[^>]+>)*<img/,
    },
    {
      name: "at a link's edge before an inline image",
      html: `<p><a href="https://e.org/">See</a>${A}here</p>`,
      text: "See",
      typed: /See(<[^>]+>)*xy(<[^>]+>)*<img/,
    },
    {
      name: "before a figure",
      html: `<p>Before</p>${FIGURE}`,
      text: "Before",
      typed: /Beforexy(<[^>]+>)*<\/p><figure/,
    },
  ])(
    "$name: ArrowRight collapses to the range's end, and typing lands there",
    async ({ html, text, typed }) => {
      const onChange = await caretBy(html, selectText(text));
      await type("{ArrowRight}xy");
      expect(inputByLabel("Alt")).toBeNull();
      expect(lastHtml(onChange)).toMatch(typed);
    }
  );

  test("ArrowLeft over a backward range after an image collapses to its start", async () => {
    const onChange = await caretBy(
      `<p>See ${A}here</p>`,
      selectText("here", true)
    );
    await type("{ArrowLeft}xy");
    expect(lastHtml(onChange)).toMatch(/<img[^>]*>(<[^>]+>)*xyhere/);
  });

  test("Enter after the arrow breaks the line, and opens no settings", async () => {
    const onChange = await caretBy(`<p>See ${A}here</p>`, selectText("See "));
    await type("{ArrowRight}{Enter}");
    expect(inputByLabel("Alt")).toBeNull();
    expect(lastHtml(onChange).match(/<p\b/g)).toHaveLength(2);
  });
});

describe("a paste with an image selected lands beside it (R5-7)", () => {
  test.each([
    ["plain text", { "text/plain": "zz" }],
    ["HTML", { "text/html": "<p>zz</p>", "text/plain": "zz" }],
  ])("%s keeps the image and lands after it", async (_name, data) => {
    const onChange = await caretAfter(`<p>See ${A}here</p>`, "See ");
    await type("{ArrowRight}");
    const clipboardData = new DataTransfer();
    for (const [format, text] of Object.entries(data)) {
      clipboardData.setData(format, text);
    }
    await act(async () => {
      editable()!.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData,
        })
      );
    });
    await settle();
    expect(lastHtml(onChange)).toMatch(
      /See (<[^>]+>)*<img[^>]*a\.png[^>]*>(<[^>]+>)*zz(<[^>]+>)*here/
    );
  });
});

describe("Up, Down, Home and End with an image selected (R5-8)", () => {
  test("Down from a selected figure goes to the start of the next block, though it wraps", async () => {
    mountField(`<p>Before</p>${FIGURE}<p>${LONG}</p>`, 240);
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await update(() => {
      const text = textNode("Before");
      text.select(6, 6);
    });
    await type("{ArrowRight}{ArrowDown}Q");
    expect(editable()!.textContent).toContain(`Q${LONG}`);
  });

  test("Up from a selected figure goes to the end of the block before", async () => {
    mountField(`<p>${LONG}</p>${FIGURE}<p>After</p>`, 240);
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await update(() => {
      textNode("After").select(0, 0);
    });
    await type("{ArrowLeft}{ArrowUp}Q");
    expect(editable()!.textContent).toContain(`${LONG}Q`);
  });

  test.each([
    ["End", /here(<[^>]+>)*Q/],
    ["Home", /^<p[^>]*>(<[^>]+>)*QSee/],
  ])(
    "%s with an inline image selected goes to its line's edge",
    async (key, typed) => {
      const onChange = await caretAfter(`<p>See ${A}here</p>`, "See ");
      await type(`{ArrowRight}{${key}}Q`);
      expect(lastHtml(onChange)).toMatch(typed);
      expect(lastHtml(onChange)).toContain("a.png");
    }
  );
});

describe("an edit after Shift+End ends the extension (K11)", () => {
  test("Shift+End, then typing with Shift held keeps every character", async () => {
    const onChange = await caretAfter(`<p>Some text ${A}</p>`, "Some text ", 0);
    await type("{Shift>}{End}{/Shift}{Shift>}H{/Shift}ello");
    expect(editable()!.textContent).toBe("Hello");
    expect(lastHtml(onChange)).toMatch(/>Hello</);
  });

  test("Shift+End, Shift+Enter, then typing keeps the line break", async () => {
    const onChange = await caretAfter(`<p>Some text ${A}</p>`, "Some text ", 0);
    await type("{Shift>}{End}{Enter}{/Shift}xy");
    expect(lastHtml(onChange)).toMatch(/<br>(<[^>]+>)*xy/);
  });
});

describe("text input and arrows beside line breaks and images (K23, K25, K26)", () => {
  test.each([
    ["an inline image selected", `<p>See ${A}here</p>`, "See ", "{ArrowRight}"],
  ])(
    "a newline inserted as text with %s is a line break",
    async (_name, html, word, keys) => {
      const onChange = await caretAfter(html, word);
      await type(keys);
      await insertText("\n");
      const written = lastHtml(onChange);
      expect(written).not.toMatch(/\n/);
      expect(written).toMatch(/<br>|<\/p><p/);
    }
  );

  test("a newline in a text beforeinput with an inline image selected is a line break", async () => {
    const onChange = await caretAfter(`<p>See ${A}here</p>`, "See ");
    await type("{ArrowRight}");
    await act(async () => {
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertText",
          data: "x\ny",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    await settle();
    const written = lastHtml(onChange);
    expect(written).not.toMatch(/\n/);
    expect(written).toMatch(/x(<[^>]+>)*<br>(<[^>]+>)*y/);
  });

  test("ArrowRight at a line's end across a line break selects the image starting the next line", async () => {
    const onChange = await caretAfter(`<p>aa<br>${B} cc</p>`, "aa");
    await type("{ArrowRight}{ArrowRight}");
    expect(
      editorOf()!
        .getEditorState()
        .read(() => $isNodeSelection($getSelection()))
    ).toBe(true);
    await type("xy");
    expect(lastHtml(onChange)).toMatch(/b\.png[^>]*>(<[^>]+>)*xy cc/);
  });

  test("a soft-keyboard Backspace with an image selected by ArrowLeft takes the image", async () => {
    const onChange = await caretAfter(`<p>See ${A}here</p>`, "here", 0);
    await type("{ArrowLeft}");
    await act(async () => {
      editable()!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Unidentified",
          bubbles: true,
          cancelable: true,
        })
      );
      editable()!.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "deleteContentBackward",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    await settle();
    const written = lastHtml(onChange);
    expect(written).toContain("See ");
    expect(written).not.toContain("a.png");
  });
});
