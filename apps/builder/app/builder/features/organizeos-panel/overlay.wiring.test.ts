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
const styleSections = read("../style-panel/sections/sections.ts");
const inspector = read("../../inspector.tsx");
const builderNanoStates = read("../../shared/nano-states.ts");

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

describe("the Style panel's Background presets", () => {
  test("sections.ts imports the presets from the OrganizeOS module and lists them immediately after backgrounds", () => {
    expect(styleSections).toMatch(
      /import \* as organizeosBackgroundPresets from "~\/builder\/features\/organizeos-panel\/background-presets-section";/
    );
    expect(styleSections).toMatch(
      /\["backgrounds", backgrounds\],\s*\["organizeosBackgroundPresets", organizeosBackgroundPresets\],/
    );
  });
});

describe("the Inspector's Motion tab", () => {
  test('inspector.tsx adds motion only behind $isMotionTabAvailable, lists MotionTabTrigger behind availablePanels.has("motion") and renders MotionTabContent behind it too', () => {
    expect(inspector).toMatch(
      /import\s*\{\s*\$isMotionTabAvailable,\s*MotionTabContent,\s*MotionTabTrigger,?\s*\}\s*from\s*"~\/builder\/features\/organizeos-panel\/motion-tab"/
    );
    expect(inspector).toMatch(
      /const isMotionTabAvailable = useStore\(\$isMotionTabAvailable\);/
    );
    // read with the other hooks, before the early returns
    expect(inspector.indexOf("useStore($isMotionTabAvailable)")).toBeLessThan(
      inspector.indexOf("return <NavigatorTree />")
    );
    expect(inspector).toMatch(
      /type PanelName = "style" \| "settings" \| "motion";/
    );
    expect(inspector).toMatch(
      /if \(isMotionTabAvailable\) \{\s*availablePanels\.add\("motion"\);\s*\}/
    );
    expect(inspector.match(/availablePanels\.add\("motion"\)/g)).toHaveLength(
      1
    );
    expect(inspector).toMatch(
      /\{availablePanels\.has\("motion"\) && <MotionTabTrigger \/>\}/
    );
    expect(inspector).toMatch(
      /\{availablePanels\.has\("motion"\) && \(\s*<MotionTabContent\s+instance=\{selectedInstance\}\s+instanceKey=\{selectedInstanceKey\}\s*\/>\s*\)\}/
    );
    expect(inspector.match(/<MotionTabContent\b/g)).toHaveLength(1);
  });

  test("builder nano-states type $activeInspectorPanel with motion", () => {
    expect(builderNanoStates).toMatch(
      /export const \$activeInspectorPanel = atom<"style" \| "settings" \| "motion">\(\s*"style"\s*\);/
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
  test("sidebar-left.tsx offers the CMS panel where it is available, and the OrganizeOS tab only on the allowlist without it", () => {
    expect(sidebarLeft).toMatch(
      /if \(panel\.name === "cms"\) \{\s*return isCmsPanelAvailable;\s*\}/
    );
    expect(sidebarLeft).toMatch(
      /if \(panel\.name === "organizeos"\) \{\s*return isOrganizeosPanelAvailable && isCmsPanelAvailable === false;\s*\}/
    );
    expect(sidebarLeft).toMatch(
      /getAvailablePanels\(\s*useStore\(\$isOrganizeosPanelAvailable\),\s*useStore\(\$isCmsPanelAvailable\)\s*\)/
    );
  });

  test("sidebar-left.tsx renders the CMS frame outside the tab content", () => {
    const content = sidebarLeft.indexOf("</SidebarTabsContent>");
    const frame = sidebarLeft.indexOf("<CmsFrame />");
    expect(content).toBeGreaterThan(-1);
    expect(frame).toBeGreaterThan(content);
    expect(frame).toBeLessThan(sidebarLeft.indexOf("</SidebarTabs>"));
    expect(sidebarLeft.match(/<CmsFrame \/>/g)).toHaveLength(1);
  });

  test("sidebar-left.tsx gives the active panel its own maximum and starting width", () => {
    expect(sidebarLeft).toMatch(
      /maxWidth: activePanelConfig\?\.maxWidth \?\? theme\.spacing\[35\]/
    );
    expect(sidebarLeft).toMatch(
      /getSidebarPanelWidth\(\s*activePanel,\s*activePanelConfig\?\.defaultWidth\s*\)/
    );
  });

  test("sidebar-left.tsx labels the tab OrganizeOS data with ResourceIcon", () => {
    expect(sidebarLeft).toMatch(
      /name: "organizeos",\s*label: "OrganizeOS data",\s*Icon: ResourceIcon,\s*Panel: OrganizeosPanel,/
    );
    expect(sidebarLeft).toMatch(
      /import\s*\{[^}]*\bResourceIcon\b[^}]*\}\s*from\s*"@webstudio-is\/icons"/
    );
  });
});
