import {
  isPageDraft,
  type Instance,
  type Instances,
  type Pages,
  type Prop,
  type Props,
} from "@webstudio-is/sdk";

/**
 * OrganizeOS fork: a build's site forms, as the publish step stages them
 * (docs/ORGANIZEOS-FORK.md section 9, "Site forms"; builder forms spec 7.4;
 * plan 2026-11-13-builder-forms-fork-p2, Task 2). Pure, with no node imports:
 * the publish route, the publisher and the builder's panel all read it.
 *
 * - **The mark.** A form root that uses a site form carries the builder-only
 *   prop `siteForm`, its form's kind (`contact-signup`, `contact-form` or
 *   `membership`), written with its `record` by the insert, a template
 *   placement or the Form row. Only roots so marked are collected; an
 *   unmarked root (a CRM form, or the org defaults), or one whose `siteForm`
 *   is any other value, is neither sent nor checked, so it publishes as it
 *   always has (spec 15).
 * - **A marked root's form** is its `record`, a string literal that is an RFC
 *   4122 UUID, sent lower-cased. Blank, an expression, another type or
 *   another shape refuses (`no_form`): the platform cannot compute a bound
 *   value, and its F5 takes RFC UUIDs only.
 * - **Its fields** are its Fields' `field` values in tree order, depth first,
 *   not entering a nested form root or RSVP Form. A key on several Fields is
 *   sent once, at its first place, required when any of them is. A key over
 *   60 characters is never a catalog key and is dropped. An expression
 *   `field` refuses (`no_field`), and so does a root with no keyed Field.
 * - **On a published page.** A root is collected only when a page that is
 *   not a draft holds it, so a draft page's or a page template's body is
 *   not: neither goes live. Its name and its page name the refusals.
 * - F5 takes at most 50 forms of at most 50 fields: past either, `too_many`.
 */

const NAMESPACE = "@organizeos/site-components";

/** The roots a site form can sit on; fork PR 3 adds the Join Form. */
export const formRootComponents: ReadonlySet<string> = new Set([
  `${NAMESPACE}:SignupForm`,
]);

const FIELD_COMPONENT = `${NAMESPACE}:Field`;
const RSVP_FORM_COMPONENT = `${NAMESPACE}:RsvpForm`;

/** The builder-only root prop that marks a site form's block. */
export const SITE_FORM_PROP = "siteForm";

/** The kinds a mark names; any other value (a blank one included) marks nothing. */
const SITE_FORM_KINDS: ReadonlySet<string> = new Set([
  "contact-signup",
  "contact-form",
  "membership",
]);

const isMark = (prop: Prop | undefined) =>
  prop?.type === "string" && SITE_FORM_KINDS.has(prop.value);

const MAX_FORMS = 50;
const MAX_FIELDS = 50;
const MAX_KEY_LENGTH = 60;

const RFC_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type RequestedField = { key: string; required: boolean };

export type CollectedRoot = {
  rootId: string;
  /** Its navigator name: its label, else "Signup Form". */
  name: string;
  /** The name of the page whose body holds it. */
  page: string;
  formId: string;
  fields: RequestedField[];
};

export type CollectResult =
  | { ok: true; roots: CollectedRoot[] }
  | {
      ok: false;
      error: "no_form" | "no_field" | "too_many";
      name: string;
      page: string;
    };

export type AgreeResult =
  | { ok: true; forms: Array<{ formId: string; fields: RequestedField[] }> }
  | { ok: false; first: CollectedRoot; second: CollectedRoot };

const childIds = (instance: Instance | undefined) =>
  (instance?.children ?? []).flatMap((child) =>
    child.type === "id" ? [child.value] : []
  );

const nameOf = (instance: Instance) =>
  typeof instance.label === "string" && instance.label.trim() !== ""
    ? instance.label
    : "Signup Form";

/**
 * The published page holding each instance, the first page's when several
 * share it. A draft page is never published, so its body is not walked.
 */
const pageOfInstances = (instances: Instances, pages: Pages) => {
  const pageOf = new Map<string, string>();
  for (const page of pages.pages.values()) {
    if (isPageDraft(page)) {
      continue;
    }
    const stack = [page.rootInstanceId];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (pageOf.has(id) || instances.has(id) === false) {
        continue;
      }
      pageOf.set(id, page.name);
      stack.push(...childIds(instances.get(id)).reverse());
    }
  }
  return pageOf;
};

