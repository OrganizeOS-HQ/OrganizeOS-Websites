/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { navigateTo } from "../form/navigate";
import type { Renderer } from "../form/submit";
import { DonationForm, DonationFrame } from "./donation-form";

vi.mock("../form/navigate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../form/navigate")>()),
  navigateTo: vi.fn(() => true),
}));

const PLATFORM = "https://app.organizeos.org";
const ORG = "0b5c1a2e-3f4d-4e5a-8b6c-7d8e9f0a1b2c";
const CAMPAIGN = "b1c2d3e4-0000-4000-8000-000000000001";
const LINE = "This form isn't available.";

// The IntersectionObserver the frame's clock waits on: tests decide when the
// wrapper comes near the viewport.
let observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> =
  [];
let observerOptions: Array<IntersectionObserverInit | undefined> = [];
class StubIntersectionObserver {
  constructor(
    callback: (entries: Array<{ isIntersecting: boolean }>) => void,
    options?: IntersectionObserverInit
  ) {
    observers.push(callback);
    observerOptions.push(options);
  }
  observe() {}
  disconnect() {}
}
const comeIntoView = () =>
  act(() => {
    for (const callback of observers) {
      callback([{ isIntersecting: true }]);
    }
  });

const withRenderer = (renderer: Renderer, children: ReactNode) => (
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

type RootProps = Partial<{
  target: string;
  organizationId: string;
  platformOrigin: string;
  afterGift: string;
  afterGiftPage: string;
  state: string;
}>;

const block = (props: RootProps = {}, renderer: Renderer = undefined) =>
  withRenderer(
    renderer,
    <DonationForm
      data-testid="root"
      target="general"
      organizationId={ORG}
      platformOrigin={PLATFORM}
      afterGift="message"
      state="ready"
      {...props}
    >
      <h2>Support our work</h2>
      <DonationFrame data-testid="frame" />
    </DonationForm>
  );

const iframeOf = (container: HTMLElement) =>
  container.querySelector("iframe") as HTMLIFrameElement | null;

const post = (data: unknown, source: unknown, origin: string = PLATFORM) =>
  act(() => {
    const event = new MessageEvent("message", { data, origin });
    Object.defineProperty(event, "source", { value: source });
    window.dispatchEvent(event);
  });

const height = (value: number) => ({ type: "oos-give-height", height: value });
const done = { type: "oos-give-done" };

beforeEach(() => {
  observers = [];
  observerOptions = [];
  vi.stubGlobal("IntersectionObserver", StubIntersectionObserver);
  window.history.replaceState({}, "", "/donate-now?r=AbCdEfGh23");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(navigateTo).mockClear();
});

test("the frame's address and attributes", () => {
  const { container } = render(block());
  const iframe = iframeOf(container)!;
  const url = new URL(iframe.src);
  expect(`${url.origin}${url.pathname}`).toBe(`${PLATFORM}/embed/give/${ORG}`);
  expect(url.searchParams.get("to")).toBe("general");
  expect(url.searchParams.get("path")).toBe("/donate-now");
  expect(url.searchParams.get("parent")).toBe(window.location.origin);
  expect(url.searchParams.get("r")).toBe("AbCdEfGh23");
  expect(url.searchParams.has("preview")).toBe(false);
  expect(iframe.getAttribute("title")).toBe("Donation form");
  expect(iframe.getAttribute("loading")).toBe("lazy");
  expect(iframe.getAttribute("allow")).toBe("payment");
  expect(iframe.getAttribute("sandbox")).toBe(
    "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
  );
  expect(iframe.getAttribute("referrerpolicy")).toBe(
    "strict-origin-when-cross-origin"
  );
});

test("on the canvas and in the builder's preview", () => {
  const canvas = render(block({ state: "unavailable" }, "canvas"));
  const onCanvas = new URL(iframeOf(canvas.container)!.src);
  expect(onCanvas.searchParams.get("preview")).toBe("1");
  expect(onCanvas.searchParams.get("state")).toBe("unavailable");
  cleanup();
  const preview = render(block({ state: "unavailable" }, "preview"));
  const inPreview = new URL(iframeOf(preview.container)!.src);
  expect(inPreview.searchParams.get("preview")).toBe("1");
  expect(inPreview.searchParams.has("state")).toBe(false);
});

test.each([
  [
    "an http platform origin",
    { platformOrigin: "http://app.organizeos.org" },
    "Re-insert this block.",
  ],
  [
    "a platform origin with a path",
    { platformOrigin: `${PLATFORM}/` },
    "Re-insert this block.",
  ],
  ["a malformed org id", { organizationId: "x" }, "Re-insert this block."],
  ["a malformed target", { target: "x" }, "Pick what this form gives to."],
  ["an empty target", { target: "" }, "Pick what this form gives to."],
])("%s renders Unavailable with no frame", (_label, props, check) => {
  const live = render(block(props));
  expect(iframeOf(live.container)).toBeNull();
  expect(live.getByText(LINE)).toBeTruthy();
  cleanup();
  const canvas = render(block(props, "canvas"));
  expect(iframeOf(canvas.container)).toBeNull();
  expect(canvas.getByText(check)).toBeTruthy();
});

test("a frame part outside a Donation form renders the line", () => {
  const { container, getByText } = render(
    withRenderer(undefined, <DonationFrame />)
  );
  expect(iframeOf(container)).toBeNull();
  expect(getByText(LINE)).toBeTruthy();
});

test("height follows the frame", () => {
  const { container } = render(block());
  const iframe = iframeOf(container)!;
  post(height(812), iframe.contentWindow);
  expect(iframe.style.height).toBe("812px");
  post(height(300), iframe.contentWindow, "https://evil.example");
  post(height(300), window);
  expect(iframe.style.height).toBe("812px");
});

test("no timer before the frame is near or loaded", () => {
  vi.useFakeTimers();
  const { container, queryByText } = render(block());
  act(() => vi.advanceTimersByTime(60_000));
  expect(queryByText(LINE)).toBeNull();
  comeIntoView();
  act(() => vi.advanceTimersByTime(9_900));
  expect(queryByText(LINE)).toBeNull();
  act(() => vi.advanceTimersByTime(200));
  expect(queryByText(LINE)).toBeTruthy();
  expect(iframeOf(container)).not.toBeNull();
});

// Final review I1: every browser has started a lazy frame's load once it
// reaches the viewport, whatever its own lazy-load distance.
test("the clock watches the viewport itself, with no margin", () => {
  render(block());
  expect(observerOptions).toEqual([{ rootMargin: "0px" }]);
});

test("a load event alone starts the clock", () => {
  vi.useFakeTimers();
  const { container, queryByText } = render(block());
  act(() => {
    iframeOf(container)!.dispatchEvent(new Event("load"));
  });
  act(() => vi.advanceTimersByTime(10_100));
  expect(queryByText(LINE)).toBeTruthy();
});

test("without IntersectionObserver the clock starts at mount", () => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", undefined);
  const { queryByText } = render(block());
  act(() => vi.advanceTimersByTime(10_100));
  expect(queryByText(LINE)).toBeTruthy();
});

