import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { atom, computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  Button,
  Flex,
  Text,
  rawTheme,
  theme,
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
import { $activeSidebarPanel, $isUiHidden } from "~/builder/shared/nano-states";
import { SidebarButton } from "~/builder/sidebar-left/sidebar-tabs";
import { CmsIcon } from "./cms-icon";
import {
  findCollectionRequests,
  readCmsMessage,
  type CmsMessage,
} from "./cms-messages";

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
 * Above the top bar (`zIndex: 1`, builder/shared/topbar.tsx) and below the
 * toast layer (`theme.zIndices.max`, 999), so the "Reload" notice for
 * `cms.collection_changed` shows over the CMS. The overlay is portalled to
 * the document's body, because the left sidebar's own box isolates its
 * stacking (builder.tsx `SidePanel`), where a z-index would not reach past
 * the inspector.
 */
export const CMS_OVERLAY_Z_INDEX = 2;

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

/** Whether the frame exists: from the first open, for the document's life. */
export const $cmsFrameMounted = atom(false);

/** Whether the frame's editor has unsaved changes (`cms.dirty`). */
export const $cmsDirty = atom(false);

/** The left rail, whose right edge the overlay starts at. */
const $cmsRail = atom<HTMLElement | null>(null);

/** A stable ref callback for the rail's element (sidebar-left.tsx). */
export const registerCmsRail = (element: HTMLElement | null) => {
  $cmsRail.set(element);
};

export const openCmsOverlay = () => {
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

/** The builder UI has one, light, colour mode. */
export const getBuilderColorMode = (): "light" | "dark" => "light";

/** The frame's address, from the loader's org, never from the page URL. */
export const getCmsPanelSrc = (
  site: Pick<OrganizeosSite, "platformUrl" | "organizationId">,
  theme: "light" | "dark"
) =>
  `${site.platformUrl}/cms-panel/${encodeURIComponent(site.organizationId)}?theme=${theme}`;

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
      hideCmsOverlay();
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
 * The persistent frame, rendered once by the left sidebar and portalled to
 * the document's body.
 */
export const CmsOverlay = () => {
  const isAvailable = useStore($isCmsPanelAvailable);
  const site = useStore($organizeosSite);
  const isMounted = useStore($cmsFrameMounted);
  const isOpen = useStore($isCmsOverlayOpen);
  const isPreviewMode = useStore($isPreviewMode);
  const isUiHidden = useStore($isUiHidden);
  const rail = useStore($cmsRail);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const platformUrl = site?.platformUrl;
  const organizationId = site?.organizationId;
  const src = useMemo(
    () =>
      platformUrl === undefined || organizationId === undefined
        ? undefined
        : getCmsPanelSrc(
            { platformUrl, organizationId },
            getBuilderColorMode()
          ),
    [platformUrl, organizationId]
  );

  const isRendered = isAvailable && isMounted && src !== undefined;
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

  // Another rail tab becoming active hides the overlay.
  useEffect(() => {
    return $activeSidebarPanel.listen((panel) => {
      if (panel !== "none") {
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
    if (isRendered === false || platformUrl === undefined) {
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
  }, [isRendered, platformUrl]);

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

  // Focus leaves the canvas and the rail for the CMS screen.
  useLayoutEffect(() => {
    if (isShown) {
      iframeRef.current?.focus();
    }
  }, [isShown]);

  if (isRendered === false || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      data-cms-overlay
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        left: railRight,
        right: 0,
        zIndex: CMS_OVERLAY_Z_INDEX,
        background: theme.colors.backgroundPanel,
        // Hidden, never unmounted: display none keeps the document alive.
        display: isShown ? "block" : "none",
      }}
    >
      <iframe
        ref={iframeRef}
        data-cms-frame
        src={src}
        title="CMS"
        referrerPolicy="no-referrer"
        sandbox={CMS_FRAME_SANDBOX}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
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
          background: theme.colors.backgroundPanel,
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
      data-state={isOpen ? "active" : "inactive"}
      aria-pressed={isOpen}
      onClick={toggleCmsOverlay}
    >
      <CmsIcon size={rawTheme.spacing[10]} />
    </SidebarButton>
  );
};
