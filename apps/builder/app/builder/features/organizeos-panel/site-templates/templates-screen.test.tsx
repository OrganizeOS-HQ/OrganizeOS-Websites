import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { TooltipProvider } from "@webstudio-is/design-system";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import { ROOT_INSTANCE_ID, type WebstudioData } from "@webstudio-is/sdk";
import {
  type SiteTemplate,
  BLANK_CANONICAL_VALUES,
  CANONICAL_COLOR_NAMES,
  CANONICAL_FONT_NAMES,
} from "@organizeos/site-components/site-templates";
import { createPages } from "../../../../../../../packages/project-build/src/template";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $assets,
  $projectSettings,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  $authPermit,
  $organizeosSite,
  $planFeatures,
  setBuilderMode,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $builderMode } from "~/shared/nano-states/misc";
import { $dataLoadingState } from "~/builder/shared/nano-states";
import { updateWebstudioDataStaged } from "../staged-data";
import {
  type ApplyOutcome,
  applySiteTemplate,
  writeCanonicalVariablesMutable,
} from "./apply-site-template";
import { $isTemplatesScreenOffered, TemplatesScreen } from "./templates-screen";
import { $newPageScreenOpen } from "../starter-pages/new-page-screen-state";

// The catalog is empty until a template is written; the tests fill it.
const { catalog, toastError } = vi.hoisted(() => ({
  catalog: [] as SiteTemplate[],
  toastError: vi.fn(),
}));
vi.mock(
  "@organizeos/site-components/site-templates",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@organizeos/site-components/site-templates")
    >()),
    SITE_TEMPLATES: catalog,
  })
);
// Spied, not replaced: a factory that imports the original module waits on
// itself in the browser runner (both modules are in import cycles). Each
// test sets what the spies do.
vi.mock("./apply-site-template", { spy: true });
// setBuilderMode's own module: the barrel re-exports with `export *`, which
// the browser runner cannot spy
vi.mock("~/shared/nano-states/misc", { spy: true });
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError } },
}));

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Every ResizeObserver the screen, the dialog and Radix make, with the
// elements each observes; none calls back unless a test triggers the ones
// observing an element.
const observers: {
  callback: ResizeObserverCallback;
  elements: Set<Element>;
}[] = [];
class RecordingResizeObserver {
  #record: (typeof observers)[number];
  constructor(callback: ResizeObserverCallback) {
    this.#record = { callback, elements: new Set() };
    observers.push(this.#record);
  }
  observe(element: Element) {
    this.#record.elements.add(element);
  }
  unobserve(element: Element) {
    this.#record.elements.delete(element);
  }
  disconnect() {
    this.#record.elements.clear();
  }
}
const triggerResize = (element: Element) => {
  for (const { callback, elements } of observers) {
    if (elements.has(element)) {
      callback([], {} as ResizeObserver);
    }
  }
};

/** The builder's dialog boundary, as builder.tsx places it, sized. */
let boundary: HTMLElement;
const setBoundary = (width: number, height: number) => {
  boundary.style.width = `${width}px`;
  boundary.style.height = `${height}px`;
};

const entry = (
  id: string,
  category: SiteTemplate["category"],
  status: SiteTemplate["status"]
): SiteTemplate => ({
  id,
  category,
  name: `${id} name`,
  oneLine: `${id} line`,
  styleTags: [],
  status,
  dependsOn: [],
  thumbnail: "thumbnail.jpg",
  pagePictures: { about: "page-about.jpg" },
  look: {
    buttonRadius: "6px",
    buttonWeight: 600,
    headingWeight: 700,
    navNameSize: "20px",
    footerNameSize: "20px",
  },
  variables: { ...BLANK_CANONICAL_VALUES, base: "#0f172a" },
  images: {
    "thumbnail.jpg": {
      url: `/site-templates/${id}/thumbnail.jpg`,
      sourceUrl: "https://example.org/thumbnail",
      alt: "A picture of the template's Home page",
    },
    "page-about.jpg": {
      url: `/site-templates/${id}/page-about.jpg`,
      sourceUrl: "https://example.org/page-about",
      alt: "A picture of the template's About page",
    },
  },
  fonts: {},
  // applySiteTemplate is mocked, so no body renders
  pages: [
    {
      key: "home",
      name: "Home",
      path: "",
      title: "Home",
      description: "",
      body: () => <></>,
    },
    {
      key: "about",
      name: "About",
      path: "/about",
      title: "About",
      description: "",
      body: () => <></>,
    },
  ],
});

const union = entry("union", "union", "listed");
const nonprofit = entry("nonprofit", "nonprofit", "listed");
const draft = entry("draft", "community", "draft");

// The offer recomputes when a store changes, not the catalog, so a test that
// changes the catalog sets the project after it.
const setCatalog = (templates: SiteTemplate[]) => {
  catalog.splice(0, catalog.length, ...templates);
};

/** A project as `createPages()` makes it: Home, empty, and the 404 page. */
const setProject = (change?: (data: WebstudioData) => void) => {
  const data = createPages();
  change?.(data);
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
  $projectSettings.set(undefined);
  return data;
};

const findNotFoundPageId = () =>
  [...($pages.get()?.pages.values() ?? [])].find((page) => page.path === "/*")
    ?.id;

let root: Root | undefined;
let container: HTMLElement | undefined;

const render = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(TemplatesScreen))
    );
  });
};

