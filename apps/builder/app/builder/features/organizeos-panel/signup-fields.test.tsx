import { beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { renderData, ws } from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import { coreMetas, type Instance } from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import { $, organizeos } from "@organizeos/site-components/site-templates";
import {
  type SignupFormResolution,
  isRequiredField,
  orgDefaultFields,
  resolveSignupForm,
} from "@organizeos/site-components/forms-data";
import {
  $organizeosSite,
  $registeredComponentMetas,
  $selectedInstanceSelector,
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
import {
  type FormField,
  addSignupField,
  changeSignupFieldName,
  changeSignupForm,
  fieldComponent,
  findFieldInsertTarget,
  findSignupFormRoot,
  formRootComponents,
  isNestedInForm,
  getFieldRows,
  getSignupWarning,
  listRootFields,
  removeSignupField,
  signupFormComponent,
} from "./signup-fields";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError, info: vi.fn() } },
}));

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

const field = (
  name: string,
  label: string,
  extra: Partial<FormField> = {}
): FormField => ({
  name,
  label,
  type: "text",
  required: false,
  options: null,
  ...extra,
});

const contactFields: FormField[] = [
  field("email", "Email", { type: "email", required: true }),
  field("first_name", "First name"),
  field("company", "Company", { required: true }),
  field("phone", "Phone", { type: "phone" }),
  field("sms_opt_in", "Text me updates", {
    type: "checkbox",
    consent: "sms",
    consentVersion: "v1",
  }),
];

