# Task 26: T62.3 and T62.4 measurements at 838aca9

Measured 2026-11-26, 18:14 to 18:18 UTC. Nothing committed; no tracked file changed.

- **R1:** `838aca9`, checked out detached in the agent worktree. The lockfile is unchanged from `6845516`, so no install was needed.
- **Base:** `SP/r1-base` (`2a96a45`).
- **Driver:** `SP/t62/scripts/gdrive62.py`, the t553 driver with gap-fill's engine (`timeout 600`, 40 s stall watchdog, project `core-browser-builder-cms`). Batches are in `SP/t62/gen/`, records in `SP/t62/out/<side>-<batch>.json`, and run logs with load averages in `SP/t62/run-{r1,base}.log` and `SP/t62/load.log`.
- **Load:** the two builds ran in parallel, while two implementation agents also ran browser tests. The 1-minute load average was 6.4 to 11.3 during the runs; the 5- and 15-minute averages fell from 16.5 and 19.5 to 10.8 and 16.2.

| batch                                     | start    | 1, 5, 15 min load at start | end      | load at end       |
| ----------------------------------------- | -------- | -------------------------- | -------- | ----------------- |
| u (T62.3)                                 | 18:14:11 | 9.81 16.53 19.48           | 18:14:27 | 10.96 16.35 19.35 |
| c (T62.4, 20 runs each)                   | 18:14:27 | 10.96 16.35 19.35          | 18:14:52 | 11.25 16.05 19.19 |
| ci (T62.4 instrumented, phases)           | 18:15:54 | 7.21 13.99 18.27           | 18:16:38 | 8.17 13.31 17.84  |
| cj (T62.4 instrumented, values and times) | 18:17:07 | 6.58 12.52 17.45           | 18:17:55 | 8.79 12.31 17.13  |

- **Instrumentation:** a copy of the gap-fill engine (`SP/t62/src/zzh2-fill-engine.tsx`). Only its `compose` step changed: it records the onChange calls per phase, their values, and their times from the first CDP call.
- **Revert:** the scratch `zzacc-gap-fill` directories were removed from both checkouts afterwards, and `git status` is clean.

## T62.3: the five g3 records, scored per edit

**Method:** two variants of each record were run at each build (`SP/t62/gen/batch-u.json`):

- **as is:** the record's own step of several keys, then undo pressed 2 more times than the step has keys;
- **split:** the same keys one per step, so that the value after each key is recorded.

Data: `SP/t62/t62-3.json`; script `SP/t62/scripts/score.py`.

**Reading the ruling:**

- "Count" is T13.3 as written: every key that changes the value is one edit, and a run of typed letters counts once.
- "Count with deletion runs" also treats consecutive one-character Backspaces that leave the caret in text as one run. Lexical's history merges these as it merges typing, and both builds do so.

**Result at R1:**

- The final undo restores the stored value in all 5 records, with no console error.
- Against T13.3's count as written, **4 records need one undo fewer**: `adj`, `emptyLine`, `emptyLine-k` and `emptyLine-enter`. Their two character deletions share one step. `br2` needs exactly its count.
- With deletion runs counted once, **all 5 need exactly the count**.
- Both builds need the same number of undos in all five records, with the same per-undo values except where the writes differ.
- The "split" variant needs the same number of undos as "as is" in every record, at both builds.
- **Base `adj`:** its 4th Backspace changes nothing and still makes an undo step. The first undo leaves the value as written (only the caret moves), so the base needs 3 undos where the deletion-run reading gives 2. This is the D7 fault R1 fixes.

**P-record call:** if a run of deletions is not "a run of typing", these 4 are P records. They are equal at the base, so they are not an R1 change.

Values below are abbreviated: `…` stands for `</li><li>Nw</li></ul>`.

### `g3|adj|TQT|Q1w whole Bksp x2`

Stored `<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w…`, caret at Q1w@3. Step: `{Backspace}{Backspace}{Backspace}{Backspace}`.