test("ten seconds without an answer hides the frame and shows the line", () => {
  vi.useFakeTimers();
  const { container, queryByText } = render(block(), {});
  comeIntoView();
  act(() => vi.advanceTimersByTime(10_100));
  const iframe = iframeOf(container)!;
  expect(iframe).not.toBeNull();
  expect(iframe.getAttribute("aria-hidden")).toBe("true");
  expect(iframe.style.display).not.toBe("none");
  expect(iframe.style.opacity).toBe("0");
  // final review M2: hidden from assistive technology, so out of the tab order
  expect(iframe.getAttribute("tabindex")).toBe("-1");
  expect(queryByText(LINE)).toBeTruthy();
});

test("on the canvas the check adds Form didn't load", () => {
  vi.useFakeTimers();
  const { queryByText } = render(block({}, "canvas"));
  comeIntoView();
  act(() => vi.advanceTimersByTime(10_100));
  expect(queryByText("Form didn't load")).toBeTruthy();
});

test("a height before the timeout keeps the frame", () => {
  vi.useFakeTimers();
  const { container, queryByText } = render(block());
  comeIntoView();
  act(() => vi.advanceTimersByTime(9_900));
  post(height(700), iframeOf(container)!.contentWindow);
  act(() => vi.advanceTimersByTime(5_000));
  expect(queryByText(LINE)).toBeNull();
  expect(iframeOf(container)!.getAttribute("aria-hidden")).toBeNull();
});

