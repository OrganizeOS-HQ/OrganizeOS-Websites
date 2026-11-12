/**
 * Storybook stand-ins for W2's collection actions (4.5): a row's "..." menu
 * and the orphan rows at the column's foot, drawn as the data tab draws
 * them (`organizeos-panel/collection-row-menu.tsx`). They act on nothing.
 */
import {
  Button,
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
import type { CmsCollectionSummary } from "./cms-source";
import { TruncatedText } from "./truncated-text";

/** The build's side of the sample: which collections have an item page. */
export type SampleCatalog = {
  /** Public collections with a catalog Resource, by slug. */
  rows: Record<string, { hasItemPage: boolean; isSitemapOrphan: boolean }>;
  orphans: Array<{ name: string; isStale: boolean; sitemapSlug?: string }>;
};

export const sampleCatalog: SampleCatalog = {
  rows: {
    news: { hasItemPage: true, isSitemapOrphan: false },
    campaigns: { hasItemPage: true, isSitemapOrphan: false },
    leadership: { hasItemPage: false, isSitemapOrphan: true },
  },
  orphans: [
    { name: "Press releases", isStale: false, sitemapSlug: "press-releases" },
    { name: "Events", isStale: true },
  ],
};

export const renderSampleCollectionActions =
  (catalog: SampleCatalog) => (collection: CmsCollectionSummary) => {
    const row = catalog.rows[collection.slug];
    if (row === undefined) {
      return null;
    }
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <SmallIconButton
            aria-label={`${collection.name} menu`}
            icon={<EllipsesIcon />}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuItem>
            {row.hasItemPage ? "Open item page" : "Create item page"}
          </DropdownMenuItem>
          <DropdownMenuItem>Add list</DropdownMenuItem>
          {row.isSitemapOrphan && (
            <DropdownMenuItem
              onSelect={() => toast.success("Removed from sitemap")}
            >
              Remove from sitemap
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

const SampleOrphanRow = ({
  name,
  isStale,
  sitemapSlug,
}: SampleCatalog["orphans"][number]) => (
  <Flex direction="column" data-organizeos-orphan>
    <Flex align="center" justify="between" gap="2">
      <TruncatedText>{name}</TruncatedText>
      {sitemapSlug !== undefined && (
        <Button
          color="neutral"
          css={{ flexShrink: 0 }}
          onClick={() => toast.success("Removed from sitemap")}
        >
          Remove from sitemap
        </Button>
      )}
    </Flex>
    {isStale && <Text color="destructive">Item page uses an old address</Text>}
  </Flex>
);

export const SampleOrphanRows = ({ catalog }: { catalog: SampleCatalog }) => (
  <>
    {catalog.orphans.map((orphan) => (
      <SampleOrphanRow key={orphan.name} {...orphan} />
    ))}
  </>
);
