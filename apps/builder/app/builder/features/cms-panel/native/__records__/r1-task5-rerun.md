# Task 5 re-run (after the review)

Kit: `r1-task5` 89e8c44, "the kit's Block type driver hands keys back to the editor". The measure file (`rich-text-line-measure.test.tsx`) now writes one record per row as it ends, records `fixedPoint` for every write, `afterUndo`/`caretAfterUndo` when undo does not restore, asserts M20a's `<br`, and merges into the one combined output (test "merge"). Runner: `t5-measure-run.py` (100 s idle watchdog per run; a frozen row is recorded `hang`; a failed row ends its run and the next run resumes after it). Per-row records: `t5-run-data/v2/`; the earlier ones: `t5-run-data/v1/`.

Every row was run again at both builds (767 at `<base>`, 767 at the carry), not only the rows the review named. Compared with the first measurement on write, calls, caret, typed, undo, redo, clipboard, hang, failed, errors and the 2,000 ms flag:

- head M: 45 ids changed, all Block type rows (the action is a Block type option):
  - typed and undo (undo now restores): 27: M18a, M18b, M31-AQ el1-Code, M31-AQ el1-Heading 2, M31-AQ el1-Quote, M31-QB el1-Code, M31-QB el1-Heading 2, M31-TC@1-Code, M31-TC@1-Heading 2, M31-TC@1-Quote, M31-TH@1-Code, M31-TH@1-Heading 2, M31-TH@1-Quote, M31-TQ@1-Code, M31-TQ@1-Heading 2, M31-TQ@1-Quote, M31-TQT el1-Code, M31-TQT el1-Heading 2, M31-TQT el1-Quote, M31-TQT el2-Code, M31-TQT el2-Heading 2, M31-TQT el2-Quote, M31-root el1-Code, M31-root el1-Heading 2, M31-root el1-Paragraph, M7a, M7b
  - typed only (the write is none, or undo already held): 18: M19b, M31-AQ el1-Paragraph, M31-QA el1-Code, M31-QA el1-Heading 2, M31-QA el1-Paragraph, M31-QA el1-Quote, M31-QB el1-Paragraph, M31-QB el1-Quote, M31-QT@1-Code, M31-QT@1-Heading 2, M31-QT@1-Paragraph, M31-QT@1-Quote, M31-TC@1-Paragraph, M31-TH@1-Paragraph, M31-TQ@1-Paragraph, M31-TQT el1-Paragraph, M31-TQT el2-Paragraph, M31-root el1-Quote
- base P: 8 ids changed, all Block type rows (the action is a Block type option):
  - typed and undo (undo now restores): 6: P1, P2, P6, P7-Code, P7-Heading 2, P7-Quote
  - typed only (the write is none, or undo already held): 2: P7-Paragraph, P9
- carry M: 45 ids changed, all Block type rows (the action is a Block type option):
  - typed and undo (undo now restores): 32: M18a, M18b, M31-AQ el1-Code, M31-AQ el1-Heading 2, M31-AQ el1-Quote, M31-QA el1-Code, M31-QA el1-Heading 2, M31-QA el1-Quote, M31-QB el1-Code, M31-QB el1-Heading 2, M31-QT@1-Code, M31-QT@1-Heading 2, M31-QT@1-Quote, M31-TC@1-Code, M31-TC@1-Heading 2, M31-TC@1-Quote, M31-TH@1-Code, M31-TH@1-Heading 2, M31-TH@1-Quote, M31-TQ@1-Code, M31-TQ@1-Heading 2, M31-TQ@1-Quote, M31-TQT el1-Code, M31-TQT el1-Heading 2, M31-TQT el1-Quote, M31-TQT el2-Code, M31-TQT el2-Heading 2, M31-TQT el2-Quote, M31-root el1-Code, M31-root el1-Heading 2, M31-root el1-Paragraph, M7b
  - typed only (the write is none, or undo already held): 13: M19b, M31-AQ el1-Paragraph, M31-QA el1-Paragraph, M31-QB el1-Paragraph, M31-QB el1-Quote, M31-QT@1-Paragraph, M31-TC@1-Paragraph, M31-TH@1-Paragraph, M31-TQ@1-Paragraph, M31-TQT el1-Paragraph, M31-TQT el2-Paragraph, M31-root el1-Quote, M7a
- carry P: 8 ids changed, all Block type rows (the action is a Block type option):
  - typed and undo (undo now restores): 6: P1, P2, P6, P7-Code, P7-Heading 2, P7-Quote
  - typed only (the write is none, or undo already held): 2: P7-Paragraph, P9

No other id changed at either build. Hangs at `<base>` are the same six cells (M31-TQT el2 Backspace, Ctrl+Backspace, lineBack; P18, P19, P23), each run under the idle watchdog this time; M13a and P17 again end on the 20 s watchdog. Nothing hangs at the carry.

The six rows re-measured for their undo flag (head):

- M31-TQ@1-Enter: undo False (unchanged); after undo `<ul><li>Pw</li><li>T0w</li><li><blockquote><p>Q1w</p></blockquote></li><li>Nw</li></ul>` caret text:Q1w@0: Ctrl+Z changes nothing: the value and caret stay the write's. Carry undo True.
- M31-TH@1-Enter: undo False (unchanged); after undo `<ul><li>Pw</li><li>T0w</li><li><h3>H1w</h3></li><li>Nw</li></ul>` caret text:H1w@0: Ctrl+Z changes nothing: the value and caret stay the write's. Carry undo True.
- M31-TC@1-Enter: undo False (unchanged); after undo `<ul><li>Pw</li><li>T0w</li><li><pre><code>C1w</code></pre></li><li>Nw</li></ul>` caret text:C1w@0: Ctrl+Z changes nothing: the value and caret stay the write's. Carry undo True.
- M31-root el1-Enter: undo False (unchanged); after undo `<blockquote>X1w</blockquote><p>X2w</p>` caret text:X2w@0: Ctrl+Z changes nothing: the value and caret stay the write's. Carry undo True.
- M36b: undo False (unchanged); after undo `<blockquote><p>X0w</p><p></p>X1w</blockquote>` caret element:paragraph@0: Ctrl+Z changes nothing: the value and caret stay the write's. Carry undo True.
- M47: undo False (unchanged); after undo `<p>Aw<img />Zw</p>` caret text:Aw@2: the value is restored, the caret is not. Carry undo False.

Fixed points: every record with a write now carries `fixedPoint`. Not a fixed point: head 3 (M13b, M39b, M46), base P 10 (P5a, P5b, P11a, P12b, P13a, P14, P15, P24, P25, P27), carry M 0 (), carry P 0 (). The captured value equals the onChange write in every record (no `captureDiffers`).

M20a's `<br` assertion and M20b's pass at `<base>` and fail at the carry (the carry copies the quote's shell, as P8 and P29 are ruled); the records are written before the assertion.
