import { useState, useEffect } from "react";
import { atom, computed } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  PanelContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  DialogClose,
  Button,
  Text,
  Flex,
  theme,
  InputField,
  toast,
  cssVar,
} from "@webstudio-is/design-system";
import type { CustomProperty } from "@webstudio-is/css-engine";
import {
  $styles,
  $styleSourceSelections,
  $props,
  // OrganizeOS fork: "Delete unused" skips names in project custom code (builder/features/variables).
  $projectSettings,
} from "~/shared/sync/data-stores";
import {
  findCssVariableUsagesByInstance,
  getCssVariableDefinitionsByVariable,
  getDefinedCssVariableNames,
  getReferencedCssVariables,
  getUnusedCssVariableNames,
  validateCssVariableNameWithStyles,
} from "@webstudio-is/project-build/runtime";
import { type CssVariableNameError } from "@webstudio-is/project-build/runtime";
import { executeRuntimeMutation } from "~/shared/instance-utils/data";
// OrganizeOS fork: Cmd+K rename and delete of a Global Root variable go through the Variables operations; the Brand and band names are protected (builder/features/variables).
import {
  getCssVariableDeleteRefusal,
  routeCssVariableDelete,
  routeCssVariableRename,
  withoutKeptCssVariables,
} from "~/builder/features/variables/operations";

const $isDeleteUnusedCssVariablesDialogOpen = atom(false);

export const openDeleteUnusedCssVariablesDialog = () => {
  $isDeleteUnusedCssVariablesDialogOpen.set(true);
};

const $cssVariableUsageData = computed(
  [$styleSourceSelections, $styles, $props],
  (styleSourceSelections, styles, props) => {
    return findCssVariableUsagesByInstance({
      styleSourceSelections: styleSourceSelections.values(),
      styles: styles.values(),
      props: props.values(),
    });
  }
);

export const $usedCssVariablesInInstances = computed(
  $cssVariableUsageData,
  (data) => data.counts
);

export const $cssVariableInstancesByVariable = computed(
  $cssVariableUsageData,
  (data) => data.instances
);

// Get all defined CSS variables (unique properties that start with --)
export const $definedCssVariables = computed($styles, (styles) => {
  return getDefinedCssVariableNames(styles.values()) as Set<CustomProperty>;
});

// Map CSS variables to the instances where they are defined
export const $cssVariableDefinitionsByVariable = computed(
  [$styleSourceSelections, $styles],
  (styleSourceSelections, styles) => {
    return getCssVariableDefinitionsByVariable({
      styleSourceSelections: styleSourceSelections.values(),
      styles: styles.values(),
    });
  }
);

// Get all referenced CSS variables (from both styles and HTML Embed code props)
export const $referencedCssVariables = computed(
  [$styles, $props],
  (styles, props) => {
    return getReferencedCssVariables({
      styles: styles.values(),
      props: props.values(),
    });
  }
);

// Get all unused CSS variables (defined in instances but not referenced)
export const $unusedCssVariables = computed(
  // OrganizeOS fork: never offers a protected name or one in custom code (builder/features/variables).
  [
    $cssVariableDefinitionsByVariable,
    $referencedCssVariables,
    $projectSettings,
  ],
  (definitionsByVariable, referencedVariables, projectSettings) => {
    return withoutKeptCssVariables(
      getUnusedCssVariableNames({
        definitionsByVariable,
        referencedVariables,
      }),
      projectSettings?.meta.code
    );
  }
);

export const validateCssVariableName = (
  name: string,
  currentProperty?: string
) =>
  validateCssVariableNameWithStyles({
    name,
    currentProperty,
    styles: $styles.get().values(),
  });

