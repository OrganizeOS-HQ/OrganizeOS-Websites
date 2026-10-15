# OrganizeOS fork of Webstudio

This is OrganizeOS's fork of [Webstudio](https://github.com/webstudio-is/webstudio), used as the **element-based, Webflow-class site builder** behind OrganizeOS "Websites 2.0". It runs as a separate service, branded as OrganizeOS, against the OrganizeOS Supabase, and member organizations build data-bound public sites with it.

This document is the fork's source of truth for: the **AGPL §13 license posture**, what we changed vs. upstream, and how data-binding + deploy config are wired. Keep OrganizeOS-specific changes minimal and isolated so upstream merges stay tractable.

## 1. License posture (AGPL-3.0 §13) — POSTURE A

Webstudio core is **AGPL-3.0-or-later**. Serving a _modified_ builder to org admins over the network triggers **§13**: those users must be offered the source of our modifications.

**Our posture (A): accept the copyleft and keep this fork public.**

- This fork repository is **public**. It must be public **before any non-employee org admin uses the builder**.
- The builder UI carries a persistent **source-offer link** in its chrome, pointing at the deployed commit of this public fork (added with the branding changes).
- We do **not** treat the builder as "internal only" — that is a false safe-harbor; §13 attaches the moment an external admin uses the modified builder.
- Generated **sites** do not trigger any builder-source obligation. The published-site runtime packages (`@webstudio-is/react-sdk`, `sdk`, `sdk-components-react`, `sdk-components-react-radix`, `sdk-components-react-router`, `sdk-components-react-remix`, `image`, `wsauth`: every package the CLI templates install) are kept **byte-identical to upstream** so §13 only ever covers their already-public source. OrganizeOS-specific generation logic lives in the CLI templates / route templates, whose Corresponding Source every published HTML page offers twice. In its head: `<link rel="license" href="https://www.gnu.org/licenses/agpl-3.0.html">` and `<link rel="code-repository" href="https://github.com/OrganizeOS-HQ/websites-builder/tree/<sha>">`. And, by the owner decision of 2026-10-15 (§13 asks that the offer be prominent, and a head link is invisible to a visitor), in a small visible link at the end of its `<body>`: `<div data-organizeos-source-offer><a href="<the same URL>" rel="code-repository">Source</a></div>`, whose title and accessible name are "Source code of this site (AGPL-3.0)": it leads to the fork code this site runs (these route templates, the resource cache and the OrganizeOS blocks), at the commit that built it. These come from marked changes in `packages/cli/templates/react-router/app/route-templates/html.tsx`. The anchor carries `rel="code-repository"` alone: its target is a source tree, not a license document, so a `license` relation on it would be a second, conflicting license target beside the head's `license` link to the AGPL text. Prebuild replaces its `__ORGANIZEOS_SOURCE_URL__` placeholder with `getOrganizeosSourceUrl()` (`packages/cli/src/organizeos-components.ts`). That is the fork at `GITHUB_SHA` when `GITHUB_REPOSITORY` is `OrganizeOS-HQ/websites-builder` and `GITHUB_SHA` is a full commit hash, as in the publish workflow, which builds the CLI from the commit it checked out. Otherwise, as in a local build, it is the repository root. The head links leave the page the org designed unchanged. The visible link adds one small line after it, in the normal flow and with inline styles only (a centered 12px block at 0.7 opacity, `color: inherit`, never positioned over the design), so it has no class the org's CSS can target and leaks nothing into it; it does inherit the body's text color and font. It is the last of the `<body>`'s content (only the scripts the Body renders after its children follow it, and they take no space), so the body's own layout decides where it lands. In a block-flow body it is a line below the content, and in a grid body `grid-column: 1 / -1` gives it a whole row. In a body laid out as a row flex container (`display: flex` with the default `flex-direction: row`, wrapping or not) it sits beside the content, or with wrap on a line of its own at the start rather than centered, and in a body that clips its overflow (`height: 100vh; overflow: hidden`) it can be clipped out of sight. A body whose text color does not contrast with what lies behind the end of the page (light text set on the body for dark sections while the body itself has no background, or `color: transparent`) makes it unreadable. It is on html pages only, not on the xml and text routes. The `<body>` is the generated page's own `Body` (`@webstudio-is/sdk-components-react-router`, byte-identical to upstream), which renders the scripts after its children, so `html.tsx` cannot render inside it from outside: it calls the generated `Page` and appends the link to the children of the element it returns (`PageWithSourceOffer`). Generated sites also carry the fork's own OrganizeOS blocks, `@organizeos/site-components` (§9): the CLI copies that package's build into each site as app source, never as an installed package, so the same source offer covers it (OrganizeOS spec section 4.1). The blocks' copy in `app/__organizeos__/` ships with the package's `LICENSE`, the AGPL-3.0 text and identical to the fork's top-level `LICENSE`; prebuild fails without it. A site published before the head links and the `LICENSE` has neither until it is republished, and a site published before the visible link keeps the head links alone, its old offer, until it is republished. That package and the templates are where OrganizeOS site code goes; the runtime packages above stay byte-identical whatever a site carries.
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
- `POSTGREST_URL` / `POSTGREST_API_KEY` — OrganizeOS Supabase PostgREST (the builder's data layer).
- `AUTH_SECRET` — builder session secret.
- `PLANS` — the JSON above (enables data-binding + the admin-lockout fix).
- Asset storage — `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`. **Required on Vercel**; see "Asset storage" below.
- `NODE_OPTIONS=--conditions=webstudio` — resolves workspace packages to their AGPL source.
- Node 22 (repo `engines`; Node 24 works with a benign warning). pnpm 9.14.4 (via `corepack pnpm`).

OrganizeOS integration (all optional; each feature ships dark until its variable is set):

- `ORGANIZEOS_PROVISION_TOKEN` — shared secret for `POST /internal/provision` and `POST /internal/collections-sync` (server-to-server).
- `ORGANIZEOS_SSO_PUBLIC_KEY` — ES256 public key (PEM) that verifies OrganizeOS SSO tokens; registers the `organizeos` dashboard strategy.
- `ORGANIZEOS_PUBLISH_REPO` + `ORGANIZEOS_PUBLISH_GITHUB_TOKEN` — Publish dispatches `publish-site.yml` in that repo instead of Webstudio's cloud publisher.
- `ORGANIZEOS_APP_URL` — the OrganizeOS app the builder hands users back to (login page, the builder menu's "Back to OrganizeOS", the org's Website area). Defaults to `https://app.organizeos.org`.
- `ORGANIZEOS_BLOCKS_ORG_IDS` — the rollout allowlist for the OrganizeOS panel and blocks (§9): comma-separated organization ids. Unset or empty offers them to no org. Read by the builder loader, which resolves the project's org from its owner's service email (`org+<organizationId>@svc.organizeos.internal`) and hands the result to the builder as `organizeosSite.blocksEnabled`.
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
3. **Build.** The builder loader recognises an org project by its owner (`User.provider = organizeos-service`) and passes an `organizeosSite` (`siteUrl`, `manageUrl`, `platformUrl`, and `blocksEnabled` from `ORGANIZEOS_BLOCKS_ORG_IDS`) to the client. For such a project the chrome is OrganizeOS-shaped: the menu's first item is "Back to OrganizeOS" (the org's Website area) instead of Dashboard; Share, Export and Clone are not offered (membership, publishing and the single project all live in OrganizeOS).

   **The fork dashboard is not a surface OrganizeOS uses.** SSO deep-links past it, but it was still reachable by URL, by a stale `returnTo` cookie, or by signing in again — and it is upstream's personal-account surface, so it opens on the admin's empty personal workspace and lists the org's own site under "Shared with me". Worse, it offers actions that break the derived identity provisioning depends on: New project and Duplicate create projects OrganizeOS cannot see or publish, Transfer moves the org's site out of the service-owned workspace, and Leave drops the admin's own access.

   Two defences, both in this fork. `resolveOrganizeosDashboardExit` (`shared/db/organizeos-site.server.ts`) redirects an org admin from the dashboard to their org's Website area, identifying them from data — a non-owner member of a service-owned workspace who owns no projects of their own. A user who does own projects here keeps the dashboard, because it is the only way to reach them; `DEV_LOGIN=true` is exempt, because local development seeds real orgs with real admin emails; the check fails open, and never redirects to the builder's own origin. And provisioning re-asserts the org project's owner and workspace on every re-sync, so a transfer that did happen is healed on the next entry rather than orphaning the site.

   The AGPL §13 source offer is rendered in the builder menu as well as the dashboard footer, so it stays reachable for an admin who never sees the dashboard. Do not remove the menu copy.

