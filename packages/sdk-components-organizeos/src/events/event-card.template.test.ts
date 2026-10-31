import { createElement } from "react";
import { describe, expect, test } from "vitest";
import {
  type Instance,
  type Prop,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import { showAttribute } from "@webstudio-is/react-sdk";
import { renderTemplate, ws, type Token } from "@webstudio-is/template";
import {
  eventDateToken,
  eventDayToken,
  eventLinkToken,
  eventRowToken,
  eventTitleToken,
  eventsTemplate,
} from "./event-card.template";
import { evaluateOverItem, eventsFixture } from "./events-block-tests";

// The dated card (plan Task A7): the Events blocks' second card, which a site
// template places with placeBlock's `card: "dated"`. A row of a date column
// (month and day number) and the details, with no cover image.

const render = (fragmentRoot: JSX.Element) => {
  const fragment = renderTemplate(fragmentRoot);
  const byId = new Map(fragment.instances.map((item) => [item.id, item]));
  const children = (instance: Instance) =>
    instance.children.flatMap((child) => {
      const found = child.type === "id" ? byId.get(child.value) : undefined;
      return found === undefined ? [] : [found];
    });
  const byLabel = (label: string) => {
    const found = fragment.instances.filter((item) => item.label === label);
    if (found.length !== 1) {
      throw new Error(`${found.length} instances labelled ${label}`);
    }
    return found[0];
  };
  const propOf = (instance: Instance, name: string) =>
    fragment.props.find(
      (prop) => prop.instanceId === instance.id && prop.name === name
    );
  const tokensOf = (instance: Instance) => {
    const values =
      fragment.styleSourceSelections.find(
        (selection) => selection.instanceId === instance.id
      )?.values ?? [];
    return fragment.styleSources.flatMap((source) =>
      source.type === "token" && values.includes(source.id) ? [source.name] : []
    );
  };
  return { fragment, children, byLabel, propOf, tokensOf };
};

const expressionOf = (prop: undefined | Prop) =>
  prop?.type === "expression" ? prop.value : undefined;

const literalOf = (prop: undefined | Prop) =>
  prop?.type === "string" ? prop.value : undefined;

/** A token's declarations as `property[state]` to CSS-ish values. */
const declarationsOf = (token: Token) =>
  renderTemplate(
    createElement(ws.element, { "ws:tokens": [token] })
  ).styles.map(({ property, state, value }) => ({ property, state, value }));

describe("the dated card", () => {
  const { fragment, children, byLabel, propOf, tokensOf } = render(
    eventsTemplate({ label: "Event List", card: "dated" })
  );
  const [parameter] = fragment.dataSources;
  const variable = encodeDataSourceVariable(parameter.id);
  const card = fragment.instances.filter((item) => item.tag === "article")[0];

  test("is an article wearing OS Card, a row of the date column and the details", () => {
    expect(card.label).toBe("Event Card");
    expect(tokensOf(card)).toEqual(["OS Card"]);
    const [row] = children(card);
    expect(children(card)).toHaveLength(1);
    expect(row.label).toBe("Date and details");
    expect(children(row).map((child) => child.label)).toEqual([
      "Date",
      "Details",
    ]);
    expect(children(byLabel("Date")).map((child) => child.label)).toEqual([
      "Month",
      "Day",
    ]);
    expect(children(byLabel("Details")).map((child) => child.label)).toEqual([
      "Title",
      "When",
      "Place",
      "Event link",
    ]);
  });

  // OS Card is a column for the cover card, and an element's own styles come
  // before its tokens in the fragment, so the token's direction would win on
  // the article: the row is the wrapper's. It wraps, so a template that sets
  // OS Event Date to the full width puts the date above the details.
  // The row wears OS Event Row, so a template changes its gap or stacks it.
  test("the row wrapper wears OS Event Row and has no style of its own", () => {
    const row = byLabel("Date and details");
    expect(tokensOf(row)).toEqual(["OS Event Row"]);
    expect(
      fragment.styles.filter(
        (style) => style.styleSourceId === `${row.id}:ws:style`
      )
    ).toEqual([]);
  });

  test("the title wears OS Event Title and the link OS Event Link, as the cover card's", () => {
    expect(tokensOf(byLabel("Title"))).toEqual(["OS Event Title"]);
    expect(tokensOf(byLabel("Event link"))).toEqual(["OS Event Link"]);
  });

  test("the date column wears OS Event Date and the day number OS Event Day", () => {
    expect(tokensOf(byLabel("Date"))).toEqual(["OS Event Date"]);
    expect(tokensOf(byLabel("Month"))).toEqual([]);
    expect(tokensOf(byLabel("Day"))).toEqual(["OS Event Day"]);
  });

  test("has no cover image", () => {
    expect(
      fragment.instances.filter(
        (item) => item.component === "Image" || item.tag === "img"
      )
    ).toEqual([]);
  });

  const times = ["Month", "Day", "Weekday", "Start time"];

  test("its four Time elements read the event's start time in the event's zone, in English for the United States", () => {
    for (const label of times) {
      const time = byLabel(label);
      expect(time.component, label).toBe("Time");
      expect(expressionOf(propOf(time, "datetime")), label).toBe(
        `${variable}.start_time`
      );
      expect(expressionOf(propOf(time, "timeZone")), label).toBe(
        `${variable}.timezone`
      );
      expect(literalOf(propOf(time, "language")), label).toBe("en");
      expect(literalOf(propOf(time, "country")), label).toBe("US");
    }
  });

  test("the date column shows the short month and the day number", () => {
    expect(literalOf(propOf(byLabel("Month"), "format"))).toBe("MMM");
    expect(literalOf(propOf(byLabel("Day"), "format"))).toBe("D");
  });

  // The format tokens have no 12-hour clock, so the start time is the
  // locale's short time style ("6:30 PM"), beside the weekday's format.
  test("the When line is the weekday, then the start time in the short time style", () => {
    const when = byLabel("When");
    expect(when.tag).toBe("p");
    const weekday = byLabel("Weekday");
    const start = byLabel("Start time");
    expect(when.children).toEqual([
      { type: "id", value: weekday.id },
      { type: "text", value: ", " },
      { type: "id", value: start.id },
    ]);
    expect(literalOf(propOf(weekday, "format"))).toBe("DDDD");
    expect(propOf(weekday, "dateStyle")).toBeUndefined();
    expect(propOf(weekday, "timeStyle")).toBeUndefined();
    expect(propOf(start, "format")).toBeUndefined();
    expect(literalOf(propOf(start, "dateStyle"))).toBe("none");
    expect(literalOf(propOf(start, "timeStyle"))).toBe("short");
  });

  test("the title, the place and the link read the event as the cover card's do", () => {
    const title = byLabel("Title");
    expect(title.tag).toBe("h3");
    expect(title.children).toEqual([
      { type: "expression", value: `${variable}.title` },
    ]);
    const place = byLabel("Place");
    expect(place.tag).toBe("p");
    expect(place.children).toEqual([
      { type: "expression", value: `${variable}.location_name` },
    ]);
    const show = expressionOf(propOf(place, showAttribute));
    expect(show).toBeDefined();
    expect(
      eventsFixture.map((item) =>
        evaluateOverItem(show as string, parameter.id, item)
      )
    ).toEqual([true, false, true, true, true]);
    const link = byLabel("Event link");
    expect(link.tag).toBe("a");
    expect(expressionOf(propOf(link, "href"))).toBe(
      `"/events/" + ${variable}.slug`
    );
    expect(propOf(link, "reloadDocument")).toMatchObject({
      type: "boolean",
      value: true,
    });
  });

  // The insert binds the collection and the two boxes by these ids
  // (apps/builder insert-organizeos-block.ts), so the card takes none of them,
  // and fixes no id of its own that a second placement would repeat.
  test("reuses none of the ids the insert binds by, and fixes none of its own", () => {
    const fixed = new Set(["events", "empty", "unavailable"]);
    const root = fragment.children[0].value;
    const cardIds = fragment.instances
      .map((item) => item.id)
      .filter((id) => id !== root && fixed.has(id) === false);
    // every other id is the renderer's own counter
    for (const id of cardIds) {
      expect(id).toMatch(/^\d+$/);
    }
    expect(
      fragment.instances.filter((item) => fixed.has(item.id)).map((i) => i.id)
    ).toEqual(["events", "empty", "unavailable"]);
  });

  test("the cover card stays the default", () => {
    const cover = render(eventsTemplate({ label: "Event List" }));
    expect(cover.fragment).toEqual(
      renderTemplate(eventsTemplate({ label: "Event List", card: "cover" }))
    );
    expect(cover.byLabel("Cover").component).toBe("Image");
  });
});

describe("the dated card's tokens", () => {
  const variable = (name: string, fallback: string) => ({
    type: "var",
    value: name,
    fallback: { type: "unparsed", value: fallback },
  });
  const valueOf = (token: Token, property: string) =>
    declarationsOf(token).find(
      (style) => style.property === property && style.state === undefined
    )?.value;

  test("are named OS Event Date and OS Event Day", () => {
    expect(eventDateToken.name).toBe("OS Event Date");
    expect(eventDayToken.name).toBe("OS Event Day");
  });

  test("the date column is a fixed width, with the month in --text at 14px and 600", () => {
    expect(valueOf(eventDateToken, "width")).toMatchObject({ unit: "px" });
    expect(valueOf(eventDateToken, "flexShrink")).toEqual({
      type: "unit",
      unit: "number",
      value: 0,
    });
    expect(valueOf(eventDateToken, "color")).toEqual(
      variable("text", "#18181b")
    );
    expect(valueOf(eventDateToken, "fontSize")).toEqual({
      type: "unit",
      unit: "px",
      value: 14,
    });
    expect(valueOf(eventDateToken, "fontWeight")).toEqual({
      type: "unit",
      unit: "number",
      value: 600,
    });
  });

  test("the day number is 32px in the heading font and --text", () => {
    expect(valueOf(eventDayToken, "fontSize")).toEqual({
      type: "unit",
      unit: "px",
      value: 32,
    });
    // no fallback, as the forms' headings: on a site without the variable
    // the declaration is invalid and the font is inherited
    expect(valueOf(eventDayToken, "fontFamily")).toEqual({
      type: "var",
      value: "font-heading",
    });
    expect(valueOf(eventDayToken, "color")).toEqual(
      variable("text", "#18181b")
    );
  });

  test("read only the canonical variables", () => {
    const canonical = [
      "base",
      "accent-1",
      "accent-2",
      "text",
      "font-heading",
      "font-body",
    ];
    const tokens = [
      eventDateToken,
      eventDayToken,
      eventRowToken,
      eventTitleToken,
      eventLinkToken,
    ];
    for (const token of tokens) {
      for (const { property, value } of declarationsOf(token)) {
        const where = `${token.name} ${property}`;
        if (value.type === "var") {
          expect(canonical, where).toContain(value.value);
        }
        if (value.type === "unparsed") {
          expect(value.value, where).not.toMatch(/var\(|#[0-9a-f]{3,8}\b/i);
        }
      }
    }
  });
});

describe("the title, link and row tokens", () => {
  const valueOf = (token: Token, property: string) =>
    declarationsOf(token).find(
      (style) => style.property === property && style.state === undefined
    )?.value;

  test("are named OS Event Title, OS Event Link and OS Event Row", () => {
    expect(eventTitleToken.name).toBe("OS Event Title");
    expect(eventLinkToken.name).toBe("OS Event Link");
    expect(eventRowToken.name).toBe("OS Event Row");
  });

  // as the Signup Form's and the RSVP Form's headings: with no fallback, a
  // site without the variable inherits its font, as before
  test("the title is in the heading font, with no fallback", () => {
    expect(declarationsOf(eventTitleToken)).toEqual([
      {
        property: "fontFamily",
        state: undefined,
        value: { type: "var", value: "font-heading" },
      },
    ]);
  });

  // The browser's link blue is all but invisible on a dark base.
  test("the link reads --text, underlined and bolder", () => {
    expect(valueOf(eventLinkToken, "color")).toEqual({
      type: "var",
      value: "text",
      fallback: { type: "unparsed", value: "#18181b" },
    });
    expect(valueOf(eventLinkToken, "textDecorationLine")).toEqual({
      type: "keyword",
      value: "underline",
    });
    expect(valueOf(eventLinkToken, "fontWeight")).toEqual({
      type: "unit",
      unit: "number",
      value: 600,
    });
  });

  // The kit's tap target (kit/layout.tsx tapTarget), with margins that take
  // back what it adds over one line, so the card keeps its height.
  test("the link is a 44px tap target that takes one line of the card", () => {
    expect(valueOf(eventLinkToken, "display")).toEqual({
      type: "keyword",
      value: "inline-flex",
    });
    expect(valueOf(eventLinkToken, "alignItems")).toEqual({
      type: "keyword",
      value: "center",
    });
    expect(valueOf(eventLinkToken, "minHeight")).toEqual({
      type: "unit",
      unit: "px",
      value: 44,
    });
    for (const property of ["marginTop", "marginBottom"]) {
      expect(valueOf(eventLinkToken, property), property).toEqual({
        type: "unparsed",
        value: "calc((1lh - 44px)/2)",
      });
    }
  });

  test("the row is a wrapping flex row with the card's gaps", () => {
    expect(valueOf(eventRowToken, "display")).toEqual({
      type: "keyword",
      value: "flex",
    });
    expect(valueOf(eventRowToken, "flexDirection")).toEqual({
      type: "keyword",
      value: "row",
    });
    expect(valueOf(eventRowToken, "flexWrap")).toEqual({
      type: "keyword",
      value: "wrap",
    });
    expect(valueOf(eventRowToken, "alignItems")).toEqual({
      type: "keyword",
      value: "flex-start",
    });
    expect(valueOf(eventRowToken, "columnGap")).toEqual({
      type: "unit",
      unit: "px",
      value: 16,
    });
    expect(valueOf(eventRowToken, "rowGap")).toEqual({
      type: "unit",
      unit: "px",
      value: 8,
    });
  });
});
