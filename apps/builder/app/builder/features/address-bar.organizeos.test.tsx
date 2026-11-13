import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import {
  $organizeosSite,
  $stagingPassword,
  $stagingUsername,
} from "~/shared/nano-states";
import { $pages, $project, $publisherHost } from "~/shared/sync/data-stores";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { AddressBarPopover } from "./address-bar";
import { resetSiteOrigins } from "./publish/organizeos-site-origin";

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
let container: HTMLElement | undefined;
const writeText = vi.fn();

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
      createElement(TooltipProvider, null, createElement(AddressBarPopover))
    );
  });
  await settle();
};

const copyButton = () =>
  container?.querySelector<HTMLButtonElement>("[aria-label='Copy page URL']");

beforeEach(() => {
  resetSiteOrigins();
  $pages.set(createDefaultPages({ rootInstanceId: "body" }));
  $project.set({ id: "project-1", domain: "acme" } as unknown as Project);
  $publisherHost.set("organizeos.org");
  $stagingUsername.set("staging-user");
  $stagingPassword.set("staging-secret");
  routeFetch.mockReset();
  writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  $organizeosSite.set(undefined);
  $stagingUsername.set(undefined);
  $stagingPassword.set(undefined);
});

describe("address bar for an OrganizeOS site", () => {
  beforeEach(() => {
    $organizeosSite.set(site);
  });

  test("copies the main host's address, with no credentials", async () => {
    routeFetch.mockResolvedValue(
      Response.json({
        ok: true,
        host: "www.example.org",
        origin: "https://www.example.org",
        status: "live",
        manageDomainsUrl: "https://app.organizeos.org/acme/settings/domain",
      })
    );
    await render();
    act(() => copyButton()?.click());
    expect(writeText).toHaveBeenCalledWith("https://www.example.org/");
    expect(routeFetch).toHaveBeenCalledTimes(1);
  });

  test("offers no copy while the read is pending", async () => {
    routeFetch.mockReturnValue(new Promise(() => {}));
    await render();
    expect(copyButton()?.disabled).toBe(true);
    act(() => copyButton()?.click());
    expect(writeText).not.toHaveBeenCalled();
  });

  test("offers no copy when the read failed", async () => {
    routeFetch.mockResolvedValue(new Response("{}", { status: 503 }));
    await render();
    expect(copyButton()?.disabled).toBe(true);
    act(() => copyButton()?.click());
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("address bar for another project", () => {
  test("keeps the upstream address, with the staging credentials", async () => {
    $organizeosSite.set(undefined);
    await render();
    act(() => copyButton()?.click());
    expect(writeText).toHaveBeenCalledWith(
      "https://staging-user:staging-secret@acme.organizeos.org/"
    );
    expect(routeFetch).not.toHaveBeenCalled();
  });
});
