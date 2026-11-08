import { expect, test } from "vitest";
import type { Instance } from "@webstudio-is/sdk";
import { renderTemplate, ws } from "@webstudio-is/template";
import { toValue } from "@webstudio-is/css-engine";
import { fieldTemplate } from "./field.template";

const namespace = "@organizeos/site-components";

const render = (element: JSX.Element) => {
  const fragment = renderTemplate(element);
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
    Object.fromEntries(
      fragment.props
        .filter((prop) => prop.instanceId === instance.id)
        .map((prop) => [prop.name, prop.value])
    );
  const selectedSources = (instance: Instance) => {
    const selected = new Set(
      fragment.styleSourceSelections.find(
        (selection) => selection.instanceId === instance.id
      )?.values
    );
    return fragment.styleSources.filter((source) => selected.has(source.id));
  };
  const tokensOf = (instance: Instance) =>
    selectedSources(instance).flatMap((source) =>
      source.type === "token" ? [source.name] : []
    );
  const localStylesOf = (instance: Instance) => {
    const local = new Set(
      selectedSources(instance).flatMap((source) =>
        source.type === "local" ? [source.id] : []
      )
    );
    return Object.fromEntries(
      fragment.styles
        .filter((decl) => local.has(decl.styleSourceId))
        .map((decl) => [decl.property, toValue(decl.value)])
    );
  };
  const root = getInstance(fragment.children[0].value);
  return {
    fragment,
    root,
    parts: childInstances(root),
    childInstances,
    propsOf,
    tokensOf,
    localStylesOf,
  };
};

test("a text field: Label, Input and Message, in the form tokens, labelled by its field", () => {
  const { root, parts, propsOf, tokensOf, localStylesOf } = render(
    fieldTemplate({ name: "email", label: "Email", type: "email" })
  );
  expect(root.component).toBe(`${namespace}:Field`);
  expect(root.label).toBe("Email");
  expect(propsOf(root)).toEqual({ field: "email" });
  expect(tokensOf(root)).toEqual(["OS Field"]);
  expect(localStylesOf(root)).toEqual({});
  expect(parts.map((part) => part.component)).toEqual([
    `${namespace}:FieldLabel`,
    `${namespace}:FieldInput`,
    `${namespace}:FieldMessage`,
  ]);
  const [label, input, message] = parts;
  expect(label.children).toEqual([
    { type: "text", value: "Email", placeholder: true },
  ]);
  expect(tokensOf(label)).toEqual([]);
  expect(tokensOf(input)).toEqual(["OS Input"]);
  expect(localStylesOf(input)).toEqual({});
  expect(tokensOf(message)).toEqual(["OS Message"]);
  expect(localStylesOf(message)).toEqual({});
  expect(propsOf(input)).toEqual({});
  expect(message.children).toEqual([]);
});

test("a select field lays out as a text field does", () => {
  const { root, parts, propsOf, tokensOf, localStylesOf } = render(
    fieldTemplate({ name: "topic", label: "Topic", type: "select" })
  );
  expect(root.label).toBe("Topic");
  expect(propsOf(root)).toEqual({ field: "topic" });
  expect(localStylesOf(root)).toEqual({});
  expect(parts.map((part) => [part.component, tokensOf(part)])).toEqual([
    [`${namespace}:FieldLabel`, []],
    [`${namespace}:FieldInput`, ["OS Input"]],
    [`${namespace}:FieldMessage`, ["OS Message"]],
  ]);
});

test("a checkbox lays out as a row: the box, then its label, then the message on a line of its own", () => {
  const { root, parts, tokensOf, localStylesOf } = render(
    fieldTemplate({
      name: "volunteer_interest",
      label: "I want to volunteer",
      type: "checkbox",
    })
  );
  expect(root.label).toBe("I want to volunteer");
  expect(tokensOf(root)).toEqual(["OS Field"]);
  expect(localStylesOf(root)).toEqual({
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
  });
  expect(parts.map((part) => part.component)).toEqual([
    `${namespace}:FieldInput`,
    `${namespace}:FieldLabel`,
    `${namespace}:FieldMessage`,
  ]);
  const [input, label, message] = parts;
  expect(tokensOf(input)).toEqual([]);
  expect(localStylesOf(input)).toEqual({ marginTop: "4px" });
  expect(label.children).toEqual([
    { type: "text", value: "I want to volunteer", placeholder: true },
  ]);
  expect(tokensOf(message)).toEqual(["OS Message"]);
  expect(localStylesOf(message)).toEqual({ flexBasis: "100%" });
});

const consentWording = "Text me updates. Reply STOP to opt out.";

test("a consent field is a checkbox row whose Field Label has no text of its own", () => {
  const { root, parts, propsOf, tokensOf, localStylesOf } = render(
    fieldTemplate({
      name: "sms_opt_in",
      label: consentWording,
      type: "checkbox",
      consent: "sms",
    })
  );
  expect(root.label).toBe("SMS consent");
  expect(propsOf(root)).toEqual({ field: "sms_opt_in" });
  expect(localStylesOf(root)).toEqual({
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
  });
  expect(parts.map((part) => part.component)).toEqual([
    `${namespace}:FieldInput`,
    `${namespace}:FieldLabel`,
    `${namespace}:FieldMessage`,
  ]);
  const [input, label] = parts;
  expect(tokensOf(input)).toEqual([]);
  expect(label.children).toEqual([]);
});

test("a consent field stores none of its wording anywhere in the fragment", () => {
  const { fragment } = render(
    fieldTemplate({
      name: "sms_opt_in",
      label: consentWording,
      type: "checkbox",
      consent: "sms",
    })
  );
  expect(JSON.stringify(fragment)).not.toContain(consentWording);
  expect(JSON.stringify(fragment)).not.toContain("Reply STOP");
});

test("a consent field of another kind is labelled Consent in the navigator", () => {
  const { root, parts } = render(
    fieldTemplate({
      name: "photo_release",
      label: "You may use my photo.",
      type: "checkbox",
      consent: "photo",
    })
  );
  expect(root.label).toBe("Consent");
  expect(parts[1].children).toEqual([]);
});

test("two Fields in one fragment share their tokens and no instance, prop or local style", () => {
  const { fragment } = render(
    <ws.element ws:tag="div">
      {fieldTemplate({ name: "email", label: "Email", type: "email" })}
      {fieldTemplate({ name: "zip", label: "ZIP", type: "checkbox" })}
    </ws.element>
  );
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  expect(fragment.instances).toHaveLength(9);
  expect(unique(fragment.instances.map((item) => item.id))).toBe(true);
  expect(unique(fragment.props.map((item) => item.id))).toBe(true);
  expect(unique(fragment.styleSources.map((item) => item.id))).toBe(true);
  // the tokens are one each, however many Fields wear them
  expect(
    fragment.styleSources
      .flatMap((source) => (source.type === "token" ? [source.name] : []))
      .sort()
  ).toEqual(["OS Field", "OS Input", "OS Message"]);
});
