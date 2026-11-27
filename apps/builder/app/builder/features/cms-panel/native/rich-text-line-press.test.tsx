// Presses, kept caret lines and the press's end (15.13, 16.18, 16.23).
// The net ends every test (the setup file).
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { cdp, userEvent } from "@vitest/browser/context";
import { $dfs } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  type ElementNode,
} from "lexical";
import {
  $wherePoint,
  at,
  button,
  caretKey,
  clipboard,
  copy,
  cut,
  del,
  expectEdit,
  forceOrder,
  hold,
  ime,
  IMG,
  imageButton,
  keys,
  letter,
  LI,
  mount,
  pasteText,
  setUpload,
  short,
  type Step,
} from "./rich-text-line-test-kit";
import {
  byLabel,
  editable,
  editorOf,
  fieldContainer,
  lastHtml,
  settle,
  unmountField,
} from "./rich-text-test-harness";
import {
  $isCmsLineNode,
  holdsSelection,
  isLinedContainer,
} from "./rich-text-line-node";
import { isPressing } from "./rich-text-line-points";

type Point = { x: number; y: number };
const send = (method: string, params: object) =>
  (
    cdp() as unknown as {
      send: (method: string, params: object) => Promise<unknown>;
    }
  ).send(method, params);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const mouse = (
  type: "mousePressed" | "mouseReleased" | "mouseMoved",
  { x, y }: Point,
  buttons = type === "mousePressed" ? 1 : 0,
  clickCount = type === "mouseMoved" ? 0 : 1
) =>
  send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: type === "mouseMoved" && buttons === 0 ? "none" : "left",
    buttons,
    clickCount,
  });
const centre = (element: Element): Point => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};
/** Presses at `point` with a real gap between them, one click sequence. */
const clicksAt = async (point: Point, count: number, gap = 150) => {
  for (let n = 1; n <= count; n += 1) {
    await mouse("mousePressed", point, 1, n);
    await mouse("mouseReleased", point, 0, n);
    await settle();
    if (n < count) {
      await wait(gap);
    }
  }
  await settle();
};

const Q = (word: string) => `<blockquote><p>${word}</p></blockquote>`;
const IMG40 =
  '<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />';
const LINK = '<a href="https://example.org/l">Lw</a>';
const RQR = LI(`<hr>${Q("Q1w")}<hr>`);

const $items = () =>
  $dfs()
    .map(({ node }) => node)
    .filter((node): node is ElementNode => node.getType() === "listitem");

/** Empty lines in the state. */
const emptyLines = () =>
  editorOf()!
    .getEditorState()
    .read(
      () =>
        $dfs().filter(({ node }) => $isCmsLineNode(node) && node.isEmpty())
          .length
    );
/** Empty lines that hold no point of the selection. */
const unheldEmptyLines = () =>
  editorOf()!
    .getEditorState()
    .read(
      () =>
        $dfs().filter(
          ({ node }) =>
            $isCmsLineNode(node) &&
            node.isEmpty() &&
            holdsSelection(node) === false
        ).length
    );
/** The element of the one node the selection holds, if a node selection. */
const selectedElement = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      return $isNodeSelection(selection) && selection.getNodes().length === 1
        ? editorOf()!.getElementByKey(selection.getNodes()[0].getKey())
        : null;
    });
const written = (onChange: Parameters<typeof lastHtml>[0]) =>
  onChange.mock.calls.length === 0 ? "none" : short(lastHtml(onChange));

/** A real click on Pw, then an element point on the middle item. */
const caretLineAt =
  (index: number, item = 1): Step =>
  async () => {
    await at("Pw")();
    await act(async () => {
      editorOf()!.update(() => {
        const { key, offset } = $wherePoint($items()[item], index);
        const selection = $getRoot().selectStart();
        selection.anchor.set(key, offset, "element");
        selection.focus.set(key, offset, "element");
      });
    });
    await settle();
    expect(emptyLines(), "one empty caret line").toBe(1);
  };

const spanOf = (word: string) =>
  [...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]")].find(
    (span) => span.textContent === word
  )!;
/** The middle of `word` inside the text `text`, and its two ends. */
const wordAt = (text: string, word: string) => {
  const node = spanOf(text).firstChild!;
  const start = text.indexOf(word);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + word.length);
  const box = range.getBoundingClientRect();
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    left: box.left + 1,
    right: box.right - 1,
  };
};
/** The item's padding beside its leading rule. */
const besideLeadingRule = (index = 0): Point => {
  const rule = editable()!.querySelectorAll("hr")[index];
  const box = rule.getBoundingClientRect();
  return { x: box.left - 6, y: box.top + box.height / 2 };
};
/** A caret set in an update at `offset` in the text `word`. */
const placeIn = async (word: string, from: number, to = from) => {
  await act(async () => {
    editorOf()!.update(() => {
      $getRoot()
        .getAllTextNodes()
        .find((text) => text.getTextContent() === word)!
        .select(from, to);
    });
  });
  await settle();
};

