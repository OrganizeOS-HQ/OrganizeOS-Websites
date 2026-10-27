import { nanoid } from "nanoid";
import { showAttribute } from "@webstudio-is/react-sdk";
import {
  type DataSource,
  type Instance,
  type Page,
  type Pages,
  type Prop,
  type Resource,
  type StyleDecl,
  type WebstudioData,
  ROOT_FOLDER_ID,
  SYSTEM_VARIABLE_ID,
  elementComponent,
  encodeDataVariableId,
  getAllPages,
  getPagePath,
  getStyleDeclKey,
  collectionComponent,
} from "@webstudio-is/sdk";
import { sitemapResourceUrl } from "@webstudio-is/sdk/runtime";
import { renderTemplate } from "@webstudio-is/template";
import { RichText } from "@organizeos/site-components/templates";
import { findAvailableVariables } from "~/shared/data-variables";
import {
  getWebstudioData,
  updateWebstudioData,
} from "~/shared/instance-utils/data";
import { selectInstance, selectPage } from "~/shared/nano-states";
import { $pages } from "~/shared/sync/data-stores";
import { registerFolderChildMutable } from "~/builder/features/pages/page-utils";
import { type CollectionField, pickRoles } from "./collection-layout";
import {
  type CollectionCatalog,
  type CollectionSchema,
  findCollectionCatalog,
  loadCollectionError,
  loadCollectionSchema,
  loadFirstItemSlug,
} from "./collection-schema";

/**
 * Create item page (OrganizeOS design `2026-10-27-cms-page-templates-design.md`
 * sections 2.2 and 3.2 to 3.6): one click makes the collection's item page,
 * "{Collection} template" at `/{slug}/:slug`, with its own Resource, a starter
 * layout built from the collection's fields and page meta bound to the item.
 *
 * Upstream's `createPage` is private (`page-settings.tsx`), so its few lines
 * are repeated here with the exported upstream parts, and every meta field is
 * set inline. Everything goes into one `updateWebstudioData` transaction, so
 * the builder's undo removes it in one step.
 */

/** The rule for a collection slug, the one provisioning validates against. */
const COLLECTION_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The item page's path pattern. */
export const getItemPagePath = (slug: string) => `/${slug}/:slug`;

/**
 * The collection's item page: the page whose full path, its folders included,
 * is `/{slug}/:slug`, whoever made it. Detection is by path alone (design 2.1).
 */
export const findCollectionItemPage = (
  slug: string,
  pages: undefined | Pages = $pages.get()
): undefined | Page => {
  if (pages === undefined) {
    return;
  }
  const path = getItemPagePath(slug);
  return getAllPages(pages).find(
    (page) => getPagePath(page.id, pages) === path
  );
};

const system = encodeDataVariableId(SYSTEM_VARIABLE_ID);

/**
 * The item page's expressions over its Resource's variable (an encoded data
 * variable id), exported so a test runs every one through the validator.
 *
 * found is true only for a non-empty `slug` param whose answer is this item:
 * on the canvas with no history the param is undefined, and a malformed param
 * normalises to another URL whose answer must not count.
 */
export const getItemPageExpressions = ({
  variable,
  fields,
}: {
  variable: string;
  fields: CollectionField[];
}) => {
  const roles = pickRoles(fields);
  const item = `${variable}.data.data`;
  const found = `(${system}.params.slug ?? "") !== "" && ${variable}?.ok === true && ${item}.slug === ${system}.params.slug`;
  const field = (target: CollectionField) => `${item}.fields.${target.key}`;
  const descriptionSource =
    roles.summary !== undefined
      ? field(roles.summary)
      : roles.body !== undefined
        ? `${field(roles.body)}.text`
        : undefined;
  return {
    item,
    found,
    title: `(${found}) ? ${item}.name : "Page not found"`,
    status: `(${found}) ? 200 : 404`,
    description:
      descriptionSource === undefined
        ? `""`
        : `(${found}) ? (${descriptionSource} ?? "").slice(0, 160) : ""`,
    socialImageUrl:
      roles.image === undefined
        ? `""`
        : `(${found}) ? (${field(roles.image)}.url ?? "") : ""`,
    excludePageFromSearch: "false",
  };
};

