# Task 20: P records

Measured on the Task 20 branch (from 648a272) and at `<base>` (SP/r1-base, 2a96a45, rich-text project); "the carry" is 648a272 before Task 20's change. Values are `short()`; `T(x)` is `<ul><li>Pw</li><li>T0w<blockquote><p>Q1w</p></blockquote>x</li><li>Nw</li></ul>`. Nothing here is pinned in a test except where a line says so.

## P20-1: the onChange counts of a cancelled composition (M62a, M62b, M62c; 16.10)

- Stored: `<p>Pw</p><p>T0w</p>`. Place: `Pw@2`, a letter, `T0w@1`, quiet. Action: `imeCancel("empty" | "commit" | "escape")`.
- `<base>` (M62a, M62b, M62c): 4, 4 and 2 onChanges; the first repeats the value before the composition (`<p>Pwk</p><p>T0w</p>`), the end repeats the one before it.
- Branch: 2 (`<p>Pwk</p><p>Ta0w</p>`, `<p>Pwk</p><p>T0w</p>`), 2, and 1 (`<p>Pwk</p><p>Ta0w</p>`). Under CDP, Escape does not end the page's composition: the field is still composing after it, and M62c's one undo is an undo during the composition (15.1), equal to `<base>`'s.
- The task's "the onChange calls of the cancel equal M62a's, M62b's or M62c's calls" counts repeats that 16.10 forbids. Pinned: no value repeats the one before it, the value as it stood (empty, commit), `afterUndo` from the record, no console error.

## P20-2: 15.1, redo during a written composition

- Stored: `TQT` = `LI(T0w<blockquote><p>Q1w</p></blockquote>T2w)`. Place: `T2w@end`, `k`, `x`, Ctrl+Z, quiet. Action: `imeSetComposition("a")`, Ctrl+Y, `imeSetComposition("ab")`, `insertText("ab")`; then four Ctrl+Z and four Ctrl+Y, the value after each.
- `<base>`: after `T(T2wab)`; presses `T(T2wab)` x4, then `T(T2wkx)` x4.
- Branch, and the carry before Task 20: after `T(T2wab)`; presses `T(T2w)` x4, then `T(T2wab)` x4.
- The other three 15.1 cells (undo during a written or cancelled composition, redo during a cancelled one) equal `<base>` press for press and are pinned. This one pins the value after the composition only. Candidates: (a) the branch's (an undo after the composition takes it back, as for any composition voided by 15.1 at the carry); (b) `<base>`'s (undo does nothing, redo brings back the state the redo during the composition gave, dropping the composed text).

## P20-3: a cancelled composition at the start of a paragraph led by a link (ordinary content)

- Stored: `<p>Pw</p><p><a href="https://example.org/">Lw</a> T1w</p>`. Place: `Lw@0`, a letter (`<p>k<a>Lw</a> T1w</p>`), Ctrl+Z (one entry on the redo stack). Action: `imeSetComposition("a")`, `imeSetComposition("")`, `insertText("")`; then Ctrl+Y.
- `<base>` and branch alike: the composition writes nothing (`imeSetComposition("a")` changes no value), and Lexical stays composing after the cancel (`editor.isComposing()` is true, also after a real click on `Pw`), so it takes no key: Ctrl+Y does nothing.
- Pinned (16.1's ordinary link-led cell): the value as it stood and both stacks as before. Ctrl+Y is not asserted in this cell. The lined cell (the field's move before the link, 5.3) passes in full.

## P20-4: 16.20's mechanism (sent before it is relied on; information)

- A composition over a backward range composes as over the forward range: at the page's `compositionstart`, before Lexical's own handler, `registerLineInputListener`'s handler swaps the range's ends (a point move in a discrete update, no tag; `composeForward` in `rich-text-line-node-selection.ts`), then `rememberCompositionStart` takes the state before.
- Effect: Chrome composes over the forward page selection, which covers Lexical's start character, so the composed text lands where the forward range puts it, once. `<p><strong>A0w</strong>B1w</p>`, `B1w@1`, Shift+ArrowLeft x3, `ime("ab")`: `<base>` and the carry `<p><b><strong>A</strong></b>aab1w</p>` (`abab` at the carry); branch `<p><b><strong>Aab</strong></b>1w</p>`, equal to the forward range by real keys (`A0w@1`, Shift+ArrowRight x3) in value, next letter, undo and redo.
- The state before the composition is taken before the swap, and a written composition's one step holds that state, so an undo restores the range as the person made it (backward): `rich-text-line-readback.test.tsx`'s three `IT-Home-ime` cells (Shift+Home to a leading image) check the caret after undo through `recordEdit`.

