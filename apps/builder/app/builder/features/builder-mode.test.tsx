import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { userEvent } from "@vitest/browser/context";
import { afterEach, expect, test, vi } from "vitest";
import { TooltipProvider, toast } from "@webstudio-is/design-system";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import {
  $authPermit,
  $builderMode,
  $planFeatures,
  setBuilderMode,
} from "~/shared/nano-states";
import { planBadgeLabel } from "~/shared/branding";
import { BuilderModeDropDown } from "./builder-mode";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  $authPermit.set("view");
  $planFeatures.set(defaultPlanFeatures);
});

const openModeMenu = async () => {
  $builderMode.set("design");
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <TooltipProvider>
        <BuilderModeDropDown />
      </TooltipProvider>
    )
  );
  await act(async () =>
    userEvent.click(
      container.querySelector('button[aria-label="Choose mode"]')!
    )
  );
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
  ).find((item) => item.textContent?.includes("Content"));
};

test("shows the Content shortcut for an owned free project", async () => {
  $authPermit.set("own");
  $planFeatures.set(defaultPlanFeatures);

  const contentItem = await openModeMenu();

  expect(contentItem).toBeDefined();
  expect(contentItem?.hasAttribute("data-disabled")).toBe(false);
  // OrganizeOS fork: the plan badge is planBadgeLabel
  expect(contentItem?.textContent).not.toContain(planBadgeLabel);
  expect(contentItem?.querySelector("kbd")).not.toBeNull();
});

test("shows the shortcut without the plan badge when Content is allowed", async () => {
  $authPermit.set("own");
  $planFeatures.set({ ...defaultPlanFeatures, allowContentMode: true });

  const contentItem = await openModeMenu();

  expect(contentItem).toBeDefined();
  expect(contentItem?.hasAttribute("data-disabled")).toBe(false);
  expect(contentItem?.querySelector("kbd")).not.toBeNull();
  expect(contentItem?.textContent).not.toContain(planBadgeLabel);
});

test("shows Content as a disabled option with the plan badge on a shared free project", async () => {
  $authPermit.set("build");
  $planFeatures.set(defaultPlanFeatures);

  const contentItem = await openModeMenu();

  expect(contentItem).toBeDefined();
  expect(contentItem?.hasAttribute("data-disabled")).toBe(true);
  expect(contentItem?.textContent).toContain(planBadgeLabel);
  // no Webstudio tier
  expect(contentItem?.textContent).not.toMatch(/\bPro\b/);
  expect(contentItem?.querySelector("kbd")).toBeNull();
});

test("shows the shortcut on a shared Pro project", async () => {
  $authPermit.set("build");
  $planFeatures.set({ ...defaultPlanFeatures, allowContentMode: true });

  const contentItem = await openModeMenu();

  expect(contentItem).toBeDefined();
  expect(contentItem?.hasAttribute("data-disabled")).toBe(false);
  expect(contentItem?.querySelector("kbd")).not.toBeNull();
});

test("opens a free Content-only share link in Preview mode", () => {
  $authPermit.set("edit");
  $planFeatures.set(defaultPlanFeatures);
  const info = vi.spyOn(toast, "info").mockImplementation(() => "");

  setBuilderMode("content");

  expect($builderMode.get()).toBe("preview");
  // OrganizeOS fork: the notice names no Webstudio tier
  expect(info).toHaveBeenCalledTimes(1);
  expect(String(info.mock.calls[0][0])).not.toMatch(/\bPro\b/);
  info.mockRestore();
});
