import { createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, test } from "vitest";
import {
  blockComponent,
  tags,
  type Instance,
  type WsComponentMeta,
} from "@webstudio-is/sdk";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import {
  HtmlEmbed,
  MarkdownEmbed,
} from "@webstudio-is/sdk-components-react/components";
import { canvasComponentLibraries } from "@webstudio-is/sdk-components-registry/canvas";
import * as organizeosComponents from "@organizeos/site-components";
import * as organizeosComponentMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import {
  checksInstanceTag,
  checksTagProp,
  elementTagMayRender,
  propMayShip,
  propNameMayRun,
  templateIconCodes,
} from "@organizeos/site-components/org-script";
import { MenuIcon } from "@webstudio-is/icons/svg";
import type { TemplateMeta } from "@webstudio-is/template";
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
  PausedHtmlEmbed,
  PausedMarkdownEmbed,
  instanceTagMayRender,
  withOrgScriptPolicy,
  withoutBuiltWithWebstudio,
} from "./organizeos-org-script";

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
  return container;
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
    const result = withOrgScriptPolicy(library);
    // The panel and the palette list a meta by its category, and skip hidden
    expect(library.metas.HtmlEmbed.category).toBe("general");
    expect(result.metas.HtmlEmbed.category).toBe("hidden");
    // Nothing else about the meta changes: the Navigator, its icon and its label
    expect(result.metas.HtmlEmbed).toEqual({
      ...library.metas.HtmlEmbed,
      category: "hidden",
    });
    // The input is not changed
    expect(library.metas.HtmlEmbed.category).toBe("general");
  });

  test("hides Markdown Embed", () => {
    const result = withOrgScriptPolicy(library);
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
    const result = withOrgScriptPolicy(library);
    expect(library.metas.JsonLd.category).toBe("general");
    expect(result.metas.JsonLd).toEqual({
      ...library.metas.JsonLd,
      category: "hidden",
    });
    expect(result.components.JsonLd).toBe(library.components.JsonLd);
  });

  test("leaves Content Embed and Markdown Embed templates out", () => {
    const result = withOrgScriptPolicy(library);
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

  test("registers the paused stand-ins for HTML Embed and Markdown Embed", () => {
    const result = withOrgScriptPolicy(library);
    expect(library.components.HtmlEmbed).not.toBe(PausedHtmlEmbed);
    expect(result.components.HtmlEmbed).toBe(PausedHtmlEmbed);
    expect(result.components.MarkdownEmbed).toBe(PausedMarkdownEmbed);
  });

  test("passes every other entry through by reference, the registry's component ids too", () => {
    const result = withOrgScriptPolicy(library);
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

  test("returns its input when the switch is on", () => {
    expect(withOrgScriptPolicy(library, { mayRun: true })).toBe(library);
  });

  test("leaves a library without these components alone", () => {
    const other = {
      components: { Box: library.components.Box },
      metas: {} as Record<string, WsComponentMeta>,
      templates: {} as Record<string, TemplateMeta>,
    };
    const result = withOrgScriptPolicy(other);
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
        if (propMayShip(instance, prop) === false) {
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

  test("registers the paused stand-ins and hides the embeds", () => {
    registerAsCanvas();
    expect($registeredComponents.get().get("HtmlEmbed")).toBe(PausedHtmlEmbed);
    expect($registeredComponents.get().get("MarkdownEmbed")).toBe(
      PausedMarkdownEmbed
    );
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

describe("PausedHtmlEmbed", () => {
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
        <PausedHtmlEmbed {...props} code={scriptAndHandler} />
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
          <PausedHtmlEmbed {...props} code={code as never} />
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
        <PausedHtmlEmbed {...props} code={undefined as never} />
      );
      expect(host.textContent).toContain("HTML Embed is paused");
    });

    // T6. A guard on the exception
    test.each([...templateIconCodes])("renders a template icon", (icon) => {
      const host = render(mode, <PausedHtmlEmbed {...props} code={icon} />);
      expect(host.querySelector("svg")).not.toBeNull();
      expect(host.textContent).not.toContain("paused");
    });
  });

  test("renders the MenuIcon of the Sheet", () => {
    const host = render(modes[1], <PausedHtmlEmbed code={MenuIcon} />);
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.querySelector("path")?.getAttribute("d")).toContain("M2.667");
  });

  test("renders the notice where the embed is: its ref, its data attributes and a box", () => {
    const ref = createRef<HTMLDivElement>();
    const host = render(
      modes[1],
      <PausedHtmlEmbed
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
      <PausedHtmlEmbed
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
      <PausedHtmlEmbed code={MenuIcon} $ws$executeScripts />
    );
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.textContent).not.toContain("paused");
  });

  test("tells the admin what is going on", () => {
    const host = render(modes[0], <PausedHtmlEmbed code={scriptAndHandler} />);
    expect(host.textContent).toBe(
      "HTML Embed is paused. Its code is kept, but it isn't published and doesn't run here: scripts on your site could read the OrganizeOS sign-in of people who visit."
    );
  });
});

describe("PausedMarkdownEmbed", () => {
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
      const host = render(mode, <PausedMarkdownEmbed code={markdown} />);
      expect(host.textContent).toContain("Markdown Embed is paused");
      expect(host.querySelector("a")).toBeNull();
    });

    // upstream's embed throws on code that is not a string, so without the
    // stand-in this fails on the render, before these assertions
    test("shows the notice for code that is not a string", () => {
      const host = render(
        mode,
        <PausedMarkdownEmbed code={[markdown] as never} />
      );
      expect(host.textContent).toContain("Markdown Embed is paused");
      expect(host.querySelector("a")).toBeNull();
    });
  });

  test("renders the notice where the embed is", () => {
    const ref = createRef<HTMLDivElement>();
    const host = render(
      modes[0],
      <PausedMarkdownEmbed
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
