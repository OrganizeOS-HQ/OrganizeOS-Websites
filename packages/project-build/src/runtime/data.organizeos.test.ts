import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkValueExpression,
  expressionMayRun,
  orgScriptMayRun,
} from "@organizeos/site-components/org-script";
import { computeExpression, evaluateExpressionSync } from "./data";
import { prepareManagedFormDraft } from "./managed-form-draft";

// OrganizeOS fork: input validation for expressions (code-check.ts in
// @organizeos/site-components) before the canvas compiles one
// (docs/ORGANIZEOS-FORK.md section 10).

// OrganizeOS fork: the pause's rule, observed (the cache case counts its calls)
vi.mock("@organizeos/site-components/org-script", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@organizeos/site-components/org-script")
    >();
  return { ...actual, expressionMayRun: vi.fn(actual.expressionMayRun) };
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("an expression that fails input validation reads as unset and is never compiled", async () => {
  const compile = vi.spyOn(globalThis, "Function");
  const refused = "$ws$dataSource$a.constructor";
  expect(
    await computeExpression(refused, new Map([["a", "x"]]))
  ).toBeUndefined();
  expect(
    await computeExpression(refused, new Map([["a", "x"]]))
  ).toBeUndefined();
  expect(compile).not.toHaveBeenCalled();
});

test("a caller that asks for errors gets the reason, never the value", () => {
  const refused = "$ws$dataSource$a.constructor";
  expect(() =>
    evaluateExpressionSync(refused, new Map([["a", "x"]]), {
      throwOnError: true,
    })
  ).toThrow("Expression skipped: This property is not allowed");
  try {
    evaluateExpressionSync(refused, new Map(), { throwOnError: true });
  } catch (error) {
    expect(String(error)).not.toContain(refused);
  }
});

test("trailing code after an expression is never compiled", async () => {
  const compile = vi.spyOn(globalThis, "Function");
  expect(await computeExpression("1; 2", new Map())).toBeUndefined();
  expect(compile).not.toHaveBeenCalled();
});

test("an expression that passes is compiled as before", async () => {
  const compile = vi.spyOn(globalThis, "Function");
  expect(
    await computeExpression(
      "$ws$dataSource$b.slice(1) + '!'",
      new Map([["b", "xyz"]])
    )
  ).toBe("yz!");
  expect(compile).toHaveBeenCalledTimes(1);
});

// OrganizeOS fork: while org script is paused, nothing compiles or computes
// an expression expressionMayRun refuses, and no expression gives a function
// (docs/ORGANIZEOS-FORK.md section 10, "Expressions"). Input validation, above,
// stays the outer layer.
describe("while org script is paused", () => {
  // input validation passes each of these, so the pause's rule is what
  // refuses them
  const refused = [
    "0 < 1 > 0",
    "$ws$dataSource$a.slice($ws$dataSource$b)",
    "({ toString: 1 })",
    "/x/",
  ];
  const variables = () =>
    new Map<string, unknown>([
      ["a", "xyz"],
      ["b", 1],
    ]);

  test("an expression the pause refuses reads as unset and is never compiled", async () => {
    expect(orgScriptMayRun()).toBe(false);
    const compile = vi.spyOn(globalThis, "Function");
    for (const expression of refused) {
      expect(checkValueExpression(expression).ok, expression).toBe(true);
      expect(
        await computeExpression(expression, variables()),
        expression
      ).toBeUndefined();
      expect(
        evaluateExpressionSync(expression, variables()),
        expression
      ).toBeUndefined();
    }
    expect(compile).not.toHaveBeenCalled();
  });

  test("input validation gives its reason before the pause's rule reads an expression", () => {
    const check = vi.mocked(expressionMayRun);
    const both = '({ constructor: "order" })';
    expect(() =>
      evaluateExpressionSync(both, new Map(), { throwOnError: true })
    ).toThrow("Expression skipped: This property is not allowed");
    expect(check.mock.calls.some(([expression]) => expression === both)).toBe(
      false
    );
  });

  test("a caller that asks for errors gets a fixed reason, never the expression", () => {
    for (const expression of refused) {
      let error: unknown;
      try {
        evaluateExpressionSync(expression, variables(), {
          throwOnError: true,
        });
      } catch (caught) {
        error = caught;
      }
      expect(String(error), expression).toMatch(/^Error: Expression skipped: /);
      expect(String(error), expression).not.toContain(expression);
    }
  });

  test("keeps a refused expression in the cache, and drops it past the cache's limit as any other", () => {
    const check = vi.mocked(expressionMayRun);
    const first = "0 < 1 > 0.5";
    const checksOfFirst = () =>
      check.mock.calls.filter(([expression]) => expression === first).length;
    expect(evaluateExpressionSync(first, new Map())).toBeUndefined();
    expect(evaluateExpressionSync(first, new Map())).toBeUndefined();
    // read from the cache the second time
    expect(checksOfFirst()).toBe(1);
    for (let index = 0; index < 10_000; index += 1) {
      evaluateExpressionSync(`0 < 1 > ${index + 1}`, new Map());
    }
    expect(evaluateExpressionSync(first, new Map())).toBeUndefined();
    // the first entry was dropped, so it is checked again
    expect(checksOfFirst()).toBe(2);
  });

  test("an expression that gives a function reads as unset, and a caller that asks for errors gets a refusal", () => {
    const values = new Map<string, unknown>([
      ["a", "xyz"],
      ["o", { x: 1 }],
    ]);
    for (const expression of [
      // a method read as a value
      "$ws$dataSource$a.slice",
      // a member of a plain object the evaluator wraps
      "$ws$dataSource$o.toString",
    ]) {
      expect(expressionMayRun(expression), expression).toBe(true);
      expect(
        evaluateExpressionSync(expression, values),
        expression
      ).toBeUndefined();
      expect(() =>
        evaluateExpressionSync(expression, values, { throwOnError: true })
      ).toThrow(/^Expression skipped: /);
    }
    // a value that is not a function is computed as before
    expect(evaluateExpressionSync("$ws$dataSource$a.slice(1)", values)).toBe(
      "yz"
    );
  });

  // A form's draft runs on the builder's server (the form preview and the
  // simulated submission)
  const draft = ({ url, subject }: { url: string; subject?: string }) => {
    const pages = {
      homePageId: "page",
      rootFolderId: "root",
      pages: new Map([
        [
          "page",
          { id: "page", path: "/contact", rootInstanceId: "root-instance" },
        ],
      ]),
      folders: new Map([
        ["root", { id: "root", slug: "", children: ["page"] }],
      ]),
    };
    const instances = new Map([
      [
        "root-instance",
        {
          type: "instance",
          id: "root-instance",
          component: "Body",
          children: [{ type: "id", value: "form" }],
        },
      ],
      [
        "form",
        {
          type: "instance",
          id: "form",
          component: "ResourceForm",
          children: [],
        },
      ],
    ]);
    const props = new Map([
      [
        "action",
        {
          id: "action",
          instanceId: "form",
          name: "action",
          type: "json",
          value: [{ dataSourceId: "destination" }],
        },
      ],
    ]);
    const dataSources = new Map([
      [
        "destination",
        {
          id: "destination",
          type: "resource",
          scopeInstanceId: "form",
          resourceId: "webhook",
          name: "webhook",
        },
      ],
      [
        "formData",
        {
          id: "formData",
          type: "parameter",
          scopeInstanceId: "form",
          name: "formData",
        },
      ],
    ]);
    const resources = new Map([
      [
        "webhook",
        {
          id: "webhook",
          name: "webhook",
          method: "post",
          url,
          headers: [{ name: "X-Kind", value: '"contact"' }],
          body: "({ email: $ws$dataSource$formData.email })",
          ...(subject === undefined
            ? {}
            : {
                control: "email",
                email: { recipientMode: "owner", subject },
              }),
        },
      ],
    ]);
    const pageUrl = new URL("https://site.example/contact");
    const prepared = prepareManagedFormDraft({
      formId: "form",
      pageUrl,
      pages: pages as never,
      instances: instances as never,
      props: props as never,
      dataSources: dataSources as never,
      resources: resources as never,
      projectMeta: { contactEmail: "team@example.com" } as never,
    });
    const graph = prepared.getGraph("form", {
      system: prepared.system,
      formData: { email: "ada@example.com" },
      browserInfo: {},
    });
    return () => graph.resources[0].createRequest(new Map());
  };

  test("a form's draft compiles no field the pause refuses, and refuses it", () => {
    const compile = vi.spyOn(globalThis, "Function");
    expect(draft({ url: '"https://example.com/" + (0 < 1 > 2)' })).toThrow(
      /^Expression skipped: /
    );
    expect(
      draft({
        url: '"https://example.com/contact"',
        subject: '"New message".slice($ws$dataSource$formData)',
      })
    ).toThrow(/^Expression skipped: /);
    expect(compile).not.toHaveBeenCalled();
  });

  test("a form's draft whose fields may run still evaluates", () => {
    const request = draft({ url: '"https://example.com/contact"' })();
    expect(request.url).toBe("https://example.com/contact");
    expect(request.headers).toEqual([{ name: "X-Kind", value: "contact" }]);
    expect(request.body).toEqual({ email: "ada@example.com" });
  });
});
