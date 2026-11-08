/**
 * @vitest-environment jsdom
 */
import { createRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { navigateTo } from "../form/navigate";
import type { Renderer } from "../form/submit";
import { ProductCard } from "./product-card";
import { ProductGrid } from "./product-grid";

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

let prevented: boolean | undefined;
const observe = (event: Event) => {
  prevented = event.defaultPrevented;
  event.preventDefault();
};

const click = (element: Element) => {
  prevented = undefined;
  fireEvent.click(element);
  return { prevented };
};

const gesture =
  (type: "auxclick" | "contextmenu", button: number) => (element: Element) =>
    fireEvent(
      element,
      new MouseEvent(type, { bubbles: true, cancelable: true, button })
    );

const shareCodes = (anchor: Element) =>
  new URL(anchor.getAttribute("href") ?? "", window.location.href).searchParams
    .getAll("r")
    .sort();

beforeEach(() => {
  window.history.replaceState(null, "", `/?r=${code}`);
  window.addEventListener("click", observe);
});

afterEach(() => {
  cleanup();
  window.removeEventListener("click", observe);
  vi.mocked(navigateTo).mockClear();
  window.history.replaceState(null, "", "/");
});

const roots = [
  ["Product Grid", ProductGrid],
  ["Product Card", ProductCard],
] as const;

describe.each(roots)("the %s root", (_label, Root) => {
  test("renders a div, passing every prop and ref through", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <Sdk>
        <Root
          ref={ref}
          id="shop"
          className="grid"
          data-ws-id="root"
          aria-label="Shop"
        >
          <p>Inside</p>
        </Root>
      </Sdk>
    );
    const div = container.firstElementChild as HTMLElement;
    expect(div.tagName).toBe("DIV");
    expect(ref.current).toBe(div);
    expect(div.id).toBe("shop");
    expect(div.className).toBe("grid");
    expect(div.getAttribute("data-ws-id")).toBe("root");
    expect(div.getAttribute("aria-label")).toBe("Shop");
    expect(div.textContent).toBe("Inside");
  });

  test("never renders a stored show or product", () => {
    const { container } = render(
      <Sdk>
        <Root {...({ show: "6", product: "x" } as Record<string, string>)} />
      </Sdk>
    );
    const div = container.firstElementChild as HTMLElement;
    expect(div.hasAttribute("show")).toBe(false);
    expect(div.hasAttribute("product")).toBe(false);
  });

  test("carries the share code on a click on a product link, and on its image, once", () => {
    render(
      <Sdk>
        <Root>
          <a href="/shop/organizer-t-shirt">
            <img alt="Organizer T-shirt" src="/t.jpg" />
            <span>Organizer T-shirt</span>
          </a>
          <a href="/shop">Shop all</a>
        </Root>
      </Sdk>
    );
    expect(click(screen.getByText("Organizer T-shirt"))).toEqual({
      prevented: true,
    });
    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenLastCalledWith(
      at(`/shop/organizer-t-shirt?r=${code}`)
    );
    expect(click(screen.getByAltText("Organizer T-shirt"))).toEqual({
      prevented: true,
    });
    expect(navigateTo).toHaveBeenCalledTimes(2);
    expect(navigateTo).toHaveBeenLastCalledWith(
      at(`/shop/organizer-t-shirt?r=${code}`)
    );
    click(screen.getByText("Shop all"));
    expect(navigateTo).toHaveBeenLastCalledWith(at(`/shop?r=${code}`));
  });

  test("a middle-click and a context menu put the code on the link", () => {
    render(
      <Sdk>
        <Root>
          <a href="/shop/campaign-mug">Mug</a>
          <a href="/shop/canvas-tote-bag">Tote</a>
        </Root>
      </Sdk>
    );
    gesture("auxclick", 1)(screen.getByText("Mug"));
    gesture("contextmenu", 2)(screen.getByText("Tote"));
    expect(shareCodes(screen.getByText("Mug"))).toEqual([code]);
    expect(shareCodes(screen.getByText("Tote"))).toEqual([code]);
    expect(navigateTo).not.toHaveBeenCalled();
  });

  test.each(["canvas", "preview"] as const)(
    "does nothing on the %s",
    (renderer) => {
      render(
        <Sdk renderer={renderer}>
          <Root>
            <a href="/shop/campaign-mug">Mug</a>
          </Root>
        </Sdk>
      );
      expect(click(screen.getByText("Mug"))).toEqual({ prevented: false });
      gesture("auxclick", 1)(screen.getByText("Mug"));
      gesture("contextmenu", 2)(screen.getByText("Mug"));
      expect(screen.getByText("Mug").getAttribute("href")).toBe(
        "/shop/campaign-mug"
      );
      expect(navigateTo).not.toHaveBeenCalled();
    }
  );
});

describe("the Product Grid's columns", () => {
  const columnsOf = (props: Record<string, unknown>) => {
    const { container } = render(
      <Sdk>
        <ProductGrid {...props} />
      </Sdk>
    );
    const div = container.firstElementChild as HTMLElement;
    const value = div.style.getPropertyValue("--os-product-columns");
    cleanup();
    return { value, div };
  };

  test.each(["2", "3", "4"])("%s sets the custom property", (columns) => {
    expect(columnsOf({ columns }).value).toBe(columns);
  });

  test.each([["5"], [""], [undefined], ["three"]])(
    "%s reads as 3",
    (columns) => {
      expect(columnsOf({ columns }).value).toBe("3");
    }
  );

  test("merges a given style, and never renders columns as an attribute", () => {
    const { container } = render(
      <Sdk>
        <ProductGrid columns="2" style={{ color: "red" }} />
      </Sdk>
    );
    const div = container.firstElementChild as HTMLElement;
    expect(div.style.getPropertyValue("--os-product-columns")).toBe("2");
    expect(div.style.color).toBe("red");
    expect(div.hasAttribute("columns")).toBe(false);
  });
});
