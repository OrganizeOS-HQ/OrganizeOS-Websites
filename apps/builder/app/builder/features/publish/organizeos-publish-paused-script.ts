import {
  blockComponent,
  blockTemplateComponent,
  getAllPages,
  getStaticContentBlockSourceAssetId,
  parseContentBlockSourceProp,
  type Assets,
  type Instance,
  type Instances,
  type Pages,
  type Prop,
  type Props,
} from "@webstudio-is/sdk";
import type { ProjectSettings } from "@webstudio-is/project-build";
import {
  checksInstanceTag,
  checksTagProp,
  elementTagMayRun,
  htmlEmbedCodeMayRun,
  isEventAttributeName,
  isFrameDocumentName,
  orgScriptMayRun,
  pageRedirectMayShip,
  pausedPropNames,
  pausedSvgTags,
  projectRedirectMayShip,
  propMayShip,
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
 * `srcdoc`, an event handler attribute, an XML element on an HTML or text page
 * and a redirect to an unsafe address. A bound address the canvas shows with a
 * safe value is still listed when its fixed start decides nothing.
 */
export type PausedScriptItem = {
  label: string;
  /** Select the element on its page when clicked */
  navigate?: { pageId: string; instanceSelector: string[] };
  /** Open a view when clicked */
  view?: "projectSettings" | "projectRedirects" | "pageSettings";
};

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
const unsafePropLabel = (name: string) => {
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
  mayRun = orgScriptMayRun(),
}: {
  pages: undefined | Pages;
  /** Where 0.309.0 keeps the custom code; a loaded build has no pages meta */
  projectSettings?: ProjectSettings;
  instances: Instances;
  props: Props;
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

  const items: PausedScriptItem[] = [];
  const seen = new Set<Instance["id"]>();
  for (const page of getAllPages(pages)) {
    // only what a page publishes is listed
    for (const instanceId of findPublishedInstanceIds(
      instances,
      page.rootInstanceId
    )) {
      if (seen.has(instanceId)) {
        continue;
      }
      seen.add(instanceId);
      const instance = instances.get(instanceId);
      if (instance === undefined) {
        continue;
      }
      const instanceProps = propsByInstance.get(instance.id) ?? [];
      const labels: string[] = [];
      if (instance.component === "HtmlEmbed") {
        const code = instanceProps.find((prop) => prop.name === "code");
        // an expression is only known when the page renders: it is dropped
        if (
          htmlEmbedCodeMayRun(
            code?.type === "string" ? code.value : undefined
          ) === false
        ) {
          labels.push("HTML Embed");
        }
      } else if (instance.component === "MarkdownEmbed") {
        labels.push("Markdown Embed");
      } else if (instance.component === "JsonLd") {
        labels.push("JSON-LD");
      } else if (hasBlockedTag(instance, instanceProps)) {
        // it goes with its props, so no raw HTML property is listed for it
        labels.push("Element with an unsupported tag");
      } else {
        const paused = findStaticTags(instance, instanceProps).find((tag) =>
          pausedSvgTags.has(tag)
        );
        if (paused !== undefined) {
          labels.push(`SVG ${paused} element`);
        } else if (
          xmlComponents.has(instance.component) &&
          publishedOnHtmlPages.has(instance.id)
        ) {
          labels.push("XML element");
        }
      }
      // an instance that is dropped takes its props with it
      if (labels.length === 0) {
        for (const prop of instanceProps) {
          if (pausedPropNames.has(prop.name)) {
            labels.push("Raw HTML property");
          } else if (propMayShip(instance, prop, false) === false) {
            labels.push(unsafePropLabel(prop.name));
          }
        }
      }
      if (labels.length === 0) {
        continue;
      }
      const { pageId, instanceSelector } = findPageAndSelectorByInstanceId(
        pages,
        instances,
        instance.id
      );
      const owner = pages.pages.get(pageId);
      for (const label of labels) {
        items.push({
          label: `${label} on ${owner?.name ?? page.name}`,
          navigate: { pageId, instanceSelector },
        });
      }
    }
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
