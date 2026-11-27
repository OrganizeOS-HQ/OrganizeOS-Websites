# Base hangs in the second comparison (`<base>` 2a96a45)

T79.10. R1 (`a3bc7d8`) hangs on none of these. Source: `../base-hangs.json` and `../probes-pcmp-base-r1.json.gz`.

## Record sets: the 44 records that hung at the base

A record hangs when its scenario stalls past the 40 s watchdog, or a run is killed at 600 s twice in it. `hungStep` is the 1-based number of the step it stalled in.

| set          | record                                       | hung in step |
| ------------ | -------------------------------------------- | ------------ |
| toolbar      | `B::ul-d1\|TQT\|Q1w->T2w\|Im`                | 4            |
| toolbar      | `B::ul-d1\|BQT\|whole\|Im`                   | 4            |
| toolbar      | `B::ul-d1\|BQT\|Q1w->T2w\|Im`                | 4            |
| toolbar      | `R::ul-d1\|r-QxLy\|X1w->X2w\|Im`             | 4            |
| toolbar      | `X::ul-d1\|QxLy\|X1w->X2w\|Im`               | 4            |
| clipboard    | `p2::R2 block@0->item text (P10) / p1`       | 3            |
| clipboard    | `p2::R2 block@0->item text (P10) / p2`       | 3            |
| clipboard    | `p2::R2 block@0->item text (P10) / b`        | 3            |
| clipboard    | `p2::R2 block@0->item text (P10) / p2 drop`  | 3            |
| clipboard    | `p2::R2 block@0->item text (P10) / own copy` | 5            |
| clipboard    | `p2::R2b block mid->item text / p1`          | 3            |
| clipboard    | `p2::R2b block mid->item text / p2`          | 3            |
| clipboard    | `p2::R2b block mid->item text / b`           | 3            |
| clipboard    | `p2::R2b block mid->item text / p2 drop`     | 3            |
| clipboard    | `p2::R2b block mid->item text / own copy`    | 5            |
| clipboard    | `p2::R6 ol TQT block->text / p1`             | 3            |
| clipboard    | `p2::R6 ol TQT block->text / p2`             | 3            |
| clipboard    | `p2::R6 ol TQT block->text / b`              | 3            |
| clipboard    | `p2::R6 ol TQT block->text / p2 drop`        | 3            |
| clipboard    | `p2::R6 ol TQT block->text / own copy`       | 5            |
| clipboard    | `p4::C4 TQT block->text`                     | 3            |
| keys-phase-1 | `k1::ul-d1\|BQT\|Q1w@end\|DEL`               | 3            |
| keys-phase-1 | `k1::ul-d1\|BQT\|T2w@start\|BS`              | 3            |
| keys-phase-1 | `k1::ul-d1\|BQT\|R:whole\|BS`                | 4            |
| keys-phase-1 | `k1::ul-d1\|BQT\|R:own T2w->Q1w\|BS`         | 4            |
| keys-phase-1 | `k3::ul-d1\|TQT\|Q1w@end\|DEL`               | 3            |
| keys-phase-1 | `k3::ul-d1\|TQT\|T2w@start\|BS`              | 3            |
| keys-phase-1 | `k3::ul-d1\|TQT\|R:own T2w->Q1w\|BS`         | 4            |
| keys-phase-2 | `n1::ul-d1\|TQTQ\|Q1w@end\|DEL`              | 3            |
| keys-phase-2 | `n1::ul-d1\|TQTQ\|T2w@start\|BS`             | 3            |
| keys-phase-2 | `n1::ul-d1\|TRQT\|Q2w@end\|DEL`              | 3            |
| keys-phase-2 | `n1::ul-d1\|TRQT\|T3w@start\|BS`             | 3            |
| keys-phase-2 | `n1::ul-d1\|TQQT\|Q2w@end\|DEL`              | 3            |
| keys-phase-2 | `n1::ul-d1\|TQQT\|T3w@start\|BS`             | 3            |
| keys-phase-2 | `n1::ul-d1\|BQTB\|Q1w@end\|DEL`              | 3            |
| keys-phase-2 | `n1::ul-d1\|BQTB\|T2w@start\|BS`             | 3            |
| keys-phase-2 | `n2::ul-d1\|TQT\|rightQ\|DEL`                | 4            |
| keys-phase-2 | `n2::ul-d1\|QB\|afterBr0\|ins \n\n`          | 5            |
| keys-phase-2 | `n2::ul-d1\|HTB\|afterBr0\|ins \n\n`         | 5            |
| keys-phase-2 | `n2::top-QpTB\|afterBr0\|ins \n\n`           | 5            |
| keys-phase-2 | `n2::ul-d1\|TQT\|R:own T2w->Q1w\|cutonly`    | 4            |
| keys-phase-2 | `n2::ul-d1\|BQT\|R:whole\|cutonly`           | 4            |
| keys-phase-2 | `n2::ul-d1\|BQT\|R:own T2w->Q1w\|cutonly`    | 4            |
| gap-fill     | `c1::c1\|S1\|Q1w1-T2w2`                      | 4            |

