import { describe, expect, test } from "vitest";
import { approvedPalettes } from "../../__fixtures__/approved-palettes";
import { checkSiteTemplate } from "../../check";
import { SITE_TEMPLATES } from "../../catalog";
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

const hex = (channels: number[]) =>
  `#${channels.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

const channels = (color: string) =>
  [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16));

describe("Riso Broadside", () => {
  test("is in the catalog as a draft", () => {
    expect(SITE_TEMPLATES).toContain(risoBroadsideTemplate);
    expect(risoBroadsideTemplate.status).toBe("draft");
  });

  test("has the approved board's palette", () => {
    const board = approvedPalettes.find(
      (palette) => palette.name === "Riso Broadside"
    );
    expect(board).toBeDefined();
    expect(risoBroadsideTemplate.variables).toMatchObject(board?.colors ?? {});
  });

  test("is one page, Home (spec 5.1)", () => {
    expect(
      risoBroadsideTemplate.pages.map(({ name, path }) => [name, path])
    ).toEqual([["Home", ""]]);
  });

  // The nav's Why and FAQ, and every "Add your name", jump within the page:
  // each anchor names an element the page has.
  test("every in-page link names an element of the page", () => {
    const { props } = renderHome();
    const ids = new Set(
      props.flatMap((prop) =>
        prop.name === "id" && prop.type === "string" ? [prop.value] : []
      )
    );
    const anchors = props.flatMap((prop) =>
      prop.name === "href" &&
      prop.type === "string" &&
      prop.value.startsWith("#")
        ? [prop.value.slice(1)]
        : []
    );
    expect(new Set(anchors)).toEqual(new Set(["why", "faq", "sign-up"]));
    for (const anchor of anchors) {
      expect(ids, anchor).toContain(anchor);
    }
  });

  // FAQ: Accordion with no script: each question a details element that
  // opens on its summary, which a keyboard reaches and toggles.
  test("its FAQ opens and closes without script, and asks what happens to a signer's details", () => {
    const { instances } = renderHome();
    const byId = new Map(instances.map((instance) => [instance.id, instance]));
    const questions = instances.filter(
      (instance) => instance.tag === "details"
    );
    expect(questions.length).toBeGreaterThanOrEqual(3);
    const summaries = questions.map((details) => {
      const first = details.children[0];
      return first?.type === "id" ? byId.get(first.value) : undefined;
    });
    for (const summary of summaries) {
      expect(summary?.tag).toBe("summary");
    }
    const asked = summaries.flatMap(
      (summary) =>
        summary?.children.flatMap((child) =>
          child.type === "text" ? [child.value] : []
        ) ?? []
    );
    expect(asked).toContain("What happens to my details?");
  });

  // The hero lays the photo, in greys, from the darker to the lighter of
  // accent-1 and the text colour, channel by channel (sections.tsx): the
  // photo multiplies the lighter, the darker is screened over it, and the
  // lighter caps it. From black to white, every shade it can take holds the
  // ask, in the base colour, at 4.5:1, in the board's palette and the
  // alternate.
  test.each([
    ["the board's palette", risoBroadsideTemplate.variables],
    ["night press", nightPress],
  ])("the hero's duotone holds the ask at 4.5:1 in %s", (_name, palette) => {
    const accent = channels(palette["accent-1"]).map((value) => value / 255);
    const ink = channels(palette.text).map((value) => value / 255);
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

  // The alternate palette the owner reviews beside the board's: the same
  // fonts, held to the same contrast rules.
  test("its night-press palette keeps the fonts and passes the check", () => {
    expect(nightPress["font-heading"]).toBe(
      risoBroadsideTemplate.variables["font-heading"]
    );
    expect(nightPress["font-body"]).toBe(
      risoBroadsideTemplate.variables["font-body"]
    );
    expect(
      checkSiteTemplate({ ...risoBroadsideTemplate, variables: nightPress })
    ).toEqual([]);
  });
});
