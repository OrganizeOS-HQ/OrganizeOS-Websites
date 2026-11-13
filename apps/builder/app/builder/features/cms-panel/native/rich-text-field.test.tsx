// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type LexicalEditor,
} from "lexical";
import { $createLinkNode, $isLinkNode } from "@lexical/link";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";
import { createLazyRichTextField, FieldControl } from "./field-controls";
import { createFakeCmsSource } from "./fake-cms-source";
import fixture from "./__fixtures__/rich-text-roundtrip.json";
import { getRichTextReadOnlyReason } from "./rich-text-html";

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
      namespace: "cms-rich-text",
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

test("selecting an image opens Alt, Caption for a figure, and Remove; Remove takes it out", async () => {
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
  expect(getRichTextReadOnlyReason(html)).toBeUndefined();
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
  expect(getRichTextReadOnlyReason(html)).toBeUndefined();
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
  expect(getRichTextReadOnlyReason(html)).toBeUndefined();
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
