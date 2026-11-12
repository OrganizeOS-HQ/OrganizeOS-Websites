import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import vector from "./__fixtures__/cms-actor-assertion.json";
import {
  CMS_ACTOR_HEADER,
  CMS_ACTOR_LIFETIME_SECONDS,
  CMS_ANSWER_MAX_BYTES,
  CMS_PLATFORM_BASE_PATH,
  cmsCanonicalTarget,
  forwardCmsRequest,
  hashCmsBytes,
  mintCmsActorAssertion,
  readBoundedBytes,
  readCmsActorIp,
  type CmsActorPayload,
} from "./organizeos-cms.server";

// OrganizeOS fork: the native CMS's actor assertion. The bytes are pinned by
// the platform's fixture, copied byte for byte.

const payload = vector.payload as CmsActorPayload;

const KEY_ORDER = [
  "aud",
  "org",
  "sub",
  "sid",
  "m",
  "p",
  "h",
  "jti",
  "iat",
  "exp",
  "ip",
];

const decodeSegment = (header: string): Record<string, unknown> => {
  const [version, segment, mac, ...rest] = header.split(".");
  expect(version).toBe("v1");
  expect(mac).toBeTruthy();
  expect(rest).toEqual([]);
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
};

const targetOf = (target: string) => {
  const url = new URL(target, "https://app.organizeos.org");
  return cmsCanonicalTarget(url.pathname, url.searchParams);
};

describe("mintCmsActorAssertion", () => {
  test("names the header and the platform's base path", () => {
    expect(CMS_ACTOR_HEADER).toBe("X-OOS-Actor");
    expect(CMS_PLATFORM_BASE_PATH).toBe("/api/internal/websites2/cms");
    expect(vector.target.startsWith(`${CMS_PLATFORM_BASE_PATH}/`)).toBe(true);
  });

  test("mints exactly the fixture's header from its payload and secret", () => {
    const header = mintCmsActorAssertion(payload, vector.secret);
    expect(header).toBe(vector.header);
    expect(header).toBe(`v1.${vector.payloadSegment}.${vector.mac}`);
  });

  test("keeps the key order aud, org, sub, sid, m, p, h, jti, iat, exp, ip whatever order the payload is built in", () => {
    const reversed = Object.fromEntries(
      [...KEY_ORDER]
        .reverse()
        .map((key) => [key, payload[key as keyof CmsActorPayload]])
    ) as CmsActorPayload;
    expect(Object.keys(reversed)).toEqual([...KEY_ORDER].reverse());
    const header = mintCmsActorAssertion(reversed, vector.secret);
    expect(header).toBe(vector.header);
    expect(Object.keys(decodeSegment(header))).toEqual(KEY_ORDER);
  });

  test("signs the payload it is given, not the fixture's", () => {
    const other = mintCmsActorAssertion(
      { ...payload, m: "POST" },
      vector.secret
    );
    expect(other).not.toBe(vector.header);
    expect(decodeSegment(other).m).toBe("POST");
    expect(mintCmsActorAssertion(payload, `${vector.secret}x`)).not.toBe(
      vector.header
    );
  });

  test("lives 60 seconds", () => {
    expect(CMS_ACTOR_LIFETIME_SECONDS).toBe(60);
    expect(payload.exp - payload.iat).toBe(60);
  });

  test("writes ip as null, never leaving the key out", () => {
    const decoded = decodeSegment(
      mintCmsActorAssertion({ ...payload, ip: null }, vector.secret)
    );
    expect(Object.keys(decoded)).toEqual(KEY_ORDER);
    expect(decoded.ip).toBeNull();
  });

  test("stays under 1024 characters with a 45-character ip", () => {
    const ip = "ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255";
    expect(ip).toHaveLength(45);
    const header = mintCmsActorAssertion({ ...payload, ip }, vector.secret);
    expect(decodeSegment(header).ip).toBe(ip);
    expect(header.length).toBeLessThan(1024);
  });
});

describe("cmsCanonicalTarget", () => {
  test("turns the fixture's target into its p", () => {
    expect(hashCmsBytes(targetOf(vector.target))).toBe(payload.p);
  });

  test.each([
    ["/x?q=a+b&page=2", "/x?page=2&q=a%20b"],
    ["/x?ids=a,b", "/x?ids=a%2Cb"],
    ["/x?q=caf%C3%A9", "/x?q=café"],
    ["/x?q=1&page=1", "/x?page=1&q=1"],
  ])("%s and %s have one canonical target", (a, b) => {
    expect(targetOf(a)).toBe(targetOf(b));
  });

  test("sorts by key, keeping a repeated key's order", () => {
    expect(targetOf("/x?b=1&a=2&a=1")).toBe("/x?a=2&a=1&b=1");
  });

  test("has no ? without a pair", () => {
    expect(targetOf("/x")).toBe("/x");
    expect(targetOf("/x?")).toBe("/x");
  });

  test("an added or a changed pair changes the hash", () => {
    const base = hashCmsBytes(targetOf("/x?q=a"));
    expect(hashCmsBytes(targetOf("/x?q=b"))).not.toBe(base);
    expect(hashCmsBytes(targetOf("/x?q=a&page=1"))).not.toBe(base);
  });
});

