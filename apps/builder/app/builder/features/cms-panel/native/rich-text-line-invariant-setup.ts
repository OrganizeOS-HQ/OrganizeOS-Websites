// The net: every test in the rich-text projects ends with the harness
// invariant of the fields it mounted.
import { afterEach } from "vitest";
import { fieldInvariantFailures } from "./rich-text-field-watch";

afterEach(() => {
  const failures = fieldInvariantFailures(true);
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
});
