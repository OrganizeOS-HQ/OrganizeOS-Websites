import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { page } from "@vitest/browser/context";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { $planFeatures } from "~/shared/nano-states";
import { planBadgeLabel, planUpgradeHint } from "~/shared/branding";
import { $project } from "~/shared/sync/data-stores";
import { SectionBackups } from "./section-backups";

const createdAt = "2026-11-01T15:30:00.000Z";

// One stable load, so the section's effect runs once
const { load, restoreDevelopmentBuild } = vi.hoisted(() => ({
  load: vi.fn(),
  restoreDevelopmentBuild: vi.fn(),
}));

vi.mock("~/shared/trpc/trpc-client", () => ({
  trpcClient: {
    project: {
      publishedBuilds: {
        useQuery: () => ({
          load,
          data: {
            success: true,
            data: [
              {
                buildId: "build-1",
                createdAt,
                domains: "acme.organizeos.org, www.acme.org",
              },
            ],
          },
        }),
      },
    },
  },
  nativeClient: {
    project: { restoreDevelopmentBuild: { mutate: restoreDevelopmentBuild } },
  },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const dateOnly = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeStyle: "short",
}).format(new Date(createdAt));

let root: Root;
let previousPlan: ReturnType<typeof $planFeatures.get>;

const render = (canRestoreBackups: boolean) => {
  $planFeatures.set({ ...defaultPlanFeatures, canRestoreBackups });
  act(() =>
    root.render(
      <TooltipProvider delayDuration={0}>
        <SectionBackups />
      </TooltipProvider>
    )
  );
};

beforeEach(() => {
  load.mockReset();
  restoreDevelopmentBuild.mockReset();
  previousPlan = $planFeatures.get();
  $project.set({ id: "project-1" } as Project);
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  $planFeatures.set(previousPlan);
  $project.set(undefined);
});

test("is titled Published versions and loads the project's builds", () => {
  render(true);
  expect(document.body.textContent).toContain("Published versions");
  expect(document.body.textContent).not.toContain("Backups");
  expect(load).toHaveBeenCalledWith({ projectId: "project-1" });
});

test("a plan without restore shows the chip, and no banner or image", () => {
  render(false);
  expect(document.body.textContent).toContain(planBadgeLabel);
  expect(document.querySelector("img")).toBeNull();
  expect(document.body.textContent).not.toContain(planUpgradeHint);
  expect(document.body.textContent).not.toContain("not included in your plan");
  expect(
    page.getByRole("button", { name: "Restore" }).element()
  ).toBeDisabled();
});

test("a plan with restore shows no chip", () => {
  render(true);
  expect(document.body.textContent).not.toContain(planBadgeLabel);
});

test("a version is labelled with its date only", () => {
  render(true);
  const trigger = page.getByRole("combobox").element();
  expect(trigger.textContent).toBe(dateOnly);
  expect(document.body.textContent).not.toContain("acme.organizeos.org");
});

test("the confirm asks plainly and warns what is lost", async () => {
  render(true);
  await act(async () => page.getByRole("button", { name: "Restore" }).click());
  const dialog = page.getByRole("dialog");
  await expect.element(dialog).toBeVisible();
  const text = dialog.element().textContent;
  expect(text).toContain("Restore the site to this published version?");
  expect(text).toContain(`All changes made after ${dateOnly} will be lost.`);
  expect(text).not.toContain("Are you sure");
});
