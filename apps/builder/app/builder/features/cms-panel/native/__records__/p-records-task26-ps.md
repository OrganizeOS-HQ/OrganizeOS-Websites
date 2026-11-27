# Task 26: P-S1 and P-S2 measurements, and T84.4's two items

Measured only; nothing fixed, nothing committed.

- R1: fork `4f698d0` (native code = `a3bc7d8`; `git diff a3bc7d8 4f698d0` outside `__records__` is empty), in this agent's worktree
  `/home/user/OrganizeOS-Websites/.claude/worktrees/agent-a90bbec8d0c9fcc33` (left detached at `4f698d0`, clean).
- Base: `SP/r1-base` (`2a96a45`), left clean.
- Every run was under `timeout -s KILL 600`. None hung, none was killed, every run's test passed, and no record logged a console error except
  the one named in (iii).
- Load averages (1/5/15 min) while running: 1.0 to 8.3 (the other two agents' runs). Each run's log holds its load before and after.

Where things are (all under `SP/ps/`):

- `probes/`: the probe files (`zzps-clipx.test.tsx`, `zzps-clipx4b.test.tsx` from `mk4b.py`, `zzps-i1code.test.tsx`).
- `zzps-engine.tsx` (from `mkeng.py`): T79.6's engine (`SP/six/zzsix-engine.tsx`) with two steps added, `pathPoint` (a caret set by
  code at a `selInfo` path) and `dumpCopied` (every clipboard type of the last cut).
- `gen.py 1|2`: the batches. `erun.sh`, `prun.sh`, `d7run.py`, `bis.sh`: the runners.
- `out/<side>/<run>/`: the data. `summ-p1.txt` and `summ-p2.txt` are the per-record tables. `i1code-cmp-a3bc.txt` is P-S2-1's table.

## P-S2-2: clip-x `4b-real|P#72` (ordinary content `<p>A0w</p><hr><p>B2w</p>`)

The record is index 71 of the `4b-real|P` list, `drag B2w@1 above rule` then `cut`. `#72` counts from 1, so `#2` is the second record.

**Selections before the cut.** The probe added the page's selection and the window's scroll to the file's own record. The run is the file's
`4b root-rule ranges by real input` test, alone.

| build        | 70 copy | 71 cut    | 73 Delete | 75 Enter | 72, 74, 76 |
| ------------ | ------- | --------- | --------- | -------- | ---------- |
| R1 `a3bc7d8` | range   | **caret** | caret     | caret    | range      |
| R1 `0ae275f` | range   | **caret** | caret     | caret    | range      |
| base         | range   | **caret** | caret     | caret    | range      |

- Range: Lexical's selection is `B2w@1 -> A0w@3` (backward) and the page's is `"B2w"@1 -> "A0w"@3`.
- Caret: Lexical's selection is `B2w@3` (collapsed) and the page's is `"B2w"@3`.

**The cause is the probe, not the build.** By record 63 the window is scrolled horizontally (`scrollX` 65 or 66 on `HTML`, the rule's left
edge at -56 or -57). The drag starts at B2w's 40% point, which is at x < 0, outside the viewport.

- With `scrollX` 65 the press lands at `B2w@3` and the moves never extend it: a caret.
- With 66 the drag makes the range.

In the full-file runs of the second comparison, record 71 got the range at the base and at `0ae275f`, and the caret at R1 now. In this
run all three builds give the caret at 71. No commit between `0ae275f` and `a3bc7d8` changes it. A bisect has nothing to find: the result
follows the run's scroll offset.

**What the range holds: nothing.** The cut runs on a collapsed caret.

| build     | text/plain                  | text/html | types | value                        | onChange |
| --------- | --------------------------- | --------- | ----- | ---------------------------- | -------- |
| R1 (both) | untouched (no type written) | untouched | none  | `<p>A0w</p><hr /><p>B2w</p>` | 0        |
| base      | `""`                        | `""`      | 2     | unchanged                    | 0        |

**Both builds at the same selection set by code** (`zzps-clipx.test.tsx`, 3 runs each):

