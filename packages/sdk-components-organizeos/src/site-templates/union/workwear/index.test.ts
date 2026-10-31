import { describe, expect, test } from "vitest";
import { approvedPalettes } from "../../__fixtures__/approved-palettes";
import { checkSiteTemplate } from "../../check";
import { SITE_TEMPLATES } from "../../catalog";
import { workwearTemplate } from "./index";
import nightShift from "./palettes/night-shift.json";

describe("Workwear", () => {
  test("is in the catalog as a draft", () => {
    expect(SITE_TEMPLATES).toContain(workwearTemplate);
    expect(workwearTemplate.status).toBe("draft");
  });

  test("has the approved board's palette", () => {
    const board = approvedPalettes.find(
      (palette) => palette.name === "Workwear"
    );
    expect(board).toBeDefined();
    expect(workwearTemplate.variables).toMatchObject(board?.colors ?? {});
  });

  test("has the six pages of spec 5.1, Home first, and no Updates", () => {
    expect(workwearTemplate.pages.map((page) => page.name)).toEqual([
      "Home",
      "About",
      "Know your rights",
      "Join",
      "Events",
      "Contact",
    ]);
  });

  // The platform serves memberships at /join on the site's own host, so a
  // page of the template there would never show.
  test("the Join page is not at the platform's /join", () => {
    const join = workwearTemplate.pages.find((page) => page.key === "join");
    expect(join?.path).toBe("/join-us");
  });

  // The alternate palette the owner reviews beside the board's: the same
  // fonts, held to the same contrast rules.
  test("its night-shift palette keeps the fonts and passes the check", () => {
    expect(nightShift["font-heading"]).toBe(
      workwearTemplate.variables["font-heading"]
    );
    expect(nightShift["font-body"]).toBe(
      workwearTemplate.variables["font-body"]
    );
    expect(
      checkSiteTemplate({ ...workwearTemplate, variables: nightShift })
    ).toEqual([]);
  });
});