test("a height after the timeout brings the frame back", () => {
  vi.useFakeTimers();
  const { container, queryByText } = render(block());
  comeIntoView();
  act(() => vi.advanceTimersByTime(10_100));
  expect(queryByText(LINE)).toBeTruthy();
  post(height(720), iframeOf(container)!.contentWindow);
  expect(queryByText(LINE)).toBeNull();
  const iframe = iframeOf(container)!;
  expect(iframe.getAttribute("aria-hidden")).toBeNull();
  expect(iframe.getAttribute("tabindex")).toBeNull();
  expect(iframe.style.height).toBe("720px");
});

test("a new target reloads the frame and restarts the timer", () => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", undefined);
  const { container, queryByText, rerender } = render(block());
  const first = iframeOf(container)!;
  act(() => vi.advanceTimersByTime(8_000));
  rerender(block({ target: CAMPAIGN }));
  const second = iframeOf(container)!;
  expect(second).not.toBe(first);
  expect(new URL(second.src).searchParams.get("to")).toBe(CAMPAIGN);
  act(() => vi.advanceTimersByTime(4_000));
  expect(queryByText(LINE)).toBeNull();
  act(() => vi.advanceTimersByTime(6_100));
  expect(queryByText(LINE)).toBeTruthy();
});

test("two blocks take only their own frame's messages", () => {
  const { container } = render(
    <>
      {block({ afterGift: "page", afterGiftPage: "/thanks-a" })}
      {block({ afterGift: "page", afterGiftPage: "/thanks-b" })}
    </>
  );
  const [a, b] = [...container.querySelectorAll("iframe")];
  post(height(900), a.contentWindow);
  expect(a.style.height).toBe("900px");
  expect(b.style.height).toBe("640px");
  post(done, a.contentWindow);
  expect(navigateTo).toHaveBeenCalledTimes(1);
  expect(navigateTo).toHaveBeenCalledWith(`${window.location.origin}/thanks-a`);
});

test("after the gift", () => {
  const page = render(block({ afterGift: "page", afterGiftPage: "/thanks" }));
  post(done, iframeOf(page.container)!.contentWindow);
  expect(navigateTo).toHaveBeenCalledWith(`${window.location.origin}/thanks`);
  cleanup();
  vi.mocked(navigateTo).mockClear();
  for (const props of [
    { afterGift: "message", afterGiftPage: "/thanks" },
    { afterGift: "page", afterGiftPage: "https://evil.example/" },
    { afterGift: "page", afterGiftPage: "javascript:alert(1)" },
  ]) {
    const rendered = render(block(props));
    post(done, iframeOf(rendered.container)!.contentWindow);
    cleanup();
  }
  for (const renderer of ["canvas", "preview"] as const) {
    const rendered = render(
      block({ afterGift: "page", afterGiftPage: "/thanks" }, renderer)
    );
    post(done, iframeOf(rendered.container)!.contentWindow);
    cleanup();
  }
  expect(navigateTo).not.toHaveBeenCalled();
});

test("the root keeps its props off the page", () => {
  const { getByTestId } = render(
    block({ afterGift: "page", afterGiftPage: "/thanks" })
  );
  const root = getByTestId("root");
  for (const name of [
    "target",
    "organizationid",
    "organizationId",
    "platformorigin",
    "platformOrigin",
    "aftergift",
    "afterGift",
    "aftergiftpage",
    "afterGiftPage",
    "state",
  ]) {
    expect(root.hasAttribute(name), name).toBe(false);
  }
});
