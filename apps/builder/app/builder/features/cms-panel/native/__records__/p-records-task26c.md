# Task 26: answers to the R1 acceptance check (T59), batch 1

Numbers are the report's (docs/superpowers/specs/assets/2026-11-26-rich-text-r1-acceptance-check.md). This batch: defects 4 to 7, fixed and merged at 342bd52 (commits d2b7fc8, 36a85ac, 6e8166e, 3106c74). Defects 1 to 3 follow in the next batch. Defect 8: not a defect (T59.3). Defect 12: fixed at 6845516 (T59.4).

Each project run whole at 3106c74: lines 1,459, lines-b 649, rich-text 3,110, grids-a 1,619, grids-b 1,753, grids-c 2,244, grids-d 1,433, grids-e 1,087, core-browser-builder-cms 1,609, all passed; no grid cell or snapshot changed. oxfmt, lint and tsc clean.

The implementer's full report follows.

Branch `t59-b` from `origin/claude/native-cms-r1-lines` (928c077), worktree
`/home/user/OrganizeOS-Websites/.claude/worktrees/agent-ad46a46afc9c1b637`. Not pushed.
All four defects are fixed. No P record: in each case R1 departed from the ruling.

| Defect | Commit  | Files                                                                 |
| ------ | ------- | --------------------------------------------------------------------- |
| 4      | d2b7fc8 | rich-text-line-deletes.ts, rich-text-line-deletes.test.tsx            |
| 5      | 36a85ac | rich-text-line-removal.ts, rich-text-line-deletes.test.tsx            |
| 6      | 6e8166e | rich-text-line-node-selection.ts, rich-text-line-composition.test.tsx |
| 7      | 3106c74 | rich-text-line-history.ts, rich-text-line-composition.test.tsx        |

## Defect 4 (T59.2, T33.3): Backspace before a heading's leading image or link, after a code block

- Cause: `$noReorderingJoin` (rich-text-line-deletes.ts, the holder check at
  about line 604 before the fix) accepted only a `cms-line` or a paragraph as the
  holder. A heading fell through to Lexical's join. With an image, the heading's text
  moved ahead of the image. With a link, the link's text joined the code block and its
  address was lost.
- Fix: a heading is a holder too. T59.2 says "A heading is not excepted". The refusal
  now covers the three forms (Backspace, Ctrl+Backspace, the line form), in lined and in
  ordinary content. A heading whose text comes first keeps T33.3's carry unchanged
  (`$leaveBehindWhatCodeCannotHold` is not touched).
- Tests: rich-text-line-deletes.test.tsx, `T59.2: <cell>, after a code block, <key> joins nothing`.
  That is 8 cells by 3 keys, 24 tests. The cells: an image leading a heading that starts an
  item; the same after a line; a link leading the heading with the caret before the link and
  with the caret at the link text's start; the same after a line; and the root forms
  (ordinary content) of the image, the link before, and the link text start. Each test
  asserts write null, 0 calls, undo restores with no onChange, and redo equal.
- Fail before: 24 failed, `AssertionError: calls: expected 1 to be +0`.
- Pass after: rich-text-line-deletes.test.tsx 388/388.
- Note: the root heading with a leading image (bwd|R|heading|code|img) wrote the same
  reorder at both builds. Under T59.2 and 16.13 ("in lined and ordinary content"), R1 now
  writes nothing there. This is the same D1 entry 16.13 already holds for a root paragraph.

## Defect 5 (T42.1, D1, D7): Backspace at Zw@0 inside a link that leads the first heading

- Cause (trace in a scratch test, dirty nodes of the update): `$caretBesideInlineEdge`
  (rich-text-line-removal.ts, the `parent.collapseAtStart(selection)` call at about line 315
  before the fix) moved the caret to the heading's start and ran its start rule.
  `HeadingNode.collapseAtStart` replaces a heading that holds content with a new heading of
  the same tag. The trace showed dirtyEl=[heading:new, gone:old, root, link, paragraph] and
  dirtyLeaves=[text], then 1 onChange with the value unchanged. The paragraph twin left
  0 dirty nodes and fired 0 calls.
- Fix: at a backward character delete, when the inline element's parent is a non-empty
  heading and nothing stands before the caret in the document, the delete is decided as
  changing nothing. This happens before the caret is moved: no update, no onChange, no undo
  step, and the caret stays at text:Zw@0, as at the base.
