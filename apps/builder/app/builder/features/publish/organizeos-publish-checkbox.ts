import type { CSS } from "@webstudio-is/design-system";

/**
 * Brand accent placeholder for a ticked address in the Publish popup. The
 * builder's own accent (`--theme-color-accent`, organizeos-colors.css) is too
 * light for a white check mark (about 2.9:1); this teal gives about 3.8:1.
 * The brand pass swaps this one value.
 */
export const BRAND_ACCENT = "#0d9488";

/** The check mark on the accent fill. */
const ON_BRAND_ACCENT = "#ffffff";

/**
 * A ticked checkbox reads as active: accent fill, light check mark. The
 * design-system Checkbox reports the state as `data-state` (from
 * `aria-checked`), so that is the hook.
 */
export const tickedCheckboxCss: CSS = {
  '&[data-state="checked"]': {
    background: BRAND_ACCENT,
    color: ON_BRAND_ACCENT,
    borderColor: BRAND_ACCENT,
  },
  // hover and focus keep a visible edge on the filled box
  '&[data-state="checked"]:hover': {
    borderColor: ON_BRAND_ACCENT,
  },
  '&[data-state="checked"]:focus-visible': {
    borderColor: ON_BRAND_ACCENT,
    outline: `2px solid ${BRAND_ACCENT}`,
    outlineOffset: 1,
  },
  // disabled: dimmed fill, the check mark stays light
  '&[data-state="checked"]:disabled': {
    opacity: 0.5,
    color: ON_BRAND_ACCENT,
  },
};
