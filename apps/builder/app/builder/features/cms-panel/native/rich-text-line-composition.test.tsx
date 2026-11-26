// F12's mechanism decided at a composition's end, the composition-start
// character, cancelled compositions at a caret and over a range (Task 20;
// section 8; check 3, 14.5; check 4, 15.1, 15.2 and "The composition-start
// character"; check 5, 16.1, 16.2, 16.10, 16.19 to 16.22). Every composition
// starts after more than 30 ms without a key (Lexical's own heuristic), and
// each test asserts the gap it got.
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { cdp, userEvent } from "@vitest/browser/context";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  CLEAR_HISTORY_COMMAND,
  type LexicalEditor,
} from "lexical";
import {
  at,
  backspace,
  caretKey,
  cutByKey,
  type ExtraField,
  itemEnd,
  keys,
  letter,
  LI,
  mount,
  mountExtraField,
  quiet,
  range,
  short,
  type Step,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { sameState } from "./rich-text-line-test-compare";
import { exportRichTextHtml } from "./rich-text-html";
import {
  editable,
  editorOf,
  lastHtml,
  settle,
  unmountField,
} from "./rich-text-test-harness";
import {
  backwardRange,
  forwardRange,
  START_CHAR_SHAPES,
  startCharCells,
} from "./rich-text-line-cells-start-char";
import startCharJson from "./__fixtures__/rich-text-line-base-start-char.json";

type Session = { send: (method: string, params?: object) => Promise<unknown> };
const session = () => cdp() as unknown as Session;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const imeSet = async (text: string) => {
  await session().send("Input.imeSetComposition", {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await settle();
};
const imeCommit = async (text: string) => {
  await session().send("Input.insertText", { text });
  await settle();
};

const undo = keys("{Control>}z{/Control}");
const redo = keys("{Control>}y{/Control}");

const valueOf = (editor: LexicalEditor = editorOf()!) =>
  short(exportRichTextHtml(editor));
const ZW = "​";
const zwIn = (text: string) => text.split(ZW).length - 1;
const zwCount = (editor: LexicalEditor = editorOf()!) =>
  editor.getEditorState().read(() => zwIn($getRoot().getTextContent()));
const rawValues = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.map(([value]) =>
    value === null ? "null" : (value as { html: string }).html
  );

/** Waits more than 30 ms after the last key, and asserts the gap. */
const quietly = async () => {
  expect(await quiet(), "the gap since the last key in ms").toBeGreaterThan(30);
};

/** A composition at quiet timing: `ab` written, or `a` and then nothing. */
const compose = async (wrote: boolean) => {
  await quietly();
  await imeSet("a");
  if (wrote) {
    await imeSet("ab");
    await imeCommit("ab");
  } else {
    await imeSet("");
    await imeCommit("");
  }
  await quiet();
};

/** Presses undo (or redo) until its stack is empty; the value after each. */
const pressAll = async (
  direction: "undo" | "redo",
  editor: LexicalEditor = editorOf()!
) => {
  const values: string[] = [];
  for (let press = 0; press < 8; press += 1) {
    const depth = undoDepth(editor);
    if ((direction === "undo" ? depth.undo : depth.redo) === 0) {
      break;
    }
    await (direction === "undo" ? undo : redo)();
    values.push(valueOf(editor));
  }
  return values;
};

const TQT = LI("T0w<blockquote><p>Q1w</p></blockquote>T2w");
const T = (rest: string) =>
  `<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>${rest}</li><li>Nw</li></ul>`;
const F = (rest: string) => `<ul><li>Pw</li><li>${rest}</li><li>Nw</li></ul>`;

const STARTS: Record<"plain" | "range" | "bold" | "element", Step> = {
  plain: async () => {},
  range: keys("{Shift>}{ArrowLeft}{/Shift}"),
  bold: keys("{Control>}b{/Control}"),
  element: keys("{Enter}"),
};

/**
 * Check 3, 14.5's eight cells, as (undo steps, undo presses back to the
 * stored value, redo presses forward): the head's, plus F12's step at a
 * plain caret that wrote text. The two cancelled cells check 3 kept as the
 * head's (a pending format 3, an element point 4) follow check 4, 15.2: a
 * cancelled composition leaves the history exactly as it was (1 and 2).
 */
const CELLS: ReadonlyArray<readonly [keyof typeof STARTS, boolean, number]> = [
  ["plain", true, 2],
  ["plain", false, 1],
  ["range", true, 2],
  ["range", false, 2],
  ["bold", true, 2],
  ["bold", false, 1],
  ["element", true, 3],
  ["element", false, 2],
];

/** Counts a cell's steps and presses in the harness's field. */
const countCell = async (stored: string) => {
  const after = valueOf();
  const steps = undoDepth().undo;
  const undoPresses = (await pressAll("undo")).length;
  expect(valueOf(), "undo ends at the stored value").toBe(stored);
  const redoPresses = (await pressAll("redo")).length;
  expect(valueOf(), "redo ends at the composition's value").toBe(after);
  return [steps, undoPresses, redoPresses];
};

describe("check 3's eight cells (14.5)", () => {
  for (const [start, wrote, count] of CELLS) {
    test(`${start}, ${wrote ? "text written" : "nothing written"}: ${count}, ${count}, ${count}`, async () => {
      await mount(TQT);
      const stored = valueOf();
      await at("T2w")();
      await keys("x")();
      await quietly();
      await STARTS[start]();
      await compose(wrote);
      expect(await countCell(stored)).toEqual([count, count, count]);
    });
  }
  for (const [start, wrote, count] of CELLS.slice(0, 2)) {
    test(`control: two fields, ${start}, ${wrote ? "text written" : "nothing written"}: composing in one after typing in the other`, async () => {
      await mount(TQT);
      const stored = valueOf();
      const other = await mountExtraField(LI("F1w"));
      await at("F1w", undefined, 0, { in: other.element })();
      await keys("y")();
      await quietly();
      await at("T2w")();
      await keys("x")();
      await compose(wrote);
      expect(await countCell(stored)).toEqual([count, count, count]);
      expect(valueOf(other.editor)).toBe(F("F1wy"));
    });
  }
  // one field's composition state is live while the other types and
  // composes; each field's undo and redo are its own
  for (const order of [
    "nothing in the first, then text in the second",
    "nothing in the second, then text in the first",
  ] as const) {
    test(`control: two fields interleaved: ${order}`, async () => {
      await mount(LI("F1w"));
      const second: ExtraField = await mountExtraField(TQT);
      const first = editorOf()!;
      const inFirst = async (wrote: boolean) => {
        await at("F1w")();
        await keys("y")();
        await compose(wrote);
      };
      const inSecond = async (wrote: boolean) => {
        await at("T2w", undefined, 0, { in: second.element })();
        await keys("x")();
        await compose(wrote);
      };
      if (order.startsWith("nothing in the first")) {
        await inFirst(false);
        await inSecond(true);
        expect(await pressAll("undo", second.editor)).toEqual([
          T("T2wx"),
          T("T2w"),
        ]);
        expect(await pressAll("redo", second.editor)).toEqual([
          T("T2wx"),
          T("T2wxab"),
        ]);
        await at("F1wy")();
        expect(await pressAll("undo", first)).toEqual([F("F1w")]);
        expect(await pressAll("redo", first)).toEqual([F("F1wy")]);
      } else {
        await inSecond(false);
        await inFirst(true);
        expect(await pressAll("undo", first)).toEqual([F("F1wy"), F("F1w")]);
        expect(await pressAll("redo", first)).toEqual([F("F1wy"), F("F1wyab")]);
        await at("T2wx", undefined, 0, { in: second.element })();
        expect(await pressAll("undo", second.editor)).toEqual([T("T2w")]);
        expect(await pressAll("redo", second.editor)).toEqual([T("T2wx")]);
      }
    });
  }
});

describe("undo, a composition, redo", () => {
  test("undo, a cancelled composition, redo: the redo brings back what it brought back before", async () => {
    await mount(TQT);
    await at("T2w")();
    await keys("x")();
    await quietly();
    await undo();
    expect(valueOf()).toBe(T("T2w"));
    await compose(false);
    expect(valueOf()).toBe(T("T2w"));
    expect(await pressAll("redo")).toEqual([T("T2wx")]);
  });
  test("undo, a written composition, redo: nothing to redo, the composed text stays", async () => {
    await mount(TQT);
    await at("T2w")();
    await keys("x")();
    await quietly();
    await undo();
    await compose(true);
    expect(valueOf()).toBe(T("T2wab"));
    expect(undoDepth().redo).toBe(0);
    await redo();
    expect(valueOf()).toBe(T("T2wab"));
    expect(await pressAll("undo")).toEqual([T("T2w")]);
  });
});

describe("a pause of more than one second (14.5, ruling 5)", () => {
  const paused = async (where: "after" | "before", wrote: boolean) => {
    await mount(TQT);
    await at("T2w")();
    await keys("x")();
    await quietly();
    if (where === "before") {
      // the composition starts with nothing composed yet: the page's
      // compositionstart on the editable (the input-method interface
      // starts none without text, P20-5), then the pause
      await act(async () => {
        editable()!.dispatchEvent(
          new CompositionEvent("compositionstart", { bubbles: true, data: "" })
        );
      });
      await settle();
      expect(editorOf()!.isComposing(), "composing").toBe(true);
      await wait(1100);
    }
    await imeSet("a");
    if (where === "after") {
      await wait(1100);
    }
    if (wrote) {
      await imeSet("ab");
      await imeCommit("ab");
    } else {
      await imeSet("");
      await imeCommit("");
    }
    await quiet();
  };
  for (const where of ["after", "before"] as const) {
    test(`${where} the first composed character, written: final, the state before the composition, before`, async () => {
      await paused(where, true);
      expect(valueOf()).toBe(T("T2wxab"));
      expect(await pressAll("undo")).toEqual([T("T2wx"), T("T2w")]);
      expect(await pressAll("redo")).toEqual([T("T2wx"), T("T2wxab")]);
    });
    test(`${where} the first composed character, cancelled: the history as it was`, async () => {
      await paused(where, false);
      expect(valueOf()).toBe(T("T2wx"));
      expect(await pressAll("undo")).toEqual([T("T2w")]);
      expect(await pressAll("redo")).toEqual([T("T2wx")]);
    });
  }
});

describe("15.1: undo or redo during a composition gives the head's values", () => {
  // the head's values press for press (recorded at <base>: four undo
  // presses, then four redo presses); redo during a written composition
  // differs from the head after the composition (P20-2) and is pinned as
  // the branch's, press for press (T42.3: candidate (a), check 4, 15.1):
  // an undo after the composition takes it back
  const CELLS_151: ReadonlyArray<
    readonly ["undo" | "redo", boolean, string, string[]]
  > = [
    [
      "undo",
      true,
      T("T2wab"),
      [...Array(4).fill(T("T2wab")), ...Array(4).fill(T("T2wkxa"))],
    ],
    [
      "undo",
      false,
      T("T2w"),
      [...Array(4).fill(T("T2w")), ...Array(4).fill(T("T2wkxa"))],
    ],
    [
      "redo",
      true,
      T("T2wab"),
      [...Array(4).fill(T("T2w")), ...Array(4).fill(T("T2wab"))],
    ],
    [
      "redo",
      false,
      T("T2w"),
      [...Array(4).fill(T("T2w")), ...Array(4).fill(T("T2wkx"))],
    ],
  ];
  for (const [during, wrote, after, presses] of CELLS_151) {
    test(`${during} during a ${wrote ? "written" : "cancelled"} composition`, async () => {
      await mount(TQT);
      await at("T2w")();
      await letter();
      await keys("x")();
      if (during === "redo") {
        await undo();
      }
      await quietly();
      await imeSet("a");
      await (during === "undo" ? undo : redo)();
      if (wrote) {
        await imeSet("ab");
        await imeCommit("ab");
      } else {
        await imeSet("");
        await imeCommit("");
      }
      await quiet();
      expect(valueOf()).toBe(after);
      const values: string[] = [];
      for (const press of [undo, undo, undo, undo, redo, redo, redo, redo]) {
        await press();
        values.push(valueOf());
      }
      expect(values).toEqual(presses);
    });
  }
});

/** Selects the first empty paragraph's start, after a real click on the field. */
const emptyParagraph: Step = async () => {
  await userEvent.click(editable()!);
  await settle();
  await act(async () => {
    editorOf()!.update(() => {
      const paragraph = $getRoot()
        .getChildren()
        .flatMap(function all(node): ReturnType<typeof $getRoot>[] {
          return [
            node as never,
            ...("getChildren" in node
              ? (node as ReturnType<typeof $getRoot>).getChildren().flatMap(all)
              : []),
          ];
        })
        .find(
          (node) =>
            (node as { getType: () => string }).getType() === "paragraph" &&
            (node as ReturnType<typeof $getRoot>).getChildrenSize() === 0
        ) as ReturnType<typeof $getRoot> | undefined;
      expect(paragraph, "an empty paragraph").toBeDefined();
      paragraph!.select(0, 0);
    });
  });
  await settle();
};

const LINK = '<a href="https://example.org/">Lw</a>';

/**
 * 16.1: [cell, ordinary, lined]; each `[stored, place, pending format]`.
 * The redo entry is a letter at the place, then Ctrl+Z.
 */
const CELLS_161: ReadonlyArray<
  readonly [string, [string, Step, boolean], [string, Step, boolean]]
> = [
  [
    "a pending format",
    ["<p>T0w</p>", at("T0w", 1), true],
    [LI("<blockquote><p>Q0w</p></blockquote>T1w"), at("T1w", 1), true],
  ],
  [
    "an empty caret line beside a rule (ordinary: an empty paragraph after a rule)",
    ["<p>T0w</p><hr><p></p>", emptyParagraph, false],
    [LI("T0w<hr>"), itemEnd(1), false],
  ],
  [
    "an empty paragraph",
    ["<p>Pw</p><p></p><p>Nw</p>", emptyParagraph, false],
    [
      LI("<blockquote><p>Q0w</p><p></p></blockquote>T1w"),
      emptyParagraph,
      false,
    ],
  ],
  [
    "the start of a link-led line",
    [`<p>Pw</p><p>${LINK} T1w</p>`, at("Lw", 0), false],
    [LI(`<blockquote><p>Q0w</p></blockquote>${LINK}`), at("Lw", 0), false],
  ],
  [
    "a plain caret",
    ["<p>T0w</p>", at("T0w", 1), false],
    [LI("<blockquote><p>Q0w</p></blockquote>T1w"), at("T1w", 1), false],
  ],
];

describe("16.1: a cancelled composition restores the redo stack that stood before its first change", () => {
  for (const [cell, ordinary, lined] of CELLS_161) {
    for (const [form, [stored, place, bold]] of [
      ["ordinary", ordinary],
      ["lined", lined],
    ] as const) {
      test(`${cell}, ${form}`, async () => {
        await mount(stored);
        await place();
        await letter();
        const typed = valueOf();
        await undo();
        if (bold) {
          await keys("{Control>}b{/Control}")();
        }
        const depth = undoDepth();
        expect(depth.redo, "one entry on the redo stack").toBe(1);
        const before = valueOf();
        await compose(false);
        expect(valueOf(), "the value as it stood").toBe(before);
        expect(undoDepth(), "both stacks as before").toEqual(depth);
        // the ordinary link-led cell: Lexical stays composing after this
        // cancel (P20-3); Ctrl+Y ends it and acts (T43.1, P20-15)
        await redo();
        expect(valueOf(), "Ctrl+Y brings the entry back").toBe(typed);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T43.1: a key that belongs to no composition ends a composing state the
// browser has ended (P20-3, P20-13, P20-15)

const P203 = `<p>Pw</p><p>${LINK} T1w</p>`;

/** P20-3's sequence: `Lw@0`, a letter, Ctrl+Z, a cancelled composition. */
const cancelAtLinkStart = async () => {
  const onChange = await mount(P203);
  await at("Lw", 0)();
  await letter();
  await undo();
  await compose(false);
  expect(valueOf(), "the value as it stood").toBe(
    "<p>Pw</p><p><a>Lw</a> T1w</p>"
  );
  expect(editorOf()!.isComposing(), "Lexical still composes").toBe(true);
  onChange.mockClear();
  return onChange;
};

/**
 * The page's caret moved one character forward, then a Shift keydown
 * (no edit) dispatched at once, before the page reports the move: the
 * caret Lexical holds right after the key (15.12's read-back, a step the
 * field holds while the editor composes).
 */
const readBackOnShift = (init: KeyboardEventInit = {}) => {
  let caret = "";
  act(() => {
    (
      window.getSelection() as unknown as {
        modify: (a: string, b: string, c: string) => void;
      }
    ).modify("move", "forward", "character");
    editable()!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Shift",
        code: "ShiftLeft",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
        ...init,
      })
    );
    caret = caretKey();
  });
  return caret;
};

/** A keydown that belongs to a composition, of each kind T43.1 names. */
const COMPOSITION_KEYS: ReadonlyArray<
  readonly [string, KeyboardEventInit & { keyCode?: number }]
> = [
  ["isComposing true", { key: "a", isComposing: true }],
  ["key code 229", { key: "a", keyCode: 229 }],
  ['key "Process"', { key: "Process" }],
];

const compositionKeydown = (init: KeyboardEventInit & { keyCode?: number }) => {
  const { keyCode, ...rest } = init;
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...rest,
  });
  if (keyCode !== undefined) {
    Object.defineProperty(event, "keyCode", { value: keyCode });
  }
  act(() => {
    editable()!.dispatchEvent(event);
  });
};

describe("T43.1: a key after a cancel the editor did not see end", () => {
  test("ordinary, link-led: the letter is written at the caret, ArrowRight moves, the held steps run", async () => {
    const onChange = await cancelAtLinkStart();
    await letter();
    expect(rawValues(onChange).map(short), "one onChange").toEqual([
      "<p>Pw</p><p>k<a>Lw</a> T1w</p>",
    ]);
    expect(caretKey(), "the caret after k").toBe("text:k@1");
    expect(editorOf()!.isComposing(), "not composing after the key").toBe(
      false
    );
    onChange.mockClear();
    await keys("{ArrowRight}")();
    expect(caretKey(), "ArrowRight moves the caret").toBe("text:Lw@1");
    expect(editorOf()!.isComposing()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    // the held steps run again: the page's step is read back at the next
    // key (15.12), which the field holds while the editor composes
    expect(readBackOnShift(), "the read-back").toBe("text: T1w@0");
    await settle();
  });

  test("the first key after the cancel already runs the held steps (the clear runs before them)", async () => {
    await cancelAtLinkStart();
    expect(caretKey()).toBe("text:Lw@0");
    expect(readBackOnShift(), "the read-back in the same key").toBe(
      "text:Lw@1"
    );
    expect(editorOf()!.isComposing()).toBe(false);
    await settle();
  });

  test("Ctrl+Z after the written k restores the value before it", async () => {
    await cancelAtLinkStart();
    await letter();
    expect(valueOf()).toBe("<p>Pw</p><p>k<a>Lw</a> T1w</p>");
    await undo();
    expect(valueOf()).toBe("<p>Pw</p><p><a>Lw</a> T1w</p>");
  });

  test("control: a key of a composition, while it composes, holds the read-back", async () => {
    await cancelAtLinkStart();
    expect(readBackOnShift({ isComposing: true }), "no read-back").toBe(
      "text:Lw@0"
    );
    expect(editorOf()!.isComposing()).toBe(true);
    await settle();
  });

  for (const [name, init] of COMPOSITION_KEYS) {
    test(`a key inside a real composition (${name}) does not end it`, async () => {
      const onChange = await mount("<p>Pw</p><p>T0w</p>");
      await at("T0w", 1)();
      const depth = undoDepth().undo;
      await quietly();
      await imeSet("a");
      expect(editorOf()!.isComposing()).toBe(true);
      compositionKeydown(init);
      await settle();
      expect(editorOf()!.isComposing(), "still composing").toBe(true);
      await imeSet("ab");
      await imeCommit("ab");
      await quiet();
      expect(valueOf()).toBe("<p>Pw</p><p>Tab0w</p>");
      expect(lastHtml(onChange)).toBe(exportRichTextHtml(editorOf()!));
      expect(undoDepth().undo, "one step").toBe(depth + 1);
      await undo();
      expect(valueOf(), "one Ctrl+Z").toBe("<p>Pw</p><p>T0w</p>");
    });
  }
});

test("16.2: a history cleared during a composition voids what was remembered", async () => {
  await mount("<p>T0w</p>");
  await at("T0w", 1)();
  await letter();
  await undo();
  expect(undoDepth().redo).toBe(1);
  await quietly();
  await imeSet("a");
  await act(async () => {
    editorOf()!.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
  });
  await settle();
  await imeSet("");
  await imeCommit("");
  await quiet();
  expect(valueOf()).toBe("<p>T0w</p>");
  expect(undoDepth()).toEqual({ undo: 0, redo: 0 });
  await redo();
  expect(valueOf(), "Ctrl+Y brings back nothing of the cleared history").toBe(
    "<p>T0w</p>"
  );
});

// a void is its own composition's: after a composition voided by a clear
// of the history (16.2) or by an undo during it (15.1), the next written
// composition is one undo step of its own
describe("16.2, 15.1: the next composition after a voided one", () => {
  for (const during of ["a clear of the history", "an undo"] as const) {
    test(`voided by ${during}: a second written composition at a caret is one undo step`, async () => {
      await mount("<p>A0w</p><p>B1w</p>");
      await at("B1w", 1)();
      await keys("{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}")();
      await quietly();
      await imeSet("a");
      if (during === "an undo") {
        await undo();
      } else {
        await act(async () => {
          editorOf()!.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
        });
        await settle();
      }
      await imeCommit("a");
      await quiet();
      await keys("{Control>}{End}{/Control}")();
      await keys("k")();
      const withK = valueOf();
      expect(withK).toMatch(/k<\/p>$/);
      const depth = undoDepth().undo;
      await quietly();
      await imeSet("b");
      await imeSet("bc");
      await imeCommit("bc");
      await quiet();
      expect(valueOf()).toMatch(/kbc<\/p>$/);
      expect(zwCount(), "no start character").toBe(0);
      expect(undoDepth().undo, "one undo step of its own").toBe(depth + 1);
      await undo();
      expect(valueOf(), "one Ctrl+Z gives back the value with k").toBe(withK);
    });
  }
});

describe("a composition written and then taken back: one undo step per edit", () => {
  test("a cancel at a link-led line's start leaves the history as it was", async () => {
    const stored = LI(`<blockquote><p>Q0w</p></blockquote>${LINK}`);
    await mount(stored);
    const value = valueOf();
    await at("Q0w")();
    await letter();
    const typed = valueOf();
    const depth = undoDepth();
    await at("Lw", 0)();
    await compose(false);
    expect(valueOf()).toBe(typed);
    expect(undoDepth()).toEqual(depth);
    expect(await pressAll("undo")).toEqual([value]);
  });
  // the head's presses plus F12's step (check 4, 15.2): the composition is
  // one step and the edit after it another
  for (const form of ["ordinary", "lined"] as const) {
    for (const text of ["a", "ab"]) {
      for (const taken of ["Backspace", "a cut", "undo"] as const) {
        test(`${text.length} composed in ${form} content, then ${taken}`, async () => {
          await mount(form === "ordinary" ? "<p>Pw</p><p>T0w</p>" : TQT);
          const stored = valueOf();
          await at(form === "ordinary" ? "T0w" : "T2w", 1)();
          await quietly();
          for (let end = 1; end <= text.length; end += 1) {
            await imeSet(text.slice(0, end));
          }
          await imeCommit(text);
          await quiet();
          const composed = valueOf();
          expect(composed).toBe(
            form === "ordinary" ? `<p>Pw</p><p>T${text}0w</p>` : T(`T${text}2w`)
          );
          if (taken === "Backspace") {
            for (let press = 0; press < text.length; press += 1) {
              await backspace();
            }
          } else if (taken === "a cut") {
            await keys(
              `{Shift>}${"{ArrowLeft}".repeat(text.length)}{/Shift}`
            )();
            await cutByKey();
          } else {
            await undo();
          }
          expect(valueOf()).toBe(stored);
          if (taken === "undo") {
            expect(undoDepth().undo).toBe(0);
            expect(await pressAll("redo")).toEqual([composed]);
          } else {
            expect(await pressAll("undo")).toEqual([composed, stored]);
            expect(await pressAll("redo")).toEqual([composed, stored]);
          }
        });
      }
    }
  }
});

describe("16.22: a cancelled composition over a range is the range's removal", () => {
  for (const form of ["ordinary", "lined"] as const) {
    test(form, async () => {
      const stored =
        form === "ordinary"
          ? "<p>A0w</p><p>B1w</p>"
          : `${LI("A0w<hr>")}<p>B1w</p>`;
      // the removal's value: the same range removed by Backspace
      await mount(stored);
      await range("A0w", 1, "B1w", 1)();
      await backspace();
      const removal = valueOf();
      if (form === "ordinary") {
        expect(removal).toBe("<p>A1w</p>");
      }
      await mount(stored);
      const value = valueOf();
      await at("A0w", 1)();
      await letter();
      await undo();
      expect(undoDepth().redo).toBe(1);
      await range("A0w", 1, "B1w", 1)();
      await compose(false);
      expect(valueOf()).toBe(removal);
      expect(zwCount()).toBe(0);
      await redo();
      expect(valueOf(), "nothing to redo (T11.17)").toBe(removal);
      expect(undoDepth().redo).toBe(0);
      await undo();
      expect(valueOf(), "one undo restores the stored value").toBe(value);
      await redo();
      expect(valueOf()).toBe(removal);
    });
  }
});

// a cancel over a range is the range's removal (16.22); a later edit by the
// person that makes the document what it was before the composition is
// the person's own step: no earlier step is lost
test("16.22: a letter after a cancel over a range that restores the stored text is a step of its own", async () => {
  await mount("<p>Pw</p><p>A0w</p>");
  await at("Pw")();
  await keys("q")();
  await at("A0w", 1)();
  await keys("{Shift>}{ArrowRight}{/Shift}")();
  await compose(false);
  expect(valueOf(), "the range's removal").toBe("<p>Pwq</p><p>Aw</p>");
  await keys("0")();
  expect(valueOf()).toBe("<p>Pwq</p><p>A0w</p>");
  const values: string[] = [];
  for (let press = 0; press < 3; press += 1) {
    await undo();
    values.push(valueOf());
  }
  expect(values).toEqual([
    "<p>Pwq</p><p>Aw</p>",
    "<p>Pwq</p><p>A0w</p>",
    "<p>Pw</p><p>A0w</p>",
  ]);
});

test("16.10: no onChange with an unchanged value at a composition's end", async () => {
  const onChange = await mount("<p>Pw</p><p>T0w</p>");
  await at("T0w", 1)();
  await quietly();
  const before = exportRichTextHtml(editorOf()!);
  onChange.mockClear();
  for (const text of ["a", "ab", "abc"]) {
    await imeSet(text);
  }
  await imeCommit("abc");
  await quiet();
  const values = rawValues(onChange);
  expect(values.length).toBeGreaterThan(1);
  // nothing was handed out before: the first value after mount is handed
  // out even where it equals the stored one (T42.1), here at the
  // composition's start; no value repeats the one before it
  expect(values[0], "value 1, the value as it stood").toBe(before);
  values.slice(1).forEach((value, index) => {
    expect(value, `value ${index + 2}`).not.toBe(values[index]);
  });
  expect(short(values.at(-1)!)).toBe("<p>Pw</p><p>Tabc0w</p>");
});

// ---------------------------------------------------------------------------
// The composition-start character (T10.7b, 16.19 to 16.21)

/** The selection as `"anchor text"@offset->"focus text"@offset`. */
const selectionKey = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) === false) {
        return "none";
      }
      const describe = (point: typeof selection.anchor) => {
        const node = point.getNode();
        return $isTextNode(node)
          ? `"${node.getTextContent()}"@${point.offset}`
          : `${node.getType()}@${point.offset}`;
      };
      return `${describe(selection.anchor)}->${describe(selection.focus)}`;
    });

const pointIn = (word: string, offset: number) => {
  const span = [
    ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
  ].find((element) => element.textContent === word)!;
  const domRange = document.createRange();
  domRange.setStart(span.firstChild!, offset);
  domRange.setEnd(span.firstChild!, offset);
  const rect = domRange.getBoundingClientRect();
  return { x: rect.left, y: rect.top + rect.height / 2 };
};
const mouse = (type: string, x: number, y: number, buttons: number) =>
  session().send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons,
    clickCount: 1,
  });

