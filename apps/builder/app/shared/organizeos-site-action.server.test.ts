import { describe, expect, test, vi } from "vitest";
import vector from "./__fixtures__/site-action-assertion.json";
import {
  SITE_ACTION_HEADER,
  SITE_ACTION_LIFETIME_SECONDS,
  mintSiteActionAssertion,
  postSiteAction,
  type SiteActionPayload,
} from "./organizeos-site-action.server";

// OrganizeOS fork: the Publish dialog's Unpublish assertion. The bytes are
// pinned by the platform's fixture, copied byte for byte.

describe("mintSiteActionAssertion", () => {
  test("mints exactly the fixture's header from its payload and secret", () => {
    expect(
      mintSiteActionAssertion(
        vector.payload as SiteActionPayload,
        vector.secret
      )
    ).toBe(vector.header);
  });

  test("keeps the key order whatever order the payload is built in", () => {
    const p = vector.payload as SiteActionPayload;
    const reordered = {
      exp: p.exp,
      iat: p.iat,
      jti: p.jti,
      sid: p.sid,
      sub: p.sub,
      org: p.org,
      tgt: p.tgt,
      act: p.act,
      aud: p.aud,
    } as SiteActionPayload;
    expect(mintSiteActionAssertion(reordered, vector.secret)).toBe(
      vector.header
    );
  });

  test("lives 60 seconds", () => {
    expect(SITE_ACTION_LIFETIME_SECONDS).toBe(60);
    expect(vector.payload.exp - vector.payload.iat).toBe(60);
  });
});

describe("postSiteAction", () => {
  const appUrl = "https://app.organizeos.org/";

  test("POSTs the header with no body and no cookie, refusing redirects", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: true, changed: true }))
    );
    const answer = await postSiteAction({
      appUrl,
      header: vector.header,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(answer).toEqual({ kind: "ok", changed: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://app.organizeos.org/api/internal/websites2/site-action"
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(init.redirect).toBe("error");
    expect(init.credentials).toBe("omit");
    expect(init.headers).toEqual({ [SITE_ACTION_HEADER]: vector.header });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("reduces every other answer", async () => {
    const send = (response: Response | Error) =>
      postSiteAction({
        appUrl,
        header: "h",
        fetchImpl: (async () => {
          if (response instanceof Error) {
            throw response;
          }
          return response;
        }) as unknown as typeof fetch,
      });
    expect(await send(new Response(null, { status: 404 }))).toEqual({
      kind: "status",
      status: 404,
    });
    expect(await send(new Response("{}"))).toEqual({ kind: "failed" });
    expect(await send(new Response("not json"))).toEqual({ kind: "failed" });
    const timeout = new Error("t");
    timeout.name = "TimeoutError";
    expect(await send(timeout)).toEqual({ kind: "timeout" });
    expect(await send(new TypeError("redirect"))).toEqual({ kind: "failed" });
  });
});
