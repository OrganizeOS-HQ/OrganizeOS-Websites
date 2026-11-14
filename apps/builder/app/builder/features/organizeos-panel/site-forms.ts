import type { Instance } from "@webstudio-is/sdk";
import { parseFormsData } from "@organizeos/site-components/forms-data";
import { $organizeosSite } from "~/shared/nano-states";
import { $selectedPage } from "~/shared/nano-states/pages";
import { $instances, $project, $props } from "~/shared/sync/data-stores";
import { getInstanceLabel } from "~/builder/shared/instance-label";
import { builderApi } from "~/shared/builder-api";
import {
  SITE_FORM_PROP,
  formRootComponents,
} from "~/shared/organizeos-site-forms";
import type {
  CatalogField,
  DoorFormField,
  FormsCatalog,
  FormsKind,
} from "./forms-api";
import { reloadFormsResource } from "./insert-organizeos-block";
import {
  getState,
  insertFieldsMutable,
  listRootFields,
  runStaged,
  type FormField,
} from "./signup-fields";
import {
  SITE_FORM_CREATE_FAILED,
  SITE_FORM_TITLE_MAX,
  createSiteFormOnce,
} from "./site-form-insert";

/**
 * OrganizeOS fork: the Form row's site forms (docs/ORGANIZEOS-FORK.md section
 * 9, "Site forms"; builder forms spec 9). With `ORGANIZEOS_SITE_FORMS` on, the
 * row lists the forms of the block's kind, site forms first, then "New form";
 * choosing a site form points the block at it and makes its Fields the form's,
 * and "New form" creates one from the block's Fields. Each is one write and
 * one undo; the Forms Resource reloads after, so the canvas has the form.
 */

const KINDS: ReadonlySet<string> = new Set([
  "contact-signup",
  "contact-form",
  "membership",
]);

/** The Form row's last option: create a site form from the block's Fields. */
export const NEW_SITE_FORM = { value: "__new_site_form__", label: "New form" };

const rootProp = (rootId: Instance["id"], name: string) =>
  [...$props.get().values()].find(
    (prop) => prop.instanceId === rootId && prop.name === name
  );

/**
 * A block's kind (P4): its site form mark, else the kind of the form its
 * record names in its Forms data (a CRM contact form is `contact-form`), else
 * `contact-signup`.
 */
export const formKindOf = (
  rootId: Instance["id"],
  formsData: unknown
): FormsKind => {
  const mark = rootProp(rootId, SITE_FORM_PROP);
  if (mark?.type === "string" && KINDS.has(mark.value)) {
    return mark.value as FormsKind;
  }
  const record = rootProp(rootId, "record");
  if (record?.type === "string") {
    const kind = parseFormsData(formsData)?.find(
      (form) => form.id === record.value.trim()
    )?.kind;
    if (kind !== undefined && KINDS.has(kind)) {
      return kind as FormsKind;
    }
  }
  return "contact-signup";
};

type RecordOption = { value: string; label: string; description?: string };

/**
 * The Form row's options with the switch on: the no-form choice first, then
 * the block's kind's site forms, then its other forms and any option the data
 * does not know (an Unavailable form) in their order, then New form.
 */
export const siteFormRecordOptions = <Option extends RecordOption>(
  options: readonly Option[],
  formsData: unknown,
  kind: FormsKind
): Array<Option | typeof NEW_SITE_FORM> => {
  const known = new Map(
    (parseFormsData(formsData) ?? []).map((form) => [form.id, form])
  );
  const none = options.filter((option) => option.value === "");
  const site: Option[] = [];
  const rest: Option[] = [];
  for (const option of options) {
    if (option.value === "") {
      continue;
    }
    const form = known.get(option.value);
    if (form === undefined) {
      rest.push(option);
    } else if (form.kind === kind) {
      (form.site ? site : rest).push(option);
    }
  }
  return [...none, ...site, ...rest, NEW_SITE_FORM];
};

const toFormField = (field: DoorFormField): FormField => ({
  name: field.name,
  label: field.label,
  type: field.type,
  required: field.required,
  options: field.options ?? null,
});