type Way = "Shift+ArrowLeft" | "Shift+ArrowUp" | "a right-to-left drag";
const BACKWARD = '"B1w"@1->"A0w"@1';

/** The range from `B1w@1` back to `A0w@1`, set by real input. */
const backwardBy =
  (way: Way): Step =>
  async () => {
    if (way === "a right-to-left drag") {
      const from = pointIn("B1w", 1);
      const to = pointIn("A0w", 1);
      await mouse("mousePressed", from.x, from.y, 1);
      await settle();
      for (let step = 1; step <= 6; step += 1) {
        await mouse(
          "mouseMoved",
          from.x + ((to.x - from.x) * step) / 6,
          from.y + ((to.y - from.y) * step) / 6,
          1
        );
        await wait(16);
      }
      await mouse("mouseReleased", to.x, to.y, 0);
      await settle();
    } else {
      await at("B1w", 1)();
      const key =
        way === "Shift+ArrowUp"
          ? "{Shift>}{ArrowUp}{/Shift}"
          : "{Shift>}{ArrowLeft}{/Shift}";
      for (let press = 0; press < 8 && selectionKey() !== BACKWARD; press++) {
        await keys(key)();
      }
    }
    expect(selectionKey()).toBe(BACKWARD);
  };

type Run = {
  during: string[];
  afterComposition: string;
  afterLetter: string;
  depth: { undo: number; redo: number };
  undos: string[];
  redos: string[];
  zwBefore: number;
  zwAfter: number;
};

