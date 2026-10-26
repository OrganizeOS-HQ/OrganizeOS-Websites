/**
 * @vitest-environment jsdom
 */
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { clampFade, useFade } from "./use-fade";

/* Browser stand-ins: Element.animate and reduced motion. */
type Call = {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: { cancel: ReturnType<typeof vi.fn> };
};
let calls: Call[] = [];

const media = { matches: false, listeners: new Set<() => void>() };

const setReducedMotion = (matches: boolean) => {
  media.matches = matches;
  act(() => {
    for (const listener of media.listeners) {
      listener();
    }
  });
};

const proto = Element.prototype as unknown as Record<string, unknown>;

beforeEach(() => {
  calls = [];
  media.matches = false;
  media.listeners.clear();
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
  proto.animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ) {
    const animation = { cancel: vi.fn() };
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

/*
 * A Tabs root over Radix's markup with the control's button first: the
 * triggers follow `tab` and the panels `panel`, so a test can flip either
 * alone. A nested Tabs in the first panel follows `inner`.
 */
const Section = ({
  panel = 0,
  tab = panel,
  inner = 0,
  count = 3,
  nested = false,
  enabled = true,
  fade,
}: {
  panel?: number;
  tab?: number;
  inner?: number;
  count?: number;
  nested?: boolean;
  enabled?: boolean;
  fade?: unknown;
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useFade({ buttonRef, enabled, fade });
  const indexes = Array.from({ length: count }, (_, index) => index);
  const state = (on: boolean) => (on ? "active" : "inactive");
  return (
    <div data-testid="root">
      <button type="button" ref={buttonRef}>
        Pause
      </button>
      <div role="tablist">
        {indexes.map((index) => (
          <button
            key={index}
            type="button"
            role="tab"
            data-state={state(index === tab)}
          >
            Tab {index}
          </button>
        ))}
      </div>
      {indexes.map((index) => (
        <div
          key={index}
          role="tabpanel"
          data-panel={index}
          data-state={state(index === panel)}
        >
          Panel {index}
          {index === 0 && nested && (
            <div>
              <div role="tablist">
                {[0, 1].map((innerIndex) => (
                  <button
                    key={innerIndex}
                    type="button"
                    role="tab"
                    data-state={state(innerIndex === inner)}
                  >
                    Inner {innerIndex}
                  </button>
                ))}
              </div>
              {[0, 1].map((innerIndex) => (
                <div
                  key={innerIndex}
                  role="tabpanel"
                  data-inner={innerIndex}
                  data-state={state(innerIndex === inner)}
                >
                  Inner panel {innerIndex}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const getPanel = (index: number) =>
  document.querySelector(`[data-panel="${index}"]`) as HTMLElement;

// The observer reports in a microtask.
const flush = () => act(async () => {});

describe("clampFade", () => {
  test.each([
    [undefined, 250],
    [null, 250],
    ["", 250],
    ["  ", 250],
    ["slow", 250],
    [Number.NaN, 250],
    [Number.POSITIVE_INFINITY, 250],
    [{}, 250],
    [-100, 0],
    [0, 0],
    [120, 120],
    ["300", 300],
    [600, 600],
    [900, 600],
  ])("%s ms is %s", (value, expected) => {
    expect(clampFade(value)).toBe(expected);
  });
});

describe("useFade", () => {
  test("nothing fades on the first render", async () => {
    render(<Section panel={1} />);
    await flush();
    expect(calls).toEqual([]);
  });

  test("a panel that becomes active after mount fades in: opacity 0 to 1, ease-out, fill none, 250 ms by default", async () => {
    const view = render(<Section />);
    view.rerender(<Section panel={1} />);
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].target).toBe(getPanel(1));
    expect(calls[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(calls[0].options).toEqual({
      duration: 250,
      easing: "ease-out",
      fill: "none",
    });
  });

  test("the duration is the clamped Fade", async () => {
    const view = render(<Section fade="400" />);
    view.rerender(<Section fade="400" panel={1} />);
    await flush();
    expect(calls.map((call) => call.options.duration)).toEqual([400]);

    view.rerender(<Section fade={5000} panel={2} />);
    await flush();
    expect(calls.map((call) => call.options.duration)).toEqual([400, 600]);
  });

  test("Fade 0 switches at once", async () => {
    const view = render(<Section fade={0} />);
    view.rerender(<Section fade={0} panel={1} />);
    await flush();
    expect(calls).toEqual([]);
  });

  test("nothing fades while disabled, and a switch after it is enabled does", async () => {
    const view = render(<Section enabled={false} />);
    view.rerender(<Section enabled={false} panel={1} />);
    await flush();
    expect(calls).toEqual([]);

    view.rerender(<Section panel={1} />);
    await flush();
    expect(calls).toEqual([]);
    view.rerender(<Section panel={2} />);
    await flush();
    expect(calls.map((call) => call.target)).toEqual([getPanel(2)]);
  });

  test("nothing fades under reduced motion", async () => {
    media.matches = true;
    const view = render(<Section />);
    view.rerender(<Section panel={1} />);
    await flush();
    expect(calls).toEqual([]);
  });

  test("reduced motion turned on cancels a running fade, and nothing fades after it", async () => {
    const view = render(<Section />);
    view.rerender(<Section panel={1} />);
    await flush();
    expect(calls).toHaveLength(1);
    setReducedMotion(true);
    expect(calls[0].animation.cancel).toHaveBeenCalledTimes(1);
    view.rerender(<Section panel={2} />);
    await flush();
    expect(calls).toHaveLength(1);
  });

  test("an engine without element.animate switches at once (plan amendment 2)", async () => {
    delete proto.animate;
    const view = render(<Section />);
    view.rerender(<Section panel={1} />);
    await flush();
    expect(calls).toEqual([]);
    expect(getPanel(1).dataset.state).toBe("active");
  });

  test("a second switch cancels the first fade", async () => {
    const view = render(<Section />);
    view.rerender(<Section panel={1} />);
    await flush();
    view.rerender(<Section panel={2} />);
    await flush();
    expect(calls.map((call) => call.target)).toEqual([
      getPanel(1),
      getPanel(2),
    ]);
    expect(calls[0].animation.cancel).toHaveBeenCalledTimes(1);
    expect(calls[1].animation.cancel).not.toHaveBeenCalled();
  });

  test("a panel that turns inactive animates nothing", async () => {
    const view = render(<Section />);
    // the outgoing panel goes inactive, and no panel becomes active
    view.rerender(<Section panel={-1} />);
    await flush();
    expect(calls).toEqual([]);
  });

  test("a trigger's flip animates nothing", async () => {
    const view = render(<Section />);
    view.rerender(<Section tab={1} />);
    await flush();
    expect(calls).toEqual([]);
  });

  test("a nested Tabs' flip animates nothing, and its root's panels still fade", async () => {
    const view = render(<Section nested />);
    view.rerender(<Section nested inner={1} />);
    await flush();
    expect(calls).toEqual([]);

    view.rerender(<Section nested inner={1} panel={1} />);
    await flush();
    expect(calls.map((call) => call.target)).toEqual([getPanel(1)]);
  });

  test("panels added after mount are collected, and a nested Tabs added after mount is not", async () => {
    const view = render(<Section count={2} />);
    view.rerender(<Section count={3} nested />);
    await flush();
    view.rerender(<Section count={3} nested panel={2} />);
    await flush();
    expect(calls.map((call) => call.target)).toEqual([getPanel(2)]);

    view.rerender(<Section count={3} nested panel={2} inner={1} />);
    await flush();
    expect(calls).toHaveLength(1);
  });

  test("unmount disconnects the observer and cancels a running fade", async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const view = render(<Section />);
    view.rerender(<Section panel={1} />);
    await flush();
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(calls[0].animation.cancel).toHaveBeenCalledTimes(1);
    expect(media.listeners.size).toBe(0);
  });
});
