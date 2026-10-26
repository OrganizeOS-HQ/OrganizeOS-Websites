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
import { elementComponent, tags, type Prop } from "@webstudio-is/sdk";
import { tagProperty } from "@webstudio-is/sdk/runtime";
import {
  allowedUrlSchemes,
  anyTagComponents,
  checksInstanceTag,
  checksTagProp,
  elementTagMayRun,
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
  pageRedirectMayShip,
  pausedPropNames,
  pausedSvgTags,
  projectRedirectMayShip,
  propMayShip,
  propNameMayRun,
  tagPropNames,
  templateIconCodes,
  urlExpressionMayRun,
  urlMayRun,
  urlValueMayRun,
  withoutBlockedTagProps,
  withoutPausedProps,
} from "./org-script";

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

  test("ships every prop of XML Node and XML Time", () => {
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