describe("15.13: a press on a rule", () => {
  for (const ms of [0, 50, 200]) {
    test(`a press on a rule that starts a lined item selects it: held ${ms} ms, 20 runs`, async () => {
      for (let run = 0; run < 20; run += 1) {
        const onChange = await mount(RQR);
        const rule = editable()!.querySelector("hr")!;
        await hold(rule, ms)();
        expect(caretKey(), `run ${run}`).toBe("node:horizontalrule");
        expect(selectedElement()).toBe(rule);
        expect(onChange).not.toHaveBeenCalled();
        unmountField();
      }
    }, 120_000);
    for (const order of ["selectionchange-first", "key-first"] as const) {
      test(`a press on a rule that starts a lined item selects it: held ${ms} ms, ${order} at the release, 20 runs`, async () => {
        for (let run = 0; run < 20; run += 1) {
          const onChange = await mount(RQR);
          const rule = editable()!.querySelector("hr")!;
          await forceOrder(order, hold(rule, ms), "pointerup")();
          expect(caretKey(), `run ${run}`).toBe("node:horizontalrule");
          expect(onChange).not.toHaveBeenCalled();
          unmountField();
        }
      }, 120_000);
    }
  }

  const NESTED_RQ = `<ul><li>Pw<ul><li><hr>${Q("Q1w")}</li></ul></li><li>Nw</li></ul>`;
  const PRESS_SHAPES: Array<[string, string, number]> = [
    ["a rule first in an item, a quote after", LI(`<hr>${Q("Q1w")}`), 0],
    ["RQR, the first rule", RQR, 0],
    ["RQR, the last rule", RQR, 1],
    ["two rules, the first", LI("<hr><hr>"), 0],
    ["two rules, the second (between two rules)", LI("<hr><hr>"), 1],
    ["a rule alone in an item", LI("<hr>"), 0],
    ["QRR, the first rule", LI(`${Q("Q0w")}<hr><hr>`), 0],
    ["QRR, the second rule (between two rules)", LI(`${Q("Q0w")}<hr><hr>`), 1],
    ["a rule last in an item, after text", LI("T0w<hr>"), 0],
    ["a rule last in an item, after a quote", LI(`${Q("Q0w")}<hr>`), 0],
    ["depth two, a rule first in a nested item", NESTED_RQ, 0],
  ];
  for (const [name, html, index] of PRESS_SHAPES) {
    for (const ms of [0, 50, 200]) {
      test(`the rule does not move while the pointer is down: ${name}, ${ms} ms`, async () => {
        const onChange = await mount(html);
        const rule = editable()!.querySelectorAll("hr")[index];
        const before = rule.getBoundingClientRect().top;
        await mouse("mousePressed", centre(rule));
        await settle();
        await wait(ms);
        expect(rule.getBoundingClientRect().top).toBe(before);
        await mouse("mouseReleased", centre(rule));
        await settle();
        expect(selectedElement()).toBe(rule);
        expect(onChange).not.toHaveBeenCalled();
      });
    }
  }
});

type Target = "rule" | "image" | "link" | "text";
const MIRROR: Array<[string, string, number, Target]> = [
  [
    "at the start of a rule-led item: a rule below",
    LI(`<hr>${Q("Q1w")}<hr>`),
    0,
    "rule",
  ],
  [
    "at the start of a rule-led item: an image below",
    LI(`<hr>${IMG40}T2w`),
    0,
    "image",
  ],
  [
    "at the start of a rule-led item: a link below",
    LI(`<hr>${LINK}T2w`),
    0,
    "link",
  ],
  [
    "at the start of a rule-led item: text below",
    LI("<hr>Abcdefghw"),
    0,
    "text",
  ],
  ["between two rules: a rule below", LI(`<hr><hr>${Q("Q2w")}<hr>`), 1, "rule"],
  ["between two rules: an image below", LI(`<hr><hr>${IMG40}T3w`), 1, "image"],
  ["between two rules: a link below", LI(`<hr><hr>${LINK}T3w`), 1, "link"],
  ["between two rules: text below", LI("<hr><hr>Abcdefghw"), 1, "text"],
];
const mirrorTarget = (target: Target) => {
  const element =
    target === "rule"
      ? [...editable()!.querySelectorAll("hr")].at(-1)!
      : target === "image"
        ? editable()!.querySelector("img")!
        : spanOf(target === "link" ? "Lw" : "Abcdefghw");
  const box = element.getBoundingClientRect();
  const point =
    target === "text"
      ? { x: box.left + box.width * 0.55, y: box.top + box.height / 2 }
      : centre(element);
  return { element, top: box.top, point };
};
const altOpen = () =>
  [...document.querySelectorAll("label")].some(
    (label) => label.textContent === "Alt"
  );
