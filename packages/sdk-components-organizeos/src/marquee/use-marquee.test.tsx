/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import type { Renderer } from "../form/submit";
import { Marquee } from "./marquee";
import { MarqueePauseButton } from "./marquee-pause-button";
import { MarqueeTrack } from "./marquee-track";
import { clampSpeed } from "./use-marquee";

// jsdom can only dispatch untrusted events; the tests say which ones a
// visitor caused.
const { trusted } = vi.hoisted(() => ({ trusted: new WeakSet<Event>() }));
vi.mock("../rotation/trusted", () => ({
  isTrusted: (event: Event) => trusted.has(event),
}));

/* Browser stand-ins (plan amendment 4). */

type FakeAnimation = {
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  currentTime: number | null;
  playState: AnimationPlayState;
};
type Call = {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: FakeAnimation;
};
let calls: Call[] = [];
const lastAnimation = () => calls[calls.length - 1].animation;

const proto = Element.prototype as unknown as Record<string, unknown>;

const media = { matches: false, listeners: new Set<() => void>() };
const setReducedMotion = (matches: boolean) => {
  media.matches = matches;
  act(() => {
    for (const listener of media.listeners) {
      listener();
    }
  });
};

const intersections = new Set<{
  callback: IntersectionObserverCallback;
  targets: Element[];
}>();
class FakeIntersectionObserver {
  record: { callback: IntersectionObserverCallback; targets: Element[] };
  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, targets: [] };
    intersections.add(this.record);
  }
  observe(target: Element) {
    this.record.targets.push(target);
  }
  disconnect() {
    intersections.delete(this.record);
  }
}
const setOnScreen = (isIntersecting: boolean) => {
  act(() => {
    for (const { callback, targets } of intersections) {
      callback(
        targets.map(
          (target) => ({ target, isIntersecting }) as IntersectionObserverEntry
        ),
        {} as IntersectionObserver
      );
    }
  });
};

const resizes = new Set<{
  callback: ResizeObserverCallback;
  targets: Element[];
}>();
class FakeResizeObserver {
  record: { callback: ResizeObserverCallback; targets: Element[] };
  constructor(callback: ResizeObserverCallback) {
    this.record = { callback, targets: [] };
    resizes.add(this.record);
  }
  observe(target: Element) {
    this.record.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    resizes.delete(this.record);
  }
}
/* The browser reports a size change of the observed boxes. */
const resize = () => {
  act(() => {
    for (const { callback, targets } of resizes) {
      callback(
        targets.map((target) => ({ target }) as ResizeObserverEntry),
        {} as ResizeObserver
      );
    }
  });
};

let visibility: DocumentVisibilityState = "visible";
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

/*
 * Layout: jsdom lays nothing out, so the getters the runtime reads are
 * stubbed per element. Item i (`data-item`) sits at `itemLeft(i)` with
 * `itemWidth(i)`; its clone, inside the inert container, sits one period
 * further, `period(count)` for `count` original items. The root
 * (`data-testid="root"`) is `rootWidth` wide.
 */
let rootWidth = 300;
let itemWidth = (_index: number) => 100;
let itemLeft = (index: number) => index * 116;
let period = (count: number) => count * 116;

const countOriginals = (element: Element) =>
  [...(element.closest('[data-testid="track"]')?.children ?? [])].filter(
    (child) => child.hasAttribute("data-item")
  ).length;

const stubLayout = () => {
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
    function (this: HTMLElement) {
      const index = this.dataset.item;
      if (index === undefined) {
        return 0;
      }
      const clone = this.closest("[inert]") !== null;
      return (
        itemLeft(Number(index)) + (clone ? period(countOriginals(this)) : 0)
      );
    }
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      const index = this.dataset.item;
      return index === undefined ? 0 : itemWidth(Number(index));
    }
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.dataset.testid === "root" ? rootWidth : 0;
    }
  );
};

