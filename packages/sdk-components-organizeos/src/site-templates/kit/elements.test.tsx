import { describe, expect, test } from "vitest";
import { css, renderTemplate, ws } from "@webstudio-is/template";
import { keyed, text } from "./index";
import {
  byLabel,
  childInstances,
  propOf,
  stylesAt,
  textOf,
} from "./test-helpers";

describe("text", () => {
  test("is sample text in the tag, with the styles and the label", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {text(
          "h2",
          css`
            color: var(--text);
          `,
          "Meet [Organization name]",
          "Heading"
        )}
      </ws.element>
    );
    const heading = byLabel(fragment, "Heading");
    expect(heading.tag).toBe("h2");
    expect(textOf(heading)).toEqual(["Meet [Organization\u00A0name]"]);
    expect(stylesAt(fragment, heading, 1440)).toEqual({
      color: "var(--text)",
    });
  });

  test("has no label unless given one", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body" ws:label="Body">
        {text("p", [], "Say who you are.")}
      </ws.element>
    );
    const [paragraph] = childInstances(fragment, byLabel(fragment, "Body"));
    expect(paragraph.tag).toBe("p");
    expect(paragraph.label).toBeUndefined();
    expect(propOf(fragment, paragraph, "ws:label")).toBeUndefined();
  });
});

describe("keyed", () => {
  test("keys a list of children in order, which renders as one flat list", () => {
    const children = keyed([
      <ws.element ws:tag="p" />,
      <ws.element ws:tag="span" />,
    ]);
    expect(children.map((child) => child.key)).toEqual(["0", "1"]);
    const fragment = renderTemplate(
      <ws.element ws:tag="body" ws:label="Body">
        {children}
      </ws.element>
    );
    expect(
      childInstances(fragment, byLabel(fragment, "Body")).map(
        (child) => child.tag
      )
    ).toEqual(["p", "span"]);
  });
});
