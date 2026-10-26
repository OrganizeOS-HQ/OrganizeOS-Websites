/**
 * @vitest-environment jsdom
 */
import { useRef, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { AnimationAction, AnimationActionView } from "@webstudio-is/sdk";
import { findScrollContainer, noteMessages, useAnimate } from "./use-animate";

/* Browser stand-ins: the timelines, Element.animate and reduced motion. */
type Call = {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: { cancel: ReturnType<typeof vi.fn> };
};
let calls: Call[] = [];
let rejects: (target: Element) => boolean = () => false;

class FakeScrollTimeline {
  options: unknown;
  constructor(options: unknown) {
    this.options = options;
  }
}
class FakeViewTimeline extends FakeScrollTimeline {}

const media = { matches: false, listeners: new Set<() => void>() };

const setReducedMotion = (matches: boolean) => {
  media.matches = matches;
  act(() => {
    for (const listener of media.listeners) {
      listener();
    }
  });
};

const win = window as unknown as Record<string, unknown>;

beforeEach(() => {
  calls = [];
  rejects = () => false;
  media.matches = false;
  media.listeners.clear();
  win.ScrollTimeline = FakeScrollTimeline;
  win.ViewTimeline = FakeViewTimeline;
  win.matchMedia = (query: string) => ({
    get matches() {
      return query === "(prefers-reduced-motion: reduce)" && media.matches;
    },
    addEventListener: (_type: string, listener: () => void) =>
      media.listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      media.listeners.delete(listener),
  });
  (Element.prototype as unknown as Record<string, unknown>).animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ) {
    if (rejects(this)) {
      throw new TypeError("Failed to parse");
    }
    const animation = { cancel: vi.fn() };
    calls.push({ target: this, keyframes, options, animation });
    return animation;
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete win.ScrollTimeline;
  delete win.ViewTimeline;
  delete win.matchMedia;
  delete (Element.prototype as unknown as Record<string, unknown>).animate;
});

const percent = (value: number) => ({
  type: "unit" as const,
  value,
  unit: "%" as const,
});

const reveal: AnimationActionView = {
  type: "view",
  animations: [
    {
      timing: {
        rangeStart: ["entry", percent(0)],
        rangeEnd: ["entry", percent(60)],
        fill: "backwards",
        easing: "ease-out",
      },
      keyframes: [
        {
          offset: 0,
          styles: { opacity: { type: "unit", value: 0, unit: "number" } },
        },
      ],
    },
  ],
};

const scrollFade: AnimationAction = {
  type: "scroll",
  source: "root",
  animations: [
    {
      timing: {
        rangeStart: ["start", percent(0)],
        rangeEnd: ["end", percent(10)],
        fill: "both",
      },
      keyframes: [
        {
          offset: 0,
          styles: { opacity: { type: "unit", value: 0, unit: "number" } },
        },
      ],
    },
  ],
};

/* A root that renders what the hook reports. */
const Player = ({
  action,
  stagger,
  canPlay = true,
  children,
}: {
  action: unknown;
  stagger?: unknown;
  canPlay?: boolean;
  children?: ReactNode;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const notes = useAnimate({ rootRef, action, stagger, canPlay });
  return (
    <div data-testid="root" data-notes={notes.join("|")} ref={rootRef}>
      {children}
    </div>
  );
};

const cards = (count = 3) =>
  Array.from({ length: count }, (_, index) => (
    <p key={index} data-card={index}>
      Card {index}
    </p>
  ));

const getNotes = () =>
  (screen.getByTestId("root").dataset.notes ?? "")
    .split("|")
    .filter((note) => note !== "");

const cardsOf = (calls: Call[]) =>
  calls.map((call) => (call.target as HTMLElement).dataset.card);

/** getComputedStyle with the given overflow per element. */
const stubOverflow = (
  overflow: (element: Element) => { x?: string; y?: string } | undefined
) => {
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element: Element) =>
      ({
        getPropertyValue: (property: string) => {
          const value = overflow(element);
          if (property === "overflow-x") {
            return value?.x ?? "visible";
          }
          if (property === "overflow-y") {
            return value?.y ?? "visible";
          }
          return "";
        },
      }) as CSSStyleDeclaration
  );
};