beforeEach(() => {
  calls = [];
  media.matches = false;
  media.listeners.clear();
  intersections.clear();
  resizes.clear();
  visibility = "visible";
  rootWidth = 300;
  itemWidth = () => 100;
  itemLeft = (index) => index * 116;
  period = (count) => count * 116;
  stubLayout();
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return query === "(prefers-reduced-motion: reduce)" && media.matches;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) =>
        media.listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        media.listeners.delete(listener),
    }))
  );
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  proto.animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ) {
    const animation: FakeAnimation = {
      currentTime: 0,
      playState: "running",
      pause: vi.fn(() => {
        animation.playState = "paused";
      }),
      play: vi.fn(() => {
        animation.playState = "running";
      }),
      cancel: vi.fn(() => {
        animation.playState = "idle";
      }),
    };
    calls.push({ target: this, keyframes, options, animation });
    return animation;
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete proto.animate;
});

const Sdk = ({
  renderer,
  children,
}: {
  renderer: Renderer;
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

const Section = ({
  renderer,
  speed,
  direction,
  count = 5,
  links = true,
  buttonLast = false,
  noButton = false,
}: {
  renderer?: Renderer;
  speed?: unknown;
  direction?: string;
  count?: number;
  links?: boolean;
  buttonLast?: boolean;
  noButton?: boolean;
}) => {
  const button = noButton ? null : (
    <MarqueePauseButton key="button" data-testid="button" />
  );
  const track = (
    <MarqueeTrack key="track" data-testid="track">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} data-item={index} id={`item-${index}`}>
          {links ? (
            <a href={`#${index}`} id={`link-${index}`}>{`Item ${index}`}</a>
          ) : (
            <span id={`text-${index}`}>{`Item ${index}`}</span>
          )}
        </div>
      ))}
    </MarqueeTrack>
  );
  return (
    <Sdk renderer={renderer}>
      <Marquee
        data-testid="root"
        speed={speed as number | undefined}
        direction={direction}
      >
        {buttonLast ? [track, button] : [button, track]}
      </Marquee>
    </Sdk>
  );
};

const getRoot = () =>
  document.querySelector('[data-testid="root"]') as HTMLElement;
const getButton = () =>
  document.querySelector('[data-testid="button"]') as HTMLButtonElement;
const getTrack = () =>
  document.querySelector('[data-testid="track"]') as HTMLElement;
const getContainers = () => [...document.querySelectorAll("[inert]")];
const getLink = (index: number) =>
  document.getElementById(`link-${index}`) as HTMLElement;

/* An event the visitor caused. */
const visitor = (target: EventTarget, event: Event) => {
  trusted.add(event);
  act(() => {
    target.dispatchEvent(event);
  });
};
/* The same event, from a script. */
const script = (target: EventTarget, event: Event) => {
  act(() => {
    target.dispatchEvent(event);
  });
};
const focusIn = () => new FocusEvent("focusin", { bubbles: true });
/* A visitor tabs to an element: it takes focus, then focusin bubbles. */
const tabTo = (element: HTMLElement) => {
  element.focus();
  visitor(element, focusIn());
};

// The server markup of the track's items, as a published page has it.
const serverTrackHtml = (props: Parameters<typeof Section>[0] = {}) => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<Section {...props} />);
  return (container.querySelector('[data-testid="track"]') as HTMLElement)
    .innerHTML;
};

const flush = () => act(async () => {});

describe("clampSpeed", () => {
  test.each([
    [undefined, 40],
    [null, 40],
    ["", 40],
    [" ", 40],
    ["fast", 40],
    [Number.NaN, 40],
    [Number.POSITIVE_INFINITY, 40],
    [{}, 40],
    [0, 10],
    [5, 10],
    [10, 10],
    [80, 80],
    ["120", 120],
    [200, 200],
    [1000, 200],
  ])("%s px/s is %s", (value, expected) => {
    expect(clampSpeed(value)).toBe(expected);
  });
});

