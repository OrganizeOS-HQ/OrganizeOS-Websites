# Task 26: T67.2

Fix bf98a54, merged. The core-server failure it found (cms-theme.node.test.ts, '#116' in a comment of rich-text-line-paste.ts from 66fec00) is fixed in the next commit.

Branch `t67` from `0d3d0f4`, commit `bf98a54` `fix(cms): T67.2 a composition's start hands out nothing`. The worktree is `/home/user/OrganizeOS-Websites/.claude/worktrees/agent-a55231386efcc5085`. Nothing was pushed.

## Cause

- The cause was in `ChangePlugin` at `0d3d0f4`, `rich-text-field.tsx:2758-2782`. It ran Lexical's `OnChangePlugin` and withheld only two things: a value holding a start character (`compositionHoldsStartChar`, `rich-text-line-history.ts:137`), and a repeat of the last value it handed out.
- Before any value was handed out, `handedOut.current` was undefined. So the first unchanged commit after mount was handed out (`:2774-2778`).

## The named update (bar 1)

The first commit is made by Lexical 0.21's `onCompositionStart` (`node_modules/lexical/Lexical.dev.mjs:3038-3061`):

- Its `updateEditor` calls `$setCompositionKey(anchor.key)` (`:3044`).
- That marks the caret's text node writable (`:774-793`).
- It inserts `COMPOSITION_START_CHAR` (`:3057`) only in these cases:
  - `event.timeStamp < lastKeyDownTimeStamp + 30` (`:3049`);
  - an element anchor;
  - a range;
  - a format or style mismatch.

At a plain text caret, a `compositionstart` 30 ms or more after the last keydown therefore makes a commit with these properties:

- the anchor text leaf is dirty;
- the parent and the root are dirty elements;
- it has no tags;
- the D7 document is unchanged.

**Instrumentation:** temporary, in `ChangePlugin`, logging root keydown and compositionstart and every commit. It was run on batch `SP/t67/gen/batch-i.json` (20+20) and reverted.

**Result:**

- 35 runs had a gap from the ArrowRight keydown of 21 to 30 ms. They got U+200B in the first composing commit.
- 5 runs had a gap of 32 to 69 ms. They got the unchanged commit (leaf = `text:N@0`, `d7Equal: true`, tags `[]`) and the extra stored-value onChange (count 2 or 4).

So the timing race is Lexical's 30 ms heuristic.

## Fix

`ChangePlugin` (`rich-text-field.tsx:2769-2820`) is now an update listener of its own. It applies the same filter as `OnChangePlugin` with `ignoreSelectionChange` and `ignoreHistoryMergeTagChange`, but it sees every commit, so it tracks whether the editor composed at the previous commit.

- **The rule:** the commit at which `editor.isComposing()` turns true is the start's commit. If that commit leaves `d7Document` equal to the previous state, it is not handed out (`:2803-2809`).
- **What else changes:** nothing. Repeats are withheld, the start-char hold stays, and T42.1's first-value exception still applies to every other first change.
- **No seeding at mount:** the handler is not seeded with the stored value.
- **Import:** `OnChangePlugin`'s import is dropped from the field.

## Tests

No test on main (`2a96a45`) pins the old count. Main's only composition test, `rich-text-keyboard.test.tsx` "an IME composition lands after it", asserts only `lastHtml`. All the changed tests are R1's own.

**Changed (T46.3 and T48.5 pins):**

- `rich-text-line-cells-grids.ts` `runCell`:
  - every ` ime` cell now asserts 1 call (was 2 at a text caret and 1 elsewhere);
  - it also asserts that no value handed out equals the value before;
  - the `AQ el1 ime` pin goes from calls 2 to 1.
- The grid snapshots: only `"calls": 2` changed to `1` on ime cells, nothing else.
  - `grid-points.json`: 16
  - `grid-meeting.json`: 8
  - `grid-unreached.json`: 12
- `rich-text-line-history.test.tsx`, "F12: one Ctrl+Z after a composition in an ordinary paragraph": calls 2 changed to 1.
- `rich-text-line-points.test.tsx`, "a composition at QR@1 is inserted once": calls 2 changed to 1.
- `rich-text-line-composition.test.tsx`, "16.10: no onChange with an unchanged value at a composition's end": value 1 was the stored value. It now pins exactly `Ta0w`, `Tab0w`, `Tabc0w`.
- `rich-text-line-test-kit.test.tsx`, "the net fails on a composition-start character a composition left": the net's second failure is now "no onChange, but the document changed since mount" (was "is not the editor's export"). Nothing is handed out at the start any more.

