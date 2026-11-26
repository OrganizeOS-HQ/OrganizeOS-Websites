// The cells of `base-start-char` (Task 5 Step 6; T10.7b; check 4, "The
// composition-start character"): a backward range over two text nodes, two
// paragraphs, an image and a rule (root-level in ordinary content), each
// ordinary and lined, set by Lexical from `B1w@1` back to `A0w@1`; one
// composed character, then a letter.
import { IMG, LI, range, type Step } from "./rich-text-line-test-kit";

export type StartCharShape = {
  name: string;
  ordinary: string;
  lined: string;
  /** The range crosses a line: Shift+ArrowUp reaches it too. */
  twoLines: boolean;
};

export const START_CHAR_SHAPES: ReadonlyArray<StartCharShape> = [
  {
    name: "two text nodes of one paragraph",
    ordinary: "<p>A0w<b>B1w</b></p>",
    lined: LI("A0w<b>B1w</b>"),
    twoLines: false,
  },
  {
    name: "two paragraphs (lined: two lines)",
    ordinary: "<p>A0w</p><p>B1w</p>",
    lined: LI("A0w<br>B1w"),
    twoLines: true,
  },
  {
    name: "across an image",
    ordinary: `<p>A0w${IMG}B1w</p>`,
    lined: LI(`A0w${IMG}B1w`),
    twoLines: false,
  },
  {
    name: "across a rule (ordinary: root-level)",
    ordinary: "<p>A0w</p><hr><p>B1w</p>",
    lined: LI("A0w<hr>B1w"),
    twoLines: true,
  },
];

/** The range from `B1w@1` back to `A0w@1` (anchor at `B1w`), set by Lexical. */
export const backwardRange: Step = range("B1w", 1, "A0w", 1);
/** The same range forward. */
export const forwardRange: Step = range("A0w", 1, "B1w", 1);

export type StartCharCell = {
  id: string;
  shape: StartCharShape;
  form: "ordinary" | "lined";
  stored: string;
};

export const startCharCells: ReadonlyArray<StartCharCell> =
  START_CHAR_SHAPES.flatMap((shape) =>
    (["ordinary", "lined"] as const).map((form) => ({
      id: `${shape.name}|${form}`,
      shape,
      form,
      stored: form === "ordinary" ? shape.ordinary : shape.lined,
    }))
  );
