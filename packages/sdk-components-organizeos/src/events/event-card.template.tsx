import {
  ws,
  $,
  css,
  expression,
  token,
  Parameter,
  PlaceholderValue,
} from "@webstudio-is/template";

// Template-only JSX: the pieces of the Event List and Event Card templates.
// Nothing here is a component, and `components.ts` never reaches this file, so
// a published site's copy of the package (packages/cli organizeos-components)
// does not carry it.

// A neutral card through a token shared with every Events block: restyling
// "OS Card" restyles every card on the site, as the Signup Form's tokens do.
export const cardToken = token(
  "OS Card",
  css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    background-color: #ffffff;
    color: #18181b;
  `
);

/**
 * One event, as a function of the collection's parameter: the
 * `GET /v1/events` item (`cover_image_url`, `title`, `start_time`, `timezone`,
 * `location_name`, `url`).
 *
 * The two `ws:show` expressions are false for `null`, `""` and a missing key:
 * a bare `!== null` would be true for a missing key, since `undefined !== null`.
 * The Time element renders in the event's own zone; a value it does not know
 * falls back to UTC, so a build made before the platform sends `timezone`
 * renders UTC rather than failing. `url` is absolute, so the link renders as a
 * native anchor.
 */
export const eventCard = (event: Parameter) => (
  <ws.element ws:tag="article" ws:label="Event Card" ws:tokens={[cardToken]}>
    <$.Image
      ws:label="Cover"
      ws:style={css`
        display: block;
        width: 100%;
        height: auto;
      `}
      src={expression`${event}.cover_image_url`}
      alt={expression`${event}.title`}
      ws:show={expression`(${event}.cover_image_url ?? "") !== ""`}
    />
    <ws.element
      ws:tag="h3"
      ws:label="Title"
      ws:style={css`
        margin: 0;
      `}
    >
      {expression`${event}.title`}
    </ws.element>
    <$.Time
      ws:label="Starts"
      datetime={expression`${event}.start_time`}
      timeZone={expression`${event}.timezone`}
      dateStyle="full"
      timeStyle="short"
      language="en"
      country="US"
    />
    <ws.element
      ws:tag="p"
      ws:label="Place"
      ws:show={expression`(${event}.location_name ?? "") !== ""`}
      ws:style={css`
        margin: 0;
      `}
    >
      {expression`${event}.location_name`}
    </ws.element>
    <ws.element
      ws:tag="a"
      ws:label="Event link"
      href={expression`${event}.url`}
    >
      {new PlaceholderValue("Details and RSVP")}
    </ws.element>
  </ws.element>
);

/**
 * The root both blocks share, so that they cannot drift: a grid holding the
 * collection of cards, a box for no upcoming events and a box for a read that
 * failed. The insert (apps/builder insert-organizeos-block.ts) binds the
 * collection's `data` and the two boxes' `data-ws-show` to the block's own
 * Upcoming Events binding, by the `ws:id`s given here ("events", "empty",
 * "unavailable"), so they are not changed without the table there.
 */
export const eventsTemplate = ({ label }: { label: string }) => {
  const event = new Parameter("event");
  return (
    <ws.element
      ws:tag="div"
      ws:label={label}
      ws:style={css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 24px;
      `}
    >
      <ws.collection ws:id="events" ws:label="Events" item={event}>
        {eventCard(event)}
      </ws.collection>
      <ws.element ws:tag="p" ws:id="empty" ws:label="No upcoming events">
        {new PlaceholderValue("No upcoming events.")}
      </ws.element>
      <ws.element ws:tag="p" ws:id="unavailable" ws:label="Events unavailable">
        {new PlaceholderValue("Events are unavailable right now.")}
      </ws.element>
    </ws.element>
  );
};
