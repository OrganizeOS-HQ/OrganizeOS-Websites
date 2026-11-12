import { useState } from "react";
import {
  Button,
  Flex,
  InputErrorsTooltip,
  InputField,
  Select,
  theme,
} from "@webstudio-is/design-system";
import { toValue, type CssProperty } from "@webstudio-is/css-engine";
import type { VariableType } from "@webstudio-is/project-build";
import type { ComputedStyleDecl } from "~/shared/style-object-model";
import {
  VARIABLE_TYPE_LABELS,
  inferVariableType,
  validateVariableValue,
} from "./value-types";
import { createAndBindVariable } from "./operations";

/** The text a type's field starts with: the row's value, when it fits. */
const prefillOf = (
  type: VariableType,
  styles: readonly ComputedStyleDecl[]
) => {
  const computed = styles[0]?.computedValue;
  if (computed === undefined) {
    return "";
  }
  const text =
    computed.type === "fontFamily"
      ? (computed.value[0] ?? "")
      : toValue(computed);
  return validateVariableValue(type, text).ok ? text : "";
};

const nameErrors = new Set(["Name is required", "Name is too long"]);

/**
 * New variable from this value (spec 6.5): a name, the type when the row
 * takes more than one, and the value, prefilled from the row. Create adds the
 * variable at the end of Site and binds it, in one undo step.
 */
export const NewVariableForm = ({
  properties,
  types,
  styles,
  onDone,
}: {
  properties: readonly CssProperty[];
  types: ReadonlySet<VariableType>;
  styles: readonly ComputedStyleDecl[];
  onDone: () => void;
}) => {
  const typeList = Array.from(types);
  const inferred =
    styles[0] === undefined
      ? undefined
      : inferVariableType(styles[0].computedValue, new Set());
  const [type, setType] = useState<VariableType>(
    inferred !== undefined && types.has(inferred) ? inferred : typeList[0]
  );
  const [name, setName] = useState("");
  const [text, setText] = useState(() => prefillOf(type, styles));
  const [isTextTouched, setIsTextTouched] = useState(false);
  const [error, setError] = useState<{
    field: "name" | "value";
    text: string;
  }>();

  const submit = () => {
    if (name.trim() === "") {
      return;
    }
    const validated = validateVariableValue(type, text);
    if (validated.ok === false) {
      setError({ field: "value", text: validated.error });
      return;
    }
    const result = createAndBindVariable({
      type,
      displayName: name.trim(),
      value: validated.value,
      properties,
    });
    if (result.ok) {
      onDone();
      return;
    }
    setError({
      field: nameErrors.has(result.error) ? "name" : "value",
      text: result.error,
    });
  };

  const errorsOf = (field: "name" | "value") =>
    error?.field === field ? [error.text] : undefined;

  return (
    <Flex direction="column" gap="2" css={{ padding: theme.spacing[5] }}>
      <InputErrorsTooltip errors={errorsOf("name")}>
        <InputField
          autoFocus
          aria-label="Name"
          placeholder="Name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
      </InputErrorsTooltip>
      {typeList.length > 1 && (
        <Select
          aria-label="Type"
          options={typeList}
          value={type}
          getLabel={(item: VariableType) => VARIABLE_TYPE_LABELS[item]}
          onChange={(next: VariableType) => {
            setType(next);
            setError(undefined);
            if (isTextTouched === false) {
              setText(prefillOf(next, styles));
            }
          }}
        />
      )}
      <InputErrorsTooltip errors={errorsOf("value")}>
        <InputField
          aria-label="Value"
          placeholder="Value"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setIsTextTouched(true);
            setError(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
      </InputErrorsTooltip>
      <Button disabled={name.trim() === ""} onClick={submit}>
        Create
      </Button>
    </Flex>
  );
};
