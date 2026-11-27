# Task 26: T79.2 to T79.6, the six records and clip-d rec-2/3 (measured at d20016d and the base)

R1 is fork `d20016d`, with the native field's code from `a3bc7d8`. The base is `SP/r1-base` (`2a96a45`). The rulings are
T79 (`SP/rulings-t79.md`, re-fetched).

The probes are the gap-fill engine with these steps added:

- `selNode`: a node selection set by code.
- `clickNode`: a real click on an element, with `elementFromPoint`.
- `caretCode`: a caret set by code.
- `sel`: Lexical's selection and the page's selection, in full.
- `pasteNs`: a paste of given clipboard types, with the lexical namespace set to the live editor's.
- `watchCTI`/`ctiLog`: CONTROLLED_TEXT_INSERTION listeners at CRITICAL and LOW, plus an update listener.
- `dragTrace`: the events and commits during the drag.

Every step also records each value handed to onChange.

Where things are:

- The engine patch is `SP/six/mk.py`, and the built engine is `SP/six/zzsix-engine.tsx`.
- The batches come from `SP/six/gen.py` (run 1), `SP/six/gentrace.py` (the drag trace) and `SP/six/gen2.py` (run 2, T79).
- The data is in `SP/six/run1-*.json`, `SP/six/trace-*.json` and `SP/six/run2-*.json`.
- The readers are `SP/six/{summ,r12,r4,t4,t5}.py`.

Every run was under `timeout -s KILL 600`:

- Run 1: 76 scenarios per build.
- Run 2: 165 scenarios at R1 and 65 at the base.

None hung, none threw, and there were no console errors. The scratch directories are removed, and both worktrees are clean.
The base's untracked `zz13base.log` was there before.

The shapes:

- QTR: `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w<hr></li><li>Nw</li></ul>`
- TQT: `<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>T2w</li><li>Nw</li></ul>`

## The mechanism the first three records share (map 1 group 11, K9)

In QTR the engine's mount click lands on the rule and node-selects it, at both builds. In 3 of 3 runs at the base, the
next real click on T1w leaves Lexical's selection `null` and the page with no range. This is K9's mechanism:

1. `@lexical/rich-text`'s CLICK_COMMAND handler (`LexicalRichText.dev.js:440-446`) clears the node selection.
2. updateEditor turns the empty node selection into `null`.

At R1 the click gives a caret where the person clicked, every run. That is `clickAfterNodeSelection`
(`rich-text-line-points.ts:1553-1583`). It is registered at LOW (`rich-text-line-commands.ts:149-152`), so it runs before
rich-text's EDITOR handler, and it sets a range from the page's selection.

## 1-2. `g4|compose|QTR|afterRule|'a'` and `'a\nb'` (T79.2)

**The measurement T79.2 asks for:** the base with QTR's rule node-selected by code (`selNode`), and also by a real press
(`clickNode`). The press node-selects at both builds, 6 of 6 (`elementFromPoint` = `hr`, 1 px). Each case ran 3 times per
build. The base and R1 at this selection are equal:

|          | composed values (calls)   | undo              | redo              |
| -------- | ------------------------- | ----------------- | ----------------- |
| `'a'`    | `<ul><li>aPw</li>...` (1) | `Pw...` (1 call)  | `aPw...` (1 call) |
| `'a\nb'` | `aPw...`, `bPw...` (2)    | `aPw...` (1 call) | `bPw...` (1 call) |

At this selection the text lands at the content's start, where the page's own caret stands (D15).

**R1's record does not compose at a node selection.**

- In the record, R1's first ArrowRight node-selects the rule. The record's extra ArrowRight then moves to the empty line
  after it (`cms-line[3]@element:0`, D13), and the composition runs there.
- R1's record: `T1w<hr>a`, with 1 call for `'a'` and 3 for `'a\nb'` (`a`, `b`, `a`). Undo and redo take 1 call each, and the
  letter gives `ak`.
