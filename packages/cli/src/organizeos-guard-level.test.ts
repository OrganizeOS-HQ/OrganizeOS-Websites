import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
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
// that runs here and the tests that cover it fully, which must still exist.
// The level stays 0 while a requirement is not yet in this repository; the
// change that lands the last one replaces its check, removes the pin below and
// raises the level.

const root = fileURLToPath(new URL("../../..", import.meta.url));

type Covering = { file: string; title: string };

type Requirement = {
  name: string;
  /** Whether the CLI built from this commit meets it. */
  holds: () => boolean;
  /** A describe or test title in a file (from the repository root). */
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

const levelOne: Requirement[] = [
  {
    name: "the org script switch is off",
    holds: () => orgScriptMayRun() === false,
    coveredBy: [
      {
        file: "packages/sdk-components-organizeos/src/org-script.test.ts",
        title: "is off",
      },
    ],
  },
  {
    name: "unsafe addresses, srcdoc and unsafe redirects are left out",
    holds: unsafeValuesLeftOut,
    coveredBy: [
      {
        file: unsafeValuesTests,
        title: "dropOrgScript leaves unsafe values out",
      },
      { file: prebuildTests, title: "leaves unsafe values out" },
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
        title: "an XML page answers with a sandbox policy and nosniff",
      },
    ],
  },
  {
    name: "XML elements are left out of HTML pages, and on… props that are not actions are dropped",
    holds: xmlElementsAndHandlersLeftOut,
    coveredBy: [
      {
        file: unsafeValuesTests,
        title:
          "drops an XML Node from an HTML page with its subtree and its scoped data, and keeps it on an XML page",
      },
      {
        file: unsafeValuesTests,
        title:
          "drops srcdoc and every on… prop that is not an action, and keeps an action",
      },
      {
        file: prebuildTests,
        title:
          "leaves an XML Node out of an HTML page and keeps it on an XML page",
      },
      {
        file: prebuildTests,
        title: "drops srcdoc and event handler attributes",
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

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether `title` is a describe or test title in `file`. */
const hasTitle = ({ file, title }: Covering) => {
  const source = readFileSync(`${root}${file}`, "utf8");
  return new RegExp(
    `\\b(?:describe|test|it)\\(\\s*(["'\`])${escapeRegExp(title)}\\1`
  ).test(source);
};

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
        (covering) => [covering.title, covering.file, covering] as const
      )
    )
  )("level 1 is covered by %s in %s", (_title, _file, covering) => {
    expect(hasTitle(covering)).toBe(true);
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
