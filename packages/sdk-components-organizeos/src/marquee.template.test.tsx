/**
 * @vitest-environment jsdom
 */
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { Instance } from "@webstudio-is/sdk";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { renderTemplate } from "@webstudio-is/template";
import { Marquee } from "./marquee/marquee";
import { MarqueePauseButton } from "./marquee/marquee-pause-button";
import { MarqueeTrack } from "./marquee/marquee-track";
import { meta } from "./marquee.template";
import { meta as rotatingTabs } from "./rotating-tabs.template";

const organizeos = "@organizeos/site-components";

const fragment = renderTemplate(meta.template);

const instances = new Map(
  fragment.instances.map((instance) => [instance.id, instance])
);
const getInstance = (id: string) => {
  const instance = instances.get(id);
  if (instance === undefined) {
    throw new Error(`no instance ${id}`);
  }
  return instance;
};
const childInstances = (instance: Instance) =>
  instance.children.flatMap((child) =>
    child.type === "id" ? [getInstance(child.value)] : []
  );
const root = getInstance(fragment.children[0].value);
const [button, track] = childInstances(root);
const items = childInstances(track);

const stylesOf = (instance: Instance) => {
  const selection = fragment.styleSourceSelections.find(
    (item) => item.instanceId === instance.id
  );
  return Object.fromEntries(
    fragment.styles
      .filter(
        (style) =>
          selection?.values.includes(style.styleSourceId) &&
          style.state === undefined
      )
      .map((style) => [
        style.property,
        style.value.type === "keyword"
          ? style.value.value
          : style.value.type === "unit"
            ? `${style.value.value}${style.value.unit === "number" ? "" : style.value.unit}`
            : style.value.type,
      ])
  );
};

/*
 * The fragment rendered through the real parts, by their registered names,
 * as a published page (renderer undefined); the items are `ws:element`s.
 */
const components: Record<string, ComponentType<Record<string, unknown>>> = {
  [`${organizeos}:Marquee`]: Marquee as ComponentType<Record<string, unknown>>,
  [`${organizeos}:MarqueePauseButton`]: MarqueePauseButton as ComponentType<
    Record<string, unknown>
  >,
  [`${organizeos}:MarqueeTrack`]: MarqueeTrack as ComponentType<
    Record<string, unknown>
  >,
};

const renderInstance = (instance: Instance): ReactNode => {
  const props: Record<string, unknown> = {
    key: instance.id,
    "data-instance": instance.id,
  };
  for (const prop of fragment.props.filter(
    (item) => item.instanceId === instance.id
  )) {
    throw new Error(`no stub for the prop ${prop.name}`);
  }
  const children = instance.children.map((child) => {
    if (child.type === "id") {
      return renderInstance(getInstance(child.value));
    }
    if (child.type === "text") {
      return child.value;
    }
    throw new Error(`no stub for a ${child.type} child`);
  });
  if (instance.component === "ws:element") {
    return createElement(instance.tag ?? "div", props, ...children);
  }
  const component = components[instance.component];
  if (component === undefined) {
    throw new Error(`no component for ${instance.component}`);
  }
  return createElement(
    component,
    props,
    ...(children.length > 0 ? children : [])
  );
};

const Section = () => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
      renderer: undefined,
    }}
  >
    {renderInstance(root)}
  </ReactSdkContext.Provider>
);

const proto = Element.prototype as unknown as Record<string, unknown>;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete proto.animate;
});

const byInstance = (instance: Instance) =>
  document.querySelector(`[data-instance="${instance.id}"]`) as HTMLElement;

describe("the Marquee template", () => {
  test("a hidden block with its own label, description and icon", () => {
    expect(meta.category).toBe("hidden");
    expect(meta.label).toBe("Marquee");
    expect(meta.description).toMatch(/Pause/);
    expect(meta.icon).toEqual(expect.any(String));
    expect(meta.icon).not.toBe(rotatingTabs.icon);
  });

  test("the Marquee, its Pause Button first, then its Track of five placeholder div items; no props", () => {
    expect(root.component).toBe(`${organizeos}:Marquee`);
    expect(childInstances(root).map((child) => child.component)).toEqual([
      `${organizeos}:MarqueePauseButton`,
      `${organizeos}:MarqueeTrack`,
    ]);
    expect(button.children).toEqual([]);
    expect(items.map((item) => [item.component, item.tag])).toEqual(
      Array.from({ length: 5 }, () => ["ws:element", "div"])
    );
    expect(items.map((item) => item.children)).toEqual(
      [1, 2, 3, 4, 5].map((index) => [
        { type: "text", value: `Item ${index}`, placeholder: true },
      ])
    );
    // the runtime's defaults apply: speed 40, the reading direction, and
    // the button's labels
    expect(fragment.props).toEqual([]);
    expect(fragment.dataSources).toEqual([]);
  });

  test("the root clips the x axis only; the track is a row as wide as its items; the items keep their width", () => {
    expect(stylesOf(root)).toEqual({
      overflowX: "clip",
      overflowY: "visible",
    });
    expect(stylesOf(track)).toMatchObject({
      display: "flex",
      columnGap: "16px",
      width: "max-content",
    });
    for (const item of items) {
      expect(stylesOf(item)).toMatchObject({
        flexGrow: "0",
        flexShrink: "0",
        flexBasis: "auto",
      });
    }
  });

  test("radii are on the closed scale: 10px", () => {
    const radii = new Set(
      fragment.styles
        .filter((style) => style.property.endsWith("Radius"))
        .map((style) =>
          style.value.type === "unit"
            ? `${style.value.value}${style.value.unit}`
            : style.value.type
        )
    );
    expect([...radii]).toEqual(["10px"]);
  });
});

describe("the template rendered through the real parts", () => {
  test("the server markup holds each item once and the button hidden", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Section />);
    const rendered = container.firstElementChild as HTMLElement;
    const first = rendered.firstElementChild as HTMLButtonElement;
    expect(first.tagName).toBe("BUTTON");
    expect(first.hidden).toBe(true);
    expect(first.textContent).toBe("Pause");
    const row = rendered.children[1] as HTMLElement;
    expect([...row.children].map((item) => item.textContent)).toEqual([
      "Item 1",
      "Item 2",
      "Item 3",
      "Item 4",
      "Item 5",
    ]);
    expect(container.querySelector("[inert]")).toBeNull();
  });

  test("without element.animate (jsdom) nothing moves and the button stays hidden", () => {
    render(<Section />);
    expect(byInstance(button).hidden).toBe(true);
    expect(document.querySelector("[inert]")).toBeNull();
  });

  test("with room to drift, the parts find each other and the marquee moves", () => {
    const animate = vi.fn(() => ({
      currentTime: 0,
      playState: "running",
      play: () => {},
      pause: () => {},
      cancel: () => {},
    }));
    proto.animate = animate;
    // five items of 100px, 16px apart, in a 300px root
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(
      function (this: HTMLElement) {
        const index = items.findIndex(
          (item) => item.id === this.dataset.instance
        );
        if (index < 0) {
          return 0;
        }
        return index * 116 + (this.closest("[inert]") === null ? 0 : 580);
      }
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return items.some((item) => item.id === this.dataset.instance)
          ? 100
          : 0;
      }
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.dataset.instance === root.id ? 300 : 0;
      }
    );
    render(<Section />);
    expect(byInstance(button).hidden).toBe(false);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.contexts[0]).toBe(byInstance(track));
    const container = byInstance(track).lastElementChild as HTMLElement;
    expect(container.getAttribute("inert")).toBe("");
    expect(container.children).toHaveLength(5);
  });
});
