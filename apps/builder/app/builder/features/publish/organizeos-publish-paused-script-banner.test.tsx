import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import { MenuIcon } from "@webstudio-is/icons/svg";
import type { Instance, Prop } from "@webstudio-is/sdk";
import { $instances, $pages, $props } from "~/shared/sync/data-stores";
import { $editingPageId, $selectedPageId } from "~/shared/nano-states";
import { $openProjectSettings } from "~/shared/nano-states/project-settings";
import { PausedScriptBanner } from "./organizeos-publish";

// Which sidebar panel shows depends on the builder having loaded, so the
// call that opens the Pages panel is what the banner is held to
const { setActiveSidebarPanel } = vi.hoisted(() => ({
  setActiveSidebarPanel: vi.fn(),
}));
vi.mock("~/builder/shared/nano-states", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/builder/shared/nano-states")>()),
  setActiveSidebarPanel,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

const setBuild = ({
  code,
  customCode,
}: {
  code: string;
  customCode?: string;
}) => {
  const pages = createDefaultPages({ rootInstanceId: "root" });
  pages.meta = customCode === undefined ? undefined : { code: customCode };
  $pages.set(pages);
  const instances: Instance[] = [
    {
      type: "instance",
      id: "root",
      component: "Body",
      children: [{ type: "id", value: "embed" }],
    },
    { type: "instance", id: "embed", component: "HtmlEmbed", children: [] },
  ];
  $instances.set(new Map(instances.map((instance) => [instance.id, instance])));
  const prop: Prop = {
    id: "code",
    instanceId: "embed",
    name: "code",
    type: "string",
    value: code,
  };
  $props.set(new Map([[prop.id, prop]]));
};

const renderBanner = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(PausedScriptBanner));
  });
  return container;
};

beforeEach(() => {
  $openProjectSettings.set(undefined);
  $selectedPageId.set(undefined);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("PausedScriptBanner", () => {
  test("lists what is paused, and says why and that it is kept", () => {
    setBuild({ code: "<script>1</script>", customCode: "<style>x{}</style>" });
    const host = renderBanner();
    const items = Array.from(host.querySelectorAll("li")).map(
      (item) => item.textContent
    );
    expect(items).toEqual([
      "HTML Embed on Home",
      "Custom code (Project settings)",
    ]);
    expect(host.textContent).toContain(
      "Scripts on your site could read the OrganizeOS sign-in of people who visit, so these stay off while we make it safe. What you saved is kept."
    );
  });

  test("opens Project settings from the custom code item", () => {
    setBuild({ code: MenuIcon, customCode: "<style>x{}</style>" });
    const host = renderBanner();
    const button = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent === "Custom code (Project settings)"
    );
    act(() => {
      button?.click();
    });
    expect($openProjectSettings.get()).toBe("general");
  });

  test("shows nothing for template icons alone", () => {
    setBuild({ code: MenuIcon });
    const host = renderBanner();
    expect(host.textContent).toBe("");
  });

  const clickItem = (host: HTMLElement, label: string) => {
    const button = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent === label
    );
    expect(button, label).toBeDefined();
    act(() => {
      button?.click();
    });
  };

  test("opens the page's settings from a page redirect item", () => {
    setBuild({ code: MenuIcon });
    const pages = $pages.get();
    const home = pages?.pages.get(pages.homePageId);
    if (pages === undefined || home === undefined) {
      throw new Error("no home page");
    }
    home.meta = { ...home.meta, redirect: '"javascript:alert(1)"' };
    $pages.set({ ...pages });
    $editingPageId.set(undefined);
    setActiveSidebarPanel.mockClear();

    clickItem(renderBanner(), "Redirect on Home");

    expect($selectedPageId.get()).toBe(home.id);
    expect($editingPageId.get()).toBe(home.id);
    expect(setActiveSidebarPanel).toHaveBeenCalledWith("pages");
    expect($openProjectSettings.get()).toBeUndefined();
  });

  test("opens Redirects from a project redirect item", () => {
    setBuild({ code: MenuIcon });
    const pages = $pages.get();
    if (pages === undefined) {
      throw new Error("no pages");
    }
    $pages.set({
      ...pages,
      redirects: [{ old: "/go", new: "javascript:alert(1)" }],
    });
    setActiveSidebarPanel.mockClear();

    clickItem(renderBanner(), "Redirect from /go (Project settings)");

    expect($openProjectSettings.get()).toBe("redirects");
    expect(setActiveSidebarPanel).not.toHaveBeenCalled();
  });
});
