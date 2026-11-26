# T55.3: the record sets at R1 `6845516` (undo re-compare and the undo invariant)

Measured 2026-11-26. Nothing committed; no tracked file changed. R1 = `origin/claude/native-cms-r1-lines` at `6845516` (includes T55.1, `cb077e5`), checked out detached in the agent worktree, `pnpm install --frozen-lockfile`. Base = `2a96a45` (its records are the acceptance run's, `SP/acceptance/sets/<set>/out/base-*.json`, not re-run). "0ae275f" = the acceptance run's R1 records (`head-*.json`).

Paths below: `SP` = `/tmp/claude-0/-home-user-OrganizeOS-Websites/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad`, `T` = `SP/t553`.

## Summary

- **A.** All seven record sets re-run at `6845516`: 19,477 records, every record id present, **0 hung, 0 crashed**.
- **B.** Undo fields, `0ae275f` against `6845516`: **0 records change**, in all 19,477. That covers the undo HTML, the redo HTML, the letter typed after undo and redo, the onChange counts at undo, redo and the typed letter, the undo step count and the `cmp` results. So no record shows the T55.1 rule. Across every compared field, 3 records differ between the two R1 builds, none of them in an undo field:
  - 2 gap-fill compositions change their onChange count at the compose step;
  - 1 is a map 1 group 11 click.

  Against the base, the equal/different counts match `0ae275f` exactly in every set.

- **C.** T55.3 invariant at `6845516`:
  - **16,818 records in scope** (write differs from stored under `tidy`). **16,612 pass** all four checks.
  - **21 fail** (17 on undo, 4 on fixed point; 0 on redo, 0 with a console error).
  - 18 of the 21 have the same write at the base and fail the same check there.
  - The other 3 are gap-fill g3 multi-keystroke records, whose write at the base differs.
  - **185 in-scope records** pass every check they can be scored on, but the scenario lacks a field for at least one check (listed in C below).
- **D. Ordinary content, undo vs the base:** 26 records in ordinary content differ from the base in the undo step count, the undo HTML or the onChange count at undo.
- **E. Ruling T60.3, ordinary content, every compared field plus the undo step count:**
  - **468 of 6,731** ordinary-content records differ from the base.
  - **400 of them differ in something D1's list (with T45.16, T46.9, T48.2, T13.1) does not name**, by my mapping. That is 394 "focus kept after a toolbar control closes" and 6 unexplained.
  - 25 more rest only on the acceptance classifier's "to confirm" flags: 20 "D1's bar?" and 5 "listed?".

## How the runs were made (A)

- **Driver:** `T/scripts/gdrive553.py`, a copy of `acceptance/gdrive.py` with three changes: the checkout is the agent worktree, outputs go to `T/sets/<set>/out/r1-<batch>.json` with logs `log-r1-<batch>.txt`, and the side name is `r1`. Everything else is the same: `timeout -s KILL 600` per vitest run, a 40 s per-scenario stall watchdog, resume after a stall or a budget kill, project `core-browser-builder-cms`, and the same engines, harnesses and batch files (`acceptance/sets/<set>/{src,gen}`).
- **Scratch:** the scratch directories were `native/zzacc-<set>`. The name is kept because the gap-fill engine hard-codes `zzacc-gap-fill` for its image. All of them were removed afterwards, and `git status` is clean.
- **Batches:** run in three chains, `T/scripts/l1..l3.txt` via `chain.sh`. The machine's load average was 12 to 24 throughout because other agents were running.
- **Runs discarded:** a fourth chain (`l4`) ran toolbar D in the same `zzacc-toolbar` directory as l1's toolbar batches. l1's end-of-batch cleanup deleted D's batch file, so l4 looped (202 "hung", 342 runs), and later overwrote l1's D output.
  - That D output and log are moved to `T/discarded/`.
  - Toolbar D was then re-run alone (`l5`): 1,458 records, 0 hung, 3 runs.
  - The other toolbar batches each finished in their own run with 0 hung, and their record files are their own.
- **Budget kills:** 8 runs over all sets ended by the 600 s budget or a vitest exit and were resumed at the scenario in progress (as at the acceptance run). No scenario hit the budget twice.
- **Fixture port:** the gap-fill fixture image's URL holds the dev server's port, which changes between runs. All comparisons here replace `http://localhost:<port>/` with `http://localhost:PORT/` (`lib553.portnorm`).
  - Without this, 174 gap-fill records appear to change. With it applied to the acceptance records, the acceptance's base comparison counts are unchanged.

| set          | records | hung | crashed | missing vs base |
| ------------ | ------- | ---- | ------- | --------------- |
| toolbar      | 8146    | 0    | 0       | 0               |
| clipboard    | 831     | 0    | 0       | 0               |
| keys-phase-1 | 3688    | 0    | 0       | 0               |
| keys-phase-2 | 1030    | 0    | 0       | 0               |
| gap-fill     | 545     | 0    | 0       | 0               |
| paste-matrix | 1972    | 0    | 0       | 0               |
| paste-sweeps | 3265    | 0    | 0       | 0               |

## B. Undo fields, `0ae275f` against `6845516`

How the fields are read (`T/scripts/lib553.py`):

- **Engine sets** (toolbar, clipboard, keys, gap-fill). Every value is the trace's `live`, the sanitised export, which equals `an.write` in all 15,972 `an` steps.
  - The undo run starts at the first `{Control>}z{/Control}` and is followed by the redo run.
  - The record keeps, for each press, its HTML and the onChange calls that press made.
  - "Typed after" is the first letter step after the redo run (`typeK`, or a one-letter `key`), with its HTML and call count.
  - The `cmp` notes are kept with their results.
  - "Value before the write" is the `snap` named by the first `cmp` after the first undo.
  - The undo step count is the number of undo presses until the HTML equals that snapshot (null if it never does).
- **Paste sets.** The fields are `undoState`, `undoDom`, `undoChanges`, `redoOk`, `redoChanges`, `typed`, `typedOk`, `typeChanges`, `afterUndo` and `undone`.

Records whose undo fields change between the two builds, by set:

| set          | undo fields equal |
| ------------ | ----------------- |
| toolbar      | 8146              |
| clipboard    | 831               |
| keys-phase-1 | 3688              |
| keys-phase-2 | 1030              |
| gap-fill     | 545               |
| paste-matrix | 1972              |
| paste-sweeps | 3265              |

**No record changes** in any undo field, so no record carries the label "T55.1: a merged commit that changes the D7 document is its own undo step", and none is flagged. The record sets do not reach a commit that Lexical's HistoryPlugin merged while the D7 document changed, or they reach one only where the merge made no difference.

Every compared field (`compare.py`'s `sig_engine` / `sig_case`), `0ae275f` against `6845516` (`T/old-vs-new-full.json`; differences in `T/old-vs-new-full-differences.jsonl.gz`, the real ones in `T/old-vs-new-real.jsonl`):

| set          | equal | different | of which timing only | real |
| ------------ | ----- | --------- | -------------------- | ---- |
| toolbar      | 8146  | 0         | 0                    | 0    |
| clipboard    | 831   | 0         | 0                    | 0    |
| keys-phase-1 | 3528  | 160       | 160                  | 0    |
| keys-phase-2 | 1021  | 9         | 8                    | 1    |
| gap-fill     | 543   | 2         | 0                    | 2    |
| paste-matrix | 1972  | 0         | 0                    | 0    |
| paste-sweeps | 3265  | 0         | 0                    | 0    |

- **"Timing only":** the walk note's `kms`, the ms a letter took at a walk stop. `compare.py`'s `norm_note` drops `ms` but not `kms`. Against the base, no record differs in `kms` alone (`T/kms-only.json`), so the acceptance counts are not affected.
- **keys-phase-2 `n3::ul-d1|QBR|g11 click Pw#1`:** the `domsel` after the click reads `<li>[3]@2` at `0ae275f` and `null@0` at `6845516`. This is map 1 group 11's nondeterministic click; the write and undo fields are equal.
- **gap-fill `g4::g4|compose|ROOT|afterRule|'a'` and `...|'a\nb'`:** stored `<p>T0w</p><hr><p>Nw</p>`, a composition at the paragraph after a node-selected rule.
  - The compose step's onChange calls go from 2 to 1 and from 4 to 3. The base makes 3 and 5.
  - The write, the undo (it restores, 1 step, 1 call), the redo and the typed letter are equal at both R1 builds.
  - This is the composition start character (T46.3, T48.2: R1 hands out the composed value once). Whether the change from `0ae275f` comes from T55.1 or from run-to-run variation, these two records do not show.

### 6845516 against the base (every compared field, acceptance rules, k3 included)

| set          | different | equal |
| ------------ | --------- | ----- |
| toolbar      | 2590      | 5556  |
| clipboard    | 90        | 741   |
| keys-phase-1 | 794       | 2894  |
| keys-phase-2 | 353       | 677   |
| gap-fill     | 199       | 346   |
| paste-matrix | 156       | 1816  |
| paste-sweeps | 69        | 3196  |

The counts are the same as `0ae275f` against the base in every set (t55-b's corrected comparison): toolbar 5556 / 2590, clipboard 741 / 90, keys-phase-1 2894 / 794, keys-phase-2 677 / 353, gap-fill 346 / 199, paste-matrix 1816 / 156, paste-sweeps 3196 / 69. In all: **15,226 equal, 4,251 different**.

No record changes status (equal or different) between `0ae275f` and `6845516`.

## C. The T55.3 invariant at 6845516

**Scope:** a record is in scope when its write differs from the stored value under `tidy` (`<hr>` and `<br>` forms, `<img>` attributes; the canonical form `explain.py` uses).

- **Engine sets:**
  - The write is the last `an` note before the first undo.
  - An `an` note of `none` (no onChange) is out of scope as "no write".
  - Records the engine skipped are out of scope.
- **Paste sets:**
  - The write is `written`, with "(no change)" counted as no write.
  - The stored value comes from the case lists (`T/cases/stored.json`, dumped from `zzr9-m-cases.ts` and `zzr10-beh-w-cases.ts`; ids matched by index, 0 mismatches).
  - For sweeps E, the write is `after`, the value after the edit that follows the paste.

**The four checks:**

1. **Undo.**
   - Engine sets: the first undo's HTML equals the snapshot before the write.
   - Paste sets: `undoState` or `undoDom` is true. Neither one is the value; there is no undo-value field.
2. **Redo.**
   - Engine sets: the last redo of the redo run equals the write.
   - Paste sets: `redoOk`.
3. **Fixed point.**
   - Engine sets: the write's `an.fixedPoint` is true and `readOnly` is falsy.
   - Paste sets: `reloadHeadless` is true, `reloadReadOnly` is false and `reloadChanges` is 0.
4. **No console error.** The record's errors and every step's `newErrors`, with React act warnings left out.

**Fields missing in some sets (not guessed):**

- **paste-sweeps, batch E (64 records):** no undo field (`undoState` / `undoDom`), no `redoOk`, and no fixed-point field (`reloadHeadless` / `reloadChanges`). The edit-after-paste cases record only `after` and the caret, plus `undone` on the 8 `undoRedo` edits.
- **paste-matrix, paste-sweeps A, B and C:** no undo HTML. The undo check is the `undoState` / `undoDom` booleans only.
- **keys-phase-2:**
  - 74 in-scope records have no undo step (the `domsel` / `bi` / headless scenarios).
  - 10 have an undo but no redo.
- **gap-fill:**
  - 16 in-scope records have no undo step.
  - 13 have no snapshot named by a `cmp` after the undo, so there is no value-before-write to compare with.
  - 21 have no redo step.
- **keys-phase-1:** walk records (244) have no undo. All of them are "no write", so out of scope.

Counts by set:

| count                                                                         | toolbar | clipboard | keys-phase-1 | keys-phase-2 | gap-fill | paste-matrix | paste-sweeps | all   |
| ----------------------------------------------------------------------------- | ------- | --------- | ------------ | ------------ | -------- | ------------ | ------------ | ----- |
| candidate: C12                                                                | 0       | 12        | 0            | 0            | 0        | 0            | 0            | 12    |
| candidate: as at the base (same write; the base's value fails the same check) | 0       | 0         | 0            | 3            | 1        | 0            | 0            | 4     |
| candidate: script                                                             | 0       | 0         | 0            | 0            | 5        | 0            | 0            | 5     |
| fail 1-undo                                                                   | 0       | 12        | 0            | 0            | 5        | 0            | 0            | 17    |
| fail 3-fixedPoint                                                             | 0       | 0         | 0            | 3            | 1        | 0            | 0            | 4     |
| failing records                                                               | 0       | 12        | 0            | 3            | 6        | 0            | 0            | 21    |
| in scope                                                                      | 7090    | 799       | 2381         | 928          | 433      | 1922         | 3265         | 16818 |
| missing field: fixedPoint (no reloadHeadless/reloadChanges field)             | 0       | 0         | 0            | 0            | 0        | 0            | 64           | 64    |
| missing field: redo (no redo step in the scenario)                            | 0       | 0         | 0            | 10           | 21       | 0            | 0            | 31    |
| missing field: redo (no redoOk field)                                         | 0       | 0         | 0            | 0            | 0        | 0            | 64           | 64    |
| missing field: undo (no snapshot before the write)                            | 0       | 0         | 0            | 0            | 13       | 0            | 0            | 13    |
| missing field: undo (no undoState/undoDom field)                              | 0       | 0         | 0            | 0            | 0        | 0            | 64           | 64    |
| missing field: undo/redo (no undo step in the scenario)                       | 0       | 0         | 0            | 74           | 16       | 0            | 0            | 90    |
| not run (skipped)                                                             | 0       | 0         | 892          | 44           | 3        | 0            | 0            | 939   |
| out of scope: no write                                                        | 622     | 26        | 386          | 56           | 103      | 50           | 0            | 1243  |
| out of scope: write == stored                                                 | 434     | 6         | 29           | 2            | 6        | 0            | 0            | 477   |
| pass                                                                          | 7090    | 787       | 2381         | 841          | 390      | 1922         | 3201         | 16612 |
| passing checks present, some field missing                                    | 0       | 0         | 0            | 84           | 37       | 0            | 64           | 185   |

### Failing records (21)

Also in `T/t553-failing.jsonl`, with each record's `actions`, `undoSteps`, `baseSameWrite` and `baseFailsSame`. Each record's candidate is a suggestion, not a decision.

- **12 clipboard p5 drags.** The first undo restores after the drag's removal half; the second undo restores the value before. So undo takes 2 steps. The base is the same (same write, 2 steps).
  - Candidate ruling: C12, drag is two undo steps.
  - 4 of them are in lined containers, 8 in ordinary content.
- **3 keys-phase-2 records** (`n2 ...|afterBr0|ins a\nb`). An `insertText` of "a\nb" after a line break leaves a raw newline in the text, which the headless writer turns into a space, so the value is not a fixed point. The base gives the same write and the same failure.
  - Candidate: as at the base. This is D1's bar ("not a fixed point") at the head, which R1 does not fix. It is a P record unless a ruling covers it.
- **5 gap-fill g3 records.** One step sends several keystrokes (`{Backspace}x3/x4`, `{Shift>}{Enter}{Enter}`, `Bksp x3 + Enter/k`), and the scenario presses undo once.
  - The single undo takes back only the last keystroke, which is its own undo step, so it cannot restore the snapshot.
  - 2 of the 5 have the same write at the base and fail the same way there. 3 have a different write at the base (the acceptance labels these "D1's bar / D7: the head's undo or redo does not restore").
  - Candidate: the scenario's shape, each keystroke its own step (as 16.27's join-is-its-own-step). It is a P record if a single step is expected.
- **1 gap-fill record** (`g3|space|QT|selSpace`). The write ends a line with a lone space, which the headless writer drops: not a fixed point. The base is the same.
  - Candidate: as at the base, or a P record.

#### clipboard (12)

- `p5::D0 ref paragraphs` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined False; stored `<p>abqcdq</p><p>efq</p>`; write `<p>qcdq</p><p>eabfq</p>`; 1-undo `{"pre": "<p>abqcdq</p><p>efq</p>", "undo1": "<p>qcdq</p><p>efq</p>", "undoLives": ["<p>qcdq</p><p>efq</p>", "<p>abqcdq</p><p>efq</p>", "<p>abqcdq</p><p>efq</p>"], "undoSteps": 2, "undoCalls": [1, 1, 0]}`
- `p5::D10 paragraph->item` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined False; stored `<p>rrq</p><ul><li>abq</li></ul>`; write `<p>q</p><ul><li>arrbq</li></ul>`; 1-undo `{"pre": "<p>rrq</p><ul><li>abq</li></ul>", "undo1": "<p>q</p><ul><li>abq</li></ul>", "undoLives": ["<p>q</p><ul><li>abq</li></ul>", "<p>rrq</p><ul><li>abq</li></ul>", "<p>rrq</p><ul><li>abq</li></ul>"], "undoSteps": 2, "undoCalls": [1, 1, 0]}`
- `p5::D11 into TQT block` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined True; stored `<ul><li>abqcdq</li><li>xq<blockquote><p>qqq</p></blockquote>yq</li></ul>`; write `<ul><li>qcdq</li><li>xq<blockquote><p>qabqq</p></blockquote>yq</li></ul>`; 1-undo `{"pre": "<ul><li>abqcdq</li><li>xq<blockquote><p>qqq</p></blockquote>yq</li></ul>", "undo1": "<ul><li>qcdq</li><li>xq<blockquote><p>qqq</p></blockquote>yq</li></ul>", "undoLives": ["<ul><li>qcdq</li><li>xq<blockquote><p>qqq</p></blockquote>yq</li></ul>", "<ul>...`
- `p5::D12 quote->its list` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined False; stored `<blockquote><p>ppq</p><ul><li>l1q</li></ul></blockquote>`; write `<blockquote><p>q</p><ul><li>lpp1q</li></ul></blockquote>`; 1-undo `{"pre": "<blockquote><p>ppq</p><ul><li>l1q</li></ul></blockquote>", "undo1": "<blockquote><p>q</p><ul><li>l1q</li></ul></blockquote>", "undoLives": ["<blockquote><p>q</p><ul><li>l1q</li></ul></blockquote>", "<blockquote><p>ppq</p><ul><li>l1q</li></ul></blockqu...`
- `p5::D1b within item to other text node` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined False; stored `<ul><li>abqcdq<b>bbq</b></li></ul>`; write `<ul><li>qcdq<b><strong>bb</strong></b>ab<b><strong>q</strong></b></li></ul>`; 1-undo `{"pre": "<ul><li>abqcdq<b><strong>bbq</strong></b></li></ul>", "undo1": "<ul><li>qcdq<b><strong>bbq</strong></b></li></ul>", "undoLives": ["<ul><li>qcdq<b><strong>bbq</strong></b></li></ul>", "<ul><li>abqcdq<b><strong>bbq</strong></b></li></ul>", "<ul><li>abqc...`
- `p5::D1c within paragraph backward` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined False; stored `<p>abqcdq</p>`; write `<p>dqabqc</p>`; 1-undo `{"pre": "<p>abqcdq</p>", "undo1": "<p>abqc</p>", "undoLives": ["<p>abqc</p>", "<p>abqcdq</p>", "<p>abqcdq</p>"], "undoSteps": 2, "undoCalls": [1, 1, 0]}`
- `p5::D2 across items` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined False; stored `<ul><li>abqcdq</li><li>efq</li></ul>`; write `<ul><li>qcdq</li><li>eabfq</li></ul>`; 1-undo `{"pre": "<ul><li>abqcdq</li><li>efq</li></ul>", "undo1": "<ul><li>qcdq</li><li>efq</li></ul>", "undoLives": ["<ul><li>qcdq</li><li>efq</li></ul>", "<ul><li>abqcdq</li><li>efq</li></ul>", "<ul><li>abqcdq</li><li>efq</li></ul>"], "undoSteps": 2, "undoCalls": [1,...`
- `p5::D3 into quote` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined False; stored `<ul><li>abqcdq</li></ul><blockquote><p>zzq</p></blockquote>`; write `<ul><li>qcdq</li></ul><blockquote><p>zabzq</p></blockquote>`; 1-undo `{"pre": "<ul><li>abqcdq</li></ul><blockquote><p>zzq</p></blockquote>", "undo1": "<ul><li>qcdq</li></ul><blockquote><p>zzq</p></blockquote>", "undoLives": ["<ul><li>qcdq</li></ul><blockquote><p>zzq</p></blockquote>", "<ul><li>abqcdq</li></ul><blockquote><p>zzq<...`
- `p5::D4 into block-led run` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined True; stored `<ul><li>abqcdq</li><li><blockquote><p>bq</p></blockquote>t1q</li></ul>`; write `<ul><li>qcdq</li><li><blockquote><p>bq</p></blockquote>tab1q</li></ul>`; 1-undo `{"pre": "<ul><li>abqcdq</li><li><blockquote><p>bq</p></blockquote>t1q</li></ul>", "undo1": "<ul><li>qcdq</li><li><blockquote><p>bq</p></blockquote>t1q</li></ul>", "undoLives": ["<ul><li>qcdq</li><li><blockquote><p>bq</p></blockquote>t1q</li></ul>", "<ul><li>ab...`
- `p5::D5 item block text` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined True; stored `<ul><li>xq<blockquote><p>qqq</p></blockquote>yq</li><li>nnq</li></ul>`; write `<ul><li>xq<blockquote><p>q</p></blockquote>yq</li><li>nqqnq</li></ul>`; 1-undo `{"pre": "<ul><li>xq<blockquote><p>qqq</p></blockquote>yq</li><li>nnq</li></ul>", "undo1": "<ul><li>xq<blockquote><p>q</p></blockquote>yq</li><li>nnq</li></ul>", "undoLives": ["<ul><li>xq<blockquote><p>q</p></blockquote>yq</li><li>nnq</li></ul>", "<ul><li>xq<bl...`
- `p5::D6 whole TQT item` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined True; stored `<ul><li>xxq<blockquote><p>qq</p></blockquote>yyq</li><li>nnq</li></ul>`; write `<ul><li></li><li>nxxq</li></ul><blockquote><p>qq</p></blockquote><p>yyqnq</p>`; 1-undo `{"pre": "<ul><li>xxq<blockquote><p>qq</p></blockquote>yyq</li><li>nnq</li></ul>", "undo1": "<ul><li></li><li>nnq</li></ul>", "undoLives": ["<ul><li></li><li>nnq</li></ul>", "<ul><li>xxq<blockquote><p>qq</p></blockquote>yyq</li><li>nnq</li></ul>", "<ul><li>xxq<...`
- `p5::D9 within TQT across block` - fails 1-undo; candidate: C12: drag is two undo steps (undo restores after 2 presses); lined True; stored `<ul><li>xxq<blockquote><p>qq</p></blockquote>yyq</li></ul>`; write `<ul><li>q<blockquote><p>qq</p></blockquote>yxxyq</li></ul>`; 1-undo `{"pre": "<ul><li>xxq<blockquote><p>qq</p></blockquote>yyq</li></ul>", "undo1": "<ul><li>q<blockquote><p>qq</p></blockquote>yyq</li></ul>", "undoLives": ["<ul><li>q<blockquote><p>qq</p></blockquote>yyq</li></ul>", "<ul><li>xxq<blockquote><p>qq</p></blockquote>y...`

#### keys-phase-2 (3)

- `n2::ul-d1|QBT|afterBr0|ins a\nb` - fails 3-fixedPoint; candidate: as at the base (same write; the base's value fails the same check): D1 keeps the head's result unless the bar names it - P record or an existing ruling; lined True; stored `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br>T2w</li><li>Nw</li></ul>`; write `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br />a
bT2w</li><li>Nw</li></ul>`; 3-fixedPoint `{"fixedPoint": false, "readOnly": null, "headless": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br />a bT2w</li><li>Nw</li></ul>"}`; base-comparison label: D1's bar: the head's value reopens read-only or is not a fixed point
- `n2::ul-d1|QTBT|afterBr0|ins a\nb` - fails 3-fixedPoint; candidate: as at the base (same write; the base's value fails the same check): D1 keeps the head's result unless the bar names it - P record or an existing ruling; lined True; stored `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<br>T3w</li><li>Nw</li></ul>`; write `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<br />a
bT3w</li><li>Nw</li></ul>`; 3-fixedPoint `{"fixedPoint": false, "readOnly": null, "headless": "<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<br />a bT3w</li><li>Nw</li></ul>"}`; base-comparison label: D1's bar: the head's value reopens read-only or is not a fixed point
- `n2::ul-d1|TBT|afterBr0|ins a\nb` - fails 3-fixedPoint; candidate: as at the base (same write; the base's value fails the same check): D1 keeps the head's result unless the bar names it - P record or an existing ruling; lined False; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; write `<ul><li>Pw</li><li>T0w<br />a
bT2w</li><li>Nw</li></ul>`; 3-fixedPoint `{"fixedPoint": false, "readOnly": null, "headless": "<ul><li>Pw</li><li>T0w<br />a bT2w</li><li>Nw</li></ul>"}`

#### gap-fill (6)

- `g3::g3|adj|TQT|Q1w whole Bksp x2` - fails 1-undo; candidate: script: one step sends 4 keystrokes (key:{Backspace}{Backspace}{Backspace}{Backspace}), each its own undo step; the scenario presses undo once; lined True; stored `<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>`; write `<ul><li>Pw</li><li>T0wT2w</li><li>Nw</li></ul>`; 1-undo `{"pre": "<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>", "undo1": "<ul><li>Pw</li><li>T0w<blockquote></blockquote>T2w</li><li>Nw</li></ul>", "undoLives": ["<ul><li>Pw</li><li>T0w<blockquote></blockquote>T2w</li><li>Nw</li></...`; base-comparison label: D1's bar / D7: the head's undo or redo does not restore
- `g3::g3|br2|QT|selShiftEnter2` - fails 1-undo; candidate: script: one step sends 2 keystrokes (key:{Shift>}{Enter}{Enter}{/Shift}), each its own undo step; the scenario presses undo once; lined True; stored `<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>`; write `<ul><li><blockquote><p>Q0w</p></blockquote><br /><br /></li><li>Nw</li></ul>`; 1-undo `{"pre": "<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>", "undo1": "<ul><li><blockquote><p>Q0w</p></blockquote><br /></li><li>Nw</li></ul>", "undoLives": ["<ul><li><blockquote><p>Q0w</p></blockquote><br /></li><li>Nw</li></ul>"], "undoStep...`; base-comparison label: the probe counts line nodes (instrumentation only): same write, same typed letter
- `g3::g3|emptyLine-enter|QT|Bksp3Enter` - fails 1-undo; candidate: script: one step sends 4 keystrokes (key:{Backspace}{Backspace}{Backspace}{Enter}), each its own undo step; the scenario presses undo once; lined True; stored `<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>`; write `<ul><li><blockquote><p>Q0w</p></blockquote></li><li></li><li>Nw</li></ul>`; 1-undo `{"pre": "<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>", "undo1": "<ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>", "undoLives": ["<ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>"], "undoSteps": null, "u...`; base-comparison label: D1's bar / D7: the head's undo or redo does not restore
- `g3::g3|emptyLine-k|QT|Bksp3k` - fails 1-undo; candidate: script: one step sends 4 keystrokes (key:{Backspace}{Backspace}{Backspace}k), each its own undo step; the scenario presses undo once; lined True; stored `<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>`; write `<ul><li><blockquote><p>Q0w</p></blockquote>k</li><li>Nw</li></ul>`; 1-undo `{"pre": "<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>", "undo1": "<ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>", "undoLives": ["<ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>"], "undoSteps": null, "u...`; base-comparison label: D1's bar / D7: the head's undo or redo does not restore
- `g3::g3|emptyLine|QT|Bksp3` - fails 1-undo; candidate: script: one step sends 3 keystrokes (key:{Backspace}{Backspace}{Backspace}), each its own undo step; the scenario presses undo once; lined True; stored `<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>`; write `<ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>`; 1-undo `{"pre": "<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>", "undo1": "<ul><li><blockquote><p>Q0w</p></blockquote>T</li><li>Nw</li></ul>", "undoLives": ["<ul><li><blockquote><p>Q0w</p></blockquote>T</li><li>Nw</li></ul>"], "undoSteps": null, ...`; base-comparison label: the probe counts line nodes (instrumentation only): same write, same typed letter
- `g3::g3|space|QT|selSpace` - fails 3-fixedPoint; candidate: as at the base (same write; the base's value fails the same check): D1 keeps the head's result unless the bar names it - P record or an existing ruling; lined True; stored `<ul><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>`; write `<ul><li><blockquote><p>Q0w</p></blockquote> </li><li>Nw</li></ul>`; 3-fixedPoint `{"fixedPoint": false, "readOnly": null, "headless": "<ul><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>"}`; base-comparison label: the probe counts line nodes (instrumentation only): same write, same typed letter

## D. Ordinary content: undo differs from the base (coordinator's addition, T58.3 item 3)

**What counts as ordinary content:** the stored value has no lined container, by the acceptance's own tests (`explain.py`).

- It is not `mixed()`: no list item or quote holds both text or inline content and a block.
- No item is led by a block (`<li>(<br>)*<(hr|blockquote|pre|h2|h3|div)`).
- No quote holds bare text (`<blockquote>[^<]`, `</p>` followed by text).
- For the paste sets, the stored value comes from the case lists.
- An R1 caret path naming a line node is reported as a column but does not move a record out of ordinary content. Pastes make lines out of ordinary stored values in 892 matrix and 1,989 sweeps records.

**What counts as an undo difference:** for engine sets, the undo step count, the undo HTML, the onChange calls at undo, or whether the first undo restores. For paste sets, `undoState`, `undoDom`, `undoChanges` or `undone`.

Redo is left out of this section. In ordinary content it differs only where the write differs, because redo equals the write. Every compared field is in section E.

| set          | lined (stored test) | ordinary | ordinary, R1 caret path has a line node | ordinary: undo differs |
| ------------ | ------------------- | -------- | --------------------------------------- | ---------------------- |
| toolbar      | 6628                | 1518     | 2                                       | 10                     |
| clipboard    | 473                 | 358      | 12                                      | 2                      |
| keys-phase-1 | 3376                | 312      | 0                                       | 0                      |
| keys-phase-2 | 991                 | 39       | 1                                       | 0                      |
| gap-fill     | 306                 | 239      | 0                                       | 14                     |
| paste-matrix | 724                 | 1248     | 892                                     | 0                      |
| paste-sweeps | 248                 | 3017     | 1989                                    | 0                      |

The 26 records (also in `T/ordinary-undo-vs-base.jsonl`), by kind:

- **13 records: onChange calls at undo drop from 1 to 0.** The action changes nothing at R1 (16.10 / D7: no onChange and no undo step).
  - toolbar 7, clipboard 1, gap-fill 5.
  - One gap-fill record, `g6|I1root-q|click|P`, carries the label "unexplained" in t55-b's list.
- **9 gap-fill records: at the base the first undo does not restore** (0 calls, the value stays); at R1 it restores in 1 step. These are 7 compositions (`g4|compose|...`) and 2 `g5|blockNoRefocus`. Their labels: "D1's bar / D7: the head's undo or redo does not restore" and "D1's bar: the head's typed letter after undo and redo loses structure".
- **4 records: the undo HTML differs, and both builds restore the value before.**
  - 3 are toolbar `r-Qpr|...|LnRm`, labelled "D1's bar: read-only / not a fixed point". The write differs too, so the value before the undo's last step differs. Not read further.
  - 1 is clipboard `p4::C13`, labelled "D1's bar / D7".

#### toolbar (10)

- `R::ul-d1|r-QI|imgAfter|Ln` - differs undoCalls; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>Nw</p>`; write base `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>Nw</p>`, R1 `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>Nw</p>`; base `{"undoSteps": 1, "undo": ["<p>Pw</p><blockquote><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p></blockquote><p>Nw</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><blockquote><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p></blockquote><p>Nw</p>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `R::ul-d1|r-Qpr|Pw->Nw|LnRm` - differs undo; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; write base `<p>Pw</p><blockquote><p>X1w</p><hr /></blockquote><p>Nw</p>`, R1 `<p>Pw</p><blockquote><p>X1w</p><hr /></blockquote><p>Nw</p>`; base `{"undoSteps": 1, "undo": ["<p>P<a href=\"https://example.org/a\">w</a></p><blockquote><p><a href=\"https://example.org/a\">X1w</a></p><a href=\"https://example.org/a\"><hr /></a></blockquote><p><a href=\"https://example.org/a\">N</a>w</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>P<a href=\"https://example.org/a\">w</a></p><blockquote><p><a href=\"https://example.org/a\">X1w</a></p><hr /></blockquote><p><a href=\"https://example.org/a\">N</a>w</p>"], "undoCalls": [1]}`; restores base True, R1 True; label: D1's bar: the head's value reopens read-only or is not a fixed point
- `R::ul-d1|r-Qpr|X1w->Nw|LnRm` - differs undo; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; write base `<p>Pw</p><blockquote><p>X1w</p><hr /></blockquote><p>Nw</p>`, R1 `<p>Pw</p><blockquote><p>X1w</p><hr /></blockquote><p>Nw</p>`; base `{"undoSteps": 1, "undo": ["<p>Pw</p><blockquote><p>X<a href=\"https://example.org/a\">1w</a></p><a href=\"https://example.org/a\"><hr /></a></blockquote><p><a href=\"https://example.org/a\">N</a>w</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><blockquote><p>X<a href=\"https://example.org/a\">1w</a></p><hr /></blockquote><p><a href=\"https://example.org/a\">N</a>w</p>"], "undoCalls": [1]}`; restores base True, R1 True; label: D1's bar: the head's value reopens read-only or is not a fixed point
- `R::ul-d1|r-Qpr|ctrlA|LnRm` - differs undo; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; write base `<p>Pw</p><blockquote><p>X1w</p><hr /></blockquote><p>Nw</p>`, R1 `<p>Pw</p><blockquote><p>X1w</p><hr /></blockquote><p>Nw</p>`; base `{"undoSteps": 1, "undo": ["<p><a href=\"https://example.org/a\">Pw</a></p><blockquote><p><a href=\"https://example.org/a\">X1w</a></p><a href=\"https://example.org/a\"><hr /></a></blockquote><p><a href=\"https://example.org/a\">Nw</a></p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p><a href=\"https://example.org/a\">Pw</a></p><blockquote><p><a href=\"https://example.org/a\">X1w</a></p><hr /></blockquote><p><a href=\"https://example.org/a\">Nw</a></p>"], "undoCalls": [1]}`; restores base True, R1 True; label: D1's bar: the head's value reopens read-only or is not a fixed point
- `R::ul-d1|r-TB|afterBr|Ln` - differs undoCalls; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; write base `<p>Pw</p><p>T0w<br />T2w</p><p>Nw</p>`, R1 `<p>Pw</p><p>T0w<br />T2w</p><p>Nw</p>`; base `{"undoSteps": 1, "undo": ["<p>Pw</p><p>T0w<br />T2w</p><p>Nw</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><p>T0w<br />T2w</p><p>Nw</p>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `R::ul-d1|r-TI|imgAfter|Ln` - differs undoCalls; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; write base `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`, R1 `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; base `{"undoSteps": 1, "undo": ["<p>Pw</p><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p><p>Nw</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><p>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></p><p>Nw</p>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `X::ul-d1|TB|afterBr|Ln` - differs undoCalls; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; write base `<ul><li>Pw</li><li>T0w<br />T2w</li><li>Nw</li></ul>`, R1 `<ul><li>Pw</li><li>T0w<br />T2w</li><li>Nw</li></ul>`; base `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>T0w<br />T2w</li><li>Nw</li></ul>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>T0w<br />T2w</li><li>Nw</li></ul>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `X::ul-d1|TI|imgAfter|Ln` - differs undoCalls; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; write base `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`, R1 `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; base `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></li><li>Nw</li></ul>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></li><li>Nw</li></ul>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `X::ul-d1|TI|liEnd|Ln` - differs undoCalls; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; write base `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`, R1 `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; base `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></li><li>Nw</li></ul>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>X0w<img src=\"https://cdn.example.org/x.png\" alt=\"\" width=\"40\" height=\"20\" /></li><li>Nw</li></ul>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `X::ul-d1|Tb|liEnd|Ln` - differs undoCalls; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; write base `<ul><li>Pw</li><li>T0w<br /></li><li>Nw</li></ul>`, R1 `<ul><li>Pw</li><li>T0w<br /></li><li>Nw</li></ul>`; base `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>T0w<br /></li><li>Nw</li></ul>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>T0w<br /></li><li>Nw</li></ul>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)

#### clipboard (2)

- `p3::T5b root rule selected / hr` - differs undoCalls; stored `<p>aq</p><hr><p>bq</p>`; write base `<p>aq</p><hr /><p>bq</p>`, R1 `<p>aq</p><hr /><p>bq</p>`; base `{"undoSteps": 1, "undo": ["<p>aq</p><hr /><p>bq</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>aq</p><hr /><p>bq</p>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `p4::C13 parent text->nested` - differs undo; stored `<ul><li>a1q<ul><li>n1q</li></ul></li><li>b1q</li></ul>`; write base `<ul><li>a</li><li>1q<ul><li>n1q</li></ul></li><li></li><li>b1q</li></ul>`, R1 `<ul><li>a</li><li>1q<ul><li>n1q</li></ul></li><li>b1q</li></ul>`; base `{"undoSteps": 1, "undo": ["<ul><li>a1q</li><li></li><li>b1q</li></ul>", "<ul><li>a1q<ul><li>n1q</li></ul></li><li>b1q</li></ul>"], "undoCalls": [1, 1]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>a1q</li><li>b1q</li></ul>", "<ul><li>a1q<ul><li>n1q</li></ul></li><li>b1q</li></ul>"], "undoCalls": [1, 1]}`; restores base True, R1 True; label: D1's bar / D7: the head's undo or redo does not restore

#### gap-fill (14)

- `g1::hang|root-p-hr-p|ruleNode|paste-hr` - differs undoCalls; stored `<p>xq</p><hr><p>yq</p>`; write base `<p>xq</p><hr /><p>yq</p>`, R1 `<p>xq</p><hr /><p>yq</p>`; base `{"undoSteps": 1, "undo": ["<p>xq</p><hr /><p>yq</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>xq</p><hr /><p>yq</p>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `g4::g4|compose|REFI|T0w@1|'a'` - differs undoSteps,undo,undoCalls; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; write base `<ul><li>Pw</li><li>Ta0w</li><li>Nw</li></ul>`, R1 `<ul><li>Pw</li><li>Ta0w</li><li>Nw</li></ul>`; base `{"undoSteps": null, "undo": ["<ul><li>Pw</li><li>Ta0w</li><li>Nw</li></ul>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar / D7: the head's undo or redo does not restore
- `g4::g4|compose|REFI|T0w@1|'a\nb'` - differs undoSteps,undo,undoCalls; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; write base `<ul><li>Pw</li><li>a</li><li>Nw</li></ul>`, R1 `<ul><li>Pw</li><li>a</li><li>Nw</li></ul>`; base `{"undoSteps": null, "undo": ["<ul><li>Pw</li><li>a</li><li>Nw</li></ul>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar / D7: the head's undo or redo does not restore
- `g4::g4|compose|REFP|T0w@1|'a'` - differs undoSteps,undo,undoCalls; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; write base `<p>Pw</p><p>Ta0w</p><p>Nw</p>`, R1 `<p>Pw</p><p>Ta0w</p><p>Nw</p>`; base `{"undoSteps": null, "undo": ["<p>Pw</p><p>Ta0w</p><p>Nw</p>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><p>T0w</p><p>Nw</p>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar / D7: the head's undo or redo does not restore
- `g4::g4|compose|REFP|T0w@1|'a\nb'` - differs undoSteps,undo,undoCalls; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; write base `<p>Pw</p><p>a</p><p>Nw</p>`, R1 `<p>Pw</p><p>a</p><p>Nw</p>`; base `{"undoSteps": null, "undo": ["<p>Pw</p><p>a</p><p>Nw</p>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><p>T0w</p><p>Nw</p>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar / D7: the head's undo or redo does not restore
- `g4::g4|compose|ROOT|T0w@1|'a'` - differs undoSteps,undo,undoCalls; stored `<p>T0w</p><hr><p>Nw</p>`; write base `<p>Ta0w</p><hr /><p>Nw</p>`, R1 `<p>Ta0w</p><hr /><p>Nw</p>`; base `{"undoSteps": null, "undo": ["<p>Ta0w</p><hr /><p>Nw</p>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<p>T0w</p><hr /><p>Nw</p>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar / D7: the head's undo or redo does not restore
- `g4::g4|compose|ROOT|T0w@1|'a\nb'` - differs undoSteps,undo,undoCalls; stored `<p>T0w</p><hr><p>Nw</p>`; write base `<p>a</p><hr /><p>Nw</p>`, R1 `<p>a</p><hr /><p>Nw</p>`; base `{"undoSteps": null, "undo": ["<p>a</p><hr /><p>Nw</p>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<p>T0w</p><hr /><p>Nw</p>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar / D7: the head's undo or redo does not restore
- `g4::g4|compose|ROOT|afterRule|'a'` - differs undoSteps,undo,undoCalls; stored `<p>T0w</p><hr><p>Nw</p>`; write base `<p>T0w</p><hr /><p>aNw</p>`, R1 `<p>T0w</p><hr /><p>aNw</p>`; base `{"undoSteps": null, "undo": ["<p>T0w</p><hr /><p>aNw</p>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<p>T0w</p><hr /><p>Nw</p>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar / D7: the head's undo or redo does not restore
- `g5::g5|blockNoRefocus|REFI` - differs undoSteps,undo,undoCalls; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; write base `<ul><li>Pw</li></ul><h2>T0w</h2><ul><li>Nw</li></ul>`, R1 `<ul><li>Pw</li></ul><h2>T0w</h2><ul><li>Nw</li></ul>`; base `{"undoSteps": null, "undo": ["<ul><li>Pw</li></ul><h2>T0w</h2><ul><li>Nw</li></ul>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar: the head's typed letter after undo and redo loses structure
- `g5::g5|blockNoRefocus|ROOT` - differs undoSteps,undo,undoCalls; stored `<p>T0w</p><hr><p>Nw</p>`; write base `<h2>T0w</h2><hr /><p>Nw</p>`, R1 `<h2>T0w</h2><hr /><p>Nw</p>`; base `{"undoSteps": null, "undo": ["<h2>T0w</h2><hr /><p>Nw</p>"], "undoCalls": [0]}`; R1 `{"undoSteps": 1, "undo": ["<p>T0w</p><hr /><p>Nw</p>"], "undoCalls": [1]}`; restores base False, R1 True; label: D1's bar: the head's typed letter after undo and redo loses structure
- `g6::g6|I1root-q|click|Link` - differs undoCalls; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20"></p></...`; write base `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20" /></p>...`, R1 `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20" /></p>...`; base `{"undoSteps": 1, "undo": ["<p>Pw</p><blockquote><p>X0w<img src=\"http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png\" width=\"40\" height=\"20\" /></p></blockquote><p>Nw</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><blockquote><p>X0w<img src=\"http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png\" width=\"40\" height=\"20\" /></p></blockquote><p>Nw</p>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `g6::g6|I1root-q|click|P` - differs undoCalls; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20"></p></...`; write base `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20" /></p>...`, R1 `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20" /></p>...`; base `{"undoSteps": 1, "undo": ["<p>Pw</p><blockquote><p>X0w<img src=\"http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png\" width=\"40\" height=\"20\" /></p></blockquote><p>Nw</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><blockquote><p>X0w<img src=\"http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png\" width=\"40\" height=\"20\" /></p></blockquote><p>Nw</p>"], "undoCalls": [0]}`; restores base True, R1 True; label: unexplained
- `g6::g6|I2li|click|Link` - differs undoCalls; stored `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20"></li><li>Nw...`; write base `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20" /></li><li>...`, R1 `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20" /></li><li>...`; base `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>X0w<img src=\"http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png\" width=\"40\" height=\"20\" /></li><li>Nw</li></ul>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<ul><li>Pw</li><li>X0w<img src=\"http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png\" width=\"40\" height=\"20\" /></li><li>Nw</li></ul>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- `g6::g6|I5root-p|click|Link` - differs undoCalls; stored `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20"></p><p>Nw</p>`; write base `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20" /></p><p>Nw</p>`, R1 `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" width="40" height="20" /></p><p>Nw</p>`; base `{"undoSteps": 1, "undo": ["<p>Pw</p><p>X0w<img src=\"http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png\" width=\"40\" height=\"20\" /></p><p>Nw</p>"], "undoCalls": [1]}`; R1 `{"undoSteps": 1, "undo": ["<p>Pw</p><p>X0w<img src=\"http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png\" width=\"40\" height=\"20\" /></p><p>Nw</p>"], "undoCalls": [0]}`; restores base True, R1 True; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)

## E. Ruling T60.3: ordinary content, every compared field, against the base

**Method:**

- Every ordinary-content record, classified as in D, is compared against the base on every field `compare.py` compares: the steps with their onChange counts and notes, the final value after the typed letter, errors, a step over 2 s, `failed`, `readOnly` and `fixedPoint`. For the paste sets, every field but timings and carets. The undo step count is added.
- Each difference gets the label of `explain.py`'s own chain (`T/scripts/t553e.py`).
- Each label is then mapped to D1's list: spec D1, plus T45.16, T46.9, T48.2's start-character shapes and T13.1's code-block image (with T40.4 and T43.2). The status values are:
  - **listed:** a D1 entry or D1's 16.10 / D7 carve-out.
  - **bar:** the base record itself shows the fault D1's bar names.
  - **bar?, listed?:** rest only on the acceptance classifier's "to confirm" flags.
  - **excluded:** instrumentation only, same write and same typed letter.
  - **not named:** nothing in D1's list covers it.
- The mapping is mine, label by label (second table). It was not checked against each record's text, except where the label already is a per-record rule.

**Answer: 400** ordinary-content records differ from the base in something D1's list does not name. A further 25 depend on whether the "to confirm" flags hold: 20 bar?, 5 listed?.

- **394 "focus kept after a toolbar control closes"** (toolbar 380, gap-fill 14). The editable keeps the focus after a toolbar control closes, where the head loses it. The write, caret, undo and typed letter are otherwise equal.
  - This is map 2 T10's defect, fixed under T18.8.
  - D1 names 15.14 (a click in text with the Link popover open), not this refocus. If the coordinator reads T18.8 as a D1 entry, these 394 leave the count.
- **6 unexplained:**
  - gap-fill 1: `g6::g6|I1root-q|click|P`, and its difference is the onChange count at undo only;
  - paste-sweeps 5: the acceptance's own 5 unexplained.

  Each is listed below.

The same counts hold at `0ae275f` (`T/at-0ae275f/ordinary-full.json`: 468 different, 400 not named).

| set          | ordinary | equal | different | D1 not named | D1 bar | D1 bar? | D1 listed | D1 listed? | D1 excluded |
| ------------ | -------- | ----- | --------- | ------------ | ------ | ------- | --------- | ---------- | ----------- |
| toolbar      | 1518     | 1112  | 406       | 380          | 10     | 1       | 11        | 4          | 0           |
| clipboard    | 358      | 344   | 14        | 0            | 12     | 1       | 1         | 0          | 0           |
| keys-phase-1 | 312      | 312   | 0         | 0            | 0      | 0       | 0         | 0          | 0           |
| keys-phase-2 | 39       | 39    | 0         | 0            | 0      | 0       | 0         | 0          | 0           |
| gap-fill     | 239      | 202   | 37        | 15           | 2      | 12      | 4         | 1          | 3           |
| paste-matrix | 1248     | 1248  | 0         | 0            | 0      | 0       | 0         | 0          | 0           |
| paste-sweeps | 3017     | 3006  | 11        | 5            | 0      | 6       | 0         | 0          | 0           |
| **all**      | 6731     | 6263  | 468       | 400          | 24     | 20      | 16        | 5          | 3           |

| records | D1 status | label (explain.py chain)                                                                                                                   | D1 text it rests on                                                                                                                                           |
| ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24      | bar       | D1's bar: the head's value reopens read-only or is not a fixed point                                                                       | D1's bar: read-only / not a fixed point                                                                                                                       |
| 8       | bar?      | D1's bar / D7: the head's undo or redo does not restore                                                                                    | D1's bar / D7 (classifier flag, to confirm)                                                                                                                   |
| 6       | bar?      | D1's bar (to confirm): the head loses text, leaves an orphan or empty item, or the typed letter goes astray                                | D1's bar (classifier flag, to confirm)                                                                                                                        |
| 4       | bar?      | D1's bar (to confirm per record): the head loses or reorders content                                                                       | D1's bar: loses or reorders content (classifier flag, to confirm)                                                                                             |
| 2       | bar?      | D1's bar: the head's typed letter after undo and redo loses structure                                                                      | D1's bar: loses content (classifier flag)                                                                                                                     |
| 3       | excluded  | the probe counts line nodes (instrumentation only): same write, same typed letter                                                          | instrumentation only (same write, same typed letter)                                                                                                          |
| 12      | listed    | 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret) | D1: 16.10's carve-out of the onChange count is intended (D7: no undo step for a key that changes nothing)                                                     |
| 4       | listed    | D1 list: Image whose place or range touches a code block lands directly after it (16.25, T13.1, T43.2)                                     | D1's seventh entry (T13.1, T40.4, T43.2)                                                                                                                      |
| 4       | listed?   | D1's bar (to confirm): the head leaves an empty block (5.4)                                                                                | D1: the head leaves an emptied quote/item/list (map 1 groups 4, 5, 9, 17; classifier flag, to confirm)                                                        |
| 1       | listed?   | onChange count only (D7, 16.10: no repeat of the value handed out last) - to confirm                                                       | D1/D7: 16.10's carve-out (acceptance: to confirm)                                                                                                             |
| 394     | not named | focus kept after a toolbar control closes (15.14, T18.8)                                                                                   | map 2 T10 / T18.8: the head loses focus after a toolbar control closes; R1 keeps it. Not named in D1's list as written (15.14 is the Link-popover click only) |
| 6       | not named | UNEXPLAINED (ordinary content, head unflagged)                                                                                             | no rule                                                                                                                                                       |

### Every ordinary-content record that differs from the base (468), by D1 status

#### D1 not named (400)

- toolbar `R::ul-d1|r-C|C0w->Nw|H2` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|C0w->Nw|Qt` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|C0w@mid|H2` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|C0w@mid|Qt` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|Pw->C0w|H2` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|Pw->C0w|Qt` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|ctrlA|H2` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|ctrlA|Qt` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|liEnd|H2` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|liEnd|Qt` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|whole|H2` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-C|whole|Qt` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|H0w->Nw|H2` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|H0w->Nw|Qt` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|H0w@mid|H2` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|H0w@mid|Qt` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|Pw->H0w|H2` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|Pw->H0w|Qt` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|ctrlA|H2` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|ctrlA|Qt` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|liEnd|H2` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|liEnd|Qt` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|whole|H2` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-H|whole|Qt` - fields steps; stored `<p>Pw</p><h3>H0w</h3><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|Pw->X1w|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|Pw->X1w|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|X1w->X2w|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|X1w->X2w|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|X1w@mid|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|X1w@mid|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|X2w->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|X2w->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|X2w@mid|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|X2w@mid|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|ctrlA|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|ctrlA|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|liEnd|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|liEnd|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|whole|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q2p|whole|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><p>X2w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|Pw->X0w|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|Pw->X0w|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|X0w->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|X0w->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|X0w@mid|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|X0w@mid|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|ctrlA|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|ctrlA|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|imgAfter|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|imgAfter|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|liEnd|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|liEnd|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|whole|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QI|whole|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|Pw->X1w|H2` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|Pw->X1w|Qt` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|X1w->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|X1w->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|X1w@mid|H2` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|X1w@mid|Qt` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|ctrlA|H2` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|ctrlA|Qt` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|liEnd|H2` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|liEnd|Qt` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|whole|H2` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-QQ2|whole|Qt` - fields steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|Pw->X1w|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|Pw->X1w|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|X1w->X2w|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|X1w->X2w|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|X1w@mid|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|X1w@mid|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|X2w->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|X2w->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|X2w@mid|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|X2w@mid|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|ctrlA|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|ctrlA|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|liEnd|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|liEnd|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|whole|H2` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qlist|whole|Qt` - fields steps; stored `<p>Pw</p><blockquote><ul><li>X1w</li><li>X2w</li></ul></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|Pw->X1w|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|Pw->X1w|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|X1w->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|X1w->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|X1w@mid|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|X1w@mid|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|ctrlA|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|ctrlA|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|liEnd|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|liEnd|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|ruleClick|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|ruleClick|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|whole|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Qpr|whole|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|Pw->Q0w|H2` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|Pw->Q0w|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|Q0w->Nw|H2` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|Q0w->Nw|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|Q0w@mid|H2` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|Q0w@mid|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|ctrlA|H2` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|ctrlA|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|liEnd|H2` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|liEnd|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|whole|H2` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Q|whole|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|Pw->T0w|H2` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|Pw->T0w|Qt` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|T0w->Nw|H2` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|T0w->Nw|Qt` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|T0w@mid|H2` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|T0w@mid|Qt` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|ctrlA|H2` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|ctrlA|Qt` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|liEnd|H2` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|liEnd|Qt` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|ruleClick|H2` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|ruleClick|Qt` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|whole|H2` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-RT|whole|Qt` - fields steps; stored `<p>Pw</p><hr><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|Pw->T0w|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|Pw->T0w|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|T0w->T2w|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|T0w->T2w|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|T0w@mid|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|T0w@mid|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|T2w->Nw|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|T2w->Nw|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|T2w@mid|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|T2w@mid|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|afterBr|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|afterBr|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|ctrlA|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|ctrlA|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|liEnd|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|liEnd|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|whole|H2` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TB|whole|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|Pw->X0w|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|Pw->X0w|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|X0w->Nw|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|X0w->Nw|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|X0w@mid|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|X0w@mid|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|ctrlA|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|ctrlA|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|imgAfter|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|imgAfter|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|liEnd|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|liEnd|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|whole|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TI|whole|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|Pw->T0w|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|Pw->T0w|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|T0w->Nw|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|T0w->Nw|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|T0w@mid|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|T0w@mid|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|ctrlA|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|ctrlA|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|liEnd|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|liEnd|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|ruleClick|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|ruleClick|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|whole|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-TR|whole|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|Pw->T0w|H2` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|Pw->T0w|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|T0w->Nw|H2` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|T0w->Nw|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|T0w@mid|H2` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|T0w@mid|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|ctrlA|H2` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|ctrlA|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|liEnd|H2` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|liEnd|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|whole|H2` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-Tb|whole|Qt` - fields steps; stored `<p>Pw</p><p>T0w<br></p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|Pw->Nw|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|Pw->Nw|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|Pw->T0w|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|Pw->T0w|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|T0w->Nw|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|T0w->Nw|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|T0w@mid|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|T0w@mid|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|ctrlA|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|ctrlA|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|liEnd|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|liEnd|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|whole|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `R::ul-d1|r-T|whole|Qt` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|Pw->Nw|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|Pw->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|Pw->Nw|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|Pw->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|Pw->T0w|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|Pw->T0w|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|Pw->T0w|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|Pw->T0w|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w->T2w|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w->T2w|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w->T2w|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w->T2w|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w@mid|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w@mid|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w@mid|H3` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w@mid|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T0w@mid|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w->Nw|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w->Nw|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w@mid|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w@mid|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w@mid|H3` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w@mid|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|T2w@mid|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|afterBr|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|afterBr|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|afterBr|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|afterBr|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|ctrlA|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|ctrlA|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|ctrlA|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|ctrlA|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|liEnd|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|liEnd|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|liEnd|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|liEnd|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|whole|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|whole|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|whole|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TB|whole|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|Pw->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|Pw->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|Pw->X0w|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|Pw->X0w|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|X0w->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|X0w->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|X0w@mid|Cd` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|X0w@mid|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|X0w@mid|P` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|X0w@mid|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|ctrlA|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|ctrlA|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|imgAfter|Cd` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|imgAfter|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|imgAfter|P` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|imgAfter|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|liEnd|Cd` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|liEnd|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|liEnd|P` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|liEnd|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|whole|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TI|whole|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w->Nw|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w->Nw|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w@mid|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w@mid|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w@mid|H3` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w@mid|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|L1w@mid|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|Pw->Nw|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|Pw->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|Pw->Nw|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|Pw->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|Pw->T0w|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|Pw->T0w|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|Pw->T0w|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|Pw->T0w|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w->L1w|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w->L1w|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w->L1w|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w->L1w|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w@mid|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w@mid|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w@mid|H3` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w@mid|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|T0w@mid|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|ctrlA|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|ctrlA|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|ctrlA|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|ctrlA|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|liEnd|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|liEnd|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|liEnd|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|liEnd|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|whole|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|whole|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|whole|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|TL|whole|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|Pw->Nw|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|Pw->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|Pw->Nw|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|Pw->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|Pw->T0w|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|Pw->T0w|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|Pw->T0w|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|Pw->T0w|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w->Nw|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w->Nw|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w@mid|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w@mid|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w@mid|H3` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w@mid|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|T0w@mid|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|ctrlA|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|ctrlA|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|ctrlA|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|ctrlA|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|liEnd|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|liEnd|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|liEnd|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|liEnd|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|whole|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|whole|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|whole|P` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|Tb|whole|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|Pw->Nw|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|Pw->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|Pw->Nw|P` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|Pw->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|Pw->T0w|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|Pw->T0w|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|Pw->T0w|P` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|Pw->T0w|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w->Nw|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w->Nw|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w->Nw|P` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w->Nw|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w@mid|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w@mid|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w@mid|H3` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w@mid|P` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|T0w@mid|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|ctrlA|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|ctrlA|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|ctrlA|P` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|ctrlA|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|liEnd|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|liEnd|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|liEnd|P` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|liEnd|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|whole|Cd` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|whole|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|whole|P` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- toolbar `X::ul-d1|T|whole|Qt` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g4::g4|sel|REFI|triple-T0w|H2` - fields steps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g4::g4|sel|REFP|triple-T0w|H2` - fields steps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g4::g4|sel|ROOT|T0w@end+SR2|H2` - fields steps; stored `<p>T0w</p><hr><p>Nw</p>`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I1root-q|click|Code` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I1root-q|click|H2` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I1root-q|click|P` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; label: UNEXPLAINED (ordinary content, head unflagged)
- gap-fill `g6::g6|I1root-q|click|Qt` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I2li|click|Code` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I2li|click|H2` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I2li|click|P` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I2li|click|Qt` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I5root-p|click|Code` - fields steps; stored `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" w...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I5root-p|click|H2` - fields steps; stored `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" w...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I5root-p|click|P` - fields steps; stored `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" w...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- gap-fill `g6::g6|I5root-p|click|Qt` - fields steps; stored `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" w...`; label: focus kept after a toolbar control closes (15.14, T18.8)
- paste-sweeps `E::E|Z13 repro (no join)|Delete` - fields after; stored `<ul><li>p1q</li><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul>`; write base `<ul><li>p1</li></ul><ol><li>Aq</li><li><hr />T1q</li></ol><ul><li>q<ul><li>n1q</li></ul></li><li>t1q</li></ul>`, R1 `<ul><li>p1</li></ul><ol><li>Aq</li><li><hr />T1qq</li></ol><ul><li><ul><li>n1q</li></ul></li><li>t1q</li></ul>`; label: UNEXPLAINED (ordinary content, head unflagged)
- paste-sweeps `E::E|Z9 repro (no join)|Delete` - fields after; stored `<ul><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul>`; write base `<ul><li>s1</li></ul><ol><li>Aq</li><li><hr />T1q</li></ol><ul><li>q<ul><li>n1q</li></ul></li><li>t1q</li></ul>`, R1 `<ul><li>s1</li></ul><ol><li>Aq</li><li><hr />T1qq</li></ol><ul><li><ul><li>n1q</li></ul></li><li>t1q</li></ul>`; label: UNEXPLAINED (ordinary content, head unflagged)
- paste-sweeps `E::E|mid s@2 Q-led ol (no join)|Delete` - fields after; stored `<ul><li>p1q</li><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul>`; write base `<ul><li>p1q</li><li>s1</li></ul><ol><li>Aq</li><li><blockquote><p>Q1q</p></blockquote>T1q</li></ol><ul><li>q<ul><li>n1q<...`, R1 `<ul><li>p1q</li><li>s1</li></ul><ol><li>Aq</li><li><blockquote><p>Q1q</p></blockquote>T1qq</li></ol><ul><li><ul><li>n1q<...`; label: UNEXPLAINED (ordinary content, head unflagged)
- paste-sweeps `E::E|mid s@2 ul nested last H link (no join)|Delete` - fields after; stored `<ul><li>p1q</li><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul>`; write base `<ul><li>p1q</li><li>s1</li><li>Aq<ul><li><hr /><a href="https://example.org/">T1q</a></li></ul></li><li>q<ul><li>n1q</li...`, R1 `<ul><li>p1q</li><li>s1</li><li>Aq<ul><li><hr /><a href="https://example.org/">T1q</a>q</li><li>n1q</li></ul></li><li>t1q...`; label: UNEXPLAINED (ordinary content, head unflagged)
- paste-sweeps `E::E|quote stored s@2 ol HT (no join)|Delete` - fields after; stored `<blockquote><ul><li>p1q</li><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul></blockquote>`; write base `<blockquote><ul><li>p1q</li><li>s1</li></ul><ol><li>Aq</li><li><hr />T1q</li></ol><ul><li>q<ul><li>n1q</li></ul></li><li...`, R1 `<blockquote><ul><li>p1q</li><li>s1</li></ul><ol><li>Aq</li><li><hr />T1qq</li></ol><ul><li><ul><li>n1q</li></ul></li><li...`; label: UNEXPLAINED (ordinary content, head unflagged)

#### D1 bar? (20)

- toolbar `R::ul-d1|r-QQ2|Pw->X1w|Im` - fields final,steps; stored `<p>Pw</p><blockquote><blockquote><p>X1w</p></blockquote></blockquote><p>Nw</p>`; write base `<p>P<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w</p><blockquote></blockquote><p>Nw</p>`, R1 `<p>P<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w</p><p>Nw</p>`; label: D1's bar (to confirm per record): the head loses or reorders content
- clipboard `p4::C13 parent text->nested` - fields final,steps; stored `<ul><li>a1q<ul><li>n1q</li></ul></li><li>b1q</li></ul>`; write base `<ul><li>a</li><li>1q<ul><li>n1q</li></ul></li><li></li><li>b1q</li></ul>`, R1 `<ul><li>a</li><li>1q<ul><li>n1q</li></ul></li><li>b1q</li></ul>`; label: D1's bar / D7: the head's undo or redo does not restore
- gap-fill `g4::g4|compose|REFI|T0w@1|'a'` - fields steps,undoSteps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; undoSteps base None, R1 1; label: D1's bar / D7: the head's undo or redo does not restore
- gap-fill `g4::g4|compose|REFI|T0w@1|'a\nb'` - fields steps,undoSteps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; undoSteps base None, R1 1; label: D1's bar / D7: the head's undo or redo does not restore
- gap-fill `g4::g4|compose|REFP|T0w@1|'a'` - fields steps,undoSteps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; undoSteps base None, R1 1; label: D1's bar / D7: the head's undo or redo does not restore
- gap-fill `g4::g4|compose|REFP|T0w@1|'a\nb'` - fields steps,undoSteps; stored `<p>Pw</p><p>T0w</p><p>Nw</p>`; undoSteps base None, R1 1; label: D1's bar / D7: the head's undo or redo does not restore
- gap-fill `g4::g4|compose|ROOT|T0w@1|'a'` - fields steps,undoSteps; stored `<p>T0w</p><hr><p>Nw</p>`; undoSteps base None, R1 1; label: D1's bar / D7: the head's undo or redo does not restore
- gap-fill `g4::g4|compose|ROOT|T0w@1|'a\nb'` - fields steps,undoSteps; stored `<p>T0w</p><hr><p>Nw</p>`; undoSteps base None, R1 1; label: D1's bar / D7: the head's undo or redo does not restore
- gap-fill `g4::g4|compose|ROOT|afterRule|'a'` - fields steps,undoSteps; stored `<p>T0w</p><hr><p>Nw</p>`; undoSteps base None, R1 1; label: D1's bar / D7: the head's undo or redo does not restore
- gap-fill `g5::g5|blockNoRefocus|REFI` - fields steps,undoSteps; stored `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>`; undoSteps base None, R1 1; label: D1's bar: the head's typed letter after undo and redo loses structure
- gap-fill `g5::g5|blockNoRefocus|ROOT` - fields steps,undoSteps; stored `<p>T0w</p><hr><p>Nw</p>`; undoSteps base None, R1 1; label: D1's bar: the head's typed letter after undo and redo loses structure
- gap-fill `g6::g6|I1root-q|click|Del` - fields final,steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; write base `<p>Pw</p><blockquote><p>X0wNw</p></blockquote>`, R1 `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; label: D1's bar (to confirm per record): the head loses or reorders content
- gap-fill `g6::g6|I2li|click|Del` - fields final,steps; stored `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img...`; write base `<ul><li>Pw</li><li>X0wNw</li></ul>`, R1 `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img...`; label: D1's bar (to confirm per record): the head loses or reorders content
- gap-fill `g6::g6|I5root-p|click|Del` - fields final,steps; stored `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" w...`; write base `<p>Pw</p><p>X0wNw</p>`, R1 `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" w...`; label: D1's bar (to confirm per record): the head loses or reorders content
- paste-sweeps `B::B|d3 | p-n | ol HT|paste` - fields typed,written; stored `<ul><li>a1q<ul><li>p1q<ul><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul></li><li>u1q</li></ul></li></ul>`; write base `<ul><li>a1q<ul><li>p1</li></ul></li></ul><ol><li>Aq</li><li><hr />T1q1q</li></ol><ul><li><ul><li><ul><li>t1q</li></ul></...`, R1 `<ul><li>a1q<ul><li>p1</li></ul></li></ul><ol><li>Aq</li><li><hr />T1q</li></ol><ul><li><ul><li>1q<ul><li>t1q</li></ul></...`; label: D1's bar (to confirm): the head loses text, leaves an orphan or empty item, or the typed letter goes astray
- paste-sweeps `B::B|d3 | p-n | quote ul HT|paste` - fields typed,written; stored `<ul><li>a1q<ul><li>p1q<ul><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul></li><li>u1q</li></ul></li></ul>`; write base `<ul><li>a1q<ul><li>p1</li></ul></li></ul><blockquote><ul><li>Aq</li><li><hr />T1q1q</li></ul></blockquote><ul><li><ul><l...`, R1 `<ul><li>a1q<ul><li>p1</li></ul></li></ul><blockquote><ul><li>Aq</li><li><hr />T1q</li></ul></blockquote><ul><li><ul><li>...`; label: D1's bar (to confirm): the head loses text, leaves an orphan or empty item, or the typed letter goes astray
- paste-sweeps `B::B|dlim | all | ol HT|paste` - fields li,orphan,typed,written; stored `<ul><li>a1q<ul><li>a2q<ul><li>a3q<ul><li>a4q<ul><li>a5q<ul><li>p1q</li><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul...`; write base `<ol><li>Aq</li><li><hr />T1q</li></ol><ul><li><ul><li><ul><li><ul><li></li></ul></li></ul></li></ul></li></ul>`, R1 `<ol><li>Aq</li><li><hr />T1q</li></ol>`; label: D1's bar (to confirm): the head loses text, leaves an orphan or empty item, or the typed letter goes astray
- paste-sweeps `B::B|dlim | all | ol T|paste` - fields li,orphan,typed,written; stored `<ul><li>a1q<ul><li>a2q<ul><li>a3q<ul><li>a4q<ul><li>a5q<ul><li>p1q</li><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul...`; write base `<ol><li>Aq</li><li>T1q</li></ol><ul><li><ul><li><ul><li><ul><li></li></ul></li></ul></li></ul></li></ul>`, R1 `<ol><li>Aq</li><li>T1q</li></ol>`; label: D1's bar (to confirm): the head loses text, leaves an orphan or empty item, or the typed letter goes astray
- paste-sweeps `B::B|dlim | all | quote ul HT|paste` - fields li,orphan,typed,written; stored `<ul><li>a1q<ul><li>a2q<ul><li>a3q<ul><li>a4q<ul><li>a5q<ul><li>p1q</li><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul...`; write base `<blockquote><ul><li>Aq</li><li><hr />T1q</li></ul></blockquote><ul><li><ul><li><ul><li><ul><li></li></ul></li></ul></li>...`, R1 `<blockquote><ul><li>Aq</li><li><hr />T1q</li></ul></blockquote>`; label: D1's bar (to confirm): the head loses text, leaves an orphan or empty item, or the typed letter goes astray
- paste-sweeps `B::B|dlim | all | ul HT|paste` - fields li,orphan,typed,written; stored `<ul><li>a1q<ul><li>a2q<ul><li>a3q<ul><li>a4q<ul><li>a5q<ul><li>p1q</li><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul...`; write base `<ul><li>Aq</li><li><hr />T1q<ul><li><ul><li><ul><li></li></ul></li></ul></li></ul></li></ul>`, R1 `<ul><li>Aq</li><li><hr />T1q</li></ul>`; label: D1's bar (to confirm): the head loses text, leaves an orphan or empty item, or the typed letter goes astray

#### D1 listed? (5)

- toolbar `R::ul-d1|r-QI|Pw->X0w|Im` - fields final,steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; write base `<p>P<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w<img src="https://cdn.example.org/x.png" alt...`, R1 `<p>P<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w<img src="https://cdn.example.org/x.png" alt...`; label: D1's bar (to confirm): the head leaves an empty block (5.4)
- toolbar `R::ul-d1|r-Q|Pw->Q0w|Im` - fields final,steps; stored `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>`; write base `<p>P<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w</p><blockquote></blockquote><p>Nw</p>`, R1 `<p>P<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w</p><p>Nw</p>`; label: D1's bar (to confirm): the head leaves an empty block (5.4)
- toolbar `X::ul-d1|TL|T0w->L1w|Im` - fields final,steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; write base `<ul><li>Pw</li><li>T<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w</li><li></li><li>Nw</li></u...`, R1 `<ul><li>Pw</li><li>T<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w</li><li>Nw</li></ul>`; label: D1's bar (to confirm): the head leaves an empty block (5.4)
- toolbar `X::ul-d1|TL|whole|Im` - fields final,steps; stored `<ul><li>Pw</li><li>T0w<ul><li>L1w</li></ul></li><li>Nw</li></ul>`; write base `<ul><li>Pw</li><li><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /></li><li></li><li>Nw</li></ul>`, R1 `<ul><li>Pw</li><li><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /></li><li>Nw</li></ul>`; label: D1's bar (to confirm): the head leaves an empty block (5.4)
- gap-fill `g4::g4|compose|ROOT|afterRule|'a\nb'` - fields steps; stored `<p>T0w</p><hr><p>Nw</p>`; label: onChange count only (D7, 16.10: no repeat of the value handed out last) - to confirm

#### D1 bar (24)

- toolbar `R::ul-d1|r-QI|imgNode|OL` - fields final,fixedPoint,steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; write base `<p>Pw</p><ol><li><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></li></ol><p>Nw</p>`, R1 `<p>Pw</p><ol><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li></ol><p>Nw</p>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-QI|imgNode|UL` - fields final,fixedPoint,steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; write base `<p>Pw</p><ul><li><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></li></ul><p>Nw</p>`, R1 `<p>Pw</p><ul><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li></ul><p>Nw</p>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-Qpr|Pw->Nw|Ln` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; write base `<p>P<a href="https://example.org/a">w</a></p><blockquote><p><a href="https://example.org/a">X1w</a></p><a href="https://...`, R1 `<p>P<a href="https://example.org/a">w</a></p><blockquote><p><a href="https://example.org/a">X1w</a></p><hr /></blockquot...`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-Qpr|Pw->Nw|LnRm` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-Qpr|X1w->Nw|Ln` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; write base `<p>Pw</p><blockquote><p>X<a href="https://example.org/a">1w</a></p><a href="https://example.org/a"><hr /></a></blockquot...`, R1 `<p>Pw</p><blockquote><p>X<a href="https://example.org/a">1w</a></p><hr /></blockquote><p><a href="https://example.org/a"...`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-Qpr|X1w->Nw|LnRm` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-Qpr|ctrlA|Ln` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; write base `<p><a href="https://example.org/a">Pw</a></p><blockquote><p><a href="https://example.org/a">X1w</a></p><a href="https://...`, R1 `<p><a href="https://example.org/a">Pw</a></p><blockquote><p><a href="https://example.org/a">X1w</a></p><hr /></blockquot...`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-Qpr|ctrlA|LnRm` - fields steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-Qpr|ruleNode|OL` - fields final,fixedPoint,readOnly,steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; write base `<p>Pw</p><ol><li><p>X1w</p><hr /></li></ol><p>Nw</p>`, R1 `<p>Pw</p><ol><li>X1w<hr /></li></ol><p>Nw</p>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- toolbar `R::ul-d1|r-Qpr|ruleNode|UL` - fields final,fixedPoint,readOnly,steps; stored `<p>Pw</p><blockquote><p>X1w</p><hr></blockquote><p>Nw</p>`; write base `<p>Pw</p><ul><li><p>X1w</p><hr /></li></ul><p>Nw</p>`, R1 `<p>Pw</p><ul><li>X1w<hr /></li></ul><p>Nw</p>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 d2 n1@0 / hrP` - fields final,fixedPoint,readOnly,steps; stored `<ul><li>a1q<ul><li>n1q</li></ul></li></ul>`; write base `<ul><li>a1q</li><li><hr /><p>Bqn1q</p></li></ul>`, R1 `<ul><li>a1q</li><li><hr />Bqn1q</li></ul>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 d2 n1@0 / hrP drop` - fields final,fixedPoint,readOnly,steps; stored `<ul><li>a1q<ul><li>n1q</li></ul></li></ul>`; write base `<ul><li>a1q</li><li><hr /><p>Bqn1q</p></li></ul>`, R1 `<ul><li>a1q</li><li><hr />Bqn1q</li></ul>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 d2 n1@0 / hrPP` - fields final,fixedPoint,readOnly,steps; stored `<ul><li>a1q<ul><li>n1q</li></ul></li></ul>`; write base `<ul><li>a1q</li><li><hr /><p>Bq</p><p>Cqn1q</p></li></ul>`, R1 `<ul><li>a1q</li><li><hr />Bq<br />Cqn1q</li></ul>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 d2 n1@0 / hrT` - fields final,fixedPoint,readOnly,steps; stored `<ul><li>a1q<ul><li>n1q</li></ul></li></ul>`; write base `<ul><li>a1q</li><li><hr /><p>Bqn1q</p></li></ul>`, R1 `<ul><li>a1q</li><li><hr />Bqn1q</li></ul>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 d3 n1@0 / hrP` - fields final,fixedPoint,readOnly,steps; stored `<ul><li>a1q<ul><li>a2q<ul><li>n1q</li></ul></li></ul></li></ul>`; write base `<ul><li>a1q<ul><li>a2q</li><li><hr /><p>Bqn1q</p></li></ul></li></ul>`, R1 `<ul><li>a1q<ul><li>a2q</li><li><hr />Bqn1q</li></ul></li></ul>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 d3 n1@0 / hrP drop` - fields final,fixedPoint,readOnly,steps; stored `<ul><li>a1q<ul><li>a2q<ul><li>n1q</li></ul></li></ul></li></ul>`; write base `<ul><li>a1q<ul><li>a2q</li><li><hr /><p>Bqn1q</p></li></ul></li></ul>`, R1 `<ul><li>a1q<ul><li>a2q</li><li><hr />Bqn1q</li></ul></li></ul>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 d3 n1@0 / hrPP` - fields final,fixedPoint,readOnly,steps; stored `<ul><li>a1q<ul><li>a2q<ul><li>n1q</li></ul></li></ul></li></ul>`; write base `<ul><li>a1q<ul><li>a2q</li><li><hr /><p>Bq</p><p>Cqn1q</p></li></ul></li></ul>`, R1 `<ul><li>a1q<ul><li>a2q</li><li><hr />Bq<br />Cqn1q</li></ul></li></ul>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 d3 n1@0 / hrT` - fields final,fixedPoint,readOnly,steps; stored `<ul><li>a1q<ul><li>a2q<ul><li>n1q</li></ul></li></ul></li></ul>`; write base `<ul><li>a1q<ul><li>a2q</li><li><hr /><p>Bqn1q</p></li></ul></li></ul>`, R1 `<ul><li>a1q<ul><li>a2q</li><li><hr />Bqn1q</li></ul></li></ul>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 ol d2 n1@0 / hrP` - fields final,fixedPoint,readOnly,steps; stored `<ol><li>a1q<ol><li>n1q</li></ol></li></ol>`; write base `<ol><li>a1q</li><li><hr /><p>Bqn1q</p></li></ol>`, R1 `<ol><li>a1q</li><li><hr />Bqn1q</li></ol>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 ol d2 n1@0 / hrP drop` - fields final,fixedPoint,readOnly,steps; stored `<ol><li>a1q<ol><li>n1q</li></ol></li></ol>`; write base `<ol><li>a1q</li><li><hr /><p>Bqn1q</p></li></ol>`, R1 `<ol><li>a1q</li><li><hr />Bqn1q</li></ol>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 ol d2 n1@0 / hrPP` - fields final,fixedPoint,readOnly,steps; stored `<ol><li>a1q<ol><li>n1q</li></ol></li></ol>`; write base `<ol><li>a1q</li><li><hr /><p>Bq</p><p>Cqn1q</p></li></ol>`, R1 `<ol><li>a1q</li><li><hr />Bq<br />Cqn1q</li></ol>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- clipboard `k2::K5 ol d2 n1@0 / hrT` - fields final,fixedPoint,readOnly,steps; stored `<ol><li>a1q<ol><li>n1q</li></ol></li></ol>`; write base `<ol><li>a1q</li><li><hr /><p>Bqn1q</p></li></ol>`, R1 `<ol><li>a1q</li><li><hr />Bqn1q</li></ol>`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- gap-fill `g6::g6|I1root-q|arrow|OL` - fields final,fixedPoint,steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; write base `<p>Pw</p><ol><li><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-im...`, R1 `<p>Pw</p><ol><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.p...`; label: D1's bar: the head's value reopens read-only or is not a fixed point
- gap-fill `g6::g6|I1root-q|arrow|UL` - fields final,fixedPoint,steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; write base `<p>Pw</p><ul><li><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-im...`, R1 `<p>Pw</p><ul><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.p...`; label: D1's bar: the head's value reopens read-only or is not a fixed point

#### D1 listed (16)

- toolbar `R::ul-d1|r-C|C0w->Nw|Im` - fields steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; write base `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p><p><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /><...`, R1 `<p>Pw</p><pre><code>Cw</code></pre><p><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /></p>`; label: D1 list: Image whose place or range touches a code block lands directly after it (16.25, T13.1, T43.2)
- toolbar `R::ul-d1|r-C|C0w@mid|Im` - fields final,steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; write base `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p><p><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /><...`, R1 `<p>Pw</p><pre><code>C0w</code></pre><p><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /></p><p>Nw<...`; label: D1 list: Image whose place or range touches a code block lands directly after it (16.25, T13.1, T43.2)
- toolbar `R::ul-d1|r-C|Pw->C0w|Im` - fields final,steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; write base `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p><p><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /><...`, R1 `<p>P<img src="https://cdn.example.org/a.png" alt="" width="1" height="1" />w</p><p>Nw</p>`; label: D1 list: Image whose place or range touches a code block lands directly after it (16.25, T13.1, T43.2)
- toolbar `R::ul-d1|r-C|whole|Im` - fields final,steps; stored `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p>`; write base `<p>Pw</p><pre><code>C0w</code></pre><p>Nw</p><p><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /><...`, R1 `<p>Pw</p><pre><code></code></pre><p><img src="https://cdn.example.org/a.png" alt="" width="1" height="1" /></p><p>Nw</p>`; label: D1 list: Image whose place or range touches a code block lands directly after it (16.25, T13.1, T43.2)
- toolbar `R::ul-d1|r-QI|imgAfter|Ln` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p></blockquote><p>...`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- toolbar `R::ul-d1|r-TB|afterBr|Ln` - fields steps; stored `<p>Pw</p><p>T0w<br>T2w</p><p>Nw</p>`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- toolbar `R::ul-d1|r-TI|imgAfter|Ln` - fields steps; stored `<p>Pw</p><p>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></p><p>Nw</p>`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- toolbar `X::ul-d1|TB|afterBr|Ln` - fields steps; stored `<ul><li>Pw</li><li>T0w<br>T2w</li><li>Nw</li></ul>`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- toolbar `X::ul-d1|TI|imgAfter|Ln` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- toolbar `X::ul-d1|TI|liEnd|Ln` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="https://cdn.example.org/x.png" alt="" width="40" height="20" /></li><li>Nw</li></ul>`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- toolbar `X::ul-d1|Tb|liEnd|Ln` - fields steps; stored `<ul><li>Pw</li><li>T0w<br></li><li>Nw</li></ul>`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- clipboard `p3::T5b root rule selected / hr` - fields steps; stored `<p>aq</p><hr><p>bq</p>`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- gap-fill `g1::hang|root-p-hr-p|ruleNode|paste-hr` - fields steps; stored `<p>xq</p><hr><p>yq</p>`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- gap-fill `g6::g6|I1root-q|click|Link` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- gap-fill `g6::g6|I2li|click|Link` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img...`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)
- gap-fill `g6::g6|I5root-p|click|Link` - fields steps; stored `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" w...`; label: 16.10, D7: an action that changes nothing makes no onChange and no undo step at R1 (the head makes both; its undo then restores the caret)

#### D1 excluded (3)

- gap-fill `g6::g6|I1root-q|arrow|drag` - fields steps; stored `<p>Pw</p><blockquote><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fil...`; label: the probe counts line nodes (instrumentation only): same write, same typed letter
- gap-fill `g6::g6|I2li|arrow|drag` - fields steps; stored `<ul><li>Pw</li><li>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img...`; label: the probe counts line nodes (instrumentation only): same write, same typed letter
- gap-fill `g6::g6|I5root-p|arrow|drag` - fields steps; stored `<p>Pw</p><p>X0w<img src="http://localhost:PORT/app/builder/features/cms-panel/native/zzacc-gap-fill/zzh2-fill-img.png" w...`; label: the probe counts line nodes (instrumentation only): same write, same typed letter

## Files

- `T/sets/<set>/out/r1-<batch>.json` and `log-r1-<batch>.txt`: the records at `6845516`. The chain logs are `T/chain-l1..l5.log`.
- `T/out.json`: every count in sections A to D.
- `T/t553-failing.jsonl`: the 21 records failing the invariant.
- `T/undo-changes-0ae275f-6845516.jsonl`: empty (B).
- `T/old-vs-new-full.json`, `T/old-vs-new-full-differences.jsonl.gz` and `T/old-vs-new-real.jsonl`: `0ae275f` against `6845516`, every field.
- `T/ordinary-undo-vs-base.jsonl`: section D.
- `T/ordinary-full.json` and `T/ordinary-full-differences.jsonl.gz`: section E.
- `T/at-0ae275f/`: the same analyses on the `0ae275f` records.
- `T/scripts/`: `gdrive553.py`, `chain.sh`, `lib553.py`, `t553.py`, `t553e.py`, `oldnew.py`, `kms.py` and `gen_md.py`. `T/cases/` holds the stored values of the paste cases.
- `T/discarded/`: the overwritten toolbar D output from the concurrent chain (section A).
