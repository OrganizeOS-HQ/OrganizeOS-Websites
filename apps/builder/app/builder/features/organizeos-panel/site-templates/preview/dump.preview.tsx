import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { test, vi } from "vitest";
import { enableMapSet } from "immer";
import { nanoid } from "nanoid";
import {
  type Asset,
  type WebstudioData,
  asset as assetSchema,
  findPageByIdOrPath,
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
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import { createPages } from "../../../../../../../../packages/project-build/src/template";
import { getAssetData } from "../../../../../../../../packages/asset-uploader/src/utils/get-asset-data";
import { registerContainers } from "~/shared/sync/sync-stores";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import { mergeSignupFormIntoBuild } from "~/shared/db/signup-form-preset.server";
import { getOrganizeosPresetIds } from "../../insert-organizeos-block";
import { applySiteTemplateMutable } from "../apply-site-template";

/**
 * The preview tool's dump (wave 1 plan, Task A1), run by
 * scripts/preview-site-template.mjs with vitest.preview.config.ts, never by the
 * default test run: a site template applied to a project as provisioning
 * leaves it, through the builder's own apply path, written as the bundle the
 * publish workflow builds a site from.
 *
 * Read from the environment:
 * - PREVIEW_TEMPLATE_ID: the template, by id;
 * - PREVIEW_API_BASE_URL: the org's public API, which the catalog Resources
 *   read (the script's stub);
 * - PREVIEW_OUT_DIR: where `.webstudio/data.json` (the CLI's LOCAL_DATA_FILE),
 *   `public/assets/` and `preview-pages.json` (each page's key and path) go;
 * - PREVIEW_PALETTE_FILE (optional): a JSON file of the six canonical values,
 *   applied in place of the template's own.
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

// The jsdom environment the apply path needs replaces the global Uint8Array
// with jsdom's, which getAssetData's readers (image-meta, fontkit) then check
// Node's Buffers against. Node's own, as vitest's node environment has it.
globalThis.Uint8Array = Object.getPrototypeOf(Buffer.prototype).constructor;

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

const findTemplate = (id: string): SiteTemplate => {
  const template = SITE_TEMPLATES.find((item) => item.id === id);
  if (template === undefined) {
    const known = SITE_TEMPLATES.map((item) => item.id).join(", ");
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
 * A project as provisioning leaves it (apply-site-template.test.tsx):
 * `createPages()` (Home and the 404 page), the catalog Resources seeded on
 * every provision (a block's insert creates Forms and Upcoming Events) and the
 * seeded sign-up page.
 */
const createProvisionedProject = async (
  apiBaseUrl: string
): Promise<WebstudioData> => {
  const presetIds = await getOrganizeosPresetIds(projectId);
  const { resources: catalog } = await buildOrgResourcePresets({
    projectId,
    apiBaseUrl,
    readToken,
  });
  const data = createPages();
  const seeded = await mergeSignupFormIntoBuild(
    {
      instances: [...data.instances.values()],
      props: [...data.props.values()],
      dataSources: [...data.dataSources.values()],
      resources: catalog.filter(
        (resource) =>
          resource.id !== presetIds.forms.resourceId &&
          resource.id !== presetIds.upcomingEvents.resourceId
      ),
      pages: data.pages,
    },
    { projectId, apiBaseUrl, readToken }
  );
  const byId = <Item extends { id: string }>(items: Item[]) =>
    new Map(items.map((item) => [item.id, item]));
  return {
    ...data,
    instances: byId(seeded.instances),
    props: byId(seeded.props),
    dataSources: byId(seeded.dataSources),
    resources: byId(seeded.resources),
    pages: seeded.pages,
  };
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
 * The font families the build's styles name: a publish carries a font asset
 * only when one of them is its family (loadProductionCanvasDataAndProject in
 * shared/db/canvas.server.ts).
 */
const findStyleFontFamilies = (data: WebstudioData) => {
  const families = new Set<string>();
  for (const { value } of data.styles.values()) {
    if (value.type === "fontFamily") {
      for (const family of value.value) {
        families.add(family);
      }
    }
  }
  return families;
};

test("dump a template's site", async () => {
  const template = findTemplate(readEnv("PREVIEW_TEMPLATE_ID"));
  const apiBaseUrl = readEnv("PREVIEW_API_BASE_URL");
  const outDir = readEnv("PREVIEW_OUT_DIR");
  const paletteFile = process.env.PREVIEW_PALETTE_FILE;
  const variables =
    paletteFile === undefined || paletteFile === ""
      ? template.variables
      : await readPalette(paletteFile);

  // `fonts` joins the template format with bundled fonts (wave 1 Task A3)
  const {
    images,
    fonts = {},
  }: {
    images: Record<string, { url: string }>;
    fonts?: Record<string, { url: string }>;
  } = template;
  const imageFiles = new Map<string, AssetFile>();
  for (const [file, { url }] of Object.entries(images)) {
    imageFiles.set(file, await createAssetFile("image", file, url));
  }
  const fontFiles: AssetFile[] = [];
  for (const [file, { url }] of Object.entries(fonts)) {
    fontFiles.push(await createAssetFile("font", file, url));
  }

  // the builder's apply: renderSiteTemplate, then applySiteTemplateMutable
  // on the project data (applySiteTemplate in ../apply-site-template.ts)
  const data = await createProvisionedProject(apiBaseUrl);
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
    ignoreAssetIds: new Set(assetIds.values()),
  });
  if (result.status !== "applied") {
    throw new Error(`The apply refused the template: ${result.reason}`);
  }
  if (result.unboundBlocks.length > 0) {
    throw new Error(`Blocks left unbound: ${result.unboundBlocks.join(", ")}`);
  }

  const fontFamilies = findStyleFontFamilies(data);
  const assetFiles = [
    ...imageFiles.values(),
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
    projectTitle: template.name,
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
  await writeFile(
    join(outDir, "preview-pages.json"),
    JSON.stringify(
      pages.map(({ key, path }) => ({ key, path: path === "" ? "/" : path }))
    )
  );
}, 60_000);
