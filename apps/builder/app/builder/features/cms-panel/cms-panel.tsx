import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { atom, computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  Box,
  Button,
  Flex,
  PanelTitle,
  Separator,
  Text,
  Tooltip,
  toast,
} from "@webstudio-is/design-system";
import { XIcon } from "@webstudio-is/icons";
import {
  $authPermit,
  $computedResourceRequests,
  $isContentMode,
  $organizeosSite,
  $planFeatures,
  $selectedPage,
  $workspaceRole,
} from "~/shared/nano-states";
import { invalidateResource } from "~/shared/resources";
import type { OrganizeosSite } from "~/shared/organizeos-site";
import { $activeSidebarPanel } from "~/builder/shared/nano-states";
import {
  $isOrganizeosPanelAvailable,
  OrganizeosDataBody,
} from "~/builder/features/organizeos-panel";
import {
  findCollectionRequests,
  readCmsMessage,
  type CmsMessage,
} from "./cms-messages";

/**
 * The CMS panel: the OrganizeOS app's CMS screen, framed in the left sidebar
 * (OrganizeOS design
 * docs/superpowers/specs/2026-10-26-cms-in-the-builder-design.md, 4.4). It
 * takes the OrganizeOS data tab's slot, and keeps that tab's list as its Data
 * view.
 *
 * The sidebar renders only the active panel, so a frame inside the panel
 * would be destroyed, with the open item and any unsaved text, on every tab
 * switch or Escape. The frame is therefore `CmsFrame`, rendered once beside
 * the tab content for the life of the builder document (once the panel has
 * first been opened), and laid over the panel's slot while the panel shows
 * its Content view. Only the panel's own close button discards it, after a
 * confirm when the frame has unsaved changes.
 */

export const CMS_FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation";

export const DISCARD_MESSAGE =
  "The CMS has unsaved changes. Close it and discard them?";

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

export type CmsPanelView = "content" | "data";

export const $cmsPanelView = atom<CmsPanelView>("content");

/**
 * The Data view, today's OrganizeOS data list, is offered where the data tab
 * was: an org on the blocks' allowlist, outside content mode, on a page that
 * is not a text page.
 */
export const $isCmsDataViewAvailable = computed(
  [$isOrganizeosPanelAvailable, $isContentMode, $selectedPage],
  (isOrganizeosPanelAvailable, isContentMode, page) =>
    isOrganizeosPanelAvailable &&
    isContentMode === false &&
    page?.meta.documentType !== "text"
);

const $cmsPanelEffectiveView = computed(
  [$cmsPanelView, $isCmsDataViewAvailable],
  (view, isDataViewAvailable): CmsPanelView =>
    view === "data" && isDataViewAvailable ? "data" : "content"
);

/** Whether the frame exists: from the panel's first opening until a close. */
export const $cmsFrameMounted = atom(false);

/** Whether the frame's editor has unsaved changes (`cms.dirty`). */
export const $cmsDirty = atom(false);

/** The panel body the frame is laid over, while the Content view shows. */
const $cmsFrameSlot = atom<HTMLElement | null>(null);

/**
 * Close the panel's frame, asking first when it has unsaved changes. Returns
 * whether it was closed.
 */
export const discardCmsFrame = (
  confirmDiscard: (message: string) => boolean = (message) =>
    window.confirm(message)
): boolean => {
  if ($cmsDirty.get() && confirmDiscard(DISCARD_MESSAGE) === false) {
    return false;
  }
  $cmsDirty.set(false);
  $cmsFrameMounted.set(false);
  return true;
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
  }
};

const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if ($cmsDirty.get()) {
    event.preventDefault();
    // Older browsers show the prompt only when returnValue is set.
    event.returnValue = "";
  }
};

type FrameRect = { top: number; left: number; width: number; height: number };

/** The slot's place in the viewport, kept current while it is shown. */
const useSlotRect = (slot: HTMLElement | null) => {
  const [rect, setRect] = useState<FrameRect>();
  useLayoutEffect(() => {
    if (slot === null) {
      return;
    }
    const update = () => {
      const { top, left, width, height } = slot.getBoundingClientRect();
      setRect((previous) =>
        previous?.top === top &&
        previous.left === left &&
        previous.width === width &&
        previous.height === height
          ? previous
          : { top, left, width, height }
      );
    };
    update();
    window.addEventListener("resize", update);
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(slot);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [slot]);
  return rect;
};

/**
 * The persistent frame. Rendered by the left sidebar outside its tab content,
 * so neither a tab switch nor Escape unmounts it.
 */
export const CmsFrame = () => {
  const isAvailable = useStore($isCmsPanelAvailable);
  const site = useStore($organizeosSite);
  const isMounted = useStore($cmsFrameMounted);
  const activePanel = useStore($activeSidebarPanel);
  const view = useStore($cmsPanelEffectiveView);
  const slot = useStore($cmsFrameSlot);
  const rect = useSlotRect(slot);
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

  if (isRendered === false) {
    return null;
  }

  const isVisible =
    activePanel === "cms" &&
    view === "content" &&
    slot !== null &&
    rect !== undefined;

  return (
    <iframe
      ref={iframeRef}
      data-cms-frame
      src={src}
      title="CMS"
      referrerPolicy="no-referrer"
      sandbox={CMS_FRAME_SANDBOX}
      style={{
        position: "fixed",
        top: rect?.top ?? 0,
        left: rect?.left ?? 0,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        border: "none",
        // Hidden, never unmounted: display none keeps the document alive.
        display: isVisible ? "block" : "none",
      }}
    />
  );
};

const CmsFrameSlot = () => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    $cmsFrameSlot.set(ref.current);
    return () => {
      $cmsFrameSlot.set(null);
    };
  }, []);
  return (
    <Box
      ref={ref}
      data-cms-frame-slot
      css={{ flexGrow: 1, minHeight: 0, position: "relative" }}
    />
  );
};

const ViewButton = ({
  view,
  current,
  children,
}: {
  view: CmsPanelView;
  current: CmsPanelView;
  children: string;
}) => (
  <Button
    color={view === current ? "neutral" : "ghost"}
    aria-pressed={view === current}
    data-cms-view={view}
    onClick={() => $cmsPanelView.set(view)}
  >
    {children}
  </Button>
);

/** The panel's own entry: its title, its views and the frame's slot. */
export const CmsPanel = ({ onClose }: { onClose: () => void }) => {
  const view = useStore($cmsPanelEffectiveView);
  const isDataViewAvailable = useStore($isCmsDataViewAvailable);

  useEffect(() => {
    $cmsFrameMounted.set(true);
  }, []);

  return (
    <>
      <PanelTitle
        suffix={
          <Flex gap="1" align="center">
            {isDataViewAvailable && (
              <Flex gap="1" role="group" aria-label="CMS view">
                <ViewButton view="content" current={view}>
                  Content
                </ViewButton>
                <ViewButton view="data" current={view}>
                  Data
                </ViewButton>
              </Flex>
            )}
            <Tooltip content="Close CMS">
              <Button
                color="ghost"
                prefix={<XIcon />}
                aria-label="Close CMS"
                data-cms-close
                onClick={() => {
                  if (discardCmsFrame()) {
                    onClose();
                  }
                }}
              />
            </Tooltip>
          </Flex>
        }
      >
        CMS
      </PanelTitle>
      <Separator />
      {view === "content" ? <CmsFrameSlot /> : <OrganizeosDataBody />}
    </>
  );
};
