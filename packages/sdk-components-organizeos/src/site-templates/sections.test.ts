import { describe, expect, test } from "vitest";
import { SECTION_LABELS, isSectionLabel } from "./sections";

describe("SECTION_LABELS", () => {
  test("holds the section vocabulary, its short forms, Nav and Footer", () => {
    expect([...SECTION_LABELS].sort()).toEqual(
      [
        "Page header",
        "Hero",
        "About",
        "Mission and values",
        "Spotlight",
        "Stats",
        "Issues or programs",
        "Team or leadership",
        "FAQ",
        "Resources",
        "Endorsements and testimonials",
        "Updates or news",
        "Logo wall",
        "Events",
        "Sign-up",
        "Call to action band",
        "Volunteer opportunities",
        "Donate",
        "Join or become a member",
        "Shop",
        "Contact",
        // short forms
        "Issues",
        "Programs",
        "Team",
        "Leadership",
        "Endorsements",
        "Testimonials",
        "Updates",
        "News",
        "Join",
        "Nav",
        "Footer",
      ].sort()
    );
  });
});

describe("isSectionLabel", () => {
  test.each(SECTION_LABELS)("%s is a section label", (label) => {
    expect(isSectionLabel(label)).toBe(true);
  });

  test.each(["Hero: Split", "Nav: Centered", "Events: Featured", "FAQ: Two"])(
    "a variant after a colon, %s, is a section label",
    (label) => {
      expect(isSectionLabel(label)).toBe(true);
    }
  );

  test.each([
    "",
    "Banner",
    "Heroic",
    "hero",
    "Hero:Split",
    "Hero Split",
    "Hero - Split",
    "Split: Hero",
    "Events or news",
  ])("%s is not a section label", (label) => {
    expect(isSectionLabel(label)).toBe(false);
  });
});
