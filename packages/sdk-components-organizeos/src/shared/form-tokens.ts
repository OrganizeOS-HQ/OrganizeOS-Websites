import { css, token } from "@webstudio-is/template";

// Neutral styles through shared tokens: every OrganizeOS form block uses the
// same four, so restyling a token restyles every block on the site. A project
// that has more than one such block reuses one token each (the insert resolves
// a token it already has with "ours"), so the Signup Form and the RSVP Form
// take them from here and cannot drift apart.
//
// The colours that are roles read the site's canonical variables (`--base`,
// `--accent-1`, `--accent-2`, `--text`, see site-templates/canonical-variables)
// with the old literal as the fallback, so a site that defines none looks as it
// did. The names are written out here: this file does not import the module
// that lists them. The resting borders are not roles and stay literal.
//
// A message and an invalid field's border read `--text` too: a fixed red fails
// 3:1 on some site backgrounds (about 1.9:1 on a deep green), and `--text` on
// `--base` is already held to 4.5:1. The invalid state is then marked by
// weight (the message) and width (the border), not by colour alone. The
// focus ring and the invalid border's colour are longhands (`border-color`
// too is a shorthand): a shorthand resolves a `var()` that has a fallback to
// the fallback when it is parsed.
//
// Template-only: nothing a published site's copy of the package reaches
// imports this file.

export const fieldToken = token(
  "OS Field",
  css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `
);

export const inputToken = token(
  "OS Input",
  css`
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d4d4d8;
    border-radius: 6px;
    background-color: var(--base, #ffffff);
    color: var(--text, #18181b);
    font-size: 16px;
    line-height: 1.5;
    &:focus-visible {
      outline-width: 2px;
      outline-style: solid;
      outline-color: var(--accent-2, #2563eb);
      outline-offset: 1px;
    }
    &[data-invalid] {
      border-width: 2px;
      border-style: solid;
      border-top-color: var(--text, #dc2626);
      border-right-color: var(--text, #dc2626);
      border-bottom-color: var(--text, #dc2626);
      border-left-color: var(--text, #dc2626);
    }
  `
);

export const buttonToken = token(
  "OS Button",
  css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    border: 0;
    border-radius: 6px;
    background-color: var(--accent-1, #18181b);
    color: var(--base, #ffffff);
    font-size: 16px;
    font-weight: 600;
    line-height: 1.5;
    cursor: pointer;
    &:focus-visible {
      outline-width: 2px;
      outline-style: solid;
      outline-color: var(--accent-2, #2563eb);
      outline-offset: 2px;
    }
    &[data-state="submitting"] {
      opacity: 0.6;
      cursor: progress;
    }
  `
);

export const messageToken = token(
  "OS Message",
  css`
    font-size: 14px;
    line-height: 1.4;
    color: var(--text, #52525b);
    &[data-invalid] {
      color: var(--text, #b91c1c);
      font-weight: 600;
    }
  `
);