- Range `B2w@1 -> A0w@3`:
  - the cut writes `<p>A0w2w</p>` at R1 `a3bc7d8`, at `0ae275f` and at the base, and the paste back writes `<p>A0w</p><p></p><hr /><p>B2w</p>`
    at all three;
  - text/plain is `"\n\n\nB"` at R1 now and at the base, and `"\n\nB"` at `0ae275f` (defect 1's fix, T65.1).
- Caret `B2w@3`: R1 writes nothing to the clipboard and leaves the value; the base writes `""` to text/plain and text/html and leaves the
  value.
- The real drag in this probe file collapsed in 2 of 3 runs at every build, for the same scroll reason.

**Outcome: the range holds nothing.** R1's untouched clipboard is D6's rule (16.3, 16.9, T15.7), so P-S2-2 **stands**.

## P-S2-1: the 14 `keys-i1code` plain-paste cells

**The commit.** I ran the probe at each build: inside means the paste lands in the inline code (`Zq</code>`), outside means it lands after
it.

- `0ae275f`, `d03d074`, `d7cfe67` and `241d7f6`: 14 of 14 inside.
- `7ca9440` (merge of t70), `e21c8ae`, `c3df835`, `62d05c7` and `a3bc7d8`: 0 of 14 inside.

The change is **`e21c8ae`** "fix(cms): plain text over a range from a lined container is pasted at the caret the removal leaves (T70.11 R4b
pt2)". It touches `rich-text-field.tsx` and `rich-text-line-paste.ts`, and its parent `241d7f6` still puts the paste inside.

**D14's oracle at a3bc7d8** (`i1code-cmp-a3bc.txt`). The steps are the cell's own range set by code, Backspace, the plain paste `Zq` at the
caret that leaves, then `k`; and, beside it, the paste over the range, then `k`.

- R1's paste over the range equals R1's Backspace-then-paste in **14 of 14** cells, and the letter after each is the same in 14 of 14.
- Every write is a fixed point, and no record logged an error.
- After Backspace, R1's caret is `Cw@2`. The paste then lands after the code: for example, `…T1w<code>Cw</code>Zq2w…`, and then
  `…Zqk2w…`.
- At `241d7f6` the two differ in 14 of 14: the paste over the range gives `CwZq</code>`, and Backspace-then-paste does not.

**The base, for comparison.**

- **BLend** (next, other), **LLend** (next, other), 8 cells: the paste equals Backspace-then-paste.
  - Both keep a quote or a split: `T1w<code>Cw</code><blockquote><p>Zq2w</p></blockquote>`.
  - R1 instead joins the line: `T1w<code>Cw</code>Zq2w`.
- **BLtrail other**, 2 cells: the paste gives `T1w<code>CwZq</code>w</li></ul>`.
  - Backspace-then-paste gives `T1w<code>Cw</code>Zq</li><li>w</li>`, because the base's Backspace leaves the items split.
- **BLstart same** and **LLstart same**, 4 cells: the paste lands inside the code (`<code>Zq</code>1w`).
  - Backspace-then-paste lands outside it (`Zq1w`), which is R1's value.

**Outcome:** P-S2-1 **stands** under D14 and T76.3. The base differs from R1 in all 14 cells; it equals R1's value only in the 4 `*start`
cells, and there only by Backspace-then-paste.

## The 19 P-S1 records

**Method.** For each record, both builds start at R1's caret or range set by code. The write is taken with `an` (its fixed point) and
`reopen` (the value rendered again). A second run of the same setup does undo, redo and the letter: `cmp` against the snapshots before and
after.

- R1's clicks are out of the comparison everywhere.
- The one exception is noted under P-S1-5, 11 and 14: there R1's caret is an empty line that only a press creates.

### Divider at a text end or liEnd (P-S1-1, 5, 11, 14, 16)

| record                | caret by code (base / R1)                                                                            | base write                                                                                                                                  | R1 write by code | equal |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----- |
| P-S1-1 `A3 RT liEnd`  | `T1w@3` / `T1w@3`                                                                                    | `<ul><li>Pw</li></ul><hr /><ul><li><hr />T1w</li><li>Nw</li></ul>`                                                                          | the same         | yes   |
| P-S1-16 `D RT liEnd`  | `T1w@3` / `T1w@3`                                                                                    | `<ul><li>Aw<ul><li>Pw</li></ul></li></ul><hr /><ul><li><ul><li><hr />T1w</li><li>Nw</li></ul></li><li>Zw</li></ul>`                         | the same         | yes   |
| P-S1-5 `B QBR liEnd`  | `listitem[1]@element:3` (after the rule) / the same point, which R1 moves to `cms-line[3]@element:0` | `<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote><br /><hr /></li><li>Nw</li></ul>`                                    | the same         | yes   |
| P-S1-11 `B QTR liEnd` | as P-S1-5                                                                                            | `<ul><li>Pw</li></ul><hr /><ul><li><blockquote><p>Q0w</p></blockquote>T1w<hr /></li><li>Nw</li></ul>`                                       | the same         | yes   |
| P-S1-14 `D CR liEnd`  | `…/list[0]/listitem[1]@element:2` / the same point, which R1 moves to `cms-line[2]@element:0`        | `<ul><li>Aw<ul><li>Pw</li></ul></li></ul><hr /><ul><li><ul><li><pre><code>C0w</code></pre><hr /></li><li>Nw</li></ul></li><li>Zw</li></ul>` | the same         | yes   |

