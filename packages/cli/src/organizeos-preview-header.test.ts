import { describe, expect, test } from "vitest";
import type { Resource } from "@webstudio-is/sdk";
import {
  assertNoPreviewHeader,
  findPreviewHeaderResources,
} from "./organizeos-preview-header";

const resource = (
  id: string,
  headers: Resource["headers"]
): [string, Resource] => [
  id,
  {
    id,
    name: `Resource ${id}`,
    method: "get",
    url: `"https://app.organizeos.org/api/public/v1/collections/news/items"`,
    headers,
  },
];

describe("findPreviewHeaderResources", () => {
  test.each([
    "X-OOS-Preview",
    "x-oos-preview",
    "X-OOS-PREVIEW",
    " x-Oos-preview ",
  ])("finds a header named %j", (name) => {
    const resources = [
      resource("a", [{ name: "Authorization", value: `"Bearer t"` }]),
      resource("b", [{ name, value: `"v1.x.y"` }]),
    ];
    expect(findPreviewHeaderResources(resources).map(({ id }) => id)).toEqual([
      "b",
    ]);
  });

  test("ignores a value that mentions it, and other headers", () => {
    expect(
      findPreviewHeaderResources([
        resource("a", [{ name: "X-Note", value: `"X-OOS-Preview"` }]),
        resource("b", [{ name: "X-OOS-Preview-Note", value: `"1"` }]),
      ])
    ).toEqual([]);
    expect(findPreviewHeaderResources(undefined)).toEqual([]);
  });
});

describe("assertNoPreviewHeader", () => {
  test("throws naming each Resource that carries it", () => {
    expect(() =>
      assertNoPreviewHeader([
        resource("a", [{ name: "x-oos-preview", value: `"v1.x.y"` }]),
        resource("b", [{ name: "Accept", value: `"application/json"` }]),
      ])
    ).toThrow(/X-OOS-Preview.*"Resource a"/);
  });

  test("passes a build without it", () => {
    expect(() =>
      assertNoPreviewHeader([
        resource("a", [{ name: "Authorization", value: `"Bearer t"` }]),
      ])
    ).not.toThrow();
  });
});
