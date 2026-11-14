import { describe, expect, test } from "vitest";
import {
  encodeDataSourceVariable,
  type Instance,
  type WebstudioFragment,
} from "@webstudio-is/sdk";
import { showAttribute } from "@webstudio-is/react-sdk";
import { renderTemplate } from "@webstudio-is/template";
import { toValue } from "@webstudio-is/css-engine";
import * as metas from "./metas";
import {
  cardMeta,
  contactCardMeta,
  inlineMeta,
  meta,
} from "./signup-form.template";

const namespace = "@organizeos/site-components";

/** Reads one rendered template: its instances, props and styles. */
const read = (fragment: WebstudioFragment) => {
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

  const propOf = (instance: Instance, name: string) =>
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

  /** The names of the tokens an instance wears, in order. */
  const tokensOf = (instance: Instance) => {
    const selected =
      fragment.styleSourceSelections.find(
        (selection) => selection.instanceId === instance.id
      )?.values ?? [];
    return selected.flatMap((id) => {
      const source = fragment.styleSources.find((item) => item.id === id);
      return source?.type === "token" ? [source.name] : [];
    });
  };

  /** The declarations of each token an instance wears, by the token's name. */
  const tokenStylesOf = (instance: Instance) => {
    const selected = new Set(
      fragment.styleSourceSelections.find(
        (selection) => selection.instanceId === instance.id
      )?.values
    );
    return Object.fromEntries(
      fragment.styleSources.flatMap((source) =>
        source.type === "token" && selected.has(source.id)
          ? [
              [
                source.name,
                Object.fromEntries(
                  fragment.styles
                    .filter((decl) => decl.styleSourceId === source.id)
                    .map((decl) => [decl.property, toValue(decl.value)])
                ),
              ],
            ]
          : []
      )
    );
  };

  const root = getInstance(fragment.children[0].value);
  const [formState] = fragment.dataSources;
  const formStateVariable = encodeDataSourceVariable(formState.id);
  const is = (state: string) => `${formStateVariable} === '${state}'`;
  const showOf = (instance: Instance) => propOf(instance, showAttribute);
  const [content] = childInstances(root);
  const fields = childInstances(content).filter(
    (instance) => instance.component === `${namespace}:Field`
  );
  return {
    fragment,
    root,
    content,
    fields,
    formState,
    formStateVariable,
    is,
    showOf,
    getInstance,
    childInstances,
    propsOf,
    propOf,
    localStylesOf,
    tokensOf,
    tokenStylesOf,
  };
};

const stacked = read(renderTemplate(meta.template));
const inline = read(renderTemplate(inlineMeta.template));

// As the root's honeypot: out of the layout, a 1px box clipped to nothing,
// on one line, so a screen reader still reads it as the input's label.
const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  marginTop: "-1px",
  marginRight: "-1px",
  marginBottom: "-1px",
  marginLeft: "-1px",
  paddingTop: "0",
  paddingRight: "0",
  paddingBottom: "0",
  paddingLeft: "0",
  overflowX: "hidden",
  overflowY: "hidden",
  clip: "rect(0,0,0,0)",
  textWrapMode: "nowrap",
  whiteSpaceCollapse: "collapse",
  borderTopWidth: "0",
  borderRightWidth: "0",
  borderBottomWidth: "0",
  borderLeftWidth: "0",
};