4. **Publish** (`features/publish/organizeos-publish.tsx`). The dialog shows the site's real address with copy/open, points at OrganizeOS for domains and settings, and has one Publish button. `domain.publish` creates the production build and the OrganizeOS publisher (`services/organizeos-publisher.server.ts`) dispatches `publish-site.yml` with the build and organization ids. A dispatch that never leaves the builder marks the build FAILED at once; a static-export build is refused (it must never be deployed as the live site).
5. **Execute** (`.github/workflows/publish-site.yml`). Syncs the build with the CLI, builds it, deploys to the `organizeos-sites` Vercel project, POSTs the deployment URL to OrganizeOS's publish callback (which flips the org's ledger pointer, making the site live through the reverse proxy), then reports `PUBLISHED` to the builder's `POST /internal/publish-status`; any failure reports `FAILED`. Without that report the builder's status would read "pending" forever: upstream's cloud publisher used to flip `Build.publishStatus` directly.
6. **Status.** The dialog polls the project while a build is pending and treats a build as failed only after the executor's 25 minute timeout (`organizeos-publish-status.ts`; upstream assumes 3 minutes). On success it says the site is live and that the proxy can take up to a minute to pick the new deployment up (its target cache).
7. **Collections** (OrganizeOS → builder, `POST /internal/collections-sync`, `ORGANIZEOS_PROVISION_TOKEN`, authenticated like provision). Sent by an Inngest job (debounced 30 s per org) whenever the org's public CMS collections change: `{ organizationId, collections }`, every public collection as a full snapshot (`slug` and `name`; `singularName`, `kind`, `id`, `contentUrl` and `fields` are optional, and unknown keys are ignored). The builder adds one catalog Resource per collection to the org's dev build (`shared/db/collections-sync.server.ts`): a GET Resource for `<api base>/collections/<slug>/items`, and no binding. The OrganizeOS panel lists it in its Data section, where an admin adds it to a page (§9: data loads only where it is used). Ids derive from the project and the slug, so a rename only updates the name; a platform collection that a static Resource already covers (`events`, `fundraisers`, `stats`) is skipped. Existing entries are replaced where they stand and new ones appended, so the build keeps its order. A sync also removes, where nothing references them, the bindings with a preset's deterministic id: the unscoped ones older syncs wrote next to each Resource and the `:root` Forms binding of the pre-deploy branches (§9). It keeps the rest, and never touches a binding with a fresh id, which is what every use brings now, whatever its scope.

   The request carries no token: the API base and the `Authorization` header are copied from the static Resources that provisioning seeded. A re-provision rotates the token in every collection Resource itself (new `Authorization` and API base, same name and position), so the old token can be revoked after the next publish without a sync in between; OrganizeOS still fires a sync after provisioning and at builder SSO entry. Idempotent: an unchanged snapshot writes nothing. A write is a compare-and-swap on the build's `version`, which it never bumps (that would make every open builder reload); if a builder save wins the race it re-reads and tries again, three attempts in all.

   Responses: `200 {"ok":true,"collections":n}`; `400` bad JSON or body (slug must match `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`, at most 500 collections); `401` bad or missing token, or any `Cookie`; `405` not POST; `409` the project has no static Resources to copy from (provision it with a token first); `422` no project for the org (missing or offboarded); `503` the build kept changing, which OrganizeOS retries like any 5xx. Collections missing from the snapshot are not retired yet: a removed collection's Resource stays until a later change.

