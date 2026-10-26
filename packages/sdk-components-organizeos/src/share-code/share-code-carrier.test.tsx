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

const link = (name: string) => screen.getByRole("link", { name });

beforeEach(() => {
  window.history.replaceState(null, "", `/?r=${code}`);
  window.addEventListener("click", observe);
});

afterEach(() => {
  cleanup();
  window.removeEventListener("click", observe);
  vi.mocked(navigateTo).mockClear();
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

test("leaves a link that already carries r", () => {
  render(
    <Sdk>
      <ShareCodeCarrier>
        <a href="/donate?r=Other23456">Give</a>
        <a href="/join?r=">Join</a>
      </ShareCodeCarrier>
    </Sdk>
  );
  expect(click(link("Give"))).toEqual({ prevented: false });
  expect(click(link("Join"))).toEqual({ prevented: false });
  expect(link("Give").getAttribute("href")).toBe("/donate?r=Other23456");
  expect(link("Join").getAttribute("href")).toBe("/join?r=");
  expect(navigateTo).not.toHaveBeenCalled();
});

test("rewrites the href but lets the browser handle a modified, new-tab or download click", () => {
  const modifiers: Array<[string, MouseEventInit]> = [
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
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
});

test("keeps a client-side router out: a React onClick that routes unless prevented sees the default prevented", () => {
  const route = vi.fn();
  const RouterLink = ({
    to,
    children,
  }: {
    to: string;
    children: ReactNode;
  }) => (
    <a
      href={to}
      onClick={(event) => {
        // what a router's link does: route, unless another handler prevented it
        if (event.defaultPrevented === false) {
          event.preventDefault();
          route(to);
        }
      }}
    >
      {children}
    </a>
  );
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
      </ShareCodeCarrier>
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
