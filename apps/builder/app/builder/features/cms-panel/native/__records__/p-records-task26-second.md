# Task 26: the second comparison (T59.6, T60.3, T62.5, T67.1, T70 measurement 17, T77)

R1 at fork `a3bc7d8` (the same code as `745fb31`), compared against `<base>` `2a96a45`. Both builds were run afresh:
the seven record sets and check 5's probes, every run under `timeout 600`. The data is in
`__records__/acceptance/second/` (its README says how it was made). `0ae275f` is the acceptance run's R1, and
`6845516` is the first re-run's.

## Headline

- **Record sets: 19,477 records at each build.** None missing, none hung or crashed at R1, 44 hung at the base (the
  acceptance base had 49). **15,176 equal, 4,301 different** (`0ae275f`: 15,226 and 4,251).
  - 59 records went from equal to different. 54 of them are fixes:
    - 33 toolbar list-off records (defect 2, T71.2);
    - 18 `n2` rightQ records (T76.2);
    - 3 `k3` records (defect 9).

    The other 5 changed because the base record varied between the two runs.

  - 9 went from different to equal:
    - R4b pt2 (T76.3);
    - four S2b copy records and c1 S3 SEnd (defect 1);
    - two `d3 p-n` records (defect 10);
    - one base variation.
- **Labels: 4,301 differing records.**
  - 2,518 are confirmed by a program check of their stated relation.
  - 131 were read by hand or checked against a fix's ruled value. 125 are explained, 3 are unexplained and 3 are
    not named by D1.
  - 1,652 rest on a label with no program check (1,450) or one the check does not confirm (202). All 1,652 are
    unchanged at both builds since the acceptance run, where the check's readers read them. In this run they are
    **not explained** (T59.7).
- **T55.3, read per edit:**
  - 16,818 records in scope; 16,612 pass, 16 fail and 190 pass where they can be scored.
  - All 16 failures are the base's and ruled (T62.3).
  - The five `g3` records re-run with four undos give T67.1's counts at both builds.
- **Undo fields:**
  - against `6845516`, 83 records change, all from the fixes;
  - against the base, 2,737 records differ (2,675 lined, 62 ordinary).
- **T60.3:** 466 of 6,731 ordinary-content records differ. **3 differ in something D1's list does not name**: the
  caret after a drag that changes nothing (listed below).
- **Shapes R1 writes and the head never writes:** 213 records. Every write is a fixed point and reopens editable.
- **Measurement 17:** in all 653 records the page's selection and Lexical's selection are the same at both builds
  after every press. The value differences are 15.10 and its mirror (266) and 5.4's emptied rule (155), not 15.12.
- **Fixes (T63.5):** every defect record in the sets and probes shows its ruled value. One exception to T67.2's
  single count is listed under item 10.

## 1. Completeness

Each build's own records, and each build against its earlier run (base against the acceptance base; R1 against
`6845516` and `0ae275f`). The table per batch is `second/completeness.md`.

| set          | records each | equal | different | missing | hung base | hung R1 | base changed since acceptance | R1 changed since 6845516 |
| ------------ | ------------ | ----- | --------- | ------- | --------- | ------- | ----------------------------- | ------------------------ |
| toolbar      | 8146         | 5523  | 2623      | 0       | 5         | 0       | 11                            | 36                       |
| clipboard    | 831          | 746   | 85        | 0       | 16        | 0       | 0                             | 5                        |
| keys-phase-1 | 3688         | 2891  | 797       | 0       | 7         | 0       | 6                             | 12                       |
| keys-phase-2 | 1030         | 656   | 374       | 0       | 15        | 0       | 10                            | 33                       |
| gap-fill     | 545          | 346   | 199       | 0       | 1         | 0       | 2                             | 17                       |
| paste-matrix | 1972         | 1816  | 156       | 0       | 0         | 0       | 0                             | 0                        |
| paste-sweeps | 3265         | 3198  | 67        | 0       | 0         | 0       | 0                             | 2                        |
| **total**    | 19477        | 15176 | 4301      | 0       | 44        | 0       | 29                            | 105                      |

- paste-sweeps B's batch file holds 2,500 scenarios, and its engine records 1,825 at both builds, as at the
  acceptance run.
- The base's 44 hangs are the acceptance's batches. The base's other 29 changes since the acceptance run are clicks
  and DOM-selection steps that vary at the base (`status-changes.json`).
