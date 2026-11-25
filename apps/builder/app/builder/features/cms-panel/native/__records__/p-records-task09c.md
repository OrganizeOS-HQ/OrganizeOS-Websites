# P record, Task 9 review

## P9-2: a caret line the resolver made, typed into, then emptied while it holds the caret

- Stored: QR shape in an item (`LI(<blockquote><p>Q0w</p></blockquote><hr />)`, the item's end after the rule).
- Place: a real click at the item's end: the resolver makes an empty caret line after the rule (5.3).
- Actions: type `k` (the line now holds `k`); Backspace (the line is emptied by a removal while it holds the caret, so it joins the set P26's build keeps, `emptiedLines`); Backspace again (removes the rule; the empty line now stands directly after the quote); type `k`.
- Branch (P26 as built): the emptied line keeps the caret: the last letter writes `...</blockquote>k</li>` (after the quote, in the line).
- Alternative: 5.3's lifetime clause (T21's P26 line says it covers caret lines the resolver makes): the line made by the resolver gives its point back (C2) once empty beside a block, and the letter lands in the quote: `<blockquote><p>Q0wk</p></blockquote>`.
- `<base>`: no lines; not measured (the shape differs at base).
- Question: does a resolver-made caret line, once typed into and emptied by a removal while it holds the caret, keep the caret as P26's emptied line does (A, branch), or stay a resolver line under 5.3 and give it back (B)?
