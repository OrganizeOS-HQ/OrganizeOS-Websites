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
