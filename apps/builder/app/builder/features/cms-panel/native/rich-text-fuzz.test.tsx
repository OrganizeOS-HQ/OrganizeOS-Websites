// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $setSelection,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import { $isLinkNode } from "@lexical/link";
import { TooltipProvider } from "@webstudio-is/design-system";
import { RichTextField, type RichTextFieldProps } from "./rich-text-field";
import {
  getRichTextReadOnlyReason,
  settleRichTextHtml,
} from "./rich-text-html";
import { sanitizeRichTextHtml } from "./rich-text-sanitize";
import corpus from "./__fixtures__/rich-text-corpus.json";

/**
 * The save backstop, as a property: random edits over corpus and
 * handcrafted values, and at random Save points the value a Save would send
 * reopens editable in the field. Forty fixed seeds;
 * VITE_RICH_TEXT_FUZZ_SEEDS runs more locally.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// the seeds a run of 400 found writing self-locks, then the first ones;
// VITE_RICH_TEXT_FUZZ_SEEDS runs seeds 1 to that count instead
const MORE_SEEDS = Number(
  (import.meta.env as Record<string, string | undefined>)
    .VITE_RICH_TEXT_FUZZ_SEEDS ?? 0
);
const SEEDS =
  MORE_SEEDS > 0
    ? Array.from({ length: MORE_SEEDS }, (_, index) => index + 1)
    : [
        83,
        102,
        131,
        146,
        283,
        342,
        386,
        ...Array.from({ length: 33 }, (_, index) => index + 1),
      ];

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
const unmount = () => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  for (const stray of Array.from(
    document.querySelectorAll("[data-radix-popper-content-wrapper]")
  )) {
    stray.remove();
  }
};
const settle = async (rounds = 5) => {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};
let uploads = 0;
const source = {
  uploadImage: vi.fn(async () => {
    uploads += 1;
    return {
      url: `https://cdn.example.org/u${uploads}.png`,
      path: "org/u.png",
    };
  }),
};
const mountField = (html: string | null) => {
  const onChange = vi.fn<RichTextFieldProps["onChange"]>();
  mount(
    createElement(RichTextField, {
      id: "cms-field-body",
      labelId: "cms-field-body-label",
      value: html === null ? null : { html },
      onChange,
      onOpenClassic: () => {},
      source: source as never,
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
const buttonByText = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === text
  );
const click = async (element: HTMLElement | null | undefined) => {
  if (element === null || element === undefined) {
    throw new Error("no element");
  }
  await userEvent.click(element, { timeout: 2000 });
  await settle();
};
const ensureFocus = async () => {
  const element = editable();
  if (element !== null && element.contains(document.activeElement) === false) {
    await act(async () => {
      editorOf()?.focus();
    });
    await settle();
  }
};
const chooseBlock = async (label: string) => {
  await click(byLabel("Block type"));
  const option = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((element) => element.textContent === label);
  if (option === undefined) {
    await userEvent.keyboard("{Escape}");
    await settle();
    throw new Error("no option");
  }
  await click(option);
};
const pasteHtml = (target: HTMLElement, html: string) => {
  const clipboardData = new DataTransfer();
  const holder = document.createElement("div");
  holder.innerHTML = html;
  clipboardData.setData("text/html", html);
  clipboardData.setData("text/plain", holder.textContent ?? "");
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
const pngOf = async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 3;
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((result) => resolve(result!), "image/png")
  );
  return new File([blob], "a.png", { type: "image/png" });
};

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
type Step = { k: string; a?: string; r?: number[] };
const TYPES = ["x", " ", "ab", " w", "w ", "  ", "z"];
const KEYS: Record<string, string> = {
  shiftEnter: "{Shift>}{Enter}{/Shift}",
  enter: "{Enter}",
  backspace: "{Backspace}",
  delete: "{Delete}",
  left: "{ArrowLeft}",
  right: "{ArrowRight}",
  shiftLeft: "{Shift>}{ArrowLeft}{/Shift}",
  shiftRight: "{Shift>}{ArrowRight}{/Shift}",
  home: "{Home}",
  end: "{End}",
  shiftHome: "{Shift>}{Home}{/Shift}",
  shiftEnd: "{Shift>}{End}{/Shift}",
  undo: "{Control>}z{/Control}",
  redo: "{Control>}{Shift>}z{/Shift}{/Control}",
  selectAll: "{Control>}a{/Control}",
};
const BLOCKS = [
  "Paragraph",
  "Heading 2",
  "Heading 3",
  "Heading 4",
  "Quote",
  "Code",
];
const MARKS = ["Bold", "Italic", "Underline", "Strikethrough"];
const LISTS = ["Bulleted list", "Numbered list"];
const URLS = [
  "https://example.org/",
  "/about",
  "#top",
  "mailto:a@example.org",
  "tel:+15550100",
  "https://example.org/a b",
];
const PASTES = [
  '<p>pasted <a href="https://e.org/">link</a> text</p>',
  '<a href="https://e.org/"> spaced link </a>',
  ' <a href="https://e.org/x">x</a> ',
  "<p>one</p><p>two</p>",
  "<ul><li>p1</li><li>p2<ul><li>n</li></ul></li></ul>",
  "<blockquote><p>q1</p><p>q2</p></blockquote>",
  '<b>bold <a href="/p">in</a> </b> tail',
  "<p>a<br>b</p>",
  "<h1>Head</h1><p>body</p>",
  "<pre><code>c1\nc2</code></pre>",
  "text with  double  spaces",
  '<a href="https://e.org/">x</a>&nbsp;<a href="https://e.org/y">y</a>',
  '<p><a href="https://e.org/">a </a> b</p>',
  '<a href="https://e.org/">lead</a> <i> it </i> <a href="/z">z </a>',
  "<ol><li>o1</li><li>o2</li></ol>",
  '<p>x <a href="https://e.org/"><b>bl</b> </a>y</p>',
  '<p><a href="https://e.org/"> both </a></p>',
  'x <a href="/q">q</a> y',
  "<blockquote><blockquote><p>a</p><p>b</p></blockquote></blockquote>",
  '<ul><li><a href="https://e.org/">li link </a> after</li></ul>',
  '<h3>Minutes</h3><p>Approved.</p><p>Next <a href="https://e.org/">here</a>.</p>',
  '<p>a <b>b</b> <a href="https://e.org/"><i>c</i></a> </p>',
];
const PLAIN = ["one\ntwo", " lead and trail ", "a  b", "x\n\ny"];
const pick = <T,>(rng: () => number, list: T[]) =>
  list[Math.floor(rng() * list.length)];
const WEIGHTS: Array<[string, number]> = [
  ["caret", 14],
  ["range", 8],
  ["type", 14],
  ["key", 22],
  ["block", 8],
  ["mark", 5],
  ["list", 8],
  ["link", 6],
  ["unlink", 2],
  ["divider", 2],
  ["paste", 6],
  ["pasteText", 2],
  ["image", 2],
  ["indent", 2],
  ["outdent", 2],
];
const genStep = (rng: () => number): Step => {
  const total = WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  let kind = WEIGHTS[0][0];
  for (const [name, weight] of WEIGHTS) {
    if (roll < weight) {
      kind = name;
      break;
    }
    roll -= weight;
  }
  const r = [rng(), rng(), rng(), rng(), rng(), rng()];
  switch (kind) {
    case "type":
      return { k: kind, a: pick(rng, TYPES) };
    case "key":
      return { k: kind, a: pick(rng, Object.keys(KEYS)) };
    case "block":
      return { k: kind, a: pick(rng, BLOCKS) };
    case "mark":
      return { k: kind, a: pick(rng, MARKS) };
    case "list":
      return { k: kind, a: pick(rng, LISTS) };
    case "link":
      return { k: kind, a: pick(rng, URLS), r };
    case "paste":
      return { k: kind, a: pick(rng, PASTES) };
    case "pasteText":
      return { k: kind, a: pick(rng, PLAIN) };
    default:
      return { k: kind, r };
  }
};

type Spot = { key: string; offset: number; type: "text" | "element" };
const spots = (editor: LexicalEditor) =>
  editor.getEditorState().read(() => {
    const texts: Array<Spot & { size: number; link: boolean }> = [];
    const elements: Array<{ key: string; size: number }> = [];
    const visit = (node: LexicalNode) => {
      if ($isElementNode(node)) {
        elements.push({ key: node.getKey(), size: node.getChildrenSize() });
        node.getChildren().forEach(visit);
      } else if (
        node.getType() === "text" ||
        node.getType() === "code-highlight"
      ) {
        texts.push({
          key: node.getKey(),
          offset: 0,
          type: "text",
          size: node.getTextContentSize(),
          link: $isLinkNode(node.getParent()),
        });
      }
    };
    visit($getRoot());
    return { texts, elements };
  });
const spotOf = (
  editor: LexicalEditor,
  r1: number,
  r2: number,
  r3: number
): Spot | undefined => {
  const { texts, elements } = spots(editor);
  if (texts.length > 0 && r3 < 0.85) {
    const linked = texts.filter((text) => text.link);
    const pool = linked.length > 0 && r3 < 0.4 ? linked : texts;
    const text = pool[Math.floor(r1 * pool.length)];
    const offset =
      r2 < 0.3
        ? 0
        : r2 < 0.6
          ? text.size
          : Math.floor(((r2 - 0.6) / 0.4) * (text.size + 1));
    return {
      key: text.key,
      offset: Math.min(offset, text.size),
      type: "text",
    };
  }
  const element = elements[Math.floor(r1 * elements.length)];
  if (element === undefined) {
    return;
  }
  return {
    key: element.key,
    offset: Math.floor(r2 * (element.size + 1)),
    type: "element",
  };
};
const select = async (anchor: Spot, focus: Spot) => {
  const editor = editorOf()!;
  editable()!.focus();
  await act(async () => {
    editor.update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(anchor.key, anchor.offset, anchor.type);
      selection.focus.set(focus.key, focus.offset, focus.type);
      $setSelection(selection);
    });
  });
  await settle();
};

const runStep = async (step: Step) => {
  const editor = editorOf();
  if (editor === undefined) {
    throw new Error("no editor");
  }
  const r = step.r ?? [];
  switch (step.k) {
    case "caret": {
      const spot = spotOf(editor, r[0], r[1], r[2]);
      if (spot !== undefined) {
        await select(spot, spot);
      }
      return;
    }
    case "range": {
      const anchor = spotOf(editor, r[0], r[1], r[2]);
      const focus = spotOf(editor, r[3], r[4], r[5]);
      if (anchor !== undefined && focus !== undefined) {
        await select(anchor, focus);
      }
      return;
    }
    case "type":
      await ensureFocus();
      await userEvent.keyboard(step.a!);
      await settle();
      return;
    case "key":
      await ensureFocus();
      await userEvent.keyboard(KEYS[step.a!]);
      await settle();
      return;
    case "block":
      await chooseBlock(step.a!);
      return;
    case "mark":
    case "list":
      await ensureFocus();
      await click(byLabel(step.a!));
      return;
    case "divider":
      await ensureFocus();
      await click(byLabel("Divider"));
      return;
    case "link": {
      await ensureFocus();
      await click(byLabel("Link"));
      const input = byLabel("URL") as HTMLInputElement | null;
      if (input === null) {
        throw new Error("no URL input");
      }
      await userEvent.fill(input, step.a!);
      if (r[0] < 0.3) {
        await click(document.querySelector<HTMLElement>('[role="switch"]'));
      }
      await click(buttonByText("Apply"));
      if (byLabel("URL") !== null) {
        await userEvent.keyboard("{Escape}");
        await settle();
      }
      return;
    }
    case "unlink": {
      await ensureFocus();
      await click(byLabel("Link"));
      const remove = buttonByText("Remove");
      if (remove !== undefined) {
        await click(remove);
      } else {
        await userEvent.keyboard("{Escape}");
        await settle();
      }
      return;
    }
    case "paste":
      await ensureFocus();
      pasteHtml(editable()!, step.a!);
      await settle();
      return;
    case "pasteText": {
      await ensureFocus();
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", step.a!);
      act(() => {
        editable()!.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData,
          })
        );
      });
      await settle();
      return;
    }
    case "image": {
      const button = byLabel("Image");
      if (button === null) {
        return;
      }
      await ensureFocus();
      const before = uploads;
      await act(async () => {
        button.click();
      });
      const input =
        container?.querySelector<HTMLInputElement>('input[type="file"]');
      if (input === null || input === undefined) {
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(await pngOf());
      await act(async () => {
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      for (let round = 0; round < 40 && uploads === before; round += 1) {
        await settle(1);
      }
      await settle(10);
      return;
    }
    case "indent":
      await act(async () => {
        editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
      });
      await settle();
      return;
    case "outdent":
      await act(async () => {
        editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
      });
      await settle();
      return;
  }
};

const writtenOf = (
  onChange: ReturnType<typeof vi.fn>,
  start: string | null
): string | null => {
  const last = onChange.mock.lastCall;
  if (last === undefined) {
    return start;
  }
  const value = last[0] as { html: string } | null;
  return value === null ? null : value.html;
};

const editableCorpus = corpus.entries
  .filter((entry) => entry.verdict === "editable")
  .map((entry) => entry.input);
const HANDCRAFTED = [
  "<blockquote><p>We were moved.</p><p>Thank you all.</p></blockquote><p>After</p>",
  "<blockquote><p>one</p><p>two</p><p>three</p></blockquote>",
  "<blockquote><p>a</p><ul><li>b</li></ul></blockquote>",
  "<blockquote><h2>h</h2><p>p</p></blockquote>",
  "<blockquote><blockquote><p>a</p><p>b</p></blockquote></blockquote>",
  '<p>Read <a href="https://e.org/">the link</a> now</p>',
  '<p>a <a href="https://e.org/"> link </a> b</p>',
  '<p>See <a href="https://example.org/">the <strong>link</strong></a> <em>now</em></p>',
  '<p>x <a href="https://e.org/">l1</a><br><b>bold</b> <a href="/p">l2</a> y</p>',
  "<ul><li>parent<ul><li>child</li></ul></li><li>next</li></ul>",
  "<ul><li>a</li><li>parent<ul><li>child</li><li>c2</li></ul></li></ul>",
  "<ol><li>one<ol><li>two<ol><li>three</li></ol></li></ol></li></ol>",
  "<h2>T</h2><p>x <b>bold</b> y</p>",
  "<pre><code>a\nb</code></pre><p>x</p>",
  '<p>a <img src="https://e.org/a.png" alt="A" /> b</p>',
  '<ul><li><a href="https://e.org/">item link</a> tail</li><li>two</li></ul>',
];

/** Opens `html` in a fresh field: whether it is editable. */
const reopens = async (html: string) => {
  mountField(html);
  await settle();
  const open = editable() !== null;
  unmount();
  return open;
};

