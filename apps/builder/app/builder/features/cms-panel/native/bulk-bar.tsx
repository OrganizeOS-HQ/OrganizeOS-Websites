/**
 * The bulk bar (spec 5.1.6): shown in the top bar's place while rows are
 * selected. Publish and Unpublish need publish rights; every button is
 * disabled while a call is in flight.
 */
import { useLayoutEffect, useRef } from "react";
import { Button, Flex, Text } from "@webstudio-is/design-system";

export const BulkBar = ({
  count,
  canPublish,
  busy,
  onPublish,
  onUnpublish,
  onArchive,
  onDelete,
  onClear,
  onFocusLost,
}: {
  count: number;
  canPublish: boolean;
  busy: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
  /** The bar leaves with the focus inside it. */
  onFocusLost?: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const latestFocusLost = useRef(onFocusLost);
  latestFocusLost.current = onFocusLost;
  // runs before the bar's nodes leave the DOM, while the focus is still there
  useLayoutEffect(
    () => () => {
      if (ref.current?.contains(document.activeElement) === true) {
        latestFocusLost.current?.();
      }
    },
    []
  );
  return (
    <Flex
      ref={ref}
      role="toolbar"
      aria-label="Bulk actions"
      align="center"
      gap="2"
      wrap="wrap"
      data-cms-bulk-bar
      css={{ minWidth: 0 }}
    >
      <Text css={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
        {count} selected
      </Text>
      {canPublish && (
        <Button color="primary" disabled={busy} onClick={onPublish}>
          Publish
        </Button>
      )}
      {canPublish && (
        <Button color="neutral" disabled={busy} onClick={onUnpublish}>
          Unpublish
        </Button>
      )}
      <Button color="neutral" disabled={busy} onClick={onArchive}>
        Archive
      </Button>
      <Button color="destructive" disabled={busy} onClick={onDelete}>
        Delete
      </Button>
      <Button color="ghost" disabled={busy} onClick={onClear}>
        Clear
      </Button>
    </Flex>
  );
};
