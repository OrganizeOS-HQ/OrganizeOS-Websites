# Task 26: T82.3 measurements (items 1, 3 to 7)

R1 is fork `97cefe8` (the native field's code is `a3bc7d8`'s), detached in worktree
`/home/user/OrganizeOS-Websites/.claude/worktrees/agent-aa453daa95e66e327`. The base is `SP/r1-base` (`2a96a45`).
Rulings: `SP/rulings-t82.md` (T82, T79.6, T52.1), spec D1, D7 and 5.7. The second check's report: `SP/acceptance-check-2.md`.

How the runs were made:

- Every run went through `SP/t82/drive.sh` under `timeout -s KILL 600`.
- The engines used are the record sets' own: toolbar and keys-phase-2 (item 1); keys-phase-2 with one added read-only step,
  `wordRect` (item 4, `SP/t82/mkkp2.py`); the clipboard engine with its `cut` step handing out the full clipboard
  (item 7, `SP/t82/clipkit`); and T79.6's control kit, `SP/six/mk.py` built unchanged into `SP/t82/sixkit` (items 3, 5, 6 and 7).
- Batches: `SP/t82/b*.json`, made by `SP/t82/gen*.py`. Raw data: `SP/t82/out/<side>-<batch>/records.json`. Readers:
  `SP/t82/an1.py`, `tally3.py`, `tally4.py` and `tally56.py`.
- 13 runs, 179 scenarios. None hung, none threw, and there were no console errors.
- The load average across the runs was 0.6 to 2.6 with the other agents running.
- No code was changed and nothing was committed. The probe directories are removed and the worktree is clean. The
  base's untracked `zzt80/` and `zz13base.log` were there before.

## 1. The 9 records: R1's state comparison after undo fails and the base's passes

**The harness's `state`.** It is a raw string comparison with nothing normalised:

- Definition: `stateOf = () => JSON.stringify(editorOf()!.getEditorState().toJSON())`, in
  `SP/acceptance/sets/toolbar/src/harness.tsx:283-284`; keys-phase-2's `harness.tsx:283-284` is identical.
- The `cmp` step: `state: snap?.state === stateOf()`, in toolbar `engine.tsx:872-875` and keys-phase-2 `engine.tsx:850-855`.
- It does not drop `direction` and it does not drop empty lines. Node keys are not in `toJSON()`, so they are never compared.

**Setup.** Each record ran with its own steps and `["dump"]` added after `snap m`, after `snap post` and after the undo. The
batch was the 7 toolbar records plus QTR liEnd Dv, which passes, as a control (`b1-toolbar.json`), and the 2 n2 records
(`b1-n2.json`). It ran once per build.

**R1.** In all 9, `toJSON()` after undo differs from `toJSON()` before the action in `direction` only:

| records                                              | the one difference (before -> after undo)                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| QBR liEnd Dv, H2, OL, Qt, UL; n2 QBR liEnd BS, Enter | `root.list[0].listitem[1].direction`: `null` -> `"ltr"`                                                     |
| QBR liEnd Im                                         | the same, plus `listitem[1].cms-line[3].direction` (the empty caret line after the rule): `null` -> `"ltr"` |
| QTR liEnd Im                                         | `listitem[1].cms-line[3].direction`: `null` -> `"ltr"`                                                      |

- With every `direction` left out, the two states are deep-equal in all 9.
- The empty lines need not be left out: they are equal once `direction` is gone.
- Nothing else differs: no line is split or merged, no break has moved and no node type has changed.
- The `cmp` caret is `true` in all 9. The control (QTR liEnd Dv) is equal raw.

The state before the action holds the item at `direction: null`. In QBR the item's text-bearing lines are a quote and a
line that holds only a line break.

**The base.** It passes raw in all 9. Its item holds `quote, linebreak, horizontalrule` with no lines, and is `ltr` both before
and after undo.

**Cause.** The `"ltr"` is written by Lexical's reconciler: `reconcileBlockDirection`, `lexical@0.21.0/Lexical.dev.js:2093-2136`
(`writableNode.__dir = direction` at 2136), when the undo's commit reconciles the item and the line. The field sets a
direction only when it converts a heading or reads a stored line (`rich-text-html.ts:611`, `rich-text-line-node.ts:133`,
`rich-text-line-removal.ts:380,406`), and none of these runs here. This is T52.1's case.

**Outcome: the records stand.** The difference is only what D7 leaves out (`direction`). The harness's state check must apply
D7's normalisation:

