import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  loadSiteAddresses,
  publishToTargets,
  PUBLISH_REQUEST_TIMEOUT_MS,
  unpublishTarget,
} from "./organizeos-publish-addresses";

// The builder's fetch adds the CSRF header to every request it sends; the
// dialog sends both its read and its publish through it
const { routeFetch } = vi.hoisted(() => ({ routeFetch: vi.fn() }));

vi.mock("~/shared/fetch.client", () => ({
  fetch: (...args: unknown[]) => routeFetch(...args),
}));

const answer = {
  ok: true,
  host: "www.example.org",
  origin: "https://www.example.org",
  status: "live",
  manageDomainsUrl: "https://app.organizeos.org/example-org/settings/domain",
  launchable: true,
};

const targets = [
  {
    key: "builtin",
    host: "example-org.organizeos.org",
    builtin: true,
    main: false,
    publishedAt: "2026-11-07T12:00:00+00:00",
    live: true,
  },
  {
    key: "www.example.org",
    host: "www.example.org",
    builtin: false,
    main: true,
    publishedAt: null,
    live: false,
  },
];

beforeEach(() => {
  routeFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadSiteAddresses", () => {
  test("reads the answer with its targets", async () => {
    routeFetch.mockResolvedValue(Response.json({ ...answer, targets }));
    expect(await loadSiteAddresses("project-1")).toEqual({
      host: "www.example.org",
      origin: "https://www.example.org",
      status: "live",
      manageDomainsUrl:
        "https://app.organizeos.org/example-org/settings/domain",
      launchable: true,
      targets,
    });
    expect(routeFetch.mock.calls[0][0]).toBe("/rest/organizeos-site/project-1");
  });

  test("reads an answer without targets as one with none", async () => {
    routeFetch.mockResolvedValue(Response.json(answer));
    const loaded = await loadSiteAddresses("project-1");
    expect(loaded).toBeDefined();
    expect(loaded?.targets).toBeUndefined();
  });

  test("refuses an origin that is not https, a malformed target, and a refused read", async () => {
    for (const body of [
      { ...answer, origin: "http://www.example.org" },
      { ...answer, origin: "javascript:alert(1)" },
      { ...answer, targets: [{ ...targets[0], live: "yes" }] },
      { ok: false },
    ]) {
      routeFetch.mockResolvedValue(Response.json(body));
      expect(await loadSiteAddresses("project-1")).toBeUndefined();
    }
    routeFetch.mockResolvedValue(Response.json(answer, { status: 403 }));
    expect(await loadSiteAddresses("project-1")).toBeUndefined();
    routeFetch.mockRejectedValue(new TypeError("offline"));
    expect(await loadSiteAddresses("project-1")).toBeUndefined();
  });
});