**Added:** `rich-text-line-composition.test.tsx`, describe "T67.2: a composition's start hands out nothing".

- The g4 record: after the rule, as the first change since mount, one call `aNw`. This holds already at the composition's start.
- At a text caret, a bare `compositionstart`: the editor composes, there is no U+200B, the document is unchanged, and onChange is not called.
- The rule is tied to the start: a cancel's restored stored value is handed out, and the next composition's start is not. The values are `Ta0w`, stored, `Tb0w`.

All 4 tests in this list fail without the fix:

- the changed 16.10 test;
- the 3 added tests.

## 60 + 60 runs at the head (bar 2)

Driver `SP/t67/scripts/gdrive67.py`: t62's `gdrive62X`, with the engine in `SP/t67/src` and this worktree.

| batch                                           | start (load 1/5/15)       | end (load)                | 'a'       | 'a\nb'    |
| ----------------------------------------------- | ------------------------- | ------------------------- | --------- | --------- |
| s (60 each)                                     | 19:57:52 (7.08 7.64 7.78) | 19:59:38 (3.39 6.10 7.21) | **1 x60** | **3 x60** |
| s2 (60 each, start-path instrumented, reverted) | 19:59:53 (3.15 5.91 7.13) | 20:01:47 (4.09 5.80 6.97) | **1 x60** | **3 x60** |

- **Values:** the same in every run.
  - `'a'`: `<p>T0w</p><hr /><p>aNw</p>`.
  - `'a\nb'`: `aNw`, then `bNw`, then `<p>a</p>`.
- **Rest of each record:** one call pattern per record across all 60 runs.
- **Both start paths ran in s2:**
  - `'a'`: 8 runs had no start character (unchanged start commit, withheld), 52 had U+200B;
  - `'a\nb'`: 17 had no start character, 43 had U+200B.
- **Hung runs:** 0.
- **Outputs:**
  - `SP/t67/out/t67-{s,s2,i}.json`;
  - `SP/t67/run.log`;
  - scripts `SP/t67/scripts/count67.py` and `show67.py`.

## Projects, each run whole and alone (bar 3)

Logs are `SP/t67/p-<project>.log`; times and loads are in `SP/t67/proj.log`.

| project                                  | result                                      | wall  |
| ---------------------------------------- | ------------------------------------------- | ----- |
| core-browser-builder-cms-rich-text-lines | 1503 / 1503 pass                            | 480 s |
| ...-lines-b                              | 649 / 649                                   | 318 s |
| ...-rich-text                            | 3110 / 3110                                 | 161 s |
| ...-grids-a                              | 1619 / 1619                                 | 374 s |
| ...-grids-b                              | 1750 pass, 3 fail (pre-existing)            | 398 s |
| ...-grids-c                              | 2243 pass, 1 fail (pre-existing)            | 344 s |
| ...-grids-d                              | 1432 pass, 1 fail (pre-existing)            | 374 s |
| ...-grids-e                              | 1086 pass, 1 fail (pre-existing)            | 446 s |
| core-browser-builder-cms                 | 1609 / 1609                                 | 318 s |
| core-server                              | 2019 pass, 1 fail (pre-existing), 1 skipped | 106 s |

**Earlier runs that do not count:**

- An earlier lines run (593 s) failed only the 3 old count pins, which were then updated.
- An earlier grids-a run, at load 21 with other agents' runs, was cut off with timeouts. It was re-run as above.

**Pre-existing failures:** each one fails the same way at `0d3d0f4`, re-run there detached. None touches a composition.

- Four grid "the cells that differ from the head's" snapshots: `1510-list`, `1510-other`, `1510-mirror` and `1510-quote`. Clipboard cut/copy cells marked "text/plain is read from the structure (D6)" no longer differ.
- `grid-node` "the grid's writes": an image over a rule node-selection lands in the item.
- `grid-points` "the grid's writes": `QR@2` and `RQ@0` "Bulleted list" carets.
- core-server `cms-theme.node.test.ts`: a colour literal at `rich-text-line-paste.ts:33`. That file is untouched here.

## Checks

These all pass:

- `pnpm oxfmt --check`
- `pnpm lint`
- `tsc --noEmit -p apps/builder`
- `pnpm check:runtime-upstream` (byte-identical to upstream `7cab28b`)
