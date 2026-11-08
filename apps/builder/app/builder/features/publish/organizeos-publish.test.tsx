import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider, toast } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { defaultPlanFeatures } from "@webstudio-is/plans";
import {
  ROOT_INSTANCE_ID,
  blockComponent,
  type DataSource,
  type Instance,
  type Resource,
} from "@webstudio-is/sdk";
import {
  $assets,
  $dataSources,
  $instances,
  $pages,
  $project,
  $projectSettings,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import { $planFeatures } from "~/shared/nano-states";
import { getResourcePresetIds } from "~/shared/organizeos-preset-ids";
import { planBadgeLabel } from "~/shared/branding";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { OrganizeosPublishContent } from "./organizeos-publish";
import type { LatestBuildLike } from "./organizeos-publish-status";

// The dialog reads the org's addresses from the builder's rest.organizeos-site
// route, publishes through rest.organizeos-publish and refreshes the project
// through tRPC, all through the CSRF-carrying fetch
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

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

type Target = {
  key: string;
  host: string;
  builtin: boolean;
  main: boolean;
  publishedAt: string | null;
  live: boolean;
};

const builtinTarget: Target = {
  key: "builtin",
  host: "acme.organizeos.org",
  builtin: true,
  main: false,
  publishedAt: minutesAgo(10),
  live: true,
};
const mainTarget: Target = {
  key: "www.acme.org",
  host: "www.acme.org",
  builtin: false,
  main: true,
  publishedAt: null,
  live: false,
};
const otherTarget: Target = {
  key: "acme.net",
  host: "acme.net",
  builtin: false,
  main: false,
  publishedAt: null,
  live: false,
};

const notLive = (target: Target): Target => ({
  ...target,
  live: false,
  publishedAt: null,
});

type Answer = Record<string, unknown>;

const answerWith = (targets: Target[] | undefined, change: Answer = {}) => ({
  ok: true,
  host: "www.acme.org",
  origin: "https://www.acme.org",
  status: "live",
  manageDomainsUrl: "https://app.organizeos.org/acme/settings/domain",
  ...(targets === undefined ? {} : { targets }),
  ...change,
});

type Reply = Answer | Error | number | Promise<Response>;

const reply = async (answer: Reply) => {
  if (answer instanceof Error) {
    throw answer;
  }
  if (answer instanceof Promise) {
    return answer;
  }
  if (typeof answer === "number") {
    return Response.json({ ok: false }, { status: answer });
  }
  return Response.json(answer);
};

let siteReplies: Reply[] = [];
let publishReply: Reply = { ok: true };
/** What the project refresh answers; the current project when unset. */
let refreshedProject: Project | undefined;

/** The addresses read answers these, in turn, and the last one from then on. */
const routeAnswers = (...answers: Reply[]) => {
  siteReplies = answers;
};

const calls = (path: string) =>
  routeFetch.mock.calls.filter(([url]) => String(url).includes(path));
const siteReads = () => calls("/rest/organizeos-site/");
const publishCalls = () => calls("/rest/organizeos-publish/");
const projectRefreshes = () => calls("/trpc/domain.project");

const setProject = (latestBuildVirtual: null | LatestBuildLike) => {
  $project.set({
    id: "project-1",
    domain: "acme",
    latestBuildVirtual,
  } as unknown as Project);
};

/** Lets the route's answer reach the dialog. */
const settle = async () => {
  for (let turn = 0; turn < 8; turn += 1) {
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

const publishButton = (host: HTMLElement) =>
  Array.from(host.querySelectorAll("button")).find(
    // a pending button keeps its label beside its loading dots
    (button) => button.textContent?.startsWith("Publish to selected")
  );

const checkboxes = (host: HTMLElement) =>
  Array.from(
    host.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]')
  );

/** Each row's host and whether it is ticked, in order. */
const ticks = (host: HTMLElement) =>
  checkboxes(host).map((box) => [
    box.getAttribute("aria-label"),
    box.getAttribute("aria-checked") === "true",
  ]);

/** Each row's text: the host, then its label, Live or Not live, and when. */
const rows = (host: HTMLElement) =>
  checkboxes(host).map((box) => box.parentElement?.textContent);

const checkboxFor = (host: HTMLElement, name: string) =>
  checkboxes(host).find((box) => box.getAttribute("aria-label") === name);

const click = async (element: HTMLElement | undefined) => {
  expect(element).toBeDefined();
  await act(async () => {
    element?.click();
    await Promise.resolve();
  });
  await settle();
};

const stubTooltipMeasuring = () => {
  // an open tooltip measures its arrow
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
};

/** Hovers the element until its tooltip opens, and answers the tooltip's text. */
const hover = (element: Element | undefined) => {
  expect(element).toBeDefined();
  vi.useFakeTimers();
  act(() => {
    element?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }));
  });
  act(() => {
    vi.runAllTimers();
  });
  vi.useRealTimers();
  return document.body.querySelector('[role="tooltip"]')?.textContent;
};

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
  // 0.309.0 keeps the project's settings in their own store, and the plan
  // banner reads them and the Resources (getRestrictedFeatures)
  $projectSettings.set({ meta: {}, compiler: {} });
  $resources.set(new Map());
  $assets.set(new Map());
  $planFeatures.set(defaultPlanFeatures);
  routeFetch.mockReset();
  siteReplies = [answerWith([builtinTarget, mainTarget, otherTarget])];
  publishReply = { ok: true };
  refreshedProject = undefined;
  let siteIndex = 0;
  routeFetch.mockImplementation(async (url: unknown) => {
    const path = String(url);
    if (path.startsWith("/rest/organizeos-site/")) {
      const answer = siteReplies[Math.min(siteIndex, siteReplies.length - 1)];
      siteIndex += 1;
      return reply(answer);
    }
    if (path.startsWith("/rest/organizeos-publish/")) {
      return reply(publishReply);
    }
    if (path.includes("/trpc/")) {
      if (refreshedProject !== undefined) {
        // the refresh answers after the publish wrote its build
        return Response.json([
          { result: { data: { success: true, project: refreshedProject } } },
        ]);
      }
      return Response.json([
        { result: { data: { success: true, project: $project.get() } } },
      ]);
    }
    throw new Error(`unexpected request ${path}`);
  });
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
    expect(siteReads()).toHaveLength(1);
    expect(siteReads()[0][0]).toBe("/rest/organizeos-site/project-1");
  });

  test("lists one row per address in the read's order: the built-in labelled Built-in, the main Main", async () => {
    setProject(null);
    const host = await render();
    expect(rows(host)).toEqual([
      "acme.organizeos.orgBuilt-in · Live · 10 minutes ago",
      "www.acme.orgMain · Not live",
      "acme.netNot live",
    ]);
  });

  test("the last-published time has the exact time in a tooltip", async () => {
    stubTooltipMeasuring();
    setProject(null);
    const host = await render();
    const time = Array.from(host.querySelectorAll("span")).find(
      (element) => element.textContent === "10 minutes ago"
    );
    expect(hover(time)).toBe(
      new Date(builtinTarget.publishedAt ?? "").toLocaleString()
    );
  });

  test("a live host links to the site in a new tab; a host not live is plain", async () => {
    setProject(null);
    const host = await render();
    expect(links(host)).toEqual([
      ["acme.organizeos.org", "https://acme.organizeos.org", "_blank"],
      [
        "Manage domains ↗",
        "https://app.organizeos.org/acme/settings/domain",
        "_blank",
      ],
    ]);
  });

  test("a host that does not fit is truncated, with its full text in a tooltip", async () => {
    stubTooltipMeasuring();
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(300);
    const long = "www.a-long-custom-domain-for-the-campaign.org";
    routeAnswers(
      answerWith([builtinTarget, { ...mainTarget, key: long, host: long }])
    );
    setProject(null);
    const host = await render();
    const cell = Array.from(host.querySelectorAll("label")).find(
      (element) => element.textContent === long
    );
    expect(hover(cell?.parentElement ?? undefined)).toBe(long);
  });

  test("before the first go-live nothing is ticked and Publish to selected is disabled", async () => {
    routeAnswers(
      answerWith([notLive(builtinTarget), mainTarget, otherTarget], {
        status: "not_launched",
        launchable: false,
      })
    );
    setProject(null);
    const host = await render();
    expect(ticks(host)).toEqual([
      ["acme.organizeos.org", false],
      ["www.acme.org", false],
      ["acme.net", false],
    ]);
    expect(publishButton(host)?.disabled).toBe(true);
    // ticking one enables it
    await click(checkboxFor(host, "www.acme.org"));
    expect(publishButton(host)?.disabled).toBe(false);
    await click(checkboxFor(host, "www.acme.org"));
    expect(publishButton(host)?.disabled).toBe(true);
  });

  test("a ticked address is filled with the accent and an unticked one is not", async () => {
    routeAnswers(answerWith([builtinTarget, mainTarget, otherTarget]));
    setProject(null);
    const host = await render();
    const fill = (name: string) => {
      const box = checkboxFor(host, name);
      return [
        box?.getAttribute("data-state"),
        box === undefined ? "" : getComputedStyle(box).backgroundColor,
      ];
    };
    const [, unticked] = fill("www.acme.org");
    await click(checkboxFor(host, "www.acme.org"));
    expect(fill("www.acme.org")).toEqual(["checked", "rgb(13, 148, 136)"]);
    expect(unticked).not.toBe("rgb(13, 148, 136)");
    await click(checkboxFor(host, "www.acme.org"));
    expect(fill("www.acme.org")[0]).toBe("unchecked");
  });

  test("the live addresses are ticked when it opens", async () => {
    routeAnswers(
      answerWith([builtinTarget, mainTarget, { ...otherTarget, live: true }])
    );
    setProject(null);
    const host = await render();
    expect(ticks(host)).toEqual([
      ["acme.organizeos.org", true],
      ["www.acme.org", false],
      ["acme.net", true],
    ]);
  });

  test("Publish to selected sends the ticked keys, in row order, and nothing through upstream's publish", async () => {
    setProject(null);
    const host = await render();
    await click(checkboxFor(host, "acme.net"));
    await click(checkboxFor(host, "www.acme.org"));
    await click(publishButton(host));
    expect(publishCalls()).toHaveLength(1);
    const [url, init] = publishCalls()[0] as [string, RequestInit];
    expect(url).toBe("/rest/organizeos-publish/project-1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      targets: ["builtin", "www.acme.org", "acme.net"],
    });
    expect(calls("/trpc/domain.publish")).toEqual([]);
  });

  test.each([
    ["an ok", { ok: true } as Reply],
    ["a refusal", { ok: false, error: "unknown_target" } as Reply],
    ["a timeout", new DOMException("stopped", "TimeoutError") as Reply],
  ])(
    "after %s it refreshes the project and reads again, and the rows show the new read",
    async (_name, answer) => {
      publishReply = answer;
      routeAnswers(
        answerWith([builtinTarget, mainTarget, otherTarget]),
        answerWith([builtinTarget, { ...mainTarget, live: true }, otherTarget])
      );
      setProject(null);
      const host = await render();
      await click(publishButton(host));
      expect(projectRefreshes()).toHaveLength(1);
      expect(siteReads()).toHaveLength(2);
      expect(rows(host)[1]).toBe("www.acme.orgMain · Live");
    }
  );

  test("a person's ticks hold while their publish is pending, and the read after it settles ticks what is live", async () => {
    routeAnswers(
      answerWith([builtinTarget, mainTarget, otherTarget]),
      // read after the publish answered: nothing new is live yet
      answerWith([builtinTarget, mainTarget, otherTarget]),
      // read after the build settled: OrganizeOS put the main live
      answerWith([builtinTarget, { ...mainTarget, live: true }, otherTarget])
    );
    setProject(null);
    refreshedProject = {
      id: "project-1",
      domain: "acme",
      latestBuildVirtual: {
        createdAt: minutesAgo(0),
        publishStatus: "PENDING",
      },
    } as unknown as Project;
    const host = await render();
    await click(checkboxFor(host, "www.acme.org"));
    await click(checkboxFor(host, "acme.net"));
    await click(publishButton(host));
    expect(textOf(host, /^Publishing,/)).toMatch(/^Publishing, started/);
    expect(ticks(host)).toEqual([
      ["acme.organizeos.org", true],
      ["www.acme.org", true],
      ["acme.net", true],
    ]);
    // pending: Publish to selected waits
    expect(publishButton(host)?.disabled).toBe(true);

    act(() => {
      setProject({ createdAt: minutesAgo(0), publishStatus: "PUBLISHED" });
    });
    await settle();
    expect(siteReads()).toHaveLength(3);
    expect(ticks(host)).toEqual([
      ["acme.organizeos.org", true],
      ["www.acme.org", true],
      ["acme.net", false],
    ]);
  });

  test("a ticked address the newer read no longer lists is dropped", async () => {
    routeAnswers(
      answerWith([builtinTarget, mainTarget, otherTarget]),
      answerWith([builtinTarget, mainTarget])
    );
    publishReply = { ok: false, error: "unknown_target" };
    setProject(null);
    const host = await render();
    await click(checkboxFor(host, "acme.net"));
    await click(publishButton(host));
    expect(ticks(host)).toEqual([
      ["acme.organizeos.org", true],
      ["www.acme.org", false],
    ]);
  });

  test("a publish that settles, failed or timed out included, reads the addresses again", async () => {
    setProject({ createdAt: minutesAgo(1), publishStatus: "PENDING" });
    await render();
    expect(siteReads()).toHaveLength(1);
    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "PUBLISHED" });
    });
    await settle();
    expect(siteReads()).toHaveLength(2);

    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "PENDING" });
    });
    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "FAILED" });
    });
    await settle();
    expect(siteReads()).toHaveLength(3);

    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "PENDING" });
    });
    // still pending past the executor's timeout
    act(() => {
      setProject({ createdAt: minutesAgo(26), publishStatus: "PENDING" });
    });
    await settle();
    expect(siteReads()).toHaveLength(4);
  });

  test("a newer build by someone else replaces the status row's build, and the next read's rows show what is live", async () => {
    routeAnswers(
      answerWith([builtinTarget, mainTarget, otherTarget]),
      answerWith([builtinTarget, mainTarget, { ...otherTarget, live: true }])
    );
    setProject({ createdAt: minutesAgo(3), publishStatus: "PENDING" });
    const host = await render();
    expect(textOf(host, /^Publishing,/)).toBe(
      "Publishing, started 3 minutes ago"
    );
    // another admin's publish superseded it: the newest build is the one shown
    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "PUBLISHED" });
    });
    await settle();
    expect(textOf(host, /^Published/)).toBe("Published 1 minute ago");
    expect(host.textContent).not.toContain("Publishing, started");
    expect(rows(host)[2]).toBe("acme.netLive");
  });

  test("the line for a version that can't go live shows only for a published build OrganizeOS will not serve", async () => {
    const line = "This version can't go live. Publish again.";
    routeAnswers(answerWith([builtinTarget], { launchable: false }));
    setProject({ createdAt: minutesAgo(5), publishStatus: "PUBLISHED" });
    expect((await render()).textContent).toContain(line);
    unmount();

    for (const [answer, build] of [
      [
        answerWith([builtinTarget], { launchable: true }),
        { createdAt: minutesAgo(5), publishStatus: "PUBLISHED" },
      ],
      [
        answerWith([builtinTarget]),
        { createdAt: minutesAgo(5), publishStatus: "PUBLISHED" },
      ],
      [
        answerWith([builtinTarget], { launchable: false }),
        { createdAt: minutesAgo(5), publishStatus: "PENDING" },
      ],
      [answerWith([builtinTarget], { launchable: false }), null],
    ] as Array<[Answer, LatestBuildLike | null]>) {
      routeAnswers(answer);
      setProject(build);
      const host = await render();
      expect(host.textContent, JSON.stringify([answer, build])).not.toContain(
        line
      );
      unmount();
    }
  });

  test("a failed read shows one line with Retry, no rows, and Publish to selected disabled", async () => {
    routeAnswers(500, answerWith([builtinTarget]));
    setProject(null);
    const host = await render();
    expect(textOf(host, /^Couldn't load/)).toBe(
      "Couldn't load your addresses. Retry"
    );
    expect(checkboxes(host)).toEqual([]);
    expect(publishButton(host)?.disabled).toBe(true);
    // Manage domains still opens the org's domain settings
    expect(links(host)).toEqual([
      [
        "Manage domains ↗",
        "https://app.organizeos.org/acme/settings/domain",
        "_blank",
      ],
    ]);

    await click(
      Array.from(host.querySelectorAll("button")).find(
        (button) => button.textContent === "Retry"
      )
    );
    expect(siteReads()).toHaveLength(2);
    expect(host.textContent).not.toContain("Couldn't load");
    expect(ticks(host)).toEqual([["acme.organizeos.org", true]]);
  });

  test("a read without targets shows Addresses unavailable, no rows and no publish", async () => {
    routeAnswers(answerWith(undefined));
    setProject(null);
    const host = await render();
    expect(textOf(host, /^Addresses unavailable/)).toBe(
      "Addresses unavailable."
    );
    expect(checkboxes(host)).toEqual([]);
    expect(publishButton(host)?.disabled).toBe(true);
  });

  test.each([
    [
      { ok: false, error: "unknown_target" },
      "Your addresses changed. Check them and publish again.",
    ],
    [
      { ok: false, error: "publish_unavailable" },
      "Publishing is not available right now.",
    ],
    [{ ok: false, error: "build_refused" }, "This version can't be published."],
    [
      {
        ok: false,
        error: "dispatch_failed",
        message: "Publishing could not be started. Please try again.",
      },
      "Publishing could not be started. Please try again.",
    ],
    [403, "You can't publish this site."],
  ] as Array<[Reply, string]>)(
    "a refused publish shows its one line once, and no toast: %j",
    async (answer, line) => {
      const toasts = [
        vi.spyOn(toast, "error").mockImplementation(() => ""),
        vi.spyOn(toast, "success").mockImplementation(() => ""),
      ];
      publishReply = answer;
      setProject(null);
      const host = await render();
      await click(publishButton(host));
      expect(host.textContent?.split(line)).toHaveLength(2);
      for (const spy of toasts) {
        expect(spy).not.toHaveBeenCalled();
      }
    }
  );

  test("a publish that settles toasts nothing", async () => {
    const toasts = [
      vi.spyOn(toast, "error").mockImplementation(() => ""),
      vi.spyOn(toast, "success").mockImplementation(() => ""),
    ];
    setProject({ createdAt: minutesAgo(1), publishStatus: "PENDING" });
    await render();
    act(() => {
      setProject({ createdAt: minutesAgo(1), publishStatus: "FAILED" });
    });
    await settle();
    act(() => {
      setProject({ createdAt: minutesAgo(0), publishStatus: "PENDING" });
    });
    act(() => {
      setProject({ createdAt: minutesAgo(0), publishStatus: "PUBLISHED" });
    });
    await settle();
    for (const spy of toasts) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  test("has no launch links, no idle sentence and one button label", async () => {
    for (const build of [
      null,
      { createdAt: minutesAgo(5), publishStatus: "PUBLISHED" as const },
    ]) {
      setProject(build);
      const host = await render();
      for (const text of [
        "Launch",
        "Put it back",
        "Not published yet.",
        "Publish changes",
        "Publishing to",
        "offline",
      ]) {
        expect(host.textContent, text).not.toContain(text);
      }
      expect(publishButton(host)).toBeDefined();
      unmount();
    }
  });

  test("idle shows no status row; a pending publish reads Publishing, started and when", async () => {
    setProject(null);
    const idle = await render();
    expect(idle.textContent).not.toMatch(/Publish(ing|ed) /);
    unmount();
    setProject({ createdAt: minutesAgo(5), publishStatus: "PENDING" });
    const host = await render();
    expect(textOf(host, /^Publishing,/)).toBe(
      "Publishing, started 5 minutes ago"
    );
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

  test("the plan banner is titled Not in plan and links nowhere", async () => {
    setProject(null);
    // the default plan includes no custom contact email
    $projectSettings.set({
      meta: { contactEmail: "team@acme.org" },
      compiler: {},
    });
    const host = await render();
    const list = Array.from(host.querySelectorAll("ul")).find((item) =>
      item.textContent?.includes("Custom contact email")
    );
    expect(list?.previousElementSibling?.textContent).toBe("Not in plan");
    expect(list?.nextElementSibling).toBeNull();
    expect(
      links(host).filter(([, href]) => href?.includes("/website"))
    ).toEqual([]);
  });

  // The catalog's bindings, each a binding of a catalog Resource (a v5
  // resourceId), as every writer makes them: a block's binding as provisioning
  // writes it, a :root binding of the catalog, and a page's own binding
  const catalogBindings = async () => {
    const events = await getResourcePresetIds("project-1", "events");
    const forms = await getResourcePresetIds("project-1", "forms");
    const dataSources: DataSource[] = [
      {
        id: "page-events",
        type: "resource",
        name: "Events here",
        scopeInstanceId: "body",
        resourceId: events.resourceId,
      },
      {
        id: events.bindingId,
        type: "resource",
        name: "OrganizeOS Events",
        scopeInstanceId: "body",
        resourceId: events.resourceId,
      },
      {
        id: forms.bindingId,
        type: "resource",
        name: "OrganizeOS Forms",
        scopeInstanceId: ROOT_INSTANCE_ID,
        resourceId: forms.resourceId,
      },
    ];
    const resources: Resource[] = [events.resourceId, forms.resourceId].map(
      (id) => ({
        id,
        name: "Catalog",
        method: "get",
        url: '"https://app.organizeos.org/api/v1/events"',
        headers: [],
      })
    );
    return { dataSources, resources };
  };

  const setData = (dataSources: DataSource[], resources: Resource[]) => {
    $instances.set(
      new Map([
        [
          "body",
          { type: "instance", id: "body", component: "Body", children: [] },
        ],
      ])
    );
    $dataSources.set(new Map(dataSources.map((item) => [item.id, item])));
    $resources.set(new Map(resources.map((item) => [item.id, item])));
  };

  test("a project with catalog data sources and allowDynamicData: false renders the dialog, with no plan banner for them", async () => {
    // Every org project binds the catalog's Resources, which the platform
    // provides: they are not a plan feature (controller ruling)
    const { dataSources, resources } = await catalogBindings();
    setData(dataSources, resources);
    expect($planFeatures.get().allowDynamicData).toBe(false);
    setProject(null);
    const host = await render();
    expect(publishButton(host)).toBeDefined();
    expect(host.textContent).not.toContain(planBadgeLabel);
    expect(host.querySelectorAll("li")).toHaveLength(0);
  });

  // Only the Resource says what the catalog is (controller ruling): an own
  // Resource is a plan feature, through any binding id
  test.each([
    ["its own binding", async () => "own-binding"],
    [
      "a binding with a catalog-looking id",
      async () => (await getResourcePresetIds("project-1", "stats")).bindingId,
    ],
  ])(
    "an org's own Resource is still a plan feature beside the catalog's, through %s",
    async (_name, bindingId) => {
      const { dataSources, resources } = await catalogBindings();
      setData(
        [
          ...dataSources,
          {
            id: await bindingId(),
            type: "resource",
            name: "Our API",
            scopeInstanceId: ROOT_INSTANCE_ID,
            resourceId: "own-resource",
          },
        ],
        [
          ...resources,
          {
            id: "own-resource",
            name: "Our API",
            method: "get",
            url: '"https://api.acme.org/items"',
            headers: [],
          },
        ]
      );
      setProject(null);
      const host = await render();
      expect(textOf(host, /^Not in plan/)).toBe("Not in plan");
      expect(
        Array.from(host.querySelectorAll("li"), (item) => item.textContent)
      ).toEqual(["Resource variable"]);
    }
  );

  test("an MDX-bound Content Block shows that publishing fails while it uses MDX, and Publish to selected stays enabled", async () => {
    const instances: Instance[] = [
      {
        type: "instance",
        id: "body",
        component: "Body",
        children: [{ type: "id", value: "block" }],
      },
      {
        type: "instance",
        id: "block",
        component: blockComponent,
        children: [],
      },
      // on no page: publishing reads the whole build, so it counts too
      {
        type: "instance",
        id: "orphan",
        component: blockComponent,
        children: [],
      },
    ];
    $instances.set(new Map(instances.map((item) => [item.id, item])));
    $props.set(
      new Map(
        ["block", "orphan"].map((instanceId) => [
          `${instanceId}-src`,
          {
            id: `${instanceId}-src`,
            instanceId,
            name: "src",
            type: "asset",
            value: "doc",
          },
        ])
      )
    );
    $assets.set(
      new Map([
        [
          "doc",
          {
            id: "doc",
            projectId: "project-1",
            name: "doc_abc.mdx",
            type: "file",
            format: "mdx",
            size: 10,
            meta: {},
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      ])
    );
    setProject(null);
    const host = await render();
    const list = Array.from(host.querySelectorAll("ul")).find((item) =>
      item.textContent?.includes("Content Block")
    );
    // the heading and the list: nothing else
    expect(list?.previousElementSibling?.textContent).toBe(
      "Publishing fails while these use MDX:"
    );
    expect(list?.nextElementSibling).toBeNull();
    const items = Array.from(list?.querySelectorAll("li") ?? []);
    expect(items.map((item) => item.textContent)).toEqual([
      "Content Block on Home",
      "Content Block",
    ]);
    // the block on a page is a button to it; the orphan has nowhere to go
    expect(items[0].querySelector("button")).not.toBeNull();
    expect(items[1].querySelector("button")).toBeNull();
    expect(publishButton(host)?.disabled).toBe(false);
  });

  test("lists the custom code saved in project settings as paused", async () => {
    $projectSettings.set({
      meta: { code: "<script>1</script>" },
      compiler: {},
    });
    setProject(null);
    const host = await render();
    expect(
      Array.from(host.querySelectorAll("li"), (item) => item.textContent)
    ).toEqual(["Custom code (Project settings)"]);
  });

  test("Publish to selected has no tooltip", async () => {
    stubTooltipMeasuring();
    setProject(null);
    const host = await render();
    const before = document.body.textContent;
    hover(publishButton(host));
    // hovering it shows nothing new
    expect(document.body.textContent).toBe(before);
  });

  test("Manage domains opens the org's domain settings in OrganizeOS in a new tab", async () => {
    setProject(null);
    const host = await render();
    const link = Array.from(host.querySelectorAll("a")).find(
      (element) => element.textContent === "Manage domains ↗"
    );
    expect(link?.getAttribute("href")).toBe(
      "https://app.organizeos.org/acme/settings/domain"
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noreferrer");
  });
});

// OrganizeOS fork: input validation (organizeos-publish-code-check.ts)
describe("the Publish dialog with a value that fails input validation", () => {
  const clickPublish = async () => {
    const host = await render();
    await click(publishButton(host));
    return host;
  };

  beforeEach(() => {
    $instances.set(
      new Map([
        [
          "box",
          {
            type: "instance",
            id: "box",
            component: "Box",
            label: "Hero",
            children: [],
          },
        ],
      ])
    );
    setProject(null);
  });

  test("does not dispatch, and names the place", async () => {
    $props.set(
      new Map([
        [
          "p",
          {
            id: "p",
            instanceId: "box",
            name: "title",
            type: "expression",
            value: "a()",
          },
        ],
      ])
    );
    const host = await clickPublish();
    expect(publishCalls()).toEqual([]);
    expect(host.textContent).toContain(
      `Can't publish: the property "title" of "Hero".`
    );
  });

  test("a clean build publishes through the publish route", async () => {
    await clickPublish();
    await vi.waitFor(() => {
      expect(publishCalls()).toHaveLength(1);
    });
    await settle();
  });
});