| key       | R1 value after the key                              | base value after the key       |
| --------- | --------------------------------------------------- | ------------------------------ |
| Backspace | `…<p>Q1</p>…` (caret text@2)                        | same                           |
| Backspace | `…<p>Q</p>…` (text@1)                               | same                           |
| Backspace | `…<blockquote></blockquote>…` (paragraph element:0) | same (paragraph element:0)     |
| Backspace | `<ul><li>Pw</li><li>T0wT2w…` (T0wT2w@3)             | **no change** (caret to T0w@3) |

|                            | R1                                                     | base                                                                    |
| -------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| count / with deletion runs | 4 / 3                                                  | 3 / 2                                                                   |
| undo 1                     | `…<blockquote></blockquote>T2w…` (paragraph element:0) | `…<blockquote></blockquote>T2w…` (unchanged value; paragraph element:0) |
| undo 2                     | `…<p>Q</p>…` (Q@1)                                     | `…<p>Q</p>…` (Q@1)                                                      |
| undo 3                     | stored (Q1w@3)                                         | stored (Q1w@3)                                                          |
| undo 4 and later           | no change, 0 onChange                                  | no change, 0 onChange                                                   |
| restored after             | **3**                                                  | **3**                                                                   |

### `g3|br2|QT|selShiftEnter2`

Stored `<ul><li><blockquote><p>Q0w</p></blockquote>T1w…`, range over T1w. Step: `{Shift>}{Enter}{Enter}{/Shift}`.

| key         | R1                                           | base                            |
| ----------- | -------------------------------------------- | ------------------------------- |
| Shift+Enter | `…</blockquote><br />…` (cms-line element:1) | same value (listitem element:2) |
| Shift+Enter | `…</blockquote><br /><br />…` (element:2)    | same value (listitem element:3) |

- **count:** 2 at both builds (both counting readings agree).
- **R1:** undo 1 gives `…<br />…` (element:1); undo 2 gives the stored value with the range T1w@0 to T1w@3 restored.
- **Base:** the same values. Its carets are on the item, not the line.
- **Restored after 2** at both builds.

### `g3|emptyLine-enter|QT|Bksp3Enter`

Stored `<ul><li><blockquote><p>Q0w</p></blockquote>T1w…`, caret at T1w@3. Step: `{Backspace}{Backspace}{Backspace}{Enter}`.

| key       | R1                                                                            | base                                                                           |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Backspace | `…</blockquote>T1…`                                                           | same                                                                           |
| Backspace | `…</blockquote>T…`                                                            | same                                                                           |
| Backspace | `…</blockquote>…` (empty line, element:0)                                     | same value (quote element:1)                                                   |
| Enter     | `<ul><li><blockquote><p>Q0w</p></blockquote></li><li></li><li>Nw…` (new item) | `<ul><li><blockquote><p>Q0w</p><p></p></blockquote>…` (paragraph in the quote) |

- **count:** 4, or 3 with deletion runs, at both builds.
- **R1 undos:**
  - undo 1: `…</blockquote>…`, caret Q0w@3;
  - undo 2: `…T…` (T@1);
  - undo 3: the stored value (T1w@3).
- **Base:** the same values. Undo 1's caret is quote element:1.
- **Restored after 3** at both builds.

### `g3|emptyLine-k|QT|Bksp3k`

The same stored value and caret. Step: `{Backspace}{Backspace}{Backspace}k`.

- **The three Backspaces:** as in `emptyLine-enter` above.
- **The letter k:** R1 gives `…</blockquote>k…`; the base gives `…<p>Q0wk</p></blockquote>…`.
- **count:** 4, or 3 with deletion runs, at both builds.
- **R1 undos:** the empty line (element:0), then `…T…`, then the stored value.
- **Base:** the same values.
- **Restored after 3** at both builds.

### `g3|emptyLine|QT|Bksp3`

The same stored value and caret. Step: `{Backspace}{Backspace}{Backspace}`, as in `emptyLine-enter`.

- **count:** 3, or 2 with deletion runs, at both builds.
- **R1 undos:** `…T…` (T@1), then the stored value (T1w@3).
- **Base:** the same.
- **Restored after 2** at both builds.

