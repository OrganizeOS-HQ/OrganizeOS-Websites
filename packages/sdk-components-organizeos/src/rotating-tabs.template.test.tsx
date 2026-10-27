/**
 * @vitest-environment jsdom
 */
import {
  createElement,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@webstudio-is/sdk-components-react-radix";
import { encodeDataSourceVariable, type Instance } from "@webstudio-is/sdk";
import { indexProperty } from "@webstudio-is/sdk/runtime";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { renderTemplate } from "@webstudio-is/template";
import { RotationControl } from "./rotation/rotation-control";
import { meta } from "./rotating-tabs.template";

const radix = "@webstudio-is/sdk-components-react-radix";
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
const propsOf = (instance: Instance) =>
  fragment.props.filter((prop) => prop.instanceId === instance.id);
const ofComponent = (name: string) =>
  fragment.instances.filter((instance) => instance.component === name);

const root = getInstance(fragment.children[0].value);
const [activeTab] = fragment.dataSources;
const activeTabVariable = encodeDataSourceVariable(activeTab.id);

/*
 * A small renderer for the fragment (plan amendment 8): each instance
 * becomes upstream's Tabs part or the Rotation Control by its registered
 * name, each Trigger and Content gets its index within the nearest Tabs as
 * the builder and the generated site give it (`indexProperty`), expression
 * props read the variables, and an action prop writes one. Mounted under
 * ReactSdkContext as a published page (renderer undefined).
 */
const components: Record<string, ComponentType<Record<string, unknown>>> = {
  [`${radix}:Tabs`]: Tabs as ComponentType<Record<string, unknown>>,
  [`${radix}:TabsList`]: TabsList as ComponentType<Record<string, unknown>>,
  [`${radix}:TabsTrigger`]: TabsTrigger as ComponentType<
    Record<string, unknown>
  >,
  [`${radix}:TabsContent`]: TabsContent as ComponentType<
    Record<string, unknown>
  >,
  [`${organizeos}:RotationControl`]: RotationControl as ComponentType<
    Record<string, unknown>
  >,
};
const indexed = new Set([`${radix}:TabsTrigger`, `${radix}:TabsContent`]);

type Variables = Map<string, unknown>;
type SetVariable = (encoded: string, value: unknown) => void;

const renderInstance = (
  instance: Instance,
  variables: Variables,
  setVariable: SetVariable,
  // per component, the next index within the nearest Tabs
  indexes: Map<string, number>
): ReactNode => {
  const ownIndexes =
    instance.component === `${radix}:Tabs`
      ? new Map<string, number>()
      : indexes;
  const props: Record<string, unknown> = { key: instance.id };
  for (const prop of propsOf(instance)) {
    if (prop.type === "expression") {
      if (variables.has(prop.value) === false) {
        throw new Error(`no stub for ${prop.value}`);
      }
      props[prop.name] = variables.get(prop.value);
    } else if (prop.type === "action") {
      props[prop.name] = (...args: unknown[]) => {
        for (const action of prop.value) {
          const match = action.code.match(/^(\S+) = (\w+)$/);
          if (match === null) {
            throw new Error(`no stub for ${action.code}`);
          }
          setVariable(match[1], args[action.args.indexOf(match[2])]);
        }
      };
    } else if (
      prop.type === "string" ||
      prop.type === "number" ||
      prop.type === "boolean"
    ) {
      props[prop.name] = prop.value;
    } else {
      throw new Error(`no stub for a ${prop.type} prop`);
    }
  }
  if (indexed.has(instance.component)) {
    const index = indexes.get(instance.component) ?? 0;
    indexes.set(instance.component, index + 1);
    props[indexProperty] = String(index);
  }
  const children = instance.children.map((child) => {
    if (child.type === "id") {
      return renderInstance(
        getInstance(child.value),
        variables,
        setVariable,
        ownIndexes
      );
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

let setStubVariable: SetVariable = () => {};

const initialVariables = () =>
  new Map(
    fragment.dataSources.flatMap((dataSource) =>
      dataSource.type === "variable"
        ? [[encodeDataSourceVariable(dataSource.id), dataSource.value.value]]
        : []
    )
  );

const Section = () => {
  const [variables, setVariables] = useState<Variables>(initialVariables);
  const setVariable: SetVariable = (encoded, value) =>
    setVariables((previous) => new Map(previous).set(encoded, value));
  setStubVariable = setVariable;
  return (
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
      {renderInstance(root, variables, setVariable, new Map())}
    </ReactSdkContext.Provider>
  );
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const getTabs = () => screen.getAllByRole("tab");
const selected = () =>
  getTabs().findIndex((tab) => tab.getAttribute("aria-selected") === "true");
const getPanels = () => [
  ...document.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
];

describe("the Rotating Tabs template", () => {
  test("a hidden block with its own label, description and icon", () => {
    expect(meta.category).toBe("hidden");
    expect(meta.label).toBe("Rotating Tabs");
    expect(meta.description).toBe("Tabs that rotate on their own");
    expect(meta.icon).toEqual(expect.any(String));
  });

  test("upstream's Tabs, the Rotation Control first, then the list of three triggers and three force-mounted contents with no value", () => {
    expect(root.component).toBe(`${radix}:Tabs`);
    expect(childInstances(root).map((child) => child.component)).toEqual([
      `${organizeos}:RotationControl`,
      `${radix}:TabsList`,
      `${radix}:TabsContent`,
      `${radix}:TabsContent`,
      `${radix}:TabsContent`,
    ]);
    const [, list] = childInstances(root);
    expect(propsOf(list)).toEqual([
      expect.objectContaining({
        name: "aria-label",
        type: "string",
        value: "Audiences",
      }),
    ]);
    expect(childInstances(list).map((child) => child.component)).toEqual([
      `${radix}:TabsTrigger`,
      `${radix}:TabsTrigger`,
      `${radix}:TabsTrigger`,
    ]);
    for (const trigger of ofComponent(`${radix}:TabsTrigger`)) {
      expect(propsOf(trigger)).toEqual([]);
      expect(trigger.children).toEqual([
        expect.objectContaining({ type: "text", placeholder: true }),
      ]);
    }
    for (const content of ofComponent(`${radix}:TabsContent`)) {
      expect(
        propsOf(content).map(({ name, type, value }) => [name, type, value])
      ).toEqual([["forceMount", "boolean", true]]);
      expect(childInstances(content).map((child) => child.tag)).toEqual([
        "h3",
        "p",
      ]);
    }
  });

  test("Tabs' value and the control's share the variable activeTab, which the control's onValueChange sets", () => {
    expect(fragment.dataSources).toEqual([
      {
        type: "variable",
        id: activeTab.id,
        scopeInstanceId: root.id,
        name: "activeTab",
        value: { type: "string", value: "0" },
      },
    ]);
    const [control] = ofComponent(`${organizeos}:RotationControl`);
    expect(propsOf(root)).toEqual([
      expect.objectContaining({
        name: "value",
        type: "expression",
        value: activeTabVariable,
      }),
    ]);
    expect(
      propsOf(control).map(({ name, type, value }) => [name, type, value])
    ).toEqual([
      ["value", "expression", activeTabVariable],
      [
        "onValueChange",
        "action",
        [
          {
            type: "execute",
            args: ["value"],
            code: `${activeTabVariable} = value`,
          },
        ],
      ],
    ]);
  });

  test("every content's Inactive state is display: none, and nothing else is", () => {
    const stylesOf = (instance: Instance) => {
      const selection = fragment.styleSourceSelections.find(
        (item) => item.instanceId === instance.id
      );
      return fragment.styles.filter((style) =>
        selection?.values.includes(style.styleSourceId)
      );
    };
    const hiding = (instance: Instance) =>
      stylesOf(instance)
        .filter(
          (style) =>
            style.property === "display" &&
            style.value.type === "keyword" &&
            style.value.value === "none"
        )
        .map((style) => style.state);
    for (const content of ofComponent(`${radix}:TabsContent`)) {
      expect(hiding(content)).toEqual(['[data-state="inactive"]']);
    }
    for (const instance of fragment.instances) {
      if (instance.component !== `${radix}:TabsContent`) {
        expect(hiding(instance), instance.component).toEqual([]);
      }
    }
  });

  test("radii are on the closed scale: 16px for the panels, 10px for the pills and the button", () => {
    const radii = new Set(
      fragment.styles
        .filter((style) => style.property.endsWith("Radius"))
        .map((style) =>
          style.value.type === "unit"
            ? `${style.value.value}${style.value.unit}`
            : style.value.type
        )
    );
    expect([...radii].sort()).toEqual(["10px", "16px"]);
  });
});

describe("the template rendered through upstream's Tabs", () => {
  test("the control comes first, every content is mounted, and every aria-controls target is present", () => {
    render(<Section />);
    const tabsRoot = getTabs()[0].closest('[role="tablist"]')
      ?.parentElement as HTMLElement;
    const first = tabsRoot.firstElementChild as HTMLElement;
    expect(first.tagName).toBe("BUTTON");
    expect(first.getAttribute("role")).toBeNull();
    expect(first.textContent).toBe("Pause");
    expect(first.hidden).toBe(false);

    expect(
      screen.getByRole("tablist", { name: "Audiences" }).parentElement
    ).toBe(tabsRoot);
    expect(getTabs().map((tab) => tab.textContent)).toEqual([
      "Organizers",
      "Volunteers",
      "Supporters",
    ]);
    // force-mounted: Radix renders every panel's content and hides none of
    // them (without forceMount an inactive panel is an empty, hidden div)
    expect(getPanels().map((panel) => panel.dataset.state)).toEqual([
      "active",
      "inactive",
      "inactive",
    ]);
    expect(
      getPanels().map((panel) => [
        panel.hidden,
        panel.querySelector("h3")?.textContent,
      ])
    ).toEqual([
      [false, "For organizers"],
      [false, "For volunteers"],
      [false, "For supporters"],
    ]);
    for (const tab of getTabs()) {
      const target = tab.getAttribute("aria-controls");
      expect(target).toEqual(expect.any(String));
      const panel = document.getElementById(target as string);
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
    }
    expect(selected()).toBe(0);
  });

  test("Tabs follow the variable: setting it moves aria-selected and the active panel", () => {
    render(<Section />);
    expect(selected()).toBe(0);
    act(() => setStubVariable(activeTabVariable, "2"));
    expect(selected()).toBe(2);
    expect(getPanels().map((panel) => panel.dataset.state)).toEqual([
      "inactive",
      "inactive",
      "active",
    ]);
    act(() => setStubVariable(activeTabVariable, "1"));
    expect(selected()).toBe(1);
  });

  test("the control rotates the real Tabs through the variable", () => {
    vi.useFakeTimers();
    render(<Section />);
    act(() => {
      vi.advanceTimersByTime(5500);
    });
    expect(selected()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(5500);
    });
    expect(selected()).toBe(2);
    act(() => {
      vi.advanceTimersByTime(5500);
    });
    expect(selected()).toBe(0);
  });

  test("the server markup holds every panel's text, the first tab selected, and the button hidden", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Section />);
    expect(container.textContent).toContain("For organizers");
    expect(container.textContent).toContain("For volunteers");
    expect(container.textContent).toContain("For supporters");
    const button = container.querySelector("button:not([role])");
    expect((button as HTMLButtonElement).hidden).toBe(true);
    expect(
      [...container.querySelectorAll('[role="tab"]')].map((tab) =>
        tab.getAttribute("aria-selected")
      )
    ).toEqual(["true", "false", "false"]);
  });
});
