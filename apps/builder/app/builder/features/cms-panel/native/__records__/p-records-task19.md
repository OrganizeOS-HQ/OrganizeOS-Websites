# Task 19: P records

Builds: `<base>` = `2a96a45`, `<proto>` = `451f20f04`, branch = Task 19's worktree on `c333cf3`. Writes in `short()` notation. `LI(x)` = `<ul><li>Pw</li><li>x</li><li>Nw</li></ul>`.

## P19-1: the Link popover's focus after a real Apply (T18.8)

The cell where the kit's `link()` driver lost the focus (Task 5, M46): stored `LI(<blockquote><p>Q0w</p></blockquote><br><hr>)`, placed by `then(at("Pw"), clickItemCorner(1))` (caret `element:listitem@3`), Link opened by its button, the address typed, then a real Apply.

| Build    | Apply by       | Write                                                                                               | Focus after  | Letter after       |
| -------- | -------------- | --------------------------------------------------------------------------------------------------- | ------------ | ------------------ |
| `<base>` | Enter          | `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><a><hr /></a></li><li>Nw</li></ul>` c1 | `BODY`       | writes nothing     |
| `<base>` | click on Apply | the same                                                                                            | `BODY`       | writes nothing     |
| branch   | Enter          | none (P14)                                                                                          | the editable | reaches the editor |
| branch   | click on Apply | none (P14)                                                                                          | the editable | reaches the editor |

Controls, same at both builds: a range in `<p>Aw Bw</p>`, and `range("T0w", 1, "Nw", 1)` in `LI(T0w<hr>)`: the editable has the focus after Enter and after Apply.

Reading: a person loses the focus at `<base>` too (the head wraps the rule in a link). R1 does not: P14's ruled no-write keeps the focus in the editable. Pinned by "Link: the focus after a real Apply (T18.8)" in `rich-text-line-toolbar.test.tsx`, both ways. The driver is not changed.

## P19-2: base-link-element-end's cell count (T14.10)

The generator (`item1Cells("link", ["linkBtn"])` of check 5's keys probe, rewritten as `rich-text-line-cells-link-element-end.ts`) gives 90 cells: 30 lined, 60 ordinary. Run with the toolbar's Link (Enter):

- `<proto>` throws (`TypeError: Cannot read properties of undefined (reading 'getParent')`) in 10 lined cells: `BLend|next`, `BLend|other`, `BLtrail|other`, `LLend|next`, `LLend|other`, each fwd and bwd. Check 5 counts 8: the two `BLtrail|other` cells throw at `<base>` too, so they are not cells "where the head writes the link".
- `<base>` throws in 12 ordinary cells: `ULend|next`, `ULend|other`, `RPend|next`, `RHend|next`, `RQend|next`, each fwd and bwd (and in the 2 lined `BLtrail|other` cells).
- The branch before the fix threw in the same 20 cells as `<proto>`.

The fixture holds 20 cells (10 lined, 10 ordinary; `LINK_ELEMENT_END_IDS` and the fixture file agree). The 12 at `<base>` are those 10 ordinary cells plus the 2 lined `BLtrail|other` cells, which the 10 lined cells include. The count other than 8 is this record. With the fix, the branch throws in none of the 90, and only those 20 cells' writes change (the other 70 are equal to the branch before the fix).

## P19-3: V11's caret and typed value (T14.4)

`LI(<br><hr><hr>)`, a real click (`clickAt`) at the first rule's centre (`node:horizontalrule`), Backspace, then `k`. Equal at `<base>`, `<proto>` and the branch:

- write `<ul><li>Pw</li><li><br /><hr /></li><li>Nw</li></ul>` c1 (pinned: derived, D15, measured at all three);
- caret `element:listitem@1`;
- typed `<ul><li>Pw</li><li><br />k<hr /></li><li>Nw</li></ul>`.

The caret and the typed value are not pinned.

## P19-4: T13.1's gap click cannot be made

`LI(<pre><code>C0w</code></pre><hr>)`, a real `userEvent.click` on the middle item between the code block's bottom (y 78) and the rule's top (y 86), at 5 %, 25 %, 50 % and 75 % of the gap: the caret is `element:listitem@2` (after the rule) at `<base>`, `<proto>` and the branch; at 95 % the rule is node-selected. Never the code's end. Image from there writes `<ul><li>Pw</li><li><pre><code>C0w</code></pre><hr /><img /></li><li>Nw</li></ul>` at `<base>` and the branch (the item's end, not the code path). The row is pinned with the caret placed by a real click at the end of `C0w` (`caretKey()` is `text:C0w@3`, asserted), which gives T13.1's write `W(<li><pre><code>C0w</code></pre><img /><hr /></li>)`.

