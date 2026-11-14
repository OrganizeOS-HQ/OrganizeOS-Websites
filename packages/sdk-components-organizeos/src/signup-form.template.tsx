import { Children, cloneElement, isValidElement } from "react";
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
  errorMessageToken,
  formCardToken,
  formHeadingToken,
  formIntroToken,
  successMessageToken,
} from "./shared/form-tokens";
import { organizeos } from "./shared/proxy";
import {
  fieldTemplate,
  type SiteFieldTemplateField,
} from "./signup/field.template";

// Functions, not constants: a site template places the form once per
// placement, and `renderTemplate` keys a data source by its Variable, so each
// call needs a Variable of its own to scope the state to its own root.
//
// `data` is left unbound: the OrganizeOS panel binds it to the project's
// Forms preset by id when it inserts the block.
//
// The Fields come from `fieldTemplate`, the tree the builder inserts for a
// field, labelled by their field in the navigator; the state boxes are
// labelled by their state and wear the message tokens. The Error box sits in
// the form's content, where the visitor is looking when it shows.

/** The Error box; in the inline row, a full line under the row. */
const errorBox = (formState: Variable, { inline = false } = {}) => (
  <ws.element
    ws:tag="div"
    ws:label="Error"
    ws:show={expression`${formState} === 'error'`}
    ws:tokens={[errorMessageToken]}
    {...(inline
      ? {
          "ws:style": css`
            flex-basis: 100%;
          `,
        }
      : {})}
  >
    {new PlaceholderValue("Something went wrong. Please try again.")}
  </ws.element>
);

/** The boxes after the form's content: one per state that replaces it. */
const stateBoxes = (formState: Variable) => [
  <ws.element
    key="success"
    ws:tag="div"
    ws:label="Success"
    ws:show={expression`${formState} === 'success'`}
    ws:tokens={[successMessageToken]}
  >
    {new PlaceholderValue("Thanks for signing up!")}
  </ws.element>,
  <ws.element
    key="confirm-email"
    ws:tag="div"
    ws:label="Check your email"
    ws:show={expression`${formState} === 'confirm-email'`}
    ws:tokens={[successMessageToken]}
  >
    {
      new PlaceholderValue(
        "Almost there. Check your email and confirm your address to finish signing up."
      )
    }
  </ws.element>,
  <ws.element
    key="unavailable"
    ws:tag="div"
    ws:label="Unavailable"
    ws:show={expression`${formState} === 'unavailable'`}
    ws:tokens={[errorMessageToken]}
  >
    {new PlaceholderValue("Signups are not available right now.")}
  </ws.element>,
];

const contentShow = (formState: Variable) =>
  expression`${formState} === 'initial' || ${formState} === 'submitting' || ${formState} === 'error'`;

// `heading` and `submit` are a site template's text for the form's heading
// and its submit button (placeBlock's options); with none, the block's own
// placeholders.
export const signupFormTemplate = ({
  heading,
  submit,
}: { heading?: string; submit?: string } = {}) => {
  const formState = new Variable("formState", "initial");
  return (
    <organizeos.SignupForm
      state={expression`${formState}`}
      onStateChange={
        new ActionValue(["state"], expression`${formState} = state`)
      }
      ws:style={css`
        max-width: 32rem;
        width: 100%;
      `}
    >
      <ws.element
        ws:tag="div"
        ws:label="Form Content"
        ws:show={contentShow(formState)}
        ws:style={css`
          display: flex;
          flex-direction: column;
          gap: 16px;
        `}
      >
        {/*
          The heading wears "OS Form Heading": the site's heading font, as a
          template's own headings are, at a heading's line height.
        */}
        <ws.element ws:tag="h2" ws:tokens={[formHeadingToken]}>
          {heading ?? new PlaceholderValue("Sign up for updates")}
        </ws.element>
        {fieldTemplate({ name: "email", label: "Email", type: "email" })}
        {fieldTemplate({
          name: "first_name",
          label: "First name",
          type: "text",
        })}
        {errorBox(formState)}
        <organizeos.SubmitButton ws:tokens={[buttonToken]}>
          {submit ?? new PlaceholderValue("Sign up")}
        </organizeos.SubmitButton>
      </ws.element>
      {stateBoxes(formState)}
    </organizeos.SignupForm>
  );
};

