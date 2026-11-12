import {
  BAND_VARIABLES,
  CANONICAL_COLOR_NAMES,
  CANONICAL_FONT_NAMES,
} from "@organizeos/site-components/site-templates/canonical-variables";

/**
 * CSS names of the Variables manager (spec 4.4). Every name here is written
 * without the leading `--`, as the registry stores it. A CSS name is never
 * uppercase: css-engine hyphenates an uppercase letter in a declared property
 * while var() references print verbatim, so a mixed-case name would break
 * its own references.
 */

export const CANONICAL_CSS_NAMES = [
  ...CANONICAL_COLOR_NAMES,
  ...CANONICAL_FONT_NAMES,
] as const;

export const BAND_CSS_NAMES = BAND_VARIABLES;

type CanonicalCssName = (typeof CANONICAL_CSS_NAMES)[number];

export const BRAND_DISPLAY_NAMES: Record<CanonicalCssName, string> = {
  base: "Base",
  "accent-1": "Accent 1",
  "accent-2": "Accent 2",
  text: "Text",
  "font-heading": "Heading font",
  "font-body": "Body font",
};

const protectedNames = new Set<string>([
  ...CANONICAL_CSS_NAMES,
  ...BAND_CSS_NAMES,
]);

/** The six canonical names and the two band names. */
export const isProtectedName = (cssName: string) => protectedNames.has(cssName);

/**
 * A name 4.4 could produce: lowercase letters and digits, joined by single
 * hyphens or by `--` group separators.
 */
export const CSS_NAME_PATTERN = /^[a-z0-9]+(?:--?[a-z0-9]+)*$/;

/**
 * "Spacing/Large" becomes "spacing--large", "Brand Blue" "brand-blue". Never
 * empty: a name with nothing left becomes "variable".
 */
export const slugifyDisplayName = (displayName: string) => {
  const parts = displayName
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split("/")
    .map((part) => part.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter((part) => part !== "");
  return parts.length === 0 ? "variable" : parts.join("--");
};

/** `base`, else `base-2`, `base-3`...: never taken, never protected. */
export const uniqueCssName = (base: string, taken: ReadonlySet<string>) => {
  const isFree = (name: string) =>
    taken.has(name) === false && isProtectedName(name) === false;
  if (isFree(base)) {
    return base;
  }
  let suffix = 2;
  while (isFree(`${base}-${suffix}`) === false) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

/** "spacing--large" becomes "spacing/large": a `--` is a group separator. */
export const displayNameFromCssName = (cssName: string) =>
  cssName.split("--").join("/");