## P19-5: Step 1d's grep and the narrowing (ruled: T40.4)

- `git grep` at `<base>` over `native/*.test.tsx`: no test on fork `main` pins the end-of-document write for a code-block caret (the Image cells of `rich-text-block-led-edits.test.tsx` place the caret in a line after the code block; `rich-text-fuzz.test.tsx` checks invariants, not writes). Nothing for Task 24 Step 3 to change; no failure to list in `r1-net-failures.txt`.
- Built for a collapsed caret only. A range with an end in a code block keeps the end-of-document write (unruled; T13.1 names a caret). Candidates: (a) as built; (b) after the code block of the range's focus.
- **Ruled (T40.4):** T13.1 holds for a range too. `insertImage` runs the removal step on the range, removes a range left with an end in a code block (as the insertion would), and takes the caret that leaves as the place: in a code block, the image lands directly after it (the collapsed caret's code path); elsewhere, at that place. The end-of-document fallback is only for a place that is gone. Pinned: `range("C1w", 1, "C1w", 2)` in `<p>Pw</p><pre><code>C1w</code></pre><p>Nw</p>` writes `<p>Pw</p><pre><code>Cw</code></pre><p><img /></p><p>Nw</p>`. Measured on the branch, not pinned: `Pw@1..C1w@1` gives `<p>P<img />1w</p><p>Nw</p>` (the removal leaves the place in the paragraph); `C1w@1..Nw@1` gives `<p>Pw</p><pre><code>Cw</code></pre><p><img /></p>`; `C1w@0..C1w@3` gives `<p>Pw</p><pre><code></code></pre><p><img /></p><p>Nw</p>`.

**Ruled (T41.2):** the range goes by the field's removal, the one Backspace over it runs (`DELETE_CHARACTER_COMMAND`, backward), for every range; the image lands at the caret that leaves (after the code block when that caret is in one). In these cells the field's removal removes the text inside the code block too, so no raw `removeText()` is left in `insertImage`. One call, one undo step. Pinned in `rich-text-line-toolbar.test.tsx` (T13.1 block), each equal on the branch to the ruling's literal:

| Range (in `<p>Pw</p><pre><code>C1w</code></pre><p>Nw</p>`) | Branch (pinned)                                            | `<base>` (measured, 1 call, undo restores)                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Pw@1..C1w@1`                                              | `<p>P<img />1w</p><p>Nw</p>`                               | `<p>Pw</p><pre><code>C1w</code></pre><p>Nw</p><p><img /></p>` (range kept, image at the end) |
| `C1w@1..Nw@1`                                              | `<p>Pw</p><pre><code>Cw</code></pre><p><img /></p>`        | `<p>Pw</p><pre><code>C1w</code></pre><p>Nw</p><p><img /></p>`                                |
| `C1w@0..C1w@3`                                             | `<p>Pw</p><pre><code></code></pre><p><img /></p><p>Nw</p>` | `<p>Pw</p><pre><code>C1w</code></pre><p>Nw</p><p><img /></p>`                                |

`Pw@1..C1w@1`'s place (after the removal) is in a paragraph, not a code block, yet the branch does **not** equal `<base>` (D1): `<base>` removes nothing for a range with an end in a code block and appends the image at the end. Sent with the batch.

## P19-6: the Link command's end placement, narrowed

The Link command (16.11) runs the removal step's end placement (`$lastPointToBlockEnd`, then `$endsIntoText`), exported as `$rangeEndsIntoText`, not `$prepareRemoval(selection, "removal")` whole: `$prepareRemoval` also removes the line break of T23.1/T30.2 (a range ending at the start of a break-led line after a block), a removal no Link ruling names. The placement acts only when an end is an element point. Measured over the 90 generator cells: the writes of the 70 cells that did not throw are unchanged.

## P19-7: the block-type menu covers the field's first lines (15.14) (ruled: T40.1)

The prototype's cell presses at `Aw@1`, which the open menu covers. At `<base>` and `<proto>`: ordinary shape, the press lands in the menu, which stays open; lined shape, the press lands on the menu (an `svg` inside it; the menu closes, nothing written, the focus on the Block type button, the letter writes nothing). The branch's lined result differs: a close by a press on the menu is not a press in the editor, so (T10) the editor takes the focus and the letter writes `<ul><li>Aw<a>Lw</a><hr />Ckw</li></ul>` (at the caret held before the menu opened). Candidates: (a) the branch's (T10: any close not from a press in the editor hands the keys back); (b) `<base>`'s (the focus on the button).

The test presses a word the menu does not cover (a long last line; the test asserts the point is outside the menu): the menu closes, the focus stays on its button, the letter writes nothing, as pinned at the head.

**Ruled (T40.1):** candidate (a). Both cases are pinned in `rich-text-line-press.test.tsx` (15.14), each shape: a press at `Aw@1` on the menu's own surface (the test asserts the point is outside the editable) closes the menu, the editable has the focus, and `k` lands at `Cw@1`, the caret held before the menu opened (on the branch the ordinary shape's press closes the menu too); a press on a word the menu does not cover keeps the head's result.

## P19-8: Step 1e (T11.10) (ruled: T40.6, the point not correctable)

With Shift decided on `click` instead of `pointerdown` (scratch, reverted), these fail: the 15.7 "repeated" and "selectionchange-first" cells at `Aw` and `Cw` (ordinary and lined, rule and image: 16 tests), and 16.16's bottom-padding test (ordinary and lined). They pass: the eight 15.7 cells at `Lw` (retitled "control: ..."), and 16.16's right-padding test (30 runs), whose point gives the same caret with and without Shift at `<base>` too (the rule stays node-selected).
The right-padding test therefore does not tell Shift on `pointerdown` from Shift on `click`: it is retitled "control: 16.16: ..." and is a control, not a pin of the fix.

**T40.6, measured at `<proto>` (temporary worktree, removed):**

- The test's point (3 px inside the editable's right edge, at `Aw`'s line) and check 5's point (the same at `Cw`'s line, the line after the rule) lie outside the test page's viewport: the viewport is 414 px wide, the editable spans x 1 to 479, and `elementFromPoint` there is `null`. The press reaches nothing, so the node stays selected with Shift and without it, at `<proto>` and on the branch.
- Check 5's own probe (`zzv15-nav-p`, rule-arrow, pad-right, 30 reps) run at `<proto>`: with Shift `node` 30 of 30 (check 5's "30 of 30 failing" reproduced); the same probe without Shift: also `node` 30 of 30. Check 5's failure is the point being off screen, not Shift.
- With the editable scrolled so its right edge is in view (`scrollIntoView({ inline: "end" })`), check 5's probe at `<proto>` gives a caret at the point 30 of 30 with Shift and 30 of 30 without, both shapes.
- A grid at `<proto>` and on the branch, both shapes, the editable scrolled into view: 3 px inside the left and the right edge, at the heights of `Aw`, the rule, `Cw`, 3 px below the top and 3 px above the bottom. At every point the caret with Shift equals the caret without, and the two builds agree.
- No point inside the editable was found where the test fails at `<proto>`. The test is unchanged and stays a control ("control: 16.16: ..."); the eight `Lw` cells stay controls.
- **T41.1:** 16.16 withdrawn as a defect. The right-padding control now scrolls the editable's right edge into view first and presses 3 px inside it; it asserts that `elementFromPoint` there is inside the editable (a real press).

## P19-9: Divider out of a root quote at the content's end, the paragraph after the rule (T10.8, check 2 A1) (ruled: T40.2)

- Stored: `<blockquote><ul><li><blockquote><p>Q1w</p></blockquote></li></ul></blockquote>`.
- Place: the caret at the end of `Q1w` (`at("Q1w")`, `text:Q1w@3`).
- Action: the toolbar's Divider.
- The branch writes `<blockquote><ul><li><blockquote><p>Q1w</p></blockquote></li></ul></blockquote><hr /><p></p>` (1 call); typed `k` after it gives `...</blockquote><hr /><p>k</p>`.
- `<base>` writes `<blockquote><ul><li></li></ul></blockquote><hr /><blockquote><ul><li><blockquote><p>Q1w</p></blockquote></li></ul></blockquote>` (1 call, caret `text:Q1w@0`); typed `k` gives `...<hr /><blockquote><ul><li><blockquote><p>kQ1w</p></blockquote></li></ul></blockquote>`. Measured in the `<base>` worktree with the kit copied in.
- T10.8 names the rule at the root after the quote; no rule names the empty paragraph after it. Candidates: (a) the empty paragraph is the caret's new place, as built (check 2 A1 names it for a last paragraph: `<p>Aw</p><hr /><p></p>`); (b) it is a copy that T9.2 A forbids.
- The test keeps only what T10.8 names: the write starts with the quote followed by a root `<hr />`. The write and the typed value are not pinned.
- The task placed this cell at Q1w@end ("both quotes split"); the test titled for it is at Q1w@1 (~689, "out of a root quote: the rule at the root, both quotes split"), and the end case is a separate row.
- **Ruled (T40.2):** candidate (a). The write `...</blockquote><hr /><p></p>` and the typed `...<hr /><p>k</p>` are pinned. The titles name the cells: "out of a root quote mid-text (Q1w@1): ..." and "out of a root quote at the content's end (Q1w@end): ...".
