// 5.3's empty caret line: no onChange and no undo step by click or arrow,
// gone when the caret leaves, the sweep's scope, large values.
import { describe, expect, test } from "vitest";
import { act } from "react-dom/test-utils";
import { $dfs } from "@lexical/utils";
import { $getRoot, $isElementNode, type LexicalNode } from "lexical";
import { exportRichTextHtml } from "./rich-text-html";
import {
  at,
  backspace,
  caretKey,
  clickItemCorner,
  itemPoint,
  keys,
  letter,
  LI,
  mount,
  selectAll,
  short,
} from "./rich-text-line-test-kit";
import { undoDepth } from "./rich-text-line-test-kit-branch";
import { editorOf, lastHtml, settle } from "./rich-text-test-harness";
import { $isCmsLineNode } from "./rich-text-line-node";

/** Empty lines in the whole state, or in the `item`-th list item only. */
const emptyLines = (item?: number) =>
  editorOf()!
    .getEditorState()
    .read(() => {
      let scope: LexicalNode = $getRoot();
      if (item !== undefined) {
        scope = $dfs()
          .map(({ node }) => node)
          .filter((node) => node.getType() === "listitem")[item];
      }
      return $dfs(scope).filter(
        ({ node }) => $isCmsLineNode(node) && node.isEmpty()
      ).length;
    });

/** Whether the `item`-th list item's last child is an empty line. */
const endsInEmptyLine = (item: number) =>
  editorOf()!
    .getEditorState()
    .read(() => {
      const target = $dfs()
        .map(({ node }) => node)
        .filter((node) => node.getType() === "listitem")[item];
      const last = $isElementNode(target) ? target.getLastChild() : null;
      return $isCmsLineNode(last) && last.isEmpty();
    });

const html = () => exportRichTextHtml(editorOf()!);

