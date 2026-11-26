# Acceptance data (Task 26, T55 item 6), `0ae275f` against `<base>` `2a96a45`

- `record-set-differences.jsonl.gz`: the 4,027 differing record-set records the acceptance report counted (toolbar 2590,
  clipboard 90, keys-phase-1 570, keys-phase-2 353, gap-fill 199, paste-matrix 156, paste-sweeps 69). Per line: set, id,
  stored, fields (the compared fields that differ), base and r1 (those fields' values), label (the rule, or
  "unexplained": 10, all ruled under T55.4 and T56), byClass (attributed by class only: 790 records, not about 760:
  toolbar 429, clipboard 20, keys-phase-1 143, keys-phase-2 167, gap-fill 31), baseFlags, failed; the seven non-paste
  sets also write, typedAfterUndoRedo and stepsDiffering.
- `record-set-differences-keys-phase-1-k3.jsonl.gz`: 224 more. keys-phase-1's batch k3 (919 records) was never
  compared (its comparison file predates the base's k3 output, so all 919 read "missing-base"). Compared now:
  keys-phase-1 2,894 equal and 794 different, not 2,199 and 570; the record sets' total is 4,251 different. Same
  format, `notInAcceptanceCount: true`. Labels: 64 D1 loses or reorders, 49 D18 walk element points, 48 by class, 33 D1
  empty block, 13 walk text stops differ, 8 D1 throws, 5 K8, 3 D1 hangs, 1 unexplained (below). 3 of the base's 49
  record-set hangs are among them.
- `probes-pcmp.json.gz`: check 5's probe comparison, byte-identical to the run's `pcmp.json`; `probes-table.md`: its
  7,901 "final values differ" and 154 "steps between differ" records by lens, by kind, by field and by file.

## The k3 record not explained: `k3::ul-d1|TBQ|walk Left`

- stored `<ul><li>Pw</li><li>T0w<br><blockquote><p>Q2w</p></blockquote></li><li>Nw</li></ul>`; a click at `Nw`@0,
  ArrowLeft to `Pw`'s start
- the walk's stops are the same at both builds but one: where the base stops at `"T0w"@3`, R1 stops at the cms-line's
  element point `@element:1` (the end of `T0w`, before the break); a letter there gives `T0wk`, undo returns
- base: no final value or fixed point recorded (`final: null`); R1: the stored value, a fixed point
- apparently D18's class (walk stops differ only at element points); the explainer did not match it because the base
  recorded no final value
