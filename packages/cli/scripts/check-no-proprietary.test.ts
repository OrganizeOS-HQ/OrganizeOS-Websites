/**
 * OrganizeOS: self-test for scripts/check-no-proprietary.sh, the guard that
 * keeps the EULA-proprietary animation package out of everything the fork
 * ships (docs/ORGANIZEOS-FORK.md section 2, owner decision D6). Each case runs
 * the real script in a temporary tree that holds one planted violation.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../../../scripts/check-no-proprietary.sh", import.meta.url)
);

// Assembled from parts, so that this file passes the check it tests.
const packageName = ["@webstudio-is", "sdk-components-animation"].join("/");
const banner = ["LicenseRef-Webstudio", "Inc-Proprietary"].join(",");

let root: string;

const write = async (path: string, content: string) => {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
};

const writeJson = async (path: string, value: unknown) =>
  await write(path, `${JSON.stringify(value, undefined, 2)}\n`);

const runCheck = async () =>
  await execFileAsync("bash", [join(root, "scripts/check-no-proprietary.sh")]);

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "organizeos-no-proprietary-"));
  await write(
    "scripts/check-no-proprietary.sh",
    await readFile(scriptPath, "utf8")
  );
  await writeJson("package.json", { name: "webstudio-root", private: true });
  await write(
    "pnpm-lock.yaml",
    "lockfileVersion: '9.0'\n\nimporters:\n\n  packages/sdk-components-registry:\n"
  );
  await writeJson("apps/builder/package.json", {
    name: "@webstudio-is/builder",
    dependencies: { "@webstudio-is/sdk-components-registry": "workspace:*" },
  });
  await write(
    "packages/sdk-components-registry/src/shared.ts",
    'import * as radixMetas from "@webstudio-is/sdk-components-react-radix/metas";\n'
  );
  await writeJson("packages/cli/templates/react-router/package.json", {
    dependencies: { "@webstudio-is/sdk": "0.0.0-webstudio-version" },
  });
  await writeJson("fixtures/react-router-vercel/package.json", {
    dependencies: { "@webstudio-is/sdk": "workspace:*" },
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("passes when the package appears only in prose and test names", async () => {
  await write(
    "docs/ORGANIZEOS-FORK.md",
    `The upstream \`${packageName}\` package is EULA-proprietary.\n`
  );
  await write(
    "packages/project-build/src/mcp.test.ts",
    [
      `// ${packageName} is not part of this fork.`,
      `const component = "${packageName}:AnimateChildren";`,
      `test("rejects ${packageName}:AnimateText", () => {});`,
      "",
    ].join("\n")
  );
  await write(
    "packages/cli/src/docs.generated.ts",
    `export const docs = "webstudio components.get '{\\"component\\":\\"${packageName}:AnimateText\\"}'";\n`
  );

  await expect(runCheck()).resolves.toMatchObject({
    stdout: expect.stringContaining("OK"),
  });
});

test.each([
  {
    path: "packages/sdk-components-registry/src/shared.ts",
    source: `import * as animationMetas from "${packageName}/metas";`,
  },
  {
    path: "apps/builder/app/canvas/canvas.tsx",
    source: `import { AnimateChildren } from '${packageName}';`,
  },
  {
    path: "packages/sdk-components-registry/src/index.ts",
    source: `export * from "${packageName}/components";`,
  },
  {
    path: "packages/cli/src/framework-react-router.ts",
    source: `const animation = await import("${packageName}/templates");`,
  },
  {
    path: "apps/builder/app/shared/load.ts",
    source: "const animation = await import(`" + packageName + "`);",
  },
  {
    path: "packages/cli/src/load.cjs",
    source: `const animation = require("${packageName}");`,
  },
  {
    path: "apps/builder/app/side-effect.ts",
    source: `import "${packageName}";`,
  },
  {
    // The registry's import source becomes the import in every generated site.
    path: "packages/sdk-components-registry/src/namespaces.ts",
    source: `export const animationComponentNamespace =\n  "${packageName}";`,
  },
  {
    path: "packages/sdk-components-registry/tsconfig.json",
    source: JSON.stringify({
      compilerOptions: { paths: { [packageName]: ["../animation/src"] } },
    }),
  },
])("fails on a module specifier in $path", async ({ path, source }) => {
  await write(path, `${source}\n`);

  await expect(runCheck()).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining(path),
  });
});

test("fails when the package directory exists", async () => {
  await write("packages/sdk-components-animation/README.md", "# Animation\n");

  await expect(runCheck()).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining("packages/sdk-components-animation"),
  });
});

test.each([
  "package.json",
  "apps/builder/package.json",
  "packages/sdk-components-registry/package.json",
  // A template that lists it makes every published site install it from npm.
  "packages/cli/templates/react-router/package.json",
  "packages/cli/templates/defaults/package.json",
  "fixtures/react-router-vercel/package.json",
  "fixtures/webstudio-features/package.json",
])("fails when %s lists the package", async (path) => {
  await writeJson(path, { dependencies: { [packageName]: "workspace:*" } });

  await expect(runCheck()).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining(path),
  });
});

test("fails when the lockfile has an entry for the package", async () => {
  await write(
    "pnpm-lock.yaml",
    [
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  packages/sdk-components-registry:",
      "    dependencies:",
      `      '${packageName}':`,
      "        specifier: workspace:*",
      "        version: link:../sdk-components-animation",
      "",
    ].join("\n")
  );

  await expect(runCheck()).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining("pnpm-lock.yaml"),
  });
});

test("fails when .gitmodules points at the package", async () => {
  await write(
    ".gitmodules",
    '[submodule "packages/sdk-components-animation/private-src"]\n'
  );

  await expect(runCheck()).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining(".gitmodules"),
  });
});

test("fails when the EULA banner appears in a shipped file", async () => {
  await write(
    "packages/cli/templates/react-router/app/animation.ts",
    `// SPDX-License-Identifier: ${banner}\n`
  );

  await expect(runCheck()).rejects.toMatchObject({
    code: 1,
    stderr: expect.stringContaining(
      "packages/cli/templates/react-router/app/animation.ts"
    ),
  });
});
