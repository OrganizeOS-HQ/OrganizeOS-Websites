import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// What the canvas registers is what the Components panel, the command palette
// and the canvas show. This reads the source, the way the frame protection
// test reads the routes: an upstream merge that takes the line back, and with
// it the pause, fails here instead of going unseen. A *.node.test.ts, so it
// runs in Node (core-server), where it can read the files.
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

// 0.309.0 registers every library of the registry in one loop
// (canvasComponentLibraries: core, base and Radix), so the pause wraps each
test("the canvas registers every registry library through withOrgScriptPolicy, without the badge", () => {
  expect(canvas).toMatch(
    /for\s*\(\s*const\s+library\s+of\s+canvasComponentLibraries\s*\)\s*\{\s*registerComponentLibrary\(\s*withOrgScriptPolicy\(\s*withoutBuiltWithWebstudio\(\s*library\s*\)\s*\)\s*\);?\s*\}/
  );
  // the loop and the OrganizeOS blocks, and no other registration
  expect(canvas.match(/registerComponentLibrary\(/g)).toHaveLength(2);
  // no per-library import that could be registered past the policy
  expect(canvas).not.toMatch(
    /@webstudio-is\/sdk-components-react(-radix)?["/]/
  );
});

test("the canvas registers the OrganizeOS blocks after the loop, with no hooks", () => {
  const loop = canvas.indexOf(
    "for (const library of canvasComponentLibraries)"
  );
  const blocks = canvas.search(
    /registerComponentLibrary\(\{\s*namespace:\s*"@organizeos\/site-components",\s*components:\s*organizeosComponents,\s*metas:\s*organizeosComponentMetas,\s*templates:\s*organizeosTemplates,?\s*\}\)/
  );
  expect(loop).toBeGreaterThan(0);
  expect(blocks).toBeGreaterThan(loop);
  // 0.309.0 has no component hooks; the play flag is the metas' selectionReveal
  expect(canvas).not.toMatch(/\bhooks\s*:/);
});

test("the canvas imports both from the OrganizeOS module", () => {
  const imported = canvas.match(
    /import\s*\{([^}]*)\}\s*from\s*"\.\/organizeos-org-script"/
  );
  expect(
    imported?.[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .sort()
  ).toEqual(["withOrgScriptPolicy", "withoutBuiltWithWebstudio"]);
});

test("useInstanceProps skips a data-ws-tag or tag prop that the canvas may not render", () => {
  expect(webstudioComponent).toMatch(
    /checksTagProp\(instance\?\.component \?\? "", name\) &&\s*elementTagMayRender\(value\) === false/
  );
});

test("useInstanceProps passes the instance's own tag on only when the canvas may render it", () => {
  expect(webstudioComponent).toMatch(
    /tag !== undefined &&\s*instanceTagMayRender\(instance\?\.component \?\? "", tag\)/
  );
});

// The canvas makes no element whose tag the builder does not offer, nor an SVG
// animate or set (a SMIL animate can set a link's href to a javascript: URL):
// both renderers fall back to a div for a ws:element with such a tag, with the
// rule that also holds the tag props (elementTagMayRender, through
// instanceTagMayRender, not elementTagMayRun, which lets animate and set
// through)
test("both renderers fall back to a div for a ws:element whose tag the canvas may not render", () => {
  // 0.309.0 splits each renderer into an Inner and a wrapper, the canvas's
  // first and the preview's second
  const preview = webstudioComponent.indexOf(
    "const WebstudioComponentPreviewInner"
  );
  expect(preview).toBeGreaterThan(0);
  const fallback =
    /if \(instanceTagMayRender\(elementComponent, Component\) === false\) \{\s*Component = "div";\s*\}/g;
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
    "const WebstudioComponentPreviewInner"
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

// Every expression the canvas, the builder's panels and the builder's server
// compute goes through one evaluator (project-build's runtime/data.ts). While
// org script is paused it compiles no expression expressionMayRun refuses,
// after input validation's own check, and gives no function, so a merge that
// moves either fails here as well as in data.organizeos.test.ts.
test("the evaluator compiles no expression the pause refuses and gives no function", () => {
  const data = withoutComments(
    readFileSync(
      fileURLToPath(
        new URL(
          "../../../../packages/project-build/src/runtime/data.ts",
          import.meta.url
        )
      ),
      "utf8"
    )
  );
  const compile = data.slice(
    data.indexOf("const getCompiledExpression = "),
    data.indexOf("export const encodeDataVariableName = ")
  );
  const validation = compile.indexOf("checkValueExpression(expression)");
  const guard = compile.search(
    /if\s*\(\s*orgScriptMayRun\(\)\s*===\s*false\s*&&\s*expressionMayRun\(expression\)\s*===\s*false\s*\)\s*\{[\s\S]*?return pausedExpression;/
  );
  const transpile = compile.indexOf("transpileExpression(");
  expect(validation).toBeGreaterThan(0);
  expect(guard).toBeGreaterThan(validation);
  expect(transpile).toBeGreaterThan(guard);
  expect(data.match(/new Function\(/g)).toHaveLength(1);

  const evaluate = data.slice(
    data.indexOf("export const evaluateExpressionSync = "),
    data.indexOf("export type ResolveExpressionDataSource")
  );
  expect(evaluate).toMatch(
    /const result = getCompiledExpression\(expression\)\(\{ get: getVariable \}\);\s*if\s*\(\s*orgScriptMayRun\(\)\s*===\s*false\s*&&\s*typeof result\s*===\s*"function"\s*\)\s*\{\s*return pausedExpression\(\{ get: getVariable \}\);\s*\}\s*return result;/
  );
});

// Every place in the builder, its runtime, the sdk and the CLI that runs text
// as code, by file and count. While org script is paused each one either runs
// no org's text or holds it to a rule, so a merge or a change that adds one
// fails here until it is sorted: what it runs, and whether the pause covers
// it.
test("the source runs text as code in these places only", () => {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const evaluator =
    /new Function\(|\beval\(|runInNewContext|runInThisContext|new vm\.Script/g;
  const isSource = (file: string) =>
    /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file) &&
    /\.(?:test|spec|stories)\.[a-z]+$/.test(file) === false &&
    file.includes("/__generated__/") === false;
  const found: Record<string, number> = {};
  const read = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") {
          read(path);
        }
      } else if (isSource(path)) {
        const count = readFileSync(path, "utf8").match(evaluator)?.length ?? 0;
        if (count > 0) {
          found[relative(repository, path)] = count;
        }
      }
    }
  };
  for (const directory of [
    "apps/builder/app",
    "packages/project-build/src",
    "packages/sdk/src",
    "packages/cli/src",
  ]) {
    read(join(repository, directory));
  }
  expect(found).toEqual({
    // actions, which the pause's action rule holds
    "apps/builder/app/shared/nano-states/props.ts": 1,
    // the user's own typing, read after a literal check
    "apps/builder/app/builder/features/settings-panel/controls/json.tsx": 1,
    // digits and operators only
    "apps/builder/app/builder/features/style-panel/shared/css-value-input/evaluate-math.ts": 1,
    // every expression, which the pause's expression rule holds
    "packages/project-build/src/runtime/data.ts": 1,
    // no org's expression reaches it
    "packages/sdk/src/expression.ts": 1,
    // pasted JSX, which the route refuses
    "packages/project-build/src/runtime/jsx/evaluate.server.ts": 2,
  });
});
