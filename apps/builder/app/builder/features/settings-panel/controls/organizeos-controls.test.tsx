import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { page, userEvent } from "@vitest/browser/context";
import { enableMapSet } from "immer";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { renderData } from "@webstudio-is/template";
import { showAttribute } from "@webstudio-is/react-sdk";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import {
  type Instance,
  type Prop,
  coreMetas,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import { $ } from "@organizeos/site-components/site-templates";
// The body of GET /v1/forms, the platform's contract fixture.
import formsBody from "../../../../../../../packages/sdk-components-organizeos/src/__fixtures__/forms.json";
import {
  $organizeosSite,
  $propValuesByInstanceSelector,
  $registeredComponentMetas,
  getInstanceKey,
  registerComponentLibrary,
  selectInstance,
} from "~/shared/nano-states";
import { $dataSourceVariables } from "~/shared/nano-states/variables";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $authPermit, $builderMode } from "~/shared/nano-states/misc";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import { PropsSectionContainer } from "../props-section/props-section";
import { renderControl } from "./combined";
import {
  getOrganizeosControl,
  getStateVariableId,
} from "./organizeos-controls";

vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: vi.fn(), info: vi.fn() } },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

enableMapSet();
registerContainers();
$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: organizeosMetas,
  templates: organizeosTemplates,
});

const ns = "@organizeos/site-components";
const signupForm = `${ns}:SignupForm`;
const [newsletter, contactForm] = formsBody.data;

// Radix's ScrollArea and the select observe their size
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let root: Root | undefined;
let container: HTMLElement | undefined;

// Lets the prop values, computed asynchronously, settle.
const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });

/**
 * A Signup Form whose `data` is bound to a variable holding the Forms body and
 * whose form is Newsletter.
 */
const setProject = (template = organizeosTemplates.SignupForm.template) => {
  const data = renderData(<$.Body ws:id="bodyId">{template}</$.Body>);
  const formRoot = [...data.instances.values()].find(
    (instance) => instance.component === signupForm
  ) as Instance;
  const props = new Map(data.props);
  for (const prop of [
    {
      id: "data-prop",
      instanceId: formRoot.id,
      name: "data",
      type: "expression",
      value: encodeDataSourceVariable("forms-variable"),
    },
    {
      id: "record-prop",
      instanceId: formRoot.id,
      name: "record",
      type: "string",
      value: newsletter.id,
    },
  ] satisfies Prop[]) {
    props.set(prop.id, prop);
  }
  $instances.set(data.instances);
  $props.set(props);
  $breakpoints.set(data.breakpoints);
  $styles.set(data.styles);
  $styleSources.set(data.styleSources);
  $styleSourceSelections.set(data.styleSourceSelections);
  $assets.set(new Map());
  $resources.set(new Map());
  $dataSources.set(
    new Map(data.dataSources).set("forms-variable", {
      type: "variable",
      id: "forms-variable",
      scopeInstanceId: formRoot.id,
      name: "Forms",
      value: { type: "json", value: formsBody },
    })
  );
  $dataSourceVariables.set(new Map());
  const pages = createDefaultPages({ rootInstanceId: "bodyId" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  $builderMode.set("design");
  $authPermit.set("build");
  $project.set({ id: "project-1" } as Project);
  serverSyncStore.transactionManager.currentStack = [];
  serverSyncStore.transactionManager.undoneStack = [];
  $organizeosSite.set({
    organizationId: "org-1",
    manageUrl: "https://app.example.org/dashboard",
    platformUrl: "https://app.example.org",
    blocksEnabled: true,
  });
  selectInstance([formRoot.id, "bodyId"]);
  return formRoot.id;
};

const renderPanel = async (rootId: string, width = 240) => {
  container = document.createElement("div");
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  root = createRoot(container);
  const instance = $instances.get().get(rootId) as Instance;
  await act(async () =>
    root?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(PropsSectionContainer, {
          selectedInstance: instance,
          selectedInstanceKey: getInstanceKey([rootId, "bodyId"]),
        })
      )
    )
  );
  await settle();
  return container;
};

const fieldInstances = () =>
  [...$instances.get().values()].filter(
    (instance) => instance.component === `${ns}:Field`
  );

const fieldNames = () =>
  [...$props.get().values()]
    .filter(
      (prop) =>
        prop.name === "field" &&
        $instances.get().get(prop.instanceId)?.component === `${ns}:Field`
    )
    .map((prop) => (prop.type === "string" ? prop.value : prop.type));

