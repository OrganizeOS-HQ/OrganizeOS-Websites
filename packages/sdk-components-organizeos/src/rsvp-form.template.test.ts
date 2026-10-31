import { expect, test } from "vitest";
import { encodeDataSourceVariable, type Instance } from "@webstudio-is/sdk";
import { showAttribute } from "@webstudio-is/react-sdk";
import { CalendarIcon } from "@webstudio-is/icons/svg";
import { renderTemplate } from "@webstudio-is/template";
import { toValue } from "@webstudio-is/css-engine";
import * as metas from "./metas";
import { meta } from "./rsvp-form.template";
import { meta as signupMeta } from "./signup-form.template";

const namespace = "@organizeos/site-components";
const fragment = renderTemplate(meta.template);

const getInstance = (id: string) => {
  const instance = fragment.instances.find((item) => item.id === id);
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

const propValue = (instance: Instance, name: string) =>
  propsOf(instance).find((prop) => prop.name === name)?.value;

/** The declarations on an instance's own local style source, as CSS text. */
const localStylesOf = (instance: Instance) => {
  const sources = new Set(
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instance.id
    )?.values
  );
  return Object.fromEntries(
    fragment.styles
      .filter(
        (decl) =>
          sources.has(decl.styleSourceId) &&
          fragment.styleSources.some(
            (source) =>
              source.id === decl.styleSourceId && source.type === "local"
          )
      )
      .map((decl) => [decl.property, toValue(decl.value)])
  );
};

const root = getInstance(fragment.children[0].value);
const [rsvpState] = fragment.dataSources;
const rsvpStateVariable = encodeDataSourceVariable(rsvpState.id);

const tokenNames = new Map(
  fragment.styleSources.flatMap((source) =>
    source.type === "token" ? [[source.id, source.name]] : []
  )
);

const tokensOf = (instance: Instance) =>
  fragment.styleSourceSelections
    .find((selection) => selection.instanceId === instance.id)
    ?.values.map((id) => tokenNames.get(id));

// the box inside the root that holds the form's fields and parts
const [content] = childInstances(root);
const contentChildren = childInstances(content);
const parts = (component: string) =>
  contentChildren.filter(
    (instance) => instance.component === `${namespace}:${component}`
  );

test("a hidden RSVP Form template with the Calendar icon", () => {
  expect(meta.category).toBe("hidden");
  expect(meta.label).toBe("RSVP Form");
  expect(meta.icon).toBe(CalendarIcon);
  expect(meta.description).toMatch(/event/i);
  expect(root.component).toBe(`${namespace}:RsvpForm`);
});

test("the label and category are the ones the RSVP Form's meta has", () => {
  expect(meta.label).toBe(metas.RsvpForm.label);
  expect(meta.category).toBe(metas.RsvpForm.category);
});

test("binds state and onStateChange to an rsvpState variable, and leaves data and record unbound", () => {
  expect(fragment.dataSources).toEqual([
    {
      type: "variable",
      id: rsvpState.id,
      scopeInstanceId: root.id,
      name: "rsvpState",
      value: { type: "string", value: "initial" },
    },
  ]);
  const props = propsOf(root);
  // `data` is bound by the insert, to the block's own Events binding, and
  // `record` is picked by the designer
  expect(props.map((prop) => prop.name).sort()).toEqual([
    "onStateChange",
    "state",
  ]);
  expect(props.find((prop) => prop.name === "state")).toMatchObject({
    type: "expression",
    value: rsvpStateVariable,
  });
  expect(props.find((prop) => prop.name === "onStateChange")).toMatchObject({
    type: "action",
    value: [
      {
        type: "execute",
        args: ["state"],
        code: `${rsvpStateVariable} = state`,
      },
    ],
  });
});

test("the form's content shows while the visitor can fill it in, and the six state boxes show on their own state", () => {
  const boxes = childInstances(root);
  const showOf = (instance: Instance) => propValue(instance, showAttribute);
  const is = (state: string) => `${rsvpStateVariable} === '${state}'`;
  expect(boxes.map((box) => [box.component, box.label, showOf(box)])).toEqual([
    [
      "ws:element",
      "Form Content",
      `${is("initial")} || ${is("submitting")} || ${is("error")}`,
    ],
    ["ws:element", "Registered", is("registered")],
    ["ws:element", "Waitlisted", is("waitlisted")],
    ["ws:element", "Full", is("full")],
    ["ws:element", "Ended", is("ended")],
    ["ws:element", "Error", is("error")],
    ["ws:element", "Unavailable", is("unavailable")],
  ]);
});

