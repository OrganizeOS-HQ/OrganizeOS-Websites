import { expect, test } from "vitest";
import { showAttribute } from "@webstudio-is/react-sdk";
import {
  describeProductBlock,
  evaluateWith,
  insertBinds,
  loaded,
  productsFixture,
} from "./shop/product-block-tests";
import { meta } from "./product-grid.template";

const { fragment, root, helpers } = describeProductBlock({
  meta,
  label: "Product Grid",
  rootComponent: "ProductGrid",
  ids: ["products", "empty", "unavailable", "shop-all"],
  lines: ["Products", "No products", "Products unavailable", "Shop all"],
});

const localStyles = (id: string) =>
  Object.fromEntries(
    fragment.styles
      .filter((style) => style.styleSourceId === `${id}:ws:style`)
      .map((style) => [style.property, style.value])
  );

test("the grid's root has three columns and a grid that reads them, at least 200px wide", () => {
  expect(helpers.propOf(root, "columns")).toMatchObject({
    type: "string",
    value: "3",
  });
  const styles = localStyles(root.id);
  expect(styles.display).toEqual({ type: "keyword", value: "grid" });
  expect(styles.rowGap).toEqual({ type: "unit", value: 24, unit: "px" });
  expect(styles.columnGap).toEqual({ type: "unit", value: 24, unit: "px" });
  // stored as written (unparsed): at most N columns, never under 200px
  expect(styles.gridTemplateColumns).toEqual({
    type: "unparsed",
    value:
      "repeat(auto-fill,minmax(max(200px,calc((100% - (var(--os-product-columns, 3) - 1)*24px)/var(--os-product-columns, 3))),1fr))",
  });
});

test("the lines and Shop all span the whole grid", () => {
  for (const id of ["empty", "unavailable", "shop-all"]) {
    const styles = localStyles(id);
    expect(styles.gridColumnStart, id).toBeDefined();
    expect(styles.gridColumnEnd, id).toBeDefined();
  }
});

test("Shop all goes to /shop by document, wearing OS Product Link; there is no cart link", () => {
  const shopAll = helpers.getInstance("shop-all");
  expect(shopAll.tag).toBe("a");
  expect(helpers.propOf(shopAll, "href")).toMatchObject({
    type: "string",
    value: "/shop",
  });
  expect(helpers.propOf(shopAll, "reloadDocument")).toMatchObject({
    type: "boolean",
    value: true,
  });
  expect(helpers.tokenIdsOf(shopAll)).toContain(
    helpers.tokenNamed("OS Product Link")?.id
  );
  expect(
    fragment.props.some(
      (prop) =>
        prop.name === "href" && JSON.stringify(prop.value).includes("/cart")
    )
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
    "OS Product Link",
  ]);
  expect(helpers.propOf(shopAll, showAttribute)).toBeUndefined();
});

test("bound as the insert binds it: four cards, only the empty line for none, only the unavailable line for a failed read", () => {
  const binds = insertBinds(6);
  const full = loaded(productsFixture);
  expect(evaluateWith(binds.list, full)).toEqual(productsFixture.data);
  expect(evaluateWith(binds.empty, full)).toBe(false);
  expect(evaluateWith(binds.unavailable, full)).toBe(false);
  expect(evaluateWith(binds.shopAll, full)).toBe(true);

  const none = loaded({ data: [] });
  expect(evaluateWith(binds.list, none)).toEqual([]);
  expect(evaluateWith(binds.empty, none)).toBe(true);
  expect(evaluateWith(binds.unavailable, none)).toBe(false);
  expect(evaluateWith(binds.shopAll, none)).toBe(false);

  const failed = loaded({ error: "unavailable" }, false);
  expect(evaluateWith(binds.list, failed)).toEqual([]);
  expect(evaluateWith(binds.empty, failed)).toBe(false);
  expect(evaluateWith(binds.unavailable, failed)).toBe(true);
  expect(evaluateWith(binds.shopAll, failed)).toBe(false);

  expect(evaluateWith(insertBinds(3).list, full)).toHaveLength(3);
});

test("the grid's description says what it lists", () => {
  expect(meta.description).toBe("Your shop's products");
});
