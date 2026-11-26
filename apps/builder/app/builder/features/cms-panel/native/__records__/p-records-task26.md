# Task 26: P records (acceptance at `0ae275f` against `<base>` `2a96a45`)

Acceptance counts: record sets 19,477 records each side, 14,531 equal, 4,027 different, 4,017 explained, 10 not
explained (P26-2 to P26-11); about 760 of the explained are attributed by class only (D2, D3, D4, D5, D9, D10, D13, D14,
D18, D19, C15, 5.4), not checked record by record. Walk sweep: 828 cells (the 814-cell list is not kept; rebuilt from
grid D and group B's walks), all steady and equal to their wait write in 20 of 20 runs. Nothing hung or crashed at R1.
Base: 49 record-set hangs, 24 probe files killed by the watchdog.

## P26-1: 16.27 (T13.3), the join at an element point of a quote is not its own undo step

- probe: check 5's `insert` lens, group "B QA" (`zzq1-a-BQA`), stored `<li><blockquote><p>Q0w</p></blockquote><a>Lw</a></li>`
- placed: the caret set by code at the item's element point before the link (`el1`)
- action: Backspace; Ctrl+Backspace; each also after an earlier edit (`z` typed in `Nw`)
- R1: the key writes `<blockquote><p>Q0w<a>Lw</a></p></blockquote>`, one onChange. With no earlier edit, three undos do
  nothing (0 onChange, the value stays joined). After the earlier edit, the first undo removes both the join and the `z`.
- expected (T13.3): the join is its own undo step.
- base: the key writes nothing new; undo has nothing to undo.
- deterministic (rerun alone: same). The branch's T13.3 tests (`rich-text-line-deletes.test.tsx`, a real click at
  `A1w@0`) pass.

## P26-2 to P26-4: toolbar Bold over a range, then undo, redo and a letter

Write equal at both builds; the value after undo, redo and a letter differs.

- P26-2 `B::ul-d1|QTQ|Q0w->T1w|B`, stored `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>`
  - base: `<li><blockquote><p>Q<b>k</b>w</p><blockquote><p>Q2w</p></blockquote></blockquote></li>`
  - R1: `<li><blockquote><p>Q<b>k</b>w</p></blockquote><blockquote><p>Q2w</p></blockquote></li>`
- P26-3 `R::ul-d1|r-QxLy|Pw->X0w|B`, stored `<p>Pw</p><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>`
  - base: `<p>P<b>k</b>w</p><ul><li>X1w</li></ul><p>X2w</p><p>Nw</p>`
  - R1: `<p>P<b>k</b>w</p><blockquote><ul><li>X1w</li></ul>X2w</blockquote><p>Nw</p>`
- P26-4 `X::ul-d1|QxLy|Pw->X0w|B`, stored `<ul><li>Pw</li><li><blockquote>X0w<ul><li>X1w</li></ul>X2w</blockquote></li><li>Nw</li></ul>`
  - base: `<ul><li>P<b>k</b>w<ul><li>X1w</li></ul></li><li>X2w</li><li>Nw</li></ul>`
  - R1: `<ul><li>P<b>k</b>w</li><li><blockquote><ul><li>X1w</li></ul>X2w</blockquote></li><li>Nw</li></ul>`

## P26-5: gap-fill `g5|undo5|QT`

- stored `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>`
- base write: unchanged; after undo, redo and a letter: `<li><blockquote><p>Q0wk</p></blockquote>T1w</li>`
- R1 write: `<li><blockquote><p>Q0wT1w</p></blockquote></li>`; after undo, redo and a letter: `<li><blockquote><p>Q0wkT1w</p></blockquote></li>`

## P26-6: gap-fill `g6|I1root-q|click|P`

- stored `<p>Pw</p><blockquote><p>X0w<img …></p></blockquote><p>Nw</p>`; values equal at both builds
- steps: base refocus `hadFocus: false`, undo and redo 1 onChange each; R1 refocus `hadFocus: true`, undo and redo 0
  onChange each

## P26-7 to P26-11: paste-sweeps E, Delete at the end of a pasted lined item's text

R1 joins the next item's text; the base does not.

- P26-7 `Z13 repro (no join)`: base `<li><hr />T1q</li></ol><ul><li>q<ul><li>n1q</li></ul></li>`; R1 `<li><hr />T1qq</li></ol><ul><li><ul><li>n1q</li></ul></li>`
- P26-8 `Z9 repro (no join)`: the same shape after `<ul><li>s1</li></ul>`, the same difference
- P26-9 `mid s@2 Q-led ol (no join)`: base `<li><blockquote><p>Q1q</p></blockquote>T1q</li></ol><ul><li>q<ul>…`; R1 `…T1qq</li></ol><ul><li><ul>…`
- P26-10 `mid s@2 ul nested last H link (no join)`: base `<li>Aq<ul><li><hr /><a>T1q</a></li></ul></li><li>q<ul><li>n1q</li></ul></li>`; R1 `<li>Aq<ul><li><hr /><a>T1q</a>q</li><li>n1q</li></ul></li>`
- P26-11 `quote stored s@2 ol HT (no join)`: P26-7's shape inside a quote, the same difference

## Also reported

- One load-dependent failure in `core-browser-builder-cms` (a test on main, `field-controls.test.tsx`, "Image inserts an
  uploaded image, and Save sends its src, width and height", `expected undefined to be 'Lake'`); its file passed 37 of
  37 in each of three runs alone.
- Check 5's probes: 7,901 records "final values differ" and 154 "steps between differ" are not tied to rulings by this
  run (in lined content, the probes written to compare the prototype with the head). 666 differ in onChange count only
  (D7, 16.10); 449 in the composition-start character only (16.19, 16.21). Every comp and hist file passes its lens's
  invariant at both builds.
- Coverage the kept generators do not give: keys-phase-1 rebuilt (3,688 scenarios, d1 `ul` only); keys-phase-2 `n0`;
  gap-fill 545 of about 1,500 (`tR`, `tR2`, `tB`, `cl` not kept); toolbar 6,688 of 7,029 (batch D, 1,458, run as extra).
  Probe files that do not load: `clip-copy`, `clip-p5` at both builds, `keys-i6`, `keys-i6p` at the base.
- Not run: a real second pointer (two CDP touch points, equal at both builds, placement not shown); the deletes' line
  forms on a real key binding (no chord fires `beforeinput` in Chromium on Linux); Safari, Firefox (not installed); a
  native input method (none on this machine).
