import { describe, expect, test } from "vitest";
import {
  type Instance,
  type Prop,
  type WebstudioFragment,
  encodeDataSourceVariable,
  executeExpression,
} from "@webstudio-is/sdk";
import { showAttribute } from "@webstudio-is/react-sdk";
import { CalendarIcon } from "@webstudio-is/icons/svg";
import { renderTemplate, type TemplateMeta } from "@webstudio-is/template";
import events from "../__fixtures__/events.json";

// The checks the Event List and the Event Card templates share: each is a
// root holding a collection of cards, a "No upcoming events" box and an
// "Events unavailable" box (spec invariant 11), and the card is the same
// function of the collection's parameter in both.

const fragmentHelpers = (fragment: WebstudioFragment) => {
  const instances = new Map(fragment.instances.map((item) => [item.id, item]));
  const getInstance = (id: string) => {
    const instance = instances.get(id);
    if (instance === undefined) {
      throw new Error(`no instance ${id}`);
    }
    return instance;
  };
  const propsOf = (instance: Instance) =>
    fragment.props.filter((prop) => prop.instanceId === instance.id);
  const propOf = (instance: Instance, name: string) =>
    propsOf(instance).find((prop) => prop.name === name);
  const byLabel = (label: string) => {
    const found = fragment.instances.filter((item) => item.label === label);
    if (found.length !== 1) {
      throw new Error(`${found.length} instances labelled ${label}`);
    }
    return found[0];
  };
  const childInstances = (instance: Instance) =>
    instance.children.flatMap((child) =>
      child.type === "id" ? [getInstance(child.value)] : []
    );
  return { getInstance, propsOf, propOf, byLabel, childInstances };
};

/** The fixture's events, as the Upcoming Events binding hands them over. */
export const eventsFixture = events.data;

/**
 * Evaluate an expression over the collection's parameter, given the value the
 * item takes: the parameter's variable is replaced by the item as a literal.
 */
export const evaluateOverItem = (
  expression: string,
  parameterId: string,
  item: unknown
) =>
  executeExpression(
    expression.replaceAll(
      encodeDataSourceVariable(parameterId),
      JSON.stringify(item)
    )
  );

