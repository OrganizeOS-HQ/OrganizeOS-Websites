import {
  Button,
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogTitle,
  Flex,
  PanelContent,
  Text,
} from "@webstudio-is/design-system";

/**
 * The confirmation for a delete of something in use (spec 4.8): what goes,
 * and how many places use it.
 */
export const DeleteDialog = ({
  open,
  name,
  uses,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  uses: number;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogTitle>{`Delete ${name}?`}</DialogTitle>
      <PanelContent as={Flex} gap="3" direction="column">
        <Text>{`Used in ${uses} ${uses === 1 ? "place" : "places"}.`}</Text>
      </PanelContent>
      <DialogActions>
        <Button
          autoFocus
          color="destructive"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          Delete
        </Button>
        <DialogClose>
          <Button color="ghost">Cancel</Button>
        </DialogClose>
      </DialogActions>
    </DialogContent>
  </Dialog>
);