describe("hashCmsBytes", () => {
  test("hashes empty bytes for a GET", () => {
    expect(hashCmsBytes(new Uint8Array())).toBe(
      "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU"
    );
    expect(hashCmsBytes(new Uint8Array())).toBe(payload.h);
  });

  test("hashes a string as its UTF-8 bytes", () => {
    expect(hashCmsBytes("é")).toBe(hashCmsBytes(new Uint8Array([0xc3, 0xa9])));
  });
});

describe("readCmsActorIp", () => {
  test.each([
    [{ "x-real-ip": "203.0.113.7" }, "203.0.113.7"],
    [
      { "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.2" },
      "203.0.113.7",
    ],
    [{ "x-forwarded-for": " 198.51.100.2 , 10.0.0.1" }, "198.51.100.2"],
    [{ "x-forwarded-for": "2001:db8::1" }, "2001:db8::1"],
    [{ "x-real-ip": "  ", "x-forwarded-for": "198.51.100.2" }, "198.51.100.2"],
    [{ "x-real-ip": "not-an-ip", "x-forwarded-for": "198.51.100.2" }, null],
    [{ "x-forwarded-for": `fe80::1%${"x".repeat(40)}` }, null],
    [{}, null],
  ])("%j reads as %j", (headers, expected) => {
    expect(readCmsActorIp(new Headers(headers))).toBe(expected);
  });
});

const appUrl = "https://app.organizeos.org/";

const jsonAnswer = (text: string, status = 200, type = "application/json") =>
  new Response(text, { status, headers: { "Content-Type": type } });

const answering = (response: Response | Error) =>
  vi.fn(async (_url: string, _init: RequestInit) => {
    if (response instanceof Error) {
      throw response;
    }
    return response;
  });

const callOf = (fetchImpl: ReturnType<typeof answering>) =>
  fetchImpl.mock.calls[0] as [string, RequestInit];

const forwardGet = (fetchImpl: ReturnType<typeof answering>) =>
  forwardCmsRequest({
    appUrl,
    method: "GET",
    target: "/api/internal/websites2/cms/o/access",
    header: "v1.a.b",
    timeoutMs: 15_000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });

