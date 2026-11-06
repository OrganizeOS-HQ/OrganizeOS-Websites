import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDefaultPages } from "@webstudio-is/project-build";
import { setEnv } from "@webstudio-is/feature-flags";
import {
  blockComponent,
  blockTemplateComponent,
  elementComponent,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { canvasComponentLibraries } from "@webstudio-is/sdk-components-registry/canvas";
import {
  $builderMode,
  $dataSourceVariables,
  $propValuesByInstanceSelector,
  $registeredComponents,
  getInstanceKey,
  registerComponentLibrary,
} from "~/shared/nano-states";
import { $externalContentRoots } from "~/shared/external-content-mutations";
import {
  $dataSources,
  $instances,
  $pages,
  $props,
} from "~/shared/sync/data-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import { createInstanceElement } from "./elements";
import {
  WebstudioComponentCanvas,
  WebstudioComponentPreview,
} from "./features/webstudio-component";
import {
  withOrgScriptPolicy,
  withoutBuiltWithWebstudio,
} from "./organizeos-org-script";

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

// React dedupes a hoisted script by its src for the life of the document,
// which every case of this file shares: a src a case has used makes the next
// case that uses it pass whatever the canvas renders. So each src is used once.
const usedScriptSources = new Set<string>();
const evilScriptSource = (name: string) => {
  const url = `https://evil.example/${name}.js`;
  if (usedScriptSources.has(url)) {
    throw new Error(`${url} is used by two cases`);
  }
  usedScriptSources.add(url);
  return url;
};

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

const prepare = ({
  instances,
  props,
}: {
  instances: Array<[string, Instance]>;
  props: Array<[string, Prop]>;
}) => {
  // the libraries the canvas registers, with org script paused (canvas.tsx)
  for (const library of canvasComponentLibraries) {
    registerComponentLibrary(
      withOrgScriptPolicy(withoutBuiltWithWebstudio(library))
    );
  }
  $instances.set(new Map(instances));
  $props.set(new Map(props));
  $pages.set(
    createDefaultPages({ homePageId: "home", rootInstanceId: "body" })
  );
  $selectedPageId.set("home");
};

// 0.309.0 computes prop values asynchronously (computePropValues in
// shared/nano-states/props.ts), so a render first waits for the values of
// the stores prepare set: otherwise no prop reaches a component, and a check
// that nothing unsafe rendered passes for nothing.
const settleProps = () =>
  new Promise<void>((resolve, reject) => {
    const unsubscribe = $propValuesByInstanceSelector.listen(() => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    });
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("The prop values did not settle"));
    }, 2000);
  });

const mountNow = (renderer: Renderer, element: ReactNode) => {
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
        {element}
      </ReactSdkContext.Provider>
    );
  });
  return container;
};

const mount = async (renderer: Renderer, element: ReactNode) => {
  await settleProps();
  return mountNow(renderer, element);
};

const componentOf = (renderer: Renderer) =>
  renderer === "preview" ? WebstudioComponentPreview : WebstudioComponentCanvas;

const render = async ({
  instances,
  props,
  renderer,
}: {
  instances: Array<[string, Instance]>;
  props: Array<[string, Prop]>;
  renderer: Renderer;
}) => {
  prepare({ instances, props });
  return mount(
    renderer,
    createInstanceElement({
      instances: $instances.get(),
      instanceId: "body",
      instanceSelector: ["body"],
      Component: componentOf(renderer),
      components: $registeredComponents.get(),
    })
  );
};

const renderers: Renderer[] = ["canvas", "preview"];

