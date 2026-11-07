import {
  blockComponent,
  blockTemplateComponent,
  collectionComponent,
  getAllPages,
  getStaticContentBlockSourceAssetId,
  parseContentBlockSourceProp,
  ROOT_INSTANCE_ID,
  type Assets,
  type DataSource,
  type DataSources,
  type Instance,
  type Instances,
  type Page,
  type Pages,
  type Prop,
  type Props,
  type Resource,
  type Resources,
} from "@webstudio-is/sdk";
import * as baseComponentMetas from "@webstudio-is/sdk-components-react/metas";
import * as radixComponentMetas from "@webstudio-is/sdk-components-react-radix/metas";
import * as organizeosComponentMetas from "@organizeos/site-components/metas";
import type { ProjectSettings } from "@webstudio-is/project-build";
import {
  checksInstanceTag,
  checksTagProp,
  collectionBindingNames,
  componentMayShip,
  elementTagMayRun,
  findPausedPublishing,
  htmlEmbedCodeMayRun,
  instanceIdMayRun,
  isElementReference,
  isEventAttributeName,
  isFrameDocumentName,
  orgScriptMayRun,
  pageRedirectMayShip,
  pageRootIdsOf,
  pagesAndTemplatesOf,
  pausedPropNames,
  pausedSvgTags,
  projectRedirectMayShip,
  propMayShip,
  templateRootIdsOf,
  unlistedDataSourceIds,
  xmlComponents,
} from "@organizeos/site-components/org-script";
import { platformName } from "~/shared/branding";
import { findPageAndSelectorByInstanceId } from "@webstudio-is/project-build/runtime";

/**
 * What the Publish dialog lists as paused (docs/ORGANIZEOS-FORK.md section 10).
 * It mirrors what publishing drops (packages/cli/src/organizeos-org-script.ts)
 * for the things a designer put there on purpose: HTML Embeds that are not a
 * template icon, Markdown Embeds, JSON-LD (owner decision D13), the SVG elements
 * that can set a link to a javascript: URL, props that write raw markup into an
 * element, and the site's custom code, from the project's settings and from the
 * pages' meta alike. Elements with a tag the builder does not offer are listed too:
 * publishing drops each of them with everything inside it, the props panel can
 * add a `tag` or `data-ws-tag` prop to any component, and the canvas only skips
 * that prop, so the element looks fine there. So are the unsafe values
 * publishing leaves out (`propMayShip`): an address that may run script, a
 * `srcdoc`, an event handler attribute, an action whose args or code could run
 * script, an XML element on an HTML or text page and a redirect to an unsafe
 * address. A bound address the canvas shows with a safe value is still listed
 * when its fixed start decides nothing. So are an instance of a component the
 * page does not import, one stored with the global root's id, a data source
 * with a conflicting id, and the expressions, page settings,
 * Resources and data sources publishing leaves out, with an action judged
 * against the data sources that ship, in the order publishing reads them
 * (`findPausedPublishing`, which the CLI's `dropOrgScript` reads too). What
 * is inside an instance publishing drops is listed only where publishing
 * counts it.
 */
export type PausedScriptItem = {
  label: string;
  /** Select the element on its page when clicked */
  navigate?: { pageId: string; instanceSelector: string[] };
  /** Open a view when clicked */
  view?: "projectSettings" | "projectRedirects" | "pageSettings";
};

/**
 * The components a published page imports, by the name a build stores, as the
 * CLI's react-router framework maps them (`publishedComponents` in
 * packages/cli/src/organizeos-org-script.ts): upstream's base library, Radix's
 * and the OrganizeOS blocks.
 */
export const publishedComponents: ReadonlySet<Instance["component"]> = new Set([
  ...Object.keys(baseComponentMetas),
  ...Object.keys(radixComponentMetas).map(
    (name) => `@webstudio-is/sdk-components-react-radix:${name}`
  ),
  ...Object.keys(organizeosComponentMetas).map(
    (name) => `@organizeos/site-components:${name}`
  ),
]);

