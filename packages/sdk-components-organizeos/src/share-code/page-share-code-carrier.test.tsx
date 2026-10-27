/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import * as components from "../components";
import { navigateTo } from "../form/navigate";
import type { Renderer } from "../form/submit";
import * as page from "../page";
import { PageShareCodeCarrier } from "./page-share-code-carrier";
import { ShareCodeCarrier } from "./share-code-carrier";

vi.mock("../form/navigate", () => ({ navigateTo: vi.fn(() => true) }));

const code = "Code234567";

const Sdk = ({
  renderer,
  children,
}: {
  renderer?: Renderer;
  children: ReactNode;
}) => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
      renderer,
    }}
  >
    {children}
  </ReactSdkContext.Provider>
);

const at = (path: string) => `${window.location.origin}${path}`;

// Whether the click's default was prevented once every handler had run. The
// window's bubble-phase listener runs last; it then prevents the default
// itself, so jsdom never tries to follow a link.
let prevented: boolean | undefined;
const observe = (event: Event) => {
  prevented = event.defaultPrevented;
  event.preventDefault();
};

const click = (element: Element, init?: MouseEventInit) => {
  prevented = undefined;
  fireEvent.click(element, init);
  return { prevented };
};

const link = (name: string) => screen.getByRole("link", { name });

/** The r values an anchor's href carries. */
const shareCodes = (anchor: HTMLElement) =>
  new URL(anchor.getAttribute("href") ?? "", window.location.href).searchParams
    .getAll("r")
    .sort();

// What a client-side router's link does on a click, as react-router's Link
// does: route by its own `to`, unless the click is modified or another handler
// prevented it. A designer's published link without `reloadDocument` renders
// this way.
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

/**
 * What the click looked like on its way down, between the document and the
 * page's elements: a capture listener on <body> runs after the document's
 * capture listeners and before those of any element inside <body>, a block's
 * root among them.
 */
const watchBody = () => {
  const seen: Array<{ prevented: boolean; codes: string[] }> = [];
  const onClick = (event: Event) => {
    const anchor = (event.target as Element).closest("a");
    seen.push({
      prevented: event.defaultPrevented,
      codes: anchor === null ? [] : shareCodes(anchor),
    });
  };
  document.body.addEventListener("click", onClick, true);
  return {
    seen,
    stop: () => document.body.removeEventListener("click", onClick, true),
  };
};

beforeEach(() => {
  window.history.replaceState(null, "", `/?r=${code}`);
  window.addEventListener("click", observe);
});

