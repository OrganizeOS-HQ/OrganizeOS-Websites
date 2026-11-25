# T21 typed-only rows: typed at base and at the carry

The letter k typed right after the action (Task 5 recordEdit typeAfter). Base = 2a96a45, carry = 8e6838e. Values from the Task 5 runs (r1-measurements.head.json; carry: the same rows run at the carry). Plan row = the row of Task 5 Step 1 or Step 4 that defines the id (M28s rows: the M28 Shift walk, shape and direction and step count in the id).

## M14l

- plan row: | M14l | `<ul><li>xq<hr>yq</li></ul>` | `node(hr)` | Enter | FS0 Enter |
- value before the action (base / carry): `<ul><li>xq<hr />yq</li></ul>` / `<ul><li>xq<hr />yq</li></ul>`
- caret before (base / carry): node:horizontalrule / node:horizontalrule
- write (base / carry): `null` / `null`
- caret after (base / carry): node:horizontalrule / node:horizontalrule
- typed (base): `<ul><li>kxq<hr />yq</li></ul>`
- typed (carry): `<ul><li>xq<hr />kyq</li></ul>`

## M18a

- plan row: | M18a | `<p>Pw</p><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>` | `Pw@1 to X0w@2` | Quote | FS4 |
- value before the action (base / carry): `<p>Pw</p><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>` / `<p>Pw</p><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>`
- caret before (base / carry): text:Pw@1|text:X0w@2 / text:Pw@1|text:X0w@2
- write (base / carry): `<blockquote>Pw</blockquote><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>` / `<blockquote>Pw</blockquote><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>`
- caret after (base / carry): text:Pw@1|text:X0w@2 / text:Pw@1|text:X0w@2
- typed (base): `<blockquote>Pkw<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>`
- typed (carry): `<blockquote>Pkw</blockquote><blockquote><ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>`

## M28s-CB-Right-2

- plan row: | M28s | the same 17 shapes | the same start carets | 1 to 5 presses of Shift+ArrowLeft, and separately 1 to 5 of Shift+ArrowRight; record `caretKey()` after the presses, no letter (170 rows, id `M28s-<shape>-<Left or Right>-<n>`) | 5.8 (the Shift form, FS9), spec 14 |
- value before the action (base / carry): `<ul><li>Pw</li><li><pre><code>C0w</code></pre><br /></li><li>Nw</li></ul>` / `<ul><li>Pw</li><li><pre><code>C0w</code></pre><br /></li><li>Nw</li></ul>`
- caret before (base / carry): text:C0w@2 / text:C0w@2
- write (base / carry): `null` / `null`
- caret after (base / carry): text:C0w@2|element:listitem@1 / text:C0w@2|element:listitem@1
- typed (base): `<ul><li>Pw</li><li><pre><code>C0k</code></pre><br /></li><li>Nw</li></ul>`
- typed (carry): `<ul><li>Pw</li><li><pre><code>C0k
</code></pre></li><li>Nw</li></ul>`

## M28s-HB-Right-2

- plan row: | M28s | the same 17 shapes | the same start carets | 1 to 5 presses of Shift+ArrowLeft, and separately 1 to 5 of Shift+ArrowRight; record `caretKey()` after the presses, no letter (170 rows, id `M28s-<shape>-<Left or Right>-<n>`) | 5.8 (the Shift form, FS9), spec 14 |
- value before the action (base / carry): `<ul><li>Pw</li><li><h3>H0w</h3><br /></li><li>Nw</li></ul>` / `<ul><li>Pw</li><li><h3>H0w</h3><br /></li><li>Nw</li></ul>`
- caret before (base / carry): text:H0w@2 / text:H0w@2
- write (base / carry): `null` / `null`
- caret after (base / carry): text:H0w@2|element:listitem@1 / text:H0w@2|element:listitem@1
- typed (base): `<ul><li>Pw</li><li><h3>H0k</h3><br /></li><li>Nw</li></ul>`
- typed (carry): `<ul><li>Pw</li><li><h3>H0k<br /></h3></li><li>Nw</li></ul>`

## M28s-TCB-Right-2

- plan row: | M28s | the same 17 shapes | the same start carets | 1 to 5 presses of Shift+ArrowLeft, and separately 1 to 5 of Shift+ArrowRight; record `caretKey()` after the presses, no letter (170 rows, id `M28s-<shape>-<Left or Right>-<n>`) | 5.8 (the Shift form, FS9), spec 14 |
- value before the action (base / carry): `<ul><li>Pw</li><li>T0w<pre><code>C1w</code></pre><br /></li><li>Nw</li></ul>` / `<ul><li>Pw</li><li>T0w<pre><code>C1w</code></pre><br /></li><li>Nw</li></ul>`
- caret before (base / carry): text:C1w@2 / text:C1w@2
- write (base / carry): `null` / `null`
- caret after (base / carry): text:C1w@2|element:listitem@2 / text:C1w@2|element:listitem@2
- typed (base): `<ul><li>Pw</li><li>T0w<pre><code>C1k</code></pre><br /></li><li>Nw</li></ul>`
- typed (carry): `<ul><li>Pw</li><li>T0w<pre><code>C1k
</code></pre></li><li>Nw</li></ul>`

