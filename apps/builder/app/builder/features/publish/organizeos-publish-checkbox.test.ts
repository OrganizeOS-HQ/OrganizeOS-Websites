import { describe, expect, test } from "vitest";
import { BRAND_ACCENT, tickedCheckboxCss } from "./organizeos-publish-checkbox";

describe("tickedCheckboxCss", () => {
  test("fills only the checked state with the accent and a light check mark", () => {
    expect(Object.keys(tickedCheckboxCss)).toEqual(
      expect.arrayContaining(['&[data-state="checked"]'])
    );
    for (const selector of Object.keys(tickedCheckboxCss)) {
      expect(selector.startsWith('&[data-state="checked"]')).toBe(true);
    }
    expect(tickedCheckboxCss['&[data-state="checked"]']).toMatchObject({
      background: BRAND_ACCENT,
      color: "#ffffff",
    });
  });
});
