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
import * as radixComponents from "@webstudio-is/sdk-components-react-radix";
import * as radixComponentMetas from "@webstudio-is/sdk-components-react-radix/metas";
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
// origin, which holds the platform session (docs/ORGANIZEOS-FORK.md section 10).
// The same holds for the element it creates: a tag that is not one the builder
// offers must not reach React, which hoists a <script async src> into the
// document's <head> and runs it.

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
  for (const script of evilScripts()) {
    script.remove();
  }
});

// React puts a hoisted <script async src> in document.head, outside the
// container, so look at the whole document
const evilScripts = () =>
  document.querySelectorAll<HTMLScriptElement>('script[src*="evil.example"]');

const ids = (...list: string[]): Instance["children"] =>
  list.map((value) => ({ type: "id", value }));

const instance = (init: Partial<Instance> & Pick<Instance, "id">) =>
  [
    init.id,
    { type: "instance", component: elementComponent, children: [], ...init },
  ] as [string, Instance];

const html = '<img id="pwn" src="x" onerror="window.pwned=1">';

const radixNamespace = "@webstudio-is/sdk-components-react-radix";

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
  registerComponentLibrary({
    namespace: radixNamespace,
    components: radixComponents as never,
    metas: radixComponentMetas,
    templates: {},
  });
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

const prop = (
  instanceId: string,
  name: string,
  type: "string" | "boolean" | "expression",
  value: string | boolean
) => {
  const id = `${instanceId}:${name}`;
  return [id, { id, instanceId, name, type, value } as Prop] as [string, Prop];
};

