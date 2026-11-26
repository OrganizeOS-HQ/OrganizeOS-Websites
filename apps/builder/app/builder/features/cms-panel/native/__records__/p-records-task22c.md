# Task 22: measurements M-e1 to M-e10 (T45)

Measured on 2026-11-26. Branch: `task22-grids` (f75f306 plus the uncommitted grid work, without the
fixes of T45.1 to T45.4 and T45.7, which are being built elsewhere). Head: `<base>` 2a96a45, in
`<scratchpad>/r1-base`, under `timeout 600`.

Two scratch test files, run at both builds and then removed: one for M-e1 to M-e8 and M-e10, one for
M-e9. Each case mounts the value, places the caret, acts, and then types a letter. "Values" is every value
passed to onChange by the action, as stored (`plain()`, so links keep their `href` and images their
attributes). Raw output: `<scratchpad>/t22/me-branch.json`, `me-head.json`, `me9-branch.json`,
`me9-head.json`.

## M-e1 (T45.5): Paragraph at text:X1w@0 in `<blockquote><h3>H0w</h3>X1w</blockquote>` (root)

|        | Calls | Values                                                 | Caret after | Letter after                                |
| ------ | ----- | ------------------------------------------------------ | ----------- | ------------------------------------------- |
| Head   | 0     | none                                                   | text:X1w@0  | `<blockquote><h3>H0w</h3>kX1w</blockquote>` |
| Branch | 1     | `<blockquote><h3>H0w</h3>X1w</blockquote>` (unchanged) | text:X1w@0  | `<blockquote><h3>H0w</h3>kX1w</blockquote>` |

At the root the head does nothing: it does not unwrap the quote, and it fires no onChange.

## M-e2 (T45.10): every value a composition hands out (kit `ime("a")`)

TR@2 ime (`LI(T0w<hr>)`, `itemPoint(1, 2)`):

- Head, 3 calls:
  1. `<ul><li>Pw</li><li>T0w<hr />​</li><li>Nw</li></ul>`: the stored value with a U+200B where the
     composition starts. It is not the stored value.
  2. `<ul><li>Pw</li><li>T0w<hr />a</li><li>Nw</li></ul>`
  3. `<ul><li>Pw</li><li>T0w<hr />a</li><li>Nw</li></ul>`, the same as call 2.
- Branch, 1 call: `<ul><li>Pw</li><li>T0w<hr />a</li><li>Nw</li></ul>`.
- Both builds: caret text:a@1; the letter after gives `…T0w<hr />ak…`.

TR@1 ime (`itemPoint(1, 1)`):

- Head, 3 calls:
  1. `<ul><li>Pw</li><li>T0w​<hr /></li><li>Nw</li></ul>`: the stored value with a U+200B, not
     the stored value.
  2. `…T0wa<hr />…`
  3. `…T0wa<hr />…`, the same as call 2.
- Branch, 2 calls:
  1. `<ul><li>Pw</li><li>T0w<hr /></li><li>Nw</li></ul>`, the stored value.
  2. `…T0wa<hr />…`
- Both builds: caret text:T0wa@4; the letter gives `…T0wak<hr />…`.

At neither point is the head's first value the stored value. It holds U+200B at the caret. Its third value
repeats the second.

## M-e3 (T45.11): Code on `<p>X2wIMG</p>`, caret after the image (`element:paragraph@2`), then a letter

The same at both builds:

- Write `<pre><code>X2w</code></pre><p><img src="https://cdn.example.org/x.png" alt="" width="2" height="3" /></p>`, 1 call.
- Caret text:X2w@3.
- Letter: `<pre><code>X2wk</code></pre><p><img …/></p>`.

The letter lands at the end of the code text, not after the image.

## M-e4 (T45.11): Ctrl+Backspace after the image in `<blockquote><p>Q0w</p></blockquote><p>IMG</p>`

The same at both builds:

- Write `<blockquote><p>Q0w</p></blockquote><p></p>`, 1 call.
- Caret element:paragraph@0.
- Letter: `<blockquote><p>Q0w</p></blockquote><p>k</p>`.

The image alone goes, and the empty paragraph stays.

## M-e5 (T45.11): at text:X1w@0 in `<blockquote><h3>H0w</h3><p>X1w</p></blockquote>`

The same at both builds, for Ctrl+Backspace and for lineBack:

- Write `<blockquote><h3>H0wX1w</h3></blockquote>`, 1 call.
- Caret text:H0wX1w@3.
- Letter: `<blockquote><h3>H0wkX1w</h3></blockquote>`.

## M-e6 (T45.11): d6 TQT, the pastes at text:T0w@3

The same at both builds, for paste HTML (`<p>Aq</p><p>Bq</p>`) and for paste own:

- Write `<ul><li>A1w<ul><li>A2w<ul><li>A3w<ul><li>A4w<ul><li>A5w<ul><li>T0wAq</li></ul></li><li>Bq</li></ul></li></ul></li></ul></li></ul></li></ul><blockquote><p>Q1w</p></blockquote><p>T2w</p>`,
  1 call.
- Caret text:Bq@2.
- Letter: `…<li>Bqk</li>…`.

