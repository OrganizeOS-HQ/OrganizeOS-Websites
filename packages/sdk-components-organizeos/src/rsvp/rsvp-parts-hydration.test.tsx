/**
 * @vitest-environment jsdom
 */
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import events from "../__fixtures__/events.json";
import requestFull from "../__fixtures__/rsvps/request-full.json";
import responseRegistered from "../__fixtures__/rsvps/response-registered.json";
import { Field, FieldInput, FieldLabel, FieldMessage } from "../signup/field";
import { SubmitButton } from "../signup/submit-button";
import { EmailConsent } from "./email-consent";
import { Guests } from "./guests";
import { Questions } from "./questions";
import { RsvpForm } from "./rsvp-form";
import { ShiftOptions } from "./shift-options";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const canvassLaunch = events.data[3];

const Page = () => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
    }}
  >
    <RsvpForm record={canvassLaunch.id} data={events}>
      <Field field="first_name">
        <FieldLabel>First name</FieldLabel>
        <FieldInput />
        <FieldMessage />
      </Field>
      <Guests />
      <ShiftOptions />
      <Questions />
      <EmailConsent>Also email me news</EmailConsent>
      <SubmitButton>RSVP</SubmitButton>
    </RsvpForm>
  </ReactSdkContext.Provider>
);

// The page is rendered to HTML when it is published (in Node) and hydrated in
// the visitor's browser, which formats the shift times with its own ICU: the
// two must agree, or React discards the server's markup.
test("the markup the server made hydrates without a mismatch, and then works", async () => {
  const consoleError = vi.spyOn(console, "error");
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(<Page />);
  const serverHtml = container.innerHTML;
  expect(serverHtml).toContain("12:00 PM – 3:00 PM MST");

  await act(async () => {
    hydrateRoot(container, <Page />);
  });

  expect(consoleError).not.toHaveBeenCalled();
  // the markup the server made is what the page still shows
  expect(container.innerHTML).toBe(serverHtml);

  // and the parts respond: React took the markup over
  fireEvent.click(screen.getByRole("button", { name: "Add a guest" }));
  expect(
    container.querySelector('[name="guests.0.first_name"]')
  ).not.toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: /Afternoon canvass/ }));
  expect(screen.getByRole("radiogroup")).toBeTruthy();
});

const [howHeardId, , yearsId, , shirtId, languagesId, conductId] = Object.keys(
  requestFull.answers
);
const afternoonShiftId = requestFull.shift_ids[0];

const FullPage = ({ data = events }: { data?: unknown }) => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
    }}
  >
    <RsvpForm record={canvassLaunch.id} data={data}>
      <Field field="first_name">
        <FieldLabel>First name</FieldLabel>
        <FieldInput />
        <FieldMessage />
      </Field>
      <Field field="last_name">
        <FieldLabel>Last name</FieldLabel>
        <FieldInput />
        <FieldMessage />
      </Field>
      <Field field="email">
        <FieldLabel>Email</FieldLabel>
        <FieldInput />
        <FieldMessage />
      </Field>
      <ShiftOptions />
      <Questions />
      <EmailConsent>Also email me news</EmailConsent>
      <SubmitButton>RSVP</SubmitButton>
    </RsvpForm>
  </ReactSdkContext.Provider>
);

