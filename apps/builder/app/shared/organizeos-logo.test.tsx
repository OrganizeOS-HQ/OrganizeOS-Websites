import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, describe, expect, test } from "vitest";
import { OrganizeosLogo } from "./organizeos-logo";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = undefined;
  container = undefined;
  document.documentElement.style.colorScheme = "";
});

const renderLogo = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(OrganizeosLogo, { size: 48 }));
  });
  const svg = container.querySelector("svg");
  if (svg === null) {
    throw new Error("no mark");
  }
  return svg;
};

describe("OrganizeosLogo", () => {
  // The login, loading and error screens sit on --background-primary, which
  // follows the builder's colour scheme (colors.css sets color-scheme on :root)
  test("is ink on a light page and cream on a dark one", () => {
    const svg = renderLogo();
    document.documentElement.style.colorScheme = "light";
    expect(getComputedStyle(svg).color).toBe("rgb(21, 22, 23)");
    document.documentElement.style.colorScheme = "dark";
    expect(getComputedStyle(svg).color).toBe("rgb(254, 249, 241)");
  });

  test("keeps its size and its name", () => {
    const svg = renderLogo();
    expect(svg.getAttribute("width")).toBe("48");
    expect(svg.getAttribute("height")).toBe("48");
    expect(svg.getAttribute("aria-label")).toBe("OrganizeOS");
    expect(svg.getAttribute("fill")).toBe("currentColor");
  });
});
