# Task 18: P records

Measured at the branch (Task 18's work, on 218ec9d) and at `<base>` (SP/r1-base, 2a96a45, rich-text project, the kit and `rich-text-line-writer-cases.ts` copied in for the run and removed after). Clipboards are raw unless marked `bare` (classes, directions, styles, values and spans left out). Nothing here is pinned in a test, except as each record says.

## P18-1: a range from a paragraph's text to the root point before a root-level rule copies inline at the branch, as a paragraph at `<base>`

- Stored: `<p>A0w</p><hr><p>B2w</p>`. Place: by structure after a real click, `A0w@1` to `element:root@1` (the point before the rule), both directions (`rootRule | beforeRule -> prevP A0w@1` and `prevP A0w@1 -> beforeRule` of the writer's oracle ranges). Action: copy.
- `<base>` (fixture `base-1511-copy`): text/html bare `<p>0w</p>`, editor data `paragraph('0w')`, text/plain `0w\n`.
- Branch: text/html bare `0w` (no paragraph), text/plain `0w` (the editor data was not read for this record). The content equals the oracle's (and `<base>`'s); only the paragraph wrapper differs. Cause: the writer's ends take 15.10's move (`$prepareRemoval(selection, "clipboard")`, `$lastPointToBlockEnd`), which moves a last point on the root directly after any block, a top-level paragraph included, to that block's text end; the range is then inside one text node and Lexical copies it inline.
- The cut of the same range writes the same clipboard as the copy and removes `0w` (the oracle). A paste of the copy lands inline at the branch and as a paragraph at `<base>`.
- Pinned: the content only (the test "the ten ranges beside a root-level rule" compares what each copy holds with what the fixture cell holds). Candidates: (a) the branch's inline copy (15.10's move for every block before the point); (b) `<base>`'s paragraph (15.10's move only after a nested block, a quote or a list, as check 4's line 84 words it).
- Reachable by real input: a real drag from `A0w` onto the rule ends at `element:root@1` (the test "a real drag from A0w onto the rule" asserts that end), so this is what a person gets, not only a range placed by structure.
- Check 4's text reads toward (b): its lines 82 and 84 name the class as "the caret at the end of a nested block (a quote, a list) that a root-level rule follows", say "a paragraph or a heading before the rule never takes a root point", and rule the move for a last point "directly after a nested block". The cause on the branch is the carried `$lastPointToBlockEnd`, which treats any block before the point as nested, a top-level paragraph included.

## P18-2: 16.7 in a lined item: a range that ends between two quotes still carries the second quote's shell