Backward compatibility: every new claim and body field (`subdomain`, the status report) is optional on the builder side, so either repo can deploy first. A project provisioned before OrganizeOS sent a subdomain keeps its `org-<id>` placeholder domain (the dialog then omits the site URL) until the next SSO entry or re-provision.

Working on the integration needs both repositories. In a Claude Code session, attach the second repo with the `add_repo` tool (the session's GitHub scope then covers both); the builder-side change comes first, the OrganizeOS-side change second, and neither breaks the other in between.

## 6. Browser support

No blocking browser gate. Upstream interrupted Firefox and Safari with a full-screen "supports Chromium-based browsers... we plan to support Firefox and Safari" overlay. It is removed: it is an upstream roadmap OrganizeOS has not made, and it is not true of this code — every Chromium-only API in the builder is feature-detected with a working fallback, and the repo carries deliberate Firefox and Safari support work. The one real gap it was covering (CSS Typed OM is Chromium-only, so the style panel converted a keyword value to a unit using `0`) is fixed at the point of failure in `canvas/selected-instance-effects.ts`. There is still no automated Firefox or Safari coverage — the Playwright harness launches Chromium only.

## 7. OrganizeOS overlay (keep minimal for upstream merges)

Changes confined to: env/config, the proprietary-package removal (this doc §2), auth/SSO + provisioning files (`services/auth-strategy/organizeos*`, `routes/internal.*`, `shared/db/provision.server.ts`, `shared/db/organizeos-*.server.ts`, `shared/db/collections-sync.server.ts`, and the data catalog `shared/db/resource-presets.server.ts` and `shared/db/signup-form-preset.server.tsx`, whose ids `shared/organizeos-preset-ids.ts` derives for the server and the browser alike), the blocks' allowlist (`ORGANIZEOS_BLOCKS_ORG_IDS` in `env/env.server.ts`, passed to `resolveOrganizeosSite` by the loader in `routes/_ui.(builder).tsx`, and synced to the canvas by one marked `organizeosSite` line in `shared/sync/sync-stores.ts`), the catalog's survival of its bindings (one marked branch each in `shared/instance-utils/mutation.ts` `deleteInstanceMutable`, `shared/data-variables.ts` `deleteVariableMutable` and `settings-panel/variable-popover.tsx`: a Resource whose id is a derived v5 UUID is never deleted with a binding, §9), the publish seam (`services/organizeos-publisher.server.ts`, `shared/db/publish-status.server.ts`, `publish-site.yml`), asset serving (`shared/asset-response.server.ts`, the three `routes/cgi.*` loaders, `asset-uploader`'s S3 client), frame protection (`shared/frame-protection.ts` and the `headers` exports of `root.tsx`, `routes/_ui.(builder).tsx`, `routes/_ui.dashboard.tsx` and `routes/_ui.$.tsx`), branding (`shared/branding.ts`, `shared/organizeos-logo.tsx`), the OrganizeOS-only chrome behind `$organizeosSite` (`features/publish/organizeos-publish*.ts*`, small branches in `menu.tsx`, `topbar.tsx`, `publish.tsx`), the OrganizeOS blocks (§9: the `packages/sdk-components-organizeos` package, `@organizeos/site-components`, a `workspace:*` dependency in `apps/builder/package.json` and `packages/cli/package.json`, and so in `pnpm-lock.yaml`, registered by one `registerComponentLibrary` call in `canvas/canvas.tsx`; their panel, `features/organizeos-panel/*`, with its tab in `sidebar-left/sidebar-left.tsx` (shown only for an org on the allowlist) and `sidebar-left/types.ts`, one branch in the canvas's drop handler, `canvas/shared/use-drag-drop.ts`, so a dropped block is bound to the project's data like a clicked one, and an `onInsert` option on `insertWebstudioFragmentAt` (`shared/instance-utils/insert.ts`) that completes the insert in its own transaction; their record picker, `settings-panel/controls/organizeos-record.tsx`, behind one branch in `settings-panel/controls/combined.tsx`; and the CLI's copy of their build into every published site, `packages/cli/src/organizeos-components.ts`, called from short hooks in `prebuild.ts` and `framework-react-router.ts`, with cases in `prebuild.test.ts`; `organizeos-components.ts` also copies the package's `LICENSE` and computes the source-offer URL, used by one more short hook in `prebuild.ts`; `html.tsx` carries a second marked change, the source offer (its head links and the visible Source link at the end of the body, §1), with cases in `prebuild.test.ts` and `organizeos-components.test.ts`; the fixture `fixtures/react-router-vercel` carries copies of the cache module and of the html route change), the guards' wiring (the `check:*` scripts and `checks` in the root `package.json`, and `.github/workflows/main.yml`, both of which also build the blocks' package before the tests), and the forced CLI route-template patches for the reverse-proxy host/auth/cache (§8), among them the published site's resource cache (`packages/cli/templates/react-router/app/organizeos-resource-cache.ts`, which one marked change in each of the react-router route templates `html.tsx`, `xml.tsx` and `text.tsx` calls, with its tests in `packages/cli/src/organizeos-resource-cache.test.ts` and cases in `prebuild.test.ts`), and one CLI bug fix worth offering upstream: `packages/cli/src/asset-files.ts` waits for a failed download's write stream to close before deleting its `.tmp` file (otherwise a fast failure could delete it before the stream created it, leaving it behind and flaking `asset-files.test.ts`). Avoid deep edits to shared component `.tsx`; isolate OrganizeOS code so `upstream main` can be merged with minimal conflict.

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
`stale-if-error`. The form action's `loadResource(fetch, resource)` is not
cached. The request behind a miss or a refresh, its body read included, has a
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

## 9. OrganizeOS components

Blocks for OrganizeOS's platform features: a block is a root and parts that a
designer places and styles like any element, while what it does (validation,
opt-in, tags) stays on the platform, in services Website Lite shares. Phase 1
ships the Signup Form; phase 2a (display) the Event List and the Event Card.
Design and plans are in the OrganizeOS repo
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
  posts what its parts collect. Its parts are **Submit Button** and **Field**,
  which names a form field and wires its **Field Label**, **Field Input** and
  **Field Message** together. `src/form/` holds what later families share: part
  registration, the submit helper, the canvas check.
- Every meta is `category: "hidden"`, so the Components panel never lists the
  blocks. The **Signup Form template** binds the root's `state` to a
  `formState` variable, shows its state boxes with `ws:show`, styles the parts
  through the tokens "OS Field", "OS Input", "OS Button" and "OS Message", and
  leaves `data` unbound for the panel.
- **Event List** and **Event Card** are templates over native elements and a
  collection, with no component of their own (the package registers no
  component for them, and `components.ts` never reaches their template files,
  so a published site's copy of the package does not carry them). Both are the
  same `ws:element` div, a grid, holding a `ws:collection` of cards (id
  `events`), a "No upcoming events" box (id `empty`) and an "Events
  unavailable" box (id `unavailable`): the designed Unavailable state that
  spec invariant 11 asks for, with placeholder text the designer edits. The
  card is `src/events/event-card.template.tsx`, one function of the
  collection's `event` parameter: an `article` wearing the shared token "OS
  Card" with a Cover image (shown only for an event with a `cover_image_url`),
  the Title, a Time element for the start time (rendered in the event's own
  `timezone`, a literal `dateStyle` "full" and `timeStyle` "short"), the Place
  (shown only for a `location_name`) and a link to the event's `url` (absolute,
  so a native anchor). The two `ws:show` expressions are `(x ?? "") !== ""`:
  false for `null`, `""` and a missing key, where a bare `!== null` would be
  true for a missing key. A Time given a zone it does not know falls back to
  UTC, so a build made before the platform sends `timezone` renders UTC rather
  than failing. The Event Card is the Event List's template under its own label
  and shows the next upcoming event (one item, see Insert completion); picking
  a specific event waits for the events virtual collection.
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
  platform's per-field limit, or the designer's own shorter `maxLength`.
- **Registered** by one `registerComponentLibrary` call in `canvas/canvas.tsx`
  under the namespace `@organizeos/site-components`, so the components are
  `@organizeos/site-components:SignupForm` and so on. Every build that uses a
  block records that name in `Instance.component`: the namespace can never
  change.

**The panel**, `apps/builder/app/builder/features/organizeos-panel/`:

- **Offered to the orgs on `ORGANIZEOS_BLOCKS_ORG_IDS` only** (§4). The
  builder loader resolves the project's org and sets
  `organizeosSite.blocksEnabled`; without it the tab is hidden and
  `insertOrganizeosBlock` refuses with a toast ("OrganizeOS blocks are not
  available for this site yet") and writes nothing, which covers a drop too
  (the canvas receives `organizeosSite` through the sync pool). A project no
  org owns never gets the panel. This gate is client-side and is a rollout
  gate, not an enforcement boundary (known limits).
- A left-sidebar tab after Components, with the OrganizeOS mark, hidden in
  content mode and disabled on text pages, as Components is. It lists the
  namespace's templates in sections (Events, then Signups) with the Components
  panel's cards and drag, then the org's data (the Data section, below). A
  section names its blocks (Events: Event List, Event Card, RSVP Form), skips a
  name that is not registered yet, and a registered block no section names is
  offered after the others, under "More".
- Events ends with a link to the org's events area,
  `<platform URL>/<subdomain>/events` (the Website area's URL while the builder
  does not know the subdomain), "Manage events in OrganizeOS". The builder
  depends on that platform route (not yet listed on the OrganizeOS side).
- Signups ends with a link to the org's Embeds hub,
  `<platform URL>/<subdomain>/pages/embeds`, where the org makes its forms (the
  Website area's URL while the builder does not know the subdomain). The
  builder depends on that platform route; the OrganizeOS side lists it under
  "Contract with the fork".
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
- **Data section** (`organizeos-data.ts`): one row per catalog Resource, in
  that order (collections in the build's order, then Forms, then Upcoming
  Events), found by id, never by name.
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
- **Insert completion**, `insert-organizeos-block.ts`. A clicked block and a
  dropped one both go through it: the canvas's drop handler
  (`canvas/shared/use-drag-drop.ts`) has one marked branch for the namespace.
  What a block reads from the catalog is a table, `organizeosBlockData`, keyed
  by the template's key (the `component` the panel inserts, not the root's
  component: an Event List's root is a `ws:element`). An entry names the
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
    for example `<v>.data.data.slice(0, 6)` inside the condition.

  1. Refuse, with a toast and no write, when the org is not on the allowlist.
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
     token restyles every block (spec 3.2).

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
  pasted block reads the other org's public forms or upcoming events, and a
  published page shows them.
- **Preset ids**: `apps/builder/app/shared/organizeos-preset-ids.ts`, one
  WebCrypto `uuidV5` that the server and the browser share, pinned by tests to
  the ids the replaced `node:crypto` code produced, and `findCatalogResources`,
  which both sides use to list the catalog. Provisioning and the panel derive
  the same ids, so a re-provision rewrites the panel's Forms and Upcoming
  Events Resources instead of adding a second. The names of those two Resources
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

**The record picker**, `settings-panel/controls/organizeos-record.tsx`, behind
one marked branch in `settings-panel/controls/combined.tsx`, before the text
control. The Signup Form's `record` is a select:

- "None (org defaults)" first (an empty `record`), then the forms the block
  takes, as "name (Newsletter)" or "name (Contact)": newsletter
  (`contact-signup`) and contact (`contact-form`) forms, never membership
  forms.
- It reads the selected root's computed `data`, which the builder's resources
  loader already fetches for the block's own binding (scoped to its root, so
  loaded while the block is on the open page), and makes no request of its
  own.
- A value it cannot find stays listed as "Unavailable form". With no forms data
  (loading, unbound, or the loader's error body) a hint says to reload the
  builder, then to contact support.
- It keeps the upstream select's binding support. A `record` prop on any other
  component keeps the text control.

**Shipping in published sites**, `packages/cli/src/organizeos-components.ts`:

- A site never installs the package. Prebuild clears `app/__organizeos__/`
  with `app/__generated__/` and `app/routes/`, then copies the built
  `components.js` and every module it reaches through relative imports (static,
  re-exported and literal dynamic, parsed with acorn) into
  `app/__organizeos__/` with the package's `LICENSE` beside them (prebuild
  fails without it). That closure never reaches `metas.js` or `templates.js`.
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
  `{ form_id?, fields, page_path, website }` (`website` is the honeypot); the
  answer is `{ outcome }` (`subscribed`, `confirm_email` or `received`) or
  `{ error, field? }`. The block maps an outcome it does not know to Success
  and any error to Error, so a frozen build survives new answers.
- `GET /v1/events?upcoming=true`, through the Upcoming Events catalog Resource
  (the Event List and Event Card): the events not yet over, soonest first,
  each with the event's `timezone` (always a valid IANA zone). An older
  platform ignores `upcoming`. Before the one public-event rule (plan task P1)
  it also lists members-only and private events, which `is_public` lets through
  by default. Before the display changes (P2) it also lists ended events, with
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
- The Embeds hub and events area routes the panel links to
  (`/<subdomain>/pages/embeds`, `/<subdomain>/events`).
- Both sides build to the contract fixtures in OrganizeOS's
  `client/tests/fixtures/site-components/`, which the package copies into
  `src/__fixtures__/` for its tests (`forms.json`, `events.json` and
  `signups/`). To keep them in step, change the OrganizeOS copy first, copy the
  files over unchanged, update the source commit in the note at the top of the
  copy's `README.md`, and check that `diff -r` between the two folders shows
  that note alone. A change is additive or ships under a new endpoint version:
  a published site keeps calling what it was built against.

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
published before the platform half is live.

**Known limits** (OrganizeOS spec, section 12, items 15 to 18, with the
options, and the limits found since in review):

- **Rollout gate.** The panel and the blocks are offered only to the orgs on
  `ORGANIZEOS_BLOCKS_ORG_IDS`. A page with a Signup Form or an Events block
  loads its Resource (`GET /v1/forms`, `GET /v1/events?upcoming=true`) on every
  view of that page (no longer of every page: the binding is the block's own),
  and a page with both makes both reads. Vercel's CDN never caches those
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
  do the Event List and Event Card. A
  published build is frozen: a site published before the builder deploy that
  ships the cache keeps the old loader, one uncached call per page view, until
  it is republished. So an org joins the allowlist only after it has
  republished on that deploy and its `/v1` call rate has been observed. The
  allowlist is a rollout gate, not an enforcement boundary: it decides who is
  offered the panel, and nothing more. Pasting or duplicating a block (`insertWebstudioFragmentCopy`)
  is not gated; the canvas registers the namespace for every project; the CLI
  copies the package into every site it builds; and removing an org from the
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
  block's binding ("OrganizeOS Forms", "OrganizeOS Upcoming Events") added on
  the block's root itself, which the next re-resolution (saving that variable
  is one) binds in place of the block's binding:
  `validateDataVariableName` compares only `variable`-type sources, so it
  allows the name beside the binding. A Signup Form has one such prop (`data`);
  an Event List or Event Card has three (the collection's `data` and the
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
- No self-serve "Reconnect data": once the builder is enabled, nothing re-seeds
  a project's catalog, so a refused insert needs support to re-provision.
