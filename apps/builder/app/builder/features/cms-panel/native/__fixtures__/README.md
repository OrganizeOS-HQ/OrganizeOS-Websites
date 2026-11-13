# Test fixtures shared with OrganizeOS

`rich-text-roundtrip.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/rich-text-roundtrip.json`, on branch `claude/native-cms-rt2` (PR RT2) at commit
`f53ef243d3b94f85f4fb047650faeea2635393b8`, sha256
`bdd2006503642afe9ab16caea5abfe098109eac0e25146c0bbf56d9828b05f1c`. It pins
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