- Probes, base against R1:
  - 83 runs at each build, 42,922 records;
  - 13,191 equal, 8,887 differ:
    - 7,740 final values;
    - 132 steps between;
    - 355 the start character only;
    - 659 the onChange count only;
    - 1 final values equal but for the start character;
  - 20,844 on one side only. These are mostly base runs that the 600 s kill ended: 26 files, as in the acceptance
    run, including all of i6 and i6p.
- Probes, R1 at `0ae275f` against R1 now: 2,082 differ and 574 are on one side only (by file:
  `probes-changed-since-0ae275f.md`). Some of these are the probes' own timing fields.

## 2. Differing records: steps in full

- Every one of the 4,301 records in `differences.jsonl.gz` carries every differing step at both builds. Each step
  has its write, onChange count, caret, live HTML and note, with the cut's and copy's text/plain, text/html and
  editor data.
- Every undo and redo step carries `restores`: whether it equals the value before the action, or the write.
- Walk records carry both builds' stops in full. Paste-set records carry every differing field at both builds.

## 3. Shapes the head never writes

These are R1 writes in which a node holds a child sequence that no base value in the sets holds (a heading or a
quote holding only a line break, an empty heading, two adjacent code blocks in an item, a heading holding only an
image). Fixed point means that re-importing the write gives the same value. Reopens editable means that the field's
read-only check finds no reason.

| shape                               | records | fixed point | reopens editable |
| ----------------------------------- | ------- | ----------- | ---------------- |
| two adjacent code blocks in an item | 136     | 136         | 136              |
| heading holding only a line break   | 31      | 31          | 31               |
| quote holding only a line break     | 29      | 29          | 29               |
| empty heading (`<h2></h2>`)         | 16      | 16          | 16               |
| heading holding only an image       | 1       | 1           | 1                |

No other new shape was found.

## 4. Labels, the 14 corrections, and classes checked by program

The corrections are applied in `expl2.py` (SP): 957 records changed label. Each has its old and new label in the
data.

| correction                                                                                     | records |
| ---------------------------------------------------------------------------------------------- | ------- |
| C1: QTQ / QxLy over a range, to 5.4 and D5 (T55.4)                                             | 12      |
| C2: liEnd and ruleClick Block type, to D2 (T45.12)                                             | 41      |
| C3: QBR / QTR / CR d2 ruleClick, to 5.7's row with T73.1                                       | 14      |
| C4: Image over a range, to T41.2 with D3 and D5                                                | 19      |
| C5: Divider at a block's end or item end, to 5.7's Divider row                                 | 191     |
| C6: empty-block Backspace, Delete and Enter, to D3, D18, D19 and the Enter rows                | 202     |
| C7: G1's "loses or reorders", by their tested relation (emptied 106, QL row 42, D14 11)        | 159     |
| C8: G2's Block type (58), n2 liEnd (3), cutonly (15)                                           | 76      |
| C9: keys-phase-2's by-class records                                                            | 17      |
| C10: top-QpT Enter, to T19.2                                                                   | 1       |
| C11: g6 drags, g3 BRB, k2 QTR                                                                  | 4       |
| C12: A1 QC Image                                                                               | 1       |
| C13: k3 TBQ walk Left                                                                          | 1       |
| C14: group 11's label explains only the base's click; each record goes through the chain again | 219     |

- C5 is wider than the check's 116, because it takes every Divider record labelled D13 / 5.1 or "empty block".
- C7's reader table was not kept, so the classes were rebuilt from the relations the correction names.

Classes whose relation the program confirms, record by record:

