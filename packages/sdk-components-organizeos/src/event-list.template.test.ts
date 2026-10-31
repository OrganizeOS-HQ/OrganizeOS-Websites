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
// (plan Task A7), with these changes and no others; the cover card is still
// the default:
// - OS Card's four border colours, from the literal #e4e4e7 to a mix of the
//   site's text and base colours;
// - the title wears "OS Event Title", in the heading font;
// - the link wears "OS Event Link": --text, underlined and bolder, a 44px tap
//   target. The browser's link blue was close to invisible on every dark
//   palette, a readability defect, so the snapshot gives way for it (A7
//   follow-up ruling);
// - the start time wraps pretty, so "AM" is not left alone and a narrow
//   card does not split the month from its day (the events round's ruling;
//   it was balanced before);
// - the cover Image's own declarations (block, full width, auto height)
//   moved, unchanged, to the token "OS Event Cover" it now wears, so a
//   template crops covers to a ratio of its own;
// - the "No upcoming events" and "Events unavailable" lines wear "OS Event
//   Note", which declares nothing, so a template frames them. Their ids
//   ("empty", "unavailable"), which the insert binds by, are unchanged.
test("the Event List is the fragment it was, but for the changes above", () => {
  expect(renderTemplate(meta.template)).toEqual(beforeDatedCards);
});
