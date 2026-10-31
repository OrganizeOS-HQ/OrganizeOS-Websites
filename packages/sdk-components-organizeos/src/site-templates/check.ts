import { hyphenateProperty } from "@webstudio-is/css-engine";
import {
  type Instance,
  type WebstudioFragment,
  pagePath,
} from "@webstudio-is/sdk";
import { contrastRatio } from "./canonical-variables";
import type { BlockKey } from "./place-block";
import { findStyleProblems } from "./style-scan";
import { renderSiteTemplate, type RenderedPage } from "./render";
import { isSectionLabel } from "./sections";
import type { SiteTemplate } from "./types";

// The rules every template is held to (spec section 2, checked as spec 6.1
// lists). Each violation is one line naming the page, or the image or
// variables it is about. A backstop to review, not a replacement for it.

/** Party names and the like, matched as whole words in any case. */
export const NEUTRALITY_DENY_LIST = [
  "democrat",
  "democratic party",
  "republican",
  "gop",
  "libertarian",
  "green party",
  "socialist",
  "communist",
  "conservative party",
  "labor party",
  "labour party",
  "maga",
  "progressive party",
];

const denyPatterns = NEUTRALITY_DENY_LIST.map(
  (entry) => new RegExp(`\\b${entry.replaceAll(" ", "\\s+")}\\b`, "i")
);

// The components a platform block's root is; a template reaches them only
// through placeBlock.
const blockRootComponents = new Set([
  "@organizeos/site-components:SignupForm",
  "@organizeos/site-components:RsvpForm",
  "@organizeos/site-components:ShareCodeCarrier",
]);

// The platform blocks that list or feature events; a section holds one.
const eventBlockKeys = new Set<BlockKey>([
  "@organizeos/site-components:EventCard",
  "@organizeos/site-components:EventList",
]);

// The org's provisioned sign-up page, which applying a template keeps (rule 8).
const signupPagePath = "/newsletter";

// The 404 page `createPages()` makes for every project.
const notFoundPagePath = "/*";

// Text, and the base text on an accent-1 band, is read, so it needs 4.5:1
// (WCAG AA). --accent-2 draws the focus ring, a graphic, which needs 3:1.
const contrastChecks = [
  { foreground: "text", background: "base", minimum: 4.5 },
  { foreground: "base", background: "accent-1", minimum: 4.5 },
  { foreground: "accent-2", background: "base", minimum: 3 },
] as const;

const pageName = (key: string) => `Page "${key}"`;

// "@organizeos/site-components:SignupForm" reads as "SignupForm".
const componentName = (component: string) => component.split(":").pop();

const describeInstance = (instance: Instance) => {
  if (instance.label) {
    return `"${instance.label}"`;
  }
  const kind = instance.tag
    ? `<${instance.tag}>`
    : componentName(instance.component);
  return `the ${kind} with id "${instance.id}"`;
};

/** The instance a prop is on, or its id when the fragment lacks it. */
const describePropOwner = (
  fragment: WebstudioFragment,
  instanceId: Instance["id"]
) => {
  const instance = fragment.instances.find((item) => item.id === instanceId);
  return instance ? describeInstance(instance) : `"${instanceId}"`;
};

const deniedWords = (text: string) =>
  denyPatterns.flatMap((pattern) => pattern.exec(text)?.[0] ?? []);

const checkPagePaths = (template: SiteTemplate): string[] => {
  const violations: string[] = [];
  const keysByPath = new Map<string, string[]>();
  for (const page of template.pages) {
    keysByPath.set(page.path, [...(keysByPath.get(page.path) ?? []), page.key]);
    if (page.path === signupPagePath) {
      violations.push(
        `${pageName(page.key)} is at ${signupPagePath}, which belongs to the org's sign-up page`
      );
    } else if (page.path === notFoundPagePath) {
      violations.push(
        `${pageName(page.key)} is at ${notFoundPagePath}, which belongs to the 404 page`
      );
    } else if (page.path !== "") {
      // the rules the builder's page settings hold a path to
      const parsed = pagePath.safeParse(page.path);
      if (parsed.success === false) {
        const reasons = parsed.error.issues.map((issue) => issue.message);
        violations.push(
          `${pageName(page.key)} has the path "${page.path}", which is not a page path (${reasons.join("; ")})`
        );
      }
    }
  }
  for (const [path, keys] of keysByPath) {
    if (keys.length > 1) {
      const names = keys.map((key) => `"${key}"`).join(", ");
      violations.push(`Pages ${names} share the path "${path}"`);
    }
  }
  if (keysByPath.has("") === false) {
    violations.push(`No page is the Home page (path "")`);
  }
  return violations;
};