export const renameCssVariable = (
  oldProperty: string,
  newProperty: string
): CssVariableNameError | undefined => {
  // OrganizeOS fork: a Global Root variable is renamed by the Variables operations (builder/features/variables).
  const routed = routeCssVariableRename(oldProperty, newProperty);
  if (routed !== "upstream") {
    return routed;
  }
  const validationError = validateCssVariableName(newProperty, oldProperty);
  if (validationError) {
    return validationError;
  }

  executeRuntimeMutation({
    id: "cssVariables.rename",
    input: {
      oldName: oldProperty,
      newName: newProperty,
    },
  });

  return;
};

export const deleteCssVariable = (property: string) => {
  // OrganizeOS fork: a Global Root variable is deleted by the Variables operations (builder/features/variables).
  if (routeCssVariableDelete([property]) !== undefined) {
    return;
  }
  executeRuntimeMutation({
    id: "cssVariables.delete",
    input: {
      names: [property],
      force: true,
    },
  });
};

// OrganizeOS fork: undefined when a routed commit did not land; its error toast already showed (builder/features/variables).
export const deleteUnusedCssVariables = (): number | undefined => {
  const unusedVariables = $unusedCssVariables.get();

  if (unusedVariables.size === 0) {
    return 0;
  }

  // OrganizeOS fork: one staged transaction when a Global Root variable is among them (builder/features/variables).
  const routed = routeCssVariableDelete(Array.from(unusedVariables));
  if (routed !== undefined) {
    return routed === 0 ? undefined : routed;
  }

  executeRuntimeMutation({
    id: "cssVariables.delete",
    input: {
      names: Array.from(unusedVariables),
      force: true,
    },
  });

  return unusedVariables.size;
};

type DeleteCssVariableDialogProps = {
  cssVariable?: { property: string };
  onClose: () => void;
  onConfirm: (property: string) => void;
};