/** Mounts, selects, composes `composed` one character at a time, then a letter. */
const runComposition = async (
  stored: string,
  select: Step,
  composed: string
): Promise<Run> => {
  const onChange = await mount(stored);
  await select();
  await quietly();
  const zwBefore = zwCount();
  onChange.mockClear();
  for (let end = 1; end <= composed.length; end += 1) {
    await imeSet(composed.slice(0, end));
  }
  await imeCommit(composed);
  await quiet();
  const during = rawValues(onChange);
  const afterComposition = exportRichTextHtml(editorOf()!);
  const zwAfter = zwCount();
  const depth = undoDepth();
  await letter();
  const afterLetter = exportRichTextHtml(editorOf()!);
  const undos = await pressAll("undo");
  const redos = await pressAll("redo");
  unmountField();
  return {
    during,
    afterComposition,
    afterLetter,
    depth,
    undos,
    redos,
    zwBefore,
    zwAfter,
  };
};

/** A backward composition gives what the forward one gives (the oracle, 16.20). */
const expectAsForward = (backward: Run, forward: Run) => {
  for (const value of [
    ...backward.during,
    backward.afterComposition,
    backward.afterLetter,
  ]) {
    expect(value, "no value holds the start character").not.toContain(ZW);
  }
  expect(backward.zwAfter, "U+200B after = before").toBe(backward.zwBefore);
  expect(backward.during.at(-1)).toBe(forward.during.at(-1));
  expect(backward.afterComposition).toBe(forward.afterComposition);
  expect(backward.afterLetter).toBe(forward.afterLetter);
  expect(backward.depth).toEqual(forward.depth);
  expect(backward.undos).toEqual(forward.undos);
  expect(backward.redos).toEqual(forward.redos);
};

