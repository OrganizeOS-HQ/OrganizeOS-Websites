import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import fixture from "../__fixtures__/site-addresses.json";
import targetsFixture from "../__fixtures__/site-addresses-targets.json";
import {
  composeSiteAddresses,
  fetchSiteAddresses,
} from "./organizeos-site-addresses.server";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const clientAnswering = (answer: { data: unknown; error: unknown }) => ({
  rpc: vi.fn(async () => answer),
});

const read = (data: unknown) =>
  fetchSiteAddresses(clientAnswering({ data, error: null }), organizationId);

const compose = (row: Parameters<typeof composeSiteAddresses>[0]["row"]) =>
  composeSiteAddresses({
    row,
    publisherHost: "organizeos.org",
    platformUrl: "https://app.organizeos.org/",
  });

const fixtureRow = fixture[0];

/** The targets fixture's row with its target at `index` changed. */
const withTarget = (index: number, change: Record<string, unknown>) => {
  const [source] = targetsFixture;
  return [
    {
      ...source,
      targets: source.targets.map((target, at) =>
        at === index ? { ...target, ...change } : target
      ),
    },
  ];
};

const targetsCases = (): Array<[string, unknown]> => [
  ["a target host with a scheme", withTarget(2, { host: "https://x.org" })],
  ["a target host with a port", withTarget(2, { host: "x.org:443" })],
  ["a non-ASCII target host", withTarget(2, { host: "bücher.de" })],
  ["a null host on a domain key", withTarget(2, { host: null })],
  ["a host on the built-in key", withTarget(0, { host: "x.org" })],
  ["an unknown key shape", withTarget(2, { key: "Built In" })],
  ["a key with a path", withTarget(2, { key: "x.org/p" })],
  ["a live that is not a boolean", withTarget(1, { live: "true" })],
  ["a main that is not a boolean", withTarget(1, { main: null })],
  [
    "a published time that is not a time",
    withTarget(0, { published_at: "yesterday" }),
  ],
  ["a target that is not an object", withTarget(1, { key: undefined })],
  [
    "targets that are not a list",
    [{ ...targetsFixture[0], targets: { key: "builtin" } }],
  ],
  [
    "more than 50 targets",
    [
      {
        ...targetsFixture[0],
        targets: Array.from({ length: 51 }, (_, index) => ({
          ...targetsFixture[0].targets[2],
          key: `d${index}.example.net`,
          host: `d${index}.example.net`,
        })),
      },
    ],
  ],
];

let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  error.mockRestore();
});