const propsByInstance = (props: Props) => {
  const byInstance = new Map<string, Map<string, Prop>>();
  for (const prop of props.values()) {
    let named = byInstance.get(prop.instanceId);
    if (named === undefined) {
      named = new Map();
      byInstance.set(prop.instanceId, named);
    }
    named.set(prop.name, prop);
  }
  return byInstance;
};

const stringValue = (prop: Prop | undefined) =>
  prop?.type === "string" ? prop.value.trim() : undefined;

type RootFields =
  | { ok: true; fields: RequestedField[] }
  | { ok: false; error: "no_field" | "too_many" };

/** A root's Fields in tree order, keyed once each. */
const fieldsOf = (
  rootId: string,
  instances: Instances,
  propsOf: Map<string, Map<string, Prop>>
): RootFields => {
  const fields: RequestedField[] = [];
  const index = new Map<string, RequestedField>();
  const visited = new Set<string>([rootId]);
  const stack = childIds(instances.get(rootId)).reverse();
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    const instance = instances.get(id);
    if (instance === undefined) {
      continue;
    }
    if (
      formRootComponents.has(instance.component) ||
      instance.component === RSVP_FORM_COMPONENT
    ) {
      continue;
    }
    if (instance.component === FIELD_COMPONENT) {
      const props = propsOf.get(id);
      const fieldProp = props?.get("field");
      if (fieldProp?.type === "expression") {
        return { ok: false, error: "no_field" };
      }
      const key = stringValue(fieldProp);
      const requiredProp = props?.get("required");
      const required =
        requiredProp?.type === "boolean" && requiredProp.value === true;
      if (key !== undefined && key !== "" && key.length <= MAX_KEY_LENGTH) {
        const known = index.get(key);
        if (known === undefined) {
          const field = { key, required };
          index.set(key, field);
          fields.push(field);
        } else if (required) {
          known.required = true;
        }
      }
    }
    stack.push(...childIds(instance).reverse());
  }
  if (fields.length === 0) {
    return { ok: false, error: "no_field" };
  }
  if (fields.length > MAX_FIELDS) {
    return { ok: false, error: "too_many" };
  }
  return { ok: true, fields };
};

export const collectFormRoots = ({
  instances,
  props,
  pages,
}: {
  instances: Instances;
  props: Props;
  pages: Pages;
}): CollectResult => {
  const propsOf = propsByInstance(props);
  const pageOf = pageOfInstances(instances, pages);
  const roots: CollectedRoot[] = [];
  const forms = new Set<string>();
  for (const instance of instances.values()) {
    if (formRootComponents.has(instance.component) === false) {
      continue;
    }
    const rootProps = propsOf.get(instance.id);
    if (
      rootProps === undefined ||
      isMark(rootProps.get(SITE_FORM_PROP)) === false
    ) {
      continue;
    }
    const page = pageOf.get(instance.id);
    if (page === undefined) {
      continue;
    }
    const name = nameOf(instance);
    const record = stringValue(rootProps.get("record"))?.toLowerCase();
    if (record === undefined || RFC_UUID.test(record) === false) {
      return { ok: false, error: "no_form", name, page };
    }
    const fields = fieldsOf(instance.id, instances, propsOf);
    if (fields.ok === false) {
      return { ok: false, error: fields.error, name, page };
    }
    forms.add(record);
    if (forms.size > MAX_FORMS) {
      return { ok: false, error: "too_many", name, page };
    }
    roots.push({
      rootId: instance.id,
      name,
      page,
      formId: record,
      fields: fields.fields,
    });
  }
  return { ok: true, roots };
};

const sameList = (left: RequestedField[], right: RequestedField[]) =>
  left.length === right.length &&
  left.every(
    (field, index) =>
      field.key === right[index].key && field.required === right[index].required
  );

/**
 * One list per form: roots on the same form must send the same list, in the
 * same order and with the same required, or the first two that differ are
 * named.
 */
export const agreeFormRoots = (roots: CollectedRoot[]): AgreeResult => {
  const firstOf = new Map<string, CollectedRoot>();
  for (const root of roots) {
    const first = firstOf.get(root.formId);
    if (first === undefined) {
      firstOf.set(root.formId, root);
      continue;
    }
    if (sameList(first.fields, root.fields) === false) {
      return { ok: false, first, second: root };
    }
  }
  return {
    ok: true,
    forms: [...firstOf.values()].map(({ formId, fields }) => ({
      formId,
      fields,
    })),
  };
};
