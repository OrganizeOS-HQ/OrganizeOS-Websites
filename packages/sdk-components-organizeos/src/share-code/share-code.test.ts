import { afterEach, describe, expect, test, vi } from "vitest";
import fixture from "../__fixtures__/share-code.json";
import {
  isPlatformPath,
  isShareCode,
  platformPathPatterns,
  readPageShareCode,
  readShareCode,
  shareCodeParam,
  shareCodePattern,
  withShareCode,
} from "./share-code";

// share-code.json is OrganizeOS's, copied unchanged: OrganizeOS tests its own
// constants against the same bytes, so the two copies cannot drift apart.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("share-code.ts", () => {
  test("is the platform's parameter and pattern, as share-code.json records them", () => {
    expect(shareCodeParam).toBe(fixture.param);
    expect(shareCodePattern.source).toBe(fixture.pattern);
    expect(shareCodePattern.flags).toBe("");
  });

  test("is the platform's list of platform paths, as share-code.json records it", () => {
    expect(platformPathPatterns.map((pattern) => pattern.source)).toEqual(
      fixture.platformPathPatterns
    );
    for (const pattern of platformPathPatterns) {
      expect(pattern.flags, pattern.source).toBe("");
    }
  });

  test("accepts and refuses every code the fixture lists", () => {
    expect(fixture.codes.valid.length).toBeGreaterThan(0);
    expect(fixture.codes.invalid.length).toBeGreaterThan(0);
    for (const code of fixture.codes.valid) {
      expect(isShareCode(code), code).toBe(true);
      expect(readShareCode(`?${shareCodeParam}=${code}`), code).toBe(code);
    }
    for (const code of fixture.codes.invalid) {
      expect(isShareCode(code), code).toBe(false);
      expect(
        readShareCode(new URLSearchParams({ [shareCodeParam]: code })),
        code
      ).toBeUndefined();
    }
    for (const value of [undefined, null, 1234567890, {}, ["Code234567"]]) {
      expect(isShareCode(value)).toBe(false);
    }
    // the first value, as URLSearchParams.get gives it
    expect(readShareCode("?r=Code234567&r=abcDEF2345")).toBe("Code234567");
    expect(readShareCode("?r=bad&r=Code234567")).toBeUndefined();
    // the parameter is r, and only r
    expect(readShareCode("?ref=Code234567")).toBeUndefined();
    for (const search of ["", null, undefined]) {
      expect(readShareCode(search)).toBeUndefined();
    }
  });

  test("classifies every path the fixture lists, a trailing slash included", () => {
    expect(fixture.paths.platform).toContain("/donate/spring-drive/");
    expect(fixture.paths.notCarried).toContain("/events/");
    for (const path of fixture.paths.platform) {
      expect(isPlatformPath(path), path).toBe(true);
    }
    for (const path of fixture.paths.notCarried) {
      expect(isPlatformPath(path), path).toBe(false);
    }
    // every pattern has a path in the fixture
    for (const pattern of platformPathPatterns) {
      expect(
        fixture.paths.platform.some((path) =>
          pattern.test(path.length > 1 ? path.replace(/\/+$/, "") : path)
        ),
        pattern.source
      ).toBe(true);
    }
  });

  test("gives every carry case the fixture lists", () => {
    expect(fixture.carry.length).toBeGreaterThan(0);
    for (const { href, code, carried } of fixture.carry) {
      expect(withShareCode(href, code), href).toBe(carried);
    }
    expect(withShareCode("/join", undefined)).toBe("/join");
    expect(withShareCode("/join", null)).toBe("/join");
  });

  test("readPageShareCode reads the address when called, and nothing on the server", () => {
    const location = { search: "" };
    vi.stubGlobal("window", { location });
    expect(readPageShareCode()).toBeUndefined();
    location.search = "?r=Code234567";
    expect(readPageShareCode()).toBe("Code234567");
    location.search = "?r=bad";
    expect(readPageShareCode()).toBeUndefined();
    location.search = "?r=abcDEF2345";
    expect(readPageShareCode()).toBe("abcDEF2345");
    vi.unstubAllGlobals();
    // this file runs in node: no window, so no code
    expect(typeof window).toBe("undefined");
    expect(readPageShareCode()).toBeUndefined();
  });
});
