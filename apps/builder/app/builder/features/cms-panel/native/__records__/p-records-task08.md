# Task 8: P records and stops

No P record on a write: every row of Step 1 passes on the branch with the plan's literal. Measurements at `<proto>` and `<base>` were not needed. Every derived row is marked "measured", and the one that was not (M36b's row) was ruled in T19.2.

## Stop 8.1: Step 8. The headless link-rule case does not pin the link rule

- Scratch edit: `editor.registerNodeTransform(LinkNode, $linkGivesUpRules)` commented out in `registerLineTransforms`.
- With the line commented out, "the headless writer registers the link rule" still passes. `writeRichTextHeadless` gives the same bytes with and without the transform:
  - `<ul><li>T0w<a href="https://example.org/">L<hr>w</a><blockquote><p>Q1w</p></blockquote></li></ul>` -> `<ul><li value="1">T0w<a …>L</a><hr><a …>w</a><blockquote><p>Q1w</p></blockquote></li></ul>` (spans stripped)
  - `<ul><li>T0w<a …>L<hr>w</a></li></ul>` -> `<ul><li value="1">T0w<a …>L</a><hr><a …>w</a></li></ul>`, both ways
  - `<p>T0w<a …>L<hr>w</a></p>` -> `<p>T0w<a …>L</a></p><hr><p><a …>w</a></p><p></p>`, both ways
- Cause (likely): the HTML import already splits the link around the `hr`, because the DOM conversion gives the `hr` as a block. The node transform never sees a link that holds a rule on this path.
- For the coordinating session: choose the input that replaces it. The test is kept as written, and it passes.

## Stop 9.1: Step 9. M33's case is not the order pin

- Scratch edit: in the list-item transform of `registerLineTransforms`, `$keepContainer(item)` ran first, then `liftItem`.
- "5.5: two paragraphs pasted after a nested list" (M33) still passes with the order reversed. The paste of `<ul><li>Bq</li></ul><p>H1</p><p>H2</p>` at `Aw@end` in `<ul><li>Aw</li></ul>` puts H1 and H2 at the root, so the item's transform never sees a paragraph after a nested list. The test name did not gain the suffix.
- The four existing pins all fail with the order reversed, and pass again once it is restored:
  - `rich-text-structure.test.tsx`, "blocks pasted into a nested item keep the untouched items in place": "depth 2, two paragraphs" (`['1:a','2:bone','1:two','1:c']` against `[…,'2:c']`), "depth 3, two paragraphs" and "depth 4, two paragraphs".
  - `rich-text-block-led-edits.test.tsx`, "an edit at a caret where the editor finds no block (X1)": "'an HTML paste of two paragraphs' at 'the end of an item's text after a qu…' finishes at once and lands at the caret".
- No other test changed: the 36 known caret preconditions still fail, and all other tests in both files pass.
- For the coordinating session: choose the case that replaces M33's as the order pin. A candidate is the structure test's depth-2 input, which pastes two paragraphs into a nested item.