afterEach(() => {
  cleanup();
  window.removeEventListener("click", observe);
  vi.mocked(navigateTo).mockClear();
  route.mockClear();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

test("carries the code on a same-origin link to a platform page anywhere on the page, outside any block", () => {
  render(
    <Sdk>
      <header>
        <a href="/donate">Donate</a>
      </header>
      <main>
        <RouterLink to="/join">Join</RouterLink>
        <a href={at("/events/weekly-phone-bank")}>
          <span>Event</span>
        </a>
      </main>
      <PageShareCodeCarrier />
    </Sdk>
  );
  // a link React does not render at all, outside the app's container
  const outside = document.createElement("a");
  outside.href = "/shop/union-t-shirt?size=m";
  outside.textContent = "Shop";
  document.body.append(outside);

  expect(click(link("Donate"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenLastCalledWith(at(`/donate?r=${code}`));
  expect(link("Donate").getAttribute("href")).toBe(at(`/donate?r=${code}`));

  // a designer's link that would route through the site's router goes by
  // document instead, with the code
  expect(click(link("Join"))).toEqual({ prevented: true });
  expect(route).not.toHaveBeenCalled();
  expect(navigateTo).toHaveBeenLastCalledWith(at(`/join?r=${code}`));

  // a click on an element inside the link, on a same-origin absolute address
  expect(click(screen.getByText("Event"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenLastCalledWith(
    at(`/events/weekly-phone-bank?r=${code}`)
  );

  expect(click(outside)).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenLastCalledWith(
    at(`/shop/union-t-shirt?size=m&r=${code}`)
  );

  // a modified click keeps its default and follows the rewritten href
  const cart = document.createElement("a");
  cart.href = "/cart";
  document.body.append(cart);
  expect(click(cart, { metaKey: true })).toEqual({ prevented: false });
  expect(cart.getAttribute("href")).toBe(at(`/cart?r=${code}`));
  expect(navigateTo).toHaveBeenCalledTimes(4);
});

test("leaves the site's own pages, other origins and donor pages alone", () => {
  const hrefs = [
    "/",
    "/about",
    "/events",
    "/donate/a/b",
    "https://elsewhere.example/donate/x",
    "https://events.organizeos.org/acme/x",
    "/unsubscribe",
    "/giving/manage/abc",
    "mailto:hello@example.org",
  ];
  render(
    <Sdk>
      {hrefs.map((href) => (
        <a key={href} href={href}>
          {href}
        </a>
      ))}
      <RouterLink to="/about">About us</RouterLink>
      <PageShareCodeCarrier />
    </Sdk>
  );
  for (const href of hrefs) {
    expect(click(link(href)), href).toEqual({ prevented: false });
    expect(link(href).getAttribute("href"), href).toBe(href);
  }
  // the site's router still routes between the site's own pages
  click(link("About us"));
  expect(route).toHaveBeenCalledWith("/about");
  expect(link("About us").getAttribute("href")).toBe("/about");
  expect(navigateTo).not.toHaveBeenCalled();
});

test("renders nothing, on the server and on the client", async () => {
  const consoleError = vi.spyOn(console, "error");
  const Page = () => (
    <Sdk>
      <p>Page</p>
      <PageShareCodeCarrier />
    </Sdk>
  );
  // the server renders without the visitor's address
  window.history.replaceState(null, "", "/");
  const serverHtml = renderToString(<Page />);
  expect(serverHtml).toBe("<p>Page</p>");
  expect(renderToString(<PageShareCodeCarrier />)).toBe("");

  // the browser hydrates that markup with a code in the address
  window.history.replaceState(null, "", `/?r=${code}`);
  const container = document.createElement("div");
  container.innerHTML = serverHtml;
  document.body.append(container);
  let root: Root | undefined;
  await act(async () => {
    root = hydrateRoot(container, <Page />);
  });
  expect(container.innerHTML).toBe(serverHtml);
  expect(consoleError).not.toHaveBeenCalled();

  // and, hydrated, it carries the code
  const anchor = document.createElement("a");
  anchor.href = "/donate";
  document.body.append(anchor);
  expect(click(anchor)).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));
  act(() => root?.unmount());

  // rendered on the client alone, it adds nothing to the DOM either
  const { container: client } = render(<PageShareCodeCarrier />);
  expect(client.innerHTML).toBe("");
});

// The page carrier listens on the document and a block's carrier on the
// block's root, both in the capture phase. The capture phase reaches the
// document before any element in it, whichever was attached first, so the
// page's carrier always acts first: the <body> listener sees what it did
// before the click reaches the block.
test.each([
  ["mounted before the block", "before"],
  ["mounted after the block", "after"],
] as const)(
  "with a block's carrier on the page, a plain click on the block's link gets one r and navigates once (page carrier %s)",
  (_name, position) => {
    render(
      <Sdk>
        {position === "before" && <PageShareCodeCarrier />}
        <ShareCodeCarrier>
          <RouterLink to="/events/weekly-phone-bank">Event</RouterLink>
          <a href="/donate">Give</a>
        </ShareCodeCarrier>
        {position === "after" && <PageShareCodeCarrier />}
      </Sdk>
    );
    const body = watchBody();

    expect(click(link("Event"))).toEqual({ prevented: true });
    expect(route).not.toHaveBeenCalled();
    expect(vi.mocked(navigateTo).mock.calls).toEqual([
      [at(`/events/weekly-phone-bank?r=${code}`)],
    ]);
    expect(shareCodes(link("Event"))).toEqual([code]);

    // a second link, and a second click on the first
    click(link("Give"));
    click(link("Event"));
    body.stop();
    expect(vi.mocked(navigateTo).mock.calls).toEqual([
      [at(`/events/weekly-phone-bank?r=${code}`)],
      [at(`/donate?r=${code}`)],
      [at(`/events/weekly-phone-bank?r=${code}`)],
    ]);
    expect(shareCodes(link("Give"))).toEqual([code]);
    expect(shareCodes(link("Event"))).toEqual([code]);
    // each click was cancelled and carried before it reached the block's root
    expect(body.seen).toEqual([
      { prevented: true, codes: [code] },
      { prevented: true, codes: [code] },
      { prevented: true, codes: [code] },
    ]);
  }
);

test.each([
  ["mounted before the block", "before"],
  ["mounted after the block", "after"],
] as const)(
  "with a block's carrier on the page, a modified click gets one r and no navigation (page carrier %s)",
  (_name, position) => {
    render(
      <Sdk>
        {position === "before" && <PageShareCodeCarrier />}
        <ShareCodeCarrier>
          <a href="/donate">Give</a>
          <a href="/join" target="_blank" rel="noopener">
            Join
          </a>
        </ShareCodeCarrier>
        {position === "after" && <PageShareCodeCarrier />}
      </Sdk>
    );
    const body = watchBody();

    expect(click(link("Give"), { ctrlKey: true })).toEqual({
      prevented: false,
    });
    expect(click(link("Join"))).toEqual({ prevented: false });
    // again: the link has its r now, and still gets no second one
    expect(click(link("Give"), { metaKey: true })).toEqual({
      prevented: false,
    });
    body.stop();

    expect(navigateTo).not.toHaveBeenCalled();
    expect(link("Give").getAttribute("href")).toBe(at(`/donate?r=${code}`));
    expect(link("Join").getAttribute("href")).toBe(at(`/join?r=${code}`));
    // the page's carrier had added the code before the block's carrier saw
    // the click, so the block's found its r and kept it
    expect(body.seen).toEqual([
      { prevented: false, codes: [code] },
      { prevented: false, codes: [code] },
      { prevented: false, codes: [code] },
    ]);
  }
);

test("leaves a click another handler already cancelled", () => {
  // a window capture listener runs before the document's
  const cancel = (event: Event) => event.preventDefault();
  window.addEventListener("click", cancel, true);
  render(
    <Sdk>
      <a href="/donate">Give</a>
      <ShareCodeCarrier>
        <a href="/join">Join</a>
      </ShareCodeCarrier>
      <PageShareCodeCarrier />
    </Sdk>
  );
  click(link("Give"));
  click(link("Join"));
  window.removeEventListener("click", cancel, true);
  expect(navigateTo).not.toHaveBeenCalled();
  expect(link("Give").getAttribute("href")).toBe("/donate");
  expect(link("Join").getAttribute("href")).toBe("/join");
  // the same click, not cancelled, is carried
  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));
});

test("reads the code when the link is clicked, not when it renders", () => {
  window.history.replaceState(null, "", "/");
  render(
    <Sdk>
      <a href="/donate">Give</a>
      <a href="/join">Join</a>
      <PageShareCodeCarrier />
    </Sdk>
  );
  expect(click(link("Give"))).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe("/donate");

  // the address gains a code after rendering
  window.history.replaceState(null, "", `/?r=${code}`);
  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));

  // and loses it again
  window.history.replaceState(null, "", "/?r=bad");
  expect(click(link("Join"))).toEqual({ prevented: false });
  expect(link("Join").getAttribute("href")).toBe("/join");
  expect(navigateTo).toHaveBeenCalledTimes(1);
});

test.each(["canvas", "preview"] as const)(
  "attaches nothing on the %s, even with a code in the address",
  (renderer) => {
    render(
      <Sdk renderer={renderer}>
        <a href="/donate">Give</a>
        <PageShareCodeCarrier />
      </Sdk>
    );
    expect(window.location.search).toBe(`?r=${code}`);
    expect(click(link("Give"))).toEqual({ prevented: false });
    expect(link("Give").getAttribute("href")).toBe("/donate");
    expect(navigateTo).not.toHaveBeenCalled();
  }
);

test("writes no cookie and no storage", () => {
  const cookie = vi.spyOn(Document.prototype, "cookie", "set");
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  render(
    <Sdk>
      <a href="/donate">Give</a>
      <a href="/join">Join</a>
      <PageShareCodeCarrier />
    </Sdk>
  );
  click(link("Give"));
  click(link("Join"), { metaKey: true });
  expect(navigateTo).toHaveBeenCalledTimes(1);
  expect(cookie).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
  expect(document.cookie).toBe("");
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});

test("stops listening when it unmounts", () => {
  const { rerender } = render(
    <Sdk>
      <a href="/donate">Give</a>
      <a href="/join">Join</a>
      <PageShareCodeCarrier />
    </Sdk>
  );
  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenCalledTimes(1);
  rerender(
    <Sdk>
      <a href="/donate">Give</a>
      <a href="/join">Join</a>
    </Sdk>
  );
  expect(click(link("Join"))).toEqual({ prevented: false });
  expect(link("Join").getAttribute("href")).toBe("/join");
  expect(navigateTo).toHaveBeenCalledTimes(1);
});

test("is the page entry's one export, and none of the blocks' components", () => {
  expect(Object.keys(page)).toEqual(["PageShareCodeCarrier"]);
  expect(page.PageShareCodeCarrier).toBe(PageShareCodeCarrier);
  expect(Object.values(components)).not.toContain(PageShareCodeCarrier);
  expect(components).not.toHaveProperty("PageShareCodeCarrier");
});