/**
 * A site form chosen: the root's `record` and `siteForm`, its Fields of keys
 * the form lacks removed, a Field for each it lacks added, and every Field of
 * the root, kept ones included, given the form's `fieldType`, `required` and
 * `options`, in one write and one undo.
 */
export const matchFieldsToSiteForm = async (
  rootId: Instance["id"],
  form: { id: string; fields: readonly DoorFormField[] },
  kind: FormsKind
) => {
  const written = await runStaged("Cannot change the form.", (accumulator) => {
    accumulator.execute({
      id: "instances.updateProps",
      input: {
        updates: [
          {
            instanceId: rootId,
            name: "record",
            type: "string",
            value: form.id,
          },
          {
            instanceId: rootId,
            name: SITE_FORM_PROP,
            type: "string",
            value: kind,
          },
        ],
      },
    });
    const wanted = new Set(form.fields.map((field) => field.name));
    const before = getState(accumulator);
    const { byName } = listRootFields(rootId, before.instances, before.props);
    const removed = [...byName].flatMap(([name, ids]) =>
      wanted.has(name) ? [] : ids
    );
    if (removed.length > 0) {
      accumulator.execute({
        id: "instances.delete",
        input: { instanceIds: removed },
      });
    }
    insertFieldsMutable(
      accumulator,
      rootId,
      form.fields
        .filter((field) => byName.has(field.name) === false)
        .map(toFormField)
    );
    const after = getState(accumulator);
    const fieldIds = listRootFields(
      rootId,
      after.instances,
      after.props
    ).byName;
    const updates = form.fields.flatMap((field) =>
      (fieldIds.get(field.name) ?? []).flatMap((instanceId) => [
        {
          instanceId,
          name: "fieldType",
          type: "string" as const,
          value: field.type,
        },
        {
          instanceId,
          name: "required",
          type: "boolean" as const,
          value: field.required,
        },
        ...(field.options === undefined
          ? []
          : [
              {
                instanceId,
                name: "options",
                type: "json" as const,
                value: field.options,
              },
            ]),
      ])
    );
    if (updates.length > 0) {
      accumulator.execute({ id: "instances.updateProps", input: { updates } });
    }
  });
  if (written) {
    await reloadFormsResource();
  }
  return written;
};

/** The root's keys as F3 takes them, required when any of a key's Fields is. */
const rootFieldsOf = (rootId: Instance["id"]) => {
  const instances = $instances.get();
  const props = $props.get();
  const { byName, order } = listRootFields(rootId, instances, props);
  // a blank Field is no key (F3 refuses one)
  return order
    .filter((key) => key !== "")
    .map((key) => ({
      key,
      required: (byName.get(key) ?? []).some((fieldId) =>
        [...props.values()].some(
          (prop) =>
            prop.instanceId === fieldId &&
            prop.name === "required" &&
            prop.type === "boolean" &&
            prop.value
        )
      ),
    }));
};

/**
 * "New form": a site form of the block's kind made from its Fields (F3), then
 * chosen as above. A failed create writes nothing and says so.
 */
export const pointAtNewSiteForm = async (
  rootId: Instance["id"],
  kind: FormsKind
) => {
  const project = $project.get();
  if (project === undefined) {
    return false;
  }
  const root = $instances.get().get(rootId);
  const name =
    root?.label ?? getInstanceLabel({ component: root?.component ?? "" });
  const created = await createSiteFormOnce(project.id, {
    kind,
    title: `${$selectedPage.get()?.name ?? "Page"}: ${name}`.slice(
      0,
      SITE_FORM_TITLE_MAX
    ),
    fields: rootFieldsOf(rootId),
    clientId: crypto.randomUUID(),
  });
  if (created.ok === false) {
    builderApi.toast.error(SITE_FORM_CREATE_FAILED);
    return false;
  }
  return matchFieldsToSiteForm(rootId, created.value, kind);
};

/** A form's CRM editor in the org's workspace; none without its subdomain. */
export const crmFormUrl = (formId: string) => {
  const site = $organizeosSite.get();
  if (site?.subdomain === undefined) {
    return;
  }
  return `${site.platformUrl}/${
    site.subdomain
  }/pages/signup/${encodeURIComponent(formId)}`;
};

