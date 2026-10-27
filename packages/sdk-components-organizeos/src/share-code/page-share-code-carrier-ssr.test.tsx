import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { PageShareCodeCarrier } from "./page-share-code-carrier";

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
    <a href="/donate">Give</a>
    <PageShareCodeCarrier />
  </ReactSdkContext.Provider>
);

// A published page renders on the server first (node: no window, no
// document). The page's carrier reads nothing while rendering and renders
// nothing, so the address a visitor arrives with cannot change the markup.
test("renders nothing on the server whatever the address, with no window", () => {
  const consoleError = vi.spyOn(console, "error");
  expect(typeof window).toBe("undefined");
  expect(typeof document).toBe("undefined");
  const html = renderToString(<Page />);
  expect(html).toBe('<a href="/donate">Give</a>');
  // a window with a code in its address changes nothing
  vi.stubGlobal("window", { location: { search: "?r=Code234567" } });
  expect(renderToString(<Page />)).toBe(html);
  expect(consoleError).not.toHaveBeenCalled();
});
