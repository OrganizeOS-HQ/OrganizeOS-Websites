# T47: measurements M-g1 to M-g3 and the fixes they call for

Measured on 2026-11-26. Branch: `t47-fixes` from `dae1f44`. Head: `<base>` 2a96a45 in `<scratchpad>/r1-base`;
the kit (`rich-text-line-test-kit.tsx`, `rich-text-line-test-compare.ts`) and one scratch test file were
copied there for the run and removed after it. Each row: stored value (as the kit shortens it), the caret
before the action (`caretKey`), the write (the last onChange's value, `null` with no onChange), the
onChange calls ("value unchanged" where the write equals the value before), the caret after, and the value
after a letter `k` (empty where nothing was handed out after the letter). Places: `itemPoint(i, 0)` an
element point at the item's baseline offset 0; `at(word, n)` a real click at that text offset;
`range(a, i, b, j)` set by code; Paragraph by `chooseBlockType("Paragraph")` (no extra focus).

## M-g1 (T47.3): backward forms at the empty first line of the first item, before a rule, at the content's start

Shapes: depth 1 `<ul><li><hr>T1w</li><li>Nw</li></ul>` at `itemPoint(0, 0)`; depth 7 the same list inside
six more lists whose items hold only the nested list (`<ul><li><ul><li>` ... `<ul><li><hr>T1w</li><li>Nw</li></ul>`
... `</li></ul>`), at `itemPoint(6, 0)` (the six wrapper items come first). Backspace is shown for reference.

Branch (`dae1f44`, before the fix):

```
M-g1 d1 Backspace | stored <ul><li><hr />T1w</li><li>Nw</li></ul> | caret before element:listitem@0 | write <p></p><hr /><p>T1w</p><ul><li>Nw</li></ul> | calls 1 | caret element:paragraph@0 | letter <p>k</p><hr /><p>T1w</p><ul><li>Nw</li></ul>
M-g1 d1 Ctrl+Backspace | stored <ul><li><hr />T1w</li><li>Nw</li></ul> | caret before element:listitem@0 | write null | calls 0 | caret element:listitem@0 | letter <ul><li>k<hr />T1w</li><li>Nw</li></ul>
M-g1 d1 lineBack | stored <ul><li><hr />T1w</li><li>Nw</li></ul> | caret before element:listitem@0 | write <ul><li><hr />T1w</li><li>Nw</li></ul> | calls 1 (value unchanged) | caret element:listitem@0 | letter <ul><li>k<hr />T1w</li><li>Nw</li></ul>
M-g1 d7 Backspace | stored <ul><li><ul><li><ul><li><ul><li><ul><li><ul><li><ul><li><hr />T1w</li><li>Nw</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> | caret before element:listitem@0 | write <ul><li><ul><li><ul><li><ul><li><ul><li><ul><li><hr />T1w<ul><li>Nw</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul> | calls 1 | caret element:listitem@0 | letter <ul><li><ul><li><ul><li><ul><li><ul><li><ul><li>k<hr />T1w<ul><li>Nw</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
M-g1 d7 Ctrl+Backspace | stored (as d7 above) | caret before element:listitem@0 | write null | calls 0 | caret element:listitem@0 | letter <ul><li><ul><li><ul><li><ul><li><ul><li><ul><li><ul><li>k<hr />T1w</li><li>Nw</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
M-g1 d7 lineBack | stored (as d7 above) | caret before element:listitem@0 | write (the stored value) | calls 1 (value unchanged) | caret element:listitem@0 | letter <ul><li><ul><li><ul><li><ul><li><ul><li><ul><li><ul><li>k<hr />T1w</li><li>Nw</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>
```

Base:

```
M-g1 d1 Backspace | stored <ul><li><hr />T1w</li><li>Nw</li></ul> | caret before element:listitem@0 | write <hr /><p>T1w</p><ul><li>Nw</li></ul> | calls 1 | caret text:Nw@0 | letter <hr /><p>T1w</p><ul><li>kNw</li></ul>
M-g1 d1 Ctrl+Backspace | stored <ul><li><hr />T1w</li><li>Nw</li></ul> | caret before element:listitem@0 | write null | calls 0 | caret element:listitem@0 | letter <ul><li>k<hr />T1w</li><li>Nw</li></ul>
M-g1 d1 lineBack | stored <ul><li><hr />T1w</li><li>Nw</li></ul> | caret before element:listitem@0 | write <ul><li><hr />T1w</li><li>Nw</li></ul> | calls 1 (value unchanged) | caret element:listitem@0 | letter <ul><li>k<hr />T1w</li><li>Nw</li></ul>
M-g1 d7 Backspace | (as the branch's d7 Backspace row)
M-g1 d7 Ctrl+Backspace | (as the branch's d7 Ctrl+Backspace row)
M-g1 d7 lineBack | (as the branch's d7 lineBack row: the stored value, 1 call, value unchanged)
```

Reading and fix: lineBack hands out the value unchanged at both depths (and at the base: D7, "also where the
head makes one"); Ctrl+Backspace fires none and stands. Fixed (Task 14): T45.3's condition in `$emptyLine`
(`rich-text-line-deletes.ts`) now reads either direction: the word and line forms in an empty line with
nothing that way in its container and nothing beyond the container that way in the document return true,
touching nothing (`$nothingAfter` became `$nothingBeyond(node, isBackward)`). Ctrl+Backspace's result is
unchanged (it now stops there instead of reaching Lexical's no-op). Backspace is not affected. Test
"T47.3: the backward word and line forms at an empty line at the content's start (M-g1)" in
`rich-text-line-deletes.test.tsx` (depth 1 and 7, both forms): no onChange, no undo step, caret
`element:listitem@0`, letter before the rule. With the fix taken out the two lineBack cells fail. The older
test "the first item's empty first line, line form backward: the value stays" still passes unchanged.

## M-g2 (T47.5): Backspace at the start of a line that is not the item's first line, depth 1 beside depth 2

Shapes: `d1(m)` = `<ul><li>Pw</li><li>m</li><li>Nw</li></ul>`, `d2(m)` =
`<ul><li>Aw<ul><li>Pw</li><li>m</li><li>Nw</li></ul></li></ul>`. Cells: TRT `T0w<hr>T2w` at `at("T2w", 0)`; TQT
`T0w<blockquote><p>Q1w</p></blockquote>T2w` at `at("T2w", 0)`; TBTR `T0w<br>T1w<hr>` at `at("T1w", 0)`; RR `<hr><hr>`
at `itemPoint(1, 1)` (d1) and `itemPoint(3, 1)` (d2: Lexical's nested list puts a wrapper item before Pw); control,
ordinary content, `T0w<br>T1w` at `at("T1w", 0)`.

Branch (`dae1f44`):

```
M-g2 d1 RR el1 | stored <ul><li>Pw</li><li><hr /><hr /></li><li>Nw</li></ul> | caret before element:listitem@1 | write <ul><li>Pw</li><li><hr /></li><li>Nw</li></ul> | calls 1 | caret element:listitem@0 | letter <ul><li>Pw</li><li>k<hr /></li><li>Nw</li></ul>
M-g2 d1 TBTR T1w@0 | stored <ul><li>Pw</li><li>T0w<br />T1w<hr /></li><li>Nw</li></ul> | caret before text:T1w@0 | write <ul><li>Pw</li><li>T0wT1w<hr /></li><li>Nw</li></ul> | calls 1 | caret text:T0wT1w@3 | letter <ul><li>Pw</li><li>T0wkT1w<hr /></li><li>Nw</li></ul>
M-g2 d1 TQT T2w@0 | stored <ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul> | caret before text:T2w@0 | write <ul><li>Pw</li><li>T0w<blockquote><p>Q1wT2w</p></blockquote></li><li>Nw</li></ul> | calls 1 | caret text:Q1wT2w@3 | letter <ul><li>Pw</li><li>T0w<blockquote><p>Q1wkT2w</p></blockquote></li><li>Nw</li></ul>
M-g2 d1 TRT T2w@0 | stored <ul><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ul> | caret before text:T2w@0 | write <ul><li>Pw</li><li>T0wT2w</li><li>Nw</li></ul> | calls 1 | caret text:T0wT2w@3 | letter <ul><li>Pw</li><li>T0wkT2w</li><li>Nw</li></ul>
M-g2 d1 control plain TBT T1w@0 | stored <ul><li>Pw</li><li>T0w<br />T1w</li><li>Nw</li></ul> | caret before text:T1w@0 | write <ul><li>Pw</li><li>T0wT1w</li><li>Nw</li></ul> | calls 1 | caret text:T0wT1w@3 | letter <ul><li>Pw</li><li>T0wkT1w</li><li>Nw</li></ul>
M-g2 d2 TBTR T1w@0 | stored <ul><li>Aw<ul><li>Pw</li><li>T0w<br />T1w<hr /></li><li>Nw</li></ul></li></ul> | caret before text:T1w@0 | write <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />T1w<hr /><ul><li>Nw</li></ul></li></ul> | calls 1 | caret text:T1w@0 | letter <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />kT1w<hr /><ul><li>Nw</li></ul></li></ul>
M-g2 d2 TQT T2w@0 | stored <ul><li>Aw<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul></li></ul> | caret before text:T2w@0 | write <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w<ul><li>Nw</li></ul></li></ul> | calls 1 | caret text:T2w@0 | letter <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<blockquote><p>Q1w</p></blockquote>kT2w<ul><li>Nw</li></ul></li></ul>
M-g2 d2 TRT T2w@0 | stored <ul><li>Aw<ul><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ul></li></ul> | caret before text:T2w@0 | write <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr />T2w<ul><li>Nw</li></ul></li></ul> | calls 1 | caret text:T2w@0 | letter <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr />kT2w<ul><li>Nw</li></ul></li></ul>
M-g2 d2 control plain TBT T1w@0 | stored <ul><li>Aw<ul><li>Pw</li><li>T0w<br />T1w</li><li>Nw</li></ul></li></ul> | caret before text:T1w@0 | write <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />T1w<ul><li>Nw</li></ul></li></ul> | calls 1 | caret text:T1w@0 | letter <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />kT1w<ul><li>Nw</li></ul></li></ul>
M-g2 d2 RR el1 | stored <ul><li>Aw<ul><li>Pw</li><li><hr /><hr /></li><li>Nw</li></ul></li></ul> | caret before element:listitem@1 | write <ul><li>Aw<ul><li>Pw</li><li><hr /></li><li>Nw</li></ul></li></ul> | calls 1 | caret element:listitem@0 | letter <ul><li>Aw<ul><li>Pw</li><li>k<hr /></li><li>Nw</li></ul></li></ul>
```

Base (each cell its own run under `timeout 150`; `M-g2 d1 TQT T2w@0` did not finish: the base hangs there,
T45.14's hang, at depth 1; at depth 2 it outdents):

```
M-g2 d1 RR el1 | stored <ul><li>Pw</li><li><hr /><hr /></li><li>Nw</li></ul> | caret before element:listitem@1 | write <ul><li>Pw</li><li><hr /></li><li>Nw</li></ul> | calls 1 | caret element:listitem@0 | letter <ul><li>Pw</li><li>k<hr /></li><li>Nw</li></ul>
M-g2 d1 TBTR T1w@0 | stored <ul><li>Pw</li><li>T0w<br />T1w<hr /></li><li>Nw</li></ul> | caret before text:T1w@0 | write <ul><li>Pw</li><li>T0wT1w<hr /></li><li>Nw</li></ul> | calls 1 | caret text:T0wT1w@3 | letter <ul><li>Pw</li><li>T0wkT1w<hr /></li><li>Nw</li></ul>
M-g2 d1 TRT T2w@0 | stored <ul><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ul> | caret before text:T2w@0 | write <ul><li>Pw</li><li>T0wT2w</li><li>Nw</li></ul> | calls 1 | caret text:T0wT2w@3 | letter <ul><li>Pw</li><li>T0wkT2w</li><li>Nw</li></ul>
M-g2 d1 control plain TBT T1w@0 | stored <ul><li>Pw</li><li>T0w<br />T1w</li><li>Nw</li></ul> | caret before text:T1w@0 | write <ul><li>Pw</li><li>T0wT1w</li><li>Nw</li></ul> | calls 1 | caret text:T0wT1w@3 | letter <ul><li>Pw</li><li>T0wkT1w</li><li>Nw</li></ul>
M-g2 d2 RR el1 | stored <ul><li>Aw<ul><li>Pw</li><li><hr /><hr /></li><li>Nw</li></ul></li></ul> | caret before element:listitem@1 | write <ul><li>Aw<ul><li>Pw</li><li><hr /></li><li>Nw</li></ul></li></ul> | calls 1 | caret element:listitem@0 | letter <ul><li>Aw<ul><li>Pw</li><li>k<hr /></li><li>Nw</li></ul></li></ul>
M-g2 d2 TBTR T1w@0 | stored <ul><li>Aw<ul><li>Pw</li><li>T0w<br />T1w<hr /></li><li>Nw</li></ul></li></ul> | caret before text:T1w@0 | write <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />T1w<hr /><ul><li>Nw</li></ul></li></ul> | calls 1 | caret text:T1w@0 | letter <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />kT1w<hr /><ul><li>Nw</li></ul></li></ul>
M-g2 d2 TQT T2w@0 | stored <ul><li>Aw<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul></li></ul> | caret before text:T2w@0 | write <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w<ul><li>Nw</li></ul></li></ul> | calls 1 | caret text:T2w@0 | letter <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<blockquote><p>Q1w</p></blockquote>kT2w<ul><li>Nw</li></ul></li></ul>
M-g2 d2 TRT T2w@0 | stored <ul><li>Aw<ul><li>Pw</li><li>T0w<hr />T2w</li><li>Nw</li></ul></li></ul> | caret before text:T2w@0 | write <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr />T2w<ul><li>Nw</li></ul></li></ul> | calls 1 | caret text:T2w@0 | letter <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr />kT2w<ul><li>Nw</li></ul></li></ul>
M-g2 d2 control plain TBT T1w@0 | stored <ul><li>Aw<ul><li>Pw</li><li>T0w<br />T1w</li><li>Nw</li></ul></li></ul> | caret before text:T1w@0 | write <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />T1w<ul><li>Nw</li></ul></li></ul> | calls 1 | caret text:T1w@0 | letter <ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />kT1w<ul><li>Nw</li></ul></li></ul>
```

Reading:

- The branch outdents and depth 1 does not at d2 TRT T2w@0, d2 TQT T2w@0 and d2 TBTR T1w@0. The base outdents at
  all three as well, so the branch equals the head there.
- d2 RR el1 removes the rule before at both builds, as at depth 1 (T45.7's handler on the branch). No change needed.
- Control, ordinary content, d2 `T0w<br>T1w` at T1w@0: both builds outdent the item
  (`<ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<br />T1w<ul><li>Nw</li></ul></li></ul>`, caret `text:T1w@0`), where
  depth 1 removes the break (`T0wT1w`). This is today's behaviour in all content: a note for the owner, not a fix.

## P47-1 (T47.5): the widening contradicts KS4, which is pinned equal to the head. Not committed

The widening was built: `deletes.emptyLineRuleBeforeOutdent` became `deletes.lineStartBeforeOutdent`. At a
collapsed caret at offset 0 in a line of a lined container whose indent is above 0, it does what depth 1 does
(prevents the key's default and dispatches DELETE_CHARACTER backward), unless the caret is at the start of the
item's first line. The three cells then give the depth-1 write at depth 2 with the item keeping its depth:
`T0wT2w`, `T0w<blockquote><p>Q1wT2w</p></blockquote>`, `T0wT1w<hr />`. Tests were written for each, plus d2 RR el1,
the ordinary control and the first-line control.

It fails two existing branch tests in `rich-text-line-deletes.test.tsx`. The plan pins both from the measured
records M12a and M12b. The spec's KS table says "KS2, KS3, FS3, KS4: Equal to the head":

- "KS4: depth 2 TRT": `<ul><li>Aw<ul><li>Pw</li><li>T0w<hr>T2w</li><li>Nw</li></ul></li><li>Zw</li></ul>` at T2w@0, Backspace.
  - Pinned: `<ul><li>Aw<ul><li>Pw</li></ul></li><li>T0w<hr />T2w<ul><li>Nw</li></ul></li><li>Zw</li></ul>`, the head's outdent.
  - Widened: `<ul><li>Aw<ul><li>Pw</li><li>T0wT2w</li><li>Nw</li></ul></li><li>Zw</li></ul>`.
- "KS4: depth 2 RT": `<ul><li>Aw<ul><li>Pw</li><li><hr>T1w</li><li>Nw</li></ul></li><li>Zw</li></ul>` at T1w@0, Backspace.
  - Pinned: `<ul><li>Aw<ul><li>Pw</li></ul></li><li><hr />T1w<ul><li>Nw</li></ul></li><li>Zw</li></ul>`.
  - Widened: `<ul><li>Aw<ul><li>Pw</li><li>T1w</li><li>Nw</li></ul></li><li>Zw</li></ul>`.

KS4 TRT is the M-g2 d2 TRT cell, with an extra item Zw. T47.5 widens it; the spec's KS row and M12b keep the head's
outdent. Which one holds is the coordinating session's call; if the widening stands, KS4's two pins change with it.
The widening is saved as a patch outside the repository (`<scratchpad>/t47-g2-widening.patch`, against fb1c58b) and
is not in any commit.

## M-g3 (T47.6): Paragraph in HQ, in an item and at the root

Shapes: item `LI(<blockquote><h3>H0w</h3>X1w</blockquote>T2w)`, root `<blockquote><h3>H0w</h3>X1w</blockquote>`.
Places: `range("X1w", 1, "X1w", 2)`; `range("H0w", 1, "X1w", 1)`. The empty line after the heading is stored as
`<blockquote><h3>H0w</h3><br>X1w</blockquote>` (in the item and at the root), with the caret at
`containerPoint("X1w", 1)`, the quote's element point after the heading. On both builds that point is
`element:quote@1`, and a letter lands before the break. At the base, focus stays on the select after it closes
(T18.8), so no letter follows a no-op Paragraph there; those letter fields are empty.

Branch (`dae1f44`):

```
M-g3 item empty line after the heading (el1 on the quote, stored with <br>) | stored <ul><li>Pw</li><li><blockquote><h3>H0w</h3><br />X1w</blockquote>T2w</li><li>Nw</li></ul> | caret before element:quote@1 | write <ul><li>Pw</li><li><blockquote><h3>H0w</h3><br />X1w</blockquote>T2w</li><li>Nw</li></ul> | calls 1 (value unchanged) | caret element:quote@1 | letter <ul><li>Pw</li><li><blockquote><h3>H0w</h3>k<br />X1w</blockquote>T2w</li><li>Nw</li></ul>
M-g3 item range H0w@1..X1w@1 | stored <ul><li>Pw</li><li><blockquote><h3>H0w</h3>X1w</blockquote>T2w</li><li>Nw</li></ul> | caret before text:H0w@1|text:X1w@1 | write <ul><li>Pw</li><li><blockquote><p>H0w</p>X1w</blockquote>T2w</li><li>Nw</li></ul> | calls 1 | caret text:H0w@1|text:X1w@1 | letter <ul><li>Pw</li><li><blockquote><p>Hk1w</p></blockquote>T2w</li><li>Nw</li></ul>
M-g3 item range X1w@1..X1w@2 | stored <ul><li>Pw</li><li><blockquote><h3>H0w</h3>X1w</blockquote>T2w</li><li>Nw</li></ul> | caret before text:X1w@1|text:X1w@2 | write <ul><li>Pw</li><li><blockquote><h3>H0w</h3>X1w</blockquote>T2w</li><li>Nw</li></ul> | calls 1 (value unchanged) | caret text:X1w@1|text:X1w@2 | letter <ul><li>Pw</li><li><blockquote><h3>H0w</h3>Xkw</blockquote>T2w</li><li>Nw</li></ul>
M-g3 root empty line after the heading (el1 on the quote, stored with <br>) | stored <blockquote><h3>H0w</h3><br />X1w</blockquote> | caret before element:quote@1 | write <blockquote><h3>H0w</h3><br />X1w</blockquote> | calls 1 (value unchanged) | caret element:quote@1 | letter <blockquote><h3>H0w</h3>k<br />X1w</blockquote>
M-g3 root range H0w@1..X1w@1 | stored <blockquote><h3>H0w</h3>X1w</blockquote> | caret before text:H0w@1|text:X1w@1 | write <blockquote><p>H0w</p>X1w</blockquote> | calls 1 | caret text:H0w@1|text:X1w@1 | letter <blockquote><p>Hk1w</p></blockquote>
M-g3 root range X1w@1..X1w@2 | stored <blockquote><h3>H0w</h3>X1w</blockquote> | caret before text:X1w@1|text:X1w@2 | write <blockquote><h3>H0w</h3>X1w</blockquote> | calls 1 (value unchanged) | caret text:X1w@1|text:X1w@2 | letter <blockquote><h3>H0w</h3>Xkw</blockquote>
```

Base:

```
M-g3 item empty line after the heading (el1 on the quote, stored with <br>) | stored <ul><li>Pw</li><li><blockquote><h3>H0w</h3><br />X1w</blockquote>T2w</li><li>Nw</li></ul> | caret before element:quote@1 | write null | calls 0 | caret element:quote@1 | letter
M-g3 item range H0w@1..X1w@1 | stored <ul><li>Pw</li><li><blockquote><h3>H0w</h3>X1w</blockquote>T2w</li><li>Nw</li></ul> | caret before text:H0w@1|text:X1w@1 | write <ul><li>Pw</li><li><blockquote><p>H0w</p>X1w</blockquote>T2w</li><li>Nw</li></ul> | calls 1 | caret text:H0w@1|text:X1w@1 | letter <ul><li>Pw</li><li><blockquote><p>H0w</p>X1w</blockquote>T2w</li><li>Nw</li></ul>
M-g3 item range X1w@1..X1w@2 | stored <ul><li>Pw</li><li><blockquote><h3>H0w</h3>X1w</blockquote>T2w</li><li>Nw</li></ul> | caret before text:X1w@1|text:X1w@2 | write null | calls 0 | caret text:X1w@1|text:X1w@2 | letter
M-g3 root empty line after the heading (el1 on the quote, stored with <br>) | stored <blockquote><h3>H0w</h3><br />X1w</blockquote> | caret before element:quote@1 | write null | calls 0 | caret element:quote@1 | letter
M-g3 root range H0w@1..X1w@1 | stored <blockquote><h3>H0w</h3>X1w</blockquote> | caret before text:H0w@1|text:X1w@1 | write <blockquote><p>H0w</p>X1w</blockquote> | calls 1 | caret text:H0w@1|text:X1w@1 | letter <blockquote><p>H0w</p>X1w</blockquote>
M-g3 root range X1w@1..X1w@2 | stored <blockquote><h3>H0w</h3>X1w</blockquote> | caret before text:X1w@1|text:X1w@2 | write null | calls 0 | caret text:X1w@1|text:X1w@2 | letter
```

Reading and fix:

- The branch hands out the value unchanged at the range inside X1w and at the empty line after the heading, in the
  item and at the root. The base writes nothing at all four.
- Fixed (Task 19): `$refuseParagraphInQuote` (`rich-text-line-toolbar.ts`) now takes ranges and element points.
- It refuses when:
  - both ends stand in a lined quote, through their line or as an element point on the quote;
  - neither quote nor any ancestor holds inline content first once the quote's lines give way;
  - every node the selection reaches is a line of a quote or holds no inline content first.
- That is when Lexical's `$setBlocksType` finds no block. The four cells now write nothing (no onChange, no undo
  step, the caret unchanged). With the old refusal they fail.
- The range from H0w into X1w changes the heading at both builds: `<blockquote><p>H0w</p>X1w</blockquote>`. The
  branch's item result is the base's root result inside the item. It equals the base's item write and is pinned as
  a control. No P record.
- Tests: "Paragraph in a lined quote after a heading changes nothing: a range inside X1w, in an item / at the root",
  "...: the empty line after the heading, in an item / at the root", and "control: Paragraph over a range from the
  heading into X1w makes the heading a paragraph".

## T47.4

- Test "Quote over a range from a line that could hold a quote to a line at the depth limit writes nothing":
  `d7 TR`, `range("A6w", 1, "T0w", 1)`, Quote: no write, no onChange, no undo step.
- Its precondition: Quote at A6w@1 alone makes a quote.
- With T45.4's refusal taken out, it fails.
