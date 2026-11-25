# Task 17: P records

Measured at the branch (Task 17's work, f51ae8e) and at `<base>` (SP/r1-base, 2a96a45, rich-text project). Writes are `short()`; "typed" is the value after a letter k typed right after the action. Nothing here is pinned in a test, except P3's cell and the cells P17-2 names as equal to `<base>`. P17-2 and P17-4 were measured again after the narrowing of the two-line paste (Task 17's fix). All four are ruled (T38); each heading carries its ruling.

## P17-1: D14's third case, the range ending in the quote: `<base>` keeps the emptied quote, the field drops it

Ruled (T38.4): candidate (b), the branch's. Cell 2 is pinned as the fixture's write less the emptied quote (calls, caret and typed as the fixture's, typed less the quote too).

- Stored: `LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)`. Place: `range("Pw", 1, "Q1w", 1)` (from the unlined item P into the lined item's quote). Action: paste `<p>Aq</p><p>Bq</p>` (text/plain `Aq\nBq`).
- `<base>` (fixture `base-range-into-lined`, cell `Pw@1 to Q1w@1`): `<ul><li>PAq</li></ul><p>Bq1w</p><ul><li><blockquote></blockquote>T2w</li><li>Nw</li></ul>`, 1 onChange, caret `text:Bq1w@2`, typed `<ul><li>PAq</li></ul><p>Bqk1w</p><ul><li><blockquote></blockquote>T2w</li><li>Nw</li></ul>`.
- Branch (at the carry and after this task, no change by it): `<ul><li>PAq</li></ul><p>Bq1w</p><ul><li>T2w</li><li>Nw</li></ul>`, 1 onChange, caret `text:Bq1w@2`. The emptied quote goes (5.4 "Emptied"). The field's removal, then the paste gives the same write.
- Task 17 Step 1b says each cell equals its fixture cell. Cell 1 (`Pw@1 to T0w@1`) does and is pinned. Cell 2 is not pinned. Candidates: (a) `<base>`'s write with the emptied quote (the head's path, as the step says); (b) the branch's, without it (5.4, and D1: an emptied quote is never the ruled write).

## P17-2: C10 beyond P3's cell

Ruled (T38.1): C10 by its cause, any number of lines, any block, tabs inside lines allowed. The reference is the ordinary twin (the same text pasted at the end of `LI(T0w)` at `<base>`); the lined write is the twin's items, the item's rest after the last one. The two-line narrowing is undone. Measured at `<base>` and at the branch for `L1\nL2`, `L1\nL2\nL3`, `L1\n\nL2`, `L1\n`, `L1\r\nL2`, `L1\tx\nL2\ty`, `L1\n\tL2`, each before a quote, a heading and a code block: every cell is the twin's items with the block appended to the last, the caret the twin's (`L1\n`: `<base>`'s write, caret at the block's start). All pinned; the cells with a tab are compared by write, not as a fixed point (the twin's own write is no fixed point at `<base>`: a leading tab goes, a tab inside a line becomes a space). The text below is the record as it stood before the ruling.

The handler (`$pasteTextIntoItemLine`) first acted after every paragraph break followed by a line of text. It now takes only exactly two lines, text, a new line, text (tabs inside a line allowed, not leading the second line); all other plain text takes `<base>`'s paste. Measured after the narrowing, at the branch and at `<base>` (SP/r1-base, rich-text project). Each cell: plain text pasted at `T0w@end` (`at("T0w")`); writes `short()`, then the caret.

P3's cell, pinned (ruled third): `LI(T0w<blockquote><p>Q1w</p></blockquote>)`, `L1\nL2`.

- `<base>`: `<ul><li>Pw</li><li>T0wL1</li><li><blockquote><p>L2Q1w</p></blockquote></li><li>Nw</li></ul>`, `text:L2Q1w@2`.
- Branch: `<ul><li>Pw</li><li>T0wL1</li><li>L2<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`, `text:L2@2`.

Changed against `<base>`, not pinned (two lines, so inside the narrowed gate; no rule names the write for a heading or a code block):

- Heading-led new item, `LI(T0w<h3>H1w</h3>)`, `L1\nL2`.
  - `<base>`: `<ul><li>Pw</li><li>T0wL1</li><li><h3>L2H1w</h3></li><li>Nw</li></ul>`, `text:L2H1w@2`.
  - Branch: `<ul><li>Pw</li><li>T0wL1</li><li>L2<h3>H1w</h3></li><li>Nw</li></ul>`, `text:L2@2`.
- Code-led new item, `LI(T0w<pre><code>C1w</code></pre>)`, `L1\nL2`.
  - `<base>`: `<ul><li>Pw</li><li>T0wL1</li><li><pre><code>L2C1w</code></pre></li><li>Nw</li></ul>`, `text:L2C1w@2`.
  - Branch: `<ul><li>Pw</li><li>T0wL1</li><li>L2<pre><code>C1w</code></pre></li><li>Nw</li></ul>`, `text:L2@2`.
- Tabs inside both lines, P3's shape, `L1\tx\nL2\ty`.
  - `<base>`: `<ul><li>Pw</li><li>T0wL1\tx</li><li><blockquote><p>L2\tyQ1w</p></blockquote></li><li>Nw</li></ul>`, `text:yQ1w@1`.
  - Branch: `<ul><li>Pw</li><li>T0wL1\tx</li><li>L2\ty<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`, `text:y@1`.
- Candidates for these three: (a) the branch's (C10's rule, the second line before whatever block leads the new item); (b) `<base>`'s (P3's cell is a quote with tab-free lines only).

Equal to `<base>`, pinned as "equals `<base>`" except where marked (P3's shape, `LI(T0w<blockquote><p>Q1w</p></blockquote>)`; both builds write the same):

- `L1\nL2\nL3`: `<ul><li>Pw</li><li>T0wL1</li><li><blockquote><p>L2</p><p>L3Q1w</p></blockquote></li><li>Nw</li></ul>`, `text:L3Q1w@2`.
- `L1\n\nL2`: `<ul><li>Pw</li><li>T0wL1</li><li><blockquote><p></p><p>L2Q1w</p></blockquote></li><li>Nw</li></ul>`, `text:L2Q1w@2`.
- `L1\n\tL2`: `<ul><li>Pw</li><li>T0wL1</li><li><blockquote><p>\tL2Q1w</p></blockquote></li><li>Nw</li></ul>`, `text:L2Q1w@2`. Equal at both builds but not pinned: the write is not a fixed point (stored and read back, the paragraph's leading tab goes: `<p>L2Q1w</p>`), so `expectEdit` refuses it. Candidates: (a) `<base>`'s write as measured; (b) its fixed point, without the leading tab.
- `L1\n`: `<ul><li>Pw</li><li>T0wL1</li><li><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`, `text:Q1w@0`.

Earlier measures, before the narrowing: `L1\nL2\nL3` in `LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)` wrote `<ul><li>Pw</li><li>T0wL1</li><li>L2</li><li>L3<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>` at the branch against `<base>`'s `<ul><li>Pw</li><li>T0wL1</li><li><blockquote><p>L2</p><p>L3Q1w</p></blockquote>T2w</li><li>Nw</li></ul>`; the narrowed gate leaves it to `<base>`'s paste. `L1\nL2` at `T0w@1` was and is `<base>`'s write (`TL1` / `L20w`).

## P17-3: two plain-text lines at a quote line's end (carried, not changed by Task 17)

Ruled (T38.3): candidate (b), the branch's write stands; pinned.

- Stored: `<blockquote>xq<ul><li>l1q</li></ul>yq</blockquote>`. Place: `xq@end`. Action: plain text `L1\nL2`.
- `<base>`: `<blockquote>xqL1</blockquote><ul><li>L2l1q</li></ul><p>yq</p>`, caret `text:L2l1q@2`.
- Branch (the carry's and this task's; `$pasteTextIntoItemLine` acts only in a list item): `<blockquote>xqL1<p>L2</p><ul><li>l1q</li></ul>yq</blockquote>`, caret `text:L2@2`. A `<p>` stands in the lined quote among lines in the stored value.
- No rule names this write. Candidates: (a) as P3 for an item, the second line on a line of its own before the list, in the quote; (b) the branch's.

## P17-4: a two-line plain-text drop is not routed

Ruled (T38.2): candidate (a). The field's `CONTROLLED_TEXT_INSERTION_COMMAND` handler now calls `$pasteTextIntoItemLine` for a drop (untagged as a paste, as Lexical's own drop is); the two-line drop gives P3's write, caret `text:L2@2`; pinned.

- Stored: `LI(T0w<blockquote><p>Q1w</p></blockquote>)` (P3's shape). Place: `T0w@end`. Action: a drop of plain text `L1\nL2` (a `beforeinput` of type `insertFromDrop` whose data holds only `text/plain`).
- `<base>`: `<ul><li>Pw</li><li>T0wL1</li><li><blockquote><p>L2Q1w</p></blockquote></li><li>Nw</li></ul>`, 1 onChange, caret `text:L2Q1w@2`.
- Branch: the same write, 1 onChange, caret `text:L2Q1w@2`. The field's `CONTROLLED_TEXT_INSERTION_COMMAND` handler calls `$insertPlainTextAtBlockLed`, not `$pasteTextIntoItemLine`, so the drop keeps C10's loss (L2 inside the quote) that the paste no longer has. Map 2's C10 counts "paste or drop text/plain".
- Candidates: (a) route the drop like the paste (P3's write, `<ul><li>Pw</li><li>T0wL1</li><li>L2<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`, caret `text:L2@2`); (b) leave it, `<base>`'s write as above.
