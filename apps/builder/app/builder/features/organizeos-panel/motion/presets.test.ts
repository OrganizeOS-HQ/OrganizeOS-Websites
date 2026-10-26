import { describe, expect, test } from "vitest";
import { animationAction } from "@webstudio-is/sdk";
import motionPresetsFixture from "../../../../../../../packages/sdk-components-organizeos/src/animate/__fixtures__/motion-presets.json";
import newScrollAnimationsFixture from "../../../../../../../packages/sdk-components-organizeos/src/animate/__fixtures__/new-scroll-animations.json";
import newViewAnimationsFixture from "../../../../../../../packages/sdk-components-organizeos/src/animate/__fixtures__/new-view-animations.json";
import { newScrollAnimations } from "~/builder/features/settings-panel/props-section/animation/new-scroll-animations";
import { newViewAnimations } from "~/builder/features/settings-panel/props-section/animation/new-view-animations";
import { motionPresets } from "./presets";

describe("motion presets", () => {
  test("Reveal, Reveal staggered and Gentle parallax, in that order", () => {
    expect(
      motionPresets.map(({ id, label, stagger }) => ({ id, label, stagger }))
    ).toEqual([
      { id: "reveal", label: "Reveal", stagger: 0 },
      { id: "reveal-staggered", label: "Reveal staggered", stagger: 8 },
      { id: "gentle-parallax", label: "Gentle parallax", stagger: 0 },
    ]);
    // the staggered preset is Reveal with a stagger
    expect(motionPresets[1].action).toEqual(motionPresets[0].action);
  });

  test.each(motionPresets)(
    "$label parses with upstream's animationAction schema, unchanged",
    ({ action }) => {
      const parsed = animationAction.safeParse(action);
      expect(parsed.success).toBe(true);
      // nothing dropped or defaulted: the editor opens it with no loss
      expect(parsed.data).toEqual(action);
    }
  );

  test("are the actions the package's player tests play", () => {
    expect(motionPresetsFixture).toEqual({
      reveal: motionPresets[0].action,
      gentleParallax: motionPresets[2].action,
    });
  });
});

// The package plays upstream's presets from copies (it cannot import the
// builder); an upstream change to them fails here first (plan amendment 4).
describe("the package's fixtures of upstream's presets", () => {
  test("equal upstream's new view animations", () => {
    expect(newViewAnimationsFixture).toEqual(newViewAnimations);
  });

  test("equal upstream's new scroll animations", () => {
    expect(newScrollAnimationsFixture).toEqual(newScrollAnimations);
  });
});