- For P-S1-5, 11 and 14, R1's caret in the record (`cms-line[3]@element:0`, `cms-line[2]@element:0`) does not exist in the stored value. A
  `pathPoint` to it finds no node, and the mount click node-selects the rule, so Divider does nothing. The item's end point set by code is
  moved by R1 onto that same empty line, and R1's write there equals both the record's and the base's. R1's press (`clickLiEnd`) gives the
  same write too.
- Calls: 1 at each build. Undo and redo match the snapshots at both builds.
  - The one exception is P-S1-5 at R1 by code and by press: undo's raw `state` differs from the snapshot taken after R1 made the empty line,
    with the html and the caret equal.
- The letter: the base and R1 give the same value (`k` at the new item's start, or `kQ0w`, `kC0w`).

**Outcome:** the base at the same caret gives R1's write, with no emptied item, in 5 of 5. They **stand** as the head's Divider at an
item-end caret (T2 stays in R2; T70.9's label).

### Divider at Pw@end (P-S1-3, 9)

- Caret `Pw@2` set by code at both builds.
- QBR: the base writes `<ul></ul><hr /><ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr /></li><li>Nw</li></ul>`, and R1
  writes the same.
- QTR: the base writes `<ul></ul><hr /><ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<hr /></li><li>Nw</li></ul>`, and R1
  writes the same.
- R1's `<ul></ul>` write is a fixed point, reopens editable, and loads back to the same value. Undo, redo and the letter (`kPw`) are equal at
  both builds.

**Outcome:** they **stand** as T2's, in the "Known, not fixed" list.

### Divider at Nw@0 and ruleClick (P-S1-2, 6, 8, 12, 15)

- **The first check's measurement 1** (`SP/t59m/out/base-m3.json`, `M1y:*|Nw@0 by code|Dv`) is the base's write at `Nw@0` set by code:
  - QBR: `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr /></li><li></li></ul><hr /><ul><li>Nw</li></ul>`;
  - QTR: the same with `T1w<hr />`;
  - CR d2: `<ul><li>Aw<ul><li>Pw</li><li><pre><code>C0w</code></pre><hr /></li><li></li></ul></li></ul><hr /><ul><li><ul><li>Nw</li></ul></li><li>Zw</li></ul>`.
  - Each holds the `<li></li>` and equals the R1 records' writes.
- **Run once more** (QBR, QTR and CR d2, the base and R1 at `Nw@0` by code): the same three values at both builds.
  - Each is a fixed point that reopens editable.
  - Undo and redo match at both builds, and the letter is `kNw` at both.
- R1's ruleClick records (P-S1-6, 12, 15) leave `Nw@0`, the same caret.

**Outcome:** equal. They stand under T70.5 and are **not P records**.

### Quote over a range starting in a quote's paragraph (P-S1-4, 7, 10, 13)

- The ranges were set by code at both builds: `Q0w@1 -> Nw@1`, `Q0w@0 -> Q0w@3` (QBR), `Q0w@1 -> T1w@2` and `Q0w@0 -> T1w@3` (QTR).
- At both builds Quote writes nothing: 0 calls, the value and the range unchanged. Undo and redo then change nothing.
- The letter over the range differs in P-S1-10 and 13, a range removal and not the Quote:
  - base: `<blockquote><p>Qkw</p><hr /></blockquote>` and `<blockquote><p>k</p><hr /></blockquote>`;
  - R1: `<blockquote><p>Qkw</p></blockquote><hr />` and `<blockquote><p>k</p></blockquote><hr />`.

**Outcome:** equal (nothing written). They **stand** under D1.

### P-S1-17 and P-S1-18: T79.6's control

- R1's clipboard is captured from R1's own cut at the record's range set by code (all three types, `dumpCopied`). R1's cut and paste in this
  run reproduce the record.
- Each is then pasted at R1's value and caret after the cut, at both builds, with the lexical namespace set to the live editor's.

| record        | value after R1's cut; caret                                        | clipboard (plain)                       | base's paste                                                     | R1's paste |
| ------------- | ------------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------- | ---------- |
| P-S1-17 `C11` | `<ul><li><blockquote><p>bq</p></blockquote>t1q</li></ul>`; `t1q@1` | `1q\nn` (and an html list of `1q`, `n`) | `…t</li><li>1q</li><li>n1q</li></ul>`                            | the same   |
| P-S1-18 `C3`  | `<ul><li>xq<br />yq</li></ul>`; `xq@1`                             | `q\nq` (and an html quote)              | `<ul><li>xq</li></ul><blockquote><p>qq<br />yq</p></blockquote>` | the same   |

- Both are fixed points that reopen editable.
- Undo returns to the value after the cut, and redo to the paste, both matching their snapshots at both builds.
- The letter is the same at both builds: `nk1q` and `qkq`.

**Outcome:** the base gives R1's afterPaste in both records: the head's paste (D14). They **stand**.

### P-S1-19: `g3|emptyLine-enter|QT|Bksp3Enter`

- **The value R1 holds before the Enter.** After a click at `T1w` and three Backspaces, R1 writes
  `<ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>`.
  - R1's caret is `cms-line[1]@element:0`, an empty line after the quote, with lines `listitem>[]`.
  - The base, from the same keys, holds the caret in the quote (`quote[0]@element:1`).
- **The base's Enter at the item's point after the quote** (`listitem[0]@element:1`, set by code) on that value writes
  `<ul><li><blockquote><p>Q0w</p><p></p></blockquote></li><li>Nw</li></ul>`.
  - The caret ends at `quote[0]/paragraph[1]@element:0`, in 1 call.
  - Undo returns the value and redo the write, matching their snapshots. The letter gives `<p>k</p>` inside the quote.
  - The write is a fixed point that reopens editable.
- **R1 with the same caret set by code.** R1 moves the caret to `Q0w@3`, since the empty line does not exist in the stored value. It then
  writes the base's value exactly, with the same undo, redo and letter.
- **R1's record**, from its empty line, writes `<ul><li><blockquote><p>Q0w</p></blockquote></li><li></li><li>Nw</li></ul>`.
- These differ: the base at the item's point after the quote keeps the new line in the quote, while R1's record puts it in a new item.

**Outcome:** left to the coordinating session. T84.2 gives this measurement no outcome to apply.

## Also owed (T84.4)

**(iii) `A2-two-noop-then-range-delete`, hist-a and hist-ab.**

- **The error text** (the same at both builds, in both files):
  > `updateEditor: selection has been lost because the previously selected nodes have been removed and selection wasn't moved to another node. Ensure selection changes after removing/replacing a selected node.` at Lexical's `$beginUpdate`.
- It is logged during the cell's own edit step: the probe body's discrete update (it selects `Nw@2`, dispatches a no-op Delete, then restores
  a clone of the range), followed by `insertText("")`.
- **The cell run alone** (`-t "A2-two-noop-then-range-delete"`, each file, both builds):
  - error counter 0 before the edit and 1 from the edit on;
  - the same values at both builds: edit `T0w<blockquote><p>Q</p></blockquote>`, `m` gives `Qm`, undo1 `Q`, undo2 the stored value;
  - invariant ok, 4 calls.

So the counter of 1 is Lexical's report on the probe's own update sequence, and it is the same at both builds when the cell runs alone.

**T82.3 item 2: the two clipboard `k2` records**, `K11 H only elem0 / hr` and `/ ul`. Each ran 3 times per build through the clipboard
set's engine, with every `cmp` note also giving D7's equality. D7 here is `editorState.toJSON()` with every `direction` and every empty
`cms-line` left out; `toJSON` holds no node keys.

- **R1:** D7-equal after undo in 6 of 6, with the caret and html equal.
  - The raw state differs: the first raw difference is the item's `"direction":null` against `"ltr"`.
  - After redo, the raw state is equal.
- **Base:** raw-equal after undo and redo in 6 of 6.
- The values: `hr` gives `<ul><li>a1q</li></ul><hr /><ul><li><hr /></li><li>c1q</li></ul>`, and `ul` gives `<ul><li>a1q</li><li>Aq<hr /></li><li>c1q</li></ul>`.
  Both are the same at both builds.

**Outcome:** both are D7-equal. **No D7 defect.**

## Summary of outcomes

| record                | outcome                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| P-S2-2                | stands (D6; the range held nothing, a probe scroll artifact at every build)                                             |
| P-S2-1                | stands (D14, T76.3); changed by `e21c8ae`                                                                               |
| P-S1-1, 5, 11, 14, 16 | stand (the head's Divider at an item-end caret; T2 in R2; T70.9)                                                        |
| P-S1-3, 9             | stand as T2's, "Known, not fixed" (fixed point, reopens editable)                                                       |
| P-S1-2, 6, 8, 12, 15  | stand under T70.5, not P records (measurement 1 confirmed; CR d2 control re-run)                                        |
| P-S1-4, 7, 10, 13     | stand under D1 (the base writes nothing too)                                                                            |
| P-S1-17, 18           | stand: the head's paste (D14)                                                                                           |
| P-S1-19               | measured; the base at the point after the quote keeps the new paragraph in the quote; R1's record puts it in a new item |
| hist A2 error         | the same Lexical "selection has been lost" at both builds, run alone                                                    |
| k2 D7                 | D7-equal, no defect                                                                                                     |
