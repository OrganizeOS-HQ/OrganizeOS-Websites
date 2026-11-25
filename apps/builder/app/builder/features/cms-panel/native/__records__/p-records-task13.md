# Task 13: P records

Measured at the branch (Task 13's work on 3dbfe6a), at `<base>` (SP/r1-base, 2a96a45, rich-text project) and, where named, at `<proto>` (SP/r1-proto, 8e6838e). Writes are `short()`. None of these is pinned in a test.

## P13-1: T23.1, a range over the whole word of the block to the start of the lone-break line (the item's stored form)

- Stored: `<ul><li>Pw</li><li><h3>H0w</h3><br></li><li>Nw</li></ul>` (and the code block: `<pre><code>C0w</code></pre><br>`).
- Place: `rangeToLineStart("H0w", 0)`: `H0w@0` to the start of the line that holds only the break (`text:H0w@0|element:listitem@1`).
- Action: Backspace (Delete and the cut give the same).
- Built to the twin, as asked: the line and its break go, the block is emptied and stays, holding the caret.
  - Branch: write `<ul><li>Pw</li><li></li><li>Nw</li></ul>`, caret `element:heading@0` (code: `element:code@0`), one onChange, undo restores; a letter then writes `<ul><li>Pw</li><li><h3>k</h3></li><li>Nw</li></ul>` (code: `<pre><code>k</code></pre>`). The letter over the same range (M61's gesture) writes `<h3>k</h3>` directly.
  - Twin, the same gesture with an empty paragraph in place of the line, inside a container (`<blockquote><h3>H0w</h3><p></p></blockquote>`, the paragraph emptied by code): the heading stays empty with the caret, the paragraph goes; stored value ``(the quote holds only the empty heading), a letter then `<blockquote><h3>k</h3></blockquote>`. At the root (`<h3>H0w</h3><p></p>`) Lexical keeps the paragraph instead: stored``, a letter then `<p>k</p>`.
  - `<base>`: `<ul><li>Pw</li><li><h3></h3><br /></li><li>Nw</li></ul>` (the break stays: K5), letter then `<h3>k</h3><br />`.
- Question: the item's stored form while it holds only the emptied heading (or code block) with the caret. Candidates: (a) `<li></li>` (what the build writes: an empty block exports nothing); (b) `<li><h3></h3></li>`.

## P13-2: a range that ends at the start of a line holding a break and text, directly after a block, pulls the break into the block

- Stored: `<ul><li>Pw</li><li><h3>H0w</h3><br>Tw</li><li>Nw</li></ul>`; also `<blockquote><h3>H0w</h3><br>Tw</blockquote>`.
- Place: `rangeToLineStart("H0w", 2)` (`H0w@2` to the start of the line `<br>Tw`); also from `H0w@0`.
- Action: Backspace.
- Branch: `<ul><li>Pw</li><li><h3>H0<br />Tw</h3></li><li>Nw</li></ul>` (the quote: `<blockquote><h3>H0<br />Tw</h3></blockquote>`; from `H0w@0`: `<blockquote><h3><br />Tw</h3></blockquote>`): the line's break and text join the heading.
- `<base>`: `<ul><li>Pw</li><li><h3>H0</h3><br />Tw</li><li>Nw</li></ul>` (no join; the quote: `<blockquote><h3>H0</h3><br />Tw</blockquote>`).
- T23.1 covers only a line that holds nothing but the break; D3's fourth case says a break is never pulled into the block. Candidates: (a) `<base>`'s write, the line not joined; (b) the line joins without its break: `<h3>H0Tw</h3>`.

## P13-3: the cells of check 5's 15.10 set that are ruled

- `base-1510`: the cells whose focus the head's presses leave on the root directly after the nested block number 384 of the generated 1,920 (plus 51 of the 162 named cells), not the plan's 352. The test applies the rule to all 435 (each equals the same input one press earlier, as ruled); all pass. Of the 384, 64 are cells after two presses where the head's second press stays on the root. Which count the coordinating session meant is a question, not a write.
- `base-1510-mirror`: the mirror's ruled property (the removal takes `$rangeOracle`'s range, each key writes what it writes after Backspace over the range, a cut's clipboard is the copy's) is checked on every cell whose walk leaves a range (384 of 512), not only the 210.

## P13-4: a composition over a backward range at a format or element edge

- Stored: `<p>A0w<b>Ew</b></p><p>B1w</p>` (and `<code>Cw</code>` in place of the bold word).
- Place: the range from `B1w@1` back to the first paragraph's end (an element point, set by code), backward.
- Action: `ime("a")`.
- Branch: `<p>A0w<b><strong>Ew</strong></b>aa1w</p>`, 3 onChanges: the letter typed twice. `<base>`: `<p>A0w<b><strong>Ew​</strong></b>aa1w</p>` (twice, and a composition-start character left).
- Also, the end at a paragraph's start before an image, a line break or a link, backward (`<p>A0w</p><p>IMGB1w</p>`, `p1@0` to `A0w@1`): branch and `<base>` both `<p>A​a<img />B1w</p>`, the start character left (the net reports it).
- These are compositions over a backward range (16.19 to 16.21, Task 20's tables). The class sweep leaves the 40 backward composition cells out and says so; they join it when Task 20 lands. Candidate write: the range removed and `a` once, no start character (`<p>A0w<b>Ew</b>a1w</p>` or with `a` outside the bold).

## P13-5: a text paste over T23.1's range (M28s-CB-Right-2 and M28s-HB-Right-2)

- Stored: `<ul><li>Pw</li><li><pre><code>C0w</code></pre><br></li><li>Nw</li></ul>` (CB); `<ul><li>Pw</li><li><h3>H0w</h3><br></li><li>Nw</li></ul>` (HB).
- Place: `at("C0w", 2)` (HB: `at("H0w", 2)`), Shift+ArrowRight twice: `text:C0w@2|element:listitem@1` (HB: `text:H0w@2|element:listitem@1`).
- Action: a text paste of `Aq` (the kit's `pasteText("Aq")`).
- Branch (668cb94 and this fix): CB `<ul><li>Pw</li><li><pre><code>C0Aq</code></pre></li><li>Nw</li></ul>`, HB `<ul><li>Pw</li><li><h3>H0Aq</h3></li><li>Nw</li></ul>`; one onChange.
- `<base>` (measured 2026-11-25 with the kit, rich-text project): CB `<ul><li>Pw</li><li><pre><code>C0Aq</code></pre><br /></li><li>Nw</li></ul>`, caret `text:C0Aq@4`; HB `<ul><li>Pw</li><li><h3>H0Aq</h3><br /></li><li>Nw</li></ul>`, caret `text:H0Aq@4`; one onChange, undo restores.
- T23.1 names the letter and Backspace over these ranges (Delete and the cut follow from Backspace); it names no paste. The test pinned the branch's write until the review; the pin is removed.
- Candidates: (a) the branch's: T23.1's join, then the paste at the caret it leaves (the letter's form); (b) `<base>`'s: the line's break stays.

## P13-6: T30.2 from the block's start: the emptied heading beside the line's rest (the stored form) (ruled T31.1: branch's write)

- Stored: `<blockquote><h3>H0w</h3><br>Tw</blockquote>` (and `<ul><li>Pw</li><li><h3>H0w</h3><br>Tw</li><li>Nw</li></ul>`).
- Place: `rangeToLineStart("H0w", 0)` (`H0w@0` to the start of the line `<br>Tw`).
- Action: Backspace (Delete and the cut give the same).
- Built to T30.2 (the break goes, the rest stays a line after the block, the heading emptied holds the caret): caret `element:heading@0`, one onChange, undo and redo hold; a letter then writes `<blockquote><h3>k</h3>Tw</blockquote>` (the item: `<ul><li>Pw</li><li><h3>k</h3>Tw</li><li>Nw</li></ul>`), as ruled.
- Branch write: `<blockquote><h3></h3>Tw</blockquote>` (the item: `<ul><li>Pw</li><li><h3></h3>Tw</li><li>Nw</li></ul>`). T30.2 gives `<blockquote>Tw</blockquote>`.
- The ordinary twin in a quote (`<blockquote><h3>H0w</h3><p></p><p>Tw</p></blockquote>`, `H0w@0` to the empty paragraph's start, Backspace) writes `<blockquote><h3></h3><p>Tw</p></blockquote>`, caret `element:heading@0`: an emptied heading beside other content exports `<h3></h3>`; it exports nothing only where it is the container's one child (P13-1). At the root the twin writes `<p></p><p>Tw</p>` (Lexical makes the emptied heading a paragraph).
- `<base>`: not measured here (P13-2's `<base>` write from `H0w@2` keeps the break).
- Not pinned: the test pins the caret, one onChange, undo, redo and the letter after. Candidates: (a) the branch's `<blockquote><h3></h3>Tw</blockquote>` (the twin's form); (b) T30.2's `<blockquote>Tw</blockquote>` (the empty heading left out of the value while it holds the caret).
- Ruled T31.1: (a), the branch's write; the emptied block's stored form is the exporter's. The test now pins the write `<blockquote><h3></h3>Tw</blockquote>` with the caret, the count, undo, redo and the letter.

### T31.2 measurement

T30.2 as built applies where the range starts inside the block directly before the line (T31.2). Four cells, Backspace, recorded with the kit (`recordEdit`; the range set directly after a click, anchor at the word's text point, focus at the line's start): the branch at a7439f2, the ordinary twin at `<base>` (2a96a45). The sweep's 64 lined `line break` cells all start in the item's first line (`A0w@1`, or the end of `A0w<br>`), so cell 1 is the sweep's `line break|the end at its parent's start|lined|forward|Backspace`; cells 2 to 4 keep its shape and move the start (cell 2 adds `<h3>H0w</h3>` before the quote).

The twin: `<br>B1w` becomes `<p></p><p>B1w</p>`. An item at `<base>` holds no paragraph (its import unwraps `<p>` in an item and drops the empty one: `<li>A0w<blockquote>…</blockquote><p></p><p>B1w</p></li>` mounts as `listitem("A0w", quote, "B1w")`), so the twin stands at the root, each item and each line a paragraph: `<p>Pw</p><p>A0w</p>[<h3>H0w</h3>]<blockquote><p>Q0w</p></blockquote><p></p><p>B1w</p><p>Nw</p>`; its focus is the empty paragraph @0.

Rows: the text split at every block edge and every break (an empty block is an empty row).

| Cell                                    | Stored (branch)                                                                                     | Range (branch; twin)                                                        | Branch write                                                                                              | Twin write at `<base>`                                                    | Rows equal                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1, a line of the same item              | `<ul><li>Pw</li><li>A0w<blockquote><p>Q0w</p></blockquote><br>B1w</li><li>Nw</li></ul>`             | `text:A0w@1` to `element:listitem@2`; `text:A0w@1` to `element:paragraph@0` | `<ul><li>Pw</li><li>A<br />B1w</li><li>Nw</li></ul>`                                                      | `<p>Pw</p><p>A</p><p>B1w</p><p>Nw</p>`                                    | yes: Pw, A, B1w, Nw                                                                                                   |
| 2, a block not directly before the line | `<ul><li>Pw</li><li>A0w<h3>H0w</h3><blockquote><p>Q0w</p></blockquote><br>B1w</li><li>Nw</li></ul>` | `text:H0w@1` to `element:listitem@3`; `text:H0w@1` to `element:paragraph@0` | `<ul><li>Pw</li><li>A0w<h3>H<br />B1w</h3></li><li>Nw</li></ul>`                                          | `<p>Pw</p><p>A0w</p><h3>H</h3><p>B1w</p><p>Nw</p>`                        | yes: Pw, A0w, H, B1w, Nw (but the branch moves B1w into the heading; the twin keeps it a paragraph after the heading) |
| 3, in the quote the range removes       | as cell 1                                                                                           | `text:Q0w@1` to `element:listitem@2`; `text:Q0w@1` to `element:paragraph@0` | `<ul><li>Pw</li><li>A0w<blockquote><p>Q</p></blockquote>B1w</li><li>Nw</li></ul>` (T30.2: the break goes) | `<p>Pw</p><p>A0w</p><blockquote><p>Q</p></blockquote><p>B1w</p><p>Nw</p>` | yes: Pw, A0w, Q, B1w, Nw                                                                                              |
| 4, another item                         | as cell 1                                                                                           | `text:Pw@1` to `element:listitem@2`; `text:Pw@1` to `element:paragraph@0`   | `<ul><li>P<br />B1w</li><li>Nw</li></ul>`                                                                 | `<p>P</p><p>B1w</p><p>Nw</p>`                                             | yes: P, B1w, Nw                                                                                                       |

Each write: one onChange, caret at the start's text point (`text:A@1`, `text:H@1`, `text:Q@1`, `text:P@1`, the same on both sides), undo and redo hold, no console error. The twin always removes the empty paragraph and keeps `B1w` its own row; the branch keeps the break where the range starts outside the quote (cells 1, 2, 4) and removes it where it starts in the quote (cell 3), and the rows agree in all four. Cell 2's break lands inside the heading (`<h3>H<br />B1w</h3>`): the rows match, the block of the `B1w` row does not (heading at the branch, paragraph in the twin).

## Built without a P record (named here for the commit body)

- 16.10: Delete at a caret at the end of a quote or list ending in an image or a link, before a root-level rule (`R|quote|img|none|end|0|del` and seven more cells of `base-1510`, image and link ends): at 3dbfe6a it handed out the value before (one onChange, value unchanged, D19); `<base>` writes nothing. Now nothing is written, as at `<base>` and as with a text end.
- 15.10's mirror: a letter or a paste over a range from the root before a rule into the start of a quote's text after it (`L|*|text|quote|start|2|k`, `plain`, `htmlPaste`: 15 cells) took the quote's paragraph out of the quote (the head too); now it is Backspace over the range, then the key, as the mirror's rule asks.
- 15.10, Image over the range one press past a quote's end before a root-level rule (`<blockquote><p>Pw</p></blockquote><hr><p>Nw</p>`, `Pw@end`, Shift+ArrowRight): at 668cb94 the result of the removal step was ignored and the removal was marked over what is then a caret (the write was the same); now no mark, and the write is Image's one press earlier (Step 2: non-delete commands, false and no mark).
- 15.10's mirror, Shift+Enter and Image over a range from the root before a rule (`L|*|text|quote|start|2`, 5 shapes each: no onChange at 668cb94) and Image over a range from a quote's end into the paragraph after the rule (`L|quote|*|para|start|1`, 4 cells: the paragraph's content left directly in the quote at 668cb94): now Backspace over the range, then the key, as the mirror's rule asks. Image now starts a range as the editing commands do (`$selectionIntoAdjacentBlocks`).
- T30.2's widened rule, extended by T32.2, applies from the block the range starts in, wherever that block stands before the line: what stands between that block and the line is in the range whole and goes, the line's leading break goes, and the rest stays a line after that block (nothing is pulled into it). Pinned (`T32.2` in `rich-text-line-removal.test.tsx`, Backspace, `W(...)`): cell 2 of the T31.2 table writes `<li>A0w<h3>H</h3>B1w</li>`, cell 3 `<li>A0w<blockquote><p>Q</p></blockquote>B1w</li>`, and a code-block cell (`A0w<pre><code>C0w</code></pre><blockquote><p>Q0w</p></blockquote><br>B1w`, from `C0w@1`) `<li>A0w<pre><code>C</code></pre>B1w</li>`, caret `text:C@1`. The code cell's twin at `<base>` (`<p>Pw</p><p>A0w</p><pre><code>C0w</code></pre><blockquote><p>Q0w</p></blockquote><p></p><p>B1w</p><p>Nw</p>`, `C0w@1` to the empty paragraph @0) writes `<p>Pw</p><p>A0w</p><pre><code>C</code></pre><p>B1w</p><p>Nw</p>`, caret `text:C@1`, one onChange, undo and redo hold: rows Pw, A0w, C, B1w, Nw on both sides, and `B1w` is not code. (`<base>` itself on the lined form keeps the break and leaves an empty quote: `<li>A0w<pre><code>C</code></pre><blockquote></blockquote><br />B1w</li>`.) A range that starts outside a block (in an item's text line, as the removal class sweep's 64 lined `line break` cells from `A0w@1`, or in another item) is unchanged: the break stays as the range leaves it (T32.1).
