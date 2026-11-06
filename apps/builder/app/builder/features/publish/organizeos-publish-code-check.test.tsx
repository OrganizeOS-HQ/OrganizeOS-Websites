import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import type { Instance, Prop } from "@webstudio-is/sdk";
import {
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import { findPublishBlocker } from "./organizeos-publish-code-check";
import { OrganizeosPublishContent } from "./organizeos-publish";

const { publish, routeFetch } = vi.hoisted(() => ({
  publish: vi.fn(),
  routeFetch: vi.fn(),
}));

vi.mock("~/shared/fetch.client", () => ({
  fetch: (...args: unknown[]) => routeFetch(...args),
}));

vi.mock("~/shared/trpc/trpc-client", () => ({
  nativeClient: {
    domain: {
      publish: { mutate: publish },
      project: { query: vi.fn(async () => ({ success: false })) },
    },
  },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const box: Instance = {
  type: "instance",
  id: "box",
  component: "Box",
  label: "Hero",
  children: [],
};

const expressionProp = (value: string): Prop => ({
  id: "p",
  instanceId: "box",
  name: "title",
  type: "expression",
  value,
});

const stores = () => ({
  pages: $pages.get(),
  instances: $instances.get(),
  props: $props.get(),
  resources: $resources.get(),
  dataSources: $dataSources.get(),
});

beforeEach(() => {
  $pages.set(createDefaultPages({ rootInstanceId: "body" }));
  $instances.set(new Map([["box", box]]));
  $props.set(new Map());
  $resources.set(new Map());
  $dataSources.set(new Map());
  $project.set({
    id: "project-1",
    domain: "acme",
    latestBuildVirtual: null,
  } as unknown as Project);
  publish.mockReset();
  publish.mockResolvedValue({ success: true });
  routeFetch.mockReset();
  routeFetch.mockResolvedValue(Response.json({ ok: false }));
});

describe("findPublishBlocker", () => {
  test("names the element and the field in one line", () => {
    $props.set(new Map([["p", expressionProp("a()")]]));
    expect(findPublishBlocker(stores())).toBe(
      `Can't publish: the property "title" of "Hero". This function is not allowed.`
    );
  });

  test("names a page by its name", () => {
    const pages = createDefaultPages({ rootInstanceId: "body" });
    const home = pages.pages.get(pages.homePageId);
    if (home === undefined) {
      throw new Error("no home page");
    }
    home.meta.description = "a()";
    $pages.set(pages);
    expect(findPublishBlocker(stores())).toBe(
      `Can't publish: the description of page "${home.name}". This function is not allowed.`
    );
  });

  test("an element with no label is named by its component", () => {
    $instances.set(new Map([["box", { ...box, label: undefined }]]));
    $props.set(new Map([["p", expressionProp("a()")]]));
    expect(findPublishBlocker(stores())).toContain(`of "Box"`);
  });

  test("a clean build has none", () => {
    $props.set(new Map([["p", expressionProp(`"a"`)]]));
    expect(findPublishBlocker(stores())).toBeUndefined();
  });
});

describe("the Publish dialog with a value that fails input validation", () => {
  let root: Root | undefined;
  let container: HTMLElement | undefined;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
  });

  const clickPublish = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(
        createElement(
          TooltipProvider,
          null,
          createElement(OrganizeosPublishContent, {
            site: {
              organizationId: "org-1",
              subdomain: "acme",
              manageUrl: "https://app.organizeos.org/acme/website",
              platformUrl: "https://app.organizeos.org",
              blocksEnabled: true,
            },
          })
        )
      );
    });
    const button = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent === "Publish"
    );
    await act(async () => {
      button?.click();
      await Promise.resolve();
    });
    return container;
  };

  test("does not dispatch, and names the place", async () => {
    $props.set(new Map([["p", expressionProp("a()")]]));
    const dom = await clickPublish();
    expect(publish).not.toHaveBeenCalled();
    expect(dom.textContent).toContain(
      `Can't publish: the property "title" of "Hero".`
    );
  });

  test("a clean build dispatches as before", async () => {
    await clickPublish();
    expect(publish).toHaveBeenCalledWith({
      projectId: "project-1",
      domains: ["acme"],
      destination: "saas",
    });
  });
});
