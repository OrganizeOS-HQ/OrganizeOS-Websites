# Task 26: T80.6, P-six-1 traced (no fix made)

Worktree `/home/user/OrganizeOS-Websites/.claude/worktrees/agent-a940e2e89d2af5ae5`, branch `t80` at `c36b65e`, no commits.
The base is `SP/r1-base` (`2a96a45`), left clean (its untracked `zz13base.log` was there before this task and is not mine).
Probes, scripts and raw data: `SP/t80/` (`mk.py`, `gen.py`, `gpd.py`, `gtrace.py`, `run.sh`, `cls.py`, `freq.py`,
`table.py`; raw records `SP/t80/data/{base,r1}/`; tables `SP/t80/table-m.md`, `SP/t80/cls-m.txt`, `SP/t80/freq-v.txt`,
`SP/t80/freq-pd.txt`). The probe was mounted as `native/zzt80/`, then removed from both trees. Nothing was committed.

## Step 1: the cause

**No R1 step keeps or restores the node selection.** The R1 code does nothing here. The difference comes from Lexical's
own state.

- Lexical holds a node selection through every update (`$internalCreateSelection`, Lexical.dev.js 7476-7484: it
  clones the last selection unless that is a range or null). A composition does not change that by itself. At both
  builds, a composition at a node selection with nothing else pending leaves the node selected.
- Lexical has one path that replaces a node selection with the page's range. Its `pointerdown` handler sets a
  module-level mark, `isSelectionChangeFromMouseDown` (2713-2726). The next document `selectionchange` whose anchor is
  in an editor consumes the mark and sets a range from the page (3248-3264). A `selectionchange` while the page holds
  no range returns before it reaches the mark (`nextActiveEditor === null`, 3245), so the mark stays pending.
- In the six measurement every scenario starts with a real click on a word (`clickWord T1w`). At the base, in QTR, the
  mount's click has node-selected the rule, and that word click leaves no selection on the page (K9). The mark stays
  pending. The composition's first `selectionchange` inside the field then consumes it and moves the selection to
  `aPw@1`. The traced events at the base: compositionupdate, input, `selectionchange` (dom `aPw@1`), then
  SELECTION_CHANGE already at a range at the CRITICAL listener, before any field handler runs. The commit is dirty
  0/0, with no tag.
- At R1 the same word click gives a caret at T1w (`clickAfterNodeSelection`, the click T80.2 ruled). That click's
  `selectionchange` consumes the mark, so none is pending when the composition runs. R1's SELECTION_CHANGE stays at the
  node selection, at CRITICAL and at EDITOR.
- The proof: I set the mark at both builds by the same means, a `pointerdown` on a word with no selection change after
  it (start `pdown`). The caret was set by code first. Then the rule was selected and `a` composed.
  - Both builds move to `aPw@1` and the letter writes `akPw`, 3 of 3, in QTR and in `<p>Pw</p><hr><p>Nw</p>`.
  - Without the mark (start `nocl`: caret by code, no pointer), both builds keep the rule selected, 3 of 3.
- T51.1's read-back rule is not involved. `rememberPageSelection`, `$readBack` and `beforeKeyOrEdit` return while the
  editor composes or do not touch a node selection, and with the mark pending R1 moves exactly as the base does.

So the base's move into the composed text is the leftover of its own click, K9. It is not part of the composition's
result. T80.6's premise "nothing makes the node selection outlast a composition" does not hold for the head: Lexical
itself keeps the node selection unless an earlier press's mark is pending.

## Step 2: the measurement (both builds, 3 runs each, 432 records per build)

Shapes:

- QTR (rule, lined);
- `<ul><li>Pw</li><li>X0w<img></li><li>Nw</li></ul>` (image, lined);
- `<p>Pw</p><hr><p>Nw</p>` (rule, ordinary);
- `<p>X0w<img></p>` (image, ordinary).

Starts:

- `click`: a real click on the word, as in the six measurement;
- `nocl`: the caret set by code;
- `pdown`: as `nocl`, then a bare pointerdown.

Node selected:

- by code (`$createNodeSelection`);
- by a real press. On a rule that is a click on it (elementFromPoint = `hr`). On an image it is ArrowRight, because a
  click on an image opens its popover and selects nothing at both builds (T25.1, measured again here).

Composition `a` and `a\nb` by CDP IME. Then, each from that state: a letter, Backspace, and a second composition `b`.
Full table: `SP/t80/table-m.md`.

