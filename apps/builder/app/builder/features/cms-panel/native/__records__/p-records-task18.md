# Task 18: P records

Measured at the branch (Task 18's work, on 218ec9d) and at `<base>` (SP/r1-base, 2a96a45, rich-text project, the kit and `rich-text-line-writer-cases.ts` copied in for the run and removed after). Clipboards are raw unless marked `bare` (classes, directions, styles, values and spans left out). Nothing here is pinned in a test, except as each record says.

## P18-1: a range from a paragraph's text to the root point before a root-level rule copies inline at the branch, as a paragraph at `<base>`

- Stored: `<p>A0w</p><hr><p>B2w</p>`. Place: by structure after a real click, `A0w@1` to `element:root@1` (the point before the rule), both directions (`rootRule | beforeRule -> prevP A0w@1` and `prevP A0w@1 -> beforeRule` of the writer's oracle ranges). Action: copy.
- `<base>` (fixture `base-1511-copy`): text/html bare `<p>0w</p>`, editor data `paragraph('0w')`, text/plain `0w\n`.
- Branch: text/html bare `0w` (no paragraph), text/plain `0w` (the editor data was not read for this record). The content equals the oracle's (and `<base>`'s); only the paragraph wrapper differs. Cause: the writer's ends take 15.10's move (`$prepareRemoval(selection, "clipboard")`, `$lastPointToBlockEnd`), which moves a last point on the root directly after any block, a top-level paragraph included, to that block's text end; the range is then inside one text node and Lexical copies it inline.
- The cut of the same range writes the same clipboard as the copy and removes `0w` (the oracle). A paste of the copy lands inline at the branch and as a paragraph at `<base>`.
- Pinned: the content only (the test "the ten ranges beside a root-level rule" compares what each copy holds with what the fixture cell holds). Candidates: (a) the branch's inline copy (15.10's move for every block before the point); (b) `<base>`'s paragraph (15.10's move only after a nested block, a quote or a list, as check 4's line 84 words it).

## P18-2: 16.7 in a lined item: a range that ends between two quotes still carries the second quote's shell

- Stored: `LI(T0w<blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote>T3w)` (`twoBlocks-TQQT`). Place: by structure, `T0w@1` to the item's point between the two quotes (`after("quote", 0)`), and the same end with `Q1w@1`, `Pw@1`; both directions. Action: copy.
- `<base>`: the end stays `element:listitem@2`; text/html bare `0w<blockquote><p>Q1w</p></blockquote><blockquote><p>Q2w</p></blockquote>` (the head's walk takes the whole second quote in: an over-copy).
- Branch: the field's point step resolves the end (an element point on a lined container) to `text:Q2w@0` before any copy; the writer then has a text end at the second quote's start and copies the quote's empty shell: text/html bare `0w<blockquote><p>Q1w</p></blockquote><blockquote><p></p></blockquote>`, editor data with an empty paragraph in a quote. The copy holds exactly the oracle's text, images and rules, and the cut's clipboard is the copy's.
- Check 5, 16.7 rules that a copy ending between two quotes of a lined item carries no shell of the second quote; check 4, 15.11 rules that a text end at a block's offset 0 is a range inside the block and keeps the head's copy with the block's empty shell (D6). With the point step, the first case reaches the writer as the second. Not pinned. Candidates: (a) the branch's shell (the range as the field holds it is inside the second quote); (b) no shell (16.7), which needs the writer to read an end the point step put at a block's start as the container point before the block.
- Also: check 5's eight 16.7 records and 16.6's 17 records are not listed one by one in the check or its probe directory; Task 18 tests 16.6 over all 273 oracle ranges (an element-point end adds no empty span) and 16.7 on the root (K14) and in an unlined quote, not on the eight records.

## Not a P record, for the batch: the grid snapshots

`$plainTextOf` now reads the nodes in Lexical's order (as at the head and at `cdcd53dc5`), filtered to the nodes the range holds, so the head's text/plain for M59 (`Q0w\n\n\nNw`) is kept (Task 18 Step 1 failed on it at the carry: `Q0w\n\nNw`, not a `\n{3,}` collapse). 130 copy and cut cells of the 15.10 grids that were named "text/plain is read from the structure (D6)" now equal the head's and leave the named-differences snapshots (list 32, quote 32, other 16, mirror 50).