- leave out every `direction` key (that alone settles these 9);
- also leave out every empty line, as D7 says;
- node keys are already absent.

## 3. clip-d rec-18, rec-19, rec-34, rec-35: T79.6's control

**Setup.**

- The value mounted is R1's `afterCut` from the second run (`SP/second/probes/out/r1/clip/zzv15-clip-d/zzv15-clip-rec-N.json`):
  - rec-18 and rec-19: `<p>A0w</p><p><br />2w</p>`;
  - rec-34 and rec-35: `<ul><li>Pw</li><li>U0w<img .../>w</li></ul>`.
- The caret is set by code at R1's `caretAfterCut`: `"2w"@0`, and `"w"@0` (`text[2]`).
- The paste is R1's own cut clipboard (`cutRaw`) with the namespace set to the live editor's. Two forms were pasted: all three
  types, and text/plain with text/html. Each form ran 3 times per build (`b3.json`, 24 scenarios per build).

**Values.**

- rec-18 and rec-19 (clipboard `<p></p><p>B</p>`): the base writes `<p>A0w</p><p></p><p></p><p>B2w</p>` in 12 of 12 runs.
  That is R1's `afterPaste` exactly, with 1 onChange, the caret at `B2w@1` and `k` giving `Bk2w`.
- rec-34 and rec-35 (clipboard `<ul><li></li><li>N</li></ul>`): the base writes
  `<ul><li>Pw</li><li>U0w<img .../></li><li></li><li>Nw</li></ul>` in 12 of 12 runs. That is R1's `afterPaste` exactly, with
  1 onChange, the caret at `Nw@1` and `k` giving `Nkw`.
- R1 gives the same in 24 of 24. Every value is a fixed point and reopens editable.

**Outcome: the base gives R1's `afterPaste`, so the paste is the head's (D14).** The four records join rec-2 and rec-3 in the
"Known, not fixed" list under section 7's pasted trailing shell row, as R3's. No P record.

Noted for the owner, as the head's: in rec-18 and rec-19 the paste back also drops the line break that the cut kept. `<p><br />2w</p>`
becomes `<p></p>...<p>B2w</p>` at both builds.

## 4. n3 g11 click records: the press point against the word's rect

**Setup.**

- The 5 records ran with their own steps, plus `wordRect` before the click. `wordRect` measures the press point that
  `clickWord` uses (`wordPoint`, keys-phase-2 `engine.tsx:254-279`), the word's text range rect, each character's rect,
  `caretRangeFromPoint` at the press point, and `elementFromPoint`.
- The ordinary twins ran with no node selected, at both builds: `<ul><li>Pw</li><li>Q0w</li><li>Nw</li></ul>`,
  `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>Nw</p>` and `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote></li><li>Nw</li></ul>`.
- Each case ran 3 times per build (`b4.json`).

**The press point.**

- `wordPoint` is called without an offset, so it aims at the word's end. Its x is clamped to `box.width - 1`, which puts the
  press 1.00 px left of the word's right edge in every case (`pressMinusWordRight = -1`).
- That point is inside the last character's rect, 1 px from its right edge, in that character's right half:
  - `Pw`: the `w` spans 31.72 to 41.61 and the press is at 40.61;
  - `Q0w`: the `w` spans 50.86 to 60.75 and the press is at 59.75.
- `elementFromPoint` is the word's span. The browser's own `caretRangeFromPoint` at that point is `Pw@2` and `Q0w@3`, the
  word's end, at both builds.

**Values.**

| case                                        | R1                                                | base                                         |
| ------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| the 5 records (rule node-selected at mount) | Pw@2, Q0w@3, 15 of 15; `k` writes `Pwk` or `Q0wk` | no selection 15 of 15 (K9); `k` writes `kPw` |
| the twins, no node selected (Pw, Q0w)       | Pw@2, Q0w@3, 18 of 18                             | Pw@2, Q0w@3, 18 of 18; the same writes as R1 |

**Outcome: the records stand.** The press addresses the word's end:

- the browser resolves it there;
- the same press on each ordinary twin puts the caret there at both builds.

R1's offset equals the twins' at both builds, off by 0, so it is D1's listed click ("puts the caret where clicked"). One point
for the coordinating session: by pixels the press lies 1 px inside the word's rect, not past it. By caret it is the word's end.

