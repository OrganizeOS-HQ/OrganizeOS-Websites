# Task 26: T87.3 and T87.4 measurements

Measured only. Nothing was fixed or committed.

- R1: fork `60f4620`, native code `a3bc7d8`. `git diff a3bc7d8 60f4620 -- apps packages` touches `__records__` only. Worktree
  `/home/user/OrganizeOS-Websites/.claude/worktrees/agent-a96becf3c2691f003`, left detached at `60f4620` and clean.
- Base: `SP/r1-base` (`2a96a45`), left clean (no zz files left).
- Every run was under `timeout -s KILL 600`. None hung or was killed, every run passed, and no record logged an error or a hang.
- Load averages (1/5/15) were between 1.9 and 5.1 during the runs (the other agent's runs). Each run's `log.txt` holds its own load.
- Driver: T79.6's engine with `pathPoint` (`SP/ps/zzps-engine.tsx`), run by `SP/t87/erun.sh` from `SP/t87/gen.py`. Data is in
  `SP/t87/out/{base,r1}/m/records.json`. `SP/t87/summ-m.txt` is the table and `SP/t87/show-m.txt` the full traces.
- Handler trace: `SP/t87/zzt87-trace-x.test.tsx`. For that run only, a one-line log went into `rich-text-line-commands.ts`'s
  registration loop, naming the handler that returned true for each command and priority row, and was then reverted.
  Output: `SP/t87/trace-r1.json` and `SP/t87/extend-{base,r1}.json`.
- Every cell's caret was set by code (`caretCode`, or `pathPoint` for the element form).
- Each cell ran twice:
  - H: action, undo, redo, then the letter `k`.
  - K: action, then `k` straight away.

  The action's write and caret are the same in H and K in every cell at both builds.

- onChange: 1 for the action, 1 for undo, 1 for redo and 1 for the letter, in every cell at both builds. Undo and redo compare equal
  (state, caret, HTML, focus) everywhere, with one exception at the base noted under a6.

`UL(x)` = `<ul><li>Pw</li><li>x</li><li>Nw</li></ul>`. Carets are paths under `root/list[0]/`.

## T87.3 (a): `k3::ul-d1|TBQ|T0w@end|DEL`

| cell                                                                          | build | write                                           | caret after                      | undo (caret)                     | redo (caret)     | letter after redo                                |
| ----------------------------------------------------------------------------- | ----- | ----------------------------------------------- | -------------------------------- | -------------------------------- | ---------------- | ------------------------------------------------ |
| TBQ, Delete at T0w@3                                                          | base  | `UL(T0w<blockquote></blockquote>Q2w)`           | `listitem[1]/text[2]@0 "Q2w"`    | stored (T0w@3)                   | write (Q2w@0)    | `T0w<blockquote></blockquote>kQ2w`               |
|                                                                               | R1    | `UL(T0wQ2w)`                                    | `listitem[1]/text[0]@3 "T0wQ2w"` | stored (`cms-line[0]/text[0]@3`) | write (T0wQ2w@3) | `UL(T0wkQ2w)`                                    |
| TBQ mirror, Backspace at Q2w@0                                                | base  | `UL(T0w<blockquote></blockquote>Q2w)`           | `text[2]@0`                      | stored                           | write            | `T0w<blockquote></blockquote>kQ2w`               |
|                                                                               | R1    | `UL(T0w<blockquote><p>Q2w</p></blockquote>)`    | `quote[1]/p[0]/text[0]@0`        | stored                           | write            | `T0w<blockquote><p>kQ2w</p></blockquote>`        |
| **twin** `<p>T0w<br></p><blockquote><p>Q2w</p></blockquote>`, Delete at T0w@3 | base  | `<p>T0w</p><blockquote><p>Q2w</p></blockquote>` | `root/p[0]/text[0]@3`            | stored (T0w@3)                   | write (T0w@3)    | `<p>T0wk</p><blockquote><p>Q2w</p></blockquote>` |
|                                                                               | R1    | same as base                                    | same                             | same                             | same             | same                                             |
| twin mirror, Backspace at Q2w@0 (extra)                                       | base  | `<p>T0wQ2w</p><blockquote></blockquote>`        | `p[0]/text[0]@3`                 | stored                           | write            | `<p>T0wkQ2w</p><blockquote></blockquote>`        |
|                                                                               | R1    | `<p>T0wQ2w</p>`                                 | `p[0]/text[0]@3`                 | stored                           | write            | `<p>T0wkQ2w</p>`                                 |
| TBC `UL(T0w<br><pre><code>C2w</code></pre>)`, Delete at T0w@3                 | base  | `UL(T0wC2w)`                                    | `text[0]@3 "T0wC2w"`             | stored                           | write            | `UL(T0wkC2w)`                                    |
|                                                                               | R1    | `UL(T0wC2w)`                                    | `text[0]@3 "T0wC2w"`             | stored (`cms-line[0]/text[0]@3`) | write            | `UL(T0wkC2w)`                                    |
| TBH `UL(T0w<br><h3>H2w</h3>)`, Delete at T0w@3                                | base  | `UL(T0wH2w)`                                    | `text[0]@3 "T0wH2w"`             | stored                           | write            | `UL(T0wkH2w)`                                    |
|                                                                               | R1    | `UL(T0wH2w)`                                    | `text[0]@3 "T0wH2w"`             | stored (`cms-line[0]/text[0]@3`) | write            | `UL(T0wkH2w)`                                    |
| twin C `<p>T0w<br></p><pre><code>C2w</code></pre>`, Delete (extra)            | both  | `<p>T0w</p><pre><code>C2w</code></pre>`         | `p[0]/text[0]@3`                 | stored                           | write            | `<p>T0wk</p>...`                                 |
| twin H `<p>T0w<br></p><h3>H2w</h3>`, Delete (extra)                           | both  | `<p>T0w</p><h3>H2w</h3>`                        | `p[0]/text[0]@3`                 | stored                           | write            | `<p>T0wk</p>...`                                 |

**a6. Second Delete** (TBQ, Delete twice from T0w@3, then undo twice and redo twice):

- **R1:**
  - First Delete: `UL(T0wQ2w)`, caret @3.
  - Second Delete: `UL(T0w2w)`, caret @3. It removes the next character.
  - Undo: `T0wQ2w`, then the stored value. Redo: `T0wQ2w`, then `T0w2w`. All four compare equal.
  - Letter: `UL(T0wk2w)`.
- **Base:**
  - First Delete: `T0w<blockquote></blockquote>Q2w`.
  - Second Delete: `T0w<blockquote></blockquote>2w`, caret `text[2]@0`.
  - The first undo's raw-state comparison with the state after one Delete fails, while its HTML, caret and focus are equal. This is base
    only; every other comparison is equal.
  - Letter: `T0w<blockquote></blockquote>k2w`.

**The R1 handler that takes the key** (5.8's order: an empty line's rule, the rule or line break at a block's edge, the item-start
join, Lexical's own delete): **none of the field's handlers. Lexical's own delete takes it.**

- The trace shows every row in the Delete chain returning false. That is KEY_DELETE CRITICAL, then DELETE_CHARACTER CRITICAL
  (`rich-text-line-commands.ts:254`, with `deletes.edgeForms` and `removal.mark`), NORMAL (`:265`: `field.deleteAfterLineBreak`,
  `deletes.emptyLine`, `deletes.joinBeforeEndingImage`) and LOW (`:274`: `deletes.blockEdge`, `deletes.lineEndIntoBlock`,
  `deletes.breakLedLineStart`, `deletes.itemStartJoin`).
- A probe listener registered at LOW after them is reached with the selection still `cms-line[0]/text[0]@3`. Lexical's rich-text
  `DELETE_CHARACTER_COMMAND` handler (`@lexical/rich-text` 0.21.0, `LexicalRichText.dev.js:447`, `selection.deleteCharacter(false)`)
  then does the edit. It is the last entry of 5.8's order.
- Why each field rule declines:
  - `deletes.emptyLine` declines because the line is not empty.
  - `$blockEdge` (`rich-text-line-deletes.ts:222`) needs the caret at a block's edge, with the line beside it starting or ending in
    the break. Here the caret is in the line itself (`$childAtEdge` gives the line, so it returns false).
  - `$lineEndIntoBlock` (`:259`) needs an element point at the line's end, after the break. Here the caret is a text point before the
    break.
  - `field.deleteAfterLineBreak` handles Backspace only.
  - The same holds for the element form `cms-line[0]@element:1`: offset 1 is not the line's size, 2.
- What Lexical's delete does: `deleteCharacter` extends the selection one character forward through the page (`modify`). Measured with
  `modify("extend", false, "character")` inside an update:

  | build                        | from T0w@3              | to                        | DOM                                                                                        |
  | ---------------------------- | ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
  | R1 TBQ                       | `cms-line[0]@element:1` | `quote[1]/p[0]/text[0]@0` | `div@1<li -> p@0<blockquote`; the line renders `T0w<br><br>` (Lexical's terminating break) |
  | R1 TBC                       | `cms-line[0]@element:1` | `code[1]/text[0]@0`       |                                                                                            |
  | base TBQ                     | `listitem[1]@element:1` | `quote[2]/p[0]/text[0]@0` |                                                                                            |
  | base TBC                     |                         | `code[2]/text[0]@0`       |                                                                                            |
  | twin `<p>T0w<br></p>` (both) |                         | `paragraph[0]@element:2`  | stops after the break, inside the paragraph                                                |

  So in the item, at both builds, the browser's step passes the line break and lands at the start of the block's text. Removing that
  range joins the block's text onto T0w. At the base, Lexical's removal leaves the shell `<blockquote></blockquote>` behind the text;
  at R1 the text joins into the line and 5.4's emptied rule removes the empty quote. In the twin the step stops at the paragraph's end,
  so only the break goes.

**Outcome (a): the twin removes only the break.** This is a defect of R1, and the fix writes `<li>T0w<blockquote><p>Q2w</p></blockquote></li>`.
It is the mirror's value and D3's fourth case for Delete, and the fix would land in `$blockEdge`'s Delete form or a rule beside it,
before Lexical's delete. For the owner:

- TBC and TBH are the same pattern. R1 writes the head's value (`T0wC2w`, `T0wH2w`), and their ordinary twins also remove only the
  break.
- So R1 equals the head there, while the twin rule says the break alone goes. T87.3 orders only TBQ's fix; TBC and TBH are for the
  ruling.

## T87.3 (b): `k2::ul-d1|QTB|Nw@start|BS` and `k3::ul-d1|RTB|Nw@start|BS`

| cell                                                                          | build | write                                                                            | caret after                                 | undo (caret)                     | redo  | letter after redo              |
| ----------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------- | ----- | ------------------------------ |
| QTB `UL(<blockquote><p>Q0w</p></blockquote>T1w<br>)`, Backspace at Nw@0       | base  | `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1w</li><li>Nw</li></ul>` | `listitem[2]/text[0]@0`                     | stored (Nw@0)                    | write | `...T1w</li><li>kNw</li></ul>` |
|                                                                               | R1    | `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote>T1wNw</li></ul>`          | `listitem[1]/cms-line[1]/text[0]@3 "T1wNw"` | stored (Nw@0)                    | write | `...T1wkNw</li></ul>`          |
| RTB `UL(<hr>T1w<br>)`, Backspace at Nw@0                                      | base  | `<ul><li>Pw</li><li><hr />T1w</li><li>Nw</li></ul>`                              | `listitem[2]/text[0]@0`                     | stored                           | write | `...<li>kNw</li>`              |
|                                                                               | R1    | `<ul><li>Pw</li><li><hr />T1wNw</li></ul>`                                       | `listitem[1]/cms-line[1]/text[0]@3`         | stored                           | write | `<li><hr />T1wkNw</li>`        |
| **twin** `<ul><li>Pw</li><li>T1w<br></li><li>Nw</li></ul>`, Backspace at Nw@0 | base  | `<ul><li>Pw</li><li>T1wNw</li></ul>`                                             | `listitem[1]/text[0]@3 "T1wNw"`             | stored (`listitem[2]/text[0]@0`) | write | `<li>T1wkNw</li>`              |
|                                                                               | R1    | same as base                                                                     | same                                        | same                             | same  | same                           |

R1's handler for QTB is Lexical's own delete as well: no field row returned true.

**Outcome (b): the twin writes `T1wNw` in one item, at both builds. R1 stands under D2.**

## T87.3 (c): the ten

Every one of the ten is `UL(<shape>)` with Backspace at Nw@0. At both builds the undo restores the stored value with the caret at
`listitem[2]/text[0]@0`, the redo gives the write, and the letter lands at the write's caret.

| shape                                      | base write (caret `listitem[2]/text[0]@0`)                                                   | R1 write                                               | R1 caret                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------- |
| CB `<pre><code>C0w</code></pre><br>`       | `<li><pre><code>C0w</code></pre></li><li>Nw</li>`                                            | `<li><pre><code>C0w</code></pre>Nw</li>`               | `cms-line[1]/text[0]@0` |
| HB `<h3>H0w</h3><br>`                      | `<li><h3>H0w</h3></li><li>Nw</li>`                                                           | `<li><h3>H0w</h3>Nw</li>`                              | `cms-line[1]/text[0]@0` |
| QB `<blockquote>Q0w</blockquote><br>`      | `<li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li>`                                    | `<li><blockquote><p>Q0w</p></blockquote>Nw</li>`       | `cms-line[1]/text[0]@0` |
| RB `<hr><br>`                              | `<li><hr /></li><li>Nw</li>`                                                                 | `<li><hr />Nw</li>`                                    | `cms-line[1]/text[0]@0` |
| QBB `<blockquote>Q0w</blockquote><br><br>` | `<li><blockquote><p>Q0w</p></blockquote><br /></li><li>Nw</li>`                              | `<li><blockquote><p>Q0w</p></blockquote><br />Nw</li>` | `cms-line[1]/text[1]@0` |
| QQB                                        | `<li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote></li><li>Nw</li>` | `<li>...<blockquote><p>Q1w</p></blockquote>Nw</li>`    | `cms-line[2]/text[0]@0` |
| QRB                                        | `<li><blockquote><p>Q0w</p></blockquote><hr /></li><li>Nw</li>`                              | `<li><blockquote><p>Q0w</p></blockquote><hr />Nw</li>` | `cms-line[2]/text[0]@0` |
| RBB `<hr><br><br>`                         | `<li><hr /><br /></li><li>Nw</li>`                                                           | `<li><hr /><br />Nw</li>`                              | `cms-line[1]/text[1]@0` |
| RQB                                        | `<li><hr /><blockquote><p>Q1w</p></blockquote></li><li>Nw</li>`                              | `<li><hr /><blockquote><p>Q1w</p></blockquote>Nw</li>` | `cms-line[2]/text[0]@0` |
| RRB `<hr><hr><br>`                         | `<li><hr /><hr /></li><li>Nw</li>`                                                           | `<li><hr /><hr />Nw</li>`                              | `cms-line[2]/text[0]@0` |

The letter after the redo gives `kNw` at both builds. At the base `kNw` stays in its own item; at R1 it is in the line.

The ordinary twins, Backspace at Nw@0:

| twin                                                      | build | write                                          | caret after             | undo (caret)                     | redo  | letter         |
| --------------------------------------------------------- | ----- | ---------------------------------------------- | ----------------------- | -------------------------------- | ----- | -------------- |
| `<ul><li>Pw</li><li><br></li><li>Nw</li></ul>`            | base  | `<ul><li>Pw</li><li>Nw</li></ul>`              | `listitem[1]/text[0]@0` | stored (`listitem[2]/text[0]@0`) | write | `<li>kNw</li>` |
|                                                           | R1    | same                                           | same                    | same                             | same  | same           |
| `<blockquote><p>Q0w</p></blockquote><p><br></p><p>Nw</p>` | base  | `<blockquote><p>Q0w</p></blockquote><p>Nw</p>` | `root/p[1]/text[0]@0`   | stored (`p[2]/text[0]@0`)        | write | `<p>kNw</p>`   |
|                                                           | R1    | same                                           | same                    | same                             | same  | same           |

R1's handler for QB is Lexical's own delete too (trace).

**Outcome (c): in both twins Nw goes into the empty item or paragraph (the empty one goes and Nw takes its place, with the caret at
Nw@0 in that place). The ten stand under D2 and D19, and 5.8's row gains the case.**

## T87.4: `k3::ul-d1|TBQ|walk Left`

Three forms at R1:

- el: set by code, `pathPoint listitem[1]/cms-line[0]@element:1`.
- text: set by code, `cms-line[0]/text[0]@3`.
- walk: real ArrowLeft from Q2w@0, which lands at `cms-line[0]@element:1`.

The base was measured for text and walk. Its ArrowLeft lands at `listitem[1]/text[0]@3`.

| key       | R1 el                                                                                                                                      | R1 text | R1 walk | base (text and walk)                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------- | -------------------------------------------------- |
| Backspace | `UL(T0<br><blockquote><p>Q2w</p></blockquote>)`, caret `cms-line[0]/text[0]@2`                                                             | same    | same    | `UL(T0<br />...)`, `text[0]@2`                     |
| Delete    | `UL(T0wQ2w)`, caret `listitem[1]/text[0]@3`                                                                                                | same    | same    | `UL(T0w<blockquote></blockquote>Q2w)`, `text[2]@0` |
| Enter     | `<ul><li>Pw</li><li>T0w</li><li><br /><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>`, caret `listitem[2]/cms-line[0]@element:0` | same    | same    | same write, `listitem[2]@element:0`                |

- The letter after each key gives the same value from all three forms: `T0k`, `T0wkQ2w` and `<li>k<br />...` in the new item.
- onChange is 1 for each key, undo, redo and letter.
- Undo restores the stored value with the caret in the form it was set in, and redo gives the write.

**Outcome: all three forms give the same results. This is D1's same caret.** There is no P record.

Delete from all three forms is the (a) defect.

**Why the plain step leaves the element form:**

- From Q2w@0, ArrowLeft is taken by `points.arrowPastLineBreak`. It is the KEY_ARROW_LEFT_COMMAND row at NORMAL priority
  (`rich-text-line-commands.ts:338`), and the trace shows it returning true.
- The function is `rich-text-line-points.ts:1450`. It applies 5.8's rule (the check's V10): an arrow from a block's edge toward a line
  that ends with a line break stops past the break.
- Going left it writes the point as `focus.set(line.getKey(), line.getChildrenSize() - 1, "element")` and the anchor the same
  (`:1529-1537`). By construction that is an element point on the line, just before the break: index 1, after T0w.
- No rule turns it back into a text point. The SELECTION_CHANGE row returns false, and D18's resolver leaves a point that is already
  in a line.
- At the base no handler intervenes. The browser's own step lands in the text, at `T0w@3`.
