import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { coreMetas } from "@webstudio-is/sdk";
import { coreTemplates } from "@webstudio-is/sdk/core-templates";
import * as baseMetas from "@webstudio-is/sdk-components-react/metas";
import * as baseTemplates from "@webstudio-is/sdk-components-react/templates";
import * as radixMetas from "@webstudio-is/sdk-components-react-radix/metas";
import * as radixTemplates from "@webstudio-is/sdk-components-react-radix/templates";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $registeredTemplates,
  registerComponentLibrary,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $pages } from "~/shared/sync/data-stores";
import { registerContainers } from "~/shared/sync/sync-stores";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { insertWebstudioFragmentAt } from "~/shared/instance-utils/insert";
import { ComponentsPanel } from "~/builder/features/components";
import { insertOrganizeosBlock } from "./insert-organizeos-block";
import { getWorkspaceAreaUrl } from "./components-section";

vi.mock("./insert-organizeos-block", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./insert-organizeos-block")>();
  return {
    ...actual,
    insertOrganizeosBlock: vi.fn(actual.insertOrganizeosBlock),
  };
});

vi.mock("~/shared/instance-utils/insert", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/shared/instance-utils/insert")>();
  return {
    ...actual,
    insertWebstudioFragmentAt: vi.fn(actual.insertWebstudioFragmentAt),
  };
});

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Radix's ScrollArea observes its viewport, and jsdom 20 has no
// ResizeObserver (the stand-in of use-marquee.test.tsx).
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const namespace = "@organizeos/site-components";

const site: OrganizeosSite = {
  organizationId: "org-1",
  subdomain: "acme",
  siteUrl: "https://acme.organizeos.org",
  manageUrl: "https://app.organizeos.org/acme/website",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

// The libraries the canvas registers (canvas.tsx), the badge left out as
// there.
const { builtWithWebstudio: _builtWithWebstudio, ...registeredCoreTemplates } =
  coreTemplates;
$registeredComponentMetas.set(new Map());
$registeredTemplates.set(new Map());
registerComponentLibrary({
  components: {},
  metas: coreMetas,
  templates: registeredCoreTemplates,
});
registerComponentLibrary({
  components: {},
  metas: baseMetas,
  templates: baseTemplates,
});
registerComponentLibrary({
  namespace: "@webstudio-is/sdk-components-react-radix",
  components: {},
  metas: radixMetas,
  templates: radixTemplates,
});
registerComponentLibrary({
  namespace,
  components: {},
  metas: organizeosMetas,
  templates: organizeosTemplates,
});

let root: Root | undefined;
let container: HTMLElement | undefined;
const publish = vi.fn();
const onClose = vi.fn();

const setPage = (documentType: "html" | "xml" = "html") => {
  const pages = createDefaultPages({ rootInstanceId: "body" });
  const home = pages.pages.get(pages.homePageId)!;
  pages.pages.set(home.id, { ...home, meta: { ...home.meta, documentType } });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
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
        createElement(ComponentsPanel, { publish, onClose })
      )
    );
  });
  return container;
};

/** The section headings, in order (SectionTitleLabel renders a label). */
const headings = (host: HTMLElement) =>
  Array.from(host.querySelectorAll("label"), (label) => label.textContent);

const card = (host: HTMLElement, name: string) => {
  const element = host.querySelector<HTMLElement>(
    `[data-drag-component="${name}"]`
  );
  expect(element, name).not.toBeNull();
  return element!;
};

