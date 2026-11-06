import { expect, test } from "vitest";
import { lintExpression } from "@webstudio-is/expression";
import type { Resource } from "@webstudio-is/sdk";
import { mapResourceExpressionsMutable } from "@webstudio-is/project-build/runtime";
import { checkResource } from "@organizeos/site-components/org-script";
import {
  nameCheckError,
  resourceFailsCodeCheck,
  withCodeCheckDiagnostic,
  withCodeCheckError,
} from "./organizeos-code-check";

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

test("the binding popover's error list gets the same reason", () => {
  expect(withCodeCheckError(`a.constructor`, [])).toEqual([
    "This property is not allowed",
  ]);
  expect(withCodeCheckError(`a.slice(1)`, [])).toEqual([]);
  expect(withCodeCheckError(`a(`, ["lint"])).toEqual(["lint"]);
  expect(withCodeCheckError(``, [])).toEqual([]);
});

const refused = `"a".constructor.constructor("return 1")()`;

const everyResourceField = (): Resource => ({
  id: "resource",
  name: "Resource",
  control: "email",
  method: "post",
  url: `"https://example.org"`,
  searchParams: [{ name: "q", value: `"a"` }],
  headers: [{ name: "X-A", value: `"b"` }],
  body: `"c"`,
  email: {
    subject: `"d"`,
    body: `"e"`,
    senderExpression: `"f@example.org"`,
    recipientsExpression: `"g@example.org"`,
  },
});

test("input validation reads every expression field of a Resource that the platform rebinds", () => {
  const count = (() => {
    let total = 0;
    mapResourceExpressionsMutable(everyResourceField(), () => {
      total += 1;
    });
    return total;
  })();
  expect(count).toBeGreaterThan(0);
  expect(checkResource(everyResourceField())).toBeUndefined();
  for (let index = 0; index < count; index += 1) {
    const resource = everyResourceField();
    let position = 0;
    mapResourceExpressionsMutable(resource, () =>
      position++ === index ? refused : undefined
    );
    expect(checkResource(resource), `expression ${index}`).toBeDefined();
  }
});

test("the variable dialog does not save an email resource whose settings fail input validation", () => {
  for (const key of [
    "subject",
    "body",
    "senderExpression",
    "recipientsExpression",
  ] as const) {
    expect(
      resourceFailsCodeCheck({
        url: `""`,
        headers: [],
        email: { [key]: refused },
      }),
      key
    ).toBe(true);
  }
  expect(
    resourceFailsCodeCheck({
      url: `""`,
      headers: [],
      email: { subject: `"New message"`, recipients: "a@example.org" },
    })
  ).toBe(false);
});
