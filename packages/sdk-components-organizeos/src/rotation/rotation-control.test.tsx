/**
 * @vitest-environment jsdom
 */
import { createRef, useEffect, useState, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import type { Renderer } from "../form/submit";
import { RotationControl, structureProblem } from "./rotation-control";

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

/* A fake of upstream's Tabs over Radix's markup, following its `value`. */
const FakeTabs = ({
  value,
  controlFirst = true,
  control,
}: {
  value: string;
  controlFirst?: boolean;
  control: ReactNode;
}) => {
  const [selected, setSelected] = useState(value);
  useEffect(() => setSelected(value), [value]);
  const list = (
    <div key="list" role="tablist">
      {["0", "1", "2"].map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={tab === selected}
        >
          Tab {tab}
        </button>
      ))}
    </div>
  );
  return (
    <div data-testid="root">
      {controlFirst ? [control, list] : [list, control]}
      {["0", "1", "2"].map((tab) => (
        <div
          key={tab}
          role="tabpanel"
          data-state={tab === selected ? "active" : "inactive"}
        >
          Panel {tab}
        </div>
      ))}
    </div>
  );
};

let writes: string[] = [];

const Section = ({
  renderer,
  controlFirst,
  pauseLabel,
  playLabel,
}: {
  renderer: Renderer;
  controlFirst?: boolean;
  pauseLabel?: string;
  playLabel?: string;
}) => {
  const [activeTab, setActiveTab] = useState("0");
  return (
    <Sdk renderer={renderer}>
      <FakeTabs
        value={activeTab}
        controlFirst={controlFirst}
        control={
          <RotationControl
            key="control"
            data-testid="control"
            value={activeTab}
            onValueChange={(value) => {
              writes.push(value);
              setActiveTab(value);
            }}
            pauseLabel={pauseLabel}
            playLabel={playLabel}
          />
        }
      />
    </Sdk>
  );
};

let reducedMotion = false;