export const DeleteCssVariableDialog = ({
  cssVariable,
  onClose,
  onConfirm,
}: DeleteCssVariableDialogProps) => {
  // OrganizeOS fork: a refusal shows here and keeps the dialog open, so the caller's success toast never runs (builder/features/variables).
  const [error, setError] = useState<string>();
  useEffect(() => {
    setError(undefined);
  }, [cssVariable?.property]);
  return (
    <Dialog
      open={cssVariable !== undefined}
      onOpenChange={(isOpen) => {
        if (isOpen === false) {
          onClose();
        }
      }}
    >
      <DialogContent
        onKeyDown={(event) => {
          // Prevent command panel from handling keyboard events
          event.stopPropagation();
        }}
      >
        <DialogTitle>Delete confirmation</DialogTitle>
        <PanelContent as={Flex} gap="3" direction="column">
          <Text>{`Delete CSS variable "${cssVariable?.property}" from the project?`}</Text>
          {/* OrganizeOS fork: the refusal line (builder/features/variables). */}
          {error && <Text color="destructive">{error}</Text>}
        </PanelContent>
        <DialogActions>
          <Button
            autoFocus
            color="destructive"
            onClick={() => {
              // OrganizeOS fork: refuse, or run the routed delete here, before onConfirm toasts success (builder/features/variables).
              const refusal = getCssVariableDeleteRefusal([
                cssVariable!.property,
              ]);
              if (refusal) {
                setError(refusal);
                return;
              }
              if (routeCssVariableDelete([cssVariable!.property]) === 0) {
                setError("Can't delete this variable");
                return;
              }
              onConfirm(cssVariable!.property);
              onClose();
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
};

type RenameCssVariableDialogProps = {
  cssVariable?: { property: string };
  onClose: () => void;
  onConfirm: (oldProperty: string, newProperty: string) => void;
};

export const RenameCssVariableDialog = ({
  cssVariable,
  onClose,
  onConfirm,
}: RenameCssVariableDialogProps) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  // Reset name and clear error when cssVariable changes
  useEffect(() => {
    if (cssVariable?.property !== undefined) {
      setName(cssVariable.property);
      setError(undefined);
    }
  }, [cssVariable?.property]);

  const handleConfirm = () => {
    const renameError = renameCssVariable(cssVariable!.property, name);
    if (renameError) {
      setError(renameError.message);
      return;
    }
    onConfirm(cssVariable!.property, name);
    onClose();
  };

  return (
    <Dialog
      open={cssVariable !== undefined}
      onOpenChange={(isOpen) => {
        if (isOpen === false) {
          onClose();
        }
      }}
    >
      <DialogContent
        onKeyDown={(event) => {
          // Prevent command panel from handling keyboard events
          event.stopPropagation();
          if (event.key === "Enter" && !error) {
            handleConfirm();
          }
        }}
      >
        <DialogTitle>Rename CSS variable</DialogTitle>
        <PanelContent as={Flex} gap="3" direction="column">
          <Flex direction="column" gap="1">
            <InputField
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(undefined);
              }}
              color={error ? "error" : undefined}
            />
            {error && (
              <Text color="destructive" variant="monoBold">
                {error}
              </Text>
            )}
          </Flex>
        </PanelContent>
        <DialogActions>
          <Button color="primary" onClick={handleConfirm}>
            Rename
          </Button>
          <DialogClose>
            <Button color="ghost">Cancel</Button>
          </DialogClose>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
};

const DeleteUnusedCssVariablesDialogContent = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const unusedVariables = useStore($unusedCssVariables);
  // Convert Set to Array for display
  const unusedVariablesArray = Array.from(unusedVariables);
  // OrganizeOS fork: a refusal shows here instead of deleting (builder/features/variables).
  const [error, setError] = useState<string>();

  return (
    <>
      <PanelContent as={Flex} gap="3" direction="column">
        {unusedVariablesArray.length === 0 ? (
          <Text>There are no unused CSS variables to delete.</Text>
        ) : (
          <>
            <Text>
              Delete {unusedVariablesArray.length} unused CSS{" "}
              {unusedVariablesArray.length === 1 ? "variable" : "variables"}{" "}
              from the project?
            </Text>
            <Text
              variant="mono"
              css={{
                maxHeight: 200,
                overflowY: "auto",
                backgroundColor: cssVar("--background-primary"),
                borderRadius: theme.borderRadius[4],
                wordBreak: "break-word",
              }}
            >
              {unusedVariablesArray.join(", ")}
            </Text>
          </>
        )}
        {/* OrganizeOS fork: the refusal line (builder/features/variables). */}
        {error && <Text color="destructive">{error}</Text>}
      </PanelContent>
      <DialogActions>
        {unusedVariablesArray.length > 0 && (
          <Button
            color="destructive"
            autoFocus
            onClick={() => {
              // OrganizeOS fork: refuse in the dialog; a routed commit that did not land toasts only its error (builder/features/variables).
              const refusal = getCssVariableDeleteRefusal(unusedVariablesArray);
              if (refusal) {
                setError(refusal);
                return;
              }
              const deletedCount = deleteUnusedCssVariables();
              onClose();
              if (deletedCount === undefined) {
                return;
              }
              if (deletedCount === 0) {
                toast.info("No unused CSS variables to delete");
              } else {
                toast.success(
                  `Deleted ${deletedCount} unused CSS ${deletedCount === 1 ? "variable" : "variables"}`
                );
              }
            }}
          >
            Delete
          </Button>
        )}
        <DialogClose>
          <Button color="ghost">
            {unusedVariablesArray.length > 0 ? "Cancel" : "Close"}
          </Button>
        </DialogClose>
      </DialogActions>
    </>
  );
};

export const DeleteUnusedCssVariablesDialog = () => {
  const open = useStore($isDeleteUnusedCssVariablesDialogOpen);
  const handleClose = () => {
    $isDeleteUnusedCssVariablesDialogOpen.set(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen === false) {
          handleClose();
        }
      }}
    >
      <DialogContent
        width={400}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
      >
        <DialogTitle>Delete unused CSS variables</DialogTitle>
        <DeleteUnusedCssVariablesDialogContent onClose={handleClose} />
      </DialogContent>
    </Dialog>
  );
};
