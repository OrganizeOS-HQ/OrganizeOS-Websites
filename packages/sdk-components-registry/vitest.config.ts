/** Matches Builder component resolution. */
import { defineConfig } from "vitest/config";

// OrganizeOS fork: "webstudio" only. Upstream adds "webstudio-private" when the
// animation package's private sources are checked out; that package is
// proprietary and removed from the fork (docs/ORGANIZEOS-FORK.md section 2).
const conditions = ["webstudio"];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
});
