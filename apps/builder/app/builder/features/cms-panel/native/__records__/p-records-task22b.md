# Task 22: measurements M-a to M-d (for T45)

Measured on 2026-11-26. Branch: `task22-grids` (d4c02ed plus the uncommitted grid work). Head: `<base>`
2a96a45, in `<scratchpad>/r1-base`, each run under `timeout 600` (M-c's Backspace runs under 120 s).
Same harness as the grids: the kit's `mount`, `clickAt` (CDP mouse press and release at page
coordinates) and `caretKey`. A scratch test file was used for each build and removed afterwards; for
M-d3 only, the branch's `rich-text-line-commands.ts` and `rich-text-field.tsx` got temporary logging
lines, reverted after the run (both files are unchanged in the tree). Raw output:
`<scratchpad>/t22/m22-branch-full.json`, `m22-branch-a.json`, `m22-branch-d3.json`, `m22-head.json`,
`mc-base/`, `mc-branch/`.

"Lexical" is `caretKey()`. "Page" is `window.getSelection()`'s anchor. "Focus" is
`document.activeElement`.

## M-a (P22-5): the 13 clicks at M55's places

The test page's viewport is 414 by 896. The editable's box is x 1 to 479 (width 478) by 144, on both
builds. `document.elementFromPoint` at each place was read before the click.

| Point | Place | Element at the place | Head after the click | Branch after the click |
|---|---|---|---|---|
| TR@2 | 471, 49 | none (outside the viewport) | Lexical none, page none, focus body; 0 onChange | the same: Lexical none, page none, focus body; 0 onChange |
| RT@1 | 471, 33 | none (outside the viewport) | none, none, body; 0 | none, none, body; 0 |
| QR@2 | 471, 49 | none (outside the viewport) | none, none, body; 0 | none, none, body; 0 |
| RQ@1 | 471, 33 | none (outside the viewport) | none, none, body; 0 | none, none, body; 0 |
| TRT@2 | 471, 49 | none (outside the viewport) | none, none, body; 0 | none, none, body; 0 |
| QRQ@2 | 471, 49 | none (outside the viewport) | none, none, body; 0 | none, none, body; 0 |
| RR@1 | 471, 33 | none (outside the viewport) | none, none, body; 0 | none, none, body; 0 |
| RR@2 | 471, 42 | none (outside the viewport) | none, none, body; 0 | none, none, body; 0 |
| QT@1 | 62, 32 | `p` in the quote | range `text:Q0w@3`, page `"Q0w"@3`, focus the editable; 0 | the same |
| TQT el2 | 59, 48 | `p` in the quote | range `text:Q1w@3`, page `"Q1w"@3`, the editable; 0 | the same |
| QA el1 | 62, 32 | `p` in the quote | range `text:Q0w@3`, page `"Q0w"@3`, the editable; 0 | the same |
| QB el1 | 62, 32 | `p` in the quote | range `text:Q0w@3`, page `"Q0w"@3`, the editable; 0 | the same |
| BQ el1 | 25, 32 | head: `li`; branch: the line's `div` in the `li` | range `element:listitem@0`, page `li@0`, the editable; 0 | range `element:listitem@0`, page `div@0` (the line), the editable; 0 |

The eight "none" on the branch: no node selection, no range, no page selection, and focus on `body`. The
rule is not node-selected. The click fell outside the iframe's viewport (x 472 on the page, viewport
414 wide), so it reached no element, on both builds. No click fired onChange on either build.

## M-b (P22-5): the caret the branch draws after `place`, a click there, and a scan

For each point: `place` by code, `settle()`, then M55's method on the branch. Then a click at that drawn
place on a fresh mount. Then a scan: a click on a fresh mount at every 12 px across the editable and
every 6 px down the item that holds the point (its top − 4 to its bottom + 4), counting the clicks whose
caret is the grid's `placed`. Clicks at x 413 and more fall outside the viewport and read `none`.

