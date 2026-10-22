import { createRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, test } from "vitest";
import {
  blockComponent,
  coreMetas,
  type Instance,
  type WsComponentMeta,
} from "@webstudio-is/sdk";
import { coreTemplates } from "@webstudio-is/sdk/core-templates";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import {
  HtmlEmbed,
  MarkdownEmbed,
} from "@webstudio-is/sdk-components-react/components";
import * as baseComponents from "@webstudio-is/sdk-components-react/components";
import * as baseComponentMetas from "@webstudio-is/sdk-components-react/metas";
import * as baseComponentTemplates from "@webstudio-is/sdk-components-react/templates";
import * as radixTemplates from "@webstudio-is/sdk-components-react-radix/templates";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import { templateIconCodes } from "@organizeos/site-components/org-script";
import { MenuIcon } from "@webstudio-is/icons/svg";
import { renderTemplate, type TemplateMeta } from "@webstudio-is/template";
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
  withOrgScriptPolicy,
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
});

const scriptAndHandler =
  '<script>window.x=1</script><img src=x onerror="window.x=1">';

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

describe("withOrgScriptPolicy", () => {
  const library = {
    components: baseComponents,
    metas: baseComponentMetas,
    hooks: [],
    templates: baseComponentTemplates,
  };

  // T4
  test("hides HTML Embed from the Components panel and the command palette", () => {
    const result = withOrgScriptPolicy(library);
    // The panel and the palette list a meta by its category, and skip hidden
    expect(baseComponentMetas.HtmlEmbed.category).toBe("general");
    expect(result.metas.HtmlEmbed.category).toBe("hidden");
    // Nothing else about the meta changes: the Navigator, its icon and its label
    expect(result.metas.HtmlEmbed).toEqual({
      ...baseComponentMetas.HtmlEmbed,
      category: "hidden",
    });
    // The input is not changed
    expect(baseComponentMetas.HtmlEmbed.category).toBe("general");
  });

  test("hides Markdown Embed", () => {
    const result = withOrgScriptPolicy(library);
    expect(result.metas.MarkdownEmbed.category).toBe("hidden");
    expect(result.metas.MarkdownEmbed).toEqual({
      ...baseComponentMetas.MarkdownEmbed,
      category: "hidden",
    });
  });

  test("leaves Content Embed and Markdown Embed templates out", () => {
    const result = withOrgScriptPolicy(library);
    expect(baseComponentTemplates).toHaveProperty("ContentEmbed");
    expect(baseComponentTemplates).toHaveProperty("MarkdownEmbed");
    expect(result.templates).not.toHaveProperty("ContentEmbed");
    expect(result.templates).not.toHaveProperty("MarkdownEmbed");
    expect(Object.keys(result.templates).sort()).toEqual(
      Object.keys(baseComponentTemplates)
        .filter((name) => name !== "ContentEmbed" && name !== "MarkdownEmbed")
        .sort()
    );
  });

  test("registers the paused stand-ins for HTML Embed and Markdown Embed", () => {
    const result = withOrgScriptPolicy(library);
    expect(baseComponents.HtmlEmbed).not.toBe(PausedHtmlEmbed);
    expect(result.components.HtmlEmbed).toBe(PausedHtmlEmbed);
    expect(result.components.MarkdownEmbed).toBe(PausedMarkdownEmbed);
  });

  test("passes every other entry through by reference", () => {
    const result = withOrgScriptPolicy(library);
    for (const [name, component] of Object.entries(baseComponents)) {
      if (name === "HtmlEmbed" || name === "MarkdownEmbed") {
        continue;
      }
      expect(result.components[name as keyof typeof result.components]).toBe(
        component
      );
    }
    for (const [name, meta] of Object.entries(baseComponentMetas)) {
      if (name === "HtmlEmbed" || name === "MarkdownEmbed") {
        continue;
      }
      expect(result.metas[name as keyof typeof result.metas]).toBe(meta);
    }
    for (const [name, template] of Object.entries(baseComponentTemplates)) {
      if (name === "ContentEmbed" || name === "MarkdownEmbed") {
        continue;
      }
      expect(result.templates[name as keyof typeof result.templates]).toBe(
        template
      );
    }
    expect(result.hooks).toBe(library.hooks);
  });

  test("returns its input when the switch is on", () => {
    expect(withOrgScriptPolicy(library, { mayRun: true })).toBe(library);
  });

  test("leaves a library without these components alone", () => {
    const other = {
      components: { Box: baseComponents.Box },
      metas: {} as Record<string, WsComponentMeta>,
      templates: {} as Record<string, TemplateMeta>,
    };
    const result = withOrgScriptPolicy(other);
    expect(result.components).toEqual({ Box: baseComponents.Box });
    expect(result.metas).toEqual({});
    expect(result.templates).toEqual({});
  });
});

