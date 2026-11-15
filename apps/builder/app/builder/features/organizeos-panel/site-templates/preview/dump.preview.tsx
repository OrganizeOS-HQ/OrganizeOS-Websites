import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { test, vi } from "vitest";
import { enableMapSet } from "immer";
import { nanoid } from "nanoid";
import {
  type Asset,
  type WebstudioData,
  asset as assetSchema,
  findPageByIdOrPath,
  findTreeInstanceIds,
  getAllPages,
} from "@webstudio-is/sdk";
import {
  type PublishedProjectBundle,
  bundleVersion,
  publishedProjectBundle,
} from "@webstudio-is/protocol";
import { serializePages } from "@webstudio-is/project-migrations/pages";
import {
  type CanonicalValues,
  type SiteTemplate,
  CANONICAL_COLOR_NAMES,
  CANONICAL_FONT_NAMES,
  SITE_TEMPLATES,
  findPageAssetIds,
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import {
  NEUTRAL_LOOK,
  STARTER_PAGES,
  renderStarterPage,
} from "@organizeos/site-components/starter-pages";
import { getAssetData } from "../../../../../../../../packages/asset-uploader/src/utils/get-asset-data";
import { spikeTemplate } from "../../../../../../../../packages/sdk-components-organizeos/src/site-templates/__fixtures__/spike";
import { registerContainers } from "~/shared/sync/sync-stores";
import { findCanonicalFontFamilies } from "~/shared/db/organizeos-canonical-fonts.server";
import { getOrganizeosPresetIds } from "../../insert-organizeos-block";
import {
  applySiteTemplateMutable,
  startBlankMutable,
} from "../apply-site-template";
import { createProvisionedProject } from "../provisioned-project";
import {
  insertStarterPageMutable,
  starterDefaultPath,
} from "../../starter-pages/insert-starter-page";
import { sampleEvents } from "./stub-api.mjs";

/**
 * The preview tool's dump (wave 1 plan, Task A1), run by
 * scripts/preview-site-template.mjs with vitest.preview.config.ts, never by the
 * default test run: a site template applied to a project as provisioning
 * leaves it, through the builder's own apply path, written as the bundle the
 * publish workflow builds a site from.
 *
 * Read from the environment:
 * - PREVIEW_TEMPLATE_ID: the template, by id (a catalog entry or a fixture);
 * - PREVIEW_API_BASE_URL: the org's public API, which the catalog Resources
 *   read (the script's stub);
 * - PREVIEW_OUT_DIR: where `.webstudio/data.json` (the CLI's LOCAL_DATA_FILE),
 *   `public/assets/`, `preview-pages.json` (each page's key and path) and
 *   `preview-template.json` go. The last holds `previewEventCover`, the file
 *   of the template's preview event cover, or null when it names none, which
 *   the script's stub serves as the first sample event's cover; and
 *   `imagesDir`, the template's images/ folder (its thumbnail's), where
 *   --thumbnail writes, or null for a template with no image;
 * - PREVIEW_PALETTE_FILE (optional): a JSON file of the six canonical values,
 *   applied in place of the template's own.
 *
 * Or, with PREVIEW_STARTER_ID set, a page template (plan C2, Task 5) added to
 * a blank site, or with PREVIEW_LOOK_ID to that site template applied,
 * through the builder's own insert (insertStarterPageMutable), with no site
 * forms. Its RSVP Form, if any, gets the first sample event as its record,
 * which only the preview sets: the org picks the event. preview-pages.json
 * then holds the new page alone, and preview-template.json also
 * `pictureFile`, the page template's picture, which --thumbnail draws. Only
 * the catalog's page templates are looked up, never the sample fixture, so
 * no run can draw over the spike's cover.
 */

// Ids as a counter, so two dumps of one template differ only in the palette.
vi.mock("nanoid", async (importOriginal) => {
  let count = 0;
  return {
    ...(await importOriginal<typeof import("nanoid")>()),
    nanoid: (size = 21) => String(++count).padStart(size, "0"),
  };
});

enableMapSet();
registerContainers();

const projectId = "preview-project";
const readToken = "osk_preview";
/** Every date the bundle holds, fixed for the same reason as the ids. */
const createdAt = "2026-01-01T00:00:00.000Z";

const readEnv = (name: string) => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is not set; run scripts/preview-site-template.mjs`
    );
  }
  return value;
};

/**
 * Templates the tool runs that are not in the catalog: fixtures, which the
 * chooser never offers (the spike proves the apply path).
 */
const PREVIEW_FIXTURES: SiteTemplate[] = [spikeTemplate];

const findTemplate = (id: string): SiteTemplate => {
  const templates = [...SITE_TEMPLATES, ...PREVIEW_FIXTURES];
  const template = templates.find((item) => item.id === id);
  if (template === undefined) {
    const known = templates.map((item) => item.id).join(", ");
    throw new Error(`No template has the id "${id}". Known: ${known}`);
  }
  return template;
};

const canonicalNames: string[] = [
  ...CANONICAL_COLOR_NAMES,
  ...CANONICAL_FONT_NAMES,
];

const readPalette = async (file: string): Promise<CanonicalValues> => {
  const palette: unknown = JSON.parse(await readFile(file, "utf8"));
  if (
    typeof palette !== "object" ||
    palette === null ||
    Object.keys(palette).length !== canonicalNames.length ||
    canonicalNames.some(
      (name) => typeof (palette as Record<string, unknown>)[name] !== "string"
    )
  ) {
    throw new Error(
      `${file} must set the six canonical values and nothing else: ${canonicalNames.join(", ")}`
    );
  }
  return palette as CanonicalValues;
};

/**
 * The file behind a `?url` import. Under vitest the URL is the file's path
 * from the vitest root, or `/@fs/` and its absolute path outside the root.
 */
const getUrlFile = (url: string) => {
  const path = decodeURI(url.split("?")[0]);
  if (path.startsWith("/@fs/")) {
    return path.slice("/@fs".length);
  }
  if (path.startsWith("/")) {
    return join(readEnv("PREVIEW_VITEST_ROOT"), path);
  }
  throw new Error(`Not a file URL: ${url.slice(0, 60)}`);
};

type AssetFile = { asset: Asset; path: string };

/**
 * A template file's asset row, as an upload of the file makes it: its id the
 * SHA-256 of its bytes (getSha256HashOfFile), its name the upload's
 * `<name>_<id><extension>` (getUniqueFilename), and its format and meta from
 * getAssetData, the upload's own reading of the file.
 */
const createAssetFile = async (
  type: "image" | "font",
  file: string,
  url: string
): Promise<AssetFile> => {
  const path = getUrlFile(url);
  const data = await readFile(path);
  const id = createHash("sha256").update(data).digest("hex");
  const extension = extname(file);
  const name = `${basename(file, extension)}_${id.slice(0, 21)}${extension}`;
  const { size, format, meta } = await getAssetData({
    type,
    size: data.byteLength,
    data,
    name,
  });
  return {
    asset: assetSchema.parse({
      id,
      projectId,
      type,
      name,
      format,
      size,
      createdAt,
      meta,
    }),
    path,
  };
};

/**
 * The font families the build's styles name, and those its canonical font
 * variables name first: a publish carries a font asset only when one of them
 * is its family (loadProductionCanvasDataAndProject in
 * shared/db/canvas.server.ts).
 */
const findStyleFontFamilies = (data: WebstudioData) => {
  const families = findCanonicalFontFamilies({
    styles: data.styles.values(),
    styleSourceSelections: data.styleSourceSelections.values(),
  });
  for (const { value } of data.styles.values()) {
    if (value.type === "fontFamily") {
      for (const family of value.value) {
        families.add(family);
      }
    }
  }
  return families;
};

type AppliedTemplate = {
  template: SiteTemplate;
  pages: ReturnType<typeof renderSiteTemplate>;
  imageFiles: Map<string, AssetFile>;
  fontFiles: AssetFile[];
};

/**
 * The builder's apply of `template` to `data`: renderSiteTemplate, then
 * applySiteTemplateMutable (applySiteTemplate in ../apply-site-template.ts),
 * with the asset rows its files' uploads would make.
 */
const applyTemplate = async (
  data: WebstudioData,
  template: SiteTemplate,
  variables: CanonicalValues
): Promise<AppliedTemplate> => {
  const imageFiles = new Map<string, AssetFile>();
  for (const [file, { url }] of Object.entries(template.images)) {
    imageFiles.set(file, await createAssetFile("image", file, url));
  }
  const fontFiles: AssetFile[] = [];
  for (const [file, { url }] of Object.entries(template.fonts)) {
    fontFiles.push(await createAssetFile("font", file, url));
  }

  const assetIds = new Map(
    Array.from(imageFiles, ([file, { asset }]) => [file, asset.id])
  );
  const pages = renderSiteTemplate(template, {
    assetIds,
    generatePageId: nanoid,
  });
  const result = applySiteTemplateMutable(data, pages, {
    projectId,
    presetIds: await getOrganizeosPresetIds(projectId),
    variables,
    blockTokens: template.blockTokens,
  });
  if (result.status !== "applied") {
    throw new Error(`The apply refused the template: ${result.reason}`);
  }
  if (result.unboundBlocks.length > 0) {
    throw new Error(`Blocks left unbound: ${result.unboundBlocks.join(", ")}`);
  }
  return { template, pages, imageFiles, fontFiles };
};

/**
 * The bundle the publish workflow syncs, written to `outDir` with the files
 * an upload of the template would have made: the images its pages show and
 * the fonts the styles name.
 */
const writeSite = async (
  outDir: string,
  data: WebstudioData,
  { title, applied }: { title: string; applied: AppliedTemplate | undefined }
) => {
  const shownAssetIds =
    applied === undefined ? new Set<string>() : findPageAssetIds(applied.pages);
  const imageFiles = applied?.imageFiles ?? new Map<string, AssetFile>();
  const fontFiles = applied?.fontFiles ?? [];
  const fontFamilies = findStyleFontFamilies(data);
  const assetFiles = [
    ...Array.from(imageFiles.values()).filter(({ asset }) =>
      shownAssetIds.has(asset.id)
    ),
    ...fontFiles.filter(
      ({ asset }) =>
        asset.type === "font" && fontFamilies.has(asset.meta.family)
    ),
  ];
  const home = findPageByIdOrPath("/", data.pages);
  if (home === undefined) {
    throw new Error("The project has no Home page");
  }
  // as the builder serves a build to the publish workflow's sync
  // (shared/db/canvas.server.ts)
  const bundle: PublishedProjectBundle = publishedProjectBundle.parse({
    build: {
      id: "preview-build",
      projectId,
      version: 1,
      createdAt,
      updatedAt: createdAt,
      pages: serializePages(data.pages),
      breakpoints: Array.from(data.breakpoints),
      styles: Array.from(data.styles),
      styleSources: Array.from(data.styleSources),
      styleSourceSelections: Array.from(data.styleSourceSelections),
      props: Array.from(data.props),
      instances: Array.from(data.instances),
      dataSources: Array.from(data.dataSources),
      resources: Array.from(data.resources),
    },
    page: home,
    pages: getAllPages(data.pages),
    assets: assetFiles.map(({ asset }) => asset),
    projectDomain: "preview",
    projectTitle: title,
    bundleVersion,
  });

  await mkdir(join(outDir, ".webstudio"), { recursive: true });
  await writeFile(
    join(outDir, ".webstudio", "data.json"),
    JSON.stringify(bundle, null, 2)
  );
  // the site template's assetBaseUrl is /assets/
  await mkdir(join(outDir, "public", "assets"), { recursive: true });
  for (const { asset, path } of assetFiles) {
    await copyFile(path, join(outDir, "public", "assets", asset.name));
  }
};

/** The file of a template's preview event cover, or null. */
const previewEventCoverFile = (applied: AppliedTemplate | undefined) => {
  const cover = applied?.template.previewEventCover;
  return cover === undefined
    ? null
    : (applied?.imageFiles.get(cover)?.path ?? null);
};

const RSVP_FORM = "@organizeos/site-components:RsvpForm";

/**
 * Each RSVP Form on the page gets `eventId` as its event (`record`), in
 * place of any it has.
 */
const setRsvpRecordMutable = (
  data: WebstudioData,
  rootInstanceId: string,
  eventId: string
) => {
  for (const instanceId of findTreeInstanceIds(
    data.instances,
    rootInstanceId
  )) {
    if (data.instances.get(instanceId)?.component !== RSVP_FORM) {
      continue;
    }
    for (const prop of Array.from(data.props.values())) {
      if (prop.instanceId === instanceId && prop.name === "record") {
        data.props.delete(prop.id);
      }
    }
    const id = nanoid();
    data.props.set(id, {
      id,
      instanceId,
      name: "record",
      type: "string",
      value: eventId,
    });
  }
};

const dumpStarterPage = async (starterId: string, lookId: string) => {
  const page = STARTER_PAGES.find((item) => item.id === starterId);
  if (page === undefined) {
    const known = STARTER_PAGES.map((item) => item.id).join(", ");
    throw new Error(
      `No page template has the id "${starterId}". Known: ${known}`
    );
  }
  const apiBaseUrl = readEnv("PREVIEW_API_BASE_URL");
  const outDir = readEnv("PREVIEW_OUT_DIR");
  const template = lookId === "" ? undefined : findTemplate(lookId);

  const data = await createProvisionedProject({
    projectId,
    apiBaseUrl,
    readToken,
  });
  let applied: AppliedTemplate | undefined;
  if (template === undefined) {
    startBlankMutable(data);
  } else {
    applied = await applyTemplate(data, template, template.variables);
  }

  const rendered = renderStarterPage(page, {
    look: template?.look ?? NEUTRAL_LOOK,
    generatePageId: nanoid,
  });
  const path = starterDefaultPath(data.pages, page);
  const result = insertStarterPageMutable(data, rendered, {
    projectId,
    presetIds: await getOrganizeosPresetIds(projectId),
    name: page.pageName,
    path,
  });
  if (result.status !== "added") {
    throw new Error(`The insert refused the page template: ${result.reason}`);
  }
  if (result.unboundBlocks.length > 0) {
    throw new Error(`Blocks left unbound: ${result.unboundBlocks.join(", ")}`);
  }
  const added = data.pages.pages.get(result.pageId);
  if (added === undefined) {
    throw new Error("The insert added no page");
  }
  setRsvpRecordMutable(
    data,
    added.rootInstanceId,
    sampleEvents(apiBaseUrl)[0].id
  );

  await writeSite(outDir, data, {
    title: template === undefined ? page.name : template.name,
    applied,
  });
  await writeFile(
    join(outDir, "preview-pages.json"),
    JSON.stringify([{ key: page.id, path }])
  );
  await writeFile(
    join(outDir, "preview-template.json"),
    JSON.stringify({
      previewEventCover: previewEventCoverFile(applied),
      imagesDir: null,
      pictureFile: getUrlFile(page.images[page.picture].url),
    })
  );
};

const dumpTemplate = async (templateId: string) => {
  const template = findTemplate(templateId);
  const apiBaseUrl = readEnv("PREVIEW_API_BASE_URL");
  const outDir = readEnv("PREVIEW_OUT_DIR");
  const paletteFile = process.env.PREVIEW_PALETTE_FILE;
  const variables =
    paletteFile === undefined || paletteFile === ""
      ? template.variables
      : await readPalette(paletteFile);
  const data = await createProvisionedProject({
    projectId,
    apiBaseUrl,
    readToken,
  });
  const applied = await applyTemplate(data, template, variables);
  const { pages, imageFiles } = applied;
  await writeSite(outDir, data, { title: template.name, applied });
  await writeFile(
    join(outDir, "preview-pages.json"),
    JSON.stringify(
      pages.map(({ key, path }) => ({ key, path: path === "" ? "/" : path }))
    )
  );
  // the thumbnail's file, else any image's, is in the template's images/
  const folderImage =
    imageFiles.get(template.thumbnail) ?? imageFiles.values().next().value;
  await writeFile(
    join(outDir, "preview-template.json"),
    JSON.stringify({
      previewEventCover: previewEventCoverFile(applied),
      imagesDir: folderImage === undefined ? null : dirname(folderImage.path),
    })
  );
};

test("dump a template's site", async () => {
  // readEnv refuses "", which the script passes for an option not given, so
  // the page template's two are read as they are
  const starterId = process.env.PREVIEW_STARTER_ID ?? "";
  if (starterId !== "") {
    await dumpStarterPage(starterId, process.env.PREVIEW_LOOK_ID ?? "");
    return;
  }
  await dumpTemplate(readEnv("PREVIEW_TEMPLATE_ID"));
}, 60_000);
