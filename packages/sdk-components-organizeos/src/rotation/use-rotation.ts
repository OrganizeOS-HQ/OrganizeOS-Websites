import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  checkRotationStructure,
  getOwnTabLists,
  getOwnTabs,
  getSelectedIndex,
} from "./structure";
import { isTrusted } from "./trusted";

/**
 * "playing" and "stopped" show the button with the Pause and the Play label;
 * "off" means rotation will not run, and the button hides.
 */
export type RotationState = "playing" | "stopped" | "off";

const defaultInterval = 5.5;
const minInterval = 3;
const maxInterval = 20;

/**
 * The Interval in seconds (spec 4.3). The runtime clamps it, since the prop
 * can be bound to an expression: finite numbers and numeric strings are held
 * to 3..20, anything else is 5.5.
 */
export const clampInterval = (seconds: unknown): number => {
  if (
    seconds === undefined ||
    seconds === null ||
    (typeof seconds === "string" && seconds.trim() === "")
  ) {
    return defaultInterval;
  }
  const value = Number(seconds);
  if (Number.isFinite(value) === false) {
    return defaultInterval;
  }
  return Math.min(maxInterval, Math.max(minInterval, value));
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

// A browser without matchMedia has no reduced-motion preference to honor.
const getReducedMotion = (): MediaQueryList | undefined =>
  typeof window.matchMedia === "function"
    ? window.matchMedia(reducedMotionQuery)
    : undefined;

// Keys that select a tab in the tab list (Radix's automatic activation).
const selectionKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Enter",
  " ",
]);

const isIndex = (value: string, count: number) =>
  /^(0|[1-9][0-9]*)$/.test(value) && Number(value) < count;

type Pause = "pointer" | "offscreen" | "hidden";

/**
 * The rotation behind Rotating Tabs (spec 4.3, 5.1): a timer that advances
 * the Tabs its button sits in, through the Tabs' bound `value`, and the
 * pause and stop rules around it. The root is the button's parent element.
 *
 * It reads and writes nothing during render, so a server render and the
 * first client render agree: the state starts "off" and becomes "playing"
 * after mount when rotation can run.
 */