## T62.4: `g4|compose|ROOT|afterRule|'a'` and `'a\nb'`, 20 runs each

Stored `<p>T0w</p><hr><p>Nw</p>`. A real-key arrow walk node-selects the rule; ArrowRight goes past it; a CDP composition then follows: `imeSetComposition` of the first character, then of the whole text, then `insertText`.

### onChange count at the compose step

Three batches of 20 runs per record per build; ci and cj are instrumented.

| record   | build        | c           | ci          | cj           | all 60           |
| -------- | ------------ | ----------- | ----------- | ------------ | ---------------- |
| `'a'`    | R1 `838aca9` | 1 x15, 2 x5 | 1 x15, 2 x5 | 1 x10, 2 x10 | **1 x40, 2 x20** |
| `'a'`    | base         | 3 x20       | 3 x20       | 3 x20        | **3 x60**        |
| `'a\nb'` | R1 `838aca9` | 3 x9, 4 x11 | 3 x16, 4 x4 | 3 x11, 4 x9  | **3 x36, 4 x24** |
| `'a\nb'` | base         | 5 x20       | 5 x20       | 5 x20        | **5 x60**        |

**Other fields, per build:**

- **R1:** every other field of the record is the same in all 60 runs per record: the write, undo (restores in 1 step, 1 onChange), redo, the typed letter and the fixed point.
- **Base:**
  - Its count is steady, but its undo varies. In about half the runs the first undo changes nothing (0 onChange, `cmp m` false); in the others it restores. The splits were 9 against 11, 11 against 9, and 10 against 10 per batch.
  - Its redo count follows the undo.
  - This is the head's F12 fault, which R1 does not show.

### The cause of R1's varying count (cj: every call, value and time from the first `imeSetComposition`)

**R1, count 1 (`'a'`, 10 of 20):** a single call, `<p>T0w</p><hr /><p>aNw</p>` at 5 to 9 ms.

**R1, count 2 (`'a'`, 10 of 20):** two calls, both during the first `imeSetComposition`:

1. `<p>T0w</p><hr /><p>Nw</p>` at 2 to 7 ms. This is the stored value, unchanged.
2. `<p>T0w</p><hr /><p>aNw</p>` at 10 to 21 ms.

`'a\nb'` behaves the same: either `aNw`, `bNw`, `a`, or the same three with the unchanged stored value first (at 1 to 3 ms).

**Base, the same alternation:** its first call at the composition's start holds either

- `<p>T0w</p><hr /><p>[U+200B]Nw</p>` (Lexical's start character), in 10 of 20 runs per record, or
- `<p>T0w</p><hr /><p>Nw</p>` (no start character), in the other 10.

Then comes `aNw`, and a repeat of `aNw` at `insertText`.

**Cause:**

- The first commit at the composition's start either holds Lexical's start character or does not. This varies run to run, at both builds, and depends on timing, which makes it load-dependent.
- **When it holds U+200B:** R1 withholds it (T46.3, `compositionHoldsStartChar` in `ChangePlugin`). The count is the low one.
- **When it does not:** its HTML equals the stored value. R1's `ChangePlugin` withholds only a repeat of a value it has itself handed out. Its comment reads: "the first value after mount is handed out even where it equals the stored one". This is the first onChange since mount, so R1 hands out an onChange whose value equals the stored one. That is the one extra call.
- **Which way it goes:** the count is 1 or 3 when the start character reaches the first commit, and 2 or 4 when it does not. So the change from 2 to 1 between `0ae275f` and `6845516` was this race, not a code change.
- **Not instrumented further:** which Lexical update makes the first commit (the composition's selection update before the start character is inserted, or the insertion itself).

**For T50.1's bar:** the result varies with load, and its cause is named above. The varying call is a field onChange whose value equals the stored value (no content change). Under D7 ("no onChange with an unchanged value") it is a P-record candidate. It is not a content or caret difference: the write, the undo and the typed letter are steady.
