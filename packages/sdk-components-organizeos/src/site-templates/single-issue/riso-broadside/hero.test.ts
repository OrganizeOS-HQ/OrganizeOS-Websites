import { describe, expect, test } from "vitest";
import { toValue } from "@webstudio-is/css-engine";
import type { Instance, WebstudioFragment } from "@webstudio-is/sdk";
import { contrastRatio } from "../../canonical-variables";
import { renderSiteTemplate } from "../../render";
import { risoBroadsideTemplate } from "./index";
import nightPress from "./palettes/night-press.json";

const renderHome = () => {
  const [home] = renderSiteTemplate(risoBroadsideTemplate, {
    assetIds: new Map(
      Object.keys(risoBroadsideTemplate.images).map((file) => [file, file])
    ),
    generatePageId: () => "home",
  });
  return home.fragment;
};

const byLabel = (fragment: WebstudioFragment, label: string): Instance => {
  const instance = fragment.instances.find((item) => item.label === label);
  if (instance === undefined) {
    throw new Error(`No instance is labelled "${label}"`);
  }
  return instance;
};

const childLabels = (fragment: WebstudioFragment, parent: Instance) =>
  parent.children.flatMap((child) =>
    child.type === "id"
      ? [fragment.instances.find((item) => item.id === child.value)?.label]
      : []
  );

/** An instance's own declarations at the base breakpoint, with no state. */
const baseStyles = (fragment: WebstudioFragment, instance: Instance) => {
  const base = fragment.breakpoints.find(
    (breakpoint) =>
      breakpoint.minWidth === undefined && breakpoint.maxWidth === undefined
  );
  const sources =
    fragment.styleSourceSelections.find(
      (selection) => selection.instanceId === instance.id
    )?.values ?? [];
  return Object.fromEntries(
    fragment.styles
      .filter(
        (decl) =>
          decl.breakpointId === base?.id &&
          decl.state === undefined &&
          sources.includes(decl.styleSourceId)
      )
      .map((decl) => [decl.property, toValue(decl.value)])
  );
};

const hex = (channels: number[]) =>
  `#${channels.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

const channels = (color: string) =>
  [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255);

describe("Riso Broadside's hero", () => {
  // The model the contrast test below works from, as the page draws it: the
  // section isolated on accent-1; inside "Duotone", which makes no stacking
  // context of its own, the text colour lightened over it, the photo in
  // greys multiplied, the darker of the two colours screened and the
  // lighter darkened over all. A changed blend mode fails here.
  test("draws the duotone the contrast model assumes", () => {
    const fragment = renderHome();
    const hero = byLabel(fragment, "Hero: Full-bleed image");
    expect(baseStyles(fragment, hero)).toMatchObject({
      backgroundColor: "var(--accent-1)",
      isolation: "isolate",
    });
    const duotone = byLabel(fragment, "Duotone");
    expect(childLabels(fragment, duotone)).toEqual([
      "Light",
      "Photo",
      "Dark floor",
      "Light cap",
    ]);
    const group = baseStyles(fragment, duotone);
    for (const property of [
      "isolation",
      "zIndex",
      "opacity",
      "transform",
      "filter",
      "mixBlendMode",
    ]) {
      expect(group, property).not.toHaveProperty(property);
    }
    expect(baseStyles(fragment, byLabel(fragment, "Light"))).toMatchObject({
      backgroundColor: "var(--text)",
      mixBlendMode: "lighten",
      pointerEvents: "none",
    });
    const photo = baseStyles(fragment, byLabel(fragment, "Photo"));
    expect(photo).toMatchObject({
      filter: "grayscale(1)",
      mixBlendMode: "multiply",
    });
    expect(photo).not.toHaveProperty("pointerEvents");
    for (const [label, mix, blend] of [
      ["Dark floor", "darken", "screen"],
      ["Light cap", "lighten", "darken"],
    ]) {
      expect(baseStyles(fragment, byLabel(fragment, label)), label).toEqual(
        expect.objectContaining({
          backgroundColor: "var(--accent-1)",
          backgroundImage: "linear-gradient(var(--text),var(--text))",
          backgroundBlendMode: mix,
          mixBlendMode: blend,
          pointerEvents: "none",
        })
      );
    }
  });

  // The model: from black to white, every shade the duotone can take holds
  // the ask, in the base colour, at 4.5:1, in the board's palette and the
  // alternate. The photo multiplies the lighter of accent-1 and the text
  // colour, the darker is screened over it, and the lighter caps it.
  test.each([
    ["the board's palette", risoBroadsideTemplate.variables],
    ["night press", nightPress],
  ])("holds the ask at 4.5:1 in %s", (_name, palette) => {
    const accent = channels(palette["accent-1"]);
    const ink = channels(palette.text);
    const lighter = accent.map((value, index) => Math.max(value, ink[index]));
    const darker = accent.map((value, index) => Math.min(value, ink[index]));
    for (let grey = 0; grey <= 255; grey += 1) {
      const shade = lighter.map((value, index) => {
        const multiplied = (value * grey) / 255;
        const screened =
          multiplied + darker[index] - multiplied * darker[index];
        return Math.min(screened, value) * 255;
      });
      expect(
        contrastRatio(palette.base, hex(shade)),
        hex(shade)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