## M28s-THB-Right-2

- plan row: | M28s | the same 17 shapes | the same start carets | 1 to 5 presses of Shift+ArrowLeft, and separately 1 to 5 of Shift+ArrowRight; record `caretKey()` after the presses, no letter (170 rows, id `M28s-<shape>-<Left or Right>-<n>`) | 5.8 (the Shift form, FS9), spec 14 |
- value before the action (base / carry): `<ul><li>Pw</li><li>T0w<h3>H1w</h3><br /></li><li>Nw</li></ul>` / `<ul><li>Pw</li><li>T0w<h3>H1w</h3><br /></li><li>Nw</li></ul>`
- caret before (base / carry): text:H1w@2 / text:H1w@2
- write (base / carry): `null` / `null`
- caret after (base / carry): text:H1w@2|element:listitem@2 / text:H1w@2|element:listitem@2
- typed (base): `<ul><li>Pw</li><li>T0w<h3>H1k</h3><br /></li><li>Nw</li></ul>`
- typed (carry): `<ul><li>Pw</li><li>T0w<h3>H1k<br /></h3></li><li>Nw</li></ul>`

## M28s-BQT-Left-2

- plan row: | M28s | the same 17 shapes | the same start carets | 1 to 5 presses of Shift+ArrowLeft, and separately 1 to 5 of Shift+ArrowRight; record `caretKey()` after the presses, no letter (170 rows, id `M28s-<shape>-<Left or Right>-<n>`) | 5.8 (the Shift form, FS9), spec 14 |
- value before the action (base / carry): `<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>` / `<ul><li>Pw</li><li><br /><blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>`
- caret before (base / carry): text:Q1w@1 / text:Q1w@1
- write (base / carry): `null` / `null`
- caret after (base / carry): text:Q1w@1|element:listitem@0 / text:Q1w@1|element:listitem@0
- typed (base): `<ul><li>Pw</li><li>k1wT2w</li><li>Nw</li></ul>`
- typed (carry): `<ul><li>Pw</li><li>k1w<br />T2w</li><li>Nw</li></ul>`

## M28s-QBR-Left-3

- plan row: | M28s | the same 17 shapes | the same start carets | 1 to 5 presses of Shift+ArrowLeft, and separately 1 to 5 of Shift+ArrowRight; record `caretKey()` after the presses, no letter (170 rows, id `M28s-<shape>-<Left or Right>-<n>`) | 5.8 (the Shift form, FS9), spec 14 |
- value before the action (base / carry): `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr /></li><li>Nw</li></ul>` / `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr /></li><li>Nw</li></ul>`
- caret before (base / carry): text:Nw@0 / text:Nw@0
- write (base / carry): `null` / `null`
- caret after (base / carry): text:Nw@0|element:listitem@1 / text:Nw@0|element:listitem@1
- typed (base): `<ul><li>Pw</li><li><blockquote><p>Q0wkNw</p></blockquote></li></ul>`
- typed (carry): `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>kNw</li></ul>`

## M30

- plan row: | M30 | `<ul><li>xq<hr>yq</li></ul>` | `node(hr)` | `ime("a")` | D15 composed text |
- value before the action (base / carry): `<ul><li>xq<hr />yq</li></ul>` / `<ul><li>xq<hr />yq</li></ul>`
- caret before (base / carry): node:horizontalrule / node:horizontalrule
- write (base / carry): `<ul><li>axq<hr />yq</li></ul>` / `<ul><li>axq<hr />yq</li></ul>`
- caret after (base / carry): node:horizontalrule / node:horizontalrule
- typed (base): `<ul><li>kaxq<hr />yq</li></ul>`
- typed (carry): `<ul><li>axq<hr />kyq</li></ul>`

## M61

- plan row: | M61 | `<ul><li><pre><code>C0w</code></pre><br></li><li>Nw</li></ul>` | `rangeToLineStart("C0w", 0)` | `copy` (record the clipboard) | D6: a selection that ends at a line's start (the head copies the code block and no break) |
- value before the action (base / carry): `<ul><li><pre><code>C0w</code></pre><br /></li><li>Nw</li></ul>` / `<ul><li><pre><code>C0w</code></pre><br /></li><li>Nw</li></ul>`
- caret before (base / carry): text:C0w@0|element:listitem@1 / text:C0w@0|element:listitem@1
- write (base / carry): `null` / `null`
- caret after (base / carry): text:C0w@0|element:listitem@1 / text:C0w@0|element:listitem@1
- typed (base): `<ul><li><pre><code>k</code></pre><br /></li><li>Nw</li></ul>`
- typed (carry): `<ul><li><pre><code>k
</code></pre></li><li>Nw</li></ul>`
