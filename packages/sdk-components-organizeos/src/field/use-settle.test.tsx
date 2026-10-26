/**
 * @vitest-environment jsdom
 */
import { useRef, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { canPlayOnCanvasProperty } from "../animate/flag";
import { noteMessages } from "../animate/use-animate";
import { ConvergenceField } from "./convergence-field";
import type { Motion } from "./shape";
import { useSettle } from "./use-settle";

/* Browser stand-ins: ViewTimeline, CSS.registerProperty, Element.animate,
   reduced motion and overflow, installed and removed as use-animate's are. */
type Call = {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: { cancel: ReturnType<typeof vi.fn> };
};
let calls: Call[] = [];

class FakeViewTimeline {
  options: unknown;
  constructor(options: unknown) {
    this.options = options;
  }
}

/** The document's registered properties: a second registration throws. */
let registered = new Set<string>();
const registerProperty = vi.fn((definition: PropertyDefinition) => {
  if (registered.has(definition.name)) {
    throw new DOMException(
      `Property ${definition.name} already registered`,
      "InvalidModificationError"
    );
  }
  registered.add(definition.name);
});

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
const elementPrototype = Element.prototype as unknown as Record<
  string,
  unknown
>;

beforeEach(() => {
  calls = [];
  registered = new Set();
  registerProperty.mockClear();
  media.matches = false;
  media.listeners.clear();
  win.ViewTimeline = FakeViewTimeline;
  win.CSS = { registerProperty };
  win.matchMedia = (query: string) => ({
    get matches() {
      return query === "(prefers-reduced-motion: reduce)" && media.matches;
    },
    addEventListener: (_type: string, listener: () => void) =>
      media.listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      media.listeners.delete(listener),
  });
  elementPrototype.animate = function (
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
  vi.restoreAllMocks();
  delete win.ViewTimeline;
  delete win.CSS;
  delete win.matchMedia;
  delete elementPrototype.animate;
  document.body.innerHTML = "";
});

/* A root and an svg, rendering what the hook reports. */
const Field = ({
  motion = "Settle",
  canPlay = true,
}: {
  motion?: Motion;
  canPlay?: boolean;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const notes = useSettle({ svgRef, rootRef, motion, canPlay });
  return (
    <div data-testid="root" data-notes={notes.join("|")} ref={rootRef}>
      <svg data-testid="svg" ref={svgRef} />
    </div>
  );
};

const getNotes = () =>
  (screen.getByTestId("root").dataset.notes ?? "")
    .split("|")
    .filter((note) => note !== "");

/** getComputedStyle with the given overflow per element. */
const stubOverflow = (overflow: (element: Element) => string | undefined) => {
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element: Element) =>
      ({
        getPropertyValue: (property: string) =>
          property === "overflow-y" ? (overflow(element) ?? "visible") : "",
      }) as CSSStyleDeclaration
  );
};

describe("the settle", () => {
  test("after mount only: the server render plays nothing", () => {
    renderToString(<Field />);
    expect(calls).toEqual([]);
    expect(registerProperty).not.toHaveBeenCalled();
  });

  test("one animation on the svg, with the exact keyframes and options, on a view timeline of the root", () => {
    render(<Field />);
    expect(registerProperty).toHaveBeenCalledWith({
      name: "--os-field-settle",
      syntax: "<number>",
      inherits: true,
      initialValue: "0",
    });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.target).toBe(screen.getByTestId("svg"));
    expect(call.keyframes).toEqual([
      { "--os-field-settle": 1 },
      { "--os-field-settle": 0 },
    ]);
    const timeline = call.options.timeline as unknown as FakeViewTimeline;
    expect(timeline).toBeInstanceOf(FakeViewTimeline);
    expect(timeline.options).toEqual({ subject: screen.getByTestId("root") });
    expect(call.options).toEqual({
      rangeStart: "entry 0%",
      rangeEnd: "entry 80%",
      easing: "ease-out",
      fill: "both",
      timeline,
    });
    expect(getNotes()).toEqual([]);
  });

  test("none with Motion None, and no note", () => {
    render(<Field motion="None" />);
    expect(calls).toEqual([]);
    expect(registerProperty).not.toHaveBeenCalled();
    expect(getNotes()).toEqual([]);
  });

  test("none while canPlay is false", () => {
    render(<Field canPlay={false} />);
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([]);
  });

  test.each([
    ["ViewTimeline", () => delete win.ViewTimeline],
    ["Element.animate", () => delete elementPrototype.animate],
    ["CSS.registerProperty", () => (win.CSS = {})],
    ["the CSS object at all", () => delete win.CSS],
  ])("none without %s, with the unsupported note", (_name, remove) => {
    remove();
    render(<Field />);
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([noteMessages.unsupported]);
  });

  test("a missing matchMedia counts as no preference", () => {
    delete win.matchMedia;
    render(<Field />);
    expect(calls).toHaveLength(1);
  });

  test("a second registration in the document is tolerated", () => {
    render(
      <>
        <Field />
        <Field />
      </>
    );
    expect(registerProperty).toHaveBeenCalledTimes(2);
    expect(calls).toHaveLength(2);
  });

  test("any other registration error: no animation, the unsupported note", () => {
    registerProperty.mockImplementationOnce(() => {
      throw new SyntaxError("bad syntax");
    });
    render(<Field />);
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([noteMessages.unsupported]);
  });

  test("a rejected animation leaves the field static, with the note", () => {
    elementPrototype.animate = () => {
      throw new TypeError("Failed to parse");
    };
    render(<Field />);
    expect(getNotes()).toEqual([noteMessages.rejected]);
  });
});