export const pausedScriptExplanation = `Scripts could read visitors' ${platformName} sign-in, so these stay off until that's fixed. Your work is kept.`;

/**
 * The ids of what a page publishes, the page's root first. A Content Block's
 * templates container is not published, so neither is anything inside it (the
 * core template puts an empty HTML Embed there). What a content editor inserts
 * into the block is a copy outside the container, and is found.
 */
const findPublishedInstanceIds = (
  instances: Instances,
  rootInstanceId: Instance["id"]
) => {
  const ids = new Set<Instance["id"]>();
  const visit = (instanceId: Instance["id"]) => {
    const instance = instances.get(instanceId);
    if (
      instance === undefined ||
      ids.has(instanceId) ||
      instance.component === blockTemplateComponent
    ) {
      return;
    }
    ids.add(instanceId);
    for (const child of instance.children) {
      if (child.type === "id") {
        visit(child.value);
      }
    }
  };
  visit(rootInstanceId);
  return ids;
};

/**
 * The tags an instance holds as static strings, as publishing reads them: its
 * own tag (the element of a ws:element, and the data-ws-tag prop the generator
 * writes on every other component), and a `data-ws-tag` or `tag` prop of any
 * component but a ws:element, where it is an attribute, and an XML Node, which
 * takes any tag name. All of them count: a component may read one of several,
 * and a Radix trigger passes them on to the child it renders.
 */
const findStaticTags = (instance: Instance, props: Prop[]) => {
  const tags: string[] = [];
  if (instance.tag !== undefined && checksInstanceTag(instance.component)) {
    tags.push(instance.tag);
  }
  for (const prop of props) {
    if (
      prop.type === "string" &&
      checksTagProp(instance.component, prop.name)
    ) {
      tags.push(prop.value);
    }
  }
  return tags;
};

/** How the dialog names a prop that publishing leaves out for its value. */
const unsafePropLabel = (instance: Instance, { name, type }: Prop) => {
  if (type === "action") {
    return `Action (${name})`;
  }
  if (isElementReference({ name, type })) {
    return `Element reference (${name})`;
  }
  if (
    instance.component === collectionComponent &&
    collectionBindingNames.has(name)
  ) {
    return `Collection item or key (${name})`;
  }
  if (isFrameDocumentName(name)) {
    return "Frame document (srcdoc)";
  }
  if (isEventAttributeName(name)) {
    return `Event handler attribute (${name})`;
  }
  const kind = name.toLowerCase();
  if (kind === "action" || kind === "formaction") {
    return `Form address (${name})`;
  }
  if (kind === "src") {
    return `Source address (${name})`;
  }
  if (kind === "data") {
    return `Object address (${name})`;
  }
  return `Link address (${name})`;
};

/** How the dialog names a page setting that publishing leaves out. */
const pageSettingLabel = (page: Page, field: string) => {
  switch (field) {
    case "title":
      return "Title";
    case "description":
      return "Description";
    case "excludePageFromSearch":
      return "Exclude from search";
    case "language":
      return "Language";
    case "socialImageUrl":
      return "Social image";
    case "status":
      return "Status code";
    case "content":
      return "Text";
  }
  const custom = page.meta.custom?.[Number(field.slice("custom.".length))];
  return custom?.property.trim() || "Custom metadata";
};

/**
 * Whether publishing drops this instance for its tag (`classify` in
 * packages/cli/src/organizeos-org-script.ts): its own tag, or a `data-ws-tag`
 * or `tag` prop, is not a static string the builder offers.
 */
const hasBlockedTag = (instance: Instance, props: Prop[]) =>
  (instance.tag !== undefined &&
    checksInstanceTag(instance.component) &&
    elementTagMayRun(instance.tag, false) === false) ||
  props.some(
    (prop) =>
      checksTagProp(instance.component, prop.name) &&
      (prop.type !== "string" || elementTagMayRun(prop.value, false) === false)
  );

