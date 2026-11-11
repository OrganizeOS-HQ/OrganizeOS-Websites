import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { $project } from "~/shared/sync/data-stores";
import { $organizeosSite } from "~/shared/nano-states";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import type {
  SiteAddresses,
  SiteTarget,
} from "~/builder/features/publish/organizeos-publish-addresses";
import { SectionDomains } from "./section-domains";

const { loadSiteAddresses } = vi.hoisted(() => ({
  loadSiteAddresses: vi.fn<(projectId: string) => Promise<unknown>>(),
}));

vi.mock(
  "~/builder/features/publish/organizeos-publish-addresses",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    loadSiteAddresses: (projectId: string) => loadSiteAddresses(projectId),
  })
);

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

const target = (change: Partial<SiteTarget>): SiteTarget => ({
  key: "example.net",
  host: "example.net",
  builtin: false,
  main: false,
  publishedAt: null,
  live: false,
  ...change,
});

const addresses = (change: Partial<SiteAddresses>): SiteAddresses => ({
  host: "acme.organizeos.org",
  origin: "https://acme.organizeos.org",
  status: "live",
  manageDomainsUrl: "https://app.organizeos.org/acme/settings/domain?from=read",
  ...change,
});

let root: Root | undefined;
let container: HTMLElement;

beforeEach(() => {
  loadSiteAddresses.mockReset();
  $project.set({ id: "project-1" } as Project);
  $organizeosSite.set(site);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  $organizeosSite.set(undefined);
  $project.set(undefined);
});

const render = async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <SectionDomains />
      </TooltipProvider>
    );
  });
};

const manageLink = () =>
  [...container.querySelectorAll("a")].find((link) =>
    link.textContent?.includes("Manage domains")
  );

test("it reads the addresses of the project in the builder", async () => {
  loadSiteAddresses.mockResolvedValue(addresses({}));
  await render();
  expect(loadSiteAddresses).toHaveBeenCalledWith("project-1");
});

test("targets render as text rows in order, with the popup's labels", async () => {
  loadSiteAddresses.mockResolvedValue(
    addresses({
      targets: [
        target({ key: "builtin", host: "acme.organizeos.org", builtin: true }),
        target({ key: "www.acme.org", host: "www.acme.org", main: true }),
        target({ key: "acme.net", host: "acme.net" }),
      ],
    })
  );
  await render();
  const text = container.textContent ?? "";
  expect(text).toContain("Domains");
  const order = ["acme.organizeos.org", "www.acme.org", "acme.net"].map(
    (host) => text.indexOf(host)
  );
  expect(order.every((index) => index >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(text).toContain("Built-in");
  expect(text).toContain("Main");
  expect(text.indexOf("Built-in")).toBeLessThan(text.indexOf("www.acme.org"));
  // hosts are text, not links: only Manage domains is a link
  expect(
    [...container.querySelectorAll("a")].map((link) => link.textContent)
  ).toEqual(["Manage domains ↗"]);
});

test("without targets the row is the answer's host", async () => {
  loadSiteAddresses.mockResolvedValue(addresses({ host: "acme.example.org" }));
  await render();
  expect(container.textContent).toContain("acme.example.org");
  expect(container.textContent).not.toContain("Built-in");
});

test("with an empty targets list the row is the answer's host", async () => {
  loadSiteAddresses.mockResolvedValue(
    addresses({ host: "acme.example.org", targets: [] })
  );
  await render();
  expect(container.textContent).toContain("acme.example.org");
});

test("a read that settles after the section closed sets nothing", async () => {
  let settle: (value: SiteAddresses) => void = () => {};
  loadSiteAddresses.mockReturnValue(
    new Promise<SiteAddresses>((resolve) => {
      settle = resolve;
    })
  );
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  await render();
  const closed = root;
  act(() => closed?.unmount());
  root = undefined;
  await act(async () => {
    settle(addresses({ host: "late.example.org" }));
  });
  expect(container.textContent).not.toContain("late.example.org");
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});

test("a read for a project the section no longer shows sets nothing", async () => {
  let settleFirst: (value: SiteAddresses) => void = () => {};
  loadSiteAddresses.mockImplementation((projectId) =>
    projectId === "project-1"
      ? new Promise<SiteAddresses>((resolve) => {
          settleFirst = resolve;
        })
      : Promise.resolve(addresses({ host: "second.example.org" }))
  );
  await render();
  await act(async () => {
    $project.set({ id: "project-2" } as Project);
  });
  await act(async () => {
    settleFirst(addresses({ host: "first.example.org" }));
  });
  expect(container.textContent).toContain("second.example.org");
  expect(container.textContent).not.toContain("first.example.org");
});

test("a failed read shows one line, and the link falls back to the site", async () => {
  loadSiteAddresses.mockResolvedValue(undefined);
  await render();
  expect(container.textContent).toContain("Couldn't load domains");
  expect(manageLink()?.getAttribute("href")).toBe(
    "https://app.organizeos.org/acme/settings/domain"
  );
});

test("Manage domains carries the read's URL and opens in a new tab", async () => {
  loadSiteAddresses.mockResolvedValue(addresses({}));
  await render();
  const link = manageLink();
  expect(link?.getAttribute("href")).toBe(
    "https://app.organizeos.org/acme/settings/domain?from=read"
  );
  expect(link?.getAttribute("target")).toBe("_blank");
  expect(link?.getAttribute("rel")).toBe("noreferrer");
  expect(container.textContent).not.toContain("Couldn't load domains");
});

test("without a read or a subdomain there is no link", async () => {
  $organizeosSite.set({ ...site, subdomain: undefined });
  loadSiteAddresses.mockResolvedValue(undefined);
  await render();
  expect(manageLink()).toBeUndefined();
});

test("a host holding markup renders as text", async () => {
  const markup = '<img src="x" onerror="alert(1)">';
  loadSiteAddresses.mockResolvedValue(
    addresses({ targets: [target({ key: "x", host: markup })] })
  );
  await render();
  expect(container.querySelector("img")).toBeNull();
  expect(container.textContent).toContain(markup);
});