- The base with the walk's start caret set by code at T1w's end (no K9 click; 3 runs each):
  - the first press node-selects the rule, and the extra press goes to `listitem@element:3`;
  - the composition writes `T1w<hr>a`, and undo, redo and the letter equal R1's;
  - the counts differ only by the start character and the repeat. For `'a'` the base gives 3 calls (a value holding U+200B,
    `a`, `a`); for `'a\nb'` it gives 5. R1 withholds the start character and the repeat (T67.2, T67.4, D7).
- In the record itself, the base's walk starts from K9's `null`. It goes Pw@1, Pw@2, Q0w@0, then Q0w@1, and composes in
  Q0w.

**Outcome.**

- Read by T79.2's letter, "the base at the node selection, compared with R1's record", the two **differ**: `aPw` against
  `T1w<hr>a`. That would be a P record under D15.
- The two values are taken at different selections, though:
  - at the node selection, the base equals R1 (above);
  - at the record's own composition point (the caret after the rule), the base equals R1 on the write, undo, redo and the
    letter.
- So I read the records as **standing**, with the label adjusted: "map 1 group 11 at the base's click; the arrow's stop on the
  rule and the extra press to the line after it (5.3, D13, D15); the counts are T67.2's".
- The coordinating session should confirm this reading against the letter of T79.2. The P record below is filed in case it
  does not.

**P record P-six-1 (D15), from the node-selection measurement.**

- What differs: the caret after a composition. The values handed out are equal.
- With the rule node-selected, after `'a'`:
  - the base's Lexical selection moves to `aPw@1`, and a letter writes `akPw`;
  - R1's stays on the rule, and a letter lands after the rule: `T1w<hr>k` (D15's typed-text rule).
- After `'a\nb'`:
  - both keep the node selection;
  - the base's caret after undo or redo varies from run to run (the node, or `aPw@0`/`bPw@0`), and its letter writes `kbPw`;
  - R1's stays on the node, and its letter lands after the rule.
- Candidates:
  - (a) R1's caret stands. The letter is D15's typed text, and the difference is listed under D15. T70.8 and T73.3 compared
    only values, calls, undo and redo.
  - (b) A defect under D15: "the head's result" for composed text includes the caret it leaves.
- Cause: not traced. The likely place is `rich-text-line-points.ts:1540-1548` (`rememberPageSelection`: a page range under a
  node selection is not taken as a step).
- The `'a\nb'` form's lost `b`, at both builds, is T70.12's.

## 3. `g4|replace|QTR|T1w` (T79.3)

All rows ran 3 of 3 per build.

|                                                                                        | base                                                                                                                                                                                                           | R1                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the record's steps: mount, click T1w@1, replace T1w[0,3] with `Zz`, undo, redo, letter | after mount: the rule node-selected. After the click: Lexical `null`, the page no range. The replace changes nothing (0 calls). Undo and redo change nothing (the caret becomes Pw@0). The letter writes `kPw` | after mount: the rule node-selected. After the click: T1w@1 (Lexical and the page). `..Zz<hr>` (1 call). Undo `T1w` (1 call), redo `Zz` (1 call). The letter writes `Zzk` |
| Lexical's selection directly before the replace                                        | `null`                                                                                                                                                                                                         | `cms-line[1]/text[0]@text:1"T1w"`                                                                                                                                         |
| QTR, the caret set by code at T1w@1                                                    | `..Zz<hr>` (1 call). Undo, redo and the letter equal R1's                                                                                                                                                      | the same as the row above                                                                                                                                                 |
| ordinary twin `<ul><li>Pw</li><li>T1w</li><li>Nw</li></ul>`, click                     | `<li>Zz</li>` (1 call), undo, redo, `Zzk`                                                                                                                                                                      | the same                                                                                                                                                                  |
| ordinary twin, caret set by code                                                       | the same                                                                                                                                                                                                       | the same                                                                                                                                                                  |

**R1's steps that make the write.**