describe("when it attaches", () => {
  test("after mount only: the server render plays nothing", () => {
    renderToString(<Player action={reveal}>{cards()}</Player>);
    expect(calls).toEqual([]);
    render(<Player action={reveal}>{cards()}</Player>);
    expect(cardsOf(calls)).toEqual(["0", "1", "2"]);
  });

  test("one animation per child, on a view timeline of that child", () => {
    render(<Player action={reveal}>{cards(2)}</Player>);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      const timeline = call.options.timeline as unknown as FakeViewTimeline;
      expect(timeline).toBeInstanceOf(FakeViewTimeline);
      expect(timeline.options).toEqual({
        subject: call.target,
        axis: "block",
        inset: "auto auto",
      });
      expect(call.keyframes).toEqual([{ offset: 0, opacity: "0" }]);
      expect(call.options).toEqual({
        easing: "ease-out",
        fill: "backwards",
        rangeStart: "entry 0%",
        rangeEnd: "entry 60%",
        timeline,
      });
    }
  });

  test("a scroll action with the root source runs on the page's scroller", () => {
    render(<Player action={scrollFade}>{cards(1)}</Player>);
    const [call] = calls;
    const timeline = call.options.timeline as unknown as FakeScrollTimeline;
    expect(timeline).toBeInstanceOf(FakeScrollTimeline);
    expect(timeline).not.toBeInstanceOf(FakeViewTimeline);
    expect(timeline.options).toEqual({
      source: document.scrollingElement ?? document.documentElement,
      axis: "block",
    });
    expect(call.options.rangeEnd).toBe("calc(100% - 10%)");
  });

  test("stagger reaches the children's range starts", () => {
    render(
      <Player action={reveal} stagger={8}>
        {cards(3)}
      </Player>
    );
    expect(calls.map((call) => call.options.rangeStart)).toEqual([
      "entry 0%",
      "entry 8%",
      "entry 16%",
    ]);
  });

  test("never while canPlay is false", () => {
    render(
      <Player action={reveal} canPlay={false}>
        {cards()}
      </Player>
    );
    expect(calls).toEqual([]);
  });

  test("a missing matchMedia counts as no preference", () => {
    delete win.matchMedia;
    render(<Player action={reveal}>{cards(1)}</Player>);
    expect(calls).toHaveLength(1);
  });

  test("the package's canvas-check boxes are not targets", () => {
    render(
      <Player action={reveal}>
        {cards(1)}
        <div data-organizeos-canvas-check="">Check</div>
        <div data-organizeos-canvas-note="">Note</div>
      </Player>
    );
    expect(cardsOf(calls)).toEqual(["0"]);
  });

  test("writes no inline style, and cancelling leaves the page as it was", () => {
    const { unmount } = render(<Player action={reveal}>{cards()}</Player>);
    const root = screen.getByTestId("root");
    const before = root.outerHTML;
    expect(calls).toHaveLength(3);
    for (const element of [root, ...Array.from(root.children)]) {
      expect(element.getAttribute("style")).toBeNull();
    }
    unmount();
    expect(before).not.toContain("style=");
  });
});

describe("reduced motion", () => {
  test("nothing attaches under prefers-reduced-motion: reduce", () => {
    media.matches = true;
    render(<Player action={reveal}>{cards()}</Player>);
    expect(calls).toEqual([]);
  });

  test("turning it on cancels every animation, and turning it off restarts none", () => {
    render(<Player action={reveal}>{cards()}</Player>);
    expect(calls).toHaveLength(3);
    setReducedMotion(true);
    for (const call of calls) {
      expect(call.animation.cancel).toHaveBeenCalledTimes(1);
    }
    setReducedMotion(false);
    expect(calls).toHaveLength(3);
  });
});

describe("browsers without timelines", () => {
  test("no ViewTimeline: a view action stays static, with a note", () => {
    delete win.ViewTimeline;
    render(<Player action={reveal}>{cards()}</Player>);
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([noteMessages.unsupported]);
  });

  test("no ScrollTimeline: a scroll action stays static, with a note", () => {
    delete win.ScrollTimeline;
    render(<Player action={scrollFade}>{cards()}</Player>);
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([noteMessages.unsupported]);
  });
});

describe("isolation and notes", () => {
  test("one rejected value does not stop the other children", () => {
    rejects = (target) => (target as HTMLElement).dataset.card === "1";
    render(<Player action={reveal}>{cards()}</Player>);
    expect(cardsOf(calls)).toEqual(["0", "2"]);
    expect(getNotes()).toEqual([noteMessages.rejected]);
  });

  test("a timeline the engine refuses is reported the same way", () => {
    win.ViewTimeline = class {
      constructor() {
        throw new TypeError("bad inset");
      }
    };
    render(<Player action={reveal}>{cards(2)}</Player>);
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([noteMessages.rejected]);
  });

  test("the plan's skip reasons become notes", () => {
    render(
      <Player action={{ ...reveal, subject: "--other" }}>{cards(2)}</Player>
    );
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([noteMessages.subject]);
  });

  test("no notes when everything plays", () => {
    render(<Player action={reveal}>{cards()}</Player>);
    expect(getNotes()).toEqual([]);
  });
});

