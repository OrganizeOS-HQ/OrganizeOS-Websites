import { z } from "zod";
import {
  type DoorPattern,
  type DoorRouteDeps,
  handleDoorRequest,
} from "~/services/organizeos-door-route.server";
import { FORMS_PLATFORM_BASE_PATH } from "~/shared/organizeos-cms.server";

/**
 * OrganizeOS fork: the forms door's relay (docs/ORGANIZEOS-FORK.md section
 * 9, "Site forms"; builder forms spec 7.1 and 7.3). The Settings panel's
 * forms calls go through the builder door's steps
 * (organizeos-door-route.server.ts) with the `forms` audience, to
 * `/api/internal/websites2/forms/{organizationId}/...`:
 *
 * - F0 `GET access`
 * - F1 `GET catalog?kind=`
 * - F2 `GET forms?kind=`
 * - F3 `POST forms`
 * - F4 `PUT forms/{formId}/settings`
 *
 * F5 (`PUT builds/{buildId}/fields`) is not relayed: only the publish route
 * stages a build's forms. The relay answers 404 to everything while
 * `ORGANIZEOS_SITE_FORMS` is not exactly `true`.
 */

export type FormsEndpoint = "F0" | "F1" | "F2" | "F3" | "F4";

/** A JSON body's cap: F3 and F4 are a few hundred bytes. */
export const FORMS_JSON_BODY_MAX_BYTES = 65_536;

const noQuery = z.object({}).strict();

const kindQuery = z
  .object({ kind: z.enum(["contact-signup", "contact-form", "membership"]) })
  .strict();

const patterns: DoorPattern<FormsEndpoint>[] = [
  {
    endpoint: "F0",
    method: "GET",
    segments: ["access"],
    query: noQuery,
    body: "none",
  },
  {
    endpoint: "F1",
    method: "GET",
    segments: ["catalog"],
    query: kindQuery,
    body: "none",
  },
  {
    endpoint: "F2",
    method: "GET",
    segments: ["forms"],
    query: kindQuery,
    body: "none",
  },
  {
    endpoint: "F3",
    method: "POST",
    segments: ["forms"],
    query: noQuery,
    body: "json",
  },
  {
    endpoint: "F4",
    method: "PUT",
    segments: ["forms", "{f}", "settings"],
    query: noQuery,
    body: "json",
  },
];

export type FormsRouteDeps = DoorRouteDeps & {
  /** `ORGANIZEOS_SITE_FORMS` is exactly `true`. */
  enabled: boolean;
};

export const handleFormsRequest = (
  request: Request,
  projectId: string | undefined,
  splat: string | undefined,
  { enabled, ...deps }: FormsRouteDeps
): Promise<Response> =>
  handleDoorRequest(request, projectId, splat, deps, {
    audience: "forms",
    basePath: FORMS_PLATFORM_BASE_PATH,
    patterns,
    jsonBodyMaxBytes: FORMS_JSON_BODY_MAX_BYTES,
    logTag: "forms",
    enabled,
  });
