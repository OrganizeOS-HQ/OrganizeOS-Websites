import { describe, expect, test } from "vitest";
import { approvedPalettes } from "../../__fixtures__/approved-palettes";
import { checkSiteTemplate } from "../../check";
import { SITE_TEMPLATES } from "../../catalog";
import { porchLightTemplate } from "./index";
import night from "./palettes/night.json";

describe("Porch Light", () => {
  test("is in the catalog as a draft", () => {
    expect(SITE_TEMPLATES).toContain(porchLightTemplate);
    expect(porchLightTemplate.status).toBe("draft");
  });

  test("has the approved board's palette", () => {
    const board = approvedPalettes.find(
      (palette) => palette.name === "Porch Light"
    );
    expect(board).toBeDefined();
    expect(porchLightTemplate.variables).toMatchObject(board?.colors ?? {});
  });

  test("has the five pages of spec 5.1, Home first", () => {
    expect(porchLightTemplate.pages.map((page) => page.name)).toEqual([
      "Home",
      "About",
      "Events",
      "Get involved",
      "Contact",
    ]);
  });

  // The alternate palette the owner reviews beside the board's: the same
  // fonts, held to the same contrast rules.
  test("its night palette keeps the fonts and passes the check", () => {
    expect(night["font-heading"]).toBe(
      porchLightTemplate.variables["font-heading"]
    );
    expect(night["font-body"]).toBe(porchLightTemplate.variables["font-body"]);
    expect(
      checkSiteTemplate({ ...porchLightTemplate, variables: night })
    ).toEqual([]);
  });
});
