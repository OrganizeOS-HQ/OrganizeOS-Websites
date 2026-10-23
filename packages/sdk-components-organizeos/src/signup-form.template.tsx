import {
  ws,
  ActionValue,
  css,
  expression,
  PlaceholderValue,
  Variable,
  type TemplateMeta,
} from "@webstudio-is/template";
import {
  buttonToken,
  fieldToken,
  inputToken,
  messageToken,
} from "./shared/form-tokens";
import { organizeos } from "./shared/proxy";

const formState = new Variable("formState", "initial");

// `data` is left unbound: the OrganizeOS panel binds it to the project's
// Forms preset by id when it inserts the block.
export const meta: TemplateMeta = {
  category: "hidden",
  label: "Signup Form",
  description:
    "Collect newsletter and contact signups into OrganizeOS. Works with the org defaults until you pick one of the organization's forms.",
  template: (
    <organizeos.SignupForm
      state={expression`${formState}`}
      onStateChange={
        new ActionValue(["state"], expression`${formState} = state`)
      }
    >
      <ws.element
        ws:tag="div"
        ws:label="Form Content"
        ws:show={expression`${formState} === 'initial' || ${formState} === 'submitting' || ${formState} === 'error'`}
        ws:style={css`
          display: flex;
          flex-direction: column;
          gap: 16px;
        `}
      >
        <ws.element ws:tag="h2">
          {new PlaceholderValue("Sign up for updates")}
        </ws.element>
        <organizeos.Field
          ws:label="Field: Email"
          field="email"
          ws:tokens={[fieldToken]}
        >
          <organizeos.FieldLabel>
            {new PlaceholderValue("Email")}
          </organizeos.FieldLabel>
          <organizeos.FieldInput ws:tokens={[inputToken]} />
          <organizeos.FieldMessage ws:tokens={[messageToken]} />
        </organizeos.Field>
        <organizeos.Field
          ws:label="Field: First name"
          field="first_name"
          ws:tokens={[fieldToken]}
        >
          <organizeos.FieldLabel>
            {new PlaceholderValue("First name")}
          </organizeos.FieldLabel>
          <organizeos.FieldInput ws:tokens={[inputToken]} />
          <organizeos.FieldMessage ws:tokens={[messageToken]} />
        </organizeos.Field>
        <organizeos.SubmitButton ws:tokens={[buttonToken]}>
          {new PlaceholderValue("Sign up")}
        </organizeos.SubmitButton>
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Success"
        ws:show={expression`${formState} === 'success'`}
      >
        {new PlaceholderValue("Thanks for signing up!")}
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Check your email"
        ws:show={expression`${formState} === 'confirm-email'`}
      >
        {
          new PlaceholderValue(
            "Almost there. Check your email and confirm your address to finish signing up."
          )
        }
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Error"
        ws:show={expression`${formState} === 'error'`}
      >
        {new PlaceholderValue("Something went wrong. Please try again.")}
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Unavailable"
        ws:show={expression`${formState} === 'unavailable'`}
      >
        {new PlaceholderValue("Signups are not available right now.")}
      </ws.element>
    </organizeos.SignupForm>
  ),
};
