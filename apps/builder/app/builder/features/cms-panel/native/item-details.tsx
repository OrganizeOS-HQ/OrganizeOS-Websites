/**
 * The item editor's side details (spec 5.2.2): Published, Modified,
 * Modified by and Created. Beside the fields from `SIDE_DETAILS_WIDTH` of
 * editor body, else after Address.
 */
import { Grid, Text, theme } from "@webstudio-is/design-system";
import { RelativeTime } from "~/builder/shared/relative-time";
import type { CmsItem } from "./cms-source";
import { TruncatedText } from "./truncated-text";

/** The editor body's width from which the details sit beside the fields. */
export const SIDE_DETAILS_WIDTH = 720;

/** A short date in the browser's locale. */
const shortDate = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "short" }).format(date);
};

const Label = ({ children }: { children: string }) => (
  <Text color="subtle" css={{ whiteSpace: "nowrap" }}>
    {children}
  </Text>
);

export const ItemDetails = ({ item }: { item: CmsItem }) => (
  <Grid
    data-cms-item-details
    css={{
      gridTemplateColumns: "auto minmax(0, 1fr)",
      columnGap: theme.spacing[5],
      rowGap: theme.spacing[3],
      alignContent: "start",
      alignItems: "center",
      minWidth: 0,
    }}
  >
    <Label>Published</Label>
    <TruncatedText data-cms-detail="published">
      {item.status === "published" && item.publishedAt !== null
        ? shortDate(item.publishedAt)
        : "Not live"}
    </TruncatedText>
    <Label>Modified</Label>
    <Text truncate data-cms-detail="modified">
      <RelativeTime time={new Date(item.updatedAt)} />
    </Text>
    {item.modifiedByName !== null && (
      <>
        <Label>Modified by</Label>
        <TruncatedText data-cms-detail="modified-by">
          {item.modifiedByName}
        </TruncatedText>
      </>
    )}
    <Label>Created</Label>
    <TruncatedText data-cms-detail="created">
      {shortDate(item.createdAt)}
    </TruncatedText>
  </Grid>
);
