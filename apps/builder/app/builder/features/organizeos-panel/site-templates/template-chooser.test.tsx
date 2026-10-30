import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import { ROOT_INSTANCE_ID, type WebstudioData } from "@webstudio-is/sdk";
import {
  type SiteTemplate,
  BLANK_CANONICAL_VALUES,
  CANONICAL_COLOR_NAMES,
  CANONICAL_FONT_NAMES,
} from "@organizeos/site-components/site-templates";
import { createPages } from "../../../../../../../packages/project-build/src/template";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $assets,
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
import { updateWebstudioData } from "~/shared/instance-utils/data";
import { $dataLoadingState } from "~/builder/shared/nano-states";
import {
  type ApplyResult,
  applySiteTemplate,
  writeCanonicalVariablesMutable,
} from "./apply-site-template";
import { $isTemplateChooserOffered, TemplateChooser } from "./template-chooser";

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
vi.mock("./apply-site-template", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./apply-site-template")>()),
  applySiteTemplate: vi.fn(),
}));
vi.mock("~/shared/nano-states", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/shared/nano-states")>()),
  setBuilderMode: vi.fn(),
}));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError } },
}));

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// The dialog observes its boundary, and jsdom 20 has no ResizeObserver.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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
  variables: { ...BLANK_CANONICAL_VALUES, base: "#0f172a" },
  images: {
    "thumbnail.jpg": {
      url: `/site-templates/${id}/thumbnail.jpg`,
      sourceUrl: "https://example.org/thumbnail",
      alt: "Replace with a photo",
    },
  },
  pages: [],
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
    root?.render(createElement(TemplateChooser));
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

