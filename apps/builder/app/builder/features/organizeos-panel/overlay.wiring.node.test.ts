import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// The OrganizeOS builder UI is mounted in upstream files by a few marked
// lines (docs/ORGANIZEOS-FORK.md section 7). This reads those files, the way
// canvas/organizeos-org-script.wiring.node.test.ts reads the canvas: an upstream
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
const builder = read("../../builder.tsx");
const insertBlock = read("./insert-organizeos-block.ts");
const contextServer = read("../../../shared/context.server.ts");

describe("the Components panel's OrganizeOS section", () => {
  test("components.tsx imports both OrganizeOS modules", () => {
    expect(components).toMatch(
      /import\s*\{[^}]*\$organizeosComponentGroups[^}]*\}\s*from\s*"~\/builder\/features\/organizeos-panel\/components-section"/
    );
    for (const name of ["organizeosGroupLabel", "withOrganizeosGroups"]) {
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

  test("handleInsert sends a block to insertOrganizeosBlock before upstream's component insert", () => {
    const start = components.indexOf(
      "const handleInsert = async (component: string) => {"
    );
    expect(start).toBeGreaterThan(-1);
    expect(components.slice(start)).toMatch(
      /^const handleInsert = async \(component: string\) => \{\s*if \(isOrganizeosBlock\(component\)\) \{\s*void insertOrganizeosBlock\(component\);\s*\} else \{\s*await insertWebstudioComponentAt\(component\);\s*\}\s*onClose\(\);/
    );
  });

  test("the panel's groups are upstream's, composed with the OrganizeOS groups", () => {
    expect(components).toMatch(
      /const selectedPage = useStore\(\$selectedPage\);/
    );
    expect(components).toMatch(
      /const organizeosGroups = useStore\(\$organizeosComponentGroups\);/
    );
    expect(components).toMatch(
      /const groups = withOrganizeosGroups\(\s*filterAndGroupComponents\(\{[^}]*\}\),\s*organizeosGroups,\s*\{\s*documentType: selectedPage\?\.meta\.documentType,\s*search: searchFieldProps\.value,?\s*\}\s*\);/
    );
  });

  // withOrganizeosGroups ranks upstream's Found list again, together with the
  // blocks, with these keys (components-section.tsx). A merge that changes
  // upstream's keys must change those too, or orgs offered the blocks lose
  // matches.
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

  test("a group's heading comes from the OrganizeOS module", () => {
    expect(components).toMatch(
      /label=\{\s*organizeosGroupLabel\(group\.category\) \?\? titleCase\(group\.category\)\s*\}/
    );
    expect(components).not.toContain("OrganizeosGroupFooter");
  });

  // Not a fork line: it watches upstream's type, which withOrganizeosGroups'
  // result has to fit. A narrower upstream category would drop the
  // OrganizeOS group's.
  test("upstream's Groups category stays a string, so the OrganizeOS category fits", () => {
    expect(components).toMatch(/type Groups = Array<\{\s*category: string;/);
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
  test("commitCanvasDragDrop sends a dropped block to insertOrganizeosBlock before upstream's component insert", () => {
    expect(useDragDrop).toMatch(
      /import\s*\{\s*insertOrganizeosBlock,\s*isOrganizeosBlock,?\s*\}\s*from\s*"~\/builder\/features\/organizeos-panel\/insert-organizeos-block"/
    );
    const start = useDragDrop.indexOf("export const commitCanvasDragDrop = (");
    expect(start).toBeGreaterThan(-1);
    expect(useDragDrop.slice(start)).toMatch(
      /if \(dragPayload\.type === "insert"\) \{\s*if \(isOrganizeosBlock\(dragPayload\.dragComponent\)\) \{\s*void insertOrganizeosBlock\(dragPayload\.dragComponent, insertable\);\s*return true;\s*\}\s*return insertWebstudioComponentAt\(dragPayload\.dragComponent, insertable\);/
    );
  });
});

describe("the block insert's imports", () => {
  // the canvas imports the insert (use-drag-drop.ts): the site-templates
  // barrel would bring the template catalog and its images into it
  test("insert-organizeos-block.ts takes localStylesFirst from the narrow export, never the site-templates barrel", () => {
    expect(insertBlock).toMatch(
      /import \{ localStylesFirst \} from "@organizeos\/site-components\/style-order";/
    );
    expect(insertBlock).not.toMatch(
      /from "@organizeos\/site-components\/site-templates"/
    );
  });
});

describe("the site-template chooser", () => {
  test("builder.tsx imports TemplateChooser from the OrganizeOS module and mounts it once, after the other dialogs and before the Toaster", () => {
    expect(builder).toMatch(
      /import\s*\{\s*TemplateChooser\s*\}\s*from\s*"\.\/features\/organizeos-panel\/site-templates\/template-chooser";/
    );
    expect(builder.match(/<TemplateChooser \/>/g)).toHaveLength(1);
    const dialogs = builder.indexOf("<TokenConflictDialog />");
    const mount = builder.indexOf("<TemplateChooser />");
    const toaster = builder.indexOf("<Toaster />");
    expect(dialogs).toBeGreaterThan(-1);
    expect(mount).toBeGreaterThan(dialogs);
    expect(toaster).toBeGreaterThan(mount);
  });
});

describe("the left sidebar", () => {
  test("sidebar-left.tsx still offers the OrganizeOS tab only to an org not denied the blocks", () => {
    expect(sidebarLeft).toMatch(
      /panel\.name !== "organizeos" \|\| isOrganizeosPanelAvailable/
    );
    expect(sidebarLeft).toMatch(
      /getAvailablePanels\(\s*useStore\(\$isOrganizeosPanelAvailable\)\s*\)/
    );
  });

  test("sidebar-left.tsx renders the CMS rail button after the tabs and the overlay once outside the tab content", () => {
    const list = sidebarLeft.indexOf("</SidebarTabsList>");
    const button = sidebarLeft.indexOf("<CmsRailButton />");
    expect(button).toBeGreaterThan(-1);
    expect(button).toBeLessThan(list);
    expect(sidebarLeft.match(/<CmsRailButton \/>/g)).toHaveLength(1);

    const content = sidebarLeft.indexOf("</SidebarTabsContent>");
    const overlay = sidebarLeft.indexOf("<CmsOverlay />");
    expect(content).toBeGreaterThan(-1);
    expect(overlay).toBeGreaterThan(content);
    expect(overlay).toBeLessThan(sidebarLeft.indexOf("</SidebarTabs>"));
    expect(sidebarLeft.match(/<CmsOverlay \/>/g)).toHaveLength(1);
    expect(sidebarLeft).toMatch(/ref=\{registerCmsRail\}/);
  });

  test("sidebar-left.tsx hides the CMS overlay when a rail tab is clicked over it", () => {
    expect(sidebarLeft).toMatch(
      /if \(hideCmsOverlay\(\)\) \{\s*setActiveSidebarPanel\(name\);\s*return;\s*\}\s*toggleActiveSidebarPanel\(name\);/
    );
  });

  test("sidebar-left.tsx keeps the per-panel maximum and starting width", () => {
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

describe("the OrganizeOS publisher in shared/context.server.ts", () => {
  test("domain.publish's deployment client is the shared OrganizeOS publisher when one is configured, upstream's otherwise", () => {
    expect(contextServer).toMatch(
      /import\s*\{\s*getOrganizeosPublisher\s*\}\s*from\s*"~\/services\/organizeos-publisher\.server"/
    );
    expect(contextServer).toMatch(
      /deploymentTrpc:\s*\(getOrganizeosPublisher\(\) as unknown as\s*\|\s*AppContext\["deployment"\]\["deploymentTrpc"\]\s*\|\s*undefined\) \?\? trpcSharedClient\.deployment,/
    );
    // built once, in the publisher module, never inline here
    expect(contextServer).not.toContain("createOrganizeosPublisher");
  });
});

describe("the settings panel's OrganizeOS controls", () => {
  const combined = read("../settings-panel/controls/combined.tsx");
  const url = read("../settings-panel/controls/url.tsx");
  const propsSection = read(
    "../settings-panel/props-section/props-section.tsx"
  );

  test("combined.tsx imports getOrganizeosControl and renderOrganizeosControl", () => {
    expect(combined).toMatch(
      /import\s*\{\s*getOrganizeosControl,\s*renderOrganizeosControl,?\s*\}\s*from\s*"\.\/organizeos-controls"/
    );
  });

  test("the branch asks for the control before the json control, and draws nothing for a hidden prop", () => {
    const branch = combined.indexOf("getOrganizeosControl({");
    const json = combined.indexOf('meta.control === "json"');
    expect(branch).toBeGreaterThan(-1);
    expect(json).toBeGreaterThan(branch);
    expect(combined).toMatch(
      /instanceSelector:\s*\$selectedInstanceSelector\.get\(\)/
    );
    expect(combined).toMatch(
      /if\s*\(organizeosControl === "hidden"\)\s*\{\s*return undefined;\s*\}/
    );
    expect(combined).toMatch(
      /return renderOrganizeosControl\(organizeosControl,/
    );
  });

  test("url.tsx exports BasePage, the Page mode After submit draws, read-only when readOnly", () => {
    expect(url).toMatch(
      /export const BasePage = \(\{ prop, readOnly, onChange \}: BaseControlProps\) =>/
    );
    expect(url).toMatch(/disabled=\{readOnly\}/);
    expect(url).toMatch(
      /disabled=\{readOnly \|\| sectionSelectOptions\.length === 0\}/
    );
  });

  test("a second prop's write goes through the props logic: props-section passes it, combined.tsx hands it on", () => {
    expect(propsSection).toMatch(
      /onChangeByPropName:\s*logic\.handleChangeByPropName,/
    );
    expect(combined).toMatch(
      /return renderOrganizeosControl\(organizeosControl, \{[^}]*onChangeByPropName,/
    );
  });
});
