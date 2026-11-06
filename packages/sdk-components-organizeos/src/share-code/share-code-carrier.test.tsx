/**
 * @vitest-environment jsdom
 */
import { createRef, type ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { navigateTo } from "../form/navigate";
import type { Renderer } from "../form/submit";
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

// A middle-click opens its tab through `auxclick` (button 1), and a right
// click or a long press opens the link's menu through `contextmenu`. Each
// returns whether the event's default was prevented once every handler had
// run; jsdom does nothing by default for either.
const gesture =
  (type: "auxclick" | "contextmenu", button: number) =>
  (element: Element, init?: MouseEventInit) => ({
    prevented: !fireEvent(
      element,
      new MouseEvent(type, { bubbles: true, cancelable: true, button, ...init })
    ),
  });
const middleClick = gesture("auxclick", 1);
const contextMenu = gesture("contextmenu", 2);
const gestures = [
  ["a middle-click", middleClick],
  ["a context menu", contextMenu],
] as const;

const link = (name: string) => screen.getByRole("link", { name });

/** The r values an anchor's href carries. */
const shareCodes = (anchor: Element) =>
  new URL(anchor.getAttribute("href") ?? "", window.location.href).searchParams
    .getAll("r")
    .sort();

// What a client-side router's link does on a click, as react-router's Link
// does: route by its own `to`, unless the click is modified or another handler
// prevented it. A published link without `reloadDocument` renders this way.
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
  window.history.replaceState(null, "", "/");
});