describe.each(renderers)(
  "the %s renders an instance with a raw HTML prop",
  (renderer) => {
    beforeEach(() => {
      (window as { pwned?: number }).pwned = undefined;
    });

    test("without the markup, on a ws:element with a JSON value and with an expression", async () => {
      const dom = await render({
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

    test("without the markup, on a Box", async () => {
      const dom = await render({
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

    test("keeps the other props, whatever they look like", async () => {
      const dom = await render({
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
    // its own src (evilScriptSource).
    const src = (name: string) => evilScriptSource(`${renderer}-${name}`);

    const expectNoScript = (dom: HTMLElement) => {
      expect(evilScripts().length).toBe(0);
      expect(dom.querySelector("script")).toBeNull();
    };

    test("without a script, on a ws:element with tag script, an async prop and a src", async () => {
      const dom = await render({
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

    test("without a script, on a ws:element with the tag SCRIPT and inline code", async () => {
      // React creates anything but the exact string "script" with
      // document.createElement, which makes a live script element
      const dom = await render({
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
      async (component, fallback) => {
        const dom = await render({
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

    test("without a script, on a Box whose instance tag is script", async () => {
      const dom = await render({
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

    test("without a script, on a Box whose legacy tag prop is an expression that evaluates to script", async () => {
      const dom = await render({
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

    test("without a script, on a Dialog Title whose tag is an expression that evaluates to script", async () => {
      const dom = await render({
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

    test("without crashing, on a tag prop whose value is not a string", async () => {
      const dom = await render({
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
    test("keeps a ws:element whose tag the builder offers", async () => {
      const dom = await render({
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

    test("keeps the tag a Box, a Heading and a Dialog Title are given, when the builder offers it", async () => {
      const dom = await render({
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

// Radix's triggers render `<Primitive.Trigger asChild {...props}>`, and Radix's
// Slot merges those props onto the first child. So a `data-ws-tag` or `tag`
// prop on a trigger reaches the legacy Box, Text or Heading inside it, which
// makes its element from that prop. The rule is about the tag that reaches an
// element, whichever component holds the prop.
const forwarders: Array<[trigger: string, parents: string[]]> = [
  ["CollapsibleTrigger", ["Collapsible"]],
  ["DialogTrigger", ["Dialog"]],
  ["PopoverTrigger", ["Popover"]],
  ["TooltipTrigger", ["Tooltip"]],
  [
    "NavigationMenuLink",
    ["NavigationMenu", "NavigationMenuList", "NavigationMenuItem"],
  ],
  [
    "NavigationMenuTrigger",
    ["NavigationMenu", "NavigationMenuList", "NavigationMenuItem"],
  ],
];

/** Parents, then the trigger, then its child: the ids are p0, p1, ..., trigger, child */
const forwarderTree = (
  trigger: string,
  parents: string[],
  childComponent: string,
  triggerInit: Partial<Instance> = {}
) => {
  const ancestors = parents.map((_name, index) => `p${index}`);
  const chain = [...ancestors, "trigger", "child"];
  return [
    instance({ id: "body", children: ids(chain[0]) }),
    ...parents.map((name, index) =>
      instance({
        id: ancestors[index],
        component: `${radixNamespace}:${name}`,
        children: ids(chain[index + 1]),
      })
    ),
    instance({
      id: "trigger",
      component: `${radixNamespace}:${trigger}`,
      children: ids("child"),
      ...triggerInit,
    }),
    instance({ id: "child", component: childComponent }),
  ];
};

describe.each(renderers)(
  "the %s renders a legacy component inside a Radix trigger that passes a tag down",
  (renderer) => {
    const src = (name: string) =>
      evilScriptSource(`${renderer}-trigger-${name}`);

    const fallbacks: Array<[string, string]> = [
      ["Box", "DIV"],
      ["Text", "DIV"],
      ["Heading", "H1"],
    ];

    const cases = forwarders.flatMap(([trigger, parents]) =>
      fallbacks.flatMap(([child, fallback]) =>
        ["data-ws-tag", "tag"].map(
          (name) => [trigger, parents, child, fallback, name] as const
        )
      )
    );

    test.each(cases)(
      "without a script, in a %s over %s with the tag prop of the trigger",
      async (trigger, parents, child, fallback, name) => {
        // the browser runner's own scripts (Vite's client) are in the head
        const headScripts =
          document.head.querySelectorAll("script[src]").length;
        const dom = await render({
          renderer,
          instances: forwarderTree(trigger, parents, child),
          props: [
            prop("trigger", name, "string", "script"),
            prop(
              "trigger",
              "src",
              "string",
              src(`${trigger}-${child}-${name}`)
            ),
            prop("trigger", "async", "boolean", true),
          ],
        });

        expect(evilScripts().length).toBe(0);
        expect(dom.querySelector("script")).toBeNull();
        expect(document.head.querySelectorAll("script[src]")).toHaveLength(
          headScripts
        );
        // the child is rendered, as its own default element
        expect(document.querySelector("[data-ws-id=child]")?.tagName).toBe(
          fallback
        );
      }
    );

    test.each(["data-ws-tag", "tag"])(
      "without a script, when the trigger's %s prop is an expression that evaluates to script",
      async (name) => {
        const dom = await render({
          renderer,
          instances: forwarderTree(
            "CollapsibleTrigger",
            ["Collapsible"],
            "Box"
          ),
          props: [
            prop("trigger", name, "expression", '"scr" + "ipt"'),
            prop("trigger", "src", "string", src(`expression-${name}`)),
            prop("trigger", "async", "expression", "true"),
          ],
        });

        expect(evilScripts().length).toBe(0);
        expect(dom.querySelector("script")).toBeNull();
        expect(document.querySelector("[data-ws-id=child]")?.tagName).toBe(
          "DIV"
        );
      }
    );

    test("without a script, when the trigger's own instance tag is script", async () => {
      // the generator writes instance.tag as a data-ws-tag prop on every
      // component but ws:element, and the canvas does the same. Two checks
      // stop it, each alone: the trigger's tag gate in useInstanceProps, and
      // the child's withoutPausedProps. So this fails only when both are
      // gone; the wiring pins hold each one.
      const dom = await render({
        renderer,
        instances: forwarderTree("DialogTrigger", ["Dialog"], "Box", {
          tag: "script",
        }),
        props: [
          prop("trigger", "src", "string", src("own-instance-tag")),
          prop("trigger", "async", "boolean", true),
        ],
      });

      expect(evilScripts().length).toBe(0);
      expect(dom.querySelector("script")).toBeNull();
    });

    test("without a script, when the trigger that holds the tag prop passes it to a child that is itself a trigger", async () => {
      // the outer trigger's props go to the inner trigger, which spreads them
      // on to the Box
      const dom = await render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("popover") }),
          instance({
            id: "popover",
            component: `${radixNamespace}:Popover`,
            children: ids("collapsible"),
          }),
          instance({
            id: "collapsible",
            component: `${radixNamespace}:Collapsible`,
            children: ids("outer"),
          }),
          instance({
            id: "outer",
            component: `${radixNamespace}:CollapsibleTrigger`,
            children: ids("inner"),
          }),
          instance({
            id: "inner",
            component: `${radixNamespace}:PopoverTrigger`,
            children: ids("child"),
          }),
          instance({ id: "child", component: "Box" }),
        ],
        props: [
          prop("outer", "data-ws-tag", "string", "script"),
          prop("outer", "src", "string", src("nested")),
          prop("outer", "async", "boolean", true),
        ],
      });

      expect(evilScripts().length).toBe(0);
      expect(dom.querySelector("script")).toBeNull();
      expect(document.querySelector("[data-ws-id=child]")?.tagName).toBe("DIV");
    });

    test("without crashing, on a trigger whose tag prop is not a string", async () => {
      await render({
        renderer,
        instances: forwarderTree("PopoverTrigger", ["Popover"], "Text"),
        props: [
          prop("trigger", "data-ws-tag", "expression", '["h1"]'),
          prop("trigger", "tag", "expression", "1"),
        ],
      });

      expect(document.querySelector("[data-ws-id=child]")?.tagName).toBe("DIV");
    });

    // The guards: what the builder offers is created as before
    test("keeps a tag the builder offers, passed down by a trigger", async () => {
      await render({
        renderer,
        instances: forwarderTree("DialogTrigger", ["Dialog"], "Box"),
        props: [prop("trigger", "data-ws-tag", "string", "nav")],
      });

      expect(document.querySelector("[data-ws-id=child]")?.tagName).toBe("NAV");
    });

    test("keeps the tag of an XML Node, which takes any tag name by design", async () => {
      const dom = await render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("urlset") }),
          instance({
            id: "urlset",
            component: "XmlNode",
            children: ids("loc"),
          }),
          instance({ id: "loc", component: "XmlNode" }),
        ],
        props: [
          prop("urlset", "tag", "string", "urlset"),
          prop("loc", "tag", "string", "xhtml:link"),
        ],
      });

      expect(dom.textContent).toContain("<urlset");
      expect(dom.textContent).toContain("<xhtml:link");
    });

    test("keeps the attributes of a ws:element, whose tag is its own", async () => {
      const dom = await render({
        renderer,
        instances: [
          instance({ id: "body", children: ids("div") }),
          instance({ id: "div", tag: "div" }),
        ],
        props: [
          prop("div", "data-ws-tag", "string", "script"),
          prop("div", "tag", "string", "script"),
        ],
      });

      const element = dom.querySelector("[data-ws-id=div]");
      expect(element?.tagName).toBe("DIV");
      expect(element?.getAttribute("tag")).toBe("script");
      expect(evilScripts().length).toBe(0);
    });
  }
);

// A Radix trigger hands its props to the component it renders, so a component
// can receive a tag from its parent next to the props of its own instance. The
// canvas checks that tag where the two are merged, which is a different place
// from the check on the instance's own props: either alone keeps a script off
// the canvas, so these tests render the component with the tag passed in and
// an instance that holds no props, and fail if the check on what a parent
// passes in is taken back (docs/ORGANIZEOS-FORK.md section 10).
describe.each(renderers)(
  "the %s renders a tag a parent passes in",
  (renderer) => {
    // React dedupes hoisted scripts by src, so each renderer has its own
    const src = `https://evil.example/passed-${renderer}.js`;

    test("without a script, on a Box given a data-ws-tag of script, an async prop and a src", async () => {
      const box: Instance = {
        type: "instance",
        id: "box",
        component: "Box",
        children: [],
      };
      prepare({ instances: [["box", box]], props: [] });
      const Component = componentOf(renderer);
      const passedIn: Record<string, unknown> = {
        "data-ws-tag": "script",
        async: true,
        src,
      };

      const dom = await mount(
        renderer,
        <Component
          instance={box}
          instanceSelector={["box"]}
          components={$registeredComponents.get()}
          {...passedIn}
        />
      );

      expect(evilScripts().length).toBe(0);
      expect(dom.querySelector("script")).toBeNull();
      // the Box is rendered, as its own default element
      expect(dom.querySelector("[data-ws-id=box]")?.tagName).toBe("DIV");
    });
  }
);

// An address React writes as it is runs in the builder's own origin when it
// is clicked, framed, posted or loaded as an object, a srcdoc's markup runs
// there as the frame loads, and a string on… attribute runs on a custom
// element. Both renderers drop them from every prop a component receives, its
// own or a parent's, by the instance's component and tag
// (withoutPausedProps, docs/ORGANIZEOS-FORK.md section 10).
describe.each(renderers)(
  "the %s renders an unsafe address, a srcdoc or an event handler",
  (renderer) => {
    const xlink = "http://www.w3.org/1999/xlink";
    const pwn = "javascript:window.pwned = 1";

    beforeEach(() => {
      (window as { pwned?: number }).pwned = undefined;
      $dataSources.set(new Map());
      $dataSourceVariables.set(new Map());
    });

    const variable = (id: string, value: unknown) => {
      $dataSources.set(
        new Map($dataSources.get()).set(id, {
          type: "variable",
          id,
          name: id,
          scopeInstanceId: "body",
          value: Array.isArray(value)
            ? { type: "json", value }
            : { type: "string", value: String(value) },
        })
      );
    };

    const json = (instanceId: string, name: string, value: unknown) => {
      const id = `${instanceId}:${name}`;
      return [id, { id, instanceId, name, type: "json", value } as Prop] as [
        string,
        Prop,
      ];
    };

    // What is left of the attributes that hold an address, a frame document
    // or a handler, apart from upstream Link's own "#" when it is given none
    const unsafeAttributes = (element: Element | null) =>
      [
        "href",
        "src",
        "srcdoc",
        "data",
        "action",
        "formaction",
        "xlink:href",
        "onclick",
      ].filter(
        (name) =>
          element?.hasAttribute(name) === true &&
          (name === "href" && element.getAttribute(name) === "#") === false
      );

    test("without the attribute, wherever it is set", async () => {
      variable("target", pwn);
      variable("html", "<script>parent.pwned = 1</script>");
      variable("list", [pwn]);
      const dom = await render({
        renderer,
        instances: [
          instance({
            id: "body",
            children: ids(
              "anchor",
              "link",
              "frame",
              "frame-doc",
              "frame-bound-doc",
              "object",
              "form",
              "button",
              "svg",
              "bound-link",
              "custom",
              "object-list",
              "anchor-list"
            ),
          }),
          instance({ id: "anchor", tag: "a" }),
          instance({ id: "link", component: "Link" }),
          instance({ id: "frame", tag: "iframe" }),
          instance({ id: "frame-doc", tag: "iframe" }),
          instance({ id: "frame-bound-doc", tag: "iframe" }),
          instance({ id: "object", tag: "object" }),
          instance({ id: "form", tag: "form" }),
          instance({ id: "button", tag: "button" }),
          instance({ id: "svg", tag: "svg", children: ids("svg-link") }),
          instance({ id: "svg-link", tag: "a" }),
          instance({ id: "bound-link", component: "Link" }),
          instance({ id: "custom", tag: "div" }),
          instance({ id: "object-list", tag: "object" }),
          instance({ id: "anchor-list", tag: "a" }),
        ],
        props: [
          prop("anchor", "href", "string", pwn),
          prop("link", "href", "string", " JaVaScRiPt:window.pwned = 1"),
          prop("frame", "src", "string", pwn),
          prop(
            "frame-doc",
            "srcdoc",
            "string",
            "<script>parent.pwned = 1</script>"
          ),
          prop(
            "frame-bound-doc",
            "srcdoc",
            "expression",
            "$ws$dataSource$html"
          ),
          prop(
            "object",
            "data",
            "string",
            "data:text/html,<script>parent.pwned = 1</script>"
          ),
          prop("form", "action", "string", pwn),
          prop("button", "formaction", "string", pwn),
          prop("svg-link", "xlink:href", "string", pwn),
          prop("bound-link", "href", "expression", "$ws$dataSource$target"),
          prop("custom", "is", "string", "x-y"),
          prop("custom", "onclick", "string", "window.pwned = 1"),
          prop("object-list", "data", "expression", "$ws$dataSource$list"),
          json("anchor-list", "href", [pwn]),
        ],
      });

      for (const id of [
        "anchor",
        "link",
        "frame",
        "frame-doc",
        "frame-bound-doc",
        "object",
        "form",
        "button",
        "svg-link",
        "bound-link",
        "custom",
        "object-list",
        "anchor-list",
      ]) {
        const element = dom.querySelector(`[data-ws-id="${id}"]`);
        // the element is still there, without the attribute
        expect(element, id).not.toBeNull();
        expect(unsafeAttributes(element), id).toEqual([]);
        expect(element?.getAttributeNS(xlink, "href"), id).toBeNull();
      }
      expect(dom.innerHTML.toLowerCase()).not.toContain("javascript:");
      expect(dom.innerHTML).not.toContain("pwned");
      expect((window as { pwned?: number }).pwned).toBeUndefined();
    });

    test("without the address a Dialog Trigger passes to a Link that has none of its own", async () => {
      const dom = await render({
        renderer,
        instances: forwarderTree("DialogTrigger", ["Dialog"], "Link"),
        props: [prop("trigger", "href", "string", pwn)],
      });

      const child = document.querySelector("[data-ws-id=child]");
      expect(child).not.toBeNull();
      expect(unsafeAttributes(child)).toEqual([]);
      expect(dom.innerHTML.toLowerCase()).not.toContain("javascript:");
    });

    test("without an address a parent passes in", async () => {
      const link: Instance = {
        type: "instance",
        id: "link",
        component: "Link",
        children: [],
      };
      prepare({ instances: [["link", link]], props: [] });
      const Component = componentOf(renderer);
      const passedIn: Record<string, unknown> = { href: pwn };

      const dom = await mount(
        renderer,
        <Component
          instance={link}
          instanceSelector={["link"]}
          components={$registeredComponents.get()}
          {...passedIn}
        />
      );

      expect(unsafeAttributes(dom.querySelector("[data-ws-id=link]"))).toEqual(
        []
      );
      expect(dom.innerHTML.toLowerCase()).not.toContain("javascript:");
    });

    // The guards: what may run is rendered as before
    test("keeps safe addresses, an Image src bound to an https value and a Collection's data", async () => {
      variable("cover", "https://cdn.example.org/a.png");
      variable("records", [pwn, "/b"]);
      const safe = [
        "https://example.org/a",
        "mailto:a@example.org",
        "tel:+15555550123",
        "sms:+15555550123",
        "/a",
        "#b",
      ];
      const dom = await render({
        renderer,
        instances: [
          instance({
            id: "body",
            children: ids(
              ...safe.map((_href, index) => `safe-${index}`),
              "image",
              "collection"
            ),
          }),
          ...safe.map((_href, index) =>
            instance({ id: `safe-${index}`, component: "Link" })
          ),
          instance({ id: "image", component: "Image" }),
          instance({
            id: "collection",
            component: "ws:collection",
            children: ids("record"),
          }),
          instance({ id: "record", tag: "div" }),
        ],
        props: [
          ...safe.map((href, index) =>
            prop(`safe-${index}`, "href", "string", href)
          ),
          prop("image", "src", "expression", "$ws$dataSource$cover"),
          prop("image", "optimize", "boolean", false),
          prop("collection", "data", "expression", "$ws$dataSource$records"),
        ],
      });

      safe.forEach((href, index) => {
        expect(
          dom
            .querySelector(`[data-ws-id="safe-${index}"]`)
            ?.getAttribute("href")
        ).toBe(href);
      });
      expect(dom.querySelector("img")?.getAttribute("src")).toBe(
        "https://cdn.example.org/a.png"
      );
      // one item for each record, whatever the record holds
      expect(dom.querySelectorAll("[data-ws-id=record]")).toHaveLength(2);
    });

    // The design mode removes every handler (upstream's mergeProps), so only
    // the preview runs one
    test.runIf(renderer === "preview")(
      "keeps an action's handler",
      async () => {
        variable("clicked", "no");
        const dom = await render({
          renderer,
          instances: [
            instance({ id: "body", children: ids("button") }),
            instance({ id: "button", tag: "button" }),
          ],
          props: [
            [
              "button:onClick",
              {
                id: "button:onClick",
                instanceId: "button",
                name: "onClick",
                type: "action",
                value: [
                  {
                    type: "execute",
                    args: [],
                    code: `$ws$dataSource$clicked = "yes"`,
                  },
                ],
              },
            ],
          ],
        });

        act(() => {
          dom.querySelector<HTMLElement>("[data-ws-id=button]")?.click();
        });

        expect($dataSourceVariables.get().get("clicked")).toBe("yes");
      }
    );
  }
);

// Inside a link, an SVG animate or set sets the link's href by SMIL, past the
// address check, and a click in preview runs it. The canvas makes neither,
// whichever way the tag reaches an element (elementTagMayRender,
// docs/ORGANIZEOS-FORK.md section 10), as publishing drops both.
// animateTransform and animateMotion cannot set an href, and stay.
describe.each(renderers)("the %s renders no SVG animate or set", (renderer) => {
  const pwn = "javascript:window.pwned = 1";

  const smilElements = (dom: Element) =>
    Array.from(dom.querySelectorAll("*")).filter(
      (element) =>
        element.localName === "animate" || element.localName === "set"
    );

  test("without an animate or set on a ws:element in an SVG link, and with animateTransform and animateMotion", async () => {
    const dom = await render({
      renderer,
      instances: [
        instance({ id: "body", children: ids("svg") }),
        instance({ id: "svg", tag: "svg", children: ids("link") }),
        instance({
          id: "link",
          tag: "a",
          children: ids("animate", "set", "transform", "motion"),
        }),
        instance({ id: "animate", tag: "animate" }),
        instance({ id: "set", tag: "set" }),
        instance({ id: "transform", tag: "animateTransform" }),
        instance({ id: "motion", tag: "animateMotion" }),
      ],
      props: [
        prop("animate", "attributeName", "string", "href"),
        prop("animate", "values", "string", pwn),
        prop("set", "attributeName", "string", "href"),
        prop("set", "to", "string", pwn),
        prop("transform", "attributeName", "string", "transform"),
        prop("transform", "type", "string", "rotate"),
        prop("motion", "path", "string", "M0,0 L10,10"),
      ],
    });

    expect(smilElements(dom)).toEqual([]);
    // each is still there, as a div that nothing animates
    expect(dom.querySelector("[data-ws-id=animate]")?.localName).toBe("div");
    expect(dom.querySelector("[data-ws-id=set]")?.localName).toBe("div");
    expect(dom.querySelector("[data-ws-id=transform]")?.localName).toBe(
      "animateTransform"
    );
    expect(dom.querySelector("[data-ws-id=motion]")?.localName).toBe(
      "animateMotion"
    );
  });

  // each falls back to its own default element
  test("without an animate or set on a Box, Text, Heading or Dialog Title given one as its tag", async () => {
    const dom = await render({
      renderer,
      instances: [
        instance({
          id: "body",
          children: ids("box", "text", "heading", "dialog"),
        }),
        instance({ id: "box", component: "Box", tag: "animate" }),
        instance({ id: "text", component: "Text" }),
        instance({ id: "heading", component: "Heading" }),
        instance({
          id: "dialog",
          component: `${radixNamespace}:Dialog`,
          children: ids("title"),
        }),
        instance({ id: "title", component: `${radixNamespace}:DialogTitle` }),
      ],
      props: [
        prop("text", "data-ws-tag", "string", "set"),
        prop("heading", "tag", "expression", '"anim" + "ate"'),
        prop("dialog", "open", "boolean", true),
        prop("title", "tag", "string", "set"),
      ],
    });

    expect(smilElements(document.body)).toEqual([]);
    expect(dom.querySelector("[data-ws-id=box]")?.tagName).toBe("DIV");
    expect(dom.querySelector("[data-ws-id=text]")?.tagName).toBe("DIV");
    expect(dom.querySelector("[data-ws-id=heading]")?.tagName).toBe("H1");
    expect(document.querySelector("[data-ws-id=title]")).not.toBeNull();
  });

  test("without an animate a Radix trigger passes down to a Box", async () => {
    await render({
      renderer,
      instances: forwarderTree("PopoverTrigger", ["Popover"], "Box"),
      props: [
        prop("trigger", "data-ws-tag", "string", "animate"),
        prop("trigger", "attributeName", "string", "href"),
        prop("trigger", "values", "string", pwn),
      ],
    });

    expect(smilElements(document.body)).toEqual([]);
    expect(document.querySelector("[data-ws-id=child]")?.tagName).toBe("DIV");
  });

  test("without a set a parent passes in", async () => {
    const box: Instance = {
      type: "instance",
      id: "box",
      component: "Box",
      children: [],
    };
    prepare({ instances: [["box", box]], props: [] });
    const Component = componentOf(renderer);
    const passedIn: Record<string, unknown> = {
      "data-ws-tag": "set",
      attributeName: "href",
      to: pwn,
    };

    const dom = await mount(
      renderer,
      <Component
        instance={box}
        instanceSelector={["box"]}
        components={$registeredComponents.get()}
        {...passedIn}
      />
    );

    expect(smilElements(dom)).toEqual([]);
    expect(dom.querySelector("[data-ws-id=box]")?.tagName).toBe("DIV");
  });
});

// A Content Block bound to an MDX document renders the document's instances in
// place of its own: the outer renderer substitutes the occurrence instance
// (an external content root) before the inner renderer, which holds the
// checks, sees it. So what an MDX document holds passes the same checks. The
// canvas substitutes in Content mode only; the preview always does.
describe.each(renderers)(
  "the %s renders an MDX occurrence through the checks",
  (renderer) => {
    afterEach(() => {
      $builderMode.set("design");
      $externalContentRoots.set(new Map());
      delete (window as { pwned?: number }).pwned;
    });

    // a Content Block holds its templates list first, then its items
    const occurrence = (children: string[]): Array<[string, Instance]> => [
      instance({ id: "body", children: ids("block") }),
      instance({
        id: "block",
        component: blockComponent,
        children: ids("templates", "own"),
      }),
      instance({ id: "templates", component: blockTemplateComponent }),
      instance({
        id: "own",
        tag: "p",
        children: [{ type: "text", value: "the block's own" }],
      }),
      instance({
        id: "runtime-block",
        component: blockComponent,
        children: ids("runtime-templates", ...children),
      }),
      instance({ id: "runtime-templates", component: blockTemplateComponent }),
    ];

    const prepareOccurrence = (
      instances: Array<[string, Instance]>,
      instanceIds: string[]
    ) => {
      prepare({ instances, props: [] });
      $externalContentRoots.set(
        new Map([
          [
            "root",
            {
              sourceBlockInstanceId: "block",
              sourceRenderScope: getInstanceKey(["block", "body"]),
              blockInstanceId: "runtime-block",
              instanceIds: new Set([
                "runtime-block",
                "runtime-templates",
                ...instanceIds,
              ]),
              mutationRevision: 0,
            },
          ],
        ])
      );
      if (renderer === "canvas") {
        $builderMode.set("content");
      }
    };

    const bodyElement = () =>
      createInstanceElement({
        instances: $instances.get(),
        instanceId: "body",
        instanceSelector: ["body"],
        Component: componentOf(renderer),
        components: $registeredComponents.get(),
      });

    test("without a script, an animate or a script tag on a Box", async () => {
      const children = ["mdx-p", "mdx-script", "mdx-svg", "mdx-box"];
      prepareOccurrence(
        [
          ...occurrence(children),
          instance({
            id: "mdx-p",
            tag: "p",
            children: [{ type: "text", value: "mdx occurrence" }],
          }),
          instance({
            id: "mdx-script",
            tag: "script",
            children: [{ type: "text", value: "window.pwned=1" }],
          }),
          instance({ id: "mdx-svg", tag: "svg", children: ids("mdx-animate") }),
          instance({ id: "mdx-animate", tag: "animate" }),
          instance({ id: "mdx-box", component: "Box", tag: "script" }),
        ],
        [...children, "mdx-animate"]
      );
      const scriptsBefore = document.querySelectorAll("script").length;
      const dom = await mount(renderer, bodyElement());

      // the occurrence rendered, not the block's own children
      expect(dom.textContent).toContain("mdx occurrence");
      expect(dom.textContent).not.toContain("the block's own");
      expect(document.querySelectorAll("script").length).toBe(scriptsBefore);
      expect(dom.querySelector("animate")).toBeNull();
      expect(dom.querySelector('[data-ws-id="mdx-script"]')?.tagName).toBe(
        "DIV"
      );
      expect(dom.querySelector('[data-ws-id="mdx-box"]')?.tagName).toBe("DIV");
      expect((window as { pwned?: number }).pwned).toBeUndefined();
    });

    // 0.309.0 computes no props for an occurrence's instances (the walk
    // follows instance.children from the page root, and the runtime block is
    // nobody's child), so the values are seeded here. They stand in for any
    // path that computes them, as a later upstream change may.
    test("without an unsafe address, a raw embed or a script tag prop, from the props the occurrence is given", async () => {
      const children = ["mdx-link", "mdx-ok", "mdx-embed", "mdx-box"];
      prepareOccurrence(
        [
          ...occurrence(children),
          instance({
            id: "mdx-link",
            tag: "a",
            children: [{ type: "text", value: "unsafe" }],
          }),
          instance({
            id: "mdx-ok",
            tag: "a",
            children: [{ type: "text", value: "safe" }],
          }),
          instance({ id: "mdx-embed", component: "HtmlEmbed" }),
          instance({ id: "mdx-box", component: "Box" }),
        ],
        children
      );
      await settleProps();
      const seeded = new Map($propValuesByInstanceSelector.get());
      const at = (id: string) => getInstanceKey([id, "runtime-block", "body"]);
      seeded.set(
        at("mdx-link"),
        new Map([["href", "javascript:window.pwned=1"]])
      );
      seeded.set(at("mdx-ok"), new Map([["href", "https://ok.example/"]]));
      seeded.set(at("mdx-embed"), new Map([["code", html]]));
      seeded.set(
        at("mdx-box"),
        new Map<string, unknown>([
          ["data-ws-tag", "script"],
          ["async", true],
          ["src", `https://evil.example/mdx-${renderer}.js`],
        ])
      );
      $propValuesByInstanceSelector.set(seeded);
      const dom = mountNow(renderer, bodyElement());

      // the control: the seeded props reach the occurrence's instances
      expect(dom.querySelector('a[href="https://ok.example/"]')).not.toBeNull();
      expect(dom.querySelector('a[href^="javascript:"]')).toBeNull();
      expect(dom.textContent).toContain("HTML Embed is paused");
      expect(dom.querySelector("#pwn")).toBeNull();
      expect(evilScripts().length).toBe(0);
      expect(dom.querySelector('[data-ws-id="mdx-box"]')?.tagName).toBe("DIV");
      expect((window as { pwned?: number }).pwned).toBeUndefined();
    });
  }
);
