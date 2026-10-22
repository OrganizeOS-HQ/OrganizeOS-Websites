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
import { elementComponent, tags } from "@webstudio-is/sdk";
import { tagProperty } from "@webstudio-is/sdk/runtime";
import {
  anyTagComponents,
  checksInstanceTag,
  checksTagProp,
  elementTagMayRun,
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
  pausedPropNames,
  pausedSvgTags,
  propNameMayRun,
  tagPropNames,
  templateIconCodes,
  withoutBlockedTagProps,
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