- Tests: rich-text-line-deletes.test.tsx, `T59 defect 5: <cell>, Backspace at the link's text start changes nothing`.
  Four cells: a link and a bold link leading a heading in the first item (lined), and the
  same at the root (ordinary). Each asserts write null, 0 calls, caret text:Zw@0, undo with
  no onChange, and redo equal.
- Fail before: 4 failed, `calls: expected 1 to be +0`. Pass after: 392/392 in the file.
- Out of scope, unchanged: linkOut bs (caret at heading@0) fires 1 call with an unchanged
  value at both builds. The UL item linkIn bs outdents at R1. Neither is in defect 5's list.

## Defect 6 (16.20, F12; T55.2's controls kept): a composition over a range took two undo steps

- Cause (traced with temporary logging in rich-text-line-history.ts and rich-text-line-node-selection.ts
  through the comp-e probe G-boldfirst-sleft):
  - At compositionstart, the forward twin (lexRange: `x.select`) had selection.format = 1,
    the format of the first text. The failing cells had selection.format = 0: a range the
    page makes carries the format its texts share, which is none from plain into bold. After
    16.20's swap the anchor is the bold A0w, but the format stayed 0.
  - Lexical's input handler (`$shouldPreventDefaultAndInsertText`, Lexical.dev.js 2547:
    `anchorNode.getFormat() !== selection.format`) then took the first composed text as a
    controlled insertion. `onInput` (Lexical.dev.js 3020 to 3022) cleared the composition key
    while the page kept composing. The trace shows `composing=false` at "Aa1w", then a second
    compositionstart, so the composition became two settled steps (Aa1w, then Aab1w).
  - X1z and X1n "elsewhere" fwd had the same fmt=0 at compositionstart.
- Fix (rich-text-line-node-selection.ts, `composeForward`): in the same discrete update that
  swaps a backward range, the selection takes the format and style of the text at the
  range's start. This is a selection change only: no node is dirty and there is no tag. The
  first attempt used `selection.setFormat`. RangeSelection has no such method in Lexical 0.21,
  so the update threw and was dropped. The fix assigns `selection.format` directly.
- Tests: rich-text-line-composition.test.tsx, describe `T59 defect 6: a composition over a range is one undo step`,
  with six cells:
  - a backward range from plain into bold by Shift+ArrowLeft;
  - a forward range by Shift+ArrowRight;
  - a backward range across paragraphs by Shift+ArrowUp;
  - the start character elsewhere, forward and backward;
  - a no-break space elsewhere, forward.

  Each asserts the composed value, undo depth 1, one undo to the stored value, and one redo
  to the composed value.

- Fail before: 6 failed, `the composition is one undo step: expected 2 to be 1`.
- Pass after: the composition file 133/133 at the defect 6 commit, and 135/135 with defect 7.
  T55.2's controls (three letters one step, a composition one step, the D7-unchanged edit and
  caret-line work adding none) are in the lines project and pass.
- Probes re-run at the fixed head (comp-e G-* and comp-x X1/X4): every G-boldfirst and X1
  cell undoes in 2 presses (the letter, then the composition), equal to the forward twin.
  Before, G-boldfirst-sleft, -paras-sleft and -paras-sup took 3. No other G-* record
  changed. The comp-skeptic-v F2-bold and F2-boldparas cells use the same stored shapes and
  ways; they were not re-run separately.

## Defect 7 (16.21, T48.5): X4z-includes, the first value held U+200B

- Cause: rich-text-line-history.ts `startCharsLeft` counted the start characters beyond the
  document's count before the composition. In `<p>A0w<strong>B<U+200B>1w</strong></p>`, the
  range A0w@1 to B<U+200B>1w@3 held the stored U+200B. Lexical's start character only brought
  the count back to 1, so `compositionHoldsStartChar` was false and the ChangePlugin handed out
  `<p>A<U+200B><b><strong>w</strong></b></p>`.
- Fix: the composition remembers the text its selection held at its start (`held`, in both
  places a composition is remembered). The baseline leaves out the start characters that text
  held.
- Tests: rich-text-line-composition.test.tsx, describe `T59 defect 7: a composition over a range holding a stored start character`,
  forward and backward. Each asserts that no value handed out holds U+200B, the composed value
  `<p>Aab<b><strong>w</strong></b></p>`, no start character left, and one undo to the stored
  value.
