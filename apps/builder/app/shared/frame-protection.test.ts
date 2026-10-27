/**
 * @vitest-environment node
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  builderFrameSrcPolicy,
  FRAME_ANCESTORS,
  frameProtectionHeaders,
  withFrameAncestors,
} from "./frame-protection";

describe("frameProtectionHeaders", () => {
  test("lets only the page's own origin frame it, for browsers with and without frame-ancestors", () => {
    expect(FRAME_ANCESTORS).toBe("frame-ancestors 'self'");
    expect(frameProtectionHeaders).toEqual({
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
    });
  });

  test("is frozen, since every response shares it", () => {
    expect(Object.isFrozen(frameProtectionHeaders)).toBe(true);
  });
});

describe("withFrameAncestors", () => {
  test.each([
    ["null", null],
    ["undefined", undefined],
    ["empty", ""],
    ["blank", "  \t "],
    ["only separators", " ; ;"],
  ])("is frame-ancestors alone when the policy is %s", (_name, csp) => {
    expect(withFrameAncestors(csp)).toBe("frame-ancestors 'self'");
  });

  test("appends to an existing policy and keeps its directives", () => {
    expect(
      withFrameAncestors(
        "frame-src https://builder.test/canvas https://app.goentri.com/; worker-src blob:"
      )
    ).toBe(
      "frame-src https://builder.test/canvas https://app.goentri.com/; worker-src blob:; frame-ancestors 'self'"
    );
  });

  test("tolerates a trailing semicolon and whitespace", () => {
    expect(withFrameAncestors("worker-src blob:;")).toBe(
      "worker-src blob:; frame-ancestors 'self'"
    );
    expect(withFrameAncestors("  worker-src blob: ;  ")).toBe(
      "worker-src blob:; frame-ancestors 'self'"
    );
    expect(withFrameAncestors("worker-src blob:;;\n")).toBe(
      "worker-src blob:; frame-ancestors 'self'"
    );
  });

  test("does not repeat a frame-ancestors the policy already has", () => {
    expect(withFrameAncestors("frame-ancestors 'self'")).toBe(
      "frame-ancestors 'self'"
    );
    expect(withFrameAncestors("worker-src blob:; frame-ancestors 'self'")).toBe(
      "worker-src blob:; frame-ancestors 'self'"
    );
    expect(withFrameAncestors("frame-ancestors 'self'; worker-src blob:")).toBe(
      "frame-ancestors 'self'; worker-src blob:"
    );
    // Trailing separators are dropped here too
    expect(
      withFrameAncestors("worker-src blob:; frame-ancestors 'self';")
    ).toBe("worker-src blob:; frame-ancestors 'self'");
  });

  test("leaves a different frame-ancestors the policy set on purpose", () => {
    expect(withFrameAncestors("frame-ancestors 'none'")).toBe(
      "frame-ancestors 'none'"
    );
  });

  test("recognises the directive however it is written", () => {
    expect(withFrameAncestors("Frame-Ancestors 'none'")).toBe(
      "Frame-Ancestors 'none'"
    );
    expect(withFrameAncestors("worker-src blob:;frame-ancestors 'none'")).toBe(
      "worker-src blob:;frame-ancestors 'none'"
    );
    expect(withFrameAncestors("worker-src blob:;   FRAME-ANCESTORS  *")).toBe(
      "worker-src blob:;   FRAME-ANCESTORS  *"
    );
  });

  test("does not take a value or another directive for frame-ancestors", () => {
    expect(
      withFrameAncestors("report-uri https://reports.test/frame-ancestors")
    ).toBe(
      "report-uri https://reports.test/frame-ancestors; frame-ancestors 'self'"
    );
    expect(withFrameAncestors("frame-ancestors-extra 'none'")).toBe(
      "frame-ancestors-extra 'none'; frame-ancestors 'self'"
    );
  });

  test("gives one policy, never a second header's worth", () => {
    const policy = withFrameAncestors("frame-src 'self'; worker-src blob:");
    expect(policy.match(/frame-ancestors/g)).toHaveLength(1);
    expect(policy).not.toContain(",");
  });
});

describe("builderFrameSrcPolicy", () => {
  test("frames the canvas, Entri and the OrganizeOS app's origin, for the CMS panel", () => {
    expect(
      builderFrameSrcPolicy(
        "https://p-1.builder.organizeos.org",
        "https://app.organizeos.org"
      )
    ).toBe(
      "frame-src https://p-1.builder.organizeos.org/canvas https://app.goentri.com/ https://app.organizeos.org; worker-src blob:"
    );
  });

  test("takes only the app URL's origin", () => {
    expect(
      builderFrameSrcPolicy(
        "https://p-1.builder.organizeos.org",
        "https://staging.organizeos.org:8443/some/path?x=1"
      )
    ).toContain(" https://staging.organizeos.org:8443;");
  });

  test("adds nothing for an app URL that does not parse", () => {
    expect(
      builderFrameSrcPolicy("https://p-1.builder.organizeos.org", "not a url")
    ).toBe(
      "frame-src https://p-1.builder.organizeos.org/canvas https://app.goentri.com/; worker-src blob:"
    );
  });

  test("the builder route sends it with ORGANIZEOS_APP_URL", () => {
    const route = readFileSync(
      fileURLToPath(new URL("../routes/_ui.(builder).tsx", import.meta.url)),
      "utf8"
    );
    expect(route).toMatch(
      /"Content-Security-Policy",\s*builderFrameSrcPolicy\(url\.origin, env\.ORGANIZEOS_APP_URL\)/
    );
  });
});
