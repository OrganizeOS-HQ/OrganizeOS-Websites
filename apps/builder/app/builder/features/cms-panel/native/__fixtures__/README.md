# Test fixtures shared with OrganizeOS

`rich-text-roundtrip.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/rich-text-roundtrip.json`, at commit
`1b84cfa52d668503d061b894e4a122d96365a329`, sha256
`4c302d69184922e2d3e37d3f6f99afd8892bd69fb935badde47688bea2eae7d6`. It pins
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
