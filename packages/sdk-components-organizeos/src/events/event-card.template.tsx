import {
  ws,
  $,
  css,
  expression,
  token,
  Parameter,
  PlaceholderValue,
} from "@webstudio-is/template";
import { organizeos } from "../shared/proxy";

// Template-only JSX: the pieces of the Event List and Event Card templates.
// Nothing here is a component, and `components.ts` never reaches this file, so
// a published site's copy of the package (packages/cli organizeos-components)
// does not carry it.

// A neutral card through a token shared with every Events block and both
// cards: restyling "OS Card" restyles every card on the site, as the Signup
// Form's tokens do. Its background and text read the site's `--base` and
// `--text` (see shared/form-tokens.ts), with the old literals as fallbacks.
// Its border is a quiet mix of the two, so it follows a dark palette too; the
// colour is longhands, since the `border` shorthand resolves a `var()` that
// has a fallback to the fallback when it is parsed.
export const cardToken = token(
  "OS Card",
  css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border-width: 1px;
    border-style: solid;
    border-top-color: color-mix(
      in srgb,
      var(--text, #18181b) 25%,
      var(--base, #ffffff)
    );
    border-right-color: color-mix(
      in srgb,
      var(--text, #18181b) 25%,
      var(--base, #ffffff)
    );
    border-bottom-color: color-mix(
      in srgb,
      var(--text, #18181b) 25%,
      var(--base, #ffffff)
    );
    border-left-color: color-mix(
      in srgb,
      var(--text, #18181b) 25%,
      var(--base, #ffffff)
    );
    border-radius: 8px;
    background-color: var(--base, #ffffff);
    color: var(--text, #18181b);
  `
);

// The dated card's date column and its day number, each a token a site
// template restyles (SiteTemplate.blockTokens): a chip, a ruled column, a
// width of its own. Neutral, and reading only the canonical variables: the
// month in the text colour at 14px, the day number large in the heading font
// (no fallback, as the forms' headings: on a site without the variable the
// font is inherited).
export const eventDateToken = token(
  "OS Event Date",
  css`
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 64px;
    color: var(--text, #18181b);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
  `
);

export const eventDayToken = token(
  "OS Event Day",
  css`
    font-family: var(--font-heading);
    font-size: 32px;
    line-height: 1;
    color: var(--text, #18181b);
  `
);

// A card's title, in both cards: the site's heading font, with no fallback,
// as the forms' headings (on a site without the variable the font is
// inherited, as before). A token, so a template sets its size and weight.
export const eventTitleToken = token(
  "OS Event Title",
  css`
    font-family: var(--font-heading);
  `
);

// A card's link, in both cards. It reads `--text`, underlined and bolder,
// where the browser's link blue was close to invisible on a dark base. It is
// the kit's tap target (kit/layout.tsx `tapTarget`), at least 44px tall, and
// its margins take back what that adds over one line of text, so the card
// keeps its height; a browser without the `lh` unit drops the margins, and
// the card is a little taller.
export const eventLinkToken = token(
  "OS Event Link",
  css`
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-top: calc((1lh - 44px) / 2);
    margin-bottom: calc((1lh - 44px) / 2);
    color: var(--text, #18181b);
    font-weight: 600;
    text-decoration-line: underline;
  `
);

// The dated card's row of the date column and the details: a wrapping flex
// row with the card's gaps. A token, so a template changes the gaps or stacks
// the two (`flex-direction: column`).
export const eventRowToken = token(
  "OS Event Row",
  css`
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    column-gap: 16px;
    row-gap: 8px;
  `
);

/**
 * One event, as a function of the collection's parameter: the
 * `GET /v1/events` item (`cover_image_url`, `title`, `start_time`, `timezone`,
 * `location_name`, `slug`).
 *
 * The two `ws:show` expressions are false for `null`, `""` and a missing key:
 * a bare `!== null` would be true for a missing key, since `undefined !== null`.
 * The Time element renders in the event's own zone; a value it does not know
 * falls back to UTC, so a build made before the platform sends `timezone`
 * renders UTC rather than failing. The link goes to the event's page on the
 * site's own host, `/events/{slug}`, which the platform serves (see below).
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
      ws:tokens={[eventTitleToken]}
    >
      {expression`${event}.title`}
    </ws.element>
    {/*
      Balanced lines, so a time that wraps does not leave "AM" alone on its
      line; it still wraps, so the full date fits a 320px phone.
    */}
    <$.Time
      ws:label="Starts"
      ws:style={css`
        text-wrap: balance;
      `}
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
    {/*
      The platform serves the event's page at /events/{slug} on the site's own
      host, and the site has no route there, so the click is a document
      navigation: upstream Link's `reloadDocument`, which a published `a`
      renders through. A bound address whose fixed start decides the scheme is
      published while org script is paused (docs/ORGANIZEOS-FORK.md section
      10); `event.url` alone would not be. The Event List shares this card
      (`eventsTemplate`).
    */}
    <ws.element
      ws:tag="a"
      ws:label="Event link"
      ws:tokens={[eventLinkToken]}
      href={expression`"/events/" + ${event}.slug`}
      reloadDocument={true}
    >
      {new PlaceholderValue("Details and RSVP")}
    </ws.element>
  </ws.element>
);

/**
 * A Time element for the event's start, in the event's own zone (see
 * eventCard), in English for the United States.
 */
const startTime = (
  event: Parameter,
  props: { "ws:label": string } & Record<string, unknown>
) => (
  <$.Time
    datetime={expression`${event}.start_time`}
    timeZone={expression`${event}.timezone`}
    language="en"
    country="US"
    {...props}
  />
);

/**
 * The dated card, a site template's choice (placeBlock's `card: "dated"`):
 * no cover image, and a row of a date column (the short month over the day
 * number) and the details: the title, the weekday and start time, the place
 * when there is one, and the link, as the cover card's.
 *
 * The row is a wrapper's ("OS Event Row"), not the article's: an element's
 * own styles come before its tokens in the fragment, and both cards wear OS
 * Card, whose `flex-direction: column` the cover card needs. The row wraps,
 * so a template that sets OS Event Date's width to 100% puts the date above
 * the details (a card with its date on top), and keeps it beside them where
 * it sets a narrower width (rows on phones); OS Event Row's own direction and
 * gaps are a template's too. The weekday and the time are two Time elements: the format tokens
 * have no 12-hour clock, and the short time style has one ("6:30 PM").
 *
 * No element here has a `ws:id`: the insert binds by the root's (see
 * eventsTemplate), and a fixed id would repeat in a second placement.
 */
export const datedEventCard = (event: Parameter) => (
  <ws.element ws:tag="article" ws:label="Event Card" ws:tokens={[cardToken]}>
    <ws.element
      ws:tag="div"
      ws:label="Date and details"
      ws:tokens={[eventRowToken]}
    >
      <ws.element ws:tag="div" ws:label="Date" ws:tokens={[eventDateToken]}>
        {startTime(event, { "ws:label": "Month", format: "MMM" })}
        {startTime(event, {
          "ws:label": "Day",
          "ws:tokens": [eventDayToken],
          format: "D",
        })}
      </ws.element>
      <ws.element
        ws:tag="div"
        ws:label="Details"
        ws:style={css`
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-grow: 1;
          flex-basis: 0%;
          min-width: 0;
        `}
      >
        <ws.element
          ws:tag="h3"
          ws:label="Title"
          ws:style={css`
            margin: 0;
          `}
          ws:tokens={[eventTitleToken]}
        >
          {expression`${event}.title`}
        </ws.element>
        <ws.element
          ws:tag="p"
          ws:label="When"
          ws:style={css`
            margin: 0;
          `}
        >
          {startTime(event, { "ws:label": "Weekday", format: "DDDD" })}
          {", "}
          {startTime(event, {
            "ws:label": "Start time",
            dateStyle: "none",
            timeStyle: "short",
          })}
        </ws.element>
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
          ws:tokens={[eventLinkToken]}
          href={expression`"/events/" + ${event}.slug`}
          reloadDocument={true}
        >
          {new PlaceholderValue("Details and RSVP")}
        </ws.element>
      </ws.element>
    </ws.element>
  </ws.element>
);

/** The card an events block shows each event with. */
export type EventCardVariant = "cover" | "dated";

/**
 * The root both blocks share, so that they cannot drift: a grid holding the
 * collection of cards, a box for no upcoming events and a box for a read that
 * failed. The insert (apps/builder insert-organizeos-block.ts) binds the
 * collection's `data` and the two boxes' `data-ws-show` to the block's own
 * Upcoming Events binding, by the `ws:id`s given here ("events", "empty",
 * "unavailable"), so they are not changed without the table there.
 *
 * The root is a Share Code Carrier, a `div`: a visitor who arrived with a
 * share code (`?r=`) takes it to the event's page when they click a card's
 * link on the published site.
 *
 * `card` is the cover card unless a site template asks for the dated one;
 * the Components panel inserts the cover card.
 */
export const eventsTemplate = ({
  label,
  card = "cover",
}: {
  label: string;
  card?: EventCardVariant;
}) => {
  const event = new Parameter("event");
  return (
    <organizeos.ShareCodeCarrier
      ws:label={label}
      ws:style={css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 24px;
      `}
    >
      <ws.collection ws:id="events" ws:label="Events" item={event}>
        {card === "dated" ? datedEventCard(event) : eventCard(event)}
      </ws.collection>
      <ws.element ws:tag="p" ws:id="empty" ws:label="No upcoming events">
        {new PlaceholderValue("No upcoming events.")}
      </ws.element>
      <ws.element ws:tag="p" ws:id="unavailable" ws:label="Events unavailable">
        {new PlaceholderValue("Events are unavailable right now.")}
      </ws.element>
    </organizeos.ShareCodeCarrier>
  );
};
