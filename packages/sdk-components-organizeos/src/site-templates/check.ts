import { camelCaseProperty, parseMediaQuery } from "@webstudio-is/css-data";
import { hyphenateProperty } from "@webstudio-is/css-engine";
import {
  type Breakpoint,
  type Instance,
  type WebstudioFragment,
  initialBreakpoints,
  pagePath,
} from "@webstudio-is/sdk";
import {
  CANONICAL_FONT_NAMES,
  contrastRatio,
  firstFontFamily,
} from "./canonical-variables";
import type { BlockKey } from "./place-block";
import { PLATFORM_PATHS, isPlatformPath } from "./platform-paths";
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

// The fonts a visitor's system has, which a template names first without
// bundling: CSS's generic families and the system fonts of the major
// platforms. Matched in any case.
const systemFontFamilies = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "math",
  "emoji",
  "fangsong",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "arial",
  "helvetica",
  "helvetica neue",
  "georgia",
  "times",
  "times new roman",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "courier new",
]);

// The open licences a bundled font may carry (spec section 2, rule 10: OFL
// or Apache), as SPDX ids.
const fontLicences = new Set(["OFL-1.1", "Apache-2.0"]);

// Text, and the base text on an accent-1 band, is read, so it needs 4.5:1
// (WCAG AA). --accent-2 draws the focus ring, a graphic, which needs 3:1.
const contrastChecks = [
  { foreground: "text", background: "base", minimum: 4.5 },
  { foreground: "base", background: "accent-1", minimum: 4.5 },
  { foreground: "accent-2", background: "base", minimum: 3 },
] as const;

// The project's own breakpoints, the only ones a template's styles use (the
// wave's global constraints): the base, and the max-width ones every project
// is created with.
const projectMaxWidths = initialBreakpoints.flatMap(({ maxWidth }) =>
  maxWidth === undefined ? [] : [maxWidth]
);

type Media = Pick<Breakpoint, "minWidth" | "maxWidth" | "condition">;

const describeMedia = ({ minWidth, maxWidth, condition }: Media) =>
  [
    ...(minWidth === undefined ? [] : [`(min-width: ${minWidth}px)`]),
    ...(maxWidth === undefined ? [] : [`(max-width: ${maxWidth}px)`]),
    ...(condition === undefined ? [] : [`(${condition})`]),
  ].join(" and ");

/** What is wrong with the breakpoint a declaration is under, if anything. */
const findBreakpointProblem = (media: Media): string | undefined => {
  const { minWidth, maxWidth, condition } = media;
  if (
    minWidth === undefined &&
    condition === undefined &&
    (maxWidth === undefined || projectMaxWidths.includes(maxWidth))
  ) {
    return;
  }
  const widths = projectMaxWidths.map((width) => `${width}px`).join(", ");
  return `is under the media query ${describeMedia(media)}, not one of the project's breakpoints (the base, or max-width ${widths})`;
};

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

