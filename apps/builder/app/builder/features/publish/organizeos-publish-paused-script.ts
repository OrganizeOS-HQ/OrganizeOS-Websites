import {
  findTreeInstanceIds,
  getAllPages,
  type Instance,
  type Instances,
  type Pages,
  type Prop,
  type Props,
} from "@webstudio-is/sdk";
import {
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
  pausedSvgTags,
} from "@organizeos/site-components/org-script";
import { platformName } from "~/shared/branding";
import { findPageAndSelectorByInstanceId } from "~/shared/instance-utils/lookup";

/**
 * What the Publish dialog lists as paused (docs/ORGANIZEOS-FORK.md section 10).
 * It mirrors what publishing drops (packages/cli/src/organizeos-org-script.ts)
 * for the things a designer put there on purpose: HTML Embeds that are not a
 * template icon, Markdown Embeds, the SVG elements that can set a link to a
 * javascript: URL, and the site's custom code.
 */
export type PausedScriptItem = {
  label: string;
  /** Select the element on its page when clicked */
  navigate?: { pageId: string; instanceSelector: string[] };
  /** Open a view when clicked */
  view?: "projectSettings";
};

export const pausedScriptExplanation = `Scripts on your site could read the ${platformName} sign-in of people who visit, so these stay off while we make it safe. What you saved is kept.`;

// Components that render their tag as an element, from `tag` or a legacy prop
const tagComponents = new Set(["ws:element", "Box", "Text", "Heading"]);

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

  const codeProps = new Map<Instance["id"], Prop>();
  const tagProps = new Map<Instance["id"], string>();
  for (const prop of props.values()) {
    if (prop.name === "code") {
      codeProps.set(prop.instanceId, prop);
    }
    if (prop.name === "tag" && prop.type === "string") {
      tagProps.set(prop.instanceId, prop.value);
    }
  }

  const items: PausedScriptItem[] = [];
  const seen = new Set<Instance["id"]>();
  for (const page of getAllPages(pages)) {
    // only what a page contains is published
    for (const instanceId of findTreeInstanceIds(
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
      let name: undefined | string;
      if (instance.component === "HtmlEmbed") {
        const code = codeProps.get(instance.id);
        // an expression is only known when the page renders: it is dropped
        if (
          htmlEmbedCodeMayRun(
            code?.type === "string" ? code.value : undefined
          ) === false
        ) {
          name = "HTML Embed";
        }
      } else if (instance.component === "MarkdownEmbed") {
        name = "Markdown Embed";
      } else if (tagComponents.has(instance.component)) {
        const tag = instance.tag ?? tagProps.get(instance.id);
        if (tag !== undefined && pausedSvgTags.has(tag)) {
          name = `SVG ${tag} element`;
        }
      }
      if (name === undefined) {
        continue;
      }
      const { pageId, instanceSelector } = findPageAndSelectorByInstanceId(
        pages,
        instances,
        instance.id
      );
      const owner = pages.pages.get(pageId);
      items.push({
        label: `${name} on ${owner?.name ?? page.name}`,
        navigate: { pageId, instanceSelector },
      });
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
