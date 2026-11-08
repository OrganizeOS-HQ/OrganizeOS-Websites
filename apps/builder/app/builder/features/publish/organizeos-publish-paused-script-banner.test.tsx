import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import { MenuIcon } from "@webstudio-is/icons/svg";
import type { Instance, Prop } from "@webstudio-is/sdk";
import {
  $dataSources,
  $instances,
  $pages,
  $projectSettings,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
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
  legacyCustomCode,
}: {
  code: string;
  /** where 0.309.0 saves it */
  customCode?: string;
  /** the pages' meta, where builds saved it before 0.309.0 */
  legacyCustomCode?: string;
}) => {
  const pages = createDefaultPages({ rootInstanceId: "root" });
  pages.meta =
    legacyCustomCode === undefined ? undefined : { code: legacyCustomCode };
  $pages.set(pages);
  $projectSettings.set({
    meta: customCode === undefined ? {} : { code: customCode },
    compiler: {},
  });
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
  $dataSources.set(new Map());
  $resources.set(new Map());
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
  // What the dialog reads is the build's, its data sources included: a
  // template's action, a variable set to the component's argument, is not
  // listed, and an action that may not run is
  test("lists an action that may not run, and not one a template writes", () => {
    setBuild({ code: MenuIcon });
    const action = (
      instanceId: string,
      name: string,
      args: string[],
      code: string
    ): [string, Prop] => [
      `${instanceId}-${name}`,
      {
        id: `${instanceId}-${name}`,
        instanceId,
        name,
        type: "action",
        value: [{ type: "execute", args, code }],
      },
    ];
    $instances.set(
      new Map([
        ...$instances.get(),
        [
          "root",
          {
            type: "instance",
            id: "root",
            component: "Body",
            children: [
              { type: "id", value: "embed" },
              { type: "id", value: "signup" },
              { type: "id", value: "button" },
            ],
          },
        ],
        [
          "signup",
          {
            type: "instance",
            id: "signup",
            component: "@organizeos/site-components:SignupForm",
            children: [],
          },
        ],
        [
          "button",
          {
            type: "instance",
            id: "button",
            component: "ws:element",
            tag: "button",
            children: [],
          },
        ],
      ])
    );
    $props.set(
      new Map([
        ...$props.get(),
        action(
          "signup",
          "onStateChange",
          ["state"],
          "$ws$dataSource$formState = state"
        ),
        action(
          "button",
          "onClick",
          ["event"],
          "$ws$dataSource$formState = event"
        ),
      ])
    );
    $dataSources.set(
      new Map([
        [
          "formState",
          {
            type: "variable",
            id: "formState",
            name: "formState",
            scopeInstanceId: "signup",
            value: { type: "string", value: "initial" },
          },
        ],
        // a variable whose id is a Resource's
        [
          "taken",
          {
            type: "variable",
            id: "taken",
            name: "taken",
            scopeInstanceId: "button",
            value: { type: "string", value: "" },
          },
        ],
      ])
    );
    $resources.set(
      new Map([
        [
          "taken",
          {
            id: "taken",
            name: "taken",
            method: "get",
            url: '"https://example.org"',
            headers: [],
          },
        ],
      ])
    );
    // and an instance of a component the page does not import
    $instances.set(
      new Map([
        ...$instances.get(),
        [
          "root",
          {
            ...($instances.get().get("root") as Instance),
            children: [
              ...($instances.get().get("root") as Instance).children,
              { type: "id", value: "unknown" },
            ],
          },
        ],
        [
          "unknown",
          {
            type: "instance",
            id: "unknown",
            component: "x:script",
            children: [],
          },
        ],
      ])
    );
    const host = renderBanner();
    expect(
      Array.from(host.querySelectorAll("li"), (item) => item.textContent)
    ).toEqual([
      "Action (onClick) on Home",
      "Variable (taken) on Home",
      "Unknown component on Home",
    ]);
  });

  test("lists what is paused under its heading, and nothing more", () => {
    setBuild({ code: "<script>1</script>", customCode: "<style>x{}</style>" });
    const host = renderBanner();
    const items = Array.from(host.querySelectorAll("li")).map(
      (item) => item.textContent
    );
    expect(items).toEqual([
      "HTML Embed on Home",
      "Custom code (Project settings)",
    ]);
    // the heading and the list: no explanation
    const list = host.querySelector("ul");
    expect(list?.previousElementSibling?.textContent).toBe(
      "Paused, not published"
    );
    expect(list?.previousElementSibling?.previousElementSibling).toBeNull();
    expect(list?.nextElementSibling).toBeNull();
  });

  test("names an element publishing drops for its tag, a script among them, as one with an unsupported tag", () => {
    setBuild({ code: MenuIcon });
    $instances.set(
      new Map([
        ...$instances.get(),
        [
          "root",
          {
            type: "instance",
            id: "root",
            component: "Body",
            children: [
              { type: "id", value: "embed" },
              { type: "id", value: "custom" },
            ],
          },
        ],
        [
          "custom",
          {
            type: "instance",
            id: "custom",
            component: "ws:element",
            tag: "script",
            children: [],
          },
        ],
      ])
    );
    const host = renderBanner();
    expect(
      Array.from(host.querySelectorAll("li"), (item) => item.textContent)
    ).toEqual(["Element with an unsupported tag on Home"]);
  });

  test("lists the custom code a build kept in its pages' meta", () => {
    setBuild({ code: MenuIcon, legacyCustomCode: "<style>x{}</style>" });
    const host = renderBanner();
    expect(
      Array.from(host.querySelectorAll("li"), (item) => item.textContent)
    ).toEqual(["Custom code (Project settings)"]);
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
