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

// A function, not a constant: a site template places the form once per
// placement, and `renderTemplate` keys a data source by its Variable, so each
// call needs a Variable of its own to scope the state to its own root.
//
// `data` is left unbound: the OrganizeOS panel binds it to the project's
// Forms preset by id when it inserts the block.
export const signupFormTemplate = () => {
  const formState = new Variable("formState", "initial");
  return (
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
        {/*
          The heading is in the site's heading font, as a template's own
          headings are; on a site without the variable it inherits, as it
          did before.
        */}
        <ws.element
          ws:tag="h2"
          ws:style={css`
            font-family: var(--font-heading);
          `}
        >
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
  );
};

export const meta: TemplateMeta = {
  category: "hidden",
  label: "Signup Form",
  description: "Newsletter and contact signups",
  template: signupFormTemplate(),
};
