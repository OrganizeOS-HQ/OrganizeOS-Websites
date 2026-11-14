import { describe, expect, test } from "vitest";
import { SITE_TEMPLATES } from "../site-templates/catalog";
import { STARTER_PAGES, listedStarterPages } from "./catalog";
import { checkStarterPage } from "./check";
import { NEUTRAL_LOOK } from "./look";
import type { StarterPage } from "./types";
import { sampleStarterPage } from "./__fixtures__/sample";

const looks = [
  NEUTRAL_LOOK,
  ...SITE_TEMPLATES.map((template) => template.look),
];

describe("the starter-page catalog", () => {
  // A plain loop, so the catalog may be empty (test.each refuses an empty list)
  test("every catalog page passes, under every look", () => {
    for (const page of STARTER_PAGES) {
      expect(checkStarterPage(page, looks), page.id).toEqual([]);
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
