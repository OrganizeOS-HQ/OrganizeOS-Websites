import { describe, expect, test } from "vitest";
import {
  allowedArrayMethods,
  allowedStringMethods,
  tags,
  type Instance,
  type Page,
  type Prop,
  type Resource,
  type WebstudioFragment,
} from "@webstudio-is/sdk";
import { renderTemplate } from "@webstudio-is/template";
import * as templates from "./templates";
import { SITE_TEMPLATES } from "./site-templates/catalog";
import { renderSiteTemplate } from "./site-templates/render";
import {
  checkAction,
  checkActionArgument,
  checkElementTag,
  checkResourceName,
  checkValueExpression,
  findCodeCheckFailure,
  forbiddenMemberNames,
  pagesToCheck,
} from "./code-check";

const accepted = (result: { ok: boolean }) => result.ok;

const variable = "$ws$dataSource$abc";

describe("checkValueExpression", () => {
  test("accepts literals, templates, arrays and objects with plain keys", () => {
    for (const expression of [
      `"text"`,
      `1`,
      `-1`,
      `true`,
      `null`,
      `undefined`,
      `/a/g`,
      "`a ${" + variable + "} b`",
      `[1, "a", ${variable}]`,
      `{ a: 1, "b": ${variable}, 2: null }`,
      `{ ${variable} }`,
    ]) {
      expect(checkValueExpression(expression), expression).toEqual({
        ok: true,
      });
    }
  });

  test("accepts variables, member access, operators, optional chaining and parentheses", () => {
    for (const expression of [
      variable,
      "$ws$system",
      `$ws$system.params.slug`,
      `${variable}.items[0]["title"]`,
      `${variable}?.items?.[0]`,
      `(${variable})`,
      `!${variable}`,
      `typeof ${variable}`,
      `${variable} + 1`,
      `${variable} === "a" ? "b" : "c"`,
      `${variable} ?? "fallback"`,
      `${variable} && ${variable}.a`,
      `"/events/" + ${variable}.slug`,
    ]) {
      expect(checkValueExpression(expression), expression).toEqual({
        ok: true,
      });
    }
  });

  test("accepts every method the editors offer", () => {
    for (const method of [...allowedStringMethods, ...allowedArrayMethods]) {
      const expression = `${variable}.${method}(1, "a")`;
      expect(accepted(checkValueExpression(expression)), expression).toBe(true);
    }
    expect(accepted(checkValueExpression(`${variable}?.slice?.(1)`))).toBe(
      true
    );
  });

  test("accepts a variable that is not set in this project", () => {
    expect(accepted(checkValueExpression("My$32$Name"))).toBe(true);
    expect(accepted(checkValueExpression("myVariable.field"))).toBe(true);
  });

  test("refuses an empty value, a parse error, a second expression and trailing text", () => {
    for (const expression of ["", "  ", "1 +", "1; 2", "1 2", "(1))"]) {
      expect(accepted(checkValueExpression(expression)), expression).toBe(
        false
      );
    }
  });

  test("refuses comments", () => {
    for (const expression of [
      "1 // a",
      "1 /* a */",
      "/* a */ 1",
      "1 <!-- a",
      "1\n--> a",
      "#!a\n1",
    ]) {
      expect(checkValueExpression(expression), expression).toEqual({
        ok: false,
        reason: expect.any(String),
      });
    }
  });

  // one minimal shape per refused kind of syntax
  test.each([
    ["a function", "() => 1"],
    ["a function expression", "function () {}"],
    ["a class", "class {}"],
    ["new", "new a()"],
    ["a tagged template", "a``"],
    ["this", "this"],
    ["an import", "import(a)"],
    ["import.meta", "import.meta"],
    ["await", "await a"],
    ["a spread in an array", "[...a]"],
    ["a spread in an object", "{ ...a }"],
    ["a spread in a call", `${variable}.slice(...a)`],
    ["a computed key", "{ [a]: 1 }"],
    ["a method in an object", "{ a() {} }"],
    ["a getter in an object", "{ get a() {} }"],
    ["a sequence", "(1, 2)"],
    ["an update", "a++"],
    ["delete", `delete ${variable}.a`],
    ["an assignment outside an action", `${variable} = 1`],
  ])("refuses %s", (_kind, expression) => {
    expect(accepted(checkValueExpression(expression))).toBe(false);
  });

  test("refuses member access by a value that is not a literal", () => {
    expect(accepted(checkValueExpression(`${variable}[${variable}]`))).toBe(
      false
    );
    expect(accepted(checkValueExpression(`${variable}[\`a\`]`))).toBe(false);
  });

  test.each([...forbiddenMemberNames])(
    "refuses the property %s in both access forms and as a key",
    (name) => {
      expect(accepted(checkValueExpression(`${variable}.${name}`))).toBe(false);
      expect(accepted(checkValueExpression(`${variable}["${name}"]`))).toBe(
        false
      );
      expect(accepted(checkValueExpression(`${variable}?.["${name}"]`))).toBe(
        false
      );
      expect(accepted(checkValueExpression(`{ "${name}": 1 }`))).toBe(false);
    }
  );

  test("refuses a name written with escapes", () => {
    expect(accepted(checkValueExpression(`${variable}.\\u0061`))).toBe(false);
    expect(accepted(checkValueExpression(`\\u0061`))).toBe(false);
  });

  test("refuses a call that is not a listed method", () => {
    for (const expression of [
      "a()",
      `${variable}.a()`,
      `${variable}["slice"]()`,
      `${variable}.slice.call()`,
      `(${variable}.slice)()`,
      `(0, ${variable}.slice)()`,
    ]) {
      expect(accepted(checkValueExpression(expression)), expression).toBe(
        false
      );
    }
  });

  test("refuses a name that is not a variable", () => {
    for (const expression of [
      "$a",
      "$ws$other",
      "$ws$dataSource$",
      "a$",
      "eval",
      "arguments",
      "yield",
    ]) {
      expect(accepted(checkValueExpression(expression)), expression).toBe(
        false
      );
    }
  });

  test("refuses a value that is not a string", () => {
    expect(accepted(checkValueExpression(undefined as unknown as string))).toBe(
      false
    );
  });
});

