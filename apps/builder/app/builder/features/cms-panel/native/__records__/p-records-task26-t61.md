# Task 26: T61.2 and T61.3

T61.3 preload commit 9d782a8, merged at 44f87d3.

## T61.3

Commit 9d782a8 on branch t61 (detached start 342bd52):
`test(cms): preload the lazy editor in item-editor-backstop (T61.3)`.
One file: item-editor-backstop.test.tsx (`beforeAll(async () => { await import("./rich-text-field"); })`
plus `beforeAll` in the vitest import; same shape as 6cfb30a). Identity Joshua Long via `git -c`,
no attribution lines, not pushed.
Run (project core-browser-builder-cms, load average 2.7 at start): 1 file passed, 8/8 tests, 9.85 s.
oxfmt --check and pnpm lint pass.

## T61.2: "image: Choose uploads through E9 and writes ..." (field-controls.test.tsx, -t "image: Choose uploads through E9")

Builds: branch = t61 head 9d782a8 (contains the 6cfb30a preload); base = SP/r1-base 2a96a45 with
the same preload applied as an uncommitted patch (SP/t61/preload.patch), reverted afterwards
(r1-base clean; its only untracked file zz13base.log was there before). One vitest invocation per run,
alternating order per pair (odd pairs base first), 30 s settle, CPU burners, `timeout 600`.
Load per run = mean of the 1-min load average at start and end. Raw: SP/t61/p1/ (pass 1), SP/t61/ (pass 2): results.txt, runs/*.log.
Another agent's browser tests were not running in either pass (ps showed none at pass start; load 2.7 to 5.6 when idle),
so the load comes from my burners only. The T57 mean 22.4 had other agents' load in it.

| pass | burners | build        | runs | pass / fail | load mean (min to max) | secs per run mean (max) |
| ---- | ------- | ------------ | ---- | ----------- | ---------------------- | ----------------------- |
| 1    | 10      | base+preload | 40   | 40 / 0      | 13.3 (5.8 to 17.4)     | 11.5 (26)               |
| 1    | 10      | branch       | 40   | 40 / 0      | 13.4 (6.9 to 17.4)     | 12.6 (20)               |
| 2    | 20      | base+preload | 40   | 40 / 0      | 23.6 (19.8 to 28.1)    | 21.1 (43)               |
| 2    | 20      | branch       | 40   | 39 / 1      | 23.6 (21.8 to 28.0)    | 21.1 (46)               |

Pass 1 (10 burners) gave a load mean of only 13, below the 22.4 asked for, so pass 2 used 20 burners to match it (23.6).
Pass 2 is the comparison at the requested load: base 0/40, branch 1/40. Over both passes base 0/80, branch 1/80.
That is about 1 in 40 at this load (earlier: 1 in 16), too few failures to tell the builds apart.

### The failure (pass 2, pair 16, branch, load 23.8; SP/t61/runs/16-head.log)

`AssertionError: expected { alt: "A", height: 3, path: "org/a.png", url: "https://cdn.example.org/a.png", width: 2 } to be null`
at field-controls.test.tsx:467, the last line: `expect(lastValue(spies)).toBeNull()` after
`await click(byLabel("Remove"))`. Everything before it passed (upload value, alt typing).

Cause (read from the test and image-field.tsx; the miss itself is inferred, not instrumented):
Remove's handler is `onClick={() => onChange(null)}`, synchronous, and `click` waits 5 macrotask rounds, so the
assertion is not racing a delayed write. The last onChange was still the alt "A" object, so onChange(null) never
ran: the real browser click from `userEvent.click` did not land on the Remove button. The button sits in a grid below
the `<img src="https://cdn.example.org/a.png">` frame, which has no fixed size (maxHeight only). That URL never
resolves, so under load the image's failed load and the alt text "A" re-lay-out the frame after the test has chosen
the click point; the Remove button moves and the click misses. `byLabel("Remove")` was non-null (passed
`expect(element).toBeTruthy()` in `click`), so the button existed; the click just missed it.
Not the lazy editor (the image field does not use it), and the preload does not touch it.
Base+preload failed 0 of 80 and the branch 1 of 80, so the base is not shown to fail it at a similar rate, nor to be more robust.
image-field.tsx and field-controls.tsx are identical at 2a96a45 and the t61 head (git diff empty), so both builds drive the same code.
