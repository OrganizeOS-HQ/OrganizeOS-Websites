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
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import { coreMetas, type Instance, type Prop } from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import { orgDefaultFields } from "@organizeos/site-components/forms-data";
import { $, organizeos } from "@organizeos/site-components/site-templates";
// The body of GET /v1/forms, the platform's contract fixture.
import formsBody from "../../../../../../../packages/sdk-components-organizeos/src/__fixtures__/forms.json";
import {
  $organizeosSite,
  $registeredComponentMetas,
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
import { renderControl } from "./combined";
import { getOrganizeosControl } from "./organizeos-controls";
import { getFieldNameOptions } from "./organizeos-field-control";

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
const [newsletter] = formsBody.data;

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let root: Root | undefined;
let container: HTMLElement | undefined;

const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });

/** The template in a body; the first Signup Form's `data` is the Forms body. */
const setProject = (template: JSX.Element, record?: string) => {
  const data = renderData(<$.Body ws:id="bodyId">{template}</$.Body>);
  const props = new Map(data.props);
  const formRoot = [...data.instances.values()].find(
    (instance) => instance.component === `${ns}:SignupForm`
  );
  if (formRoot !== undefined) {
    props.set("data-prop", {
      id: "data-prop",
      instanceId: formRoot.id,
      name: "data",
      type: "json",
      value: formsBody,
    });
    if (record !== undefined) {
      props.set("record-prop", {
        id: "record-prop",
        instanceId: formRoot.id,
        name: "record",
        type: "string",
        value: record,
      });
    }
  }
  $instances.set(data.instances);
  $props.set(props);
  $breakpoints.set(data.breakpoints);
  $styles.set(data.styles);
  $styleSources.set(data.styleSources);
  $styleSourceSelections.set(data.styleSourceSelections);
  $assets.set(new Map());
  $resources.set(new Map());
  $dataSources.set(data.dataSources);
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
};

/** The selector of the Field whose `field` is `name`, from the body. */
const selectField = (name: string) => {
  const instances = $instances.get();
  const prop = [...$props.get().values()].find(
    (item) =>
      item.name === "field" && item.type === "string" && item.value === name
  ) as Prop;
  const parents = new Map<string, string>();
  for (const instance of instances.values()) {
    for (const child of instance.children) {
      if (child.type === "id") {
        parents.set(child.value, instance.id);
      }
    }
  }
  const selector = [prop.instanceId];
  let parent = parents.get(prop.instanceId);
  while (parent !== undefined) {
    selector.push(parent);
    parent = parents.get(parent);
  }
  selectInstance(selector);
  return selector;
};

const renderFieldControl = async (fieldId: string, value: string) => {
  container = document.createElement("div");
  container.style.width = "240px";
  document.body.appendChild(container);
  root = createRoot(container);
  await settle();
  await act(async () =>
    root?.render(
      createElement(
        TooltipProvider,
        null,
        renderControl({
          instanceId: fieldId,
          meta: {
            type: "string",
            control: "text",
            required: true,
            label: "Form field",
          },
          prop: [...$props.get().values()].find(
            (prop) => prop.instanceId === fieldId && prop.name === "field"
          ),
          propName: "field",
          computedValue: value,
          onChange: () => {},
        })
      )
    )
  );
  await settle();
  return container;
};

