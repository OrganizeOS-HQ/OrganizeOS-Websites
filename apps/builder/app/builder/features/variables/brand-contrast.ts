import type { StyleValue } from "@webstudio-is/css-engine";
import { contrastRatio, toRgba } from "./color";

/** The Brand pairs a template site reads one on the other (spec 5.7). */
const pairs = [
  ["text", "base", "Text on Base"],
  ["base", "accent-1", "Base on Accent 1"],
  ["base", "text", "Base on Text"],
] as const;

/** WCAG AA for body text. */
const AA = 4.5;

/**
 * The Brand pairs below AA, each with its ratio floored to one decimal (so a
 * failing pair never reads 4.5), joined by ", "; undefined when none fails.
 * A pair with a value that does not resolve to a colour is skipped. Pure.
 */
export const describeBrandContrast = (
  colors: Partial<Record<"base" | "accent-1" | "text", StyleValue>>
): string | undefined => {
  const failures: string[] = [];
  for (const [foreground, background, name] of pairs) {
    const top = colors[foreground];
    const bottom = colors[background];
    const a = top === undefined ? undefined : toRgba(top);
    const b = bottom === undefined ? undefined : toRgba(bottom);
    if (a === undefined || b === undefined) {
      continue;
    }
    const ratio = contrastRatio(a, b);
    if (ratio < AA) {
      failures.push(`${name} ${(Math.floor(ratio * 10) / 10).toFixed(1)}:1`);
    }
  }
  return failures.length === 0 ? undefined : failures.join(", ");
};
