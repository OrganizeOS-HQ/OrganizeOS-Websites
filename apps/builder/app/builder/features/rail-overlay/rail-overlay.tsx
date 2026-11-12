import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import { cssVar } from "@webstudio-is/design-system";
import { $isPreviewMode } from "~/shared/nano-states";
import { suppressCommandsForEvent } from "~/shared/commands-emitter";
import {
  $activeSidebarPanel,
  $isUiHidden,
  setActiveSidebarPanel,
} from "~/builder/shared/nano-states";
import {
  POTENTIAL,
  useExternalDragStateEffect,
} from "~/builder/shared/assets/drag-monitor";
import { SidebarButton } from "~/builder/sidebar-left/sidebar-tabs";

/**
 * The rail-overlay host: a screen opened by a button on the left rail that
 * covers everything right of the rail (the top bar, the sidebar panel, the
 * canvas and the inspector), shared by the CMS and Variables. One is open at
 * a time. Close means hide: the overlay stays mounted while it is available,
 * with `display: none`.
 */

export type RailOverlayName = "cms" | "variables";

/** The open rail overlay, if any. */
export const $openRailOverlay = atom<RailOverlayName | undefined>(undefined);

/** The left rail, whose right edge the overlays start at. */
const $rail = atom<HTMLElement | null>(null);

/** A stable ref callback for the rail's element (sidebar-left.tsx). */
export const registerRail = (element: HTMLElement | null) => {
  $rail.set(element);
};

/**
 * Opening closes the sidebar panel first, as another rail tab replaces the
 * open one, so the panel listener never sees an open overlay mid-way. From
 * another panel, closing opens the undocked navigator, so it takes up to two
 * calls.
 */
export const openRailOverlay = (name: RailOverlayName) => {
  for (
    let call = 0;
    call < 2 && $activeSidebarPanel.get() !== "none";
    call += 1
  ) {
    setActiveSidebarPanel("none");
  }
  $openRailOverlay.set(name);
};

/**
 * Hide the open overlay, or only `name` when given. Returns whether it hid
 * one.
 */
export const hideRailOverlay = (name?: RailOverlayName): boolean => {
  const open = $openRailOverlay.get();
  if (open === undefined || (name !== undefined && open !== name)) {
    return false;
  }
  $openRailOverlay.set(undefined);
  return true;
};

export const toggleRailOverlay = (name: RailOverlayName) => {
  if (hideRailOverlay(name) === false) {
    openRailOverlay(name);
  }
};

/**
 * An input, a textarea, a select, a colour input, or an element inside a
 * contenteditable region.
 */
export const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (["input", "textarea", "select", "color-input"].includes(
    target.tagName.toLowerCase()
  ) ||
    target.isContentEditable);

/** Whether `name` shows: open, available, and the rail is there. */
export const useIsRailOverlayShown = (
  name: RailOverlayName,
  isAvailable: boolean
) => {
  const open = useStore($openRailOverlay);
  const isPreviewMode = useStore($isPreviewMode);
  const isUiHidden = useStore($isUiHidden);
  return (
    open === name &&
    isAvailable &&
    isPreviewMode === false &&
    isUiHidden === false
  );
};

/**
 * The rail's right and bottom edges in the viewport, measured while the
 * overlay shows. Below the rail the builder's footer spans the full width,
 * so the overlay also covers that corner.
 */
const useRailBox = (rail: HTMLElement | null, isShown: boolean) => {
  const [box, setBox] = useState({ right: 0, bottom: 0 });
  useLayoutEffect(() => {
    if (rail === null || isShown === false) {
      return;
    }
    const update = () => {
      const { right, bottom } = rail.getBoundingClientRect();
      setBox((current) =>
        current.right === right && current.bottom === bottom
          ? current
          : { right, bottom }
      );
    };
    update();
    window.addEventListener("resize", update);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(rail);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [rail, isShown]);
  return box;
};

/**
 * Where the builder's clipboard listeners leave an event to the field (its
 * `isTextEditing`): an input, a textarea, or inside a contenteditable region.
 * Narrower than `isEditableTarget`: a colour input's field is in its shadow
 * root, so at the window its event's target is the `<color-input>` host,
 * which the builder would take for the canvas.
 */
const isTextFieldTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement &&
    target.closest("[contenteditable]") !== null);

/**
 * While an overlay shows, a clipboard event outside a text field stops at the
 * window, before the builder's document listeners; a text field's is
 * untouched.
 */
const onOverlayClipboard = (event: ClipboardEvent) => {
  if (isTextFieldTarget(event.target) === false) {
    event.stopPropagation();
  }
};

const clipboardEventTypes = ["copy", "cut", "paste"] as const;

/**
 * A press on the top bar (the builder's main menu sits in its corner beside
 * the overlay) hides the overlay, as another rail tab does.
 */
const onOverlayPointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (target.closest("[data-rail-overlay], [data-rail-button]")) {
    return;
  }
  if (target.closest("nav")) {
    hideRailOverlay();
  }
};

/**
 * The overlay, rendered once by its feature and portalled to the document's
 * body. `children` render inside it whether it shows or not; a feature that
 * wants them only while open renders them conditionally.
 *
 * It takes no z-index. As a later body child than the builder root, whose
 * `Main` and `SidePanel` isolate their stacking and whose top bar has a
 * z-index only while the UI is hidden, it paints over them. Design-system
 * popups portal to the body later still and paint over it; toasts keep
 * `zIndices.max`.
 *
 * While it shows, every key is kept from the builder's commands in the
 * capture phase on the document (the canvas is covered), except
 * `allowCommands`. Escape hides it only in the bubble phase on the document,
 * when no layer took it (a design-system layer that dismisses calls
 * `preventDefault`), not in an editable element, and when `onEscape` (the
 * overlay's own state, such as a select mode) does not take it. Focus goes to its root on
 * open, and back to its rail button on hide when it was inside the overlay.
 */