/** The item page Resource's url: the item's address, `-` with no param. */
export const getItemResourceUrl = (apiBase: string, slug: string) =>
  `${JSON.stringify(`${apiBase}/collections/${encodeURIComponent(slug)}/items/`)} + (${system}.params.slug ?? "-")`;

/** A name no variable visible at `instanceId` has: "Name", "Name 2", ... */
export const getFreeVariableName = (
  data: Pick<WebstudioData, "instances" | "dataSources">,
  instanceId: Instance["id"],
  name: string
) => {
  const taken = new Set(
    findAvailableVariables({
      startingInstanceId: instanceId,
      instances: data.instances,
      dataSources: data.dataSources,
    }).map((variable) => variable.name)
  );
  let free = name;
  for (let suffix = 2; taken.has(free); suffix += 1) {
    free = `${name} ${suffix}`;
  }
  return free;
};

type Child = Instance["children"][number];

/** Small writers over a transaction's data, with fresh ids. */
export const createInstanceWriter = (data: WebstudioData) => {
  const addInstance = (
    instance: Omit<Instance, "type" | "id" | "children"> & {
      children?: Child[];
    }
  ) => {
    const id = nanoid();
    data.instances.set(id, {
      type: "instance",
      id,
      children: [],
      ...instance,
    });
    return id;
  };
  const appendChild = (parentId: Instance["id"], child: Child) => {
    data.instances.get(parentId)?.children.push(child);
  };
  const addChild = (
    parentId: Instance["id"],
    instance: Parameters<typeof addInstance>[0]
  ) => {
    const id = addInstance(instance);
    appendChild(parentId, { type: "id", value: id });
    return id;
  };
  const addProp = (prop: Omit<Prop, "id">) => {
    const id = nanoid();
    data.props.set(id, { ...prop, id } as Prop);
  };
  const addExpressionProp = (
    instanceId: Instance["id"],
    name: string,
    value: string
  ) => addProp({ instanceId, name, type: "expression", value });
  const addStringProp = (
    instanceId: Instance["id"],
    name: string,
    value: string
  ) => addProp({ instanceId, name, type: "string", value });
  /** Local styles on the base breakpoint; none when there is no base. */
  const addLocalStyles = (
    instanceId: Instance["id"],
    styles: Array<Pick<StyleDecl, "property" | "value">>
  ) => {
    const base = Array.from(data.breakpoints.values()).find(
      (breakpoint) =>
        breakpoint.minWidth === undefined &&
        breakpoint.maxWidth === undefined &&
        breakpoint.condition === undefined
    );
    if (base === undefined) {
      return;
    }
    const styleSourceId = nanoid();
    data.styleSources.set(styleSourceId, { type: "local", id: styleSourceId });
    data.styleSourceSelections.set(instanceId, {
      instanceId,
      values: [styleSourceId],
    });
    for (const style of styles) {
      const decl: StyleDecl = {
        styleSourceId,
        breakpointId: base.id,
        property: style.property,
        value: style.value,
      };
      data.styles.set(getStyleDeclKey(decl), decl);
    }
  };
  return {
    addInstance,
    addChild,
    appendChild,
    addProp,
    addExpressionProp,
    addStringProp,
    addLocalStyles,
  };
};

const px = (value: number) => ({
  type: "unit" as const,
  unit: "px" as const,
  value,
});
const auto = { type: "keyword" as const, value: "auto" };

/**
 * The OrganizeOS Rich Text block with its descendants, as its template makes
 * it, under `parentId`, with `value` bound. Returns the block's id.
 */
const addRichTextMutable = (
  data: WebstudioData,
  parentId: Instance["id"],
  label: string,
  value: string
) => {
  const fragment = renderTemplate(RichText.template, nanoid);
  const root = fragment.instances.find(
    (instance) => instance.component === "@organizeos/site-components:RichText"
  );
  if (root === undefined) {
    return;
  }
  for (const instance of fragment.instances) {
    data.instances.set(
      instance.id,
      instance.id === root.id ? { ...instance, label } : instance
    );
  }
  for (const prop of fragment.props) {
    data.props.set(prop.id, prop);
  }
  data.instances.get(parentId)?.children.push({ type: "id", value: root.id });
  const writer = createInstanceWriter(data);
  writer.addExpressionProp(root.id, "value", value);
  return root.id;
};