test("every state the root's meta lists shows some box", () => {
  const listed = metas.RsvpForm.props?.state;
  const states =
    listed !== undefined && "options" in listed ? (listed.options ?? []) : [];
  expect(states.length).toBeGreaterThan(0);
  const shows = childInstances(root).map((box) =>
    String(propValue(box, showAttribute))
  );
  for (const state of states) {
    expect(
      shows.some((show) => show.includes(`=== '${state}'`)),
      state
    ).toBe(true);
  }
});

test("the state boxes hold placeholder text the designer edits", () => {
  for (const label of [
    "Registered",
    "Waitlisted",
    "Full",
    "Ended",
    "Error",
    "Unavailable",
  ]) {
    const box = childInstances(root).find((item) => item.label === label);
    expect(box, label).toBeDefined();
    expect(box?.children, label).toEqual([
      { type: "text", value: expect.any(String), placeholder: true },
    ]);
  }
});

test("the form's content holds a heading, the four Fields, Guests, Shift Options, Questions, Email Consent and a Submit Button, in that order", () => {
  expect(
    contentChildren.map((instance) =>
      instance.component === "ws:element"
        ? instance.tag
        : instance.component.replace(`${namespace}:`, "")
    )
  ).toEqual([
    "h2",
    "Field",
    "Field",
    "Field",
    "Field",
    "Guests",
    "ShiftOptions",
    "Questions",
    "EmailConsent",
    "SubmitButton",
  ]);
  expect(contentChildren[0].children).toEqual([
    { type: "text", value: expect.any(String), placeholder: true },
  ]);
});

test("the Fields name first_name, last_name, email and phone, each with a label, an input and a message", () => {
  expect(
    parts("Field").map((field) => [field.label, propValue(field, "field")])
  ).toEqual([
    ["Field: First name", "first_name"],
    ["Field: Last name", "last_name"],
    ["Field: Email", "email"],
    ["Field: Phone", "phone"],
  ]);
  for (const field of parts("Field")) {
    expect(childInstances(field).map((part) => part.component)).toEqual([
      `${namespace}:FieldLabel`,
      `${namespace}:FieldInput`,
      `${namespace}:FieldMessage`,
    ]);
    // the label's text is placeholder text
    expect(childInstances(field)[0].children).toEqual([
      { type: "text", value: expect.any(String), placeholder: true },
    ]);
  }
});

test("Email Consent is labelled by placeholder text, and the Submit Button says RSVP", () => {
  const [consent] = parts("EmailConsent");
  expect(consent.children).toEqual([
    {
      type: "text",
      value: "Also email me news from this organization",
      placeholder: true,
    },
  ]);
  const [submit] = parts("SubmitButton");
  expect(submit.children).toEqual([
    { type: "text", value: "RSVP", placeholder: true },
  ]);
});

// The selectors are one compound inside :is() for the controls: the generator
// appends a descendant's selector to the part's class, and a bare comma list
// would style every select and textarea on the page.
const inputSelector =
  " :is(input:not([type=checkbox]):not([type=radio]), select, textarea)";

test("Guests, Shift Options and Questions each hold three ws:descendant instances, for the inputs, the buttons and the messages", () => {
  for (const component of ["Guests", "ShiftOptions", "Questions"]) {
    const [part] = parts(component);
    const descendants = childInstances(part);
    // nothing but the three instances: the part draws its own controls
    expect(part.children, component).toHaveLength(3);
    expect(
      descendants.map((descendant) => descendant.component),
      component
    ).toEqual(["ws:descendant", "ws:descendant", "ws:descendant"]);
    expect(
      descendants.map((descendant) => propValue(descendant, "selector")),
      component
    ).toEqual([inputSelector, " button", " [data-message]"]);
    expect(
      descendants.map((descendant) => tokensOf(descendant)),
      component
    ).toEqual([["OS Input"], ["OS Button"], ["OS Message"]]);
  }
});

test("a descendant's selector is a string prop, as the CSS generator reads it", () => {
  for (const descendant of fragment.instances.filter(
    (instance) => instance.component === "ws:descendant"
  )) {
    const selector = propsOf(descendant).find(
      (prop) => prop.name === "selector"
    );
    expect(selector?.type).toBe("string");
  }
});

