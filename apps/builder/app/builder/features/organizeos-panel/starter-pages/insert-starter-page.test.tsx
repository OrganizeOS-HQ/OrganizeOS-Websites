import { beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import type { ProjectSettings } from "@webstudio-is/project-build";
import { camelCaseProperty } from "@webstudio-is/css-data";
import {
  type Instance,
  type WebstudioData,
  ROOT_FOLDER_ID,
  ROOT_INSTANCE_ID,
  encodeDataSourceVariable,
  findTreeInstanceIds,
} from "@webstudio-is/sdk";
import { PageValue, css, ws } from "@webstudio-is/template";
import {
  $,
  type BlockKey,
  type SiteTemplate,
  type SiteTemplatePage,
  BLANK_CANONICAL_VALUES,
  SITE_TEMPLATES,
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import {
  NEUTRAL_LOOK,
  neutralBodyStyles,
  renderStarterPage,
} from "@organizeos/site-components/starter-pages";
import { sampleStarterPage } from "../../../../../../../packages/sdk-components-organizeos/src/starter-pages/__fixtures__/sample";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $project,
  $projectSettings,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $authPermit, $builderMode } from "~/shared/nano-states/misc";
import { getWebstudioData } from "~/shared/instance-utils/data";
import { getOrganizeosPresetIds } from "../insert-organizeos-block";
import { createProvisionedProject } from "../site-templates/provisioned-project";
import {
  applySiteTemplateMutable,
  startBlankMutable,
} from "../site-templates/apply-site-template";
import { unboundBlocksMessage } from "../unbound-blocks";
import {
  findStarterInsertRefusal,
  insertStarterPage,
  insertStarterPageMutable,
  starterLook,
} from "./insert-starter-page";

// The db half of project-build builds a tRPC router as it loads, which a
// browser refuses; provisioning's signup page imports only its page helpers
// (as apply-site-template.test.tsx does).
vi.mock(
  "@webstudio-is/project-build/server",
  () => import("../../../../../../../packages/project-build/src/db/pages")
);

enableMapSet();
registerContainers();

const projectId = "project-1";
const presetIds = await getOrganizeosPresetIds(projectId);
const provisioning = {
  projectId,
  apiBaseUrl: "https://app.example.org/api/public/v1",
  readToken: "osk_token",
};

const SignupForm: BlockKey = "@organizeos/site-components:SignupForm";
const EventList: BlockKey = "@organizeos/site-components:EventList";

// A site whose Home has a labelled nav (an in-page link, a page link and the
// site name), a hero, and a footer holding a Signup Form and an Event List.
const home: SiteTemplatePage = {
  key: "home",
  name: "Home",
  path: "",
  title: "Home",
  description: "Say what your organization is working toward.",
  body: ({ pageIds, placeBlock }) => (
    <ws.element
      ws:tag="body"
      ws:style={css`
        color: var(--text);
        font-size: 17px;
      `}
    >
      <ws.element ws:tag="header" ws:label="Nav">
        <$.Link ws:label="Why" href="#why">
          {"Why"}
        </$.Link>
        <$.Link ws:label="About" href={new PageValue(pageIds.about)}>
          {"About"}
        </$.Link>
        <ws.element ws:tag="p" ws:label="Site name">
          {"Your organization"}
        </ws.element>
      </ws.element>
      <ws.element ws:tag="section" ws:label="Hero">
        <ws.element ws:tag="h1">{"Say what you are working toward"}</ws.element>
      </ws.element>
      <ws.element ws:tag="footer" ws:label="Footer">
        {placeBlock(SignupForm, "footer-signup")}
        {placeBlock(EventList, "footer-events")}
      </ws.element>
    </ws.element>
  ),
};

const about: SiteTemplatePage = {
  key: "about",
  name: "About",
  path: "/about",
  title: "About",
  description: "Say who you are.",
  body: () => (
    <ws.element ws:tag="body">
      <ws.element ws:tag="section" ws:label="About">
        <ws.element ws:tag="h1">{"About us"}</ws.element>
      </ws.element>
    </ws.element>
  ),
};

const siteTemplate: SiteTemplate = {
  id: "site",
  category: "nonprofit",
  name: "Site",
  oneLine: "A site with a nav and a footer",
  styleTags: [],
  status: "draft",
  dependsOn: [],
  thumbnail: "thumb.jpg",
  variables: BLANK_CANONICAL_VALUES,
  images: {
    "thumb.jpg": { url: "/thumb.jpg", sourceUrl: "x", alt: "Thumbnail" },
  },
  pagePictures: {},
  fonts: {},
  pages: [home, about],
  look: NEUTRAL_LOOK,
};

let pageCount = 0;

/** A provisioned project with the site template applied. */
const appliedSite = async () => {
  const data = await createProvisionedProject(provisioning);
  const pages = renderSiteTemplate(siteTemplate, {
    assetIds: new Map(),
    generatePageId: () => `site-page-${++pageCount}`,
  });
  const result = applySiteTemplateMutable(data, pages, {
    projectId,
    presetIds,
    variables: BLANK_CANONICAL_VALUES,
    blockTokens: undefined,
  });
  expect(result.status).toBe("applied");
  return data;
};

/** A provisioned project left by Start blank: the variables, no content. */
const blankSite = async () => {
  const data = await createProvisionedProject(provisioning);
  startBlankMutable(data);
  return data;
};

const rendered = () =>
  renderStarterPage(sampleStarterPage, {
    look: NEUTRAL_LOOK,
    generatePageId: () => "new-page",
  });

const fields = { name: "Sample", path: "/sample" };

const insert = (data: WebstudioData, options = {}) =>
  insertStarterPageMutable(data, rendered(), {
    projectId,
    presetIds,
    ...fields,
    ...options,
  });

const homeBodyId = (data: WebstudioData) =>
  data.pages.pages.get(data.pages.homePageId)!.rootInstanceId;

const childrenOf = (data: WebstudioData, instanceId: Instance["id"]) =>
  (data.instances.get(instanceId)?.children ?? []).flatMap((child) => {
    const instance =
      child.type === "id" ? data.instances.get(child.value) : undefined;
    return instance === undefined ? [] : [instance];
  });

const newBodyId = (data: WebstudioData) =>
  data.pages.pages.get("new-page")!.rootInstanceId;

/** Home body's subtree: its instances, their props and their styles. */
const homeSubtree = (data: WebstudioData) => {
  const ids = findTreeInstanceIds(data.instances, homeBodyId(data));
  const sourceIds = new Set(
    [...ids].flatMap((id) => data.styleSourceSelections.get(id)?.values ?? [])
  );
  return structuredClone({
    instances: [...ids].map((id) => data.instances.get(id)),
    props: [...data.props.values()].filter((prop) => ids.has(prop.instanceId)),
    styles: [...data.styles.values()].filter((decl) =>
      sourceIds.has(decl.styleSourceId)
    ),
  });
};

const propOf = (data: WebstudioData, instanceId: string, name: string) =>
  [...data.props.values()].find(
    (prop) => prop.instanceId === instanceId && prop.name === name
  );

const findByLabel = (
  data: WebstudioData,
  rootId: Instance["id"],
  label: string
) =>
  [...findTreeInstanceIds(data.instances, rootId)]
    .map((id) => data.instances.get(id)!)
    .find((instance) => instance.label === label);

const localDecls = (data: WebstudioData, instanceId: Instance["id"]) => {
  const sourceIds = new Set(
    (data.styleSourceSelections.get(instanceId)?.values ?? []).filter(
      (id) => data.styleSources.get(id)?.type === "local"
    )
  );
  return [...data.styles.values()]
    .filter((decl) => sourceIds.has(decl.styleSourceId))
    .map(({ breakpointId, property, state, value }) => ({
      breakpointId,
      property,
      state,
      value,
    }))
    .sort((left, right) => left.property.localeCompare(right.property));
};

const resourceBindingsUnder = (data: WebstudioData, rootId: string) => {
  const ids = findTreeInstanceIds(data.instances, rootId);
  return [...data.dataSources.values()].flatMap((dataSource) =>
    dataSource.type === "resource" && ids.has(dataSource.scopeInstanceId ?? "")
      ? [dataSource.resourceId]
      : []
  );
};

/** An element added under Home's body, last unless `first`. */
const addHomeChild = (
  data: WebstudioData,
  instance: Omit<Instance, "type" | "children">,
  first = false
) => {
  data.instances.set(instance.id, {
    type: "instance",
    children: [],
    ...instance,
  });
  const body = data.instances.get(homeBodyId(data))!;
  body.children[first ? "unshift" : "push"]({ type: "id", value: instance.id });
};

describe("insertStarterPageMutable", () => {
  test("refuses a taken path, writing nothing", async () => {
    const data = await appliedSite();
    const before = structuredClone(data);
    expect(insert(data, { path: "/about" })).toEqual({
      status: "refused",
      reason: "path-taken",
    });
    expect(data).toEqual(before);
  });

  test("refuses a served path", async () => {
    const data = await appliedSite();
    const before = structuredClone(data);
    expect(insert(data, { path: "/join" })).toEqual({
      status: "refused",
      reason: "platform-path",
    });
    expect(data).toEqual(before);
  });

  test("refuses a page template holding a Resource", async () => {
    const data = await appliedSite();
    const before = structuredClone(data);
    const page = rendered();
    page.fragment.resources.push({
      id: "resource",
      name: "Resource",
      method: "get",
      url: `"https://example.org"`,
      headers: [],
    });
    expect(
      insertStarterPageMutable(data, page, { projectId, presetIds, ...fields })
    ).toEqual({ status: "refused", reason: "resources" });
    expect(data).toEqual(before);
  });

  test("refuses an invalid path or an empty name", async () => {
    const data = await appliedSite();
    const before = structuredClone(data);
    for (const options of [
      { path: "events" },
      { path: "/a//b" },
      { path: "" },
      { name: "  " },
    ]) {
      expect(insert(data, options), JSON.stringify(options)).toEqual({
        status: "refused",
        reason: "invalid",
      });
    }
    expect(data).toEqual(before);
  });

  test("findStarterInsertRefusal runs the checks alone", async () => {
    const data = await appliedSite();
    expect(findStarterInsertRefusal(data, rendered(), fields)).toBe(undefined);
    expect(
      findStarterInsertRefusal(data, rendered(), { ...fields, path: "/about" })
    ).toBe("path-taken");
  });

  test("writes the blank variables in fill mode only when there are none", async () => {
    const bare = await createProvisionedProject(provisioning);
    expect(insert(bare).status).toBe("added");
    const rootDecls = localDecls(bare, ROOT_INSTANCE_ID).map(
      (decl) => decl.property
    );
    for (const name of Object.keys(BLANK_CANONICAL_VALUES)) {
      expect(rootDecls).toContain(`--${name}`);
    }

    const applied = await appliedSite();
    const before = localDecls(applied, ROOT_INSTANCE_ID);
    expect(insert(applied).status).toBe("added");
    expect(localDecls(applied, ROOT_INSTANCE_ID)).toEqual(before);
  });

  test("keeps the site's tokens and writes no block token", async () => {
    const data = await appliedSite();
    const tokensBefore = new Map(
      [...data.styleSources.values()].flatMap((source) =>
        source.type === "token" ? [[source.name, source.id]] : []
      )
    );
    const declsBefore = structuredClone([...data.styles.values()]);
    const fragmentTokens = rendered().fragment.styleSources.flatMap((source) =>
      source.type === "token" ? [source.name] : []
    );

    expect(insert(data).status).toBe("added");

    const tokensAfter = [...data.styleSources.values()].flatMap((source) =>
      source.type === "token" ? [source.name] : []
    );
    // no suffixed copies: one token per name, the site's where it had one
    expect(new Set(tokensAfter).size).toBe(tokensAfter.length);
    expect(new Set(tokensAfter)).toEqual(
      new Set([...tokensBefore.keys(), ...fragmentTokens])
    );
    for (const decl of declsBefore) {
      if ([...tokensBefore.values()].includes(decl.styleSourceId)) {
        expect([...data.styles.values()]).toContainEqual(decl);
      }
    }
  });

  test("copies Home's nav first and footer last", async () => {
    const data = await appliedSite();
    const [homeNav] = childrenOf(data, homeBodyId(data));
    const homeFooter = childrenOf(data, homeBodyId(data)).at(-1)!;

    expect(insert(data).status).toBe("added");

    const children = childrenOf(data, newBodyId(data));
    expect(children[0]).toMatchObject({ tag: "header", label: "Nav" });
    expect(children[0].id).not.toBe(homeNav.id);
    expect(children.at(-1)).toMatchObject({ tag: "footer", label: "Footer" });
    expect(children.at(-1)!.id).not.toBe(homeFooter.id);
    // the page template's own sections between them
    expect(children.slice(1, -1).map((child) => child.label)).toEqual([
      "Page header",
      "Sign-up",
      "Call to action band",
    ]);
  });

  test("finds the nav by tag when unlabelled", async () => {
    const data = await blankSite();
    addHomeChild(data, { id: "bare-nav", component: "ws:element", tag: "nav" });
    addHomeChild(data, {
      id: "main",
      component: "ws:element",
      tag: "main",
      label: "Hero",
    });

    expect(insert(data).status).toBe("added");

    const [first] = childrenOf(data, newBodyId(data));
    expect(first.tag).toBe("nav");
    expect(first.id).not.toBe("bare-nav");
    expect(
      childrenOf(data, newBodyId(data)).some((child) => child.tag === "main")
    ).toBe(false);
  });

  test("finds the nav through a Slot, and shares it", async () => {
    const data = await appliedSite();
    const body = data.instances.get(homeBodyId(data))!;
    const [navChild] = body.children;
    if (navChild.type !== "id") {
      throw new Error("No nav");
    }
    data.instances.set("shared-fragment", {
      type: "instance",
      id: "shared-fragment",
      component: "Fragment",
      children: [{ type: "id", value: navChild.value }],
    });
    data.instances.set("nav-slot", {
      type: "instance",
      id: "nav-slot",
      component: "Slot",
      children: [{ type: "id", value: "shared-fragment" }],
    });
    body.children[0] = { type: "id", value: "nav-slot" };
    const fragmentCount = () =>
      [...data.instances.values()].filter(
        (instance) => instance.component === "Fragment"
      ).length;
    const fragmentsBefore = fragmentCount();
    const homeBefore = homeSubtree(data);

    expect(insert(data).status).toBe("added");

    const [first] = childrenOf(data, newBodyId(data));
    expect(first.component).toBe("Slot");
    expect(first.id).not.toBe("nav-slot");
    expect(first.children).toEqual([{ type: "id", value: "shared-fragment" }]);
    expect(fragmentCount()).toBe(fragmentsBefore);
    const why = findByLabel(data, "shared-fragment", "Why")!;
    expect(propOf(data, why.id, "href")?.value).toBe("#why");
    expect(homeSubtree(data)).toEqual(homeBefore);
  });

  test("rewrites # anchors to Home and keeps page links", async () => {
    const data = await appliedSite();
    const homeNavId = childrenOf(data, homeBodyId(data))[0].id;
    const homeWhy = findByLabel(data, homeNavId, "Why")!;
    const homeWhyProp = propOf(data, homeWhy.id, "href");
    const homeAbout = findByLabel(data, homeNavId, "About")!;
    const aboutLink = propOf(data, homeAbout.id, "href");
    const homeBefore = homeSubtree(data);

    expect(insert(data).status).toBe("added");

    const navCopyId = childrenOf(data, newBodyId(data))[0].id;
    const why = findByLabel(data, navCopyId, "Why")!;
    expect(propOf(data, why.id, "href")).toMatchObject({
      type: "string",
      value: "/#why",
    });
    const aboutCopy = findByLabel(data, navCopyId, "About")!;
    expect(propOf(data, aboutCopy.id, "href")).toMatchObject({
      type: "page",
      value: aboutLink?.value,
    });
    expect(propOf(data, homeWhy.id, "href")).toEqual(homeWhyProp);
    expect(homeSubtree(data)).toEqual(homeBefore);
  });

  test("keeps a nav expression bound to a Global Root variable", async () => {
    const data = await appliedSite();
    data.dataSources.set("site-name", {
      type: "variable",
      id: "site-name",
      scopeInstanceId: ROOT_INSTANCE_ID,
      name: "siteName",
      value: { type: "string", value: "Your organization" },
    });
    const homeNavId = childrenOf(data, homeBodyId(data))[0].id;
    const siteName = findByLabel(data, homeNavId, "Site name")!;
    siteName.children = [
      { type: "expression", value: encodeDataSourceVariable("site-name") },
    ];

    expect(insert(data).status).toBe("added");

    const navCopyId = childrenOf(data, newBodyId(data))[0].id;
    const copy = findByLabel(data, navCopyId, "Site name")!;
    expect(copy.id).not.toBe(siteName.id);
    expect(copy.children).toEqual([
      { type: "expression", value: encodeDataSourceVariable("site-name") },
    ]);
  });

  test("copies a footer Signup Form and Event List as a paste does", async () => {
    const data = await appliedSite();
    const homeFooterId = childrenOf(data, homeBodyId(data)).at(-1)!.id;
    const homeResourceIds = resourceBindingsUnder(data, homeFooterId);
    expect(homeResourceIds).toHaveLength(2);
    const resourcesBefore = structuredClone(
      homeResourceIds.map((id) => data.resources.get(id))
    );

    expect(insert(data).status).toBe("added");

    const footerCopyId = childrenOf(data, newBodyId(data)).at(-1)!.id;
    const copyResourceIds = resourceBindingsUnder(data, footerCopyId);
    expect(copyResourceIds).toHaveLength(2);
    for (const [index, id] of copyResourceIds.entries()) {
      expect(homeResourceIds).not.toContain(id);
      const { id: _copyId, ...copy } = data.resources.get(id)!;
      const { id: _homeId, ...original } = resourcesBefore[index]!;
      expect(copy).toEqual(original);
    }
    expect(homeResourceIds.map((id) => data.resources.get(id))).toEqual(
      resourcesBefore
    );
  });

  test("copies Home's body styles", async () => {
    const data = await appliedSite();
    const homeDecls = localDecls(data, homeBodyId(data));
    expect(homeDecls.length).toBeGreaterThan(0);

    expect(insert(data).status).toBe("added");

    expect(localDecls(data, newBodyId(data))).toEqual(homeDecls);
  });

  test("gives the neutral body when Home's has none", async () => {
    const data = await blankSite();
    expect(localDecls(data, homeBodyId(data))).toEqual([]);

    expect(insert(data).status).toBe("added");

    expect(
      localDecls(data, newBodyId(data))
        .map((decl) => decl.property)
        .sort()
    ).toEqual(
      neutralBodyStyles()
        .map((decl) => camelCaseProperty(decl.property))
        .sort()
    );
  });

  test("a Home with no nav or footer gives a page with neither", async () => {
    const data = await blankSite();

    expect(insert(data).status).toBe("added");

    expect(
      childrenOf(data, newBodyId(data)).map((child) => child.label)
    ).toEqual(["Page header", "Sign-up", "Call to action band"]);
  });

  test("a Home with one child copies it once", async () => {
    const data = await blankSite();
    addHomeChild(data, {
      id: "only-nav",
      component: "ws:element",
      tag: "header",
      label: "Nav",
    });

    expect(insert(data).status).toBe("added");

    expect(
      childrenOf(data, newBodyId(data)).map((child) => child.label)
    ).toEqual(["Nav", "Page header", "Sign-up", "Call to action band"]);
  });

  test("stores the row", async () => {
    const data = await appliedSite();

    expect(insert(data, { name: "Our sample" })).toEqual({
      status: "added",
      pageId: "new-page",
      unboundBlocks: [],
    });

    expect(data.pages.pages.get("new-page")).toEqual({
      id: "new-page",
      name: "Our sample",
      path: "/sample",
      title: JSON.stringify(sampleStarterPage.title),
      rootInstanceId: newBodyId(data),
      meta: {
        description: JSON.stringify(sampleStarterPage.description),
        excludePageFromSearch: "false",
      },
    });
    const root = data.pages.folders.get(ROOT_FOLDER_ID)!;
    expect(root.children.at(-1)).toBe("new-page");
  });

  test("binds the placed blocks, and reports a block it cannot bind", async () => {
    const data = await appliedSite();
    expect(insert(data)).toMatchObject({ status: "added", unboundBlocks: [] });
    const signupCopy = childrenOf(data, newBodyId(data)).find(
      (child) => child.label === "Sign-up"
    )!;
    expect(resourceBindingsUnder(data, signupCopy.id)).toHaveLength(1);

    const broken = await blankSite();
    // the project's link to the org's data (insert-organizeos-block.ts)
    broken.resources.delete(presetIds.events.resourceId);
    expect(insert(broken)).toEqual({
      status: "added",
      pageId: "new-page",
      unboundBlocks: ["Signup Form"],
    });
    const signup = childrenOf(broken, newBodyId(broken)).find(
      (child) => child.label === "Sign-up"
    )!;
    expect(
      childrenOf(broken, signup.id).some(
        (child) => child.component === SignupForm
      )
    ).toBe(true);
  });
});

describe("insertStarterPage", () => {
  const setStores = (
    data: WebstudioData,
    projectSettings?: ProjectSettings
  ) => {
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
    $projectSettings.set(projectSettings ?? { meta: {}, compiler: {} });
    $selectedPageId.set(data.pages.homePageId);
    $builderMode.set("design");
    $authPermit.set("build");
    $project.set({ id: projectId } as Project);
    serverSyncStore.transactionManager.currentStack = [];
    serverSyncStore.transactionManager.undoneStack = [];
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("adds the page as one undo step and selects it", async () => {
    setStores(await appliedSite());
    const before = getWebstudioData();

    const result = await insertStarterPage(sampleStarterPage, fields);

    expect(result).toMatchObject({ status: "added", unboundBlocks: [] });
    if (result.status !== "added") {
      throw new Error("Not added");
    }
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(1);
    expect($selectedPageId.get()).toBe(result.pageId);
    expect(getWebstudioData().pages.pages.get(result.pageId)?.path).toBe(
      "/sample"
    );

    serverSyncStore.undo();

    expect(getWebstudioData()).toEqual(before);
  });

  test("refuses with the runtime's message when the runtime refuses", async () => {
    const provisioned = await createProvisionedProject(provisioning);
    setStores(provisioned);
    // a page template selected without build access, the one place the
    // runtime layer refuses a commit (as apply-site-template.test.tsx does)
    $pages.set({
      ...provisioned.pages,
      pageTemplates: new Map([
        [
          "template",
          {
            id: "template",
            name: "Template",
            title: "Template",
            rootInstanceId: provisioned.pages.pages.get(
              provisioned.pages.homePageId
            )!.rootInstanceId,
            meta: {},
          },
        ],
      ]),
    });
    $selectedPageId.set("template");
    $authPermit.set("view");
    const before = getWebstudioData();
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await insertStarterPage(sampleStarterPage, fields)).toEqual({
      status: "refused",
      reason: "runtime",
      message:
        "Page templates can be edited only in design mode, with build access.",
    });
    expect(getWebstudioData()).toEqual(before);
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(0);
  });

  test("refuses with no project", async () => {
    setStores(await appliedSite());
    $project.set(undefined);

    expect(await insertStarterPage(sampleStarterPage, fields)).toEqual({
      status: "refused",
      reason: "no-project",
    });
  });
});

describe("starterLook", () => {
  test("starterLook follows the record", () => {
    const workwear = SITE_TEMPLATES.find(
      (template) => template.id === "workwear"
    )!;
    expect(
      starterLook({
        meta: {},
        compiler: {},
        organizeos: { siteTemplate: { id: workwear.id } },
      } as ProjectSettings)
    ).toEqual(workwear.look);
    expect(starterLook(undefined)).toEqual(NEUTRAL_LOOK);
    expect(starterLook({ meta: {}, compiler: {} } as ProjectSettings)).toEqual(
      NEUTRAL_LOOK
    );
    expect(
      starterLook({
        meta: {},
        compiler: {},
        organizeos: { siteTemplate: { id: "gone" } },
      } as ProjectSettings)
    ).toEqual(NEUTRAL_LOOK);
  });
});

describe("unboundBlocksMessage", () => {
  test("names each block once, in order, in the apply's wording", () => {
    expect(
      unboundBlocksMessage(["Signup Form", "Signup Form", "Event List"])
    ).toMatch(
      /^Not linked to your organization's data: Signup Form, Event List\. Contact .+ support to restore the link\.$/
    );
  });
});
