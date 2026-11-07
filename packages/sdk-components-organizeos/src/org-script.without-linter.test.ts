import { describe, expect, test, vi } from "vitest";
import { encodeDataSourceVariable } from "@webstudio-is/sdk";
import { expressionMayRun } from "./org-script";

// expressionMayRun checks every node itself as well as asking the expression
// linter, so each part holds on its own. Here the linter reports nothing, and
// the parts that also refuse what the linter refuses still refuse it
// (docs/ORGANIZEOS-FORK.md section 10, "Expressions").
vi.mock("@webstudio-is/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@webstudio-is/sdk")>()),
  lintExpression: () => [],
}));

describe("expressionMayRun, with the expression linter reporting nothing", () => {
  const variable = encodeDataSourceVariable("var-1");

  test("refuses a node that is not on its allowlist", () => {
    for (const expression of [
      "this",
      `new ${variable}()`,
      "(0, 1)",
      `${variable} = 1`,
      `${variable}++`,
      "() => 1",
      `${variable}\`x\``,
      'import("x")',
    ]) {
      expect(expressionMayRun(expression), expression).toBe(false);
    }
  });

  test("refuses an object property that is a getter or a method", () => {
    for (const expression of ["({get x() { return 1 }})", "({f() {}})"]) {
      expect(expressionMayRun(expression), expression).toBe(false);
    }
  });

  test("refuses a call of a method an expression may not call", () => {
    for (const expression of [
      '"x".foo()',
      `${variable}.toFixed(1)`,
      `${variable}["slice"](0)`,
      `${variable}()`,
      `(${variable}.at)(0)`,
    ]) {
      expect(expressionMayRun(expression), expression).toBe(false);
    }
  });

  test("refuses an expression that a script and a module read differently", () => {
    expect(expressionMayRun("0 <!--x\n+ 1")).toBe(false);
  });

  test("still accepts what the builder writes", () => {
    for (const expression of [
      `(${variable}.ok === true ? ${variable}.data.data.slice(0, 1) : [])`,
      '"/events/" + $ws$system.params.slug',
      `${variable}.at(-1)`,
    ]) {
      expect(expressionMayRun(expression), expression).toBe(true);
    }
  });
});
