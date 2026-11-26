# Task 26: T58.3, P26-1's cause in ordinary content

Branch `t58-twin` from `origin/claude/native-cms-r1-lines` 6845516. Worktree
`/home/user/OrganizeOS-Websites/.claude/worktrees/agent-a922c4fdbf8e9b1e8`. Not pushed.
Logs: `/tmp/claude-0/-home-user/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/t58/`.

## 1. Pin (commit 225cde6, `test(cms): T58 pin P26-1's ordinary twins`)

- New describe in `rich-text-line-deletes.test.tsx`, after the T13.3 describe: "T58.3: P26-1's ordinary twins, the join
  of a link-only paragraph is its own undo step". Four `expectEdit` tests, source "T58.3, P26-1":
  - `<p>Pw</p><p><a href="https://example.org/">Lw</a></p>`, write `<p>Pw<a>Lw</a></p>`;
  - `<blockquote><p>Q0w</p></blockquote><p><a href="https://example.org/">Lw</a></p>`, write
    `<blockquote><p>Q0w<a>Lw</a></p></blockquote>`;
  - each with Backspace and the word form (Ctrl+Backspace), at Lw@0 by a real click (`at("Lw", 0)`).
  - `expectEdit` checks one onChange, the write, one undo to the state and caret before, redo equal to the write, no
    console errors, the fixed point.
- These shapes were not pinned before: the T55 tests sit in list items (`LI(...)`), not at the root.
- With 16c40cc's history file swapped in (tests kept): all 4 fail, `undo restores the state before: expected false to be
true` (`t58-without.log`). At head: 4 passed (with the 9 T55 tests, 13 passed).

## 2. Root cause (shown by trace)

Instrumented the same shape at both builds (scratch `zzt58-probe.test.tsx` in core-browser-builder-cms, deleted after
each run; at R1 the history file swapped to 16c40cc's in place and restored; at R1 the COMMAND_ORDER dispatcher was
given a temporary per-handler hook, restored after). The probe logs the selection before and after each command
handler and each R1 handler id, wraps `RangeSelection.modify`/`removeText`, records the stack of every first add to
`editor._dirtyLeaves` for the watched and new keys, and logs each commit's dirty leaves/elements and tags.

Shape `<p>Pw</p><p><a>Lw</a></p>` (keys: text Pw #9, paragraph #11, link #12, text Lw #13), Backspace at Lw@0 by click:

|                           | base 2a96a45                                                                                                 | R1 16c40cc history (no fix)                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL handlers         | `$selectionIntoAdjacentBlocks` only: caret stays `text:Lw@0`                                                 | `deletes.edgeForms` moves it to `element:paragraph#11@0`; `removal.mark` then to `text:#15 ""@0` (a new empty text before the link) |
| Lexical `deleteCharacter` | `modify(extend,back)` gives `Lw@0..Pw@2`; `removeText` splices first node Pw (#9) **and last node Lw (#13)** | `modify` gives `#15@0..Pw@2`; `removeText` splices Pw (#9) and the empty #15 (garbage-collected at commit end)                      |
| commit                    | dirtyLeaves(2): #9 Pw, #13 Lw (both unchanged), 4 dirty elements                                             | dirtyLeaves(1): #9 Pw unchanged, 4 dirty elements                                                                                   |
| `@lexical/history`        | 2 leaves: no `isTextNodeUnchanged` merge, HISTORY_PUSH                                                       | 1 leaf, unchanged: HISTORY_MERGE, the step is lost                                                                                  |

The base's second dirty leaf is Lexical's own `lastNode.spliceText(0, lastPoint.offset, '')` in
`RangeSelection.removeText` (lexical 0.21.0 `Lexical.dev.js:6553`), reached because the delete's last point is still in
Lw's text. At R1 two steps before Lexical's handler take the last point off Lw's text:

1. **`$caretBesideInlineEdge`** (`rich-text-line-removal.ts:286`, the move at `:307`), via `$deleteEdgeForms`
   (`rich-text-line-deletes.ts:708`, call at `:716`), registered as `deletes.edgeForms` on DELETE_CHARACTER at CRITICAL
   (`rich-text-line-commands.ts:254-263`, dispatch `:558`). A caret at the backward edge of a link that leads its block
   moves to `element:<block>@0`. This is the step that decides it: from an element point, Lexical's last node is not
   Lw's text either.
2. **`$pointOffNodeEnd`'s mirror branch** (`rich-text-line-removal.ts:398`, branch `:415-425`, empty text `:422`),
   via `$prepareRemoval` (`:891`, call `:907`) from `$removalMark` (`:1360`, call `:1413`), registered as
   `removal.mark` right after `deletes.edgeForms`. It inserts an empty text before the link and puts the caret there.
   Lexical splices that empty text instead of Lw's, and drops it at commit end, so it is no dirty leaf.

Both came in with Task 1's carry of the line prototype (7301ecd; split into modules a81f1ad, registered by
COMMAND_ORDER in 365443a). The base has neither: its CRITICAL DELETE_CHARACTER handler is
`$selectionIntoAdjacentBlocks` (`r1-base/.../rich-text-field.tsx:3526`, registered on every editing command at CRITICAL in `PasteRulesPlugin`, `:3558-3565`), which leaves a text
point alone, and its NORMAL DELETE_CHARACTER handler (`:2415`) applies only after a line break.

