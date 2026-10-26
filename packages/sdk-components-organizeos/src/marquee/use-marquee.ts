import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { isTrusted } from "../rotation/trusted";
import type { MarqueeParts, MarqueeState } from "./context";
import { checkMarqueeStructure } from "./structure";

const defaultSpeed = 40;
const minSpeed = 10;
const maxSpeed = 200;

/**
 * The Speed in px/s (spec 12.5). The runtime clamps it, since the prop can be
 * bound to an expression: finite numbers and numeric strings are held to
 * 10..200, anything else is 40.
 */
export const clampSpeed = (speed: unknown): number => {
  if (
    speed === undefined ||
    speed === null ||
    (typeof speed === "string" && speed.trim() === "")
  ) {
    return defaultSpeed;
  }
  const value = Number(speed);
  if (Number.isFinite(value) === false) {
    return defaultSpeed;
  }
  return Math.min(maxSpeed, Math.max(minSpeed, value));
};

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

// A browser without matchMedia has no reduced-motion preference to honor.
const getReducedMotion = (): MediaQueryList | undefined =>
  typeof window.matchMedia === "function"
    ? window.matchMedia(reducedMotionQuery)
    : undefined;

// What a visitor can tab to among the items (media is unsupported, spec 12.2)
const focusable =
  "a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[contenteditable=true],[tabindex]:not([tabindex='-1'])";

/** The fractional part, in [0, 1). */
const fraction = (value: number) => {
  const result = value - Math.floor(value);
  return Number.isFinite(result) && result < 1 ? result : 0;
};

/**
 * An element's border-box left at rest, from the root's padding edge: its
 * `offsetLeft` chain up to the root, so a transform (the drift) never counts.
 * An offset parent outside the root is the root's own offset parent too, so
 * the root's offset is taken off.
 */
const restLeft = (element: HTMLElement, root: HTMLElement): number => {
  let left = 0;
  for (let node = element; ; ) {
    left += node.offsetLeft;
    const parent = node.offsetParent;
    if (parent === root) {
      return left;
    }
    if (parent instanceof HTMLElement && root.contains(parent)) {
      left += parent.clientLeft;
      node = parent;
    } else {
      return left - root.offsetLeft - root.clientLeft;
    }
  }
};

/** The root's content box, from its padding edge. */
const contentBox = (root: HTMLElement) => {
  const style = getComputedStyle(root);
  const left = Number.parseFloat(style.paddingLeft) || 0;
  const right = root.clientWidth - (Number.parseFloat(style.paddingRight) || 0);
  return { left, right: Math.max(left, right) };
};

type Pause = "pointer" | "offscreen" | "hidden";

type Direction = "left" | "right";

const toDirection = (direction: unknown): Direction | undefined =>
  direction === "left" || direction === "right" ? direction : undefined;

/**
 * The Marquee's motion (spec 4.2, 12.1-12.5, 12.8): after mount, when motion
 * may run (not on the canvas, no reduced motion, the parts in place, an
 * engine with `element.animate`, and the track's items running past the
 * root's padding edge, where it clips them),
 * it appends one runtime-owned container of clones to the track,
 * `<div aria-hidden="true" inert style="display: contents">`, and drifts the
 * track by one period W in a seamless loop on the document timeline.
 *
 * W is `firstClone.offsetLeft - firstOriginal.offsetLeft`, so the track's gap
 * and the items' margins count; only transform-independent layout is read.
 * Motion pauses while the pointer is over the root, while the root is off
 * screen and while the document is hidden; it stops (until Play) when
 * keyboard focus enters the track, and the focused item is brought inside
 * the root's content box (its padding and the track's offset count). Reduced motion turned on mid-visit, unmount, and a root that
 * widens past its items remove the clones, so the DOM is the server's again.
 *
 * It reads and writes nothing during render: the state starts "off" and
 * becomes "playing" after mount when motion runs.
 */
