import { css, ws, type TemplateStyleDecl } from "@webstudio-is/template";
import { $ } from "../../../shared/proxy";
import { BREAKPOINT, SPACE, keyed, section, text } from "../../kit";
import type { PageContext } from "../../types";
import { invertedButton } from "./parts";
import { displayStyles, leadStyles, stackStyles } from "./styles";

// Riso Broadside's hero (directions 2.5): the photo in blue duotone, full
// bleed, under the ask.

/** A full-size layer of the duotone that draws no content and takes no clicks. */
const layer = (label: string, styles: TemplateStyleDecl[]) => (
  <ws.element
    ws:tag="div"
    ws:label={label}
    ws:style={[
      ...css`
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        pointer-events: none;
      `,
      ...styles,
    ]}
  />
);

/**
 * Hero: Full-bleed image. The photo fills the section in blue duotone, the
 * board's photo multiplied with accent-1, and the ask, a sentence and the
 * one button sit centred over it in the base colour.
 *
 * The duotone lays the photo, in greys, from the darker to the lighter of
 * accent-1 and the text colour, channel by channel, in four layers under
 * the "Duotone" element. Light lifts the section's accent-1 to the lighter
 * of the two (`lighten`); the photo multiplies it, black to that colour;
 * Dark floor screens the darker of the two over it, so the photo's black
 * is that colour and its greys rise from it; and Light cap holds every
 * channel to the lighter of the two (`darken`). In the board's palette that
 * is the photo multiplied with accent-1, ink to blue; in a dark palette,
 * whose text is lighter than its accent-1, a light blue print on white.
 * The floor and the cap mix their two colours in their own backgrounds
 * (`background-blend-mode`). The "Duotone" element draws nothing and makes
 * no stacking context, so its layers blend with the section; the layers
 * over the photo take no clicks, so a click on the photo picks the Photo.
 *
 * Both ends are a checked pair with the base (base on accent-1, and text on
 * base), and every shade between lies between them in each channel, so
 * wherever the photo is light or dark the ask holds at least 4.5:1 against
 * what is behind it, given an accent-1 and a text colour of which one is
 * the lighter in every channel, as both palettes' are (hero.test.ts).
 *
 * With no photo, deleting the "Duotone" element leaves the section's own
 * plain accent-1 field, in any palette. A photo that fails to load leaves
 * the layers' light end, the lighter of the two colours: accent-1 in the
 * board's palette, the text colour in a dark one, both checked pairs with
 * the base text.
 *
 * The section is isolated, so the blends reach nothing outside it. The hero
 * is 4:5 on a portrait phone, its button full width, and square from 480px
 * to 767px but no taller than the window less the nav and the hero's
 * padding; it grows when its text needs more.
 */
export const hero = ({
  context,
  ask,
  sentence,
  position,
  phonePosition,
}: {
  context: PageContext;
  ask: string;
  sentence: string;
  position: string;
  phonePosition: string;
}): JSX.Element =>
  section({
    label: "Hero: Full-bleed image",
    background: "accent-1",
    styles: css`
      position: relative;
      isolation: isolate;
    `,
    children: keyed([
      <ws.element
        ws:tag="div"
        ws:label="Duotone"
        ws:style={css`
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
        `}
      >
        {layer(
          "Light",
          css`
            background-color: var(--text);
            mix-blend-mode: lighten;
          `
        )}
        <$.Image
          ws:label="Photo"
          src={context.image("hero.jpg")}
          alt={context.imageAlt("hero.jpg")}
          ws:style={css`
            position: absolute;
            top: 0;
            left: 0;
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: ${position};
            filter: grayscale(1);
            mix-blend-mode: multiply;
            ${BREAKPOINT.landscape} {
              object-position: ${phonePosition};
            }
          `}
        />
        {layer(
          "Dark floor",
          css`
            background-color: var(--accent-1);
            background-image: linear-gradient(var(--text), var(--text));
            background-blend-mode: darken;
            mix-blend-mode: screen;
          `
        )}
        {layer(
          "Light cap",
          css`
            background-color: var(--accent-1);
            background-image: linear-gradient(var(--text), var(--text));
            background-blend-mode: lighten;
            mix-blend-mode: darken;
          `
        )}
      </ws.element>,
      <ws.element
        ws:tag="div"
        ws:label="Text"
        ws:style={[
          ...stackStyles(SPACE[24], "center"),
          ...css`
            position: relative;
            justify-content: center;
            min-height: clamp(420px, 32vw + 180px, 660px);
            text-align: center;
            ${BREAKPOINT.landscape} {
              row-gap: ${SPACE[16]};
              min-height: min(calc(100vw - 112px), calc(100vh - 224px));
            }
            ${BREAKPOINT.portrait} {
              align-items: stretch;
              min-height: calc(125vw - 112px);
            }
          `,
        ]}
      >
        <ws.element
          ws:tag="h1"
          ws:style={[
            ...displayStyles(),
            ...css`
              max-width: 11em;
            `,
          ]}
        >
          {/* one bracketed ask, wrapping as a sentence does: no `sample` */}
          {ask}
        </ws.element>
        {text("p", leadStyles({ wrap: "balance", maxWidth: "30em" }), sentence)}
        <ws.element
          ws:tag="div"
          ws:style={css`
            display: flex;
            justify-content: center;
            margin-top: ${SPACE[8]};
          `}
        >
          {invertedButton(
            context.pageIds,
            css`
              ${BREAKPOINT.portrait} {
                flex-grow: 1;
              }
            `
          )}
        </ws.element>
      </ws.element>,
    ]),
  });
