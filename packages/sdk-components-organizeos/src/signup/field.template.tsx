import { css, expression, PlaceholderValue } from "@webstudio-is/template";
import { fieldToken, inputToken, messageToken } from "../shared/form-tokens";
import { organizeos } from "../shared/proxy";

/** The form field a Field stands for, as `GET /v1/forms` describes it. */
export type FieldTemplateField = {
  name: string;
  label: string;
  /** The form field's type: it decides the layout, not the input. */
  type: string;
  /** The definition's consent marker, e.g. "sms". */
  consent?: string;
};

/**
 * The one child of a consent field's Field Label: an expression, so the canvas
 * never opens the label as editable text (it edits only text with no
 * expression in it). The block renders the form's own consent wording there
 * and ignores the value.
 */
export const consentLabelExpression = `""`;

/**
 * A Field's label in the navigator, which the builder's Fields list also
 * shows for a consent field: its field's label (its name when blank), "SMS
 * consent" for the SMS opt-in and "Consent" for another consent field, never
 * the consent wording.
 */
export const getFieldNavigatorLabel = ({
  label,
  name,
  consent,
}: Pick<FieldTemplateField, "label" | "name" | "consent">) => {
  if (consent === "sms") {
    return "SMS consent";
  }
  if (consent !== undefined) {
    return "Consent";
  }
  return label.trim() === "" ? name : label;
};

/**
 * One Field with its Label, Input and Message, in the form tokens: the tree
 * the Signup Form templates use and the builder inserts for a field, so the
 * two are the same. A function: each call is a tree of its own.
 *
 * The Field is labelled by its field in the navigator. A checkbox lays out as
 * a row, the box before its label and the message on a line of its own. A
 * consent field's Field Label has no text, only `consentLabelExpression`, so
 * the canvas never opens it for editing: the block renders the form's own
 * wording there, read from the Forms data, so the site never stores it, and
 * the navigator names it by its kind, never by its wording.
 *
 * Template-only: nothing a published site's copy of the package reaches
 * imports this file.
 */
/**
 * A site form's Field also carries its definition as props (builder forms
 * spec 9): the type, whether it is required and a select's options, which the
 * canvas and the preview render from until the publish that makes them live.
 */
export type SiteFieldTemplateField = FieldTemplateField & {
  required?: boolean;
  options?: string[];
  /** Write the definition props: the Field is a site form's. */
  siteForm?: boolean;
};

const siteFieldProps = (field: SiteFieldTemplateField) =>
  field.siteForm === true
    ? {
        fieldType: field.type,
        required: field.required === true,
        ...(field.options === undefined ? {} : { options: field.options }),
      }
    : {};

export const fieldTemplate = (field: SiteFieldTemplateField) => {
  const label = getFieldNavigatorLabel(field);
  const isConsent = field.consent !== undefined;
  if (field.type === "checkbox" || isConsent) {
    return (
      <organizeos.Field
        ws:label={label}
        field={field.name}
        {...siteFieldProps(field)}
        ws:tokens={[fieldToken]}
        ws:style={css`
          flex-direction: row;
          align-items: flex-start;
          flex-wrap: wrap;
        `}
      >
        <organizeos.FieldInput
          ws:style={css`
            margin-top: 4px;
          `}
        />
        {isConsent ? (
          <organizeos.FieldLabel>{expression`""`}</organizeos.FieldLabel>
        ) : (
          <organizeos.FieldLabel>
            {new PlaceholderValue(field.label)}
          </organizeos.FieldLabel>
        )}
        <organizeos.FieldMessage
          ws:tokens={[messageToken]}
          ws:style={css`
            flex-basis: 100%;
          `}
        />
      </organizeos.Field>
    );
  }
  return (
    <organizeos.Field
      ws:label={label}
      field={field.name}
      {...siteFieldProps(field)}
      ws:tokens={[fieldToken]}
    >
      <organizeos.FieldLabel>
        {new PlaceholderValue(field.label)}
      </organizeos.FieldLabel>
      <organizeos.FieldInput ws:tokens={[inputToken]} />
      <organizeos.FieldMessage ws:tokens={[messageToken]} />
    </organizeos.Field>
  );
};