/** The same press and key with no caret line in the field. */
/**
 * The oracle: the same real press (held as long) at the same target in the
 * same value with no caret line, then the same key. Where the press leaves
 * a caret, it is the caret the press with the line left.
 */
const mirrorWithoutLine = async (
  html: string,
  target: Target,
  ms: number,
  caret: string | null,
  key: string
) => {
  const onChange = await mount(html);
  const { element, point } = mirrorTarget(target);
  await hold(element, ms, point)();
  if (caret !== null) {
    expect(caretKey(), "the oracle's press leaves the same caret").toBe(caret);
  }
  if (target === "image") {
    await keys("{Escape}")();
  }
  await keys(key)();
  const write = written(onChange);
  unmountField();
  return write;
};

describe("15.13 mirror: the caret in an empty caret line, a press below it", () => {
  for (const [name, html, index, target] of MIRROR) {
    for (const ms of [0, 50, 200]) {
      for (const key of ["{ArrowLeft}", "k"]) {
        test(`${name}, held ${ms} ms, then ${key === "k" ? "a letter" : "ArrowLeft"}`, async () => {
          const onChange = await mount(html);
          await caretLineAt(index)();
          const { element, top, point } = mirrorTarget(target);
          const underOffset = document.caretRangeFromPoint(
            point.x,
            point.y
          )?.startOffset;
          await mouse("mousePressed", point);
          await settle();
          await wait(ms);
          expect(element.getBoundingClientRect().top).toBe(top);
          await mouse("mouseReleased", point);
          await settle();
          if (target === "rule") {
            expect(selectedElement()).toBe(element);
          }
          if (target === "image") {
            expect(altOpen()).toBe(true);
            expect(
              editorOf()!
                .getEditorState()
                .read(() => $getSelection())
            ).toBeNull();
          }
          if (target === "link") {
            expect(caretKey()).toBe("text:Lw@1");
          }
          if (target === "text") {
            expect(caretKey()).toBe(`text:Abcdefghw@${underOffset}`);
          }
          // the line is still there after the press, and nothing moved
          expect(emptyLines()).toBe(1);
          expect(element.getBoundingClientRect().top).toBe(top);
          expect(onChange).not.toHaveBeenCalled();
          if (target === "image") {
            await keys("{Escape}")();
          }
          await keys(key)();
          expect(emptyLines()).toBe(0);
          const write = written(onChange);
          unmountField();
          if (key === "k") {
            const caret =
              target === "link"
                ? "text:Lw@1"
                : target === "text"
                  ? `text:Abcdefghw@${underOffset}`
                  : null;
            expect(write).toBe(
              await mirrorWithoutLine(html, target, ms, caret, key)
            );
          }
        });
      }
    }
  }
});

const KEPT_SHAPES: Array<[string, string, number]> = [
  ["at the start of a rule-led item", LI("<hr>Aw Bw Cw<br>Dw"), 0],
  ["between two rules", LI("<hr><hr>Aw Bw Cw<br>Dw"), 1],
];

describe("15.13: presses below a caret line that holds the caret", () => {
  for (const [name, html, index] of KEPT_SHAPES) {
    test(`a double click with a 150 ms gap below a caret line that holds the caret selects the pressed word: ${name}, 20 runs`, async () => {
      for (let run = 0; run < 20; run += 1) {
        await mount(html);
        await caretLineAt(index)();
        await clicksAt(wordAt("Aw Bw Cw", "Bw"), 2);
        expect(window.getSelection()?.toString(), `run ${run}`).toBe("Bw");
        expect(caretKey()).toBe("text:Aw Bw Cw@3|text:Aw Bw Cw@5");
        unmountField();
      }
    }, 120_000);
    test(`a triple click with 150 ms gaps: ${name}`, async () => {
      const run = async (withLine: boolean) => {
        await mount(html);
        if (withLine) {
          await caretLineAt(index)();
        }
        await clicksAt(wordAt("Aw Bw Cw", "Bw"), 3);
        const out = {
          page: window.getSelection()?.toString(),
          caret: caretKey(),
        };
        unmountField();
        return out;
      };
      expect(await run(true)).toEqual(await run(false));
    });
    test(`a press and drag across a word below: ${name}`, async () => {
      const run = async (withLine: boolean) => {
        await mount(html);
        if (withLine) {
          await caretLineAt(index)();
        }
        const from = wordAt("Aw Bw Cw", "Aw");
        const to = wordAt("Aw Bw Cw", "Cw");
        await mouse("mousePressed", { x: from.left, y: from.y });
        await settle();
        await wait(50);
        for (const step of [0.5, 1]) {
          await mouse(
            "mouseMoved",
            { x: from.left + (to.right - from.left) * step, y: from.y },
            1
          );
          await settle();
        }
        await mouse("mouseReleased", { x: to.right, y: to.y });
        await settle();
        const out = {
          page: window.getSelection()?.toString(),
          caret: caretKey(),
          lines: emptyLines(),
        };
        unmountField();
        return out;
      };
      const kept = await run(true);
      const plain = await run(false);
      expect({ page: kept.page, caret: kept.caret }).toEqual({
        page: plain.page,
        caret: plain.caret,
      });
      expect(kept.lines).toBe(1);
    });
  }
});

