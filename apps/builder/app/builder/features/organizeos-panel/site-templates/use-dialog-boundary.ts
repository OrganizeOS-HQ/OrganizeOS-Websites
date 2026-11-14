import { useLayoutEffect, useState } from "react";

/**
 * The Templates screen's size (OrganizeOS design
 * `2026-11-13-builder-templates-screen-and-page-templates-design.md` 5.1):
 * the builder's dialog boundary (`[data-dialog-boundary]`, the middle row
 * under the top bar) less 20px each side, and never under 240px each way.
 * Measured as it mounts, so the first frame is already right, then followed
 * with a ResizeObserver (the design system's own `useBoundary` is private and
 * measures only after paint). A missing boundary, or one with no size (the
 * UI hidden), falls back to the window.
 */

type Size = { width: number; height: number };

const MARGIN = 20;
const MIN_SIZE = 240;

const findBoundary = () => document.querySelector("[data-dialog-boundary]");

const measureBoundary = (boundary: Element | null): Size => {
  const rect = boundary?.getBoundingClientRect();
  if (rect === undefined || rect.width === 0 || rect.height === 0) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width: rect.width, height: rect.height };
};

const toDialogSize = ({ width, height }: Size): Size => ({
  width: Math.max(MIN_SIZE, width - 2 * MARGIN),
  height: Math.max(MIN_SIZE, height - 2 * MARGIN),
});

export const useDialogBoundarySize = (): Size => {
  const [size, setSize] = useState(() =>
    toDialogSize(measureBoundary(findBoundary()))
  );
  useLayoutEffect(() => {
    const boundary = findBoundary();
    const update = () => {
      const next = toDialogSize(measureBoundary(boundary));
      setSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next
      );
    };
    update();
    const observer =
      boundary === null ? undefined : new ResizeObserver(() => update());
    if (boundary !== null) {
      observer?.observe(boundary);
    }
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return size;
};