test("parts are styled through the four shared OrganizeOS tokens, as the Signup Form's are", () => {
  expect(Array.from(tokenNames.values()).sort()).toEqual([
    "OS Button",
    "OS Field",
    "OS Input",
    "OS Message",
  ]);
  const tokenOf = new Map<string, string>([
    [`${namespace}:Field`, "OS Field"],
    [`${namespace}:FieldInput`, "OS Input"],
    [`${namespace}:FieldMessage`, "OS Message"],
    [`${namespace}:SubmitButton`, "OS Button"],
  ]);
  let checked = 0;
  for (const instance of fragment.instances) {
    const expected = tokenOf.get(instance.component);
    if (expected === undefined) {
      continue;
    }
    expect(tokensOf(instance), instance.component).toEqual([expected]);
    checked += 1;
  }
  // four Fields, their inputs and messages, and the submit button
  expect(checked).toBe(4 + 4 + 4 + 1);
});

test("the tokens are the Signup Form's, by name and by style", () => {
  // a project that has both blocks reuses one token each, so the two
  // templates must not drift apart
  const signup = renderTemplate(signupMeta.template);
  const stylesByToken = (rendered: typeof fragment) =>
    new Map(
      rendered.styleSources.flatMap((source) =>
        source.type === "token"
          ? [
              [
                source.name,
                rendered.styles
                  .filter((style) => style.styleSourceId === source.id)
                  .map(({ property, state, value }) => ({
                    property,
                    state,
                    value,
                  })),
              ] as const,
            ]
          : []
      )
    );
  const rsvpTokens = stylesByToken(fragment);
  const signupTokens = stylesByToken(signup);
  expect(Array.from(rsvpTokens.keys()).sort()).toEqual(
    Array.from(signupTokens.keys()).sort()
  );
  for (const [name, styles] of rsvpTokens) {
    expect(styles.length, name).toBeGreaterThan(0);
    expect(styles, name).toEqual(signupTokens.get(name));
  }
});

test("every state a token styles is a state its component's meta lists", () => {
  const metasByComponent = new Map(
    Object.entries(metas).map(([name, meta]) => [`${namespace}:${name}`, meta])
  );
  let checked = 0;
  for (const selection of fragment.styleSourceSelections) {
    const instance = getInstance(selection.instanceId);
    // a descendant instance styles the part's own controls, which are not
    // components: their states are the inner elements', not the meta's
    if (instance.component === "ws:descendant") {
      continue;
    }
    const selectors = new Set(
      metasByComponent
        .get(instance.component)
        ?.states?.map((state) => state.selector)
    );
    for (const style of fragment.styles) {
      if (
        selection.values.includes(style.styleSourceId) &&
        style.state?.startsWith("[")
      ) {
        expect(selectors).toContain(style.state);
        checked += 1;
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
});

test("every OrganizeOS part of the template sits inside the root's descendants, or inside a part that lists it", () => {
  const rootDescendants = new Set(metas.RsvpForm.contentModel?.descendants);
  const ownDescendants = (component: string) =>
    new Set(
      metas[
        component.replace(`${namespace}:`, "") as keyof typeof metas
      ]?.contentModel?.descendants
    );
  const walk = (instance: Instance, ancestors: Instance[]) => {
    for (const child of childInstances(instance)) {
      if (child.component.startsWith(`${namespace}:`)) {
        const allowed =
          rootDescendants.has(child.component) ||
          ancestors.some((ancestor) =>
            ownDescendants(ancestor.component).has(child.component)
          ) ||
          ownDescendants(instance.component).has(child.component);
        expect(allowed, child.component).toBe(true);
      }
      walk(child, [...ancestors, instance]);
    }
  };
  walk(root, [root]);
  // and each part the root lists is used, apart from none
  const used = new Set(
    fragment.instances.map((instance) => instance.component)
  );
  for (const listed of rootDescendants) {
    expect(used.has(listed), listed).toBe(true);
  }
});

// A template sets its headings in --font-heading; the form's heading follows
// it, and inherits as before on a site without the variable.
test("the form's heading is set in the site's heading font", () => {
  const [heading] = contentChildren;
  expect(heading.tag).toBe("h2");
  expect(localStylesOf(heading)).toEqual({
    fontFamily: "var(--font-heading)",
  });
});