/** A kept line in the item after Pw, the caret then pressed into T2w. */
const KEPT = "<ul><li>Pw</li><li><hr>T1w</li><li>Aw T2w</li><li>Nw</li></ul>";
const keepOne: Step = async () => {
  await caretLineAt(0)();
  await clicksAt(wordAt("Aw T2w", "T2w"), 1);
  expect(emptyLines(), "one kept line").toBe(1);
  expect(unheldEmptyLines(), "the kept line holds no caret").toBe(1);
};
const noLine: Step = () => at("Aw T2w", 4)();

describe("kept lines", () => {
  const EDITS: Array<[string, Step]> = [
    [
      "Divider",
      async () => {
        await placeIn("Aw T2w", 4);
        await button("Divider")();
      },
    ],
    [
      "Bold",
      async () => {
        await placeIn("Aw T2w", 3, 6);
        await button("Bold")();
      },
    ],
    [
      "Image",
      async () => {
        await placeIn("Aw T2w", 4);
        await imageButton();
      },
    ],
    [
      "a menu paste",
      async () => {
        await placeIn("Aw T2w", 4);
        await pasteText("Zq")();
      },
    ],
    [
      "a cut",
      async () => {
        await placeIn("Aw T2w", 3, 6);
        await cut();
      },
    ],
    [
      "a copy",
      async () => {
        await placeIn("Aw T2w", 3, 6);
        await copy();
      },
    ],
  ];
  for (const [name, edit] of EDITS) {
    test(`a kept line does not change what a command does: ${name}`, async () => {
      const run = async (place: Step) => {
        const onChange = await mount(KEPT);
        await place();
        await edit();
        const out = {
          write: written(onChange),
          clipboard: clipboard(),
          unheld: unheldEmptyLines(),
        };
        unmountField();
        return out;
      };
      const kept = await run(keepOne);
      expect(kept).toEqual(await run(noLine));
      expect(kept.unheld).toBe(0);
    });
  }
  test("a kept line does not change what a command does: an arrow walk", async () => {
    const walk = async (place: Step) => {
      await mount(KEPT);
      await place();
      await placeIn("Aw T2w", 4);
      const stops: string[] = [];
      for (const key of [
        "{ArrowUp}",
        "{ArrowUp}",
        "{ArrowDown}",
        "{ArrowLeft}",
        "{ArrowLeft}",
        "{ArrowLeft}",
        "{ArrowLeft}",
        "{ArrowLeft}",
      ]) {
        await keys(key)();
        stops.push(caretKey());
      }
      unmountField();
      return stops;
    };
    expect(await walk(keepOne)).toEqual(await walk(noLine));
  });
  test("two kept lines, then one key: both go", async () => {
    await mount(
      "<ul><li>Pw</li><li><hr>T1w</li><li><hr>T2w</li><li>Nw</li></ul>"
    );
    await caretLineAt(0)();
    await clicksAt(besideLeadingRule(1), 1);
    await clicksAt(wordAt("T2w", "T2w"), 1);
    expect(emptyLines()).toBe(2);
    await keys("{ArrowLeft}")();
    expect(emptyLines()).toBe(0);
  });
  test("a button below the field, pressed with the caret in a caret line, does not move during its press", async () => {
    await mount(LI("<hr>T1w"));
    const below = document.createElement("button");
    below.textContent = "Below";
    editable()!
      .closest("div")!
      .parentElement!.insertAdjacentElement("afterend", below);
    try {
      await caretLineAt(0)();
      const top = below.getBoundingClientRect().top;
      await mouse("mousePressed", centre(below));
      await settle();
      await wait(50);
      expect(below.getBoundingClientRect().top).toBe(top);
      await mouse("mouseReleased", centre(below));
      await settle();
      expect(below.getBoundingClientRect().top).toBe(top);
    } finally {
      below.remove();
    }
  });
});

