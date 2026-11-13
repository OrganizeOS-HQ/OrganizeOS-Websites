# Test fixtures shared with OrganizeOS

`rich-text-roundtrip.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/rich-text-roundtrip.json`, at commit
`5aef1ea493d230f57c920927e3c6adba1a560f41`, sha256
`53e7b3c690abd5b9fd35941bc82f33ad2d67870f865e62ac55f59bd558444e29`. It pins
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
