/**
 * @vitest-environment jsdom
 */
import { useCallback, useContext, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import events from "../__fixtures__/events.json";
import requestFull from "../__fixtures__/rsvps/request-full.json";
import requestMinimal from "../__fixtures__/rsvps/request-minimal.json";
import responseEnded from "../__fixtures__/rsvps/response-ended.json";
import responseFull from "../__fixtures__/rsvps/response-full.json";
import responseInvalidField from "../__fixtures__/rsvps/response-invalid-field.json";
import responseInvalidRequest from "../__fixtures__/rsvps/response-invalid-request.json";
import responseNotFound from "../__fixtures__/rsvps/response-not-found.json";
import responseRateLimited from "../__fixtures__/rsvps/response-rate-limited.json";
import responseRegistered from "../__fixtures__/rsvps/response-registered.json";
import responseRoleFullNoneOpen from "../__fixtures__/rsvps/response-role-full-none-open.json";
import responseRoleFull from "../__fixtures__/rsvps/response-role-full.json";
import responseUnavailable from "../__fixtures__/rsvps/response-unavailable.json";
import responseWaitlisted from "../__fixtures__/rsvps/response-waitlisted.json";
import { FormRootContext, useRegisterPart } from "../form/context";
import { navigateTo } from "../form/navigate";
import type { Renderer } from "../form/submit";
import { Field, FieldInput, FieldLabel, FieldMessage } from "../signup/field";
import { SubmitButton } from "../signup/submit-button";
import { useRsvpContext } from "./context";
import { RsvpForm } from "./rsvp-form";
import type { RsvpFormState } from "./states";

vi.mock("../form/navigate", () => ({ navigateTo: vi.fn(() => true) }));

const [voterDrive, phoneBank, cookout, canvassLaunch, rally] = events.data;
const missingEventId = "00000000-0000-4000-8000-000000000000";
// Afternoon canvass, with its roles Canvasser and Driver
const afternoonShiftId = requestFull.shift_ids[0];
const canvasserId = requestFull.shift_role_id;
const driverId = responseRoleFull.body.open_roles[0].id;
const tShirtQuestionId = Object.keys(requestFull.answers)[4];

// The fixtures' events have real dates: the tests pin the clock the block reads.
const today = new Date("2026-10-21T12:00:00Z");

const Sdk = ({
  renderer,
  children,
}: {
  renderer: Renderer;
  children: ReactNode;
}) => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
      renderer,
    }}
  >
    {children}
  </ReactSdkContext.Provider>
);

/** One Field with its three parts, labelled with the designer's text. */
const TestField = ({
  name,
  label,
  input = true,
}: {
  name: string;
  label: string;
  input?: boolean;
}) => (
  <Field field={name}>
    <FieldLabel>{label}</FieldLabel>
    {input && <FieldInput />}
    <FieldMessage />
  </Field>
);

type PartKind = "guests" | "shifts" | "questions" | "consent";

/**
 * Stands in for one of the composite parts, so the root is tested on its own
 * (rsvp-parts.test.tsx has the real ones): it registers with its root and
 * collects the value it is given.
 */
const StubPart = ({ kind, value }: { kind: PartKind; value: unknown }) => {
  const collect = useCallback(() => value, [value]);
  useRegisterPart({ kind, collect });
  return null;
};

/** Shows what a part would read from its root and from the RSVP context. */
const Probe = () => {
  const root = useContext(FormRootContext);
  const rsvp = useRsvpContext();
  return (
    <output data-testid="probe">
      {JSON.stringify({
        state: root?.state,
        errors: Object.fromEntries(root?.fieldErrors ?? []),
        fullRoleIds: Array.from(rsvp?.fullRoleIds ?? []).sort(),
        openRoleIds: Array.from(rsvp?.openRoleIds ?? []).sort(),
        event: rsvp?.event?.id,
      })}
    </output>
  );
};

const readProbe = () =>
  JSON.parse(screen.getByTestId("probe").textContent ?? "") as {
    state: string | undefined;
    errors: Record<string, string>;
    fullRoleIds: string[];
    openRoleIds: string[];
    event: string | undefined;
  };

const defaultFields: Array<[name: string, label: string]> = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["email", "Email"],
  ["phone", "Phone"],
];

type BlockOptions = {
  renderer?: Renderer;
  record?: string;
  data?: unknown;
  state?: RsvpFormState;
  action?: "state" | "page";
  actionPage?: string;
  onStateChange?: (state: RsvpFormState, message: string) => void;
  fields?: Array<[name: string, label: string]>;
  /** Fields whose Field has no Field Input. */
  withoutInput?: string[];
  submit?: boolean;
  parts?: ReactNode;
};

const Block = (options: BlockOptions) => {
  const {
    renderer,
    state,
    action,
    actionPage,
    onStateChange,
    fields = defaultFields,
    withoutInput = [],
    submit = true,
    parts,
  } = options;
  // the Phone Bank unless a test passes a record, undefined included
  const record = "record" in options ? options.record : phoneBank.id;
  // the Events fixture unless a test passes data, undefined included
  const data = "data" in options ? options.data : events;
  return (
    <Sdk renderer={renderer}>
      <RsvpForm
        record={record}
        data={data}
        state={state}
        action={action}
        actionPage={actionPage}
        onStateChange={onStateChange}
      >
        {fields.map(([name, label]) => (
          <TestField
            key={name}
            name={name}
            label={label}
            input={withoutInput.includes(name) === false}
          />
        ))}
        {parts}
        {submit && <SubmitButton>RSVP</SubmitButton>}
        <Probe />
      </RsvpForm>
    </Sdk>
  );
};

const getForm = (container: HTMLElement) => {
  const form = container.querySelector("form");
  if (form === null) {
    throw new Error("no form rendered");
  }
  return form;
};

const getCanvasCheck = (container: HTMLElement) =>
  container.querySelector("[data-organizeos-canvas-check]");

const getCanvasNotes = (container: HTMLElement) =>
  container.querySelector("[data-organizeos-canvas-note]");

const fill = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const fillPerson = () => {
  fill("First name", "Ada");
  fill("Last name", "Lovelace");
  fill("Email", "ada@example.org");
};

type ResponseFixture = { status: number; body: unknown };

const stubFetch = (respond: () => Promise<Response>) => {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    respond()
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const answerWith = (fixture: ResponseFixture) =>
  stubFetch(async () =>
    Response.json(fixture.body, { status: fixture.status })
  );

/** The parsed body of the one request sent, after checking how it was sent. */
const sentBody = (fetchMock: ReturnType<typeof stubFetch>) => {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  expect(input).toBe("/api/public/site/v1/rsvps");
  expect(init?.method).toBe("POST");
  expect(init?.headers).toEqual({ "Content-Type": "application/json" });
  expect(init?.credentials).toBe("same-origin");
  return JSON.parse(String(init?.body));
};

/** Parts that give the Saturday Canvass Launch everything request-full.json holds. */
const FullParts = () => (
  <>
    <StubPart kind="guests" value={requestFull.guests} />
    <StubPart
      kind="shifts"
      value={{
        shift_ids: requestFull.shift_ids,
        shift_role_id: requestFull.shift_role_id,
      }}
    />
    <StubPart kind="questions" value={requestFull.answers} />
    <StubPart kind="consent" value={requestFull.email_consent} />
  </>
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(today);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(navigateTo).mockClear();
});

