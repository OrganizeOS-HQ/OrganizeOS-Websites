/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import events from "../__fixtures__/events.json";
import requestFull from "../__fixtures__/rsvps/request-full.json";
import requestMinimal from "../__fixtures__/rsvps/request-minimal.json";
import responseFull from "../__fixtures__/rsvps/response-full.json";
import responseInvalidField from "../__fixtures__/rsvps/response-invalid-field.json";
import responseRegistered from "../__fixtures__/rsvps/response-registered.json";
import responseRoleFullNoneOpen from "../__fixtures__/rsvps/response-role-full-none-open.json";
import responseRoleFull from "../__fixtures__/rsvps/response-role-full.json";
import type { Renderer } from "../form/submit";
import { Field, FieldInput, FieldLabel, FieldMessage } from "../signup/field";
import { SubmitButton } from "../signup/submit-button";
import { EmailConsent } from "./email-consent";
import { Guests } from "./guests";
import { Questions } from "./questions";
import { RsvpForm } from "./rsvp-form";
import { ShiftOptions } from "./shift-options";

// The RSVP Form with its real parts, against the fixtures both repositories
// build to: what the parts collect is what request-full.json holds, and what
// the endpoint answers reaches the part it is about.

const [, phoneBank, , canvassLaunch] = events.data;
const [morningShift, afternoonShift] = canvassLaunch.shifts;
const driverId = responseRoleFull.body.open_roles[0].id;
const tShirtQuestionId = Object.keys(requestFull.answers)[4];
const languagesQuestionId = Object.keys(requestFull.answers)[5];
const conductQuestionId = Object.keys(requestFull.answers)[6];

// the fixtures' events have real dates: the tests pin the clock the block reads
const today = new Date("2026-10-21T12:00:00Z");

const Sdk = ({
  renderer,
  children,
}: {
  renderer?: Renderer;
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

const TestField = ({ name, label }: { name: string; label: string }) => (
  <Field field={name}>
    <FieldLabel>{label}</FieldLabel>
    <FieldInput />
    <FieldMessage />
  </Field>
);

const consentText = "Also email me news from this organization";

const Block = ({
  record = canvassLaunch.id,
  renderer,
  withParts = true,
  withReset = false,
}: {
  record?: string;
  renderer?: Renderer;
  withParts?: boolean;
  withReset?: boolean;
}) => (
  <Sdk renderer={renderer}>
    <RsvpForm record={record} data={events}>
      <TestField name="first_name" label="First name" />
      <TestField name="last_name" label="Last name" />
      <TestField name="email" label="Email" />
      <TestField name="phone" label="Phone" />
      {withParts && (
        <>
          <Guests />
          <ShiftOptions />
          <Questions />
          <EmailConsent>{consentText}</EmailConsent>
        </>
      )}
      <SubmitButton>RSVP</SubmitButton>
      {withReset && <button type="reset">Start over</button>}
    </RsvpForm>
  </Sdk>
);

const getForm = (container: HTMLElement) => {
  const form = container.querySelector("form");
  if (form === null) {
    throw new Error("no form rendered");
  }
  return form;
};

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const stubFetch = (...answers: Array<{ status: number; body: unknown }>) => {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const answer = answers.shift() ?? answers.at(-1);
      return Response.json(answer?.body, { status: answer?.status });
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const bodyOf = (fetchMock: ReturnType<typeof stubFetch>, call = 0) =>
  JSON.parse(String(fetchMock.mock.calls[call][1]?.body));

const fillEverything = (container: HTMLElement) => {
  fill("First name", requestFull.first_name);
  fill("Last name", requestFull.last_name);
  fill("Email", requestFull.email);
  fill("Phone", requestFull.phone);
  // a guest
  fireEvent.click(screen.getByRole("button", { name: "Add a guest" }));
  fireEvent.change(container.querySelector('[name="guests.0.first_name"]')!, {
    target: { value: requestFull.guests[0].first_name },
  });
  fireEvent.change(container.querySelector('[name="guests.0.last_name"]')!, {
    target: { value: requestFull.guests[0].last_name },
  });
  // a shift, and a role in it
  fireEvent.click(screen.getByRole("checkbox", { name: /Afternoon canvass/ }));
  fireEvent.click(screen.getByRole("radio", { name: "Canvasser" }));
  // every question, each in its own kind of control
  for (const [id, answer] of Object.entries(requestFull.answers)) {
    if (id === languagesQuestionId) {
      for (const option of JSON.parse(answer) as string[]) {
        fireEvent.click(screen.getByRole("checkbox", { name: option }));
      }
    } else if (id === conductQuestionId) {
      fireEvent.click(screen.getByRole("checkbox", { name: "Yes" }));
    } else {
      fireEvent.change(container.querySelector(`[name="answers.${id}"]`)!, {
        target: { value: answer },
      });
    }
  }
  fireEvent.click(screen.getByLabelText(consentText));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(today);
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("what the real parts collect", () => {
  test("an event with everything posts request-full.json", async () => {
    window.history.replaceState(null, "", requestFull.page_path);
    const fetchMock = stubFetch(responseRegistered);
    const { container } = render(<Block />);
    fillEverything(container);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock)).toEqual(requestFull);
  });

  test("an event with nothing to ask posts request-minimal.json, the parts rendering nothing", async () => {
    window.history.replaceState(null, "", requestMinimal.page_path);
    const fetchMock = stubFetch(responseRegistered);
    const { container } = render(<Block record={phoneBank.id} />);
    // Guests, Shift Options and Questions are not on the page for this event
    expect(screen.queryByRole("button", { name: "Add a guest" })).toBeNull();
    expect(container.querySelector("[data-question]")).toBeNull();
    expect(container.querySelector('[name="shift_ids"]')).toBeNull();
    fill("First name", requestMinimal.first_name);
    fill("Last name", requestMinimal.last_name);
    fill("Email", requestMinimal.email);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock)).toEqual(requestMinimal);
  });

  test("answers left blank are sent only where the event requires them", async () => {
    const fetchMock = stubFetch(responseRegistered);
    const { container } = render(<Block />);
    fill("First name", "Ada");
    fill("Last name", "Lovelace");
    fill("Email", "ada@example.org");
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // the T-shirt size and the code of conduct are required; the platform
    // answers them with invalid_field and the part shows it
    expect(bodyOf(fetchMock)).toEqual({
      event_id: canvassLaunch.id,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.org",
      answers: { [tShirtQuestionId]: "", [conductQuestionId]: "false" },
      email_consent: false,
      page_path: "/",
      website: "",
    });
  });

  test("an unticked Email Consent sends false, a ticked one true", async () => {
    const fetchMock = stubFetch(responseRegistered);
    const { container } = render(<Block />);
    fill("First name", "Ada");
    fill("Last name", "Lovelace");
    fill("Email", "ada@example.org");
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(bodyOf(fetchMock, 0).email_consent).toBe(false);
    fireEvent.click(screen.getByLabelText(consentText));
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchMock, 1).email_consent).toBe(true);
  });
});

