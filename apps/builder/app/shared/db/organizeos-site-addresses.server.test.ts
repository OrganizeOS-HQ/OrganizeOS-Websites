import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import fixture from "../__fixtures__/site-addresses.json";
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

let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  error.mockRestore();
});

describe("fetchSiteAddresses and composeSiteAddresses", () => {
  test("the fixture as copied composes its custom main, the two OrganizeOS links, and no launchable", async () => {
    const row = await read(fixture);

    expect(row).toBeDefined();
    const addresses = compose(row!);
    expect(addresses).toEqual({
      host: "votelabor.org",
      origin: "https://votelabor.org",
      status: "not_launched",
      manageDomainsUrl: "https://app.organizeos.org/laborparty/settings/domain",
      websiteUrl: "https://app.organizeos.org/laborparty/website",
    });
    expect("launchable" in addresses).toBe(false);
    expect(error).not.toHaveBeenCalled();
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
