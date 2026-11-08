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

`site-addresses.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/site-addresses.json`, at commit
`e8f9b9ca390f5b26293f7bdab099ed870a4f0961` (the last commit that touched it).
It is the answer of `websites2_site_addresses`, which
`../db/organizeos-site-addresses.server.ts` reads for the Publish dialog.
Before each fork PR that touches that read, compare it with the platform's
copy:

```sh
diff ../OrganizeOS/client/tests/fixtures/site-components/site-addresses.json \
  apps/builder/app/shared/__fixtures__/site-addresses.json
```

and update this note's commit when it changes.

`site-addresses-targets.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/site-addresses-targets.json`, at commit
`17d057b2797db23ac1aaa314448856dd788e26e0` (the last commit that touched it).
It is the same answer once the platform reports publish targets: `launchable`
and `targets`, the built-in address first, then the main, then the other
domains. Each target carries `live` (the target's own state) and `serving`
(the address serves that build now). The Publish dialog lists one row per target, and the publish route
checks every ticked address against it. Before each fork PR that touches that
read or the publish route, compare it with the platform's copy:

```sh
diff ../OrganizeOS/client/tests/fixtures/site-components/site-addresses-targets.json \
  apps/builder/app/shared/__fixtures__/site-addresses-targets.json
```

and update this note's commit when it changes.

`site-addresses-old-site.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/site-addresses-old-site.json`, at commit
`17d057b2797db23ac1aaa314448856dd788e26e0` (the last commit that touched it).
It is the answer for an organization whose addresses still show its old site:
its custom main serves that site, its built-in address serves a trial copy of
the new site (`live` and `serving` true while `status` is `not_launched`), and
`old_site_key` names the address a replace must include. Before each fork PR
that touches that read, the Publish dialog's old-site rows or the publish
route's replace, compare it with the platform's copy:

```sh
diff ../OrganizeOS/client/tests/fixtures/site-components/site-addresses-old-site.json \
  apps/builder/app/shared/__fixtures__/site-addresses-old-site.json
```

and update this note's commit when it changes.

`site-action-assertion.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/site-action-assertion.json`, at commit
`f28633f509668b9c6622009c5bd6ced43f1f9eca` (the last commit that touched it).
It pins the `X-OOS-Site-Action` v1 byte format that
`../organizeos-site-action.server.ts` mints for the Publish dialog's Unpublish
and the platform's `/api/internal/websites2/site-action` verifies. Before each
fork PR that touches the assertion, compare it with the platform's copy:

```sh
diff ../OrganizeOS/client/tests/fixtures/site-components/site-action-assertion.json \
  apps/builder/app/shared/__fixtures__/site-action-assertion.json
```

and update this note's commit when it changes.
