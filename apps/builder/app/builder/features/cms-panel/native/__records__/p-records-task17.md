# Task 17: P records

Measured at the branch (Task 17's work, f51ae8e) and at `<base>` (SP/r1-base, 2a96a45, rich-text project). Writes are `short()`; "typed" is the value after a letter k typed right after the action. Nothing here is pinned in a test.

## P17-1: D14's third case, the range ending in the quote: `<base>` keeps the emptied quote, the field drops it

- Stored: `LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)`. Place: `range("Pw", 1, "Q1w", 1)` (from the unlined item P into the lined item's quote). Action: paste `<p>Aq</p><p>Bq</p>` (text/plain `Aq\nBq`).
- `<base>` (fixture `base-range-into-lined`, cell `Pw@1 to Q1w@1`): `<ul><li>PAq</li></ul><p>Bq1w</p><ul><li><blockquote></blockquote>T2w</li><li>Nw</li></ul>`, 1 onChange, caret `text:Bq1w@2`, typed `<ul><li>PAq</li></ul><p>Bqk1w</p><ul><li><blockquote></blockquote>T2w</li><li>Nw</li></ul>`.
- Branch (at the carry and after this task, no change by it): `<ul><li>PAq</li></ul><p>Bq1w</p><ul><li>T2w</li><li>Nw</li></ul>`, 1 onChange, caret `text:Bq1w@2`. The emptied quote goes (5.4 "Emptied"). The field's removal, then the paste gives the same write.
- Task 17 Step 1b says each cell equals its fixture cell. Cell 1 (`Pw@1 to T0w@1`) does and is pinned. Cell 2 is not pinned. Candidates: (a) `<base>`'s write with the emptied quote (the head's path, as the step says); (b) the branch's, without it (5.4, and D1: an emptied quote is never the ruled write).

## P17-2: C10 beyond P3's cell: three lines, and tabs

P3 (ruled third) is built: plain text `L1\nL2` at `T0w@end` in `LI(T0w<blockquote><p>Q1w</p></blockquote>)` gives `<ul><li>Pw</li><li>T0wL1</li><li>L2<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`, caret `text:L2@2`, pinned. The handler (`$pasteTextIntoItemLine`) applies the same step after every paragraph break that leaves the caret at the start of the block leading the new item, when a line of text follows. Two inputs outside P3's cell write otherwise than `<base>`:

- Stored `LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)`, `T0w@end`, plain text `L1\nL2\nL3`.
  - `<base>`: `<ul><li>Pw</li><li>T0wL1</li><li><blockquote><p>L2</p><p>L3Q1w</p></blockquote>T2w</li><li>Nw</li></ul>`, caret `text:L3Q1w@2`.
  - Branch: `<ul><li>Pw</li><li>T0wL1</li><li>L2</li><li>L3<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>`, caret `text:L3@2`.
- Stored `LI(T0w<blockquote><p>Q1w</p></blockquote>)`, `T0w@end`, plain text `L1\tx\nL2\ty`.
  - `<base>`: `<ul><li>Pw</li><li>T0wL1\tx</li><li><blockquote><p>L2\tyQ1w</p></blockquote></li><li>Nw</li></ul>`, caret `text:yQ1w@1`.
  - Branch: `<ul><li>Pw</li><li>T0wL1\tx</li><li>L2\ty<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`, caret `text:y@1`.
- Unchanged against `<base>` (the handler does not act): `L1\nL2` at `T0w@1` (`TL1` / `L20w`), `L1\n` (the caret stays in the quote, `text:Q1w@0`), `L1\n\nL2` (`<blockquote><p></p><p>L2Q1w</p></blockquote>`).
- Candidates: (a) the branch's (map 2 C10's rule, every pasted line before the block); (b) narrow the handler to P3's cell (two lines, no tab), the rest as at `<base>`.

## P17-3: two plain-text lines at a quote line's end (carried, not changed by Task 17)

- Stored: `<blockquote>xq<ul><li>l1q</li></ul>yq</blockquote>`. Place: `xq@end`. Action: plain text `L1\nL2`.
- `<base>`: `<blockquote>xqL1</blockquote><ul><li>L2l1q</li></ul><p>yq</p>`, caret `text:L2l1q@2`.
- Branch (the carry's and this task's; `$pasteTextIntoItemLine` acts only in a list item): `<blockquote>xqL1<p>L2</p><ul><li>l1q</li></ul>yq</blockquote>`, caret `text:L2@2`. A `<p>` stands in the lined quote among lines in the stored value.
- No rule names this write. Candidates: (a) as P3 for an item, the second line on a line of its own before the list, in the quote; (b) the branch's.