- `clickAfterNodeSelection` (`rich-text-line-points.ts:1556-1583`) gives the caret.
- Lexical's own path then makes the write:
  - `onBeforeInput` applies the target range to that caret (`Lexical.dev.js:2826-2828`);
  - it dispatches CONTROLLED_TEXT_INSERTION_COMMAND (`:2863-2865`);
  - the field's CRITICAL handlers pass the command on (the LOW probe listener saw it, with the selection at T1w@1);
  - rich-text's handler inserts the data transfer (`LexicalRichText.dev.js:468-485`).
- The commit dirties 4 elements and 1 leaf, with no tag.

**The base's no-op.** `onBeforeInput` returns at `Lexical.dev.js:2810-2812` when there is no range selection. The event
carried its target range (`ranges: 1`), so this is not the harness.

**Outcome: T79.3's first outcome.**

- The base had no selection because its click left none, and with the caret set by code it writes `Zz`.
- The record is group 11's at the base, and R1's write is the head's at that caret.
- The ordinary twin is equal at both builds.

## 4. `g4|compose|TQT|Q1w@1|'a\nb'` (T79.4)

The runs: 60 at R1 and 10 at the base for each record. The values below omit the outer list (`<ul><li>Pw</li><li>`).

**`TQT|Q1w@1|'a\nb'`**, the caret record. The selection before the composition is Q1w@1 at both builds.

- R1, 60 of 60: **2 calls**, `T0w<blockquote><p>Qa1w</p></blockquote>T2w`, then `...<p>b1w</p>...`. Undo restores `Q1w`
  (1 call), redo gives `b1w` (1 call), and the letter writes `kT2w`.
- Base, 10 of 10: **4 calls**:
  1. the stored value, unchanged;
  2. `Qa1w`;
  3. `b1w`;
  4. `b1w` again.

  Undo and redo give 0 calls (F12).

**`TQT|Q1w@1..T2w@1|'a\nb'`**, the range record. The selection runs from Q1w@1 to T2w@1.

- R1, 60 of 60: **3 calls**, `<p>Qa2w</p>`, then `<p>b2w</p>`, then `<p>a</p>` (`T0w<blockquote>...</blockquote>`). Undo
  restores the stored value, redo gives `<p>a</p>`, and the letter writes `ka`.
- Base, 10 of 10: **5 calls**:
  1. `<p>Q`U+200B`2w</p>`;
  2. `Qa2w`;
  3. `b2w`;
  4. `a`;
  5. `a`.

**Values holding U+200B:** 0 at R1, in 120 runs.

**Cause, named in code:** `ChangePlugin`, `rich-text-field.tsx:2758-2806`.

- Lines 2790-2795 withhold the commit at a composition's start when it leaves the D7 document as it was (T67.2). That is the
  base's first value in the caret record.
- Lines 2797-2800 withhold a value equal to the one handed out last (D7). That is the commit of `insertText`.
- In the range record that commit gives `a`, a new value, so it is handed out (3 calls).
- In the caret record it gives `b1w`, which equals the value handed out last, so it is not (2 calls).
- It is not a merge: R1's undo is one step in both records.

