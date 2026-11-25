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

## Built without a P record (named here for the commit body)

- 16.10: Delete at a caret at the end of a quote or list ending in an image or a link, before a root-level rule (`R|quote|img|none|end|0|del` and seven more cells of `base-1510`, image and link ends): at 3dbfe6a it handed out the value before (one onChange, value unchanged, D19); `<base>` writes nothing. Now nothing is written, as at `<base>` and as with a text end.
- 15.10's mirror: a letter or a paste over a range from the root before a rule into the start of a quote's text after it (`L|*|text|quote|start|2|k`, `plain`, `htmlPaste`: 15 cells) took the quote's paragraph out of the quote (the head too); now it is Backspace over the range, then the key, as the mirror's rule asks.
