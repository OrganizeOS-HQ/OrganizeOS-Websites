import { expect, test } from "vitest";
import {
  describeProductBlock,
  evaluateWith,
  insertBinds,
  loaded,
  productsFixture,
} from "./shop/product-block-tests";
import { meta } from "./product-card.template";

const { fragment, root, helpers } = describeProductBlock({
  meta,
  label: "Product Card",
  rootComponent: "ProductCard",
  ids: ["product", "empty", "unavailable"],
  lines: ["Products", "No product", "Products unavailable"],
});

test("the card's root is a block, and the lines say why there is no product", () => {
  expect(
    fragment.styles.find(
      (style) =>
        style.styleSourceId === `${root.id}:ws:style` &&
        style.property === "display"
    )?.value
  ).toEqual({ type: "keyword", value: "block" });
  expect(helpers.getInstance("empty").children).toEqual([
    {
      type: "text",
      value: "This product is not available.",
      placeholder: true,
    },
  ]);
  expect(helpers.getInstance("unavailable").children).toEqual([
    {
      type: "text",
      value: "Products are unavailable right now.",
      placeholder: true,
    },
  ]);
  // no Shop all and no cart link
  expect(
    fragment.instances.some((instance) => instance.id === "shop-all")
  ).toBe(false);
  expect(
    fragment.styleSources.flatMap((source) =>
      source.type === "token" ? [source.name] : []
    )
  ).toEqual([
    "OS Card",
    "OS Product Image",
    "OS Product Title",
    "OS Product Price",
    "OS Product Note",
  ]);
});

test("bound as the insert binds it, it shows the first product alone", () => {
  const binds = insertBinds(1);
  expect(evaluateWith(binds.list, loaded(productsFixture))).toEqual([
    productsFixture.data[0],
  ]);
  expect(evaluateWith(binds.empty, loaded({ data: [] }))).toBe(true);
  expect(
    evaluateWith(binds.unavailable, loaded({ error: "unavailable" }, false))
  ).toBe(true);
});

test("the card's description says what it shows", () => {
  expect(meta.description).toBe("One product from your shop");
});
