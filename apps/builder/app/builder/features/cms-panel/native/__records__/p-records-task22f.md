# Task 22: the final re-run on bd3fbf6 (T46.10, T47.7). Stopped: one cell is not stable

The branch was `task22-grids` at bd3fbf6, plus 47f0613 (T49.1's controls, Task 14) and the uncommitted grid
work. The four grids and the click test were re-run without `-u`, against the snapshots updated only for the 24
ruled changes. The grid work is not committed.

## P22-9: image in TQI (and QI) by code, Numbered list: the letter after it lands at the document's start, 10 to 20% of runs

The first run of the four grids and the click test was clean: meeting 332/332, node 258/258, unreached 578/578,
points 692/692, clicks 54/54. A second full run, made after P22-10's format change, failed in the node grid's
"the grid's writes" only. Every cell passed its own assertions. Re-running that grid with `-u` showed one changed
value:

- `image in TQI by code Numbered list`:
  - stored: `<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>X2w<img …/></li><li>Nw</li></ul>`
  - placed: `nodeSelect("cms-image")`
  - action: the Numbered list button, then a letter
  - write (stable): `<ol><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>X2w<img /></li><li>Nw</li></ol>`,
    1 call, caret `node:cms-image`
  - letter in the snapshot (most runs): `…X2w<img />k</li>…`, directly after the image (D15)
  - letter in some runs: `<ol><li>kPw</li>…X2w<img /></li>…`, at the start of the document

Three more runs of the node grid: one failed the same way, two passed.

The cell was then run 20 times each on both builds (`recordEdit`'s short form; the third column is `caretKey()`
after the letter):

| Cell                               | Branch, 20 runs                                                             | Head (`<base>`), 20 runs  |
| ---------------------------------- | --------------------------------------------------------------------------- | ------------------------- |
| image in TQI by code Numbered list | 16: after the image (`text:k@1`); **4: `<ol><li>kPw</li>…` (`text:kPw@1`)** | 20: after the image       |
| image in QI by code Numbered list  | 18: after the image; **2: `kPw`**                                           | 20: after the image       |
| image in TQI by code Bulleted list | 20: after the image                                                         | 20: after the image       |
| image in QI by code Bulleted list  | 20: after the image                                                         | 20: after the image       |
| rule in TRT by code Numbered list  | 20: after the rule (`T0w<hr />kT2w`)                                        | 20: `kPw` (the head's K8) |
| rule in TR by code Numbered list   | 20: after the rule                                                          | 20: `kPw` (K8)            |

With an image node-selected by code, the branch sometimes sends the letter typed after Numbered list to the
document's start. The head never did in 20 runs, and the branch never did after Bulleted list. The write, the
count and the caret right after the button are stable; only the letter's place varies. The snapshot keeps the
stable result (after the image, the head's and D15's). Not committed: a cell whose snapshot value is not
reproducible fails the grid in CI one run in a few. Owner: Task 16 (the node selection) or Task 19 (the list
buttons). The coordinating session decides which before the snapshots are kept.

## P22-10: the snapshot files are written with an indent of 2 and a final new line

Task 22 Step 2 writes `JSON.stringify(sortedMap, null, 1)`. `pnpm oxfmt --check` (CI's checks) rejects those
files: it formats JSON with an indent of 2 and a final new line, and `.oxfmtrc.json` is outside the files R1 may
change. The grid test now writes `` `${JSON.stringify(sorted, null, 2)}\n` ``, as the 1510 grids do. The four
snapshots were converted, values unchanged. After the conversion, points (692/692), meeting (332/332), unreached
(578/578) and the click test (54/54) pass without `-u`. The node grid matches apart from P22-9's cell.

## Other results on this head

- T49.1 (47f0613, Task 14): `rich-text-line-deletes.test.tsx` in the lines project, 351/351. It was run after the
  kit's `values` field was made null-safe. Before that, the field threw on an onChange called with no value, in
  "Backspace equals <base>'s write (the rule and the quote go; not a fixed point)".
- Checks: `pnpm oxfmt --check` passes, `pnpm lint` passes, the builder's `tsc` passes,
  `check:runtime-upstream` passes, and `check:every-test-runs` passes (5 files in each grids leg).

## P22-11: P22-9's cause and fix (T50.1): the read-back took the browser's own caret under a node selection

Fixed in `rich-text-line-points.ts` (15.12's read-back, Task 11's handler `points.rememberPageSelection`). The
brief named Task 16 (the node selection) or Task 19 (the list buttons); neither owns the step that goes wrong.

**Cause.** The steps of "image in TQI (or QI) by code, Numbered list, then a letter":

1. `nodeSelect` sets a node selection on the image. Its commit removes the page's range (Lexical draws no range
   for a node selection), and the update listener of 15.12 records the page's selection as none.
2. Chrome puts a caret of its own back in the focused field, at the document's start (`Pw@0`). When the
   `selectionchange` that reports it reaches Lexical while the node selection stands (it is a race: it comes
   either before the button's click or not until later), Lexical keeps the node selection, but
   `SELECTION_CHANGE_COMMAND` runs `points.rememberPageSelection`, which records the browser's caret as the
   page's selection Lexical last read.
3. Numbered list replaces the `<ul>` with an `<ol>`: the list's DOM is rebuilt, `Pw`'s text node included. The
   node selection is unchanged, so the update listener does not record the page's selection again; the stale
   `Pw@0` stays.
4. The letter: Chrome again puts its own caret at the start, now in the new text node, before the key reaches
   the field. On `KEYDOWN`, `field.caretBesideImageOnKey` turns the image's node selection into a range after
   the image; `points.readBack` then runs on that range, compares the page (`Pw@0` in the new node) with the
   stale record (`Pw@0` in the old node), finds the page "moved", and reads the browser's caret back. The
   letter lands at the document's start: `<ol><li>kPw</li>…`.

The letter races against the `selectionchange` of step 2: when it comes before the button, step 2 records the
caret and the letter lands at the start; when it does not, the record stays none and `pageMoved()` is false.
Measured with event traces: every `kPw` run had that `selectionchange` (anchor `Pw@0`, Lexical's selection
the node selection) before the button's pointerdown; no run after the image had it.

**Why the head and the other cells do not show it.**

- The head (`<base>`) has no read-back (15.12 is the branch's): the image's key handler's range stands.
- Bulleted list on these `<ul>` shapes, and Bold or Divider with the image selected, write nothing and rebuild
  no DOM: the browser's caret at the key is in the same text node as the stale record, so the page has not
  "moved". With step 2 forced, before the fix: Bulleted, Bold, Divider and no button each gave the letter after
  the image, 10 of 10.
- A rule selected (TRT, TR; any list button): `caretBesideImageOnKey` acts on an image only, so on `KEYDOWN`
  Lexical still holds the node selection, and the read-back acts on a range only; the letter is placed by the
  node selection's `beforeinput` listener (D15). With step 2 forced, before the fix: TRT Numbered list and TRT
  Bulleted list, 10 of 10 after the rule.
- Any other command that rebuilds the DOM around an image while its node selection stands (Block type, an
  image selected for real) would have gone through step 4 the same way; the fix is at step 2, so it covers
  them all.

**Fix.** `rememberPageSelection` records none while Lexical holds a node selection: Lexical leaves the page no
range under one, so a range the page shows then is the browser's own caret, no step of the person's (as
`pageMoved` already treats a range appearing after a node selection's commit). One expression changed.

**Tests** (`rich-text-line-readback.test.tsx`, describe "a page range that appears where Lexical last left none
is not read back"):

- "P22-9: the browser's own caret under a node selection, Numbered list, then a letter: the letter after the
  image, both orders forced": TQI and QI, 3 times each. It forces the losing order: the browser's caret at the
  start, reported while the node selection stands (step 2), then after Numbered list the browser's next caret
  in the rebuilt list, held unreported until the key (step 4). Without the fix: failed 3 of 3 runs (the first
  iteration, `kPw`). With it: passed 3 of 3.
- "P22-9: an image node-selected by code, Numbered list, then a letter: the letter after the image, 20 runs of
  each shape": the cell repeated. Without the fix: failed 3 of 3 runs. With it: passed 3 of 3.

**Runs with the fix.** The readback, points, node-selection, toolbar, point-check and walks files in the lines
project: 898/898. The node grid (copied in from the uncommitted Task 22 work with the kit change, not
committed) without `-u`, 5 runs: 258/258 each, no differing value. The two cells through `recordEdit`'s short
form, 50 runs each: one result each, the letter after the image (`…X2w<img />k</li>…` and
`…<blockquote><p>Q0w</p></blockquote><img />k</li>…`), write, count and caret (`node:cms-image`) as in the
snapshot. No retry, no wait and no loosened assertion was added to the kit or the cells.