describe("rebuilds and cancels", () => {
  test("a changed action cancels the old animations and plays the new one", () => {
    const { rerender } = render(<Player action={reveal}>{cards(2)}</Player>);
    const first = [...calls];
    rerender(<Player action={scrollFade}>{cards(2)}</Player>);
    for (const call of first) {
      expect(call.animation.cancel).toHaveBeenCalledTimes(1);
    }
    expect(calls).toHaveLength(4);
    expect(
      calls.slice(2).map((call) => call.options.timeline?.constructor)
    ).toEqual([FakeScrollTimeline, FakeScrollTimeline]);
  });

  test("a changed stagger rebuilds", () => {
    const { rerender } = render(
      <Player action={reveal} stagger={0}>
        {cards(2)}
      </Player>
    );
    rerender(
      <Player action={reveal} stagger={8}>
        {cards(2)}
      </Player>
    );
    expect(calls[0].animation.cancel).toHaveBeenCalledTimes(1);
    expect(calls.slice(2).map((call) => call.options.rangeStart)).toEqual([
      "entry 0%",
      "entry 8%",
    ]);
  });

  test("the same value in a new object does not rebuild", () => {
    const { rerender } = render(<Player action={reveal}>{cards(2)}</Player>);
    rerender(
      <Player action={JSON.parse(JSON.stringify(reveal))}>{cards(2)}</Player>
    );
    expect(calls).toHaveLength(2);
    expect(calls[0].animation.cancel).not.toHaveBeenCalled();
  });

  test("unmount cancels every animation", () => {
    const { unmount } = render(<Player action={reveal}>{cards(3)}</Player>);
    unmount();
    for (const call of calls) {
      expect(call.animation.cancel).toHaveBeenCalledTimes(1);
    }
  });

  test("canPlay turning on attaches, and off cancels", () => {
    const { rerender } = render(
      <Player action={reveal} canPlay={false}>
        {cards(1)}
      </Player>
    );
    expect(calls).toEqual([]);
    rerender(
      <Player action={reveal} canPlay={true}>
        {cards(1)}
      </Player>
    );
    expect(calls).toHaveLength(1);
    rerender(
      <Player action={reveal} canPlay={false}>
        {cards(1)}
      </Player>
    );
    expect(calls[0].animation.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("scroll containers (spec 14.2, amendment 3)", () => {
  const Scroller = ({ children }: { children: ReactNode }) => (
    <section data-scroller="">{children}</section>
  );
  const isScroller = (element: Element) =>
    element.hasAttribute("data-scroller");

  test("a view action inside an overflow: hidden ancestor does not attach, with a note", () => {
    stubOverflow((element) =>
      isScroller(element) ? { x: "hidden", y: "hidden" } : undefined
    );
    render(
      <Scroller>
        <Player action={reveal}>{cards(2)}</Player>
      </Scroller>
    );
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([noteMessages.overflow]);
  });

  test("overflow: clip is not a scroll container", () => {
    stubOverflow((element) =>
      isScroller(element) ? { x: "clip", y: "clip" } : undefined
    );
    render(
      <Scroller>
        <Player action={reveal}>{cards(2)}</Player>
      </Scroller>
    );
    expect(calls).toHaveLength(2);
    expect(getNotes()).toEqual([]);
  });

  test("only the action's axis counts", () => {
    stubOverflow((element) =>
      isScroller(element) ? { x: "auto", y: "visible" } : undefined
    );
    render(
      <Scroller>
        <Player action={reveal}>{cards(1)}</Player>
      </Scroller>
    );
    expect(calls).toHaveLength(1);
  });

  test("a scroll action's nearest source is that container", () => {
    stubOverflow((element) =>
      isScroller(element) ? { y: "auto" } : undefined
    );
    render(
      <Scroller>
        <Player action={{ ...scrollFade, source: "nearest" }}>
          {cards(1)}
        </Player>
      </Scroller>
    );
    const timeline = calls[0].options.timeline as unknown as FakeScrollTimeline;
    expect(timeline.options).toEqual({
      source: document.querySelector("[data-scroller]"),
      axis: "block",
    });
  });

  test("with no container, a nearest source is the page's scroller", () => {
    render(
      <Player action={{ ...scrollFade, source: "closest" }}>{cards(1)}</Player>
    );
    const timeline = calls[0].options.timeline as unknown as FakeScrollTimeline;
    expect(timeline.options).toEqual({
      source: document.scrollingElement ?? document.documentElement,
      axis: "block",
    });
  });

  test("the body counts as the viewport while the root element's overflow is visible", () => {
    stubOverflow((element) =>
      element === document.body ? { x: "hidden", y: "auto" } : undefined
    );
    render(<Player action={reveal}>{cards(1)}</Player>);
    expect(calls).toHaveLength(1);
    expect(getNotes()).toEqual([]);
  });

  test("the body is a container of its own when the root element scrolls", () => {
    stubOverflow((element) => {
      if (element === document.documentElement) {
        return { y: "auto" };
      }
      if (element === document.body) {
        return { y: "auto" };
      }
    });
    const target = document.createElement("p");
    document.body.append(target);
    expect(findScrollContainer(target, "block")).toBe(document.body);
    target.remove();
  });
});
