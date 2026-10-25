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
import { builtInPalette, presets } from "./backgrounds/presets";
import {
  el,
  localId,
  registerTestMetas,
  root as globalRoot,
  setupProject,
  toStyleValue,
  type Node,
  type TestStyle,
  type TestToken,
} from "./backgrounds/test-fixtures";
import { getDefaultRoles, SectionBackground } from "./section-background";

vi.mock("./backgrounds/apply-preset", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./backgrounds/apply-preset")>();
  return { ...actual, applyPreset: vi.fn(actual.applyPreset) };
});

enableMapSet();
registerContainers();

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

// body > section > text
const sectionSelector = ["section", "body"];

const project = ({
  children = [el("text", "Text", ["Hello"])],
  styles = [],
  tokens = [],
}: {
  children?: Node[];
  styles?: TestStyle[];
  tokens?: TestToken[];
} = {}) => {
  setupProject({
    tree: el("body", "Body", [el("section", "Box", children)]),
    styles,
    tokens,
  });
  const pages = createDefaultPages({ rootInstanceId: "body" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
};

const render = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(TooltipProvider, null, createElement(SectionBackground))
    );
  });
  return container;
};

const update = (change: () => void) => {
  act(change);
};

const summary = (host: HTMLElement) =>
  host.querySelector("[data-contrast-summary]")?.textContent;

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

beforeEach(() => {
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
});

const selectPrompt = "Select a section to give it a background.";

