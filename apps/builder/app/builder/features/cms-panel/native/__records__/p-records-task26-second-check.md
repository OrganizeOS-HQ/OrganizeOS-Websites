# Task 26: the second comparison's check (T79.7 to T79.10, T82)

The check T79 owes of R1's second comparison (`p-records-task26-second.md`, data `acceptance/second/`): R1 at
`a3bc7d8` (the same code as `d20016d`) against `<base>` `2a96a45`. The data, the checkers and how to run them
again are in `acceptance/second/check/` (its README). The six records of T79.2 to T79.6 are measured by the
other agent and are not here. T79.4's second record (`g4|compose|TQT|Q1w@1..T2w@1|'a\nb'`) is one of the
1,652 and is left open for that measurement.

## Headline

- **T79.7, the 1,652 records: every one is checked, and the data says how** (`outcomes-1652.jsonl.gz`).
  - **1,579 by way (1)**, a program check of the rule's own relation on R1's side (12 relations, below).
  - **0 by way (2).** The branch's tests and grid cells pin their values by shape name and cell, and no
    program here matched a record to a cell for the same stored shape, caret and action.
  - **53 by way (3)**, read against the rule's sentence one by one. No group read was used: up to the names
    of their words the 1,652 records form 1,633 groups.
  - **19 P records** (P-S1-1 to P-S1-19), with both builds' values.
  - **1 open**: T79.4's own record. Its values equal the base's, and its count is T79.4's measurement.
  - The "the head loses or reorders" records (123 of T79.7's 132 are in the 1,652) and the 33 "the head
    leaves an empty block" now each rest on R1's side: 122 and 31 by a relation on R1's write, 1 and 2 read,
    none a P record. The other 9 of the 132 changed since the acceptance run and were checked against their
    fix's ruled value in the second comparison (`read-by-hand.json`).
- **T79.8, probes.**
  - **19,912** of the 22,078 records compared at both builds are unchanged at both builds since the
    acceptance run (10,924 equal, 8,988 different). They stand on the first check's reading.
  - (i) The 2,082 fields that changed at R1 since `0ae275f` make 1,347 records:
    - 948 timing fields only;
    - 149 defects 4 and 5, 70 defect 7, 75 defect 1, 12 defect 6 and 4 defect 12, each against the fix's
      ruled value;
    - 29 now equal to the base;
    - 40 the probes' own instrumentation;
    - 6 read and explained;
    - **15 P records** (P-S2-1, 14 cells; P-S2-2).
  - (ii) The 574 one-side records. `keys-i3fwda` (350) and `keys-i3real` (181) are R1-now-only: their
    `0ae275f` runs did not finish, and R1's now do. `keys-i3bb` is the one file with fewer records at R1 now
    (480 against 513). Re-run twice at `d20016d` it finishes with 513 both times, and every missing record
    equals `0ae275f`'s. **No P record.**
  - (iii) The 20,844 records with no base counterpart are 20,811 of R1's and 33 of the base's. Of R1's,
    **10,076 pass their lens's own invariant, 10,714 have none, and 21 hold a failing field**: the cell
    forces 11 of the failures, the probe's own hook causes 8, and 2 are unchanged since `0ae275f`.
- **T79.9:** the IME form of Z2-O-rule-keys, three runs each of `'a'` and `'abc'` at both builds. Lexical's
  selection and the page's are the same at both builds after the click, after each of the five presses, after
  the composition and after the letter. The values are the same too. Measurement 17 is closed for all its
  records.
- **T79.10:**
  - T75 and T78.1 are held by the branch's tests, not by the record sets.
  - The counts above are given as checked, with the three ways apart.
  - The base hang list is `acceptance/second/check/base-hangs.md`: the 44 record-set hangs, and 29 probe files
    whose base run ends without a test summary, 17 of them at the 600 s kill.
- **The coordinator's questions:**
  - Q1: the 31 flags are D7-equal at R1, and none is a P record.
  - Q2: the 939 records are mounts that are read-only at both builds, the same set at both.
  - Q3: the flags are explained in `acceptance/second/README.md`.

## T79.7: the 1,652 records

### Counts by way and relation

| way | relation  | records | rule the relation states                                                                  |
| --- | --------- | ------- | ----------------------------------------------------------------------------------------- |
| 1   | `R-RM`    | 540     | D3's four cases, D5, D9, D19, 5.4, D16: Backspace and Delete, at a caret and over a range |
| 1   | `R-BTR`   | 314     | D2 by line over a range; the head's conversion for ordinary items (D1)                    |
| 1   | `R-DIV`   | 194     | 5.7's Divider row (T2's split up to the root), T10.8                                      |
| 1   | `R-BT`    | 164     | D2 and D13 at a caret, T45.12's P7, map 2's T6, T45.4                                     |
| 1   | `R-INS`   | 117     | D18, 5.4 and D5, D19, the Enter rows: a letter, text, a composition, a line break, Enter  |
| 1   | `R-IMG`   | 55      | T41.2, T43.2, T13.1, D18 / 16.28                                                          |
| 1   | `R-CLICK` | 43      | K9, T14, T73.1                                                                            |
| 1   | `R-PASTE` | 43      | D14, D4, 5.4, D5, D15's paste over a selected rule                                        |
| 1   | `R-LIST`  | 29      | D2: the list buttons act on the line's item                                               |
| 1   | `R-CUT`   | 28      | D6, 5.4                                                                                   |
| 1   | `R-LINK`  | 26      | D10                                                                                       |
| 1   | `R-WALK`  | 26      | K8, T29.2, 16.17, D15, D18 step 1                                                         |
| 3   | read      | 53      | the rule named in each record's row                                                       |
| -   | P record  | 19      | below                                                                                     |
| -   | open      | 1       | T79.4                                                                                     |

