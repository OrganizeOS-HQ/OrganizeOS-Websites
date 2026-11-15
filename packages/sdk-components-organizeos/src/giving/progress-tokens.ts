import { css, token } from "@webstudio-is/template";

// Goal Progress's tokens (OrganizeOS builder donations spec 2026-11-13, 7.3):
// restyling one restyles every bar on the site. The colours read the site's
// canonical variables with the old literals as fallbacks, as the form tokens
// do (shared/form-tokens.ts), each as a longhand: a shorthand resolves a var()
// that has a fallback to the fallback when it is parsed. The bar is
// decorative (aria-hidden); the figures carry the information.
//
// Template-only: nothing a published site's copy of the package reaches
// imports this file.

export const progressTrackToken = token(
  "OS Progress Track",
  css`
    height: 12px;
    border-radius: 999px;
    overflow: hidden;
    background-color: color-mix(
      in srgb,
      var(--text, #18181b) 15%,
      var(--base, #ffffff)
    );
  `
);

export const progressFillToken = token(
  "OS Progress Fill",
  css`
    height: 100%;
    width: var(--os-progress, 0%);
    background-color: var(--accent-1, #2563eb);
  `
);

export const progressLabelToken = token(
  "OS Progress Label",
  css`
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.5;
    color: var(--text, #18181b);
  `
);
