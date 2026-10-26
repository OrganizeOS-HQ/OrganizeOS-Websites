import type { AnimationActionView } from "@webstudio-is/sdk";

/**
 * The Motion area's presets (spec 4.4): upstream view actions using only
 * fields upstream's Animation section shows, so each opens and edits there
 * with no loss, plus the OrganizeOS-only `stagger` prop. The package's
 * `play-action.test.ts` pins how each plays.
 */
export type MotionPreset = {
  id: "reveal" | "reveal-staggered" | "gentle-parallax";
  label: string;
  action: AnimationActionView;
  /** percent of the entry range between one child and the next, 0..20 */
  stagger: number;
};

const percent = (value: number) => ({
  type: "unit" as const,
  value,
  unit: "%" as const,
});

/** `translate: 0 <y>px` as upstream's transform controls write it. */
const translateY = (y: number) => ({
  type: "tuple" as const,
  value: [
    { type: "unit" as const, value: 0, unit: "number" as const },
    { type: "unit" as const, value: y, unit: "px" as const },
  ],
});

// Fade and rise by 12px as the element enters, done at 60% of its entry,
// so every revealed child is visible within the page's reachable scroll.
const reveal: AnimationActionView = {
  type: "view",
  animations: [
    {
      name: "Reveal",
      timing: {
        rangeStart: ["entry", percent(0)],
        rangeEnd: ["entry", percent(60)],
        fill: "backwards",
        easing: "ease-out",
      },
      keyframes: [
        {
          offset: 0,
          styles: {
            opacity: { type: "unit", value: 0, unit: "number" },
            translate: translateY(12),
          },
        },
      ],
    },
  ],
};

// 24px of travel each way while the element crosses the viewport.
const gentleParallax: AnimationActionView = {
  type: "view",
  animations: [
    {
      name: "Gentle parallax",
      timing: {
        rangeStart: ["cover", percent(0)],
        rangeEnd: ["cover", percent(100)],
        fill: "both",
        easing: "linear",
      },
      keyframes: [
        { offset: 0, styles: { translate: translateY(24) } },
        { offset: 1, styles: { translate: translateY(-24) } },
      ],
    },
  ],
};

export const motionPresets: MotionPreset[] = [
  { id: "reveal", label: "Reveal", action: reveal, stagger: 0 },
  {
    id: "reveal-staggered",
    label: "Reveal staggered",
    action: reveal,
    stagger: 8,
  },
  {
    id: "gentle-parallax",
    label: "Gentle parallax",
    action: gentleParallax,
    stagger: 0,
  },
];
