# Test fixtures shared with OrganizeOS

`rich-text-roundtrip.json` and `rich-text-corpus.json` are byte-for-byte
copies of the OrganizeOS repo's files of the same names in
`client/tests/fixtures/site-components/`, at commit
`c0588a21f65874b2837fd49ba258ecdeca18080e` (PR RT6), sha256
`3718283a37851f3b8af86b73affbc9321986c62e42fee4ddaf9ee63af30d731f` and
`c81061c296e6cf7ba4199a1a37d6afe52162fd7d057d9285b1d7db5a6b2c12a3`.

The round-trip fixture pins the native CMS editor's rich-text output
(`../rich-text-html.ts`) against the platform's sanitiser (OrganizeOS spec
4.3.3.1 and 8): each case's `editor` is what the editor writes for its
`input`, `stored` what the platform keeps of it, and `nodes` the platform's
/v1 nodes of that; `readOnly` lists the stored values the editor opens
read-only, each with its `reason` and `nodes`. Its `pins` hold the resolved
sanitize-html, htmlparser2, entities, domhandler and launder versions and the sha256 of the
platform's `rich-text-nodes.ts` and sanitiser, of which `../rich-text-nodes.ts`
and `../rich-text-sanitize.ts` are copies (`../rich-text-pins.node.test.ts`).
The corpus holds 896 stored values with their platform nodes and the
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