describe("the base library, as the canvas registers it", () => {
  // The canvas registers core without the "Built with Webstudio" badge, then
  // the base library through the policy, then Radix and the OrganizeOS blocks.
  const { builtWithWebstudio: _builtWithWebstudio, ...coreWithoutBadge } =
    coreTemplates;
  const base = withOrgScriptPolicy({
    components: baseComponents,
    metas: baseComponentMetas,
    templates: baseComponentTemplates,
  });
  const libraries: Array<[string, Record<string, TemplateMeta>]> = [
    ["core", coreWithoutBadge],
    ["base", base.templates],
    ["radix", radixTemplates],
    ["organizeos", organizeosTemplates],
  ];

  const getEmbeds = (component: string) => {
    const found: Array<{
      library: string;
      template: string;
      instance: Instance;
      code: unknown;
    }> = [];
    for (const [library, templates] of libraries) {
      for (const [name, meta] of Object.entries(templates)) {
        const fragment = renderTemplate(meta.template);
        for (const instance of fragment.instances) {
          if (instance.component !== component) {
            continue;
          }
          const code = fragment.props.find(
            (prop) => prop.instanceId === instance.id && prop.name === "code"
          );
          found.push({
            library,
            template: name,
            instance,
            code: code && "value" in code ? code.value : undefined,
          });
        }
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
    expect(
      paused.map(({ library, template, code }) => ({
        library,
        template,
        code,
      }))
    ).toEqual([{ library: "core", template: blockComponent, code: undefined }]);
  });

  test("no template inserts a Markdown Embed", () => {
    expect(getEmbeds("MarkdownEmbed")).toEqual([]);
  });
});

describe("the command palette", () => {
  const { builtWithWebstudio: _builtWithWebstudio, ...coreWithoutBadge } =
    coreTemplates;

  const paletteComponents = (
    library: Parameters<typeof withOrgScriptPolicy>[0]
  ) => {
    registerComponentLibrary({
      components: {},
      metas: coreMetas,
      templates: coreWithoutBadge,
    });
    registerComponentLibrary(library);
    openCommandPanel();
    return $componentOptions.get().map((option) => option.component);
  };

  const library = {
    components: baseComponents,
    metas: baseComponentMetas,
    hooks: [],
    templates: baseComponentTemplates,
  };

  afterEach(() => {
    closeCommandPanel();
    $registeredComponents.set(new Map());
    $registeredComponentMetas.set(new Map());
    $registeredTemplates.set(new Map());
  });

  // T4, as the panel and the palette read it. The Components panel reads the
  // same two registries and the same category.
  test("lists HTML Embed, Content Embed and Markdown Embed as upstream registers them", () => {
    expect(paletteComponents(library)).toEqual(
      expect.arrayContaining(["HtmlEmbed", "ContentEmbed", "MarkdownEmbed"])
    );
  });

  test("lists none of them once the pause is applied, and still lists the rest", () => {
    const names = paletteComponents(withOrgScriptPolicy(library));
    expect(names).not.toContain("HtmlEmbed");
    expect(names).not.toContain("ContentEmbed");
    expect(names).not.toContain("MarkdownEmbed");
    expect(names).toEqual(
      expect.arrayContaining(["Vimeo", "YouTube", "Form", "ws:element"])
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
        <HtmlEmbed {...props} code={scriptAndHandler} />
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
    test("upstream's Markdown Embed keeps the javascript: link", () => {
      const host = render(mode, <MarkdownEmbed code={markdown} />);
      expect(host.querySelector("a")?.getAttribute("href")).toBe(
        "javascript:void0"
      );
    });

    test("shows the notice and puts no code into the DOM", () => {
      const host = render(mode, <PausedMarkdownEmbed code={markdown} />);
      expect(host.textContent).toContain("Markdown Embed is paused");
      expect(host.querySelector("a")).toBeNull();
      expect(host.querySelector("script")).toBeNull();
      expect(host.innerHTML).not.toContain("javascript:");
      expect(host.innerHTML).not.toContain("window.x");
    });

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
