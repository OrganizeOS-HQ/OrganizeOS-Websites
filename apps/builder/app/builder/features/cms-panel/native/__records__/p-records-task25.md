# Task 25: P records

## P25-1: "a drag that ends on an image, then a letter", from B1w@2 leftward: the image dropped (T50.1, T53.3). The cause is the test's gesture, not the field

Seen once in a whole-project run of `core-browser-builder-cms-rich-text-lines-b` under heavy load:

- test: `rich-text-line-readback.test.tsx`, describe "a drag that ends on an image, then a letter", case "a paragraph,
  from B1w@2 leftward" (Task 11's test)
- stored: `<p>A0w<img …width="40" …/>B1w</p>`
- placed: a real CDP drag: pressed at `B1w`@2, six moves 16 ms apart, released at the image's centre
- action: a letter
- expected: `<p>A0w<img />kw</p>`; got: `<p>A0wkw</p>`

It is not load-dependent. The case alone (`-t "a drag that ends on an image"`, an unloaded machine) failed on the first
try, in its sibling "a paragraph led by the image, from B1w@2 leftward" (`<p>A0w</p><p>kw</p>`). A scratch probe of the
two leftward paragraph shapes failed 0 to 4 of 12 runs unloaded, and 0 of 12 at 6x CPU throttling
(`Emulation.setCPUThrottlingRate`).

**Cause.** The drag ends where Chrome puts the page's focus on either side of the image, from one run to the next with
the same input; the field then types over exactly what the range holds.

Event traces of the probe (every `selectionchange`, mouse event and Lexical update, with the page's selection and
Lexical's), the paragraph shape:

- Every run: the moves over `B1w` take the focus to `"B1w"@1`, then `"B1w"@0`.
- A winning run: one of the moves over the image's right half reports the focus at the decorator's span, after the
  image (`SPAN@1`; Lexical: `paragraph@2`, element point after the image). The later moves, the centre one included,
  report nothing. On release the field puts Lexical's selection back on the page (`P@2`, 15.11). Right before the
  letter, the page: `"B1w"@2->P@2`; Lexical: `"B1w"@2->"B1w"@0`. The range does not hold the image; the letter gives
  `<p>A0w<img />kw</p>`.
- A losing run: no move over the image's right half reports anything; the last move, at the centre, reports the
  focus before the image (`"A0w"@3`; in the shape led by the image, `P@0`). Right before the letter, the page:
  `"B1w"@2->"A0w"@3`; Lexical: `"B1w"@2->"A0w"@3`. The range holds the image, Chrome set it there, and Lexical read it
  faithfully; the letter replaces it: `<p>A0wkw</p>`. That is the right result for that range.

No node selection appears at any step of either run, and the release's `click` goes to the `<p>` (the common
ancestor), not the image: P22-11's step (a node selection, then the browser's own caret) is not involved.

Where the drag's end lands, by the probe (runs pooled over the probe's runs; "far" is the far side of the image, the
range holding it; the jump is three moves over the text, then one move onto the image):

| End of the drag                            | Leftward shapes               | Rightward shapes  |
| ------------------------------------------ | ----------------------------- | ----------------- |
| a quarter in from the near edge, six moves | near side, 24 of 24           | not run           |
| a quarter in from the near edge, jump      | near side, 20 of 20           | near side, 8 of 8 |
| 45% in from the near edge, jump            | near side, 12 of 12           | not run           |
| the centre, six moves                      | far in 6 of 64; 0 of 12 at 6x | near side, 8 of 8 |
| the centre, jump                           | far in 7 of 20                | near side, 8 of 8 |
| a quarter in from the far edge, jump       | far in 12 of 20               | far in 5 of 8     |

The near half is exact; the centre and the far half are not. The test's moves went to the exact centre, which for a
leftward drag lies in Chrome's unstable zone. Which side Chrome picks there does not follow the input (identical
coordinates give both) or load (6x throttling gave none); it is Chrome's own, and the field cannot make it stable,
since the page's selection is Chrome's when the letter comes.

**Fix (the harness).** `dragOntoImage` in `rich-text-line-readback.test.tsx` ends the drag on the image's near half, a
quarter of its width in from the edge the drag enters by; the six moves, the 16 ms between them and the release are
as before. No wait, no retry. The assertion of the write is unchanged, and a second assertion is added before the
letter: the page's selection does not hold the image ("the drag ends on the image's near side"), so a gesture that
lands elsewhere fails at the gesture, not as a write. The ended-on-image path still runs 15.11's put-back (the page's
focus at `SPAN@1`, put back as `P@2`) in every run.

**Tests.**

- The six cases of "a drag that ends on an image, then a letter" (the existing test, its gesture fixed, with the new
  assertion before the letter).
- "P25-1: the drag ends on the image's near side, 3 runs of each leftward shape": the repeat test, second to the
  above. With the old end (the centre) and the new assertion, the describe failed 2 of 5 runs, each at "the drag ends
  on the image's near side", in the paragraph shape.
- No forced-order test: there is no order of the field's to force. The losing result comes from where Chrome puts the
  page's selection during the drag, which the same input does not fix; the field's handling of each range is right.

**The other cells through the same step** (a real drag that ends on a decorator):

- `rich-text-line-clipboard.test.tsx`, "a real drag from A0w / B2w onto the rule": a drag from text onto the centre of
  a root-level rule. It already asserts where the drag ends ("the drag ends before the rule", `element:root@1`) before
  any edit. Run 10 times (20 tests, 60 drags): all ended before the rule. Safe: 60 of 60 drags ended there, and the
  cell would fail at the gesture, not as a write, if one did not.
- `rich-text-line-composition.test.tsx` ("a right-to-left drag") and `rich-text-line-press.test.tsx` (the press and
  drag across words; the drag from beside a leading rule into text): they end in text, on no decorator. Not the step.
- The toolbar's and the kit's `clickAt` on a rule's or an image's centre: a click node-selects the decorator; no drag
  focus is placed. Not the step.

**Runs with the fix** (`core-browser-builder-cms-rich-text-lines-b`):

- The failing case alone ("a paragraph, from B1w@2 leftward"), 50 runs: 50 passed.
- The readback file, 5 runs: 76/76 each (wall 153 to 164 s). The repeat test takes about 4.4 s.
- oxfmt `--check`, `pnpm lint`, the builder's `tsc` and `check:runtime-upstream`: clean.
