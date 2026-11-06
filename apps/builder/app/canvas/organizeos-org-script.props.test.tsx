/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanStores } from "nanostores";
import { createDefaultPages } from "@webstudio-is/project-build";
import { setEnv } from "@webstudio-is/feature-flags";
import {
  elementComponent,
  SYSTEM_VARIABLE_ID,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import * as baseComponents from "@webstudio-is/sdk-components-react/components";
import * as baseComponentMetas from "@webstudio-is/sdk-components-react/metas";
import * as baseComponentTemplates from "@webstudio-is/sdk-components-react/templates";
import * as radixComponents from "@webstudio-is/sdk-components-react-radix";
import * as radixComponentMetas from "@webstudio-is/sdk-components-react-radix/metas";
import {
  $dataSourceVariables,
  $propValuesByInstanceSelector,
  $registeredComponents,
  getInstanceKey,
  registerComponentLibrary,
} from "~/shared/nano-states";
import {
  $dataSources,
  $instances,
  $pages,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { registerContainers } from "~/shared/sync/sync-stores";
import { createInstanceElement } from "./elements";
import {
  WebstudioComponentCanvas,
  WebstudioComponentPreview,
} from "./features/webstudio-component";
import { withOrgScriptPolicy } from "./organizeos-org-script";
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
};

const mount = (renderer: Renderer, element: ReactNode) => {
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

const componentOf = (renderer: Renderer) =>
  renderer === "preview" ? WebstudioComponentPreview : WebstudioComponentCanvas;

const render = ({
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
    const src = (name: string) => `https://evil.example/${renderer}-${name}.js`;

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
      (trigger, parents, child, fallback, name) => {
        const dom = render({
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
        expect(document.head.querySelector("script[src]")).toBeNull();
        // the child is rendered, as its own default element
        expect(document.querySelector("[data-ws-id=child]")?.tagName).toBe(
          fallback
        );
      }
    );

    test.each(["data-ws-tag", "tag"])(
      "without a script, when the trigger's %s prop is an expression that evaluates to script",
      (name) => {
        const dom = render({
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

    test("without a script, when the trigger's own instance tag is script", () => {
      // the generator writes instance.tag as a data-ws-tag prop on every
      // component but ws:element, and the canvas does the same
      const dom = render({
        renderer,
        instances: forwarderTree("DialogTrigger", ["Dialog"], "Box", {
          tag: "script",
        }),
        props: [
          prop("trigger", "src", "string", src("instance-tag")),
          prop("trigger", "async", "boolean", true),
        ],
      });

      expect(evilScripts().length).toBe(0);
      expect(dom.querySelector("script")).toBeNull();
    });

    test("without a script, when the trigger that holds the tag prop passes it to a child that is itself a trigger", () => {
      // the outer trigger's props go to the inner trigger, which spreads them
      // on to the Box
      const dom = render({
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

    test("without crashing, on a trigger whose tag prop is not a string", () => {
      render({
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
    test("keeps a tag the builder offers, passed down by a trigger", () => {
      render({
        renderer,
        instances: forwarderTree("DialogTrigger", ["Dialog"], "Box"),
        props: [prop("trigger", "data-ws-tag", "string", "nav")],
      });

      expect(document.querySelector("[data-ws-id=child]")?.tagName).toBe("NAV");
    });

    test("keeps the tag of an XML Node, which takes any tag name by design", () => {
      const dom = render({
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

    test("keeps the attributes of a ws:element, whose tag is its own", () => {
      const dom = render({
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

    test("without a script, on a Box given a data-ws-tag of script, an async prop and a src", () => {
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

      const dom = mount(
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

    test("without the attribute, wherever it is set", () => {
      variable("target", pwn);
      variable("html", "<script>parent.pwned = 1</script>");
      variable("list", [pwn]);
      const dom = render({
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

    test("without the address a Dialog Trigger passes to a Link that has none of its own", () => {
      const dom = render({
        renderer,
        instances: forwarderTree("DialogTrigger", ["Dialog"], "Link"),
        props: [prop("trigger", "href", "string", pwn)],
      });

      const child = document.querySelector("[data-ws-id=child]");
      expect(child).not.toBeNull();
      expect(unsafeAttributes(child)).toEqual([]);
      expect(dom.innerHTML.toLowerCase()).not.toContain("javascript:");
    });

    test("without an address a parent passes in", () => {
      const link: Instance = {
        type: "instance",
        id: "link",
        component: "Link",
        children: [],
      };
      prepare({ instances: [["link", link]], props: [] });
      const Component = componentOf(renderer);
      const passedIn: Record<string, unknown> = { href: pwn };

      const dom = mount(
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
    test("keeps safe addresses, an Image src bound to an https value and a Collection's data", () => {
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
      const dom = render({
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
    test.runIf(renderer === "preview")("keeps an action's handler", () => {
      variable("clicked", "no");
      const dom = render({
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
    });
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

  test("runs none of the refused actions, and gives them no handler that does anything", () => {
    prepare({ instances, props });

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

  test("gives an action that may run a working handler", () => {
    prepare({ instances, props });

    const onClick = onClickOf("kept");
    expect(typeof onClick).toBe("function");
    (onClick as (event: unknown) => void)({});
    expect($dataSourceVariables.get().get("clicked")).toBe("yes");
  });

  // The templates' action sets a variable to its arg, and still does when an
  // org has named the variable as the arg
  test("gives the templates' action a working handler when the variable it sets is named as its arg", () => {
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

    const onStateChange = propOf("signup", "onStateChange");
    expect(typeof onStateChange).toBe("function");
    (onStateChange as (state: string) => void)("success");
    expect($dataSourceVariables.get().get("clicked")).toBe("success");
  });

  // A page's own data source is a parameter, so a variable with its id is
  // one the page module cannot name as itself
  test("gives no handler to an action that names a variable with a page's own id", () => {
    const handler = (systemDataSourceId: undefined | string) => {
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
    expect(handler("pagesystem")).toBeUndefined();
    expect(typeof handler(undefined)).toBe("function");
  });

  // A Collection binds as its item only a parameter of its own: an action
  // inside it that names a variable the Collection binds is refused, as
  // publishing refuses it
  test("gives no handler to an action that names a variable a Collection binds", () => {
    const collection = (item: string) => {
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
    expect(collection("sibling")).toBeUndefined();
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
    expect(typeof collection("item")).toBe("function");
  });

  // A page template is edited on the canvas as a page is, so its Rotating
  // Tabs keep their action there
  test("gives a page template's action its handler while the template is edited", () => {
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
  test("judges an action a page reaches by the pages, as publishing does", () => {
    prepare({
      instances: [
        instance({ id: "body", children: ids("shared") }),
        instance({
          id: "template-body",
          component: "Body",
          children: ids("wrapper"),
        }),
        instance({ id: "wrapper", component: "Box", children: ids("shared") }),
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
    const onValueChange = () =>
      $propValuesByInstanceSelector
        .get()
        .get(getInstanceKey(["shared", "wrapper", "template-body"]))
        ?.get("onValueChange");
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
    expect(onValueChange()).toBeUndefined();
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
    expect(typeof onValueChange()).toBe("function");
    $selectedPageId.set("home");
  });

  // While org script is paused a variable holds only plain data, whatever an
  // action that may run is called with
  test("stores what is not plain data as undefined, and plain data as it is", () => {
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
    (renderer) => {
      const dom = render({ renderer, instances, props });

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
    test("not at all, nor anything inside it", () => {
      const dom = render({
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

  test("without an animate or set on a ws:element in an SVG link, and with animateTransform and animateMotion", () => {
    const dom = render({
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
  test("without an animate or set on a Box, Text, Heading or Dialog Title given one as its tag", () => {
    const dom = render({
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

  test("without an animate a Radix trigger passes down to a Box", () => {
    render({
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

  test("without a set a parent passes in", () => {
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

    const dom = mount(
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
