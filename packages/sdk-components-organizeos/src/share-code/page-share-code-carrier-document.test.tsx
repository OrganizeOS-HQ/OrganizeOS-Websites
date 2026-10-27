/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { navigateTo } from "../form/navigate";
import { PageShareCodeCarrier } from "./page-share-code-carrier";

vi.mock("../form/navigate", () => ({ navigateTo: vi.fn(() => true) }));

const code = "Code234567";

// A file of its own: here React owns the whole document, as on a published
// site, and its listeners on the document outlive the root.

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(navigateTo).mockClear();
  window.history.replaceState(null, "", "/");
});

// What a client-side router's link does on a click, as react-router's Link
// does: route by its own `to`, unless the click is modified or another handler
// prevented it.
const route = vi.fn();
const RouterLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <a
    href={to}
    onClick={(event) => {
      const modified =
        event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
      if (
        event.defaultPrevented === false &&
        event.button === 0 &&
        modified === false
      ) {
        event.preventDefault();
        route(to);
      }
    }}
  >
    {children}
  </a>
);

/** A published page: the html route renders the whole document. */
const Document = () => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
    }}
  >
    <html>
      <head></head>
      <body>
        <main>
          <RouterLink to="/donate">Give</RouterLink>
          <RouterLink to="/about">About</RouterLink>
        </main>
        <PageShareCodeCarrier />
      </body>
    </html>
  </ReactSdkContext.Provider>
);

// react-router's default client entry hydrates the document itself
// (hydrateRoot(document, ...)), so React's own listeners are on the document,
// as the page carrier's is. React registers them when it hydrates, before the
// carrier's effect, but a link's onClick runs in the bubble phase, after every
// capture listener: the carrier has cancelled the click by then.
test("hydrated with React on the document, it warns of nothing, and a plain click on a router link goes by document once, with one r", async () => {
  const consoleError = vi.spyOn(console, "error");
  // the server renders without the visitor's address
  const serverHtml = renderToString(<Document />);
  expect(serverHtml).toMatch(/^<html><head><\/head><body>.*<\/body><\/html>$/);
  document.documentElement.innerHTML = serverHtml
    .replace(/^<html>/, "")
    .replace(/<\/html>$/, "");
  const serverBody = document.body.innerHTML;

  window.history.replaceState(null, "", `/?r=${code}`);
  const addListener = vi.spyOn(document, "addEventListener");
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(document, <Document />);
    });
    expect(consoleError).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toBe(serverBody);
    // the click listeners on the document, in the order they were added:
    // React's bubble and capture listeners when it hydrated, then the
    // carrier's capture listener in its effect
    expect(
      addListener.mock.calls
        .filter(([type]) => type === "click")
        .map(([, , options]) => options)
    ).toEqual([false, true, true]);

    const give = document.querySelector('a[href="/donate"]') as Element;
    const notCancelled = fireEvent.click(give);
    expect(notCancelled).toBe(false);
    expect(route).not.toHaveBeenCalled();
    expect(vi.mocked(navigateTo).mock.calls).toEqual([
      [`${window.location.origin}/donate?r=${code}`],
    ]);
    const carried = new URL(give.getAttribute("href") ?? "");
    expect(carried.searchParams.getAll("r")).toEqual([code]);

    // a link to the site's own page still routes, without the code
    const about = document.querySelector('a[href="/about"]') as Element;
    fireEvent.click(about);
    expect(route).toHaveBeenCalledWith("/about");
    expect(about.getAttribute("href")).toBe("/about");
    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  } finally {
    act(() => root?.unmount());
    document.documentElement.innerHTML = "<head></head><body></body>";
  }
});
