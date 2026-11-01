import { describe, expect, test } from "vitest";
import { toValue } from "@webstudio-is/css-engine";
import type { WebstudioFragment } from "@webstudio-is/sdk";
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

/** An instance's own declarations of `property` at the base breakpoint, in `state`. */
const declared = (
  fragment: WebstudioFragment,
  instanceId: string,
  property: string,
  state?: string
) => {
  const base = fragment.breakpoints.find(
    (breakpoint) =>
      breakpoint.minWidth === undefined && breakpoint.maxWidth === undefined
  );
  const sources =
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instanceId
    )?.values ?? [];
  return fragment.styles
    .filter(
      (decl) =>
        decl.breakpointId === base?.id &&
        decl.state === state &&
        decl.property === property &&
        sources.includes(decl.styleSourceId)
    )
    .map((decl) => toValue(decl.value))
    .at(-1);
};

/**
 * What a colour value comes to on an instance at the base breakpoint: a
 * band variable (`--focus-ring`, `--accent-text`) as the nearest of the
 * instance and its ancestors sets it, or its fallback when none does; a
 * canonical variable as itself.
 */
const resolveColour = (
  fragment: WebstudioFragment,
  instanceId: string,
  value: string
): string => {
  const match = /^var\(--([\w-]+)(?:,\s*(.+))?\)$/.exec(value);
  if (match === null) {
    return value;
  }
  const [, name, fallback] = match;
  if (name !== "focus-ring" && name !== "accent-text") {
    return `var(--${name})`;
  }
  const parents = new Map(
    fragment.instances.flatMap((instance) =>
      instance.children.flatMap((child) =>
        child.type === "id" ? [[child.value, instance.id] as const] : []
      )
    )
  );
  for (
    let id: string | undefined = instanceId;
    id !== undefined;
    id = parents.get(id)
  ) {
    const set = declared(fragment, id, `--${name}`);
    if (set !== undefined) {
      return resolveColour(fragment, id, set);
    }
  }
  return fallback === undefined
    ? value
    : resolveColour(fragment, instanceId, fallback);
};

describe("Marigold Marquee", () => {
  test("is in the catalog, listed", () => {
    expect(SITE_TEMPLATES).toContain(marigoldMarqueeTemplate);
    expect(marigoldMarqueeTemplate.status).toBe("listed");
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

  // The sign-up section is an ink band, which rings focus and sets accent
  // text in its base colour; the form sits in a base-coloured panel, where
  // those would vanish, so the panel sets them back to accent-2.
  test("the sign-up form rings focus and sets accent text in accent-2 on every page with it", () => {
    const pages = render().filter((page) =>
      page.placements.some(
        (placement) =>
          placement.key === "@organizeos/site-components:SignupForm"
      )
    );
    expect(pages.map((page) => page.key)).toEqual(["home", "volunteer"]);
    for (const { key, fragment } of pages) {
      const submit = fragment.instances.find((instance) =>
        instance.component.endsWith(":SubmitButton")
      )!;
      const ring = declared(
        fragment,
        submit.id,
        "outlineColor",
        ":focus-visible"
      )!;
      expect(resolveColour(fragment, submit.id, ring), key).toBe(
        "var(--accent-2)"
      );
      for (const variable of ["var(--focus-ring)", "var(--accent-text)"]) {
        expect(resolveColour(fragment, submit.id, variable), key).toBe(
          "var(--accent-2)"
        );
      }
    }
  });

  // The quote cards' large quotation mark is decoration: the words are in a
  // blockquote.
  test("a screen reader skips each quote card's quotation mark", () => {
    const { fragment } = render().find((page) => page.key === "endorsements")!;
    const marks = fragment.instances.filter(
      (instance) => instance.label === "Mark"
    );
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      expect(
        fragment.props.find(
          (prop) => prop.instanceId === mark.id && prop.name === "aria-hidden"
        )
      ).toMatchObject({ type: "string", value: "true" });
    }
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
