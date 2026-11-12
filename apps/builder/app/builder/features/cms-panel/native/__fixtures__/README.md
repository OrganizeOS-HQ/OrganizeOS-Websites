# Test fixtures shared with OrganizeOS

`rich-text-roundtrip.json` is the shared rich-text round trip of the native
CMS editor (OrganizeOS spec 8). Its source is the OrganizeOS repo's
`client/tests/fixtures/site-components/rich-text-roundtrip.json`. Until the
platform pins it, this file is W2's draft: each case holds `input` and
`editor` only, with no `stored`, and `readOnly` lists the stored values the
editor opens read-only, each with its `reason`.
