# Task 10 P records and plan conflicts

## P10-1 (plan vs spec 5.8): "an empty caret line goes when the caret leaves", left by a click

- Stored: `LI(T0w<hr>)` = `<ul><li>Pw</li><li>T0w<hr></li><li>Nw</li></ul>`.
- Place: `itemPoint(1, 2)` (an empty caret line after the rule holds the caret).
- Action: `at("Nw")` (a real click).
- Plan (Task 10 Step 1): after the click the middle item holds no (empty) `cms-line`; no onChange.
- Spec 5.8's caret-line row (and check 5, 16.23; T11.13): "a line the caret left by a press is not removed by that press: it goes at the next key in the field ... Accepted cost: an empty line the person clicked out of stays visible until the next key or edit."
- Carry (bubble click listener, held step synchronous at the click): the page's selectionchange of a quick click often arrives after the click's end, so the line went as at a key; a slow press kept it. The result depended on event order.
- Branch (capture click, held step in the next task, the page's selection read back at the press's end): the line is kept after the click, deterministically; it goes at the next key (ArrowLeft); no onChange either way.
- `<base>`: no lines (no caret line exists), not comparable.
- Test as written: the click keeps the line (1 empty line, caret `text:Nw@2`), then ArrowLeft removes it, no onChange. Candidate A (plan): gone after the click. Candidate B (spec, built): kept until the next key. The spec wins per the plan's Process; please confirm.

- Same cause, an existing branch test (Task 8): `rich-text-line-layout.test.tsx`, "the one break of an empty caret line is drawn", measured the item's height right after `at("Nw")` (49 px against 25 on the branch: the line kept). Changed to `at("Nw")` then ArrowLeft before the measure (one added key; the kept line goes at the key). Revert if candidate A is ruled.

## P10-2 (setting a state fires an onChange)

- "the sweep looks only where the caret was": `editor.setEditorState(parseEditorState(json))` with one stray empty `cms-line` appended to the first item fires one onChange on the branch (seen with Task 10's code; the stored value is unchanged, so it may be a D19 shape). The test clears the spy after that set and asserts no onChange for the click and the ArrowRight only. Not pinned.

## Merge note (builder): P10-1 also decides Task 9's "the caret leaving the emptied line removes it"

After merging Task 10 onto Task 9's fixes, Task 9's test "P9-2: the caret leaving the emptied line removes it, with no onChange" (a real click into Pw, then expects no empty line) fails: the line stays after the click, as Task 10 built spec 5.8 ("an empty line the person clicked out of stays visible" until the next key). If P10-1 is ruled for spec 5.8, that test gains one key after the click (as Task 10 did for Task 8's layout test); if for the plan, Task 10's press rule changes and both pass as written.
