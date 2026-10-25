import { enableMapSet } from "immer";
import { beforeEach, describe, expect, test } from "vitest";
import type { CssProperty, StyleValue } from "@webstudio-is/css-engine";
import { camelCaseProperty } from "@webstudio-is/css-data";
import {
  getStyleDeclKey,
  type Breakpoint,
  type StyleDecl,
  type StyleSource,
} from "@webstudio-is/sdk";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
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
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  getComputedStyleDecl,
  type StyleObjectModel,
} from "~/shared/style-object-model";
import { repeatedProperties } from "~/builder/features/style-panel/sections/backgrounds/background-thumbnail";
import { applyPreset, describeBackgroundOrigin } from "./apply-preset";
import {
  builtInPalette,
  layerProperties,
  presets,
  type PresetId,
} from "./presets";

enableMapSet();
registerContainers();

const backgroundProperties: CssProperty[] = [
  "background-color",
  ...layerProperties,
];

const buildPreset = (id: PresetId) =>
  presets.find((preset) => preset.id === id)!.build(builtInPalette);

const base: Breakpoint = { id: "base", label: "Base" };
const tablet: Breakpoint = { id: "tablet", label: "Tablet", maxWidth: 991 };

const decl = (
  styleSourceId: string,
  property: CssProperty,
  value: StyleValue,
  extra: Partial<StyleDecl> = {}
): StyleDecl => ({
  breakpointId: "base",
  styleSourceId,
  property: camelCaseProperty(property),
  value,
  ...extra,
});

const layers = (...value: StyleValue[]) =>
  ({ type: "layers", value }) as StyleValue;
const keyword = (value: string): StyleValue => ({ type: "keyword", value });

const setup = ({
  styleSources = [],
  selection = [],
  selected,
  styles = [],
  breakpointId = "base",
}: {
  styleSources?: StyleSource[];
  selection?: string[];
  selected?: string;
  styles?: StyleDecl[];
  breakpointId?: string;
} = {}) => {
  $instances.set(
    new Map([
      [
        "body",
        {
          type: "instance",
          id: "body",
          component: "Body",
          children: [{ type: "id", value: "box" }],
        },
      ],
      ["box", { type: "instance", id: "box", component: "Box", children: [] }],
    ])
  );
  $selectedPageId.set("");
  selectInstance(["box", "body"]);
  $breakpoints.set(
    new Map([
      [base.id, base],
      [tablet.id, tablet],
    ])
  );
  $selectedBreakpointId.set(breakpointId);
  $styleSources.set(new Map(styleSources.map((source) => [source.id, source])));
  $styleSourceSelections.set(
    selection.length === 0
      ? new Map()
      : new Map([["box", { instanceId: "box", values: selection }]])
  );
  $selectedStyleSources.set(
    selected === undefined ? new Map() : new Map([["box", selected]])
  );
  $selectedStyleState.set(undefined);
  $styles.set(new Map(styles.map((item) => [getStyleDeclKey(item), item])));
};

const model = (matchingBreakpoints = ["base"]): StyleObjectModel => ({
  styles: $styles.get(),
  styleSourceSelections: $styleSourceSelections.get(),
  presetStyles: new Map(),
  instanceTags: new Map(),
  instanceComponents: new Map(),
  matchingBreakpoints,
  matchingStates: new Set(),
});

const computed = (property: CssProperty, matchingBreakpoints?: string[]) =>
  getComputedStyleDecl({
    model: model(matchingBreakpoints),
    instanceSelector: ["box", "body"],
    property,
  });

const selectedLocalId = () => {
  const id = $selectedStyleSources.get().get("box");
  expect($styleSources.get().get(id!)).toEqual({ type: "local", id });
  return id!;
};

const declsOf = (styleSourceId: string) =>
  Array.from($styles.get().values()).filter(
    (item) => item.styleSourceId === styleSourceId
  );

const snapshot = () => JSON.stringify(Array.from($styles.get().entries()));

const token: StyleSource = { type: "token", id: "token", name: "OS Card" };
const tokenStyles = [
  decl("token", "background-color", keyword("red")),
  decl(
    "token",
    "background-image",
    layers({ type: "unparsed", value: "linear-gradient(red, blue)" })
  ),
  decl("token", "background-blend-mode", layers(keyword("multiply"))),
  decl("token", "color", keyword("white")),
];