/**
 * The starter layout (design 3.3) inside `bodyId`: a centred box of max width
 * 720 px holding the item, shown when found, and a "not found" box shown
 * otherwise.
 */
const addItemLayoutMutable = (
  data: WebstudioData,
  {
    bodyId,
    schema,
    expressions,
  }: {
    bodyId: Instance["id"];
    schema: CollectionSchema;
    expressions: ReturnType<typeof getItemPageExpressions>;
  }
) => {
  const writer = createInstanceWriter(data);
  const { item, found } = expressions;
  const roles = pickRoles(schema.fields);
  const field = (target: CollectionField) => `${item}.fields.${target.key}`;
  const nonEmpty = (value: string) => `(${value} ?? "") !== ""`;

  const containerId = writer.addChild(bodyId, {
    component: elementComponent,
    tag: "div",
    label: schema.singularName,
  });
  writer.addLocalStyles(containerId, [
    { property: "maxWidth", value: px(720) },
    { property: "marginLeft", value: auto },
    { property: "marginRight", value: auto },
    { property: "paddingLeft", value: px(16) },
    { property: "paddingRight", value: px(16) },
  ]);

  const articleId = writer.addChild(containerId, {
    component: elementComponent,
    tag: "article",
    label: "Item",
  });
  writer.addExpressionProp(articleId, showAttribute, found);

  writer.addChild(articleId, {
    component: elementComponent,
    tag: "h1",
    label: roles.title?.label ?? "Title",
    children: [{ type: "expression", value: `${item}.name` }],
  });

  const dateValue =
    roles.date === "publishedAt" ? `${item}.publishedAt` : field(roles.date);
  const timeId = writer.addChild(articleId, {
    component: "Time",
    label: roles.date === "publishedAt" ? "Published" : roles.date.label,
  });
  writer.addExpressionProp(timeId, "datetime", dateValue);
  if (roles.date !== "publishedAt") {
    writer.addExpressionProp(timeId, showAttribute, nonEmpty(dateValue));
  }

  if (roles.image !== undefined) {
    const imageId = writer.addChild(articleId, {
      component: "Image",
      label: roles.image.label,
    });
    writer.addExpressionProp(imageId, "src", `${field(roles.image)}.url`);
    writer.addExpressionProp(imageId, "alt", `${field(roles.image)}.alt`);
    writer.addExpressionProp(
      imageId,
      showAttribute,
      nonEmpty(`${field(roles.image)}.url`)
    );
  }

  if (roles.body !== undefined) {
    addRichTextMutable(
      data,
      articleId,
      roles.body.label,
      `${field(roles.body)}.nodes`
    );
  }

  if (roles.summary !== undefined) {
    writer.addChild(articleId, {
      component: elementComponent,
      tag: "p",
      label: roles.summary.label,
      children: [{ type: "expression", value: field(roles.summary) }],
    });
  }

  for (const { field: target, kind } of roles.rest) {
    if (kind === "link") {
      const linkId = writer.addChild(articleId, {
        component: elementComponent,
        tag: "a",
        label: target.label,
        children: [{ type: "expression", value: field(target) }],
      });
      writer.addExpressionProp(linkId, "href", field(target));
      writer.addExpressionProp(linkId, showAttribute, nonEmpty(field(target)));
      continue;
    }
    writer.addChild(articleId, {
      component: elementComponent,
      tag: "p",
      label: target.label,
      children: [
        {
          type: "expression",
          value: kind === "option" ? `${field(target)}.label` : field(target),
        },
      ],
    });
  }

  for (const target of roles.references) {
    writer.addChild(articleId, {
      component: elementComponent,
      tag: "p",
      label: target.label,
      children: [{ type: "expression", value: `${field(target)}.name` }],
    });
  }

  const notFoundId = writer.addChild(containerId, {
    component: elementComponent,
    tag: "div",
    label: "Not found",
  });
  writer.addExpressionProp(notFoundId, showAttribute, `!(${found})`);
  writer.addChild(notFoundId, {
    component: elementComponent,
    tag: "h1",
    children: [{ type: "text", value: "Page not found" }],
  });
};

