import { beforeEach, describe, expect, test, vi } from "vitest";
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
  getAllPages,
  getStyleDeclKey,
} from "@webstudio-is/sdk";
import { $, PageValue, css, ws } from "@webstudio-is/template";
import {
  type BlockKey,
  type CanonicalValues,
  type RenderedPage,
  type SiteTemplate,
  BLANK_CANONICAL_VALUES,
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import { createPages } from "../../../../../../../packages/project-build/src/template";
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
  SIGNUP_PAGE_PATH,
  UPCOMING_EVENTS_BINDING_NAME,
} from "~/shared/organizeos-preset-ids";
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import { mergeSignupFormIntoBuild } from "~/shared/db/signup-form-preset.server";
import { getOrganizeosPresetIds } from "../insert-organizeos-block";
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
const { resources: catalog } = await buildOrgResourcePresets({
  projectId,
  apiBaseUrl,
  readToken: "osk_token",
});

/**
 * A project as provisioning leaves it: `createPages()` (Home and the 404
 * page), the catalog Resources seeded on every provision (the first block that
 * reads Forms or Upcoming Events creates it) and the seeded sign-up page.
 */
const createProvisionedProject = async (): Promise<WebstudioData> => {
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
    { projectId, apiBaseUrl, readToken: "osk_token" }
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
  pages: [
    {
      key: "home",
      name: "Home",
      path: "",
      title: "Home",
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
      body: ({ pageIds, image, imageAlt }) => (
        <ws.element ws:tag="body">
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
  const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();

    expect(getAllPages(data.pages).map((page) => page.path)).toEqual([
      "",
      "/*",
      SIGNUP_PAGE_PATH,
    ]);
    expect(isProjectUntouched(data)).toBe(true);
  });

  test("a Home child makes it touched", async () => {
    const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();
    const homePageId = data.pages.homePageId;
    const oldBodyId = data.pages.pages.get(homePageId)!.rootInstanceId;
    const notFound = findPage(data, "/*")!;
    const newsletter = findPage(data, SIGNUP_PAGE_PATH)!;
    const pages = renderPages();

    const result = applySiteTemplateMutable(data, pages, context);

    expect(result).toEqual({ status: "applied", unboundBlocks: [] });

    // Home keeps its page id and row; its body is the template's
    expect(data.pages.homePageId).toBe(homePageId);
    const home = data.pages.pages.get(homePageId)!;
    expect(home).toMatchObject({ id: homePageId, name: "Home", path: "" });
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
    const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();
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

  test("an upload that landed before the transaction does not refuse it", async () => {
    const data = await createProvisionedProject();
    data.assets.set("asset-hero", imageAsset("asset-hero"));

    const result = applySiteTemplateMutable(data, renderPages(), {
      ...context,
      ignoreAssetIds: new Set(["asset-hero", "asset-team"]),
    });

    expect(result).toEqual({ status: "applied", unboundBlocks: [] });
  });

  test("applying twice refuses the second", async () => {
    const data = await createProvisionedProject();
    applySiteTemplateMutable(data, renderPages(), context);
    const pagesBefore = data.pages.pages.size;

    const result = applySiteTemplateMutable(data, renderPages(), context);

    expect(result).toEqual({ status: "refused", reason: "touched" });
    expect(data.pages.pages.size).toBe(pagesBefore);
  });

  test("a broken data link leaves blocks unbound", async () => {
    const data = await createProvisionedProject();
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

  test("refuses a fragment with resources", async () => {
    const data = await createProvisionedProject();
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
    const data = await createProvisionedProject();
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

  beforeEach(() => {
    uploadAssets.mockReset();
    // as the builder's: ids keyed by the URLs passed, known before the
    // uploads finish; here the uploads also land before the transaction
    uploadAssets.mockImplementation(async (_type: string, urls: URL[]) => {
      const ids = new Map(
        urls.toReversed().map((url) => [url, `uploaded${url.pathname}`])
      );
      const assets = new Map($assets.get());
      for (const id of ids.values()) {
        assets.set(id, imageAsset(id));
      }
      $assets.set(assets);
      return ids;
    });
  });

  test("renders each image with the asset id its file's upload got", async () => {
    setStores(await createProvisionedProject());

    const result = await applySiteTemplate(template);

    expect(result).toEqual({ status: "applied", unboundBlocks: [] });
    expect(uploadAssets).toHaveBeenCalledTimes(1);
    const [type, urls] = uploadAssets.mock.calls[0] as [string, URL[]];
    expect(type).toBe("image");
    expect(urls.map((url) => url.href)).toEqual([
      urlOf("/site-templates/fixture/hero.jpg"),
      urlOf("/site-templates/fixture/team.jpg"),
    ]);

    const data = getWebstudioData();
    const imageSrc = (page: undefined | Page) => {
      const image = childrenOf(data, page?.rootInstanceId ?? "").find(
        (instance) => instance.component === "Image"
      );
      return [...data.props.values()].find(
        (prop) => prop.instanceId === image?.id && prop.name === "src"
      )?.value;
    };
    expect(imageSrc(findPage(data, ""))).toBe(
      "uploaded/site-templates/fixture/hero.jpg"
    );
    expect(imageSrc(findPage(data, "/about"))).toBe(
      "uploaded/site-templates/fixture/team.jpg"
    );
  });

  test("clears the selection, as Create item page does", async () => {
    const provisioned = await createProvisionedProject();
    setStores(provisioned);
    selectInstance([findPage(provisioned, SIGNUP_PAGE_PATH)!.rootInstanceId]);

    await applySiteTemplate(template);

    expect($selectedInstanceSelector.get()).toBeUndefined();
  });

  test("refuses a touched project before uploading anything", async () => {
    const data = await createProvisionedProject();
    data.assets.set("asset-1", imageAsset("asset-1"));
    setStores(data);

    expect(await applySiteTemplate(template)).toEqual({
      status: "refused",
      reason: "touched",
    });
    expect(uploadAssets).not.toHaveBeenCalled();
    expect(getWebstudioData().pages.pages.size).toBe(3);
  });
});
