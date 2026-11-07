import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { $publishDialog } from "~/builder/shared/nano-states";
import { $organizeosSite } from "~/shared/nano-states";
import {
  $instances,
  $pages,
  $project,
  $projectSettings,
} from "~/shared/sync/data-stores";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { PublishButton } from "./publish";

// Both the tRPC client (httpBatchLink) and the dialog's address read send
// through the CSRF-carrying fetch, so it sees every request either dialog makes
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

const createProject = (latestBuildVirtual: unknown) =>
  ({
    id: "project-1",
    domain: "acme",
    latestBuildVirtual,
  }) as unknown as Project;

const projectQueries = () =>
  routeFetch.mock.calls.filter(([url]) =>
    String(url).includes("/trpc/domain.project")
  );

let root: Root | undefined;
let container: HTMLElement | undefined;

const settle = async () => {
  for (let turn = 0; turn < 5; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const render = async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(PublishButton, { projectId: "project-1" })
      )
    );
  });
  await settle();
};

beforeEach(() => {
  $pages.set(createDefaultPages({ rootInstanceId: "body" }));
  $instances.set(
    new Map([
      [
        "body",
        { type: "instance", id: "body", component: "Body", children: [] },
      ],
    ])
  );
  $projectSettings.set({ meta: {}, compiler: {} });
  $organizeosSite.set(site);
  routeFetch.mockReset();
  routeFetch.mockImplementation(async (url: unknown) => {
    if (String(url).includes("/trpc/")) {
      return Response.json([
        {
          result: {
            data: { success: true, project: $project.get() },
          },
        },
      ]);
    }
    return Response.json({
      ok: true,
      host: "acme.organizeos.org",
      origin: "https://acme.organizeos.org",
      manageDomainsUrl: "https://app.organizeos.org/acme/settings/domain",
      status: "not_launched",
      targets: [
        {
          key: "builtin",
          host: "acme.organizeos.org",
          builtin: true,
          main: false,
          publishedAt: null,
          live: false,
        },
      ],
    });
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  $publishDialog.set("none");
  $organizeosSite.set(undefined);
  $project.set(undefined);
  vi.useRealTimers();
});

describe("the Publish button and its status refresh", () => {
  test("the Publish dialog renders OrganizeosPublishContent with its own title, a close button and no gear for an OrganizeOS site, and does not poll the project", async () => {
    $project.set(createProject(null));
    $publishDialog.set("publish");
    await render();

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // one title, outside the Publish button
    const titles = Array.from(dialog?.querySelectorAll("*") ?? []).filter(
      (element) =>
        element.children.length === 0 &&
        element.textContent === "Publish" &&
        element.closest("button") === null
    );
    expect(titles).toHaveLength(1);
    // the title's only action is closing it: no settings gear. Every other
    // button is a row's checkbox or Publish to selected
    const otherButtons = Array.from(
      dialog?.querySelectorAll("button") ?? []
    ).filter(
      (button) =>
        button.getAttribute("role") !== "checkbox" &&
        button.textContent?.startsWith("Publish to selected") !== true
    );
    expect(otherButtons).toHaveLength(1);
    // the dialog's rows
    expect(
      dialog
        ?.querySelector('button[role="checkbox"]')
        ?.getAttribute("aria-label")
    ).toBe("acme.organizeos.org");
    // the OrganizeOS dialog's own address read, and no status refresh of
    // upstream's
    expect(routeFetch.mock.calls.map(([url]) => String(url))).toContain(
      "/rest/organizeos-site/project-1"
    );
    expect(projectQueries()).toHaveLength(0);
  });

  test("upstream's status refresh still runs for a project no org owns", async () => {
    // the gate's negative control: the same render, without an org site
    $organizeosSite.set(undefined);
    // upstream's dialog lists the project's domains
    $project.set({
      ...createProject(null),
      domainsVirtual: [],
    } as unknown as Project);
    $publishDialog.set("publish");
    await render();
    expect(projectQueries().length).toBeGreaterThan(0);
    expect(routeFetch.mock.calls.map(([url]) => String(url))).not.toContain(
      "/rest/organizeos-site/project-1"
    );
  });

  test("a pending publish is polled once per interval, by the OrganizeOS dialog alone", async () => {
    // the positive control: the mock sees the project query when it is made
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    $project.set(
      createProject({
        publishStatus: "PENDING",
        createdAt: new Date().toISOString(),
      })
    );
    $publishDialog.set("publish");
    await render();
    expect(projectQueries()).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await settle();
    expect(projectQueries()).toHaveLength(1);
  });
});
