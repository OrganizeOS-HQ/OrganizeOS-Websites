import { extendedEncodeURIComponent } from "../../utils/sanitize-s3-key";

/**
 * Path-style URL of an object, `<endpoint>/<bucket>/<key>`.
 *
 * The endpoint keeps its own path, which resolving `/<bucket>/<key>` against
 * it would drop: Supabase Storage serves its S3 API under /storage/v1/s3.
 */
export const createS3ObjectUrl = ({
  endpoint,
  bucket,
  key,
}: {
  endpoint: string;
  bucket: string;
  key: string;
}): URL => {
  // "." and ".." are not encoded and would be resolved away, turning an
  // object request into one for the bucket (a listing) or the service.
  if (key === "" || key === "." || key === "..") {
    throw new Error(`Invalid object key "${key}"`);
  }
  const url = new URL(endpoint);
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePath}/${bucket}/${extendedEncodeURIComponent(key)}`;
  url.search = "";
  url.hash = "";
  return url;
};
