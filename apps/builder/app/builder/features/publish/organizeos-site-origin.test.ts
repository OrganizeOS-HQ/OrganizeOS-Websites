import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  $siteOrigins,
  loadSiteOrigin,
  resetSiteOrigins,
} from "./organizeos-site-origin";

const { routeFetch } = vi.hoisted(() => ({ routeFetch: vi.fn() }));

vi.mock("~/shared/fetch.client", () => ({
  fetch: (...args: unknown[]) => routeFetch(...args),
}));

const answer = (origin: string) => ({
  ok: true,
  host: "www.example.org",
  origin,
  status: "live",
  manageDomainsUrl: "https://app.organizeos.org/example-org/settings/domain",
});

beforeEach(() => {
  resetSiteOrigins();
  routeFetch.mockReset();
});

describe("loadSiteOrigin", () => {
  test("stores the main host's origin and reads once per project", async () => {
    routeFetch.mockResolvedValue(
      Response.json(answer("https://www.example.org"))
    );
    await Promise.all([loadSiteOrigin("p1"), loadSiteOrigin("p1")]);
    await loadSiteOrigin("p1");
    expect(routeFetch).toHaveBeenCalledTimes(1);
    expect($siteOrigins.get().p1).toEqual({
      status: "ready",
      origin: "https://www.example.org",
    });
  });

  test("caches by project id", async () => {
    routeFetch.mockImplementation(async (url: string) =>
      Response.json(
        answer(
          url.endsWith("/p1")
            ? "https://one.example.org"
            : "https://two.example.org"
        )
      )
    );
    await loadSiteOrigin("p1");
    await loadSiteOrigin("p2");
    expect($siteOrigins.get().p1).toEqual({
      status: "ready",
      origin: "https://one.example.org",
    });
    expect($siteOrigins.get().p2).toEqual({
      status: "ready",
      origin: "https://two.example.org",
    });
  });

  test("a failed read gives no origin and is read again later", async () => {
    routeFetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await loadSiteOrigin("p1");
    expect($siteOrigins.get().p1).toEqual({ status: "failed" });
    routeFetch.mockResolvedValueOnce(
      Response.json(answer("https://www.example.org"))
    );
    await loadSiteOrigin("p1");
    expect($siteOrigins.get().p1).toEqual({
      status: "ready",
      origin: "https://www.example.org",
    });
  });

  test("a network error gives no origin", async () => {
    routeFetch.mockRejectedValue(new Error("offline"));
    await loadSiteOrigin("p1");
    expect($siteOrigins.get().p1).toEqual({ status: "failed" });
  });

  test("an origin that is not https gives no origin", async () => {
    routeFetch.mockResolvedValue(
      Response.json(answer("http://www.example.org"))
    );
    await loadSiteOrigin("p1");
    expect($siteOrigins.get().p1).toEqual({ status: "failed" });
  });
});
