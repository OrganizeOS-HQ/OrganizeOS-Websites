/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// The OrganizeOS builder UI is mounted in upstream files by a few marked
// lines (docs/ORGANIZEOS-FORK.md section 7). This reads those files, the way
// canvas/organizeos-org-script.wiring.test.ts reads the canvas: an upstream
// merge that reflows one of them and drops a line fails here instead of
// silently unmounting a piece of the UI.

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

const read = (path: string) =>
  withoutComments(
    readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
  );

const components = read("../components/components.tsx");
const useDragDrop = read("../../../canvas/shared/use-drag-drop.ts");
const sidebarLeft = read("../../sidebar-left/sidebar-left.tsx");

describe("the Components panel's OrganizeOS section", () => {
  test("components.tsx imports both OrganizeOS modules", () => {
    expect(components).toMatch(
      /import\s*\{[^}]*\$organizeosComponentGroups[^}]*\}\s*from\s*"~\/builder\/features\/organizeos-panel\/components-section"/
    );
    for (const name of [
      "OrganizeosGroupFooter",
      "organizeosGroupLabel",
      "withOrganizeosGroups",
      "type OrganizeosCategory",
    ]) {
      expect(components).toMatch(
        new RegExp(
          `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*"~/builder/features/organizeos-panel/components-section"`
        )
      );
    }
    expect(components).toMatch(
      /import\s*\{\s*insertOrganizeosBlock,\s*isOrganizeosBlock,?\s*\}\s*from\s*"~\/builder\/features\/organizeos-panel\/insert-organizeos-block"/
    );
  });

  test("handleInsert sends a block to insertOrganizeosBlock before upstream's template insert", () => {
    const handleInsert = components.slice(
      components.indexOf("const handleInsert = (component: string) => {")
    );
    const branch = handleInsert.search(
      /if \(isOrganizeosBlock\(component\)\) \{\s*void insertOrganizeosBlock\(component\);\s*\} else if \(component === elementComponent\)/
    );
    expect(branch).toBeGreaterThan(-1);
    expect(branch).toBeLessThan(
      handleInsert.indexOf("getComponentTemplateData(component)")
    );
  });

  test("the panel's groups are upstream's, composed with the OrganizeOS groups", () => {
    expect(components).toMatch(
      /const organizeosGroups = useStore\(\$organizeosComponentGroups\);/
    );
    expect(components).toMatch(
      /const groups = withOrganizeosGroups\(\s*filterAndGroupComponents\(\{[^}]*\}\),\s*organizeosGroups,\s*\{\s*documentType: selectedPage\?\.meta\.documentType,\s*search: searchFieldProps\.value,?\s*\}\s*\);/
    );
  });

  // withOrganizeosGroups ranks upstream's Found list again, together with the
  // blocks, with these keys (components-section.tsx). A merge that changes
  // upstream's keys must change those too, or allowlisted orgs lose matches.
  test("upstream's search still ranks by label alone, the keys withOrganizeosGroups uses", () => {
    const filterAndGroup = components.slice(
      components.indexOf("const filterAndGroupComponents = ("),
      components.indexOf("const findComponentIndex = (")
    );
    expect(filterAndGroup).toMatch(
      /matchSorter\(metas, search, \{\s*keys: \["label"\],?\s*\}\)/
    );
    expect(filterAndGroup.match(/matchSorter\(/g)).toHaveLength(1);
  });

  test("a group's heading and foot come from the OrganizeOS module", () => {
    expect(components).toMatch(
      /label=\{\s*organizeosGroupLabel\(group\.category\) \?\? titleCase\(group\.category\)\s*\}/
    );
    expect(components).toMatch(
      /<\/List>\s*\{\}\s*<OrganizeosGroupFooter category=\{group\.category\} \/>/
    );
  });

  test("the Groups category takes the OrganizeOS category", () => {
    expect(components).toMatch(
      /type Groups = Array<\{\s*category:[^;]*\|\s*"found"\s*\|\s*OrganizeosCategory;/
    );
  });
});

describe("the canvas's drop", () => {
  test("use-drag-drop.ts sends a dropped block to insertOrganizeosBlock before the template fallback", () => {
    const branch = useDragDrop.search(
      /else if \(isOrganizeosBlock\(dragPayload\.dragComponent\)\) \{\s*void insertOrganizeosBlock\(dragPayload\.dragComponent, insertable\);/
    );
    const fallback = useDragDrop.search(
      /const fragment = getComponentTemplateData\(dragPayload\.dragComponent\);\s*if \(fragment\) \{\s*insertWebstudioFragmentAt\(fragment, insertable\);/
    );
    expect(branch).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(-1);
    expect(branch).toBeLessThan(fallback);
  });
});

describe("the left sidebar", () => {
  test("sidebar-left.tsx still offers the OrganizeOS tab only on the allowlist", () => {
    expect(sidebarLeft).toMatch(
      /panel\.name !== "organizeos" \|\| isOrganizeosPanelAvailable/
    );
    expect(sidebarLeft).toMatch(
      /getAvailablePanels\(\s*useStore\(\$isOrganizeosPanelAvailable\)\s*\)/
    );
  });
});
