import { expect, test } from "vitest";
import { describeEventsBlock } from "./events/events-block-tests";
import { meta } from "./event-list.template";

const { fragment, root } = describeEventsBlock({ meta, label: "Event List" });

test("the Event List is a grid of cards", () => {
  const styleSourceId = `${root.id}:ws:style`;
  expect(
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === root.id
    )?.values
  ).toEqual([styleSourceId]);
  const properties = fragment.styles
    .filter((style) => style.styleSourceId === styleSourceId)
    .map((style) => style.property);
  expect(properties).toContain("display");
  expect(properties).toContain("gridTemplateColumns");
  // the shorthand is expanded
  expect(properties).toContain("rowGap");
  expect(properties).toContain("columnGap");
  expect(
    fragment.styles.find(
      (style) =>
        style.styleSourceId === styleSourceId && style.property === "display"
    )?.value
  ).toEqual({ type: "keyword", value: "grid" });
});

test("the Event List's description says what it lists", () => {
  expect(meta.description).toMatch(/upcoming/i);
});