describe("the empty caret line", () => {
  test("a click to the point after a rule fires no onChange and adds no undo step", async () => {
    const onChange = await mount(LI("T0w<hr>"));
    await at("Pw")();
    await letter();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(undoDepth().undo).toBe(1);
    const before = html();
    await clickItemCorner(1)();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(html()).toBe(before);
    expect(undoDepth().undo).toBe(1);
    await keys("{Control>}z{/Control}")();
    expect(short(lastHtml(onChange))).toBe(short(LI("T0w<hr />")));
    expect(undoDepth().undo).toBe(0);
    await at("Nw")();
    expect(emptyLines()).toBe(0);
  });

  test("an arrow to the point after a rule fires no onChange and adds no undo step", async () => {
    const onChange = await mount(LI("T0w<hr>"));
    await at("T0w")();
    await keys("{ArrowRight}")();
    await keys("{ArrowRight}")();
    expect(onChange).not.toHaveBeenCalled();
    expect(caretKey()).toBe("element:listitem@2");
    expect(undoDepth().undo).toBe(0);
    await keys("{Control>}z{/Control}")();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("an empty caret line goes when the caret leaves: left by an arrow key, at once", async () => {
    const onChange = await mount(LI("T0w<hr>"));
    await itemPoint(1, 2)();
    expect(endsInEmptyLine(1)).toBe(true);
    await keys("{ArrowRight}")();
    expect(caretKey()).toBe("text:Nw@0");
    expect(emptyLines(1)).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("an empty caret line goes when the caret leaves: left by a real click, at the next key", async () => {
    const onChange = await mount(LI("T0w<hr>"));
    await itemPoint(1, 2)();
    expect(endsInEmptyLine(1)).toBe(true);
    // spec 5.8 (T26.1): a line the caret left by a press stays until the
    // field's next key or edit
    await at("Nw")();
    expect(caretKey()).toBe("text:Nw@2");
    expect(emptyLines(1)).toBe(1);
    await keys("{ArrowLeft}")();
    expect(emptyLines(1)).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  // T26.2, T42.2: a state set by code that differs only by a stray empty
  // line, as the first action after mount: one onChange with the value as
  // it stood (nothing handed out before it, T42.1); after an equal value
  // was handed out: none; either way no undo step
  for (const form of ["first action", "after an equal value"] as const) {
    test(`the sweep looks only where the caret was, ${form}`, async () => {
      const onChange = await mount(
        "<ul><li>T0w<hr></li><li>T1w<hr></li><li>T2w</li></ul>"
      );
      const editor = editorOf()!;
      const stored = short(exportRichTextHtml(editor));
      if (form === "after an equal value") {
        // a commit that changes nothing hands out the value as it stood
        await act(async () => {
          editor.update(() => {
            $getRoot().markDirty();
          });
        });
        await settle();
        expect(onChange, "the equal value handed out").toHaveBeenCalledTimes(1);
        expect(short(lastHtml(onChange))).toBe(stored);
        onChange.mockClear();
      }
      const depth = undoDepth();
      const mounted = editor.getEditorState().toJSON();
      const json = structuredClone(mounted);
      const list = json.root.children[0] as unknown as {
        children: Array<{ children: unknown[] }>;
      };
      list.children[0].children.push({
        type: "cms-line",
        version: 1,
        children: [],
        direction: null,
        format: "",
        indent: 0,
      });
      await act(async () => {
        editor.setEditorState(editor.parseEditorState(JSON.stringify(json)));
      });
      await settle();
      expect(endsInEmptyLine(0)).toBe(true);
      if (form === "first action") {
        expect(onChange, "one onChange").toHaveBeenCalledTimes(1);
        expect(short(lastHtml(onChange)), "the value as it stood").toBe(stored);
      } else {
        expect(onChange, "no onChange").not.toHaveBeenCalled();
      }
      expect(undoDepth(), "no undo step").toEqual(depth);
      onChange.mockClear();
      await at("T2w", 1)();
      await keys("{ArrowRight}")();
      expect(endsInEmptyLine(0)).toBe(true);
      expect(onChange).not.toHaveBeenCalled();
      // the stray line goes, so the net finds none
      await act(async () => {
        editor.setEditorState(editor.parseEditorState(JSON.stringify(mounted)));
      });
      await settle();
    });
  }

  test("large values stay fast", async () => {
    const items = Array.from(
      { length: 400 },
      (_, i) => `<li>T${i}w<hr></li>`
    ).join("");
    const times: Record<string, number | number[]> = {};
    const time = async (step: () => Promise<void>) => {
      const start = performance.now();
      await step();
      return performance.now() - start;
    };
    times.mount = await time(async () => {
      await mount(`<ul>${items}</ul>`);
      await settle();
    });
    const editor = editorOf()!;
    // the selection-change step's update time, per selection change
    const changes: number[] = [];
    let started: number | undefined;
    const onSelectionChange = () => {
      started = performance.now();
    };
    window.addEventListener("selectionchange", onSelectionChange, true);
    const offUpdate = editor.registerUpdateListener(() => {
      if (started !== undefined) {
        changes.push(performance.now() - started);
        started = undefined;
      }
    });
    times.click = await time(at("T300w"));
    const presses: number[] = [];
    for (let press = 0; press < 20; press += 1) {
      presses.push(await time(keys("{ArrowRight}")));
    }
    times.presses = presses;
    await at("T300w", 1)();
    times.letter = await time(letter);
    await selectAll();
    times.backspace = await time(backspace);
    window.removeEventListener("selectionchange", onSelectionChange, true);
    offUpdate();
    const sorted = [...changes].sort((a, b) => a - b);
    times.selectionChangeMedian = sorted[Math.floor(sorted.length / 2)] ?? 0;
    // a measurement for the pull request's body
    console.info(`large values (ms): ${JSON.stringify(times)}`);
    expect(times.mount).toBeLessThan(2000);
    for (const press of presses) {
      expect(press).toBeLessThan(2000);
    }
    expect(times.letter).toBeLessThan(2000);
    expect(times.backspace).toBeLessThan(2000);
  }, 120_000);
});
