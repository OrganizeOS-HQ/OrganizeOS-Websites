import { beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { serializePages } from "@webstudio-is/project-migrations/pages";
import {
  bundleVersion,
  publishedProjectBundle,
  type PublishedProjectBundle,
} from "@webstudio-is/protocol";
import { $, renderData } from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import { coreMetas, getAllPages, type Prop } from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $registeredTemplates,
  registerComponentLibrary,
  selectInstance,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
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
import { buildOrgResourcePresets } from "~/shared/db/resource-presets.server";
import { groupOrganizeosBlocks } from "../organizeos-panel/organizeos-panel";
import {
  insertOrganizeosBlock,
  organizeosBlockData,
  organizeosNamespace,
} from "../organizeos-panel/insert-organizeos-block";
// What prebuild runs on the project bundle. A test of the builder reaches into
// the CLI for it, as the panel's tests reach into the blocks package for their
// fixtures, so that one fixture, made by the insert itself, feeds both.
import { dropOrgScript } from "../../../../../../packages/cli/src/organizeos-org-script";
import { findPausedScript } from "./organizeos-publish-paused-script";

/**
 * The org script pause (docs/ORGANIZEOS-FORK.md section 10) must leave every
 * OrganizeOS block alone: the Publish dialog lists none of it and publishing
 * drops none of it. The fixture is a page holding every block the OrganizeOS
 * panel offers, each inserted the way the panel inserts it (its template, its
 * parts and the binding the insert completes it with), so a template or a part
 * that comes to hold a tag the builder does not offer, an embed or a raw HTML
 * property fails here before an org loses it at publish.
 */

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError } },
}));

enableMapSet();
registerContainers();

$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
// As the canvas registers the blocks (canvas/canvas.tsx)
registerComponentLibrary({
  namespace: organizeosNamespace,
  components: {},
  metas: organizeosMetas,
  templates: organizeosTemplates,
});

const projectId = "project-1";
const bodyId = "bodyId";
const provisioned = await buildOrgResourcePresets({
  projectId,
  apiBaseUrl: "https://staging.example.org/api/public/v1",
  readToken: "osk_eventstoken",
});

// Every block the panel lists, in its sections and under "More"
const panelBlocks = groupOrganizeosBlocks(
  $registeredTemplates.get(),
  $registeredComponentMetas.get()
).flatMap((section) => section.blocks.map((block) => block.name));

const setProject = () => {
  const data = renderData(<$.Body ws:id={bodyId}></$.Body>);
  $instances.set(data.instances);
  $props.set(data.props);
  $breakpoints.set(new Map());
  $styles.set(new Map());
  $styleSources.set(new Map());
  $styleSourceSelections.set(new Map());
  $assets.set(new Map());
  $resources.set(
    new Map(provisioned.resources.map((resource) => [resource.id, resource]))
  );
  $dataSources.set(new Map());
  const pages = createDefaultPages({ rootInstanceId: bodyId });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  $project.set({ id: projectId } as Project);
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.example.org/dashboard",
    platformUrl: "https://app.example.org",
    blocksEnabled: true,
  });
};

// The home page with every block on it, inserted from the panel one after the
// other into the page's body.
const insertEveryBlock = async () => {
  setProject();
  for (const block of panelBlocks) {
    selectInstance([bodyId]);
    expect(await insertOrganizeosBlock(block)).toBe(true);
  }
  expect(toastError).not.toHaveBeenCalled();
};

// The project bundle prebuild reads, as the server serializes a build
// (loadProductionCanvasData in shared/db/canvas.server.ts) and as prebuild
// parses it.
const toBundle = (): PublishedProjectBundle => {
  const pages = $pages.get();
  if (pages === undefined) {
    throw new Error("No pages");
  }
  const allPages = getAllPages(pages);
  return publishedProjectBundle.parse({
    bundleVersion,
    origin: "https://assets.example",
    projectDomain: "example",
    projectTitle: "Example",
    page: allPages[0],
    pages: allPages,
    assets: [],
    build: {
      id: "build-1",
      projectId,
      version: 1,
      createdAt: "2026-10-22T00:00:00.000Z",
      updatedAt: "2026-10-22T00:00:00.000Z",
      pages: serializePages(pages),
      breakpoints: [...$breakpoints.get()],
      styles: [...$styles.get()],
      styleSources: [...$styleSources.get()],
      styleSourceSelections: [...$styleSourceSelections.get()],
      props: [...$props.get()],
      dataSources: [...$dataSources.get()],
      resources: [...$resources.get()],
      instances: [...$instances.get()],
    },
  });
};

const findOnHomePage = () =>
  findPausedScript({
    pages: $pages.get(),
    instances: $instances.get(),
    props: $props.get(),
    mayRun: false,
  });

beforeEach(() => {
  toastError.mockReset();
});

describe("every OrganizeOS block, as the panel inserts it", () => {
  test("the fixture holds every block the panel offers, every part, and their bindings", async () => {
    // Not an empty check: the panel lists these, and any block added later
    expect(panelBlocks).toEqual(
      expect.arrayContaining(
        ["SignupForm", "EventList", "EventCard", "RsvpForm"].map(
          (name) => `${organizeosNamespace}:${name}`
        )
      )
    );
    await insertEveryBlock();
    const components = new Set(
      [...$instances.get().values()].map((instance) => instance.component)
    );
    // The RSVP Form and the Signup Form with all their parts
    for (const name of Object.keys(organizeosMetas)) {
      expect(components).toContain(`${organizeosNamespace}:${name}`);
    }
    // The Event List's and Event Card's collection and the RSVP Form's
    // control styles
    expect(components).toContain("ws:collection");
    expect(components).toContain("ws:descendant");
    // Each block that reads the org's data brought its own binding; one with
    // no entry in the table is inserted untouched and brings none
    expect(
      [...$dataSources.get().values()].filter(
        (dataSource) => dataSource.type === "resource"
      )
    ).toHaveLength(
      panelBlocks.filter((block) => organizeosBlockData.has(block)).length
    );
  });

  test("the Publish dialog lists nothing of them", async () => {
    await insertEveryBlock();
    expect(findOnHomePage()).toEqual([]);
  });

  test("publishing drops nothing of them and logs no line", async () => {
    await insertEveryBlock();
    const bundle = toBundle();
    const log = vi.fn();
    // the bundle as it was read, not a copy without something
    expect(dropOrgScript(bundle, { mayRun: false, log })).toBe(bundle);
    expect(log).not.toHaveBeenCalled();
  });

  // The two above would pass on a fixture that neither reads. A raw HTML
  // property on every instance of the page shows they read every one of them,
  // the body aside.
  test("both read every instance of every block", async () => {
    await insertEveryBlock();
    const blockInstanceIds = [...$instances.get().keys()].filter(
      (id) => id !== bodyId
    );
    const props = new Map($props.get());
    for (const instanceId of blockInstanceIds) {
      const prop: Prop = {
        id: `raw-${instanceId}`,
        instanceId,
        name: "dangerouslySetInnerHTML",
        type: "json",
        value: { __html: "<img src=x onerror=alert(1)>" },
      };
      props.set(prop.id, prop);
    }
    $props.set(props);

    expect(findOnHomePage()).toEqual(
      blockInstanceIds.map(() => ({
        label: "Raw HTML property on Home",
        navigate: expect.anything(),
      }))
    );
    const log = vi.fn();
    dropOrgScript(toBundle(), { mayRun: false, log });
    expect(log).toHaveBeenCalledWith(
      `Org script is paused until OrganizeOS sites move to their own domain: left out ${blockInstanceIds.length} raw HTML properties.`
    );
  });
});
