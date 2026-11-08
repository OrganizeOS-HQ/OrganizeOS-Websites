# OrganizeOS fork of Webstudio

This is OrganizeOS's fork of [Webstudio](https://github.com/webstudio-is/webstudio), used as the **element-based, Webflow-class site builder** behind OrganizeOS "Websites 2.0". It runs as a separate service, branded as OrganizeOS, against the OrganizeOS Supabase, and member organizations build data-bound public sites with it.

This document is the fork's source of truth for: the **AGPL §13 license posture**, what we changed vs. upstream, and how data-binding + deploy config are wired. Keep OrganizeOS-specific changes minimal and isolated so upstream merges stay tractable.

## 1. License posture (AGPL-3.0 §13) — POSTURE A

Webstudio core is **AGPL-3.0-or-later**. Serving a _modified_ builder to org admins over the network triggers **§13**: those users must be offered the source of our modifications.

**Our posture (A): accept the copyleft and keep this fork public.**

- This fork repository is **public**. It must be public **before any non-employee org admin uses the builder**.
- The builder UI carries a persistent **source-offer link** in its chrome, pointing at the deployed commit of this public fork (added with the branding changes).
- We do **not** treat the builder as "internal only" — that is a false safe-harbor; §13 attaches the moment an external admin uses the modified builder.
- Generated **sites** do not trigger any builder-source obligation. The published-site runtime packages (`@webstudio-is/react-sdk`, `sdk`, `sdk-components-react`, `sdk-components-react-radix`, `sdk-components-react-router`, `sdk-components-react-remix`, `image`, `wsauth`: every package the CLI templates install; and what they pull in, `content-engine`, `expression`, `query-builder`, `css-engine`, `fonts` and `icons`, their transitive dependencies, with `content-engine/runtime` bundled into every site by the CLI) are kept **byte-identical to upstream** so §13 only ever covers their already-public source. OrganizeOS-specific generation logic lives in the CLI templates / route templates, whose Corresponding Source every published HTML page offers in its head, and only there. The two head links are: `<link rel="license" href="https://www.gnu.org/licenses/agpl-3.0.html">` and `<link rel="code-repository" href="https://github.com/OrganizeOS-HQ/OrganizeOS-Websites/tree/<sha>">`. The head links point at the fork code this site runs (these route templates, the resource cache and the OrganizeOS blocks), at the commit that built it. **Owner decision of 2026-11-07: the offer is the head links only.** Published sites render no visible "Source" link in the body; this replaces the owner decision of 2026-10-15, which added a small visible link at the end of the `<body>` (a `data-organizeos-source-offer` wrapper) because §13 asks that the offer be prominent and a head link is invisible to a visitor. The owner accepts the risk that a head-only offer may not be the prominent offer §13 describes while OrganizeOS changes sit in AGPL files, and will deal with Webstudio directly if they raise it. A future step that would make the head-only offer sound: relicense the OrganizeOS blocks package, and move the template change out of upstream's files (the route templates) so no AGPL file carries an OrganizeOS change. These come from marked changes in `packages/cli/templates/react-router/app/route-templates/html.tsx`. Prebuild replaces its `__ORGANIZEOS_SOURCE_URL__` placeholder with `getOrganizeosSourceUrl()` (`packages/cli/src/organizeos-components.ts`). That is the fork at `GITHUB_SHA` when `GITHUB_REPOSITORY` is `OrganizeOS-HQ/OrganizeOS-Websites` and `GITHUB_SHA` is a full commit hash, as in the publish workflow, which builds the CLI from the commit it checked out. Otherwise, as in a local build, it is the repository root. The repository was renamed from `OrganizeOS-HQ/websites-builder` to `OrganizeOS-HQ/OrganizeOS-Websites` in October 2026; the check compares the current name, so it must change with any future rename (between the rename and the fix, sites published linked the repository root, through GitHub's redirect, rather than their commit, until republished). The head links leave the page the org designed unchanged. The head links leave the page the org designed unchanged. They are on html pages only, not on the xml and text routes. The `<body>` is the generated page's own `Body` (`@webstudio-is/sdk-components-react-router`, byte-identical to upstream), which renders the scripts after its children, so `html.tsx` cannot render inside it from outside: it calls the generated `Page` and appends the share-code carrier (below) to the children of the element it returns (`PageWithShareCode`). Generated sites also carry the fork's own OrganizeOS blocks, `@organizeos/site-components` (§9): the CLI copies that package's build into each site as app source, never as an installed package, so the same source offer covers it (OrganizeOS spec section 4.1). The blocks' copy in `app/__organizeos__/` ships with the package's `LICENSE`, the AGPL-3.0 text and identical to the fork's top-level `LICENSE`; prebuild fails without it. A site published before the head links and the `LICENSE` has neither until it is republished, and a site published before the visible link keeps the head links alone, its old offer, until it is republished. That package and the templates are where OrganizeOS site code goes; the runtime packages above stay byte-identical whatever a site carries.
  - The practical consequence: a generated site installs those packages **from npm, at upstream's published version**, not from this fork. The CLI pins them at build time to `PUBLISHED_RUNTIME_VERSION` (`packages/cli/src/runtime-version.ts`), replacing the monorepo placeholder `0.0.0-webstudio-version` that upstream's publish step would otherwise have stamped. That constant must be the upstream release matching this fork's base commit (the first release after it, latest patch) and **must be bumped in the same change as any upstream merge** — a stale value fails only on the next publish, in Vercel's build log. Today it is `0.309.0`: the base is upstream `7cab28b63`, whose child `7274aa8d6`, the release commit, changes no file.
  - **CI guard:** `pnpm check:runtime-upstream` (`scripts/check-runtime-upstream.sh`, run in `checks` and in the CI workflow) fails the build if any file in those fourteen packages differs between `HEAD` and the upstream commit this fork is based on, which `scripts/upstream-base.txt` records. Bump that file to the merged upstream commit in the same change as `PUBLISHED_RUNTIME_VERSION`; a stale base reports upstream's own changes as fork changes. The check needs the base in history, so CI checks out with `fetch-depth: 0` and an upstream merge lands as a merge commit, never squashed.
- If we ever need to keep builder modifications **closed**, the only compliant path is a **commercial/dual license** from Webstudio, Inc. (posture B) — out of scope unless pursued.

## 2. Proprietary code removed (mandatory)

The upstream `@webstudio-is/sdk-components-animation` package is **EULA-proprietary** (not AGPL) and was a hard dependency of the builder, the CLI, the component registry and every published-site template. It has been **physically removed** from this fork:

- The `packages/sdk-components-animation` directory and the `.gitmodules` pointer to the proprietary repo are deleted.
- Dependency stripped from every `package.json` (the builder, the CLI, the component registry, the CLI templates, the fixtures) and from `pnpm-lock.yaml`.
- Since 0.309.0 upstream registers its component libraries in one package, `@webstudio-is/sdk-components-registry`, which the canvas, the builder's server metas and the CLI read (the CLI bundles it from this fork's source; no site installs it). The fork patches it: `src/shared.ts`, `src/components.ts`, `src/canvas.ts` and `src/metas.ts` register no animation library, one marked line each, and its `vitest.config.ts`, like `.storybook/main.ts`, resolves the `webstudio` condition alone, where upstream adds `webstudio-private` when the package's private sources are there. `src/organizeos-no-animation.test.ts` fails if a registered component, meta, canvas library or import source is in the package's namespace, or if the framework registry generates an import of it.

This removes the Webstudio "Animate" components from the palette — acceptable; they are not in OrganizeOS's requirements. The CLI's LLM manual (`packages/cli/src/docs/manual-llm.md`) and upstream's MCP guidance in `packages/project-build/src/mcp.ts` still describe Animation Groups, which this fork does not register: prose, which the guard allows, though it misleads an agent; dropping it is a follow-up.

**CI guard:** `pnpm check:no-proprietary` (`scripts/check-no-proprietary.sh`, run in `checks` and in the CI workflow) keeps the package out of what ships (owner decision D6, 2026-11-01). It fails if the package directory exists; if any `package.json` names it (the workspace packages, the CLI site templates, where a listing would make every published site install the EULA package from npm, and the fixtures), or `.gitmodules` does; if a module specifier in the source of `apps/` or `packages/` names it, the template sources the CLI copies into sites (`*.ts.template`) included: an import, export, `require`, `require.resolve` or dynamic import, a quoted specifier or a regular expression (an alias, or the registry's import source, which becomes the import in every generated site); if `pnpm-lock.yaml` has an entry for it; or if the proprietary EULA license banner appears anywhere we ship. Prose and test names may mention the package, a persisted component id such as `…:AnimateChildren` among them. Its self-test, `packages/cli/scripts/check-no-proprietary.test.ts`, plants each violation in a copy of the tree. Do not bypass it. Three generated pages of `fixtures/webstudio-features` still import the package; fixtures are not shipped or built in CI, so the import scan leaves them out, while their manifests stay in the name scan. CI's typecheck leaves that fixture out for the same reason (§7).

## 3. Data-binding — enabled via env, no code patch

OrganizeOS's whole value is **live data-bound elements** (events/donations/contacts via Resources). Webstudio already supports this; it is gated on a plan's `allowDynamicData` / `allowAuth` features (see `packages/plans/src/plan-features.ts`, both default `false`; `apps/builder/app/builder/features/publish/restricted-features.ts` gates the Resource-variable feature on them).

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
      "allowAdditionalPermissions": false,
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

Two keys are owner decisions of the 0.309.0 merge:

- **`allowAdditionalPermissions` is `false`** (D8): no API token reaches an org project. The key gates only API tokens with `canUseApi`, refused at creation and at use (`services/api-permits.server.ts`, `packages/authorization-token/src/db/authorization-token.ts`), and share-link relations, and the platform's entitlements never carry it, so `false` closes API tokens on every org project; only a project's owner creates tokens, and an org project's owner is its synthetic service account (`services/organizeos-api-tokens.server.test.ts`, on a fixture of this entry). It is an owner action, editing the production `PLANS` and redeploying, and it fails closed, so it is safe at any time.
- **`allowContentMode` stays `true`** (D5): since 0.309.0, content mode for anyone but the project's owner follows it (`shared/permissions.ts`), and an org's admins are never the owner. The owner always gets content mode, whatever the plan.

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
- `ORGANIZEOS_EXPIRE_LEGACY_SESSION` — `true` turns on the expiry of the platform's old domain-wide session cookie on every builder document (§5, "Old session cookies"); anything else, unset included, leaves it off. Read per request, never inlined at build; on Vercel an env change still needs a redeploy. Turn it on only once the platform's session is host-only on the app host in production, and off again before rolling that back.
- `ORGANIZEOS_PUBLISH_REPO` + `ORGANIZEOS_PUBLISH_GITHUB_TOKEN` — Publish dispatches `publish-site.yml` in that repo instead of Webstudio's cloud publisher. The repo is `OrganizeOS-HQ/OrganizeOS-Websites` (its old name, `OrganizeOS-HQ/websites-builder`, still reaches it through GitHub's redirect). The token is a fine-grained personal access token whose resource owner is OrganizeOS-HQ, limited to this repository, with Repository › **Actions: Read and write** (GitHub adds Metadata: Read-only). Actions is added at Read-only by default: a token left there, or one owned by a personal account or still awaiting the organization's approval, can read the public repository but not start the workflow, so every Publish fails with the setup message while the builder's log shows the dispatch answered `403 Resource not accessible by personal access token`. An expired token fails Publish the same way, so renew it before it expires. An env change reaches functions only on a new deployment, so redeploy after replacing it.
- `ORGANIZEOS_APP_URL` — the OrganizeOS app the builder hands users back to (login page, the builder menu's "Back to OrganizeOS", the org's Website area). Defaults to `https://app.organizeos.org`.
- `ORGANIZEOS_BLOCKS_DENY_ORG_IDS` — the orgs denied the OrganizeOS blocks and the rest of the OrganizeOS builder UI (§9, In the builder): comma-separated organization ids, each trimmed and matched in any case. Every other org, new ones included, is offered them; unset, empty or only separators denies none. An entry that is not an organization id denies every org (a malformed value fails closed), and the builder loader logs that once per instance, without the value. Read by the builder loader, which resolves the project's org from its owner's service email (`org+<organizationId>@svc.organizeos.internal`) and hands the result to the builder as `organizeosSite.blocksEnabled`. Set it in Vercel before the deploy that should read it: an env change reaches functions only on a new deployment, and an unset value offers the blocks to every org. It replaced `ORGANIZEOS_BLOCKS_ORG_IDS`, the rollout allowlist, which the builder no longer reads: delete it from every deployment, and never reuse the name.
- `WEBSITES2_PREVIEW_SECRET` — shared with OrganizeOS (the same value on both sides): the key that signs the canvas's draft-preview assertion, `X-OOS-Preview` (§5, "Draft preview on the canvas"). Unset or blank: no assertion is minted, and the canvas shows published items only. Rotate it on both sides together; a mismatch only turns preview off.
- `ORGANIZEOS_CMS_PANEL` — builder only: the CMS's switch (§9, "The CMS overlay"). Only the exact value `true` offers the CMS rail button; anything else leaves the rail without it. The OrganizeOS data tab does not depend on it.
- `PUBLISHER_HOST` — the platform base domain an org's site is served from (`<subdomain>.<PUBLISHER_HOST>`); with the org subdomain mirrored into `Project.domain` (§5) every address the builder shows is the real one. **Defaults to `organizeos.org` in code**, so an unset env is correct rather than dangerous; upstream defaulted it to its own staging domain, which is what made a missing value advertise a Webstudio address. Set it only to point a deployment somewhere else.
- `TRPC_SERVER_API_TOKEN` — the builder's service token. The publish executor uses it to sync the build **and** to report the outcome to `POST /internal/publish-status` (§5). Never commit a value: `apps/builder/.env` keeps it commented out, where upstream's sets an e2e token.
- `EMAIL_SERVICE_URL` — never set it. It is upstream's email service for Form email actions, which do nothing on an OrganizeOS site (§8); set, the builder's Form Preview would send `TRPC_SERVER_API_TOKEN` to it as a bearer token.

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
  do not support ACLs. (`apps/builder/.env` shows upstream's `public-read`,
  commented out.)
- Leave `RESIZE_ORIGIN` unset unless an image-resizing service is in front. The
  builder then serves originals.
- `MAX_UPLOAD_SIZE` defaults to 4.5 (MB), which is Vercel's limit on a
  function's request body. Raising it on Vercel does not raise that limit.

Upstream reads files back through an edge proxy that answers `/cgi/image`,
`/cgi/asset` and `/cgi/video` before the builder sees them. This fork has no
such proxy, so those routes fetch the object with a signed GET and stream it
back, passing range requests through so video can seek: `serveStoredAsset`
(`apps/builder/app/shared/asset-response.server.ts`) calls the S3 store's
`readFileResponse`, which `readResponseFromS3`
(`packages/asset-uploader/src/clients/s3/read.ts`) answers with storage's own
response, a range passed through as it came, or undefined for a missing
object. Upstream's `readFile` stays beside it: it takes an offset and a length
and reads the bytes into memory, and cannot express an open-ended range
(`bytes=2-`). The fs store has no `readFileResponse`, and the routes read its
folder themselves. The publish CLI downloads every asset through the same routes.
Without the read path every `/cgi/*` read fails, and a site with an uploaded
image cannot publish either (`shared/cgi-routes.server.test.ts`, ranged and
full reads against the real store, and a publish's image download).

`packages/asset-uploader` is not in the byte-identical set (§1). Upstream
signs `host` itself since 0.309.0, so the fork changes it in two ways: the
endpoint's path is kept (`createS3ObjectUrl`), and the S3 store reads a file
back as a response (`readFileResponse`, an optional member of
`AssetObjectReader` in `src/client.ts`).

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

Upstream's `GET /rest/assets/:id/content`
(`routes/rest.assets.$assetId.content.tsx`), new in this merge, also answers
an asset's bytes on the builder's origin, to any user who may view the
project. One marked block in its handler
(`services/asset-rest-route-handlers.server.ts`) sets the same headers
through `assetResponseHeaders`, after upstream's own, which it keeps:
`Content-Security-Policy: sandbox` (PDFs excepted) and
`X-Content-Type-Options: nosniff`. `services/asset-rest-content.server.test.ts`
checks both for an `.html` and an `.svg` asset. The builder's Markdown preview
(`features/text-file-editor/markdown-preview.tsx`) puts sanitized Markdown into
the builder's page, and may frame an uploaded document by a relative address;
these headers keep that document inert.

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

4. **Publish** (`features/publish/organizeos-publish.tsx`). When the dialog opens, after every publish it sends, and when a publish settles, it reads the site's addresses and launch state from `GET /rest/organizeos-site/{projectId}` (`routes/rest.organizeos-site.$projectId.ts`, read by `features/publish/organizeos-publish-addresses.ts`). The route answers a fetch only (a document or iframe load is refused), and only to a user signed in as a user (a share link's token is refused) who may view the project. It resolves the org from the project owner's service email, never from the request, requires it to be a UUID (`resolveProjectOrganization`, `shared/db/organizeos-project-org.server.ts`), and calls OrganizeOS's service-role `websites2_site_addresses(p_org)` with `POSTGREST_API_KEY` (`shared/db/organizeos-site-addresses.server.ts`). The answer is validated (at most one row; a main host that, ASCII-lower-cased, is dot-separated labels with no scheme, port, path or userinfo; a known status; an optional boolean `launchable`; optional `targets`, at most 50, each the built-in address (key `builtin`, host null) or a domain (key and served host, both valid hosts), with booleans `main` and `live` and ISO times or null for `published_at` and `unpublished_at`) and never stored; anything else is `{ ok: false }`, logged as one code with no data. The route answers each target with its `key` (`builtin`, or the host it is served on), its display host (the built-in one composed as `{subdomain}.{PUBLISHER_HOST}`), whether it is the built-in or the main, when it was last published and whether it is live. `shared/__fixtures__/site-addresses.json` and `site-addresses-targets.json` are byte-for-byte copies of the platform's answer fixtures; their README names the source commits and the `diff` to run.

   The dialog lists one row per target, in the read's order: the built-in address first, labelled Built-in, then each Website-use domain, the main first, labelled Main. A row has a checkbox, the host (linked to the site while it is live, truncated with its full text in a tooltip when it does not fit) and, under it, the label, Live or Not live, and when it was last published (the exact time in a tooltip). The rules are in `features/publish/organizeos-publish-targets.ts`: the first read ticks exactly the live targets (none before the first go-live); a person's ticks hold through every later read until the publish they started settles, and the read after the settle ticks the live targets again; a ticked target a newer read no longer lists is dropped. Below the rows, one line for each problem and nowhere twice: "Couldn't load your addresses." with Retry when the read failed (no rows); "Addresses unavailable." when the platform sent no targets (no rows, no publish); "This version can't go live. Publish again." while the last build is published and OrganizeOS says `launchable: false`; and a refused publish's own line. Then the banners: the features the plan does not cover, titled "Not in plan", each a link to its element; the Content Blocks that use MDX; and what is paused (section 10). The footer has "Manage domains ↗" (`{ORGANIZEOS_APP_URL}/{subdomain}/settings/domain`) and **Publish to selected**, disabled with nothing ticked, with no rows, or while a build is pending. The title has no settings gear.

   Publish to selected posts the ticked keys to `POST /rest/organizeos-publish/{projectId}` (`routes/rest.organizeos-publish.$projectId.ts`, the logic in `services/organizeos-publish-route.server.ts`), with the page's CSRF token and a 30 second client timeout. The route answers a fetch only, to a user signed in as a user whose builder session (`readBuilderSession`) has a `live` OrganizeOS binding, or `pass` where SSO is not configured, checked with `checkOrganizeosBinding` in either binding mode (the session readers allow every outcome under `observe`; publishing does not), and who holds the project's `admin` permit. The body is strict: 1 to 20 distinct keys, each `builtin` or a host, at most 4 KB. The route resolves the org as the read does, reads the org's addresses at that moment and refuses the whole publish (409 `unknown_target`, nothing written) when any key is not one of the org's targets. It writes the build row exactly as `domain.publish` does for an org site (`createProductionBuild` with `destination: "saas"`, `target: "production"`, `domains` and `assetsDomain` the project's own domain), so the status and the published bundle find the build and the CLI builds what it built before, then hands the read's keys to the OrganizeOS publisher with the build and the org it resolved; the publisher refuses, and marks FAILED, a build whose project resolves to another org. Answers, never stored: `200 { ok: true }`; `400 invalid_request`; `403` (no user session, no live binding, no `admin` permit, not an org's project); `405` for any method but POST; `409 unknown_target`, or `409` on an org mismatch; `422 build_refused` (the builder refused the version, logged by the error's kind only); `502 dispatch_failed` with the publisher's own message; `503 addresses_unavailable`, `targets_unavailable` or `publish_unavailable` (no publisher configured: the route never falls back to upstream's cloud publisher). A failure logs one code, never a host, an id or an upstream message. Upstream's `domain.publish` still works for an older builder tab: it dispatches without targets.

   The OrganizeOS publisher (`services/organizeos-publisher.server.ts`) dispatches `publish-site.yml` with the build and organization ids and, from the route, `targets`, the keys as one JSON string. Its one instance comes from `getOrganizeosPublisher()`, which `shared/context.server.ts` hands `domain.publish` in a marked line and the route calls directly; it is undefined while `ORGANIZEOS_PUBLISH_REPO` or its token is unset. A dispatch that never leaves the builder marks the build FAILED at once; a static-export build is refused (it must never be deployed as the live site). The dialog also lists what is paused, and prebuild leaves an org's own script, and the unsafe values of §10, out of the published site.
