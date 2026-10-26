/// <reference path="./timelines.d.ts" />
import { useEffect, useState, type RefObject } from "react";
import {
  planAction,
  type PlanSkipReason,
  type TimelineSpec,
} from "./play-action";

/**
 * Why something does not play: the plan's reasons (spec 4.7), a target
 * inside a scroll container other than the page (14.2), a browser without
 * scroll and view timelines, and a value the engine rejected.
 */
export type NoteReason =
  | PlanSkipReason
  | "overflow"
  | "unsupported"
  | "rejected";

/** The canvas notes, in the order they are shown. */
export const noteMessages: Record<NoteReason, string> = {
  unsupported:
    "This browser does not support scroll-driven motion; preview in Chrome or Safari.",
  subject:
    "An animation whose subject is another element does not play yet; leave the subject unset.",
  enabled:
    "An animation turned off at some breakpoints does not play yet; turn it on at every breakpoint.",
  "var-range":
    "A range or inset set to a variable does not play; give it a value.",
  unconvertible:
    "A keyframe value this player cannot write (a transform, filter, shadow, image or a color outside sRGB) does not play.",
  overflow:
    "Motion plays against the page's scroll; this element sits inside an element whose overflow is hidden, auto or scroll. Use overflow: clip.",
  rejected:
    "The browser rejected an animation's values, so that animation does not play.",
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

// A browser without matchMedia has no reduced-motion preference to honor.
const getReducedMotion = (): MediaQueryList | undefined =>
  typeof window.matchMedia === "function"
    ? window.matchMedia(reducedMotionQuery)
    : undefined;

/** The package's canvas-check boxes are builder chrome, never targets. */
const isCanvasBox = (element: Element) =>
  element.hasAttribute("data-organizeos-canvas-check") ||
  element.hasAttribute("data-organizeos-canvas-note");

/** The element children of the root a player animates (spec 4.1). */
export const getTargets = (root: Element): Element[] =>
  Array.from(root.children).filter((child) => isCanvasBox(child) === false);

type Axis = TimelineSpec["axis"];

const getRootScroller = (): Element =>
  document.scrollingElement ?? document.documentElement;

const getOverflow = (element: Element, axis: Axis) => {
  const style = getComputedStyle(element);
  const longhand = style.getPropertyValue(
    axis === "x" || axis === "inline" ? "overflow-x" : "overflow-y"
  );
  return longhand === "" ? style.getPropertyValue("overflow") : longhand;
};

const isScrollContainer = (element: Element, axis: Axis) => {
  const overflow = getOverflow(element, axis).trim();
  return overflow !== "" && overflow !== "visible" && overflow !== "clip";
};

/**
 * The target's nearest scroll container in the axis, as CSS defines it: an
 * ancestor whose overflow on that axis is not `visible` or `clip`. The body
 * counts as the viewport while the root element's overflow on that axis is
 * `visible`, since its overflow then propagates to the viewport. With no
 * container, the page's own scroller.
 */
export const findScrollContainer = (target: Element, axis: Axis): Element => {
  const rootScroller = getRootScroller();
  const html = document.documentElement;
  for (
    let element = target.parentElement;
    element !== null;
    element = element.parentElement
  ) {
    if (element === html || element === rootScroller) {
      return rootScroller;
    }
    if (element === document.body && isScrollContainer(html, axis) === false) {
      return rootScroller;
    }
    if (isScrollContainer(element, axis)) {
      return element;
    }
  }
  return rootScroller;
};

const timelineClass = (kind: TimelineSpec["kind"]) =>
  kind === "view" ? window.ViewTimeline : window.ScrollTimeline;

/**
 * A stable serialization of what the player plays, so a rebuild follows a
 * change of value rather than a new object of the same value.
 */
const serialize = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "object" && item !== null && Array.isArray(item) === false
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1))
        )
      : item
  ) ?? "";