test("adds the code to a link inside it to a platform page and navigates there by document", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/events/weekly-phone-bank">Event</a>
        <a href="/donate/spring-drive?amount=50#give" target="_self">
          Give
        </a>
        <a href={at("/join")}>
          <span>Join</span>
        </a>
      </ShareCodeCarrier>
    </Sdk>
  );

  expect(click(link("Event"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenCalledTimes(1);
  expect(navigateTo).toHaveBeenLastCalledWith(
    at(`/events/weekly-phone-bank?r=${code}`)
  );
  expect(link("Event").getAttribute("href")).toBe(
    at(`/events/weekly-phone-bank?r=${code}`)
  );

  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenLastCalledWith(
    at(`/donate/spring-drive?amount=50&r=${code}#give`)
  );

  // a click on an element inside the link, on a same-origin absolute address
  expect(click(screen.getByText("Join"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenLastCalledWith(at(`/join?r=${code}`));
  expect(navigateTo).toHaveBeenCalledTimes(3);
});

test("lets the click reach the page's own handlers", () => {
  const onClick = vi.fn();
  const onDocumentClick = vi.fn();
  document.addEventListener("click", onDocumentClick);
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate" onClick={onClick}>
          Give
        </a>
      </ShareCodeCarrier>
    </Sdk>
  );
  click(link("Give"));
  document.removeEventListener("click", onDocumentClick);
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(onDocumentClick).toHaveBeenCalledTimes(1);
});

test("leaves a click another handler already cancelled", () => {
  const cancel = (event: Event) => event.preventDefault();
  // the document's capture listener runs before the carrier's
  document.addEventListener("click", cancel, true);
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  click(link("Give"));
  document.removeEventListener("click", cancel, true);
  expect(navigateTo).not.toHaveBeenCalled();
  expect(link("Give").getAttribute("href")).toBe("/donate");
});

test("leaves a link outside it alone", () => {
  render(
    <Sdk>
      <a href="/donate">Beside</a>
      <ShareCodeCarrier>
        <p>Inside</p>
      </ShareCodeCarrier>
      {/* a carrier inside a link: the link is not inside the carrier */}
      <a href="/join">
        <ShareCodeCarrier>
          <span>Around</span>
        </ShareCodeCarrier>
      </a>
    </Sdk>
  );
  expect(click(link("Beside"))).toEqual({ prevented: false });
  expect(click(screen.getByText("Around"))).toEqual({ prevented: false });
  expect(navigateTo).not.toHaveBeenCalled();
  expect(link("Beside").getAttribute("href")).toBe("/donate");
  expect(link("Around").getAttribute("href")).toBe("/join");
});

test("leaves a link to the site's own pages, to another origin and to a donor page alone", () => {
  const hrefs = [
    "/about",
    "/events",
    "https://elsewhere.example/donate/x",
    "https://events.organizeos.org/acme/x",
    "/unsubscribe",
  ];
  render(
    <Sdk>
      <ShareCodeCarrier>
        {hrefs.map((href) => (
          <a key={href} href={href}>
            {href}
          </a>
        ))}
      </ShareCodeCarrier>
    </Sdk>
  );
  for (const href of hrefs) {
    expect(click(link(href)), href).toEqual({ prevented: false });
    expect(link(href).getAttribute("href"), href).toBe(href);
  }
  expect(navigateTo).not.toHaveBeenCalled();
});

test("does nothing without a well-formed code on the page", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  for (const search of ["?r=bad", `?ref=${code}`, ""]) {
    window.history.replaceState(null, "", `/${search}`);
    expect(click(link("Give")), search).toEqual({ prevented: false });
    expect(link("Give").getAttribute("href"), search).toBe("/donate");
  }
  expect(navigateTo).not.toHaveBeenCalled();
});

test("leaves the r a link already carries, and still sends a plain click there by document", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate?r=Other23456">Give</a>
        <a href="/join?r=">Join</a>
        <a href="/shop?r=Other23456">Shop</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  // the r decides only the href, never whether the click goes by document
  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenLastCalledWith(at("/donate?r=Other23456"));
  expect(click(link("Join"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenLastCalledWith(at("/join?r="));
  // a modified click keeps its default
  expect(click(link("Shop"), { ctrlKey: true })).toEqual({ prevented: false });
  expect(navigateTo).toHaveBeenCalledTimes(2);
  expect(link("Give").getAttribute("href")).toBe("/donate?r=Other23456");
  expect(link("Join").getAttribute("href")).toBe("/join?r=");
  expect(link("Shop").getAttribute("href")).toBe("/shop?r=Other23456");
});

test("rewrites the href but lets the browser handle a modified, new-tab or download click", () => {
  const modifiers: Array<[string, MouseEventInit]> = [
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    // a click event with another button is not a plain click either
    ["middle button", { button: 1 }],
    ["secondary button", { button: 2 }],
  ];
  render(
    <Sdk>
      <ShareCodeCarrier>
        {modifiers.map(([name]) => (
          <a key={name} href="/donate">
            {name}
          </a>
        ))}
        <a href="/join" target="_blank" rel="noopener">
          New tab
        </a>
        <a href="/shop/union-t-shirt" download>
          Download
        </a>
      </ShareCodeCarrier>
    </Sdk>
  );
  for (const [name, init] of modifiers) {
    expect(click(link(name), init), name).toEqual({ prevented: false });
    expect(link(name).getAttribute("href"), name).toBe(at(`/donate?r=${code}`));
  }
  expect(click(link("New tab"))).toEqual({ prevented: false });
  expect(link("New tab").getAttribute("href")).toBe(at(`/join?r=${code}`));
  expect(click(link("Download"))).toEqual({ prevented: false });
  expect(link("Download").getAttribute("href")).toBe(
    at(`/shop/union-t-shirt?r=${code}`)
  );
  expect(navigateTo).not.toHaveBeenCalled();
});

test("carries the code on a middle-click's auxclick and keeps its default, so the new tab opens with it", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
        <a href="/join/volunteers?ref=footer#form">
          <span>Join</span>
        </a>
      </ShareCodeCarrier>
    </Sdk>
  );
  expect(middleClick(link("Give"))).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe(at(`/donate?r=${code}`));
  // with a modifier key, on an element inside the link
  expect(middleClick(screen.getByText("Join"), { shiftKey: true })).toEqual({
    prevented: false,
  });
  expect(link("Join").getAttribute("href")).toBe(
    at(`/join/volunteers?ref=footer&r=${code}#form`)
  );
  expect(navigateTo).not.toHaveBeenCalled();
});

test("leaves an auxclick with another button alone", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  // the secondary button opens the link's menu through contextmenu, and the
  // fourth and fifth are back and forward
  for (const button of [2, 3, 4]) {
    expect(middleClick(link("Give"), { button }), `button ${button}`).toEqual({
      prevented: false,
    });
    expect(link("Give").getAttribute("href"), `button ${button}`).toBe(
      "/donate"
    );
  }
  expect(navigateTo).not.toHaveBeenCalled();
});

test("carries the code on a context menu, a right click or a long press, and keeps its default, so Open in new tab and Copy link address carry it alike", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
        <a href="/events/weekly-phone-bank">
          <span>Event</span>
        </a>
      </ShareCodeCarrier>
    </Sdk>
  );
  expect(contextMenu(link("Give"))).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe(at(`/donate?r=${code}`));
  // a long press, or the keyboard's menu key, raises it with the primary
  // button; here on an element inside the link
  expect(contextMenu(screen.getByText("Event"), { button: 0 })).toEqual({
    prevented: false,
  });
  expect(link("Event").getAttribute("href")).toBe(
    at(`/events/weekly-phone-bank?r=${code}`)
  );
  expect(navigateTo).not.toHaveBeenCalled();
});