5. **Execute** (`.github/workflows/publish-site.yml`). Checks the `targets` input, syncs the build with the CLI, builds it, reads the org script switch from the CLI it built and fails unless it is off, reads the guard level from the same CLI and fails unless it is an integer from 0 to 32767, deploys to the `organizeos-sites` Vercel project, POSTs the deployment URL, with `orgScript` (§10, "Reporting to OrganizeOS") and `guardLevel` as the run's CLI read them and the checked `targets`, to OrganizeOS's publish callback (which flips the org's ledger pointer, making the site live through the reverse proxy), then reports `PUBLISHED` to the builder's `POST /internal/publish-status`; any failure, and a run cancelled before the pointer flip (by a newer publish for the org, which `cancel-in-progress` cancels, or by the job's timeout), reports `FAILED`. A run cancelled after the flip reports `PUBLISHED`, since the pointer moved, and never `FAILED`, which the builder would otherwise take over `PUBLISHED`; one cancelled during the flip request reports nothing, because whether the pointer moved is unknown, and the build reads pending until the dialog gives up. Without that report the builder's status would read "pending" forever: upstream's cloud publisher used to flip `Build.publishStatus` directly.

   **The guard level** is `ORGANIZEOS_GUARD_LEVEL`, beside the switch in `@organizeos/site-components/org-script`: which of OrganizeOS's launch requirements the CLI built from this commit meets. The step "Read the guard level", after "Read the org script switch" and before "Deploy to Vercel", loads it from `packages/cli` as the CLI does, and the callback sends it as `guardLevel`, a JSON integer. OrganizeOS stores it with the deployment pointer and launches a Website only from a build whose level is high enough. Every level-1 requirement is in this repository, so the constant is 1. `packages/cli/src/organizeos-guard-level.test.ts` lists level 1's requirements, each with a check that runs on fixed samples and the tests that cover it, which must still exist and run, fails if the level is 1 or more while one does not hold or has lost its tests, and pins the level at 1; changing the level is a reviewed change that edits that test.

   **The targets** are the addresses ticked in the dialog, as keys: `builtin`, or a host the org's site is served on, which OrganizeOS maps back to the domain in either form. The input is declared `required: false`. The step "Read the targets" (`id: targets`), after setup-node and before "Install and build CLI", reads it from its env as untrusted text: absent or empty writes an empty output (a builder that sends none; OrganizeOS then records the build at no address); otherwise it must parse as a JSON array of 1 to 20 distinct strings, each `builtin` or a lower-case host with no scheme, port or path, or the step fails with `::error::` and nothing deploys (the run reports FAILED). Its output is the array as compact JSON. The flip step takes it from that output alone, checks it again by the same rule, and adds `targets` to the body as its sixth key only when there are any; `packages/cli/src/__fixtures__/publish-callback-body.json`, a byte-for-byte copy of the platform's fixture, is the body it must build. On success it also logs `live_targets=<count>`, the number of the answer's targets that are live, never a host. The fork is public, and so are a run's inputs and logs: the keys are `builtin` or the org's public addresses, and the log carries a count. OrganizeOS puts each ticked target live when the build passes its checks, and a publish never takes an address down.

   **Inputs reach scripts through `env:`.** No `run:` script holds a `${{ }}` substitution: inputs, variables, secrets and step outputs reach each script through its step's `env:`, and the callback's and the two status reports' JSON bodies are built with `node` from there, so a dispatch input cannot break out of the shell or a body. A step output is written only after its value is checked: the targets' JSON array, the switch's `false`, the level's integer, the deployment's `https://` host. The callback step checks `orgScript`, `guardLevel` and `targets` again before it sends anything, and keeps its 2xx check. On success it logs only the answer's `live` and `launchable`, as `live=<value>` and `launchable=<value>`, each only when it is a boolean, and `live_targets=<count>`, never the answer itself; on failure it prints the answer. The Vercel CLI is installed in a step of its own, with no secret in its environment, at a pinned version and with `--ignore-scripts`, so no install script runs; bump the pin on purpose, to a release at least two weeks old. The deploy step passes the token only in its environment, as `VERCEL_TOKEN`, which the CLI reads, and never on a command line. The token is still in that step's environment while the pinned CLI deploys. `packages/cli/src/organizeos-publish-workflow.test.ts` runs the steps' scripts against a fake `curl`, `npm` and `vercel`.

6. **Status.** The dialog polls the project while a build is pending and treats a build as failed only after the executor's 25 minute timeout (`organizeos-publish-status.ts`; upstream assumes 3 minutes). Its status row reads "Publishing, started {when}", "Published {when}", "Publish failed {when}" or "Publishing did not finish {when}", and nothing before the first publish; there are no toasts (the dialog unmounts when it closes). After the route answers (success, refusal, error or the client's timeout) the dialog refreshes the project and reads the addresses again, and it reads them again when a pending build settles, a timeout included, so the rows always show what OrganizeOS reports, never the route's or the callback's answer; a read that finishes after a newer one is dropped. Publishes can overlap: the dialog disables Publish to selected while a build is pending, but another admin's publish (another tab or person) is not blocked. The workflow runs one publish per org, and a newer one cancels the older run, which reports FAILED when it is cancelled before the flip and PUBLISHED after it. The status row follows `latestBuildVirtual`, so it shows the newest build, and the next read shows what OrganizeOS made live.
7. **Collections** (OrganizeOS → builder, `POST /internal/collections-sync`, `ORGANIZEOS_PROVISION_TOKEN`, authenticated like provision). Sent by an Inngest job (debounced 30 s per org) whenever the org's public CMS collections change: `{ organizationId, collections }`, every public collection as a full snapshot (`slug` and `name`; `singularName`, `kind`, `id`, `contentUrl` and `fields` are optional, and unknown keys are ignored). The builder adds one catalog Resource per collection to the org's dev build (`shared/db/collections-sync.server.ts`): a GET Resource for `<api base>/collections/<slug>/items`, and no binding. The OrganizeOS data tab lists it, where an admin adds it to a page (§9: data loads only where it is used). Ids derive from the project and the slug, so a rename only updates the name; a platform collection that a static Resource already covers (`events`, `fundraisers`, `stats`) is skipped. Existing entries are replaced where they stand and new ones appended, so the build keeps its order. A sync also removes, where nothing references them, the bindings with a preset's deterministic id: the unscoped ones older syncs wrote next to each Resource and the `:root` Forms binding of the pre-deploy branches (§9). It keeps the rest, and never touches a binding with a fresh id, which is what every use brings now, whatever its scope.

   The request carries no token: the API base and the `Authorization` header are copied from the static Resources that provisioning seeded. A re-provision rotates the token in every collection Resource itself (new `Authorization` and API base, same name and position), so the old token can be revoked after the next publish without a sync in between; OrganizeOS still fires a sync after provisioning and at builder SSO entry. Idempotent: an unchanged snapshot writes nothing. A write is a compare-and-swap on the build's `version`, which it never bumps (that would make every open builder reload); if a builder save wins the race it re-reads and tries again, three attempts in all.

   Responses: `200 {"ok":true,"collections":n}`; `400` bad JSON or body (slug must match `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`, at most 500 collections); `401` bad or missing token, or any `Cookie`; `405` not POST; `409` the project has no static Resources to copy from (provision it with a token first); `422` no project for the org (missing or offboarded); `503` the build kept changing, which OrganizeOS retries like any 5xx. Collections missing from the snapshot are not retired yet: a removed collection's Resource stays until a later change.

8. **Agent** (OrganizeOS → builder, `POST /internal/organizeos-agent`, `ORGANIZEOS_AGENT_TOKEN`). The OrganizeOS advisor's website tools read the org's draft through it (`routes/internal.organizeos-agent.tsx`, `shared/db/organizeos-agent.server.ts`). Its own secret, so a leaked provisioning token cannot reach content and this one cannot provision: unset or empty, the route answers 404 before any other check; a wrong token or any `Cookie` answers 401, and a method other than POST 405. The body is a strict schema, `{ organizationId, actorUserId, operation, args }`, each operation with its own strict `args`; the list is closed, and nothing in it publishes. The reads: `website_overview` (the pages, home first, with each page's static title or null, whether the draft has changes not yet published, and when it was last published), `website_read_page` (`{ pageId }`: the page root's direct children as sections, each with its plain text flattened from the instance tree and capped at 2,000 characters, and its type read from an `os-section:{type}` label, else `custom`) and `website_list_images` (the project's uploaded images, newest first, at most 100, by the name a person gave them, never the storage key). The fork trusts OrganizeOS for who may act, as it does for provisioning; `actorUserId` is never used for authorization. Ids come only from `organizationId`: the project is `deriveProjectId(organizationId)`, and an id in `args` is matched only inside that project's build, so one from anywhere else answers `not_found`. Answers: `200 {"ok":true,"result":...}` or `200 {"ok":false,"code":"not_found"}`; `400 {"ok":false,"code":"invalid_input"}` for a body that fails the schema; `500 {"ok":false,"code":"unavailable"}` for an unexpected error, logged with the operation name and the error's kind only. Spec: `docs/superpowers/specs/2026-10-27-builder-agent-tools-design.md` in the OrganizeOS repo, 4.5 and 11.

**Session binding.** A builder session lives no longer than the OrganizeOS session that opened it. The SSO token's `sid` claim (the GoTrue session id; `readSid` in `organizeos-token.server.ts` accepts a UUID only) and `sub` (the OrganizeOS user id) are stored in the dashboard session as `organizeosSid` and `organizeosUserId`, and the WS OAuth hop copies them through the code token (`oauth.ws.authorize`), the access token (`oauth.ws.token`) and the `ws` strategy callback (`builder-auth.server.ts`) into the project-host session. Every session read goes through `readDashboardSession` or `readBuilderSession` (`services/auth-strategy/organizeos-session.server.ts`): `extractAuthFromRequest`, `findAuthenticatedUser` and `oauth.ws.authorize`, and a test fails if any other module calls `isAuthenticated(`. An upstream merge brings raw `isAuthenticated` calls back outside the conflict markers (0.309.0 did, in `shared/context.server.ts`), and that test is what finds them. The readers ask OrganizeOS `websites2_sso_session_live(p_session_id, p_user_id)` (service role only; false once the session is signed out, revoked, or idle for 12 hours), cached per sid and user for 60 s per instance (5 s for an RPC error). Outcomes: `pass` (SSO not configured), `live`, `missing` (no binding: a session from before this shipped, or a non-SSO login), `dead`, `error`. Under `observe` every outcome but `live` and `pass` is logged (`console.warn` with the builder user id and the first 12 hex of the sid's SHA-256, never an email; at most once a minute per user, sid and outcome on an instance) and allowed; under `enforce` `missing`, `dead` and `error` read as no session: loaders send the admin to the login page (which leads back to OrganizeOS), `oauth.ws.authorize` redirects there instead of minting a code (so the builder does not loop), and tRPC and patch calls are unauthorized. The cookie is not rewritten on the read path. The binding module has its own PostgREST client and must never call `createContext` or import `shared/context.server.ts`: `createContext` reads the session through these readers. Shipping it bumped the session cookie version to `4-organizeos` (fork-distinct, so upstream's next bump never reads our cookies), which signed every builder user out once. Spec: `docs/superpowers/specs/2026-10-21-builder-session-binding-design.md` in the OrganizeOS repo.

**Old session cookies.** The platform's session used to be `sb-<ref>-auth-token` (and its `.0`, `.1`, ... chunks and `-code-verifier`) with `Domain=.organizeos.org`, so it reached `builder.organizeos.org` and every `p-{projectId}.builder.organizeos.org` canvas, where an org's script could read it. It is now `__Host-oos-auth`, host-only on `app.organizeos.org`, but an old copy can stay in a browser for up to 400 days. With `ORGANIZEOS_EXPIRE_LEGACY_SESSION=true`, every document response the builder serves on `organizeos.org` or a host under it expires each cookie the request carried whose name matches `^sb-[a-z0-9]+-auth-token(?:-code-verifier)?(?:\.(?:0|[1-9]\d*))?$`: two raw `Set-Cookie` appends per name, `<name>=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax; Secure; Domain=.organizeos.org` and the same without `Domain`, after the routes' own headers and before any page script runs. The builder sets no `sb-*` cookie of its own, so the pattern is not narrowed to a project ref. `__Host-oos-auth` and `oos-auth` are never set, read or deleted. Resource routes (assets, `rest.*`, tRPC) and static files are left alone: they never reach the document entry. The code is `services/organizeos-legacy-session.server.ts`, called from `entry.server.tsx` (Remix's default Node entry, which the builder used while it had none, with one marked call; its other differences are for this repository's lint and isbot 5 and change no behaviour). On Vercel the global `Headers` is Remix's polyfill (`@vercel/remix` calls `installGlobals()`), which has `raw()` and no `getSetCookie()`, so the module reads existing cookies through either. Tests in `services/organizeos-legacy-session.server.test.tsx` and `organizeos-legacy-session.polyfill.server.test.tsx` (under the polyfill globals) drive that entry through Remix's request handler, with the server build in `organizeos-legacy-session.fixture.tsx`, including a document Remix renders a second time after an error. Order (OrganizeOS plan `docs/superpowers/plans/2026-11-03-org-sites-d-session-cookie.md`, sections 8 and 10): the flag goes on only after the app host's switch to the host-only cookie is verified in production; before that the domain cookie is the live session and the delete would sign people out of the app. To roll the app back to the domain cookie, turn the flag off first.

**Draft preview on the canvas.** The canvas shows a collection's drafts as well as its published items (OrganizeOS design `docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md`, 4.5). Every canvas Resource fetch runs on the builder's server, in `routes/rest.resources-loader.ts`, and one marked change there, inside upstream's `customFetch` and before `safeResourceFetch` (upstream's check of where a fetch may go), passes each outgoing fetch through `createPreviewAssertion` (`shared/organizeos-preview.server.ts`). It adds `X-OOS-Preview: v1.{payload}.{mac}` only when all of these hold, and otherwise the fetch goes out unchanged: `WEBSITES2_PREVIEW_SECRET` is set; the fetch URL, parsed with `new URL` (never a string prefix), has the origin of `ORGANIZEOS_APP_URL`, no userinfo, no encoded slash, backslash or dot, and a pathname under `/api/public/v1/collections/`; the request carries a builder session whose OrganizeOS binding is `live` (`readBuilderSession`, then `checkOrganizeosBinding`, both cached); that user, signed in as a user and not through a share link's token, has upstream's `view` permit or above on the project of the `p-{projectId}` host (`authorizeProject.hasProjectPermit`); and the project's owner is an org's service account, the organization id resolved as the builder loader resolves it and cached per project for 60 s in-process. The session, permit and org are resolved once per loader request, on its first qualifying fetch; each fetch gets its own assertion. `payload` is base64url (unpadded) of the UTF-8 JSON `{ org, sub, sid, iat, exp }` in that key order: the org id, `organizeosUserId`, `organizeosSid`, and Unix seconds with `exp = iat + 60`. `mac` is base64url (unpadded) of HMAC-SHA256, keyed by `WEBSITES2_PREVIEW_SECRET`, over the ASCII payload segment, and the segment sent is the one signed. The header replaces any stored `X-OOS-Preview` in any casing (`Headers.set`), never appends: a duplicated header arrives comma-joined and the platform refuses it. It is added after the client computed the Resource's cache key (`getResourceKey`), which is unchanged, and never enters build data. A fetch that carries it goes out with `redirect: "manual"`: a redirect is answered, never followed, so the header never reaches the host a redirect names (a collections read the app answers with a redirect reaches the canvas as that 3xx). The byte format is pinned by the platform's `client/tests/fixtures/site-components/preview-assertion.json`, copied to `apps/builder/app/shared/__fixtures__/` (its README names the source commit; `diff` it before a PR that touches the assertion). The platform verifies the MAC, the time window, the org against the read token's, the session's liveness and the user's `pages.view`, and on any failure serves published items as if the header were absent. A published site never carries the header: prebuild fails when any Resource's stored headers name it, in any casing (`packages/cli/src/organizeos-preview-header.ts`, one marked call in `prebuild.ts`). The builder's Form Preview (`routes/rest.preview-form.ts`, upstream's) carries no assertion. It also denies a form's fetch the publisher's registrable domain, so a Signup Form, the starter signup page's included, cannot submit to `app.organizeos.org` from the builder's Preview (owner decisions D11 and D15); it submits on the published site (§8).

**Project settings.** Since 0.309.0 a build's project settings (custom code, the contact email, the site's authentication, headers and the rest) live in their own column, `"Build"."projectSettings"`, which a platform migration adds, and the builder and the CLI read it first. A build saved before keeps a copy of its old settings in `pages`, which the builder strips only in memory and writes back on a save, so the column is the live value and that copy goes stale. The platform's `websites2_builder_resync_project_settings` repairs the column from a build the old builder wrote last, and `websites2_builder_restore_legacy_settings` writes the column back into `pages` for a rollback. When they run at the cutover is owner decision D9, still open, in the OrganizeOS plan for this merge (`docs/superpowers/plans/2026-11-01-builder-upstream-merge.md`).

