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

# Batch 2: defects 1 to 3, T64.1 and T64.2

Merged at 6b9fd06 (commits 9e50647, 1e7c0c4, db9d84e, eb216be, 6b9fd06).

Worktree: /home/user/OrganizeOS-Websites/.claude/worktrees/agent-a3efbc70d1289fb8a, branch `t59-a`, from `2be768a`; `claude/native-cms-r1-lines` head `8dd5ace` merged in at `9503d15`. Not pushed, not merged.

| Item     | Commit    | Answer         |
| -------- | --------- | -------------- |
| Defect 1 | `9e50647` | fixed          |
| Defect 2 | `1e7c0c4` | fixed          |
| Defect 3 | `db9d84e` | fixed          |
| T64.1    | `eb216be` | fixed          |
| T64.2    | `6b9fd06` | both nits made |

## Defect 1: text/plain loses the new line after a start at a block's end

Cause: `$plainTextOf` (rich-text-line-clipboard.ts) walks only the nodes the range holds. A start at a text's end (`rq@2`, `Q0w@3`, `Pw@2`) or on an element point holds none of the leaf it rests on. Lexical's own walk (the head's) starts at that leaf, so the block boundary that comes next reads as a new line. A start on the empty caret line after a rule (the backward walks' stop 1) also lost it.

Fix: the walk starts as Lexical's does. When the leaf the start rests on is not held (a text end, or the child an element point resolves to), or when the start is on an empty line, the next block boundary gives a new line. No text is added.

Tests: rich-text-line-clipboard.test.tsx, describe "T59 defect 1: text/plain keeps the head's new line after a start at a block's end (D6, 5.8, T39.5)", 6 tests:

- S2b: a copy from rq@2 to bbq@3 is the head's \nbbq
- c1 S3: Shift+Right twice from Q0w's end copies the head's two new lines
- a cut walk's first stop that joins two items writes one new line: QR, forward from Pw's end / RQ, forward from Pw's end / QR, backward from Nw's start / Rlast, backward from Nw's start

Runs: 6 failed without the fix ('bbq', '\n', '' four times), 6 passed with it. The whole file passed after the fix (107), and so did rich-text-line-grid-clipboard (273, grids-a).

### Measurements at both builds

Probe: SP-local `rich-text-zzt59-probe.test.tsx`, run at `<base>` (r1-base, `timeout 600`) and at the branch, same gestures. The values below are text/plain.

