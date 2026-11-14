import { nanoid } from "nanoid";
import { current, isDraft } from "immer";
import {
  type Instance,
  type StyleDecl,
  type WebstudioData,
  type WebstudioFragment,
  findTreeInstanceIds,
  getStyleDeclKey,
  pagePath,
} from "@webstudio-is/sdk";
import type { ProjectSettings } from "@webstudio-is/project-build";
import {
  copyWebstudioFragmentMutable,
  extractWebstudioFragment,
  getLocalStyleSourceId,
  getSlotFragmentId,
  insertWebstudioFragmentCopy,
  isPathAvailable,
  validatePathnamePattern,
} from "@webstudio-is/project-build/runtime";
import {
  type CompleteKitStyle,
  type RenderedPage,
  SITE_TEMPLATES,
  getBlockTokenStyles,
} from "@organizeos/site-components/site-templates";
import {
  type StarterPage,
  NEUTRAL_LOOK,
  neutralBodyStyles,
  renderStarterPage,
} from "@organizeos/site-components/starter-pages";
import { isPlatformServedPath } from "@organizeos/site-components/platform-paths";
import { selectPage } from "~/shared/nano-states";
import { $project, $projectSettings } from "~/shared/sync/data-stores";
import { getInstanceLabel } from "~/builder/shared/instance-label";
import { addToFolderMutable, updateWebstudioDataStaged } from "../staged-data";
import {
  type OrganizeosPresetIds,
  completeOrganizeosFragment,
  completeOrganizeosInsertMutable,
  getOrganizeosPresetIds,
} from "../insert-organizeos-block";
import {
  hasCanonicalVariables,
  readSiteTemplateRecord,
  startBlankMutable,
} from "../site-templates/apply-site-template";

/**
 * Adding a page template from New page (OrganizeOS design
 * `2026-11-13-builder-templates-screen-and-page-templates-design.md` section
 * 6.4): the page's body goes in the root folder, with copies of Home's nav and
 * footer around it and Home's body styles on it, in one staged write, one
 * undo step. Its blocks are bound as a site template's are.
 */

export type StarterRefusalReason =
  | "invalid"
  | "path-taken"
  | "platform-path"
  | "resources";

export type StarterInsertResult =
  | { status: "added"; pageId: string; unboundBlocks: string[] }
  | { status: "refused"; reason: StarterRefusalReason };

/**
 * Why the page cannot be added with these fields, before anything is created
 * or written; nothing when it can. The page goes in the root folder, so its
 * full path is `path`. The row is written directly, so the checks upstream's
 * pages.create makes are made here.
 */
export const findStarterInsertRefusal = (
  data: Pick<WebstudioData, "pages">,
  rendered: RenderedPage,
  { name, path }: { name: string; path: string }
): StarterRefusalReason | undefined => {
  if (
    name.trim() === "" ||
    pagePath.safeParse(path).success === false ||
    validatePathnamePattern(path).length > 0
  ) {
    return "invalid";
  }
  if (
    isPathAvailable({
      pages: data.pages,
      path,
      parentFolderId: data.pages.rootFolderId,
    }) === false
  ) {
    return "path-taken";
  }
  if (isPlatformServedPath(path)) {
    return "platform-path";
  }
  if (rendered.fragment.resources.length > 0) {
    return "resources";
  }
  return undefined;
};

type Piece = "Nav" | "Footer";

const pieceTags: Record<Piece, string[]> = {
  Nav: ["nav", "header"],
  Footer: ["footer"],
};

const idChildren = (instance: Instance | undefined) =>
  (instance?.children ?? []).flatMap((child) =>
    child.type === "id" ? [child.value] : []
  );

/** Whether an element is the site's nav (or footer) by its label or tag. */
const looksLike = (instance: Instance | undefined, piece: Piece) =>
  instance !== undefined &&
  (instance.label === piece ||
    instance.label?.startsWith(`${piece}:`) === true ||
    (instance.tag !== undefined && pieceTags[piece].includes(instance.tag)));

/**
 * Whether Home's top-level child `id` is its nav (or footer): by itself, or as
 * a Slot whose shared content starts (or, for the footer, ends) with one.
 */
const isPiece = (data: WebstudioData, id: Instance["id"], piece: Piece) => {
  const instance = data.instances.get(id);
  if (looksLike(instance, piece)) {
    return true;
  }
  const fragmentId = getSlotFragmentId(instance);
  if (fragmentId === undefined) {
    return false;
  }
  const inner = idChildren(data.instances.get(fragmentId));
  const edge = piece === "Nav" ? inner[0] : inner.at(-1);
  return edge !== undefined && looksLike(data.instances.get(edge), piece);
};

