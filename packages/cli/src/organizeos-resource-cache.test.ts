import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { loadResource } from "@webstudio-is/sdk/runtime";
import {
  createResourceCache,
  siteResourceCache,
} from "../templates/react-router/app/organizeos-resource-cache";

// OrganizeOS fork: the in-memory resource cache published sites' loaders use
// (templates/react-router/app/organizeos-resource-cache.ts).

const url = "https://app.example.org/api/public/v1/forms";
const cacheable = "public, s-maxage=60";
const staleIfError = "public, s-maxage=60, stale-if-error=600";
const authorized = { headers: { Authorization: "Bearer token" } };

type Options = NonNullable<Parameters<typeof createResourceCache>[0]>;

type Reply = {
  body?: string;
  status?: number;
  headers?: Record<string, string>;
};

const reply = ({ body = "body", status = 200, headers = {} }: Reply = {}) =>
  new Response(body, { status, headers });

/** A response whose body fails while it is read. */
const brokenBody = () =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.error(new Error("connection reset"));
      },
    })
  );

/** A cache over a stubbed network and a clock that moves only when told. */
const setup = (options: Omit<Options, "fetch" | "now"> = {}) => {
  let time = 0;
  const network = vi.fn<typeof fetch>();
  const cache = createResourceCache({
    ...options,
    fetch: network,
    now: () => time,
  });
  const wait = (seconds: number) => {
    time += Math.round(seconds * 1000);
  };
  return { cache, network, wait };
};

const get = (cache: typeof fetch, init: RequestInit = {}, at = url) =>
  cache(at, { method: "get", ...init });

