import { forwardRef, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  PanelTitle,
  Tooltip,
  cssVar,
  styled,
  theme,
} from "@webstudio-is/design-system";
import { EllipsesIcon, XIcon } from "@webstudio-is/icons";
import type { CmsDeepLink } from "../cms-panel";

/**
 * The native CMS screen (OrganizeOS design
 * docs/superpowers/specs/2026-11-07-native-cms-in-the-builder-design.md,
 * 4.3). It holds the overlay's mechanics and "Classic CMS" until the
 * screen's regions are added.
 *
 * It takes its callbacks as props, so this folder imports cms-panel.tsx for
 * types only.
 */

const Root = styled("div", {
  width: "100%",
  height: "100%",
  outline: "none",
  color: cssVar("--foreground-primary"),
});

const Column = styled("div", {
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  width: theme.sizes.sidebarWidth,
  height: "100%",
  borderRight: `1px solid ${cssVar("--border-default")}`,
});

const Main = styled("div", {
  flexGrow: 1,
  minWidth: 0,
  height: "100%",
});

export const CmsNativeScreen = forwardRef<
  HTMLDivElement,
  {
    hidden: boolean;
    onClose: () => void;
    onShowClassic: (deepLink: CmsDeepLink) => void;
  }
>(({ hidden, onClose, onShowClassic }, ref) => {
  // The menu's choice runs once the menu has closed, so the focus it moves
  // is not taken back by the menu.
  const classicChosen = useRef(false);
  return (
    <Root
      ref={ref}
      data-cms-native-screen
      data-floating-panel-container
      tabIndex={-1}
      style={{ display: hidden ? "none" : "flex" }}
    >
      <Column>
        <PanelTitle
          suffix={
            <>
              <DropdownMenu
                onOpenChange={(open) => {
                  if (open === false && classicChosen.current) {
                    onShowClassic({});
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <IconButton aria-label="CMS menu">
                    <EllipsesIcon />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onCloseAutoFocus={(event) => {
                    // The trigger is hidden behind the frame; focus stays there.
                    if (classicChosen.current) {
                      classicChosen.current = false;
                      event.preventDefault();
                    }
                  }}
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      classicChosen.current = true;
                    }}
                  >
                    Classic CMS
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip content="Close">
                <IconButton aria-label="Close" onClick={onClose}>
                  <XIcon />
                </IconButton>
              </Tooltip>
            </>
          }
        >
          CMS
        </PanelTitle>
      </Column>
      <Main data-cms-native-main />
    </Root>
  );
});
CmsNativeScreen.displayName = "CmsNativeScreen";
