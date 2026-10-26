/**
 * @vitest-environment jsdom
 */
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { Instance } from "@webstudio-is/sdk";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { renderTemplate } from "@webstudio-is/template";
import { ConvergenceField } from "./field/convergence-field";
import { ARM_HEIGHT, LEVELS } from "./field/generate";
import { fixtureCase } from "./field/read-fixture";
import { meta } from "./convergence-field.template";
import { meta as marquee } from "./marquee.template";
import { meta as fieldMeta } from "./field/convergence-field.ws";

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
const [content] = childInstances(root);
const [heading, line] = childInstances(content);

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
            : style.value.type === "color" && style.value.colorSpace === "hex"
              ? `#${style.value.components
                  .map((component) =>
                    Math.round(component * 255)
                      .toString(16)
                      .padStart(2, "0")
                  )
                  .join("")}`
              : style.value.type,
      ])
  );
};

/*
 * The fragment rendered through the real component, by its registered name,
 * as a published page (renderer undefined); the content is `ws:element`s.
 */
const components: Record<string, ComponentType<Record<string, unknown>>> = {
  [`${organizeos}:ConvergenceField`]: ConvergenceField as ComponentType<
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
  return createElement(component, props, ...children);
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

describe("the Convergence Field template", () => {
  test("a hidden block with the component's label, a description and its own icon", () => {
    expect(meta.category).toBe("hidden");
    expect(meta.label).toBe("Convergence Field");
    expect(meta.label).toBe(fieldMeta.label);
    expect(meta.description).toMatch(/field/);
    expect(meta.icon).toEqual(expect.any(String));
    expect(meta.icon).toBe(fieldMeta.icon);
    expect(meta.icon).not.toBe(marquee.icon);
  });

  test("the root holds a content Box with a heading and a line of placeholder text; no props, so the runtime's defaults apply", () => {
    expect(root.component).toBe(`${organizeos}:ConvergenceField`);
    expect(childInstances(root)).toEqual([content]);
    expect([content.component, content.tag]).toEqual(["ws:element", "div"]);
    expect(
      childInstances(content).map((child) => [child.component, child.tag])
    ).toEqual([
      ["ws:element", "h2"],
      ["ws:element", "p"],
    ]);
    for (const text of [heading, line]) {
      expect(text.children).toEqual([
        expect.objectContaining({ type: "text", placeholder: true }),
      ]);
    }
    expect(fragment.props).toEqual([]);
    expect(fragment.dataSources).toEqual([]);
  });

  test("the root: night background, a min-height and padding, the content centred", () => {
    expect(stylesOf(root)).toMatchObject({
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "560px",
      paddingTop: "80px",
      paddingLeft: "24px",
    });
    expect(stylesOf(root).backgroundColor).toBe("#0b1a1f");
    expect(stylesOf(root).color).toBe("#f4efe6");
    expect(stylesOf(content)).toMatchObject({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
    });
  });
});

describe("the template rendered through the real component", () => {
  test("the server markup: the field (the default Band case) behind the content", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Section />);
    const rendered = container.firstElementChild as HTMLElement;
    expect(rendered.dataset.instance).toBe(root.id);
    const [svg, box] = [...rendered.children];
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("viewBox")).toBe("0 0 1800 600");
    expect((box as HTMLElement).dataset.instance).toBe(content.id);
    expect(box.querySelector("h2")?.textContent).toBe(
      "Everything your people do, together"
    );

    const item = fixtureCase("default-band");
    const drawn = [...svg.children]
      .filter((child) => child.tagName === "g")
      .flatMap((group) => [...group.querySelectorAll("use")])
      .map((use) => use.getAttribute("transform"));
    const expected = Array.from({ length: LEVELS }, (_, index) =>
      item.arms.filter((arm) => arm[4] === index + 1)
    )
      .flat()
      .map(
        ([x, y, deg, size]) =>
          `translate(${x} ${y}) rotate(${deg}) scale(${(size / ARM_HEIGHT).toFixed(3)})`
      );
    expect(drawn).toEqual(expected);
  });
});