export type ItemPageInput = {
  pageId: Page["id"];
  schema: CollectionSchema;
  catalog: Pick<CollectionCatalog, "apiBase" | "authorization">;
  /** The first item's slug, for the canvas address; none with no items. */
  firstItemSlug?: string;
};

/**
 * Write the item page into a transaction's data: the page at the root of the
 * Pages tree, its body, its Resource and binding, its layout and its meta.
 */
export const createItemPageMutable = (
  data: WebstudioData,
  { pageId, schema, catalog, firstItemSlug }: ItemPageInput
) => {
  const { slug } = schema;
  const writer = createInstanceWriter(data);
  const bodyId = writer.addInstance({
    component: elementComponent,
    tag: "body",
  });

  const resource: Resource = {
    id: nanoid(),
    name: `Current ${schema.singularName}`,
    method: "get",
    url: getItemResourceUrl(catalog.apiBase, slug),
    headers: [{ name: "Authorization", value: catalog.authorization }],
  };
  const binding: DataSource = {
    type: "resource",
    id: nanoid(),
    scopeInstanceId: bodyId,
    name: getFreeVariableName(data, bodyId, resource.name),
    resourceId: resource.id,
  };
  data.resources.set(resource.id, resource);
  data.dataSources.set(binding.id, binding);

  const expressions = getItemPageExpressions({
    variable: encodeDataVariableId(binding.id),
    fields: schema.fields,
  });
  data.pages.pages.set(pageId, {
    id: pageId,
    name: `${schema.name} template`,
    path: getItemPagePath(slug),
    title: expressions.title,
    rootInstanceId: bodyId,
    ...(firstItemSlug === undefined
      ? {}
      : { history: [`/${slug}/${firstItemSlug}`] }),
    meta: {
      status: expressions.status,
      description: expressions.description,
      socialImageUrl: expressions.socialImageUrl,
      excludePageFromSearch: expressions.excludePageFromSearch,
    },
  });
  registerFolderChildMutable(data.pages, pageId, ROOT_FOLDER_ID);
  addItemLayoutMutable(data, { bodyId, schema, expressions });
};

export type CreateItemPageResult =
  | { pageId: Page["id"]; created: boolean }
  | { error: string };

/**
 * The sitemap page (design 3.7): the first Create item page makes a page at
 * `/sitemap.xml`, an XML document listing the site's static pages, from
 * upstream's Sitemap system Resource, and the items of every collection that
 * has an item page, each from its `/slugs` Resource. Its root XmlNode carries
 * the marker prop, which XmlNode drops in both renderers, so the marker lives
 * in the build and never reaches the XML. Later item pages add their
 * collection only to a page carrying the marker: a hand-made `/sitemap.xml` is
 * never edited. Its Resources are scoped to the page's root, so they go with
 * the page.
 */

export const SITEMAP_PATH = "/sitemap.xml";

/** The prop on the generated sitemap's root XmlNode. */
export const SITEMAP_MARKER = "data-organizeos-sitemap";

/** The page whose full path is `/sitemap.xml`, whoever made it. */
export const findSitemapPage = (
  pages: undefined | Pages = $pages.get()
): undefined | Page => {
  if (pages === undefined) {
    return;
  }
  return getAllPages(pages).find(
    (page) => getPagePath(page.id, pages) === SITEMAP_PATH
  );
};

/**
 * The generated sitemap's root XmlNode: the first child of the page's body,
 * when it carries the marker. Undefined for a hand-made sitemap.
 */
const findMarkedSitemapRoot = (
  data: Pick<WebstudioData, "instances" | "props">,
  page: Page
) => {
  const first = data.instances.get(page.rootInstanceId)?.children[0];
  if (first?.type !== "id") {
    return;
  }
  const root = data.instances.get(first.value);
  if (root?.component !== "XmlNode") {
    return;
  }
  for (const prop of data.props.values()) {
    if (
      prop.instanceId === root.id &&
      prop.name === SITEMAP_MARKER &&
      prop.type === "boolean" &&
      prop.value === true
    ) {
      return root;
    }
  }
};

