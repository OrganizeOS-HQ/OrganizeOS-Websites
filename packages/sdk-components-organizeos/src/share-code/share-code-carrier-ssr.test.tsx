import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { ShareCodeCarrier } from "./share-code-carrier";

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
    <ShareCodeCarrier className="events">
      <a href="/events/weekly-phone-bank">Details and RSVP</a>
    </ShareCodeCarrier>
  </ReactSdkContext.Provider>
);

// A published site renders on the server first (node: no window, no
// document), and the carrier reads nothing while rendering, so the address a
// visitor arrives with cannot change the markup.
test("renders the same markup on the server whatever the address, with no window", () => {
  const consoleError = vi.spyOn(console, "error");
  expect(typeof window).toBe("undefined");
  const html = renderToString(<Page />);
  expect(html).toBe(
    '<div class="events"><a href="/events/weekly-phone-bank">Details and RSVP</a></div>'
  );
  // a window with a code in its address changes nothing
  vi.stubGlobal("window", { location: { search: "?r=Code234567" } });
  expect(renderToString(<Page />)).toBe(html);
  expect(consoleError).not.toHaveBeenCalled();
});
