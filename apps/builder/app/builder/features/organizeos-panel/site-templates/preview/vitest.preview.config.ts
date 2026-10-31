import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import builderConfig from "../../../../../../vitest.config";

// The preview tool's dump (dump.preview.tsx), run only by
// scripts/preview-site-template.mjs: the builder's test config with the dump as
// its only file. The default run's `*.test.*` include never picks it up.

/** apps/builder, which the builder's own config resolves `~` against. */
const root = fileURLToPath(new URL("../../../../../../", import.meta.url));

export default mergeConfig(
  builderConfig,
  defineConfig({
    root,
    test: {
      include: [
        "app/builder/features/organizeos-panel/site-templates/preview/dump.preview.tsx",
      ],
      // the dump maps each `?url` import back to its file against the root
      env: { PREVIEW_VITEST_ROOT: root },
    },
  })
);
