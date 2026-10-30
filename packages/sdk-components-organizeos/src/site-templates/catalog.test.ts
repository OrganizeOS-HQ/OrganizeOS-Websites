import { describe, expect, test } from "vitest";
import { BLANK_CANONICAL_VALUES } from "./canonical-variables";
import { SITE_TEMPLATES, listedTemplates } from "./catalog";
import { checkSiteTemplate } from "./check";
import type { SiteTemplate, TemplateCategory } from "./types";

describe("the catalog", () => {
  test("every catalog template passes its check and has a unique id", () => {
    for (const template of SITE_TEMPLATES) {
      expect(checkSiteTemplate(template), template.id).toEqual([]);
    }
    const ids = SITE_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("listedTemplates keeps the listed ones, in category order", () => {
    const entry = (
      id: string,
      category: TemplateCategory,
      status: SiteTemplate["status"]
    ): SiteTemplate => ({
      id,
      category,
      name: id,
      oneLine: id,
      styleTags: [],
      status,
      dependsOn: [],
      thumbnail: `/${id}.jpg`,
      variables: BLANK_CANONICAL_VALUES,
      images: {},
      pages: [],
    });
    const templates = [
      entry("union-a", "union", "listed"),
      entry("nonprofit-draft", "nonprofit", "draft"),
      entry("foundation", "foundation", "listed"),
      entry("union-b", "union", "listed"),
      entry("nonprofit", "nonprofit", "listed"),
    ];
    expect(listedTemplates(templates).map((template) => template.id)).toEqual([
      "nonprofit",
      "union-a",
      "union-b",
      "foundation",
    ]);
  });
});
