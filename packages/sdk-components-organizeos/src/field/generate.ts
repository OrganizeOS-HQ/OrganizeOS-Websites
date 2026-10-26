/**
 * A copy of the OrganizeOS homepage's convergence field generator.
 *
 * Source (OrganizeOS-HQ/OrganizeOS, commit 38bdbee97): `convergenceField`,
 * `zoneDistance`, `LEVELS` and the types are
 * `client/lib/marketing/convergence-field.ts`, verbatim; `ARM_PATH`,
 * `ARM_HEIGHT`, the arm's centring offset, the arm transform and the fade
 * level math are `client/components/marketing/convergence-field.tsx`'s, with
 * the brand's color variables replaced by the block's two colors.
 *
 * Do not edit this copy on its own. `__fixtures__/convergence-field.fixture.json`
 * is the homepage generator's output, and `generate.test.ts` holds this copy to
 * it exactly: a change to the generator is a two-repository change
 * (`__fixtures__/README.md`).
 */

// The generator below is the homepage's text, kept verbatim (formatted by this
// repository's Prettier) so the two compare line by line; it uses function
// declarations and one-line ifs, which this repository's lint otherwise bans.
/* eslint-disable curly, func-style */

export interface FieldPoint {
  x: number;
  y: number;
}

export interface ClearZone {
  /** Horizontal radius of the clear ellipse around the focus. */
  rx: number;
  /** Vertical radius of the clear ellipse around the focus. */
  ry: number;
}

export interface FieldArm {
  /** Centre of the arm. */
  x: number;
  y: number;
  /** Direction the arm points, in degrees: a multiple of 45. */
  deg: number;
  /** Drawn height of the arm in user units. */
  size: number;
  /** Fade level, 1 (just past the clear zone) to LEVELS (solid, at the edge). */
  level: number;
}

/** The field is drawn in this many fade steps, so the SVG has few style rules. */
export const LEVELS = 6;

function smoothstep(v: number): number {
  const c = Math.max(0, Math.min(1, v));
  return c * c * (3 - 2 * c);
}

/** Elliptical distance from the focus in clear-zone radii: 1 on its edge. */
export function zoneDistance(
  p: FieldPoint,
  focus: FieldPoint,
  zone: ClearZone
): number {
  return Math.hypot((p.x - focus.x) / zone.rx, (p.y - focus.y) / zone.ry);
}

/**
 * Generate the arms for a field of `width` x `height` user units on a grid of
 * `spacing`, laid out from the focus so the field is mirror-symmetric around
 * it. Arms inside the clear zone are left out; past it they grow and fade in
 * until the nearest edge, where they are solid.
 */
export function convergenceField(
  width: number,
  height: number,
  spacing: number,
  focus: FieldPoint,
  zone: ClearZone
): FieldArm[] {
  const margin = spacing * 0.55;
  // Fully faded in at the nearest edge of the field, on either axis.
  const solidAt = Math.min(
    Math.min(focus.x, width - focus.x) / zone.rx,
    Math.min(focus.y, height - focus.y) / zone.ry
  );
  const ni = Math.ceil(Math.max(focus.x, width - focus.x) / spacing);
  const nj = Math.ceil(Math.max(focus.y, height - focus.y) / spacing);
  const out: FieldArm[] = [];

  for (let j = -nj; j <= nj; j++) {
    for (let i = -ni; i <= ni; i++) {
      const x = focus.x + i * spacing;
      const y = focus.y + j * spacing;
      if (x < margin || x > width - margin || y < margin || y > height - margin)
        continue;
      const e = zoneDistance({ x, y }, focus, zone);
      if (e <= 1) continue;
      const k = smoothstep((e - 1) / (solidAt - 1));
      const level = Math.ceil(k * LEVELS);
      if (level < 1) continue;
      const deg = Math.round((Math.atan2(-j, -i) * 180) / Math.PI / 45) * 45;
      out.push({
        x,
        y,
        deg: deg === -180 ? 180 : deg,
        size: Number((spacing * (0.2 + 0.36 * k)).toFixed(1)),
        level,
      });
    }
  }
  return out;
}
/* eslint-enable curly, func-style */

/** One arm of the mark, centred on the origin and pointing right (77 units tall). */
export const ARM_PATH =
  "M17.82,25.81l-6.84,6.84c-.79.79-.79,2.06,0,2.85l16.47,16.47c1.92,1.92.56,5.2-2.15,5.2H2.01c-1.11,0-2.01.9-2.01,2.01v9.67c0,1.11.9,2.01,2.01,2.01h23.28c2.71,0,4.07,3.28,2.15,5.2l-16.47,16.47c-.79.79-.79,2.06,0,2.85l6.84,6.84c.79.79,2.06.79,2.85,0l24.4-24.4c1.27-1.27,1.98-2.99,1.98-4.78v-18.01c0-1.79-.71-3.51-1.98-4.78l-24.4-24.4c-.79-.79-2.06-.79-2.85,0Z";
export const ARM_HEIGHT = 77;

/** The path's transform that puts the arm's centre on the origin. */
export const ARM_CENTRE_TRANSFORM = "translate(-21.8 -64.165)";

/** An arm's `transform` attribute, as the homepage writes it. */
export const armTransform = (arm: FieldArm): string => {
  const scale = (arm.size / ARM_HEIGHT).toFixed(3);
  return `translate(${arm.x} ${arm.y}) rotate(${arm.deg}) scale(${scale})`;
};

/**
 * Each fade level, from just past the clear zone (`inner`, faint) to the edge
 * (`outer`, solid): the color shifts as the arms arrive. The homepage's
 * `levelStyle`, with `var(--mk-cream)` as `outer` and `var(--mk-aqua)` as
 * `inner`.
 */
export const levelStyle = (
  level: number,
  outer: string,
  inner: string
): { fill: string; opacity: number } => {
  const k = level / LEVELS;
  const cream = Math.round(k * 100);
  return {
    fill: `color-mix(in srgb, ${outer} ${cream}%, ${inner})`,
    opacity: Number((0.25 + 0.7 * k).toFixed(2)),
  };
};
