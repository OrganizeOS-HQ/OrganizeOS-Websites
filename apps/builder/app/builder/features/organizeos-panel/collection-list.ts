import { nanoid } from "nanoid";
import { showAttribute } from "@webstudio-is/react-sdk";
import {
  type DataSource,
  type Instance,
  type Resource,
  type StyleDecl,
  type WebstudioData,
  type WebstudioFragment,
  collectionComponent,
  elementComponent,
  encodeDataVariableId,
  getStyleDeclKey,
} from "@webstudio-is/sdk";
import {
  hyphenateProperty,
  type StyleProperty,
} from "@webstudio-is/css-engine";
import { parseCssValue } from "@webstudio-is/css-data";
import { insertWebstudioFragmentAt } from "~/shared/instance-utils/insert";
import { findSummaryField, pickRoles } from "./collection-layout";
import {
  type CollectionCatalog,
  type CollectionSchema,
  findCollectionCatalog,
  loadCollectionError,
  loadCollectionSchema,
} from "./collection-schema";
import { createInstanceWriter, getFreeVariableName } from "./collection-pages";

/**
 * Add list (OrganizeOS design `2026-10-27-cms-page-templates-design.md`
 * sections 2.3 and 3.5): a collection's items as a block of ordinary
 * instances, inserted at the selection, else at the end of the page, in one
 * transaction. The block brings its own Resource, "{Collection} list", scoped
 * to the block's root, whose sort, count and card fields are Resource search
 * params a designer changes later in the Resource panel. Its parts follow the
 * Event List's: a `ws:collection` read only when the Resource answered, a box
 * for an empty answer and one for a failed read.
 */

export type ListLayout = "grid" | "list";
export type ListSort = "newest" | "oldest" | "az" | "manual";
export type ListCount = 3 | 6 | 9 | 12 | "all";

export type CollectionListOptions = {
  slug: string;
  layout: ListLayout;
  sort: ListSort;
  count: ListCount;
  /** Wrap each card in a Link to the collection's item page. */
  link: boolean;
};

/** The `/v1` sort each choice sends (`collections-query.ts`). */
const sortParams: Record<ListSort, string> = {
  newest: "-publishedAt",
  oldest: "publishedAt",
  // the API's title sort
  az: "name",
  manual: "sortOrder",
};

/**
 * The list Resource's search params, each an expression: the sort, the limit
 * (none for All, so the API's default applies), and the card's field keys
 * (none when the card reads no field: the system keys `name`, `slug` and
 * `publishedAt` come back regardless).
 */
export const getListSearchParams = ({
  sort,
  count,
  fieldKeys,
}: {
  sort: ListSort;
  count: ListCount;
  fieldKeys: string[];
}): NonNullable<Resource["searchParams"]> => [
  { name: "sort", value: JSON.stringify(sortParams[sort]) },
  ...(count === "all"
    ? []
    : [{ name: "limit", value: JSON.stringify(String(count)) }]),
  ...(fieldKeys.length === 0
    ? []
    : [{ name: "fields", value: JSON.stringify(fieldKeys.join(",")) }]),
];

type Styles = Partial<Record<StyleProperty, string>>;

/**
 * Local styles on the base breakpoint and, when the project has it, the one
 * below 768 px (`maxWidth: 767`, upstream's default "Mobile landscape").
 */
const setLocalStylesMutable = (
  data: WebstudioData,
  instanceId: Instance["id"],
  base: Styles,
  mobile: Styles = {}
) => {
  const breakpoints = Array.from(data.breakpoints.values());
  const isPlain = (breakpoint: (typeof breakpoints)[number]) =>
    breakpoint.minWidth === undefined && breakpoint.condition === undefined;
  const baseBreakpoint = breakpoints.find(
    (breakpoint) => isPlain(breakpoint) && breakpoint.maxWidth === undefined
  );
  const mobileBreakpoint = breakpoints.find(
    (breakpoint) => isPlain(breakpoint) && breakpoint.maxWidth === 767
  );
  if (baseBreakpoint === undefined) {
    return;
  }
  const styleSourceId = nanoid();
  data.styleSources.set(styleSourceId, { type: "local", id: styleSourceId });
  data.styleSourceSelections.set(instanceId, {
    instanceId,
    values: [styleSourceId],
  });
  const write = (breakpointId: string, styles: Styles) => {
    for (const [property, value] of Object.entries(styles)) {
      const decl: StyleDecl = {
        styleSourceId,
        breakpointId,
        property: property as StyleProperty,
        value: parseCssValue(hyphenateProperty(property), value as string),
      };
      data.styles.set(getStyleDeclKey(decl), decl);
    }
  };
  write(baseBreakpoint.id, base);
  if (mobileBreakpoint !== undefined) {
    write(mobileBreakpoint.id, mobile);
  }
};