- Fail before: 2 failed, `no value holds the start character: expected '<p ...' not to contain '​'`.
- Pass after: 135/135. Probe X4z fwd and bwd: no value holds U+200B. X1z still holds the
  U+200B the stored value held elsewhere, which is allowed: "a character the value held
  before stays".

## Project results

See the section appended below. Format, lint and types:

- `pnpm oxfmt --check` on native/: clean.
- `pnpm lint` (oxlint --deny-warnings): exit 0.
- `tsc --noEmit -p apps/builder`: exit 0.

Scratch files (a zz test and the copied probe directory) were deleted.

### Whole projects, at head 3106c74, one at a time

- core-browser-builder-cms-rich-text-lines: 1459 passed (18 files). The first run overlapped a local history rewrite (the formatting fold into the defect 6 commit) and its log was cut off, so it was run again at the final head.
- core-browser-builder-cms-rich-text-lines-b: 649 passed.
- core-browser-builder-cms-rich-text: 3110 passed.
- grids-a 1619, grids-b 1753, grids-c 2244, grids-d 1433, grids-e 1087: all passed. No snapshot written or changed, so no grid cell changed.
- core-browser-builder-cms: 1609 passed.

## Review of 342bd52 (defects 4 to 7)

Read-only review. Paths are relative to `apps/builder/app/builder/features/cms-panel/native/`. Line numbers are at HEAD (5fef5e5). I did not run any tests. The fail-before and pass-after counts come from the implementer's report.

## Verdict

None of the four code fixes is wrong. Each matches the rule it cites, and I found no failing scenario outside the cells the defects name. I found no read of Lexical private (`_`-prefixed) state and no env switch. No test on main was rewritten: all four commits only add test lines. There are two low items for the record or docs and two nits.

## Findings, by severity

### 1. Low (docs, not code): D1's sixth entry does not yet name a heading, but d2b7fc8 adds new differences in ordinary content