| Point | By code (= grid `placed`) | Drawn caret (method) | A click at the drawn place | Scan: clicks, hits giving `placed` (first hits) |
|---|---|---|---|---|
| TR@2 | element:listitem@2 | 23, 65 (no rect: left edge − 1 of the `br` after; page `div@0`) | text:Nw@0, focus the editable, 0 onChange | 240, 14 (254,44 266,44 278,44 …) |
| RT@1 | text:T1w@0 | 24, 49 (the range's first rect) | text:T1w@0 | 240, 2 (26,46 26,52) |
| QR@2 | element:listitem@2 | 23, 65 (no rect: left edge − 1 of the `br` after) | text:Nw@0 | 240, 14 (254,44 266,44 …) |
| RQ@1 | text:Q1w@0 | 34, 49 (the range's first rect) | text:Q1w@0 | 240, 4 (26,46 38,46 26,52 38,52) |
| TRT@2 | text:T2w@0 | 24, 65 (the range's first rect) | text:T2w@0 | 400, 90 (254,44 266,44 …) |
| QRQ@2 | text:Q2w@0 | 34, 65 (the range's first rect) | text:Q2w@0 | 400, 92 (254,44 266,44 …) |
| RR@1 | element:listitem@1 | 23, 49 (no rect: left edge − 1 of the `br` after) | text:Nw@0 | 200, **0** |
| RR@2 | element:listitem@2 | 23, 58 (no rect: left edge − 1 of the `br` after) | text:Nw@0 | 200, **0** |
| QT@1 | text:T1w@0 | 24, 56 (the range's first rect) | text:T1w@0 | 360, 44 (2,44 14,44 …) |
| TQT el2 | text:T2w@0 | 24, 72 (the range's first rect) | text:T2w@0 | 440, 76 (2,56 14,56 …) |
| QA el1 | text:Lw@0 | 24, 56 (the range's first rect) | text:Lw@0 | 360, 44 (2,44 14,44 …) |
| QB el1 | element:listitem@1 | 23, 56 (no rect: left edge − 1 of the `br` after; page `div@0`) | element:listitem@1 | 440, 140 (2,44 14,44 …) |
| BQ el1 | element:listitem@1 | 25, 32 (no rect: right edge + 1 of the `br` before; page `div@1`) | element:listitem@0 | 280, **0** |

No click place in the scan gives the grid's `placed` at **RR@1, RR@2 and BQ el1**. The carets the scan
did find there:
- RR@1 and RR@2: element:listitem@0 140, none 25, text:Nw@0 35.
- BQ el1: text:Pw@0 3, text:Pw@2 32, none 35, element:listitem@0 105, text:Q1w@0 8, text:Q1w@2 2,
  text:Q1w@3 60, text:Nw@0 35.

At the other ten points some click gives `placed`. For TR@2 and QR@2 those clicks are at y 44, x 254 and
more, not at the drawn place, which lands in Nw. No scan click node-selected a rule.

## M-c (P22-4): TQT at the head

Shape `LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)`, at `<base>`. The caret after each gesture (one
file, all finished):

| Gesture | Lexical | Page | Focus | onChange |
|---|---|---|---|---|
| A click at the start of T2w (`at("T2w", 0)`) | text:T2w@0 | `"T2w"@0` | the editable | 0 |
| A click at the end of Q1w, then ArrowRight | text:T2w@0 | `"T2w"@0` | the editable | 0 |
| A click at T2w@1, then ArrowLeft | text:T2w@0 | `"T2w"@0` | the editable | 0 |
| A click at T2w@1, then Home | text:T2w@0 | `"T2w"@0` | the editable | 0 |
| The grid's place by code, `itemPoint(1, 2)` | text:T2w@0 | `li@2` | the editable | 0 |

Each real gesture reaches text:T2w@0, the caret the grid's place gives. Then Backspace from that caret,
each gesture in its own run under a 120 s watchdog:

| Gesture, then Backspace | Head | Branch (the same files) |
|---|---|---|
| click at T2w's start | does not finish (killed at 120 s) | finishes: `[T0w<blockquote><p>Q1wT2w</p></blockquote>]`, 1 onChange, caret text:Q1wT2w@3 |
| Q1w's end, ArrowRight | does not finish | the same write |
| T2w@1, ArrowLeft | does not finish | the same write |
| T2w@1, Home | does not finish | the same write |
| `itemPoint(1, 2)` | does not finish | the same write |
| Control: a click at T2w@1, then Backspace | finishes: `[T0w<blockquote><p>Q1w</p></blockquote>2w]`, 1 onChange, caret text:2w@0 | finishes |

So a person can freeze today's editor this way. A click at the start of the text that follows a quote in
the same list item, then Backspace, hangs the head. So does an arrow or Home that brings the caret
there.

## M-d (P22-3)

### 1. Quote and lineForward beside a rule (`[` is `<ul><li>Pw</li><li>`, `]` is `</li><li>Nw</li></ul>`; the `ol` shape is written out)

| Cell | Branch: write; calls; caret; typed | Head: write; calls; caret; typed |
|---|---|---|
| TR@2 Quote | `[T0w<hr /><blockquote></blockquote>]`; 1; element:quote@0; `[T0w<hr /><blockquote>k</blockquote>]` | `<ul><li>Pw</li></ul><blockquote>T0w<hr /></blockquote><ul><li>Nw</li></ul>`; 1; text:Pw@2; `<ul><li>Pwk</li></ul><blockquote>T0w<hr /></blockquote><ul><li>Nw</li></ul>` |
| TR@2 lineForward | `<ul><li>Pw</li><li>T0w<hr />Nw</li></ul>`; 1; text:Nw@0; `…T0w<hr />kNw…` | `[T0w<hr />]`; 1; element:listitem@2; `[T0w<hr />k]` |
| ol TR el2 Quote | `<ol><li>Pw</li><li>T0w<hr /><blockquote></blockquote></li><li>Nw</li></ol>`; 1; element:quote@0; `…<blockquote>k</blockquote>…` | `<ol><li>Pw</li></ol><blockquote>T0w<hr /></blockquote><ol><li>Nw</li></ol>`; 1; text:Pw@2; `<ol><li>Pwk</li></ol>…` |
| ol TR el2 lineForward | `<ol><li>Pw</li><li>T0w<hr />Nw</li></ol>`; 1; text:Nw@0; `…T0w<hr />kNw…` | `<ol><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ol>`; 1; element:listitem@2; `…T0w<hr />k…` |
| d2 TR el2 Quote | `<ul><li>Aw<ul><li>Pw</li><li>T0w<hr /><blockquote></blockquote></li><li>Nw</li></ul></li></ul>`; 1; element:quote@0; `…<blockquote>k</blockquote>…` | `<ul><li>Aw<ul><li>Pw</li></ul></li></ul><blockquote>T0w<hr /></blockquote><ul><li><ul><li>Nw</li></ul></li></ul>`; 1; text:Pw@2; `…Pwk…` |
| d2 TR el2 lineForward | `<ul><li>Aw<ul><li>Pw</li><li>T0w<hr />Nw</li></ul></li></ul>`; 1; text:Nw@0; `…T0w<hr />kNw…` | `<ul><li>Aw<ul><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ul></li></ul>`; 1; element:listitem@2; `…T0w<hr />k…` |
| d7 TR el2 Quote | the value as stored (A1w … A6w, then `<ul><li>T0w<hr /></li></ul>` at depth 7); 1 (unchanged); element:listitem@2; `…<li>T0w<hr />k</li>…` | `…<li>A6w</li></ul>…</ul><blockquote>T0w<hr /></blockquote>` (the depth-7 list goes, the quote at the root); 1; text:A6w@3; `…A6wk…` |
| d7 TR el2 lineForward | the value as stored; 1 (unchanged); element:listitem@2; `…<li>T0w<hr />k</li>…` | the value as stored; 1 (unchanged); element:listitem@2; `…<li>T0w<hr />k</li>…` |

What makes `d7 TR el2` Quote a no-op on the branch, by the temporary logs, in order:
1. `setBlockType quote: $setBlocksType runs on cms-line@0`: the command finds the empty caret line and
   acts on it. No depth guard refuses it first.
2. `$liftPastDepthLimit: lifts a quote at nesting 7`: the depth-limit transform
   (`rich-text-field.tsx`, `$liftPastDepthLimit` then `$liftQuoteOutOfItem`) takes the new quote back out
   in the same update.
3. One update, tags `[focus]`. Dirty elements: the seven lists and items up the chain, root, the item
   (intentionally), the removed quote ("gone", intentionally) and a new `cms-line` (intentionally).
   Dirty leaves: `horizontalrule`.

So it is the normaliser (the depth-limit lift) taking the change back, not a depth guard, and not a
command that found nothing to act on. At the head the same Quote lifts the depth-7 item's content into a
root quote and removes the depth-7 list.

### 2. Link (popover, an address, Apply) at a collapsed caret in ordinary content at the root

The same on both builds:

| Case | Stored | Caret before | Write | Calls | Caret after | Value unchanged? |
|---|---|---|---|---|---|---|
| The middle of a word | `<p>Xyzw</p>` | text:Xyzw@2 | `<p><a>Xyzw</a></p>` (the word linked) | 1 | text:Xyzw@2 | no |
| An empty paragraph directly before a quote | `<p></p><blockquote><p>Q1w</p></blockquote>` | element:paragraph@0 | null | 0 | element:paragraph@0 | (no onChange) |
| Directly after an image at a paragraph's end | `<p>Aw<img …/></p>` | element:paragraph@2 | `<p>Aw<img /></p>` | 1 | element:paragraph@2 | **yes: one onChange with the value unchanged** |
| A paragraph holding only an image, a rule after it (the caret after the image) | `<p><img …/></p><hr>` | element:paragraph@1 | `<p><img /></p><hr />` | 1 | element:paragraph@1 | **yes: one onChange with the value unchanged** |

The letter after each, on both builds: `<p><a>Xykzw</a></p>`, `<p>k</p><blockquote>…`, `<p>Aw<img />k</p>`,
`<p><img />k</p><hr />`.

### 3. The 20 failing cells on the branch: the handler that takes the action, and the update's dirty nodes

"!" marks a node marked dirty intentionally. "gone" is a node dirtied and removed in the update. Each
cell has one onChange with the value unchanged.

| Cells | What takes the action | The update's dirty nodes |
|---|---|---|
| rule in TRT, by code and for real, Ctrl+Backspace and Ctrl+Delete (4) | Lexical dispatches DELETE_WORD_COMMAND. No handler returns true at any priority: the observer at EDITOR priority is reached. The one handler that changes the tree is `nodeSelection.headPath` (`$headPathOnRemove`, the CRITICAL row, returns false), which unwraps the item's lines (`$headPathOverNodeSelection`). Nothing then removes anything (Lexical's DELETE_WORD returns false on a node selection), and the line rules wrap the item again. | elements `listitem! list root gone! gone! cms-line! cms-line!`; leaves `text horizontalrule text`; tags none |
| rule in TR, by code and for real, Ctrl+Backspace and Ctrl+Delete (4) | the same: `nodeSelection.headPath` unwraps; no handler acts | elements `listitem! list root gone! cms-line!`; leaves `text horizontalrule` |
| image in QI by code, Ctrl+Backspace and Ctrl+Delete (2) | the same | elements `listitem! list root gone! quote! cms-line!`; leaves `cms-image` |
| image in TQI by code, Ctrl+Backspace and Ctrl+Delete (2) | the same | elements `listitem! list root gone! quote! gone! cms-line! cms-line!`; leaves `text text cms-image` |
| image in QI for real Link (caret after the image) | TOGGLE_LINK_COMMAND, taken at NORMAL by the field's link handler (`rich-text-field.tsx`, the image-aware toggle above LinkPlugin's: `$toggleLink`, then `$keepImagesOutOfLinks`) | elements `cms-line! listitem! list root`; leaves `cms-image` |
| image in TQI for real Link | the same handler | elements `cms-line! listitem list root`; leaves `cms-image text` |
| QB el1 Link | the same handler | elements `cms-line! listitem! list root`; leaves `linebreak` |
| BQ el1 Link | the same handler | elements `cms-line! listitem! list root`; leaves `linebreak` |
| IR el1 Link | the same handler | elements `cms-line! listitem! list root`; leaves `cms-image` |
| d7 TR el2 Quote | no command: the toolbar's `setBlockType` update (`$setBlocksType` on the caret line), then `$liftPastDepthLimit` in the same update (M-d1) | elements: the seven lists and items, `root listitem! gone! cms-line!`; leaves `horizontalrule`; tags `[focus]` |
| d7 TR el2 lineForward | DELETE_LINE_COMMAND. The field's rows run and return false; the observer at LOW is reached and the one at EDITOR is not, so Lexical's own DELETE_LINE handler (RichTextPlugin, EDITOR priority) takes it | elements: the seven lists and items, `root cms-line!`; no leaves; tags none |
| HQ in item el1 Paragraph | no command: the toolbar's `setBlockType` update (`$unwrapQuoteLinesForParagraph`, then `$setBlocksType` on `text@0`, then `$restoreLinesAfterBlockType`); `$refuseBlockTypeOnLine` does not refuse | elements `quote! listitem list root gone! heading! cms-line!`; leaves `text`; tags `[focus]` |
