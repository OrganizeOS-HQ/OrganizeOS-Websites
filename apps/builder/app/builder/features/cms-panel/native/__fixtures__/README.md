# Test fixtures shared with OrganizeOS

`rich-text-roundtrip.json` and `rich-text-corpus.json` are byte-for-byte
copies of the OrganizeOS repo's files of the same names in
`client/tests/fixtures/site-components/`, at commit
`b98987ff1d2431329f875bc8fd468dce9a31826d` (PR RT6), sha256
`0f03a155a9b91ba736daf5ab4e94d896b3dfd6773c62311b175a2bcb70ac7e44` and
`aaa223f6cfcdb9cad032f9f875df5d695009ae84865657ed4ffe66e3f006ec38`.

The round-trip fixture pins the native CMS editor's rich-text output
(`../rich-text-html.ts`) against the platform's sanitiser (OrganizeOS spec
4.3.3.1 and 8): each case's `editor` is what the editor writes for its
`input`, `stored` what the platform keeps of it, and `nodes` the platform's
/v1 nodes of that; `readOnly` lists the stored values the editor opens
read-only, each with its `reason` and `nodes`. Its `pins` hold the resolved
sanitize-html, htmlparser2 and entities versions and the sha256 of the
platform's `rich-text-nodes.ts` and sanitiser, of which `../rich-text-nodes.ts`
and `../rich-text-sanitize.ts` are copies (`../rich-text-pins.node.test.ts`).
The corpus holds 890 stored values with their platform nodes and the
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