Each relation is stated in full in the check's README; each checker is a script there. The two relations the
ruling offered are used as given, with two additions the records needed:

- Block type over a range converts every unit the range meets: each line and block of a lined container in
  place, and an ordinary item the head's way.
- The Divider row's "nothing else moved" is checked as "removing the rule and joining the containers split
  around it gives the stored value", which is T2's split up to the root.

By the old label (for the record; no record is explained by its label):

| label (short)                                    | records | way 1 | way 3 | P   | open |
| ------------------------------------------------ | ------- | ----- | ----- | --- | ---- |
| D3, D5, D9, D19 and 5.4 by class                 | 330     | 330   | 0     | 0   | 0    |
| D2 Block type in place by class                  | 282     | 276   | 2     | 4   | 0    |
| 5.7 Divider row                                  | 208     | 193   | 3     | 12  | 0    |
| D3's second to fourth case, D18, D19, Enter rows | 194     | 194   | 0     | 0   | 0    |
| D1's bar, the head loses or reorders             | 123     | 122   | 1     | 0   | 0    |
| D2 with map 2                                    | 58      | 58    | 0     | 0   | 0    |
| D18 / 5.7 clicks                                 | 43      | 43    | 0     | 0   | 0    |
| D13                                              | 42      | 42    | 0     | 0   | 0    |
| D2 P7                                            | 41      | 40    | 1     | 0   | 0    |
| 5.7 QL row                                       | 41      | 41    | 0     | 0   | 0    |
| D1's bar, the head leaves an empty block         | 33      | 31    | 2     | 0   | 0    |
| walks                                            | 25      | 25    | 0     | 0   | 0    |
| the other 25 labels                              | 232     | 184   | 44    | 3   | 1    |

### Read against the rule (way 3, 53)

Each of these records' rows names its rule. In short:

- **18 with a rule node-selected.**
  - Divider, Block type, list off, Link and Backspace give the head's result. For the first four that is
    nothing, by the head's own guards: Lexical 0.21's HorizontalRulePlugin and `removeList` act on a range
    selection only, the base field's `setBlockType` returns for any other selection, and D10 covers Link.
  - Image goes to the document's end. The base writes the same with the same node selection.
  - A paste or a drop with the rule selected changes nothing at both builds.
  - The letter lands directly after the rule (D15).
