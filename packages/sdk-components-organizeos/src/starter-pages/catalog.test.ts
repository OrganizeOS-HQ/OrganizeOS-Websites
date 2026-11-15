import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { SITE_TEMPLATES } from "../site-templates/catalog";
import { STARTER_PAGES, listedStarterPages } from "./catalog";
import { checkStarterPage } from "./check";
import { NEUTRAL_LOOK } from "./look";
import { renderStarterPage } from "./render";
import type { StarterPage } from "./types";
import { sampleStarterPage } from "./__fixtures__/sample";

const looks = [
  NEUTRAL_LOOK,
  ...SITE_TEMPLATES.map((template) => template.look),
];

describe("the starter-page catalog", () => {
  // One test each: a check renders a page under six looks, which outgrows
  // the time one test is given when the catalog is checked whole.
  test.each(STARTER_PAGES.map((page) => [page.id, page] as const))(
    "%s passes its check, under every look",
    (_id, page) => {
      expect(checkStarterPage(page, looks)).toEqual([]);
    }
  );

  test("the catalog holds the eight in order, all drafts", () => {
    expect(STARTER_PAGES.map((page) => [page.id, page.status])).toEqual([
      ["events", "draft"],
      ["event", "draft"],
      ["donate", "draft"],
      ["fundraiser", "draft"],
      ["join", "draft"],
      ["volunteer", "draft"],
      ["about", "draft"],
      ["contact", "draft"],
    ]);
  });

  test("every in-page link has its target", () => {
    for (const page of STARTER_PAGES) {
      const { fragment } = renderStarterPage(page, {
        look: NEUTRAL_LOOK,
        generatePageId: () => "page",
      });
      const ids = new Set(
        fragment.props.flatMap((prop) =>
          prop.name === "id" && prop.type === "string" ? [prop.value] : []
        )
      );
      for (const prop of fragment.props) {
        if (
          prop.name === "href" &&
          prop.type === "string" &&
          prop.value.startsWith("#")
        ) {
          expect(
            ids.has(prop.value.slice(1)),
            `${page.id}: ${prop.value}`
          ).toBe(true);
        }
      }
    }
  });

  // A picture OrganizeOS generated records the script that made it, by its
  // path from this folder, so the picture can be made again.
  test("a generated picture's source names its script, which exists", () => {
    const folder = dirname(fileURLToPath(import.meta.url));
    const generated = STARTER_PAGES.flatMap((page) =>
      Object.values(page.images).filter(({ sourceUrl }) =>
        sourceUrl.startsWith("organizeos:generated/")
      )
    );
    expect(generated.length).toBeGreaterThan(0);
    for (const page of STARTER_PAGES) {
      for (const [file, { sourceUrl }] of Object.entries(page.images)) {
        if (sourceUrl.startsWith("organizeos:generated/") === false) {
          continue;
        }
        const script = sourceUrl.slice("organizeos:generated/".length);
        expect(
          existsSync(join(folder, script)),
          `${page.id}/${file}: ${script}`
        ).toBe(true);
      }
    }
  });

  test("ids are unique", () => {
    const ids = STARTER_PAGES.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("listedStarterPages keeps listed ones in order", () => {
    const entry = (id: string, status: StarterPage["status"]): StarterPage => ({
      ...sampleStarterPage,
      id,
      status,
    });
    expect(
      listedStarterPages([
        entry("b", "listed"),
        entry("a", "draft"),
        entry("c", "listed"),
      ]).map((page) => page.id)
    ).toEqual(["b", "c"]);
  });
});