describe("the server markup", () => {
  test("holds each item once, no copies, and the button hidden", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Section />);
    const button = container.querySelector(
      '[data-testid="button"]'
    ) as HTMLButtonElement;
    expect(button.hidden).toBe(true);
    expect(button.style.display).toBe("none");
    expect(button.textContent).toBe("Pause");
    expect(container.querySelectorAll("[data-item]")).toHaveLength(5);
    expect(container.querySelector("[inert]")).toBeNull();
    expect(container.querySelector("[aria-hidden]")).toBeNull();
    for (let index = 0; index < 5; index += 1) {
      expect(
        container.textContent?.split(`Item ${index}`).length,
        `Item ${index}`
      ).toBe(2);
    }
  });
});

describe("starting", () => {
  test("after mount it drifts the track by one period: W / speed seconds, linear, forever", () => {
    render(<Section />);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.target).toBe(getTrack());
    // 5 items of 100px with a 16px gap: W = 580
    expect(call.keyframes).toEqual([
      { transform: "translateX(0px)" },
      { transform: "translateX(-580px)" },
    ]);
    expect(call.options).toEqual({
      duration: 14_500,
      iterations: Number.POSITIVE_INFINITY,
      easing: "linear",
      direction: "normal",
    });
    expect(call.animation.currentTime).toBe(0);
    expect(call.animation.playState).toBe("running");
    expect(getButton().hidden).toBe(false);
    expect(getButton().style.display).toBe("");
    expect(getButton().textContent).toBe("Pause");
  });

  test("appends one container of copies after the items: aria-hidden, inert, display contents, no ids", () => {
    render(<Section />);
    const track = getTrack();
    const containers = getContainers();
    expect(containers).toHaveLength(1);
    const [container] = containers as HTMLElement[];
    expect(track.lastElementChild).toBe(container);
    expect(container.tagName).toBe("DIV");
    expect(container.getAttribute("aria-hidden")).toBe("true");
    // jsdom does not reflect inert as a property (spec 12.10)
    expect(container.getAttribute("inert")).toBe("");
    expect(container.getAttribute("style")).toBe("display: contents;");
    expect([...container.children].map((clone) => clone.textContent)).toEqual([
      "Item 0",
      "Item 1",
      "Item 2",
      "Item 3",
      "Item 4",
    ]);
    expect(container.querySelectorAll("[id]")).toHaveLength(0);
    expect(container.querySelectorAll("a[href]")).toHaveLength(5);
    // the originals keep theirs, and are the track's own children
    expect(document.querySelectorAll('[id^="item-"]')).toHaveLength(5);
    expect(document.querySelectorAll('[id^="link-"]')).toHaveLength(5);
    expect(
      [...track.children].filter((child) => child !== container)
    ).toHaveLength(5);
  });

  test("W is measured from the first copy, with the gap and the items' margins, never summed", () => {
    // uneven items with margins: the copies start 700px after the originals
    const lefts = [8, 140, 300, 420, 560];
    itemLeft = (index) => lefts[index];
    itemWidth = (index) => [90, 120, 80, 100, 110][index];
    period = () => 700;
    render(<Section speed={70} />);
    expect(calls[0].keyframes[1]).toEqual({
      transform: "translateX(-700px)",
    });
    expect(calls[0].options.duration).toBe(10_000);
  });

  test("the duration follows the clamped speed", () => {
    render(<Section speed={80} />);
    expect(calls[0].options.duration).toBe(7250);
    cleanup();
    render(<Section speed="1000" />);
    expect(calls[1].options.duration).toBe(2900);
    cleanup();
    render(<Section speed="slow" />);
    expect(calls[2].options.duration).toBe(14_500);
  });

  test("direction right runs the keyframes reversed", () => {
    render(<Section direction="right" />);
    expect(calls[0].options.direction).toBe("reverse");
    expect(calls[0].keyframes[1]).toEqual({
      transform: "translateX(-580px)",
    });
  });

  test("on a right-to-left root the default direction flips, and an explicit one holds", () => {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element: Element) =>
        (element as HTMLElement).dataset?.testid === "root"
          ? ({ direction: "rtl" } as CSSStyleDeclaration)
          : real(element)
    );
    render(<Section />);
    expect(calls[0].options.direction).toBe("reverse");
    cleanup();
    render(<Section direction="left" />);
    expect(calls[1].options.direction).toBe("normal");
  });

  test("laid out right to left (the copies to the left), the default drifts right and left is the reverse", () => {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element: Element) =>
        (element as HTMLElement).dataset?.testid === "root"
          ? ({ direction: "rtl" } as CSSStyleDeclaration)
          : real(element)
    );
    // the first item at the right, the rest and then the copies to its left
    itemLeft = (index) => 400 - index * 116;
    period = (count) => -count * 116;
    render(<Section />);
    // natural for this layout: drifting right
    expect(calls[0].keyframes[1]).toEqual({ transform: "translateX(580px)" });
    expect(calls[0].options.direction).toBe("normal");
    expect(calls[0].options.duration).toBe(14_500);
    cleanup();
    render(<Section direction="left" />);
    expect(calls[1].options.direction).toBe("reverse");
  });
});

