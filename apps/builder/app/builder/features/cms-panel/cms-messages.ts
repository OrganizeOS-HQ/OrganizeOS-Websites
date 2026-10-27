import { z } from "zod";
import type { ResourceRequest } from "@webstudio-is/sdk";

/**
 * The CMS screen's messages to the builder (OrganizeOS design
 * docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md, 4.4 and
 * section 13; the platform's `client/components/cms/messages.ts`).
 *
 * One way, frame to builder. Each message is one flat object, its type beside
 * its fields, with no nested payload:
 *   { type: "cms.item_saved", collection: slug }
 *   { type: "cms.collection_changed", collection: slug | null }
 *   { type: "cms.dirty", dirty: boolean }
 *
 * The schemas are strict: an unknown key (a nested `payload` included), an
 * unknown type or a value of the wrong shape drops the message. A message
 * carries a slug and a flag, never an org, a collection's data or a
 * permission, so nothing here chooses what the builder shows.
 */

/** The platform's collection slug (and collections-sync's). */
const collectionSlug = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);

export const cmsMessageSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("cms.item_saved"), collection: collectionSlug })
    .strict(),
  z
    .object({
      type: z.literal("cms.collection_changed"),
      collection: collectionSlug.nullable(),
    })
    .strict(),
  z.object({ type: z.literal("cms.dirty"), dirty: z.boolean() }).strict(),
]);

export type CmsMessage = z.infer<typeof cmsMessageSchema>;

/** The app's origin, or undefined for a platform URL that does not parse. */
export const getAppOrigin = (platformUrl: string): string | undefined => {
  try {
    const origin = new URL(platformUrl).origin;
    return origin === "null" ? undefined : origin;
  } catch {
    return undefined;
  }
};

/**
 * Read a `message` event: only from the CMS frame's own window and the app's
 * origin, and only a well-formed message. Anything else is undefined.
 */
export const readCmsMessage = (
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  {
    frameWindow,
    platformUrl,
  }: { frameWindow: Window | null | undefined; platformUrl: string }
): CmsMessage | undefined => {
  if (frameWindow === null || frameWindow === undefined) {
    return;
  }
  if (event.source !== frameWindow) {
    return;
  }
  const appOrigin = getAppOrigin(platformUrl);
  if (appOrigin === undefined || event.origin !== appOrigin) {
    return;
  }
  const parsed = cmsMessageSchema.safeParse(event.data);
  return parsed.success ? parsed.data : undefined;
};

/**
 * The current resource requests that read one collection: parsed, on the
 * app's origin, with no userinfo, at `/api/public/v1/collections/{slug}` or
 * under it. Never a string prefix, so `news` does not match `news-archive`.
 */
export const findCollectionRequests = (
  requests: Iterable<ResourceRequest>,
  { slug, platformUrl }: { slug: string; platformUrl: string }
): ResourceRequest[] => {
  const appOrigin = getAppOrigin(platformUrl);
  if (appOrigin === undefined) {
    return [];
  }
  const collectionPath = `/api/public/v1/collections/${slug}`;
  const found: ResourceRequest[] = [];
  for (const request of requests) {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      continue;
    }
    if (url.origin !== appOrigin) {
      continue;
    }
    if (url.username !== "" || url.password !== "") {
      continue;
    }
    if (
      url.pathname === collectionPath ||
      url.pathname.startsWith(`${collectionPath}/`)
    ) {
      found.push(request);
    }
  }
  return found;
};
