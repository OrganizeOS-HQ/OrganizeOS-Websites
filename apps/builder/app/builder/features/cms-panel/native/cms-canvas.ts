/**
 * The one canvas refresh after a CMS write: the canvas's current requests
 * for the collection are invalidated, so its lists and item pages refetch.
 */
import { $computedResourceRequests } from "~/shared/nano-states";
import { invalidateResource } from "~/shared/resources";
import { findCollectionRequests } from "../cms-messages";

export const invalidateCollectionOnCanvas = (
  slug: string,
  platformUrl: string
) => {
  const requests = findCollectionRequests($computedResourceRequests.get(), {
    slug,
    platformUrl,
  });
  for (const request of requests) {
    invalidateResource(request);
  }
};