/** A collection's `/slugs` Resource url, a literal. */
export const getSlugsResourceUrl = (apiBase: string, slug: string) =>
  JSON.stringify(`${apiBase}/collections/${encodeURIComponent(slug)}/slugs`);

/** The slug a `/slugs` Resource url names, or undefined for any other url. */
export const parseSlugsResourceUrl = (url: string): undefined | string => {
  let value: unknown;
  try {
    value = JSON.parse(url);
  } catch {
    return;
  }
  if (typeof value !== "string") {
    return;
  }
  const match = /\/collections\/([^/]+)\/slugs$/.exec(value);
  if (match === null) {
    return;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return;
  }
};

/**
 * The parts of the generated sitemap, one per collection: the binding of its
 * `/slugs` Resource, scoped to the page root, and the `ws:collection` under
 * the root XmlNode whose `data` reads it.
 */
const findSitemapParts = (
  data: Pick<
    WebstudioData,
    "instances" | "props" | "dataSources" | "resources"
  >,
  page: Page,
  root: Instance
) => {
  const parts: Array<{
    slug: string;
    binding: DataSource;
    collectionId?: Instance["id"];
  }> = [];
  for (const binding of data.dataSources.values()) {
    if (
      binding.type !== "resource" ||
      binding.scopeInstanceId !== page.rootInstanceId
    ) {
      continue;
    }
    const resource = data.resources.get(binding.resourceId);
    const slug =
      resource === undefined ? undefined : parseSlugsResourceUrl(resource.url);
    if (slug === undefined) {
      continue;
    }
    const variable = encodeDataVariableId(binding.id);
    const collectionId = root.children.find((child) => {
      if (child.type !== "id") {
        return false;
      }
      for (const prop of data.props.values()) {
        if (
          prop.instanceId === child.value &&
          prop.name === "data" &&
          prop.type === "expression" &&
          prop.value.includes(variable)
        ) {
          return true;
        }
      }
      return false;
    })?.value;
    parts.push({ slug, binding, collectionId });
  }
  return parts;
};

/**
 * The collections the generated sitemap lists, in its order of bindings.
 * Empty with no sitemap, or a hand-made one.
 */
export const listSitemapCollections = (
  data: Pick<
    WebstudioData,
    "pages" | "instances" | "props" | "dataSources" | "resources"
  > = getWebstudioData()
): string[] => {
  const page = findSitemapPage(data.pages);
  const root = page && findMarkedSitemapRoot(data, page);
  if (page === undefined || root === undefined) {
    return [];
  }
  return findSitemapParts(data, page, root).map(({ slug }) => slug);
};

/** A `ws:collection` over `data` under `parentId`, with its item parameter. */
const addXmlCollectionMutable = (
  data: WebstudioData,
  {
    parentId,
    label,
    list,
    loc,
    lastmod,
  }: {
    parentId: Instance["id"];
    label: string;
    list: string;
    /** given the item variable */
    loc: (item: string) => string;
    lastmod: (item: string) => string;
  }
) => {
  const writer = createInstanceWriter(data);
  const collectionId = writer.addChild(parentId, {
    component: collectionComponent,
    label,
  });
  const parameter: DataSource = {
    type: "parameter",
    id: nanoid(),
    scopeInstanceId: collectionId,
    name: "item",
  };
  data.dataSources.set(parameter.id, parameter);
  writer.addExpressionProp(collectionId, "data", list);
  writer.addProp({
    instanceId: collectionId,
    name: "item",
    type: "parameter",
    value: parameter.id,
  });
  const item = encodeDataVariableId(parameter.id);
  const urlId = writer.addChild(collectionId, { component: "XmlNode" });
  writer.addStringProp(urlId, "tag", "url");
  const locId = writer.addChild(urlId, {
    component: "XmlNode",
    children: [{ type: "expression", value: loc(item) }],
  });
  writer.addStringProp(locId, "tag", "loc");
  const lastmodId = writer.addChild(urlId, {
    component: "XmlNode",
    children: [{ type: "expression", value: lastmod(item) }],
  });
  writer.addStringProp(lastmodId, "tag", "lastmod");
  return collectionId;
};