- **6 clicks just below a rule.** T73.1: the base's H2, Quote and Link at `Nw@0` set by code equal R1's
  writes.
- **12 equal to the base's write with the same caret or range** (D1): Quote over a quote's lines, list off over
  a range and in a nested list, Link over a range ending in a code block, three input events with no write,
  and a cut of everything.
- **17 against D3, D5, D9, D16, D18 step 1 and T67.2:** joins and removals by key and by input event, and
  compositions with their counts.

### P records (19)

The candidate results are R1's write and the head's write at R1's caret. The record does not hold the head's
write in any of the 19: in every one but P-S1-17 to P-S1-19 the base's click left no caret or another caret,
and in those three the base's value before the action differs. Both builds' steps are in
`outcomes-1652.jsonl.gz`.

- **Divider, 12 records.** R1 puts the rule away from the caret or leaves an empty item. T73.1's 14 cells do
  not include Divider.
  - At a line's end or at the empty line at an item's end, R1 puts the rule before the item: P-S1-1
    `A3::ul-d1|RT|liEnd|Dv`, P-S1-5 `B::ul-d1|QBR|liEnd|Dv`, P-S1-11 `B::ul-d1|QTR|liEnd|Dv`, P-S1-14
    `D::ul-d2|CR|liEnd|Dv` and P-S1-16 `D::ul-d2|RT|liEnd|Dv`. For example (`RT`):
    - stored: `<ul><li>Pw</li><li><hr />T1w</li><li>Nw</li></ul>`;
    - R1's caret: `T1w@3`;
    - R1: `<ul><li>Pw</li></ul><hr /><ul><li><hr />T1w</li><li>Nw</li></ul>`;
    - base, from `listitem[1]@element:0`: `<ul><li>Pw</li><li></li></ul><hr /><ul><li><hr />T1w</li><li>Nw</li></ul>`.
  - At `Pw@end`, an ordinary item, R1 writes an empty list and puts the rule before `Pw`: P-S1-3
    `B::ul-d1|QBR|Pw@end|Dv` and P-S1-9 `B::ul-d1|QTR|Pw@end|Dv`. R1 writes
    `<ul></ul><hr /><ul><li>Pw</li>…`. The base's click left no caret, and it writes
    `<ul><li></li></ul><hr /><ul><li>Pw</li>…`.
  - At `Nw@0`, which a click just below the rule also leaves, R1 leaves `<li></li>` before the rule: P-S1-2
    `B::ul-d1|QBR|Nw@0|Dv`, P-S1-6 `B::ul-d1|QBR|ruleClick|Dv`, P-S1-8 `B::ul-d1|QTR|Nw@0|Dv`, P-S1-12
    `B::ul-d1|QTR|ruleClick|Dv` and P-S1-15 `D::ul-d2|CR|ruleClick|Dv` (a nested item). For example, R1
    writes `<ul><li>Pw</li><li><blockquote><p>Q0w</p></blockquote><br /><hr /></li><li></li></ul><hr /><ul><li>Nw</li></ul>`.
- **Quote over a range that starts in a quote's paragraph of a lined item, 4 records.** R1 writes nothing and
  fires no onChange, while Quote from `Pw` over the same shapes nests the quote. The base's click left no
  caret, so its range starts at `Pw@0` and it quotes `Pw`, the item's quote and `Nw`. The records are P-S1-4
  `B::ul-d1|QBR|Q0w->Nw|Qt`, P-S1-7 `B::ul-d1|QBR|whole|Qt`, P-S1-10 `B::ul-d1|QTR|Q0w->T1w|Qt` and P-S1-13
  `B::ul-d1|QTR|whole|Qt`.
- **A cut and the paste back, 2 records.** The cut is 5.4's removal. The paste is D14's head path at a caret,
  and the head's write at that caret is not in the record.
  - P-S1-17 `p4::C11 block-led run->next`: R1's paste writes items `t`, `1q`, `n1q`; the base writes `t`,
    `1q`, `n`, `1q` from its own cut.
  - P-S1-18 `p4::C3 TQT text->block`: R1's cut writes `<ul><li>xq<br />yq</li></ul>`; its paste writes
    `<ul><li>xq</li></ul><blockquote><p>qq<br />yq</p></blockquote>`.
