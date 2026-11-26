// D15: node selections in a lined container. CS0, FS0, CS6, C15, an image
// node-selected after a quote (both forms, T28), the caret after a removed
// node (5.8), and the two root listeners after a root change.
import { afterEach, describe, expect, test, vi } from "vitest";
import { commands, userEvent } from "@vitest/browser/context";
import { act } from "react-dom/test-utils";
import { $getRoot, createEditor } from "lexical";
import {
  at,
  backspace,
  caretKey,
  clipboard,
  copy,
  cut,
  enter,
  expectEdit,
  IMG,
  ime,
  imageNode,
  keys,
  letter,
  LI,
  lineBack,
  lineForward,
  mount,
  nodeAfter,
  nodeSelect,
  pasteClip,
  pasteFiles,
  pasteHtml,
  pasteOwn,
  pasteText,
  quiet,
  recordEdit,
  short,
  type Step,
  then,
  W,
  wordBack,
  wordForward,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { sameState } from "./rich-text-line-test-compare";
import { registerLineInputListener } from "./rich-text-line-node-selection";
import { registerCompositionStep } from "./rich-text-line-history";
import { exportRichTextHtml } from "./rich-text-html";
import { editable, editorOf, lastHtml, settle } from "./rich-text-test-harness";

declare module "@vitest/browser/context" {
  interface BrowserCommands {
    grantClipboard: () => Promise<void>;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

const XRY = "<ul><li>xq<hr>yq</li></ul>";
const RULE = nodeAfter("xq");
const QI = LI(`<blockquote><p>Q0w</p></blockquote>${IMG}`);
const QRT = LI("<blockquote><p>Q0w</p></blockquote><hr>T2w");

type Row = {
  name: string;
  stored?: string;
  place?: Step;
  action: Step;
  write: string | null;
  calls?: number;
  caret?: string;
  typed?: string;
  source: string;
};

const ROWS: Row[] = [
  {
    name: "CS0: a pasted rule replaces the selected rule",
    action: pasteHtml("<hr>"),
    write: "<ul><li>xq</li></ul><hr /><ul><li>yq</li></ul>",
    source: "from M14a; spec 5.7",
  },
  {
    name: "CS0: <hr><p>Aq</p>",
    action: pasteHtml("<hr><p>Aq</p>"),
    write: "<ul><li>xq</li></ul><hr /><p>Aqyq</p>",
    source: "from M14b; spec 5.7",
  },
  {
    name: "CS0: a quote",
    action: pasteHtml("<blockquote><p>Aq</p></blockquote>"),
    write: "<ul><li>xq</li></ul><blockquote><p>Aqyq</p></blockquote>",
    source: "from M14c; spec 5.7",
  },
  {
    name: "CS0: a list",
    action: pasteHtml("<ul><li>Aq</li><li>Bq</li></ul>"),
    write: "<ul><li>xq</li><li>Aq</li><li>Bqyq</li></ul>",
    source: "from M14d; spec 5.7",
  },
  {
    name: "CS0: two paragraphs",
    action: pasteHtml("<p>Aq</p><p>Bq</p>"),
    write: "<ul><li>xqAq</li></ul><p>Bqyq</p>",
    source: "from M14e; spec 5.7",
  },
  {
    name: "CS0: a heading",
    action: pasteHtml("<h2>Aq</h2>"),
    write: "<ul><li>xqAqyq</li></ul>",
    source: "from M14f; spec 5.7",
  },
  {
    name: "CS0: a code block",
    action: pasteHtml("<pre><code>Aq</code></pre>"),
    write: "<ul><li>xq<code>Aq</code>yq</li></ul>",
    source: "from M14g; spec 5.7",
  },
  {
    name: "CS0: own nodes, two paragraphs",
    action: pasteOwn("<p>Aq</p><p>Bq</p>"),
    write: "<ul><li>xqAq</li></ul><p>Bqyq</p>",
    source: "from M14h; spec 5.7",
  },
  {
    name: "CS0: own nodes, inline",
    action: pasteOwn("<b>Aq</b>"),
    write: "<ul><li>xq<b><strong>Aq</strong></b>yq</li></ul>",
    source: "from M14i; spec 5.7",
  },
  {
    name: "FS0: between items",
    stored: "<ul><li>Pw</li><li>xq<hr>yq</li><li>Nw</li></ul>",
    action: pasteHtml("<p>Aq</p><p>Bq</p>"),
    write: "<ul><li>Pw</li><li>xqAq</li></ul><p>Bqyq</p><ul><li>Nw</li></ul>",
    source: "from M14j; spec 5.7",
  },
  {
    // M14l (T23): Enter writes nothing; the letter after it lands after the rule
    name: "FS0: Enter",
    action: enter,
    write: null,
    typed: "<ul><li>xq<hr />kyq</li></ul>",
    source: "from M14l; spec 5.7",
  },
  {
    name: "C15 in a lined item: a text paste replaces the rule",
    action: pasteText("Aq"),
    write: "<ul><li>xqAqyq</li></ul>",
    source: "spec 5.7",
  },
  {
    name: "D15: a letter lands after the rule and the rule stays",
    action: letter,
    write: "<ul><li>xq<hr />kyq</li></ul>",
    source: "derived (D15); measured",
  },
  {
    name: "D15: a file-only paste changes nothing",
    action: pasteFiles,
    write: null,
    source: "D15, section 10",
  },
  {
    name: "D15: an empty-paragraph HTML paste replaces the rule (a paste of a block)",
    action: pasteHtml("<p></p>", ""),
    write: "<ul><li>xq</li></ul><p>yq</p>",
    source: "check 3, Ruled with no change, first bullet (the head's write)",
  },
  {
    name: "D15: an empty text/plain paste changes nothing, the rule stays selected",
    action: pasteText(""),
    write: null,
    caret: "node:horizontalrule",
    source: "check 3, Ruled with no change, first bullet; D15",
  },
  {
    // a marked removal would run the emptied rule on the head's path
    name: "D15: Backspace with a rule node-selected",
    action: backspace,
    write: "<ul><li>xqyq</li></ul>",
    source: "from M58; D15 (the head's result)",
  },
  {
    // M30 (T23): the composition writes the head's result; the letter after it lands after the rule
    name: "D15: composed text keeps the head's result",
    action: ime("a"),
    write: "<ul><li>axq<hr />yq</li></ul>",
    typed: "<ul><li>axq<hr />kyq</li></ul>",
    source: "from M30; D15",
  },
  {
    name: "I: a plain-text paste over a selected rule leaves the caret after the paste",
    place: then(RULE, pasteText("Aq")),
    action: letter,
    write: "<ul><li>xqAqkyq</li></ul>",
    source: "check 2, I (T9.2); spec 5.7 CS0 row",
  },
  {
    name: "C15: two plain lines over a selected rule split the item",
    action: pasteText("Aq\nBq"),
    write: "<ul><li>xqAq</li><li>Bqyq</li></ul>",
    source: "check 4, Ruled with no change (C15)",
  },
  {
    name: "an empty-paragraph paste over a rule that ends a block-led item: the caret stands where the rule was",
    stored: LI("<blockquote><p>Q0w</p></blockquote><hr>"),
    place: nodeAfter("Q0w"),
    action: pasteHtml("<p></p>", ""),
    write: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
    typed: W("<li><blockquote><p>Q0w</p></blockquote>k</li>"),
    source: "T37.2 (P16-3)",
  },
  {
    name: "after a removed rule the caret is at the end of what stood before",
    stored: QRT,
    place: nodeAfter("Q0w"),
    action: backspace,
    write: W("<li><blockquote><p>Q0w</p></blockquote>T2w</li>"),
    caret: "text:Q0w@3",
    source: "derived (5.8); measured",
  },
];

describe("D15: a rule node-selected in a lined item", () => {
  for (const row of ROWS) {
    test(row.name, async () => {
      await expectEdit({
        stored: row.stored ?? XRY,
        place: row.place ?? RULE,
        action: row.action,
        write: row.write,
        calls: row.calls,
        caret: row.caret,
        typed: row.typed,
        source: row.source,
      });
    });
  }

  // the head's write is the value as it stood, with one onChange that
  // repeats it (M14k). T42.2 (P16-1, T37.3): as the first action after
  // mount, one onChange with the value as it stood (nothing handed out
  // before it, T42.1); after an equal value was handed out, none; either
  // way no undo step (P20-7)
  for (const form of ["first action", "after an equal value"] as const) {
    test(`FS0: the root reference, ${form}`, async () => {
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        const text = args.map(String).join(" ");
        if (text.includes("not wrapped in act") === false) {
          errors.push(text.slice(0, 300));
        }
      });
      const onChange = await mount("<p>xq</p><hr><p>yq</p>");
      const stored = short(exportRichTextHtml(editorOf()!));
      if (form === "after an equal value") {
        // a commit that changes nothing hands out the value as it stood
        await act(async () => {
          editorOf()!.update(() => {
            $getRoot().markDirty();
          });
        });
        await settle();
        expect(onChange, "the equal value handed out").toHaveBeenCalledTimes(1);
        expect(short(lastHtml(onChange))).toBe(stored);
      }
      await RULE();
      const depth = undoDepth();
      onChange.mockClear();
      const start = performance.now();
      await pasteHtml("<hr>")();
      expect(performance.now() - start, "the paste in ms").toBeLessThan(2000);
      expect(short(exportRichTextHtml(editorOf()!)), "the value").toBe(
        "<p>xq</p><hr /><p>yq</p>"
      );
      if (form === "first action") {
        expect(onChange, "one onChange").toHaveBeenCalledTimes(1);
        expect(short(lastHtml(onChange)), "the value as it stood").toBe(stored);
      } else {
        expect(onChange, "no onChange").not.toHaveBeenCalled();
      }
      expect(undoDepth(), "no undo step").toEqual(depth);
      expect(errors, "console errors").toEqual([]);
    });
  }

  // two edits: one undo takes back the paste only (M16's record, c2)
  test("CS6: a cut of the rule, then a paste", async () => {
    const record = await recordEdit({
      stored: XRY,
      place: RULE,
      action: then(cut, pasteClip),
    });
    expect(record.calls, "calls").toBe(2);
    expect(record.write, "write").toBe(
      "<ul><li>xq</li></ul><hr /><ul><li>yq</li></ul>"
    );
    expect(record.redoEquals, "redo equals the write").toBe(true);
    expect(record.errors, "console errors").toEqual([]);
    expect(record.slowest, "slowest step in ms").toBeLessThan(2000);
  });

  test("a paste with a rule selected in an item that starts with a block runs at D18's caret, then the rule goes", async () => {
    const atCaret = await recordEdit({
      stored: LI("<blockquote><p>Q0w</p></blockquote>T2w"),
      place: at("T2w", 0),
      action: pasteHtml("<p>Aq</p>"),
    });
    expect(atCaret.calls).toBe(1);
    await expectEdit({
      stored: QRT,
      place: nodeAfter("Q0w"),
      action: pasteHtml("<p>Aq</p>"),
      write: atCaret.write,
      source: "D15, 5.4, check 3, 14.8",
    });
  });
});

/**
 * T45.1: Ctrl+Backspace and Ctrl+Delete with a rule or an image
 * node-selected in a lined item change nothing (D15, D7, T42.1): Lexical's
 * word delete acts on a range only, and the head writes nothing. The line
 * forms are controls: Lexical's beforeinput never dispatches them over a
 * node selection.
 */
describe("T45.1: a word delete over a node selection in a lined item", () => {
  const TQI = LI(`T0w<blockquote><p>Q1w</p></blockquote>X2w${IMG}`);
  const SHAPES: {
    name: string;
    stored: string;
    place: Step;
    node: string;
    typed: string;
    /** the line forms' write: an image goes, as at the head */
    lineWrite: string | null;
  }[] = [
    {
      name: "rule in TRT by code",
      stored: LI("T0w<hr>T2w"),
      place: nodeSelect("horizontalrule"),
      node: "node:horizontalrule",
      typed: W("<li>T0w<hr />kT2w</li>"),
      lineWrite: null,
    },
    {
      name: "rule in TRT for real",
      stored: LI("T0w<hr>T2w"),
      place: nodeAfter("T0w"),
      node: "node:horizontalrule",
      typed: W("<li>T0w<hr />kT2w</li>"),
      lineWrite: null,
    },
    {
      name: "rule in TR by code",
      stored: LI("T0w<hr>"),
      place: nodeSelect("horizontalrule"),
      node: "node:horizontalrule",
      typed: W("<li>T0w<hr />k</li>"),
      lineWrite: null,
    },
    {
      name: "rule in TR for real",
      stored: LI("T0w<hr>"),
      place: nodeAfter("T0w"),
      node: "node:horizontalrule",
      typed: W("<li>T0w<hr />k</li>"),
      lineWrite: null,
    },
    {
      name: "image in QI by code",
      stored: QI,
      place: nodeSelect("cms-image"),
      node: "node:cms-image",
      typed: W("<li><blockquote><p>Q0w</p></blockquote><img />k</li>"),
      lineWrite: W("<li><blockquote><p>Q0w</p></blockquote></li>"),
    },
    {
      name: "image in TQI by code",
      stored: TQI,
      place: nodeSelect("cms-image"),
      node: "node:cms-image",
      typed: W("<li>T0w<blockquote><p>Q1w</p></blockquote>X2w<img />k</li>"),
      lineWrite: W("<li>T0w<blockquote><p>Q1w</p></blockquote>X2w</li>"),
    },
  ];
  const FORMS: { name: string; action: Step; control: boolean }[] = [
    { name: "Ctrl+Backspace", action: wordBack, control: false },
    { name: "Ctrl+Delete", action: wordForward, control: false },
    { name: "lineBack", action: lineBack, control: true },
    { name: "lineForward", action: lineForward, control: true },
  ];
  for (const shape of SHAPES) {
    for (const form of FORMS) {
      const title = form.control
        ? `control: the line forms keep the head's write with a rule or an image node-selected in a lined item: ${shape.name}, ${form.name}`
        : `a word delete with a rule or an image node-selected in a lined item changes nothing: ${shape.name}, ${form.name}`;
      test(title, async () => {
        const errors: string[] = [];
        vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
          const text = args.map(String).join(" ");
          if (text.includes("not wrapped in act") === false) {
            errors.push(text.slice(0, 300));
          }
        });
        const onChange = await mount(shape.stored);
        await shape.place();
        expect(caretKey(), "the node selected").toBe(shape.node);
        const value = exportRichTextHtml(editorOf()!);
        const depth = undoDepth();
        onChange.mockClear();
        await form.action();
        if (form.control && shape.lineWrite !== null) {
          // the head's write (the node grid's head record): the image goes
          expect(onChange, "one onChange").toHaveBeenCalledTimes(1);
          expect(short(lastHtml(onChange)), "the write").toBe(shape.lineWrite);
          expect(errors, "console errors").toEqual([]);
          return;
        }
        expect(onChange, "no onChange").not.toHaveBeenCalled();
        expect(exportRichTextHtml(editorOf()!), "the value").toBe(value);
        expect(undoDepth(), "the history's length").toEqual(depth);
        expect(caretKey(), "the node still selected").toBe(shape.node);
        await letter();
        expect(onChange, "one onChange for the letter").toHaveBeenCalledTimes(
          1
        );
        expect(short(lastHtml(onChange)), "the letter").toBe(shape.typed);
        expect(errors, "console errors").toEqual([]);
      });
    }
  }
});

