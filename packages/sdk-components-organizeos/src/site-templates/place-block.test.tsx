import { describe, expect, test } from "vitest";
import { encodeDataSourceVariable } from "@webstudio-is/sdk";
import { renderTemplate, css, ws } from "@webstudio-is/template";
import { eventsTemplate } from "../events/event-card.template";
import { createBlockPlacer, prefixWsIds, type BlockKey } from "./place-block";

const EventCard: BlockKey = "@organizeos/site-components:EventCard";
const EventList: BlockKey = "@organizeos/site-components:EventList";
const SignupForm: BlockKey = "@organizeos/site-components:SignupForm";

const instanceIds = (fragment: ReturnType<typeof renderTemplate>) =>
  fragment.instances.map((instance) => instance.id);

type Fragment = ReturnType<typeof renderTemplate>;

/** An instance's local declarations, as breakpoint, property and CSS-ish value. */
const localStyles = (fragment: Fragment, instanceId: string) =>
  fragment.styles
    .filter((style) => style.styleSourceId === `${instanceId}:ws:style`)
    .map(({ breakpointId, state, property, value }) => ({
      breakpoint: fragment.breakpoints.find((item) => item.id === breakpointId)
        ?.maxWidth,
      state,
      property,
      value,
    }));

describe("placing blocks", () => {
  test("an Event Card and an Event List on one page get distinct ids", () => {
    const { placeBlock, placements } = createBlockPlacer();
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {placeBlock(EventCard, "featured")}
        {placeBlock(EventList, "upcoming")}
      </ws.element>
    );

    const ids = instanceIds(fragment);
    for (const root of ["featured", "upcoming"]) {
      for (const id of [
        root,
        `${root}:events`,
        `${root}:empty`,
        `${root}:unavailable`,
      ]) {
        expect(ids).toContain(id);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(placements).toEqual([
      { key: EventCard, rootId: "featured" },
      { key: EventList, rootId: "upcoming" },
    ]);
  });

  test("the root carries the block's component and label", () => {
    const { placeBlock } = createBlockPlacer();
    const fragment = renderTemplate(
      <ws.element ws:tag="body">{placeBlock(EventCard, "featured")}</ws.element>
    );
    const root = fragment.instances.find(
      (instance) => instance.id === "featured"
    );
    expect(root?.component).toBe(
      "@organizeos/site-components:ShareCodeCarrier"
    );
    expect(root?.label).toBe("Event Card");
    const list = createBlockPlacer().placeBlock(EventList, "upcoming");
    expect(
      renderTemplate(list).instances.find(
        (instance) => instance.id === "upcoming"
      )?.label
    ).toBe("Event List");
  });

  test("two Signup Forms place without colliding", () => {
    const { placeBlock, placements } = createBlockPlacer();
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {placeBlock(SignupForm, "first")}
        {placeBlock(SignupForm, "second")}
      </ws.element>
    );

    const ids = instanceIds(fragment);
    expect(new Set(ids).size).toBe(ids.length);
    expect(placements).toEqual([
      { key: SignupForm, rootId: "first" },
      { key: SignupForm, rootId: "second" },
    ]);

    const states = fragment.dataSources.filter(
      (dataSource) =>
        dataSource.type === "variable" && dataSource.name === "formState"
    );
    expect(states).toHaveLength(2);
    expect(states.map((state) => state.scopeInstanceId)).toEqual([
      "first",
      "second",
    ]);
    // Each root reads its own state, not the other form's.
    states.forEach((state, index) => {
      const reads = fragment.props.filter(
        (prop) =>
          prop.instanceId === ["first", "second"][index] &&
          prop.type === "expression" &&
          prop.value === encodeDataSourceVariable(state.id)
      );
      expect(reads).toHaveLength(1);
    });
  });

  test.each([
    "@organizeos/site-components:SignupForm",
    "@organizeos/site-components:RsvpForm",
    "@organizeos/site-components:EventList",
    "@organizeos/site-components:EventCard",
  ] as const)("%s places twice on one page", (key) => {
    const { placeBlock } = createBlockPlacer();
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {placeBlock(key, "a")}
        {placeBlock(key, "b")}
      </ws.element>
    );
    const ids = instanceIds(fragment);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["a", "b"]));
  });

  test("a placement id is used once", () => {
    const { placeBlock, placements } = createBlockPlacer();
    placeBlock(EventCard, "a");
    expect(() => placeBlock(SignupForm, "a")).toThrow();
    expect(placements).toEqual([{ key: EventCard, rootId: "a" }]);
  });

  test("two placers do not share placement ids", () => {
    createBlockPlacer().placeBlock(EventCard, "a");
    expect(() => createBlockPlacer().placeBlock(EventCard, "a")).not.toThrow();
  });
});

