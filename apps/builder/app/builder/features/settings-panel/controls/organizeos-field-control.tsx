import { useId } from "react";
import { useStore } from "@nanostores/react";
import { validatePrimitiveValue } from "@webstudio-is/project-build/runtime";
import { Select } from "@webstudio-is/design-system";
import { resolveSignupForm } from "@organizeos/site-components/forms-data";
import { BindableExpressionControl } from "~/builder/shared/bindable-expression";
import {
  $propValuesByInstanceSelector,
  $selectedInstanceSelector,
  getInstanceKey,
} from "~/shared/nano-states";
import { $instances } from "~/shared/sync/data-stores";
import {
  type FormField,
  changeSignupFieldName,
  findSignupFormRoot,
} from "~/builder/features/organizeos-panel/signup-fields";
import {
  type ControlProps,
  VerticalLayout,
  humanizeAttribute,
} from "../shared";
import { PropertyLabel } from "../property-label";
import { useBindableControl } from "./use-bindable-control";

/**
 * A Field's form field, under a Signup Form: a select of its form's fields,
 * resolved as the block resolves them, each named by its label with its name
 * for the highlighted option. Choosing one also renames the Field in the
 * navigator while its label still names the old field (changeSignupFieldName).
 * A bound `field` is read-only, as every bound control is upstream.
 */

type FieldOption = { value: string; label: string; description?: string };

const getOptionKey = (option: FieldOption) => `field:${option.value}`;
const getOptionLabel = (option: FieldOption) => option.label;
const getOptionDescription = (option: FieldOption) => option.description;

/**
 * The options for a Field's name: the form's fields in its order, and a
 * current name the form lacks listed first, by its name.
 */
export const getFieldNameOptions = (
  fields: readonly FormField[],
  value: unknown
) => {
  const options: FieldOption[] = fields.map((field) => ({
    value: field.name,
    label: field.label,
    description: field.name,
  }));
  const current = typeof value === "string" ? value.trim() : "";
  let selected = options.find((option) => option.value === current);
  if (selected === undefined && current !== "") {
    selected = { value: current, label: current };
    options.unshift(selected);
  }
  return { options, selected };
};

/** The fields of the form the selected Field's closest Signup Form uses. */
const useRootFields = () => {
  const selector = useStore($selectedInstanceSelector);
  const instances = useStore($instances);
  const propValues = useStore($propValuesByInstanceSelector);
  const rootSelector =
    selector === undefined
      ? undefined
      : findSignupFormRoot(selector, instances);
  const rootProps =
    rootSelector === undefined
      ? undefined
      : propValues.get(getInstanceKey(rootSelector));
  return (
    resolveSignupForm(rootProps?.get("record"), rootProps?.get("data"))
      .fields ?? []
  );
};

export const FieldNameControl = ({
  instanceId,
  meta,
  prop,
  propName,
  computedValue,
  onChange,
}: ControlProps<"text">) => {
  const id = useId();
  const fields = useRootFields();
  const { options, selected } = getFieldNameOptions(fields, computedValue);
  const label = humanizeAttribute(meta.label || propName);
  const binding = useBindableControl({
    boundExpression: prop?.type === "expression" ? prop : undefined,
    fallbackExpression: JSON.stringify(computedValue),
  });

  return (
    <VerticalLayout
      label={
        <PropertyLabel
          name={propName}
          readOnly={binding.bindingState.overwritable === false}
        />
      }
    >
      <BindableExpressionControl
        {...binding}
        value={selected}
        validate={(value) => validatePrimitiveValue(value, label)}
        onChangeValue={(option) => {
          if (option !== undefined) {
            void changeSignupFieldName(instanceId, option.value, fields);
          }
        }}
        onChangeExpression={(value) => onChange({ type: "expression", value })}
        onRemove={(value) =>
          onChange({
            type: "string",
            value: typeof value === "string" ? value : "",
          })
        }
        renderControl={({ value, readOnly, onChangeValue }) => (
          <Select
            fullWidth
            id={id}
            disabled={readOnly}
            value={value}
            placeholder="Select a field"
            options={options}
            getLabel={getOptionLabel}
            getValue={getOptionKey}
            getDescription={getOptionDescription}
            getItemProps={(option) => ({ textValue: option.label })}
            onChange={onChangeValue}
          />
        )}
      />
    </VerticalLayout>
  );
};