describe("reduced motion", () => {
  test("nothing attaches under it", () => {
    media.matches = true;
    render(<Field />);
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([]);
  });

  test("the animation is cancelled when it turns on, and does not restart", () => {
    render(<Field />);
    const [call] = calls;
    setReducedMotion(true);
    expect(call.animation.cancel).toHaveBeenCalledTimes(1);
    setReducedMotion(false);
    expect(calls).toHaveLength(1);
  });
});

describe("the scroll container", () => {
  test("inside an overflow: hidden ancestor: no animation, the overflow note", () => {
    const scroller = document.createElement("div");
    document.body.append(scroller);
    stubOverflow((element) => (element === scroller ? "hidden" : undefined));
    render(<Field />, { container: scroller });
    expect(calls).toEqual([]);
    expect(getNotes()).toEqual([noteMessages.overflow]);
  });

  test("inside an overflow: clip ancestor it plays", () => {
    const clipper = document.createElement("div");
    document.body.append(clipper);
    stubOverflow((element) => (element === clipper ? "clip" : undefined));
    render(<Field />, { container: clipper });
    expect(calls).toHaveLength(1);
  });
});

describe("cancelling", () => {
  test("unmount cancels", () => {
    const { unmount } = render(<Field />);
    const [call] = calls;
    unmount();
    expect(call.animation.cancel).toHaveBeenCalledTimes(1);
  });

  test("a change of Motion cancels, and back to Settle plays again", () => {
    const { rerender } = render(<Field />);
    const [first] = calls;
    rerender(<Field motion="None" />);
    expect(first.animation.cancel).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    rerender(<Field motion="Settle" />);
    expect(calls).toHaveLength(2);
  });

  test("the same Motion on a re-render does not rebuild", () => {
    const { rerender } = render(<Field />);
    rerender(<Field />);
    expect(calls).toHaveLength(1);
    expect(calls[0].animation.cancel).not.toHaveBeenCalled();
  });
});

/* The block: part A's canvas rule and the notes box. */
const Sdk = ({
  children,
  renderer,
}: {
  children: ReactNode;
  renderer?: "canvas" | "preview";
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

describe("the Convergence Field's settle", () => {
  test("on the published page, with Motion Settle, it animates the field's svg", () => {
    const { container } = render(
      <Sdk>
        <ConvergenceField motion="Settle" />
      </Sdk>
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].target).toBe(container.querySelector("svg"));
    const timeline = calls[0].options.timeline as unknown as FakeViewTimeline;
    expect(timeline.options).toEqual({
      subject: container.firstElementChild,
    });
  });

  test("an unknown Motion is None", () => {
    render(
      <Sdk>
        <ConvergenceField motion="Spin" />
      </Sdk>
    );
    expect(calls).toEqual([]);
  });

  test("on the canvas without the play flag nothing plays", () => {
    render(
      <Sdk renderer="canvas">
        <ConvergenceField motion="Settle" />
      </Sdk>
    );
    expect(calls).toEqual([]);
  });

  test("on the canvas with the play flag it plays", () => {
    render(
      <Sdk renderer="canvas">
        <ConvergenceField
          motion="Settle"
          {...{ [canPlayOnCanvasProperty]: true }}
        />
      </Sdk>
    );
    expect(calls).toHaveLength(1);
  });

  test("on the canvas the notes follow the children; in preview they are absent", () => {
    delete win.ViewTimeline;
    const { container, unmount } = render(
      <Sdk renderer="canvas">
        <ConvergenceField motion="Settle">
          <p>Content</p>
        </ConvergenceField>
      </Sdk>
    );
    const root = container.firstElementChild!;
    const last = root.lastElementChild!;
    expect(last.hasAttribute("data-organizeos-canvas-note")).toBe(true);
    expect(last.textContent).toContain(noteMessages.unsupported);
    expect(last.previousElementSibling?.tagName).toBe("P");
    unmount();

    const preview = render(
      <Sdk renderer="preview">
        <ConvergenceField motion="Settle">
          <p>Content</p>
        </ConvergenceField>
      </Sdk>
    );
    expect(
      preview.container.querySelector("[data-organizeos-canvas-note]")
    ).toBeNull();
  });
});
