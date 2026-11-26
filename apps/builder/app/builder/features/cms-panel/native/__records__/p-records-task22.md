# P records, Task 22 (the grids)

Branch: `task22-grids` off d2bdaa4 (the split committed as d4c02ed). Head: `<base>` 2a96a45. The grids'
values: `__snapshots__/rich-text-line-grid-{points,meeting,node,unreached}.json` (branch, written with
`-u`, not kept: cells fail) and `<scratchpad>/r1-grids.head/` (head). The difference list:
`<scratchpad>/r1-grid-differences.md`.

## P22-1: the D19 check compares the values as written, not the short forms

Task text: "when `write` is a string, `write` differs from the record's `htmlBefore`". `write` and
`htmlBefore` are `short()` forms, which write every link as `<a>` and every image as `<img />`, so a Link
that changes an address (AQ el1, `example.org/a` to `example.org/`) reads as an unchanged value. Built:
the kit's `EditRecord` gains `valueBefore` (the value after `place`, as the field wrote it) and `written`
(the last value handed out, or `valueBefore` when none), and the grid cell asserts
`written !== valueBefore` when it handed one out. Three false failures go (AQ el1, QA el1
and AR Lw@1, Link); the 20 of P22-3 stay.

## P22-2: one module the Files list does not name

`rich-text-line-cells-grids.ts` holds the shapes, places and commands of the four grids and the cell test
they share (the click test imports the 34 points from it). It imports only the kit, so it runs at `<base>`.

## P22-3: 20 cells hand out the value unchanged (D7, 16.10; T42.1: a lined no-op as a first action makes no onChange)

Each is one onChange whose value equals the value after `place`. Place, action, branch, head:

| Cell                                                                                    | Head                                                                                 |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| node: `rule in TRT by code` / `for real` Ctrl+Backspace, Ctrl+Delete (4)                | no onChange, value unchanged                                                         |
| node: `rule in TR by code` / `for real` Ctrl+Backspace, Ctrl+Delete (4)                 | no onChange                                                                          |
| node: `image in QI by code` Ctrl+Backspace, Ctrl+Delete (2)                             | no onChange                                                                          |
| node: `image in TQI by code` Ctrl+Backspace, Ctrl+Delete (2)                            | no onChange                                                                          |
| unreached: `HQ in item el1` Paragraph                                                   | no onChange                                                                          |
| node: `image in QI for real` Link, `image in TQI for real` Link (caret after the image) | the same unchanged onChange (head flagged)                                           |
| meeting: `QB el1` Link                                                                  | the same unchanged onChange (head flagged)                                           |
| unreached: `d7 TR el2` lineForward                                                      | the same unchanged onChange (head flagged)                                           |
| meeting: `BQ el1` Link                                                                  | `<li><br /><blockquote><p><a>Q1w</a></p></blockquote></li>` (links the quote's text) |
| unreached: `d7 TR el2` Quote                                                            | lifts the depth-7 item into `<blockquote>T0w<hr /></blockquote>` after the list      |
| unreached: `IR el1` Link                                                                | `<li><img /><a><hr /></a></li>` (a rule in a link, D10)                              |

Under D7 none may stand ("no onChange with an unchanged value, also where the head makes one"). The task
says a failing cell is fixed in its mechanism task before the snapshot is kept. Not fixed here: which
task owns each (the deletes for the word forms on a node selection; the toolbar for Link with no text in
the selection, Paragraph on a heading's quote point and Quote at depth 7), and the writes of the last
three (BQ el1 Link, d7 Quote, IR el1 Link differ from the head's and no row names the build's no-op), go
to the coordinating session.

## P22-4: the head hangs at TQT el2

At `<base>`, `TQT el2` (`LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)`, `itemPoint(1, 2)`) by
Backspace, Ctrl+Backspace and lineBack does not finish (each cell alone in its own run, 120 s watchdog).
Run in one file, a hang also froze the next cells (Bulleted list, Numbered list) that finish alone. The
head's meeting grid was therefore recorded one point per file, TQT el2 one cell per file from Bulleted
list on; the three cells hold `failed: hang` in the head's snapshot. The branch's three cells finish
(write `[T0w<blockquote><p>Q1w</p></blockquote>T2w]` changes as 5.3's deletes give).

## P22-5: 13 of 34 clicks land elsewhere (section 10)

`rich-text-line-clicks.test.tsx` at M55's places (editable 478 by 144 in the kit's harness):

| Point   | M55 place | Caret after the click | The grid's `placed` |
| ------- | --------- | --------------------- | ------------------- |
| TR@2    | 471, 49   | none                  | element:listitem@2  |
| RT@1    | 471, 33   | none                  | text:T1w@0          |
| QR@2    | 471, 49   | none                  | element:listitem@2  |
| RQ@1    | 471, 33   | none                  | text:Q1w@0          |
| TRT@2   | 471, 49   | none                  | text:T2w@0          |
| QRQ@2   | 471, 49   | none                  | text:Q2w@0          |
| RR@1    | 471, 33   | none                  | element:listitem@1  |
| RR@2    | 471, 42   | none                  | element:listitem@2  |
| QT@1    | 62, 32    | text:Q0w@3            | text:T1w@0          |
| TQT el2 | 59, 48    | text:Q1w@3            | text:T2w@0          |
| QA el1  | 62, 32    | text:Q0w@3            | text:Lw@0           |
| QB el1  | 62, 32    | text:Q0w@3            | element:listitem@1  |
| BQ el1  | 25, 32    | element:listitem@0    | element:listitem@1  |

The other 21 pass (caret, no onChange from the click, the letter's write, no console error). The eight
`none` places are 7 px inside the editable's right edge, where M55 took the head's caret rect for points
the head draws at the line's far end; the five others are the head's caret drawn at the end of the block
before the point.

## P22-6: unexplained differences (Step 4)

147 of the unreached grid's 188 differences are in mixed-container shapes whose head cell has no flag,
also after the full `recordEdit` at the head (undo, redo, fixed point); and 4 meeting cells: `QT@1` and
`TQT el2` by Ctrl+Delete and lineForward (the line removed whole; the branch's caret stays in the emptied
line and the letter lands after the quote, outside it; the head's caret goes to the quote's end and the
letter into it; T33.1 rules this for the backward forms only). Each with both values is in
`r1-grid-differences.md`.
