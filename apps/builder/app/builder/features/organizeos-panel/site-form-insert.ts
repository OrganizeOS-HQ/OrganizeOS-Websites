import { nanoid } from "nanoid";
import {
  findTreeInstanceIds,
  type Instance,
  type Prop,
  type WebstudioData,
  type WebstudioFragment,
} from "@webstudio-is/sdk";
import {
  SITE_FORM_PROP,
  formRootComponents,
  type RequestedField,
} from "~/shared/organizeos-site-forms";
import {
  createSiteForm,
  type CreateSiteFormBody,
  type CreatedSiteForm,
  type FormsKind,
  type FormsResult,
} from "./forms-api";

/**
 * OrganizeOS fork: a forms insert's site form (docs/ORGANIZEOS-FORK.md
 * section 9, "Site forms"; builder forms spec 5.1, 7.3). With
 * `ORGANIZEOS_SITE_FORMS` on, a forms insert, or a site template's Signup
 * Form placement, first creates its own site form with F3, then writes the
 * block pointing at it (`record`) and marked as a site form (`siteForm`).
 * Nothing is written when the create fails.
 */

const namespace = "@organizeos/site-components";

/** The forms inserts: the kind of form each creates and its insert name. */
export const siteFormInserts: ReadonlyMap<
  string,
  { kind: FormsKind; name: string }