describe("a reset control in the form", () => {
  test("what is posted after it is what the controls show: nothing of what was entered before", async () => {
    const fetchMock = stubFetch(responseRegistered);
    const { container } = render(<Block withReset />);
    fillEverything(container);
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    // every control is back to blank, the consent box among them
    expect(
      (screen.getByLabelText(consentText) as HTMLInputElement).checked
    ).toBe(false);
    expect(
      (
        screen.getByRole("checkbox", {
          name: /Afternoon canvass/,
        }) as HTMLInputElement
      ).checked
    ).toBe(false);
    expect(container.querySelectorAll('[name^="guests."]')).toHaveLength(0);
    fill("First name", "Ada");
    fill("Last name", "Lovelace");
    fill("Email", "ada@example.org");
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock)).toEqual({
      event_id: canvassLaunch.id,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.org",
      answers: { [tShirtQuestionId]: "", [conductQuestionId]: "false" },
      email_consent: false,
      page_path: "/",
      website: "",
    });
  });
});

describe("what the platform answers", () => {
  test("role_full: the chosen role is gone, a role the answer lists open can be picked again, and the message is in Shift Options", async () => {
    const fetchMock = stubFetch(responseRoleFull, responseRegistered);
    const { container } = render(<Block />);
    fillEverything(container);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const canvasser = await screen.findByRole("radio", { name: "Canvasser" });
    await waitFor(() =>
      expect((canvasser as HTMLInputElement).disabled).toBe(true)
    );
    expect((canvasser as HTMLInputElement).checked).toBe(false);
    // the data marks Driver full, but the answer found it with room
    expect(
      (screen.getByRole("radio", { name: "Driver" }) as HTMLInputElement)
        .disabled
    ).toBe(false);
    const message = screen.getByText("That role just filled. Pick another.");
    expect(message.hasAttribute("data-message")).toBe(true);
    expect(
      container
        .querySelector('[name="shift_ids"]')
        ?.closest("[data-invalid]")
        ?.contains(message)
    ).toBe(true);
    // choosing the Driver and sending again posts the Driver
    fireEvent.click(screen.getByRole("radio", { name: "Driver" }));
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bodyOf(fetchMock, 1).shift_role_id).toBe(driverId);
    expect(bodyOf(fetchMock, 1).shift_ids).toEqual([afternoonShift.id]);
  });

  test("role_full with no open role: every role of the shift is gone, and the shift can still be sent without one", async () => {
    const fetchMock = stubFetch(responseRoleFullNoneOpen, responseRegistered);
    const { container } = render(<Block />);
    fillEverything(container);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole("radio", { name: "Canvasser" }) as HTMLInputElement)
          .disabled
      ).toBe(true)
    );
    expect(
      (screen.getByRole("radio", { name: "Driver" }) as HTMLInputElement)
        .disabled
    ).toBe(true);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const second = bodyOf(fetchMock, 1);
    expect(second.shift_ids).toEqual([afternoonShift.id]);
    expect("shift_role_id" in second).toBe(false);
  });

  test("full, to a request with shifts: the form stays and Shift Options says which part to change", async () => {
    const fetchMock = stubFetch(responseFull);
    const { container } = render(<Block />);
    fillEverything(container);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const message = await screen.findByText(
      "That shift just filled. Pick another, or none."
    );
    expect(message.hasAttribute("data-message")).toBe(true);
    expect(
      screen
        .getByRole("checkbox", { name: /Afternoon canvass/ })
        .getAttribute("aria-invalid")
    ).toBe("true");
    // the morning shift stays disabled, as the data says
    expect(
      (
        screen.getByRole("checkbox", {
          name: new RegExp(morningShift.title),
        }) as HTMLInputElement
      ).disabled
    ).toBe(true);
  });

  test("invalid_field for an answer shows under that question", async () => {
    const fetchMock = stubFetch(responseInvalidField);
    expect(responseInvalidField.body.field).toBe(`answers.${tShirtQuestionId}`);
    const { container } = render(<Block />);
    fillEverything(container);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const control = container.querySelector(
      `[name="answers.${tShirtQuestionId}"]`
    );
    const question = control?.closest("[data-question]") as HTMLElement;
    const message = await within(question).findByText("Check this answer.");
    expect(message.hasAttribute("data-message")).toBe(true);
    expect(question.hasAttribute("data-invalid")).toBe(true);
    expect(control?.getAttribute("aria-invalid")).toBe("true");
    // and under no other
    expect(
      container.querySelectorAll("[data-question] [data-message]")
    ).toHaveLength(1);
  });

  test("invalid_field for the guests shows in Guests", async () => {
    const fetchMock = stubFetch({
      status: 422,
      body: { error: "invalid_field", field: "guests" },
    });
    const { container } = render(<Block />);
    fillEverything(container);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const message = await screen.findByText("Check your guests' names.");
    expect(message.hasAttribute("data-message")).toBe(true);
    expect(message.parentElement?.hasAttribute("data-invalid")).toBe(true);
  });

  test("invalid_field for the shifts shows in Shift Options", async () => {
    const fetchMock = stubFetch({
      status: 422,
      body: { error: "invalid_field", field: "shift_ids" },
    });
    const { container } = render(<Block />);
    fillEverything(container);
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Check the shifts you picked.")
    ).toBeTruthy();
  });

  test("the next submit clears the messages", async () => {
    const fetchMock = stubFetch(responseInvalidField, responseRegistered);
    const { container } = render(<Block />);
    fillEverything(container);
    fireEvent.submit(getForm(container));
    await screen.findByText("Check this answer.");
    fireEvent.submit(getForm(container));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("Check this answer.")).toBeNull()
    );
  });
});

