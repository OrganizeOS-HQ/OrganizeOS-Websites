# Test fixtures shared with OrganizeOS

`rich-text-roundtrip.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/rich-text-roundtrip.json`, at commit
`f42cc9e369fa2097c26d2417eef5bcfff078ae62` (PR RT5), sha256
`d8f969b03b0dcffe93112cd141e26d15ede8d222ba4031f7c37ad16983bda505`. It pins
the native CMS editor's rich-text output (`../rich-text-html.ts`) against the
platform's sanitiser (OrganizeOS spec 4.3.3.1 and 8): each case's `editor` is
what the editor writes for its `input`, and `stored` what the platform keeps
of it; `readOnly` lists the stored values the editor opens read-only, each
with its `reason`. Before each fork PR that touches the editor's import or
export, compare it with the platform's copy, from the fork's root with an
OrganizeOS checkout at `<platform>`:

```sh
diff <platform>/client/tests/fixtures/site-components/rich-text-roundtrip.json \
  apps/builder/app/builder/features/cms-panel/native/__fixtures__/rich-text-roundtrip.json
```

A change to the editor's output is a platform PR first; update this note's
commit and hash with the copy.
