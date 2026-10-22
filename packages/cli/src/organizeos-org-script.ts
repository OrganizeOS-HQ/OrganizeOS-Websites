/**
 * OrganizeOS fork: publishing leaves an org's own script out until its sites
 * move to their own domain (docs/ORGANIZEOS-FORK.md section 10,
 * orgScriptMayRun() in @organizeos/site-components/org-script).
 *
 * Platform session cookies are scoped to `.organizeos.org` and readable by
 * script, and a published Website is served from `{sub}.organizeos.org`, so
 * script an org writes there could read a visitor's session. This runs before
 * prebuild reads the project bundle, so every later step (props, pages,
 * resources, CSS) sees a build without it, on every page and in every
 * framework. It drops:
 *
 * - every HTML Embed, unless its code is a static string identical to one of
 *   the SVG icons upstream's own templates insert;
 * - every Markdown Embed (its renderer keeps `javascript:` links);
 * - every element whose tag is not one the builder offers: `script` ships a
 *   <script>, and a tag that is JSX syntax is written into the page module as
 *   code;
 * - the SVG `animate` and `set` elements (a `javascript:` link by SMIL);
 * - the `dangerouslySetInnerHTML` prop, which puts raw markup into any element;
 * - the site's custom code.
 *
 * Nothing is deleted from the build the org edits: the embeds and the code stay
 * saved and show as paused in the builder, and the next publish ships them
 * once the switch is on. The runtime packages and route templates are
 * untouched.
 */
