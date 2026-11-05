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
import { $builderMode } from "~/shared/nano-states/misc";
import { $dataLoadingState } from "~/builder/shared/nano-states";
import { updateWebstudioDataStaged } from "../staged-data";
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
  fonts: {},
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

const applied = async (template: SiteTemplate): Promise<ApplyResult> => {
  await updateWebstudioDataStaged((data) => {
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
  $builderMode.set("design");
  $planFeatures.set({ ...defaultPlanFeatures, allowContentMode: true });
  $dataLoadingState.set("loaded");
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

  test("not offered once Global Root declares a canonical variable", async () => {
    render();
    expect(dialog()).not.toBeNull();
    await act(async () => {
      await updateWebstudioDataStaged((data) => {
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
    expect($isTemplateChooserOffered.get()).toBe(false);
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
    expect($isTemplateChooserOffered.get()).toBe(true);
    expect(dialog()).not.toBeNull();
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
    // a builder, not the owner: 0.309.0 always allows the owner content mode
    $authPermit.set("build");
    $planFeatures.set({ ...defaultPlanFeatures, allowContentMode: false });
    render();
    await choose("union");
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
    await choose("union");
    expect(dialog()).toBeNull();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Not linked to your organization's data: Event List, Event Card. Contact OrganizeOS support to restore the link."
    );
    expect(setBuilderMode).toHaveBeenCalledWith("content");
  });

  test.each([
    { reason: "touched", message: "This site already has content." },
    {
      reason: "path-taken",
      message: "This template's pages clash with pages this site already has.",
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
      await choose("union");
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith(message);
      expect(setBuilderMode).not.toHaveBeenCalled();
    }
  );

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