| relation checked                                                                               | confirmed | not confirmed |
| ---------------------------------------------------------------------------------------------- | --------- | ------------- |
| focus kept: every step equal but the refocus step                                              | 1206      | 0             |
| D1's bar, read-only or not a fixed point at the base and not at R1                             | 210       | 2             |
| D7: the paste's state restored, only the page's DOM after undo differs                         | 206       | 0             |
| D15: R1's letter is the first text after the node-selected rule or image                       | 203       | 0             |
| D18: the walks' text stops equal, only element or node stops differ                            | 174       | 1             |
| 5.4 emptied (C7's class): R1's write is the head's with its emptied containers removed         | 106       | 0             |
| "the head leaves an empty block": R1's write is the head's with its emptied containers removed | 47        | 33            |
| D1 seventh entry: the image directly after the code block                                      | 50        | 20            |
| D1's bar: the head throws (console error), R1 does not                                         | 49        | 0             |
| D1's bar: the head loses or reorders, R1 does not (the R1 value is not checked by this)        | 46        | 132           |
| D1's bar: the head hangs or throws                                                             | 42        | 0             |
| D7 / 16.10: R1 hands out nothing, the head the stored value, every live value equal            | 39        | 0             |
| the head's letter after redo removes strictly more than R1's                                   | 28        | 17            |
| K8: the head's walk repeats a stop, R1's does not                                              | 25        | 0             |
| instrumentation only (every live value and comparison step equal)                              | 20        | 2             |
| D1's bar / D7: the head's undo or redo comparison fails, R1's passes                           | 20        | 6             |
| 16.10, D7: unchanged values where the counts differ                                            | 17        | 0             |
| D15: R1's arrow walk ends on the image's node selection                                        | 16        | 0             |
| D7: R1's DOM after undo equals the mount's                                                     | 8         | 0             |
| D3 third case: same write, R1's letter leaves one line break                                   | 5         | 0             |
| 5.4 emptied rule and D5 (C12)                                                                  | 1         | 0             |
| onChange count only                                                                            | 0         | 6             |

Records that changed since the acceptance check, checked by program against the ruled value of the fix that
changed them (92):

- 36 list-off records (defect 2, T71.2): the letter after undo and redo stands in its own paragraph beside the rule.
- 12 `k3` TCB, THB and TQB joins (defect 9): the write ends in the empty line's own break.
- 31 rightQ clicks (T76.2): the caret after the click is `Q0w@3`, and `k` and Backspace write `Q0wk` and `Q0`.
- 13 records unchanged at R1 since `0ae275f` whose base record varied between runs.

## 5. Read against the rule by hand (39), and records left unexplained

- Explained (33):
  - 12 toolbar Bold-over-range records: map 1 group 11 at the base's shift-click, then T55.4's removal over the
    range;
  - 2 `k2` walk Left records (group 11 at the base's click);
  - `k3` TRL walk Right (K8);
  - g5 blur QTR (the walk's stop only);
  - g5 undo5 QT (T56.1), g6 I1root-q click P (T56.2), and the 5 paste-sweeps E "(no join)" records (T56.3, named by
    T56.5);
  - the ordinary records read for T60.3 (r-C Image over a range, T43.2; p4 C13 and 4 `dlim` pastes, D1's emptied
    entry; 2 g5 blockNoRefocus, the focus entry; 2 g4 ROOT afterRule compositions, T67.2).
- **Unexplained (3):**
  - `g4|compose|QTR|afterRule|'a'` and `'a\nb'`: R1's three ArrowRight presses node-select the rule and the
    composition lands after it, while the base's presses stay in Q0w and it composes there. The head's result with
    the rule selected (T70.8, T73.3) is not in this record's data.
  - `g4|replace|QTR|T1w`: the code replace writes `Zz` at R1 and nothing at the base. No rule names it.
- **Not named by D1 (3, ordinary content):** `g6|I1root-q|arrow|drag`, `g6|I2li|arrow|drag`,
  `g6|I5root-p|arrow|drag`. Neither build writes anything. After the drag of the node-selected image, the base's
  caret is not the caret before and R1's is (`cmp post`: caret false at the base, true at R1). The acceptance
  check's correction C11 reads it as D7's redo caret. D1's list has no entry for it.
- **Not explained in this run (1,652):** the classes without a program check (by class D2, D3/D5/D9/D19, the 5.7
  Divider row, D18 / 5.7 clicks, D13, the QL row, D14) and the records whose label the program does not confirm.
  All of them have base and R1 records identical to the acceptance run's, where the check read them by class and
  by sample. They were not read again record by record.

## 6. T55.3's invariant, read per edit (T67.1)

| set          | in scope | pass  | fail | pass where scorable | not run (skipped at mount) |
| ------------ | -------- | ----- | ---- | ------------------- | -------------------------- |
| toolbar      | 7090     | 7090  | 0    | 0                   | 0                          |
| clipboard    | 799      | 787   | 12   | 0                   | 0                          |
| keys-phase-1 | 2381     | 2381  | 0    | 0                   | 892                        |
| keys-phase-2 | 928      | 841   | 3    | 84                  | 44                         |
| gap-fill     | 433      | 390   | 1    | 42                  | 3                          |
| paste-matrix | 1922     | 1922  | 0    | 0                   | 0                          |
| paste-sweeps | 3265     | 3201  | 0    | 64                  | 0                          |
| **total**    | 16818    | 16612 | 16   | 190                 | 939                        |

Each check is read as follows:

- **Undo** reaches the value before in as many presses as the step holds edits that change the value, where a run
  of letters or of plain Backspace or Delete counts once at least and every key at most, and every press before that
  changes the value.
- **Redo** gives the value after n − m undos (the write when m = n).
- The write is a **fixed point** and reopens editable.
- There is **no console error**.

The failures:

- 12 clipboard `p5` drags take two undos at both builds (C12);
- 3 `n2 … afterBr0 | ins a\nb` records are not fixed points at both builds (K17);
- `g3|space|QT|selSpace`: the lone space is dropped at both builds.

All 16 are T62.3's.

- The five `g3` multi-key records press undo once, so they cannot be scored from their records. Re-run with four
  undos and four redos at both builds (`g3-per-edit.json`), they give `br2` 2 undos, `adj` 3, `Bksp3Enter` 3,
  `Bksp3k` 3 and `Bksp3` 2: T67.1's counts, equal at both builds. Every press changes the value, and the last redo
  equals the write.
- "Pass where scorable" covers scenarios with no undo or redo step (74 n1/n2 records and 16 gap-fill `stored`
  records), and the 64 paste-sweeps B records, which have no undo fields.

## 7. The undo-field re-compare

- **Against `6845516`: 83 records change, all of them in records the fixes changed:**
  - toolbar 36 (the list-off letter, T65.3, T71.2);
  - keys-phase-1 12 (defect 9);
  - keys-phase-2 32 (T76.2's rightQ);
  - clipboard 1 (R4b pt2, T76.3);
  - paste-sweeps 2 (defect 10).
- **Against the base: 2,737 records differ in an undo field** (2,675 lined, 62 ordinary):
  - toolbar 1,480;
  - clipboard 67;
  - keys-phase-1 606;
  - keys-phase-2 227;
  - gap-fill 139;
  - paste-matrix 156;
  - paste-sweeps 62.

  These fields include the redo, the typed letter and the comparison notes, so this counts more than T62.5's 26.
  The records are in `undo-vs-base.jsonl.gz`.

## 8. T60.3: ordinary content

- 6,731 ordinary-content records: the stored value holds no lined container, as `explain.py` decides.
- 466 differ from the base in any compared field or the undo step count:
  - 394 focus kept (listed);
  - 24 D1's bar, read-only or not a fixed point;
  - 12 16.10's carve-out (listed);
  - 6 D1's bar, undo or redo;
  - 4 emptied (listed);
  - 3 the seventh entry (listed);
  - 3 D1's bar, loses or reorders;
  - 1 5.4 emptied (listed);
  - the 16 read by hand in section 5;
  - the 3 below.
- **The number that differ in anything D1's list does not name: 3.** All three are the g6 drags in section 5:
  `g6|I1root-q|arrow|drag`, `g6|I2li|arrow|drag` and `g6|I5root-p|arrow|drag`.
- The acceptance labelled two of them "the probe counts line nodes". That label's program check now also compares
  the comparison steps, and finds the caret difference.

## 9. T62.5: undo HTML differs while both builds restore

Four records (`t625.jsonl` has the values):

- `R::ul-d1|r-Qpr|Pw->Nw|LnRm`, `X1w->Nw|LnRm` and `ctrlA|LnRm`: the value before the action differs (at the base the
  link wraps the rule, D10). Each build's undo restores its own value before.
- `p4::C13 parent text->nested`: the base's value before holds an empty `<li></li>` that R1's does not. Both undos
  restore.

## 10. Measurement 17 (T70.10)

- The probe re-ran the 651 differing i2r records and Z2-O-rule-keys (typed form, `a` and `abc`) at both builds,
  reading the page's selection (DOM anchor, focus and active element) and Lexical's selection after the click and
  after each press, with Shift held as in the original.
- **The page's and Lexical's selections are identical at both builds after every press in all 653 records.**
- 232 records are equal in value too. In 421 the value after the action differs:
  - 266 are 15.10 and its mirror: the range ends at the root's element point before the rule; the head loses the
    rule and what follows, or writes nothing; R1 acts on the range.
  - 155 are 5.4's emptied rule: the head leaves an emptied quote.
- So these records are not 15.12, and they are not an unlisted change of ordinary content: they are 15.10, which D1
  lists, and 5.4. The one-character difference the check saw is not in the selection.
- The IME form of Z2-O-rule-keys was not re-run, because it needs the hist kit's composition driver.

## 11. The fixes since `0ae275f` in their records (T63.5)

| defect                                | where                                                                    | R1 now                                                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 text/plain                          | p4 S2b ×4, c1 S3 SEnd                                                    | equal to the base                                                                                                                                                                                     |
|                                       | clip-d rec-2, 3, 34, 35                                                  | the base's text/plain (`\nB`, `\nN`)                                                                                                                                                                  |
|                                       | rec-18, 19 and clip-x 3#7, 3#8                                           | one new line fewer than the base, as T65.2 rules                                                                                                                                                      |
|                                       | nav-w1 cut walks                                                         | stop 1 holds `\n`, the base's                                                                                                                                                                         |
| 2 list off after a rule               | toolbar B QBR/QTR liEnd UL, D CR d2 liEnd UL                             | `…<hr /><p>k</p><p>Nw</p>`                                                                                                                                                                            |
| 3 (withdrawn, T71.1)                  | insert-skeptic x5 image QR/QRQ                                           | rule node-selected; the image goes to the document's end, as the head with a rule selected (the base's fifth stop is another caret)                                                                   |
| 4 heading after a code block          | keys i3ba, i3bwda, i3h, i3sub, i3bb, i3bwdb bwd heading code img/linkOut | 0 calls, no write, in all 72 backward cells                                                                                                                                                           |
| 5 Backspace at a heading-leading link | i3h, i3sub, i3bb, i3bwdb contentStart linkIn/linkBold                    | 0 calls in all 10 cells                                                                                                                                                                               |
| 6 composition after a backward range  | comp-e G-_-sleft/sup, comp-skeptic-v F2-_, comp-x X1n/X1z elsewhere      | one undo from `Aab1w` to the value before, equal to the forward twin; 7 calls, the forward twin's                                                                                                     |
| 7 the start character                 | comp-x X4z-includes-fwd/bwd                                              | no value holds U+200B                                                                                                                                                                                 |
| 9 the empty line in a join            | k3 TCB, THB (and TQB)                                                    | `T0wH1w<br /><br />`, `T0wC1w<br /><br />`, the range form `Tkw<br /><br />`                                                                                                                          |
| 10 tail join                          | paste-sweeps B d3 p-n ol HT, quote ul HT                                 | `<li><hr />T1q1q</li>`, equal to the base                                                                                                                                                             |
| 11 cut beside a leading image         | clip-d rec-48                                                            | copyShape `t`, the base's; the paste back restores                                                                                                                                                    |
| 12 P26-1                              | insert zzq1 B QA, four cells                                             | undo1 restores (the earlier edit kept), redo restores the join                                                                                                                                        |
| T67.2 compositions                    | g4 compose, 26 records                                                   | 1 call for `'a'` and 3 for `'a\nb'` in 25 records; **`g4\|compose\|TQT\|Q1w@1\|'a\nb'` gives 2** (base 4). This is the one record that does not show a single count of 3; it is listed, not explained |
| T70.11 / T76.2                        | n2 rightQ                                                                | caret `Q0w@3`; `Q0wk`, `Q0`, and Delete as D3 rules                                                                                                                                                   |
| T76.3 R4b pt2                         | clipboard p2                                                             | equal to the base                                                                                                                                                                                     |
| T75 / T78.1                           | (second Shift+Home, Shift+Home from `U1w@0`)                             | not in the sets: the probes press Shift+Home once, from `U1w@1` and `@3`                                                                                                                              |

- Defect 8 was not one (T59.3).
- clip-d rec-2 and rec-3 have `pasteRestores` false at R1 and at `0ae275f`, and true at the base. No defect names it,
  and it is left as recorded.

## What the run could not do

- **Probe classes were not re-read.** The 8,887 differing probe records were not classified beyond the defect
  records and measurement 17.
- **Base probe runs did not finish.** 26 base probe files still end at the 600 s budget, so 20,844 probe records
  exist at R1 only.
- **Label classes without a program check were not read record by record.** That is 1,652 records, all unchanged
  since the acceptance check.
- **Not measured:**
  - Z2-O-rule-keys' IME form;
  - the head's composition at the g4 QTR afterRule record's own node selection;
  - the cause of the g4 replace record's no-op at the base.
