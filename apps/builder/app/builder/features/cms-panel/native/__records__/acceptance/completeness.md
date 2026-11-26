# Record sets: completeness (base 2a96a45 against R1 0ae275f)

Counted from `SP/acceptance/sets/<set>/out/{base,head}-<batch>.json` and `gen/batch-<batch>.json`. Every batch is compared afresh with `compare.py`'s own field rules (`sig_engine`, `sig_case`); nothing under `acceptance/` is written. "Scenarios generated" is the length of the batch file the run was driven from. "Saved diff" is the count in the saved `cmp.json` the acceptance report used.

| set              | batch | scenarios generated    | records base | records R1 | compared | equal | different | missing-base | missing-r1 | saved diff |
| ---------------- | ----- | ---------------------- | ------------ | ---------- | -------- | ----- | --------- | ------------ | ---------- | ---------- |
| toolbar          | A0    | 772                    | 772          | 772        | 772      | 485   | 287       | 0            | 0          | 287        |
| toolbar          | A1    | 772                    | 772          | 772        | 772      | 489   | 283       | 0            | 0          | 283        |
| toolbar          | A2    | 772                    | 772          | 772        | 772      | 474   | 298       | 0            | 0          | 298        |
| toolbar          | A3    | 770                    | 770          | 770        | 770      | 414   | 356       | 0            | 0          | 356        |
| toolbar          | B     | 1278                   | 1278         | 1278       | 1278     | 757   | 521       | 0            | 0          | 521        |
| toolbar          | D     | 1458                   | 1458         | 1458       | 1458     | 1296  | 162       | 0            | 0          | 162        |
| toolbar          | R     | 1092                   | 1092         | 1092       | 1092     | 821   | 271       | 0            | 0          | 271        |
| toolbar          | X     | 1232                   | 1232         | 1232       | 1232     | 820   | 412       | 0            | 0          | 412        |
| **toolbar**      | all   | 8146                   | 8146         | 8146       | 8146     | 5556  | 2590      | 0            | 0          | 2590       |
| clipboard        | k1    | 110                    | 110          | 110        | 110      | 110   | 0         | 0            | 0          | 0          |
| clipboard        | k2    | 141                    | 141          | 141        | 141      | 129   | 12        | 0            | 0          | 12         |
| clipboard        | p2    | 104                    | 104          | 104        | 104      | 61    | 43        | 0            | 0          | 43         |
| clipboard        | p3    | 285                    | 285          | 285        | 285      | 264   | 21        | 0            | 0          | 21         |
| clipboard        | p4    | 45                     | 45           | 45         | 45       | 32    | 13        | 0            | 0          | 13         |
| clipboard        | p5    | 16                     | 16           | 16         | 16       | 16    | 0         | 0            | 0          | 0          |
| clipboard        | p6    | 70                     | 70           | 70         | 70       | 69    | 1         | 0            | 0          | 1          |
| clipboard        | rf    | 60                     | 60           | 60         | 60       | 60    | 0         | 0            | 0          | 0          |
| **clipboard**    | all   | 831                    | 831          | 831        | 831      | 741   | 90        | 0            | 0          | 90         |
| keys-phase-1     | k0    | 923                    | 923          | 923        | 923      | 742   | 181       | 0            | 0          | 181        |
| keys-phase-1     | k1    | 923                    | 923          | 923        | 923      | 812   | 111       | 0            | 0          | 111        |
| keys-phase-1     | k2    | 923                    | 923          | 923        | 923      | 645   | 278       | 0            | 0          | 278        |
| keys-phase-1     | k3    | 919                    | 919          | 919        | 919      | 695   | 224       | 0            | 0          | 0          |
| **keys-phase-1** | all   | 3688                   | 3688         | 3688       | 3688     | 2894  | 794       | 0            | 0          | 570        |
| keys-phase-2     | g     | 320                    | 320          | 320        | 320      | 289   | 31        | 0            | 0          | 31         |
| keys-phase-2     | n1    | 256                    | 256          | 256        | 256      | 182   | 74        | 0            | 0          | 74         |
| keys-phase-2     | n2    | 380                    | 380          | 380        | 380      | 177   | 203       | 0            | 0          | 203        |
| keys-phase-2     | n3    | 74                     | 74           | 74         | 74       | 29    | 45        | 0            | 0          | 45         |
| **keys-phase-2** | all   | 1030                   | 1030         | 1030       | 1030     | 677   | 353       | 0            | 0          | 353        |
| gap-fill         | c1    | 13                     | 13           | 13         | 13       | 6     | 7         | 0            | 0          | 7          |
| gap-fill         | c2    | 40                     | 40           | 40         | 40       | 40    | 0         | 0            | 0          | 0          |
| gap-fill         | g1    | 67                     | 67           | 67         | 67       | 64    | 3         | 0            | 0          | 3          |
| gap-fill         | g3    | 29                     | 29           | 29         | 29       | 12    | 17        | 0            | 0          | 17         |
| gap-fill         | g4    | 187                    | 187          | 187        | 187      | 86    | 101       | 0            | 0          | 101        |
| gap-fill         | g5    | 23                     | 23           | 23         | 23       | 7     | 16        | 0            | 0          | 16         |
| gap-fill         | g6    | 186                    | 186          | 186        | 186      | 131   | 55        | 0            | 0          | 55         |
| **gap-fill**     | all   | 545                    | 545          | 545        | 545      | 346   | 199       | 0            | 0          | 199        |
| paste-matrix     | M     | 1972                   | 1972         | 1972       | 1972     | 1816  | 156       | 0            | 0          | 156        |
| **paste-matrix** | all   | 1972                   | 1972         | 1972       | 1972     | 1816  | 156       | 0            | 0          | 156        |
| paste-sweeps     | A     | 1296                   | 1296         | 1296       | 1296     | 1296  | 0         | 0            | 0          | 0          |
| paste-sweeps     | B     | 1825 (batch file 2500) | 1825         | 1825       | 1825     | 1761  | 64        | 0            | 0          | 64         |
| paste-sweeps     | C     | 80                     | 80           | 80         | 80       | 80    | 0         | 0            | 0          | 0          |
| paste-sweeps     | E     | 64                     | 64           | 64         | 64       | 59    | 5         | 0            | 0          | 5          |
| **paste-sweeps** | all   | 3265                   | 3265         | 3265       | 3265     | 3196  | 69        | 0            | 0          | 69         |
| **total**        |       | 19477                  | 19477        | 19477      | 19477    | 15226 | 4251      | 0            | 0          | 4027       |

