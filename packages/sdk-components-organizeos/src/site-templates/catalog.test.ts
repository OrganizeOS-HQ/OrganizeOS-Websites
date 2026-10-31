import { describe, expect, test } from "vitest";
import { BLANK_CANONICAL_VALUES } from "./canonical-variables";
import { SITE_TEMPLATES, listedTemplates } from "./catalog";
import { checkSiteTemplate } from "./check";
import { spikeTemplate } from "./__fixtures__/spike";
import type { SiteTemplate, TemplateCategory } from "./types";

describe("the catalog", () => {
  // The spike is a fixture, not an entry; holding it to the check keeps the
  // apply tests and the preview tool working from a template that is valid.
  test("every catalog template and the spike fixture pass their check and have a unique id", () => {
    const templates = [...SITE_TEMPLATES, spikeTemplate];
    for (const template of templates) {
      expect(checkSiteTemplate(template), template.id).toEqual([]);
    }
    const ids = templates.map((template) => template.id);
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