// The Signup Form's states, in the block's order (signup/states.ts).
const signupFormStates = [
  "initial",
  "submitting",
  "success",
  "confirm-email",
  "error",
  "unavailable",
] as const;

/** The State row's states: a contact form has no Check email (spec 9). */
export const formStatesFor = (kind: FormsKind): readonly string[] =>
  kind === "contact-form"
    ? signupFormStates.filter((state) => state !== "confirm-email")
    : signupFormStates;

/** A site form's field limit (the CRM editor's, `SITE_FORM_MAX_FIELDS`). */
export const SITE_FORM_FIELD_LIMIT = 20;

/** A select the CRM editor can save: at most 20 options of 100 characters. */
const isSaveableSelect = (field: CatalogField) =>
  field.options === undefined ||
  (field.options.length <= 20 &&
    field.options.every((option) => option.length <= 100));

export type SiteFieldRow = {
  key: string;
  label: string;
  required: boolean;
  locked: boolean;
};

const isRequiredFieldOf = (fieldId: Instance["id"]) =>
  [...$props.get().values()].some(
    (prop) =>
      prop.instanceId === fieldId &&
      prop.name === "required" &&
      prop.type === "boolean" &&
      prop.value
  );

/**
 * The keys a kind always locks (spec 6.2), so a row is locked before F1
 * answers, or when it fails: Email on every kind, Message on Contact us
 * (a contact form without it refuses every submit), Full name on Member
 * signup.
 */
const lockedKeysOf = (kind: FormsKind): ReadonlySet<string> =>
  new Set(
    kind === "contact-form"
      ? ["email", "message"]
      : kind === "membership"
        ? ["email", "name"]
        : ["email"]
  );

/**
 * The Fields list of a site form (spec 9): one row per key under the root,
 * in tree order, its catalog label (else its key), required when any of its
 * Fields is, locked as the catalog says or the kind always locks.
 */
export const siteFieldRows = (
  rootId: Instance["id"],
  catalog: FormsCatalog | undefined,
  kind: FormsKind = "contact-signup"
): SiteFieldRow[] => {
  const kindLocks = lockedKeysOf(kind);
  const { byName, order } = listRootFields(
    rootId,
    $instances.get(),
    $props.get()
  );
  return order
    .filter((key) => key !== "")
    .map((key) => {
      const entry = catalog?.fields.find((field) => field.key === key);
      return {
        key,
        label: entry?.label ?? key,
        required: (byName.get(key) ?? []).some(isRequiredFieldOf),
        locked: entry?.locked === true || kindLocks.has(key),
      };
    });
};

/** The required toggle: `required` on every Field of the key, one undo. */
export const setSiteFieldRequired = (
  rootId: Instance["id"],
  key: string,
  required: boolean
) =>
  runStaged("Cannot change the field.", (accumulator) => {
    const { instances, props } = getState(accumulator);
    const ids = listRootFields(rootId, instances, props).byName.get(key) ?? [];
    if (ids.length === 0) {
      return;
    }
    accumulator.execute({
      id: "instances.updateProps",
      input: {
        updates: ids.map((instanceId) => ({
          instanceId,
          name: "required",
          type: "boolean" as const,
          value: required,
        })),
      },
    });
  });

/**
 * A drag: the key's first Field moved to the place of the Field now at
 * `toIndex` in the list, before it when moving up, after it when moving
 * down, in that Field's parent. One undo.
 */
export const moveSiteField = (
  rootId: Instance["id"],
  key: string,
  toIndex: number
) =>
  runStaged("Cannot move the field.", (accumulator) => {
    const { instances, props } = getState(accumulator);
    const { byName, order: keys } = listRootFields(rootId, instances, props);
    // the list's own indexes: a blank Field has no row
    const order = keys.filter((name) => name !== "");
    const from = order.indexOf(key);
    const targetKey = order[toIndex];
    if (from === -1 || targetKey === undefined || from === toIndex) {
      return;
    }
    const movingId = byName.get(key)?.[0];
    const targetId = byName.get(targetKey)?.[0];
    const parent = [...(instances.values() as Iterable<Instance>)].find(
      (instance) =>
        instance.children.some(
          (child: Instance["children"][number]) =>
            child.type === "id" && child.value === targetId
        )
    );
    if (movingId === undefined || parent === undefined) {
      return;
    }
    const at = parent.children.findIndex(
      (child: Instance["children"][number]) =>
        child.type === "id" && child.value === targetId
    );
    accumulator.execute({
      id: "instances.move",
      input: {
        moves: [
          {
            instanceId: movingId,
            parentInstanceId: parent.id,
            insertIndex: from < toIndex ? at + 1 : at,
          },
        ],
      },
    });
  });