describe("forwardCmsRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("sends a GET with the header only, no cookie, refusing redirects", async () => {
    const fetchImpl = answering(jsonAnswer("{}"));
    expect(await forwardGet(fetchImpl)).toMatchObject({
      kind: "answer",
      status: 200,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = callOf(fetchImpl);
    expect(url).toBe(
      "https://app.organizeos.org/api/internal/websites2/cms/o/access"
    );
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({ [CMS_ACTOR_HEADER]: "v1.a.b" });
    expect(init.redirect).toBe("error");
    expect(init.credentials).toBe("omit");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("sends a write's bytes untouched, as a Uint8Array, with its Content-Type", async () => {
    const fetchImpl = answering(jsonAnswer("{}"));
    const body = new TextEncoder().encode('{"name":"café"}');
    await forwardCmsRequest({
      appUrl,
      method: "PUT",
      target: "/api/internal/websites2/cms/o/items/i",
      header: "v1.a.b",
      body,
      contentType: "application/json",
      timeoutMs: 15_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [, init] = callOf(fetchImpl);
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(body);
    expect(init.body).toBeInstanceOf(Uint8Array);
    expect(init.headers).toEqual({
      [CMS_ACTOR_HEADER]: "v1.a.b",
      "Content-Type": "application/json",
    });
  });

  test("times out after the request's timeoutMs", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchImpl = answering(jsonAnswer("{}"));
    await forwardCmsRequest({
      appUrl,
      method: "POST",
      target: "/api/internal/websites2/cms/o/uploads/image",
      header: "v1.a.b",
      body: new Uint8Array([1]),
      contentType: "multipart/form-data; boundary=b",
      timeoutMs: 30_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(callOf(fetchImpl)[1].signal).toBe(timeout.mock.results[0]?.value);
  });

  test("relays a JSON answer's status and exact bytes", async () => {
    const sent =
      '{ "item" : { "updatedAt": "2026-11-07T10:00:00.123456+00:00" } }';
    const answer = await forwardGet(answering(jsonAnswer(sent, 201)));
    expect(answer).toMatchObject({ kind: "answer", status: 201 });
    if (answer.kind !== "answer") {
      throw new Error("not an answer");
    }
    expect(answer.bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(answer.bytes)).toBe(sent);
  });

  test("relays a refusal: 409 conflict and 401 refused", async () => {
    for (const [status, text] of [
      [409, '{"error":"conflict"}'],
      [401, '{"error":"refused"}'],
    ] as const) {
      const answer = await forwardGet(answering(jsonAnswer(text, status)));
      expect(answer).toMatchObject({ kind: "answer", status });
      if (answer.kind === "answer") {
        expect(new TextDecoder().decode(answer.bytes)).toBe(text);
      }
    }
  });

  test("accepts application/json; charset=utf-8", async () => {
    expect(
      await forwardGet(
        answering(jsonAnswer("{}", 200, "application/json; charset=utf-8"))
      )
    ).toMatchObject({ kind: "answer", status: 200 });
    expect(
      await forwardGet(
        answering(jsonAnswer("{}", 200, "Application/JSON ; charset=utf-8"))
      )
    ).toMatchObject({ kind: "answer", status: 200 });
  });

  test.each([
    ["text/html", "<html>"],
    ["application/json", "not json"],
    ["application/json", ""],
    ["", "{}"],
    ["application/problem+json", "{}"],
  ])("an answer of type %j with body %j is not_json", async (type, text) => {
    expect(await forwardGet(answering(jsonAnswer(text, 200, type)))).toEqual({
      kind: "not_json",
    });
  });

  test("an answer that is not UTF-8 is not_json", async () => {
    const response = new Response(new Uint8Array([0x22, 0xff, 0x22]), {
      headers: { "Content-Type": "application/json" },
    });
    expect(await forwardGet(answering(response))).toEqual({
      kind: "not_json",
    });
  });

  test("a dark platform's empty 404 is not_json", async () => {
    expect(
      await forwardGet(answering(new Response(null, { status: 404 })))
    ).toEqual({ kind: "not_json" });
  });

  test("an answer over 5 MB is not_json, its read stopped", async () => {
    expect(CMS_ANSWER_MAX_BYTES).toBe(5_242_880);
    let pulls = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls += 1;
          if (pulls > 96) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array(65_536).fill(0x20));
        },
        cancel,
      },
      { highWaterMark: 0 }
    );
    const response = new Response(stream, {
      headers: { "Content-Type": "application/json" },
    });
    expect(await forwardGet(answering(response))).toEqual({
      kind: "not_json",
    });
    expect(pulls).toBeLessThan(96);
    expect(cancel).toHaveBeenCalled();
  });

  test("a TimeoutError is timeout, any other throw failed", async () => {
    const timeout = new Error("t");
    timeout.name = "TimeoutError";
    expect(await forwardGet(answering(timeout))).toEqual({ kind: "timeout" });
    expect(await forwardGet(answering(new TypeError("redirect")))).toEqual({
      kind: "failed",
    });
  });

  // The platform refuses a POST or PUT with no Content-Length.
  describe("the real fetch", () => {
    const received: { headers: IncomingHttpHeaders; body: Buffer }[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        received.push({
          headers: request.headers,
          body: Buffer.concat(chunks),
        });
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end("{}");
      });
    });
    let port = 0;

    beforeAll(async () => {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
      );
      port = (server.address() as AddressInfo).port;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    test("sends Content-Length, no Transfer-Encoding and no cookie", async () => {
      for (const size of [3, 4_259_840]) {
        const body = new Uint8Array(size).fill(0x61);
        const answer = await forwardCmsRequest({
          appUrl: `http://127.0.0.1:${port}`,
          method: "POST",
          target: "/api/internal/websites2/cms/o/uploads/image",
          header: "v1.a.b",
          body,
          contentType: "multipart/form-data; boundary=b",
          timeoutMs: 15_000,
        });
        expect(answer).toMatchObject({ kind: "answer", status: 200 });
        const last = received.at(-1);
        expect(last?.headers["content-length"]).toBe(String(size));
        expect(last?.headers).not.toHaveProperty("transfer-encoding");
        expect(last?.headers).not.toHaveProperty("cookie");
        expect(last?.headers["x-oos-actor"]).toBe("v1.a.b");
        expect(last?.headers["content-type"]).toBe(
          "multipart/form-data; boundary=b"
        );
        expect(Buffer.compare(last!.body, Buffer.from(body))).toBe(0);
      }
    });
  });
});

describe("readBoundedBytes", () => {
  const streamOf = (bytes: Uint8Array) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });

  test("reads up to the cap, refuses a byte more", async () => {
    const ten = new Uint8Array(10).fill(1);
    expect(await readBoundedBytes(streamOf(ten), 10)).toEqual(ten);
    expect(
      await readBoundedBytes(streamOf(new Uint8Array(11)), 10)
    ).toBeUndefined();
  });

  test("joins chunks in order", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    expect(await readBoundedBytes(stream, 3)).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });

  test("reads a null stream as empty bytes", async () => {
    expect(await readBoundedBytes(null, 10)).toEqual(new Uint8Array());
  });
});
