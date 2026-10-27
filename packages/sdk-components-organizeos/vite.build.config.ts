import { mergeConfig } from "vite";
import sdkComponentsConfig from "../../vite.sdk-components.config";

// OrganizeOS fork: the shared config's entries are fixed (components, metas,
// hooks, templates), which keeps the root config upstream's. This package adds
// two:
// - org-script, the switch the builder and the CLI both read. It is not
//   imported by components, so a published site's copy of the package does
//   not carry it (packages/cli/src/organizeos-components.ts).
// - page, what a published page mounts once from the html route template (the
//   page's share-code carrier). The CLI copies it into every site beside
//   components.
//
// Not named vite.config.ts: Vitest picks up the nearest vite.config.ts, which
// would replace the root vitest.config.ts that resolves the "webstudio"
// condition for the package's tests.
export default mergeConfig(sdkComponentsConfig, {
  build: { lib: { entry: ["src/org-script.ts", "src/page.ts"] } },
});