Results (all checked by the script `t55-b/scripts/completeness.py`):

- **Records: 19,477 at each build, all 19,477 compared.** The total matches the acceptance report's 19,477.
- **Equal 15,226, different 4,251.** The report counted 4,027 different and 14,531 equal: 919 fewer records than there are. The whole gap is `keys-phase-1` batch `k3`.
  - Its saved `cmp.json` was written at 11:27:27, before `base-k3.json` was finished (11:32), so its 919 records show as "missing-base" there.
  - Compared now, k3 has 695 equal and 224 different.
  - 4,027 + 224 = 4,251, and 14,531 + 695 = 15,226.
  - The report's row reads `keys-phase-1` 3,688 records, 2,199 equal, 570 different. It should read 2,894 equal, 794 different.
- **missing-base and missing-r1: none.** Every record id is present at both builds in every batch, and no id repeats within a batch.
- **By class: 838** records carry `byClass: true`.
  - 790 in `record-set-differences.jsonl.gz`: toolbar 429, clipboard 20, keys-phase-1 143, keys-phase-2 167, gap-fill 31.
  - 48 in `record-set-differences-keys-phase-1-k3.jsonl.gz`.
  - Verified by reading both files: 4,251 lines, 838 marked.
- **"Scenarios generated"** is the length of the batch file each run was driven from (`gen/batch-<b>.json`). The paste sets are different.
  - There, the batch file is only a list of empty slots sized for the driver (`{"id": "B#0", "html": ""}` ...). The adapter (`src/adapter.tsx` `runAll`) runs its own case array, `A`, `B`, `C` from `zzr10-beh-w-cases.ts` or the 8 edits x 8 cases of `E`, so record ids do not match the slot ids.
  - The generated count shown for those sets is the adapter's `jobs.length`. Each run ended normally ("1 passed") with records `i` = 0..N-1 contiguous.
  - Only sweeps `B` differs from its slot file: 1,825 cases against 2,500 slots, so the 675 extra slots were never cases.
  - With the paste sets counted that way, scenarios generated = records = 19,477.
- **What the generators could not produce** is listed in `r1-acceptance.md` section 1 and is not in these counts: keys-phase-1 is the 3,688-scenario reconstruction, keys-phase-2 has no `n0`, gap-fill has no `tR`/`tR2`/`tB`/`cl`, and toolbar has A, X, R, B plus the extra D.
