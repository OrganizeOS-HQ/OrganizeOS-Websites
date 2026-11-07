import { describe, expect, test } from "vitest";
import { generatedCodeGlobals } from "@organizeos/site-components/org-script";
import {
  checkGeneratedModule,
  findGeneratedCodeProblems,
  readModuleNames,
} from "./organizeos-generated-code";

// While org script is paused, publishing fails when a module it generates
// reads a name it does not declare, past the globals it may read, or shadows
// an import (docs/ORGANIZEOS-FORK.md section 10).

describe("readModuleNames", () => {
  test("reads the names a module does not declare by JavaScript's scoping", () => {
    expect(
      readModuleNames(`
        import { a } from "a";
        const { b, c: [d = e], ...f } = g;
        let h = (i, { j } = k) => i + j + l + m.n + o?.[p];
        function q() { var r = 1; return r + arguments.length + s; }
        { let t = 1; } t;
        for (const u of v) u;
        try {} catch (w) { w; }
        class X { y() { return z; } }
        export { a, q };
        ({ shorthand, key: value, [computed]: 1 });
      `).undeclared.sort()
    ).toEqual(
      [
        "computed",
        "e",
        "g",
        "k",
        "l",
        "m",
        "o",
        "p",
        "s",
        "shorthand",
        "t",
        "v",
        "value",
        "z",
      ].sort()
    );
  });

  test("reads the names a module imports and the names a nested scope binds", () => {
    const names = readModuleNames(`
      import { Box, Text as Label } from "x";
      export const siteName = "a";
      const page = (event) => { let [Box] = [1]; try {} catch (error) {} return () => { const siteName = 1; }; };
    `);
    expect(names.imports.sort()).toEqual(["Box", "Label"]);
    expect(names.nested.sort()).toEqual(["Box", "error", "event", "siteName"]);
  });
});

describe("findGeneratedCodeProblems", () => {
  test("finds nothing in a module that declares what it reads and reads only the globals it may read", async () => {
    expect(
      await findGeneratedCodeProblems(`
        import { Fragment } from "react";
        import { Box as Box } from "@webstudio-is/sdk-components-react/components";
        import type { System } from "@webstudio-is/sdk";
        const Page = (_props: { system: any }) => {
          const system = _props.system;
          let list = [1] as any;
          return <Box title={system?.params?.slug ?? undefined}>{Object.entries(list ?? {}).map(([_key, item]: any) => {
            const index = Array.isArray(list) ? Number(_key) : _key;
            return <Fragment key={index}>{Object.entries(item ?? {}).map(([_key, sub]: any) => <Box key={_key}>{sub}</Box>)}</Fragment>;
          })}</Box>;
        };
        export const getResources = (_props: { system: System }) => new Map<string, unknown>([]);
        export { Page };
      `)
    ).toEqual({ undeclared: [], shadowed: [] });
    expect([...generatedCodeGlobals].sort()).toEqual([
      "Array",
      "Error",
      "Infinity",
      "Map",
      "NaN",
      "Number",
      "Object",
      "String",
    ]);
  });

  test("finds a name the module does not declare", async () => {
    expect(
      await findGeneratedCodeProblems(
        `const Page = () => <div title={process?.env?.SECRET} onClick={() => { a = 1; set$a(a) }} />;\nexport { Page };`
      )
    ).toEqual({ undeclared: ["process", "a", "set$a"], shadowed: [] });
  });

  // A binding inside the module may not take the name of one it imports
  test("finds a local that shadows an import", async () => {
    expect(
      await findGeneratedCodeProblems(`
        import { Box as Box } from "x";
        const Page = () => {
          let [Box, set$tag] = [1, () => {}];
          return <div title={Box} />;
        };
        export { Page };
      `)
    ).toEqual({ undeclared: [], shadowed: ["Box"] });
  });

  test("finds a shadowed import whatever text the module holds, and whatever its name ends in", async () => {
    for (const extra of ['<div title={"Box2"} />', "/* Box2 */ <div />"]) {
      expect(
        await findGeneratedCodeProblems(`
          import { Box as Box } from "x";
          const Page = () => {
            let [Box, set$tag] = [1, () => {}];
            return <Box>{${extra}}</Box>;
          };
          export { Page };
        `),
        extra
      ).toEqual({ undeclared: [], shadowed: ["Box"] });
    }
    expect(
      await findGeneratedCodeProblems(`
        import { Box as Box_1 } from "x";
        const Page = () => {
          let [Box_1, set$tag] = [1, () => {}];
          return <Box_1 />;
        };
        export { Page };
      `)
    ).toEqual({ undeclared: [], shadowed: ["Box_1"] });
  });

  // A local named like one of the module's own exports, or an action's arg
  // named like a variable, shadows no import
  test("finds no problem in a local that shadows no import", async () => {
    expect(
      await findGeneratedCodeProblems(`
        import { Box as Box } from "x";
        export const siteName = "Site";
        export const breakpoints = [];
        const Page = () => {
          let [siteName, set$siteName] = [1, () => {}];
          let [breakpoints, set$breakpoints] = [1, () => {}];
          let [jsx, set$jsx] = [1, () => {}];
          let [jsxs, set$jsxs] = [1, () => {}];
          let [state, set$state] = [1, () => {}];
          return <Box title={siteName} data-x={breakpoints} data-y={jsx} data-z={jsxs} onChange={(state: any) => { set$state(state) }}><div /><div /></Box>;
        };
        export const getPageMeta = () => {
          let contactEmail = "a";
          return { title: contactEmail };
        };
        export const contactEmail = "b";
        export { Page };
      `)
    ).toEqual({ undeclared: [], shadowed: [] });
  });
});

describe("checkGeneratedModule", () => {
  test("fails while org script is paused, naming the module and the names", async () => {
    await expect(
      checkGeneratedModule(
        "export const getPageMeta = () => ({ title: process.env.X });",
        "app/__generated__/_index.server.tsx",
        false
      )
    ).rejects.toThrow(
      "Org script is paused, and the generated module app/__generated__/_index.server.tsx reads names it does not declare: process. Nothing was published."
    );
    await expect(
      checkGeneratedModule("export const x = Object.keys({});", "a.tsx", false)
    ).resolves.toBeUndefined();
  });

  test("checks nothing when org script may run", async () => {
    await expect(
      checkGeneratedModule("export const x = process;", "a.tsx", true)
    ).resolves.toBeUndefined();
  });
});