/**
 * Write the block's contents into the insert's transaction, under its root
 * (`rootId`, the inserted wrapper): the Resource and its binding, the list,
 * the card and the empty and error boxes.
 */
export const addCollectionListMutable = (
  data: WebstudioData,
  {
    rootId,
    schema,
    catalog,
    options,
  }: {
    rootId: Instance["id"];
    schema: CollectionSchema;
    catalog: Pick<CollectionCatalog, "apiBase" | "authorization">;
    options: CollectionListOptions;
  }
) => {
  const writer = createInstanceWriter(data);
  const roles = pickRoles(schema.fields);
  const summary = findSummaryField(schema.fields);
  const dateField = roles.date === "publishedAt" ? undefined : roles.date;
  const fieldKeys = [roles.image, dateField, summary].flatMap((field) =>
    field === undefined ? [] : [field.key]
  );

  const resource: Resource = {
    id: nanoid(),
    name: `${schema.name} list`,
    method: "get",
    url: JSON.stringify(
      `${catalog.apiBase}/collections/${encodeURIComponent(schema.slug)}/items`
    ),
    searchParams: getListSearchParams({
      sort: options.sort,
      count: options.count,
      fieldKeys,
    }),
    headers: [{ name: "Authorization", value: catalog.authorization }],
  };
  const binding: DataSource = {
    type: "resource",
    id: nanoid(),
    scopeInstanceId: rootId,
    name: getFreeVariableName(data, rootId, resource.name),
    resourceId: resource.id,
  };
  data.resources.set(resource.id, resource);
  data.dataSources.set(binding.id, binding);
  const list = encodeDataVariableId(binding.id);

  const isGrid = options.layout === "grid";
  const itemsId = writer.addChild(rootId, {
    component: elementComponent,
    tag: "div",
    label: "Items",
  });
  setLocalStylesMutable(
    data,
    itemsId,
    isGrid
      ? {
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          columnGap: "24px",
          rowGap: "24px",
        }
      : { display: "flex", flexDirection: "column", rowGap: "24px" },
    isGrid ? { gridTemplateColumns: "minmax(0, 1fr)" } : {}
  );

  const collectionId = writer.addChild(itemsId, {
    component: collectionComponent,
    label: schema.name,
  });
  const parameter: DataSource = {
    type: "parameter",
    id: nanoid(),
    scopeInstanceId: collectionId,
    name: "collectionItem",
  };
  data.dataSources.set(parameter.id, parameter);
  writer.addExpressionProp(
    collectionId,
    "data",
    `(${list}.ok === true ? ${list}.data.data : [])`
  );
  writer.addProp({
    instanceId: collectionId,
    name: "item",
    type: "parameter",
    value: parameter.id,
  });
  const item = encodeDataVariableId(parameter.id);
  const field = (key: string) => `${item}.fields.${key}`;
  const nonEmpty = (value: string) => `(${value} ?? "") !== ""`;

  let cardParentId = collectionId;
  if (options.link) {
    const linkId = writer.addChild(collectionId, {
      component: elementComponent,
      tag: "a",
      label: "Item link",
    });
    writer.addExpressionProp(
      linkId,
      "href",
      `${JSON.stringify(`/${schema.slug}/`)} + ${item}.slug`
    );
    setLocalStylesMutable(data, linkId, {
      display: "block",
      color: "inherit",
      textDecorationLine: "none",
    });
    cardParentId = linkId;
  }

  const cardId = writer.addChild(cardParentId, {
    component: elementComponent,
    tag: "div",
    label: "Card",
  });
  setLocalStylesMutable(
    data,
    cardId,
    isGrid
      ? { display: "flex", flexDirection: "column", rowGap: "12px" }
      : {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          columnGap: "16px",
        }
  );

  if (roles.image !== undefined) {
    const image = field(roles.image.key);
    const imageId = writer.addChild(cardId, {
      component: "Image",
      label: roles.image.label,
    });
    writer.addExpressionProp(imageId, "src", `${image}.url`);
    writer.addExpressionProp(imageId, "alt", `${image}.alt`);
    writer.addExpressionProp(imageId, showAttribute, nonEmpty(`${image}.url`));
    setLocalStylesMutable(
      data,
      imageId,
      isGrid
        ? { width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }
        : {
            width: "160px",
            flexShrink: "0",
            aspectRatio: "4 / 3",
            objectFit: "cover",
          }
    );
  }

  const textId = writer.addChild(cardId, {
    component: elementComponent,
    tag: "div",
    label: "Text",
  });
  setLocalStylesMutable(data, textId, {
    display: "flex",
    flexDirection: "column",
    rowGap: "4px",
  });
  writer.addChild(textId, {
    component: elementComponent,
    tag: "h3",
    label: roles.title?.label ?? "Title",
    children: [{ type: "expression", value: `${item}.name` }],
  });
  const dateValue =
    dateField === undefined ? `${item}.publishedAt` : field(dateField.key);
  const timeId = writer.addChild(textId, {
    component: "Time",
    label: dateField?.label ?? "Published",
  });
  writer.addExpressionProp(timeId, "datetime", dateValue);
  if (dateField !== undefined) {
    writer.addExpressionProp(timeId, showAttribute, nonEmpty(dateValue));
  }
  if (summary !== undefined) {
    const summaryId = writer.addChild(textId, {
      component: elementComponent,
      tag: "p",
      label: summary.label,
      children: [{ type: "expression", value: field(summary.key) }],
    });
    writer.addExpressionProp(
      summaryId,
      showAttribute,
      nonEmpty(field(summary.key))
    );
  }

  const emptyId = writer.addChild(rootId, {
    component: elementComponent,
    tag: "div",
    label: "No items yet",
    children: [{ type: "text", value: "No items yet" }],
  });
  writer.addExpressionProp(
    emptyId,
    showAttribute,
    `${list}.ok === true && ${list}.data.data.length === 0`
  );
  const failedId = writer.addChild(rootId, {
    component: elementComponent,
    tag: "div",
    label: "Could not load",
    children: [{ type: "text", value: "Could not load" }],
  });
  writer.addExpressionProp(failedId, showAttribute, `${list}.ok === false`);
};