test("a context menu, then a plain click: one r, by document, and the router stays out", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <RouterLink to="/donate">Give</RouterLink>
      </ShareCodeCarrier>
    </Sdk>
  );
  expect(contextMenu(link("Give"))).toEqual({ prevented: false });
  expect(shareCodes(link("Give"))).toEqual([code]);
  // the menu dismissed, the link is clicked
  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(route).not.toHaveBeenCalled();
  expect(vi.mocked(navigateTo).mock.calls).toEqual([[at(`/donate?r=${code}`)]]);
});

test("a middle-click, a context menu and a Ctrl-click on one link: one r", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/join">Join</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  expect(middleClick(link("Join"))).toEqual({ prevented: false });
  expect(shareCodes(link("Join"))).toEqual([code]);
  expect(contextMenu(link("Join"))).toEqual({ prevented: false });
  expect(shareCodes(link("Join"))).toEqual([code]);
  expect(click(link("Join"), { ctrlKey: true })).toEqual({ prevented: false });
  expect(link("Join").getAttribute("href")).toBe(at(`/join?r=${code}`));
  expect(navigateTo).not.toHaveBeenCalled();
});

test("keeps the r a link already carries on a middle-click and a context menu", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate?r=Other23456">Give</a>
        <a href="/join?r=">Join</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  for (const [name, gestured] of gestures) {
    expect(gestured(link("Give")), name).toEqual({ prevented: false });
    expect(gestured(link("Join")), name).toEqual({ prevented: false });
  }
  expect(link("Give").getAttribute("href")).toBe("/donate?r=Other23456");
  expect(link("Join").getAttribute("href")).toBe("/join?r=");
  expect(navigateTo).not.toHaveBeenCalled();
});

test("leaves a middle-click and a context menu another handler already cancelled", () => {
  const cancel = (event: Event) => event.preventDefault();
  // the document's capture listeners run before the carrier's
  document.addEventListener("auxclick", cancel, true);
  document.addEventListener("contextmenu", cancel, true);
  try {
    render(
      <Sdk>
        <ShareCodeCarrier>
          <a href="/donate">Give</a>
        </ShareCodeCarrier>
      </Sdk>
    );
    for (const [name, gestured] of gestures) {
      expect(gestured(link("Give")), name).toEqual({ prevented: true });
    }
  } finally {
    document.removeEventListener("auxclick", cancel, true);
    document.removeEventListener("contextmenu", cancel, true);
  }
  expect(link("Give").getAttribute("href")).toBe("/donate");
  expect(navigateTo).not.toHaveBeenCalled();
});

