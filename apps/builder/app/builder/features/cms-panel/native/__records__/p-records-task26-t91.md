# Task 26: T91.5, the comp-e probe test that fails at both builds

The test is `E-twofield` in check 5's `comp/zzv15-comp-e.test.tsx`. In the second comparison and in the re-run it fails at both builds in every run, with the same error, and the file's other 33 tests pass.

- Error, at both builds: `TypeError: Cannot read properties of undefined (reading 'firstChild')` at the probe kit's `pointIn` (`comp/ckit.tsx:33`), called from the test's line 160: `pointIn("D0w", 3, t.eb)`.
- Cause: the probe kit finds a word by a text span whose whole text equals the word (`wordSpan`, `ckit.tsx:28-29`). The second field's stored value is `<p>Z​Z D0w</p>`, one text node `Z​Z D0w`, so no span's text equals `D0w`, `wordSpan` returns undefined, and the kit throws before any key reaches either field. The loop throws in its first variant (`endInB`), so the second (`wholeInA`) never runs.
- So the test measures nothing at either build: the failure is the probe's own place-finding, not a value of the field, and it is the same text at both builds.
- The ruling it falls under: the case it was written for, a composition started in one field and ended in the other's turn, is held by the branch's own tests (T10.7's test list, "two fields with the composition started in one and ended in the other's turn"; T42.8, "the four two-field composition tests titled controls"), not by this probe. It is listed in the pull request's body under "Not measured" as a probe that fails at its own kit at both builds.
