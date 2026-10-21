import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import events from "../__fixtures__/events.json";
import { Field, FieldInput, FieldLabel, FieldMessage } from "../signup/field";
import { SubmitButton } from "../signup/submit-button";
import { EmailConsent } from "./email-consent";
import { Guests } from "./guests";
import { Questions } from "./questions";
import { RsvpForm } from "./rsvp-form";
import { ShiftOptions } from "./shift-options";

afterEach(() => {
  vi.restoreAllMocks();
});

const [, phoneBank, , canvassLaunch] = events.data;

const renderOnServer = (record: string | undefined) =>
  renderToString(
    <ReactSdkContext.Provider
      value={{
        assetBaseUrl: "/",
        imageLoader: ({ src }) => src,
        resources: {},
        breakpoints: [],
        onError: () => {},
      }}
    >
      <RsvpForm record={record} data={events}>
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

// A published site renders on the server first (node: no window, no
// document), so the parts must render there without touching the browser.
test("the parts render on the server as a published site does", () => {
  const consoleError = vi.spyOn(console, "error");
  const html = renderOnServer(canvassLaunch.id);
  expect(typeof window).toBe("undefined");
  // Guests: no rows yet, and the Add button
  expect(html).toContain("Add a guest");
  expect(html).not.toContain("guests.0.first_name");
  // Shift Options: both shifts, the full one disabled, times in the event's zone
  expect(html).toContain("Morning canvass");
  expect(html).toContain("Afternoon canvass");
  expect(html).toContain("8:00 AM – 11:00 AM MST");
  expect(html).toContain("12:00 PM – 3:00 PM MST");
  expect(html).toContain('name="shift_ids"');
  expect(html).not.toContain('type="radio"');
  // Questions: every question's label and control
  expect(html).toContain("How did you hear about us?");
  expect(html).toContain("T-shirt size");
  expect(html).toContain('type="number"');
  expect(html).toContain('type="date"');
  expect(html).toContain("<textarea");
  expect(html).toContain("<select");
  expect(html).toContain("Languages you speak");
  // Email Consent
  expect(html).toContain('name="email_consent"');
  // and nothing of the canvas
  expect(html).not.toContain("data-sample");
  expect(html).not.toContain("data-organizeos-canvas-check");
  expect(consoleError).not.toHaveBeenCalled();
});

test("an event with no guests, shifts or questions renders none of the three parts", () => {
  const consoleError = vi.spyOn(console, "error");
  const html = renderOnServer(phoneBank.id);
  expect(html).not.toContain("Add a guest");
  expect(html).not.toContain("shift_ids");
  expect(html).not.toContain("data-question");
  // the box does not depend on the event
  expect(html).toContain('name="email_consent"');
  expect(consoleError).not.toHaveBeenCalled();
});

test("with no event the three parts render nothing and the form still renders", () => {
  const consoleError = vi.spyOn(console, "error");
  for (const record of [undefined, "00000000-0000-4000-8000-000000000000"]) {
    const html = renderOnServer(record);
    expect(html).not.toContain("Add a guest");
    expect(html).not.toContain("shift_ids");
    expect(html).not.toContain("data-question");
    expect(html).toContain('name="first_name"');
  }
  expect(consoleError).not.toHaveBeenCalled();
});
