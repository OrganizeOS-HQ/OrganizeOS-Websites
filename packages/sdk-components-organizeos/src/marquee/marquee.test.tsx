/**
 * @vitest-environment jsdom
 */
import { createRef, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import type { Renderer } from "../form/submit";
import { Marquee, structureProblem } from "./marquee";
import { MarqueePauseButton } from "./marquee-pause-button";
import { MarqueeTrack } from "./marquee-track";

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
  buttonLast = false,
}: {
  renderer: Renderer;
  buttonLast?: boolean;
}) => {
  const button = <MarqueePauseButton key="button" data-testid="button" />;
  const track = (
    <MarqueeTrack key="track" data-testid="track">
      <div>Item 0</div>
      <div>Item 1</div>
    </MarqueeTrack>
  );
  return (
    <Sdk renderer={renderer}>
      <Marquee data-testid="root">
        {buttonLast ? [track, button] : [button, track]}
      </Marquee>
    </Sdk>
  );
};

const getProblem = () =>
  document.querySelector("[data-organizeos-canvas-check]");

afterEach(() => {
  cleanup();
});

describe("the Marquee's parts", () => {
  test("pass their refs, classes and data-ws props to their elements", () => {
    const rootRef = createRef<HTMLDivElement>();
    const buttonRef = createRef<HTMLButtonElement>();
    const trackRef = createRef<HTMLDivElement>();
    render(
      <Sdk renderer="canvas">
        <Marquee ref={rootRef} className="root" data-ws-id="r">
          <MarqueePauseButton
            ref={buttonRef}
            className="button"
            data-ws-id="b"
          />
          <MarqueeTrack ref={trackRef} className="track" data-ws-id="t">
            <div>Item</div>
          </MarqueeTrack>
        </Marquee>
      </Sdk>
    );
    expect(rootRef.current?.tagName).toBe("DIV");
    expect(rootRef.current?.className).toBe("root");
    expect(rootRef.current?.dataset.wsId).toBe("r");
    expect(buttonRef.current?.tagName).toBe("BUTTON");
    expect(buttonRef.current?.className).toBe("button");
    expect(buttonRef.current?.dataset.wsId).toBe("b");
    expect(buttonRef.current?.type).toBe("button");
    expect(trackRef.current?.className).toBe("track");
    expect(trackRef.current?.dataset.wsId).toBe("t");
    expect(trackRef.current?.parentElement).toBe(rootRef.current);
    expect(buttonRef.current?.parentElement).toBe(rootRef.current);
  });

  test.each([undefined, "preview"] as const)(
    "the server markup (renderer %s) hides the button and draws no check",
    (renderer) => {
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <Section renderer={renderer} buttonLast />
      );
      const button = container.querySelector(
        '[data-testid="button"]'
      ) as HTMLButtonElement;
      expect(button.hidden).toBe(true);
      expect(container.querySelector("[data-organizeos-canvas-check]")).toBe(
        null
      );
    }
  );

  test("a Pause button outside a Marquee stays hidden on a page, and shows on the canvas", () => {
    render(
      <Sdk renderer={undefined}>
        <MarqueePauseButton data-testid="button" />
      </Sdk>
    );
    expect(screen.getByTestId("button").hidden).toBe(true);
    cleanup();
    render(
      <Sdk renderer="canvas">
        <MarqueePauseButton data-testid="button" />
      </Sdk>
    );
    expect(screen.getByTestId("button").hidden).toBe(false);
    expect(screen.getByTestId("button").textContent).toBe("Pause");
  });
});

describe("on the canvas", () => {
  test("shows no problem when the structure holds", () => {
    render(<Section renderer="canvas" />);
    expect(getProblem()).toBeNull();
  });

  test("shows the problem beside the parts when the button comes after the track", () => {
    render(<Section renderer="canvas" buttonLast />);
    expect(getProblem()?.textContent).toContain(structureProblem);
    expect(getProblem()?.textContent).toContain("Marquee needs attention");
    expect(getProblem()?.parentElement).toBe(screen.getByTestId("root"));
    expect(screen.getByTestId("track").contains(getProblem())).toBe(false);
  });

  test("the problem follows the designer's edits", async () => {
    const view = render(<Section renderer="canvas" />);
    expect(getProblem()).toBeNull();
    view.rerender(<Section renderer="canvas" buttonLast />);
    await act(async () => {});
    expect(getProblem()?.textContent).toContain(structureProblem);
    view.rerender(<Section renderer="canvas" />);
    await act(async () => {});
    expect(getProblem()).toBeNull();
  });

  test("is not shown on a published page or in the preview", () => {
    for (const renderer of [undefined, "preview"] as const) {
      const view = render(<Section renderer={renderer} buttonLast />);
      expect(getProblem()).toBeNull();
      view.unmount();
    }
  });
});
