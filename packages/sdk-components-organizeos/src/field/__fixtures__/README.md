> Copied unchanged from `client/tests/fixtures/marketing/convergence-field.fixture.json` in OrganizeOS-HQ/OrganizeOS (commit fbe51d29c, which `scripts/write-convergence-field-fixture.ts` there wrote from the generator at commit 38bdbee97): change both copies together.

# Convergence Field fixture

`convergence-field.fixture.json` is the OrganizeOS homepage's convergence
field generator (`client/lib/marketing/convergence-field.ts`) run on a fixed
set of cases. Spec, in the OrganizeOS repository:
`docs/superpowers/specs/2026-10-26-builder-convergence-field-design.md`
(sections 4.3 and 10.8); plan:
`docs/superpowers/plans/2026-10-26-builder-convergence-field.md`.

`../generate.ts` is a copy of that generator, and `../generate.test.ts` holds it
to every case exactly. The OrganizeOS repository's own test holds the homepage
generator to its copy of this file, and its CI compares the two copies byte for
byte, so the generator lives in two repositories and stays one.

The file is `{ source, commit, cases }`, written by
`client/scripts/write-convergence-field-fixture.ts` in the OrganizeOS
repository: one case per line, a trailing newline. Each case is the
generator's inputs (`width`, `height`, `spacing`, `focus`, `zone`) and its
output, each arm a `[x, y, deg, size, level]` tuple. `commit` is the
generator file's last commit when the file was written. The cases are the
homepage's thesis band and pillars, the block's defaults on each Shape
(density 40, focus 50/50, zone 60% by 50% read as diameters), density 24 and
96 on Wide, focus 10/10 and 90/90 on Wide with the block's 0.8 zone clamp, and
a zone touching the edge without the clamp, which pins the generator's
all-solid output there.

Never edit the file by hand or reformat it: it is a byte-for-byte copy, so
`.prettierrc.yaml` here keeps Prettier off it, and tests read it with
`readFileSync` (never a JSON import, which would make the typecheck infer a
huge literal type).

## Changing the generator

A change to the generator is a two-repository change, in this order:

1. In the OrganizeOS repository, change the generator and commit it, then run
   `npx tsx scripts/write-convergence-field-fixture.ts` from `client/`.
2. Copy the written file here with `cp`, check it with `cmp`, change
   `generate.ts` to match, update the commits named above and in
   `generate.ts`'s header, and merge this repository's change first.
3. Then open the OrganizeOS pull request with the generator and the fixture.
   Its CI downloads this file from `OrganizeOS-HQ/OrganizeOS-Websites` on
   `main` and compares it with its own copy, so it is red only while the
   change is half landed.
