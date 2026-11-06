import { afterEach, describe, expect, test } from "vitest";
// In the order routes/_ui.tsx links them
import "@webstudio-is/design-system/global.css";
import "./organizeos-colors.css";

const schemes = ["light", "dark"] as const;

afterEach(() => {
  delete document.documentElement.dataset.colorScheme;
});

/** A colour variable as the browser paints it, in sRGB bytes. */
const readColor = (name: string) => {
  const sample = document.createElement("span");
  sample.style.color = `var(${name})`;
  document.body.appendChild(sample);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    sample.remove();
    throw new Error("Canvas color evaluation is unavailable");
  }
  context.fillStyle = getComputedStyle(sample).color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  sample.remove();
  return { r, g, b };
};

const toHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  `#${[r, g, b].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;

// WCAG 2 relative luminance and contrast ratio
const channel = (byte: number) => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = ({ r, g, b }: { r: number; g: number; b: number }) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (
  one: { r: number; g: number; b: number },
  two: { r: number; g: number; b: number }
) => {
  const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

// What upstream's recipe makes of the teal, measured once in Chromium, beside
// what it makes of upstream's own blue (color-contrast.browser.test.ts), per
// scheme: each derived colour follows the accent in both
const derived = {
  light: {
    "--foreground-accent": { teal: "#198476", upstream: "#096cff" },
    "--border-focus": { teal: "#368e80", upstream: "#297aff" },
    "--background-text-selection": { teal: "#198476", upstream: "#096cff" },
  },
  dark: {
    "--foreground-accent": { teal: "#a6c5bf", upstream: "#a0c1f6" },
    "--border-focus": { teal: "#2e877a", upstream: "#1a6df2" },
    "--background-text-selection": { teal: "#59b8a8", upstream: "#439cff" },
  },
} as const;

describe("the builder's colours", () => {
  test.each(schemes)("the accent is the OrganizeOS teal (%s)", (scheme) => {
    document.documentElement.dataset.colorScheme = scheme;
    expect(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--theme-color-accent")
        .trim()
    ).toBe("#23a997");
    // a darker teal, capped at the recipe's chromatic luminance
    const accent = readColor("--background-accent");
    expect(toHex(accent)).toBe("#198476");
    expect(accent.g).toBeGreaterThan(accent.b);
    expect(accent.b).toBeGreaterThan(accent.r);
  });

  test.each(schemes)(
    "the focus ring, the accent text and the selection follow it (%s)",
    (scheme) => {
      document.documentElement.dataset.colorScheme = scheme;
      for (const [name, { teal, upstream }] of Object.entries(
        derived[scheme]
      )) {
        const color = toHex(readColor(name));
        expect(color, name).toBe(teal);
        expect(color, name).not.toBe(upstream);
      }
    }
  );

  test.each(schemes)("text on the accent stays readable (%s)", (scheme) => {
    document.documentElement.dataset.colorScheme = scheme;
    expect(
      contrast(
        readColor("--background-accent"),
        readColor("--foreground-on-accent")
      )
    ).toBeGreaterThanOrEqual(4.5);
  });
});
