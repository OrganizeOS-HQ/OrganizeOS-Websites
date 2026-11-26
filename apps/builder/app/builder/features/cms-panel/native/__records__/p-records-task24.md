# Task 24: P records

## P24-1: three of the 36 cases fail the undo check (a question; Task 24 stopped at Step 2)

- Step 1's four `CARETS` changes made (uncommitted): rows at lines 97, 103, 109, 115 of `rich-text-block-led-edits.test.tsx` become `element:cms-line@0`.
- Run (`core-browser-builder-cms-rich-text`, the file alone, twice): 159 passed, 3 failed, the same three both times.
- The three: the row "the end of an item holding a quote, then a rule" (`<ul><li><blockquote><p>Z1</p></blockquote><hr /></li><li>t1</li></ul>`) by Enter, Shift+Enter and the Image button. Each fails at the undo check (the file's line 592: `JSON.stringify` of the whole editor state after `undo()` against the state before the edit). The write checks pass.
- The difference: only the `direction` field. Before the edit the `cms-line` and its `listitem` have `"direction":null`; after undo, `"direction":"ltr"`. Nothing else differs.
- The other 33 pass: the other three carets for all nine edits, and this caret for the other six edits.
- Not changed: the comparison (D7 would be a third ruled exception). Steps 3 to 5 not run. Step 3: T13.1's pin, none found (P19-5).

## P24-2: T52.2 confirmations for the three cases (Enter, Shift+Enter, the Image button) at "the end of an item holding a quote, then a rule"

Measured with a scratch test (not committed) on `<ul><li><blockquote><p>Z1</p></blockquote><hr /></li><li>t1</li></ul>`, caret placed by a click at the start of "t1" then Left.

- a. A letter typed after the undo writes `<ul><li><blockquote><p>Z1</p></blockquote><hr />x</li><li>t1</li></ul>` for all three edits. The same letter typed at that caret in a fresh editor, with no edit and no undo, writes the identical HTML. Holds.
- b. Redo (Ctrl+Shift+Z) after the undo writes the edit's own write, for all three (Enter: `...<hr /></li><li></li><li>t1</li>...`; Shift+Enter: `...<hr /><br /></li>...`; Image: `...<hr /><img ... /></li>...`). Holds.
- c. After the undo the DOM carries `dir="ltr"` on the line (P) and the item (LI); a fresh editor carries the same two attributes. Removing them changes no element's bounding box (x, y, width, height of every element in the editable, rounded to 0.1 px). Holds, for all three.

Result: the third ruled exception (T52.1) applies to the undo comparison of the 36 lined-caret cases only.

## P24-3: the one skipped core-server test (T53.4)

- `apps/builder/app/services/safe-resource-fetch.live.server.test.ts`, "uses the Resource editor request in the inspected server loader path".
- It is `test.skipIf(process.env.WEBSTUDIO_LIVE_RESOURCE_GET !== "1")` (line 224): a live-network test that runs only when that variable is set. The file is on fork main unchanged (last change 88fda27, the upstream 0.309.0 merge; `git diff 2a96a45 HEAD` on it is empty), so it is skipped on main as well. This build skipped no test.
