import { hyphenateProperty } from "@webstudio-is/css-engine";
import type { Instance } from "@webstudio-is/sdk";
import { contrastRatio } from "./canonical-variables";
import { findStyleProblems } from "./style-scan";
import { renderSiteTemplate, type RenderedPage } from "./render";
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

// The org's provisioned sign-up page, which applying a template keeps (rule 8).
const signupPagePath = "/newsletter";

const minimumContrast = 4.5;

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

const checkImages = (template: SiteTemplate): string[] =>
  Object.entries(template.images).flatMap(([file, entry]) => [
    ...(entry.sourceUrl.trim() === ""
      ? [`Image "${file}" has no source URL`]
      : []),
    ...(entry.alt.trim() === "" ? [`Image "${file}" has no alt text`] : []),
  ]);

const checkContrast = (template: SiteTemplate): string[] => {
  const pairs = [
    ["text", "base"],
    ["base", "accent-1"],
  ] as const;
  return pairs.flatMap(([foreground, background]) => {
    const pair = `${foreground} on ${background}`;
    try {
      const ratio = contrastRatio(
        template.variables[foreground],
        template.variables[background]
      );
      return ratio < minimumContrast
        ? [
            `Variables: ${pair} has a contrast of ${ratio.toFixed(2)}:1, below ${minimumContrast}:1`,
          ]
        : [];
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return [`Variables: ${pair} cannot be checked (${reason})`];
    }
  });
};

/** The ids of every placed block's root and everything under it. */
const placedBlockIds = (page: RenderedPage) => {
  const instances = new Map(
    page.fragment.instances.map((instance) => [instance.id, instance])
  );
  const ids = new Set<string>();
  const pending = page.placements.map((placement) => placement.rootId);
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

const checkStyles = (page: RenderedPage): string[] => {
  const { fragment } = page;
  const blockIds = placedBlockIds(page);
  const instances = new Map(
    fragment.instances.map((instance) => [instance.id, instance])
  );
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

const checkFragment = (page: RenderedPage): string[] => {
  const { fragment } = page;
  const name = pageName(page.key);
  const violations: string[] = [];
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
      const instance = fragment.instances.find(
        (item) => item.id === prop.instanceId
      );
      const owner = instance
        ? describeInstance(instance)
        : `"${prop.instanceId}"`;
      return found(`the "${prop.name}" of ${owner}`, prop.value);
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
    ...checkImages(template),
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
  for (const page of pages) {
    violations.push(
      ...checkBlocks(page),
      ...checkStyles(page),
      ...checkFragment(page),
      ...checkFragmentText(page)
    );
  }
  return violations;
};
