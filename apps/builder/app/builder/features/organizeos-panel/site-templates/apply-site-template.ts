import { nanoid } from "nanoid";
import { parseCssValue } from "@webstudio-is/css-data";
import {
  type Instance,
  type Page,
  type StyleDecl,
  type WebstudioData,
  type WebstudioFragment,
  ROOT_FOLDER_ID,
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
  isCanonicalName,
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import { SIGNUP_PAGE_PATH } from "~/shared/organizeos-preset-ids";
import {
  getWebstudioData,
  updateWebstudioData,
} from "~/shared/instance-utils/data";
import { insertWebstudioFragmentCopy } from "~/shared/instance-utils/fragment";
import { findLocalStyleSourcesWithinInstances } from "~/shared/instance-utils/tree";
import { deleteLocalStyleSourcesMutable } from "~/shared/style-source-utils";
import { selectInstance } from "~/shared/nano-states";
import { $project } from "~/shared/sync/data-stores";
import { registerFolderChildMutable } from "~/builder/features/pages/page-utils";
import { getInstanceLabel } from "~/builder/shared/instance-label";
import { uploadAssets } from "~/builder/shared/assets/upload-assets";
import { getSha256Hash } from "~/builder/shared/assets/asset-utils";
import { deleteSubtreeMutable } from "../collection-pages";
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
 * org's data as an inserted block is. All in one `updateWebstudioData`
 * transaction, so the builder's undo removes it in one step.
 */

/** The page `createPages()` makes for every project. */
const NOT_FOUND_PAGE_PATH = "/*";

/**
 * Whether a project is as provisioning left it: Home's body has no children,
 * the only other pages are the 404 page and the seeded sign-up page, and it
 * has no assets but `ignoreAssetIds` (an apply's own images, which an earlier
 * upload of the same files can have added). Reads only what it is given, so
 * the chooser can pass the raw stores.
 */
export const isProjectUntouched = (
  data: Pick<WebstudioData, "pages" | "instances" | "assets">,
  { ignoreAssetIds = new Set() }: { ignoreAssetIds?: Set<string> } = {}
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
  for (const assetId of data.assets.keys()) {
    if (ignoreAssetIds.has(assetId) === false) {
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
  | { status: "refused"; reason: "touched" | "path-taken" | "resources" };

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
 * `unboundBlocks`.
 */
export const applySiteTemplateMutable = (
  data: WebstudioData,
  pages: RenderedPage[],
  {
    projectId,
    presetIds,
    variables,
    ignoreAssetIds,
  }: {
    projectId: string;
    presetIds: OrganizeosPresetIds;
    variables: CanonicalValues;
    ignoreAssetIds: Set<string>;
  }
): ApplyResult => {
  const homePage = data.pages.pages.get(data.pages.homePageId);
  if (
    homePage === undefined ||
    isProjectUntouched(data, { ignoreAssetIds }) === false ||
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
  selectInstance(undefined);
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
      registerFolderChildMutable(data.pages, page.pageId, ROOT_FOLDER_ID);
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
  return { status: "applied", unboundBlocks };
};

/**
 * Apply a template from the chooser. An image's asset id is the one
 * uploadAssets gives its URL, the SHA-256 of the URL (upload-assets.tsx), so
 * the pages render with those ids, and the images are uploaded only once the
 * template is applied: a page that cannot render, or a refusal, leaves no
 * asset behind to make the project touched for good. An id the upload
 * returns that is not the rendered one is logged; a failed upload is
 * reported by the upload's own toast.
 */
export const applySiteTemplate = async (
  template: SiteTemplate
): Promise<ApplyResult> => {
  const project = $project.get();
  if (
    project === undefined ||
    isProjectUntouched(getWebstudioData()) === false
  ) {
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

  // stays refused when the transaction skips its callback
  let result = { status: "refused", reason: "touched" } as ApplyResult;
  updateWebstudioData((data) => {
    result = applySiteTemplateMutable(data, pages, {
      projectId: project.id,
      presetIds,
      variables: template.variables,
      ignoreAssetIds: new Set(assetIds.values()),
    });
  });
  if (result.status !== "applied") {
    return result;
  }

  const uploaded = await uploadAssets("image", [...urls.values()]);
  for (const [file, url] of urls) {
    if (uploaded.get(url) !== assetIds.get(file)) {
      console.error(
        `Image "${file}" was uploaded with an asset id its pages do not use`
      );
    }
  }
  return result;
};
