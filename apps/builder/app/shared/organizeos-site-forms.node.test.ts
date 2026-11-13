import { describe, expect, test } from "vitest";
import type { Instance, Pages, Prop } from "@webstudio-is/sdk";
import {
  SITE_FORM_PROP,
  agreeFormRoots,
  collectFormRoots,
  formRootComponents,
  type CollectedRoot,
} from "./organizeos-site-forms";

// OrganizeOS fork: the publish step's view of a build's site forms (builder
// forms spec 7.4; plan 2026-11-13-builder-forms-fork-p2, Task 2, P2, P5, P6).
// Only roots marked `siteForm` are collected; an unmarked root (a CRM form,
// the org defaults) publishes as it always has.

const ns = "@organizeos/site-components";
const FORM = "51000000-0000-4000-8000-000000000001";
const OTHER = "52000000-0000-4000-8000-000000000002";

type Spec = {
  id: string;
  component?: string;
  label?: string;
  children?: string[];
};

const build = (
  specs: Spec[],
  props: Array<[string, string, Prop["type"], unknown]>,
  pageRoots: Array<[string, string]> = [["Home", "body"]]
) => {
  const instances = new Map<string, Instance>(
    specs.map(({ id, component = "Box", label, children = [] }) => [
      id,
      {
        type: "instance",
        id,
        component,
        ...(label === undefined ? {} : { label }),
        children: children.map((value) => ({ type: "id", value })),
      } as Instance,
    ])
  );
  const propMap = new Map<string, Prop>(
    props.map(([instanceId, name, type, value]) => [
      `${instanceId}:${name}`,
      { id: `${instanceId}:${name}`, instanceId, name, type, value } as Prop,
    ])
  );
  const pages = {
    homePageId: "page-0",
    rootFolderId: "root",
    folders: new Map(),
    pages: new Map(
      pageRoots.map(([name, rootInstanceId], index) => [
        `page-${index}`,
        {
          id: `page-${index}`,
          name,
          path: index === 0 ? "" : `/p${index}`,
          title: `"${name}"`,
          rootInstanceId,
          meta: {},
        },
      ])
    ),
  } as unknown as Pages;
  return { instances, props: propMap, pages };
};

const form = `${ns}:SignupForm`;
const field = `${ns}:Field`;

/** A marked root `root` on Home holding Fields with the given keys. */
const oneRoot = (
  keys: string[],
  extra: Array<[string, string, Prop["type"], unknown]> = []
) =>
  build(
    [
      { id: "body", children: ["root"] },
      { id: "root", component: form, children: keys.map((_, i) => `f${i}`) },
      ...keys.map((_, i) => ({ id: `f${i}`, component: field })),
    ],
    [
      ["root", SITE_FORM_PROP, "string", "contact-signup"],
      ["root", "record", "string", FORM],
      ...keys.map(
        (key, i) =>
          [`f${i}`, "field", "string", key] as [
            string,
            string,
            Prop["type"],
            unknown,
          ]
      ),
      ...extra,
    ]
  );

const roots = (result: ReturnType<typeof collectFormRoots>) => {
  if (result.ok === false) {
    throw new Error(`refused: ${result.error}`);
  }
  return result.roots;
};