describe.each([
  ["the stacked template", stacked],
  ["the inline template", inline],
])("%s", (_name, template) => {
  const {
    fragment,
    root,
    content,
    formState,
    formStateVariable,
    is,
    showOf,
    childInstances,
    propsOf,
    propOf,
    tokensOf,
    getInstance,
  } = template;

  test("is a Signup Form", () => {
    expect(root.component).toBe(`${namespace}:SignupForm`);
  });

  test("binds state and onStateChange to a formState variable like the Webhook Form, and leaves data unbound", () => {
    expect(fragment.dataSources).toEqual([
      {
        type: "variable",
        id: formState.id,
        scopeInstanceId: root.id,
        name: "formState",
        value: { type: "string", value: "initial" },
      },
    ]);
    expect(
      propsOf(root)
        .map((prop) => prop.name)
        .sort()
    ).toEqual(["onStateChange", "state"]);
    expect(propsOf(root).find((prop) => prop.name === "state")).toMatchObject({
      type: "expression",
      value: formStateVariable,
    });
    expect(
      propsOf(root).find((prop) => prop.name === "onStateChange")
    ).toMatchObject({
      type: "action",
      value: [
        {
          type: "execute",
          args: ["state"],
          code: `${formStateVariable} = state`,
        },
      ],
    });
  });

  test("the state boxes show on formState, are labelled by their state and wear the message tokens", () => {
    const boxes = childInstances(root);
    expect(
      boxes.map((box) => [box.component, box.label, showOf(box), tokensOf(box)])
    ).toEqual([
      [
        "ws:element",
        "Form Content",
        `${is("initial")} || ${is("submitting")} || ${is("error")}`,
        [],
      ],
      ["ws:element", "Success", is("success"), ["OS Success Message"]],
      [
        "ws:element",
        "Check your email",
        is("confirm-email"),
        ["OS Success Message"],
      ],
      ["ws:element", "Unavailable", is("unavailable"), ["OS Error Message"]],
    ]);
  });

  test("the Error box sits in the form's content, right before the Submit Button", () => {
    const parts = childInstances(content);
    const errorIndex = parts.findIndex((part) => part.label === "Error");
    expect(errorIndex).toBeGreaterThan(-1);
    const error = parts[errorIndex];
    expect(error.component).toBe("ws:element");
    expect(showOf(error)).toBe(is("error"));
    expect(tokensOf(error)).toEqual(["OS Error Message"]);
    expect(error.children).toEqual([
      {
        type: "text",
        value: "Something went wrong. Please try again.",
        placeholder: true,
      },
    ]);
    // the Submit Button follows it, in the stacked template; in the inline
    // one the Error box is the row's last item, a line under the row
    const next = parts[errorIndex + 1];
    if (template === stacked) {
      expect(next?.component).toBe(`${namespace}:SubmitButton`);
    } else {
      expect(next).toBeUndefined();
      expect(parts[errorIndex - 1].component).toBe(`${namespace}:SubmitButton`);
    }
    // only one Error box
    expect(
      fragment.instances.filter((instance) => instance.label === "Error")
    ).toHaveLength(1);
  });

  test("the parts wear the shared OrganizeOS tokens", () => {
    const tokenOf = new Map<string, string>([
      [`${namespace}:Field`, "OS Field"],
      [`${namespace}:FieldInput`, "OS Input"],
      [`${namespace}:FieldMessage`, "OS Message"],
      [`${namespace}:SubmitButton`, "OS Button"],
    ]);
    for (const instance of fragment.instances) {
      const expected = tokenOf.get(instance.component);
      if (expected === undefined) {
        continue;
      }
      expect(tokensOf(instance), instance.component).toEqual([expected]);
    }
  });

  test("every state a token styles is a state its component's meta lists", () => {
    const metasByComponent = new Map(
      Object.entries(metas).map(([name, meta]) => [
        `${namespace}:${name}`,
        meta,
      ])
    );
    let checked = 0;
    for (const selection of fragment.styleSourceSelections) {
      const instance = getInstance(selection.instanceId);
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

  test("each Field is labelled by its field in the navigator", () => {
    for (const field of template.fields) {
      const name = propOf(field, "field");
      expect(field.label).not.toMatch(/^Field: /);
      expect(field.label).toBe(name === "email" ? "Email" : "First name");
    }
  });
});

describe("the stacked template", () => {
  const {
    fragment,
    root,
    content,
    fields,
    childInstances,
    propOf,
    localStylesOf,
    tokenStylesOf,
  } = stacked;

  test("is a hidden template", () => {
    expect(meta.category).toBe("hidden");
    expect(meta.label).toBe("Signup Form");
  });

  test("the form's content holds a heading, an Email and a First name Field, the Error box and a Submit Button", () => {
    expect(
      childInstances(content).map((instance) => [
        instance.component,
        instance.label,
      ])
    ).toEqual([
      ["ws:element", undefined],
      [`${namespace}:Field`, "Email"],
      [`${namespace}:Field`, "First name"],
      ["ws:element", "Error"],
      [`${namespace}:SubmitButton`, undefined],
    ]);
    expect(fields.map((field) => propOf(field, "field"))).toEqual([
      "email",
      "first_name",
    ]);
    for (const field of fields) {
      expect(childInstances(field).map((part) => part.component)).toEqual([
        `${namespace}:FieldLabel`,
        `${namespace}:FieldInput`,
        `${namespace}:FieldMessage`,
      ]);
    }
  });

  test("the root is at most 32rem wide, so it sits well in a wide section", () => {
    expect(localStylesOf(root)).toEqual({
      maxWidth: "32rem",
      width: "100%",
    });
  });

  test("the parts are styled through the seven shared OrganizeOS tokens", () => {
    expect(
      fragment.styleSources
        .flatMap((source) => (source.type === "token" ? [source.name] : []))
        .sort()
    ).toEqual([
      "OS Button",
      "OS Error Message",
      "OS Field",
      "OS Form Heading",
      "OS Input",
      "OS Message",
      "OS Success Message",
    ]);
  });

  // A template sets its headings in --font-heading; the form's heading follows
  // it, and inherits as before on a site without the variable. Its lines are
  // set as a heading's, not at the body's looser line height, so a heading
  // that wraps on a phone reads as one.
  // It wears a token, "OS Form Heading", so a site template sets its case and
  // size (SiteTemplate.blockTokens), and has no local style of its own.
  test("the form's heading wears OS Form Heading: the site's heading font, at a heading's line height", () => {
    const [heading] = childInstances(content);
    expect(heading.tag).toBe("h2");
    expect(localStylesOf(heading)).toEqual({});
    expect(tokenStylesOf(heading)).toEqual({
      "OS Form Heading": {
        fontFamily: "var(--font-heading)",
        lineHeight: "1.2",
      },
    });
  });
});

describe("the inline template", () => {
  const {
    fragment,
    root,
    content,
    fields,
    childInstances,
    propOf,
    localStylesOf,
  } = inline;

  test("is a hidden template with its own card in the Components panel", () => {
    expect(inlineMeta.category).toBe("hidden");
    expect(inlineMeta.label).toBe("Signup Form, inline");
    expect(inlineMeta.description).toBe("Email and a button in one row");
  });

  test("the form's content is one wrapping row: an Email Field, a Submit Button, and the Error box under them", () => {
    expect(
      childInstances(content).map((instance) => [
        instance.component,
        instance.label,
      ])
    ).toEqual([
      [`${namespace}:Field`, "Email"],
      [`${namespace}:SubmitButton`, undefined],
      ["ws:element", "Error"],
    ]);
    expect(localStylesOf(content)).toEqual({
      display: "flex",
      flexWrap: "wrap",
      rowGap: "8px",
      columnGap: "8px",
      alignItems: "flex-start",
    });
    const [, submit, error] = childInstances(content);
    expect(localStylesOf(submit)).toEqual({
      flexGrow: "0",
      flexShrink: "0",
      flexBasis: "auto",
    });
    expect(localStylesOf(error)).toEqual({ flexBasis: "100%" });
  });

  test("its Email Field grows from 320px, so the row breaks below about 480px", () => {
    expect(fields.map((field) => propOf(field, "field"))).toEqual(["email"]);
    const [field] = fields;
    expect(localStylesOf(field)).toEqual({
      flexGrow: "1",
      flexShrink: "1",
      flexBasis: "320px",
    });
  });

  test("its Field Label is visually hidden and its Field Input reads Email", () => {
    const [label, input, message] = childInstances(fields[0]);
    expect(label.component).toBe(`${namespace}:FieldLabel`);
    expect(label.children).toEqual([
      { type: "text", value: "Email", placeholder: true },
    ]);
    expect(localStylesOf(label)).toEqual(visuallyHidden);
    expect(input.component).toBe(`${namespace}:FieldInput`);
    expect(propOf(input, "placeholder")).toBe("Email");
    expect(message.component).toBe(`${namespace}:FieldMessage`);
  });

  test("has no heading and no max width", () => {
    expect(fragment.instances.some((instance) => instance.tag === "h2")).toBe(
      false
    );
    expect(localStylesOf(root)).toEqual({});
  });
});

// Look A (builder forms spec 5.2 and 5.3; plan 2026-11-13-builder-forms-fork-p2,
// Task 8, P8, P9): the forms inserts land as a card. The heading and the intro
// sit above Form Content, so the state boxes that replace it keep them; the
// Fields carry their site form definition as props.
describe("the card templates", () => {
  const updates = read(renderTemplate(cardMeta.template));
  const contact = read(renderTemplate(contactCardMeta.template));
  const cardOf = (card: typeof updates) => {
    const [heading, intro, content, ...boxes] = card.childInstances(card.root);
    const fields = card
      .childInstances(content)
      .filter((instance) => instance.component === `${namespace}:Field`);
    const button = card
      .childInstances(content)
      .find((instance) => instance.component === `${namespace}:SubmitButton`);
    return { heading, intro, content, boxes, fields, button };
  };
  const textOf = (_card: typeof updates, instance: Instance) =>
    instance.children.flatMap((child) =>
      child.type === "text" ? [child.value] : []
    );
  const inputOf = (card: typeof updates, field: Instance) =>
    card
      .childInstances(field)
      .find((instance) => instance.component === `${namespace}:FieldInput`);

  test("each card's root is labelled with its insert name; the stacked template is unchanged", () => {
    expect(updates.root.label).toBe("Email & SMS updates");
    expect(contact.root.label).toBe("Contact us");
    expect(stacked.root.label).toBeUndefined();
    expect(cardMeta.label).toBe("Signup Form, card");
    expect(contactCardMeta.label).toBe("Signup Form, contact");
  });

  test.each([
    ["updates", updates, "Get updates", "News and actions from us."],
    ["contact", contact, "Get in touch", "Send us a message and we'll reply."],
  ] as const)(
    "the %s card: OS Form Card, then heading, intro, Form Content, then the state boxes",
    (_kind, card, heading, intro) => {
      const parts = cardOf(card);
      expect(card.tokensOf(card.root)).toEqual(["OS Form Card"]);
      expect(card.tokensOf(parts.heading)).toEqual(["OS Form Heading"]);
      expect(textOf(card, parts.heading)).toEqual([heading]);
      expect(parts.intro.label).toBe("Intro");
      expect(card.tokensOf(parts.intro)).toEqual(["OS Form Intro"]);
      expect(textOf(card, parts.intro)).toEqual([intro]);
      expect(parts.content.label).toBe("Form Content");
      expect(card.localStylesOf(parts.content)).toMatchObject({
        display: "flex",
        flexWrap: "wrap",
        rowGap: "12px",
        columnGap: "12px",
      });
      expect(parts.boxes.length).toBeGreaterThan(0);
    }
  );

  test("Email & SMS updates holds First name, Last name and Email, Email required, as a site form's Fields", () => {
    const { fields } = cardOf(updates);
    expect(
      fields.map((field) => [
        updates.propOf(field, "field"),
        updates.propOf(field, "fieldType"),
        updates.propOf(field, "required"),
      ])
    ).toEqual([
      ["first_name", "text", false],
      ["last_name", "text", false],
      ["email", "email", true],
    ]);
    const [first, last, email] = fields;
    for (const half of [first, last]) {
      expect(updates.localStylesOf(half)).toMatchObject({
        flexGrow: "1",
        flexShrink: "1",
        flexBasis: "calc(50% - 6px)",
        minWidth: "12rem",
      });
    }
    expect(updates.localStylesOf(email)).toMatchObject({
      flexGrow: "1",
      flexShrink: "1",
      flexBasis: "100%",
    });
  });

  test("Contact us holds Full name, Email and Message, Email and Message required", () => {
    const { fields } = cardOf(contact);
    expect(
      fields.map((field) => [
        contact.propOf(field, "field"),
        contact.propOf(field, "fieldType"),
        contact.propOf(field, "required"),
      ])
    ).toEqual([
      ["name", "text", false],
      ["email", "email", true],
      ["message", "textarea", true],
    ]);
  });

  test("every card Field Input is at least 44px tall, 8px round, its resting border the softened mix", () => {
    for (const card of [updates, contact]) {
      for (const field of cardOf(card).fields) {
        const input = inputOf(card, field);
        expect(input).toBeDefined();
        const styles = card.localStylesOf(input as Instance);
        expect(styles).toMatchObject({
          minHeight: "44px",
          borderTopLeftRadius: "8px",
          borderBottomRightRadius: "8px",
        });
        expect(styles.borderTopColor).toBe(
          "color-mix(in srgb,var(--text, #18181b) 70%,var(--base, #ffffff))"
        );
      }
    }
  });

  test("the card's Submit Button is full width and 48px tall, with its kind's label", () => {
    for (const [card, label] of [
      [updates, "Sign up"],
      [contact, "Send message"],
    ] as const) {
      const { button } = cardOf(card);
      expect(button).toBeDefined();
      expect(card.tokensOf(button as Instance)).toEqual(["OS Button"]);
      expect(card.localStylesOf(button as Instance)).toMatchObject({
        width: "100%",
        minHeight: "48px",
      });
      expect(textOf(card, button as Instance)).toEqual([label]);
    }
  });

  test("the states' words per kind; Contact us has no Check your email box", () => {
    const words = (card: typeof updates) =>
      Object.fromEntries(
        cardOf(card).boxes.map((box) => [box.label, textOf(card, box)[0]])
      );
    expect(words(updates)).toMatchObject({
      Success: "You're signed up.",
      "Check your email": "Check your email to confirm.",
    });
    expect(words(contact)).toMatchObject({ Success: "Message sent." });
    expect(words(contact)).not.toHaveProperty("Check your email");
  });
});