describe("checkAction", () => {
  const known = new Set(["abc", "def"]);

  test("accepts assignment to a variable, reading arguments and variables", () => {
    for (const code of [
      `$ws$dataSource$abc = value`,
      `$ws$dataSource$abc = !$ws$dataSource$abc`,
      `$ws$dataSource$abc += $ws$dataSource$def + 1`,
      `$ws$dataSource$abc.field = value`,
      `$ws$dataSource$abc = $ws$system.params.slug`,
    ]) {
      expect(
        checkAction([{ args: ["value"], code }], { dataSourceIds: known }),
        code
      ).toEqual({ ok: true });
    }
  });

  test("accepts an action with no entries", () => {
    expect(checkAction([])).toEqual({ ok: true });
  });

  test("refuses a name that is not an argument, a variable or the system variable", () => {
    expect(accepted(checkAction([{ args: [], code: "a" }]))).toBe(false);
    expect(
      accepted(
        checkAction([{ args: ["value"], code: "$ws$dataSource$abc = b" }])
      )
    ).toBe(false);
  });

  test("refuses a variable that is not in the build", () => {
    expect(
      accepted(
        checkAction([{ args: [], code: "$ws$dataSource$xyz = 1" }], {
          dataSourceIds: known,
        })
      )
    ).toBe(false);
    expect(
      accepted(
        checkAction(
          [{ args: [], code: "$ws$dataSource$abc = $ws$dataSource$xyz" }],
          {
            dataSourceIds: known,
          }
        )
      )
    ).toBe(false);
  });

  test("refuses an assignment to anything but a variable", () => {
    for (const code of [
      "a = 1",
      "value = 1",
      "$ws$system = 1",
      "[$ws$dataSource$abc] = [1]",
      "$ws$dataSource$abc?.a = 1",
      "$ws$dataSource$abc.constructor = 1",
    ]) {
      expect(accepted(checkAction([{ args: ["value"], code }])), code).toBe(
        false
      );
    }
  });

  test("refuses code that is not one expression", () => {
    for (const code of [
      "",
      "$ws$dataSource$abc = 1; $ws$dataSource$abc = 2",
      "$ws$dataSource$abc = 1 // a",
    ]) {
      expect(accepted(checkAction([{ args: [], code }])), code).toBe(false);
    }
  });

  test("checks every entry", () => {
    expect(
      accepted(
        checkAction([
          { args: [], code: "$ws$dataSource$abc = 1" },
          { args: [], code: "a()" },
        ])
      )
    ).toBe(false);
  });

  test("refuses an argument name that is not a plain name", () => {
    for (const arg of ["", "a b", "a)", "1a", "a=1", "this", "eval", "$ws$x"]) {
      expect(accepted(checkActionArgument(arg)), arg).toBe(false);
      expect(
        accepted(
          checkAction([{ args: [arg], code: "$ws$dataSource$abc = 1" }])
        ),
        arg
      ).toBe(false);
    }
    for (const arg of ["value", "event", "_a", "$a", "a1"]) {
      expect(accepted(checkActionArgument(arg)), arg).toBe(true);
    }
  });
});

