# Task 26: T70 measurements (at ee38640 and the base)

Measured 2026-11-26. Builds: head = fork `ee38640` (detached in the agent worktree, `pnpm install --frozen-lockfile`); base = `2a96a45` (SP/r1-base, every run under `timeout -s KILL 600`, left as found: its only untracked file, `zz13base.log`, was there before). Rulings read from `SP/rulings-t70.md` (branch `claude/fervent-ramanujan-taej2f-p1`). T70.5 names `0d3d0f4`; everything here ran at `ee38640`, as briefed. Nothing committed; one temporary source edit (item 2) was reverted with `git checkout --` and the worktree is clean; every scratch dir (`native/zzm70*`) was removed.

Kit: `SP/t70m/` (copy of `SP/t59m/`): `src/engine.tsx` is the gap-fill engine plus a `press` step (item 1) and a `noClick` scenario flag (skips the driver's first click into the editable); `run.py` / `prun.sh` run a batch / a check-5 probe at one build; batches `batches/*.json` (built by `mkp1.py`, `mkm1b.py`, `mkm79.py`, `mkm7b.py`), outputs `out/{base,branch}-*.json`, probe outputs `pout/{base,branch}/<tag>/`, logs `logs/`. Probes added: `probes/comp/zzv15-comp-t70.test.tsx` (item 2 trace), `probes/comp/zzv15-comp-t70n.test.tsx` (item 3), `probes/clip/zzv15-clip-t70.test.tsx` (item 16). Viewers: `sum1.py` (item 1), `sumrec.py`, `sum9.py` / `cnt9.py` (item 9), `sum16.py`, `sumcomp.py`.

Load (4 cores, other agents running browser tests): 1-minute load 1.6 to 10.7 over the runs (item 1 batches 4.98 to 8.63; the head pins 7.33 to 10.67; the composition runs 1.6 to 4.4). No run crashed or timed out; every batch returned all its records.

## Summary

| Item                               | Head (`ee38640`)                                                                                                                                         | Base (`2a96a45`)                                                      | What the ruling's text gives                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| T70.5 (1) press vs click           | `hold(firstRule,0)`: node selection 20/20 on RQR, R, RQ, TR, QBR; rule handler ran. `clickEl hr 0 mid`: never hits the rule (lands 1 px below it), caret | identical events and selections; only the letters differ (base `kPw`) | needs a ruling on which wording changes: both driver results stand, they are different places |
| T70.5 pins                         | 15.13 (42 tests), the rule-click pin and both V11 tests pass                                                                                             |                                                                       |                                                                                               |
| T70.5 base toolbar at Nw@0 by code |                                                                                                                                                          | all 14 writes equal R1's ruleClick writes                             | stands                                                                                        |
| T70.4 (2) comp-x M-                | the stale "a" goes before the composition because of 16.20's backward-to-forward swap, not 16.19                                                         |                                                                       | needs a ruling: neither of T70.4's two branches fits                                          |
| T70.8 (3) comp-n                   | equal to the base in values, count, undo and redo                                                                                                        |                                                                       | stands                                                                                        |
| 7 QQR hr0@start                    | click leaves `Nw@0` (the ordinary twin's caret at both builds); the edits are R1's own edits at Nw@0                                                     | null selection (letter `kPw`)                                         | stands                                                                                        |
| 9 G1 NESTED                        | the lined write equals R1's twin write in all 39 records; 31 range records: equal to the base twin modulo D1's emptied entries                           | twins measured                                                        | stands                                                                                        |
| 16 Enter                           | Enter = Backspace then Enter, 10/10 drags                                                                                                                | the same, plus the base's empty quote                                 | stands                                                                                        |

## 1. T70.5: `hold(firstRule, 0)` against `clickEl hr 0 mid`

Setup: RQR `LI(<hr>Q(Q1w)<hr>)`, R `LI(<hr>)`, RQ `LI(<hr>Q(Q1w))`, TR `LI(T0w<hr>)`, QBR `LI(Q(Q0w)<br><hr>)` (`LI` = `<ul><li>Pw</li><li>…</li><li>Nw</li></ul>`). Two drivers, each in two preconditions, 20 runs per cell, 400 runs per build:

- `hold`: the kit's press, CDP `Input.dispatchMouseEvent` pressed then released at the first rule's centre (`box.left + width/2`, `box.top + height/2`), 0 ms.
- `clickEl`: the acceptance driver, `userEvent.click(rule, {position: {x: width/2, y: height/2}, force: true})`.
- `pre`: the acceptance driver's precondition (the harness's first click into the editable, `clickEditable`). `nopre`: the kit's (`mount` only, no click).
  Each run reads `document.elementFromPoint` at the press point, every pointer, mouse, focus and click event and `selectionchange` in capture order (with the target, clientX/Y, Lexical's selection and the page's selection at each), `CLICK_COMMAND` (a CRITICAL listener for the target, and a LOW listener registered last: when the target is the rule's element and the LOW listener is not reached, an earlier LOW listener returned true, which is the rule's own handler), and the selection right after the release with no `domsel` step. Then a letter. Raw: `SP/t70m/out/{base,branch}-p1-*.json`; summary `python3 sum1.py <side>`.

The geometry decides it. Every rule's box is 1 px tall (RQR, R, RQ: `top 62, height 1`; TR `78`; QBR `102`), and the iframe sits at (0, 0). `elementFromPoint` at the centre is the rule in every run at both builds.

- `hold` presses at `top + 0.5` (pointerdown at `248.00, 62.50`): the target is the rule.
- `clickEl` lands at `top + 1.5` (pointerdown at `248.00, 63.50`, i.e. 1 px below the rule's box): the target is the `li` (RQR, R, RQ) or the `ul` (TR, QBR). Playwright's click never reaches the rule.

Results (identical at both builds except where marked; event order without the pointer-over and move events):

| Shape               | Driver                 | Target | Event order                                                                                                                  | Rule's handler | Selection after the release (no domsel)                                                                                                                   | Letter, head                                                                                                                                                                     | Letter, base           |
| ------------------- | ---------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| RQR, R, RQ, TR, QBR | hold, nopre (20 each)  | rule   | pointerdown, mousedown, focus, focusin, selectionchange, pointerup, mouseup, click, CLICK_COMMAND, selectionchange           | ran 20/20      | `node:horizontalrule` 20/20                                                                                                                               | after the rule (D15): RQR `<hr /><blockquote><p>kQ1w</p></blockquote><hr />`, R `<hr />k`, RQ `<hr /><blockquote><p>kQ1w</p></blockquote>`, TR `T0w<hr />k`, QBR `<br /><hr />k` | `kPw` (document start) |
| RQR, R, RQ, TR      | hold, pre              | rule   | pointerdown, mousedown, selectionchange, pointerup, mouseup, click, CLICK_COMMAND, selectionchange                           | ran 20/20      | `node:horizontalrule` 20/20                                                                                                                               | as above                                                                                                                                                                         | `kPw`                  |
| QBR                 | hold, pre              | rule   | as above                                                                                                                     | ran 20/20      | `null` 20/20 at both builds: the first click had already node-selected this rule (see below), and the rule's handler toggles (`setSelected(!isSelected)`) | `kPw`                                                                                                                                                                            | `kPw`                  |
| RQR, R, RQ          | clickEl, nopre and pre | `li`   | pointerdown, mousedown, (focus, focusin), pointerup, mouseup, click, CLICK_COMMAND (target li), LOW reached, selectionchange | did not run    | head `listitem[1]/cms-line[0]@element:0`; base `listitem[1]@element:0` (a caret before the rule)                                                          | `<li>k<hr />…`                                                                                                                                                                   | `<li>k<hr />…`         |
| TR                  | clickEl, nopre and pre | `ul`   | as above, target ul                                                                                                          | did not run    | `text:Nw@0`                                                                                                                                               | `kNw`                                                                                                                                                                            | `kNw`                  |
| QBR                 | clickEl, nopre         | `ul`   | as above                                                                                                                     | did not run    | `text:Nw@0`                                                                                                                                               | `kNw`                                                                                                                                                                            | `kNw`                  |
| QBR                 | clickEl, pre           | `ul`   | as above                                                                                                                     | did not run    | head `text:Nw@0` 20/20; base `null` 20/20                                                                                                                 | `kNw`                                                                                                                                                                            | `kPw`                  |

The base's "no selection" on QBR in the acceptance run (and on QQR, item 7; QTR and CR d2 were not re-checked here) is the driver's first click: `clickEditable` (a Playwright click at the editable's centre) lands on QBR's rule and node-selects it (`preSel = nodes:…/horizontalrule[2]` in all 40 `pre` runs at both builds; also QQR in item 7). The next click lands in the `ul` below the rule. At the base, Lexical's rich-text `CLICK_COMMAND` handler (priority 0) clears a node selection and returns true, so the selection is null. At the head, R1's `points.clickAfterNodeSelection` (D1's listed exception: a click into text while a node is selected gives a caret at the click) leaves `Nw@0`.

Pins at the head (each test file once, `-t` filters; `SP/t70m/logs/pin-1513.json`, `pin-rule.json`):

- `rich-text-line-press.test.tsx`, "15.13: a press on a rule" (project lines-b): 42 passed, 0 failed (the 9 "selects it" tests at 0, 50 and 200 ms, plain and with both forced orders, and the 33 "does not move" tests).
- `rich-text-line-toolbar.test.tsx` "a click on a rule node-selects it" (Task 19's pin): pass. It presses with the kit's `clickAt` (CDP at the rule's centre).
- `rich-text-line-toolbar.test.tsx` "V11: a real click on the first rule, Backspace, then k": pass. `rich-text-line-points.test.tsx` "V11: the caret after Backspace removes a clicked rule" (a Playwright click at the rule's (1, 1)): pass.

The base's toolbar commands at Nw@0 set by code (`["caret","Nw","start"]` in place of the click; then the record's own steps), compared with R1's ruleClick record writes re-run at the head (`SP/t70m/out/{base,branch}-m1b.json`):

| Record                     | Base at Nw@0 by code                                                                                       | R1 ruleClick record |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------- |
| QBR H2                     | `[P]<li>…<br /><hr /></li></ul><h2>Nw</h2>`                                                                | the same            |
| QBR Qt                     | `…</ul><blockquote>Nw</blockquote>`                                                                        | the same            |
| QBR Im                     | `…<hr /></li><li><img />Nw</li></ul>`                                                                      | the same            |
| QBR Ln                     | `…<li><a href="https://example.org/a">Nw</a></li></ul>`                                                    | the same            |
| QBR OL                     | `<ol><li>Pw</li><li>…<br /><hr /></li><li>Nw</li></ol>`                                                    | the same            |
| QBR UL                     | `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p><br /></p><hr /><p>Nw</p>`                                 | the same            |
| QTR H2, Qt, Im, Ln, OL, UL | the same six forms with `T1w` in place of `<br />` (UL: `<p>T1w</p>`)                                      | the same            |
| CR d2 OL                   | `<ul><li>Aw<ol><li>Pw</li><li><pre><code>C0w</code></pre><hr /></li><li>Nw</li></ol></li><li>Zw</li></ul>` | the same            |
| CR d2 UL                   | `<p>Aw</p><p>Pw</p><pre><code>C0w</code></pre><hr /><p>Nw</p><p>Zw</p>`                                    | the same            |

All 14 equal; the head at Nw@0 by code also equals its own ruleClick records (28 of 28). The acceptance's base ruleClick records differ only because the base's click left a null selection (the letter and the commands at Pw).

What the ruling's text gives:

- Both statements are true of different places. A real press on the rule node-selects it at both builds (15.13, T12.1, T9.2 row L and Task 19's wording hold for a press that reaches the rule; the pins press at `top + 0.5`). The acceptance driver's `clickEl hr 0 mid` is a click 1 px below the rule: in the item (leading rules) or in the list below (item-ending rules), which leaves a caret at both builds and never runs the rule's handler.
- So the 26 leading-rule Block type records and the QBR/QTR/CR d2 Divider records stand as T70.5 reads them (D13, at the caret the driver leaves; the head's Divider at Nw@0), but they are not records of a click on a rule. T12.1 and Task 19's pin need no change for the build; what changes is the label of those records ("a click just below the rule", not "a click on the rule"). Which text is edited is the coordinating session's call: needs a ruling.
- The QBR `pre` cells show a second press on a node-selected rule deselects it at both builds (null, letter at the document start). The head's own D15 result. Not pinned anywhere I saw.
- The base's toolbar writes at Nw@0 equal R1's ruleClick writes: stands.

## 2. T70.4: comp-x M-prepend and M-replace, the step that orders the stale "a"

Setup: `<p>A0w</p><p>B1w</p>`, backward range B1w@1 -> A0w@1 by code, `Input.imeSetComposition "a"`, the code change (M-replace: the composed text node replaced by a copy and the caret set at the old anchor offset; M-prepend: a text node "P" inserted before it; control: nothing), `imeSetComposition "ab"`, `insertText "ab"`. Traced at both builds with an update listener (state text, Lexical selection, page selection), capture listeners on the composition and input events, and `editor.update` wrapped for the caller's stack (`SP/t70m/probes/comp/zzv15-comp-t70.test.tsx`; outputs `SP/t70m/pout/{base,branch}/c70/`).

Trace (`\Z` = U+200B):

| Step                                                      | Base                                                                                       | Head                                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| compositionstart                                          | Lexical removes the range and inserts `\Z`: `A\Z1w`, selection collapsed at 2 (after `\Z`) | first an `editor.update` from `composeForward` (`rich-text-line-node-selection.ts`, called from `onCompositionStart`) turns the range forward (A0w@1 -> B1w@1); then Lexical removes it and inserts `\Z`: `A\Z1w`, selection a range **over** `\Z` (@1 -> @2) |
| ime "a"                                                   | `A\Za1w`, Lexical selection @2 (before "a")                                                | the "a" replaces the selected `\Z`: `Aa1w`, selection @2 (after "a")                                                                                                                                                                                          |
| code change (`select(off, off)` at the anchor's offset)   | caret at 2: before "a"                                                                     | caret at 2: after "a"                                                                                                                                                                                                                                         |
| ime "ab" (the page starts a new composition at the caret) | `A\Zab` + `a1w`                                                                            | `Aa` + `ab1w`                                                                                                                                                                                                                                                 |
| end                                                       | `A\Zaba1w` (16.19 not in the base)                                                         | `Aaab1w`; the 16.19 removal has nothing to remove                                                                                                                                                                                                             |

So the step that puts the composed text after the stale "a" is 16.20's swap of a backward range into the forward range before Lexical's own compositionstart: `rich-text-line-node-selection.ts` lines 217 to 290 (`composeForward`; the gate `$backward()` at 232 to 238, the swap at 271 to 280), called at line 214 from `onCompositionStart` (line 208). With the forward range Lexical selects its start character, so the first composed character replaces it, and Lexical's selection during the composition stands after the composed text, where the head's stands at the composition's start. It is not 16.19's removal by count: in this path the head never holds a start character to remove.

What a fix to the head's order without U+200B changes, measured by disabling the backward swap (line 237 `selection.isBackward()` made false; the format part kept), then reverting:

- comp-x (`SP/t70m/pout/branch/cx-noswap/`): M-replace `Aaba1w` (one value, letter `Aabka1w`, undo: one press to the stored value); M-prepend `PAaba1w`. These are the head's writes less U+200B. Control, M-split and M-settext unchanged (`Aab1w`, `Aab1w`, `XAab1w`). M-merge changes: `A<b><strong>aab1w</strong></b>` (head `Aab1w`), and its undo takes three presses (`…aab1w`, `<p>A<b><strong>a1w</strong></b></p>`, stored) where the head takes two.
- The build invariant (`field invariant: 1 composition-start character(s) a composition left that the document did not hold before it`) fires in every backward composition of the probe, the control included.
- `rich-text-line-composition.test.tsx` (project lines, `SP/t70m/logs/comp-noswap.json`): 67 passed, 68 failed of 135. The failures are the 16.19 cells (backward ranges by code, by Shift+Arrow and by drag, ordinary and lined, the "composed node replaced" and "text shifted" cells), 16.20 (`<p><b><strong>A</strong></b>aab1w</p>` where the forward range writes `<b><strong>Aab</strong></b>1w`), 16.21 (two), T59 defects 6 and 7, R1's "a zero-width space the paragraph holds stays" (two), and 16.2/15.1's "a second written composition" (a start character left).
- So the head's order is reachable only by giving up 16.20's swap, which breaks 16.19's count in the head's own tests, 16.20 and 16.21. No step of R1 other than 16.20's keeps the head's order without U+200B; I did not try an alternative mechanism (fix nothing).

What the ruling's text gives: T70.4's branches are "16.19's removal by count" (list the order beside 16.19, count under T60.3) or "another R1 step that can keep the head's order without U+200B" (fix to `Aaba1w`, `PAaba1w`). The step is 16.20, which is itself on D1's list, and it cannot keep the head's order without breaking 16.19 to 16.21. Neither branch fits as written; the nearer is the first with 16.20 in place of 16.19 (the order listed beside 16.20). Needs a ruling. The stale "a" stays a loss both builds share.

## 3. T70.8: comp-n, a composition under each rule node-selected by code

Setup: `LI(T0w<hr><hr>T3w)`, the probe's first click (Pw@1), then each rule node-selected by code (`$createNodeSelection`), a CDP composition of "a" and of "ab" (prefix by prefix, then `insertText`), undo to the start, redo to the end (`SP/t70m/probes/comp/zzv15-comp-t70n.test.tsx`; `SP/t70m/pout/{base,branch}/c70n/`).

| Rule          | Text | Values handed out            | Final write                                                    | Undo                         | Redo      |
| ------------- | ---- | ---------------------------- | -------------------------------------------------------------- | ---------------------------- | --------- |
| first, second | "a"  | `<ul><li>aPw</li>…` (1 call) | `<ul><li>aPw</li><li>T0w<hr /><hr />T3w</li><li>Nw</li></ul>`  | 1 press, to the stored value | 1 press   |
| first, second | "ab" | `…aPw…`, `…abPw…` (2 calls)  | `<ul><li>abPw</li><li>T0w<hr /><hr />T3w</li><li>Nw</li></ul>` | 2 presses (`aPw`, stored)    | 2 presses |

Identical at both builds in every cell, selection still `node:horizontalrule` after the composition. The composition lands at the document's start at both builds (not after the rule as R1's letter does).

What the ruling's text gives: "Equal: R stands." Stands.

## 4. T70.10: items 7, 9 and 16

### Item 7: QQR hr0@start

Setup: QQR `LI(Q(Q0w)Q(Q1w)<hr>)` and its ordinary twin `<p>Pw</p>Q(Q0w)Q(Q1w)<hr><p>Nw</p>`: the acceptance driver's click (`clickEl hr 0 start`), then a letter, or the records' own BS and DEL steps; the two k2 records re-run; and the head's and base's edits at Nw@0 set by code (`SP/t70m/out/{base,branch}-m7.json`, `-m7b.json`).

|                     | Head                                                                                                            | Base                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| QQR click           | `text:Nw@0` (DOM `"Nw"@0`)                                                                                      | null (the first click had node-selected the rule; `preSel` at both builds)                              |
| QQR letter          | `[P]<li>…Q1w</p></blockquote><hr /></li><li>kNw</li></ul>`                                                      | `<ul><li>kPw</li>…`                                                                                     |
| QQR BS (record)     | `[P]<li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote>Nw</li></ul>`, letter `kNw` there | `<p>Pw</p><ul><li>…<hr /></li>[N]`                                                                      |
| QQR DEL (record)    | `…<hr /></li><li>w</li></ul>`                                                                                   | `<ul><li>w</li>…`                                                                                       |
| ordinary twin click | `Nw@0`; letter `<p>kNw</p>`; BS `…Q1w</p></blockquote><p>Nw</p>`; DEL `<hr /><p>w</p>`                          | the same                                                                                                |
| Nw@0 by code on QQR | BS, DEL, letter: the same writes as after the click                                                             | BS `[P]<li>…Q1w</p></blockquote></li>[N]` (rule removed, Nw stays its item); DEL and letter as the head |

The head's QQR records follow QBR's and QTR's exactly (k2 re-run: QBR BS `…<br />Nw</li></ul>`, QTR BS `…T1wNw</li></ul>`).

What the ruling's text gives: by the measurement's Decides clause the click lands at `Nw@0`, as the same click does in the ordinary twin at both builds, and the edits are R1's own edits at that caret: stands, as T70.9 ruled for QBR and QTR.

### Item 9: G1's NESTED records against the twin rule

G1's reader output is not in the scratchpad or either repository, so the set was rebuilt: every toolbar and keys-phase-1 record in "D1's bar: the head loses or reorders content" whose stored lined item holds a nested list directly and whose shape has an ordinary twin. That is 39 records: 31 over a range (A1 QL, A2 HL, A3 RL, B TQL whole; k0 CL, HL, QL ×3 each, RL; k1 BQL ×2, BRL; k2 QBL ×2, QLL ×3, QQL ×2, QRL ×2, QTL ×2, RBL, RLL ×2) and 8 at a caret. The QxLy records (a list inside a quote, T70.1) and the clipboard copies (the nested list outside the range) are left out. Twin of each: the item with its blocks as text lines (`Q0w<ul>…`, `T0w<br>Q1w<ul>…`, `Q0w<br><ul>…`, a rule as `Rw`), the record's own steps (`SP/t70m/out/{base,branch}-m9.json`; `python3 sum9.py`, `cnt9.py`).

- The head's lined write equals the head's own twin write in all 39.
- Against the base's twin: 8 caret records and 8 range records equal; 21 range records equal but for one empty item the base's twin leaves (`<li></li>`: 5.4's emptied rule, D1's listed entry); 2 (QLL and RLL `R:prev->L1w`) where the base's twin leaves L2w's list under an item with no text (`[P]<li><ul><li>L2w</li></ul></li>[N]`) and the head moves it with the joined text (`<ul><li>Pw<ul><li>L2w</li></ul></li>[N]`): D1's listed K14 entry (an item that holds only a nested list).
- In every record the nested list moves with the joined text, as the twin rule of the three measured records.

What the ruling's text gives: stands (5.7 QL row, with D1's emptied and K14 entries).

### Item 16: Enter against Backspace then Enter over the same drag

Setup: `<blockquote><p>A0w</p></blockquote><hr><blockquote><p>B2w</p></blockquote>` (Q) and `<p>A0w</p><hr><p>B2w</p>` (P), the clip-x probe's "drag B2w@1 above rule", 10 runs of each of Enter and Backspace-then-Enter per shape, plus the range set by code (B2w@1 -> A0w@3) for Enter, Backspace then Enter, and Backspace (`SP/t70m/probes/clip/zzv15-clip-t70.test.tsx`; `SP/t70m/pout/{base,branch}/c16/`).

|                                | Head                                                                                                                         | Base                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| range after the drag           | B2w@1 -> A0w@3 (backward) in 40 of 40 runs                                                                                   | the same, 40 of 40                                 |
| Q Enter                        | `<blockquote><p>A0w</p><p>2w</p></blockquote>`, 1 onChange, caret `2w@0`, letter `k2w`                                       | `…<p>2w</p></blockquote><blockquote></blockquote>` |
| Q Backspace then Enter         | Backspace `<blockquote><p>A0w2w</p></blockquote>` (caret A0w2w@3), then Enter: the same write and caret as Enter, 2 onChange | the same, each with the empty quote after          |
| P Enter / Backspace then Enter | `<p>A0w</p><p>2w</p>` both, caret `2w@0`                                                                                     | the same                                           |
| by code                        | identical to the drags                                                                                                       | identical to the drags                             |

What the ruling's text gives: R1's Enter write equals 5.4's oracle (Backspace over the range, then Enter) at every run; the base's only difference is its emptied quote (5.4 emptied, D1's listed entry). Stands.

## Notes for the coordinating session

- The acceptance driver's `clickEl hr N mid` (and `start`) never reaches a 1 px rule; it clicks 1 px below. A record set that means "a click on a rule" should press at `top + 0.5` (the kit's CDP press).
- The driver's first click (`clickEditable`) node-selects the rule in stored values where a rule sits at the editable's centre (QBR and QQR, measured here; QTR and CR d2 not checked). That, not the second click, is what gave the base its null selection.
- T70.4: the step is 16.20, not 16.19; reverting 16.20's swap gives the head's order but fails 68 of 135 composition tests.