describe("applyPreset", () => {
  beforeEach(() => {
    setup();
  });

  test("the layer lists are exactly upstream's repeatedProperties", () => {
    expect([...layerProperties].sort()).toEqual([...repeatedProperties].sort());
  });

  test("with no prior styles, creates the local source, selects it and persists the same id", () => {
    const styles = buildPreset("bloom-light");
    applyPreset(styles);
    const localId = selectedLocalId();
    expect($styleSourceSelections.get().get("box")).toEqual({
      instanceId: "box",
      values: [localId],
    });
    const written = declsOf(localId);
    expect(written.length).toBe(styles.length);
    expect($styles.get().size).toBe(styles.length);
    for (const { property, value } of styles) {
      expect(
        $styles.get().get(
          getStyleDeclKey({
            styleSourceId: localId,
            breakpointId: "base",
            property: camelCaseProperty(property),
          })
        )?.value
      ).toEqual(value);
    }
    expect(
      written.some((item) => (item.property as string) === "backgroundPosition")
    ).toBe(false);
  });

  test("every layer list reads back as layers of equal length", () => {
    applyPreset(buildPreset("bloom-strong"));
    for (const property of layerProperties) {
      const { computedValue } = computed(property);
      expect(computedValue.type).toBe("layers");
      expect(
        computedValue.type === "layers" && computedValue.value.length
      ).toBe(4);
    }
  });

  test("a token's one-layer blend list does not cascade into the preset's layers", () => {
    setup({
      styleSources: [token],
      selection: ["token"],
      selected: "token",
      styles: tokenStyles,
    });
    applyPreset(buildPreset("bloom-light"));
    const localId = selectedLocalId();
    for (const property of layerProperties) {
      const local = $styles.get().get(
        getStyleDeclKey({
          styleSourceId: localId,
          breakpointId: "base",
          property: camelCaseProperty(property),
        })
      );
      expect(local?.value.type === "layers" && local.value.value.length).toBe(
        4
      );
    }
    expect(computed("background-blend-mode").computedValue).toEqual(
      layers(
        keyword("normal"),
        keyword("normal"),
        keyword("normal"),
        keyword("normal")
      )
    );
  });

  test("with a token selected, the token is untouched and Local is selected", () => {
    setup({
      styleSources: [token],
      selection: ["token"],
      selected: "token",
      styles: tokenStyles,
    });
    const before = JSON.stringify(declsOf("token"));
    applyPreset(buildPreset("wash-light"));
    expect(JSON.stringify(declsOf("token"))).toBe(before);
    const localId = selectedLocalId();
    expect(localId).not.toBe("token");
    expect($styleSourceSelections.get().get("box")?.values).toEqual([
      "token",
      localId,
    ]);
    expect(declsOf(localId).length).toBe(backgroundProperties.length);
  });

  test("with a locked token selected, the write still lands locally", () => {
    const locked: StyleSource = { ...token, locked: true } as StyleSource;
    setup({
      styleSources: [locked],
      selection: ["token"],
      selected: "token",
      styles: tokenStyles,
    });
    const before = JSON.stringify(declsOf("token"));
    applyPreset(buildPreset("tint-light"));
    expect(JSON.stringify(declsOf("token"))).toBe(before);
    expect(declsOf(selectedLocalId()).length).toBe(backgroundProperties.length);
  });

  test("with :hover selected, the write lands on the base state", () => {
    const local: StyleSource = { type: "local", id: "local" };
    const hover = decl("local", "background-color", keyword("blue"), {
      state: ":hover",
    });
    setup({
      styleSources: [local],
      selection: ["local"],
      selected: "local",
      styles: [hover],
    });
    $selectedStyleState.set(":hover");
    applyPreset(buildPreset("tint-dark"));
    expect($selectedStyleState.get()).toBeUndefined();
    const written = declsOf("local").filter((item) => item !== hover);
    expect(written.length).toBe(backgroundProperties.length);
    expect(written.every((item) => item.state === undefined)).toBe(true);
    expect($styles.get().get(getStyleDeclKey(hover))).toEqual(hover);
  });

  test("replaces earlier background longhands instead of appending to them", () => {
    const local: StyleSource = { type: "local", id: "local" };
    const color = decl("local", "color", keyword("black"));
    setup({
      styleSources: [local],
      selection: ["local"],
      selected: "local",
      styles: [
        decl("local", "background-color", keyword("red")),
        decl(
          "local",
          "background-image",
          layers(
            { type: "unparsed", value: "linear-gradient(red, blue)" },
            { type: "unparsed", value: "linear-gradient(green, blue)" }
          )
        ),
        decl(
          "local",
          "background-position-x",
          layers(
            { type: "unit", unit: "%", value: 10 },
            { type: "unit", unit: "%", value: 20 }
          )
        ),
        decl("local", "background-size", layers(keyword("cover"))),
        color,
      ],
    });
    const styles = buildPreset("wash-dark");
    applyPreset(styles);
    const written = declsOf("local").filter((item) => item !== color);
    expect(
      Object.fromEntries(written.map((item) => [item.property, item.value]))
    ).toEqual(
      Object.fromEntries(
        styles.map(({ property, value }) => [
          camelCaseProperty(property),
          value,
        ])
      )
    );
    expect($styles.get().get(getStyleDeclKey(color))).toEqual(color);
  });

  test("writes at the selected breakpoint", () => {
    const local: StyleSource = { type: "local", id: "local" };
    const baseColor = decl("local", "background-color", keyword("red"));
    setup({
      styleSources: [local],
      selection: ["local"],
      selected: "local",
      styles: [baseColor],
      breakpointId: "tablet",
    });
    applyPreset(buildPreset("bloom-dark"));
    const written = declsOf("local").filter((item) => item !== baseColor);
    expect(written.length).toBe(backgroundProperties.length);
    expect(written.every((item) => item.breakpointId === "tablet")).toBe(true);
    expect($styles.get().get(getStyleDeclKey(baseColor))).toEqual(baseColor);
  });

  test("is one undo step, and undo leaves Local selected", () => {
    setup({
      styleSources: [token],
      selection: ["token"],
      selected: "token",
      styles: tokenStyles,
    });
    const before = snapshot();
    applyPreset(buildPreset("image-scrim-light"));
    const localId = selectedLocalId();
    expect(snapshot()).not.toBe(before);
    serverSyncStore.undo();
    expect(snapshot()).toBe(before);
    expect($selectedStyleSources.get().get("box")).toBe(localId);
  });

  test("does nothing with no selected instance", () => {
    selectInstance(undefined);
    applyPreset(buildPreset("bloom-light"));
    expect($styles.get().size).toBe(0);
    expect($styleSources.get().size).toBe(0);
  });
});

