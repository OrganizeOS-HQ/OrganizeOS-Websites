import { detectAssetType, type Instance, type Pages } from "@webstudio-is/sdk";
import { parsePages } from "@webstudio-is/project-build/index.server";
import type { Client } from "@webstudio-is/postgrest/index.server";
import {
  richTextContentComponents,
  richTextContentTags,
} from "../content-model";
import { deriveProjectId } from "./provision.server";

/**
 * OrganizeOS's website agent: the read operations behind
 * POST /internal/organizeos-agent (OrganizeOS spec
 * docs/superpowers/specs/2026-10-27-builder-agent-tools-design.md, 4.5).
 *
 * Every id an operation matches comes from the build of the one project
 * `deriveProjectId(organizationId)` gives: a page id from another project
 * simply is not there, and answers not_found. No answer carries an asset's
 * storage key or a user id, and text is plain, flattened from the instance
 * tree, never HTML.
 */

export type AgentResult<Result> =
  | { ok: true; result: Result }
  | { ok: false; code: "not_found" };

const notFound = { ok: false, code: "not_found" } as const;

/** A section's flattened text is capped at this many characters. */
export const SECTION_TEXT_LIMIT = 2_000;

/** At most this many images, newest first. */
export const IMAGE_LIMIT = 100;

export type AgentProject = {
  projectId: string;
  build: {
    id: string;
    version: number;
    updatedAt: string;
    pages: Pages;
    instances: Map<Instance["id"], Instance>;
  };
  /** createdAt of the newest build with a deployment, or null for none. */
  lastPublishedAt: string | null;
};

const readLiveProjectId = async (
  client: Client,
  organizationId: string
): Promise<string | undefined> => {
  const projectId = deriveProjectId(organizationId);
  const project = await client
    .from("Project")
    .select("id, isDeleted")
    .eq("id", projectId)
    .maybeSingle();
  if (project.error) {
    throw project.error;
  }
  if (project.data === null || project.data.isDeleted) {
    return;
  }
  return projectId;
};

export const resolveAgentProject = async (
  client: Client,
  organizationId: string
): Promise<AgentResult<AgentProject>> => {
  const projectId = await readLiveProjectId(client, organizationId);
  if (projectId === undefined) {
    return notFound;
  }

  const build = await client
    .from("Build")
    .select("id, version, updatedAt, pages, instances")
    .eq("projectId", projectId)
    .is("deployment", null)
    .maybeSingle();
  if (build.error) {
    throw build.error;
  }
  if (build.data === null) {
    return notFound;
  }

  const deployed = await client
    .from("Build")
    .select("createdAt")
    .eq("projectId", projectId)
    .not("deployment", "is", null)
    .order("createdAt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (deployed.error) {
    throw deployed.error;
  }

  const instanceList = JSON.parse(build.data.instances ?? "[]") as Instance[];
  return {
    ok: true,
    result: {
      projectId,
      build: {
        id: build.data.id,
        version: build.data.version,
        updatedAt: build.data.updatedAt,
        pages: parsePages(build.data.pages),
        instances: new Map(
          instanceList.map((instance) => [instance.id, instance])
        ),
      },
      lastPublishedAt: deployed.data?.createdAt ?? null,
    },
  };
};

// A page title is an expression. Only a JSON string literal is static text;
// anything else (a data source, a template) answers null.
export const readStaticTitle = (title: string | undefined): string | null => {
  if (title === undefined) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(title);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
};

// Home page first, then the rest in the build's order.
const orderedPages = (pages: Pages) => {
  const home = pages.pages.get(pages.homePageId);
  const rest = Array.from(pages.pages.values()).filter(
    (page) => page.id !== pages.homePageId
  );
  return home === undefined ? rest : [home, ...rest];
};

const isAfter = (a: string, b: string) => Date.parse(a) > Date.parse(b);

export type OverviewResult = {
  hasWebsite: true;
  pages: Array<{
    id: string;
    name: string;
    path: string;
    title: string | null;
  }>;
  hasUnpublishedChanges: boolean;
  lastPublishedAt: string | null;
};

export const readOverview = (project: AgentProject): OverviewResult => ({
  hasWebsite: true,
  pages: orderedPages(project.build.pages).map((page) => ({
    id: page.id,
    name: page.name,
    path: page.path,
    title: readStaticTitle(page.title),
  })),
  hasUnpublishedChanges:
    project.lastPublishedAt === null ||
    isAfter(project.build.updatedAt, project.lastPublishedAt),
  lastPublishedAt: project.lastPublishedAt,
});

const SECTION_LABEL_RE = /^os-section:([a-z0-9][a-z0-9-]{0,63})$/;

/** A library section's root carries `label: "os-section:{type}"`. */
export const readSectionType = (label: string | undefined): string => {
  const match = label === undefined ? null : SECTION_LABEL_RE.exec(label);
  return match === null ? "custom" : match[1];
};