describe("SectionBackground states", () => {
  test("with no selection it asks for a section", () => {
    project();
    const host = render();
    expect(host.textContent).toContain(selectPrompt);
    expect(host.querySelector("[data-preset-grid]")).toBeNull();
  });

  test("the Body and Global Root ask for a section too", () => {
    project();
    selectInstance(["body"]);
    const host = render();
    expect(host.textContent).toContain(selectPrompt);
    update(() => selectInstance([ROOT_INSTANCE_ID]));
    expect(host.textContent).toContain(selectPrompt);
  });

  test("a selected element shows the presets, the colors and the report", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(host.textContent).not.toContain(selectPrompt);
    expect(host.querySelectorAll("[data-preset]")).toHaveLength(presets.length);
    expect(summary(host)).toBe("All text passes AA");
  });

  test("a section with no text says so", () => {
    project({ children: [el("box", "Box")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(summary(host)).toBe("No text to check in this section.");
  });
});

describe("color row", () => {
  test("with no variables, the built-in palette and the hint", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    expect(host.querySelector("[data-palette-hint]")?.textContent).toBe(
      "Define color variables in Global Root to use your own palette."
    );
    expect(host.querySelector("[data-color-row]")).toBeNull();
  });

  test("with variables, four selects and no hint", () => {
    project({
      styles: [
        style(globalRoot, "--paper", "#fafafa"),
        style(globalRoot, "--brand", "#0a7c8c"),
        style(globalRoot, "--ink", "#202020"),
        style(globalRoot, "--sky", "#3fc9e0"),
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    expect(host.querySelector("[data-palette-hint]")).toBeNull();
    const row = host.querySelector("[data-color-row]");
    expect(row?.textContent).toContain("Base");
    expect(row?.textContent).toContain("Accent 1");
    expect(row?.textContent).toContain("Accent 2");
    expect(row?.textContent).toContain("Text");
    expect(row?.textContent).toContain("--paper");
    expect(row?.textContent).toContain("--ink");
  });

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

  test("the re-apply note is shown", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    expect(host.textContent).toContain(
      "Changing a variable later updates the base color. Re-apply the preset to update its tints."
    );
  });
});

describe("origin notice", () => {
  test("a token's background is named before writing", () => {
    project({
      tokens: [{ id: "card", name: "OS Card", on: ["section"] }],
      styles: [
        {
          on: "section",
          token: "card",
          property: "background-color",
          value: "#eeeeee",
        },
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    expect(host.querySelector("[data-origin-notice]")?.textContent).toBe(
      "This element's background comes from the token OS Card. The preset is applied as a local style and overrides it here."
    );
  });

  test("no notice when the element has no background", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    expect(host.querySelector("[data-origin-notice]")).toBeNull();
  });
});

describe("scrim presets", () => {
  test("show the text color each scrim was tuned for", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    expect(
      host.querySelector('[data-scrim-reference="image-scrim-light"]')
        ?.textContent
    ).toContain("tuned for text #111111");
    expect(
      host.querySelector('[data-scrim-reference="image-scrim-dark"]')
        ?.textContent
    ).toContain("tuned for text #FFFFFF");
  });

  test("the light scrim is tuned for the palette's text color", () => {
    project({
      styles: [
        style(globalRoot, "--paper", "#ffffff"),
        style(globalRoot, "--ink", "#1a2b3c"),
        style(globalRoot, "--brand", "#0a7c8c"),
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    expect(
      host.querySelector('[data-scrim-reference="image-scrim-light"]')
        ?.textContent
    ).toContain("tuned for text #1A2B3C");
  });

  test("need an image before they apply", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    const button = host.querySelector<HTMLButtonElement>(
      '[data-preset="image-scrim-light"]'
    );
    expect(button?.disabled).toBe(true);
  });
});

describe("applying a preset", () => {
  test("clicking a preset calls applyPreset with its styles", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    const host = render();
    const button = host.querySelector<HTMLButtonElement>(
      '[data-preset="bloom-light"]'
    );
    update(() => button?.click());
    expect(applyPreset).toHaveBeenCalledTimes(1);
    expect(applyPreset).toHaveBeenCalledWith(
      presets
        .find((preset) => preset.id === "bloom-light")!
        .build(builtInPalette, { imageAssetId: undefined })
    );
    // written locally, and the report still reads it
    const local = $selectedStyleSources.get().get("section");
    expect(
      Array.from($styles.get().values()).some(
        (decl) =>
          decl.styleSourceId === local && decl.property === "backgroundImage"
      )
    ).toBe(true);
    expect(summary(host)).toBe("All text passes AA");
  });
});

describe("contrast report", () => {
  test("clicking a group selects its instance", () => {
    project({ styles: [style("text", "color", "#aaaaaa")] });
    selectInstance(sectionSelector);
    const host = render();
    const group = host.querySelector<HTMLButtonElement>('[data-group="text"]');
    expect(group?.textContent).toContain("Fail");
    update(() => group?.click());
    expect($selectedInstanceSelector.get()).toEqual([
      "text",
      "section",
      "body",
    ]);
  });

  test("updates after a style change", () => {
    project({ styles: [style("text", "color", "#333333")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(summary(host)).toBe("All text passes AA");
    update(() => setLocalStyle("text", "color", "#aaaaaa"));
    expect(summary(host)).toBe("1 text style fails AA");
  });

  test("updates after an instance is removed", () => {
    project({ styles: [style("text", "color", "#aaaaaa")] });
    selectInstance(sectionSelector);
    const host = render();
    expect(summary(host)).toBe("1 text style fails AA");
    update(() => {
      const instances = new Map($instances.get());
      instances.delete("text");
      instances.set("section", {
        ...instances.get("section")!,
        children: [],
      });
      $instances.set(instances);
    });
    expect(summary(host)).toBe("No text to check in this section.");
  });

  test("a failure on a gradient is labelled the lowest point", () => {
    project({
      styles: [
        style("text", "color", "#000000"),
        style(
          "section",
          "background-image",
          "linear-gradient(90deg, #ff0000 0%, #3399ff 100%)"
        ),
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    expect(host.querySelector('[data-group="text"]')?.textContent).toContain(
      "Lowest point of the background"
    );
  });

  test("a group that can't be checked gives the reason", () => {
    project({
      styles: [
        style("text", "color", "#000000"),
        style("section", "opacity", "0.5"),
      ],
    });
    selectInstance(sectionSelector);
    const host = render();
    expect(summary(host)).toBe("Some text could not be checked");
    expect(host.querySelector('[data-group="text"]')?.textContent).toContain(
      "Can't check: the text or an element behind it is transparent"
    );
  });

  test("the help text says what the check does not see", () => {
    project();
    selectInstance(sectionSelector);
    const host = render();
    const report = host.querySelector("[data-contrast-report]")?.textContent;
    expect(report).toContain("text positioned outside this element");
    expect(report).toContain("text away from the background's lowest point");
    expect(report).toContain("text inside an embed");
  });
});
