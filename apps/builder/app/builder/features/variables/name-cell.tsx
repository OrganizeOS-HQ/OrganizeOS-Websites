import { useState } from "react";
import { Box, Tooltip, cssVar, theme } from "@webstudio-is/design-system";
import { useContentEditable } from "~/shared/dom-hooks";
import type { VariableRow } from "./reader";
import { renameVariable } from "./operations";

/** The text after the first "/", or the whole name. */
const leafOf = (displayName: string) => {
  const slash = displayName.indexOf("/");
  return slash === -1 ? displayName : displayName.slice(slash + 1);
};

/**
 * A row's display name, renamed in place as the Navigator renames an
 * instance (double-click, or the row menu's Rename). Under a group header it
 * shows the leaf; the edit always holds the whole name. A refusal keeps the
 * edit open, outlined, with the reason in its tooltip.
 */
export const NameCell = ({
  row,
  readOnly,
  showLeaf = false,
  editing,
  onEditingChange,
}: {
  row: VariableRow;
  readOnly: boolean;
  showLeaf?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) => {
  const [ownEditing, setOwnEditing] = useState(false);
  const [error, setError] = useState<string>();
  const isEditable = readOnly === false && row.locked === false;
  const isEditing = isEditable && (editing ?? ownEditing);
  const setEditing = (next: boolean) => {
    // An edit that ends (Escape, or a write that landed) drops the reason; a
    // refusal sets it again after this, and keeps the edit open.
    if (next === false) {
      setError(undefined);
    }
    setOwnEditing(next);
    onEditingChange?.(next);
  };
  const { ref, handlers } = useContentEditable({
    value: row.displayName,
    isEditable,
    isEditing,
    onChangeEditing: setEditing,
    onChangeValue: (value) => {
      if (value.trim() === row.displayName) {
        setError(undefined);
        return;
      }
      const result = renameVariable({
        from: row.cssName,
        displayName: value,
      });
      if (result.ok) {
        setError(undefined);
        return;
      }
      setError(result.error);
      setEditing(true);
    },
  });
  const label =
    isEditing || showLeaf === false ? row.displayName : leafOf(row.displayName);
  return (
    // Always a tooltip, never its child alone: the field must not remount
    // (and lose its edit) when a reason appears.
    <Tooltip content={error ?? ""} open={error !== undefined} delayDuration={0}>
      <Box
        ref={ref}
        {...handlers}
        data-name-cell
        aria-invalid={error === undefined ? undefined : true}
        onInput={() => setError(undefined)}
        css={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          padding: theme.spacing[2],
          borderRadius: theme.borderRadius[2],
          outline:
            error === undefined
              ? "none"
              : `1px solid ${cssVar("--border-negative")}`,
          "&[contenteditable]": {
            outline: `1px solid ${cssVar(
              error === undefined ? "--border-focus" : "--border-negative"
            )}`,
            textOverflow: "clip",
          },
        }}
      >
        {label}
      </Box>
    </Tooltip>
  );
};
