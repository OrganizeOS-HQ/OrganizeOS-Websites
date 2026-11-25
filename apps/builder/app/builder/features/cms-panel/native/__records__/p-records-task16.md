# Task 16: P records

Measured at the branch (Task 16's work on 1c41131) and at `<base>` (SP/r1-base, 2a96a45, rich-text project). Writes are `short()`; "typed" is the value after a letter k typed right after the action. Nothing here is pinned in a test except where a line says so.

## P16-1: FS0 at the root (M14k): one onChange that repeats the value

- Stored: `<p>xq</p><hr><p>yq</p>`. Place: `nodeAfter("xq")` (the rule node-selected). Action: paste `<hr>`.
- `<base>` (M14k): write `<p>xq</p><hr /><p>yq</p>`, 1 onChange, the value as it stood.
- Branch: the same, 1 onChange whose value equals the value before. `expectEdit` refuses it (D19), and 16.10 makes the count 0 in R1 once the change handler compares values (Task 20, T26.2).
- Pinned: the value after the paste, no console error, the 2,000 ms bound. Not pinned: the onChange count and the undo step. Candidates: (a) 0 onChanges, the rule replaced in the history (one undo step, no onChange); (b) 0 onChanges and no undo step.

## P16-2: a composition's onChange count, with or without a root change

- Stored: `<p>Pw</p><p>T0w</p>`. Place: `Pw@2`, a letter, quiet, `T0w@1`. Action: `ime("a")`.
- Branch, with and without `setRootElement(null)` then the same element first: 3 onChanges, `PwkT0w`, `PwkTa0w`, `PwkTa0w` (the last repeats the one before). The task's plain test expects one onChange for the composition.
- The count during a composition is Task 20's (T29: P11-1's count, 16.10, 16.21). Pinned: the last value `<p>Pwk</p><p>Ta0w</p>`, one undo gives the state before the composition (`sameState`), a second undo `<p>Pw</p><p>T0w</p>`, and the listener counts. Candidates: (a) one onChange once Task 20's compare lands; (b) two (the start and the end).

## P16-3: an empty-paragraph paste over a rule after a leading block: where the letter lands

