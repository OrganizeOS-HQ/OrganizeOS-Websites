import { afterEach, expect, test, vi } from "vitest";
import requestFull from "../__fixtures__/rsvps/request-full.json";
import rsvpEnded from "../__fixtures__/rsvps/response-ended.json";
import rsvpFull from "../__fixtures__/rsvps/response-full.json";
import rsvpInvalidField from "../__fixtures__/rsvps/response-invalid-field.json";
import rsvpInvalidRequest from "../__fixtures__/rsvps/response-invalid-request.json";
import rsvpNotFound from "../__fixtures__/rsvps/response-not-found.json";
import rsvpRateLimited from "../__fixtures__/rsvps/response-rate-limited.json";
import rsvpRegistered from "../__fixtures__/rsvps/response-registered.json";
import rsvpRoleFull from "../__fixtures__/rsvps/response-role-full.json";
import rsvpRoleFullNoneOpen from "../__fixtures__/rsvps/response-role-full-none-open.json";
import rsvpUnavailable from "../__fixtures__/rsvps/response-unavailable.json";
import rsvpWaitlisted from "../__fixtures__/rsvps/response-waitlisted.json";
import signupConfirmEmail from "../__fixtures__/signups/response-confirm-email.json";
import signupInvalidField from "../__fixtures__/signups/response-invalid-field.json";
import signupInvalidRequest from "../__fixtures__/signups/response-invalid-request.json";
import signupNotFound from "../__fixtures__/signups/response-not-found.json";
import signupRateLimited from "../__fixtures__/signups/response-rate-limited.json";
import signupReceived from "../__fixtures__/signups/response-received.json";
import signupSubscribed from "../__fixtures__/signups/response-subscribed.json";
import signupUnavailable from "../__fixtures__/signups/response-unavailable.json";
import {
  postToPlatform,
  stateForAnswer,
  type AnswerStates,
  type PlatformAnswer,
} from "./submit";

afterEach(() => {
  vi.unstubAllGlobals();
});

const states: AnswerStates<"done" | "pending" | "failed"> = {
  outcomes: { finished: "done", queued: "pending" },
  success: "done",
  error: "failed",
};

test("known outcomes map to their states, unknown ones to the success state", () => {
  expect(stateForAnswer({ outcome: "queued" }, states)).toEqual({
    state: "pending",
  });
  expect(stateForAnswer({ outcome: "finished" }, states)).toEqual({
    state: "done",
  });
  expect(stateForAnswer({ outcome: "added_later" }, states)).toEqual({
    state: "done",
  });
  // never a key of Object.prototype
  expect(stateForAnswer({ outcome: "constructor" }, states)).toEqual({
    state: "done",
  });
});

test("every error maps to the error state; invalid_field names its field", () => {
  expect(
    stateForAnswer({ error: "invalid_field", field: "email" }, states)
  ).toEqual({ state: "failed", field: "email" });
  expect(stateForAnswer({ error: "rate_limited" }, states)).toEqual({
    state: "failed",
  });
  expect(stateForAnswer({ error: "added_later", field: "x" }, states)).toEqual({
    state: "failed",
  });
});

test.each(["canvas", "preview"] as const)(
  "never posts on the %s",
  async (renderer) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await postToPlatform({ renderer, path: "/api/x", body: {} })
    ).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  }
);

