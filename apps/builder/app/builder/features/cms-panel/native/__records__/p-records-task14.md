# Task 14: P records

Measured at the branch (Task 14's work on fb4f6c8), at `<base>` (SP/r1-base, 2a96a45, rich-text project) and, where named, at the carry (SP/r1-proto, 8e6838e, the carried prototype code). Writes are `short()`. Nothing here is pinned in a test except where a line says so.

## P14-1: the caret of P7-Backspace, P7-Ctrl+Backspace and P7-lineBack (P26 was ruled third)

- **Ruled (T33.1): (a).** The caret stays in the emptied line (`element:listitem@0`); a letter lands before the quote, outside it. Pinned (caret and typed) in `rich-text-line-deletes.test.tsx`, the three BQ el1 backward rows.

- Stored: `LI(<br><blockquote><p>Q1w</p></blockquote>)`.
- Place: BQ el1, `itemPoint(1, 1)` (after the line break, before the quote; `element:listitem@1`).
- Actions: Backspace; Ctrl+Backspace; `lineBack`.
- Branch, all three: write `<ul><li>Pw</li><li><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>` (pinned, the ruled carry write), one onChange, caret `element:listitem@0` (the emptied line holds the caret and stays, as P26's third ruling keeps such a line); a letter then writes `<ul><li>Pw</li><li>k<blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`.
- `<base>`: Backspace `<ul><li>Pw</li><li><blockquote></blockquote>Q1w</li><li>Nw</li></ul>`, caret `text:Q1w@0`; Ctrl+Backspace none, caret `text:Q1w@0`; `lineBack` as Backspace, caret `text:Q1w@0`.
- The rulings' caret is conditional on "P26 ruled A/B"; P26 was ruled third. Candidates: (a) `element:listitem@0` (the emptied line keeps the caret: what the branch gives, and P26's third ruling's reading); (b) `text:Q1w@0` (the caret at the quote's start).

## P14-2: 16.13, a child the code block cannot hold later in the line (T14.7)

- **Ruled (T33.3).** A join into a code block carries what the block can hold up to the first child it cannot hold (an image, a link); from that child on, the rest stays behind (a paragraph after the code block at the root, a line after it in a list item). Built in `deletes.noReorderingJoin` (`$leaveBehindWhatCodeCannotHold`); pinned in the "T33.3:" rows (root and lined, image and link, text after the link; Backspace, Ctrl+Backspace, `lineBack`). A quote's first paragraph is P14-10.

- Stored: `<pre><code>C0w</code></pre><p>T1w<a href="https://example.org/">Lw</a></p>`, and `<pre><code>C0w</code></pre><p>T1wIMG</p>`.
- Place: `T1w@0` (a real click; an element point before T1w gives the same).
- Action: Backspace.
- `<base>`: the link: `<pre><code>C0wT1wLw</code></pre>`, caret `text:C0wT1wLw@3` (the link's address is lost); the image: `<pre><code>C0wT1w</code></pre><p><img /></p>`, caret `text:C0wT1w@3` (T1w joins, the image stays in a paragraph after).
- Branch: the same writes and carets (nothing built for it).
- Not ruled (16.13 rules a leading child only). Candidates: (a) the head's write (the link's text joins and its address goes; the image stays behind in a paragraph); (b) refused, write none, as 16.13 refuses a leading image or link.

## P14-3: M21a's caret form, Backspace just after an image that ends a lined item (T28; Task 16's rows)

- **Ruled (T33.2), for Task 16:** the real gesture keeps the caret in the emptied line and the letter lands after the quote, outside it; by code (node selection) 5.7/5.8 hold (caret at the quote's end, `Q0wk`). Nothing pinned here.

- Stored: `LI(<blockquote><p>Q0w</p></blockquote>IMG)`.
- Place: `imageNode()` (a real click on the image, then Escape: a caret after the image).
- Action: Backspace.
- Branch: write `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>` (equal to T28's M21a write; pinned, write only), caret `element:listitem@1`, a letter then `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>k</li><li>Nw</li></ul>`. By code (the node selection): caret `element:quote@1`, the letter `Q0wk` as T28 rules (typed pinned).
- T28 rules caret `text:Q0w@3` and typed `Q0wk` for both forms. The caret form's caret and typed are left for Task 16, which owns M21a's rows; the by-code form's caret is not pinned either.

## P14-4: T13.3's derived write, measured (information, pinned)

- Information; no ruling needed (T33.8: the review fixes accepted).

- Stored: `LI(<blockquote><p>Q0w</p></blockquote><a href="https://example.org/">A1w</a>x)`, `A1w@0`, Backspace and Ctrl+Backspace.
- Branch and carry: `W(<li><blockquote><p>Q0w<a>A1w</a>x</p></blockquote></li>)`, the derived write; one undo restores the value before, with and without an earlier letter (two undo steps), redo reapplies. The carry already made the join its own undo step in these measurements, so Step 1d needed no `history-push`; nothing was added.
- `<base>`: one onChange whose value equals the value before (D19), caret `text:Q0w@3`.

## P14-5: the click-then-Escape gesture on the kit's image can leave the caret before it (information)

- Information; no ruling needed (T33.8).

- Stored: `LI(<blockquote><p>Q0w</p></blockquote>X1wIMGT1w)` with the kit's `IMG` (2 by 3 px).
- `imageNode()` leaves the caret at `text:X1w@3` (before the image), and Delete there writes nothing at the branch. With a 40 by 20 image (the prototype's grid size) the caret is after the image (`text:T1w@0`) and Delete writes `X1w<img />1w`. The twin grids use the 40 by 20 image. In `LI(T0wIMGT1w)` the kit's image gives the caret after it.

## P14-6: 16.10's controls that follow the twin, not the head (F2)

- **Ruled (T33.7): confirmed** as built.

- Fixture `base-key-changes-nothing` (162 cells, recorded at `<base>`): 40 ruled cells (the twin writes nothing: a root quote's edge, Delete and `lineForward` forward, Backspace and both backward forms), all `none` on the branch; 122 controls.
- 48 controls are named by F2 in the test: the build writes the twin's write with the child put back where the head's write differs from it: the word and line forms forward after an image, a line break or a link at the end of a root heading, paragraph or quote with a root rule after and nothing beyond (the head removes the child, or inserts a space), and a caret inside a link's text at its edge (the head writes nothing, or keeps the rule). Their ids are listed by the test's names ("(F2: the twin's write)").
- The same rule renamed one cell of `rich-text-line-grid-1510-quote`'s snapshot: `R|quote|img|none|end|0|wordF` (the caret after an image ending a root quote, a root rule after it and nothing beyond, Ctrl+Delete): the branch removes the rule only, the head the image and the rule; class "the head takes an image or a line break outside the range (check 3)". The snapshot is updated.

## Notes on the task text

- Step 3: `CmsLineNode.collapseAtStart` is not reached for M1b, M2a and M2b: Lexical's delete extends the caret into the block before and removes the range, so the first line's join is a removal. The build is in `$joinRestOfItem` (the removal's join that carries an item's rest): a nested list's first item joined into the item its list follows carries its rest there (M1b), and a root quote whose first line joined the block before leaves its rest at the root (M2a, M2b). M1a and M1c already gave the head's write.
- `$atContentEdge` stays in `rich-text-line-node.ts` (the smaller change), signature unchanged.
- The order: `deletes.nothingChanges` and `deletes.noReorderingJoin` sit as Step 1c gives them. The word and line forms of 16.10 are decided inside `deletes.edgeForms` (`$formBesideRootRule`), since those forms dispatch no key command.

## P14-7: the forward word and line forms at an emptied line before a quote (Task 14 review, finding 3)

- **Ruled (T33.4).** Delete removes the empty line and the quote stays; Ctrl+Delete gives Delete's write; `lineForward` removes nothing (fixed: it removed the quote and its `Q`). The value is unchanged by all three (an empty line exports nothing), so none makes an onChange or an undo step (16.10): the line's removal is tagged `history-merge`, and one undo then undoes the Backspace before. Built in `deletes.emptyLine` (`$emptyLineBeforeQuote`); pinned in "T33.4:" (six tests: two shapes, three keys; Delete and Ctrl+Delete leave the caret at `text:Q1w@0`, `lineForward` in the emptied line).

- Stored: `LI(k<blockquote><p>Q1w</p></blockquote>)`, and `LI(<hr>k<blockquote><p>Q1w</p></blockquote>)`.
- Place: a real click after `k`, then Backspace (the emptied line holds the caret: `element:listitem@0`, `element:listitem@1`; at `<base>` `element:quote@0` and `element:listitem@1`).
- Actions: `lineForward`; Ctrl+Delete; Delete.
- Branch (after the review fix: `deletes.emptyLine` gives the word and line forms the character form only in 5.3's join cells, so Lexical's own word and line delete runs here, as before Task 14):
  - `LI(k...)`: `lineForward` `<ul><li>Pw</li><li>1w</li><li>Nw</li></ul>` (the quote and its `Q` go); Ctrl+Delete and Delete `<ul><li>Pw</li><li><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>` (the empty line goes).
  - `LI(<hr>k...)`: `lineForward` `<ul><li>Pw</li><li><hr />1w</li><li>Nw</li></ul>`; Ctrl+Delete `<ul><li>Pw</li><li><hr /><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`.
- Undo at the branch: for `LI(k...)` all three actions and `LI(<hr>k...)` Ctrl+Delete, one Ctrl+Z does not give back the state after the place (the kit's `undoRestores` is false; the place's own Backspace made the emptied line); at `<base>` it does. So no row is pinned here, not even Ctrl+Delete's equality with Delete (check 4, 15.6).
- At Task 14's head (before the fix) the word and line forms dispatched the character form here, so gave Delete's write (the empty line goes; read from the code and the review, not measured again).
- `<base>`: `LI(k...)`: `lineForward` and Ctrl+Delete `<ul><li>Pw</li><li></li><li>Nw</li></ul>` (the quote goes whole); Delete `<ul><li>Pw</li><li><blockquote><p>1w</p></blockquote></li><li>Nw</li></ul>`. `LI(<hr>k...)`: `lineForward` and Ctrl+Delete `<ul><li>Pw</li><li><hr /><blockquote></blockquote></li><li>Nw</li></ul>`.
- `<base>` and F2 (P7-lineForward: the line form removes nothing before a block) do not agree, so no control row. Not pinned. Candidates for `lineForward`: (a) none, as P7-lineForward rules at BQ el1 (the line form at a line's end before a block removes nothing); (b) Delete's write (the empty line goes), as Task 14's head gave. For Ctrl+Delete: (a) Delete's write (the word form is the character form at a line's end before a block, check 4, 15.6), which the branch gives now; (b) `<base>`'s.

## P14-8: Backspace at the first item's empty first line before a rule (information, found measuring finding 3)

- **Ruled (T33.5): (a), the branch's.** Pinned: `<p></p><hr /><p>T1w</p><ul><li>Nw</li></ul>`, caret `element:paragraph@0`.

- Stored: `<ul><li><hr>T1w</li><li>Nw</li></ul>`; place `itemPoint(0, 0)` (`element:listitem@0`); Backspace.
- Branch: `<p></p><hr /><p>T1w</p><ul><li>Nw</li></ul>`, caret `element:paragraph@0`. `<base>`: `<hr /><p>T1w</p><ul><li>Nw</li></ul>`, caret `text:Nw@0`.
- The character form is not changed by Task 14 or its review; not ruled here (5.3 rules RT@0 Backspace only with an item before). Candidates: (a) the branch's (the emptied line lifts as an empty paragraph and holds the caret, 5.3); (b) `<base>`'s.

## P14-9: an empty heading in a root quote after a root rule, Backspace (information, finding 2)

- **Ruled (T33.6):** pinned as the equality with `<base>`: `<base>`'s write `""` recorded as a literal in the test, labelled as such, caret `element:paragraph@0`, without the fixed-point check.

- Stored: `<hr><blockquote><h3></h3></blockquote>` (imports as `<hr /><blockquote></blockquote>` holding an empty heading); place: an element point at offset 0 of the heading; Backspace.
- Branch (after the review fix: 16.10's no-op path takes the fixture's paragraph shapes only) and `<base>` alike: write `""` (the rule and the quote go), one onChange, caret `element:paragraph@0`. Task 14's head wrote nothing here (the review's reading).
- Equal to `<base>`, but `""` is not a fixed point (it reimports as `<p></p>`), so it is not pinned. A code block in the same place (`<hr><blockquote><pre><code>C0w</code></pre></blockquote>`, `C0w@0`) is pinned: Backspace `<hr /><blockquote><p>C0w</p></blockquote>`, the word and line forms none, each equal to `<base>`.

## P14-10: T33.3's join into a code block from a quote's first paragraph (found building T33.3)

- **Ruled (T34.1), candidate (a).** What the code block cannot hold stays where it was, in the quote: the link `<pre><code>C0wT1w</code></pre><blockquote><p><a href="https://example.org/">Lw</a></p></blockquote>` (the address kept), the image `<pre><code>C0wT1w</code></pre><blockquote><p><img /></p></blockquote>`, caret `text:C0wT1w@3`. Built in `$leaveBehindWhatCodeCannotHold`; pinned in the "T33.3:" rows for a root quote and a quote in a list item (Backspace, Ctrl+Backspace, `lineBack`). `<base>` measured again for T34.1 (SP/r1-base, raw export): the image at the root `<pre><code>C0wT1w</code></pre><p><img /></p><blockquote></blockquote>`, in an item `<li><pre><code>C0wT1w</code></pre><p><img /></p><blockquote></blockquote></li>`; the link `<pre><code>C0wT1wLw</code></pre><blockquote></blockquote>` (in an item the same inside the `li`), no address; caret as below for all three keys. Same D1 entry as T33.3.

- Stored: `<pre><code>C0w</code></pre><blockquote><p>T1w<a href="https://example.org/">Lw</a></p></blockquote>`, and the same with `IMG` in place of the link.
- Place: `T1w@0` (a real click). Actions: Backspace; Ctrl+Backspace; `lineBack` (each gives the same write at both builds).
- `<base>`: the link: `<pre><code>C0wT1wLw</code></pre><blockquote></blockquote>`, caret `text:C0wT1wLw@3` (the address is lost); the image: `<pre><code>C0wT1w</code></pre><p><img /></p><blockquote></blockquote>`, caret `text:C0wT1w@3`.
- Branch (T33.3 is built for a root paragraph and a list item's line only; the quote's paragraph is left as it was): the link: `<pre><code>C0wT1wLw</code></pre>`, caret `text:C0wT1wLw@3` (the quote goes and the address is lost); the image: `<pre><code>C0wT1w</code></pre><p><img /></p>`, caret `text:C0wT1w@3`.
- T33.3 names where the rest stays at the root and in an item, not in a quote. Candidates for the link: (a) the rest stays in the quote: `<pre><code>C0wT1w</code></pre><blockquote><p><a href="https://example.org/">Lw</a></p></blockquote>`; (b) as the image case's current write, a paragraph after the code block at the root: `<pre><code>C0wT1w</code></pre><p><a href="https://example.org/">Lw</a></p>`. Not pinned.
