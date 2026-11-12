import { forwardRef, useMemo } from "react";
import { useStore } from "@nanostores/react";
import { $organizeosSite } from "~/shared/nano-states";
import { organizeosHomeUrl } from "~/shared/organizeos-site";
import { $project } from "~/shared/sync/data-stores";
import type { CmsDeepLink } from "../cms-panel";
import { createCmsApi } from "./cms-api";
import { CmsScreen } from "./cms-screen";

/**
 * The native CMS screen's host in the overlay (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 4.3): it builds the door-backed source for the project and passes the
 * overlay's mechanics to `CmsScreen`.
 *
 * It takes its callbacks as props, so this folder imports cms-panel.tsx for
 * types only.
 */
export const CmsNativeScreen = forwardRef<
  HTMLDivElement,
  {
    hidden: boolean;
    /** The overlay is open, not in preview, with the UI not hidden. */
    overlayShown: boolean;
    /** Hides the overlay and returns the focus to the rail. */
    onClose: () => void;
    /** Hides the overlay and leaves the focus alone. */
    onHide: () => void;
    onShowClassic: (deepLink: CmsDeepLink) => void;
  }
>(({ hidden, overlayShown, onClose, onShowClassic }, ref) => {
  const project = useStore($project);
  const site = useStore($organizeosSite);
  const projectId = project?.id;
  const source = useMemo(
    () => (projectId === undefined ? undefined : createCmsApi(projectId)),
    [projectId]
  );
  return (
    <CmsScreen
      ref={ref}
      source={source}
      hidden={hidden}
      isVisible={overlayShown && hidden === false}
      homeUrl={site === undefined ? undefined : organizeosHomeUrl(site)}
      onClose={onClose}
      onShowClassic={onShowClassic}
    />
  );
});
CmsNativeScreen.displayName = "CmsNativeScreen";
