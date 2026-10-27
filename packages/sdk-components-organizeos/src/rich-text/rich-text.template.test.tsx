import { describe, expect, test } from "vitest";
import { renderTemplate } from "@webstudio-is/template";
import { descendantComponent } from "@webstudio-is/sdk";
import { meta } from "./rich-text.template";
import { meta as richTextMeta } from "./rich-text.ws";

const fragment = renderTemplate(meta.template);
const instances = new Map(
  fragment.instances.map((instance) => [instance.id, instance])
);
const root = instances.get(fragment.children[0].value);

describe("the Rich Text template", () => {
  test("a hidden block with the component's label, description and icon", () => {
    expect(meta.category).toBe("hidden");
    expect(meta.label).toBe("Rich Text");
    expect(meta.description).toBe(richTextMeta.description);
    expect(meta.icon).toBe(richTextMeta.icon);
  });

  test("the root holds one ws:descendant per element it renders, each naming one tag", () => {
    expect(root?.component).toBe("@organizeos/site-components:RichText");
    const children = (root?.children ?? []).map((child) =>
      child.type === "id" ? instances.get(child.value) : undefined
    );
    expect(children.map((child) => child?.component)).toEqual(
      Array(17).fill(descendantComponent)
    );
    const selectors = children.map(
      (child) =>
        fragment.props.find(
          (prop) => prop.instanceId === child?.id && prop.name === "selector"
        )?.value
    );
    expect(selectors).toEqual(
      [
        "p",
        "h2",
        "h3",
        "h4",
        "ul",
        "ol",
        "li",
        "a",
        "blockquote",
        "pre",
        "code",
        "hr",
        "img",
        "figure",
        "figcaption",
        "strong",
        "em",
      ].map((tag) => ` ${tag}`)
    );
    // a comma list outside :where() would style matching elements across
    // the page, since the selector is appended to the root's class
    for (const selector of selectors) {
      expect(String(selector).replace(/:where\([^)]*\)/g, "")).not.toContain(
        ","
      );
    }
    expect(children.every((child) => child?.label !== undefined)).toBe(true);
  });

  test("leaves value unbound and binds nothing", () => {
    expect(
      fragment.props.filter((prop) => prop.instanceId === root?.id)
    ).toEqual([]);
    expect(fragment.dataSources).toEqual([]);
    expect(fragment.resources).toEqual([]);
  });
});
