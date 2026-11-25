// The cells of `base-1511-removal` (Task 5 Step 6; T10.2, check 4, 15.11
// "The ten records"): on `<p>A0w</p><hr><p>B2w</p>`, three ranges with an
// element-point end on the root beside the rule, placed by structure (no real
// input reaches the point after a root-level rule), each forward and
// backward, with Backspace, a letter and a cut: 18 cells. The runner imports
// only the kit, so it records at `<base>` too.
import { expect, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import {
  $createRangeSelection,
  $getRoot,
  $isTextNode,
  $setSelection,
} from "lexical";
import {
  caretKey,
  cut,
  keys,
  mount,
  short,
  type Step,
} from "./rich-text-line-test-kit";
import { editable, editorOf, lastHtml, settle } from "./rich-text-test-harness";

export const STORED_1511 = "<p>A0w</p><hr><p>B2w</p>";

type End = "A0w@1" | "B2w@1" | "before the rule" | "after the rule";

export const RANGES_1511: Array<{ name: string; from: End; to: End }> = [
  { name: "after the rule to B2w@1", from: "after the rule", to: "B2w@1" },
  { name: "A0w@1 to after the rule", from: "A0w@1", to: "after the rule" },
  {
    name: "before the rule to after it",
    from: "before the rule",
    to: "after the rule",
  },
];

export type Cell1511 = {
  id: string;
  range: (typeof RANGES_1511)[number];
  backward: boolean;
  action: "bs" | "k" | "cut";
};

export const cells1511 = (): Cell1511[] =>
  RANGES_1511.flatMap((range) =>
    [false, true].flatMap((backward) =>
      (["bs", "k", "cut"] as const).map((action) => ({
        id: `${range.name}|${backward ? "backward" : "forward"}|${action}`,
        range,
        backward,
        action,
      }))
    )
  );

const $end = (end: End) => {
  const root = $getRoot();
  const rule = root
    .getChildren()
    .find((child) => child.getType() === "horizontalrule");
  expect(rule, "the rule").toBeDefined();
  if (end === "before the rule" || end === "after the rule") {
    return {
      key: root.getKey(),
      offset: rule!.getIndexWithinParent() + (end === "after the rule" ? 1 : 0),
      type: "element" as const,
    };
  }
  const [word, offset] = end.split("@");
  const text = root
    .getAllTextNodes()
    .find((node) => node.getTextContent() === word);
  expect($isTextNode(text), word).toBe(true);
  return { key: text!.getKey(), offset: Number(offset), type: "text" as const };
};

/** The cell's range, set by structure after a real click on the field. */
export const place1511 =
  (cell: Cell1511): Step =>
  async () => {
    await userEvent.click(editable()!);
    await settle();
    await act(async () => {
      editorOf()!.update(() => {
        const first = $end(cell.range.from);
        const last = $end(cell.range.to);
        const [anchor, focus] = cell.backward ? [last, first] : [first, last];
        const selection = $createRangeSelection();
        selection.anchor.set(anchor.key, anchor.offset, anchor.type);
        selection.focus.set(focus.key, focus.offset, focus.type);
        $setSelection(selection);
      });
    });
    await settle();
  };

export const ACTIONS_1511: Record<Cell1511["action"], Step> = {
  bs: keys("{Backspace}"),
  k: keys("k"),
  cut,
};

export type Record1511 = {
  before: string;
  write: string | null;
  calls: number;
  caret: string;
  errors: string[];
  ms: number;
};

export const runCell1511 = async (
  cell: Cell1511,
  action: Step = ACTIONS_1511[cell.action]
): Promise<Record1511> => {
  const onChange = await mount(STORED_1511);
  const errors: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (text.includes("not wrapped in act") === false) {
        errors.push(text.slice(0, 300));
      }
    });
  try {
    await place1511(cell)();
    const before = caretKey();
    onChange.mockClear();
    const start = performance.now();
    try {
      await action();
    } catch (error) {
      errors.push(`throw: ${String(error).slice(0, 300)}`);
    }
    const ms = Math.round(performance.now() - start);
    const calls = onChange.mock.calls.length;
    return {
      before,
      write: calls > 0 ? short(lastHtml(onChange)) : null,
      calls,
      caret: caretKey(),
      errors,
      ms,
    };
  } finally {
    spy.mockRestore();
  }
};
