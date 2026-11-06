import { afterEach, describe, expect, test, vi } from "vitest";
import { createS3AssetObjectStore } from "./s3";

const options = {
  endpoint: "https://ref.supabase.co/storage/v1/s3",
  region: "us-east-1",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret",
  bucket: "builder-assets",
  maxUploadSize: 1024 * 1024,
};

type SentRequest = { url: string; method?: string; headers: Headers };

const stubStorage = (respond: () => Response) => {
  const sent: SentRequest[] = [];
  vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
    sent.push({
      url: url.href,
      method: init.method,
      headers: new Headers(init.headers),
    });
    return respond();
  });
  return sent;
};

const signedHeaders = (headers: Headers) =>
  headers.get("authorization")?.match(/SignedHeaders=([^,]+)/)?.[1];

const readAll = async (data: AsyncIterable<Uint8Array>) => {
  const chunks: number[] = [];
  for await (const chunk of data) {
    chunks.push(...chunk);
  }
  return new TextDecoder().decode(new Uint8Array(chunks));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readFileResponse", () => {
  test("sends a signed GET for the object", async () => {
    const sent = stubStorage(() => new Response("bytes"));

    const response = await createS3AssetObjectStore(options).readFileResponse(
      "photo_x.png",
      { range: "bytes=0-1" }
    );

    expect(await response?.text()).toBe("bytes");
    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request.method).toBe("GET");
    expect(request.url).toBe(
      "https://ref.supabase.co/storage/v1/s3/builder-assets/photo_x.png"
    );
    expect(signedHeaders(request.headers)).toBe(
      "host;range;x-amz-content-sha256;x-amz-date"
    );
    // signed, but sent by fetch itself from the URL
    expect(request.headers.has("host")).toBe(false);
    expect(request.headers.get("range")).toBe("bytes=0-1");
    expect(request.headers.get("accept-encoding")).toBe("identity");
  });

  test("sends no range for a full read", async () => {
    const sent = stubStorage(() => new Response("bytes"));

    await createS3AssetObjectStore(options).readFileResponse("photo_x.png", {});

    const [request] = sent;
    expect(request.headers.has("range")).toBe(false);
    expect(signedHeaders(request.headers)).toBe(
      "host;x-amz-content-sha256;x-amz-date"
    );
  });

  test("resolves to undefined for a missing object", async () => {
    stubStorage(
      () =>
        new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 })
    );
    expect(
      await createS3AssetObjectStore(options).readFileResponse(
        "photo_x.png",
        {}
      )
    ).toBeUndefined();
  });

  test("throws on any other storage error, without its body", async () => {
    stubStorage(
      () =>
        new Response("<Error><Code>AccessDenied</Code></Error>", {
          status: 403,
        })
    );
    await expect(
      createS3AssetObjectStore(options).readFileResponse("photo_x.png", {})
    ).rejects.toThrow(/^Cannot read file photo_x\.png: storage responded 403$/);
  });

  test.each([206, 416])("returns a %i answer to a range", async (status) => {
    stubStorage(
      () =>
        new Response(null, {
          status,
          headers: { "content-range": "bytes */4" },
        })
    );
    const response = await createS3AssetObjectStore(options).readFileResponse(
      "clip_x.mp4",
      { range: "bytes=9-" }
    );
    expect(response?.status).toBe(status);
  });

  test.each(["", ".", ".."])(
    "refuses %j before asking storage",
    async (name) => {
      const sent = stubStorage(() => new Response("bytes"));
      await expect(
        createS3AssetObjectStore(options).readFileResponse(name, {})
      ).rejects.toThrow();
      expect(sent).toHaveLength(0);
    }
  );
});

describe("readFile", () => {
  test("reads a byte range under the endpoint's path", async () => {
    const sent = stubStorage(
      () =>
        new Response("post", {
          status: 206,
          headers: { "content-length": "4" },
        })
    );

    const result = await createS3AssetObjectStore(options).readFile(
      "post_x.md",
      { offset: 2, length: 4 }
    );

    expect(await readAll(result.data)).toBe("post");
    expect(result.contentLength).toBe(4);
    const [request] = sent;
    expect(request.method).toBe("GET");
    expect(request.url).toBe(
      "https://ref.supabase.co/storage/v1/s3/builder-assets/post_x.md"
    );
    expect(request.headers.get("range")).toBe("bytes=2-5");
    expect(request.headers.has("host")).toBe(false);
  });

  test("throws for a missing object", async () => {
    stubStorage(() => new Response(null, { status: 404 }));
    await expect(
      createS3AssetObjectStore(options).readFile("post_x.md")
    ).rejects.toThrow("Cannot read asset file");
  });
});

describe("uploadFile", () => {
  test("PUTs the object under the endpoint's path", async () => {
    const sent = stubStorage(() => new Response(null, { status: 200 }));

    const asset = await createS3AssetObjectStore(options).uploadFile(
      "clip_x.mp4",
      "video",
      (async function* () {
        yield new Uint8Array([1, 2, 3]);
      })(),
      { width: 640, height: 360, format: "mp4" }
    );

    expect(asset.size).toBe(3);
    const [request] = sent;
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(
      "https://ref.supabase.co/storage/v1/s3/builder-assets/clip_x.mp4"
    );
    expect(signedHeaders(request.headers)).toContain("host;");
    expect(request.headers.has("host")).toBe(false);
    expect(request.headers.get("content-type")).toBe("video/mp4");
  });
});
