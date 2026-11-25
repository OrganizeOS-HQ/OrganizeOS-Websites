# Task 15: P records

Measured at the branch (Task 15's work on 06bd637), at `<base>` (SP/r1-base, 2a96a45, rich-text project) and, where named, at the branch before this task (06bd637). Writes are `short()`; "typed" is the value after a letter k typed right after the action. Nothing here is pinned in a test except where a line says so.

## P15-1: four over-reach cells of `base-enter-heading` differ from `<base>` (K18)

- Stored: `<ul><li>Pw</li><li><h3>AwBw</h3>T1w</li><li>Nw</li></ul>` (blockLed) and `<ul><li>Pw</li><li>T9w<h3>AwBw</h3>T1w</li><li>Nw</li></ul>` (lineLed).
- Place: `AwBw@4` (the heading's end), by a real click and set directly: four cells.
- Action: Enter, then k.
- `<base>` (the fixture): write `...<h3>AwBw</h3><p></p>T1w...`, typed `...<h3>AwBw</h3><p>k</p>T1w...`.
- Branch (before and after this task): write `...<h3>AwBw</h3><br />T1w...`, typed `...<h3>AwBw</h3>k<br />T1w...`.
- `$enterInHeading` does not act in these cells (a text point at the end of the heading's last text: Lexical's rule); the difference is the line rule on the paragraph Enter leaves in an item (5.5, K18). The plan asks the 12 cells to equal the fixture byte for byte; these four cannot. Pinned in the grid file with P24's ruled shape (carry: `<h3>H0w</h3>k<br />T1w`), the other eight against the fixture. Candidates: (a) as pinned (P24's shape); (b) the fixture's write, which contradicts P24.

## P15-2: `base-enter-range-root` holds 24 cells, not 19 (information)

- Check 5 (16.8) counts 19 cells and does not list them. The fixture holds every range of `<p>A0w</p><hr><p>B2w</p>` whose anchor is on the root directly before or after the rule, to the root's start, its end, the other side of the rule, `A0w@1`, `B2w@1` and `B2w@3`, with Enter and with Shift+Enter: 24 cells. Each differs from `<base>` and equals the oracle (Backspace over the range, then the key), pinned.
- Measured beyond them, not pinned: every range with an end on the root among seven ends (root start, root end, before and after the rule, `A0w@1`, `B2w@1`, `B2w@3`), both keys: 72 cells. All 72 equal the oracle at the branch; at `<base>` 57 differ from it.

## P15-3: K18 and F9 rows: Enter is the edit, the letter is `typed`

- K18: `LI(<h3>H0w</h3>T1w)`, `H0w@end`, Enter; F9: `<ul><li>Zw<ul><li><blockquote><p>Q0w</p>X1w</blockquote></li></ul></li></ul>`, `X1w@end`, Enter.
- P24 and P25 record Enter and the letter as one row (two onChanges; their undo restores the state after Enter: `afterUndo`). The kit's one-undo check cannot hold for a two-edit row, so the tests pin Enter as the edit, with the write the record's `afterUndo` (`W(<li><h3>H0w</h3><br />T1w</li>)`; `...X1w<p></p></blockquote>...`) and `typed` the record's write (`W(<li><h3>H0w</h3>k<br />T1w</li>)`; `...X1w<p>k</p></blockquote>...`). Branch: as pinned; one undo restores the stored value. Candidates: (a) as pinned; (b) Enter and the letter as one action, two onChanges, without the one-undo check.

## P15-4: Enter over a range that empties a block of a lined container it does not start in (M13b's class, beyond its cells)

- Stored and places (Enter):
  - `LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)`, `T0w@1 to Q1w@3`;
  - `LI(T0w<blockquote><p>Q1w</p></blockquote><hr>)`, `T0w@2 to Q1w@3`;
  - `LI(T0w<blockquote><p>Q1w</p></blockquote>)`, `T0w@0 to Q1w@3`.
- Branch before this task: the emptied quote goes to the new item with the caret in it: `W(<li>T</li><li><blockquote></blockquote>T2w</li>)`, typed `...<blockquote>k</blockquote>T2w...`; `W(<li>T0</li><li><blockquote></blockquote><hr /></li>)`, typed `...<blockquote>k</blockquote><hr />...`; `<ul><li>Pw</li><li></li><li></li><li>Nw</li></ul>`, typed `...<li><blockquote>k</blockquote></li>...`.
- Branch now (the oracle's for the first two): `W(<li>T</li><li>T2w</li>)`, typed `...<li>kT2w</li>...`; `W(<li>T0</li><li><hr /></li>)`, typed `...<li>k<hr /></li>...`; the third keeps its write, typed `<ul><li>Pw</li><li></li><li>k</li><li>Nw</li></ul>` (its oracle, Backspace then Enter, takes the emptied item out of the list: `<ul><li>Pw</li></ul><p></p><ul><li>Nw</li></ul>`).
- `<base>`: the empty quote stays (`W(<li>T</li><li><blockquote></blockquote>T2w</li>)`; `W(<li>T0</li><li><blockquote></blockquote><hr /></li>)`; `W(<li></li>)` for the third).
- Built for M13b (5.4 "Emptied": the quote held no point and lost all its children); only M13a and M13b are pinned. Shift+Enter over the same ranges is unchanged. Ordinary content is unchanged (measured on nine shapes: a paragraph into a quote, list, nested list, second quote; equal before and after this task).
- Ruled (T35.2): the change stands (5.4); three cells are pinned with the writes above in `rich-text-line-enter.test.tsx` ("Enter over a range that empties a quote ...").

## P15-5: T11.4's oracle and M8g disagree for a range Lexical removes itself

- Stored: `<ul><li>Aw</li><li>Bw</li></ul>`; place: a triple click on Aw (`text:Aw@0|text:Aw@2`); Enter.
- M8g (confirm, spec 5.4) and the test on the branch: `<ul><li></li><li></li><li>Bw</li></ul>`. The oracle, Backspace then Enter: `<p></p><ul><li>Bw</li></ul>` (Lexical's list rule for Enter in an empty item).
- Also, ordinary content, both builds: `<p>Aw</p><blockquote><p>Qw</p></blockquote><p>Zw</p>`, `Aw@0 to Qw@2`, Enter: `<p></p><p></p><p>Zw</p>` (`<base>` keeps an empty quote as well); the oracle `<blockquote></blockquote><p></p><p>Zw</p>`. `<h2>Aw</h2><blockquote><p>Qw</p></blockquote><p>Zw</p>`, the same range: `<h2></h2><p></p><p>Zw</p>`; the oracle `<p></p><p></p><p>Zw</p>` (Backspace turns an emptied first heading of the root into a paragraph).
- The branch removes the range itself only for 16.8 (an end on the root) and M13b's class (P15-4); every other range keeps Lexical's removal and split, as M8g requires. Candidates: (a) as built (T11.4's oracle for ranges with an end on the root and for M13b's class; M8g's head write elsewhere); (b) T11.4's oracle for every range, which changes M8g and the two ordinary writes above.
- Ruled (T35.1): (a) as built. Enter and Shift+Enter over a range are the removal of the range, then the break at the point it leaves (Lexical's order; M8g stays).