const fixture = startCharJson as Record<string, { write: string | null }>;

describe("the composition-start character: base-start-char", () => {
  for (const cell of startCharCells) {
    // named difference: the head keeps the character (check 4)
    test(`${cell.id}: as the forward range, where the head keeps the character`, async () => {
      expect(fixture[cell.id].write, "the head's write").toContain(ZW);
      const forward = await runComposition(cell.stored, forwardRange, "a");
      const backward = await runComposition(cell.stored, backwardRange, "a");
      expectAsForward(backward, forward);
    });
  }
});

describe("the composition-start character: a backward range by real input", () => {
  for (const shape of START_CHAR_SHAPES) {
    for (const form of ["ordinary", "lined"] as const) {
      const ways: Way[] = [
        "Shift+ArrowLeft",
        ...(shape.twoLines ? (["Shift+ArrowUp"] as const) : []),
        "a right-to-left drag",
      ];
      for (const way of ways) {
        for (const composed of ["a", "abc"]) {
          test(`${shape.name}, ${form}, by ${way}, ${composed.length} composed`, async () => {
            const stored = form === "ordinary" ? shape.ordinary : shape.lined;
            const forward = await runComposition(
              stored,
              forwardRange,
              composed
            );
            const backward = await runComposition(
              stored,
              backwardBy(way),
              composed
            );
            expectAsForward(backward, forward);
          }, 30_000);
        }
      }
    }
  }
});