import type { PublishedProjectBundle } from "@webstudio-is/protocol";
import { tagProperty } from "@webstudio-is/sdk/runtime";
import {
  elementComponent,
  tags,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";
import {
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
  pausedPropNames,
  pausedSvgTags,
  tagPropsByComponent,
} from "@organizeos/site-components/org-script";

export type DroppedOrgScript = {
  htmlEmbeds: number;
  markdownEmbeds: number;
  /** Elements whose tag the builder does not offer, `script` among them */
  elementsWithUnknownTag: number;
  /** SVG animate and set elements */
  svgAnimations: number;
  /** `dangerouslySetInnerHTML` props, on instances that stay */
  rawHtmlProps: number;
  customCode: boolean;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** The line the publish workflow logs, for support. Nothing left out, no line. */
export const describeDroppedOrgScript = (dropped: DroppedOrgScript) => {
  const parts = [
    dropped.htmlEmbeds > 0
      ? plural(dropped.htmlEmbeds, "HTML Embed", "HTML Embeds")
      : undefined,
    dropped.markdownEmbeds > 0
      ? plural(dropped.markdownEmbeds, "Markdown Embed", "Markdown Embeds")
      : undefined,
    dropped.elementsWithUnknownTag > 0
      ? plural(
          dropped.elementsWithUnknownTag,
          "element with a tag the builder does not offer",
          "elements with a tag the builder does not offer"
        )
      : undefined,
    dropped.svgAnimations > 0
      ? plural(
          dropped.svgAnimations,
          "animate or set element",
          "animate or set elements"
        )
      : undefined,
    dropped.rawHtmlProps > 0
      ? plural(dropped.rawHtmlProps, "raw HTML property", "raw HTML properties")
      : undefined,
    dropped.customCode ? "the site's custom code" : undefined,
  ].filter((part) => part !== undefined);
  if (parts.length === 0) {
    return;
  }
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `Org script is paused until OrganizeOS sites move to their own domain: left out ${list}.`;
};

// `ws:element` writes <${instance.tag}> into the page module. The components in
// tagPropsByComponent create their element from a prop: Box, Text and Heading
// from `data-ws-tag` (the generator emits `instance.tag` under that name, and a
// user prop of that name comes after it and wins) and then their legacy `tag`
// prop, DialogTitle from its `tag` prop. Other components forward both names
// as plain attributes and are not touched.
const offeredTags = new Set(tags);

const withoutCode = <Meta extends { code?: string }>(meta: Meta) => {
  const { code: _code, ...rest } = meta;
  return rest;
};

type Kind = "htmlEmbed" | "markdownEmbed" | "unknownTag" | "svgAnimation";

const classify = (instance: Instance, props: Prop[] = []): undefined | Kind => {
  if (instance.component === "HtmlEmbed") {
    // An expression, a resource or a missing code is only known (or empty)
    // when the page renders, so only a static icon stays. Upstream's published
    // page prints a placeholder for an embed with no code.
    const codeProps = props.filter((prop) => prop.name === "code");
    const isIcon =
      codeProps.length > 0 &&
      codeProps.every(
        (prop) =>
          prop.type === "string" && htmlEmbedCodeMayRun(prop.value, false)
      );
    return isIcon ? undefined : "htmlEmbed";
  }
  if (instance.component === "MarkdownEmbed") {
    return "markdownEmbed";
  }
  const isElement = instance.component === elementComponent;
  const tagProps = tagPropsByComponent.get(instance.component) ?? [];
  if (isElement === false && tagProps.length === 0) {
    return;
  }
  const staticTags: string[] = [];
  // `instance.tag` is the element of a ws:element. It reaches the others as the
  // data-ws-tag attribute, which only some of them read.
  if (
    instance.tag !== undefined &&
    (isElement || tagProps.includes(tagProperty))
  ) {
    // The match is exact and case-sensitive, as the Tag control's list is
    if (offeredTags.has(instance.tag) === false) {
      return "unknownTag";
    }
    staticTags.push(instance.tag);
  }
  for (const prop of props) {
    if (tagProps.includes(prop.name) === false) {
      continue;
    }
    if (prop.type !== "string" || offeredTags.has(prop.value) === false) {
      return "unknownTag";
    }
    staticTags.push(prop.value);
  }
  if (staticTags.some((tag) => pausedSvgTags.has(tag))) {
    return "svgAnimation";
  }
};

/**
 * The project bundle without the org script described above. It never changes
 * its input, and returns it as it is when the switch is on.
 *
 * An instance that is dropped takes everything inside it: an embed's
 * `ws:descendant` children and any children a crafted build gave it, and an
 * element's whole subtree. What a kept instance still holds stays (a Slot's
 * Fragment that another Slot shows). Their props and the data sources scoped to
 * them go too, so a Resource that only they used is neither loaded by the
 * page's loader nor written into its server module. A page root that would be
 * dropped (only a crafted build has one) is emptied into a Body instead, so the
 * page still builds. A `dangerouslySetInnerHTML` prop is dropped from its
 * instance, which stays.
 */
export const dropOrgScript = (
  bundle: PublishedProjectBundle,
  {
    mayRun = orgScriptMayRun(),
    log,
  }: { mayRun?: boolean; log?: (message: string) => void } = {}
): PublishedProjectBundle => {
  if (mayRun) {
    return bundle;
  }
  const { build } = bundle;

  const propsByInstance = new Map<Instance["id"], Prop[]>();
  for (const [, prop] of build.props) {
    const props = propsByInstance.get(prop.instanceId);
    if (props === undefined) {
      propsByInstance.set(prop.instanceId, [prop]);
    } else {
      props.push(prop);
    }
  }

  const rootIds = new Set(build.pages.pages.map((page) => page.rootInstanceId));
  const dropped: DroppedOrgScript = {
    htmlEmbeds: 0,
    markdownEmbeds: 0,
    elementsWithUnknownTag: 0,
    svgAnimations: 0,
    rawHtmlProps: 0,
    customCode: (build.pages.meta?.code ?? "").trim() !== "",
  };
  const found = new Set<Instance["id"]>();
  const emptiedRoots = new Set<Instance["id"]>();
  for (const [, instance] of build.instances) {
    const kind = classify(instance, propsByInstance.get(instance.id));
    if (kind === undefined) {
      continue;
    }
    if (kind === "htmlEmbed") {
      dropped.htmlEmbeds += 1;
    } else if (kind === "markdownEmbed") {
      dropped.markdownEmbeds += 1;
    } else if (kind === "unknownTag") {
      dropped.elementsWithUnknownTag += 1;
    } else {
      dropped.svgAnimations += 1;
    }
    (rootIds.has(instance.id) ? emptiedRoots : found).add(instance.id);
  }

  const hasCode = build.pages.meta?.code !== undefined;
  const hasRawHtml = build.props.some(([, prop]) =>
    pausedPropNames.has(prop.name)
  );
  if (
    found.size === 0 &&
    emptiedRoots.size === 0 &&
    hasCode === false &&
    hasRawHtml === false
  ) {
    return bundle;
  }

  const instances = new Map(build.instances);
  const parentIds = new Map<Instance["id"], Set<Instance["id"]>>();
  for (const instance of instances.values()) {
    for (const child of instance.children) {
      if (child.type === "id") {
        const parents = parentIds.get(child.value) ?? new Set();
        parents.add(instance.id);
        parentIds.set(child.value, parents);
      }
    }
  }

  // Everything inside what was found
  const removed = new Set(found);
  const pending = [...found, ...emptiedRoots];
  while (pending.length > 0) {
    const instance = instances.get(pending.pop() as string);
    for (const child of instance?.children ?? []) {
      if (child.type === "id" && removed.has(child.value) === false) {
        removed.add(child.value);
        pending.push(child.value);
      }
    }
  }
  // An emptied root keeps its id but none of what it held
  const gone = (id: Instance["id"] | undefined) =>
    id !== undefined && (removed.has(id) || emptiedRoots.has(id));
  // ... except what an instance that stays still holds. Keeping one can keep
  // what is inside it, so repeat until nothing changes.
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of removed) {
      if (found.has(id)) {
        continue;
      }
      for (const parentId of parentIds.get(id) ?? []) {
        if (gone(parentId) === false) {
          removed.delete(id);
          changed = true;
          break;
        }
      }
    }
  }

  const { meta } = build.pages;
  const pages =
    meta === undefined
      ? build.pages
      : { ...build.pages, meta: withoutCode(meta) };

  // An instance that stays loses a prop that writes markup into it. Those of
  // an instance that goes are not counted twice.
  const keptProps = build.props.filter(
    ([, prop]) => gone(prop.instanceId) === false
  );
  dropped.rawHtmlProps = keptProps.filter(([, prop]) =>
    pausedPropNames.has(prop.name)
  ).length;

  const result: PublishedProjectBundle = {
    ...bundle,
    build: {
      ...build,
      pages,
      instances: build.instances.flatMap(([id, instance]) => {
        if (emptiedRoots.has(id)) {
          return [
            [id, { type: "instance", id, component: "Body", children: [] }],
          ] as Array<[Instance["id"], Instance]>;
        }
        if (removed.has(id)) {
          return [];
        }
        const children = instance.children.filter(
          (child) => child.type !== "id" || removed.has(child.value) === false
        );
        return [
          [
            id,
            children.length === instance.children.length
              ? instance
              : { ...instance, children },
          ],
        ] as Array<[Instance["id"], Instance]>;
      }),
      props: keptProps.filter(
        ([, prop]) => pausedPropNames.has(prop.name) === false
      ),
      dataSources: build.dataSources.filter(
        ([, dataSource]) => gone(dataSource.scopeInstanceId) === false
      ),
    },
  };

  const message = describeDroppedOrgScript(dropped);
  if (message !== undefined) {
    log?.(message);
  }
  return result;
};