describe("fetchSiteAddresses and composeSiteAddresses", () => {
  test("the fixture as copied composes its custom main, the domains link, and no launchable or targets", async () => {
    const row = await read(fixture);

    expect(row).toBeDefined();
    const addresses = compose(row!);
    expect(addresses).toEqual({
      host: "votelabor.org",
      origin: "https://votelabor.org",
      status: "not_launched",
      manageDomainsUrl: "https://app.organizeos.org/laborparty/settings/domain",
    });
    expect("launchable" in addresses).toBe(false);
    expect("targets" in addresses).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });

  test("the targets fixture as copied composes every target in order, the built-in host composed", async () => {
    const row = await read(targetsFixture);

    expect(row).toBeDefined();
    expect(compose(row!)).toEqual({
      host: "www.example.org",
      origin: "https://www.example.org",
      status: "live",
      manageDomainsUrl:
        "https://app.organizeos.org/example-org/settings/domain",
      launchable: true,
      targets: [
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
        {
          key: "example.net",
          host: "example.net",
          builtin: false,
          main: false,
          publishedAt: "2026-11-06T09:30:00+00:00",
          live: false,
        },
      ],
    });
    expect(error).not.toHaveBeenCalled();
  });

  test("a row whose targets are null composes with none", async () => {
    const row = await read([{ ...targetsFixture[0], targets: null }]);
    expect(row).toBeDefined();
    expect("targets" in compose(row!)).toBe(false);
  });

  test("launchable false before any publish passes through with the targets", async () => {
    const [source] = targetsFixture;
    const row = await read([
      {
        ...source,
        status: "not_launched",
        launchable: false,
        targets: source.targets.map((target) => ({
          ...target,
          published_at: null,
          unpublished_at: null,
          live: false,
        })),
      },
    ]);
    const addresses = compose(row!);
    expect(addresses.launchable).toBe(false);
    expect(addresses.targets?.map((target) => target.live)).toEqual([
      false,
      false,
      false,
    ]);
  });

  test("passes launchable through when it is a boolean, and leaves it out when null", async () => {
    for (const launchable of [false, true]) {
      const row = await read([{ ...fixtureRow, status: "live", launchable }]);
      expect(compose(row!).launchable, String(launchable)).toBe(launchable);
    }
    const row = await read([{ ...fixtureRow, launchable: null }]);
    expect("launchable" in compose(row!)).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });

  test("composes the platform address without a custom main", async () => {
    const row = await read([{ ...fixtureRow, main_host: null }]);
    expect(compose(row!)).toMatchObject({
      host: "laborparty.organizeos.org",
      origin: "https://laborparty.organizeos.org",
    });
  });

  test("keeps a www. main as served, and ASCII-lower-cases a main", async () => {
    const www = await read([{ ...fixtureRow, main_host: "www.votelabor.org" }]);
    expect(compose(www!).origin).toBe("https://www.votelabor.org");
    const upper = await read([{ ...fixtureRow, main_host: "X.org" }]);
    expect(compose(upper!)).toMatchObject({
      host: "x.org",
      origin: "https://x.org",
    });
  });

  test("gives nothing for an empty answer, and logs nothing", async () => {
    expect(await read([])).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
  });

  test.each([
    ["two rows", [fixtureRow, fixtureRow]],
    ["an unknown status", [{ ...fixtureRow, status: "launched" }]],
    ["a main with a path", [{ ...fixtureRow, main_host: "x.org/p" }]],
    ["a main with a scheme", [{ ...fixtureRow, main_host: "https://x.org" }]],
    ["a main with a space", [{ ...fixtureRow, main_host: "a b" }]],
    ["a main with userinfo", [{ ...fixtureRow, main_host: "u@x.org" }]],
    ["a main with a port", [{ ...fixtureRow, main_host: "x.org:1" }]],
    ["a non-ASCII main", [{ ...fixtureRow, main_host: "bücher.de" }]],
    [
      "a main that only a Unicode lower-casing makes ASCII",
      [{ ...fixtureRow, main_host: "Kelvin.org" }],
    ],
    ["a bad subdomain", [{ ...fixtureRow, subdomain: "Labor_Party" }]],
    ["hosts that are not a list", [{ ...fixtureRow, website_hosts: "x.org" }]],
    [
      "a launchable that is not a boolean",
      [{ ...fixtureRow, launchable: "false" }],
    ],
    ["a row that is not in a list", fixtureRow],
    ...targetsCases(),
  ])(
    "gives nothing for %s, and logs addresses_invalid once",
    async (_name, data) => {
      expect(await read(data)).toBeUndefined();
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        "[organizeos-site-addresses] addresses_invalid"
      );
    }
  );

  test("calls exactly websites2_site_addresses with p_org", async () => {
    const client = clientAnswering({ data: fixture, error: null });
    await fetchSiteAddresses(client, organizationId);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("websites2_site_addresses", {
      p_org: organizationId,
    });
  });

  test("an RPC error gives nothing and logs addresses_rpc_failed only", async () => {
    const failing = clientAnswering({
      data: null,
      error: { message: "permission denied for function", hint: "detail" },
    });
    expect(await fetchSiteAddresses(failing, organizationId)).toBeUndefined();
    const throwing = {
      rpc: vi.fn(async () => {
        throw new Error("fetch failed: detail");
      }),
    };
    expect(await fetchSiteAddresses(throwing, organizationId)).toBeUndefined();
    expect(error.mock.calls).toEqual([
      ["[organizeos-site-addresses] addresses_rpc_failed"],
      ["[organizeos-site-addresses] addresses_rpc_failed"],
    ]);
  });
});
