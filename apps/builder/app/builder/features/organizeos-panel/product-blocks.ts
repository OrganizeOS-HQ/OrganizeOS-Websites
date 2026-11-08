import { nanoid } from "nanoid";
import {
  type DataSource,
  type Instance,
  type Instances,
  type Prop,
  type Resource,
  type WebstudioData,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import {
  type ProductOption,
  parseProductsData,
} from "@organizeos/site-components/products-data";
import { isPresetId } from "~/shared/organizeos-preset-ids";
import { organizeosNamespace } from "./insert-organizeos-block";
import { loadCatalogRequest } from "./collection-schema";
import { updateWebstudioDataStaged } from "./staged-data";

/**
 * The Shop blocks' Settings rows (fork doc section 9): Show, on a Product
 * Grid, rewrites how many products its collection takes; Product, on a
 * Product Card, rewrites which product its own Resource reads. Neither is a
 * stored prop: each reads and writes only what the block's insert wrote
 * (insert-organizeos-block.ts), its own collection's `data` and its own
 * nanoid Resource, never the org's catalog.
 */

export const productGridComponent = `${organizeosNamespace}:ProductGrid`;
export const productCardComponent = `${organizeosNamespace}:ProductCard`;

export const showOptions = ["3", "4", "6", "8", "12", "All"] as const;
export type Show = (typeof showOptions)[number];

type BlockData = Pick<
  WebstudioData,
  "instances" | "props" | "dataSources" | "resources"
>;

type ResourceBinding = Extract<DataSource, { type: "resource" }>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The API base and the picked product of a products URL expression: the
 * literal `"<API base>/products"` (Newest, no id) or
 * `"<API base>/products?id=<uuid>"`, the UUID in any case and read
 * lower-cased. Undefined for anything else: another path, another or a
 * second parameter, an id that is not a UUID, an expression that is not a
 * literal.
 */
export const parseProductsUrl = (
  url: string
): undefined | { apiBase: string; id?: string } => {
  let value: unknown;
  try {
    value = JSON.parse(url);
  } catch {
    return;
  }
  if (typeof value !== "string") {
    return;
  }
  const match = /^(.+)\/products(?:\?id=([^&#=]*))?$/.exec(value);
  if (match === null || URL.canParse(match[1]) === false) {
    return;
  }
  const [, apiBase, id] = match;
  if (id === undefined) {
    return { apiBase };
  }
  return uuidPattern.test(id) ? { apiBase, id: id.toLowerCase() } : undefined;
};

/** The products URL expression for Newest, or for a product, lower-cased. */
export const buildProductsUrl = (apiBase: string, id?: string) =>
  JSON.stringify(
    `${apiBase}/products${id === undefined ? "" : `?id=${id.toLowerCase()}`}`
  );

/** The collection's `data` expression for a Show value. */
export const showExpression = (variable: string, show: Show) =>
  `(${variable}.ok === true ? ${variable}.data.data${
    show === "All" ? "" : `.slice(0, ${show})`
  } : [])`;

const findCollection = (rootId: Instance["id"], instances: Instances) => {
  for (const child of instances.get(rootId)?.children ?? []) {
    const instance =
      child.type === "id" ? instances.get(child.value) : undefined;
    if (instance?.component === "ws:collection") {
      return instance;
    }
  }
};

/**
 * A Shop block's root, its own resource binding (scoped to the root, of a
 * Resource whose URL is a products URL) and that Resource, and its
 * collection. The grid's binding reads the list (no id); undefined when the
 * root is not a Shop block or its binding was removed or rewritten.
 */
export const findProductBlock = (rootId: Instance["id"], data: BlockData) => {
  const root = data.instances.get(rootId);
  if (
    root?.component !== productGridComponent &&
    root?.component !== productCardComponent
  ) {
    return;
  }
  for (const dataSource of data.dataSources.values()) {
    if (
      dataSource.type !== "resource" ||
      dataSource.scopeInstanceId !== rootId
    ) {
      continue;
    }
    const resource = data.resources.get(dataSource.resourceId);
    const url =
      resource === undefined ? undefined : parseProductsUrl(resource.url);
    if (resource === undefined || url === undefined) {
      continue;
    }
    if (root.component === productGridComponent && url.id !== undefined) {
      continue;
    }
    return {
      root,
      binding: dataSource as ResourceBinding,
      resource,
      url,
      collection: findCollection(rootId, data.instances),
    };
  }
};

const findDataProp = (
  instanceId: Instance["id"],
  props: BlockData["props"]
) => {
  for (const prop of props.values()) {
    if (prop.instanceId === instanceId && prop.name === "data") {
      return prop;
    }
  }
};

/**
 * The Show value of a Product Grid: the collection's `data` in one of the
 * forms the insert and the row write for the root's own binding, or
 * undefined for any other expression.
 */
export const readShow = (
  rootId: Instance["id"],
  data: BlockData
): undefined | Show => {
  const block = findProductBlock(rootId, data);
  if (block?.collection === undefined) {
    return;
  }
  const prop = findDataProp(block.collection.id, data.props);
  if (prop?.type !== "expression") {
    return;
  }
  const variable = encodeDataSourceVariable(block.binding.id);
  return showOptions.find(
    (show) => showExpression(variable, show) === prop.value
  );
};

/** Write a Show value: one transaction, one undo step. */
export const writeShow = (rootId: Instance["id"], show: Show) =>
  updateWebstudioDataStaged((data) => {
    const block = findProductBlock(rootId, data);
    if (block?.collection === undefined) {
      return false;
    }
    const value = showExpression(
      encodeDataSourceVariable(block.binding.id),
      show
    );
    const prop = findDataProp(block.collection.id, data.props);
    if (prop !== undefined) {
      data.props.set(prop.id, {
        id: prop.id,
        instanceId: prop.instanceId,
        name: prop.name,
        type: "expression",
        value,
      } satisfies Prop);
    } else {
      const id = nanoid();
      data.props.set(id, {
        id,
        instanceId: block.collection.id,
        name: "data",
        type: "expression",
        value,
      });
    }
    return true;
  });

/**
 * The product a Product Card reads: Newest, a product's id (lower-cased), or
 * undefined when its own Resource's URL is in neither form.
 */
export const readCardProduct = (
  rootId: Instance["id"],
  data: BlockData
): undefined | { kind: "newest" } | { kind: "product"; id: string } => {
  const block = findProductBlock(rootId, data);
  if (block === undefined || block.root.component !== productCardComponent) {
    return;
  }
  return block.url.id === undefined
    ? { kind: "newest" }
    : { kind: "product", id: block.url.id };
};

/**
 * Point a Product Card at Newest (no id) or a product: rewrites the URL of
 * the card's own Resource, never a catalog one. One transaction, one undo
 * step.
 */
export const writeCardProduct = (rootId: Instance["id"], id?: string) =>
  updateWebstudioDataStaged((data) => {
    const block = findProductBlock(rootId, data);
    if (
      block === undefined ||
      block.root.component !== productCardComponent ||
      isPresetId(block.resource.id)
    ) {
      return false;
    }
    const url = buildProductsUrl(block.url.apiBase, id);
    if (url !== block.resource.url) {
      data.resources.set(block.resource.id, { ...block.resource, url });
    }
    return true;
  });

export type ProductRowOption = {
  /** "newest", or a product's id. */
  value: string;
  label: string;
};

export const newestOption: ProductRowOption = {
  value: "newest",
  label: "Newest",
};

/**
 * The Product row's options: Newest, then the org's products in list order
 * (a blank title already reads "Untitled product"); a picked id the list
 * does not hold is listed first, as "Unavailable product".
 */
export const getProductOptions = (
  products: readonly ProductOption[],
  picked?: string
): ProductRowOption[] => {
  const options = [
    newestOption,
    ...products.map((product) => ({ value: product.id, label: product.title })),
  ];
  if (
    picked !== undefined &&
    products.some((product) => product.id === picked) === false
  ) {
    options.unshift({ value: picked, label: "Unavailable product" });
  }
  return options;
};

/** How long the Product row waits for the products list. */
export const productsLoadTimeout = 3000;

const authorizationOf = (resource: Resource) =>
  resource.headers.find(
    (header) => header.name.toLowerCase() === "authorization"
  )?.value;

/**
 * The org's products, read live with the card's own Resource's
 * `Authorization` (`GET <API base>/products`), or undefined when the read
 * fails or takes longer than `productsLoadTimeout`.
 */
export const loadCardProducts = async (
  rootId: Instance["id"],
  data: BlockData
): Promise<undefined | ProductOption[]> => {
  const block = findProductBlock(rootId, data);
  const authorization =
    block === undefined ? undefined : authorizationOf(block.resource);
  if (block === undefined || authorization === undefined) {
    return;
  }
  let timer: undefined | ReturnType<typeof setTimeout>;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), productsLoadTimeout);
  });
  try {
    const loaded = await Promise.race([
      loadCatalogRequest(
        { resource: block.resource, apiBase: block.url.apiBase, authorization },
        { url: `${block.url.apiBase}/products` }
      ),
      timeout,
    ]);
    if (loaded?.ok !== true) {
      return;
    }
    return parseProductsData(loaded.data);
  } finally {
    clearTimeout(timer);
  }
};
