// The page's selection and Lexical's, both directions (15.12, T10.7): the
// read-back of the page's step, the key cells with no wait, the forced
// event orders; 15.11's decorator end (T10.7b): the field puts Lexical's
// range back on the page, and the page-range keeper.
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { cdp, userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $createRangeSelectionFromDom,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  KEY_DOWN_COMMAND,
  type BaseSelection,
  type LexicalNode,
  type PointType,
} from "lexical";
import {
  at,
  button,
  caretKey,
  cutByKey,
  expectEdit,
  forceOrder,
  IMG,
  keys,
  letter,
  LI,
  link,
  mount,
  nodeAfter,
  nodeSelect,
  noWait,
  onPage,
  recordEdit,
  short,
  type Step,
  then,
  waited,
} from "./rich-text-line-test-kit";
import { editable, editorOf, lastHtml, settle } from "./rich-text-test-harness";
import { exportRichTextHtml } from "./rich-text-html";
import { decoratorEndCells } from "./rich-text-line-cells-decorator-end";
import decoratorEndFixture from "./__fixtures__/rich-text-line-base-decorator-end.json";

const BQ = (text: string) => `<blockquote><p>${text}</p></blockquote>`;

const all = (): LexicalNode[] => {
  const out: LexicalNode[] = [];
  const walk = (node: LexicalNode) => {
    out.push(node);
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  walk($getRoot());
  return out;
};

/** A real click on `word`, then the caret set at `offset` in it. */
const placeIn = async (word: string, offset: number) => {
  const span = [
    ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
  ].find((element) => element.textContent === word)!;
  await userEvent.click(span);
  await settle();
  await act(async () => {
    editorOf()!.update(() => {
      const text = all().find(
        (node) => $isTextNode(node) && node.getTextContent() === word
      );
      if ($isTextNode(text)) {
        text.select(offset, offset);
      }
    });
  });
  await settle();
};

const pointName = (point: PointType) => {
  const node = point.getNode();
  if (point.type === "text") {
    return `"${node.getTextContent()}"@${point.offset}`;
  }
  const child = $isElementNode(node)
    ? node.getChildAtIndex(point.offset)
    : null;
  const name =
    child === null
      ? "-"
      : $isTextNode(child)
        ? child.getTextContent()
        : child.getType();
  return `${node.getType()}@${point.offset}[${name}]`;
};
const selectionName = (selection: BaseSelection | null) =>
  $isRangeSelection(selection)
    ? `${pointName(selection.anchor)}->${pointName(selection.focus)} format=${selection.format}`
    : String(selection);
const walkSel = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      if ($isNodeSelection(selection)) {
        return `node:${selection
          .getNodes()
          .map((node) => node.getType())
          .join(",")}`;
      }
      if ($isRangeSelection(selection)) {
        return selection.isCollapsed()
          ? pointName(selection.anchor)
          : `${pointName(selection.anchor)}->${pointName(selection.focus)}`;
      }
      return String(selection);
    });

const written = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls.length > 0 ? short(lastHtml(onChange)) : "none";

const modify = (alter: string, direction: string, granularity: string) =>
  (
    window.getSelection() as unknown as {
      modify: (a: string, b: string, c: string) => void;
    }
  ).modify(alter, direction, granularity);

// ---------------------------------------------------------------------------
// 15.12: the read-back never writes the page's selection

/** Every call that sets the page's selection, counted until `restore`. */
const pageWrites = () => {
  const calls: string[] = [];
  const proto = Selection.prototype as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  const original: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of [
    "setBaseAndExtent",
    "addRange",
    "removeAllRanges",
    "collapse",
    "extend",
    "removeRange",
  ]) {
    original[name] = proto[name];
    proto[name] = function (this: Selection, ...args: unknown[]) {
      calls.push(name);
      return original[name].apply(this, args);
    };
  }
  return {
    calls,
    restore: () => {
      for (const name of Object.keys(original)) {
        proto[name] = original[name];
      }
    },
  };
};
const pageEnds = () => {
  const page = window.getSelection()!;
  return [page.anchorNode, page.anchorOffset, page.focusNode, page.focusOffset];
};