- Where: rich-text-line-deletes.ts:605-609 (the holder check). The spec entry is in OrganizeOS `docs/superpowers/specs/2026-11-19-native-cms-rich-text-lines-design.md:41` ("Backspace before an image or other child that leads a quote or a line ...").
- Scenario: in ordinary content, `<pre><code>C0w</code></pre><h3><img />X0w</h3><p>E9w</p>`, Backspace before the image. The head and R1 before the fix both wrote the reorder. R1 now writes nothing. The root link-led heading cells (caret before the link, and at the link text's start) also join at the head and now refuse. The defect named only the `{BL,LL}` image cells, but the test pins the root image cell too.
- Rule: T59.2 together with T33.3 and 16.13 ("in lined and ordinary content") does rule this, so the code is right. D1's list is "the one place that names every difference of ordinary content from the head", and T59.1 asks for "the entries added". The entry's wording ("leads a quote or a line") does not cover a heading. The records note at 5fef5e5 says "the same D1 entry 16.13 already holds", which is true in substance but not in wording. The entry, and the PR's list of differences, should name a heading.

### 2. Low (for the coordinating session): T33.3's carry for a heading whose text leads is still not built

- Where: rich-text-line-deletes.ts:652-662. `$leaveBehindWhatCodeCannotHold` returns early for a heading, because `atRoot`, `inQuote` and `inItem` each require a paragraph or a line.
- Scenario: `<pre><code>C0w</code></pre><h3>T1w<a href=...>Lw</a></h3>`, Backspace at T1w@0. Lexical's join runs and the link's text joins the code block, so its address is lost. T33.3 would give `<pre><code>C0wT1w</code></pre><h3><a>Lw</a></h3>`, or a paragraph.
- Rule: T59.2 says T33.3 "is general for a join into a code block" and "A heading is not excepted", but its ruling sentence covers only a leading image or link. These cells are not in defect 4's list, and the fix leaves them unchanged (the implementer says so), so this is not a defect of these commits. It is a possible follow-up to ask about: whether the carry half of T33.3 applies to a heading, and what the left-behind block is (a heading or a paragraph).

### 3. Nit: the comment on `$startUnlikeSelection` says "the range's start", but the code reads the anchor

- Where: rich-text-line-node-selection.ts:242-252, used at 256-260 and 278-283.
- In Lexical 0.21, `RangeSelection.getStartEndPoints()` returns `[this.anchor, this.focus]` (Lexical.dev.js:7155), not the points in document order.
- The code is still right: inside the update, the backward swap runs first, so the anchor is the document start. In the read precondition, `$backward() ||` short-circuits for a backward range.
- There is no failing scenario today. It would break if someone reordered the update or called the helper on its own. Either use `isBackward()` to pick the start, or reword the comment.

### 4. Nit: a condition that can never fail in the defect 5 check

- Where: rich-text-line-removal.ts:315. `parent.isEmpty() === false` is always true, because `parent` holds `inline`. It is harmless.

## Your specific questions

### Defect 4: a heading at the root, where the head reorders

The refusal now covers root headings (finding 1), and that is ruled by T59.2 and 16.13.

A heading whose first child is text, a line break or inline code is not refused: `codeCanHold(first)` holds. In that case, `$leaveBehindWhatCodeCannotHold` is a no-op for headings, so the behaviour from before is kept.

A heading that is a quote's first child after a code block is also refused now. T34.1 and T33.3 cover that.

### Defect 5: can the early "changes nothing" decision fire where Backspace should do something?

I found no such case. The new branch is a strict subset of the old path, which was `$nothingBefore(inline)` followed by `parent.collapseAtStart`:

- The old path, for a heading parent, always ran `HeadingNode.collapseAtStart`. In Lexical 0.21 (LexicalRichText.dev.js:317), that replaces a non-empty heading with a new heading of the same tag. It does nothing else, and in particular it never outdents an item.
- The base's result is nothing: `LinkNode.collapseAtStart` is false and `removeText` on a caret removes nothing.

As a side effect, the old path also dropped a heading's alignment and indent, because `$createHeadingNode` copies neither. The new branch avoids that.

An indented heading is not affected: Lexical's own KEY_BACKSPACE handler outdents it before DELETE_CHARACTER is dispatched.

The heading's start rule is unchanged where something stands before the heading.

### Defect 6: assigning `selection.format` directly

`format` is a public, non-underscore field of `RangeSelection`, and 0.21 has no setter for it. The `setStyle` call that follows sets `dirty`.

Lexical carries `lastSelection.format` into its own compositionstart selection.

The change can only happen inside `composeForward`, which runs only from the compositionstart capture listener. It applies only when the range spans text nodes whose shared format differs from the format of the start node.

In that case Lexical's multi-node `insertText` splices the start character into the start node anyway, through `firstNode.spliceText`. So the composed value is the start node's format either way. The value assertion in each defect 6 test passed before the fix; only the undo depth failed. So no value changes, only the step count, which now matches the forward twin (16.20, F12).

A letter typed after a cancelled composition over such a range now takes the start text's format. That matches 16.20's oracle, the forward range, for "the next letter". A letter typed outside any composition is untouched.

### Defect 7: the `held` baseline across successive compositions and undo

`held` is taken per record: at line 185 from `before`, captured before the point moves (direction does not change `getTextContent`), and at line 591 from `prevEditorState`.

- A record is deleted at settle (written text), on a historic tag, or on a void. So a second composition, or one after an undo or redo, starts from a fresh record with `held` empty at a caret. A stale `held` cannot carry over.
- For a cancelled composition over a range that holds a stored U+200B, the record stays in the "ended" phase. The new baseline is correct there too. Before the fix, Lexical's start character there was not counted at all, so the fix also corrects that case.
- `held` lowers the baseline only by characters the composition replaces. A composition over a range always replaces the range: Lexical's start insertion, then `removal.mark` (5.4). So I found no case where it withholds a value wrongly or removes a stored character.
- U+200B outside the range (X1z) is still kept.

### Tests

- Every test addition is new; none rewrites an existing test, and there are no `skip` or `only` calls and no env reads.
- Each pins a ruled result:
  - Defect 4: `write: null`, plus no onChange, undo and redo (T59.2, T33.3's word and line forms).
  - Defect 5: no onChange, no undo step, and the caret at `text:Zw@0`, as at the base (D1, D7).
  - Defect 6: the composed value, one undo step, one undo and one redo (F12, 16.20).
  - Defect 7: no U+200B in any value, the composed value, and one undo (16.21, T48.5).
- Defect 5's root cell with a bold link, and defect 4's cells with the caret at the link text's start, go beyond the cells the defects list. They sit under the same rules (D1 count; T59.2), and the report says they failed before the fix.
- In the defect 6 test, NBSP is U+00A0 in the source, as its name says.

### Private state

None read in the source or the tests.