describe("publishToTargets", () => {
  test("posts the keys as JSON through the builder's fetch, with a timeout", async () => {
    routeFetch.mockResolvedValue(Response.json({ ok: true }));
    expect(
      await publishToTargets("project-1", ["builtin", "www.example.org"])
    ).toEqual({
      ok: true,
    });
    const [url, init] = routeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/rest/organizeos-publish/project-1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      targets: ["builtin", "www.example.org"],
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(PUBLISH_REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  test("maps each refusal to its code, with the publisher's message", async () => {
    routeFetch.mockResolvedValue(
      Response.json({ ok: false, error: "unknown_target" }, { status: 409 })
    );
    expect(await publishToTargets("project-1", ["builtin"])).toEqual({
      ok: false,
      error: "unknown_target",
    });
    routeFetch.mockResolvedValue(
      Response.json(
        { ok: false, error: "dispatch_failed", message: "Try again." },
        { status: 502 }
      )
    );
    expect(await publishToTargets("project-1", ["builtin"])).toEqual({
      ok: false,
      error: "dispatch_failed",
      message: "Try again.",
    });
    routeFetch.mockResolvedValue(Response.json({ ok: false }, { status: 403 }));
    expect(await publishToTargets("project-1", ["builtin"])).toEqual({
      ok: false,
      error: "forbidden",
    });
    routeFetch.mockResolvedValue(new Response("<html>", { status: 500 }));
    expect(await publishToTargets("project-1", ["builtin"])).toEqual({
      ok: false,
      error: "failed",
    });
  });

  test("resolves a timeout or an abort as timeout, and any other failure as failed, never throwing", async () => {
    for (const name of ["TimeoutError", "AbortError"]) {
      routeFetch.mockRejectedValue(new DOMException("stopped", name));
      expect(await publishToTargets("project-1", ["builtin"]), name).toEqual({
        ok: false,
        error: "timeout",
      });
    }
    routeFetch.mockRejectedValue(new TypeError("offline"));
    expect(await publishToTargets("project-1", ["builtin"])).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("the old site, actions and the replace flag", () => {
  test("reads oldSiteKey and actions, leniently", async () => {
    routeFetch.mockResolvedValue(
      Response.json({
        ...answer,
        targets,
        oldSiteKey: "www.example.org",
        actions: true,
      })
    );
    expect(await loadSiteAddresses("project-1")).toMatchObject({
      oldSiteKey: "www.example.org",
      actions: true,
    });
    routeFetch.mockResolvedValue(
      Response.json({ ...answer, targets, oldSiteKey: 1, actions: "yes" })
    );
    const read = await loadSiteAddresses("project-1");
    expect(read).toBeDefined();
    expect(read?.oldSiteKey).toBeUndefined();
    expect(read?.actions).toBeUndefined();
  });

  test("sends replacePages only when asked", async () => {
    routeFetch.mockResolvedValue(Response.json({ ok: true }));
    await publishToTargets("project-1", ["www.example.org"], {
      replacePages: true,
    });
    await publishToTargets("project-1", ["builtin"]);
    const bodies = routeFetch.mock.calls.map(([, init]) =>
      JSON.parse((init as RequestInit).body as string)
    );
    expect(bodies).toEqual([
      { targets: ["www.example.org"], replacePages: true },
      { targets: ["builtin"] },
    ]);
  });
});

describe("unpublishTarget", () => {
  test("posts the action and key through the builder's fetch, with a timeout", async () => {
    routeFetch.mockResolvedValue(Response.json({ ok: true }));
    expect(await unpublishTarget("project-1", "builtin")).toEqual({ ok: true });
    const [url, init] = routeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/rest/organizeos-site-action/project-1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      action: "unpublish",
      target: "builtin",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("maps each answer to its code, never throwing", async () => {
    const cases: Array<[Response, string]> = [
      [
        Response.json({ ok: false, error: "unavailable" }, { status: 404 }),
        "unavailable",
      ],
      [new Response("<html>", { status: 404 }), "unavailable"],
      [
        Response.json({ ok: false, error: "forbidden" }, { status: 403 }),
        "forbidden",
      ],
      [Response.json({ ok: false }, { status: 403 }), "forbidden"],
      [
        Response.json({ ok: false, error: "rate_limited" }, { status: 429 }),
        "rate_limited",
      ],
      [
        Response.json({ ok: false, error: "not_live" }, { status: 409 }),
        "not_live",
      ],
      [
        Response.json({ ok: false, error: "unknown_target" }, { status: 409 }),
        "unknown_target",
      ],
      [
        Response.json({ ok: false, error: "failed" }, { status: 502 }),
        "failed",
      ],
      [Response.json({ ok: false, error: "weird" }, { status: 500 }), "failed"],
    ];
    for (const [response, error] of cases) {
      routeFetch.mockResolvedValueOnce(response);
      expect(await unpublishTarget("project-1", "builtin")).toEqual({
        ok: false,
        error,
      });
    }
    routeFetch.mockRejectedValueOnce(new DOMException("t", "TimeoutError"));
    expect(await unpublishTarget("project-1", "builtin")).toEqual({
      ok: false,
      error: "timeout",
    });
    routeFetch.mockRejectedValueOnce(new TypeError("offline"));
    expect(await unpublishTarget("project-1", "builtin")).toEqual({
      ok: false,
      error: "failed",
    });
  });
});
