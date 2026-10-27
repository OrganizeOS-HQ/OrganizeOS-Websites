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

test("useInstanceProps skips a data-ws-tag or tag prop that the canvas may not render", () => {
  expect(webstudioComponent).toMatch(
    /checksTagProp\(instance\?\.component \?\? "", name\) &&\s*elementTagMayRender\(value\) === false/
  );
});

test("useInstanceProps passes the instance's own tag on only when the canvas may render it", () => {
  expect(webstudioComponent).toMatch(
    /tag !== undefined && elementTagMayRender\(tag\)/
  );
});

// The canvas makes no element whose tag the builder does not offer, nor an SVG
// animate or set (a SMIL animate can set a link's href to a javascript: URL):
// both renderers fall back to a div for a ws:element with such a tag, with the
// rule that also holds the tag props (elementTagMayRender, not
// elementTagMayRun, which lets animate and set through)
test("both renderers fall back to a div for a ws:element whose tag the canvas may not render", () => {
  const preview = webstudioComponent.indexOf(
    "export const WebstudioComponentPreview"
  );
  const fallback =
    /if \(elementTagMayRender\(Component\) === false\) \{\s*Component = "div";\s*\}/g;
  expect(webstudioComponent.slice(0, preview).match(fallback)).toHaveLength(1);
  expect(webstudioComponent.slice(preview).match(fallback)).toHaveLength(1);
  expect(webstudioComponent).not.toMatch(/elementTagMayRun\(/);
});

// An unsafe address, a srcdoc or an event handler can reach a component from
// its own props or from a parent's (a Radix trigger), so each renderer checks
// what it receives, after the two are merged, by the instance's component and
// tag. A render test shows that nothing unsafe reached the canvas, not which
// renderer checked it.
test("both renderers check every prop a component receives with withoutPausedProps", () => {
  const preview = webstudioComponent.indexOf(
    "export const WebstudioComponentPreview"
  );
  expect(preview).toBeGreaterThan(0);
  const call =
    /withoutPausedProps\(\s*instance,\s*mergeProps\(restProps, instanceProps, "(?:delete|merge)"\)\s*\)/g;
  const canvasRenderer = webstudioComponent.slice(0, preview);
  const previewRenderer = webstudioComponent.slice(preview);
  expect(canvasRenderer.match(call)).toHaveLength(1);
  expect(previewRenderer.match(call)).toHaveLength(1);
  expect(webstudioComponent.match(/withoutPausedProps\(/g)).toHaveLength(2);
  expect(webstudioComponent).not.toContain("withoutBlockedTagProps(");
});
