# Task 26: answers to the coordinating session's asks (T55), part 1: items 2 to 4

Details and raw probe output: the builder's scratch `t55-a.md` and `t55/`.

## Item 2: P26-5 `g5|undo5|QT` is Backspace at the start of T1w

- generator (`gen_main.py` line 100): five Ctrl+Z with nothing to undo, a real click on `T1w` at 0, Backspace; then
  undo, redo, the letter `k`
- R1: writes `<li><blockquote><p>Q0wT1w</p></blockquote></li>`, caret `Q0wT1w@3`, one onChange; undo gives the stored
  value, redo the joined one, `k` gives `Q0wkT1w`
- base: writes nothing new (onChange once with the unchanged value)
- the meeting grid's `"QT@1 Backspace"` cell: the same write, `calls: 1`, caret `text:Q0wT1w@3`, typed `Q0wkT1w` (placed
  at the element point, reads back as `T1w@0`)
- rule: D3's join; the base's value is K5's missing join

## Item 3: P26-6 `g6|I1root-q|click|P`

- steps: a real click on the image, Escape (the caret at `quote/paragraph@element:2` at both builds), Block type
  "Paragraph", refocus, undo, redo, `k`
- every value equals the stored one at both builds until `k`, which gives `X0w<img />k` at both

| onChange count after | write | undo | redo | `k` |
| -------------------- | ----- | ---- | ---- | --- |
| base                 | 1     | 2    | 3    | 4   |
| R1                   | 1     | 1    | 1    | 2   |

- R1's value never changes at the undo: D7 and 16.10's carve-out, not a defect. The base also loses focus at Block type;
  R1 keeps it (15.14, T18.8).

## Item 4: P26-7 to P26-11, "(no join)"

- the label is `zzr10-beh-w-E.test.tsx`'s and names the paste, not the Delete: PR #116's tail join (Z6, Z9, Z13) does not
  merge the stored item's tail (`q` with its nested `n1q`) into the last pasted item, because an `ol` is pasted into a
  `ul` or the last pasted item is nested; the file's "(join)" cases are the ones where it does
- the Delete then runs at the end of `T1q`; the base writes the value back unchanged (onChange +1): K5's missing join in
  lined content
- the ordinary twins, at both builds (your two shapes, plus Z13's context, the quote version and plain text in place of
  the link): base and R1 identical, one onChange each, one undo restores the stored value
  - twin A, Delete at the end of `T1q` in `<ol><li>T1q</li></ol><ul><li>q<ul><li>n1q</li></ul></li></ul>`: `<ol><li>T1qq</li></ol><ul><li><ul><li>n1q</li></ul></li></ul>`
  - twin B, P26-10's shape without the rule: `<li>Aq<ul><li><a>T1q</a>q</li><li>n1q</li></ul></li>`
- R1's lined result is the twin's with the `<hr>` kept and the item's children carried the same way (5.3, 5.8's F2 row)

**For a ruling:** in twin A both builds, ordinary content included, leave an item that holds only a nested list
(`<li><ul><li>n1q</li></ul></li>`). Spec line 41 (the build leaves none of "K14's item that holds only a nested list"
where the head leaves one) may or may not cover it; R1 gives the base's result here.

## Item 1

Ruled (T55.1); the fix is in progress, with T55.2's bar. Items 5 to 7 and T55.3 follow in part 2.
