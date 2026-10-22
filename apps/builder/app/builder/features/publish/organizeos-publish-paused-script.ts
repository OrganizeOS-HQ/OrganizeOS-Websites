import {
  blockTemplateComponent,
  getAllPages,
  type Instance,
  type Instances,
  type Pages,
  type Prop,
  type Props,
} from "@webstudio-is/sdk";
import {
  checksInstanceTag,
  checksTagProp,
  elementTagMayRun,
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
  pausedPropNames,
  pausedSvgTags,
} from "@organizeos/site-components/org-script";
import { platformName } from "~/shared/branding";
import { findPageAndSelectorByInstanceId } from "~/shared/instance-utils/lookup";

/**
 * What the Publish dialog lists as paused (docs/ORGANIZEOS-FORK.md section 10).
 * It mirrors what publishing drops (packages/cli/src/organizeos-org-script.ts)
 * for the things a designer put there on purpose: HTML Embeds that are not a
 * template icon, Markdown Embeds, the SVG elements that can set a link to a
 * javascript: URL, props that write raw markup into an element, and the site's
 * custom code. Elements with a tag the builder does not offer are listed too:
 * publishing drops each of them with everything inside it, the props panel can
 * add a `tag` or `data-ws-tag` prop to any component, and the canvas only skips
 * that prop, so the element looks fine there.
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
      } else if (hasBlockedTag(instance, instanceProps)) {
        // it goes with its props, so no raw HTML property is listed for it
        labels.push("Element with a tag the builder does not offer");
      } else {
        const paused = findStaticTags(instance, instanceProps).find((tag) =>
          pausedSvgTags.has(tag)
        );
        if (paused !== undefined) {
          labels.push(`SVG ${paused} element`);
        }
      }
      // an instance that is dropped takes its props with it
      if (labels.length === 0) {
        for (const prop of instanceProps) {
          if (pausedPropNames.has(prop.name)) {
            labels.push("Raw HTML property");
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