/**
 * The inline Email Field: `fieldTemplate`'s tree, growing from 320px in the
 * row, its Field Label visually hidden (as the root's honeypot is) and its
 * Field Input reading "Email".
 */
const inlineEmailField = () => {
  const field = fieldTemplate({ name: "email", label: "Email", type: "email" });
  const parts = Children.map(field.props.children, (part) => {
    if (isValidElement(part) === false) {
      return part;
    }
    if (part.type === organizeos.FieldLabel) {
      return cloneElement(part, {
        "ws:style": css`
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        `,
      } as Record<string, unknown>);
    }
    if (part.type === organizeos.FieldInput) {
      return cloneElement(part, { placeholder: "Email" } as Record<
        string,
        unknown
      >);
    }
    return part;
  });
  return cloneElement(
    field,
    {
      "ws:style": css`
        flex: 1 1 320px;
      `,
    } as Record<string, unknown>,
    ...(parts ?? [])
  );
};

/**
 * One row of Email and Submit, which wraps on the form's own width: it breaks
 * into two rows below about 480px wherever the form sits. No heading; the
 * Error box is a full line under the row.
 */
export const signupFormInlineTemplate = () => {
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
        ws:show={contentShow(formState)}
        ws:style={css`
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: flex-start;
        `}
      >
        {inlineEmailField()}
        <organizeos.SubmitButton
          ws:tokens={[buttonToken]}
          ws:style={css`
            flex: 0 0 auto;
          `}
        >
          {new PlaceholderValue("Sign up")}
        </organizeos.SubmitButton>
        {errorBox(formState, { inline: true })}
      </ws.element>
      {stateBoxes(formState)}
    </organizeos.SignupForm>
  );
};

export const meta: TemplateMeta = {
  category: "hidden",
  label: "Signup Form",
  description: "Newsletter and contact signups",
  template: signupFormTemplate(),
};

export const inlineMeta: TemplateMeta = {
  category: "hidden",
  label: "Signup Form, inline",
  description: "Email and a button in one row",
  template: signupFormInlineTemplate(),
};

/**
 * Look A (builder forms spec 5.2 and 5.3): the forms inserts land as a card.
 * The root wears "OS Form Card"; a heading and one line of intro sit above
 * Form Content, so the state boxes that replace it keep them and the card
 * keeps its size. Form Content is a wrapping row: every Field takes the full
 * row, except First name and Last name, which share one until the card is
 * narrow. Its Fields are a site form's, carrying their definition as props;
 * the insert creates their form and marks the root (`siteForm`, `record`).
 * The inputs' size, corners and softened edge, and the button's width and
 * height, are local styles, so a project whose "OS Input" or "OS Button"
 * token already exists still gets them ("ours" keeps an existing token).
 */
type CardKind = "updates" | "contact";

type CardField = SiteFieldTemplateField & { half?: boolean };

const cardCopy: Record<
  CardKind,
  {
    label: string;
    heading: string;
    intro: string;
    submit: string;
    success: string;
    confirm?: string;
    unavailable: string;
    fields: CardField[];
  }
> = {
  updates: {
    label: "Email & SMS updates",
    heading: "Get updates",
    // the insert fills the org's name in (fillOrgName)
    intro: "News and actions from us.",
    submit: "Sign up",
    success: "You're signed up.",
    confirm: "Check your email to confirm.",
    unavailable: "Signups are not available right now.",
    fields: [
      { name: "first_name", label: "First name", type: "text", half: true },
      { name: "last_name", label: "Last name", type: "text", half: true },
      { name: "email", label: "Email", type: "email", required: true },
    ],
  },
  contact: {
    label: "Contact us",
    heading: "Get in touch",
    intro: "Send us a message and we'll reply.",
    submit: "Send message",
    success: "Message sent.",
    unavailable: "This form is not available right now.",
    fields: [
      { name: "name", label: "Full name", type: "text" },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "message", label: "Message", type: "textarea", required: true },
    ],
  },
};

