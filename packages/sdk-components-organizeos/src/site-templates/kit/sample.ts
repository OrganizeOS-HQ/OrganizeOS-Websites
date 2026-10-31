// Sample copy (spec section 2, rule 5) names what to replace in brackets:
// "[Organization name]", "[goal]". A placeholder that breaks across two lines
// reads as two broken words, so its spaces are no-break.

/**
 * Sample text whose [bracketed] placeholders keep together: the spaces in a
 * bracket are no-break, so "[Organization name]" never breaks across lines.
 * Keep each placeholder short enough to fit a 320px phone on one line.
 */
export const sample = (value: string): string =>
  value.replace(/\[[^\]]*\]/g, (placeholder) =>
    placeholder.replaceAll(" ", "\u00A0")
  );