describe("the canvas", () => {
  test("the check has nothing to say once the parts are there, and the parts show", () => {
    const { container } = render(<Block renderer="canvas" />);
    expect(
      container.querySelector("[data-organizeos-canvas-check]")
    ).toBeNull();
    // no note about shifts or guests the form does not use
    expect(container.querySelector("[data-organizeos-canvas-note]")).toBeNull();
    expect(container.querySelectorAll("[data-question]")).toHaveLength(7);
    expect(container.querySelectorAll('[name="shift_ids"]')).toHaveLength(2);
    expect(container.querySelectorAll("[data-sample]")).toHaveLength(1);
  });

  test("without the parts the check asks for Questions and the notes name Shift Options and Guests", () => {
    const { container } = render(<Block renderer="canvas" withParts={false} />);
    expect(
      container.querySelector("[data-organizeos-canvas-check]")?.textContent
    ).toContain("Add Questions");
    const notes = container.querySelector(
      "[data-organizeos-canvas-note]"
    )?.textContent;
    expect(notes).toContain("Add Shift Options");
    expect(notes).toContain("Add Guests");
  });

  test("nothing is posted", async () => {
    const fetchMock = stubFetch(responseRegistered);
    const { container } = render(<Block renderer="canvas" />);
    fireEvent.submit(getForm(container));
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
