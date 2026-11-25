# P records, Task 9

## P9-1: a composition at QA el1, undo's caret

- Stored: `LI(<blockquote><p>Q0w</p></blockquote><a href="https://example.org/a">Lw</a>)`
- Place: `itemPoint(1, 1)` (el1). Caret before (branch): `text:Lw@0` (D18 step 1: the line's start, which is the link text's start).
- Action: `ime("a")`, then Ctrl+Z, then Ctrl+Y (the kit's expectEdit).
- `<base>`: M31-QA el1-ime: one onChange with the unchanged value, caret `text:Lw@0` (the composition is lost).
- Branch: write `W(<li><blockquote><p>Q0w</p></blockquote>a<a>Lw</a></li>)`, 3 onChanges, caret `text:a@1`: the ruled write of M31-QA el1-ime (T21). Ctrl+Z restores the value and the state under D7, but the caret after undo is `element:listitem@1` (a point on the line at offset 0), not the caret before (`text:Lw@0`). A second Ctrl+Z changes nothing. So expectEdit's "undo restores the state before" check fails on the caret only.
- T21 says "undo follows F12" for this row. Question: (A) undo after this composition restores the caret before, `text:Lw@0` (F12's undo, Task 20 builds it); or (B) the line's start `element:listitem@1` is the same caret under D1 and D18 (both are the place before the link), and the kit's undo check accepts it for this row.
- The test "a composition at the start of a line led by a link lands before the link (round 9)" is not kept until the ruling (or until Task 20 builds F12's undo).

## Built from rulings (T21), no P record

- P1, P2 and P7-ime: tests written with the ruled write and caret (P7-ime with 3 onChanges, as ruled).
- P26 (F8, "third"): built. A line that a removal empties while it holds the caret keeps the caret: the resolver's C2 give-back (an empty line beside a block gives its point back to the container) now applies only to the caret lines the resolver makes. The points module notes, after each commit, the lines that hold the caret, are empty, and held content in the state before (per editor, `emptiedLines`; a line drops out of the set once it is no longer empty or gone). The write equals the ruling: `<ul><li><blockquote><p>Q0w</p></blockquote>k</li><li>Nw</li></ul>`, caret `text:k@1`, one onChange.

## Noted, pinned (not a P record)

- The composition rows pin 3 onChanges for one `ime("a")`: every composition measured at `<base>` hands out three values (M31's ime rows, M49a to M49c), T21 keeps c3 for composition cells, and the branch gives three.
- V11: the table's place `el1` does not give V11's write on the branch (Backspace at el1 removes the line break: `W(<li><hr /><hr /></li>)`). The check's input, a real click at the first rule's left edge, lands at el2 and gives the check's write and typed letter (`W(<li><br /><hr /></li>)`, typed `W(<li><br />k<hr /></li>)`). The test uses the check's click.
