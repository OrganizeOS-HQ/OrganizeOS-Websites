import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TooltipProvider } from "@webstudio-is/design-system";
import { createDefaultPages } from "@webstudio-is/project-build";
import { getStyleDeclKey, ROOT_INSTANCE_ID } from "@webstudio-is/sdk";
import { camelCaseProperty } from "@webstudio-is/css-data";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  $selectedBreakpointId,
  $selectedPageId,
  $selectedStyleSources,
  $selectedStyleState,
  selectInstance,
} from "~/shared/nano-states";
import {
  $breakpoints,
  $instances,
  $pages,
  $styles,
} from "~/shared/sync/data-stores";
import { getComputedStyleDecl } from "~/shared/style-object-model";
import { applyPreset } from "./backgrounds/apply-preset";
import {
  builtInPalette,
  getBandVariables,
  presets,
  type Palette,
} from "./backgrounds/presets";
import {
  buildSectionStyleModel,
  listRootColorVariables,
  withRoot,
} from "~/builder/features/variables/style-model";
import {
  el,
  localId,
  registerTestMetas,
  root as globalRoot,
  setupProject,
  toStyleValue,
  type Node,
  type TestStyle,
} from "./test-fixtures";
import { getDefaultRoles, SectionBackground } from "./section-background";

vi.mock("./backgrounds/apply-preset", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./backgrounds/apply-preset")>();
  return { ...actual, applyPreset: vi.fn(actual.applyPreset) };
});

// The image picker's asset list, as one button that chooses the asset "photo".
// Every importer in this suite's graph takes only AssetManager. A factory that
// imports the original deadlocks: the asset manager's graph imports it back.
vi.mock("~/builder/shared/asset-manager", () => ({
  AssetManager: ({
    accept,
    onChange,
  }: {
    accept?: string;
    onChange?: (assetId: string) => void;
  }) =>
    createElement("button", {
      "data-choose-asset": accept,
      onClick: () => onChange?.("photo"),
    }),
}));

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// The image picker's dialog observes its size, and jsdom 20 has no
// ResizeObserver.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let root: Root | undefined;
let container: HTMLElement | undefined;

// body > section > text
const sectionSelector = ["section", "body"];

const project = ({
  children = [el("text", "Text", ["Hello"])],
  styles = [],
}: {
  children?: Node[];
  styles?: TestStyle[];
} = {}) => {
  setupProject({
    tree: el("body", "Body", [el("section", "Box", children)]),
    styles,
  });
  const pages = createDefaultPages({ rootInstanceId: "body" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
};

// The contrast report lands after a scheduled run (contrast-schedule.ts),
// which takes setTimeout where there is no requestIdleCallback (the suite
// removes Chromium's; background-presets-section.test.tsx covers both), and
// the image picker opens a frame after its click (the design system's
// Dialog): both helpers flush them after their change.
const flushContrastRun = () => {
  act(() => {
    vi.advanceTimersByTime(150);
  });
};

const render = ({ flush = true } = {}) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(SectionBackground))
    );
  });
  if (flush) {
    flushContrastRun();
  }
  return container;
};

const update = (change: () => void) => {
  act(change);
  flushContrastRun();
};

const contrastLine = (host: HTMLElement) =>
  host.querySelector("[data-contrast-line]");

const presetButton = (host: HTMLElement, id: string) =>
  host.querySelector<HTMLButtonElement>(`[data-preset="${id}"]`);

const presetById = (id: string) => presets.find((preset) => preset.id === id)!;

/** Opens a scrim preset's image picker and chooses the asset "photo". */
const chooseImage = (host: HTMLElement, id: string) => {
  update(() => presetButton(host, id)?.click());
  const choose = document.querySelector<HTMLButtonElement>(
    "[data-choose-asset]"
  );
  expect(choose?.getAttribute("data-choose-asset")).toBe("image/*");
  update(() => choose?.click());
};

const style = (
  on: string,
  property: TestStyle["property"],
  value: string
): TestStyle => ({ on, property, value });

/** Sets a decl on an instance's local source, as a style panel edit would. */
const setLocalStyle = (
  instanceId: string,
  property: TestStyle["property"],
  value: string
) => {
  const styles = new Map($styles.get());
  const decl = {
    styleSourceId: localId(instanceId),
    breakpointId: "base",
    property: camelCaseProperty(property),
    value: toStyleValue(property, value),
  };
  styles.set(getStyleDeclKey(decl), decl);
  $styles.set(styles);
};