describe("15.12: the read-back", () => {
  test.each([
    [
      "at an element point",
      LI("<h3>H0w</h3><br>"),
      "H0w",
      3,
      ["move", "forward", "line"],
    ],
    [
      "at a link's start",
      '<p>Aw <a href="https://example.org/l">Lw</a></p>',
      "Aw ",
      3,
      ["move", "forward", "character"],
    ],
    [
      "at a focus on a container",
      LI(BQ("Q0w") + "<hr>T2w"),
      "Q0w",
      3,
      ["extend", "forward", "line"],
    ],
  ] as const)(
    "the read-back sets no page selection: %s",
    async (_name, stored, word, offset, [alter, direction, granularity]) => {
      await mount(stored);
      await placeIn(word, offset);
      const before = walkSel();
      modify(alter, direction, granularity);
      const ends = pageEnds();
      const writes = pageWrites();
      try {
        await act(async () => {
          editable()!.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Shift",
              code: "ShiftLeft",
              shiftKey: true,
              bubbles: true,
              cancelable: true,
            })
          );
        });
      } finally {
        writes.restore();
      }
      expect(walkSel()).not.toBe(before);
      expect(writes.calls).toEqual([]);
      expect(pageEnds()).toEqual(ends);
      await settle();
    }
  );

  /** A Down walk with a wait or none, then a letter: the write. */
  const downWalk = async (
    stored: string,
    word: string,
    offset: number,
    presses: number,
    wait: boolean
  ) => {
    const onChange = await mount(stored);
    await placeIn(word, offset);
    const steps = Array.from({ length: presses }, () => keys("{ArrowDown}"));
    await (wait ? waited : noWait)(...steps, letter)();
    return written(onChange);
  };

  test("a goal-column walk: Down from a long line, fast and with a wait, lands in the same place", async () => {
    const stored =
      "<p>Along line of words</p><p><br></p><p>Sw</p><p>Blong line of words</p>";
    const slow = await downWalk(stored, "Along line of words", 19, 4, true);
    // the column kept: the walk ends at the long line's end
    expect(slow).toBe(
      "<p>Along line of words</p><p><br /></p><p>Sw</p><p>Blong line of wordsk</p>"
    );
    for (let run = 0; run < 10; run += 1) {
      expect(await downWalk(stored, "Along line of words", 19, 4, false)).toBe(
        slow
      );
    }
  }, 120_000);

  // ACCEPTED (R2's list): the field sets the caret line's element point, and
  // Lexical writes it to the page; the next Down lands at the line's start
  test("ACCEPTED: a vertical walk that passes an empty caret line loses its column", async () => {
    const stored =
      "<ul><li>Along line of words<hr><hr>Blong line of words</li></ul>";
    const slow = await downWalk(stored, "Along line of words", 19, 2, true);
    expect(slow).toBe(
      "<ul><li>Along line of words<hr /><hr />kBlong line of words</li></ul>"
    );
    expect(await downWalk(stored, "Along line of words", 19, 2, false)).toBe(
      slow
    );
  }, 30_000);

  test("the Shift+ArrowRight walk of QRL ends in bounded time", async () => {
    const onChange = await mount(LI(BQ("Q0w") + "<hr><ul><li>L2w</li></ul>"));
    await placeIn("Pw", 2);
    const started = performance.now();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}".repeat(11) + "k");
    await settle();
    expect(performance.now() - started).toBeLessThan(10_000);
    expect(written(onChange)).toBe("<ul><li>Pwkw</li></ul>");
  }, 30_000);
});

// ---------------------------------------------------------------------------
// 15.12's key cells (KEY_CELLS at 451f20f04): the page's step, then a key
// handled from its keydown, with no wait and with a wait, in both event
// orders

type KeyCell = readonly [
  string,
  string,
  string,
  number,
  string,
  string,
  string,
];
const KEY_CELLS: KeyCell[] = [
  [
    "ord Abcw Right Backspace",
    "<p>Abcw</p>",
    "Abcw",
    1,
    "{ArrowRight}",
    "{Backspace}",
    "<p>Acw</p>",
  ],
  [
    "ord Abcw Right Delete",
    "<p>Abcw</p>",
    "Abcw",
    1,
    "{ArrowRight}",
    "{Delete}",
    "<p>Abw</p>",
  ],
  [
    "ord Abcw Right Enter",
    "<p>Abcw</p>",
    "Abcw",
    1,
    "{ArrowRight}",
    "{Enter}",
    "<p>Ab</p><p>cw</p>",
  ],
  [
    "lined HB Right Delete",
    LI("<h3>Bw</h3><br>"),
    "Bw",
    1,
    "{ArrowRight}",
    "{Delete}",
    "<ul><li>Pw</li><li><h3>Bw</h3></li><li>Nw</li></ul>",
  ],
  [
    "lined HB Right Enter",
    LI("<h3>Bw</h3><br>"),
    "Bw",
    1,
    "{ArrowRight}",
    "{Enter}",
    "<ul><li>Pw</li><li><h3>Bw</h3><br /><br /></li><li>Nw</li></ul>",
  ],
  [
    "ord heading Right Enter",
    "<h3>Bw</h3><p>Cw</p>",
    "Bw",
    1,
    "{ArrowRight}",
    "{Enter}",
    "<h3>Bw</h3><p></p><p>Cw</p>",
  ],
  [
    "ord two lines Down Backspace",
    "<p>A0w</p><p>B1w</p>",
    "A0w",
    3,
    "{ArrowDown}",
    "{Backspace}",
    "<p>A0w</p><p>B1</p>",
  ],
  [
    "ord two lines Up Backspace",
    "<p>A0w</p><p>B1w</p>",
    "B1w",
    3,
    "{ArrowUp}",
    "{Backspace}",
    "<p>A0</p><p>B1w</p>",
  ],
  [
    "lined two lines Down Backspace",
    LI("T0w<br>T1w"),
    "T0w",
    3,
    "{ArrowDown}",
    "{Backspace}",
    "<ul><li>Pw</li><li>T0w<br />T1</li><li>Nw</li></ul>",
  ],
  [
    "lined two lines Up Backspace",
    LI("T0w<br>T1w"),
    "T1w",
    3,
    "{ArrowUp}",
    "{Backspace}",
    "<ul><li>Pw</li><li>T0<br />T1w</li><li>Nw</li></ul>",
  ],
];

const ORDERS = ["selectionchange-first", "key-first"] as const;