describe("describeBackgroundOrigin", () => {
  const local: StyleSource = { type: "local", id: "local" };

  test("none when the element has no background of its own", () => {
    setup({
      styleSources: [local],
      selection: ["local"],
      styles: [decl("local", "color", keyword("red"))],
    });
    expect(describeBackgroundOrigin(["box", "body"])).toEqual({
      kind: "none",
    });
  });

  test("local when its local source sets one at this breakpoint", () => {
    setup({
      styleSources: [local],
      selection: ["local"],
      styles: [decl("local", "background-color", keyword("red"))],
    });
    expect(describeBackgroundOrigin(["box", "body"])).toEqual({
      kind: "local",
    });
  });

  test("token, named, when a token sets it", () => {
    setup({
      styleSources: [token, local],
      selection: ["token", "local"],
      styles: [
        decl("token", "background-image", layers(keyword("none"))),
        decl("local", "background-color", keyword("red")),
      ],
    });
    expect(describeBackgroundOrigin(["box", "body"])).toEqual({
      kind: "token",
      label: "OS Card",
    });
  });

  test("breakpoint, named, when it comes from another breakpoint", () => {
    setup({
      styleSources: [local],
      selection: ["local"],
      styles: [decl("local", "background-color", keyword("red"))],
      breakpointId: "tablet",
    });
    expect(describeBackgroundOrigin(["box", "body"])).toEqual({
      kind: "breakpoint",
      label: "Base",
    });
  });

  test("a token at another breakpoint is still the token", () => {
    setup({
      styleSources: [token],
      selection: ["token"],
      styles: [decl("token", "background-color", keyword("red"))],
      breakpointId: "tablet",
    });
    expect(describeBackgroundOrigin(["box", "body"])).toEqual({
      kind: "token",
      label: "OS Card",
    });
  });
});
