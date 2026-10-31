# OrganizeOS fork of Webstudio

This is OrganizeOS's fork of [Webstudio](https://github.com/webstudio-is/webstudio), used as the **element-based, Webflow-class site builder** behind OrganizeOS "Websites 2.0". It runs as a separate service, branded as OrganizeOS, against the OrganizeOS Supabase, and member organizations build data-bound public sites with it.

This document is the fork's source of truth for: the **AGPL §13 license posture**, what we changed vs. upstream, and how data-binding + deploy config are wired. Keep OrganizeOS-specific changes minimal and isolated so upstream merges stay tractable.

## 1. License posture (AGPL-3.0 §13) — POSTURE A

Webstudio core is **AGPL-3.0-or-later**. Serving a _modified_ builder to org admins over the network triggers **§13**: those users must be offered the source of our modifications.

**Our posture (A): accept the copyleft and keep this fork public.**

- This fork repository is **public**. It must be public **before any non-employee org admin uses the builder**.
- The builder UI carries a persistent **source-offer link** in its chrome, pointing at the deployed commit of this public fork (added with the branding changes).
- We do **not** treat the builder as "internal only" — that is a false safe-harbor; §13 attaches the moment an external admin uses the modified builder.
- Generated **sites** do not trigger any builder-source obligation. The published-site runtime packages (`@webstudio-is/react-sdk`, `sdk`, `sdk-components-react`, `sdk-components-react-radix`, `sdk-components-react-router`, `sdk-components-react-remix`, `image`, `wsauth`: every package the CLI templates install) are kept **byte-identical to upstream** so §13 only ever covers their already-public source. OrganizeOS-specific generation logic lives in the CLI templates / route templates, whose Corresponding Source every published HTML page offers twice. In its head: `<link rel="license" href="https://www.gnu.org/licenses/agpl-3.0.html">` and `<link rel="code-repository" href="https://github.com/OrganizeOS-HQ/OrganizeOS-Websites/tree/<sha>">`. And, by the owner decision of 2026-10-15 (§13 asks that the offer be prominent, and a head link is invisible to a visitor), in a small visible link at the end of its `<body>`: `<div data-organizeos-source-offer><a href="<the same URL>" rel="code-repository">Source</a></div>`, whose title and accessible name are "Source code of this site (AGPL-3.0)": it leads to the fork code this site runs (these route templates, the resource cache and the OrganizeOS blocks), at the commit that built it. These come from marked changes in `packages/cli/templates/react-router/app/route-templates/html.tsx`. The anchor carries `rel="code-repository"` alone: its target is a source tree, not a license document, so a `license` relation on it would be a second, conflicting license target beside the head's `license` link to the AGPL text. Prebuild replaces its `__ORGANIZEOS_SOURCE_URL__` placeholder with `getOrganizeosSourceUrl()` (`packages/cli/src/organizeos-components.ts`). That is the fork at `GITHUB_SHA` when `GITHUB_REPOSITORY` is `OrganizeOS-HQ/OrganizeOS-Websites` and `GITHUB_SHA` is a full commit hash, as in the publish workflow, which builds the CLI from the commit it checked out. Otherwise, as in a local build, it is the repository root. The repository was renamed from `OrganizeOS-HQ/websites-builder` to `OrganizeOS-HQ/OrganizeOS-Websites` in October 2026; the check compares the current name, so it must change with any future rename (between the rename and the fix, sites published linked the repository root, through GitHub's redirect, rather than their commit, until republished). The head links leave the page the org designed unchanged. The visible link adds one small line after it, in the normal flow and with inline styles only (a centered 12px block at 0.7 opacity, `color: inherit`, never positioned over the design), so it has no class the org's CSS can target and leaks nothing into it; it does inherit the body's text color and font. It is the last of the `<body>`'s content (only the scripts the Body renders after its children follow it, and they take no space), so the body's own layout decides where it lands. In a block-flow body it is a line below the content, and in a grid body `grid-column: 1 / -1` gives it a whole row. In a body laid out as a row flex container (`display: flex` with the default `flex-direction: row`, wrapping or not) it sits beside the content, or with wrap on a line of its own at the start rather than centered, and in a body that clips its overflow (`height: 100vh; overflow: hidden`) it can be clipped out of sight. A body whose text color does not contrast with what lies behind the end of the page (light text set on the body for dark sections while the body itself has no background, or `color: transparent`) makes it unreadable. It is on html pages only, not on the xml and text routes. The `<body>` is the generated page's own `Body` (`@webstudio-is/sdk-components-react-router`, byte-identical to upstream), which renders the scripts after its children, so `html.tsx` cannot render inside it from outside: it calls the generated `Page` and appends the link to the children of the element it returns (`PageWithSourceOffer`). Generated sites also carry the fork's own OrganizeOS blocks, `@organizeos/site-components` (§9): the CLI copies that package's build into each site as app source, never as an installed package, so the same source offer covers it (OrganizeOS spec section 4.1). The blocks' copy in `app/__organizeos__/` ships with the package's `LICENSE`, the AGPL-3.0 text and identical to the fork's top-level `LICENSE`; prebuild fails without it. A site published before the head links and the `LICENSE` has neither until it is republished, and a site published before the visible link keeps the head links alone, its old offer, until it is republished. That package and the templates are where OrganizeOS site code goes; the runtime packages above stay byte-identical whatever a site carries.
  - The practical consequence: a generated site installs those packages **from npm, at upstream's published version**, not from this fork. The CLI pins them at build time to `PUBLISHED_RUNTIME_VERSION` (`packages/cli/src/runtime-version.ts`), replacing the monorepo placeholder `0.0.0-webstudio-version` that upstream's publish step would otherwise have stamped. That constant must be the upstream release matching this fork's base commit (the first release after it, latest patch) and **must be bumped in the same change as any upstream merge** — a stale value fails only on the next publish, in Vercel's build log.
  - **CI guard:** `pnpm check:runtime-upstream` (`scripts/check-runtime-upstream.sh`, run in `checks` and in the CI workflow) fails the build if any file in those eight packages differs between `HEAD` and the upstream commit this fork is based on, which `scripts/upstream-base.txt` records. Bump that file to the merged upstream commit in the same change as `PUBLISHED_RUNTIME_VERSION`; a stale base reports upstream's own changes as fork changes. The check needs the base in history, so CI checks out with `fetch-depth: 0` and an upstream merge lands as a merge commit, never squashed.
- If we ever need to keep builder modifications **closed**, the only compliant path is a **commercial/dual license** from Webstudio, Inc. (posture B) — out of scope unless pursued.

## 2. Proprietary code removed (mandatory)

The upstream `@webstudio-is/sdk-components-animation` package is **EULA-proprietary** (not AGPL) and was a hard dependency of the builder, the CLI, and every published-site template. It has been **physically removed** from this fork:

- Dependency stripped from all `package.json` files (builder, CLI, CLI templates, fixtures).
- Imports + registrations removed from `apps/builder/app/canvas/canvas.tsx`, `apps/builder/app/shared/sync/patch/patch-auth.server.ts`, and `packages/cli/src/framework-{react-router,remix,vike-ssg}.ts`.
- The `packages/sdk-components-animation` directory and the `.gitmodules` pointer to the proprietary repo are deleted.

This removes the Webstudio "Animate" components from the palette — acceptable; they are not in OrganizeOS's requirements.

**CI guard:** `pnpm check:no-proprietary` (`scripts/check-no-proprietary.sh`, run in `checks` and in the CI workflow) fails the build if the package name reappears in `apps/`/`packages/` or if the proprietary EULA license banner appears anywhere we ship. Do not bypass it. (A publish-time guard that greps the generated site output is added in the hosting phase.)

## 3. Data-binding — enabled via env, no code patch

OrganizeOS's whole value is **live data-bound elements** (events/donations/contacts via Resources). Webstudio already supports this; it is gated on a plan's `allowDynamicData` / `allowAuth` features (see `packages/plans/src/plan-features.ts`, both default `false`; `apps/builder/.../publish/restricted-features.ts` gates the Resource-variable feature on them).

This is enabled **purely via the `PLANS` env var** (a JSON array of plan configs parsed by `parsePlansEnv`, `process.env.PLANS`) — **no proprietary code, no patch to any shared `.tsx`**. OrganizeOS runs an internal `organizeos` plan:

```jsonc
// PLANS env (JSON, single line in the real env). maxWorkspaces > 1 is REQUIRED:
// org-owned workspaces use a synthetic service-user owner and human admins are
// non-owner members; hasProjectPermit locks out every non-owner member when the
// owner plan has maxWorkspaces <= 1 (a silent total admin lockout).
[
  {
    "name": "organizeos",
    "features": {
      "canDownloadAssets": true,
      "canRestoreBackups": true,
      "allowAdditionalPermissions": true,
      "allowDynamicData": true,
      "allowAuth": true,
      "allowContentMode": true,
      "allowStagingPublish": true,
      "maxContactEmailsPerProject": 1000000,
      "maxDomainsAllowedPerUser": 1000000,
      "maxDailyPublishesPerUser": 1000000,
      "maxWorkspaces": 1000000,
      "maxProjectsAllowedPerUser": 1000000,
      "maxAssetsPerProject": 1000000,
      "seatsIncluded": 1000000,
      "maxSeatsPerWorkspace": 1000000,
    },
  },
]
```

Provisioning gives the org's synthetic owner a real plan row (`syncOrgOwnerPlan`: a `Product` plus a `TransactionLog` satisfying the `UserProduct` view), named after this `organizeos` entry, with `Product.meta` carrying only the per-org entitlement delta. Nothing short-circuits `getProjectPlanFeatures` — the plan resolves through the same path as any other user's, which is the point: every independent derivation of plan state in the builder is fed from one place. The SSO token's `entitlements` claim re-syncs it on every entry, so a wrong value heals at the org's next login rather than needing a re-provision.

## 4. Deploy environment (see `apps/builder/.env`)

- `DATABASE_URL` / `DIRECT_URL` — OrganizeOS Supabase Postgres.
- `POSTGREST_URL` / `POSTGREST_API_KEY` — OrganizeOS Supabase PostgREST (the builder's data layer). `POSTGREST_API_KEY` is the OrganizeOS service-role key: the builder's tables, the session binding and the Publish dialog's address read need it.
- `AUTH_SECRET` — builder session secret.
- `PLANS` — the JSON above (enables data-binding + the admin-lockout fix).
- Asset storage — `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`. **Required on Vercel**; see "Asset storage" below.
- `NODE_OPTIONS=--conditions=webstudio` — resolves workspace packages to their AGPL source.
- Node 22 (repo `engines`; Node 24 works with a benign warning). pnpm 9.14.4 (via `corepack pnpm`).

OrganizeOS integration (all optional; each feature ships dark until its variable is set):

- `ORGANIZEOS_PROVISION_TOKEN` — shared secret for `POST /internal/provision` and `POST /internal/collections-sync` (server-to-server).
- `ORGANIZEOS_SSO_PUBLIC_KEY` — ES256 public key (PEM) that verifies OrganizeOS SSO tokens; registers the `organizeos` dashboard strategy.
- `ORGANIZEOS_SESSION_BINDING` — `observe` (default; unset or blank reads as `observe`) or `enforce`: whether a builder session whose OrganizeOS session has ended still reads as a session (§5, "Session binding"). Consulted only when `ORGANIZEOS_SSO_PUBLIC_KEY` is set. An env change reaches functions only on a new deployment, so redeploy after setting it.
- `ORGANIZEOS_PUBLISH_REPO` + `ORGANIZEOS_PUBLISH_GITHUB_TOKEN` — Publish dispatches `publish-site.yml` in that repo instead of Webstudio's cloud publisher. The repo is `OrganizeOS-HQ/OrganizeOS-Websites` (its old name, `OrganizeOS-HQ/websites-builder`, still reaches it through GitHub's redirect). The token is a fine-grained personal access token whose resource owner is OrganizeOS-HQ, limited to this repository, with Repository › **Actions: Read and write** (GitHub adds Metadata: Read-only). Actions is added at Read-only by default: a token left there, or one owned by a personal account or still awaiting the organization's approval, can read the public repository but not start the workflow, so every Publish fails with the setup message while the builder's log shows the dispatch answered `403 Resource not accessible by personal access token`. An expired token fails Publish the same way, so renew it before it expires. An env change reaches functions only on a new deployment, so redeploy after replacing it.
- `ORGANIZEOS_APP_URL` — the OrganizeOS app the builder hands users back to (login page, the builder menu's "Back to OrganizeOS", the org's Website area). Defaults to `https://app.organizeos.org`.
- `ORGANIZEOS_BLOCKS_DENY_ORG_IDS` — the orgs denied the OrganizeOS blocks and the rest of the OrganizeOS builder UI (§9, In the builder): comma-separated organization ids, each trimmed and matched in any case. Every other org, new ones included, is offered them; unset, empty or only separators denies none. An entry that is not an organization id denies every org (a malformed value fails closed), and the builder loader logs that once per instance, without the value. Read by the builder loader, which resolves the project's org from its owner's service email (`org+<organizationId>@svc.organizeos.internal`) and hands the result to the builder as `organizeosSite.blocksEnabled`. Set it in Vercel before the deploy that should read it: an env change reaches functions only on a new deployment, and an unset value offers the blocks to every org. It replaced `ORGANIZEOS_BLOCKS_ORG_IDS`, the rollout allowlist, which the builder no longer reads: delete it from every deployment, and never reuse the name.
- `WEBSITES2_PREVIEW_SECRET` — shared with OrganizeOS (the same value on both sides): the key that signs the canvas's draft-preview assertion, `X-OOS-Preview` (§5, "Draft preview on the canvas"). Unset or blank: no assertion is minted, and the canvas shows published items only. Rotate it on both sides together; a mismatch only turns preview off.
- `ORGANIZEOS_CMS_PANEL` — builder only: the CMS's switch (§9, "The CMS overlay"). Only the exact value `true` offers the CMS rail button; anything else leaves the rail without it. The OrganizeOS data tab does not depend on it.
- `PUBLISHER_HOST` — the platform base domain an org's site is served from (`<subdomain>.<PUBLISHER_HOST>`); with the org subdomain mirrored into `Project.domain` (§5) every address the builder shows is the real one. **Defaults to `organizeos.org` in code**, so an unset env is correct rather than dangerous; upstream defaulted it to its own staging domain, which is what made a missing value advertise a Webstudio address. Set it only to point a deployment somewhere else.
- `TRPC_SERVER_API_TOKEN` — the builder's service token. The publish executor uses it to sync the build **and** to report the outcome to `POST /internal/publish-status` (§5).

### Deploying the builder itself

`vercel.json` sets `git.deploymentEnabled` to `true`. Upstream ships it as
`false`, which tells Vercel to skip **every** branch: Webstudio deploys its own
way, so for them the setting is correct and invisible. For this fork it meant
merging to `main` changed nothing — production kept serving whatever commit was
last deployed by hand, and four merged PRs went live nowhere. Keep this `true`
on upstream merges; it is a one-line conflict that silently reverts to "nothing
deploys" if taken from upstream.

This also enables preview deployments for pushes to other branches. To keep
production auto-deploys without previews, the map form is
`{ "main": true, "**": false }` — note `**`, because minimatch's `*` does not
cross the `/` in a branch name like `claude/thing`.

### Asset storage

Without the five `S3_*` variables the builder writes uploads under
`public/cgi/asset` in its own function bundle, which is read-only on Vercel, so
every image, font and video upload fails. That fallback is for local
development only.

Use any S3-compatible bucket, kept **private**:

- Cloudflare R2 (upstream's own choice; OrganizeOS Drive uses it too):
  `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`,
  `S3_REGION=auto`, and an API token with Object Read & Write on this one
  bucket only.
- Supabase Storage in the OrganizeOS production project: the bucket has to
  arrive as a migration in the OrganizeOS repo (its `CLAUDE.md` forbids
  dashboard or MCP schema changes to production; every bucket there came in
  that way). Supabase S3 keys reach every bucket in the project. The builder
  already holds that project's service-role key, so they add nothing it lacks.
- `S3_ENDPOINT` may carry a path. Supabase Storage's S3 endpoint is
  `https://<project-ref>.supabase.co/storage/v1/s3`; upstream resolved
  `/<bucket>/<key>` against the endpoint, which dropped that path.
- Leave `S3_ACL` unset. Nothing reads the bucket anonymously, and some providers
  do not support ACLs. (`apps/builder/.env` still shows
  `public-read` from upstream.)
- Leave `RESIZE_ORIGIN` unset unless an image-resizing service is in front. The
  builder then serves originals.
- `MAX_UPLOAD_SIZE` defaults to 4.5 (MB), which is Vercel's limit on a
  function's request body. Raising it on Vercel does not raise that limit.

Upstream reads files back through an edge proxy that answers `/cgi/image`,
`/cgi/asset` and `/cgi/video` before the builder sees them. This fork has no
such proxy, so those routes fetch the object with a signed GET
(`packages/asset-uploader/src/clients/s3/read.ts`, `AssetClient.readFile`) and
stream it back, passing range requests through so video can seek. The publish
CLI downloads every asset through the same routes. Without the read path a
site with an uploaded image cannot publish either.

`packages/asset-uploader` is not in the byte-identical set (§1). The fork
changes it in three ways: the endpoint's path is kept, `host` is signed as the
AWS SDKs do, and the S3 client can read files back.

**These routes answer on the builder's own origin.** Each response they build
(everything but the `RESIZE_ORIGIN` pass-through) carries
`Content-Security-Policy: sandbox` (PDFs excepted) and
`X-Content-Type-Options: nosniff`, so an uploaded `.html` or `.svg` cannot
run script with an admin's session. The branch for absolute URLs (the canvas
loads an Image or Video whose `src` is a URL through these routes) fetches only
http(s) and returns content headers only
(`apps/builder/app/shared/asset-response.server.ts`). Upstream returns
`fetch(name)` verbatim, since its proxy answers first. Here that served any
remote page, `Set-Cookie` included, as a page of the builder. Keep the helper
on upstream merges. `shared/cgi-routes.server.test.ts` fails if a route goes
back to returning the remote response.

### Framing

No other page can frame the builder or the canvas: every document carries
`Content-Security-Policy: frame-ancestors 'self'` and
`X-Frame-Options: SAMEORIGIN` (for browsers without `frame-ancestors`). Session
cookies are scoped to `.organizeos.org` and org sites live on
`{org}.organizeos.org`, so an org's page is same-site with
`builder.organizeos.org` and `p-<projectId>.builder.organizeos.org`, and could
otherwise frame the builder with a signed-in admin's session and click through
it. `'self'` fits everywhere: the canvas iframe is same-origin with the builder
UI (`getCanvasUrl()` is the relative `/canvas`) and nothing else frames either.

The values live in `apps/builder/app/shared/frame-protection.ts`. `root.tsx`
sends them, and every route without its own `headers` export inherits them.
Remix replaces the parent's headers when a route exports `headers` (it keeps
only `Set-Cookie`), so a route that does must merge them in itself:
`_ui.(builder).tsx` appends `frame-ancestors` to its `frame-src`/`worker-src`
policy with `withFrameAncestors` (one policy, not two headers), and
`_ui.dashboard.tsx` and `_ui.$.tsx` add `frameProtectionHeaders`.
`shared/frame-protection-routes.server.test.ts` reads `app/routes` and fails
for a route that exports `headers` without them. Resource routes (no component:
`/cgi/*`, `/rest/*`, `/internal/*`, `/trpc/*`) return their own `Response`, are
not documents, and are untouched; `/cgi/*` keeps its
`Content-Security-Policy: sandbox`. Keep all of this on upstream merges: a new
or changed `headers` export upstream is how it would be lost.

## 5. The OrganizeOS loop: SSO → build → Publish → back

How an org admin's session is wired end to end, and which side owns each step. The OrganizeOS repo is `OrganizeOS-HQ/OrganizeOS` (`client/lib/websites2/*`, `client/lib/actions/websites/*`, `client/app/api/websites2/*`, `client/app/api/internal/websites2/*`).

