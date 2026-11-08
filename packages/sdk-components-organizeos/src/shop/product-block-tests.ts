import { describe, expect, test } from "vitest";
import {
  type Instance,
  type Prop,
  type WebstudioFragment,
  encodeDataSourceVariable,
  executeExpression,
} from "@webstudio-is/sdk";
import { showAttribute } from "@webstudio-is/react-sdk";
import { renderTemplate, type TemplateMeta } from "@webstudio-is/template";
import { urlExpressionMayRun } from "../org-script";
import products from "../__fixtures__/products.json";
import { eventsTemplate } from "../events/event-card.template";
import { formatPrice } from "./price";

// The checks the Product Grid and the Product Card templates share: each is
// its own root holding a collection of cards and the state lines, and the card
// is the same function of the collection's parameter in both.

/** What the resources loader hands a binding: `{ ok, data }`. */
export const loaded = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 503,
  statusText: "",
  data: body,
});

/** The expressions the insert binds (apps/builder insert-organizeos-block.ts). */
export const insertBinds = (count: undefined | number) => ({
  list: (v: string) =>
    `(${v}.ok === true ? ${v}.data.data${count === undefined ? "" : `.slice(0, ${count})`} : [])`,
  empty: (v: string) => `${v}.ok === true && ${v}.data.data.length === 0`,
  unavailable: (v: string) => `${v}.ok === false`,
  shopAll: (v: string) => `${v}.ok === true && ${v}.data.data.length > 0`,
});

/** Evaluate an expression with the binding's value in place of `$v`. */
export const evaluateWith = (
  expression: (v: string) => string,
  value: unknown
) =>
  executeExpression(expression("$v").replaceAll("$v", JSON.stringify(value)));

const fragmentHelpers = (fragment: WebstudioFragment) => {
  const instances = new Map(fragment.instances.map((item) => [item.id, item]));
  const getInstance = (id: string) => {
    const instance = instances.get(id);
    if (instance === undefined) {
      throw new Error(`no instance ${id}`);
    }
    return instance;
  };
  const propsOf = (instance: Instance) =>
    fragment.props.filter((prop) => prop.instanceId === instance.id);
  const propOf = (instance: Instance, name: string) =>
    propsOf(instance).find((prop) => prop.name === name);
  const byLabel = (label: string, within?: Instance) => {
    const found = fragment.instances.filter(
      (item) =>
        item.label === label &&
        (within === undefined || isInside(item.id, within.id))
    );
    if (found.length !== 1) {
      throw new Error(`${found.length} instances labelled ${label}`);
    }
    return found[0];
  };
  const isInside = (id: string, ancestorId: string): boolean => {
    if (id === ancestorId) {
      return true;
    }
    return fragment.instances.some(
      (parent) =>
        parent.children.some(
          (child) => child.type === "id" && child.value === id
        ) && isInside(parent.id, ancestorId)
    );
  };
  const childInstances = (instance: Instance) =>
    instance.children.flatMap((child) =>
      child.type === "id" ? [getInstance(child.value)] : []
    );
  const descendants = (instance: Instance): Instance[] =>
    childInstances(instance).flatMap((child) => [child, ...descendants(child)]);
  const tokenIdsOf = (instance: Instance) =>
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instance.id
    )?.values ?? [];
  const tokenNamed = (name: string) =>
    fragment.styleSources.find(
      (source) => source.type === "token" && source.name === name
    );
  return {
    getInstance,
    propsOf,
    propOf,
    byLabel,
    childInstances,
    descendants,
    tokenIdsOf,
    tokenNamed,
  };
};

const expressionOf = (prop: undefined | Prop) =>
  prop?.type === "expression" ? prop.value : undefined;

export const productsFixture = products;

