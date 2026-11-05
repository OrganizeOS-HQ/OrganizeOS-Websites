import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * OrganizeOS plans are org entitlements resolved by OrganizeOS, never a
 * checkout in the builder (branding.ts, owner decision D4). So no shipped
 * builder or design-system file links Webstudio's pricing page or names a
 * Webstudio plan; a plan-gated control says `planBadgeLabel` and
 * `planUpgradeHint` instead. Upstream merges bring such copy back, and this
 * fails on it with each file and line.
 */
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const isShipped = (path: string) =>
  /\.(ts|tsx)$/.test(path) &&
  /\.(test|spec)\.[^/]+$/.test(path) === false &&
  path.endsWith(".stories.tsx") === false &&
  /(^|\/)(__generated__|__fixtures__|node_modules)\//.test(path) === false;

const listFiles = (directory: string): string[] =>
  readdirSync(join(repositoryRoot, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "node_modules" ? [] : listFiles(path);
      }
      return isShipped(path) ? [path] : [];
    }
  );

/**
 * Comments go, and so do their characters, but not their line breaks, so a
 * hit's line is the line in the file.
 */
const stripComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

const findHits = (directories: string[], patterns: RegExp[]) =>
  directories.flatMap((directory) =>
    listFiles(directory).flatMap((path) => {
      const source = stripComments(
        readFileSync(join(repositoryRoot, path), "utf8")
      );
      return patterns.flatMap((pattern) =>
        Array.from(
          source.matchAll(new RegExp(pattern.source, `${pattern.flags}g`)),
          (match) => {
            const line = source.slice(0, match.index).split("\n").length;
            return `${relative(repositoryRoot, join(repositoryRoot, path))}:${line} ${match[0]}`;
          }
        )
      );
    })
  );

const builderTrees = ["apps/builder/app", "packages/design-system/src"];

describe("the builder sells no Webstudio plan", () => {
  test("no shipped builder file links webstudio.is/pricing", () => {
    expect(findHits(builderTrees, [/webstudio\.is\/pricing/])).toEqual([]);
  });

  test("no shipped builder file names a Webstudio plan", () => {
    expect(
      findHits(
        [...builderTrees, "packages/project-build/src"],
        [
          /Webstudio\s+Cloud/,
          /Upgrade to PRO/i,
          /must have a Pro plan/,
          /Pro feature/,
          /\brequires? Pro\b/,
          /<(Pro)?Chip>\s*Pro\s*<\/(Pro)?Chip>/,
        ]
      )
    ).toEqual([]);
  });

  test("the guard reads the trees it names and finds what it looks for", () => {
    // a guard that reads nothing passes for nothing
    expect(listFiles("apps/builder/app")).toContain(
      "apps/builder/app/shared/branding.ts"
    );
    expect(listFiles("packages/design-system/src")).toContain(
      "packages/design-system/src/components/pro-chip.tsx"
    );
    expect(listFiles("apps/builder/app")).not.toContain(
      "apps/builder/app/shared/branding.node.test.ts"
    );
    expect(
      stripComments('a\n/* Pro feature\n */ b // Upgrade to PRO\n"https://x"')
    ).toBe('a\n\n b \n"https://x"');
  });
});