const rootVariables = [
  style(globalRoot, "--paper", "#fafafa"),
  style(globalRoot, "--brand", "#0a7c8c"),
  style(globalRoot, "--ink", "#555555"),
  style(globalRoot, "--sky", "#3fc9e0"),
];

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame"],
  });
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.stubGlobal("requestIdleCallback", undefined);
  registerTestMetas();
  selectInstance(undefined);
  $selectedStyleSources.set(new Map());
  $selectedStyleState.set(undefined);
  vi.mocked(applyPreset).mockClear();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SectionBackground states", () => {
  test("renders nothing with no selection", () => {
    project();
    const host = render();
    expect(host.innerHTML).toBe("");
    expect(host.querySelector("[data-preset-grid]")).toBeNull();
  });

  test("renders nothing for the Body and Global Root", () => {
    project();
    selectInstance(["body"]);
    const host = render();
    expect(host.innerHTML).toBe("");
    update(() => selectInstance([ROOT_INSTANCE_ID]));
    expect(host.innerHTML).toBe("");
  });

  test("one button per preset, named by its label, and no text", () => {
    project({
      styles: [...rootVariables, style("text", "color", "#333333")],
    });
    selectInstance(sectionSelector);
    const host = render();
    const buttons = Array.from(host.querySelectorAll("button"));
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(
      presets.map((preset) => preset.label)
    );
    expect(host.textContent).toBe("");
  });

  test("a preset's label shows in a tooltip on keyboard focus", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    const tooltip = () =>
      document.querySelector('[role="tooltip"]')?.textContent;
    expect(tooltip()).toBeUndefined();
    update(() => presetButton(host, "wash-dark")?.focus());
    expect(tooltip()).toBe("Wash, dark");
    update(() => presetButton(host, "wash-dark")?.blur());
    expect(tooltip()).toBeUndefined();
  });
});

describe("applying a preset", () => {
  test("clicking a preset calls applyPreset with its styles", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    const host = render();
    update(() => presetButton(host, "bloom-light")?.click());
    expect(applyPreset).toHaveBeenCalledTimes(1);
    expect(applyPreset).toHaveBeenCalledWith(
      presetById("bloom-light").build(builtInPalette)
    );
    // written locally, and the report still reads it
    const local = $selectedStyleSources.get().get("section");
    expect(
      Array.from($styles.get().values()).some(
        (decl) =>
          decl.styleSourceId === local && decl.property === "backgroundImage"
      )
    ).toBe(true);
    expect(contrastLine(host)).toBeNull();
  });

  test("a scrim preset opens the image picker and applies with the chosen image", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    expect(document.querySelector("[data-choose-asset]")).toBeNull();
    chooseImage(host, "image-scrim-dark");
    expect(applyPreset).toHaveBeenCalledTimes(1);
    expect(applyPreset).toHaveBeenCalledWith([
      ...presetById("image-scrim-dark").build(builtInPalette, {
        imageAssetId: "photo",
      }),
      ...getBandVariables(presetById("image-scrim-dark"), builtInPalette),
    ]);
    // the picker closed
    expect(document.querySelector("[data-choose-asset]")).toBeNull();
  });

  test("a tap on the other scrim preset opens its picker while the first one closes", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    const expanded = (id: string) =>
      presetButton(host, id)?.getAttribute("aria-expanded");
    update(() => presetButton(host, "image-scrim-light")?.click());
    expect(expanded("image-scrim-light")).toBe("true");
    // the open picker listens for a pointer down outside it from the next tick
    flushContrastRun();
    // On touch, Radix dismisses the open picker on the tap's click, at the
    // document, so after the tapped trigger's own click handler: the first
    // picker's close lands a frame after the second one's open.
    const next = presetButton(host, "image-scrim-dark")!;
    const touch = new MouseEvent("pointerdown", { bubbles: true });
    Object.defineProperty(touch, "pointerType", { value: "touch" });
    update(() => {
      next.dispatchEvent(touch);
      next.click();
    });
    expect(expanded("image-scrim-dark")).toBe("true");
    expect(expanded("image-scrim-light")).toBe("false");
    expect(document.querySelectorAll("[data-choose-asset]")).toHaveLength(1);
  });
});