const unmount = () => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
};

/** Lets pending promises settle and a frame pass. */
const settle = async () => {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
};

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const dialogButton = (text: string) =>
  Array.from(dialog()?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent === text
  );

const startBlankButton = () => dialogButton("Start blank");

// pending, the button also draws its loading dots
const applyButton = () =>
  Array.from(dialog()?.querySelectorAll("button") ?? []).find((button) =>
    button.textContent?.includes("Use template")
  );

const backButton = () =>
  dialog()?.querySelector<HTMLButtonElement>('[aria-label="Back"]');

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-site-template="${id}"]`);

const cardIds = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-site-template]"),
    (element) => element.dataset.siteTemplate
  );

const categories = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-template-category]"),
    (element) => element.textContent
  );

const category = (label: string) =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-template-category]")
  ).find((element) => element.textContent === label);

const currentCategory = () =>
  document.querySelector<HTMLElement>(
    '[data-template-category][aria-current="true"]'
  )?.textContent;

const chooseCategory = async (label: string) => {
  await act(async () => {
    category(label)?.click();
  });
  await settle();
};

const openTemplate = async (id: string) => {
  await act(async () => {
    card(id)?.click();
  });
  await settle();
};

const pageFigures = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-site-template-page]")
  );

const pageNames = () =>
  pageFigures().map(
    (figure) => figure.querySelector("figcaption")?.textContent
  );

const pageSrcs = () =>
  pageFigures().map(
    (figure) => figure.querySelector("img")?.getAttribute("src") ?? null
  );

/** Opens a template's page view, then chooses Use template. */
const applyTemplate = async (id: string) => {
  await openTemplate(id);
  await act(async () => {
    applyButton()?.click();
  });
  await settle();
};

const pressEscape = async () => {
  act(() => {
    dialog()?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
  });
  await settle();
};

const isDisabled = (element: Element | null | undefined) =>
  element?.matches(":disabled") ?? false;

/** The custom properties declared on Global Root. */
const rootVariables = () => {
  const styleSourceIds = new Set(
    $styleSourceSelections.get().get(ROOT_INSTANCE_ID)?.values
  );
  return [...$styles.get().values()]
    .filter((decl) => styleSourceIds.has(decl.styleSourceId))
    .map((decl) => decl.property)
    .sort();
};

const applied = async (template: SiteTemplate): Promise<ApplyOutcome> => {
  await updateWebstudioDataStaged((data) => {
    writeCanonicalVariablesMutable(data, template.variables, "overwrite");
  });
  return { status: "applied", unboundBlocks: [], missingImages: 0 };
};

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
  boundary = document.createElement("div");
  boundary.setAttribute("data-dialog-boundary", "");
  boundary.style.position = "fixed";
  boundary.style.left = "0";
  boundary.style.top = "40px";
  setBoundary(1240, 840);
  document.body.appendChild(boundary);
  history.replaceState(null, "", "/");
  setCatalog([union, nonprofit]);
  setProject();
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.organizeos.org/dashboard",
    platformUrl: "https://app.organizeos.org",
    blocksEnabled: true,
  });
  $authPermit.set("own");
  $builderMode.set("design");
  $planFeatures.set({ ...defaultPlanFeatures, allowContentMode: true });
  $dataLoadingState.set("loaded");
  // the New page screen beside it stays closed: dialog() reads the first
  $newPageScreenOpen.set(false);
  vi.mocked(applySiteTemplate).mockReset();
  vi.mocked(applySiteTemplate).mockImplementation(async (template) =>
    applied(template)
  );
  vi.mocked(setBuilderMode).mockReset();
  vi.mocked(setBuilderMode).mockImplementation(() => {});
  toastError.mockClear();
});

afterEach(() => {
  unmount();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the offer", () => {
  test("not offered before data is loaded", async () => {
    $dataLoadingState.set("loading");
    render();
    expect($isTemplatesScreenOffered.get()).toBe(false);
    expect(dialog()).toBeNull();

    act(() => {
      $dataLoadingState.set("loaded");
    });
    expect($isTemplatesScreenOffered.get()).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  test("not offered when no template is listed", () => {
    setCatalog([draft]);
    setProject();
    render();
    expect($isTemplatesScreenOffered.get()).toBe(false);
    expect(dialog()).toBeNull();
  });

  test("offered on an untouched project with a listed template", () => {
    render();
    expect($isTemplatesScreenOffered.get()).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  test("not offered to a viewer", () => {
    $authPermit.set("view");
    render();
    expect($isTemplatesScreenOffered.get()).toBe(false);
    expect(dialog()).toBeNull();
  });

  test("not offered to a content editor (edit)", () => {
    $authPermit.set("edit");
    render();
    expect($isTemplatesScreenOffered.get()).toBe(false);
    expect(dialog()).toBeNull();
  });

  test("offered to a builder and an admin", () => {
    $authPermit.set("build");
    render();
    expect(dialog()).not.toBeNull();
    act(() => {
      $authPermit.set("admin");
    });
    expect(dialog()).not.toBeNull();
    act(() => {
      $authPermit.set("view");
    });
    expect(dialog()).toBeNull();
  });

  test("not offered to an org denied the blocks", () => {
    $organizeosSite.set({ ...$organizeosSite.get()!, blocksEnabled: false });
    render();
    expect($isTemplatesScreenOffered.get()).toBe(false);
    expect(dialog()).toBeNull();
  });

  test("not offered on a project with a Home child", () => {
    setProject((data) => {
      const home = data.pages.pages.get(data.pages.homePageId)!;
      data.instances.get(home.rootInstanceId)!.children.push({
        type: "text",
        value: "Hello",
      });
    });
    render();
    expect($isTemplatesScreenOffered.get()).toBe(false);
  });

  const imageAsset = (id: string) => ({
    id,
    projectId: "project-1",
    type: "image" as const,
    name: `${id}.jpg`,
    format: "jpg",
    size: 1,
    createdAt: "2026-11-13T00:00:00.000Z",
    meta: { width: 1, height: 1 },
  });

  test("offered with an asset nothing uses", () => {
    setProject((data) => {
      data.assets.set("asset-hero", imageAsset("asset-hero"));
    });
    render();
    expect($isTemplatesScreenOffered.get()).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  test("not offered with an asset a prop uses", () => {
    setProject((data) => {
      data.assets.set("asset-hero", imageAsset("asset-hero"));
      data.props.set("p", {
        id: "p",
        instanceId: "any",
        name: "src",
        type: "asset",
        value: "asset-hero",
      });
    });
    render();
    expect($isTemplatesScreenOffered.get()).toBe(false);
  });

  test("not offered with an asset the favicon uses", () => {
    setProject((data) => {
      data.assets.set("asset-hero", imageAsset("asset-hero"));
    });
    $projectSettings.set({
      meta: { faviconAssetId: "asset-hero" },
      compiler: {},
    });
    render();
    expect($isTemplatesScreenOffered.get()).toBe(false);
    $projectSettings.set(undefined);
  });

  test("not offered once Global Root declares a canonical variable", async () => {
    render();
    expect(dialog()).not.toBeNull();
    await act(async () => {
      await updateWebstudioDataStaged((data) => {
        writeCanonicalVariablesMutable(data, BLANK_CANONICAL_VALUES, "fill");
      });
    });
    expect($isTemplatesScreenOffered.get()).toBe(false);
    expect(dialog()).toBeNull();
  });

  test("drafts appear only with templateDrafts=1", () => {
    setCatalog([draft, nonprofit]);
    setProject();
    render();
    expect(cardIds()).toEqual(["nonprofit"]);
    unmount();

    history.replaceState(null, "", "/?templateDrafts=1");
    render();
    expect(cardIds()).toEqual(["nonprofit", "draft"]);
    unmount();

    setCatalog([draft]);
    setProject();
    render();
    expect($isTemplatesScreenOffered.get()).toBe(true);
    expect(cardIds()).toEqual(["draft"]);
  });
});

describe("the screen", () => {
  test("the left column lists All, then each category with an offered template, in order; All is current", () => {
    setCatalog([union, draft, nonprofit]);
    setProject();
    render();
    expect(categories()).toEqual(["All", "Nonprofit", "Union"]);
    expect(currentCategory()).toBe("All");
  });

  test("All shows every offered template in category order; a category shows its own", async () => {
    history.replaceState(null, "", "/?templateDrafts=1");
    setCatalog([union, draft, nonprofit]);
    setProject();
    render();
    expect(categories()).toEqual(["All", "Nonprofit", "Community", "Union"]);
    expect(cardIds()).toEqual(["nonprofit", "draft", "union"]);
    await chooseCategory("Union");
    expect(currentCategory()).toBe("Union");
    expect(cardIds()).toEqual(["union"]);
  });

  test("a card shows its thumbnail and name, and nothing else", () => {
    render();
    expect(card("nonprofit")?.textContent).toBe("nonprofit name");
    expect(card("nonprofit")?.querySelector("img")?.getAttribute("src")).toBe(
      "/site-templates/nonprofit/thumbnail.jpg"
    );
  });

  test("no close button and no explanatory text", () => {
    render();
    const buttons = Array.from(dialog()?.querySelectorAll("button") ?? []);
    expect(buttons.map((button) => button.textContent)).toEqual([
      "All",
      "Nonprofit",
      "Union",
      "nonprofit name",
      "union name",
      "Start blank",
    ]);
    expect(dialog()?.textContent).toBe(
      [
        "All",
        "Nonprofit",
        "Union",
        "nonprofit name",
        "union name",
        "Start from a template",
        "Start blank",
      ].join("")
    );
  });

  test("a long name truncates, with the full name in a tooltip", async () => {
    // the first card in All order, whose name is inside the test's viewport
    const name = "N".repeat(120);
    setCatalog([{ ...nonprofit, name }, union]);
    setProject();
    render();
    const nameElement = Array.from(
      card("nonprofit")?.querySelectorAll<HTMLElement>("*") ?? []
    ).find(
      (element) =>
        element.childElementCount === 0 && element.textContent === name
    )!;
    expect(nameElement).toBeDefined();
    expect(nameElement.scrollWidth).toBeGreaterThan(nameElement.clientWidth);
    await act(async () => userEvent.hover(nameElement));
    await vi.waitFor(
      () => {
        const tooltip = document.querySelector('[role="tooltip"]');
        expect(tooltip?.textContent).toBe(name);
      },
      { timeout: 3000 }
    );
    const right = dialog()!.getBoundingClientRect().right;
    for (const id of cardIds()) {
      expect(card(id!)!.getBoundingClientRect().right).toBeLessThanOrEqual(
        right
      );
    }
  });

  test("a card opens its page view, and nothing is applied until Use template", async () => {
    render();
    await openTemplate("union");
    expect(applySiteTemplate).not.toHaveBeenCalled();
    expect(cardIds()).toEqual([]);
    expect(pageNames()).toEqual(["Home", "About"]);
    expect(pageSrcs()).toEqual([
      "/site-templates/union/thumbnail.jpg",
      "/site-templates/union/page-about.jpg",
    ]);
    expect(dialog()?.textContent).toContain("union name");
    expect(applyButton()).toBeDefined();
    expect(document.activeElement).toBe(backButton());
  });

  test("a long name in the page view leaves Use template whole", async () => {
    setCatalog([{ ...union, name: "N".repeat(120) }, nonprofit]);
    setProject();
    render();
    await openTemplate("union");
    const button = applyButton()!;
    // the label clips inside the button, so look at every box in it
    for (const element of [button, ...button.querySelectorAll("*")]) {
      expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
    }
    expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
      dialog()!.getBoundingClientRect().right
    );
  });

  test("a page without a picture shows an empty frame", async () => {
    setCatalog([{ ...union, pagePictures: {} }, nonprofit]);
    setProject();
    render();
    await openTemplate("union");
    expect(pageNames()).toEqual(["Home", "About"]);
    expect(pageSrcs()).toEqual(["/site-templates/union/thumbnail.jpg", null]);
  });

  test("Back and Escape return to the grid, and the focus to the card", async () => {
    render();
    await openTemplate("union");
    await act(async () => {
      backButton()?.click();
    });
    await settle();
    expect(cardIds()).toEqual(["nonprofit", "union"]);
    expect(document.activeElement).toBe(card("union"));

    await openTemplate("union");
    await pressEscape();
    expect(dialog()).not.toBeNull();
    expect(cardIds()).toEqual(["nonprofit", "union"]);
    expect(document.activeElement).toBe(card("union"));
  });

  test("Escape at the grid does nothing", async () => {
    render();
    await pressEscape();
    expect(dialog()).not.toBeNull();
    expect(cardIds()).toEqual(["nonprofit", "union"]);
  });

  test("choosing a category from the page view returns to that category's grid", async () => {
    render();
    await openTemplate("union");
    await chooseCategory("Nonprofit");
    expect(pageFigures()).toEqual([]);
    expect(cardIds()).toEqual(["nonprofit"]);
  });

  test("opens at the grid each time it is offered", async () => {
    render();
    await chooseCategory("Union");
    await openTemplate("union");
    // a Home child ends the offer; taking it away offers it again
    act(() => {
      setProject((data) => {
        const home = data.pages.pages.get(data.pages.homePageId)!;
        data.instances.get(home.rootInstanceId)!.children.push({
          type: "text",
          value: "Hello",
        });
      });
    });
    expect(dialog()).toBeNull();
    act(() => {
      setProject();
    });
    await settle();
    expect(dialog()).not.toBeNull();
    expect(currentCategory()).toBe("All");
    expect(cardIds()).toEqual(["nonprofit", "union"]);
  });

  test("the size follows the boundary", async () => {
    render();
    expect(dialog()?.style.width).toBe("1200px");
    expect(dialog()?.style.height).toBe("800px");
    setBoundary(1040, 840);
    act(() => {
      triggerResize(boundary);
    });
    await settle();
    expect(dialog()?.style.width).toBe("1000px");
  });

  test("sizes from the window when the boundary is hidden or missing", async () => {
    boundary.style.display = "none";
    render();
    await settle();
    let rect = dialog()!.getBoundingClientRect();
    expect(rect.width).toBe(window.innerWidth - 40);
    expect(rect.height).toBe(window.innerHeight - 40);
    unmount();

    boundary.remove();
    render();
    await settle();
    rect = dialog()!.getBoundingClientRect();
    expect(rect.width).toBe(window.innerWidth - 40);
    expect(rect.height).toBe(window.innerHeight - 40);
  });

  test("never smaller than 240px each way", async () => {
    setBoundary(200, 200);
    render();
    await settle();
    const rect = dialog()!.getBoundingClientRect();
    expect(rect.width).toBe(240);
    expect(rect.height).toBe(240);
  });

  test("a narrow dialog shows a Category select in place of the column", async () => {
    // 360 wide: the main area is under 600, and the controls fit the
    // test's 414px viewport
    setBoundary(400, 800);
    render();
    await settle();
    expect(categories()).toEqual([]);
    const trigger = dialog()?.querySelector<HTMLElement>(
      '[aria-label="Category"]'
    );
    expect(trigger?.textContent).toBe("All");
    await act(async () => userEvent.click(trigger!));
    await settle();
    const union = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    ).find((option) => option.textContent === "Union");
    await act(async () => userEvent.click(union!));
    await settle();
    expect(cardIds()).toEqual(["union"]);
    const right = dialog()!.getBoundingClientRect().right;
    expect(card("union")!.getBoundingClientRect().right).toBeLessThanOrEqual(
      right
    );
  });
});

describe("choosing", () => {
  test("Start blank writes the variables and closes", async () => {
    render();
    await act(async () => {
      startBlankButton()?.click();
    });
    // a staged write, committed a microtask later
    await vi.waitFor(() =>
      expect(rootVariables()).toEqual(
        [...CANONICAL_COLOR_NAMES, ...CANONICAL_FONT_NAMES]
          .map((name) => `--${name}`)
          .sort()
      )
    );
    expect($isTemplatesScreenOffered.get()).toBe(false);
    await settle();
    expect(dialog()).toBeNull();
    expect(applySiteTemplate).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  test("a Start blank the runtime refuses says why, writes nothing and keeps the dialog", async () => {
    // a page template outside design mode, where the runtime layer refuses
    // a commit
    const pages = $pages.get()!;
    $pages.set({
      ...pages,
      pageTemplates: new Map([
        [
          "template",
          {
            id: "template",
            name: "Template",
            title: "Template",
            rootInstanceId: pages.pages.get(pages.homePageId)!.rootInstanceId,
            meta: {},
          },
        ],
      ]),
    });
    $selectedPageId.set("template");
    $builderMode.set("content");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render();

    await act(async () => {
      startBlankButton()?.click();
    });
    await settle();

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Page templates can be edited only in design mode, with build access."
    );
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(rootVariables()).toEqual([]);
    expect($isTemplatesScreenOffered.get()).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  test("choosing a template applies it and switches to Simple mode when allowed", async () => {
    $selectedPageId.set(findNotFoundPageId());
    render();
    await applyTemplate("union");
    expect(applySiteTemplate).toHaveBeenCalledTimes(1);
    expect(applySiteTemplate).toHaveBeenCalledWith(union);
    expect(dialog()).toBeNull();
    expect($selectedPageId.get()).toBe($pages.get()?.homePageId);
    expect(setBuilderMode).toHaveBeenCalledTimes(1);
    expect(setBuilderMode).toHaveBeenCalledWith("content");
    expect(toastError).not.toHaveBeenCalled();
  });

  test("stays in Design mode when content mode is not allowed", async () => {
    // a builder, not the owner: 0.309.0 always allows the owner content mode
    $authPermit.set("build");
    $planFeatures.set({ ...defaultPlanFeatures, allowContentMode: false });
    render();
    await applyTemplate("union");
    expect(dialog()).toBeNull();
    expect($selectedPageId.get()).toBe($pages.get()?.homePageId);
    expect(setBuilderMode).not.toHaveBeenCalled();
  });

  test("blocks left unbound are named in one error", async () => {
    vi.mocked(applySiteTemplate).mockImplementation(async (template) => ({
      ...(await applied(template)),
      unboundBlocks: ["Event List", "Event Card", "Event List"],
    }));
    render();
    await applyTemplate("union");
    expect(dialog()).toBeNull();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Not linked to your organization's data: Event List, Event Card. Contact OrganizeOS support to restore the link."
    );
    expect(setBuilderMode).toHaveBeenCalledWith("content");
  });

  test.each([
    { missingImages: 1, message: "1 photo could not be added." },
    { missingImages: 2, message: "2 photos could not be added." },
  ])(
    "photos that could not be added are counted in one error ($missingImages)",
    async ({ missingImages, message }) => {
      vi.mocked(applySiteTemplate).mockImplementation(async (template) => ({
        ...(await applied(template)),
        missingImages,
      }));
      render();
      await applyTemplate("union");
      expect(dialog()).toBeNull();
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith(message);
    }
  );

  // Undone while its images uploaded: the project is empty again, the chooser
  // offered again, and nothing more is done for the undone apply.
  test("skips the steps after an apply that was undone", async () => {
    vi.mocked(applySiteTemplate).mockImplementation(async (template) => {
      const result = await applied(template);
      serverSyncStore.undo();
      return { ...result, unboundBlocks: ["Event List"], missingImages: 1 };
    });
    // a page other than Home is open, so opening Home would show
    const notFoundPageId = findNotFoundPageId();
    $selectedPageId.set(notFoundPageId);
    render();
    await applyTemplate("union");
    expect($isTemplatesScreenOffered.get()).toBe(true);
    expect(dialog()).not.toBeNull();
    // offered again: at the grid
    expect(cardIds()).toEqual(["nonprofit", "union"]);
    expect(toastError).not.toHaveBeenCalled();
    expect(setBuilderMode).not.toHaveBeenCalled();
    expect($selectedPageId.get()).toBe(notFoundPageId);
  });

  test.each([
    { reason: "touched", message: "This site already has content." },
    {
      reason: "path-taken",
      message: "Its pages clash with this site's pages.",
    },
    { reason: "resources", message: "This template cannot be applied." },
    { reason: "no-project", message: "This template cannot be applied." },
  ] as const)(
    "a refused apply ($reason) says why in one error",
    async ({ reason, message }) => {
      vi.mocked(applySiteTemplate).mockResolvedValue({
        status: "refused",
        reason,
      });
      render();
      await applyTemplate("union");
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith(message);
      expect(setBuilderMode).not.toHaveBeenCalled();
    }
  );

  test("a refusal of the runtime's says its own message, and keeps the dialog open", async () => {
    const message =
      "Page templates can be edited only in design mode, with build access.";
    vi.mocked(applySiteTemplate).mockResolvedValue({
      status: "refused",
      reason: "runtime",
      message,
    });
    render();
    await applyTemplate("union");
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(message);
    expect(dialog()).not.toBeNull();
    expect(setBuilderMode).not.toHaveBeenCalled();
  });

  test("a rejected apply shows an error and keeps the dialog open", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const failure = new Error("render failed");
    vi.mocked(applySiteTemplate).mockRejectedValue(failure);
    render();
    await applyTemplate("union");
    expect(consoleError).toHaveBeenCalledWith(failure);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Cannot apply union name.");
    expect(dialog()).not.toBeNull();
    // the keyboard is where it was, not lost to the page
    expect(document.activeElement).toBe(applyButton());
    expect(isDisabled(applyButton())).toBe(false);
    expect(isDisabled(startBlankButton())).toBe(false);
    expect(setBuilderMode).not.toHaveBeenCalled();
  });

  test("while applying, one apply and nothing else answers", async () => {
    let finish: (result: ApplyOutcome) => void = () => {};
    vi.mocked(applySiteTemplate).mockImplementation(
      (template) =>
        new Promise((resolve) => {
          finish = () => resolve(applied(template));
        })
    );
    render();
    await applyTemplate("union");
    expect(applyButton()?.dataset.state).toBe("pending");
    expect(isDisabled(backButton())).toBe(true);
    expect(isDisabled(category("Union"))).toBe(true);
    expect(isDisabled(startBlankButton())).toBe(true);

    await act(async () => {
      applyButton()?.click();
    });
    await pressEscape();
    // a real pointer reaches react-aria's press handler on a disabled item
    await act(async () => userEvent.click(category("Union")!, { force: true }));
    await settle();
    expect(applySiteTemplate).toHaveBeenCalledTimes(1);
    expect(pageNames()).toEqual(["Home", "About"]);

    await act(async () => {
      finish({ status: "applied", unboundBlocks: [], missingImages: 0 });
    });
    await settle();
    expect(dialog()).toBeNull();
    expect(setBuilderMode).toHaveBeenCalledWith("content");
  });
});
