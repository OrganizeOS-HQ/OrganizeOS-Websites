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
 * - every entry of the build's pages, page templates, instances, props, data
 *   sources and Resources whose id a later entry holds too, or that is stored
 *   under another id than its own, so the rules below read what publishes;
 * - every HTML Embed, unless its code is a static string identical to one of
 *   the SVG icons upstream's own templates insert;
 * - every Markdown Embed (its renderer keeps `javascript:` links);
 * - every element whose tag is not one the builder offers: `script` ships a
 *   <script>, and a tag that is JSX syntax is written into the page module as
 *   code. The tag counts wherever it is held, on a component that makes an
 *   element from it or on one that passes it to the child that does (a Radix
 *   trigger);
 * - every instance of a component the page does not import
 *   (`componentMayShip`), and one stored with the global root's id
 *   (`instanceIdMayRun`), with what is inside it;
 * - every data source the page module cannot name as itself
 *   (`collidingDataSourceIds`), and so every parameter prop and every action
 *   that names one;
 * - the SVG `animate` and `set` elements (a `javascript:` link by SMIL);
 * - the `dangerouslySetInnerHTML` prop, which puts raw markup into any element;
 * - every unsafe address (a scheme other than http, https, mailto, tel and
 *   sms, or a bound value whose fixed start does not decide the scheme), every
 *   `srcdoc`, every event handler attribute that is not an action, and every
 *   action `actionMayRun` refuses (`propMayShip`): a click, a frame, an
 *   object or a form runs the address in the site's origin, React writes a
 *   string `on…` on a custom element, and the generator writes an action
 *   into the page module as code, which the site's server renders;
 * - every XML element (XML Node, XML Time) on an HTML or text page, where it
 *   is a custom element that keeps every attribute;
 * - every page or project redirect to an unsafe address, which a client-side
 *   navigation would follow with `window.location`;
 * - the site's custom code.
 *
 * Nothing is deleted from the build the org edits: the embeds and the code stay
 * saved and show as paused in the builder, and the next publish ships them
 * once the switch is on. The runtime packages and route templates are
 * untouched.
 */
import type { PublishedProjectBundle } from "@webstudio-is/protocol";
import {
  blockTemplateComponent,
  collectionComponent,
  ROOT_INSTANCE_ID,
  SYSTEM_VARIABLE_ID,
  type Instance,
  type Page,
  type Prop,
} from "@webstudio-is/sdk";
import * as baseComponentMetas from "@webstudio-is/sdk-components-react/metas";
import * as radixComponentMetas from "@webstudio-is/sdk-components-react-radix/metas";
import * as organizeosComponentMetas from "@organizeos/site-components/metas";
import {
  actionContextOf,
  checkAction,
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
  pausedPropNames,
  pausedSvgTags,
  projectRedirectMayShip,
  propMayShip,
  xmlComponents,
  type PageNames,
} from "@organizeos/site-components/org-script";
import { ORGANIZEOS_NAMESPACE } from "./organizeos-components";

/**
 * The components a page of the react-router framework imports, by the name a
 * build stores (framework-react-router.ts): upstream's base library, Radix's
 * and the OrganizeOS blocks. Prebuild passes the framework's own map; this is
 * what `dropOrgScript` reads without one.
 */
export const publishedComponents: ReadonlySet<Instance["component"]> = new Set([
  ...Object.keys(baseComponentMetas),
  ...Object.keys(radixComponentMetas).map(
    (name) => `@webstudio-is/sdk-components-react-radix:${name}`
  ),
  ...Object.keys(organizeosComponentMetas).map(
    (name) => `${ORGANIZEOS_NAMESPACE}:${name}`
  ),
]);

