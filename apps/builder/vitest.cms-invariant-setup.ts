// Every browser test of the CMS panels ends with the field's harness
// invariant (rich-text-field-watch.ts).
import { afterEach } from "vitest";
import { fieldInvariantFailures } from "./app/builder/features/cms-panel/native/rich-text-field-watch";

afterEach(() => {
  const failures = fieldInvariantFailures(true);
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
});
