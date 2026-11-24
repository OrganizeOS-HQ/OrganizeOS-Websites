import { createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  blockComponent,
  tags,
  type Instance,
  type WsComponentMeta,
} from "@webstudio-is/sdk";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { createAssetUrlsByPath } from "@webstudio-is/project-build/runtime";
import { toRuntimeAsset, type Asset } from "@webstudio-is/sdk";
import {
  HtmlEmbed,
  MarkdownEmbed,
} from "@webstudio-is/sdk-components-react/components";
import { canvasComponentLibraries } from "@webstudio-is/sdk-components-registry/canvas";
import * as organizeosComponents from "@organizeos/site-components";
import * as organizeosComponentMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import {
  actionContextOf,
  actionMayRun,
  checksInstanceTag,
  collidingDataSourceIds,
  unlistedDataSourceIds,
  checksTagProp,
  componentMayShip,
  elementTagMayRender,
  findPausedExpressions,
  propMayShip,
  propNameMayRun,
  templateIconCodes,
} from "@organizeos/site-components/org-script";
import {
  SITE_TEMPLATES,
  renderSiteTemplate,
} from "@organizeos/site-components/site-templates";
import { MenuIcon } from "@webstudio-is/icons/svg";
import type { TemplateMeta } from "@webstudio-is/template";
import { publishedComponents } from "~/builder/features/publish/organizeos-publish-paused-script";
import {
  $registeredComponents,
  $registeredComponentMetas,
  $registeredTemplates,
  registerComponentLibrary,
} from "~/shared/nano-states";
import {
  closeCommandPanel,
  openCommandPanel,
} from "~/builder/features/command-panel/command-state";
import { $componentOptions } from "~/builder/features/command-panel/groups/components-group";
import {
  CanvasHtmlEmbed,
  CanvasMarkdownEmbed,
  instanceTagMayRender,
  withOrgScriptPolicy,
  withoutBuiltWithWebstudio,
} from "./organizeos-org-script";
import {
  assertInert,
  assertNoDataAttributes,
  corpus,
  nextFrames,
} from "~/shared/organizeos-untrusted-markup.test-helpers";

// OrganizeOS fork: the embed switch, held off unless a test turns it on. The
// mock reaches the canvas module, which reads orgEmbedsMayShip() at render and
// in withOrgScriptPolicy's default.
const { embeds } = vi.hoisted(() => ({ embeds: { mayShip: false } }));
vi.mock("@organizeos/site-components/org-script", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@organizeos/site-components/org-script")
  >()),
  orgEmbedsMayShip: () => embeds.mayShip,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  delete (window as { x?: number }).x;
  delete (window as { upstreamX?: number }).upstreamX;
  delete (window as { __pwned?: unknown }).__pwned;
  embeds.mayShip = false;
});

/** The canvas's registration (canvas.tsx), into the registry stores. */
const registerAsCanvas = () => {
  for (const library of canvasComponentLibraries) {
    registerComponentLibrary(
      withOrgScriptPolicy(withoutBuiltWithWebstudio(library))
    );
  }
  registerComponentLibrary({
    namespace: "@organizeos/site-components",
    components: organizeosComponents,
    metas: organizeosComponentMetas,
    templates: organizeosTemplates,
  });
};

const resetRegistry = () => {
  $registeredComponents.set(new Map());
  $registeredComponentMetas.set(new Map());
  $registeredTemplates.set(new Map());
};

const scriptAndHandler =
  '<script>window.x=1</script><img src=x onerror="window.x=1">';

// The control renders upstream's embed, whose handler fires later, perhaps in
// the next test: it sets a global of its own, so it never reads as the pause
// letting window.x through.
const upstreamScriptAndHandler =
  '<script>window.upstreamX=1</script><img src=x onerror="window.upstreamX=1">';

type Mode = {
  name: string;
  renderer: "canvas" | "preview";
  isSafeMode?: boolean;
  executeScriptOnCanvas?: boolean;
};

// Every way upstream's HTML Embed can be asked to render markup in the builder
const modes: Mode[] = [
  { name: "preview", renderer: "preview" },
  { name: "canvas", renderer: "canvas" },
  {
    name: "canvas with Run scripts on canvas",
    renderer: "canvas",
    executeScriptOnCanvas: true,
  },
  { name: "safe mode", renderer: "canvas", isSafeMode: true },
  {
    name: "safe mode with Run scripts on canvas",
    renderer: "canvas",
    isSafeMode: true,
    executeScriptOnCanvas: true,
  },
];

const render = (mode: Mode, ui: ReactNode) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  rerender(mode, ui);
  return container;
};

/** Renders into the root `render` made, as the canvas re-renders an embed. */
const rerender = (mode: Mode, ui: ReactNode) => {
  act(() => {
    root?.render(
      <ReactSdkContext.Provider
        value={{
          assetBaseUrl: "",
          imageLoader: () => "",
          renderer: mode.renderer,
          isSafeMode: mode.isSafeMode,
          resources: {},
          breakpoints: [],
          onError: () => {},
        }}
      >
        {ui}
      </ReactSdkContext.Provider>
    );
  });
};

// The registry's base library (canvasComponentLibraries: core, base, Radix)
const [core, library, radix] = canvasComponentLibraries;

/**
 * The props React holds for a host element: what a component passed to it,
 * including a name React leaves off the DOM. It reads React DOM's own key on
 * the node; a test that uses it checks a prop it knows is there first.
 */