const optionTexts = async () => {
  await userEvent.click(
    container?.querySelector('[role="combobox"]') as HTMLElement
  );
  return Array.from(document.querySelectorAll('[role="option"]'), (option) =>
    option.textContent?.trim()
  );
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

describe("getFieldNameOptions", () => {
  test("the form's fields in its order, each with its name as description", () => {
    const { options, selected } = getFieldNameOptions(
      orgDefaultFields,
      "phone"
    );
    expect(options).toEqual([
      { value: "email", label: "Email", description: "email" },
      { value: "first_name", label: "First name", description: "first_name" },
      { value: "last_name", label: "Last name", description: "last_name" },
      { value: "phone", label: "Phone", description: "phone" },
    ]);
    expect(selected).toEqual(options[3]);
  });

  test("a current name the form lacks stays listed first, by its name", () => {
    const { options, selected } = getFieldNameOptions(
      orgDefaultFields,
      " nickname "
    );
    expect(options[0]).toEqual({ value: "nickname", label: "nickname" });
    expect(selected).toEqual(options[0]);
    expect(getFieldNameOptions(orgDefaultFields, "").selected).toBeUndefined();
  });
});

describe("the Field's Form field", () => {
  test("lists the picked form's fields, in its order", async () => {
    setProject(organizeosTemplates.SignupForm.template, newsletter.id);
    const [fieldId] = selectField("first_name");
    await renderFieldControl(fieldId, "first_name");
    expect(container?.querySelector('[role="combobox"]')?.textContent).toBe(
      "First name"
    );
    expect(await optionTexts()).toEqual(
      newsletter.fields.map((field) => field.label)
    );
  });

  test("lists the org defaults' four fields with no form picked", async () => {
    setProject(organizeosTemplates.SignupForm.template);
    const [fieldId] = selectField("email");
    await renderFieldControl(fieldId, "email");
    expect(await optionTexts()).toEqual(
      orgDefaultFields.map((field) => field.label)
    );
  });

  test("choosing a field writes it and renames the Field in the navigator; one undo restores both", async () => {
    setProject(organizeosTemplates.SignupForm.template);
    const [fieldId] = selectField("first_name");
    const before = { instances: $instances.get(), props: $props.get() };
    await renderFieldControl(fieldId, "first_name");
    await optionTexts();
    await userEvent.click(
      page.getByRole("option", { name: "Last name", exact: true })
    );
    await settle();

    expect(
      [...$props.get().values()].find(
        (prop) => prop.instanceId === fieldId && prop.name === "field"
      )
    ).toMatchObject({ type: "string", value: "last_name" });
    expect($instances.get().get(fieldId)?.label).toBe("Last name");
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(1);

    serverSyncStore.undo();

    expect($instances.get()).toEqual(before.instances);
    expect($props.get()).toEqual(before.props);
  });

  test("a designer's own label is kept", async () => {
    setProject(organizeosTemplates.SignupForm.template);
    const [fieldId] = selectField("first_name");
    const instance = $instances.get().get(fieldId) as Instance;
    $instances.set(
      new Map($instances.get()).set(fieldId, { ...instance, label: "Name" })
    );
    await renderFieldControl(fieldId, "first_name");
    await optionTexts();
    await userEvent.click(
      page.getByRole("option", { name: "Phone", exact: true })
    );
    await settle();
    expect($instances.get().get(fieldId)?.label).toBe("Name");
  });

  test("a Field under an RSVP Form, or outside any form, keeps the text box", () => {
    setProject(organizeosTemplates.RsvpForm.template);
    const rsvpField = [...$instances.get().values()].find(
      (instance) => instance.component === `${ns}:Field`
    ) as Instance;
    const parents = (id: string) =>
      [...$instances.get().values()].find((instance) =>
        instance.children.some(
          (child) => child.type === "id" && child.value === id
        )
      )?.id;
    const selector = [rsvpField.id];
    for (let id = parents(rsvpField.id); id; id = parents(id)) {
      selector.push(id);
    }
    expect(
      getOrganizeosControl({
        component: `${ns}:Field`,
        propName: "field",
        instanceSelector: selector,
      })
    ).toBeUndefined();

    setProject(<organizeos.Field field="email" ws:id="loose" />);
    expect(
      getOrganizeosControl({
        component: `${ns}:Field`,
        propName: "field",
        instanceSelector: ["loose", "bodyId"],
      })
    ).toBeUndefined();

    setProject(organizeosTemplates.SignupForm.template);
    expect(
      getOrganizeosControl({
        component: `${ns}:Field`,
        propName: "field",
        instanceSelector: selectField("email"),
      })
    ).toBe("field-name");
  });
});
