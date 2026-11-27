# Task 26: T88, Delete before a line break that ends its line before a block (7c4a759)

- Branch `t88` in worktree `/home/user/OrganizeOS-Websites/.claude/worktrees/agent-adec4af23f350fadc`, from `a16c012` (native code =
  `a3bc7d8`). One commit: `7c4a759` (fix and tests). Not pushed, not merged.
- Base: `SP/r1-base` (`2a96a45`), left as found (its one untracked file, `zz13base.log`, was there before and is not mine).
- Measurement driver: T79.6's engine (`SP/ps/zzps-engine.tsx`) run by `SP/t88/erun.sh` from `SP/t88/gen.py` (caret by code,
  `caretCode <word> end`); data `SP/t88/out/{base,r1,fix}/m/records.json`; table `SP/t88/table-m.txt` (from `SP/t88/table.py`).
  Every cell: the action, undo (compared with the state before), redo (compared with the write), then the letter `k`. Every run
  under `timeout -s KILL 600`; none hung, no record logged an error.
- Word form: Ctrl+Delete. Line form: a `beforeinput` `deleteSoftLineForward` (Chromium on Linux sends no line delete by key).

## P record P-T88-1: the measurement (T88.3, item 1)

`UL(x)` = `<ul><li>Pw</li><li>x</li><li>Nw</li></ul>`. The caret is set by code at the end of T0w (X0w in the quote). "R1" is
`a3bc7d8`, "fix" is `7c4a759`. In every cell at every build: onChange 1 for the action (0 where nothing is written), 1 for undo, 1
for redo, 1 for the letter; undo restores the state and caret before, redo equals the write.

