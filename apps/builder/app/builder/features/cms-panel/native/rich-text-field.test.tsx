// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  $createParagraphNode,
  $createTextNode,
  $createNodeSelection,
  $getRoot,
  $setSelection,
  FORMAT_TEXT_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type TextNode,
} from "lexical";
import { $createLinkNode, $isLinkNode } from "@lexical/link";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { createLazyRichTextField, FieldControl } from "./field-controls";
import { createFakeCmsSource } from "./fake-cms-source";
import fixture from "./__fixtures__/rich-text-roundtrip.json";
import corpus from "./__fixtures__/rich-text-corpus.json";
import {
  getRichTextReadOnlyReason,
  settleRichTextHtml,
  writeRichTextHeadless,
} from "./rich-text-html";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

const mount = (node: ReactElement, width = 480) => {
  container = document.createElement("div");
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(TooltipProvider, null, node));
  });
};

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

const mountField = (overrides: Partial<RichTextFieldProps> = {}) => {
  const onChange = vi.fn<RichTextFieldProps["onChange"]>();
  const onOpenClassic = vi.fn();
  mount(
    createElement(RichTextField, {
      id: "cms-field-body",
      labelId: "cms-field-body-label",
      value: null,
      onChange,
      onOpenClassic,
      ...overrides,
    }),
    overrides.id === "narrow" ? 240 : 480
  );
  return { onChange, onOpenClassic };
};

const editable = () =>
  document.querySelector<HTMLElement>('[contenteditable="true"]');

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );

const lastValue = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.lastCall?.[0] as { html: string; text: string } | null;

const lastHtml = (onChange: ReturnType<typeof vi.fn>) =>
  lastValue(onChange)?.html ?? "";

/** The read-only reason of a written value as the platform stores it. */
const reopenReason = (html: string) =>
  getRichTextReadOnlyReason(sanitizeRichTextHtml(html));

const focusEditor = async () => {
  await userEvent.click(editable()!);
  await settle();
};

const type = async (text: string) => {
  await userEvent.keyboard(text);
  await settle();
};

const selectAll = async () => {
  await userEvent.keyboard("{Control>}a{/Control}");
  await settle();
};

const click = async (element: HTMLElement | null | undefined) => {
  expect(element).toBeTruthy();
  await userEvent.click(element!);
  await settle();
};

const chooseBlock = async (label: string) => {
  await click(byLabel("Block type"));
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((element) => element.textContent === label);
  await click(option);
};

const paste = (target: HTMLElement, data: Record<string, string>) => {
  const clipboardData = new DataTransfer();
  for (const [format, text] of Object.entries(data)) {
    clipboardData.setData(format, text);
  }
  act(() => {
    target.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      })
    );
  });
};

test("loading a value writes nothing", async () => {
  const { onChange } = mountField({
    value: { html: "<p>Hi</p>", text: "Hi" },
  });
  await settle();
  expect(editable()?.textContent).toBe("Hi");
  expect(onChange).not.toHaveBeenCalled();
});

test("typing writes { html, text }", async () => {
  const { onChange } = mountField();
  await focusEditor();
  await type("Hello");
  expect(lastValue(onChange)?.text).toBe("Hello");
  expect(lastHtml(onChange)).toContain("Hello");
});

test("clearing writes null", async () => {
  const { onChange } = mountField({
    value: { html: "<p>Hi</p>", text: "Hi" },
  });
  await focusEditor();
  await selectAll();
  await type("{Backspace}");
  expect(onChange).toHaveBeenCalled();
  expect(onChange.mock.lastCall?.[0]).toBeNull();
});

test.each([null, "", { html: 1 }])(
  "%j loads as an empty editor",
  async (value) => {
    const { onChange } = mountField({ value });
    await settle();
    expect(editable()).not.toBeNull();
    expect(editable()?.textContent).toBe("");
    expect(onChange).not.toHaveBeenCalled();
  }
);

test("the toolbar holds the block type, the four marks, the two lists, Link and Divider, in order", async () => {
  mountField();
  const toolbar = document.querySelector<HTMLElement>(
    '[role="toolbar"][aria-label="Formatting"]'
  );
  expect(toolbar).not.toBeNull();
  expect(
    [...toolbar!.querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label")
    )
  ).toEqual([
    "Block type",
    "Bold",
    "Italic",
    "Underline",
    "Strikethrough",
    "Bulleted list",
    "Numbered list",
    "Link",
    "Divider",
  ]);
  await click(byLabel("Block type"));
  expect(
    [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(
      (option) => option.textContent
    )
  ).toEqual([
    "Paragraph",
    "Heading 2",
    "Heading 3",
    "Heading 4",
    "Quote",
    "Code",
  ]);
});

test("with an image source, the toolbar holds Image after Link", async () => {
  mountField({ source: createFakeCmsSource() });
  const toolbar = document.querySelector<HTMLElement>('[role="toolbar"]')!;
  expect(
    [...toolbar.querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label")
    )
  ).toEqual([
    "Block type",
    "Bold",
    "Italic",
    "Underline",
    "Strikethrough",
    "Bulleted list",
    "Numbered list",
    "Link",
    "Image",
    "Divider",
  ]);
});

test.each([
  ["Heading 2", "<h2"],
  ["Quote", "<blockquote"],
  ["Code", "<pre"],
])("the block type %s writes %s", async (label, tag) => {
  const { onChange } = mountField();
  await focusEditor();
  await type("x");
  await chooseBlock(label);
  expect(lastHtml(onChange)).toContain(tag);
  expect(lastHtml(onChange)).toContain("x");
});

test.each([
  ["Bulleted list", "<ul"],
  ["Numbered list", "<ol"],
  ["Divider", "<hr"],
])("%s writes %s", async (label, tag) => {
  const { onChange } = mountField();
  await focusEditor();
  await type("x");
  await click(byLabel(label));
  expect(lastHtml(onChange)).toContain(tag);
});

test("Enter in a code block after an indented line keeps editing", async () => {
  const { onChange } = mountField();
  await focusEditor();
  await type("x");
  await chooseBlock("Code");
  await focusEditor();
  await type("{End}{Enter}  a{Enter}b");
  expect(lastHtml(onChange)).toContain("<pre><code>");
  expect(lastValue(onChange)?.text).toContain("b");
});

test("Bold and a link applied inside a code block do not stay: the block shows and saves plain text (part 3, item 3)", async () => {
  const { onChange } = mountField({
    value: { html: "<pre><code>abc def</code></pre>" },
  });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("code, pre"));
  await act(async () => {
    editorOf()!.update(() => {
      const code = $getRoot().getFirstChild() as ElementNode;
      code.select(0, code.getChildrenSize());
    });
  });
  await settle();
  expect(byLabel("Bold")?.hasAttribute("disabled")).toBe(true);
  // the keyboard's Bold
  await act(async () => {
    editorOf()!.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
  });
  await settle();
  expect(
    editable()!.querySelector("code strong, code b, pre strong, pre b")
  ).toBeNull();
  expect(byLabel("Bold")?.getAttribute("aria-pressed")).not.toBe("true");
  await act(async () => {
    editorOf()!.update(() => {
      const code = $getRoot().getFirstChild() as ElementNode;
      const link = $createLinkNode("https://example.org/");
      const first = code.getFirstChild()!;
      first.insertBefore(link);
      link.append(first);
    });
  });
  await settle();
  expect(editable()!.querySelector("a")).toBeNull();
  const html = lastHtml(onChange) ?? "";
  expect(html).toContain("<pre><code>");
  expect(html).not.toMatch(/<(strong|b|em|i|a)\b/);
});

test("Enter after a stored code block's indented line keeps editing", async () => {
  const { onChange } = mountField({
    value: { html: "<pre><code>line 1\n  indented</code></pre>" },
  });
  await settle();
  const code = editable()!.querySelector<HTMLElement>("code, pre")!;
  // the caret at the end of the indented line
  const range = document.createRange();
  range.selectNodeContents(code);
  range.collapse(false);
  editable()!.focus();
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  await settle();
  await type("{Enter}b");
  expect(lastHtml(onChange)).toContain("<pre><code>");
  expect(lastValue(onChange)?.text).toContain("indented");
  expect(lastValue(onChange)?.text).toContain("b");
});

