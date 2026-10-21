import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import events from "../__fixtures__/events.json";
import { Field, FieldInput, FieldLabel, FieldMessage } from "../signup/field";
import { SubmitButton } from "../signup/submit-button";
import { RsvpForm } from "./rsvp-form";

afterEach(() => {
  vi.restoreAllMocks();
});

const [voterDrive, phoneBank, , canvassLaunch, rally] = events.data;

const renderOnServer = (record: string | undefined, data: unknown = events) =>
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
      <RsvpForm record={record} data={data}>
        <Field field="first_name">
          <FieldLabel>First name</FieldLabel>
          <FieldInput />
          <FieldMessage />
        </Field>
        <Field field="last_name">
          <FieldLabel>Last name</FieldLabel>
          <FieldInput />
        </Field>
        <Field field="email">
          <FieldLabel>Email</FieldLabel>
          <FieldInput />
          <FieldMessage />
        </Field>
        <Field field="favorite_color">
          <FieldLabel>Favorite color</FieldLabel>
          <FieldInput />
        </Field>
        <SubmitButton>RSVP</SubmitButton>
      </RsvpForm>
    </ReactSdkContext.Provider>
  );

// A published site renders on the server first (node: no window, no
// document), so a block must render there without touching the browser.
test("renders on the server as a published site does", () => {
  const consoleError = vi.spyOn(console, "error");
  const html = renderOnServer(phoneBank.id);
  expect(typeof window).toBe("undefined");
  expect(html).toMatch(/^<form method="post">/);
  expect(html).toContain('name="first_name"');
  expect(html).toContain('autoComplete="given-name"');
  expect(html).toContain('name="email"');
  expect(html).toContain('type="email"');
  expect(html).toContain("required");
  expect(html).toContain('name="website"');
  // the canvas check never reaches a published page
  expect(html).not.toContain("data-organizeos-canvas-check");
  expect(html).not.toContain("data-organizeos-canvas-note");
  expect(consoleError).not.toHaveBeenCalled();
});

test("renders the same markup whatever the event: ended, full, with everything, missing, or with no record", () => {
  const consoleError = vi.spyOn(console, "error");
  const markup = renderOnServer(phoneBank.id);
  for (const record of [
    voterDrive.id,
    rally.id,
    canvassLaunch.id,
    "00000000-0000-4000-8000-000000000000",
    undefined,
  ]) {
    expect(renderOnServer(record), String(record)).toBe(markup);
  }
  // data that is not the events body
  for (const data of [undefined, null, "events", { data: {} }]) {
    expect(renderOnServer(phoneBank.id, data)).toBe(markup);
  }
  expect(consoleError).not.toHaveBeenCalled();
});
