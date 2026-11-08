import { css, PlaceholderValue } from "@webstudio-is/template";
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

const navigatorLabel = ({ label, name, consent }: FieldTemplateField) => {
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
 * consent field's Field Label has no text: the block renders the form's own
 * wording there, read from the Forms data, so the site never stores it, and
 * the navigator names it by its kind, never by its wording.
 *
 * Template-only: nothing a published site's copy of the package reaches
 * imports this file.
 */
export const fieldTemplate = (field: FieldTemplateField) => {
  const label = navigatorLabel(field);
  const isConsent = field.consent !== undefined;
  if (field.type === "checkbox" || isConsent) {
    return (
      <organizeos.Field
        ws:label={label}
        field={field.name}
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
          <organizeos.FieldLabel />
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
