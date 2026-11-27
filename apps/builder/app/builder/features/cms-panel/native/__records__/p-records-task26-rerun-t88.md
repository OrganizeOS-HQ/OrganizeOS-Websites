# Task 26: the T88.7 re-run (T90.3), R1 `1c7781b` against the base

- Branch `rerun-t88` from `1c7781b` (holds T83's `3a2e8bd` and T88's `7c4a759`; native code = `3a78f83`). Base: `SP/r1-base`
  (`2a96a45`), left as found. Data and method: `acceptance/rerun-t88/` (README). Run on 2026-11-27; every run under
  `timeout -s KILL 600`.
- Re-run whole at both builds: keys-phase-1, keys-phase-2 and gap-fill (5,263 records each); check 5's keys, comp and
  comp-skeptic probes (46 files); the node grid at R1; T55.3's invariant per edit (T67.1) for the three sets.
- T85.1: the harness's state check takes D7's normalisation before any of these runs was read (README, "D7's normalisation").

## 1. The diff from `a3bc7d8` (code and tests)

`git diff --stat a3bc7d8..1c7781b -- . ':!**/__records__/**'`:

| file                                   | lines  | fix                               |
| -------------------------------------- | ------ | --------------------------------- |
| `rich-text-line-points.ts`             | +44 -6 | T83 (composing guard)             |
| `rich-text-line-history.ts`            | +21 -7 | T83                               |
| `rich-text-line-composition.test.tsx`  | +102   | T83 (tests)                       |
| `rich-text-line-deletes.ts`            | +66    | T88 (`$lineBreakBeforeBlock`)     |
| `rich-text-line-commands.ts`           | +6     | T88 (the row in the Delete chain) |
| `rich-text-line-deletes.test.tsx`      | +186   | T88 (tests)                       |
| `rich-text-line-commands.node.test.ts` | +2     | T88 (the order's test)            |

7 files, 427 insertions, 13 deletions (the 13 are in `points.ts` and `history.ts`). Nothing else outside the records directory.

## 2. Records whose R1 value changed since the second comparison

Compared with `acceptance/second/`'s R1 records (`a3bc7d8`) for the same ids: `compare.py`'s fields, timing fields dropped, the
port normalised, the cmp state fields left out of the compare (D7's state read on its own, section 4).

Record sets: 3 of 5,263 changed, all in keys-phase-1 `k3`, all T88's own (Delete at a text point directly before a line break that
ends its line, a block after the line):

| id                             | stored (in `<ul><li>Pw</li>...<li>Nw</li></ul>`)      | R1 at `a3bc7d8`   | R1 now                                            | ruled value (T88.1, T88.2)                        | equal |
| ------------------------------ | ----------------------------------------------------- | ----------------- | ------------------------------------------------- | ------------------------------------------------- | ----- |
| `k3::ul-d1\|TBQ\|T0w@end\|DEL` | `<li>T0w<br><blockquote><p>Q2w</p></blockquote></li>` | `<li>T0wQ2w</li>` | `<li>T0w<blockquote><p>Q2w</p></blockquote></li>` | `<li>T0w<blockquote><p>Q2w</p></blockquote></li>` | yes   |
| `k3::ul-d1\|TBC\|T0w@end\|DEL` | `<li>T0w<br><pre><code>C2w</code></pre></li>`         | `<li>T0wC2w</li>` | `<li>T0w<pre><code>C2w</code></pre></li>`         | `<li>T0w<pre><code>C2w</code></pre></li>`         | yes   |
| `k3::ul-d1\|TBH\|T0w@end\|DEL` | `<li>T0w<br><h3>H2w</h3></li>`                        | `<li>T0wH2w</li>` | `<li>T0w<h3>H2w</h3></li>`                        | `<li>T0w<h3>H2w</h3></li>`                        | yes   |

In all three: one onChange; the caret stays at T0w@3 (`cms-line[0]/text[0]`); one undo restores the stored value with the state
(D7 and raw) and caret equal; redo gives the write with state and caret equal; the letter writes `T0wk` before the block; fixed
point, reopens editable, no console error. The fourth record of the shape in the sets, `TBR|T0w@end|DEL` (a rule after the line),
was right already (`T0w<hr />`) and is unchanged, as T90.2 measured.

- T83's composition records (g4 compose; keys-phase-2's comp, compText and ins): none changed.
- T90.1's two word-form cells before a rule (Ctrl+Delete at T0w@3 in `<li>T0w<br><hr></li>` and `<li>T0w<br><hr>T3w</li>`): no
  record of the three sets or of the probes holds them (no Ctrl+Delete record at that point), so none changes here. Their values
  rest on T88's tests and measurement (`p-records-task26-t88.md`).

