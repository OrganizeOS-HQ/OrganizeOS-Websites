import type { Diagnostic } from "@webstudio-is/sdk";
import { checkValueExpression } from "@organizeos/site-components/org-script";

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
