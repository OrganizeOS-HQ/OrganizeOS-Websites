# Task 26: T59's 22 measurements (items 1 to 21 at 0d3d0f4 and the base; 22 deferred to the second comparison)

Measured 2026-11-26. Builds: branch = fork `0d3d0f4` (detached in the agent worktree, `pnpm install --frozen-lockfile`); base = `<base>` `2a96a45` (SP/r1-base, `timeout 600` on every run, left clean). Nothing committed; no tracked file changed; every scratch probe was copied in, run and removed.

Harness. `SP/t59m/src/engine.tsx` is the acceptance run's gap-fill engine (`acceptance/sets/gap-fill/src/zzh2-fill-engine.tsx`) with the clipboard engine's `nodeSel`, keys-phase-2's `domsel` and `elAfterBr`, and four steps of mine: `spyUpdates` (wraps `editor.update` and records the stack of each call, to see whether `setBlockType` ran), `blockLabel`, `afterText` (an element point directly after a named text node, check 5's "after" place) and `clipNote`. Runner `SP/t59m/run.py` (one scenario batch at one build, in `native/zzm59/`, project `core-browser-builder-cms`); batches `SP/t59m/batches/m1..m5.json` (built by `mk1..mk5.py`), outputs `SP/t59m/out/{base,branch}-mN.json`, logs `SP/t59m/logs/`. Record ids `O:<set>::<batch>::<id>` are the acceptance records re-run unchanged; `M<n>:` ids are this task's scenarios. Check-5 probes were re-run with `SP/t59m/prun.sh` (outputs `SP/t59m/pout/{base,branch}/<tag>/`), from `SP/t59m/probes/` where a probe was narrowed or given a control. Viewers: `wr.py` (writes), `show2.py` (steps and carets), `cmpacc.py` (today's values against the acceptance data).

Every re-run acceptance record (95 ruleClick, the Dv, X, k, n2, g6, R7, R4b, C3, C11 records) gives at the branch the R1 write the acceptance data holds for `0ae275f`; none moved with the fixes since. The base's writes moved only where its click leaves no selection (QBR, QTR, CR d2, below), which varies run to run.

Load (4 cores; two other agents ran browser tests): 1-minute load 3.7 to 24.5 over the runs; one base run (m3) lost its browser connection at load 24 and one died early, both re-run whole; two branch runs of the inline-code cells timed out on a `clickWord` beside `<code>` (Playwright's click command, at both builds' harness), re-run with the caret set by code.

## Table

