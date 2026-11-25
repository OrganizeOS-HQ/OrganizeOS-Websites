# Task 11 review follow-up: records and sites not reachable

## T29.7: built synchronously

`$focusPastRule` now takes the step past a rule from a line's text edge (not only from a block or an empty caret line), in either direction of text, at the keydown (preventDefault). No timer remains. No P record is needed.

## Page-range keeper sites a real gesture cannot reach with a page range

- **The composition start (`onCompositionStart`, points.ts).** The site runs only while a press is open. A rule or an image is node-selected by Lexical's click handler, and the field ends the press at that same click (window capture). So when a composition starts with a node selection current, no press is open and the site returns at once. No real gesture reaches it with a node selected. No test.
- **The press's end, and the kept-line removal at the keydown read-back, after a press on a rule.** A real press on a rule selects it and leaves the page with no range (`rangeCount` 0), so the keeper has nothing to put back. The tests (two cells × letter and Backspace) assert that the letter equals the letter with the rule selected from text; they do not assert a page range.
- **The Image popover (removeKeptLines on Alt).** The site runs with the image node-selected. Its Escape then leaves a caret beside the image, not the node selection (P9-3, the restore on Escape, is not in a083301). The test compares the write and the state against the same gesture with no kept line; it does not assert a node selection when the key comes.
- **Reached with a page range and a node selection:** the after-commit removal of a line the selection left (3 cells), the check after a commit (arrow node selection of XRY), the toolbar (Bold after a press on a rule with a kept line), and the Link popover (Apply after a press on a rule with a kept line).

## T29.3: the step off a node-selected rule

The plain step goes through Lexical's `selectPrevious` and `selectNext`, which leave an element point on a block beside the rule (`quote@1`, `quote@0`). Nothing in the field requires that form. The step now moves the caret to the block's text edge, the one caret D18 names, as the Shift step does. Changed stops:

- 12 cells of `base-walks-rule`, now `D18: the quote's text`, with the letter unchanged.
- QRQ-Right-2.
- Two stops each in the 15.4 walks "K8 (R2): a left-to-right line, a rule, a right-to-left quote" and "right-to-left on both sides": `quote@0[paragraph]` becomes `"קבג"@0`, letters unchanged.

QRQ-Left-2 is now the head's next press ("shorter", caret `text:Q0w@3`).