/**
 * The scroll-driven player (spec 4.2): after mount, plays `action` on each
 * element child of the root with native scroll and view timelines, and
 * returns the canvas notes for what does not play.
 *
 * Nothing attaches under `prefers-reduced-motion: reduce` (animations are
 * cancelled when it starts matching, and nothing restarts on its own), in a
 * browser without the timeline the action needs, or while `canPlay` is
 * false. Each `animate` call is isolated, so one rejected value never stops
 * the others. Animations are cancelled on unmount and rebuilt when the
 * action or stagger changes. Nothing is written to the elements: cancelling
 * restores the page exactly.
 */
export const useAnimate = ({
  rootRef,
  action,
  stagger,
  canPlay,
}: {
  rootRef: RefObject<Element | null>;
  action: unknown;
  stagger: unknown;
  canPlay: boolean;
}): readonly string[] => {
  const [notes, setNotes] = useState<readonly string[]>([]);
  const key = serialize({ action, stagger });

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    // read back from the key: the effect follows the value it was keyed on
    const played = JSON.parse(key) as { action?: unknown; stagger?: unknown };
    const targets = getTargets(root);
    const plan = planAction({
      action: played.action,
      targetCount: targets.length,
      stagger: played.stagger,
    });
    const reasons = new Set<NoteReason>(
      plan.skipped.map((skip) => skip.reason)
    );
    const reducedMotion = getReducedMotion();
    const attach = canPlay && reducedMotion?.matches !== true;
    const animations: Animation[] = [];
    const timelines = new Map<number, AnimationTimeline | undefined>();
    const rootScroller = getRootScroller();

    // The timeline of one target, or undefined when it cannot play.
    const getTimeline = (targetIndex: number, spec: TimelineSpec) => {
      if (timelines.has(targetIndex)) {
        return timelines.get(targetIndex);
      }
      const target = targets[targetIndex];
      let timeline: AnimationTimeline | undefined;
      if (spec.kind === "view") {
        if (findScrollContainer(target, spec.axis) !== rootScroller) {
          reasons.add("overflow");
        } else if (attach) {
          timeline = new window.ViewTimeline!({
            subject: target,
            axis: spec.axis,
            inset: spec.inset,
          });
        }
      } else if (attach) {
        timeline = new window.ScrollTimeline!({
          source:
            spec.source === "root"
              ? rootScroller
              : findScrollContainer(target, spec.axis),
          axis: spec.axis,
        });
      }
      timelines.set(targetIndex, timeline);
      return timeline;
    };

    for (const play of plan.plays) {
      // checked here, so getTimeline constructs the class unguarded
      if (typeof timelineClass(play.timeline.kind) !== "function") {
        reasons.add("unsupported");
        continue;
      }
      try {
        const timeline = getTimeline(play.targetIndex, play.timeline);
        if (timeline === undefined) {
          continue;
        }
        animations.push(
          targets[play.targetIndex].animate(play.keyframes, {
            ...play.options,
            timeline,
          })
        );
      } catch {
        reasons.add("rejected");
      }
    }

    const cancelAll = () => {
      for (const animation of animations.splice(0)) {
        // never throws, even for an element no longer in the document
        animation.cancel();
      }
    };
    const onReducedMotionChange = () => {
      if (reducedMotion?.matches) {
        cancelAll();
      }
    };
    reducedMotion?.addEventListener?.("change", onReducedMotionChange);

    const next = (Object.keys(noteMessages) as NoteReason[])
      .filter((reason) => reasons.has(reason))
      .map((reason) => noteMessages[reason]);
    // the same notes keep the same array, so nothing re-renders
    setNotes((previous) =>
      previous.join("\n") === next.join("\n") ? previous : next
    );

    return () => {
      reducedMotion?.removeEventListener?.("change", onReducedMotionChange);
      cancelAll();
    };
  }, [rootRef, key, canPlay]);

  return notes;
};