test("leaves a link outside it, to the site's own pages, to another origin and to a donor page alone on every gesture", () => {
  const hrefs = [
    "/about",
    "/events",
    "https://elsewhere.example/donate/x",
    "https://events.organizeos.org/acme/x",
    "/unsubscribe",
  ];
  render(
    <Sdk>
      <a href="/donate">Beside</a>
      <ShareCodeCarrier>
        {hrefs.map((href) => (
          <a key={href} href={href}>
            {href}
          </a>
        ))}
      </ShareCodeCarrier>
    </Sdk>
  );
  for (const [name, gestured] of gestures) {
    expect(gestured(link("Beside")), name).toEqual({ prevented: false });
    for (const href of hrefs) {
      expect(gestured(link(href)), `${name}, ${href}`).toEqual({
        prevented: false,
      });
    }
  }
  expect(link("Beside").getAttribute("href")).toBe("/donate");
  for (const href of hrefs) {
    expect(link(href).getAttribute("href"), href).toBe(href);
  }
  expect(navigateTo).not.toHaveBeenCalled();
});

test("does nothing on either gesture without a well-formed code on the page", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  for (const search of ["?r=bad", `?ref=${code}`, ""]) {
    window.history.replaceState(null, "", `/${search}`);
    for (const [name, gestured] of gestures) {
      expect(gestured(link("Give")), `${name}, ${search}`).toEqual({
        prevented: false,
      });
    }
    expect(link("Give").getAttribute("href"), search).toBe("/donate");
  }
  expect(navigateTo).not.toHaveBeenCalled();
});

test("lets a middle-click and a context menu reach the page's own handlers, and carries them in the capture phase even when the link's own listener stops them", () => {
  const onAuxClick = vi.fn();
  const onContextMenu = vi.fn();
  const onDocument = vi.fn();
  document.addEventListener("auxclick", onDocument);
  document.addEventListener("contextmenu", onDocument);
  try {
    render(
      <Sdk>
        <ShareCodeCarrier>
          <a
            href="/donate"
            onAuxClick={onAuxClick}
            onContextMenu={onContextMenu}
          >
            Give
          </a>
          <a href="/join">Join</a>
          <a href="/shop">Shop</a>
        </ShareCodeCarrier>
      </Sdk>
    );
    expect(middleClick(link("Give"))).toEqual({ prevented: false });
    expect(link("Give").getAttribute("href")).toBe(at(`/donate?r=${code}`));
    expect(contextMenu(link("Give"))).toEqual({ prevented: false });
    expect(onAuxClick).toHaveBeenCalledTimes(1);
    expect(onContextMenu).toHaveBeenCalledTimes(1);
    expect(onDocument).toHaveBeenCalledTimes(2);

    // the link's own listener stops them; the carrier has already run
    for (const name of ["Join", "Shop"]) {
      link(name).addEventListener("auxclick", (event) =>
        event.stopPropagation()
      );
      link(name).addEventListener("contextmenu", (event) =>
        event.stopPropagation()
      );
    }
    expect(middleClick(link("Join"))).toEqual({ prevented: false });
    expect(contextMenu(link("Shop"))).toEqual({ prevented: false });
    expect(link("Join").getAttribute("href")).toBe(at(`/join?r=${code}`));
    expect(link("Shop").getAttribute("href")).toBe(at(`/shop?r=${code}`));
    expect(onDocument).toHaveBeenCalledTimes(2);
  } finally {
    document.removeEventListener("auxclick", onDocument);
    document.removeEventListener("contextmenu", onDocument);
  }
  expect(navigateTo).not.toHaveBeenCalled();
});

