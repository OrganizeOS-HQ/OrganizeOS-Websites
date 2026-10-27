/**
 * @vitest-environment jsdom
 */
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { navigateTo } from "../form/navigate";
import { ShareCodeCarrier } from "./share-code-carrier";

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
    <ShareCodeCarrier className="events">
      <a href="/events/weekly-phone-bank">Details and RSVP</a>
    </ShareCodeCarrier>
  </ReactSdkContext.Provider>
);

// The server rendered the page without the visitor's address; the browser
// hydrates it with the code in the address. The carrier changes the DOM only
// on a click, so the two agree.
test("hydrates the server's markup with a code in the address, with no warning", async () => {
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

  // and, hydrated, it carries the code
  const anchor = container.querySelector("a") as HTMLAnchorElement;
  fireEvent.click(anchor);
  expect(navigateTo).toHaveBeenCalledWith(
    `${window.location.origin}/events/weekly-phone-bank?r=Code234567`
  );
});
