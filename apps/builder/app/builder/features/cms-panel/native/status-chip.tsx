import { Chip, cssVar } from "@webstudio-is/design-system";
import { getStatusChip } from "./cms-logic";
import type { CmsItemStatus } from "./cms-source";

/** Archived: no fill, a 1 px inset border, as the platform's badge draws it. */
const outlineCss = {
  backgroundColor: "transparent",
  color: cssVar("--foreground-secondary"),
  boxShadow: `inset 0 0 0 1px ${cssVar("--border-default")}`,
};

export const StatusChip = (item: {
  status: CmsItemStatus;
  hasStagedChanges: boolean;
}) => {
  const { label, color } = getStatusChip(item);
  return color === "outline" ? (
    <Chip color="neutral" css={outlineCss} data-cms-status={label}>
      {label}
    </Chip>
  ) : (
    <Chip color={color} data-cms-status={label}>
      {label}
    </Chip>
  );
};