const read = async (response: Promise<Response>) => (await response).text();

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("what it stores", () => {
  test("serves a 200 with public, s-maxage=60 without a request until 60 seconds pass, then refetches", async () => {
    const { cache, network, wait } = setup();
    network.mockImplementation(async () =>
      reply({ body: "forms", headers: { "cache-control": cacheable } })
    );

    expect(await read(get(cache))).toBe("forms");
    wait(59.999);
    expect(await read(get(cache))).toBe("forms");
    expect(network).toHaveBeenCalledTimes(1);

    wait(0.001);
    expect(await read(get(cache))).toBe("forms");
    expect(network).toHaveBeenCalledTimes(2);
  });

  test.each<{ name: string; init?: RequestInit; reply: Reply }>([
    {
      name: "a POST",
      init: { method: "post" },
      reply: { headers: { "cache-control": cacheable } },
    },
    {
      name: "a 404 with no Cache-Control",
      reply: { status: 404 },
    },
    {
      name: "a 404 with private",
      reply: {
        status: 404,
        headers: { "cache-control": "private, max-age=60" },
      },
    },
    {
      name: "a max-age-only 404 to a request with Authorization",
      init: authorized,
      reply: { status: 404, headers: { "cache-control": "max-age=60" } },
    },
    {
      name: "a 401",
      reply: { status: 401, headers: { "cache-control": cacheable } },
    },
    {
      name: "a 429",
      reply: { status: 429, headers: { "cache-control": cacheable } },
    },
    ...[500, 502, 503, 504].map((status) => ({
      name: `a ${status}`,
      reply: { status, headers: { "cache-control": cacheable } },
    })),
    {
      name: "no-store",
      reply: { headers: { "cache-control": `${cacheable}, no-store` } },
    },
    {
      name: "private",
      reply: { headers: { "cache-control": "private, s-maxage=60" } },
    },
    {
      name: "no-cache",
      reply: { headers: { "cache-control": `${cacheable}, no-cache` } },
    },
    {
      name: "a no-store after a quoted comma and an escaped quote",
      reply: {
        headers: { "cache-control": `${cacheable}, x="a\\", b", no-store` },
      },
    },
    { name: "no Cache-Control", reply: {} },
    {
      name: "s-maxage=0, which overrides max-age",
      reply: { headers: { "cache-control": "public, s-maxage=0, max-age=60" } },
    },
    {
      name: "Vary: *",
      reply: { headers: { "cache-control": cacheable, vary: "Accept, *" } },
    },
    {
      name: "a Set-Cookie response",
      reply: {
        headers: { "cache-control": cacheable, "set-cookie": "session=1" },
      },
    },
    {
      name: "a max-age-only response to a request with Authorization",
      init: authorized,
      reply: { headers: { "cache-control": "max-age=60" } },
    },
  ])("never caches $name", async ({ init, reply: answer }) => {
    const { cache, network } = setup();
    network.mockImplementation(async () => reply(answer));

    await read(get(cache, init));
    await read(get(cache, init));

    expect(network).toHaveBeenCalledTimes(2);
  });

  test.each([
    { name: "max-age without Authorization", cacheControl: "max-age=60" },
    {
      name: "public with max-age to a request with Authorization",
      init: authorized,
      cacheControl: "public, max-age=60",
    },
    {
      name: "s-maxage to a request with Authorization",
      init: authorized,
      cacheControl: "s-maxage=60",
    },
  ])("caches $name", async ({ init, cacheControl }) => {
    const { cache, network } = setup();
    network.mockImplementation(async () =>
      reply({ headers: { "cache-control": cacheControl } })
    );

    await read(get(cache, init));
    await read(get(cache, init));

    expect(network).toHaveBeenCalledTimes(1);
  });

  test("caps freshness at 300 seconds", async () => {
    const { cache, network, wait } = setup();
    network.mockImplementation(async () =>
      reply({ headers: { "cache-control": "public, s-maxage=3600" } })
    );

    await read(get(cache));
    wait(299.999);
    await read(get(cache));
    expect(network).toHaveBeenCalledTimes(1);

    wait(0.001);
    await read(get(cache));
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("subtracts Age from freshness", async () => {
    const { cache, network, wait } = setup();
    network.mockImplementation(async () =>
      reply({ headers: { "cache-control": cacheable, age: "20" } })
    );

    await read(get(cache));
    wait(39.999);
    await read(get(cache));
    expect(network).toHaveBeenCalledTimes(1);

    wait(0.001);
    await read(get(cache));
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("does not store a response whose Age has used up its freshness", async () => {
    const { cache, network } = setup();
    network.mockImplementation(async () =>
      reply({ headers: { "cache-control": cacheable, age: "60" } })
    );

    await read(get(cache));
    await read(get(cache));

    expect(network).toHaveBeenCalledTimes(2);
  });

  test("a successful refresh replaces the stored body", async () => {
    const { cache, network, wait } = setup();
    network
      .mockResolvedValueOnce(
        reply({ body: "old", headers: { "cache-control": cacheable } })
      )
      .mockResolvedValueOnce(
        reply({ body: "new", headers: { "cache-control": cacheable } })
      );

    expect(await read(get(cache))).toBe("old");
    wait(60);
    expect(await read(get(cache))).toBe("new");
    wait(59);
    expect(await read(get(cache))).toBe("new");
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("returns a body that reads correctly through the sdk's loadResource", async () => {
    const { cache, network } = setup();
    network.mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: [{ id: "form-1" }] }), {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/json",
            "cache-control": cacheable,
          },
        })
    );
    const request = {
      name: "forms",
      method: "get" as const,
      url,
      searchParams: [],
      headers: [{ name: "Authorization", value: "Bearer token" }],
    };
    const expected = {
      ok: true,
      status: 200,
      statusText: "OK",
      data: { data: [{ id: "form-1" }] },
    };

    expect(await loadResource(cache, request)).toEqual(expected);
    expect(await loadResource(cache, request)).toEqual(expected);
    expect(network).toHaveBeenCalledTimes(1);
  });
});

describe("a 404 that declares a lifetime", () => {
  // The platform's collections item route answers a missing item with a 404
  // and public, s-maxage=60, so a crawler walking random slugs reads it once
  // a minute per server instance, not once per request.
  const missing = `${url.replace("/forms", "/collections/blog/items")}/nope`;

  test("keeps a 404 with s-maxage for that lifetime, then refetches", async () => {
    const { cache, network, wait } = setup();
    network.mockImplementation(async () =>
      reply({
        body: "not found",
        status: 404,
        headers: { "cache-control": cacheable },
      })
    );

    const first = await get(cache, authorized, missing);
    expect(first.status).toBe(404);
    expect(await first.text()).toBe("not found");
    wait(59.999);
    const second = await get(cache, authorized, missing);
    expect(second.status).toBe(404);
    expect(await second.text()).toBe("not found");
    expect(network).toHaveBeenCalledTimes(1);

    wait(0.001);
    await read(get(cache, authorized, missing));
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("reads as not ok through the sdk's loadResource, stored or not", async () => {
    const { cache, network } = setup();
    network.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          statusText: "Not Found",
          headers: {
            "content-type": "application/json",
            "cache-control": cacheable,
          },
        })
    );
    const request = {
      name: "currentItem",
      method: "get" as const,
      url: missing,
      searchParams: [],
      headers: [{ name: "Authorization", value: "Bearer token" }],
    };
    const expected = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      data: { error: "Not found" },
    };

    expect(await loadResource(cache, request)).toEqual(expected);
    expect(await loadResource(cache, request)).toEqual(expected);
    expect(network).toHaveBeenCalledTimes(1);
  });

  test("a refresh that answers 404 replaces a stored 200, and is not a failure that serves stale", async () => {
    const { cache, network, wait } = setup();
    network
      .mockResolvedValueOnce(
        reply({ body: "item", headers: { "cache-control": staleIfError } })
      )
      .mockResolvedValueOnce(
        reply({
          body: "gone",
          status: 404,
          headers: { "cache-control": cacheable },
        })
      );

    expect(await read(get(cache))).toBe("item");
    wait(61);
    const refreshed = await get(cache);
    expect(refreshed.status).toBe(404);
    expect(await refreshed.text()).toBe("gone");
    wait(30);
    const stored = await get(cache);
    expect(stored.status).toBe(404);
    expect(network).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  test("a refresh that answers 200 replaces a stored 404", async () => {
    const { cache, network, wait } = setup();
    network
      .mockResolvedValueOnce(
        reply({
          body: "gone",
          status: 404,
          headers: { "cache-control": cacheable },
        })
      )
      .mockResolvedValueOnce(
        reply({ body: "item", headers: { "cache-control": cacheable } })
      );

    expect((await get(cache)).status).toBe(404);
    wait(60);
    expect(await read(get(cache))).toBe("item");
  });

  test("a stored 404 answers a failed refresh within stale-if-error, as any stored response does", async () => {
    const { cache, network, wait } = setup();
    network
      .mockResolvedValueOnce(
        reply({
          body: "gone",
          status: 404,
          headers: { "cache-control": staleIfError },
        })
      )
      .mockResolvedValueOnce(reply({ body: "down", status: 503 }));

    expect((await get(cache)).status).toBe(404);
    wait(61);
    const response = await get(cache);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("gone");
  });
});

describe("what it keys on", () => {
  test("requests that differ only in Authorization both reach the network, each for its own body", async () => {
    const { cache, network } = setup();
    network.mockImplementation(async (_input, init) =>
      reply({
        body: `forms for ${new Headers(init?.headers).get("authorization")}`,
        headers: { "cache-control": cacheable },
      })
    );
    const a = { headers: { Authorization: "Bearer a" } };
    const b = { headers: { Authorization: "Bearer b" } };

    expect(await read(get(cache, a))).toBe("forms for Bearer a");
    expect(await read(get(cache, b))).toBe("forms for Bearer b");
    expect(network).toHaveBeenCalledTimes(2);

    expect(await read(get(cache, a))).toBe("forms for Bearer a");
    expect(await read(get(cache, b))).toBe("forms for Bearer b");
    expect(network).toHaveBeenCalledTimes(2);
  });

  test('caches "get", and "GET" shares its key', async () => {
    const { cache, network } = setup();
    network.mockImplementation(async () =>
      reply({ headers: { "cache-control": cacheable } })
    );

    await read(get(cache, { method: "get" }));
    await read(get(cache, { method: "GET" }));
    await read(cache(url));

    expect(network).toHaveBeenCalledTimes(1);
  });

  test("requests that differ only in their query string get separate entries", async () => {
    const { cache, network } = setup();
    network.mockImplementation(async (input) =>
      reply({ body: String(input), headers: { "cache-control": cacheable } })
    );

    expect(await read(get(cache, {}, `${url}?page=1`))).toBe(`${url}?page=1`);
    expect(await read(get(cache, {}, `${url}?page=2`))).toBe(`${url}?page=2`);
    expect(await read(get(cache, {}, `${url}?page=1`))).toBe(`${url}?page=1`);

    expect(network).toHaveBeenCalledTimes(2);
  });

  test("a request with its own Cache-Control bypasses the cache", async () => {
    const { cache, network } = setup();
    network.mockImplementation(async () =>
      reply({ headers: { "cache-control": cacheable } })
    );
    const optIn = { headers: { "Cache-Control": "max-age=60" } };

    await read(get(cache));
    // Each reaches the network, though the same request just got a
    // cacheable response.
    await read(get(cache, optIn));
    await read(get(cache, optIn));

    expect(network).toHaveBeenCalledTimes(3);
  });

  test("hands the underlying fetch the URL and init it would have had without the cache", async () => {
    const { cache, network } = setup();
    network.mockImplementation(async () =>
      reply({ headers: { "cache-control": cacheable } })
    );
    const requests: Array<[string, RequestInit]> = [
      [
        url,
        {
          method: "get",
          headers: { Authorization: "Bearer Token-ABC", "X-Site": "Acme" },
        },
      ],
      [
        `${url}?page=2`,
        { method: "get", headers: new Headers({ Authorization: "Bearer b" }) },
      ],
      [url, { method: "post", body: "{}", headers: authorized.headers }],
      [url, { method: "get", headers: { "Cache-Control": "max-age=60" } }],
    ];

    for (const [input, init] of requests) {
      await read(cache(input, init));
    }

    expect(network.mock.calls).toHaveLength(requests.length);
    requests.forEach(([input], index) => {
      expect(network.mock.calls[index][0]).toBe(input);
    });
    // What the cache requests gets the same init, with its deadline added.
    requests.slice(0, 2).forEach(([_input, init], index) => {
      const sent = network.mock.calls[index][1];
      expect(sent).toEqual({ ...init, signal: expect.any(AbortSignal) });
      expect(sent?.headers).toBe(init.headers);
    });
    // What goes straight through gets the very init.
    requests.slice(2).forEach(([_input, init], index) => {
      expect(network.mock.calls[index + 2][1]).toBe(init);
    });
    expect(requests[0][1]).toEqual({
      method: "get",
      headers: { Authorization: "Bearer Token-ABC", "X-Site": "Acme" },
    });
  });
});

describe("one cache for every route", () => {
  /** A route's own fetch behind the cache, answering a cacheable body. */
  const routeFetch = (body: string) =>
    vi.fn<typeof fetch>(async () =>
      reply({ body, headers: { "cache-control": cacheable } })
    );

  test("serves an entry stored through one route's fetch to a call passing another's, without a request", async () => {
    const { cache, network } = setup();
    const html = routeFetch("through html");
    const xml = routeFetch("through xml");

    expect(await read(cache(url, authorized, html))).toBe("through html");
    expect(await read(cache(url, authorized, xml))).toBe("through html");
    expect(await read(cache(url, authorized))).toBe("through html");

    expect(html).toHaveBeenCalledTimes(1);
    expect(xml).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });

  test("a miss, a refresh and a bypass each use the call's own fetch", async () => {
    const { cache, network, wait } = setup();
    const missing = routeFetch("first");
    const refreshing = routeFetch("second");
    const bypassing = routeFetch("bypassed");
    const bypassed: Array<[RequestInfo | URL, RequestInit | undefined]> = [
      [url, { method: "post", ...authorized }],
      [url, { method: "get", body: "{}" }],
      [url, { headers: { "Cache-Control": "max-age=60" } }],
      [new URL(url), undefined],
    ];

    expect(await read(cache(url, authorized, missing))).toBe("first");
    wait(60);
    expect(await read(cache(url, authorized, refreshing))).toBe("second");
    for (const [input, init] of bypassed) {
      expect(await read(cache(input, init, bypassing))).toBe("bypassed");
    }

    expect(missing).toHaveBeenCalledTimes(1);
    expect(refreshing).toHaveBeenCalledTimes(1);
    expect(bypassing.mock.calls).toHaveLength(bypassed.length);
    bypassed.forEach(([input, init], index) => {
      expect(bypassing.mock.calls[index][0]).toBe(input);
      expect(bypassing.mock.calls[index][1]).toBe(init);
    });
    expect(network).not.toHaveBeenCalled();
  });

  test("concurrent calls passing different fetches make one request", async () => {
    const { cache, network } = setup();
    const response = Promise.withResolvers<Response>();
    const html = vi.fn<typeof fetch>(() => response.promise);
    const xml = routeFetch("through xml");

    const requests = [
      read(cache(url, authorized, html)),
      read(cache(url, authorized, xml)),
      read(cache(url, authorized)),
    ];
    response.resolve(
      reply({ body: "through html", headers: { "cache-control": cacheable } })
    );

    expect(await Promise.all(requests)).toEqual(Array(3).fill("through html"));
    expect(html).toHaveBeenCalledTimes(1);
    expect(xml).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
});

describe("the site's instance, siteResourceCache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("is one cache: what one route stored answers another route", async () => {
    const at = "https://site.example.org/api/public/v1/forms";
    const html = vi.fn<typeof fetch>(async () =>
      reply({ body: "shared", headers: { "cache-control": cacheable } })
    );
    const xml = vi.fn<typeof fetch>();

    expect(await read(siteResourceCache(at, authorized, html))).toBe("shared");
    expect(await read(siteResourceCache(at, authorized, xml))).toBe("shared");
    expect(await read(siteResourceCache(at, authorized))).toBe("shared");

    expect(html).toHaveBeenCalledTimes(1);
    expect(xml).not.toHaveBeenCalled();
  });

  test("uses the global fetch, looked up on each call, when a call passes none", async () => {
    const at = "https://site.example.org/api/public/v1/events";
    const global = vi.fn<typeof fetch>(async () => reply({ body: "global" }));
    vi.stubGlobal("fetch", global);

    expect(await read(siteResourceCache(at, authorized))).toBe("global");
    expect(global).toHaveBeenCalledTimes(1);
    expect(global.mock.calls[0][0]).toBe(at);
  });
});

