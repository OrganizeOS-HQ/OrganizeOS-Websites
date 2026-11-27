# T88.7 re-run (T90.3): R1 `1c7781b` against `<base>` `2a96a45`

The combined re-run ordered by T88.7 and T90.3, at the head that holds both fixes (T83's composing guard `3a2e8bd`, T88's
Delete row `7c4a759`). Both builds were run afresh on 2026-11-27. The report is `../../p-records-task26-rerun-t88.md`.

What ran, at each build:

- keys-phase-1 (k0 to k3), keys-phase-2 (g, n1 to n3) and gap-fill (g1, c1, c2, g3 to g6), whole: 5,263 records.
- check 5's keys, comp and comp-skeptic probes: 46 probe files.
- the node grid (`rich-text-line-grid-node.test.tsx`, project `core-browser-builder-cms-rich-text-grids-b`) at R1: 258 of 258
  passed, the snapshot unchanged (60 s). It cannot run at the base, which has no line modules; its snapshot is the comparison.
- T55.3's invariant read per edit (T67.1) over R1's records of the three sets.

How the data was made:

- Drivers are the second comparison's (`gdrive2.py`, `chain.sh`, `prun2.sh`), copied as `gdrive3.py`, `prun3.sh`, with the
  engines taken from copies patched by `d7patch.py`. Each batch ran in its own scratch directory (`native/zzacc-<set>-<batch>`,
  gap-fill in `zzacc-gap-fill`; probe files in `native/zzacc-p5-<build>-<lens>-<file>`). Stall watchdog 40 s; every run under
  `timeout -s KILL 600`. All scratch directories are removed; the base checkout is left as found.
- The probe scratch directory names carry the build. A first probe pass used the second comparison's names, which are the same at
  both builds, and its end-of-file `pkill -f <dir>/` stopped the other build's run of the same file; that pass's keys outputs were
  thrown away and the keys probes were run again with the build in the name. The comp and comp-skeptic files of the first pass
  did not overlap and stand.
- Comparisons use `compare.py`'s field rules (`sig_engine`) for the sets and `pcmp2.py`'s for the probes. Normalised: the gap-fill
  image URL's port; timing fields dropped (`ms`, a walk stop's `kms`, a probe file's top-level `ms`); in a probe value, the line
  and column numbers of a stack trace (`rich-text-line-commands.ts:491` became `:497` with T88's new row; the error text is the same).

## D7's normalisation in the harness (T85.1)

The engines' state check now takes D7's normalisation (`engines-d7.diff`):

- The harness gains `stateD7()`: `editor.getEditorState().toJSON()` with every `direction` key and every `cms-line` whose
  `children` is `[]` left out, keys sorted, as a string (`toJSON` carries no node keys). `stateOf()` is unchanged; the walks still
  read it.
- A `snap` step stores both. A `cmp` step's `state` is now the D7 comparison; `stateRaw` keeps the raw one, as before.
- In the keys probe lens (`eng.tsx`), the no-write invariant and `mountStateSame` use `stateD7()`; `invariantRaw` and
  `mountStateSameRaw` keep the raw values.
- No dump step occurs in these sets. `compare.py` leaves `state` out of the compared fields; `stateRaw` is left out too, so the
  fields compared are the second comparison's. `d7state.json` counts the cmp results: at R1, 65 undo and 9 redo checks are false
  raw and true under D7; the 5 that are false under D7 are T67.1's g3 records (several edits, the first undo takes one), false at
  `a3bc7d8` too. At the base, 5 redo checks change the same way.

## Files

| file                            | what                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `completeness.md`, `.json`      | per set and batch: records at each build, compared, equal, different, missing, hung, crashed; each build against the second run |
| `differences.jsonl.gz`          | the 1,373 records that differ, base against R1: writes, differing fields, differing steps                                       |
| `changed-r1.jsonl.gz`           | R1 records whose value changed since the second comparison (3), with both values and the differing steps                        |
| `changed-base.jsonl.gz`         | base records that changed since the second comparison (13)                                                                      |
| `invariant.json`, `.jsonl.gz`   | T55.3's counts per set, and each record that fails or lacks a check                                                             |
| `d7state.json`                  | the cmp steps' D7 and raw state results, per build                                                                              |
| `probes-pcmp-*.txt`, `.json.gz` | the probes: base against R1 (`base-r1`), R1 against R1 at `a3bc7d8` (`sr-r1`), base against the second run's base (`sb-base`)   |
| `d7patch.py`, `engines-d7.diff` | the patch and what it changed in the engine copies                                                                              |