describe("parts", () => {
  test("register with their root: the canvas check follows them as they come and go", () => {
    const { container, rerender } = render(
      <Block renderer="canvas" submit={false} />
    );
    expect(getCanvasCheck(container)?.textContent).toContain(
      "Add a Submit Button."
    );
    rerender(<Block renderer="canvas" />);
    expect(getCanvasCheck(container)).toBeNull();
    rerender(
      <Block
        renderer="canvas"
        fields={defaultFields.filter(([name]) => name !== "email")}
      />
    );
    expect(getCanvasCheck(container)?.textContent).toContain(
      "Add a Field for email"
    );
  });

  test("the composite parts register: Questions, Shift Options, Guests and Email Consent", () => {
    const view = render(<Block renderer="canvas" record={canvassLaunch.id} />);
    // required questions with no Questions part, and shifts and guests with no parts
    expect(getCanvasCheck(view.container)?.textContent).toContain("Questions");
    expect(getCanvasNotes(view.container)?.textContent).toContain(
      "Shift Options"
    );
    expect(getCanvasNotes(view.container)?.textContent).toContain("Guests");
    view.rerender(
      <Block
        renderer="canvas"
        record={canvassLaunch.id}
        parts={<FullParts />}
      />
    );
    expect(getCanvasCheck(view.container)).toBeNull();
    expect(getCanvasNotes(view.container)).toBeNull();
    // and they leave with their root's content
    view.rerender(<Block renderer="canvas" record={canvassLaunch.id} />);
    expect(getCanvasCheck(view.container)?.textContent).toContain("Questions");
  });

  test("a Field takes the four fields of an RSVP: the name, email and phone, as the platform wants them", () => {
    render(<Block />);
    const firstName = screen.getByLabelText("First name");
    expect(firstName.getAttribute("name")).toBe("first_name");
    expect(firstName.getAttribute("type")).toBe("text");
    expect(firstName.getAttribute("autocomplete")).toBe("given-name");
    expect(firstName.hasAttribute("required")).toBe(true);
    const lastName = screen.getByLabelText("Last name");
    expect(lastName.getAttribute("autocomplete")).toBe("family-name");
    expect(lastName.hasAttribute("required")).toBe(true);
    const email = screen.getByLabelText("Email");
    expect(email.getAttribute("type")).toBe("email");
    expect(email.getAttribute("autocomplete")).toBe("email");
    expect(email.hasAttribute("required")).toBe(true);
    const phone = screen.getByLabelText("Phone");
    expect(phone.getAttribute("type")).toBe("tel");
    expect(phone.getAttribute("autocomplete")).toBe("tel");
    expect(phone.hasAttribute("required")).toBe(false);
  });

  test("a Field Input stops at the platform's limit for its field: names 100, email 320, phone 40", () => {
    render(<Block />);
    for (const [label, length] of [
      ["First name", "100"],
      ["Last name", "100"],
      ["Email", "320"],
      ["Phone", "40"],
    ]) {
      expect(screen.getByLabelText(label).getAttribute("maxlength")).toBe(
        length
      );
    }
  });

  test("the designer's shorter maxLength wins over the field's limit, and a longer one does not", () => {
    render(
      <Sdk renderer={undefined}>
        <RsvpForm record={phoneBank.id} data={events}>
          <Field field="first_name">
            <FieldLabel>First name</FieldLabel>
            <FieldInput maxLength={20} />
          </Field>
          <Field field="phone">
            <FieldLabel>Phone</FieldLabel>
            <FieldInput maxLength={500} />
          </Field>
        </RsvpForm>
      </Sdk>
    );
    expect(screen.getByLabelText("First name").getAttribute("maxlength")).toBe(
      "20"
    );
    expect(screen.getByLabelText("Phone").getAttribute("maxlength")).toBe("40");
  });

  test("the fields are there before the event is known: no record, no data", () => {
    render(<Block record={undefined} data={undefined} />);
    expect(screen.getByLabelText("First name").hasAttribute("required")).toBe(
      true
    );
    expect(screen.getByLabelText("Email").getAttribute("type")).toBe("email");
  });

  test("the root renders a native-validating form with a hidden honeypot outside the designer's content", () => {
    const { container } = render(<Block />);
    const form = getForm(container);
    expect(form.hasAttribute("novalidate")).toBe(false);
    expect(form.getAttribute("method")).toBe("post");
    const honeypot = form.lastElementChild;
    expect(honeypot?.getAttribute("name")).toBe("website");
    expect(honeypot?.getAttribute("tabindex")).toBe("-1");
    expect(honeypot?.getAttribute("autocomplete")).toBe("off");
    expect(honeypot?.getAttribute("aria-hidden")).toBe("true");
  });

  test("the parts read the event from their root", () => {
    render(<Block record={canvassLaunch.id} />);
    expect(readProbe().event).toBe(canvassLaunch.id);
    cleanup();
    render(<Block record={missingEventId} />);
    expect(readProbe().event).toBeUndefined();
  });
});

