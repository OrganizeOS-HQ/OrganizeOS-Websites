import { describe, expect, test } from "vitest";
import { approvedPalettes } from "../../__fixtures__/approved-palettes";
import { checkSiteTemplate } from "../../check";
import { SITE_TEMPLATES } from "../../catalog";
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
