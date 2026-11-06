import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import builderConfig from "../../../../../../vitest.config";

// The preview tool's dump (dump.preview.tsx), run only by
// scripts/preview-site-template.mjs. It takes the builder's resolve (the `~`
// alias and the `webstudio` condition) and ssr settings, but not its `test`:
// that is a workspace of projects, which would run every builder suite and
// never this file. The dump reads and writes files, so it runs in Node.

/** apps/builder, which the builder's own config resolves `~` against. */
const root = fileURLToPath(new URL("../../../../../../", import.meta.url));

/** The design system's colour picker imports this web component for its side
 * effects, which need a browser (CSS, CSSStyleSheet, a canvas) on import. The
 * dump renders no UI, so it gets an empty module. */
const colorInput = "hdr-color-input";
const emptyColorInput = "\0preview-empty-color-input";

const { test: _builderTest, ...shared } = builderConfig;

export default defineConfig({
  ...shared,
  root,
  plugins: [
    {
      name: "preview-empty-color-input",
      enforce: "pre",
      resolveId: (id) => (id === colorInput ? emptyColorInput : undefined),
      load: (id) => (id === emptyColorInput ? "export {};" : undefined),
    },
  ],
  test: {
    include: [
      "app/builder/features/organizeos-panel/site-templates/preview/dump.preview.tsx",
    ],
    environment: "node",
    // the dump maps each `?url` import back to its file against the root
    env: { PREVIEW_VITEST_ROOT: root },
  },
});
