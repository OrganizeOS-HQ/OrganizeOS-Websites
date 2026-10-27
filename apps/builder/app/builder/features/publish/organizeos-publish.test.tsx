import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import {
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
} from "~/shared/sync/data-stores";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { OrganizeosPublishContent } from "./organizeos-publish";
import type { LatestBuildLike } from "./organizeos-publish-status";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

const site: OrganizeosSite = {
  organizationId: "org-1",
  subdomain: "acme",
  siteUrl: "https://acme.organizeos.org",
  manageUrl: "https://app.organizeos.org/acme/website",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

const setProject = (latestBuildVirtual: null | LatestBuildLike) => {
  $project.set({
    id: "project-1",
    domain: "acme",
    latestBuildVirtual,
  } as unknown as Project);
};

const render = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(OrganizeosPublishContent, { site })
      )
    );
  });
  return container;
};

// the text of the innermost element whose text matches: in document order an
// element comes after the ones that hold it
const textOf = (host: HTMLElement, pattern: RegExp) =>
  Array.from(host.querySelectorAll("*"), (element) => element.textContent ?? "")
    .filter((text) => pattern.test(text))
    .at(-1);

const links = (host: HTMLElement) =>
  Array.from(host.querySelectorAll("a"), (link) => [
    link.textContent,
    link.getAttribute("href"),
  ]);

beforeEach(() => {
  const pages = createDefaultPages({ rootInstanceId: "body" });
  $pages.set(pages);
  $instances.set(
    new Map([
      [
        "body",
        { type: "instance", id: "body", component: "Body", children: [] },
      ],
    ])
  );
  $props.set(new Map());
  $dataSources.set(new Map());
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the OrganizeOS Publish dialog", () => {
  test("links site settings with a bare link, and nothing more about them", () => {
    setProject(null);
    const host = render();
    expect(links(host)).toEqual([
      ["acme.organizeos.org", "https://acme.organizeos.org"],
      ["Site settings ↗", "https://app.organizeos.org/acme/website"],
    ]);
    const settings = Array.from(host.querySelectorAll("a")).find(
      (link) => link.textContent === "Site settings ↗"
    );
    // the link is the whole line
    expect(settings?.parentElement?.textContent).toBe("Site settings ↗");
    expect(host.textContent).not.toContain("managed in");
  });

  test("a pending publish reads Publishing, started and when, and no more", () => {
    setProject({ createdAt: minutesAgo(5), publishStatus: "PENDING" });
    const host = render();
    expect(textOf(host, /^Publishing/)).toBe(
      "Publishing, started 5 minutes ago"
    );
    expect(host.textContent).not.toContain("usually takes");
  });

  test("a failed publish reads Publish failed and when, and no more", () => {
    setProject({ createdAt: minutesAgo(5), publishStatus: "FAILED" });
    const host = render();
    expect(textOf(host, /^Publish failed/)).toBe(
      "Publish failed 5 minutes ago"
    );
    expect(host.textContent).not.toContain("Try again");
    expect(host.textContent).not.toContain("support");
  });

  test("a publish that did not finish in time says so, and no more", () => {
    setProject({ createdAt: minutesAgo(30), publishStatus: "PENDING" });
    const host = render();
    expect(textOf(host, /^Publishing did not finish/)).toBe(
      "Publishing did not finish 30 minutes ago"
    );
  });

  test("the plan banner ends with its Open in OrganizeOS link alone, to the Website area", () => {
    setProject(null);
    const pages = $pages.get();
    if (pages === undefined) {
      throw new Error("no pages");
    }
    // the default plan includes no custom contact email
    $pages.set({ ...pages, meta: { contactEmail: "team@acme.org" } });
    const host = render();
    const list = Array.from(host.querySelectorAll("ul")).find((item) =>
      item.textContent?.includes("Custom contact email")
    );
    expect(list?.previousElementSibling?.textContent).toBe(
      "This site uses features your plan does not include:"
    );
    expect(list?.nextElementSibling?.textContent).toBe("Open in OrganizeOS ↗");
    expect(list?.nextElementSibling?.querySelector("a")?.href).toBe(
      "https://app.organizeos.org/acme/website"
    );
    expect(host.textContent).not.toContain("plan is managed in");
  });

  test("the Publish button has no tooltip", () => {
    vi.useFakeTimers();
    // an open tooltip measures its arrow
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    setProject(null);
    const host = render();
    const publish = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "Publish"
    );
    expect(publish).toBeDefined();
    const before = document.body.textContent;
    act(() => {
      publish?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    });
    act(() => {
      vi.runAllTimers();
    });
    // hovering it shows nothing new
    expect(document.body.textContent).toBe(before);
  });
});
