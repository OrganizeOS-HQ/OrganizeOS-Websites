// The cells of `base-range-into-lined` (Task 17 Step 1b; D14's third
// case, T9.2 F): a block paste of two paragraphs over a range from `Pw@1`
// into the text-led lined item `LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)`,
// ending in its first line or in its quote. It imports nothing from the
// line modules, so the same file records the fixture at fork main.
import { LI, pasteHtml, range, type Step } from "./rich-text-line-test-kit";

export type PasteCell = {
  id: string;
  stored: string;
  place: Step;
  action: Step;
};

const TQT = LI("T0w<blockquote><p>Q1w</p></blockquote>T2w");
const twoParagraphs = pasteHtml("<p>Aq</p><p>Bq</p>", "Aq\nBq");

export const rangeIntoLinedCells = (): PasteCell[] => [
  {
    id: "Pw@1 to T0w@1",
    stored: TQT,
    place: range("Pw", 1, "T0w", 1),
    action: twoParagraphs,
  },
  {
    id: "Pw@1 to Q1w@1",
    stored: TQT,
    place: range("Pw", 1, "Q1w", 1),
    action: twoParagraphs,
  },
];
