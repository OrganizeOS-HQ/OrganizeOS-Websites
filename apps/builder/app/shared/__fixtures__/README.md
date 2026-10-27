# Test fixtures copied from OrganizeOS

`preview-assertion.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/preview-assertion.json`, at commit
`5a9d4789cd206bcae4f25b1c87a137e8583a1c02` (the last commit that touched it).
It pins the `X-OOS-Preview` v1 byte format that
`../organizeos-preview.server.ts` mints and the platform's
`client/lib/public/v1/preview.ts` verifies.

The copy is not synced by any script. Before each fork PR that touches the
assertion, compare it with the platform's copy:

```sh
diff ../OrganizeOS/client/tests/fixtures/site-components/preview-assertion.json \
  apps/builder/app/shared/__fixtures__/preview-assertion.json
```

and update this note's commit when it changes.
