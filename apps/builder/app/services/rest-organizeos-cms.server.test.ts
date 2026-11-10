import { describe, expect, test } from "vitest";
import { matchCmsPath } from "./organizeos-cms-route.server";

// OrganizeOS fork: the native CMS screen's door to OrganizeOS. The route
// forwards only a request whose path and query match one of its fixed
// endpoints, rebuilt from the parsed values.

const c = "22222222-2222-4222-8222-222222222222";
const i = "33333333-3333-4333-8333-333333333333";
// An id with hex letters, so its upper-case spelling differs.
const lettered = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const match = (method: string, splat: string, search = "") =>
  matchCmsPath(method, splat, new URLSearchParams(search));

describe("matchCmsPath", () => {
  test.each([
    ["GET", "access", "", "E0", "access", []],
    ["GET", "collections", "", "E1", "collections", []],
    ["GET", `collections/${c}`, "", "E2", `collections/${c}`, []],
    [
      "GET",
      `collections/${c}/items`,
      "?q=caf%C3%A9&page=2",
      "E3",
      `collections/${c}/items`,
      [
        ["page", "2"],
        ["q", "café"],
      ],
    ],
    [
      "GET",
      `collections/${c}/items/${i}`,
      "",
      "E4",
      `collections/${c}/items/${i}`,
      [],
    ],
    [
      "GET",
      `collections/${c}/items/search`,
      `?ids=${c},${i}`,
      "E5",
      `collections/${c}/items/search`,
      [["ids", `${c},${i}`]],
    ],
    [
      "GET",
      `collections/${c}/items/search`,
      "?q=news",
      "E5",
      `collections/${c}/items/search`,
      [["q", "news"]],
    ],
    ["POST", `collections/${c}/items`, "", "E6", `collections/${c}/items`, []],
    [
      "PUT",
      `collections/${c}/items/${i}`,
      "",
      "E7",
      `collections/${c}/items/${i}`,
      [],
    ],
    [
      "POST",
      `collections/${c}/items/${i}/publish`,
      "",
      "E8a",
      `collections/${c}/items/${i}/publish`,
      [],
    ],
    [
      "POST",
      `collections/${c}/items/${i}/discard`,
      "",
      "E8b",
      `collections/${c}/items/${i}/discard`,
      [],
    ],
    ["POST", "uploads/image", "", "E9", "uploads/image", []],
  ])("%s %s%s is %s", (method, splat, search, endpoint, path, query) =>
    expect(match(method, splat, search)).toMatchObject({
      endpoint,
      path,
      query,
    })
  );

  test("GETs carry no body, E6 to E8b JSON, E9 multipart", () => {
    const bodies = [
      match("GET", "access"),
      match("GET", "collections"),
      match("GET", `collections/${c}`),
      match("GET", `collections/${c}/items`),
      match("GET", `collections/${c}/items/${i}`),
      match("GET", `collections/${c}/items/search`, "?q=news"),
      match("POST", `collections/${c}/items`),
      match("PUT", `collections/${c}/items/${i}`),
      match("POST", `collections/${c}/items/${i}/publish`),
      match("POST", `collections/${c}/items/${i}/discard`),
      match("POST", "uploads/image"),
    ].map((matched) => [matched?.endpoint, matched?.method, matched?.body]);
    expect(bodies).toEqual([
      ["E0", "GET", "none"],
      ["E1", "GET", "none"],
      ["E2", "GET", "none"],
      ["E3", "GET", "none"],
      ["E4", "GET", "none"],
      ["E5", "GET", "none"],
      ["E6", "POST", "json"],
      ["E7", "PUT", "json"],
      ["E8a", "POST", "json"],
      ["E8b", "POST", "json"],
      ["E9", "POST", "multipart"],
    ]);
  });

  test.each([
    ["POST", "access", ""],
    ["PUT", `collections/${c}/items`, ""],
    ["GET", "uploads/image", ""],
    ["GET", "access/", ""],
    ["GET", "", ""],
    ["GET", "nothing", ""],
    ["GET", `collections/${c}/items/${i}/extra`, ""],
    ["GET", "collections/not-a-uuid", ""],
    ["GET", `collections/${lettered.toUpperCase()}`, ""],
    ["GET", `collections/${c}/../access`, ""],
    ["GET", `collections/${c}/%2e%2e/access`, ""],
    ["GET", "access", "?x=1"],
    ["GET", `collections/${c}`, "?q=a"],
    ["GET", `collections/${c}/items`, "?page=0"],
    ["GET", `collections/${c}/items`, "?page=02"],
    ["GET", `collections/${c}/items`, "?page=10001"],
    ["GET", `collections/${c}/items`, "?page=1&page=2"],
    ["GET", `collections/${c}/items`, "?q="],
    ["GET", `collections/${c}/items`, `?q=${"a".repeat(201)}`],
    ["GET", `collections/${c}/items`, `?org=${c}`],
    ["GET", `collections/${c}/items/search`, ""],
    ["GET", `collections/${c}/items/search`, "?ids="],
    [
      "GET",
      `collections/${c}/items/search`,
      `?ids=${Array(101).fill(c).join(",")}`,
    ],
    ["GET", `collections/${c}/items/search`, `?ids=${c},`],
    ["GET", `collections/${c}/items/search`, "?ids=x"],
    ["POST", `collections/${c}/items`, "?clientId=1"],
    ["GET", "access", "?__proto__=x"],
    ["GET", `collections/${c}/items`, "?constructor=x"],
  ])("%s %s%s matches nothing", (method, splat, search) =>
    expect(match(method, splat, search)).toBeUndefined()
  );
});
