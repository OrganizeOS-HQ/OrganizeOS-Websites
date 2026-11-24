// OrganizeOS fork: ties the custom code name check
// (checkCustomCodeNames, @organizeos/site-components/org-script) to what
// upstream's htmlToJsx actually writes into the home page's module. An
// upstream change to htmlToJsx or a parse5 bump that lets an accepted input
// become code fails here instead of passing silently (spec 2026-11-20, 4.4).
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { Parser } from "acorn";
import acornJsx from "acorn-jsx";
import { simple as walkSimple, base as walkBase } from "acorn-walk";
import { checkCustomCodeNames } from "@organizeos/site-components/org-script";
import { htmlToJsx } from "./html-to-jsx";
import { findGeneratedCodeProblems } from "./organizeos-generated-code";

const jsxParser = Parser.extend(acornJsx());

type Node = {
  type: string;
  [key: string]: unknown;
};

// acorn-walk does not know the JSX node types; walk them as their children.
const jsxBase = {
  ...walkBase,
  JSXFragment: (node: Node, state: unknown, callback: Callback) => {
    for (const child of node.children as Node[]) {
      callback(child, state);
    }
  },
  JSXElement: (node: Node, state: unknown, callback: Callback) => {
    callback(node.openingElement as Node, state);
    for (const child of node.children as Node[]) {
      callback(child, state);
    }
    if (node.closingElement) {
      callback(node.closingElement as Node, state);
    }
  },
  JSXOpeningElement: (node: Node, state: unknown, callback: Callback) => {
    callback(node.name as Node, state);
    for (const attribute of node.attributes as Node[]) {
      callback(attribute, state);
    }
  },
  JSXClosingElement: (node: Node, state: unknown, callback: Callback) => {
    callback(node.name as Node, state);
  },
  JSXAttribute: (node: Node, state: unknown, callback: Callback) => {
    callback(node.name as Node, state);
    if (node.value) {
      callback(node.value as Node, state);
    }
  },
  JSXSpreadAttribute: (node: Node, state: unknown, callback: Callback) => {
    callback(node.argument as Node, state);
  },
  JSXExpressionContainer: (node: Node, state: unknown, callback: Callback) => {
    callback(node.expression as Node, state);
  },
  JSXMemberExpression: () => {},
  JSXNamespacedName: () => {},
  JSXIdentifier: () => {},
  JSXText: () => {},
  JSXEmptyExpression: () => {},
};
type Callback = (node: Node, state: unknown) => void;

const isStringLiteral = (node: Node) =>
  node.type === "Literal" && typeof node.value === "string";

const isLiteralObject = (node: Node) =>
  node.type === "ObjectExpression" &&
  (node.properties as Node[]).every(
    (property) =>
      property.type === "Property" &&
      property.computed === false &&
      property.method === false &&
      property.shorthand === false &&
      property.kind === "init" &&
      isStringLiteral(property.key as Node) &&
      isStringLiteral(property.value as Node)
  );

const elementName = (name: Node): string => {
  if (name.type === "JSXIdentifier") {
    return name.name as string;
  }
  if (name.type === "JSXNamespacedName") {
    return `${(name.namespace as Node).name}:${(name.name as Node).name}`;
  }
  return `<${name.type}>`;
};

/** What the module holds besides elements, literal text and literal attributes. */
const findCode = (jsx: string) => {
  const program = jsxParser.parse(`<>${jsx}</>`, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as unknown as Node;
  const found: string[] = [];
  walkSimple(
    program as never,
    {
      JSXExpressionContainer: (node: Node) => {
        const expression = node.expression as Node;
        if (
          isStringLiteral(expression) === false &&
          isLiteralObject(expression) === false
        ) {
          found.push(`expression ${expression.type}`);
        }
      },
      JSXSpreadAttribute: () => {
        found.push("spread");
      },
      JSXMemberExpression: () => {
        found.push("member name");
      },
      JSXOpeningElement: (node: Node) => {
        const name = node.name as Node;
        const text = elementName(name);
        if (name.type === "JSXMemberExpression") {
          found.push(`member tag ${text}`);
          return;
        }
        if (
          /^[a-z]/.test(text) === false &&
          ["Script", "Style"].includes(text) === false
        ) {
          found.push(`component tag ${text}`);
        }
      },
      JSXAttribute: (node: Node) => {
        if (node.value && (node.value as Node).type === "JSXElement") {
          found.push("element as a value");
        }
      },
    } as never,
    jsxBase as never
  );
  return found;
};

const passing = [
  '<script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>',
  "<script>window.dataLayer = window.dataLayer || [];</script>",
  "<style>body { color: red }</style>",
  '<meta property="og:title" content="x">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<svg viewBox="0 0 1 1" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/></svg>',
  '<div data-x="1" aria-label="y" class="z"></div>',
  '<div data-my_value="1"></div>',
  '<fb:like href="https://x.example"></fb:like>',
  "<!-- {import()} -->",
];

const accepted = [
  ...passing,
  '<svg><foreignObject><div class="a"></div></foreignObject></svg>',
  "<math><mi>x</mi></math>",
  "<div a=1 a=2></div>",
  '<noscript><p title="</noscript>"></p></noscript>',
  "<template><b>x</b></template>",
  '<div data-amp=1 title="&lt;&amp;&#x7b;"></div>',
  '<div data-x="&quot;}{import()}{&quot;"></div>',
  "<script async src=x></script>",
  '<p class="a" style="color: red; background-image: url(&quot;x&quot;)">t</p>',
  "<p>{import('x')}</p>",
  '<p title="{...globalThis}">`${x}`</p>',
];

describe("htmlToJsx with custom code the name check accepts", () => {
  test.each(accepted)("htmlToJsx writes only literal JSX for %s", (code) => {
    // every input here is one the check lets through ...
    expect(checkCustomCodeNames(code)).toEqual({ ok: true });
    // ... and htmlToJsx writes it as elements and literals, never code
    expect(findCode(htmlToJsx(code))).toEqual([]);
  });

  test("an entity in a name is not decoded, and is refused", () => {
    expect(
      checkCustomCodeNames('<div data-&amp;=1 title="&lt;"></div>')
    ).toEqual({ ok: false, name: "data-&amp;" });
  });

  test("the probe finds code where there is some", () => {
    expect(findCode("<a {...globalThis}></a>")).toEqual(["spread"]);
    expect(findCode("<a x={import('y')}></a>")).toEqual([
      "expression ImportExpression",
    ]);
    expect(findCode("<a.b></a.b>")).toContain(
      "member tag <JSXMemberExpression>"
    );
    expect(findCode("<Foo></Foo>")).toEqual(["component tag Foo"]);
  });

  test("the blocks package and the CLI pin the same parse5", () => {
    const read = (path: string) =>
      JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as {
        dependencies?: Record<string, string>;
      };
    const cli = read("../package.json").dependencies?.parse5;
    const blocks = read("../../sdk-components-organizeos/package.json")
      .dependencies?.parse5;
    expect(cli).toMatch(/^\d+\.\d+\.\d+$/);
    expect(blocks).toBe(cli);
  });

  test("namespaced names compile with the module check's esbuild", async () => {
    const module = `export const CustomCode = () => {
      return (<>${htmlToJsx(
        '<fb:like href="x"></fb:like><div xlink:href="#a"></div>'
      )}</>);
    };`;
    await expect(findGeneratedCodeProblems(module)).resolves.toMatchObject({
      undeclared: [],
      shadowed: [],
    });
  });
});
