import { describe, expect, test } from "vitest";
import { toValue } from "@webstudio-is/css-engine";
import type { Instance, WebstudioFragment } from "@webstudio-is/sdk";
import { approvedPalettes } from "../../__fixtures__/approved-palettes";
import { checkSiteTemplate } from "../../check";
import { SITE_TEMPLATES } from "../../catalog";
import { renderSiteTemplate } from "../../render";
import { workwearTemplate } from "./index";
import nightShift from "./palettes/night-shift.json";

/** An instance's own declarations with no state, by property, any width. */
const ownStyles = (fragment: WebstudioFragment, instance: Instance) => {
  const sources =
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instance.id
    )?.values ?? [];
  return Object.fromEntries(
    fragment.styles
      .filter(
        (decl) =>
          decl.state === undefined && sources.includes(decl.styleSourceId)
      )
      .map((decl) => [decl.property, toValue(decl.value)])
  );
};

describe("Workwear", () => {
  test("is in the catalog, listed", () => {
    expect(SITE_TEMPLATES).toContain(workwearTemplate);
    expect(workwearTemplate.status).toBe("listed");
  });

  test("has the approved board's palette", () => {
    const board = approvedPalettes.find(
      (palette) => palette.name === "Workwear"
    );
    expect(board).toBeDefined();
    expect(workwearTemplate.variables).toMatchObject(board?.colors ?? {});
  });

  test("has the six pages of spec 5.1, Home first, and no Updates", () => {
    expect(workwearTemplate.pages.map((page) => page.name)).toEqual([
      "Home",
      "About",
      "Know your rights",
      "Join",
      "Events",
      "Contact",
    ]);
  });

  // The platform serves memberships at /join on the site's own host, so a
  // page of the template there would never show.
  test("the Join page is not at the platform's /join", () => {
    const join = workwearTemplate.pages.find((page) => page.key === "join");
    expect(join?.path).toBe("/join-us");
  });

  // The photo is greyed, but the denim field behind it, which shows when the
  // photo is gone, is not.
  test("a photo slot greys its photo and keeps its accent-1 field", () => {
    const pages = renderSiteTemplate(workwearTemplate, {
      assetIds: new Map(
        Object.keys(workwearTemplate.images).map((file) => [file, file])
      ),
      generatePageId: () => "page",
    });
    const { fragment } = pages.find((page) => page.key === "about")!;
    const imageId = fragment.props.find(
      (prop) =>
        prop.name === "src" &&
        prop.type === "asset" &&
        prop.value === "about.jpg"
    )?.instanceId;
    const image = fragment.instances.find(
      (instance) => instance.id === imageId
    )!;
    const field = fragment.instances.find((instance) =>
      instance.children.some(
        (child) => child.type === "id" && child.value === imageId
      )
    )!;
    expect(ownStyles(fragment, image)).toMatchObject({
      filter: "grayscale(1)",
    });
    expect(ownStyles(fragment, image)).not.toHaveProperty("backgroundColor");
    expect(ownStyles(fragment, field)).toMatchObject({
      backgroundColor: "var(--accent-1)",
    });
    expect(ownStyles(fragment, field)).not.toHaveProperty("filter");
  });

  // The alternate palette the owner reviews beside the board's: the same
  // fonts, held to the same contrast rules.
  test("its night-shift palette keeps the fonts and passes the check", () => {
    expect(nightShift["font-heading"]).toBe(
      workwearTemplate.variables["font-heading"]
    );
    expect(nightShift["font-body"]).toBe(
      workwearTemplate.variables["font-body"]
    );
    expect(
      checkSiteTemplate({ ...workwearTemplate, variables: nightShift })
    ).toEqual([]);
  });
});
