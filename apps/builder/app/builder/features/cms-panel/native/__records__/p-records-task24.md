# Task 24: P records

## P24-1: three of the 36 cases fail the undo check (a question; Task 24 stopped at Step 2)

- Step 1's four `CARETS` changes made (uncommitted): rows at lines 97, 103, 109, 115 of `rich-text-block-led-edits.test.tsx` become `element:cms-line@0`.
- Run (`core-browser-builder-cms-rich-text`, the file alone, twice): 159 passed, 3 failed, the same three both times.
- The three: the row "the end of an item holding a quote, then a rule" (`<ul><li><blockquote><p>Z1</p></blockquote><hr /></li><li>t1</li></ul>`) by Enter, Shift+Enter and the Image button. Each fails at the undo check (the file's line 592: `JSON.stringify` of the whole editor state after `undo()` against the state before the edit). The write checks pass.
- The difference: only the `direction` field. Before the edit the `cms-line` and its `listitem` have `"direction":null`; after undo, `"direction":"ltr"`. Nothing else differs.
- The other 33 pass: the other three carets for all nine edits, and this caret for the other six edits.
- Not changed: the comparison (D7 would be a third ruled exception). Steps 3 to 5 not run. Step 3: T13.1's pin, none found (P19-5).