const hostProps = (element: Element): Record<string, unknown> => {
  const key = Object.keys(element).find((name) =>
    name.startsWith("__reactProps$")
  );
  expect(key, "React DOM's props key on the element").toBeDefined();
  return (element as unknown as Record<string, Record<string, unknown>>)[
    key as string
  ];
};

describe("withOrgScriptPolicy", () => {
  // T4
  test("hides HTML Embed from the Components panel and the command palette", () => {
    const result = withOrgScriptPolicy(library, { embedsMayShip: false });
    // The panel and the palette list a meta by its category, and skip hidden
    expect(library.metas.HtmlEmbed.category).toBe("general");
    expect(result.metas.HtmlEmbed.category).toBe("hidden");
    // Nothing else about the meta changes but Run scripts on canvas: the
    // Navigator, its icon and its label
    const { executeScriptOnCanvas: _run, ...props } =
      library.metas.HtmlEmbed.props ?? {};
    expect(result.metas.HtmlEmbed).toEqual({
      ...library.metas.HtmlEmbed,
      props,
      initialProps: library.metas.HtmlEmbed.initialProps?.filter(
        (name) => name !== "executeScriptOnCanvas"
      ),
      category: "hidden",
    });
    // The input is not changed
    expect(library.metas.HtmlEmbed.category).toBe("general");
  });

  test("hides Markdown Embed", () => {
    const result = withOrgScriptPolicy(library, { embedsMayShip: false });
    expect(result.metas.MarkdownEmbed.category).toBe("hidden");
    expect(result.metas.MarkdownEmbed).toEqual({
      ...library.metas.MarkdownEmbed,
      category: "hidden",
    });
  });

  // JSON-LD is left out at publish while org script is paused (the CLI's
  // dropOrgScript), so the panel does not offer it either. On the canvas it
  // renders as inert text, so its component stays.
  test("hides JSON-LD, and keeps its component", () => {
    const result = withOrgScriptPolicy(library, { embedsMayShip: false });
    expect(library.metas.JsonLd.category).toBe("general");
    expect(result.metas.JsonLd).toEqual({
      ...library.metas.JsonLd,
      category: "hidden",
    });
    expect(result.components.JsonLd).toBe(library.components.JsonLd);
  });

  test("leaves Content Embed and Markdown Embed templates out", () => {
    const result = withOrgScriptPolicy(library, { embedsMayShip: false });
    expect(library.templates).toHaveProperty("ContentEmbed");
    expect(library.templates).toHaveProperty("MarkdownEmbed");
    expect(result.templates).not.toHaveProperty("ContentEmbed");
    expect(result.templates).not.toHaveProperty("MarkdownEmbed");
    expect(Object.keys(result.templates).sort()).toEqual(
      Object.keys(library.templates)
        .filter((name) => name !== "ContentEmbed" && name !== "MarkdownEmbed")
        .sort()
    );
  });

  test.each([false, true])(
    "registers the canvas components whatever the switch (embeds %s)",
    (embedsMayShip) => {
      const result = withOrgScriptPolicy(library, { embedsMayShip });
      expect(library.components.HtmlEmbed).not.toBe(CanvasHtmlEmbed);
      expect(result.components.HtmlEmbed).toBe(CanvasHtmlEmbed);
      expect(result.components.MarkdownEmbed).toBe(CanvasMarkdownEmbed);
    }
  );

  test.each([false, true])(
    "the HTML Embed meta has no Run scripts on canvas, whatever the switch (embeds %s)",
    (embedsMayShip) => {
      // the control: upstream's meta offers it
      expect(library.metas.HtmlEmbed.props).toHaveProperty(
        "executeScriptOnCanvas"
      );
      expect(library.metas.HtmlEmbed.initialProps).toContain(
        "executeScriptOnCanvas"
      );
      const meta = withOrgScriptPolicy(library, { embedsMayShip }).metas
        .HtmlEmbed;
      expect("executeScriptOnCanvas" in (meta.props ?? {})).toBe(false);
      expect(meta.initialProps).not.toContain("executeScriptOnCanvas");
      expect(meta.initialProps).toContain("clientOnly");
      expect(meta.props).toHaveProperty("clientOnly");
      expect(meta.props).toHaveProperty("code");
      // the input is not changed
      expect(library.metas.HtmlEmbed.props).toHaveProperty(
        "executeScriptOnCanvas"
      );
    }
  );

  test("with embeds on, lists the embeds and keeps their templates", () => {
    const result = withOrgScriptPolicy(library, { embedsMayShip: true });
    for (const name of ["HtmlEmbed", "MarkdownEmbed", "JsonLd"]) {
      expect(result.metas[name].category, name).toBe(
        library.metas[name].category
      );
      expect(result.metas[name].category, name).not.toBe("hidden");
    }
    expect(result.metas.MarkdownEmbed).toBe(library.metas.MarkdownEmbed);
    expect(result.metas.JsonLd).toBe(library.metas.JsonLd);
    expect(result.templates.ContentEmbed).toBe(library.templates.ContentEmbed);
    expect(result.templates.MarkdownEmbed).toBe(
      library.templates.MarkdownEmbed
    );
  });

  test("its default reads orgEmbedsMayShip()", () => {
    embeds.mayShip = true;
    expect(withOrgScriptPolicy(library).templates).toHaveProperty(
      "ContentEmbed"
    );
    embeds.mayShip = false;
    expect(withOrgScriptPolicy(library).templates).not.toHaveProperty(
      "ContentEmbed"
    );
  });

  test("passes every other entry through by reference, the registry's component ids too", () => {
    const result = withOrgScriptPolicy(library, { embedsMayShip: false });
    for (const [name, component] of Object.entries(library.components)) {
      if (name === "HtmlEmbed" || name === "MarkdownEmbed") {
        continue;
      }
      expect(result.components[name as keyof typeof result.components]).toBe(
        component
      );
    }
    for (const [name, meta] of Object.entries(library.metas)) {
      if (["HtmlEmbed", "MarkdownEmbed", "JsonLd"].includes(name)) {
        continue;
      }
      expect(result.metas[name as keyof typeof result.metas]).toBe(meta);
    }
    for (const [name, template] of Object.entries(library.templates)) {
      if (name === "ContentEmbed" || name === "MarkdownEmbed") {
        continue;
      }
      expect(result.templates[name as keyof typeof result.templates]).toBe(
        template
      );
    }
    // upstream's templates name the original HtmlEmbed object, which the
    // registry's ids resolve after the swap
    expect(result.componentIds).toBe(library.componentIds);
    expect("namespace" in result).toBe(false);
    expect(withOrgScriptPolicy(radix).namespace).toBe(radix.namespace);
  });

  test("leaves a library without these components alone", () => {
    const other = {
      components: { Box: library.components.Box },
      metas: {} as Record<string, WsComponentMeta>,
      templates: {} as Record<string, TemplateMeta>,
    };
    const result = withOrgScriptPolicy(other, { embedsMayShip: false });
    expect(result.components).toEqual({ Box: library.components.Box });
    expect(result.metas).toEqual({});
    expect(result.templates).toEqual({});
  });
});