export const findPausedScript = ({
  pages,
  projectSettings,
  instances,
  props,
  dataSources,
  resources,
  components = publishedComponents,
  mayRun = orgScriptMayRun(),
}: {
  pages: undefined | Pages;
  /** Where 0.309.0 keeps the custom code; a loaded build has no pages meta */
  projectSettings?: ProjectSettings;
  instances: Instances;
  props: Props;
  /** The build's, which an action's rule and the expressions' read */
  dataSources: DataSources;
  /** The build's, which the rules for a data source's id and for expressions read */
  resources: Resources;
  /** The components a published page imports */
  components?: ReadonlySet<Instance["component"]>;
  mayRun?: boolean;
}): PausedScriptItem[] => {
  if (mayRun || pages === undefined) {
    return [];
  }

  const propsByInstance = new Map<Instance["id"], Prop[]>();
  for (const prop of props.values()) {
    const list = propsByInstance.get(prop.instanceId) ?? [];
    list.push(prop);
    propsByInstance.set(prop.instanceId, list);
  }

  // An XML element is left out of every HTML and text page that publishes it
  const publishedOnHtmlPages = new Set(
    getAllPages(pages)
      .filter((page) => page.meta.documentType !== "xml")
      .flatMap((page) => [
        ...findPublishedInstanceIds(instances, page.rootInstanceId),
      ])
  );

  // How the dialog names an instance publishing leaves out with what is
  // inside it (`classify` in packages/cli/src/organizeos-org-script.ts)
  const labelOf = (instance: Instance) => {
    const instanceProps = propsByInstance.get(instance.id) ?? [];
    if (instanceIdMayRun(instance.id, false) === false) {
      return "Element with a reserved id";
    }
    if (componentMayShip(instance.component, components) === false) {
      return "Unknown component";
    }
    if (instance.component === "HtmlEmbed") {
      // an expression is only known when the page renders: it is dropped
      const codes = instanceProps.filter((prop) => prop.name === "code");
      const isIcon =
        codes.length > 0 &&
        codes.every(
          (code) =>
            code.type === "string" && htmlEmbedCodeMayRun(code.value, false)
        );
      return isIcon ? undefined : "HTML Embed";
    }
    if (instance.component === "MarkdownEmbed") {
      return "Markdown Embed";
    }
    if (instance.component === "JsonLd") {
      return "JSON-LD";
    }
    if (hasBlockedTag(instance, instanceProps)) {
      return "Element with an unsupported tag";
    }
    const paused = findStaticTags(instance, instanceProps).find((tag) =>
      pausedSvgTags.has(tag)
    );
    if (paused !== undefined) {
      return `SVG ${paused} element`;
    }
    if (
      xmlComponents.has(instance.component) &&
      publishedOnHtmlPages.has(instance.id)
    ) {
      return "XML element";
    }
  };

  const rootIds = pageRootIdsOf(pages);

  // What publishing removes, as `dropOrgScript` does: every instance it
  // leaves out, on a page or not, with what is inside it (a page's root is
  // emptied instead), but what an instance that stays still holds
  const labels = new Map<Instance["id"], string>();
  const found = new Set<Instance["id"]>();
  const emptiedRoots = new Set<Instance["id"]>();
  const parentIds = new Map<Instance["id"], Instance["id"][]>();
  for (const instance of instances.values()) {
    const label = labelOf(instance);
    if (label !== undefined) {
      labels.set(instance.id, label);
      (rootIds.has(instance.id) ? emptiedRoots : found).add(instance.id);
    }
    for (const child of instance.children) {
      if (child.type === "id") {
        parentIds.set(child.value, [
          ...(parentIds.get(child.value) ?? []),
          instance.id,
        ]);
      }
    }
  }
  const removed = new Set(found);
  const pending = [...found, ...emptiedRoots];
  while (pending.length > 0) {
    for (const child of instances.get(pending.pop() as string)?.children ??
      []) {
      if (child.type === "id" && removed.has(child.value) === false) {
        removed.add(child.value);
        pending.push(child.value);
      }
    }
  }
  const gone = (id: Instance["id"]) => removed.has(id) || emptiedRoots.has(id);
  for (let changed = true; changed;) {
    changed = false;
    for (const id of removed) {
      if (
        found.has(id) === false &&
        (parentIds.get(id) ?? []).some((parentId) => gone(parentId) === false)
      ) {
        removed.delete(id);
        changed = true;
      }
    }
  }
  // What publishing leaves out as an expression and what an action's rule
  // reads, in the order publishing reads them: a data source that goes for its
  // id, or with its instance, takes what names it, and an action is judged
  // against the data sources that ship. An action names only a data source of
  // an instance on every path to its holder, or a global one, so one of an
  // instance that goes is in scope only for a holder that goes too. The
  // builder's maps hold one entry per id, the one publishing keeps. What no
  // page publishes is neither counted nor listed.
  const { collidingIds, pausedExpressions, actionContext } =
    findPausedPublishing({
      pages: getAllPages(pages),
      templates: [...(pages.pageTemplates?.values() ?? [])],
      pageNames: pagesAndTemplatesOf(pages),
      pageRootIds: rootIds,
      templateRootIds: templateRootIdsOf(pages),
      instances,
      dataSources,
      props,
      resources,
      ships: (dataSource) =>
        dataSource.scopeInstanceId === undefined ||
        dataSource.scopeInstanceId === ROOT_INSTANCE_ID ||
        gone(dataSource.scopeInstanceId) === false,
    });
  // A data source that publishing leaves out for its id is listed where a
  // page declares it: on the instance it is scoped to, or as a global one
  // (a Content Block's own document goes unlisted, as publishing counts it
  // not)
  const unlistedIds = unlistedDataSourceIds({ instances, dataSources, props });
  const collidingByScope = new Map<string, string[]>();
  for (const id of collidingIds) {
    const dataSource = dataSources.get(id);
    if (dataSource !== undefined && unlistedIds.has(id) === false) {
      // publishing reads one with no scope as held by an instance whose id
      // is empty
      const scope = dataSource.scopeInstanceId ?? "";
      const list = collidingByScope.get(scope) ?? [];
      list.push(dataSource.name);
      collidingByScope.set(scope, list);
    }
  }
  const pausedProps = new Set<Prop["id"]>();
  const pausedChildren = new Map<Instance["id"], number>();
  const pausedFields = new Map<Page["id"], string[]>();
  const pausedResources: Resource["id"][] = [];
  const pausedDataSources: DataSource["id"][] = [];
  for (const paused of pausedExpressions) {
    if (paused.unpublished === true) {
      continue;
    }
    if (paused.kind === "prop") {
      pausedProps.add(paused.propId);
    } else if (paused.kind === "child") {
      pausedChildren.set(
        paused.instanceId,
        (pausedChildren.get(paused.instanceId) ?? 0) + 1
      );
    } else if (paused.kind === "page") {
      pausedFields.set(paused.pageId, [
        ...(pausedFields.get(paused.pageId) ?? []),
        paused.field,
      ]);
    } else if (paused.kind === "resource") {
      pausedResources.push(paused.resourceId);
    } else {
      pausedDataSources.push(paused.dataSourceId);
    }
  }

  // What a page publishes once what goes has gone, as publishing counts it
  const kept = new Map(
    Array.from(instances).filter(([id]) => gone(id) === false)
  );
  const shipped = new Set(
    getAllPages(pages).flatMap((page) => [
      ...findPublishedInstanceIds(kept, page.rootInstanceId),
    ])
  );

  const items: PausedScriptItem[] = [];
  const seen = new Set<Instance["id"]>();
  for (const page of getAllPages(pages)) {
    // only what a page publishes is listed
    for (const instanceId of findPublishedInstanceIds(
      instances,
      page.rootInstanceId
    )) {
      const instance = instances.get(instanceId);
      if (seen.has(instanceId) || instance === undefined) {
        continue;
      }
      seen.add(instanceId);
      const label = labels.get(instanceId);
      const listed = label === undefined ? [] : [label];
      // an instance that publishing removes, or that no page reaches once
      // what goes has gone, takes its props and its data sources with it
      if (label === undefined && shipped.has(instanceId)) {
        for (const prop of propsByInstance.get(instance.id) ?? []) {
          if (
            isElementReference(prop) &&
            prop.type === "parameter" &&
            collidingIds.has(prop.value)
          ) {
            // it goes with a data source that goes for its id, listed
            continue;
          } else if (pausedPropNames.has(prop.name)) {
            listed.push("Raw HTML property");
          } else if (
            propMayShip(instance, prop, false, actionContext) === false
          ) {
            listed.push(unsafePropLabel(instance, prop));
          } else if (pausedProps.has(prop.id)) {
            listed.push(`Binding (${prop.name})`);
          }
        }
        for (const name of collidingByScope.get(instance.id) ?? []) {
          listed.push(`Variable (${name})`);
        }
        for (
          let index = 0;
          index < (pausedChildren.get(instance.id) ?? 0);
          index += 1
        ) {
          listed.push("Text binding");
        }
      }
      if (listed.length === 0) {
        continue;
      }
      const { pageId, instanceSelector } = findPageAndSelectorByInstanceId(
        pages,
        instances,
        instance.id
      );
      const owner = pages.pages.get(pageId);
      for (const label of listed) {
        items.push({
          label: `${label} on ${owner?.name ?? page.name}`,
          navigate: { pageId, instanceSelector },
        });
      }
    }
  }

  for (const name of collidingByScope.get(ROOT_INSTANCE_ID) ?? []) {
    items.push({ label: `Variable (${name})` });
  }

  for (const page of getAllPages(pages)) {
    const navigate = {
      pageId: page.id,
      instanceSelector: [page.rootInstanceId],
    };
    const fields = pausedFields.get(page.id) ?? [];
    for (const field of fields) {
      if (field !== "redirect") {
        items.push({
          label: `Page setting (${pageSettingLabel(page, field)}) on ${page.name}`,
          navigate,
          view: "pageSettings",
        });
      }
    }
    if (
      pageRedirectMayShip(page, false) === false ||
      fields.includes("redirect")
    ) {
      items.push({
        label: `Redirect on ${page.name}`,
        navigate,
        view: "pageSettings",
      });
    }
  }
  // a Resource is listed where publishing counts it, when an instance that
  // stays loads it, and opens an instance a page publishes that does
  for (const resourceId of pausedResources) {
    const holders = [
      ...[...dataSources.values()].flatMap((dataSource) =>
        dataSource.type === "resource" && dataSource.resourceId === resourceId
          ? [dataSource.scopeInstanceId]
          : []
      ),
      ...[...props.values()].flatMap((prop) =>
        prop.type === "resource" && prop.value === resourceId
          ? [prop.instanceId]
          : []
      ),
    ];
    if (
      holders.length > 0 &&
      holders.every((id) => id !== undefined && gone(id))
    ) {
      continue;
    }
    const holder = holders.find((id) => id !== undefined && shipped.has(id));
    const name = resources.get(resourceId)?.name ?? resourceId;
    if (holder === undefined) {
      items.push({ label: `Resource (${name})` });
      continue;
    }
    const { pageId, instanceSelector } = findPageAndSelectorByInstanceId(
      pages,
      instances,
      holder
    );
    const owner = pages.pages.get(pageId);
    items.push({
      label: `Resource (${name}) on ${owner?.name ?? pageId}`,
      navigate: { pageId, instanceSelector },
    });
  }
  // a data source opens the instance it is scoped to, when a page publishes
  // it once what goes has gone; a global one opens nothing
  for (const dataSourceId of pausedDataSources) {
    const dataSource = dataSources.get(dataSourceId);
    const holder = dataSource?.scopeInstanceId;
    if (dataSource !== undefined && holder === ROOT_INSTANCE_ID) {
      items.push({ label: `Data source (${dataSource.name})` });
      continue;
    }
    if (
      dataSource === undefined ||
      holder === undefined ||
      shipped.has(holder) === false
    ) {
      continue;
    }
    const { pageId, instanceSelector } = findPageAndSelectorByInstanceId(
      pages,
      instances,
      holder
    );
    const owner = pages.pages.get(pageId);
    items.push({
      label: `Data source (${dataSource.name}) on ${owner?.name ?? pageId}`,
      navigate: { pageId, instanceSelector },
    });
  }
  for (const redirect of pages.redirects ?? []) {
    if (projectRedirectMayShip(redirect, false) === false) {
      items.push({
        label: `Redirect from ${redirect.old} (Project settings)`,
        view: "projectRedirects",
      });
    }
  }

  if (
    (pages.meta?.code ?? "").trim() !== "" ||
    (projectSettings?.meta.code ?? "").trim() !== ""
  ) {
    items.push({
      label: "Custom code (Project settings)",
      view: "projectSettings",
    });
  }
  return items;
};