Backward compatibility: every new claim and body field (`subdomain`, the status report) is optional on the builder side, so either repo can deploy first. A project provisioned before OrganizeOS sent a subdomain keeps its `org-<id>` placeholder domain (Back to OrganizeOS then opens the app's dashboard; the Publish dialog takes the subdomain from OrganizeOS's answer and is unaffected) until the next SSO entry or re-provision. The dialog reads `launchable` only when `websites2_site_addresses` sends it: a missing or `null` field shows no warning, so either side can add it first. Publish targets are not "either repo first": a builder without the Publish dialog's rows publishes with no `targets`, and OrganizeOS records the build at no address; this builder needs the platform's `targets` and refuses to publish without them ("Addresses unavailable.", the route's 503 `targets_unavailable`). The builder and the workflow ship from this repository together, and a revert reverts both: the publisher always dispatches on `main`, so a builder that sends `targets` to a workflow that does not declare it gets a 422, a setup failure that marks the build FAILED. `guardLevel` is the exception to "either repo first": OrganizeOS's callback refuses a key it does not know, so it accepted the field before this workflow sends it.

Working on the integration needs both repositories. In a Claude Code session, attach the second repo with the `add_repo` tool (the session's GitHub scope then covers both); the builder-side change comes first, the OrganizeOS-side change second, and neither breaks the other in between.

## 6. Browser support

No blocking browser gate. Upstream interrupted Firefox and Safari with a full-screen "supports Chromium-based browsers... we plan to support Firefox and Safari" overlay. It is removed: it is an upstream roadmap OrganizeOS has not made, and it is not true of this code — every Chromium-only API in the builder is feature-detected with a working fallback, and the repo carries deliberate Firefox and Safari support work. The one real gap it was covering (CSS Typed OM is Chromium-only, so the style panel converted a keyword value to a unit using `0`) is fixed at the point of failure in `canvas/selected-instance-effects.ts`. There is still no automated Firefox or Safari coverage — the Playwright harness launches Chromium only.

## 7. OrganizeOS overlay (keep minimal for upstream merges)

Every file this fork adds or changes outside its own blocks package
(`packages/sdk-components-organizeos`, §9) is listed here, by area, and a PR
that adds or changes one adds it here. A change inside an upstream file carries a comment that
starts `OrganizeOS fork:` (older ones `OrganizeOS:`) and says why. Builder
paths are relative to `apps/builder/app/`, with `builder/features/` shortened
to `features/`; every other path starts at the repository root. Avoid deep
edits to shared component `.tsx`; isolate OrganizeOS code so `upstream main`
can be merged with minimal conflict.

- **Repository and configuration.** `vercel.json` (`git.deploymentEnabled`,
  §4); `apps/builder/.env` (the OrganizeOS block); `env/env.server.ts` with
  `env/env.server.test.ts` (the variables of §4); `README.md` (the license
  lines); `CLAUDE.md` and `.claude/agents/spec-reviewer.md` (agent context);
  `.gitignore` (`previews/`, the preview tool's output); `.oxfmtrc.json`, whose
  `ignorePatterns` keeps the formatter off the Convergence Field fixture (§9).
- **The proprietary package's removal (§2).** In the component registry
  `packages/sdk-components-registry`: its `package.json` and
  `vitest.config.ts`, and `src/shared.ts`, `src/components.ts`,
  `src/canvas.ts` and `src/metas.ts`, one marked line each, with
  `src/components.test.ts` and the fork's `src/organizeos-no-animation.test.ts`.
  `.storybook/main.ts` (marked: the `webstudio` condition only) and
  `.storybook/story-sources.json`. The manifests: `apps/builder/package.json`,
  `packages/cli/package.json` (also `"private": true`, owner decision D10:
  the fork never publishes the CLI), `packages/cli/templates/*/package.json`,
  `fixtures/*/package.json`, `fixtures/*/.template/package.json` and
  `pnpm-lock.yaml`. `.oxlintrc.json` (its ignore entries for the package);
  the CLI's `src/docs/manual-llm.md` and its `src/docs.generated.ts`. The
  guard, `scripts/check-no-proprietary.sh`, with its self-test
  `packages/cli/scripts/check-no-proprietary.test.ts`. Upstream tests that
  needed the package's components, rewritten or dropped:
  `packages/project-build/src/mcp.test.ts`,
  `packages/project-build/src/runtime/components.test.ts`,
  `shared/component-metas.server.test.ts`,
  `shared/nano-states/selection-reveal.test.ts`,
  `features/command-panel/groups/wrap-group.test.tsx` and
  `shared/copy-paste/plugin-jsx.test.ts` (marked).
- **The runtime pin (§1).** `packages/cli/src/runtime-version.ts` with
  `runtime-version.test.ts`, called from one short marked hook in `prebuild.ts`;
  `scripts/upstream-base.txt`; `scripts/check-runtime-upstream.sh`.
- **Checks and CI.** The root `package.json`: `check:no-proprietary`,
  `check:runtime-upstream`, `check:every-test-runs`, `test:builder:projects`
  (the builder's Vitest projects one at a time), `checks` (CI's steps in CI's
  order), `preview:template` and its `playwright` devDependency, and
  nano-staged's `oxfmt --no-error-on-unmatched-pattern`, so a commit that stages
  only files the formatter ignores (this doc, under `docs/**`) passes the hook.
  `.github/workflows/main.yml`: one workflow, a `checks` job and a `tests` job
  of nine legs (the packages, the CLI, and one per builder Vitest project), with
  no secret, environment or checkout ref, and checkouts that keep no token in
  the clone (`persist-credentials: false`); only its cli leg builds the blocks
  package. The typecheck covers every package and fixture but two fixtures the
  fork never regenerates: `webstudio-features`, whose generated pages import
  the removed animation package (§2), and `react-router-vercel`, whose html
  routes import the copy prebuild writes (§8). Each builder project's step has
  a 10-minute limit of its own and runs with `DEBUG=vitest:browser:pool`, which
  logs the files of every browser session Vitest opens, so a run that stalls
  fails inside the job's limit and its log names the files in flight; nothing
  is retried. The visual-regression step runs when the package tests fail
  too. `patches/@vitest__browser@3.1.1.patch` (marked, and registered in the
  root `package.json`'s `pnpm.patchedDependencies`) backports Vitest 3.2.0's
  per-session keying of the Playwright provider's mock routes. Keyed by module
  URL alone, two browser sessions that mock the same module at once overwrite
  each other's route, cleanup removes neither, and a later file in that
  session that imports the module unmocked gets the stale mock: it fails with
  "Mock ... wasn't registered", or, when a `vi.mock` factory's
  `importOriginal` reaches it, with an unhandled "error when mocking a
  module" and a stalled run. Drop the patch when the fork moves to Vitest 3.2
  or later. `apps/builder/vitest.config.ts` (marked) registers a browser
  command, `keepRequestInterception`, that `apps/builder/vitest.browser-setup.ts`
  calls before each browser test file: it gives the session's page one
  Playwright route that matches no request, so the page's request
  interception stays on from its first file to its last. Without it, a file's
  mocks turn interception on and their cleanup turns it off, and a request
  the next file's iframe sends while it turns off never completes, which
  stalls the session.
  `scripts/check-every-test-runs.mjs` fails when a tracked test file runs
  in no leg; it exempts upstream's three builder e2e harness suites, since the
  fork does not run upstream's e2e suite (owner decision D14). Two of that
  suite's files follow the fork all the same:
  `apps/builder/e2e/flows/builder.ts` dismisses no blocking alert (§6), and
  `apps/builder/e2e/tests/mcp-form-props-variable-types.[shard-5].e2e.ts`
  (marked) reads the plan badge's label. The check also holds the `tests` job
  to its shape. The legs are the matrix's `include` entries. Four steps,
  `Install`, `Test`, `Test the visual-regression scripts` and
  `Test the builder project`, must each match the text the check holds (name,
  `id`, condition, limit, env and command; comment lines aside), so changing
  one of them means changing the check too. The job sets no key but `name`,
  `timeout-minutes`, `runs-on`, `strategy` and `steps`, so it has no
  job-level `if:`, and `continue-on-error` appears nowhere in it.
  `.github/workflows/lint-pull-request.yaml`, upstream's PR title check,
  rewritten (an `OrganizeOS fork:` comment heads it): it runs on
  `pull_request` alone, with `contents: read` and `pull-requests: read` (the
  action reads the pull request for its current title), and its one action,
  `amannn/action-semantic-pull-request`, is pinned to the commit of its
  `v6.1.1` tag. Upstream's `pull_request_target` trigger and its two comment
  steps, which needed `pull-requests: write`, are gone: a bad title fails the
  check with the action's own message.
- **Auth, SSO, provisioning and the agent (§5).**
  `services/auth-strategy/organizeos*` and `routes/auth.organizeos.tsx`;
  `routes/internal.*` (provision, collections sync, publish status, and the
  agent endpoint, `routes/internal.organizeos-agent.tsx`, with
  `ORGANIZEOS_AGENT_TOKEN`), behind `services/internal-auth.server.ts`;
  `shared/db/provision.server.ts`, `shared/db/organizeos-*.server.ts`,
  `shared/db/collections-sync.server.ts`, `shared/db/user.server.ts`
  (`resolveOrCreateUserByEmail`), and the data catalog
  `shared/db/resource-presets.server.ts` and
  `shared/db/signup-form-preset.server.tsx`, whose ids
  `shared/organizeos-preset-ids.ts` derives for the server and the browser
  alike. The signup form's fixture is `shared/db/__fixtures__/signup-form.json`
  and the collections answer's `shared/db/__fixtures__/v1/collections.json`. The
  org's synthetic owner (`ORGANIZEOS_SERVICE_PROVIDER`) is no billing entity:
  `isServiceOwnedProject` in
  `packages/trpc-interface/src/context/project-plan.server.ts` exempts an org
  project from the seat gate in
  `packages/trpc-interface/src/authorize/project.server.ts`, and the seat check
  in `shared/polly/topic-resolvers.server.ts` skips its workspaces (the constant
  is exported through `packages/trpc-interface/src/index.server.ts`); and
  `packages/plans/src/plan-client.server.ts`, which reads the products again for
  a product created after the server started, so a new org's plan never resolves
  to the free tier. `services/build-router.server.ts` refuses a service-token
  caller the builder's data. Since 0.309.0 these import upstream's server entry
  as `@webstudio-is/project-build/server` (upstream removed `index.server`).
  Their tests: `services/auth-strategy/organizeos.server.test.ts` and
  `organizeos-token.server.test.ts` beside it;
  `services/internal-auth.server.test.ts`;
  `services/internal-organizeos-agent.server.test.ts`;
  `shared/collections-sync-route.server.test.ts`;
  `shared/db/provision.server.test.ts`,
  `shared/db/collections-sync.server.test.ts`,
  `shared/db/organizeos-agent.server.test.ts`,
  `shared/db/organizeos-plan.server.test.ts`,
  `shared/db/organizeos-site.server.test.ts` and
  `shared/db/signup-form-preset.server.test.tsx`;
  `packages/trpc-interface/src/authorize/project.server.test.ts`,
  `packages/plans/src/plan-client.server.test.ts`,
  `services/build-router.server.test.ts` and
  `shared/polly/topic-resolvers.server.test.ts`; and
  `services/organizeos-api-tokens.server.test.ts` (no API token reaches an org
  project, owner decision D8, §3).
- **The blocks' deny list.** `ORGANIZEOS_BLOCKS_DENY_ORG_IDS` in
  `env/env.server.ts`, which replaced the allowlist `ORGANIZEOS_BLOCKS_ORG_IDS`;
  parsed by `parseOrgDenyList` and passed to `resolveOrganizeosSite` by the
  loader in `routes/_ui.(builder).tsx`, which reports a malformed value once
  with `reportMalformedOrgDenyList`; and synced to the canvas by one marked
  `organizeosSite` line in `shared/sync/sync-stores.ts`, with a case in
  `shared/sync/sync-stores.test.ts`.
- **The session binding (§5).**
  `services/auth-strategy/organizeos-session.server.ts`, called from
  `extractAuthFromRequest` in `shared/context.server.ts`,
  `findAuthenticatedUser` in `services/auth.server.ts` and the loader of
  `routes/oauth.ws.authorize.tsx`; the two optional fields and the
  `4-organizeos` cookie version in `services/auth.server.utils.ts`; the fields
  carried by `services/token.server.ts`, `routes/oauth.ws.authorize.tsx`,
  `routes/oauth.ws.token.ts` and the `ws` callback in
  `services/builder-auth.server.ts`; `ORGANIZEOS_SESSION_BINDING` in
  `env/env.server.ts`; tests in `organizeos-session.server.test.ts` (among
  them "no other module calls isAuthenticated("),
  `services/oauth-ws-authorize.server.test.ts` and `env/env.server.test.ts`,
  and cases in `services/token.server.test.ts` and
  `shared/context.server.test.ts`.
- **The old session cookies' expiry (§5).**
  `services/organizeos-legacy-session.server.ts`, called once from
  `entry.server.tsx`, a copy of Remix's default Node entry, with
  `ORGANIZEOS_EXPIRE_LEGACY_SESSION` read from `process.env` on each request
  rather than through `env/env.server.ts`, so the module imports nothing of the
  builder's and the flag cannot be cached at cold start; tests in
  `services/organizeos-legacy-session.server.test.tsx` and
  `services/organizeos-legacy-session.polyfill.server.test.tsx`, with
  `services/organizeos-legacy-session.fixture.tsx`.
- **The draft preview (§5).** `shared/organizeos-preview.server.ts`, called
  by one marked change in `routes/rest.resources-loader.ts`, with
  `WEBSITES2_PREVIEW_SECRET` in `env/env.server.ts`, the fixture copy in
  `shared/__fixtures__/`, tests in `shared/organizeos-preview.server.test.ts`
  and `services/rest-resources-loader.server.test.ts`; and the CLI's
  `packages/cli/src/organizeos-preview-header.ts`, called from one short
  marked hook in `prebuild.ts`, with `organizeos-preview-header.test.ts` and a
  case in `prebuild.test.ts`.
- **The publish seam (§5).** `services/organizeos-publisher.server.ts`, with
  `organizeos-publisher.server.test.ts`, whose `getOrganizeosPublisher` is the
  one instance: `shared/context.server.ts` hands it to `domain.publish` in a
  marked line when `ORGANIZEOS_PUBLISH_REPO` and its token are set
  (`shared/context.server.test.ts`, and
  `features/organizeos-panel/overlay.wiring.node.test.ts` pins the line), and
  the Publish dialog's route calls it; the publish route
  `routes/rest.organizeos-publish.$projectId.ts`, with its logic in
  `services/organizeos-publish-route.server.ts` and tests in
  `services/rest-organizeos-publish.server.test.ts`;
  `shared/db/publish-status.server.ts`, with
  `shared/db/publish-status.server.test.ts`;
  `publish-site.yml`, with the callback body fixture copy
  `packages/cli/src/__fixtures__/publish-callback-body.json` and its README;
  in `features/publish/publish.tsx`, marked: the dialog's OrganizeOS branch
  with its own title and no settings gear, upstream's status refresh skipped
  for an OrganizeOS site (`publish.organizeos.test.tsx`), and no Export; and
  the Export shortcut left out of
  `features/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.tsx` for an
  OrganizeOS site.
- **The guard level (§5).** `ORGANIZEOS_GUARD_LEVEL` beside the switch in
  `packages/sdk-components-organizeos/src/org-script.ts`, its test
  `packages/cli/src/organizeos-guard-level.test.ts`, and the "Read the guard
  level" step of `publish-site.yml`.
- **The Publish dialog's address read (§5).**
  `shared/db/organizeos-site-addresses.server.ts`,
  `routes/rest.organizeos-site.$projectId.ts`,
  `shared/db/organizeos-project-org.server.ts` (the project's org, shared with
  the publish route), the fixture copies
  `shared/__fixtures__/site-addresses.json` and
  `shared/__fixtures__/site-addresses-targets.json`, and, in the dialog,
  `features/publish/organizeos-publish-addresses.ts` and
  `features/publish/organizeos-publish-targets.ts` (the ticks, labels and
  lines); tests in `shared/db/organizeos-site-addresses.server.test.ts`,
  `shared/db/organizeos-project-org.server.test.ts`,
  `services/rest-organizeos-site.server.test.ts`,
  `features/publish/organizeos-publish-addresses.test.ts` and
  `features/publish/organizeos-publish-targets.test.ts`.
- **Asset storage and serving (§4).** `shared/asset-response.server.ts`, with
  `shared/asset-response.server.test.ts` and `shared/cgi-routes.server.test.ts`;
  the three `routes/cgi.*` loaders; the content route's marked block in
  `services/asset-rest-route-handlers.server.ts`, with two cases in
  `services/asset-rest-content.server.test.ts`. In `packages/asset-uploader`:
  the `readFileResponse` member in `src/client.ts`, `readResponseFromS3` in
  `src/clients/s3/read.ts`, the S3 store in `src/clients/s3/s3.ts`, the
  endpoint's path kept by `src/clients/s3/object-url.ts`, with
  `src/clients/s3/s3.test.ts` and `src/clients/s3/object-url.test.ts`.
  `services/staged-upload.server.ts` keeps its local staged uploads in the OS
  temporary folder, since a serverless bundle's folder is read-only.
- **The CMS overlay (§9, "The CMS overlay").** `features/cms-panel/*`, with its
  tests (its site fixture is a loopback origin, so the suite frames no live
  platform), among them `cms-icon.tsx`, the database icon; in
  `sidebar-left/sidebar-left.tsx`, the one `<CmsRailButton />` after the tab
  triggers in the rail, the `ref={registerCmsRail}` on the rail's column, the
  `hideCmsOverlay()` branch in a tab trigger's click, and the one
  `<CmsOverlay />` outside the tab content; the per-panel `maxWidth` and
  `defaultWidth` in `PanelConfig`, which no panel sets since the CMS left the
  sidebar; `$computedResourceRequests` (the last resource requests computed
  while the plan is subscribed, empty otherwise) exported by one marked change
  in `shared/nano-states/props.ts`, and `invalidateResource` by one in
  `shared/resources.ts` (each call starts a load of its own, with no batch),
  pinned by `shared/resources.organizeos.test.ts`; `cmsPanelEnabled` on
  `OrganizeosSite` (`shared/organizeos-site.ts`), set by `resolveOrganizeosSite`
  from `ORGANIZEOS_CMS_PANEL` in `env/env.server.ts`, passed by the loader in
  `routes/_ui.(builder).tsx`; and the app's origin in that route's `frame-src`,
  through `builderFrameSrcPolicy` in `shared/frame-protection.ts`.
- **Frame protection (§4).** `shared/frame-protection.ts`, with
  `shared/frame-protection.node.test.ts` and
  `shared/frame-protection-routes.server.test.ts`, and the `headers` exports
  of `root.tsx`, `routes/_ui.(builder).tsx`, `routes/_ui.dashboard.tsx` and
  `routes/_ui.$.tsx`.
- **Branding.**
  - `shared/branding.ts`: the product and platform names, the publisher
    host, `planBadgeLabel` ("Not in plan") and `planUpgradeHint`.
  - The OrganizeOS mark v3 in `shared/organizeos-logo.tsx`, the OrganizeOS
    repo's `LOGO_MARK_PATHS` drawn inline in the brand's in-app pair like its
    `BrandMark`: ink on light and cream on dark through `light-dark()`, so it
    follows the builder's colour scheme (`shared/organizeos-logo.test.tsx`).
    It is shown where upstream showed its logo in `auth/login.tsx`,
    `builder/shared/loading.tsx` and `shared/error/error-message.client.tsx`;
    the builder menu's button keeps upstream's, with no logo (owner decision
    D4).
  - `public/favicon.ico`, OrganizeOS's teal browser-tab favicon at 16, 32 and
    48 px, packed by ImageMagick,
    `convert favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon.ico`,
    from the OrganizeOS repo's `client/public/favicon-16x16.png` and
    `favicon-32x32.png` and a 48 px frame drawn from its
    `client/public/brand/organizeos-favicon.svg` by the favicon call of its
    `client/scripts/generate-pwa-icons.mjs`,
    `sharp(svg, { density: 300 }).resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 })`,
    run with the builder's sharp 0.33.5.
  - The accent (owner decision D3): `shared/organizeos-colors.css` sets
    `--theme-color-accent: #23a997`, from which upstream's recipe derives
    every accent colour in both schemes, and one marked line in
    `routes/_ui.tsx` links it after `global.css`; `organizeos-colors.test.ts`
    measures the result in light and dark, and `organizeos-colors.node.test.ts`
    pins the link and the file. The builder follows the OS colour scheme, as
    upstream does (owner decision D2). One marked line in
    `error-message.client.tsx` gives the error page's status numeral the page
    text's colour in either scheme (`error-message.organizeos.test.tsx`).
  - The login page (`auth/login.tsx`): with no OAuth provider configured, it
    sends an admin back to OrganizeOS in place of dead sign-in buttons. Page
    titles name the product: `routes/_ui.login._index.tsx`, `_ui.logout.tsx`,
    `_ui.error.tsx` and `_ui.dashboard.search.tsx`; and
    `shared/session/use-login-error-message.ts`,
    `shared/notifications/subscription.tsx` (no Webstudio changelog toast) and
    `features/sync-status.tsx` name no service.
  - No "Built with Webstudio" badge: `withoutBuiltWithWebstudio` (in
    `canvas/organizeos-org-script.tsx`) drops it where the canvas registers
    the libraries, and `packages/project-build/src/template.tsx` leaves it off
    a new project's 404 page (`packages/project-build/src/template.test.ts`).
    One marked change in
    `canvas/features/webstudio-component/webstudio-component.tsx` drops the
    "Learn more" link to Webstudio's docs.
- **Plan copy (owner decision D4).** Plans are org entitlements, never a
  checkout in the builder. `packages/design-system/src/components/pro-chip.tsx`
  is a plain `Chip`, linking nowhere (`pro-chip.test.tsx`), and every plan
  badge, `ProChip` or `Chip`, reads `planBadgeLabel`; a plan gate says
  `planUpgradeHint` and links no pricing page. Marked:
  `features/builder-mode.tsx` (with `builder-mode.test.tsx`);
  `features/settings-panel/variable-editors/dialog/fields.tsx` (with
  `variable-popover-type.test.tsx`);
  `features/settings-panel/settings-panel.tsx`;
  `shared/project-settings/section-emails.tsx` (with `section-emails.test.tsx`);
  `shared/project-settings/section-headers.tsx` (with
  `section-headers.test.tsx`), which also shows the sdk's "managed by Webstudio
  Cloud" header message as "managed by the platform" (`organizeosIssueMessage`,
  at its two call sites); `shared/project-settings/project-settings.tsx` (no
  Marketplace section) and `shared/nano-states/project-settings.ts`;
  `shared/share-project/share-project.tsx`;
  `shared/notifications/seat-suspended.ts`; `setBuilderMode`'s message in
  `shared/nano-states/misc.ts`; `features/publish/publish.tsx` (the
  `UpgradeBanner` heading and the plan tooltips); the messages of
  `packages/project-build/src/contracts/project-settings.ts` (with
  `runtime/project-settings.test.ts`), `packages/project-build/src/db/build.ts`
  (with `build.test.ts`), `packages/domain/src/db/domain.ts` (with
  `domain.test.ts`) and `packages/project/src/db/build-patch-core.ts` (with
  `build-patch.test.ts`), none of them a runtime package. The dashboard,
  marked: `dashboard/dashboard.tsx`, `dashboard/profile-menu.tsx`,
  `dashboard/welcome/welcome.tsx` and
  `dashboard/workspace/workspace-dropdown.tsx`; the sidebar's Help and
  Marketplace tabs, left out of `sidebar-left/sidebar-left.tsx` (marked);
  `features/blocking-alerts/blocking-alerts.tsx` (marked) and
  `alert.stories.tsx` (§6). With no comment, from before the convention,
  where the change is a link or a line taken out: the plan copy of
  `shared/project-settings/section-auth.tsx` and `section-backups.tsx`, of
  `features/pages/page-settings/section-auth.tsx` and `section-general.tsx`,
  of `features/publish/domain-checkbox.tsx` and `domains.tsx`, of
  `builder/shared/asset-manager/asset-settings.tsx` and of
  `services/workspace-router.server.ts`; `dashboard/projects/projects.tsx`;
  upstream's unsupported-browser flag, gone from
  `packages/feature-flags/src/flags.ts`; and
  `packages/design-system/src/components/panel-banner.stories.tsx`.
  `$publisherHost` in `shared/sync/data-stores.ts` reads `branding.ts`, and so
  do `features/pages/page-utils.test.ts` and
  `shared/nano-states/props.test.tsx`. **The plan guard**,
  `shared/branding.node.test.ts`, reads the shipped sources of
  `apps/builder/app`, `packages/design-system/src`,
  `packages/project-build/src`, `packages/domain/src` and `packages/project/src`
  and fails, with each file and line, on a Webstudio plan, tier or upgrade name,
  a "Pro" chip or a pricing link outside comments. It finds comments with
  TypeScript 5's parser, loaded from the copy `packages/generate-arg-types` pins
  (the builder's own TypeScript 7 has no `createSourceFile`), and fails loudly
  without it. Its one allowed line is the sdk message `section-headers.tsx`
  maps, allowed by its file and its whole text.
- **The OrganizeOS-only chrome behind `$organizeosSite`.**
  `features/publish/organizeos-publish*.ts*`; small branches in `menu.tsx`,
  `topbar.tsx` and `publish.tsx` (whose OrganizeOS title no longer carries
  upstream's settings gear); `organizeosHomeUrl` in
  `shared/organizeos-site.ts`, which the menu's "Back to OrganizeOS" opens,
  with `shared/organizeos-site.node.test.ts`; `features/menu/menu.test.tsx`,
  which renders the menu for an org site and another project; and
  `$organizeosSite` in `shared/nano-states/misc.ts`.
- **The OrganizeOS blocks (§9).** The `packages/sdk-components-organizeos`
  package, `@organizeos/site-components`, a `workspace:*` dependency in
  `apps/builder/package.json` and `packages/cli/package.json`, and so in
  `pnpm-lock.yaml`, registered by one marked `registerComponentLibrary` call
  in `canvas/canvas.tsx`, after upstream's loop. It builds with upstream's
  `vite.sdk-components.config.ts`, which builds every export of its
  `package.json`. Its builder UI is `features/organizeos-panel/*`:
  - **The Components panel's OrganizeOS section**, in marked lines of
    `features/components/components.tsx` (its imports,
    `useStore($selectedPage)`, the branch in `handleInsert` that sends a
    block to `insertOrganizeosBlock`, the groups, the heading and the
    footer), and the branch in `commitCanvasDragDrop`
    (`canvas/shared/use-drag-drop.ts`) that sends a dropped block there too;
    `features/organizeos-panel/overlay.wiring.node.test.ts` pins the marked
    lines.
  - **The staged writes**, `features/organizeos-panel/staged-data.ts`: the
    panels' own writes (a block's insert, the CMS page templates, the data
    tab, a site template's apply) go through `executeStagedRuntimeMutation`
    (below), each as one commit, and it refuses a write that changes or
    deletes a catalog Resource or a catalog `:root` binding.
  - The Background presets section, by one marked entry in
    `features/style-panel/sections/sections.ts`; the Motion tab, by marked
    lines in `builder/inspector.tsx`, with `$activeInspectorPanel` widened to
    take `"motion"` in `builder/shared/nano-states.ts`; the OrganizeOS data
    tab in `sidebar-left/sidebar-left.tsx` (shown only for an org the deny
    list does not deny) and `sidebar-left/types.ts`; the record picker,
    `settings-panel/controls/organizeos-record.tsx`, with
    `organizeos-record.test.ts`, behind one marked branch in
    `settings-panel/controls/combined.tsx`.
  - The CMS page templates (§9): `collection-schema.ts`,
    `collection-layout.ts`, `collection-pages.ts`, `collection-list.ts` and
    `collection-row-menu.tsx`, with their tests, the collection rows in
    `organizeos-data.ts` and `organizeos-panel.tsx`, and cases in
    `shared/db/resource-presets.server.test.ts` and
    `shared/organizeos-preview.server.test.ts`.
  - **The site templates (§9, "Site templates").** In the blocks package, the
    `src/site-templates/` folder (`canonical-variables.ts`, `place-block.ts`,
    `platform-paths.ts`, `types.ts`, `render.ts`, `check.ts`,
    `style-scan.ts`, `sections.ts`, `catalog.ts`, `index.ts`, `assets.d.ts`,
    the kit in `kit/`, the templates, each in a folder under its category
    (`nonprofit/field-journal/` and the rest) with its `images/`, `pages/`
    and `palettes/`, and the spike, a fixture in `__fixtures__/spike/` with
    its `images/`, which the catalog does not list and `index.ts` does not
    export, with tests beside the modules that hold logic); the `@fontsource`
    and `@fontsource-variable` packages whose `woff2` files the templates
    bundle, devDependencies in the package's `package.json` and so in
    `pnpm-lock.yaml`. The package exports the folder as
    `@organizeos/site-components/site-templates` (which also re-exports the
    component markers `$`, `organizeos` and `radix` from `src/shared/proxy.ts`
    and `localStylesFirst` from `src/shared/style-order.ts`, which the block
    insert imports alone, as `@organizeos/site-components/style-order`) and,
    alone, as `@organizeos/site-components/site-templates/canonical-variables`;
    neither `components.ts` nor `metas.ts` imports it. The block templates are
    factories, `signupFormTemplate` in `signup-form.template.tsx`,
    `rsvpFormTemplate` in `rsvp-form.template.tsx` and `rotatingTabsTemplate`
    in `rotating-tabs.template.tsx` (`block-factories.test.tsx`), and the
    block tokens read the site variables in `shared/form-tokens.ts` and
    `events/event-card.template.tsx` (`shared/form-tokens.test.ts`). In the
    builder, `features/organizeos-panel/site-templates/`
    (`apply-site-template.ts`, `template-chooser.tsx` and
    `provisioned-project.ts`, with their tests, `bundled-fonts.node.test.ts`,
    and the preview tool's half, `preview/`: `dump.preview.tsx`,
    `vitest.preview.config.ts`, `stub-api.mjs`, `preview-arguments.mjs` and
    `thumbnail.mjs`, with `stub-api.node.test.ts` and
    `preview-arguments.node.test.ts`, and `palettes/`); one marked loop in
    `shared/db/canvas.server.ts`, with its import, that keeps a font the
    canonical font variables name (`findCanonicalFontFamilies` in
    `shared/db/organizeos-canonical-fonts.server.ts`, with
    `organizeos-canonical-fonts.server.test.ts`); two
    marked changes in `getFontData` in
    `packages/asset-uploader/src/utils/font-data.ts`, with its import, that
    take from a font's family the instance its legacy name carries
    (`dropInstanceNames` in `organizeos-font-family.ts` beside it, with
    `organizeos-font-family.test.ts`); one marked import and one marked
    `<TemplateChooser />` mount in `builder/builder.tsx`, pinned by
    `overlay.wiring.node.test.ts`; the `instanceIdPrefix` option of
    `completeOrganizeosFragment` in `insert-organizeos-block.ts`;
    `getDefaultRoles` in `section-background.tsx` taking the roles by name
    (importing `site-templates/canonical-variables` alone);
    `deleteSubtreeMutable` exported from `collection-pages.ts`; and
    `SIGNUP_PAGE_PATH` in `shared/organizeos-preset-ids.ts`, so the browser
    can read it; with cases in `insert-organizeos-block.test.tsx`,
    `section-background.test.tsx` and
    `shared/db/signup-form-preset.merge.server.test.tsx`.
  - The canvas's play flag needs no builder change: the players' metas set
    upstream's `selectionReveal`, pinned by
    `canvas/organizeos-play-flag.test.ts`.
- **The staged commit and the catalog guard (§9).** In the builder, one
  marked block in `shared/instance-utils/data.ts`:
  `executeStagedRuntimeMutation` and its `RuntimeMutationAccumulator`, with
  marked cases in `shared/instance-utils/data.test.tsx`. In project-build,
  `runtime/organizeos-catalog.ts` (`isOrganizeosCatalogResourceId`, with
  `organizeos-catalog.test.ts`), exported by one marked line in
  `packages/project-build/src/runtime.ts`, and the guard, one marked line at
  each site: `deleteVariableMutable`, `createDataSourceUpsertPayload` and
  `deleteResource` in `runtime/data.ts`, the prop and the data source
  branches of `getInstanceDeleteTargets` in `runtime/instances.ts`, and
  `getPropDeletePlan` in `runtime/props.ts`.
- **Published sites (§1, §8).** The CLI's copy of the blocks' build into every
  published site, `packages/cli/src/organizeos-components.ts`, called from
  short marked hooks in `prebuild.ts` and `framework-react-router.ts`, with
  cases in `prebuild.test.ts` and `organizeos-components.test.ts`;
  `organizeos-components.ts` also copies the package's `LICENSE` and computes
  the source-offer URL, used by one more hook in `prebuild.ts`. The
  react-router route templates: `html.tsx` carries the host-blind page
  authentication, the source offer (its head links only, §1), the share-code carrier imported from
  `page.js`, the package's second entry for published pages (`src/page.ts`),
  through the placeholder `__ORGANIZEOS_PAGE__`, which the same `prebuild.ts`
  hook resolves beside the source URL and
  `packages/cli/src/organizeos-placeholders.d.ts` declares, and the cache's
  call and `no-store`; `xml.tsx` and `text.tsx` carry the authentication and
  the cache's call, and `xml.tsx` its sandbox header. The cache module is
  `packages/cli/templates/react-router/app/organizeos-resource-cache.ts`,
  with its tests in `packages/cli/src/organizeos-resource-cache.test.ts` and
  cases in `prebuild.test.ts`. The image loader returns originals in
  `packages/cli/templates/react-router-vercel/app/constants.mjs`, and the
  `defaults` template's `html.tsx` is `no-store` too. The fixture
  `fixtures/react-router-vercel` carries copies:
  `fixtures/react-router-vercel/app/constants.mjs`,
  `fixtures/react-router-vercel/app/organizeos-resource-cache.ts`, and its
  two html routes, `fixtures/react-router-vercel/app/routes/_index.tsx` and
  `fixtures/react-router-vercel/app/routes/[another-page]._index.tsx`.
  `packages/cli/src/commands/sync.test.ts` turns the org-script pause off for
  its upstream cases, which publish MDX.
- **The org script pause (§10).**
  `packages/sdk-components-organizeos/src/org-script.ts`, which the blocks
  package exports as `@organizeos/site-components/org-script`; `acorn`, a
  dependency of the blocks package for the address rule and
  `readLiteralValue`, and so in `pnpm-lock.yaml`; `canvas/organizeos-org-script.tsx`, through which the one
  marked loop in `canvas/canvas.tsx` registers every library of upstream's
  registry; the marked changes in
  `canvas/features/webstudio-component/webstudio-component.tsx` (the
  instance-tag gate and the two prop skips in `useInstanceProps`, the `div`
  fallback in each renderer, and `withoutPausedProps` in each renderer) that
  keep it off every component; one marked branch in
  `shared/project-settings/section-general.tsx`, with
  `section-general.test.tsx`;
  `features/publish/organizeos-publish-paused-script.ts`, whose banners are in
  `organizeos-publish.tsx`; one marked guard in `getAction` in
  `shared/nano-states/props.ts`, after the input validation check below, with
  its import, that gives an action `actionMayRun` refuses no function, and one
  marked line in its `setVariable` that stores only plain data
  (`isPlainData`); one marked line in `createInstanceElement` in
  `canvas/elements.tsx`, with its import, that renders no instance stored with
  the global root's id; and the CLI's
  `packages/cli/src/organizeos-org-script.ts`, called from two short marked
  hooks in `prebuild.ts` (the drop, and the check that the framework imports
  every component the drop may keep); the CLI's check of each generated
  module, `packages/cli/src/organizeos-generated-code.ts`, called from a third
  short marked hook in `prebuild.ts`, with TypeScript 5.8.2 a dependency of
  the CLI under its own name (`typescript-5`) and `@webstudio-is/template` a
  dev dependency, and so in `pnpm-lock.yaml`; in
  `packages/project-build/src/runtime/data.ts`, one marked guard in
  `getCompiledExpression`, after the input validation check below, and one
  marked check in `evaluateExpressionSync`, with their import, that give an
  expression `expressionMayRun` refuses no value, kept in the compiled
  expressions' cache under the same limit as any other, and an expression no
  function; one marked mock and `beforeEach` in each of
  `packages/project-build/src/runtime/data.test.tsx`, `block.test.ts`,
  `content-block-application.test.ts` and the builder's
  `shared/content-block-source-utils.test.ts` that run upstream's cases that compute a
  bare name with org script allowed, as upstream runs them, and the rest
  paused; in `prebuild.test.ts`, the upstream case that prerenders an Assets
  query naming a route parameter by a bare name publishes as if org script
  may run;
  `packages/cli/src/organizeos-css-tree.d.ts`, which points the CLI's
  typecheck at the root's css-tree typings for the templates its tests
  publish; in `prebuild.test.ts`, the marked `vi.mock`s observe the check and
  let a case set the pause's rules aside to test the check alone; one marked
  header in `route-templates/xml.tsx` (§8); with tests beside each, among them
  `canvas/organizeos-org-script.wiring.node.test.ts`,
  `canvas/organizeos-org-script.props.test.tsx`,
  `canvas/organizeos-org-script.test.tsx`,
  `packages/project-build/src/runtime/data.organizeos.test.ts`,
  `packages/sdk-components-organizeos/src/org-script.without-linter.test.ts`,
  `packages/cli/src/organizeos-generated-code.test.ts`,
  `packages/cli/src/organizeos-org-script.unsafe-values.test.ts` and
  `packages/cli/src/organizeos-publish-workflow.test.ts`. The builder's panels
  keep an org's content as data: `shared/code-highlight.ts` (the navigator's
  CSS preview escapes a style's text, `code-highlight.organizeos.test.ts`);
  `features/settings-panel/variable-editors/json-editor.tsx` (the variable
  dialog reads a stored value with `readLiteralValue` and takes a value that
  does not read as data as invalid, `validateJsonValue` exported for the
  test), with `settings-panel/variable-popover.organizeos.test.tsx` (since
  0.309.0 every value the dialog edits as JSON, a string list too, starts from
  the builder's own JSON text upstream);
  `shared/project-settings/section-redirects.tsx` (a redirect address that may
  not run is not a link, `section-redirects.organizeos.test.tsx`); and
  `packages/project-build/src/runtime/project-settings.ts`, where
  `validateRedirectTarget` and the redirect operations' `parseRedirect` refuse
  a target that may not run (`redirectTargetNotAllowedMessage`,
  `project-settings.organizeos.test.ts` beside it), so the Redirects form, an
  import (`redirect-parsers.organizeos.test.ts`) and the runtime operations
  share one rule, for which `packages/project-build/package.json` lists
  `@organizeos/site-components`.
  The HTML Embed code check needs no change since 0.309.0: upstream's
  `validateHtmlEmbedCode` (`packages/project-build/src/runtime/html-embed.ts`)
  reads the code with parse5, and
  `settings-panel/controls/code.organizeos.test.ts` holds it to that.
- **The preview tool (§9, "Site templates").**
  `scripts/preview-site-template.mjs`, the root `package.json`'s
  `preview:template` script and its `playwright` devDependency, and so the root
  importer's entry in `pnpm-lock.yaml`, and the `previews/` line in
  `.gitignore`.
- **Fixes worth offering upstream.** `createLocalStyleSource` in
  `apps/builder/app/shared/tailwind/tailwind.ts` writes an element's style
  source selection back when one already existed (otherwise an element that
  kept a token from a pasted `<style>` class rule lost every Tailwind style,
  with a case in `tailwind.test.tsx`). `canvas/selected-instance-effects.ts`
  converts a keyword to a unit where CSS Typed OM is missing (§6), with
  `selected-instance-effects.test.ts`. The CLI's `asset-files.ts` race (a
  failed download's `.tmp` file deleted before its write stream opened) is
  fixed upstream in 0.309.0; the fork keeps its regression case, "leaves no
  temporary file when many downloads fail at once", in `asset-files.test.ts`.

**Sitemap page settings.** The builder's sitemap loader
(`shared/$resources/sitemap.xml.server.ts`, one marked change) and prebuild's
sitemap step (`packages/cli/src/prebuild.ts`, one marked change) give
`getStaticSiteMapXml` the pages through `pagesForSitemap`
(`packages/sdk-components-organizeos/src/org-script.ts`), which keeps a page's
`excludePageFromSearch` only when it is the literal `true`, so the sitemap
never evaluates a page setting. Upstream does the same inside the runtime
package since webstudio-is/webstudio#6614 (`c94e5a9`), which 0.309.0 includes,
so on this base `pagesForSitemap` changes nothing. The two marked changes stay
until a follow-up after this merge removes them, with their tests in
`org-script.test.ts`, `prebuild.test.ts` and `sitemap.xml.server.test.ts`.

**Input validation for expressions and generated names.** One pure module, `packages/sdk-components-organizeos/src/code-check.ts` (exported through `@organizeos/site-components/org-script`, tests in `code-check.test.ts`), decides whether an expression, an action or a generated name may be compiled or published, whatever `orgScriptMayRun()` says. A value passes only if it is exactly one expression, with no comment and nothing after it, made of the syntax the builder's editors write: literals, templates, arrays and objects with plain keys, variables (`$ws$dataSource$…`, `$ws$system`, `undefined`, and a variable that is not set in this project), member access by a plain name or a literal key but never `constructor`, `prototype`, `__proto__` or the legacy accessor methods, unary, binary, logical and conditional operators, calls to the methods in upstream's `allowedStringMethods` and `allowedArrayMethods`, and, in an action, assignment to one of the build's variables; an action reads only its own arguments, `$ws$system` and the build's variables. Action argument names are plain identifiers that are not reserved words, resource header names HTTP token characters, search parameter names free of a quote, a backslash and a line terminator, and an instance's tag one of `tags` on every component but XML Node. The fields checked are the instance child expression and tag, prop expressions and actions, a resource's URL, search parameters, headers and body (an empty body is not generated) and an email Resource's subject, body, sender and recipients expressions when set (`emailExpressionFields`), and each page's and page template's title and page settings (a custom metadata entry with no property is not generated). Where it runs:

- **Prebuild** (`packages/cli/src/organizeos-code-check.ts`, one marked call in `prebuild.ts` after `migratePages`) throws on the first value that fails, naming the page or instance and the field, so the run fails before deploy and reports FAILED. It reads what `dropOrgScript` keeps (§10), which runs first: while org script is paused that leaves out, and lists, every action input validation refuses and every action that names a data source it leaves out, so no action it keeps fails here. Tests: `organizeos-code-check.test.ts` and `prebuild.test.ts` ("stops a build with a value that fails input validation", with its cases "leaves out … while org script is paused, and builds the rest").
- **The Resource fields it reads** follow upstream's: `code-check.test.ts` sorts every field of the Resource schema, of its email settings and of its header and search parameter items into those it reads and those that hold no expression, and `builder/shared/organizeos-code-check.test.ts` refuses each expression `mapResourceExpressionsMutable` (`packages/project-build/src/runtime/data.ts`) visits, one at a time, so a Resource field an upstream merge adds fails a test until it is sorted.
- **The canvas and the builder page.** `getCompiledExpression` (`packages/project-build/src/runtime/data.ts` since 0.309.0, one marked change) caches a function that fails, as one that cannot compile does, for an expression that fails: it reads as unset, silently as upstream's since 0.309.0, and a caller that asks for errors (`throwOnError`) gets the reason. `getAction` (`shared/nano-states/props.ts`, one marked change) returns a no-op for an action that fails, before the paused rule's guard (§10) reads it, and logs the reason once with `console.error`, as upstream logs an action it cannot compile. Neither reaches `new Function`. A value that does not parse still fails in `transpileExpression`, as upstream's. `instanceTagMayRender` (`canvas/organizeos-org-script.tsx`) keeps a tag outside `tags` off the canvas whatever the switch, used by the three tag checks in `webstudio-component.tsx`. Tests: `packages/project-build/src/runtime/data.organizeos.test.ts`, `nano-states/props.organizeos.test.ts`, `organizeos-org-script.test.tsx` and `organizeos-org-script.wiring.node.test.ts`.
- **The editors.** The expression editor's lint (`builder/shared/expression-editor.tsx`, one marked change) and the binding popover's save check (`builder/shared/binding-popover.tsx`, one marked change) add the check's reason as one more error when lint finds none (`builder/shared/organizeos-code-check.ts`); the variable dialog's JSON value (`settings-panel/variable-editors/json-editor.tsx`, in its marked `validateJsonValue`) is invalid when it fails; the resource fields (`settings-panel/variable-editors/shared/resource-fields.tsx`, marked changes) show a header or search parameter name's reason on the field, and the HTTP, GraphQL, system and email resource editors (`http-resource-editor.tsx`, `graphql-resource-editor.tsx`, `system-resource-editor.tsx` and `email-resource-editor.tsx` beside it, one marked check each; the email editor also shows the reason on the field) do not save a Resource that fails. The builder has no action editor; actions come from templates. Tests: `builder/shared/organizeos-code-check.test.ts`, `variable-popover.organizeos.test.tsx`, and the email editor's cases in `variable-editors/editor-ref.test.tsx`.
- **Patch save** (`shared/sync/patch/organizeos-code-check.server.ts`, one marked call in `patch-service.server.ts` before `applyAuthorizedEntries`) applies each entry's changes, in order, to a copy of the build and refuses, as `failed` with the reason, an entry after which a record it touches fails in a way it did not before; the other entries apply, and an entry that leaves a saved failing value alone applies. An entry that replaces a namespace whole touches every record in it, before and after, and an entry whose patch does not apply to the build is refused. The check reads the build with its `version` and runs only on the version the client writes (the write itself matches that version): a build at another version answers the version conflict a stale client gets from the write, so the client reloads, and the retry of a request already saved, which writes nothing, passes as upstream's. When entries apply one at a time and the server fails one, each later entry is checked again against the build as saved. The builder answers a partial result with a reload prompt and paused sync (`project-queue.test.ts` pins it), so this is the backstop for a client that skips the editors. Tests: `organizeos-code-check.server.test.ts` (with the builder's own presets) and `patch-service.server.test.ts`.
- **The other build writes.** `commitBuildTransactions` (`services/api-build.server.ts`, one marked call before `patchBuild`) serves the API's `build.patch`, every runtime operation (`commitBuildPatch`) and `build.restorePoint`. It runs the same check over its transactions (`checkBuildTransactions`), at the client's version as the patch save does, and commits only when none is refused; otherwise it answers BAD_REQUEST with a generic message and writes nothing, and CONFLICT for a build at another version. Tests: "a build patch with a value that fails input validation is not saved" and "a runtime operation that writes a value failing input validation is not saved" in `services/api-router.server.test.ts`, "build router restore points" in `services/build-router.server.test.ts`, and the version and unapplied-patch cases in `api-build.server.test.ts`; those suites serve the build columns the check reads (`savedBuildColumns`). A project import (`build.importProjectBundle`, `importPublishedProjectBundle` in `services/project-import.server.ts`, one marked call) runs `findCodeCheckFailure` over the pages, instances, props, resources and data sources it would write, migrated as they are saved, before it reads asset files or writes anything, and refuses a project holding a value that fails with BAD_REQUEST and a generic message. Tests: "refuses a project with ... that fails the save check, writing nothing" in `project-import.server.test.ts`.
- **What the save check covers.** Every build write a client sends passes it: patch requests, the `commitBuildTransactions` routes and project import. The server's own provisioning writes (`shared/db/resource-presets.server.ts` and `shared/db/collections-sync.server.ts`) write values the server generates; `organizeos-code-check.server.test.ts` checks the builder's own presets, and like every build they are checked again at publish (Prebuild, above).
- **The Publish dialog** (`features/publish/organizeos-publish-code-check.ts`, called by `organizeos-publish.tsx`) runs the same check over the build it holds before it dispatches, and when a value fails it does not dispatch and shows one line naming the page or element and the field, since the FAILED report carries no reason. While org script is paused the paused banner (§10) lists what publishing leaves out beside it, so an action input validation refuses shows in both. Tests: `organizeos-publish-code-check.test.tsx`, and the dialog's cases in `organizeos-publish.test.tsx`, which already mocks its fetch.

A build whose saved value fails cannot publish until the value is edited.

**Pasted JSX.** The builder server does not turn pasted JSX into project data.
`createJsxFragment` (`services/build-router.server.ts`, one marked change)
refuses after its access check with one message, `pastedJsxUnavailable` ("Pasting
JSX is not available."), which the paste shows. Tests: "build router jsx
fragment conversion" in `services/build-router.server.test.ts`, with a pin that
no builder module outside tests imports a JSX converter.

**Unpublish refusals.** `domain.unpublish` (`packages/domain/src/trpc/domain.ts`, one marked change) returns the deployment service's failure before it calls `unpublishBuild`, where upstream unpublished the database whatever the service answered. The OrganizeOS publisher refuses every unpublish (the platform's "Switch back to Website Lite" is the way off), and `unpublishBuild` deletes a production Build whose last domain it removes, which the publish callback and a republish need. NOT_IMPLEMENTED and a success unpublish as upstream. Since 0.309.0 the code lives in `unpublishProjectDomains` (`packages/domain/src/project-domain-api.server.ts`), which also serves the API router's `publish.unpublish`; the marked check sits there, before `unpublishBuild`, and `domain.ts` is upstream's. Tests: `packages/domain/src/trpc/domain.test.ts`, and the marked case "keeps publish records when deployment unpublish fails" in `project-domain-api.server.test.ts`, where upstream expects the records cleared.

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
removed from all three react-router route templates, `html.tsx`, `xml.tsx` and
`text.tsx` (the first fix covered `html.tsx` alone, which left a protected XML
or text page readable on the org's own host). Each one's
`authenticateProductionRequest` calls `authenticateRequest(request, authRoutes)`
and re-issues a 401 with the site's name as its realm (`withSiteRealm`, from
`siteName`), the same block in all three. Unprotected sites are unaffected:
`authenticateRequest` returns early when no auth route matches the path.

Do not reinstate a host-based skip in `html.tsx`, `xml.tsx` or `text.tsx` when
merging upstream (`prebuild.test.ts`, "routes challenge a protected path on the
project's own host", which runs all three). Upstream 0.309.0 moved that skip
into its runtime: `authenticateProjectRequest(request, routes, projectDomain)`
in `@webstudio-is/wsauth` skips a request whose host is `projectDomain` or
under it, which here is the org's own host. So no template uses it, the
`defaults` templates included (`prebuild.test.ts`, "no route template imports
authenticateProjectRequest").

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
react-router route templates (`html.tsx`, `xml.tsx`, `text.tsx`) sends the final
fallback of its loader's `customFetch` through `siteResourceCache`, in one
marked change. That is the one instance
`templates/react-router/app/organizeos-resource-cache.ts`, fork code the CLI
copies into every site, creates at module scope. Each call passes the fetch
behind the cache, which is what the template called before:
`cachedFetch(projectId, …)` in `html.tsx`, so a request that opts into the Cache
API still reaches it where there is one, and the global `fetch` in the other
two. The cache keeps a GET's response only as its own `Cache-Control` allows,
under RFC 9111's shared-cache rules (the module's header lists them), keyed on
the URL and every request header, for at most 300 seconds; it refreshes an entry
once however many requests wait, whichever routes they come from, and answers a
failed refresh with the stale entry within the response's `stale-if-error`. It
stores a 200, and a 404 that declares a lifetime (`s-maxage`, or `max-age` under
the same `Authorization` rules). The platform's collections item route answers a
missing item with a 404 and `public, s-maxage=60` (OrganizeOS design
`2026-10-27-cms-page-templates-design.md`, 4.3), so a CMS item page (§9, "CMS
page templates") for a missing slug costs one platform read a minute per
instance, as a found one does, instead of one per request against `/v1`'s rate
limit. A 404 with no lifetime, a 401 and every 5xx are never stored. A 404 is an
answer, not a failed refresh: it replaces a stored entry and never brings back
the stale one. The html route answers with the page meta's `status`, so that
page renders its own "not found" box with status 404 whether its Resource
answered 404 or failed (`prebuild.test.ts`, "answers an item page with the
status its meta computes"). A form submission is never cached: upstream 0.309.0
posts it through the generated protected fetch
(`createManagedFormResourceFetch`, below), and only the GETs a deprecated
Webhook Form depends on go through `customFetch`, and so through the cache, as
the loader's do (`prebuild.test.ts`, "the form action posts through the
protected fetch, never the cache"). The request behind a miss or a refresh, its
body read included, has a deadline, `AbortSignal.timeout`, and answers to it
alone: every caller waiting on the key shares that request, so a caller's own
signal (a loader's `request.signal`, when the visitor leaves) ends only that
caller's wait, with the signal's reason. It is 4 seconds when the stale entry
will still be usable once the 4 seconds pass (the code checks
`requestedAt + 4s < staleUntil`, where `staleUntil` is the end of the entry's
`stale-if-error` window), and 10 seconds otherwise: with no stale entry, or one
whose window ends within those 4 seconds. Past the deadline the request is
aborted and counts as a network error. A hung platform is then answered with the
stale entry, followed by the usual 10-second backoff. With no stale entry that
can answer, the resource fails after 10 seconds (the sdk's `loadResource` turns
that into `ok: false`). Either way, a hang no longer holds every render that
waits on the shared refresh.

There is one cache per server instance, shared by every route, and its bounds
(200 responses and 16 MB of bodies, least recently used evicted first) are per
instance. The Vercel preset puts routes in one server function unless a route
exports its own `config` (none does), and a build of the fixture shows one
server bundle with one copy of the module, every route calling the same
instance. Keep the patches on upstream merges: without them a page view costs
one platform call per resource again (§9, the rollout gate).

**Forms post through a protected fetch.** At 0.309.0 a form's submission, a
Signup Form's or the starter signup page's, runs on the site's server through
a module prebuild generates (`$resources.managed-form-fetch.server.ts`, in
`prebuild.ts`): `createNodeProtectedResourceFetch`, given
`getDeniedResourceHostnames([new URL(request.url).hostname, projectDomain])`,
which denies each of those hosts' registrable domains and every subdomain,
with no allowance. A Signup Form posts to the platform on `organizeos.org`, so
this holds only because the OrganizeOS site proxy fetches the deployment
origin: the request URL's host is the deployment's `*.vercel.app` host, the
org's host comes as `x-forwarded-host`, and `projectDomain` is the bare
subdomain label (`client/lib/websites2/site-proxy.ts` in the OrganizeOS repo).
**This is a contract with the platform: the proxy must keep fetching the
deployment host.** Were the request URL's host ever the org's own host,
`organizeos.org` would be denied and every signup would fail with "Resource
destination is not allowed" (`prebuild.test.ts`, "a published site's form
fetch never denies the platform's domain", builds that request and asserts the
denied list never holds `organizeos.org`). A change belongs in the generated
module, never in a runtime package. The next upstream merge (0.310.0,
webstudio-is/webstudio#6627) changes both the sdk and these templates here:
check this again then.

**Upstream settings that do nothing here (owner decision D11).** Custom response
headers (Project settings > Headers) are applied by upstream's Cloudflare
template only, and a Form's email action needs Webstudio's email service (the
Node module's `createManagedFormEmailSender` sends nothing, and the builder's
`EMAIL_SERVICE_URL` is never set, §4), so both are inert on an OrganizeOS site.
Hiding or fixing them is a follow-up. Some of their copy names Webstudio Cloud
from inside the runtime packages, which stay byte-identical (§1), a recorded
exception to owner decision D4 until that follow-up: the header message in
`packages/sdk/src/schema/response-headers.ts` (the builder's Headers section
shows it as "managed by the platform"), the API and MCP schema text in
`packages/sdk/src/schema/pages.ts` and its generated copy in
`packages/project-build/src/contracts/__generated__/runtime-operation-contracts.ts`,
and the published site's "Email delivery requires Webstudio Cloud"
(`packages/sdk/src/email-resource-delivery.ts` and
`packages/sdk/src/form/server-submission.ts`).

**Share codes on every page.** Every html route renders `PageShareCodeCarrier`
from the copy of the blocks' package (`app/__organizeos__/page.js`, the
package's page entry, `src/page.ts`), appended as the last child in
`PageWithShareCode`, in one marked change. It is the blocks' carrier,
`attachShareCodeCarrier`, on the document (§9, "Share codes"): a click, a
middle-click or a context menu (a right click or a long press) on any
same-origin link to a platform page, a designer's own included, carries the
visit's `?r=` code there, and a plain click goes by document, which keeps the
site's router out. It renders nothing, reads the code only at the event and
writes no cookie or storage, so the server's markup is the same whatever the
address. With a block's carrier on the same page, the document's
capture-phase listeners run before the block root's, so each of those gets
the code once and a click navigates at most once. The route imports it
through the placeholder `__ORGANIZEOS_PAGE__`, which prebuild's marked hook
resolves to the path from
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
prebuild has written it, and CI's typecheck leaves this fixture out (CI builds
no fixture, §7). Keep it on upstream merges (`prebuild.test.ts`, "every html
route imports the page's share-code carrier from the copy of the build and
renders it").

**XML pages answer sandboxed.** `xml.tsx` adds `Content-Security-Policy:
sandbox` and `X-Content-Type-Options: nosniff` to an XML page's response, in
one marked change, so an XML element that is a script in another namespace
never runs on the org host. Sitemaps and feeds are read by crawlers and
readers, which ignore the policy. Keep it on upstream merges (`prebuild.test.ts`,
"an XML page answers with a sandbox policy and nosniff"). The fixture copies of
the route stay upstream's: `pnpm fixtures`, run by hand, writes the header into
`fixtures/webstudio-features/app/routes/[sitemap.xml]._index.tsx`, a render of
upstream's `xml.tsx`, and `git checkout -- fixtures` drops it with the rest of
that drift (§10, "Fixtures"). The `defaults` templates, which the publish
workflow does not use, keep upstream's host skip around `authenticateRequest`
in their xml and text routes; their `html.tsx` answers `no-store`, as the
react-router one does.

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
  components, metas and templates, the `webstudio` export condition to `src/`,
  `lib/` otherwise, built with upstream's `vite.sdk-components.config.ts`,
  which builds every export of its `package.json`. It has no hooks: the
  canvas's play flag comes from its metas (Motion presets, below).
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
- **Registered** by one `registerComponentLibrary` call in `canvas/canvas.tsx`,
  after upstream's loop over its registry's libraries, under the namespace
  `@organizeos/site-components`, so the components are
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
    it toggles `$isCmsOverlayOpen` and is pressed (`aria-pressed`, which
    upstream's `IconButton` styles) while the overlay is open. It is
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
    `$organizeosSite` (the loader's org, never the page URL). The frame stays
    light in both of the builder's colour schemes until the native CMS
    replaces it (owner decision D2, `getBuilderColorMode`); the overlay's own
    box takes the panel colour of either scheme. `title="CMS"`,
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
    or one under it, each in a load of its own, so the canvas refetches it
    (with drafts, §5);
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
  catalog of GET Resources with deterministic ids: Events, Fundraisers and Stats
  (provisioning), one per public collection (collections-sync), and Forms and
  Upcoming Events once a block has added them. A Resource loads nowhere by
  itself: since 0.309.0 Webstudio loads a resource DataSource, in the builder
  (`$computedResourceRequests`) and on a published page (the CLI's prebuild),
  only when an expression on the page reads it (`getPageResourceRootIds`): a
  prop or a child of an instance in the page's tree, or the page's meta. So each
  use brings its own binding: a resource DataSource with a fresh id, scoped to
  the instance that uses it, which references the catalog Resource by id.
  Nothing scopes a binding at `:root`, and provisioning and collections-sync
  write no binding at all.
- **The data tab's list** (`organizeos-data.ts`): one row per catalog Resource,
  in that order (collections in the build's order, then Forms, then Upcoming
  Events), found by id, never by name. "Add to this page" gives the selected
  page a binding of the Resource, scoped to the page's root, unless the page
  already has one there or at `:root`; the row then reads "On this page". The
  binding is named like its Resource, or `<name> 2` (and so on) when that name
  is taken on the page root or at `:root` (an unscoped variable, such as an
  older provision's binding, counts as `:root` for the name, though not as the
  page having the Resource, since it never loads), because expressions resolve
  variables by name: a page-root binding masks a `:root` variable of the same
  name, and the re-resolution that follows the add would point the expressions
  that read it at the Resource. The data panel lists it on every element of the
  page except inside a Slot's content, which reaches `:root` variables only:
  there the panel does not list it and the canvas evaluates it as undefined.
  Nothing loads, and the data panel shows no value for it, until an element of
  the page binds it; then the builder loads it while the page is open, and a
  published site loads it on that page alone. A block's own binding does not
  count: it is visible inside the block only. Without build access (a page
  template outside design mode) the add is refused with the runtime's own
  message, in a toast, and nothing is written.
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
  - **The plan gate.** Create item page and Add list are disabled, with a plain
    label (a `Chip` reading `planBadgeLabel`, as every plan badge is, §7), when
    `$permissions` lacks `allowDynamicData`. Open item page, Add to this page
    and Remove from sitemap are not gated. The gate is in the builder's UI only.
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
    writes, in one staged commit (`updateWebstudioDataStaged`,
    `staged-data.ts`), so one undo removes it all; without build access it is
    refused with the runtime's message, which the row menu toasts:

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
    - the meta, set inline (upstream's page creation is private to its
      settings panel): title `found ? name : "Page not found"`, status
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
    Resource, in one staged commit, from the marked sitemap only (refused with
    the runtime's message, in a toast, without build access). It is offered when
    the sitemap lists a collection that has no item page (an item page deleted,
    its part left listing URLs that now 404): on that collection's row, or on a
    row of its own when the catalog no longer has the collection.
  - **Add list** (`collection-list.ts`, `insertCollectionList`). A popover of
    Layout (Grid or List), Sort, Show (3, 6, 9, 12 or All), the "Link to item
    page" switch, enabled only when the collection has an item page, and Add. It
    inserts, through `insertCompletedFragment` (`staged-data.ts`), at the
    selection, else at the end of the page, in one staged commit, a wrapper
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

- **Insert completion**, `insert-organizeos-block.ts`. A clicked block, a block
  chosen with Enter and a dropped one all go through it: the Components panel's
  `handleInsert` (`features/components/components.tsx`) and the canvas's
  `commitCanvasDragDrop` (`canvas/shared/use-drag-drop.ts`) each have one marked
  branch for the namespace. What a block reads from the catalog is a table,
  `organizeosBlockData`, keyed by the template's key (the `component` the
  Components panel inserts, not the root's component: an Event List's root is a
  Share Code Carrier). An entry names the catalog Resource (`events`, `forms` or
  `upcoming-events`), the name of the block's binding, and the props that read
  it: an instance (`root`, or the `ws:id` the template gives it), a prop name,
  and the expression, given the binding's variable. A template key with no entry
  is inserted untouched.

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
  3. Order the fragment's style sources as the fork always has, local styles
     before tokens (`localStylesFirst`), and insert it through
     `insertCompletedFragment` (`staged-data.ts`): the runtime's
     `instances.insertFragment`, with `"ours"` and the content-model warnings a
     block has on its own let in (the runtime checks against upstream's
     registry, which has no OrganizeOS metas), then, staged on the same state
     once the insert's ids are mapped to the fragment's: create the entry's
     catalog Resource if the project still lacks it, by the id provisioning
     gives it and in provisioning's shape (Forms: named "OrganizeOS Forms", the
     Events URL with `/forms` for `/events`; Upcoming Events: named "Upcoming
     Events", the Events URL with `/events?upcoming=true`; both with the Events
     `Authorization` header; one that appeared meanwhile is kept; an `events`
     entry never creates anything); add the block's binding, a resource
     DataSource with a fresh id scoped to the block's root, named by the entry
     ("OrganizeOS Forms", "OrganizeOS Upcoming Events", "OrganizeOS Events"),
     referencing that Resource; and bind each prop the entry names, by id, to an
     expression over the binding's variable, dropping a prop the template made
     under that name on that instance, so no variable that shares the binding's
     name captures it at insert (copies are another matter: see the known
     limits). The binding is written after the insert, by the mapped ids, never
     put in the fragment: the insert gives a fragment's resource binding a new
     `resourceId`. When the mapping misses the root or a bound instance, the
     insert is refused rather than left unbound.
  4. The insert resolves a token the project already has with "ours": the
     shared tokens ("OS Input" and the rest) are reused as they stand, so a
     block inserted after the designer restyled "OS Input" wears the restyled
     token instead of adding "OS Input-1" with default styles, and restyling a
     token restyles every block (spec 3.2). That includes the RSVP Form's
     `ws:descendant` instances, which wear the same tokens as its Fields.

  One commit, so one undo removes the block, its binding and a Resource it
  created, and every refusal (the content model, no build access, an unmapped
  id) is toasted once and writes nothing. The data loads on the pages that have
  a block, and nowhere else.

- **Catalog Resources outlive their bindings.** Upstream deletes a binding's
  Resource with it (deleting an instance or a page, deleting a variable in the
  data panel, turning a resource variable into a value, deleting a resource
  prop), because there each Resource has one binding. Since 0.309.0 every such
  deletion runs in the runtime layer, `@webstudio-is/project-build/runtime`, for
  the builder, the API and MCP alike, so the guard is there (§7): a Resource
  whose id is a derived v5 UUID (`isOrganizeosCatalogResourceId` in
  `runtime/organizeos-catalog.ts`; Webstudio's own ids are nanoids) is kept when
  its binding goes, and `resources.delete` refuses one, forced or not (owner
  decision D12), with "This Resource belongs to the organization's data catalog
  and cannot be deleted." Deleting a Signup Form, or a page that added Events,
  leaves the catalog for every other use. `organizeos-preset-ids.node.test.ts`
  holds the runtime's test to the builder's `isPresetId`.
- **Staged writes.** The OrganizeOS panels write through
  `executeStagedRuntimeMutation` (`shared/instance-utils/data.ts`): it stages
  the runtime's operations (an insert, a wrap, a props update) and the panels'
  own patches (an insert's completion, Create item page, Add to this page, a
  site template's apply), each seeing what was staged before it, then commits
  them once, as one transaction and one undo step, through upstream's commit
  checks. It rejects without build access (a page template outside design mode),
  and a synchronous stage commits before the call returns. A patch of the
  panels' own passes no runtime guard, so `stageWebstudioDataMutable`
  (`staged-data.ts`) refuses, staging nothing, a write that changes or deletes a
  catalog Resource or a catalog `:root` binding (a resource binding at `:root`
  whose id and Resource are v5 ids); adding a missing one is allowed, in
  provisioning's exact shape, as the block insert and the site-template apply
  do. Every writer keeps the catalog contract the OrganizeOS repo's builder-data
  plan set for this merge (with owner decision D8): a catalog Resource is
  written only when it is missing, in provisioning's shape, and no writer adds a
  catalog `:root` binding.
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

  The form is Webstudio's managed Form, stored as `ResourceForm` (owner
  decision D15 of the 0.309.0 merge, confirmed 2026-11-04). Its action names
  one Resource, "Newsletter signup", scoped to the form, whose body is the
  form's data; the published page's server action posts it to `/v1/signups`
  with the org's read token, which never reaches the browser
  (`prebuild.test.ts`, "the provisioned ResourceForm submits to /v1/signups on
  its published site"). It is written as `ResourceForm` itself, never as a
  `Form` with pages' `formComponentIdentityVersion` marker, which upstream no
  longer writes and which would make 0.309.0 read every other stored `Form` of
  the build, an org's own Webhook Form included, as a ResourceForm. A form
  provisioned before 0.309.0 is a stored `Form`, which 0.309.0 reads as the
  deprecated `WebhookForm` and which still submits ("an existing org's stored
  Form, read without the marker, still submits to /v1/signups on its published
  site"). The next provision makes it a ResourceForm under the same element
  ids, kept by role with the ids of its `formState` variable, so an org's
  styles and props on them, and the children it added, carry over
  (`signup-form-preset.merge.server.test.tsx`, with the fixture
  `shared/db/__fixtures__/signup-form.json`); only the parts the earlier form
  never had take new ids. Every org must be re-provisioned before an upstream
  release drops `WebhookForm`. The template still owns the text of its labels
  and its button, which each provision resets. In the builder's Preview a
  submission is refused (§5).

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
- A preset writes ordinary styles only, to the element's **local** style source
  at the current breakpoint, base state, in one undo step: `background-color`
  and the nine layer longhands upstream's Backgrounds section reads, and the
  band variables `--focus-ring` and `--accent-text` (`BAND_VARIABLES`, Site
  templates, below), and in the same batch it clears whichever of those it does
  not write (0.309.0 runs a batch's deletes after its sets, so clearing
  everything first would wipe the preset), then selects the local source the
  runtime made. It writes those two only when the palette is the four canonical
  variables (a site template's site, the only one that reads them), and on any
  other site neither. A dark preset makes the element a band, as a template's
  kit band is: it sets both to whichever of the base and the text is lighter
  (`--base` on a light palette, `--text` on a dark one), so focus rings and a
  template's accent text inside it read on the dark surface. A light preset,
  whose surface is the base's, sets both to `var(--accent-2)`, the reset a
  template's base panel inside a band makes and what they are on the base unset:
  so a light surface nested in a band, or a light preset at 767 on a section
  that is a dark band at the base breakpoint, rings focus and sets accent text
  in accent-2 again. Clearing a background in upstream's Backgrounds section
  leaves them as they are. It never writes to a token, adds no component, prop
  or script, and keeps no link to the element; tinted stops are literal colors,
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
- **The canvas play flag.** Since 0.309.0 upstream reveals a selection
  through its metas (`selectionReveal`), so the package has no hook: the
  Animate Children and Convergence Field metas each set
  `selectionReveal: { type: "fixed", ancestor: "self", … }`, which gives the
  player the memory prop `data-ws-animation-can-play-on-canvas` (upstream's
  Navigator reads it for its icon) while it, or an instance inside it, is
  selected, and drops it when the selection leaves. A player nested in another
  is flagged with it, so both play. On the canvas an Animate Children plays
  only with that flag or its action's "Run on canvas" (`isPinned`), a
  Convergence Field only with the flag; preview and published pages ignore
  both. `canvas/organizeos-play-flag.test.ts` pins the flag for each player,
  and `metas.test.ts` that no other block sets a selection override.
- **The Motion tab**, the Inspector's third tab, after Style and Settings, with
  no tooltip of its own (`features/organizeos-panel/motion-tab.tsx`, mounting
  `Motion` from `motion.tsx`, presets in `motion/presets.ts`). It is offered as
  the rest of the OrganizeOS builder UI is, in design mode, on an HTML page;
  content mode, XML and text pages keep upstream's Settings only, and a stored
  `"motion"` falls back to Settings where the tab is not offered. Its target is
  the selected Animate Children, else the selection's parent if that is one,
  else the selection, which a preset wraps in a new one; the Body, the page root
  and Global Root are refused (the tab reads "Select a section"), and so, with a
  toast, are rich text and what the content model does not allow (an `li`, a
  `tr`, a Radix part: the wrapper counts as a `div`). The content model is
  checked in `motion.tsx` with the builder's own metas: the runtime's wrap
  checks against upstream's registry, which has no OrganizeOS metas. Reveal
  (fade and a 12px rise over `entry 0%` to `entry 60%`, fill `backwards`),
  Reveal staggered (the same, stagger 8) and Gentle parallax (24px each way over
  `cover`, fill `both`) are upstream view actions using only fields upstream's
  editor shows; each writes `action` and `stagger` in one undo step, staged and
  committed once (`executeStagedRuntimeMutation`, §7): a wrap is the runtime's
  `instances.wrap` and `instances.updateProps` on the new wrapper, and an
  existing wrapper takes `instances.updateProps` alone, replacing the designer's
  edits to the previous action. Without build access (a page template outside
  design mode) both are refused with the runtime's message, in one toast, and
  nothing is written (`motion.test.tsx` covers both paths). The Stagger field
  writes through `instances.updateProps` as well. With an Animate Children
  selected (a preset selects the wrapper it adds), the tab shows its Stagger
  field, 0 to 20 (the range is the Stagger label's tooltip, "0–20 %", a
  `FieldLabel` as the Animation editor's labels are), and below it upstream's
  Animation editor, upstream's `PropsSectionContainer` for the selection, only
  while a breakpoint is selected (it is undefined only in a project with no
  breakpoints, where upstream would render the whole props panel instead).
  Settings shows the same editor, and the two are never mounted together. With a
  child of an Animate Children selected, the presets act on the wrapper, and
  "Select Animate Children" selects it. The tab shows the presets and fields
  only: no line explaining what a preset does to the selection, and no note on
  where and when the motion plays. Tests check that the package's copies of
  upstream's "new animation" presets (`src/animate/__fixtures__/`, under
  0.309.0's sentence-case names) still equal upstream's files and that the
  Motion tab's presets equal the actions the player tests play.
- **The Wrap-in caveat.** The command panel's "Wrap in" group offers any
  component named `…:AnimateChildren`, so every org can wrap in one there,
  denied or not. Harmless: one with no animations plays nothing. The
  Motion presets themselves are behind the blocks' deny list. That wrap, like
  one through the API or MCP, is the runtime's alone, which checks the content
  model against upstream's registry, so there an Animate Children fits
  anywhere, an `li` included; only the Motion tab checks the builder's metas.
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
  repository, so `src/field/generate.ts` is a copy of the homepage's
  generator (`client/lib/marketing/convergence-field.ts`: `convergenceField`,
  `zoneDistance`, `LEVELS`, the types), verbatim but for line breaks (this
  repository's `oxfmt` wraps at 80 columns, OrganizeOS's Prettier at 100),
  plus the arm path, its centring offset, the arm transform and the fade level
  math from `client/components/marketing/convergence-field.tsx`, with a header
  naming the source commit. `src/field/__fixtures__/convergence-field.fixture.json`
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
- **No formatter touches the fixture.** The repository's `.oxfmtrc.json`
  lists it in `ignorePatterns`, which keeps `oxfmt` and the pre-commit hook
  off it: reformatting it would break the byte-for-byte comparison with
  OrganizeOS's copy (which OrganizeOS keeps out of Prettier through
  `client/.prettierignore`). Tests read the fixture with `readFileSync` and
  `JSON.parse`, never a JSON import, which would make the typecheck infer a
  huge literal type.
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
  loader already fetches for the block's own binding (scoped to its root and
  read by the root's `data`, so loaded while the block is on the open page),
  and makes no request of its own (Reload, below, asks that loader again).
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
- It is built on upstream's `useBindableControl` and
  `BindableExpressionControl`, as the select control is. A bound `record` is
  read-only in the picker, its label saying the value is controlled by an
  expression, and changes through the binding popover: upstream's model
  since 0.309.0 (the earlier override of a bound record in the builder is
  gone). A picker shows no field-error tooltip, as the select does not.

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
- **Links.** `attachShareCodeCarrier` carries the code on a click, a
  middle-click (`auxclick`, button 1) or a context menu (`contextmenu`: a
  right click, a long press or the keyboard's menu key) on a link to a
  platform page on the same host. It listens on each platform block's
  root, through `useShareCodeCarrier` (the two forms' `<form>`, and the
  **Share Code Carrier**, the root of the Event List and the Event Card), and
  on the document of every published page, through `PageShareCodeCarrier`,
  the package's page entry (`src/page.ts`), which the html route template
  mounts once (§8), so a designer's own link outside every block carries it
  too. The list, `platformPathPatterns`, is the platform's own: donate,
  fundraise, petitions, join, shop, cart, checkout and an event's page; the
  donor self-service pages, whose links carry a token from email, are not on
  it. The code is read at the event, and an event another handler cancelled
  is left alone. The carrier adds the code to the link's `href` unless the
  link already has an `r`, which it keeps. A plain click then has its default
  prevented and goes to that address by document (`navigateTo`), whether or
  not the `href` was rewritten, which keeps a client-side router out: a
  published link may route by its own `to`, not the DOM `href`, and would drop
  the code, even on a link an earlier Ctrl-click, middle-click or context
  menu, or the first click of a double-click, has already given its `r`.
  The platform's carrier follows the same rule, with the same middle-click and
  context menu (OrganizeOS-HQ/OrganizeOS#2234, plan
  `docs/superpowers/plans/2026-11-05-share-code-new-tab-gestures.md`). Any
  other click (a modifier key or another button, `target="_blank"`,
  `download`) follows the `href`. A middle-click and a context menu only add
  the code to the `href`, as a modified click does, and are never cancelled,
  so the browser opens the new tab or the menu with it. Every item of the
  menu uses it, "Copy link address" included (owner decision, 2026-11-05: the
  code is meant to be shared and is already in the page's address). Nothing
  stops an event's propagation, and a carrier inside another acts once: both
  listen in the capture phase, which reaches the document, then an outer
  root, before an inner one, so the outer carrier cancels a plain click and
  sends it by document before the inner one leaves it as cancelled, and gives
  any other click, middle-click or context menu its `r` before the inner one
  keeps it. A link therefore gets one `r`, and a click at most one
  navigation, however many carriers the page has. `navigateTo` does the same
  for an after-submit page that is a platform page. Nothing happens on the
  canvas or in the Preview.
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
template, `spike`, a fixture the catalog does not list; wave 1 adds the five
starter templates, listed 2026-11-01 (OrganizeOS plan
`docs/superpowers/plans/2026-10-31-website-templates-wave-1.md`).

- **The module format** (`types.ts`). A template is a folder under
  `src/site-templates/` whose `index.tsx` exports one `SiteTemplate`: `id`,
  `category` (one of nine; `CATEGORY_ORDER` is the chooser's order), `name`,
  `oneLine`, `styleTags`, `status` (`draft` or `listed`), `dependsOn`,
  `thumbnail` (a file name in `images`), `previewEventCover` (a file name in
  `images` that only the preview tool reads, as its sample events' first cover:
  a photo no page with an events block shows, which a template that places the
  cover card names; never applied to a site), `variables` (the six canonical
  values), `accent2` (optional: `"large-text"` when the template sets only large
  text in accent-2, which the check then holds to 3:1, not 4.5:1, on the base),
  `images` (by file name: `url` from a `?url&no-inline` import of the file in
  the template's `images/` folder, `sourceUrl`, `alt`), `fonts` (by file name, a
  `.woff2` file: `url` from a `?url&no-inline` import of the file in its
  `@fontsource` package, `family`, `licence`, `source`; Fonts, below) and
  `pages` (`key`, `name`, `path`, `title`, `description` and a `body` function).
  A body takes a `PageContext` (every page's id by key, assigned before any body
  renders, so a link is a page value that survives a rename; `placeBlock`;
  `image`, `backgroundImage` and `imageAlt` by file name) and returns fresh JSX
  rooted at `<ws.element ws:tag="body">`: `renderTemplate` keys instances by
  element identity, so a piece used twice (Nav, Footer, a card) is a function,
  never a constant. `renderSiteTemplate` (`render.ts`) renders every page into a
  fragment, with the placements it recorded; the caller supplies the page ids
  and the asset id of each image, and may read each body's JSX before it renders
  (`inspectBody`, as the check does). `catalog.ts` lists `SITE_TEMPLATES` (Field
  Journal in `nonprofit/field-journal/`, Porch Light in
  `community/porch-light/`, Workwear in `union/workwear/`, Marigold Marquee in
  `campaign/marigold-marquee/` and Riso Broadside in
  `single-issue/riso-broadside/`, all listed), and the chooser offers
  `listedTemplates()`, the `listed` ones in category order. Listing is the
  owner's call, made by changing `status` in a PR. Nothing the published site's
  copy reaches (`components.ts`, `metas.ts`) imports the folder
  (Shipping in published sites, below).
- **The canonical variables** (`canonical-variables.ts`): `--base`,
  `--accent-1`, `--accent-2`, `--text`, `--font-heading` and `--font-body`. The
  blank-start values are `#ffffff`, `#18181b`, `#2563eb` and `#18181b`, and
  `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for both fonts: the
  look the blocks had before the variables. They sit on Global Root's local
  style source at the base breakpoint, written by style key, so a second write
  replaces the first. Provisioning writes none (its update path writes content
  columns, not styles, and its seeds re-sync on every provision call). The file
  holds the names, the values, `contrastRatio` and `firstFontFamily` (the family
  a font value names first: `"Source Serif 4", Georgia, serif` reads
  `Source Serif 4`), and imports nothing from the catalog: the Style panel
  imports it alone, so the templates and their images stay out of the panel's
  chunk. The Background presets take their roles by these names when all four
  colours are there (Section backgrounds, above). It also names the two band
  variables (`BAND_VARIABLES`), which a band sets for what sits inside it, each
  to its text colour: `--focus-ring`, the colour of a focus ring, and
  `--accent-text`, the colour of a template's accent-2 text; unset, on the base,
  both are `--accent-2`, which the check holds against the base alone. The kit's
  `section()` sets both to `var(--base)` on an accent-1 or text band, and the
  Background presets' dark presets set them too; a base-coloured panel inside a
  band sets them back to `var(--accent-2)` (the check holds a template to that).
  The kit's `focusRing()` reads `var(--focus-ring, var(--accent-2))` and
  `ACCENT_TEXT` is `var(--accent-text, var(--accent-2))`, which a template's
  block tokens read for any text in accent-2: they are site-wide, so an events
  block an org places on a band later wears them there.
- **`placeBlock(key, placementId)`** (`place-block.ts`) is the only way a
  template places a platform block. `key` is the Components-panel key
  (`@organizeos/site-components:SignupForm`, `:RsvpForm`, `:EventList` or
  `:EventCard`). It returns a deep clone of the block's template whose root has
  the `ws:id` `placementId` and whose other `ws:id`s are
  `${placementId}:${wsId}`: the Event blocks fix ids (`events`, `empty`,
  `unavailable`) that the insert binds by, and two placements on one page would
  collide. A descendant with no `ws:id` is left to the renderer, and only
  `ws:id` and `children` are replaced, so a collection's parameter and the
  variables its expressions read stay the same objects, bound to each other.
  Each page has a placer of its own, which records every placement (key and root
  id) beside the page's fragment and throws on a `placementId` used twice.
  Nothing is written into the site to mark a block. This needs each block
  template to be a factory: `signupFormTemplate`, `rsvpFormTemplate` and
  `rotatingTabsTemplate` create their `Variable` inside the function, since
  `renderTemplate` scopes a data source by its `Variable`, and a block's
  `meta.template` is its factory called once, so the Components panel is
  unchanged. The insert completion (`completeOrganizeosFragment`) takes an
  `instanceIdPrefix`: a bind resolves to `${prefix}${wsId}`, and with a prefix a
  block whose root the fragment lacks is refused, not inserted unbound. An
  events block takes options, `placeBlock(key, placementId, { card, style })`,
  and a form block `{ heading, submit }`; one kind's options on the other kind's
  key is a type error: `card: "dated"` places the dated card (a date column of
  the month and the day number, in the tokens "OS Event Date" and "OS Event
  Day", beside the details, with no cover image) in place of the cover card,
  which stays the default and the Components panel's; `style` is local style on
  the block's root, replacing its declarations by key; `heading` and `submit`
  are the template's text for the form's heading and its submit button, in place
  of the block's own placeholders, set through the kit's `sample()`, so a
  bracketed placeholder in either keeps together.
- **Template block tokens.** `SiteTemplate.blockTokens` gives the template's
  look for the block tokens by name (`BlockTokenName`: "OS Form Heading", "OS
  Field", "OS Input", "OS Button", "OS Message", "OS Card", "OS Event Title",
  "OS Event Link", "OS Event Row", "OS Event Date", "OS Event Day", "OS Event
  Cover" and "OS Event Note"). Both cards' titles wear "OS Event Title" (the
  heading font) and their links "OS Event Link" (`--text`, underlined, 600, a
  44px tap target of padding that its margins take back, so the link takes only
  its lines of the card's height, however many); the dated card's row wears "OS
  Event Row"; the cover card's image wears "OS Event Cover" (a block the card's
  width at the image's own ratio, which a template crops with `aspect-ratio` and
  `object-fit`); and an events block's "No upcoming events" and "Events
  unavailable" lines wear "OS Event Note", which declares nothing (no colour:
  the lines inherit `--text`), so a template frames them. `renderSiteTemplate`
  merges each declaration into the page fragment's token of that name by key
  (one under a media query goes on the fragment's breakpoint for it, added when
  the page has none), never into the shared `token()` objects, and the apply
  routine writes the token so merged (the block's defaults with the template's
  look, as the pages carry it) whole over a token of that name the project
  already holds, which the insert's "ours" would keep as it stands: its
  declarations are replaced, so no old literal the template does not restate is
  left behind, and since the project is untouched the token is the seeded
  sign-up page's or an earlier insert's, not the org's own work.
- **Block tokens read the site variables.** "OS Input", "OS Button" and "OS
  Card" (`shared/form-tokens.ts`, `events/event-card.template.tsx`) take their
  background and text colours from `--base`, `--text` and `--accent-1`, and the
  focus ring from `--accent-2`, each as `var(--name, <the old literal>)`, so a
  site that defines none looks as it did. The focus ring is longhands: the
  shorthand resolves a `var()` that has a fallback to the fallback when it is
  parsed. The names are written out in those files, which do not import the
  module that lists them. The input's resting border is `--text` and the
  card's a `color-mix` of `--text` and `--base`, both as longhands. A project
  that already holds the old tokens keeps them: an insert
  resolves a token it already has with "ours". The Signup Form's and the RSVP
  Form's headings wear "OS Form Heading": `var(--font-heading)` (no fallback:
  on a site without the variable the declaration is invalid and the heading
  inherits, as before), so a template's form heading matches its own
  headings, at a line height of 1.2, so one that wraps on a phone sets as a
  heading, not at the body's; a template sets their case and size there.
- **The check** (`checkSiteTemplate` in `check.ts`, with `style-scan.ts`; run
  over every `SITE_TEMPLATES` entry and the spike fixture by `catalog.test.ts`)
  returns one readable line per violation, and an empty list for a template that
  passes. It is a backstop to review, not a replacement. It fails a template
  for: a page at `/newsletter` or at `/*` (the 404 page's), a page at a path the
  platform answers itself on the site's host (`PLATFORM_SERVED_PATHS` in
  `platform-paths.ts`, mirrored from the OrganizeOS repository's
  `public-route-allowlist.ts`, `org-host-route.ts` and `middleware.ts`: `/join`,
  `/donate`, `/events/<slug>`, `/auth`, `/org-profile` and the rest, prefixes by
  whole segment; below `/.well-known/`; and the static paths the middleware's
  matcher leaves to the platform, as `/fonts/`, `/sw.js`, `/favicon.ico` and a
  path ending in an image, font or sound extension outside `/assets/`; a test
  holds every `PLATFORM_PATHS` entry to one of them), a path the builder's page
  settings would refuse (`pagePath` from `@webstudio-is/sdk`), two pages on one
  path, or no Home (path `""`); a word on the neutrality deny list (party names
  and the like) in a title, a description, a text or a string prop; a
  `thumbnail`, or a `previewEventCover`, that is not a file in `images`; no
  `previewEventCover` in a template that places the events blocks' cover card,
  or one that a page with an events block shows (`findPageAssetIds`, as an Image
  or a background), which a preview would show twice; an image entry whose `url`
  is neither root-relative nor http(s) (a small file Vite inlines as a `data:`
  URL, which the routine cannot upload), or without a `sourceUrl` or alt text,
  or an image on the page's own elements that is not one of the template's
  images or has no alt text (an Image with no `src` is allowed: the builder
  draws its placeholder, the "put your image here" slot of spec decision 3); a
  font whose key is not a `.woff2` file name, whose `url` is neither
  root-relative nor http(s), with no `source`, with no licence or one other than
  `OFL-1.1` or `Apache-2.0`, or whose `family` neither font variable names first
  (a publish would leave it out), and a font variable whose first family is
  neither one of the template's fonts nor a system font (a generic family,
  `system-ui`, `-apple-system`, Georgia and the like); `--text` on `--base`, or
  `--base` on `--accent-1`, below 4.5:1, or `--accent-2` on `--base`, which
  draws the focus ring and the templates' small accent text, below 4.5:1, or
  below 3:1 for a template that declares `accent2: "large-text"` (it sets only
  large text in accent-2: 24px and up, or 18.66px and up in bold); and, per
  page, a root that is not one `<body>` element, a child of the body that is not
  a section labelled with a name from `SECTION_LABELS` (`sections.ts`: the
  spec's section vocabulary and its short forms, plus `Nav` and `Footer`, each
  alone or followed by a variant after a colon, as in `Hero: Split`, never by a
  colon alone), two Event Cards or Event Lists under one such section, a link to
  a page the template does not have (a mistyped `pageIds` key) or to an element
  of a page (applying gives the element a new id), a link by path (the `href` of
  any element: a React Router site renders an `a` element as its Link too) to
  anything but a route the platform serves (`PLATFORM_PATHS` in
  `platform-paths.ts`, `/donate`), or to one without `reloadDocument` (the
  published site's router has no route there; the kit's `linkProps` sets it), a
  panel with the base background inside a band (an element that sets a band
  variable to anything but `var(--accent-2)`, as the kit's band and a dark
  Background preset do) that does not set both band variables back to
  `var(--accent-2)` at the base breakpoint or at the one where it turns base (a
  link or a button is no panel: its own ring is drawn outside it, on the band),
  a Resource, a repeated instance id, a count of `h1` other than one, a Signup
  Form, RSVP Form or Share Code Carrier not placed with `placeBlock`, and, in
  styles on elements outside a placed block's subtree (a block's token used by
  the page's own element counts), in a placed block's root style and in
  `blockTokens`, a literal colour or colour keyword where a colour goes, a
  literal colour or a colour's name in unparsed text (a gradient, a
  `color-mix()`, a variable's fallback; a name counts as a whole word outside
  quoted strings), a variable outside the six and the two band variables, a band
  variable set to anything but a bare colour variable or read with no canonical
  colour as its fallback (as `var(--focus-ring, var(--accent-2))`), a
  declaration of one of the six (only Global Root declares them, from the
  template's variables), a `font-family` that is not `var(--font-heading)` or
  `var(--font-body)`, an image by URL, and a media query other than the
  project's own breakpoints (the base, and max-width 991, 767 and 479px): one
  with a condition (`(hover: none)`, `(prefers-reduced-motion: reduce)`, alone
  or beside a max-width), or with a min-width, read as the template wrote it,
  from each body's JSX before it renders (the render keeps a breakpoint's
  widths alone, so a condition would land on the base or on its width's
  breakpoint). Upstream `css()` drops `@media print`, non-px widths and
  `@supports` before any JSX exists, so the check cannot see them: a template
  must not write them;
  in `blockTokens`, a `color` of `var(--accent-2)` itself rather than through
  `--accent-text` (the kit's `ACCENT_TEXT`); and a `blockTokens` name no placed
  block wears.
- **The apply routine** (`apply-site-template.ts`) is one staged commit
  (`updateWebstudioDataStaged`, `staged-data.ts`), one undo step, with
  `contentMode: false` and `conflictResolution: "ours"` whatever mode the
  builder is in, so root styles, tokens and assets are written. It runs only on
  an untouched project with none of the six variables on Global Root: Home's
  body has no children, the only other pages are the 404 page (`/*`, which every
  project is created with) and the seeded sign-up page (`SIGNUP_PAGE_PATH`,
  `/newsletter`), and the project has no assets. The chooser checks this before
  it opens and the routine decides it again inside the transaction, since two
  admins can apply at once and a chooser left open goes stale (colours set after
  "Start blank" are never overwritten); it also refuses, writing nothing, when a
  template page's path is taken or a rendered page holds a Resource. It writes
  the template's six values over Global Root's, each page's body with its
  tokens, styles and assets (`insertWebstudioFragmentCopy`), and the page rows.
  Home keeps its row (id, name and path) and takes the template's body, title
  and description, its old empty body deleted with its local styles; a title or
  description already set on Home is overwritten, since an untouched project can
  have them; every other page is added at the root of the Pages tree; a link to
  the template's Home is remapped to the project's. The seeded `/newsletter`
  page is never replaced. Then each recorded placement gets the completion an
  insert runs (`completeOrganizeosFragment` with `instanceIdPrefix`
  `${rootId}:`, then `completeOrganizeosInsertMutable`), which binds the block
  to the org's data; a block it cannot bind (its Events Resource is gone) stays
  in place, unbound, and the chooser names it in an error toast. Where the
  runtime layer refuses the commit before it begins (a page template selected
  without build access), the apply is refused with the runtime's message
  (`reason: "runtime"`), writing and uploading nothing. "Start blank"
  (`startBlankMutable`) writes the blank-start values for any of the six that
  Global Root lacks and overwrites none, in one staged commit too.
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
  the variables set), the template's pages clash with the site's, the runtime's
  own message when it refuses the write, or, for a template holding a Resource
  or with no project open, that the template cannot be applied. **Drafts** are
  offered beside the listed templates only when the builder's URL carries
  `templateDrafts=1`, read once as the chooser mounts (the builder rewrites its
  URL on a page or mode change and drops it); that is how the owner reviews a
  draft in a test org.
- **Images.** A template's images are imported with `?url&no-inline`, so the
  builder's build bundles each one at a URL on the builder's own origin, never
  inlined as a `data:` URL (`assets.d.ts` declares only that form, for images
  and `woff2` fonts, so a bare `?url` import does not typecheck). The routine
  renders the pages with each image's asset id computed first, the SHA-256 of
  its URL, which is the id `uploadAssets` gives an upload by URL
  (`getSha256Hash` in `asset-utils.ts`), and uploads the images by URL
  (`uploadAssets("image", urls)`) only after the transaction returns an applied
  result: a page that cannot render, or a refusal, leaves no asset behind, which
  would make the project touched for good. It uploads only the images a rendered
  page shows (`findPageAssetIds` in the package's `render.ts`: an Image's asset,
  a background image, or an asset in any other prop or style; the check reads a
  page's images through it too, so the two agree), so a thumbnail or a
  `previewEventCover` no page shows leaves no unused asset; the preview's dump
  keeps the same ones. An id `uploadAssets` returns that differs from the
  computed one is logged; a failed upload is reported by the builder's own
  upload toast. The builder's server fetches the URL, so a deployment that
  protects its origin (a Vercel preview with Deployment Protection) answers with
  its login page and every image fails. The package's own lib build emits each
  image as a file of its own under `lib/`, which nothing in the builder reads
  (it resolves the `webstudio` export condition to `src/`). A template's image
  is a CC0 photograph, the builder's placeholder, or OrganizeOS's own work; the
  spike's two are generated by `__fixtures__/spike/images/generate.py`, recorded
  as their `sourceUrl`, `organizeos:generated/` and the script's path from
  `src/site-templates/`, which `catalog.test.ts` holds to a file that exists.
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
  keeps its name. A two-word weight ("Extra Bold", "Semi Bold") is one
  weight: both words go when it is the declared weight, and neither when it
  is not, so "Foo Extra Bold" at 700 keeps its name. It holds for every font
  uploaded, not only a template's, and it merges two kinds of family that
  were apart: a face named for its weight that declares it, as "Arial Black"
  at 900, is Arial at 900 beside Arial's other weights; and an optical-size
  cut ("Inter 18pt", "Inter 28pt") is the family without its size, so cuts
  of one weight upload as the same family and weight.
  `organizeos-font-family.test.ts` there holds every font file the approved
  direction board names to the family and weights it derives, and
  `bundled-fonts.node.test.ts` holds each template's `family` to the one
  derived from its file.
- **The kit** (`kit/`, which the templates import and the site-templates module
  does not export): the measurements and shared pieces every template is built
  from (OrganizeOS spec `2026-10-31-website-template-directions.md`, section 1),
  each piece a function that returns fresh JSX. `BREAKPOINT` (the project's
  three max-width queries), `SPACE`, `CONTAINER` and `container()`,
  `tapTarget()` (44px), `focusRing()` (2px at a 2px offset, in
  `var(--focus-ring, var(--accent-2))`) and `ACCENT_TEXT`; `section()`, a
  full-bleed section named for the Navigator in one of the checked colour pairs
  (its `background` option: base, accent-1 or text, a band setting the band
  variables to its text colour), whose `styles` add the template's own and throw
  on one that restates a declaration of the kit's, or that sets
  `background-color`, `background-image` or `color` at any breakpoint or state,
  which are the `background` option's; `nav()` (split or centered) and
  `footer()`; the links (`linkProps`, `textLink`, `buttonStyles`: a page by its
  key, an anchor, or a platform path with `reloadDocument`); `contentBlock()`,
  `keyed()` and `text()`; and `sample()`, which keeps a [bracketed] placeholder
  on one line with no-break spaces. The template's choices the kit draws with
  are its `KitStyle`: `buttonRadius`, `buttonWeight`, `headingWeight`,
  `headingCase`, `navNameSize` and `footerNameSize` (20px when unset). A weight
  the template does not set is never declared, so a single-weight face is never
  asked for a bold the browser would synthesize.
- **The preview tool**, `scripts/preview-site-template.mjs`
  (`corepack pnpm preview:template <id> [--palette <file>] [--no-events]`, or
  `<id> --thumbnail`), with its builder half in
  `features/organizeos-panel/site-templates/preview/`: it renders a template
  through the publish path and checks it against the phone bar (OrganizeOS spec
  section 2, rule 9). It is a local tool: CI runs the tests of its modules
  (`stub-api.node.test.ts`, `preview-arguments.node.test.ts`) and typechecks
  and lints the dump, never the tool.
  - The stub API (`stub-api.mjs`), on 127.0.0.1 at port 4599, which the dump
    writes into the bundle's Resources, answers the events read with three
    sample events: fixed dates in March 2027 in ascending order, in New York and
    in Los Angeles (one an evening that is the next day in UTC), bracketed
    titles and places, one online, the first with the template's
    `previewEventCover` as its cover (the spike's picture when it names none).
    Every other read, the forms' among them, gets `{"data": []}`, and
    `--no-events` empties the events read too: the blocks' empty state.
  - The dump (`dump.preview.tsx`, run by vitest in Node with
    `vitest.preview.config.ts`, a standalone config whose own `test` holds the
    dump alone, and never by the builder's projects) applies the template to a
    project as
    provisioning leaves it (`provisioned-project.ts`) through
    `applySiteTemplateMutable`, with ids as a counter so two dumps differ only
    in their palette, and writes the bundle the publish workflow syncs
    (`.webstudio/data.json`), the images the pages show and the fonts a style
    names (`public/assets/`), the pages' keys and paths (`preview-pages.json`),
    and the preview cover's file and the template's images folder
    (`preview-template.json`). `--palette <file>` applies a JSON file of the six
    canonical values (an example is in `palettes/`) in place of the template's
    own.
  - The site is built as the publish workflow builds it (the blocks package and
    the CLI first, then `webstudio build` for React Router on Vercel with
    `--no-assets`, `npm install` and `react-router build`) and served by
    `react-router-serve`. It needs Chromium: Playwright's own, else the newest
    build in `PLAYWRIGHT_BROWSERS_PATH`
    (`corepack pnpm exec playwright install chromium` installs one). Chromium
    takes a full-page screenshot of each page at 1440, 820, 390 and 320 wide,
    and checks, at 320, 390, 479, 767, 768, 820 and 991: sideways scroll, text
    under 14px, console errors,
    failed requests, and clipped text (a heuristic: text that runs past its own
    box or one around it).
  - It writes `previews/<id>/<run>/<page>-<width>.png` and `report.json`, which
    holds the events answer and, for each page, the overflow by width, the small
    and the clipped text, the console errors and the failed requests. The run is
    "default" or the palette file's name (lowercase letters, digits and hyphens:
    the run's folder is removed first), with ".no-events" after it for a
    `--no-events` run. It exits 0 when every check passes, 1 when one fails, 2
    when it cannot run, and 130 or 143 on SIGINT or SIGTERM, and stops its
    servers and browser and removes its temp folder however it ends.
  - `--thumbnail` takes neither `--palette` nor `--no-events`: it runs the same
    build with the template's own palette and the sample events and, in place of
    the checks, writes `images/thumbnail.jpg` into the template's folder, the
    chooser's picture of the template: the top of Home at 1440 wide, cropped to
    the chooser's 16:10 frame, drawn at 1600 by 1000 and saved as a JPEG under
    400 KB at the highest quality that fits (`THUMBNAIL` in `thumbnail.mjs`, a
    module that imports nothing, so a browser suite can read it, and which
    `preview-arguments.mjs` re-exports). Two runs write the same bytes, and
    nothing under `previews/` changes. Applying uploads only the images a page
    shows, so the thumbnail stays the chooser's alone.
- **Not yet run in a deployed builder.** The spike (OrganizeOS spec, section
  7, step 2) is `spike`, a Hero, two Events sections (one with an Event Card,
  one with an Event List), and a Sign-up section with a Signup Form, with
  Source Sans 3 as its bundled body font. It is a fixture, not in the catalog,
  so the chooser no longer offers it, even with `templateDrafts=1`. The run
  (apply a listed template to a test org, edit in Simple mode) follows the
  deploy. Until that report is in, the design's rules 3 and 4 (editable
  content in Content Blocks; platform blocks placed, never bound) are unproven
  in a real builder.

**Shipping in published sites**, `packages/cli/src/organizeos-components.ts`:

- A site never installs the package. Prebuild clears `app/__organizeos__/`
  with `app/__generated__/` and `app/routes/`, then copies the built
  `components.js` and `page.js` (the page entry every html route mounts, §8)
  and every module they reach through relative imports (static, re-exported
  and literal dynamic, parsed with acorn) into `app/__organizeos__/` with the
  package's `LICENSE` beside them (prebuild fails without the `LICENSE` or
  `page.js`). That closure never reaches `metas.js`, `templates.js` or the site
  templates (Site templates, above).
- Every published page also offers the fork's source in its head, as the
  license and code-repository links, and nowhere else (§1, owner decision of
  2026-11-07). A site published before the head links has neither them nor the
  `LICENSE` until it is republished, and one published while the visible Source
  link existed keeps that link until it is republished.
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
  missing build fails prebuild with the command that makes it. CI's cli leg
  and `pnpm checks` build the package before the CLI's tests; the publish
  workflow builds every package before it runs the CLI.
- A published site freezes the component code: a fix reaches an org's
  visitors when the org republishes.
- `packages/cli/src/asset-files.test.ts` ("removes temporary files when asset
  download fails") used to fail about one run in five, from a race between its
  temp-file cleanup and the write stream opening. Upstream 0.309.0 waits for
  the stream to close, and the fork's case "leaves no temporary file when many
  downloads fail at once" keeps it so (§7).

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
  must also be a fixed point of both repositories' formatters (OrganizeOS's
  Prettier and this fork's `oxfmt`, both at print width 80), so neither
  pre-commit hook changes a byte of either copy.
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
  Deleting the block does not remove that binding (the runtime's
  `instances.delete` drops only the bindings scoped to the instances it
  deletes, `getInstanceDeleteTargets`), and inserting
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
- **Share codes** are carried on a click, a middle-click or a context menu,
  after hydration, by every same-origin link to a platform page, and by the
  forms: not by a long press on iOS or iPadOS, whose Safari raises no
  `contextmenu` (WebKit bug 213953), nor by dragging a link to a tab, and not
  between the site's own pages. On iOS the page's own address still carries
  the code. Without JavaScript, or before hydration, nothing is
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
  code, not in a running builder. None of it was committed. The line numbers
  in this record are the spike's, on the fork's earlier upstream base (0.274).
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
  (`data-ws-id`, `data-ws-component`, `webstudio-component.tsx:616-635`) reached
  its root through the spread. The canvas renders nothing for a descendant
  (`webstudio-component.tsx:595` and 757), and the navigator and the settings
  panel special-case `ws:descendant` alone, never its parent's component
  (`navigator-tree.tsx:446`, `use-props-logic.ts:278`). The content-model check
  reads the meta's `children` list as it does for any component (since 0.309.0
  in project-build's `runtime/content-model.ts`). The RSVP Form's Guests, Shift
  Options and Questions already ship this way (above), which the spike confirms.
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
inline event handlers, and runs scripts in preview mode, so an embed one admin
writes could read the session of every co-admin who opens the page. That
exposure needs no publish. Spec (OrganizeOS repo):
`docs/superpowers/specs/2026-10-21-website-builder-org-script-off-design.md`.

**What is paused**, behind one switch:

- **HTML Embed**, and **Content Embed**, which is an HTML Embed whose `code` is
  usually a Resource's HTML.
- **Markdown Embed.** Before 0.309.0 its renderer kept `javascript:` links.
  Since 0.309.0 it sanitizes the HTML it renders (`sanitize-html`, in a
  runtime package that stays byte-identical), and it stays paused all the
  same, by owner decision D13 of the merge, until the pause lifts. Its canvas
  notice still gives the old reason, a link that could run script, which
  overstates it for 0.309.0's renderer; rewording it is a follow-up.
- **JSON-LD** (owner decision D13). It writes its code into a `script`
  element as raw HTML (`dangerouslySetInnerHTML`), so it stays unavailable:
  hidden from the Components panel and the command palette, and left out of
  every published page. On the canvas it renders as inert text, so its
  component stays.
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
- **An action that could run script or reach a host object**: crafted args, a
  code that reads a member or calls anything, or one that names its args where
  its component may pass a host object. See "Actions" below.
- **An element reference**: a parameter or an expression prop named `ref`
  (`isElementReference`). A variable holds plain data only, and such a prop
  would hand the element to what it names. The log line counts it as an
  element reference.
- **An instance of a component the published page does not import**, and one
  stored with the global root's id (`:root`), with what is inside it. Only the
  core components the generator writes itself (a Content Block's body among
  them) and those of upstream's base library, Radix and the OrganizeOS blocks
  ship. A form stored under an earlier name (`Form`, `NativeForm`) is read as
  the Resource Form or Webhook Form it publishes as.
- **A data source the page module cannot name as itself**: an id the builder
  never gives, one that is a component's or a Resource's, a name no data
  source may take (`reservedNames`, `String` among them), a parameter that is
  neither a page's own, on a root other than the global root's id, a
  Collection's item or key named only inside the Collection, nor a Resource
  Form's own form data or browser info (as upstream's
  `getManagedFormParameterBinding` binds them) on a form that a page other
  than an XML page reaches, named only on the form or inside it, and anything
  else a Collection binds as its item or key, or that a Collection with two
  props of one binding name binds. A parameter prop or an action that names
  one goes too, and so does a Collection's item or key that is not a
  parameter. A Content Block's own document (a parameter held on the block
  that only the block's own `document` prop names) goes as well, but is
  neither counted nor listed (`unlistedDataSourceIds`), as its author cannot
  change it.
- **An expression that could run script**, on a prop, a text child, a page
  setting or a Resource, or one that names a data source the published page
  does not declare where the expression is written. See "Expressions" below.
- **XML Node and XML Time on an HTML page**: a custom element that keeps every
  attribute.
- **Custom code** (Project settings > General), which 0.309.0 keeps in the
  project's settings (`projectSettings.meta.code`) and an older build in its
  pages' meta.
- **MDX content** (owner decision D7): a Content Block bound to a Markdown or
  MDX asset. Publishing turns its MDX into instances after the pause has run,
  where none of its rules reach them, so a build that holds one fails to
  publish, with a plain error (Prebuild, below). Filtering that content
  instead is a follow-up.

**The switch** is `orgScriptMayRun()` in `@organizeos/site-components/org-script`
(`packages/sdk-components-organizeos/src/org-script.ts`), a code constant that
returns `false`, read by the builder and the CLI alike. It is not an env var: an
env var has two homes (the builder's Vercel env and the publish workflow's) that
could disagree, and a missing or mistyped value could fail open. The publish
workflow reads it too, from the built package, fails unless it is off, and
reports it to OrganizeOS (Reporting to OrganizeOS, below), so turning it on also
edits that step. Turning
it on is one reviewed change that also edits its test (`org-script.test.ts`),
and only when all three hold:

- org sites are served from `{sub}.organizeos.io` and the old
  `{sub}.organizeos.org` hosts only redirect (step C2, `PUBLISHER_HOST=organizeos.io`);
- the platform session is host-only on `app.organizeos.org` (step D), with the
  old `.organizeos.org` cookies expired, the builder's included, so the canvas,
  which stays under `organizeos.org`, never receives it;
- the canvas no longer shares an origin with the builder's publish routes
  (upstream's `domain.publish` and `rest.organizeos-publish`), or those routes
  refuse a request that does not come from the builder's top document. Today
  canvas script could reach either route with the page's CSRF token, and the
  pause is what stops it; since a publish now puts the org's addresses live,
  lifting the pause must not reopen that.

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
cannot cancel that click: the carrier has already sent it by document. The
carriers never cancel a middle-click or a context menu, so a designer's
handler for those still decides them; the carrier has only set the link's
`href` first. Then this section moves to history.
The package builds the `org-script` entry, as every export of its
`package.json`, with upstream's `vite.sdk-components.config.ts`.

**Nothing is deleted.** The embeds and the custom code stay in the build and show
as paused, so reversal is the switch.

**Where it is enforced**: where code runs, not where it enters.

- **Components panel and command palette.** `withOrgScriptPolicy`
  (`apps/builder/app/canvas/organizeos-org-script.tsx`) wraps each library of
  upstream's registry where `canvas/canvas.tsx` registers them, in one marked
  loop, `withOrgScriptPolicy(withoutBuiltWithWebstudio(library))`. While the
  switch is off it gives the `HtmlEmbed`, `MarkdownEmbed` and `JsonLd` metas
  `category: "hidden"`, which the panel and the palette skip (the Navigator,
  their icons and labels are unchanged), leaves the Content Embed and Markdown
  Embed templates out, and registers the stand-ins below. Everything else, the
  registry's `componentIds` among it, passes through by reference.
- **Canvas.** `PausedHtmlEmbed` renders upstream's component only when the
  embed's `code` is a string identical to a template icon; otherwise it shows a
  notice where the embed is (its `ref` and `data-ws-*` props, `display: block`
  and padding, since the preset's `display: contents` would give it no box) and
  never puts `code` into the DOM: not in design, preview or safe mode, and not
  with "Run scripts on canvas" (the notice takes no `$ws$executeScripts`). It
  tests `typeof code === "string"` because upstream's component coerces whatever
  it gets with `String(code)`, so an array from a Resource holding markup, even
  an icon, would become markup. `PausedMarkdownEmbed` always shows the notice.
  The settings panel is unchanged: an embed's code stays editable, and the
  notice says it is paused.
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
  script inserted that way runs; any spelling but the exact `script` (`SCRIPT`)
  is created as a live element too. `/canvas` sends no `script-src` policy. And
  inside a link, an SVG `animate` or `set` sets the link's `href` by SMIL, past
  every attribute check, so a `javascript:` URL could reach a click in preview.
  So the canvas applies the rules publishing applies (`elementTagMayRender` in
  `org-script.ts`: a string that is exactly one of `tags`, the Tag control's
  list, as `elementTagMayRun` holds, and is not `animate` or `set`,
  `pausedSvgTags`) to every tag that can reach an element, whichever component
  holds it:

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

  The component that loses its tag renders its own default element. The marked
  changes in `webstudio-component.tsx` are the instance-tag gate and the two
  prop skips in `useInstanceProps`, the `div` fallback in each renderer, and
  `withoutPausedProps` in each renderer; `organizeos-org-script.props.test.tsx`
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
  `organizeos-org-script.wiring.node.test.ts` reads the source for the two
  skips and the two `div` fallbacks. `animateTransform` (a transform list only),
  `animateMotion` (a position on a path) and `mpath` cannot set an arbitrary
  attribute, and the canvas still makes them.

- **Unsafe values on the canvas.** `withoutPausedProps` (`org-script.ts`), at
  the seam the tag check already uses, in both renderers, on every prop the
  component receives, its own or passed in by a parent, given the instance: it
  drops what `withoutBlockedTagProps` drops, every `srcdoc`, every `on…` value
  that is not a function, every `ref`, and every address value that
  `urlValueMayRun` refuses, whatever its shape, with `data` decided by the
  instance's component and tag (Unsafe values, below). So an `iframe` with a `javascript:` `src` or
  a `srcdoc` no longer runs in the builder's origin, in design or preview mode.
  The canvas judges a bound address by the value it computes; publishing
  judges it by its fixed start, and the Publish dialog lists the difference.
  `organizeos-org-script.props.test.tsx` renders each case in both modes, and
  `organizeos-org-script.wiring.node.test.ts` pins the two calls.

- **Custom code field.** Read-only, with a sentence that says it is paused and
  kept (`section-general.tsx`, one marked branch). The saved code stays readable
  and copyable.
- **Builder panels.** The builder's panels never put an org's HTML, styles or
  values into the builder's own page as markup or code. The HTML Embed code
  check is upstream's `validateHtmlEmbedCode`, which reads the code with parse5
  in a template context. The navigator's CSS preview writes a style's
  text as text. The variable dialog reads a stored value as data
  (`readLiteralValue`). The Redirects list shows an address that may not run
  as text, and its form, its import and the redirect operations refuse one.
- **Publish dialog.** A banner after the plan-features banner and the MDX banner
  (below), headed "Paused, not published", lists each HTML Embed that will be
  dropped, each Markdown Embed, each JSON-LD, each element publishing drops for
  a tag the builder does not offer ("Element with an unsupported tag on
  {page}"), each instance of a component no published page imports ("Unknown
  component"), each instance stored with the global root's id ("Element with
  a reserved id"), each SVG `animate` or `set` element, each
  `dangerouslySetInnerHTML` prop, each unsafe value ("Link address (href)",
  "Form address (action)", "Source address (src)", "Object address (data)",
  "Frame document (srcdoc)", "Event handler attribute (onclick)", "Action
  (onClick)", "Element reference (ref)", "Collection item or key (item)", "XML
  element"), each data source with a conflicting id ("Variable (name)", on the instance it is scoped to, or alone for a global
  one, but not a Content Block's own document), each expression publishing
  leaves out ("Binding (title)", "Text binding", "Page setting (Title)", which
  opens that page's settings, "Resource (name)", which selects the element
  that holds its data source, and "Data source (name)", which selects the
  element it is scoped to), each page redirect to an unsafe address or that
  may not run ("Redirect on {page}", which opens that page's settings), each
  project redirect to one ("Redirect from {old} (Project settings)", which opens
  Redirects) and "Custom code (Project settings)", once, when the project's
  settings or the pages' meta hold any (a click selects the element or opens the
  settings), from `findPausedScript`
  (`features/publish/organizeos-publish-paused-script.ts`). A bound address that
  the canvas shows with a safe value is still listed, and dropped at publish,
  when its fixed start decides nothing. The tag items follow `classify` in the
  CLI, because the canvas only skips a bad `tag` or `data-ws-tag` prop and the
  element looks fine there, while publishing drops the element and everything
  inside it. An instance that goes is listed once, for its tag, and not again
  for its raw HTML property. The list judges as `dropOrgScript` does: an HTML
  Embed stays only when every `code` prop it has is a template icon, and nothing
  inside a dropped instance is listed, unless an instance that stays also shows
  it (a Fragment another Slot shows): no prop or variable of an instance that
  goes with one publishing drops. What is dropped is found across the whole
  build, as publishing reads it (a Content Block's templates and instances on no
  page included), while only what a page publishes is listed. A Content Block's
  templates container is not published, so the empty HTML Embed that upstream's
  core template puts in it is not listed (an embed a content editor inserted
  into the block is). The banner is its heading and the list, with no
  explanation (the builder's panels show options, not explanations); what the
  org saved is kept. Information only: Publish still runs. Nothing is listed when the switch is on, or when the
  site holds only template icons.

  The MDX banner, "Publishing fails while these use MDX:", lists each Content
  Block that makes publishing refuse the build (owner decision D7), as
  "Content Block on {page or template}", which selects it, or plain "Content
  Block" for one on no page (`findMdxBlocks`, by the CLI's rule). Publish to
  selected stays enabled. The builder does not load the content index that publishing
  also reads, so the list is a forecast that can miss a block publishing
  refuses, and never lists one it accepts.

  The plan banner above them (upstream's `getRestrictedFeatures`, with
  0.309.0's stores) leaves the org's data catalog out: a binding whose
  Resource is a catalog one (`isOrganizeosCatalogResourceId`) is no plan
  feature, since the platform provides the catalog, so an org whose plan has
  no `allowDynamicData` sees "Resource variable" only for a Resource of its
  own (decided in the 0.309.0 merge). The collections entitlement shows in
  the data tab's row menu instead.
- **Prebuild.** `dropOrgScript` (`packages/cli/src/organizeos-org-script.ts`) runs
  in one short marked hook in `prebuild.ts`, where the project bundle is read and
  before props are normalized, pages are walked, resources are collected and CSS
  is generated, so every later step sees a build without any of it, on every
  page and in every framework. It never changes its input. It first keeps one
  entry per id of the build's pages, page templates, instances, props, data
  sources and Resources, the last, as the builder reads a build, and leaves out
  the others and any entry stored under another id than its own, counted as
  duplicate entries, so the rules read every entry that publishes, and reads
  a form stored under an earlier name as the Resource Form or Webhook Form
  prebuild publishes it as (`migrateResourceFormInstancesMutable`, which
  prebuild runs after the drop). Then it drops:

  1. every instance whose component is `HtmlEmbed`, unless its `code` prop is a
     static string identical to a template icon. An embed whose `code` is an
     expression, a Resource or missing is dropped too (upstream's published
     `Placeholder` would print "Open the Settings panel to insert HTML code.");
  2. every `MarkdownEmbed`, whatever its code, and every `JsonLd`;
  3. every instance whose tag is set and is not in `tags` (`@webstudio-is/sdk`,
     the list the Tag control offers; the rule is `elementTagMayRun`, which the
     canvas shares), and every instance with a `data-ws-tag` or `tag` prop that
     is not a static string in `tags`, **whatever its component**, except a
     `ws:element` (where those props are plain attributes) and XML Node (which
     takes any tag name by design, and writes it with a suffix no HTML element
     has): `checksInstanceTag` and `checksTagProp` in `org-script.ts`.
     `ws:element` writes `<${instance.tag}>` into the page module. `Box`, `Text`
     and `Heading` read a `data-ws-tag` prop first and then a legacy `tag` prop,
     and Radix's `DialogTitle` renders `<Tag>` from its `tag` prop with no check
     at run time. The generator writes `instance.tag` as a `data-ws-tag` prop on
     every component but `ws:element`, and a user prop of either name like any
     attribute, so the props panel can set them. And Radix's triggers
     (`CollapsibleTrigger`, `DialogTrigger`, `PopoverTrigger`, `TooltipTrigger`,
     `NavigationMenuLink`, `NavigationMenuTrigger`) pass their own props on to
     the child they render (`asChild` with a spread, merged by Radix's Slot in
     the published page too), so a `data-ws-tag` on a trigger makes the element
     of a Box, Text or Heading inside it. Nothing can list the next component
     that does that, so the rule holds for all of them. The match is exact and
     case-sensitive. These components render their tag as an element, so a tag
     of `script` ships a `<script>` with its `src` or code, and a tag that is
     JSX syntax is written into the page module as code. An element dropped for
     its tag goes with everything inside it, so a trigger goes with its child.
     Only crafted content or the props panel reaches this: the Tag control and
     HTML paste offer `tags` only, but the sync server checks shape only, a
     pasted Webstudio fragment is checked against the same schema, and Webflow
     paste copies Webflow's own tag name into the legacy `Heading`, `Text` and
     `Box`. Queries 3 and 5 below show what is in use;
  4. every such element whose tag is exactly `animate` or `set`, whether it
     comes from `tag`, `data-ws-tag` or a `tag` prop, on any component the rule
     above covers;
  5. every `dangerouslySetInnerHTML` prop (`pausedPropNames`), of any type, on
     any instance. The instance stays, without the prop. Counted in the log
     line, except for the props of an instance that is dropped anyway;
  6. the site's custom code, from the project's settings
     (`build.projectSettings.meta.code`, which prebuild reads first) and from
     the pages' meta (`build.pages.meta.code`). `CustomCode` is still
     exported from the home page module, as an empty fragment, so `root.tsx`
     is unchanged;
  7. every prop `propMayShip` refuses (Unsafe values and Actions, below): an
     unsafe address, a `srcdoc`, an `on…` prop that is not an action, an
     action `actionMayRun` refuses and a Collection's item or key that is not
     a parameter. The instance stays, without the prop. An instance of a
     component the framework does not import (`componentMayShip`, given the
     components of the framework the build's template picks,
     `frameworkComponentsOf`, read from upstream's registry because 0.309.0
     makes the framework after the drop; prebuild then refuses the build if
     the framework does not import one of them, `assertFrameworkImports`) and
     one stored with the global root's id
     (`instanceIdMayRun`) go with everything inside them, counted as unknown
     components and as elements with a reserved id, and a data source
     `collidingDataSourceIds` lists goes, with every parameter prop that names
     it, counted as a variable with a conflicting id where a page declares it
     (but for a Content Block's own document, `unlistedDataSourceIds`); an
     action is judged without it;
  8. an XML Node or XML Time that an HTML or text page publishes, with
     everything inside it (one a Slot also shows on an XML page goes from
     both);
  9. a page redirect to an unsafe target, with the page's literal 3xx status,
     and a project redirect to one, the others kept in order. The bundle's
     pages are read once, in either pages shape, for the page roots, the walk
     of what HTML and text pages publish and the redirects;
  10. every expression, page setting and Resource that `findPausedExpressions`
      lists (Expressions, below).

  A dropped instance takes its `ws:descendant` children (and any children a
  crafted build gave it), its props and the data sources scoped to it with it,
  so a Resource that only it used is neither loaded by the page's loader nor
  written into its `.server.tsx`. An instance inside a Slot's shared Fragment is
  dropped once and so leaves every page that uses the Slot; what an instance
  that stays still holds stays. A global data source stays, and an instance
  stored with the global root's id (`:root`, which the builder only makes as a
  virtual instance) is dropped and counted; the canvas does not render one. A
  page root that would be dropped (only a crafted build has one) is emptied
  into a `Body` so the page builds. Styles are left as they are, because
  `generateCss` skips a selection whose instance is gone. A dropped embed
  leaves nothing behind: HTML Embed's preset is `display: contents`, so an
  unstyled one has no box of its own. The hook logs one line in the publish
  workflow's output, for support (what it left out, counted, the unsafe
  addresses, `srcdoc` and event handler attributes of the instances that stay,
  the XML elements on HTML pages and the redirects included). It counts what
  a page publishes, as the Publish dialog lists it: an instance on no page or
  on a page template only, and whatever sits only inside a Content Block's
  templates container (the generator writes nothing for it, and the core
  template puts an empty HTML Embed there), is left out of the build and not
  counted, so a site with nothing else logs no line; nor are the props and the
  data sources of an instance that goes. The runtime packages and the route
  templates are untouched by the hook, so `pnpm check:runtime-upstream` stays
  green and no fixture copy changes; XML pages answer sandboxed by a separate
  marked header in `xml.tsx` (§8).

  The same hook then refuses a build that would materialize MDX (owner
  decision D7): `refuseMdxWhilePaused`, on the bundle as synced, before any
  asset is read, throws "This site uses MDX content, which publishing does
  not support yet." (`mdxRefusal`) when a Content Block's `src` names a
  Markdown or MDX asset, or is any other source (an expression that could
  select one) while the project holds one. It counts every block, on a draft
  page or on none. An asset counts by its format or its name's extension, and
  a document of the content index by its extension or type. Prebuild turns
  such a block's MDX into instances after `dropOrgScript` has run, where none
  of the rules above reach them, so the build is refused rather than
  filtered, and the publish workflow reports it as failed (§5).
  `prebuild.test.ts` ("MDX content") and `organizeos-org-script.test.ts`
  cover it, and `packages/cli/src/commands/sync.test.ts` turns the pause off
  for upstream's own MDX cases.

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
hold an address (a page, an asset, a Resource, a number or a boolean) ships, an
action is held to its own rule (Actions, below), and an animation's
settings (`animationAction`, an object) are judged by their value, so the
OrganizeOS Animate Children keeps its `action`. `data` is an address only on
an `object`, so it is decided by its holder, never by the value's shape:
Collection, Signup Form and RSVP Form hold records in it, and on a
`ws:element` that is not an `object` it is a plain attribute, so they keep
it whatever it holds, and every other holder is held to the rule
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

**Actions.** While the switch is off an action runs on the canvas and ships in a
published site only when `actionMayRun` (`org-script.ts`) passes it, given the
build's instances, page roots and data sources. A component may call an action
without a click, so the rule does not rest on one. It lists args only on a prop
through which its component passes plain data (a form's `onStateChange` on
Resource Form, Webhook Form, Signup Form and RSVP Form, a Resource Form's
`onProgressChange` and `onResultChange`, and Rotation Control's `onValueChange`,
`plainDataActionProps`), names only variables and Resources in scope (the
holder's own, an ancestor's on every path from a page root, or a global one),
assigns only a variable, and assigns plain values: it reads no member, calls
nothing, holds no regular expression, no comment, no object keyed `__proto__`
and no `<` followed later by a `>`. On the canvas an action stores only plain
data in a variable. Its args are plain identifiers that are not reserved words,
each listed once, and none is a name a data source it reads could take; a code
that only sets a variable, to a value that does not name it, may share the
variable's name. Its code is one expression, read the same way as a statement,
that the expression linter passes, and the whole action passes input validation
(§7), so it reads neither `NaN` nor `Infinity`, assigns no arg and has no key
input validation refuses. An action that names a data source publishing leaves
out goes too, so what publishing keeps passes the input validation that prebuild
then runs (§7). A Collection's item or key is never an action. An empty action
and the templates' (a variable set to the component's argument) pass, also once
an org names the variable as the argument; an action that lists args elsewhere,
such as an `onClick` that sets a variable to its event, or that reads a member,
such as upstream's `x = event.target.value`, is left out and listed while the
switch is off. So is the result action of upstream's Form template, which reads
members of its argument: that form submits, and its state and progress actions
run, but its error message keeps its text while the switch is off. An instance a
page reaches is judged by the pages, and one only a page template reaches by the
template, so a template's action works while the template is edited, and the
canvas, publishing and the Publish dialog read the same context
(`actionContextOf`). The canvas gives an action input validation refuses a
handler that does nothing (§7), and then one `actionMayRun` refuses no function
(one marked guard in `getAction`, `shared/nano-states/props.ts`, after input
validation's, and one marked line in its `setVariable` that stores only plain
data, `isPlainData`), so the element renders without the handler; publishing
drops it whatever its name, on any instance and page, an XML page's included
(`propMayShip`, given the same context), the log line counts it as an unsafe
action, and the Publish dialog lists it as "Action (onClick)", and, for one
input validation refuses, does not dispatch (§7); it lists an unknown component,
an element with a reserved id and a variable with a conflicting id too. Query 8
below lists the action props it may leave out. Tests: `org-script.test.ts`,
`canvas/organizeos-org-script.props.test.tsx`,
`organizeos-org-script.unsafe-values.test.ts`, a `prebuild.test.ts` case, the
Publish dialog's `organizeos-publish-paused-script*.test.ts*` and
`shared/db/signup-form-preset.server.test.tsx` (the provisioned form's action).

**Expressions.** An expression is the stored text behind every binding: a
prop, a text child, `ws:show`, a Collection's `data`, `className`, a Resource's
url, search values, header values, body and email fields, and every page
setting. The canvas, the builder's panels and the builder's server (a form's
preview and a simulated submission) compute one, and publishing ships it in
the page and server modules a site runs. While the switch is off an expression is computed or published only
when `expressionMayRun` (`org-script.ts`) passes it:

- it is a non-empty string that is exactly one expression, with only
  whitespace around it, read the same way as a script and as a module; it
  holds no comment, anywhere (`holdsComment`), and no `<` or `<<` followed
  later by a token that starts with `>` (`holdsAngleBrackets`), as an action
  may not;
- `lintExpression` passes it without a diagnostic, given the data sources it
  names and `undefined`, `NaN` and `Infinity`;
- it holds only primitive literals (no regular expression or bigint), those
  three names and data-source names, templates without a tag, unary operators
  but `delete`, binary, logical and conditional operators, arrays and objects
  without a spread or a shorthand property, members and object keys the source
  fixes, and calls of the linter's 13 methods whose arguments are primitive
  literals or negative numbers;
- no member is `constructor`, `prototype`, `__proto__`, `__defineGetter__`,
  `__defineSetter__`, `__lookupGetter__` or `__lookupSetter__`, and no object
  key is `__proto__`, `valueOf`, `toLocaleString`, `toJSON`, `then` or one of
  the 13 method names;
- input validation (`checkValueExpression`, §7) passes it. Input validation
  is the outer layer: while the switch is off, what it refuses is left out
  and listed like the rest, and the build that ships passes it.

Publishing also holds each expression to the data sources the published module
declares where it is written: an expression may name only those
(`findPausedExpressions`, which `dropOrgScript` and the Publish dialog share,
and which holds the table for each module). A page holds what prebuild selects
for it: its root, present or not, and everything under it, but a subtree a
literal `ws:show` of false hides, and `:root`. It may name a data source it
does not hold. A page setting it publishes as text is held to input validation
alone.

Input validation passes every Resource the rule reads whole (`checkResource`:
a header name is a token). A data source or a Resource named like a module's
own name or a global it reads goes (`generatedModuleNames`,
`generatedCodeGlobals`), and so does a `resource` data source or prop whose
Resource the build does not hold. An expression, a page setting or a Resource
that names a data source that goes, for its id or name (above), with its
instance or with its Resource, goes too, until nothing more goes.
These run in one order, which `dropOrgScript` and the Publish dialog share
(`findPausedPublishing`): the data sources that go for their id or name, then
the expressions, then every action, judged against the data sources that ship
after both. What the rule refuses:

- **in the builder** has no value: one marked guard in `getCompiledExpression`
  (`packages/project-build/src/runtime/data.ts`, the one evaluator the
  canvas, the builder's panels and the builder's server share), after input
  validation's own check, compiles nothing for it, and one marked check in
  `evaluateExpressionSync` gives no function value for any expression; a
  caller that asks for errors (a form's preview or simulated submission) gets
  a fixed refusal. A prop or text is not set, `ws:show` falls back to shown, a
  Collection renders nothing, and a Resource's request goes without that part.
  The variable dialog runs no value: it reads one as data (`readLiteralValue`,
  "Builder panels" above). One difference from publishing stays: a binding
  that names a Collection's item outside its Collection may still show an
  item's value on the canvas, and is left out at publish;
- **at publish** is left out: an expression or parameter prop of any name, on
  any component and an XML page's included, goes, and so does a Collection's
  `item` or `itemKey` that is not a parameter of its own (above), or every one
  of them when it holds more than one, and the Collection then renders
  nothing; a text child becomes `undefined`; a page title becomes an empty
  string, a redirect goes with its literal 3xx status, and any other page
  setting or custom entry goes; a Resource goes whole, on every page, with its
  data sources and the resource props that name it, and a form that sends it
  then fails its submission; a data source goes, and so does what names it.
  The log line counts them as expressions, redirects, Resources and data
  sources. What no page publishes is read by input validation alone, and what
  it refuses goes, not counted and not listed: an expression or a text child
  of an instance no page reaches, that only a Content Block's templates or a
  hidden subtree hold, a prop a page never publishes, a Resource no page
  loads or no form sends, a page template's settings and a page's meta title.
  prebuild makes a Resource of a deprecated Webhook Form's static `action`
  after the pause runs; every part of it is a JSON literal, which
  `prebuild.test.ts` pins;
- **in the Publish dialog** is listed (above).

No writer or template on `main` writes anything the rule refuses: every block
template and site template, the registry's templates (the Form (Beta)
template and its email among them), the CMS item page, sitemap and list, the
block inserts, the email settings' defaults, a Content Block's bound source,
the asset query form, the provisioned signup form and the fixtures all pass,
and the builds of the blocks, the CMS item page and the collection list come
back from `dropOrgScript` unchanged. What it can refuse is typed by hand, old
or written by an agent: a comment, a call with an argument that is not a
literal or a negative number (`.includes($v)`), a regular expression, a
dynamic index (`list[$i]`), a spread, a shorthand property (`({$v})`),
`delete`, an object key `__proto__`, `valueOf`, `toLocaleString`, `toJSON`,
`then` or one of the 13 method names, an object key `constructor` or another
name a member may not read, a computed object key, a member key written as a
template, a header name that is not a token (`X Custom`), a name no data
source has (an unset variable a copy and paste left, or an asset query or a
Content Block source that names a route parameter or a variable by a bare
name), an element moved out of its Collection that still names the item, a
CMS field key `constructor` or `prototype`, a CMS collection named like one of
the modules' globals (`Map`), whose Resource goes, and a `<` followed later by
a `>` (`$v < 10 && $v > 0`; `$v > 0 && $v < 10` passes). It is a requirement of
guard level 1 (§5). Tests: `org-script.test.ts`,
`packages/project-build/src/runtime/data.organizeos.test.ts` (the evaluator,
a form's draft included), `canvas/organizeos-org-script.props.test.tsx`,
`canvas/organizeos-org-script.test.tsx` (every template and site template),
`canvas/organizeos-org-script.wiring.node.test.ts` (the evaluator's two
blocks, and every place the builder, its runtime, the sdk and the CLI run
text as code), the writers' tests (`collection-pages.test.ts`,
`collection-list.test.ts`, `insert-organizeos-block.test.tsx`,
`signup-form-preset.server.test.tsx`),
`organizeos-org-script.unsafe-values.test.ts`,
`organizeos-publish-paused-script.test.ts` and `prebuild.test.ts`, whose cases
hold every module they generate to declaring each name it reads, and read each
page of the fixtures and templates as prebuild publishes it.

**The generated modules.** While the switch is off, prebuild also checks each
page and server module it generates before writing it
(`packages/cli/src/organizeos-generated-code.ts`, one short marked hook in
`prebuild.ts`). The publish fails, naming the module, unless each generated
module reads no undeclared name, past the globals it may read
(`generatedCodeGlobals`: `Array`, `Error`, `Infinity`, `Map`, `NaN`,
`Number`, `Object` and `String`), and shadows no import. The check strips
types with TypeScript 5.8.2, which the CLI holds under its own name
(`typescript-5`; the CLI's own TypeScript 7 offers no compiler API for it).
The pause's rules keep an org's expressions and actions to what the module
declares; this check holds the generated code itself to the same, whatever a
generator changes. Every block template, every site template page, every
registry template and every fixture passes it. Tests:
`organizeos-generated-code.test.ts` and `prebuild.test.ts` ("checks every page
and server module it generates", the fixtures, the templates, and "fails the
publish of a module with …, without the pause's rules", one case for each
shape the pause's own rules leave out).

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
callback accepts) and runs the step's command against the built package;
CI's cli leg builds the blocks package, with the workspace packages it
imports, before the tests.

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
publishing may leave out for their value, query 7 the page and project
redirects it may leave out, and query 8 the actions it may leave out (all three
approximate: the CLI's rule is the authority). Run them before the unsafe values
rule and the actions rule deploy: what they list is what the next publish
leaves out.

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

-- 8. Actions in the dev builds that publishing may leave out while org script
--    is paused: an arg that is not a plain identifier, args listed on a prop
--    other than a form's onStateChange or Rotation Control's onValueChange, a
--    code that is not a variable set to a data source, an arg both its entry
--    and the last entry list, or a literal, an assignment to anything but a
--    variable, and a data source that is not a variable or a Resource of the
--    build. Approximate: it does not read scope, reserved words, a comment,
--    an arg listed twice or named as a data source it reads, a data source the
--    page module cannot name as itself, nor an action as a Collection's item
--    or key, so it misses those; and some codes the rule passes, such as
--    $x = !$x, are listed too. The CLI's rule is the authority.
select p.domain as subdomain, i->>'component' as component, pr->>'name' as prop,
       e->'args' as args, left(e->>'code', 80) as code_start, count(*) as props
from "Project" p
join "User" u on u.id = p."userId" and u.provider = 'organizeos-service'
join "Build" b on b."projectId" = p.id and b.deployment is null
cross join lateral jsonb_array_elements(b.props::jsonb) pr
join lateral jsonb_array_elements(b.instances::jsonb) i
  on i->>'id' = pr->>'instanceId'
cross join lateral jsonb_array_elements(pr->'value') e
cross join lateral (
  select substring(e->>'code' from '^\s*\$ws\$dataSource\$([A-Za-z0-9_]+) = ') as target,
         trim(substring(e->>'code' from '^\s*\$ws\$dataSource\$[A-Za-z0-9_]+ = (.*)$')) as value
) c
where p."isDeleted" = false
  and pr->>'type' = 'action'
  and (exists (select 1 from jsonb_array_elements_text(e->'args') a
               where a !~ '^[A-Za-z][A-Za-z0-9_]*$' or a in ('arguments', 'eval', 'undefined'))
       or (jsonb_array_length(e->'args') > 0
           and (i->>'component', pr->>'name') not in (
                 ('Form', 'onStateChange'),
                 ('@organizeos/site-components:SignupForm', 'onStateChange'),
                 ('@organizeos/site-components:RsvpForm', 'onStateChange'),
                 ('@organizeos/site-components:RotationControl', 'onValueChange')))
       or c.target is null
       or not (c.value ~ '^(\$ws\$dataSource\$[A-Za-z0-9_]+|"[^"\\]*"|-?(0|[1-9][0-9]*)(\.[0-9]+)?|true|false|null|undefined)$'
               or (e->'args' ? c.value and pr->'value'->-1->'args' ? c.value))
       or not exists (select 1 from jsonb_array_elements(b."dataSources"::jsonb) d
                      where d->>'id' = replace(c.target, '__DASH__', '-')
                        and d->>'type' = 'variable')
       or exists (select 1
                  from regexp_matches(e->>'code', '\$ws\$dataSource\$([A-Za-z0-9_]*)', 'g') m
                  where not exists (
                    select 1 from jsonb_array_elements(b."dataSources"::jsonb) d
                    where d->>'id' = replace(m[1], '__DASH__', '-')
                      and d->>'type' in ('variable', 'resource'))))
group by 1, 2, 3, 4, 5
order by props desc;
```

**Not covered by this pause.** Other ways an org's script can reach a page run
on the same hosts as HTML Embed (`{sub}.organizeos.org` once published, and the
builder canvas now). A follow-up design closes them before any Website goes live
on `{sub}.organizeos.org`, which the owner has allowed before C2: uploaded
HTML, SVG and XML assets
served from `/assets/` on the org host, which the OrganizeOS site proxy is to
answer sandboxed (the platform's one builder design, section 8.5). The others
are closed: `javascript:` URLs and `srcdoc`, which publishing leaves out and the
canvas drops in design and preview mode (Unsafe values, above), and an SVG
`animate` or `set` that sets a link's `href` to one, which neither publishing
nor the canvas makes (Tags on the canvas, above); expressions while paused
(Expressions, above); XML pages, which answer sandboxed (§8); XML Node in an HTML page, which publishing leaves
out; and expressions, actions and generated names, which pass input validation
before they are compiled or published, as does an instance's tag, whatever the
switch says, and every build write a client sends (patch requests, the
`commitBuildTransactions` routes and project import) passes the save check,
while the server's own provisioning writes generated values that are checked
at publish like every build (§7).

**Keeping it on upstream merges.** Eight upstream files carry a change, and
each has a test that fails if a merge takes it back:
`shared/nano-states/props.ts` gives an action `actionMayRun` refuses no
function and stores only plain data in a variable
(`organizeos-org-script.props.test.tsx`, "the canvas computes an action");
`canvas/elements.tsx` renders no instance stored with the global root's id
(the same file, "renders an instance stored with the global root's id");
`canvas/canvas.tsx` registers
every library of upstream's registry through `withOrgScriptPolicy`, in one loop,
and the OrganizeOS blocks after it (`organizeos-org-script.wiring.node.test.ts`,
which counts exactly two `registerComponentLibrary(` calls and no per-library
import); `webstudio-component.tsx` skips a paused prop and a tag the builder
does not offer, `animate` and `set` among them on the canvas, checks every prop
a component receives, its own and the ones a parent passes in, and falls back to
a `div` for a `ws:element` with such a tag
(`organizeos-org-script.props.test.tsx`, and
`organizeos-org-script.wiring.node.test.ts` for the two tag skips in
`useInstanceProps`, the two `div` fallbacks, which read `instanceTagMayRender`
(`elementTagMayRender` and input validation's tag rule), and the two renderer
calls, which are `withoutPausedProps`);
`section-general.tsx` holds the read-only branch (`section-general.test.tsx`);
`packages/project-build/src/runtime/data.ts` compiles no expression
`expressionMayRun` refuses and computes no function
(`data.organizeos.test.ts`, and `organizeos-org-script.wiring.node.test.ts`,
which also pins every place the source runs text as code, by file and count:
a merge that adds one fails there until it is sorted);
the `prebuild.ts` hooks run `dropOrgScript` with the framework's components,
and `refuseMdxWhilePaused`, and check that the framework imports every
component the drop may keep (`prebuild.test.ts`, "leaves an org's own script
out", "leaves unsafe values out" and "MDX content"), and check each generated
module (`prebuild.test.ts`, "checks every page and server module it
generates"); and `xml.tsx` answers an XML page sandboxed
(`prebuild.test.ts`, "an XML page answers with a sandbox policy and nosniff",
§8). A merge that adds or redraws a template icon fails the template test (add
the new string to `templateIconCodes`, keep the old one), and one that adds
another component using `dangerouslySetInnerHTML` to the runtime packages fails
a tripwire in `packages/cli/src/organizeos-org-script.test.ts`, which reads its
package list from `scripts/check-runtime-upstream.sh` (all fourteen) and knows
three users, `html-embed.tsx`, `markdown-embed.tsx` and `json-ld.tsx`, each of
which publishing leaves out: decide whether the new component joins the pause.
The same file reads the runtime packages' generated props, one exported props
object at a time (`dialog.props.ts` holds seven, so a `tag` prop on its
Description would not change the list of files), and fails when a component
other than Box, Text, Heading, Radix's DialogTitle and XML Node gains a `tag`
prop: the tag rule already covers it, because it holds `data-ws-tag` and `tag`
on every component but `ws:element` and XML Node, so decide whether it instead
takes any value by design, as XML Node does for an XML element name, and if so
add it to `anyTagComponents` (or publishing drops it). It also parses the
runtime packages' sources and fails when a component other than the six Radix
triggers renders a primitive with `asChild` and a spread of its props, or when
any file clones its children or uses `@radix-ui/react-slot` directly: that is a
component that passes its props on to a child, which is how a tag prop reaches a
Box. The new one needs no entry for the rule to cover it, but it joins
`triggerNames` in that test and `forwarders` in
`organizeos-org-script.props.test.tsx`, so both modes of the canvas and
publishing are shown to hold for it. The test reads those sources by stripping
their types with esbuild and parsing the rest with acorn and acorn-jsx: the
TypeScript 7 package the toolchain now installs has no compiler API. XML Node
takes any tag by design; it is category xml, and publishing leaves it out of an
HTML page. Six tripwires in
`packages/cli/src/organizeos-org-script.unsafe-values.test.ts` read the metas
the CLI registers and fail on a change that needs a decision under Unsafe
values and Actions: a new component of category xml joins `xmlComponents`; a
new component with a `data` prop holds records, and joins
`recordDataComponents`, or publishing holds its `data` to the rule; a new meta
prop named `on…` that is not an action gets a decision, since publishing drops
it; a new attribute rename that is an address, `srcdoc` or `on…` name joins
the rule, which must read both names alike; a component of
`plainDataActionProps` that is renamed or no longer registered gets a
decision, since its action would be left out while the switch is off; and a
library the react-router framework adds or drops changes
`publishedComponents`, which the Publish dialog mirrors (its own
`publishedComponents`), and a template that inserts a component no published
page imports fails `canvas/organizeos-org-script.test.tsx`. Since 0.309.0 the canvas computes prop values asynchronously, so a
test that mounts its renderers waits for them before it asserts (`settleProps`
in `organizeos-org-script.props.test.tsx`): otherwise a check that something is
absent passes for nothing.

**Fixtures.** `pnpm checks` no longer runs `pnpm fixtures`, which syncs
`fixtures/webstudio-features` from upstream's development builder (Webstudio's
infrastructure) and rebuilds it with this fork's CLI, and fork CI never ran it.
Run by hand, it leaves a diff in the committed `app/__generated__`: that project
holds 5 HTML Embeds (and custom code) in its `.webstudio/data.json`, so the
`[expressions]`, `[radix]` and `[resources]` pages, which hold the embeds, and
`_index.tsx`, which holds `CustomCode`, change. Do not commit it, because the
fixtures stay upstream's: run `git checkout -- fixtures` afterwards, and when
finishing an upstream merge stage by path, never with `git add -A`.