describe("withoutBuiltWithWebstudio", () => {
  test("leaves upstream's badge out of the core templates, and nothing else", () => {
    expect(core.templates).toHaveProperty("builtWithWebstudio");
    const result = withoutBuiltWithWebstudio(core);
    expect(result.templates).not.toHaveProperty("builtWithWebstudio");
    expect(Object.keys(result.templates).sort()).toEqual(
      Object.keys(core.templates)
        .filter((name) => name !== "builtWithWebstudio")
        .sort()
    );
    expect(result.metas).toBe(core.metas);
    expect(result.componentIds).toBe(core.componentIds);
    // the input is not changed
    expect(core.templates).toHaveProperty("builtWithWebstudio");
  });

  test("returns a library without the badge as it is", () => {
    expect(withoutBuiltWithWebstudio(library)).toBe(library);
    expect(withoutBuiltWithWebstudio(radix)).toBe(radix);
  });
});

describe("the libraries, as the canvas registers them", () => {
  afterEach(resetRegistry);

  /** Every registered template's fragment (the registry renders each). */
  const registeredTemplates = () => {
    registerAsCanvas();
    return Array.from($registeredTemplates.get());
  };

  const getEmbeds = (component: string) => {
    const found: Array<{
      template: string;
      instance: Instance;
      code: unknown;
    }> = [];
    for (const [name, { template: fragment }] of registeredTemplates()) {
      for (const instance of fragment.instances) {
        if (instance.component !== component) {
          continue;
        }
        const code = fragment.props.find(
          (prop) => prop.instanceId === instance.id && prop.name === "code"
        );
        found.push({
          template: name,
          instance,
          code: code && "value" in code ? code.value : undefined,
        });
      }
    }
    return found;
  };

  // T7. Fails on an upstream merge that adds or redraws a template icon: the
  // new string is added to templateIconCodes, and the old one is never removed.
  test("every HTML Embed a template inserts is a template icon", () => {
    const embeds = getEmbeds("HtmlEmbed");
    // Radix, YouTube and Vimeo insert icons, so this is not an empty check
    expect(
      embeds.filter(({ code }) => typeof code === "string").length
    ).toBeGreaterThan(0);
    const paused = embeds.filter(
      ({ code }) => typeof code !== "string" || !templateIconCodes.has(code)
    );
    // The Content Block's templates container is empty; it is paused, and
    // dropped at publish, until it is given code the switch allows.
    expect(paused.map(({ template, code }) => ({ template, code }))).toEqual([
      { template: blockComponent, code: undefined },
    ]);
  });

  test("no template inserts a Markdown Embed", () => {
    expect(getEmbeds("MarkdownEmbed")).toEqual([]);
  });

  // While org script is paused the canvas gives an action actionMayRun
  // refuses no handler, and publishing drops it, so a template's own action
  // has to pass
  test("every action a template inserts may run", () => {
    const actions = registeredTemplates().flatMap(
      ([key, { template: fragment }]) => {
        // as each is scoped, under the template's top instances as a page
        // holds them
        const context = actionContextOf({
          instances: new Map(
            fragment.instances.map((instance) => [instance.id, instance])
          ),
          pageRootIds: new Set(
            fragment.children.flatMap((child) =>
              child.type === "id" ? [child.value] : []
            )
          ),
          dataSources: new Map(
            fragment.dataSources.map((dataSource) => [
              dataSource.id,
              dataSource,
            ])
          ),
          props: new Map(fragment.props.map((prop) => [prop.id, prop])),
          resources: new Map(
            fragment.resources.map((resource) => [resource.id, resource])
          ),
          pages: [],
        });
        return fragment.props.flatMap((prop) =>
          prop.type === "action"
            ? [{ template: `${key} ${prop.name}`, prop, context }]
            : []
        );
      }
    );
    // the Form, Webhook Form, Signup Form, RSVP Form and Rotating Tabs write
    // some each
    expect(actions.length).toBeGreaterThanOrEqual(5);
    // but upstream's Form reads members of its result, which no action may
    // while org script is paused: it is left out and listed
    expect(
      actions
        .filter(({ prop, context }) => actionMayRun(prop, context) === false)
        .map(({ template }) => template)
    ).toEqual(["form onResultChange"]);
  });

  // A Resource Form's own form data and browser info stay while org script
  // is paused, so the Form template's data sources do
  test("every data source a template inserts is one the page module names as itself, but a Content Block's document", () => {
    const found = registeredTemplates().flatMap(
      ([key, { template: fragment }]) => {
        const colliding = collidingDataSourceIds({
          instances: new Map(
            fragment.instances.map((instance) => [instance.id, instance])
          ),
          dataSources: new Map(
            fragment.dataSources.map((dataSource) => [
              dataSource.id,
              dataSource,
            ])
          ),
          props: new Map(fragment.props.map((prop) => [prop.id, prop])),
          resources: new Map(
            fragment.resources.map((resource) => [resource.id, resource])
          ),
          // under the template's top instances, as a page holds them
          pages: fragment.children.flatMap((child) =>
            child.type === "id" ? [{ rootInstanceId: child.value }] : []
          ),
        });
        const unlisted = unlistedDataSourceIds({
          instances: new Map(
            fragment.instances.map((instance) => [instance.id, instance])
          ),
          dataSources: new Map(
            fragment.dataSources.map((dataSource) => [
              dataSource.id,
              dataSource,
            ])
          ),
          props: new Map(fragment.props.map((prop) => [prop.id, prop])),
        });
        return fragment.dataSources
          .filter((dataSource) => colliding.has(dataSource.id))
          .map(
            (dataSource) =>
              `${key} ${dataSource.name}${unlisted.has(dataSource.id) ? " (unlisted)" : ""}`
          );
      }
    );
    // but a Content Block's own document, which publishing leaves out
    // while org script is paused, and neither counts nor lists
    expect(found).toEqual(["ws:block document (unlisted)"]);
    // the Form template's are among them, with its errors' Collection item
    const form = registeredTemplates().find(([key]) => key === "form");
    expect(
      form?.[1].template.dataSources
        .filter((dataSource) => dataSource.type === "parameter")
        .map((dataSource) => dataSource.name)
        .sort()
    ).toEqual(["browserInfo", "collectionItem", "formData"]);
  });

  // Publishing leaves out an instance of a component the page does not
  // import, and the Publish dialog lists it, so a template inserts none
  test("every component a template inserts is one a published page imports", () => {
    expect(
      registeredTemplates().flatMap(([key, { template: fragment }]) =>
        fragment.instances
          .filter(
            (instance) =>
              componentMayShip(instance.component, publishedComponents) ===
              false
          )
          .map((instance) => `${key}: ${instance.component}`)
      )
    ).toEqual([]);
  });

  // While org script is paused the canvas computes no expression
  // expressionMayRun refuses, and publishing drops it, so every expression a
  // template or a site template writes has to pass, where it is written
  // (findPausedExpressions)
  test("every expression a template inserts may run", () => {
    const fragments = registeredTemplates().map(
      ([key, { template: fragment }]) => ({
        source: key,
        title: '"Page"',
        description: undefined as undefined | string,
        fragment,
      })
    );
    let lastPageId = 0;
    for (const template of SITE_TEMPLATES) {
      const pages = renderSiteTemplate(template, {
        assetIds: new Map(
          Object.keys(template.images).map((file) => [file, `asset-${file}`])
        ),
        generatePageId: () => `page-${(lastPageId += 1)}`,
      });
      for (const page of pages) {
        fragments.push({
          source: `${template.id} ${page.key}`,
          // as the apply step writes them
          title: JSON.stringify(page.title),
          description: JSON.stringify(page.description),
          fragment: page.fragment,
        });
      }
    }
    expect(SITE_TEMPLATES).toHaveLength(5);

    let expressions = 0;
    const paused = fragments.flatMap(
      ({ source, title, description, fragment }) => {
        const body: Instance = {
          type: "instance",
          id: "page-body",
          component: "Body",
          children: fragment.children,
        };
        for (const prop of fragment.props) {
          expressions += prop.type === "expression" ? 1 : 0;
        }
        for (const instance of fragment.instances) {
          for (const child of instance.children) {
            expressions += child.type === "expression" ? 1 : 0;
          }
        }
        return findPausedExpressions({
          pages: [
            {
              id: "page",
              name: "Page",
              path: "",
              title,
              meta: { description },
              rootInstanceId: body.id,
            },
          ],
          instances: new Map(
            [body, ...fragment.instances].map((instance) => [
              instance.id,
              instance,
            ])
          ),
          props: fragment.props,
          dataSources: new Map(
            fragment.dataSources.map((dataSource) => [
              dataSource.id,
              dataSource,
            ])
          ),
          resources: new Map(
            fragment.resources.map((resource) => [resource.id, resource])
          ),
        }).map((item) => ({ source, item }));
      }
    );
    // the forms' states and shows, the cards' fields and links, in the blocks
    // and in the site templates that place them
    expect(expressions).toBeGreaterThanOrEqual(200);
    expect(paused).toEqual([]);
  }, 60_000);

  // What a template inserts is checked by the rules the canvas and publish
  // apply, so no template brings in what the pause would drop or stub.
  test("every registry library's templates render with no paused tag or prop", () => {
    const templates = registeredTemplates();
    const keys = templates.map(([key]) => key);
    // one of each library, so the check is not empty
    expect(keys).toEqual(
      expect.arrayContaining([
        "ws:block",
        "YouTube",
        "@webstudio-is/sdk-components-react-radix:Sheet",
        "@organizeos/site-components:SignupForm",
      ])
    );
    expect(keys).not.toContain("builtWithWebstudio");
    expect(keys).not.toContain("ContentEmbed");
    expect(keys).not.toContain("MarkdownEmbed");
    const found: string[] = [];
    for (const [key, { template: fragment }] of templates) {
      for (const instance of fragment.instances) {
        if (
          checksInstanceTag(instance.component) &&
          instance.tag !== undefined &&
          elementTagMayRender(instance.tag) === false
        ) {
          found.push(`${key}: ${instance.component} tag ${instance.tag}`);
        }
      }
      for (const prop of fragment.props) {
        const instance = fragment.instances.find(
          (item) => item.id === prop.instanceId
        );
        if (instance === undefined) {
          continue;
        }
        if (propNameMayRun(prop.name) === false) {
          found.push(`${key}: ${instance.component} ${prop.name}`);
        }
        // an action is judged in its template's context, above
        if (prop.type !== "action" && propMayShip(instance, prop) === false) {
          found.push(`${key}: ${instance.component} ${prop.name} ships not`);
        }
        if (
          checksTagProp(instance.component, prop.name) &&
          (prop.type !== "string" || elementTagMayRender(prop.value) === false)
        ) {
          found.push(`${key}: ${instance.component} ${prop.name} tag`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  test("registers the canvas components and hides the embeds", () => {
    registerAsCanvas();
    expect($registeredComponents.get().get("HtmlEmbed")).toBe(CanvasHtmlEmbed);
    expect($registeredComponents.get().get("MarkdownEmbed")).toBe(
      CanvasMarkdownEmbed
    );
    expect(
      $registeredComponentMetas.get().get("HtmlEmbed")?.props
    ).not.toHaveProperty("executeScriptOnCanvas");
    for (const name of ["HtmlEmbed", "MarkdownEmbed", "JsonLd"]) {
      expect($registeredComponentMetas.get().get(name)?.category, name).toBe(
        "hidden"
      );
    }
  });
});

describe("the command palette", () => {
  const paletteComponents = (register: () => void) => {
    register();
    openCommandPanel();
    return $componentOptions.get().map((option) => option.component);
  };

  afterEach(() => {
    closeCommandPanel();
    resetRegistry();
  });

  // T4, as the panel and the palette read it. The Components panel reads the
  // same two registries and the same category.
  test("lists HTML Embed, Content Embed, Markdown Embed and JSON-LD as upstream registers them", () => {
    const names = paletteComponents(() => {
      for (const library of canvasComponentLibraries) {
        registerComponentLibrary(library);
      }
    });
    expect(names).toEqual(
      expect.arrayContaining([
        "HtmlEmbed",
        "ContentEmbed",
        "MarkdownEmbed",
        "JsonLd",
        "builtWithWebstudio",
      ])
    );
  });

  test("lists none of them once the pause is applied, and still lists the rest", () => {
    const names = paletteComponents(registerAsCanvas);
    expect(names).not.toContain("HtmlEmbed");
    expect(names).not.toContain("ContentEmbed");
    expect(names).not.toContain("MarkdownEmbed");
    expect(names).not.toContain("JsonLd");
    expect(names).not.toContain("builtWithWebstudio");
    expect(names).toEqual(
      expect.arrayContaining(["Vimeo", "YouTube", "form", "ws:element"])
    );
  });
});

describe("CanvasHtmlEmbed while embeds may not ship", () => {
  // T5. Upstream's HTML Embed, which the canvas registers today, puts the
  // markup into the page in every mode.
  describe.each(modes)("in $name", (mode) => {
    const props = { executeScriptOnCanvas: mode.executeScriptOnCanvas };

    test("upstream's HTML Embed puts the script and the handler into the DOM", () => {
      const host = render(
        mode,
        <HtmlEmbed {...props} code={upstreamScriptAndHandler} />
      );
      expect(host.querySelector("script")).not.toBeNull();
      expect(host.querySelector("img")).not.toBeNull();
    });

    test("shows the notice and puts neither into the DOM", () => {
      const host = render(
        mode,
        <CanvasHtmlEmbed {...props} code={scriptAndHandler} />
      );
      expect(host.textContent).toContain("HTML Embed is paused");
      expect(host.querySelector("script")).toBeNull();
      expect(host.querySelector("img")).toBeNull();
      expect(host.innerHTML).not.toContain("window.x");
      expect((window as { x?: number }).x).toBeUndefined();
    });

    test.each([
      ["a number", 12345],
      ["an object", { toString: () => scriptAndHandler }],
      ["an array holding the markup", [scriptAndHandler]],
      ["an array holding an icon", [MenuIcon]],
      ["null", null],
    ])(
      "shows the notice when code is %s, and never reaches upstream's String(code)",
      (_name, code) => {
        const host = render(
          mode,
          <CanvasHtmlEmbed {...props} code={code as never} />
        );
        expect(host.textContent).toContain("HTML Embed is paused");
        expect(host.querySelector("script")).toBeNull();
        expect(host.querySelector("img")).toBeNull();
        expect(host.querySelector("svg")).toBeNull();
        expect(host.innerHTML).not.toContain("window.x");
      }
    );

    test("shows the notice for code that is missing", () => {
      // The canvas passes no code prop for an embed that has none
      const host = render(
        mode,
        <CanvasHtmlEmbed {...props} code={undefined as never} />
      );
      expect(host.textContent).toContain("HTML Embed is paused");
    });

    // T6. A guard on the exception
    test.each([...templateIconCodes])("renders a template icon", (icon) => {
      const host = render(mode, <CanvasHtmlEmbed {...props} code={icon} />);
      expect(host.querySelector("svg")).not.toBeNull();
      expect(host.textContent).not.toContain("paused");
    });
  });

  test("renders the MenuIcon of the Sheet", () => {
    const host = render(modes[1], <CanvasHtmlEmbed code={MenuIcon} />);
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.querySelector("path")?.getAttribute("d")).toContain("M2.667");
  });

  test("renders the notice where the embed is: its ref, its data attributes and a box", () => {
    const ref = createRef<HTMLDivElement>();
    const host = render(
      modes[1],
      <CanvasHtmlEmbed
        ref={ref}
        data-ws-id="embed-1"
        data-ws-component="HtmlEmbed"
        className="c1"
        code={scriptAndHandler}
        clientOnly
        executeScriptOnCanvas
      />
    );
    const notice = host.firstElementChild as HTMLDivElement;
    expect(ref.current).toBe(notice);
    expect(notice.getAttribute("data-ws-id")).toBe("embed-1");
    expect(notice.getAttribute("data-ws-component")).toBe("HtmlEmbed");
    expect(notice.className).toBe("c1");
    // HTML Embed's preset is display: contents, which gives it no box
    expect(notice.style.display).toBe("block");
    expect(notice.style.padding).not.toBe("");
    // The embed's own props do not reach the DOM
    expect(notice.hasAttribute("code")).toBe(false);
    expect(notice.hasAttribute("clientonly")).toBe(false);
    expect(notice.hasAttribute("executescriptoncanvas")).toBe(false);
  });

  // The canvas gives every HTML Embed $ws$executeScripts after its props
  // (webstudio-component.tsx), which upstream's embed reads. The notice must
  // not pass it to its div. React leaves a $-named attribute off the DOM (and
  // warns once per name), so neither the DOM nor the console shows it: the
  // test reads the props React holds for the div instead.
  test("passes no $ws$executeScripts to the notice's element", () => {
    const host = render(
      modes[1],
      <CanvasHtmlEmbed
        data-ws-id="embed-3"
        code={scriptAndHandler}
        $ws$executeScripts
      />
    );
    const notice = host.firstElementChild as HTMLDivElement;
    expect(notice.textContent).toContain("HTML Embed is paused");
    const props = hostProps(notice);
    // the control: these are the props the embed passed on
    expect(props["data-ws-id"]).toBe("embed-3");
    expect(Object.keys(props)).not.toContain("$ws$executeScripts");
  });

  test("still renders an icon given $ws$executeScripts", () => {
    const host = render(
      modes[1],
      <CanvasHtmlEmbed code={MenuIcon} $ws$executeScripts />
    );
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.textContent).not.toContain("paused");
  });

  test("tells the admin what is going on", () => {
    const host = render(modes[0], <CanvasHtmlEmbed code={scriptAndHandler} />);
    expect(host.textContent).toBe(
      "HTML Embed is paused. Its code is kept, but it isn't published and doesn't run here: scripts on your site could read the OrganizeOS sign-in of people who visit."
    );
  });
});

describe("CanvasMarkdownEmbed while embeds may not ship", () => {
  const markdown = "[x](javascript:void0)\n\n<script>window.x=1</script>";

  describe.each(modes)("in $name", (mode) => {
    // The control. 0.309.0's Markdown Embed sanitizes its HTML (no script,
    // no javascript: address; before, it kept both), and it still puts the
    // markdown into the DOM, which the stand-in does not.
    test("upstream's Markdown Embed puts the markdown into the DOM, sanitized", () => {
      const host = render(mode, <MarkdownEmbed code={markdown} />);
      expect(host.querySelector("a")?.textContent).toBe("x");
      expect(host.querySelector("a")?.hasAttribute("href")).toBe(false);
      expect(host.querySelector("script")).toBeNull();
    });

    // Only what tells the stand-in from upstream's sanitizing embed: the
    // notice shows, and none of the markdown renders (upstream renders the
    // link, without its address). That no script or javascript: address
    // reaches the DOM no longer tells them apart, since upstream's embed
    // drops both too.
    test("shows the notice, and none of the markdown", () => {
      const host = render(mode, <CanvasMarkdownEmbed code={markdown} />);
      expect(host.textContent).toContain("Markdown Embed is paused");
      expect(host.querySelector("a")).toBeNull();
    });

    // upstream's embed throws on code that is not a string, so without the
    // stand-in this fails on the render, before these assertions
    test("shows the notice for code that is not a string", () => {
      const host = render(
        mode,
        <CanvasMarkdownEmbed code={[markdown] as never} />
      );
      expect(host.textContent).toContain("Markdown Embed is paused");
      expect(host.querySelector("a")).toBeNull();
    });
  });

  test("renders the notice where the embed is", () => {
    const ref = createRef<HTMLDivElement>();
    const host = render(
      modes[0],
      <CanvasMarkdownEmbed
        ref={ref}
        data-ws-id="embed-2"
        className="c2"
        code={markdown}
      />
    );
    const notice = host.firstElementChild as HTMLDivElement;
    expect(ref.current).toBe(notice);
    expect(notice.getAttribute("data-ws-id")).toBe("embed-2");
    expect(notice.className).toBe("c2");
    expect(notice.style.display).toBe("block");
    expect(notice.textContent).toBe(
      "Markdown Embed is paused. Its content is kept, but it isn't published and isn't shown here: a link in it could run script that reads the OrganizeOS sign-in of people who visit."
    );
  });
});

const publishedOnly = "Shows on the published site";

// What the document held before a test: an embed's markup must add nothing to
// the head (React hoists a script with async and src there)
const headNodes = () =>
  Array.from(document.head.children, (node) => node.outerHTML);

describe("CanvasHtmlEmbed once embeds may ship", () => {
  let headBefore: string[];
  beforeEach(() => {
    embeds.mayShip = true;
    headBefore = headNodes();
  });

  const assertDocumentInert = async () => {
    await nextFrames();
    assertInert(document.body);
    expect(headNodes()).toEqual(headBefore);
  };

  const variants = modes
    .filter((mode) => mode.isSafeMode !== true)
    .flatMap((mode) => [
      { ...mode, executeScripts: false },
      { ...mode, executeScripts: true },
    ]);

  describe.each(variants)(
    "in $name, $ws$executeScripts $executeScripts",
    (mode) => {
      const props = {
        executeScriptOnCanvas: mode.executeScriptOnCanvas,
        $ws$executeScripts: mode.executeScripts,
      };

      test.each([
        ...Object.entries(corpus),
        ["a Resource's array", ["<img src=x onerror=window.__pwned=1>"]],
      ])("%s leaves the document inert", async (_name, code) => {
        const host = render(
          mode,
          <CanvasHtmlEmbed {...props} code={code as never} />
        );
        await assertDocumentInert();
        assertNoDataAttributes(host);
      });

      test("a script-only embed shows the box", async () => {
        const host = render(
          mode,
          <CanvasHtmlEmbed {...props} code="<script>window.x=1</script>" />
        );
        expect(host.textContent).toBe(publishedOnly);
        await assertDocumentInert();
        expect((window as { x?: number }).x).toBeUndefined();
      });

      test("code whose String() throws shows the box", () => {
        const host = render(
          mode,
          <CanvasHtmlEmbed {...props} code={{ toString: 1 } as never} />
        );
        expect(host.textContent).toBe(publishedOnly);
      });

      test("under an svg, any code that is not an icon shows the box and inserts nothing", async () => {
        const host = render(
          mode,
          <svg>
            <CanvasHtmlEmbed
              {...props}
              code='<p>x</p><img src=x onerror="window.__pwned=1">'
            />
          </svg>
        );
        expect(host.textContent).toBe(publishedOnly);
        expect(host.querySelector("p, img")).toBeNull();
        await assertDocumentInert();
      });

      test("the MenuIcon renders through upstream's component", () => {
        const host = render(
          mode,
          <CanvasHtmlEmbed {...props} code={MenuIcon} />
        );
        expect(host.querySelector("svg path")).not.toBeNull();
      });

      test("the same icon inside an array goes through the insertion path", () => {
        const host = render(
          mode,
          <CanvasHtmlEmbed {...props} code={[MenuIcon] as never} />
        );
        const svg = host.querySelector("svg");
        expect(svg).not.toBeNull();
        // upstream's embed writes its code with dangerouslySetInnerHTML; the
        // insertion path's wrapper holds no such prop
        expect(svg?.parentElement).not.toBeNull();
        expect(
          Object.keys(hostProps(svg?.parentElement as Element))
        ).not.toContain("dangerouslySetInnerHTML");
      });

      test("missing code shows upstream's placeholder", () => {
        const host = render(
          mode,
          <CanvasHtmlEmbed {...props} code={undefined as never} />
        );
        expect(host.textContent).toBe(
          'Open the "Settings" panel to insert HTML code.'
        );
        const blank = render(mode, <CanvasHtmlEmbed {...props} code="  " />);
        expect(blank.textContent).toBe(
          'Open the "Settings" panel to insert HTML code.'
        );
      });
    }
  );

  test("the wrapper, and the box, carry the ref and data-ws-id, and no embed prop", () => {
    const ref = createRef<HTMLDivElement>();
    const ui = (code: string) => (
      <CanvasHtmlEmbed
        ref={ref}
        data-ws-id="embed-1"
        code={code}
        clientOnly
        executeScriptOnCanvas
        $ws$executeScripts
      />
    );
    const host = render(modes[1], ui("<p>x</p>"));
    const wrapper = host.querySelector('[data-ws-id="embed-1"]');
    expect(ref.current).toBe(wrapper);
    expect(wrapper?.querySelector("p")).not.toBeNull();
    for (const name of ["clientonly", "executescriptoncanvas", "code"]) {
      expect(wrapper?.hasAttribute(name), name).toBe(false);
    }
    expect(Object.keys(hostProps(wrapper as Element))).not.toContain(
      "$ws$executeScripts"
    );
    rerender(modes[1], ui("<script>1</script>"));
    const box = host.querySelectorAll('[data-ws-id="embed-1"]');
    expect(box).toHaveLength(1);
    expect(box[0].textContent).toBe(publishedOnly);
    expect(ref.current).toBe(box[0]);
    for (const name of ["clientonly", "executescriptoncanvas", "code"]) {
      expect(box[0].hasAttribute(name), name).toBe(false);
    }
  });

  // upstream's html-embed-assets.browser.test.tsx, through the canvas's own
  // embed (asset paths are resolved before sanitizing, as upstream does)
  test("the canvas embed resolves an asset path as upstream does", async () => {
    const assets = [
      {
        id: "stylesheet",
        projectId: "project",
        name: "site_hash.css",
        filename: "site",
        type: "file",
        size: 1,
        format: "css",
        createdAt: "2026-01-01T00:00:00.000Z",
        description: null,
        meta: {},
      },
      {
        id: "image",
        projectId: "project",
        name: "hero_hash.png",
        filename: "hero",
        type: "image",
        size: 1,
        format: "png",
        createdAt: "2026-01-01T00:00:00.000Z",
        description: null,
        meta: { width: 100, height: 100 },
      },
    ] as Asset[];
    const assetUrlsByPath = createAssetUrlsByPath({
      assets,
      assetFolders: new Map(),
      getUrl: (asset) => toRuntimeAsset(asset, "https://webstudio.local").url,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <ReactSdkContext.Provider
          value={{
            renderer: "canvas",
            assetBaseUrl: "",
            assetUrlsByPath,
            imageLoader: ({ src }) => src,
            resources: {},
            breakpoints: [],
            onError: (error) => {
              throw error;
            },
          }}
        >
          <CanvasHtmlEmbed
            code={`
              <link rel="stylesheet" href="/site.css">
              <img src="/hero.png">
            `}
          />
        </ReactSdkContext.Provider>
      );
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/cgi/image/hero_hash.png?format=raw"
    );
    // the allowlist removes the link
    expect(container.querySelector("link")).toBeNull();
  });

  test("a re-render with the same code keeps the inserted node; new code leaves none of the old", () => {
    const host = render(modes[1], <CanvasHtmlEmbed code="<p>a</p><i>b</i>" />);
    const p = host.querySelector("p");
    expect(p).not.toBeNull();
    rerender(modes[1], <CanvasHtmlEmbed code="<p>a</p><i>b</i>" />);
    expect(host.querySelector("p")).toBe(p);
    rerender(modes[1], <CanvasHtmlEmbed code="<b>c</b>" />);
    expect(host.querySelector("p, i")).toBeNull();
    expect(host.querySelectorAll("b")).toHaveLength(1);
  });
});

describe("CanvasMarkdownEmbed once embeds may ship", () => {
  let headBefore: string[];
  beforeEach(() => {
    embeds.mayShip = true;
    headBefore = headNodes();
  });

  describe.each(modes.filter((mode) => mode.isSafeMode !== true))(
    "in $name",
    (mode) => {
      test("a javascript: link, a raw iframe and a handler leave the document inert", async () => {
        const host = render(
          mode,
          <CanvasMarkdownEmbed
            code={
              '[x](javascript:alert(1))\n\n<iframe src="https://x.example"></iframe>\n\n<img src=x onerror="window.__pwned=1">'
            }
          />
        );
        await nextFrames();
        assertInert(document.body);
        expect(headNodes()).toEqual(headBefore);
        expect(host.querySelector("iframe")).toBeNull();
        expect(host.querySelector("a")?.hasAttribute("href")).toBe(false);
      });

      test("renders Markdown", () => {
        const host = render(mode, <CanvasMarkdownEmbed code="# Title" />);
        expect(host.querySelector("h1")?.textContent).toBe("Title");
      });

      test("code that is not a string renders nothing and shows the box", () => {
        const host = render(
          mode,
          <CanvasMarkdownEmbed code={["# Title"] as never} />
        );
        expect(host.querySelector("h1")).toBeNull();
        expect(host.textContent).toBe(publishedOnly);
      });
    }
  );
});

describe("instanceTagMayRender", () => {
  test("a tag the builder does not offer never renders, whatever the switch", () => {
    for (const mayRun of [false, true]) {
      for (const component of ["ws:element", "Box", "Text", "Heading"]) {
        for (const tag of ["script", 'div"', "Div", 1]) {
          expect(
            instanceTagMayRender(component, tag, mayRun),
            `${component} ${tag} ${mayRun}`
          ).toBe(false);
        }
        expect(instanceTagMayRender(component, "section", mayRun)).toBe(true);
      }
    }
  });

  test("animate and set render only while the switch is on", () => {
    expect(instanceTagMayRender("ws:element", "animate", false)).toBe(false);
    expect(instanceTagMayRender("ws:element", "animate", true)).toBe(true);
  });

  test("an XML Node's tag is left to the switch", () => {
    expect(instanceTagMayRender("XmlNode", "urlset", true)).toBe(true);
    expect(instanceTagMayRender("XmlNode", "urlset", false)).toBe(false);
  });

  test("every tag the builder offers but animate and set renders", () => {
    for (const tag of tags) {
      expect(instanceTagMayRender("ws:element", tag, false), tag).toBe(
        tag !== "animate" && tag !== "set"
      );
    }
  });
});
