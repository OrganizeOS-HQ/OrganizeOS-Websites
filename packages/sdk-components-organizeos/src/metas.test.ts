import { expect, test } from "vitest";
import { descendantComponent, wsComponentMeta } from "@webstudio-is/sdk";
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

test("every part the RSVP Form lists is a component of the package, under the name it is listed by", () => {
  const listed = metas.RsvpForm.contentModel?.descendants ?? [];
  expect(listed.length).toBeGreaterThan(0);
  for (const name of listed) {
    const short = name.replace(namespaced(""), "");
    expect(name, name).toBe(namespaced(short));
    expect(Object.keys(metas), name).toContain(short);
    expect(Object.keys(components), name).toContain(short);
  }
});

test("the RSVP Form's composite parts: labelled, hidden, and with the content they take", () => {
  expect(metas.Guests.label).toBe("Guests");
  expect(metas.ShiftOptions.label).toBe("Shift Options");
  expect(metas.Questions.label).toBe("Questions");
  expect(metas.EmailConsent.label).toBe("Email Consent");
  // The three that render their own controls take the instances that style
  // them (`ws:descendant`) and nothing else.
  for (const part of [metas.Guests, metas.ShiftOptions, metas.Questions]) {
    expect(part.contentModel).toEqual({
      category: "none",
      children: [descendantComponent],
    });
    expect(part.icon).toBeDefined();
  }
  // Email Consent is labelled by its own children.
  expect(metas.EmailConsent.contentModel).toEqual({
    category: "none",
    children: ["instance", "rich-text"],
  });
  expect(metas.EmailConsent.icon).toBeDefined();
});

test("the composite parts' states and props", () => {
  const invalid = { label: "Invalid", selector: "[data-invalid]" };
  expect(metas.ShiftOptions.states).toEqual([
    { label: "Full", selector: "[data-full]" },
    invalid,
  ]);
  expect(metas.Guests.states).toEqual([invalid]);
  expect(metas.Questions.states).toEqual([invalid]);
  expect(metas.EmailConsent.states).toEqual([invalid]);
  // each part's preset style is the element it renders
  expect(Object.keys(metas.Guests.presetStyle ?? {})).toEqual(["div"]);
  expect(Object.keys(metas.ShiftOptions.presetStyle ?? {})).toEqual(["div"]);
  expect(Object.keys(metas.Questions.presetStyle ?? {})).toEqual(["div"]);
  expect(Object.keys(metas.EmailConsent.presetStyle ?? {})).toEqual(["label"]);
  expect(metas.Guests.initialProps).toEqual([
    "id",
    "class",
    "addLabel",
    "removeLabel",
    "firstNamePlaceholder",
    "lastNamePlaceholder",
  ]);
  expect(metas.ShiftOptions.initialProps).toEqual(["id", "class"]);
  expect(metas.Questions.initialProps).toEqual(["id", "class"]);
  expect(metas.EmailConsent.initialProps).toEqual(["id", "class"]);
  expect(metas.Guests.props).toMatchObject({
    addLabel: { control: "text", defaultValue: "Add a guest" },
    removeLabel: { control: "text", defaultValue: "Remove" },
    firstNamePlaceholder: { control: "text", defaultValue: "First name" },
    lastNamePlaceholder: { control: "text", defaultValue: "Last name" },
  });
  expect(Object.keys(metas.Guests.props ?? {})).toEqual([
    "addLabel",
    "removeLabel",
    "firstNamePlaceholder",
    "lastNamePlaceholder",
  ]);
  expect(metas.ShiftOptions.props).toBeUndefined();
  expect(metas.Questions.props).toBeUndefined();
  expect(metas.EmailConsent.props).toBeUndefined();
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
    "RsvpForm",
    "RotatingTabs",
  ]);
  for (const template of Object.values(templates)) {
    expect(template.category).toBe("hidden");
  }
  expect(templates.SignupForm.label).toBe("Signup Form");
  expect(templates.EventList.label).toBe("Event List");
  expect(templates.EventCard.label).toBe("Event Card");
  expect(templates.RsvpForm.label).toBe("RSVP Form");
  expect(templates.RotatingTabs.label).toBe("Rotating Tabs");
  // every template's label is the label a designer sees in the panel and the
  // navigator, and a template that is a component's has that component's
  for (const [name, template] of Object.entries(templates)) {
    expect(template.label, name).toMatch(labelPattern);
  }
  expect(templates.RsvpForm.label).toBe(metas.RsvpForm.label);
  expect(hooks).toEqual([]);
});

test("the Rotation Control: hidden, childless, a button, with its props", () => {
  const meta = metas.RotationControl;
  expect(meta.label).toBe("Rotation Control");
  expect(meta.icon).toBeDefined();
  // upstream's Tabs takes only `instance` children
  expect(meta.contentModel).toEqual({ category: "instance", children: [] });
  expect(Object.keys(meta.presetStyle ?? {})).toEqual(["button"]);
  expect(meta.initialProps).toEqual([
    "id",
    "class",
    "interval",
    "pauseLabel",
    "playLabel",
  ]);
  expect(meta.props).toMatchObject({
    interval: { type: "number", control: "number", defaultValue: 5.5 },
    pauseLabel: { type: "string", control: "text", defaultValue: "Pause" },
    playLabel: { type: "string", control: "text", defaultValue: "Play" },
    value: { type: "string", control: "text" },
    onValueChange: { type: "action", control: "action" },
  });
  expect(Object.keys(meta.props ?? {})).toEqual([
    "interval",
    "pauseLabel",
    "playLabel",
    "value",
    "onValueChange",
  ]);
});