const checkPageText = (template: SiteTemplate): string[] =>
  template.pages.flatMap((page) => [
    ...deniedWords(page.title).map(
      (word) =>
        `${pageName(page.key)}: the title says "${word}", which is on the neutrality deny list`
    ),
    ...deniedWords(page.description).map(
      (word) =>
        `${pageName(page.key)}: the description says "${word}", which is on the neutrality deny list`
    ),
  ]);

// The apply routine uploads an image by its URL, resolved against the
// builder's origin. A file small enough for Vite to inline as a data: URL is
// not one it can upload.
const isUploadableUrl = (url: string) => {
  if (url.startsWith("/")) {
    return url.startsWith("//") === false;
  }
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

const checkImageEntries = (template: SiteTemplate): string[] => [
  ...(Object.hasOwn(template.images, template.thumbnail)
    ? []
    : [
        `The thumbnail "${template.thumbnail}" is not one of the template's images`,
      ]),
  ...Object.entries(template.images).flatMap(([file, entry]) => [
    ...(isUploadableUrl(entry.url)
      ? []
      : [`Image "${file}" has a URL that is not root-relative or http(s)`]),
    ...(entry.sourceUrl.trim() === ""
      ? [`Image "${file}" has no source URL`]
      : []),
    ...(entry.alt.trim() === "" ? [`Image "${file}" has no alt text`] : []),
  ]),
];

const checkContrast = (template: SiteTemplate): string[] =>
  contrastChecks.flatMap(({ foreground, background, minimum }) => {
    const pair = `${foreground} on ${background}`;
    try {
      const ratio = contrastRatio(
        template.variables[foreground],
        template.variables[background]
      );
      return ratio < minimum
        ? [
            `Variables: ${pair} has a contrast of ${ratio.toFixed(2)}:1, below ${minimum}:1`,
          ]
        : [];
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return [`Variables: ${pair} cannot be checked (${reason})`];
    }
  });

const instancesById = (fragment: WebstudioFragment) =>
  new Map(fragment.instances.map((instance) => [instance.id, instance]));

/** The ids of the instances `rootIds` name and everything under them. */
const subtreeIds = (
  instances: Map<Instance["id"], Instance>,
  rootIds: Instance["id"][]
) => {
  const ids = new Set<string>();
  const pending = [...rootIds];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (ids.has(id)) {
      continue;
    }
    ids.add(id);
    for (const child of instances.get(id)?.children ?? []) {
      if (child.type === "id") {
        pending.push(child.value);
      }
    }
  }
  return ids;
};

/** The ids of every placed block's root and everything under it. */
const placedBlockIds = (page: RenderedPage) =>
  subtreeIds(
    instancesById(page.fragment),
    page.placements.map((placement) => placement.rootId)
  );

/** The page's body: the fragment's one root, when it is a <body>. */
const bodyOf = (fragment: WebstudioFragment) => {
  const [root, ...otherRoots] = fragment.children;
  const instance =
    root?.type === "id" && otherRoots.length === 0
      ? fragment.instances.find((item) => item.id === root.value)
      : undefined;
  return instance?.tag === "body" ? instance : undefined;
};