beforeEach(() => {
  writes = [];
  reducedMotion = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const getControl = () => screen.getByTestId("control") as HTMLButtonElement;
const getProblem = () =>
  document.querySelector("[data-organizeos-canvas-check]");
const selected = () =>
  screen
    .getAllByRole("tab")
    .findIndex((tab) => tab.getAttribute("aria-selected") === "true");

describe("Rotation Control", () => {
  test.each([undefined, "preview"] as const)(
    "renders its button hidden on the server (renderer %s), so no inert control shows without JavaScript",
    (renderer) => {
      const html = renderToString(<Section renderer={renderer} />);
      const container = document.createElement("div");
      container.innerHTML = html;
      const button = container.querySelector(
        '[data-testid="control"]'
      ) as HTMLButtonElement;
      expect(button.tagName).toBe("BUTTON");
      expect(button.hidden).toBe(true);
      expect(button.style.display).toBe("none");
      expect(button.textContent).toBe("Pause");
      expect(container.querySelector("[data-organizeos-canvas-check]")).toBe(
        null
      );
    }
  );

  test.each([undefined, "preview"] as const)(
    "shows its button after mount when rotation runs (renderer %s)",
    (renderer) => {
      render(<Section renderer={renderer} />);
      expect(getControl().hidden).toBe(false);
      expect(getControl().style.display).toBe("");
      expect(screen.getByRole("button", { name: "Pause" })).toBe(getControl());
      expect(getControl().getAttribute("aria-label")).toBeNull();
      expect(getControl().type).toBe("button");
    }
  );

  test.each([undefined, "preview"] as const)(
    "keeps its button hidden under reduced motion (renderer %s)",
    (renderer) => {
      reducedMotion = true;
      render(<Section renderer={renderer} />);
      expect(getControl().hidden).toBe(true);
      expect(getControl().style.display).toBe("none");
    }
  );

  test("its label toggles Pause and Play, and Play resumes rotation", () => {
    vi.useFakeTimers();
    render(<Section renderer={undefined} />);
    act(() => {
      vi.advanceTimersByTime(5500);
    });
    // the advance is the hook's, through the control's onValueChange
    expect(writes).toEqual(["1"]);
    expect(selected()).toBe(1);

    act(() => {
      getControl().click();
    });
    expect(getControl().textContent).toBe("Play");
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(writes).toEqual(["1"]);

    act(() => {
      getControl().click();
    });
    expect(getControl().textContent).toBe("Pause");
    act(() => {
      vi.advanceTimersByTime(5500);
    });
    expect(writes).toEqual(["1", "2"]);
    expect(selected()).toBe(2);
  });

  test("takes its labels from its props", () => {
    render(
      <Section
        renderer={undefined}
        pauseLabel="Pausar"
        playLabel="Reproducir"
      />
    );
    expect(screen.getByRole("button", { name: "Pausar" })).toBe(getControl());
    act(() => {
      getControl().click();
    });
    expect(screen.getByRole("button", { name: "Reproducir" })).toBe(
      getControl()
    );
  });

  test("passes its ref, class and data-ws props to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Sdk renderer="canvas">
        <div>
          <RotationControl
            ref={ref}
            className="control"
            data-ws-id="abc"
            data-testid="control"
          />
          <div role="tablist" />
        </div>
      </Sdk>
    );
    expect(ref.current).toBe(getControl());
    expect(getControl().className).toBe("control");
    expect(getControl().dataset.wsId).toBe("abc");
  });

  describe("on the canvas", () => {
    test("never rotates, and always shows its button with the Pause label", () => {
      vi.useFakeTimers();
      render(<Section renderer="canvas" />);
      expect(getControl().hidden).toBe(false);
      expect(getControl().textContent).toBe("Pause");
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(writes).toEqual([]);
      expect(selected()).toBe(0);
      act(() => {
        getControl().click();
      });
      expect(getControl().textContent).toBe("Pause");
    });

    test("shows its button with the Pause label under reduced motion too", () => {
      reducedMotion = true;
      render(<Section renderer="canvas" />);
      expect(getControl().hidden).toBe(false);
      expect(getControl().textContent).toBe("Pause");
    });

    test("shows no problem when the structure holds", () => {
      render(<Section renderer="canvas" />);
      expect(getProblem()).toBeNull();
    });

    test("shows the problem when the control comes after the tab list", () => {
      render(<Section renderer="canvas" controlFirst={false} />);
      expect(getProblem()?.textContent).toContain(structureProblem);
      expect(getProblem()?.textContent).toContain(
        "Rotation Control needs attention"
      );
      // beside the button, never inside it
      expect(getControl().contains(getProblem())).toBe(false);
      expect(getProblem()?.parentElement).toBe(screen.getByTestId("root"));
    });

    test("shows the problem when more than one panel is rendered", () => {
      vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.getAttribute("role") === "tabpanel"
            ? document.body
            : null;
        }
      );
      render(<Section renderer="canvas" />);
      expect(getProblem()?.textContent).toContain(structureProblem);
    });

    test("the problem follows the designer's edits", async () => {
      const view = render(<Section renderer="canvas" />);
      expect(getProblem()).toBeNull();

      // the control moved after the tab list
      view.rerender(<Section renderer="canvas" controlFirst={false} />);
      await act(async () => {});
      expect(getProblem()?.textContent).toContain(structureProblem);

      // and back
      view.rerender(<Section renderer="canvas" />);
      await act(async () => {});
      expect(getProblem()).toBeNull();

      // the inactive panels' style removed: every panel is rendered
      let allRendered = true;
      vi.spyOn(HTMLElement.prototype, "offsetParent", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.getAttribute("role") === "tabpanel" && allRendered
            ? document.body
            : null;
        }
      );
      const panel = screen.getAllByRole("tabpanel", { hidden: true })[1];
      panel.setAttribute("class", "unstyled");
      await act(async () => {});
      expect(getProblem()?.textContent).toContain(structureProblem);

      // and put back
      allRendered = false;
      panel.setAttribute("class", "styled");
      await act(async () => {});
      expect(getProblem()).toBeNull();
    });

    test("is not shown on a published page or in the preview, whatever the structure", () => {
      for (const renderer of [undefined, "preview"] as const) {
        const view = render(
          <Section renderer={renderer} controlFirst={false} />
        );
        expect(getProblem()).toBeNull();
        // rotation does not run with a broken structure
        expect(getControl().hidden).toBe(true);
        view.unmount();
      }
    });
  });
});
