# field-controls.test.tsx under load: base 2a96a45 against the branch 16c40cc

Test: `apps/builder/app/builder/features/cms-panel/native/field-controls.test.tsx` > "rich text images" > "Image inserts an uploaded image, and Save sends its src, width and height" (project `core-browser-builder-cms`).

The file is identical at both builds, and so are `field-controls.tsx`, `vitest.browser-setup.ts` and the project's setup. 16c40cc differs from the acceptance head 0ae275f only by a records markdown file.

## Result

**The failure reproduces at both builds, and the branch fails at a lower load than the base.**

| series                                     | load average (1 min; 4 cores) | base: passed / failed | branch: passed / failed |
| ------------------------------------------ | ----------------------------- | --------------------- | ----------------------- |
| L5: the test file as kept, 5 CPU burners   | 2.6-13.4, mean 7.8            | 20 / 0                | 17 / 3                  |
| L10: the test file as kept, 10 CPU burners | 12.4-17.8, mean 16.1          | 6 / 10                | 1 / 15                  |
| total                                      |                               | 26 / 10               | 18 / 18                 |

- Every failure is the same: `AssertionError: expected undefined to be 'Lake'`, at about 1,010 ms test time.
- At L10 the branch also failed a second test, "Image refuses a GIF over 4 MB", in 4 runs, with the same message. That test is the next one to call `mountRichField`.
- The branch's 3 L5 failures came in pairs 18 to 20, when load rose to 9-13. Other agents' browser jobs started on the machine then, which also matches the acceptance run's conditions (load 5-11, several browser jobs).
- All of the 37 other tests passed in every run, except that second rich-text test.

How the runs were made:

- 36 runs per build, alternating base and branch each pair, with the order swapped every other pair.
- Load came from busy-loop burners plus other agents' concurrent test runs; the load average was recorded before and after each run.
- Driver: `t55-b/fc/run.sh` and `run2.sh`. Per-run logs and JSON reports: `t55-b/fc/runs/`. Load samples: `t55-b/fc/loadavg-*.txt`. Per-run table: `t55-b/fc/results.txt`. Summary script: `t55-b/scripts/fcsum.py`.

## Where it fails

The message comes from `mountRichField` (test file lines 560-569), not from the Image insert path:

```ts
const spies = mountField(richField, { html: "<p>Lake</p>", text: "Lake" });
await vi.waitFor(() =>
  expect(row()?.querySelector('[contenteditable="true"]')?.textContent).toBe(
    "Lake"
  )
);
```

- `toBe("Lake")` is the only assertion in the test that can produce "expected undefined to be 'Lake'". Line 594's `toContain("Lake")` would report a string.
- `undefined` means the row has no contenteditable yet: the lazily loaded editor has not rendered.
- `vi.waitFor` is called with no options, so it gives up at vitest's default 1,000 ms. Every failing run ends at 1,004-1,080 ms test time.
- The acceptance failure matches: duration 1,143.6 ms, same message (`acceptance/projects/core-browser-builder-cms.json`).
- The branch's changes to the Image insert (T13.1 code-block caret, 15.14 upload during a press, in `rich-text-field.tsx`) run only after `chooseFile`, which comes after this wait. They are not on the failing path.

## Cause: the branch's lazy editor chunk loads more modules, so its first mount takes longer than the 1 s wait

- `field-controls.tsx` loads the rich-text field lazily (`createLazyRichTextField`, `import("./rich-text-field")`).
- This test is the first in the file to mount a rich-text field, so its wait includes fetching and evaluating that module graph. Vite transforms and serves each module separately in the browser runner, and does so cold on every vitest run.
- Static closure of `rich-text-field.tsx`'s relative imports (`t55-b/scripts/graph.py`):
  - base: 8 modules, 232 KB of source.
  - branch: 20 modules, 521 KB. The 12 extra modules are `rich-text-field-watch.ts` and the 11 `rich-text-line-*.ts` modules (clipboard, commands, deletes, history, node, node-selection, normalise, paste, points, removal, toolbar).

### Measured

The measuring copy was `zzt55-fc.test.tsx`: `field-controls.test.tsx` unchanged except that `mountRichField` is timed. Its wait limit was raised to 60 s so every run reports a time. It also records the modules fetched during the mount, through Resource Timing. The copy ran with `--silent=false` in the same alternating way, at both builds, and was deleted afterwards.

| series | load mean | build  | first mount, median (min-max) ms | first mounts over 1,000 ms | last module fetched, median ms | from last module to the editor showing "Lake", median ms | native/ modules fetched |
| ------ | --------- | ------ | -------------------------------- | -------------------------- | ------------------------------ | -------------------------------------------------------- | ----------------------- |
| P5     | 11.7      | base   | 876 (644-1,540)                  | 6 of 16                    | 675                            | 184                                                      | 5                       |
| P5     | 12.0      | branch | 1,320 (857-2,199)                | 13 of 16                   | 1,118                          | 186                                                      | 17                      |
| P10    | 16.4      | base   | 1,106 (908-1,600)                | 9 of 12                    | 945                            | 183                                                      | 5                       |
| P10    | 16.5      | branch | 1,806 (1,162-2,559)              | 12 of 12                   | 1,634                          | 198                                                      | 17                      |

What the measurements show:

- **The whole difference is module loading.** The time from the last fetched module to the editor showing "Lake" (evaluation, Lexical setup, first render) is the same at both builds, about 185 ms. The branch's extra 440-700 ms all comes before it, while the larger graph loads: 58 resources against 46, and 17 `native/` modules against 5.
  - Branch modules: `rich-text-field.tsx`, the 11 `rich-text-line-*` modules, `rich-text-field-watch`, `-html`, `-image-node`, `-nodes`, `-sanitize`.
  - Base modules: `rich-text-field`, `-image-node`, `-html`, `-nodes`, `-sanitize`.
  - The `cms-*` modules were already loaded by `field-controls`.
- **Only the first mount is slow.** Later mounts in the same run take a median 12-15 ms at both builds, once the modules are cached.
- **Unloaded, the branch's first mount is 533-716 ms** (two runs at load about 3), against the 1,000 ms limit. Under load it crosses the limit far more often than the base: 25 of 28 timed first mounts over 1,000 ms, against 15 of 28 for the base.

The timed figures are wall time to success without the 1,000 ms limit. The kept test fails only if the limit passes before the editor commits, so its failure rate sits below the "over 1,000 ms" share, as the L series shows.

### Conclusion

- This is a timing fault in the test, and the base has it too: `mountRichField` waits on a cold lazy import with vitest's default 1 s `waitFor` limit. Under heavy load the base fails the same way (10 of 16 at load about 16).
- R1 makes it more likely by putting 12 more modules (+289 KB of source) into the lazily loaded editor chunk. The branch's first mount then takes about 1.5 times as long under load: medians 1,320 ms against 876 ms, and 1,806 ms against 1,106 ms. At the acceptance run's load the branch fails where the base does not (L5: 3 of 20 against 0 of 20).
- This is not a behaviour change in Image insert or Save. When the editor mounts in time, the branch passes this test in every run, including all 28 timed runs.
- Not changed here: a fix would be on the test side, for example `vi.waitFor(..., { timeout: 10_000 })` in `mountRichField`, or preloading `./rich-text-field` in a `beforeAll`.
