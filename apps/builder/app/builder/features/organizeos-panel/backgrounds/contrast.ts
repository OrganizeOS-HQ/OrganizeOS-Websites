import type { CssProperty, StyleValue } from "@webstudio-is/css-engine";
import { parseCssValue } from "@webstudio-is/css-data";
import {
  descendantComponent,
  ROOT_INSTANCE_ID,
  type Instance,
} from "@webstudio-is/sdk";
import { showAttribute } from "@webstudio-is/react-sdk";
import { $propsIndex } from "~/shared/nano-states";
import { $instances } from "~/shared/sync/data-stores";
import {
  getComputedStyleDecl,
  type StyleObjectModel,
} from "~/shared/style-object-model";
import type { InstanceSelector } from "~/shared/instance-utils/tree";
import { parseAnyGradient } from "~/builder/features/style-panel/sections/backgrounds/gradient-utils";
import {
  composite,
  contrastRatio,
  interpolate,
  luminance,
  quantize,
  toRgba,
  type Rgba,
} from "./color";
import {
  buildSectionStyleModel,
  resolveFontSize,
  resolveFontWeight,
  withRoot,
} from "./style-model";

/**
 * The contrast check for the Section background area (spec 4.1-4.5): the
 * text groups inside the selected element and the lowest WCAG 2.x ratio each
 * gets on its background, at the current breakpoint, base state.
 *
 * It reads every value through `getComputedStyleDecl` over the model from
 * `style-model.ts` and keeps no cascade of its own. It never reports Pass for
 * something it could not compute: unknown values, an image with no layer
 * above it, blending, filters, opacity, interpolation methods and color
 * hints are "Can't check" with the reason.
 */

const organizeos = (name: string) => `@organizeos/site-components:${name}`;

/**
 * Components that render text with no `text` or `expression` child, by
 * registered name: placeholders and values, a formatted date, and the
 * OrganizeOS parts that render the platform's labels and messages.
 */
export const namedTextComponents = new Set([
  "Time",
  "Input",
  "Textarea",
  "Select",
  organizeos("Guests"),
  organizeos("ShiftOptions"),
  organizeos("Questions"),
  organizeos("FieldInput"),
  organizeos("FieldMessage"),
  organizeos("RotationControl"),
]);

/**
 * OrganizeOS parts in the named set whose `ws:descendant` children (the
 * styling hooks for their inner labels and messages) are each a text group
 * of their own, since their color can differ from the part's.
 */
const partsWithDescendantGroups = new Set(
  Array.from(namedTextComponents).filter((name) =>
    name.startsWith(organizeos(""))
  )
);

/** OrganizeOS components that render no text of their own. */
export const rendersNoOwnText = new Set([
  organizeos("SignupForm"),
  organizeos("RsvpForm"),
  organizeos("Field"),
  organizeos("FieldLabel"),
]);

/**
 * OrganizeOS components that render only the designer's children, which the
 * direct-text rule covers.
 */
export const rendersDesignerChildrenOnly = new Set([
  organizeos("SubmitButton"),
  organizeos("EmailConsent"),
]);

/** Above this many background colors after any layer, the check gives up. */
export const maxBackgroundColors = 10_000;

/** Interior samples per gradient segment, besides its two ends. */
const interiorSamples = 8;

export type ContrastResult = "pass" | "fail" | "cant-check";

export type ContrastGroup = {
  /** the text color; undefined when it can't be read */
  color?: Rgba;
  /** resolved px; undefined when not resolved (held to 4.5:1) */
  fontSize?: number;
  fontWeight?: number;
  large: boolean;
  /** the lowest ratio across the background; absent for "cant-check" */
  ratio?: number;
  /**
   * True when the background stack that gave the lowest ratio has a
   * gradient layer, so a failure is at the gradient's worst point, which may
   * not be where the text sits ("Lowest point of the background").
   */
  gradient?: boolean;
  threshold: 3 | 4.5;
  result: ContrastResult;
  /** why the group could not be checked */
  reason?: string;
  /** the instance with the group's lowest ratio, to select */
  sampleInstanceId: Instance["id"];
  /** its selector, ready for `selectInstance` (no Global Root) */
  sampleInstanceSelector: InstanceSelector;
};

