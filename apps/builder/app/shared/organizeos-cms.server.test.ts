import { describe, expect, test } from "vitest";
import vector from "./__fixtures__/cms-actor-assertion.json";
import {
  CMS_ACTOR_HEADER,
  CMS_ACTOR_LIFETIME_SECONDS,
  CMS_PLATFORM_BASE_PATH,
  cmsCanonicalTarget,
  hashCmsBytes,
  mintCmsActorAssertion,
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
