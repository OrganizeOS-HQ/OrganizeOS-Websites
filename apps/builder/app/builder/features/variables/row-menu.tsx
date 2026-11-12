import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  SmallIconButton,
} from "@webstudio-is/design-system";
import { EllipsesIcon } from "@webstudio-is/icons";
import { BRAND_COLLECTION_ID } from "@webstudio-is/project-build";
import type { CollectionView, VariableRow } from "./reader";
import { duplicateVariable, moveVariables } from "./operations";

/**
 * A row's actions (spec 5.5): Rename, Duplicate, Copy CSS name, Move to
 * collection and Delete; a locked row, or a read-only manager, offers Copy
 * CSS name only.
 */
export const RowMenu = ({
  row,
  collections,
  readOnly,
  onRename,
  onDelete,
}: {
  row: VariableRow;
  collections: readonly CollectionView[];
  readOnly: boolean;
  onRename: () => void;
  onDelete: () => void;
}) => {
  const isEditable = readOnly === false && row.locked === false;
  const targets = collections.filter(
    (collection) =>
      collection.id !== BRAND_COLLECTION_ID &&
      collection.id !== row.collectionId
  );
  // Rename hands the focus to the name; the other actions return it to the
  // trigger, as menus do.
  const keepFocus = useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SmallIconButton aria-label="Actions" icon={<EllipsesIcon />} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(event) => {
          if (keepFocus.current) {
            keepFocus.current = false;
            event.preventDefault();
          }
        }}
      >
        {isEditable && (
          <DropdownMenuItem
            onSelect={() => {
              keepFocus.current = true;
              onRename();
            }}
          >
            Rename
          </DropdownMenuItem>
        )}
        {isEditable && (
          <DropdownMenuItem onSelect={() => duplicateVariable(row.cssName)}>
            Duplicate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            navigator.clipboard
              ?.writeText(`var(--${row.cssName})`)
              .catch(() => {});
          }}
        >
          Copy CSS name
        </DropdownMenuItem>
        {isEditable && row.type !== undefined && targets.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to collection</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {targets.map((collection) => (
                <DropdownMenuItem
                  key={collection.id}
                  onSelect={() => moveVariables([row.cssName], collection.id)}
                >
                  {collection.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {isEditable && (
          <DropdownMenuItem destructive onSelect={onDelete}>
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