- The quote twin and both word forms show the same trace. The word form goes through DELETE_WORD's
  `deletes.edgeForms` (`$backwardFormIsBackspace`, `rich-text-line-deletes.ts:755`), which dispatches
  DELETE_CHARACTER: the same two steps. At the base, DELETE_WORD runs Lexical's `modify(extend,back,word)` from
  `Lw@0`, and Lw is a dirty leaf again.
- Forward twin, traced (`probe-fwd-*.log`): Delete at Lw@2 in `<p>Pw<a>Lw</a></p><p><a>Mw</a></p>`.
  - At R1, `deletes.edgeForms` moves the caret to `element:paragraph@2`. `$pointOffNodeEnd`'s forward branch
    (`rich-text-line-removal.ts:451-462`, empty text appended `:455-456`) then moves it to a new empty text. The commit
    has dirtyLeaves(1): Mw unchanged. The step is lost.
  - At the base, Lw (#13) and Mw are both dirty, so the step is kept.

## Other edits through the same step: probes

The probe is `zzt58-others.test.tsx`: one key, then one Ctrl+Z. The verdict compares the value after the undo with the
value before the key, and the commit's dirty sets are logged. Logs: `others-base.log`, `others-r1-nofix.log`,
`others-r1-fix.log`. "1 unchanged leaf" means `@lexical/history` merges the commit.

| case                                                                                                          | base           | R1 without fix                       | R1 + cb077e5 |
| ------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------ | ------------ |
| A `<p>Pw</p><p><a>Lw</a>x</p>` Backspace / word form at Lw@0                                                  | 3 leaves, kept | 2 leaves, kept                       | kept         |
| B `<p>Pw</p><h2><a>Lw</a></h2>` Backspace at Lw@0                                                             | 2, kept        | **1 unchanged leaf, LOST**           | kept         |
| C `<p><a>Lw</a></p><p>Nw</p>` Delete / Ctrl+Delete at Lw@2                                                    | 2, kept        | 1 leaf but Nw's parent changed, kept | kept         |
| D `<p>Pw<a>Lw</a></p><p>Nw</p>` Delete at Lw@2                                                                | 2, kept        | 1 (parent changed), kept             | kept         |
| D' `<p>Pw<a>Lw</a></p><p><a>Mw</a></p>` Delete at Lw@2                                                        | 2, kept        | **1 unchanged leaf, LOST**           | kept         |
| E `<p>Pw</p><p><a>Lw</a></p>` Delete at Pw@2 (caret in text, no edge form)                                    | 2, kept        | 2, kept                              | kept         |
| F `<p>Pw</p><p>IMGTw</p>` Backspace at the block's element start (the decorator moves, so it is a dirty leaf) | 3, kept        | 3, kept                              | kept         |
| G `<p>Pw</p><p>T<a>Lw</a></p>` Backspace at Lw@0 (link not at the edge; control)                              | kept           | kept                                 | kept         |
| H Enter at Lw@0 (removal.mark skips a collapsed caret that is not a delete)                                   | kept           | kept                                 | kept         |
| I range Pw@2..Lw@0, Backspace                                                                                 | 2, kept        | 2, kept                              | kept         |
| J range Pw@2..Lw@0, a letter                                                                                  | kept           | kept                                 | kept         |
| K `<blockquote><p>Q0w</p><p><a>Lw</a></p></blockquote>` Backspace at Lw@0                                     | 2, kept        | **1 unchanged, LOST**                | kept         |
| L `<ul><li>Pw</li><li><a>Lw</a></li></ul>` Backspace at Lw@0                                                  | 2, kept        | **1 unchanged, LOST**                | kept         |
| M `<p><a>Kw</a></p><p><a>Lw</a></p>` Backspace at Lw@0                                                        | 2, kept        | **1 unchanged, LOST**                | kept         |
| N `<p><a>Lw</a></p><p><a>Mw</a></p>` Delete at Lw@2                                                           | 2, kept        | **1 unchanged, LOST**                | kept         |

Every probed write was the same at all three builds.

The class: a join, backward or forward, by Backspace, Delete or their word forms, at the inline-edge caret of a link
that stands at its block's edge, where the content joined in leaves no other text leaf dirty. Two cases make it:

- the joined block is link-only (P26-1, B, K, L, M);
- the forward delete pulls in a block that leads with a link (D', N).

It does not reach:

- a join that also moves bare text (A, C, D), because Lexical's text merge or the parent change makes the leaf count
  or the leaf changed;
- a decorator-led block (F), because the moved decorator is a dirty leaf;
- Enter, a letter or a paste at a collapsed caret, because `removal.mark` returns early;
- range deletes (I, J), because the range's last point stays in text;
- toolbar link and unlink, because they go through `$rangeEndsIntoText`, not this pair, and change the link node.

cb077e5's merged-edit rule restores the step in every lost case above. The rule is by commit shape, not by key, so the
forward joins (D', N) are covered too. Of these, only the list-item and lined variants and the two twins are pinned. B,
K, M, D' and N are probe results only.

## 3. Checks at 225cde6

- core-browser-builder-cms-rich-text-lines whole: 18 files, 1423 passed (1419 before plus the 4 new tests; `t58/lines-whole.log`).
- `pnpm oxfmt --check`: clean. `pnpm lint`: exit 0. `tsc --noEmit -p apps/builder`: exit 0.
- No scratch file is left; `git status` is clean. The r1-base worktree is unchanged (only its pre-existing untracked
  `zz13base.log`).
