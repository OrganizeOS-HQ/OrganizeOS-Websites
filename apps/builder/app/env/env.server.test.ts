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