describe("the composition-start character: check 5's cells (16.19)", () => {
  // the composition point at its text node's end
  for (const shape of START_CHAR_SHAPES) {
    for (const form of ["ordinary", "lined"] as const) {
      test(`a backward range from the end of B1w: ${shape.name}, ${form}`, async () => {
        const stored = form === "ordinary" ? shape.ordinary : shape.lined;
        const forward = await runComposition(
          stored,
          range("A0w", 1, "B1w", 3),
          "a"
        );
        const backward = await runComposition(
          stored,
          range("B1w", 3, "A0w", 1),
          "a"
        );
        expectAsForward(backward, forward);
      });
    }
  }
  test("a backward range over a whole item, from the end of B1w", async () => {
    const stored = LI("A0w<br>B1w");
    const forward = await runComposition(
      stored,
      range("A0w", 0, "B1w", 3),
      "a"
    );
    const backward = await runComposition(
      stored,
      range("B1w", 3, "A0w", 0),
      "a"
    );
    expectAsForward(backward, forward);
  });
  test("a composition that ends before its start's commit is seen", async () => {
    const onChange = await mount("<p>A0w</p><p>B1w</p>");
    await backwardRange();
    await quietly();
    onChange.mockClear();
    // no settle between the start and the end
    await session().send("Input.imeSetComposition", {
      text: "a",
      selectionStart: 1,
      selectionEnd: 1,
    });
    await session().send("Input.insertText", { text: "a" });
    await settle();
    await quiet();
    expect(zwCount()).toBe(0);
    for (const value of rawValues(onChange)) {
      expect(value).not.toContain(ZW);
    }
    expect(short(lastHtml(onChange))).toBe("<p>Aa1w</p>");
  });
  for (const change of ["replaced", "shifted"] as const) {
    test(`the composed node ${change === "replaced" ? "replaced" : "with its text shifted"} during the composition`, async () => {
      const onChange = await mount("<p>A0w</p><p>B1w</p>");
      await backwardRange();
      await quietly();
      onChange.mockClear();
      await imeSet("a");
      await act(async () => {
        editorOf()!.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) === false) {
            return;
          }
          const node = selection.anchor.getNode();
          if ($isTextNode(node) === false) {
            return;
          }
          if (change === "replaced") {
            const offset = selection.anchor.offset;
            const copy = node.splitText(0)[0];
            copy.setTextContent(node.getTextContent());
            copy.select(offset, offset);
          } else {
            node.setTextContent(`Z${node.getTextContent()}`);
            node.select(
              selection.anchor.offset + 1,
              selection.anchor.offset + 1
            );
          }
        });
      });
      await settle();
      await imeSet("ab");
      await imeCommit("ab");
      await quiet();
      expect(zwCount(), "U+200B after = before").toBe(0);
      for (const value of rawValues(onChange)) {
        expect(value).not.toContain(ZW);
      }
    });
  }
  test("a forward range right after a U+200B the value held: the held one stays", async () => {
    const stored = `<p>A${ZW}0w</p><p>B1w</p>`;
    const run = await runComposition(
      stored,
      range(`A${ZW}0w`, 2, "B1w", 1),
      "ab"
    );
    expect(run.zwBefore).toBe(1);
    expect(run.zwAfter).toBe(1);
    expect(short(run.afterComposition)).toBe(`<p>A${ZW}ab1w</p>`);
  });
});