describe("a press and a key", () => {
  test("a key while the pointer is down sees the point resolved first", async () => {
    const onChange = await mount(LI("<hr>T1w"));
    const from = besideLeadingRule();
    await mouse("mousePressed", from);
    await settle();
    await wait(50);
    await letter();
    const during = { caret: caretKey(), write: written(onChange) };
    await mouse("mouseReleased", from);
    await settle();
    expect({
      during,
      after: caretKey(),
      calls: onChange.mock.calls.length,
    }).toEqual({
      during: { caret: "text:k@1", write: short(LI("k<hr />T1w")) },
      after: "text:k@1",
      calls: 1,
    });
  });
  test("a drag from the padding beside a leading rule into text below", async () => {
    const onChange = await mount(LI("<hr>T1w<br>Tabcdw"));
    const from = besideLeadingRule();
    const word = spanOf("Tabcdw");
    const box = word.getBoundingClientRect();
    const to = { x: box.left + box.width * 0.5, y: box.top + box.height / 2 };
    await mouse("mousePressed", from);
    await settle();
    await wait(50);
    const top = word.getBoundingClientRect().top;
    for (const step of [0.25, 0.5, 0.75, 1]) {
      await mouse(
        "mouseMoved",
        {
          x: from.x + (to.x - from.x) * step,
          y: from.y + (to.y - from.y) * step,
        },
        1
      );
      await settle();
    }
    expect(word.getBoundingClientRect().top).toBe(top);
    await mouse("mouseReleased", to);
    await settle();
    await letter();
    expect({ caret: caretKey(), write: written(onChange) }).toEqual({
      caret: "text:kcdw@1",
      write: short(LI("kcdw")),
    });
  });
});

/** A press with no click: pointer events on T1w's element, none from the browser. */
const pressWithNoClick = async () => {
  const span = spanOf("T1w");
  const init = {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    ...centre(span),
  };
  await act(async () => {
    span.dispatchEvent(
      new PointerEvent("pointerdown", { ...init, buttons: 1 })
    );
  });
  // the press's point: before the item's leading rule, set while the
  // pointer is down, so the held step has a caret line to make
  await act(async () => {
    editorOf()!.update(() => {
      const item = $items()[1];
      item.select(0, 0);
    });
  });
  await settle();
  expect(emptyLines(), "nothing made while the press is open").toBe(0);
  await act(async () => {
    span.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
  });
  await settle();
  expect(emptyLines(), "nothing made at a release with no click").toBe(0);
};
/** The same point after a normal click, with no press open. */
const pointAfterClick = async () => {
  await at("T1w")();
  await act(async () => {
    editorOf()!.update(() => {
      $items()[1].select(0, 0);
    });
  });
  await settle();
};

describe("16.18: the press's end", () => {
  for (const [name, next] of [
    ["a letter", letter],
    ["a paste", pasteText("Zq")],
  ] as const) {
    test(`a press that no click ends is ended by the next key or edit: ${name}`, async () => {
      const run = async (place: () => Promise<void>) => {
        const onChange = await mount(LI("<hr>T1w"));
        await place();
        await next();
        const out = { write: written(onChange), caret: caretKey() };
        unmountField();
        return out;
      };
      const pressed = await run(pressWithNoClick);
      expect(pressed.write).not.toBe("none");
      expect(pressed).toEqual(await run(pointAfterClick));
    });
  }
  test("the press ends at a click seen at the window in capture", async () => {
    await mount(LI("<hr>T1w"));
    const stop = (event: Event) => {
      event.stopPropagation();
    };
    const container = editable()!.parentElement!;
    container.addEventListener("click", stop);
    try {
      const from = besideLeadingRule();
      await mouse("mousePressed", from);
      await settle();
      await wait(50);
      expect(emptyLines()).toBe(0);
      await mouse("mouseReleased", from);
      await settle();
      expect(emptyLines()).toBe(1);
      expect(caretKey()).toBe("element:listitem@0");
    } finally {
      container.removeEventListener("click", stop);
    }
  });
});

describe("16.18: a composition ends an open press", () => {
  test("a press that no click ends, then a composition", async () => {
    const run = async (place: () => Promise<void>) => {
      const onChange = await mount(LI("<hr>T1w"));
      await place();
      await ime("a")();
      const editor = editorOf()!;
      const out = {
        write: written(onChange),
        caret: caretKey(),
        pressing: isPressing(editor),
        onContainer: editor.getEditorState().read(() => {
          const selection = $getSelection();
          return (
            $isRangeSelection(selection) &&
            [selection.anchor, selection.focus].some((point) =>
              isLinedContainer(point.getNode())
            )
          );
        }),
      };
      unmountField();
      return out;
    };
    const pressed = await run(pressWithNoClick);
    expect(pressed.pressing, "the press is over").toBe(false);
    expect(pressed.onContainer, "no point on a lined container").toBe(false);
    expect(pressed.write).not.toBe("none");
    expect(pressed).toEqual(await run(pointAfterClick));
  });
});

describe("16.23: kept lines and a composition", () => {
  test("kept lines go at the commit that ends a composition", async () => {
    await mount(KEPT);
    await keepOne();
    await ime("a")();
    expect(unheldEmptyLines()).toBe(0);
  });
});

