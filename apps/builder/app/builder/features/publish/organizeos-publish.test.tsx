import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider, toast } from "@webstudio-is/design-system";
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

// The dialog reads the site's addresses and launch state from the builder's
// rest.organizeos-site route, through the CSRF-carrying fetch
const { routeFetch } = vi.hoisted(() => ({ routeFetch: vi.fn() }));

vi.mock("~/shared/fetch.client", () => ({
  fetch: (...args: unknown[]) => routeFetch(...args),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

const site: OrganizeosSite = {
  organizationId: "org-1",
  subdomain: "acme",
  manageUrl: "https://app.organizeos.org/acme/website",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

const addresses = {
  ok: true,
  host: "votelabor.org",
  origin: "https://votelabor.org",
  manageDomainsUrl: "https://app.organizeos.org/acme/settings/domain",
  websiteUrl: "https://app.organizeos.org/acme/website",
};

type Answer = Record<string, unknown>;

/** The route answers these, in turn, and the last one from then on. */
const routeAnswers = (...answers: Array<Answer | Error | number>) => {
  let index = 0;
  routeFetch.mockImplementation(async () => {
    const answer = answers[Math.min(index, answers.length - 1)];
    index += 1;
    if (answer instanceof Error) {
      throw answer;
    }
    if (typeof answer === "number") {
      return Response.json({ ok: false }, { status: answer });
    }
    return Response.json(answer);
  });
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

/** Lets the route's answer reach the dialog. */
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
        createElement(OrganizeosPublishContent, { site })
      )
    );
  });
  await settle();
  return container;
};

const unmount = () => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
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
    link.getAttribute("target"),
  ]);

const warning =
  "This version can't go live yet. Publish again after the next builder update.";

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
  routeFetch.mockReset();
  routeAnswers({ ...addresses, status: "not_launched" });
});

