import { describe, expect, test, vi } from "vitest";
import {
  bundleVersion,
  publishedProjectBundle,
  type PublishedProjectBundle,
} from "@webstudio-is/protocol";
import type { Instance, Prop, Resource } from "@webstudio-is/sdk";
import { migratePages } from "@webstudio-is/project-migrations/pages";
import { orgScriptMayRun } from "@organizeos/site-components/org-script";
import { assertBuildCodeValid } from "./organizeos-code-check";
import { dropOrgScript } from "./organizeos-org-script";

// The step runs whatever the switch says: here it is on.
vi.mock("@organizeos/site-components/org-script", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  orgScriptMayRun: () => true,
}));

const bundleOf = ({
  instances = [],
  props = [],
  resources = [],
  meta = {},
}: {
  instances?: Instance[];
  props?: Prop[];
  resources?: Resource[];
  meta?: Record<string, unknown>;
}): PublishedProjectBundle => {
  const home = {
    id: "home",
    name: "Home",
    title: `"Home"`,
    path: "",
    rootInstanceId: "root",
    meta,
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
        meta: {},
        homePageId: "home",
        rootFolderId: "root-folder",
        pages: [home],
        folders: [
          { id: "root-folder", name: "Root", slug: "", children: ["home"] },
        ],
      },
      props: props.map((prop) => [prop.id, prop]),
      instances: [
        {
          type: "instance",
          id: "root",
          component: "Body",
          children: instances.map(({ id }) => ({ type: "id", value: id })),
        },
        ...instances,
      ].map((instance) => [instance.id, instance]),
      dataSources: [],
      resources: resources.map((resource) => [resource.id, resource]),
      styleSources: [],
      styleSourceSelections: [],
      styles: [],
      breakpoints: [],
    },
  });
};

const check = (bundle: PublishedProjectBundle) => () =>
  assertBuildCodeValid(bundle.build, migratePages(bundle.build.pages));

const box: Instance = {
  type: "instance",
  id: "box",
  component: "Box",
  children: [],
};

describe("assertBuildCodeValid", () => {
  test("a clean build passes and is left unchanged", () => {
    const bundle = bundleOf({
      instances: [{ ...box, children: [{ type: "expression", value: `"a"` }] }],
      meta: { description: `"About"` },
    });
    const before = JSON.stringify(bundle);
    expect(check(bundle)).not.toThrow();
    expect(JSON.stringify(bundle)).toBe(before);
  });

  test("names the page and the field", () => {
    expect(check(bundleOf({ meta: { description: "a()" } }))).toThrow(
      'The description of page "/" cannot be published: This function is not allowed.'
    );
  });

  test("names the instance and the property", () => {
    expect(
      check(
        bundleOf({
          instances: [box],
          props: [
            {
              id: "p",
              instanceId: "box",
              name: "title",
              type: "expression",
              value: "a()",
            },
          ],
        })
      )
    ).toThrow('The property "title" of instance "box" cannot be published');
  });

  test("names a resource's field", () => {
    expect(
      check(
        bundleOf({
          resources: [
            {
              id: "r",
              name: "News",
              method: "get",
              url: `"https://example.org"`,
              headers: [{ name: "a b", value: `"b"` }],
            },
          ],
        })
      )
    ).toThrow('The resource "News" header name of resource "r"');
  });

  test("runs with the switch on, after a drop that keeps everything", () => {
    expect(orgScriptMayRun()).toBe(true);
    const bundle = dropOrgScript(
      bundleOf({
        instances: [{ ...box, component: "ws:element", tag: "script" }],
      })
    );
    expect(bundle.build.instances).toHaveLength(2);
    expect(check(bundle)).toThrow('The tag of instance "box"');
  });
});
