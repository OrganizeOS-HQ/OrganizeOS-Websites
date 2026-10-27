import { describe, expect, test } from "vitest";
import {
  cleanHref,
  isNavigableUrl,
  isSafeHref,
  safeImageSrc,
  safeLinkHref,
} from "./safe-href";

describe("isSafeHref, the link rule", () => {
  test("allows http:, https:, mailto:, tel:, a root path and a fragment", () => {
    for (const href of [
      "https://example.org",
      "http://example.org/a?b=1#c",
      "HTTPS://EXAMPLE.ORG",
      "mailto:press@example.org",
      "tel:+15550100100",
      "/about",
      "/",
      "/a//b",
      "#top",
      "#",
    ]) {
      expect(isSafeHref(href), href).toBe(true);
      expect(safeLinkHref(href), href).toBe(href);
    }
  });

  test("refuses other schemes, protocol-relative and relative addresses, and what is not a string", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "vbscript:msgbox(1)",
      "data:text/html,<p>hi</p>",
      "sms:+15550100100",
      "ftp://example.org",
      "//evil.example/x",
      "/\\evil.example",
      "about",
      "./about",
      "../about",
      "?q=1",
      "example.org",
      "",
      "   ",
      undefined,
      null,
      42,
      { href: "https://example.org" },
    ]) {
      expect(isSafeHref(href), String(href)).toBe(false);
      expect(safeLinkHref(href), String(href)).toBeUndefined();
    }
  });

  test("strips tabs and newlines and trims first, as a browser does", () => {
    expect(cleanHref(" \n https://exa\tmple.org/a\r\n ")).toBe(
      "https://example.org/a"
    );
    expect(safeLinkHref("  https://example.org  ")).toBe("https://example.org");
    expect(safeLinkHref("\thttps://example.org")).toBe("https://example.org");
    // a browser reads each of these as the scheme or the host it hides
    for (const href of [
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "\u0001javascript:alert(1)",
      "/\t/evil.example",
      "/\n\\evil.example",
      " //evil.example",
    ]) {
      expect(isSafeHref(href), JSON.stringify(href)).toBe(false);
    }
  });

  test("refuses a control character left inside", () => {
    expect(isSafeHref("https://example.org/\u0000a")).toBe(false);
    expect(isSafeHref("mailto:a\u001b@example.org")).toBe(false);
    // at either end it is trimmed, as a browser trims it
    expect(safeLinkHref("https://example.org/\u0000")).toBe(
      "https://example.org/"
    );
    expect(isSafeHref("/a\u007fb")).toBe(false);
  });
});

describe("safeImageSrc", () => {
  test("keeps https: only", () => {
    expect(safeImageSrc("https://cdn.example.org/a.jpg")).toBe(
      "https://cdn.example.org/a.jpg"
    );
    expect(safeImageSrc(" https://cdn.example.org/a.jpg\n")).toBe(
      "https://cdn.example.org/a.jpg"
    );
    for (const src of [
      "http://cdn.example.org/a.jpg",
      "//cdn.example.org/a.jpg",
      "/a.jpg",
      "data:image/png;base64,iVBORw0KGgo=",
      "javascript:alert(1)",
      "",
      undefined,
    ]) {
      expect(safeImageSrc(src), String(src)).toBeUndefined();
    }
  });
});

describe("isNavigableUrl, the navigation rule", () => {
  test("http: and https: only", () => {
    expect(isNavigableUrl(new URL("https://example.org"))).toBe(true);
    expect(isNavigableUrl(new URL("http://example.org"))).toBe(true);
    for (const href of [
      "mailto:ada@example.org",
      "tel:+15550100100",
      "javascript:alert(1)",
      "data:text/html,hi",
    ]) {
      expect(isNavigableUrl(new URL(href)), href).toBe(false);
    }
  });
});
