import { nanoid } from "nanoid";
import { parseCssValue } from "@webstudio-is/css-data";
import {
  type Breakpoint,
  type Instance,
  type Page,
  type StyleDecl,
  type WebstudioData,
  type WebstudioFragment,
  ROOT_INSTANCE_ID,
  findTreeInstanceIds,
  getAllPages,
  getPagePath,
  getStyleDeclKey,
} from "@webstudio-is/sdk";
import {
  type CanonicalName,
  type CanonicalValues,
  type RenderedPage,
  type SiteTemplate,
  BLANK_CANONICAL_VALUES,
  CANONICAL_COLOR_NAMES,
  CANONICAL_FONT_NAMES,
  findPageAssetIds,
  isCanonicalName,
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import type { ProjectSettings } from "@webstudio-is/project-build";
import {
  calculateUsagesByAssetId,
  deleteLocalStyleSourcesMutable,
  findLocalStyleSourcesWithinInstances,
  insertWebstudioFragmentCopy,
  replaceAssetMutable,
  traverseStyleValue,
} from "@webstudio-is/project-build/runtime";
import { SIGNUP_PAGE_PATH } from "~/shared/organizeos-preset-ids";
import { getWebstudioData } from "~/shared/instance-utils/data";
import { selectInstance } from "~/shared/nano-states";
import { $project } from "~/shared/sync/data-stores";
import { getInstanceLabel } from "~/builder/shared/instance-label";
import {
  uploadAssets,
  waitForAssetUpload,
} from "~/builder/shared/assets/upload-assets";
import { getSha256Hash } from "~/builder/shared/assets/asset-utils";
import { deleteSubtreeMutable } from "../collection-pages";
import { addToFolderMutable, updateWebstudioDataStaged } from "../staged-data";
import {
  type OrganizeosPresetIds,
  completeOrganizeosFragment,
  completeOrganizeosInsertMutable,
  getOrganizeosPresetIds,
} from "../insert-organizeos-block";

/**
 * Applying a site template (OrganizeOS design
 * `2026-10-30-website-template-inventory-design.md` sections 6.2 and 6.3):
 * on a project as provisioning left it, the template's variables go on Global
 * Root, each page's body is inserted as a fragment in design mode, Home takes
 * the template's body, title and description, the other pages are added at the
 * root of the Pages tree, and each platform block the template placed is bound to the
 * org's data as an inserted block is. All in one staged transaction
 * (staged-data.ts), so the builder's undo removes it in one step. The page
 * bodies have no parent to insert them into, so they are copied into the
 * transaction's data (insertWebstudioFragmentCopy), which keeps the copy's id
 * map for the blocks.
 */

/** The page `createPages()` makes for every project. */
const NOT_FOUND_PAGE_PATH = "/*";

/**
 * Whether a project is as provisioning left it: Home's body has no children,
 * the only other pages are the 404 page and the seeded sign-up page, and no
 * asset is used. An asset counts only when `calculateUsagesByAssetId` reports
 * a use of it (a prop, a style, a font by the family a style names, a page's
 * social image, the favicon), so images an interrupted or undone apply left
 * behind, and uploads never placed, keep the project untouched. Reads only
 * what it is given, so the chooser can pass the raw stores.
 */
export const isProjectUntouched = (
  data: Pick<
    WebstudioData,
    "pages" | "instances" | "assets" | "props" | "styles"
  > & { projectSettings?: ProjectSettings }
): boolean => {
  const { pages } = data;
  const home = pages.pages.get(pages.homePageId);
  const body =
    home === undefined ? undefined : data.instances.get(home.rootInstanceId);
  if (body === undefined || body.children.length > 0) {
    return false;
  }
  for (const page of pages.pages.values()) {
    if (
      page.id !== pages.homePageId &&
      page.path !== SIGNUP_PAGE_PATH &&
      page.path !== NOT_FOUND_PAGE_PATH
    ) {
      return false;
    }
  }
  const usages = calculateUsagesByAssetId({
    pages,
    projectSettings: data.projectSettings,
    props: data.props,
    styles: data.styles,
    assets: data.assets,
  });
  for (const assetId of data.assets.keys()) {
    if ((usages.get(assetId)?.length ?? 0) > 0) {
      return false;
    }
  }
  return true;
};

const canonicalNames: CanonicalName[] = [
  ...CANONICAL_COLOR_NAMES,
  ...CANONICAL_FONT_NAMES,
];

/** The canonical names Global Root declares, on any breakpoint. */
const findRootCanonicalNames = (
  data: Pick<WebstudioData, "styles" | "styleSourceSelections">
) => {
  const styleSourceIds = new Set(
    data.styleSourceSelections.get(ROOT_INSTANCE_ID)?.values
  );
  const names = new Set<CanonicalName>();
  for (const decl of data.styles.values()) {
    if (
      styleSourceIds.has(decl.styleSourceId) === false ||
      decl.property.startsWith("--") === false
    ) {
      continue;
    }
    const name = decl.property.slice(2);
    if (isCanonicalName(name)) {
      names.add(name);
    }
  }
  return names;
};

/** Whether Global Root declares any of the canonical variables. */
export const hasCanonicalVariables = (
  data: Pick<WebstudioData, "styles" | "styleSourceSelections">
): boolean => findRootCanonicalNames(data).size > 0;

/**
 * Write the canonical variables on Global Root's base breakpoint, into its
 * local style source (created with its selection when it has none), by style
 * key, so a second write replaces the first. "fill" writes only the names
 * Global Root does not declare on any breakpoint; nothing is written when
 * there is no base breakpoint.
 */
export const writeCanonicalVariablesMutable = (
  data: WebstudioData,
  values: CanonicalValues,
  mode: "overwrite" | "fill"
): void => {
  const base = Array.from(data.breakpoints.values()).find(
    (breakpoint) =>
      breakpoint.minWidth === undefined &&
      breakpoint.maxWidth === undefined &&
      breakpoint.condition === undefined
  );
  const declared =
    mode === "fill" ? findRootCanonicalNames(data) : new Set<CanonicalName>();
  const names = canonicalNames.filter((name) => declared.has(name) === false);
  if (base === undefined || names.length === 0) {
    return;
  }
  const selection = data.styleSourceSelections.get(ROOT_INSTANCE_ID);
  let styleSourceId = selection?.values.find(
    (id) => data.styleSources.get(id)?.type === "local"
  );
  if (styleSourceId === undefined) {
    styleSourceId = nanoid();
    data.styleSources.set(styleSourceId, { type: "local", id: styleSourceId });
    data.styleSourceSelections.set(ROOT_INSTANCE_ID, {
      instanceId: ROOT_INSTANCE_ID,
      values: [...(selection?.values ?? []), styleSourceId],
    });
  }
  for (const name of names) {
    const property = `--${name}` as const;
    const decl: StyleDecl = {
      styleSourceId,
      breakpointId: base.id,
      property,
      value: parseCssValue(property, values[name]),
    };
    data.styles.set(getStyleDeclKey(decl), decl);
  }
};

/** "Start blank": the blank-start values for any variable Global Root lacks. */
export const startBlankMutable = (data: WebstudioData): void => {
  writeCanonicalVariablesMutable(data, BLANK_CANONICAL_VALUES, "fill");
};

export type ApplyResult =
  | { status: "applied"; unboundBlocks: string[] }
  | {
      status: "refused";
      reason: "touched" | "path-taken" | "resources" | "no-project";
    }
  // the runtime layer refused the write, and says why
  | { status: "refused"; reason: "runtime"; message: string };

/**
 * What applySiteTemplate returns: an applied result also counts the photos
 * that could not be added (their pages still name a placeholder id).
 */
export type ApplyOutcome =
  | Exclude<ApplyResult, { status: "applied" }>
  | { status: "applied"; unboundBlocks: string[]; missingImages: number };

/** How many of `ids` a prop or a style of `data` names. */
export const countUsedAssetIds = (
  data: Pick<WebstudioData, "props" | "styles">,
  ids: Iterable<string>
): number => {
  const wanted = new Set(ids);
  const used = new Set<string>();
  for (const prop of data.props.values()) {
    if (prop.type === "asset" && wanted.has(prop.value)) {
      used.add(prop.value);
    }
  }
  for (const decl of data.styles.values()) {
    traverseStyleValue(decl.value, (item) => {
      if (
        item.type === "image" &&
        item.value.type === "asset" &&
        wanted.has(item.value.value)
      ) {
        used.add(item.value.value);
      }
    });
  }
  return used.size;
};

/**
 * Point the applied pages at the assets their images were uploaded as. Each
 * key of `placeholders` is a shown image's placeholder id (the SHA-256 of its
 * URL, which the pages were rendered with) and its value the id the upload was
 * confirmed as. A placeholder is rewritten, in every prop and style, only when
 * its upload was confirmed and the project still holds that asset (an upload
 * undone or deleted since keeps its placeholder). Returns how many
 * placeholders the project still uses: the photos that could not be added. An
 * undone apply uses none, so it writes nothing and counts none.
 */
export const rewriteAssetIdsMutable = (
  data: WebstudioData,
  placeholders: Map<string, string | undefined>
): number => {
  for (const [fromAssetId, toAssetId] of placeholders) {
    if (toAssetId !== undefined && data.assets.has(toAssetId)) {
      replaceAssetMutable({
        props: data.props.values(),
        styles: data.styles.values(),
        replacement: { fromAssetId, toAssetId },
      });
    }
  }
  return countUsedAssetIds(data, placeholders.keys());
};

const isHomePage = (page: Pick<RenderedPage, "path">) => page.path === "";

/**
 * Home keeps the project's page id, so a link to the template's Home is
 * pointed at the project's.
 */
const retargetHomeLinks = (
  fragment: WebstudioFragment,
  templateHomeId: undefined | Page["id"],
  homePageId: Page["id"]
): WebstudioFragment => ({
  ...fragment,
  props: fragment.props.map((prop) => {
    if (prop.type !== "page" || templateHomeId === undefined) {
      return prop;
    }
    if (prop.value === templateHomeId) {
      return { ...prop, value: homePageId };
    }
    if (
      typeof prop.value === "object" &&
      prop.value.pageId === templateHomeId
    ) {
      return { ...prop, value: { ...prop.value, pageId: homePageId } };
    }
    return prop;
  }),
});

/** The project's breakpoint of a fragment's, by its media, added if missing. */
const findOrAddBreakpointMutable = (
  data: WebstudioData,
  { minWidth, maxWidth, condition, label }: Breakpoint
): Breakpoint["id"] => {
  const found = Array.from(data.breakpoints.values()).find(
    (breakpoint) =>
      breakpoint.minWidth === minWidth &&
      breakpoint.maxWidth === maxWidth &&
      breakpoint.condition === condition
  );
  if (found !== undefined) {
    return found.id;
  }
  const breakpoint: Breakpoint = {
    id: nanoid(),
    label,
    ...(minWidth === undefined ? {} : { minWidth }),
    ...(maxWidth === undefined ? {} : { maxWidth }),
    ...(condition === undefined ? {} : { condition }),
  };
  data.breakpoints.set(breakpoint.id, breakpoint);
  return breakpoint.id;
};

/**
 * The template's look for each block token it restyles, written whole over
 * the project's token of that name: the token as the pages carry it (the
 * block's defaults with the template's `blockTokens` merged, render.ts)
 * replaces every declaration the project's token held. The pages bring that
 * token, but the insert resolves a token the project already holds with
 * "ours", which keeps it as it stands: the seeded sign-up page's form
 * tokens, or an Event Card's an admin inserted on /newsletter before choosing
 * a template, with old literal colours the template does not restate. The
 * project is untouched, so nothing the org made is lost. A breakpoint the
 * project lacks is added.
 */
const writeBlockTokensMutable = (
  data: WebstudioData,
  pages: RenderedPage[],
  names: string[]
) => {
  for (const name of names) {
    const page = pages.find(({ fragment }) =>
      fragment.styleSources.some(
        (source) => source.type === "token" && source.name === name
      )
    );
    const merged = page?.fragment.styleSources.find(
      (source) => source.type === "token" && source.name === name
    );
    if (page === undefined || merged === undefined) {
      continue;
    }
    const { fragment } = page;
    const breakpointIds = new Map<Breakpoint["id"], Breakpoint["id"]>();
    const projectBreakpointId = (id: Breakpoint["id"]) => {
      let projectId = breakpointIds.get(id);
      const breakpoint = fragment.breakpoints.find((item) => item.id === id);
      if (projectId === undefined && breakpoint !== undefined) {
        projectId = findOrAddBreakpointMutable(data, breakpoint);
        breakpointIds.set(id, projectId);
      }
      return projectId;
    };
    const declarations = fragment.styles.filter(
      (decl) => decl.styleSourceId === merged.id
    );
    for (const token of data.styleSources.values()) {
      if (token.type !== "token" || token.name !== name) {
        continue;
      }
      for (const [key, decl] of data.styles) {
        if (decl.styleSourceId === token.id) {
          data.styles.delete(key);
        }
      }
      for (const decl of declarations) {
        const breakpointId = projectBreakpointId(decl.breakpointId);
        if (breakpointId === undefined) {
          continue;
        }
        const written: StyleDecl = {
          ...decl,
          styleSourceId: token.id,
          breakpointId,
        };
        data.styles.set(getStyleDeclKey(written), written);
      }
    }
  }
};

/** Delete a page's body with its descendants and their local styles. */
const deleteBodyMutable = (data: WebstudioData, bodyId: Instance["id"]) => {
  const localStyleSourceIds = findLocalStyleSourcesWithinInstances(
    data.styleSources.values(),
    data.styleSourceSelections.values(),
    findTreeInstanceIds(data.instances, bodyId)
  );
  deleteSubtreeMutable(data, undefined, bodyId);
  deleteLocalStyleSourcesMutable({
    localStyleSourceIds,
    styleSources: data.styleSources,
    styles: data.styles,
  });
};

/**
 * Write a rendered template into a transaction's data. Refuses, writing
 * nothing, unless the project is untouched and has none of the canonical
 * variables (the chooser's offer, decided again here: the project can change
 * while the chooser is open and while an apply awaits), when a page brings a
 * Resource, or when a page's path is taken. A placed block that cannot be
 * bound (its Events Resource is gone) is left in place, unbound, and named in
 * `unboundBlocks`. The tokens the template restyles are written whole over
 * the project's tokens of their names last (writeBlockTokensMutable).
 */
export const applySiteTemplateMutable = (
  data: WebstudioData,
  pages: RenderedPage[],
  {
    projectId,
    presetIds,
    variables,
    blockTokens,
  }: {
    projectId: string;
    presetIds: OrganizeosPresetIds;
    variables: CanonicalValues;
    /** The template's, which the pages were rendered with. */
    blockTokens: SiteTemplate["blockTokens"];
  }
): ApplyResult => {
  const homePage = data.pages.pages.get(data.pages.homePageId);
  if (
    homePage === undefined ||
    // the recipe's data carries the project settings (getWebstudioData)
    isProjectUntouched(data) === false ||
    hasCanonicalVariables(data)
  ) {
    return { status: "refused", reason: "touched" };
  }
  if (pages.some((page) => page.fragment.resources.length > 0)) {
    return { status: "refused", reason: "resources" };
  }
  const takenPaths = new Set(
    getAllPages(data.pages).map((page) => getPagePath(page.id, data.pages))
  );
  if (
    pages.some(
      (page) => isHomePage(page) === false && takenPaths.has(page.path)
    )
  ) {
    return { status: "refused", reason: "path-taken" };
  }

  writeCanonicalVariablesMutable(data, variables, "overwrite");
  const templateHomeId = pages.find(isHomePage)?.pageId;
  const unboundBlocks: string[] = [];
  for (const page of pages) {
    const fragment = retargetHomeLinks(
      page.fragment,
      templateHomeId,
      data.pages.homePageId
    );
    const root = fragment.children.find((child) => child.type === "id");
    if (root === undefined) {
      continue;
    }
    const { newInstanceIds } = insertWebstudioFragmentCopy({
      data,
      fragment,
      availableVariables: [],
      projectId,
      conflictResolution: "ours",
      contentMode: false,
    });
    const bodyId = newInstanceIds.get(root.value) ?? root.value;
    if (isHomePage(page)) {
      deleteBodyMutable(data, homePage.rootInstanceId);
      homePage.rootInstanceId = bodyId;
      homePage.title = JSON.stringify(page.title);
      homePage.meta.description = JSON.stringify(page.description);
    } else {
      data.pages.pages.set(page.pageId, {
        id: page.pageId,
        name: page.name,
        path: page.path,
        title: JSON.stringify(page.title),
        rootInstanceId: bodyId,
        meta: { description: JSON.stringify(page.description) },
      });
      addToFolderMutable(data.pages, page.pageId);
    }

    // Each block through a view of its page: the block's root as the only
    // child, and its ids prefixed by it (place-block.ts).
    for (const { key, rootId } of page.placements) {
      const completion = completeOrganizeosFragment({
        component: key,
        fragment: { ...fragment, children: [{ type: "id", value: rootId }] },
        presetIds,
        resources: data.resources,
        instanceIdPrefix: `${rootId}:`,
      });
      if (completion.status === "refused") {
        unboundBlocks.push(getInstanceLabel({ component: key }));
        continue;
      }
      completeOrganizeosInsertMutable(data, completion, newInstanceIds);
    }
  }
  if (blockTokens !== undefined) {
    writeBlockTokensMutable(data, pages, Object.keys(blockTokens));
  }
  return { status: "applied", unboundBlocks };
};

/**
 * A template's fonts as files, fetched from the builder's origin: the upload
 * by URL reads only images (`getImageNameAndType` in asset-utils.ts). Each
 * file is named by its key; the pages name a font by its family, through the
 * font variables, never by its asset id. A font that cannot be fetched
 * throws.
 */
const fetchFontFiles = (template: SiteTemplate) =>
  Promise.all(
    Object.entries(template.fonts).map(async ([file, entry]) => {
      const response = await fetch(new URL(entry.url, location.origin));
      if (response.ok === false) {
        throw new Error(`Font "${file}" could not be fetched`);
      }
      const font = new File([await response.arrayBuffer()], file, {
        type: "font/woff2",
      });
      return { file, font };
    })
  );

/**
 * Apply a template from the chooser. The pages render with a placeholder id
 * for each image, the SHA-256 of its URL, since the server mints an upload's
 * id only once it uploads (createUploadTicket, since the 0.309.0 merge). Fonts
 * are fetched first and uploaded as files (fetchFontFiles); the pages name
 * them by family, through the font variables. Nothing is uploaded until the
 * template is applied: a page that cannot render, a font that cannot be
 * fetched, or a refusal, leaves no asset behind. Then, in order: the images
 * the pages show are uploaded (findPageAssetIds, which the check reads a
 * page's images with too, so the thumbnail and the preview event cover are
 * never uploaded), each returned id is confirmed (waitForAssetUpload), a
 * staged write points the pages at the confirmed assets
 * (rewriteAssetIdsMutable, its own undo step, above the uploads' own), and
 * the fonts are uploaded. The placeholders still in use are counted as
 * `missingImages`: an Image shows the builder's placeholder, a background
 * nothing. Where the runtime layer refuses the apply (a page template
 * without build access), it is refused with the runtime's message, writing
 * and uploading nothing; where it refuses the rewrite, the photos are
 * counted as missing.
 */
export const applySiteTemplate = async (
  template: SiteTemplate
): Promise<ApplyOutcome> => {
  const project = $project.get();
  if (project === undefined) {
    return { status: "refused", reason: "no-project" };
  }
  if (isProjectUntouched(getWebstudioData()) === false) {
    return { status: "refused", reason: "touched" };
  }
  const presetIds = await getOrganizeosPresetIds(project.id);

  const urls = new Map(
    Object.entries(template.images).map(([file, entry]) => [
      file,
      new URL(entry.url, location.origin),
    ])
  );
  const assetIds = new Map(
    await Promise.all(
      Array.from(
        urls,
        async ([file, url]) => [file, await getSha256Hash(url.href)] as const
      )
    )
  );
  const pages = renderSiteTemplate(template, {
    assetIds,
    generatePageId: nanoid,
  });
  const fonts = await fetchFontFiles(template);

  let staged = false;
  let result: ApplyResult;
  try {
    result = await updateWebstudioDataStaged((data) => {
      staged = true;
      return applySiteTemplateMutable(data, pages, {
        projectId: project.id,
        presetIds,
        variables: template.variables,
        blockTokens: template.blockTokens,
      });
    });
  } catch (error) {
    if (staged) {
      throw error;
    }
    // The runtime layer refused the write before it began (a page template
    // without build access): a refusal, with the runtime's own message
    // (ruling data OQ3, amended).
    console.error(error);
    return {
      status: "refused",
      reason: "runtime",
      message:
        error instanceof Error
          ? error.message
          : "This template cannot be applied.",
    };
  }
  if (result.status !== "applied") {
    return result;
  }
  // the selected instance may have been in Home's old body
  selectInstance(undefined);

  const shownAssetIds = findPageAssetIds(pages);
  const shownUrls = Array.from(urls).filter(([file]) =>
    shownAssetIds.has(assetIds.get(file) ?? "")
  );
  const uploaded = await uploadAssets(
    "image",
    shownUrls.map(([, url]) => url)
  );
  const placeholders = new Map<string, string | undefined>();
  for (const [file, url] of shownUrls) {
    const placeholder = assetIds.get(file);
    if (placeholder === undefined) {
      continue;
    }
    const uploadedId = uploaded.get(url);
    // a ticket's id comes back even when its upload then fails
    const confirmed =
      uploadedId === undefined
        ? undefined
        : await waitForAssetUpload(uploadedId).then(
            (asset) => asset.id,
            () => undefined
          );
    placeholders.set(placeholder, confirmed);
  }
  let missingImages: number;
  try {
    missingImages = await updateWebstudioDataStaged((data) =>
      rewriteAssetIdsMutable(data, placeholders)
    );
  } catch (error) {
    // the runtime layer refused the rewrite: the pages keep the placeholders
    console.error(error);
    missingImages = countUsedAssetIds(getWebstudioData(), placeholders.keys());
  }
  if (fonts.length > 0) {
    await uploadAssets(
      "font",
      fonts.map(({ font }) => font)
    );
  }
  return { ...result, missingImages };
};
