import { css, token } from "@webstudio-is/template";

// Neutral styles through shared tokens: every OrganizeOS form block uses the
// same seven, so restyling a token restyles every block on the site. A project
// that has more than one such block reuses one token each (the insert resolves
// a token it already has with "ours"), so the Signup Form and the RSVP Form
// take them from here and cannot drift apart.
//
// The colours that are roles read the site's canonical variables (`--base`,
// `--accent-1`, `--accent-2`, `--text`, see site-templates/canonical-variables)
// with the old literal as the fallback, so a site that defines none looks as it
// did. The names are written out here: this file does not import the module
// that lists them.
//
// An input's resting border is `--text` too: a field's edge needs 3:1 against
// what is around it (WCAG 1.4.11), and `--text` on `--base` is held to 4.5:1,
// where the old grey was about 1.3:1 on a cream base and did not follow a dark
// one.
//
// A message and an invalid field's border read `--text` too: a fixed red fails
// 3:1 on some site backgrounds (about 1.9:1 on a deep green), and `--text` on
// `--base` is already held to 4.5:1. The invalid state is then marked by
// weight (the message) and width (the border), not by colour alone; the
// padding gives up the border's extra pixel, so the field keeps its size. The
// focus ring and the borders' colours are longhands (`border-color` too is a
// shorthand): a shorthand resolves a `var()` that has a fallback to the
// fallback when it is parsed.
//
// Template-only: nothing a published site's copy of the package reaches
// imports this file.

// The form's heading: the site's heading font, with no fallback (on a site
// without the variable the font is inherited, as before), its lines set as a
// heading's, so one that wraps on a phone does not take the body's looser
// line height. A token, so a site template sets its case and size
// (SiteTemplate.blockTokens).
export const formHeadingToken = token(
  "OS Form Heading",
  css`
    font-family: var(--font-heading);
    line-height: 1.2;
  `
);

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
    border-width: 1px;
    border-style: solid;
    border-top-color: var(--text, #d4d4d8);
    border-right-color: var(--text, #d4d4d8);
    border-bottom-color: var(--text, #d4d4d8);
    border-left-color: var(--text, #d4d4d8);
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
      padding: 7px 11px;
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

// The state boxes: a tinted box in the site's body font (no fallback, as "OS
// Form Heading" reads the heading font), its text `--text`. The tint is a mix
// of an accent into the base, a longhand background colour: the template's
// CSS parser keeps a `color-mix()` as unparsed text, so the variables and
// their fallbacks reach the published CSS. Success takes the second accent,
// Error the first, and Error is also marked by a left border and weight, so
// it is not told apart by colour alone.
export const successMessageToken = token(
  "OS Success Message",
  css`
    padding: 12px 16px;
    border-radius: 6px;
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.4;
    color: var(--text, #18181b);
    background-color: color-mix(
      in srgb,
      var(--accent-2, #2563eb) 10%,
      var(--base, #ffffff)
    );
  `
);

export const errorMessageToken = token(
  "OS Error Message",
  css`
    padding: 12px 16px;
    border-radius: 6px;
    border-left-width: 4px;
    border-left-style: solid;
    border-left-color: var(--text, #18181b);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--text, #18181b);
    background-color: color-mix(
      in srgb,
      var(--accent-1, #18181b) 10%,
      var(--base, #ffffff)
    );
  `
);

// Look A's card (builder forms spec 5.2): a form lands as a card on the site's
// base, with its text, so a section's own colours do not reach the fields. The
// edge is decorative, --text mixed 15% into --base (a longhand per side: the
// `border` shorthand would resolve the variables to their fallbacks), 12px
// round, its padding 32px or 7% of the card, whichever is smaller, so a narrow
// card keeps room for its fields. Restyling the token restyles every card on
// the site; removing it from one root gives that form the plain look.
export const formCardToken = token(
  "OS Form Card",
  css`
    max-width: 32rem;
    width: 100%;
    padding: min(32px, 7%);
    border-top-width: 1px;
    border-right-width: 1px;
    border-bottom-width: 1px;
    border-left-width: 1px;
    border-top-style: solid;
    border-right-style: solid;
    border-bottom-style: solid;
    border-left-style: solid;
    border-top-color: color-mix(
      in srgb,
      var(--text, #18181b) 15%,
      var(--base, #ffffff)
    );
    border-right-color: color-mix(
      in srgb,
      var(--text, #18181b) 15%,
      var(--base, #ffffff)
    );
    border-bottom-color: color-mix(
      in srgb,
      var(--text, #18181b) 15%,
      var(--base, #ffffff)
    );
    border-left-color: color-mix(
      in srgb,
      var(--text, #18181b) 15%,
      var(--base, #ffffff)
    );
    border-radius: 12px;
    background-color: var(--base, #ffffff);
    color: var(--text, #18181b);
  `
);

// The card's one line of intro under its heading: the site's body font.
export const formIntroToken = token(
  "OS Form Intro",
  css`
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.5;
    color: var(--text, #18181b);
  `
);
