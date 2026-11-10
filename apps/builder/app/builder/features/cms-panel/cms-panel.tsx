import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { atom, computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  Button,
  Flex,
  Text,
  cssVar,
  rawTheme,
  toast,
} from "@webstudio-is/design-system";
import {
  $authPermit,
  $computedResourceRequests,
  $isPreviewMode,
  $organizeosSite,
  $planFeatures,
  $workspaceRole,
} from "~/shared/nano-states";
import { invalidateResource } from "~/shared/resources";
import { suppressCommandsForEvent } from "~/shared/commands-emitter";
import type { OrganizeosSite } from "~/shared/organizeos-site";
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
import { CmsIcon } from "./cms-icon";
import {
  findCollectionRequests,
  readCmsMessage,
  type CmsMessage,
} from "./cms-messages";
import { CmsNativeScreen } from "./native/cms-native-screen";

/**
 * The CMS overlay: the OrganizeOS app's CMS screen, framed over the builder
 * (OrganizeOS design
 * docs/superpowers/specs/2026-10-27-cms-overlay-and-staged-edits-design.md,
 * 3.1, superseding the panel of 2026-10-26-cms-in-the-builder-design.md,
 * 4.4).
 *
 * A rail button, not a sidebar panel, opens it. It covers everything right
 * of the rail: the top bar, the sidebar panel, the canvas and the inspector.
 *
 * Close means hide. The frame is mounted on the first open and stays mounted
 * for the life of the builder document; closing sets `display: none`, so
 * reopening shows the screen as it was left, unsaved text included. Nothing
 * discards it, so `cms.dirty` guards only the window's `beforeunload`.
 */

export const CMS_FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation";

export const COLLECTION_CHANGED_NOTICE =
  "Collection changes appear after you reload the builder";

/**
 * Offered for an OrganizeOS project when the deployment's switch is on
 * (`ORGANIZEOS_CMS_PANEL`), the plan allows dynamic data, and the user is
 * not a viewer (by workspace relation, or by a view-only permit).
 */
export const $isCmsPanelAvailable = computed(
  [$organizeosSite, $planFeatures, $workspaceRole, $authPermit],
  (site, planFeatures, role, authPermit) =>
    site?.cmsPanelEnabled === true &&
    planFeatures.allowDynamicData === true &&
    role !== "viewers" &&
    authPermit !== "view"
);

/** Whether the overlay shows. */
export const $isCmsOverlayOpen = atom(false);

/**
 * Whether the overlay exists: from the first open, for the document's life.
 * With the native screen off it holds the frame; with it on it holds the
 * native screen, and the frame inside it mounts once Classic CMS is first
 * shown (`$cmsClassicDeepLink`).
 */
export const $cmsFrameMounted = atom(false);

/** Whether the frame's editor has unsaved changes (`cms.dirty`). */
export const $cmsDirty = atom(false);

/** What the native screen has open: a collection's slug, an item's id. */
export type CmsDeepLink = { collection?: string; item?: string };

/**
 * Whether the overlay holds the native CMS screen in place of the frame
 * (`ORGANIZEOS_CMS_NATIVE`, for the org).
 */
export const $isCmsNative = computed(
  $organizeosSite,
  (site) => site?.cmsNativeEnabled === true
);

/** Whether the frame shows in place of the native screen. */
export const $isClassicCmsShown = atom(false);

/**
 * The deep link the frame first mounted with; undefined until Classic CMS is
 * first shown. The frame then stays mounted, so later switches keep its state.
 */
export const $cmsClassicDeepLink = atom<CmsDeepLink | undefined>(undefined);

/** Show the frame in place of the native screen. */
export const showClassicCms = (deepLink: CmsDeepLink) => {
  if ($cmsClassicDeepLink.get() === undefined) {
    $cmsClassicDeepLink.set(deepLink);
  }
  $isClassicCmsShown.set(true);
};

/** Show the native screen in place of the frame. */
export const showNativeCms = () => {
  $isClassicCmsShown.set(false);
};

/** The left rail, whose right edge the overlay starts at. */
const $cmsRail = atom<HTMLElement | null>(null);

/** A stable ref callback for the rail's element (sidebar-left.tsx). */
export const registerCmsRail = (element: HTMLElement | null) => {
  $cmsRail.set(element);
};

/**
 * Opening closes the sidebar panel first, as another rail tab replaces the
 * open one, so the panel listener never sees an open overlay mid-way. From
 * another panel, closing opens the undocked navigator, so it takes up to two
 * calls.
 */