const markdownFormats = new Set(["md", "mdx"]);

/** The project's Markdown and MDX files: by format, or by the name's extension. */
const findMarkdownAssetIds = (assets: Assets) => {
  const ids = new Set<string>();
  for (const asset of assets.values()) {
    const extension = asset.name.match(/\.([^.]+)$/)?.[1] ?? "";
    if (
      markdownFormats.has(asset.format.toLowerCase()) ||
      markdownFormats.has(extension.toLowerCase())
    ) {
      ids.add(asset.id);
    }
  }
  return ids;
};

/**
 * The Content Blocks that make publishing refuse the build while org script is
 * paused (owner decision D7): `refuseMdxWhilePaused` in
 * packages/cli/src/organizeos-org-script.ts, by the same rule. A block's `src`
 * counts when it names a Markdown or MDX asset, and any other source (an
 * expression that could select one) counts when the project holds one. Every
 * block counts, on a draft page or on none, as publishing reads the whole
 * build. Publishing also reads its content index, which the builder does not
 * load, so this list can miss a block that publishing refuses; never the other
 * way round.
 */
export const findMdxBlocks = ({
  pages,
  instances,
  props,
  assets,
  mayRun = orgScriptMayRun(),
}: {
  pages: undefined | Pages;
  instances: Instances;
  props: Props;
  assets: Assets;
  mayRun?: boolean;
}): PausedScriptItem[] => {
  if (mayRun || pages === undefined) {
    return [];
  }
  const markdownIds = findMarkdownAssetIds(assets);
  if (markdownIds.size === 0) {
    return [];
  }
  const boundIds = new Set<Instance["id"]>();
  for (const prop of props.values()) {
    if (instances.get(prop.instanceId)?.component !== blockComponent) {
      continue;
    }
    const source = parseContentBlockSourceProp(prop);
    if (source === undefined) {
      continue;
    }
    const assetId = getStaticContentBlockSourceAssetId(source);
    if (assetId === undefined || assetId === "" || markdownIds.has(assetId)) {
      boundIds.add(prop.instanceId);
    }
  }
  const owners = [
    ...getAllPages(pages),
    ...(pages.pageTemplates?.values() ?? []),
  ];
  const items: PausedScriptItem[] = [];
  for (const instance of instances.values()) {
    if (boundIds.has(instance.id) === false) {
      continue;
    }
    const { instanceSelector } = findPageAndSelectorByInstanceId(
      pages,
      instances,
      instance.id
    );
    const owner = owners.find(
      (page) => page.rootInstanceId === instanceSelector.at(-1)
    );
    items.push(
      owner === undefined
        ? { label: "Content Block" }
        : {
            label: `Content Block on ${owner.name}`,
            navigate: { pageId: owner.id, instanceSelector },
          }
    );
  }
  return items;
};
