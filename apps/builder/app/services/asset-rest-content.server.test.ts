import { describe, expect, test, vi } from "vitest";
import type { Asset } from "@webstudio-is/sdk";
import { assetContentDescriptorHeader } from "@webstudio-is/protocol/asset-resource-api";
import {
  createAssetContentLoader,
  parseRequestRange,
} from "./asset-rest-route-handlers.server";

const asset: Asset = {
  id: "asset-1",
  projectId: "project-1",
  name: "post.md",
  type: "file",
  format: "md",
  size: 10,
  description: null,
  createdAt: "2026-07-25T00:00:00.000Z",
  meta: {},
};

describe("Assets REST content download", () => {
  test("parses one standard byte range", () => {
    expect(parseRequestRange("bytes=2-5", 10)).toEqual({
      offset: 2,
      length: 4,
    });
    expect(() => parseRequestRange("bytes=0-1,4-5", 10)).toThrow(
      "single valid byte range"
    );
    expect(() => parseRequestRange("items=0-1", 10)).toThrow(
      "single valid byte range"
    );
  });

  test("streams an authorized partial response", async () => {
    const readContent = vi.fn(async () => ({
      asset,
      data: {
        async *[Symbol.asyncIterator]() {
          yield new TextEncoder().encode("post");
        },
      },
      contentLength: 4,
    }));
    const dependencies = {
      preventCrossOriginCookie: vi.fn(),
      createRepository: vi.fn(async () => ({
        get: vi.fn(async () => asset),
        readContent,
      })) as never,
    };
    const response = await createAssetContentLoader(dependencies)({
      request: new Request(
        "https://webstudio.is/rest/assets/asset-1/content?projectId=project-1",
        { headers: { range: "bytes=2-5", "x-auth-token": "token" } }
      ),
      params: { assetId: "asset-1" },
    } as never);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("content-length")).toBe("4");
    expect(await response.text()).toBe("post");
    expect(readContent).toHaveBeenCalledWith({
      assetId: "asset-1",
      range: { offset: 2, length: 4 },
      asset,
    });
  });

  test.each<[string, Asset]>([
    ["text/html", { ...asset, name: "page_x.html", format: "html", size: 7 }],
    [
      "image/svg+xml",
      {
        ...asset,
        name: "logo_x.svg",
        type: "image",
        format: "svg",
        size: 7,
        meta: { width: 1, height: 1 },
      },
    ],
  ])("content route sandboxes html and svg: %s", async (mime, stored) => {
    const dependencies = {
      preventCrossOriginCookie: vi.fn(),
      createRepository: vi.fn(async () => ({
        get: vi.fn(async () => stored),
        readContent: vi.fn(async () => ({
          asset: stored,
          data: {
            async *[Symbol.asyncIterator]() {
              yield new TextEncoder().encode("<svg/>!");
            },
          },
          contentLength: 7,
        })),
      })) as never,
    };

    const response = await createAssetContentLoader(dependencies)({
      request: new Request(
        "https://webstudio.is/rest/assets/asset-1/content?projectId=project-1"
      ),
      params: { assetId: "asset-1" },
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(mime);
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get(assetContentDescriptorHeader)).not.toBeNull();
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0"
    );
    expect(await response.text()).toBe("<svg/>!");
  });
});
