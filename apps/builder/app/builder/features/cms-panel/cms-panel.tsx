import { useEffect, useLayoutEffect, useRef } from "react";
import { atom, computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  Button,
  Flex,
  Text,
  rawTheme,
  toast,
} from "@webstudio-is/design-system";
import {
  $authPermit,
  $organizeosSite,
  $planFeatures,
  $workspaceRole,
} from "~/shared/nano-states";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import {
  $openRailOverlay,
  hideRailOverlay,
  RailOverlay,
  RailOverlayButton,
  registerRail,
  useIsRailOverlayShown,
} from "../rail-overlay/rail-overlay";
import { CmsIcon } from "./cms-icon";
import { readCmsMessage, type CmsMessage } from "./cms-messages";
import { invalidateCollectionOnCanvas } from "./native/cms-canvas";
import { $cmsNativeDirty, refreshCmsNative } from "./native/cms-native-stores";
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
 * The overlay's mechanics (opening, hiding, Escape, focus, drags, the
 * clipboard guard and the stacking) are the rail-overlay host's
 * (`features/rail-overlay`), shared with Variables.
 *
 * Close means hide. The frame is mounted on the first open and stays mounted
 * for the life of the builder document; closing sets `display: none`, so
 * reopening shows the screen as it was left, unsaved text included.
 * `$cmsDirty` is set while the frame's editor or the native editor has
 * unsaved changes, and guards only the window's `beforeunload`; clearing one
 * flag never clears the other.
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

/** Whether the CMS is the open rail overlay. */
export const $isCmsOverlayOpen = computed(
  $openRailOverlay,
  (name) => name === "cms"
);

/**
 * Whether the overlay exists: from the first open, for the document's life.
 * With the native screen off it holds the frame; with it on it holds the
 * native screen, and the frame inside it mounts once Classic CMS is first
 * shown (`$cmsClassicDeepLink`).
 */
export const $cmsFrameMounted = atom(false);

/** Whether the frame's editor has unsaved changes (`cms.dirty`). */
export const $cmsFrameDirty = atom(false);

/** Whether the frame's editor or the native editor has unsaved changes. */
export const $cmsDirty = computed(
  [$cmsFrameDirty, $cmsNativeDirty],
  (frame, native) => frame || native
);

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

/** A stable ref callback for the rail's element (sidebar-left.tsx). */
export const registerCmsRail = registerRail;

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
    case "cms.item_saved":
      invalidateCollectionOnCanvas(message.collection, platformUrl);
      refreshCmsNative();
      return;
    case "cms.collection_changed":
      showCollectionChangedNotice();
      refreshCmsNative();
      return;
    case "cms.dirty":
      $cmsFrameDirty.set(message.dirty);
      return;
    case "cms.close_requested":
      // With the native screen, the frame's close returns to it.
      if ($isCmsNative.get()) {
        showNativeCms();
      } else {
        hideRailOverlay("cms");
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
 * The CMS overlay, rendered once by the left sidebar on the rail-overlay
 * host. It holds the frame, or, with the native screen on, the native screen
 * and, once Classic CMS is first shown, the frame behind it. They mount on the
 * first open and stay mounted for the document's life.
 */
export const CmsOverlay = () => {
  const isCmsAvailable = useStore($isCmsPanelAvailable);
  const site = useStore($organizeosSite);
  const isMounted = useStore($cmsFrameMounted);
  const isOpen = useStore($isCmsOverlayOpen);
  const isNative = useStore($isCmsNative);
  const isClassicShown = useStore($isClassicCmsShown);
  const classicDeepLink = useStore($cmsClassicDeepLink);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const nativeRef = useRef<HTMLDivElement>(null);

  const platformUrl = site?.platformUrl;
  const organizationId = site?.organizationId;

  const isAvailable =
    isCmsAvailable && platformUrl !== undefined && organizationId !== undefined;
  const isRendered = isAvailable && isMounted;
  // The frame exists always without the native screen, and with it from the
  // first Classic CMS on.
  const hasFrame =
    isRendered && (isNative === false || classicDeepLink !== undefined);
  const isFrameShown = isNative === false || isClassicShown;
  const isShown = useIsRailOverlayShown("cms", isAvailable);

  // The first open mounts what the overlay holds, before it paints.
  useLayoutEffect(() => {
    if (isOpen) {
      $cmsFrameMounted.set(true);
    }
  }, [isOpen]);

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
      // No frame, nothing unsaved in it. The native flag clears when the
      // native screen unmounts.
      $cmsFrameDirty.set(false);
      return;
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [isRendered]);

  // Focus goes to the CMS screen that shows. This layout effect is the
  // host's parent's, so it runs after the host has focused its root.
  useLayoutEffect(() => {
    if (isShown === false) {
      return;
    }
    if (isFrameShown) {
      iframeRef.current?.focus();
    } else {
      nativeRef.current?.focus();
    }
  }, [isShown, isNative, isFrameShown, isRendered]);

  const frameElement =
    hasFrame && platformUrl !== undefined && organizationId !== undefined ? (
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

  const hide = () => {
    hideRailOverlay("cms");
  };

  return (
    <RailOverlay name="cms" isAvailable={isAvailable}>
      {isRendered && isNative && (
        <CmsNativeScreen
          ref={nativeRef}
          hidden={isClassicShown}
          overlayShown={isShown}
          onClose={hide}
          onHide={hide}
          onShowClassic={showClassicCms}
        />
      )}
      {frameElement}
    </RailOverlay>
  );
};

/** The rail's CMS button: it opens and hides the overlay. */
export const CmsRailButton = () => (
  <RailOverlayButton
    name="cms"
    label="CMS"
    isAvailable={useStore($isCmsPanelAvailable)}
  >
    <CmsIcon size={rawTheme.spacing[10]} />
  </RailOverlayButton>
);