describe("request body", () => {
  test("an event with no shifts, questions or guests matches request-minimal.json", async () => {
    window.history.replaceState(null, "", "/events/weekly-phone-bank");
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(<Block record={requestMinimal.event_id} />);
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = sentBody(fetchMock);
    expect(body).toEqual(requestMinimal);
    // what the event does not have is not sent at all
    for (const key of [
      "phone",
      "guests",
      "shift_ids",
      "shift_role_id",
      "answers",
    ]) {
      expect(key in body, key).toBe(false);
    }
  });

  test("an event with everything matches request-full.json", async () => {
    window.history.replaceState(null, "", "/events/saturday-canvass-launch");
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(
      <Block record={requestFull.event_id} parts={<FullParts />} />
    );
    fillPerson();
    fill("Phone", requestFull.phone);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock)).toEqual(requestFull);
  });

  test("leaves out a blank phone, no guests, no shifts, no answers, and sends the box as false when it is unchecked", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={
          <>
            <StubPart kind="guests" value={[]} />
            <StubPart
              kind="shifts"
              value={{ shift_ids: [], shift_role_id: undefined }}
            />
            <StubPart kind="questions" value={{}} />
            <StubPart kind="consent" value={false} />
          </>
        }
      />
    );
    fillPerson();
    fill("Phone", "   ");
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock)).toEqual({
      event_id: canvassLaunch.id,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.org",
      email_consent: false,
      page_path: "/",
      website: "",
    });
  });

  test("email_consent is false without an Email Consent part", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(<Block />);
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock).email_consent).toBe(false);
  });

  test("sends the page path and the honeypot's value", async () => {
    window.history.replaceState(null, "", "/get-involved/rsvp?utm=1#top");
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(<Block />);
    fillPerson();
    const honeypot = getForm(container).querySelector('[name="website"]');
    if (honeypot === null) {
      throw new Error("no honeypot");
    }
    fireEvent.change(honeypot, { target: { value: "https://spam.example" } });
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = sentBody(fetchMock);
    expect(body.website).toBe("https://spam.example");
    expect(body.page_path).toBe("/get-involved/rsvp");
  });

  test("sends nothing a Field names that an RSVP does not have", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(
      <Block
        fields={[...defaultFields, ["favorite_color", "Favorite color"]]}
      />
    );
    fillPerson();
    fill("Favorite color", "green");
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(Object.keys(sentBody(fetchMock)).sort()).toEqual(
      Object.keys(requestMinimal).sort()
    );
  });

  test("reads each part's value by its shape, and passes on only what the endpoint takes", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={
          <>
            <StubPart
              kind="guests"
              value={[
                {
                  first_name: "Charles",
                  last_name: "Babbage",
                  email: "c@b.io",
                },
                "not a row",
                null,
              ]}
            />
            <StubPart
              kind="shifts"
              value={{
                shift_ids: [afternoonShiftId, 7, null],
                shift_role_id: 5,
              }}
            />
            <StubPart
              kind="questions"
              value={{ [tShirtQuestionId]: "M", other: 5, nothing: null }}
            />
            <StubPart kind="consent" value="yes" />
          </>
        }
      />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = sentBody(fetchMock);
    expect(body.guests).toEqual([
      { first_name: "Charles", last_name: "Babbage" },
    ]);
    expect(body.shift_ids).toEqual([afternoonShiftId]);
    expect("shift_role_id" in body).toBe(false);
    expect(body.answers).toEqual({ [tShirtQuestionId]: "M" });
    expect(body.email_consent).toBe(false);
  });

  test("a part whose value is not of its shape is left out", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={
          <>
            <StubPart kind="guests" value="none" />
            <StubPart kind="shifts" value={undefined} />
            <StubPart kind="questions" value={[]} />
            <StubPart kind="consent" value={undefined} />
          </>
        }
      />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = sentBody(fetchMock);
    for (const key of ["guests", "shift_ids", "shift_role_id", "answers"]) {
      expect(key in body, key).toBe(false);
    }
    expect(body.email_consent).toBe(false);
  });

  test("two parts of a kind: the first with rows or a shift wins, answers merge, any checked box counts", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={
          <>
            <StubPart kind="guests" value={[]} />
            <StubPart
              kind="guests"
              value={[{ first_name: "A", last_name: "One" }]}
            />
            <StubPart
              kind="guests"
              value={[{ first_name: "B", last_name: "Two" }]}
            />
            <StubPart kind="shifts" value={{ shift_ids: [] }} />
            <StubPart kind="shifts" value={{ shift_ids: [afternoonShiftId] }} />
            <StubPart kind="questions" value={{ q1: "a" }} />
            <StubPart kind="questions" value={{ q2: "b" }} />
            <StubPart kind="consent" value={false} />
            <StubPart kind="consent" value={true} />
          </>
        }
      />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = sentBody(fetchMock);
    expect(body.guests).toEqual([{ first_name: "A", last_name: "One" }]);
    expect(body.shift_ids).toEqual([afternoonShiftId]);
    expect(body.answers).toEqual({ q1: "a", q2: "b" });
    expect(body.email_consent).toBe(true);
  });
});

