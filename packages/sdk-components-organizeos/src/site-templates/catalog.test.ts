import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { BLANK_CANONICAL_VALUES } from "./canonical-variables";
import { SITE_TEMPLATES, listedTemplates } from "./catalog";
import { checkSiteTemplate } from "./check";
import { spikeTemplate } from "./__fixtures__/spike";
import type { SiteTemplate, TemplateCategory } from "./types";

describe("the catalog", () => {
  // The spike is a fixture, not an entry; holding it to the check keeps the
  // apply tests and the preview tool working from a template that is valid.
  const templates = [...SITE_TEMPLATES, spikeTemplate];

  // One test each: a check renders every page of its template, about a
  // second apiece, so one test over the whole catalog outgrows the time a
  // test is given as templates join it.
  test.each(templates.map((template) => [template.id, template] as const))(
    "%s passes its check",
    (_id, template) => {
      expect(checkSiteTemplate(template)).toEqual([]);
    }
  );

  // An image OrganizeOS generated records the script that made it, by its
  // path from this folder, so the image can be made again.
  test("a generated image's source names its script, which exists", () => {
    const folder = dirname(fileURLToPath(import.meta.url));
    const generated = templates.flatMap((template) =>
      Object.entries(template.images).flatMap(([file, { sourceUrl }]) =>
        sourceUrl.startsWith("organizeos:generated/")
          ? [{ image: `${template.id}/${file}`, sourceUrl }]
          : []
      )
    );
    expect(generated.length).toBeGreaterThan(0);
    for (const { image, sourceUrl } of generated) {
      const script = sourceUrl.slice("organizeos:generated/".length);
      expect(existsSync(join(folder, script)), `${image}: ${script}`).toBe(
        true
      );
    }
  });

  test("every catalog template and the spike fixture have a unique id", () => {
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
      pagePictures: {},
      look: {
        buttonRadius: "6px",
        buttonWeight: 600,
        headingWeight: 700,
        navNameSize: "20px",
        footerNameSize: "20px",
      },
      variables: BLANK_CANONICAL_VALUES,
      images: {},
      fonts: {},
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
