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

/** Whether `id` is `ancestorId` or under it. */
const isWithin = (
  fragment: ReturnType<typeof renderHome>,
  id: string,
  ancestorId: string
): boolean => {
  if (id === ancestorId) {
    return true;
  }
  const parent = fragment.instances.find((instance) =>
    instance.children.some((child) => child.type === "id" && child.value === id)
  );
  return parent !== undefined && isWithin(fragment, parent.id, ancestorId);
};

describe("Riso Broadside", () => {
  test("is in the catalog, listed", () => {
    expect(SITE_TEMPLATES).toContain(risoBroadsideTemplate);
    expect(risoBroadsideTemplate.status).toBe("listed");
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

  // Instrument Serif reads as a caption at the kit's 20px: the footer's name
  // is set at the nav's size.
  test("its footer's name is the nav's size", () => {
    const fragment = renderHome();
    const fontSize = (container: string) => {
      const owner = fragment.instances.find(
        (instance) => instance.label === container
      );
      const name = fragment.instances.find(
        (instance) =>
          instance.label === "Name" &&
          owner !== undefined &&
          isWithin(fragment, instance.id, owner.id)
      );
      const sources =
        fragment.styleSourceSelections.find(
          (selection) => selection.instanceId === name?.id
        )?.values ?? [];
      return fragment.styles.find(
        (decl) =>
          sources.includes(decl.styleSourceId) &&
          decl.property === "fontSize" &&
          decl.state === undefined
      )?.value;
    };
    expect(fontSize("Footer")).toEqual({
      type: "unit",
      unit: "px",
      value: 28,
    });
    expect(fontSize("Footer")).toEqual(fontSize("Nav: Centered"));
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
