/// <reference path="../animate/timelines.d.ts" />
import { useEffect, useState, type RefObject } from "react";
import {
  findScrollContainer,
  noteMessages,
  type NoteReason,
} from "../animate/use-animate";
import type { Motion } from "./shape";

/** The property every arm group's `rotate` reads (convergence-field.tsx). */
export const settleProperty = "--os-field-settle";

/** Turned 45 degrees off before the section enters, in place at 0. */
export const settleKeyframes: Keyframe[] = [
  { [settleProperty]: 1 },
  { [settleProperty]: 0 },
];

export const settleTiming = {
  rangeStart: "entry 0%",
  rangeEnd: "entry 80%",
  easing: "ease-out",
  // holds 1 before the section enters and 0, the static field, after
  fill: "both",
} as const satisfies KeyframeAnimationOptions;

type SettleReason = Extract<
  NoteReason,
  "overflow" | "unsupported" | "rejected"
>;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

// A browser without matchMedia has no reduced-motion preference to honor.
const getReducedMotion = (): MediaQueryList | undefined =>
  typeof window.matchMedia === "function"
    ? window.matchMedia(reducedMotionQuery)
    : undefined;

// Read from the window: jsdom has no `CSS` at all, and a browser before
// registered properties has no `CSS.registerProperty`.
const getCss = (): typeof CSS | undefined =>
  (window as { CSS?: typeof CSS }).CSS;

const isSupported = () =>
  typeof window.ViewTimeline === "function" &&
  typeof getCss()?.registerProperty === "function" &&
  typeof Element.prototype.animate === "function";

/**
 * Registers the settle property in this document. A second registration in
 * the same document throws InvalidModificationError, which means it is
 * registered: remembered by the document itself, since a module flag cannot
 * tell the builder's document from the canvas's. Any other error leaves it
 * unregistered, and the settle does not play.
 */
const registerSettleProperty = (): boolean => {
  try {
    getCss()!.registerProperty({
      name: settleProperty,
      syntax: "<number>",
      inherits: true,
      initialValue: "0",
    });
    return true;
  } catch (error) {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "InvalidModificationError"
    );
  }
};

/**
 * The settle (spec 4.2, 10.5): after mount, with Motion Settle, animates the
 * field's `svg` from `--os-field-settle: 1` to 0 on a view timeline of the
 * root, so the two arm groups turn 45 degrees into place as the section
 * enters the viewport. Returns the canvas notes for what does not play.
 *
 * Nothing attaches under `prefers-reduced-motion: reduce` (the animation is
 * cancelled when it starts matching, and nothing restarts on its own), in a
 * browser without view timelines or registered properties, when the root
 * sits inside a scroll container other than the page (part A's rule), or
 * while `canPlay` is false. The animation is cancelled on unmount and when
 * Motion changes; cancelled, the property is back at 0 and the field is the
 * static field.
 */
export const useSettle = ({
  svgRef,
  rootRef,
  motion,
  canPlay,
}: {
  svgRef: RefObject<Element | null>;
  rootRef: RefObject<Element | null>;
  motion: Motion;
  canPlay: boolean;
}): readonly string[] => {
  const [notes, setNotes] = useState<readonly string[]>([]);

  useEffect(() => {
    const svg = svgRef.current;
    const root = rootRef.current;
    const reasons = new Set<SettleReason>();
    let animation: Animation | undefined;
    const reducedMotion = getReducedMotion();

    if (motion === "Settle" && svg !== null && root !== null) {
      const rootScroller =
        document.scrollingElement ?? document.documentElement;
      if (isSupported() === false) {
        reasons.add("unsupported");
      } else if (findScrollContainer(root, "block") !== rootScroller) {
        reasons.add("overflow");
      } else if (canPlay && reducedMotion?.matches !== true) {
        if (registerSettleProperty() === false) {
          reasons.add("unsupported");
        } else {
          try {
            animation = svg.animate(settleKeyframes, {
              ...settleTiming,
              timeline: new window.ViewTimeline!({ subject: root }),
            });
          } catch {
            reasons.add("rejected");
          }
        }
      }
    }

    const cancel = () => {
      // never throws, even for an element no longer in the document
      animation?.cancel();
      animation = undefined;
    };
    const onReducedMotionChange = () => {
      if (reducedMotion?.matches) {
        cancel();
      }
    };
    if (animation !== undefined) {
      reducedMotion?.addEventListener?.("change", onReducedMotionChange);
    }

    const next = (Object.keys(noteMessages) as NoteReason[])
      .filter((reason) => reasons.has(reason as SettleReason))
      .map((reason) => noteMessages[reason]);
    // the same notes keep the same array, so nothing re-renders
    setNotes((previous) =>
      previous.join("\n") === next.join("\n") ? previous : next
    );

    return () => {
      reducedMotion?.removeEventListener?.("change", onReducedMotionChange);
      cancel();
    };
  }, [svgRef, rootRef, motion, canPlay]);

  return notes;
};
