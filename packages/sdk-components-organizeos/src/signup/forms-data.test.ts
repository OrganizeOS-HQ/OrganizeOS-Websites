import { expect, test } from "vitest";
import forms from "../__fixtures__/forms.json";
import {
  orgDefaultFields,
  parseFormsData,
  resolveSignupForm,
} from "./forms-data";

const [newsletter, contactForm, membershipForm] = forms.data;

test("reads every form in the forms.json fixture", () => {
  expect(parseFormsData(forms)).toEqual(
    forms.data.map((form) => ({
      id: form.id,
      kind: form.kind,
      fields: form.fields,
    }))
  );
});

test("an empty record uses the org defaults", () => {
  expect(resolveSignupForm(undefined, forms)).toEqual({
    formId: undefined,
    fields: orgDefaultFields,
    unavailable: undefined,
  });
  expect(resolveSignupForm("  ", forms).formId).toBeUndefined();
  expect(
    orgDefaultFields
      .filter((field) => field.required)
      .map((field) => field.name)
  ).toEqual(["email"]);
});

test("a record resolves to its form's fields", () => {
  expect(resolveSignupForm(newsletter.id, forms)).toEqual({
    formId: newsletter.id,
    fields: newsletter.fields,
    unavailable: undefined,
  });
  expect(resolveSignupForm(contactForm.id, forms).fields).toEqual(
    contactForm.fields
  );
});

test("a record missing from data is unavailable", () => {
  expect(
    resolveSignupForm("00000000-0000-4000-8000-000000000000", forms)
  ).toEqual({
    formId: "00000000-0000-4000-8000-000000000000",
    fields: undefined,
    unavailable: "record",
  });
});

test("a membership form is unavailable to a Signup Form", () => {
  expect(resolveSignupForm(membershipForm.id, forms).unavailable).toBe("kind");
});

test("with no record, data is ignored: missing or malformed data still gives the org defaults", () => {
  for (const data of [undefined, null, "forms", [], {}, { data: {} }]) {
    for (const record of [undefined, ""]) {
      expect(resolveSignupForm(record, data)).toEqual({
        formId: undefined,
        fields: orgDefaultFields,
        unavailable: undefined,
      });
    }
  }
});

test("with a record, missing or malformed data is unavailable", () => {
  for (const data of [undefined, null, "forms", [], {}, { data: {} }]) {
    expect(resolveSignupForm(newsletter.id, data)).toEqual({
      formId: newsletter.id,
      fields: undefined,
      unavailable: "data",
    });
  }
});

test("reads leniently: unknown keys are ignored and unreadable entries skipped", () => {
  const data = {
    data: [
      "not a form",
      { id: 7, fields: [] },
      {
        id: "form-1",
        kind: "contact-signup",
        name: "Later DTO",
        added_later: true,
        fields: [
          { name: "email", type: "email", required: true, placeholder: "x" },
          { label: "No name" },
          { name: "topic", type: "select", options: ["A", 2, "B"] },
        ],
      },
    ],
  };
  expect(resolveSignupForm("form-1", data)).toEqual({
    formId: "form-1",
    fields: [
      {
        name: "email",
        label: "email",
        type: "email",
        required: true,
        options: null,
      },
      {
        name: "topic",
        label: "topic",
        type: "select",
        required: false,
        options: ["A", "B"],
      },
    ],
    unavailable: undefined,
  });
});

// No fixture carries the SMS consent field yet: the platform's forms.json gains
// it with the profile sign-up's core PR, and this literal stands in until then.
const smsConsentForms = (consent: unknown, consentVersion: unknown) => ({
  data: [
    {
      id: "form-sms",
      kind: "newsletter",
      fields: [
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone", type: "phone", required: false },
        {
          name: "sms_opt_in",
          label: "Text me updates. Reply STOP to opt out.",
          type: "checkbox",
          required: false,
          consent,
          consent_version: consentVersion,
        },
      ],
    },
  ],
});

const consentField = (consent: unknown, consentVersion: unknown) =>
  resolveSignupForm("form-sms", smsConsentForms(consent, consentVersion))
    .fields?.[2];

test("a consent field keeps its consent marker and version", () => {
  expect(consentField("sms", "v1")).toEqual({
    name: "sms_opt_in",
    label: "Text me updates. Reply STOP to opt out.",
    type: "checkbox",
    required: false,
    options: null,
    consent: "sms",
    consentVersion: "v1",
  });
});

test("a numeric consent version reads as its string", () => {
  expect(consentField("sms", 3)?.consentVersion).toBe("3");
});

test("a consent marker or version of another type is absent, never an error", () => {
  for (const value of [null, undefined, {}, [], true]) {
    const field = consentField(value, value);
    expect(field?.name).toBe("sms_opt_in");
    expect(field).not.toHaveProperty("consent");
    expect(field).not.toHaveProperty("consentVersion");
  }
  // A number is a version, never a marker.
  expect(consentField(7, "v1")).not.toHaveProperty("consent");
});

test("a field with no consent keys carries neither", () => {
  const field = resolveSignupForm("form-sms", smsConsentForms("sms", "v1"))
    .fields?.[0];
  expect(field).not.toHaveProperty("consent");
  expect(field).not.toHaveProperty("consentVersion");
});
