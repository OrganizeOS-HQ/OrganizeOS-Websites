/**
 * @vitest-environment jsdom
 */
import { afterEach, expect, test, vi } from "vitest";
import { GIVE_QUERY_KEYS } from "./contract";
import {
  buildGiveSrc,
  encodeSiteTheme,
  isOrgId,
  isPlatformOrigin,
  parseGiveTarget,
  readSiteTheme,
  type GiveSrcInput,
} from "./give-src";

const ORG = "0b5c1a2e-3f4d-4e5a-8b6c-7d8e9f0a1b2c";
const CAMPAIGN = "b1c2d3e4-0000-4000-8000-000000000001";

const decodeTheme = (fragment: string) => {
  const b64 = fragment.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

const input = (overrides: Partial<GiveSrcInput> = {}): GiveSrcInput => ({
  platformOrigin: "https://app.organizeos.org",
  organizationId: ORG,
  target: "general",
  page: { origin: "https://acme.org", pathname: "/donate-now" },
  preview: false,
  unavailable: false,
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

test("platform origins", () => {
  for (const good of ["https://app.organizeos.org", "http://localhost:3000"]) {
    expect(isPlatformOrigin(good), good).toBe(true);
  }
  for (const bad of [
    "https://app.organizeos.org/",
    "https://app.organizeos.org/x",
    "http://app.organizeos.org",
    "javascript:alert(1)",
    "",
    "https://user@app.organizeos.org",
    42,
    undefined,
  ]) {
    expect(isPlatformOrigin(bad), String(bad)).toBe(false);
  }
});

test("org ids and targets", () => {
  expect(isOrgId(ORG)).toBe(true);
  expect(isOrgId(ORG.toUpperCase())).toBe(true);
  for (const bad of ["x", "", ` ${ORG}`, 7, undefined]) {
    expect(isOrgId(bad), String(bad)).toBe(false);
  }
  expect(parseGiveTarget("general")).toBe("general");
  expect(parseGiveTarget(CAMPAIGN.toUpperCase())).toBe(CAMPAIGN);
  for (const bad of ["General", "", "x", null, ` ${CAMPAIGN}`, undefined]) {
    expect(parseGiveTarget(bad), String(bad)).toBeUndefined();
  }
});

test("the address in the fixture's order", () => {
  const src = buildGiveSrc(
    input({
      shareCode: "AbCdEfGh23",
      preview: true,
      unavailable: true,
      theme: "eyJiYXNlIjoiI2ZmZiJ9",
    })
  );
  expect(src).toBe(
    `https://app.organizeos.org/embed/give/${ORG}?to=general&path=%2Fdonate-now&parent=https%3A%2F%2Facme.org&r=AbCdEfGh23&preview=1&state=unavailable#t=eyJiYXNlIjoiI2ZmZiJ9`
  );
  const keys = [...new URL(src).searchParams.keys()];
  expect(keys).toEqual([...GIVE_QUERY_KEYS]);
});

test("org ids are lower-cased", () => {
  const src = buildGiveSrc(input({ organizationId: ORG.toUpperCase() }));
  expect(new URL(src).pathname).toBe(`/embed/give/${ORG}`);
});

test("optional parts", () => {
  const plain = new URL(buildGiveSrc(input({ unavailable: true })));
  expect(plain.searchParams.has("r")).toBe(false);
  expect(plain.searchParams.has("preview")).toBe(false);
  expect(plain.searchParams.has("state")).toBe(false);
  expect(plain.hash).toBe("");
  const preview = new URL(buildGiveSrc(input({ preview: true })));
  expect(preview.searchParams.get("preview")).toBe("1");
  expect(preview.searchParams.has("state")).toBe(false);
  for (const pathname of [
    `/${"a".repeat(500)}`,
    "/with space",
    "/tab\there",
    "/nul\u0000",
  ]) {
    const url = new URL(
      buildGiveSrc(input({ page: { origin: "https://acme.org", pathname } }))
    );
    expect(url.searchParams.has("path"), pathname).toBe(false);
  }
  const longest = `/${"a".repeat(499)}`;
  const kept = new URL(
    buildGiveSrc(
      input({ page: { origin: "https://acme.org", pathname: longest } })
    )
  );
  expect(kept.searchParams.get("path")).toBe(longest);
});

test("the theme round-trips", () => {
  const theme = {
    base: "rgb(255, 248, 240)",
    text: "rgb(20, 20, 20)",
    "font-heading": '"Archivo Black", sans-serif',
  };
  const encoded = encodeSiteTheme(theme);
  expect(encoded).toBeDefined();
  expect(encoded).not.toContain("=");
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(decodeTheme(encoded!)).toEqual(theme);
});

test("an oversized theme gives no fragment", () => {
  const theme = Object.fromEntries(
    ["base", "text", "accent-1", "accent-2", "font-heading", "font-body"].map(
      (name) => [name, "x".repeat(800)]
    )
  );
  expect(encodeSiteTheme(theme)).toBeUndefined();
});

// A stub of getComputedStyle: the element's custom properties as declared,
// and the probe's `color` resolved through `resolved`, as a browser resolves
// `color: var(--name)` into `rgb(...)`.
const stubStyles = (
  declared: Record<string, string>,
  resolved: Record<string, string>
) => {
  vi.spyOn(window, "getComputedStyle").mockImplementation((node: Element) => {
    const inline = node.getAttribute("style") ?? "";
    const match = /^color: var\(--([a-z0-9-]+)\)$/.exec(inline);
    return {
      getPropertyValue: (name: string) => declared[name] ?? "",
      color: match ? (resolved[match[1]] ?? "rgb(0, 0, 0)") : "",
    } as unknown as CSSStyleDeclaration;
  });
};

test("colours the builder writes are resolved", () => {
  const el = document.createElement("div");
  document.body.append(el);
  for (const declared of [
    "rgb(255 248 240 / 1)",
    "hsl(30 100% 97%)",
    "white",
    "var(--other)",
  ]) {
    stubStyles({ "--base": declared }, { base: "rgb(255, 248, 240)" });
    expect(readSiteTheme(el), declared).toEqual({ base: "rgb(255, 248, 240)" });
    vi.restoreAllMocks();
  }
});

test("an unset colour is absent, and fonts come back as declared", () => {
  const el = document.createElement("div");
  document.body.append(el);
  stubStyles(
    {
      "--text": "  rgb(20 20 20 / 1)  ",
      "--font-heading": '  "Archivo Black", sans-serif ',
      "--font-body": "",
    },
    { text: "rgb(20, 20, 20)", base: "rgb(1, 2, 3)" }
  );
  expect(readSiteTheme(el)).toEqual({
    text: "rgb(20, 20, 20)",
    "font-heading": '"Archivo Black", sans-serif',
  });
});

test("no variables, no fragment", () => {
  const el = document.createElement("div");
  document.body.append(el);
  stubStyles({}, {});
  const theme = readSiteTheme(el);
  expect(theme).toEqual({});
  expect(encodeSiteTheme(theme)).toBeUndefined();
});

test("reads only the six names, drops values over 200 characters, and removes its probe", () => {
  const el = document.createElement("div");
  document.body.append(el);
  stubStyles(
    {
      "--font-body": "x".repeat(201),
      "--font-heading": "Public Sans",
      "--accent-text": "rgb(1, 2, 3)",
    },
    {}
  );
  expect(readSiteTheme(el)).toEqual({ "font-heading": "Public Sans" });
  expect(el.childElementCount).toBe(0);
});
