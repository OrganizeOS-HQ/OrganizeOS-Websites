import { describe, expect, test } from "vitest";
import { approvedPalettes } from "../../__fixtures__/approved-palettes";
import { contrastRatio, type CanonicalValues } from "../../canonical-variables";
import { checkSiteTemplate } from "../../check";
import { SITE_TEMPLATES } from "../../catalog";
import { renderSiteTemplate } from "../../render";
import { marigoldMarqueeTemplate } from "./index";
import matinee from "./palettes/matinee.json";

const render = () => {
  let count = 0;
  return renderSiteTemplate(marigoldMarqueeTemplate, {
    assetIds: new Map(
      Object.keys(marigoldMarqueeTemplate.images).map((file) => [file, file])
    ),
    generatePageId: () => {
      count += 1;
      return `page:${count}`;
    },
  });
};

describe("Marigold Marquee", () => {
  test("is in the catalog as a draft", () => {
    expect(SITE_TEMPLATES).toContain(marigoldMarqueeTemplate);
    expect(marigoldMarqueeTemplate.status).toBe("draft");
  });

  test("has the approved board's palette", () => {
    const board = approvedPalettes.find(
      (palette) => palette.name === "Marigold Marquee"
    );
    expect(board).toBeDefined();
    expect(marigoldMarqueeTemplate.variables).toMatchObject(
      board?.colors ?? {}
    );
  });

  // Donate is the platform's /donate, a link, until the Donation block.
  test("has the pages of spec 5.1, Home first, and no Donate page", () => {
    expect(marigoldMarqueeTemplate.pages.map((page) => page.name)).toEqual([
      "Home",
      "Issues",
      "About",
      "Endorsements",
      "Volunteer",
      "Events",
    ]);
  });

  // Directions section 3, change 2: Home features the next event, and the
  // Event List is the Events page's alone.
  test("Home places one Event Card, and the Events page one Event List", () => {
    const placed = Object.fromEntries(
      render().map((page) => [
        page.key,
        page.placements.map((placement) => placement.key),
      ])
    );
    expect(placed.home).toEqual([
      "@organizeos/site-components:EventCard",
      "@organizeos/site-components:SignupForm",
    ]);
    expect(placed.events).toEqual(["@organizeos/site-components:EventList"]);
  });

  // Mint sets links, eyebrows and the event dates on the base, so it is
  // held to text's 4.5:1 there, not only the check's 3:1 for a ring.
  test.each([
    ["the board's", marigoldMarqueeTemplate.variables],
    ["the matinee", matinee as CanonicalValues],
  ])("mint reads as text on the base in %s palette", (_name, variables) => {
    expect(
      contrastRatio(variables["accent-2"], variables.base)
    ).toBeGreaterThanOrEqual(4.5);
  });

  // The alternate palette the owner reviews beside the board's: a light
  // variant of the same hues, with the same fonts, held to the same rules.
  test("its matinee palette is light, keeps the fonts and passes the check", () => {
    expect(matinee["font-heading"]).toBe(
      marigoldMarqueeTemplate.variables["font-heading"]
    );
    expect(matinee["font-body"]).toBe(
      marigoldMarqueeTemplate.variables["font-body"]
    );
    expect(contrastRatio(matinee.base, "#FFFFFF")).toBeLessThan(1.2);
    expect(
      checkSiteTemplate({ ...marigoldMarqueeTemplate, variables: matinee })
    ).toEqual([]);
  });
});