const checkbox = (host: HTMLElement, label: string) => {
  const element = Array.from(host.querySelectorAll("label")).find(
    (item) => item.textContent === label
  );
  const id = element?.getAttribute("for");
  return host.querySelector<HTMLButtonElement>(`[id="${id}"]`);
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("getOrganizeosControl", () => {
  const kind = (component: undefined | string, propName: string) =>
    getOrganizeosControl({ component, propName, instanceSelector: undefined });

  test("the Signup Form's rows, and actionPage hidden", () => {
    expect(kind(signupForm, "record")).toBe("signup-record");
    expect(kind(signupForm, "state")).toBe("signup-state");
    expect(kind(signupForm, "data")).toBe("signup-fields");
    expect(kind(signupForm, "action")).toBe("signup-after-submit");
    expect(kind(signupForm, "actionPage")).toBe("hidden");
    expect(kind(signupForm, "id")).toBeUndefined();
  });

  test("the RSVP Form keeps its record picker and upstream's other controls", () => {
    expect(kind(`${ns}:RsvpForm`, "record")).toBe("record");
    for (const propName of ["data", "state", "action", "actionPage"]) {
      expect(kind(`${ns}:RsvpForm`, propName)).toBeUndefined();
    }
  });

  test("the Shop blocks' rows: Show and Product, and Columns stays upstream's", () => {
    expect(kind(`${ns}:ProductGrid`, "show")).toBe("product-show");
    expect(kind(`${ns}:ProductGrid`, "columns")).toBeUndefined();
    expect(kind(`${ns}:ProductCard`, "product")).toBe("product-card");
    for (const propName of ["id", "class", "show"]) {
      expect(kind(`${ns}:ProductCard`, propName)).toBeUndefined();
    }
    expect(kind(`${ns}:ProductGrid`, "product")).toBeUndefined();
    expect(kind(`${ns}:Price`, "cents")).toBeUndefined();
  });

  test("anything else is upstream's", () => {
    expect(kind("Box", "record")).toBeUndefined();
    expect(kind(undefined, "data")).toBeUndefined();
    expect(kind("SignupForm", "data")).toBeUndefined();
  });

  test("renderControl draws nothing for actionPage", () => {
    const rootId = setProject();
    expect(
      renderControl({
        instanceId: rootId,
        meta: { type: "string", control: "url", required: false },
        prop: undefined,
        propName: "actionPage",
        computedValue: undefined,
        onChange: () => {},
      })
    ).toBeUndefined();
  });
});

describe("getStateVariableId", () => {
  test("a single variable reference, and nothing else", () => {
    expect(getStateVariableId("$ws$dataSource$abc")).toBe("abc");
    expect(getStateVariableId(" $ws$dataSource$abc ")).toBe("abc");
    expect(getStateVariableId(`$ws$dataSource$abc ?? "initial"`)).toBe(
      undefined
    );
    expect(getStateVariableId(`"error"`)).toBeUndefined();
  });
});

describe("the Signup Form's Settings", () => {
  test("reads Form, State, Fields and After submit in that order, with no Forms data row and no Page row while After submit is Message", async () => {
    const host = await renderPanel(setProject());
    const text = host.textContent ?? "";
    const positions = ["Form", "State", "Fields", "After submit"].map((label) =>
      Array.from(host.querySelectorAll("*")).findIndex(
        (element) =>
          element.children.length === 0 && element.textContent === label
      )
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(text).not.toContain("Forms data");
    expect(text).not.toContain("Choose page");
    expect(host.querySelector("[data-after-submit-page]")).toBeNull();
    // the form's name alone, its kind for the highlighted option
    expect(text).toContain("Newsletter");
    expect(text).not.toContain("(Newsletter)");
  });

  test("choosing another Form writes it and adds its missing required Fields, in one undo step", async () => {
    const rootId = setProject();
    const host = await renderPanel(rootId);
    const combobox = host.querySelector<HTMLElement>('[role="combobox"]');
    await userEvent.click(combobox as HTMLElement);
    await userEvent.click(
      page.getByRole("option", { name: "Get in touch", exact: true })
    );
    await settle();
    const record = [...$props.get().values()].find(
      (prop) => prop.instanceId === rootId && prop.name === "record"
    );
    expect(record).toMatchObject({ type: "string", value: contactForm.id });
    // email kept, first_name left, name and message added
    expect(fieldNames()).toEqual(["email", "first_name", "name", "message"]);
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(1);
    expect(host.querySelector("[data-signup-warning]")?.textContent).toBe(
      "Not in form: first_name"
    );
  });

  test("State shows six buttons, Submitting among them", async () => {
    const host = await renderPanel(setProject());
    const labels = Array.from(
      host.querySelectorAll(
        '[role="radio"][aria-label], [role="group"] button'
      ),
      (button) => button.getAttribute("aria-label")
    ).filter((label) => label !== null);
    expect(labels).toEqual([
      "Initial",
      "Submitting",
      "Success",
      "Check email",
      "Error",
      "Unavailable",
    ]);
  });

  test("clicking Error shows the error on the canvas: the root's state is error and Form Content shows, with no prop written and no undo step", async () => {
    const rootId = setProject();
    const host = await renderPanel(rootId);
    const props = $props.get();
    const depth = serverSyncStore.transactionManager.currentStack.length;

    await userEvent.click(
      host.querySelector('[aria-label="Error"]') as HTMLElement
    );
    await settle();

    const content = [...$instances.get().values()].find(
      (instance) => instance.label === "Form Content"
    ) as Instance;
    const values = $propValuesByInstanceSelector.get();
    expect(values.get(getInstanceKey([rootId, "bodyId"]))?.get("state")).toBe(
      "error"
    );
    expect(
      values
        .get(getInstanceKey([content.id, rootId, "bodyId"]))
        ?.get(showAttribute)
    ).toBe(true);
    expect($props.get()).toBe(props);
    expect(serverSyncStore.transactionManager.currentStack.length).toBe(depth);
    expect(
      host.querySelector('[aria-label="Error"]')?.getAttribute("aria-checked")
    ).toBe("true");
  });

  test("an unbound state is read-only: State drives the canvas only, and writes nothing", async () => {
    const rootId = setProject();
    const onChange = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root?.render(
        createElement(
          TooltipProvider,
          null,
          renderControl({
            instanceId: rootId,
            meta: {
              type: "string",
              control: "select",
              required: false,
              options: [],
            },
            prop: undefined,
            propName: "state",
            computedValue: "initial",
            onChange,
          })
        )
      )
    );
    const success = container.querySelector<HTMLButtonElement>(
      '[aria-label="Success"]'
    );
    expect(success?.disabled).toBe(true);
    await userEvent.click(success as HTMLElement, { force: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("the Fields rows follow the form, lock Email while it exists, and check and uncheck a Field", async () => {
    const rootId = setProject();
    const host = await renderPanel(rootId);
    const rows = Array.from(host.querySelectorAll("label"))
      .map((label) => label.textContent)
      .filter((label) =>
        newsletter.fields.some((field) => field.label === label)
      );
    expect(rows).toEqual(newsletter.fields.map((field) => field.label));

    const email = checkbox(host, "Email");
    expect(email?.disabled).toBe(true);
    expect(email?.getAttribute("data-state")).toBe("checked");
    const lastName = checkbox(host, "Last name");
    expect(lastName?.getAttribute("data-state")).toBe("unchecked");

    await userEvent.click(lastName as HTMLElement);
    await settle();
    expect(fieldNames()).toEqual(["email", "first_name", "last_name"]);
    expect(checkbox(host, "Last name")?.getAttribute("data-state")).toBe(
      "checked"
    );

    await userEvent.click(checkbox(host, "First name") as HTMLElement);
    await settle();
    expect(fieldNames()).toEqual(["email", "last_name"]);
    expect(fieldInstances()).toHaveLength(2);
  });

  test("the warning line names what is wrong, in a few words", async () => {
    const rootId = setProject();
    const host = await renderPanel(rootId);
    expect(host.querySelector("[data-signup-warning]")).toBeNull();
    // a Field the form lacks
    const prop = [...$props.get().values()].find(
      (item) =>
        item.name === "field" &&
        item.type === "string" &&
        item.value === "first_name"
    ) as Prop;
    await act(async () => {
      $props.set(
        new Map($props.get()).set(prop.id, {
          ...prop,
          value: "nickname",
        } as Prop)
      );
    });
    await settle();
    expect(host.querySelector("[data-signup-warning]")?.textContent).toBe(
      "Not in form: nickname"
    );
  });

  test("with data unbound, Fields says so in a line with Reconnect, and still runs the checks that need no data", async () => {
    const rootId = setProject();
    const props = new Map($props.get());
    props.delete("data-prop");
    props.set("record-prop", {
      id: "record-prop",
      instanceId: rootId,
      name: "record",
      type: "string",
      value: "",
    });
    $props.set(props);
    // no Submit Button
    const submit = [...$instances.get().values()].find(
      (instance) => instance.component === `${ns}:SubmitButton`
    ) as Instance;
    const instances = new Map($instances.get());
    for (const instance of instances.values()) {
      if (instance.children.some((child) => child.value === submit.id)) {
        instances.set(instance.id, {
          ...instance,
          children: instance.children.filter(
            (child) => child.value !== submit.id
          ),
        });
      }
    }
    instances.delete(submit.id);
    $instances.set(instances);
    const host = await renderPanel(rootId);
    expect(host.querySelector("[data-signup-data-unbound]")?.textContent).toBe(
      "No forms data. Reconnect"
    );
    expect(host.querySelector("[data-signup-warning]")?.textContent).toBe(
      "No Submit Button"
    );
    // the org defaults still list their rows
    expect(checkbox(host, "Email")?.getAttribute("data-state")).toBe("checked");
  });

  test("bound data shows no No forms data line", async () => {
    const host = await renderPanel(setProject());
    expect(host.querySelector("[data-signup-data-unbound]")).toBeNull();
  });

  test("After submit maps Message to state, and Page shows the page select", async () => {
    const rootId = setProject();
    const host = await renderPanel(rootId);
    const radios = Array.from(host.querySelectorAll("label"))
      .map((label) => label.textContent)
      .filter((label) => label === "Message" || label === "Page");
    expect(radios).toEqual(["Message", "Page"]);

    const page = Array.from(host.querySelectorAll("label")).find(
      (label) => label.textContent === "Page"
    ) as HTMLLabelElement;
    await userEvent.click(page);
    await settle();
    const action = [...$props.get().values()].find(
      (prop) => prop.instanceId === rootId && prop.name === "action"
    );
    expect(action).toMatchObject({ type: "string", value: "page" });
    expect(host.querySelector("[data-after-submit-page]")).not.toBeNull();
    expect(host.textContent).toContain("Choose page");

    const message = Array.from(host.querySelectorAll("label")).find(
      (label) => label.textContent === "Message"
    ) as HTMLLabelElement;
    await userEvent.click(message);
    await settle();
    expect(
      [...$props.get().values()].find(
        (prop) => prop.instanceId === rootId && prop.name === "action"
      )
    ).toMatchObject({ type: "string", value: "state" });
  });

  test("Page writes actionPage through the props logic's change path", async () => {
    const rootId = setProject();
    const onChangeByPropName = vi.fn();
    const onChange = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root?.render(
        createElement(
          TooltipProvider,
          null,
          renderControl({
            instanceId: rootId,
            meta: {
              type: "string",
              control: "radio",
              required: false,
              options: ["state", "page"],
            },
            prop: undefined,
            propName: "action",
            computedValue: "page",
            onChange,
            onChangeByPropName,
          })
        )
      )
    );
    const select = container.querySelector<HTMLElement>(
      "[data-after-submit-page] [role='combobox']"
    );
    await userEvent.click(select as HTMLElement);
    await userEvent.click(page.getByRole("option", { name: "Home" }));
    const homePageId = $pages.get()?.homePageId;
    expect(onChangeByPropName).toHaveBeenCalledWith("actionPage", {
      type: "page",
      value: homePageId,
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("a bound After submit is read-only, its page select included", async () => {
    const rootId = setProject();
    const props = new Map($props.get());
    props.set("action-prop", {
      id: "action-prop",
      instanceId: rootId,
      name: "action",
      type: "expression",
      value: `"page"`,
    });
    $props.set(props);
    const host = await renderPanel(rootId);
    const pageSelects = host.querySelectorAll<HTMLButtonElement>(
      "[data-after-submit-page] [role='combobox']"
    );
    expect(pageSelects.length).toBeGreaterThan(0);
    for (const select of pageSelects) {
      expect(select.disabled).toBe(true);
    }
  });

  test("no row is wider than a 240px panel", async () => {
    const rootId = setProject();
    const host = await renderPanel(rootId, 240);
    // with Page, the widest state of the panel
    await userEvent.click(
      Array.from(host.querySelectorAll("label")).find(
        (label) => label.textContent === "Page"
      ) as HTMLLabelElement
    );
    await settle();
    const { right } = host.getBoundingClientRect();
    const controls = host.querySelectorAll("[data-organizeos-control]");
    expect(controls).toHaveLength(4);
    const overflowing = Array.from(controls)
      .flatMap((control) => Array.from(control.querySelectorAll("*")))
      .filter((element) => element.getBoundingClientRect().right > right + 0.5);
    expect(
      overflowing.map((element) => element.outerHTML.slice(0, 80))
    ).toEqual([]);
  });
});
