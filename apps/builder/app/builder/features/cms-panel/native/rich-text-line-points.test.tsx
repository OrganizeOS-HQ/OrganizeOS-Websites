// 5.3 and D18 at each kind of point, D18 step 2 at six line endings, D13,
// V11, F4, F8, select-all, editor.focus(), and a point on an item that
// holds only a nested list.
import { describe, expect, test, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { $isListNode } from "@lexical/list";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  type ElementNode,
  type LexicalNode,
} from "lexical";
import {
  at,
  backspace,
  blockType,
  caretKey,
  clickItemCorner,
  del,
  enter,
  expectEdit,
  ime,
  IMG,
  nodeSelect,
  itemPoint,
  keys,
  letter,
  LI,
  mount,
  selectAll,
  shiftEnter,
  short,
  type Step,
  then,
  W,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import {
  click,
  editable,
  editorOf,
  expectFixedPoint,
  lastHtml,
  settle,
} from "./rich-text-test-harness";
import { exportRichTextHtml } from "./rich-text-html";
import { sameState } from "./rich-text-line-test-compare";
import { $isCmsLineNode, isLinedContainer } from "./rich-text-line-node";

const QUOTE0 = "<blockquote><p>Q0w</p></blockquote>";
const QUOTE1 = "<blockquote><p>Q1w</p></blockquote>";
const LINK = '<a href="https://example.org/a">Lw</a>';

/** One update on the mounted editor, after a real click on the field. */
const inUpdate =
  ($update: () => void): Step =>
  async () => {
    await click(editable());
    await act(async () => {
      editorOf()!.update($update);
    });
    await settle();
  };

/** A real click at the left edge of the first rule (check V11). */
const clickRuleStart: Step = async () => {
  const rule = editable()!.querySelector<HTMLElement>("hr")!;
  await userEvent.click(rule, {
    position: { x: 1, y: 1 },
    force: true,
  } as never);
  await settle();
};

/** The list items in document order. */
const $items = () => {
  const items: ElementNode[] = [];
  const walk = (node: LexicalNode) => {
    if (node.getType() === "listitem" && $isElementNode(node)) {
      items.push(node);
    }
    if ($isElementNode(node)) {
      node.getChildren().forEach(walk);
    }
  };
  walk($getRoot());
  return items;
};

const $setElementPoint = (node: ElementNode, offset: number) => {
  const selection = $createRangeSelection();
  selection.anchor.set(node.getKey(), offset, "element");
  selection.focus.set(node.getKey(), offset, "element");
  $setSelection(selection);
};

/** Neither point of the committed selection rests on a lined container. */
const expectNoPointOnLinedContainer = () => {
  editorOf()!
    .getEditorState()
    .read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection), "a range selection").toBe(true);
      if ($isRangeSelection(selection)) {
        for (const point of [selection.anchor, selection.focus]) {
          expect(
            isLinedContainer(point.getNode()),
            `a point on ${point.getNode().getType()}@${point.offset}`
          ).toBe(false);
        }
      }
    });
};

