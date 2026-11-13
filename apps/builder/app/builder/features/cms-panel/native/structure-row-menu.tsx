/**
 * A collection row's "..." where the collection actions do not show (a
 * private collection, Content mode, a denied org, a catalog not resolved):
 * Settings and Delete, for a person who can manage the CMS's settings.
 */
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
  onSettings,
  onDelete,
}: {
  collection: CmsCollectionSummary;
  onSettings: () => void;
  onDelete: () => void;
}) => (
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
      <DropdownMenuItem onSelect={onSettings}>Settings</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem destructive onSelect={onDelete}>
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
