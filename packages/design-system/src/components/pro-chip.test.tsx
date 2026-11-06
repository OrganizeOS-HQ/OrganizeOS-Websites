import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProChip } from "./pro-chip";

// OrganizeOS fork: plans are org entitlements with no checkout in the builder
// (docs/ORGANIZEOS-FORK.md section 7)
describe("ProChip", () => {
  test("ProChip renders no link", () => {
    const markup = renderToStaticMarkup(<ProChip>Not in plan</ProChip>);
    expect(markup).toMatch(/^<span[ >]/);
    expect(markup).toContain("Not in plan");
    expect(markup).not.toContain("<a");
    expect(markup).not.toContain("href");
    expect(markup).not.toContain("webstudio.is");
  });
});
