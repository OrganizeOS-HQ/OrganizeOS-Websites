# Task 22: measurements M-f1 to M-f3 (T46.11)

Measured on 2026-11-26, at both builds. Branch: `task22-grids` (b2023bb plus the uncommitted grid work,
without the fixes of T45 and T46.1). Head: `<base>` 2a96a45, in `<scratchpad>/r1-base`, under
`timeout 600`.

One scratch test file was run at each build and then removed. Each case mounts the value, places the
caret, acts, then types a letter. "Values" is every value the action passed to onChange, as stored
(`plain()`). The kit's `ime("a")` is the composition. Raw output: `<scratchpad>/t22/mf-branch.json` and
`mf-head.json`.

## M-f1 (T46.3): a composition in ordinary content where Lexical inserts the start character

`<p>Aw</p><p></p>`, the caret in the empty paragraph (`element:paragraph@0`):

| | Calls | Values in order | Caret | Letter |
|---|---|---|---|---|
| Head | 3 | `<p>Aw</p><p>​</p>` (holds U+200B); `<p>Aw</p><p>a</p>`; `<p>Aw</p><p>a</p>` | text:a@1 | `<p>Aw</p><p>ak</p>` |
| Branch | 1 | `<p>Aw</p><p>a</p>` | text:a@1 | `<p>Aw</p><p>ak</p>` |

`<p>Aw<img …/></p>`, the caret after the image (`element:paragraph@2`):

| | Calls | Values in order | Caret | Letter |
|---|---|---|---|---|
| Head | 3 | `<p>Aw<img …/>​</p>` (holds U+200B); `<p>Aw<img …/>a</p>`; `<p>Aw<img …/>a</p>` | text:a@1 | `<p>Aw<img …/>ak</p>` |
| Branch | 1 | `<p>Aw<img …/>a</p>` | text:a@1 | `<p>Aw<img …/>ak</p>` |

In ordinary content too, the head's first value holds U+200B, and its third repeats the second. The branch
hands out the composed value once.

## M-f2 (T46.6): P22-7's controls, a click to the right of the text

The place is 20, 150 and 300 px right of the end of `T0w`, at the text's vertical middle. Every place is
inside the editable (`elementFromPoint`), and no click fires onChange.

| Stored | Place (relative to the editable) | Head: caret; letter | Branch: caret; letter |
|---|---|---|---|
| `<ul><li>Pw</li><li>T0w</li><li>Nw</li></ul>` | 69,32 / 199,32 / 349,32 | text:T0w@3; `<ul><li>Pw</li><li>T0wk</li><li>Nw</li></ul>` (all three) | the same (all three) |
| `<p>T0w</p>` | 53,16 / 183,16 / 333,16 | text:T0w@3; `<p>T0wk</p>` (all three) | the same (all three) |

In ordinary content the head leaves the caret at the text's end. The controls are equal at both builds
and are pinned in the click test. The branch's controls equal its lined result (text:T0w@3, the letter at
the end).

## M-f3 (not blocking): Paragraph at text:X1w@1 in the root `<blockquote><h3>H0w</h3>X1w</blockquote>`

| | Calls | Values | Caret | Letter |
|---|---|---|---|---|
| Head | 0 | none | text:X1w@1 | `<blockquote><h3>H0w</h3>Xk1w</blockquote>` |
| Branch | 1 | `<blockquote><h3>H0w</h3>X1w</blockquote>` (unchanged) | text:X1w@1 | `<blockquote><h3>H0w</h3>Xk1w</blockquote>` |

The head does nothing at X1w@1 as at X1w@0 (M-e1): Paragraph's result there does not depend on the
offset. The branch's unchanged onChange is T46.1's defect at this offset too.
