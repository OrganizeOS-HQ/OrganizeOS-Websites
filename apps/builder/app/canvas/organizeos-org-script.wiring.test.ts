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
//
// The same goes for the tag checks in webstudio-component.tsx. The check on the
// props a parent passes in is pinned by a render test (the props test), and
// the check on the instance's own props overlaps it, so only the two together
// keep a script off the canvas. A render test cannot tell when one of them is
// gone, so the second is read here.

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const canvas = withoutComments(
  readFileSync(fileURLToPath(new URL("./canvas.tsx", import.meta.url)), "utf8")
);

const webstudioComponent = withoutComments(
  readFileSync(
    fileURLToPath(
      new URL(
        "./features/webstudio-component/webstudio-component.tsx",
        import.meta.url
      )
    ),
    "utf8"
  )
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

test("useInstanceProps skips a data-ws-tag or tag prop that the builder does not offer", () => {
  expect(webstudioComponent).toMatch(
    /checksTagProp\(instance\?\.component \?\? "", name\) &&\s*elementTagMayRun\(value\) === false/
  );
});

test("useInstanceProps passes the instance's own tag on only when the builder offers it", () => {
  expect(webstudioComponent).toMatch(
    /tag !== undefined && elementTagMayRun\(tag\)/
  );
});
