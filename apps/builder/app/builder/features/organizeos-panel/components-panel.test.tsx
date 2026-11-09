import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { canvasComponentLibraries } from "@webstudio-is/sdk-components-registry/canvas";
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
import { insertWebstudioComponentAt } from "~/shared/instance-utils/insert";
import {
  withOrgScriptPolicy,
  withoutBuiltWithWebstudio,
} from "~/canvas/organizeos-org-script";
import { ComponentsPanel } from "~/builder/features/components";
import { insertOrganizeosBlock } from "./insert-organizeos-block";

// Spied, not replaced: a factory that imports the original module waits on
// itself in the browser runner (both modules are in import cycles).
vi.mock("./insert-organizeos-block", { spy: true });
vi.mock("~/shared/instance-utils/insert", { spy: true });

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Radix's ScrollArea observes its viewport (the stand-in of
// use-marquee.test.tsx).
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const namespace = "@organizeos/site-components";

const site: OrganizeosSite = {
  organizationId: "org-1",
  subdomain: "acme",
  manageUrl: "https://app.organizeos.org/acme/website",
  platformUrl: "https://app.organizeos.org",
  blocksEnabled: true,
};

// The libraries the canvas registers (canvas.tsx), as it registers them.
$registeredComponentMetas.set(new Map());
$registeredTemplates.set(new Map());
for (const library of canvasComponentLibraries) {
  registerComponentLibrary(
    withOrgScriptPolicy(withoutBuiltWithWebstudio(library))
  );
}
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
  // a template insert is upstream's, and not what is tested here
  vi.mocked(insertWebstudioComponentAt).mockReset();
  vi.mocked(insertWebstudioComponentAt).mockImplementation(() => true);
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
        "RichText",
        "EventList",
        "EventCard",
        "RsvpForm",
        "SignupForm",
        "SignupFormInline",
      ].map((name) => `${namespace}:${name}`)
    );
  });

  test("a click on Signup Form calls insertOrganizeosBlock, not insertWebstudioComponentAt", () => {
    const host = render();
    act(() => {
      card(host, `${namespace}:SignupForm`).click();
    });
    expect(insertOrganizeosBlock).toHaveBeenCalledTimes(1);
    expect(insertOrganizeosBlock).toHaveBeenCalledWith(
      `${namespace}:SignupForm`
    );
    expect(insertWebstudioComponentAt).not.toHaveBeenCalled();
    // closed at once: the block's insert is not awaited
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Upstream's General lists Link, a template, which upstream inserts
  // through insertWebstudioComponentAt.
  test("a click on Link still inserts through insertWebstudioComponentAt", async () => {
    const host = render();
    act(() => {
      card(host, "link").click();
    });
    expect(insertWebstudioComponentAt).toHaveBeenCalledTimes(1);
    expect(insertWebstudioComponentAt).toHaveBeenCalledWith("link");
    expect(insertOrganizeosBlock).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  test("Enter after typing event list inserts the Event List through insertOrganizeosBlock", () => {
    const host = render();
    const input = search(host, "event list");
    pressEnter(input);
    expect(insertOrganizeosBlock).toHaveBeenCalledWith(
      `${namespace}:EventList`
    );
    expect(insertWebstudioComponentAt).not.toHaveBeenCalled();
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
    expect(insertWebstudioComponentAt).not.toHaveBeenCalled();
  });

  test("one Manage link, to the org's Website area", () => {
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
        "Manage in OrganizeOS ↗",
        // the Website area, where the builder's menu leads too
        "https://app.organizeos.org/acme/website",
        "_blank",
        "noreferrer",
      ],
    ]);
  });

  test("no OrganizeOS section for a denied org", () => {
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

  test("with the Shop blocks switch on, Product Grid and Product Card follow the Signups, and a search finds both", () => {
    $organizeosSite.set({ ...site, shopBlocksEnabled: true });
    const host = render();
    const section = host
      .querySelector("[data-organizeos-links]")
      ?.closest("[data-state]");
    expect(
      Array.from(
        section?.querySelectorAll("[data-drag-component]") ?? [],
        (element) => element.getAttribute("data-drag-component")
      ).slice(-3)
    ).toEqual(
      ["SignupFormInline", "ProductGrid", "ProductCard"].map(
        (name) => `${namespace}:${name}`
      )
    );
    search(host, "product");
    const found = Array.from(
      host.querySelectorAll("[data-drag-component]"),
      (element) => element.getAttribute("data-drag-component")
    );
    expect(found).toContain(`${namespace}:ProductGrid`);
    expect(found).toContain(`${namespace}:ProductCard`);
  });

  test("with the Shop blocks switch off, neither is listed or found", () => {
    const host = render();
    expect(
      host.querySelector(`[data-drag-component="${namespace}:ProductGrid"]`)
    ).toBeNull();
    search(host, "product");
    expect(
      host.querySelector(`[data-drag-component^="${namespace}:Product"]`)
    ).toBeNull();
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
    // the mouse's pointer (id 1), whose capture react-aria releases on press
    const pointer = { pointerId: 1, pointerType: "mouse", isPrimary: true };
    act(() => {
      eventCard.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...pointer,
          bubbles: true,
          button: 0,
          clientX,
          clientY,
        })
      );
    });
    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
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