describe("field lengths", () => {
  // the endpoint's limits: names 100, email 320, phone 40
  const limits: Array<
    [name: string, label: string, limit: number, message: string]
  > = [
    ["first_name", "First name", 100, "Enter your first name."],
    ["last_name", "Last name", 100, "Enter your last name."],
    ["email", "Email", 320, "Enter a valid email address."],
    ["phone", "Phone", 40, "Enter a valid phone number."],
  ];

  test.each(limits)(
    "a %s over its limit posts nothing and shows that field's message",
    async (name, label, limit, message) => {
      const fetchMock = answerWith(responseRegistered);
      const onStateChange = vi.fn();
      const { container } = render(<Block onStateChange={onStateChange} />);
      fillPerson();
      // typing stops at the limit, but autofill and the like can set a longer value
      fill(label, "a".repeat(limit + 1));
      fireEvent.submit(getForm(container));
      await waitFor(() =>
        expect(onStateChange).toHaveBeenLastCalledWith(
          "error",
          "Please check the form and try again."
        )
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(readProbe().errors).toEqual({ [name]: message });
      expect(readProbe().state).toBe("error");
    }
  );

  test.each(limits)("a %s at its limit posts", async (_name, label, limit) => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(<Block />);
    fillPerson();
    fill(label, "a".repeat(limit));
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  test("the first field over its limit is the one named", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(<Block />);
    fillPerson();
    fill("Phone", "1".repeat(41));
    fill("Last name", "a".repeat(101));
    fireEvent.submit(getForm(container));
    await waitFor(() =>
      expect(readProbe().errors).toEqual({
        last_name: "Enter your last name.",
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("the message clears once the value fits and the visitor submits again", async () => {
    const fetchMock = answerWith(responseRegistered);
    const onStateChange = vi.fn();
    const { container } = render(<Block onStateChange={onStateChange} />);
    fillPerson();
    fill("Phone", "1".repeat(41));
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(readProbe().errors).toHaveProperty("phone"));
    fill("Phone", "1".repeat(40));
    fireEvent.submit(getForm(container));
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        "registered",
        expect.any(String)
      )
    );
    expect(readProbe().errors).toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("the canvas and the preview still never post or report", async () => {
    const fetchMock = answerWith(responseRegistered);
    const onStateChange = vi.fn();
    const { container } = render(
      <Block renderer="preview" onStateChange={onStateChange} />
    );
    fillPerson();
    fill("Phone", "1".repeat(41));
    fireEvent.submit(getForm(container));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
  });
});

describe("states", () => {
  const submitWith = async (
    fixture: ResponseFixture,
    options?: BlockOptions
  ) => {
    const fetchMock = answerWith(fixture);
    const onStateChange = vi.fn();
    const view = render(<Block {...options} onStateChange={onStateChange} />);
    fillPerson();
    fireEvent.submit(getForm(view.container));
    await waitFor(() => expect(onStateChange).toHaveBeenCalledTimes(2));
    expect(onStateChange.mock.calls[0]).toEqual(["submitting", ""]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    return { ...view, onStateChange };
  };

  test.each([
    ["registered", "registered", responseRegistered],
    ["waitlisted", "waitlisted", responseWaitlisted],
    ["full", "full", responseFull],
    ["ended", "ended", responseEnded],
    ["invalid_field", "error", responseInvalidField],
    ["invalid_request", "error", responseInvalidRequest],
    ["not_found", "unavailable", responseNotFound],
    ["rate_limited", "error", responseRateLimited],
    ["unavailable", "error", responseUnavailable],
    ["role_full", "error", responseRoleFull],
    ["role_full with none open", "error", responseRoleFullNoneOpen],
  ])("%s lands in %s", async (_name, expected, fixture) => {
    const { onStateChange } = await submitWith(fixture);
    const [state, message] = onStateChange.mock.calls[1];
    expect(state).toBe(expected);
    // generic words of the block's own: the platform's codes never reach the visitor
    expect(message).toEqual(expect.any(String));
    expect(message).not.toBe("");
    expect(message).not.toMatch(/[a-z]+_[a-z]+/);
  });

  test("an outcome this build does not know lands in registered", async () => {
    const { onStateChange } = await submitWith({
      status: 200,
      body: { outcome: "confirmed_by_text" },
    });
    expect(onStateChange.mock.calls[1][0]).toBe("registered");
  });

  test("an error this build does not know lands in error", async () => {
    const { onStateChange } = await submitWith({
      status: 418,
      body: { error: "teapot" },
    });
    expect(onStateChange.mock.calls[1][0]).toBe("error");
  });

  test("an answer that is not JSON, or a network failure, lands in error", async () => {
    stubFetch(
      async () => new Response("<html>Not found</html>", { status: 404 })
    );
    const onStateChange = vi.fn();
    const { container } = render(<Block onStateChange={onStateChange} />);
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        "error",
        expect.any(String)
      )
    );
    cleanup();

    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const onStateChangeOffline = vi.fn();
    const offline = render(<Block onStateChange={onStateChangeOffline} />);
    fillPerson();
    fireEvent.submit(getForm(offline.container));
    await waitFor(() =>
      expect(onStateChangeOffline).toHaveBeenLastCalledWith(
        "error",
        expect.any(String)
      )
    );
  });

  test("invalid_field shows a generic message in that field's Field Message", async () => {
    await submitWith({
      status: 422,
      body: { error: "invalid_field", field: "email" },
    });
    const email = screen.getByLabelText("Email");
    const firstName = screen.getByLabelText("First name");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.hasAttribute("data-invalid")).toBe(true);
    expect(firstName.hasAttribute("aria-invalid")).toBe(false);
    const messageId = email.getAttribute("aria-describedby") ?? "";
    const message = document.getElementById(messageId);
    expect(message?.textContent).toBe("Enter a valid email address.");
    expect(message?.hasAttribute("data-invalid")).toBe(true);
  });

  test.each([
    ["first_name", "Enter your first name."],
    ["last_name", "Enter your last name."],
    ["email", "Enter a valid email address."],
    ["phone", "Enter a valid phone number."],
    ["guests", "Check your guests' names."],
    ["shift_ids", "Check the shifts you picked."],
    ["shift_role_id", "Check the role you picked."],
    [`answers.${tShirtQuestionId}`, "Check this answer."],
  ])(
    "invalid_field for %s puts its message where that part reads it",
    async (field, message) => {
      const { onStateChange } = await submitWith(
        { status: 422, body: { error: "invalid_field", field } },
        { record: canvassLaunch.id, parts: <FullParts /> }
      );
      expect(readProbe().errors).toEqual({ [field]: message });
      expect(onStateChange.mock.calls[1]).toEqual([
        "error",
        "Please check the form and try again.",
      ]);
    }
  );

  test("response-invalid-field.json shows on the Questions part's message", async () => {
    await submitWith(responseInvalidField, {
      record: canvassLaunch.id,
      parts: <FullParts />,
    });
    expect(Object.keys(readProbe().errors)).toEqual([
      `answers.${tShirtQuestionId}`,
    ]);
  });

  test("the messages clear when the visitor submits again", async () => {
    const respond = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json(
          { error: "invalid_field", field: "email" },
          { status: 422 }
        )
      )
      .mockResolvedValueOnce(Response.json(responseRegistered.body));
    stubFetch(respond);
    const onStateChange = vi.fn();
    const { container } = render(<Block onStateChange={onStateChange} />);
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(readProbe().errors).toHaveProperty("email"));
    fireEvent.submit(getForm(container));
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        "registered",
        expect.any(String)
      )
    );
    expect(readProbe().errors).toEqual({});
  });

  test("the Submit Button is disabled with data-state while submitting", async () => {
    let answer: (response: Response) => void = () => {};
    stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        })
    );
    const onStateChange = vi.fn();
    const { container } = render(<Block onStateChange={onStateChange} />);
    fillPerson();
    const button = screen.getByRole("button", { name: "RSVP" });
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.submit(getForm(container));
    await waitFor(() =>
      expect(button.getAttribute("data-state")).toBe("submitting")
    );
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(onStateChange).toHaveBeenLastCalledWith("submitting", "");
    // a second submit while one is pending sends nothing
    fireEvent.submit(getForm(container));
    answer(Response.json(responseRegistered.body));
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        "registered",
        expect.any(String)
      )
    );
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.hasAttribute("data-state")).toBe(false);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  test("with action page, registered goes to the page", async () => {
    await submitWith(responseRegistered, {
      action: "page",
      actionPage: "/thanks",
    });
    expect(navigateTo).toHaveBeenCalledWith("/thanks");
  });

  test("with action page, waitlisted stays on the Waitlisted state", async () => {
    await submitWith(responseWaitlisted, {
      action: "page",
      actionPage: "/thanks",
    });
    expect(navigateTo).not.toHaveBeenCalled();
  });

  test("with action state, registered stays on the state", async () => {
    await submitWith(responseRegistered, { actionPage: "/thanks" });
    expect(navigateTo).not.toHaveBeenCalled();
  });

  test.each([
    ["ended", voterDrive.id],
    ["full", rally.id],
  ])(
    "a form on an event the block reports as %s still posts, and the platform's answer decides",
    async (_case, record) => {
      const fetchMock = answerWith(responseRegistered);
      const onStateChange = vi.fn();
      const { container } = render(
        <Block record={record} onStateChange={onStateChange} />
      );
      fillPerson();
      fireEvent.submit(getForm(container));
      await waitFor(() =>
        expect(onStateChange).toHaveBeenLastCalledWith(
          "registered",
          expect.any(String)
        )
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );
});