afterEach(() => {
  unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the OrganizeOS Publish dialog", () => {
  test("reads the addresses for this project when it opens", async () => {
    setProject(null);
    await render();
    expect(routeFetch).toHaveBeenCalledTimes(1);
    expect(routeFetch.mock.calls[0][0]).toBe("/rest/organizeos-site/project-1");
  });

  test("a live site: Publishing to its host, linked, and Manage domains, and nothing more", async () => {
    routeAnswers({ ...addresses, status: "live", launchable: true });
    setProject(null);
    const host = await render();
    expect(links(host)).toEqual([
      ["votelabor.org", "https://votelabor.org", "_blank"],
      [
        "Manage domains ↗",
        "https://app.organizeos.org/acme/settings/domain",
        "_blank",
      ],
    ]);
    expect(host.textContent).toBe(
      "Publishing to votelabor.orgManage domains ↗Not published yet.Publish"
    );
  });

  test("a site not launched: its host unlinked, Manage domains, and Not live yet with the link to launch it", async () => {
    setProject(null);
    const host = await render();
    expect(links(host)).toEqual([
      [
        "Manage domains ↗",
        "https://app.organizeos.org/acme/settings/domain",
        "_blank",
      ],
      [
        "Launch your website from OrganizeOS ↗",
        "https://app.organizeos.org/acme/website",
        "_blank",
      ],
    ]);
    expect(host.textContent).toBe(
      "Publishing to votelabor.orgManage domains ↗Not live yet. Launch your website from OrganizeOS ↗Not published yet.Publish"
    );
  });

  test("an offline site: its host unlinked, Manage domains, and offline with the link to put it back", async () => {
    routeAnswers({ ...addresses, status: "offline", launchable: false });
    setProject(null);
    const host = await render();
    expect(links(host)).toEqual([
      [
        "Manage domains ↗",
        "https://app.organizeos.org/acme/settings/domain",
        "_blank",
      ],
      [
        "Put it back from OrganizeOS ↗",
        "https://app.organizeos.org/acme/website",
        "_blank",
      ],
    ]);
    expect(host.textContent).toBe(
      "Publishing to votelabor.orgManage domains ↗Your website is offline. Put it back from OrganizeOS ↗Not published yet.Publish"
    );
  });

  test("the warning shows only for a live site whose version can't go live", async () => {
    routeAnswers({ ...addresses, status: "live", launchable: false });
    setProject(null);
    const host = await render();
    expect(textOf(host, /^This version/)).toBe(warning);
    expect(host.textContent).toBe(
      `Publishing to votelabor.orgManage domains ↗Not published yet.${warning}Publish`
    );
    unmount();

    for (const answer of [
      { status: "offline", launchable: false },
      { status: "not_launched", launchable: false },
      { status: "live", launchable: true },
      { status: "live" },
    ]) {
      routeAnswers({ ...addresses, ...answer });
      const other = await render();
      expect(other.textContent, JSON.stringify(answer)).not.toContain(
        "This version"
      );
      unmount();
    }
  });

  test("a failed read shows no address, no launch line and no warning, and Publish stays", async () => {
    for (const answer of [
      { ok: false },
      403,
      new Error("network"),
      { ...addresses, status: "launched" },
      { ...addresses, status: "live", origin: "javascript:alert(1)" },
      {
        ...addresses,
        status: "live",
        manageDomainsUrl: "javascript:alert(1)",
      },
    ]) {
      routeAnswers(answer);
      setProject(null);
      const host = await render();
      const label = answer instanceof Error ? "error" : JSON.stringify(answer);
      expect(host.textContent, label).toBe("Not published yet.Publish");
      expect(links(host), label).toEqual([]);
      unmount();
    }
  });

  test("shows no platform address of its own, no copy or open buttons, and no Site settings", async () => {
    routeAnswers({ ...addresses, status: "live" });
    setProject(null);
    const host = await render();
    expect(host.textContent).not.toContain("acme.organizeos.org");
    expect(host.textContent).not.toContain("Site settings");
    expect(host.textContent).not.toContain("Your site");
    expect(
      host.querySelector(
        '[aria-label="Copy site link"], [aria-label="Open site"]'
      )
    ).toBeNull();
  });

  test("the host has a tooltip when it does not fit", async () => {
    // an open tooltip measures its arrow
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(300);
    const long = "www.a-long-custom-domain-for-the-campaign.org";
    routeAnswers({
      ...addresses,
      host: long,
      origin: `https://${long}`,
      status: "live",
    });
    setProject(null);
    const host = await render();
    vi.useFakeTimers();
    const row = Array.from(host.querySelectorAll("*")).find(
      (element) => element.textContent === `Publishing to ${long}`
    );
    expect(row).toBeDefined();
    act(() => {
      row?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      long
    );
  });

  test("a publish that settles reads the addresses again", async () => {
    setProject({ createdAt: minutesAgo(1), publishStatus: "PENDING" });
    await render();
    expect(routeFetch).toHaveBeenCalledTimes(1);
    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "PUBLISHED" });
    });
    await settle();
    expect(routeFetch).toHaveBeenCalledTimes(2);

    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "PENDING" });
    });
    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "FAILED" });
    });
    await settle();
    expect(routeFetch).toHaveBeenCalledTimes(3);
  });

  test("a publish that settles says the site is live only when it is and its version can go live, and Published otherwise", async () => {
    const success = vi.spyOn(toast, "success").mockImplementation(() => "");
    const live =
      "Your site is live. Changes can take up to a minute to appear at votelabor.org.";
    const cases: Array<[Answer | Error, string]> = [
      [{ ...addresses, status: "live", launchable: true }, live],
      [{ ...addresses, status: "live" }, live],
      [{ ...addresses, status: "live", launchable: false }, "Published."],
      [{ ...addresses, status: "not_launched" }, "Published."],
      [{ ...addresses, status: "offline" }, "Published."],
      [new Error("network"), "Published."],
      [{ ok: false }, "Published."],
    ];
    for (const [after, message] of cases) {
      const label = after instanceof Error ? "error" : JSON.stringify(after);
      success.mockClear();
      routeAnswers({ ...addresses, status: "not_launched" }, after);
      setProject({ createdAt: minutesAgo(1), publishStatus: "PENDING" });
      await render();
      act(() => {
        setProject({ createdAt: minutesAgo(1), publishStatus: "PUBLISHED" });
      });
      await settle();
      expect(success, label).toHaveBeenCalledTimes(1);
      expect(success.mock.calls[0][0], label).toBe(message);
      unmount();
    }
  });

  test("a pending publish reads Publishing, started and when, and no more", async () => {
    setProject({ createdAt: minutesAgo(5), publishStatus: "PENDING" });
    const host = await render();
    expect(textOf(host, /^Publishing,/)).toBe(
      "Publishing, started 5 minutes ago"
    );
    expect(host.textContent).not.toContain("usually takes");
  });

  test("a failed publish reads Publish failed and when, and no more", async () => {
    setProject({ createdAt: minutesAgo(5), publishStatus: "FAILED" });
    const host = await render();
    expect(textOf(host, /^Publish failed/)).toBe(
      "Publish failed 5 minutes ago"
    );
    expect(host.textContent).not.toContain("Try again");
    expect(host.textContent).not.toContain("support");
  });

  test("a publish that did not finish in time says so, and no more", async () => {
    setProject({ createdAt: minutesAgo(30), publishStatus: "PENDING" });
    const host = await render();
    expect(textOf(host, /^Publishing did not finish/)).toBe(
      "Publishing did not finish 30 minutes ago"
    );
  });

  test("the plan banner ends with its Open in OrganizeOS link alone, to the Website area", async () => {
    setProject(null);
    const pages = $pages.get();
    if (pages === undefined) {
      throw new Error("no pages");
    }
    // the default plan includes no custom contact email
    $pages.set({ ...pages, meta: { contactEmail: "team@acme.org" } });
    const host = await render();
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

  test("the Publish button has no tooltip", async () => {
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
    const host = await render();
    vi.useFakeTimers();
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
