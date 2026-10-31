import { describe, expect, test } from "vitest";
import { approvedPalettes } from "../../__fixtures__/approved-palettes";
import { checkSiteTemplate } from "../../check";
import { SITE_TEMPLATES } from "../../catalog";
import { fieldJournalTemplate } from "./index";
import evening from "./palettes/evening.json";

describe("Field Journal", () => {
  test("is in the catalog as a draft", () => {
    expect(SITE_TEMPLATES).toContain(fieldJournalTemplate);
    expect(fieldJournalTemplate.status).toBe("draft");
  });

  test("has the approved board's palette", () => {
    const board = approvedPalettes.find(
      (palette) => palette.name === "Field Journal"
    );
    expect(board).toBeDefined();
    expect(fieldJournalTemplate.variables).toMatchObject(board?.colors ?? {});
  });

  // The alternate palette the owner reviews beside the board's: the same
  // fonts, held to the same contrast rules.
  test("its evening palette keeps the fonts and passes the check", () => {
    expect(evening["font-heading"]).toBe(
      fieldJournalTemplate.variables["font-heading"]
    );
    expect(evening["font-body"]).toBe(
      fieldJournalTemplate.variables["font-body"]
    );
    expect(
      checkSiteTemplate({ ...fieldJournalTemplate, variables: evening })
    ).toEqual([]);
  });
});