describe("prefixWsIds", () => {
  test("keeps the collection's item parameter bound to the card's expressions", () => {
    const fragment = renderTemplate(
      prefixWsIds(eventsTemplate({ label: "Event List" }), "upcoming")
    );
    const parameters = fragment.dataSources.filter(
      (dataSource) => dataSource.type === "parameter"
    );
    expect(parameters).toHaveLength(1);
    const [item] = parameters;
    expect(item.scopeInstanceId).toBe("upcoming:events");
    const title = fragment.instances.find(
      (instance) => instance.label === "Title"
    );
    expect(title?.children).toEqual([
      {
        type: "expression",
        value: `${encodeDataSourceVariable(item.id)}.title`,
      },
    ]);
  });

  test("does not change the element it clones", () => {
    const template = eventsTemplate({ label: "Event List" });
    prefixWsIds(template, "upcoming");
    const fragment = renderTemplate(template);
    expect(instanceIds(fragment)).toEqual(
      expect.arrayContaining(["events", "empty", "unavailable"])
    );
  });

  test("leaves a descendant without a ws:id to the renderer", () => {
    const fragment = renderTemplate(
      prefixWsIds(
        <ws.element ws:tag="div">
          <ws.element ws:tag="p" ws:id="named">
            {"text"}
          </ws.element>
          <ws.element ws:tag="p" />
        </ws.element>,
        "root"
      )
    );
    const ids = instanceIds(fragment);
    expect(ids).toContain("root");
    expect(ids).toContain("root:named");
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    const named = fragment.instances.find(
      (instance) => instance.id === "root:named"
    );
    expect(named?.children).toEqual([{ type: "text", value: "text" }]);
  });
});