- Stored: the 14 block-led cells of `base-paste-node` whose rule is the item's last child or stands before a block (`QR`, `QQR`, `QRL`, `QRR`, `QRd2`, `QRol`, `RQR`, by click, arrow and both rules): e.g. `LI(<blockquote><p>Q0w</p></blockquote><hr>)`.
- Place: the rule node-selected (a click, arrows, or both rules by code). Action: paste `<p></p>` (text/plain empty), then k.
- Branch: the rule goes (one onChange, the write equals the paste at D18's caret with the rule removed: `W(<li><blockquote><p>Q0w</p></blockquote></li>)`), and the letter lands at the quote's end: `...<p>Q0wk</p>...`.
- The oracle (the same paste at the point after the rule, the rule kept, then the rule taken out of the result) leaves the caret in the line after the rule, so its letter lands after the quote: `...</blockquote>k...`. `<base>`: the head runs away in these cells (fixture `failed: runaway`).
- No rule names the caret when the paste inserts nothing and the rule goes. Pinned: the write and the count; the letter is not compared for empty-paragraph cells. Candidates: (a) the branch's (5.8: after a node selection is removed, the caret is at the end of the content before it); (b) the line after the quote, where the paste's caret stood.

## P16-4: the test of "the paste at D18's caret" keeps the rule, then takes it out

- The task's row runs the oracle "as `then(at("T2w", 0), paste)` on the same shape with the rule removed first". Measured on the branch over the 213 cells: removing the rule first changes D18's caret wherever nothing but the item's end, a nested list or another block follows the rule (`QR`: the caret goes into the quote's text, `<blockquote><p>Q0wAq</p></blockquote>`), while the paste over the rule lands in a line after the quote (`<blockquote><p>Q0w</p></blockquote>Aq`, the prototype's 14.8 literal for the same cell).
- Built: the oracle pastes at the point directly after the last selected rule on the same shape (`beside("horizontalrule", "after")`, resolved by D18 with the rule present) and takes the selected rules out of its write. With it, all 155 block-led HTML and own-node cells give the oracle's write; in `QRT` and the other cells where text follows the rule, both readings agree.
- Candidates: (a) as built; (b) the task's reading (the rule removed first), under which 90 of the 155 cells differ (in the write or the letter after it).

## P16-5: the listener counts on the field's root

- The task's plain test expects "exactly one active `beforeinput`, one `compositionstart` and one `compositionend` listener of the line code on the root". The field's root also holds the point rules' capture listeners (`rich-text-line-points.ts`: `beforeinput` and `compositionstart`, among others), so the line code has two `beforeinput` and two `compositionstart` capture listeners on the root.
- Built: on the field, the capture listeners of the three types are the same set after a root change as after the mount (before the fix: one more `beforeinput` and one more `compositionstart`, the old handlers never removed). On an editor holding only `registerLineInputListener` and `registerCompositionStep`, exactly one of each after registering and after a root change, and none after the cleanup.
- "Typing with a rule selected after a root change inserts once" passed before the fix as well: the first of the doubled `beforeinput` handlers stops the event (`stopImmediatePropagation`), so the second never runs. The failing tests before the fix were the two listener-count tests.

## P16-6: `base-paste-node` at `<base>`: 126 runaways, 8 cells the arrows cannot reach (information)

- Recorded at `<base>` (213 cells, `rich-text-line-cells-paste-node.ts`) under a tripwire: past 2,000 ms the next node written in the paste's update throws (a wrapper on the node prototype's public `getWritable`, in the recording file only), and the cell is `failed: runaway`. A thrown update leaves Lexical's module state behind, so the recorder starts a fresh page after each runaway; a cell that froze with no node written (the 11 own-node cells by click) was cut off by the driver's timeout and is recorded the same way.
- 126 cells run away at `<base>` (check 3 counts 55 of 240): every block-led cell with an HTML or own-node paste that the head reaches (`emptyP`, `list`, `p1`, `p2`, `heading`: 23 each; own: 11). Check 3's 55 were the cells measured at 22 to 25 s; under a 2,000 ms bound every block paste after a leading block counts. The `bold` cells finish.
- `QRQ` by arrow (8 cells): at `<base>` ArrowLeft from `Q2w@0` never node-selects the rule (`failed: rules selected: expected +0 to be 1`). On the branch the arrows select it; those cells are compared with the paste at D18's caret, not with the fixture.
- Plain-text cells (48 block-led, 4 in XRY): `<base>` writes nothing in the 50 it reaches (the rule stays selected; the two `QRQ` arrow cells above are not reached); the branch replaces the rule (C15), equal to the plain paste at the point after the rule with the rule taken out. Named in the grid as C15.
- The XRY HTML cells (6) equal the fixture, the two empty-paragraph cells where the head splits the list included (the task text says four).

## P16-7: the cut of a node-selected image after a quote, by code (T28: measured before pinning)

- Stored: `LI(<blockquote><p>Q0w</p></blockquote>IMG)`. Place: `nodeSelect("cms-image")`. Action: the kit's `cut`.
- `<base>`: write `W(<li><blockquote><p>Q0w</p></blockquote></li>)`, 1 onChange, caret `element:quote@1`; clipboard equal to the copy of the same node selection (`text/html` the image, editor data the `cms-image` node, `text/plain` empty).
- Branch: the same write and clipboard; caret `text:Q0w@3` (T28, 5.8). Pinned: write, caret, and the clipboard equal to the copy's.
- The caret form (click, Escape: a caret after the image): `<base>` writes nothing and puts an empty `text/plain` and `text/html` on the event's clipboard (T18.3's D1 entry); the branch writes nothing and leaves the clipboard as it was (pinned with a real Ctrl+X over a clipboard sentinel, T15.7).

## P16-8: 5.8's caret after a removed node selection, where it acts (narrowed)

- Built in `$caretBeforeRemovedNodes` (normalise, the container transform): only when the state before held a node selection whose nodes are all gone, the update is not a paste, the node directly before the first removed node (in the state before, a line's previous sibling where the node led its line) is a block in the same lined container, and Lexical left the caret as an element point at that block's end (its `selectPrevious`). The caret then goes to the end of that block's content. Every other caret stays as Lexical or the join rule left it.
- Cells it changes against the build before: Backspace, Delete and cut of a node-selected rule or image directly after a quote in a lined item (`element:quote@1` before, `text:Q0w@3` now). At `<base>` the head's caret there is `element:listitem@1` (M21a) or `element:quote@1` (P16-7); T28 and 5.8 rule `text:Q0w@3`. Pinned: Backspace (rule and image) and cut (image). Delete by code is pinned by Task 14 for the write only.
