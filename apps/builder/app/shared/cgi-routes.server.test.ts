import { afterEach, describe, expect, test, vi } from "vitest";

// Routes read the environment once, when first imported
vi.hoisted(() => {
  Object.assign(process.env, {
    S3_ENDPOINT: "https://ref.supabase.co/storage/v1/s3",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "AKIDEXAMPLE",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_BUCKET: "builder-assets",
  });
});

import { getAssetUrl } from "@webstudio-is/sdk";
import { loader as assetLoader } from "~/routes/cgi.asset.$";
import { loader as imageLoader } from "~/routes/cgi.image.$";
import { loader as videoLoader } from "~/routes/cgi.video.$";

type Loader = typeof assetLoader;

const load = async (loader: Loader, path: string, init?: RequestInit) => {
  try {
    return await loader({
      request: new Request(`https://builder.test${path}`, init),
      params: {},
      context: {},
    });
  } catch (thrown) {
    if (thrown instanceof Response) {
      return thrown;
    }
    throw thrown;
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const routes: Array<[string, Loader]> = [
  ["asset", assetLoader],
  ["image", imageLoader],
  ["video", videoLoader],
];

describe.each(routes)("/cgi/%s", (route, loader) => {
  test("serves an upload from the bucket, sandboxed", async () => {
    const requested: string[] = [];
    vi.stubGlobal("fetch", async (url: URL) => {
      requested.push(url.href);
      return new Response(new Uint8Array([137, 80, 78, 71]));
    });

    const response = await load(loader, `/cgi/${route}/photo_x.png?format=raw`);

    expect(requested).toEqual([
      "https://ref.supabase.co/storage/v1/s3/builder-assets/photo_x.png",
    ]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Security-Policy")).toBe("sandbox");
  });

  test("serves a ranged and a full read through readFileResponse", async () => {
    const sent: Headers[] = [];
    vi.stubGlobal("fetch", async (_url: URL, init: RequestInit) => {
      const headers = new Headers(init.headers);
      sent.push(headers);
      // an open-ended range, which only a Range header can carry to storage
      return headers.get("range") === "bytes=2-"
        ? new Response(new Uint8Array([78, 71]), {
            status: 206,
            headers: {
              "Accept-Ranges": "bytes",
              "Content-Range": "bytes 2-3/4",
              "Content-Length": "2",
            },
          })
        : new Response(new Uint8Array([137, 80, 78, 71]), {
            headers: { "Accept-Ranges": "bytes", "Content-Length": "4" },
          });
    });

    const ranged = await load(loader, `/cgi/${route}/clip_x.mp4`, {
      headers: { range: "bytes=2-" },
    });
    const full = await load(loader, `/cgi/${route}/clip_x.mp4`);

    expect(sent).toHaveLength(2);
    expect(sent[0].get("range")).toBe("bytes=2-");
    expect(sent[0].get("authorization")).toMatch(/SignedHeaders=host;range;/);
    expect(sent[1].has("range")).toBe(false);

    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("Content-Range")).toBe("bytes 2-3/4");
    expect(ranged.headers.get("Content-Length")).toBe("2");
    expect(ranged.headers.get("Content-Type")).toBe("video/mp4");
    expect([...new Uint8Array(await ranged.arrayBuffer())]).toEqual([78, 71]);

    expect(full.status).toBe(200);
    expect(full.headers.get("Content-Length")).toBe("4");
    expect(full.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect([...new Uint8Array(await full.arrayBuffer())]).toEqual([
      137, 80, 78, 71,
    ]);
  });

  test("keeps a remote page's cookies and script off the builder", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("<script>steal()</script>", {
          headers: {
            "Content-Type": "text/html",
            "Set-Cookie": "session=attacker; Domain=organizeos.org",
          },
        })
    );

    const response = await load(
      loader,
      `/cgi/${route}/${encodeURIComponent("https://remote.test/x.html")}`
    );

    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

test("a publish downloads an uploaded image intact", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const sent: Array<{ url: string; headers: Headers }> = [];
  vi.stubGlobal("fetch", async (url: URL, init: RequestInit) => {
    sent.push({ url: url.href, headers: new Headers(init.headers) });
    return new Response(png, { headers: { "Content-Length": "8" } });
  });

  // the URL the publish CLI downloads every asset from
  const url = getAssetUrl({ name: "photo_x.png" }, "https://builder.test");
  expect(url.pathname).toBe("/cgi/image/photo_x.png");
  const response = await load(imageLoader, `${url.pathname}${url.search}`);

  expect(sent).toHaveLength(1);
  expect(sent[0].url).toBe(
    "https://ref.supabase.co/storage/v1/s3/builder-assets/photo_x.png"
  );
  expect(sent[0].headers.has("range")).toBe(false);
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
});