export type DroppedOrgScript = {
  htmlEmbeds: number;
  markdownEmbeds: number;
  /** Elements whose tag the builder does not offer, `script` among them */
  elementsWithUnknownTag: number;
  /** Instances of a component the page does not import */
  unknownComponents: number;
  /** Instances stored with the global root's id */
  reservedIds: number;
  /** SVG animate and set elements */
  svgAnimations: number;
  /** `dangerouslySetInnerHTML` props, on instances that stay */
  rawHtmlProps: number;
  /** XML Node and XML Time instances that an HTML or text page publishes */
  xmlElementsOnHtmlPages: number;
  /** Address props `propMayShip` refuses, on instances that stay */
  unsafeAddresses: number;
  /** `srcdoc` props, on instances that stay */
  frameDocuments: number;
  /** `on…` props that are not actions, on instances that stay */
  eventAttributes: number;
  /** Actions `actionMayRun` refuses, on instances that stay */
  unsafeActions: number;
  /** Data sources `collidingDataSourceIds` lists, that a page declares */
  conflictingDataSources: number;
  /** Page and project redirects to an unsafe address */
  redirects: number;
  customCode: boolean;
  /** Pages, instances, props, data sources and Resources stored under an id
   * that a later entry holds too, or under another id than their own */
  duplicateEntries: number;
  /** A Collection's item or key props that are not a parameter, on
   * instances that stay */
  collectionBindings: number;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** The line the publish workflow logs, for support. Nothing left out, no line. */
export const describeDroppedOrgScript = (dropped: DroppedOrgScript) => {
  const parts = [
    dropped.duplicateEntries > 0
      ? plural(dropped.duplicateEntries, "duplicate entry", "duplicate entries")
      : undefined,
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
    dropped.unknownComponents > 0
      ? plural(
          dropped.unknownComponents,
          "unknown component",
          "unknown components"
        )
      : undefined,
    dropped.reservedIds > 0
      ? plural(
          dropped.reservedIds,
          "element with a reserved id",
          "elements with a reserved id"
        )
      : undefined,
    dropped.svgAnimations > 0
      ? plural(
          dropped.svgAnimations,
          "animate or set element",
          "animate or set elements"
        )
      : undefined,
    dropped.xmlElementsOnHtmlPages > 0
      ? plural(
          dropped.xmlElementsOnHtmlPages,
          "XML element on an HTML page",
          "XML elements on an HTML page"
        )
      : undefined,
    dropped.rawHtmlProps > 0
      ? plural(dropped.rawHtmlProps, "raw HTML property", "raw HTML properties")
      : undefined,
    dropped.unsafeAddresses > 0
      ? plural(dropped.unsafeAddresses, "unsafe address", "unsafe addresses")
      : undefined,
    dropped.frameDocuments > 0
      ? plural(dropped.frameDocuments, "srcdoc attribute", "srcdoc attributes")
      : undefined,
    dropped.eventAttributes > 0
      ? plural(
          dropped.eventAttributes,
          "event handler attribute",
          "event handler attributes"
        )
      : undefined,
    dropped.unsafeActions > 0
      ? plural(dropped.unsafeActions, "unsafe action", "unsafe actions")
      : undefined,
    dropped.collectionBindings > 0
      ? plural(
          dropped.collectionBindings,
          "Collection item or key that is not a parameter",
          "Collection items or keys that are not a parameter"
        )
      : undefined,
    dropped.conflictingDataSources > 0
      ? plural(
          dropped.conflictingDataSources,
          "variable with a conflicting id",
          "variables with a conflicting id"
        )
      : undefined,
    dropped.redirects > 0
      ? plural(
          dropped.redirects,
          "redirect to an unsafe address",
          "redirects to an unsafe address"
        )
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

const withoutCode = <Meta extends { code?: string }>(meta: Meta) => {
  const { code: _code, ...rest } = meta;
  return rest;
};

type Kind =
  | "reservedId"
  | "unknownComponent"
  | "htmlEmbed"
  | "markdownEmbed"
  | "unknownTag"
  | "svgAnimation"
  | "xmlElement";

/**
 * The bundle's pages, read once from either shape: the current one lists every
 * page in `pages`, and the legacy one keeps the home page in `homePage`, beside
 * them (packages/project-migrations pages.ts), which comes first, as the
 * migration reads it. Deduplicated by id.
 */
const listPages = (pages: PublishedProjectBundle["build"]["pages"]) => {
  const { homePage } = pages as { homePage?: Page };
  const ids = new Set<Page["id"]>();
  return [...(homePage === undefined ? [] : [homePage]), ...pages.pages].filter(
    (page) => {
      if (ids.has(page.id)) {
        return false;
      }
      ids.add(page.id);
      return true;
    }
  );
};

/** The ids reached from `starts`, into a Content Block's templates or not. */
const collectIds = (
  instances: Map<Instance["id"], Instance>,
  starts: Iterable<Instance["id"]>,
  enterTemplates: boolean
) => {
  const seen = new Set<Instance["id"]>();
  const pending = [...starts];
  while (pending.length > 0) {
    const id = pending.pop() as Instance["id"];
    const instance = instances.get(id);
    if (
      instance === undefined ||
      seen.has(id) ||
      (enterTemplates === false &&
        instance.component === blockTemplateComponent)
    ) {
      continue;
    }
    seen.add(id);
    for (const child of instance.children) {
      if (child.type === "id") {
        pending.push(child.value);
      }
    }
  }
  return seen;
};

/** Whether a page's status is a literal redirect status (300 to 399). */
const isRedirectStatus = (status: undefined | string) => {
  if (status === undefined) {
    return false;
  }
  try {
    const value: unknown = JSON.parse(status);
    const code =
      typeof value === "number" || typeof value === "string"
        ? Number(value)
        : Number.NaN;
    return code >= 300 && code <= 399;
  } catch {
    return false;
  }
};

/**
 * The page without a redirect to an unsafe address, and without its status
 * when that is a literal 3xx, which would answer with no Location. The same
 * page when its redirect ships.
 */
const withSafeRedirect = (page: Page): Page => {
  if (pageRedirectMayShip(page, false)) {
    return page;
  }
  const { redirect: _redirect, status, ...meta } = page.meta;
  return {
    ...page,
    meta:
      status === undefined || isRedirectStatus(status)
        ? meta
        : { ...meta, status },
  };
};

// `ws:element` writes <${instance.tag}> into the page module. Box, Text and
// Heading create their element from a `data-ws-tag` prop (the generator emits
// `instance.tag` under that name on every component but ws:element, and a user
// prop of that name comes after it and wins) and then their legacy `tag` prop,
// and DialogTitle from its `tag` prop. A Radix trigger (asChild with a spread)
// passes its own props to the child it renders, so a `data-ws-tag` or `tag` on
// the trigger reaches a Box, Text or Heading inside it. So the tag of every
// instance, and every `data-ws-tag` or `tag` prop, must be a tag the builder
// offers, whichever component holds it: ws:element keeps those props as
// attributes, and XML Node takes any tag by design (`checksInstanceTag` and
// `checksTagProp`, in org-script.ts). A tag is one the builder offers when
// `elementTagMayRun` says so; the canvas applies the same rule, and makes no
// `animate` or `set` either (`elementTagMayRender`).
const classify = (
  instance: Instance,
  props: Prop[] = [],
  components: ReadonlySet<Instance["component"]>
): undefined | Kind => {
  if (instanceIdMayRun(instance.id, false) === false) {
    return "reservedId";
  }
  if (componentMayShip(instance.component, components) === false) {
    return "unknownComponent";
  }
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
  if (checksInstanceTag(instance.component) === false) {
    return;
  }
  const staticTags: string[] = [];
  if (instance.tag !== undefined) {
    // The match is exact and case-sensitive, as the Tag control's list is
    if (elementTagMayRun(instance.tag, false) === false) {
      return "unknownTag";
    }
    staticTags.push(instance.tag);
  }
  for (const prop of props) {
    if (checksTagProp(instance.component, prop.name) === false) {
      continue;
    }
    if (
      prop.type !== "string" ||
      elementTagMayRun(prop.value, false) === false
    ) {
      return "unknownTag";
    }
    staticTags.push(prop.value);
  }
  if (staticTags.some((tag) => pausedSvgTags.has(tag))) {
    return "svgAnimation";
  }
};

/** One entry per id, the last, each under its own id */
const lastEntries = <Item extends { id: string }>(
  entries: ReadonlyArray<readonly [string, Item]>
) => {
  const kept = new Map<string, Item>();
  for (const [id, item] of entries) {
    if (id === item.id) {
      kept.set(id, item);
    }
  }
  return {
    entries: Array.from(kept) as Array<[string, Item]>,
    dropped: entries.length - kept.size,
  };
};

/** One item per id, the last */
const lastItems = <Item extends { id: string }>(items: readonly Item[]) => {
  const kept = new Map(items.map((item) => [item.id, item]));
  return {
    items: Array.from(kept.values()),
    dropped: items.length - kept.size,
  };
};

/**
 * The build with one entry per id in its pages, page templates, instances,
 * props, data sources and Resources: the last, which the builder keeps when
 * it reads a build. An entry stored under another id than its own goes too.
 * The Publish dialog reads the builder's maps, which hold one entry per id
 * already.
 */
const withOneEntryPerId = (
  input: PublishedProjectBundle["build"]
): { build: PublishedProjectBundle["build"]; duplicates: number } => {
  const instances = lastEntries(input.instances);
  const props = lastEntries(input.props);
  const dataSources = lastEntries(input.dataSources);
  const resources = lastEntries(input.resources ?? []);
  const pages = lastItems(input.pages.pages);
  const { pageTemplates } = input.pages;
  const templates = Array.isArray(pageTemplates)
    ? lastItems(pageTemplates)
    : undefined;
  const duplicates =
    instances.dropped +
    props.dropped +
    dataSources.dropped +
    resources.dropped +
    pages.dropped +
    (templates?.dropped ?? 0);
  if (duplicates === 0) {
    return { build: input, duplicates };
  }
  return {
    duplicates,
    build: {
      ...input,
      pages: {
        ...input.pages,
        pages: pages.items,
        ...(templates === undefined ? {} : { pageTemplates: templates.items }),
      },
      instances: instances.entries,
      props: props.entries,
      dataSources: dataSources.entries,
      ...(input.resources === undefined
        ? {}
        : { resources: resources.entries }),
    },
  };
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
 * page still builds. A `dangerouslySetInnerHTML` prop, and a prop that
 * `propMayShip` refuses, is dropped from its instance, which stays. A page
 * redirect to an unsafe address goes with the page's literal 3xx status, and
 * a project redirect to one goes from the list. A data source that
 * `collidingDataSourceIds` lists goes, with a parameter prop that names it,
 * and an action is judged without it. An action that names a data source
 * that goes for any reason goes too, so what stays passes input validation.
 * What is left out is counted only where a page publishes it. `components`
 * are the components the page imports, the framework's.
 */
export const dropOrgScript = (
  bundle: PublishedProjectBundle,
  {
    mayRun = orgScriptMayRun(),
    components = publishedComponents,
    log,
  }: {
    mayRun?: boolean;
    components?: ReadonlySet<Instance["component"]>;
    log?: (message: string) => void;
  } = {}
): PublishedProjectBundle => {
  if (mayRun) {
    return bundle;
  }
  // Every rule reads one entry per id, the last, as the builder does, and so
  // does everything after it
  const { build, duplicates } = withOneEntryPerId(bundle.build);

  const propsByInstance = new Map<Instance["id"], Prop[]>();
  for (const [, prop] of build.props) {
    const props = propsByInstance.get(prop.instanceId);
    if (props === undefined) {
      propsByInstance.set(prop.instanceId, [prop]);
    } else {
      props.push(prop);
    }
  }

  // One list of pages, in either shape, for the roots, the walk of what HTML
  // and text pages publish, and the redirects
  const allPages = listPages(build.pages);
  const rootIds = new Set(allPages.map((page) => page.rootInstanceId));
  const instances = new Map(build.instances);
  const dataSources = new Map(build.dataSources);
  // the page templates, in either shape
  const templates = Object.values(
    (build.pages as { pageTemplates?: Record<string, PageNames> })
      .pageTemplates ?? {}
  );
  const names = {
    instances,
    dataSources,
    props: new Map(build.props),
    resources: new Map(build.resources ?? []),
    pages: [...allPages, ...templates].map(
      ({ rootInstanceId, systemDataSourceId }) => ({
        rootInstanceId,
        systemDataSourceId,
      })
    ),
  };
  const collidingIds = collidingDataSourceIds(names);
  // what an action's rule reads, as the canvas and the Publish dialog read it
  const actionContext = actionContextOf({
    ...names,
    pageRootIds: rootIds,
    templateRootIds: new Set(
      templates.map((template) => template.rootInstanceId)
    ),
  });
  const dropped: DroppedOrgScript = {
    htmlEmbeds: 0,
    markdownEmbeds: 0,
    elementsWithUnknownTag: 0,
    unknownComponents: 0,
    reservedIds: 0,
    svgAnimations: 0,
    rawHtmlProps: 0,
    xmlElementsOnHtmlPages: 0,
    unsafeAddresses: 0,
    frameDocuments: 0,
    eventAttributes: 0,
    unsafeActions: 0,
    conflictingDataSources: 0,
    redirects: 0,
    customCode: (build.pages.meta?.code ?? "").trim() !== "",
    duplicateEntries: duplicates,
    collectionBindings: 0,
  };
  const found = new Set<Instance["id"]>();
  const emptiedRoots = new Set<Instance["id"]>();
  // What a page publishes: anything else is left out like the rest, but not
  // counted, as the Publish dialog does not list it
  const publishedIds = collectIds(instances, rootIds, false);
  // An XML element is a custom element on an HTML or text page, which keeps
  // every attribute. One that a Slot also shows on an XML page goes from both.
  const publishedOnHtmlPages = collectIds(
    instances,
    allPages
      .filter((page) => page.meta.documentType !== "xml")
      .map((page) => page.rootInstanceId),
    false
  );
  for (const [, instance] of build.instances) {
    // The builder's global root is virtual: an instance stored with its id is
    // crafted, and goes. The global data sources stay.
    const kind =
      classify(instance, propsByInstance.get(instance.id), components) ??
      (xmlComponents.has(instance.component) &&
      publishedOnHtmlPages.has(instance.id)
        ? "xmlElement"
        : undefined);
    if (kind === undefined) {
      continue;
    }
    if (publishedIds.has(instance.id)) {
      if (kind === "reservedId") {
        dropped.reservedIds += 1;
      } else if (kind === "unknownComponent") {
        dropped.unknownComponents += 1;
      } else if (kind === "htmlEmbed") {
        dropped.htmlEmbeds += 1;
      } else if (kind === "markdownEmbed") {
        dropped.markdownEmbeds += 1;
      } else if (kind === "unknownTag") {
        dropped.elementsWithUnknownTag += 1;
      } else if (kind === "xmlElement") {
        dropped.xmlElementsOnHtmlPages += 1;
      } else {
        dropped.svgAnimations += 1;
      }
    }
    (rootIds.has(instance.id) ? emptiedRoots : found).add(instance.id);
  }

  // A prop that may not ship, judged on the instance that holds it
  const propFails = (prop: Prop) => {
    const holder = instances.get(prop.instanceId);
    return (
      holder !== undefined &&
      propMayShip(holder, prop, false, actionContext) === false
    );
  };
  const projectRedirects = build.pages.redirects;
  const shippedProjectRedirects = projectRedirects?.filter((redirect) =>
    projectRedirectMayShip(redirect, false)
  );
  const unsafePageRedirects = allPages.filter(
    (page) => pageRedirectMayShip(page, false) === false
  ).length;

  const hasCode = build.pages.meta?.code !== undefined;
  const hasRawHtml = build.props.some(([, prop]) =>
    pausedPropNames.has(prop.name)
  );
  if (
    duplicates === 0 &&
    found.size === 0 &&
    emptiedRoots.size === 0 &&
    collidingIds.size === 0 &&
    hasCode === false &&
    hasRawHtml === false &&
    build.props.some(([, prop]) => propFails(prop)) === false &&
    unsafePageRedirects === 0 &&
    shippedProjectRedirects?.length === projectRedirects?.length
  ) {
    return bundle;
  }

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

  // The custom code goes, and so does a redirect to an unsafe address: a
  // page's with its literal 3xx status, and a project redirect from the list,
  // the others kept in order
  let pages = build.pages;
  const { meta } = pages;
  if (meta !== undefined) {
    pages = { ...pages, meta: withoutCode(meta) };
  }
  if (unsafePageRedirects > 0) {
    const { homePage } = pages as { homePage?: Page };
    pages = {
      ...pages,
      pages: pages.pages.map(withSafeRedirect),
      ...(homePage === undefined
        ? {}
        : { homePage: withSafeRedirect(homePage) }),
    };
  }
  if (shippedProjectRedirects?.length !== projectRedirects?.length) {
    pages = { ...pages, redirects: shippedProjectRedirects };
  }
  dropped.redirects =
    unsafePageRedirects +
    (projectRedirects?.length ?? 0) -
    (shippedProjectRedirects?.length ?? 0);

  // An instance that stays loses a prop that writes markup into it, and one
  // that may not ship. Those of an instance that goes are not counted twice,
  // nor are those of an instance that never ships.
  const keptProps = build.props.filter(
    ([, prop]) => gone(prop.instanceId) === false
  );
  for (const [, prop] of keptProps) {
    if (publishedIds.has(prop.instanceId) === false) {
      continue;
    }
    if (pausedPropNames.has(prop.name)) {
      dropped.rawHtmlProps += 1;
    } else if (propFails(prop)) {
      if (prop.type === "action") {
        dropped.unsafeActions += 1;
      } else if (
        instances.get(prop.instanceId)?.component === collectionComponent &&
        collectionBindingNames.has(prop.name)
      ) {
        dropped.collectionBindings += 1;
      } else if (isFrameDocumentName(prop.name)) {
        dropped.frameDocuments += 1;
      } else if (isEventAttributeName(prop.name)) {
        dropped.eventAttributes += 1;
      } else {
        dropped.unsafeAddresses += 1;
      }
    }
  }

  // a global data source stays: every page declares it
  const keptDataSources = build.dataSources.filter(
    ([id, dataSource]) =>
      collidingIds.has(id) === false &&
      (dataSource.scopeInstanceId === ROOT_INSTANCE_ID ||
        gone(dataSource.scopeInstanceId) === false)
  );
  const keptDataSourceIds = new Set([
    SYSTEM_VARIABLE_ID,
    ...keptDataSources.map(([id]) => id),
  ]);
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
      // a parameter prop that names a data source that goes, goes too, and
      // so does an action that names one (only an instance no page
      // publishes can hold such an action, so it is not counted)
      props: keptProps.filter(
        ([, prop]) =>
          pausedPropNames.has(prop.name) === false &&
          propFails(prop) === false &&
          (prop.type !== "parameter" ||
            collidingIds.has(prop.value) === false) &&
          (prop.type !== "action" ||
            checkAction(prop.value, { dataSourceIds: keptDataSourceIds }).ok)
      ),
      dataSources: keptDataSources,
    },
  };
  // A data source that goes for its id is counted where a page declares it:
  // a global one, or one of an instance a page publishes that stays (one
  // with no scope is read as held by an instance whose id is empty)
  for (const [id, dataSource] of build.dataSources) {
    const scope = dataSource.scopeInstanceId ?? "";
    if (
      collidingIds.has(id) &&
      (scope === ROOT_INSTANCE_ID ||
        (publishedIds.has(scope) && gone(scope) === false))
    ) {
      dropped.conflictingDataSources += 1;
    }
  }

  const message = describeDroppedOrgScript(dropped);
  if (message !== undefined) {
    log?.(message);
  }
  return result;
};