## Probes: the 29 probe files whose base run ends without a test summary

Exit 137 at 600 s is the `timeout -s KILL 600` kill. Exit 0 with no test summary is a run that the stall watchdog ended. Exit 1 within 3 s is a file that does not start at the base. The records these files hold at R1 and not at the base are the 20,811 R1-only records of T79.8 (iii).

| probe file                | base exit | base seconds | records at R1 only |
| ------------------------- | --------- | ------------ | ------------------ |
| `clip/zzv15-clip-copy`    | 1         | 3            | 0                  |
| `clip/zzv15-clip-e`       | 0         | 308          | 10147              |
| `clip/zzv15-clip-x`       | 0         | 177          | 44                 |
| `code/zzv15-code-a`       | 137       | 600          | 11                 |
| `comp/zzv15-comp-a`       | 0         | 50           | 522                |
| `hist/zzv15-hist-a`       | 137       | 600          | 64                 |
| `hist/zzv15-hist-ab`      | 137       | 600          | 48                 |
| `keys/zzv15-keys-i1br`    | 137       | 600          | 1070               |
| `keys/zzv15-keys-i1code`  | 137       | 600          | 1070               |
| `keys/zzv15-keys-i1hr`    | 0         | 344          | 170                |
| `keys/zzv15-keys-i1img`   | 137       | 600          | 1070               |
| `keys/zzv15-keys-i1link`  | 137       | 600          | 1070               |
| `keys/zzv15-keys-i1linkh` | 137       | 600          | 330                |
| `keys/zzv15-keys-i1word`  | 137       | 600          | 330                |
| `keys/zzv15-keys-i3ba`    | 137       | 600          | 364                |
| `keys/zzv15-keys-i3bb`    | 137       | 600          | 240                |
| `keys/zzv15-keys-i3bwda`  | 137       | 600          | 273                |
| `keys/zzv15-keys-i3bwdb`  | 137       | 600          | 364                |
| `keys/zzv15-keys-i3fa`    | 0         | 290          | 600                |
| `keys/zzv15-keys-i3fb`    | 0         | 544          | 430                |
| `keys/zzv15-keys-i3fwda`  | 137       | 600          | 430                |
| `keys/zzv15-keys-i3fwdb`  | 0         | 298          | 600                |
| `keys/zzv15-keys-i3lb`    | 137       | 600          | 8                  |
| `keys/zzv15-keys-i3named` | 0         | 240          | 96                 |
| `keys/zzv15-keys-i3real`  | 137       | 600          | 341                |
| `keys/zzv15-keys-i4bwd`   | 137       | 600          | 364                |
| `keys/zzv15-keys-i4fwd`   | 0         | 424          | 600                |
| `keys/zzv15-keys-i6`      | 1         | 3            | 72                 |
| `keys/zzv15-keys-i6p`     | 1         | 2            | 56                 |