describe("R1 a zero-width space the paragraph holds stays", () => {
  const leftUntil = async (target: string) => {
    for (let press = 0; press < 8 && selectionKey() !== target; press++) {
      await keys("{Shift>}{ArrowLeft}{/Shift}")();
    }
    expect(selectionKey()).toBe(target);
  };
  test("a backward composition elsewhere in the paragraph", async () => {
    const run = await runComposition(
      `<p>Z${ZW}Z A0w</p><p>B1w</p>`,
      async () => {
        await at("B1w", 1)();
        await leftUntil(`"B1w"@1->"Z${ZW}Z A0w"@5`);
      },
      "ab"
    );
    expect(run.zwAfter).toBe(run.zwBefore);
    expect(short(run.afterComposition)).toBe(`<p>Z${ZW}Z Aab1w</p>`);
  });
  test("a backward composition right beside it", async () => {
    const run = await runComposition(
      `<p>A${ZW}0w</p><p>B1w</p>`,
      async () => {
        await at("B1w", 1)();
        await leftUntil(`"B1w"@1->"A${ZW}0w"@2`);
      },
      "ab"
    );
    expect(run.zwAfter).toBe(run.zwBefore);
    expect(short(run.afterComposition)).toBe(`<p>A${ZW}ab1w</p>`);
  });
  test("a composition at a caret right after it", async () => {
    const run = await runComposition(
      `<p>A${ZW}0w</p>`,
      range(`A${ZW}0w`, 2, `A${ZW}0w`, 2),
      "ab"
    );
    expect(run.zwAfter).toBe(run.zwBefore);
    expect(short(run.afterComposition)).toBe(`<p>A${ZW}ab0w</p>`);
  });
});

