import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Instance, WebstudioFragment } from "@webstudio-is/sdk";
import { renderTemplate } from "@webstudio-is/template";
import * as organizeosTemplates from "@organizeos/site-components/templates";

// OrganizeOS fork: a forms insert's site form (builder forms spec 5.1, 7.3;
// plan 2026-11-13-builder-forms-fork-p2, Task 8, P11, P12): the fields a
// template's root collects, the org's name in its intro, the root's mark, a
// placement's stable client id, and F3 made once per client id.

const { createSiteForm } = vi.hoisted(() => ({ createSiteForm: vi.fn() }));
vi.mock("./forms-api", () => ({ createSiteForm }));

import {
  SITE_FORM_CREATE_FAILED,
  createSiteFormOnce,
  createSiteFormsForPlacements,
  fillOrgName,
  markSiteForm,
  placementClientId,
  siteFormFieldsOf,
  siteFormInserts,
} from "./site-form-insert";

const namespace = "@organizeos/site-components";
const updates = () =>
  renderTemplate(organizeosTemplates.SignupFormCard.template);
const contact = () =>
  renderTemplate(organizeosTemplates.ContactFormCard.template);
const inline = () =>
  renderTemplate(organizeosTemplates.SignupFormInline.template);

const rootOf = (fragment: WebstudioFragment) => {
  const [child] = fragment.children;
  return fragment.instances.find(
    (instance) => instance.id === child.value
  ) as Instance;
};
const propOf = (
  fragment: WebstudioFragment,
  instanceId: string,
  name: string
) =>
  fragment.props.find(
    (prop) => prop.instanceId === instanceId && prop.name === name
  );
const introText = (fragment: WebstudioFragment) =>
  fragment.instances
    .find((instance) => instance.label === "Intro")
    ?.children.flatMap((child) => (child.type === "text" ? [child.value] : []));

