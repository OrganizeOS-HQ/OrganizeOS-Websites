import { afterEach, describe, expect, test, vi } from "vitest";

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
