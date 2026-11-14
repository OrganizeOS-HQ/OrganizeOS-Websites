import { nanoid } from "nanoid";
import {
  type DataSources,
  type Instance,
  type Instances,
  type Prop,
  type Props,
  decodeDataVariableId,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import { getExpressionIdentifiers } from "@webstudio-is/expression";
import { renderTemplate } from "@webstudio-is/template";
import {
  type InstanceSelector,
  BuilderRuntimeError,
} from "@webstudio-is/project-build/runtime";
// the narrow exports, as the block insert imports localStylesFirst: neither
// brings the template catalog into the canvas
import { localStylesFirst } from "@organizeos/site-components/style-order";
import {
  type FieldTemplateField,
  consentLabelExpression,
  fieldTemplate,
  getFieldNavigatorLabel,
} from "@organizeos/site-components/field-template";
import {
  type SignupFormResolution,
  isRequiredField,
} from "@organizeos/site-components/forms-data";
import { formRootComponents } from "~/shared/organizeos-site-forms";
import { builderApi } from "~/shared/builder-api";
import { platformName } from "~/shared/branding";
import {
  type RuntimeMutationAccumulator,
  executeStagedRuntimeMutation,
} from "~/shared/instance-utils/data";
import { $instances, $project, $resources } from "~/shared/sync/data-stores";
import {
  type OrganizeosPresetIds,
  completeOrganizeosFragment,
  completeOrganizeosInsertMutable,
  getOrganizeosPresetIds,
  isOrganizeosBlocksEnabled,
  organizeosNamespace,
} from "./insert-organizeos-block";
import { updateWebstudioDataStaged } from "./staged-data";

/**
 * The Signup Form's Fields list (fork doc section 9, "In the builder"): which
 * of its form's fields the root has a Field for, where a new Field goes, the
 * one warning line, and the writes the list, the Form change and the Field's
 * form field select make.
 *
 * Everything is read from the build (`$instances` and `$props`), never from
 * the canvas's part registry: the template unmounts Form Content in the
 * states that replace it, and a list read from the canvas would uncheck
 * itself there.
 */

/** A form field as the blocks read the Forms data (`FormFieldConfig`). */
export type FormField = NonNullable<SignupFormResolution["fields"]>[number];

export const signupFormComponent = `${organizeosNamespace}:SignupForm`;
export const fieldComponent = `${organizeosNamespace}:Field`;
const submitButtonComponent = `${organizeosNamespace}:SubmitButton`;

/**
 * The root components the Fields logic serves, the publish step's form roots
 * (shared/organizeos-site-forms.ts); the Join Form adds its root there.
 */
export { formRootComponents };

// Every root that gives its Fields a form: a Field belongs to the closest one,
// so the walk below a root stops at another.
const formContextComponents = () =>
  new Set([...formRootComponents, `${organizeosNamespace}:RsvpForm`]);

/**
 * The closest form root of a selection, the selection itself included, as a
 * selector; undefined when the closest root that gives Fields a form is not
 * one the Fields logic serves (an RSVP Form), or there is none.
 */
export const findSignupFormRoot = (
  selector: InstanceSelector,
  instances: Instances
): undefined | InstanceSelector => {
  const contexts = formContextComponents();
  for (let index = 0; index < selector.length; index += 1) {
    const component = instances.get(selector[index])?.component;
    if (component !== undefined && contexts.has(component)) {
      return formRootComponents.has(component)
        ? selector.slice(index)
        : undefined;
    }
  }
};

/**
 * Whether a root sits inside another form: an ancestor whose tag is `form`,
 * the root's own tag excluded (a Signup Form renders a form itself).
 */
export const isNestedInForm = (
  rootSelector: InstanceSelector,
  instanceTags: ReadonlyMap<Instance["id"], string>
) => rootSelector.slice(1).some((id) => instanceTags.get(id) === "form");

type Placed = { id: Instance["id"]; parentId: Instance["id"]; index: number };

/**
 * The descendants of a root in document order, each with its parent and its
 * place there, not below another form root.
 */
const walkRoot = (rootId: Instance["id"], instances: Instances) => {
  const contexts = formContextComponents();
  const placed: Placed[] = [];
  const visit = (parentId: Instance["id"]) => {
    instances.get(parentId)?.children.forEach((child, index) => {
      if (child.type !== "id") {
        return;
      }
      const instance = instances.get(child.value);
      if (instance === undefined) {
        return;
      }
      placed.push({ id: instance.id, parentId, index });
      if (contexts.has(instance.component) === false) {
        visit(instance.id);
      }
    });
  };
  visit(rootId);
  return placed;
};

/**
 * Every descendant Field of the root, by its trimmed `field` prop, in
 * document order. A bound `field` counts by its computed value when
 * `computedName` gives one, and is listed in `bound` otherwise, so it is never
 * reported "Not in form".
 */
export const listRootFields = (
  rootId: Instance["id"],
  instances: Instances,
  props: Props,
  computedName?: ComputedFieldName
): {
  byName: Map<string, Instance["id"][]>;
  order: string[];
  bound: Instance["id"][];
  hasSubmit: boolean;
} => {
  const fieldProps = new Map<Instance["id"], Prop>();
  for (const prop of props.values()) {
    if (prop.name === "field") {
      fieldProps.set(prop.instanceId, prop);
    }
  }
  const byName = new Map<string, Instance["id"][]>();
  const order: string[] = [];
  const bound: Instance["id"][] = [];
  let hasSubmit = false;
  for (const { id } of walkRoot(rootId, instances)) {
    const component = instances.get(id)?.component;
    if (component === submitButtonComponent) {
      hasSubmit = true;
    }
    if (component !== fieldComponent) {
      continue;
    }
    const prop = fieldProps.get(id);
    let name: undefined | string;
    if (prop === undefined) {
      name = "";
    } else if (prop.type === "string") {
      name = prop.value.trim();
    } else {
      const computed = computedName?.(id);
      name = typeof computed === "string" ? computed.trim() : undefined;
    }
    if (name === undefined) {
      bound.push(id);
      continue;
    }
    const ids = byName.get(name);
    if (ids === undefined) {
      byName.set(name, [id]);
      order.push(name);
    } else {
      ids.push(id);
    }
  }
  return { byName, order, bound, hasSubmit };
};

export type FieldRow = {
  name: string;
  label: string;
  checked: boolean;
  locked: boolean;
  consent: boolean;
};

/**
 * One row per field of the resolved form, in the form's order. A row is
 * checked while the root has a Field of its name. A locked field (by default:
 * required, by the blocks' isRequiredField, so never a consent field) is
 * locked only while its Field exists, so a
 * deleted one can be put back from the list. A consent field is listed only
 * while the definition has it, which is what `fields` holds.
 */
export const getFieldRows = (
  fields: readonly FormField[],
  present: ReadonlyMap<string, unknown>,
  isLocked: (field: FormField) => boolean = isRequiredField
): FieldRow[] =>
  fields.map((field) => {
    const checked = present.has(field.name);
    return {
      name: field.name,
      // a consent row by its kind, as the navigator names its Field
      label:
        field.consent === undefined
          ? field.label
          : getFieldNavigatorLabel(field),
      checked,
      locked: checked && isLocked(field),
      consent: field.consent !== undefined,
    };
  });

/**
 * Where a new Field goes: after the last Field; with none, before the first
 * Submit Button; with neither, last in the root's child labelled "Form
 * Content", else in the root's first child instance; never the root itself.
 */
export const findFieldInsertTarget = (
  rootId: Instance["id"],
  instances: Instances,
  _props?: Props
): undefined | { parentInstanceId: Instance["id"]; insertIndex: number } => {
  const placed = walkRoot(rootId, instances);
  const lastField = placed.findLast(
    ({ id }) => instances.get(id)?.component === fieldComponent
  );
  if (lastField !== undefined) {
    return {
      parentInstanceId: lastField.parentId,
      insertIndex: lastField.index + 1,
    };
  }
  const submit = placed.find(
    ({ id }) => instances.get(id)?.component === submitButtonComponent
  );
  if (submit !== undefined) {
    return { parentInstanceId: submit.parentId, insertIndex: submit.index };
  }
  const children = placed
    .filter(({ parentId }) => parentId === rootId)
    .map(({ id }) => instances.get(id) as Instance);
  const container =
    children.find((child) => child.label === "Form Content") ?? children[0];
  if (container === undefined) {
    return;
  }
  return {
    parentInstanceId: container.id,
    insertIndex: container.children.length,
  };
};

/**
 * Whether a root's `data` is bound: an expression that reads at least one
 * variable the project has. Missing, a literal (what an unbind leaves), or an
 * expression whose variables are all gone is not bound, and no load will ever
 * fill it, so it is never taken for loading.
 */
export const isSignupDataBound = (
  rootId: Instance["id"],
  props: Props,
  dataSources: DataSources
) => {
  for (const prop of props.values()) {
    if (
      prop.instanceId === rootId &&
      prop.name === "data" &&
      prop.type === "expression"
    ) {
      return Array.from(getExpressionIdentifiers(prop.value)).some(
        (identifier) => {
          const id = decodeDataVariableId(identifier);
          return id !== undefined && dataSources.has(id);
        }
      );
    }
  }
  return false;
};

/**
 * The one warning line, in the order the spec gives, or undefined. While
 * bound `data` loads, nothing. With `data` unbound, its own line says so
 * (the Fields row's "No forms data"), and this runs the checks that need no
 * data: with no form picked the org defaults' fields, else the Submit Button.
 */
export const getSignupWarning = ({
  nested,
  dataBound,
  data,
  resolution,
  rootFields,
  failedLoads,
}: {
  nested: boolean;
  /** Whether the root's `data` is bound (isSignupDataBound). */
  dataBound: boolean;
  /** The root's computed `data`. */
  data: unknown;
  resolution: SignupFormResolution;
  rootFields: ReturnType<typeof listRootFields>;
  /** A load the root's `data` reads failed: the record picker says so. */
  failedLoads: boolean;
}): undefined | string => {
  // nothing while the forms load
  if (dataBound && data === undefined) {
    return;
  }
  if (nested) {
    return "Nested in a form";
  }
  const { byName, order, hasSubmit } = rootFields;
  const { fields } = resolution;
  if (resolution.unavailable !== undefined || fields === undefined) {
    if (dataBound === false) {
      return hasSubmit ? undefined : "No Submit Button";
    }
    return failedLoads ? undefined : "Form not found";
  }
  const missing = fields.find(
    (field) => isRequiredField(field) && byName.has(field.name) === false
  );
  if (missing !== undefined) {
    return `Missing: ${missing.label}`;
  }
  const hasSmsConsent = fields.some(
    (field) => field.consent === "sms" && byName.has(field.name)
  );
  if (hasSmsConsent && byName.has("phone") === false) {
    return "SMS needs Phone";
  }
  if (hasSubmit === false) {
    return "No Submit Button";
  }
  const known = new Set(fields.map((field) => field.name));
  const unknown = order.find((name) => known.has(name) === false);
  if (unknown !== undefined) {
    return `Not in form: ${unknown === "" ? "(blank)" : unknown}`;
  }
};

const toTemplateField = (field: FormField): FieldTemplateField => ({
  name: field.name,
  label: field.label,
  type: field.type,
  ...(field.consent === undefined ? {} : { consent: field.consent }),
});

/** A bound `field`'s computed value, as listRootFields takes it. */
export type ComputedFieldName = (fieldId: Instance["id"]) => string | undefined;

const getState = (accumulator: RuntimeMutationAccumulator) => ({
  instances: accumulator.state.instances ?? new Map(),
  props: accumulator.state.props ?? new Map(),
});

/**
 * Inserts a Field for each field the root has none of, in the given order,
 * each where findFieldInsertTarget puts it, all on the accumulator's state: a
 * name already present (a second click before the first settled) is skipped,
 * a Field whose bound `field` computes to it (`computedName`) included.
 * A Field brings no block data: no Resource, DataSource or binding.
 */
const insertFieldsMutable = (
  accumulator: RuntimeMutationAccumulator,
  rootId: Instance["id"],
  fields: readonly FormField[],
  computedName?: ComputedFieldName
) => {
  for (const field of fields) {
    const { instances, props } = getState(accumulator);
    if (
      listRootFields(rootId, instances, props, computedName).byName.has(
        field.name
      )
    ) {
      continue;
    }
    if (isOrganizeosBlocksEnabled() === false) {
      throw Error(
        `Cannot add ${field.label}: ${platformName} blocks are not available for this site yet.`
      );
    }
    const target = findFieldInsertTarget(rootId, instances, props);
    if (target === undefined) {
      throw Error(`Cannot add ${field.label}.`);
    }
    const fragment = localStylesFirst(
      renderTemplate(fieldTemplate(toTemplateField(field)), nanoid)
    );
    accumulator.execute({
      id: "instances.insertFragment",
      input: {
        parentInstanceId: target.parentInstanceId,
        fragment,
        // reuses the project's "OS Field", "OS Input" and "OS Message" as
        // they stand, as the block insert does
        conflictResolution: "ours",
        insertIndex: target.insertIndex,
      },
      // the runtime's registry has no OrganizeOS metas (ruling data OQ1)
      context: { allowLegacyContentModelWarnings: true },
    });
  }
};

const fieldLabelComponent = `${organizeosNamespace}:FieldLabel`;

/** A Field's own Field Labels, not those of a Field inside it. */
const findFieldLabels = (fieldId: Instance["id"], instances: Instances) => {
  const labels: Instance["id"][] = [];
  const visit = (parentId: Instance["id"]) => {
    for (const child of instances.get(parentId)?.children ?? []) {
      const instance =
        child.type === "id" ? instances.get(child.value) : undefined;
      if (instance === undefined || instance.component === fieldComponent) {
        continue;
      }
      if (instance.component === fieldLabelComponent) {
        labels.push(instance.id);
      } else {
        visit(instance.id);
      }
    }
  };
  visit(fieldId);
  return labels;
};

/** Whether a Field Label holds a consent label: the expression alone. */
const isConsentLabel = (children: Instance["children"]) =>
  children.length === 1 &&
  children[0].type === "expression" &&
  children[0].value === consentLabelExpression;

/**
 * Binds a root's `data` to the org's Forms catalog again, as the insert binds
 * it: through the insert's own completion (completeOrganizeosFragment, then
 * completeOrganizeosInsertMutable), reusing the root's own binding of the
 * Forms Resource when it is still there, in one transaction and one undo
 * step. The catalog is kept: the Forms Resource is added only when missing,
 * in provisioning's shape, and nothing else of it is written. Refused, with a
 * toast and nothing written, where the insert would be.
 */
export const restoreSignupFormData = async (
  rootId: Instance["id"]
): Promise<boolean> => {
  const project = $project.get();
  const root = $instances.get().get(rootId);
  if (project === undefined || root === undefined) {
    return false;
  }
  const label = "the forms data";
  if (isOrganizeosBlocksEnabled() === false) {
    builderApi.toast.error(
      `Cannot restore ${label}: ${platformName} blocks are not available for this site yet.`
    );
    return false;
  }
  let presetIds: OrganizeosPresetIds;
  try {
    presetIds = await getOrganizeosPresetIds(project.id);
  } catch (error) {
    console.error(error);
    builderApi.toast.error(`Cannot restore ${label}.`);
    return false;
  }
  const completion = completeOrganizeosFragment({
    component: root.component,
    fragment: {
      children: [{ type: "id", value: rootId }],
      instances: [root],
      assets: [],
      dataSources: [],
      resources: [],
      props: [],
      breakpoints: [],
      styleSourceSelections: [],
      styleSources: [],
      styles: [],
    },
    presetIds,
    resources: $resources.get(),
  });
  if (completion.status === "refused" || completion.binding === undefined) {
    builderApi.toast.error(
      `Cannot restore ${label}: this site's link to your organization's data was removed or changed. Contact ${platformName} support to restore it.`
    );
    return false;
  }
  const { binding } = completion;
  try {
    return await updateWebstudioDataStaged((data) => {
      const own = Array.from(data.dataSources.values()).find(
        (dataSource) =>
          dataSource.type === "resource" &&
          dataSource.scopeInstanceId === rootId &&
          dataSource.resourceId === binding.resourceId
      );
      if (own === undefined) {
        completeOrganizeosInsertMutable(
          data,
          completion,
          new Map([[rootId, rootId]])
        );
        return true;
      }
      const variable = encodeDataSourceVariable(own.id);
      for (const bind of binding.binds) {
        for (const prop of data.props.values()) {
          if (prop.instanceId === bind.instanceId && prop.name === bind.prop) {
            data.props.delete(prop.id);
          }
        }
        const id = nanoid();
        data.props.set(id, {
          id,
          instanceId: bind.instanceId,
          name: bind.prop,
          type: "expression",
          value: bind.value(variable),
        });
      }
      return true;
    });
  } catch (error) {
    console.error(error);
    builderApi.toast.error(
      error instanceof Error ? error.message : `Cannot restore ${label}.`
    );
    return false;
  }
};

/**
 * One staged write: one commit, one undo step, no selection change. Resolves
 * false, after a toast, when refused; the runtime's own refusal of the commit
 * is toasted by the commit itself and not again.
 */
const runStaged = async (
  fallback: string,
  stage: (accumulator: RuntimeMutationAccumulator) => void
): Promise<boolean> => {
  let staged = false;
  try {
    await executeStagedRuntimeMutation((accumulator) => {
      stage(accumulator);
      staged = true;
    });
    return true;
  } catch (error) {
    if (staged && error instanceof BuilderRuntimeError) {
      return false;
    }
    console.error(error);
    builderApi.toast.error(error instanceof Error ? error.message : fallback);
    return false;
  }
};

/** Checking a row: one Field for the field, in one transaction. */
export const addSignupField = (
  rootId: Instance["id"],
  field: FormField,
  computedName?: ComputedFieldName
) =>
  runStaged(`Cannot add ${field.label}.`, (accumulator) =>
    insertFieldsMutable(accumulator, rootId, [field], computedName)
  );

/** Unchecking a row: every Field of the name under the root, in one transaction. */
export const removeSignupField = (rootId: Instance["id"], name: string) =>
  runStaged(`Cannot remove ${name}.`, (accumulator) => {
    const { instances, props } = getState(accumulator);
    const instanceIds = listRootFields(rootId, instances, props).byName.get(
      name
    );
    if (instanceIds === undefined || instanceIds.length === 0) {
      return;
    }
    accumulator.execute({ id: "instances.delete", input: { instanceIds } });
  });

/**
 * The Form change: `record`, and a Field for each required field of the new
 * form the root has none of, in form order, in one transaction. Fields the new
 * form lacks are left; the warning line names them.
 */
export const changeSignupForm = (
  rootId: Instance["id"],
  record: string,
  newFields: readonly FormField[] | undefined,
  computedName?: ComputedFieldName
) =>
  runStaged("Cannot change the form.", (accumulator) => {
    accumulator.execute({
      id: "instances.updateProps",
      input: {
        updates: [
          { instanceId: rootId, name: "record", type: "string", value: record },
        ],
      },
    });
    insertFieldsMutable(
      accumulator,
      rootId,
      (newFields ?? []).filter(isRequiredField),
      computedName
    );
  });

/**
 * The Field select's write: `field`, the navigator label when it still names
 * the old field (none, the old field's label, or "Field: {label}"), and the
 * Field Label's text where the switch calls for it, in one transaction. A
 * Field that becomes a consent field gets `consentLabelExpression` in its
 * labels, so no text of the old field stays; one that stops being one, or
 * whose labels have no text, gets the new field's label as text. Otherwise a
 * label's text is the designer's and is never touched.
 */
export const changeSignupFieldName = (
  fieldId: Instance["id"],
  name: string,
  fields: readonly FormField[]
) =>
  runStaged("Cannot change the form field.", (accumulator) => {
    const { instances, props } = getState(accumulator);
    let oldName: undefined | string;
    for (const prop of props.values()) {
      if (
        prop.instanceId === fieldId &&
        prop.name === "field" &&
        prop.type === "string"
      ) {
        oldName = prop.value.trim();
      }
    }
    if (oldName === name) {
      return;
    }
    accumulator.execute({
      id: "instances.updateProps",
      input: {
        updates: [
          { instanceId: fieldId, name: "field", type: "string", value: name },
        ],
      },
    });
    const label = instances.get(fieldId)?.label;
    const oldField = fields.find((field) => field.name === oldName);
    const oldLabels = new Set<string>();
    if (oldName !== undefined) {
      oldLabels.add(oldName);
    }
    if (oldField !== undefined) {
      oldLabels.add(oldField.label);
      oldLabels.add(`Field: ${oldField.label}`);
      oldLabels.add(getFieldNavigatorLabel(oldField));
    }
    const newField = fields.find((field) => field.name === name);
    for (const labelId of findFieldLabels(fieldId, instances)) {
      const children: Instance["children"] =
        instances.get(labelId)?.children ?? [];
      if (newField?.consent !== undefined) {
        if (isConsentLabel(children) === false) {
          accumulator.execute({
            id: "instances.setTextContent",
            input: {
              operation: "set",
              instanceId: labelId,
              text: consentLabelExpression,
              mode: "expression",
            },
          });
        }
      } else if (children.every((child) => child.type === "expression")) {
        accumulator.execute({
          id: "instances.setTextContent",
          input: {
            operation: "set",
            instanceId: labelId,
            text: newField?.label ?? name,
            mode: "text",
          },
        });
      }
    }
    if (label === undefined || label.trim() === "" || oldLabels.has(label)) {
      accumulator.execute({
        id: "instances.setLabel",
        input: {
          instanceId: fieldId,
          label:
            newField === undefined ? name : getFieldNavigatorLabel(newField),
        },
      });
    }
  });