// As the site templates' kit bands do (site-templates canonical-variables.ts
// BAND_VARIABLES): a dark preset makes the section a band, which rings focus
// and sets accent text in its text colour; a light one makes it none.
describe("band variables", () => {
  const canonicalVariables = [
    style(globalRoot, "--base", "#fff8ec"),
    style(globalRoot, "--accent-1", "#1f3557"),
    style(globalRoot, "--accent-2", "#c2470f"),
    style(globalRoot, "--text", "#1a1a1a"),
  ];
  const sectionStyles = () => {
    const local = $selectedStyleSources.get().get("section");
    return Object.fromEntries(
      Array.from($styles.get().values())
        .filter((decl) => decl.styleSourceId === local)
        .map((decl) => [decl.property, decl.value])
    );
  };

  test("a dark preset sets the ring and accent text to the base", () => {
    project({ styles: canonicalVariables });
    selectInstance(sectionSelector);
    const host = render();
    update(() => presetButton(host, "tint-dark")?.click());
    expect(sectionStyles()).toMatchObject({
      "--focus-ring": { type: "var", value: "base" },
      "--accent-text": { type: "var", value: "base" },
    });
  });

  test("a light preset sets them back to accent-2", () => {
    project({
      styles: [
        ...canonicalVariables,
        style("section", "--focus-ring", "var(--base)"),
        style("section", "--accent-text", "var(--base)"),
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    update(() => presetButton(host, "wash-light")?.click());
    expect(sectionStyles()).toMatchObject({
      "--focus-ring": { type: "var", value: "accent-2" },
      "--accent-text": { type: "var", value: "accent-2" },
    });
  });

  // What text inside an element reads for a variable, at the given widths.
  const readAt = (
    instanceSelector: string[],
    property: `--${string}`,
    matchingBreakpoints = ["base"]
  ) =>
    getComputedStyleDecl({
      model: {
        ...buildSectionStyleModel(sectionSelector),
        matchingBreakpoints,
      },
      instanceSelector: withRoot(instanceSelector),
      property,
    }).computedValue;

  // As the kit's base panel inside a band: what sits on the light surface
  // rings focus and sets accent text in accent-2 again.
  test("a light surface nested in a dark band reads accent-2 inside it", () => {
    project({
      children: [el("panel", "Box", [el("text", "Text", ["Hello"])])],
      styles: canonicalVariables,
    });
    selectInstance(sectionSelector);
    const host = render();
    update(() => presetButton(host, "bloom-dark")?.click());
    update(() => selectInstance(["panel", ...sectionSelector]));
    update(() => presetButton(host, "tint-light")?.click());
    const text = ["text", "panel", ...sectionSelector];
    const accent2 = readAt(text, "--accent-2");
    expect(accent2).toMatchObject({ type: "color" });
    expect(readAt(text, "--focus-ring")).toEqual(accent2);
    expect(readAt(text, "--accent-text")).toEqual(accent2);
    // and the band around it still reads the base
    expect(readAt(sectionSelector, "--focus-ring")).toEqual(
      readAt(sectionSelector, "--base")
    );
  });

  // A dark band on wide screens that turns light on phones: unset at 767,
  // the variables would cascade in from the base breakpoint's band.
  test("a light preset at 767 after a dark preset at the base breakpoint reads accent-2 at 767", () => {
    project({ styles: canonicalVariables });
    $breakpoints.set(
      new Map([
        ...$breakpoints.get(),
        ["landscape", { id: "landscape", label: "", maxWidth: 767 }],
      ])
    );
    selectInstance(sectionSelector);
    const host = render();
    update(() => presetButton(host, "wash-dark")?.click());
    update(() => $selectedBreakpointId.set("landscape"));
    update(() => presetButton(host, "wash-light")?.click());
    const phone = ["base", "tablet", "landscape"];
    expect(readAt(sectionSelector, "--accent-2", phone)).toMatchObject({
      type: "color",
    });
    expect(readAt(sectionSelector, "--focus-ring", phone)).toEqual(
      readAt(sectionSelector, "--accent-2", phone)
    );
    expect(readAt(sectionSelector, "--accent-text", phone)).toEqual(
      readAt(sectionSelector, "--accent-2", phone)
    );
    // wider, the band stays
    expect(readAt(sectionSelector, "--focus-ring")).toEqual(
      readAt(sectionSelector, "--base")
    );
  });

  // Only a site template's site reads them.
  test("on a site whose colours are its own, no preset writes them", () => {
    project({ styles: rootVariables });
    selectInstance(sectionSelector);
    const host = render();
    update(() => presetButton(host, "tint-dark")?.click());
    expect(sectionStyles()).not.toHaveProperty("--focus-ring");
    expect(sectionStyles()).not.toHaveProperty("--accent-text");
    update(() => presetButton(host, "tint-light")?.click());
    expect(sectionStyles()).not.toHaveProperty("--focus-ring");
    expect(sectionStyles()).not.toHaveProperty("--accent-text");
  });
});

describe("palette", () => {
  test("the defaults: lightest base, darkest text, accents in order", () => {
    const color = (variable: string, value: number) => ({
      variable,
      rgba: { r: value, g: value, b: value, a: 1 },
    });
    expect(
      getDefaultRoles([
        color("a", 0.5),
        color("paper", 1),
        color("ink", 0.1),
        color("b", 0.6),
      ])
    ).toEqual({ base: "paper", text: "ink", accent1: "a", accent2: "b" });
    expect(getDefaultRoles([])).toEqual({});
  });

  test("roles follow the canonical names", () => {
    const color = (variable: string, value: number) => ({
      variable,
      rgba: { r: value, g: value, b: value, a: 1 },
    });
    // A dark base and a light text: the luminance rule would swap them.
    expect(
      getDefaultRoles([
        color("base", 0.05),
        color("accent-1", 0.5),
        color("accent-2", 0.6),
        color("text", 0.95),
      ])
    ).toEqual({
      base: "base",
      accent1: "accent-1",
      accent2: "accent-2",
      text: "text",
    });
  });

  test("three canonical names fall back to luminance", () => {
    const color = (variable: string, value: number) => ({
      variable,
      rgba: { r: value, g: value, b: value, a: 1 },
    });
    expect(
      getDefaultRoles([
        color("base", 0.05),
        color("text", 0.95),
        color("accent-1", 0.5),
        color("brand", 0.6),
      ])
    ).toEqual({
      base: "text",
      text: "base",
      accent1: "accent-1",
      accent2: "brand",
    });
  });

  test("with no variables, the presets take the built-in palette", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    update(() => presetButton(host, "wash-light")?.click());
    expect(applyPreset).toHaveBeenLastCalledWith(
      presetById("wash-light").build(builtInPalette)
    );
  });

  test("with variables, the presets take them in their default roles", () => {
    project({ styles: rootVariables });
    selectInstance(sectionSelector);
    const host = render();
    const colors = new Map(
      listRootColorVariables(buildSectionStyleModel([globalRoot])).map(
        (color) => [color.variable, color]
      )
    );
    const palette: Palette = {
      base: colors.get("paper")!,
      accent1: colors.get("brand")!,
      accent2: colors.get("sky")!,
      text: colors.get("ink")!,
    };
    update(() => presetButton(host, "bloom-light")?.click());
    expect(applyPreset).toHaveBeenLastCalledWith(
      presetById("bloom-light").build(palette)
    );
    // the light scrim is tuned for the text role
    chooseImage(host, "image-scrim-light");
    expect(applyPreset).toHaveBeenLastCalledWith(
      presetById("image-scrim-light").build(palette, { imageAssetId: "photo" })
    );
  });
});

describe("contrast line", () => {
  test("no line when all text passes", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(contrastLine(host)).toBeNull();
  });

  test("no line when there is no text", () => {
    project({ children: [el("box", "Box")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(contrastLine(host)).toBeNull();
  });

  test("no line when some text can't be checked", () => {
    project({
      styles: [
        style("text", "color", "#000000"),
        style("section", "opacity", "0.5"),
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    expect(contrastLine(host)).toBeNull();
  });

  test("no line while the check is pending", () => {
    project({ styles: [style("text", "color", "#aaaaaa")] });
    selectInstance(sectionSelector);
    const host = render({ flush: false });
    expect(host.querySelector("[data-preset-grid]")).not.toBeNull();
    expect(host.textContent).toBe("");
    flushContrastRun();
    expect(contrastLine(host)?.textContent).toBe("Text below AA contrast");
  });

  test("one line when some text fails", () => {
    project({
      children: [
        el("grey", "Text", ["Grey"]),
        el("light", "Text", ["Light"]),
        el("dark", "Text", ["Dark"]),
      ],
      styles: [
        style("grey", "color", "#aaaaaa"),
        style("light", "color", "#bbbbbb"),
        style("dark", "color", "#333333"),
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    expect(host.textContent).toBe("Text below AA contrast");
    expect(host.querySelectorAll("[data-contrast-line]")).toHaveLength(1);
  });

  test("updates after a style change", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(contrastLine(host)).toBeNull();
    update(() => setLocalStyle("text", "color", "#aaaaaa"));
    expect(contrastLine(host)?.textContent).toBe("Text below AA contrast");
  });

  test("updates after an instance is removed", () => {
    project({ styles: [style("text", "color", "#aaaaaa")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(contrastLine(host)?.textContent).toBe("Text below AA contrast");
    update(() => {
      const instances = new Map($instances.get());
      instances.delete("text");
      instances.set("section", {
        ...instances.get("section")!,
        children: [],
      });
      $instances.set(instances);
    });
    expect(contrastLine(host)).toBeNull();
  });
});
