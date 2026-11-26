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
