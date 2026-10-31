import { fontWeightNames } from "@webstudio-is/fonts";

// OrganizeOS fork (fork doc section 7): a font with no typographic family
// name (name ID 16), as the @fontsource files are, keeps an instance in its
// legacy family name: a variable font's default ("Public Sans Thin"), a static
// weight beside Regular and Bold ("Barlow Medium", subfamily "Regular"), an
// optical size ("Newsreader 16pt"). getFontData reads that name, so these
// came out as families of their own.

const isOpticalSize = (word: string) => /^\d+pt$/i.test(word);

/** Whether a subfamily names a weight other than the default, as "Bold" does. */
const namesWeight = (subfamily: string) => {
  const text = subfamily.toLowerCase();
  return Array.from(fontWeightNames.keys()).some(
    (name) => name !== "regular" && name !== "normal" && text.includes(name)
  );
};

/**
 * The family without the instance it names. An optical size ("16pt") is
 * dropped. A last weight word is dropped only when it is the weight the
 * font's OS/2 table declares, so "Archivo Black" at 400 keeps its name; that
 * weight is returned when the subfamily names none, for a static font to take.
 */
export const dropInstanceNames = ({
  family,
  subfamily,
  weightClass,
}: {
  family: string;
  subfamily: string;
  weightClass: undefined | number;
}): { family: string; weight?: number } => {
  const words = family
    .split(" ")
    .filter((word) => isOpticalSize(word) === false);
  if (words.length === 0) {
    return { family };
  }
  // "ExtraBold" is one word, "Extra Bold" two; the names list both unspaced
  for (const count of [2, 1]) {
    const name = words.slice(-count).join("").toLowerCase();
    const weight = Number(fontWeightNames.get(name));
    if (words.length > count && weight === weightClass) {
      return {
        family: words.slice(0, -count).join(" "),
        ...(namesWeight(subfamily) ? {} : { weight }),
      };
    }
  }
  return { family: words.join(" ") };
};