describe.each(renderers)(
  "the %s renders an instance whose tag is not one the builder offers",
  (renderer) => {
    // React hoists a <script async src> into <head> and creates it with
    // document.createElement, so a browser fetches and runs it. Each case has
    // its own src, because React dedupes hoisted scripts by src.
    const src = (name: string) => `https://evil.example/${renderer}-${name}.js`;

    const expectNoScript = (dom: HTMLElement) => {
      expect(evilScripts().length).toBe(0);
      expect(dom.querySelector("script")).toBeNull();
    };

    test("without a script, on a ws:element with tag script, an async prop and a src", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("script") }),
          instance({ id: "script", tag: "script" }),
        ],
        props: [
          prop("script", "src", "string", src("element")),
          prop("script", "async", "boolean", true),
        ],
      });

      expectNoScript(dom);
      // the element is still there, as a div
      expect(dom.querySelector("[data-ws-id=script]")?.tagName).toBe("DIV");
    });

    test("without a script, on a ws:element with the tag SCRIPT and inline code", () => {
      // React creates anything but the exact string "script" with
      // document.createElement, which makes a live script element
      const dom = render({
        renderer,
        instances: [
          instance({
            id: "body",
            children: ids("upper", "mixed"),
          }),
          instance({
            id: "upper",
            tag: "SCRIPT",
            children: [{ type: "text", value: "window.pwned = 1" }],
          }),
          instance({ id: "mixed", tag: "Script" }),
        ],
        props: [
          prop("upper", "src", "string", src("upper")),
          prop("mixed", "src", "string", src("mixed")),
        ],
      });

      expectNoScript(dom);
      expect(dom.querySelector("[data-ws-id=upper]")?.tagName).toBe("DIV");
      expect(dom.querySelector("[data-ws-id=mixed]")?.tagName).toBe("DIV");
    });

    // each falls back to its own default element
    test.each([
      ["Box", "DIV"],
      ["Text", "DIV"],
      ["Heading", "H1"],
    ])(
      "without a script, on a %s with a data-ws-tag prop of script and an async expression",
      (component, fallback) => {
        const dom = render({
          renderer,
          instances: [
            instance({ id: "body", children: ids("c") }),
            instance({ id: "c", component }),
          ],
          props: [
            prop("c", "data-ws-tag", "string", "script"),
            prop("c", "src", "string", src(`data-ws-tag-${component}`)),
            prop("c", "async", "expression", "true"),
          ],
        });

        expectNoScript(dom);
        expect(dom.querySelector("[data-ws-id=c]")?.tagName).toBe(fallback);
      }
    );

    test("without a script, on a Box whose instance tag is script", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("box") }),
          instance({ id: "box", component: "Box", tag: "script" }),
        ],
        props: [
          prop("box", "src", "string", src("instance-tag")),
          prop("box", "async", "boolean", true),
        ],
      });

      expectNoScript(dom);
      expect(dom.querySelector("[data-ws-id=box]")?.tagName).toBe("DIV");
    });

    test("without a script, on a Box whose legacy tag prop is an expression that evaluates to script", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("box") }),
          instance({ id: "box", component: "Box" }),
        ],
        props: [
          prop("box", "tag", "expression", '"scr" + "ipt"'),
          prop("box", "src", "string", src("legacy-tag")),
          prop("box", "async", "expression", "true"),
        ],
      });

      expectNoScript(dom);
      expect(dom.querySelector("[data-ws-id=box]")?.tagName).toBe("DIV");
    });

    test("without a script, on a Dialog Title whose tag is an expression that evaluates to script", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("dialog") }),
          instance({
            id: "dialog",
            component: `${radixNamespace}:Dialog`,
            children: ids("title"),
          }),
          instance({ id: "title", component: `${radixNamespace}:DialogTitle` }),
        ],
        props: [
          prop("dialog", "open", "boolean", true),
          prop("title", "tag", "expression", '"script"'),
          prop("title", "src", "string", src("dialog-title")),
          prop("title", "async", "expression", "true"),
        ],
      });

      expectNoScript(dom);
      // the title is rendered, with the component's own tag
      expect(document.querySelector("[data-ws-id=title]")).not.toBeNull();
    });

    test("without crashing, on a tag prop whose value is not a string", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("number", "array") }),
          instance({ id: "number", component: "Box" }),
          instance({ id: "array", component: "Text" }),
        ],
        props: [
          prop("number", "tag", "expression", "1"),
          prop("array", "data-ws-tag", "expression", '["h1"]'),
        ],
      });

      expect(dom.querySelector("[data-ws-id=number]")?.tagName).toBe("DIV");
      expect(dom.querySelector("[data-ws-id=array]")?.tagName).toBe("DIV");
    });

    // The guards: an element the builder offers is created as before
    test("keeps a ws:element whose tag the builder offers", () => {
      const dom = render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("section", "svg") }),
          instance({ id: "section", tag: "section" }),
          instance({ id: "svg", tag: "svg" }),
        ],
        props: [],
      });

      expect(dom.querySelector("[data-ws-id=section]")?.tagName).toBe(
        "SECTION"
      );
      expect(dom.querySelector("[data-ws-id=svg]")?.tagName).toBe("svg");
    });

    test("keeps the tag a Box, a Heading and a Dialog Title are given, when the builder offers it", () => {
      const dom = render({
        renderer,
        instances: [
          instance({
            id: "body",
            children: ids("box", "legacy", "heading", "dialog"),
          }),
          instance({ id: "box", component: "Box", tag: "nav" }),
          instance({ id: "legacy", component: "Box" }),
          instance({ id: "heading", component: "Heading" }),
          instance({
            id: "dialog",
            component: `${radixNamespace}:Dialog`,
            children: ids("title"),
          }),
          instance({ id: "title", component: `${radixNamespace}:DialogTitle` }),
        ],
        props: [
          prop("legacy", "tag", "string", "aside"),
          prop("heading", "data-ws-tag", "expression", '"h3"'),
          prop("dialog", "open", "boolean", true),
          prop("title", "tag", "expression", '"h4"'),
        ],
      });

      expect(dom.querySelector("[data-ws-id=box]")?.tagName).toBe("NAV");
      expect(dom.querySelector("[data-ws-id=legacy]")?.tagName).toBe("ASIDE");
      expect(dom.querySelector("[data-ws-id=heading]")?.tagName).toBe("H3");
      expect(document.querySelector("[data-ws-id=title]")?.tagName).toBe("H4");
    });
  }
);