describe("never starting", () => {
  const expectOff = () => {
    expect(calls).toEqual([]);
    expect(getContainers()).toEqual([]);
  };

  test("on the canvas: nothing moves, and the button shows its Pause label", () => {
    render(<Section renderer="canvas" />);
    expectOff();
    expect(getButton().hidden).toBe(false);
    expect(getButton().textContent).toBe("Pause");
    act(() => {
      getButton().click();
    });
    expect(getButton().textContent).toBe("Pause");
  });

  test("under reduced motion: the button stays hidden", () => {
    media.matches = true;
    render(<Section />);
    expectOff();
    expect(getButton().hidden).toBe(true);
    expect(getButton().style.display).toBe("none");
  });

  test("when the items fit in the root", () => {
    rootWidth = 564;
    render(<Section />);
    expectOff();
    expect(getButton().hidden).toBe(true);
  });

  test("in an engine without element.animate (plan amendment 2)", () => {
    delete proto.animate;
    render(<Section />);
    expect(getContainers()).toEqual([]);
    expect(getButton().hidden).toBe(true);
  });

  test("when the button comes after the track", () => {
    render(<Section buttonLast />);
    expectOff();
    expect(getButton().hidden).toBe(true);
  });

  test("without a button", () => {
    render(<Section noButton />);
    expectOff();
  });

  test("with two tracks", () => {
    render(
      <Sdk renderer={undefined}>
        <Marquee data-testid="root">
          <MarqueePauseButton data-testid="button" />
          <MarqueeTrack data-testid="track">
            <div data-item="0">Item 0</div>
          </MarqueeTrack>
          <MarqueeTrack>
            <div data-item="1">Item 1</div>
          </MarqueeTrack>
        </Marquee>
      </Sdk>
    );
    expectOff();
    expect(getButton().hidden).toBe(true);
  });

  test("with a part wrapped rather than directly inside the root", () => {
    render(
      <Sdk renderer={undefined}>
        <Marquee data-testid="root">
          <MarqueePauseButton data-testid="button" />
          <div>
            <MarqueeTrack data-testid="track">
              <div data-item="0">Item 0</div>
            </MarqueeTrack>
          </div>
        </Marquee>
      </Sdk>
    );
    expectOff();
  });
});

describe("pausing", () => {
  test("while the pointer is over the root, keeping the Pause label", () => {
    render(<Section />);
    const animation = lastAnimation();
    script(getRoot(), new Event("pointerenter"));
    expect(animation.pause).toHaveBeenCalledTimes(1);
    expect(getButton().textContent).toBe("Pause");
    script(getRoot(), new Event("pointerleave"));
    expect(animation.play).toHaveBeenCalledTimes(1);
    expect(animation.playState).toBe("running");
  });

  test("while the root is off screen", () => {
    render(<Section />);
    const animation = lastAnimation();
    setOnScreen(false);
    expect(animation.playState).toBe("paused");
    setOnScreen(true);
    expect(animation.playState).toBe("running");
  });

  test("while the document is hidden, and from the start in a hidden document", () => {
    render(<Section />);
    const animation = lastAnimation();
    setVisibility("hidden");
    expect(animation.playState).toBe("paused");
    setVisibility("visible");
    expect(animation.playState).toBe("running");

    cleanup();
    visibility = "hidden";
    render(<Section />);
    expect(lastAnimation().playState).toBe("paused");
    expect(getButton().textContent).toBe("Pause");
  });

  test("pauses add up: leaving the root does not resume a hidden document", () => {
    render(<Section />);
    const animation = lastAnimation();
    script(getRoot(), new Event("pointerenter"));
    setVisibility("hidden");
    script(getRoot(), new Event("pointerleave"));
    expect(animation.playState).toBe("paused");
    setVisibility("visible");
    expect(animation.playState).toBe("running");
  });
});