test("16.19: a composition at an element point after a rule in an item leaves no start character (R6)", async () => {
  // the same letter typed at that caret
  await mount(LI("T0w<hr>"));
  await itemEnd(1)();
  await letter();
  const typed = valueOf().replace("k", "a");
  const onChange = await mount(LI("T0w<hr>"));
  const stored = editorOf()!.getEditorState().toJSON();
  await itemEnd(1)();
  await quietly();
  onChange.mockClear();
  await imeSet("a");
  await imeCommit("a");
  await quiet();
  for (const value of rawValues(onChange)) {
    expect(value).not.toContain(ZW);
  }
  expect(zwCount()).toBe(0);
  expect(valueOf()).toBe(typed);
  await undo();
  expect(sameState(stored, editorOf()!.getEditorState().toJSON())).toBe(true);
});

describe("16.21: no value handed out holds the start character", () => {
  test("during a composition over a backward range", async () => {
    const onChange = await mount("<p>A0w</p><p>B1w</p>");
    await backwardBy("Shift+ArrowLeft")();
    await quietly();
    onChange.mockClear();
    for (const text of ["a", "ab", "abc"]) {
      await imeSet(text);
      for (const value of rawValues(onChange)) {
        expect(value).not.toContain(ZW);
      }
    }
    await imeCommit("abc");
    await quiet();
    for (const value of rawValues(onChange)) {
      expect(value).not.toContain(ZW);
    }
  });
  test("unmounted in the middle of composing: no onChange at unmount", async () => {
    const onChange = await mount("<p>A0w</p><p>B1w</p>");
    await backwardBy("Shift+ArrowLeft")();
    await quietly();
    onChange.mockClear();
    await imeSet("a");
    await imeSet("ab");
    const calls = onChange.mock.calls.length;
    unmountField();
    await settle();
    expect(onChange.mock.calls.length, "no onChange at unmount").toBe(calls);
    for (const value of rawValues(onChange)) {
      expect(value).not.toContain(ZW);
    }
    await imeCommit("ab");
  });
});

