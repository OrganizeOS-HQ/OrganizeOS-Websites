import { describe, expect, test } from "vitest";
import { toValue } from "@webstudio-is/css-engine";
import type { WebstudioFragment } from "@webstudio-is/sdk";
import { approvedPalettes } from "../../__fixtures__/approved-palettes";
import { checkSiteTemplate } from "../../check";
import { SITE_TEMPLATES } from "../../catalog";
import { renderSiteTemplate } from "../../render";
import { porchLightTemplate } from "./index";
import night from "./palettes/night.json";

const render = () => {
  let count = 0;
  return renderSiteTemplate(porchLightTemplate, {
    assetIds: new Map(
      Object.keys(porchLightTemplate.images).map((file) => [file, file])
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

describe("Porch Light", () => {
  test("is in the catalog as a draft", () => {
    expect(SITE_TEMPLATES).toContain(porchLightTemplate);
    expect(porchLightTemplate.status).toBe("draft");
  });

  test("has the approved board's palette", () => {
    const board = approvedPalettes.find(
      (palette) => palette.name === "Porch Light"
    );
    expect(board).toBeDefined();
    expect(porchLightTemplate.variables).toMatchObject(board?.colors ?? {});
  });

  test("has the five pages of spec 5.1, Home first", () => {
    expect(porchLightTemplate.pages.map((page) => page.name)).toEqual([
      "Home",
      "About",
      "Events",
      "Get involved",
      "Contact",
    ]);
  });

  // The sign-up section is a berry band, which rings focus in its base
  // colour; the form sits in a base-coloured panel, where that ring would
  // vanish, so the panel sets the band's variables back to accent-2.
  test("the sign-up button rings focus in accent-2 on every page with the form", () => {
    const pages = render().filter((page) =>
      page.placements.some(
        (placement) =>
          placement.key === "@organizeos/site-components:SignupForm"
      )
    );
    expect(pages.map((page) => page.key)).toEqual([
      "home",
      "events",
      "get-involved",
    ]);
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
      expect(ring, key).toBe("var(--focus-ring, var(--accent-2))");
      expect(resolveColour(fragment, submit.id, ring), key).toBe(
        "var(--accent-2)"
      );
      expect(
        resolveColour(fragment, submit.id, "var(--accent-text)"),
        key
      ).toBe("var(--accent-2)");
    }
  });

  // The alternate palette the owner reviews beside the board's: the same
  // fonts, held to the same contrast rules.
  test("its night palette keeps the fonts and passes the check", () => {
    expect(night["font-heading"]).toBe(
      porchLightTemplate.variables["font-heading"]
    );
    expect(night["font-body"]).toBe(porchLightTemplate.variables["font-body"]);
    expect(
      checkSiteTemplate({ ...porchLightTemplate, variables: night })
    ).toEqual([]);
  });
});