Results, with call counts compared under T67.2 (the base's U+200B start value and its repeat are withheld at R1):

- **Lexical's selection after the composition differs in 4 of 48 cases.** These are QTR × `click` × {code, press} × `a`:
  - the base gives `aPw@1` (page `aPw@1`), 9 of 9;
  - R1 gives the rule (page `aPw@1`), 9 of 9;
  - from there the base's letter writes `akPw`, its Backspace writes `Pw` (it deletes the `a`), and its second
    composition writes `abPw` with the caret in the text;
  - R1's letter writes `T1w<hr>k`, its Backspace removes the rule, and its second composition writes `abPw` with the
    rule still selected.
- With `nocl` and `pdown` the QTR selection after the composition is equal at both builds in every case (`nocl`: the
  rule; `pdown`: `aPw@1`). The letter differs only by D15's typed-text rule (lined content: R1's letter lands after the
  rule), as T80.6 rules for `a\nb`. Backspace and the second composition write equal HTML. Under `click` × `a\nb` the
  second composition writes `ba` at both builds; the base's caret ends in the text and R1's on the rule, from the same
  leftover mark.
- **The lined image: equal in all 24 cases.** Both builds end in the composed text `a@1`, or `a@0` for `a\nb`.
- **Ordinary content (rule and image), before any fix: R1 differs from the base in 0 of 48 cases.** That covers the
  selection the composition leaves, the page's selection, and what the letter, Backspace and the second composition
  write. This is T60.3's number for these records: 0.
  - Two rare `a\nb` run variants were seen at R1, 1 run in 9 each: `<p>Pw</p><hr><p>Nw</p>` with `pdown` (Backspace
    wrote nothing; in 20 more runs, 1 of 20) and `<p>X0w<img></p>` with `nocl` (0 of 20 in more runs).
  - The same kind of variant, the composed `a` replacing `Pw`, appeared at the base in QTR with `pdown` × press. Both
    builds produce these variants, which come from the IME sequence's timing (T70.12's area). They are P record
    P-t80-2 and are not pinned.

## Steps 3 to 6: not done, and why

The bar for step 3 is: "R1's selection after a composition that writes text is the head's... A case where the head
itself keeps the node selection stays as the head's." Measured from the same state, the head keeps the node selection
in every case where R1 does, and R1 moves in every case where the head does. The four cases that differ start from
different states, because the base's click (K9) leaves Lexical's press mark pending and R1's click does not.

A fix at the composition, moving R1 into the composed text after a composition at a node selection, would make R1
differ from the head in every `nocl` case, including the ordinary rule case that is equal now (T60.3 would become
nonzero). R1 could only match the four cases by keeping a press mark pending after a click that R1 resolves to a
caret. That would rebuild a by-product of K9, which T80.2 ruled R1 does not have. Neither is the head's result, so I
made no change. No tests, no node-grid runs and no whole-project runs were needed (the head is `c36b65e`, unchanged),
and T80.7's re-run does not arise.

## P records