export const useMarquee = ({
  rootRef,
  parts,
  speed,
  direction,
  enabled,
}: {
  rootRef: RefObject<HTMLElement | null>;
  parts: MarqueeParts;
  speed?: unknown;
  direction?: unknown;
  enabled: boolean;
}): { state: MarqueeState; toggle: () => void } => {
  const [state, setState] = useState<MarqueeState>("off");
  const toggleRef = useRef<() => void>(() => {});
  const pxPerSecond = clampSpeed(speed);
  const askedDirection = toDirection(direction);

  useEffect(() => {
    const root = rootRef.current;
    const [button] = parts.buttons;
    const [track] = parts.tracks;
    if (
      enabled === false ||
      root === null ||
      checkMarqueeStructure(root, parts.buttons, parts.tracks) === false ||
      typeof track.animate !== "function"
    ) {
      setState("off");
      return;
    }
    const reducedMotion = getReducedMotion();
    if (reducedMotion?.matches) {
      setState("off");
      return;
    }

    let mode: MarqueeState = "off";
    // a visitor's stop holds until Play, also across a restart
    let visitorStopped = false;
    // reduced motion turned on: nothing starts again
    let disabled = false;
    const pauses = new Set<Pause>();
    // every container this effect made, current or removed
    const owned = new WeakSet<Node>();
    let container: HTMLElement | undefined;
    let animation: Animation | undefined;
    // signed: positive when the copies follow to the right (left to right)
    let period = 0;
    let duration = 0;
    let reverse = false;
    let tabIndexSet = false;

    const report = (next: MarqueeState) => {
      mode = next;
      setState(next);
    };

    const getOriginals = () =>
      Array.from(track.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && owned.has(child) === false
      );

    // Whether the originals at rest run past the root's padding edge, where
    // it clips them: the root's padding and the track's offset count.
    const overflows = () => {
      const originals = getOriginals();
      if (originals.length === 0) {
        return false;
      }
      const lefts = originals.map((item) => restLeft(item, root));
      const left = Math.min(...lefts);
      const right = Math.max(
        ...originals.map((item, index) => lefts[index] + item.offsetWidth)
      );
      return left < 0 || right > root.clientWidth;
    };

    const buildContainer = () => {
      const next = document.createElement("div");
      next.setAttribute("aria-hidden", "true");
      next.setAttribute("inert", "");
      next.style.display = "contents";
      for (const original of getOriginals()) {
        next.appendChild(original.cloneNode(true));
      }
      for (const element of next.querySelectorAll("[id]")) {
        element.removeAttribute("id");
      }
      owned.add(next);
      return next;
    };

    // The motion and the clones go: the track is the server's again.
    const clear = () => {
      animation?.cancel();
      animation = undefined;
      container?.remove();
      container = undefined;
    };

    // The animation's iteration progress, in [0, 1).
    const getProgress = () =>
      animation === undefined || duration === 0
        ? 0
        : fraction(Number(animation.currentTime ?? 0) / duration);

    const reconcile = () => {
      if (animation === undefined) {
        return;
      }
      if (mode === "playing" && pauses.size === 0) {
        if (animation.playState !== "running") {
          animation.play();
        }
      } else if (animation.playState !== "paused") {
        animation.pause();
      }
    };

    // Clones the items, measures W and plays from `progress`; false, with
    // the clones removed, when it cannot.
    const start = (progress: number) => {
      clear();
      const originals = getOriginals();
      container = buildContainer();
      track.appendChild(container);
      const firstClone = container.firstElementChild;
      period =
        firstClone instanceof HTMLElement && originals[0] !== undefined
          ? firstClone.offsetLeft - originals[0].offsetLeft
          : 0;
      if (period === 0 || Number.isFinite(period) === false) {
        clear();
        return false;
      }
      const natural: Direction = period > 0 ? "left" : "right";
      const asked =
        askedDirection ??
        (getComputedStyle(root).direction === "rtl" ? "right" : "left");
      reverse = asked !== natural;
      duration = (Math.abs(period) / pxPerSecond) * 1000;
      try {
        animation = track.animate(
          [
            { transform: "translateX(0px)" },
            { transform: `translateX(${-period}px)` },
          ],
          {
            duration,
            iterations: Number.POSITIVE_INFINITY,
            easing: "linear",
            direction: reverse ? "reverse" : "normal",
          }
        );
      } catch {
        clear();
        return false;
      }
      animation.currentTime = progress * duration;
      return true;
    };

    // Focus leaves the hidden button for the first focusable item, or the
    // root (spec 12.8).
    const moveFocusFromButton = () => {
      const target = track.querySelector<HTMLElement>(focusable);
      if (target !== null) {
        target.focus();
        return;
      }
      if (root.hasAttribute("tabindex") === false) {
        root.setAttribute("tabindex", "-1");
        tabIndexSet = true;
        root.addEventListener(
          "blur",
          () => {
            if (tabIndexSet) {
              root.removeAttribute("tabindex");
              tabIndexSet = false;
            }
          },
          { once: true }
        );
      }
      root.focus();
    };

    // Motion stops and the clones go: the DOM is the server's again.
    const turnOff = () => {
      clear();
      const hadFocus =
        button !== undefined && document.activeElement === button;
      report("off");
      if (hadFocus) {
        moveFocusFromButton();
      }
    };

    // Starts, stops or re-measures as the items and the root's width allow
    // (spec 12.4). Its own clone step changes no item's box, so the size
    // change it causes is a no-op here.
    const evaluate = () => {
      if (disabled) {
        return;
      }
      const over = overflows();
      if (animation === undefined) {
        if (over && start(0)) {
          report(visitorStopped ? "stopped" : "playing");
          reconcile();
        } else {
          report("off");
        }
        return;
      }
      if (over === false) {
        turnOff();
        return;
      }
      const firstClone = container?.firstElementChild;
      const [first] = getOriginals();
      const measured =
        firstClone instanceof HTMLElement && first !== undefined
          ? firstClone.offsetLeft - first.offsetLeft
          : 0;
      if (measured !== period) {
        restart();
      }
    };

    // The clones again from the current items, the container last, and the
    // animation from its progress (plan amendment 8).
    const restart = () => {
      const progress = getProgress();
      if (start(progress)) {
        reconcile();
      } else {
        turnOff();
      }
    };

    // Brings the focused item inside the root (spec 12.1): the time in one
    // period at which its box lies in the root's content box, nearest the
    // current one.
    const bringIntoView = (target: Node) => {
      if (animation === undefined || duration === 0) {
        return;
      }
      const item = getOriginals().find((original) => original.contains(target));
      if (item === undefined) {
        return;
      }
      const view = contentBox(root);
      const left = restLeft(item, root);
      // the translates that put the item's box inside the view
      const low = view.left - left;
      const high = Math.max(low, view.right - item.offsetWidth - left);
      // the translate is -period * shift, shift in [0, 1)
      const progress = getProgress();
      const shift = reverse ? fraction(1 - progress) : progress;
      const a = -low / period;
      const b = -high / period;
      // the nearest shift in the item's window, kept within one period
      const inWindow = Math.min(
        Math.max(shift, Math.min(a, b)),
        Math.max(a, b)
      );
      const next = Math.min(Math.max(inWindow, 0), 1 - 1e-9);
      if (next === shift) {
        return;
      }
      const nextProgress = reverse ? fraction(1 - next) : next;
      animation.currentTime = nextProgress * duration;
    };

    const stop = () => {
      visitorStopped = true;
      if (mode === "playing") {
        report("stopped");
      }
      reconcile();
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
        visitorStopped = false;
        report("playing");
        reconcile();
      }
    };

    const onPointerEnter = () => setPause("pointer", true);
    const onPointerLeave = () => setPause("pointer", false);
    const onVisibilityChange = () =>
      setPause("hidden", document.visibilityState === "hidden");
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (
        isTrusted(event) &&
        mode !== "off" &&
        target instanceof Node &&
        target !== track &&
        track.contains(target)
      ) {
        stop();
        bringIntoView(target);
      }
    };

    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("focusin", onFocusIn);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // A browser without IntersectionObserver never pauses off screen.
    const intersection =
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
    intersection?.observe(root);

    // A browser without ResizeObserver measures once.
    const resize =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => evaluate())
        : undefined;
    resize?.observe(root);
    resize?.observe(track);

    // A record its own container step caused, or one inside a container.
    const isOwn = (record: MutationRecord) => {
      for (
        let node: Node | null = record.target;
        node !== null;
        node = node.parentNode
      ) {
        if (owned.has(node)) {
          return true;
        }
      }
      if (record.type !== "childList") {
        return false;
      }
      const nodes = [...record.addedNodes, ...record.removedNodes];
      return nodes.length > 0 && nodes.every((node) => owned.has(node));
    };
    const mutations =
      typeof MutationObserver === "function"
        ? new MutationObserver((records) => {
            if (disabled || records.every(isOwn)) {
              return;
            }
            if (animation === undefined) {
              evaluate();
            } else if (overflows()) {
              restart();
            } else {
              turnOff();
            }
          })
        : undefined;
    mutations?.observe(track, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    const onReducedMotionChange = () => {
      if (reducedMotion?.matches) {
        disabled = true;
        if (mode !== "off" || animation !== undefined) {
          turnOff();
        }
      }
    };
    reducedMotion?.addEventListener?.("change", onReducedMotionChange);

    if (document.visibilityState === "hidden") {
      pauses.add("hidden");
    }
    evaluate();

    return () => {
      disabled = true;
      toggleRef.current = () => {};
      clear();
      mode = "off";
      if (tabIndexSet) {
        root.removeAttribute("tabindex");
      }
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      intersection?.disconnect();
      resize?.disconnect();
      mutations?.disconnect();
      reducedMotion?.removeEventListener?.("change", onReducedMotionChange);
    };
  }, [enabled, rootRef, parts, pxPerSecond, askedDirection]);

  const toggle = useCallback(() => toggleRef.current(), []);

  return { state, toggle };
};
