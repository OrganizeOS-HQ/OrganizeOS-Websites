/**
 * @vitest-environment jsdom
 */
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
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
  cleanup();
  vi.restoreAllMocks();
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