/**
 * A copy of Home's piece `pieceId` spliced into the new body, first or last.
 * Its `#` links go back to Home (`/#why`), on a new fragment: extract leaves
 * a plain prop as the data's own object, and a Slot's content is shared with
 * Home and every page holding the Slot, so neither is changed. The copy is
 * scoped to the new body, which restores the variables available there.
 */
const copyPieceMutable = (
  data: WebstudioData,
  pieceId: Instance["id"],
  bodyId: Instance["id"],
  projectId: string,
  at: "start" | "end"
) => {
  const extracted = extractWebstudioFragment(data, pieceId);
  const shared = new Set<Instance["id"]>();
  for (const instance of extracted.instances) {
    const fragmentId = getSlotFragmentId(instance);
    if (fragmentId !== undefined) {
      for (const id of findTreeInstanceIds(data.instances, fragmentId)) {
        shared.add(id);
      }
    }
  }
  const fragment: WebstudioFragment = {
    ...extracted,
    props: extracted.props.map((prop) =>
      prop.name === "href" &&
      prop.type === "string" &&
      prop.value.startsWith("#") &&
      shared.has(prop.instanceId) === false
        ? { ...prop, value: `/${prop.value}` }
        : prop
    ),
  };
  const { newInstanceIds } = copyWebstudioFragmentMutable({
    data,
    fragment,
    targetInstanceId: bodyId,
    projectId,
    conflictResolution: "ours",
  });
  const copyId = newInstanceIds.get(pieceId);
  const body = data.instances.get(bodyId);
  if (copyId === undefined || body === undefined) {
    return;
  }
  const child = { type: "id" as const, value: copyId };
  if (at === "start") {
    body.children.unshift(child);
  } else {
    body.children.push(child);
  }
};

/** A value read from the data, detached from it (a draft inside a recipe). */
const detached = <Value>(value: Value): Value =>
  structuredClone(isDraft(value) ? current(value) : value);

/**
 * Home body's local declarations onto the new body's local style source, or,
 * when Home's body has none, neutralBodyStyles(). Home body's tokens stay
 * Home's.
 */
const writeBodyStylesMutable = (
  data: WebstudioData,
  homeBodyId: Instance["id"] | undefined,
  bodyId: Instance["id"]
) => {
  const homeLocalId =
    homeBodyId === undefined
      ? undefined
      : getLocalStyleSourceId({
          styleSources: data.styleSources,
          styleSourceSelection: data.styleSourceSelections.get(homeBodyId),
        });
  const selection = data.styleSourceSelections.get(bodyId);
  let localId = getLocalStyleSourceId({
    styleSources: data.styleSources,
    styleSourceSelection: selection,
  });
  if (localId === undefined) {
    localId = nanoid();
    data.styleSources.set(localId, { type: "local", id: localId });
    data.styleSourceSelections.set(bodyId, {
      instanceId: bodyId,
      values: [...(selection?.values ?? []), localId],
    });
  }
  const homeDecls = Array.from(data.styles.values()).filter(
    (decl) => homeLocalId !== undefined && decl.styleSourceId === homeLocalId
  );
  let decls: StyleDecl[];
  if (homeDecls.length > 0) {
    const styleSourceId = localId;
    decls = homeDecls.map((decl) => ({ ...detached(decl), styleSourceId }));
  } else {
    const { styles, newBreakpoints } = getBlockTokenStyles({
      styleSourceId: localId,
      style: neutralBodyStyles(),
      breakpoints: Array.from(data.breakpoints.values()),
      createBreakpointId: nanoid,
    });
    for (const breakpoint of newBreakpoints) {
      data.breakpoints.set(breakpoint.id, breakpoint);
    }
    decls = styles;
  }
  for (const decl of decls) {
    data.styles.set(getStyleDeclKey(decl), decl);
  }
};

/**
 * The page template `rendered` added to `data` as a page named `name` at
 * `path` in the root folder (section 6.4 step 4). Refused, writing nothing,
 * when findStarterInsertRefusal names a reason.
 */