describe("collectFormRoots", () => {
  test("the form roots are the Signup Form for now", () => {
    expect([...formRootComponents]).toEqual([form]);
    expect(SITE_FORM_PROP).toBe("siteForm");
  });

  test("only roots with a siteForm prop are collected", () => {
    const data = build(
      [
        { id: "body", children: ["crm", "site"] },
        { id: "crm", component: form, children: ["c1"] },
        { id: "c1", component: field },
        { id: "site", component: form, children: ["s1"] },
        { id: "s1", component: field },
      ],
      [
        ["crm", "record", "string", OTHER],
        ["c1", "field", "expression", "$ws$dataSource$x"],
        ["site", SITE_FORM_PROP, "string", "contact-signup"],
        ["site", "record", "string", FORM],
        ["s1", "field", "string", "email"],
      ]
    );
    expect(roots(collectFormRoots(data))).toEqual([
      {
        rootId: "site",
        name: "Signup Form",
        page: "Home",
        formId: FORM,
        fields: [{ key: "email", required: false }],
      },
    ]);
  });

  test("collects Fields in tree order, below nested wrappers, and stops at a nested RSVP Form or form root", () => {
    const data = build(
      [
        { id: "body", children: ["root"] },
        { id: "root", component: form, children: ["wrap", "side"] },
        { id: "wrap", children: ["first", "email"] },
        { id: "first", component: field },
        { id: "email", component: field },
        { id: "side", children: ["message", "rsvp", "inner"] },
        { id: "message", component: field },
        { id: "rsvp", component: `${ns}:RsvpForm`, children: ["guest"] },
        { id: "guest", component: field },
        { id: "inner", component: form, children: ["innerField"] },
        { id: "innerField", component: field },
      ],
      [
        ["root", SITE_FORM_PROP, "string", "contact-form"],
        ["root", "record", "string", FORM],
        ["first", "field", "string", "first_name"],
        ["email", "field", "string", "email"],
        ["message", "field", "string", "message"],
        ["guest", "field", "string", "guest_name"],
        ["innerField", "field", "string", "phone"],
      ]
    );
    expect(
      roots(collectFormRoots(data))[0].fields.map(({ key }) => key)
    ).toEqual(["first_name", "email", "message"]);
  });

  test("a Field's required prop is read, absent is false", () => {
    const data = oneRoot(
      ["email", "phone"],
      [["f0", "required", "boolean", true]]
    );
    expect(roots(collectFormRoots(data))[0].fields).toEqual([
      { key: "email", required: true },
      { key: "phone", required: false },
    ]);
  });

  test("a key on several Fields is sent once, at the first place, required when any is", () => {
    const data = oneRoot(
      ["phone", "email", "phone"],
      [["f2", "required", "boolean", true]]
    );
    expect(roots(collectFormRoots(data))[0].fields).toEqual([
      { key: "phone", required: true },
      { key: "email", required: false },
    ]);
  });

  test.each([
    ["blank", "string", "  "],
    ["an expression", "expression", "$ws$dataSource$abc.id"],
    ["not a UUID", "string", "newsletter"],
    ["a bad version nibble", "string", "51000000-0000-0000-8000-000000000001"],
    ["a bad variant nibble", "string", "51000000-0000-4000-c000-000000000001"],
    ["a number prop", "number", 5],
  ] as const)(
    "a marked root whose record is %s is no_form, naming it and its page",
    (_case, type, value) => {
      const data = build(
        [
          { id: "body", children: ["root"] },
          {
            id: "root",
            component: form,
            label: "Newsletter",
            children: ["f0"],
          },
          { id: "f0", component: field },
        ],
        [
          ["root", SITE_FORM_PROP, "string", "contact-signup"],
          ["root", "record", type, value],
          ["f0", "field", "string", "email"],
        ],
        [["Events", "body"]]
      );
      expect(collectFormRoots(data)).toEqual({
        ok: false,
        error: "no_form",
        name: "Newsletter",
        page: "Events",
      });
    }
  );

  test("a marked root with an expression field is no_field", () => {
    const data = oneRoot(["email"], [["f0", "field", "expression", "$ws$x"]]);
    expect(collectFormRoots(data)).toEqual({
      ok: false,
      error: "no_field",
      name: "Signup Form",
      page: "Home",
    });
  });

  test("a marked root with no Field with a key is no_field", () => {
    expect(collectFormRoots(oneRoot(["  "]))).toMatchObject({
      ok: false,
      error: "no_field",
    });
    expect(collectFormRoots(oneRoot([]))).toMatchObject({
      ok: false,
      error: "no_field",
    });
  });

  test("the record is sent lower-cased", () => {
    const data = oneRoot(
      ["email"],
      [["root", "record", "string", "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"]]
    );
    expect(roots(collectFormRoots(data))[0].formId).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
  });

  test("drops a key over 60 characters", () => {
    const data = oneRoot(["email", "x".repeat(61), "y".repeat(60)]);
    expect(
      roots(collectFormRoots(data))[0].fields.map(({ key }) => key)
    ).toEqual(["email", "y".repeat(60)]);
  });

  test("more than 50 keys on one root is too_many", () => {
    const keys = Array.from({ length: 51 }, (_, i) => `k${i}`);
    expect(collectFormRoots(oneRoot(keys))).toMatchObject({
      ok: false,
      error: "too_many",
    });
    expect(collectFormRoots(oneRoot(keys.slice(0, 50))).ok).toBe(true);
  });

  test("more than 50 distinct forms is too_many", () => {
    const count = 51;
    const ids = Array.from({ length: count }, (_, i) => `r${i}`);
    const formIdOf = (i: number) =>
      `51000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const data = build(
      [
        { id: "body", children: ids },
        ...ids.map((id) => ({ id, component: form, children: [`${id}f`] })),
        ...ids.map((id) => ({ id: `${id}f`, component: field })),
      ],
      ids.flatMap((id, i) => [
        [id, SITE_FORM_PROP, "string", "contact-signup"],
        [id, "record", "string", formIdOf(i)],
        [`${id}f`, "field", "string", "email"],
      ]) as Array<[string, string, Prop["type"], unknown]>
    );
    expect(collectFormRoots(data)).toMatchObject({
      ok: false,
      error: "too_many",
    });
  });

  test("a cycle in children ends the walk", () => {
    const data = build(
      [
        { id: "body", children: ["slot"] },
        { id: "slot", component: "Slot", children: ["root"] },
        { id: "root", component: form, children: ["f0", "slot"] },
        { id: "f0", component: field },
      ],
      [
        ["root", SITE_FORM_PROP, "string", "contact-signup"],
        ["root", "record", "string", FORM],
        ["f0", "field", "string", "email"],
      ]
    );
    expect(roots(collectFormRoots(data))[0].fields).toEqual([
      { key: "email", required: false },
    ]);
  });

  test("a marked root on no page (a page template's body) is not collected", () => {
    const data = build(
      [
        { id: "body", children: [] },
        { id: "template-body", children: ["root"] },
        { id: "root", component: form, children: ["f0"] },
        { id: "f0", component: field },
      ],
      [
        ["root", SITE_FORM_PROP, "string", "contact-signup"],
        ["root", "record", "string", FORM],
        ["f0", "field", "string", "email"],
      ]
    );
    expect(collectFormRoots(data)).toEqual({ ok: true, roots: [] });
  });
});

const root = (
  rootId: string,
  formId: string,
  fields: CollectedRoot["fields"]
): CollectedRoot => ({ rootId, name: rootId, page: "Home", formId, fields });

describe("agreeFormRoots", () => {
  const email = { key: "email", required: true };
  const phone = { key: "phone", required: false };

  test("two roots on one form with equal lists give one entry", () => {
    expect(
      agreeFormRoots([
        root("a", FORM, [email, phone]),
        root("b", OTHER, [email]),
        root("c", FORM, [email, phone]),
      ])
    ).toEqual({
      ok: true,
      forms: [
        { formId: FORM, fields: [email, phone] },
        { formId: OTHER, fields: [email] },
      ],
    });
  });

  test.each([
    ["order", [phone, email]],
    ["required", [email, { ...phone, required: true }]],
    ["length", [email]],
  ])(
    "lists differing in %s are refused, first and second in order",
    (_case, fields) => {
      const a = root("a", FORM, [email, phone]);
      const b = root("b", FORM, fields);
      expect(agreeFormRoots([a, b])).toEqual({
        ok: false,
        first: a,
        second: b,
      });
    }
  );
});