// The apply routine uploads an image by its URL, and fetches a font from
// its URL, resolved against the builder's origin. A file small enough for
// Vite to inline as a data: URL is not one it can upload, and a font inlined
// so weighs on the chooser's chunk.
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
  ...(template.previewEventCover === undefined ||
  Object.hasOwn(template.images, template.previewEventCover)
    ? []
    : [
        `The preview event cover "${template.previewEventCover}" is not one of the template's images`,
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

const checkFontEntries = (template: SiteTemplate): string[] => {
  // a publish keeps a font only when a variable names its family first
  const named = new Set(
    CANONICAL_FONT_NAMES.map((name) =>
      firstFontFamily(template.variables[name])
    )
  );
  return Object.entries(template.fonts).flatMap(([file, entry]) => {
    const font = `Font "${file}"`;
    return [
      ...(file.endsWith(".woff2")
        ? []
        : [`${font} is not named as a .woff2 file`]),
      ...(isUploadableUrl(entry.url)
        ? []
        : [`${font} has a URL that is not root-relative or http(s)`]),
      ...(entry.licence.trim() === ""
        ? [`${font} has no licence`]
        : fontLicences.has(entry.licence)
          ? []
          : [
              `${font} has the licence "${entry.licence}"; a template's fonts are OFL-1.1 or Apache-2.0`,
            ]),
      ...(entry.source.trim() === "" ? [`${font} has no source`] : []),
      ...(named.has(entry.family)
        ? []
        : [
            `${font} is in the family "${entry.family}", which neither font-heading nor font-body names first, so a publish leaves it out`,
          ]),
    ];
  });
};

// A font variable names first a family the template bundles, under the name
// the builder derives from its file, or one every visitor's system has.
const checkFontVariables = (template: SiteTemplate): string[] => {
  const bundled = new Set(
    Object.values(template.fonts).map((entry) => entry.family)
  );
  return CANONICAL_FONT_NAMES.flatMap((name) => {
    const family = firstFontFamily(template.variables[name]);
    if (family === undefined) {
      return [`Variables: ${name} names no font family`];
    }
    return bundled.has(family) || systemFontFamilies.has(family.toLowerCase())
      ? []
      : [
          `Variables: ${name} names "${family}" first, which is neither one of the template's fonts nor a system font`,
        ];
  });
};

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
  const roots = new Set(page.placements.map((placement) => placement.rootId));
  const isLocal = (styleSourceId: string) =>
    fragment.styleSources.some(
      (source) => source.id === styleSourceId && source.type === "local"
    );
  // A style source is checked when any instance outside a placed block
  // selects it, so a block's token used by the page's own element is too. A
  // placed block's root style is checked too: placeBlock's `style` puts the
  // template's own declarations there.
  const checkedSources = new Set(
    fragment.styleSourceSelections.flatMap((selection) => {
      if (roots.has(selection.instanceId)) {
        return selection.values.filter(isLocal);
      }
      return blockIds.has(selection.instanceId) ? [] : selection.values;
    })
  );
  const breakpoints = new Map(
    fragment.breakpoints.map((breakpoint) => [breakpoint.id, breakpoint])
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
    const where = `${pageName(page.key)}: ${hyphenateProperty(decl.property)} on ${describeSource(decl.styleSourceId)}`;
    const breakpoint = breakpoints.get(decl.breakpointId);
    const breakpointProblem =
      breakpoint === undefined ? undefined : findBreakpointProblem(breakpoint);
    return [
      ...findStyleProblems(decl.property, decl.value).map(
        (problem) => `${where} uses ${problem}`
      ),
      ...(breakpointProblem === undefined
        ? []
        : [`${where} ${breakpointProblem}`]),
    ];
  });
};

// A template's look for the block tokens is its own style: held to the
// rules its page styles are.
const checkBlockTokenStyles = (template: SiteTemplate): string[] =>
  Object.entries(template.blockTokens ?? {}).flatMap(([name, style = []]) =>
    style.flatMap(({ breakpoint, property, value }) => {
      const where = `Block tokens: ${property} on "${name}"`;
      const media = breakpoint === undefined ? {} : parseMediaQuery(breakpoint);
      const breakpointProblem =
        media === undefined
          ? `is under the media query ${breakpoint}, which does not parse`
          : findBreakpointProblem(media);
      return [
        ...findStyleProblems(camelCaseProperty(property), value).map(
          (problem) => `${where} uses ${problem}`
        ),
        ...(breakpointProblem === undefined
          ? []
          : [`${where} ${breakpointProblem}`]),
      ];
    })
  );

/** The names of the tokens the page's placed blocks wear. */
const tokensWornByBlocks = (page: RenderedPage) => {
  const { fragment } = page;
  const blockIds = placedBlockIds(page);
  const selected = new Set(
    fragment.styleSourceSelections.flatMap((selection) =>
      blockIds.has(selection.instanceId) ? selection.values : []
    )
  );
  return new Set(
    fragment.styleSources.flatMap((source) =>
      source.type === "token" && selected.has(source.id) ? [source.name] : []
    )
  );
};

// A block token the template restyles is worn by a block it places: a name
// no placed block wears styles nothing.
const checkBlockTokenNames = (
  template: SiteTemplate,
  pages: RenderedPage[]
): string[] => {
  const worn = new Set(pages.flatMap((page) => [...tokensWornByBlocks(page)]));
  return Object.keys(template.blockTokens ?? {}).flatMap((name) =>
    worn.has(name)
      ? []
      : [
          `Block tokens: "${name}" is worn by no block the template places, so it styles nothing`,
        ]
  );
};

/** The stand-in asset id the check renders a template's image `file` with. */
const standInAssetId = (file: string) => `asset:${file}`;