const checkStyles = (page: RenderedPage, blockIds: Set<string>): string[] => {
  const { fragment } = page;
  const instances = instancesById(fragment);
  // A style source is checked when any instance outside a placed block
  // selects it, so a block's token used by the page's own element is too.
  const checkedSources = new Set(
    fragment.styleSourceSelections.flatMap((selection) =>
      blockIds.has(selection.instanceId) ? [] : selection.values
    )
  );
  const describeSource = (styleSourceId: string) => {
    const source = fragment.styleSources.find(
      (item) => item.id === styleSourceId
    );
    if (source?.type === "token") {
      return `token "${source.name}"`;
    }
    const owner = fragment.styleSourceSelections.find((selection) =>
      selection.values.includes(styleSourceId)
    );
    const instance = owner && instances.get(owner.instanceId);
    return instance ? describeInstance(instance) : `style "${styleSourceId}"`;
  };
  return fragment.styles.flatMap((decl) => {
    if (checkedSources.has(decl.styleSourceId) === false) {
      return [];
    }
    return findStyleProblems(decl.property, decl.value).map(
      (problem) =>
        `${pageName(page.key)}: ${hyphenateProperty(decl.property)} on ${describeSource(decl.styleSourceId)} uses ${problem}`
    );
  });
};

// An image on the page's own elements comes from the template's images
// (image(file)), so its source (CC0 or OrganizeOS's own) is recorded and the
// apply routine uploads it, and it carries alt text. A placed block's image is
// bound to its records.
const checkImageInstances = (
  page: RenderedPage,
  blockIds: Set<string>
): string[] => {
  const { fragment } = page;
  return fragment.instances.flatMap((instance) => {
    if (
      blockIds.has(instance.id) ||
      (instance.component !== "Image" && instance.tag !== "img")
    ) {
      return [];
    }
    const prop = (name: string) =>
      fragment.props.find(
        (item) => item.instanceId === instance.id && item.name === name
      );
    const src = prop("src");
    const alt = prop("alt");
    const where = `${pageName(page.key)}: ${describeInstance(instance)}`;
    return [
      ...(src?.type === "asset"
        ? []
        : [`${where} has a src that is not one of the template's images`]),
      ...(alt?.type === "string" && alt.value.trim() !== ""
        ? []
        : [`${where} has no alt text`]),
    ];
  });
};

const checkBlocks = (page: RenderedPage): string[] => {
  const roots = new Set(page.placements.map((placement) => placement.rootId));
  return page.fragment.instances.flatMap((instance) =>
    blockRootComponents.has(instance.component) &&
    roots.has(instance.id) === false
      ? [
          `${pageName(page.key)}: ${describeInstance(instance)} is a ${componentName(instance.component)} not placed with placeBlock`,
        ]
      : []
  );
};

// A link names a page by the id renderSiteTemplate gave it, so a mistyped
// pageIds key links nowhere. A link to an element of a page is refused too:
// applying the template gives the element a new id, and the link loses it.
const checkPageLinks = (page: RenderedPage, pageIds: Set<string>): string[] => {
  const { fragment } = page;
  return fragment.props.flatMap((prop) => {
    if (prop.type !== "page") {
      return [];
    }
    const where = `${pageName(page.key)}: the "${prop.name}" of ${describePropOwner(fragment, prop.instanceId)}`;
    // PageValue(undefined) leaves the value undefined, whatever its type says
    const value: unknown = prop.value;
    if (typeof value === "object" && value !== null) {
      return [`${where} links to an element of a page`];
    }
    return typeof value === "string" && pageIds.has(value)
      ? []
      : [`${where} links to a page the template does not have`];
  });
};

// Every top-level child of a body is a section named from the vocabulary
// (spec section 3), so the Navigator reads the same on every template. What
// is inside a section is the template's own.
const checkSectionLabels = (page: RenderedPage): string[] => {
  const body = bodyOf(page.fragment);
  if (body === undefined) {
    return [];
  }
  const name = pageName(page.key);
  const instances = instancesById(page.fragment);
  return body.children.flatMap((child) => {
    if (child.type !== "id") {
      const kind = child.type === "text" ? "text" : "an expression";
      return [`${name}: the body holds ${kind} outside a section`];
    }
    const instance = instances.get(child.value);
    if (instance === undefined) {
      return [];
    }
    if (instance.label === undefined) {
      return [
        `${name}: ${describeInstance(instance)} in the body has no label; every section carries a name from SECTION_LABELS`,
      ];
    }
    return isSectionLabel(instance.label)
      ? []
      : [
          `${name}: "${instance.label}" in the body is not a name from SECTION_LABELS (a variant follows a colon, as in "Hero: Split")`,
        ];
  });
};

