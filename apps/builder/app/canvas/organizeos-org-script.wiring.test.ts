/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// What the canvas registers is what the Components panel, the command palette
// and the canvas show. This reads the source, the way the frame protection
// test reads the routes: an upstream merge that takes the line back, and with
// it the pause, fails here instead of going unseen.

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const canvas = withoutComments(
  readFileSync(fileURLToPath(new URL("./canvas.tsx", import.meta.url)), "utf8")
);

test("the canvas registers upstream's base library through withOrgScriptPolicy", () => {
  expect(canvas).toMatch(
    /registerComponentLibrary\(\s*withOrgScriptPolicy\(\s*\{[^}]*\bcomponents:\s*baseComponents\b[^}]*\}\s*\)\s*\)/
  );
});

test("the canvas imports it from the OrganizeOS module", () => {
  expect(canvas).toMatch(
    /import\s*\{\s*withOrgScriptPolicy\s*\}\s*from\s*"\.\/organizeos-org-script"/
  );
});
