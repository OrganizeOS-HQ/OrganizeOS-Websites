import { forwardRef, useMemo, useRef } from "react";
import { useStore } from "@nanostores/react";
import { toast } from "@webstudio-is/design-system";
import { $isDesignMode, $organizeosSite } from "~/shared/nano-states";
import { organizeosHomeUrl } from "~/shared/organizeos-site";
import {
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
} from "~/shared/sync/data-stores";
import {
  joinCmsCatalog,
  useCatalog,
  type CmsCatalogOrphan,
} from "../../organizeos-panel/collection-catalog";
import {
  CollectionActionsMenu,
  OrphanRow,
  StaleItemPageLine,
} from "../../organizeos-panel/collection-row-menu";
import type { CmsDeepLink } from "../cms-panel";
import { createCmsApi } from "./cms-api";
import { invalidateCollectionOnCanvas } from "./cms-canvas";
import { CmsScreen, type CmsCatalogSlots } from "./cms-screen";
import type { CmsCollectionSummary } from "./cms-source";

const onRemovedFromSitemap = () => {
  toast.success("Removed from sitemap");
};

const renderOrphan = (orphan: CmsCatalogOrphan) => {
  switch (orphan.kind) {
    case "stale_page":
      return (
        <OrphanRow
          key={orphan.key}
          name={orphan.name}
          isStale={true}
          removeIn="menu"
        />
      );
    case "sitemap":
      return (
        <OrphanRow
          key={orphan.key}
          name={orphan.slug}
          isStale={false}
          sitemapSlug={orphan.slug}
          removeIn="menu"
          onRemovedFromSitemap={onRemovedFromSitemap}
        />
      );
    case "no_collection":
      return (
        <OrphanRow
          key={orphan.key}
          name={orphan.name}
          isStale={orphan.isStale}
          removeIn="menu"
        />
      );
  }
};

/**
 * The build's side of the column (4.5): each collection's actions menu, its
 * stale line and the orphan rows, joined from the build's catalog. Undefined
 * while the actions are not allowed: outside Design mode, or for an org the
 * deny list denies.
 */
const useCatalogSlots = (onHide: () => void) => {
  const isDesignMode = useStore($isDesignMode);
  const site = useStore($organizeosSite);
  const catalog = useCatalog();
  const pages = useStore($pages);
  const instances = useStore($instances);
  const props = useStore($props);
  const dataSources = useStore($dataSources);
  const resources = useStore($resources);
  const isAllowed = isDesignMode && site?.blocksEnabled === true;
  // the latest callback, so a new one each render keeps the slots
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;
  return useMemo(() => {
    const showCanvas = () => onHideRef.current();
    if (isAllowed === false) {
      return;
    }
    let last:
      | {
          collections: readonly CmsCollectionSummary[];
          slots: CmsCatalogSlots | undefined;
        }
      | undefined;
    return (collections: readonly CmsCollectionSummary[]) => {
      if (catalog === undefined || pages === undefined) {
        return;
      }
      if (last?.collections === collections) {
        return last.slots;
      }
      const { rows, orphans } = joinCmsCatalog(
        collections.map((collection) => collection.slug),
        catalog,
        { pages, instances, props, dataSources, resources }
      );
      const slots: CmsCatalogSlots = {
        renderActions: (collection) => {
          const row = rows.get(collection.slug);
          if (row === undefined) {
            return null;
          }
          return (
            <CollectionActionsMenu
              slug={collection.slug}
              name={collection.name}
              itemPage={row.itemPage}
              isSitemapOrphan={row.isSitemapOrphan}
              onShowCanvas={showCanvas}
              onRemovedFromSitemap={onRemovedFromSitemap}
            />
          );
        },
        renderStaleLine: (collection) =>
          rows.get(collection.slug)?.isStale ? <StaleItemPageLine /> : null,
        footer: orphans.length === 0 ? null : orphans.map(renderOrphan),
      };
      last = { collections, slots };
      return slots;
    };
  }, [isAllowed, catalog, pages, instances, props, dataSources, resources]);
};

/**
 * The native CMS screen's host in the overlay (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 4.3 and 4.5): it builds the door-backed source for the project, the
 * build's side of the column, and passes the overlay's mechanics to
 * `CmsScreen`.
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
>(({ hidden, overlayShown, onClose, onHide, onShowClassic }, ref) => {
  const project = useStore($project);
  const site = useStore($organizeosSite);
  const projectId = project?.id;
  const source = useMemo(
    () => (projectId === undefined ? undefined : createCmsApi(projectId)),
    [projectId]
  );
  const catalogSlots = useCatalogSlots(onHide);
  const platformUrl = site?.platformUrl;
  // 4.7: after a create, save, publish or discard, the canvas refetches the
  // collection's requests
  const onItemWritten = useMemo(
    () =>
      platformUrl === undefined
        ? undefined
        : (slug: string) => invalidateCollectionOnCanvas(slug, platformUrl),
    [platformUrl]
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
      onItemWritten={onItemWritten}
      catalogSlots={catalogSlots}
    />
  );
});
CmsNativeScreen.displayName = "CmsNativeScreen";
