import type {
  AnimationAction,
  InsetUnitValue,
  RangeUnitValue,
} from "@webstudio-is/sdk";
import { toCss, toKeyframeProperty, type KeyframeValue } from "./to-css";

type Axis = NonNullable<AnimationAction["axis"]>;

/** The timeline a play runs on, built by `useAnimate` per target. */
export type TimelineSpec =
  | {
      kind: "scroll";
      source: "root" | "nearest" | "closest";
      axis: Axis;
    }
  | {
      kind: "view";
      axis: Axis;
      /** `view-timeline-inset`: "<start> <end>", `auto` when not set */
      inset: string;
    };

/** WAAPI timing for a play: no duration or delay on a scroll timeline. */
export type PlayOptions = {
  easing?: string;
  fill?: FillMode;
  iterations?: number;
  rangeStart?: string;
  rangeEnd?: string;
};

/** One `target.animate(keyframes, options)` call, on its timeline. */
export type Play = {
  targetIndex: number;
  animationIndex: number;
  timeline: TimelineSpec;
  keyframes: Keyframe[];
  options: PlayOptions;
};

/**
 * Why an action, or one of its animations, does not play (spec 4.7):
 * a `subject` other than the target itself, an `enabled` list, a range or
 * inset given as a variable, or a keyframe value the serializer cannot write.
 */
export type PlanSkipReason =
  | "subject"
  | "enabled"
  | "var-range"
  | "unconvertible";

export type PlanSkip = {
  reason: PlanSkipReason;
  /** absent when the whole action is skipped */
  animationIndex?: number;
};

export type Plan = { plays: Play[]; skipped: PlanSkip[] };

const maxStagger = 20;

/**
 * The Stagger prop, percent of the entry range between one child and the
 * next. The runtime holds it to 0..20, since the prop can be bound to an
 * expression: anything that is not a finite number is 0 (off).
 */
