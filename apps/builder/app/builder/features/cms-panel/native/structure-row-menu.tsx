/**
 * A collection row's "..." with structure on (slice 3): Settings, then the
 * collection actions (4.5) when the build has them, then Delete.
 */
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SmallIconButton,
} from "@webstudio-is/design-system";
import { EllipsesIcon } from "@webstudio-is/icons";
import type { CmsCollectionSummary } from "./cms-source";

export const StructureRowMenu = ({
  collection,
  canManage,
  actionItems,
  onSettings,
  onDelete,
}: {
  collection: CmsCollectionSummary;
  canManage: boolean;
  /** W2's collection actions as menu items, or nothing. */
  actionItems: ReactNode;
  onSettings: () => void;
  onDelete: () => void;
}) => {
  const hasActions =
    actionItems !== undefined && actionItems !== null && actionItems !== false;
  if (canManage === false && hasActions === false) {
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
        {canManage && (
          <DropdownMenuItem onSelect={onSettings}>Settings</DropdownMenuItem>
        )}
        {canManage && hasActions && <DropdownMenuSeparator />}
        {actionItems}
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