1. **Provision** (OrganizeOS → builder, `POST /internal/provision`, `ORGANIZEOS_PROVISION_TOKEN`). Creates the org's synthetic owner, workspace, project, plan (from `entitlements`), data catalog and a starter signup page at `/newsletter` (§9). The body also carries the org's platform `subdomain`; it becomes `Project.domain` (`shared/db/organizeos-site.server.ts`). Idempotent, so it doubles as a re-sync: a re-provision restores a workspace and project that an offboard soft-deleted, follows an org rename, seats the admins in `adminEmails` and retires every other active member (an empty list retires nobody, so a failed admin lookup on the OrganizeOS side can never evict everyone). Without `readToken`/`apiBaseUrl` the catalog is left untouched, which is what a membership re-sync wants. With them, a provision that changes the build writes it as a compare-and-swap on its `version` that also bumps it (three attempts, then the request fails), so a builder tab open on the project gets `version_mismatched` on its next save and reloads instead of keeping, or copying from, a replaced token.
2. **Enter** (OrganizeOS → browser → builder, `POST /auth/organizeos`). OrganizeOS mints a 60s single-use ES256 token for an active admin and auto-POSTs it; the builder verifies it, seats that admin in the org's workspace (the signed token is the authority: OrganizeOS only signs for a currently active owner/admin, so an admin added after provisioning gets in on their first entry), refreshes the org's plan from the `entitlements` claim and its project domain from the `subdomain` claim (a rename converges on the next entry), and lands the admin directly in the org's project (`resolveSsoLandingUrl`). Nothing about the fork dashboard is part of the flow.
3. **Build.** The builder loader recognises an org project by its owner (`User.provider = organizeos-service`) and passes an `organizeosSite` (`manageUrl`, `platformUrl`, the `subdomain` when known, and `blocksEnabled`, true unless `ORGANIZEOS_BLOCKS_DENY_ORG_IDS` denies the org) to the client. It carries no site address: the Publish dialog reads that from OrganizeOS (item 4). For such a project the chrome is OrganizeOS-shaped: the menu's first item is "Back to OrganizeOS", which opens the org's workspace home, `{ORGANIZEOS_APP_URL}/{subdomain}` (`organizeosHomeUrl` in `shared/organizeos-site.ts`; the app's dashboard while the subdomain is unknown), instead of Dashboard; Share, Export and Clone are not offered (membership, publishing and the single project all live in OrganizeOS).

   **The fork dashboard is not a surface OrganizeOS uses.** SSO deep-links past it, but it was still reachable by URL, by a stale `returnTo` cookie, or by signing in again — and it is upstream's personal-account surface, so it opens on the admin's empty personal workspace and lists the org's own site under "Shared with me". Worse, it offers actions that break the derived identity provisioning depends on: New project and Duplicate create projects OrganizeOS cannot see or publish, Transfer moves the org's site out of the service-owned workspace, and Leave drops the admin's own access.

   Two defences, both in this fork. `resolveOrganizeosDashboardExit` (`shared/db/organizeos-site.server.ts`) redirects an org admin from the dashboard to their org's Website area, identifying them from data — a non-owner member of a service-owned workspace who owns no projects of their own. A user who does own projects here keeps the dashboard, because it is the only way to reach them; `DEV_LOGIN=true` is exempt, because local development seeds real orgs with real admin emails; the check fails open, and never redirects to the builder's own origin. And provisioning re-asserts the org project's owner and workspace on every re-sync, so a transfer that did happen is healed on the next entry rather than orphaning the site.

   The AGPL §13 source offer is rendered in the builder menu as well as the dashboard footer, so it stays reachable for an admin who never sees the dashboard. Do not remove the menu copy.

4. **Publish** (`features/publish/organizeos-publish.tsx`). When the dialog opens, and again when a publish settles, it reads the site's addresses and launch state from `GET /rest/organizeos-site/{projectId}` (`routes/rest.organizeos-site.$projectId.ts`, read by `features/publish/organizeos-publish-addresses.ts`). The route answers a fetch only (a document or iframe load is refused), and only to a user signed in as a user (a share link's token is refused) who may view the project. It resolves the org from the project owner's service email, never from the request, requires it to be a UUID, and calls OrganizeOS's service-role `websites2_site_addresses(p_org)` with `POSTGREST_API_KEY` (`shared/db/organizeos-site-addresses.server.ts`). The answer is validated (at most one row; a main host that, ASCII-lower-cased, is dot-separated labels with no scheme, port, path or userinfo; a known status; an optional boolean `launchable`) and never stored; anything else is `{ ok: false }`, logged as one code with no data. `shared/__fixtures__/site-addresses.json` is a byte-for-byte copy of the platform's answer fixture; its README names the source commit and the `diff` to run. The dialog then shows, top to bottom: "Publishing to {host}" (the custom main, else `{subdomain}.{PUBLISHER_HOST}`), linked to the site only while it is live and truncated with its full text in a tooltip when it does not fit, with "Manage domains ↗" (`{ORGANIZEOS_APP_URL}/{subdomain}/settings/domain`) on the same row; on a site not launched, "Not live yet. Launch your website from OrganizeOS ↗", and on an offline one, "Your website is offline. Put it back from OrganizeOS ↗", both to the org's Website area; a separator and the status line; on a live site whose current version OrganizeOS will not serve (`launchable: false`), one warning line, "This version can't go live yet. Publish again after the next builder update."; then any error, the banners and one Publish button, with no tooltip. A failed read, or a project no org owns, shows none of the address, launch and warning lines. A banner names the features the plan does not cover and ends with an "Open in OrganizeOS ↗" link to the Website area. `domain.publish` creates the production build and the OrganizeOS publisher (`services/organizeos-publisher.server.ts`) dispatches `publish-site.yml` with the build and organization ids. A dispatch that never leaves the builder marks the build FAILED at once; a static-export build is refused (it must never be deployed as the live site). The dialog also lists what is paused, and prebuild leaves an org's own script, and the unsafe values of §10, out of the published site.
5. **Execute** (`.github/workflows/publish-site.yml`). Syncs the build with the CLI, builds it, reads the org script switch from the CLI it built and fails unless it is off, reads the guard level from the same CLI and fails unless it is an integer from 0 to 32767, deploys to the `organizeos-sites` Vercel project, POSTs the deployment URL, with `orgScript` (§10, "Reporting to OrganizeOS") and `guardLevel` as the run's CLI read them, to OrganizeOS's publish callback (which flips the org's ledger pointer, making the site live through the reverse proxy), then reports `PUBLISHED` to the builder's `POST /internal/publish-status`; any failure, and a run cancelled before the pointer flip (by a newer publish for the org, which `cancel-in-progress` cancels, or by the job's timeout), reports `FAILED`. A run cancelled after the flip reports `PUBLISHED`, since the pointer moved, and never `FAILED`, which the builder would otherwise take over `PUBLISHED`; one cancelled during the flip request reports nothing, because whether the pointer moved is unknown, and the build reads pending until the dialog gives up. Without that report the builder's status would read "pending" forever: upstream's cloud publisher used to flip `Build.publishStatus` directly.

   **The guard level** is `ORGANIZEOS_GUARD_LEVEL`, beside the switch in `@organizeos/site-components/org-script`: which of OrganizeOS's launch requirements the CLI built from this commit meets. The step "Read the guard level", after "Read the org script switch" and before "Deploy to Vercel", loads it from `packages/cli` as the CLI does, and the callback sends it as `guardLevel`, a JSON integer. OrganizeOS stores it with the deployment pointer and launches a Website only from a build whose level is high enough. Level 1 has one requirement not yet in this repository; the constant stays 0 until it lands. `packages/cli/src/organizeos-guard-level.test.ts` lists level 1's requirements, each with a check that runs and the tests that cover it, which must still exist, and fails if the constant is raised while one is missing; raising it is a reviewed change that edits that test.

   **Inputs reach scripts through `env:`.** No `run:` script holds a `${{ }}` substitution: inputs, variables, secrets and step outputs reach each script through its step's `env:`, and the callback's and the two status reports' JSON bodies are built with `node` from there, so a dispatch input cannot break out of the shell or a body. A step output is written only after its value is checked: the switch's `false`, the level's integer, the deployment's `https://` host. The callback step checks `orgScript` and `guardLevel` again before it sends anything, and keeps its 2xx check. On success it logs only the answer's `live` and `launchable`, as `live=<value>` and `launchable=<value>`, each only when it is a boolean, never the answer itself; on failure it prints the answer. The Vercel CLI is installed in a step of its own, with no secret in its environment, at a pinned version and with `--ignore-scripts`, so no install script runs; bump the pin on purpose, to a release at least two weeks old. The deploy step passes the token only in its environment, as `VERCEL_TOKEN`, which the CLI reads, and never on a command line. The token is still in that step's environment while the pinned CLI deploys. `packages/cli/src/organizeos-publish-workflow.test.ts` runs the steps' scripts against a fake `curl`, `npm` and `vercel`.

6. **Status.** The dialog polls the project while a build is pending and treats a build as failed only after the executor's 25 minute timeout (`organizeos-publish-status.ts`; upstream assumes 3 minutes). Its status line reads "Publishing, started {when}", "Published {when}", "Publish failed {when}" or "Publishing did not finish {when}", and nothing more; an error the publish call returned shows on its own line below. When a publish that was pending while the dialog was open settles, the dialog reads the addresses again. On success it says "Your site is live. Changes can take up to a minute to appear at {host}." (the proxy's target cache) only when OrganizeOS answers `live` and does not say `launchable: false`, and "Published." otherwise, a failed read included.
7. **Collections** (OrganizeOS → builder, `POST /internal/collections-sync`, `ORGANIZEOS_PROVISION_TOKEN`, authenticated like provision). Sent by an Inngest job (debounced 30 s per org) whenever the org's public CMS collections change: `{ organizationId, collections }`, every public collection as a full snapshot (`slug` and `name`; `singularName`, `kind`, `id`, `contentUrl` and `fields` are optional, and unknown keys are ignored). The builder adds one catalog Resource per collection to the org's dev build (`shared/db/collections-sync.server.ts`): a GET Resource for `<api base>/collections/<slug>/items`, and no binding. The OrganizeOS data tab lists it, where an admin adds it to a page (§9: data loads only where it is used). Ids derive from the project and the slug, so a rename only updates the name; a platform collection that a static Resource already covers (`events`, `fundraisers`, `stats`) is skipped. Existing entries are replaced where they stand and new ones appended, so the build keeps its order. A sync also removes, where nothing references them, the bindings with a preset's deterministic id: the unscoped ones older syncs wrote next to each Resource and the `:root` Forms binding of the pre-deploy branches (§9). It keeps the rest, and never touches a binding with a fresh id, which is what every use brings now, whatever its scope.

   The request carries no token: the API base and the `Authorization` header are copied from the static Resources that provisioning seeded. A re-provision rotates the token in every collection Resource itself (new `Authorization` and API base, same name and position), so the old token can be revoked after the next publish without a sync in between; OrganizeOS still fires a sync after provisioning and at builder SSO entry. Idempotent: an unchanged snapshot writes nothing. A write is a compare-and-swap on the build's `version`, which it never bumps (that would make every open builder reload); if a builder save wins the race it re-reads and tries again, three attempts in all.

   Responses: `200 {"ok":true,"collections":n}`; `400` bad JSON or body (slug must match `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`, at most 500 collections); `401` bad or missing token, or any `Cookie`; `405` not POST; `409` the project has no static Resources to copy from (provision it with a token first); `422` no project for the org (missing or offboarded); `503` the build kept changing, which OrganizeOS retries like any 5xx. Collections missing from the snapshot are not retired yet: a removed collection's Resource stays until a later change.

8. **Agent** (OrganizeOS → builder, `POST /internal/organizeos-agent`, `ORGANIZEOS_AGENT_TOKEN`). The OrganizeOS advisor's website tools read the org's draft through it (`routes/internal.organizeos-agent.tsx`, `shared/db/organizeos-agent.server.ts`). Its own secret, so a leaked provisioning token cannot reach content and this one cannot provision: unset or empty, the route answers 404 before any other check; a wrong token or any `Cookie` answers 401, and a method other than POST 405. The body is a strict schema, `{ organizationId, actorUserId, operation, args }`, each operation with its own strict `args`; the list is closed, and nothing in it publishes. The reads: `website_overview` (the pages, home first, with each page's static title or null, whether the draft has changes not yet published, and when it was last published), `website_read_page` (`{ pageId }`: the page root's direct children as sections, each with its plain text flattened from the instance tree and capped at 2,000 characters, and its type read from an `os-section:{type}` label, else `custom`) and `website_list_images` (the project's uploaded images, newest first, at most 100, by the name a person gave them, never the storage key). The fork trusts OrganizeOS for who may act, as it does for provisioning; `actorUserId` is never used for authorization. Ids come only from `organizationId`: the project is `deriveProjectId(organizationId)`, and an id in `args` is matched only inside that project's build, so one from anywhere else answers `not_found`. Answers: `200 {"ok":true,"result":...}` or `200 {"ok":false,"code":"not_found"}`; `400 {"ok":false,"code":"invalid_input"}` for a body that fails the schema; `500 {"ok":false,"code":"unavailable"}` for an unexpected error, logged with the operation name and the error's kind only. Spec: `docs/superpowers/specs/2026-10-27-builder-agent-tools-design.md` in the OrganizeOS repo, 4.5 and 11.

**Session binding.** A builder session lives no longer than the OrganizeOS session that opened it. The SSO token's `sid` claim (the GoTrue session id; `readSid` in `organizeos-token.server.ts` accepts a UUID only) and `sub` (the OrganizeOS user id) are stored in the dashboard session as `organizeosSid` and `organizeosUserId`, and the WS OAuth hop copies them through the code token (`oauth.ws.authorize`), the access token (`oauth.ws.token`) and the `ws` strategy callback (`builder-auth.server.ts`) into the project-host session. Every session read goes through `readDashboardSession` or `readBuilderSession` (`services/auth-strategy/organizeos-session.server.ts`): `extractAuthFromRequest`, `findAuthenticatedUser` and `oauth.ws.authorize`, and a test fails if any other module calls `isAuthenticated(`. The readers ask OrganizeOS `websites2_sso_session_live(p_session_id, p_user_id)` (service role only; false once the session is signed out, revoked, or idle for 12 hours), cached per sid and user for 60 s per instance (5 s for an RPC error). Outcomes: `pass` (SSO not configured), `live`, `missing` (no binding: a session from before this shipped, or a non-SSO login), `dead`, `error`. Under `observe` every outcome but `live` and `pass` is logged (`console.warn` with the builder user id and the first 12 hex of the sid's SHA-256, never an email; at most once a minute per user, sid and outcome on an instance) and allowed; under `enforce` `missing`, `dead` and `error` read as no session: loaders send the admin to the login page (which leads back to OrganizeOS), `oauth.ws.authorize` redirects there instead of minting a code (so the builder does not loop), and tRPC and patch calls are unauthorized. The cookie is not rewritten on the read path. The binding module has its own PostgREST client and must never call `createContext` or import `shared/context.server.ts`: `createContext` reads the session through these readers. Shipping it bumped the session cookie version to `4-organizeos` (fork-distinct, so upstream's next bump never reads our cookies), which signed every builder user out once. Spec: `docs/superpowers/specs/2026-10-21-builder-session-binding-design.md` in the OrganizeOS repo.

**Draft preview on the canvas.** The canvas shows a collection's drafts as well as its published items (OrganizeOS design `docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md`, 4.5). Every canvas Resource fetch runs on the builder's server, in `routes/rest.resources-loader.ts`, and one marked change there passes each outgoing fetch through `createPreviewAssertion` (`shared/organizeos-preview.server.ts`). It adds `X-OOS-Preview: v1.{payload}.{mac}` only when all of these hold, and otherwise the fetch goes out unchanged: `WEBSITES2_PREVIEW_SECRET` is set; the fetch URL, parsed with `new URL` (never a string prefix), has the origin of `ORGANIZEOS_APP_URL`, no userinfo, no encoded slash, backslash or dot, and a pathname under `/api/public/v1/collections/`; the request carries a builder session whose OrganizeOS binding is `live` (`readBuilderSession`, then `checkOrganizeosBinding`, both cached); that user, signed in as a user and not through a share link's token, has upstream's `view` permit or above on the project of the `p-{projectId}` host (`authorizeProject.hasProjectPermit`); and the project's owner is an org's service account, the organization id resolved as the builder loader resolves it and cached per project for 60 s in-process. The session, permit and org are resolved once per loader request, on its first qualifying fetch; each fetch gets its own assertion. `payload` is base64url (unpadded) of the UTF-8 JSON `{ org, sub, sid, iat, exp }` in that key order: the org id, `organizeosUserId`, `organizeosSid`, and Unix seconds with `exp = iat + 60`. `mac` is base64url (unpadded) of HMAC-SHA256, keyed by `WEBSITES2_PREVIEW_SECRET`, over the ASCII payload segment, and the segment sent is the one signed. The header replaces any stored `X-OOS-Preview` in any casing (`Headers.set`), never appends: a duplicated header arrives comma-joined and the platform refuses it. It is added after the client computed the Resource's cache key (`getResourceKey`), which is unchanged, and never enters build data. The byte format is pinned by the platform's `client/tests/fixtures/site-components/preview-assertion.json`, copied to `apps/builder/app/shared/__fixtures__/` (its README names the source commit; `diff` it before a PR that touches the assertion). The platform verifies the MAC, the time window, the org against the read token's, the session's liveness and the user's `pages.view`, and on any failure serves published items as if the header were absent. A published site never carries the header: prebuild fails when any Resource's stored headers name it, in any casing (`packages/cli/src/organizeos-preview-header.ts`, one marked call in `prebuild.ts`).

Backward compatibility: every new claim and body field (`subdomain`, the status report) is optional on the builder side, so either repo can deploy first. A project provisioned before OrganizeOS sent a subdomain keeps its `org-<id>` placeholder domain (Back to OrganizeOS then opens the app's dashboard; the Publish dialog takes the subdomain from OrganizeOS's answer and is unaffected) until the next SSO entry or re-provision. The dialog reads `launchable` only when `websites2_site_addresses` sends it: a missing or `null` field shows no warning, so either side can add it first. `guardLevel` is the exception to "either repo first": OrganizeOS's callback refuses a key it does not know, so it accepted the field before this workflow sends it.

Working on the integration needs both repositories. In a Claude Code session, attach the second repo with the `add_repo` tool (the session's GitHub scope then covers both); the builder-side change comes first, the OrganizeOS-side change second, and neither breaks the other in between.

## 6. Browser support

No blocking browser gate. Upstream interrupted Firefox and Safari with a full-screen "supports Chromium-based browsers... we plan to support Firefox and Safari" overlay. It is removed: it is an upstream roadmap OrganizeOS has not made, and it is not true of this code — every Chromium-only API in the builder is feature-detected with a working fallback, and the repo carries deliberate Firefox and Safari support work. The one real gap it was covering (CSS Typed OM is Chromium-only, so the style panel converted a keyword value to a unit using `0`) is fixed at the point of failure in `canvas/selected-instance-effects.ts`. There is still no automated Firefox or Safari coverage — the Playwright harness launches Chromium only.

## 7. OrganizeOS overlay (keep minimal for upstream merges)

Changes confined to: env/config, the proprietary-package removal (this doc §2), auth/SSO + provisioning files (`services/auth-strategy/organizeos*`, `routes/internal.*` (among them the agent endpoint, `routes/internal.organizeos-agent.tsx`, with `ORGANIZEOS_AGENT_TOKEN` in `env/env.server.ts`, §5), `shared/db/provision.server.ts`, `shared/db/organizeos-*.server.ts`, `shared/db/collections-sync.server.ts`, and the data catalog `shared/db/resource-presets.server.ts` and `shared/db/signup-form-preset.server.tsx`, whose ids `shared/organizeos-preset-ids.ts` derives for the server and the browser alike), the blocks' deny list (`ORGANIZEOS_BLOCKS_DENY_ORG_IDS` in `env/env.server.ts`, which replaced the allowlist `ORGANIZEOS_BLOCKS_ORG_IDS`; parsed by `parseOrgDenyList` and passed to `resolveOrganizeosSite` by the loader in `routes/_ui.(builder).tsx`, which reports a malformed value once with `reportMalformedOrgDenyList`; and synced to the canvas by one marked `organizeosSite` line in `shared/sync/sync-stores.ts`), the catalog's survival of its bindings (one marked branch each in `shared/instance-utils/mutation.ts` `deleteInstanceMutable`, `shared/data-variables.ts` `deleteVariableMutable` and `settings-panel/variable-popover.tsx`: a Resource whose id is a derived v5 UUID is never deleted with a binding, §9), the session binding (`services/auth-strategy/organizeos-session.server.ts`, called from `extractAuthFromRequest` in `shared/context.server.ts`, `findAuthenticatedUser` in `services/auth.server.ts` and the loader of `routes/oauth.ws.authorize.tsx`; the two optional fields and the `4-organizeos` cookie version in `services/auth.server.utils.ts`; the fields carried by `services/token.server.ts`, `routes/oauth.ws.authorize.tsx`, `routes/oauth.ws.token.ts` and the `ws` callback in `services/builder-auth.server.ts`; `ORGANIZEOS_SESSION_BINDING` in `env/env.server.ts`; tests in `organizeos-session.server.test.ts`, `routes-tests/oauth-ws-authorize.server.test.ts` and `env/env.server.test.ts`, and cases in `services/token.server.test.ts` and `shared/context.server.test.ts`; §5), the draft preview (§5: `shared/organizeos-preview.server.ts`, called by one marked change in `routes/rest.resources-loader.ts`, with `WEBSITES2_PREVIEW_SECRET` in `env/env.server.ts`, the fixture copy in `shared/__fixtures__/`, tests in `shared/organizeos-preview.server.test.ts` and `routes-tests/rest-resources-loader.server.test.ts`; and the CLI's `packages/cli/src/organizeos-preview-header.ts`, called from one short marked hook in `prebuild.ts`, with its test and a case in `prebuild.test.ts`), the publish seam (`services/organizeos-publisher.server.ts`, `shared/db/publish-status.server.ts`, `publish-site.yml`), the guard level (§5: `ORGANIZEOS_GUARD_LEVEL` beside the switch in `packages/sdk-components-organizeos/src/org-script.ts`, its test `packages/cli/src/organizeos-guard-level.test.ts`, and the "Read the guard level" step of `publish-site.yml`), the Publish dialog's address read (§5: `shared/db/organizeos-site-addresses.server.ts`, `routes/rest.organizeos-site.$projectId.ts`, the fixture copy `shared/__fixtures__/site-addresses.json`, and `features/publish/organizeos-publish-addresses.ts` in the dialog; tests in `shared/db/organizeos-site-addresses.server.test.ts` and `routes-tests/rest-organizeos-site.server.test.ts`), asset serving (`shared/asset-response.server.ts`, the three `routes/cgi.*` loaders, `asset-uploader`'s S3 client), the CMS overlay (§9, "The CMS overlay": `builder/features/cms-panel/*`, with its tests, among them `cms-icon.tsx`, the database icon; in `sidebar-left/sidebar-left.tsx`, the one `<CmsRailButton />` after the tab triggers in the rail, the `ref={registerCmsRail}` on the rail's column, the `hideCmsOverlay()` branch in a tab trigger's click, and the one `<CmsOverlay />` outside the tab content; the per-panel `maxWidth` and `defaultWidth` in `PanelConfig`, which no panel sets since the CMS left the sidebar; `$computedResourceRequests` exported by one marked change in `shared/nano-states/props.ts`; `cmsPanelEnabled` on `OrganizeosSite` (`shared/organizeos-site.ts`), set by `resolveOrganizeosSite` from `ORGANIZEOS_CMS_PANEL` in `env/env.server.ts`, passed by the loader in `routes/_ui.(builder).tsx`; and the app's origin in that route's `frame-src`, through `builderFrameSrcPolicy` in `shared/frame-protection.ts`), frame protection (`shared/frame-protection.ts` and the `headers` exports of `root.tsx`, `routes/_ui.(builder).tsx`, `routes/_ui.dashboard.tsx` and `routes/_ui.$.tsx`), branding (`shared/branding.ts`; the OrganizeOS mark v3 in `shared/organizeos-logo.tsx`, the OrganizeOS repo's `LOGO_MARK_PATHS` drawn inline in the brand's in-app pair like its `BrandMark`, ink on light and cream on dark, shown where upstream showed its logo in `auth/login.tsx`, `features/menu/menu-button.tsx` and `builder/shared/loading.tsx` (those two on the dark topbar colour, so `on="dark"`) and `shared/error/error-message.client.tsx`; and `public/favicon.ico`, OrganizeOS's teal browser-tab favicon at 16, 32 and 48 px, packed by ImageMagick, `convert favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon.ico`, from the OrganizeOS repo's `client/public/favicon-16x16.png` and `favicon-32x32.png` and a 48 px frame drawn from its `client/public/brand/organizeos-favicon.svg` by the favicon call of its `client/scripts/generate-pwa-icons.mjs`, `sharp(svg, { density: 300 }).resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 })`, run with the builder's sharp 0.33.5), the OrganizeOS-only chrome behind `$organizeosSite` (`features/publish/organizeos-publish*.ts*`, small branches in `menu.tsx`, `topbar.tsx`, `publish.tsx`; `organizeosHomeUrl` in `shared/organizeos-site.ts`, which the menu's "Back to OrganizeOS" opens, with `shared/organizeos-site.test.ts`), the OrganizeOS blocks (§9: the `packages/sdk-components-organizeos` package, `@organizeos/site-components`, a `workspace:*` dependency in `apps/builder/package.json` and `packages/cli/package.json`, and so in `pnpm-lock.yaml`, registered by one `registerComponentLibrary` call in `canvas/canvas.tsx`; their builder UI, `features/organizeos-panel/*`: the blocks listed by one marked OrganizeOS section in `features/components/components.tsx` (its group, heading and links, and a click or Enter on a block routed to `insertOrganizeosBlock`), the Background presets section, one marked entry in `features/style-panel/sections/sections.ts`, the Motion tab, marked lines in `builder/inspector.tsx` with `$activeInspectorPanel` widened to take `"motion"` in `builder/shared/nano-states.ts`, the OrganizeOS data tab in `sidebar-left/sidebar-left.tsx` (shown only for an org the deny list does not deny) and `sidebar-left/types.ts`, the CMS page templates (§9: `collection-schema.ts`, `collection-layout.ts`, `collection-pages.ts`, `collection-list.ts` and `collection-row-menu.tsx`, with their tests, the collection rows in `organizeos-data.ts` and `organizeos-panel.tsx`, and cases in `shared/db/resource-presets.server.test.ts` and `shared/organizeos-preview.server.test.ts`), the site templates (§9, "Site templates": in the blocks package, the `src/site-templates/` folder (`canonical-variables.ts`, `place-block.ts`, `types.ts`, `render.ts`, `check.ts`, `style-scan.ts`, `sections.ts`, `catalog.ts`, `index.ts`, `assets.d.ts` and the spike, a fixture in `__fixtures__/spike/` with its `images/`, which the catalog does not list and `index.ts` does not export, with tests beside the modules that hold logic; the `@fontsource` and `@fontsource-variable` packages whose `woff2` files the templates bundle, devDependencies in the package's `package.json` and so in `pnpm-lock.yaml`), exported by the package's `package.json` as `@organizeos/site-components/site-templates` and, alone, as `@organizeos/site-components/site-templates/canonical-variables`, with the two matching entries in its `vite.build.config.ts`, and imported by none of `components.ts`, `metas.ts` and `hooks.ts`; the block templates as factories, `signupFormTemplate` in `signup-form.template.tsx`, `rsvpFormTemplate` in `rsvp-form.template.tsx` and `rotatingTabsTemplate` in `rotating-tabs.template.tsx` (`block-factories.test.tsx`), and the block tokens reading the site variables in `shared/form-tokens.ts` and `events/event-card.template.tsx` (`shared/form-tokens.test.ts`); in the builder, `features/organizeos-panel/site-templates/` (`apply-site-template.ts` and `template-chooser.tsx`, with their tests, and `bundled-fonts.test.ts`), one marked loop in `shared/db/canvas.server.ts`, with its import, that keeps a font the canonical font variables name (`findCanonicalFontFamilies` in `shared/db/organizeos-canonical-fonts.server.ts`, with its test), two marked changes in `getFontData` in `packages/asset-uploader/src/utils/font-data.ts`, with its import, that take from a font's family the instance its legacy name carries (`dropInstanceNames` in `organizeos-font-family.ts` beside it, with `organizeos-font-family.test.ts`), one marked import and one marked `<TemplateChooser />` mount in `builder/builder.tsx`, pinned by `overlay.wiring.test.ts`, the `instanceIdPrefix` option of `completeOrganizeosFragment` in `insert-organizeos-block.ts`, `getDefaultRoles` in `section-background.tsx` taking the roles by name (importing `site-templates/canonical-variables` alone), `deleteSubtreeMutable` exported from `collection-pages.ts`, and `SIGNUP_PAGE_PATH` moved from `shared/db/signup-form-preset.server.tsx` to `shared/organizeos-preset-ids.ts`, so the browser can read it; with cases in `insert-organizeos-block.test.tsx`, `section-background.test.tsx` and `shared/db/signup-form-preset.merge.server.test.tsx`), one branch in the canvas's drop handler, `canvas/shared/use-drag-drop.ts`, so a dropped block is bound to the project's data like a clicked one, and `features/organizeos-panel/overlay.wiring.test.ts` pinning the marked lines; an `onInsert` option on `insertWebstudioFragmentAt` (`shared/instance-utils/insert.ts`) that completes the insert in its own transaction, and an `onWrap` option on `wrapInstance` (`shared/instance-utils/mutation.ts`), a third optional parameter called inside the wrap's transaction after the content-model check, through which the Motion tab writes its Animate Children's props in the wrap's undo step (§9), with two cases in `shared/instance-utils/mutation.test.tsx` (its writes undo with the wrap; it is not called for a refused `li`); their record picker, `settings-panel/controls/organizeos-record.tsx`, behind one branch in `settings-panel/controls/combined.tsx`; and the CLI's copy of their build into every published site, `packages/cli/src/organizeos-components.ts`, called from short hooks in `prebuild.ts` and `framework-react-router.ts`, with cases in `prebuild.test.ts`; `organizeos-components.ts` also copies the package's `LICENSE` and computes the source-offer URL, used by one more short hook in `prebuild.ts`; `html.tsx` carries a second marked change, the source offer (its head links and the visible Source link at the end of the body, §1), with cases in `prebuild.test.ts` and `organizeos-components.test.ts`; the copy also carries `page.js`, the package's second entry for published pages (`src/page.ts`, built by the package's `vite.build.config.ts`), and `html.tsx` carries a third marked change, the page's share-code carrier imported from it (§8), through the placeholder `__ORGANIZEOS_PAGE__`, which the same `prebuild.ts` hook resolves beside the source URL and `packages/cli/src/organizeos-placeholders.d.ts` declares; the fixture `fixtures/react-router-vercel` carries copies of the cache module and of the html route changes), the org script pause (§10: `packages/sdk-components-organizeos/src/org-script.ts`, which the blocks package exports as `@organizeos/site-components/org-script` and builds with its own `vite.build.config.ts`; `acorn`, a dependency of the blocks package for the address rule, and so in `pnpm-lock.yaml`; `canvas/organizeos-org-script.tsx`, with one marked change in `canvas/canvas.tsx` that registers upstream's base library through it, and four marked changes in `canvas/features/webstudio-component/webstudio-component.tsx` (a skip in `useInstanceProps` of a `dangerouslySetInnerHTML` prop, a skip there of a tag the builder does not offer, or of an SVG `animate` or `set`, whether it is `instance.tag` or a `data-ws-tag` or `tag` prop on any component but `ws:element` and XML Node, a fallback to `div` in `WebstudioComponentCanvas` and `WebstudioComponentPreview` for a `ws:element` with such a tag, and a drop, in both renderers, of such a tag prop, an unsafe address, a `srcdoc` and an event handler attribute from every prop the component receives (`withoutPausedProps`, given the instance)) that keep both off every component; one marked branch in `shared/project-settings/section-general.tsx`; `features/publish/organizeos-publish-paused-script.ts`, whose banner is in `organizeos-publish.tsx`; and the CLI's `packages/cli/src/organizeos-org-script.ts`, called from one short marked hook in `prebuild.ts`; one marked header in `route-templates/xml.tsx` (§8); with tests beside each, among them `canvas/organizeos-org-script.wiring.test.ts`, `canvas/organizeos-org-script.props.test.tsx`, `packages/cli/src/organizeos-org-script.unsafe-values.test.ts` and `packages/cli/src/organizeos-publish-workflow.test.ts`), the guards' wiring (the `check:*` scripts and `checks` in the root `package.json`, and `.github/workflows/main.yml`, both of which also build the blocks' package, with the workspace packages it imports, before the tests), and the forced CLI route-template patches for the reverse-proxy host/auth/cache (§8), among them the published site's resource cache (`packages/cli/templates/react-router/app/organizeos-resource-cache.ts`, which one marked change in each of the react-router route templates `html.tsx`, `xml.tsx` and `text.tsx` calls, with its tests in `packages/cli/src/organizeos-resource-cache.test.ts` and cases in `prebuild.test.ts`, among them an item page's 404), and two bug fixes worth offering upstream: `packages/cli/src/asset-files.ts` waits for a failed download's write stream to close before deleting its `.tmp` file (otherwise a fast failure could delete it before the stream created it, leaving it behind and flaking `asset-files.test.ts`), and `createLocalStyleSource` in `apps/builder/app/shared/tailwind/tailwind.ts` writes an element's style source selection back when one already existed (otherwise an element that kept a token from a pasted `<style>` class rule lost every Tailwind style, with a case in `tailwind.test.tsx`). Avoid deep edits to shared component `.tsx`; isolate OrganizeOS code so `upstream main` can be merged with minimal conflict.

## 8. Published-site route template patches

`packages/cli/templates/react-router/app/route-templates/html.tsx` is a forced
patch (see §5): it is the published site's entry, so the reverse-proxy host,
auth and cache behaviour have to be right there rather than in a package we
keep byte-identical.

**Page authentication runs on every host.** Upstream skipped
`authenticateRequest` whenever the request host equalled `projectDomain` or was
a subdomain of it, because `projectDomain` was the Webstudio staging label and
staging carried its own separate credentials. In this fork `Project.domain` is
the org's platform subdomain (§5), so `acme` matched `acme.organizeos.org` —
the site's primary public host — and a page the org had password-protected was
readable by anyone there, while the same page stayed protected on a custom
domain. There is no staging host here, so the skip protected nothing and was
removed. Unprotected sites are unaffected: `authenticateRequest` returns early
when no auth route matches the path.

Do not reinstate a host-based skip when merging upstream.

**Published images are served as originals.** The `imageLoader` in
`packages/cli/templates/react-router-vercel/app/constants.mjs` (and its copy in
`fixtures/react-router-vercel`) returns `src` unchanged. Upstream builds
`/_vercel/image?url=&w=&q=` URLs, which the sites deployment's own optimizer
would answer. Here a site is served on the org's host through the OrganizeOS
proxy, and Vercel answers `/_vercel/image` on that host with the OrganizeOS
app's optimizer instead. Its allowed widths and qualities are not the
builder's, and it cannot fetch this deployment's `/assets/*`, so every
optimized URL failed with `INVALID_IMAGE_OPTIMIZE_REQUEST`. Real image
optimization is a later item to design with the OrganizeOS side. Keep the
patch on upstream merges.

**Resource GETs go through an in-memory cache.** A page renders on every
request, and its loader fetches every resource the page reaches; Vercel's CDN
caches none of them (they carry `Authorization`), and the sdk's own hook,
`cachedFetch`, needs a Cache API the Node runtime lacks. So each of the three
react-router route templates (`html.tsx`, `xml.tsx`, `text.tsx`) sends the
final fallback of its loader's `customFetch` through `siteResourceCache`, in
one marked change. That is the one instance
`templates/react-router/app/organizeos-resource-cache.ts`, fork code the CLI
copies into every site, creates at module scope. Each call passes the fetch
behind the cache, which is what the template called before:
`cachedFetch(projectId, …)` in `html.tsx`, so a request that opts into the
Cache API still reaches it where there is one, and the global `fetch` in the
other two. The cache keeps a GET's response only as its own `Cache-Control`
allows, under RFC 9111's shared-cache rules (the module's header lists them),
keyed on the URL and every request header, for at most 300 seconds; it
refreshes an entry once however many requests wait, whichever routes they come
from, and answers a failed refresh with the stale entry within the response's
`stale-if-error`. It stores a 200, and a 404 that declares a lifetime
(`s-maxage`, or `max-age` under the same `Authorization` rules). The
platform's collections item route answers a missing item with a 404 and
`public, s-maxage=60` (OrganizeOS design
`2026-10-27-cms-page-templates-design.md`, 4.3), so a CMS item page (§9, "CMS
page templates") for a missing slug costs one platform read a minute per
instance, as a found one does, instead of one per request against `/v1`'s
rate limit. A 404 with no lifetime, a 401 and every 5xx are never stored. A
404 is an answer, not a failed refresh: it replaces a stored entry and never
brings back the stale one. The html route answers with the page meta's
`status`, so that page renders its own "not found" box with status 404
whether its Resource answered 404 or failed (`prebuild.test.ts`, "answers an
item page with the status its meta computes"). The form action's
`loadResource(fetch, resource)` is not cached. The request behind a miss or a
refresh, its body read included, has a
deadline: `AbortSignal.timeout`, joined with any caller signal through
`AbortSignal.any`. It is 4 seconds when the stale entry will still be usable
once the 4 seconds pass (the code checks `requestedAt + 4s < staleUntil`, where
`staleUntil` is the end of the entry's `stale-if-error` window), and 10 seconds
otherwise: with no stale entry, or one whose window ends within those 4
seconds. Past the deadline the request is aborted and counts as a network
error. A hung platform is then answered with the stale entry, followed by the
usual 10-second backoff. With no stale entry that can answer, the resource
fails after 10 seconds (the sdk's `loadResource` turns that into `ok: false`).
Either way, a hang no longer holds every render that waits on the shared
refresh.

There is one cache per server instance, shared by every route, and its bounds
(200 responses and 16 MB of bodies, least recently used evicted first) are per
instance. The Vercel preset puts routes in one server function unless a route
exports its own `config` (none does), and a build of the fixture shows one
server bundle with one copy of the module, every route calling the same
instance. Keep the patches on upstream merges: without them a page view costs
one platform call per resource again (§9, the rollout gate).

**Share codes on every page.** Every html route renders `PageShareCodeCarrier`
from the copy of the blocks' package (`app/__organizeos__/page.js`, the
package's page entry, `src/page.ts`), appended after the source offer in
`PageWithSourceOffer`, in one marked change. It is the blocks' carrier,
`attachShareCodeCarrier`, on the document (§9, "Share codes"): a click on any
same-origin link to a platform page, a designer's own included, carries the
visit's `?r=` code there, and a plain click goes by document, which keeps the
site's router out. It renders nothing, reads the code only at the click and
writes no cookie or storage, so the server's markup is the same whatever the
address. With a block's carrier on the same page, the document's
capture-phase listener runs before the block root's, so a click gets the code
once and navigates at most once. The route imports it through the placeholder
`__ORGANIZEOS_PAGE__`, which prebuild's marked hook resolves to the path from
the route to the copy (`../__organizeos__/page.js`), as upstream resolves
`__CLIENT__`. `packages/cli/src/organizeos-placeholders.d.ts` declares it, so
the template typechecks in the CLI, where no copy exists. The copy is part of
the fork code each page's source offer covers (§1); it is the fork's own
code, not org script, so the pause (§10) does not touch it. The builder never
renders the route templates, so nothing changes on the canvas or in the
Preview, and the xml and text routes have no links and do not mount it. The
fixture `fixtures/react-router-vercel` carries the change in its two html
routes with the placeholder resolved; it does not commit `app/__organizeos__/`
(prebuild writes it), so its html routes neither typecheck nor build until
prebuild has written it, and CI neither typechecks nor builds fixtures. Keep it
on upstream merges (`prebuild.test.ts`, "every html route imports the page's
share-code carrier from the copy of the build and renders it").

**XML pages answer sandboxed.** `xml.tsx` adds `Content-Security-Policy:
sandbox` and `X-Content-Type-Options: nosniff` to an XML page's response, in
one marked change, so an XML element that is a script in another namespace
never runs on the org host. Sitemaps and feeds are read by crawlers and
readers, which ignore the policy. Keep it on upstream merges (`prebuild.test.ts`,
"an XML page answers with a sandbox policy and nosniff"). The fixture copies of
the route stay upstream's: `pnpm fixtures` writes the header into
`fixtures/webstudio-features/app/routes/[sitemap.xml]._index.tsx`, a render of
upstream's `xml.tsx`, and `git checkout -- fixtures` drops it with the rest of
that drift (§10, "Fixtures").

**Content types under the proxy's `nosniff`.** The OrganizeOS site proxy sends
`X-Content-Type-Options: nosniff` with every response, so a script or a
stylesheet must arrive with its own type, and nothing here changes for it: the
site's own `.js` and `.css` come from the Vite build and are served as
`application/javascript` and `text/css`; an upload keeps one of the extensions
`packages/sdk/src/assets.ts` allows, which Vercel types from the deployment's
`/assets/`; the route templates set the HTML, XML and text types themselves;
and an upload used as a script or a stylesheet would be org script, which is
paused (§10). PDF, HTML, XML and SVG can be uploaded: the proxy answers every
response but the site's own HTML pages with its sandbox policy, PDFs excepted,
since a browser does not render a sandboxed PDF.

## 9. OrganizeOS components

Blocks for OrganizeOS's platform features: a block is a root and parts that a
designer places and styles like any element, while what it does (validation,
opt-in, tags) stays on the platform, in services Website Lite shares. Phase 1
ships the Signup Form; phase 2a (display) the Event List and the Event Card;
phase 2b (RSVP) the RSVP Form. Design and plans are in the OrganizeOS repo
(`docs/superpowers/specs/2026-10-01-website-builder-platform-components-design.md`,
`docs/superpowers/plans/2026-10-02-website-builder-signup-form.md`,
`docs/superpowers/plans/2026-10-14-website-builder-events.md`); its
`docs/features/website-builder-components.md` covers both halves.

**The package**, `packages/sdk-components-organizeos`, npm name
`@organizeos/site-components`:

- `private`, never published to npm, AGPL-3.0-or-later like the rest of the
  fork (its own `LICENSE`). Shaped like `sdk-components-react-radix`:
  components, metas, templates and an empty hooks list, the `webstudio` export
  condition to `src/`, `lib/` otherwise, built with
  `vite.sdk-components.config.ts`.
- **Signup Form** is the root: it renders the `<form>`, finds its form by its
  `record` prop in its `data` prop (with no `record`, the org defaults: email
  required; first name, last name and phone optional), and on a published page
  posts what its parts collect, and the page's share code when it has one
  (Share codes, below). Its parts are **Submit Button** and **Field**,
  which names a form field and wires its **Field Label**, **Field Input** and
  **Field Message** together. `src/form/` holds what later families share: part
  registration, the submit helper, the canvas check.
- Every meta is `category: "hidden"`, so upstream's grouping in the
  Components panel skips the blocks, and the panel's OrganizeOS section lists
  them (In the builder, below). The **Signup Form template** binds the root's `state` to a
  `formState` variable, shows its state boxes with `ws:show`, styles the parts
  through the tokens "OS Field", "OS Input", "OS Button" and "OS Message", and
  leaves `data` unbound for the insert. The four tokens are defined once, in
  `src/shared/form-tokens.ts`, for the Signup Form and the RSVP Form alike: a
  project that has both reuses one token each, so the two templates cannot
  drift apart.
- **Event List** and **Event Card** are templates over native elements and a
  collection under a Share Code Carrier root, with no component of their own
  (the package registers no component for them, and `components.ts` never
  reaches their template files, so a published site's copy of the package does
  not carry them). Both have the same root, a **Share Code Carrier** (a `div`,
  see Share codes below), a grid, holding a `ws:collection` of cards (id
  `events`), a "No upcoming events" box (id `empty`) and an "Events
  unavailable" box (id `unavailable`): the designed Unavailable state that
  spec invariant 11 asks for, with placeholder text the designer edits. The
  card is `src/events/event-card.template.tsx`, one function of the
  collection's `event` parameter: an `article` wearing the shared token "OS
  Card" with a Cover image (shown only for an event with a `cover_image_url`),
  the Title, a Time element for the start time (rendered in the event's own
  `timezone`, a literal `dateStyle` "full" and `timeStyle` "short"), the Place
  (shown only for a `location_name`) and a link to the event's page,
  `/events/{slug}` on the site's own host, which the platform serves, opened
  with a document navigation (`reloadDocument`: the site has no route there);
  a bound address with a fixed start is published while org script is paused
  (§10). The two `ws:show` expressions are `(x ?? "") !== ""`:
  false for `null`, `""` and a missing key, where a bare `!== null` would be
  true for a missing key. A Time given a zone it does not know falls back to
  UTC, so a build made before the platform sends `timezone` renders UTC rather
  than failing. The Event Card is the Event List's template under its own label
  and shows the next upcoming event (one item, see Insert completion); picking
  a specific event waits for the events virtual collection.
- **RSVP Form** is the root of the Events RSVP block (phase 2b). It renders the
  `<form>`, finds its event by its `record` prop (an event id) in its `data`
  prop (the `GET /v1/events` body, from the project's Events Resource), and on
  a published page posts what its parts collect to
  `POST /api/public/site/v1/rsvps`. The `GET /v1/events` item carries the
  registration details the form reads: the event's start and end, its time
  zone, whether it has a waitlist and whether it is full, how many guests it
  takes (`max_guests`), its shifts with their roles and its questions. The
  event is read leniently (`rsvp/events-data.ts`), as the Signup Form's forms
  are: a published site freezes this code while the DTO can gain fields, so an
  entry with no string id is skipped, an unknown key is ignored and a question
  type the build does not know is asked as a line of text.
  - **Parts.** The Signup Form's **Field** (with **Field Label**, **Field
    Input** and **Field Message**) and **Submit Button** work unchanged, because
    they read only the shared form context; the RSVP Form gives its Fields
    `first_name`, `last_name` and `email` (required) and `phone` (optional),
    with the endpoint's lengths (100, 100, 320 and 40). Four parts are its own:
    **Guests** (the guest rows, up to the event's `max_guests`, names only; it
    renders nothing for an event that takes none), **Shift Options** (a
    checkbox per shift, and for a single ticked shift with roles a radio group
    of its roles; a full shift or role is disabled and carries `data-full`),
    **Questions** (one group per question, with a control for its type) and
    **Email Consent** (an unchecked checkbox, labelled by the part's own
    children). The first three render their own controls, because a template
    cannot know an event's shifts or questions and a component cannot repeat
    builder children; their inner elements are styled through `ws:descendant`
    instances (see the template). Each hands the root what it collected, and
    the root keeps only the keys the endpoint's strict body takes, and the
    parts bound what they collect: a guest's name to the 100 characters the
    endpoint takes (the input stops there, and `collect` cuts what autofill put
    in), a text or textarea answer to 2000 characters while typing, as Website
    Lite's, and to the endpoint's 5000 when collected, and the answers to 100,
    the required ones kept first. Answers are serialized as Website Lite sends
    them, with one difference: a number typed with an exponent ("1e3") is
    written out as a plain decimal, digit for digit, because the strict endpoint
    refuses an exponent. A number is never cut, and one that would not fit in
    5000 characters is collected as typed, for the root to refuse (see What a
    submit does).
  - **States** are `initial`, `submitting`, `registered`, `waitlisted`, `full`,
    `ended`, `error` and `unavailable`, on the root's `state` prop and its
    `onStateChange` action, as the Signup Form's. On a published page the form
    reports `unavailable` for an event it cannot find (no `record`, no
    `data`, or the event is not in it), `ended` for an event that is over (its
    end time, or its start time when it has none, is past) and `full` for a
    full event with no waitlist, before the visitor can submit.
  - **What a submit does.** It reports `unavailable` and posts nothing when a
    Field Input for `first_name`, `last_name` or `email` is missing, or when the
    event has required questions and no Questions part: the platform's answer
    would name a field the page has no part to show it on. A value longer than
    the endpoint takes (set by autofill, say, which `maxlength` does not stop,
    or a number answer, which is never cut) posts nothing and shows that
    field's message, or the message under that answer's question. The body is
    `event_id`, `first_name`, `last_name`, `email`, `phone` (left out when
    blank), `guests`, `shift_ids`, `shift_role_id` and `answers` (each left out
    when empty), `email_consent` (`false` without the part), `page_path`
    (`window.location.pathname`), `website` (the honeypot) and, when the
    page's address has a well-formed share code, `referral_code` (Share codes,
    below).
  - **Answers.** `registered` and `waitlisted` show their states, and a
    successful RSVP goes to the Page prop's page instead when After submit is
    set to page (a waitlisted visitor always sees Waitlisted). `ended` and
    `not_found` show Ended and Unavailable, any other error shows Error, and an
    outcome the build does not know shows Registered, so a frozen build
    survives a new answer. `invalid_field` sets a message on the part
    that shows the field (a Field Message, Guests, Shift Options or Questions).
    `role_full` keeps the form up with "That role just filled. Pick another."
    on the role, and marks the chosen role and every other role of the shift
    that the answer does not list in `open_roles` as full; a role it lists as
    open is enabled even when the event data, which can be a minute old
    (`s-maxage=60`), says full. The list may be empty (the platform refuses a
    role without room whatever its siblings hold), which marks every role of the
    shift full, and the visitor can still choose no role or another shift. The
    platform measures a role's room, and so `open_roles`, for the visitor and
    their guests together, so with guests in the request the message is "That
    role has no room for your whole party. Pick another, or bring fewer
    guests." and no role is marked full (a role that has no room for three may
    have room for one, and a mark would outlive the guests the visitor removes);
    the roles the answer lists are still enabled, since room for the party is
    room for fewer. The endpoint also answers `full` for a picked shift with no
    room, which it measures for the whole party on any event, and, on an event
    with no waitlist, for a party that does not fit, so the Full state is for a
    request the visitor cannot change to fit (no shifts, and no guests on an
    event with no waitlist). With shifts in the request the form stays up with
    "That shift just filled. Pick another, or none." on the shifts, and with
    guests as well, on an event with no waitlist or with shifts in the request,
    with "There is not room for every guest. Try with fewer." on the guests. On
    an event with a waitlist and no shifts a party that does not fit is
    waitlisted, so a `full` there is never about the guests.
  - **The canvas check** draws a warning on the root for a form inside another
    form or root, no event picked, no `data`, an event that is not in it, a
    missing Field for a required field, a missing Submit Button, required
    questions with no Questions part, and a Field naming anything but the four
    fields. It only notes, as not faults, that the event has ended or is full
    with no waitlist (the live site shows Ended or Full), that it has shifts and
    no Shift Options, and that it takes guests and no Guests.
- The **RSVP Form template** (`src/rsvp-form.template.tsx`) binds the root's
  `state` to an `rsvpState` variable and its `onStateChange` to set it, and
  leaves `data` unbound for the insert and `record` for the designer. A "Form
  Content" box, shown in `initial`, `submitting` and `error`, holds a heading,
  the four Fields, Guests, Shift Options, Questions, Email Consent (placeholder
  text: "Also email me news from this organization") and a Submit Button
  ("RSVP"); the state boxes Registered, Waitlisted, Full, Ended, Error and
  Unavailable follow, each shown on its own state and holding placeholder text
  the designer edits. Guests, Shift Options and Questions each hold three
  `ws:descendant` instances, which the CSS generator renders as selectors under
  the part's class: the text controls (`:is(input:not([type=checkbox]):not([type=radio]), select, textarea)`,
  one compound inside `:is()` because the generator appends the selector to the
  part's class and a bare comma list would style every `select` and `textarea`
  on the page) with "OS Input", ` button` with "OS Button" and
  ` [data-message]` with "OS Message". They wear the same shared tokens as the
  Fields, so restyling "OS Input" restyles these controls too. Checkboxes and
  radios keep the browser's own look. Only Guests renders buttons, and Shift
  Options renders only checkboxes and radios, so some of these instances match
  nothing today; the three parts carry the same three, so a designer finds the
  same ones in each.
- The canvas and the preview never post. On the canvas a root draws a warning
  on itself for a missing part (an email Field, a Submit Button, a Field for a
  required form field), a Field naming a field its form lacks, a form inside
  another form, and a picked form that is unavailable.
- On a published page, a submit with a required form field that has no Field
  Input reports Unavailable and posts nothing. The page reads its form from the
  platform when it renders, not when it was published, so the form can gain a
  required field afterwards, and the platform's answer would then name a field
  the page has no Field Message to show it on.
- Text, email and phone inputs and textareas carry `maxLength` 2000, the
  platform's per-field limit, or the designer's own shorter `maxLength`. A root
  can set a lower limit for a field of its own (the RSVP Form: names 100,
  email 320, phone 40, the RSVP endpoint's), and the smallest of them wins. The
  RSVP Form also refuses a longer value before posting, with that field's
  message, because the endpoint's answer to one names no field.
- **Registered** by one `registerComponentLibrary` call in `canvas/canvas.tsx`
  under the namespace `@organizeos/site-components`, so the components are
  `@organizeos/site-components:SignupForm` and so on. Every build that uses a
  block records that name in `Instance.component`: the namespace can never
  change.

**In the builder**, `apps/builder/app/builder/features/organizeos-panel/`:

- **Offered to every org not on `ORGANIZEOS_BLOCKS_DENY_ORG_IDS`** (§4): the
  Components panel's OrganizeOS section (the blocks), the Style panel's
  Background presets section, the Inspector's Motion tab and the OrganizeOS
  data tab. The builder
  loader resolves the project's org and sets `organizeosSite.blocksEnabled`;
  for a denied org none is offered and `insertOrganizeosBlock` refuses with a
  toast ("OrganizeOS blocks are not available for this site yet") and writes
  nothing, which covers a drop too (the canvas receives `organizeosSite`
  through the sync pool). A project no org owns never gets them. This gate is
  client-side and is a rollout gate, not an enforcement boundary (known
  limits).
- **The OrganizeOS section** of the Components panel
  (`components-section.tsx`, mounted by marked lines in
  `features/components/components.tsx`): one section, headed "OrganizeOS",
  directly after General. It lists the namespace's templates with the
  Components panel's own cards, in its sections' order (Sections: Rotating
  Tabs, Marquee, Convergence Field; Content: Rich Text; Events: Event List,
  Event Card, RSVP Form; Signups: Signup Form), skips a name that is not registered yet, and offers a
  registered block no section names after the others (the "More" rule). A
  card's tooltip is its template's description, a short phrase ("Your
  upcoming public events"; `metas.test.ts` holds every template to a few
  words), as a block prop's Settings tooltip is its unit and range ("3–20 s"),
  a few words, or none where its label says it (`metas.test.ts` pins them).
  The blocks' metas stay `category: "hidden"`, so upstream's grouping skips
  them and this section adds them. "Find components" finds them by label, ranked
  with upstream's matches in the one "Found" list. A click, Enter on a found
  block, and a drag (upstream's drag, which accepts every registered template)
  all insert through `insertOrganizeosBlock`, so each block arrives bound to
  the project's data. There is no section on an XML page, where the panel
  shows only the XML and data categories. The Sections blocks and Rich Text
  read no platform data of their own, so their inserts bind nothing (Rich
  Text has no entry in `organizeosBlockData`).
- **The OrganizeOS data tab** (`organizeos-panel.tsx`), a left-sidebar tab
  after Components with upstream's `ResourceIcon` and the tooltip "OrganizeOS
  data", hidden in content mode and disabled on text pages, as Components is.
  It is titled "OrganizeOS data", with the data list (below) under the title
  and no line of its own. Once the catalog has resolved and is empty, it reads
  "No data connected"; with no selected page there is nothing below the
  title. The CMS does not change it: the CMS is a rail button, not a panel
  (below).
- **The CMS overlay** (`features/cms-panel/`, OrganizeOS designs
  `docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md`, 4.4, and
  `2026-10-27-cms-overlay-and-staged-edits-design.md`, 3.1, which replaces
  the left-sidebar panel of #47): the CMS screen over the builder, opened
  from a rail button.
  - **The rail button.** "CMS" (label and tooltip), with `CmsIcon`
    (`cms-icon.tsx`: a database, stacked cylinder bands on upstream's 16 px
    grid with a 1 px `currentColor` stroke, taking upstream `IconComponent`'s
    `size`, `color` and SVG props; upstream has no database icon). It is
    the rail's last button, after the tabs, and is not a `SidebarPanelName`:
    it toggles `$isCmsOverlayOpen` and shows the rail's active state
    (`data-state="active"`, `aria-pressed`) while the overlay is open. It is
    offered for an OrganizeOS project only when `ORGANIZEOS_CMS_PANEL` is
    exactly `true` on the builder (the loader sets
    `organizeosSite.cmsPanelEnabled`), the plan's features carry
    `allowDynamicData`, and the user is not a viewer (neither the `viewers`
    relation nor a view-only permit, which covers a share link)
    (`$isCmsPanelAvailable`). It shows in Design and Content modes. Preview
    mode hides the rail, and the button with it.
  - **What it covers.** `CmsOverlay`, rendered once by `sidebar-left.tsx`
    outside the tab content and portalled to the document's body, is a
    `position: fixed` box from the rail's measured right edge to the
    viewport's right edge, top to bottom, over the top bar, the sidebar
    panel, the canvas and the inspector, plus a strip from the rail's
    measured bottom edge down, under the rail, where the full-width footer
    would otherwise show through. Its `z-index` is 2
    (`CMS_OVERLAY_Z_INDEX`): above the top bar (`zIndex: 1`) and below the
    toast layer (`theme.zIndices.max`, 999), so the "Reload" notice shows
    over it. It is portalled because the left sidebar's own box isolates
    its stacking (`isolation: isolate` on builder.tsx's `SidePanel`), where
    a z-index would not reach past the inspector. Design-system dialogs and
    popovers portal with no z-index and so render beneath it; the builder
    opens none on its behalf.
  - **Close means hide.** The frame is mounted on the first open and stays
    mounted for the life of the builder document. Closing sets
    `display: none`, so reopening shows the screen as it was left, unsaved
    text included; there is no discard and no confirm. It hides on the rail
    button, on Escape pressed in the builder document, on a press on the
    top bar (its corner beside the overlay holds the builder's main menu,
    whose menus and dialogs portal without a z-index and would open beneath
    the overlay), on
    `cms.close_requested` (the screen's own close button, or Escape at its
    top level), when another rail tab is clicked (which then shows its
    panel, even the one already open) or a panel becomes active any other
    way, on entering preview mode, on hiding the builder UI, and when the
    CMS stops being offered. Leaving preview keeps it hidden.
  - **Focus and shortcuts,** with no upstream edit. Opening calls
    `iframe.focus()`, so focus leaves the canvas and the rail. While it
    shows, a capture-phase `keydown` listener on the builder document calls
    upstream's `suppressCommandsForEvent` for every key. Escape also hides
    the overlay and stops there: it runs neither the builder's own Escape
    command (deselect, or leave preview) nor the sidebar's Escape, which
    would close the open panel. Keys typed inside the frame never reach the
    builder or the canvas documents.
  - **The frame.** `src` is
    `{platformUrl}/cms-panel/{organizationId}?theme=light`, both from
    `$organizeosSite` (the loader's org, never the page URL; the builder UI has
    one light colour mode, `getBuilderColorMode`). `title="CMS"`,
    `referrerpolicy="no-referrer"`, no `allow` attribute, and `sandbox="allow-scripts
allow-same-origin allow-forms allow-popups allow-modals
allow-top-navigation-by-user-activation"` (`allow-modals` so the frame's
    own unsaved-changes prompt and confirm dialogs show; its origin is the
    app's, not the builder's). The builder route's `frame-src` carries the
    origin of `ORGANIZEOS_APP_URL` (`builderFrameSrcPolicy`).
  - **Messages, frame to builder only** (`cms-messages.ts`). The listener
    accepts a message only when `event.origin` is the platform URL's origin
    and `event.source` is the frame's `contentWindow`, and parses it with
    strict Zod schemas of the platform's flat shapes
    (`client/components/cms/messages.ts`): `{ type: "cms.item_saved",
collection }` invalidates, through `invalidateResource`, every current
    resource request (`$computedResourceRequests`) whose parsed URL has the
    app's origin, no userinfo and the path `/api/public/v1/collections/{slug}`
    or one under it, so the canvas refetches it (with drafts, §5);
    `{ type: "cms.collection_changed", collection }` (`null` after a delete)
    shows a toast, "Collection changes appear after you reload the builder",
    with Reload (collections-sync has already written the Resources, §5.7);
    `{ type: "cms.dirty", dirty }` sets the flag that guards the window's
    `beforeunload`, its only use, since nothing else discards the frame;
    `{ type: "cms.close_requested" }`, with nothing beside its type, hides
    the overlay. Anything else, a nested `payload` included, is dropped. No
    message chooses an org, a collection's data or a permission.
- One link sits at the foot of the OrganizeOS section while it lists a block
  that reads the org's data (the Events and Signups blocks): "Manage in
  OrganizeOS ↗", which opens the org's Website area in OrganizeOS,
  `<platform URL>/<subdomain>/website` (`getWorkspaceAreaUrl`), where the
  builder's menu leads too. While the builder does not know the subdomain it
  is the Website area's URL, `manageUrl`.
- **Data loads only where it is used, never page-wide.** The org's data is a
  catalog of GET Resources with deterministic ids: Events, Fundraisers and
  Stats (provisioning), one per public collection (collections-sync), and
  Forms and Upcoming Events once a block has added them. A Resource loads
  nowhere by itself:
  Webstudio loads a resource DataSource, in the builder (`$computedResourceRequests`)
  and on a published page (the CLI's prebuild), only when its scope is an
  instance on the page or `:root`. So each use brings its own binding: a
  resource DataSource with a fresh id, scoped to the instance that uses it,
  which references the catalog Resource by id. Nothing scopes a binding at
  `:root`, and provisioning and collections-sync write no binding at all.
- **The data tab's list** (`organizeos-data.ts`): one row per catalog
  Resource, in that order (collections in the build's order, then Forms, then
  Upcoming Events), found by id, never by name.
  "Add to this page" gives the selected page a binding of the Resource,
  scoped to the page's root, unless the page already has one there or at
  `:root`; the row then reads "On this page". The binding is named like its
  Resource, or `<name> 2` (and so on) when that name is taken on the page root
  or at `:root` (an unscoped variable, such as an older provision's binding,
  counts as `:root` for the name, though not as the page having the Resource,
  since it never loads), because expressions resolve variables by name: a
  page-root binding masks a `:root` variable of the same name, and the
  re-resolution that follows the add would point the expressions that read it
  at the Resource. The data panel lists it on every element of the page
  except inside a Slot's content, which reaches `:root` variables only: there
  the panel does not list it and the canvas evaluates it as undefined. The
  builder loads it while the page is open, and a published site loads it on
  that page alone. A block's own binding does not count: it is visible inside
  the block only.
- **CMS page templates** (OrganizeOS design
  `docs/superpowers/specs/2026-10-27-cms-page-templates-design.md` and its
  plan `docs/superpowers/plans/2026-10-27-cms-page-templates.md`): a
  collection's item page, its list block and the sitemap, made from the data
  tab. Every part is upstream instances, Resources and page meta that
  published sites already render: no runtime package changes.

  - **The menu** (`collection-row-menu.tsx`). A collection's row (a catalog
    Resource whose id is its collection's derived id) has a "..." menu in place
    of its button: Create item page (Open item page once the collection has
    one), Add list, Add to this page and, only when the sitemap lists a
    collection with no item page, Remove from sitemap. Other catalog rows keep
    their button. The menu holds options only: no help text, the row's name in
    a tooltip.
  - **The plan gate.** Create item page and Add list are disabled, with
    upstream's plan badge (`planBadgeLabel`), when `$permissions` lacks
    `allowDynamicData`. Open item page, Add to this page and Remove from
    sitemap are not gated. The gate is in the builder's UI only.
  - **The schema read** (`collection-schema.ts`). The builder stores no field
    schema, so each click reads `GET {base}/collections` live with the
    collection catalog Resource's `Authorization`, posted as one
    `ResourceRequest` through `fetch.client` to `restResourcesLoader()`
    (upstream's queue in `shared/resources.ts` is module-private). Any failure
    (no catalog Resource, a failed read, a collection the answer does not
    list) is `{ error }`, shown as the toast "Could not load the collection",
    and nothing is written. A field key outside `^[a-zA-Z][a-zA-Z0-9]*$` is
    dropped, because the generators write keys into expressions.
  - **The layout map** (`collection-layout.ts`, `pickRoles`, pure, pinned for
    every curated template): Title is the `isTitle` field (the item's
    `name`); Date the first `date` or `datetime` field, else `publishedAt`;
    Image the first `image`; Body the first `richtext`; Summary the first
    `textarea`, only with no rich text; the rest the remaining text-like
    fields in schema order; single references by their item's `name`; the
    others (`switch`, `color`, multi-references) left for the designer.
  - **Create item page** (`collection-pages.ts`, `createCollectionItemPage`)
    writes, in one `updateWebstudioData` transaction, so one undo removes it
    all:

    - the page "{Collection} template" at `/{slug}/:slug`, registered in the
      root folder, then selected;
    - its Resource "Current {singular}", with a `nanoid` id, `method: "get"`,
      the catalog's `Authorization` value copied exactly, bound by a resource
      DataSource scoped to the page's body, so it goes with the page. Its url
      is the expression
      `"{base}/collections/{slug}/items/" + ($ws$system.params.slug ?? "-")`.
      With no param the request ends in `-`, which the platform's slug rule
      refuses with a 404; an empty fallback would end in `/items/`, which the
      platform redirects to the list, whose answer would read as found;
    - **found**,
      `($ws$system.params.slug ?? "") !== "" && <v>?.ok === true && <v>.data.data.slug === $ws$system.params.slug`,
      which every piece of meta and the layout's show conditions use. The
      first clause covers the canvas with no history, where the param is
      undefined; the slug comparison makes a malformed param, normalised to
      another URL, never count as this item;
    - the meta, set inline (upstream's `getInitialPageMeta` is
      module-local): title `found ? name : "Page not found"`, status
      `found ? 200 : 404`, description the first `textarea` field, else the
      rich text's `.text`, cut to 160 characters, social image the image field's
      `.url`, `excludePageFromSearch: false`. The published route answers
      with that status (§8), so a missing item is a real 404 with the page's
      own "not found" box;
    - the starter layout from the layout map: a centred box of max width
      720 px with the item (shown when found), the body as a Rich Text block
      bound to the field's `.nodes`, and a "not found" box with the heading
      "Page not found" (shown otherwise);
    - `history[0]` = `/{slug}/{first item's slug}`, read with
      `limit=1&fields=slug` (preview-signed, so a draft counts), so the
      canvas shows a real item; with no items it stays empty;
    - the sitemap change below.

    A page whose full path, folders included (`getPagePath`), is
    `/{slug}/:slug` is the collection's item page, whoever made it: the menu
    then reads Open item page, and Create item page opens it and writes
    nothing, checked again inside the transaction. There is never a second
    page. After a create the toast "Item page created" shows, with no action;
    the builder's undo covers it.

  - **The sitemap page.** The first Create item page also creates a page at
    `/sitemap.xml` (`documentType: "xml"`), unless the project has a page at
    that full path. Its root XmlNode, `urlset`, carries the boolean prop
    `data-organizeos-sitemap`, the marker. It lists the static pages through
    a `ws:collection` over upstream's Sitemap system Resource
    (`sitemapResourceUrl`), and each collection with an item page through a
    page-scoped "{Collection} slugs" Resource over
    `{base}/collections/{slug}/slugs` (the catalog's `Authorization` copied),
    whose `ws:collection` reads `(<v>.ok === true ? <v>.data.data : [])` and
    emits a `url` element per item, its `loc` the site's origin, then
    `/{slug}/`, then the item's slug, and its `lastmod` the item's
    `updatedAt`. A later Create item page adds its collection's part only to
    a page whose root carries the marker, once; a hand-made `/sitemap.xml` is
    never edited. XmlNode drops `data-*` props in both renderers, so the
    marker stays in the build and never reaches the XML (a test renders it).
    On the canvas `/slugs` is preview-signed and lists drafts; a published
    site lists published items.
  - **Remove from sitemap** (`removeCollectionFromSitemap`) drops one
    collection's part, its `ws:collection` subtree, binding and `/slugs`
    Resource, in one transaction, from the marked sitemap only. It is offered
    when the sitemap lists a collection that has no item page (an item page
    deleted, its part left listing URLs that now 404): on that collection's
    row, or on a row of its own when the catalog no longer has the
    collection.
  - **Add list** (`collection-list.ts`, `insertCollectionList`). A popover of
    Layout (Grid or List), Sort, Show (3, 6, 9, 12 or All), the "Link to item
    page" switch, enabled only when the collection has an item page, and
    Add. It inserts, through `insertWebstudioFragmentAt` with `onInsert`, at
    the selection, else at the end of the page, in one transaction, a wrapper
    "{Collection} list" holding:
    - its own Resource "{Collection} list", with a `nanoid` id, scoped to the
      wrapper, url the literal `{base}/collections/{slug}/items`, the
      catalog's `Authorization` copied, and `searchParams`: `sort` (Newest
      `-publishedAt`, Oldest `publishedAt`, A to Z `name`, Manual order
      `sortOrder`), `limit` (none for All, so the API's default applies), and
      `fields`, the card's own field keys only (none when the card reads no
      field), because of the resource cache's 1 MB entry cap; the system keys
      `name`, `slug` and `publishedAt` come back regardless;
    - a `ws:collection` with the `collectionItem` parameter and data
      `(<v>.ok === true ? <v>.data.data : [])`;
    - the card: the Image, an h3 Title, the Date and the Summary roles,
      wrapped in a link to `"/{slug}/" + collectionItem.slug` when the switch
      is on;
    - Grid as three columns, one below 768 px (on the project's
      `maxWidth: 767` breakpoint when it has one), or List as rows with the
      image at the left;
    - "No items yet", shown when `<v>.ok === true` and the list is empty, and
      "Could not load", shown when `<v>.ok === false`.
  - **The stale-address line.** A collection's address is its item pages'
    first path segment and its Resource's literal. When the address changes,
    the item page keeps the old one. `parseItemResourceSlug`
    (`organizeos-data.ts`) reads the slug from the first string literal of an
    item Resource's url, which `parseCollectionUrl` cannot (it parses only a
    literal ending in `/items`), and `findStaleItemPages` finds the item
    pages whose slug no catalog Resource has. Such a page's collection row,
    matched by the page name Create item page gave it, reads "Item page uses
    an old address"; with no row of that name, the page gets a row of its
    own with the line. Nothing is rewritten.
  - **Token rotation covers the new Resources.** Each copies the catalog's
    `Authorization` value, so provisioning's rotation rewrites it on the
    `previousAuth` branch of `seedProjectResourcePresets` (the item page's
    url is an expression, so the literal-url branch cannot). Cases in
    `shared/db/resource-presets.server.test.ts` pin the item page's, the
    list's and the sitemap's `/slugs` Resources. A designer who edits the
    header by hand falls out of rotation.
  - **Draft preview covers item URLs.** An item page's request,
    `{base}/collections/{slug}/items/{slug}`, is under
    `/api/public/v1/collections/`, so the resources loader signs it on the
    canvas (§5; a case in `shared/organizeos-preview.server.test.ts`) and the
    canvas shows drafts and staged changes. Published sites never send the
    header.
  - **The published cache keeps a missing item's 404** (§8), so a missing
    slug costs one platform read a minute per server instance, as a found
    one does.

- **Insert completion**, `insert-organizeos-block.ts`. A clicked block, a
  block chosen with Enter and a dropped one all go through it: the Components
  panel's `handleInsert` (`features/components/components.tsx`) and the
  canvas's drop handler (`canvas/shared/use-drag-drop.ts`) each have one
  marked branch for the namespace. What a block reads from the catalog is a
  table, `organizeosBlockData`, keyed by the template's key (the `component`
  the Components panel inserts, not the root's
  component: an Event List's root is a Share Code Carrier). An entry names the
  catalog Resource (`events`, `forms` or `upcoming-events`), the name of the
  block's binding, and the props that read it: an instance (`root`, or the
  `ws:id` the template gives it), a prop name, and the expression, given the
  binding's variable. A template key with no entry is inserted untouched.

  - The Signup Form's entry is the Forms Resource under "OrganizeOS Forms", and
    the root's `data` = `<v>.data`.
  - The Event List's entry is Upcoming Events under "OrganizeOS Upcoming
    Events", with three binds: the collection's (`events`) `data` =
    `(<v>.ok === true ? <v>.data.data : [])`, the empty box's (`empty`)
    `data-ws-show` = `<v>.ok === true && <v>.data.data.length === 0`, and the
    unavailable box's (`unavailable`) `data-ws-show` = `<v>.ok === false`. The
    Event Card's entry is the same with `<v>.data.data.slice(0, 1)` for the
    list: the next event.
  - The RSVP Form's entry is the Events Resource itself under "OrganizeOS
    Events", with one bind: the root's `data` = `<v>.data`, the body, as the
    Signup Form binds its forms. It never creates a Resource (provisioning
    always writes Events), and it binds the whole list rather than Upcoming
    Events, because the block finds its event by id, an ended event included,
    and the record picker lists them. A failed read hands over an error body,
    which the form reads as no data and answers with Unavailable.
  - `<v>` is the loader's `{ ok, status, statusText, data }`, so `<v>.data` is
    the response body, `<v>.data.data` is the DTO's list, and `ok` sits on
    `<v>`, not on the body. The collection reads the list only when `ok` is
    true, so it stays on a list for a successful read only and agrees with the
    empty and Unavailable boxes. (A failed read, a 503, a 429 or a 401, hands
    over an error body, `{ error }` or a 429's `{ error, retryAfter }`, whose
    `<v>.data.data` is undefined and renders no card either way; binding the
    body itself, `<v>.data`, would iterate one card per key of it.) The
    condition is parenthesized because the published page iterates
    `Object.entries(<bind> ?? {})` and `??` binds tighter than `?:`: bare, the
    `?? {}` would guard only the `[]` branch, and a 200 whose body has no list
    (an HTML page after a redirect, `{}`) would throw while the page renders.
    While the Resource loads, `<v>` is undefined; expressions are transpiled
    with optional chaining, so the collection is empty and both boxes stay
    hidden.
  - A designer caps the list by editing the collection's `data` expression,
    for example `<v>.data.data.slice(0, 6)` inside the condition. Keep the
    condition's outer parentheses when editing: a published page iterates
    `Object.entries(<expr> ?? {})`, and `??` binds tighter than `?:`, so
    without them the `?? {}` guards only the `[]` branch and a 200 with no list
    throws on the published page.

  1. Refuse, with a toast and no write, when the org is denied the blocks.
  2. Find the Events Resource by its deterministic id, never by name. If it is
     missing or has no non-blank `Authorization` header, refuse with a toast
     ("this site's link to your organization's data was removed or changed.
     Contact OrganizeOS support to restore it.") and write nothing, for every
     entry. The same refusal applies when the entry's Resource must be created
     and the Events URL is not the `"<API base>/events"` literal provisioning
     writes, and when an entry binds an instance the template does not have (a
     template bug, which the template tests catch).
  3. Insert with `insertWebstudioFragmentAt`, and in the same transaction
     (its `onInsert` option, once the block's instances have their ids): create
     the entry's catalog Resource if the project still lacks it, by the id
     provisioning gives it and in provisioning's shape (Forms: named "OrganizeOS
     Forms", the Events URL with `/forms` for `/events`; Upcoming Events: named
     "Upcoming Events", the Events URL with `/events?upcoming=true`; both with
     the Events `Authorization` header; one that appeared meanwhile is kept; an
     `events` entry never creates anything); add the block's binding, a
     resource DataSource with a fresh id scoped to the block's root, named by
     the entry ("OrganizeOS Forms", "OrganizeOS Upcoming Events", "OrganizeOS
     Events"), referencing that Resource; and bind each prop the entry names,
     by id, to an expression over the binding's variable, dropping a prop the
     template made under that name on that instance, so no variable that shares
     the binding's name captures it at insert (copies are another matter: see
     the known limits).
  4. The insert resolves a token the project already has with "ours": the
     shared tokens ("OS Input" and the rest) are reused as they stand, so a
     block inserted after the designer restyled "OS Input" wears the restyled
     token instead of adding "OS Input-1" with default styles, and restyling a
     token restyles every block (spec 3.2). That includes the RSVP Form's
     `ws:descendant` instances, which wear the same tokens as its Fields.

  One transaction, so one undo removes the block, its binding and a Resource it
  created. The data loads on the pages that have a block, and nowhere else.

- **Catalog Resources outlive their bindings.** Upstream deletes a binding's
  Resource with it (deleting an instance or a page, deleting a variable in the
  data panel, turning a resource variable into a value), because there each
  Resource has one binding. A catalog Resource is shared, so one marked branch
  in each of those three places skips a Resource whose id is a derived v5 UUID
  (`isPresetId`; Webstudio's own ids are nanoids): deleting a Signup Form, or a
  page that added Events, leaves the catalog for every other use.
- **Copies.** Webstudio copies a block's or a page's scoped bindings with it,
  and gives each copied binding its own copy of the Resource, under a nanoid
  id. A copied or duplicated Signup Form therefore reads the same forms
  through its own Resource, which is deleted with it. A re-provision gives
  every Resource whose `Authorization` is a catalog Resource's previous one
  the new token, so a copy keeps working after a rotation. Provisioning's write
  bumps `Build.version` and clears `lastTransactionId` (a tab whose last save
  matched it would otherwise take the new version for its own retry), so an
  open builder tab reloads before it can copy a stale token. A Resource on the
  OrganizeOS API base with another read token (a block pasted from another
  org's project) gets this org's token on the next provision. Until then, a
  pasted block reads the other org's public forms, events (an RSVP Form binds
  the Events Resource itself, so it reads the whole list, past events included,
  and its picker offers them) or upcoming events, and a published page shows
  them. An RSVP Form's posts are refused all the same (`not_found`): the rsvps
  endpoint takes the org from the host, never from the event.
- **Preset ids**: `apps/builder/app/shared/organizeos-preset-ids.ts`, one
  WebCrypto `uuidV5` that the server and the browser share, pinned by tests to
  the ids the replaced `node:crypto` code produced, and `findCatalogResources`,
  which both sides use to list the catalog. Provisioning and the builder
  derive the same ids, so a re-provision rewrites the Forms and Upcoming
  Events Resources a block's insert added instead of adding a second. The names of those two Resources
  and of the bindings the Events blocks bring live there too.
- **The catalog in provisioning** (`shared/db/resource-presets.server.ts`):
  Events, Fundraisers and Stats are written on every provision, Forms and
  Upcoming Events (`/events?upcoming=true`, "when-present") are rewritten when
  the build has their Resource and never created, and every collection
  Resource gets the new token and API base. Upcoming Events' token rotates like
  the others': the check that finds a copy of a catalog Resource is a prefix
  check on the API base.
  Resources are upserted in place and in order. The unscoped bindings older
  provisioning wrote next to each Resource never loaded, and the `:root` Forms
  binding the pre-deploy branches wrote loaded on every page; a provision or a
  sync removes each one nothing references (its id, raw or as
  `$ws$dataSource$...`, appears nowhere in the build's instances, props,
  pages, resources or other data sources) and keeps the rest as they are.
  A binding with a fresh id, which is what every use brings now, is never
  touched.
- **The starter signup page** (`shared/db/signup-form-preset.server.tsx`,
  spec decision 8): a provision seeds a "Newsletter" page at `/newsletter`
  with a native Form posting to `/v1/signups`. Not `/signup`: every org host
  redirects `/login`, `/signup`, `/reset-password`, `/auth`,
  `/workspace-auth`, `/dashboard`, `/account`, `/onboarding`, `/meetings`,
  `/embed` and `/api` to the platform (`/signup` with a 308 to the account
  sign-up), so a page there never renders; a guard test lists those prefixes.
  The page keeps its deterministic id, so a re-provision moves a page seeded
  at `/signup` in place. When another page already answers at
  `/newsletter`, nothing moves there: a seeded page stays where it is (its
  form is still re-synced) and a build without one gets none.

**Section backgrounds**, the Style panel's "Background presets" section
(`features/organizeos-panel/background-presets-section.tsx`, one marked entry
in upstream's section map, `features/style-panel/sections/sections.ts`,
directly after Backgrounds; its content is
`features/organizeos-panel/section-background.tsx`, with its modules in
`features/organizeos-panel/backgrounds/`). For the selected element (not the
Body, the page root or Global Root) it shows one wrapping row of small square
thumbnails, one for each of the nine presets ("Bloom", "Bloom, strong",
"Bloom, dark", "Wash", "Wash, dark", "Solid tint", "Solid tint, dark", "Image
with scrim" and "Image with scrim, dark"), each named by its `aria-label` and
in a tooltip that opens on hover and on keyboard focus, with no caption. A
click applies the preset; an Image with scrim preset opens the image picker
(the asset manager and its upload) and applies with the image chosen there,
closing it. With one picker open, a click or tap on the other scrim preset
opens that one's picker. The presets take their colors from Global Root's
color variables: by name when `--base`, `--accent-1`, `--accent-2` and `--text`
are all there (Site templates, below), and otherwise the lightest as the base,
the darkest as the text and the others as the accents in the order they are
defined (`getDefaultRoles`), or from a built-in palette when Global Root
defines none. Under the row, one line
of plain text in the destructive color, "Text below AA contrast", appears only
when text inside fails WCAG AA. That is all it shows, by the owner's rule in
`CLAUDE.md` ("Builder UI: options, not explanations"): no palette menus, help
text, notices or report, since people learn the presets by trying them on the
canvas.

- It is offered as the Style tab is: for a selection whose meta has a preset
  style, on an HTML page, in design mode, and mounted on the canvas. Slot,
  Fragment, Collection and Content Block have no preset style, so they do not
  get it; they render as `display: contents` or as their children only, so a
  background there never painted. For the Body, the page root and Global Root
  the section renders nothing (a Body background is set in Backgrounds). It
  joins focus mode's accordion and default mode's all-open, the Style panel
  hides it in advanced mode, and a locked token leaves it enabled: the presets
  write the Local source, never the token.
- The contrast report is computed only while the section is open (Radix
  mounts a collapsible's content only then) and off the input path
  (`contrast-schedule.ts`): a change of its inputs schedules one run, through
  `requestIdleCallback` with a 150 ms timeout where it exists and
  `setTimeout(run, 150)` where it does not (Safari), and a newer change
  replaces a pending run. A report is shown only for the selection it was
  computed for: after a style edit the last line stays until the new run
  lands, and after a change of selection nothing shows until the run for the
  new one lands, so the previous element's line is never shown for the new
  one. No line shows while a run is pending, or when no text fails: all of
  it passes, there is none, or some can't be checked.
- A preset writes ordinary styles only, to the element's **local** style
  source at the current breakpoint, base state, in one undo step:
  `background-color` and the nine layer longhands upstream's Backgrounds
  section reads. It never writes to a token, adds no component, prop or
  script, and keeps no link to the element; tinted stops are literal colors,
  so re-applying a preset picks up a palette change. A background the element
  takes from a token or another breakpoint is overridden here, by the local
  style, without a notice.
- The contrast check is advisory: it never blocks publish, and it never
  reports Pass for what it cannot compute (unreadable values, an image with
  no layer above it, blending, filters, opacity, interpolation methods and
  color hints are "Can't check", which the line does not count). It reads
  styles through `getComputedStyleDecl` over its own model, not the rendered
  canvas, so it does not see positioned text, text inside an embed, or where
  on a gradient the text sits (it takes the gradient's lowest point). The
  section shows none of this, so it is recorded here.
- Nothing changes in the published-site runtime, the CLI or the templates.
  Design: `docs/superpowers/specs/2026-10-25-builder-section-backgrounds-design.md`
  in the OrganizeOS repo.

**Rotating Tabs**, the first block of the Components panel's OrganizeOS
section: upstream's Radix Tabs that
show each panel in turn behind a Pause button (Track 2 phase 2). Design:
`docs/superpowers/specs/2026-10-25-builder-rotating-tabs-design.md` in the
OrganizeOS repo, plan `docs/superpowers/plans/2026-10-25-builder-rotating-tabs.md`.

- **The control**, Rotation Control (`src/rotation/`, registered as
  `@organizeos/site-components:RotationControl`, hidden from the Components
  panel): a `<button type="button">` that is the Tabs' first child, so it is
  first in the section's tab order, with the rotation behind it
  (`use-rotation.ts`). Props: Interval (seconds, default 5.5, clamped to 3..20
  by the runtime), Pause label and Play label (default "Pause" and "Play", the
  button's text and accessible name), `value` and the `onValueChange` action.
  It renders `hidden` (and `display: none`) on the server and whenever rotation
  will not run, so no inert button shows without JavaScript.
- **The variable seam.** Upstream's Tabs stays byte-identical (§1): the control
  drives it through its one public seam, `value`. The template
  (`src/rotating-tabs.template.tsx`, upstream's parts named through the
  `radix` namespace proxy) binds Tabs' `value` and the control's to one
  variable, `activeTab` (initial "0"), and the control's `onValueChange` sets
  it. Since Tabs keeps its own selection, the control reads the selected index
  from the DOM on mount and on Play and writes it first; each advance is
  verified on the next tick, and a mismatch (custom trigger values) stops
  rotation for good. Triggers and Contents keep upstream's index values; every
  Content is `forceMount`ed with its Inactive state (`[data-state="inactive"]`)
  `display: none`, so every `aria-controls` target and every panel's text is in
  the markup and only the selected panel shows.
- **The rules.** Rotation never runs on the canvas, under
  `prefers-reduced-motion: reduce` (it stops, and the button hides, if that
  starts matching mid-visit), or with fewer than two tabs. It pauses while the
  pointer is over the section, the section is off screen or the document is
  hidden, restarting the interval when the pause ends. It stops for good when
  focus enters the section anywhere but the button, when the visitor picks a
  tab (a trusted `pointerdown` on a tab, or an arrow, Home, End, Enter or Space
  in the list) and on Pause; untrusted events are ignored. An advance never
  moves focus and nothing sets `aria-live`. A runtime structure check (the
  button before the Tabs' one own tab list, at most one panel rendered) stops
  rotation when it fails; on the canvas the same check draws a canvas-check
  problem on the control, rerun as the designer edits.
- **The cross-fade** (Track 2 phase 3B, `src/rotation/use-fade.ts`, design
  `docs/superpowers/specs/2026-10-26-builder-timed-motion-design.md` in the
  OrganizeOS repo, whose section 12 amends the earlier sections): the
  control's **Fade** prop, in milliseconds, clamped to 0..600 by the runtime
  (anything non-numeric is 250; 0 is an instant switch). The component
  destructures `fade = 250` and the meta's default is 250, so a Rotating Tabs
  published before the prop existed fades too once it is republished, with no
  designer action; the template writes no `fade`. When one of the root's own
  panels turns `data-state="active"` after hydration, for any reason (an
  advance, a click, a key), it animates `opacity: 0 → 1` over Fade,
  `ease-out`, `fill: "none"`, through `element.animate()`: the outgoing panel
  is already `display: none`, so nothing overlaps or shifts, and a finished or
  cancelled fade leaves no style, so a panel is never partly transparent at
  rest. A new switch cancels a running fade. A trigger's flip, or a flip in a
  Tabs nested in a panel, fades nothing; the panels are collected again when
  the root's children change. No fade on the first render, on the canvas,
  under reduced motion (it stops if that starts matching), while the control
  is "off" (phase 2's rules), or in an engine without `element.animate`.
- The package gains no runtime dependency: the control's closure is `react`,
  `react/jsx-runtime` and `@webstudio-is/react-sdk/runtime`.
  `@webstudio-is/sdk-components-react-radix` is a devDependency for the
  template test only, which renders the template through upstream's real Tabs.
  The builder's contrast check classifies the control as rendering its own
  text. Nothing changes in the published-site runtime, the CLI or the
  templates.

**Marquee**, the second block of the Components panel's OrganizeOS section: a
row of items that drifts
in a seamless loop behind a Pause button (Track 2 phase 3B). Design:
`docs/superpowers/specs/2026-10-26-builder-timed-motion-design.md` in the
OrganizeOS repo (its section 12 amends the earlier sections), plan
`docs/superpowers/plans/2026-10-26-builder-timed-motion.md`.

- **The parts** (`src/marquee/`, metas `category: "hidden"`): **Marquee**
  (`@organizeos/site-components:Marquee`, a `div`; props Speed, px/s, default
  40, clamped to 10..200 by the runtime, anything non-numeric 40, and
  Direction, `left` or `right`, unset the reading direction's: left, or right
  when `getComputedStyle(root).direction` is `rtl`), whose only children are
  **Marquee Pause Button** (a `button`; props Pause label and Play label,
  default "Pause" and "Play", its text and accessible name) and **Marquee
  Track** (a `div` whose children are any instances: the items). The template
  (`src/marquee.template.tsx`) clips the root on the x axis only
  (`overflow-x: clip; overflow-y: visible`, so focus rings and shadows are not
  cut vertically), puts the button first, and gives the track `display: flex`,
  a `gap` and `width: max-content` and five static `div` items `flex: none`.
- **The context** (`context.ts`): the button and the track register their
  elements with the root, and the button reads the root's `state` ("playing",
  "stopped" or "off") and `toggle`. A structure check (`structure.ts`: one
  button and one track, both directly in the root, the button first; the
  canvas-check boxes skipped) turns motion off on a published page when it
  fails and draws a canvas-check problem on the canvas, rerun as the designer
  edits. The button renders `hidden` (and `display: none`) on the server and
  whenever the state is "off", so no inert button shows without JavaScript; on
  the canvas it always shows.
- **The server markup** holds every item once, in a row the root clips;
  nothing else is hidden. After hydration, when motion may run (not the
  canvas, no reduced motion, the structure holds, the engine has
  `element.animate`, and the items at rest run past the root's padding edge),
  the runtime (`use-marquee.ts`) appends **one clone container** to the track,
  `<div aria-hidden="true" inert style="display: contents">` holding
  `cloneNode(true)` copies of the items with every `id` inside removed, so
  React never reconciles the copies, the track's `gap` runs between all of
  them, and assistive technology and the keyboard meet each item once. A
  change to the items (React adding or removing one) re-appends the container
  last and rebuilds the copies; mutations inside the container, or the
  container's own insert, are ignored. The copies carry nothing the page did
  not render, so nothing here falls under §10.
- **Measurement** reads transform-independent layout only (`offsetLeft`,
  `offsetWidth`, `clientWidth`, never `getBoundingClientRect`). The period W
  is `firstClone.offsetLeft - firstOriginal.offsetLeft`, so the gap and the
  items' margins count. The track animates `translateX(0) → translateX(-W)`,
  linear, forever, W / Speed seconds per period, on the document timeline,
  reversed for the other direction. A `ResizeObserver` on the root and the
  track starts motion when the root narrows below the items, stops it (copies
  removed, button hidden) when it widens past them, and otherwise restarts
  from the current progress if W changed; the size change its own copies
  cause is a no-op.
- **Pause and stop** (WCAG 2.2.2): motion pauses while the pointer is over the
  root, while the root is off screen and while the document is hidden (the
  pauses add up), resuming from where it stood. It **stops**, until Play, on
  Pause and when trusted keyboard focus enters the track (not the button);
  each focus then sets the animation's time so the focused item lies inside
  the root's content box (its padding and the track's offset count), at the
  nearest time within one period. Untrusted events are ignored.
- **Reduced motion**: never starts; turned on mid-visit, it cancels the
  animation, removes the copies and hides the button, and focus on the button
  moves to the track's first focusable item, or to the root (given
  `tabindex="-1"` until it blurs). Unmount does the same cleanup, so the DOM is
  the server's again.
- **What the designer can still break**: items wider than the root, and
  focusable items past the edge on a page without JavaScript, stay
  unreachable; media inside a marquee (`video`, `audio`, `iframe`) is
  unsupported, since its copies would load or play twice; and a track
  styled to wrap (`flex-wrap`) or to run vertically (a column direction)
  breaks the measurement, which the structure check does not catch, since it
  reads no styling.
- The package gains no runtime dependency (the closure is the control's
  three). The builder's contrast check classifies the Pause button as
  rendering its own text and Marquee and the track as rendering the
  designer's children only. The paused-script publish fixture covers Marquee
  through the Components panel's OrganizeOS section. Nothing changes in the
  published-site runtime,
  the CLI or the templates.

**Motion presets**, part A, the scroll-driven half of Track 2 phase 3: a
player for upstream's own `animationAction` data, and the Inspector's Motion
tab that writes it. Design:
`docs/superpowers/specs/2026-10-26-builder-motion-presets-design.md` in the
OrganizeOS repo (its section 14 amends the earlier sections), plan
`docs/superpowers/plans/2026-10-26-builder-motion-presets.md`. Owner decision,
2026-10-26: no Motion (the library) fallback; a browser without scroll and view
timelines gets the static page.

- **Animate Children** (`src/animate/`, registered as
  `@organizeos/site-components:AnimateChildren`, meta `category: "hidden"`):
  a `div` with every prop passed through, `display: contents` by its preset so
  wrapping keeps the layout, content model `instance` with `instance`
  children. Props: `action` (upstream's `animationAction`, the one initial
  prop, which is what makes upstream's Animation section show in place of the
  props panel, unchanged, "Run on canvas" included) and `stagger` (number,
  default 0, edited only in the Motion tab). It plays the action on each of
  its element children (the canvas-check boxes are not targets), the same
  meaning as upstream's removed `AnimateChildren` (§2; only its name is
  used), so a later swap is a rename. Saved data stays upstream's,
  unextended; stagger is a separate prop.
- **The player.** `play-action.ts` maps an action to WAAPI plays, pure;
  `use-animate.ts` attaches them after hydration with native `ScrollTimeline`
  and `ViewTimeline` (`timelines.d.ts` declares them), one `try/catch` per
  `animate` call, and cancels them on unmount, on a change of action or
  stagger (then rebuilds), and when `prefers-reduced-motion: reduce` starts
  matching. Nothing plays under reduced motion or without the timeline class
  in `window`; the server renders the children with no animation styles.
  Ranges go as strings (`"entry 10%"`; a scroll action's `end` offset as
  `calc(100% - v)`), no duration or delay, `"infinite"` iterations as
  `Infinity`. Stagger (view actions, percentage offsets in one named range)
  moves each child's start by `min(s, 0.5 * w / (n - 1))` per child and never
  its end, so the last child keeps at least half the range and every reveal
  finishes within the reachable scroll. A view animation whose target sits
  inside an element with overflow `hidden`, `auto` or `scroll` (the
  scrolling element excepted, with the body counting as the viewport when the
  root's overflow is `visible`) does not attach. `to-css.ts` serializes
  keyframe values (`unit`, `keyword`, `unparsed`, `var`, `tuple` and `layers`
  of those, `rgb`, sRGB `color`), pinned to `css-engine`'s `toValue` by a
  package test, with `@webstudio-is/css-engine` and `css-data` as
  devDependencies for that test only. The closure gains no package: the
  component inlines the play flag's name (`flag.ts`, pinned to upstream's
  constant by a test).
- **What part A does not play**, shown on the canvas as a note on the Animate
  Children (the package's canvas check) and skipped silently on published
  pages: keyframe values of type `function` (`transform`, `filter`,
  `backdrop-filter`), `shadow` (`box-shadow`, `text-shadow`) and `image`
  (`background-image`), and colors outside sRGB; a view action with a
  `subject`; an animation with an `enabled` list; a range or inset set to a
  variable; the overflow case above; a value the engine rejects; and, on the
  canvas only, a browser without the timelines. Upstream's transform controls
  write `translate`, `scale`, `rotate` and `opacity` as tuples and units,
  which play.
- **The canvas play hook**, `src/hooks.ts` (the package's `hooks` entry, which
  `canvas/canvas.tsx` already registers): on Navigator select it walks the
  selected path outward and flags the first Animate Children or Convergence
  Field it meets (nearest wins when one is nested in the other) with the
  memory prop `data-ws-animation-can-play-on-canvas` (upstream's Navigator
  reads it for its icon), and every select and unselect first clears the
  instance it flagged last, so a block removed by undo or delete and brought
  back is never left playing unselected. On the canvas an Animate Children
  plays only with that flag or its action's "Run on canvas" (`isPinned`), a
  Convergence Field only with the flag; preview and published pages ignore
  both.
- **The Motion tab**, the Inspector's third tab, after Style and Settings,
  with no tooltip of its own
  (`features/organizeos-panel/motion-tab.tsx`, mounting `Motion` from
  `motion.tsx`, presets in `motion/presets.ts`). It is offered as the rest of
  the OrganizeOS builder UI is, in design mode, on an HTML page; content mode,
  XML and text pages keep upstream's Settings only, and a stored `"motion"`
  falls back to Settings where the tab is not offered. Its target is the
  selected Animate Children, else the selection's parent if that is one, else
  the selection, which a preset wraps in a new one; the Body, the page root and
  Global Root are refused (the tab reads "Select a section"), and
  `wrapInstance` refuses with its own toast what the content model does not
  allow (an `li`, a `tr`, a Radix part: the wrapper counts as a `div`).
  Reveal (fade and a 12px rise over `entry 0%` to `entry 60%`, fill
  `backwards`), Reveal staggered (the same, stagger 8) and Gentle parallax
  (24px each way over `cover`, fill `both`) are upstream view actions using
  only fields upstream's editor shows; each writes `action` and `stagger` in
  one undo step, through `wrapInstance`'s `onWrap` (§7) or one
  `updateWebstudioData` on an existing wrapper, replacing the designer's
  edits to the previous action. With an Animate Children selected (a preset
  selects the wrapper it adds), the tab shows its Stagger field, 0 to 20 (the
  range is the Stagger label's tooltip, "0–20 %", a `FieldLabel` as the
  Animation editor's labels are), and below it upstream's Animation editor,
  upstream's `PropsSectionContainer` for the selection, only while a
  breakpoint is selected (it is undefined only in a project with no
  breakpoints, where upstream would render the whole props panel instead). Settings shows the same editor, and the two are never
  mounted together. With a child of an Animate Children selected, the presets
  act on the wrapper, and "Select Animate Children" selects it. The tab
  shows the presets and fields only: no line explaining what a preset does to
  the selection, and no note on where and when the motion plays. Tests check
  that the package's copies of upstream's "new animation" presets
  (`src/animate/__fixtures__/`) still equal upstream's files and that the
  Motion tab's presets equal the actions the player tests play.
- **The Wrap-in caveat.** The command panel's "Wrap in" group offers any
  component named `…:AnimateChildren`, so every org can wrap in one there,
  denied or not. Harmless: one with no animations plays nothing. The
  Motion presets themselves are behind the blocks' deny list.
- The builder's contrast check classifies Animate Children as rendering no
  text of its own. Nothing changes in the published-site runtime packages,
  the CLI or the templates.

**Convergence Field**, the third block of the Components panel's OrganizeOS
section: the brand's field of
the mark's arms, each pointing at a focus in 45-degree steps and fading from
faint near a clear zone to solid at the edges, drawn behind the block's
children as inline SVG (Track 2 phase 3, "field animation"). Design:
`docs/superpowers/specs/2026-10-26-builder-convergence-field-design.md` in the
OrganizeOS repo (its section 10 amends the earlier sections; owner decision:
Settle turns arms 45 degrees into place), plan
`docs/superpowers/plans/2026-10-26-builder-convergence-field.md` (its
"Amendments from review" take precedence over its task text).

- **The block** (`src/field/`, registered as
  `@organizeos/site-components:ConvergenceField`, meta `category: "hidden"`):
  a `div` with every prop but the field's passed through, content model
  `instance` with `instance` children, `position: relative` and
  `isolation: isolate` by its preset. It renders a decorative `svg`
  (`aria-hidden`, `focusable="false"`, absolute at `inset: 0`, `z-index: -1`,
  `pointer-events: none`) and then the children, so the field sits above the
  element's own background and below its content. The template
  (`src/convergence-field.template.tsx`) is a Band root, `min-height: 560px`,
  padding, the night background `#0B1A1F`, holding a centred Box with a heading
  and a line of text in the clear zone.
- **Props**, each clamped by the runtime (a bound expression may give
  anything; anything else falls back to the default): **Shape** (Band, the
  default, Wide, Panel, Square, Tall), **Density** (24..96, default 40),
  **Focus X** and **Focus Y** (10..90%, default 50), **Zone width** and
  **Zone height** (10..90%, defaults 60 and 50, read as the clear ellipse's
  diameters), **Inner color** and **Outer color** (defaults `#3FC9E0` aqua and
  `#F4EFE6` cream), **Motion** (None, the default, or Settle).
- **Shape and cropping.** The field is drawn in a fixed box chosen by Shape
  (Band 1800 by 600, Wide 1600 by 900, Panel 1600 by 800, Square 1000 by 1000,
  Tall 900 by 1200 units) and scaled with `preserveAspectRatio="xMidYMid
slice"`, so it covers the element and is cropped on its narrower axis.
  Focus and zone are percentages of the box, never of the element: nothing is
  measured, so the server and the client render the identical SVG and it
  hydrates without a mismatch. The help text recommends the Shape closest to
  the element's aspect, and Tall for sections taller than wide on phones.
- **Density is box units.** Density is the generator's grid `spacing` in box
  units, the same on every Shape (a Wide box is 1600 units across). The clamp
  bounds the arm count: 398 arms at the defaults (Band), 604 on Wide, 1,814 at
  density 24 on Wide, and under 2,500 anywhere inside the clamps (the
  homepage: thesis band 534, pillars 214). Each clear-zone radius is further
  held to 0.8 of the focus-to-nearest-edge distance on its axis, since at the
  edge the generator's fade divides by zero (every arm solid) and past it the
  field is empty; the generator itself is unchanged.
- **Drawing.** `defs` holds two arm groups, `{id}-arm-plus` and
  `{id}-arm-minus`, each the arm path centred by
  `translate(-21.8 -64.165)`, and each arm is a `use` with the homepage's
  `transform` attribute referencing one or the other by the grid parity of
  `(i + j)`. One `g` per fade level carries
  `fill: color-mix(in srgb, <outer> k%, <inner>)` and its opacity, the
  homepage's level math with the brand variables replaced by the two colors.
  Ids come from `useId()`, so two fields never share one, and are used for
  `id` and `href` only, never in a CSS `url()`. The colors reach the DOM only
  as a `fill` value in React's `style` object, and only after `validColor`
  accepts them: `#hex`; `rgb()`, `rgba()`, `hsl()`, `hsla()`, `oklch()`,
  `oklab()` and `color()` with plain arguments; a named color; or
  `var(--name)` with an optional fallback of the same grammar. Anything else
  (`red; background: url(x)`, an unbalanced parenthesis, a brace, a comment,
  a `url()` fallback) is the default. The SVG carries no designer markup, no
  script and no event attribute, so nothing here falls under §10.
- **One generator, two copies.** The fork cannot import from the OrganizeOS
  repository, so `src/field/generate.ts` is a verbatim copy of the homepage's
  generator (`client/lib/marketing/convergence-field.ts`: `convergenceField`,
  `zoneDistance`, `LEVELS`, the types) plus the arm path, its centring offset,
  the arm transform and the fade level math from
  `client/components/marketing/convergence-field.tsx`, with a header naming
  the source commit. `src/field/__fixtures__/convergence-field.fixture.json`
  is a byte-for-byte copy of OrganizeOS's
  `client/tests/fixtures/marketing/convergence-field.fixture.json` (the
  homepage generator's output on fixed cases: the homepage's two uses, each
  Shape at the defaults, density 24 and 96, focus 10/10 and 90/90, a zone
  touching the edge), and `generate.test.ts` holds the copy to every case
  exactly. OrganizeOS's own test holds its generator to its copy, and its CI
  downloads this file from `main` and `cmp`s it with its own. Neither copy is
  changed alone.
- **Changing the generator** is a two-repository change, in this order (also
  in `__fixtures__/README.md`): in OrganizeOS, change the generator and run
  `npx tsx scripts/write-convergence-field-fixture.ts` from `client/`; copy
  the written file here with `cp`, check it with `cmp`, change `generate.ts`
  to match, update the commits in its header and the README, and merge the
  fork's change first; then open the OrganizeOS pull request with the
  generator and the fixture, whose CI comparison is red only while the change
  is half landed.
- **The nested `.prettierrc.yaml`** in `src/field/__fixtures__/` sets
  `rangeEnd: 0` for `*.fixture.json`: the pre-commit hook runs Prettier on
  staged JSON, and reformatting the fixture would break the byte-for-byte
  comparison with OrganizeOS's copy (which OrganizeOS keeps out of Prettier
  through `client/.prettierignore`). Formatting the empty range leaves the file
  as it is; the file repeats `trailingComma: es5`, since a nested config
  replaces the root's rather than merging with it. Tests read the fixture with
  `readFileSync` and `JSON.parse`, never a JSON import, which would make the
  typecheck infer a huge literal type.
- **Settle** (`use-settle.ts`). With Motion Settle, after mount, the runtime
  registers `--os-field-settle` (`<number>`, inherited, initial `0`) with
  `CSS.registerProperty` and animates the `svg` with keyframes
  `[{ "--os-field-settle": 1 }, { "--os-field-settle": 0 }]` on
  `new ViewTimeline({ subject: root })`, `rangeStart: "entry 0%"`,
  `rangeEnd: "entry 80%"`, `easing: "ease-out"`, `fill: "both"`. The two arm
  groups carry `rotate: calc(var(--os-field-settle) * 45deg)` and `-45deg`,
  which compose after the path's centring transform, so every arm turns about
  its centre from 45 degrees off (the sign alternating by grid parity) into
  place as the element's top enters the viewport; the property reaches each
  arm by inheritance through its `use`. One animation drives the field, and
  only two elements carry the `calc`. At rest, cancelled or unregistered the
  property is 0 or unset and the field is exactly the static one: settle only
  rotates arms and never hides anything.
- **When it does not settle.** Under `prefers-reduced-motion: reduce` (with a
  change listener that cancels the animation when it turns on; nothing
  restarts on its own); in a browser without `ViewTimeline`,
  `CSS.registerProperty` (jsdom has no `window.CSS` at all) or
  `element.animate`, with part A's "unsupported" note on the canvas; inside a
  scroll container other than the page, by part A's `findScrollContainer`
  (an ancestor whose block-axis overflow is `hidden`, `auto` or `scroll`;
  `clip` is fine), with part A's overflow note; and on the canvas unless the
  play flag is set (`canPlay` is `renderer !== "canvas" || flag === true`; the
  field has no action, so nothing pins it). A second registration in the same
  document throws `InvalidModificationError`, which the runtime takes as
  registered, so registration is remembered by the document itself (a module
  flag could not tell the builder's document from the canvas's); any other
  registration error leaves the field static with the unsupported note. The
  animation is cancelled on unmount and when Motion changes. The notes are a
  `CanvasCheck` after the children, as Animate Children's are, so they render
  on the canvas only.
- **Settle cost.** A registered property animates on the main thread: the
  browser recomputes the two groups' rotation each frame and re-renders the
  `use` instances. The PR's manual pass measures frame time at density 24 on
  a 4x CPU throttle; if it is over budget, Settle floors the density.
- **Contrast.** The builder's contrast check classifies the root as rendering
  the designer's children only and, through `rendersBackgroundLayer` in
  `backgrounds/contrast.ts`, pushes an image layer above the root's own
  layers even when it has no color or image of its own. So the check can't
  measure text over a Convergence Field, and that text raises no warning in
  Background presets, while text on a child with an opaque background (a
  scrim) is still checked.
- The package gains no runtime dependency, and the shipped closure no bare
  specifier (the field uses `react` and `@webstudio-is/react-sdk/runtime`, as
  Animate Children does). The paused-script and contrast coverage fixtures
  cover it through the Components panel's OrganizeOS section. Nothing changes
  in the
  published-site runtime packages, the CLI or the templates.

**Rich Text**, the Components panel's OrganizeOS section's Content block
(W7.1): shows a collection item's rich-text field. Design: OrganizeOS
`docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md` section 4.7;
plan `docs/superpowers/plans/2026-10-26-cms-in-the-builder.md` task W7.1. It is
built on the spike's result (Rich Text styling spike, below): `ws:descendant`,
no class fallback.

- **The value.** `/v1/collections*` sends a rich-text value as
  `{ html, text, nodes }`; `nodes` is a node tree, version 1:
  `{ v: 1, children }` of blocks (`p`, `h` with `level` 2 to 4, `ul` and `ol`
  with `items`, `quote`, `code`, `hr`, `img` with an optional `caption`) and
  inlines (`text` with `marks` among `b`, `i`, `u`, `s` and `code`, `br`, `a`
  with `href` and `newTab`). The format is the platform's
  (`client/lib/collections/rich-text-nodes.ts`) and is pinned by the shared
  fixture `src/__fixtures__/rich-text.json`, which both repositories test
  against. A designer places the block inside a `ws:collection` item and binds
  its one prop, `value` (json, control json), to the field's nodes, for
  example `item.body.nodes`. Bound to the whole field (`item.body`) by
  mistake, it reads the `nodes` inside it.
- **The component** (`src/rich-text/rich-text.tsx`, registered as
  `@organizeos/site-components:RichText`) is a `forwardRef` `div` that spreads
  the rest of its props and the ref onto itself and ignores its children (the
  descendants), as Markdown Embed does, and renders the tree as React
  elements: `p`; `h2` to `h4`; `ul` and `ol` with `li`; `blockquote`;
  `pre > code`; `hr`; `img` with `loading="lazy"`, inside `figure` with a
  `figcaption` when it has a caption; `a` with `rel="noopener noreferrer"`,
  and `target="_blank"` only when `newTab` is `true`; `strong`, `em`, `u`,
  `s`, `code` and `br`. It never uses `dangerouslySetInnerHTML`
  (`src/no-raw-markup.test.ts` fails on the name anywhere in the package's
  sources but `org-script.ts`, the pause's list of props it keeps off).
- **It checks the tree again**, because a published site freezes this code
  while `/v1` may grow looser: a node of a kind it does not know, or with a
  heading level or a field it cannot read, renders nothing, and a mark it
  does not know is left off its text; a link
  whose address fails `safeLinkHref` renders its text; an image whose source
  is not `https:` is left out, with its caption; a quote or list nested at
  depth 8 or deeper renders nothing (top-level blocks are depth 1); rendering
  stops after 5,000 nodes; a root whose `v` is not 1 renders nothing. Text is
  React text, so it is escaped.
- **The address rules** are in `src/shared/safe-href.ts`, pure: `isSafeHref`
  and `safeLinkHref` for a link (`http:`, `https:`, `mailto:`, `tel:`, a root
  path not starting `//` or `/\`, a `#` fragment, checked after stripping
  tabs and newlines and trimming C0 controls and spaces, as a browser does;
  the platform's `richTextHref` rule), `safeImageSrc` (`https:` only), and
  `isNavigableUrl`, the `http:`/`https:` rule `form/navigate.ts` keeps for the
  navigations a block makes. This link rule is narrower than the org-script
  pause's address rule (§10), which also allows `sms:` and relative
  addresses; the two are not meant to agree.
- **On the canvas** with no value (unbound, or the item still loading), the
  block shows a sample made, node for node, of fixture cases
  (`src/rich-text/sample.ts`, pinned by its test), holding every tag the
  template styles. Its links and image point at example.org, so the image
  shows its caption and no picture. In preview and on a published page, no
  value renders nothing.
- **The template** (`src/rich-text/rich-text.template.tsx`) is the root and
  17 `ws:descendant` instances, one per element: ` p`, ` h2`, ` h3`, ` h4`,
  ` ul`, ` ol`, ` li`, ` a`, ` blockquote`, ` pre`, ` code`, ` hr`, ` img`,
  ` figure`, ` figcaption`, ` strong`, ` em`. Each names one tag; a selector
  naming several would sit inside `:where()`. ` code` styles inline code and
  the code block's text alike; ` pre` is the block. `value` is left unbound,
  and the insert binds nothing. The meta: `contentModel` children
  `[descendantComponent]`, a `div` preset of `display: contents` (so the
  spike's caveats hold: styles on the root itself draw no box, and a
  descendant outlines nothing on the canvas), and the icon `DescriptionIcon`,
  which no upstream component uses.
- The section background contrast check (`backgrounds/contrast.ts`) counts it
  among the components that render their own text, each descendant a text
  group of its own. Content mode does not edit its text: the CMS does.
- **Shipping.** `components.ts` exports it; its closure reaches
  `rich-text/rich-text.js`, `rich-text/sample.js` and `shared/safe-href.js`,
  and imports nothing beyond `react` and `@webstudio-is/react-sdk/runtime`
  (`organizeos-components.test.ts`). The org-script prebuild check passes it
  and its descendants unchanged, whatever its value holds
  (`organizeos-org-script.test.ts`); its own re-validation is the guard on
  what it renders. Nothing changes in the published-site runtime packages.
- **Fixtures.** `rich-text.json` and `preview-assertion.json` (the latter for
  W7.2) are copies of the platform's, recorded with their source commit in
  `src/__fixtures__/README.md`; `diff -r` the folder against the platform's
  before each fork PR.

**The record picker**, `settings-panel/controls/organizeos-record.tsx`, behind
one marked branch in `settings-panel/controls/combined.tsx`, before the text
control. A table, `recordPickers`, maps a block's component to its picker (what
it lists, and the wording of its hint and placeholder); a `record` prop on any
other component keeps the text control. The Signup Form's `record` is a select:

- "None (org defaults)" first (an empty `record`), then the forms the block
  takes, as "name (Newsletter)" or "name (Contact)": newsletter
  (`contact-signup`) and contact (`contact-form`) forms, never membership
  forms.
- It reads the selected root's computed `data`, which the builder's resources
  loader already fetches for the block's own binding (scoped to its root, so
  loaded while the block is on the open page), and makes no request of its
  own (Reload, below, asks that loader again).
- A value it cannot find stays listed as "Unavailable form". Nothing shows
  under the select while the forms load. Only when their load failed (the
  resources loader's result for a Resource the root's `data` reads has `ok`
  false: an error body, or a fetch that threw) does one line show, "Forms
  didn't load. Reload.", where Reload asks the loader for that request again
  (`invalidateResource`) without reloading the builder
  (`$selectedInstanceFailedLoads`, `reloadFailedLoads`). The line hides as
  Reload is clicked and returns only for a new failure, the loader's next
  answer. When the builder's whole resource request fails (the
  resources-loader route itself, not one Resource), the picker shows nothing:
  upstream's loader keeps those requests pending, so there is no result to
  read as a failure.
- It keeps the upstream select's binding support.

The RSVP Form's `record` is a select over the events in its computed `data`
(its Events binding, the whole list):

- The events not yet over come first, soonest first, then the ended ones, marked
  "(ended)", the latest first (the Events Resource lists the org's whole
  history, so the oldest ended events are at the bottom). An event is ended when
  its end time, or its start time when it has no end time, is past, as the
  block reads it; one whose start cannot be read is not ended and comes last
  among the upcoming. Events that start together keep the order the data has.
- Each is labelled "title, date", the date in the event's own zone (a medium
  `en-US` date: an event at 02:00 UTC on Nov 14 in Los Angeles is "Nov 13"), in
  UTC for a missing zone or one the browser does not know, and the title alone
  when its start cannot be read. A blank title is "Untitled event".
- There is no "None": a form with no event shows Unavailable on the live site,
  so the select reads "Pick an event" until one is chosen. Choosing writes the
  event's id to `record`.
- It skips what the block cannot find, as the block does: an entry with no
  string id, a blank or padded id, and a second event with an id it has seen.
- A value it cannot find stays listed first as "Unavailable event" (the event
  was unpublished, deleted or made private, or has not loaded). Nothing shows
  under the select while the events load; a failed load shows "Events didn't
  load. Reload.", as the Signup Form's does. An empty list is data: the select
  is empty.

**Share codes**, `src/share-code/`: a member's share link opens an org page
with `?r=` and a 10-character code, which OrganizeOS credits to the member when
the visitor signs up, registers or gives during that visit. The blocks keep the
code in the page's address only, never in a cookie or storage.

- **Forms.** The Signup Form and the RSVP Form read the code when they submit,
  never while rendering, and send it as `referral_code` (the platform's name)
  only when it has the code's shape; without one the body is what it was. A
  platform that answers `invalid_request` to such a body is asked once more
  without it (`postWithShareCode`, `src/form/submit.ts`): both endpoints give
  that answer before any rate limit, form or event read, or write, so a
  platform that does not take the code costs the credit, never the
  submission.
- **Links.** `attachShareCodeCarrier` carries the code on a click on a link
  to a platform page on the same host. It listens on each platform block's
  root, through `useShareCodeCarrier` (the two forms' `<form>`, and the
  **Share Code Carrier**, the root of the Event List and the Event Card), and
  on the document of every published page, through `PageShareCodeCarrier`,
  the package's page entry (`src/page.ts`), which the html route template
  mounts once (§8), so a designer's own link outside every block carries it
  too. The list, `platformPathPatterns`, is the platform's own: donate,
  fundraise, petitions, join, shop, cart, checkout and an event's page; the
  donor self-service pages, whose links carry a token from email, are not on
  it. The code is read at the click, and a click another handler cancelled is left
  alone. The carrier adds the code to the link's `href` unless the link
  already has an `r`, which it keeps. A plain click then has its default
  prevented and goes to that address by document (`navigateTo`), whether or
  not the `href` was rewritten, which keeps a client-side router out: a
  published link may route by its own `to`, not the DOM `href`, and would drop
  the code, even on a link an earlier Ctrl-click or the first click of a
  double-click has already given its `r`. Here the fork departs from the
  platform's own carrier, which leaves a link that already has `r` to its
  default. Any other click (a modifier key or another button,
  `target="_blank"`, `download`) follows the `href`. Nothing stops the click's
  propagation, and a carrier inside another acts once: both listen in the
  capture phase, which reaches the document, then an outer root, before an
  inner one, so the outer carrier cancels a plain click and sends it by
  document before the inner one leaves it as cancelled, and gives any other
  click its `r` before the inner one keeps it. A click therefore gets one `r`
  and at most one navigation however many carriers the page has. `navigateTo`
  does the same for an after-submit page that is a platform page. Nothing
  happens on the canvas or in the Preview.
- **Share Code Carrier** (`@organizeos/site-components:ShareCodeCarrier`): a
  hidden `div` that passes every prop through, takes any children and has no
  props of its own, the root for blocks that are templates over native
  elements. It renders the same markup on the server and the client and acts
  only on a click, so it cannot cause a hydration mismatch. The builder's
  contrast check classifies it as rendering the designer's children only
  (`rendersDesignerChildrenOnly` in `backgrounds/contrast.ts`).
- **The copy.** `share-code.ts` copies OrganizeOS's constants and carry
  function (`client/lib/referrals/code.ts`, `client/lib/referrals/carry-code.ts`
  and the flow family of `client/lib/verification/public-route-allowlist.ts`),
  and both repositories test their copy against `__fixtures__/share-code.json`
  (`share-code.test.ts` here): change OrganizeOS first, then copy, as for the
  contract fixtures below.
- The block carriers stay beside the page's: a page published before the
  page's carrier has only them. An Event List or an Event Card inserted
  before the Share Code Carrier keeps its `ws:element` root and has no carrier
  of its own, and the page's carrier carries its link. Nothing changes in the
  published-site runtime packages.

**Site templates**, `src/site-templates/` in the package and
`features/organizeos-panel/site-templates/` in the builder (OrganizeOS design
`docs/superpowers/specs/2026-10-30-website-template-inventory-design.md`,
sections 6.1 to 6.4; plan
`docs/superpowers/plans/2026-10-30-website-template-foundations.md`): a whole
site, pages and all, written as code in the fork and written once into an
org's untouched project, from a chooser. The foundations ship one test
template, `spike`, a fixture the catalog does not list, so no member is offered
anything yet.

- **The module format** (`types.ts`). A template is a folder under
  `src/site-templates/` whose `index.tsx` exports one `SiteTemplate`: `id`,
  `category` (one of nine; `CATEGORY_ORDER` is the chooser's order), `name`,
  `oneLine`, `styleTags`, `status` (`draft` or `listed`), `dependsOn`,
  `thumbnail` (a file name in `images`), `variables` (the six canonical
  values), `images` (by file name: `url` from a `?url&no-inline` import of the
  file in the template's `images/` folder, `sourceUrl`, `alt`), `fonts` (by
  file name, a `.woff2` file: `url` from a `?url&no-inline` import of the file
  in its `@fontsource` package, `family`, `licence`, `source`; Fonts, below)
  and `pages` (`key`,
  `name`, `path`, `title`, `description` and a `body` function). A body takes a
  `PageContext` (every page's id by key, assigned before any body renders, so a
  link is a page value that survives a rename; `placeBlock`; `image`,
  `backgroundImage` and `imageAlt` by file name) and returns fresh JSX rooted
  at `<ws.element ws:tag="body">`: `renderTemplate` keys instances by element
  identity, so a piece used twice (Nav, Footer, a card) is a function, never a
  constant. `renderSiteTemplate` (`render.ts`) renders every page into a
  fragment, with the placements it recorded; the caller supplies the page ids
  and the asset id of each image. `catalog.ts` lists `SITE_TEMPLATES` (the
  first, Field Journal in `nonprofit/field-journal/`, a draft), and the
  chooser offers `listedTemplates()`,
  the `listed` ones in category order.
  Listing is the owner's call, made by changing `status` in a PR. Nothing the
  published site's copy reaches (`components.ts`, `metas.ts`, `hooks.ts`)
  imports the folder (Shipping in published sites, below).
- **The canonical variables** (`canonical-variables.ts`): `--base`,
  `--accent-1`, `--accent-2`, `--text`, `--font-heading` and `--font-body`. The
  blank-start values are `#ffffff`, `#18181b`, `#2563eb` and `#18181b`, and
  `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for both fonts:
  the look the blocks had before the variables. They sit on Global Root's
  local style source at the base breakpoint, written by style key, so a second
  write replaces the first. Provisioning writes none (its update path writes
  content columns, not styles, and its seeds re-sync on every provision call).
  The file holds the names, the values, `contrastRatio` and `firstFontFamily`
  (the family a font value names first: `"Source Serif 4", Georgia, serif`
  reads `Source Serif 4`), and imports nothing from the catalog: the Style
  panel imports it alone, so the templates and their images stay out of the
  panel's chunk. The Background presets take their roles by these names when
  all four colours are there (Section backgrounds, above).
- **`placeBlock(key, placementId)`** (`place-block.ts`) is the only way a
  template places a platform block. `key` is the Components-panel key
  (`@organizeos/site-components:SignupForm`, `:RsvpForm`, `:EventList` or
  `:EventCard`). It returns a deep clone of the block's template whose root has
  the `ws:id` `placementId` and whose other `ws:id`s are
  `${placementId}:${wsId}`: the Event blocks fix ids (`events`, `empty`,
  `unavailable`) that the insert binds by, and two placements on one page
  would collide. A descendant with no `ws:id` is left to the renderer, and only
  `ws:id` and `children` are replaced, so a collection's parameter and the
  variables its expressions read stay the same objects, bound to each other.
  Each page has a placer of its own, which records every placement (key and
  root id) beside the page's fragment and throws on a `placementId` used
  twice. Nothing is written into the site to mark a block. This needs each
  block template to be a factory: `signupFormTemplate`, `rsvpFormTemplate` and
  `rotatingTabsTemplate` create their `Variable` inside the function, since
  `renderTemplate` scopes a data source by its `Variable`, and a block's
  `meta.template` is its factory called once, so the Components panel is
  unchanged. The insert completion (`completeOrganizeosFragment`) takes an
  `instanceIdPrefix`: a bind resolves to `${prefix}${wsId}`, and with a prefix
  a block whose root the fragment lacks is refused, not inserted unbound.
- **Block tokens read the site variables.** "OS Input", "OS Button" and "OS
  Card" (`shared/form-tokens.ts`, `events/event-card.template.tsx`) take their
  background and text colours from `--base`, `--text` and `--accent-1`, and the
  focus ring from `--accent-2`, each as `var(--name, <the old literal>)`, so a
  site that defines none looks as it did. The focus ring is longhands: the
  shorthand resolves a `var()` that has a fallback to the fallback when it is
  parsed. The names are written out in those files, which do not import the
  module that lists them. Borders, the message grey and the error reds stay
  literal. A project that already holds the old tokens keeps them: an insert
  resolves a token it already has with "ours". The Signup Form's and the RSVP
  Form's headings are in `var(--font-heading)` (no fallback: on a site without
  the variable the declaration is invalid and the heading inherits, as before),
  so a template's form heading matches its own headings.
- **The check** (`checkSiteTemplate` in `check.ts`, with `style-scan.ts`; run
  over every `SITE_TEMPLATES` entry and the spike fixture by `catalog.test.ts`)
  returns one readable line per violation, and an empty list for a template that passes. It is a
  backstop to review, not a replacement. It fails a template for: a page at
  `/newsletter` or at `/*` (the 404 page's), a path the builder's page settings
  would refuse (`pagePath` from `@webstudio-is/sdk`), two pages on one path, or
  no Home (path `""`); a word on the neutrality deny list (party names and the
  like) in a title, a description, a text or a string prop; a `thumbnail` that
  is not a file in `images`; an image entry whose `url` is neither root-relative
  nor http(s) (a small file Vite inlines as a `data:` URL, which the routine
  cannot upload), or without a `sourceUrl` or alt text, or an image on the
  page's own elements that is not one of the template's images or has no alt
  text; a font whose key is not a `.woff2` file name, whose `url` is neither
  root-relative nor http(s), with no `source`, with no licence or one other
  than `OFL-1.1` or `Apache-2.0`, or whose `family` neither font variable
  names first (a publish would leave it out), and a font variable whose first
  family is neither one of the template's fonts nor a system font (a generic
  family, `system-ui`, `-apple-system`, Georgia and the like); `--text` on
  `--base`, or `--base` on `--accent-1`, below 4.5:1, or
  `--accent-2` on `--base`, which draws the focus ring, below 3:1; and, per
  page, a root that is not one `<body>` element, a child of the body that is not
  a section labelled with a name from `SECTION_LABELS` (`sections.ts`: the
  spec's section vocabulary and its short forms, plus `Nav` and `Footer`, each
  alone or followed by a variant after a colon, as in `Hero: Split`), two Event
  Cards or Event Lists under one such section, a link to a page the template
  does not have (a mistyped `pageIds` key) or to an element of a page (applying
  gives the element a new id), a link by path to anything but a route the
  platform serves (`PLATFORM_PATHS` in `platform-paths.ts`, `/donate`), or to
  one without `reloadDocument` (the published site's router has no route
  there; the kit's `linkProps` sets it), a Resource, a repeated instance id, a count of
  `h1` other than one, a Signup Form, RSVP Form or Share Code Carrier not placed
  with `placeBlock`, and, in styles on elements outside a placed block's subtree
  (a block's token used by the page's own element counts), a literal colour or
  colour keyword where a colour goes, a variable outside the six, a
  `font-family` that is not `var(--font-heading)` or `var(--font-body)`, and an
  image by URL.
- **The apply routine** (`apply-site-template.ts`) is one `updateWebstudioData`
  transaction, with `contentMode: false` and `conflictResolution: "ours"`
  whatever mode the builder is in, so root styles, tokens and assets are
  written. It runs only on an untouched project with none of the six variables
  on Global Root: Home's body has no children, the only other pages are the 404
  page (`/*`, which every project is created with) and the seeded sign-up page
  (`SIGNUP_PAGE_PATH`, `/newsletter`), and the project has no assets. The
  chooser checks this before it opens and the routine decides it again inside
  the transaction, since two admins can apply at once and a chooser left open
  goes stale (colours set after "Start blank" are never overwritten); it also
  refuses, writing nothing, when a template page's path is taken or a rendered
  page holds a Resource. It writes the template's six values over Global Root's,
  each page's body with its tokens, styles and assets
  (`insertWebstudioFragmentCopy`), and the page rows. Home keeps its row (id,
  name and path) and takes the template's body, title and description, its old
  empty body deleted with its local styles; a title or description already set
  on Home is overwritten, since an untouched project can have them; every other
  page is added at the root of the Pages tree; a link to the template's Home is
  remapped to the project's. The seeded `/newsletter` page is never replaced.
  Then each recorded placement gets the completion an insert runs
  (`completeOrganizeosFragment` with `instanceIdPrefix` `${rootId}:`, then
  `completeOrganizeosInsertMutable`), which binds the block to the org's data; a
  block it cannot bind (its Events Resource is gone) stays in place, unbound,
  and the chooser names it in an error toast. "Start blank"
  (`startBlankMutable`) writes the blank-start values for any of the six that
  Global Root lacks and overwrites none.
- **The chooser** (`template-chooser.tsx`, mounted by one marked import and one
  marked `<TemplateChooser />` in `builder/builder.tsx`): "Start from a
  template", the offered templates under their category headings with a
  thumbnail and one line each, and "Start blank". It is offered only when the
  data is loaded, the permit is `build`, `admin` or `own` (a viewer's or content
  editor's writes would not save), the project belongs to an OrganizeOS org not
  on the blocks deny list (§4; a template places blocks), the project is
  untouched with none of the six variables on Global Root, and at least one
  template is offered. Both choices write the variables, which ends the offer
  for every admin on every browser, so it keeps no per-browser state. Only a
  choice closes it: Escape and an outside click do nothing. It has no help text
  (`CLAUDE.md`, "Builder UI: options, not explanations"). A chosen template
  opens its Home, in Simple mode (the builder's Content mode) when the plan
  allows it (`$isContentModeAllowed`), in Design mode otherwise. A refused apply
  says why in one error toast: the site already has content (touched, or one of
  the variables set), the template's pages clash with the site's, or, for a
  template holding a Resource or with no project open, that the template cannot
  be applied. **Drafts** are offered beside the listed templates only when the
  builder's URL carries `templateDrafts=1`, read once as the chooser mounts (the
  builder rewrites its URL on a page or mode change and drops it); that is how
  the owner reviews a draft in a test org.
- **Images.** A template's images are imported with `?url&no-inline`, so the
  builder's build bundles each one at a URL on the builder's own origin, never
  inlined as a `data:` URL (`assets.d.ts` declares only that form, for images
  and `woff2` fonts, so a bare `?url` import does not typecheck). The routine renders the
  pages with each image's asset id computed first, the SHA-256 of its URL, which
  is the id `uploadAssets` gives an upload by URL (`getSha256Hash` in
  `asset-utils.ts`), and uploads the images by URL
  (`uploadAssets("image", urls)`) only after the transaction returns an applied
  result: a page that cannot render, or a refusal, leaves no asset behind, which
  would make the project touched for good. An id `uploadAssets` returns that
  differs from the computed one is logged; a failed upload is reported by the
  builder's own upload toast. The builder's server fetches the URL, so a
  deployment that protects its origin (a Vercel preview with Deployment
  Protection) answers with its login page and every image fails. The package's
  own lib build emits each image as a file of its own under `lib/`, which
  nothing in the builder reads (it resolves the `webstudio` export condition to
  `src/`). A template's image is a CC0
  photograph, the builder's placeholder, or OrganizeOS's own work; the spike's
  is generated by `__fixtures__/spike/images/generate.py`, recorded as its
  `sourceUrl`.
- **Fonts.** A template bundles its heading and body fonts (OrganizeOS spec
  section 2, rule 10): `woff2` files of `@fontsource-variable` packages where
  one exists, `@fontsource` static weights otherwise, devDependencies of the
  blocks package, each imported with `?url&no-inline` and recorded in `fonts`
  with its licence and source. A font variable names a bundled family first,
  then a system stack. The upload by URL reads only images
  (`getImageNameAndType` in `asset-utils.ts` names anything else a random
  `.png`), so the routine fetches each font from the builder's origin before
  the transaction, makes it a `File` named by its key, of type `font/woff2`,
  with the id `uploadAssets` gives a file, the SHA-256 of its bytes
  (`getSha256HashOfFile`), and uploads the files after the images, once the
  apply is applied: `uploadAssets("font", files)`. A font that cannot be
  fetched rejects the apply before anything is written. The upload route
  derives a font's family from its file (`getAssetData`), and the template
  records and names that family: a publish keeps a font asset only when a
  style names its family (`loadProductionCanvasDataAndProject` in
  `shared/db/canvas.server.ts`), which upstream reads from `fontFamily` styles
  alone, so one marked loop there also keeps the families Global Root's
  `--font-heading` and `--font-body` name first (`findCanonicalFontFamilies`).
  The `@fontsource` files carry no typographic family name (name ID 16), and
  the upload reads the legacy one, which can name an instance: "Public Sans
  Thin" (a variable font's default), "Barlow Medium" (a static weight whose
  subfamily is "Regular"), "Newsreader 16pt". Two marked changes in
  `getFontData` (`packages/asset-uploader/src/utils/font-data.ts`) take it
  off (`dropInstanceNames` in `organizeos-font-family.ts`): an optical size
  (`16pt`) always, and a last weight word when it is the weight the font's
  OS/2 table declares, which a static font then takes when its subfamily
  names none, so "Barlow Medium" is Barlow at 500 and "Archivo Black" at 400
  keeps its name. It holds for every font uploaded, not only a template's.
  `organizeos-font-family.test.ts` there holds every font file the approved
  direction board names to the family and weights it derives, and
  `bundled-fonts.test.ts` holds each template's `family` to the one derived
  from its file.
- **Not yet run in a deployed builder.** The spike (OrganizeOS spec, section 7,
  step 2) is `spike`, a Hero, two Events sections (one with an Event Card, one
  with an Event List), and a Sign-up section with a Signup Form, with Source
  Sans 3 as its bundled body font. It is a
  fixture, not in the catalog, so the chooser no longer offers it, even with
  `templateDrafts=1`. The run (apply to a test org, edit in Simple mode)
  waits for a template in the catalog. Until that report is in, the
  design's rules 3 and 4 (editable content in Content Blocks; platform blocks
  placed, never bound) are unproven in a real builder.

**Shipping in published sites**, `packages/cli/src/organizeos-components.ts`:

- A site never installs the package. Prebuild clears `app/__organizeos__/`
  with `app/__generated__/` and `app/routes/`, then copies the built
  `components.js` and `page.js` (the page entry every html route mounts, §8)
  and every module they reach through relative imports (static, re-exported
  and literal dynamic, parsed with acorn) into `app/__organizeos__/` with the
  package's `LICENSE` beside them (prebuild fails without the `LICENSE` or
  `page.js`). That closure never reaches `metas.js`, `templates.js` or the site
  templates (Site templates, above).
- Every published page also offers the fork's source, in its head as the
  license and code-repository links and in a visible Source link at the end of
  its body (§1). That link is the last of the body's content, so a body laid
  out as a row flex container puts it beside the content and one that clips its
  overflow can hide it. A body whose text color does not contrast with what lies
  behind the end of the page (light text set on the body for dark sections
  while the body itself has no background, or `color: transparent`) makes it
  unreadable. A site published before the head links has neither them nor the
  `LICENSE` until it is republished, and one published before the visible link
  has the head links alone.
- The react-router framework maps each component of the namespace to
  `../__organizeos__/components.js:<Name>`, a path from `app/__generated__/`,
  where page modules are written, and adds the metas. Remix and vike-ssg are
  not mapped: the publish workflow builds with the react-router templates, and
  the publisher refuses static exports.
- The copy may import only packages the react-router site template already
  depends on (today `react`, `react/jsx-runtime` and
  `@webstudio-is/react-sdk/runtime`), which resolve to the site's own pinned
  copies; `organizeos-components.test.ts` fails on any other.
- The CLI finds the build through
  `import.meta.resolve("@organizeos/site-components/components")`, and a
  missing build fails prebuild with the command that makes it. CI and
  `pnpm checks` build the package before the tests; the publish workflow
  builds every package before it runs the CLI.
- A published site freezes the component code: a fix reaches an org's
  visitors when the org republishes.
- CI note: `packages/cli/src/asset-files.test.ts` ("removes temporary files
  when asset download fails") is an upstream test that fails about one run in
  five, from a race between its temp-file cleanup and the write stream
  opening. It predates this package and is left to upstream; rerun the job.

**The platform contract the blocks rely on:**

- `POST /api/public/site/v1/signups`, same origin from the published page
  (every org host reserves `/api` for OrganizeOS): JSON only, no CORS, the org
  taken from the request's host, never the body. The body is
  `{ form_id?, fields, page_path, website, referral_code? }` (`website` is the
  honeypot); the
  answer is `{ outcome }` (`subscribed`, `confirm_email` or `received`) or
  `{ error, field? }`. The block maps an outcome it does not know to Success
  and any error to Error, so a frozen build survives new answers.
- `POST /api/public/site/v1/rsvps`, on the same terms (same origin, JSON only,
  no CORS, the org from the host, no platform cookie read or set). The body
  has `event_id`, `first_name`, `last_name`, `email`, `phone?`, `guests?`,
  `shift_ids?`, `shift_role_id?`, `answers?`, `email_consent?`, `page_path`,
  `website` and `referral_code?`: `guests` carry names only, `answers` are
  strings by question id (a
  multiselect as a JSON array of strings, a checkbox as `"true"` or `"false"`,
  a number as a plain decimal with no exponent, anything else as typed), and
  `website` is the honeypot. The answer is `{ outcome }`
  (`registered` or `waitlisted`, 200) or `{ error, field? }`: `invalid_request`
  (400), `not_found` (404), `invalid_field` (422, with `first_name`,
  `last_name`, `email`, `phone`, `guests`, `shift_ids`, `shift_role_id` or
  `answers.<question id>`), `full`, `ended` and `role_full` (409; `role_full`
  carries `open_roles: [{ id, name }]`, which may be empty, and no count),
  `rate_limited` (429, with `Retry-After`) and `unavailable` (503). The block
  maps an outcome it does not know to Registered and an error it does not know
  to Error, so a frozen build survives new answers, and a build that predates
  `ended` shows Error for it. The platform answers a repeat RSVP as it would a
  new one, so the page tells a holder and a stranger nothing different, but
  for the contact-cap window under RSVP Form below.
- In both bodies, `referral_code` is the visit's share code, sent only when
  well-formed; the platform ignores a malformed one and answers the same with
  or without it, and a block that is refused with `invalid_request` asks once
  more without it.
- `GET /v1/events`, through the Events catalog Resource (the RSVP Form and its
  picker): every public event, past ones included, soonest first, each with the
  registration details the form reads on top of the display keys: `waitlist`,
  `full`, `max_guests`, `shifts` (each with its `roles`, only active or full
  ones) and `questions`. A shift and a role say only whether they are `full`;
  no count appears. The list is every event, not the first 1000, and a failed
  read of any page answers the 503 rather than a list with items missing. The
  keys are additive, and a build that does not know them ignores them.
- `GET /v1/events?upcoming=true`, through the Upcoming Events catalog Resource
  (the Event List and Event Card): the events not yet over, soonest first,
  each with the event's `timezone`, the zone the platform resolves for it: the
  stored zone when `Intl` accepts it (a tz database name such as
  `America/Chicago` or `CET`, or an offset such as `+05:30`),
  `America/New_York` when unset or invalid (the event form stores the zone it is
  sent unchecked). A browser that does not know the zone shows the event in UTC
  (the Time element's fallback). An older platform ignores `upcoming`. Before
  the one public-event rule (plan task P1) it also lists members-only and
  private events, which `is_public` lets through by default. Before the display changes (P2) it also lists ended events, with
  no `timezone`. A page published then shows them until the platform deploys,
  which is why OrganizeOS deploys first. The new platform honors `upcoming`
  only when it is exactly `true`. A failed read answers
  503 `{ error: "unavailable" }` with no `Cache-Control`, so no cache stores
  "no events"; the blocks show their Unavailable box. Only public, published
  events are listed (one rule for the Website, Website Lite's homepage and
  embeds, `/v1/stats` and the anonymous RSVP gate).
- `GET /v1/forms`, through the Forms catalog Resource, server-side with the
  project's read token, with the `Cache-Control` every `/v1` read sends
  (`public, s-maxage=60, stale-if-error=600`). The site's resource cache (§8)
  depends on it: without `s-maxage` (or `public` with `max-age`) every page
  view calls the platform again, and without `stale-if-error` a platform
  failure shows at once.
- The Website area route the link at the foot of the Components panel's
  OrganizeOS section leads to (`/<subdomain>/website`, which the builder's
  menu and `manageUrl` use too). The OrganizeOS contract also lists the Embeds
  hub and events area routes (`/<subdomain>/pages/embeds`,
  `/<subdomain>/events`), which the builder no longer links to.
- Both sides build to the contract fixtures in OrganizeOS's
  `client/tests/fixtures/site-components/`, which the package copies into
  `src/__fixtures__/` for its tests (`forms.json`, `events.json`,
  `share-code.json`, `signups/` and `rsvps/`). To keep them in step, change the
  OrganizeOS copy first, copy the files over unchanged, update the source
  commit in the note at the top of the copy's `README.md`, and check that
  `diff -r` between the two folders shows that note alone. `share-code.json`
  must also be a Prettier fixed point under both repositories' JSON settings
  (print width 80), so neither pre-commit hook changes a byte of either copy.
  A change is additive or ships under a new endpoint version: a published site
  keeps calling what it was built against.

**Deploy order** for this feature (each phase, each slice): OrganizeOS first,
then the builder. That reverses the usual order (§5, and the OrganizeOS
contract table: the builder first, so a new optional field is accepted before
it is sent). Here the platform half adds new endpoints that nothing calls until
the builder half ships, while a block inserted before they exist can neither
load its forms nor submit. Phase 2a (display) adds no endpoint, only
`?upcoming=true`, a `timezone` key and a 503 to `GET /v1/events`. Until the
platform's one public-event rule deploys (plan task P1), that endpoint also
lists members-only and private events, and until its display changes deploy
(plan task P2) it lists ended events with times in UTC. So no Event List is
published before the platform half is live. Phase 2b (RSVP) adds the rsvps
endpoint and the registration keys on `GET /v1/events`, with no migration: a
page published before they exist would find no guests, shifts or questions in
the event data, which lets a visitor post an RSVP that misses a required
answer, to an endpoint that is not there. So no RSVP Form is published before
the platform half is live. The keys are additive, and builds that do not know
them ignore them. Share codes follow the same order: OrganizeOS accepts
`referral_code` before the builder sends it; a block that meets a platform
without it falls back to a submission without the code.

**Known limits** (OrganizeOS spec, section 12, items 15 to 18, with the
options, and the limits found since in review):

- **Rollout gate.** The OrganizeOS blocks and the rest of the OrganizeOS
  builder UI (§9, In the builder) are offered to every org not on
  `ORGANIZEOS_BLOCKS_DENY_ORG_IDS`. During the rollout the deny list holds the
  orgs not yet cleared; every other org, new ones included, is offered the
  blocks. A page with a Signup Form or an Events block
  loads its Resource (`GET /v1/forms`, `GET /v1/events?upcoming=true`, and
  `GET /v1/events` for an RSVP Form) on every view of that page (no longer of
  every page: the binding is the block's own), and a page with more than one
  makes each read. Vercel's CDN never caches those
  requests (they carry `Authorization`); the published site's resource cache
  (§8) does, one entry per URL. With `/v1`'s `Cache-Control`, each warm
  function instance fetches each at most once a minute, however many visitors
  arrive, and through a platform failure or a 429 keeps serving the last good
  answer for up to ten minutes (a refresh that hangs counts as a failure after
  4 seconds, while that answer can still be served), trying again only after
  `Retry-After` (at most a minute) or 10 seconds. The ceiling is still the
  platform's `public_read` limit, 120 a minute per org and site egress IP,
  shared by the site's instances behind that address; on a 429 with nothing
  stored (a cold instance) a block with a form picked shows Unavailable, and so
  do the Event List and Event Card and an RSVP Form, which cannot find its event
  without the list. A
  published build is frozen: a site published before the builder deploy that
  ships the cache keeps the old loader, one uncached call per page view, until
  it is republished. So an org leaves the deny list only after it has
  republished on that deploy and its `/v1` call rate has been observed. The
  deny list is a rollout gate, not an enforcement boundary: it decides who is
  offered the OrganizeOS blocks and the rest of the OrganizeOS builder UI (§9,
  In the builder), and nothing more. Pasting or duplicating a block (`insertWebstudioFragmentCopy`)
  is not gated; the canvas registers the namespace for every project; the CLI
  copies the package into every site it builds; and adding an org to the
  list changes none of that, leaving its blocks and published sites as they
  are.
- A block written on the builder's pre-deploy branches keeps the `:root` Forms
  binding those branches gave it, so its site loads Forms on every page.
  Deleting the block does not remove that binding (`deleteInstanceMutable`
  drops only the bindings scoped to the instances it deletes), and inserting
  a block again leaves it alone. The next provision or collections sync
  removes it once nothing references it (`removeUnusedPresetBindings`; the
  deleted block's `data` prop no longer does), or an admin deletes it in the
  data panel. Those branches were never deployed, so only dev and test
  projects written on them can carry such a block; no production site does,
  and this is not a production migration.
- Two builder tabs that click "Add to this page" for the same Resource at once
  both pass `isCatalogResourceOnPage` against their own state, but
  single-player sync refuses the second tab's save as a version mismatch and
  asks it to reload, so one binding is saved. Only with multiplayer on (off by
  default, and it needs `PUBLIC_COLLAB_RELAY_URL`) could both be saved as two
  page-root bindings (the designer deletes the extra one in the data panel;
  the catalog Resource stays). Not fixed.
- Copies rebind by name. Upstream re-resolves expressions by variable name when
  a block is duplicated, copied, pasted or moved, and when an admin saves a
  variable (`rebindTreeVariablesMutable`). A new block's own binding is scoped
  to its root, so it masks a variable of the same name in any enclosing scope,
  and a copy remaps it by id: an enclosing-scope variable named exactly
  "OrganizeOS Forms" can take over `data` only in a block written on the
  pre-deploy branches (above), whose binding is at `:root`. What can still
  capture a new block's bound props is a variable named exactly like the
  block's binding ("OrganizeOS Forms", "OrganizeOS Events", "OrganizeOS
  Upcoming Events") added on
  the block's root, or on any instance from a bound prop's own instance up to
  that root (for an Event List or Event Card as inserted, the `events`
  collection and the `empty` and `unavailable` boxes), which the next
  re-resolution (saving that variable is one) binds in place of the block's
  binding:
  `validateDataVariableName` compares only `variable`-type sources, so it
  allows the name beside the binding. A Signup Form or an RSVP Form has one such
  prop (`data`); an Event List or Event Card has three (the collection's `data` and the
  `data-ws-show` of the `empty` and `unavailable` boxes). Insert binds by id;
  the re-resolution is upstream behavior, left alone.
- A catalog Resource is shared: editing it through any binding in the data
  panel edits it for every use, and a provision rewrites Events, Fundraisers,
  Stats, Forms, Upcoming Events (where present) and each collection whole. A
  copy's own Resource (see Copies) is the exception, and a provision only
  rotates its token.
- **Events blocks.** The canvas shows no card when the org has no upcoming
  public events, so designing the cards needs one. The Event Card is the next
  event, not a chosen one. The list is unbounded (every upcoming public event; a
  `limit` parameter waits until a site needs it), and a designer caps it in the
  collection's `data` expression. A
  card's cover image is an absolute URL the platform sends: check that it loads
  under the platform's CSP on a published page.
- **RSVP Form.**
  - The published page reads the Events list when it renders, not when it was
    published, so an event that is unpublished, deleted or made private
    afterwards shows Unavailable on the live site once the cached list expires,
    and one that is over shows Ended. The list is cached for up to a minute
    (`s-maxage=60`), and while the platform fails or rate-limits the site the
    cache keeps answering with the stale list for up to ten minutes more
    (`stale-if-error=600`, §8). So for that long an event made private or
    unpublished still renders, though the endpoint refuses it (`not_found`),
    Shift Options can show a filled shift or role as open, and Guests can offer
    more rows than the event now takes, which the endpoint refuses as
    `invalid_field` `guests` (the Guests message says to bring fewer); the `full`
    and `role_full` answers keep the visitor on the form with a message.
  - The Events payload grows with the org's history: the list is unbounded and
    each item carries its shifts and questions (about 1 to 3 KB for an event
    with them), though the site's resource cache holds it. A `limit` or `since`
    parameter waits until a site needs it.
  - Inner controls of Guests, Shift Options and Questions are styled through
    `ws:descendant` instances. A descendant's selector is not one of the
    Settings panel's options (it offers ` p`, ` h1` and the like): the panel
    shows the selector the template gave it, and a designer styles the instance
    rather than retyping the selector.
  - A repeat RSVP takes measurably less time than a new one, since it skips the
    writes; equal timing waits. At the organization's contact cap the platform
    refuses every RSVP alike (503 `unavailable`, a holder's repeat included); in
    the last 11 places below the cap the refusal still follows the request's
    guest count, so a sender who varies it can tell a holder from a stranger and
    read the room left (plan P7 step 11; a threshold that ignores the request,
    `1 + MAX_GUESTS`, is recommended and waits for the owner).
    Since owner decision D8 (2026-10-21) Website Lite shows a visitor's repeat
    as it shows a new booking (the waitlist confirmation, the place in line, the
    picked shifts) and a signed-in member's repeat as the status they hold. The
    Website endpoint has no signed-in caller, so the member's status never
    reaches the RSVP Form: its answers stay equal for a holder and a stranger,
    but for the contact-cap window above.
    Website Lite keeps its own email consent until D3. Confirmations still go to
    suppressed addresses (D15), and an anonymous form can restore a deleted
    contact (D14), as Website Lite does.
  - The counts channel. A new booking raises the public counts (`rsvp_count` on
    `/v1/events`, and "N people are going" and the shift counts on the Website
    Lite page) and a holder's repeat does not, so a sender who books an address
    can tell from the counts whether it already held a place: read them, send,
    read them again. The RSVP Form's `registered` and `waitlisted` answers are
    equal for a holder and a stranger; the counts and the contact-cap window
    above are where they differ. The counts difference is inherent while the
    counts are public, accepted for the pilot, and to be revisited with rounded
    or delayed counts if the public counts stay.
  - The capacity race (D13) is not closed: a burst can overshoot a capacity,
    and a mailing that links to an RSVP Form makes bursts likelier. An atomic
    book-and-count function is fixed on the platform before the RSVP Form goes
    beyond the pilot.
- No self-serve "Reconnect data": once the builder is enabled, nothing re-seeds
  a project's catalog, so a refused insert needs support to re-provision.
- **Share codes** are carried on a click, after hydration, by every
  same-origin link to a platform page and by the forms: not by a
  middle-click, a long press or a copied link address, and not between the
  site's own pages. Without JavaScript, or before hydration, nothing is
  carried. A site published before the blocks carried the code sends none
  until it is republished, and one published before the page's carrier
  carries it from its blocks' links and forms only. A plain click on a
  same-origin link to a platform page is cancelled and sent by document in the
  capture phase, before the link's own handlers run: they still run, but
  cannot keep that click from navigating (§10, for when org script returns).

**Rich Text styling spike** (W7a, 2026-10-26; OrganizeOS spec
`docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md`, section 4.7).
The question: can a component in this package that renders its own tree of
`p`, `h2`, `ul`, `li`, `a` and `strong` as React elements, with no
`dangerouslySetInnerHTML`, be styled per tag through `ws:descendant` the way
upstream's Markdown Embed is, on the canvas and in a published build. Result:
it works, with no fork change outside the package. W7 uses `ws:descendant`, and
the class-per-tag fallback (`oos-rt-*` plus a style block of tokens) is not
needed.

- **How it was checked.** A throwaway `RichText` (a `forwardRef` root that
  drops `value` and `children` and spreads the rest and the ref onto a `div`), a
  meta with `contentModel.children: [descendantComponent]` and a `div` preset
  of `display: contents`, and a template holding five styled `ws:descendant`
  instances (` p`, ` h2`, ` li`, ` :where(strong, b)`, ` a`), all under the
  `@organizeos/site-components` namespace. It was exported from the package,
  built, and run through the CLI
  (`webstudio build --template react-router --template vercel`) in a copy of
  `fixtures/react-router-vercel` holding only that block; the site was then
  built with `react-router build` and rendered through the built server
  bundle. Unit checks covered `generateCss` (atomic and not), the component
  generator and the canvas's selector code; the canvas was checked through that
  code, not in a running builder. None of it was committed.
- **The CSS generator is generic.** `generateCss` (`packages/sdk/src/css.ts`,
  188 to 234) treats any `ws:descendant` by its `selector` prop and its
  parent's instance id, with no list of components, and the preset rule
  (lines 127 to 150) is written for whatever component's meta has one, when
  the instance's tag (the meta's first preset key here) is used. The built
  site's CSS held `div.w-rich-text{display:contents}` in the presets layer and
  one rule per descendant under a class on the root
  (`.cecbazs p{color:red}` and so on, atomic, as prebuild defaults,
  `prebuild.ts:473`), and the server-rendered page carried those classes on
  the root `div`, with the tree inside it.
- **The page code.** The component generator writes nothing for a
  `ws:descendant` (`packages/react-sdk/src/component-generator.ts:175`) and
  passes the classes as `className`, so the root must spread the rest onto a
  real element, as Markdown Embed does (`markdown-embed.tsx:14-26`), and must
  ignore `children`. The page imported the block from the site's copy
  (`../__organizeos__/components.js`), as for every block.
- **The canvas is generic too.** `computeDescendantSelectors`
  (`apps/builder/app/canvas/shared/styles.ts:328-364`) writes
  `[data-ws-id="<parent>"] <selector>` for any parent, and the preset selector
  is `div:where([data-ws-component="<component>"])` (line 414), both of which
  matched the throwaway's rendered elements once the canvas's props
  (`data-ws-id`, `data-ws-component`, `webstudio-component.tsx:616-635`)
  reached its root through the spread. The canvas renders nothing for a
  descendant (`webstudio-component.tsx:595` and 757), and the navigator and
  the settings panel special-case `ws:descendant` alone, never its parent's
  component (`navigator-tree.tsx:446`, `use-props-logic.ts:278`). The
  content-model check reads the meta's `children` list as it does for any
  component (`shared/content-model.ts`). The RSVP Form's Guests, Shift Options
  and Questions already ship this way (above), which the spike confirms.
- **Org script.** The prebuild check (`packages/cli/src/organizeos-org-script.ts`,
  `classify`, from line 118) reads an instance's `tag`, its `tag` and
  `data-ws-tag` props, its `dangerouslySetInnerHTML` prop and the embed
  components. A Rich Text instance and its descendants have none of these, and
  the build logged no paused-script line. The check does not see the tags the
  component renders inside itself, so the component's own re-validation of
  links and images (spec 4.7) is the only guard there.
- **Caveats for W7.** With `display: contents` the root draws no box, so
  styles a designer sets on the root itself (padding, a background) do not
  show; spacing goes on a wrapper or on the descendants, as with Markdown
  Embed. A descendant has no element on the canvas, so selecting one in the
  navigator outlines nothing, as with Markdown Embed's. A descendant's selector is appended to the
  root's class as it stands, so a comma list must sit inside `:where()` or
  `:is()` (as Markdown Embed's ` :where(strong, b)` does), or it would style
  matching elements across the page. With atomic styles off, the root's class
  takes its name from the first descendant's label (`w-paragraph`), a cosmetic
  quirk of upstream's naming.

## 10. Org script is paused

**Decision (owner, 2026-10-21).** Until org sites move to `{sub}.organizeos.io`
(org sites domain spec, steps C1 and C2), the builder must not let an org ship
its own script. Reason: decision 10 of the platform components design
(`docs/superpowers/specs/2026-10-01-website-builder-platform-components-design.md`,
section 12, item 6). Platform session cookies are scoped to `.organizeos.org`
and readable by script, and a published Website's HTML Embed runs its scripts.
The builder canvas, `p-{projectId}.builder.organizeos.org`, is same-origin with
the builder UI and holds the same session. Upstream's HTML Embed puts its code
into the canvas with `innerHTML` in every mode, which skips `<script>` but fires
inline handlers (`<img src=x onerror=…>`), and runs scripts in preview mode, so
an embed one admin writes could read the session of every co-admin who opens
the page. That exposure needs no publish. Spec (OrganizeOS repo):
`docs/superpowers/specs/2026-10-21-website-builder-org-script-off-design.md`.

**What is paused**, behind one switch:

- **HTML Embed**, and **Content Embed**, which is an HTML Embed whose `code` is
  usually a Resource's HTML.
- **Markdown Embed.** Its renderer keeps `javascript:` links
  (`allowDangerousProtocol`, in a runtime package that stays byte-identical).
- **The SVG `animate` and `set` elements.** Inside an `<a>`, SMIL sets its
  `href` to a `javascript:` URL, which no attribute check sees.
  `animateTransform` and `animateMotion` cannot set an arbitrary attribute and
  stay.
- **An element whose tag the builder does not offer** (`script`, `SCRIPT`, a
  tag that is JSX syntax). React hoists a `<script async src>` into the
  document's `<head>` and runs it, creates any other spelling of `script` as a
  live element, and the component generator writes a tag into the page module
  as code. The tag counts wherever it is held, not only on the component that
  makes an element from it: Radix's triggers pass their own props on to the
  child they render. See "Tags on the canvas" and item 3 of "Prebuild" below.
- **The `dangerouslySetInnerHTML` prop.** React writes its value (an object
  holding `__html`, from a JSON value or an expression) into any element as raw
  markup. The props panel accepts the name (only `style` is refused), and
  neither the component generator nor the canvas filters it, so without this an
  org could still put its own markup on a page, and on the canvas, with no
  HTML Embed.
- **Unsafe addresses.** An address whose scheme is not `http`, `https`,
  `mailto`, `tel` or `sms` in `href`, `xlink:href`, `src`, `action`,
  `formaction`, or `data` wherever it can reach an `object` (every holder but
  Collection, Signup Form, RSVP Form and a `ws:element` that is not an
  `object`), whatever the value's shape, on any element, a bound one whose
  fixed start does not decide its scheme, and a page or project redirect to
  one. The sites' React writes an address as it is, and a click, a frame, a
  form or a client-side redirect runs it in the site's origin. See "Unsafe
  values" below.
- **`srcdoc`.** Its markup runs in the page's origin.
- **Event handler attributes**: an `on…` prop that is not an action. React
  writes one on a custom element.
- **XML Node and XML Time on an HTML page**: a custom element that keeps every
  attribute.
- **Custom code** (Project settings > General).

**The switch** is `orgScriptMayRun()` in `@organizeos/site-components/org-script`
(`packages/sdk-components-organizeos/src/org-script.ts`), a code constant that
returns `false`, read by the builder and the CLI alike. It is not an env var: an
env var has two homes (the builder's Vercel env and the publish workflow's) that
could disagree, and a missing or mistyped value could fail open. The publish
workflow reads it too, from the built package, fails unless it is off, and
reports it to OrganizeOS (Reporting to OrganizeOS, below), so turning it on also
edits that step. Turning
it on is one reviewed change that also edits its test (`org-script.test.ts`),
and only when both hold:

- org sites are served from `{sub}.organizeos.io` and the old
  `{sub}.organizeos.org` hosts only redirect (step C2, `PUBLISHER_HOST=organizeos.io`);
- the platform session is host-only on `app.organizeos.org` (step D), with the
  old `.organizeos.org` cookies expired, the builder's included, so the canvas,
  which stays under `organizeos.org`, never receives it.

The platform unpauses Website Lite custom code at C2 as well, and the two should
move together. When it is on, everything follows it: the panel lists the embeds
again, the canvas renders upstream's components, Custom code is editable,
prebuild keeps all of it, and the Publish dialog's list goes away. Nothing needs
migrating: each org's next publish ships what it saved, including code someone
may have forgotten, so tell the orgs first. The unpause also decides how an
org's own click handlers meet the share-code carriers (§9, "Share codes"): the
page's carrier cancels a plain click on a same-origin link to a platform page
in the document's capture phase, and a block's carrier does the same within its
block, both before any handler on the link itself (a React `onClick`, an inline
`onclick`) runs, so once org script returns a designer's handler on such a link
cannot cancel that click: the carrier has already sent it by document. Then
this section moves to history.
The package builds the `org-script` entry with `vite.build.config.ts`, which
extends the root `vite.sdk-components.config.ts` (left as upstream's) with one
entry. It is not named `vite.config.ts` because Vitest picks up the nearest
`vite.config.ts`, which would replace the root `vitest.config.ts` and its
`webstudio` condition.

**Nothing is deleted.** The embeds and the custom code stay in the build and show
as paused, so reversal is the switch.

**Where it is enforced**: where code runs, not where it enters.

- **Components panel and command palette.** `withOrgScriptPolicy`
  (`apps/builder/app/canvas/organizeos-org-script.tsx`) wraps the one registration
  of upstream's base library in `canvas/canvas.tsx`. While the switch is off it
  gives the `HtmlEmbed` and `MarkdownEmbed` metas `category: "hidden"`, which the
  panel and the palette skip (the Navigator, their icons and labels are
  unchanged), leaves the Content Embed and Markdown Embed templates out, and
  registers the stand-ins below. Everything else passes through by reference.
- **Canvas.** `PausedHtmlEmbed` renders upstream's component only when the
  embed's `code` is a string identical to a template icon; otherwise it shows a
  notice where the embed is (its `ref` and `data-ws-*` props, `display: block`
  and padding, since the preset's `display: contents` would give it no box) and
  never puts `code` into the DOM: not in design, preview or safe mode, and not
  with "Run scripts on canvas". It tests `typeof code === "string"` because
  upstream's component coerces whatever it gets with `String(code)`, so an array
  from a Resource holding markup, even an icon, would become markup.
  `PausedMarkdownEmbed` always shows the notice. The settings panel is unchanged:
  an embed's code stays editable, and the notice says it is paused.
- **Raw HTML props on the canvas.** `useInstanceProps`
  (`canvas/features/webstudio-component/webstudio-component.tsx`) skips a prop
  whose name `propNameMayRun` refuses (`pausedPropNames` in `org-script.ts`:
  `dangerouslySetInnerHTML`), in design and in preview mode, on every
  component. `canvas/organizeos-org-script.props.test.tsx` renders an
  instance with the prop in both modes and fails if a merge takes it back.
- **Tags on the canvas.** The canvas does not run an org's script through an
  element it creates, in design or in preview mode. React DOM does not create a
  `script` element inert on the client: with `async` set to `true` and a `src`
  it hoists the element into `<head>` with `document.createElement`, and a
  script inserted that way runs; any spelling but the exact `script`
  (`SCRIPT`) is created as a live element too. `/canvas` sends no `script-src`
  policy. And inside a link, an SVG `animate` or `set` sets the link's `href` by
  SMIL, past every attribute check, so a `javascript:` URL could reach a click
  in preview. So the canvas applies the rules publishing applies
  (`elementTagMayRender` in `org-script.ts`: a string that is exactly one of
  `tags`, the Tag control's list, as `elementTagMayRun` holds, and is not
  `animate` or `set`, `pausedSvgTags`) to every tag that can reach an element,
  whichever component holds it:

  - a `ws:element` whose `instance.tag` fails it renders as a `div`;
  - `instance.tag` is not passed on as `data-ws-tag` unless it passes;
  - a `data-ws-tag` or `tag` prop whose evaluated value fails it (an expression
    is caught) is skipped, on **every component but `ws:element` and XML Node**
    (`checksTagProp`). Box, Text and Heading make their element from it, and so
    does Radix's Dialog Title, but they are not the only holders: Radix's
    triggers (Collapsible, Dialog, Popover and Tooltip triggers, Navigation
    Menu's link and trigger) render `<Primitive.Trigger asChild {...props}>`,
    and Radix's Slot merges those props onto the first child, so a `data-ws-tag`
    on a trigger reaches a Box, Text or Heading inside it. On a `ws:element`
    both names are plain attributes, and XML Node writes its tag with a suffix
    no HTML element has, so both are left alone;
  - and again after the parent's props are merged in
    (`withoutBlockedTagProps`, through `withoutPausedProps`, in both
    renderers): the props a trigger passes in arrive in the child's
    `restProps`, past `useInstanceProps`.

  The component that loses its tag renders its own default element. Four marked
  changes in `webstudio-component.tsx`; `organizeos-org-script.props.test.tsx`
  renders `ws:element`, Box, Text, Heading and Dialog Title with a `script`
  tag, `async` and `src`, and each of the six Radix triggers over a Box, Text
  and Heading carrying the tag prop, in both modes, asserts the whole document
  (head included) holds no script, and fails if a merge takes a change back.
  It renders an `animate` and a `set` the same ways (a `ws:element` in an SVG
  link, a Box, Text, Heading or Dialog Title given the tag, a trigger or a
  parent passing it in) and asserts that the canvas makes neither.
  A render shows that no script reached the canvas, not which check stopped it,
  and the two tag skips in `useInstanceProps` overlap the check on the props a
  parent passes in. So the test also renders a Box that is given the tag by a
  parent alone, which fails if that check goes, and
  `organizeos-org-script.wiring.test.ts` reads the source for the two skips
  and the two `div` fallbacks. `animateTransform` (a transform list only),
  `animateMotion` (a position on a path) and `mpath` cannot set an arbitrary
  attribute, and the canvas still makes them.

- **Unsafe values on the canvas.** `withoutPausedProps` (`org-script.ts`), at
  the seam the tag check already uses, in both renderers, on every prop the
  component receives, its own or passed in by a parent, given the instance: it
  drops what `withoutBlockedTagProps` drops, every `srcdoc`, every `on…` value
  that is not a function, and every address value that `urlValueMayRun`
  refuses, whatever its shape, with `data` decided by the instance's component
  and tag (Unsafe values, below). So an `iframe` with a `javascript:` `src` or
  a `srcdoc` no longer runs in the builder's origin, in design or preview mode.
  The canvas judges a bound address by the value it computes; publishing
  judges it by its fixed start, and the Publish dialog lists the difference.
  `organizeos-org-script.props.test.tsx` renders each case in both modes, and
  `organizeos-org-script.wiring.test.ts` pins the two calls.

- **Custom code field.** Read-only, with a sentence that says it is paused and
  kept (`section-general.tsx`, one marked branch). The saved code stays readable
  and copyable.
- **Publish dialog.** A banner after the plan-features banner, headed "Paused,
  not published", lists each HTML Embed that will be dropped, each Markdown
  Embed, each element publishing drops for a tag the builder does not offer
  ("Element with an unsupported tag on {page}"), each SVG `animate` or `set`
  element, each `dangerouslySetInnerHTML` prop, each unsafe value ("Link
  address (href)", "Form address (action)", "Source address (src)", "Object
  address (data)", "Frame document (srcdoc)", "Event handler attribute
  (onclick)", "XML element"), each page redirect to an unsafe address
  ("Redirect on {page}", which opens that page's settings), each project
  redirect to one ("Redirect from {old} (Project settings)", which opens
  Redirects) and "Custom code (Project settings)" (a click selects the element
  or opens the settings), from `findPausedScript`
  (`features/publish/organizeos-publish-paused-script.ts`). A bound address
  that the canvas shows with a safe value is still listed, and dropped at
  publish, when its fixed start decides nothing.
  The tag items follow `classify` in the CLI, because the canvas only skips a
  bad `tag` or `data-ws-tag` prop and the element looks fine there, while
  publishing drops the element and everything inside it. An instance that goes
  is listed once, for its tag, and not again for its raw HTML property.
  A Content Block's templates container is not published, so the empty HTML
  Embed that upstream's core template puts in it is not listed (an embed a
  content editor inserted into the block is). One line under the list says
  why and that nothing is lost: "Scripts could read visitors' OrganizeOS
  sign-in, so these stay off until that's fixed. Your work is kept."
  (`pausedScriptExplanation`). Information only: Publish still runs. Nothing
  is listed when the switch is on, or when the site holds only template icons.
- **Prebuild.** `dropOrgScript` (`packages/cli/src/organizeos-org-script.ts`) runs
  in one short marked hook in `prebuild.ts`, where the project bundle is read and
  before props are normalized, pages are walked, resources are collected and CSS
  is generated, so every later step sees a build without any of it, on every
  page and in every framework. It never changes its input, and drops:

  1. every instance whose component is `HtmlEmbed`, unless its `code` prop is a
     static string identical to a template icon. An embed whose `code` is an
     expression, a Resource or missing is dropped too (upstream's published
     `Placeholder` would print "Open the Settings panel to insert HTML code.");
  2. every `MarkdownEmbed`, whatever its code;
  3. every instance whose tag is set and is not in `tags` (`@webstudio-is/sdk`,
     the list the Tag control offers; the rule is `elementTagMayRun`, which the
     canvas shares), and every instance with a `data-ws-tag` or `tag` prop that
     is not a static string in `tags`, **whatever its component**, except a
     `ws:element` (where those props are plain attributes) and XML Node (which
     takes any tag name by design, and writes it with a suffix no HTML element
     has): `checksInstanceTag` and `checksTagProp` in `org-script.ts`. `ws:element`
     writes `<${instance.tag}>` into the page module. `Box`, `Text` and `Heading`
     read a `data-ws-tag` prop first and then a legacy `tag` prop, and Radix's
     `DialogTitle` renders `<Tag>` from its `tag` prop with no check at run
     time. The generator writes `instance.tag` as a `data-ws-tag` prop on every
     component but `ws:element`, and a user prop of either name like any
     attribute, so the props panel can set them. And Radix's triggers
     (`CollapsibleTrigger`, `DialogTrigger`, `PopoverTrigger`,
     `TooltipTrigger`, `NavigationMenuLink`, `NavigationMenuTrigger`) pass their
     own props on to the child they render (`asChild` with a spread, merged by
     Radix's Slot in the published page too), so a `data-ws-tag` on a trigger
     makes the element of a Box, Text or Heading inside it. Nothing can list
     the next component that does that, so the rule holds for all of them. The
     match is exact and case-sensitive. These components render their tag as an
     element, so a tag of `script` ships a `<script>` with its `src` or code, and
     a tag that is JSX syntax (`div />{globalThis.pwned = 1}<div`) is written
     into the page module as code. An element dropped for its tag goes with
     everything inside it, so a trigger goes with its child. Only crafted content
     or the props panel reaches this: the Tag control and HTML paste offer `tags`
     only, but the sync server checks shape only, a pasted Webstudio fragment is
     checked against the same schema, and Webflow paste copies Webflow's own tag
     name into the legacy `Heading`, `Text` and `Box`. Queries 3 and 5 below show
     what is in use;
  4. every such element whose tag is exactly `animate` or `set`, whether it
     comes from `tag`, `data-ws-tag` or a `tag` prop, on any component the rule
     above covers;
  5. every `dangerouslySetInnerHTML` prop (`pausedPropNames`), of any type, on
     any instance. The instance stays, without the prop. Counted in the log
     line, except for the props of an instance that is dropped anyway;
  6. the site's custom code (`build.pages.meta.code`). `CustomCode` is still
     exported from the home page module, as an empty fragment, so `root.tsx`
     is unchanged;
  7. every prop `propMayShip` refuses (Unsafe values, below): an unsafe
     address, a `srcdoc` and an `on…` prop that is not an action. The instance
     stays, without the prop;
  8. an XML Node or XML Time that an HTML or text page publishes, with
     everything inside it (one a Slot also shows on an XML page goes from
     both);
  9. a page redirect to an unsafe target, with the page's literal 3xx status,
     and a project redirect to one, the others kept in order. The bundle's
     pages are read once, in either pages shape, for the page roots, the walk
     of what HTML and text pages publish and the redirects.

  A dropped instance takes its `ws:descendant` children (and any children a
  crafted build gave it), its props and the data sources scoped to it with it, so
  a Resource that only it used is neither loaded by the page's loader nor written
  into its `.server.tsx`. An instance inside a Slot's shared Fragment is dropped
  once and so leaves every page that uses the Slot; what an instance that stays
  still holds stays. A page root that would be dropped (only a crafted build has
  one) is emptied into a `Body` so the page builds. Styles are left as they are,
  because `generateCss` skips a selection whose instance is gone. A dropped embed
  leaves nothing behind: HTML Embed's preset is `display: contents`, so an
  unstyled one has no box of its own. The hook logs one line in the publish
  workflow's output, for support (what it left out, counted, the unsafe
  addresses, `srcdoc` and event handler attributes of the instances that stay,
  the XML elements on HTML pages and the redirects included). It counts what
  ships, as the Publish dialog lists it: whatever sits only inside a Content
  Block's templates container (the generator writes nothing for it, and the core
  template puts an empty HTML Embed there) is left out of the build and not
  counted, so a site with nothing else logs no line. The runtime
  packages and the route templates are untouched by the hook, so `pnpm check:runtime-upstream`
  stays green and no fixture copy changes; XML pages answer sandboxed by a
  separate marked header in `xml.tsx` (§8).

**The icon exception.** An HTML Embed whose `code` is a static string
byte-identical to one of the 7 SVG icons that upstream's own templates insert is
kept: `CheckMarkIcon`, `ChevronDownIcon`, `DotIcon`, `LargeXIcon`, `MenuIcon`,
`PlayIcon` and `SpinnerIcon` (`templateIconCodes` in `org-script.ts`; the
Accordion, Checkbox, Dialog, Navigation Menu, Popover, Radio Group, Select,
Sheet, YouTube and Vimeo templates insert them). That markup is upstream's and
holds no script, and without the exception the Sheet's menu button becomes an
empty trigger, the Dialog's and Popover's close buttons, the Checkbox and Radio
marks, the Select indicator and the chevrons go blank, and the YouTube and Vimeo
play and spinner icons disappear. The list holds literal copies, not imports: a
project keeps the string it was inserted with, so when upstream redraws an icon,
add the new string and never remove the old one. The test that renders every
template the canvas registers (`organizeos-org-script.test.tsx`) fails on an
upstream merge that adds or redraws one; another keeps the list free of script,
handlers, links, `use`, `foreignObject` and animation. A designer who edits an
icon's SVG loses it, and the canvas shows that at once.

**The OrganizeOS blocks are left alone.** Their templates (§9) hold native
elements, upstream's Image and Time, the package's own components, a collection
and `ws:descendant` style rules: no embed, no `tag` or `data-ws-tag` prop and no raw HTML property, so
the pause drops none of them. `features/publish/organizeos-publish-paused-script.blocks.test.tsx`
inserts every block the Components panel's OrganizeOS section lists into one
page, through `insertOrganizeosBlock`, the section's own insert, with its
bindings, and fails if `findPausedScript` lists anything there, or if
`dropOrgScript` changes the bundle or logs a line. It reads the CLI's module by
path, as the OrganizeOS section's tests read the package's fixtures, so one
fixture feeds both, and a block added to the section is covered without
editing the test. The section lists the namespace's templates only, so the
embeds, hidden by category (above), never appear in it.

**Paths left alone, on purpose.** None of the upstream insert, paste and
duplicate paths is gated: the Radix, YouTube and Vimeo templates (which insert
the icons), Content Block's empty templates container, HTML paste (a `<script>`
becomes an embed labelled "Script", leftover `<style>` one labelled "Style"),
Webflow paste, copy and paste, duplicate, project bundle import, a crafted build
patch and the command palette's Convert command. Each yields an embed that the
canvas shows as paused, or an element whose tag the canvas does not create (a
`div`, or the component's own default), and that publishing drops, so gating
insertion (about six upstream paths, and still not a crafted patch) buys
nothing, and keeping them makes reversal free. A designer who pasted HTML loses
its leftover CSS embed at publish and moves the rules into styles.

**Unsafe values.** While the switch is off, an address may have the scheme
`http`, `https`, `mailto`, `tel` or `sms`, or none (a relative path, `//host`,
`?query`, `#fragment`, the empty string); `sms` cannot run script, and campaign
sites use it. Every other scheme is refused, `javascript:`, `data:`,
`vbscript:`, `blob:`, `file:` and `about:` among them (`urlMayRun` in
`org-script.ts`). An address is read as the URL parser reads it: leading and
trailing C0 controls and spaces trimmed, then every tab, line feed and carriage
return removed, so a `javascript:` split by a newline is still one, while a
scheme broken by another character (`java script:`) is a relative path. A value
is judged as React writes it, `String(value)`, whatever its shape: an array
joins, so a JSON `["javascript:…"]` is `javascript:…` (`urlValueMayRun`).
Publishing cannot know what a variable, a Resource or a parameter holds when the
page renders, so a bound address ships only when the start of its value is fixed
in the expression and decides the scheme: `"/events/" + x`, `"mailto:" + x`, a
template literal that starts `https://` (`urlExpressionMayRun`, which reads the
expression with acorn, refuses anything that is not exactly one expression, and
holds both branches of a conditional or logical expression to the rule). The
canvas judges the value it computes instead, and the Publish dialog lists a
bound address that publishing drops. Some bindings cannot run script, and are
exempt: a bound `src` on Image and on a `ws:element` `img`, `video`, `audio`,
`source`, `track` or `input` loads an image or media, never a document, and a
bound `href` on Head Link is a `<link>` in the head. A prop whose type cannot
hold an address (a page, an asset, a Resource, an action, a number or a boolean)
ships, and an animation's settings (`animationAction`, an object) are judged by
their value, so the OrganizeOS Animate Children keeps its `action`. `data` is an
address only on an `object`, so it is decided by its holder, never by the
value's shape: Collection, Signup Form and RSVP Form hold records in it, and on
a `ws:element` that is not an `object` it is a plain attribute, so they keep it
whatever it holds, and every other holder is held to the rule
(`recordDataHolder`). `srcdoc` never ships, in any spelling: its markup runs in
the page's origin. An `on…` prop ships only as an action, because React writes a
string one on a custom element. XML Node and XML Time are left out of every HTML
and text page, where each is a custom element that keeps every attribute, and
keep every prop on an XML page, which answers sandboxed (§8). A page's redirect,
an expression evaluated per request, is held to the rule for a bound address,
and a project redirect's target to the rule for a static one: on a client-side
navigation the site follows a redirect to another origin with `window.location`,
and a `javascript:` URL's origin is never the page's. `propMayShip`,
`pageRedirectMayShip`, `projectRedirectMayShip` and `withoutPausedProps` hold
the rule, and every part of it follows the switch. It guards against script, not
against where an address leads: a relative or protocol-relative address such as
`//evil.example` can be an open redirect, never script in the site's origin.

**Reporting to OrganizeOS.** OrganizeOS launches a Website only from a build
that carries no org script, so the publish reports what the run's CLI says,
never configuration. The step "Read the org script switch" (`publish-site.yml`,
after "Build site" and before "Deploy to Vercel", so nothing deploys first)
loads `@organizeos/site-components/org-script` from `packages/cli`, as the CLI
does (`lib/org-script.js`, built at the same commit by "Install and build CLI"),
checks that the module has the address rule (`urlMayRun` refuses a `javascript:`
address with the switch held off), and reads `orgScriptMayRun()`. The run fails
unless the rule is there and the switch reads `false`, which is then the step's
output (`steps.org-script.outputs.value`). The publish callback's body carries
it as `orgScript`, a JSON boolean from that output alone, checked again before
the body is sent, beside `organizationId`, `buildId` and `deploymentUrl`, under
the same shared secret. The callback refuses a body with a key it does not know,
so OrganizeOS accepted the field first (OrganizeOS #2075). OrganizeOS stores it
with the deployment pointer, `true` when it is missing (unknown means unsafe),
and launches a Website only from a build whose report is `false`.
`organizeos-publish-workflow.test.ts` reads the step and the callback body
(`orgScript` from the step's output and nothing else, and the body as JSON the
callback accepts) and runs the step's command against the built package; CI
builds the blocks package, with the workspace packages it imports, before the
tests.

**Existing projects.** Dev builds (`"Build".deployment` null, the build the
builder edits) keep their embeds and code, and the canvas shows them paused from
the deploy onward. Published deployments are frozen: a deployment built before
this change keeps its embeds and custom code until the org publishes again, so if
one is live it has to be republished. The owner can do that without the org: run
"Publish site" (`publish-site.yml`, `workflow_dispatch`) with `build_id` set to
the org's `webstudio_published_build_id` and its `organization_id`. The CLI syncs
the same build, drops both, deploys and repoints. The callback accepts a repeat
build id and checks only that the build belongs to the org's project.

- **Check for a publish in flight first.** The workflow's `concurrency` group is
  `publish-<organization_id>` with `cancel-in-progress: true`, so a dispatch
  cancels that org's running or queued publish. A cancelled run reports nothing
  (the "Report the build as failed" step runs on `failure()` only), so the org's
  newer build reads "pending" until the Publish dialog gives up after 25
  minutes, and the live pointer ends on the republished older build. In the
  Actions tab, look for a running or queued "Publish site" run for that org
  (open the run to see its `organization_id` input). If one is there, wait for
  it to finish and dispatch after it.
- **Run query 1 again afterwards.** A production build newer than the published
  one (`is_published_build` false, `created_at` later) with no run in progress is
  a publish that was cancelled or never finished. Dispatch the workflow for that
  build id too, or ask the org to publish again, or the pointer stays on the
  older build.
- The reverse is harmless: if the org publishes while the owner's run is in
  flight, the org's run cancels the owner's, and the org's build is the one that
  goes out, with all of it dropped.

An Event Card inserted before the card linked to `/events/{slug}` links to the
event's `url`, which publishing now leaves out (the dialog lists it): insert the
card again.

These are read-only queries for the Supabase SQL editor of OrganizeOS
production. The builder's tables live in that database, reachable by
`service_role` only (`docs/features/website-builder.md` in the OrganizeOS repo).
Org projects are those whose owner has `"User".provider = 'organizeos-service'`
(§5). Query 1 tells which orgs to republish: rows where `is_published_build` is
true and something would be dropped. Query 2 tells which embeds the admins will
see paused. Query 3 shows whether any instance has a tag outside the Tag control's
list (it also shows `animate` and `set`) before the change deploys. Query 4
counts Markdown Embeds. Query 5 shows the props that choose an element, on every
component the tag rule covers (so what a Radix trigger passes to its child
shows too), and the ones that write raw markup into one. Run 3 and 5 before the
change that widened the tag rule to every component deploys: an instance they
list with a value outside `tags` is dropped at publish, and the only components
that legitimately hold one are XML Node (exempt) and Webflow's own tag names on
Box, Text and Heading. Query 6 lists the address, `srcdoc` and `on…` props that
publishing may leave out for their value, and query 7 the page and project
redirects it may leave out (both approximate: the CLI's rule is the authority).
Run them before the unsafe values rule deploys: what they list is what the next
publish leaves out.

```sql
-- 1. Per org project: the dev build, the latest production build, and the build
--    the org's site points at, with HTML Embed and Markdown Embed counts and the
--    custom code length.
with org_builds as (
  select p.id as project_id, p.domain as subdomain, b.id as build_id,
         b.deployment is not null as production, b."createdAt" as created_at,
         row_number() over (partition by p.id, b.deployment is not null
                            order by b."createdAt" desc) as recency,
         b.instances::jsonb as instances, b.pages::jsonb as pages
  from "Project" p
  join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
  join "Build" b on b."projectId" = p.id
  where p."isDeleted" = false
)
select ob.subdomain, ob.project_id, ob.production, ob.build_id, ob.created_at,
       ows.site_engine,
       ows.webstudio_published_build_id = ob.build_id as is_published_build,
       (select count(*) from jsonb_array_elements(ob.instances) i
         where i->>'component' = 'HtmlEmbed') as html_embeds,
       (select count(*) from jsonb_array_elements(ob.instances) i
         where i->>'component' = 'MarkdownEmbed') as markdown_embeds,
       length(coalesce(ob.pages #>> '{meta,code}', '')) as custom_code_chars
from org_builds ob
left join public.organization_website_sites ows
  on ows.ws_project_id::text = ob.project_id
where ob.recency = 1 or ob.build_id = ows.webstudio_published_build_id
order by ob.subdomain, ob.production;

-- 2. Each HTML Embed in the dev builds, with the start of its code. Template
--    icons start with <svg xmlns="http://www.w3.org/2000/svg" and are kept.
select p.domain as subdomain, i->>'id' as instance_id, i->>'label' as label,
       pr->>'type' as code_type, left(pr->>'value', 100) as code_start
from "Project" p
join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
join "Build" b on b."projectId" = p.id and b.deployment is null
cross join lateral jsonb_array_elements(b.instances::jsonb) i
left join lateral jsonb_array_elements(b.props::jsonb) pr
  on pr->>'instanceId' = i->>'id' and pr->>'name' = 'code'
where p."isDeleted" = false and i->>'component' = 'HtmlEmbed'
order by subdomain;

-- 3. Every tag in use in the dev builds, apart from XML Node's (which takes any
--    name). The Tag control's list is the HTML and SVG element names in
--    packages/sdk/src/__generated__/tags.ts; any other value (script, or
--    anything odd) is dropped at publish, and so are animate and set.
select i->>'component' as component, i->>'tag' as tag, count(*) as instances,
       count(distinct p.id) as projects
from "Project" p
join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
join "Build" b on b."projectId" = p.id and b.deployment is null
cross join lateral jsonb_array_elements(b.instances::jsonb) i
where p."isDeleted" = false and i->>'tag' is not null
  and i->>'component' <> 'XmlNode'
group by 1, 2
order by 3 desc;

-- 4. Markdown Embeds in the dev builds.
select p.domain as subdomain, count(*) as markdown_embeds
from "Project" p
join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
join "Build" b on b."projectId" = p.id and b.deployment is null
cross join lateral jsonb_array_elements(b.instances::jsonb) i
where p."isDeleted" = false and i->>'component' = 'MarkdownEmbed'
group by 1
order by 2 desc;

-- 5. `data-ws-tag` and `tag` props, which choose an element (Box, Text,
--    Heading and Radix's DialogTitle read them, and a Radix trigger passes them
--    on to its child), and `dangerouslySetInnerHTML` props, which write raw
--    markup into one, in the dev builds. Not on a ws:element (an attribute
--    there) or an XML Node (it takes any tag name). A value outside the Tag
--    control's list, an animate or set value, and every dangerouslySetInnerHTML
--    prop is dropped at publish.
select p.domain as subdomain, pr->>'name' as prop, pr->>'type' as prop_type,
       i->>'component' as component, left(pr->>'value', 60) as value_start,
       count(*) as props
from "Project" p
join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
join "Build" b on b."projectId" = p.id and b.deployment is null
cross join lateral jsonb_array_elements(b.props::jsonb) pr
join lateral jsonb_array_elements(b.instances::jsonb) i
  on i->>'id' = pr->>'instanceId'
where p."isDeleted" = false
  and (pr->>'name' = 'dangerouslySetInnerHTML'
       or (pr->>'name' in ('data-ws-tag', 'tag')
           and i->>'component' not in ('ws:element', 'XmlNode')))
group by 1, 2, 3, 4, 5
order by props desc;

-- 6. Address, srcdoc and on… props in the dev builds that publishing may leave
--    out: a static value with a scheme other than http, https, mailto, tel or sms,
--    every srcdoc, every on… prop that is not an action, every json or string[]
--    address (read value_start: it ships when its text is safe) and every bound
--    address (it ships when its fixed start decides the scheme, or on an
--    exempt component). Approximate (a tab or newline inside
--    a scheme is not read); the CLI's rule is the authority.
select p.domain as subdomain, i->>'component' as component, i->>'tag' as tag,
       pr->>'name' as prop, pr->>'type' as prop_type,
       left(pr->>'value', 80) as value_start, count(*) as props
from "Project" p
join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
join "Build" b on b."projectId" = p.id and b.deployment is null
cross join lateral jsonb_array_elements(b.props::jsonb) pr
join lateral jsonb_array_elements(b.instances::jsonb) i
  on i->>'id' = pr->>'instanceId'
where p."isDeleted" = false
  and i->>'component' not in ('XmlNode', 'XmlTime')
  -- data on a holder of records, or on a ws:element that is not an object, ships
  and not (lower(pr->>'name') = 'data'
           and (i->>'component' in ('ws:collection',
                                    '@organizeos/site-components:SignupForm',
                                    '@organizeos/site-components:RsvpForm')
                or (i->>'component' = 'ws:element' and i->>'tag' is distinct from 'object')))
  and (lower(pr->>'name') = 'srcdoc'
       or (pr->>'name' ~* '^on.' and pr->>'type' <> 'action')
       or (lower(pr->>'name') in ('href', 'xlink:href', 'xlinkhref', 'src',
                                  'action', 'formaction', 'data')
           and (pr->>'type' in ('expression', 'parameter', 'json', 'string[]')
                or (pr->>'type' = 'string'
                    and pr->>'value' ~* '^[[:space:][:cntrl:]]*[a-z][a-z0-9+.-]*:'
                    and pr->>'value' !~* '^[[:space:][:cntrl:]]*(https?|mailto|tel|sms):'))))
group by 1, 2, 3, 4, 5, 6
order by props desc;

-- 7. Page redirects (every one: a bound target ships only with a fixed start)
--    and project redirects whose target has a scheme other than http, https,
--    mailto, tel or sms, in the dev builds, both page shapes.
select p.domain as subdomain, 'page' as kind, pg->>'path' as source,
       pg #>> '{meta,redirect}' as target
from "Project" p
join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
join "Build" b on b."projectId" = p.id and b.deployment is null
cross join lateral jsonb_array_elements(
  coalesce(b.pages::jsonb -> 'pages', '[]'::jsonb)
  || coalesce(jsonb_build_array(b.pages::jsonb -> 'homePage'), '[]'::jsonb)) pg
where p."isDeleted" = false and pg #>> '{meta,redirect}' is not null
union all
select p.domain, 'project', r->>'old', r->>'new'
from "Project" p
join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
join "Build" b on b."projectId" = p.id and b.deployment is null
cross join lateral jsonb_array_elements(
  coalesce(b.pages::jsonb -> 'redirects', '[]'::jsonb)) r
where p."isDeleted" = false
  and r->>'new' ~* '^[[:space:][:cntrl:]]*[a-z][a-z0-9+.-]*:'
  and r->>'new' !~* '^[[:space:][:cntrl:]]*(https?|mailto|tel|sms):'
order by 1, 2;
```

**Not covered by this pause.** Other ways an org's script can reach a page run
on the same hosts as HTML Embed (`{sub}.organizeos.org` once published, and the
builder canvas now). A follow-up design closes them before any Website goes live
on `{sub}.organizeos.org`, which the owner has allowed before C2: expressions
compile to code unchecked (`transpileExpression` and `generateExpression` only
parse and rename identifiers, `lintExpression` runs in the builder UI only, and
the sync server checks shape only); and uploaded HTML, SVG and XML assets
served from `/assets/` on the org host, which the OrganizeOS site proxy is to
answer sandboxed (the platform's one builder design, section 8.5). The others
are closed: `javascript:` URLs and `srcdoc`, which publishing leaves out and the
canvas drops in design and preview mode (Unsafe values, above), and an SVG
`animate` or `set` that sets a link's `href` to one, which neither publishing
nor the canvas makes (Tags on the canvas, above); XML pages, which
answer sandboxed (§8); and XML Node in an HTML page, which publishing leaves
out. The lasting half of the tag rule above (refuse a tag
outside `tags`, whatever the switch says) goes with the expression design.

**Keeping it on upstream merges.** Five upstream files carry a change, and each
has a test that fails if a merge takes it back: `canvas/canvas.tsx` registers
the base library through `withOrgScriptPolicy`
(`organizeos-org-script.wiring.test.ts`); `webstudio-component.tsx` skips a
paused prop and a tag the builder does not offer, `animate` and `set` among
them on the canvas, checks every prop a component
receives, its own and the ones a parent passes in, and falls back to a `div` for
a `ws:element` with such a tag
(`organizeos-org-script.props.test.tsx`, and `organizeos-org-script.wiring.test.ts`
for the two tag skips in `useInstanceProps`, the two `div` fallbacks, which
read `elementTagMayRender`, and the two renderer calls, which are
`withoutPausedProps`);
`section-general.tsx` holds the read-only branch (`section-general.test.tsx`);
the `prebuild.ts` hook runs `dropOrgScript` (`prebuild.test.ts`, "leaves an
org's own script out" and "leaves unsafe values out"); and `xml.tsx` answers an
XML page sandboxed (`prebuild.test.ts`, "an XML page answers with a sandbox
policy and nosniff", §8). A merge that adds or redraws a template icon fails the
template test (add the new string to `templateIconCodes`, keep the old one), and
one that adds another component using `dangerouslySetInnerHTML` to the runtime
packages fails a tripwire in `packages/cli/src/organizeos-org-script.test.ts`,
which reads its package list from `scripts/check-runtime-upstream.sh`: decide
whether the new component joins the pause. The same file reads the runtime
packages' generated props, one exported props object at a time (`dialog.props.ts`
holds seven, so a `tag` prop on its Description would not change the list of
files), and fails when a component other than Box, Text, Heading, Radix's
DialogTitle and XML Node gains a `tag` prop: the tag rule already covers it,
because it holds `data-ws-tag` and `tag` on every component but `ws:element`
and XML Node, so decide whether it instead takes any value by design, as XML
Node does for an XML element name, and if so add it to `anyTagComponents` (or
publishing drops it). It also parses the runtime packages' sources and fails
when a component other than the six Radix triggers renders a primitive with
`asChild` and a spread of its props, or when any file clones its children or
uses `@radix-ui/react-slot` directly: that is a component that passes its
props on to a child, which is how a tag prop reaches a Box. The new one needs
no entry for the rule to cover it, but it joins `triggerNames` in that test and
`forwarders` in `organizeos-org-script.props.test.tsx`, so both modes of the
canvas and publishing are shown to hold for it. XML Node takes any tag by
design; it is category xml, and publishing leaves it out of an HTML page.
Four tripwires in `packages/cli/src/organizeos-org-script.unsafe-values.test.ts`
read the metas the CLI registers and fail on a change that needs a decision
under Unsafe values: a new component of category xml joins `xmlComponents`; a
new component with a `data` prop holds records, and joins
`recordDataComponents`, or publishing holds its `data` to the rule; a new meta
prop named `on…` that is not an action gets a decision, since publishing drops
it; and a new attribute rename that is an address, `srcdoc` or `on…` name joins
the rule, which must read both names alike.

**Fixtures.** `pnpm checks` ends with `pnpm fixtures`, which syncs
`fixtures/webstudio-features` from upstream's development builder and rebuilds
it with this fork's CLI. That project holds 5 HTML Embeds (and custom code) in
its `.webstudio/data.json`, so every `pnpm checks` now leaves a diff in the
committed `app/__generated__` (the `[expressions]`, `[radix]` and `[resources]`
pages, which hold the embeds, and `_index.tsx`, which holds `CustomCode`). Do
not commit it, because the fixtures stay upstream's: run `git checkout --
fixtures` after `pnpm checks`, and when finishing an upstream merge stage by
path, never with `git add -A`.