describe("the press cannot stick", () => {
  const ENDS: Array<[string, () => void]> = [
    [
      "a release outside the window",
      () => {
        window.dispatchEvent(
          new PointerEvent("pointermove", { bubbles: true, buttons: 0 })
        );
      },
    ],
    [
      "a cancelled pointer",
      () => {
        window.dispatchEvent(
          new PointerEvent("pointercancel", { bubbles: true })
        );
      },
    ],
    [
      "a native drag",
      () => {
        window.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
      },
    ],
    [
      "a context menu",
      () => {
        window.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
      },
    ],
    [
      "a blur",
      () => {
        window.dispatchEvent(new FocusEvent("blur"));
      },
    ],
    [
      "a second pointer",
      () => {
        editable()!.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerId: 7,
            button: 0,
            pointerType: "touch",
          })
        );
      },
    ],
  ];
  /** A real press on the padding beside the leading rule, then a letter. */
  const afterClick = async () => {
    const onChange = await mount(LI("<hr>T1w"));
    await hold(editable()!, 0, besideLeadingRule())();
    await letter();
    const out = { write: written(onChange), caret: caretKey() };
    unmountField();
    return out;
  };
  for (const [name, end] of ENDS) {
    test(`after ${name}, a letter acts as after a click`, async () => {
      const onChange = await mount(LI("<hr>T1w"));
      const from = besideLeadingRule();
      await mouse("mousePressed", from);
      await settle();
      await wait(50);
      expect(emptyLines()).toBe(0);
      await act(async () => {
        end();
      });
      await settle();
      expect(emptyLines(), "the held step ran").toBe(1);
      expect(onChange).not.toHaveBeenCalled();
      await mouse("mouseReleased", from);
      await settle();
      await letter();
      const out = { write: written(onChange), caret: caretKey() };
      unmountField();
      expect(out).toEqual(await afterClick());
    });
  }
});

// T25.1's ordinary cell: a real click on an image opens its popover and
// selects nothing; Escape closes it with a caret right after the image, as
// at the base (measured; T27.1)
describe("an image clicked, then Escape", () => {
  // The point of the click, relative to the image's box: the one nearest its
  // centre that hit-tests to the image with its neighbours a quarter pixel
  // away, read from the live layout. The image is 2 by 3 pixels: where the
  // glyph advances of the text beside it are rounded to whole pixels, the
  // centre of its box can hit the text beside it.
  const onImage = (image: Element) => {
    const box = image.getBoundingClientRect();
    const hits = (x: number, y: number) =>
      document.elementFromPoint(box.left + x, box.top + y) === image;
    let best: { x: number; y: number } | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let y = 0.25; y < box.height; y += 0.25) {
      for (let x = 0.25; x < box.width; x += 0.25) {
        const around = [-0.25, 0, 0.25].every((dy) =>
          [-0.25, 0, 0.25].every((dx) => hits(x + dx, y + dy))
        );
        const distance = (x - box.width / 2) ** 2 + (y - box.height / 2) ** 2;
        if (around && distance < bestDistance) {
          best = { x, y };
          bestDistance = distance;
        }
      }
    }
    expect(best, "a point on the image").toBeDefined();
    return best!;
  };
  const clickImageEscape: Step = async () => {
    const image = editable()!.querySelector("img")!;
    await userEvent.click(image, { position: onImage(image) } as never);
    await settle();
    expect(caretKey(), "the popover's click selects nothing").toBe("none");
    await keys("{Escape}")();
  };
  test("ordinary content: Delete, then a letter, as at the base", async () => {
    await expectEdit({
      stored: `<p>Aw ${IMG} Bw</p>`,
      place: clickImageEscape,
      action: del,
      write: "<p>Aw <img />Bw</p>",
      caret: "text:Bw@0",
      typed: "<p>Aw <img />kBw</p>",
      source: "the base, measured (T27.1)",
    });
  });
});

