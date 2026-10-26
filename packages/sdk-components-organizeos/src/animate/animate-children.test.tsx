/**
 * @vitest-environment jsdom
 */
import { createRef, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { animationCanPlayOnCanvasProperty } from "@webstudio-is/sdk/runtime";
import {
  animationAction,
  wsComponentMeta,
  type AnimationActionView,
} from "@webstudio-is/sdk";
import type { Renderer } from "../form/submit";
import { AnimateChildren } from "./animate-children";
import { meta } from "./animate-children.ws";
import { canPlayOnCanvasProperty } from "./flag";
import { noteMessages } from "./use-animate";

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

let animated: Element[] = [];
const win = window as unknown as Record<string, unknown>;

class FakeTimeline {
  options: unknown;
  constructor(options: unknown) {
    this.options = options;
  }
}

beforeEach(() => {
  animated = [];
  win.ScrollTimeline = FakeTimeline;
  win.ViewTimeline = FakeTimeline;
  (Element.prototype as unknown as Record<string, unknown>).animate = function (
    this: Element
  ) {
    animated.push(this);
    return { cancel: () => {} };
  };
});

afterEach(() => {
  cleanup();
  delete win.ScrollTimeline;
  delete win.ViewTimeline;
  delete (Element.prototype as unknown as Record<string, unknown>).animate;
});

const reveal: AnimationActionView = {
  type: "view",
  animations: [
    {
      timing: {
        rangeStart: ["entry", { type: "unit", value: 0, unit: "%" }],
        rangeEnd: ["entry", { type: "unit", value: 60, unit: "%" }],
        fill: "backwards",
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

const Block = ({
  renderer,
  action = reveal,
  flag,
  stagger = 8,
}: {
  renderer: Renderer;
  action?: unknown;
  flag?: boolean;
  stagger?: number;
}) => (
  <Sdk renderer={renderer}>
    <AnimateChildren
      className="c1"
      data-ws-id="wrapper"
      data-ws-component="@organizeos/site-components:AnimateChildren"
      data-testid="wrapper"
      action={action}
      stagger={stagger}
      {...{ [canPlayOnCanvasProperty]: flag }}
    >
      <p>One</p>
      <p>Two</p>
    </AnimateChildren>
  </Sdk>
);

describe("Animate Children", () => {
  test("the server renders the children unchanged, with no player style", () => {
    const html = renderToString(<Block renderer={undefined} />);
    expect(html).toBe(
      '<div class="c1" data-ws-id="wrapper" data-ws-component="@organizeos/site-components:AnimateChildren" data-testid="wrapper"><p>One</p><p>Two</p></div>'
    );
    expect(animated).toEqual([]);
  });

  test("keeps className and data-ws-* and forwards its ref, and passes none of its own props to the div", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <AnimateChildren
        ref={ref}
        className="c1"
        data-ws-id="wrapper"
        action={reveal}
        stagger={8}
        {...{ [canPlayOnCanvasProperty]: true }}
      >
        <p>One</p>
      </AnimateChildren>
    );
    const div = ref.current;
    expect(div?.tagName).toBe("DIV");
    expect(div?.className).toBe("c1");
    expect(div?.dataset.wsId).toBe("wrapper");
    for (const name of ["action", "stagger", canPlayOnCanvasProperty]) {
      expect(div?.hasAttribute(name), name).toBe(false);
    }
  });

  test("on a published page every child plays", () => {
    render(<Block renderer={undefined} />);
    expect(animated.map((element) => element.textContent)).toEqual([
      "One",
      "Two",
    ]);
  });

  test("in preview it plays as published, whatever the flag", () => {
    render(<Block renderer="preview" flag={false} />);
    expect(animated).toHaveLength(2);
  });

  test("on the canvas nothing plays unless selected or pinned", () => {
    const { unmount } = render(<Block renderer="canvas" />);
    expect(animated).toEqual([]);
    unmount();

    render(<Block renderer="canvas" flag={true} />);
    expect(animated).toHaveLength(2);
    cleanup();

    animated = [];
    render(<Block renderer="canvas" action={{ ...reveal, isPinned: true }} />);
    expect(animated).toHaveLength(2);
  });

  test("on the canvas, notes follow the children and are not animated", () => {
    delete win.ViewTimeline;
    render(<Block renderer="canvas" flag={true} />);
    const wrapper = screen.getByTestId("wrapper");
    const last = wrapper.lastElementChild;
    expect(last?.hasAttribute("data-organizeos-canvas-note")).toBe(true);
    expect(last?.textContent).toContain(noteMessages.unsupported);
    expect(animated).toEqual([]);
  });

  test("on the canvas, the note box is never a target", () => {
    const action = {
      ...reveal,
      animations: [
        reveal.animations[0],
        { ...reveal.animations[0], enabled: [["base", false]] },
      ],
    };
    const { rerender } = render(
      <Block renderer="canvas" flag={true} action={action} />
    );
    const wrapper = screen.getByTestId("wrapper");
    expect(
      wrapper.querySelector("[data-organizeos-canvas-note]")?.textContent
    ).toContain(noteMessages.enabled);
    // a rebuild while the note box is among the children still skips it
    animated = [];
    rerender(
      <Block renderer="canvas" flag={true} action={action} stagger={4} />
    );
    expect(animated.map((element) => element.textContent)).toEqual([
      "One",
      "Two",
    ]);
  });

  test("a published page shows no note", () => {
    delete win.ViewTimeline;
    render(<Block renderer={undefined} />);
    const wrapper = screen.getByTestId("wrapper");
    expect(wrapper.children).toHaveLength(2);
    expect(
      wrapper.querySelector(
        "[data-organizeos-canvas-note], [data-organizeos-canvas-check]"
      )
    ).toBeNull();
  });
});

describe("the canvas play flag", () => {
  test("the inlined name equals upstream's constant", () => {
    expect(canPlayOnCanvasProperty).toBe(animationCanPlayOnCanvasProperty);
  });
});

describe("the meta", () => {
  test("is valid and hidden from the Components panel", () => {
    expect(() => wsComponentMeta.parse(meta)).not.toThrow();
    expect(meta.category).toBe("hidden");
    expect(meta.label).toBe("Animate Children");
    expect(meta.icon).toBeDefined();
  });

  test("a display: contents wrapper that takes any instance", () => {
    expect(meta.presetStyle).toEqual({
      div: [
        { property: "display", value: { type: "keyword", value: "contents" } },
      ],
    });
    expect(meta.contentModel).toEqual({
      category: "instance",
      children: ["instance"],
    });
  });

  test("action is upstream's animationAction prop with no default, the one initial prop", () => {
    expect(meta.initialProps).toEqual(["action"]);
    expect(meta.props?.action).toEqual({
      type: "animationAction",
      control: "animationAction",
      required: false,
      description: expect.any(String),
    });
    expect(meta.props?.action).not.toHaveProperty("defaultValue");
  });

  test("stagger is a number, 0 by default", () => {
    expect(meta.props?.stagger).toMatchObject({
      type: "number",
      control: "number",
      defaultValue: 0,
    });
  });

  test("the test's action is upstream's schema", () => {
    expect(animationAction.safeParse(reveal).success).toBe(true);
  });
});