test("carries the code in the capture phase, even when the link's own listener stops the click", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  link("Give").addEventListener("click", (event) => event.stopPropagation());
  // false: the carrier prevented the default before the link's listener ran
  expect(fireEvent.click(link("Give"))).toBe(false);
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));
  expect(link("Give").getAttribute("href")).toBe(at(`/donate?r=${code}`));
});

test("reads the code when the link is clicked, not when it renders", () => {
  window.history.replaceState(null, "", "/");
  const { unmount } = render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  window.history.replaceState(null, "", `/?r=${code}`);
  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));
  unmount();
  vi.mocked(navigateTo).mockClear();

  // and the reverse: a code gone from the address by the click is not carried
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  window.history.replaceState(null, "", "/");
  expect(click(link("Give"))).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe("/donate");
  expect(navigateTo).not.toHaveBeenCalled();

  expect(contextMenu(link("Give"))).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe("/donate");
  cleanup();

  // a context menu reads it at the gesture too: rendered without a code, the
  // address gains one before the menu opens
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  window.history.replaceState(null, "", `/?r=${code}`);
  expect(contextMenu(link("Give"))).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe(at(`/donate?r=${code}`));
  expect(navigateTo).not.toHaveBeenCalled();
});

test("keeps a client-side router out: a React onClick that routes unless prevented sees the default prevented", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <RouterLink to="/donate">Give</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </ShareCodeCarrier>
    </Sdk>
  );
  click(link("Give"));
  expect(route).not.toHaveBeenCalled();
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));
  // the router still routes a link the carrier leaves alone
  click(link("About"));
  expect(route).toHaveBeenCalledWith("/about");
  expect(navigateTo).toHaveBeenCalledTimes(1);
});

test("keeps a client-side router out after a Ctrl-click has already put r on the link", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <RouterLink to="/donate">Give</RouterLink>
      </ShareCodeCarrier>
    </Sdk>
  );
  expect(click(link("Give"), { ctrlKey: true })).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe(at(`/donate?r=${code}`));
  expect(navigateTo).not.toHaveBeenCalled();
  // the link has its r now; a plain click still goes by document
  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(route).not.toHaveBeenCalled();
  expect(navigateTo).toHaveBeenCalledTimes(1);
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));
});

test("keeps a client-side router out on a double-click: both clicks go by document to the one address with the code", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <RouterLink to="/events/weekly-phone-bank">Event</RouterLink>
      </ShareCodeCarrier>
    </Sdk>
  );
  const carried = at(`/events/weekly-phone-bank?r=${code}`);
  expect(click(link("Event"), { detail: 1 })).toEqual({ prevented: true });
  // the first click put r on the link
  expect(click(link("Event"), { detail: 2 })).toEqual({ prevented: true });
  expect(route).not.toHaveBeenCalled();
  expect(vi.mocked(navigateTo).mock.calls).toEqual([[carried], [carried]]);
  const href = new URL(link("Event").getAttribute("href") ?? "");
  expect(href.searchParams.getAll("r")).toEqual([code]);
});

test("a carrier inside another navigates once", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <ShareCodeCarrier>
          <a href="/donate">Give</a>
          <a href="/join">Join</a>
        </ShareCodeCarrier>
      </ShareCodeCarrier>
    </Sdk>
  );
  expect(click(link("Give"))).toEqual({ prevented: true });
  expect(navigateTo).toHaveBeenCalledTimes(1);
  expect(navigateTo).toHaveBeenCalledWith(at(`/donate?r=${code}`));
  // a modified click: one r, and no navigation
  expect(click(link("Join"), { ctrlKey: true })).toEqual({ prevented: false });
  const joined = new URL(link("Join").getAttribute("href") ?? "");
  expect(joined.searchParams.getAll("r")).toEqual([code]);
  expect(navigateTo).toHaveBeenCalledTimes(1);
});

