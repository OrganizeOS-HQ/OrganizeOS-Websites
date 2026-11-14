import { z } from "zod";
import { fetch } from "~/shared/fetch.client";

/**
 * OrganizeOS fork: the Settings panel's client of OrganizeOS's forms door
 * (docs/ORGANIZEOS-FORK.md section 9, "Site forms"; builder forms spec 7.3).
 * Every call goes through the builder's relay,
 * `/rest/organizeos-forms/{projectId}/...` (§5, "The forms door"), with the
 * builder's own fetch, which adds the page's CSRF token, and a 15 second
 * timeout. Every call answers `{ ok: true, value }` or `{ ok: false, error }`
 * and never throws:
 *
 * - a door code the panel acts on is that code;
 * - `lost` is a timeout or a failed send, so a create can be retried with
 *   the same `clientId` (F3 makes at most one form per `clientId`);
 * - anything else (an unknown code, a refused assertion, a non-JSON answer,
 *   a success its schema refuses) is `unavailable`.
 *
 * Answers are read leniently: a key the door adds later is ignored. The
 * shapes are pinned by the platform's fixtures, copied to
 * `shared/__fixtures__/forms-door/`.
 */

export const FORMS_REQUEST_TIMEOUT_MS = 15_000;

export type FormsKind = "contact-signup" | "contact-form" | "membership";

const formsErrorCodes = [
  "no_permission",
  "forbidden",
  "mfa_required",
  "plan",
  "locked",
  "conflict",
  "invalid_field",
  "rate_limited",
  "unauthorized",
  "unavailable",
] as const;

export type FormsErrorCode = (typeof formsErrorCodes)[number] | "lost";

export type FormsResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: FormsErrorCode };

export type FormsAccess = {
  orgName: string;
  canEditPrivate: boolean;
  smsAvailable: boolean;
};

export type CatalogField = {
  key: string;
  label: string;
  type: string;
  locked: boolean;
  custom: boolean;
  options?: string[];
  consent?: string;
};

export type FormsCatalog = {
  fields: CatalogField[];
  lists: Array<{ id: string; name: string }>;
};

export type DoorFormField = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};

export type DoorForm = {
  id: string;
  title: string;
  site: boolean;
  published: boolean;
  fields: DoorFormField[];
  opt_in: "single" | "double";
  /** Only to an owner or admin (`canEditPrivate`). */
  lists?: string[];
  /** Only to an owner or admin, and only on a contact form. */
  notify?: string[];
};

export type CreateSiteFormBody = {
  kind: FormsKind;
  title: string;
  fields: Array<{ key: string; required: boolean }>;
  clientId: string;
};

export type FormSettingsBody = {
  optIn?: "single" | "double";
  lists?: string[];
  notify?: string[];
};

const accessSchema: z.ZodType<FormsAccess> = z.object({
  orgName: z.string(),
  canEditPrivate: z.boolean(),
  smsAvailable: z.boolean(),
});

const catalogFieldSchema: z.ZodType<CatalogField> = z.object({
  key: z.string(),
  label: z.string(),
  type: z.string(),
  locked: z.boolean(),
  custom: z.boolean(),
  options: z.array(z.string()).optional(),
  consent: z.string().optional(),
});

const catalogSchema: z.ZodType<FormsCatalog> = z.object({
  fields: z.array(catalogFieldSchema),
  lists: z.array(z.object({ id: z.string(), name: z.string() })),
});

const doorFormSchema: z.ZodType<DoorForm> = z.object({
  id: z.string(),
  title: z.string(),
  site: z.boolean(),
  published: z.boolean(),
  fields: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      type: z.string(),
      required: z.boolean(),
      options: z.array(z.string()).optional(),
    })
  ),
  opt_in: z.enum(["single", "double"]),
  lists: z.array(z.string()).optional(),
  notify: z.array(z.string()).optional(),
});

const formsSchema = z.object({ forms: z.array(doorFormSchema) });

const doorFormFieldSchema: z.ZodType<DoorFormField> = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

/** F3's answer: the new form's id and its fields as the platform resolved them. */
export type CreatedSiteForm = { id: string; fields: DoorFormField[] };

const createdSchema = z.object({
  form: z.object({ id: z.string(), fields: z.array(doorFormFieldSchema) }),
});

const savedSchema = z.object({ ok: z.literal(true) });

const failureSchema = z.object({ error: z.enum(formsErrorCodes) });

const unavailable = { ok: false, error: "unavailable" } as const;

export const formsDoorPath = (
  projectId: string,
  path: string,
  query?: Record<string, string>
) => {
  const route = `/rest/organizeos-forms/${encodeURIComponent(projectId)}/${path}`;
  const search = new URLSearchParams(query).toString();
  return search === "" ? route : `${route}?${search}`;
};

type Send = { method: "GET" } | { method: "POST" | "PUT"; json: unknown };

const request = async <Value, Answer>(
  path: string,
  schema: z.ZodType<Value>,
  send: Send,
  read: (value: Value) => Answer
): Promise<FormsResult<Answer>> => {
  let response: Response;
  try {
    const init: RequestInit = {
      method: send.method,
      signal: AbortSignal.timeout(FORMS_REQUEST_TIMEOUT_MS),
    };
    if ("json" in send) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(send.json);
    }
    response = await fetch(path, init);
  } catch {
    return { ok: false, error: "lost" };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    // the timeout can land while the body is read: the answer, an F3 that
    // made its form among them, is lost, not refused
    return error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
      ? { ok: false, error: "lost" }
      : unavailable;
  }
  if (response.ok) {
    const parsed = schema.safeParse(body);
    return parsed.success
      ? { ok: true, value: read(parsed.data) }
      : unavailable;
  }
  const failure = failureSchema.safeParse(body);
  return failure.success
    ? { ok: false, error: failure.data.error }
    : unavailable;
};

export const getFormsAccess = (projectId: string) =>
  request(
    formsDoorPath(projectId, "access"),
    accessSchema,
    { method: "GET" },
    (access) => access
  );

export const getFormsCatalog = (projectId: string, kind: FormsKind) =>
  request(
    formsDoorPath(projectId, "catalog", { kind }),
    catalogSchema,
    { method: "GET" },
    (catalog) => catalog
  );

export const listDoorForms = (projectId: string, kind: FormsKind) =>
  request(
    formsDoorPath(projectId, "forms", { kind }),
    formsSchema,
    { method: "GET" },
    ({ forms }) => forms
  );

export const createSiteForm = (projectId: string, body: CreateSiteFormBody) =>
  request(
    formsDoorPath(projectId, "forms"),
    createdSchema,
    { method: "POST", json: body },
    ({ form }): CreatedSiteForm => ({ id: form.id, fields: form.fields })
  );

export const saveFormSettings = (
  projectId: string,
  formId: string,
  body: FormSettingsBody
) =>
  request(
    formsDoorPath(projectId, `forms/${encodeURIComponent(formId)}/settings`),
    savedSchema,
    { method: "PUT", json: body },
    () => null
  );