## 5. n2 QL rightQ DEL and QQ rightQ DEL: Delete at Q0w@3 set by code

**Setup.** The caret is set by code at `Q0w@3` (`caretCode`), then Delete, undo, redo and `k`. Each case ran 3 times per build
(`b56.json`). The shapes are the two lined records and three root-level ordinary twins.

| shape                                                                                                 | R1                                                                   | base                                                                                |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| QL `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><ul><li>L1w</li></ul></li><li>Nw</li></ul>` | `...<li><blockquote><p>Q0wL1w</p></blockquote></li><li>Nw</li></ul>` | `...<li><blockquote><p>Q0wL1w</p></blockquote></li><li></li><li>Nw</li></ul>`       |
| QQ `...<li><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote></li>...`            | `...<li><blockquote><p>Q0wQ1w</p></blockquote></li>...`              | `...<li><blockquote><p>Q0wQ1w</p></blockquote><blockquote></blockquote></li>...`    |
| twin `<p>Pw</p><blockquote><p>Q0w</p></blockquote><ul><li>L1w</li></ul><p>Nw</p>`                     | `<p>Pw</p><blockquote><p>Q0wL1w</p></blockquote><p>Nw</p>`           | equal to R1                                                                         |
| twin `<p>Pw</p><blockquote><p>Q0w</p></blockquote><blockquote><p>Q1w</p></blockquote><p>Nw</p>`       | `<p>Pw</p><blockquote><p>Q0wQ1w</p></blockquote><p>Nw</p>`           | `<p>Pw</p><blockquote><p>Q0wQ1w</p></blockquote><blockquote></blockquote><p>Nw</p>` |
| twin `<p>Pw</p><blockquote><p>Q0w</p></blockquote><p>L1w</p><p>Nw</p>`                                | `<p>Pw</p><blockquote><p>Q0wL1w</p></blockquote><p>Nw</p>`           | equal to R1                                                                         |

Both builds, every case, 3 of 3:

- the caret after Delete is `Q0wL1w@3` or `Q0wQ1w@3`;
- 1 onChange;
- undo and redo restore (`cmp` state and caret both true);
- `k` lands at offset 3;
- the writes are fixed points and editable.

**Values.**

- At the base, the join pulls the following block's text into Q0w, the same text as R1's. The base then leaves the container it
  emptied: the nested list's item becomes an empty `<li></li>` after the item in QL, and an empty `<blockquote></blockquote>` is
  left in QQ and in its ordinary twin.
- R1 writes the base's value with that emptied container removed.

**Outcome by T82.3's text: the writes differ, so these are 2 P records** (no ruling pins these two writes). Candidates:

- (a) They stand under D1's emptied entry ("Where the head leaves a quote, item or list it emptied ... the build leaves none")
  together with 5.8's F2 row and D3's second case. R1's write is exactly the base's with only the emptied container removed:
  the same text, order, caret, calls, undo and redo. The ordinary QQ twin differs at the base in the same way, which is that
  same listed entry in ordinary content. The QL twin is equal at both builds.
- (b) A separate ruling for the QL item form, where the base's emptied container is an empty item standing after the joined item
  rather than inside it.

## 6. g4|sel|TR|T0w@1+SR3|Enter: the selection after each Shift+ArrowRight

**Setup.** The record's shape is `<ul><li>Pw</li><li>T0w<hr></li><li>Nw</li></ul>`, with a click at T0w@1. The variants
(`b56.json`), each 3 runs per build:

- the three presses with Shift held, split so the selection is read after each press (`split`);
- the record's own single key string, read after it (`asRecord`);
- the split form from a caret set by code (`code`).

Selections are anchor -> focus, Lexical's / the page's:

| after        | R1 (9 of 9)                                                                                              | base (split and code, 6 of 6)                                       |
| ------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| click        | `cms-line[0]/T0w@1` / `T0w@1`                                                                            | `listitem[1]/T0w@1` / `T0w@1`                                       |
| press 1      | `T0w@1 -> T0w@2` / same                                                                                  | `T0w@1 -> T0w@2` / same                                             |
| press 2      | `T0w@1 -> T0w@3` / same                                                                                  | `T0w@1 -> T0w@3` / same                                             |
| press 3      | `T0w@1 -> cms-line[2]@element:0` (the empty line after the rule) / `T0w@1 -> div@0 in li`                | `T0w@1 -> listitem[1]@element:2` (after the rule) / `T0w@1 -> li@2` |
| Enter writes | `<ul><li>Pw</li><li>T</li><li></li><li>Nw</li></ul>`, caret `listitem[2]@element:0`, `k` -> `<li>k</li>` | the same                                                            |