- **P-six-1 (revised).**
  - Stored: QTR.
  - Placed: a real click on T1w. At the base it leaves no selection (K9), and Lexical's pointerdown mark stays pending.
    At R1 it leaves the caret at T1w and consumes the mark. The rule is then node-selected by code or by a click on it.
  - Action: compose `a`.
  - The base: the selection moves to `aPw@1`, and the letter writes `akPw`.
  - R1: the rule stays selected, and the letter writes `T1w<hr>k`.
  - From the same state (the mark pending at both, or at neither) the two builds are equal.
  - Candidates:
    - (a) R1 stands. The difference is K9's leftover, labelled "map 1 group 11 at the base's click (K9); Lexical keeps
      a node selection through a composition unless a press's mark is pending; R1's click consumes it (T80.2)";
    - (b) R1 keeps a press mark pending after its click so that the next composition moves (not recommended: it
      rebuilds K9's by-product).
  - The ruling T80.6 rests on, and D15's planned clause (T80.8), should be read against this trace before the clause
    is written.
- **P-t80-2.**
  - Stored: `<p>Pw</p><hr><p>Nw</p>` and `<p>X0w<img></p>`.
  - Placed: `pdown` or `nocl`, then the node selected by code.
  - Action: compose `a\nb`, then Backspace.
  - The base: one form, 3 of 3 (20 of 20 in more runs).
  - R1: 1 run in 9 gave another composed value or a Backspace with no write.
  - The same kind of variant appears at the base in QTR. Candidates:
    - (a) the IME sequence's timing, at both builds (T70.12);
    - (b) an R1 difference.
  - It needs a larger run to tell the two apart.

## Measurement table

| shape | start | node selected | text    | base: Lexical / page after                                 | R1: Lexical / page after                                              | letter                                                                                                                                                    | Backspace                                                                                                                                                                                                    | 2nd composition                                                                                                                                                                                                      |
| ----- | ----- | ------------- | ------- | ---------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QTR   | click | code          | 'a'     | text@1"aPw" #text"aPw"@1 (9)                               | node:horizontalrule #text"aPw"@1 (9)                                  | base <ul><li>akPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@2"akPw" (3) / R1 <ul><li>aPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3)        | base <ul><li>Pw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@0"Pw" (3) / R1 <ul><li>aPw</li><li>[Q]T1w</li><li>Nw</li></ul> text@3"T1w" (3)                                                                  | base <ul><li>abPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@2"abPw" (3) / R1 <ul><li>abPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> node:horizontalrule (3)                                                         |
| QTR   | click | code          | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | base <ul><li>ka</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@0"ka" (3) / R1 <ul><li>bPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3)            | =                                                                                                                                                                                                            | base <ul><li>ba</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@1"ba" (3) / R1 <ul><li>ba</li><li>[Q]T1w<hr></li><li>Nw</li></ul> node:horizontalrule (3)                                                               |
| QTR   | click | press         | 'a'     | text@1"aPw" #text"aPw"@1 (9)                               | node:horizontalrule #text"aPw"@1 (9)                                  | base <ul><li>akPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@2"akPw" (3) / R1 <ul><li>aPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3)        | base <ul><li>Pw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@0"Pw" (3) / R1 <ul><li>aPw</li><li>[Q]T1w</li><li>Nw</li></ul> text@3"T1w" (3)                                                                  | base <ul><li>abPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@2"abPw" (3) / R1 <ul><li>abPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> node:horizontalrule (3)                                                         |
| QTR   | click | press         | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | base <ul><li>ka</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@0"ka" (3) / R1 <ul><li>bPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3)            | base <ul><li>bPw</li><li>[Q]T1w</li><li>Nw</li></ul> text@3"T1w" (2); <p>bPw</p><ul><li>[Q]T1w<hr></li><li>Nw</li></ul> text@0"bPw" (1) / R1 <ul><li>bPw</li><li>[Q]T1w</li><li>Nw</li></ul> text@3"T1w" (3) | base <ul><li>ba</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@1"ba" (3) / R1 <ul><li>ba</li><li>[Q]T1w<hr></li><li>Nw</li></ul> node:horizontalrule (3)                                                               |
| QTR   | nocl  | code          | 'a'     | node:horizontalrule #text"aPw"@1 (9)                       | node:horizontalrule #text"aPw"@1 (9)                                  | base <ul><li>akPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> node:horizontalrule (3) / R1 <ul><li>aPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3) | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| QTR   | nocl  | code          | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | base <ul><li>ka</li><li>[Q]T1w<hr></li><li>Nw</li></ul> node:horizontalrule (3) / R1 <ul><li>bPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3)   | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| QTR   | nocl  | press         | 'a'     | node:horizontalrule #text"aPw"@1 (9)                       | node:horizontalrule #text"aPw"@1 (9)                                  | base <ul><li>akPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> node:horizontalrule (3) / R1 <ul><li>aPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3) | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| QTR   | nocl  | press         | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | base <ul><li>ka</li><li>[Q]T1w<hr></li><li>Nw</li></ul> node:horizontalrule (3) / R1 <ul><li>bPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3)   | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| QTR   | pdown | code          | 'a'     | text@1"aPw" #text"aPw"@1 (9)                               | text@1"aPw" #text"aPw"@1 (9)                                          | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| QTR   | pdown | code          | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | base <ul><li>ka</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@0"ka" (3) / R1 <ul><li>bPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3)            | =                                                                                                                                                                                                            | base <ul><li>ba</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@1"ba" (2); <ul><li>bbPw</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@1"bbPw" (1) / R1 <ul><li>ba</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@1"ba" (3) |
| QTR   | pdown | press         | 'a'     | text@1"aPw" #text"aPw"@1 (9)                               | text@1"aPw" #text"aPw"@1 (9)                                          | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| QTR   | pdown | press         | 'a\\nb' | node:horizontalrule no range (8); text@0"a" #text"a"@0 (1) | node:horizontalrule no range (9)                                      | base <ul><li>ka</li><li>[Q]T1w<hr></li><li>Nw</li></ul> text@0"ka" (3) / R1 <ul><li>bPw</li><li>[Q]T1w<hr>k</li><li>Nw</li></ul> text@1"k" (3)            | base <ul><li>bPw</li><li>[Q]T1w</li><li>Nw</li></ul> text@3"T1w" (2); <p>a</p><ul><li>[Q]T1w<hr></li><li>Nw</li></ul> text@0"a" (1) / R1 <ul><li>bPw</li><li>[Q]T1w</li><li>Nw</li></ul> text@3"T1w" (3)     | =                                                                                                                                                                                                                    |
| LIIMG | click | code          | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | click | code          | 'a\\nb' | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | click | press         | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | click | press         | 'a\\nb' | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | nocl  | code          | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | nocl  | code          | 'a\\nb' | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | nocl  | press         | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | nocl  | press         | 'a\\nb' | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | pdown | code          | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | pdown | code          | 'a\\nb' | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | pdown | press         | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| LIIMG | pdown | press         | 'a\\nb' | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | click | code          | 'a'     | node:horizontalrule #text"aPw"@1 (9)                       | node:horizontalrule #text"aPw"@1 (9)                                  | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | click | code          | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | click | press         | 'a'     | node:horizontalrule #text"aPw"@1 (9)                       | node:horizontalrule #text"aPw"@1 (9)                                  | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | click | press         | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | nocl  | code          | 'a'     | node:horizontalrule #text"aPw"@1 (9)                       | node:horizontalrule #text"aPw"@1 (9)                                  | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | nocl  | code          | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | nocl  | press         | 'a'     | node:horizontalrule #text"aPw"@1 (9)                       | node:horizontalrule #text"aPw"@1 (9)                                  | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | nocl  | press         | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | pdown | code          | 'a'     | text@1"aPw" #text"aPw"@1 (9)                               | text@1"aPw" #text"aPw"@1 (9)                                          | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | pdown | code          | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (8); text@0"a" #text"a"@0 (1)            | =                                                                                                                                                         | base <p>bPw</p><p>Nw</p> text@3"bPw" (3) / R1 <p>bPw</p><p>Nw</p> text@3"bPw" (2); (none) text@0"a" (1)                                                                                                      | =                                                                                                                                                                                                                    |
| PHR   | pdown | press         | 'a'     | text@1"aPw" #text"aPw"@1 (9)                               | text@1"aPw" #text"aPw"@1 (9)                                          | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PHR   | pdown | press         | 'a\\nb' | node:horizontalrule no range (9)                           | node:horizontalrule no range (9)                                      | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | click | code          | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | click | code          | 'a\\nb' | text@0"a" #text"a"@0 (9)                                   | text@0"a" #text"a"@0 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | click | press         | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | click | press         | 'a\\nb' | text@0"a" #text"a"@0 (9)                                   | text@0"a" #text"a"@0 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | nocl  | code          | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | nocl  | code          | 'a\\nb' | text@0"a" #text"a"@0 (9)                                   | text@0"a" #text"a"@0 (8); text@1"a" #text"a"@0<span -> #text"a"@1 (1) | =                                                                                                                                                         | base <p>X0wa</p> text@3"X0wa" (3) / R1 <p>X0wa</p> text@3"X0wa" (2); <p>X0w<img></p> element@2 (1)                                                                                                           | =                                                                                                                                                                                                                    |
| PIMG  | nocl  | press         | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | nocl  | press         | 'a\\nb' | text@0"a" #text"a"@0 (9)                                   | text@0"a" #text"a"@0 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | pdown | code          | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | pdown | code          | 'a\\nb' | text@0"a" #text"a"@0 (9)                                   | text@0"a" #text"a"@0 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | pdown | press         | 'a'     | text@1"a" #text"a"@1 (9)                                   | text@1"a" #text"a"@1 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |
| PIMG  | pdown | press         | 'a\\nb' | text@0"a" #text"a"@0 (9)                                   | text@0"a" #text"a"@0 (9)                                              | =                                                                                                                                                         | =                                                                                                                                                                                                            | =                                                                                                                                                                                                                    |

