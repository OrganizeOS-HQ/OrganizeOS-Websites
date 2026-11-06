import {
  blockComponent,
  blockTemplateComponent,
  collectionComponent,
  getAllPages,
  getStaticContentBlockSourceAssetId,
  parseContentBlockSourceProp,
  ROOT_INSTANCE_ID,
  type Assets,
  type DataSources,
  type Instance,
  type Instances,
  type Pages,
  type Prop,
  type Props,
  type Resources,
} from "@webstudio-is/sdk";
import * as baseComponentMetas from "@webstudio-is/sdk-components-react/metas";
import * as radixComponentMetas from "@webstudio-is/sdk-components-react-radix/metas";
import * as organizeosComponentMetas from "@organizeos/site-components/metas";
import type { ProjectSettings } from "@webstudio-is/project-build";
import {
  actionContextOf,
  checksInstanceTag,
  checksTagProp,
  collectionBindingNames,
  collidingDataSourceIds,
  componentMayShip,
  elementTagMayRun,
  htmlEmbedCodeMayRun,
  instanceIdMayRun,
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
 * page does not import, one stored with the global root's id and a data
 * source the page module cannot name as itself. What is inside an instance
 * publishing drops is listed only where publishing counts it.
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
  /** The build's, which an action's rule reads */
  dataSources: DataSources;
  /** The build's, which the rule for a data source's id reads */
  resources: Resources;
  /** The components a published page imports */
  components?: ReadonlySet<Instance["component"]>;
  mayRun?: boolean;
}): PausedScriptItem[] => {
  if (mayRun || pages === undefined) {
    return [];
  }

  // what an action's rule reads, as publishing and the canvas read it. The
  // builder's maps hold one entry per id, the one publishing keeps.
  const names = {
    instances,
    dataSources,
    props,
    resources,
    pages: pagesAndTemplatesOf(pages),
  };
  const rootIds = pageRootIdsOf(pages);
  const actionContext = actionContextOf({
    ...names,
    pageRootIds: rootIds,
    templateRootIds: templateRootIdsOf(pages),
  });
  // A data source that publishing leaves out for its id is listed where a
  // page declares it: on the instance it is scoped to, or as a global one
  const collidingIds = collidingDataSourceIds(names);
  const collidingByScope = new Map<string, string[]>();
  for (const id of collidingIds) {
    const dataSource = dataSources.get(id);
    if (dataSource !== undefined) {
      // publishing reads one with no scope as held by an instance whose id
      // is empty
      const scope = dataSource.scopeInstanceId ?? "";
      const list = collidingByScope.get(scope) ?? [];
      list.push(dataSource.name);
      collidingByScope.set(scope, list);
    }
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
      // an instance that publishing removes takes its props and its data
      // sources with it
      if (label === undefined && gone(instanceId) === false) {
        for (const prop of propsByInstance.get(instance.id) ?? []) {
          if (pausedPropNames.has(prop.name)) {
            listed.push("Raw HTML property");
          } else if (
            propMayShip(instance, prop, false, actionContext) === false
          ) {
            listed.push(unsafePropLabel(instance, prop));
          }
        }
        for (const name of collidingByScope.get(instance.id) ?? []) {
          listed.push(`Variable (${name})`);
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
    if (pageRedirectMayShip(page, false) === false) {
      items.push({
        label: `Redirect on ${page.name}`,
        navigate: { pageId: page.id, instanceSelector: [page.rootInstanceId] },
        view: "pageSettings",
      });
    }
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