/**
 * T27, T28, T33.2: `LI(<blockquote><p>Q0w</p></blockquote>IMG)`. A click on
 * the image and Escape leave a caret directly after it; a node selection
 * of the image is a state only code makes.
 */
describe("an image after a quote in a lined item (5.7, T28)", () => {
  const AFTER = W("<li><blockquote><p>Q0w</p></blockquote></li>");
  const PASTED = W("<li><blockquote><p>Q0w</p></blockquote><img />Aq</li>");

  test("a caret directly after an image after a quote, Backspace: the image goes, the caret stays in the emptied line", async () => {
    await expectEdit({
      stored: QI,
      place: imageNode(),
      action: backspace,
      write: AFTER,
      caret: "element:listitem@1",
      typed: W("<li><blockquote><p>Q0w</p></blockquote>k</li>"),
      source: "from M21a (write); T33.2 (caret and typed)",
    });
  });

  test("a caret directly after an image after a quote, a cut: nothing is removed, the clipboard stays", async () => {
    await commands.grantClipboard();
    const onChange = await mount(QI);
    await imageNode()();
    const caretBefore = caretKey();
    const valueBefore = exportRichTextHtml(editorOf()!);
    await navigator.clipboard.writeText("Zz");
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      const text = args.map(String).join(" ");
      if (text.includes("not wrapped in act") === false) {
        errors.push(text);
      }
    });
    const depth = undoDepth().undo;
    onChange.mockClear();
    await userEvent.keyboard("{Control>}x{/Control}");
    await settle();
    expect(await navigator.clipboard.readText(), "the clipboard").toBe("Zz");
    expect(onChange.mock.calls.length, "no onChange").toBe(0);
    expect(undoDepth().undo, "no undo step").toBe(depth);
    expect(exportRichTextHtml(editorOf()!), "the value").toBe(valueBefore);
    expect(caretKey(), "the caret").toBe(caretBefore);
    expect(errors, "console errors").toEqual([]);
  });

  test("a caret directly after an image after a quote, a paste lands after the image and the image stays", async () => {
    const typedThere = await recordEdit({
      stored: QI,
      place: imageNode(),
      action: keys("Aq"),
    });
    expect(typedThere.write, "typing Aq there").toBe(PASTED);
    await expectEdit({
      stored: QI,
      place: imageNode(),
      action: pasteHtml("<p>Aq</p>"),
      write: PASTED,
      source: "D15, check 4; T28",
    });
  });

  describe("a node selection (D15)", () => {
    test("an image node-selected after a quote, Backspace: the caret goes to the quote's end (a state only code makes)", async () => {
      await expectEdit({
        stored: QI,
        place: nodeSelect("cms-image"),
        action: backspace,
        write: AFTER,
        caret: "text:Q0w@3",
        typed: W("<li><blockquote><p>Q0wk</p></blockquote></li>"),
        source: "from M21a (write and typed); 5.7, 5.8; T28, T33.2",
      });
    });

    test("an image node-selected after a quote, a cut: the image goes, the clipboard is the copy's, the caret at the quote's end (a state only code makes)", async () => {
      // the copy of the same node selection (measured equal at <base>)
      await mount(QI);
      await nodeSelect("cms-image")();
      await copy();
      const copied = clipboard();
      expect(copied["text/html"], "the copy holds the image").toContain("<img");
      await expectEdit({
        stored: QI,
        place: nodeSelect("cms-image"),
        action: then(cut, async () => {
          expect(clipboard(), "the cut's clipboard").toEqual(copied);
        }),
        write: AFTER,
        caret: "text:Q0w@3",
        source: "spec 5.7; T28",
      });
    });

    test("an image node-selected after a quote, a paste lands after the image and the image stays (a state only code makes)", async () => {
      await expectEdit({
        stored: QI,
        place: nodeSelect("cms-image"),
        action: pasteHtml("<p>Aq</p>"),
        write: PASTED,
        source: "D15, check 4; T28",
      });
    });
  });
});

