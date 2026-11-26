# T45 fixes: P records P45-1 onward

Built on `t45-fixes` from `485bb58`, the five fixes of T45.18 (T45.1, T45.2, T45.3, T45.4, T45.7), each in
its task's module with the test the rulings name. Shapes as in plan Task 22: `TR` `LI(T0w<hr>)`, `TRT`
`LI(T0w<hr>T2w)`, `QI` `LI(<blockquote><p>Q0w</p></blockquote>IMG)`, `TQI`
`LI(T0w<blockquote><p>Q1w</p></blockquote>X2wIMG)`, `d2 TR`
`<ul><li>Aw<ul><li>Pw</li><li>T0w<hr></li><li>Nw</li></ul></li></ul>`, `d7 TR` seven nested lists
(`A1w` to `A6w`) whose innermost item is `T0w<hr>`. `el2` is the element point at offset 2 on the item
holding `T0w` (`containerPoint("T0w", 2)`).

## P45-1 (T45.1, Task 16): the line forms over a node-selected image are writes, not no-ops

- Fix: `$headPathOnRemove` (`rich-text-line-node-selection.ts`) now takes the command and returns false
  for DELETE_WORD_COMMAND and DELETE_LINE_COMMAND before the unwrap: Lexical's word and line deletes act
  on a range selection only, so their node-selection path removes nothing. Its row id in
  `rich-text-line-commands.ts` passes the command. DELETE_LINE is excluded too: Lexical's `beforeinput`
  returns before dispatching it over a node selection, so no key reaches it there, and the rule "only a
  command whose node-selection path removes the selected nodes" excludes it as it does DELETE_WORD.
- The 12 cells now give no onChange, the history's length unchanged, the node still selected, and a letter
  directly after the node with one onChange (`T0w<hr />kT2w`, `T0w<hr />k`, `<img />k` after the quote,
  `X2w<img />k`). With the fix taken out, all 12 fail.
- What is not a no-op: the line forms with an image node-selected by code (QI, TQI; `lineBack` and
  `lineForward`) remove the image, one onChange, on the branch and at the head (the node grid's head
  record: `W(<li><blockquote><p>Q0w</p></blockquote></li>)` and
  `W(<li>T0w<blockquote><p>Q1w</p></blockquote>X2w</li>)`). The kit's line forms are `beforeinput`
  events; the image's removal happens on that path, not by DELETE_LINE. The ruling names "the line forms
  as controls"; for the rule shapes the controls assert no change (as the head), for the image shapes they
  assert the head's write. Not pinned: the caret after them (branch `text:Q0w@3` and `text:X2w@3`, head
  `element:listitem@1` for QI and `text:X2w@3` for TQI); the branch's QI caret is 5.7/5.8's by-code caret
  (T33.2), and the snapshot owns it.

## P45-2 (T45.2, Task 19): Link at a caret in a line with no word at it

- Fix: the field's TOGGLE_LINK_COMMAND handler (`rich-text-field.tsx`, the image-aware toggle at NORMAL)
  returns true before anything is touched when the selection is collapsed and its anchor is an element
  point on a `cms-line` (no text node at the caret). With the fix taken out, the five cells fail (one
  onChange each).
- Measured on the branch with the fix (no onChange, value and history length unchanged, caret unchanged,
  no `<a>` holding an `<hr>`), letter after: BQ el1 `W(<li><br />k<blockquote><p>Q1w</p></blockquote></li>)`;
  QB el1 `W(<li><blockquote><p>Q0w</p></blockquote>k<br /></li>)`; IR el1 `W(<li><img />k<hr /></li>)`;
  image in QI for real `W(<li><blockquote><p>Q0w</p></blockquote><img />k</li>)`; image in TQI for real
  `W(<li>T0w<blockquote><p>Q1w</p></blockquote>X2w<img />k</li>)`.
- Controls (M-d2 rows 3 and 4, ordinary content, the caret set directly after the image with the kit's
  `beside`): `<p>Aw IMG</p>` at `element:paragraph@2` and `<p>IMG</p><hr>` at `element:paragraph@1` keep
  one onChange with the value unchanged and the caret where it was. Ordinary content has no `cms-line`, so
  the new branch never applies there.

## P45-3 (T45.3, Task 14): the forward word and line forms at an empty caret line at the content's end

- Fix: in `$emptyLine` (`rich-text-line-deletes.ts`), the word and line forms, forward, in an empty line
  with nothing after it in its container and nothing after the container in the document (no sibling after
  it or after any ancestor up to the root), return true without touching a node. With the fix taken out,
  `lineForward` fails at depth 1 and depth 7 (one onChange with the value unchanged); Delete and Ctrl+Delete
  already gave nothing and stand.
- Read: "no item beyond" is read as nothing after the container anywhere in the document (Delete there
  also gives nothing), for any lined container, not only a list item.
- Not built: the backward forms. Backward at an empty first line of the first item (nothing before, no item
  before) the character form is not a no-op (Backspace lifts the line with the item, T33.5), and the
  existing tests there (`wordBack` writes nothing, `lineBack` leaves the value) are unchanged. If the ruling
  meant both directions, it needs the backward cell named.

## P45-4 (T45.4, Task 19): Quote refused where its quote would be lifted