| #   | Branch (`0d3d0f4`)                                                                                                                              | Base (`2a96a45`)                                                                                                                                                                          | Outcome                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | the click on the rule leaves a caret: before a leading rule `cms-line[0]@element:0`; at an item-ending rule `text:Nw@0`; never a node selection | `listitem@element:0` before a leading rule; `Nw@0` for TR, QR, CR, HR, BR; **no selection** (letter at the document start) for QBR, QTR, CR d2. Divider at `Nw@0` set by code = R's write | R stands (D13); Task 19's pin and T12.1 disagree with the build                                   |
| 2   | item-end caret (empty line) + Divider: rule before the whole item, caret `Q0w@0`                                                                | item-end caret by code (`listitem@end`) + Divider: the same write and caret                                                                                                               | R stands (D13: the head does not split after the item)                                            |
| 3   | writes below                                                                                                                                    | writes below                                                                                                                                                                              | needs a ruling (T59.5)                                                                            |
| 4   | QTB/RTB `T1wNw`; others Nw joins the row                                                                                                        | twins: `<li><br></li>` + BS at Nw@0 -> Nw in place of the row; `<li>T1w<br></li>` -> `T1wNw`; root twins the same                                                                         | R stands                                                                                          |
| 5   | li: `<blockquote><p><br /></p></blockquote>`; Image `<p><img /><br /></p>`                                                                      | ordinary twin: the break enters the quote's paragraph (letter `<p>k<br /></p>`; Image `<p><img /><br /></p>`)                                                                             | R stands (D3 second case)                                                                         |
| 6   | Backspace over the one-press range removes the `<br>` (`<li><blockquote><p>Q0w</p></blockquote></li>`); Delete too                              | Backspace writes nothing; Delete removes the break                                                                                                                                        | needs a ruling (D3/D5 join against D6's cut rule)                                                 |
| 7   | rightQ: `Q0w@0`; hr0@start: `Nw@0`                                                                                                              | rightQ on QBR/QTR: no selection; ordinary twins and TQR at both builds: the click lands at the quote text's end (`Q0w@3`, `Q1w@3`); hr0@start: `Nw@0` everywhere                          | rightQ: defect; hr0: R stands                                                                     |
| 8   | Quote choice does not reach `setBlockType` (0 of 2 updates); Heading 2 does (1)                                                                 | the same                                                                                                                                                                                  | R stands (D1: the head's empty write)                                                             |
| 9   | QL/HL Im `<li>P<img />w<ul><li>L1w</li></ul></li>`; TQL BS `<li>Pw<ul><li>L2w</li></ul></li>`                                                   | twins with text in place of the block give exactly those writes                                                                                                                           | R stands (5.7 QL row)                                                                             |
| 10  | R7 p1/p2/drop: caret `yq@0` in the heading (`<h3>Zyq</h3>`)                                                                                     | twin `<p>xq</p><h3>hq</h3><p>yyq</p>`: caret `yq@0` in the heading (`<h3>kyq</h3>`)                                                                                                       | R stands (CS5)                                                                                    |
| 11  | at a caret, and removal then paste: `<blockquote>pAq</blockquote><p>Bq1q</p>`; R4b over the range: `<blockquote>pAq<p>Bq1q</p></blockquote>`    | caret, removal then paste, and over the range: all `<blockquote>pAq</blockquote><p>Bq1q</p>`                                                                                              | defect (D14)                                                                                      |
| 12  | lined walk: line@0, node image, line@1                                                                                                          | ordinary twin walk: `paragraph@0`, node image, `paragraph@1`; Link with an image node-selected loses focus and the letter at both builds                                                  | R stands; T27.1 needs correcting                                                                  |
| 13  | letter after the rule node-selected: `<li><hr />k<ul>`                                                                                          | letter lands at the document start (`kPw`, `kAw`), by code and by arrows                                                                                                                  | needs a ruling                                                                                    |
| 14  | CB/RB `...<br /></li><li></li>`; QpTB `<br /><p></p>` in the quote                                                                              | twins: `<ul><li>Pw<br /></li><li></li></ul>`; quote twin `<p>X2w<br /></p><p></p>` in the quote; the same at the branch                                                                   | R stands (K17)                                                                                    |
| 15  | paste-backs as recorded; two undos to the stored value, two redos replay                                                                        | the cut clipboard pasted at the cut's caret gives R's paste-back exactly (C3 and C11); twins also take two undos                                                                          | R stands (D14)                                                                                    |
| 16  | when the drag gives the Backspace run's range, Enter writes `<blockquote><p>A0w</p><p>2w</p></blockquote>`                                      | the same drag sometimes ends at a caret `B2w@3` at either build (then Enter writes nothing)                                                                                               | R stands (no defect; the record's no-op was the drag's caret)                                     |
| 17  | stops and focus after each Shift+ArrowRight                                                                                                     | identical stops, focus kept every press                                                                                                                                                   | R stands (15.12)                                                                                  |
| 18  | `<p>AB2w</p>` (and H, L, TWO, EMPTYP)                                                                                                           | twin: `<p>AB2w</p>`; Q leaves an empty quote                                                                                                                                              | R stands                                                                                          |
| 19  | letter at the element point after inline code: `<code>Zwk</code>` (lined and ordinary)                                                          | ordinary twin: `<p>X0w<code>Zwk</code></p>` (takes the format); the base's lined cell `<code>Zw</code>k`                                                                                  | R stands (the letter takes the code format, as the ordinary twin)                                 |
| 20  | comp-n: placed = second rule; comp-x M-: `Aaab1w`; control `Aabk1w`; PI-QIT: placed = node image                                                | comp-n: placed = first rule; comp-x M-: `A​aba1w`; control `A​abk1w`; PI-QIT: node image                                                                                                  | comp-n: R stands (D15); PI-QIT: R stands (D18 step 1); comp-x M-prepend/M-replace: needs a ruling |
| 21  | not measured (native IME)                                                                                                                       | not measured                                                                                                                                                                              | not measured                                                                                      |
| 22  | deferred to the second comparison at the final head (T59.6)                                                                                     |                                                                                                                                                                                           | deferred                                                                                          |

Counts (1 to 21; an item split by sub-record is counted by its strictest outcome): R stands 14 (1, 2, 4, 5, 8, 9, 10, 12, 14, 15, 16, 17, 18, 19); defect 2 (7 for rightQ, 11); needs a ruling 4 (3, 6, 13, 20 for M-prepend/M-replace); not measured 1 (21). Item 7's hr0@start records and item 20's comp-n and PI-QIT records stand.

## Per item

### 1. ruleClick (95 records; the 26 leading-rule Block type records; QBR, QTR, CR d2 Dv)

- Setup: each distinct stored value of the 95 differing ruleClick records (23 shapes), `clickEl hr 0 mid` (a real click at the rule's centre), then `domsel`, then a letter. Plus all 95 records re-run.
- Branch: leading rule (R, RB, RC, RH, RL, RQ, RR, RT, RQT): `listitem[1]/cms-line[0]@element:0`, DOM `<div line>@0`, a caret before the rule; letter `<li>k<hr />...` . Item-ending rule (TR, QR, CR, HR, BR, QBR, QTR, CR d2, Qpr): `text:Nw@0`. TRQ `Q2w@0`, TRT `T2w@0`. No node selection anywhere.
- Base: the same carets (`listitem@element:0`, `Nw@0`), except QBR, QTR and CR d2, where the click leaves the selection null and the letter lands at the document start (`kPw`, `kAw`).
- Divider at `Nw@0` placed by code (`range Nw 0`), at both builds: QBR `[P]<li>…<hr /></li><li></li></ul><hr /><ul>[N]`, QTR the same, CR d2 `…<li></li></ul></li></ul><hr /><ul><li><ul><li>Nw</li></ul></li>…`: base = branch, and equal to R's ruleClick Dv writes.
- Outcome: a caret, not a node selection: by the Decides line D13 gives the 26 writes and the Divider write is the head's own at Nw@0. R stands. Task 19's pin and T12.1 ("a click on a rule node-selects it") disagree with the build: the real click at the rule's centre makes a caret at both builds.

### 2. liEnd Dv on QBR, QTR, CR d2

- Setup: `caretEl` (the item, at its child count) = the item end after the rule; then Divider. CR d2 uses item index 3 (Lexical's nested-list wrapper counts).
- Branch: caret `cms-line[3]@element:0` (QBR, QTR), `cms-line[2]@element:0` (CR d2). Write `[P]</ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote><br /><hr /></li>[N]`, caret `Q0w@0`, letter `kQ0w`; CR d2 `<ul><li>Aw[P]</ul></li></ul><hr /><ul><li><ul><li><pre><code>C0w</code></pre><hr /></li>[N]</li><li>Zw</li></ul>`, caret `C0w@0`.
- Base: caret `listitem@element:3` (`@2` for CR d2), the identical writes and carets.
- Outcome: the head does not split after the item; it puts the rule before the whole item, as R does. R stands (D13).

### 3. Divider in a list inside a quote of a lined item (needs a ruling, T59.5)

Both builds' writes, re-run today (`[P]` = `<ul><li>Pw</li>`, `[N]` = `<li>Nw</li></ul>`):

| Record        | Base                                                                                                                                           | Branch                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Qlist X1w@0   | `[P]<li><blockquote><ul><li></li></ul></blockquote></li></ul><hr /><ul><li><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote></li>[N]` | `[P]</ul><hr /><ul><li><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote></li>[N]`                                            |
| Qlist X1w@end | `[P]<li><blockquote><ul></ul></blockquote></li></ul><hr /><ul><li><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote></li>[N]`          | `[P]<li><blockquote><ul><li>X1w</li></ul></blockquote></li></ul><hr /><ul><li><blockquote><ul><li>X2w</li></ul></blockquote></li>[N]` |
| Qlist X2w@0   | `[P]<li><blockquote><ul><li>X1w</li><li></li></ul></blockquote></li></ul><hr /><ul><li><blockquote><ul><li>X2w</li></ul></blockquote></li>[N]` | `[P]<li><blockquote><ul><li>X1w</li></ul></blockquote></li></ul><hr /><ul><li><blockquote><ul><li>X2w</li></ul></blockquote></li>[N]` |
| Qlist X2w@end | `[P]<li><blockquote><ul><li>X1w</li></ul></blockquote></li></ul><hr /><ul><li><blockquote><ul><li>X2w</li></ul></blockquote></li>[N]`          | `[P]<li><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote></li></ul><hr /><ul>[N]`                                            |
| Qlist liEnd   | as X2w@end                                                                                                                                     | as X2w@end                                                                                                                            |
| QL+T X1w@0    | `[P]<li><blockquote><ul><li></li></ul></blockquote></li></ul><hr /><ul><li><blockquote><ul><li>X1w</li></ul></blockquote>X3w</li>[N]`          | `[P]</ul><hr /><ul><li><blockquote><ul><li>X1w</li></ul></blockquote>X3w</li>[N]`                                                     |
| QL+T X1w@end  | `[P]<li><blockquote><ul></ul></blockquote></li></ul><hr /><ul><li><blockquote><ul><li>X1w</li></ul></blockquote>X3w</li>[N]`                   | `[P]<li><blockquote><ul><li>X1w</li></ul></blockquote></li></ul><hr /><ul><li>X3w</li>[N]`                                            |

Letters after undo and redo: base X1w@0 `kX1w`, X1w@end `kX1w` (in the moved list), X2w `kX2w`; branch X1w@end `kX2w` (Qlist) / `kX3w` (QL+T), X2w@end and liEnd `kNw`.

- The sentences the branch's writes are read by: T10.8, "Divider (the toolbar task): the split up to the root at every caret in a block of a lined item, the block's edges and a paragraph's edge inside a quote alike, at any depth and out of a root quote" (the list inside the quote counted as such a block; at X1w@end the branch splits after X1w's item, at X2w@end after the item, as 5.7's row does for a quote's end).
- The sentence the base's writes are read by: spec 5.7, row "Divider with the caret in a nested item, and Divider over a range": "The head's write until R2 (T2). A nested list is not a block for the row above."
- Candidates: (a) not nested: T10.8, R stands; (b) nested: R must give the base's write.

### 4. Nw@start Backspace after a final empty line (k0/k2/k3)

- Setup: twins mounted at both builds, `clickWord Nw 0`, Backspace, undo, redo, letter.
- `<ul><li>Pw</li><li><br></li><li>Nw</li></ul>`: `[P][N]` with Nw in place of the row (both builds); root `<p>Pw</p><p><br></p><p>Nw</p>`: `<p>Pw</p><p>Nw</p>` (both).
- `<ul><li>Pw</li><li>T1w<br></li><li>Nw</li></ul>`: `[P]<li>T1wNw</li></ul>`; root `<p>Pw</p><p>T1wNw</p>` (both builds).
- Branch re-run of the 12 records: `…<pre><code>C0w</code></pre>Nw</li>`, `…<h3>H0w</h3>Nw`, QB, RB, QBB (`<br />Nw`), QQB, QRB, RBB, RQB, RRB, QTB `…</blockquote>T1wNw`, RTB `<hr />T1wNw`; the base keeps the empty row's place (`…</li>[N]`).
- Outcome: the twin puts Nw in place of the empty row, and `T1w<br>` + Nw gives `T1wNw`: QTB's and RTB's `T1wNw` equal the twin with the block kept. R stands.

### 5. QTB whole Im and R:whole BS

- Setup: ordinary twin `<blockquote><p>Q0w</p></blockquote><p>T1w<br></p>`, range Q0w@0 to T1w@3 by code and by click and Shift+click; Backspace; and Image.
- Both builds: Backspace hands out `""` (the document is the quote with a paragraph that holds only the leftover break; the letter gives `<blockquote><p>k<br /></p></blockquote>`); Image `<blockquote><p><img /><br /></p></blockquote>`.
- Branch on the lined record: `<li><blockquote><p><br /></p></blockquote></li>`, Image `<li><blockquote><p><img /><br /></p></blockquote></li>`; base `<li><blockquote></blockquote><br /></li>`.
- Outcome: the leftover break enters the quote's paragraph at the head's twin: D3 second case. R stands.

### 6. c1 S3 Q0wend+SR (needs a ruling)

- Stored `<ul><li><blockquote><p>Q0w</p></blockquote><br></li></ul>`; click at Q0w's end, Shift+ArrowRight (branch: `Q0w@3 -> cms-line[1]@element:0`; base: `Q0w@3 -> listitem@element:1`).
- Branch: Backspace writes `<ul><li><blockquote><p>Q0w</p></blockquote></li></ul>` (one onChange; undo restores); Delete the same. The cut (re-run) writes the same, clipboard text/plain `"\n"`, text/html the quote shell only.
- Base: Backspace writes nothing (0 calls, the letter `Q0wk`); Delete writes `<ul><li><blockquote><p>Q0w</p></blockquote></li></ul>`; the cut writes nothing and its clipboard is empty.
- Outcome: Backspace removes the `<br>` too, so D3/D5's join and D6's "a cut removes exactly what its clipboard holds" conflict. Candidates: (a) the join gives way: the cut keeps the `<br>` (writes nothing beyond what its clipboard holds); (b) D6 gives way for this shape: the cut removes the break as Backspace does, and the clipboard need not hold it.

### 7. n2 rightQ, k2 hr0@start (rightQ: defect; hr0: R stands)

- Setup: `clickEl blockquote 0 end` (real click at the quote's box, 2 px in from its bottom right) and `clickEl hr 0 start` (1,1 of the rule), then a letter; on QBR, QTR, TQR (`[P]<li>T0w<blockquote><p>Q1w</p></blockquote><hr></li>[N]`) and the ordinary twins `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p><br></p><hr><p>Nw</p>`, `…<p>T1w</p><hr>…`, `<p>Pw</p><p>T0w</p><blockquote><p>Q1w</p></blockquote><hr><p>Nw</p>`.
- rightQ: branch QBR/QTR `text:Q0w@0` (letter `kQ0w`); base QBR/QTR null selection (letter `kPw`). The ordinary twins at both builds: `Q0w@3` (`Q0wk`); TQR at both builds: `Q1w@3` (`Q1wk`).
- hr0@start: branch QBR/QTR `Nw@0`; base null; twins and TQR `Nw@0` at both builds.
- T45.13's click test at the branch (`rich-text-line-clicks.test.tsx`, project grids-c): 54 of 54 pass; TR@1 and QR@1 (the left edge of the rule that ends the item, M55's places 50,32 and 62,32) give `text:T0w@3` / `text:Q0w@3` and the letters `T0wk<hr />`, `Q0wk</p></blockquote><hr />`.
- Outcome: hr0's `Nw@0` is where the same click lands in ordinary content: R stands. rightQ's `Q0w@0` is not: the same click lands at the quote text's end in the ordinary twins and in TQR. Defect: the rule (D1, a caret where ordinary content leaves it; T45.13's click test, the caret a click reaches) requires `text:Q0w@3`, so the four n2 records write the edit at Q0w's end (k: `Q0wk`; BS: `Q0`; DEL nothing in Q0w; Enter a split at Q0w's end), not at its start.

### 8. QTQ Q0w->T1w Qt

- Setup: Q0w@0 click, Shift+click T1w end (and a caret Q0w@1; and the ordinary `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`), the Block type trigger reads "Quote", `editor.update` wrapped around the menu choice.
- Both builds: choosing Quote makes no `setBlockType` call (updates during the step: branch 2, base 1, all from focus; none from `setBlockType`), no onChange. Control Heading 2: one `setBlockType` call (stack `setBlockType < onChange < onValueChange < handleSelect`) and the heading write.
- Outcome: the choice does not fire for the value the select already shows; the empty write is the head's. R stands.

### 9. QL / HL / TQL nested (5.7 QL row)

- Twins `[P]<li>Q0w<ul><li>L1w</li></ul></li>[N]`, `…H0w…`, `[P]<li>T0w<br>Q1w<ul><li>L2w</li></ul></li>[N]`; Pw@1 click, Shift+click the last word @2; Image and Backspace.
- Both builds: Image `<ul><li>P<img />w<ul><li>L1w</li></ul></li>[N]` (L2w for TQL), Backspace `<ul><li>Pw<ul><li>L1w</li></ul></li>[N]`.
- Branch on the records: A1 and A2 `<ul><li>P<img />w<ul><li>L1w</li></ul></li>[N]`, k3 TQL `<ul><li>Pw<ul><li>L2w</li></ul></li>[N]`; base `…</li><li><ul><li>L1w</li></ul></li>…` (the list left under an item with no text).
- Outcome: the head's ordinary twin moves the nested list with the joined text, which is 5.7's QL row ("as an ordinary item with a nested list gives"), not 5.4's "stay in their item". R stands. G1's NESTED records were not listed by id in the check; the three named records and their twins are what was measured.

### 10. R7 TQT heading->text p1, p2, p2 drop

- Twin `<p>xq</p><h3>hq</h3><p>yyq</p>`, range hq@0 to yyq@1, paste `<p>Aq</p>` (`<p>Aq</p><p>Bq</p>`, and the drop), letter.
- Both builds: `<p>xq</p><p>Aq</p><h3>yq</h3>` (`…<p>Bq</p><h3>yq</h3>`), caret `yq@0` in the heading, letter `<h3>kyq</h3>`.
- Branch R7: `<li>xq<br />Aq<h3>yq</h3></li>`, caret `heading/yq@0`, letter `<h3>Zyq</h3>`. Base R7 `<li>Aqyq</li>` (loses xq and the heading).
- Outcome: the caret lands where the twin's CS5 paste leaves it. R stands.

### 11. R4b text-led quote->its list / pt2 (defect)

- Stored `<blockquote>pq<ul><li>l1q</li></ul></blockquote><p>sepq</p>`; range pq@1 to l1q@1.
- Backspace over the range at both builds: `<blockquote>p1q</blockquote><p>sepq</p>`, caret `p1q@1`; then the "Aq\nBq" paste: `<blockquote>pAq</blockquote><p>Bq1q</p><p>sepq</p>` at both builds. A caret at p1q@1 in a stored `<blockquote>p1q</blockquote>` (and in `<blockquote><p>p1q</p></blockquote>`): the same write at both builds.
- The paste over the range: base `<blockquote>pAq</blockquote><p>Bq1q</p><p>sepq</p>`; branch `<blockquote>pAq<p>Bq1q</p></blockquote><p>sepq</p>`.
- Outcome: defect. D14 ("A range that starts in a lined container is first removed … and the paste then runs at the caret that removal leaves, as at a caret") requires `<blockquote>pAq</blockquote><p>Bq1q</p><p>sepq</p>`, the write of the same paste at the caret the branch's own removal leaves.

### 12. g6 I4li-q-img arrow (R stands; T27.1 needs correcting)

- Twin `<blockquote><p>Q0w</p></blockquote><p><img width=40 height=20></p>`, click at Q0w's end, ArrowRight x3: both builds `paragraph[1]@element:0`, `nodes:…/cms-image[0]`, `paragraph[1]@element:1`; a letter at the node stop `<p><img />k</p>` at both.
- Branch lined `[P]<li><blockquote>…</blockquote><img></li>[N]`: `cms-line[1]@element:0`, node image, `cms-line[1]@element:1`. Base lined: `listitem@element:2`, `Nw@0`, `Nw@1` (no node stop).
- I1root-q (ordinary, image node-selected by arrows): Link: no write, focus leaves the editor, the letter changes nothing, at both builds. Image: `…<p>Nw</p><p><img /></p>` and the letter `k` in the quote, equal at both.
- Outcome: the head node-selects an inline image by ArrowRight in ordinary content, so R's walk stands and T27.1 ("an image is not node-selected by any real input") needs correcting. Link's lost focus and lost letter is the head's own under a node selection: not a defect.

### 13. RL ruleNode H2, ul-d2 RL ruleNode OL (needs a ruling)

- `[P]<li><hr><ul><li>L1w</li></ul></li>[N]` and its d2 form; the rule node-selected by code (`nodeSel`) and by ArrowRight from Pw; a letter.
- Branch: `[P]<li><hr />k<ul><li>L1w</li></ul></li>[N]` (d2 the same in the inner item). Base: `<ul><li>kPw</li>…` / `<ul><li>kAw…` (the letter at the document start), by code and by arrows.
- Outcome: the head's letter is at neither candidate. Candidates for D15's "directly after": (a) a new line before the nested list (R's write); (b) the nested list's start (`<li>kL1w</li>`).

### 14. n2 CB, RB, top-QpTB afterBr0 ins "\n\n" (R stands, K17)

- Twin `<ul><li>Pw<br></li></ul>` (and with `<li>Nw</li>` after), caret after the break by code, `beforeinput insertText "\n\n"`: both builds `<ul><li>Pw<br /></li><li></li></ul>`, caret in the new item, letter `<li>k</li>`; `"\n"` gives `Pw<br /><br />` at both.
- Quote twin `<p>Pw</p><blockquote><p>X2w<br></p></blockquote><p>Nw</p>`: both builds `<blockquote><p>X2w<br /></p><p></p></blockquote>`; root twin `<p>X2w<br /></p><p></p>`.
- Branch records: CB `…<pre><code>C0w</code></pre><br /></li><li></li>…`, RB `…<hr /><br /></li><li></li>…`, QpTB `<blockquote><p>X1w</p>X2w<br /><p></p></blockquote>`; base: RangeError "Map maximum size exceeded", no write.
- Outcome: R's split equals the twin's (a new item / a new paragraph after the break). R stands.

### 15. p4 C11 and C3 paste-back (R stands)

- Ordinary twins (Ctrl+X over the range, Ctrl+V, undo x3, redo x2; values after each): C11 twin `<blockquote><p>bq</p></blockquote><p>t1q</p><p>n1q</p>`: cut `<p>t1q</p>`, paste-back restores; ordinary list twin `<ul><li>bq</li><li>t1q</li><li>n1q</li></ul>`: paste-back `<li>t</li><li>1q</li><li>n1q</li>`; C3 twin `<p>xq</p><blockquote><p>qq</p></blockquote><p>yq</p>`: cut base `<p>xq</p><blockquote></blockquote><p>yq</p>`, branch `<p>xq</p><p>yq</p>`; paste-back base `…<blockquote><p>q</p></blockquote><p>q</p><blockquote></blockquote><p>yq</p>`, branch the same without the empty quote. Every twin: two undos to the stored value (the third changes nothing), two redos replay, at both builds.
- Lined records at the branch: C11 cut `<li><blockquote><p>bq</p></blockquote>t1q</li></ul>`, paste-back `…t</li><li>1q</li><li>n1q</li>`; C3 cut `<li>xq<br />yq</li>`, paste-back `<ul><li>xq</li></ul><blockquote><p>qq<br />yq</p></blockquote>`; two undos to stored, two redos.
- R's own cut clipboard (html and text/plain) pasted at the cut's caret in the cut state, at both builds: C3 `<ul><li>xq</li></ul><blockquote><p>qq<br />yq</p></blockquote>`, C11 `…t</li><li>1q</li><li>n1q</li>`: equal to R's paste-backs.
- Outcome: the paste-back is the head's write of that clipboard at that caret (D14), with the head's undo count. R stands.

### 16. 4b-real|Q#76 Enter (R stands)

- clip-x probe, "4b root-rule ranges by real input" narrowed to the four drags and Backspace, Delete, Enter, letter on P and Q, run at both builds with the selection and the DOM selection recorded after the drag.
- "drag B2w@1 above rule" on Q: at the branch the drag gave `B2w@1 -> A0w@3` (backward, the Backspace run's range) for Backspace, Delete, Enter and the letter; Enter wrote `<blockquote><p>A0w</p><p>2w</p></blockquote>`. At the base the same drag gave that range for Backspace and the letter and a caret `B2w@3` for Delete and Enter (no write). Other drags left a caret `B2w@3` at the branch (Q onto rule, Backspace) and at the base (P above rule, Delete and letter).
- Outcome: the drag's end varies at both builds; with the Backspace run's range R's Enter writes. The acceptance record's no-op was a drag that left a caret. R stands.

### 17. i2r Shift walks, hist-z2 O-rule-keys (R stands, 15.12)

- `<p>Pw</p><hr><p>Nw</p>`, `<blockquote><p>Pw</p></blockquote><hr><p>Nw</p>` and `…<hr><blockquote><p>Nw</p></blockquote>`; click at Pw's end, Shift+ArrowRight x4, selection and `document.activeElement` after each.
- Both builds, identical at every press, focus in the editor each time: P `Pw@2 -> Nw@0, @1, @2, @2`; Q `Pw@2 -> root@element:1, Nw@0, @1, @2`; QQ `Pw@2 -> root@element:1, quote@element:0, Nw@1, @2`.
- Outcome: the page's stops are equal, so the probe records fall under 15.12, as the check's own reading states. The i2r probe files themselves were not re-run.

### 18. clip-x 4b join form, clip-d rec-26, rec-27 (R stands)

- Range A0w@1 to B2w@0 by code, Backspace, on P, Q, L, H, TWO, EMPTYP.
- Both builds: `<p>AB2w</p>`, `<ul><li>AB2w</li></ul>`, `<h2>AB2w</h2>`, TWO and EMPTYP `<p>AB2w</p>`; Q base `<blockquote><p>AB2w</p></blockquote><blockquote></blockquote>`, branch without the empty quote. Letter `AkB2w`.
- Outcome: the base writes `<p>AB2w</p>`. R's join at a root point after a rule stands.

### 19. keys-i3fa fwd|BL|line|*|code|lineF (R stands)

- Check 5's place: the element point directly after the text node Zw inside `<code>` (`afterText`), with and without `deleteSoftLineForward` first.
- Ordinary twins `<p>X0w<code>Zw</code></p>` (also with `<p>Nx</p>` or `<h3>H1w</h3>` after): both builds `<p>X0w<code>Zwk</code></p>`: the letter takes the code format. A text caret at Zw's end set by code gives `<code>Zw</code>k` at both.
- Lined cells (quote, heading, code block after the line): branch `X0w<code>Zwk</code>`; base `X0w<code>Zw</code>k`. Rule after: base lineF writes `X0w<code>Zw</code> ` (the rule replaced by a space), branch `X0w<code>Zw</code>` (the rule removed).
- Outcome: at the head's ordinary twin the letter takes the code format, as R's does. R stands.

### 20. comp-x M-prepend, M-replace; comp-n R-between-fromLine; hist-p PI-QIT

- comp-n (probe re-run, `N-R-between-fromLine-*`): 'placed' differs. Base: path `T0w@1, @2, @3, node:hr` (the click at T0w@3 landed at T0w@0), the first rule. Branch: path `node:hr, cms-line@0, node:hr`, the second rule. With each rule node-selected by code at both builds (`LI("T0w<hr><hr>T3w")`): BS, ArrowRight and ArrowLeft then q are equal; the letter and Enter then q differ only as D15 lists (branch after the rule, `<hr />k<hr />` / `<hr />kT3w`; base at the document start, `kPw`). R stands (D15).
- hist-p PI-QIT (probe re-run): placed is `node:cms-image` at both builds. p1 and plain: base `…<blockquote><p>Q0w</p><p>Aq</p></blockquote><img />T2w`, branch `…</blockquote>Aq<img />T2w`; p2: base the two paragraphs in the quote, branch `…Aq</li></ul><p>Bq<img />T2w</p><ul>[N]`. A caret by code before the image (`listitem@1`): base pastes at Q0w's end (`Q0wAq`), branch in the line. The letter with the image node-selected: base `Q0wk`, branch `</blockquote>k<img />`. R departs, by D18 step 1's accepted difference (a line that begins with an image directly after a block: commands act in the line, where the head acts at the block's end). R stands.
- comp-x (probe re-run with an added control `M-control`, the same backward range B1w@1 -> A0w@1, ime "a", ime "ab", commit, no change between): placed equal at both builds. Control: base `<p>A​abk1w</p>` (9 calls), branch `<p>Aabk1w</p>` (7 calls): equal but the start character. M-prepend: base `<p>PA​aba1w</p>` then `PA​abka1w`; branch `<p>PAaab1w</p>` then `PAaabk1w`. M-replace: base `A​aba1w` / `A​abka1w`; branch `Aaab1w` / `Aaabk1w`. Both builds keep a stale "a" after the code-made change; the head puts the new composition before it, R after it. Needs a ruling: (a) D1: ordinary content must equal the head's write less the listed start character, so R's `Aaab1w` should be `Aaba1w` (a defect); (b) a change made by code in the middle of a composition is not real input; the control equals the head modulo U+200B, and the interrupted case is recorded, not ruled a difference.

### 21. g4 compose 'a\nb' (not measured)

- Not measured: no native input method can be driven in this container's headless Chromium. The only drivers are CDP's `Input.imeSetComposition`/`Input.insertText` (the cells' "cdp") and synthetic composition events.
- What was measured, for the ruling: the cells' CDP driver at both builds. `REFP <p>T0w</p>` at T0w@1: `'a\nb'` -> `<p>a</p>` (T0w lost at both builds; undo restores at the branch, not at the base); `'ab'` -> `<p>Tab0w</p>` at both (no loss). TQT T2w@1 the same pattern. Synthetic events write nothing at either build. The loss needs a new line inside the composed text.

### 22. All record sets and probes

Deferred to the second comparison at the final head (T59.6).

## Defects

1. Item 7, n2 QBR/QTR rightQ BS/DEL/k/Enter: the real click at the quote's bottom right leaves `text:Q0w@0`; the same click lands at the quote text's end in the ordinary twins and in TQR at both builds. Required: the caret at `Q0w@3` and the edits there (D1: the caret where ordinary content leaves it; T45.13).
2. Item 11, clipboard p2 R4b pt2: the paste over the range writes `<blockquote>pAq<p>Bq1q</p></blockquote>`; the branch's own removal then the same paste writes `<blockquote>pAq</blockquote><p>Bq1q</p>`. Required by D14: the latter (also the base's).

## Notes for the coordinating session

- Item 1: a real click at a rule's centre makes a caret at both builds, never a node selection; Task 19's pin and T12.1 disagree with the build.
- Item 12: the head node-selects an inline image by ArrowRight in ordinary content; T27.1's "not by any real input" does not hold.
- Item 20: in comp-n's shape the probe's click at T0w@3 lands at T0w@0 at the base and at T0w@3 at the branch, which is what made the 'placed' differ.