describe("the input listeners follow the root (5.8)", () => {
  const rootChange = async () => {
    const editor = editorOf()!;
    const root = editable()!;
    await act(async () => {
      editor.setRootElement(null);
      editor.setRootElement(root);
    });
    await settle();
  };

  test("typing with a rule selected after a root change inserts once", async () => {
    const onChange = await mount(XRY);
    await rootChange();
    await RULE();
    onChange.mockClear();
    await letter();
    expect(onChange.mock.calls.length).toBe(1);
    expect(short(lastHtml(onChange))).toBe("<ul><li>xq<hr />kyq</li></ul>");
  });

  test("a composition after a root change is one undo step and its listeners are registered once", async () => {
    // every capture-phase listener of these types added to or removed from
    // an editable, from before the mount: the line code's (Lexical's own
    // run in the bubble phase)
    const watched = ["beforeinput", "compositionstart", "compositionend"];
    const active = new Map<string, EventListenerOrEventListenerObject[]>();
    const proto = EventTarget.prototype;
    const add = proto.addEventListener;
    const remove = proto.removeEventListener;
    const captured = (options: unknown) =>
      options === true ||
      (typeof options === "object" &&
        options !== null &&
        (options as AddEventListenerOptions).capture === true);
    const counted = (target: EventTarget, type: string, options: unknown) =>
      target instanceof HTMLElement &&
      target.isContentEditable &&
      watched.includes(type) &&
      captured(options);
    proto.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (listener !== null && counted(this, type, options)) {
        const list = active.get(type) ?? [];
        if (list.includes(listener) === false) {
          list.push(listener);
        }
        active.set(type, list);
      }
      add.call(this, type, listener, options);
    };
    proto.removeEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions
    ) {
      if (listener !== null && counted(this, type, options)) {
        active.set(
          type,
          (active.get(type) ?? []).filter((each) => each !== listener)
        );
      }
      remove.call(this, type, listener, options);
    };
    const counts = () =>
      Object.fromEntries(
        watched.map((type) => [type, active.get(type)?.length ?? 0])
      );
    let onChange: ReturnType<typeof vi.fn>;
    try {
      onChange = await mount("<p>Pw</p><p>T0w</p>");
      const mounted = counts();
      await rootChange();
      expect(counts(), "the root's listeners after a root change").toEqual(
        mounted
      );
    } finally {
      proto.addEventListener = add;
      proto.removeEventListener = remove;
    }
    await at("Pw", 2)();
    await letter();
    await quiet();
    const beforeComposition = editorOf()!.getEditorState().toJSON();
    await at("T0w", 1)();
    onChange.mockClear();
    await ime("a")();
    // one value for one composed letter: no repeat (16.10, T29.6; P16-2)
    expect(onChange.mock.calls.length, "one onChange").toBe(1);
    expect(short(lastHtml(onChange))).toBe("<p>Pwk</p><p>Ta0w</p>");
    await keys("{Control>}z{/Control}")();
    expect(
      sameState(beforeComposition, editorOf()!.getEditorState().toJSON()),
      "one undo takes back the composition"
    ).toBe(true);
    expect(short(exportRichTextHtml(editorOf()!))).toBe("<p>Pwk</p><p>T0w</p>");
    await keys("{Control>}z{/Control}")();
    expect(short(exportRichTextHtml(editorOf()!))).toBe("<p>Pw</p><p>T0w</p>");
  });

  // per module: the line input listener's beforeinput and
  // compositionstart; the composition step's compositionend, and its
  // beforeinput and keydown (the person's input after a composition)
  test("the line code's root listeners: one of each per module, after a root change, none after cleanup", async () => {
    const root = document.createElement("div");
    root.contentEditable = "true";
    document.body.appendChild(root);
    const active = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const captured = (options: unknown) =>
      options === true ||
      (typeof options === "object" &&
        options !== null &&
        (options as AddEventListenerOptions).capture === true);
    const add = root.addEventListener.bind(root);
    const remove = root.removeEventListener.bind(root);
    root.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => {
      if (captured(options)) {
        const set = active.get(type) ?? new Set();
        set.add(listener);
        active.set(type, set);
      }
      add(type, listener, options);
    }) as typeof root.addEventListener;
    root.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ) => {
      if (captured(options)) {
        active.get(type)?.delete(listener);
      }
      remove(type, listener, options);
    }) as typeof root.removeEventListener;
    const counts = () =>
      Object.fromEntries(
        ["beforeinput", "compositionstart", "compositionend", "keydown"].map(
          (type) => [type, active.get(type)?.size ?? 0]
        )
      );
    const editor = createEditor({
      onError: (error) => {
        throw error;
      },
    });
    try {
      editor.setRootElement(root);
      const cleanup = [
        registerLineInputListener(editor),
        registerCompositionStep(editor),
      ];
      const one = {
        beforeinput: 2,
        compositionstart: 1,
        compositionend: 1,
        keydown: 1,
      };
      expect(counts(), "registered").toEqual(one);
      editor.setRootElement(null);
      expect(counts(), "no root").toEqual({
        beforeinput: 0,
        compositionstart: 0,
        compositionend: 0,
        keydown: 0,
      });
      editor.setRootElement(root);
      expect(counts(), "after a root change").toEqual(one);
      for (const each of cleanup) {
        each();
      }
      expect(counts(), "after cleanup").toEqual({
        beforeinput: 0,
        compositionstart: 0,
        compositionend: 0,
        keydown: 0,
      });
    } finally {
      editor.setRootElement(null);
      root.remove();
    }
  });
});
