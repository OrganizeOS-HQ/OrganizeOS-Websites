import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { parse } from "acorn";
import { transformWithEsbuild } from "vite";
import {
  bundleVersion,
  publishedProjectBundle,
  type PublishedProjectBundle,
} from "@webstudio-is/protocol";
import type { Instance, Prop } from "@webstudio-is/sdk";
import {
  ORGANIZEOS_GUARD_LEVEL,
  orgScriptMayRun,
} from "@organizeos/site-components/org-script";
import { dropOrgScript } from "./organizeos-org-script";

// The publish workflow sends ORGANIZEOS_GUARD_LEVEL to OrganizeOS as
// guardLevel, and OrganizeOS launches a Website only from a build whose level
// is high enough (docs/ORGANIZEOS-FORK.md section 5). So the level this commit
// reports must be one its CLI meets. Each requirement of level 1 has a check
// that runs here and the tests that cover it fully, which must still exist and
// run: neither commented out nor skipped.
// The level stays 0 while a requirement is not yet in this repository; the
// change that lands the last one replaces its check, removes the pin below and
// raises the level.

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
  holds: () => boolean;
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
}: {
  instances: Array<[string, Instance]>;
  props: Array<[string, Prop]>;
  redirect?: string;
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
      dataSources: [],
      resources: [],
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

const unsafeValuesTests =
  "packages/cli/src/organizeos-org-script.unsafe-values.test.ts";
const prebuildTests = "packages/cli/src/prebuild.test.ts";

const workflowTests = "packages/cli/src/organizeos-publish-workflow.test.ts";
const unsafeValues = "dropOrgScript leaves unsafe values out";
const prebuildUnsafeValues = ["prebuild", "leaves unsafe values out"];

const levelOne: Requirement[] = [
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
    ],
  },
  {
    name: "one requirement not yet in this repository",
    holds: () => false,
    coveredBy: [],
  },
];

const present = levelOne.filter(
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
    for (let current: TitledCall | undefined = call; current; ) {
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
  test("is an integer from 0 to 32767, and at most 1", () => {
    expect(Number.isInteger(ORGANIZEOS_GUARD_LEVEL)).toBe(true);
    expect(ORGANIZEOS_GUARD_LEVEL).toBeGreaterThanOrEqual(0);
    expect(ORGANIZEOS_GUARD_LEVEL).toBeLessThanOrEqual(32767);
    // no level above 1 is defined here
    expect(ORGANIZEOS_GUARD_LEVEL).toBeLessThanOrEqual(1);
  });

  test.each(
    present.map((requirement) => [requirement.name, requirement] as const)
  )("level 1: %s holds", (_name, requirement) => {
    expect(requirement.holds()).toBe(true);
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

  test("a level of 1 or more means every level-1 requirement holds", () => {
    if (ORGANIZEOS_GUARD_LEVEL >= 1) {
      for (const requirement of levelOne) {
        expect(requirement.holds(), requirement.name).toBe(true);
        expect(requirement.coveredBy.length, requirement.name).toBeGreaterThan(
          0
        );
      }
    }
  });

  test("stays 0 while a level-1 requirement is not yet in this repository", () => {
    expect(ORGANIZEOS_GUARD_LEVEL).toBe(0);
  });
});