// The browser can restore the form (Firefox on a reload, any browser on a back
// navigation without bfcache), or the visitor can click before the script has
// run. React keeps what the hydrated controls hold and fires no onChange, so a
// part that starts from empty state would show a tick or an answer and not send
// it, and the next render would wipe it from the page.
test("a tick or an answer already in the markup at hydration is kept and sent", async () => {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(
      Response.json(responseRegistered.body, {
        status: responseRegistered.status,
      })
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(<FullPage />);

  const named = (name: string) =>
    Array.from(
      container.querySelectorAll<HTMLInputElement & HTMLSelectElement>(
        "input, select, textarea"
      )
    ).filter((control) => control.name === name);
  const shiftBox = named("shift_ids").find(
    (box) => box.value === afternoonShiftId
  )!;
  const howHeard = named(`answers.${howHeardId}`)[0];
  const years = named(`answers.${yearsId}`)[0];
  const shirt = named(`answers.${shirtId}`)[0];
  const spanish = named(`answers.${languagesId}`).find(
    (box) => box.value === "Spanish"
  )!;
  const conduct = named(`answers.${conductId}`)[0];
  const consent = named("email_consent")[0];

  // what a restore, or a visitor who got there first, leaves in the markup
  shiftBox.checked = true;
  howHeard.value = "A friend";
  years.value = "3";
  shirt.value = "M";
  spanish.checked = true;
  conduct.checked = true;
  consent.checked = true;

  const consoleError = vi.spyOn(console, "error");
  await act(async () => {
    hydrateRoot(container, <FullPage />);
  });
  expect(consoleError).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "Ada" },
  });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "Lovelace" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "ada@example.org" },
  });
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());

  const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
  expect(body.shift_ids).toEqual([afternoonShiftId]);
  expect(body.answers).toEqual({
    [howHeardId]: "A friend",
    [yearsId]: "3",
    [shirtId]: "M",
    [languagesId]: JSON.stringify(["Spanish"]),
    [conductId]: "true",
  });
  expect(body.email_consent).toBe(true);

  // and what was shown is still shown after the submit re-rendered the parts
  expect(shiftBox.checked).toBe(true);
  expect(howHeard.value).toBe("A friend");
  expect(years.value).toBe("3");
  expect(shirt.value).toBe("M");
  expect(spanish.checked).toBe(true);
  expect(conduct.checked).toBe(true);
  expect(consent.checked).toBe(true);
  // the role group follows the ticked shift
  expect(screen.getByRole("radiogroup")).toBeTruthy();
});

/** The Saturday Canvass Launch with other shifts and questions. */
const withEvent = (changes: { shifts?: unknown[]; questions?: unknown[] }) => ({
  data: [{ ...canvassLaunch, ...changes }],
});

const hydrateAndSubmit = async (
  container: HTMLElement,
  data: unknown,
  fetchMock: ReturnType<typeof vi.fn>
) => {
  await act(async () => {
    hydrateRoot(container, <FullPage data={data} />);
  });
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  return JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
};

const stubRegistered = () => {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(
      Response.json(responseRegistered.body, {
        status: responseRegistered.status,
      })
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

// More than the endpoint takes can be ticked before the script runs, as no box
// is disabled yet. What the page keeps ticked is what it sends.
test("shifts ticked before hydration past the 50 the endpoint takes: the first 50 stay ticked", async () => {
  const fetchMock = stubRegistered();
  const shifts = Array.from({ length: 60 }, (_, index) => ({
    ...canvassLaunch.shifts[1],
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `Shift ${index}`,
    roles: [],
  }));
  const data = withEvent({ shifts });
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(<FullPage data={data} />);
  const boxes = Array.from(
    container.querySelectorAll<HTMLInputElement>('input[name="shift_ids"]')
  );
  expect(boxes).toHaveLength(60);
  for (const box of boxes) {
    box.checked = true;
  }

  const body = await hydrateAndSubmit(container, data, fetchMock);

  expect(body.shift_ids).toEqual(shifts.slice(0, 50).map((shift) => shift.id));
  expect(boxes.filter((box) => box.checked)).toHaveLength(50);
  expect(boxes[49].checked).toBe(true);
  expect(boxes[50].checked).toBe(false);
});

test("options ticked before hydration that are too long to send whole: only those that are sent stay ticked", async () => {
  const fetchMock = stubRegistered();
  const options = Array.from({ length: 10 }, (_, index) =>
    `${index}`.repeat(600)
  );
  const question = {
    id: "3b6f9d02-a8e7-4c15-8d43-f1c5e0b7a269",
    label: "Pick",
    help_text: null,
    type: "multiselect",
    required: false,
    options,
  };
  const data = withEvent({ questions: [question] });
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(<FullPage data={data} />);
  const boxes = Array.from(
    container.querySelectorAll<HTMLInputElement>(
      `input[name="answers.${question.id}"]`
    )
  );
  expect(boxes).toHaveLength(10);
  for (const box of boxes) {
    box.checked = true;
  }

  const body = await hydrateAndSubmit(container, data, fetchMock);

  const sent: string[] = JSON.parse(body.answers[question.id]);
  // eight of these fit in the 5000 characters the endpoint takes, a ninth does not
  expect(sent).toEqual(options.slice(0, 8));
  expect(boxes.filter((box) => box.checked).map((box) => box.value)).toEqual(
    sent
  );
});