test("posts JSON to a same-origin path and reads the answer", async () => {
  const fetchMock = vi.fn(async () =>
    Response.json({ outcome: "subscribed" }, { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  expect(
    await postToPlatform({
      renderer: undefined,
      path: "/api/x",
      body: { a: 1 },
    })
  ).toEqual({ outcome: "subscribed" });
  expect(fetchMock).toHaveBeenCalledWith("/api/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"a":1}',
    credentials: "same-origin",
  });
});

test("refuses any path that is not on the page's own origin", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  for (const path of ["https://evil.example/x", "//evil.example/x", "api/x"]) {
    expect(
      await postToPlatform({ renderer: undefined, path, body: {} })
    ).toEqual({ error: "invalid_path" });
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

test("answers it cannot read, and network failures, are errors", async () => {
  const answers: Array<[() => Promise<Response>, PlatformAnswer]> = [
    [
      async () => Response.json({ error: "not_found" }, { status: 404 }),
      { error: "not_found" },
    ],
    [
      async () =>
        Response.json(
          { error: "invalid_field", field: "email" },
          { status: 422 }
        ),
      { error: "invalid_field", field: "email" },
    ],
    // an outcome on a failed response is not a success
    [
      async () => Response.json({ outcome: "subscribed" }, { status: 500 }),
      { error: "unreadable_answer" },
    ],
    [
      async () => new Response("<html></html>", { status: 200 }),
      { error: "unreadable_answer" },
    ],
    [
      async () => Response.json(["subscribed"], { status: 200 }),
      { error: "unreadable_answer" },
    ],
    [
      async () => {
        throw new TypeError("Failed to fetch");
      },
      { error: "network" },
    ],
  ];
  for (const [respond, expected] of answers) {
    vi.stubGlobal("fetch", vi.fn(respond));
    expect(
      await postToPlatform({ renderer: undefined, path: "/api/x", body: {} })
    ).toEqual(expected);
  }
});

// The RSVP Form's map, as B4 will give it (the plan's "Answers").
const rsvpStates: AnswerStates<
  "registered" | "waitlisted" | "full" | "ended" | "error" | "unavailable"
> = {
  outcomes: { registered: "registered", waitlisted: "waitlisted" },
  success: "registered",
  errors: { full: "full", ended: "ended", not_found: "unavailable" },
  error: "error",
};

/** What a fixture `{ status, body }` reads as, through the real reader. */
const readFixture = async (fixture: { status: number; body: unknown }) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(fixture.body, { status: fixture.status }))
  );
  const answer = await postToPlatform({
    renderer: undefined,
    path: "/api/x",
    body: {},
  });
  expect(answer).toBeDefined();
  return answer as PlatformAnswer;
};

test("a known error code maps to its own state through the errors map", () => {
  const withErrors: AnswerStates<"done" | "failed" | "gone" | "closed"> = {
    outcomes: { finished: "done" },
    success: "done",
    errors: { not_found: "gone", ended: "closed" },
    error: "failed",
  };
  expect(stateForAnswer({ error: "not_found" }, withErrors)).toEqual({
    state: "gone",
  });
  expect(stateForAnswer({ error: "ended" }, withErrors)).toEqual({
    state: "closed",
  });
  // outcomes are untouched by the errors map
  expect(stateForAnswer({ outcome: "finished" }, withErrors)).toEqual({
    state: "done",
  });
});

test("an error the errors map does not know goes to the error state", () => {
  const withErrors: AnswerStates<"done" | "failed" | "gone"> = {
    outcomes: {},
    success: "done",
    errors: { not_found: "gone" },
    error: "failed",
  };
  expect(stateForAnswer({ error: "rate_limited" }, withErrors)).toEqual({
    state: "failed",
  });
  expect(stateForAnswer({ error: "added_later" }, withErrors)).toEqual({
    state: "failed",
  });
  expect(stateForAnswer({ error: "unreadable_answer" }, withErrors)).toEqual({
    state: "failed",
  });
  // never a key of Object.prototype
  for (const error of [
    "constructor",
    "toString",
    "__proto__",
    "hasOwnProperty",
  ]) {
    expect(stateForAnswer({ error }, withErrors)).toEqual({ state: "failed" });
  }
  // an empty map is the same as none
  expect(
    stateForAnswer({ error: "not_found" }, { ...withErrors, errors: {} })
  ).toEqual({ state: "failed" });
});

test("invalid_field keeps naming its field when an errors map is set", () => {
  expect(
    stateForAnswer({ error: "invalid_field", field: "email" }, rsvpStates)
  ).toEqual({ state: "error", field: "email" });
  // a code the map knows does not carry a field it was not sent
  expect(stateForAnswer({ error: "full", field: "email" }, rsvpStates)).toEqual(
    { state: "full" }
  );
});

test("the RSVP fixtures give their states", async () => {
  const expected: Array<[string, { status: number; body: unknown }, string]> = [
    ["registered", rsvpRegistered, "registered"],
    ["waitlisted", rsvpWaitlisted, "waitlisted"],
    ["full", rsvpFull, "full"],
    ["ended", rsvpEnded, "ended"],
    ["not_found", rsvpNotFound, "unavailable"],
    ["role_full", rsvpRoleFull, "error"],
    ["role_full with none open", rsvpRoleFullNoneOpen, "error"],
    ["invalid_field", rsvpInvalidField, "error"],
    ["invalid_request", rsvpInvalidRequest, "error"],
    ["rate_limited", rsvpRateLimited, "error"],
    ["unavailable", rsvpUnavailable, "error"],
  ];
  for (const [name, fixture, state] of expected) {
    expect(
      stateForAnswer(await readFixture(fixture), rsvpStates).state,
      name
    ).toBe(state);
  }
});

test("an RSVP outcome this build does not know is the success state", () => {
  expect(stateForAnswer({ outcome: "added_later" }, rsvpStates)).toEqual({
    state: "registered",
  });
});

test("open_roles is read from a role_full answer", async () => {
  const answer = await readFixture(rsvpRoleFull);
  expect(answer).toEqual({
    error: "role_full",
    openRoles: [{ id: "6c0a8e41-3f97-4d1b-b5e2-9a7d4c1f8036", name: "Driver" }],
  });
  expect(stateForAnswer(answer, rsvpStates)).toEqual({
    state: "error",
    openRoles: [{ id: "6c0a8e41-3f97-4d1b-b5e2-9a7d4c1f8036", name: "Driver" }],
  });
  // the Driver is the sibling of the Canvasser the full request chose
  expect(requestFull.shift_role_id).not.toBe(
    "6c0a8e41-3f97-4d1b-b5e2-9a7d4c1f8036"
  );
});

test("an empty open_roles stays an empty list: no role is open", async () => {
  const answer = await readFixture(rsvpRoleFullNoneOpen);
  expect(answer).toEqual({ error: "role_full", openRoles: [] });
  const result = stateForAnswer(answer, rsvpStates);
  expect(result).toEqual({ state: "error", openRoles: [] });
  // not the same as an answer that did not say
  expect(stateForAnswer({ error: "role_full" }, rsvpStates)).not.toHaveProperty(
    "openRoles"
  );
});

test("an open_roles that is not a list is ignored", async () => {
  for (const openRoles of [
    null,
    "Driver",
    7,
    true,
    { id: "a", name: "Driver" },
    { 0: { id: "a", name: "Driver" }, length: 1 },
  ]) {
    const answer = await readFixture({
      status: 409,
      body: { error: "role_full", open_roles: openRoles },
    });
    expect(answer).toEqual({ error: "role_full" });
    expect(answer).not.toHaveProperty("openRoles");
  }
});

test("a malformed entry of open_roles is skipped, the others are kept", async () => {
  const answer = await readFixture({
    status: 409,
    body: {
      error: "role_full",
      open_roles: [
        { id: "a", name: "Driver" },
        null,
        "Greeter",
        ["b", "Greeter"],
        {},
        { id: "b" },
        { name: "Greeter" },
        { id: 3, name: "Greeter" },
        { id: "c", name: 4 },
        { id: "", name: "Greeter" },
        // counts and anything else the platform might add are not passed on
        { id: "d", name: "Host", capacity: 4, filled_count: 1 },
      ],
    },
  });
  expect(answer).toEqual({
    error: "role_full",
    openRoles: [
      { id: "a", name: "Driver" },
      { id: "d", name: "Host" },
    ],
  });
});

test("open_roles is read from an error answer only, never from a success", async () => {
  expect(
    await readFixture({
      status: 200,
      body: {
        outcome: "registered",
        open_roles: [{ id: "a", name: "Driver" }],
      },
    })
  ).toEqual({ outcome: "registered" });
});

test("the answer keeps field and open_roles together when both are sent", async () => {
  expect(
    await readFixture({
      status: 409,
      body: {
        error: "role_full",
        field: "shift_role_id",
        open_roles: [{ id: "a", name: "Driver" }],
      },
    })
  ).toEqual({
    error: "role_full",
    field: "shift_role_id",
    openRoles: [{ id: "a", name: "Driver" }],
  });
});

test("the Signup Form passes no errors map, so it maps exactly as before", async () => {
  // restated from signup-form.tsx: no `errors`
  const signupStates: AnswerStates<"success" | "confirm-email" | "error"> = {
    outcomes: {
      subscribed: "success",
      received: "success",
      confirm_email: "confirm-email",
    },
    success: "success",
    error: "error",
  };
  const expected: Array<
    [{ status: number; body: unknown }, ReturnType<typeof stateForAnswer>]
  > = [
    [signupSubscribed, { state: "success" }],
    [signupReceived, { state: "success" }],
    [signupConfirmEmail, { state: "confirm-email" }],
    [signupInvalidField, { state: "error", field: "email" }],
    [signupInvalidRequest, { state: "error" }],
    [signupNotFound, { state: "error" }],
    [signupRateLimited, { state: "error" }],
    [signupUnavailable, { state: "error" }],
  ];
  for (const [fixture, result] of expected) {
    const answer = await readFixture(fixture);
    const mapped = stateForAnswer(answer, signupStates);
    expect(mapped).toEqual(result);
    // and nothing new on the result
    expect(Object.keys(mapped).sort()).toEqual(Object.keys(result).sort());
  }
  // the codes an RSVP map knows are plain errors to a map without one
  for (const error of ["full", "ended", "not_found", "role_full"]) {
    expect(stateForAnswer({ error }, signupStates)).toEqual({ state: "error" });
  }
});
