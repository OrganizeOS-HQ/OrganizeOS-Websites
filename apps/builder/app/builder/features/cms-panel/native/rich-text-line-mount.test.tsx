// D8: no onChange and no console error on mount and a click over the
// state-space grid, and no undo step for lines made at mount (D7).
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "@vitest/browser/context";
import { getRichTextReadOnlyReason } from "./rich-text-html";
import { click, editable, renderField, settle } from "./rich-text-test-harness";
import { stateSpaceValues } from "./rich-text-line-test-kit";

const editableValues = stateSpaceValues(2).filter(
  (html) => getRichTextReadOnlyReason(html) === undefined
);

describe("D8: mount and a click over the state-space grid", () => {
  test.each(editableValues)(
    "the editable value %s mounts and takes a click with no onChange and no console error",
    async (html) => {
      const errors: string[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        errors.push(args.map(String).join(" "));
      });
      const onChange = await renderField(html);
      await click(editable());
      await settle();
      expect(onChange).not.toHaveBeenCalled();
      expect(
        errors.filter((message) => !message.includes("not wrapped in act"))
      ).toEqual([]);
      for (let press = 0; press < 5; press += 1) {
        await userEvent.keyboard("{Control>}z{/Control}");
      }
      await settle();
      expect(onChange).not.toHaveBeenCalled();
    }
  );
});
