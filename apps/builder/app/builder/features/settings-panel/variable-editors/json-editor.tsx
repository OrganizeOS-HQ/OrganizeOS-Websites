import { VariableEditorLayout } from "./dialog/layout";
import type { VariableEditorProps } from "./shared/editor-types";

import { Row } from "../shared";
import { forwardRef, useEffect, useRef, useState } from "react";
import { Flex, Label, theme } from "@webstudio-is/design-system";
import type { DataSource } from "@webstudio-is/sdk";
import { ExpressionEditor } from "~/builder/shared/expression-editor";
import { validateDataVariableJsonValue } from "@webstudio-is/project-build/runtime";
import { useValuePanelRef } from "./shared/variable-value-save";
import type { PanelApi } from "./shared/variable-panel-api";
import { ValuePreviewFrame } from "./shared/variable-value-preview";
import { parseJsonExpression } from "@webstudio-is/expression";
// OrganizeOS fork: the pause and input validation (docs/ORGANIZEOS-FORK.md section 10)
import {
  checkValueExpression,
  orgScriptMayRun,
  readLiteralValue,
} from "@organizeos/site-components/org-script";

// OrganizeOS fork: while org script is paused, a value must read as data, and
// a value must pass input validation whatever the switch (code-check.ts)
// (docs/ORGANIZEOS-FORK.md section 10)
export const validateJsonValue = (expression: string) => {
  if (
    orgScriptMayRun() === false &&
    expression.trim() !== "" &&
    readLiteralValue(expression) === undefined
  ) {
    return "error";
  }
  if (
    expression.trim() !== "" &&
    checkValueExpression(expression).ok === false
  ) {
    return "error";
  }
  return validateDataVariableJsonValue(expression);
};

export const prepareJsonValue = (previous: unknown) => previous || "{}";

export const JsonForm = forwardRef<
  undefined | PanelApi,
  {
    variable?: DataSource;
    value: unknown;
    onChange: (value: unknown) => void;
  }
>(({ variable, value: unknownValue, onChange }, ref) => {
  const value = typeof unknownValue === "string" ? unknownValue : "";
  const [valueError, setValueError] = useState("");
  const valueRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // OrganizeOS fork: the fork's check (docs/ORGANIZEOS-FORK.md section 10)
    valueRef.current?.setCustomValidity(validateJsonValue(value));
    setValueError("");
  }, [value]);
  useValuePanelRef({ ref, variable, type: "json" });
  return (
    <>
      <input
        ref={valueRef}
        style={{ display: "none" }}
        name="value"
        data-color={valueError ? "error" : undefined}
        value={value}
        onChange={() => {}}
        onInvalid={(event) =>
          setValueError(event.currentTarget.validationMessage)
        }
      />
      <Flex direction="column" css={{ gap: theme.spacing[3] }}>
        <Label>Value</Label>
        <ExpressionEditor
          showLineNumbers
          color={valueError ? "error" : undefined}
          value={value}
          onChange={onChange}
          onChangeComplete={() => valueRef.current?.checkValidity()}
        />
      </Flex>
    </>
  );
});
JsonForm.displayName = "JsonForm";

export const JsonVariablePreview = ({ value }: { value: unknown }) => {
  // OrganizeOS fork: while org script is paused, a stored value is read as
  // data with readLiteralValue (docs/ORGANIZEOS-FORK.md section 10)
  const parsed =
    orgScriptMayRun() === false
      ? readLiteralValue(String(value))?.value
      : parseJsonExpression(String(value));
  return <ValuePreviewFrame value={parsed} />;
};

export const JsonEditor = forwardRef<PanelApi | undefined, VariableEditorProps>(
  (props, ref) => {
    return (
      <VariableEditorLayout
        {...props}
        titleActions={props.titleActions()}
        fields={
          <Row>
            <JsonForm
              ref={ref}
              variable={props.variable}
              value={props.value}
              onChange={props.onValueChange}
            />
          </Row>
        }
        preview={<JsonVariablePreview value={props.value} />}
      />
    );
  }
);