describe("placement options", () => {
  const RsvpForm: BlockKey = "@organizeos/site-components:RsvpForm";
  const labelsOf = (fragment: Fragment) =>
    fragment.instances.map((instance) => instance.label);

  test("an events block places the cover card by default, and the dated card when asked", () => {
    for (const key of [EventList, EventCard]) {
      const { placeBlock } = createBlockPlacer();
      const cover = renderTemplate(placeBlock(key, "cover"));
      expect(labelsOf(cover)).toContain("Cover");
      expect(labelsOf(cover)).not.toContain("Date");
      const coverAgain = renderTemplate(
        placeBlock(key, "cover-again", { card: "cover" })
      );
      expect(labelsOf(coverAgain)).toContain("Cover");
      const dated = renderTemplate(placeBlock(key, "dated", { card: "dated" }));
      expect(labelsOf(dated)).toContain("Date");
      expect(labelsOf(dated)).not.toContain("Cover");
      // the ids the insert binds by, under the placement's prefix
      expect(instanceIds(dated)).toEqual(
        expect.arrayContaining([
          "dated",
          "dated:events",
          "dated:empty",
          "dated:unavailable",
        ])
      );
    }
  });

  test("the cover and the dated card on one page share one OS Card token", () => {
    const { placeBlock } = createBlockPlacer();
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {placeBlock(EventCard, "featured")}
        {placeBlock(EventList, "upcoming", { card: "dated" })}
      </ws.element>
    );
    const cards = fragment.styleSources.filter(
      (source) => source.type === "token" && source.name === "OS Card"
    );
    expect(cards).toHaveLength(1);
    const wearers = fragment.styleSourceSelections.flatMap((selection) =>
      selection.values.includes(cards[0].id) ? [selection.instanceId] : []
    );
    expect(
      wearers.map(
        (id) => fragment.instances.find((item) => item.id === id)?.tag
      )
    ).toEqual(["article", "article"]);
    const ids = instanceIds(fragment);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("style replaces the root's own declarations by key and adds the rest", () => {
    const { placeBlock } = createBlockPlacer();
    const fragment = renderTemplate(
      placeBlock(EventList, "upcoming", {
        style: css`
          grid-template-columns: 1fr;
          row-gap: 0;
          @media (max-width: 767px) {
            row-gap: 12px;
          }
        `,
      })
    );
    const styles = localStyles(fragment, "upcoming");
    const declared = (property: string, breakpoint?: number) =>
      styles.filter(
        (style) =>
          style.property === property && style.breakpoint === breakpoint
      );
    // replaced: one declaration each
    expect(declared("gridTemplateColumns").map(({ value }) => value)).toEqual([
      { type: "unit", unit: "fr", value: 1 },
    ]);
    expect(declared("rowGap").map(({ value }) => value)).toEqual([
      { type: "unit", unit: "number", value: 0 },
    ]);
    // kept
    expect(declared("display").map(({ value }) => value)).toEqual([
      { type: "keyword", value: "grid" },
    ]);
    expect(declared("columnGap").map(({ value }) => value)).toEqual([
      { type: "unit", unit: "px", value: 24 },
    ]);
    // added, on its breakpoint
    expect(declared("rowGap", 767).map(({ value }) => value)).toEqual([
      { type: "unit", unit: "px", value: 12 },
    ]);
    expect(styles).toHaveLength(5);
  });

  test("style leaves the block's template as it was", () => {
    const { placeBlock } = createBlockPlacer();
    renderTemplate(
      placeBlock(EventList, "styled", {
        style: css`
          grid-template-columns: 1fr;
        `,
      })
    );
    const plain = renderTemplate(
      createBlockPlacer().placeBlock(EventList, "plain")
    );
    expect(
      localStyles(plain, "plain").find(
        (style) => style.property === "gridTemplateColumns"
      )?.value
    ).toEqual({
      type: "unparsed",
      value: "repeat(auto-fill,minmax(260px,1fr))",
    });
  });

  const headingOf = (fragment: Fragment) =>
    fragment.instances.find((instance) => instance.tag === "h2")?.children;

  test("a form block takes its heading's text, in place of its own placeholder", () => {
    const { placeBlock } = createBlockPlacer();
    const signup = renderTemplate(
      placeBlock("@organizeos/site-components:SignupForm", "signup", {
        heading: "Sign up to join",
      })
    );
    expect(headingOf(signup)).toEqual([
      { type: "text", value: "Sign up to join" },
    ]);
    const rsvp = renderTemplate(
      placeBlock("@organizeos/site-components:RsvpForm", "rsvp", {
        heading: "Say you will come",
      })
    );
    expect(headingOf(rsvp)).toEqual([
      { type: "text", value: "Say you will come" },
    ]);
    // with none, the block's own placeholder, as the Components panel inserts
    const plain = renderTemplate(
      placeBlock("@organizeos/site-components:SignupForm", "plain")
    );
    expect(headingOf(plain)).toEqual([
      { type: "text", value: "Sign up for updates", placeholder: true },
    ]);
  });

  test("a form block takes no events options, and an events block no form options", () => {
    const Signup = "@organizeos/site-components:SignupForm" as const;
    const List = "@organizeos/site-components:EventList" as const;
    const { placeBlock } = createBlockPlacer();
    // @ts-expect-error a form block's placement takes no events options
    placeBlock(Signup, "card", { card: "dated" });
    // @ts-expect-error a form block's placement takes no events options
    placeBlock(RsvpForm, "style", { style: [] });
    // @ts-expect-error an events block's placement takes no heading
    placeBlock(List, "heading", { heading: "Coming up" });
    // a key typed as any block's places, and takes no options
    const anyKey = SignupForm as BlockKey;
    expect(() => placeBlock(anyKey, "any")).not.toThrow();
    // @ts-expect-error a key typed as any block's takes no options
    placeBlock(anyKey, "any-heading", { heading: "Join" });
  });
});