// 15.14: the press's own caret survives the press. With a popover open, a
// press in text closes it; the close hands no focus to the editor (the
// press gives it), so the caret is the press's own. Held 150 ms, the close
// and its focus update land between the pointer going down and the
// release
describe("15.14: the press's own caret, a popover open", () => {
  const BIG_IMG =
    '<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />';
  const LINKED = '<a href="https://example.org/l">Lw</a>';
  const SHAPES = {
    ordinary: (node: string) =>
      `<p>Aw${LINKED}</p>${node.startsWith("<img") ? `<p>${node}</p>` : node}<p>Cw</p>`,
    lined: (node: string) => `<ul><li>Aw${LINKED}${node}Cw</li></ul>`,
  };
  const pointIn = (word: string, offset: number): Point => {
    const span = [
      ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
    ].find((element) => element.textContent === word)!;
    const range = document.createRange();
    range.setStart(span.firstChild!, offset);
    range.setEnd(span.firstChild!, offset);
    const rect = range.getBoundingClientRect();
    const box = span.getBoundingClientRect();
    return { x: rect.left, y: box.top + box.height / 2 };
  };
  const isNodeSelected = () =>
    editorOf()!
      .getEditorState()
      .read(() => $isNodeSelection($getSelection()));
  type Opener = "link" | "image";
  const open = async (opener: Opener) => {
    if (opener === "link") {
      // an image node-selected by the arrow, then Link
      await at("Cw", 0)();
      for (let press = 0; press < 3 && isNodeSelected() === false; press++) {
        await keys("{ArrowLeft}")();
      }
      expect(caretKey(), "the image node-selected").toBe("node:cms-image");
      await userEvent.click(
        document.querySelector<HTMLElement>('[aria-label="Link"]')!
      );
      await settle();
      expect(
        document.querySelector('[aria-label="URL"]'),
        "the Link popover"
      ).not.toBeNull();
      return;
    }
    await userEvent.click(editable()!.querySelector("img")!);
    await settle();
    expect(
      [...document.querySelectorAll("label")].some(
        (label) => label.textContent === "Alt"
      ),
      "the Image popover"
    ).toBe(true);
  };
  /** A press at Aw@1 held `ms` (0: a click), then a letter. */
  const pressAtAw = async (ms: number) => {
    const point = pointIn("Aw", 1);
    await mouse("mousePressed", point);
    if (ms > 0) {
      await settle();
      await wait(ms);
    }
    await mouse("mouseReleased", point);
    await settle();
    expect(document.activeElement, "the focus after the close").toBe(
      editable()
    );
    await keys("k")();
  };
  const runs = async (
    shape: keyof typeof SHAPES,
    opener: Opener,
    ms: number,
    count: number
  ) => {
    const writes: Record<string, number> = {};
    for (let run = 0; run < count; run += 1) {
      const onChange = await mount(SHAPES[shape](BIG_IMG));
      await open(opener);
      await pressAtAw(ms);
      const write =
        onChange.mock.calls.length > 0 ? short(lastHtml(onChange)) : "none";
      writes[write] = (writes[write] ?? 0) + 1;
      unmountField();
    }
    return writes;
  };
  const akw = (shape: keyof typeof SHAPES) =>
    short(SHAPES[shape](BIG_IMG).replace("Aw<a", "Akw<a"));
  for (const shape of ["ordinary", "lined"] as const) {
    test(`${shape}: an image node-selected, the Link popover open, a press in text held 150 ms: the letter at the pressed offset, 20 of 20`, async () => {
      expect(await runs(shape, "link", 150, 20)).toEqual({ [akw(shape)]: 20 });
    }, 120_000);
    test(`${shape}: the Link popover open, a real click in text: the letter at the click, 60 of 60`, async () => {
      expect(await runs(shape, "link", 0, 60)).toEqual({ [akw(shape)]: 60 });
    }, 300_000);
    test(`${shape}: the Image popover open, a press in text held 150 ms: the letter at the pressed offset, 20 of 20`, async () => {
      expect(await runs(shape, "image", 150, 20)).toEqual({ [akw(shape)]: 20 });
    }, 120_000);
    test(`${shape}: the Image popover open, a real click in text: the letter at the click, 60 of 60`, async () => {
      expect(await runs(shape, "image", 0, 60)).toEqual({ [akw(shape)]: 60 });
    }, 300_000);
    // the block-type menu is the design system's modal Select: a press
    // outside it closes it and does not reach the editor; its close hands
    // no focus to the editor, so the focus stays on its button, as at the
    // head. The menu covers the field's first lines: the press is in a
    // word below it (a press on the menu is a press on the menu)
    test(`${shape}: the block-type menu open, a real click in text closes it and the letter writes nothing`, async () => {
      const below = Array.from({ length: 8 }, (_, n) => `X${n}w`);
      const stored =
        shape === "ordinary"
          ? `${SHAPES.ordinary("<hr>")}${below.map((word) => `<p>${word}</p>`).join("")}<p>${"Yw ".repeat(14)}<strong>Zw</strong></p>`
          : `<ul><li>Aw${LINKED}<hr>Cw</li>${below.map((word) => `<li>${word}</li>`).join("")}<li>${"Yw ".repeat(14)}<strong>Zw</strong></li></ul>`;
      const onChange = await mount(stored);
      await at("Cw", 1)();
      await userEvent.click(
        document.querySelector<HTMLElement>('[aria-label="Block type"]')!
      );
      await settle();
      expect(document.querySelector('[role="listbox"]')).not.toBeNull();
      onChange.mockClear();
      const listbox = document
        .querySelector('[role="listbox"]')!
        .getBoundingClientRect();
      const word = [...below, "Zw"].find((candidate) => {
        const { x, y } = pointIn(candidate, 1);
        return (
          x < listbox.left ||
          x > listbox.right ||
          y < listbox.top ||
          y > listbox.bottom
        );
      });
      expect(word, "a word the menu does not cover").toBeDefined();
      const point = pointIn(word!, 1);
      await mouse("mousePressed", point);
      await mouse("mouseReleased", point);
      await settle();
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        "Block type"
      );
      await keys("k")();
      expect(onChange).not.toHaveBeenCalled();
    });
    // T40.1 (P19-7): a press on the menu's own surface closes it; the close
    // is not a press in the editor, so the editor takes the focus and the
    // letter lands at the caret held before the menu opened
    test(`${shape}: the block-type menu open, a press on the menu closes it and the letter lands at the caret held before it opened`, async () => {
      const stored = SHAPES[shape]("<hr>");
      const onChange = await mount(stored);
      await at("Cw", 1)();
      await userEvent.click(
        document.querySelector<HTMLElement>('[aria-label="Block type"]')!
      );
      await settle();
      expect(document.querySelector('[role="listbox"]')).not.toBeNull();
      const point = pointIn("Aw", 1);
      const hit = document.elementFromPoint(point.x, point.y);
      expect(
        hit !== null && editable()!.contains(hit) === false,
        `the point on the menu (${hit?.tagName})`
      ).toBe(true);
      await mouse("mousePressed", point);
      await mouse("mouseReleased", point);
      await settle();
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(document.activeElement, "the focus").toBe(editable());
      await keys("k")();
      expect(short(lastHtml(onChange))).toBe(
        short(stored.replace(">Cw<", ">Ckw<"))
      );
    });
  }
});