/**
 * Create the sitemap page with its root XmlNode and its static part: upstream's
 * Sitemap system Resource, as the Resource panel offers it.
 */
const createSitemapPageMutable = (data: WebstudioData) => {
  const writer = createInstanceWriter(data);
  const bodyId = writer.addInstance({
    component: elementComponent,
    tag: "body",
  });
  const rootId = writer.addChild(bodyId, { component: "XmlNode" });
  writer.addStringProp(rootId, "tag", "urlset");
  writer.addStringProp(
    rootId,
    "xmlns",
    "http://www.sitemaps.org/schemas/sitemap/0.9"
  );
  writer.addProp({
    instanceId: rootId,
    name: SITEMAP_MARKER,
    type: "boolean",
    value: true,
  });
  const resource: Resource = {
    id: nanoid(),
    name: "Sitemap",
    control: "system",
    method: "get",
    url: JSON.stringify(sitemapResourceUrl),
    headers: [],
  };
  const binding: DataSource = {
    type: "resource",
    id: nanoid(),
    scopeInstanceId: bodyId,
    name: getFreeVariableName(data, bodyId, resource.name),
    resourceId: resource.id,
  };
  data.resources.set(resource.id, resource);
  data.dataSources.set(binding.id, binding);
  const pages = encodeDataVariableId(binding.id);
  addXmlCollectionMutable(data, {
    parentId: rootId,
    label: "Pages",
    list: `(${pages}.ok === true ? ${pages}.data : [])`,
    loc: (item) => `${system}.origin + ${item}.path`,
    lastmod: (item) => `${item}.lastModified`,
  });
  const pageId = nanoid();
  data.pages.pages.set(pageId, {
    id: pageId,
    name: "Sitemap",
    path: SITEMAP_PATH,
    title: JSON.stringify("Sitemap"),
    rootInstanceId: bodyId,
    meta: { documentType: "xml" },
  });
  registerFolderChildMutable(data.pages, pageId, ROOT_FOLDER_ID);
  return pageId;
};

/**
 * Add a collection's part to the sitemap in a transaction's data, creating
 * the sitemap page when the project has no page at `/sitemap.xml`. Returns
 * what it did: "created" the page, "added" the part, the part was already
 * "listed", or "skipped" a hand-made sitemap.
 */
export const addCollectionToSitemapMutable = (
  data: WebstudioData,
  {
    schema,
    catalog,
  }: {
    schema: Pick<CollectionSchema, "slug" | "name">;
    catalog: Pick<CollectionCatalog, "apiBase" | "authorization">;
  }
): "created" | "added" | "listed" | "skipped" => {
  let page = findSitemapPage(data.pages);
  let result: "created" | "added" = "added";
  if (page === undefined) {
    const pageId = createSitemapPageMutable(data);
    page = data.pages.pages.get(pageId) as Page;
    result = "created";
  }
  const root = findMarkedSitemapRoot(data, page);
  if (root === undefined) {
    return "skipped";
  }
  const { slug } = schema;
  if (findSitemapParts(data, page, root).some((part) => part.slug === slug)) {
    return "listed";
  }
  const resource: Resource = {
    id: nanoid(),
    name: `${schema.name} slugs`,
    method: "get",
    url: getSlugsResourceUrl(catalog.apiBase, slug),
    headers: [{ name: "Authorization", value: catalog.authorization }],
  };
  const binding: DataSource = {
    type: "resource",
    id: nanoid(),
    scopeInstanceId: page.rootInstanceId,
    name: getFreeVariableName(data, page.rootInstanceId, resource.name),
    resourceId: resource.id,
  };
  data.resources.set(resource.id, resource);
  data.dataSources.set(binding.id, binding);
  const slugs = encodeDataVariableId(binding.id);
  addXmlCollectionMutable(data, {
    parentId: root.id,
    label: schema.name,
    list: `(${slugs}.ok === true ? ${slugs}.data.data : [])`,
    loc: (item) =>
      `${system}.origin + ${JSON.stringify(`/${slug}/`)} + ${item}.slug`,
    lastmod: (item) => `${item}.updatedAt`,
  });
  return result;
};

