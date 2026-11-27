# The second comparison's check (T79.7 to T79.10)

The check of `../` (R1 `a3bc7d8` against `<base>` `2a96a45`) that T79 owes. The report is
`../../../p-records-task26-second-check.md`. `SP` is the session's scratch directory, which holds the raw
outputs of the second comparison (`SP/second/`) and of the acceptance run (`SP/acceptance/`). The scripts read
them there; `scripts/ld.py` and `scripts/common.py` name the paths.

## How to run it again

Without `SP`, run `cd scripts && python3 master.py`. It runs the 12 program checks from this directory alone and
writes `scripts/master.json`, which equals the committed `master.json.gz` (gunzipped; it is gzipped so the formatter leaves its bytes alone). In that case `ld.py` reads these files:

- `lib2.py`, a copy of `SP/second/scripts/lib2.py`, with its stored-value table taken from `lib2-stored.json.gz`;
- `u1652.json.gz`;
- `traces-1652.json.gz`: both builds' records of the 1,652, as `ld.full()` returns them, with every step's caret,
  calls, live value and note.

With `SP` present:
From `scripts/`, with `SP/second/` and `SP/acceptance/` in place and `u1652.json` (the 1,652 records of
`../differences.jsonl.gz` whose `check` is `no-program` or `not confirmed` and that have no `readByHand`) beside
the scripts:

1. `python3 master.py` runs every program check over the 1,652 records and writes `master.json`.
2. `python3 assemble.py <out>` joins it with `reads.py` (the records read by hand) and writes
   `outcomes-1652.jsonl.gz`.
3. `python3 probes_i.py`, `probes_ii.py`, `probes_iii.py`, `probes_same.py` and `i3bb.py` give T79.8's counts.
4. `prun3.sh` and `prun4.sh` are the second run's probe runner (`SP/second/scripts/prun2.sh`) pointed at this
   worktree; `q1patch.py` and `q1drive.py` re-run the 30 records of the coordinator's Q1.

`sheet1.py` prints the read sheet of the records no program check confirms (the input of `reads.py`).

## Files

