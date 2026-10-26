import { useEffect, useRef, type RefObject } from "react";
import { getOwnPanels } from "./structure";

const defaultFade = 250;
const maxFade = 600;

/**
 * The Fade in milliseconds (spec 3.1, 12.5). The runtime clamps it, since the
 * prop can be bound to an expression: finite numbers and numeric strings are
 * held to 0..600, anything else is 250. 0 turns the fade off.
 */
export const clampFade = (ms: unknown): number => {
  if (
    ms === undefined ||
    ms === null ||
    (typeof ms === "string" && ms.trim() === "")
  ) {
    return defaultFade;
  }
  const value = Number(ms);
  if (Number.isFinite(value) === false) {
    return defaultFade;
  }
  return Math.min(maxFade, Math.max(0, value));
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

// A browser without matchMedia has no reduced-motion preference to honor.
const getReducedMotion = (): MediaQueryList | undefined =>
  typeof window.matchMedia === "function"
    ? window.matchMedia(reducedMotionQuery)
    : undefined;

/**
 * The cross-fade of Rotating Tabs (spec 3.2, 12.9): while enabled, when one
 * of the root's own panels turns `data-state="active"`, it animates
 * `opacity: 0 → 1` over `fade` ms on the document timeline. The root is the
 * button's parent element, as for `useRotation`.
 *
 * A trigger's flip, or a flip in a Tabs nested in a panel, animates nothing.
 * The panels are collected again when the root's children change. A running
 * fade is cancelled when another starts, on unmount and when reduced motion
 * starts matching; `fill: "none"` leaves no style behind, so a panel is fully
 * visible at rest. Off when `enabled` is false (the control is "off" until
 * after mount, so nothing fades on the first render), when `fade` is 0, under
 * reduced motion, and in an engine without `element.animate`.
 */
export const useFade = ({
  buttonRef,
  enabled,
  fade,
}: {
  buttonRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  fade: unknown;
}) => {
  const duration = clampFade(fade);
  // read when a fade starts, so a new Fade keeps the observer
  const latest = useRef(duration);
  useEffect(() => {
    latest.current = duration;
  });
  const off = duration === 0;
  useEffect(() => {
    const root = buttonRef.current?.parentElement ?? null;
    if (
      enabled === false ||
      off ||
      root === null ||
      typeof root.animate !== "function" ||
      typeof MutationObserver !== "function"
    ) {
      return;
    }
    const reducedMotion = getReducedMotion();
    let panels = new Set(getOwnPanels(root));
    let running: Animation | undefined;

    const cancel = () => {
      running?.cancel();
      running = undefined;
    };

    const play = (panel: HTMLElement) => {
      cancel();
      if (reducedMotion?.matches) {
        return;
      }
      try {
        running = panel.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: latest.current,
          easing: "ease-out",
          fill: "none",
        });
      } catch {
        // an engine that rejects it switches instantly, as without a fade
        running = undefined;
      }
    };

    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) {
        panels = new Set(getOwnPanels(root));
      }
      let activated: HTMLElement | undefined;
      for (const record of records) {
        const target = record.target;
        if (
          record.type === "attributes" &&
          target instanceof HTMLElement &&
          panels.has(target) &&
          record.oldValue !== "active" &&
          target.getAttribute("data-state") === "active"
        ) {
          activated = target;
        }
      }
      if (activated !== undefined) {
        play(activated);
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["data-state"],
    });

    const onReducedMotionChange = () => {
      if (reducedMotion?.matches) {
        cancel();
      }
    };
    reducedMotion?.addEventListener?.("change", onReducedMotionChange);

    return () => {
      observer.disconnect();
      reducedMotion?.removeEventListener?.("change", onReducedMotionChange);
      cancel();
    };
  }, [buttonRef, enabled, off]);
};