describe("15.12's key cells", () => {
  const run = async (
    [, stored, word, offset, step, key]: KeyCell,
    order: (typeof ORDERS)[number],
    pace: typeof noWait | typeof waited
  ) => {
    const onChange = await mount(stored);
    await placeIn(word, offset);
    await pace(keys(step), forceOrder(order, keys(key)))();
    return written(onChange);
  };
  test.each(KEY_CELLS)(
    "15.12's key cells equal their wait write, 20 of 20: %s",
    async (...cell) => {
      for (const order of ORDERS) {
        expect(await run(cell, order, waited), order).toBe(cell[6]);
        const differ: string[] = [];
        for (let time = 0; time < 20; time += 1) {
          const write = await run(cell, order, noWait);
          if (write !== cell[6]) {
            differ.push(write);
          }
        }
        expect(differ, order).toEqual([]);
      }
    },
    120_000
  );

  const twenty = async (stored: string, place: Step, step: Step) => {
    const slow = await (async () => {
      const onChange = await mount(stored);
      await place();
      await waited(step)();
      return written(onChange);
    })();
    const differ: string[] = [];
    for (let time = 0; time < 20; time += 1) {
      const onChange = await mount(stored);
      await place();
      await noWait(step)();
      const write = written(onChange);
      if (write !== slow) {
        differ.push(write);
      }
    }
    return { slow, differ };
  };

  test("a walk right past a rule then Backspace with no wait equals the wait write", async () => {
    const { slow, differ } = await twenty(
      LI(BQ("Q0w") + "<hr>T2w"),
      at("Q0w"),
      then(keys("{ArrowRight}"), keys("{ArrowRight}"), keys("{Backspace}"))
    );
    expect(slow).not.toBe("none");
    expect(differ).toEqual([]);
  }, 120_000);

  test("End, ArrowLeft, then a letter beside an image: 20 runs equal", async () => {
    const { slow, differ } = await twenty(
      `<p>A0w${IMG}</p>`,
      at("A0w", 1),
      then(keys("{End}"), keys("{ArrowLeft}"), letter)
    );
    expect(slow).not.toBe("none");
    expect(differ).toEqual([]);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// 15.12: where the page has not moved, the step does nothing. Each write
// equals the same key with the read-back not reached (the write <base>
// gives at that caret; measured at <proto> and <base>, T12.9)

/** What the key sees at its keydown: Lexical's selection and the page's. */
const watchStep = () => {
  const editor = editorOf()!;
  const seen: { before: string; atKey: string; page: string }[] = [];
  const unregister = editor.registerCommand(
    KEY_DOWN_COMMAND,
    () => {
      const dom = window.getSelection();
      const page =
        dom === null ? null : $createRangeSelectionFromDom(dom, editor);
      seen.push({
        before: editor
          .getEditorState()
          .read(() => selectionName($getSelection())),
        atKey: selectionName($getSelection()),
        page:
          page === null
            ? "null"
            : `${pointName(page.anchor)}->${pointName(page.focus)} format=${page.format}`,
      });
      return false;
    },
    COMMAND_PRIORITY_CRITICAL
  );
  return { seen, unregister };
};

const LINK = '<a href="https://example.org/l">Lw</a>';
const NOT_MOVED_WRITES: Record<string, string> = {
  // T29.5: the carry's writes (the link kept); <base> loses the link on
  // Backspace and writes an empty paragraph on Enter
  "link Enter":
    "<ul><li>Pw</li><li><br /><h3><a>Lw</a>X0w</h3>T1w</li><li>Nw</li></ul>",
  "link Backspace": "<ul><li>Pw<a>Lw</a>X0w</li><li>T1w</li><li>Nw</li></ul>",
  // equal at <base>, <proto> and the branch
  "pending format":
    "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2wx<b><strong>y</strong></b></li><li>Nw</li></ul>",
  "field focus":
    "<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>",
};

describe("15.12: the page has not moved, the step does nothing", () => {
  test.each(["Enter", "Backspace"])(
    "a text point at a link's start, %s",
    async (key) => {
      const onChange = await mount(LI(`<h3>${LINK}X0w</h3>T1w`));
      await at("X0w", 1)();
      await act(async () => {
        editorOf()!.update(() => {
          const heading = all()
            .find((node) => node.getType() === "link")!
            .getParentOrThrow();
          const range = $createRangeSelection();
          range.anchor.set(heading.getKey(), 0, "element");
          range.focus.set(heading.getKey(), 0, "element");
          $setSelection(range);
        });
      });
      await settle();
      const { seen, unregister } = watchStep();
      await keys(`{${key}}`)();
      unregister();
      expect(seen[0].atKey).toBe("heading@0[link]->heading@0[link] format=0");
      expect(seen[0].page).toBe('"Lw"@0->"Lw"@0 format=0');
      expect(seen[0].atKey).toBe(seen[0].before);
      expect(written(onChange)).toBe(NOT_MOVED_WRITES[`link ${key}`]);
    }
  );

  test("a pending format", async () => {
    const onChange = await mount(LI("T0w" + BQ("Q1w") + "T2w"));
    await at("T2w")();
    await keys("x")();
    await keys("{Control>}b{/Control}")();
    const { seen, unregister } = watchStep();
    await keys("y")();
    unregister();
    expect(seen[0].atKey).toMatch(/ format=1$/);
    expect(seen[0].atKey).toBe(seen[0].before);
    expect(seen[0].page).toMatch(/ format=0$/);
    expect(written(onChange)).toBe(NOT_MOVED_WRITES["pending format"]);
  });

  // a state only code makes (T27, T28): the field's Shift step resolves a
  // focus beside a rule to the quote's text (T29.7), so the element focus
  // on the quote is set directly, after a real click
  test("a focus the field set", async () => {
    const onChange = await mount(LI(BQ("Q0w") + "<hr>T2w"));
    await at("Nw", 0)();
    await act(async () => {
      editorOf()!.update(() => {
        const selection = $getSelection();
        const quote = all().find((node) => node.getType() === "quote")!;
        if ($isRangeSelection(selection)) {
          selection.focus.set(quote.getKey(), 1, "element");
        }
      });
    });
    await settle();
    const { seen, unregister } = watchStep();
    await keys("k")();
    unregister();
    expect(seen[0].atKey).toBe('"Nw"@0->quote@1[-] format=0');
    expect(seen[0].atKey).toBe(seen[0].before);
    expect(seen[0].page).toBe('"Nw"@0->"Q0w"@3 format=0');
    expect(written(onChange)).toBe(NOT_MOVED_WRITES["field focus"]);
  });
});

// ---------------------------------------------------------------------------
// the two event orders forced: the same write in either order

describe("the two event orders forced", () => {
  const STEPS: ReadonlyArray<readonly [string, Step, Step]> = [
    [
      "an arrow, then Enter",
      at("Abcw", 1),
      then(keys("{ArrowRight}"), keys("{Enter}")),
    ],
    ["Backspace", at("Abcw", 2), keys("{Backspace}")],
    ["Delete", at("Abcw", 2), keys("{Delete}")],
    ["Enter", at("Abcw", 2), keys("{Enter}")],
    [
      "a keyboard cut",
      then(at("Abcw", 1), keys("{Shift>}{ArrowRight}{/Shift}")),
      cutByKey,
    ],
    [
      "a keyboard copy",
      then(at("Abcw", 1), keys("{Shift>}{ArrowRight}{/Shift}")),
      keys("{Control>}c{/Control}"),
    ],
    ["a keyboard paste", at("Abcw", 2), keys("{Control>}v{/Control}")],
  ];
  test.each(STEPS)("%s", async (_name, place, step) => {
    const results: string[] = [];
    for (const order of ORDERS) {
      const onChange = await mount("<p>Abcw</p>");
      await place();
      await forceOrder(order, step)();
      results.push(`${written(onChange)} ${caretKey()}`);
    }
    expect(results[0]).toBe(results[1]);
  });

  test("<p>Abcw</p>, the caret after A, ArrowRight, Enter: <p>Ab</p><p>cw</p> in both orders", async () => {
    for (const order of ORDERS) {
      const onChange = await mount("<p>Abcw</p>");
      await at("Abcw", 1)();
      await keys("{ArrowRight}")();
      await forceOrder(order, keys("{Enter}"))();
      expect(written(onChange), order).toBe("<p>Ab</p><p>cw</p>");
    }
  });
});

describe("a page range that appears where Lexical last left none is not read back", () => {
  // a real gesture: ArrowRight from the end of `Aw` node-selects the image;
  // the page keeps its range where Lexical's node selection sets none
  test("a letter typed beside a node-selected image lands beside the image, 20 runs", async () => {
    const writes = new Set<string>();
    for (let time = 0; time < 20; time += 1) {
      const onChange = await mount(`<p>Aw${IMG40}Bw</p>`);
      await nodeAfter("Aw")();
      expect(caretKey()).toBe("node:cms-image");
      // the page holds a range Lexical's node selection did not set
      expect(window.getSelection()!.rangeCount).toBe(1);
      await letter();
      writes.add(written(onChange));
    }
    expect([...writes]).toHaveLength(1);
    expect([...writes][0]).toMatch(/<img \/>k|k<img \/>/);
  }, 120_000);

  // P22-9: an image node-selected by code in an item, Numbered list, then a
  // letter. Lexical's node selection leaves the page no range; Chrome puts
  // its own caret back at the field's start, and the selection change that
  // reports it reaches the field while the node selection stands. Numbered
  // list rebuilds the list's DOM, so the browser's next own caret, there
  // when the key comes, stands in a new text node
  const P22_9: ReadonlyArray<readonly [string, string, string]> = [
    [
      "TQI",
      LI(`T0w${BQ("Q1w")}X2w${IMG}`),
      `<ol><li>Pw</li><li>T0w${BQ("Q1w")}X2w<img />k</li><li>Nw</li></ol>`,
    ],
    [
      "QI",
      LI(`${BQ("Q0w")}${IMG}`),
      `<ol><li>Pw</li><li>${BQ("Q0w")}<img />k</li><li>Nw</li></ol>`,
    ],
  ];
  const firstText = () => editable()!.querySelector("li span")!.firstChild!;

  test("P22-9: the browser's own caret under a node selection, Numbered list, then a letter: the letter after the image, both orders forced", async () => {
    for (const [shape, stored, write] of P22_9) {
      for (let time = 0; time < 3; time += 1) {
        const onChange = await mount(stored);
        await nodeSelect("cms-image")();
        // the browser's own caret at the start, reported while the node
        // selection stands
        await act(async () => {
          window.getSelection()!.collapse(firstText(), 0);
        });
        await settle();
        expect(caretKey(), shape).toBe("node:cms-image");
        await button("Numbered list")();
        expect(caretKey(), shape).toBe("node:cms-image");
        // the browser's next own caret, in the rebuilt list, there when the
        // key comes and not yet reported
        const hold = (event: Event) => event.stopImmediatePropagation();
        document.addEventListener("selectionchange", hold, true);
        try {
          window.getSelection()!.collapse(firstText(), 0);
          await userEvent.keyboard("k");
        } finally {
          document.removeEventListener("selectionchange", hold, true);
        }
        await settle();
        expect(written(onChange), shape).toBe(write);
      }
    }
  }, 120_000);

  test("P22-9: an image node-selected by code, Numbered list, then a letter: the letter after the image, 20 runs of each shape", async () => {
    for (const [shape, stored, write] of P22_9) {
      const writes = new Set<string>();
      for (let time = 0; time < 20; time += 1) {
        const onChange = await mount(stored);
        await nodeSelect("cms-image")();
        await button("Numbered list")();
        await letter();
        writes.add(written(onChange));
      }
      expect([...writes], shape).toEqual([write]);
    }
  }, 240_000);
});

// ---------------------------------------------------------------------------
// T10.7b: 15.11's decorator end. With Lexical holding a range and the
// page an end of it inside a decorator's DOM, the field puts Lexical's
// range back on the page, so the page types over the range

const DECORATOR_FIXTURE = decoratorEndFixture as Record<
  string,
  { write: string | null; calls: number; caret: string; typed: string }
>;

// the nine cells that differ from <base>: at <base> the letter writes
// nothing, and the paste (`<img />TAq`) and the composition land on the
// wrong side of the range
const DECORATOR_WRITES: Record<string, string> = {
  // `<img />k1w`
  letter: "k1w",
  // `<img />Aq1w`
  paste: "Aq1w",
  // `<img />ab1w`: derived; measured at <proto> (equal) and <base>
  // (`<img />Tab`), T12.9
  ime: "ab1w",
};

describe("T10.7b: Shift+Home or Shift+End to an image's side", () => {
  test.each(decoratorEndCells.filter((cell) => cell.control === false))(
    "$id: the image stays and the range is replaced",
    async (cell) => {
      const name = cell.id.split("-").at(-1)!;
      const expected = cell.stored.replace("T1w", DECORATOR_WRITES[name]);
      expect(short(expected)).not.toBe(short(cell.stored));
      if (name === "ime") {
        // a composition's values (P11-1, T29.6): none repeats the one
        // before it (16.10), none holds the start character (16.21), and
        // the last is the write
        const onChange = await mount(cell.stored);
        await cell.place?.();
        const before = exportRichTextHtml(editorOf()!);
        onChange.mockClear();
        await cell.action();
        const values = onChange.mock.calls.map(
          ([value]) => (value as { html: string }).html
        );
        expect(values.length, "an onChange").toBeGreaterThan(0);
        values.forEach((value, index) => {
          expect(value, `value ${index + 1}`).not.toBe(
            index === 0 ? before : values[index - 1]
          );
          expect(value, `value ${index + 1}`).not.toContain("​");
        });
        expect(short(values.at(-1)!)).toBe(short(expected));
        const record = await recordEdit(cell);
        expect(record.write).toBe(short(expected));
        expect(record.undoRestores).toBe(true);
        expect(record.errors).toEqual([]);
      } else {
        await expectEdit({ ...cell, write: short(expected) });
      }
      expect(short(expected)).not.toBe(DECORATOR_FIXTURE[cell.id].write);
    }
  );

  test.each(decoratorEndCells.filter((cell) => cell.control))(
    "control: $id equals the head's",
    async (cell) => {
      const { write, calls, caret, typed } = await recordEdit(cell, {
        short: true,
      });
      const head = DECORATOR_FIXTURE[cell.id];
      // the head's composition hands out three values that repeat one
      // another: one value (16.10; Task 20)
      expect({ write, calls, caret, typed }).toEqual(
        cell.id.endsWith("-ime") ? { ...head, calls: 1 } : head
      );
    }
  );

  test.each([`<p>T1w${IMG}</p>`, LI(`T1w${IMG}`)])(
    "16.10: Shift+End from a text's end before a trailing image hands out no unchanged value: %s",
    async (stored) => {
      const onChange = await mount(stored);
      await at("T1w")();
      const before = exportRichTextHtml(editorOf()!);
      await keys("{Shift>}{End}{/Shift}")();
      await letter();
      const values = onChange.mock.calls.map(
        (call) => (call[0] as { html: string }).html
      );
      expect(values).not.toContain(before);
      values.forEach((value, index) => {
        expect(value).not.toBe(index === 0 ? before : values[index - 1]);
      });
    }
  );

  test("the next Shift+arrow continues from the same place", async () => {
    await mount(`<p>${IMG}T1w</p>`);
    await at("T1w", 1)();
    await keys("{Shift>}{Home}{/Shift}")();
    await letter();
    await keys("{Shift>}{ArrowLeft}{/Shift}")();
    expect(window.getSelection()!.toString()).toBe("k");
  });

  test("it does not loop: at most two updates after the put-back", async () => {
    await mount(`<p>${IMG}T1w</p>`);
    await at("T1w", 1)();
    let updates = 0;
    const off = editorOf()!.registerUpdateListener(() => {
      updates += 1;
    });
    await keys("{Shift>}{Home}{/Shift}")();
    await settle();
    off();
    expect(updates).toBeLessThanOrEqual(2);
  });
});

// T75: a second Shift+Home from a text's end after a leading image takes
// the image into the range, as at the head; the first press stays T10.7b's
// (the range holds the text, the image stays). Shift+End beside a trailing
// image (T75.2, measured): the first press already takes the image at both
// builds, and further presses change nothing
const IMAGE40 =
  '<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />';
/** The page's focus: a text's word or an element's tag, and the offset. */
const pageFocus = () => {
  const page = window.getSelection()!;
  const node = page.focusNode!;
  return `${
    node.nodeType === Node.TEXT_NODE
      ? `text:${node.textContent}`
      : (node as Element).tagName.toLowerCase()
  }@${page.focusOffset}`;
};
const SHIFT_PRESSES: ReadonlyArray<{
  name: string;
  stored: string;
  key: "Home" | "End";
  from: number;
  // the committed selection and the page's focus after each of three presses
  steps: Array<[string, string]>;
  // the write after a letter typed after one, two and three presses
  writes: string[];
}> = [
  {
    name: "Shift+Home, an item led by an image",
    stored: LI(`${IMAGE40}U1w`),
    key: "Home",
    from: 3,
    steps: [
      ["text:U1w@3|text:U1w@0", "li@1"],
      ["text:U1w@3|element:listitem@0", "li@0"],
      ["text:U1w@3|element:listitem@0", "li@0"],
    ],
    writes: [LI("<img />k"), LI("k"), LI("k")],
  },
  {
    name: "Shift+Home, a paragraph led by an image",
    stored: `<p>Pw</p><p>${IMAGE40}U1w</p><p>Nw</p>`,
    key: "Home",
    from: 3,
    steps: [
      ["text:U1w@3|text:U1w@0", "p@1"],
      ["text:U1w@3|element:paragraph@0", "p@0"],
      ["text:U1w@3|element:paragraph@0", "p@0"],
    ],
    writes: [
      "<p>Pw</p><p><img />k</p><p>Nw</p>",
      "<p>Pw</p><p>k</p><p>Nw</p>",
      "<p>Pw</p><p>k</p><p>Nw</p>",
    ],
  },
  {
    name: "Shift+End, an item ended by an image",
    stored: LI(`U1w${IMAGE40}`),
    key: "End",
    from: 0,
    steps: [
      ["text:U1w@0|element:listitem@2", "li@2"],
      ["text:U1w@0|element:listitem@2", "li@2"],
      ["text:U1w@0|element:listitem@2", "li@2"],
    ],
    writes: [LI("k"), LI("k"), LI("k")],
  },
  {
    name: "Shift+End, a paragraph ended by an image",
    stored: `<p>Pw</p><p>U1w${IMAGE40}</p><p>Nw</p>`,
    key: "End",
    from: 0,
    steps: [
      ["text:U1w@0|element:paragraph@2", "p@2"],
      ["text:U1w@0|element:paragraph@2", "p@2"],
      ["text:U1w@0|element:paragraph@2", "p@2"],
    ],
    writes: [
      "<p>Pw</p><p>k</p><p>Nw</p>",
      "<p>Pw</p><p>k</p><p>Nw</p>",
      "<p>Pw</p><p>k</p><p>Nw</p>",
    ],
  },
];

describe("T75: repeated Shift+Home or Shift+End beside an image", () => {
  for (const cell of SHIFT_PRESSES) {
    const press = keys(`{Shift>}{${cell.key}}{/Shift}`);
    test(`${cell.name}: the selection after each of three presses`, async () => {
      const onChange = await mount(cell.stored);
      await at("U1w", cell.from)();
      expect(caretKey(), "the click").toBe(`text:U1w@${cell.from}`);
      const seen: Array<[string, string]> = [];
      for (let index = 0; index < 3; index += 1) {
        await press();
        seen.push([caretKey(), pageFocus()]);
      }
      expect(seen).toEqual(cell.steps);
      expect(onChange).not.toHaveBeenCalled();
    });

    cell.writes.forEach((write, index) => {
      test(`${cell.name}: a letter after ${index + 1} press(es)`, async () => {
        const onChange = await mount(cell.stored);
        await at("U1w", cell.from)();
        for (let step = 0; step <= index; step += 1) {
          await press();
        }
        await letter();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(short(lastHtml(onChange))).toBe(write);
        expect(caretKey()).toBe("text:k@1");
        expect(pageFocus()).toBe("text:k@1");
      });
    });
  }
});

// T78.1 (P75-1): from a caret directly after a leading image, the first
// Shift+Home takes the image and a second changes nothing; a letter then
// replaces the image
const FROM_IMAGE_SIDE = [
  {
    name: "an item led by an image",
    stored: LI(`${IMAGE40}U1w`),
    focus: "text:U1w@0|element:listitem@0",
    write: LI("kU1w"),
  },
  {
    name: "a paragraph led by an image",
    stored: `<p>Pw</p><p>${IMAGE40}U1w</p><p>Nw</p>`,
    focus: "text:U1w@0|element:paragraph@0",
    write: "<p>Pw</p><p>kU1w</p><p>Nw</p>",
  },
] as const;

describe("T78.1: Shift+Home from a caret just after a leading image", () => {
  const press = keys("{Shift>}{Home}{/Shift}");
  for (const cell of FROM_IMAGE_SIDE) {
    test(`${cell.name}: the selection after each of two presses`, async () => {
      const onChange = await mount(cell.stored);
      await at("U1w", 0)();
      expect(caretKey(), "the click").toBe("text:U1w@0");
      const seen: string[] = [];
      for (let index = 0; index < 2; index += 1) {
        await press();
        seen.push(caretKey());
      }
      expect(seen).toEqual([cell.focus, cell.focus]);
      expect(onChange).not.toHaveBeenCalled();
    });

    for (const count of [1, 2]) {
      test(`${cell.name}: a letter after ${count} press(es)`, async () => {
        const onChange = await mount(cell.stored);
        await at("U1w", 0)();
        for (let step = 0; step < count; step += 1) {
          await press();
        }
        await letter();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(short(lastHtml(onChange))).toBe(cell.write);
        expect(caretKey()).toBe("text:kU1w@1");
      });
    }
  }
});

// a real drag from text that ends on an image: on release the field puts
// Lexical's selection back on the page, and a letter types over it
const send = (method: string, params: Record<string, unknown>) =>
  (
    cdp() as unknown as {
      send: (m: string, p: Record<string, unknown>) => Promise<unknown>;
    }
  ).send(method, params);
const mouse = (
  type: "mousePressed" | "mouseReleased" | "mouseMoved",
  x: number,
  y: number,
  buttons = type === "mousePressed" ? 1 : 0
) =>
  send("Input.dispatchMouseEvent", {
    type,
    ...onPage(x, y),
    button: type === "mouseMoved" ? (buttons ? "left" : "none") : "left",
    buttons,
    clickCount: type === "mouseMoved" ? 0 : 1,
  });
const pointIn = (word: string, offset: number) => {
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

const IMG40 =
  '<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />';
const DRAG_IMAGE: ReadonlyArray<
  readonly [string, string, string, number, string]
> = [
  [
    "a paragraph, from A0w@1 rightward",
    `<p>A0w${IMG40}B1w</p>`,
    "A0w",
    1,
    "<p>Ak<img />B1w</p>",
  ],
  [
    "a paragraph, from B1w@2 leftward",
    `<p>A0w${IMG40}B1w</p>`,
    "B1w",
    2,
    "<p>A0w<img />kw</p>",
  ],
  [
    "a paragraph led by the image, from B1w@2 leftward",
    `<p>A0w</p><p>${IMG40}B1w</p>`,
    "B1w",
    2,
    "<p>A0w</p><p><img />kw</p>",
  ],
  [
    "a lined item, from A0w@1 rightward",
    LI(`A0w${IMG40}B1w`),
    "A0w",
    1,
    "<ul><li>Pw</li><li>Ak<img />B1w</li><li>Nw</li></ul>",
  ],
  [
    "a lined item, from B1w@2 leftward",
    LI(`A0w${IMG40}B1w`),
    "B1w",
    2,
    "<ul><li>Pw</li><li>A0w<img />kw</li><li>Nw</li></ul>",
  ],
  [
    "a lined item led by the image, from B1w@2 leftward",
    LI(`${IMG40}B1w`),
    "B1w",
    2,
    "<ul><li>Pw</li><li><img />kw</li><li>Nw</li></ul>",
  ],
];

/**
 * A real drag from `word`@`offset` that ends on the image's near half, a
 * quarter of its width in from the edge the drag enters by (P25-1). The
 * image's centre is no exact end: a move there, or on the far half, lands
 * the page's focus on either side of the image in Chrome, from one run to
 * the next with the same input; a move on the near half lands it on the
 * near side every time.
 */
const dragOntoImage = async (word: string, offset: number) => {
  const from = pointIn(word, offset);
  const image = editable()!.querySelector("img")!;
  const box = image.getBoundingClientRect();
  const to = {
    x: from.x < box.left ? box.left + box.width / 4 : box.right - box.width / 4,
    y: box.top + box.height / 2,
  };
  await mouse("mousePressed", from.x, from.y);
  await settle();
  for (let step = 1; step <= 6; step += 1) {
    await mouse(
      "mouseMoved",
      from.x + ((to.x - from.x) * step) / 6,
      from.y + ((to.y - from.y) * step) / 6,
      1
    );
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await settle();
  await mouse("mouseReleased", to.x, to.y);
  await settle();
  return image;
};

describe("a drag that ends on an image, then a letter", () => {
  test.each(DRAG_IMAGE)(
    "a drag that ends on an image, then a letter replaces what the range holds: %s",
    async (_name, stored, word, offset, write) => {
      const onChange = await mount(stored);
      const image = await dragOntoImage(word, offset);
      expect(
        window.getSelection()!.containsNode(image),
        "the drag ends on the image's near side"
      ).toBe(false);
      await letter();
      expect(written(onChange)).toBe(write);
    }
  );

  test("P25-1: the drag ends on the image's near side, 3 runs of each leftward shape", async () => {
    for (const [name, stored, word, offset, write] of DRAG_IMAGE) {
      if (word !== "B1w") {
        continue;
      }
      for (let run = 0; run < 3; run += 1) {
        const onChange = await mount(stored);
        const image = await dragOntoImage(word, offset);
        expect(
          window.getSelection()!.containsNode(image),
          `${name}, run ${run}: the drag ends on the image's near side`
        ).toBe(false);
        await letter();
        expect(written(onChange), `${name}, run ${run}`).toBe(write);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// the page-range keeper (T10.7b): an update of the field that changes a node
// while a node selection is current keeps the page's range; a letter typed
// next equals the letter with that node selected and no such update

const nodeSelectedNow = () =>
  editorOf()!
    .getEditorState()
    .read(() => $isNodeSelection($getSelection()));
const arrowUntilSelected = async (key: string) => {
  for (let press = 0; press < 4 && nodeSelectedNow() === false; press += 1) {
    await keys(key)();
  }
  expect(nodeSelectedNow()).toBe(true);
};
const emptyLines = () =>
  editorOf()!
    .getEditorState()
    .read(
      () =>
        all().filter(
          (node) =>
            node.getType() === "cms-line" &&
            $isElementNode(node) &&
            node.isEmpty()
        ).length
    );
/** An empty caret line at the middle item's point `index`, set directly. */
const caretLineAt = async (index: number, item = 1) => {
  await userEvent.click(editable()!.querySelector("[data-lexical-text]")!);
  await settle();
  await act(async () => {
    editorOf()!.update(() => {
      const target = all().filter((node) => node.getType() === "listitem")[
        item
      ];
      const range = $createRangeSelection();
      range.anchor.set(target.getKey(), index, "element");
      range.focus.set(target.getKey(), index, "element");
      $setSelection(range);
    });
  });
  await settle();
  expect(walkSel()).toBe("cms-line@0[-]");
};
const selectedRule = () =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      if ($isNodeSelection(selection) === false) {
        return -1;
      }
      const element = editorOf()!.getElementByKey(
        selection.getNodes()[0].getKey()
      );
      return [...editable()!.querySelectorAll("hr")].indexOf(
        element as HTMLHRElement
      );
    });
const centre = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

type KeeperCell = {
  name: string;
  stored: string;
  /** The rule node-selected through the site's update. */
  bySite: Step;
  /** The same rule node-selected from text, with no such update. */
  fromText: Step;
  /**
   * Whether the node selection and a page range stand when the key comes:
   * false where the real gesture leaves the page no range (a press on a
   * rule selects it with no page range) or ends the node selection (the
   * Image popover's Escape leaves a caret beside the image)
   */
  holds: boolean;
};

const KEEPER_CELLS: KeeperCell[] = [
  // the after-commit removal of the line the selection left: an arrow from
  // an empty caret line selects the rule
  {
    name: "the after-commit removal of a line the selection left: a caret line before a leading rule, ArrowRight",
    holds: true,
    stored: LI("<hr>T1w"),
    bySite: then(() => caretLineAt(0), keys("{ArrowRight}")),
    fromText: then(at("T1w", 0), () => arrowUntilSelected("{ArrowLeft}")),
  },
  {
    name: "the after-commit removal of a line the selection left: a caret line between two rules, ArrowLeft",
    holds: true,
    stored: LI("<hr><hr>T2w"),
    bySite: then(() => caretLineAt(1), keys("{ArrowLeft}")),
    fromText: then(at("Pw", 2), () => arrowUntilSelected("{ArrowRight}")),
  },
  {
    name: "the after-commit removal of a line the selection left: a caret line between two rules, ArrowRight",
    holds: true,
    stored: LI("<hr><hr>T2w"),
    bySite: then(() => caretLineAt(1), keys("{ArrowRight}")),
    fromText: then(at("T2w", 0), () => arrowUntilSelected("{ArrowLeft}")),
  },
  // the kept-line removal and the press's end: a press on a rule with a
  // caret line kept beside it, or in another item
  {
    name: "the press's end, then the kept-line removal at the keydown read-back: the kept line directly after the rule",
    holds: false,
    stored: LI("<hr><hr>T2w"),
    bySite: then(
      () => caretLineAt(1),
      async () => {
        const rule = editable()!.querySelectorAll("hr")[0];
        await realPress(centre(rule));
        expect(emptyLines()).toBe(1);
      }
    ),
    fromText: then(at("Pw", 2), () => arrowUntilSelected("{ArrowRight}")),
  },
  {
    name: "the press's end, then the kept-line removal at the keydown read-back: the kept line in another item",
    holds: false,
    stored: "<ul><li>Pw</li><li><hr>T1w</li><li><hr>T2w</li><li>Nw</li></ul>",
    bySite: then(
      () => caretLineAt(0),
      async () => {
        const rule = editable()!.querySelectorAll("hr")[1];
        await realPress(centre(rule));
        expect(emptyLines()).toBe(1);
      }
    ),
    fromText: then(at("T2w", 0), () => arrowUntilSelected("{ArrowLeft}")),
  },
  // removeKeptLines from the toolbar: a press on the rule with a caret line
  // kept beside it, then Bold
  {
    name: "removeKeptLines from the toolbar: Bold with a kept line beside the rule",
    holds: true,
    stored: LI("<hr><hr>T2w"),
    bySite: then(
      () => caretLineAt(1),
      async () => {
        await realPress(centre(editable()!.querySelectorAll("hr")[0]));
        expect(emptyLines()).toBe(1);
      },
      button("Bold")
    ),
    fromText: then(
      at("Pw", 2),
      () => arrowUntilSelected("{ArrowRight}"),
      button("Bold")
    ),
  },
  // removeKeptLines from the Link popover's Apply
  {
    name: "removeKeptLines from the Link popover: Apply with a kept line beside the rule",
    holds: true,
    stored: LI("<hr><hr>T2w"),
    bySite: then(
      () => caretLineAt(1),
      async () => {
        await realPress(centre(editable()!.querySelectorAll("hr")[0]));
        expect(emptyLines()).toBe(1);
      },
      link()
    ),
    fromText: then(
      at("Pw", 2),
      () => arrowUntilSelected("{ArrowRight}"),
      link()
    ),
  },
  // removeKeptLines from the Image popover: a press on the image with a
  // caret line kept in another item, a letter in Alt, then Escape
  {
    name: "removeKeptLines from the Image popover: Alt with a kept line in another item",
    holds: false,
    stored: `<ul><li>Pw</li><li><hr><hr>T2w</li><li>Nw</li></ul><p>A${IMG40}B</p>`,
    bySite: then(
      () => caretLineAt(1),
      async () => {
        await realPress(centre(editable()!.querySelector("img")!));
        expect(emptyLines()).toBe(1);
      },
      keys("x"),
      keys("{Escape}")
    ),
    fromText: then(
      async () => realPress(centre(editable()!.querySelector("img")!)),
      keys("x"),
      keys("{Escape}")
    ),
  },
];

/** A real press and release at a point, 50 ms apart. */
const realPress = async ({ x, y }: { x: number; y: number }) => {
  await mouse("mousePressed", x, y);
  await settle();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await mouse("mouseReleased", x, y);
  await settle();
};

describe("the page-range keeper", () => {
  for (const cell of KEEPER_CELLS) {
    for (const next of ["a letter", "Backspace"] as const) {
      test(`a letter typed after each site equals the letter with that node selected and no such update: ${cell.name}, ${next}`, async () => {
        const run = async (place: Step) => {
          const onChange = await mount(cell.stored);
          await place();
          const rule = selectedRule();
          const pageRanges = window.getSelection()!.rangeCount;
          const selected = walkSel();
          await keys(next === "a letter" ? "k" : "{Backspace}")();
          return {
            write: written(onChange),
            selection: walkSel(),
            lines: emptyLines(),
            rule,
            pageRanges,
            selected,
          };
        };
        const fromText = await run(cell.fromText);
        const bySite = await run(cell.bySite);
        // the node selected, and the page's range kept through the site,
        // where the site's gesture leaves the page a range (`holds`)
        if (cell.holds) {
          expect(bySite.selected).toMatch(/^node:/);
          expect(bySite.pageRanges).toBe(1);
        }
        const { pageRanges: _site, ...siteResult } = bySite;
        const { pageRanges: _text, ...textResult } = fromText;
        expect(siteResult).toEqual(textResult);
      });
    }
  }
});

// the check after a commit: the commit that node-selects the rule by an
// arrow runs the check with the node selection current; the letter is
// D15's (M14l's typed value)
test("the page-range keeper: the check after a commit, then a letter after the selected rule", async () => {
  const onChange = await mount("<ul><li>xq<hr>yq</li></ul>");
  await nodeAfter("xq")();
  expect(caretKey()).toBe("node:horizontalrule");
  expect(window.getSelection()!.rangeCount).toBe(1);
  await letter();
  expect(written(onChange)).toBe("<ul><li>xq<hr />kyq</li></ul>");
});
