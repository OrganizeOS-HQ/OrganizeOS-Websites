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
import { tagProperty } from "@webstudio-is/sdk/runtime";
import {
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
  pausedPropNames,
  pausedSvgTags,
  propNameMayRun,
  tagPropsByComponent,
  templateIconCodes,
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

describe("tagPropsByComponent", () => {
  test("lists the components that choose their element from a prop, and the props that do it", () => {
    expect(Object.fromEntries(tagPropsByComponent)).toEqual({
      Box: ["tag", tagProperty],
      Text: ["tag", tagProperty],
      Heading: ["tag", tagProperty],
      "@webstudio-is/sdk-components-react-radix:DialogTitle": ["tag"],
    });
  });

  test("names the runtime's tag property as the framework does", () => {
    expect(tagProperty).toBe("data-ws-tag");
  });
});
