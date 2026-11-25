// No tag outlives its update (T10.5): each place where the field corrects
// a point or does nothing, then a real edit with one onChange and one undo
// step of its own; the selection-change handler; group C's give-back.
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { $dfs } from "@lexical/utils";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type ElementNode,
} from "lexical";
import {
  $wherePoint,
  at,
  backspace,
  del,
  expectEdit,
  hold,
  ime,
  keys,
  letter,
  LI,
  mount,
  short,
  type Step,
  then,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { editable, editorOf, lastHtml, settle } from "./rich-text-test-harness";
import { $isCmsLineNode } from "./rich-text-line-node";

const IMG40 =
  '<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" />';
const LINK = '<a href="https://example.org/l">Lw</a>';
const Q = (word: string) => `<blockquote><p>${word}</p></blockquote>`;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const $items = () =>
  $dfs()
    .map(({ node }) => node)
    .filter((node): node is ElementNode => node.getType() === "listitem");

/** An element point on the `item`-th list item, set in an update. */
const pointOn = async (item: number, offset: number) => {
  await act(async () => {
    editorOf()!.update(() => {
      const { key, offset: at } = $wherePoint($items()[item], offset);
      const selection = $getRoot().selectStart();
      selection.anchor.set(key, at, "element");
      selection.focus.set(key, at, "element");
    });
  });
  await settle();
};

const emptyLines = () =>
  editorOf()!
    .getEditorState()
    .read(
      () =>
        $dfs().filter(({ node }) => $isCmsLineNode(node) && node.isEmpty())
          .length
    );

/**
 * After `correction`, the edit gives one onChange (a composition: at least
 * one) whose value holds what it typed, and one undo step of its own, whose
 * undo restores the value before it.
 */
const holds = async ({
  stored,
  correction,
  edit,
  write,
  holding = "k",
  composing = false,
}: {
  stored: string;
  correction: Step;
  edit: Step;
  write?: string;
  holding?: string;
  composing?: boolean;
}) => {
  const onChange = await mount(stored);
  await correction();
  const before = onChange.mock.calls.length;
  const valueBefore = before === 0 ? short(stored) : short(lastHtml(onChange));
  const steps = undoDepth().undo;
  await edit();
  const calls = onChange.mock.calls.length - before;
  if (composing) {
    expect(calls).toBeGreaterThan(0);
  } else {
    expect(calls).toBe(1);
  }
  const value = short(lastHtml(onChange));
  expect(value).toContain(holding);
  if (write !== undefined) {
    expect(value).toBe(short(write));
  }
  expect(undoDepth().undo).toBe(steps + 1);
  await keys("{Control>}z{/Control}")();
  expect(short(lastHtml(onChange))).toBe(valueBefore);
};

describe("no tag outlives its update", () => {
  test("the point rule moves a point off a lined container, then a letter", async () => {
    const stored =
      "<ul><li>Pw</li><li>T9w<h3>X0w</h3><hr /></li><li>Nw</li></ul>";
    await holds({
      stored,
      correction: async () => {
        await at("X0w")();
        await pointOn(1, 2);
      },
      edit: then(at("Pw"), letter),
      write: "<ul><li>Pwk</li><li>T9w<h3>X0w</h3><hr /></li><li>Nw</li></ul>",
    });
  });
  test("an arrow steps off a node-selected rule, then a letter", async () => {
    await holds({
      stored: "<ul><li>xq<hr />yq</li></ul>",
      correction: then(at("xq"), keys("{ArrowRight}"), keys("{ArrowRight}")),
      edit: letter,
      write: "<ul><li>xq<hr />kyq</li></ul>",
    });
  });
  test("a Delete at the content's end after an image removes nothing, then a letter", async () => {
    await holds({
      stored: `<ul><li>Pw</li><li><h3>X0w${IMG40}</h3></li></ul>`,
      correction: async () => {
        await userEvent.click(editable()!.querySelector("img")!);
        await settle();
        await keys("{Escape}")();
        await del();
      },
      edit: letter,
      write: `<ul><li>Pw</li><li><h3>X0w${IMG40}k</h3></li></ul>`,
    });
  });
  test("a composition at the start of a link-led line", async () => {
    await holds({
      stored: `<ul><li>${LINK}${Q("Q1w")}</li></ul>`,
      correction: async () => {
        await at("Lw", 0)();
        await wait(150);
      },
      edit: async () => {
        await ime("ab")();
        await wait(150);
      },
      write: `<ul><li>ab${LINK}${Q("Q1w")}</li></ul>`,
      holding: "ab",
      composing: true,
    });
  });
  test("a typing run, a point the point rule corrects, then a letter: the letter is its own step, the run one step", async () => {
    const stored = LI("T0w<hr />");
    const onChange = await mount(stored);
    let corrected = 0;
    const off = editorOf()!.registerUpdateListener(({ prevEditorState }) => {
      const on = prevEditorState.read(() => {
        const selection = $getSelection();
        return $isRangeSelection(selection) &&
          selection.anchor.type === "element"
          ? selection.anchor.getNode().getType()
          : "";
      });
      if (on === "listitem") {
        corrected += 1;
      }
    });
    await at("Pw")();
    await keys("abc")();
    // a point on the item between its line and its rule, as code sets one;
    // the correction only moves it, to the line's end
    await pointOn(1, 1);
    await letter();
    off();
    expect(corrected).toBeGreaterThan(0);
    expect(short(lastHtml(onChange))).toBe(
      short("<ul><li>Pwabc</li><li>T0wk<hr /></li><li>Nw</li></ul>")
    );
    await keys("{Control>}z{/Control}")();
    expect(short(lastHtml(onChange))).toBe(
      short("<ul><li>Pwabc</li><li>T0w<hr /></li><li>Nw</li></ul>")
    );
    await keys("{Control>}z{/Control}")();
    expect(short(lastHtml(onChange))).toBe(short(stored));
  });
  test("the selection-change step makes a caret line, then a letter", async () => {
    await holds({
      stored: LI("T0w<hr>"),
      correction: async () => {
        await at("Pw")();
        const li = editable()!.querySelectorAll("li")[1] as HTMLElement;
        const box = li.getBoundingClientRect();
        await userEvent.click(li, {
          position: { x: box.width - 2, y: box.height - 2 },
        } as never);
        await settle();
        expect(emptyLines()).toBe(1);
      },
      edit: letter,
    });
  });
  test("the selection-change step removes a caret line, then a letter", async () => {
    await holds({
      stored: LI("T0w<hr>"),
      correction: async () => {
        await at("Pw")();
        await pointOn(1, 2);
        expect(emptyLines()).toBe(1);
        await keys("{ArrowRight}")();
        expect(emptyLines()).toBe(0);
      },
      edit: letter,
    });
  });
  test("the kept-line removal, then a letter", async () => {
    await holds({
      stored: "<ul><li>Pw</li><li><hr>T1w</li><li>Aw T2w</li><li>Nw</li></ul>",
      correction: async () => {
        await at("Pw")();
        await pointOn(1, 0);
        await at("Aw T2w", 4)();
        expect(emptyLines(), "a kept line").toBe(1);
      },
      edit: letter,
    });
  });
  test("the read-back, then a letter", async () => {
    await holds({
      stored: LI("T0w<hr>T2w"),
      correction: async () => {
        await at("T2w", 1)();
        // the page moves its caret and its selectionchange is not delivered
        // before the key
        const hold = (event: Event) => {
          event.stopImmediatePropagation();
        };
        window.addEventListener("selectionchange", hold, true);
        try {
          const span = [
            ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
          ].find((element) => element.textContent === "T2w")!;
          window.getSelection()!.collapse(span.firstChild!, 3);
          await wait(20);
        } finally {
          window.removeEventListener("selectionchange", hold, true);
        }
      },
      edit: letter,
    });
  });
  test("the press's end, then a letter", async () => {
    await holds({
      stored: LI("<hr>T1w"),
      correction: async () => {
        const rule = editable()!.querySelector("hr")!;
        const box = rule.getBoundingClientRect();
        await hold(editable()!, 50, {
          x: box.left - 6,
          y: box.top + box.height / 2,
        })();
        expect(emptyLines()).toBe(1);
      },
      edit: letter,
    });
  });
});

describe("the selection-change handler", () => {
  test("the selection-change handler changes no node without history-merge", async () => {
    // Lexical's commit of a moved node selection dispatches
    // SELECTION_CHANGE from inside itself; the handler's caret line then
    // fires no onChange
    const onChange = await mount(LI("<br /><hr />"));
    await at("Nw", 0)();
    const lines = () =>
      $dfs().filter(({ node }) => $isCmsLineNode(node)).length;
    const linesBefore = editorOf()!.getEditorState().read(lines);
    let most = linesBefore;
    const off = editorOf()!.registerUpdateListener(({ editorState }) => {
      most = Math.max(most, editorState.read(lines));
    });
    await keys("{ArrowLeft}{ArrowLeft}")();
    off();
    expect(most).toBeGreaterThan(linesBefore);
    expect(onChange).not.toHaveBeenCalled();
    await letter();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(short(lastHtml(onChange))).toBe(short(LI("<br /><hr />k")));
  });
});

/** A real click at the left end of the first rule. */
const clickRuleStart: Step = async () => {
  const rule = editable()!.querySelector<HTMLElement>("hr")!;
  await userEvent.click(rule, {
    position: { x: 1, y: 1 },
    force: true,
  } as never);
  await settle();
};
/** A real click at the bottom-right corner of the item holding `word`. */
const clickItemEnd =
  (word: string): Step =>
  async () => {
    const span = [
      ...editable()!.querySelectorAll<HTMLElement>("[data-lexical-text]"),
    ].find((element) => element.textContent === word)!;
    const item = span.closest("li")!;
    const box = item.getBoundingClientRect();
    await userEvent.click(item, {
      position: { x: box.width - 2, y: box.height - 2 },
      force: true,
    } as never);
    await settle();
  };

describe("C2: an empty caret line beside a line or a block gives its point back", () => {
  test("C2: QRB, Backspace on the rule", async () => {
    await expectEdit({
      stored: LI(`${Q("Q0w")}<hr><br>`),
      place: then(clickRuleStart, backspace),
      action: letter,
      write: short(LI(`${Q("Q0w")}k<br />`)),
    });
  });
  test("C2: RQ, the rule clicked at its start, Delete, then a letter", async () => {
    await expectEdit({
      stored: LI(`<hr>${Q("Q1w")}`),
      place: then(clickRuleStart, del),
      action: letter,
      write: short(LI(Q("kQ1w"))),
    });
  });
  test("C2: QR, the item's end", async () => {
    await expectEdit({
      stored: LI(`${Q("Q0w")}<hr>`),
      place: then(clickItemEnd("Q0w"), backspace),
      action: letter,
      write: short(LI(Q("Q0wk"))),
    });
  });
});