> = new Map([
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

/** The toast of an insert or a template whose form could not be created. */
export const SITE_FORM_CREATE_FAILED = "Couldn't create the form. Try again.";

/** F3's title limit. */
export const SITE_FORM_TITLE_MAX = 200;

const FIELD = `${namespace}:Field`;
const RSVP_FORM = `${namespace}:RsvpForm`;

/**
 * The fields a root collects, as F3 and F5 take them: its Fields' keys in
 * tree order, each once at its first place, required when any of its Fields
 * carries `required` (the collector's rule, shared/organizeos-site-forms.ts).
 */
export const siteFormFieldsOf = (
  fragment: WebstudioFragment,
  rootId: string
): RequestedField[] => {
  const instances = new Map(
    fragment.instances.map((instance) => [instance.id, instance])
  );
  const childIds = (instance: Instance | undefined) =>
    (instance?.children ?? []).flatMap((child) =>
      child.type === "id" ? [child.value] : []
    );
  const propOf = (instanceId: string, name: string) =>
    fragment.props.find(
      (prop) => prop.instanceId === instanceId && prop.name === name
    );
  const fields: RequestedField[] = [];
  const byKey = new Map<string, RequestedField>();
  const visited = new Set<string>([rootId]);
  const stack = childIds(instances.get(rootId)).reverse();
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    const instance = instances.get(id);
    if (
      instance === undefined ||
      formRootComponents.has(instance.component) ||
      instance.component === RSVP_FORM
    ) {
      continue;
    }
    if (instance.component === FIELD) {
      const field = propOf(id, "field");
      const required = propOf(id, "required");
      const key = field?.type === "string" ? field.value.trim() : "";
      const isRequired = required?.type === "boolean" && required.value;
      if (key !== "") {
        const known = byKey.get(key);
        if (known === undefined) {
          const entry = { key, required: isRequired };
          byKey.set(key, entry);
          fields.push(entry);
        } else if (isRequired) {
          known.required = true;
        }
      }
    }
    stack.push(...childIds(instance).reverse());
  }
  return fields;
};

const DEFAULT_INTRO = "News and actions from us.";

/**
 * The updates card's intro with the org's name (spec 5.2), as plain text: its
 * default line, "News and actions from us.", stays when the name is unknown
 * or blank (P12). Any other intro is left as it is.
 */
export const fillOrgName = (
  fragment: WebstudioFragment,
  orgName: string | undefined
): WebstudioFragment => {
  const name = orgName?.trim() ?? "";
  if (name === "") {
    return fragment;
  }
  return {
    ...fragment,
    instances: fragment.instances.map((instance) =>
      instance.label === "Intro"
        ? {
            ...instance,
            children: instance.children.map((child) =>
              child.type === "text" && child.value === DEFAULT_INTRO
                ? { ...child, value: `News and actions from ${name}.` }
                : child
            ),
          }
        : instance
    ),
  };
};

/**
 * The root pointed at its site form and marked as one: `record`, the form's
 * id, and `siteForm`, its kind, replacing any it had; and its navigator name,
 * when it has none, the insert name (the Email bar's template has none).
 */
export const markSiteForm = (
  fragment: WebstudioFragment,
  rootId: string,
  { formId, kind, label }: { formId: string; kind: FormsKind; label?: string }
): WebstudioFragment => ({
  ...fragment,
  instances: fragment.instances.map((instance) =>
    instance.id === rootId &&
    instance.label === undefined &&
    label !== undefined
      ? { ...instance, label }
      : instance
  ),
  props: [
    ...fragment.props.filter(
      (prop) =>
        prop.instanceId !== rootId ||
        (prop.name !== "record" && prop.name !== SITE_FORM_PROP)
    ),
    {
      id: nanoid(),
      instanceId: rootId,
      name: "record",
      type: "string",
      value: formId,
    },
    {
      id: nanoid(),
      instanceId: rootId,
      name: SITE_FORM_PROP,
      type: "string",
      value: kind,
    },
  ],
});

/**
 * A placement's client id (P11): a version 4 UUID made from SHA-256 of the
 * project, the template and the placement, so applying the same template to
 * the same project again (after an undo) gets the same forms back from F3.
 */
export const placementClientId = async (
  projectId: string,
  templateKey: string,
  rootId: string
): Promise<string> => {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${projectId}:${templateKey}:${rootId}`)
    )
  );
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
};

/** F3, retried once with the same `clientId` when its answer was lost (P11). */
export const createSiteFormOnce = async (
  projectId: string,
  body: CreateSiteFormBody
): Promise<FormsResult<CreatedSiteForm>> => {
  const first = await createSiteForm(projectId, body);
  if (first.ok || first.error !== "lost") {
    return first;
  }
  return createSiteForm(projectId, body);
};

export type SiteFormPlacement = CreateSiteFormBody & { rootId: string };

/**
 * One site form per placement, one after another, before a template's write
 * (P10). Any failure fails the lot, and the template is not applied.
 */
export const createSiteFormsForPlacements = async (
  projectId: string,
  placements: ReadonlyArray<SiteFormPlacement>
): Promise<
  { ok: true; forms: Map<string, CreatedSiteForm> } | { ok: false }
> => {
  const forms = new Map<string, CreatedSiteForm>();
  for (const { rootId, ...body } of placements) {
    const created = await createSiteFormOnce(projectId, body);
    if (created.ok === false) {
      return { ok: false };
    }
    forms.set(rootId, created.value);
  }
  return { ok: true, forms };
};

/**
 * A template placement's root, once in the build, pointed at its site form
 * and marked (P10): `record` and `siteForm` on the root, and each Field under
 * it given its definition, `fieldType`, `required` and `options`, from the
 * form the platform resolved (F3's answer), so a Field the live form lacks
 * still renders on the canvas and its required reaches the next publish.
 */
export const markPlacementMutable = (
  data: Pick<WebstudioData, "instances" | "props">,
  rootId: string,
  form: CreatedSiteForm & { kind: FormsKind }
) => {
  const setProp = (
    instanceId: string,
    name: string,
    prop:
      | { type: "string"; value: string }
      | { type: "boolean"; value: boolean }
      | { type: "json"; value: unknown }
  ) => {
    for (const existing of data.props.values()) {
      if (existing.instanceId === instanceId && existing.name === name) {
        data.props.delete(existing.id);
      }
    }
    const id = nanoid();
    data.props.set(id, { id, instanceId, name, ...prop } as Prop);
  };
  setProp(rootId, "record", { type: "string", value: form.id });
  setProp(rootId, SITE_FORM_PROP, { type: "string", value: form.kind });
  const byName = new Map(form.fields.map((field) => [field.name, field]));
  for (const id of findTreeInstanceIds(data.instances, rootId)) {
    if (data.instances.get(id)?.component !== FIELD) {
      continue;
    }
    const key = [...data.props.values()].find(
      (prop) => prop.instanceId === id && prop.name === "field"
    );
    const definition =
      key?.type === "string" ? byName.get(key.value.trim()) : undefined;
    if (definition === undefined) {
      continue;
    }
    setProp(id, "fieldType", { type: "string", value: definition.type });
    setProp(id, "required", { type: "boolean", value: definition.required });
    if (definition.options !== undefined) {
      setProp(id, "options", { type: "json", value: definition.options });
    }
  }
};
