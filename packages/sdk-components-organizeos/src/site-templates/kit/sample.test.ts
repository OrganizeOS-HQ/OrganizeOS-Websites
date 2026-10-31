import { describe, expect, test } from "vitest";
import { sample } from "./index";

describe("sample", () => {
  test("keeps each [bracketed] placeholder on one line with no-break spaces", () => {
    expect(
      sample("Help [Organization name] reach [your goal] by [date].")
    ).toBe("Help [Organization\u00A0name] reach [your\u00A0goal] by [date].");
  });

  test("leaves the words outside brackets free to wrap", () => {
    expect(sample("Say in one sentence what you do")).toBe(
      "Say in one sentence what you do"
    );
  });

  test("is idempotent, so text passed through twice is unchanged", () => {
    const once = sample("[Organization name] meets on [day]");
    expect(sample(once)).toBe(once);
  });
});