/** The card input's resting edge: --text mixed 70% into --base (spec 5.2). */
const softenedEdge =
  "color-mix(in srgb, var(--text, #18181b) 70%, var(--base, #ffffff))";

const cardInputStyle = css`
  min-height: 44px;
  border-radius: 8px;
  border-top-color: ${softenedEdge};
  border-right-color: ${softenedEdge};
  border-bottom-color: ${softenedEdge};
  border-left-color: ${softenedEdge};
`;

const cardField = ({ half = false, ...field }: CardField) => {
  const element = fieldTemplate({ ...field, siteForm: true });
  const parts = Children.map(element.props.children, (part) =>
    isValidElement(part) && part.type === organizeos.FieldInput
      ? cloneElement(part, { "ws:style": cardInputStyle } as Record<
          string,
          unknown
        >)
      : part
  );
  return cloneElement(
    element,
    {
      "ws:style": half
        ? css`
            flex: 1 1 calc(50% - 6px);
            min-width: 12rem;
          `
        : css`
            flex: 1 1 100%;
          `,
    } as Record<string, unknown>,
    ...(parts ?? [])
  );
};

const box = (
  show: ReturnType<typeof expression>,
  label: string,
  text: string,
  tokenOf: typeof successMessageToken
) => (
  <ws.element
    key={label}
    ws:tag="div"
    ws:label={label}
    ws:show={show}
    ws:tokens={[tokenOf]}
  >
    {new PlaceholderValue(text)}
  </ws.element>
);

export const signupFormCardTemplate = (kind: CardKind) => {
  const copy = cardCopy[kind];
  const formState = new Variable("formState", "initial");
  return (
    <organizeos.SignupForm
      ws:label={copy.label}
      state={expression`${formState}`}
      onStateChange={
        new ActionValue(["state"], expression`${formState} = state`)
      }
      ws:tokens={[formCardToken]}
      ws:style={css`
        display: flex;
        flex-direction: column;
        gap: 16px;
      `}
    >
      <ws.element ws:tag="h2" ws:tokens={[formHeadingToken]}>
        {new PlaceholderValue(copy.heading)}
      </ws.element>
      <ws.element ws:tag="p" ws:label="Intro" ws:tokens={[formIntroToken]}>
        {new PlaceholderValue(copy.intro)}
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Form Content"
        ws:show={contentShow(formState)}
        ws:style={css`
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        `}
      >
        {copy.fields.map((field) => cardField(field))}
        {errorBox(formState, { inline: true })}
        <organizeos.SubmitButton
          ws:tokens={[buttonToken]}
          ws:style={css`
            width: 100%;
            min-height: 48px;
          `}
        >
          {new PlaceholderValue(copy.submit)}
        </organizeos.SubmitButton>
      </ws.element>
      {box(
        expression`${formState} === 'success'`,
        "Success",
        copy.success,
        successMessageToken
      )}
      {copy.confirm === undefined
        ? undefined
        : box(
            expression`${formState} === 'confirm-email'`,
            "Check your email",
            copy.confirm,
            successMessageToken
          )}
      {box(
        expression`${formState} === 'unavailable'`,
        "Unavailable",
        copy.unavailable,
        errorMessageToken
      )}
    </organizeos.SignupForm>
  );
};

export const cardMeta: TemplateMeta = {
  category: "hidden",
  label: "Signup Form, card",
  description: "Email updates, in a card",
  template: signupFormCardTemplate("updates"),
};

export const contactCardMeta: TemplateMeta = {
  category: "hidden",
  label: "Signup Form, contact",
  description: "Name, email and message, in a card",
  template: signupFormCardTemplate("contact"),
};
