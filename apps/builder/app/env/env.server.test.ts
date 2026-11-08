import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

const loadEnv = async () => {
  vi.resetModules();
  return (await import("./env.server")).default;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ORGANIZEOS_SESSION_BINDING", () => {
  test("defaults to observe when unset", async () => {
    vi.stubEnv("ORGANIZEOS_SESSION_BINDING", undefined);
    expect((await loadEnv()).ORGANIZEOS_SESSION_BINDING).toBe("observe");
  });

  test("reads a blank value as unset instead of failing at load", async () => {
    vi.stubEnv("ORGANIZEOS_SESSION_BINDING", "");
    expect((await loadEnv()).ORGANIZEOS_SESSION_BINDING).toBe("observe");
  });

  test("reads enforce from the process environment", async () => {
    vi.stubEnv("ORGANIZEOS_SESSION_BINDING", "enforce");
    expect((await loadEnv()).ORGANIZEOS_SESSION_BINDING).toBe("enforce");
  });

  // apps/builder moved to zod 4 with upstream 0.309.0, where a preprocess
  // around a defaulted enum is a pipe: the default must still apply to an
  // unset and to a blank value.
  test("ORGANIZEOS_SESSION_BINDING defaults to observe under zod 4", async () => {
    // zod 4 schemas carry their internals on `_zod`; zod 3's do not
    expect(z.string()).toHaveProperty("_zod");
    vi.stubEnv("ORGANIZEOS_SESSION_BINDING", undefined);
    expect((await loadEnv()).ORGANIZEOS_SESSION_BINDING).toBe("observe");
    vi.stubEnv("ORGANIZEOS_SESSION_BINDING", "");
    expect((await loadEnv()).ORGANIZEOS_SESSION_BINDING).toBe("observe");
  });
});

describe("EMAIL_SERVICE_URL", () => {
  test("is in the schema and undefined when unset", async () => {
    vi.stubEnv("EMAIL_SERVICE_URL", undefined);
    expect((await loadEnv()).EMAIL_SERVICE_URL).toBeUndefined();
    vi.stubEnv("EMAIL_SERVICE_URL", "https://email.example");
    expect((await loadEnv()).EMAIL_SERVICE_URL).toBe("https://email.example");
  });

  // Set, the builder's Form preview would send TRPC_SERVER_API_TOKEN as a
  // bearer to Webstudio's email service (routes/rest.preview-form.ts).
  test("the committed .env sets neither it nor TRPC_SERVER_API_TOKEN", () => {
    const dotenv = readFileSync(
      fileURLToPath(new URL("../../.env", import.meta.url)),
      "utf8"
    );
    const setKeys = dotenv
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && line.startsWith("#") === false)
      .map((line) => line.split("=")[0].trim());
    expect(setKeys.length).toBeGreaterThan(0);
    expect(setKeys).not.toContain("EMAIL_SERVICE_URL");
    expect(setKeys).not.toContain("TRPC_SERVER_API_TOKEN");
  });
});

describe("WEBSITES2_PREVIEW_SECRET", () => {
  test("is undefined when unset", async () => {
    vi.stubEnv("WEBSITES2_PREVIEW_SECRET", undefined);
    expect((await loadEnv()).WEBSITES2_PREVIEW_SECRET).toBeUndefined();
  });

  test("reads a blank value as unset", async () => {
    vi.stubEnv("WEBSITES2_PREVIEW_SECRET", "  ");
    expect((await loadEnv()).WEBSITES2_PREVIEW_SECRET).toBeUndefined();
  });

  test("reads the secret from the process environment", async () => {
    vi.stubEnv("WEBSITES2_PREVIEW_SECRET", "s3cret");
    expect((await loadEnv()).WEBSITES2_PREVIEW_SECRET).toBe("s3cret");
  });
});

describe("ORGANIZEOS_CMS_PANEL", () => {
  test("is undefined when unset", async () => {
    vi.stubEnv("ORGANIZEOS_CMS_PANEL", undefined);
    expect((await loadEnv()).ORGANIZEOS_CMS_PANEL).toBeUndefined();
  });

  test("passes the raw value through", async () => {
    vi.stubEnv("ORGANIZEOS_CMS_PANEL", "true");
    expect((await loadEnv()).ORGANIZEOS_CMS_PANEL).toBe("true");
  });
});

describe("ORGANIZEOS_SHOP_BLOCKS", () => {
  test("is undefined when unset", async () => {
    vi.stubEnv("ORGANIZEOS_SHOP_BLOCKS", undefined);
    expect((await loadEnv()).ORGANIZEOS_SHOP_BLOCKS).toBeUndefined();
  });

  test("passes the raw value through", async () => {
    vi.stubEnv("ORGANIZEOS_SHOP_BLOCKS", "TRUE");
    expect((await loadEnv()).ORGANIZEOS_SHOP_BLOCKS).toBe("TRUE");
  });
});

describe("ORGANIZEOS_BLOCKS_DENY_ORG_IDS", () => {
  test("passes the raw value through", async () => {
    vi.stubEnv("ORGANIZEOS_BLOCKS_DENY_ORG_IDS", " a , b ");
    expect((await loadEnv()).ORGANIZEOS_BLOCKS_DENY_ORG_IDS).toBe(" a , b ");
  });

  test("is undefined when unset", async () => {
    vi.stubEnv("ORGANIZEOS_BLOCKS_DENY_ORG_IDS", undefined);
    expect((await loadEnv()).ORGANIZEOS_BLOCKS_DENY_ORG_IDS).toBeUndefined();
  });

  // The allowlist it replaces is never read again, so a value left behind in
  // a deployment can neither offer nor deny the blocks
  test("leaves ORGANIZEOS_BLOCKS_ORG_IDS out of env even when it is set", async () => {
    vi.stubEnv(
      "ORGANIZEOS_BLOCKS_ORG_IDS",
      "f0e1d2c3-b4a5-4697-8877-665544332211"
    );
    expect("ORGANIZEOS_BLOCKS_ORG_IDS" in (await loadEnv())).toBe(false);
  });
});