describe("the Pause button", () => {
  test("toggles Pause and Play, and Play resumes from the paused position", () => {
    render(<Section />);
    const animation = lastAnimation();
    animation.currentTime = 3000;
    act(() => {
      getButton().click();
    });
    expect(getButton().textContent).toBe("Play");
    expect(animation.playState).toBe("paused");
    // hover ends: still stopped
    script(getRoot(), new Event("pointerleave"));
    expect(animation.playState).toBe("paused");

    act(() => {
      getButton().click();
    });
    expect(getButton().textContent).toBe("Pause");
    expect(animation.play).toHaveBeenCalledTimes(1);
    expect(animation.playState).toBe("running");
    expect(animation.currentTime).toBe(3000);
    expect(calls).toHaveLength(1);
    expect(animation.cancel).not.toHaveBeenCalled();
  });

  test("takes its labels from its own props", () => {
    render(
      <Sdk renderer={undefined}>
        <Marquee data-testid="root">
          <MarqueePauseButton
            data-testid="button"
            pauseLabel="Pausar"
            playLabel="Reproducir"
          />
          <MarqueeTrack data-testid="track">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} data-item={index}>{`Item ${index}`}</div>
            ))}
          </MarqueeTrack>
        </Marquee>
      </Sdk>
    );
    expect(getButton().textContent).toBe("Pausar");
    act(() => {
      getButton().click();
    });
    expect(getButton().textContent).toBe("Reproducir");
  });
});

