import { expect, test } from "vitest";
import { wsComponentMeta } from "@webstudio-is/sdk";
import * as components from "./components";
import { hooks } from "./hooks";
import * as metas from "./metas";
import * as templates from "./templates";

const namespaced = (name: string) => `@organizeos/site-components:${name}`;

// Each word is capitalized or, for an acronym such as RSVP, all capitals.
const labelPattern = /^([A-Z][a-z]+|[A-Z]{2,})( ([A-Z][a-z]+|[A-Z]{2,}))*$/;

test("every component has a meta, and every meta a component", () => {
  expect(Object.keys(metas).sort()).toEqual(Object.keys(components).sort());
});

test("metas are valid, hidden from the Components panel, and labelled", () => {
  for (const [name, meta] of Object.entries(metas)) {
    expect(() => wsComponentMeta.parse(meta), name).not.toThrow();
    expect(meta.category, name).toBe("hidden");
    expect(meta.label, name).toMatch(labelPattern);
  }
  expect(metas.SignupForm.label).toBe("Signup Form");
  expect(metas.SubmitButton.label).toBe("Submit Button");
  expect(metas.RsvpForm.label).toBe("RSVP Form");
});

test("the label pattern allows an all-capitals word, and nothing looser", () => {
  for (const label of ["RSVP Form", "Signup Form", "Field", "Submit Button"]) {
    expect(label).toMatch(labelPattern);
  }
  for (const label of [
    "Signup form",
    "signup Form",
    "RSVP form",
    "R Form",
    "RSVP  Form",
    " RSVP Form",
    "RSVPForm",
    "",
  ]) {
    expect(label).not.toMatch(labelPattern);
  }
});

test("content models keep each part inside its own root", () => {
  expect(metas.SignupForm.contentModel).toEqual({
    category: "instance",
    children: ["instance"],
    descendants: [namespaced("Field"), namespaced("SubmitButton")],
  });
  expect(metas.Field.contentModel).toEqual({
    category: "none",
    children: ["instance"],
    descendants: [
      namespaced("FieldLabel"),
      namespaced("FieldInput"),
      namespaced("FieldMessage"),
    ],
  });
  for (const part of [
    metas.Field,
    metas.FieldLabel,
    metas.FieldInput,
    metas.FieldMessage,
    metas.SubmitButton,
  ]) {
    expect(part.contentModel?.category).toBe("none");
  }
});

test("the RSVP Form keeps its parts inside it, and no other root's", () => {
  expect(metas.RsvpForm.contentModel).toEqual({
    category: "instance",
    children: ["instance"],
    descendants: [
      namespaced("Field"),
      namespaced("SubmitButton"),
      namespaced("Guests"),
      namespaced("ShiftOptions"),
      namespaced("Questions"),
      namespaced("EmailConsent"),
    ],
  });
  expect(metas.RsvpForm.presetStyle).toEqual(metas.SignupForm.presetStyle);
  expect(metas.RsvpForm.icon).toBeDefined();
});

test("states and prop controls", () => {
  expect(metas.FieldInput.states).toContainEqual({
    label: "Invalid",
    selector: "[data-invalid]",
  });
  expect(metas.SubmitButton.states).toContainEqual({
    label: "Submitting",
    selector: '[data-state="submitting"]',
  });
  const controls = (meta: (typeof metas)[keyof typeof metas]) =>
    Object.fromEntries(
      Object.entries(meta.props ?? {}).map(([name, prop]) => [
        name,
        prop.control,
      ])
    );
  expect(controls(metas.SignupForm)).toEqual({
    record: "text",
    data: "json",
    state: "select",
    action: "radio",
    actionPage: "url",
  });
  expect(controls(metas.Field)).toEqual({ field: "text" });
  expect(metas.SignupForm.props?.state).toMatchObject({
    defaultValue: "initial",
    options: [
      "initial",
      "submitting",
      "success",
      "confirm-email",
      "error",
      "unavailable",
    ],
  });
  expect(metas.SignupForm.props?.action).toMatchObject({
    defaultValue: "state",
    options: ["state", "page"],
  });
  expect(controls(metas.RsvpForm)).toEqual({
    record: "text",
    data: "json",
    state: "select",
    action: "radio",
    actionPage: "url",
  });
  expect(metas.RsvpForm.initialProps).toEqual([
    "id",
    "class",
    "record",
    "data",
    "state",
    "action",
    "actionPage",
  ]);
  expect(metas.RsvpForm.props?.state).toMatchObject({
    defaultValue: "initial",
    options: [
      "initial",
      "submitting",
      "registered",
      "waitlisted",
      "full",
      "ended",
      "error",
      "unavailable",
    ],
  });
  expect(metas.RsvpForm.props?.action).toMatchObject({
    defaultValue: "state",
    options: ["state", "page"],
  });
});

test("templates and hooks", () => {
  expect(Object.keys(templates)).toEqual([
    "SignupForm",
    "EventList",
    "EventCard",
  ]);
  for (const template of Object.values(templates)) {
    expect(template.category).toBe("hidden");
  }
  expect(templates.SignupForm.label).toBe("Signup Form");
  expect(templates.EventList.label).toBe("Event List");
  expect(templates.EventCard.label).toBe("Event Card");
  expect(hooks).toEqual([]);
});
