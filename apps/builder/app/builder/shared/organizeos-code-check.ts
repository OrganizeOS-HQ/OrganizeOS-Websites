import type { Diagnostic } from "@webstudio-is/expression";
import type { Resource } from "@webstudio-is/sdk";
import {
  checkResource,
  checkResourceName,
  checkValueExpression,
} from "@organizeos/site-components/org-script";

/**
 * OrganizeOS fork: input validation for expressions in the builder's editors
 * (code-check.ts in @organizeos/site-components). When lint finds no error
 * and the expression is not empty, the check's reason is one more error, in
 * the same slot, so a refused value is never saved.
 */
export const withCodeCheckDiagnostic = (
  expression: string,
  diagnostics: Diagnostic[]
): Diagnostic[] => {
  if (
    expression.trim() === "" ||
    diagnostics.some((diagnostic) => diagnostic.severity === "error")
  ) {
    return diagnostics;
  }
  const check = checkValueExpression(expression);
  if (check.ok) {
    return diagnostics;
  }
  return [
    ...diagnostics,
    {
      from: 0,
      to: expression.length,
      severity: "error",
      message: check.reason,
    },
  ];
};

/**
 * OrganizeOS fork: the same check for an editor that counts error messages
 * (the binding popover): when lint found no error and the expression is not
 * empty, the check's reason is one more error.
 */
export const withCodeCheckError = (
  expression: string,
  errors: string[]
): string[] => {
  if (expression.trim() === "" || errors.length > 0) {
    return errors;
  }
  const check = checkValueExpression(expression);
  return check.ok ? errors : [...errors, check.reason];
};

/**
 * OrganizeOS fork: the reason a resource header or search parameter name
 * fails input validation; a new, empty row is left out when saved.
 */
export const nameCheckError = (
  kind: "header" | "searchParam",
  name: string
) => {
  const check = checkResourceName(kind, name);
  return name.trim() === "" || check.ok ? undefined : check.reason;
};

/**
 * OrganizeOS fork: whether a resource the variable dialog is about to save
 * fails input validation; a refused resource is not saved.
 */
export const resourceFailsCodeCheck = (
  fields: Pick<Resource, "url" | "headers"> &
    Partial<Pick<Resource, "searchParams" | "body">>
) => checkResource(fields as Resource) !== undefined;
