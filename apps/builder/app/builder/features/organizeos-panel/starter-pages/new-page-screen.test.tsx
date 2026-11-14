import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Page, WebstudioData } from "@webstudio-is/sdk";
import {
  getInitialPageSettingsMeta,
  pageSettingsDefaultValues,
} from "@webstudio-is/project-build/runtime";
import { BLANK_CANONICAL_VALUES } from "@organizeos/site-components/site-templates";
import type { StarterPage } from "@organizeos/site-components/starter-pages";
import { createPages } from "../../../../../../../packages/project-build/src/template";
import { sampleStarterPage } from "../../../../../../../packages/sdk-components-organizeos/src/starter-pages/__fixtures__/sample";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $projectSettings,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import { $authPermit, $organizeosSite } from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $builderMode } from "~/shared/nano-states/misc";
import { $dataLoadingState } from "~/builder/shared/nano-states";
import { executeRuntimeMutation } from "~/shared/instance-utils/data";
import { writeCanonicalVariablesMutable } from "../site-templates/apply-site-template";
import {
  $isTemplatesScreenOffered,
  $showTemplateDrafts,
} from "../site-templates/templates-screen-state";
import { insertStarterPage } from "./insert-starter-page";
import { $newPageScreenOpen } from "./new-page-screen-state";
import { NewPageScreen, pathProblem } from "./new-page-screen";

// The catalog is empty until page templates are written; the tests fill it.
const { catalog, toastError } = vi.hoisted(() => ({
  catalog: [] as StarterPage[],
  toastError: vi.fn(),
}));
vi.mock(
  "@organizeos/site-components/starter-pages",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@organizeos/site-components/starter-pages")
    >()),
    STARTER_PAGES: catalog,
  })
);
// Spied, not replaced (a factory importing the original waits on itself in
// the browser runner); each test sets what the spies do.
vi.mock("./insert-starter-page", { spy: true });
vi.mock("~/shared/instance-utils/data", { spy: true });
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError } },
}));

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Every ResizeObserver made; none calls back (as templates-screen.test.tsx).
class SilentResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let boundary: HTMLElement;
const setBoundary = (width: number, height: number) => {
  boundary.style.width = `${width}px`;
  boundary.style.height = `${height}px`;
};

const SignupForm = "@organizeos/site-components:SignupForm" as const;

const entry = (
  id: string,
  path: string,
  status: StarterPage["status"],
  blocks: StarterPage["blocks"] = []
): StarterPage => ({
  ...sampleStarterPage,
  id,
  name: `${id} card`,
  pageName: `${id} page`,
  path,
  status,
  blocks,
});

const events = entry("events", "/events", "listed");
const give = entry("give", "/give", "listed");
const volunteer = entry("volunteer", "/volunteer", "listed", [SignupForm]);
const draft = entry("draft", "/draft", "draft");

const setCatalog = (pages: StarterPage[]) => {
  catalog.splice(0, catalog.length, ...pages);
};

const addPage = (data: WebstudioData, id: string, path: string) => {
  const page: Page = {
    id,
    name: id,
    path,
    title: `"${id}"`,
    meta: {},
    rootInstanceId: `${id}-body`,
  };
  data.instances.set(page.rootInstanceId, {
    type: "instance",
    id: page.rootInstanceId,
    component: "ws:element",
    tag: "body",
    children: [],
  });
  data.pages.pages.set(id, page);
  data.pages.folders.get(data.pages.rootFolderId)?.children.push(id);
};

/**
 * A project with the canonical variables (so the Templates screen is not
 * offered), and pages at /events and /give.
 */
const setProject = () => {
  const data = createPages();
  writeCanonicalVariablesMutable(data, BLANK_CANONICAL_VALUES, "overwrite");
  addPage(data, "events-page", "/events");
  addPage(data, "give-page", "/give");
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
  $projectSettings.set({ meta: {}, compiler: {} });
  $selectedPageId.set(data.pages.homePageId);
  serverSyncStore.transactionManager.currentStack = [];
  serverSyncStore.transactionManager.undoneStack = [];
};

let root: Root | undefined;
let container: HTMLElement | undefined;

const render = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(NewPageScreen))
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

const open = async () => {
  await act(async () => {
    $newPageScreenOpen.set(true);
  });
  await settle();
};

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const cards = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-starter-page]")
  );

