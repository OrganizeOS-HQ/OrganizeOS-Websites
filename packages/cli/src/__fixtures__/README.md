# Test fixtures copied from OrganizeOS

`publish-callback-body.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/publish-callback-body.json`, at commit
`9cdad8c63b60e2f80b44943a3a2603fa8dd8e9d0` (the last commit that touched it).
It is the body the publish workflow (`.github/workflows/publish-site.yml`,
"Flip the OrganizeOS pointer") POSTs to OrganizeOS's publish callback, in the
workflow's key order, with the publish targets the builder's Publish dialog
sent. `../organizeos-publish-workflow.test.ts` builds the body from the
workflow's own script and compares it with this file; OrganizeOS's callback
test checks that its schema accepts it.

The copy is not synced by any script. Before each fork PR that touches the
callback body, compare it with the platform's copy:

```sh
diff ../OrganizeOS/client/tests/fixtures/site-components/publish-callback-body.json \
  packages/cli/src/__fixtures__/publish-callback-body.json
```

and update this note's commit when it changes.
