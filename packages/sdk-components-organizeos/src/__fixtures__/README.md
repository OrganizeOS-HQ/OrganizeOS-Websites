> Copied unchanged from `client/tests/fixtures/site-components/` in OrganizeOS-HQ/OrganizeOS (commit 39ce1bbe3): change both copies together.
>
> `rich-text.json` and `preview-assertion.json` were copied later, from commit 826b5a764 (where `rich-text.json` last changed in 35d7867ec and `preview-assertion.json` in 5a9d4789c). Before each fork PR, `diff -r` this folder against the platform's to find drift.

# Site component contract fixtures

The request and response bodies of the endpoints the Website builder's
OrganizeOS blocks call, and of the `/v1` reads they bind to. Spec:
`docs/superpowers/specs/2026-10-01-website-builder-platform-components-design.md`
(section 6); plan:
`docs/superpowers/plans/2026-10-02-website-builder-signup-form.md`.

These files are the bytes both repositories build to. The platform's route tests
replay them and `client/tests/lib/public/site/site-components-contract.test.ts`
pins their shapes. The builder fork copies them, unchanged, into
`packages/sdk-components-organizeos/src/__fixtures__/` and tests the blocks
against them. Change both copies in the same change, and remember that a
published site keeps calling the endpoint it was built against: a change here is
additive, or it ships under a new endpoint version.

- `signups/request-*.json`: bodies of `POST /api/public/site/v1/signups`. A
  checkbox field is sent as the string `"true"` when checked and `""` when not,
  as the Website Lite form sends it. `request-share-code.json` is
  `request-form.json` plus the visit's share code, `referral_code`, which a
  block sends only when the page's `?r=` has a code's shape.
- `signups/response-*.json`: `{ "status", "body" }` for each outcome and error.
- `rsvps/request-*.json`: bodies of `POST /api/public/site/v1/rsvps`, for the
  events of `events.json`. `request-minimal.json` is an event with no shifts,
  questions or guests; `request-full.json` is the event that has them all: a
  guest, a shift with a role, one answer of each question type (a multiselect as
  a JSON array of strings, a checkbox as `"true"`, anything else as typed) and
  `email_consent: true`. `request-share-code.json` is `request-minimal.json`
  plus a share code, `referral_code`.
- `rsvps/response-*.json`: `{ "status", "body" }` for each outcome and error:
  `registered` and `waitlisted` (200), `full`, `ended` and `role_full` (409, the
  latter with its open roles, which may be an empty list), `invalid_field` (422,
  with the field, here an answer's `answers.<question id>`), `invalid_request`
  (400), `not_found` (404), `rate_limited` (429) and `unavailable` (503). A
  `role_full` answer never lists the role the request chose, so
  `response-role-full.json` answers `request-full.json`'s Canvasser with its
  sibling Driver. For a visitor with no guests a block marks Canvasser full and
  enables Driver; `request-full.json` brings a guest, so for it the block marks
  no role full, enables Driver and shows the party message. `events.json` lists
  Driver as `full` because the listing is a snapshot, and a `role_full` answer
  reflects the moment of the post. `response-full.json` stands for an event with
  no room and no waitlist, or a selected shift with no room.
- `share-code.json`: the share code a Website's blocks carry (plan
  `docs/superpowers/plans/2026-10-26-builder-share-code.md`, P5): the query
  parameter and the code's pattern (`client/lib/referrals/code.ts`), valid and
  invalid codes, the platform path patterns a block carries the code to (the
  transactional flow family of
  `client/lib/verification/public-route-allowlist.ts`, in its order), the
  platform paths a block carries the code to (`paths.platform`) and the paths it
  never carries it to (`paths.notCarried`: the site's own pages, the donor
  self-service pages, which carry a token from email, and the site endpoints),
  and carry cases (`withReferralCode`, `client/lib/referrals/carry-code.ts`).
  Both repositories test their own constants against it: OrganizeOS in
  `client/tests/lib/public/site/site-components-contract.test.ts`, the fork in
  its package's share-code tests. It is a Prettier fixed point under both
  repositories' JSON settings (print width 80), so neither pre-commit hook
  changes a byte of either copy.
- `rich-text.json`: the rich-text node format, version 1, that
  `/v1/collections*` sends as `nodes` beside a rich-text value's `html` and
  `text` (design
  `docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md` section 4.7).
  Each case is sanitised HTML and the tree `toRichTextNodes` builds from it:
  every block, inline and mark, a figure with a caption, and each dropped case
  (protocol-relative and `javascript:` links, `data:` and `http:` images, depth
  past 8). The `generated` cases describe inputs too large to write out (a count
  past 5,000 nodes) as `{ repeat, times }`, with the expected size, head and
  tail. The platform's converter and the fork's `RichText` component both test
  against it.
- `preview-assertion.json`: a test vector for the `X-OOS-Preview` header,
  version 1, that the builder mints for a canvas fetch of `/v1/collections*` and
  the platform verifies (design
  `docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md` section 4.5):
  a fixed test secret, a payload (`org`, `sub`, `sid`, `iat`, `exp`, Unix
  seconds, in that key order), the base64url payload segment, the base64url
  HMAC-SHA256 of that segment's bytes, and the whole header. The fork's minting
  test and the platform's `verifyPreviewAssertion` test both build to it. The
  secret is a test value and never a deployed one.
- `forms.json`: the body of `GET /v1/forms`.
- `events.json`: the body of `GET /v1/events`, as the route lists it: soonest
  first, with the event's own time zone, and the ended event the
  `?upcoming=true` read leaves out. Every nullable key but `slug`, whose null
  would change `url` to the id fallback, is null in at least one event, so a
  copy's schema is held to it. (`slug` and `end_time` are both NOT NULL in the
  events table; the fixture keeps one null `end_time` anyway, to hold the DTO's
  defensive `.nullable()` and the `?upcoming=true` no-end-time branch.) Each
  event carries its registration details: `waitlist`, `full`, `max_guests`,
  `shifts` (each with its `roles`) and `questions`. One event has a waitlist,
  guests allowed, a full shift, a shift with two roles of which one is full, and
  one question of each type; another is full with no waitlist; the rest have no
  shifts or questions. A shift, a role and a question each hold a null in the
  nullable keys (`description`, `help_text`), and no shift or role count, leader
  or skills appears anywhere (a shift and a role say only whether they are
  `full`).
