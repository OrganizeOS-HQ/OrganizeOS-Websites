# Check 5 probes: the records that differ in value (base 2a96a45 against R1 0ae275f)

Source: `SP/acceptance/probes/pcmp.json` (gzipped copy: `t55-b/probes-pcmp.json.gz`), key `detail`: rows `[file, record file, record key, class, base values, R1 values]`. Counted here from that file: **7,901** "final values differ" and **154** "every final value equal; steps between differ" (verified: 7,901 + 154 rows with those classes in `detail`; the other classes are 666 onChange count only, 449 composition-start character only, 1 final values equal but for that character, and 19,826 records on one side only: 19,793 R1 only, 33 base only).

Kind of difference: the compared fields (pcmp.py's `values()`: HTML values, onChange counts, undo and redo results, errors and throws, clipboard, the lens invariant) whose leaves differ, grouped: **value (HTML)** = `write`, `v`, `kWrite`, `after`, `last`, `value`, `final`, `typed`; **onChange count** = `calls`/`changes`; **undo/redo** = `redoOk`, `undoRestores`, `undo`, `redo`; **errors/throws** = `errors` (act warnings left out), `thrown`; **clipboard** = `plain`, `clip`, `text/plain`, `text/html`; **lens invariant** = `inv`. A record counts once, under the set of groups it differs in.

## Final values differ (7,901)

### By lens

| lens           | records |
| -------------- | ------- |
| keys           | 4010    |
| comp           | 1454    |
| hist           | 1371    |
| clip           | 731     |
| comp-skeptic   | 122     |
| insert         | 94      |
| nav            | 59      |
| insert-skeptic | 28      |
| clip-skeptic   | 19      |
| code           | 13      |
| **all**        | 7901    |

### By kind

| kind                                                           | records |
| -------------------------------------------------------------- | ------- |
| value (HTML)                                                   | 6723    |
| onChange count + undo/redo + value (HTML)                      | 654     |
| onChange count + value (HTML)                                  | 186     |
| errors/throws + onChange count + undo/redo + value (HTML)      | 112     |
| errors/throws + lens invariant + onChange count + value (HTML) | 61      |
| clipboard                                                      | 58      |
| errors/throws + value (HTML)                                   | 44      |
| clipboard + onChange count + value (HTML)                      | 31      |
| errors/throws                                                  | 15      |
| clipboard + value (HTML)                                       | 10      |
| lens invariant + onChange count + value (HTML)                 | 5       |
| clipboard + lens invariant + onChange count + value (HTML)     | 2       |

### Lens by kind

| lens           | value (HTML) | onChange count + undo/redo + value (HTML) | onChange count + value (HTML) | errors/throws + onChange count + undo/redo + value (HTML) | errors/throws + lens invariant + onChange count + value (HTML) | clipboard | errors/throws + value (HTML) | clipboard + onChange count + value (HTML) | errors/throws | clipboard + value (HTML) | lens invariant + onChange count + value (HTML) | clipboard + lens invariant + onChange count + value (HTML) |
| -------------- | ------------ | ----------------------------------------- | ----------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- | --------- | ---------------------------- | ----------------------------------------- | ------------- | ------------------------ | ---------------------------------------------- | ---------------------------------------------------------- |
| keys           | 3185         | 654                                       | 0                             | 112                                                       | 0                                                              | 0         | 44                           | 0                                         | 15            | 0                        | 0                                              | 0                                                          |
| comp           | 1401         | 0                                         | 53                            | 0                                                         | 0                                                              | 0         | 0                            | 0                                         | 0             | 0                        | 0                                              | 0                                                          |
| hist           | 1271         | 0                                         | 99                            | 0                                                         | 0                                                              | 0         | 0                            | 1                                         | 0             | 0                        | 0                                              | 0                                                          |
| clip           | 615          | 0                                         | 5                             | 0                                                         | 40                                                             | 50        | 0                            | 14                                        | 0             | 0                        | 5                                              | 2                                                          |
| comp-skeptic   | 116          | 0                                         | 6                             | 0                                                         | 0                                                              | 0         | 0                            | 0                                         | 0             | 0                        | 0                                              | 0                                                          |
| insert         | 69           | 0                                         | 4                             | 0                                                         | 21                                                             | 0         | 0                            | 0                                         | 0             | 0                        | 0                                              | 0                                                          |
| nav            | 17           | 0                                         | 18                            | 0                                                         | 0                                                              | 0         | 0                            | 16                                        | 0             | 8                        | 0                                              | 0                                                          |
| insert-skeptic | 28           | 0                                         | 0                             | 0                                                         | 0                                                              | 0         | 0                            | 0                                         | 0             | 0                        | 0                                              | 0                                                          |
| clip-skeptic   | 9            | 0                                         | 0                             | 0                                                         | 0                                                              | 8         | 0                            | 0                                         | 0             | 2                        | 0                                              | 0                                                          |
| code           | 12           | 0                                         | 1                             | 0                                                         | 0                                                              | 0         | 0                            | 0                                         | 0             | 0                        | 0                                              | 0                                                          |

### Field names that differ (a record counts under each)

`write` 4052, `v` 2989, `calls` 1051, `kWrite` 867, `redoOk` 766, `after` 488, `last` 340, `errors` 232, `plain` 76, `inv` 68, `clip` 24, `thrown` 21, `value` 17, `text/html` 1, `text/plain` 1

### By probe file

`comp/zzv15-comp-a` 421, `clip/zzv15-clip-x` 336, `keys/zzv15-keys-i2r0` 329, `keys/zzv15-keys-i2r1` 322, `comp/zzv15-comp-n` 310, `hist/zzv15-hist-d` 293, `clip/zzv15-clip-d` 264, `comp/zzv15-comp-k` 263, `hist/zzv15-hist-a` 253, `keys/zzv15-keys-i3sub` 224, `hist/zzv15-hist-p` 222, `keys/zzv15-keys-i2b` 218, `hist/zzv15-hist-k` 208, `hist/zzv15-hist-z2` 203, `keys/zzv15-keys-i3bwdb` 198, `keys/zzv15-keys-i3h` 189, `keys/zzv15-keys-i3ba` 184, `keys/zzv15-keys-i4bwd` 182, `keys/zzv15-keys-i1link` 176, `keys/zzv15-keys-i1br` 168, `keys/zzv15-keys-i1img` 168, `keys/zzv15-keys-i5` 157, `keys/zzv15-keys-i3bb` 155, `comp/zzv15-comp-x` 153, `keys/zzv15-keys-i3fa` 152, `hist/zzv15-hist-z` 150, `comp/zzv15-comp-f` 144, `keys/zzv15-keys-i3fwda` 143, `keys/zzv15-keys-i3bwda` 141, `keys/zzv15-keys-i1code` 136, `comp/zzv15-comp-e` 129, `keys/zzv15-keys-i1hr` 128, `clip/zzv15-clip-e` 127, `comp-skeptic/zzv15-comp-skeptic-v` 122, `keys/zzv15-keys-i3fwdb` 108, `keys/zzv15-keys-i3fb` 97, `keys/zzv15-keys-i4fwd` 90, `keys/zzv15-keys-i1linkh` 80, `keys/zzv15-keys-i3rr` 64, `nav/zzv15-nav-w1` 57, `keys/zzv15-keys-i2l` 55, `insert/zzq1-a-S` 49, `keys/zzv15-keys-i1named` 48, `keys/zzv15-keys-i1word` 48, `insert/zzq1-a-R` 41, `comp/zzv15-comp-c` 34, `hist/zzv15-hist-k2` 34, `keys/zzv15-keys-i1linkbtn` 30, `insert-skeptic/zzq1s-a` 28, `clip-skeptic/zzv15-clip-skeptic-main` 19, `keys/zzv15-keys-i3real` 11, `keys/zzv15-keys-smoke` 9, `hist/zzv15-hist-ab` 8, `code/zzv15-code-a` 7, `code/zzv15-code-b` 6, `clip/zzv15-clip-fs9` 4, `insert/zzq1-a-BQA` 4, `nav/zzv15-nav-k2` 2

## Steps between differ, final values equal (154)

### By lens

| lens         | records |
| ------------ | ------- |
| clip         | 88      |
| hist         | 20      |
| nav          | 19      |
| comp         | 16      |
| clip-skeptic | 11      |
| **all**      | 154     |

### By kind

| kind                          | records |
| ----------------------------- | ------- |
| clipboard + onChange count    | 84      |
| onChange count + value (HTML) | 30      |
| clipboard                     | 23      |
| value (HTML)                  | 10      |
| clipboard + value (HTML)      | 7       |

### Lens by kind

| lens         | clipboard + onChange count | onChange count + value (HTML) | clipboard | value (HTML) | clipboard + value (HTML) |
| ------------ | -------------------------- | ----------------------------- | --------- | ------------ | ------------------------ |
| clip         | 84                         | 0                             | 4         | 0            | 0                        |
| hist         | 0                          | 10                            | 7         | 3            | 0                        |
| nav          | 0                          | 5                             | 1         | 6            | 7                        |
| comp         | 0                          | 15                            | 0         | 1            | 0                        |
| clip-skeptic | 0                          | 0                             | 11        | 0            | 0                        |

### Field names that differ (a record counts under each)

`calls` 114, `plain` 99, `write` 29, `last` 27, `after` 18, `clip` 8, `text/html` 7, `text/plain` 7

### By probe file

`clip/zzv15-clip-x` 88, `nav/zzv15-nav-w1` 19, `clip-skeptic/zzv15-clip-skeptic-main` 11, `comp/zzv15-comp-k` 8, `hist/zzv15-hist-k` 8, `hist/zzv15-hist-a` 7, `hist/zzv15-hist-p` 5, `comp/zzv15-comp-f` 4, `comp/zzv15-comp-e` 2, `comp/zzv15-comp-c` 1, `comp/zzv15-comp-x` 1
