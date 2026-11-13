import type { FormFieldConfig } from "../form/context";

/**
 * Whether a form field must be filled in: the field says so and it is not a
 * consent field. Consent is the visitor's choice, so a consent field is never
 * required, whatever its definition says. The one rule the blocks (the input's
 * `required`, the submit check, the canvas check) and the builder (the Fields
 * list, its warning line, the Form change) read.
 */
export const isRequiredField = (field: {
  required: boolean;
  consent?: string;
}) => field.required && field.consent === undefined;

/**
 * The fields a Signup Form collects with no form picked, as the platform
 * applies them: email required; first name, last name and phone optional.
 */
export const orgDefaultFields: readonly FormFieldConfig[] = [
  {
    name: "email",
    label: "Email",
    type: "email",
    required: true,
    options: null,
  },
  {
    name: "first_name",
    label: "First name",
    type: "text",
    required: false,
    options: null,
  },
  {
    name: "last_name",
    label: "Last name",
    type: "text",
    required: false,
    options: null,
  },
  {
    name: "phone",
    label: "Phone",
    type: "phone",
    required: false,
    options: null,
  },
];

type FormRecord = {
  id: string;
  kind: string;
  /** A form a site created (the DTO's `site: true`), builder forms spec 6.3. */
  site: boolean;
  fields: FormFieldConfig[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

// Lenient by design: a published site freezes this code while the platform's
// DTO can gain fields, so unknown keys are ignored and only what the block
// needs is read.
const parseField = (value: unknown): FormFieldConfig | undefined => {
  if (isRecord(value) === false || typeof value.name !== "string") {
    return;
  }
  const options = Array.isArray(value.options)
    ? value.options.filter((option) => typeof option === "string")
    : null;
  const field: FormFieldConfig = {
    name: value.name,
    label: typeof value.label === "string" ? value.label : value.name,
    type: typeof value.type === "string" ? value.type : "text",
    required: value.required === true,
    options,
  };
  // The consent keys are optional markers: a value of another type is left
  // out, never an error.
  if (typeof value.consent === "string") {
    field.consent = value.consent;
  }
  if (typeof value.consent_version === "string") {
    field.consentVersion = value.consent_version;
  } else if (typeof value.consent_version === "number") {
    field.consentVersion = String(value.consent_version);
  }
  return field;
};

const parseForm = (value: unknown): FormRecord | undefined => {
  if (
    isRecord(value) === false ||
    typeof value.id !== "string" ||
    Array.isArray(value.fields) === false
  ) {
    return;
  }
  const fields: FormFieldConfig[] = [];
  for (const item of value.fields) {
    const field = parseField(item);
    if (field) {
      fields.push(field);
    }
  }
  return {
    id: value.id,
    kind: typeof value.kind === "string" ? value.kind : "",
    site: value.site === true,
    fields,
  };
};

/**
 * Reads the `GET /v1/forms` body, `{ data: Form[] }`. Undefined when the value
 * is missing or is not that shape (the preset failed to load, or is unbound).
 */
export const parseFormsData = (data: unknown): FormRecord[] | undefined => {
  if (isRecord(data) === false || Array.isArray(data.data) === false) {
    return;
  }
  const forms: FormRecord[] = [];
  for (const item of data.data) {
    const form = parseForm(item);
    if (form) {
      forms.push(form);
    }
  }
  return forms;
};

export type SignupFormResolution = {
  /** The form id to send, undefined for the org defaults. */
  formId: string | undefined;
  /** The fields the block collects, undefined when its form is unknown. */
  fields: readonly FormFieldConfig[] | undefined;
  /**
   * Why the block cannot submit, undefined when it can. Only a picked form
   * can be unavailable:
   * - "data": a form is picked and the Forms data is missing or malformed;
   * - "record": the picked form is not in it (unpublished, deleted, or a form
   *   the platform does not offer here);
   * - "kind": the picked form is a membership form, which the signups endpoint
   *   refuses; it belongs to the Join Form.
   */
  unavailable: undefined | "data" | "record" | "kind";
  /**
   * Whether the block's form is a site form: its Fields may carry their own
   * definition, which wins on the canvas and in the preview (spec 9).
   */
  site: boolean;
};

/** Finds the block's form in the Forms data by `record`, or uses the org defaults. */
export const resolveSignupForm = (
  record: unknown,
  data: unknown
): SignupFormResolution => {
  const formId =
    typeof record === "string" && record.trim() !== ""
      ? record.trim()
      : undefined;
  // With no form picked, the Forms data is not read at all: the org defaults
  // need nothing from it, and the endpoint resolves the org from the host.
  if (formId === undefined) {
    return {
      formId: undefined,
      fields: orgDefaultFields,
      unavailable: undefined,
      site: false,
    };
  }
  const forms = parseFormsData(data);
  if (forms === undefined) {
    return { formId, fields: undefined, unavailable: "data", site: false };
  }
  const form = forms.find((item) => item.id === formId);
  if (form === undefined) {
    return { formId, fields: undefined, unavailable: "record", site: false };
  }
  return {
    formId,
    fields: form.fields,
    unavailable: form.kind === "membership" ? "kind" : undefined,
    site: form.site,
  };
};
