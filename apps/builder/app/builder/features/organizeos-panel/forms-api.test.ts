import { afterEach, describe, expect, test, vi } from "vitest";
import accessFixture from "~/shared/__fixtures__/forms-door/f0-access.json";
import catalogFixture from "~/shared/__fixtures__/forms-door/f1-catalog.json";
import formsFixture from "~/shared/__fixtures__/forms-door/f2-forms.json";
import createFixture from "~/shared/__fixtures__/forms-door/f3-create.json";
import invalidFieldFixture from "~/shared/__fixtures__/forms-door/f3-create-invalid-field.json";
import settingsFixture from "~/shared/__fixtures__/forms-door/f4-settings.json";
import {
  FORMS_REQUEST_TIMEOUT_MS,
  createSiteForm,
  getFormsAccess,
  getFormsCatalog,
  listDoorForms,
  saveFormSettings,
} from "./forms-api";

// OrganizeOS fork: the Settings panel's client of the forms door (builder
// forms spec 7.3; plan 2026-11-13-builder-forms-fork-p2, Task 7). Every call
// goes through the builder's relay, /rest/organizeos-forms/{projectId}/...,
// and answers a value or a code, never a throw. The answers are pinned by the
// platform's fixtures, copied to shared/__fixtures__/forms-door/.

const { routeFetch } = vi.hoisted(() => ({ routeFetch: vi.fn() }));

vi.mock("~/shared/fetch.client", () => ({
  fetch: (...args: unknown[]) => routeFetch(...args),
}));

const projectId = "project-1";
const base = `/rest/organizeos-forms/${projectId}`;

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type Fixture = {
  request: { method: string; path: string; body?: unknown };
  status: number;
  answer: unknown;
};

const replay = (fixture: Fixture) => {
  routeFetch.mockResolvedValueOnce(answer(fixture.answer, fixture.status));
};

/** What the client sent: its path, method and JSON body. */
const sent = () => {
  expect(routeFetch).toHaveBeenCalledTimes(1);
  const [path, init] = routeFetch.mock.calls[0] as [string, RequestInit];
  return {
    path,
    method: init.method,
    body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    contentType: (init.headers as Record<string, string> | undefined)?.[
      "Content-Type"
    ],
    signal: init.signal,
  };
};

afterEach(() => {
  routeFetch.mockReset();
  vi.useRealTimers();
});

describe("the forms door client", () => {
  test("F0 reads the access facts", async () => {
    replay(accessFixture);
    expect(await getFormsAccess(projectId)).toEqual({
      ok: true,
      value: accessFixture.answer,
    });
    expect(sent()).toMatchObject({
      path: `${base}${accessFixture.request.path}`,
      method: "GET",
      body: undefined,
    });
  });

  test("F1 reads a kind's catalog and the org's lists", async () => {
    replay(catalogFixture);
    expect(await getFormsCatalog(projectId, "membership")).toEqual({
      ok: true,
      value: catalogFixture.answer,
    });
    expect(sent()).toMatchObject({
      path: `${base}${catalogFixture.request.path}`,
      method: "GET",
    });
  });

  test("F2 reads a kind's forms, site forms first, as the door sends them", async () => {
    replay(formsFixture);
    expect(await listDoorForms(projectId, "contact-signup")).toEqual({
      ok: true,
      value: formsFixture.answer.forms,
    });
    expect(sent()).toMatchObject({
      path: `${base}${formsFixture.request.path}`,
      method: "GET",
    });
  });

  test("F3 creates a site form with the exact body, and answers its id", async () => {
    replay(createFixture);
    const body = createFixture.request.body as Parameters<
      typeof createSiteForm
    >[1];
    expect(await createSiteForm(projectId, body)).toEqual({
      ok: true,
      value: {
        id: "{form id}",
        fields: createFixture.answer.form.fields,
      },
    });
    expect(sent()).toMatchObject({
      path: `${base}${createFixture.request.path}`,
      method: "POST",
      body,
      contentType: "application/json",
    });
  });

  test("F3's invalid_field is a code", async () => {
    replay(invalidFieldFixture);
    const body = invalidFieldFixture.request.body as Parameters<
      typeof createSiteForm
    >[1];
    expect(await createSiteForm(projectId, body)).toEqual({
      ok: false,
      error: "invalid_field",
    });
  });

  test("F4 saves the settings with the exact body", async () => {
    replay(settingsFixture);
    const formId = "51000000-0000-4000-8000-000000000001";
    const body = settingsFixture.request.body as Parameters<
      typeof saveFormSettings
    >[2];
    expect(await saveFormSettings(projectId, formId, body)).toEqual({
      ok: true,
      value: null,
    });
    expect(sent()).toMatchObject({
      path: `${base}${settingsFixture.request.path}`,
      method: "PUT",
      body,
      contentType: "application/json",
    });
  });

  test.each([
    ["no_permission", 403],
    ["forbidden", 403],
    ["mfa_required", 403],
    ["plan", 403],
    ["locked", 409],
    ["conflict", 409],
    ["rate_limited", 429],
    ["unauthorized", 401],
    ["unavailable", 503],
  ] as const)("the door's %s is that code", async (code, status) => {
    routeFetch.mockResolvedValueOnce(answer({ error: code }, status));
    expect(await getFormsAccess(projectId)).toEqual({ ok: false, error: code });
  });

  test("an unknown code, or a refused assertion, is unavailable", async () => {
    routeFetch.mockResolvedValueOnce(answer({ error: "refused" }, 401));
    expect(await getFormsAccess(projectId)).toEqual({
      ok: false,
      error: "unavailable",
    });
    routeFetch.mockResolvedValueOnce(answer({ error: "something_new" }, 400));
    expect(await getFormsAccess(projectId)).toEqual({
      ok: false,
      error: "unavailable",
    });
  });

  test("a non-JSON answer, or a success the schema refuses, is unavailable", async () => {
    routeFetch.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect(await getFormsAccess(projectId)).toEqual({
      ok: false,
      error: "unavailable",
    });
    routeFetch.mockResolvedValueOnce(answer({ orgName: 7 }));
    expect(await getFormsAccess(projectId)).toEqual({
      ok: false,
      error: "unavailable",
    });
  });

  test("a failed send, or the client's own 15 second timeout, is lost", async () => {
    routeFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await getFormsAccess(projectId)).toEqual({
      ok: false,
      error: "lost",
    });
    routeFetch.mockRejectedValueOnce(
      new DOMException("The operation timed out.", "TimeoutError")
    );
    expect(await getFormsAccess(projectId)).toEqual({
      ok: false,
      error: "lost",
    });
    expect(FORMS_REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  // final review M8: F3's answer cut off mid-body may have made the form
  test("the timeout landing while the body is read is lost too", async () => {
    routeFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.reject(
          new DOMException("The operation timed out.", "TimeoutError")
        ),
    });
    expect(
      await createSiteForm(projectId, {
        kind: "contact-signup",
        title: "Home: Email bar",
        fields: [{ key: "email", required: true }],
        clientId: "c0000000-0000-4000-8000-000000000001",
      })
    ).toEqual({ ok: false, error: "lost" });
  });

  test("reads leniently: a key the door adds later is ignored", async () => {
    routeFetch.mockResolvedValueOnce(
      answer({ ...accessFixture.answer, laterKey: true })
    );
    expect(await getFormsAccess(projectId)).toEqual({
      ok: true,
      value: accessFixture.answer,
    });
  });
});
