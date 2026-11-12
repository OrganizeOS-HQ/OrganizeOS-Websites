import type { ReactNode } from "react";
import {
  Box,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Flex,
  SearchField,
  Text,
  theme,
} from "@webstudio-is/design-system";
import { toValue, type StyleValue } from "@webstudio-is/css-engine";
import { variableTypes, type VariableType } from "@webstudio-is/project-build";
import { firstFontFamily } from "@organizeos/site-components/site-templates/canonical-variables";
import { VARIABLE_TYPE_LABELS, validateVariableValue } from "./value-types";

const defaults: Record<Exclude<VariableType, "fontFamily">, string> = {
  color: "#000000",
  size: "16px",
  percentage: "100%",
  number: "1",
};

/**
 * A new variable's value (spec 5.4): black, 16px, 100% and 1; for a font,
 * the body font's first family, else System UI.
 */
export const newVariableValue = (
  type: VariableType,
  bodyFont: StyleValue | undefined
): StyleValue => {
  const text =
    type === "fontFamily"
      ? ((bodyFont === undefined
          ? undefined
          : firstFontFamily(toValue(bodyFont))) ?? "System UI")
      : defaults[type];
  const validated = validateVariableValue(type, text);
  return validated.ok ? validated.value : { type: "unparsed", value: text };
};

/** The New variable menu, in the toolbar and on the table's last row. */
export const NewVariableMenu = ({
  onNewVariable,
  children,
}: {
  onNewVariable: (type: VariableType) => void;
  children: ReactNode;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      // the draft row's name field takes the focus, not the trigger
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      {variableTypes.map((type) => (
        <DropdownMenuItem key={type} onSelect={() => onNewVariable(type)}>
          {VARIABLE_TYPE_LABELS[type]}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

/**
 * The toolbar (spec 5.4): the collection's name, search, Select and New
 * variable. Select and New variable are not offered on Brand or read-only.
 */
export const VariablesToolbar = ({
  name,
  canAdd,
  search,
  onSearchChange,
  onNewVariable,
  selectControl,
}: {
  name: string;
  canAdd: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  onNewVariable: (type: VariableType) => void;
  /** Select, or the bulk actions while selecting (Task 5) */
  selectControl?: ReactNode;
}) => (
  // A narrow overlay wraps the row rather than cutting a label: the title
  // truncates, the search shrinks to a floor, the buttons keep their width.
  <Flex
    data-variables-toolbar
    align="center"
    gap="2"
    wrap="wrap"
    css={{
      minHeight: theme.spacing[15],
      flexShrink: 0,
      px: theme.spacing[9],
      py: theme.spacing[3],
      "& button": { flexShrink: 0 },
    }}
  >
    <Text
      variant="titles"
      truncate
      css={{ flex: `1 1 ${theme.spacing[19]}`, minWidth: theme.spacing[19] }}
    >
      {name}
    </Text>
    {/* InputField puts css on its input too, so the box sizes the field */}
    <Box
      css={{ flex: `0 1 ${theme.spacing[31]}`, minWidth: theme.spacing[23] }}
    >
      <SearchField
        placeholder="Search variables"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        onAbort={() => onSearchChange("")}
      />
    </Box>
    {canAdd && selectControl}
    {canAdd && (
      <NewVariableMenu onNewVariable={onNewVariable}>
        <Button>New variable</Button>
      </NewVariableMenu>
    )}
  </Flex>
);