describe("D18: one letter at each kind of point", () => {
  test("a line at the point: its start (QT@1)", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}T1w`),
      place: itemPoint(1, 1),
      action: letter,
      write: W(`<li>${QUOTE0}kT1w</li>`),
      source: "derived (D18 step 1); measured",
    });
  });

  test("a line led by a line break after a block: its start (QB el1)", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}<br>`),
      place: itemPoint(1, 1),
      action: letter,
      // <base> writes Q0wk
      write: W(`<li>${QUOTE0}k<br /></li>`),
      source: "D18 step 1, spec 5.3",
    });
  });

  test("a line led by an image after a block: its start (QI el1)", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}${IMG}`),
      place: itemPoint(1, 1),
      action: letter,
      // <base>: M3c
      write: W(`<li>${QUOTE0}k<img /></li>`),
      source: "D18 step 1",
    });
  });

  test("QBT: a letter at the start of a break-led line after a quote", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}<br>T2w`),
      place: itemPoint(1, 1),
      action: letter,
      write: W(`<li>${QUOTE0}k<br />T2w</li>`),
      source: "D18 step 1 (its own example)",
    });
  });

  test("a point on a line at offset 0 is never moved", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}<br>T2w`),
      place: inUpdate(() => {
        const line = $items()[1].getChildren().find($isCmsLineNode);
        expect(line, "the line after the quote").toBeDefined();
        $setElementPoint(line as ElementNode, 0);
      }),
      action: letter,
      write: W(`<li>${QUOTE0}k<br />T2w</li>`),
      source: '5.3 ("a point on a line is never moved"), check 2 group C',
    });
  });

  test("a line led by a link takes the point (QA el1)", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}${LINK}`),
      place: itemPoint(1, 1),
      action: letter,
      write: W(`<li>${QUOTE0}k<a>Lw</a></li>`),
      source: "spec 5.3",
    });
  });

  test("a line before the point: its end (TQ@1)", async () => {
    await expectEdit({
      stored: LI(`T0w${QUOTE1}`),
      place: itemPoint(1, 1),
      action: letter,
      write: W(`<li>T0wk${QUOTE1}</li>`),
      source: "derived (D18 step 2); measured",
    });
  });

  test("TQT el1 is the end of T0w", async () => {
    await expectEdit({
      stored: LI(`T0w${QUOTE1}T2w`),
      place: itemPoint(1, 1),
      action: letter,
      write: W(`<li>T0wk${QUOTE1}T2w</li>`),
      source: "check section 5 (T0wk)",
    });
  });

  test("TQT el2 is the start of T2w", async () => {
    await expectEdit({
      stored: LI(`T0w${QUOTE1}T2w`),
      place: itemPoint(1, 2),
      action: letter,
      write: W(`<li>T0w${QUOTE1}kT2w</li>`),
      source: "derived (D18 step 1); measured",
    });
  });

  test("BQ el1 is after the line break", async () => {
    await expectEdit({
      stored: LI(`<br>${QUOTE1}`),
      place: itemPoint(1, 1),
      action: letter,
      write: W(`<li><br />k${QUOTE1}</li>`),
      source: "spec 5.3",
    });
  });

  test("a point at a line's edge is outside its link (AQ el1)", async () => {
    await expectEdit({
      stored: LI(`<a href="https://example.org/a">Aw</a>${QUOTE1}`),
      place: itemPoint(1, 1),
      action: letter,
      write: W(`<li><a>Aw</a>k${QUOTE1}</li>`),
      source: 'derived (5.8 "outside any link"); measured',
    });
  });

  test("a block at the point: its start (QR@0)", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}<hr>`),
      place: itemPoint(1, 0),
      action: letter,
      write: W("<li><blockquote><p>kQ0w</p></blockquote><hr /></li>"),
      source: "derived (D18 step 3); measured",
    });
  });

  test("a block before the point: its end (QR@1)", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}<hr>`),
      place: itemPoint(1, 1),
      action: letter,
      write: W("<li><blockquote><p>Q0wk</p></blockquote><hr /></li>"),
      source: "derived (D18 step 3); measured",
    });
  });

  test("an empty line beside rules only (TR@2)", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: letter,
      write: W("<li>T0w<hr />k</li>"),
      source: "D13",
    });
  });

  test("an empty line (RT@0)", async () => {
    await expectEdit({
      stored: LI("<hr>T1w"),
      place: itemPoint(1, 0),
      action: letter,
      write: W("<li>k<hr />T1w</li>"),
      source: "D13",
    });
  });

  test("an empty line (RR@1)", async () => {
    await expectEdit({
      stored: LI("<hr><hr>"),
      place: itemPoint(1, 1),
      action: letter,
      write: W("<li><hr />k<hr /></li>"),
      source: "D13",
    });
  });

  test("D13: Heading 2 in an empty line", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: blockType("Heading 2"),
      write: W("<li>T0w<hr /><h2></h2></li>"),
      source: "D13",
    });
  });

  test("D13: Quote in an empty line", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: blockType("Quote"),
      // P1, ruled (T21)
      write: W("<li>T0w<hr /><blockquote></blockquote></li>"),
      caret: "element:quote@0",
      source: "D13, P1",
    });
  });

  test("D13: Code in an empty line", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: blockType("Code"),
      // P2, ruled (T21)
      write: W("<li>T0w<hr /><pre><code></code></pre></li>"),
      caret: "element:code@0",
      source: "D13, P2",
    });
  });

  test("D13: Paragraph in an empty line writes nothing", async () => {
    await expectEdit({
      stored: LI("T0w<hr>"),
      place: itemPoint(1, 2),
      action: blockType("Paragraph"),
      write: null,
      source: "TS0, 5.7",
    });
  });

  // expectEdit has no option to leave out the caret after undo, so this
  // test uses the kit's drivers with explicit checks for everything
  // expectEdit checks except that caret (T22.1: undo puts the caret at
  // the line's start, the same place before the link): the write, calls,
  // caret, D19, undo's value and state, redo, no console error, the 2 s
  // bound and the fixed point; then a letter right after the undo lands
  // before the link, outside it
  test("a composition at the start of a line led by a link lands before the link (round 9)", async () => {
    const stored = LI(`${QUOTE0}${LINK}`);
    // M31-QA el1-ime, ruled (T21)
    const write = W(`<li>${QUOTE0}a<a>Lw</a></li>`);
    const errors: string[] = [];
    const timed = async (step: Step) => {
      const start = performance.now();
      await step();
      expect(performance.now() - start, "step in ms").toBeLessThan(2000);
    };
    const run = async () => {
      const onChange = await mount(stored);
      await itemPoint(1, 1)();
      const editor = editorOf()!;
      const before = editor.getEditorState().toJSON();
      const valueBefore = exportRichTextHtml(editor);
      vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        const text = args.map(String).join(" ");
        if (text.includes("not wrapped in act") === false) {
          errors.push(text);
        }
      });
      onChange.mockClear();
      await timed(ime("a"));
      // one value: the head's three repeat it (16.10; Task 20)
      expect(onChange, "calls").toHaveBeenCalledTimes(1);
      const written = lastHtml(onChange);
      expect(short(written), "write").toBe(write);
      expect(short(written), "D19").not.toBe(short(valueBefore));
      expect(caretKey(), "caret").toBe("text:a@1");
      const after = editor.getEditorState().toJSON();
      await timed(keys("{Control>}z{/Control}"));
      expect(
        sameState(before, editor.getEditorState().toJSON()),
        "one undo restores the state before"
      ).toBe(true);
      expect(short(lastHtml(onChange)), "undo hands out the value before").toBe(
        short(valueBefore)
      );
      return { onChange, editor, after, written };
    };

    // a letter right after the undo lands before the link, outside it
    const first = await run();
    await timed(letter);
    expect(short(lastHtml(first.onChange)), "the letter after undo").toBe(
      W(`<li>${QUOTE0}k<a>Lw</a></li>`)
    );

    // redo equals the write, and the write reopens editable
    const second = await run();
    await timed(keys("{Control>}y{/Control}"));
    expect(
      sameState(second.after, second.editor.getEditorState().toJSON()),
      "redo equals the write"
    ).toBe(true);
    expect(short(lastHtml(second.onChange)), "redo's value").toBe(write);
    expect(errors, "console errors").toEqual([]);
    expectFixedPoint(second.written);
  });

  test("a composition at QR@1 is inserted once", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}<hr>`),
      place: itemPoint(1, 1),
      action: ime("a"),
      write: W("<li><blockquote><p>Q0wa</p></blockquote><hr /></li>"),
      // the head's three (M31, M49) repeat a value (16.10; Task 20): the
      // composed one only, since the composition's start, which leaves the
      // document as it was, hands out nothing (T67.2)
      calls: 1,
      source: "spec 5.3 (the build once)",
    });
  });

  test("a composition at BQ el1 (round 11)", async () => {
    await expectEdit({
      stored: LI(`<br>${QUOTE1}`),
      place: itemPoint(1, 1),
      action: ime("a"),
      // P7-ime, ruled (T21)
      write: W(`<li><br />a${QUOTE1}</li>`),
      // one value: the head's three repeat it (16.10; Task 20)
      calls: 1,
      caret: "text:a@1",
      source: "spec section 14, D18, P7-ime",
    });
  });

  test("V11: the caret after Backspace removes a clicked rule", async () => {
    await expectEdit({
      stored: LI("<br><hr><hr>"),
      // the check's click at the first rule's left edge (el2 at the head)
      place: clickRuleStart,
      action: backspace,
      write: W("<li><br /><hr /></li>"),
      typed: W("<li><br />k<hr /></li>"),
      source: "check V11",
    });
  });
});

describe("D18 step 2: a letter directly before a block lands after the line's last break", () => {
  const blocks = [
    { stored: QUOTE1, written: QUOTE1 },
    { stored: "<h3>H1w</h3>", written: "<h3>H1w</h3>" },
    {
      stored: "<pre><code>C1w</code></pre>",
      written: "<pre><code>C1w</code></pre>",
    },
  ];
  const endings: Array<{
    stored: string;
    n: number;
    written: string;
    records: [string, string, string];
  }> = [
    {
      stored: "T0w<br>",
      n: 2,
      written: "T0w<br />",
      records: [
        // M64a
        W(`<li>T0w<br />k${QUOTE1}</li>`),
        // M64b
        W("<li>T0w<br />k<h3>H1w</h3></li>"),
        // M64c
        W("<li>T0w<br />k<pre><code>C1w</code></pre></li>"),
      ],
    },
    {
      stored: "T0w<br><br>",
      n: 3,
      written: "T0w<br /><br />",
      records: [
        // M64d
        W(`<li>T0w<br /><br />k${QUOTE1}</li>`),
        // M64e
        W("<li>T0w<br /><br />k<h3>H1w</h3></li>"),
        // M64f
        W("<li>T0w<br /><br />k<pre><code>C1w</code></pre></li>"),
      ],
    },
    {
      stored: `${IMG}<br>`,
      n: 2,
      written: "<img /><br />",
      records: [
        // M64g
        W(`<li><img /><br />k${QUOTE1}</li>`),
        // M64h
        W("<li><img /><br />k<h3>H1w</h3></li>"),
        // M64i
        W("<li><img /><br />k<pre><code>C1w</code></pre></li>"),
      ],
    },
    {
      stored: `${LINK}<br>`,
      n: 2,
      written: "<a>Lw</a><br />",
      records: [
        // M64j
        W(`<li><a>Lw</a><br />k${QUOTE1}</li>`),
        // M64k
        W("<li><a>Lw</a><br />k<h3>H1w</h3></li>"),
        // M64l
        W("<li><a>Lw</a><br />k<pre><code>C1w</code></pre></li>"),
      ],
    },
    {
      stored: "<br>T0w<br>",
      n: 3,
      written: "<br />T0w<br />",
      records: [
        // M64m
        W(`<li><br />T0w<br />k${QUOTE1}</li>`),
        // M64n
        W("<li><br />T0w<br />k<h3>H1w</h3></li>"),
        // M64o
        W("<li><br />T0w<br />k<pre><code>C1w</code></pre></li>"),
      ],
    },
    {
      stored: "<br>",
      n: 1,
      written: "<br />",
      records: [
        // M64p
        W(`<li><br />k${QUOTE1}</li>`),
        // M64q
        W("<li><br />k<h3>H1w</h3></li>"),
        // M64r
        W("<li><br />k<pre><code>C1w</code></pre></li>"),
      ],
    },
  ];
  const cases = endings.flatMap((ending) =>
    blocks.map((block, index) => ({
      name: `${ending.stored} before ${block.stored}`,
      ending,
      block,
      write: ending.records[index],
    }))
  );

  test.each(cases)("$name", async ({ ending, block, write }) => {
    expect(write).toBe(W(`<li>${ending.written}k${block.written}</li>`));
    await expectEdit({
      stored: LI(`${ending.stored}${block.stored}`),
      place: itemPoint(1, ending.n),
      action: letter,
      write,
      source: "M64a to M64r",
    });
  });
});

describe("D18 step 1 at the other break-led and image-led lines after a block", () => {
  const shapes = [
    {
      name: "HBT",
      block: "<h3>H0w</h3>",
      line: "<br>T2w",
      written: "<br />T2w",
    },
    {
      name: "CBT",
      block: "<pre><code>C0w</code></pre>",
      line: "<br>T2w",
      written: "<br />T2w",
    },
    {
      name: "QIT",
      block: QUOTE0,
      line: `${IMG}T2w`,
      written: "<img />T2w",
    },
  ];

  for (const shape of shapes) {
    test(`${shape.name} el1, a letter`, async () => {
      await expectEdit({
        stored: LI(`${shape.block}${shape.line}`),
        place: itemPoint(1, 1),
        action: letter,
        write: W(`<li>${shape.block}k${shape.written}</li>`),
        source: "derived (D18 step 1); measured",
      });
    });

    test(`${shape.name} el1, Enter splits the item before the line`, async () => {
      await expectEdit({
        stored: LI(`${shape.block}${shape.line}`),
        place: itemPoint(1, 1),
        action: enter,
        write: W(`<li>${shape.block}</li><li>${shape.written}</li>`),
        source:
          'derived (D18 step 1: "Enter splits the item before the line"); measured',
      });
    });
  }

  test("QIT el1, Backspace joins the line into the quote's paragraph", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}${IMG}T2w`),
      place: itemPoint(1, 1),
      action: backspace,
      write: W("<li><blockquote><p>Q0w<img />T2w</p></blockquote></li>"),
      source: 'check 3, "Ruled with no change" (the QIT bullet)',
    });
  });

  test("QIT el1, Delete removes the image", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}${IMG}T2w`),
      place: itemPoint(1, 1),
      action: del,
      write: W(`<li>${QUOTE0}T2w</li>`),
      source: 'check 3, "Ruled with no change" (the QIT bullet)',
    });
  });

  test("QIT el1, Shift+Enter puts a line break at the line's start", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}${IMG}T2w`),
      place: itemPoint(1, 1),
      action: shiftEnter,
      write: W(`<li>${QUOTE0}<br /><img />T2w</li>`),
      typed: W(`<li>${QUOTE0}<br />k<img />T2w</li>`),
      source: 'check 3, "Ruled with no change" (the QIT bullet)',
    });
  });
});

