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
  $selectedInstanceSelector,
  $selectedPageId,
  $selectedStyleSources,
  $selectedStyleState,
  selectInstance,
} from "~/shared/nano-states";
import { $instances, $pages, $styles } from "~/shared/sync/data-stores";
import { applyPreset } from "./backgrounds/apply-preset";
import { builtInPalette, presets, type Palette } from "./backgrounds/presets";
import {
  buildSectionStyleModel,
  listRootColorVariables,
} from "./backgrounds/style-model";
import {
  el,
  localId,
  registerTestMetas,
  root as globalRoot,
  setupProject,
  toStyleValue,
  type Node,
  type TestStyle,
} from "./backgrounds/test-fixtures";
import { getDefaultRoles, SectionBackground } from "./section-background";

vi.mock("./backgrounds/apply-preset", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./backgrounds/apply-preset")>();
  return { ...actual, applyPreset: vi.fn(actual.applyPreset) };
});

// The image picker's asset list, as one button that chooses the asset "photo".
vi.mock("~/builder/shared/asset-manager", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/builder/shared/asset-manager")>()),
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
// which jsdom, without requestIdleCallback, takes through setTimeout, and the
// image picker opens a frame after its click (the design system's Dialog):
// both helpers flush them after their change.
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
  host.querySelector<HTMLButtonElement>("[data-contrast-line]");

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
    expect(applyPreset).toHaveBeenCalledWith(
      presetById("image-scrim-dark").build(builtInPalette, {
        imageAssetId: "photo",
      })
    );
    // the picker closed
    expect(document.querySelector("[data-choose-asset]")).toBeNull();
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
    expect(contrastLine(host)?.textContent).toBe("1 below AA contrast");
  });

  test("one line with the count of failing text", () => {
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
    expect(host.textContent).toBe("2 below AA contrast");
  });

  test("clicking selects the first failing text, then the next, cycling", () => {
    project({
      children: [el("grey", "Text", ["Grey"]), el("light", "Text", ["Light"])],
      styles: [
        style("grey", "color", "#aaaaaa"),
        style("light", "color", "#bbbbbb"),
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    // failures come lowest ratio first: #bbbbbb, then #aaaaaa
    update(() => contrastLine(host)?.click());
    expect($selectedInstanceSelector.get()).toEqual([
      "light",
      "section",
      "body",
    ]);
    update(() => contrastLine(host)?.click());
    expect($selectedInstanceSelector.get()).toEqual([
      "grey",
      "section",
      "body",
    ]);
    update(() => contrastLine(host)?.click());
    expect($selectedInstanceSelector.get()).toEqual([
      "light",
      "section",
      "body",
    ]);
  });

  test("updates after a style change", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(contrastLine(host)).toBeNull();
    update(() => setLocalStyle("text", "color", "#aaaaaa"));
    expect(contrastLine(host)?.textContent).toBe("1 below AA contrast");
  });

  test("updates after an instance is removed", () => {
    project({ styles: [style("text", "color", "#aaaaaa")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(contrastLine(host)?.textContent).toBe("1 below AA contrast");
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