export const describeEventsBlock = ({
  meta,
  label,
}: {
  meta: TemplateMeta;
  /** The label of the template's root. */
  label: string;
}) => {
  const fragment = renderTemplate(meta.template);
  const { propsOf, propOf, byLabel, childInstances, getInstance } =
    fragmentHelpers(fragment);
  const root = getInstance(fragment.children[0].value);
  const collection = byLabel("Events");
  // the Event Card template labels its root and its card alike: the card is
  // the article
  const card = fragment.instances.filter((item) => item.tag === "article")[0];
  const [parameter] = fragment.dataSources;
  const variable = encodeDataSourceVariable(parameter.id);
  const expressionOf = (prop: undefined | Prop) =>
    prop?.type === "expression" ? prop.value : undefined;

  describe(`the ${label} template`, () => {
    test("is hidden from the Components panel, with a label, a description and an icon", () => {
      expect(meta.category).toBe("hidden");
      expect(meta.label).toBe(label);
      expect(meta.description).toBeTruthy();
      expect(meta.icon).toBe(CalendarIcon);
    });

    test("is a Share Code Carrier, a div, holding the collection, then the empty and unavailable boxes", () => {
      // the carrier takes a visitor's share code to a card's link
      expect(root.component).toBe(
        "@organizeos/site-components:ShareCodeCarrier"
      );
      expect(root.tag).toBeUndefined();
      expect(propsOf(root)).toEqual([]);
      expect(root.label).toBe(label);
      expect(childInstances(root).map((child) => child.label)).toEqual([
        "Events",
        "No upcoming events",
        "Events unavailable",
      ]);
    });

    test("the collection has the id events, an item parameter and no data of its own", () => {
      expect(collection.id).toBe("events");
      expect(collection.component).toBe("ws:collection");
      expect(propsOf(collection).map((prop) => prop.name)).toEqual(["item"]);
      expect(propOf(collection, "item")).toMatchObject({
        type: "parameter",
        value: parameter.id,
      });
      expect(fragment.dataSources).toEqual([
        {
          type: "parameter",
          id: parameter.id,
          scopeInstanceId: collection.id,
          name: "event",
        },
      ]);
      // the card is its only child
      expect(childInstances(collection)).toEqual([card]);
    });

    test("the empty and unavailable boxes have the ids the completion binds, and placeholder text", () => {
      const empty = getInstance("empty");
      const unavailable = getInstance("unavailable");
      expect(
        [empty, unavailable].map((box) => [box.component, box.tag])
      ).toEqual([
        ["ws:element", "p"],
        ["ws:element", "p"],
      ]);
      expect(empty.label).toBe("No upcoming events");
      expect(unavailable.label).toBe("Events unavailable");
      expect(empty.children).toEqual([
        { type: "text", value: "No upcoming events.", placeholder: true },
      ]);
      expect(unavailable.children).toEqual([
        {
          type: "text",
          value: "Events are unavailable right now.",
          placeholder: true,
        },
      ]);
      // shown by the completion, once it has the block's binding
      expect(propOf(empty, showAttribute)).toBeUndefined();
      expect(propOf(unavailable, showAttribute)).toBeUndefined();
    });

    test("the empty and unavailable boxes and the root declare no colour, so the text is the site's", () => {
      const colourDeclarations = (instance: Instance) => {
        const sourceIds =
          fragment.styleSourceSelections.find(
            (selection) => selection.instanceId === instance.id
          )?.values ?? [];
        return fragment.styles
          .filter((style) => sourceIds.includes(style.styleSourceId))
          .map((style) => style.property)
          .filter((property) => property === "color");
      };
      for (const instance of [
        root,
        getInstance("empty"),
        getInstance("unavailable"),
      ]) {
        expect(colourDeclarations(instance), instance.label).toEqual([]);
      }
    });

    test("the card reads the event through expressions over the parameter", () => {
      expect(card.component).toBe("ws:element");
      expect(card.tag).toBe("article");
      const cover = byLabel("Cover");
      expect(cover.component).toBe("Image");
      expect(expressionOf(propOf(cover, "src"))).toBe(
        `${variable}.cover_image_url`
      );
      expect(expressionOf(propOf(cover, "alt"))).toBe(`${variable}.title`);

      const title = byLabel("Title");
      expect(title.tag).toBe("h3");
      expect(title.children).toEqual([
        { type: "expression", value: `${variable}.title` },
      ]);

      const starts = byLabel("Starts");
      expect(starts.component).toBe("Time");
      expect(expressionOf(propOf(starts, "datetime"))).toBe(
        `${variable}.start_time`
      );
      expect(expressionOf(propOf(starts, "timeZone"))).toBe(
        `${variable}.timezone`
      );

      const place = byLabel("Place");
      expect(place.tag).toBe("p");
      expect(place.children).toEqual([
        { type: "expression", value: `${variable}.location_name` },
      ]);

      const link = byLabel("Event link");
      expect(link.component).toBe("ws:element");
      expect(link.tag).toBe("a");
      // the platform's event page on the site's own host, opened with a
      // document navigation: the site has no route there
      expect(expressionOf(propOf(link, "href"))).toBe(
        `"/events/" + ${variable}.slug`
      );
      expect(propOf(link, "reloadDocument")).toMatchObject({
        type: "boolean",
        value: true,
      });
      expect(link.children).toEqual([
        { type: "text", value: "Details and RSVP", placeholder: true },
      ]);
      expect(childInstances(card).map((child) => child.label)).toEqual([
        "Cover",
        "Title",
        "Starts",
        "Place",
        "Event link",
      ]);
    });

    test("the date and time styles are literals, in English for the United States", () => {
      const starts = byLabel("Starts");
      const literal = (name: string) => {
        const prop = propOf(starts, name);
        return prop?.type === "string" ? prop.value : undefined;
      };
      expect(literal("dateStyle")).toBe("full");
      expect(literal("timeStyle")).toBe("short");
      expect(literal("language")).toBe("en");
      expect(literal("country")).toBe("US");
    });

    test("the card, its cover, title and link, and the two lines wear the shared tokens, and the template makes no others", () => {
      expect(
        fragment.styleSources.flatMap((source) =>
          source.type === "token" ? [source.name] : []
        )
      ).toEqual([
        "OS Card",
        "OS Event Cover",
        "OS Event Title",
        "OS Event Link",
        "OS Event Note",
      ]);
      const note = fragment.styleSources.find(
        (source) => source.type === "token" && source.name === "OS Event Note"
      );
      for (const id of ["empty", "unavailable"]) {
        expect(
          fragment.styleSourceSelections.find(
            (selection) => selection.instanceId === id
          )?.values,
          id
        ).toEqual([note?.id]);
      }
      // the note declares nothing (event-card.template.test.ts)
      expect(
        fragment.styles.some((style) => style.styleSourceId === note?.id)
      ).toBe(false);
      for (const [instance, name] of [
        [card, "OS Card"],
        [byLabel("Cover"), "OS Event Cover"],
        [byLabel("Title"), "OS Event Title"],
        [byLabel("Event link"), "OS Event Link"],
      ] as const) {
        const token = fragment.styleSources.find(
          (source) => source.type === "token" && source.name === name
        );
        expect(
          fragment.styleSourceSelections.find(
            (selection) => selection.instanceId === instance.id
          )?.values,
          name
        ).toContain(token?.id);
        expect(
          fragment.styles.some((style) => style.styleSourceId === token?.id),
          name
        ).toBe(true);
      }
    });

    // "AM" alone on a line reads badly, and so does a month split from its
    // day, which balanced lines gave in a narrow card ("Thursday, March /
    // 11, 2027"): pretty wrapping moves only the last words down. The date
    // still wraps where it must.
    test("the start time wraps pretty, and it still wraps", () => {
      const starts = byLabel("Starts");
      const local = fragment.styles.filter(
        (style) => style.styleSourceId === `${starts.id}:ws:style`
      );
      expect(local.map(({ property, value }) => [property, value])).toEqual([
        ["textWrapMode", { type: "keyword", value: "wrap" }],
        ["textWrapStyle", { type: "keyword", value: "pretty" }],
      ]);
    });

    test("the cover shows only for an event with an image", () => {
      const show = expressionOf(propOf(byLabel("Cover"), showAttribute));
      expect(show).toBeDefined();
      const evaluate = (item: unknown) =>
        evaluateOverItem(show as string, parameter.id, item);
      expect(
        evaluate({ cover_image_url: "https://cdn.example.org/a.jpg" })
      ).toBe(true);
      // a bare `!== null` would be true for the last one
      expect(evaluate({ cover_image_url: null })).toBe(false);
      expect(evaluate({ cover_image_url: "" })).toBe(false);
      expect(evaluate({})).toBe(false);
      expect(eventsFixture.map(evaluate)).toEqual([
        false,
        false,
        true,
        false,
        false,
      ]);
    });

    test("the place shows only for an event with a location name", () => {
      const show = expressionOf(propOf(byLabel("Place"), showAttribute));
      expect(show).toBeDefined();
      const evaluate = (item: unknown) =>
        evaluateOverItem(show as string, parameter.id, item);
      expect(evaluate({ location_name: "Central Library" })).toBe(true);
      expect(evaluate({ location_name: null })).toBe(false);
      expect(evaluate({ location_name: "" })).toBe(false);
      expect(evaluate({})).toBe(false);
      expect(eventsFixture.map(evaluate)).toEqual([
        true,
        false,
        true,
        true,
        true,
      ]);
    });
  });

  return { fragment, root, collection, card, parameter };
};
