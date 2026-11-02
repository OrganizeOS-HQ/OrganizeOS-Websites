import { fontWeightNames } from "@webstudio-is/fonts";

// OrganizeOS fork (fork doc section 7): a font with no typographic family
// name (name ID 16), as the @fontsource files are, keeps an instance in its
// legacy family name: a variable font's default ("Public Sans Thin"), a static
// weight beside Regular and Bold ("Barlow Medium", subfamily "Regular"), an
// optical size ("Newsreader 16pt"). getFontData reads that name, so these
// came out as families of their own.

const isOpticalSize = (word: string) => /^\d+pt$/i.test(word);

/**
 * The first words of the two-word weights in the names list ("extra bold",
 * "semi bold", "ultra light"): before a weight word, they make one weight of
 * the two.
 */
const weightModifiers = new Set(
  Array.from(fontWeightNames.keys()).flatMap((name) =>
    name.includes(" ") ? [name.split(" ")[0]] : []
  )
);

/**
 * How many of the last words name the weight: two for a modifier and a
 * weight word ("Extra Bold", "Ultra Black"), else one.
 */
const countWeightWords = (words: string[]) =>
  words.length > 1 &&
  weightModifiers.has(words[words.length - 2].toLowerCase()) &&
  fontWeightNames.has(words[words.length - 1].toLowerCase())
    ? 2
    : 1;

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
 * A two-word weight ("Extra Bold") is one weight: both words go, or neither,
 * so "Foo Extra Bold" at 700 keeps its name rather than losing "Bold" alone.
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
  const count = countWeightWords(words);
  const name = words.slice(-count).join("").toLowerCase();
  const weight = Number(fontWeightNames.get(name));
  if (words.length > count && weight === weightClass) {
    return {
      family: words.slice(0, -count).join(" "),
      ...(namesWeight(subfamily) ? {} : { weight }),
    };
  }
  return { family: words.join(" ") };
};
