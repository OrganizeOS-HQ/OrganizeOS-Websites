import { forwardRef } from "react";
import {
  theme,
  cssVar,
  IconButton,
  Tooltip,
  styled,
} from "@webstudio-is/design-system";
import { ChevronLeftIcon } from "@webstudio-is/icons";

// The pieces the Templates screen and the New page screen share: cards with
// a 16:10 picture and a name, and the back button of a view opened from a
// card (OrganizeOS design
// `2026-11-13-builder-templates-screen-and-page-templates-design.md`
// sections 5 and 6.1).

/** As many columns as fit, of at least 224px or the whole row. */
export const PageGrid = styled("div", {
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(min(${theme.spacing[29]}, 100%), 1fr))`,
  gap: theme.spacing[9],
});

export const CardButton = styled("button", {
  all: "unset",
  boxSizing: "border-box",
  display: "grid",
  alignContent: "start",
  gap: theme.spacing[3],
  minWidth: 0,
  padding: theme.spacing[3],
  borderRadius: theme.borderRadius[4],
  border: `1px solid ${cssVar("--border-default")}`,
  cursor: "pointer",
  "&:hover": { borderColor: cssVar("--border-focus") },
  "&:focus-visible": {
    outline: `1px solid ${cssVar("--border-focus")}`,
    outlineOffset: 1,
  },
  "&:disabled": {
    cursor: "default",
    opacity: 0.5,
    borderColor: cssVar("--border-default"),
  },
});

const pictureStyle = {
  display: "block",
  width: "100%",
  aspectRatio: "16 / 10",
  borderRadius: theme.borderRadius[2],
  background: cssVar("--background-secondary"),
} as const;

export const Picture = styled("img", { ...pictureStyle, objectFit: "cover" });

export const EmptyFrame = styled("div", pictureStyle);

export const Figure = styled("figure", {
  display: "grid",
  alignContent: "start",
  gap: theme.spacing[3],
  minWidth: 0,
  margin: 0,
});

export const Caption = styled("figcaption", { minWidth: 0 });

/** Back to the grid: an icon button with its name in a tooltip. */
export const BackButton = forwardRef<
  HTMLButtonElement,
  { onClick: () => void }
>(({ onClick }, ref) => (
  <Tooltip content="Back" side="bottom">
    <IconButton ref={ref} aria-label="Back" onClick={onClick}>
      <ChevronLeftIcon />
    </IconButton>
  </Tooltip>
));
BackButton.displayName = "BackButton";
