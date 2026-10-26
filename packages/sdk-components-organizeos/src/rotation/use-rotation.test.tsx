/**
 * @vitest-environment jsdom
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { getOwnTabs, getSelectedIndex } from "./structure";
import { clampInterval, useRotation } from "./use-rotation";

// jsdom can only dispatch untrusted events; the tests say which ones a
// visitor caused.
const { trusted } = vi.hoisted(() => ({ trusted: new WeakSet<Event>() }));
vi.mock("./trusted", () => ({
  isTrusted: (event: Event) => trusted.has(event),
}));

/* A control that renders what the hook reports, as the component does. */
const Control = (props: {
  value: string;
  onValueChange: (value: string) => void;
  interval?: unknown;
  enabled: boolean;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { state, toggle } = useRotation({ buttonRef, ...props });
  return (
    <button
      type="button"
      data-control=""
      data-rotation={state}
      ref={buttonRef}
      hidden={state === "off"}
      onClick={toggle}
    >
      {state === "stopped" ? "Play" : "Pause"}
    </button>
  );
};

/*
 * A fake of upstream's Tabs over Radix's markup: it follows its `value`
 * prop in an effect (after `lag` ms when given), and a click selects a tab
 * a moment later, as upstream's `handleValueChange` awaits an interaction
 * response before it sets the selection. It never writes the variable.
 */
const FakeTabs = ({
  value,
  values,
  lag,
  nested,
  children,
}: {
  value: string;
  values: string[];
  lag?: number;
  nested?: ReactNode;
  children: ReactNode;
}) => {
  const [selected, setSelected] = useState(value);
  useEffect(() => {
    if (lag === undefined) {
      setSelected(value);
      return;
    }
    const timer = setTimeout(() => setSelected(value), lag);
    return () => clearTimeout(timer);
  }, [value, lag]);
  return (
    <div data-testid="root">
      {children}
      <div role="tablist" aria-label="Audiences">
        {values.map((tab, index) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === selected}
            tabIndex={tab === selected ? 0 : -1}
            onClick={() => setTimeout(() => setSelected(tab), 0)}
          >
            Tab {index}
          </button>
        ))}
      </div>
      {values.map((tab, index) => (
        <div
          key={tab}
          role="tabpanel"
          tabIndex={0}
          data-state={tab === selected ? "active" : "inactive"}
        >
          Panel {index}
          {index === 0 && nested}
        </div>
      ))}
    </div>
  );
};

const NestedTabs = () => (
  <div>
    <div role="tablist">
      <button type="button" role="tab" aria-selected="true">
        Inner 0
      </button>
      <button type="button" role="tab" aria-selected="false">
        Inner 1
      </button>
    </div>
    <div role="tabpanel">Inner panel</div>
  </div>
);

let writes: string[] = [];

/* The variable `activeTab`, bound to the Tabs' and the control's `value`. */
const Section = ({
  initial = "0",
  count = 3,
  values,
  interval,
  enabled = true,
  lag,
  nested,
}: {
  initial?: string;
  count?: number;
  values?: string[];
  interval?: unknown;
  enabled?: boolean;
  lag?: number;
  nested?: boolean;
}) => {
  const [activeTab, setActiveTab] = useState(initial);
  return (
    <FakeTabs
      value={activeTab}
      values={values ?? Array.from({ length: count }, (_, index) => `${index}`)}
      lag={lag}
      nested={nested ? <NestedTabs /> : undefined}
    >
      <Control
        value={activeTab}
        onValueChange={(value) => {
          writes.push(value);
          setActiveTab(value);
        }}
        interval={interval}
        enabled={enabled}
      />
    </FakeTabs>
  );
};

/* Browser stand-ins: reduced motion and the off-screen observer. */
const media = {
  matches: false,
  listeners: new Set<() => void>(),
};
const observers = new Set<{
  callback: IntersectionObserverCallback;
  targets: Element[];
}>();