const created = (id: string) => ({
  ok: true as const,
  value: {
    id,
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

beforeEach(() => {
  createSiteForm.mockReset();
});

describe("siteFormInserts", () => {
  test("the three forms inserts: their kind and insert name", () => {
    expect([...siteFormInserts]).toEqual([
      [
        `${namespace}:SignupFormCard`,
        { kind: "contact-signup", name: "Email & SMS updates" },
      ],
      [
        `${namespace}:SignupFormInline`,
        { kind: "contact-signup", name: "Email bar" },
      ],
      [
        `${namespace}:ContactFormCard`,
        { kind: "contact-form", name: "Contact us" },
      ],
    ]);
  });
});

describe("siteFormFieldsOf", () => {
  test("the card's keys in tree order, required from each Field's prop", () => {
    const fragment = updates();
    expect(siteFormFieldsOf(fragment, rootOf(fragment).id)).toEqual([
      { key: "first_name", required: false },
      { key: "last_name", required: false },
      { key: "email", required: true },
    ]);
    const message = contact();
    expect(siteFormFieldsOf(message, rootOf(message).id)).toEqual([
      { key: "name", required: false },
      { key: "email", required: true },
      { key: "message", required: true },
    ]);
  });

  test("the Email bar: Email, required as the platform forces it", () => {
    const fragment = inline();
    expect(siteFormFieldsOf(fragment, rootOf(fragment).id)).toEqual([
      { key: "email", required: false },
    ]);
  });
});

describe("fillOrgName", () => {
  test("puts the org's name in the updates card's intro", () => {
    expect(introText(fillOrgName(updates(), "Riverside Tenants"))).toEqual([
      "News and actions from Riverside Tenants.",
    ]);
  });

  test.each([undefined, "", "   "])(
    "keeps 'News and actions from us.' for the name %j",
    (name) => {
      expect(introText(fillOrgName(updates(), name))).toEqual([
        "News and actions from us.",
      ]);
    }
  );

  test("leaves Contact us's intro, which names no org", () => {
    expect(introText(fillOrgName(contact(), "Riverside Tenants"))).toEqual([
      "Send us a message and we'll reply.",
    ]);
  });
});

describe("markSiteForm", () => {
  test("writes the root's record and siteForm, and its label when it has none", () => {
    const fragment = inline();
    const root = rootOf(fragment);
    const marked = markSiteForm(fragment, root.id, {
      formId: "51000000-0000-4000-8000-000000000001",
      kind: "contact-signup",
      label: "Email bar",
    });
    expect(propOf(marked, root.id, "record")).toMatchObject({
      type: "string",
      value: "51000000-0000-4000-8000-000000000001",
    });
    expect(propOf(marked, root.id, "siteForm")).toMatchObject({
      type: "string",
      value: "contact-signup",
    });
    expect(rootOf(marked).label).toBe("Email bar");
    // one record prop, never two
    expect(
      marked.props.filter(
        (prop) => prop.instanceId === root.id && prop.name === "record"
      )
    ).toHaveLength(1);
  });

  test("keeps a card root's own label", () => {
    const fragment = updates();
    const marked = markSiteForm(fragment, rootOf(fragment).id, {
      formId: "f",
      kind: "contact-signup",
      label: "Email & SMS updates",
    });
    expect(rootOf(marked).label).toBe("Email & SMS updates");
  });
});

describe("placementClientId", () => {
  test("a version 4 UUID, the same for the same project, template and placement", async () => {
    const first = await placementClientId(
      "project-1",
      "porch-light",
      "signup:"
    );
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(await placementClientId("project-1", "porch-light", "signup:")).toBe(
      first
    );
    expect(
      await placementClientId("project-2", "porch-light", "signup:")
    ).not.toBe(first);
    expect(
      await placementClientId("project-1", "porch-light", "join:")
    ).not.toBe(first);
  });
});

describe("createSiteFormOnce", () => {
  const body = {
    kind: "contact-signup" as const,
    title: "Home: Email bar",
    fields: [{ key: "email", required: true }],
    clientId: "0c000000-0000-4000-8000-000000000001",
  };

  test("a lost answer is retried once with the same clientId", async () => {
    createSiteForm
      .mockResolvedValueOnce({ ok: false, error: "lost" })
      .mockResolvedValueOnce(created("form-1"));
    expect(await createSiteFormOnce("project-1", body)).toEqual(
      created("form-1")
    );
    expect(createSiteForm.mock.calls).toEqual([
      ["project-1", body],
      ["project-1", body],
    ]);
  });

  test("any other refusal is not retried", async () => {
    createSiteForm.mockResolvedValueOnce({ ok: false, error: "plan" });
    expect(await createSiteFormOnce("project-1", body)).toEqual({
      ok: false,
      error: "plan",
    });
    expect(createSiteForm).toHaveBeenCalledTimes(1);
  });

  test("the insert's toast", () => {
    expect(SITE_FORM_CREATE_FAILED).toBe(
      "Couldn't create the form. Try again."
    );
  });
});

describe("createSiteFormsForPlacements", () => {
  const placement = (rootId: string) => ({
    rootId,
    kind: "contact-signup" as const,
    title: `Home: Signup Form`,
    fields: [{ key: "email", required: true }],
    clientId: `0c000000-0000-4000-8000-00000000000${rootId.length}`,
  });

  test("one F3 per placement, its form by root id", async () => {
    createSiteForm
      .mockResolvedValueOnce(created("form-a"))
      .mockResolvedValueOnce(created("form-b"));
    const result = await createSiteFormsForPlacements("project-1", [
      placement("a"),
      placement("bb"),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.forms].map(([root, form]) => [root, form.id])).toEqual([
        ["a", "form-a"],
        ["bb", "form-b"],
      ]);
    }
    expect(createSiteForm).toHaveBeenCalledTimes(2);
  });

  test("one failed create fails the lot", async () => {
    createSiteForm
      .mockResolvedValueOnce(created("form-a"))
      .mockResolvedValueOnce({ ok: false, error: "forbidden" });
    expect(
      await createSiteFormsForPlacements("project-1", [
        placement("a"),
        placement("bb"),
      ])
    ).toEqual({ ok: false });
  });

  test("no placement asks nothing", async () => {
    expect(await createSiteFormsForPlacements("project-1", [])).toEqual({
      ok: true,
      forms: new Map(),
    });
    expect(createSiteForm).not.toHaveBeenCalled();
  });
});