**Outcome: two calls stand (T79.4's bar is met).**

- The count is one count in 60 of 60.
- Both values are composed values.
- The value the three-call record hands out in between (the `insertText` commit) is, in this record, equal to the value
  handed out last.
- No value holds U+200B, and none is missing.

## 5-7. `g6|I1root-q|arrow|drag`, `g6|I2li|arrow|drag`, `g6|I5root-p|arrow|drag` (T79.5)

The setup: a click at X0w's end, then ArrowRight node-selects the image, then the engine's `dragImg` (Playwright
`dragAndDrop` to Nw@1). The image has `draggable` false, so nothing is written. A letter was typed at each moment, 3 runs
each, the same at all three shapes and both builds:

| moment               | base: Lexical / page                            | R1: Lexical / page     | letter, both builds |
| -------------------- | ----------------------------------------------- | ---------------------- | ------------------- |
| before the drag      | the image node-selected / a stray caret at Pw@0 | the same               | not measured        |
| right after the drag | `null` / no range                               | Pw@0 text point / Pw@0 | `kPw...` (1 call)   |
| after undo           | Pw@0 / Pw@0                                     | Pw@0 / Pw@0            | `kPw...`            |
| after undo and redo  | Pw@0 / Pw@0                                     | Pw@0 / Pw@0            | `kPw...`            |

The full values:

- I1root-q: `<p>kPw</p><blockquote><p>X0w<img></p></blockquote><p>Nw</p>`
- I2li: `<ul><li>kPw</li>...`
- I5root-p: `<p>kPw</p><p>X0w<img></p><p>Nw</p>`

The comparison field that makes the base's `caret` false:

- `cmp post` compares the state after redo with the `post` snapshot taken **after** the drag. The snapshot is built at
  `zzh2-fill-engine.tsx:1183` and compared at `:1188` (`caret: snap.caret === selInfo()`).
- The base's `post.caret` is `"null"`. After its redo, the caret is the Pw@0 text point, so the two differ. R1's is Pw@0 at
  both moments.
- `cmp m` (after undo, against the snapshot before the drag) is false at **both** builds. The node selection before the
  drag is lost at both.

Mechanism (event trace, both builds alike up to the click):

1. pointerdown and mousedown on the `img`;
2. pointerup and mouseup on the Nw span;
3. a `click` on the common ancestor (the root `div`, or the `ul`), with the node selection still standing.

Then the builds part:

- **Base**: rich-text's CLICK handler clears the selection, so it becomes `null`.
- **R1**: `clickAfterNodeSelection` sets the page's stray caret (Pw@0) as a range.

**Outcome: the carets are the same under D1. These are not differences in ordinary content, and T60.3's number is 0.**

- At every moment the letter writes the same HTML at both builds.
- Where both carets are text points (after undo, after redo), they are the same text and offset, Pw@0.
- Right after the drag the base has no caret, and its letter lands at Pw@0, as R1's does.
- The label: "the comparison's `post` snapshot field `caret`: `null` at the base after the drag, against a text point after
  its redo; same caret under D1".

Correction to the report: "the base's caret is not the caret before and R1's is" misreads `cmp post`. Neither build keeps
the caret it had before the drag.

## 8. clip-d rec-2 and rec-3 (T79.6)

The record:

- rec-2: `<p>A0w<img></p><p>B1w</p>`, a range from `paragraph[0]@element:2` (the paragraph's end, after the image) to
  B1w@1.
- rec-3: the same range made backward.

What each build does:

- **R1**: the cut leaves `<p>A0w<img>1w</p>`, with the caret at `"1w"@0` after the image. The clipboard holds:
  - text/html `<p></p><p>B</p>`;
  - text/plain `"\nB"`;
  - application/x-lexical-editor: an empty paragraph, then a paragraph with `B`.

  The paste back gives `<p>A0w<img></p><p></p><p>B1w</p>` (`pasteRestores` false).

- **Base**: the cut takes the image, as D1's list says the head does. The cut leaves `<p>A0w1w</p>`, its clipboard holds
  `<p><img></p><p>B</p>`, and the paste back restores the stored value.

**The control:**

- The setup: R1's post-cut value mounted, `<p>A0w<img ...>1w</p>`, with the caret at `"1w"@0`, set by code. That is R1's
  `caretAfterCut`, `paragraph[0]/text[2]@text:0`, the same at both builds.
- The clipboard: R1's rec-2 clipboard, raw, with all three types. The lexical namespace is set to the live editor's,
  because Lexical takes its own nodes only from its own namespace.
- Result, 3 of 3 at the base: `<p>A0w<img ...></p><p></p><p>B1w</p>`, with 1 call and the caret at `"B1w"@1`. That is
  **R1's `afterPaste` exactly**.
- The same clipboard without the lexical type gives the same at the base.
- R1 gives the same in the same control, 3 of 3.
- rec-3 has R1's identical clipboard, afterCut and afterPaste.

**Outcome:**

- The paste is the head's (D14).
- The pair goes in the "Known, not fixed" list as "a cut from directly after an image into the next paragraph, pasted back,
  leaves an empty paragraph". It is named to the owner as R3's area.
- No P record.