export type ContrastReport = {
  /**
   * fail: some group fails; partial: none fails, some can't be checked;
   * pass: every group passes; none: the section has no text to check.
   */
  summary: "pass" | "fail" | "partial" | "none";
  groups: ContrastGroup[];
};

const white: Rgba = { r: 1, g: 1, b: 1, a: 1 };
const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };

class CantCheck extends Error {}

const cantCheck = (reason: string): never => {
  throw new CantCheck(reason);
};

/** A layer in the background stack, bottom to top. */
type StackLayer =
  | { type: "colors"; colors: Rgba[]; gradient?: boolean }
  | { type: "image" };

const keywordOf = (value: StyleValue) =>
  value.type === "keyword" ? value.value.toLowerCase() : undefined;

const listItems = (value: StyleValue): StyleValue[] =>
  value.type === "layers" || value.type === "tuple" ? value.value : [value];

// `in <color-space>` and the hue interpolation keywords, which upstream's
// parsers do not reject reliably
const interpolationMethodPattern = /(?:^|[\s,(])in\s+[a-z]/i;
const hueKeywordPattern = /\b(?:longer|shorter|increasing|decreasing)\s+hue\b/i;
const gradientPattern =
  /^\s*(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;
const imagePattern = /^\s*(?:url|image-set|-webkit-image-set|image)\(/i;

/** The colors a gradient can paint, each segment sampled (spec 4.3). */
const sampleGradient = (text: string, currentColor: Rgba | undefined) => {
  if (interpolationMethodPattern.test(text) || hueKeywordPattern.test(text)) {
    return cantCheck("a gradient uses an interpolation method");
  }
  const parsed = parseAnyGradient(text);
  if (parsed === undefined) {
    return cantCheck("a background gradient can't be read");
  }
  if (
    (parsed.type === "radial" && parsed.size?.includes(" in ")) ||
    (parsed.type === "conic" && parsed.position?.includes(" in "))
  ) {
    return cantCheck("a gradient uses an interpolation method");
  }
  const stops: Rgba[] = [];
  for (const stop of parsed.stops) {
    if (stop.hint !== undefined || stop.color === undefined) {
      return cantCheck("a gradient uses a color hint");
    }
    const rgba = toRgba(stop.color, currentColor);
    if (rgba === undefined) {
      return cantCheck("a gradient color can't be read");
    }
    stops.push(rgba);
  }
  if (stops.length < 2) {
    return stops;
  }
  const samples: Rgba[] = [];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const segments = interiorSamples + 1;
    for (let step = 0; step <= segments; step += 1) {
      samples.push(
        interpolate(stops[index], stops[index + 1], step / segments)
      );
    }
  }
  return samples;
};

type Checker = ReturnType<typeof createChecker>;

const createChecker = (model: StyleObjectModel) => {
  const cache = new Map<string, unknown>();
  const memo = <T>(key: string, compute: () => T): T => {
    if (cache.has(key) === false) {
      try {
        cache.set(key, { value: compute() });
      } catch (error) {
        if (error instanceof CantCheck) {
          cache.set(key, { error });
        } else {
          throw error;
        }
      }
    }
    const entry = cache.get(key) as { value: T } | { error: CantCheck };
    if ("error" in entry) {
      throw entry.error;
    }
    return entry.value;
  };

  const decl = (selector: InstanceSelector, property: CssProperty) =>
    getComputedStyleDecl({ model, instanceSelector: selector, property });

  /** The instance's resolved `color`, for `currentcolor` in its layers. */
  const currentColorOf = (selector: InstanceSelector) =>
    memo(`color:${selector.join(",")}`, () =>
      toRgba(decl(selector, "color").usedValue)
    );

  const backgroundColorOf = (selector: InstanceSelector) =>
    memo(`bg:${selector.join(",")}`, () => {
      const rgba = toRgba(
        decl(selector, "background-color").usedValue,
        currentColorOf(selector)
      );
      return rgba ?? cantCheck("a background color can't be read");
    });

  /** The background-image items that paint something, as listed. */
  const imageItemsOf = (selector: InstanceSelector) =>
    memo(`images:${selector.join(",")}`, () => {
      let value = decl(selector, "background-image").usedValue;
      if (value.type === "unparsed") {
        value = parseCssValue("background-image", value.value);
      }
      if (value.type === "keyword" && keywordOf(value) === "none") {
        return [];
      }
      if (value.type !== "layers") {
        return cantCheck("a background image can't be read");
      }
      return value.value.filter(
        (item) =>
          keywordOf(item) !== "none" &&
          (item.type !== "unparsed" || item.value.trim() !== "none")
      );
    });

  /** Whether a descendant hides what is under it, so the walk stops there. */
  const isOpaqueBackground = (selector: InstanceSelector) => {
    const rgba = toRgba(
      decl(selector, "background-color").usedValue,
      currentColorOf(selector)
    );
    if (rgba === undefined || rgba.a < 1) {
      return false;
    }
    try {
      return imageItemsOf(selector).length === 0;
    } catch {
      return false;
    }
  };

  /** One instance's layers, bottom to top (spec 4.3). */
  const layersOf = (selector: InstanceSelector): StackLayer[] =>
    memo(`layers:${selector.join(",")}`, () => {
      const color = backgroundColorOf(selector);
      const items = imageItemsOf(selector);
      if (color.a === 0 && items.length === 0) {
        return [];
      }
      // blending and clipping change what the layers paint
      const blendModes = listItems(
        decl(selector, "background-blend-mode").usedValue
      );
      if (blendModes.some((item) => keywordOf(item) !== "normal")) {
        return cantCheck("a background blend mode is set");
      }
      const clips = listItems(decl(selector, "background-clip").usedValue);
      if (clips.some((item) => keywordOf(item) === undefined)) {
        return cantCheck("a background clip can't be read");
      }
      if (clips.some((item) => keywordOf(item) === "text")) {
        return cantCheck("a background is clipped to the text");
      }
      const layers: StackLayer[] = [];
      if (color.a > 0) {
        layers.push({ type: "colors", colors: [color] });
      }
      // the last listed image layer is painted lowest
      for (const item of [...items].reverse()) {
        if (item.type === "image") {
          layers.push({ type: "image" });
          continue;
        }
        if (item.type === "unparsed" && imagePattern.test(item.value)) {
          layers.push({ type: "image" });
          continue;
        }
        if (item.type === "unparsed" && gradientPattern.test(item.value)) {
          layers.push({
            type: "colors",
            colors: sampleGradient(item.value, currentColorOf(selector)),
            gradient: true,
          });
          continue;
        }
        return cantCheck("a background layer can't be read");
      }
      return layers;
    });

  /** Opacity, filters and blend modes on one instance (spec 4.3). */
  const checkEffects = (selector: InstanceSelector) =>
    memo(`effects:${selector.join(",")}`, () => {
      const opacity = decl(selector, "opacity").usedValue;
      if (opacity.type !== "unit") {
        return cantCheck("an opacity can't be read");
      }
      const opaque =
        opacity.unit === "%" ? opacity.value >= 100 : opacity.value >= 1;
      if (opaque === false) {
        return cantCheck("the text or an element behind it is transparent");
      }
      if (keywordOf(decl(selector, "filter").usedValue) !== "none") {
        return cantCheck("a filter is set on the text or an element behind it");
      }
      if (keywordOf(decl(selector, "backdrop-filter").usedValue) !== "none") {
        return cantCheck("a backdrop filter is set");
      }
      if (keywordOf(decl(selector, "mix-blend-mode").usedValue) !== "normal") {
        return cantCheck("a blend mode is set");
      }
      return true;
    });

  return {
    decl,
    currentColorOf,
    isOpaqueBackground,
    layersOf,
    checkEffects,
  };
};

/** A background color as painted over a black and a white image beneath. */
type Backdrop = { overBlack: Rgba; overWhite: Rgba };

const backdropKey = ({ overBlack, overWhite }: Backdrop) =>
  `${quantize(overBlack)}/${quantize(overWhite)}`;

/**
 * Composites the stack bottom to top, layer by layer, quantizing and
 * deduplicating after each. Every color is tracked over a black and over a
 * white image, which are the same until an image layer appears; from then on
 * the pair bounds what the image can produce (spec 4.5).
 */
const compositeStack = (layers: StackLayer[]) => {
  let set = new Map<string, Backdrop>([
    ["white", { overBlack: white, overWhite: white }],
  ]);
  let imageBacked = false;
  let layersAboveImage = 0;
  for (const layer of layers) {
    if (layer.type === "image") {
      set = new Map([["image", { overBlack: black, overWhite: white }]]);
      imageBacked = true;
      layersAboveImage = 0;
      continue;
    }
    layersAboveImage += 1;
    const next = new Map<string, Backdrop>();
    for (const backdrop of set.values()) {
      for (const color of layer.colors) {
        const painted = {
          overBlack: composite(color, backdrop.overBlack),
          overWhite: composite(color, backdrop.overWhite),
        };
        const key = backdropKey(painted);
        if (next.has(key) === false) {
          next.set(key, painted);
        }
      }
      if (next.size > maxBackgroundColors) {
        return cantCheck("background too complex");
      }
    }
    set = next;
  }
  if (imageBacked && layersAboveImage === 0) {
    return cantCheck("add a scrim layer above the image");
  }
  return Array.from(set.values());
};

/** The lowest ratio of the text across the backdrops (spec 4.3, 4.5). */
const lowestRatio = (text: Rgba, backdrops: Backdrop[]) => {
  let lowest = Number.POSITIVE_INFINITY;
  for (const { overBlack, overWhite } of backdrops) {
    const imageDependent = quantize(overBlack) !== quantize(overWhite);
    if (imageDependent && text.a < 1) {
      return cantCheck("the text is translucent over an image");
    }
    let ratio: number;
    if (imageDependent) {
      const low = Math.min(luminance(overBlack), luminance(overWhite));
      const high = Math.max(luminance(overBlack), luminance(overWhite));
      const textLuminance = luminance(text);
      ratio =
        textLuminance >= low && textLuminance <= high
          ? // some image color matches the text
            1
          : Math.min(
              contrastRatio(text, overBlack),
              contrastRatio(text, overWhite)
            );
    } else {
      ratio = contrastRatio(composite(text, overWhite), overWhite);
    }
    lowest = Math.min(lowest, ratio);
  }
  return lowest;
};

type TextTarget = {
  instanceId: Instance["id"];
  /** with the Global Root */
  selector: InstanceSelector;
};

const isHidden = (instanceId: Instance["id"]) =>
  ($propsIndex.get().propsByInstanceId.get(instanceId) ?? []).some(
    (prop) =>
      prop.name === showAttribute &&
      prop.type === "boolean" &&
      prop.value === false
  );

const hasDirectText = (instance: Instance) =>
  instance.children.some(
    (child) =>
      child.type === "expression" ||
      (child.type === "text" && child.value.trim() !== "")
  );

/**
 * The text-bearing instances under the section (spec 4.2): a direct `text`
 * or `expression` child, the named set, and the `ws:descendant` children of
 * the OrganizeOS parts in it. Skips `data-ws-show` false and `display: none`,
 * and stops at a descendant with an opaque background color and no image.
 */
const collectTextTargets = (
  checker: Checker,
  sectionSelector: InstanceSelector
): TextTarget[] => {
  const instances = $instances.get();
  const targets: TextTarget[] = [];
  const visit = (selector: InstanceSelector, isSection: boolean) => {
    const [instanceId] = selector;
    const instance = instances.get(instanceId);
    if (instance === undefined || isHidden(instanceId)) {
      return;
    }
    if (keywordOf(checker.decl(selector, "display").usedValue) === "none") {
      return;
    }
    if (isSection === false && checker.isOpaqueBackground(selector)) {
      return;
    }
    if (
      hasDirectText(instance) ||
      namedTextComponents.has(instance.component)
    ) {
      targets.push({ instanceId, selector });
    }
    const groupDescendants = partsWithDescendantGroups.has(instance.component);
    for (const child of instance.children) {
      if (child.type !== "id" || selector.includes(child.value)) {
        continue;
      }
      const childSelector = [child.value, ...selector];
      if (instances.get(child.value)?.component === descendantComponent) {
        if (
          groupDescendants &&
          keywordOf(checker.decl(childSelector, "display").usedValue) !== "none"
        ) {
          targets.push({ instanceId: child.value, selector: childSelector });
        }
        continue;
      }
      visit(childSelector, false);
    }
  };
  visit(withRoot(sectionSelector), true);
  return targets;
};

type TargetResult = Omit<
  ContrastGroup,
  "sampleInstanceId" | "sampleInstanceSelector"
>;

const checkTarget = (
  checker: Checker,
  model: StyleObjectModel,
  { selector }: TextTarget
): TargetResult => {
  const fontSize = resolveFontSize(model, selector);
  const fontWeight = resolveFontWeight(model, selector);
  const large =
    fontSize !== undefined &&
    (fontSize >= 24 ||
      (fontSize >= 18.66 && fontWeight !== undefined && fontWeight >= 700));
  const threshold = large ? 3 : 4.5;
  const color = checker.currentColorOf(selector);
  const base = { color, fontSize, fontWeight, large, threshold } as const;
  try {
    if (color === undefined) {
      return cantCheck("the text color can't be read");
    }
    // from the text up to the backdrop, the text included
    for (let index = 0; index < selector.length; index += 1) {
      checker.checkEffects(selector.slice(index));
    }
    // from the Global Root and the Body down to the text
    const layers: StackLayer[] = [];
    for (let index = selector.length - 1; index >= 0; index -= 1) {
      layers.push(...checker.layersOf(selector.slice(index)));
    }
    const ratio = lowestRatio(color, compositeStack(layers));
    const gradient = layers.some(
      (layer) => layer.type === "colors" && layer.gradient === true
    );
    return {
      ...base,
      ratio,
      gradient,
      result: ratio >= threshold ? "pass" : "fail",
    };
  } catch (error) {
    if (error instanceof CantCheck) {
      return { ...base, result: "cant-check", reason: error.message };
    }
    throw error;
  }
};

const resultOrder: Record<ContrastResult, number> = {
  fail: 0,
  "cant-check": 1,
  pass: 2,
};

/**
 * Checks the text inside the section at `sectionSelector` (the selected
 * instance's selector, with or without the Global Root) against its
 * background, at the current breakpoint, base state. Groups key on the
 * quantized text color, size, weight and outcome, each with its lowest
 * ratio; failures first.
 */
export const checkSectionContrast = (
  sectionSelector: InstanceSelector
): ContrastReport => {
  const selector = sectionSelector.filter((id) => id !== ROOT_INSTANCE_ID);
  if (selector.length === 0) {
    return { summary: "none", groups: [] };
  }
  const model = buildSectionStyleModel(selector);
  const checker = createChecker(model);
  const groups = new Map<string, ContrastGroup>();
  for (const target of collectTextTargets(checker, selector)) {
    const result = checkTarget(checker, model, target);
    const key = [
      result.color === undefined ? "unknown" : quantize(result.color),
      result.fontSize ?? "",
      result.fontWeight ?? "",
      result.result,
      result.reason ?? "",
    ].join("|");
    const existing = groups.get(key);
    if (
      existing === undefined ||
      (result.ratio !== undefined &&
        (existing.ratio === undefined || result.ratio < existing.ratio))
    ) {
      groups.set(key, {
        ...result,
        sampleInstanceId: target.instanceId,
        sampleInstanceSelector: target.selector.filter(
          (id) => id !== ROOT_INSTANCE_ID
        ),
      });
    }
  }
  const list = Array.from(groups.values()).sort(
    (a, b) =>
      resultOrder[a.result] - resultOrder[b.result] ||
      (a.ratio ?? 0) - (b.ratio ?? 0)
  );
  const summary: ContrastReport["summary"] =
    list.length === 0
      ? "none"
      : list.some((group) => group.result === "fail")
        ? "fail"
        : list.some((group) => group.result === "cant-check")
          ? "partial"
          : "pass";
  return { summary, groups: list };
};
