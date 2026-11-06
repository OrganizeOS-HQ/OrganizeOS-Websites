import type { WebstudioFragment } from "@webstudio-is/sdk";

/**
 * A fragment with each selection's local style sources moved ahead of its
 * tokens, each group in its own order. The cascade applies a selection's
 * sources in order, the last winning, so a token beats the element's own
 * declarations: what the OrganizeOS blocks and site templates were drawn
 * with, so a site template's block token (`blockTokens`) restyles a block.
 * 0.309.0's renderer lists tokens first (upstream #6408). Applied where an
 * OrganizeOS fragment is made (`site-templates/render.ts`) and inserted (the
 * builder's `completeOrganizeosFragment`); applying it twice changes nothing.
 */
export const localStylesFirst = (
  fragment: WebstudioFragment
): WebstudioFragment => {
  const local = new Set(
    fragment.styleSources.flatMap((source) =>
      source.type === "local" ? [source.id] : []
    )
  );
  return {
    ...fragment,
    styleSourceSelections: fragment.styleSourceSelections.map((selection) => ({
      ...selection,
      values: [
        ...selection.values.filter((id) => local.has(id)),
        ...selection.values.filter((id) => local.has(id) === false),
      ],
    })),
  };
};