// One events block per section: an Event Card (a featured event) or an Event
// List, never both under one heading. The section is the child of the body
// that a block sits under, however deep.
const checkEventBlocks = (page: RenderedPage): string[] => {
  const body = bodyOf(page.fragment);
  const events = page.placements.filter((placement) =>
    eventBlockKeys.has(placement.key)
  );
  if (body === undefined || events.length < 2) {
    return [];
  }
  const instances = instancesById(page.fragment);
  return body.children.flatMap((child) => {
    const section =
      child.type === "id" ? instances.get(child.value) : undefined;
    if (section === undefined) {
      return [];
    }
    const inSection = subtreeIds(instances, [section.id]);
    const held = events.filter((placement) => inSection.has(placement.rootId));
    if (held.length < 2) {
      return [];
    }
    const kinds = held.map((placement) => componentName(placement.key));
    return [
      `${pageName(page.key)}: ${describeInstance(section)} holds ${held.length} events blocks (${kinds.join(", ")}); a section holds one`,
    ];
  });
};

const checkFragment = (page: RenderedPage): string[] => {
  const { fragment } = page;
  const name = pageName(page.key);
  const violations: string[] = [];
  // Applying makes the root the page's body.
  if (bodyOf(fragment) === undefined) {
    violations.push(`${name}: the root is not one <body> element`);
  }
  if (fragment.resources.length > 0) {
    violations.push(
      `${name}: holds ${fragment.resources.length} Resource(s); a template holds none`
    );
  }
  const counts = new Map<string, number>();
  for (const instance of fragment.instances) {
    counts.set(instance.id, (counts.get(instance.id) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    if (count > 1) {
      violations.push(
        `${name}: the instance id "${id}" is used ${count} times`
      );
    }
  }
  const headings = fragment.instances.filter(
    (instance) => instance.tag === "h1"
  ).length;
  if (headings !== 1) {
    violations.push(
      `${name}: has ${headings} h1 headings; a page has exactly one`
    );
  }
  return violations;
};

const checkFragmentText = (page: RenderedPage): string[] => {
  const { fragment } = page;
  const found = (where: string, text: string) =>
    deniedWords(text).map(
      (word) =>
        `${pageName(page.key)}: ${where} says "${word}", which is on the neutrality deny list`
    );
  return [
    ...fragment.instances.flatMap((instance) =>
      instance.children.flatMap((child) =>
        child.type === "text"
          ? found(
              `${child.placeholder ? "a placeholder" : "the text"} in ${describeInstance(instance)}`,
              child.value
            )
          : []
      )
    ),
    ...fragment.props.flatMap((prop) => {
      if (prop.type !== "string") {
        return [];
      }
      return found(
        `the "${prop.name}" of ${describePropOwner(fragment, prop.instanceId)}`,
        prop.value
      );
    }),
  ];
};

/**
 * Checks a template against the rules a template's test holds it to: an
 * empty list when it passes, otherwise one readable line per violation.
 * Renders every page with stand-in asset and page ids.
 */
export const checkSiteTemplate = (template: SiteTemplate): string[] => {
  const violations = [
    ...checkPagePaths(template),
    ...checkPageText(template),
    ...checkImageEntries(template),
    ...checkContrast(template),
  ];
  let pages: RenderedPage[];
  try {
    let pageCount = 0;
    pages = renderSiteTemplate(template, {
      assetIds: new Map(
        Object.keys(template.images).map((file) => [file, `asset:${file}`])
      ),
      generatePageId: () => {
        pageCount += 1;
        return `page:${pageCount}`;
      },
    });
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
    return violations;
  }
  const pageIds = new Set(pages.map((page) => page.pageId));
  for (const page of pages) {
    const blockIds = placedBlockIds(page);
    violations.push(
      ...checkBlocks(page),
      ...checkPageLinks(page, pageIds),
      ...checkStyles(page, blockIds),
      ...checkImageInstances(page, blockIds),
      ...checkFragment(page),
      ...checkSectionLabels(page),
      ...checkEventBlocks(page),
      ...checkFragmentText(page)
    );
  }
  return violations;
};