export const useRotation = ({
  buttonRef,
  value,
  onValueChange,
  interval,
  enabled,
}: {
  buttonRef: RefObject<HTMLElement | null>;
  value?: string;
  onValueChange?: (value: string) => void;
  interval?: unknown;
  enabled: boolean;
}): { state: RotationState; toggle: () => void } => {
  const [state, setState] = useState<RotationState>("off");

  // The latest props, read when the timer fires rather than captured by it.
  const latest = useRef({ value, onValueChange, interval });
  useEffect(() => {
    latest.current = { value, onValueChange, interval };
  });

  const toggleRef = useRef<() => void>(() => {});

  useEffect(() => {
    const button = buttonRef.current;
    const root = button?.parentElement ?? null;
    if (enabled === false || button === null || root === null) {
      setState("off");
      return;
    }

    let mode: RotationState = "off";
    let timer: ReturnType<typeof setTimeout> | undefined;
    // the index the last advance asked for, verified at the next tick
    let asked: number | undefined;
    const pauses = new Set<Pause>();

    const report = (next: RotationState) => {
      mode = next;
      setState(next);
    };

    const write = (index: number) => {
      latest.current.onValueChange?.(String(index));
    };

    const clearTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    // Starts the timer from zero when rotation plays and nothing pauses it,
    // and clears it otherwise.
    const reconcile = () => {
      if (mode !== "playing" || pauses.size > 0) {
        clearTimer();
        return;
      }
      if (timer === undefined) {
        timer = setTimeout(tick, clampInterval(latest.current.interval) * 1000);
      }
    };

    // Rotation will not run: the button hides. If it had focus, focus goes
    // to the selected tab rather than dropping to the body.
    const turnOff = () => {
      clearTimer();
      const hadFocus = document.activeElement === button;
      report("off");
      if (hadFocus) {
        const tabs = getOwnTabs(root);
        const selected = tabs[getSelectedIndex(tabs)];
        if (selected instanceof HTMLElement) {
          selected.focus();
        }
      }
    };

    // The variable follows the selection the visitor made, so the next
    // advance is a change Tabs follows (spec 4.3, keeping the variable in
    // step). Returns false, writing nothing, when no tab is selected or the
    // bound value is not a tab's index: then the triggers have values of
    // their own, and a write by index would select no tab at all.
    const sync = () => {
      const tabs = getOwnTabs(root);
      const index = getSelectedIndex(tabs);
      const current = latest.current.value;
      if (
        index < 0 ||
        (current !== undefined &&
          isIndex(String(current), tabs.length) === false)
      ) {
        return false;
      }
      if (String(index) !== String(current)) {
        write(index);
      }
      asked = undefined;
      return true;
    };

    const canRun = () =>
      checkRotationStructure(root, button) && getOwnTabs(root).length >= 2;

    const tick = () => {
      timer = undefined;
      if (mode !== "playing" || pauses.size > 0) {
        return;
      }
      if (canRun() === false) {
        turnOff();
        return;
      }
      const tabs = getOwnTabs(root);
      const index = getSelectedIndex(tabs);
      // The previous advance has landed by now, or it never will: the
      // triggers' values are not their indexes.
      if (index < 0 || (asked !== undefined && index !== asked)) {
        turnOff();
        return;
      }
      asked = (index + 1) % tabs.length;
      write(asked);
      reconcile();
    };

    const stop = () => {
      if (mode !== "playing") {
        return;
      }
      clearTimer();
      report("stopped");
    };

    const setPause = (pause: Pause, on: boolean) => {
      if (on) {
        pauses.add(pause);
      } else {
        pauses.delete(pause);
      }
      reconcile();
    };

    toggleRef.current = () => {
      if (mode === "playing") {
        stop();
      } else if (mode === "stopped") {
        if (sync() === false) {
          turnOff();
          return;
        }
        report("playing");
        reconcile();
      }
    };

    // The stop listeners run before Radix's handlers (React delegates at its
    // container, outside the root), so the DOM still shows the old
    // selection: they only stop, and read no selection. Play reads it later,
    // when the visitor presses the button.
    const onPointerEnter = () => setPause("pointer", true);
    const onPointerLeave = () => setPause("pointer", false);
    const onVisibilityChange = () =>
      setPause("hidden", document.visibilityState === "hidden");
    const onFocusIn = (event: FocusEvent) => {
      if (isTrusted(event) && event.target !== button) {
        stop();
      }
    };
    const isOwnTab = (target: EventTarget | null) => {
      const tab =
        target instanceof Element ? target.closest('[role="tab"]') : null;
      return tab !== null && getOwnTabs(root).includes(tab);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isTrusted(event) && isOwnTab(event.target)) {
        stop();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        isTrusted(event) &&
        selectionKeys.has(event.key) &&
        event.target instanceof Node &&
        getOwnTabLists(root).some((list) => list.contains(event.target as Node))
      ) {
        stop();
      }
    };

    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // A browser without IntersectionObserver never pauses off screen.
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[entries.length - 1];
              if (entry !== undefined) {
                setPause("offscreen", entry.isIntersecting === false);
              }
            },
            { threshold: 0 }
          )
        : undefined;
    observer?.observe(root);

    const reducedMotion = getReducedMotion();
    const onReducedMotionChange = () => {
      if (reducedMotion?.matches && mode !== "off") {
        turnOff();
      }
    };
    reducedMotion?.addEventListener?.("change", onReducedMotionChange);

    if (document.visibilityState === "hidden") {
      pauses.add("hidden");
    }

    if (reducedMotion?.matches || canRun() === false || sync() === false) {
      report("off");
    } else {
      report("playing");
      reconcile();
    }

    return () => {
      clearTimer();
      mode = "off";
      toggleRef.current = () => {};
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      observer?.disconnect();
      reducedMotion?.removeEventListener?.("change", onReducedMotionChange);
    };
  }, [enabled, buttonRef]);

  const toggle = useCallback(() => toggleRef.current(), []);

  return { state, toggle };
};