- Stored: `LI(T0w<blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote>T3w)` (`twoBlocks-TQQT`). Place: by structure, `T0w@1` to the item's point between the two quotes (`after("quote", 0)`), and the same end with `Q1w@1`, `Pw@1`; both directions. Action: copy.
- `<base>`: the end stays `element:listitem@2`; text/html bare `0w<blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote>` (the head's walk takes the whole second quote in: an over-copy).
- Branch: the field's point step resolves the end (an element point on a lined container) to `text:Q2w@0` before any copy; the writer then has a text end at the second quote's start and copies the quote's empty shell: text/html bare `0w<blockquote><p>Q1w</p></blockquote><blockquote><p></p></blockquote>`, editor data with an empty paragraph in a quote. The copy holds exactly the oracle's text, images and rules, and the cut's clipboard is the copy's.
- Check 5, 16.7 rules that a copy ending between two quotes of a lined item carries no shell of the second quote; check 4, 15.11 rules that a text end at a block's offset 0 is a range inside the block and keeps the head's copy with the block's empty shell (D6). With the point step, the first case reaches the writer as the second. Not pinned. Candidates: (a) the branch's shell (the range as the field holds it is inside the second quote); (b) no shell (16.7), which needs the writer to read an end the point step put at a block's start as the container point before the block.
- Also: check 5's eight 16.7 records and 16.6's 17 records are not listed one by one in the check or its probe directory. Task 18 tests 16.6 over all 273 oracle ranges (no empty element the range does not enter, in text/html and the editor data, by type against the oracle's structure) and 16.7 on the root (K14), in an unlined quote, and in a lined item at the cells that give the ruled result (the eight tests "16.7 in a lined item: ..."); the cells that do not are this record and P18-3.
- Every cell (review fix; measured at the branch on 9ca6600 and at `<base>` 2a96a45 the same day, by structure after a real click, copy). Stored `LI(T0w<blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote>T3w)`; the end is the item's point between the two quotes; each cell in both directions, with the same three formats either way. Branch: the selection after placing is `text:Q2w@0` (the point step); `<base>`: it stays `element:listitem@2`.

  | Start                    | Branch text/html (bare); editor data                                                                                                                                                   | `<base>` text/html (bare); editor data                                                                                                    | text/plain (both) |
  | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
  | `T0w@1`                  | `0w<blockquote><p>Q1w</p></blockquote><blockquote><p></p></blockquote>`; `'0w',quote(paragraph('Q1w')),quote(paragraph())`                                                             | `0w<blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote>`; `'0w',quote(paragraph('Q1w')),quote(paragraph('Q2w'))`        | `0w\nQ1w\n`       |
  | `Q1w@1`                  | `<blockquote><p>1w</p></blockquote><blockquote><p></p></blockquote>`; `quote(paragraph('1w')),quote(paragraph())`                                                                      | `<blockquote><p>1w</p></blockquote><blockquote><p>Q2w</p></blockquote>`; `quote(paragraph('1w')),quote(paragraph('Q2w'))`                 | `1w\n`            |
  | `Pw@1` (the item before) | `<ul><li>w</li><li>T0w<blockquote><p>Q1w</p></blockquote><blockquote><p></p></blockquote></li></ul>`; `list(listitem('w'),listitem('T0w',quote(paragraph('Q1w')),quote(paragraph())))` | `<ul><li>w</li><li>T0w<blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote></li></ul>`; the same with `paragraph('Q2w')` | `w\nT0w\nQ1w\n`   |

  The ruled result (16.7) is the branch's without the last `<blockquote><p></p></blockquote>` and its `quote(paragraph())`; neither build gives it. The oracle's text is `0wQ1w`, `1w`, `wT0wQ1w`.

## P18-3: 16.7 before an item: a range that ends at a list's point before an item carries the item's empty shell

- Stored: (lined) `LI(T0w<blockquote><p>Q1w</p></blockquote>)`, the end the list's point before the `Nw` item; (unlined, the "list-before-item" case the first build dropped) `<ul><li>Aw</li><li>Bw</li></ul><p>Zw</p>`, the end the list's point before the `Bw` item. Place: by structure after a real click, each start below, both directions (same results either way). Action: copy. Measured at the branch on 9ca6600 and at `<base>` 2a96a45.
- At both builds the end reads `text:Nw@0` (`text:Bw@0`) right after placing: Lexical's own normalisation resolves the list's element point into the next item's first text, so this is not the field's point step. Both builds write the same clipboard:

  | Stored  | Start   | text/html (bare), both                                                        | editor data, both                                                        | text/plain      |
  | ------- | ------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------- |
  | lined   | `T0w@1` | `<ul><li>0w<blockquote><p>Q1w</p></blockquote></li><li></li></ul>`            | `list(listitem('0w',quote(paragraph('Q1w'))),listitem())`                | `0w\nQ1w\n`     |
  | lined   | `Q1w@1` | `<ul><li><blockquote><p>1w</p></blockquote></li><li></li></ul>`               | `list(listitem(quote(paragraph('1w'))),listitem())`                      | `1w\n`          |
  | lined   | `Pw@1`  | `<ul><li>w</li><li>T0w<blockquote><p>Q1w</p></blockquote></li><li></li></ul>` | `list(listitem('w'),listitem('T0w',quote(paragraph('Q1w'))),listitem())` | `w\nT0w\nQ1w\n` |
  | unlined | `Aw@1`  | `<ul><li>w</li><li></li></ul>`                                                | `list(listitem('w'),listitem())`                                         | `w\n`           |

- Not pinned. Candidates: (a) both builds' clipboard with the empty `<li></li>` (the range as Lexical holds it is a text end at the next item's start, which check 4, 15.11 keeps with the block's shell: D6); (b) no shell of the item (16.7 and K14: the range's end, as placed, is a point between blocks and the range does not enter the item), which needs the writer to read the end before Lexical's normalisation or to treat a text end at an item's start, reached from a list point, as that point.

## P18-4: not used

The grid's 16.6 check now compares the empty elements of the raw text/html and of the editor data, by type, with the elements the committed range enters that hold none of its content (an element holding one of its ends, or lying inside it). All 273 ranges pass, so no range is recorded here. The check judges the range as committed: the cells of P18-2 and P18-3 pass it because their end is then a text end at the next block's start (D6); 16.7's reading of those cells is P18-2's and P18-3's.

## P18-5: a Shift+click on an image leaves no selection; a copy and a cut then write nothing and remove nothing

- Cells (grid `rich-text-line-grid-clipboard.test.tsx`, named in its `NO_RANGE`): `real03 imgLineEnd-QTIQ` (`LI(<blockquote><p>Q0w</p></blockquote>T1w<img><blockquote><p>Q2w</p></blockquote>)`, click `T1w@1`, Shift+click the image's right edge), `real04 imgLineEnd-QTIQ` (the same shape, click `Q2w@1`), `real11 imgLineStart-TQIT` (`LI(T0w<blockquote><p>Q1w</p></blockquote><img>T2w)`, click `T0w@1`, Shift+click the image's left edge). Action: copy; and, after a remount and the same input, cut.
- At the branch (9ca6600) and at `<base>` (2a96a45) alike: the image's popover opens, focus moves to its input, and Lexical holds no selection (T12.1; T27.1: no real input node-selects an image, so D15's node-selection rules do not apply). The copy and the cut write no `text/html`, no editor data and no `text/plain` (the field's handler returns `false` with no selection), fire no onChange, and change nothing.
- Pinned: the state reached (no selection, the popover open), ruled by T12.1. Not pinned: the copy's and the cut's result (nothing written, nothing removed), which no ruling names for a cut while an image's popover holds focus. Candidates: (a) as both builds: nothing; (b) a cut or copy of the image the popover is open on.

## Built without a P record

- `$dragStart`: where `$headFormClipboard` returns `null` (the writer failed) over a range, nothing is set on the drag, so the browser's own `text/html` (with the line wrappers) stays on it. Kept as built; the drag now logs the copy path's development assertion ("the head-form copy could not be written") behind `import.meta.env.DEV`. No ruling names a drag whose writer fails.

## Provenance: the fixture `base-1511-copy`

`__fixtures__/rich-text-line-base-1511-copy.json` was measured at `<base>` 2a96a45 in Task 18 (rich-text project, the kit and `rich-text-line-writer-cases.ts` copied in for the run and removed after), because Task 5 had not made it.

## For Task 23

The `lineSpike` switches `scratchClipboardFails`, `cutCheckFails` and `cutTakesCheckFails` (`rich-text-line-node.ts`) are unused since Task 18 (the forced failures go through the kit's `forcedFailure`). Left for Task 23 to delete with the rest of `lineSpike` (D17).

## Not a P record, for the batch: the grid snapshots

`$plainTextOf` now reads the nodes in Lexical's order (as at the head and at `cdcd53dc5`), filtered to the nodes the range holds, so the head's text/plain for M59 (`Q0w\n\n\nNw`) is kept (Task 18 Step 1 failed on it at the carry: `Q0w\n\nNw`, not a `\n{3,}` collapse). 130 copy and cut cells of the 15.10 grids that were named "text/plain is read from the structure (D6)" now equal the head's and leave the named-differences snapshots (list 32, quote 32, other 16, mirror 50).
