import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { page } from "@vitest/browser/context";
import { afterEach, beforeEach, expect, test } from "vitest";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import { createDefaultPages } from "@webstudio-is/project-build";
import { TooltipProvider } from "@webstudio-is/design-system";
import { $planFeatures } from "~/shared/nano-states";
import { planBadgeLabel } from "~/shared/branding";
import { $pages, $projectSettings } from "~/shared/sync/data-stores";
import { registerContainers } from "~/shared/sync/sync-stores";
import { SectionAuth } from "./section-auth";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let previousPlan: ReturnType<typeof $planFeatures.get>;

beforeEach(() => {
  registerContainers();
  previousPlan = $planFeatures.get();
  $pages.set(createDefaultPages({ rootInstanceId: "box" }));
  $projectSettings.set({ meta: {}, compiler: {} });
  // a plan without page passwords
  $planFeatures.set({ ...defaultPlanFeatures, allowAuth: false });
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <TooltipProvider delayDuration={0}>
        <SectionAuth />
      </TooltipProvider>
    )
  );
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  $planFeatures.set(previousPlan);
  $projectSettings.set(undefined);
});

test("the section is titled Page passwords, with the plan chip", () => {
  expect(document.body.textContent).toContain("Page passwords");
  expect(document.body.textContent).not.toContain("Authentication asks");
  expect(document.body.textContent).toContain(planBadgeLabel);
});

test("the tooltip is one line, without the plan sentence", async () => {
  // the icon is out of the tab order (tabIndex -1), so it opens on hover
  const icon = document.querySelector<SVGElement>('svg[tabindex="-1"]');
  expect(icon).not.toBeNull();
  await act(async () => page.elementLocator(icon!).hover());
  const tooltip = page.getByRole("tooltip");
  await expect.element(tooltip).toBeVisible();
  const text = tooltip.element().textContent;
  expect(text).toBe("Paths use page syntax, with :params and * wildcards.");
  expect(text).not.toContain("plan is managed");
});
