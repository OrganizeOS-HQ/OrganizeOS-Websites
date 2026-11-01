import { describe, expect, test } from "vitest";
import { renderTemplate, ws } from "@webstudio-is/template";
import { blockComponent, blockTemplateComponent } from "@webstudio-is/sdk";
import { contentBlock } from "./content-block";
import { byLabel, childInstances, textOf } from "./test-helpers";

const card = (title: string) => (
  <ws.element ws:tag="article" ws:label="Card">
    <ws.element ws:tag="h3">{title}</ws.element>
  </ws.element>
);

describe("contentBlock", () => {
  test("holds the template first, then the items, under its label", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="div" ws:label="Grid">
        {contentBlock({
          label: "Cards",
          template: card("[New card]"),
          items: [card("[One]"), card("[Two]")],
        })}
      </ws.element>
    );
    const block = byLabel(fragment, "Cards");
    expect(block.component).toBe(blockComponent);
    // the block is the grid's only child, so its items lay out in the grid
    expect(childInstances(fragment, byLabel(fragment, "Grid"))).toEqual([
      block,
    ]);
    const [template, ...items] = childInstances(fragment, block);
    expect(template.component).toBe(blockTemplateComponent);
    const titleOf = (cardInstance: (typeof items)[number]) =>
      childInstances(fragment, cardInstance).flatMap(textOf);
    expect(childInstances(fragment, template).map(titleOf)).toEqual([
      ["[New card]"],
    ]);
    expect(items.map(titleOf)).toEqual([["[One]"], ["[Two]"]]);
  });
});
