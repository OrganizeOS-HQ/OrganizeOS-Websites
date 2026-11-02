import { beforeEach, describe, expect, test, vi } from "vitest";
import { parseCssValue } from "@webstudio-is/css-data";
import {
  type Asset,
  type StyleDecl,
  type StyleSourceSelection,
  ROOT_INSTANCE_ID,
} from "@webstudio-is/sdk";
import type { AppContext } from "@webstudio-is/trpc-interface/index.server";
import { createPages } from "../../../../../packages/project-build/src/template";
import { findCanonicalFontFamilies } from "./organizeos-canonical-fonts.server";
import { loadProductionCanvasData } from "./canvas.server";

const { loadBuildById, loadAssetsByProject, loadById } = vi.hoisted(() => ({
  loadBuildById: vi.fn(),
  loadAssetsByProject: vi.fn(),
  loadById: vi.fn(),
}));
vi.mock("@webstudio-is/project-build/index.server", () => ({ loadBuildById }));
vi.mock("@webstudio-is/asset-uploader/index.server", () => ({
  loadAssetsByProject,
}));
vi.mock("@webstudio-is/project/index.server", () => ({ loadById }));
vi.mock("./user.server", () => ({ getUserById: vi.fn() }));

const rootSelection: StyleSourceSelection = {
  instanceId: ROOT_INSTANCE_ID,
  values: ["root-token", "root-local"],
};

const decl = (
  property: `--${string}`,
  value: string,
  { styleSourceId = "root-local", breakpointId = "base" } = {}
): StyleDecl => ({
  styleSourceId,
  breakpointId,
  property,
  value: parseCssValue(property, value),
});

describe("findCanonicalFontFamilies", () => {
  test("reads the family Global Root's --font-heading and --font-body name first", () => {
    expect(
      findCanonicalFontFamilies({
        styles: [
          decl("--font-heading", '"Newsreader", Georgia, serif'),
          decl("--font-body", "Source Sans 3, system-ui, sans-serif"),
        ],
        styleSourceSelections: [rootSelection],
      })
    ).toEqual(new Set(["Newsreader", "Source Sans 3"]));
  });

  test("on any of Global Root's style sources and breakpoints", () => {
    expect(
      findCanonicalFontFamilies({
        styles: [
          decl("--font-heading", '"Barlow Condensed", sans-serif', {
            styleSourceId: "root-token",
          }),
          decl("--font-body", '"Barlow", sans-serif', {
            breakpointId: "phone",
          }),
        ],
        styleSourceSelections: [rootSelection],
      })
    ).toEqual(new Set(["Barlow Condensed", "Barlow"]));
  });

  test("not on another instance, nor from another variable", () => {
    expect(
      findCanonicalFontFamilies({
        styles: [
          decl("--font-heading", '"Newsreader", serif', {
            styleSourceId: "section-local",
          }),
          decl("--font-display", '"Archivo Black", sans-serif'),
          decl("--font-body", ", serif"),
        ],
        styleSourceSelections: [
          rootSelection,
          { instanceId: "section", values: ["section-local"] },
        ],
      })
    ).toEqual(new Set());
  });
});

describe("a publish's font assets", () => {
  const projectId = "project-1";

  const fontAsset = (id: string, family: string): Asset => ({
    id,
    projectId,
    type: "font",
    name: `${id}.woff2`,
    format: "woff2",
    size: 1,
    createdAt: "2026-10-31T00:00:00.000Z",
    meta: {
      family,
      variationAxes: {
        wght: { name: "Weight", min: 200, default: 400, max: 900 },
      },
    },
  });

  beforeEach(() => {
    const { pages, instances } = createPages();
    loadById.mockResolvedValue({
      id: projectId,
      domain: "site",
      domainsVirtual: [],
    });
    loadBuildById.mockResolvedValue({
      id: "build-1",
      projectId,
      version: 1,
      createdAt: "2026-10-31T00:00:00.000Z",
      updatedAt: "2026-10-31T00:00:00.000Z",
      pages,
      breakpoints: [],
      styles: [
        decl("--font-body", '"Source Sans 3", system-ui, sans-serif'),
        {
          styleSourceId: "heading-local",
          breakpointId: "base",
          property: "fontFamily",
          value: { type: "fontFamily", value: ["Newsreader", "serif"] },
        },
      ],
      styleSources: [],
      styleSourceSelections: [
        rootSelection,
        { instanceId: "heading", values: ["heading-local"] },
      ],
      props: [],
      dataSources: [],
      resources: [],
      instances: [...instances.values()],
      deployment: { domains: ["site"] },
      marketplaceProduct: undefined,
    });
    loadAssetsByProject.mockResolvedValue([
      fontAsset("source-sans-3", "Source Sans 3"),
      fontAsset("newsreader", "Newsreader"),
      fontAsset("public-sans", "Public Sans"),
    ]);
  });

  // OrganizeOS fork change in canvas.server.ts: the canonical font
  // variables are custom properties, which no fontFamily style carries.
  test("keep a font Global Root's canonical variables name, beside those a font-family names", async () => {
    const { assets } = await loadProductionCanvasData(
      "build-1",
      {} as AppContext
    );
    expect(assets.map((asset) => asset.id).sort()).toEqual([
      "newsreader",
      "source-sans-3",
    ]);
  });
});
