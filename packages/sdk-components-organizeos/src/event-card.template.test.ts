import { expect, test } from "vitest";
import { renderTemplate } from "@webstudio-is/template";
import { describeEventsBlock } from "./events/events-block-tests";
import { meta } from "./event-card.template";
import { meta as listMeta } from "./event-list.template";

const { fragment, root } = describeEventsBlock({ meta, label: "Event Card" });

test("the Event Card is the Event List's template under its own label and description", () => {
  const list = renderTemplate(listMeta.template);
  expect(meta.description).not.toBe(listMeta.description);
  expect(meta.description).toMatch(/next/i);
  expect(root.label).toBe("Event Card");
  // the same instances, props, styles and data, apart from the root's label
  expect({
    ...fragment,
    instances: fragment.instances.map(({ label, ...instance }) => instance),
  }).toEqual({
    ...list,
    instances: list.instances.map(({ label, ...instance }) => instance),
  });
});