/** Add: a Field for the catalog field, defined by it, not required. */
export const addCatalogField = (rootId: Instance["id"], field: CatalogField) =>
  runStaged(`Cannot add ${field.label}.`, (accumulator) => {
    insertFieldsMutable(accumulator, rootId, [
      {
        name: field.key,
        label: field.label,
        type: field.type,
        required: false,
        options: field.options ?? null,
        ...(field.consent === undefined ? {} : { consent: field.consent }),
      },
    ]);
    const { instances, props } = getState(accumulator);
    const ids =
      listRootFields(rootId, instances, props).byName.get(field.key) ?? [];
    accumulator.execute({
      id: "instances.updateProps",
      input: {
        updates: ids.flatMap((instanceId) => [
          {
            instanceId,
            name: "fieldType",
            type: "string" as const,
            value: field.type,
          },
          {
            instanceId,
            name: "required",
            type: "boolean" as const,
            value: false,
          },
          ...(field.options === undefined
            ? []
            : [
                {
                  instanceId,
                  name: "options",
                  type: "json" as const,
                  value: field.options,
                },
              ]),
        ]),
      },
    });
  });

/**
 * The Add menu: the catalog's fields the root has none of, standard first,
 * then Custom; a consent field only when the org can text; a select only
 * when the CRM editor can save it; and nothing once the root holds 20.
 */
export const catalogAddOptions = (
  catalog: FormsCatalog,
  rootKeys: readonly string[],
  { smsAvailable }: { smsAvailable: boolean }
) => {
  const held = new Set(rootKeys);
  const offered = catalog.fields.filter(
    (field) =>
      held.has(field.key) === false &&
      (field.consent === undefined || smsAvailable) &&
      isSaveableSelect(field)
  );
  return {
    standard: offered.filter((field) => field.custom === false),
    custom: offered.filter((field) => field.custom),
    full: rootKeys.length >= SITE_FORM_FIELD_LIMIT,
  };
};

/** A root's list as the publish sends it: keys in order, with required. */
const rootListOf = (rootId: Instance["id"]) =>
  siteFieldRows(rootId, undefined)
    .map(({ key, required }) => `${key}:${required}`)
    .join(",");

/** The root carries a site form mark of a known kind (fork doc section 9). */
export const isMarkedSiteForm = (rootId: Instance["id"]) => {
  const mark = rootProp(rootId, SITE_FORM_PROP);
  return mark?.type === "string" && KINDS.has(mark.value);
};

/** Some root in the project carries a site form mark of a known kind. */
export const projectHasSiteForms = () =>
  [...$props.get().values()].some(
    (prop) =>
      prop.name === SITE_FORM_PROP &&
      prop.type === "string" &&
      KINDS.has(prop.value)
  );

/**
 * Another root marked as a site form on the same form sends another list
 * (spec 9's "Fields differ on another page"); never for an unmarked root.
 */
export const fieldsDifferElsewhere = (rootId: Instance["id"]) => {
  const isMarked = isMarkedSiteForm;
  const recordOf = (id: Instance["id"]) => {
    const record = rootProp(id, "record");
    return record?.type === "string" ? record.value.trim().toLowerCase() : "";
  };
  if (isMarked(rootId) === false || recordOf(rootId) === "") {
    return false;
  }
  const own = rootListOf(rootId);
  const record = recordOf(rootId);
  for (const instance of $instances.get().values()) {
    if (
      instance.id !== rootId &&
      formRootComponents.has(instance.component) &&
      isMarked(instance.id) &&
      recordOf(instance.id) === record &&
      rootListOf(instance.id) !== own
    ) {
      return true;
    }
  }
  return false;
};