/** Delete an instance's subtree with its props, scoped variables and styles. */
const deleteSubtreeMutable = (
  data: WebstudioData,
  parentId: Instance["id"],
  instanceId: Instance["id"]
) => {
  const parent = data.instances.get(parentId);
  if (parent !== undefined) {
    parent.children = parent.children.filter(
      (child) => child.type !== "id" || child.value !== instanceId
    );
  }
  const ids = new Set<Instance["id"]>();
  const visit = (id: Instance["id"]) => {
    const instance = data.instances.get(id);
    if (instance === undefined || ids.has(id)) {
      return;
    }
    ids.add(id);
    for (const child of instance.children) {
      if (child.type === "id") {
        visit(child.value);
      }
    }
  };
  visit(instanceId);
  for (const id of ids) {
    data.instances.delete(id);
    data.styleSourceSelections.delete(id);
  }
  for (const prop of data.props.values()) {
    if (ids.has(prop.instanceId)) {
      data.props.delete(prop.id);
    }
  }
  for (const dataSource of data.dataSources.values()) {
    if (ids.has(dataSource.scopeInstanceId ?? "")) {
      data.dataSources.delete(dataSource.id);
    }
  }
};

/**
 * Remove from sitemap: drop one collection's part from the generated sitemap,
 * its `ws:collection` and its `/slugs` Resource, in one transaction. Returns
 * whether it removed anything. A hand-made sitemap is never edited.
 */
export const removeCollectionFromSitemap = (slug: string) => {
  let removed = false;
  updateWebstudioData((data) => {
    const page = findSitemapPage(data.pages);
    const root = page && findMarkedSitemapRoot(data, page);
    if (page === undefined || root === undefined) {
      return;
    }
    for (const part of findSitemapParts(data, page, root)) {
      if (part.slug !== slug) {
        continue;
      }
      if (part.collectionId !== undefined) {
        deleteSubtreeMutable(data, root.id, part.collectionId);
      }
      data.dataSources.delete(part.binding.id);
      if (part.binding.type === "resource") {
        data.resources.delete(part.binding.resourceId);
      }
      removed = true;
    }
  });
  return removed;
};

/**
 * Create item page, from the data tab: reads the collection's schema and its
 * first item, then writes the page in one transaction and switches to it.
 * The same transaction creates the sitemap page, or adds the collection to
 * it (addCollectionToSitemapMutable).
 * When the collection already has an item page, that page is opened instead
 * and nothing is written (`created: false`). `{ error }` when the schema
 * cannot be read.
 */
export const createCollectionItemPage = async (
  slug: string
): Promise<CreateItemPageResult> => {
  if (COLLECTION_SLUG_RE.test(slug) === false) {
    return { error: loadCollectionError };
  }
  const existing = findCollectionItemPage(slug);
  if (existing !== undefined) {
    selectPage(existing.id);
    return { pageId: existing.id, created: false };
  }
  const catalog = await findCollectionCatalog(slug);
  if (catalog === undefined) {
    return { error: loadCollectionError };
  }
  const schema = await loadCollectionSchema(slug);
  if ("error" in schema) {
    return schema;
  }
  const firstItemSlug = await loadFirstItemSlug(catalog, slug);

  let pageId: undefined | Page["id"];
  let created = false;
  updateWebstudioData((data) => {
    // decided again inside the transaction: the reads above are async
    const inTransaction = findCollectionItemPage(slug, data.pages);
    if (inTransaction !== undefined) {
      pageId = inTransaction.id;
      return;
    }
    pageId = nanoid();
    createItemPageMutable(data, { pageId, schema, catalog, firstItemSlug });
    addCollectionToSitemapMutable(data, { schema, catalog });
    created = true;
    selectInstance(undefined);
  });
  if (pageId === undefined) {
    return { error: loadCollectionError };
  }
  selectPage(pageId);
  return { pageId, created };
};