export const describeProductBlock = ({
  meta,
  label,
  rootComponent,
  ids,
  lines,
}: {
  meta: TemplateMeta;
  label: string;
  rootComponent: string;
  /** The `ws:id`s the insert binds by, in the root's order. */
  ids: string[];
  /** The root's children's labels, in order. */
  lines: string[];
}) => {
  const fragment = renderTemplate(meta.template);
  const helpers = fragmentHelpers(fragment);
  const { propOf, byLabel, childInstances, descendants, getInstance } = helpers;
  const root = getInstance(fragment.children[0].value);
  const collection = getInstance(ids[0]);
  const card = childInstances(collection)[0];
  const [parameter] = fragment.dataSources;
  const variable = encodeDataSourceVariable(parameter.id);
  const overItem = (expression: string, item: unknown) =>
    executeExpression(
      expression.replaceAll(variable, JSON.stringify(item))
    ) as unknown;

  describe(`the ${label} template`, () => {
    test("is hidden from the Components panel, with its label and a description", () => {
      expect(meta.category).toBe("hidden");
      expect(meta.label).toBe(label);
      expect(meta.description).toBeTruthy();
      expect(meta.icon).toBeDefined();
    });

    test("is its own root holding the collection and its lines, with the ids the insert binds by", () => {
      expect(root.component).toBe(
        `@organizeos/site-components:${rootComponent}`
      );
      expect(root.label).toBe(label);
      expect(childInstances(root).map((child) => child.label)).toEqual(lines);
      expect(childInstances(root).map((child) => child.id)).toEqual(ids);
      expect(collection.component).toBe("ws:collection");
      expect(fragment.dataSources).toEqual([
        {
          type: "parameter",
          id: parameter.id,
          scopeInstanceId: collection.id,
          name: "product",
        },
      ]);
      expect(childInstances(collection)).toEqual([card]);
      // unbound until the insert binds them
      for (const id of ids.slice(1)) {
        expect(propOf(getInstance(id), showAttribute), id).toBeUndefined();
      }
      expect(propOf(collection, "data")).toBeUndefined();
    });

    test("nothing inside the card has a ws:id", () => {
      const generated = [card, ...descendants(card)];
      for (const instance of generated) {
        expect(ids.includes(instance.id), instance.label).toBe(false);
        expect(instance.id).not.toMatch(/^[a-z-]+$/);
      }
    });

    test("the card is a link to /shop/{slug} by document, a fixed start that publishes while org script is paused", () => {
      expect(card.tag).toBe("a");
      expect(card.label).toBe("Product");
      const href = expressionOf(propOf(card, "href"));
      expect(href).toBe(`"/shop/" + ${variable}.slug`);
      expect(urlExpressionMayRun(href as string, false)).toBe(true);
      expect(propOf(card, "reloadDocument")).toMatchObject({
        type: "boolean",
        value: true,
      });
      expect(childInstances(card).map((child) => child.label)).toEqual([
        "Image",
        "Title",
        "Price",
      ]);
    });

    test("the image, the title, From and the amount read the product", () => {
      const image = byLabel("Image");
      expect(image.component).toBe("Image");
      expect(expressionOf(propOf(image, "src"))).toBe(`${variable}.image_url`);
      expect(expressionOf(propOf(image, "alt"))).toBe(`${variable}.title`);
      expect(expressionOf(propOf(image, showAttribute))).toBe(
        `(${variable}.image_url ?? "") !== ""`
      );
      const title = byLabel("Title");
      expect(title.tag).toBe("h3");
      expect(title.children).toEqual([
        { type: "expression", value: `${variable}.title`, mode: "read" },
      ]);
      const price = byLabel("Price");
      expect(price.tag).toBe("p");
      const [from, amount] = childInstances(price);
      expect(from.tag).toBe("span");
      expect(from.label).toBe("From");
      expect(from.children).toEqual([
        { type: "text", value: "From", placeholder: true },
      ]);
      expect(expressionOf(propOf(from, showAttribute))).toBe(
        `${variable}.price_varies === true`
      );
      expect(amount.component).toBe("@organizeos/site-components:Price");
      expect(expressionOf(propOf(amount, "cents"))).toBe(
        `${variable}.price_from_cents`
      );
      expect(expressionOf(propOf(amount, "currency"))).toBe(
        `${variable}.currency`
      );
    });

    test("the card wears OS Card and the product tokens; OS Card is the events cards' own", () => {
      const cardSource = helpers.tokenNamed("OS Card");
      expect(helpers.tokenIdsOf(card)).toContain(cardSource?.id);
      for (const [instance, name] of [
        [byLabel("Image"), "OS Product Image"],
        [byLabel("Title"), "OS Product Title"],
        [byLabel("Price"), "OS Product Price"],
      ] as const) {
        expect(helpers.tokenIdsOf(instance), name).toContain(
          helpers.tokenNamed(name)?.id
        );
      }
      // OS Card's declarations are unchanged: the same as the Event List's
      const events = renderTemplate(eventsTemplate({ label: "Event List" }));
      const declarations = (fragment: WebstudioFragment) => {
        const id = fragment.styleSources.find(
          (source) => source.type === "token" && source.name === "OS Card"
        )?.id;
        return fragment.styles
          .filter((style) => style.styleSourceId === id)
          .map(({ styleSourceId: _id, ...style }) => style);
      };
      expect(declarations(fragment)).toEqual(declarations(events));
      expect(fragment.referenceTokenIds).toBeUndefined();
    });

    test("the lines wear OS Product Note, which declares nothing", () => {
      const note = helpers.tokenNamed("OS Product Note");
      for (const id of ids.slice(1).filter((id) => id !== "shop-all")) {
        expect(helpers.tokenIdsOf(getInstance(id)), id).toContain(note?.id);
      }
      expect(
        fragment.styles.some((style) => style.styleSourceId === note?.id)
      ).toBe(false);
    });

    test("over products.json each card links its slug, shows From on the T-shirt only, no image on the mug, and its price", () => {
      const href = expressionOf(propOf(card, "href")) as string;
      const imageShow = expressionOf(
        propOf(byLabel("Image"), showAttribute)
      ) as string;
      const fromShow = expressionOf(
        propOf(byLabel("From"), showAttribute)
      ) as string;
      const amount = childInstances(byLabel("Price"))[1];
      const cents = expressionOf(propOf(amount, "cents")) as string;
      const currency = expressionOf(propOf(amount, "currency")) as string;
      const rendered = products.data.map((item) => ({
        href: overItem(href, item),
        image: overItem(imageShow, item),
        from: overItem(fromShow, item),
        price: formatPrice(overItem(cents, item), overItem(currency, item)),
      }));
      expect(rendered).toEqual([
        {
          href: "/shop/organizer-t-shirt",
          image: true,
          from: true,
          price: "$18.00",
        },
        {
          href: "/shop/campaign-mug",
          image: false,
          from: false,
          price: "$12.00",
        },
        {
          href: "/shop/canvas-tote-bag",
          image: true,
          from: false,
          price: "$19.99",
        },
        { href: "/shop/sticker-2", image: true, from: false, price: "$0.00" },
      ]);
      // a bare `!== null` would show an image for a missing key
      expect(overItem(imageShow, {})).toBe(false);
      expect(overItem(fromShow, {})).toBe(false);
    });
  });

  return { fragment, root, collection, card, parameter, helpers };
};