test("Link with New tab writes a new-tab link", async () => {
  const { onChange } = mountField();
  await focusEditor();
  await type("steward");
  await selectAll();
  await click(byLabel("Link"));
  const url = byLabel("URL") as HTMLInputElement;
  expect(url).not.toBeNull();
  expect(url.placeholder).toBe("https://");
  await userEvent.fill(url, "https://example.org");
  await click(document.querySelector<HTMLElement>('[role="switch"]'));
  await click(buttonByText("Apply"));
  expect(lastHtml(onChange)).toContain('href="https://example.org"');
  expect(lastHtml(onChange)).toContain('target="_blank"');
  await click(byLabel("Link"));
  await click(buttonByText("Remove"));
  expect(lastHtml(onChange)).not.toContain("<a");
});

test("Link refuses an address the site would show as text", async () => {
  const { onChange } = mountField();
  await focusEditor();
  await type("steward");
  await selectAll();
  const calls = onChange.mock.calls.length;
  await click(byLabel("Link"));
  for (const address of ["javascript:alert(1)", "contact"]) {
    await userEvent.fill(byLabel("URL")!, address);
    await click(buttonByText("Apply"));
    expect(document.body.textContent).toContain("Not a link");
  }
  expect(onChange.mock.calls.length).toBe(calls);
  expect(lastHtml(onChange)).not.toContain("<a");
});

test("a value with a stored schemeless link keeps it while another part is edited", async () => {
  const { onChange } = mountField({
    value: {
      html: '<p><a href="contact">Contact</a></p><p>b</p>',
      text: "Contact b",
    },
  });
  await settle();
  const second = [...editable()!.querySelectorAll<HTMLElement>("p")].find(
    (paragraph) => paragraph.textContent === "b"
  );
  await click(second);
  await type("{End}c");
  expect(lastValue(onChange)?.text).toContain("bc");
  expect(lastHtml(onChange)).toContain('href="contact"');
});

test.each([
  ["h1", "<h2"],
  ["h5", "<h4"],
  ["h6", "<h4"],
])("a pasted %s becomes %s", async (tag, written) => {
  const { onChange } = mountField();
  await focusEditor();
  paste(editable()!, {
    "text/html": `<${tag}>T</${tag}>`,
    "text/plain": "T",
  });
  await settle();
  expect(lastHtml(onChange)).toContain(written);
  expect(lastHtml(onChange)).not.toContain(`<${tag}`);
});

test.each([
  ["a javascript: link", "javascript:alert(1)"],
  ["a //host link", "//elsewhere.example/page"],
  ["a schemeless link", "contact"],
])("%s pasted becomes plain text", async (_name, href) => {
  const { onChange } = mountField();
  await focusEditor();
  paste(editable()!, {
    "text/html": `<p>Ask <a href="${href}">here</a> or <a href="https://example.org/">there</a></p>`,
    "text/plain": "Ask here or there",
  });
  await settle();
  expect(lastValue(onChange)?.text).toContain("Ask here or there");
  const html = lastHtml(onChange);
  expect(html).not.toContain(`href="${href}"`);
  expect(html.match(/<a /g)).toHaveLength(1);
  expect(html).toContain('href="https://example.org/"');
});

test("a link copied from a Lexical editor takes the same rule when pasted", async () => {
  const { onChange } = mountField();
  await focusEditor();
  const text = {
    type: "text",
    version: 1,
    text: "here",
    format: 0,
    style: "",
    mode: "normal",
    detail: 0,
  };
  paste(editable()!, {
    "application/x-lexical-editor": JSON.stringify({
      namespace: editorOf()!._config.namespace,
      nodes: [
        {
          type: "link",
          version: 1,
          url: "javascript:alert(1)",
          rel: null,
          target: null,
          title: null,
          direction: null,
          format: "",
          indent: 0,
          children: [text],
        },
      ],
    }),
    "text/plain": "here",
  });
  await settle();
  expect(lastValue(onChange)?.text).toContain("here");
  expect(lastHtml(onChange)).not.toContain("<a");
});

/** A drop's input, as Lexical reads it: `beforeinput`, `insertFromDrop`. */
const drop = (target: HTMLElement, data: Record<string, string>) => {
  const dataTransfer = new DataTransfer();
  for (const [format, text] of Object.entries(data)) {
    dataTransfer.setData(format, text);
  }
  const event = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertFromDrop",
    dataTransfer,
  });
  expect(event.dataTransfer).toBe(dataTransfer);
  act(() => {
    target.dispatchEvent(event);
  });
};

test.each([
  ["a javascript: link", "javascript:alert(1)"],
  ["a //host link", "//elsewhere.example/page"],
])("%s dropped becomes plain text", async (_name, href) => {
  const { onChange } = mountField();
  await focusEditor();
  drop(editable()!, {
    "text/html": `<p>Ask <a href="${href}">here</a> or <a href="https://example.org/">there</a></p>`,
    "text/plain": "Ask here or there",
  });
  await settle();
  expect(lastValue(onChange)?.text).toContain("Ask here or there");
  const html = lastHtml(onChange);
  expect(html).not.toContain(`href="${href}"`);
  expect(html.match(/<a /g)).toHaveLength(1);
  expect(html).toContain('href="https://example.org/"');
});

test("a link made in an update with a scheme the import refuses is unwrapped to its text", async () => {
  const { onChange } = mountField({
    value: { html: '<p>Go <a href="https://example.org/">there</a></p>' },
  });
  await settle();
  const editor = (
    editable() as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null
  )?.__lexicalEditor;
  expect(editor).toBeDefined();
  await act(async () => {
    editor!.update(() => {
      const link = $createLinkNode("javascript:alert(1)");
      link.append($createTextNode("here"));
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode("Ask "), link);
      $getRoot().append(paragraph);
    });
  });
  await settle();
  expect(lastValue(onChange)?.text).toContain("Ask here");
  const html = lastHtml(onChange);
  expect(html).not.toContain("javascript:");
  expect(html.match(/<a /g)).toHaveLength(1);
  expect(html).toContain('href="https://example.org/"');
  expect(editable()?.innerHTML).not.toContain("javascript:");
});

test("setting a refused address on a link unwraps it, and an undo never draws that address", async () => {
  const { onChange } = mountField({
    value: { html: '<p>Go <a href="https://example.org/">there</a></p>' },
  });
  await settle();
  const editor = (
    editable() as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null
  )?.__lexicalEditor;
  await act(async () => {
    editor!.update(() => {
      const link = $getRoot()
        .getAllTextNodes()
        .map((node) => node.getParent())
        .find($isLinkNode);
      link?.setURL("javascript:alert(1)");
    });
  });
  await settle();
  expect(lastHtml(onChange)).not.toContain("<a");
  expect(editable()?.innerHTML).not.toContain("javascript:");
  await focusEditor();
  await type("{Control>}z{/Control}");
  expect(editable()?.innerHTML).not.toContain("javascript:");
});

test("a lossy value without an image keeps Edit in Classic CMS and its button", async () => {
  const lossy = fixture.readOnly.find((entry) => entry.reason === "lossy");
  expect(lossy, "the fixture's lossy entry").toBeDefined();
  const { onOpenClassic } = mountField({ value: { html: lossy!.input } });
  await settle();
  expect(editable()).toBeNull();
  expect(document.body.textContent).toContain("Edit in Classic CMS");
  await click(buttonByText("Classic CMS"));
  expect(onOpenClassic).toHaveBeenCalledTimes(1);
});

/** The HTML without the live editor's theme classes and text direction. */
const withoutClassAndDir = (html: string) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const element of template.content.querySelectorAll("*")) {
    element.removeAttribute("class");
    element.removeAttribute("dir");
  }
  return template.innerHTML;
};

test.each(fixture.cases.map((entry) => [entry.name, entry] as const))(
  "the live field writes the fixture's editor HTML for %s",
  async (_name, entry) => {
    const { onChange } = mountField({ value: { html: entry.input } });
    await settle();
    const root = editable() as
      | (HTMLElement & { __lexicalEditor?: LexicalEditor })
      | null;
    const editor = root?.__lexicalEditor;
    expect(editor).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();
    // a change that alters no content: the field writes what it holds
    await act(async () => {
      editor!.update(() => {
        $getRoot().markDirty();
      });
    });
    await settle();
    expect(onChange).toHaveBeenCalled();
    const written = lastValue(onChange);
    if (entry.stored === null) {
      // nothing but blank text: the field writes no value
      expect(written).toBeNull();
      return;
    }
    expect(withoutClassAndDir(written?.html ?? "")).toBe(entry.editor);
  }
);

