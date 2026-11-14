/**
 * The delete confirmation shared by the bulk bar and the item editor
 * (spec 5.1.6, 5.2.1): the title, "Delete" (destructive) and "Cancel", the
 * safe choice focused first.
 */
import { useRef } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@webstudio-is/design-system";

export const DeleteDialog = ({
  open,
  title,
  busy,
  onConfirm,
  onCancel,
  onFocusLost,
}: {
  open: boolean;
  title: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** The element that opened the dialog is gone when it closes. */
  onFocusLost?: () => void;
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // the element focused when the dialog opened takes the focus back
  const opener = useRef<Element | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next === false && busy === false) {
          onCancel();
        }
      }}
    >
      <DialogContent
        width={420}
        aria-describedby={undefined}
        // the safe choice takes the first focus; Delete stays right
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          opener.current = document.activeElement;
          cancelRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          const element = opener.current;
          opener.current = null;
          // the page itself is no opener: a menu item that opened the
          // dialog leaves the focus there
          if (
            element instanceof HTMLElement &&
            element !== document.body &&
            element.isConnected
          ) {
            event.preventDefault();
            element.focus();
          } else if (onFocusLost !== undefined) {
            event.preventDefault();
            onFocusLost();
          }
        }}
      >
        <DialogActions>
          <Button
            color="destructive"
            disabled={busy}
            state={busy ? "pending" : undefined}
            onClick={onConfirm}
          >
            Delete
          </Button>
          <DialogClose>
            <Button ref={cancelRef} color="ghost" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
        </DialogActions>
        {/* last in the DOM, so the close button is last in tab order */}
        <DialogTitle>{title}</DialogTitle>
      </DialogContent>
    </Dialog>
  );
};
