// The live editor's node rules on every update: a code block stays plain, a
// figure stays at the top level, a list item stays in a list, and an element
// caret between a quote's or item's blocks edits as a text caret.
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  $createNodeSelection,
  $createRangeSelection,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $setSelection,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from "lexical";
import { $createLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $createListItemNode } from "@lexical/list";
import { $createHeadingNode } from "@lexical/rich-text";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import { getRichTextReadOnlyReason } from "./rich-text-html";
import {
  $createCmsFigureNode,
  $createCmsImageNode,
} from "./rich-text-image-node";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

const mount = (node: ReactElement) => {
  container = document.createElement("div");
  container.style.width = "480px";
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

const mountField = (html: string) => {
  const onChange = vi.fn<RichTextFieldProps["onChange"]>();
  mount(
    createElement(RichTextField, {
      id: "cms-field-body",
      labelId: "cms-field-body-label",
      value: { html },
      onChange,
    })
  );
  return onChange;
};

const editable = () =>
  document.querySelector<HTMLElement>('[contenteditable="true"]');

const editorOf = () =>
  (editable() as (HTMLElement & { __lexicalEditor?: LexicalEditor }) | null)
    ?.__lexicalEditor;

const byLabel = (label: string) =>
  document.querySelector<HTMLElement>(`[aria-label="${label}"]`);

const lastHtml = (onChange: ReturnType<typeof vi.fn>) =>
  (onChange.mock.lastCall?.[0] as { html: string } | null)?.html ?? "";

const reopenReason = (html: string) =>
  getRichTextReadOnlyReason(sanitizeRichTextHtml(html));

const update = async (fn: () => void) => {
  await act(async () => {
    editorOf()!.update(fn);
  });
  await settle();
};

const focus = async () => {
  await act(async () => {
    editable()!.focus();
  });
  await settle();
};

const textNode = (text: string) =>
  $getRoot()
    .getAllTextNodes()
    .find((node) => node.getTextContent() === text) as TextNode;

const caretAtEnd = (text: string) => () => {
  const node = textNode(text);
  node.select(node.getTextContentSize(), node.getTextContentSize());
};

const caretAtStart = (text: string) => () => {
  textNode(text).select(0, 0);
};

const firstOfType = (type: string): LexicalNode => {
  const visit = (node: LexicalNode): LexicalNode | undefined => {
    if (node.getType() === type) {
      return node;
    }
    if ($isElementNode(node)) {
      for (const child of node.getChildren()) {
        const found = visit(child);
        if (found !== undefined) {
          return found;
        }
      }
    }
  };
  return visit($getRoot())!;
};

const selectNode = (type: string) => () => {
  const selection = $createNodeSelection();
  selection.add(firstOfType(type).getKey());
  $setSelection(selection);
};

/** Dispatches a copy or cut on the editor and returns what it wrote. */
const clipboard = async (kind: "copy" | "cut") => {
  const clipboardData = new DataTransfer();
  await act(async () => {
    editable()!.dispatchEvent(
      new ClipboardEvent(kind, {
        bubbles: true,
        cancelable: true,
        clipboardData,
      })
    );
  });
  await settle();
  const data: Record<string, string> = {};
  for (const type of clipboardData.types) {
    data[type] = clipboardData.getData(type);
  }
  return data;
};

const paste = async (data: Record<string, string>) => {
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
};

const imagesIn = (html: string) => html.match(/<img\b[^>]*>/g) ?? [];

const IMG_A = '<img src="https://example.org/a.png" alt="A" />';
const FIGURE =
  '<figure><img src="https://e.org/f.png" alt="F" /><figcaption>Cap</figcaption></figure>';

describe("a code block stays plain on every update (B1, B10, B17)", () => {
  test("a paragraph with an image cut and pasted into code: the text goes in, the image after the block", async () => {
    const onChange = mountField(
      `<p>one ${IMG_A} two</p><pre><code>abc</code></pre>`
    );
    await settle();
    await focus();
    await update(() => {
      const paragraph = $getRoot().getFirstChild() as ElementNode;
      paragraph.select(0, paragraph.getChildrenSize());
    });
    const data = await clipboard("cut");
    await update(caretAtEnd("abc"));
    await paste(data);
    const written = lastHtml(onChange);
    expect(written).toMatch(/<pre><code>abcone {1,2}two<\/code><\/pre>/);
    expect(imagesIn(written)).toHaveLength(1);
    expect(written.indexOf("<img")).toBeGreaterThan(written.indexOf("</pre>"));
    expect(editable()!.querySelector("code img, pre img")).toBeNull();
    expect(reopenReason(written)).toBeUndefined();
  });

  test.each([
    ["an inline image", `<p>x ${IMG_A} y</p>`, "img"],
    ["an image paragraph", `<p>${IMG_A}</p>`, "paragraph"],
    ["a figure", FIGURE, "cms-figure"],
    [
      "a quote with an image",
      `<blockquote><p>q ${IMG_A}</p></blockquote>`,
      "quote",
    ],
  ])(
    "%s from the field's own clipboard pasted into code keeps every image, after the block",
    async (_name, source, copied) => {
      const onChange = mountField(
        `<p>start</p>${source}<pre><code>qwo</code></pre>`
      );
      await settle();
      await focus();
      if (copied === "cms-figure") {
        await update(selectNode("cms-figure"));
      } else if (copied === "img") {
        await update(selectNode("cms-image"));
      } else {
        await update(() => {
          const block = $getRoot().getChildAtIndex(1) as ElementNode;
          block.select(0, block.getChildrenSize());
        });
      }
      const data = await clipboard("copy");
      expect(data["application/x-lexical-editor"]).toBeDefined();
      await update(() => {
        textNode("qwo").select(1, 1);
      });
      await paste(data);
      const written = lastHtml(onChange);
      const before = imagesIn(sanitizeRichTextHtml(source)).length;
      expect(imagesIn(written)).toHaveLength(before * 2);
      const code = written.indexOf("<pre>");
      const codeEnd = written.indexOf("</pre>");
      expect(written.slice(code, codeEnd)).not.toContain("<img");
      expect(written.lastIndexOf("<img")).toBeGreaterThan(codeEnd);
      expect(editable()!.querySelector("code img, pre img")).toBeNull();
      expect(reopenReason(written)).toBeUndefined();
    }
  );

  test("paragraphs with bold and a link pasted into code show what saves", async () => {
    const onChange = mountField("<pre><code>abc</code></pre><p>para</p>");
    await settle();
    await focus();
    await update(caretAtEnd("abc"));
    await paste({
      "text/html": '<p><b>one</b></p><p><a href="https://e.org/">two</a></p>',
      "text/plain": "one\n\ntwo",
    });
    const written = lastHtml(onChange);
    const pre = editable()!.querySelector("pre, code")!;
    expect(pre.querySelector("a, b, strong, p, h2, li")).toBeNull();
    expect(written).not.toMatch(/<(strong|b|a)\b/);
    expect(written).toContain("abcone");
    expect(written).toContain("two");
    expect(reopenReason(written)).toBeUndefined();
    // the editor shows what the save writes: each line on screen is a line
    // of the code block
    expect((pre as HTMLElement).innerText.replace(/\n+$/, "")).toBe(
      new DOMParser()
        .parseFromString(written, "text/html")
        .querySelector("code")!.textContent
    );
  });

  test("blocks put inside a code block by an update flatten to lines, with no format or link at any depth", async () => {
    const onChange = mountField("<pre><code>abc</code></pre>");
    await settle();
    await update(() => {
      const code = $getRoot().getFirstChild() as ElementNode;
      const paragraph = $createParagraphNode();
      const link = $createLinkNode("https://e.org/");
      const text = $createTextNode("deep");
      text.setFormat("bold");
      link.append(text);
      const heading = $createHeadingNode("h2");
      heading.append($createTextNode("head"));
      paragraph.append(link);
      code.append(paragraph, heading);
    });
    const written = lastHtml(onChange);
    expect(written).toBe("<pre><code>abc\ndeep\nhead</code></pre>");
    expect(
      editable()!.querySelector("pre a, pre b, pre strong, pre p, pre h2")
    ).toBeNull();
    expect(reopenReason(written)).toBeUndefined();
  });

  test("an image and a figure put inside a code block by an update move after it, in order", async () => {
    const onChange = mountField("<pre><code>abc</code></pre>");
    await settle();
    await update(() => {
      const code = $getRoot().getFirstChild() as ElementNode;
      const attributes = {
        src: "https://example.org/a.png",
        alt: "A",
        width: null,
        height: null,
        title: null,
      };
      code.append(
        $createCmsImageNode(attributes),
        $createCmsFigureNode({ ...attributes, alt: "F" }, "Cap")
      );
    });
    const written = lastHtml(onChange);
    expect(written).toMatch(
      /^<pre><code>abc<\/code><\/pre><p[^>]*><img[^>]*alt="A"[^>]*><\/p><figure><img[^>]*alt="F"[^>]*><figcaption>Cap<\/figcaption><\/figure>$/
    );
    expect(editable()!.querySelector("pre img, code img")).toBeNull();
    expect(reopenReason(written)).toBeUndefined();
  });

  test("the marks and Link are disabled and unpressed in code", async () => {
    mountField("<p><b>bold</b></p><pre><code>abc</code></pre>");
    await settle();
    await focus();
    await update(caretAtEnd("bold"));
    expect(byLabel("Bold")?.getAttribute("aria-pressed")).toBe("true");
    expect(byLabel("Bold")?.hasAttribute("disabled")).toBe(false);
    await update(caretAtEnd("abc"));
    for (const label of [
      "Bold",
      "Italic",
      "Underline",
      "Strikethrough",
      "Link",
    ]) {
      expect(byLabel(label)?.hasAttribute("disabled"), label).toBe(true);
      expect(byLabel(label)?.getAttribute("aria-pressed"), label).not.toBe(
        "true"
      );
    }
  });
});

const QUOTE_SHAPES = [
  ["a quote", "<blockquote><p>qq</p></blockquote>"],
  [
    "a nested quote",
    "<blockquote><blockquote><p>qq</p></blockquote></blockquote>",
  ],
  ["a list inside a quote", "<blockquote><ul><li>qq</li></ul></blockquote>"],
] as const;

describe("a figure pasted into a quote stands at the top level (B7)", () => {
  const textOrder = (html: string) =>
    new DOMParser().parseFromString(
      html.replace(/<img\b[^>]*>/g, "[img]"),
      "text/html"
    ).body.textContent ?? "";

  test.each(QUOTE_SHAPES)(
    "a copied figure pasted at the end of %s writes an editable value, nothing lost",
    async (_name, quote) => {
      const onChange = mountField(`<p>xx</p>${FIGURE}${quote}`);
      await settle();
      await focus();
      await update(selectNode("cms-figure"));
      const data = await clipboard("copy");
      await update(caretAtEnd("qq"));
      await paste(data);
      const written = lastHtml(onChange);
      expect(imagesIn(written)).toHaveLength(2);
      expect(textOrder(written)).toBe("xx[img]Capqq[img]Cap");
      expect(reopenReason(written)).toBeUndefined();
    }
  );

  test.each(QUOTE_SHAPES)(
    "a copied figure pasted at the start of %s writes an editable value, nothing lost",
    async (_name, quote) => {
      const onChange = mountField(`<p>xx</p>${FIGURE}${quote}`);
      await settle();
      await focus();
      await update(selectNode("cms-figure"));
      const data = await clipboard("copy");
      await update(caretAtStart("qq"));
      await paste(data);
      const written = lastHtml(onChange);
      expect(imagesIn(written)).toHaveLength(2);
      expect(textOrder(written)).toBe("xx[img]Cap[img]Capqq");
      expect(reopenReason(written)).toBeUndefined();
    }
  );

  test("a range copied over a figure, pasted into a quote, writes an editable value in order", async () => {
    const onChange = mountField(
      `<p>xx</p>${FIGURE}<p>yy</p><blockquote><p>qq</p></blockquote>`
    );
    await settle();
    await focus();
    await update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(textNode("xx").getKey(), 1, "text");
      selection.focus.set(textNode("yy").getKey(), 1, "text");
      $setSelection(selection);
    });
    const data = await clipboard("copy");
    await update(caretAtEnd("qq"));
    await paste(data);
    const written = lastHtml(onChange);
    expect(imagesIn(written)).toHaveLength(2);
    expect(textOrder(written)).toBe("xx[img]Capyyqqx[img]Capy");
    expect(reopenReason(written)).toBeUndefined();
  });
});