describe("role_full", () => {
  const roleFullParts = (
    <>
      <StubPart kind="questions" value={requestFull.answers} />
      <StubPart
        kind="shifts"
        value={{ shift_ids: [afternoonShiftId], shift_role_id: canvasserId }}
      />
    </>
  );

  const submitRoleFull = async (fixture: ResponseFixture) => {
    answerWith(fixture);
    const onStateChange = vi.fn();
    const view = render(
      <Block
        record={canvassLaunch.id}
        parts={roleFullParts}
        onStateChange={onStateChange}
      />
    );
    fillPerson();
    fireEvent.submit(getForm(view.container));
    await waitFor(() => expect(onStateChange).toHaveBeenCalledTimes(2));
    return { ...view, onStateChange };
  };

  test("gives error with the role message, on the role's own field", async () => {
    const { onStateChange } = await submitRoleFull(responseRoleFull);
    expect(onStateChange.mock.calls[1]).toEqual([
      "error",
      "That role just filled. Pick another.",
    ]);
    expect(readProbe().errors).toEqual({
      shift_role_id: "That role just filled. Pick another.",
    });
  });

  test("marks the selected shift's roles that are not open as full, and leaves the open ones", async () => {
    await submitRoleFull(responseRoleFull);
    // events.json is a snapshot, where Driver is full; the answer reflects the
    // moment of the post, and lists Driver as open. The chosen Canvasser never is.
    const driver = canvassLaunch.shifts[1].roles.find(
      (role) => role.id === driverId
    );
    expect(driver?.full).toBe(true);
    expect(readProbe().fullRoleIds).toEqual([canvasserId]);
    // and the answer's list says the Driver has room, whatever the snapshot said
    expect(readProbe().openRoleIds).toEqual([driverId]);
  });

  test("an empty open_roles gives the same message and marks every role of the shift full", async () => {
    const { onStateChange } = await submitRoleFull(responseRoleFullNoneOpen);
    expect(onStateChange.mock.calls[1]).toEqual([
      "error",
      "That role just filled. Pick another.",
    ]);
    expect(readProbe().errors).toEqual({
      shift_role_id: "That role just filled. Pick another.",
    });
    expect(readProbe().fullRoleIds).toEqual([canvasserId, driverId].sort());
    expect(readProbe().openRoleIds).toEqual([]);
  });

  test("an answer with no readable open_roles marks the chosen role alone", async () => {
    await submitRoleFull({
      status: 409,
      body: { error: "role_full", open_roles: [{ nonsense: true }] },
    });
    expect(readProbe().fullRoleIds).toEqual([canvasserId]);
    expect(readProbe().openRoleIds).toEqual([]);
    cleanup();
    await submitRoleFull({ status: 409, body: { error: "role_full" } });
    expect(readProbe().fullRoleIds).toEqual([canvasserId]);
    expect(readProbe().openRoleIds).toEqual([]);
  });

  /** Submits the block once per answer, waiting for each to settle. */
  const submitAnswers = async (bodies: ResponseFixture[]) => {
    const respond = vi.fn<() => Promise<Response>>();
    for (const { status, body } of bodies) {
      respond.mockResolvedValueOnce(Response.json(body, { status }));
    }
    stubFetch(respond);
    const onStateChange = vi.fn();
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={roleFullParts}
        onStateChange={onStateChange}
      />
    );
    fillPerson();
    for (const [index] of bodies.entries()) {
      fireEvent.submit(getForm(container));
      // "submitting", then the answer's state
      await waitFor(() =>
        expect(onStateChange).toHaveBeenCalledTimes((index + 1) * 2)
      );
    }
  };

  test("an answer with no readable open_roles leaves what an earlier answer said of the siblings", async () => {
    // none open marks Canvasser and Driver full; a later answer with no list
    // says nothing about the Driver, so the Driver stays full
    await submitAnswers([
      responseRoleFullNoneOpen,
      { status: 409, body: { error: "role_full" } },
    ]);
    expect(readProbe().fullRoleIds).toEqual([canvasserId, driverId].sort());
    expect(readProbe().openRoleIds).toEqual([]);
    cleanup();
    // and the same for a list with no readable entry, and for what was open
    await submitAnswers([
      responseRoleFull,
      {
        status: 409,
        body: { error: "role_full", open_roles: [{ nonsense: true }] },
      },
    ]);
    expect(readProbe().fullRoleIds).toEqual([canvasserId]);
    expect(readProbe().openRoleIds).toEqual([driverId]);
  });

  test("a role the latest answer marks full is no longer open, and a role it lists open is no longer full", async () => {
    await submitAnswers([responseRoleFull, responseRoleFullNoneOpen]);
    expect(readProbe().fullRoleIds).toEqual([canvasserId, driverId].sort());
    expect(readProbe().openRoleIds).toEqual([]);
    cleanup();
    await submitAnswers([responseRoleFullNoneOpen, responseRoleFull]);
    expect(readProbe().fullRoleIds).toEqual([canvasserId]);
    expect(readProbe().openRoleIds).toEqual([driverId]);
  });

  test("a later answer recomputes that shift's roles", async () => {
    const respond = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json(responseRoleFullNoneOpen.body, { status: 409 })
      )
      .mockResolvedValueOnce(
        Response.json(responseRoleFull.body, { status: 409 })
      );
    stubFetch(respond);
    const onStateChange = vi.fn();
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={roleFullParts}
        onStateChange={onStateChange}
      />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() =>
      expect(readProbe().fullRoleIds).toEqual([canvasserId, driverId].sort())
    );
    fireEvent.submit(getForm(container));
    expect(readProbe().openRoleIds).toEqual([]);
    // the second answer lists the Driver as open again
    await waitFor(() => expect(readProbe().fullRoleIds).toEqual([canvasserId]));
    expect(readProbe().openRoleIds).toEqual([driverId]);
  });

  test("an answer when no single shift is selected marks the chosen role and nothing else", async () => {
    answerWith(responseRoleFullNoneOpen);
    const onStateChange = vi.fn();
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={
          <>
            <StubPart kind="questions" value={requestFull.answers} />
            <StubPart
              kind="shifts"
              value={{
                shift_ids: [afternoonShiftId, canvassLaunch.shifts[0].id],
                shift_role_id: canvasserId,
              }}
            />
          </>
        }
        onStateChange={onStateChange}
      />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(onStateChange).toHaveBeenCalledTimes(2));
    expect(readProbe().fullRoleIds).toEqual([canvasserId]);
    expect(readProbe().openRoleIds).toEqual([]);
    expect(readProbe().errors).toHaveProperty("shift_role_id");
  });

  test("the visitor can still choose no role or another shift: the next post is not blocked", async () => {
    const respond = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        Response.json(responseRoleFull.body, { status: 409 })
      )
      .mockResolvedValueOnce(Response.json(responseRegistered.body));
    const fetchMock = stubFetch(respond);
    const onStateChange = vi.fn();
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={roleFullParts}
        onStateChange={onStateChange}
      />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(readProbe().fullRoleIds).toHaveLength(1));
    fireEvent.submit(getForm(container));
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        "registered",
        expect.any(String)
      )
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("a full answer", () => {
  const shiftMessage = "That shift just filled. Pick another, or none.";
  const guestsMessage = "There is not room for every guest. Try with fewer.";
  const questions = <StubPart kind="questions" value={requestFull.answers} />;
  const shiftPart = (
    <StubPart kind="shifts" value={{ shift_ids: [afternoonShiftId] }} />
  );
  const guestsPart = <StubPart kind="guests" value={requestFull.guests} />;
  // the Saturday Canvass Launch without its waitlist
  const noWaitlist = { data: [{ ...canvassLaunch, waitlist: false }] };

  const submitFull = async (options: BlockOptions) => {
    answerWith(responseFull);
    const onStateChange = vi.fn();
    const view = render(<Block {...options} onStateChange={onStateChange} />);
    fillPerson();
    fireEvent.submit(getForm(view.container));
    await waitFor(() => expect(onStateChange).toHaveBeenCalledTimes(2));
    return { ...view, onStateChange };
  };

  test("to a request with shifts says the shift just filled, and keeps the form", async () => {
    const { onStateChange } = await submitFull({
      record: canvassLaunch.id,
      parts: (
        <>
          {questions}
          {shiftPart}
        </>
      ),
    });
    // the event has a waitlist and room: only the shift can be full
    expect(onStateChange.mock.calls[1]).toEqual([
      "error",
      "Please check the form and try again.",
    ]);
    expect(readProbe().state).toBe("error");
    expect(readProbe().errors).toEqual({ shift_ids: shiftMessage });
    // the form's content shows in the error state, and the visitor can submit again
    expect(
      screen.getByRole("button", { name: "RSVP" }).hasAttribute("disabled")
    ).toBe(false);
  });

  test("to a request with no shifts and no guests is the Full state", async () => {
    const { onStateChange } = await submitFull({});
    expect(onStateChange.mock.calls[1]).toEqual([
      "full",
      "This event is full.",
    ]);
    expect(readProbe().state).toBe("full");
    expect(readProbe().errors).toEqual({});
  });

  test("to a request with guests on an event with no waitlist says there is no room for them", async () => {
    const { onStateChange } = await submitFull({
      record: canvassLaunch.id,
      data: noWaitlist,
      parts: (
        <>
          {questions}
          {guestsPart}
        </>
      ),
    });
    expect(onStateChange.mock.calls[1]).toEqual([
      "error",
      "Please check the form and try again.",
    ]);
    expect(readProbe().state).toBe("error");
    expect(readProbe().errors).toEqual({ guests: guestsMessage });
  });

  test("to a request with shifts and guests on an event with no waitlist names both", async () => {
    await submitFull({
      record: canvassLaunch.id,
      data: noWaitlist,
      parts: (
        <>
          {questions}
          {shiftPart}
          {guestsPart}
        </>
      ),
    });
    expect(readProbe().state).toBe("error");
    expect(readProbe().errors).toEqual({
      shift_ids: shiftMessage,
      guests: guestsMessage,
    });
  });

  test("on an event with a waitlist a party that does not fit is waitlisted, so guests alone leave the Full state", async () => {
    const { onStateChange } = await submitFull({
      record: canvassLaunch.id,
      parts: (
        <>
          {questions}
          {guestsPart}
        </>
      ),
    });
    expect(onStateChange.mock.calls[1]).toEqual([
      "full",
      "This event is full.",
    ]);
    expect(readProbe().errors).toEqual({});
  });

  test("on an event with a waitlist, shifts and guests name the shift alone", async () => {
    await submitFull({
      record: canvassLaunch.id,
      parts: (
        <>
          {questions}
          {shiftPart}
          {guestsPart}
        </>
      ),
    });
    expect(readProbe().state).toBe("error");
    expect(readProbe().errors).toEqual({ shift_ids: shiftMessage });
  });

  test("the visitor can submit again without the shift, and a full answer to that is the Full state", async () => {
    // a Response body reads once: each post gets its own
    const respond = vi
      .fn<() => Promise<Response>>()
      .mockImplementation(async () =>
        Response.json(responseFull.body, { status: 409 })
      );
    stubFetch(respond);
    const onStateChange = vi.fn();
    const view = render(
      <Block
        record={canvassLaunch.id}
        parts={
          <>
            {questions}
            {shiftPart}
          </>
        }
        onStateChange={onStateChange}
      />
    );
    fillPerson();
    fireEvent.submit(getForm(view.container));
    await waitFor(() => expect(readProbe().state).toBe("error"));
    view.rerender(
      <Block
        record={canvassLaunch.id}
        parts={questions}
        onStateChange={onStateChange}
      />
    );
    fireEvent.submit(getForm(view.container));
    await waitFor(() => expect(readProbe().state).toBe("full"));
    expect(readProbe().errors).toEqual({});
    expect(respond).toHaveBeenCalledTimes(2);
  });
});