/** Whether a style value is, or holds, the asset `assetId`. */
const holdsAsset = (value: unknown, assetId: string): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => holdsAsset(item, assetId));
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record.type === "asset" && record.value === assetId) ||
    Object.values(record).some((item) => holdsAsset(item, assetId))
  );
};

/**
 * Whether the page shows the image `assetId`: an Image's (or any prop's)
 * asset, or a background image.
 */
const showsAsset = ({ props, styles }: WebstudioFragment, assetId: string) =>
  props.some((prop) => prop.type === "asset" && prop.value === assetId) ||
  styles.some(
    (style) =>
      style.property === "backgroundImage" && holdsAsset(style.value, assetId)
  );

// The preview tool shows the first sample event with the template's
// previewEventCover. A template that places the cover card names one, so its
// preview shows a photo of its own, not a stand-in; and no page with an
// events block shows it, as an Image or a background, so a preview never
// shows a photo twice. The cover card is the one whose image wears "OS Event
// Cover".
const checkPreviewEventCover = (
  template: SiteTemplate,
  pages: RenderedPage[]
): string[] => {
  const eventPages = pages.filter((page) =>
    page.placements.some((placement) => eventBlockKeys.has(placement.key))
  );
  const cover = template.previewEventCover;
  if (cover === undefined) {
    return eventPages.some((page) =>
      tokensWornByBlocks(page).has("OS Event Cover")
    )
      ? [
          "The template places the events blocks' cover card, so it names a previewEventCover: one of its images, which the preview shows as the first sample event's cover",
        ]
      : [];
  }
  const assetId = standInAssetId(cover);
  return eventPages.flatMap(({ key, fragment }) =>
    showsAsset(fragment, assetId)
      ? [
          `${pageName(key)} shows the preview event cover "${cover}" and has an events block, so its preview would show the photo twice`,
        ]
      : []
  );
};

// An image on the page's own elements comes from the template's images
// (image(file)), so its source (CC0 or OrganizeOS's own) is recorded and the
// apply routine uploads it, or has no src, which the builder draws as its
// placeholder (spec decision 3: the "put your image here" slot); either way it
// carries alt text. A placed block's image is bound to its records.
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
      ...(src === undefined || src.type === "asset"
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

// A link by path goes to a route the platform serves (PLATFORM_PATHS), as a
// document navigation: the published site's router has no route there and
// would show its own 404. Any other page is linked by its key, so a rename
// keeps the link. A placed block's links are its own.
const checkPathLinks = (
  page: RenderedPage,
  blockIds: Set<string>
): string[] => {
  const { fragment } = page;
  return fragment.props.flatMap((prop) => {
    if (
      prop.name !== "href" ||
      prop.type !== "string" ||
      prop.value.startsWith("/") === false ||
      blockIds.has(prop.instanceId)
    ) {
      return [];
    }
    const where = `${pageName(page.key)}: the "href" of ${describePropOwner(fragment, prop.instanceId)}`;
    if (isPlatformPath(prop.value) === false) {
      return [
        `${where} links to "${prop.value}", a path: a page of the template is linked by its key, and a path only to a route the platform serves (${PLATFORM_PATHS.join(", ")})`,
      ];
    }
    const reloads = fragment.props.some(
      (item) =>
        item.instanceId === prop.instanceId &&
        item.name === "reloadDocument" &&
        item.type === "boolean" &&
        item.value
    );
    return reloads
      ? []
      : [
          `${where} links to the platform's "${prop.value}" without reloadDocument, so a published site looks for it among its own pages`,
        ];
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
    ...checkFontEntries(template),
    ...checkContrast(template),
    ...checkFontVariables(template),
    ...checkBlockTokenStyles(template),
  ];
  let pages: RenderedPage[];
  try {
    let pageCount = 0;
    pages = renderSiteTemplate(template, {
      assetIds: new Map(
        Object.keys(template.images).map((file) => [file, standInAssetId(file)])
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
  violations.push(
    ...checkBlockTokenNames(template, pages),
    ...checkPreviewEventCover(template, pages)
  );
  for (const page of pages) {
    const blockIds = placedBlockIds(page);
    violations.push(
      ...checkBlocks(page),
      ...checkPageLinks(page, pageIds),
      ...checkPathLinks(page, blockIds),
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