const cardIds = () => cards().map((card) => card.dataset.starterPage);

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-starter-page="${id}"]`);

const field = (label: string) => {
  const element = Array.from(dialog()?.querySelectorAll("label") ?? []).find(
    (item) => item.textContent === label
  );
  return document.getElementById(
    element?.htmlFor ?? ""
  ) as HTMLInputElement | null;
};

const createButton = () =>
  Array.from(dialog()?.querySelectorAll("button") ?? []).find((button) =>
    button.textContent?.includes("Create page")
  );

const backButton = () =>
  dialog()?.querySelector<HTMLButtonElement>('[aria-label="Back"]');

const warning = () =>
  dialog()?.querySelector('[role="alert"]')?.textContent ?? undefined;

const isDisabled = (element: Element | null | undefined) =>
  element?.matches(":disabled") ?? false;

const setValue = async (input: HTMLInputElement | null, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const clickCard = async (id: string) => {
  await act(async () => {
    card(id)?.click();
  });
  await settle();
};

const pressEscape = async () => {
  act(() => {
    // cancelable, as a real key press is: the screen prevents a dismissal
    (document.activeElement ?? dialog())?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      })
    );
  });
  await settle();
};

const submit = async () => {
  await act(async () => {
    dialog()?.querySelector("form")?.requestSubmit();
  });
  await settle();
};

const pagesAt = (path: string) =>
  [...($pages.get()?.pages.values() ?? [])].filter(
    (page) => page.path === path
  );

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", SilentResizeObserver);
  boundary = document.createElement("div");
  boundary.setAttribute("data-dialog-boundary", "");
  boundary.style.position = "fixed";
  boundary.style.left = "0";
  boundary.style.top = "40px";
  setBoundary(1240, 840);
  document.body.appendChild(boundary);
  setCatalog([events, give]);
  setProject();
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.organizeos.org/dashboard",
    platformUrl: "https://app.organizeos.org",
    blocksEnabled: true,
  });
  $authPermit.set("own");
  $builderMode.set("design");
  $dataLoadingState.set("loaded");
  $showTemplateDrafts.set(false);
  $newPageScreenOpen.set(false);
  vi.mocked(insertStarterPage).mockReset();
  vi.mocked(insertStarterPage).mockImplementation(async () => ({
    status: "added",
    pageId: "added-page",
    unboundBlocks: [],
  }));
  toastError.mockClear();
});

afterEach(() => {
  unmount();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("opening", () => {
  test("opens from the menu flag only in Design mode", async () => {
    render();
    expect(dialog()).toBeNull();
    await open();
    expect(dialog()).not.toBeNull();
    expect(dialog()?.textContent).toContain("New page");

    await act(async () => {
      $newPageScreenOpen.set(false);
      $builderMode.set("content");
    });
    await open();
    expect(dialog()).toBeNull();
    expect($newPageScreenOpen.get()).toBe(false);
  });

  test("does not open before the pages load", async () => {
    $pages.set(undefined);
    render();
    await open();
    expect(dialog()).toBeNull();
    expect($newPageScreenOpen.get()).toBe(false);
  });

  test("closes when Design mode ends and opens fresh", async () => {
    render();
    await open();
    await clickCard("events");
    expect(field("Name")).not.toBeNull();

    await act(async () => {
      $builderMode.set("content");
    });
    await settle();
    expect(dialog()).toBeNull();
    expect($newPageScreenOpen.get()).toBe(false);

    await act(async () => {
      $builderMode.set("design");
    });
    await open();
    expect(cardIds()).toEqual(["blank", "events", "give"]);
  });

  test("closes when the Templates screen is offered, and opens fresh", async () => {
    render();
    await open();
    await clickCard("events");
    expect(field("Name")).not.toBeNull();

    // another admin undoes everything: the project is untouched again, with
    // none of the canonical variables, so the Templates screen is offered
    await act(async () => {
      const untouched = createPages();
      $pages.set(untouched.pages);
      $instances.set(untouched.instances);
      $props.set(untouched.props);
      $styleSourceSelections.set(untouched.styleSourceSelections);
      $styleSources.set(untouched.styleSources);
      $styles.set(untouched.styles);
      $assets.set(untouched.assets);
    });
    await settle();
    expect($isTemplatesScreenOffered.get()).toBe(true);
    expect(dialog()).toBeNull();
    expect($newPageScreenOpen.get()).toBe(false);

    await act(async () => {
      setProject();
    });
    await open();
    expect(cardIds()).toEqual(["blank", "events", "give"]);
  });

  test("with only Blank, opens straight into Blank's create view, compact", async () => {
    setCatalog([]);
    render();
    await open();
    expect(cards()).toEqual([]);
    expect(backButton()).toBeNull();
    expect(field("Name")?.value).toBe("Untitled");
    expect(dialog()?.style.width).toBe("448px");
    expect(dialog()?.style.height).toBe("320px");
    expect(document.activeElement).toBe(field("Name"));

    await pressEscape();
    expect(dialog()).toBeNull();
    expect($newPageScreenOpen.get()).toBe(false);
  });

  test("is 880 by 640, capped to the boundary, with page templates offered", async () => {
    render();
    await open();
    expect(dialog()?.style.width).toBe("880px");
    expect(dialog()?.style.height).toBe("640px");
    unmount();

    setBoundary(600, 500);
    render();
    await settle();
    expect(dialog()?.style.width).toBe("560px");
    expect(dialog()?.style.height).toBe("460px");
  });
});

describe("the grid", () => {
  test("offers Blank first, then the listed page templates", async () => {
    setCatalog([events, draft, give]);
    render();
    await open();
    expect(cardIds()).toEqual(["blank", "events", "give"]);
    expect(card("blank")?.textContent).toBe("Blank");
    expect(card("events")?.textContent).toBe("events card");
    expect(card("events")?.querySelector("img")?.getAttribute("src")).toBe(
      sampleStarterPage.images[sampleStarterPage.picture].url
    );
  });

  test("offers drafts with templateDrafts=1", async () => {
    setCatalog([events, draft, give]);
    $showTemplateDrafts.set(true);
    render();
    await open();
    expect(cardIds()).toEqual(["blank", "events", "give", "draft"]);
  });

  test("hides block-placing page templates from a deny-listed org", async () => {
    setCatalog([events, volunteer]);
    render();
    await open();
    expect(cardIds()).toEqual(["blank", "events", "volunteer"]);
    unmount();

    for (const site of [
      undefined,
      {
        organizationId: "org-1",
        manageUrl: "https://app.organizeos.org/dashboard",
        platformUrl: "https://app.organizeos.org",
        blocksEnabled: false,
      },
    ]) {
      $organizeosSite.set(site);
      $newPageScreenOpen.set(false);
      render();
      await open();
      expect(cardIds()).toEqual(["blank", "events"]);
      unmount();
    }
  });
});

describe("the create view", () => {
  test("a card opens its create view, focusing Name", async () => {
    render();
    await open();
    await clickCard("events");
    expect(cards()).toEqual([]);
    expect(dialog()?.textContent).toContain("events card");
    expect(field("Name")?.value).toBe("events page");
    expect(document.activeElement).toBe(field("Name"));

    await pressEscape();
    expect(field("Name")).toBeNull();
    expect(document.activeElement).toBe(card("events"));

    await pressEscape();
    expect(dialog()).toBeNull();
    expect($newPageScreenOpen.get()).toBe(false);
  });

  test("Back returns to the grid", async () => {
    render();
    await open();
    await clickCard("give");
    await act(async () => {
      backButton()?.click();
    });
    await settle();
    expect(cardIds()).toEqual(["blank", "events", "give"]);
    expect(document.activeElement).toBe(card("give"));
  });

  test("prefills a taken /events as /events1 and a taken /give as /give1", async () => {
    render();
    await open();
    await clickCard("events");
    expect(field("Path")?.value).toBe("/events1");
    await pressEscape();
    await clickCard("give");
    expect(field("Path")?.value).toBe("/give1");
  });

  test("a free default path is prefilled as it is", async () => {
    setCatalog([entry("about", "/about", "listed")]);
    render();
    await open();
    await clickCard("about");
    expect(field("Path")?.value).toBe("/about");
  });

  test("Blank's path follows its name until edited", async () => {
    render();
    await open();
    await clickCard("blank");
    expect(field("Path")?.value).toBe("/untitled");
    await setValue(field("Name"), "Our team");
    expect(field("Path")?.value).toBe("/our-team");
    await setValue(field("Path"), "/people");
    await setValue(field("Name"), "Our people");
    expect(field("Path")?.value).toBe("/people");
  });

  test("a page template's path does not follow its name", async () => {
    setCatalog([entry("about", "/about", "listed")]);
    render();
    await open();
    await clickCard("about");
    await setValue(field("Name"), "Who we are");
    expect(field("Path")?.value).toBe("/about");
  });

  test("shows one warning, and disables Create page, for each path problem", async () => {
    render();
    await open();
    await clickCard("blank");
    expect(warning()).toBeUndefined();
    expect(isDisabled(createButton())).toBe(false);
    for (const [path, message] of [
      ["/events", "Another page uses this path"],
      ["/join", "The platform uses this path"],
      ["/a//b", "Can't contain repeating /"],
    ]) {
      await setValue(field("Path"), path);
      expect(warning(), path).toBe(message);
      expect(dialog()?.querySelectorAll('[role="alert"]')).toHaveLength(1);
      expect(isDisabled(createButton()), path).toBe(true);
      expect(field("Path")?.getAttribute("aria-invalid")).toBe("true");
    }
  });

  test("an empty name disables Create page", async () => {
    render();
    await open();
    await clickCard("blank");
    for (const name of ["", "   "]) {
      await setValue(field("Name"), name);
      await setValue(field("Path"), "/somewhere");
      expect(isDisabled(createButton()), JSON.stringify(name)).toBe(true);
      await submit();
      expect(pagesAt("/somewhere")).toEqual([]);
    }
  });

  test("builder shortcuts do not fire behind it", async () => {
    const listener = vi.fn();
    document.addEventListener("keydown", listener);
    render();
    await open();
    await clickCard("blank");
    act(() => {
      field("Name")?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", bubbles: true })
      );
    });
    document.removeEventListener("keydown", listener);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("creating", () => {
  test("Blank creates the page with upstream's defaults, its name as title, then selects it", async () => {
    render();
    await open();
    await clickCard("blank");
    await setValue(field("Name"), "About");
    await submit();

    expect(dialog()).toBeNull();
    expect($newPageScreenOpen.get()).toBe(false);
    const [created] = pagesAt("/about");
    expect(created).toBeDefined();
    expect($selectedPageId.get()).toBe(created.id);
    expect(created.title).toBe(`"About"`);

    // the same two runtime operations today's New page form runs
    const values = {
      ...pageSettingsDefaultValues,
      parentFolderId: $pages.get()!.rootFolderId,
      name: "Twin",
      path: "/twin",
      title: `"Twin"`,
    };
    const twin = executeRuntimeMutation({
      id: "pages.create",
      input: {
        name: values.name,
        path: values.path,
        title: values.title,
        parentFolderId: values.parentFolderId,
        meta: getInitialPageSettingsMeta(values),
      },
    });
    const twinId = twin?.result.pageId as string;
    executeRuntimeMutation({
      id: "pages.updateSettings",
      input: { pageId: twinId, values },
    });
    const stored = $pages.get()!.pages.get(twinId)!;
    const omit = ({
      id: _id,
      name: _name,
      path: _path,
      title: _title,
      rootInstanceId: _root,
      ...rest
    }: Page) => rest;
    expect(omit(created)).toEqual(omit(stored));
    expect(created.meta.excludePageFromSearch).toBe(
      stored.meta.excludePageFromSearch
    );
  });

  test("stores a trimmed name", async () => {
    render();
    await open();
    await clickCard("blank");
    await setValue(field("Name"), "  About  ");
    await setValue(field("Path"), "/about");
    await submit();
    const [created] = pagesAt("/about");
    expect(created.name).toBe("About");
    expect(created.title).toBe(`"About"`);
  });

  test("Blank toasts and stays open when the create throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(executeRuntimeMutation).mockImplementationOnce(() => {
      throw new Error('Page path "/untitled" is already in use');
    });
    render();
    await open();
    await clickCard("blank");
    await submit();
    expect(toastError).toHaveBeenCalledWith("Cannot create the page.");
    expect(field("Name")).not.toBeNull();
  });

  test("Blank selects and closes when the page is made but its settings fail", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const actual = await vi.importActual<
      typeof import("~/shared/instance-utils/data")
    >("~/shared/instance-utils/data");
    vi.mocked(executeRuntimeMutation).mockImplementation(((
      mutation: Parameters<typeof executeRuntimeMutation>[0]
    ) => {
      if (mutation.id === "pages.updateSettings") {
        throw new Error("settings refused");
      }
      return actual.executeRuntimeMutation(mutation);
    }) as typeof executeRuntimeMutation);
    render();
    await open();
    await clickCard("blank");
    await setValue(field("Name"), "About");
    await submit();

    const [created] = pagesAt("/about");
    expect(created).toBeDefined();
    expect($selectedPageId.get()).toBe(created.id);
    expect(dialog()).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  test("Create page creates one page however often it is pressed", async () => {
    render();
    await open();
    await clickCard("blank");
    await setValue(field("Path"), "/once");
    const form = dialog()?.querySelector("form");
    const button = createButton();
    await act(async () => {
      form?.requestSubmit();
      button?.click();
      button?.click();
    });
    await settle();
    expect(pagesAt("/once")).toHaveLength(1);

    await open();
    await clickCard("events");
    const templateForm = dialog()?.querySelector("form");
    const templateButton = createButton();
    await act(async () => {
      templateForm?.requestSubmit();
      templateButton?.click();
      templateButton?.click();
    });
    await settle();
    expect(insertStarterPage).toHaveBeenCalledTimes(1);
  });

  test("a page template is added with the fields, and the screen closes", async () => {
    render();
    await open();
    await clickCard("events");
    await setValue(field("Name"), " Our events ");
    await submit();
    expect(insertStarterPage).toHaveBeenCalledWith(events, {
      name: "Our events",
      path: "/events1",
    });
    expect(dialog()).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  test("an added page template toasts its unbound blocks", async () => {
    vi.mocked(insertStarterPage).mockImplementation(async () => ({
      status: "added",
      pageId: "added-page",
      unboundBlocks: ["Signup Form"],
    }));
    render();
    await open();
    await clickCard("events");
    await submit();
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining(
        "Not linked to your organization's data: Signup Form."
      )
    );
    expect(dialog()).toBeNull();
  });

  test.each([
    [{ reason: "invalid" as const }, "This path cannot be used."],
    [{ reason: "path-taken" as const }, "Another page uses this path."],
    [{ reason: "platform-path" as const }, "The platform uses this path."],
    [{ reason: "resources" as const }, "This page template cannot be added."],
    [{ reason: "no-project" as const }, "This page template cannot be added."],
    [
      { reason: "runtime" as const, message: "The runtime says no." },
      "The runtime says no.",
    ],
  ])(
    "a page template's refusal toasts and keeps the screen open: %o",
    async (refusal, message) => {
      vi.mocked(insertStarterPage).mockImplementation(async () => ({
        status: "refused",
        ...refusal,
      }));
      render();
      await open();
      await clickCard("events");
      await submit();
      expect(toastError).toHaveBeenCalledWith(message);
      expect(field("Name")).not.toBeNull();
      expect(isDisabled(createButton())).toBe(false);
    }
  );

  test("an error adding a page template toasts and keeps the screen open", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(insertStarterPage).mockRejectedValue(new Error("boom"));
    render();
    await open();
    await clickCard("events");
    await submit();
    expect(toastError).toHaveBeenCalledWith("Cannot add events card.");
    expect(field("Name")).not.toBeNull();
  });

  test("closing is ignored while a page template is being added", async () => {
    let finish: (
      value: Awaited<ReturnType<typeof insertStarterPage>>
    ) => void = () => {};
    vi.mocked(insertStarterPage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    render();
    await open();
    await clickCard("events");
    await submit();
    expect(isDisabled(field("Name"))).toBe(true);

    await pressEscape();
    await act(async () => {
      backButton()?.click();
      dialog()
        ?.querySelector<HTMLButtonElement>('[aria-label="Close"]')
        ?.click();
    });
    await settle();
    expect(field("Name")).not.toBeNull();
    expect($newPageScreenOpen.get()).toBe(true);

    await act(async () => {
      finish({ status: "added", pageId: "added-page", unboundBlocks: [] });
    });
    await settle();
    expect(dialog()).toBeNull();
  });
});

describe("pathProblem", () => {
  test("names the first problem, in order", () => {
    setProject();
    const pages = $pages.get()!;
    expect(pathProblem(pages, "")).toBe("Can't be empty");
    expect(pathProblem(pages, "/events")).toBe("Another page uses this path");
    expect(pathProblem(pages, "/donate")).toBe("The platform uses this path");
    expect(pathProblem(pages, "/new")).toBeUndefined();
  });
});
