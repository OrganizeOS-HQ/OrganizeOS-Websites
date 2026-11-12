// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";
import { createLazyRichTextField, FieldControl } from "./field-controls";
import { createFakeCmsSource } from "./fake-cms-source";
import fixture from "./__fixtures__/rich-text-roundtrip.json";

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

const lossy = fixture.readOnly.find((entry) => entry.reason === "lossy");
test.runIf(lossy !== undefined)(
  "a value the editor would not keep whole is read-only with Edit in Classic CMS",
  async () => {
    const { onOpenClassic } = mountField({ value: { html: lossy!.input } });
    await settle();
    expect(editable()).toBeNull();
    expect(document.body.textContent).toContain("Edit in Classic CMS");
    await click(buttonByText("Classic CMS"));
    expect(onOpenClassic).toHaveBeenCalledTimes(1);
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

test("a value with images is read-only, with its text, its line and Classic CMS", async () => {
  const image = fixture.readOnly.find((entry) => entry.name === "image")!;
  const { onChange, onOpenClassic } = mountField({
    value: { html: image.input },
  });
  await settle();
  expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  expect(
    document.querySelector("[data-cms-rich-text-read-only]")?.textContent
  ).toContain("Text");
  expect(document.body.textContent).toContain(
    "Has images; edit in Classic CMS"
  );
  await click(buttonByText("Classic CMS"));
  expect(onOpenClassic).toHaveBeenCalledTimes(1);
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