describe("keyboard focus", () => {
  test("entering the track stops the motion until Play", () => {
    render(<Section />);
    const animation = lastAnimation();
    tabTo(getLink(0));
    expect(getButton().textContent).toBe("Play");
    expect(animation.playState).toBe("paused");
    script(getRoot(), new Event("pointerenter"));
    script(getRoot(), new Event("pointerleave"));
    expect(animation.playState).toBe("paused");
    act(() => {
      getButton().click();
    });
    expect(animation.playState).toBe("running");
  });

  test("on the button does not stop it", () => {
    render(<Section />);
    tabTo(getButton());
    expect(getButton().textContent).toBe("Pause");
    expect(lastAnimation().playState).toBe("running");
  });

  test("a script's focusin does not stop it", () => {
    render(<Section />);
    script(getLink(0), focusIn());
    expect(getButton().textContent).toBe("Pause");
    expect(lastAnimation().playState).toBe("running");
  });

  // Item i's box, relative to the root, at the animation's current time,
  // from the same stubs the runtime reads.
  const boxAt = (index: number, reverse = false) => {
    const animation = lastAnimation();
    const progress = (Number(animation.currentTime) / 14_500) % 1;
    const shift = reverse ? (1 - progress) % 1 : progress;
    const left = itemLeft(index) - itemLeft(0) - 580 * shift;
    return { left, right: left + itemWidth(index) };
  };

  test("an item outside the root's box is brought inside it (spec 12.1)", () => {
    render(<Section />);
    // at rest item 4 spans 464..564, past the root's 300px
    expect(boxAt(4).right).toBeGreaterThan(rootWidth);
    tabTo(getLink(4));
    // the nearest time its box fits: shifted 264px, 6.6 s at 40 px/s
    expect(lastAnimation().currentTime).toBeCloseTo(6600, 6);
    expect(boxAt(4).left).toBeGreaterThanOrEqual(0);
    expect(boxAt(4).right).toBeLessThanOrEqual(rootWidth + 1e-6);

    // and again on each later focus while stopped: item 0 is now at -264
    expect(boxAt(0).left).toBeLessThan(0);
    tabTo(getLink(0));
    expect(lastAnimation().currentTime).toBeCloseTo(0, 6);
    expect(boxAt(0).left).toBeCloseTo(0, 6);
    expect(calls).toHaveLength(1);
  });

  test("an item already inside the root's box leaves the time alone", () => {
    render(<Section />);
    lastAnimation().currentTime = 1000;
    tabTo(getLink(2));
    expect(lastAnimation().currentTime).toBe(1000);
  });

  test("drifting right, the time is found the same way", () => {
    render(<Section direction="right" />);
    tabTo(getLink(4));
    expect(lastAnimation().currentTime).toBeCloseTo(14_500 - 6600, 6);
    expect(boxAt(4, true).left).toBeGreaterThanOrEqual(0);
    expect(boxAt(4, true).right).toBeLessThanOrEqual(rootWidth + 1e-6);
  });

  test("laid out right to left, an item past the left edge is brought inside", () => {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (element: Element) =>
        (element as HTMLElement).dataset?.testid === "root"
          ? ({ direction: "rtl" } as CSSStyleDeclaration)
          : real(element)
    );
    // item 0 ends at the root's right edge (500); the root shows 200..500
    itemLeft = (index) => 400 - index * 116;
    period = (count) => -count * 116;
    render(<Section />);
    // item 4 spans -64..36 at rest
    tabTo(getLink(4));
    // moved right by 264px, to 200..300
    expect(lastAnimation().currentTime).toBeCloseTo(6600, 6);
  });

  test("an item past the edge on its way in is reached from the current time", () => {
    render(<Section />);
    // shifted 400px: item 0 has left the root, its copy is coming in
    lastAnimation().currentTime = 10_000;
    tabTo(getLink(0));
    // the original is brought back: the nearest shift that shows it is 0
    expect(lastAnimation().currentTime).toBeCloseTo(0, 6);
  });
});

describe("reduced motion turned on mid-visit", () => {
  test("cancels the motion, removes the copies, and hides the button", () => {
    const serverHtml = serverTrackHtml();
    render(<Section />);
    const animation = lastAnimation();
    setReducedMotion(true);
    expect(animation.cancel).toHaveBeenCalledTimes(1);
    expect(getContainers()).toEqual([]);
    expect(getTrack().innerHTML).toBe(serverHtml);
    expect(getButton().hidden).toBe(true);
    expect(getButton().style.display).toBe("none");
    // and nothing starts again
    resize();
    setReducedMotion(false);
    resize();
    expect(calls).toHaveLength(1);
  });

  test("moves focus from the button to the first focusable item", () => {
    render(<Section />);
    getButton().focus();
    setReducedMotion(true);
    expect(document.activeElement).toBe(getLink(0));
  });

  test("with no focusable item, focus goes to the root, which gives up its tabindex on blur", () => {
    render(<Section links={false} />);
    getButton().focus();
    setReducedMotion(true);
    expect(document.activeElement).toBe(getRoot());
    expect(getRoot().getAttribute("tabindex")).toBe("-1");
    act(() => {
      getRoot().blur();
    });
    expect(getRoot().hasAttribute("tabindex")).toBe(false);
  });

  test("leaves focus elsewhere alone", () => {
    render(<Section />);
    tabTo(getLink(2));
    setReducedMotion(true);
    expect(document.activeElement).toBe(getLink(2));
  });
});

