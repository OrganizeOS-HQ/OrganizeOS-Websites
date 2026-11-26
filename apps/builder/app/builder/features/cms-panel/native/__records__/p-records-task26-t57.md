# Task 26: T57 results (field-controls preload)

The preload commit is 6cfb30a, merged at 46f37bc. Reviewer on cb077e5 (the P26-1 history fix): no findings.

Commit (branch t57-fc, on origin/claude/native-cms-r1-lines 2175419): 6cfb30a
`test(cms): preload the lazy editor in field-controls (T57)`. One file changed
(field-controls.test.tsx): `beforeAll(async () => { await import("./rich-text-field"); })`
plus `beforeAll` added to the vitest import. The field's lazy import is
`import("./rich-text-field")` in `createLazyRichTextField` (field-controls.tsx).
oxfmt --check and pnpm lint pass on the file. Commit made with `git -c` identity
overrides (Joshua Long, gpgsign off), because the sandbox refused `git config --local`
from this worktree. No attribution lines. Not pushed.

## T57.1/T57.2 field-controls.test.tsx, base (r1-base 2a96a45, unchanged) vs branch + preload

Harness: earlier agent's run2.sh (copy in t57/run.sh): N alternating pairs, 5 or 10
CPU burners, 30 s settle, one run per vitest invocation. 20 pairs at the lower load,
16 pairs at the higher (36 pairs per build, as the earlier table).

IMPORTANT: other agents were running browser tests on the same 4 cores the whole
time, so the loads are higher than the earlier mean 7.8 / 16.1.

| load                | load stats (1-min avg)                                               | base pass/fail | branch pass/fail |
| ------------------- | -------------------------------------------------------------------- | -------------- | ---------------- |
| lower (5 burners)   | samples mean 10.2, max 15.2 (n=158); per-run load at start mean 9.5  | 15 / 5         | 20 / 0           |
| higher (10 burners) | samples mean 22.4, max 26.8 (n=366); per-run load at start mean 21.8 | 0 / 16         | 15 / 1           |

Failures:

- base, lower: Image inserts an uploaded image... x5 (GIF refusal x2 as well).
- base, higher: Image inserts x16, GIF refusal x14, text-file refusal x4.
- branch, lower: none. Branch's earlier 3/20 failures at this load are gone.
- branch, higher: 1 failure, a different test: "the image > image: Choose uploads
  through E9 and writes { url, alt, width, height, path }" (run L10-13, load 24;
  `expected {...} to be null`, an assertion on the pre-upload state that raced the
  upload under load). Not the lazy-editor wait. The preload does not touch it.
- The base (no preload) is the one that fails under load here; this run shows the
  preload makes the branch more robust than the base, not just equal.

Raw: t57/results.txt, t57/runs/*.log|json, t57/loadavg-L5.txt, loadavg-L10.txt.

## T57.3 other test files on main (2a96a45), outside rich-text-* projects, mounting the lazy editor

Method: temporary instrumentation in field-controls.tsx (first mount of the lazy
field per file: time from the render of the lazy wrapper to the editor's first
render ("render") and to a `[contenteditable="true"]` appearing ("editable")),
run with `--silent=false` over all candidate files in project core-browser-builder-cms,
5 runs, ambient load 8.5 to 13.5 (other agents; no burners). Instrumentation
reverted with `git checkout` (tree clean). Candidates: files in the project that
exist at 2a96a45 and render FieldControl with a richtext field. Files that logged
nothing never mount the field: cms-panel.test.tsx (imports RichTextField directly,
not lazily), cms-native-screen, items-view, field-sheet, fields-view,
cms-structure-screen, collection-settings.

| file                                            | first mount, branch (ms; 5 runs)                                                     | default-timeout wait?                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| native/item-editor-backstop.test.tsx            | editable 421, 459, 497, 504, 654 (median 504); render 71 to 404                      | Yes: `bodyEditable()` uses vi.waitFor with no timeout (line 122); first test "an edited rich-text value that settles is sent as the editor's own write"                                                 |
| native/item-editor.test.tsx                     | editable 84, 102, 126, 150, 237 (median 126)                                         | Yes: vi.waitFor with no timeout (lines ~772, ~970); first mount in "a write that landed in the platform's stored form..." The wait starts after other typing (openItem, retype), so the margin is wider |
| native/cms-screen.test.tsx                      | render 0 to 92 ms, editable never (read-only lossy rich text; "none" at the 5 s cap) | No editor wait: the lazy module loads but no editable appears; first test is "the read-only (lossy) rich text's Classic CMS runs the guard..."                                                          |
| native/field-controls.test.tsx (before preload) | editable 414, 499, 519, 607, 462 (median 499)                                        | Yes (the T57 target; fixed by the preload)                                                                                                                                                              |

Not changed: item-editor-backstop.test.tsx and item-editor.test.tsx. The first is
the closest to the 1 s default (max 654 ms at ambient load ~10, vs field-controls
~500 ms median, where the wait failed at higher load). Raw: t57/probe/p3-*.log, rc3.txt.

## T57.4 built size of the lazily loaded editor chunk (one production build each)

`pnpm build` in apps/builder (remix vite:build; the build ran here at both commits).
Assets are minified by Vite; gzip is `gzip -9` of each file (python gzip level 9).
The lazy-only set is rich-text-field's static closure minus everything the
dynamically-importing chunk (index.client-*.js) already loads.

| build            | rich-text-field chunk alone (raw / gzip) | whole lazy-only set, 4 files (raw / gzip)   |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| base 2a96a45     | 44,504 B / 15,213 B                      | 372,122 B / 127,685 B                       |
| branch (6cfb30a) | 80,726 B / 25,638 B                      | 448,285 B / 149,748 B                       |
| difference       | +36,222 B / +10,425 B                    | +76,163 B / +22,063 B (+20% raw, +17% gzip) |

Lazy-only files per build (raw / gzip), base then branch:

- rich-text-html: 188,587 / 67,070 then 228,311 / 78,626
- LexicalRichText.prod: 129,360 / 41,307 then 129,583 / 41,394
- rich-text-field: 44,504 / 15,213 then 80,726 / 25,638
- LexicalLinkPlugin.prod: 9,671 / 4,095 then 9,665 / 4,090

Chunk files: base rich-text-field-B_qLmfcx.js, branch rich-text-field-BL8CAut5.js
(apps/builder/build/client/assets in each build tree). Script: t57/chunks.py;
logs: t57/build-base.log, t57/build-head.log. Size is dominated by rich-text-html
(+39.7 KB raw) and rich-text-field (+36.2 KB raw); the Lexical bundle is unchanged.
