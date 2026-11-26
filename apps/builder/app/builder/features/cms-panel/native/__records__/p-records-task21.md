# Task 21 P records: the Lexical behaviours of spec section 12

Measured in fresh editors at Lexical 0.21.0 (the branch at 39d3556 plus Task 21's two test files). Every fact the task names holds; the two records below are about the set-up the task gives, not about a fact.

## P21-1: copied JSON of a single item holds no item

- Stored (built in an update, no HTML import): one list, one item holding a quote (`Q0w`) and a `CmsLineNode` with text `Aw`.
- Point: `$selectAll()` in an update (normalised to `Q0w@0` to `Aw@2`).
- Action: `$generateJSONFromSelectedNodes(editor, $getSelection()).nodes`.
- Branch gives: `[quote(text Q0w), text Aw]`: no `cms-line` (the line's child is promoted), but no `list` or `listitem` either: a selection inside one item copies the item's content, not the item, so "the text `Aw` as a child of the item" cannot be asserted on this shape.
- `<base>`: not applicable (no `CmsLineNode` at `<base>`).
- What the test pins instead: the same item followed by a second item (`Bw`), select all; the JSON then holds the item, with `Aw` as its child and no `cms-line` anywhere. Test 16 (copied HTML) uses the same two-item shape; its single-item HTML was not measured.
- Question for the coordinating session: keep the two-item shape (A), or pin the single-item result above as well (B).

## P21-2: the two history tests run in the browser file, not the node file

- Tests 5 ("redo restores a recorded state without running transforms") and 9 ("a history-merge update replaces the history's current entry") are listed as node tests and use `registerHistory`.
- Measured: `@lexical/history` does not resolve from `apps/builder` (the builder depends on it only through `@lexical/react`). Loading it from `@lexical/react`'s own resolution in `core-server` gives a second copy of `lexical`: its `UNDO_COMMAND` is not the test's (`===` false), so the history never sees the test's undo. The vite resolve conditions (`development`) give the test `Lexical.dev.mjs` while Node's own resolution from the history package gives `Lexical.node.mjs`.
- What was done: both tests run in `rich-text-line-lexical.test.tsx` (project `core-browser-builder-cms-rich-text-lines`) with `HistoryPlugin delay={0}` from `@lexical/react/LexicalHistoryPlugin` (the plugin the field uses, which calls `registerHistory`), asserting the same facts. Totals: 13 node tests, 7 browser tests, 20 in all.
- Question for the coordinating session: accept the placement (A), or add `@lexical/history` to the builder's dependencies so the node file can import it (B; root or builder `package.json` is outside this task's files).