// Rich text formatting (Bold, Italic, links, spans) runs inline with the text
// around it; any other child instance is a block of its own and is set apart
// by a space, so a heading and the paragraph after it do not run together.
const isInline = (instance: Instance) =>
  richTextContentComponents.has(instance.component) &&
  (instance.component !== "ws:element" ||
    richTextContentTags.has(instance.tag));

/**
 * The plain text under `rootId`: text children in order, expression children
 * skipped (they are data, not the page's own words), placeholders skipped,
 * whitespace collapsed, capped at `limit` characters.
 */
export const flattenText = (
  instances: Map<Instance["id"], Instance>,
  rootId: Instance["id"],
  limit = SECTION_TEXT_LIMIT
): { text: string; truncated: boolean } => {
  const parts: string[] = [];
  const visited = new Set<Instance["id"]>();
  const walk = (instanceId: Instance["id"]) => {
    if (visited.has(instanceId)) {
      return;
    }
    visited.add(instanceId);
    const instance = instances.get(instanceId);
    if (instance === undefined) {
      return;
    }
    for (const child of instance.children) {
      if (child.type === "text") {
        if (child.placeholder !== true) {
          parts.push(child.value);
        }
        continue;
      }
      if (child.type !== "id") {
        continue;
      }
      const childInstance = instances.get(child.value);
      if (childInstance !== undefined && isInline(childInstance)) {
        walk(child.value);
      } else {
        parts.push(" ");
        walk(child.value);
        parts.push(" ");
      }
    }
  };
  walk(rootId);
  const text = parts.join("").replace(/\s+/g, " ").trim();
  if (text.length <= limit) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, limit), truncated: true };
};

export type ReadPageResult = {
  page: { id: string; name: string; path: string };
  sections: Array<{
    id: string;
    type: string;
    label: string | null;
    text: string;
    truncated: boolean;
    slots: [];
  }>;
};

export const readPage = (
  project: AgentProject,
  { pageId }: { pageId: string }
): AgentResult<ReadPageResult> => {
  const { pages, instances } = project.build;
  const page = pages.pages.get(pageId);
  if (page === undefined) {
    return notFound;
  }
  const root = instances.get(page.rootInstanceId);
  const sections: ReadPageResult["sections"] = [];
  for (const child of root?.children ?? []) {
    if (child.type !== "id") {
      continue;
    }
    const section = instances.get(child.value);
    if (section === undefined) {
      continue;
    }
    const type = readSectionType(section.label);
    sections.push({
      id: section.id,
      type,
      // The marker is the type, not a name a person gave the section.
      label: type === "custom" ? (section.label ?? null) : null,
      ...flattenText(instances, section.id),
      slots: [],
    });
  }
  return {
    ok: true,
    result: {
      page: { id: page.id, name: page.name, path: page.path },
      sections,
    },
  };
};

export type ListImagesResult = {
  images: Array<{
    id: string;
    name: string | null;
    alt: null;
    width: number;
    height: number;
  }>;
};

type AssetRow = {
  id: string;
  filename: string | null;
  file: { name: string; meta: string; createdAt: string } | null;
};

const readImageMeta = (meta: string) => {
  try {
    const value = JSON.parse(meta) as { width?: unknown; height?: unknown };
    if (typeof value.width === "number" && typeof value.height === "number") {
      return { width: value.width, height: value.height };
    }
  } catch {
    // not an image's meta
  }
};

/**
 * The project's uploaded images, newest first, at most IMAGE_LIMIT. The query
 * is upstream's `loadAssetsByProjectWithClient` (inner join on an UPLOADED
 * File) with an explicit column list, and the image test is `formatAsset`'s:
 * an image extension and numeric width and height. `name` is the display name
 * a person gave the upload; the File's name is the storage key and never
 * leaves this function.
 */
export const listImages = async (
  client: Client,
  organizationId: string
): Promise<AgentResult<ListImagesResult>> => {
  const projectId = await readLiveProjectId(client, organizationId);
  if (projectId === undefined) {
    return notFound;
  }
  const assets = await client
    .from("Asset")
    .select("id, filename, file:File!inner(name, meta, createdAt)")
    .eq("projectId", projectId)
    .eq("file.status", "UPLOADED")
    .order("id");
  if (assets.error) {
    throw assets.error;
  }

  const images: Array<ListImagesResult["images"][number] & { at: string }> = [];
  for (const row of (assets.data ?? []) as unknown as AssetRow[]) {
    if (row.file === null || detectAssetType(row.file.name) !== "image") {
      continue;
    }
    const meta = readImageMeta(row.file.meta);
    if (meta === undefined) {
      continue;
    }
    images.push({
      id: row.id,
      name: row.filename ?? null,
      alt: null,
      width: meta.width,
      height: meta.height,
      at: row.file.createdAt,
    });
  }
  images.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return {
    ok: true,
    result: {
      images: images
        .slice(0, IMAGE_LIMIT)
        .map(({ at: _at, ...image }) => image),
    },
  };
};