describe("one request per key", () => {
  test("ten concurrent requests make one network request, each with its own readable body", async () => {
    const { cache, network } = setup();
    const response = Promise.withResolvers<Response>();
    network.mockReturnValue(response.promise);

    const requests = Array.from({ length: 10 }, () => get(cache));
    response.resolve(
      reply({ body: "forms", headers: { "cache-control": cacheable } })
    );
    const responses = await Promise.all(requests);

    expect(network).toHaveBeenCalledTimes(1);
    expect(new Set(responses).size).toBe(10);
    expect(await Promise.all(responses.map((each) => each.text()))).toEqual(
      Array(10).fill("forms")
    );
  });

  test("ten concurrent requests share one non-cacheable result too, which is not stored", async () => {
    const { cache, network } = setup();
    const response = Promise.withResolvers<Response>();
    network.mockReturnValueOnce(response.promise);

    const requests = Array.from({ length: 10 }, () => get(cache));
    response.resolve(reply({ body: "missing", status: 404 }));
    const responses = await Promise.all(requests);

    expect(network).toHaveBeenCalledTimes(1);
    expect(responses.map((each) => each.status)).toEqual(Array(10).fill(404));
    expect(await Promise.all(responses.map((each) => each.text()))).toEqual(
      Array(10).fill("missing")
    );

    network.mockResolvedValueOnce(reply({ body: "found" }));
    expect(await read(get(cache))).toBe("found");
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("concurrent requests for a stale entry wait on one refresh", async () => {
    const { cache, network, wait } = setup();
    network.mockResolvedValueOnce(
      reply({ body: "old", headers: { "cache-control": cacheable } })
    );
    await read(get(cache));
    wait(60);
    const response = Promise.withResolvers<Response>();
    network.mockReturnValueOnce(response.promise);

    const requests = Array.from({ length: 5 }, () => read(get(cache)));
    response.resolve(
      reply({ body: "new", headers: { "cache-control": cacheable } })
    );

    expect(await Promise.all(requests)).toEqual(Array(5).fill("new"));
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("after a thrown fetch, the next request reaches the network again", async () => {
    const { cache, network } = setup();
    network.mockRejectedValueOnce(new TypeError("fetch failed"));
    network.mockResolvedValueOnce(reply({ body: "forms" }));

    await expect(get(cache)).rejects.toThrow("fetch failed");
    expect(await read(get(cache))).toBe("forms");
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("after a body read that rejects, the next request reaches the network again", async () => {
    const { cache, network } = setup();
    network.mockResolvedValueOnce(brokenBody());
    network.mockResolvedValueOnce(reply({ body: "forms" }));

    await expect(get(cache)).rejects.toThrow("connection reset");
    expect(await read(get(cache))).toBe("forms");
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("after a 500, the next request reaches the network again", async () => {
    const { cache, network } = setup();
    network.mockResolvedValueOnce(reply({ body: "broken", status: 500 }));
    network.mockResolvedValueOnce(reply({ body: "forms" }));

    const failed = await get(cache);
    expect(failed.status).toBe(500);
    expect(await failed.text()).toBe("broken");
    expect(await read(get(cache))).toBe("forms");
    expect(network).toHaveBeenCalledTimes(2);
  });

  test("a failed refresh still serves the stale entry another key evicted while it ran", async () => {
    const { cache, network, wait } = setup({ maxEntries: 1 });
    const other = "https://app.example.org/api/public/v1/events";
    network.mockResolvedValueOnce(
      reply({ body: "stored", headers: { "cache-control": staleIfError } })
    );
    await read(get(cache));
    wait(60);
    const refresh = Promise.withResolvers<Response>();
    network.mockReturnValueOnce(refresh.promise);
    network.mockResolvedValueOnce(
      reply({ body: "events", headers: { "cache-control": cacheable } })
    );

    const stale = read(get(cache));
    expect(await read(get(cache, {}, other))).toBe("events");
    refresh.resolve(reply({ status: 503 }));

    expect(await stale).toBe("stored");
    expect(network).toHaveBeenCalledTimes(3);
  });
});

describe("stale-if-error", () => {
  // RFC 5861's four, and 429.
  const failedStatuses = [429, 500, 502, 503, 504];
  const failures = [
    ...failedStatuses.map((status) => ({
      name: `a ${status}`,
      fail: async () => reply({ status }),
    })),
    {
      name: "a thrown fetch",
      fail: async (): Promise<Response> => {
        throw new TypeError("fetch failed");
      },
    },
    { name: "a body read that rejects", fail: async () => brokenBody() },
  ];

  /** A cache holding "stored" with stale-if-error=600, gone stale at 60. */
  const setupStored = async (cacheControl = staleIfError) => {
    const context = setup();
    context.network.mockResolvedValueOnce(
      reply({ body: "stored", headers: { "cache-control": cacheControl } })
    );
    await read(get(context.cache));
    return context;
  };

  test.each(failures)(
    "serves the stale entry on $name within the window",
    async ({ fail }) => {
      const { cache, network, wait } = await setupStored();
      wait(60 + 599.999);
      network.mockImplementationOnce(fail);

      expect(await read(get(cache))).toBe("stored");
      expect(network).toHaveBeenCalledTimes(2);
    }
  );

  test.each(failedStatuses)(
    "passes a %i through once the window has passed",
    async (status) => {
      const { cache, network, wait } = await setupStored();
      wait(60 + 600);
      network.mockResolvedValueOnce(reply({ body: "failed", status }));

      const response = await get(cache);
      expect(response.status).toBe(status);
      expect(await response.text()).toBe("failed");
    }
  );

  test("passes a thrown fetch through once the window has passed", async () => {
    const { cache, network, wait } = await setupStored();
    wait(60 + 600);
    network.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(get(cache)).rejects.toThrow("fetch failed");
  });

  test("passes a failure through when the stored response had no stale-if-error", async () => {
    const { cache, network, wait } = await setupStored(cacheable);
    wait(61);
    network.mockResolvedValueOnce(reply({ body: "unavailable", status: 503 }));

    const response = await get(cache);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("unavailable");
  });

  test.each([401, 403, 404])(
    "never answers a %i with the stale entry, then or after a later failure",
    async (status) => {
      const { cache, network, wait } = await setupStored();
      wait(61);
      network.mockResolvedValueOnce(reply({ body: "gone", status }));
      network.mockResolvedValueOnce(reply({ body: "down", status: 503 }));

      const response = await get(cache);
      expect(response.status).toBe(status);
      expect(await response.text()).toBe("gone");
      expect(await read(get(cache))).toBe("down");
    }
  );

  test("caps stale-if-error at 3600 seconds", async () => {
    const { cache, network, wait } = await setupStored(
      "public, s-maxage=60, stale-if-error=86400"
    );
    network.mockImplementation(async () => reply({ status: 503 }));

    wait(60 + 3599.999);
    expect(await read(get(cache))).toBe("stored");
    wait(0.001);
    expect((await get(cache)).status).toBe(503);
  });

  test("logs one line naming the failure and the URL's origin and path only", async () => {
    const { cache, network, wait } = setup();
    const secret = `${url}?org=secret-org`;
    network.mockResolvedValueOnce(
      reply({ body: "forms-body", headers: { "cache-control": staleIfError } })
    );
    await read(get(cache, authorized, secret));
    expect(warn).not.toHaveBeenCalled();

    wait(61);
    network.mockResolvedValueOnce(reply({ status: 429 }));
    expect(await read(get(cache, authorized, secret))).toBe("forms-body");
    // Served from the backoff: no second line.
    wait(1);
    await read(get(cache, authorized, secret));

    expect(warn).toHaveBeenCalledTimes(1);
    const [line] = warn.mock.calls[0];
    expect(line).toContain(`${url} failed (status 429)`);
    expect(line).not.toContain("secret-org");
    expect(line).not.toContain("Bearer");
    expect(line).not.toContain("forms-body");

    wait(10);
    network.mockRejectedValueOnce(new TypeError("fetch failed"));
    await read(get(cache, authorized, secret));
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringContaining(`${url} failed (network error)`)
    );
  });
});

describe("backoff after a failed refresh", () => {
  test.each([
    {
      name: "a 429's Retry-After: 30",
      fail: () => reply({ status: 429, headers: { "retry-after": "30" } }),
      seconds: 30,
    },
    {
      name: "a 503's Retry-After: 30",
      fail: () => reply({ status: 503, headers: { "retry-after": "30" } }),
      seconds: 30,
    },
    {
      name: "the fixed 10 seconds without Retry-After",
      fail: () => reply({ status: 429 }),
      seconds: 10,
    },
    {
      name: "the fixed 10 seconds for a 500, whatever its Retry-After",
      fail: () => reply({ status: 500, headers: { "retry-after": "30" } }),
      seconds: 10,
    },
    {
      name: "60 seconds for a Retry-After above 60",
      fail: () => reply({ status: 429, headers: { "retry-after": "120" } }),
      seconds: 60,
    },
  ])("waits $name before the next refresh", async ({ fail, seconds }) => {
    const { cache, network, wait } = setup();
    network.mockResolvedValueOnce(
      reply({ body: "stored", headers: { "cache-control": staleIfError } })
    );
    await read(get(cache));
    wait(61);
    network.mockResolvedValueOnce(fail());

    expect(await read(get(cache))).toBe("stored");
    wait(1);
    expect(await read(get(cache))).toBe("stored");
    wait(seconds - 1.001);
    expect(await read(get(cache))).toBe("stored");
    expect(network).toHaveBeenCalledTimes(2);

    wait(0.001);
    network.mockResolvedValueOnce(
      reply({ body: "fresh", headers: { "cache-control": staleIfError } })
    );
    expect(await read(get(cache))).toBe("fresh");
    expect(network).toHaveBeenCalledTimes(3);
  });

  test("ends with the stale-if-error window", async () => {
    const { cache, network, wait } = setup();
    network.mockResolvedValueOnce(
      reply({
        body: "stored",
        headers: { "cache-control": "public, s-maxage=60, stale-if-error=20" },
      })
    );
    await read(get(cache));
    wait(61);
    network.mockResolvedValueOnce(
      reply({ status: 429, headers: { "retry-after": "60" } })
    );
    expect(await read(get(cache))).toBe("stored");

    wait(18.999);
    expect(await read(get(cache))).toBe("stored");
    expect(network).toHaveBeenCalledTimes(2);

    wait(0.001);
    network.mockResolvedValueOnce(reply({ body: "limited", status: 429 }));
    expect(await read(get(cache))).toBe("limited");
    expect(network).toHaveBeenCalledTimes(3);
  });
});

describe("a deadline on every request", () => {
  /**
   * AbortSignal.timeout on Vitest's fake clock, which Node's own timer does
   * not follow.
   */
  const fakeTimeout = () =>
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort(
          new DOMException("The operation timed out.", "TimeoutError")
        );
      }, milliseconds);
      return controller.signal;
    });

  /** A fetch that never answers and ignores its signal. */
  const hang = () => new Promise<Response>(() => {});

  /** A response whose body never ends. */
  const endlessBody = async () =>
    new Response(new ReadableStream({ start() {} }));

  /** Tracks whether a promise has settled, without leaving it unhandled. */
  const track = <T>(promise: Promise<T>) => {
    const tracked = { settled: false, result: promise };
    promise.then(
      () => {
        tracked.settled = true;
      },
      () => {
        tracked.settled = true;
      }
    );
    return tracked;
  };

  /** The value a promise resolves with, or the error it rejects with. */
  const outcome = (promise: Promise<unknown>) =>
    promise.then(
      (value) => value,
      (error: unknown) => error
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.each([
    { name: "a fetch that never answers", fail: hang },
    { name: "a body that never ends", fail: endlessBody },
  ])(
    "serves the stale entry 4 seconds into $name, to everyone waiting",
    async ({ fail }) => {
      const timeout = fakeTimeout();
      const { cache, network, wait } = setup();
      network.mockResolvedValueOnce(
        reply({ body: "stored", headers: { "cache-control": staleIfError } })
      );
      await read(get(cache));
      wait(61);
      network.mockImplementationOnce(fail);

      const waiting = track(Promise.all([read(get(cache)), read(get(cache))]));
      await vi.advanceTimersByTimeAsync(3999);
      expect(waiting.settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await waiting.result).toEqual(["stored", "stored"]);
      expect(timeout).toHaveBeenLastCalledWith(4000);
      expect(network).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`${url} failed (no answer in 4 seconds)`)
      );
      // The usual backoff follows: the next request waits for none.
      expect(await read(get(cache))).toBe("stored");
      expect(network).toHaveBeenCalledTimes(2);
    }
  );

  test("waits the long deadline when the stale entry would expire before the short one fires", async () => {
    const timeout = fakeTimeout();
    const { cache, network, wait } = setup();
    network.mockResolvedValueOnce(
      reply({ body: "stored", headers: { "cache-control": staleIfError } })
    );
    await read(get(cache));
    // Past freshness and 2 seconds before the end of stale-if-error: a 4 second
    // deadline would fire after the stale entry is no longer usable.
    const staleIfErrorSeconds = Number(
      /stale-if-error=(\d+)/.exec(staleIfError)?.[1]
    );
    const maxAgeSeconds = Number(
      /(?:s-maxage|max-age)=(\d+)/.exec(staleIfError)?.[1]
    );
    wait(maxAgeSeconds + staleIfErrorSeconds - 2);
    network.mockImplementationOnce(hang);

    const waiting = track(read(get(cache)));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(timeout).toHaveBeenLastCalledWith(10_000);
    expect(waiting.settled).toBe(true);
  });

  test.each([
    { name: "nothing stored", cacheControl: undefined },
    { name: "a stale entry with no stale-if-error", cacheControl: cacheable },
  ])(
    "with $name, a request that hangs fails after 10 seconds, and the next one reaches the network",
    async ({ cacheControl }) => {
      const timeout = fakeTimeout();
      const { cache, network, wait } = setup();
      if (cacheControl !== undefined) {
        network.mockResolvedValueOnce(
          reply({ body: "stored", headers: { "cache-control": cacheControl } })
        );
        await read(get(cache));
        wait(61);
      }
      network.mockImplementationOnce(hang);

      const failed = track(outcome(get(cache)));
      await vi.advanceTimersByTimeAsync(9999);
      expect(failed.settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await failed.result).toMatchObject({ name: "TimeoutError" });
      expect(timeout).toHaveBeenLastCalledWith(10_000);
      network.mockResolvedValueOnce(reply({ body: "forms" }));
      expect(await read(get(cache))).toBe("forms");
      expect(network).toHaveBeenCalledTimes(cacheControl === undefined ? 2 : 3);
    }
  );

  test("aborts the request it gave up on, which then settles unnoticed", async () => {
    fakeTimeout();
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const { cache, network } = setup();
      // Like the real fetch: rejects with the signal's reason once it aborts.
      network.mockImplementationOnce(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(init.signal?.reason);
            });
          })
      );

      const failed = outcome(get(cache));
      await vi.advanceTimersByTimeAsync(10_000);

      expect(network.mock.calls[0][1]?.signal?.aborted).toBe(true);
      expect(await failed).toMatchObject({ name: "TimeoutError" });
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  test("a caller's own signal still aborts the request", async () => {
    fakeTimeout();
    const { cache, network } = setup();
    network.mockImplementationOnce(hang);
    const caller = new AbortController();

    const failed = outcome(cache(url, { signal: caller.signal }));
    caller.abort(new Error("the visitor left"));

    expect(await failed).toMatchObject({ message: "the visitor left" });
    expect(network.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});

describe("bounds", () => {
  const at = (cache: typeof fetch, path: string) =>
    read(get(cache, {}, `https://api.example.org/${path}`));

  const answerWithPath = (network: ReturnType<typeof setup>["network"]) =>
    network.mockImplementation(async (input) =>
      reply({
        body: String(input).slice(-4),
        headers: { "cache-control": cacheable },
      })
    );

  test("evicts the least recently used entry past maxEntries", async () => {
    const { cache, network } = setup({ maxEntries: 2 });
    answerWithPath(network);

    await at(cache, "aaaa");
    await at(cache, "bbbb");
    await at(cache, "aaaa");
    await at(cache, "cccc");
    expect(network).toHaveBeenCalledTimes(3);

    await at(cache, "aaaa");
    await at(cache, "cccc");
    expect(network).toHaveBeenCalledTimes(3);
    await at(cache, "bbbb");
    expect(network).toHaveBeenCalledTimes(4);
  });

  test("evicts the least recently used entry past maxBytes", async () => {
    const { cache, network } = setup({ maxBytes: 10 });
    answerWithPath(network);

    await at(cache, "aaaa");
    await at(cache, "bbbb");
    await at(cache, "aaaa");
    await at(cache, "cccc");
    expect(network).toHaveBeenCalledTimes(3);

    await at(cache, "aaaa");
    await at(cache, "cccc");
    expect(network).toHaveBeenCalledTimes(3);
    await at(cache, "bbbb");
    expect(network).toHaveBeenCalledTimes(4);
  });

  test("never stores a body over maxEntryBytes", async () => {
    const { cache, network } = setup({ maxEntryBytes: 4 });
    network.mockImplementation(async (input) =>
      reply({
        body: String(input).endsWith("large") ? "12345" : "1234",
        headers: { "cache-control": cacheable },
      })
    );

    await at(cache, "large");
    await at(cache, "large");
    expect(network).toHaveBeenCalledTimes(2);

    await at(cache, "small");
    await at(cache, "small");
    expect(network).toHaveBeenCalledTimes(3);
  });

  test("counts sizes in UTF-8 bytes", async () => {
    const { cache, network } = setup({ maxEntryBytes: 5, maxBytes: 7 });
    network.mockImplementation(async (input) =>
      reply({
        // three characters in six bytes; two in four
        body: String(input).endsWith("large") ? "ééé" : "éé",
        headers: { "cache-control": cacheable },
      })
    );

    await at(cache, "large");
    await at(cache, "large");
    expect(network).toHaveBeenCalledTimes(2);

    // Four bytes each: the second evicts the first, as 8 > 7.
    await at(cache, "one");
    await at(cache, "two");
    await at(cache, "two");
    expect(network).toHaveBeenCalledTimes(4);
    await at(cache, "one");
    expect(network).toHaveBeenCalledTimes(5);
  });
});

test("logs nothing on the hot path", async () => {
  const { cache, network, wait } = setup();
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  network.mockImplementation(async () =>
    reply({ headers: { "cache-control": staleIfError } })
  );

  await read(get(cache));
  await read(get(cache));
  wait(61);
  await read(get(cache));

  expect(log).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
});
