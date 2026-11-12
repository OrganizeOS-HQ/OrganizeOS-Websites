import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test, vi } from "vitest";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import { TooltipProvider } from "@webstudio-is/design-system";
import { $builderMode, $planFeatures } from "~/shared/nano-states";
import { planBadgeLabel } from "~/shared/branding";
import { SettingsPanel } from "./settings-panel";

// Only the variables section is under test; the rest of the panel needs a
// full project
vi.mock("./settings-section", () => ({ SettingsSection: () => null }));
vi.mock("./props-section/props-section", () => ({
  PropsSectionContainer: () => null,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
const previousPlan = $planFeatures.get();
const previousMode = $builderMode.get();

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  $planFeatures.set(previousPlan);
  $builderMode.set(previousMode);
});

const render = (allowDynamicData: boolean) => {
  $builderMode.set("design");
  $planFeatures.set({ ...defaultPlanFeatures, allowDynamicData });
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <TooltipProvider>
        <SettingsPanel
          selectedInstance={{
            id: "box",
            type: "instance",
            component: "Box",
            children: [],
          }}
          selectedInstanceKey="box"
        />
      </TooltipProvider>
    )
  );
};

test("a plan without dynamic data shows the chip beside Data variables, not a banner", () => {
  render(false);
  const text = document.body.textContent ?? "";
  expect(text).toContain("Data variables");
  expect(text).toContain(planBadgeLabel);
  expect(text).not.toContain("not included in your plan");
  expect(text).not.toContain("plan is managed");
});

test("a plan with dynamic data shows no chip", () => {
  render(true);
  expect(document.body.textContent).toContain("Data variables");
  expect(document.body.textContent).not.toContain(planBadgeLabel);
});