export const openCmsOverlay = () => {
  for (
    let call = 0;
    call < 2 && $activeSidebarPanel.get() !== "none";
    call += 1
  ) {
    setActiveSidebarPanel("none");
  }
  $cmsFrameMounted.set(true);
  $isCmsOverlayOpen.set(true);
};

/** Hide the overlay. Returns whether it was open. */
export const hideCmsOverlay = (): boolean => {
  if ($isCmsOverlayOpen.get() === false) {
    return false;
  }
  $isCmsOverlayOpen.set(false);
  return true;
};

export const toggleCmsOverlay = () => {
  if (hideCmsOverlay() === false) {
    openCmsOverlay();
  }
};

/**
 * The CMS frame stays light, whatever the builder's colour scheme, until the
 * native CMS replaces it (owner decision D2).
 */
export const getBuilderColorMode = (): "light" | "dark" => "light";

/**
 * The frame's address, from the loader's org, never from the page URL, with
 * the native screen's deep link when it has one.
 */
export const getCmsPanelSrc = (
  site: Pick<OrganizeosSite, "platformUrl" | "organizationId">,
  theme: "light" | "dark",
  deepLink?: CmsDeepLink
) => {
  let src = `${site.platformUrl}/cms-panel/${encodeURIComponent(site.organizationId)}?theme=${theme}`;
  if (deepLink?.collection !== undefined) {
    src += `&collection=${encodeURIComponent(deepLink.collection)}`;
  }
  if (deepLink?.item !== undefined) {
    src += `&item=${encodeURIComponent(deepLink.item)}`;
  }
  return src;
};

export const showCollectionChangedNotice = () => {
  toast.info(
    <Flex direction="column" gap="2" align="start">
      <Text>{COLLECTION_CHANGED_NOTICE}</Text>
      <Button color="neutral" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </Flex>,
    {
      id: "cms-collection-changed",
      duration: Number.POSITIVE_INFINITY,
      copyText: COLLECTION_CHANGED_NOTICE,
    }
  );
};

/** Act on one accepted message. */
export const applyCmsMessage = (message: CmsMessage, platformUrl: string) => {
  switch (message.type) {
    case "cms.item_saved": {
      const requests = findCollectionRequests($computedResourceRequests.get(), {
        slug: message.collection,
        platformUrl,
      });
      for (const request of requests) {
        invalidateResource(request);
      }
      return;
    }
    case "cms.collection_changed":
      showCollectionChangedNotice();
      return;
    case "cms.dirty":
      $cmsDirty.set(message.dirty);
      return;
    case "cms.close_requested":
      // With the native screen, the frame's close returns to it.
      if ($isCmsNative.get()) {
        showNativeCms();
      } else {
        hideCmsOverlay();
      }
      return;
  }
};

const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if ($cmsDirty.get()) {
    event.preventDefault();
    // Older browsers show the prompt only when returnValue is set.
    event.returnValue = "";
  }
};

/**
 * While the overlay shows, no builder shortcut runs from the builder
 * document (the canvas is covered, and keys typed inside the CMS frame never
 * reach the builder). Escape hides the overlay and does nothing else: it
 * neither runs the builder's own Escape command (deselect, or leave preview)
 * nor reaches the sidebar's Escape, which would close the open panel.
 * Capture phase on the document, so it runs before the commands' own
 * document listener and before React's root.
 */
const onOverlayKeyDown = (event: KeyboardEvent) => {
  suppressCommandsForEvent(event);
  if (event.key === "Escape") {
    event.stopPropagation();
    hideCmsOverlay();
  }
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
 * A press on the top bar (the builder's main menu sits in its corner beside
 * the overlay) hides the overlay, as another rail tab does. Menus and the
 * dialogs they open portal without a z-index and would open beneath it.
 */
const onOverlayPointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (target.closest("[data-cms-overlay], [data-cms-rail-button]")) {
    return;
  }
  if (target.closest("nav")) {
    hideCmsOverlay();
  }
};

/**
 * The persistent overlay, rendered once by the left sidebar and portalled to
 * the document's body. It holds the frame, or, with the native screen on, the
 * native screen and, once Classic CMS is first shown, the frame behind it.
 *
 * It takes no z-index. As a later body child than the builder root, whose
 * `Main` and `SidePanel` isolate their stacking and whose top bar has a
 * z-index only while the UI is hidden, it paints over them. Design-system
 * popups portal to the body later still and paint over it; toasts keep
 * `zIndices.max`.
 */
