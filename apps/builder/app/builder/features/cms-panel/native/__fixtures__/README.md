# Test fixtures shared with OrganizeOS

`rich-text-roundtrip.json` and `rich-text-corpus.json` are byte-for-byte
copies of the OrganizeOS repo's files of the same names in
`client/tests/fixtures/site-components/`, at commit
`ccb2391073e5fd08d5c5089542ccf030202f3f01` (PR RT6), sha256
`17e70497d3a8a4cded3276ec11db1c9c06a910c0736f4f07931e94116db9a031` and
`d820388d378984e1619308663077fd2bcd65a0ad902c2f2c47df190c22998ceb`.

The round-trip fixture pins the native CMS editor's rich-text output
(`../rich-text-html.ts`) against the platform's sanitiser (OrganizeOS spec
4.3.3.1 and 8): each case's `editor` is what the editor writes for its
`input`, `stored` what the platform keeps of it, and `nodes` the platform's
/v1 nodes of that; `readOnly` lists the stored values the editor opens
read-only, each with its `reason` and `nodes`. Its `pins` hold the resolved
sanitize-html, htmlparser2, entities, domhandler and launder versions and the sha256 of the
platform's `rich-text-nodes.ts` and sanitiser, of which `../rich-text-nodes.ts`
and `../rich-text-sanitize.ts` are copies (`../rich-text-pins.node.test.ts`).
The corpus holds 915 stored values with their platform nodes and the
read-only result this editor gives each (`../rich-text-corpus.test.ts`).

Before each fork PR that touches the editor's import or export, compare both
with the platform's copies, from the fork's root with an OrganizeOS checkout
at `<platform>`:

```sh
for f in rich-text-roundtrip.json rich-text-corpus.json; do
  diff <platform>/client/tests/fixtures/site-components/$f \
    apps/builder/app/builder/features/cms-panel/native/__fixtures__/$f
done
```

A change to the editor's output is a platform PR first; update this note's
commit and hash with the copy.