export const insertStarterPageMutable = (
  data: WebstudioData,
  rendered: RenderedPage,
  {
    projectId,
    presetIds,
    name,
    path,
  }: {
    projectId: string;
    presetIds: OrganizeosPresetIds;
    name: string;
    path: string;
  }
): StarterInsertResult => {
  const refusal = findStarterInsertRefusal(data, rendered, { name, path });
  if (refusal !== undefined) {
    return { status: "refused", reason: refusal };
  }
  const root = rendered.fragment.children.find((child) => child.type === "id");
  if (root === undefined) {
    return { status: "refused", reason: "invalid" };
  }

  // C12: a site with none of the canonical variables gets the blank values
  if (hasCanonicalVariables(data) === false) {
    startBlankMutable(data);
  }

  // the site's tokens win over the page template's of the same name
  const { newInstanceIds } = insertWebstudioFragmentCopy({
    data,
    fragment: rendered.fragment,
    availableVariables: [],
    projectId,
    conflictResolution: "ours",
    contentMode: false,
  });
  const bodyId = newInstanceIds.get(root.value) ?? root.value;

  const homeBodyId = data.pages.pages.get(
    data.pages.homePageId
  )?.rootInstanceId;
  const homeChildren = idChildren(
    homeBodyId === undefined ? undefined : data.instances.get(homeBodyId)
  );
  const navId = homeChildren[0];
  const footerId = homeChildren.at(-1);
  const hasNav = navId !== undefined && isPiece(data, navId, "Nav");
  if (hasNav) {
    copyPieceMutable(data, navId, bodyId, projectId, "start");
  }
  if (
    footerId !== undefined &&
    (hasNav === false || footerId !== navId) &&
    isPiece(data, footerId, "Footer")
  ) {
    copyPieceMutable(data, footerId, bodyId, projectId, "end");
  }
  writeBodyStylesMutable(data, homeBodyId, bodyId);

  data.pages.pages.set(rendered.pageId, {
    id: rendered.pageId,
    name,
    path,
    title: JSON.stringify(rendered.title),
    rootInstanceId: bodyId,
    meta: {
      description: JSON.stringify(rendered.description),
      // C11: a page template is meant to be public
      excludePageFromSearch: "false",
    },
  });
  addToFolderMutable(data.pages, rendered.pageId);

  // Each block through a view of the page: the block's root as the only
  // child, and its ids prefixed by it (place-block.ts), as the apply binds.
  const unboundBlocks: string[] = [];
  for (const { key, rootId } of rendered.placements) {
    const completion = completeOrganizeosFragment({
      component: key,
      fragment: {
        ...rendered.fragment,
        children: [{ type: "id", value: rootId }],
      },
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
  return { status: "added", pageId: rendered.pageId, unboundBlocks };
};

/**
 * The kit style a page template is drawn in: the recorded site template's
 * look (section 5.4) when it names a catalog template, else NEUTRAL_LOOK.
 */
export const starterLook = (
  projectSettings: ProjectSettings | undefined
): CompleteKitStyle => {
  const id = readSiteTemplateRecord(projectSettings);
  return (
    SITE_TEMPLATES.find((template) => template.id === id)?.look ?? NEUTRAL_LOOK
  );
};

export type StarterInsertOutcome =
  | StarterInsertResult
  | { status: "refused"; reason: "no-project" }
  // the runtime layer refused the write, and says why
  | { status: "refused"; reason: "runtime"; message: string };

/**
 * Add `page` named `name` at `path`, then select it. A refusal writes
 * nothing; an error inside the write rejects with it.
 */
export const insertStarterPage = async (
  page: StarterPage,
  { name, path }: { name: string; path: string }
): Promise<StarterInsertOutcome> => {
  const project = $project.get();
  if (project === undefined) {
    return { status: "refused", reason: "no-project" };
  }
  const presetIds = await getOrganizeosPresetIds(project.id);
  const rendered = renderStarterPage(page, {
    look: starterLook($projectSettings.get()),
    generatePageId: nanoid,
  });
  let staged = false;
  let result: StarterInsertResult;
  try {
    result = await updateWebstudioDataStaged((data) => {
      staged = true;
      return insertStarterPageMutable(data, rendered, {
        projectId: project.id,
        presetIds,
        name,
        path,
      });
    });
  } catch (error) {
    if (staged) {
      throw error;
    }
    // The runtime layer refused the write before it began (a page template
    // selected without build access), as the apply surfaces it.
    console.error(error);
    return {
      status: "refused",
      reason: "runtime",
      message:
        error instanceof Error
          ? error.message
          : "This page template cannot be added.",
    };
  }
  if (result.status === "added") {
    selectPage(result.pageId);
  }
  return result;
};
