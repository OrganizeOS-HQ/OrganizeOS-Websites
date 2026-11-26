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
