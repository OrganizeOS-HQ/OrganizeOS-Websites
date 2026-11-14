import { beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import type { Project } from "@webstudio-is/project";
import { createDefaultPages } from "@webstudio-is/project-build";
import { renderData } from "@webstudio-is/template";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import { type Instance, coreMetas } from "@webstudio-is/sdk";
import * as organizeosMetas from "@organizeos/site-components/metas";
import * as organizeosTemplates from "@organizeos/site-components/templates";
import { $ } from "@organizeos/site-components/site-templates";
import forms from "../../../../../../packages/sdk-components-organizeos/src/__fixtures__/forms.json";
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
import { emitCommand } from "~/builder/shared/commands";

// OrganizeOS fork: the Form row's site forms (builder forms spec 9; plan
// 2026-11-13-builder-forms-fork-p2, Task 9, P2, P4): a block's kind, the
// options a block's kind offers, a site form chosen or made new, and a CRM
// form chosen, each one write and one undo.

const { toastError, createSiteForm } = vi.hoisted(() => ({
  toastError: vi.fn(),
  createSiteForm: vi.fn(),
}));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError, info: vi.fn() } },
}));
vi.mock("./forms-api", () => ({ createSiteForm, getFormsAccess: vi.fn() }));

import {
  changeSignupForm,
  listRootFields,
  signupFormComponent,
} from "./signup-fields";
import {
  NEW_SITE_FORM,
  crmFormUrl,
  formKindOf,
  formStatesFor,
  matchFieldsToSiteForm,
  pointAtNewSiteForm,
  siteFormRecordOptions,
} from "./site-forms";

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

const SITE_FORM = forms.data[4];
const NEWSLETTER = forms.data[0];
const CONTACT = forms.data[1];

const setSignupForm = (
  template: JSX.Element = organizeosTemplates.SignupForm.template
) => {
  const data = renderData(<$.Body ws:id="bodyId">{template}</$.Body>);
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
    subdomain: "riverside",
    manageUrl: "https://app.example.org/riverside/website",
    platformUrl: "https://app.example.org",
    blocksEnabled: true,
    siteFormsEnabled: true,
  });
  const root = [...$instances.get().values()].find(
    (instance) => instance.component === signupFormComponent
  ) as Instance;
  selectInstance([root.id, "bodyId"]);
  return root.id;
};

const rootProp = (rootId: string, name: string) =>
  [...$props.get().values()].find(
    (prop) => prop.instanceId === rootId && prop.name === name
  );
const fieldProps = (rootId: string) => {
  const { byName, order } = listRootFields(
    rootId,
    $instances.get(),
    $props.get()
  );
  return order.map((key) => {
    const [id] = byName.get(key) ?? [];
    const of = (name: string) =>
      [...$props.get().values()].find(
        (prop) => prop.instanceId === id && prop.name === name
      )?.value;
    return [key, of("fieldType"), of("required")];
  });
};
const writeProp = (rootId: string, name: string, value: string) => {
  const props = new Map($props.get());
  props.set(`${rootId}:${name}`, {
    id: `${rootId}:${name}`,
    instanceId: rootId,
    name,
    type: "string",
    value,
  });
  $props.set(props);
};

beforeEach(() => {
  toastError.mockClear();
  createSiteForm.mockReset();
});

describe("formKindOf", () => {
  test("a marked root is its mark's kind", () => {
    const rootId = setSignupForm();
    writeProp(rootId, "siteForm", "contact-form");
    expect(formKindOf(rootId, forms)).toBe("contact-form");
  });

  test("an unmarked root on a CRM contact form is contact-form (P4)", () => {
    const rootId = setSignupForm();
    writeProp(rootId, "record", CONTACT.id);
    expect(formKindOf(rootId, forms)).toBe("contact-form");
  });

  test("a root with no form, or an unknown one, is contact-signup", () => {
    const rootId = setSignupForm();
    expect(formKindOf(rootId, forms)).toBe("contact-signup");
    writeProp(rootId, "record", "00000000-0000-4000-8000-000000000000");
    expect(formKindOf(rootId, forms)).toBe("contact-signup");
  });
});