Undo and redo restore at both builds.

In the base's single-string form (`asRecord`) the third press stopped before the rule in 2 of 3 runs (`listitem[1]@element:1`).
There Enter wrote `<li>T</li><li><hr /></li>`. In the third run it took the rule and wrote R1's value. R1's `asRecord` gave its
split result 3 of 3.

**Outcome: the record stands.** The third press takes the rule into the range at R1, and at the base too when the presses are
paced. So `<li>T</li><li></li>` is 5.4's removal of what the range holds, then Enter (5.3 "the field takes the step"; at the
base the browser makes the step itself). The base's variance belongs to its own single-string timing and does not touch R1.

## 7. clipboard p4::C4 TQT block->text (the base hangs in the record)

**R1's values.** The stored value is `<ul><li>xq<blockquote><p>qq</p></blockquote>yq</li></ul>` and the range is `qq@1 -> yq@1`.
The record ran 3 times as is, with dumps added, and 3 times with a synthetic cut that hands the engine its clipboard (`b7a.json`).
All 6 runs are identical:

1. Cut (1 onChange): `<ul><li>xq<blockquote><p>qq</p></blockquote></li></ul>`, caret `qq@1`.
   - The clipboard is text/plain `q\ny`; text/html `<blockquote><p>q</p></blockquote>` then `y`; and the lexical type holding
     `quote(paragraph(q))` and `text y` (`SP/t82/c4-r1-clipboard.json`).
   - The cut removes what the range holds, `q` and `y`, and joins the line's rest `q` into the quote's paragraph.
2. Paste back (2 onChange): `<ul><li>xq<blockquote><p>q</p><blockquote><p>q</p></blockquote><p>yq</p></blockquote></li></ul>`,
   caret `yq@1`.
   - The characters are in their stored order (x q q q y q).
   - The structure nests a quote inside the quote. `cmp b` is false on state, caret and HTML.
3. Undo: the after-cut state (`cmp a` true). Undo: the stored state (`cmp b` true). Redo, redo: the after-cut state, then the
   pasted state (`cmp a`, `cmp c` true). Six onChange in all.
4. The value after the paste back is a fixed point (`fixedPoint: true`), with no read-only reason. Mounted fresh it reopens
   editable 3 of 3: `k` at `yq`'s end and `z` at the first `q` write `...<p>qz</p><blockquote><p>q</p></blockquote><p>yqk</p>...`,
   each a fixed point.

**T79.6's control** (`b7b.json`, 3 runs per form per build, `timeout -s KILL 600`). The base mounted R1's after-cut value with
the caret at `qq@1` set by code, and R1's clipboard was pasted in both forms.

- The base does not hang there: it ran 6 of 6 in about 5 s.
- It writes `<ul><li>xq<blockquote><p>q</p><blockquote><p>q</p></blockquote><p>yq</p></blockquote></li></ul>` in 6 of 6. That is
  R1's value after the paste exactly, with 1 onChange, the caret at `yq@1`, undo and redo restoring, and `k` giving `ykq`.
- R1 gives the same 6 of 6.

The record's hang at the base is at the cut (second run `base-p4.json`, `hungStep` 3). It was not re-run here.

**Outcome: the record stands.** The paste back is the head's path (D14), and the record's base hang is the head's (D1's bar).
R1's value is a fixed point and reopens editable. The nested quote belongs in the "Known, not fixed" list beside the pasted
shell records, as R3's area.

## Summary

| item | outcome                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | stands: the differences are `direction` only (the reconciler's). The harness's `state` check needs D7's normalisation                                      |
| 3    | stands as the head's paste (D14), 24 of 24 at both builds; joins rec-2 and rec-3 in "Known, not fixed" (R3)                                                |
| 4    | stands: the press is in the last character's right half, 1 px inside its rect; it resolves to the word's end, and the twins give R1's caret at both builds |
| 5    | 2 P records by T82.3's letter; candidate (a) is D1's emptied entry (R1 = the base minus its emptied item or quote)                                         |
| 6    | stands: the third press takes the rule into the range at both builds; 5.4 then Enter                                                                       |
| 7    | stands: the base gives R1's paste-back value 6 of 6 without hanging; it is a fixed point and reopens editable                                              |
