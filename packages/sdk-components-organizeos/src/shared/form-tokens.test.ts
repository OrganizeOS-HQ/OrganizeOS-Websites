import { createElement } from "react";
import { expect, test } from "vitest";
import { renderTemplate, ws, type Token } from "@webstudio-is/template";
import { cardToken } from "../events/event-card.template";
import { buttonToken, inputToken, messageToken } from "./form-tokens";

// The block tokens read the site's canonical variables (spec rule 2) with
// their old literal colours as fallbacks, so a site that defines no variable
// looks as it did.

const stylesOf = (token: Token) =>
  renderTemplate(
    createElement(ws.element, { "ws:tokens": [token] })
  ).styles.map(({ property, state, value }) => ({ property, state, value }));

const valueOf = (token: Token, property: string, state?: string) =>
  stylesOf(token).find(
    (style) => style.property === property && style.state === state
  )?.value;

const variable = (name: string, fallback: string) => ({
  type: "var",
  value: name,
  fallback: { type: "unparsed", value: fallback },
});

test("tokens read the canonical variables with fallbacks", () => {
  expect(valueOf(inputToken, "backgroundColor")).toEqual(
    variable("base", "#ffffff")
  );
  expect(valueOf(inputToken, "color")).toEqual(variable("text", "#18181b"));
  expect(valueOf(inputToken, "outlineColor", ":focus-visible")).toEqual(
    variable("accent-2", "#2563eb")
  );
  expect(valueOf(buttonToken, "backgroundColor")).toEqual(
    variable("accent-1", "#18181b")
  );
  expect(valueOf(buttonToken, "color")).toEqual(variable("base", "#ffffff"));
  expect(valueOf(buttonToken, "outlineColor", ":focus-visible")).toEqual(
    variable("accent-2", "#2563eb")
  );
  expect(valueOf(cardToken, "backgroundColor")).toEqual(
    variable("base", "#ffffff")
  );
  expect(valueOf(cardToken, "color")).toEqual(variable("text", "#18181b"));
});

test("the focus ring keeps its width, style and offset as longhands", () => {
  for (const token of [inputToken, buttonToken]) {
    expect(valueOf(token, "outlineWidth", ":focus-visible")).toEqual({
      type: "unit",
      unit: "px",
      value: 2,
    });
    expect(valueOf(token, "outlineStyle", ":focus-visible")).toEqual({
      type: "keyword",
      value: "solid",
    });
    expect(valueOf(token, "outlineOffset", ":focus-visible")).toBeDefined();
  }
});

test("borders, the message grey and the error reds stay literal", () => {
  expect(valueOf(inputToken, "borderTopColor")?.type).not.toBe("var");
  expect(valueOf(cardToken, "borderTopColor")?.type).not.toBe("var");
  expect(
    valueOf(inputToken, "borderTopColor", "[data-invalid]")?.type
  ).not.toBe("var");
  expect(valueOf(messageToken, "color")?.type).not.toBe("var");
  expect(valueOf(messageToken, "color", "[data-invalid]")?.type).not.toBe(
    "var"
  );
});