export const CmsOverlay = () => {
  const isAvailable = useStore($isCmsPanelAvailable);
  const site = useStore($organizeosSite);
  const isMounted = useStore($cmsFrameMounted);
  const isOpen = useStore($isCmsOverlayOpen);
  const isPreviewMode = useStore($isPreviewMode);
  const isUiHidden = useStore($isUiHidden);
  const rail = useStore($cmsRail);
  const isNative = useStore($isCmsNative);
  const isClassicShown = useStore($isClassicCmsShown);
  const classicDeepLink = useStore($cmsClassicDeepLink);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const nativeRef = useRef<HTMLDivElement>(null);

  const platformUrl = site?.platformUrl;
  const organizationId = site?.organizationId;

  const isRendered =
    isAvailable &&
    isMounted &&
    platformUrl !== undefined &&
    organizationId !== undefined;
  // The frame exists always without the native screen, and with it from the
  // first Classic CMS on.
  const hasFrame =
    isRendered && (isNative === false || classicDeepLink !== undefined);
  const isFrameShown = isNative === false || isClassicShown;
  const isShown =
    isRendered && isOpen && isPreviewMode === false && isUiHidden === false;
  const { right: railRight, bottom: railBottom } = useRailBox(rail, isShown);

  // Preview mode and the hidden UI both take the rail away: they hide the
  // overlay, which stays hidden when they end.
  useEffect(() => {
    if (isPreviewMode || isUiHidden) {
      hideCmsOverlay();
    }
  }, [isPreviewMode, isUiHidden]);

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
  // it, through the sidebar's own hideCmsOverlay().
  useEffect(() => {
    return $activeSidebarPanel.listen((panel) => {
      if (panel !== "none" && dragPhase.current === "idle") {
        hideCmsOverlay();
      }
    });
  }, []);

  // Without the CMS (a permit or a plan changed), there is nothing to show.
  useEffect(() => {
    if (isAvailable === false) {
      hideCmsOverlay();
    }
  }, [isAvailable]);

  useEffect(() => {
    if (hasFrame === false || platformUrl === undefined) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const message = readCmsMessage(event, {
        frameWindow: iframeRef.current?.contentWindow,
        platformUrl,
      });
      if (message !== undefined) {
        applyCmsMessage(message, platformUrl);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [hasFrame, platformUrl]);

  useEffect(() => {
    if (isRendered === false) {
      // No frame, nothing unsaved.
      $cmsDirty.set(false);
      return;
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isRendered]);

  useEffect(() => {
    if (isShown === false) {
      return;
    }
    document.addEventListener("keydown", onOverlayKeyDown, true);
    document.addEventListener("pointerdown", onOverlayPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onOverlayKeyDown, true);
      document.removeEventListener("pointerdown", onOverlayPointerDown, true);
    };
  }, [isShown]);

  // Focus leaves the canvas and the rail for the CMS screen that shows.
  useLayoutEffect(() => {
    if (isShown === false) {
      return;
    }
    if (isFrameShown) {
      iframeRef.current?.focus();
    } else {
      nativeRef.current?.focus();
    }
  }, [isShown, isNative, isFrameShown]);

  if (
    isRendered === false ||
    platformUrl === undefined ||
    organizationId === undefined ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const frameElement = hasFrame ? (
    <iframe
      ref={iframeRef}
      data-cms-frame
      src={getCmsPanelSrc(
        { platformUrl, organizationId },
        getBuilderColorMode(),
        isNative ? classicDeepLink : undefined
      )}
      title="CMS"
      referrerPolicy="no-referrer"
      sandbox={CMS_FRAME_SANDBOX}
      style={{
        display: isFrameShown ? "block" : "none",
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  ) : undefined;

  return createPortal(
    <div
      data-cms-overlay
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        left: railRight,
        right: 0,
        background: cssVar("--background-primary"),
        // Hidden, never unmounted: display none keeps the document alive.
        display: isShown ? "block" : "none",
      }}
    >
      {isNative && (
        <CmsNativeScreen
          ref={nativeRef}
          hidden={isClassicShown}
          onClose={hideCmsOverlay}
          onShowClassic={showClassicCms}
        />
      )}
      {frameElement}
      {/* The corner below the rail, where the footer would show through. */}
      <div
        data-cms-overlay-corner
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

/** The rail's CMS button: it opens and hides the overlay. */
export const CmsRailButton = () => {
  const isAvailable = useStore($isCmsPanelAvailable);
  const isOpen = useStore($isCmsOverlayOpen);
  if (isAvailable === false) {
    return null;
  }
  return (
    <SidebarButton
      label="CMS"
      data-cms-rail-button
      // IconButton shows the active state for aria-pressed
      aria-pressed={isOpen}
      onClick={toggleCmsOverlay}
    >
      <CmsIcon size={rawTheme.spacing[10]} />
    </SidebarButton>
  );
};