// the read-only check runs the editor headless: the live field, with its
// plugins and transforms, must write exactly what the headless editor writes
test.each([
  ...fixture.cases
    .filter((entry) => entry.stored !== null)
    .map((entry) => entry.input),
  "<h1>Title</h1><p>x</p>",
  "<h5>Title</h5><p>x</p>",
  '<p>a <a href="javascript:alert(1)">b</a> c</p>',
  '<a href="https://e.org/"><h2>Title</h2></a><p>b</p>',
  "<p>one<br></p><p>two<br><br></p>",
  "<ul><li>one<br></li><li><br></li></ul><p>x</p>",
])(
  "the live field writes what the headless editor writes for %s",
  async (html) => {
    const { onChange } = mountField({ value: { html } });
    await settle();
    const editor = (
      editable() as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null
    )?.__lexicalEditor;
    if (editor === undefined) {
      // read-only: nothing is written, so nothing to compare
      expect(getRichTextReadOnlyReason(html)).toBe("lossy");
      return;
    }
    await act(async () => {
      editor.update(() => {
        $getRoot().markDirty();
      });
    });
    await settle();
    const written = lastValue(onChange);
    expect(withoutClassAndDir(written?.html ?? "")).toBe(
      withoutClassAndDir(writeRichTextHeadless(html))
    );
  }
);

test("deleting a nested bullet's text keeps it nested, and the value reopens editable", async () => {
  const { onChange } = mountField({
    value: { html: "<ul><li>a<ul><li>b</li></ul></li></ul><p>x</p>" },
  });
  await settle();
  const nested = editable()!.querySelector<HTMLElement>("li li")!;
  await click(nested);
  await type("{End}{Backspace}");
  const html = withoutClassAndDir(lastHtml(onChange));
  expect(html).toMatch(/<ul><li[^>]*>.*a.*<ul><li[^>]*><\/li><\/ul>/);
  expect(reopenReason(html)).toBeUndefined();
});

// B5: what the editor writes after ordinary edits always reopens editable
test.each([
  ["typing", "<p>x</p>", "p", "{End} more words"],
  [
    "Shift+Enter twice",
    "<p>x</p>",
    "p",
    "{End}{Shift>}{Enter}{Enter}{/Shift}y",
  ],
  ["Enter in a bullet", "<ul><li>a</li></ul>", "li", "{End}{Enter}b"],
  [
    "Shift+Enter in a quote",
    "<blockquote>q</blockquote>",
    "blockquote",
    "{End}{Shift>}{Enter}{/Shift}",
  ],
  ["typing in a heading", "<h2>T</h2><p>x</p>", "h2", "{End}itle"],
  [
    "typing in a code block",
    "<pre><code>a</code></pre><p>x</p>",
    "code",
    "{End}{Enter}b",
  ],
  [
    "typing beside an image",
    '<p>a <img src="https://e.org/a.png" alt="A" /> b</p>',
    "p",
    "{End}{Shift>}{Enter}{/Shift}c",
  ],
  [
    "typing in a link",
    '<p><a href="https://e.org/">link</a></p>',
    "a",
    "{End}s",
  ],
])(
  "after %s the saved value reopens editable",
  async (_name, html, tag, keys) => {
    const { onChange } = mountField({ value: { html } });
    await settle();
    await click(editable()!.querySelector<HTMLElement>(tag));
    await type(keys);
    const written = lastHtml(onChange);
    expect(written).not.toBe("");
    expect(reopenReason(written)).toBeUndefined();
  }
);

