import { describe, expect, test } from "vitest";
import { createS3ObjectUrl } from "./object-url";

describe("createS3ObjectUrl", () => {
  test("encodes a flat asset key including separators", () => {
    expect(
      createS3ObjectUrl({
        endpoint: "https://storage.example",
        bucket: "assets",
        key: "folder/project one",
      }).pathname
    ).toBe("/assets/folder%2Fproject%20one");
  });

  test("keeps the endpoint path", () => {
    expect(
      createS3ObjectUrl({
        endpoint: "https://ref.supabase.co/storage/v1/s3",
        bucket: "builder-assets",
        key: "photo_x.png",
      }).href
    ).toBe("https://ref.supabase.co/storage/v1/s3/builder-assets/photo_x.png");
  });

  test("keeps the endpoint path given with a trailing slash", () => {
    expect(
      createS3ObjectUrl({
        endpoint: "https://ref.supabase.co/storage/v1/s3/",
        bucket: "builder-assets",
        key: "photo_x.png",
      }).href
    ).toBe("https://ref.supabase.co/storage/v1/s3/builder-assets/photo_x.png");
  });

  test("appends bucket and key to an endpoint without a path", () => {
    expect(
      createS3ObjectUrl({
        endpoint: "https://account.r2.cloudflarestorage.com",
        bucket: "builder-assets",
        key: "photo_x.png",
      }).href
    ).toBe(
      "https://account.r2.cloudflarestorage.com/builder-assets/photo_x.png"
    );
  });

  test("encodes the key as a single path segment", () => {
    expect(
      createS3ObjectUrl({
        endpoint: "http://localhost:9000",
        bucket: "builder-assets",
        key: "фото (1)!*/x.png",
      }).pathname
    ).toBe("/builder-assets/%D1%84%D0%BE%D1%82%D0%BE%20%281%29%21%2A%2Fx.png");
  });

  test.each(["", ".", ".."])(
    "refuses %j, which would address the bucket or the service",
    (key) => {
      expect(() =>
        createS3ObjectUrl({ endpoint: "https://s3.test", bucket: "b", key })
      ).toThrow();
    }
  );
});
