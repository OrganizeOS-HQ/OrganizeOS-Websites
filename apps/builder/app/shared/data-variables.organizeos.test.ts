import { afterEach, expect, test, vi } from "vitest";
import { computeExpression } from "./data-variables";

// OrganizeOS fork: input validation for expressions (code-check.ts in
// @organizeos/site-components) before the canvas compiles one.

afterEach(() => {
  vi.restoreAllMocks();
});

test("an expression that fails input validation reads as unset and is never compiled", () => {
  const compile = vi.spyOn(globalThis, "Function");
  const warn = vi.spyOn(console, "error").mockImplementation(() => {});
  const refused = "$ws$dataSource$a.constructor";
  expect(computeExpression(refused, new Map([["a", "x"]]))).toBeUndefined();
  expect(computeExpression(refused, new Map([["a", "x"]]))).toBeUndefined();
  expect(compile).not.toHaveBeenCalled();
  // once per value, with the reason only
  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0][0])).not.toContain(refused);
});

test("trailing code after an expression is never compiled", () => {
  const compile = vi.spyOn(globalThis, "Function");
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(computeExpression("1; 2", new Map())).toBeUndefined();
  expect(compile).not.toHaveBeenCalled();
});

test("an expression that passes is compiled as before", () => {
  const compile = vi.spyOn(globalThis, "Function");
  expect(
    computeExpression(
      "$ws$dataSource$b.slice(1) + '!'",
      new Map([["b", "xyz"]])
    )
  ).toBe("yz!");
  expect(compile).toHaveBeenCalledTimes(1);
});