// I16: a link over a line break, and a paste ending in one, through the
// live field
test("Link over a line ending in Shift+Enter saves a value that reopens editable", async () => {
  const { onChange } = mountField({ value: { html: "<p>line</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await type("{End}{Shift>}{Enter}{/Shift}");
  await selectAll();
  await applyLink("https://example.org/");
  const written = lastHtml(onChange);
  expect(written).toContain('href="https://example.org/"');
  expect(reopenReason(written)).toBeUndefined();
});

test.each([
  ["a line ending in a break", "<p>pasted<br></p>"],
  [
    "a link ending in a break",
    '<p><a href="https://example.org/">pasted<br></a></p>',
  ],
  ["a mark ending in a break", "<p><b>pasted<br></b></p>"],
  ["two breaks", "<p>pasted<br><br>more</p>"],
])("pasting %s saves a value that reopens editable", async (_name, html) => {
  const { onChange } = mountField({ value: { html: "<p>x</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await type("{End}");
  paste(editable()!, { "text/html": html, "text/plain": "pasted" });
  await settle();
  const written = lastHtml(onChange);
  expect(written).toContain("pasted");
  expect(reopenReason(written)).toBeUndefined();
});

// exact-guard round, item 3: spaces at a link's edges
test.each([
  ["a space at a link's start after a space", 2, 4],
  ["a space at a link's end before a space", 0, 2],
])(
  "Link over %s saves a value that reopens editable",
  async (_name, from, to) => {
    const { onChange } = mountField({ value: { html: "<p>x</p>" } });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await act(async () => {
      editorOf()!.update(() => {
        const text = $getRoot().getAllTextNodes()[0];
        text.setTextContent("a  b");
        text.select(from, to);
      });
    });
    await settle();
    await applyLink("https://example.org/");
    const written = lastHtml(onChange);
    expect(written).toContain("<a ");
    expect(reopenReason(written)).toBeUndefined();
  }
);

test("a space typed at a link's end, then Shift+Enter, saves a value that reopens editable", async () => {
  const { onChange } = mountField({
    value: { html: '<p><a href="https://example.org/">link</a></p>' },
  });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("a"));
  await act(async () => {
    editorOf()!.update(() => {
      const link = $getRoot().getAllTextNodes()[0];
      link.setTextContent("link ");
      link.select(5, 5);
    });
  });
  await settle();
  await type("{Shift>}{Enter}{/Shift}x");
  const written = lastHtml(onChange);
  expect(reopenReason(written)).toBeUndefined();
});

// exact-guard round, item 2: a list made from a quote of several paragraphs
test.each(["Bulleted list", "Numbered list"])(
  "%s over a quote of two paragraphs gives each its own item, and the value reopens editable",
  async (label) => {
    const html = "<blockquote><p>one</p><p>two</p></blockquote><p>after</p>";
    expect(getRichTextReadOnlyReason(html)).toBeUndefined();
    const { onChange } = mountField({ value: { html } });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("blockquote"));
    await act(async () => {
      editorOf()!.update(() => {
        const texts = $getRoot().getAllTextNodes();
        const one = texts.find((node) => node.getTextContent() === "one")!;
        const two = texts.find((node) => node.getTextContent() === "two")!;
        const selection = one.select(0, 0);
        selection.focus.set(two.getKey(), 3, "text");
      });
    });
    await settle();
    await click(byLabel(label));
    const written = lastHtml(onChange);
    expect(editable()!.querySelectorAll("li").length).toBe(2);
    expect(reopenReason(written)).toBeUndefined();
  }
);

// part 3, item 5: only the blocks the list covers leave the quote, in one
// undo step
test("a list made with the caret in one paragraph of a quote leaves the other paragraphs quoted, and one undo puts it all back", async () => {
  const html =
    "<blockquote><p>one</p><p>two</p><p>three</p></blockquote><p>after</p>";
  const { onChange } = mountField({ value: { html } });
  // the blocks, without spans and attributes
  const blocks = () =>
    (lastHtml(onChange) ?? "")
      .replace(/<\/?span[^>]*>/g, "")
      .replace(/ [a-z-]+="[^"]*"/g, "");
  await settle();
  await click(editable()!.querySelector<HTMLElement>("blockquote"));
  await act(async () => {
    editorOf()!.update(() => {
      const two = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === "two")!;
      two.select(1, 1);
    });
  });
  await settle();
  await click(byLabel("Bulleted list"));
  expect(blocks()).toBe(
    "<blockquote><p>one</p></blockquote><ul><li>two</li></ul><blockquote><p>three</p></blockquote><p>after</p>"
  );
  expect(reopenReason(lastHtml(onChange) ?? "")).toBeUndefined();
  editable()!.focus();
  await type("{Control>}z{/Control}");
  await settle();
  expect(blocks()).toBe(
    "<blockquote><p>one</p><p>two</p><p>three</p></blockquote><p>after</p>"
  );
});

// exact-guard round, item 8: a code block holds plain text
test("Code over a line with a link and formatting shows plain text, and saves what it shows", async () => {
  const { onChange } = mountField({
    value: {
      html: '<p>See <a href="https://example.org/">the <strong>link</strong></a> <em>now</em></p>',
    },
  });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await chooseBlock("Code");
  const code = editable()!.querySelector("code")!;
  expect(code.querySelector("a, strong, b, em, i")).toBeNull();
  expect(code.textContent).toBe("See the link now");
  const written = lastHtml(onChange);
  expect(written).not.toMatch(/<(a|strong|b|em|i)\b/);
  expect(reopenReason(written)).toBeUndefined();
});

test("the toolbar wraps within 240 px", async () => {
  mountField({ id: "narrow" });
  await settle();
  const toolbar = document.querySelector<HTMLElement>('[role="toolbar"]')!;
  expect(container!.getBoundingClientRect().width).toBe(240);
  expect(toolbar.getBoundingClientRect().width).toBeLessThanOrEqual(240);
  expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth);
});

const fixtureCase = (name: string) => {
  const entry = fixture.cases.find((candidate) => candidate.name === name);
  expect(entry, `the fixture's ${name} case`).toBeDefined();
  return entry!;
};

const editorOf = () =>
  (editable() as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null)
    ?.__lexicalEditor;

/** A change that alters no content: the field writes what it holds. */
const rewrite = async () => {
  await act(async () => {
    editorOf()!.update(() => {
      $getRoot().markDirty();
    });
  });
  await settle();
};

const inputByLabel = (text: string) => {
  const label = [...document.querySelectorAll("label")].find(
    (element) => element.textContent === text
  );
  return label === undefined
    ? null
    : (document.getElementById(label.htmlFor) as HTMLInputElement | null);
};

test("an image-bearing value opens editable, and Save sends it whole", async () => {
  const image = fixtureCase("image");
  const { onChange } = mountField({ value: { html: image.input } });
  await settle();
  expect(editable()).not.toBeNull();
  expect(document.querySelector("[data-cms-rich-text-read-only]")).toBeNull();
  expect(editable()!.querySelector("img")?.getAttribute("src")).toBe(
    "https://example.org/a.png"
  );
  const text = [...editable()!.querySelectorAll<HTMLElement>("p")].find(
    (paragraph) => paragraph.textContent === "Text"
  );
  await click(text);
  await type("{End}s");
  expect(lastValue(onChange)?.text).toContain("Texts");
  expect(lastHtml(onChange)).toContain(
    '<img src="https://example.org/a.png" alt="A" width="640" height="480">'
  );
});

test("an image-only value is never null", async () => {
  const image = fixtureCase("image only");
  const { onChange } = mountField({ value: { html: image.input } });
  await settle();
  await rewrite();
  expect(onChange).toHaveBeenCalled();
  expect(lastValue(onChange)).not.toBeNull();
  expect(withoutClassAndDir(lastHtml(onChange))).toBe(image.editor);
});

test("a click on an image opens Alt, Caption for a figure, and Remove; Remove takes it out", async () => {
  const { onChange } = mountField({
    value: { html: fixtureCase("image").input },
  });
  await settle();
  await click(editable()!.querySelector("img"));
  expect(inputByLabel("Alt")?.value).toBe("A");
  expect(inputByLabel("Caption")).toBeNull();
  await userEvent.fill(inputByLabel("Alt")!, "A lake");
  await settle();
  expect(lastHtml(onChange)).toContain('alt="A lake"');
  await click(buttonByText("Remove"));
  expect(lastHtml(onChange)).not.toContain("<img");
  expect(lastValue(onChange)?.text.trim()).toBe("Text");

  act(() => {
    root?.unmount();
  });
  container?.remove();
  const figure = mountField({
    value: { html: fixtureCase("figure with a caption").input },
  });
  await settle();
  await click(editable()!.querySelector("img"));
  expect(inputByLabel("Alt")?.value).toBe("A");
  expect(inputByLabel("Caption")?.value).toBe("Caption");
  await userEvent.fill(inputByLabel("Caption")!, "A lake at dawn");
  await settle();
  expect(lastHtml(figure.onChange)).toContain(
    "<figcaption>A lake at dawn</figcaption>"
  );
  await click(buttonByText("Remove"));
  expect(lastHtml(figure.onChange)).not.toContain("<figure");
  expect(lastHtml(figure.onChange)).not.toContain("<img");
});

test("End on a line ending in an image puts the caret after it", async () => {
  const { onChange } = mountField({ value: { html: `<p>See ${IMAGE}</p>` } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await act(async () => {
    editorOf()!.update(() => {
      ($getRoot().getFirstDescendant() as TextNode).select(0, 0);
    });
  });
  await settle();
  await type("{End}x");
  expect(lastHtml(onChange)).toMatch(/<img[^>]*>(<[^>]+>)*x/);
});

test("End on a line ending in an image before a line break stays on that line", async () => {
  const { onChange } = mountField({
    value: { html: `<p>See ${IMAGE}<br>next</p>` },
  });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await act(async () => {
    editorOf()!.update(() => {
      ($getRoot().getFirstDescendant() as TextNode).select(0, 0);
    });
  });
  await settle();
  await type("{End}x");
  expect(lastHtml(onChange)).toMatch(/<img[^>]*>(<[^>]+>)*x(<[^>]+>)*<br>/);
});

test("Shift+End on a line ending in an image selects to after it", async () => {
  const { onChange } = mountField({ value: { html: `<p>See ${IMAGE}</p>` } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await act(async () => {
    editorOf()!.update(() => {
      ($getRoot().getFirstDescendant() as TextNode).select(0, 0);
    });
  });
  await settle();
  await type("{Shift>}{End}{/Shift}x");
  const html = lastHtml(onChange);
  expect(html).not.toContain("<img");
  expect(editable()!.textContent).toBe("x");
});

test("Backspace beside an image removes it and keeps the keyboard in the text", async () => {
  const { onChange } = mountField({
    value: { html: `<p>See ${IMAGE}here</p>` },
  });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await act(async () => {
    editorOf()!.update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      (paragraph.getLastChild() as TextNode).select(0, 0);
    });
  });
  await settle();
  await userEvent.keyboard("{Backspace}");
  await settle();
  expect(inputByLabel("Alt")).toBeNull();
  expect(document.activeElement).toBe(editable());
  expect(lastHtml(onChange)).not.toContain("<img");
  expect(editable()!.textContent).toBe("See here");
});

for (const key of ["Backspace", "Delete"]) {
  test(`${key} on a selected image removes it, and the selection opens no settings`, async () => {
    const { onChange } = mountField({
      value: { html: `<p>See ${IMAGE}here</p>` },
    });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await act(async () => {
      editorOf()!.update(() => {
        const paragraph = $getRoot().getFirstChild() as ElementNode;
        const selection = $createNodeSelection();
        selection.add(paragraph.getChildAtIndex(1)!.getKey());
        $setSelection(selection);
      });
    });
    await settle();
    expect(inputByLabel("Alt")).toBeNull();
    await userEvent.keyboard(`{${key}}`);
    await settle();
    expect(lastHtml(onChange)).not.toContain("<img");
    expect(editable()!.textContent).toBe("See here");
  });
}

test("typing in the middle of Alt keeps the caret where it is", async () => {
  const { onChange } = mountField({
    value: { html: fixtureCase("image").input },
  });
  await settle();
  await click(editable()!.querySelector("img"));
  const alt = inputByLabel("Alt")!;
  alt.setSelectionRange(0, 0);
  await userEvent.keyboard("Big ");
  await settle();
  expect(alt.value).toBe("Big A");
  expect(alt.selectionStart).toBe(4);
  expect(lastHtml(onChange)).toContain('alt="Big A"');
});

test("typing in the middle of Caption keeps the caret where it is (I14, round 4)", async () => {
  const { onChange } = mountField({
    value: { html: fixtureCase("figure with a caption").input },
  });
  await settle();
  await click(editable()!.querySelector("img"));
  const caption = inputByLabel("Caption")!;
  expect(caption.value).toBe("Caption");
  await click(caption);
  caption.setSelectionRange(0, 0);
  await userEvent.keyboard("My ");
  await settle();
  expect(caption.value).toBe("My Caption");
  expect(caption.selectionStart).toBe(3);
  expect(lastHtml(onChange)).toContain("My Caption");
});

/** An image as Lexical's clipboard data carries it. */
const copiedImage = (namespace: string) =>
  JSON.stringify({
    namespace,
    nodes: [
      {
        type: "cms-image",
        version: 1,
        attributes: {
          src: "https://example.org/a.png",
          alt: "A",
          width: null,
          height: null,
          title: null,
        },
      },
    ],
  });

test("an image this field copied pastes back whole", async () => {
  const { onChange } = mountField({ value: { html: "<p>Text</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  paste(editable()!, {
    "application/x-lexical-editor": copiedImage(editorOf()!._config.namespace),
    "text/html": `<p>${IMAGE}</p>`,
  });
  await settle();
  expect(lastHtml(onChange)).toContain('src="https://example.org/a.png"');
  expect(reopenReason(lastHtml(onChange))).toBeUndefined();
});

test("an image in another editor's Lexical data pastes as nothing", async () => {
  const { onChange } = mountField({ value: { html: "<p>Text</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  for (const namespace of ["cms-rich-text", "elsewhere"]) {
    paste(editable()!, {
      "application/x-lexical-editor": copiedImage(namespace),
      "text/html": `<p>${IMAGE}</p>`,
      "text/plain": "",
    });
    await settle();
  }
  expect(editable()!.querySelector("img")).toBeNull();
  expect(lastHtml(onChange) ?? "").not.toContain("<img");
});

test("a drag inside the field carries its nodes, images included", async () => {
  mountField({ value: { html: `<p>See ${IMAGE}here</p>` } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await selectAll();
  const dataTransfer = new DataTransfer();
  act(() => {
    editable()!.dispatchEvent(
      new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  });
  const copied = JSON.parse(
    dataTransfer.getData("application/x-lexical-editor")
  ) as { namespace: string };
  expect(copied.namespace).toBe(editorOf()!._config.namespace);
  expect(JSON.stringify(copied)).toContain('"type":"cms-image"');
  await click(editable()!.querySelector<HTMLElement>("p"));
  drop(editable()!, {
    "application/x-lexical-editor": JSON.stringify(copied),
    "text/html": `<p>See ${IMAGE}here</p>`,
  });
  await settle();
  expect(editable()!.querySelectorAll("img").length).toBeGreaterThan(1);
});

test("pasted HTML with an img keeps no image", async () => {
  const { onChange } = mountField();
  await focusEditor();
  paste(editable()!, {
    "text/html":
      '<p>Hi <img src="https://example.org/a.png" alt="A"></p><figure><img src="https://example.org/b.png"><figcaption>Cap</figcaption></figure>',
    "text/plain": "Hi Cap",
  });
  await settle();
  expect(lastValue(onChange)?.text).toContain("Hi");
  expect(lastHtml(onChange)).not.toMatch(/<(img|figure|figcaption)/);
  expect(editable()!.querySelector("img")).toBeNull();
});

test("a list pasted 8 levels deep saves a value that reopens editable, every item kept (part 3, item 4)", async () => {
  const { onChange } = mountField();
  await focusEditor();
  let html = "<li>level 8</li>";
  for (let level = 7; level >= 1; level -= 1) {
    html = `<li>level ${level}<ul>${html}</ul></li>`;
  }
  paste(editable()!, {
    "text/html": `<ul>${html}</ul>`,
    "text/plain": "levels",
  });
  await settle();
  const saved = lastHtml(onChange) ?? "";
  for (let level = 1; level <= 8; level += 1) {
    expect(saved).toContain(`level ${level}`);
  }
  expect(reopenReason(saved)).toBeUndefined();
});

test("a lossy value with an image shows Read only and no button", async () => {
  const { onChange, onOpenClassic } = mountField({
    value: {
      html: '<figure><img src="https://example.org/a.png" alt="A" /><figcaption><b>Bold</b> caption</figcaption></figure>',
    },
  });
  await settle();
  expect(editable()).toBeNull();
  const readOnly = document.querySelector("[data-cms-rich-text-read-only]");
  expect(readOnly?.textContent).toContain("Bold caption");
  expect(readOnly?.textContent).toContain("Read only");
  expect(document.body.textContent).not.toContain("Classic CMS");
  expect(buttonByText("Classic CMS")).toBeUndefined();
  expect(onOpenClassic).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});

test("FieldControl draws rich text once its chunk has loaded", async () => {
  mount(
    createElement(FieldControl, {
      id: "cms-field-body",
      field: { key: "body", label: "Body", kind: "richtext" },
      value: { html: "<p>Loaded</p>", text: "Loaded" },
      source: createFakeCmsSource(),
      disabled: false,
      invalid: false,
      remountKey: "1",
      onChange: () => {},
      onError: () => {},
    })
  );
  await vi.waitFor(() => expect(editable()?.textContent).toBe("Loaded"));
});

test("a failed chunk load draws the field's line, and the fields around it keep their values", async () => {
  // The boundary takes the failure; the browser still reports it once.
  const swallow = (event: ErrorEvent) => {
    if (String(event.error?.message ?? event.message).includes("chunk")) {
      event.preventDefault();
    }
  };
  window.addEventListener("error", swallow);
  vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const load = vi
      .fn<() => Promise<typeof import("./rich-text-field")>>()
      .mockRejectedValueOnce(new Error("chunk"))
      .mockImplementation(() => import("./rich-text-field"));
    const LazyRichTextField = createLazyRichTextField(load);
    mount(
      createElement(
        "div",
        null,
        createElement(FieldControl, {
          id: "cms-field-title",
          field: { key: "title", label: "Title", kind: "text" },
          value: "Mine",
          source: createFakeCmsSource(),
          disabled: false,
          invalid: false,
          remountKey: "1",
          onChange: () => {},
          onError: () => {},
        }),
        createElement(
          "div",
          { "data-rich": "" },
          createElement(LazyRichTextField, {
            id: "cms-field-body",
            labelId: "cms-field-body-label",
            value: null,
            onChange: () => {},
          })
        )
      )
    );
    const rich = document.querySelector<HTMLElement>("[data-rich]")!;
    await vi.waitFor(() =>
      expect(rich.textContent).toContain("Try again in a minute")
    );
    expect(
      document.querySelector<HTMLInputElement>("#cms-field-title")?.value
    ).toBe("Mine");
    await click(buttonByText("Retry"));
    await vi.waitFor(() =>
      expect(rich.querySelector('[contenteditable="true"]')).not.toBeNull()
    );
    expect(load).toHaveBeenCalledTimes(2);
    expect(rich.textContent).not.toContain("Try again in a minute");
  } finally {
    window.removeEventListener("error", swallow);
  }
});

const IMAGE = '<img src="https://example.org/a.png" alt="A">';

/** Each image in the saved HTML, with whether a link holds it. */
const imagesInLinks = (html: string) =>
  [
    ...new DOMParser()
      .parseFromString(html, "text/html")
      .querySelectorAll("img"),
  ].map((image) => image.closest("a") !== null);

const applyLink = async (href: string) => {
  await click(byLabel("Link"));
  await userEvent.fill(byLabel("URL") as HTMLInputElement, href);
  await click(buttonByText("Apply"));
};

test("Link over a selection reaching a figure leaves no link around it", async () => {
  const { onChange } = mountField({
    value: {
      html: `<p>before</p><figure>${IMAGE}<figcaption>c</figcaption></figure><p>after</p>`,
    },
  });
  await settle();
  await click(
    [...editable()!.querySelectorAll<HTMLElement>("p")].find(
      (paragraph) => paragraph.textContent === "before"
    )
  );
  await selectAll();
  await applyLink("https://example.org/");
  const html = lastHtml(onChange);
  expect(html).toContain("<figure>");
  expect(html).not.toMatch(/<a\b[^>]*>\s*<figure/);
  expect(imagesInLinks(html)).toEqual([false]);
  expect(reopenReason(html)).toBeUndefined();
});

test("Link over a line holding an image links its text and leaves the image outside", async () => {
  const { onChange } = mountField({
    value: { html: `<p>See ${IMAGE} here</p>` },
  });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await selectAll();
  await applyLink("https://example.org/");
  const html = lastHtml(onChange);
  expect(imagesInLinks(html)).toEqual([false]);
  expect(html.match(/<a /g)?.length).toBeGreaterThan(0);
});

test("Code over a line holding an image keeps the image, after the code block", async () => {
  const { onChange } = mountField({
    value: { html: `<p>Join us ${IMAGE} today</p>` },
  });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await chooseBlock("Code");
  const html = lastHtml(onChange);
  expect(html.match(/<img/g)).toHaveLength(1);
  const dom = new DOMParser().parseFromString(html, "text/html");
  expect(dom.querySelector("pre img")).toBeNull();
  expect(dom.querySelector("pre")?.textContent).toContain("Join us");
});

test("a block type chosen with the selection at the root before a first figure changes nothing, and the next change applies", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { onChange } = mountField({
    value: {
      html: `<figure>${IMAGE}<figcaption>c</figcaption></figure><p>after</p>`,
    },
  });
  await settle();
  await focusEditor();
  await selectAll();
  await chooseBlock("Quote");
  // nothing changed and nothing failed
  expect(onChange).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalledWith(expect.any(Error));
  // the editor still takes the next change, with the figure kept
  const after = [...editable()!.querySelectorAll<HTMLElement>("p")].find(
    (paragraph) => paragraph.textContent === "after"
  );
  await userEvent.dblClick(after!);
  await settle();
  await chooseBlock("Quote");
  const html = lastHtml(onChange);
  expect(html).toContain("<figure>");
  expect(html).toMatch(/<blockquote[^>]*>.*after/);
  error.mockRestore();
});

test("pasting a linked image keeps the words around it and leaves no empty link", async () => {
  const { onChange } = mountField();
  await focusEditor();
  paste(editable()!, {
    "text/html": `<p>I love <a href="https://example.org/">${IMAGE}</a> this</p>`,
    "text/plain": "I love  this",
  });
  await settle();
  const html = lastHtml(onChange);
  expect(lastValue(onChange)?.text).toContain("I love this");
  expect(html).not.toContain("<a");
  expect(html).not.toContain("<img");
  expect(reopenReason(html)).toBeUndefined();
});

test("select all over an image keeps the keyboard in the text", async () => {
  mountField({ value: { html: `<p>See ${IMAGE} here</p>` } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await selectAll();
  expect(document.activeElement).toBe(editable());
});

test("Link over a rule leaves no link around it", async () => {
  const { onChange } = mountField({ value: { html: "<p>a</p><hr><p>b</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await selectAll();
  await applyLink("https://example.org/");
  expect(lastHtml(onChange)).not.toMatch(/<a\b[^>]*>\s*<hr/);
});

test("Remove over a linked line with an image keeps the image and drops the link", async () => {
  const { onChange } = mountField({
    value: {
      html: `<p><a href="https://example.org/">See</a> ${IMAGE} here</p>`,
    },
  });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await selectAll();
  await click(byLabel("Link"));
  await click(buttonByText("Remove"));
  const html = lastHtml(onChange);
  expect(html).not.toContain("<a");
  expect(html).toContain("<img");
});

test("pasting a link around a heading writes the link inside the heading, and the value stays editable", async () => {
  const { onChange } = mountField({ value: { html: "<p>x</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await type("{End}");
  paste(editable()!, {
    "text/html": '<a href="https://example.org/post"><h2>Post title</h2></a>',
    "text/plain": "Post title",
  });
  await settle();
  const html = lastHtml(onChange);
  expect(html).not.toMatch(/<a\b[^>]*>\s*<h2/);
  expect(reopenReason(html)).toBeUndefined();
});

test.each(fixture.readOnly.map((entry) => [entry.name, entry] as const))(
  "the live field opens the fixture's read-only entry %s read-only, writing nothing",
  async (_name, entry) => {
    const { onChange } = mountField({ value: { html: entry.input } });
    await settle();
    expect(editable()).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  }
);

test("Shift+Enter in an empty paragraph saves its line break, and the value still opens editable", async () => {
  const { onChange } = mountField({ value: { html: "<p>x</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await type("{End}{Enter}");
  await type("{Shift>}{Enter}{/Shift}");
  const html = lastHtml(onChange);
  expect(withoutClassAndDir(html)).toMatch(/<p><br><\/p>$/);
  expect(reopenReason(html)).toBeUndefined();
});

const textOf = (html: string) =>
  html.replace(/<span[^>]*>/g, "").replace(/<\/span>/g, "");

test("Shift+Enter in an empty bullet saves a value that still opens editable", async () => {
  const { onChange } = mountField({ value: { html: "<ul><li>x</li></ul>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("li"));
  await type("{End}{Enter}");
  await type("{Shift>}{Enter}{/Shift}");
  const html = lastHtml(onChange);
  expect(withoutClassAndDir(html)).toMatch(/<li[^>]*><br><\/li><\/ul>/);
  expect(reopenReason(html)).toBeUndefined();
});

test.each([
  ["a bullet", "<ul><li>one</li></ul>", "li"],
  ["a paragraph", "<p>one</p>", "p"],
])(
  "Shift+Enter at the end of %s writes its line break, and the value reloads editable",
  async (_name, value, tag) => {
    const { onChange } = mountField({ value: { html: value } });
    await settle();
    await click(editable()!.querySelector<HTMLElement>(tag));
    await type("{End}");
    await type("{Shift>}{Enter}{/Shift}");
    const html = lastHtml(onChange);
    // V11: a stored value's load keeps every line break, so one is written
    expect(textOf(html)).toMatch(new RegExp(`one<br></${tag}>`));
    expect(reopenReason(html)).toBeUndefined();
  }
);

test("pasting a link around an article moves the link into its blocks", async () => {
  const { onChange } = mountField({ value: { html: "<p>x</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  await type("{End}");
  paste(editable()!, {
    "text/html":
      '<a href="https://example.org/"><article><h3>Title</h3><p>Desc</p></article></a>',
    "text/plain": "Title Desc",
  });
  await settle();
  const html = lastHtml(onChange);
  expect(html).not.toMatch(/<a\b[^>]*>\s*<(h3|p|article)/);
  expect(reopenReason(html)).toBeUndefined();
});

test.each([
  '<p><a href="https://e.org/"><h2>Title</h2></a></p>',
  "<strong><p>Bold</p></strong>",
])("the live field opens %s read-only, writing nothing", async (html) => {
  const { onChange } = mountField({ value: { html } });
  await settle();
  expect(editable()).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

// exact-guard round, item 2: every toolbar command over a whole editable
// corpus value saves a value that reopens editable, on every twentieth one (the
// corpus orders its matrix by shape, so this spans every shape it crosses),
// plus each value a run over the whole set found locking
const corpusSample = [
  ...corpus.entries
    .filter((entry) => entry.verdict === "editable")
    .filter((_entry, index) => index % 20 === 0)
    .map((entry) => entry.input),
  // the values the full set (every editable entry, every command) locked
  "<p>z</p><ul><li> <ul><li>n</li></ul></li></ul>",
];

const toolbarActions: Array<[string, () => Promise<void>]> = [
  ["Bold", () => click(byLabel("Bold"))],
  ["Italic", () => click(byLabel("Italic"))],
  ["Bulleted list", () => click(byLabel("Bulleted list"))],
  ["Numbered list", () => click(byLabel("Numbered list"))],
  ["Quote", () => chooseBlock("Quote")],
  ["Heading 2", () => chooseBlock("Heading 2")],
  ["Code", () => chooseBlock("Code")],
  ["Paragraph", () => chooseBlock("Paragraph")],
  ["Link", () => applyLink("https://example.org/")],
];

describe("every toolbar command over a corpus value reopens editable", () => {
  test.each(toolbarActions)(
    "%s",
    async (_name, run) => {
      const locked: string[] = [];
      for (const html of corpusSample) {
        const { onChange } = mountField({ value: { html } });
        await settle();
        const first = editable()?.querySelector<HTMLElement>(
          "p, li, h2, h3, h4, blockquote, code"
        );
        if (first !== null && first !== undefined) {
          await click(first);
          await selectAll();
          await run();
          const written = lastHtml(onChange);
          if (written !== "" && reopenReason(written) !== undefined) {
            locked.push(html);
          }
        }
        act(() => {
          root?.unmount();
        });
        container?.remove();
        root = undefined;
        container = undefined;
      }
      expect(locked).toEqual([]);
    },
    600_000
  );
});

// Round 4: the keyboard beside an inline image
describe("the keyboard beside an inline image (round 4)", () => {
  const caretAtEndOf = async (html: string) => {
    mountField({ value: { html } });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await act(async () => {
      editorOf()!.update(() => {
        const paragraph = $getRoot().getFirstChild() as ElementNode;
        paragraph.select(
          paragraph.getChildrenSize(),
          paragraph.getChildrenSize()
        );
      });
    });
    await settle();
  };

  test("End, ArrowLeft, then typing lands beside the image, and Alt never opens (item 5)", async () => {
    const { onChange } = mountField({
      value: { html: `<p>Alpha ${IMAGE}</p>` },
    });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await act(async () => {
      editorOf()!.update(() => {
        ($getRoot().getFirstDescendant() as TextNode).select(0, 0);
      });
    });
    await settle();
    await type("{End}{ArrowLeft}xy");
    expect(inputByLabel("Alt")).toBeNull();
    expect(lastHtml(onChange)).toMatch(/Alpha xy(<[^>]+>)*<img/);
    expect(editable()!.textContent).toBe("Alpha xy");
  });

  test("ArrowRight before an image steps past it, and typing lands after it (item 5)", async () => {
    const { onChange } = mountField({
      value: { html: `<p>Alpha ${IMAGE}</p>` },
    });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await act(async () => {
      editorOf()!.update(() => {
        const text = $getRoot().getFirstDescendant() as TextNode;
        text.select(text.getTextContentSize(), text.getTextContentSize());
      });
    });
    await settle();
    await type("{ArrowRight}z");
    expect(inputByLabel("Alt")).toBeNull();
    expect(lastHtml(onChange)).toMatch(/<img[^>]*>(<[^>]+>)*z/);
  });

  test("End at the end of a line after a break stays on that line; typing keeps both images (item 6)", async () => {
    await caretAtEndOf(`<p>${IMAGE}<br>${IMAGE}</p>`);
    await type("{End}x");
    const html = editable()!.innerHTML;
    expect(html.match(/<img/g)?.length).toBe(2);
    expect(html).toMatch(/<br>(<[^>]+>)*<img[^>]*>(<[^>]+>)*x/);
  });

  test("Shift+End at the end of a line after a break, then typing, keeps the break and both images (item 6)", async () => {
    await caretAtEndOf(`<p>${IMAGE}<br>${IMAGE}</p>`);
    await type("{Shift>}{End}{/Shift}x");
    const html = editable()!.innerHTML;
    expect(html.match(/<img/g)?.length).toBe(2);
    expect(html).toContain("<br>");
    expect(html).toMatch(/<img[^>]*>(<[^>]+>)*x/);
  });

  test("Enter on a selected image opens its settings, with the focus in Alt (item 7)", async () => {
    const { onChange } = mountField({
      value: { html: `<p>See ${IMAGE}here</p>` },
    });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await act(async () => {
      editorOf()!.update(() => {
        const paragraph = $getRoot().getFirstChild() as ElementNode;
        const selection = $createNodeSelection();
        selection.add(paragraph.getChildAtIndex(1)!.getKey());
        $setSelection(selection);
      });
    });
    await settle();
    await type("{Enter}");
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(inputByLabel("Alt"))
    );
    await type("Z");
    expect(lastHtml(onChange)).toContain('alt="AZ"');
    expect(editable()!.textContent).toBe("See here");
  });
});

// Round 4, item 8: a field's clipboard data survives its remount (a Save,
// Reload or "Use my edit"), so an image cut before one pastes back
test("an image copied before the field remounts pastes back whole", async () => {
  const onChange = vi.fn();
  const control = (remountKey: string) =>
    createElement(FieldControl, {
      id: "cms-field-body",
      field: { key: "body", label: "Body", kind: "richtext" },
      value: { html: "<p>Text</p>", text: "Text" },
      source: createFakeCmsSource(),
      disabled: false,
      invalid: false,
      remountKey,
      onChange,
      onError: () => {},
    });
  mount(control("1"));
  await vi.waitFor(() => expect(editable()?.textContent).toBe("Text"));
  const before = editorOf()!._config.namespace;
  act(() => {
    root?.render(createElement(TooltipProvider, null, control("2")));
  });
  await vi.waitFor(() => expect(editorOf()?._config.namespace).toBeDefined());
  await settle();
  expect(editorOf()!._config.namespace).toBe(before);
  await click(editable()!.querySelector<HTMLElement>("p"));
  paste(editable()!, {
    "application/x-lexical-editor": copiedImage(before),
    "text/html": `<p>${IMAGE}</p>`,
  });
  await settle();
  expect(lastHtml(onChange)).toContain('src="https://example.org/a.png"');
});

// Round 4, item 17: an image node in the field's own clipboard data is kept
// only as this editor writes one
test.each([
  [
    "a javascript: address",
    {
      src: "javascript:alert(1)",
      alt: "A",
      width: null,
      height: null,
      title: null,
    },
  ],
  [
    "an extra attribute",
    {
      src: "https://example.org/a.png",
      alt: "A",
      width: null,
      height: null,
      title: null,
      onerror: "x",
    },
  ],
  ["no attributes", undefined],
])("an own image node with %s pastes as nothing", async (_name, attributes) => {
  const { onChange } = mountField({ value: { html: "<p>Text</p>" } });
  await settle();
  await click(editable()!.querySelector<HTMLElement>("p"));
  const node: Record<string, unknown> = { type: "cms-image", version: 1 };
  if (attributes !== undefined) {
    node.attributes = attributes;
  }
  paste(editable()!, {
    "application/x-lexical-editor": JSON.stringify({
      namespace: editorOf()!._config.namespace,
      nodes: [node],
    }),
    "text/html": "<p>x</p>",
    "text/plain": "x",
  });
  await settle();
  expect(editable()!.querySelector("img")).toBeNull();
  expect(lastHtml(onChange)).not.toContain("<img");
});

// self-lock decision, 4a: a paste into a nested item never leaves a block
// after the nested list
describe("blocks pasted into a nested list item (self-lock decision, 4a)", () => {
  const caretAtB = async () => {
    const field = mountField({
      value: { html: "<ul><li>a<ul><li>b</li></ul></li></ul>" },
    });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("li li"));
    await act(async () => {
      editorOf()!.update(() => {
        const b = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === "b")!;
        b.select(1, 1);
      });
    });
    await settle();
    return field;
  };
  /** The saved value reopens editable, and a load and save keeps it. */
  const expectFixedPoint = (html: string) => {
    const stored = sanitizeRichTextHtml(html);
    expect(reopenReason(html)).toBeUndefined();
    expect(sanitizeRichTextHtml(writeRichTextHeadless(stored))).toBe(stored);
  };

  test.each([
    ["two paragraphs", "<p>one</p><p>two</p>"],
    ["a paragraph and a rule", "<p>one</p><hr>"],
    ["a code block", "<pre><code>c1\nc2</code></pre>"],
    ["a quote", "<blockquote><p>q</p></blockquote>"],
    [
      "a web snippet",
      '<h3>Minutes</h3><p>Approved.</p><p>Next <a href="https://e.org/">here</a>.</p>',
    ],
  ])("%s: the value reopens editable and is a fixed point", async (_, html) => {
    const { onChange } = await caretAtB();
    paste(editable()!, { "text/html": html, "text/plain": "x" });
    await settle();
    const written = lastHtml(onChange) ?? "";
    expect(written).not.toBe("");
    expectFixedPoint(written);
  });

  test("an image paragraph from the field's own clipboard: the value reopens editable and keeps the image", async () => {
    const { onChange } = await caretAtB();
    paste(editable()!, {
      "application/x-lexical-editor": JSON.stringify({
        namespace: editorOf()!._config.namespace,
        nodes: [
          {
            type: "paragraph",
            version: 1,
            children: [
              {
                type: "text",
                version: 1,
                text: "one",
                format: 0,
                detail: 0,
                mode: "normal",
                style: "",
              },
            ],
            direction: null,
            format: "",
            indent: 0,
            textFormat: 0,
            textStyle: "",
          },
          {
            type: "paragraph",
            version: 1,
            children: [
              JSON.parse(copiedImage(editorOf()!._config.namespace)).nodes[0],
            ],
            direction: null,
            format: "",
            indent: 0,
            textFormat: 0,
            textStyle: "",
          },
        ],
      }),
      "text/html": `<p>one</p><p>${IMAGE}</p>`,
    });
    await settle();
    const written = lastHtml(onChange) ?? "";
    expect(written).toContain('src="https://example.org/a.png"');
    expectFixedPoint(written);
  });
});

// round 5, item 3: the keyboard model for images (keys only, from a caret)
describe("the keyboard reaches an image (round 5)", () => {
  const FIGURE =
    '<figure><img src="https://example.org/a.png" alt="A" /><figcaption>Caption</figcaption></figure>';
  /** Mounts `html` with a text caret at the end of the text `word`. */
  const caretAfter = async (html: string, word: string) => {
    const field = mountField({ value: { html } });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await act(async () => {
      editorOf()!.update(() => {
        const text = $getRoot()
          .getAllTextNodes()
          .find((node) => node.getTextContent() === word)!;
        text.select(text.getTextContentSize(), text.getTextContentSize());
      });
    });
    await settle();
    return field;
  };
  const inEditor = () => editable()?.contains(document.activeElement) === true;
  const cases = [
    // each from plain text and from a link's edge, which the browser's own
    // arrow passes over
    {
      name: "an inline image",
      starts: [
        { html: `<p>See ${IMAGE}here</p>`, word: "See " },
        {
          html: `<p><a href="https://e.org/">See </a>${IMAGE}here</p>`,
          word: "See ",
        },
      ],
      typed: /See (<[^>]+>)*<img[^>]*>(<[^>]+>)*xy/,
    },
    {
      name: "a figure",
      starts: [
        { html: `<p>Before</p>${FIGURE}<p>After</p>`, word: "Before" },
        {
          html: `<p><a href="https://e.org/">Before</a></p>${FIGURE}<p>After</p>`,
          word: "Before",
        },
      ],
      typed: /<figure[\s\S]*<\/figure>[\s\S]*xy[\s\S]*After/,
    },
  ];
  /** Runs `check` from each start, remounting the field between them. */
  const fromEach = async (
    starts: { html: string; word: string }[],
    check: (onChange: ReturnType<typeof vi.fn>) => Promise<void>
  ) => {
    for (const [index, { html, word }] of starts.entries()) {
      if (index > 0) {
        act(() => {
          root?.unmount();
        });
        container?.remove();
      }
      const { onChange } = await caretAfter(html, word);
      await check(onChange);
    }
  };

  test.each(cases)(
    "$name: an arrow selects it, Enter opens its settings, and Alt takes what is typed",
    async ({ starts }) => {
      await fromEach(starts, async (onChange) => {
        await type("{ArrowRight}");
        expect(inputByLabel("Alt")).toBeNull();
        await type("{Enter}");
        const alt = inputByLabel("Alt")!;
        expect(alt).not.toBeNull();
        expect(document.activeElement).toBe(alt);
        await userEvent.keyboard("{Control>}a{/Control}Lake");
        await settle();
        expect(lastHtml(onChange)).toContain('alt="Lake"');
      });
    }
  );

  test.each(cases)(
    "$name: an arrow onto it, then typing, lands beside it with Alt closed",
    async ({ starts, typed }) => {
      await fromEach(starts, async (onChange) => {
        await type("{ArrowRight}xy");
        expect(inputByLabel("Alt")).toBeNull();
        expect(lastHtml(onChange)).toMatch(typed);
      });
    }
  );

  test.each(cases)(
    "$name: Enter, then Escape, gives the editor the focus, and typing lands beside it",
    async ({ starts, typed }) => {
      await fromEach(starts, async (onChange) => {
        await type("{ArrowRight}{Enter}");
        expect(inputByLabel("Alt")).not.toBeNull();
        await userEvent.keyboard("{Escape}");
        await settle();
        expect(inputByLabel("Alt")).toBeNull();
        expect(inEditor()).toBe(true);
        await type("xy");
        expect(lastHtml(onChange)).toMatch(typed);
      });
    }
  );
});

// round 5, item 4: End from an element caret after a line break
describe("End from a caret right after a line break (round 5)", () => {
  const A = '<img src="https://example.org/a.png" alt="A">';
  const B = '<img src="https://example.org/b.png" alt="B">';
  /** Mounts `html`, with an element caret right after its line break. */
  const caretAfterBreak = async (html: string) => {
    const field = mountField({ value: { html } });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    await act(async () => {
      editorOf()!.update(() => {
        const paragraph = $getRoot().getFirstChild() as ElementNode;
        const index = paragraph
          .getChildren()
          .findIndex((child) => child.getType() === "linebreak");
        paragraph.select(index + 1, index + 1);
      });
    });
    await settle();
    return field;
  };
  const shapes = [
    { html: `<p>${A}<br>${B}</p>`, before: "", after: "" },
    { html: `<p>aa ${A}<br>${B} cc</p>`, before: "aa ", after: " cc" },
  ];

  test.each(shapes)(
    "End, then typing, lands at the line's end: $html",
    async ({ html, after }) => {
      const { onChange } = await caretAfterBreak(html);
      await type("{End}x");
      const written = lastHtml(onChange) ?? "";
      expect(written.match(/<img/g)?.length).toBe(2);
      expect(written).toMatch(
        new RegExp(
          `a\\.png[^>]*>[\\s\\S]*<br>[\\s\\S]*b\\.png[^>]*>[\\s\\S]*${after.trim()}x`
        )
      );
    }
  );

  test.each(shapes)(
    "Shift+End, then Backspace, keeps the line above and its image: $html",
    async ({ html, before }) => {
      const { onChange } = await caretAfterBreak(html);
      await type("{Shift>}{End}{/Shift}{Backspace}");
      const written = lastHtml(onChange) ?? editable()!.innerHTML;
      expect(written).toContain("a.png");
      expect(written).toContain("<br>");
      if (before !== "") {
        expect(written).toContain(before.trim());
      }
      expect(written).not.toContain("b.png");
    }
  );
});

// round 5, item 8: the field's own clipboard keeps any image address the
// platform's sanitiser keeps
test.each(["//cdn.example.org/a.png", "/media/a.png"])(
  "an image this field copied, with the address %s, pastes back whole (round 5)",
  async (src) => {
    const html = `<p>Text <img src="${src}" alt="A"></p>`;
    expect(reopenReason(html)).toBeUndefined();
    const { onChange } = mountField({ value: { html: "<p>Text</p>" } });
    await settle();
    await click(editable()!.querySelector<HTMLElement>("p"));
    const data = JSON.parse(copiedImage(editorOf()!._config.namespace));
    data.nodes[0].attributes.src = src;
    paste(editable()!, {
      "application/x-lexical-editor": JSON.stringify(data),
      "text/html": `<p><img src="${src}" alt="A"></p>`,
    });
    await settle();
    expect(lastHtml(onChange)).toContain(`src="${src}"`);
  }
);

// B2: a list made over quoted images and blank lines writes line breaks
// the save backstop must not fold into each other
test.each([
  '<blockquote><p>Sounds good</p><p><br></p><blockquote><p><img src="https://example.org/a.png" alt="A"></p><p><br></p><p><img src="https://example.org/b.png" alt="B"></p></blockquote></blockquote>',
  '<blockquote><blockquote><p><img src="https://example.org/a.png" alt="A"></p><p><img src="https://example.org/b.png" alt="B"></p></blockquote></blockquote>',
  "<blockquote><blockquote><hr><p><br></p><ul><li>one</li></ul></blockquote></blockquote>",
])(
  "Bulleted list over all of %s writes a value a save does not settle",
  async (html) => {
    expect(reopenReason(html)).toBeUndefined();
    const { onChange } = mountField({ value: { html } });
    await settle();
    await focusEditor();
    await selectAll();
    await click(byLabel("Bulleted list"));
    const written = lastHtml(onChange);
    expect(settleRichTextHtml(written).outcome).not.toBe("settled");
  }
);
