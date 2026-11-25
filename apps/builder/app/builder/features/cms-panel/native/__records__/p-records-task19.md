# Task 19: P records

Builds: `<base>` = `2a96a45`, `<proto>` = `451f20f04`, branch = Task 19's worktree on `c333cf3`. Writes in `short()` notation. `LI(x)` = `<ul><li>Pw</li><li>x</li><li>Nw</li></ul>`.

## P19-1: the Link popover's focus after a real Apply (T18.8)

The cell where the kit's `link()` driver lost the focus (Task 5, M46): stored `LI(<blockquote><p>Q0w</p></blockquote><br><hr>)`, placed by `then(at("Pw"), clickItemCorner(1))` (caret `element:listitem@3`), Link opened by its button, the address typed, then a real Apply.

| Build | Apply by | Write | Focus after | Letter after |
|---|---|---|---|---|
| `<base>` | Enter | `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><a><hr /></a></li><li>Nw</li></ul>` c1 | `BODY` | writes nothing |
| `<base>` | click on Apply | the same | `BODY` | writes nothing |
| branch | Enter | none (P14) | the editable | reaches the editor |
| branch | click on Apply | none (P14) | the editable | reaches the editor |

Controls, same at both builds: a range in `<p>Aw Bw</p>`, and `range("T0w", 1, "Nw", 1)` in `LI(T0w<hr>)`: the editable has the focus after Enter and after Apply.

Reading: a person loses the focus at `<base>` too (the head wraps the rule in a link). R1 does not: P14's ruled no-write keeps the focus in the editable. Pinned by "Link: the focus after a real Apply (T18.8)" in `rich-text-line-toolbar.test.tsx`, both ways. The driver is not changed.

## P19-2: base-link-element-end's cell count (T14.10)

The generator (`item1Cells("link", ["linkBtn"])` of check 5's keys probe, rewritten as `rich-text-line-cells-link-element-end.ts`) gives 90 cells: 30 lined, 60 ordinary. Run with the toolbar's Link (Enter):

- `<proto>` throws (`TypeError: Cannot read properties of undefined (reading 'getParent')`) in 10 lined cells: `BLend|next`, `BLend|other`, `BLtrail|other`, `LLend|next`, `LLend|other`, each fwd and bwd. Check 5 counts 8: the two `BLtrail|other` cells throw at `<base>` too, so they are not cells "where the head writes the link".
- `<base>` throws in 12 ordinary cells: `ULend|next`, `ULend|other`, `RPend|next`, `RHend|next`, `RQend|next`, each fwd and bwd (and in the 2 lined `BLtrail|other` cells).
- The branch before the fix threw in the same 20 cells as `<proto>`.

The fixture holds the 22 cells (10 lined, 12 ordinary): the count other than 8 is this record. With the fix, the branch throws in none of the 90, and only those 20 cells' writes change (the other 70 are equal to the branch before the fix).

## P19-3: V11's caret and typed value (T14.4)

`LI(<br><hr><hr>)`, a real click (`clickAt`) at the first rule's centre (`node:horizontalrule`), Backspace, then `k`. Equal at `<base>`, `<proto>` and the branch:

- write `<ul><li>Pw</li><li><br /><hr /></li><li>Nw</li></ul>` c1 (pinned: derived, D15, measured at all three);
- caret `element:listitem@1`;
- typed `<ul><li>Pw</li><li><br />k<hr /></li><li>Nw</li></ul>`.

The caret and the typed value are not pinned.

## P19-4: T13.1's gap click cannot be made

`LI(<pre><code>C0w</code></pre><hr>)`, a real `userEvent.click` on the middle item between the code block's bottom (y 78) and the rule's top (y 86), at 5 %, 25 %, 50 % and 75 % of the gap: the caret is `element:listitem@2` (after the rule) at `<base>`, `<proto>` and the branch; at 95 % the rule is node-selected. Never the code's end. Image from there writes `<ul><li>Pw</li><li><pre><code>C0w</code></pre><hr /><img /></li><li>Nw</li></ul>` at `<base>` and the branch (the item's end, not the code path). The row is pinned with the caret placed by a real click at the end of `C0w` (`caretKey()` is `text:C0w@3`, asserted), which gives T13.1's write `W(<li><pre><code>C0w</code></pre><img /><hr /></li>)`.

## P19-5: Step 1d's grep and the narrowing

- `git grep` at `<base>` over `native/*.test.tsx`: no test on fork `main` pins the end-of-document write for a code-block caret (the Image cells of `rich-text-block-led-edits.test.tsx` place the caret in a line after the code block; `rich-text-fuzz.test.tsx` checks invariants, not writes). Nothing for Task 24 Step 3 to change; no failure to list in `r1-net-failures.txt`.
- Built for a collapsed caret only. A range with an end in a code block keeps the end-of-document write (unruled; T13.1 names a caret). Candidates: (a) as built; (b) after the code block of the range's focus.

## P19-6: the Link command's end placement, narrowed

The Link command (16.11) runs the removal step's end placement (`$lastPointToBlockEnd`, then `$endsIntoText`), exported as `$rangeEndsIntoText`, not `$prepareRemoval(selection, "removal")` whole: `$prepareRemoval` also removes the line break of T23.1/T30.2 (a range ending at the start of a break-led line after a block), a removal no Link ruling names. The placement acts only when an end is an element point. Measured over the 90 generator cells: the writes of the 70 cells that did not throw are unchanged.

## P19-7: the block-type menu covers the field's first lines (15.14)

The prototype's cell presses at `Aw@1`, which the open menu covers. At `<base>` and `<proto>`: ordinary shape, the press lands in the menu, which stays open; lined shape, the press lands on the menu (an `svg` inside it; the menu closes, nothing written, the focus on the Block type button, the letter writes nothing). The branch's lined result differs: a close by a press on the menu is not a press in the editor, so (T10) the editor takes the focus and the letter writes `<ul><li>Aw<a>Lw</a><hr />Ckw</li></ul>` (at the caret held before the menu opened). Candidates: (a) the branch's (T10: any close not from a press in the editor hands the keys back); (b) `<base>`'s (the focus on the button).

The test presses a word the menu does not cover (a long last line; the test asserts the point is outside the menu): the menu closes, the focus stays on its button, the letter writes nothing, as pinned at the head.

## P19-8: Step 1e (T11.10)

With Shift decided on `click` instead of `pointerdown` (scratch, reverted), these fail: the 15.7 "repeated" and "selectionchange-first" cells at `Aw` and `Cw` (ordinary and lined, rule and image: 16 tests), and 16.16's bottom-padding test (ordinary and lined). They pass: the eight 15.7 cells at `Lw` (retitled "control: ..."), and 16.16's right-padding test (30 runs), whose point gives the same caret with and without Shift at `<base>` too (the rule stays node-selected).
