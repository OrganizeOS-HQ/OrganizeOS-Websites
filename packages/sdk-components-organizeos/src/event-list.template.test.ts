import { expect, test } from "vitest";
import { renderTemplate } from "@webstudio-is/template";
import { describeEventsBlock } from "./events/events-block-tests";
import beforeDatedCards from "./events/event-list-fragment.json";
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

// The fragment the Components panel inserted before the dated card was added
// (plan Task A7), with OS Card's four border colours changed from the literal
// #e4e4e7 to a mix of the site's text and base colours. Nothing else differs:
// the cover card is still the default.
test("the Event List is the fragment it was, but for OS Card's border colours", () => {
  expect(renderTemplate(meta.template)).toEqual(beforeDatedCards);
});