export type InsertCollectionListResult =
  | { inserted: boolean }
  | { error: string };

/**
 * Add list, from the data tab's popover: reads the collection's schema, then
 * inserts the block at the selection, else at the end of the page, the way
 * the Components panel inserts. `{ error }` when the schema cannot be read;
 * `inserted: false` when the block has no place at the selection (the insert
 * says so itself).
 */
export const insertCollectionList = async (
  options: CollectionListOptions
): Promise<InsertCollectionListResult> => {
  const catalog = await findCollectionCatalog(options.slug);
  if (catalog === undefined) {
    return { error: loadCollectionError };
  }
  const schema = await loadCollectionSchema(options.slug);
  if ("error" in schema) {
    return schema;
  }
  const wrapper: Instance = {
    type: "instance",
    id: nanoid(),
    component: elementComponent,
    tag: "div",
    label: `${schema.name} list`,
    children: [],
  };
  const fragment: WebstudioFragment = {
    children: [{ type: "id", value: wrapper.id }],
    instances: [wrapper],
    props: [],
    dataSources: [],
    styleSourceSelections: [],
    styleSources: [],
    styles: [],
    breakpoints: [],
    assets: [],
    resources: [],
  };
  const inserted = insertWebstudioFragmentAt(fragment, undefined, undefined, {
    onInsert: (data, newInstanceIds) => {
      const rootId = newInstanceIds.get(wrapper.id);
      if (rootId === undefined) {
        return;
      }
      addCollectionListMutable(data, { rootId, schema, catalog, options });
    },
  });
  return { inserted };
};
