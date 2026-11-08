/**
 * @vitest-environment jsdom
 */
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Price } from "./price";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

test("hydrates the server's markup with no warning", async () => {
  const consoleError = vi.spyOn(console, "error");
  const page = (
    <p>
      <span>From</span>
      <Price cents={123456} currency="USD" />
    </p>
  );
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(page);
  const serverHtml = container.innerHTML;
  await act(async () => {
    hydrateRoot(container, page);
  });
  expect(container.innerHTML).toBe(serverHtml);
  expect(container.textContent).toBe("From$1,234.56");
  expect(consoleError).not.toHaveBeenCalled();
});
