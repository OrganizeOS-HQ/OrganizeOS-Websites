import { expect, test } from "vitest";
import fonts from "../__fixtures__/give-embed-fonts.json";
import messages from "../__fixtures__/give-embed-messages.json";
import { SITE_TEMPLATES } from "../site-templates/catalog";
import {
  GIVE_DONE_TYPE,
  GIVE_EMBED_PATH,
  GIVE_HEIGHT_TYPE,
  GIVE_PLACEHOLDER_HEIGHT,
  GIVE_QUERY_KEYS,
  GIVE_THEME_KEY,
} from "./contract";

// The give embed's frozen contract (OrganizeOS builder donations spec
// 2026-11-13, 5.1, 5.6 and W8), copied unchanged from the platform's
// client/tests/fixtures/site-components/give-embed-messages.json.
test("the constants are the fixture's", () => {
  expect(messages.address).toBe(`${GIVE_EMBED_PATH}/{orgId}`);
  expect(messages.query).toEqual([...GIVE_QUERY_KEYS]);
  expect(messages.fragment).toBe(GIVE_THEME_KEY);
  expect(messages.messages.height.type).toBe(GIVE_HEIGHT_TYPE);
  expect(messages.messages.done.type).toBe(GIVE_DONE_TYPE);
  expect(messages.messages.height.height).toBe(GIVE_PLACEHOLDER_HEIGHT);
});

// The frame self-hosts the families in give-embed-fonts.json and refuses any
// other, so a family a template ships must be added there first.
test("every template font is one the frame serves", () => {
  const families = SITE_TEMPLATES.flatMap((template) =>
    Object.values(template.fonts).map((font) => font.family)
  );
  expect(families.length).toBeGreaterThan(0);
  for (const family of families) {
    expect(fonts.families, family).toContain(family);
  }
});
