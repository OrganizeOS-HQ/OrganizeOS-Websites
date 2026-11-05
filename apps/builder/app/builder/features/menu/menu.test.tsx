import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import {
  $authPermit,
  $builderMode,
  $organizeosSite,
} from "~/shared/nano-states";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { sourceCodeLabel, sourceCodeUrl } from "~/shared/branding";
import { Menu } from "./menu";

// The builder menu's OrganizeOS wiring: the AGPL section 13 source offer, the
// way back to OrganizeOS, and what an org site's menu leaves out. Rendered, so
// an upstream merge that drops a line fails here.

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const site: OrganizeosSite = {
  organizationId: "org-1",
  subdomain: "acme",
  manageUrl: "https://app.organizeos.org/acme/website",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

let root: Root | undefined;
let container: HTMLElement | undefined;

const renderMenu = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(Menu, { defaultOpen: true })
      )
    );
  });
};

// The content is portalled to the document's body
const items = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'));

// an item's own text, without its shortcut, which differs by platform
const labelOf = (element: HTMLElement) => {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const shortcut of copy.querySelectorAll("kbd")) {
    shortcut.remove();
  }
  return copy.textContent?.trim() ?? "";
};

const labels = () => items().map(labelOf);

const item = (label: string) =>
  items().find((element) => labelOf(element) === label);

beforeEach(() => {
  $authPermit.set("own");
  $builderMode.set("design");
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  $organizeosSite.set(undefined);
  vi.restoreAllMocks();
});

describe("the builder menu", () => {
  test.each([
    ["an OrganizeOS site", site],
    ["a project no org owns", undefined],
  ])(
    "the builder menu renders the source offer (sourceCodeUrl), for %s",
    async (_name, organizeosSite) => {
      $organizeosSite.set(organizeosSite);
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      renderMenu();
      const offer = item(sourceCodeLabel);
      expect(offer).toBeDefined();
      await act(async () => {
        await userEvent.click(offer!);
      });
      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(sourceCodeUrl, "_blank", "noreferrer");
    }
  );

  test("Back to OrganizeOS for an OrganizeOS site, and Dashboard otherwise", () => {
    $organizeosSite.set(site);
    renderMenu();
    expect(item("Back to OrganizeOS")).toBeDefined();
    expect(item("Dashboard")).toBeUndefined();
    act(() => {
      root?.unmount();
    });
    container?.remove();

    $organizeosSite.set(undefined);
    renderMenu();
    expect(item("Dashboard")).toBeDefined();
    expect(item("Back to OrganizeOS")).toBeUndefined();
  });

  test("an OrganizeOS site's menu offers no Share, Export, Clone, Help or upgrade", () => {
    $organizeosSite.set(site);
    renderMenu();
    expect(labels()).toEqual([
      "Back to OrganizeOS",
      "Project settings",
      "Breakpoints",
      "View",
      "Undo",
      "Redo",
      "Delete",
      "Save",
      "Preview",
      "Publish",
      "Search & commands",
      "Keyboard shortcuts",
      "Source code",
    ]);
  });

  test("a project no org owns keeps Share, Export and Clone, and still no Help or upgrade", () => {
    renderMenu();
    expect(labels()).toEqual([
      "Dashboard",
      "Project settings",
      "Breakpoints",
      "View",
      "Undo",
      "Redo",
      "Delete",
      "Save",
      "Preview",
      "Share",
      "Publish",
      "Export",
      "Clone",
      "Search & commands",
      "Keyboard shortcuts",
      "Source code",
    ]);
  });

  test("View offers Theme, upstream's colour scheme menu", async () => {
    $organizeosSite.set(site);
    renderMenu();
    const view = item("View");
    expect(view).toBeDefined();
    await act(async () => {
      await userEvent.click(view!);
    });
    expect(item("Theme")).toBeDefined();
  });
});
