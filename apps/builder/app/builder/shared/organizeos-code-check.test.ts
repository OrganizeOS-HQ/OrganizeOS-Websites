import { expect, test } from "vitest";
import { lintExpression } from "@webstudio-is/sdk";
import { withCodeCheckDiagnostic } from "./organizeos-code-check";
import { nameCheckError } from "../features/settings-panel/resource-panel";

const diagnose = (expression: string) =>
  withCodeCheckDiagnostic(
    expression,
    lintExpression({
      expression,
      availableVariables: new Set(["$ws$dataSource$a"]),
    })
  );

test("an expression lint accepts but input validation refuses gets one error, in the lint slot", () => {
  expect(diagnose(`$ws$dataSource$a.constructor`)).toEqual([
    {
      from: 0,
      to: 28,
      severity: "error",
      message: "This property is not allowed",
    },
  ]);
  expect(diagnose(`$ws$dataSource$a["__proto__"]`)).toHaveLength(1);
});

test("an expression that passes gets lint's diagnostics only", () => {
  expect(diagnose(`$ws$dataSource$a.slice(1)`)).toEqual([]);
  expect(diagnose(`$ws$dataSource$b`)).toEqual(
    lintExpression({
      expression: `$ws$dataSource$b`,
      availableVariables: new Set(["$ws$dataSource$a"]),
    })
  );
});

test("lint's own error and an empty value are left to lint", () => {
  expect(diagnose(`a(`)).toHaveLength(1);
  expect(diagnose(``)).toEqual(
    lintExpression({ expression: ``, availableVariables: new Set() })
  );
});

test("a resource name that fails input validation shows the reason", () => {
  expect(nameCheckError("header", "a b")).toBe("Not a valid header name");
  expect(nameCheckError("header", "Authorization")).toBeUndefined();
  expect(nameCheckError("searchParam", 'a"')).toBe(
    "Not a valid parameter name"
  );
  expect(nameCheckError("searchParam", "q")).toBeUndefined();
  // a new row is left out when saved
  expect(nameCheckError("header", "")).toBeUndefined();
});
