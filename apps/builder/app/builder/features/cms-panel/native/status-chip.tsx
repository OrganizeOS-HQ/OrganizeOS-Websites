import { Chip } from "@webstudio-is/design-system";
import { getStatusChip } from "./cms-logic";
import type { CmsItemStatus } from "./cms-source";

export const StatusChip = (item: {
  status: CmsItemStatus;
  hasStagedChanges: boolean;
}) => {
  const { label, color } = getStatusChip(item);
  return (
    <Chip color={color} data-cms-status={label}>
      {label}
    </Chip>
  );
};
