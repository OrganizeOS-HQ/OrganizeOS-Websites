/**
 * @vitest-environment jsdom
 */
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { navigateTo } from "../form/navigate";
import { ProductCard } from "./product-card";
import { ProductGrid } from "./product-grid";

vi.mock("../form/navigate", () => ({ navigateTo: vi.fn(() => true) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(navigateTo).mockClear();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

const Page = () => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
    }}
  >
    <ProductGrid columns="2">
      <a href="/shop/campaign-mug">Campaign Mug</a>
    </ProductGrid>
    <ProductCard>
      <a href="/shop/sticker-2">Sticker</a>
    </ProductCard>
  </ReactSdkContext.Provider>
);

test("hydrates the server's markup with a code in the address, with no warning, then carries it", async () => {
  const consoleError = vi.spyOn(console, "error");
  const container = document.createElement("div");
  document.body.append(container);
  container.innerHTML = renderToString(<Page />);
  const serverHtml = container.innerHTML;
  window.history.replaceState(null, "", "/?r=Code234567");

  await act(async () => {
    hydrateRoot(container, <Page />);
  });

  expect(container.innerHTML).toBe(serverHtml);
  expect(consoleError).not.toHaveBeenCalled();

  const [mug, sticker] = Array.from(container.querySelectorAll("a"));
  fireEvent.click(mug);
  expect(navigateTo).toHaveBeenLastCalledWith(
    `${window.location.origin}/shop/campaign-mug?r=Code234567`
  );
  fireEvent.click(sticker);
  expect(navigateTo).toHaveBeenLastCalledWith(
    `${window.location.origin}/shop/sticker-2?r=Code234567`
  );
});
