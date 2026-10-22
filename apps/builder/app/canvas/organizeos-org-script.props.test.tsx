/**
 * @vitest-environment jsdom
 */
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import { setEnv } from "@webstudio-is/feature-flags";
import { elementComponent, type Instance, type Prop } from "@webstudio-is/sdk";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import * as baseComponents from "@webstudio-is/sdk-components-react/components";
import * as baseComponentMetas from "@webstudio-is/sdk-components-react/metas";
import * as baseComponentTemplates from "@webstudio-is/sdk-components-react/templates";
import {
  $registeredComponents,
  registerComponentLibrary,
} from "~/shared/nano-states";
import { $instances, $pages, $props } from "~/shared/sync/data-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import { createInstanceElement } from "./elements";
import {
  WebstudioComponentCanvas,
  WebstudioComponentPreview,
} from "./features/webstudio-component";
import { withOrgScriptPolicy } from "./organizeos-org-script";

// The canvas copies every prop of an instance onto its component, so a prop
// named dangerouslySetInnerHTML would put raw markup into the builder's own
// origin, which holds the platform session (docs/ORGANIZEOS-FORK.md section 10)

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
registerContainers();
setEnv("*");

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  $instances.set(new Map());
  $props.set(new Map());
});

const ids = (...list: string[]): Instance["children"] =>
  list.map((value) => ({ type: "id", value }));

const instance = (init: Partial<Instance> & Pick<Instance, "id">) =>
  [
    init.id,
    { type: "instance", component: elementComponent, children: [], ...init },
  ] as [string, Instance];

const html = '<img id="pwn" src="x" onerror="window.pwned=1">';

type Renderer = "canvas" | "preview";

const render = ({
  instances,
  props,
  renderer,
}: {
  instances: Array<[string, Instance]>;
  props: Array<[string, Prop]>;
  renderer: Renderer;
}) => {
  // the library the canvas registers, with org script paused
  registerComponentLibrary(
    withOrgScriptPolicy({
      components: baseComponents,
      metas: baseComponentMetas,
      templates: baseComponentTemplates,
    })
  );
  $instances.set(new Map(instances));
  $props.set(new Map(props));
  $pages.set(
    createDefaultPages({ homePageId: "home", rootInstanceId: "body" })
  );
  $selectedPageId.set("home");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <ReactSdkContext.Provider
        value={{
          renderer,
          assetBaseUrl: "/",
          imageLoader: () => "",
          resources: {},
          breakpoints: [],
          onError: console.error,
        }}
      >
        {createInstanceElement({
          instances: $instances.get(),
          instanceId: "body",
          instanceSelector: ["body"],
          Component:
            renderer === "preview"
              ? WebstudioComponentPreview
              : WebstudioComponentCanvas,
          components: $registeredComponents.get(),
        })}
      </ReactSdkContext.Provider>
    );
  });
  return container;
};

const renderers: Renderer[] = ["canvas", "preview"];

describe.each(renderers)(
  "the %s renders an instance with a raw HTML prop",
  (renderer) => {
    beforeEach(() => {
      (window as { pwned?: number }).pwned = undefined;
    });

    test("without the markup, on a ws:element with a JSON value and with an expression", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("json", "expression") }),
          instance({ id: "json", tag: "div" }),
          instance({ id: "expression", tag: "div" }),
        ],
        props: [
          [
            "json-html",
            {
              id: "json-html",
              instanceId: "json",
              name: "dangerouslySetInnerHTML",
              type: "json",
              value: { __html: html },
            },
          ],
          [
            "json-id",
            {
              id: "json-id",
              instanceId: "json",
              name: "id",
              type: "string",
              value: "json",
            },
          ],
          [
            "expression-html",
            {
              id: "expression-html",
              instanceId: "expression",
              name: "dangerouslySetInnerHTML",
              type: "expression",
              value: '{__html: "<img id=pwn2 src=x>"}',
            },
          ],
        ],
      });

      expect(dom.querySelector("img")).toBeNull();
      expect(dom.querySelector("#pwn")).toBeNull();
      expect(dom.querySelector("#pwn2")).toBeNull();
      // the element stays, with its other props
      expect(dom.querySelector("#json")).not.toBeNull();
      expect(dom.querySelectorAll("div").length).toBeGreaterThanOrEqual(3);
    });

    test("without the markup, on a Box", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("box") }),
          instance({ id: "box", component: "Box" }),
        ],
        props: [
          [
            "box-html",
            {
              id: "box-html",
              instanceId: "box",
              name: "dangerouslySetInnerHTML",
              type: "json",
              value: { __html: "<script>window.pwned=1</script>" + html },
            },
          ],
        ],
      });

      expect(dom.querySelector("img")).toBeNull();
      expect(dom.querySelector("script")).toBeNull();
      expect((window as { pwned?: number }).pwned).toBeUndefined();
    });

    test("keeps the other props, whatever they look like", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("kept") }),
          instance({ id: "kept", tag: "div" }),
        ],
        props: [
          [
            "kept-id",
            {
              id: "kept-id",
              instanceId: "kept",
              name: "id",
              type: "string",
              value: "kept",
            },
          ],
          [
            "kept-title",
            {
              id: "kept-title",
              instanceId: "kept",
              name: "title",
              type: "string",
              value: "dangerouslySetInnerHTML",
            },
          ],
        ],
      });

      const kept = dom.querySelector("#kept");
      expect(kept?.getAttribute("title")).toBe("dangerouslySetInnerHTML");
    });
  }
);
