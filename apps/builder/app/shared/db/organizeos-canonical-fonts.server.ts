import { toValue } from "@webstudio-is/css-engine";
import {
  type StyleDecl,
  type StyleSourceSelection,
  ROOT_INSTANCE_ID,
} from "@webstudio-is/sdk";
import {
  CANONICAL_FONT_NAMES,
  firstFontFamily,
} from "@organizeos/site-components/site-templates/canonical-variables";

const canonicalFontProperties = new Set<string>(
  CANONICAL_FONT_NAMES.map((name) => `--${name}`)
);

/**
 * The families a site's canonical fonts name first: `--font-heading` and
 * `--font-body` on Global Root, on any of its style sources and breakpoints
 * (OrganizeOS design 2026-10-30-website-template-inventory-design.md,
 * section 6.3). A publish keeps a font asset only when a style names its
 * family (canvas.server.ts), and these are custom properties, which no
 * `fontFamily` style carries, so a site template's bundled fonts, and fonts
 * the Site fonts control sets, would be left out without them.
 */
export const findCanonicalFontFamilies = ({
  styles,
  styleSourceSelections,
}: {
  styles: Iterable<StyleDecl>;
  styleSourceSelections: Iterable<StyleSourceSelection>;
}): Set<string> => {
  const rootStyleSourceIds = new Set<string>();
  for (const selection of styleSourceSelections) {
    if (selection.instanceId === ROOT_INSTANCE_ID) {
      for (const styleSourceId of selection.values) {
        rootStyleSourceIds.add(styleSourceId);
      }
    }
  }
  const families = new Set<string>();
  for (const decl of styles) {
    if (
      rootStyleSourceIds.has(decl.styleSourceId) &&
      canonicalFontProperties.has(decl.property)
    ) {
      const family = firstFontFamily(toValue(decl.value));
      if (family !== undefined) {
        families.add(family);
      }
    }
  }
  return families;
};