| file                                    | what                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outcomes-1652.jsonl.gz`                | T79.7: one row per record: `way` (1 program check of the rule's relation on R1's side, 3 read against the rule's sentence; no record is checked the second way), `relation` (the checker), `verdict` (`confirmed`, `read: explained`, `P record`, `open (T79.4)`), `detail`, both builds' writes; for a P record both builds' steps in full |
| `probes-changed-since-0ae275f.jsonl.gz` | T79.8 (i): the 2,082 fields that changed at R1 since `0ae275f`, grouped into 1,347 records, each with its class                                                                                                                                                                                                                             |
| `probes-one-side-0ae275f.json`          | T79.8 (ii): the 574 records on one side only between the two R1 runs, by file and side, with each run's test summary and the reason                                                                                                                                                                                                         |
| `i3bb-rerun.json`                       | T79.8 (ii): `keys-i3bb` re-run twice at `d20016d` (the code of `a3bc7d8`)                                                                                                                                                                                                                                                                   |
| `probes-r1-only-invariant.json`         | T79.8 (iii): the 20,811 records R1 holds and the base does not, read for their lens's own invariant fields; the 21 that hold a failing field                                                                                                                                                                                                |
| `probes-unchanged.json`                 | T79.8: the probe records unchanged at both builds since the acceptance run                                                                                                                                                                                                                                                                  |
| `m17-ime.json`                          | T79.9: Z2-O-rule-keys in the IME form, three runs each of `'a'` and `'abc'` at both builds, Lexical's selection (`sel`) and the page's (`dom`) after the click, each of the five presses, the composition and the letter                                                                                                                    |
| `q1-undo-redo-rerun.json`               | the coordinator's Q1: the 30 records re-run at both builds with each comparison step also giving D7's equality (`d7`) and the first raw difference                                                                                                                                                                                          |
| `base-hangs.md`                         | T79.10: the base's 44 record-set hangs and the 29 probe files whose base run ends without a test summary                                                                                                                                                                                                                                    |
| `undo-vs-base-check.json`               | T82.3 item 2: every `cmps` entry of `../undo-vs-base.jsonl.gz` recomputed from the main run (all 10,080 equal), and the 195 R1 entries with a false value                                                                                                                                                                                   |
| `q2-d7-rerun.json`                      | T82.3 item 2: 157 of those records re-run at R1 with D7 equality at every comparison (`q2drive.py`, the patch is `scripts/d7helper.ts.txt`)                                                                                                                                                                                                 |
| `labels-t82.jsonl.gz`                   | T82.4: the 154 records the 23 label corrections relabel (K1 to K23, `t82_labels.py`): label before and after                                                                                                                                                                                                                                |

## The relations (T79.7, way 1)

Leaves are the characters, rules and images of a value in document order; line breaks and a code block's new
lines are set aside wherever D3 adds or removes one. The caret is the one R1 holds when the action runs (the
trace's caret of the step before it), placed in the stored value through the Lexical path it names.

| relation  | rule                                         | R1's write must be                                                                                                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `R-DIV`   | 5.7's Divider row, T2's split, T10.8         | the stored leaves with one rule added at the caret; removing the rule and joining the containers split around it gives the stored value; no new empty container; the letter typed after undo and redo directly after the rule                                                                                                                          |
| `R-BT`    | D2, D13, T45.12's P7, map 2 T6, T45.4        | at a caret: the stored leaves unchanged; the letter at the caret, inside a new element of the action's tag; unwrapping that element (and the block it replaced) gives the stored value; Quote in a quote of a lined item changes nothing and fires no onChange (T45.4)                                                                                 |
| `R-BTR`   | D2 by line, D1 for ordinary items            | over a range: every unit the range meets converts (in a lined container each line and each block in place, the item and every container above it kept; an ordinary item or a root block the head's way, at the level of the nearest lined container or the root); every other leaf keeps its chain of containers; the letter in a block of the new tag |
| `R-RM`    | D3's four cases, D5, D9, D19, 5.4, D16       | Backspace or Delete at a caret removes at most the one leaf (or line break) beside the caret in its direction and moves nothing else; a join leaves the two leaves that meet in one container; over a range the stored leaves outside it; no emptied container but the one the caret is in (D16); the letter at the place of the edit                  |
| `R-INS`   | D18, 5.4, D5, D14, D19, 5.7's Enter rows     | a letter, inserted or composed text, a line break, Enter or Shift+Enter: the stored leaves before the caret (the range's start), the inserted leaves, the stored leaves after it; no emptied container but Enter's own new paragraph in a quote and the one the caret is in; the letter typed after undo and redo directly after the insert            |
| `R-IMG`   | T41.2, T43.2, T13.1, D18 / 16.28             | as `R-INS` with one image, the image at the caret the removal leaves, or directly after the code block where that caret is in one                                                                                                                                                                                                                      |
| `R-PASTE` | D14, D4, 5.4, D5, D15's paste over a rule    | the range removed first and the pasted content's leaves at its start (with a rule selected, in the rule's place); the next key directly after the pasted content                                                                                                                                                                                       |
| `R-CUT`   | D6, 5.4                                      | the cut removes exactly the range's leaves; nothing emptied left                                                                                                                                                                                                                                                                                       |
| `R-CLICK` | K9, T14, T73.1                               | the click leaves a text caret in the clicked word (a click just below a rule: offset 0 of the next text), and the letter typed there is inserted there and nothing else changes                                                                                                                                                                        |
| `R-LIST`  | D2 (the list buttons act on the line's item) | the other type: every list that directly holds an item the caret or range is in takes the new tag, nothing else changes; list off at a caret: that list taken apart, each item's text and lines a paragraph, each block of a lined item as it was; the letter at the caret                                                                             |
| `R-LINK`  | D10                                          | the leaves unchanged; every character in the range linked; no rule or line break inside a link; nothing outside the range newly linked; unlink restores                                                                                                                                                                                                |
| `R-WALK`  | K8, T29.2, 16.17, D15, D18 step 1            | the walk's stops move one way and no text stop repeats; every letter typed at a stop lands there (at a node-selected rule or image directly after it)                                                                                                                                                                                                  |

Twenty-two `R-INS` records are a composition or input event that neither build writes anything for (line break or
paragraph compositions after a line break); for them the relation checks the unchanged leaves and the letter.

## Flags of `../differences.jsonl.gz` (`baseFlags`, `r1Flags`)

Set by `SP/acceptance/compare.py`, `flags_engine` (lines 79 to 124) for the engine sets and `flags_case`
(lines 127 to 148) for the paste sets:

- `hang`: the record hung (the 40 s stall watchdog, or a second 600 s kill in the same scenario). `crash`: the run crashed in it.
- `slow`: a step took more than 2 s (`ms`), or the paste record's `ms` is over 2 s.
- `err`: a console error during the record that is not React's act warning.
- `ro`: the write's read-only check found a reason (`note.readOnly`, or `reloadReadOnly`).
- `notFixed`: re-importing the write does not give it back (`note.fixedPoint` false, or `reloadHeadless` false).
- `empty`: the write holds `<li></li>`, `<blockquote></blockquote>`, `<p></p>`, an empty heading, `<ul></ul>`, `<ol></ol>`, `<li><br /></li>` or an empty code block (the paste sets: the first four).
- `lost-hr`, `lost-img`, `lost-blockquote`, `lost-pre`, `lost-h3`: the write holds fewer of that tag than the stored value. `reorder`: the stored words the write keeps stand in another order.
- `kNoChange`: the letter typed after redo changed nothing (`typeK` note `changed` false).
- `undo`: the first `cmp` step of the record has neither `html` nor `state` true. `redo`: the same for the second `cmp` step. `state` is `JSON.stringify(editor.getEditorState().toJSON())` compared as a string with the snapshot (the keys engine, `engine.tsx`, the `cmp` step): no `direction` or empty line is left out, so it is stricter than D7. In the clipboard set's engine records the first `cmp` is not always after undo (`p4` compares the paste with the value before the cut first). The paste sets: `undoState` or `undoDom` false gives `undo`, `redoOk` false gives `redo`.