export const clampStagger = (stagger: unknown): number => {
  if (stagger === undefined || stagger === null || stagger === "") {
    return 0;
  }
  const value = Number(stagger);
  if (Number.isFinite(value) === false || value <= 0) {
    return 0;
  }
  return Math.min(maxStagger, value);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Whether a value has the shape of upstream's `animationAction` well enough
 * to read: a bound prop can hold anything, and the published page has no
 * schema to parse it with.
 */
const isAction = (action: unknown): action is AnimationAction =>
  isObject(action) &&
  (action.type === "scroll" || action.type === "view") &&
  Array.isArray(action.animations);

/** The action's "Run on canvas" switch. */
export const isPinned = (action: unknown): boolean =>
  isObject(action) && action.isPinned === true;

/** A range offset as a CSS string; undefined for a variable. */
const toOffset = (value: RangeUnitValue): string | undefined => {
  if (isObject(value) === false) {
    return;
  }
  if (value.type === "unit" && typeof value.value === "number") {
    return `${value.value}${value.unit}`;
  }
  if (value.type === "unparsed" && typeof value.value === "string") {
    return value.value;
  }
  return;
};

const toInset = (value: InsetUnitValue | undefined): string | undefined => {
  if (value === undefined || value.type === "keyword") {
    return "auto";
  }
  return toOffset(value);
};

const fills = new Set<string>(["none", "forwards", "backwards", "both"]);

type Range = [name: string, value: RangeUnitValue];

const isRange = (range: unknown): range is Range =>
  Array.isArray(range) && typeof range[0] === "string";

/**
 * A range as WAAPI's `rangeStart` or `rangeEnd` string. View ranges are
 * "<name> <offset>"; a scroll timeline has no named ranges, so `start` is the
 * offset and `end` is measured back from 100%.
 */
const toRange = (
  kind: TimelineSpec["kind"],
  range: Range
): string | undefined => {
  const offset = toOffset(range[1]);
  if (offset === undefined) {
    return;
  }
  if (kind === "view") {
    return `${range[0]} ${offset}`;
  }
  return range[0] === "end" ? `calc(100% - ${offset})` : offset;
};

const toKeyframes = (keyframes: unknown): Keyframe[] | undefined => {
  if (Array.isArray(keyframes) === false) {
    return;
  }
  const result: Keyframe[] = [];
  for (const keyframe of keyframes) {
    if (isObject(keyframe) === false || isObject(keyframe.styles) === false) {
      return;
    }
    const converted: Keyframe = {};
    if (typeof keyframe.offset === "number") {
      converted.offset = keyframe.offset;
    }
    for (const [property, value] of Object.entries(keyframe.styles)) {
      const css = toCss(value as KeyframeValue);
      if (css === undefined) {
        return;
      }
      converted[toKeyframeProperty(property)] = css;
    }
    result.push(converted);
  }
  return result;
};

/** Floors to a thousandth, so a staggered range never shrinks by rounding. */
const floorOffset = (value: number) => Math.floor(value * 1000) / 1000;

/**
 * The staggered `rangeStart` of each target (spec 4.2, 14.3), or undefined
 * when stagger does not apply: it needs a view action, two or more targets,
 * and both offsets percentages in the same named range. Each target starts
 * `step` later than the one before, with `step = min(s, 0.5 * w / (n - 1))`,
 * and keeps the range's end: every target finishes where the unstaggered
 * animation finishes, and the last keeps at least half the range.
 */
const staggerStarts = (
  kind: TimelineSpec["kind"],
  rangeStart: unknown,
  rangeEnd: unknown,
  targetCount: number,
  stagger: number
): string[] | undefined => {
  if (
    kind !== "view" ||
    stagger <= 0 ||
    targetCount < 2 ||
    isRange(rangeStart) === false ||
    isRange(rangeEnd) === false
  ) {
    return;
  }
  const [name, start] = rangeStart;
  const [endName, end] = rangeEnd;
  if (
    name !== endName ||
    start?.type !== "unit" ||
    start.unit !== "%" ||
    end?.type !== "unit" ||
    end.unit !== "%"
  ) {
    return;
  }
  const width = end.value - start.value;
  if (width <= 0) {
    return;
  }
  const step = Math.min(stagger, (0.5 * width) / (targetCount - 1));
  return Array.from(
    { length: targetCount },
    (_, index) => `${name} ${start.value + floorOffset(step * index)}%`
  );
};

/**
 * What playing an `animationAction` on `targetCount` targets means in WAAPI
 * terms (spec 4.2): one play per target and animation, with its timeline,
 * its keyframes and its timing, and what does not play and why (spec 4.7).
 * Pure: it reads no DOM, so `useAnimate` does the rest.
 */
export const planAction = ({
  action,
  targetCount,
  stagger,
}: {
  action: unknown;
  targetCount: number;
  stagger?: unknown;
}): Plan => {
  const plan: Plan = { plays: [], skipped: [] };
  if (isAction(action) === false) {
    return plan;
  }
  const axis: Axis = action.axis ?? "block";
  let timeline: TimelineSpec;
  if (action.type === "view") {
    if (action.subject !== undefined) {
      plan.skipped.push({ reason: "subject" });
      return plan;
    }
    const insetStart = toInset(action.insetStart);
    const insetEnd = toInset(action.insetEnd);
    if (insetStart === undefined || insetEnd === undefined) {
      plan.skipped.push({ reason: "var-range" });
      return plan;
    }
    timeline = { kind: "view", axis, inset: `${insetStart} ${insetEnd}` };
  } else {
    timeline = { kind: "scroll", source: action.source ?? "nearest", axis };
  }
  const steps = clampStagger(stagger);

  action.animations.forEach((animation: unknown, animationIndex) => {
    if (isObject(animation) === false) {
      plan.skipped.push({ reason: "unconvertible", animationIndex });
      return;
    }
    if (animation.enabled !== undefined) {
      plan.skipped.push({ reason: "enabled", animationIndex });
      return;
    }
    const timing = isObject(animation.timing) ? animation.timing : {};
    const options: PlayOptions = {};
    if (typeof timing.easing === "string") {
      options.easing = timing.easing;
    }
    if (typeof timing.fill === "string" && fills.has(timing.fill)) {
      options.fill = timing.fill as FillMode;
    }
    if (timing.iterations === "infinite") {
      options.iterations = Infinity;
    } else if (typeof timing.iterations === "number") {
      options.iterations = timing.iterations;
    }
    for (const key of ["rangeStart", "rangeEnd"] as const) {
      const range = timing[key];
      if (range === undefined) {
        continue;
      }
      const css = isRange(range) ? toRange(timeline.kind, range) : undefined;
      if (css === undefined) {
        plan.skipped.push({ reason: "var-range", animationIndex });
        return;
      }
      options[key] = css;
    }
    const keyframes = toKeyframes(animation.keyframes);
    if (keyframes === undefined) {
      plan.skipped.push({ reason: "unconvertible", animationIndex });
      return;
    }
    const starts = staggerStarts(
      timeline.kind,
      timing.rangeStart,
      timing.rangeEnd,
      targetCount,
      steps
    );
    for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
      plan.plays.push({
        targetIndex,
        animationIndex,
        timeline,
        // shared between plays: Element.animate copies what it is given
        keyframes,
        options:
          starts === undefined
            ? options
            : { ...options, rangeStart: starts[targetIndex] },
      });
    }
  });

  return plan;
};
