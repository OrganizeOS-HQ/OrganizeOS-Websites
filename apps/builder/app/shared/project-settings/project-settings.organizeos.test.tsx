import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { $project, $projectSettings } from "~/shared/sync/data-stores";
import { $organizeosSite } from "~/shared/nano-states";
import type { SectionName } from "~/shared/nano-states/project-settings";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { ProjectSettingsDialog } from "./project-settings";

// The Domains section reads the site's addresses through the CSRF-carrying
// fetch; no test here may reach the network
const { routeFetch } = vi.hoisted(() => ({ routeFetch: vi.fn() }));

vi.mock("~/shared/fetch.client", () => ({
  fetch: (...args: unknown[]) => routeFetch(...args),
}));

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

beforeEach(() => {
  routeFetch.mockReset();
  routeFetch.mockResolvedValue(new Response("{}", { status: 503 }));
  $project.set({ id: "project-1" } as Project);
  $projectSettings.set({ meta: { siteName: "Site" }, compiler: {} });
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  $organizeosSite.set(undefined);
  $projectSettings.set(undefined);
  $project.set(undefined);
});

// Rendered the way the builder does: no projectId prop, the project in $project
const renderDialog = async (currentSection: SectionName) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <ProjectSettingsDialog currentSection={currentSection} />
      </TooltipProvider>
    );
  });
};

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const sectionLabels = () =>
  Array.from(dialog()?.querySelectorAll('[role="option"]') ?? []).map(
    (item) => item.textContent
  );

describe("the Settings dialog for an org project", () => {
  beforeEach(() => {
    $organizeosSite.set(site);
  });

  test("lists OrganizeOS's sections, in order, with plain names", async () => {
    await renderDialog("general");
    expect(sectionLabels()).toEqual([
      "General",
      "Domains",
      "Form emails",
      "Redirects",
      "Page passwords",
      "Headers",
      "Published versions",
    ]);
  });

  test("is titled Settings", async () => {
    await renderDialog("general");
    const titleId = dialog()?.getAttribute("aria-labelledby") ?? "";
    expect(document.getElementById(titleId)?.textContent).toBe("Settings");
    expect(dialog()?.textContent).not.toContain("Project settings");
  });

  test("opens Domains, which reads the project in the builder", async () => {
    await renderDialog("domains");
    expect(dialog()).not.toBeNull();
    expect(routeFetch).toHaveBeenCalledTimes(1);
    expect(String(routeFetch.mock.calls[0][0])).toContain("project-1");
  });

  test.each(["publish", "agents"] as const)(
    "opens nothing for %s",
    async (section) => {
      await renderDialog(section);
      expect(dialog()).toBeNull();
    }
  );
});

describe("the Settings dialog for a project no org owns", () => {
  test("keeps upstream's sections, with the new names and no Domains", async () => {
    await renderDialog("general");
    expect(sectionLabels()).toEqual([
      "General",
      "Form emails",
      "Agents",
      "Redirects",
      "Publish",
      "Published versions",
      "Page passwords",
      "Headers",
    ]);
  });

  test("opens nothing for domains", async () => {
    await renderDialog("domains");
    expect(dialog()).toBeNull();
    expect(routeFetch).not.toHaveBeenCalled();
  });
});
