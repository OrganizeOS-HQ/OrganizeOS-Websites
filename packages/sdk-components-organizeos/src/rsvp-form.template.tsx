import { CalendarIcon } from "@webstudio-is/icons/svg";
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

// Guests, Shift Options and Questions draw their own controls, so a template
// cannot place them as children: it places `ws:descendant` instances, which
// style them through a selector, with the shared tokens, so restyling "OS
// Input" restyles these controls too (the CSS generator appends the selector
// to the part's class, `packages/sdk/src/css.ts`).
//
// - The text controls are one compound inside `:is()`: a bare comma list would
//   be appended to the class as it stands and style every `select` and
//   `textarea` on the page. Checkboxes and radios keep the browser's own look.
// - `[data-message]` is the part's message under a control or a group.
//
// A function, not a shared constant: each part needs instances of its own, and
// `renderTemplate` gives an element its id by its identity. It returns an array
// because `renderTemplate` reads a Fragment only at the root of a template.
const controlStyles = () => [
  <ws.descendant
    key="inputs"
    selector=" :is(input:not([type=checkbox]):not([type=radio]), select, textarea)"
    ws:tokens={[inputToken]}
  />,
  <ws.descendant key="buttons" selector=" button" ws:tokens={[buttonToken]} />,
  <ws.descendant
    key="messages"
    selector=" [data-message]"
    ws:tokens={[messageToken]}
  />,
];

const field = (name: string, label: string, text: string) => (
  <organizeos.Field
    ws:label={`Field: ${label}`}
    field={name}
    ws:tokens={[fieldToken]}
  >
    <organizeos.FieldLabel>{new PlaceholderValue(text)}</organizeos.FieldLabel>
    <organizeos.FieldInput ws:tokens={[inputToken]} />
    <organizeos.FieldMessage ws:tokens={[messageToken]} />
  </organizeos.Field>
);

// A function, not a constant: a site template places the form once per
// placement, and `renderTemplate` keys a data source by its Variable, so each
// call needs a Variable of its own to scope the state to its own root.
//
// `data` is left unbound: the OrganizeOS panel binds it to the block's own
// Events binding by id when it inserts the block, and the designer picks the
// event (`record`) in the Settings panel.
export const rsvpFormTemplate = () => {
  const rsvpState = new Variable("rsvpState", "initial");
  return (
    <organizeos.RsvpForm
      state={expression`${rsvpState}`}
      onStateChange={
        new ActionValue(["state"], expression`${rsvpState} = state`)
      }
    >
      <ws.element
        ws:tag="div"
        ws:label="Form Content"
        ws:show={expression`${rsvpState} === 'initial' || ${rsvpState} === 'submitting' || ${rsvpState} === 'error'`}
        ws:style={css`
          display: flex;
          flex-direction: column;
          gap: 16px;
        `}
      >
        <ws.element ws:tag="h2">
          {new PlaceholderValue("RSVP to this event")}
        </ws.element>
        {field("first_name", "First name", "First name")}
        {field("last_name", "Last name", "Last name")}
        {field("email", "Email", "Email")}
        {field("phone", "Phone", "Phone")}
        <organizeos.Guests>{controlStyles()}</organizeos.Guests>
        <organizeos.ShiftOptions>{controlStyles()}</organizeos.ShiftOptions>
        <organizeos.Questions>{controlStyles()}</organizeos.Questions>
        <organizeos.EmailConsent>
          {new PlaceholderValue("Also email me news from this organization")}
        </organizeos.EmailConsent>
        <organizeos.SubmitButton ws:tokens={[buttonToken]}>
          {new PlaceholderValue("RSVP")}
        </organizeos.SubmitButton>
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Registered"
        ws:show={expression`${rsvpState} === 'registered'`}
      >
        {
          new PlaceholderValue(
            "You're registered. We sent the details to your email."
          )
        }
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Waitlisted"
        ws:show={expression`${rsvpState} === 'waitlisted'`}
      >
        {new PlaceholderValue("This event is full. You're on the waitlist.")}
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Full"
        ws:show={expression`${rsvpState} === 'full'`}
      >
        {new PlaceholderValue("This event is full.")}
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Ended"
        ws:show={expression`${rsvpState} === 'ended'`}
      >
        {new PlaceholderValue("This event has ended.")}
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Error"
        ws:show={expression`${rsvpState} === 'error'`}
      >
        {new PlaceholderValue("Something went wrong. Please try again.")}
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Unavailable"
        ws:show={expression`${rsvpState} === 'unavailable'`}
      >
        {new PlaceholderValue("RSVPs are not available right now.")}
      </ws.element>
    </organizeos.RsvpForm>
  );
};

export const meta: TemplateMeta = {
  category: "hidden",
  label: "RSVP Form",
  description: "RSVPs for one of your events",
  icon: CalendarIcon,
  template: rsvpFormTemplate(),
};
