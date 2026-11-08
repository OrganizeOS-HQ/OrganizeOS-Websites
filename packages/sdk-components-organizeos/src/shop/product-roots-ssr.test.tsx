import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { ProductCard } from "./product-card";
import { ProductGrid } from "./product-grid";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    <ProductGrid className="grid" columns="4">
      <a href="/shop/campaign-mug">Campaign Mug</a>
    </ProductGrid>
    <ProductCard className="card">
      <a href="/shop/sticker-2">Sticker</a>
    </ProductCard>
  </ReactSdkContext.Provider>
);

test("renders the same markup on the server whatever the address, with no window", () => {
  const consoleError = vi.spyOn(console, "error");
  expect(typeof window).toBe("undefined");
  const html = renderToString(<Page />);
  expect(html).toBe(
    '<div class="grid" style="--os-product-columns:4"><a href="/shop/campaign-mug">Campaign Mug</a></div>' +
      '<div class="card"><a href="/shop/sticker-2">Sticker</a></div>'
  );
  vi.stubGlobal("window", { location: { search: "?r=Code234567" } });
  expect(renderToString(<Page />)).toBe(html);
  expect(consoleError).not.toHaveBeenCalled();
});