describe("checkResourceName", () => {
  test("a header name is token characters only", () => {
    for (const name of ["Authorization", "Content-Type", "X-A_b.c"]) {
      expect(accepted(checkResourceName("header", name)), name).toBe(true);
    }
    for (const name of ["", "a b", 'a"', "a\\", "a\n", "a:"]) {
      expect(accepted(checkResourceName("header", name)), name).toBe(false);
    }
  });

  test("a search parameter name has no quote, backslash or line terminator", () => {
    for (const name of ["", "q", "a b", "a[]", "a'"]) {
      expect(accepted(checkResourceName("searchParam", name)), name).toBe(true);
    }
    for (const name of ['a"', "a\\", "a\n", "a\r", "a\u2028", "a\u2029"]) {
      expect(accepted(checkResourceName("searchParam", name)), name).toBe(
        false
      );
    }
  });
});

describe("checkElementTag", () => {
  test("accepts every tag the builder offers and nothing else", () => {
    for (const tag of tags) {
      expect(accepted(checkElementTag(tag)), tag).toBe(true);
    }
    for (const tag of ["script", "Div", "div ", 'a"', "", undefined, 1]) {
      expect(accepted(checkElementTag(tag)), String(tag)).toBe(false);
    }
  });
});

const page = (meta: Partial<Page["meta"]> = {}, title = `"Home"`): Page => ({
  id: "page",
  name: "Home",
  path: "/home",
  title,
  rootInstanceId: "root",
  meta,
});

const instance = (init: Partial<Instance> = {}): Instance => ({
  type: "instance",
  id: "box",
  component: "Box",
  children: [],
  ...init,
});

const resource = (init: Partial<Resource> = {}): Resource => ({
  id: "resource",
  name: "Events",
  method: "get",
  url: `"https://example.org"`,
  headers: [],
  ...init,
});

