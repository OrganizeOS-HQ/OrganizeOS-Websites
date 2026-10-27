import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const srcDir = fileURLToPath(new URL(".", import.meta.url));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });

// The blocks render what the platform sends as React elements, never as
// markup (OrganizeOS design 2026-10-26-cms-in-the-builder section 4.7). The
// one source that names the prop is org-script.ts, the org-script pause's
// list of props it keeps off every component; tests are left out.
test("no source in the package uses dangerouslySetInnerHTML, but the org-script pause that names it", () => {
  const files = sourceFiles(srcDir).map((path) => relative(srcDir, path));
  expect(files).toContain(join("rich-text", "rich-text.tsx"));
  expect(files).toContain("org-script.ts");
  const naming = files.filter(
    (path) =>
      /\.test\.tsx?$/.test(path) === false &&
      readFileSync(join(srcDir, path), "utf8").includes(
        "dangerouslySetInnerHTML"
      )
  );
  expect(naming).toEqual(["org-script.ts"]);
});
