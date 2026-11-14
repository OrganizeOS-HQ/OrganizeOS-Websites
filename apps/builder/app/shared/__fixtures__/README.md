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

`cms-actor-assertion.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/cms-actor-assertion.json`, at commit
`06c7eb46340c3d9f523ff3e589be993c8e886df8` (the merge into `master` that brought
it; unchanged since `f8019f718d2e30fee7f4802d10b7a690823a9486`).
It pins the `X-OOS-Actor` v1 byte format and the canonical target that
`../organizeos-cms.server.ts` mints for the native CMS's door and the
platform's `/api/internal/websites2/cms/{organizationId}/...` verifies. Before
each fork PR that touches the assertion or the canonical target, compare it
with the platform's copy:

```sh
diff ../OrganizeOS/client/tests/fixtures/site-components/cms-actor-assertion.json \
  apps/builder/app/shared/__fixtures__/cms-actor-assertion.json
```

and update this note's commit when it changes.

`forms-actor-assertion.json` is a byte-for-byte copy of the OrganizeOS repo's
`client/tests/fixtures/site-components/forms-actor-assertion.json`, at commit
`1995258f6767c18d7ced17ebf3af2646ae2b7d46` (the merge into `master` that brought
it). It is the same `X-OOS-Actor` v1 format with `aud: "forms"`, the assertion
the forms door (`/api/internal/websites2/forms/{organizationId}/...`) verifies
and `../organizeos-cms.server.ts` mints for the forms relay and the publish
step. Compare it the same way before a fork PR that touches either:

```sh
diff ../OrganizeOS/client/tests/fixtures/site-components/forms-actor-assertion.json \
  apps/builder/app/shared/__fixtures__/forms-actor-assertion.json
```

`cms-door/` holds byte-for-byte copies of the OrganizeOS repo's
`client/tests/fixtures/cms-door/` (every `.json` file and its README), at
commit `06c7eb46340c3d9f523ff3e589be993c8e886df8` (the merge into `master` that
brought them). Each `.json` file is one CMS door endpoint's
`{ status, body }` as the platform answers it, which
`../builder/features/cms-panel/native/cms-api.ts` parses
(`cms-api.test.ts` parses each body through its endpoint's schema). Before
each fork PR that touches the door's client or its shapes, compare them with
the platform's copies:

```sh
for f in ../OrganizeOS/client/tests/fixtures/cms-door/*; do
  diff "$f" "apps/builder/app/shared/__fixtures__/cms-door/$(basename "$f")"
done
```

and update this note's commit when it changes.

`forms-door/` holds byte-for-byte copies of the OrganizeOS repo's
`client/tests/fixtures/site-components/forms-door/` (every `.json` file), at
commit `1995258f6767c18d7ced17ebf3af2646ae2b7d46` (the merge into `master` that
brought them). Each is one forms door call, its request (paths relative to
`/api/internal/websites2/forms/{organizationId}`), status and answer.
`../builder/features/organizeos-panel/forms-api.ts` parses F0 to F4
(`forms-api.test.ts` replays each); F5 is the publish route's alone. Compare
them before a fork PR that touches the forms client or its shapes:

```sh
for f in ../OrganizeOS/client/tests/fixtures/site-components/forms-door/*; do
  diff "$f" "apps/builder/app/shared/__fixtures__/forms-door/$(basename "$f")"
done
```