describe("a list item stands in a list (B8)", () => {
  test.each([
    "<blockquote><li>x</li></blockquote>",
    "<h2><li>x</li></h2>",
    "<blockquote><p>a</p><li><p>x</p></li></blockquote>",
  ])("pasting %s writes an editable value", async (html) => {
    const onChange = mountField("<p>hello</p>");
    await settle();
    await focus();
    await update(caretAtEnd("hello"));
    await paste({ "text/html": html, "text/plain": "x" });
    const written = lastHtml(onChange);
    expect(written).toContain("hello");
    expect(written).toMatch(/<li[^>]*>(<[^>]+>)*x/);
    expect(reopenReason(written)).toBeUndefined();
  });

  test("a list item put in a quote by an update joins a list", async () => {
    const onChange = mountField("<blockquote><p>q</p></blockquote>");
    await settle();
    await update(() => {
      const quote = $getRoot().getFirstChild() as ElementNode;
      const item = $createListItemNode();
      item.append($createTextNode("x"));
      quote.append(item);
    });
    const written = lastHtml(onChange);
    expect(written).toMatch(/<ul[^>]*><li[^>]*>(<[^>]+>)*x/);
    expect(reopenReason(written)).toBeUndefined();
  });
});

describe("edits at a caret between blocks complete (B9)", () => {
  const timed = async (run: () => Promise<void>) => {
    const start = performance.now();
    await run();
    return performance.now() - start;
  };

  test("Enter after a Link over a quote's trailing line break completes and writes an editable value", async () => {
    const onChange = mountField(
      "<blockquote><strong>x<br /></strong></blockquote><ul><li>stray</li></ul>"
    );
    await settle();
    await focus();
    await update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(textNode("x").getKey(), 1, "text");
      const stray = textNode("stray");
      selection.focus.set(stray.getKey(), 5, "text");
      $setSelection(selection);
    });
    await act(async () => {
      editorOf()!.dispatchCommand(TOGGLE_LINK_COMMAND, {
        url: "https://example.org/",
        target: null,
        rel: null,
      });
    });
    await settle();
    const elapsed = await timed(async () => {
      await act(async () => {
        editorOf()!.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
      });
      await settle();
    });
    expect(elapsed).toBeLessThan(1000);
    const written = lastHtml(onChange);
    expect(written).toContain("x");
    expect(reopenReason(written)).toBeUndefined();
  }, 10_000);

  const quoteCaret = () => {
    const quote = $getRoot().getFirstChild() as ElementNode;
    const selection = $createRangeSelection();
    selection.anchor.set(quote.getKey(), 1, "element");
    selection.focus.set(quote.getKey(), 1, "element");
    $setSelection(selection);
  };

  test.each([
    [
      "Enter",
      async () => {
        await act(async () => {
          editorOf()!.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
        });
      },
    ],
    [
      "a paste",
      async () => {
        await paste({ "text/html": "<p>z</p>", "text/plain": "z" });
      },
    ],
  ])(
    "%s at an element caret between a quote's blocks completes within a second",
    async (_name, run) => {
      const onChange = mountField("<blockquote><p>a</p><p>b</p></blockquote>");
      await settle();
      await focus();
      await update(quoteCaret);
      const elapsed = await timed(async () => {
        await run();
        await settle();
      });
      expect(elapsed).toBeLessThan(1000);
      const written = lastHtml(onChange);
      expect(written).toContain("a");
      expect(written).toContain("b");
      expect(reopenReason(written)).toBeUndefined();
    },
    10_000
  );

  test.each([
    [
      "Backspace",
      async () => {
        await act(async () => {
          editorOf()!.dispatchCommand(
            KEY_BACKSPACE_COMMAND,
            new KeyboardEvent("keydown", { key: "Backspace" })
          );
        });
      },
    ],
    [
      "Cut",
      async () => {
        await clipboard("cut");
      },
    ],
  ])(
    "%s from an item's element caret into its quote completes within a second",
    async (_name, run) => {
      const onChange = mountField(
        "<ul><li>a<blockquote><p>q</p></blockquote></li></ul>"
      );
      await settle();
      await focus();
      await update(() => {
        const item = firstOfType("listitem") as ElementNode;
        const selection = $createRangeSelection();
        selection.anchor.set(item.getKey(), 1, "element");
        selection.focus.set(textNode("q").getKey(), 0, "text");
        $setSelection(selection);
      });
      const elapsed = await timed(async () => {
        await run();
        await settle();
      });
      expect(elapsed).toBeLessThan(1000);
      // nothing visible was selected: the value stays as it was
      expect(editable()!.textContent).toBe("aq");
      const written = lastHtml(onChange);
      if (written !== "") {
        expect(reopenReason(written)).toBeUndefined();
      }
    },
    10_000
  );
});

describe("a figure pasted into a heading stands beside it (B14)", () => {
  test.each([
    ["at its start", 0, "[img]Cap[img]Caphh"],
    ["inside it", 1, "[img]Caphh[img]Cap"],
  ])("pasted %s, the figure is kept whole", async (_name, offset, order) => {
    const onChange = mountField(`${FIGURE}<h2>hh</h2>`);
    await settle();
    await focus();
    await update(selectNode("cms-figure"));
    const data = await clipboard("copy");
    await update(() => {
      textNode("hh").select(offset, offset);
    });
    await paste(data);
    const written = lastHtml(onChange);
    expect(imagesIn(written)).toHaveLength(2);
    expect(written.match(/<figcaption>Cap<\/figcaption>/g)).toHaveLength(2);
    expect(
      new DOMParser().parseFromString(
        written.replace(/<img\b[^>]*>/g, "[img]"),
        "text/html"
      ).body.textContent
    ).toBe(order);
    expect(sanitizeRichTextHtml(written)).toContain("<h2>hh</h2>");
    expect(reopenReason(written)).toBeUndefined();
  });
});