describe("C: a point at a line's start (check 2)", () => {
  test("a point at a line's start stays there: ArrowLeft after a break that follows a quote, then a letter", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}<br>T2w`),
      place: then(at("T2w", 0), keys("{ArrowLeft}")),
      action: letter,
      write: W(`<li>${QUOTE0}k<br />T2w</li>`),
      source: "check 2, group C (C1 withdrawn)",
    });
  });

  test("a point at a line's start stays there: then Enter", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}<br>T2w`),
      place: then(at("T2w", 0), keys("{ArrowLeft}")),
      action: enter,
      write: W(`<li>${QUOTE0}</li><li><br />T2w</li>`),
      source: "check 2, group C (C1 withdrawn)",
    });
  });
});

describe("5.3: the resolver's three calling places", () => {
  test("J: a point on an item that holds only a nested list logs no error", async () => {
    await mount("<ul><li>a1q</li><li><ul><li><hr>T1q</li></ul></li></ul>");
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (text.includes("not wrapped in act") === false) {
        errors.push(text);
      }
    });
    await inUpdate(() => {
      const item = $getRoot()
        .getFirstChildOrThrow<ElementNode>()
        .getChildAtIndex(1) as ElementNode;
      $setElementPoint(item, 0);
    })();
    expect(errors).toEqual([]);
    expectNoPointOnLinedContainer();
  });

  test("the transform resolves a point set in an update that dirties its container", async () => {
    await mount(LI("T0w<hr>"));
    await click(editable());
    await settle();
    const editor = editorOf()!;
    let updates = 0;
    const off = editor.registerUpdateListener(() => {
      updates += 1;
    });
    try {
      await act(async () => {
        editor.update(() => {
          const item = $items()[1];
          $setElementPoint(item, 2);
          item.markDirty();
        });
      });
      await settle();
    } finally {
      off();
    }
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        const line = $isCmsLineNode(node) ? node : node.getParent();
        expect($isCmsLineNode(line), "the anchor is in a line").toBe(true);
      }
    });
    expect(updates, "no update after the one that set the point").toBe(1);
  });

  test("a point on an item that holds only a nested list resolves into the list", async () => {
    await mount("<ul><li>Aw<ul><li>Bw</li></ul></li></ul>");
    let list = "";
    await inUpdate(() => {
      const item = $items().find(
        (candidate) =>
          candidate.getChildrenSize() === 1 &&
          $isListNode(candidate.getFirstChild())
      );
      expect(item, "the item that holds only the nested list").toBeDefined();
      list = item!.getFirstChildOrThrow().getKey();
      $setElementPoint(item!, 0);
    })();
    editorOf()!
      .getEditorState()
      .read(() => {
        const selection = $getSelection();
        expect($isRangeSelection(selection)).toBe(true);
        if ($isRangeSelection(selection)) {
          const node = selection.anchor.getNode();
          expect(
            node.getKey() === list ||
              node.getParents().some((parent) => parent.getKey() === list),
            `the anchor ${node.getType()} is in the nested list`
          ).toBe(true);
        }
      });
  });

  test("editor.focus() with no selection leaves no point on a lined container", async () => {
    const onChange = await mount("<ul><li>T0w<hr></li></ul>");
    await click(editable());
    onChange.mockClear();
    const editor = editorOf()!;
    await act(async () => {
      editor.update(() => $setSelection(null));
    });
    await act(async () => {
      editor.focus();
    });
    await settle();
    expectNoPointOnLinedContainer();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("the caret set to the start leaves no point on a lined container", async () => {
    const onChange = await mount("<ul><li><hr>T1w</li></ul><p>Zw</p>");
    await click(editable());
    onChange.mockClear();
    const editor = editorOf()!;
    await act(async () => {
      editor.update(() => $setSelection(null));
    });
    await act(async () => {
      editor.focus(undefined, { defaultSelection: "rootStart" });
    });
    await settle();
    expectNoPointOnLinedContainer();
    expect(onChange).not.toHaveBeenCalled();
  });

  const selectAllCase = async (stored: string, word: string, typed: string) => {
    const onChange = await mount(stored);
    await at(word)();
    onChange.mockClear();
    const depth = undoDepth();
    await selectAll();
    await settle();
    expectNoPointOnLinedContainer();
    expect(onChange).not.toHaveBeenCalled();
    expect(undoDepth(), "no undo step").toEqual(depth);
    await keys("{Control>}z{/Control}")();
    expect(onChange, "Ctrl+Z after select-all").not.toHaveBeenCalled();
    await letter();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(short(lastHtml(onChange))).toBe(typed);
  };

  test("select-all on content that starts with a lined item leaves no point on it", async () => {
    // M54a
    await selectAllCase(
      "<ul><li><hr>T1w</li></ul><p>Zw</p>",
      "Zw",
      "<ul><li>k</li></ul>"
    );
  });

  test("select-all on content that ends with a lined item leaves no point on it", async () => {
    // M54b
    await selectAllCase(
      "<ul><li>T0w<hr></li></ul>",
      "T0w",
      "<ul><li>k</li></ul>"
    );
  });

  test("F4: the arrows reach an image that is an item's only run", async () => {
    const onChange = await mount(LI(`${QUOTE0}${IMG}`));
    await at("Q0w")();
    onChange.mockClear();
    const carets: string[] = [];
    for (let press = 0; press < 3; press += 1) {
      await userEvent.keyboard("{ArrowRight}");
      await settle();
      carets.push(caretKey());
      if (carets.at(-1) === "node:cms-image") {
        break;
      }
    }
    expect(carets.at(-1), carets.join(" ")).toBe("node:cms-image");
    expect(
      carets.some((caret) => caret.includes("Nw")),
      carets.join(" ")
    ).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("F8: emptying the text after a block keeps the caret in its line", async () => {
    await expectEdit({
      stored: `<ul><li>${QUOTE0}T1w</li><li>Nw</li></ul>`,
      place: then(at("T1w", 3), backspace, backspace, backspace),
      action: letter,
      // P26, ruled (T21): the emptied line keeps the caret
      write:
        "<ul><li><blockquote><p>Q0w</p></blockquote>k</li><li>Nw</li></ul>",
      caret: "text:k@1",
      source: "F8, P26 (ruled, not built at the carry)",
    });
  });
});

describe("5.4 and F8: a line a removal empties while it holds the caret", () => {
  const stored = LI(`${QUOTE0}<hr>`);
  // a click at the item's end makes the caret line after the rule; a
  // letter, then Backspace empties it (a removal), then Backspace removes
  // the rule
  const emptiedBesideQuote = then(
    clickItemCorner(1),
    letter,
    backspace,
    backspace
  );

  test("P9-2: the emptied line keeps the caret after its rule goes", async () => {
    await expectEdit({
      stored,
      place: emptiedBesideQuote,
      action: letter,
      // T24.1: the letter in the line, directly after the quote
      writeMatches: (written) => {
        expect(short(written)).toContain("</blockquote>k</li>");
      },
      source: "P9-2, ruled (T24.1)",
    });
  });

  const emptiedLineCount = () =>
    editorOf()!
      .getEditorState()
      .read(
        () =>
          $items()
            .flatMap((item) => item.getChildren())
            .filter((child) => $isCmsLineNode(child) && child.isEmpty()).length
      );

  test("P9-2: the caret leaving the emptied line by an arrow key removes it at once, with no onChange", async () => {
    const onChange = await mount(stored);
    await emptiedBesideQuote();
    expect(emptiedLineCount(), "the emptied line holds the caret").toBe(1);
    onChange.mockClear();
    await keys("{ArrowUp}")();
    expect(emptiedLineCount(), "no empty line left").toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("P9-2: the caret leaving the emptied line by a real click keeps it until the next key, with no onChange", async () => {
    const onChange = await mount(stored);
    await emptiedBesideQuote();
    expect(emptiedLineCount(), "the emptied line holds the caret").toBe(1);
    onChange.mockClear();
    // spec 5.8 (T26.1): a line the caret left by a press stays until the
    // field's next key or edit
    await at("Pw")();
    expect(emptiedLineCount(), "kept after the click").toBe(1);
    await keys("{ArrowLeft}")();
    expect(emptiedLineCount(), "gone at the next key").toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("a line emptied by undo, not a removal, is not exempt: C2 gives its point back", async () => {
    await expectEdit({
      stored,
      place: then(
        clickItemCorner(1),
        letter,
        keys("{Control>}z{/Control}"),
        backspace
      ),
      action: letter,
      write: W("<li><blockquote><p>Q0wk</p></blockquote></li>"),
      source: "check 2, C2 (QR gives Q0wk)",
    });
  });

  test("a line a removal empties without holding the caret is not exempt", async () => {
    await expectEdit({
      stored: LI(`${QUOTE0}${IMG}`),
      // the image node-selected, then Delete: no caret was in its line
      place: then(nodeSelect("cms-image"), del),
      action: letter,
      write: W("<li><blockquote><p>Q0wk</p></blockquote></li>"),
      source: "check 2, C2 (a clicked image after a quote, deleted)",
    });
  });
});