// 5.3 (T95.5): an upload that ends while a press is down leaves the press's
// caret where the press made it, though the image's insert splits the text
// the press is in. The image lands at Abcdefgh's offset 2; the press is
// before, at and after that place.
describe("5.3: an upload that ends during a press keeps the press's caret", () => {
  const SHAPES: Array<[string, (text: string) => string]> = [
    ["a paragraph", (text) => `<p>${text}</p>`],
    ["a line", (text) => `<ul><li>${text}<br>T1w</li></ul>`],
    [
      "a line after a heading",
      (text) => `<ul><li><h2>H0w</h2>${text}</li></ul>`,
    ],
  ];
  const PRESSES: Array<[string, number, string]> = [
    ["before", 1, `Akb${IMG}cdefgh`],
    ["at", 2, `Abk${IMG}cdefgh`],
    ["after", 6, `Ab${IMG}cdefkgh`],
  ];
  const pointIn = (word: string, offset: number): Point => {
    const span = spanOf(word);
    const range = document.createRange();
    range.setStart(span.firstChild!, offset);
    range.setEnd(span.firstChild!, offset);
    const rect = range.getBoundingClientRect();
    const box = span.getBoundingClientRect();
    return { x: rect.left + 0.5, y: box.top + box.height / 2 };
  };
  for (const [shape, stored] of SHAPES) {
    test.each(PRESSES)(
      `${shape}: a press %s the image's place: the letter lands where the press put the caret`,
      async (_name, offset, typed) => {
        let finish: (() => void) | undefined;
        setUpload(
          () =>
            new Promise((resolve) => {
              finish = () =>
                resolve({
                  url: "https://cdn.example.org/x.png",
                  path: "org/x.png",
                });
            })
        );
        const onChange = await mount(stored("Abcdefgh"));
        await at("Abcdefgh", 2)();
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 3;
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((result) => resolve(result!), "image/png")
        );
        const files = new DataTransfer();
        files.items.add(new File([blob], "a.png", { type: "image/png" }));
        const input =
          fieldContainer()!.querySelector<HTMLInputElement>(
            'input[type="file"]'
          )!;
        await act(async () => {
          byLabel("Image")!.click();
        });
        await act(async () => {
          input.files = files.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        for (let n = 0; n < 200 && finish === undefined; n += 1) {
          await wait(5);
        }
        expect(finish, "the upload started").toBeDefined();
        const calls = onChange.mock.calls.length;
        const point = pointIn("Abcdefgh", offset);
        await mouse("mousePressed", point);
        await wait(150);
        await settle();
        expect(isPressing(editorOf()!), "the press is down").toBe(true);
        finish!();
        for (
          let n = 0;
          n < 200 && onChange.mock.calls.length === calls;
          n += 1
        ) {
          await settle();
          await wait(5);
        }
        expect(short(lastHtml(onChange)), "the image's write").toBe(
          short(stored(`Ab${IMG}cdefgh`))
        );
        await mouse("mouseReleased", point);
        await settle();
        await letter();
        expect(short(lastHtml(onChange))).toBe(short(stored(typed)));
        expect(
          onChange.mock.calls.length - calls,
          "the image, then the letter"
        ).toBe(2);
      }
    );
  }
});