describe("findCodeCheckFailure", () => {
  test("a clean build passes", () => {
    expect(
      findCodeCheckFailure({
        pages: [page({ description: `"About"`, custom: [] })],
        instances: [
          instance({ children: [{ type: "expression", value: variable }] }),
        ],
        props: [
          {
            id: "p",
            instanceId: "box",
            name: "onClick",
            type: "action",
            value: [{ type: "execute", args: [], code: `${variable} = 1` }],
          },
        ],
        resources: [resource()],
        dataSources: [
          {
            id: "abc",
            type: "variable",
            name: "a",
            value: { type: "number", value: 0 },
          },
        ],
      })
    ).toBeUndefined();
  });

  test.each([
    ["title", page({}, "a()")],
    ["meta title", page({ title: "a()" })],
    ["description", page({ description: "a()" })],
    ["exclude from search", page({ excludePageFromSearch: "a()" })],
    ["language", page({ language: "a()" })],
    ["social image URL", page({ socialImageUrl: "a()" })],
    ["status", page({ status: "a()" })],
    ["redirect", page({ redirect: "a()" })],
    ["content", page({ content: "a()" })],
    [
      'custom metadata "og:x"',
      page({ custom: [{ property: "og:x", content: "a()" }] }),
    ],
  ])("names a page's %s", (field, value) => {
    expect(findCodeCheckFailure({ pages: [value] })).toEqual({
      place: { type: "page", id: "page", path: "/home" },
      field,
      reason: expect.any(String),
    });
  });

  test("skips a custom metadata entry with no property, which is not generated", () => {
    expect(
      findCodeCheckFailure({
        pages: [page({ custom: [{ property: " ", content: "a()" }] })],
      })
    ).toBeUndefined();
  });

  test("names an instance's tag and text expression", () => {
    expect(
      findCodeCheckFailure({ instances: [instance({ tag: "script" })] })
    ).toMatchObject({ place: { type: "instance", id: "box" }, field: "tag" });
    expect(
      findCodeCheckFailure({
        instances: [instance({ component: "ws:element", tag: "script" })],
      })
    ).toMatchObject({ field: "tag" });
    expect(
      findCodeCheckFailure({
        instances: [
          instance({ children: [{ type: "expression", value: "a()" }] }),
        ],
      })
    ).toMatchObject({ field: "text expression" });
  });

  test("leaves an XML Node's tag alone", () => {
    expect(
      findCodeCheckFailure({
        instances: [instance({ component: "XmlNode", tag: "urlset" })],
      })
    ).toBeUndefined();
  });

  test("names a property's expression and action", () => {
    const prop = (init: Partial<Prop>): Prop =>
      ({ id: "p", instanceId: "box", name: "x", ...init }) as Prop;
    expect(
      findCodeCheckFailure({
        props: [prop({ type: "expression", value: "a()" })],
      })
    ).toMatchObject({
      place: { type: "instance", id: "box" },
      field: 'property "x"',
    });
    expect(
      findCodeCheckFailure({
        props: [
          prop({
            type: "action",
            value: [
              { type: "execute", args: [], code: "$ws$dataSource$xyz = 1" },
            ],
          }),
        ],
      })
    ).toMatchObject({ field: 'property "x"' });
  });

  test.each([
    ["URL", resource({ url: "a()" })],
    [
      "search parameter name",
      resource({ searchParams: [{ name: 'a"', value: `"b"` }] }),
    ],
    [
      'search parameter "q"',
      resource({ searchParams: [{ name: "q", value: "a()" }] }),
    ],
    ["header name", resource({ headers: [{ name: "a b", value: `"b"` }] })],
    ['header "X-A"', resource({ headers: [{ name: "X-A", value: "a()" }] })],
    ["body", resource({ method: "post", body: "a()" })],
  ])("names a resource's %s, by the instance that loads it", (field, value) => {
    expect(
      findCodeCheckFailure({
        resources: [value],
        dataSources: [
          {
            id: "d",
            type: "resource",
            name: "events",
            resourceId: "resource",
            scopeInstanceId: "body",
          },
        ],
      })
    ).toEqual({
      place: { type: "instance", id: "body" },
      field: `resource "Events" ${field}`,
      reason: expect.any(String),
    });
    expect(findCodeCheckFailure({ resources: [value] })).toMatchObject({
      place: { type: "resource", id: "resource" },
    });
  });

  test("pagesToCheck reads page templates as well", () => {
    const template = { ...page({ description: "a()" }), id: "template" };
    const { path: _path, ...pageTemplate } = template;
    expect(
      findCodeCheckFailure({
        pages: pagesToCheck({
          meta: {},
          homePageId: "page",
          rootFolderId: "root",
          pages: new Map([["page", page()]]),
          folders: new Map(),
          pageTemplates: new Map([["template", pageTemplate]]),
        }),
      })
    ).toMatchObject({ place: { type: "page", id: "template" } });
  });
});

const fragmentFailure = (fragment: WebstudioFragment) =>
  findCodeCheckFailure({
    instances: fragment.instances,
    props: fragment.props,
    resources: fragment.resources,
    dataSources: fragment.dataSources,
  });

describe("the fork's own values pass", () => {
  test.each(
    Object.entries(templates).map(([name, meta]) => [name, meta] as const)
  )("the %s template", (_name, meta) => {
    expect(fragmentFailure(renderTemplate(meta.template))).toBeUndefined();
  });

  test.each(SITE_TEMPLATES.map((template) => [template.id, template] as const))(
    "the %s site template",
    (_id, template) => {
      let pageCount = 0;
      const pages = renderSiteTemplate(template, {
        assetIds: new Map(
          Object.keys(template.images).map((file) => [file, `asset-${file}`])
        ),
        generatePageId: () => {
          pageCount += 1;
          return `page-${pageCount}`;
        },
      });
      for (const rendered of pages) {
        expect(
          fragmentFailure(rendered.fragment),
          rendered.key
        ).toBeUndefined();
      }
    }
  );
});