(This shape is the measuring file's d6 TQT, an ordinary `<ul>` chain with the quote in the innermost
item: the same stored value as the unreached grid's.)

## M-e7 (T45.11): Code at a caret in `<p><a href="https://example.org/a">Lw</a></p>`

The same at both builds, at Lw@0, Lw@1 and Lw@2:

- Write `<pre><code>Lw</code></pre>`, 1 call. The link and its address are gone.
- The caret stays at the same offset.
- Letter: `kLw`, `Lkw` and `Lwk` respectively.

The head loses the address.

## M-e8 (T45.11): Link at the text caret of AQ el1 and QA el1

The same at both builds:

- AQ el1, at text:Aw@2: `<ul><li>Pw</li><li><a href="https://example.org/">Aw</a><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>`.
  1 call, caret text:Aw@2. Letter: `…<a href="https://example.org/">Aw</a>k<blockquote>…`.
- QA el1, at text:Lw@0: `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><a href="https://example.org/">Lw</a></li><li>Nw</li></ul>`.
  1 call, caret text:Lw@0. Letter: `…</blockquote>k<a href="https://example.org/">Lw</a>…`.

At a caret inside an existing link, the head changes the link's address from `https://example.org/a` to
the kit's `https://example.org/`.

## M-e9 (T45.13 group 3): M-b's scan, with the letter, at both builds

The scan is a click on a fresh mount at every 12 px across (x 2 to the viewport's edge at 413) and every
6 px down the point's item (its top − 4 to its bottom + 4), then a letter. Every place was checked with
`document.elementFromPoint` to be inside the editable (all were).

RR@1 and RR@2 (`LI(<hr><hr>)`, rows y 28 to 52, 175 places), the same at both builds:

| Clicks | Caret              | Letter               |
| ------ | ------------------ | -------------------- |
| 140    | element:listitem@0 | `[k<hr /><hr />]`    |
| 35     | text:Nw@0          | `…</li><li>kNw</li>` |

No click on either build lands the letter between the two rules or after them: **0 hits**.

BQ el1 (`LI(<br><blockquote><p>Q1w</p></blockquote>)`, rows y 20 to 56, 245 places), the same at both
builds:

| Clicks | Caret              | Letter                                     |
| ------ | ------------------ | ------------------------------------------ |
| 105    | element:listitem@0 | `[k<br /><blockquote>…]`, before the break |
| 60     | text:Q1w@3         |                                            |
| 35     | text:Nw@0          |                                            |
| 32     | text:Pw@2          |                                            |
| 8      | text:Q1w@0         |                                            |
| 3      | text:Pw@0          |                                            |
| 2      | text:Q1w@2         |                                            |

No click on either build lands the letter after the break: **0 hits**.

QR@2: the same at both builds in every letter. 14 places (y 44, x 254 to 410) give
element:listitem@2 and the letter `…<hr />k`, at both builds. The only caret difference: 21 places
(y 44, x 2 to 242) give element:listitem@1 at the head and text:Q0w@3 on the branch. The letter is the
same, `<p>Q0wk</p>`.

TR@2: the same 14 places (y 44, x 254 to 410) give element:listitem@2 and the letter `[T0w<hr />k]` at
both builds. On y 44, x 2 to 242 (21 places) the head gives element:listitem@1 and the branch text:T0w@3,
with the same letter `[T0wk<hr />]`. **The letter differs at 93 places:** rows y 26, 32 and 38, x 50 to
410, on T0w's line to the right of its text.

| Build  | Caret      | Letter                                                      |
| ------ | ---------- | ----------------------------------------------------------- |
| Head   | text:T0w@0 | `[kT0w<hr />]`, at the start of the word                    |
| Branch | text:T0w@3 | `[T0wk<hr />]`, at the end of the word, where the click was |

**P22-7 (P record).** At the head, a click to the right of the text of an item's first line, in an item
`<li>T0w<hr /></li>`, puts the caret at the line's start, and the letter lands before T0w, away from the
click. The branch puts it at the text's end. The rows of QR@2 (where the text is in a quote's paragraph)
do not show it. This place is in no row of Task 22 Step 4's accepted list; it goes to the coordinating
session under T45.13.

## M-e10 (T45.9): a composition at the end of a link that ends a paragraph (kit `ime("a")` at text:Aw@2)

`<p><a href="https://example.org/a">Aw</a></p>`:

- Head, 3 calls:
  1. `<p><a href="https://example.org/a">Aw</a></p>`
  2. `<p><a href="https://example.org/a">Awa</a></p>`
  3. `<p><a href="https://example.org/a">Awa</a></p>`
- Branch, 2 calls: the same first two values.
- Both builds: caret text:Awa@3; letter `<p><a href="https://example.org/a">Awa</a>k</p>`.

`<p><a href="https://example.org/a">Aw</a></p><blockquote><p>Q1w</p></blockquote>`: the same pattern at
both builds. The values are `…<a …>Aw</a>…`, then `…<a …>Awa</a>…`, with the head repeating the second.
Letter: `<p><a …>Awa</a>k</p><blockquote>…`.

Control, a typed letter at the same caret, the same at both builds: `<p><a …>Aw</a>k</p>` (outside the
link), caret text:k@1.

In ordinary content, at both builds, the composed text joins the link, and a typed letter at the same
caret lands outside it.