describe("siteFormRecordOptions", () => {
  const none = { value: "", label: "Org defaults" };
  const shipped = [
    none,
    { value: NEWSLETTER.id, label: "Newsletter", description: "Newsletter" },
    { value: CONTACT.id, label: "Get in touch", description: "Contact" },
    {
      value: forms.data[3].id,
      label: "Get updates",
      description: "Newsletter",
    },
    {
      value: SITE_FORM.id,
      label: "Home: Email & SMS updates",
      description: "Newsletter",
    },
  ];

  test("the block's kind only, site forms first, then New form", () => {
    expect(siteFormRecordOptions(shipped, forms, "contact-signup")).toEqual([
      none,
      shipped[4],
      shipped[1],
      shipped[3],
      NEW_SITE_FORM,
    ]);
    expect(siteFormRecordOptions(shipped, forms, "contact-form")).toEqual([
      none,
      shipped[2],
      NEW_SITE_FORM,
    ]);
  });

  test("keeps an option the data does not know (Unavailable form) where it was", () => {
    const unavailable = { value: "x", label: "Unavailable form" };
    expect(
      siteFormRecordOptions(
        [none, unavailable, shipped[1]],
        forms,
        "contact-signup"
      )
    ).toEqual([none, unavailable, shipped[1], NEW_SITE_FORM]);
  });
});

describe("matchFieldsToSiteForm", () => {
  const form = {
    id: SITE_FORM.id,
    fields: [
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", type: "phone", required: false },
      {
        name: "topic",
        label: "Topic",
        type: "select",
        required: true,
        options: ["A", "B"],
      },
    ],
  };

  test("points the root at the site form and makes its Fields match, kept ones included, in one undo", async () => {
    const rootId = setSignupForm();
    const before = structuredClone($props.get());
    expect(await matchFieldsToSiteForm(rootId, form, "contact-signup")).toBe(
      true
    );

    expect(rootProp(rootId, "record")?.value).toBe(SITE_FORM.id);
    expect(rootProp(rootId, "siteForm")?.value).toBe("contact-signup");
    // first_name is gone; email kept; phone and topic added; every Field defined
    expect(fieldProps(rootId)).toEqual([
      ["email", "email", true],
      ["phone", "phone", false],
      ["topic", "select", true],
    ]);
    emitCommand("undo");
    expect($props.get()).toEqual(before);
  });
});

describe("pointAtNewSiteForm", () => {
  test("creates a form of the root's keys, then points the root at it", async () => {
    const rootId = setSignupForm();
    createSiteForm.mockResolvedValue({
      ok: true,
      value: {
        id: "new-form",
        fields: [
          { name: "email", label: "Email", type: "email", required: true },
          {
            name: "first_name",
            label: "First name",
            type: "text",
            required: false,
          },
        ],
      },
    });
    expect(await pointAtNewSiteForm(rootId, "contact-signup")).toBe(true);
    expect(createSiteForm).toHaveBeenCalledTimes(1);
    expect(createSiteForm.mock.calls[0][1]).toMatchObject({
      kind: "contact-signup",
      title: "Home: Signup Form",
      fields: [
        { key: "email", required: false },
        { key: "first_name", required: false },
      ],
    });
    expect(rootProp(rootId, "record")?.value).toBe("new-form");
    expect(rootProp(rootId, "siteForm")?.value).toBe("contact-signup");
    expect(fieldProps(rootId)).toEqual([
      ["email", "email", true],
      ["first_name", "text", false],
    ]);
  });

  test("a failed create writes nothing and toasts", async () => {
    const rootId = setSignupForm();
    const before = structuredClone($props.get());
    createSiteForm.mockResolvedValue({ ok: false, error: "plan" });
    expect(await pointAtNewSiteForm(rootId, "contact-signup")).toBe(false);
    expect($props.get()).toEqual(before);
    expect(toastError).toHaveBeenCalledWith(
      "Couldn't create the form. Try again."
    );
  });
});

describe("a CRM form chosen", () => {
  test("clears the site form mark with the record, in one write", async () => {
    const rootId = setSignupForm();
    writeProp(rootId, "siteForm", "contact-signup");
    expect(await changeSignupForm(rootId, NEWSLETTER.id, [])).toBe(true);
    expect(rootProp(rootId, "record")?.value).toBe(NEWSLETTER.id);
    expect(rootProp(rootId, "siteForm")).toBeUndefined();
  });
});

describe("crmFormUrl", () => {
  test("the form's CRM editor in the org's workspace", () => {
    setSignupForm();
    expect(crmFormUrl("form-1")).toBe(
      "https://app.example.org/riverside/pages/signup/form-1"
    );
  });

  test("none without the org's subdomain", () => {
    setSignupForm();
    $organizeosSite.set({ ...$organizeosSite.get()!, subdomain: undefined });
    expect(crmFormUrl("form-1")).toBeUndefined();
  });
});

describe("formStatesFor", () => {
  test("a contact form has no Check email state (spec 9)", () => {
    expect(formStatesFor("contact-form")).not.toContain("confirm-email");
    expect(formStatesFor("contact-signup")).toContain("confirm-email");
  });
});