const startBlankButton = () =>
  Array.from(dialog()?.querySelectorAll("button") ?? []).find(
    (button) => button.textContent === "Start blank"
  );

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-site-template="${id}"]`);

const cardIds = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-site-template]"),
    (element) => element.dataset.siteTemplate
  );

const headings = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-site-template-category]"),
    (element) => element.textContent
  );

const choose = async (id: string) => {
  await act(async () => {
    card(id)?.click();
  });
  await settle();
};

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

const applied = (template: SiteTemplate): ApplyResult => {
  updateWebstudioData((data) => {
    writeCanonicalVariablesMutable(data, template.variables, "overwrite");
  });
  return { status: "applied", unboundBlocks: [] };
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
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
  $planFeatures.set({ ...defaultPlanFeatures, allowContentMode: true });
  $dataLoadingState.set("loaded");
  vi.mocked(applySiteTemplate).mockReset();
  vi.mocked(applySiteTemplate).mockImplementation(async (template) =>
    applied(template)
  );
  vi.mocked(setBuilderMode).mockClear();
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
    expect($isTemplateChooserOffered.get()).toBe(false);
    expect(dialog()).toBeNull();

    act(() => {
      $dataLoadingState.set("loaded");
    });
    expect($isTemplateChooserOffered.get()).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  test("not offered when no template is listed", () => {
    setCatalog([draft]);
    setProject();
    render();
    expect($isTemplateChooserOffered.get()).toBe(false);
    expect(dialog()).toBeNull();
  });

  test("offered on an untouched project with a listed template", () => {
    render();
    expect($isTemplateChooserOffered.get()).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  test("not offered to a viewer", () => {
    $authPermit.set("view");
    render();
    expect($isTemplateChooserOffered.get()).toBe(false);
    expect(dialog()).toBeNull();
  });

  test("not offered to a content editor (edit)", () => {
    $authPermit.set("edit");
    render();
    expect($isTemplateChooserOffered.get()).toBe(false);
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
    expect($isTemplateChooserOffered.get()).toBe(false);
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
    expect($isTemplateChooserOffered.get()).toBe(false);
  });

  test("not offered once Global Root declares a canonical variable", () => {
    render();
    expect(dialog()).not.toBeNull();
    act(() => {
      updateWebstudioData((data) => {
        writeCanonicalVariablesMutable(data, BLANK_CANONICAL_VALUES, "fill");
      });
    });
    expect($isTemplateChooserOffered.get()).toBe(false);
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
    expect($isTemplateChooserOffered.get()).toBe(true);
    expect(cardIds()).toEqual(["draft"]);
  });
});

describe("the dialog", () => {
  test("Start blank, then the categories in order, each with its cards", () => {
    setCatalog([union, draft, nonprofit]);
    setProject();
    render();
    expect(startBlankButton()).toBeDefined();
    expect(headings()).toEqual(["Nonprofit", "Union"]);
    expect(cardIds()).toEqual(["nonprofit", "union"]);
    expect(card("nonprofit")?.textContent).toBe("nonprofit namenonprofit line");
    expect(card("nonprofit")?.querySelector("img")?.getAttribute("src")).toBe(
      "/site-templates/nonprofit/thumbnail.jpg"
    );
  });

  test("no close button and no explanatory text", () => {
    render();
    const buttons = Array.from(dialog()?.querySelectorAll("button") ?? []);
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Start blank",
      "nonprofit namenonprofit line",
      "union nameunion line",
    ]);
    expect(dialog()?.textContent).toBe(
      [
        "Start from a template",
        "Start blank",
        "Nonprofit",
        "nonprofit namenonprofit line",
        "Union",
        "union nameunion line",
      ].join("")
    );
  });

  test("Escape does not close it", async () => {
    render();
    act(() => {
      dialog()?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    await settle();
    expect(dialog()).not.toBeNull();
  });
});

describe("choosing", () => {
  test("Start blank writes the variables and closes", () => {
    render();
    act(() => {
      startBlankButton()?.click();
    });
    expect(rootVariables()).toEqual(
      [...CANONICAL_COLOR_NAMES, ...CANONICAL_FONT_NAMES]
        .map((name) => `--${name}`)
        .sort()
    );
    expect($isTemplateChooserOffered.get()).toBe(false);
    expect(dialog()).toBeNull();
    expect(applySiteTemplate).not.toHaveBeenCalled();
  });

  test("choosing a template applies it and switches to Simple mode when allowed", async () => {
    $selectedPageId.set(findNotFoundPageId());
    render();
    await choose("union");
    expect(applySiteTemplate).toHaveBeenCalledTimes(1);
    expect(applySiteTemplate).toHaveBeenCalledWith(union);
    expect(dialog()).toBeNull();
    expect($selectedPageId.get()).toBe($pages.get()?.homePageId);
    expect(setBuilderMode).toHaveBeenCalledTimes(1);
    expect(setBuilderMode).toHaveBeenCalledWith("content");
    expect(toastError).not.toHaveBeenCalled();
  });

  test("stays in Design mode when content mode is not allowed", async () => {
    $planFeatures.set({ ...defaultPlanFeatures, allowContentMode: false });
    render();
    await choose("union");
    expect(dialog()).toBeNull();
    expect($selectedPageId.get()).toBe($pages.get()?.homePageId);
    expect(setBuilderMode).not.toHaveBeenCalled();
  });

  test("blocks left unbound are named in one error", async () => {
    vi.mocked(applySiteTemplate).mockImplementation(async (template) => ({
      ...applied(template),
      unboundBlocks: ["Event List", "Event Card", "Event List"],
    }));
    render();
    await choose("union");
    expect(dialog()).toBeNull();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Not linked to your organization's data: Event List, Event Card. Contact OrganizeOS support to restore the link."
    );
    expect(setBuilderMode).toHaveBeenCalledWith("content");
  });

  test("a refused apply says the site has content", async () => {
    vi.mocked(applySiteTemplate).mockResolvedValue({
      status: "refused",
      reason: "touched",
    });
    render();
    await choose("union");
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("This site already has content.");
    expect(setBuilderMode).not.toHaveBeenCalled();
  });

  test("a rejected apply shows an error and keeps the dialog open", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const failure = new Error("render failed");
    vi.mocked(applySiteTemplate).mockRejectedValue(failure);
    render();
    await choose("union");
    expect(consoleError).toHaveBeenCalledWith(failure);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Cannot apply union name.");
    expect(dialog()).not.toBeNull();
    expect(card("union")?.disabled).toBe(false);
    expect(startBlankButton()?.disabled).toBe(false);
    expect(setBuilderMode).not.toHaveBeenCalled();
  });

  test("cards are disabled while applying", async () => {
    let finish: (result: ApplyResult) => void = () => {};
    vi.mocked(applySiteTemplate).mockImplementation(
      (template) =>
        new Promise((resolve) => {
          finish = () => resolve(applied(template));
        })
    );
    render();
    await choose("union");
    expect(card("union")?.disabled).toBe(true);
    expect(card("nonprofit")?.disabled).toBe(true);
    expect(startBlankButton()?.disabled).toBe(true);

    await act(async () => {
      card("nonprofit")?.click();
    });
    expect(applySiteTemplate).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({ status: "applied", unboundBlocks: [] });
    });
    await settle();
    expect(dialog()).toBeNull();
    expect(setBuilderMode).toHaveBeenCalledWith("content");
  });
});