# T81.6: P-t80-2 measured (300 runs per case per build)

Worktree `/home/user/OrganizeOS-Websites/.claude/worktrees/agent-a940e2e89d2af5ae5` at `c36b65e`, unchanged. The base is
`SP/r1-base`, run under `timeout 600`. The probe (`native/zzt80/`) was removed from both trees afterwards, so both are clean
(the base's untracked `zz13base.log` was there before me). Scripts are in `SP/t80/`: `gen.py`, `gtr2.py`, `run.sh`,
`freq.py`, `var.py`, `tr2.py`, `chk.py`. Raw data is in `SP/t80/data-h`, `data-h2`, `data-p3`, `data-t2`, `data-t3` and
`data-t4`. Per-run forms are in `freq-h.txt`, `freq-h2.txt` and `var-h.txt`.

## The batches

Each batch runs the three cases interleaved (QTR, then the ordinary rule, then the ordinary image, for each run index).

- Case 1, ordinary rule: `<p>Pw</p><hr><p>Nw</p>`, the `pdown` start, the rule selected by code.
- Case 2, ordinary image: `<p>X0w<img></p>`, the `nocl` start, the image selected by code.
- Case 3, QTR: the `pdown` start, the rule selected by a press.

In every case the action is to compose `'a\nb'` by CDP, then press Backspace.

| batch | runs per case per build | load average before / after (base) | (R1)        |
| ----- | ----------------------- | ---------------------------------- | ----------- |
| h     | 100                     | 0.79 / 1.58                        | 1.45 / 1.64 |
| h2    | 200                     | 0.98 / 1.34                        | 1.34 / 1.68 |

Each record holds the values handed out, the write, Lexical's and the page's caret after the composition, and the same
after the Backspace.

## The forms, over the 300 runs per case per build

**Ordinary rule** (`<p>Pw</p><hr><p>Nw</p>`):

- Normal form: the composition writes `bPw`, the rule stays selected, and the Backspace writes `<p>bPw</p><p>Nw</p>`. The
  base gave it 290 times, R1 281 times.
- (v1) The composed `a` replaces `Pw`, giving `<p>a</p><hr>`. The caret is at `a@0`, and the Backspace writes nothing.
  - The base gave it 3 + 3 times, R1 0 + 5 times.
- (v2) The write is `bPw` with the rule selected, and the Backspace writes nothing.
  - The base gave it 1 + 3 times, R1 0 + 5 times.
- **(v3), at R1 only.** The composition hands out `aPw`, `bPw`, then `<p>a\nb</p><hr>`: a literal newline written into
  the text. The caret is at `a\nb@3`, and the Backspace writes `<p>a\n</p><hr>`.
  - The base gave it **0 times**, R1 3 + 6 = **9 times**.
- Overall the variant rates are close: the base 10 of 300, R1 19 of 300. The form v3, though, is R1's alone.

**Ordinary image** (`<p>X0w<img></p>`):

- Normal form: the base gave it 300 of 300.
- R1's variant: a single value handed out (`<p>X0w<img>a</p>`, no `b`). The selection is the range `a@0` to `a@1`, and the
  Backspace removes the `a`, giving `<p>X0w<img></p>`.
  - R1 gave it 2 times in batch h and 0 in h2.
  - It did not recur in 300 runs of the case alone, or in 650 traced runs.
  - That is 2 in 1,250 R1 runs in all, against 0 in 300 at the base.

**QTR:**

- The base: 6 variants of 300, the `<p>a</p>` form (the item's `a` lifted out of the list) and the `<p>bPw</p>` form.
- R1: 11 variants of 300.
  - 7 of them: the composed `a`, after which the Backspace empties the item.
  - **4, at R1 only:** `<li>a\nbQ0w</li><li>T1w<hr>`. The newline is literal, and the quote is joined into the first item.

Outcome: **(B) for both ordinary cases.** Both show a form at R1 that the base never gives in 300 runs: v3 for the rule,
and the single-value form for the image. On rates alone the ordinary rule would read as (A).

## The trace (instrumented temporarily, then reverted)

300 traced runs of the ordinary rule at R1 gave 16 variant runs. In all 16, Lexical's pointerdown mark was consumed
partway through the composition: a `selectionchange` arrived while the page showed `aPw@0`, and the node selection became
a range. Lexical's composition key stays null, because its `compositionstart` saw a node selection, so
`editor.isComposing()` is false throughout.

- In **8 of 8** v3 runs, R1's `beforeKeyOrEdit` (`rich-text-line-points.ts`, from line 1265) ran its update at the
  composition's `beforeinput insertCompositionText "a\nb"`.
  - Its `isComposing()` guard does not apply, since there is no composition key.
  - With a range held and the page moved, its 15.12 read-back (`$readBack`, line 1230) replaces Lexical's collapsed
    `aPw@0` with the page's composition range `aPw@0` to `aPw@1`.
  - Lexical's later `input` then writes the IME string `a\nb` into the text node as text.
- In the other 8 runs, the mark was consumed the same way but `beforeKeyOrEdit` ran no update. These end in v1, the
  base's form.
- In the 284 runs where the node selection held through the composition, neither happened.

The image variant did not recur under instrumentation, so its step is not traced. Its range selection after the
composition matches the same read-back's footprint, but that is not shown.

## P record P-t81-6

- Stored: `<p>Pw</p><hr><p>Nw</p>`.
- How the point was placed: the caret set by code at Pw@1, then a pointerdown on Nw with no selection change after it
  (Lexical's press mark left pending), then the rule node-selected by code.
- Action: compose `'a\nb'` by CDP IME, then Backspace.
- The base gives the normal form 290 of 300, and v1 or v2 in 10.
- R1 gives v3 in 9 of 300, a form the base never gave:
  - the composition hands out `<p>a\nb</p><hr><p>Nw</p>`, a literal newline in the text;
  - the Backspace then writes `<p>a\n</p>`.
- The R1 step: `beforeKeyOrEdit`'s 15.12 read-back runs at the composition's `beforeinput`, because Lexical holds a range
  but has no composition key (the composition started at a node selection). It sets the page's composition range as the
  selection.
- The same step is the likely source of:
  - QTR's R1-only `a\nbQ0w` form (4 of 300);
  - the image's single-value form (2 of 1,250, untraced).
- Reaching it needs Lexical's press mark pending at a node selection, then consumed mid-composition. This run used a
  synthetic pointerdown to set the mark.
- Candidates:
  - (a) an R1 difference to fix: the read-back should not run during a composition that Lexical tracks without a key;
  - (b) the CDP driver's timing, listed with T70.12's entry.
  - The trace (8 of 8, against 0 of 8 in the base-form variants) points to (a).
- The count of ordinary-content cases with an R1-only form, which is T60.3's number until ruled: **2**. One is the
  ordinary rule (v3, traced); the other is the ordinary image (2 runs, untraced).

# T83: the fix of P-t81-6 (3a2e8bd)

The work is in worktree `/home/user/OrganizeOS-Websites/.claude/worktrees/agent-a940e2e89d2af5ae5`, on branch `t83`. It
starts from `572be9f`, whose code equals `a3bc7d8`. The fix is commit `3a2e8bd`. Nothing was pushed or merged. The base
`SP/r1-base` was left clean. Its untracked `zz13base.log` was there before this task.

## T83.2 The fix

The fix tracks the page's composition on the root, in the capture phase: `registerPageComposition` sets the state at
`compositionstart` and clears it at `compositionend` (`rich-text-line-points.ts`). The field registers it first, inside
`registerCompositionEndOnKey`, ahead of every other listener the field has. T43.1 holds: a keydown that belongs to no
composition (`isComposing` false, key code not 229, a key other than Process and Unidentified) also ends the page's state,
through `endPageComposition`. The browser ending a composition therefore does not leave the steps held. The editor's own
composition key is still cleared as before. `isComposingAtPage(editor)` is `editor.isComposing()` or the page's state.

Every place where the field tests the editor's composing state, and what each does after the fix:

| place                                                                                                                                                                    | what it holds                                                                    | after the fix                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `removeKeptLines` (points)                                                                                                                                               | kept lines do not go while composing                                             | reads the page's state: kept lines stay while the page composes                                                                                                                                                                                  |
| `pageMoved`, 15.12/5.3's read-back (points)                                                                                                                              | no read-back while composing                                                     | reads the page's state: no read-back while the page composes (the defect's step)                                                                                                                                                                 |
| `beforeKeyOrEdit` (points)                                                                                                                                               | while composing, an edit only ends an open press                                 | reads the page's state: during a keyless composition it no longer runs the read-back, the kept lines or the held step                                                                                                                            |
| 16.23's listener, kept lines at the commit that ends a composition (points)                                                                                              | the transition from composing to not                                             | reads the page's state at each commit                                                                                                                                                                                                            |
| `registerPointCheck` (points)                                                                                                                                            | the point check is held while composing                                          | reads the page's state                                                                                                                                                                                                                           |
| `onCompositionStart`, the press's held step (16.18, points)                                                                                                              | it does not run for a `compositionstart` while Lexical still composes            | unchanged. It asks whether Lexical still holds a composition (T43.1's stale key) when the page's start arrives. The page's state is set by that same event, so it cannot answer that question                                                    |
| history: `compositionStartChar`, `rememberCompositionStart`, the voided and removing phases, the unchanged-edit and merged-edit listeners, the composition step listener | the undo step and the start character of a composition that Lexical tracks       | unchanged. These hold no step of the line rules. They decide undo steps and the U+200B start character, which Lexical only adds while it holds a key. For keyless compositions, the values, calls, undo and redo equal the head's (T70.8, T73.3) |
| history: the key or input that belongs to no composition (`onKeyOrInput`)                                                                                                | reads the event's own `isComposing` and `inputType`, then `editor.isComposing()` | unchanged                                                                                                                                                                                                                                        |
| history: `registerCompositionEndOnKey` (T43.1)                                                                                                                           | clears Lexical's key on a keydown that belongs to no composition                 | now ends the page's state first, then clears the key as before                                                                                                                                                                                   |
| `ChangePlugin`, T67.2's start commit (field)                                                                                                                             | the commit at which Lexical's key is set                                         | unchanged. With no key, no start commit exists to withhold                                                                                                                                                                                       |
| `watchField`, the start-character count (field-watch, development)                                                                                                       | counts start characters around a Lexical composition                             | unchanged                                                                                                                                                                                                                                        |

My reading of "every step of the field that holds while composing" is the line rules' steps (5.3's read-back, kept lines,
the point check, the press's held step). The coordinating session should rule if the history or hand-out tests are meant
too.

## T83.3 The bar

**The forced-order test.** It is in `rich-text-line-composition.test.tsx`, in the block "T83: the page composing with no
composition key holds the read-back". It has two tests, each looping three times:

- `<p>Pw</p><hr><p>Nw</p>`, with the rule selected by code;
- QTR, with the rule selected by a click on it.

The losing order is made on purpose:

1. the rule is node-selected;
2. a bare pointerdown on Nw leaves Lexical's press mark pending;
3. the composition `a`, then `a\nb`, then the commit, by CDP;
4. at the composition's second `compositionupdate`, a `selectionchange` is dispatched while the page shows the
   composition range, so Lexical uses up the mark and holds a range;
5. then the `beforeinput`.

The test checks:

- the page's range was reported;
- no value handed out holds a line break;
- the last value is the head's in that order: `<p>a</p><hr /><p>Nw</p>`, and
  `<ul><li>a</li><li><blockquote><p>Q0w</p></blockquote>T1w<hr /></li><li>Nw</li></ul>`;
- what Backspace hands out: nothing in the ordinary shape, and the emptied item in QTR.

The head's values come from the probe in the same order: the base gave them 3 of 3, and R1 with the fix gave the same.

- With the fix taken out (the two source files reverted), the two tests failed in 3 of 3 runs, with the defect's
  forms: `expected '<p>a\nb</p><hr /><p>Nw</p>' not to contain '\n'` and `'<ul><li>a\nbQ0w</li><li>T1w<hr />...'`.
- With the fix, they pass.
- The probe in the same order with `a`: both builds and R1 without the fix give `aPw`, with Backspace writing `Pw`, 3 of 3. Only `a\nb` reached the defect.

**300 runs at R1 after the fix**

- The three cases were interleaved as in T81.6. Data is in `SP/t80/data-h3`, and the table in `SP/t80/cmp-after.txt`.
- They are compared with the base's 300 runs from T81.6 (`data-h`, `data-h2`).
- The load average was 1.25 before the batch and 1.68 after.

| case                                            | form                                                | base (300) | R1 after the fix (300)          |
| ----------------------------------------------- | --------------------------------------------------- | ---------- | ------------------------------- |
| `<p>Pw</p><hr><p>Nw</p>`, the pointerdown start | normal (rule kept, Backspace `<p>bPw</p><p>Nw</p>`) | 290        | 289                             |
|                                                 | v1 (`<p>a</p><hr>`, Backspace writes nothing)       | 6          | 7                               |
|                                                 | v2 (`bPw`, Backspace writes nothing)                | 4          | 4                               |
|                                                 | **`<p>a\nb</p>`**                                   | 0          | **0** (9 of 300 before the fix) |
| `<p>X0w<img></p>`, the caret-by-code start      | normal                                              | 300        | 300                             |
|                                                 | single-value form                                   | 0          | 0                               |
| QTR, the pointerdown start, a press             | normal                                              | 294        | 292                             |
|                                                 | `<p>a</p>` lifted out                               | 3          | 3                               |
|                                                 | `<p>bPw</p>` lifted out                             | 3          | 1                               |
|                                                 | **`<li>a\nbQ0w</li>`**                              | 0          | **0** (4 of 300 before the fix) |
|                                                 | `a` at a@1, then Backspace empties the item         | 0          | 4                               |

- The two forms that were R1's alone no longer occur.
- In ordinary content every remaining form is one the base gives, at rates the runs cannot tell apart. T60.3's number
  from these runs is 0.
- The image case's single-value form was seen twice in 1,250 runs before the fix and not after (0 of 300).
- One form in QTR remains at R1: the composed `a` with the caret at a@1, after which Backspace empties the item.
  - It appears 4 of 300 at R1 and 0 of 300 at the base in the free-running order. Before the fix it was 7 of 300.
  - It is the head's own form for the order in which the mark is used up at the composition's second update: the base
    gives it 3 of 3 in the forced order, and the QTR forced test pins it.
  - So the gap is how often the browser's selection change falls at that moment, not a write the head lacks. It is
    lined content.

**`a`, 100 runs per build** (`<p>Pw</p><hr><p>Nw</p>`, the pointerdown start, then Backspace)

- Both builds give one form, 100 of 100: `aPw` with the caret at aPw@1, then Backspace writes `<p>Pw</p><hr><p>Nw</p>`.

**A real gesture**

- The setup: after the mount, with no caret in the field (the mount's own click skipped), a real click on the rule is
  the first gesture, then the composition. 20 runs per build, in each of `<p>Pw</p><hr><p>Nw</p>` and QTR, with `a` and
  with `a\nb`.
- At both builds the rule stays node-selected after the composition in 80 of 80 runs. A press on the rule leaves no
  mark pending, because Lexical sets none for a press inside a decorator.
- So a person does not reach the path with this gesture. The path needs Lexical's press mark pending at a node
  selection, which these runs set only with a synthetic pointerdown.
- The letter after the composition differs in QTR only, by D15's typed-text rule.
- QTR's `a\nb` gives its composed value at different rates across the two builds (T70.12's timing).

**Whole-project runs at `3a2e8bd`**

- These ran one at a time, all passing. Logs are in `SP/t83-all/`.
- The composition file passed whole: 140 of 140, including the T43.1 cells and the new tests.
- T51.1's two tests (P22-9, the forced order and the 20 runs): 2 of 2.
- The node grid (`rich-text-line-grid-node.test.tsx`): 258 of 258. No value changed; the file ran unchanged.

| project                  | test files | tests                   | seconds |
| ------------------------ | ---------- | ----------------------- | ------- |
| lines                    | 18         | 1,556                   | 414     |
| lines-b                  | 3          | 671                     | 310     |
| rich-text                | 9          | 3,110                   | 134     |
| sweeps                   | 3          | 10                      | 110     |
| grids-a                  | 5          | 1,619                   | 242     |
| grids-b                  | 5          | 1,753                   | 261     |
| grids-c                  | 5          | 2,255                   | 267     |
| grids-d                  | 5          | 1,433                   | 245     |
| grids-e                  | 5          | 1,087                   | 310     |
| core-browser-builder-cms | 41         | 1,609                   | 290     |
| core-server              | 124        | 2,020 passed, 1 skipped | 79      |

- core-server's one skipped test is `safe-resource-fetch.live.server.test.ts`. It is not a file this change touches.
- `oxfmt --check`, `lint`, `tsc --noEmit -p apps/builder`, `check:runtime-upstream` and `check:every-test-runs` (1,149
  of 1,152 test files run, 3 exempt) all pass.

## T83.4

T60.3's number from the runs after the fix is 0. That counts the ordinary rule and the ordinary image, 300 runs each,
with no R1-only form.

## T83.5: not run (T88.7)

The diff `git diff --stat a3bc7d8..HEAD` covers 33 files, with 5,236 insertions and 13 deletions:

- code: `rich-text-line-points.ts` (50 lines changed) and `rich-text-line-history.ts` (28), the composing guard only;
- test: `rich-text-line-composition.test.tsx` (+102);
- the other 30 files are records under `__records__/`: `acceptance/second/` (27 files) and
  `p-records-task26-{second,six,t80}.md`, from the commits before this one.

The record re-run was started, then stopped on T88.7, before any set finished. Its scratch directories were removed from
both trees, and its partial data is left uncommitted under `SP/t83/`.
