// The cells of `base-decorator-end` (Task 5 Step 6; T10.7b, T14.17): Shift+Home
// from a real click at `T1w@1` in a paragraph, an item and a line after a
// quote that start with an image (the nine cells that differ from the head),
// and Shift+End from `T1w@1` beside a trailing image (the six controls); each
// then a letter, `ime("ab")` and a menu paste of `Aq`.
import {
  at,
  IMG,
  ime,
  keys,
  letter,
  LI,
  pasteText,
  type Step,
  then,
} from "./rich-text-line-test-kit";

const SHAPES: ReadonlyArray<readonly [string, string, "Home" | "End"]> = [
  ["P-IT", `<p>${IMG}T1w</p>`, "Home"],
  ["LI-IT", LI(`${IMG}T1w`), "Home"],
  ["LIQ-IT", LI(`<blockquote><p>Q0w</p></blockquote>${IMG}T1w`), "Home"],
  ["P-TI", `<p>T1w${IMG}</p>`, "End"],
  ["LI-TI", LI(`T1w${IMG}`), "End"],
];

const ACTIONS: ReadonlyArray<readonly [string, Step]> = [
  ["letter", letter],
  ["ime", ime("ab")],
  ["paste", pasteText("Aq")],
];

export type DecoratorEndCell = {
  id: string;
  stored: string;
  place: Step;
  action: Step;
  /** A control: measured equal at the head and the carry. */
  control: boolean;
};

export const decoratorEndCells: DecoratorEndCell[] = SHAPES.flatMap(
  ([shape, stored, key]) =>
    ACTIONS.map(([name, action]) => ({
      id: `${shape}-${key}-${name}`,
      stored,
      place: then(at("T1w", 1), keys(`{Shift>}{${key}}{/Shift}`)),
      action,
      control: key === "End",
    }))
);