test("16.20: a backward range from plain into bold by real keys composes as the forward range", async () => {
  const stored = "<p><strong>A0w</strong>B1w</p>";
  const forward = await runComposition(
    stored,
    async () => {
      await at("A0w", 1)();
      await keys("{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}")();
    },
    "ab"
  );
  const backward = await runComposition(
    stored,
    async () => {
      await at("B1w", 1)();
      await keys("{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}")();
    },
    "ab"
  );
  // the head writes <p><strong>A</strong>aab1w</p> (16.20)
  expect(short(backward.afterComposition)).not.toBe(
    "<p><b><strong>A</strong></b>aab1w</p>"
  );
  expectAsForward(backward, forward);
});

// T59 defect 6 (16.20, F12): a composition over a range whose selection
// format is not its first text's (a range from plain into bold, set by
// real keys, or with other text before it) is one undo step, as the
// forward range: one undo from the composed value to the stored one, and
// one redo back
describe("T59 defect 6: a composition over a range is one undo step", () => {
  const NBSP = " ";
  const CELLS: ReadonlyArray<readonly [string, string, Step, string]> = [
    [
      "a backward range from plain into bold, by Shift+ArrowLeft",
      "<p><strong>A0w</strong>B1w</p>",
      backwardBy("Shift+ArrowLeft"),
      "<p><b><strong>Aab</strong></b>1w</p>",
    ],
    [
      "a forward range from bold into plain, by Shift+ArrowRight",
      "<p><strong>A0w</strong>B1w</p>",
      async () => {
        await at("A0w", 1)();
        await keys("{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}")();
      },
      "<p><b><strong>Aab</strong></b>1w</p>",
    ],
    [
      "a backward range from a paragraph into a bold paragraph, by Shift+ArrowUp",
      "<p><strong>A0w</strong></p><p>B1w</p>",
      backwardBy("Shift+ArrowUp"),
      "<p><b><strong>Aab</strong></b>1w</p>",
    ],
    [
      "a forward range from bold into plain, with the start character elsewhere",
      `<p>Z${ZW}Z <strong>A0w</strong>B1w</p>`,
      range("A0w", 1, "B1w", 1),
      `<p>Z${ZW}Z <b><strong>Aab</strong></b>1w</p>`,
    ],
    [
      "a backward range from plain into bold, with the start character elsewhere",
      `<p>Z${ZW}Z <strong>A0w</strong>B1w</p>`,
      range("B1w", 1, "A0w", 1),
      `<p>Z${ZW}Z <b><strong>Aab</strong></b>1w</p>`,
    ],
    [
      "a forward range from bold into plain, with a no-break space elsewhere",
      `<p>Z${NBSP}Z <strong>A0w</strong>B1w</p>`,
      range("A0w", 1, "B1w", 1),
      `<p>Z${NBSP}Z <b><strong>Aab</strong></b>1w</p>`,
    ],
  ];
  for (const [name, stored, select, composed] of CELLS) {
    test(
      name,
      async () => {
        const onChange = await mount(stored);
        const valueBefore = valueOf();
        await select();
        await quietly();
        onChange.mockClear();
        await imeSet("a");
        await imeSet("ab");
        await imeCommit("ab");
        await quiet();
        expect(valueOf(), "the composed value").toBe(composed);
        expect(undoDepth().undo, "the composition is one undo step").toBe(1);
        expect(await pressAll("undo"), "one undo to the stored value").toEqual([
          valueBefore,
        ]);
        expect(
          await pressAll("redo"),
          "one redo to the composed value"
        ).toEqual([composed]);
      },
      30_000
    );
  }
});