- Fix: `$refuseBlockTypeOnLine` (`rich-text-line-toolbar.ts`) takes the depth limit's count as a second
  argument; `setBlockType` (`rich-text-field.tsx`) passes the lift's own `$nestingOf`. Quote is refused when
  the line of the selection's anchor or focus would hold a quote at a nesting of `RICH_TEXT_MAX_DEPTH - 1`
  or more (the lift's own bound). A line after a nested list in its list item is not refused: the count
  reads a quote there as leaving the lists around it, so the lift would not take it.
- Measured with the fix: d7 TR el2 Quote and d7 TR T0w@1 Quote write nothing (no onChange, no undo step),
  carets `element:listitem@2` and `text:T0w@1`, letters `<li>T0w<hr />k</li>` and `<li>Tk0w<hr /></li>` at
  depth 7. Without the fix the T0w@1 cell gives the split (one onChange, one undo step) and the el2 cell
  one onChange with the value unchanged. Control: Heading 2 at d7 TR el2 writes
  `<li>T0w<hr /><h2></h2></li>` at depth 7, one onChange.
- Not in a ruled cell: a range with one end's line at the limit and the other above it is refused whole.

## P45-5 (T45.7, Task 14): which handler takes Backspace in an empty line after a rule in a nested item

- Log (temporary command listeners at CRITICAL and LOW on KEY_BACKSPACE, OUTDENT_CONTENT, DELETE_CHARACTER
  and DELETE_LINE, scratch test removed): at d2 TR el2 and d7 TR el2, the caret `element:listitem@2`,
  Backspace passes every handler of the field's KEY_BACKSPACE CRITICAL row (each returns false) and the LOW
  listener, and reaches Lexical's own KEY_BACKSPACE handler (RichTextPlugin, EDITOR priority). That handler
  sees a collapsed caret at offset 0, takes the nearest block element ancestor, the `cms-line`, whose
  `getIndent()` reports its item's indent (1 at d2, 6 at d7), and dispatches OUTDENT_CONTENT_COMMAND.
  DELETE_CHARACTER is never dispatched, so `deletes.emptyLine` never runs. Writes before the fix: d2
  `<ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr /><ul><li>Nw</li></ul></li></ul>`; d7 the T0w item moved
  up beside A6w, `<li>A6w</li><li>T0w<hr /></li>` at depth 6. At depth 1 the indent is 0, so Lexical
  dispatches DELETE_CHARACTER and the empty line's rule runs.
- Fix: a new handler `deletes.emptyLineRuleBeforeOutdent` (`rich-text-line-deletes.ts`), last in the
  KEY_BACKSPACE CRITICAL row (after `removal.mark`, so the row runs as it does at depth 1): at a collapsed
  caret in an empty `cms-line` of a lined container, with a rule (or other block decorator) directly before
  it and an indent above 0, it prevents the key's default and dispatches DELETE_CHARACTER_COMMAND backward,
  as Lexical's handler does at depth 1. `COMMAND_ORDER` and its node test gain the id.
- Result: d2 `<ul><li>Aw<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul></li></ul>` and d7 `<li>T0w</li>` at depth
  7, caret `text:T0w@3`, one onChange, letter `T0wk`, exact undo and redo. Control: Backspace at `T0w@0` (a
  nested item's first line) still outdents (the item's indent 1 to 0, the rule stays). With the fix taken
  out, both cells fail.
- Checked, not changed: an empty caret point after a quote or a heading in a nested item (d2 TQ el2, d2 TH
  el2) resolves into the block's text (`text:Q1w@3`, `text:H1w@3`) before the key, so Lexical's outdent
  is not reached there; Backspace removes a letter of the block, as at depth 1.

## P45-6 (T46.1, Task 19): Paragraph in a lined quote after a heading

- Cause, confirmed: `setBlockType` (`rich-text-field.tsx`) ran `$unwrapQuoteLinesForParagraph` before
  `$refuseBlockTypeOnLine`. With the lines unwrapped, Lexical's `$setBlocksType` finds no block to act on
  (the quote's first child is the heading, so the quote is not a block to it, and no ancestor is), and
  `$restoreLinesAfterBlockType` wraps the lines again: one onChange with the value unchanged.
- Fix: `$refuseParagraphInQuote` (`rich-text-line-toolbar.ts`), called in `setBlockType` for Paragraph
  before the unwrap. It refuses at a collapsed text caret on a line of a quote when neither the quote nor
  any ancestor holds inline content first once the quote's lines give way (a line counts as its first
  content): the test Lexical's `$setBlocksType` makes with `INTERNAL_$isBlock`, so it refuses exactly where
  that call would find nothing. Nothing is touched before the decision.
- Result: HQ in item el1 (`LI(<blockquote><h3>H0w</h3>X1w</blockquote>T2w)`) and the root form
  (`<blockquote><h3>H0w</h3>X1w</blockquote>`), caret by a click at `X1w@0`: no onChange, history length
  unchanged, caret `text:X1w@0`, letters `W(<li><blockquote><h3>H0w</h3>kX1w</blockquote>T2w</li>)` and
  `<blockquote><h3>H0w</h3>kX1w</blockquote>`. With the fix taken out, both fail (one onChange). Control:
  `<blockquote>X1w<p>X2w</p></blockquote>` at `X1w@1` still writes `<p>X1w</p><p>X2w</p>`.
- Not covered by the refusal (left as built, no ruled cell): a range, an element point, and an empty line.
