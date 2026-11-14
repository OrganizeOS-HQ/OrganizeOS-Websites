/**
 * Storybook stand-ins for the build's side of the CMS column (4.5): a row's
 * "..." menu, its stale line and the orphan rows at the column's foot, drawn
 * as the data tab draws them (`organizeos-panel/collection-row-menu.tsx`).
 * They act on nothing.
 */
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  SmallIconButton,
  Text,
  toast,
} from "@webstudio-is/design-system";
import { EllipsesIcon } from "@webstudio-is/icons";
import type { CmsCatalogSlots } from "./cms-screen";
import type { CmsCollectionSummary } from "./cms-source";
import { TruncatedText } from "./truncated-text";

/** The build's side of the sample: which collections have an item page. */
export type SampleCatalog = {
  /** Public collections with a catalog Resource, by slug. */
  rows: Record<
    string,
    { hasItemPage: boolean; isSitemapOrphan: boolean; isStale?: boolean }
  >;
  orphans: Array<{ name: string; isStale: boolean; sitemapSlug?: string }>;
};

export const sampleCatalog: SampleCatalog = {
  rows: {
    news: { hasItemPage: true, isSitemapOrphan: false },
    campaigns: { hasItemPage: true, isSitemapOrphan: false, isStale: true },
    leadership: { hasItemPage: false, isSitemapOrphan: true },
  },
  orphans: [
    { name: "Press releases", isStale: false, sitemapSlug: "press-releases" },
    { name: "Events", isStale: true },
  ],
};

const removedFromSitemap = () => toast.success("Removed from sitemap");

const SampleMenu = ({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <SmallIconButton
        aria-label={`${name} menu`}
        icon={<EllipsesIcon />}
        css={{ flexShrink: 0 }}
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
);

const SampleStaleLine = () => (
  <Text color="destructive">Item page uses an old address</Text>
);

const SampleOrphanRow = ({
  name,
  isStale,
  sitemapSlug,
}: SampleCatalog["orphans"][number]) => (
  <Flex direction="column" data-organizeos-orphan>
    <Flex align="center" justify="between" gap="2">
      <TruncatedText>{name}</TruncatedText>
      {sitemapSlug !== undefined && (
        <SampleMenu name={name}>
          <DropdownMenuItem onSelect={removedFromSitemap}>
            Remove from sitemap
          </DropdownMenuItem>
        </SampleMenu>
      )}
    </Flex>
    {isStale && <SampleStaleLine />}
  </Flex>
);

/** The sample's `catalogSlots`, as the host builds them from the build. */
export const sampleCatalogSlots =
  (catalog: SampleCatalog) =>
  (_collections: readonly CmsCollectionSummary[]): CmsCatalogSlots => ({
    renderActions: (collection, { leading, trailing }) => {
      const row = catalog.rows[collection.slug];
      if (row === undefined || collection.isPublic === false) {
        return null;
      }
      return (
        <SampleMenu name={collection.name}>
          {leading}
          <DropdownMenuItem>
            {row.hasItemPage ? "Open item page" : "Create item page"}
          </DropdownMenuItem>
          <DropdownMenuItem>Add list</DropdownMenuItem>
          {trailing}
          {row.isSitemapOrphan && (
            <DropdownMenuItem onSelect={removedFromSitemap}>
              Remove from sitemap
            </DropdownMenuItem>
          )}
        </SampleMenu>
      );
    },
    renderStaleLine: (collection) =>
      catalog.rows[collection.slug]?.isStale ? <SampleStaleLine /> : null,
    footer: catalog.orphans.map((orphan) => (
      <SampleOrphanRow key={orphan.name} {...orphan} />
    )),
  });
