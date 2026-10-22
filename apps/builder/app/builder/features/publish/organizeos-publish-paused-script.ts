import {
  blockTemplateComponent,
  elementComponent,
  getAllPages,
  type Instance,
  type Instances,
  type Pages,
  type Prop,
  type Props,
} from "@webstudio-is/sdk";
import { tagProperty } from "@webstudio-is/sdk/runtime";
import {
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
  pausedPropNames,
  pausedSvgTags,
  tagPropsByComponent,
} from "@organizeos/site-components/org-script";
import { platformName } from "~/shared/branding";
import { findPageAndSelectorByInstanceId } from "~/shared/instance-utils/lookup";

/**
 * What the Publish dialog lists as paused (docs/ORGANIZEOS-FORK.md section 10).
 * It mirrors what publishing drops (packages/cli/src/organizeos-org-script.ts)
 * for the things a designer put there on purpose: HTML Embeds that are not a
 * template icon, Markdown Embeds, the SVG elements that can set a link to a
 * javascript: URL, props that write raw markup into an element, and the site's
 * custom code. Elements with a tag the builder does not offer are not listed:
 * only crafted or pasted JSON makes one, and the publish log counts them.
 */
export type PausedScriptItem = {
  label: string;
  /** Select the element on its page when clicked */
  navigate?: { pageId: string; instanceSelector: string[] };
  /** Open a view when clicked */
  view?: "projectSettings";
};

export const pausedScriptExplanation = `Scripts on your site could read the ${platformName} sign-in of people who visit, so these stay off while we make it safe. What you saved is kept.`;

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
 * The tags that the props which choose an element hold as static strings, as
 * publishing reads them (`tagPropsByComponent`): all of them count, because a
 * component may read one of several. `ws:element` renders `instance.tag` only.
 */
const findStaticTags = (instance: Instance, props: Prop[]) => {
  const isElement = instance.component === elementComponent;
  const tagProps = tagPropsByComponent.get(instance.component) ?? [];
  const tags: string[] = [];
  // `instance.tag` is the element of a ws:element, and reaches the others as
  // the data-ws-tag attribute, which only some of them read
  if (
    instance.tag !== undefined &&
    (isElement || tagProps.includes(tagProperty))
  ) {
    tags.push(instance.tag);
  }
  for (const prop of props) {
    if (prop.type === "string" && tagProps.includes(prop.name)) {
      tags.push(prop.value);
    }
  }
  return tags;
};

export const findPausedScript = ({
  pages,
  instances,
  props,
  mayRun = orgScriptMayRun(),
}: {
  pages: undefined | Pages;
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
      } else {
        const paused = findStaticTags(instance, instanceProps).find((tag) =>
          pausedSvgTags.has(tag)
        );
        if (paused !== undefined) {
          labels.push(`SVG ${paused} element`);
        }
        // an instance that is dropped takes its props with it
        if (labels.length === 0) {
          for (const prop of instanceProps) {
            if (pausedPropNames.has(prop.name)) {
              labels.push("Raw HTML property");
            }
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

  if ((pages.meta?.code ?? "").trim() !== "") {
    items.push({
      label: "Custom code (Project settings)",
      view: "projectSettings",
    });
  }
  return items;
};