## P20-5: "the same pause before the first composed character": how the start is made

- The input-method interface (`Input.imeSetComposition` with empty text) starts no composition: no `compositionstart`, the editor does not compose. The test dispatches the page's `compositionstart` on the editable itself (Lexical starts composing; asserted), waits 1,100 ms, then composes through the interface. Written and cancelled pass with the ruled sequences.

## P20-6: check 3's two cancelled cells: the plan's numbers and check 4, 15.2

- The task's eight cells give "pending format and nothing 3, 3, 3" and "element point and nothing 4, 4, 4" (check 3's head column). Check 4, 15.2 ruled later that a cancelled composition leaves the history exactly as it was, including these two cells ("one rule instead of three kept oddities"). Pinned per check 4: 1, 1, 1 and 2, 2, 2 (the letter's step; the letter's and Enter's). The check wins (Process); reported here.

## P20-7: an edit that leaves the document unchanged makes no undo step (16.10's second contract; built)

- P16-1 (FS0 at the root, a paste of `<hr>` over a node-selected rule): after the change handler compared values there was no onChange, but the history plugin still pushed a step (`undoDepth` 0 to 1). Built in `rich-text-line-history.ts` (`unchangedEditListener`): outside a composition, a commit whose document equals the one before under D7 and for which the history plugin pushed a step has that step taken back, and the redo stack the push emptied put back. It applies to every edit outside a composition, not to the paste only. Pinned in FS0 (no onChange, `undoDepth` unchanged).

## P20-8: the kit's net test, re-based (Task 20 Step 2)

- "the net fails on a composition-start character a composition left": the removal built here removes the character, so the test now holds the removal with `forcedFailure("start-char-kept")`. With it held, the net reports two failures, not one: the composition-start count, and "no onChange, but the document changed since mount", since the field hands out no value that holds the character (16.21). The test asserts exactly one composition-start failure and that the other is that one.

## P20-9: the two-field cells under a module-level composition state (Task 20 Step 2b)

- Scratch: the per-editor map of the remembered composition replaced by one module-level value. "check 3's eight cells" with two fields (two tests), the two interleaved tests and Task 12's two two-field tests (`rich-text-line-point-check.test.tsx`) all pass. The four composition tests are retitled "control: ...". Task 12's two tests guard the point check's own per-editor state, not this map, and keep their titles.

## P20-10: the value handed out last before the first onChange, and 93 tests on main (a question)

- 16.10's first contract compares a value with the one the field handed out last. Before the first onChange none was handed out. Built: the value handed out last is then the stored one (the HTML the field opened with; no value when none was stored). This is what P16-1 (FS0, the first edit after mount: no onChange) and T26.2 (`setEditorState` with a stray empty line right after mount: no onChange) need.
- Consequence: 93 tests of `rich-text-field.test.tsx` (on main) fail. Each mounts a value and then commits an update that changes nothing (`$getRoot().markDirty()`, the file's `rewrite()`), and reads the value the field writes: the fixture tables "the live field writes the fixture's editor HTML for %s" (44) and "the live field writes what the headless editor writes for %s" (47), "an image-only value is never null", and "Bold and a link applied inside a code block do not stay ..." (its last read follows a change the field takes back). The field now hands out nothing there (the value equals the stored one). Not rewritten (tests on main).
- `<base>`: those tests pass (the field hands out the value of every commit that dirties a node).
- Candidates: (a) as built: the stored value counts as handed out at mount; P16-1 and T26.2 hold; the 93 tests on main fail until ruled. (b) nothing counts as handed out before the first onChange (16.10 read literally): the 93 pass; FS0 and T26.2's first commit hand out one value equal to the stored one (the tests pinned for P16-1 and T26.2 then fail). No third reading separates the two: each is a first commit that changes nothing under D7.

## P20-11: two checks that assumed every document change reaches onChange (16.10; changed)

- The watch (`rich-text-field-watch.ts`): a field that handed out nothing was held to its document as mounted under D7. Four cells of the removal class sweep (`text` and `inline code`, both ends element points, ordinary, forward and backward, Enter) leave the value as it stood and change only the second paragraph's `textFormat` (1 to 0), so the field hands out nothing (16.10) and the watch failed them. Changed: a field that handed out nothing holds its value (its HTML) as mounted. The four cells pass. The history keeps an undo step for that Enter (its document differs under D7); no test asserts it.
- `rich-text-line-cells-1510-checks.ts`, "the key after Backspace over the range": the check compared the last onChange of the key over the range with that of the key after Backspace. In four cells (`R|list|br|para|end|1|shiftEnter`, `R|list|br|none|end|1|shiftEnter`, `R|quote|br|para|end|1|shiftEnter`, `R|quote|br|none|end|1|shiftEnter`) Shift+Enter over the range leaves the value as stored (the removal takes the item's last line break and Shift+Enter puts one back), so it hands out nothing (16.10), while the oracle hands out the same value after Backspace changed it. Changed: the check compares the values both leave (`Record1510.value`, the value as it stands after the action, added to `runCell1510`). The four cells then differ from their fixture cells (`<base>` hands out one value equal to the stored one; the branch none): `differenceOf` names them with a new class, "the head hands out the value as it stood (16.10)" (the head's write equals the value the branch leaves, and the branch hands out nothing); the snapshots `rich-text-line-grid-1510-list.json` and `-quote.json` gain those four names and nothing else.

# Task 20b: P records (P20-12 onward)

Measured on the Task 20b branch (from 2477904) and at `<base>` (SP/r1-base, 2a96a45, project core-browser-builder-cms-rich-text, ordinary content, the kit copied in as scratch and removed afterwards). Values are `short()`. Nothing here is pinned in a test except where a line says so.

## P20-12: the cells T42.1 (candidate (b)) changed (information)

- Built: before the first onChange of a mounted field nothing has been handed out; the first value after mount is handed out even where it equals the stored one; only repeats of the value handed out last are withheld. The 250 tests of `rich-text-field.test.tsx` (the 93 included) pass, file untouched.
- FS0 at the root (P16-1) and T26.2's stray-empty-line `setEditorState`: pinned in both forms (first action: one onChange with the value as it stood; after an equal value was handed out by a `$getRoot().markDirty()` commit: none; both: undo depth unchanged).
- No lined no-op key cell tested as a first action gave an onChange (lines project files all pass; grids run: the four 1510 files and the two removal files). No per-case fix was needed.
- Three composition cells changed count, each a composition as the first action after mount: `F12: one Ctrl+Z after a composition in an ordinary paragraph` (`<p>Pw</p><p>T0w</p><p>Nw</p>`, `T0w@1`, `ime("a")`), `a composition at QR@1 is inserted once` (`LI(<blockquote><p>Q0w</p></blockquote><hr>)`, `itemPoint(1, 1)`, `ime("a")`) and `16.10: no onChange with an unchanged value at a composition's end` (`<p>Pw</p><p>T0w</p>`, `T0w@1`, `a`, `ab`, `abc`). Each now hands out the stored value at the composition's start (Lexical's `compositionstart` sets the composition key, which dirties the text node; the value is unchanged and nothing was handed out before), then the composed value: F12 `<p>Pw</p><p>T0w</p><p>Nw</p>`, `<p>Pw</p><p>Ta0w</p><p>Nw</p>`; QR@1 the stored list, then `...<p>Q0wa</p>...`. Pinned: calls 2 (F12, QR@1); the 16.10 cell pins value 1 = the value as it stood, no later repeat. `<base>` hands out the same first value (P20-1: its first value repeats the one before the composition).
- Kit: "imageButton returns when the insert writes nothing" pins again the carry's one onChange with `<p>Aw</p>`; "the net fails on a composition-start character a composition left": the second failure is now "last onChange ... is not the editor's export" (the field handed out `<p>Aw</p>` at the composition's start), not "no onChange, but the document changed".
- P20-11 under (b): the four 1510 Shift+Enter cells hand out one value equal to the stored one, as the head does: their names left the snapshots (`rich-text-line-grid-1510-list.json`, `-quote.json` are again as before Task 20), and the class "the head hands out the value as it stood (16.10)" named nothing and is removed. The watch change and the value comparison in the check stay (T42.7).

## P20-13: T42.4, the P20-3 cancel followed by a letter and an arrow key (measurement)

- Stored: ordinary `<p>Pw</p><p><a href="https://example.org/">Lw</a> T1w</p>`; lined (branch only) `LI(<blockquote><p>Q0w</p></blockquote><a href="https://example.org/">Lw</a>)`. Place: `Lw@0` by a real click, a letter `k` (`<p>Pw</p><p>k<a>Lw</a> T1w</p>`; lined `...</blockquote>k<a>Lw</a>...`), Ctrl+Z, quiet. Action: `imeSetComposition("a")`, `imeSetComposition("")`, `insertText("")`; then the letter `k`; then ArrowRight.
- How observed: a capture `keydown`/`beforeinput`/`compositionstart`/`compositionend` listener on the editable logging `event.isComposing` and `editor.isComposing()`, and an update listener logging each commit's tags, dirty node count and `editor.isComposing()`. The field's while-composing steps (the page read-back `pageMoved`, `beforeKeyOrEdit`'s composing branch, the kept lines' removal at the commit that ends a composition, the point check after a commit) all branch on `editor.isComposing()`, so the editor's composing state at the key's capture and at its commit says which branch they take.
- `<base>`, ordinary: after the cancel `<p>Pw</p><p><a>Lw</a> T1w</p>`, `isComposing()` true; no `compositionend` fired (the page saw `compositionstart`, one `insertCompositionText`, nothing more). After `k`: value `<p>Pw</p><p><a>Lw</a> T1w</p>` (nothing written, 0 onChange), `isComposing()` true (keydown `isComposing` false, `beforeinput(insertText)` with the editor composing, one commit with 0 dirty nodes). After ArrowRight: same value, `isComposing()` true, a commit with 0 dirty nodes.
- Branch, ordinary: identical to `<base>` in every line of the log: after the cancel, after `k` and after ArrowRight the value is `<p>Pw</p><p><a>Lw</a> T1w</p>`, 0 onChange, `isComposing()` true at each key's capture and at each commit. So the field's steps keep taking their while-composing branch after the letter and after the arrow: no read-back, no kept-line removal, the point check held; the end-of-composition steps never run, since no commit ends the composition.
- Branch, lined: the cancel ends (`compositionend` fires, then commits with `isComposing()` false); value after the cancel `...</blockquote><a>Lw</a>...`, `isComposing()` false; after `k` `...</blockquote>k<a>Lw</a>...` (1 onChange, that value), `isComposing()` false; after ArrowRight the same value, `isComposing()` false, no further onChange.
- So the editor stays composing through a non-composition key in the ordinary cell at both builds (T42.4's "defect" case). Nothing built; the P20-3 cell is left as it is.

## P20-14: T42.9, Image over a range with no code block (measurement)

- The toolbar's real Image control through the kit's `imageButton` (a file chosen in the field's input, the kit's upload), the range set by `range()`, as the T41 cells insert.
- `<p>A0w</p>`, `A0w@1..A0w@3`: `<base>` 1 onChange, `<p>A<img /></p>`; branch 1 onChange, `<p>A<img /></p>`.
- `<p>Pw</p><p>Nw</p>`, `Pw@1..Nw@1`: `<base>` 1 onChange, `<p>P<img />w</p>`; branch 1 onChange, `<p>P<img />w</p>`.
- `<base>` replaces the range in both cells, and the branch writes the same.
- The three T41.2 cells are unpinned (record and print, assert no value): on the branch now `Pw@1..C1w@1` `<p>P<img />1w</p><p>Nw</p>`, `C1w@1..Nw@1` `<p>Pw</p><pre><code>Cw</code></pre><p><img /></p>`, `C1w@0..C1w@3` `<p>Pw</p><pre><code></code></pre><p><img /></p><p>Nw</p>`, 1 onChange each.
