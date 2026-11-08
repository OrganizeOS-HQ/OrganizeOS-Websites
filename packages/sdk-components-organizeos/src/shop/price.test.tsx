/**
 * @vitest-environment jsdom
 */
import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Price, formatPrice } from "./price";

afterEach(cleanup);

const rendered = (props: Parameters<typeof Price>[0]) => {
  const { container } = render(<Price {...props} />);
  return container.firstElementChild as HTMLElement;
};

test.each([
  [1800, "$18.00"],
  [1999, "$19.99"],
  [0, "$0.00"],
  [123456, "$1,234.56"],
])("%i cents render %s", (cents, text) => {
  const span = rendered({ cents });
  expect(span.tagName).toBe("SPAN");
  expect(span.textContent).toBe(text);
  expect(formatPrice(cents, "USD")).toBe(text);
});

test.each([
  ["null", null],
  ["undefined", undefined],
  ["-1", -1],
  ["18.5", 18.5],
  ["NaN", Number.NaN],
  ["a string", "1800"],
  ["past the safe integers", Number.MAX_SAFE_INTEGER + 1],
])("%s renders an empty span", (_name, cents) => {
  const span = rendered({ cents: cents as number });
  expect(span.tagName).toBe("SPAN");
  expect(span.textContent).toBe("");
});

test("USD is the default currency, and a currency Intl refuses renders empty", () => {
  expect(rendered({ cents: 500, currency: "USD" }).textContent).toBe("$5.00");
  cleanup();
  expect(rendered({ cents: 500, currency: "dollars" }).textContent).toBe("");
  cleanup();
  expect(rendered({ cents: 500, currency: "" }).textContent).toBe("");
});

test("passes its other props through to the span, and never renders its own as attributes", () => {
  const span = rendered({
    cents: 1800,
    currency: "USD",
    className: "price",
    id: "p",
    // @ts-expect-error a data attribute the builder sets
    "data-ws-id": "abc",
  });
  expect(span.className).toBe("price");
  expect(span.id).toBe("p");
  expect(span.getAttribute("data-ws-id")).toBe("abc");
  expect(span.hasAttribute("cents")).toBe(false);
  expect(span.hasAttribute("currency")).toBe(false);
});
