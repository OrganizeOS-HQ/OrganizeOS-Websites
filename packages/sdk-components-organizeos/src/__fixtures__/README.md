> Copied unchanged from `client/tests/fixtures/site-components/` in OrganizeOS-HQ/OrganizeOS (commit 290f1dffe): change both copies together.

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
  as the Website Lite form sends it.
- `signups/response-*.json`: `{ "status", "body" }` for each outcome and error.
- `rsvps/request-*.json`: bodies of `POST /api/public/site/v1/rsvps`, for the
  events of `events.json`. `request-minimal.json` is an event with no shifts,
  questions or guests; `request-full.json` is the event that has them all: a
  guest, a shift with a role, one answer of each question type (a multiselect as
  a JSON array of strings, a checkbox as `"true"`, anything else as typed) and
  `email_consent: true`.
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