Probes: 0 of 23,078 R1 probe records changed (keys 19,609 equal and 33 only now: `keys-i3bb`'s second run was the short run of
T84.5, 480 records, and this run has 513; comp 3,180 and comp-skeptic 256 equal). Every probe file passed at R1, none killed.

**No P record.** Every changed record is one of the two fixes' own, at its ruled value.

The base changed in 13 records since its second run, all the base's own variation with R1 unchanged: 9 walk records flagged
`slow` (a step over 2 s), `k2 QBR walk Left` (its final value), `n2 QBR liEnd|k` and `n3 QBR g11 click Pw#0` (the base's letter
lands elsewhere), `g4 compose QTR afterRule 'a'` (steps), and `g4 sel TR T0w@1+SR3 Bksp` (T85.5's paced presses: the base now
keeps the rule, so the record turns from equal to different). `changed-base.jsonl.gz`.

## 3. Completeness (base against R1, this run)

| set          | records each side | compared | equal | different | missing base | missing R1 | hung base | hung R1 | crashed |
| ------------ | ----------------- | -------- | ----- | --------- | ------------ | ---------- | --------- | ------- | ------- |
| keys-phase-1 | 3,688             | 3,688    | 2,889 | 799       | 0            | 0          | 7         | 0       | 0       |
| keys-phase-2 | 1,030             | 1,030    | 656   | 374       | 0            | 0          | 15        | 0       | 0       |
| gap-fill     | 545               | 545      | 345   | 200       | 0            | 0          | 1         | 0       | 0       |
| **total**    | 5,263             | 5,263    | 3,890 | 1,373     | 0            | 0          | 23        | 0       | 0       |

Against the second comparison (2,891 / 797, 656 / 374, 346 / 199): keys-phase-1 has two more different, TBC and TBH, which were
equal (the base writes `T0wC2w` and `T0wH2w`, R1 did too) and now hold the fix's value (TBQ was different before and still is);
gap-fill has one more, the base's `g4 sel` record. The base's hangs are the second run's count (7, 15, 1). Per batch:
`acceptance/rerun-t88/completeness.md`.

Probes, base against R1 (46 files; `probes-pcmp-base-r1.txt`):

| lens         | files | records | equal | different | one side only | base killed at 600 s | base with no test summary  |
| ------------ | ----- | ------- | ----- | --------- | ------------- | -------------------- | -------------------------- |
| keys         | 37    | 19,642  | 5,588 | 4,073     | 9,981         | 20                   | 22 (20 kills, `i6`, `i6p`) |
| comp         | 8     | 3,180   | 1,580 | 1,600     | 0             | 0                    | 0                          |
| comp-skeptic | 1     | 256     | 108   | 148       | 0             | 0                    | 0                          |

The one-side records are the base's: its 20 killed keys files stop at their last 40-record flush, and `i6` and `i6p` do not load
at the base. R1 ran every file to its end. `comp-e` has its one failing test at both builds, as before. The base's own run-to-run
variation: 53 keys records differ from its second run (`i2r0` 23, `i2r1` 30), none at R1.

The node grid: 258 of 258 at R1, snapshot unchanged (it has no base side to run).

## 4. T55.3's invariant (per edit, T67.1), R1's records

| set          | in scope | pass  | pass, a check missing | failing | not run (skipped at mount) |
| ------------ | -------- | ----- | --------------------- | ------- | -------------------------- |
| keys-phase-1 | 2,381    | 2,381 | 0                     | 0       | 892                        |
| keys-phase-2 | 928      | 841   | 84                    | 3       | 44                         |
| gap-fill     | 433      | 390   | 42                    | 1       | 3                          |

Identical to the second comparison: the same 130 listed records with the same failing checks and missing checks. The 4 failing
records fail the fixed point only, and the base fails it too in each (`n2 QBT/QTBT/TBT afterBr0|ins a\nb`, `g3 space QT
selSpace`), as in the second comparison. The three changed records pass every check.

D7's state at the cmp steps (`d7state.json`): at R1, 65 undo and 9 redo checks that fail raw pass under D7 (`direction` and the
empty line, T85.1); 5 fail under D7, the g3 records of T67.1 whose first undo takes one of several edits (their HTML check fails
too, as at `a3bc7d8`). No R1 record fails D7's state where its HTML is restored.