- **Enter in an emptied line at an item's end, 1 record.** P-S1-19 `g3::g3|emptyLine-enter|QT|Bksp3Enter`:
  three Backspaces empty `T1w`, then Enter writes `<ul><li><blockquote><p>Q0w</p></blockquote></li><li></li><li>Nw</li></ul>`.
  The base writes `<ul><li><blockquote><p>Q0w</p><p></p></blockquote></li><li>Nw</li></ul>`: its Backspaces
  left the caret in the quote.

## T79.8: the probes

### Unchanged at both builds

Of the 22,078 records the comparison holds at both builds, 19,912 are unchanged at both builds since the
acceptance run: the base now equals the acceptance base, and R1 now equals R1 at `0ae275f`. Pcmp's
normalisation applies, with its timing keys dropped. Of the 19,912, 10,924 are equal and 8,988 differ base
against R1. They stand on the first check's reading. The other 2,166 changed at one build or both.

### (i) Changed at R1 since `0ae275f` (`probes-changed-since-0ae275f.jsonl.gz`)

The 2,082 differing fields are 1,347 records. A record is a cell for the keys, nav and insert lenses, and a
record file for the others.

| class                 | records | check                                                                                                                                                          |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| timing only           | 948     | every differing field is a duration                                                                                                                            |
| defects 4 and 5       | 149     | `bwd` heading cells: 0 calls, no write (T59.2, T63)                                                                                                            |
| defect 1              | 75      | text/plain now starts with the new line between the block and the line (F7, T65.1), equal to the base where the base ran; the nav-w1 cut walks' stops the same |
| defect 7              | 70      | the composition-start character only: no R1 value holds U+200B                                                                                                 |
| now equal to the base | 29      | the record is not in the base-against-R1 differences                                                                                                           |
| instrumentation       | 40      | the serialised state's length, the clipboard call lists, a stack line number                                                                                   |
| defect 6              | 12      | the last value equal; the calls now the forward twin's (T63, T67.2)                                                                                            |
| defect 12             | 4       | insert zzq1 B QA: undo keeps the earlier edit, redo restores the join                                                                                          |
| read, explained       | 6       | 5 comp records, defect 6 and the rest equal to the base; in clip-x, 25 fields are defect 1's and `4b-real\|Q#76` is 5.4's emptied rule                         |
| **P record**          | 15      | P-S2-1, P-S2-2                                                                                                                                                 |

- **P-S2-1** (`keys-i1code`, the 14 `code|…|plain` cells) changed at R1 with no fix that names it. A plain-text
  paste over a range that ends in the inline code of a lined item lands outside the code now and inside it
  at `0ae275f`. For `code|BLend|next|fwd|plain`:
  - R1 now: `…T1w<code>Cw</code>Zq2w…`;
  - R1 at `0ae275f`: `…T1w<code>CwZq</code>2w…`;
  - base: `…T1w<code>Cw</code><blockquote><p>Zq2w</p></blockquote>…`.
- **P-S2-2** (`clip-x` `4b-real|P#72`, ordinary content `<p>A0w</p><hr /><p>B2w</p>`) changed at R1 since
  `0ae275f`:
  - R1 now: the cut writes nothing to the clipboard (text/plain `null`), makes no call and leaves the value
    as it was;
  - R1 at `0ae275f`: text/plain `"\n\nB"`, value `<p>A0w</p><p></p><hr /><p>B2w</p>`;
  - base: text/plain `"\n\n\nB"`, the same value as `0ae275f`'s.

### (ii) One side only between the two R1 runs (`probes-one-side-0ae275f.json`)

