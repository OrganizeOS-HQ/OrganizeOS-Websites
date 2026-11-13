/**
 * The header of the field sheet and the collection settings, drawn as the
 * item editor's: Back, the crumb "{Collection} / {Name}", then the actions,
 * with the rarer ones in a "..." menu.
 */
import type { ReactNode, RefObject } from "react";
import {
  Box,
  cssVar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Flex,
  IconButton,
  ScrollAreaNative,
  Text,
  theme,
  Tooltip,
} from "@webstudio-is/design-system";
import { ChevronLeftIcon, EllipsesIcon } from "@webstudio-is/icons";
import { TruncatedText } from "./truncated-text";

/** 448 px of controls plus padding, as the item editor's column. */
const columnMaxWidth = `calc(${theme.spacing[35]} + 2 * ${theme.spacing[9]})`;

export const StructureHeader = ({
  backRef,
  collectionName,
  name,
  actions,
  menu,
  menuLabel = "",
  onBack,
}: {
  backRef?: RefObject<HTMLButtonElement>;
  collectionName: string;
  name: string;
  actions: ReactNode;
  /** The "..." menu's items, or nothing for no menu. */
  menu?: ReactNode;
  /** The "..."'s name and tooltip: "Collection menu", "Field menu". */
  menuLabel?: string;
  onBack: () => void;
}) => (
  <Flex
    align="center"
    gap="2"
    data-cms-structure-header
    css={{
      height: theme.spacing[15],
      flexShrink: 0,
      paddingLeft: theme.spacing[5],
      paddingRight: theme.panel.paddingInline,
      borderBottom: `1px solid ${cssVar("--border-default")}`,
    }}
  >
    <Tooltip content="Back" side="bottom">
      <IconButton ref={backRef} aria-label="Back" onClick={onBack}>
        <ChevronLeftIcon />
      </IconButton>
    </Tooltip>
    <Flex
      align="center"
      gap="1"
      data-cms-crumb
      css={{ minWidth: 0, flexGrow: 1 }}
    >
      <TruncatedText
        variant="titles"
        css={{ flex: "0 4 auto", maxWidth: "40%", minWidth: 0 }}
      >
        {collectionName}
      </TruncatedText>
      <Text variant="titles" css={{ flexShrink: 0 }}>
        /
      </Text>
      <TruncatedText variant="titles" css={{ flex: "0 1 auto", minWidth: 0 }}>
        {name}
      </TruncatedText>
    </Flex>
    <Flex align="center" gap="2" css={{ flexShrink: 0 }}>
      {menu !== undefined && menu !== null && menu !== false && (
        <DropdownMenu modal={false}>
          <Tooltip content={menuLabel} side="bottom">
            <DropdownMenuTrigger asChild>
              <IconButton aria-label={menuLabel}>
                <EllipsesIcon />
              </IconButton>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
        </DropdownMenu>
      )}
      {actions}
    </Flex>
  </Flex>
);

/** The scrolling body: one centred column of controls. */
export const StructureBody = ({ children }: { children: ReactNode }) => (
  <ScrollAreaNative css={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
    <Box
      css={{
        maxWidth: columnMaxWidth,
        marginInline: "auto",
        paddingInline: theme.spacing[9],
        paddingBlock: theme.spacing[11],
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: theme.spacing[5],
      }}
    >
      {children}
    </Box>
  </ScrollAreaNative>
);
