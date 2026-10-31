import { $, type TemplateStyleDecl } from "@webstudio-is/template";
import { type SiteLink, footer, linkProps, nav, sample } from "../../kit";
import type { PageContext } from "../../types";
import { LOOK, invertedButtonStyles } from "./styles";

// Riso Broadside's shared pieces: the nav and footer, and its one ask. One
// page, one goal: every button is "Add your name", to the form
// (`#sign-up`), and the nav's and footer's links are the page's own anchors.
// Each is a function returning fresh JSX.

export type PageIds = PageContext["pageIds"];

/** The one ask: the form, on this page. */
export const ADD_YOUR_NAME: SiteLink = {
  label: "Add your name",
  href: "#sign-up",
};

/** The ask as a square button on a blue field, in the base colour. */
export const invertedButton = (
  pageIds: PageIds,
  styles: TemplateStyleDecl[] = []
): JSX.Element => (
  <$.Link
    ws:label="Button"
    {...linkProps(pageIds, ADD_YOUR_NAME)}
    ws:style={[...invertedButtonStyles(), ...styles]}
  >
    {ADD_YOUR_NAME.label}
  </$.Link>
);

/** Nav: Centered, with the page's anchors and the one button. */
export const siteNav = (pageIds: PageIds): JSX.Element =>
  nav({
    pageIds,
    variant: "centered",
    links: [
      { label: "Why", href: "#why" },
      { label: "FAQ", href: "#faq" },
    ],
    cta: ADD_YOUR_NAME,
    ...LOOK,
  });

/**
 * Footer: Simple, its links the page's anchors, with no rule above it: the
 * page ends on the share band, whose edge the rule would only seam.
 */
export const siteFooter = (pageIds: PageIds, tagline: string): JSX.Element =>
  footer({
    pageIds,
    tagline: sample(tagline),
    links: [
      { label: "Why", href: "#why" },
      { label: "FAQ", href: "#faq" },
      ADD_YOUR_NAME,
    ],
    topRule: false,
  });
