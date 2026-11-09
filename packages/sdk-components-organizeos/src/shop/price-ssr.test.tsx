import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { Price } from "./price";

afterEach(() => {
  vi.restoreAllMocks();
});

// A published site renders on the server first (node: no window), and the
// format is fixed (US English), so the markup cannot depend on where it
// renders.
test("renders the same markup on the server, with no window", () => {
  const consoleError = vi.spyOn(console, "error");
  expect(typeof window).toBe("undefined");
  expect(renderToString(<Price className="price" cents={1800} />)).toBe(
    '<span class="price">$18.00</span>'
  );
  expect(renderToString(<Price cents={-1} />)).toBe("<span></span>");
  expect(consoleError).not.toHaveBeenCalled();
});
