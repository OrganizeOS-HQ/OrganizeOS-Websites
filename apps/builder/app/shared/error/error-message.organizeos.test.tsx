// The design system's colours, so that var() resolves in computed styles
import "@webstudio-is/design-system/global.css";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { ErrorMessage } from "./error-message.client";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  delete document.documentElement.dataset.colorScheme;
});

/** A computed colour's relative luminance, through a canvas, in sRGB. */
const luminance = (color: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("Canvas color evaluation is unavailable");
  }
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

// OrganizeOS fork: the page around the card follows the scheme, and so does
// its status numeral; upstream's took the card's inverse colour, dark on the
// dark page
test.each(["light", "dark"])(
  "the status numeral is page text in the %s scheme",
  (scheme) => {
    document.documentElement.dataset.colorScheme = scheme;
    act(() => {
      root.render(
        <ErrorMessage error={{ status: 403, message: "No access." }} />
      );
    });
    const numeral = Array.from(container.querySelectorAll("*")).find(
      (element) => element.textContent === "403"
    );
    if (numeral === undefined) {
      throw new Error("Expected the status numeral");
    }
    const probe = document.createElement("span");
    probe.style.color = "var(--foreground-primary)";
    document.body.appendChild(probe);
    const pageText = getComputedStyle(probe).color;
    probe.remove();
    expect(getComputedStyle(numeral).color).toBe(pageText);
    if (scheme === "dark") {
      expect(luminance(getComputedStyle(numeral).color)).toBeGreaterThan(0.7);
    } else {
      expect(luminance(getComputedStyle(numeral).color)).toBeLessThan(0.3);
    }
  }
);