| file                       | records | side           | reason                                                                                                                                                                                                                                                          |
| -------------------------- | ------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys/zzv15-keys-i3fwda`   | 350     | R1 now only    | the `0ae275f` run did not finish (no test summary, 280 of 630 records); R1 now finishes with 630, every `0ae275f` record present                                                                                                                                |
| `keys/zzv15-keys-i3real`   | 181     | R1 now only    | the `0ae275f` run did not finish (no test summary, 200 of 381); R1 now finishes with 381                                                                                                                                                                        |
| `keys/zzv15-keys-i3bb`     | 33      | `0ae275f` only | R1 now holds fewer (480 against 513). Re-run twice at `d20016d`: 513 records both times, every key of `0ae275f`'s, the 33 equal to `0ae275f`'s and the 480 equal to the second run's (`i3bb-rerun.json`). The second run's file was short; it is not a P record |
| `keys/zzv15-keys-i3bwdb`   | 4       | R1 now only    | both runs passed; R1 now records the four `bwd\|R\|para\|contentStart\|…\|lineB` cells more and holds every `0ae275f` record                                                                                                                                    |
| `insert/zzq1-a-BQA-rerun`  | 4       | `0ae275f` only | a re-run file made only in the acceptance run (defect 12's check); the second run ran each probe file once                                                                                                                                                      |
| `insert/zzq1-a-TAGS-rerun` | 2       | `0ae275f` only | as above                                                                                                                                                                                                                                                        |

### (iii) No base counterpart (`probes-r1-only-invariant.json`)

The 20,844 records are 20,811 that R1 holds and the base does not, and 33 that the base holds and R1 does not
(30 nav-w2 walks and 3 clip records, whose keys differ between the builds). Each of R1's 20,811 was read for
its lens's own invariant fields: `inv`, `redoOk`, `undoRestores`, `undoBack`, `pasteRestores`, `fixedPoint`,
`errors` and `thrown`.

| lens  | pass  | no invariant of its own | a failing field |
| ----- | ----- | ----------------------- | --------------- |
| keys  | 9940  | 0                       | 8               |
| clip  | 25    | 10152                   | 11              |
| comp  | 58    | 464                     | 0               |
| hist  | 12    | 98                      | 2               |
| nav   | 30    | 0                       | 0               |
| code  | 11    | 0                       | 0               |
| total | 10076 | 10714                   | 21              |

The 21:

- 4 `clip-x` group 3 `refusedCut` cells (`undoBack` false). A refused cut makes no undo step.
- 7 `clip-x` group 6 `scratchThrow` cells (`errors`): the writer is forced to throw, and the field writes
  text/plain only (D6).
- 8 `keys-i6` `cutRefused` cells (`thrown`). The probe sets `lineSpike.cutCheckFails`, the prototype's
  test-only hook that D17 removed, so the probe's own step throws.
- 2 `hist-a` and `hist-ab` `A2-two-noop-then-range-delete` logs. They carry an error counter of 1 from the
  range delete on, the same at `0ae275f`.

## T79.9: Z2-O-rule-keys, IME form (`m17-ime.json`)

The run used the hist kit's `compose` and the lens's own record step, which reads Lexical's selection (`sel`)
and the page's (`dom`) at every mark. The stored value is `<p>A0w</p><hr><p>B1w</p>`. The steps are a click at
`A0w@1`, then Shift held over five ArrowRight presses, a mark after each press, the composition (`'a'` or
`'abc'`), and `k`. There were 3 runs per text at each build: 6 tests, all passed at both builds.

- **Both selections, after every step, are the same at both builds in all 12 runs.** After press 3 Lexical's
  focus is `B1w@0` and the page's is the paragraph's element point `p@0`, at both builds.
- The composed and final values are the same at both builds: `<p>Aaw</p>` then `<p>Aakw</p>`, and
  `<p>Aabcw</p>` then `<p>Aabckw</p>`.

## T79.10

- T75 (the second Shift+Home before a leading image) and T78.1 (Shift+Home from `U1w@0`) are held by the
  branch's tests. The record sets do not hold them.
- The counts are given as checked, with T79.7's three ways apart (above).
- The base hang list is `acceptance/second/check/base-hangs.md`:
  - the 44 record-set records that hung at the base;
  - the 29 probe files whose base run ends without a test summary: 17 at the 600 s kill, 9 ended by the stall
    watchdog, and 3 that do not start at the base (exit 1 within 3 s: `keys-i6`, `keys-i6p`, `clip-copy`).

## The coordinator's questions

- **Q1 (the `undo` and `redo` flags at R1 only).** `SP/acceptance/compare.py`, `flags_engine`, lines 102 to
  107, sets them:
  - `undo`: the first `cmp` step's note has neither `html` nor `state` true;
  - `redo`: the same for the second `cmp` step.
  - `state` is `JSON.stringify(editor.getEditorState().toJSON())` compared as a string with the snapshot. No
    `direction` and no empty line is left out, so it is stricter than D7.

  The 30 keys and gap-fill records were re-run at both builds with each `cmp` note also giving D7's equality
  and the first raw difference (`q1-undo-redo-rerun.json`). At R1 all 30 are D7-equal with the same caret
  after undo and after redo, and the first raw difference is always `"direction":null` against `"ltr"`. The
  31st, `p4::C4 TQT block->text`, is a clipboard engine record whose first `cmp` compares the paste with the
  value before the cut, not an undo. Its undo and redo comparisons all pass at R1, and the base hangs. **No
  P record.**

- **Q2 (939 "not run, skipped at mount").** The stored value mounts read-only (the engine returns
  `skipped: "read-only"` when no editable surface mounts; D8: the read-only answers do not change). The set
  is the same at both builds:
  - keys-phase-1: 892 (k1 491, k2 235, k0 95, k3 71);
  - keys-phase-2: 44 (n1);
  - gap-fill: 3.
- **Q3 (the flags).** One line each is in `acceptance/second/README.md`, section "Flags".

## T82's additions (T82.3 item 2, T82.4, T82.5)

### T82.3 item 2: `undo-vs-base.jsonl` against the main run's comparison notes (`undo-vs-base-check.json`)

- **What the two values are.** A `cmps` entry is `[phase, snapshot, html-or-state, state]`
  (`SP/second/scripts/lib2.py`, `engine_fields`, lines 212 to 215).
  - The third value is the note's `html` where the engine records one, which is the toolbar and gap-fill
    engines' check that the page's sanitised HTML equals the snapshot's. Where the engine records none (the
    keys engines), it is the note's `state`.
  - The fourth value is the note's `state`.
  - The note's `caret` is not in the entry. Reading the two values as state and caret gives the 185
    disagreements: `B::ul-d1|QBR|liEnd|UL`'s R1 note is html true, state false, caret true, and the file
    gives R1 `[true, false]`, which is html and state.
- **Which run made them.** The second comparison's main run: the same records in `SP/second/sets/*/out/`.
  Recomputing every entry from those records gives the file's value in all 10,080 entries.
- **Whether r1Flags' `undo` and `redo` come from the file.** They do not. `compare.flags_engine` (lines 102
  to 107) reads the same notes directly from the record's trace. It applies the same test
  (`html`, else `state`) to the record's first and second `cmp` step.
- **The file's R1 failures, D7-diffed.** The file gives R1 a false value in 195 entries of 194 records.
  - 30 are the Q1 re-run above, all D7-equal.
  - 7 are T82.3 item 1's toolbar records, left to the other agent.
  - The other 157 were re-run at R1 (`d20016d`) through each set's own engine, patched so that every
    `cmp` note also gives D7's equality: `editorState.toJSON()` before the action and at the comparison,
    with every `direction` and every empty line left out (`toJSON` holds no node keys). The note also gives
    the first raw difference and the first D7 difference (`q2drive.py`, `q2-d7-rerun.json`).
  - **152 are D7-equal at every comparison**, with the caret the same.
  - **2 clipboard `k2` records** (`K11 H only elem0 / hr`, `/ ul`) were read from the clipboard engine's own
    `diff` note: the first raw difference is `"direction":null` against `"ltr"`. Their full D7 equality was
    not measured.
  - **3 gap-fill `g3` multi-key records** (`adj|TQT|Q1w whole Bksp x2`, `emptyLine-enter|QT|Bksp3Enter`,
    `emptyLine-k|QT|Bksp3k`) are not D7-equal after their record's single undo. Their action holds two or
    three edits that change the value, and T67.1 rules that many undos. Re-run with four undos (T67.1,
    `../g3-per-edit.json`), the last undo restores the value before at both builds. The one-undo comparison is
    not D7's test for them. They stand under T67.1, and **no D7 defect** is found.

### T82.4: the 23 label corrections (`labels-t82.jsonl.gz`)

The corrections are applied after the classifier's 14 as K1 to K23 (`t82_labels.py`); the values stand.
154 records changed label:

| correction | records | old label → new label (short)                                                              |
| ---------- | ------- | ------------------------------------------------------------------------------------------ |
| K1         | 45      | D2 list buttons → D13 with T71.2 and T65.3 (T70.5 for a ruleClick before a leading rule)   |
| K2         | 1       | p4 C13: D1's bar / D7 → D1's emptied entry (T62.5)                                         |
| K3         | 2       | g5 blockNoRefocus REFI, ROOT → D1's focus entry                                            |
| K4         | 6       | g4 compose REFI/REFP/ROOT T0w@1 → F12 with 15.2; T67.2 and the composition-start entry     |
| K5         | 2       | g4 compose ROOT afterRule → the composition-start entry (T67.2, T72.2)                     |
| K6         | 1       | g5 blur QTR → group 11 at the base's click; 5.3's stop on the rule (T80.1)                 |
| K7         | 2       | g4 compose QTR afterRule → T80.1                                                           |
| K8         | 1       | g4 replace QTR T1w → T80.2                                                                 |
| K9         | 1       | g4 compose TQT Q1w@1 'a\nb' → T80.3                                                        |
| K10        | 3       | g6 I1root-q, I2li, I5root-p drag → T80.4                                                   |
| K11        | 2       | g5 undo5 QT, g6 I1root-q click P → T56.1, T56.2                                            |
| K12        | 12      | toolbar Bold over a range → group 11 at the base's shift-click; 5.4 and D5 (T55.4)         |
| K13        | 9       | k3 TCB, THB, TQB → D3's third case with T68.1                                              |
| K14        | 16      | n2 rightQ k and BS → T70.11 with T76.2                                                     |
| K15        | 10      | n2 QBR liEnd k and 9 afterBr0 equal-write records → D1's same caret; D13 for liEnd         |
| K16        | 1       | n2 top-QrTB afterBr0 ins \n\n → D1's bar with T70.9 measurement 14 (low confidence)        |
| K17        | 4       | paste-sweeps B dlim → D1's emptied entry (5.4)                                             |
| K18        | 3       | k3 TRL walk Right; k2 QQR, QTR walk Left → T29.2; group 11 with T29.1 and T29.2            |
| K19        | 5       | paste-sweeps E (no join) → T56.3 to T56.5                                                  |
| K20        | 3       | g6 click Del → F2 (D1's fourth entry)                                                      |
| K21        | 1       | R r-C Pw->C0w Im → the seventh entry as T43.2 restates it                                  |
| K22        | 15      | letter after redo, not confirmed → D3's third case (R1's letter leaves one line break)     |
| K23        | 9       | 8 D18 walk-Left records → 5.3's node stop on ArrowLeft; k3 TBQ walk Left → D1's same caret |

- The four that concern ordinary content are K2 with K17 (the emptied entry), K3 (the focus entry), K4 (F12
  with T67.2) and K20 (F2).
- 34 of the 154 are in the 1,652: 30 are confirmed by a program relation and 4 are read. A new label changes
  none of T79.7's outcomes.

### T82.5

T60.3's number from the record sets is 0 (T82.5). The coordinating session's program checks of T82.2 agree
with this check where they overlap:

- no R1 write reorders content;
- a Backspace or Delete at a caret removes at most one character, rule or image (`R-RM`'s first clause);
- focus is kept in 1,206 records;
- the 213 new shapes are fixed points and reopen editable;
- measurement 17's selections are equal at both builds.

They are cross-checks only. T79.7's ways are counted per record above.
