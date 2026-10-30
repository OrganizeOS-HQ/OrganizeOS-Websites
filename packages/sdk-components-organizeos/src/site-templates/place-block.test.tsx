import { describe, expect, test } from "vitest";
import { encodeDataSourceVariable } from "@webstudio-is/sdk";
import { renderTemplate, ws } from "@webstudio-is/template";
import { eventsTemplate } from "../events/event-card.template";
import { createBlockPlacer, prefixWsIds, type BlockKey } from "./place-block";

const EventCard: BlockKey = "@organizeos/site-components:EventCard";
const EventList: BlockKey = "@organizeos/site-components:EventList";
const SignupForm: BlockKey = "@organizeos/site-components:SignupForm";

const instanceIds = (fragment: ReturnType<typeof renderTemplate>) =>
  fragment.instances.map((instance) => instance.id);

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