test("at random Save points, the value a Save sends reopens editable", async () => {
  const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
  const quietWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const failures: string[] = [];
  try {
    for (const seed of SEEDS) {
      const rng = mulberry32(seed * 7919);
      const roll = rng();
      const start =
        roll < 0.12
          ? null
          : roll < 0.4
            ? pick(rng, HANDCRAFTED)
            : pick(rng, editableCorpus);
      const steps = Array.from({ length: 5 + Math.floor(rng() * 11) }, () =>
        genStep(rng)
      );
      const onChange = mountField(start);
      await settle();
      if (editable() === null) {
        unmount();
        continue;
      }
      const saves: string[] = [];
      let checked = start;
      for (const [index, step] of steps.entries()) {
        try {
          await runStep(step);
        } catch {
          await userEvent.keyboard("{Escape}").catch(() => {});
          await settle();
        }
        const html = writtenOf(onChange, start);
        if (html === checked || html === null || html === "") {
          continue;
        }
        checked = html;
        // a Save at this point, or at the last step
        if (rng() < 0.35 || index === steps.length - 1) {
          saves.push(html);
        }
      }
      unmount();
      for (const html of saves) {
        const sent = settleRichTextHtml(html);
        const label = `seed ${seed}: ${JSON.stringify(steps.map((step) => `${step.k}${step.a === undefined ? "" : `:${step.a}`}`))} wrote ${JSON.stringify(html)}`;
        if (sent.outcome === "kept") {
          failures.push(`kept, ${label}`);
          continue;
        }
        if (
          getRichTextReadOnlyReason(sanitizeRichTextHtml(sent.html)) !==
            undefined ||
          (await reopens(sanitizeRichTextHtml(sent.html))) === false
        ) {
          failures.push(`reopens read-only, ${label}`);
        }
      }
    }
  } finally {
    quiet.mockRestore();
    quietWarn.mockRestore();
  }
  expect(failures).toEqual([]);
}, 1_800_000);