const setProject = (body: JSX.Element) => {
  const data = renderData(body);
  $instances.set(data.instances);
  $props.set(data.props);
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

const setSignupForm = (
  template: JSX.Element = organizeosTemplates.SignupForm.template
) => {
  setProject(<$.Body ws:id="bodyId">{template}</$.Body>);
  const root = [...$instances.get().values()].find(
    (instance) => instance.component === signupFormComponent
  ) as Instance;
  selectInstance([root.id, "bodyId"]);
  return root.id;
};

const rootFields = (rootId: string) =>
  listRootFields(rootId, $instances.get(), $props.get());

const fieldNames = (rootId: string) => rootFields(rootId).order;

const instancesOf = (component: string) =>
  [...$instances.get().values()].filter(
    (instance) => instance.component === component
  );

const byLabel = (label: string) =>
  [...$instances.get().values()].find((instance) => instance.label === label);

const childComponents = (instanceId: string) =>
  ($instances.get().get(instanceId) as Instance).children.map((child) =>
    child.type === "id" ? $instances.get().get(child.value)?.component : child
  );

const undoDepth = () => serverSyncStore.transactionManager.currentStack.length;

const tokenNames = () =>
  [...$styleSources.get().values()].flatMap((source) =>
    source.type === "token" ? [source.name] : []
  );

beforeEach(() => {
  toastError.mockClear();
});

describe("findSignupFormRoot", () => {
  test("the root itself, or the closest Signup Form above the selection", () => {
    const rootId = setSignupForm();
    const email = rootFields(rootId).byName.get("email")?.[0] as string;
    const content = byLabel("Form Content") as Instance;
    expect(findSignupFormRoot([rootId, "bodyId"], $instances.get())).toEqual([
      rootId,
      "bodyId",
    ]);
    expect(
      findSignupFormRoot(
        [email, content.id, rootId, "bodyId"],
        $instances.get()
      )
    ).toEqual([rootId, "bodyId"]);
    expect(findSignupFormRoot(["bodyId"], $instances.get())).toBeUndefined();
  });

  test("none for a Field under an RSVP Form", () => {
    setProject(
      <$.Body ws:id="bodyId">{organizeosTemplates.RsvpForm.template}</$.Body>
    );
    const [rsvp] = instancesOf(`${ns}:RsvpForm`);
    const [first] = instancesOf(fieldComponent);
    expect(
      findSignupFormRoot([first.id, rsvp.id, "bodyId"], $instances.get())
    ).toBeUndefined();
    expect(formRootComponents.has(`${ns}:RsvpForm`)).toBe(false);
  });
});

describe("isNestedInForm", () => {
  test("an ancestor whose tag is form, the root's own tag excluded", () => {
    const tags = new Map([
      ["root", "form"],
      ["box", "div"],
      ["outer", "form"],
    ]);
    expect(isNestedInForm(["root", "box", "body"], tags)).toBe(false);
    expect(isNestedInForm(["root", "box", "outer", "body"], tags)).toBe(true);
  });
});

describe("listRootFields and getFieldRows", () => {
  test("a row is checked while the root has a descendant Field of its name, in the form's order", () => {
    const rootId = setSignupForm();
    const { byName, order, hasSubmit } = rootFields(rootId);
    expect(order).toEqual(["email", "first_name"]);
    expect(hasSubmit).toBe(true);
    expect(getFieldRows(contactFields, byName)).toEqual([
      {
        name: "email",
        label: "Email",
        checked: true,
        locked: true,
        consent: false,
      },
      {
        name: "first_name",
        label: "First name",
        checked: true,
        locked: false,
        consent: false,
      },
      {
        name: "company",
        label: "Company",
        checked: false,
        locked: false,
        consent: false,
      },
      {
        name: "phone",
        label: "Phone",
        checked: false,
        locked: false,
        consent: false,
      },
      {
        name: "sms_opt_in",
        label: "SMS consent",
        checked: false,
        locked: false,
        consent: true,
      },
    ]);
  });

  test("counts a Field in a nested container", () => {
    const rootId = setSignupForm(
      <organizeos.SignupForm>
        <ws.element ws:tag="div" ws:label="Form Content">
          <ws.element ws:tag="div" ws:label="Row">
            <organizeos.Field field="email" />
          </ws.element>
          <organizeos.SubmitButton />
        </ws.element>
      </organizeos.SignupForm>
    );
    expect(fieldNames(rootId)).toEqual(["email"]);
  });

  test("the same in every state, with Form Content hidden: it reads the build, not the canvas", () => {
    const rootId = setSignupForm();
    const [formState] = [...$dataSources.get().values()];
    const expected = getFieldRows(contactFields, rootFields(rootId).byName);
    for (const state of [
      "initial",
      "submitting",
      "success",
      "confirm-email",
      "error",
      "unavailable",
    ]) {
      $dataSourceVariables.set(new Map([[formState.id, state]]));
      expect(getFieldRows(contactFields, rootFields(rootId).byName)).toEqual(
        expected
      );
    }
  });

  test("a required row is locked only while its Field exists", () => {
    const rows = getFieldRows(contactFields, new Map());
    expect(rows.find((row) => row.name === "email")).toMatchObject({
      checked: false,
      locked: false,
    });
  });

  test("a consent row reads the navigator's short name, never the form's consent wording", () => {
    const present = new Map<string, string[]>();
    const labels = getFieldRows(
      [
        ...contactFields,
        field("email_opt_in", "Email me news and updates.", {
          type: "checkbox",
          consent: "email",
        }),
      ],
      present
    ).map((row) => row.label);
    expect(labels).toEqual([
      "Email",
      "First name",
      "Company",
      "Phone",
      "SMS consent",
      "Consent",
    ]);
  });

  test("a consent row is listed only while the definition has it, and never locked", () => {
    const required = contactFields.map((item) =>
      item.consent === undefined ? item : { ...item, required: true }
    );
    const present = new Map([["sms_opt_in", ["x"]]]);
    expect(
      getFieldRows(required, present).find((row) => row.name === "sms_opt_in")
    ).toEqual({
      name: "sms_opt_in",
      label: "SMS consent",
      checked: true,
      locked: false,
      consent: true,
    });
    const withoutConsent = contactFields.filter(
      (item) => item.consent === undefined
    );
    expect(
      getFieldRows(withoutConsent, present).map((row) => row.name)
    ).not.toContain("sms_opt_in");
  });

  test("a consent field its definition marks required is not locked, missing or inserted: the blocks' one rule", async () => {
    const requiredConsent = contactFields.map((item) =>
      item.consent === undefined ? item : { ...item, required: true }
    );
    expect(
      requiredConsent
        .filter((item) => item.consent !== undefined)
        .map(isRequiredField)
    ).toEqual([false]);
    const rows = getFieldRows(
      requiredConsent,
      new Map([["sms_opt_in", ["id"]]])
    );
    expect(rows.find((row) => row.name === "sms_opt_in")?.locked).toBe(false);
    expect(
      getSignupWarning({
        nested: false,
        data: { data: [] },
        resolution: {
          formId: "form-1",
          fields: requiredConsent,
          unavailable: undefined,
        },
        rootFields: {
          byName: new Map([
            ["email", ["a"]],
            ["company", ["b"]],
          ]),
          order: ["email", "company"],
          bound: [],
          hasSubmit: true,
        },
        failedLoads: false,
      })
    ).toBeUndefined();
    const rootId = setSignupForm();
    await changeSignupForm(rootId, "form-1", requiredConsent);
    expect(fieldNames(rootId)).toEqual(["email", "first_name", "company"]);
  });

  test("a custom lock rule locks what it says", () => {
    const rows = getFieldRows(
      contactFields,
      new Map([
        ["first_name", ["a"]],
        ["email", ["b"]],
      ]),
      (item) => item.name === "first_name"
    );
    expect(rows.filter((row) => row.locked).map((row) => row.name)).toEqual([
      "first_name",
    ]);
  });

  test("a bound field counts by its computed value, and is listed as bound without one", () => {
    const rootId = setSignupForm();
    const email = rootFields(rootId).byName.get("email")?.[0] as string;
    const prop = [...$props.get().values()].find(
      (item) => item.instanceId === email && item.name === "field"
    );
    if (prop === undefined) {
      throw Error("no field prop");
    }
    $props.set(
      new Map($props.get()).set(prop.id, {
        ...prop,
        type: "expression",
        value: `"email"`,
      })
    );
    expect(
      listRootFields(rootId, $instances.get(), $props.get(), () => "email")
        .byName
    ).toEqual(
      new Map([
        ["email", [email]],
        ["first_name", [expect.any(String)]],
      ])
    );
    const unknown = listRootFields(rootId, $instances.get(), $props.get());
    expect(unknown.bound).toEqual([email]);
    expect(unknown.order).toEqual(["first_name"]);
  });
});

describe("findFieldInsertTarget", () => {
  const target = (rootId: string) =>
    findFieldInsertTarget(rootId, $instances.get(), $props.get());

  test("after the last Field", () => {
    const rootId = setSignupForm();
    const content = byLabel("Form Content") as Instance;
    const firstName = rootFields(rootId).byName.get("first_name")?.[0];
    const index = content.children.findIndex(
      (child) => child.type === "id" && child.value === firstName
    );
    expect(target(rootId)).toEqual({
      parentInstanceId: content.id,
      insertIndex: index + 1,
    });
  });

  test("with no Field, before the first Submit Button", () => {
    const rootId = setSignupForm(
      <organizeos.SignupForm>
        <ws.element ws:tag="div" ws:label="Form Content">
          <ws.element ws:tag="h2" />
          <ws.element ws:tag="div">
            <organizeos.SubmitButton />
          </ws.element>
        </ws.element>
      </organizeos.SignupForm>
    );
    const wrapper = [...$instances.get().values()].find((instance) =>
      instance.children.some(
        (child) =>
          child.type === "id" &&
          $instances.get().get(child.value)?.component === `${ns}:SubmitButton`
      )
    ) as Instance;
    expect(target(rootId)).toEqual({
      parentInstanceId: wrapper.id,
      insertIndex: 0,
    });
  });

  test("with neither, last in Form Content, never the root", () => {
    const rootId = setSignupForm(
      <organizeos.SignupForm>
        <ws.element ws:tag="div" ws:label="Heading box" />
        <ws.element ws:tag="div" ws:label="Form Content">
          <ws.element ws:tag="h2" />
        </ws.element>
      </organizeos.SignupForm>
    );
    expect(target(rootId)).toEqual({
      parentInstanceId: byLabel("Form Content")?.id,
      insertIndex: 1,
    });
  });

  test("with no Form Content, last in the root's first child", () => {
    const rootId = setSignupForm(
      <organizeos.SignupForm>
        <ws.element ws:tag="div" ws:label="Box" />
      </organizeos.SignupForm>
    );
    expect(target(rootId)).toEqual({
      parentInstanceId: byLabel("Box")?.id,
      insertIndex: 0,
    });
  });

  test("undefined for a root with no child", () => {
    const rootId = setSignupForm(<organizeos.SignupForm />);
    expect(target(rootId)).toBeUndefined();
  });
});

describe("addSignupField", () => {
  test("one commit adds one Field with its parts and tokens, and no Resource, DataSource or binding; one undo removes it", async () => {
    const rootId = setSignupForm();
    const selection = $selectedInstanceSelector.get();
    const tokensBefore = tokenNames();
    const dataSources = $dataSources.get();
    const resources = $resources.get();
    const depth = undoDepth();
    const before = {
      instances: $instances.get(),
      props: $props.get(),
      styles: $styles.get(),
      styleSources: $styleSources.get(),
      styleSourceSelections: $styleSourceSelections.get(),
    };

    expect(await addSignupField(rootId, contactFields[3])).toBe(true);

    expect(undoDepth()).toBe(depth + 1);
    expect(fieldNames(rootId)).toEqual(["email", "first_name", "phone"]);
    const phone = rootFields(rootId).byName.get("phone")?.[0] as string;
    const instance = $instances.get().get(phone) as Instance;
    expect(instance.label).toBe("Phone");
    expect(childComponents(phone)).toEqual([
      `${ns}:FieldLabel`,
      `${ns}:FieldInput`,
      `${ns}:FieldMessage`,
    ]);
    // the project's "OS Field", "OS Input" and "OS Message" are reused
    expect(tokenNames().sort()).toEqual(tokensBefore.sort());
    expect($dataSources.get()).toBe(dataSources);
    expect($resources.get()).toBe(resources);
    expect($selectedInstanceSelector.get()).toEqual(selection);
    // before the Error box and the Submit Button
    const content = byLabel("Form Content") as Instance;
    expect(childComponents(content.id).slice(-4)).toEqual([
      fieldComponent,
      fieldComponent,
      "ws:element",
      `${ns}:SubmitButton`,
    ]);

    serverSyncStore.undo();

    expect($instances.get()).toEqual(before.instances);
    expect($props.get()).toEqual(before.props);
    expect($styles.get()).toEqual(before.styles);
    expect($styleSources.get()).toEqual(before.styleSources);
    expect($styleSourceSelections.get()).toEqual(before.styleSourceSelections);
  });

  test("a consent Field stores no wording and is labelled by its kind", async () => {
    const rootId = setSignupForm();
    expect(await addSignupField(rootId, contactFields[4])).toBe(true);
    const id = rootFields(rootId).byName.get("sms_opt_in")?.[0] as string;
    expect($instances.get().get(id)?.label).toBe("SMS consent");
    expect(JSON.stringify([...$instances.get().values()])).not.toContain(
      "Text me updates"
    );
  });

  test("two calls for one name before the first settles insert one Field", async () => {
    const rootId = setSignupForm();
    const results = await Promise.all([
      addSignupField(rootId, contactFields[3]),
      addSignupField(rootId, contactFields[3]),
    ]);
    expect(results).toEqual([true, true]);
    expect(rootFields(rootId).byName.get("phone")).toHaveLength(1);
  });

  test("refused, writing nothing, for an org whose blocks are not enabled", async () => {
    const rootId = setSignupForm();
    $organizeosSite.set({
      organizationId: "org-1",
      manageUrl: "https://app.example.org/dashboard",
      platformUrl: "https://app.example.org",
      blocksEnabled: false,
    });
    const instances = $instances.get();
    expect(await addSignupField(rootId, contactFields[3])).toBe(false);
    expect($instances.get()).toBe(instances);
    expect(toastError).toHaveBeenCalledWith(
      "Cannot add Phone: OrganizeOS blocks are not available for this site yet."
    );
  });

  test("refused, writing nothing, with no place to go", async () => {
    const rootId = setSignupForm(<organizeos.SignupForm />);
    const instances = $instances.get();
    expect(await addSignupField(rootId, contactFields[3])).toBe(false);
    expect($instances.get()).toBe(instances);
    expect(toastError).toHaveBeenCalledWith("Cannot add Phone.");
  });
});

describe("removeSignupField", () => {
  test("deletes every Field of the name in one commit, leaving no orphan; one undo restores both", async () => {
    const rootId = setSignupForm();
    expect(await addSignupField(rootId, contactFields[3])).toBe(true);
    // a second Phone Field: First name set to phone
    const firstName = rootFields(rootId).byName.get("first_name")?.[0];
    const firstNameProp = [...$props.get().values()].find(
      (prop) => prop.instanceId === firstName && prop.name === "field"
    );
    if (firstNameProp === undefined) {
      throw Error("no field prop");
    }
    $props.set(
      new Map($props.get()).set(firstNameProp.id, {
        ...firstNameProp,
        type: "string",
        value: "phone",
      })
    );
    serverSyncStore.transactionManager.currentStack = [];
    const before = {
      instances: $instances.get(),
      props: $props.get(),
      styles: $styles.get(),
      styleSourceSelections: $styleSourceSelections.get(),
    };
    const phones = rootFields(rootId).byName.get("phone") as string[];
    expect(phones).toHaveLength(2);
    const removed = new Set(
      phones.flatMap((id) => [
        id,
        ...($instances.get().get(id) as Instance).children.flatMap((child) =>
          child.type === "id" ? [child.value] : []
        ),
      ])
    );

    expect(await removeSignupField(rootId, "phone")).toBe(true);

    expect(undoDepth()).toBe(1);
    expect(fieldNames(rootId)).toEqual(["email"]);
    for (const id of removed) {
      expect($instances.get().has(id)).toBe(false);
      expect($styleSourceSelections.get().has(id)).toBe(false);
    }
    expect(
      [...$props.get().values()].filter((prop) => removed.has(prop.instanceId))
    ).toEqual([]);
    const localSources = new Set(
      [...before.styleSourceSelections]
        .filter(([id]) => removed.has(id))
        .flatMap(([, selection]) => selection.values)
        .filter((id) => $styleSources.get().get(id)?.type !== "token")
    );
    expect(
      [...$styles.get().values()].filter((decl) =>
        localSources.has(decl.styleSourceId)
      )
    ).toEqual([]);

    serverSyncStore.undo();

    expect($instances.get()).toEqual(before.instances);
    expect($props.get()).toEqual(before.props);
    expect($styles.get()).toEqual(before.styles);
  });
});

describe("changeSignupForm", () => {
  test("keeps the Fields the new form has, inserts its missing required ones in form order, leaves the rest; one undo restores both", async () => {
    const rootId = setSignupForm();
    const before = { instances: $instances.get(), props: $props.get() };
    const newFields = [
      field("company", "Company", { required: true }),
      field("email", "Email", { type: "email", required: true }),
      field("team", "Team", { required: true }),
      field("sms_opt_in", "Text me", {
        type: "checkbox",
        consent: "sms",
        required: true,
      }),
    ];

    expect(await changeSignupForm(rootId, "form-2", newFields)).toBe(true);

    expect(undoDepth()).toBe(1);
    const record = [...$props.get().values()].find(
      (prop) => prop.instanceId === rootId && prop.name === "record"
    );
    expect(record).toMatchObject({ type: "string", value: "form-2" });
    // first_name is left; company and team are inserted after the last Field
    expect(fieldNames(rootId)).toEqual([
      "email",
      "first_name",
      "company",
      "team",
    ]);
    expect(
      getSignupWarning({
        nested: false,
        data: { data: [] },
        resolution: {
          formId: "form-2",
          fields: newFields,
          unavailable: undefined,
        },
        rootFields: rootFields(rootId),
        failedLoads: false,
      })
    ).toBe("Not in form: first_name");

    serverSyncStore.undo();

    expect($instances.get()).toEqual(before.instances);
    expect($props.get()).toEqual(before.props);
  });

  test("with the new form unknown, writes the record alone", async () => {
    const rootId = setSignupForm();
    expect(await changeSignupForm(rootId, "form-9", undefined)).toBe(true);
    expect(fieldNames(rootId)).toEqual(["email", "first_name"]);
  });
});

describe("changeSignupFieldName", () => {
  const fieldIdOf = (rootId: string, name: string) =>
    rootFields(rootId).byName.get(name)?.[0] as string;

  test("writes the field and renames the navigator label that names the old field, in one commit", async () => {
    const rootId = setSignupForm();
    const id = fieldIdOf(rootId, "first_name");
    const before = { instances: $instances.get(), props: $props.get() };

    expect(await changeSignupFieldName(id, "company", contactFields)).toBe(
      true
    );

    expect(undoDepth()).toBe(1);
    expect(fieldIdOf(rootId, "company")).toBe(id);
    expect($instances.get().get(id)?.label).toBe("Company");

    serverSyncStore.undo();

    expect($instances.get()).toEqual(before.instances);
    expect($props.get()).toEqual(before.props);
  });

  test('renames an old "Field: X" label and gives an unlabelled Field one', async () => {
    const rootId = setSignupForm();
    const id = fieldIdOf(rootId, "first_name");
    const instance = $instances.get().get(id) as Instance;
    $instances.set(
      new Map($instances.get()).set(id, {
        ...instance,
        label: "Field: First name",
      })
    );
    await changeSignupFieldName(id, "phone", contactFields);
    expect($instances.get().get(id)?.label).toBe("Phone");

    const { label: _label, ...unlabelled } = $instances
      .get()
      .get(id) as Instance;
    $instances.set(new Map($instances.get()).set(id, unlabelled));
    await changeSignupFieldName(id, "company", contactFields);
    expect($instances.get().get(id)?.label).toBe("Company");
  });

  test("keeps a designer's own label", async () => {
    const rootId = setSignupForm();
    const id = fieldIdOf(rootId, "first_name");
    const instance = $instances.get().get(id) as Instance;
    $instances.set(
      new Map($instances.get()).set(id, { ...instance, label: "Your name" })
    );
    await changeSignupFieldName(id, "company", contactFields);
    expect($instances.get().get(id)?.label).toBe("Your name");
    expect(fieldIdOf(rootId, "company")).toBe(id);
  });
});

describe("getSignupWarning", () => {
  const defaults = resolveSignupForm("", undefined);
  const resolved = (fields: FormField[]): SignupFormResolution => ({
    formId: "form-1",
    fields,
    unavailable: undefined,
  });
  const present = (
    names: string[],
    { hasSubmit = true, bound = [] as string[] } = {}
  ): ReturnType<typeof listRootFields> => ({
    byName: new Map(names.map((name) => [name, [`id-${name}`]])),
    order: Array.from(new Set(names)),
    bound,
    hasSubmit,
  });
  const warn = (input: Partial<Parameters<typeof getSignupWarning>[0]> = {}) =>
    getSignupWarning({
      nested: false,
      data: { data: [] },
      resolution: defaults,
      rootFields: present(["email"]),
      failedLoads: false,
      ...input,
    });

  test("nothing when all is well", () => {
    expect(warn()).toBeUndefined();
    expect(defaults.fields).toEqual(orgDefaultFields);
  });

  test("each line alone", () => {
    expect(warn({ nested: true })).toBe("Nested in a form");
    expect(
      warn({
        resolution: { formId: "x", fields: undefined, unavailable: "record" },
      })
    ).toBe("Form not found");
    expect(warn({ rootFields: present(["first_name"]) })).toBe(
      "Missing: Email"
    );
    expect(
      warn({
        resolution: resolved(contactFields),
        rootFields: present(["email", "company", "sms_opt_in"]),
      })
    ).toBe("SMS needs Phone");
    expect(warn({ rootFields: present(["email"], { hasSubmit: false }) })).toBe(
      "No Submit Button"
    );
    expect(warn({ rootFields: present(["email", "nickname"]) })).toBe(
      "Not in form: nickname"
    );
    expect(warn({ rootFields: present(["email", ""]) })).toBe(
      "Not in form: (blank)"
    );
  });

  test("with several, the spec's order wins", () => {
    const everything = present(["first_name", "nickname", "sms_opt_in"], {
      hasSubmit: false,
    });
    expect(warn({ nested: true, rootFields: everything })).toBe(
      "Nested in a form"
    );
    expect(
      warn({
        resolution: { formId: "x", fields: undefined, unavailable: "kind" },
        rootFields: everything,
      })
    ).toBe("Form not found");
    expect(
      warn({ resolution: resolved(contactFields), rootFields: everything })
    ).toBe("Missing: Email");
    expect(
      warn({
        resolution: resolved(contactFields),
        rootFields: present(["email", "company", "sms_opt_in", "nickname"], {
          hasSubmit: false,
        }),
      })
    ).toBe("SMS needs Phone");
    expect(
      warn({
        rootFields: present(["email", "nickname"], { hasSubmit: false }),
      })
    ).toBe("No Submit Button");
  });

  test("the first missing required field by its label", () => {
    expect(
      warn({
        resolution: resolved(contactFields),
        rootFields: present(["email", "phone"]),
      })
    ).toBe("Missing: Company");
  });

  test("SMS needs Phone not with a Phone Field", () => {
    expect(
      warn({
        resolution: resolved(contactFields),
        rootFields: present(["email", "company", "sms_opt_in", "phone"]),
      })
    ).toBeUndefined();
  });

  test("nothing while data is undefined", () => {
    expect(warn({ data: undefined, nested: true })).toBeUndefined();
    expect(
      warn({
        data: undefined,
        resolution: { formId: "x", fields: undefined, unavailable: "data" },
      })
    ).toBeUndefined();
  });

  test("Form not found for a missing form, a membership form and loaded but malformed data", () => {
    expect(warn({ resolution: resolveSignupForm("gone", { data: [] }) })).toBe(
      "Form not found"
    );
    expect(
      warn({
        resolution: resolveSignupForm("m", {
          data: [{ id: "m", kind: "membership", fields: [] }],
        }),
      })
    ).toBe("Form not found");
    expect(
      warn({
        data: { error: "Unavailable" },
        resolution: resolveSignupForm("form-1", { error: "Unavailable" }),
      })
    ).toBe("Form not found");
  });

  test("Form not found is suppressed while a load has failed", () => {
    expect(
      warn({
        data: { error: "Unavailable" },
        resolution: resolveSignupForm("form-1", { error: "Unavailable" }),
        failedLoads: true,
      })
    ).toBeUndefined();
  });

  test("a bound field is never Not in form", () => {
    expect(
      warn({ rootFields: present(["email"], { bound: ["id-bound"] }) })
    ).toBeUndefined();
  });
});
