import { readFileSync, readdirSync } from "node:fs";
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

describe("the Templates screen", () => {
  test("builder.tsx imports TemplatesScreen from the OrganizeOS module and mounts it once, after the other dialogs and before the Toaster", () => {
    expect(builder).toMatch(
      /import\s*\{\s*TemplatesScreen\s*\}\s*from\s*"\.\/features\/organizeos-panel\/site-templates\/templates-screen";/
    );
    expect(builder).not.toMatch(/TemplateChooser/);
    expect(builder.match(/<TemplatesScreen \/>/g)).toHaveLength(1);
    const dialogs = builder.indexOf("<TokenConflictDialog />");
    const mount = builder.indexOf("<TemplatesScreen />");
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

  test("sidebar-left.tsx renders the Variables rail button after the CMS's and the overlay once after the CMS overlay", () => {
    const cmsButton = sidebarLeft.indexOf("<CmsRailButton />");
    const button = sidebarLeft.indexOf("<VariablesRailButton />");
    expect(button).toBeGreaterThan(cmsButton);
    expect(button).toBeLessThan(sidebarLeft.indexOf("</SidebarTabsList>"));
    expect(sidebarLeft.match(/<VariablesRailButton \/>/g)).toHaveLength(1);

    const cmsOverlay = sidebarLeft.indexOf("<CmsOverlay />");
    const overlay = sidebarLeft.indexOf("<VariablesOverlay />");
    expect(overlay).toBeGreaterThan(cmsOverlay);
    expect(overlay).toBeLessThan(sidebarLeft.indexOf("</SidebarTabs>"));
    expect(sidebarLeft.match(/<VariablesOverlay \/>/g)).toHaveLength(1);
    expect(sidebarLeft).toMatch(
      /import\s*\{\s*VariablesOverlay,\s*VariablesRailButton,?\s*\}\s*from\s*"~\/builder\/features\/variables";/
    );
  });

  test("sidebar-left.tsx hides a rail overlay when a rail tab is clicked over it", () => {
    expect(sidebarLeft).toMatch(
      /if \(hideRailOverlay\(\)\) \{\s*setActiveSidebarPanel\(name\);\s*return;\s*\}\s*toggleActiveSidebarPanel\(name\);/
    );
    expect(sidebarLeft).toMatch(
      /import\s*\{\s*hideRailOverlay,?\s*\}\s*from\s*"~\/builder\/features\/rail-overlay\/rail-overlay";/
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

describe("the commands emitter's suppression", () => {
  test("a suppression may allow named commands, which still run", () => {
    const emitter = read("../../../shared/commands-emitter.ts");
    expect(emitter).toMatch(/options\?: \{ allow\?: readonly string\[\] \}/);
    expect(emitter).toMatch(
      /const allowed = suppressedCommandEvents\.get\(event\);/
    );
    expect(emitter).toMatch(
      /allowed !== undefined && allowed\.has\(commandMeta\.name\) === false/
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
  test("variables-section.tsx titles the binding section Data variables, its open-state key unchanged", () => {
    const section = read("../settings-panel/variables-section.tsx");
    expect(section).toMatch(
      /<SectionTitleLabel>Data variables<\/SectionTitleLabel>/
    );
    expect(section).toMatch(/const label = "Variables";/);
  });

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

const projectBuild = (path: string) =>
  read(`../../../../../../packages/project-build/src/${path}`);

describe("the Variables edits in project-build", () => {
  test("projectSettings keeps the organizeos key, unparsed", () => {
    expect(projectBuild("shared/project-settings.ts")).toMatch(
      /organizeos:\s*z\.unknown\(\)\.optional\(\),/
    );
  });

  test("index.ts exports the registry module", () => {
    expect(projectBuild("index.ts")).toMatch(
      /export \* from "\.\/shared\/organizeos-variables";/
    );
  });

  test("styles.ts renames by whole name and exports the usage counts", () => {
    const styles = projectBuild("runtime/styles.ts");
    expect(styles).toContain("(?<![\\\\w-])${escapeRegex(name)}(?![\\\\w-])");
    expect(styles).toMatch(/`\(\?<!\[\\\\w-\]\)\(\?:\$\{Array\.from\(names\)/);
    expect(styles).not.toContain('("value":")');
    expect(styles).toMatch(
      /record\.type === "fontFamily" && Array\.isArray\(record\.value\)/
    );
    expect(styles).toMatch(/export const getCssVariableUsageCounts = /);
  });
});

describe("the path guard in project-build", () => {
  test("pages.ts takes isPlatformServedPath from the narrow export and refuses with the message", () => {
    const pages = projectBuild("runtime/pages.ts");
    expect(pages).toMatch(
      /import \{ isPlatformServedPath \} from "@organizeos\/site-components\/platform-paths";/
    );
    expect(pages).toContain('"The platform uses this path"');
  });

  test("project-build imports the package only as ./org-script or ./platform-paths", () => {
    const root = fileURLToPath(
      new URL("../../../../../../packages/project-build/src/", import.meta.url)
    );
    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => /\.test\.tsx?$/.test(file) === false);
    const specifiers = new Set(
      files.flatMap((file) =>
        Array.from(
          readFileSync(`${root}${file}`, "utf8").matchAll(
            /["'](@organizeos\/site-components(?:\/[^"']*)?)["']/g
          ),
          (match) => match[1]
        )
      )
    );
    expect(specifiers.size).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect([
        "@organizeos/site-components/org-script",
        "@organizeos/site-components/platform-paths",
      ]).toContain(specifier);
    }
  });
});

const siteComponents = (path: string) =>
  read(`../../../../../../packages/sdk-components-organizeos/src/${path}`);

describe("the starter pages stay out of published sites", () => {
  test("components.ts and metas.ts import neither site-templates nor starter-pages", () => {
    for (const file of ["components.ts", "metas.ts"]) {
      expect(siteComponents(file)).not.toMatch(/site-templates|starter-pages/);
    }
  });

  test("starter-pages imports the site-templates folder only by module, never its barrel or catalog", () => {
    const root = fileURLToPath(
      new URL(
        "../../../../../../packages/sdk-components-organizeos/src/starter-pages/",
        import.meta.url
      )
    );
    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => /\.test\.tsx?$/.test(file) === false);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(`${root}${file}`, "utf8");
      for (const barrel of [
        'from "../site-templates"',
        'from "../site-templates/index"',
        'from "../site-templates/catalog"',
      ]) {
        expect(source, file).not.toContain(barrel);
      }
    }
  });
});

describe("the Variables export in shared/instance-utils/data.ts", () => {
  test("canCommitWebstudioData is exported", () => {
    expect(read("../../../shared/instance-utils/data.ts")).toMatch(
      /export const canCommitWebstudioData = \(\) =>/
    );
  });
});

describe("the Cmd+K CSS variable guard and routing", () => {
  const utils = read("../../shared/css-variable-utils.tsx");

  test("imports the routing from the Variables operations", () => {
    expect(utils).toMatch(
      /import \{[^}]*routeCssVariableRename[^}]*\} from "~\/builder\/features\/variables\/operations";/
    );
  });

  test("Delete unused reads a store that leaves out kept names; Cmd+K's labels keep upstream's", () => {
    expect(utils).toMatch(
      /export const \$unusedCssVariables = computed\(\s*\[\$cssVariableDefinitionsByVariable, \$referencedCssVariables\],/
    );
    expect(utils).toMatch(
      /export const \$deletableUnusedCssVariables = computed\(\s*\[\$unusedCssVariables, \$projectSettings\],[\s\S]*?withoutKeptCssVariables\(/
    );
    expect(
      utils.match(
        /\$deletableUnusedCssVariables\.get\(\)|useStore\(\$deletableUnusedCssVariables\)/g
      )
    ).toHaveLength(2);
  });

  test("rename, delete and delete unused route first", () => {
    expect(utils).toMatch(
      /const routed = routeCssVariableRename\(oldProperty, newProperty\);\s*if \(routed !== "upstream"\)/
    );
    expect(utils).toMatch(
      /routeCssVariableDelete\(\[property\]\) !== undefined/
    );
    expect(utils).toMatch(
      /routeCssVariableDelete\(Array\.from\(unusedVariables\)\)/
    );
  });

  test("both delete dialogs refuse before they confirm", () => {
    expect(utils.match(/getCssVariableDeleteRefusal\(/g)).toHaveLength(2);
  });
});

describe("the Style panel's variable binding", () => {
  const label = read("../style-panel/property-label.tsx");
  const body = label.slice(
    label.indexOf("export const PropertyLabel = ("),
    label.indexOf("export const PropertySectionLabel = (")
  );

  test("property-label.tsx imports VariableBindControl from the Variables feature", () => {
    expect(label).toMatch(
      /import \{ VariableBindControl \} from "~\/builder\/features\/variables";/
    );
  });

  test("PropertyLabel wraps ResettableLabel in VariableBindControl", () => {
    const open = body.indexOf("<VariableBindControl properties={properties}>");
    const labelOpen = body.indexOf("<ResettableLabel");
    const labelClose = body.indexOf("</ResettableLabel>");
    const close = body.indexOf("</VariableBindControl>");
    expect(open).toBeGreaterThanOrEqual(0);
    expect(labelOpen).toBeGreaterThan(open);
    expect(labelClose).toBeGreaterThan(labelOpen);
    expect(close).toBeGreaterThan(labelClose);
    expect(label.match(/<VariableBindControl\b/g)).toHaveLength(1);
    expect(label.match(/<\/VariableBindControl>/g)).toHaveLength(1);
  });
});
