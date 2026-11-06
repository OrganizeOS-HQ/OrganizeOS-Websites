import { beforeAll, afterAll, describe, expect, test, vi } from "vitest";
import { installGlobals } from "@remix-run/node";
import {
  canvasHost,
  carried,
  chunkDeletes,
  createHandler,
  setCookies,
} from "./organizeos-legacy-session.fixture";

// On Vercel, @vercel/remix calls installGlobals(), so the builder runs with
// Remix's polyfill Headers, which has raw() and no getSetCookie().

describe("old session cookies under Remix's polyfill globals", () => {
  let get: ReturnType<typeof createHandler>;

  beforeAll(() => {
    installGlobals();
    vi.stubEnv("ORGANIZEOS_EXPIRE_LEGACY_SESSION", "true");
    get = createHandler();
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  test("the polyfill is in place", () => {
    const headers = new Headers() as Headers & { raw?: unknown };
    expect(typeof headers.getSetCookie).toBe("undefined");
    expect(typeof headers.raw).toBe("function");
  });

  test("a canvas document deletes each chunk twice after the route's own cookie", async () => {
    const response = await get(`${canvasHost}/canvas`, carried);

    expect(response.status).toBe(200);
    expect(setCookies(response.headers)).toEqual([
      "_csrf=1; Path=/; HttpOnly",
      ...chunkDeletes,
    ]);
  });

  test("a document Remix renders again after an error carries each delete once", async () => {
    const response = await get(`${canvasHost}/broken`, carried);

    expect(response.status).toBe(500);
    expect(setCookies(response.headers)).toEqual(chunkDeletes);
  });

  test("an asset response carries no deletes", async () => {
    const response = await get(`${canvasHost}/cgi/asset/logo.png`, carried);

    expect(response.status).toBe(200);
    expect(setCookies(response.headers)).toEqual([]);
  });
});