class FakeIntersectionObserver {
  record: { callback: IntersectionObserverCallback; targets: Element[] };
  options: IntersectionObserverInit | undefined;
  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.record = { callback, targets: [] };
    this.options = options;
    observers.add(this.record);
  }
  observe(target: Element) {
    this.record.targets.push(target);
  }
  disconnect() {
    observers.delete(this.record);
  }
}

const setReducedMotion = (matches: boolean) => {
  media.matches = matches;
  act(() => {
    for (const listener of media.listeners) {
      listener();
    }
  });
};

const setOnScreen = (isIntersecting: boolean) => {
  act(() => {
    for (const { callback, targets } of observers) {
      callback(
        targets.map(
          (target) => ({ target, isIntersecting }) as IntersectionObserverEntry
        ),
        {} as IntersectionObserver
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

beforeEach(() => {
  vi.useFakeTimers();
  writes = [];
  media.matches = false;
  media.listeners.clear();
  observers.clear();
  visibility = "visible";
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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const getRoot = () =>
  document.querySelector('[data-testid="root"]') as HTMLElement;
const getButton = () =>
  document.querySelector("[data-control]") as HTMLButtonElement;
const getTabs = () => getOwnTabs(getRoot()) as HTMLElement[];
const selected = () => getSelectedIndex(getTabs());
const rotation = () => getButton().dataset.rotation;
const getPanel = (index: number) =>
  Array.from(getRoot().querySelectorAll('[role="tabpanel"]'))[
    index
  ] as HTMLElement;

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

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

const pointerDown = () =>
  new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
const focusIn = () => new FocusEvent("focusin", { bubbles: true });
const keyDown = (key: string) =>
  new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });

/* A visitor clicks a tab: pointerdown, then the click Tabs handles. */
const clickTab = (index: number) => {
  const tab = getTabs()[index];
  visitor(tab, pointerDown());
  act(() => {
    fireEvent.click(tab);
  });
  advance(0);
};

describe("clampInterval", () => {
  test("holds finite numbers and numeric strings to 3..20 seconds", () => {
    expect(clampInterval(5.5)).toBe(5.5);
    expect(clampInterval(3)).toBe(3);
    expect(clampInterval(20)).toBe(20);
    expect(clampInterval(1)).toBe(3);
    expect(clampInterval(0)).toBe(3);
    expect(clampInterval(-4)).toBe(3);
    expect(clampInterval(60)).toBe(20);
    expect(clampInterval("8")).toBe(8);
    expect(clampInterval("1")).toBe(3);
  });

  test("gives 5.5 seconds for a missing or non-numeric value", () => {
    for (const value of [
      undefined,
      null,
      "",
      " ",
      "fast",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      {},
      [1, 2],
    ]) {
      expect(clampInterval(value), String(value)).toBe(5.5);
    }
  });
});

describe("useRotation", () => {
  test("starts playing after mount and advances at the interval", () => {
    render(<Section />);
    expect(rotation()).toBe("playing");
    expect(getButton().hidden).toBe(false);
    expect(getButton().textContent).toBe("Pause");
    expect(writes).toEqual([]);
    advance(5499);
    expect(selected()).toBe(0);
    advance(1);
    expect(writes).toEqual(["1"]);
    expect(selected()).toBe(1);
    advance(5500);
    expect(selected()).toBe(2);
  });

  test("wraps around from the last tab to the first", () => {
    render(<Section initial="2" />);
    advance(5500);
    expect(writes).toEqual(["0"]);
    expect(selected()).toBe(0);
  });

  test("uses the Interval, clamped: 3 seconds at least, 20 at most, 5.5 when missing", () => {
    const { unmount } = render(<Section interval={1} />);
    advance(2999);
    expect(selected()).toBe(0);
    advance(1);
    expect(selected()).toBe(1);
    unmount();

    const slow = render(<Section interval={60} />);
    advance(19_999);
    expect(selected()).toBe(0);
    advance(1);
    expect(selected()).toBe(1);
    slow.unmount();

    render(<Section interval="soon" />);
    advance(5499);
    expect(selected()).toBe(0);
    advance(1);
    expect(selected()).toBe(1);
  });

  test("two tabs: a click on tab 1, then Play, selects tab 0 one Interval later", () => {
    render(<Section count={2} />);
    clickTab(1);
    expect(selected()).toBe(1);
    expect(rotation()).toBe("stopped");
    // the click changed the selection, not the variable
    expect(writes).toEqual([]);

    act(() => {
      getButton().click();
    });
    expect(rotation()).toBe("playing");
    // Play brings the variable in step with the selection first
    expect(writes).toEqual(["1"]);
    expect(selected()).toBe(1);

    advance(5500);
    expect(writes).toEqual(["1", "0"]);
    expect(selected()).toBe(0);
  });

  test('three tabs: with the variable at "1", a click on tab 0 and Play, it advances', () => {
    render(<Section initial="1" />);
    expect(selected()).toBe(1);
    clickTab(0);
    expect(selected()).toBe(0);
    act(() => {
      getButton().click();
    });
    expect(writes).toEqual(["0"]);
    advance(5500);
    expect(writes).toEqual(["0", "1"]);
    expect(selected()).toBe(1);
  });

  test("verifies an advance at the next tick, never synchronously", () => {
    // Tabs takes a second to follow the variable
    render(<Section lag={1000} />);
    advance(5500);
    expect(writes).toEqual(["1"]);
    // the write has not landed; the control keeps playing
    expect(selected()).toBe(0);
    expect(rotation()).toBe("playing");
    advance(1000);
    expect(selected()).toBe(1);
    advance(4500);
    expect(writes).toEqual(["1", "2"]);
    expect(rotation()).toBe("playing");
  });

  test("stops when its advance does not select the index it asked for", () => {
    // triggers whose values are not their indexes: value "1" is the third tab
    render(<Section values={["0", "2", "1"]} />);
    advance(5500);
    expect(writes).toEqual(["1"]);
    expect(selected()).toBe(2);
    advance(5500);
    expect(rotation()).toBe("off");
    expect(getButton().hidden).toBe(true);
    advance(60_000);
    expect(writes).toEqual(["1"]);
  });

  test("never starts when the bound value is not a tab's index, and writes nothing", () => {
    render(<Section values={["a", "b", "c"]} initial="a" />);
    expect(rotation()).toBe("off");
    advance(60_000);
    expect(writes).toEqual([]);
    expect(selected()).toBe(0);
  });

  test("Pause stops until Play; Play resumes from the current tab", () => {
    render(<Section />);
    advance(5500);
    expect(selected()).toBe(1);
    act(() => {
      getButton().click();
    });
    expect(rotation()).toBe("stopped");
    expect(getButton().textContent).toBe("Play");
    advance(60_000);
    expect(selected()).toBe(1);
    act(() => {
      getButton().click();
    });
    expect(rotation()).toBe("playing");
    expect(getButton().textContent).toBe("Pause");
    advance(5499);
    expect(selected()).toBe(1);
    advance(1);
    expect(selected()).toBe(2);
  });

  test("Play with the pointer over the root flips the label at once and advances one Interval after it leaves", () => {
    render(<Section />);
    act(() => {
      getButton().click();
    });
    script(getRoot(), new MouseEvent("pointerenter"));
    act(() => {
      getButton().click();
    });
    expect(getButton().textContent).toBe("Pause");
    expect(rotation()).toBe("playing");
    advance(30_000);
    expect(selected()).toBe(0);
    script(getRoot(), new MouseEvent("pointerleave"));
    advance(5499);
    expect(selected()).toBe(0);
    advance(1);
    expect(selected()).toBe(1);
  });

  describe("pauses, and resumes with a fresh timer", () => {
    test("while the pointer is over the root", () => {
      render(<Section />);
      advance(5000);
      script(getRoot(), new MouseEvent("pointerenter"));
      advance(30_000);
      expect(selected()).toBe(0);
      expect(rotation()).toBe("playing");
      script(getRoot(), new MouseEvent("pointerleave"));
      advance(5499);
      expect(selected()).toBe(0);
      advance(1);
      expect(selected()).toBe(1);
    });

    test("while the root is off screen", () => {
      render(<Section />);
      const [observer] = Array.from(observers);
      expect(observer.targets).toEqual([getRoot()]);
      setOnScreen(true);
      advance(5000);
      setOnScreen(false);
      advance(30_000);
      expect(selected()).toBe(0);
      setOnScreen(true);
      advance(5499);
      expect(selected()).toBe(0);
      advance(1);
      expect(selected()).toBe(1);
    });

    test("while the document is hidden", () => {
      render(<Section />);
      advance(5000);
      setVisibility("hidden");
      advance(30_000);
      expect(selected()).toBe(0);
      setVisibility("visible");
      advance(5499);
      expect(selected()).toBe(0);
      advance(1);
      expect(selected()).toBe(1);
    });

    test("until every pause ends", () => {
      render(<Section />);
      script(getRoot(), new MouseEvent("pointerenter"));
      setVisibility("hidden");
      script(getRoot(), new MouseEvent("pointerleave"));
      advance(30_000);
      expect(selected()).toBe(0);
      setVisibility("visible");
      advance(5500);
      expect(selected()).toBe(1);
    });

    test("observes the root with threshold 0", () => {
      const observe = vi.fn();
      const construct = vi.fn();
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(
            _callback: IntersectionObserverCallback,
            options: IntersectionObserverInit
          ) {
            construct(options);
          }
          observe = observe;
          disconnect() {}
        }
      );
      render(<Section />);
      expect(construct).toHaveBeenCalledWith({ threshold: 0 });
      expect(observe).toHaveBeenCalledWith(getRoot());
    });
  });

  describe("stops for good", () => {
    test("when focus enters a tab", () => {
      render(<Section />);
      visitor(getTabs()[1], focusIn());
      expect(rotation()).toBe("stopped");
      expect(getButton().textContent).toBe("Play");
      advance(60_000);
      expect(writes).toEqual([]);
    });

    test("when focus enters a panel", () => {
      render(<Section />);
      visitor(getPanel(0), focusIn());
      expect(rotation()).toBe("stopped");
      advance(60_000);
      expect(writes).toEqual([]);
    });

    test("but focus on the control's own button neither pauses nor stops", () => {
      render(<Section />);
      act(() => {
        getButton().focus();
      });
      visitor(getButton(), focusIn());
      expect(rotation()).toBe("playing");
      advance(5500);
      expect(selected()).toBe(1);
      expect(document.activeElement).toBe(getButton());
    });

    test("on a trusted pointerdown on a tab", () => {
      render(<Section />);
      visitor(getTabs()[2], pointerDown());
      expect(rotation()).toBe("stopped");
      advance(60_000);
      expect(writes).toEqual([]);
    });

    test.each([
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Enter",
      " ",
    ])('on a trusted "%s" in the tab list', (key) => {
      render(<Section />);
      visitor(getTabs()[0], keyDown(key));
      expect(rotation()).toBe("stopped");
      advance(60_000);
      expect(writes).toEqual([]);
    });

    test("not on other keys, or keys outside the tab list", () => {
      render(<Section />);
      visitor(getTabs()[0], keyDown("a"));
      visitor(getTabs()[0], keyDown("Tab"));
      visitor(getPanel(0), keyDown("ArrowRight"));
      expect(rotation()).toBe("playing");
    });

    test("not on a pointerdown outside the tabs", () => {
      render(<Section />);
      visitor(getPanel(0), pointerDown());
      expect(rotation()).toBe("playing");
    });

    test("not on untrusted events", () => {
      render(<Section />);
      script(getTabs()[1], focusIn());
      script(getPanel(0), focusIn());
      script(getTabs()[1], pointerDown());
      for (const key of ["ArrowRight", "Home", "End", "Enter", " "]) {
        script(getTabs()[0], keyDown(key));
      }
      expect(rotation()).toBe("playing");
      advance(5500);
      expect(selected()).toBe(1);
    });
  });

  test("an advance never moves focus", () => {
    render(
      <>
        <button type="button" data-testid="outside">
          Outside
        </button>
        <Section />
      </>
    );
    const outside = document.querySelector(
      '[data-testid="outside"]'
    ) as HTMLElement;
    act(() => {
      outside.focus();
    });
    advance(5500);
    expect(selected()).toBe(1);
    expect(document.activeElement).toBe(outside);
    act(() => {
      getButton().focus();
    });
    advance(5500);
    expect(selected()).toBe(2);
    expect(document.activeElement).toBe(getButton());
  });

  test("sets no live region", () => {
    render(<Section />);
    advance(5500);
    expect(document.querySelector("[aria-live]")).toBeNull();
  });

  describe("never starts", () => {
    test("under reduced motion", () => {
      media.matches = true;
      render(<Section />);
      expect(rotation()).toBe("off");
      expect(getButton().hidden).toBe(true);
      advance(60_000);
      expect(writes).toEqual([]);
    });

    test("with fewer than two tabs", () => {
      render(<Section count={1} />);
      expect(rotation()).toBe("off");
      advance(60_000);
      expect(writes).toEqual([]);
    });

    test("when it is not enabled (the canvas)", () => {
      render(<Section enabled={false} />);
      expect(rotation()).toBe("off");
      advance(60_000);
      expect(writes).toEqual([]);
    });

    test("when two panels are rendered: the inactive ones are not hidden", () => {
      vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.getAttribute("role") === "tabpanel"
            ? document.body
            : null;
        }
      );
      render(<Section />);
      expect(rotation()).toBe("off");
      advance(60_000);
      expect(writes).toEqual([]);
    });
  });

  test("ignores a nested Tabs' tabs", () => {
    render(<Section count={2} nested />);
    expect(rotation()).toBe("playing");
    advance(5500);
    expect(selected()).toBe(1);
    advance(5500);
    // two tabs, not four: back to the first
    expect(writes).toEqual(["1", "0"]);
    expect(selected()).toBe(0);
  });

  describe("reduced motion turning on mid-visit", () => {
    test("stops rotation and hides the button", () => {
      render(<Section />);
      advance(5500);
      setReducedMotion(true);
      expect(rotation()).toBe("off");
      expect(getButton().hidden).toBe(true);
      advance(60_000);
      expect(writes).toEqual(["1"]);
    });

    test("moves focus from the button to the selected tab", () => {
      render(<Section />);
      advance(5500);
      act(() => {
        getButton().focus();
      });
      setReducedMotion(true);
      expect(document.activeElement).toBe(getTabs()[1]);
    });

    test("leaves focus elsewhere alone, and also hides a stopped button", () => {
      render(<Section />);
      act(() => {
        getButton().click();
      });
      act(() => {
        getPanel(0).focus();
      });
      setReducedMotion(true);
      expect(rotation()).toBe("off");
      expect(document.activeElement).toBe(getPanel(0));
    });

    test("nothing restarts when it turns off again", () => {
      render(<Section />);
      setReducedMotion(true);
      setReducedMotion(false);
      expect(rotation()).toBe("off");
      advance(60_000);
      expect(writes).toEqual([]);
    });
  });

  test("runs without matchMedia or IntersectionObserver", () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Section />);
    expect(rotation()).toBe("playing");
    advance(5500);
    expect(selected()).toBe(1);
  });

  test("stops its timer and listeners when unmounted", () => {
    const { unmount } = render(<Section />);
    expect(media.listeners.size).toBe(1);
    expect(observers.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
    expect(observers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