| Record                                                       | base                              | R1 before      | R1 after      |
| ------------------------------------------------------------ | --------------------------------- | -------------- | ------------- |
| S2b rq@2 to bbq@3 (copy)                                     | "\nbbq"                           | "bbq"          | "\nbbq"       |
| c1 S3 Q0w end, Shift+Right x2 (copy)                         | "\n\n"                            | "\n"           | "\n\n"        |
| nav cut, F stop 1 (QR, RQ, QRQ, RQR, QRR, Rfirst, Rlast, d2) | "\n"                              | ""             | "\n"          |
| nav cut, F stops 2 and 3                                     | "\nQ", "\nQ0", "\n\n\n" and so on | one "\n" short | equal to base |
| nav cut, B stop 1 (RQ, QRQ, Rfirst)                          | "\n"                              | ""             | "\n"          |
| clip-d rec 2, 3 (after an image to B1w@1)                    | "\nB"                             | "B"            | "\nB"         |
| clip-d rec 34, 35 (after an item's image to Nw@1)            | "\nN"                             | "N"            | "\nN"         |

After the fix, R1 has as many new lines as the base on every record above. A few records still have fewer, and in each the head over-copies a node the selection does not hold. Its text/html carries that node, and the extra "\n" is that node's text, so these are left as R1 gives them (D6: "the clipboard holds nothing outside the selection"; FS9 pinned on main):

| Record                                                             | base text/plain, text/html                                                       | R1 text/plain, text/html                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| nav cut B stop 1, items ending in a rule (QR, RQR, QRR, Rlast, d2) | "\n\n", `<ul><li><hr></li><li></li></ul>` (the head's cut also removes the rule) | "\n", `<ul><li></li><li></li></ul>`                                     |
| clip-d rec 18, 19 (after the lone break to B2w@1)                  | "\n\nB", `<p><br></p><p>B</p>`                                                   | "\nB", `<p></p><p>B</p>`                                                |
| clip-x 3#7, 3#8 (after the rule to Nw@1)                           | "\n\nN", `<ul><li><hr></li><li>N</li></ul>`                                      | "\nN", `<ul><li></li><li>N</li></ul>`                                   |
| c1 S3 one Shift+Right (FS9)                                        | "\n\n\n", the whole item with its `<br>`                                         | "\n", `<blockquote><p></p></blockquote>` (pinned on main, spec FS9 row) |

## Defect 2: Bulleted list after an item's final rule

Cause: in the toolbar's toggleList, the caret is kept by the rule (an element point after it). After REMOVE_LIST the rule still stands inside the paragraph the item became. The commit's `$liftBlocksOutOfTextBlock` transform then lifts the blocks out and removes that paragraph. The caret point went with it and Lexical moved it to Pw's end. TR passed only because its paragraph survives.

Fix (rich-text-field.tsx, toggleList's caret restore): a block the caret is kept by is lifted out of its paragraph or heading right away, as the transform would do at the commit. The caret is then set beside it at the root.

Branch after the fix, by the record's gesture (a click 3 px inside the item's bottom right):

| Record          | Caret after the action | Caret after undo            | Caret after redo | Letter                       |
| --------------- | ---------------------- | --------------------------- | ---------------- | ---------------------------- |
| QBR, QTR, d2 CR | `element:root@4`       | the caret before the action | `element:root@4` | `...<hr /><p>k</p><p>Nw</p>` |

Before the fix the caret after the action was `text:Pw@2`, and the letter gave `<p>Pwk</p>`. The write is unchanged.

Tests: rich-text-line-toolbar.test.tsx, describe "T59 defect 2: list off at a click after an item's final rule (5.7, V16)": "QBR / QTR / d2 CR: Bulleted list leaves the caret after the rule, and after redo". They use expectEdit with the caret, typed after undo and redo, undo restores, and redo equals.

Runs: 3 failed without the fix (caret `text:Pw@2`), 3 passed with it.

Note: in the DOM a nested list stands in an item of its own, so d2 CR's item is `li[3]`.

## Defect 3: Image at the ArrowRight x5 stop in QR and QRQ

Cause: the stop node-selects the rule. Image's click stored the caret only for a range selection, so a node selection gave null, and the insert took the end-of-document fallback.

Fix (rich-text-field.tsx, ImageButton's click): a block node-selected in a lined container gives the caret a typed letter takes. That is the element point directly after the node (D15, as `$nodeSelectionIntoLine` does), and the insert resolves it with `$resolveLinedPoints(true)`. Ordinary content is unchanged.

Branch after the fix, letter and image at the same caret:

| Shape | Letter    | Image                                        |
| ----- | --------- | -------------------------------------------- |
| QR    | `<hr />k` | `<hr /><img />`                              |
| QRQ   | `kQ2w`    | `<blockquote><p><img />Q2w</p></blockquote>` |

Before the fix, Image appended `<p><img /></p>` at the document's end.

Tests: rich-text-line-toolbar.test.tsx, describe "T59 defect 3: Image with the rule node-selected lands where a letter does (D15, D1)": "QR / QRQ: the image after the rule, not at the document's end". They first assert that the caret before Image is `node:horizontalrule`.

Runs: 2 failed without the fix (document end), 2 passed with it.

## T64.1: the code-block carry for a heading

`$leaveBehindWhatCodeCannotHold` (rich-text-line-deletes.ts) now takes a heading wherever it stands. What the code block cannot hold stays behind in a new heading of the same tag.

Tests: rich-text-line-deletes.test.tsx, "T64.1: ..." beside T33.3's cases: a link later and an image later in a heading, at the root and in an item, each with Backspace, Ctrl+Backspace and lineBack (12 tests). They check the write, the address, the caret `text:C0wT1w@3`, undo and redo.

Runs: 12 failed without the fix (root link `<pre><code>C0wT1wLw</code></pre>`, root image `<p><img /></p>`), 12 passed with it. The whole deletes file passed (412).

## T64.2: review nits

- rich-text-line-node-selection.ts: the comment on `$startUnlikeSelection` now says it reads the anchor, which is the range's start only once the backward swap has run first in the update. In the read that gates the update, a backward range runs the update anyway.
- rich-text-line-removal.ts: removed the always-true `parent.isEmpty() === false`.

## Checks at the head (`6b9fd06`)

- Test files: deletes 412, node-selection 59 and composition 135, all passed.
- `pnpm oxfmt --check`, `pnpm lint`, `pnpm exec tsc --noEmit -p apps/builder` and `pnpm check:runtime-upstream` all exit 0.
- The lines project run whole: 18 files, 1490 tests passed, 487 s.
- The lines-b project run whole: 3 files, 649 tests passed, 352 s.

## Review of 6b9fd06 (defects 1 to 3, T64)

Read-only review. No tests were run. All paths are under `apps/builder/app/builder/features/cms-panel/native/`.

Verdict: no blocking findings. Each fix matches the rule it cites. Two low findings and two notes follow.

## Findings, by severity

### L1 (low). Defect 3: the stored caret is a container index, which can go stale during an upload

`rich-text-field.tsx:1260-1272`, used by `insertImage` (`:1145-1163`).

The caret is stored as `element:<container>@<index of the rule + 1>`. `insertImage` only checks that the keys still exist (`isAttached`). It checks neither the offset nor what now stands at that index.

Scenario: in QR, node-select the rule (index 2 in `li[quote, hr]`) and click Image. While the upload runs, press Backspace, which removes the rule. The upload then finishes and sets a point at `li@2` on an item that has one child. Lexical's point check (dev) can throw, or the image can land somewhere else. Also in QRQ: anything inserted before the rule in the item while the upload runs moves the image off the rule.

Rule: D1's seventh entry: "the end-of-document fallback stays only for a place that is gone when the upload finishes." A range caret held a text point, which carries its node with it, so this exposure is new with the element point. Fix: also store the rule's key, and at insert time read the place again from where the rule now stands. If the rule is gone, fall back as for any place that is gone. The `fits` guard that `$keepPress` already has would do as a minimum. This is an edge case, outside the defect's records.

### L2 (low, scope). Defect 2's lift reaches past the three cells and no test covers the extra cases

`rich-text-field.tsx:1513-1529`

The lift runs for any element caret kept by a non-inline node that sits in a paragraph or heading after REMOVE_LIST. That covers more than "after an item's final rule". It also covers a caret before an item's leading rule (`{hr, after:false}`) and a caret after an item that ends in a quote or a code block. In those cases the caret now ends up beside the block at the root. Before, it went wherever Lexical moved it when the transform removed the emptied paragraph.

This follows toggleList's own rule ("an element caret is kept by the node beside it") and the 5.7 row, and the implementer reports that the whole lines grid passed. So I count it as within the rule. But no test pins those extra carets. The write cannot change: `$liftBlocksOutOfTextBlock` is the commit transform itself, it lifts the same blocks in the same order and is idempotent, and it runs inside the same update, so undo stays one step.

Ordinary content cannot reach the lift, because in ordinary content a paragraph or heading never holds a block node. Insert-list paths keep their nodes in items or at the root. Detached kept nodes (lines unwrapped by `$unwrapListLinesAtCaret`) have a null parent, so the loop skips them. The loop ends because each pass moves a block out.

Suggestion: add one cell for the leading-rule caret (RT, list off at `li@0`), or note in the P record that the change reaches it.

### N1 (note). Defect 1's open call: the implementer's reading is right

The records in question are B stop 1 on items ending in a rule, clip-d 18/19, clip-x 3#7/3#8 and FS9. In each one, the base's extra "\n" is the text of a node the selection does not hold. A `HorizontalRuleNode` and a `LineBreakNode` each return "\n" from `getTextContent()`. The head picks that node up because Lexical 0.21's `getNodes()` resolves an element-point start through `getDescendantByIndex` to the last child, and 0.21 has no over-selection guard (checked in `lexical@0.21.0/Lexical.dev.js`, `getNodes`). The base's text/html carries that node too, and the head's cut removes it.

D6 settles this case directly: "Where the head's copy holds more than the selection, the build's does not follow it", plus "the clipboard holds nothing outside the selection". The spec's 5.8 row says "the head's for the same selection, plus one new line". The words "never fewer new lines" appear only in the acceptance check's Expected, which itself opens with "wherever the head does not over-copy". FS9 is the same pattern, already ruled. R1's own invariants also hold: the html lacks the rule and the cut keeps it.

So the tests at `rich-text-line-clipboard.test.tsx:1537` and `:1544` (QR and Rlast backward, text/plain "\n") pin a result that D6 rules. The P record should still quote D6's over-copy sentence so the coordinating session can confirm it. As things stand, the tests pin the reading before the coordinator has confirmed it.

### N2 (nit). Defect 3 copies `$nodeSelectionIntoLine`'s point code

`rich-text-field.tsx:1263-1271` repeats `rich-text-line-node-selection.ts:48-57`: the same last node, the same `isLinedContainer` guard and the same index + 1. A shared helper that returns the point would keep "where a letter lands" and "where Image lands" from drifting apart. This is not a correctness issue today.

## Checks that passed

**Defect 1** (`rich-text-line-clipboard.ts:152-174`)

- No text is added. The change only sets `prevWasElement` and `lastInBlockText`, so it can add a "\n" only at the first block boundary after the start, and that boundary is inside the range.
- The change fires only when the start's leaf is not held. A text end is never held, because `lastChar == from`.
- In ordinary content it matches Lexical's `getTextContent`. The head's first node is that same leaf, which sets `prevWasElement = false`. The only remaining difference is the leaf's own text, where the head over-copies and D6 says not to follow it. Lines do not apply, and the start is the same in both: the walk reads the start in the order of the head's `getNodes`.
- A range inside one text node is unchanged, because the start's leaf is held.
- A node selection and a drag are untouched.
- The empty-line branch applies to CMS lines only.

**Defect 3**

- Ordinary content is unchanged. An image is node-selected inside a paragraph, or a rule at the root, and neither is a lined container, so the code returns null as before (and as on main).
- The insert goes through `$resolveLinedPoints(true)`, as typing does. Defect 3's tests assert the rule node-selection before the action.

**T64.1** (`rich-text-line-deletes.ts:657-697`)

- The write matches T64.1's text exactly: `<pre><code>C0wT1w</code></pre><h3><a>Lw</a></h3>`, with the address kept, and the same for an image, at the root and in an item, with the same tag.
- The leading-child refusal (T59.2 and T63.1) still runs first, because `codeCanHold(first)` gates the carry.
- The carry runs only on the delete-command path (`event === null`), so the word and line forms follow and undo stays one step. The tests check the write, the address, the caret `text:C0wT1w@3`, undo and redo.
- A heading that is a quote's first child, which T64.1 does not name, also stays in place as a heading. That is T34.1 by analogy and is consistent with the rulings.

**T64.2**

- The comment is accurate. `getStartEndPoints()` returns `[anchor, focus]` in 0.21, and the gate short-circuits on `$backward()`.
- `parent.isEmpty() === false` was always true: the parent contains `inline`.

**Hygiene**

- No new `_`-prefixed or `__` reads, no `process.env` or `import.meta.env` switches, no `.skip` or `.only` in any added line.
- The commits add tests only to `rich-text-line-*.test.tsx`, none of which exist on main. No test that exists on main was touched, and `rich-text-field.tsx`'s tests on main are untouched.
- Each new test asserts the value the defect or ruling states. The one exception is N1's two backward cells, which pin the D6 reading.

# Batch 3: defects 9 to 11

Merged at 40e0ac1 (commits 1747f7a, 66fec00, 42d2883).

Branch `t59-c` off `6c9ce85`, in a clone at
`/tmp/claude-0/-home-user/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/t59c` (my assigned worktree was a checkout of
the OrganizeOS repo, not the fork, and the worktree guard refused git on the fork's shared checkout, so the branch lives
in a local `git clone --shared` of `/home/user/OrganizeOS-Websites`; fetch it from there). Not pushed.

| Defect | Answer                            | Commit                                                                                                    |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 9      | Fix                               | `1747f7a` fix(cms): T59 defect 9 an empty line after a joined block stays                                 |
| 10     | Fix                               | `66fec00` fix(cms): T59 defect 10 a range into a nested item keeps PR #116's tail join                    |
| 11     | Measured at both builds, then fix | `42d2883` fix(cms): T59 defect 11 a range that holds an item's text but not its image copies no list item |

No P record. No test on main rewritten; every change is under `N/`.

## Defect 9 (keys-phase-1 k3 TCB/THB)

- Rule read: D3 third case, the parenthesis: "the line break that is the whole of an empty line D19 keeps does not count
  as standing at an edge"; T23.1: a line of one line break is the lined form of an empty paragraph (the same stored
  shape `T0w<h3>H1w</h3><br>` is T23.1's own fixture in `rich-text-line-removal.test.tsx`). Not contested.
- Cause: `rich-text-line-normalise.ts:142` (`$linesNeedingBreak`, at `6c9ce85` line 139): the second line got no D3
  break when its first child was a line break, including when that break is the whole of an empty line. So the join's
  separator was dropped and the empty line's break served as the separator: `T0wH1w<br />`, one visual line.
- Fix: the break is skipped only for a line that starts with a break and holds more than that break.
- Tests (`rich-text-line-normalise.test.tsx`, describe "... an empty line after the block stays (T59 defect 9)", 6
  tests): heading and code block, each by Backspace at the block's start, Delete at T0w's end, and Backspace over
  `T0w@1` to `X1w@2`.
  - Before (at `6c9ce85` + tests): 6 failed. Received `T0wH1w<br />`, `T0wC1w<br />`, `Tw<br />`.
  - After: 6 passed; the file 40 of 40.
  - Writes now: `<li>T0wH1w<br /><br /></li>`, `<li>T0wC1w<br /><br /></li>`, `<li>Tw<br /><br /></li>`.
- Not changed: `$removeRangeWithBreak` (`rich-text-line-removal.ts:247`, Enter or Shift+Enter over a range from a line
  into a block) has the same `isLineBreak(next.getFirstChild())` test. Enter over such a range followed by an empty line
  is not among the defect's records and no rule names its write, so it is left as is. It is a candidate for the second
  comparison (T59.6).

## Defect 10 (paste-sweeps B|d3 | p-n | ol HT, quote ul HT)

- Main's nearest case: `rich-text-structure.test.tsx`, "the join leaves no nested list of the text after the caret
  behind (Z9)", the Z13 range rows "paste of a range ending in the nested item (Z13)" and "drop of ..." (stored
  `<ul><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul>`, range `s1q@2` to `n1q@1`, paste
  `<ol><li>Aq</li><li><hr>T1q</li></ol>`). They pin the tail join at depth 1: `...<ol><li>Aq</li><li><hr />T1q1q</li></ol><ul><li>t1q</li></ul>`,
  then a letter lands `T1qZ1q`. The sweep's `d3` is the same range one wrapper deeper (stored
  `<ul><li>a1q<ul><li>p1q<ul><li>s1q<ul><li>n1q</li></ul></li><li>t1q</li></ul></li><li>u1q</li></ul></li></ul>`,
  `p1q@2` to `n1q@1`, from the sweep's `zzr10-beh-w-cases.ts`).
- Cause: `rich-text-line-paste.ts:35` (`inLined`; at `6c9ce85` line 29) climbed with `$findMatchingParent` past the
  start's own item (text only, not lined) up to the outer wrapper item that holds only the nested list, which
  `isLinedContainer` counts as lined (5.1: lined for a point on itself). So branch 1 of `$intoLine`
  (`rich-text-line-paste.ts:67`) removed the range before the paste. `$insertIntoListItem`
  (`rich-text-field.tsx:3511`, `keepsTailList`) then saw a caret in `p11q` with the nested list after it, kept the tail
  list and joined nothing. At depth 1 and 2 there is no such wrapper above the start, which is why only d3 differed.
- Fix: a lined item that holds only lists counts for a point on itself, not for a point in one of its nested items. The
  range then takes the head's path, as at the base.
- Test (`rich-text-line-paste.test.tsx`, describe "D11: ... (T59 defect 10)", 2 tests: the numbered list and the quote
  holding a bulleted list; write and the typed letter):
  - Before: 2 failed. Received `...<ol><li>Aq</li><li><hr />T1q</li></ol><ul><li><ul><li>1q<ul><li>t1q</li></ul></li><li>u1q</li></ul></li></ul>`.
  - After: 2 passed; the file 74 of 74. Write `<li><hr />T1q1q</li>` with the tail
    `<ul><li><ul><li><ul><li>t1q</li></ul></li><li>u1q</li></ul></li></ul>`, the base's; typed `T1qk1q`.
  - Main's Z6, Z9 and Z13 tests (`-t "Z6|Z9|Z13"`, project core-browser-builder-cms-rich-text): 84 of 84.
- The same climb is in `rich-text-line-toolbar.ts:176`. Not changed: no defect points there.

## Defect 11 (clip-d zzv15-clip-rec-48, real05 item-startsImg Shift+Home at 3)

Measured by a probe that runs on the shared harness at both builds (a real click at `U1w`@3, then Shift+Home, in
`<ul><li>Pw</li><li><img>U1w</li><li>Nw</li></ul>`; copy; then a cut, the cut's data pasted back, undo, and its
text/html and text/plain alone pasted). Base: `r1-base` (`2a96a45`), `timeout 600`. Probe source:
`/tmp/claude-0/-home-user/bc675505-f97c-57df-a43d-5f6c94c5254a/scratchpad/t59c-probe/rich-text-zzt59c-probe.test.tsx`
(removed from both trees after the run).

|                          | base `2a96a45`                                                  | branch `6c9ce85`                                       |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------ |
| selection                | anchor text `U1w`@3, focus element listitem@1 (after the image) | anchor text `U1w`@3, focus text `U1w`@0                |
| selection's nodes        | `text:U1w`                                                      | `text:U1w`                                             |
| text/plain               | `U1w`                                                           | `U1w`                                                  |
| text/html                | `<span ...>U1w</span>`                                          | `<ul ...><li value="2"><span ...>U1w</span></li></ul>` |
| editor data shape        | `t("U1w")`                                                      | `list(listitem(t("U1w")))`                             |
| cut's write              | `<li><img /></li>` (caret listitem@1)                           | `<li><img /></li>` (caret listitem@1)                  |
| paste-back (editor data) | `<li><img />U1w</li>`                                           | `<li><img /></li><li>U1w</li>`                         |
| paste-back (html only)   | `<li><img />U1w</li>`                                           | `<li><img /></li><li>U1w</li>`                         |

- Rule read: D6, "the copied HTML holds a list item only where the selection holds the whole item"; the accepted shape
  is for "a range that holds a whole list item". The image is not held, so the defect stands.
- Cause: Lexical 0.21's `ListItemNode.extractWithChild` takes the item whole when it holds both ends and its text is as
  long as the selection's text; an image has no text. At the base the focus is a point on the item, so the item does not
  hold both ends and no wrapper is written. On the branch the one writer (`$headFormClipboard`,
  `rich-text-line-clipboard.ts`) runs Lexical's function on text points (the focus is already text here, and
  `$endsIntoText` makes any element end text), so the item was taken whole.
- Fix: `$markItemsNotHeldWhole` (`rich-text-line-clipboard.ts:444`, called at `:626` before the copy mark): in the
  scratch editor only, an item that holds both ends and has a leaf the range does not hold gets a made-up character
  beside that leaf, outside the range. Lexical then leaves the item out, and the character is never in the clipboard.
  An item the range holds whole is untouched: the test "a range that holds a whole list item copies with its list and
  item" still passes, and rec-49 (Shift+End from `U0w`@0 over the trailing image, which holds the whole item) should
  keep the accepted shape by the same reading (not re-measured here; the second comparison reads it).
- Tests (`rich-text-line-clipboard.test.tsx`, in "Task 18: real empty blocks and whole items"):
  "a range that holds an item's text but not the image leading it copies the text alone (D6; T59 defect 11)" (shape
  `'U1w'`, html `U1w`, plain `U1w`, the copy changes nothing) and "that range cut and pasted back gives the item back
  whole (D6; T59 defect 11)".
  - Before: 2 failed (`list(listitem('U1w'))`; paste-back `<li><img /></li><li>U1w</li>`).
  - After: 2 passed; the file 109 of 109; `rich-text-line-grid-clipboard.test.tsx` (grids-a) 273 of 273.

## Runs at the head `42d2883`

- lines (whole): 18 files, 1,500 of 1,500 passed, 481 s.
- lines-b (whole): 3 files, 649 of 649 passed, 280 s.
- grids-a, `rich-text-line-grid-clipboard.test.tsx` only (no grid file touched; the writer changed): 273 of 273.
- `pnpm oxfmt --check`, `pnpm lint`, `pnpm exec tsc --noEmit -p apps/builder`, `pnpm check:runtime-upstream`: all pass.

## Review of 42d2883 (defects 9 to 11)

Read-only. I read the diffs, the code around them at `42d2883`, and Lexical 0.21's `RangeSelection.getNodes` and
`ListItemNode.extractWithChild`. I ran nothing. Findings that depend on a write I did not run are marked "by reading".

Paths below are relative to `apps/builder/app/builder/features/cms-panel/native/`.

## Findings, by severity

### 1. Medium. Defect 9: `$removeRangeWithBreak` should follow. Enter over the range form likely loses the empty line, and Enter and Shift+Enter now disagree (by reading)

- Where: `rich-text-line-removal.ts:247` (`isLineBreak(next.getFirstChild()) === false`), unchanged. It runs before Enter and Shift+Enter over a range (`$enterRangeWithBreak`, `:1548`) and before a paste whose start is in a line (`rich-text-line-paste.ts:68`).
- Scenario: `<li>T0w<h3>H1w</h3><br></li>`, select `T0w@1` to `H1w@2`, press Enter.
  - `$tagRemoval` marks D3's break for the line.
  - `$removeRangeWithBreak` adds no break, because `next` is the lone-break line.
  - The key then splits the item at `T|w`, which moves `w` and the empty line into a new item. `$linesNeedingBreak` reads that container's previous children, and a new item has none. So the normalise does not add the break either.
  - Likely write: `<li>T</li><li>w<br /></li>`, which loses the empty line, as defect 9 did.
- What the rules give: T35.1/T36.1 say the result is "the removal, then the break". The removal now writes `Tw<br /><br />`, so Enter should give `<li>T</li><li>w<br /><br /></li>`.
- Shift+Enter: it keeps both lines in the same container, so the normalise now adds the break: `T<br />w<br /><br />`. Before the fix it wrote `T<br />w<br />`.
  - So the fix changes Shift+Enter, and leaves Enter as it was.
- Block paste over the same range: it unwraps and rewraps the lines (D14), so the normalise may not see the old keys. It is probably in the same position as Enter.
- Rule: D3, third case. Its parenthesis covers any two lines that meet this way, and E1's join is that join (`rich-text-line-commands.ts:92`). T35.1 sets the oracle for Enter, and T30.3 makes T23.1's reading hold for every entry point.
- Fix: at `:247`, use the same test as the normalise: `(isLineBreak(next.getFirstChild()) && next.getChildrenSize() > 1) === false`. Then add Enter, Shift+Enter, a text paste and an HTML block paste beside the six tests, with the oracle "the field's removal, then the key" (T36.1).

### 2. Low to medium. Defect 11: the fix also changes ordinary content where the head's own selection has two text ends. That is a new D1 difference, and nothing lists it

- Where: `rich-text-line-clipboard.ts:444` (`$markItemsNotHeldWhole`). It runs for every range through the one writer, ordinary content included.
- Scenario: ordinary `<ul><li>Pw</li><li><img>U1w</li><li>Nw</li></ul>` (or `<li>U1w<img></li>`). Double-click `U1w`, or select `U1w@0` to `U1w@3` by keys, then copy.
  - At the head, both ends are text points. Lexical's `extractWithChild` takes the item whole, because the item's text equals the selection's text (the image has no text). The head copies `list(listitem('U1w'))`.
  - R1 matched the head here before this commit. It now copies `'U1w'`.
- Defect 11's own record matched the base only because the base's focus was an element point after the image.
- Rule: D6 supports the new value ("holds a list item only where the selection holds the whole item"; the build does not copy more than the selection holds). But it is now an ordinary-content difference from the head, outside the one recorded case.
  - It needs an entry in the pull request's D1 list and a line in T60.3's count, or an owner ruling.
  - It also needs a pinned test: a text-point range over an item's text beside an image. The two new tests use only the Shift+Home record.

### 3. Low. Defect 10: the fix is narrower than its own reasoning (by reading)

- Where: `rich-text-line-paste.ts:35` (`inLined`).
- What the fix does: it exempts only an ancestor item whose children are all lists. The commit's own reason is broader: a point in a nested item is in that item's own text.
- What is left: the climb still skips the nearest ordinary item and stops at any lined ancestor that is not a wrapper of lists only.
  - Example: a lined quote that holds a line beside a list, `<blockquote>Tw<ul><li>Aq<ul><li>Bq</li></ul></li><li>Cq</li></ul></blockquote>`. Quotes do hold lists here; the new test pastes one.
  - Select `Aq@1` to `Bq@1` and paste `<ol><li>Xq</li><li><hr>Yq</li></ol>`. `inLined` is still true, so the range is removed first, and PR #116's tail join is lost, as in defect 10.
- Lexical's import moves nested lists into wrapper items (`$normalizeChildren`), so a list item holding a list beside other content should not occur. A quote has no such step.
- Rule: D11 (Z13 stands) and D14 (a range that starts outside every lined container).
- Suggestion: stop the climb at the nearest list item. The nearest list item or lined quote decides, and a wrapper counts only for a point on itself. Measure the quote case at the base before pinning it.

### 4. Low. Defect 11: rec-49 and the accepted whole-item shape are untested on the new path

- The accepted-shape test that still passes ("a range that holds a whole list item copies with its list and item", clipboard test `:1071`) uses Ctrl+A. Its ends leave the item, so `$markItemsNotHeldWhole` never considers that item.
- rec-49 is Shift+End from `U0w@0` over a trailing image. By reading it stays accepted:
  - `$endsIntoText` gives the focus a place text after the image.
  - Lexical 0.21's `getNodes` includes every node between the ends, so the image is held and no mark is added.
- Nothing pins this. Add a test for rec-49 (and for `<li><img>U1w</li>` with the range starting before the image), both expecting `list(listitem(...))`.

## No finding

- **Defect 9, other shapes.** The changed condition runs only when `BREAK_AFTER_TAG` was set for the first line, so only D3's joins are affected.
  - A line that starts with a break and holds more than it (`<br>Xw`) is still treated as a break at the edge. D3's fourth case and T30.2 read it that way.
  - Several blocks between the lines (`T0w<h3>H1w</h3><h3>H2w</h3><br>`, range to `H2w@2`) also get the break, which is right by D3.
  - A heading of one break joined in (`T0w<h3><br></h3><br>`) still uses its own break as the separator, because the first line ends in a break.
  - An empty line made for a caret holds no child and was never skipped.
  - Typing, cut and text paste over the range form now also get `...<br /><br />` through the same normalise. That is consistent with T30.3, but untested; see finding 1.
- **Defect 10, other users and changed paths.**
  - `inLined` has one caller (`rich-text-line-paste.ts:67`).
  - A point on the wrapper itself is still lined, so the D18 resolver and T56.4's item that holds only a nested list are unchanged.
  - The changed path: paste or drop over a range that starts in a nested ordinary item. It now routes the way a start at depth 1 does (branch 2's D5 block-paste rule, otherwise `$unwrapEndContainer`), which matches D14 as the code applies it at depth 1.
  - `rich-text-line-toolbar.ts:176` (`isParagraphish`) climbs the same way, but I found no reachable difference.
    - It changes behaviour only when the paragraph's nearest lined ancestor is a wrapper of lists only. That would need a paragraph or a quote inside an ordinary nested item.
    - A quote makes its item lined, so the climb stops there first.
    - Making it consistent is optional.
- **Defect 11, containment of the made-up character.** It cannot reach the clipboard data, the live editor or undo:
  - It exists only in the scratch editor: a fresh `createEditor` from JSON, a discrete update, no history, discarded afterwards.
  - text/plain comes from the live selection (`$plainTextOf`).
  - The character goes before a leaf that lies before the start, or after a leaf that lies after the end. Lexical 0.21's `getNodes` includes the start node even at its end offset, so no unheld leaf lies inside the range.
  - Both ends are text points, so the selection restore in `insertBefore`/`insertAfter` moves neither of them.
  - The selection's cached nodes exclude the character, so `isSelected` and `getTextContent` stay as they were.
  - Text normalisation could merge it into an adjacent text node, but that happens only when the update ends, after the data is read.
- **Defect 11, other shapes.**
  - Nested lists: the climb also marks wrapper items, but a wrapper is already not whole by its text. Where the unheld leaf is an empty list item, `ListItemNode.insertAfter(text)` splits the list in the scratch editor. That changes nothing written: the item holding the range stays whole or not as before.
  - An item holding only an image: its ends are places beside the image, and the image is held.
  - Several items: only items that hold both ends are considered.
- **Tests and hygiene.**
  - The new tests pin the acceptance check's expected values: the D3 and T23.1 writes, the base's write for defect 10 plus main's Z13 letter pattern, and the base's copy shape and paste-back for defect 11. The implementer reports they fail without the fixes.
  - No `_`-prefixed Lexical read was added; `_editor` is an existing parameter name. No environment switch was added.
  - The test diffs are additions only, so no test on main was rewritten.