describe("resizing (spec 12.4)", () => {
  test("starts when the root narrows below the items, and stops when it widens past them", () => {
    rootWidth = 800;
    const serverHtml = serverTrackHtml();
    render(<Section />);
    expect(calls).toEqual([]);
    expect(getButton().hidden).toBe(true);

    rootWidth = 300;
    resize();
    expect(calls).toHaveLength(1);
    expect(getContainers()).toHaveLength(1);
    expect(getButton().hidden).toBe(false);

    rootWidth = 800;
    resize();
    expect(calls[0].animation.cancel).toHaveBeenCalledTimes(1);
    expect(getContainers()).toEqual([]);
    expect(getTrack().innerHTML).toBe(serverHtml);
    expect(getButton().hidden).toBe(true);
  });

  test("ignores the size change its own copies cause", () => {
    render(<Section />);
    resize();
    resize();
    expect(calls).toHaveLength(1);
    expect(lastAnimation().cancel).not.toHaveBeenCalled();
    expect(getContainers()).toHaveLength(1);
  });

  test("a new W restarts the motion from its progress", () => {
    render(<Section />);
    const first = lastAnimation();
    first.currentTime = 7250; // half way
    itemWidth = () => 150;
    itemLeft = (index) => index * 166;
    period = (count) => count * 166;
    resize();
    expect(first.cancel).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].keyframes[1]).toEqual({
      transform: "translateX(-830px)",
    });
    expect(calls[1].options.duration).toBe(20_750);
    expect(calls[1].animation.currentTime).toBe(10_375);
    expect(getContainers()).toHaveLength(1);
  });

  test("a restart keeps a pause, and a visitor's stop holds across a stop and restart", () => {
    render(<Section />);
    tabTo(getLink(0));
    rootWidth = 800;
    resize();
    expect(getButton().hidden).toBe(true);
    rootWidth = 300;
    resize();
    expect(calls).toHaveLength(2);
    expect(lastAnimation().playState).toBe("paused");
    expect(getButton().textContent).toBe("Play");
  });
});

describe("the items changing (plan amendment 8)", () => {
  test("an item React adds lands after the container; the copies are rebuilt with the container last", async () => {
    const view = render(<Section count={5} />);
    const first = lastAnimation();
    first.currentTime = 7250;
    view.rerender(<Section count={6} />);
    await flush();
    const track = getTrack();
    const containers = getContainers();
    expect(containers).toHaveLength(1);
    expect(track.lastElementChild).toBe(containers[0]);
    expect(
      [...track.children].filter((child) => child !== containers[0]).length
    ).toBe(6);
    expect(containers[0].children).toHaveLength(6);
    expect(first.cancel).toHaveBeenCalledTimes(1);
    // W is measured again: 6 items, 696px; restarted half way
    expect(lastAnimation()).not.toBe(first);
    expect(calls[calls.length - 1].keyframes[1]).toEqual({
      transform: "translateX(-696px)",
    });
    expect(lastAnimation().currentTime).toBe(8700);
    // the rebuild does not trigger itself
    const count = calls.length;
    await flush();
    await flush();
    expect(calls).toHaveLength(count);
  });

  test("an item React removes leaves the copies in step", async () => {
    const view = render(<Section count={5} />);
    view.rerender(<Section count={4} />);
    await flush();
    expect(getContainers()).toHaveLength(1);
    expect(getContainers()[0].children).toHaveLength(4);
  });

  test("items that come to fit stop the motion", async () => {
    const view = render(<Section count={5} />);
    view.rerender(<Section count={2} />);
    await flush();
    expect(getContainers()).toEqual([]);
    expect(getButton().hidden).toBe(true);
  });

  test("a change inside the container is not a change of the items", async () => {
    render(<Section />);
    const [container] = getContainers();
    container.firstElementChild?.setAttribute("data-touched", "");
    await flush();
    expect(calls).toHaveLength(1);
  });
});

describe("unmount", () => {
  test("cancels the motion, removes the copies and every listener", () => {
    const view = render(<Section />);
    const track = getTrack();
    const animation = lastAnimation();
    view.unmount();
    expect(animation.cancel).toHaveBeenCalledTimes(1);
    expect(track.querySelector("[inert]")).toBeNull();
    expect(intersections.size).toBe(0);
    expect(resizes.size).toBe(0);
    expect(media.listeners.size).toBe(0);
  });
});