describe("the builder never posts", () => {
  test.each(["canvas", "preview"] as const)(
    "no fetch on the %s",
    async (renderer) => {
      const fetchMock = answerWith(responseRegistered);
      const onStateChange = vi.fn();
      const { container } = render(
        <Block renderer={renderer} onStateChange={onStateChange} />
      );
      fillPerson();
      fireEvent.submit(getForm(container));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(onStateChange).not.toHaveBeenCalled();
    }
  );
});

describe("unavailable", () => {
  test.each([
    ["there is no record", { record: undefined }],
    ["the record is blank", { record: "  " }],
    ["the record is missing from data", { record: missingEventId }],
    ["data is undefined", { data: undefined }],
    ["data is null", { data: null }],
    ["data is malformed", { data: { data: "events" } }],
  ])(
    "when %s: reported on a published site, and nothing posts",
    async (_case, options) => {
      const fetchMock = answerWith(responseRegistered);
      const onStateChange = vi.fn();
      const { container } = render(
        <Block {...options} onStateChange={onStateChange} />
      );
      await waitFor(() =>
        expect(onStateChange).toHaveBeenCalledWith(
          "unavailable",
          expect.any(String)
        )
      );
      fillPerson();
      fireEvent.submit(getForm(container));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  test.each([
    ["first_name", "First name"],
    ["last_name", "Last name"],
    ["email", "Email"],
  ])(
    "when the %s Field is missing: reported at submit on a published site, and nothing posts",
    async (name) => {
      const fetchMock = answerWith(responseRegistered);
      const onStateChange = vi.fn();
      const { container } = render(
        <Block
          fields={defaultFields.filter(([field]) => field !== name)}
          onStateChange={onStateChange}
        />
      );
      for (const [field, label] of defaultFields) {
        if (field !== name) {
          fill(label, field === "email" ? "ada@example.org" : "Ada");
        }
      }
      expect(onStateChange).not.toHaveBeenCalled();
      fireEvent.submit(getForm(container));
      await waitFor(() =>
        expect(onStateChange).toHaveBeenCalledWith(
          "unavailable",
          "This form is not available right now."
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledTimes(1);
    }
  );

  test.each([
    ["first_name", "First name"],
    ["last_name", "Last name"],
    ["email", "Email"],
  ])(
    "when the %s Field has no Field Input: reported at submit, and nothing posts",
    async (name, label) => {
      const fetchMock = answerWith(responseRegistered);
      const onStateChange = vi.fn();
      const { container } = render(
        <Block withoutInput={[name]} onStateChange={onStateChange} />
      );
      expect(screen.queryByLabelText(label)).toBeNull();
      fireEvent.submit(getForm(container));
      await waitFor(() =>
        expect(onStateChange).toHaveBeenCalledWith(
          "unavailable",
          "This form is not available right now."
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  test("a form with no Phone Field still posts: the phone is optional", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(
      <Block fields={defaultFields.filter(([name]) => name !== "phone")} />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect("phone" in sentBody(fetchMock)).toBe(false);
  });

  test("when the event has required questions and no Questions part: reported at submit, and nothing posts", async () => {
    const fetchMock = answerWith(responseRegistered);
    const onStateChange = vi.fn();
    const { container } = render(
      <Block record={canvassLaunch.id} onStateChange={onStateChange} />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith(
        "unavailable",
        "This form is not available right now."
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("with a Questions part, required questions post", async () => {
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(
      <Block
        record={canvassLaunch.id}
        parts={<StubPart kind="questions" value={requestFull.answers} />}
      />
    );
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody(fetchMock).answers).toEqual(requestFull.answers);
  });

  test("optional questions with no Questions part post: the event's questions are not required", async () => {
    const data = {
      data: [
        {
          ...phoneBank,
          questions: [
            {
              id: "q1",
              label: "Anything else?",
              help_text: null,
              type: "text",
              required: false,
              options: [],
            },
          ],
        },
      ],
    };
    const fetchMock = answerWith(responseRegistered);
    const { container } = render(<Block data={data} />);
    fillPerson();
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  test("the canvas warns instead, and never reports", () => {
    const onStateChange = vi.fn();
    const { container } = render(
      <Block
        renderer="canvas"
        record={missingEventId}
        onStateChange={onStateChange}
      />
    );
    expect(getCanvasCheck(container)?.textContent).toContain(
      "Its event is not available"
    );
    expect(onStateChange).not.toHaveBeenCalled();
  });
});

describe("ended and full", () => {
  test("an ended event is reported on a published site", async () => {
    const onStateChange = vi.fn();
    render(<Block record={voterDrive.id} onStateChange={onStateChange} />);
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith("ended", expect.any(String))
    );
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.calls[0][1]).not.toBe("");
  });

  test("an event with no end time is ended once its start is past", async () => {
    vi.setSystemTime(new Date("2026-11-14T02:00:01Z"));
    const onStateChange = vi.fn();
    render(<Block record={cookout.id} onStateChange={onStateChange} />);
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith("ended", expect.any(String))
    );
  });

  test("a full event with no waitlist is reported as full", async () => {
    const onStateChange = vi.fn();
    render(<Block record={rally.id} onStateChange={onStateChange} />);
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith("full", expect.any(String))
    );
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  test("a full event with a waitlist, and an event with room, report nothing", async () => {
    const onStateChange = vi.fn();
    render(
      <Block
        record={rally.id}
        data={{ data: [{ ...rally, waitlist: true }] }}
        onStateChange={onStateChange}
      />
    );
    cleanup();
    render(<Block record={phoneBank.id} onStateChange={onStateChange} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onStateChange).not.toHaveBeenCalled();
  });

  test("an event that is ended and full is ended", async () => {
    const onStateChange = vi.fn();
    render(
      <Block
        record={voterDrive.id}
        data={{ data: [{ ...voterDrive, full: true }] }}
        onStateChange={onStateChange}
      />
    );
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith("ended", expect.any(String))
    );
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  test("an unavailable record comes before ended and full", async () => {
    const onStateChange = vi.fn();
    render(
      <Block
        record={missingEventId}
        data={{ data: [{ ...voterDrive, full: true }] }}
        onStateChange={onStateChange}
      />
    );
    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith(
        "unavailable",
        expect.any(String)
      )
    );
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  test.each(["canvas", "preview"] as const)(
    "the %s reports nothing",
    async (renderer) => {
      const onStateChange = vi.fn();
      render(
        <Block
          renderer={renderer}
          record={voterDrive.id}
          onStateChange={onStateChange}
        />
      );
      render(
        <Block
          renderer={renderer}
          record={rally.id}
          onStateChange={onStateChange}
        />
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onStateChange).not.toHaveBeenCalled();
    }
  );
});

describe("canvas check", () => {
  test("a complete block draws nothing: no warning, and no note for an event that takes none", () => {
    const { container } = render(<Block renderer="canvas" />);
    expect(getCanvasCheck(container)).toBeNull();
    expect(getCanvasNotes(container)).toBeNull();
  });

  test("a complete block for an event with everything draws nothing", () => {
    const { container } = render(
      <Block
        renderer="canvas"
        record={canvassLaunch.id}
        parts={<FullParts />}
      />
    );
    expect(getCanvasCheck(container)).toBeNull();
    expect(getCanvasNotes(container)).toBeNull();
  });

  test("no record asks for an event", () => {
    const { container } = render(
      <Block renderer="canvas" record={undefined} />
    );
    expect(getCanvasCheck(container)?.textContent).toContain("Pick an event");
  });

  test("no data, and an event that is not in it", () => {
    const missingData = render(<Block renderer="canvas" data={undefined} />);
    expect(getCanvasCheck(missingData.container)?.textContent).toContain(
      "Events data is missing"
    );
    cleanup();
    const missingEvent = render(
      <Block renderer="canvas" record={missingEventId} />
    );
    const text = getCanvasCheck(missingEvent.container)?.textContent ?? "";
    expect(text).toContain("Its event is not available");
    expect(text).not.toContain("Events data is missing");
  });

  test.each([
    ["first_name", "first name"],
    ["last_name", "last name"],
    ["email", "email"],
  ])("a missing Field for %s", (name, label) => {
    const { container } = render(
      <Block
        renderer="canvas"
        fields={defaultFields.filter(([field]) => field !== name)}
      />
    );
    expect(getCanvasCheck(container)?.textContent).toContain(
      `Add a Field for ${label} (${name}): the form requires it.`
    );
  });

  test("no Phone Field is no problem: the phone is optional", () => {
    const { container } = render(
      <Block
        renderer="canvas"
        fields={defaultFields.filter(([name]) => name !== "phone")}
      />
    );
    expect(getCanvasCheck(container)).toBeNull();
  });

  test("no Submit Button", () => {
    const { container } = render(<Block renderer="canvas" submit={false} />);
    expect(getCanvasCheck(container)?.textContent).toContain(
      "Add a Submit Button."
    );
  });

  test("required questions with no Questions part", () => {
    const { container } = render(
      <Block renderer="canvas" record={canvassLaunch.id} />
    );
    const text = getCanvasCheck(container)?.textContent ?? "";
    expect(text).toContain("Add Questions: the event has required questions.");
  });

  test("optional questions with no Questions part draw no warning", () => {
    const data = {
      data: [
        {
          ...phoneBank,
          questions: [
            {
              id: "q1",
              label: "Anything else?",
              help_text: null,
              type: "text",
              required: false,
              options: [],
            },
          ],
        },
      ],
    };
    const { container } = render(<Block renderer="canvas" data={data} />);
    expect(getCanvasCheck(container)).toBeNull();
  });

  test("a Field naming anything other than the four fields", () => {
    const { container } = render(
      <Block
        renderer="canvas"
        fields={[
          ...defaultFields,
          ["favorite_color", "Favorite color"],
          ["", "Nothing"],
        ]}
      />
    );
    const text = getCanvasCheck(container)?.textContent ?? "";
    expect(text).toContain(
      'A Field is set to "favorite_color", which an RSVP Form does not have.'
    );
    expect(text).toContain("A Field has no form field.");
  });

  test("a root inside another OrganizeOS form", () => {
    // React reports the invalid nesting itself; the check is what the designer sees
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { container } = render(
      <Sdk renderer="canvas">
        <RsvpForm record={phoneBank.id} data={events}>
          <TestField name="first_name" label="Outer first name" />
          <TestField name="last_name" label="Outer last name" />
          <TestField name="email" label="Outer email" />
          <SubmitButton>Outer</SubmitButton>
          <RsvpForm record={phoneBank.id} data={events}>
            <TestField name="first_name" label="Inner first name" />
            <TestField name="last_name" label="Inner last name" />
            <TestField name="email" label="Inner email" />
            <SubmitButton>Inner</SubmitButton>
          </RsvpForm>
        </RsvpForm>
      </Sdk>
    );
    const checks = container.querySelectorAll("[data-organizeos-canvas-check]");
    expect(checks).toHaveLength(1);
    expect(checks[0].textContent).toContain(
      "It sits inside another OrganizeOS form."
    );
    consoleError.mockRestore();
  });

  test("a root inside a native form", () => {
    // React reports the invalid nesting itself; the check is what the designer sees
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { container } = render(
      <form>
        <Block renderer="canvas" />
      </form>
    );
    expect(getCanvasCheck(container)?.textContent).toContain(
      "It sits inside a Form."
    );
    consoleError.mockRestore();
  });

  test("states that hide the form's content do not report its parts", () => {
    const { container } = render(
      <Block
        renderer="canvas"
        state="registered"
        record={canvassLaunch.id}
        fields={[]}
        submit={false}
      />
    );
    expect(getCanvasCheck(container)).toBeNull();
    // nor note the parts the event could use
    expect(getCanvasNotes(container)).toBeNull();
  });

  test("the states that show the content report its parts", () => {
    for (const state of ["initial", "submitting", "error"] as const) {
      const { container } = render(
        <Block renderer="canvas" state={state} submit={false} />
      );
      expect(getCanvasCheck(container)?.textContent, state).toContain(
        "Add a Submit Button."
      );
      cleanup();
    }
  });

  test("nothing renders on a published site or in the preview", () => {
    for (const renderer of [undefined, "preview"] as const) {
      const { container } = render(
        <Block
          renderer={renderer}
          record={canvassLaunch.id}
          fields={[["favorite_color", "Favorite color"]]}
          submit={false}
        />
      );
      expect(getCanvasCheck(container)).toBeNull();
      expect(getCanvasNotes(container)).toBeNull();
      cleanup();
    }
  });

  test("the design-time submitting state styles the Submit Button but keeps it selectable", () => {
    render(<Block renderer="canvas" state="submitting" />);
    const button = screen.getByRole("button", { name: "RSVP" });
    expect(button.getAttribute("data-state")).toBe("submitting");
    expect(button.hasAttribute("disabled")).toBe(false);
  });
});

describe("canvas notes", () => {
  test("an event that has ended is a note, not a warning", () => {
    const { container } = render(
      <Block renderer="canvas" record={voterDrive.id} />
    );
    expect(getCanvasCheck(container)).toBeNull();
    const text = getCanvasNotes(container)?.textContent ?? "";
    expect(text).toContain("has ended");
    expect(text).toContain("Ended");
    expect(text).not.toContain("needs attention");
  });

  test("an event that has ended and is full shows the Ended note alone", () => {
    const { container } = render(
      <Block
        renderer="canvas"
        record={voterDrive.id}
        data={{ data: [{ ...voterDrive, full: true }] }}
      />
    );
    const text = getCanvasNotes(container)?.textContent ?? "";
    expect(text).toContain("has ended");
    expect(text).not.toContain("is full");
  });

  test("an event that is full with no waitlist is a note", () => {
    const { container } = render(<Block renderer="canvas" record={rally.id} />);
    expect(getCanvasCheck(container)).toBeNull();
    const text = getCanvasNotes(container)?.textContent ?? "";
    expect(text).toContain("is full");
    expect(text).toContain("Full");
  });

  test("an event that is full with a waitlist is no note", () => {
    const { container } = render(
      <Block
        renderer="canvas"
        record={rally.id}
        data={{ data: [{ ...rally, waitlist: true }] }}
      />
    );
    expect(getCanvasNotes(container)).toBeNull();
  });

  test("an event with shifts and no Shift Options, or guests and no Guests", () => {
    const { container, rerender } = render(
      <Block
        renderer="canvas"
        record={canvassLaunch.id}
        parts={<StubPart kind="questions" value={requestFull.answers} />}
      />
    );
    expect(getCanvasCheck(container)).toBeNull();
    let text = getCanvasNotes(container)?.textContent ?? "";
    expect(text).toContain("Shift Options");
    expect(text).toContain("Guests");

    rerender(
      <Block
        renderer="canvas"
        record={canvassLaunch.id}
        parts={
          <>
            <StubPart kind="questions" value={requestFull.answers} />
            <StubPart kind="shifts" value={{ shift_ids: [] }} />
          </>
        }
      />
    );
    text = getCanvasNotes(container)?.textContent ?? "";
    expect(text).not.toContain("Shift Options");
    expect(text).toContain("Guests");

    rerender(
      <Block
        renderer="canvas"
        record={canvassLaunch.id}
        parts={<FullParts />}
      />
    );
    expect(getCanvasNotes(container)).toBeNull();
  });

  test("an event with no shifts and no guests needs neither part", () => {
    const { container } = render(<Block renderer="canvas" />);
    expect(getCanvasNotes(container)).toBeNull();
  });

  test("a warning and a note can show together", () => {
    const { container } = render(
      <Block renderer="canvas" record={voterDrive.id} submit={false} />
    );
    expect(getCanvasCheck(container)?.textContent).toContain(
      "Add a Submit Button."
    );
    expect(getCanvasNotes(container)?.textContent).toContain("has ended");
  });
});
