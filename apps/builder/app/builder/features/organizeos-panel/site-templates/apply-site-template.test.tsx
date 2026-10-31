import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { parseCssValue } from "@webstudio-is/css-data";
import {
  type Asset,
  type Instance,
  type Page,
  type StyleDecl,
  type WebstudioData,
  ROOT_FOLDER_ID,
  ROOT_INSTANCE_ID,
  encodeDataSourceVariable,
  findTreeInstanceIds,
  getAllPages,
  getStyleDeclKey,
} from "@webstudio-is/sdk";
import { showAttribute } from "@webstudio-is/react-sdk";
import {
  $,
  PageValue,
  ResourceValue,
  css,
  expression,
  ws,
} from "@webstudio-is/template";
import {
  type BlockKey,
  type CanonicalValues,
  type FontEntry,
  type RenderedPage,
  type SiteTemplate,
  BLANK_CANONICAL_VALUES,
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import { spikeTemplate as spike } from "../../../../../../../packages/sdk-components-organizeos/src/site-templates/__fixtures__/spike";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import {
  $selectedInstanceSelector,
  selectInstance,
} from "~/shared/nano-states";
import { getWebstudioData } from "~/shared/instance-utils/data";
import {
  getSha256Hash,
  getSha256HashOfFile,
} from "~/builder/shared/assets/asset-utils";
import {
  SIGNUP_PAGE_PATH,
  UPCOMING_EVENTS_BINDING_NAME,
} from "~/shared/organizeos-preset-ids";
import { getOrganizeosPresetIds } from "../insert-organizeos-block";
import { createProvisionedProject } from "./provisioned-project";
import {
  applySiteTemplate,
  applySiteTemplateMutable,
  hasCanonicalVariables,
  isProjectUntouched,
  startBlankMutable,
  writeCanonicalVariablesMutable,
} from "./apply-site-template";

const { uploadAssets } = vi.hoisted(() => ({ uploadAssets: vi.fn() }));
vi.mock("~/builder/shared/assets/upload-assets", () => ({ uploadAssets }));

enableMapSet();
registerContainers();

const projectId = "project-1";
const apiBaseUrl = "https://app.example.org/api/public/v1";
const presetIds = await getOrganizeosPresetIds(projectId);
const provisioning = { projectId, apiBaseUrl, readToken: "osk_token" };

const imageAsset = (id: string): Asset => ({
  id,
  projectId,
  type: "image",
  name: `${id}.jpg`,
  format: "jpg",
  size: 1,
  createdAt: "2026-10-30T00:00:00.000Z",
  meta: { width: 1, height: 1 },
});

const EventList: BlockKey = "@organizeos/site-components:EventList";

const variables: CanonicalValues = {
  base: "#0f172a",
  "accent-1": "#fbbf24",
  "accent-2": "#38bdf8",
  text: "#f8fafc",
  "font-heading": "Georgia, serif",
  "font-body": "system-ui, sans-serif",
};

const template: SiteTemplate = {
  id: "fixture",
  category: "nonprofit",
  name: "Fixture",
  oneLine: "A two-page fixture",
  styleTags: [],
  status: "draft",
  dependsOn: [],
  thumbnail: "/thumbnail.jpg",
  variables,
  images: {
    "hero.jpg": {
      url: "/site-templates/fixture/hero.jpg",
      sourceUrl: "https://example.org/hero",
      alt: "Replace with a photo of your members",
    },
    "team.jpg": {
      url: "/site-templates/fixture/team.jpg",
      sourceUrl: "https://example.org/team",
      alt: "Replace with a photo of your team",
    },
  },
  fonts: {},
  pages: [
    {
      key: "home",
      name: "Home",
      path: "",
      title: "Welcome",
      description:
        "Say in one sentence what your organization is working toward.",
      body: ({ pageIds, placeBlock, image, imageAlt }) => (
        <ws.element
          ws:tag="body"
          ws:style={css`
            color: var(--text);
          `}
        >
          <ws.element ws:tag="h1">{"Your organization's goal"}</ws.element>
          <$.Image
            ws:id="hero"
            src={image("hero.jpg")}
            alt={imageAlt("hero.jpg")}
          />
          <$.Link ws:id="about-link" href={new PageValue(pageIds.about)}>
            {"About us"}
          </$.Link>
          {placeBlock(EventList, "upcoming")}
        </ws.element>
      ),
    },
    {
      key: "about",
      name: "About",
      path: "/about",
      title: "About us",
      description: "Say who you are and who you work with.",
      body: ({ pageIds, image, imageAlt, backgroundImage }) => (
        <ws.element ws:tag="body" ws:style={backgroundImage("hero.jpg")}>
          <ws.element ws:tag="h1">{"About us"}</ws.element>
          <$.Image
            ws:id="team"
            src={image("team.jpg")}
            alt={imageAlt("team.jpg")}
          />
          <$.Link ws:id="home-link" href={new PageValue(pageIds.home)}>
            {"Home"}
          </$.Link>
        </ws.element>
      ),
    },
  ],
};

let pageCount = 0;
const renderPages = (): RenderedPage[] =>
  renderSiteTemplate(template, {
    assetIds: new Map([
      ["hero.jpg", "asset-hero"],
      ["team.jpg", "asset-team"],
    ]),
    generatePageId: () => `page-${++pageCount}`,
  });

const context = {
  projectId,
  presetIds,
  variables,
  ignoreAssetIds: new Set<string>(),
  blockTokens: undefined,
};

/**
 * The fixture with its Event List as dated cards, and a look for two of the
 * block tokens: OS Card's top border and padding, and OS Event Date's width
 * on the narrowest phones.
 */
const datedTemplate: SiteTemplate = {
  ...template,
  pages: [
    {
      ...template.pages[0],
      body: ({ placeBlock }) => (
        <ws.element ws:tag="body">
          <ws.element ws:tag="h1">{"Your organization's goal"}</ws.element>
          {placeBlock(EventList, "upcoming", { card: "dated" })}
        </ws.element>
      ),
    },
    template.pages[1],
  ],
  blockTokens: {
    "OS Card": css`
      padding: 24px;
      border-top-color: var(--accent-1);
    `,
    "OS Event Date": css`
      @media (max-width: 479px) {
        width: 56px;
      }
    `,
  },
};

const renderDatedPages = () =>
  renderSiteTemplate(datedTemplate, {
    assetIds: new Map([
      ["hero.jpg", "asset-hero"],
      ["team.jpg", "asset-team"],
    ]),
    generatePageId: () => `page-${++pageCount}`,
  });

/** The project's tokens of a name. */
const tokensNamed = (data: WebstudioData, name: string) =>
  [...data.styleSources.values()].filter(
    (source) => source.type === "token" && source.name === name
  );

/** A token's declarations, by breakpoint width (undefined for the base). */
const tokenDecls = (data: WebstudioData, styleSourceId: string) =>
  [...data.styles.values()]
    .filter((decl) => decl.styleSourceId === styleSourceId)
    .map((decl) => ({
      maxWidth: data.breakpoints.get(decl.breakpointId)?.maxWidth,
      breakpointId: decl.breakpointId,
      property: decl.property,
      state: decl.state,
      value: decl.value,
    }));

/**
 * "OS Card" as an Event Card inserted on /newsletter before a template is
 * chosen leaves it: its old literal border, and a declaration of its own.
 */
const withOldCardToken = async () => {
  const data = await createProvisionedProject(provisioning);
  data.styleSources.set("old-card", {
    type: "token",
    id: "old-card",
    name: "OS Card",
  });
  for (const [property, value] of [
    ["borderTopColor", parseCssValue("border-top-color", "#e4e4e7")],
    ["paddingTop", parseCssValue("padding-top", "16px")],
    ["cursor", parseCssValue("cursor", "pointer")],
  ] as const) {
    const decl: StyleDecl = {
      styleSourceId: "old-card",
      breakpointId: findBaseBreakpoint(data).id,
      property,
      value,
    };
    data.styles.set(getStyleDeclKey(decl), decl);
  }
  return data;
};

const findPage = (data: WebstudioData, path: string) =>
  getAllPages(data.pages).find((page) => page.path === path);

const childrenOf = (data: WebstudioData, instanceId: Instance["id"]) =>
  (data.instances.get(instanceId)?.children ?? []).flatMap((child) => {
    const instance =
      child.type === "id" ? data.instances.get(child.value) : undefined;
    return instance === undefined ? [] : [instance];
  });

const findBaseBreakpoint = (data: WebstudioData) =>
  [...data.breakpoints.values()].find(
    (breakpoint) =>
      breakpoint.minWidth === undefined &&
      breakpoint.maxWidth === undefined &&
      breakpoint.condition === undefined
  )!;

const rootStyles = (data: WebstudioData) => {
  const values = data.styleSourceSelections.get(ROOT_INSTANCE_ID)?.values;
  return [...data.styles.values()].filter((decl) =>
    values?.includes(decl.styleSourceId)
  );
};

const stylesOf = (data: WebstudioData, instanceId: Instance["id"]) => {
  const values = data.styleSourceSelections.get(instanceId)?.values ?? [];
  return [...data.styles.values()].filter((decl) =>
    values.includes(decl.styleSourceId)
  );
};

/** Global Root with a local style source declaring `--base: #000000`. */
const withBlackBase = async () => {
  const data = await createProvisionedProject(provisioning);
  data.styleSources.set("root-local", { type: "local", id: "root-local" });
  data.styleSourceSelections.set(ROOT_INSTANCE_ID, {
    instanceId: ROOT_INSTANCE_ID,
    values: ["root-local"],
  });
  const decl: StyleDecl = {
    styleSourceId: "root-local",
    breakpointId: findBaseBreakpoint(data).id,
    property: "--base",
    value: parseCssValue("--base", "#000000"),
  };
  data.styles.set(getStyleDeclKey(decl), decl);
  return data;
};

describe("isProjectUntouched", () => {
  test("a provisioned project (Home, 404, /newsletter) is untouched", async () => {
    const data = await createProvisionedProject(provisioning);

    expect(getAllPages(data.pages).map((page) => page.path)).toEqual([
      "",
      "/*",
      SIGNUP_PAGE_PATH,
    ]);
    expect(isProjectUntouched(data)).toBe(true);
  });

  test("a Home child makes it touched", async () => {
    const data = await createProvisionedProject(provisioning);
    const home = data.pages.pages.get(data.pages.homePageId)!;
    data.instances.set("heading", {
      type: "instance",
      id: "heading",
      component: "ws:element",
      tag: "h1",
      children: [],
    });
    data.instances
      .get(home.rootInstanceId)
      ?.children.push({ type: "id", value: "heading" });

    expect(isProjectUntouched(data)).toBe(false);
  });

  test("another page makes it touched", async () => {
    const data = await createProvisionedProject(provisioning);
    data.instances.set("about-body", {
      type: "instance",
      id: "about-body",
      component: "ws:element",
      tag: "body",
      children: [],
    });
    data.pages.pages.set("about", {
      id: "about",
      name: "About",
      path: "/about",
      title: `"About"`,
      meta: {},
      rootInstanceId: "about-body",
    });

    expect(isProjectUntouched(data)).toBe(false);
  });

  test("an asset makes it touched unless ignored", async () => {
    const data = await createProvisionedProject(provisioning);
    data.assets.set("asset-hero", imageAsset("asset-hero"));

    expect(isProjectUntouched(data)).toBe(false);
    expect(
      isProjectUntouched(data, { ignoreAssetIds: new Set(["asset-hero"]) })
    ).toBe(true);
    expect(
      isProjectUntouched(data, { ignoreAssetIds: new Set(["asset-team"]) })
    ).toBe(false);
  });
});

describe("the canonical variables", () => {
  test("writes the six variables once", async () => {
    for (const mode of ["fill", "overwrite"] as const) {
      const data = await withBlackBase();
      const base = findBaseBreakpoint(data);

      writeCanonicalVariablesMutable(data, BLANK_CANONICAL_VALUES, mode);
      writeCanonicalVariablesMutable(data, BLANK_CANONICAL_VALUES, mode);

      expect(data.styleSourceSelections.get(ROOT_INSTANCE_ID)).toEqual({
        instanceId: ROOT_INSTANCE_ID,
        values: ["root-local"],
      });
      const declared = rootStyles(data);
      expect(declared.map((decl) => decl.property).sort()).toEqual([
        "--accent-1",
        "--accent-2",
        "--base",
        "--font-body",
        "--font-heading",
        "--text",
      ]);
      for (const decl of declared) {
        expect(decl.breakpointId).toBe(base.id);
        expect(data.styles.get(getStyleDeclKey(decl))).toBe(decl);
      }
      expect(
        declared.find((decl) => decl.property === "--base")?.value
      ).toEqual(
        parseCssValue("--base", mode === "fill" ? "#000000" : "#ffffff")
      );
    }
  });

  test("creates Global Root's local style source when it has none", async () => {
    const data = await createProvisionedProject(provisioning);
    expect(data.styleSourceSelections.has(ROOT_INSTANCE_ID)).toBe(false);

    writeCanonicalVariablesMutable(data, BLANK_CANONICAL_VALUES, "overwrite");

    const [styleSourceId] =
      data.styleSourceSelections.get(ROOT_INSTANCE_ID)?.values ?? [];
    expect(data.styleSources.get(styleSourceId)).toEqual({
      type: "local",
      id: styleSourceId,
    });
    const value = (property: string) =>
      rootStyles(data).find((decl) => decl.property === property)?.value;
    // colours parse to a colour, the font stacks stay as written
    expect(value("--accent-2")).toEqual(parseCssValue("--accent-2", "#2563eb"));
    expect(value("--accent-2")?.type).not.toBe("unparsed");
    expect(value("--font-body")).toEqual({
      type: "unparsed",
      value: BLANK_CANONICAL_VALUES["font-body"],
    });
  });

  test("hasCanonicalVariables reads Global Root on any breakpoint", async () => {
    const data = await createProvisionedProject(provisioning);
    expect(hasCanonicalVariables(data)).toBe(false);

    const mobile = [...data.breakpoints.values()].find(
      (breakpoint) => breakpoint.maxWidth !== undefined
    )!;
    data.styleSources.set("root-local", { type: "local", id: "root-local" });
    data.styleSourceSelections.set(ROOT_INSTANCE_ID, {
      instanceId: ROOT_INSTANCE_ID,
      values: ["root-local"],
    });
    const brand: StyleDecl = {
      styleSourceId: "root-local",
      breakpointId: findBaseBreakpoint(data).id,
      property: "--brand",
      value: parseCssValue("--brand", "#ff0000"),
    };
    data.styles.set(getStyleDeclKey(brand), brand);
    expect(hasCanonicalVariables(data)).toBe(false);

    const text: StyleDecl = {
      styleSourceId: "root-local",
      breakpointId: mobile.id,
      property: "--text",
      value: parseCssValue("--text", "#000000"),
    };
    data.styles.set(getStyleDeclKey(text), text);
    expect(hasCanonicalVariables(data)).toBe(true);
  });

  test("a canonical name on another instance is not Global Root's", async () => {
    const data = await createProvisionedProject(provisioning);
    const home = data.pages.pages.get(data.pages.homePageId)!;
    data.styleSources.set("body-local", { type: "local", id: "body-local" });
    data.styleSourceSelections.set(home.rootInstanceId, {
      instanceId: home.rootInstanceId,
      values: ["body-local"],
    });
    const decl: StyleDecl = {
      styleSourceId: "body-local",
      breakpointId: findBaseBreakpoint(data).id,
      property: "--base",
      value: parseCssValue("--base", "#000000"),
    };
    data.styles.set(getStyleDeclKey(decl), decl);

    expect(hasCanonicalVariables(data)).toBe(false);
  });

  test("Start blank fills only what Global Root lacks", async () => {
    const data = await withBlackBase();

    startBlankMutable(data);

    expect(hasCanonicalVariables(data)).toBe(true);
    const value = (property: string) =>
      rootStyles(data).find((decl) => decl.property === property)?.value;
    expect(value("--base")).toEqual(parseCssValue("--base", "#000000"));
    expect(value("--text")).toEqual(parseCssValue("--text", "#18181b"));
  });
});

describe("applySiteTemplateMutable", () => {
  test("applies a two-page template", async () => {
    const data = await createProvisionedProject(provisioning);
    const homePageId = data.pages.homePageId;
    const oldBodyId = data.pages.pages.get(homePageId)!.rootInstanceId;
    data.pages.pages.get(homePageId)!.meta.language = JSON.stringify("en");
    // copies, so the rows after applying are compared with the rows before
    const notFound = structuredClone(findPage(data, "/*")!);
    const newsletter = structuredClone(findPage(data, SIGNUP_PAGE_PATH)!);
    const pages = renderPages();

    const result = applySiteTemplateMutable(data, pages, context);

    expect(result).toEqual({ status: "applied", unboundBlocks: [] });

    // Home keeps its page id and row; its body is the template's
    expect(data.pages.homePageId).toBe(homePageId);
    const home = data.pages.pages.get(homePageId)!;
    // with the template's title and description, its other meta kept
    expect(home).toEqual({
      id: homePageId,
      name: "Home",
      path: "",
      title: JSON.stringify("Welcome"),
      rootInstanceId: expect.any(String),
      meta: {
        language: JSON.stringify("en"),
        description: JSON.stringify(
          "Say in one sentence what your organization is working toward."
        ),
      },
    });
    expect(home.rootInstanceId).not.toBe(oldBodyId);
    expect(data.instances.has(oldBodyId)).toBe(false);
    expect(
      childrenOf(data, home.rootInstanceId).map(
        (instance) => instance.tag ?? instance.label ?? instance.component
      )
    ).toEqual(["h1", "Image", "Link", "Event List"]);

    // About is added at the root of the Pages tree
    const aboutId = pages[1].pageId;
    const about = data.pages.pages.get(aboutId);
    expect(about).toEqual({
      id: aboutId,
      name: "About",
      path: "/about",
      title: JSON.stringify("About us"),
      rootInstanceId: expect.any(String),
      meta: {
        description: JSON.stringify("Say who you are and who you work with."),
      },
    });
    expect(data.pages.folders.get(ROOT_FOLDER_ID)?.children).toEqual([
      homePageId,
      notFound.id,
      newsletter.id,
      aboutId,
    ]);
    expect(childrenOf(data, about!.rootInstanceId).length).toBe(3);

    // the 404 and sign-up pages are kept as they were
    expect(data.pages.pages.get(notFound.id)).toEqual(notFound);
    expect(data.pages.pages.get(newsletter.id)).toEqual(newsletter);
    expect(childrenOf(data, newsletter.rootInstanceId).length).toBe(1);

    // the template's variables on Global Root
    expect(
      rootStyles(data).find((decl) => decl.property === "--base")?.value
    ).toEqual(parseCssValue("--base", variables.base));

    // design mode: the body's local styles and the block's token
    expect(stylesOf(data, home.rootInstanceId)).toEqual([
      expect.objectContaining({
        breakpointId: findBaseBreakpoint(data).id,
        property: "color",
        value: { type: "var", value: "text" },
      }),
    ]);
    const card = [...data.styleSources.values()].find(
      (styleSource) =>
        styleSource.type === "token" && styleSource.name === "OS Card"
    );
    expect(card).toBeDefined();
    expect(
      [...data.styles.values()].some((decl) => decl.styleSourceId === card?.id)
    ).toBe(true);

    // the Event List is bound by a resource binding scoped to its new root
    const eventList = childrenOf(data, home.rootInstanceId).find(
      (instance) => instance.label === "Event List"
    )!;
    const bindings = [...data.dataSources.values()].filter(
      (dataSource) => dataSource.type === "resource"
    );
    expect(bindings).toEqual([
      {
        type: "resource",
        id: expect.any(String),
        scopeInstanceId: eventList.id,
        name: UPCOMING_EVENTS_BINDING_NAME,
        resourceId: presetIds.upcomingEvents.resourceId,
      },
    ]);
    expect(data.resources.get(presetIds.upcomingEvents.resourceId)).toEqual(
      expect.objectContaining({
        name: "Upcoming Events",
        url: JSON.stringify(`${apiBaseUrl}/events?upcoming=true`),
      })
    );
    const collection = childrenOf(data, eventList.id).find(
      (instance) => instance.label === "Events"
    )!;
    const dataProp = [...data.props.values()].find(
      (prop) => prop.instanceId === collection.id && prop.name === "data"
    );
    expect(dataProp?.type === "expression" && dataProp.value).toContain(
      encodeDataSourceVariable(bindings[0].id)
    );
  });

  test("links to Home point at the project's Home page", async () => {
    const data = await createProvisionedProject(provisioning);
    const pages = renderPages();

    applySiteTemplateMutable(data, pages, context);

    const pageLinks = [...data.props.values()].flatMap((prop) =>
      prop.type === "page" ? [prop.value] : []
    );
    expect(pageLinks.sort()).toEqual(
      [pages[1].pageId, data.pages.homePageId].sort()
    );
  });

  test("the old Home body goes with its local styles", async () => {
    const data = await createProvisionedProject(provisioning);
    const oldBodyId = data.pages.pages.get(
      data.pages.homePageId
    )!.rootInstanceId;
    data.styleSources.set("old-body-local", {
      type: "local",
      id: "old-body-local",
    });
    data.styleSourceSelections.set(oldBodyId, {
      instanceId: oldBodyId,
      values: ["old-body-local"],
    });
    const decl: StyleDecl = {
      styleSourceId: "old-body-local",
      breakpointId: findBaseBreakpoint(data).id,
      property: "backgroundColor",
      value: parseCssValue("background-color", "#000000"),
    };
    data.styles.set(getStyleDeclKey(decl), decl);

    applySiteTemplateMutable(data, renderPages(), context);

    expect(data.instances.has(oldBodyId)).toBe(false);
    expect(data.styleSourceSelections.has(oldBodyId)).toBe(false);
    expect(data.styleSources.has("old-body-local")).toBe(false);
    expect(data.styles.has(getStyleDeclKey(decl))).toBe(false);
  });

  test("an asset of the template's own images does not refuse it", async () => {
    const data = await createProvisionedProject(provisioning);
    data.assets.set("asset-hero", imageAsset("asset-hero"));

    const result = applySiteTemplateMutable(data, renderPages(), {
      ...context,
      ignoreAssetIds: new Set(["asset-hero", "asset-team"]),
    });

    expect(result).toEqual({ status: "applied", unboundBlocks: [] });
  });

  test("applying twice refuses the second", async () => {
    const data = await createProvisionedProject(provisioning);
    applySiteTemplateMutable(data, renderPages(), context);
    const pagesBefore = data.pages.pages.size;

    const result = applySiteTemplateMutable(data, renderPages(), context);

    expect(result).toEqual({ status: "refused", reason: "touched" });
    expect(data.pages.pages.size).toBe(pagesBefore);
  });

  test("a broken data link leaves blocks unbound", async () => {
    const data = await createProvisionedProject(provisioning);
    data.resources.delete(presetIds.events.resourceId);
    const resources = new Map(data.resources);

    const result = applySiteTemplateMutable(data, renderPages(), context);

    expect(result).toEqual({
      status: "applied",
      unboundBlocks: ["Event List"],
    });
    expect(
      [...data.dataSources.values()].filter(
        (dataSource) => dataSource.type === "resource"
      )
    ).toEqual([]);
    expect(data.resources).toEqual(resources);
    // left in place, shown empty
    const home = data.pages.pages.get(data.pages.homePageId)!;
    expect(
      childrenOf(data, home.rootInstanceId).some(
        (instance) => instance.label === "Event List"
      )
    ).toBe(true);
  });

  describe("template block tokens", () => {
    const datedContext = {
      ...context,
      blockTokens: datedTemplate.blockTokens,
    };

    test("the applied tokens wear the template's look, on the project's breakpoints", async () => {
      const data = await createProvisionedProject(provisioning);
      const breakpointsBefore = new Map(data.breakpoints);

      const result = applySiteTemplateMutable(
        data,
        renderDatedPages(),
        datedContext
      );

      expect(result).toEqual({ status: "applied", unboundBlocks: [] });
      const [card] = tokensNamed(data, "OS Card");
      expect(tokensNamed(data, "OS Card")).toHaveLength(1);
      const cardDecls = tokenDecls(data, card.id);
      expect(
        cardDecls.filter((decl) => decl.property === "borderTopColor")
      ).toEqual([
        expect.objectContaining({
          maxWidth: undefined,
          value: { type: "var", value: "accent-1" },
        }),
      ]);
      const [date] = tokensNamed(data, "OS Event Date");
      const widths = tokenDecls(data, date.id).filter(
        (decl) => decl.property === "width"
      );
      expect(widths.map(({ maxWidth, value }) => [maxWidth, value])).toEqual(
        expect.arrayContaining([[479, { type: "unit", unit: "px", value: 56 }]])
      );
      // the provisioned 479 breakpoint, not one of the template's own
      const phone = widths.find((decl) => decl.maxWidth === 479);
      expect(breakpointsBefore.has(phone!.breakpointId)).toBe(true);
      expect(data.breakpoints).toEqual(breakpointsBefore);
    });

    test("a token the project already holds takes the template's declarations, by key", async () => {
      const data = await withOldCardToken();

      applySiteTemplateMutable(data, renderDatedPages(), datedContext);

      // reused, as an insert reuses a token by name ("ours")
      expect(tokensNamed(data, "OS Card").map(({ id }) => id)).toEqual([
        "old-card",
      ]);
      const byProperty = new Map(
        tokenDecls(data, "old-card").map((decl) => [decl.property, decl])
      );
      expect(byProperty.get("borderTopColor")?.value).toEqual({
        type: "var",
        value: "accent-1",
      });
      expect(byProperty.get("paddingTop")?.value).toEqual({
        type: "unit",
        unit: "px",
        value: 24,
      });
      expect(byProperty.get("paddingLeft")?.value).toEqual({
        type: "unit",
        unit: "px",
        value: 24,
      });
      // what the template does not name is the project's
      expect(byProperty.get("cursor")?.value).toEqual({
        type: "keyword",
        value: "pointer",
      });
      // and the dated card wears it
      const home = data.pages.pages.get(data.pages.homePageId)!;
      const article = [
        ...findTreeInstanceIds(data.instances, home.rootInstanceId),
      ]
        .map((id) => data.instances.get(id)!)
        .find((instance) => instance.tag === "article")!;
      expect(data.styleSourceSelections.get(article.id)?.values).toEqual([
        "old-card",
      ]);
    });

    test("without block tokens a token the project already holds is kept as it is", async () => {
      const data = await withOldCardToken();
      const before = tokenDecls(data, "old-card");

      applySiteTemplateMutable(data, renderDatedPages(), context);

      expect(tokenDecls(data, "old-card")).toEqual(before);
    });
  });

  describe("several blocks on one page", () => {
    // the spike: an Event Card, an Event List and a Signup Form on Home
    const renderSpike = () =>
      renderSiteTemplate(spike, {
        assetIds: new Map(
          Object.keys(spike.images).map((file) => [file, `asset:${file}`])
        ),
        generatePageId: () => `page-${++pageCount}`,
      });

    const homeInstances = (data: WebstudioData) => {
      const home = data.pages.pages.get(data.pages.homePageId)!;
      return [...findTreeInstanceIds(data.instances, home.rootInstanceId)].map(
        (id) => data.instances.get(id)!
      );
    };

    /** Each placed block's root on Home. */
    const findBlockRoots = (data: WebstudioData) => {
      const find = (match: (instance: Instance) => boolean) => {
        const found = homeInstances(data).filter(match);
        expect(found).toHaveLength(1);
        return found[0];
      };
      const carrier = "@organizeos/site-components:ShareCodeCarrier";
      return {
        card: find(
          (instance) =>
            instance.component === carrier && instance.label === "Event Card"
        ),
        list: find(
          (instance) =>
            instance.component === carrier && instance.label === "Event List"
        ),
        form: find(
          (instance) =>
            instance.component === "@organizeos/site-components:SignupForm"
        ),
      };
    };

    const resourceBindings = (data: WebstudioData) =>
      [...data.dataSources.values()].flatMap((dataSource) =>
        dataSource.type === "resource" ? [dataSource] : []
      );

    const propValue = (
      data: WebstudioData,
      instanceId: Instance["id"],
      name: string
    ) =>
      [...data.props.values()].find(
        (prop) => prop.instanceId === instanceId && prop.name === name
      )?.value;

    test("binds each block to a binding of its own", async () => {
      const data = await createProvisionedProject(provisioning);
      const resourceIdsBefore = new Set(data.resources.keys());

      const result = applySiteTemplateMutable(data, renderSpike(), context);

      expect(result).toEqual({ status: "applied", unboundBlocks: [] });
      const { card, list, form } = findBlockRoots(data);
      const bindings = resourceBindings(data);
      expect(bindings.map((binding) => binding.scopeInstanceId).sort()).toEqual(
        [card.id, list.id, form.id].sort()
      );
      const bindingOf = (rootId: Instance["id"]) =>
        bindings.find((binding) => binding.scopeInstanceId === rootId)!;
      expect(bindingOf(form.id).resourceId).toBe(presetIds.forms.resourceId);
      expect(propValue(data, form.id, "data")).toContain(
        encodeDataSourceVariable(bindingOf(form.id).id)
      );

      // each Events block reads its own binding, never the other's
      for (const [block, other] of [
        [card, list],
        [list, card],
      ]) {
        expect(bindingOf(block.id)).toEqual(
          expect.objectContaining({
            name: UPCOMING_EVENTS_BINDING_NAME,
            resourceId: presetIds.upcomingEvents.resourceId,
          })
        );
        const own = encodeDataSourceVariable(bindingOf(block.id).id);
        const others = encodeDataSourceVariable(bindingOf(other.id).id);
        const bound = [
          ["Events", "data"],
          ["No upcoming events", showAttribute],
          ["Events unavailable", showAttribute],
        ] as const;
        for (const [label, name] of bound) {
          const instance = childrenOf(data, block.id).find(
            (child) => child.label === label
          )!;
          const value = propValue(data, instance.id, name);
          expect(value, `${block.label}: ${label}`).toContain(own);
          expect(value, `${block.label}: ${label}`).not.toContain(others);
        }
      }

      // Forms and Upcoming Events are created, once each
      expect(
        [...data.resources.keys()]
          .filter((id) => resourceIdsBefore.has(id) === false)
          .sort()
      ).toEqual(
        [presetIds.forms.resourceId, presetIds.upcomingEvents.resourceId].sort()
      );
    });

    test("a block whose ids its placement prefix does not match is left unbound", async () => {
      const data = await createProvisionedProject(provisioning);
      const [home] = renderSpike();
      const root = home.fragment.children[0];
      expect(root?.type).toBe("id");
      // the Event List placed at the body: no "<body id>:events" to bind
      const pages: RenderedPage[] = [
        {
          ...home,
          placements: home.placements.map((placement) =>
            placement.key === EventList
              ? { ...placement, rootId: root.value }
              : placement
          ),
        },
      ];

      const result = applySiteTemplateMutable(data, pages, context);

      expect(result).toEqual({
        status: "applied",
        unboundBlocks: ["Event List"],
      });
      const { card, list, form } = findBlockRoots(data);
      expect(
        resourceBindings(data)
          .map((binding) => binding.scopeInstanceId)
          .sort()
      ).toEqual([card.id, form.id].sort());
      const collection = childrenOf(data, list.id).find(
        (child) => child.label === "Events"
      )!;
      expect(String(propValue(data, collection.id, "data"))).not.toContain(
        "$ws$dataSource$"
      );
    });
  });

  test("refuses a site with colours of its own, as the offer does", async () => {
    const data = await withBlackBase();
    const before = structuredClone(data);

    const result = applySiteTemplateMutable(data, renderPages(), context);

    expect(result).toEqual({ status: "refused", reason: "touched" });
    expect(data).toEqual(before);
  });

  test("refuses a fragment with resources", async () => {
    const data = await createProvisionedProject(provisioning);
    const before = structuredClone(data);
    const pages = renderPages();
    pages[1] = {
      ...pages[1],
      fragment: {
        ...pages[1].fragment,
        resources: [
          {
            id: "sample",
            name: "Sample",
            method: "get",
            url: `"https://example.org/sample"`,
            headers: [],
          },
        ],
      },
    };

    const result = applySiteTemplateMutable(data, pages, context);

    expect(result).toEqual({ status: "refused", reason: "resources" });
    expect(data).toEqual(before);
  });

  test("refuses a taken path", async () => {
    const data = await createProvisionedProject(provisioning);
    const before = structuredClone(data);
    const pages = renderPages();
    pages[1] = { ...pages[1], path: SIGNUP_PAGE_PATH };

    const result = applySiteTemplateMutable(data, pages, context);

    expect(result).toEqual({ status: "refused", reason: "path-taken" });
    expect(data).toEqual(before);
  });
});

describe("applySiteTemplate", () => {
  const setStores = (data: WebstudioData) => {
    $pages.set(data.pages);
    $instances.set(data.instances);
    $props.set(data.props);
    $dataSources.set(data.dataSources);
    $resources.set(data.resources);
    $breakpoints.set(data.breakpoints);
    $styleSourceSelections.set(data.styleSourceSelections);
    $styleSources.set(data.styleSources);
    $styles.set(data.styles);
    $assets.set(data.assets);
    $selectedPageId.set(data.pages.homePageId);
    $project.set({ id: projectId } as Project);
  };

  const urlOf = (path: string) => new URL(path, location.origin).href;

  // As the builder's: ids keyed by the URLs or files passed, by its own rule,
  // returned before the uploads finish. Here the uploads never land.
  const uploadedIds = async (_type: string, filesOrUrls: (File | URL)[]) =>
    new Map(
      await Promise.all(
        filesOrUrls.map(
          async (fileOrUrl) =>
            [
              fileOrUrl,
              fileOrUrl instanceof File
                ? await getSha256HashOfFile(fileOrUrl)
                : await getSha256Hash(fileOrUrl.href),
            ] as const
        )
      )
    );

  // Two font files, served by the builder at their URLs.
  const sourceSans: FontEntry = {
    url: "/site-templates/fixture/source-sans-3-latin-wght-normal.woff2",
    family: "Source Sans 3",
    licence: "OFL-1.1",
    source: "@fontsource-variable/source-sans-3",
  };
  const sourceSansItalic: FontEntry = {
    ...sourceSans,
    url: "/site-templates/fixture/source-sans-3-latin-wght-italic.woff2",
  };
  const fontBytes = new Map([
    [urlOf(sourceSans.url), new Uint8Array([119, 79, 70, 50, 1])],
    [urlOf(sourceSansItalic.url), new Uint8Array([119, 79, 70, 50, 2])],
  ]);
  const sha256 = (bytes: Uint8Array) =>
    createHash("sha256").update(bytes).digest("hex");
  const fetchFont = vi.fn(async (input: string | URL) => {
    const bytes = fontBytes.get(String(input));
    return bytes === undefined
      ? new Response("Not found", { status: 404 })
      : new Response(bytes);
  });
  const withFonts: SiteTemplate = {
    ...template,
    variables: {
      ...variables,
      "font-body": '"Source Sans 3", system-ui, sans-serif',
    },
    fonts: {
      "source-sans-3-latin-wght-normal.woff2": sourceSans,
      "source-sans-3-latin-wght-italic.woff2": sourceSansItalic,
    },
  };

  beforeEach(() => {
    uploadAssets.mockReset();
    uploadAssets.mockImplementation(uploadedIds);
    fetchFont.mockClear();
    vi.stubGlobal("fetch", fetchFont);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders each image with the asset id its URL uploads as, and uploads once applied", async () => {
    setStores(await createProvisionedProject(provisioning));
    let aboutAtUpload: undefined | Page;
    uploadAssets.mockImplementationOnce(async (type: string, urls: URL[]) => {
      aboutAtUpload = findPage(getWebstudioData(), "/about");
      return uploadedIds(type, urls);
    });

    const result = await applySiteTemplate(template);

    expect(result).toEqual({ status: "applied", unboundBlocks: [] });
    expect(uploadAssets).toHaveBeenCalledTimes(1);
    const [type, urls] = uploadAssets.mock.calls[0] as [string, URL[]];
    expect(type).toBe("image");
    expect(urls.map((url) => url.href)).toEqual([
      urlOf("/site-templates/fixture/hero.jpg"),
      urlOf("/site-templates/fixture/team.jpg"),
    ]);
    expect(aboutAtUpload).toBeDefined();

    const heroId = await getSha256Hash(
      urlOf("/site-templates/fixture/hero.jpg")
    );
    const teamId = await getSha256Hash(
      urlOf("/site-templates/fixture/team.jpg")
    );
    const data = getWebstudioData();
    const imageSrc = (page: undefined | Page) => {
      const image = childrenOf(data, page?.rootInstanceId ?? "").find(
        (instance) => instance.component === "Image"
      );
      return [...data.props.values()].find(
        (prop) => prop.instanceId === image?.id && prop.name === "src"
      )?.value;
    };
    expect(imageSrc(findPage(data, ""))).toBe(heroId);
    expect(imageSrc(findPage(data, "/about"))).toBe(teamId);
    expect(stylesOf(data, findPage(data, "/about")!.rootInstanceId)).toEqual([
      expect.objectContaining({
        property: "backgroundImage",
        value: {
          type: "layers",
          value: [{ type: "image", value: { type: "asset", value: heroId } }],
        },
      }),
    ]);
  });

  test("uploads each font as a file named by its key, once applied, after the images", async () => {
    setStores(await createProvisionedProject(provisioning));
    let aboutAtUpload: undefined | Page;
    uploadAssets.mockImplementation(
      async (type: string, filesOrUrls: (File | URL)[]) => {
        if (type === "font") {
          aboutAtUpload = findPage(getWebstudioData(), "/about");
        }
        return uploadedIds(type, filesOrUrls);
      }
    );

    const result = await applySiteTemplate(withFonts);

    expect(result).toEqual({ status: "applied", unboundBlocks: [] });
    expect(fetchFont.mock.calls.map(([input]) => String(input))).toEqual([
      urlOf(sourceSans.url),
      urlOf(sourceSansItalic.url),
    ]);
    expect(uploadAssets.mock.calls.map(([type]) => type)).toEqual([
      "image",
      "font",
    ]);
    const [, files] = uploadAssets.mock.calls[1] as [string, File[]];
    expect(files.every((file) => file instanceof File)).toBe(true);
    expect(files.map((file) => [file.name, file.type])).toEqual([
      ["source-sans-3-latin-wght-normal.woff2", "font/woff2"],
      ["source-sans-3-latin-wght-italic.woff2", "font/woff2"],
    ]);
    // each file holds the bytes its URL served
    expect(await Promise.all(files.map(getSha256HashOfFile))).toEqual([
      sha256(fontBytes.get(urlOf(sourceSans.url))!),
      sha256(fontBytes.get(urlOf(sourceSansItalic.url))!),
    ]);
    expect(aboutAtUpload).toBeDefined();
  });

  test("a font upload whose id is not the file's hash is logged", async () => {
    setStores(await createProvisionedProject(provisioning));
    uploadAssets.mockImplementation(
      async (type: string, filesOrUrls: (File | URL)[]) =>
        type === "font"
          ? new Map(filesOrUrls.map((file) => [file, "other"]))
          : uploadedIds(type, filesOrUrls)
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(await applySiteTemplate(withFonts)).toEqual({
      status: "applied",
      unboundBlocks: [],
    });

    expect(consoleError.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining('"source-sans-3-latin-wght-normal.woff2"'),
      expect.stringContaining('"source-sans-3-latin-wght-italic.woff2"'),
    ]);
    consoleError.mockRestore();
  });

  // As an image's: an upload of the same font, landing while this apply
  // awaits (another admin's apply of the template), does not refuse it.
  test("an asset of the template's own fonts does not refuse it", async () => {
    setStores(await createProvisionedProject(provisioning));
    const fontId = sha256(fontBytes.get(urlOf(sourceSans.url))!);
    fetchFont.mockImplementationOnce(async (input: string | URL) => {
      $assets.set(
        new Map([
          [
            fontId,
            {
              id: fontId,
              projectId,
              type: "font",
              name: "source-sans-3-latin-wght-normal_abc.woff2",
              format: "woff2",
              size: 5,
              createdAt: "2026-10-31T00:00:00.000Z",
              meta: { family: "Source Sans 3", style: "normal", weight: 400 },
            },
          ],
        ])
      );
      return new Response(fontBytes.get(String(input)));
    });

    expect(await applySiteTemplate(withFonts)).toEqual({
      status: "applied",
      unboundBlocks: [],
    });
  });

  test("a font that cannot be fetched rejects, writing and uploading nothing", async () => {
    setStores(await createProvisionedProject(provisioning));
    const assets = $assets.get();

    await expect(
      applySiteTemplate({
        ...withFonts,
        fonts: {
          ...withFonts.fonts,
          "missing.woff2": { ...sourceSans, url: "/missing.woff2" },
        },
      })
    ).rejects.toThrow('"missing.woff2"');

    expect(uploadAssets).not.toHaveBeenCalled();
    expect($assets.get()).toBe(assets);
    expect(getWebstudioData().pages.pages.size).toBe(3);
    expect(hasCanonicalVariables(getWebstudioData())).toBe(false);
  });

  test("a page that cannot render rejects and uploads nothing", async () => {
    setStores(await createProvisionedProject(provisioning));
    const assets = $assets.get();
    const broken: SiteTemplate = {
      ...template,
      pages: [
        template.pages[0],
        {
          ...template.pages[1],
          body: () => {
            throw new Error("broken body");
          },
        },
      ],
    };

    await expect(applySiteTemplate(broken)).rejects.toThrow(
      'Page "about": broken body'
    );

    expect(uploadAssets).not.toHaveBeenCalled();
    expect($assets.get()).toBe(assets);
    expect(getWebstudioData().pages.pages.size).toBe(3);
  });

  test.each([
    {
      reason: "path-taken",
      about: { path: SIGNUP_PAGE_PATH },
    },
    {
      reason: "resources",
      about: {
        body: () => (
          <ws.element ws:tag="body">
            <ws.element
              ws:tag="div"
              data={
                new ResourceValue("Sample", {
                  url: expression`"https://example.org/sample"`,
                  method: "get",
                  searchParams: [],
                  headers: [],
                })
              }
            />
          </ws.element>
        ),
      },
    },
  ])(
    "a refusal in the transaction ($reason) uploads nothing",
    async ({ reason, about }) => {
      setStores(await createProvisionedProject(provisioning));
      const assets = $assets.get();

      const result = await applySiteTemplate({
        ...withFonts,
        pages: [template.pages[0], { ...template.pages[1], ...about }],
      });

      expect(result).toEqual({ status: "refused", reason });
      expect(uploadAssets).not.toHaveBeenCalled();
      expect($assets.get()).toBe(assets);
      expect(getWebstudioData().pages.pages.size).toBe(3);
    }
  );

  test("an upload whose id is not the rendered one is logged", async () => {
    setStores(await createProvisionedProject(provisioning));
    uploadAssets.mockImplementationOnce(
      async (_type: string, urls: URL[]) =>
        new Map(urls.map((url) => [url, `other${url.pathname}`]))
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(await applySiteTemplate(template)).toEqual({
      status: "applied",
      unboundBlocks: [],
    });

    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError.mock.calls.map(([message]) => message)).toEqual([
      expect.stringContaining('"hero.jpg"'),
      expect.stringContaining('"team.jpg"'),
    ]);
    consoleError.mockRestore();
  });

  test("writes the template's block tokens over a token the project holds", async () => {
    setStores(await withOldCardToken());

    expect(await applySiteTemplate(datedTemplate)).toEqual({
      status: "applied",
      unboundBlocks: [],
    });

    const data = getWebstudioData();
    expect(
      tokenDecls(data, "old-card").find(
        (decl) => decl.property === "borderTopColor"
      )?.value
    ).toEqual({ type: "var", value: "accent-1" });
  });

  test("clears the selection, as Create item page does", async () => {
    const provisioned = await createProvisionedProject(provisioning);
    setStores(provisioned);
    selectInstance([findPage(provisioned, SIGNUP_PAGE_PATH)!.rootInstanceId]);

    await applySiteTemplate(template);

    expect($selectedInstanceSelector.get()).toBeUndefined();
  });

  test("refuses when no project is open", async () => {
    setStores(await createProvisionedProject(provisioning));
    $project.set(undefined);

    expect(await applySiteTemplate(withFonts)).toEqual({
      status: "refused",
      reason: "no-project",
    });
    expect(fetchFont).not.toHaveBeenCalled();
    expect(uploadAssets).not.toHaveBeenCalled();
    expect(getWebstudioData().pages.pages.size).toBe(3);
  });

  test("refuses a touched project before uploading anything", async () => {
    const data = await createProvisionedProject(provisioning);
    data.assets.set("asset-1", imageAsset("asset-1"));
    setStores(data);

    expect(await applySiteTemplate(withFonts)).toEqual({
      status: "refused",
      reason: "touched",
    });
    expect(fetchFont).not.toHaveBeenCalled();
    expect(uploadAssets).not.toHaveBeenCalled();
    expect(getWebstudioData().pages.pages.size).toBe(3);
  });
});