| shape                                                               | form        | base                                                    | R1           | ordinary twin (both builds)                                                                                            | fix                                                   |
| ------------------------------------------------------------------- | ----------- | ------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| TBQ `UL(T0w<br><blockquote><p>Q2w</p></blockquote>)`                | Delete      | `T0w<blockquote></blockquote>Q2w`                       | `T0wQ2w`     | `<p>T0w</p><blockquote><p>Q2w</p></blockquote>` (break only)                                                           | `T0w<blockquote><p>Q2w</p></blockquote>`, caret T0w@3 |
|                                                                     | Ctrl+Delete | same as Delete                                          | `T0wQ2w`     | break only                                                                                                             | `T0w<blockquote><p>Q2w</p></blockquote>`              |
|                                                                     | line form   | nothing                                                 | nothing      | nothing                                                                                                                | nothing (unchanged)                                   |
| TBC `UL(T0w<br><pre><code>C2w</code></pre>)`                        | Delete      | `T0wC2w`                                                | `T0wC2w`     | `<p>T0w</p><pre>...` (break only)                                                                                      | `T0w<pre><code>C2w</code></pre>`                      |
|                                                                     | Ctrl+Delete | `T0wC2w`                                                | `T0wC2w`     | break only                                                                                                             | `T0w<pre><code>C2w</code></pre>`                      |
|                                                                     | line form   | nothing                                                 | nothing      | nothing                                                                                                                | nothing                                               |
| TBH `UL(T0w<br><h3>H2w</h3>)`                                       | Delete      | `T0wH2w`                                                | `T0wH2w`     | `<p>T0w</p><h3>H2w</h3>` (break only)                                                                                  | `T0w<h3>H2w</h3>`                                     |
|                                                                     | Ctrl+Delete | `T0wH2w`                                                | `T0wH2w`     | break only                                                                                                             | `T0w<h3>H2w</h3>`                                     |
|                                                                     | line form   | nothing                                                 | nothing      | nothing                                                                                                                | nothing                                               |
| TBL `UL(T0w<br><ul><li>L2w</li></ul>)` (nested list)                | Delete      | `T0w<ul><li>L2w</li></ul>`                              | same         | `<p>T0w</p><ul>...` (break only)                                                                                       | same as R1 (already the twin's)                       |
|                                                                     | Ctrl+Delete | `T0w<ul>...`                                            | same         | break only                                                                                                             | same as R1                                            |
|                                                                     | line form   | nothing                                                 | nothing      | nothing                                                                                                                | nothing                                               |
| TBR `UL(T0w<br><hr>)` (rule)                                        | Delete      | `T0w<hr />`                                             | `T0w<hr />`  | `<p>T0w</p><hr />` (break only)                                                                                        | same as R1 (already the twin's)                       |
|                                                                     | Ctrl+Delete | `<li>T0wNw</li>` (break, rule and the next item's join) | same as base | break only                                                                                                             | `T0w<hr />`                                           |
|                                                                     | line form   | nothing                                                 | nothing      | nothing                                                                                                                | nothing                                               |
| TBRT `UL(T0w<br><hr>T3w)` (extra)                                   | Delete      | `T0w<hr />T3w`                                          | same         | `<p>T0w</p><hr /><p>T3w</p>` (break only)                                                                              | same as R1                                            |
|                                                                     | Ctrl+Delete | `T0wT3w`                                                | `T0wT3w`     | break only                                                                                                             | `T0w<hr />T3w`                                        |
|                                                                     | line form   | nothing                                                 | nothing      | nothing                                                                                                                | nothing                                               |
| XBQ `<blockquote>X0w<br><p>X1w</p></blockquote>` (lined root quote) | Delete      | `<blockquote>X0wX1w</blockquote>`                       | same         | twin `<blockquote><p>X0w<br></p><p>X1w</p></blockquote>`: `<blockquote><p>X0w</p><p>X1w</p></blockquote>` (break only) | `<blockquote>X0w<p>X1w</p></blockquote>`, caret X0w@3 |
|                                                                     | Ctrl+Delete | same                                                    | same         | break only                                                                                                             | `<blockquote>X0w<p>X1w</p></blockquote>`              |
|                                                                     | line form   | nothing                                                 | nothing      | nothing                                                                                                                | nothing                                               |

Carets: base and R1 leave the caret in the joined text at @3; the fix leaves it at `cms-line[0]/text[0]@3 "T0w"` (X0w@3), as the
twin's `p[0]/text[0]@3`. The letter after lands there in every fixed cell (`T0wk<blockquote>...`).

Controls, measured at all three builds, unchanged by the fix:

| cell                                                                                         | base                              | R1 = fix                                              |
| -------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------- |
| TBQ, Backspace at Q2w@0 (D3's fourth case)                                                   | `T0w<blockquote></blockquote>Q2w` | `T0w<blockquote><p>Q2w</p></blockquote>`, caret Q2w@0 |
| TBC, Backspace at C2w@0                                                                      | `T0wC2w`                          | `T0w<pre><code>C2w</code></pre>`, caret C2w@0         |
| TBH, Backspace at H2w@0                                                                      | `T0wH2w`                          | `T0w<h3>H2w</h3>`, caret H2w@0                        |
| TCT `UL(T0w<pre><code>C1w</code></pre>T2w)`, Delete / Ctrl+Delete at T0w@3 (D3's third case) | `T0wT2wC1w`                       | `T0wC1w<br />T2w`                                     |
| TBT `UL(T0w<br>T1w<blockquote>...)`, Delete / Ctrl+Delete at T0w@3 (break followed by text)  | `T0wT1w<blockquote>...`           | same as base                                          |

Second Delete (TBQ, Delete twice from T0w@3): R1 `T0wQ2w` then `T0w2w`; fix `T0w<blockquote><p>Q2w</p></blockquote>` then
`T0wQ2w`, caret T0wQ2w@3: the second Delete meets the quote at the line's end and is D3's third case.

**Outcome.** Every cell whose twin removes only the break now gives the twin's result. Every twin in the set removes only the break
for Delete and Ctrl+Delete; for the line form every twin removes nothing, and so do both builds, so the line form is not covered by
the fix and is left as it is. No case was found whose twin does something else. Two cells beyond TBQ, TBC and TBH change by the
same rule: Ctrl+Delete before a rule (TBR, TBRT), where the head and R1 also removed the rule (and in TBR joined the next item).
These follow T88.2's rule as stated ("a block follows the line"; a rule is a block decorator, and the measurement set names the
rule); flagged for the coordinating session in case a rule is meant to be out of the rule's scope.

## Cause

At T0w@3 in a line that ends `T0w<br>` before a block, no row of the Delete chain takes the key (T87's trace:
`rich-text-line-commands.ts` KEY_DELETE CRITICAL, DELETE_CHARACTER CRITICAL, NORMAL and LOW all return false; `$blockEdge` needs the
caret at a block's edge, `$lineEndIntoBlock` an element point after the break). Lexical's `deleteCharacter` (and its word form)
extends one step forward through the page, which in a list item or quote passes the break and lands at the start of the block's
text; the range removal joins that text onto T0w and 5.4's emptied rule removes the empty block. In the ordinary twin the step stops
at the paragraph's end, so only the break goes.

## Fix

- `apps/builder/app/builder/features/cms-panel/native/rich-text-line-deletes.ts:331` `$lineBreakBeforeBlock` (with
  `$nodeAfterPoint` above it): forward, collapsed; the node directly after the point (a text point at its text's end, climbing out of
  inline elements, or an element point's child) is a line break that is the last child of a line, with something before it in the
  line; the line is in a lined container; the line's next sibling is a block (a non-inline element that is not a line, or a block
  decorator). Then the break is removed and the caret stays.
- `rich-text-line-commands.ts`: the id `deletes.lineBreakBeforeBlock` (`:102`), its handler (`:570`), and the row in the one stated
  order: DELETE_CHARACTER_COMMAND LOW (`:280`) and DELETE_WORD_COMMAND LOW (`:324`), directly after `deletes.blockEdge` (5.8: the
  line break at a block's edge, before the item-start join, ahead of Lexical's own delete). Not on DELETE_LINE_COMMAND (the twin's
  line form removes nothing).
- The order's test: `rich-text-line-commands.node.test.ts` ("the handler order is the one this plan states") pins the new row in
  both places; it passes (3 of 3).

## Tests

`rich-text-line-deletes.test.tsx`, describe "T88: Delete before a line break that ends a line before a block ...", 21 tests, real
click at T0w's end, each through `expectEdit` (write, caret, one undo that restores, its redo, the letter after, no console error):

- Fails with the fix taken out (`$lineBreakBeforeBlock` made to return false; run `SP/t88/run-t88-nofix.log`: 15 failed, 6 passed),
  passes with it (`SP/t88/run-t88.log`: 21 passed):
  TBQ, TBC, TBH Delete at depth 1; TBQ at depth 2; TBH in an ordered list; TBC at depth 7; Ctrl+Delete in TBQ, TBC, TBH, before a
  rule, before a rule that text follows; the lined root quote, Delete and Ctrl+Delete; TBQ Delete after ArrowLeft from Q2w@0 (the
  element point, T88.6); the second Delete (D3's third case).
- Controls (pass with and without the fix): TBQ line form changes nothing; Backspace at Q2w@0, C2w@0, H2w@0 (D3's fourth case);
  TCT Delete at T0w's end (D3's third case); Delete before a break that text follows in the same line.

## Task 22 grid cells

No grid cell changes. grids-a..e pass whole at `7c4a759` with their snapshots and fixtures as committed (no snapshot failed,
was written or went obsolete; the worktree stayed clean after the runs), so no snapshot was updated. The grids hold no cell of
T88's shape whose value the fix changes.

## Projects at `7c4a759`

Each project whole, one at a time (`SP/t88/proj/*.log`, `SP/t88/proj/summary.txt`):

| project                                  | result                                                                                                 | secs |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---- |
| core-browser-builder-cms-rich-text-lines | 1575 passed                                                                                            | 430  |
| ...-lines-b                              | 671 passed                                                                                             | 271  |
| ...-rich-text                            | 3110 passed                                                                                            | 144  |
| ...-rich-text-sweeps                     | 10 passed                                                                                              | 113  |
| ...-grids-a                              | 1619 passed                                                                                            | 249  |
| ...-grids-b                              | 1753 passed                                                                                            | 255  |
| ...-grids-c                              | 2255 passed                                                                                            | 263  |
| ...-grids-d                              | 1433 passed                                                                                            | 240  |
| ...-grids-e                              | 1087 passed                                                                                            | 308  |
| core-browser-builder-cms                 | 1609 passed                                                                                            | 283  |
| core-server                              | 2020 passed, 1 skipped (`safe-resource-fetch.live.server.test.ts`, its own live skip, not this task's) | 71   |

`pnpm oxfmt --check` clean; `pnpm lint` exit 0; `tsc --noEmit -p apps/builder` exit 0; `check:runtime-upstream` OK (byte-identical
to upstream `7cab28b`); `check:every-test-runs` OK (1149 of 1152, 3 exempt).

Note: this head holds T88's fix only, not T83's composing-guard fix (P-t81-6), which another agent makes on another branch; T88.7's
combined run is for the head that holds both.

## Diff

`git diff --stat a3bc7d8..HEAD`: 87 files, 18498 insertions. Of these, 83 are the records and acceptance data that `a16c012`
already carried over `a3bc7d8` (`__records__/`, `acceptance/`). The code, all in `7c4a759`:

```
 .../native/rich-text-line-commands.node.test.ts    |    2 +
 .../cms-panel/native/rich-text-line-commands.ts    |    6 +
 .../native/rich-text-line-deletes.test.tsx         |  186 +
 .../cms-panel/native/rich-text-line-deletes.ts     |   66 +
```