test("a carrier inside another gives a middle-click and a context menu one r", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <ShareCodeCarrier>
          <a href="/donate">Give</a>
          <a href="/join">Join</a>
        </ShareCodeCarrier>
      </ShareCodeCarrier>
    </Sdk>
  );
  expect(middleClick(link("Give"))).toEqual({ prevented: false });
  expect(contextMenu(link("Join"))).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe(at(`/donate?r=${code}`));
  expect(link("Join").getAttribute("href")).toBe(at(`/join?r=${code}`));
  expect(navigateTo).not.toHaveBeenCalled();
});

test.each(["canvas", "preview"] as const)(
  "attaches nothing on the %s, even with a code in the address",
  (renderer) => {
    render(
      <Sdk renderer={renderer}>
        <ShareCodeCarrier>
          <a href="/donate">Give</a>
        </ShareCodeCarrier>
      </Sdk>
    );
    expect(window.location.search).toBe(`?r=${code}`);
    expect(click(link("Give"))).toEqual({ prevented: false });
    for (const [name, gestured] of gestures) {
      expect(gestured(link("Give")), name).toEqual({ prevented: false });
    }
    expect(link("Give").getAttribute("href")).toBe("/donate");
    expect(navigateTo).not.toHaveBeenCalled();
  }
);

test("writes no cookie and no storage", () => {
  const cookie = vi.spyOn(Document.prototype, "cookie", "set");
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate">Give</a>
        <a href="/join">Join</a>
        <a href="/shop">Shop</a>
        <a href="/cart">Cart</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  click(link("Give"));
  click(link("Join"), { metaKey: true });
  middleClick(link("Shop"));
  contextMenu(link("Cart"));
  expect(navigateTo).toHaveBeenCalledTimes(1);
  expect(cookie).not.toHaveBeenCalled();
  expect(setItem).not.toHaveBeenCalled();
  expect(document.cookie).toBe("");
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});

test("stops listening when it unmounts", () => {
  const ref = createRef<HTMLDivElement>();
  const { unmount } = render(
    <Sdk>
      <ShareCodeCarrier ref={ref} />
    </Sdk>
  );
  const root = ref.current;
  expect(root).toBeInstanceOf(HTMLDivElement);
  unmount();
  // the same element, back on the page with a link in it
  const anchor = document.createElement("a");
  anchor.href = "/donate";
  root?.append(anchor);
  document.body.append(root as HTMLDivElement);
  expect(click(anchor)).toEqual({ prevented: false });
  for (const [name, gestured] of gestures) {
    expect(gestured(anchor), name).toEqual({ prevented: false });
  }
  expect(anchor.getAttribute("href")).toBe("/donate");
  expect(navigateTo).not.toHaveBeenCalled();
  root?.remove();
});

test("passes its props through to a div and renders its children", () => {
  const ref = createRef<HTMLDivElement>();
  const callbackRef = vi.fn();
  const { container, rerender } = render(
    <Sdk>
      <ShareCodeCarrier
        ref={ref}
        id="events"
        className="grid"
        data-ws-id="root"
        aria-label="Upcoming events"
        style={{ display: "grid" }}
      >
        <p>First</p>
        <p>Second</p>
      </ShareCodeCarrier>
    </Sdk>
  );
  const root = container.firstElementChild as HTMLElement;
  expect(root.tagName).toBe("DIV");
  expect(ref.current).toBe(root);
  expect(root.id).toBe("events");
  expect(root.className).toBe("grid");
  expect(root.getAttribute("data-ws-id")).toBe("root");
  expect(root.getAttribute("aria-label")).toBe("Upcoming events");
  expect(root.style.display).toBe("grid");
  expect([...root.children].map((child) => child.textContent)).toEqual([
    "First",
    "Second",
  ]);
  rerender(
    <Sdk>
      <ShareCodeCarrier ref={callbackRef} />
    </Sdk>
  );
  expect(callbackRef).toHaveBeenCalledWith(container.firstElementChild);
});