const search = (host: HTMLElement, value: string) => {
  const input = host.querySelector<HTMLInputElement>("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
};

const pressEnter = (input: HTMLInputElement) => {
  act(() => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Enter", bubbles: true })
    );
  });
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.mocked(insertOrganizeosBlock).mockClear();
  vi.mocked(insertWebstudioFragmentAt).mockClear();
  publish.mockClear();
  onClose.mockClear();
  $organizeosSite.set(site);
  setPage();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("the Components panel's OrganizeOS section", () => {
  test("headings in the order General, OrganizeOS, then upstream's", () => {
    const host = render();
    const titles = headings(host);
    expect(titles.slice(0, 3)).toEqual(["General", "OrganizeOS", "Typography"]);
    expect(titles.filter((title) => title === "OrganizeOS")).toHaveLength(1);
    // the blocks, in the sections' order
    const section = host
      .querySelector("[data-organizeos-links]")
      ?.closest("[data-state]");
    expect(
      Array.from(
        section?.querySelectorAll("[data-drag-component]") ?? [],
        (element) => element.getAttribute("data-drag-component")
      )
    ).toEqual(
      [
        "RotatingTabs",
        "Marquee",
        "ConvergenceField",
        "EventList",
        "EventCard",
        "RsvpForm",
        "SignupForm",
      ].map((name) => `${namespace}:${name}`)
    );
  });

  test("a click on Signup Form calls insertOrganizeosBlock, not insertWebstudioFragmentAt", () => {
    const host = render();
    act(() => {
      card(host, `${namespace}:SignupForm`).click();
    });
    expect(insertOrganizeosBlock).toHaveBeenCalledTimes(1);
    expect(insertOrganizeosBlock).toHaveBeenCalledWith(
      `${namespace}:SignupForm`
    );
    expect(insertWebstudioFragmentAt).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Upstream's General lists Element (inserted by insertWebstudioElementAt)
  // and Link, a template; Box is hidden. Link is the General card that
  // inserts through insertWebstudioFragmentAt.
  test("a click on Link still inserts through insertWebstudioFragmentAt", () => {
    const host = render();
    act(() => {
      card(host, "link").click();
    });
    expect(insertWebstudioFragmentAt).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(insertWebstudioFragmentAt).mock.calls[0][0].instances[0]
    ).toMatchObject({ component: "ws:element", tag: "a" });
    expect(insertOrganizeosBlock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Enter after typing event list inserts the Event List through insertOrganizeosBlock", () => {
    const host = render();
    const input = search(host, "event list");
    pressEnter(input);
    expect(insertOrganizeosBlock).toHaveBeenCalledWith(
      `${namespace}:EventList`
    );
    expect(insertWebstudioFragmentAt).not.toHaveBeenCalled();
  });

  test("rsvp, which upstream does not match, shows one Found list holding the RSVP Form, and Enter inserts it through insertOrganizeosBlock", () => {
    const host = render();
    const input = search(host, "rsvp");
    expect(headings(host)).toEqual(["Found"]);
    expect(
      Array.from(host.querySelectorAll("[data-drag-component]"), (element) =>
        element.getAttribute("data-drag-component")
      )
    ).toEqual([`${namespace}:RsvpForm`]);
    pressEnter(input);
    expect(insertOrganizeosBlock).toHaveBeenCalledWith(`${namespace}:RsvpForm`);
    expect(insertWebstudioFragmentAt).not.toHaveBeenCalled();
  });

  test("each link's href equals getWorkspaceAreaUrl", () => {
    const host = render();
    const links = Array.from(
      host.querySelectorAll<HTMLAnchorElement>("[data-organizeos-links] a")
    );
    expect(
      links.map((link) => [
        link.textContent,
        link.getAttribute("href"),
        link.getAttribute("target"),
        link.getAttribute("rel"),
      ])
    ).toEqual([
      [
        "Manage events in OrganizeOS",
        getWorkspaceAreaUrl(site, "events"),
        "_blank",
        "noreferrer",
      ],
      [
        "Manage forms in OrganizeOS",
        getWorkspaceAreaUrl(site, "pages/embeds"),
        "_blank",
        "noreferrer",
      ],
    ]);
  });

  test("no OrganizeOS section off the allowlist", () => {
    $organizeosSite.set({ ...site, blocksEnabled: false });
    const host = render();
    expect(headings(host)).not.toContain("OrganizeOS");
    expect(host.querySelector(`[data-drag-component^="${namespace}:"]`)).toBe(
      null
    );
    expect(host.querySelector("[data-organizeos-links]")).toBeNull();
    // nor found by a search
    search(host, "rsvp");
    expect(host.querySelector(`[data-drag-component^="${namespace}:"]`)).toBe(
      null
    );
  });

  test("none on an XML page", () => {
    setPage("xml");
    const host = render();
    expect(headings(host)).not.toContain("OrganizeOS");
    expect(host.querySelector(`[data-drag-component^="${namespace}:"]`)).toBe(
      null
    );
    expect(host.querySelector("[data-organizeos-links]")).toBeNull();
  });

  test("a pointer drag from an OrganizeOS card publishes dragStart with origin panel and the block's name", () => {
    const host = render();
    const eventCard = card(host, `${namespace}:EventCard`);
    const clientX = 10;
    const clientY = 10;
    // jsdom 20 has no PointerEvent: useDrag reads button, the coordinates and
    // pointerId (undefined on both)
    act(() => {
      eventCard.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX,
          clientY,
        })
      );
    });
    act(() => {
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          bubbles: true,
          clientX: clientX + 4,
          clientY,
        })
      );
    });
    expect(publish).toHaveBeenCalledWith({
      type: "dragStart",
      payload: {
        origin: "panel",
        type: "insert",
        dragComponent: `${namespace}:EventCard`,
      },
    });
  });
});