export const RailOverlay = ({
  name,
  isAvailable,
  allowCommands,
  onEscape,
  children,
}: {
  name: RailOverlayName;
  isAvailable: boolean;
  allowCommands?: readonly string[];
  /** asked first on an Escape that would hide it; true keeps it shown */
  onEscape?: () => boolean;
  children: ReactNode;
}) => {
  const isShown = useIsRailOverlayShown(name, isAvailable);
  const isPreviewMode = useStore($isPreviewMode);
  const isUiHidden = useStore($isUiHidden);
  const rail = useStore($rail);
  const rootRef = useRef<HTMLDivElement>(null);
  const { right: railRight, bottom: railBottom } = useRailBox(rail, isShown);

  // Preview mode and the hidden UI both take the rail away: they hide the
  // overlay, which stays hidden when they end.
  useEffect(() => {
    if (isPreviewMode || isUiHidden) {
      hideRailOverlay(name);
    }
  }, [name, isPreviewMode, isUiHidden]);

  // The external file drag's phase. A drag switches the sidebar to Assets,
  // and its end restores the saved tab (which, for "none", opens the
  // undocked navigator) in the same notification; "settling" covers that
  // notification and ends in a microtask. This subscriber is a child's of the
  // sidebar's, so it runs first.
  const dragPhase = useRef<"idle" | "dragging" | "settling">("idle");
  useExternalDragStateEffect((state) => {
    if (state === POTENTIAL) {
      dragPhase.current = "dragging";
      return;
    }
    if (dragPhase.current === "dragging") {
      dragPhase.current = "settling";
      queueMicrotask(() => {
        if (dragPhase.current === "settling") {
          dragPhase.current = "idle";
        }
      });
    }
  });

  // Another rail tab becoming active hides the overlay, except for a panel
  // change made by an external drag. A tab clicked during a drag still hides
  // it, through the sidebar's own hideRailOverlay().
  useEffect(() => {
    return $activeSidebarPanel.listen((panel) => {
      if (panel !== "none" && dragPhase.current === "idle") {
        hideRailOverlay(name);
      }
    });
  }, [name]);

  // Without the feature (a permit, a plan or the mode changed), there is
  // nothing to show.
  useEffect(() => {
    if (isAvailable === false) {
      hideRailOverlay(name);
    }
  }, [name, isAvailable]);

  useEffect(() => {
    if (isShown === false) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      suppressCommandsForEvent(
        event,
        allowCommands && { allow: allowCommands }
      );
    };
    const onEscapeKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        event.defaultPrevented === false &&
        isEditableTarget(event.target) === false
      ) {
        if (onEscape?.() === true) {
          event.preventDefault();
          return;
        }
        hideRailOverlay(name);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keydown", onEscapeKey);
    document.addEventListener("pointerdown", onOverlayPointerDown, true);
    for (const type of clipboardEventTypes) {
      window.addEventListener(type, onOverlayClipboard, true);
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keydown", onEscapeKey);
      document.removeEventListener("pointerdown", onOverlayPointerDown, true);
      for (const type of clipboardEventTypes) {
        window.removeEventListener(type, onOverlayClipboard, true);
      }
    };
  }, [name, isShown, allowCommands, onEscape]);

  // Focus leaves the canvas and the rail for the overlay. A child that wants
  // it (the CMS frame) takes it in its own layout effect, which runs after
  // this one. On hide, focus inside the overlay, or lost to the body, returns
  // to the rail button.
  const wasShown = useRef(false);
  useLayoutEffect(() => {
    if (isShown) {
      wasShown.current = true;
      rootRef.current?.focus();
      return;
    }
    if (wasShown.current === false) {
      return;
    }
    wasShown.current = false;
    const active = document.activeElement;
    if (
      active === null ||
      active === document.body ||
      rootRef.current?.contains(active)
    ) {
      document
        .querySelector<HTMLElement>(`[data-rail-button="${name}"]`)
        ?.focus();
    }
  }, [name, isShown]);

  if (isAvailable === false || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={rootRef}
      data-rail-overlay={name}
      tabIndex={-1}
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        left: railRight,
        right: 0,
        background: cssVar("--background-primary"),
        outline: "none",
        // Hidden, never unmounted: display none keeps what it holds alive.
        display: isShown ? "block" : "none",
      }}
    >
      {children}
      {/* The corner below the rail, where the footer would show through. */}
      <div
        data-rail-overlay-corner
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          width: railRight,
          top: railBottom,
          bottom: 0,
          background: cssVar("--background-primary"),
        }}
      />
    </div>,
    document.body
  );
};

/** A rail button that opens and hides its overlay. */
export const RailOverlayButton = ({
  name,
  label,
  isAvailable,
  children,
}: {
  name: RailOverlayName;
  label: string;
  isAvailable: boolean;
  children: ReactNode;
}) => {
  const open = useStore($openRailOverlay);
  if (isAvailable === false) {
    return null;
  }
  return (
    <SidebarButton
      label={label}
      data-rail-button={name}
      // IconButton shows the active state for aria-pressed
      aria-pressed={open === name}
      onClick={() => toggleRailOverlay(name)}
    >
      {children}
    </SidebarButton>
  );
};
