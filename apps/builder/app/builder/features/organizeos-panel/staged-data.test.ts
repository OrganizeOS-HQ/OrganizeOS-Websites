import { beforeEach, describe, expect, test, vi } from "vitest";
import { enableMapSet } from "immer";
import {
  ROOT_INSTANCE_ID,
  coreMetas,
  elementComponent,
  type Breakpoint,
  type DataSource,
  type Instance,
  type Instances,
  type Resource,
  type WebstudioFragment,
} from "@webstudio-is/sdk";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import * as organizeosMetas from "@organizeos/site-components/metas";
import { createDefaultPages } from "@webstudio-is/project-build";
import {
  BuilderRuntimeError,
  catalogChangeMessage,
} from "@webstudio-is/project-build/runtime";
import {
  $registeredComponentMetas,
  registerComponentLibrary,
  selectInstance,
  $selectedInstanceSelector,
} from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $authPermit, $builderMode } from "~/shared/nano-states/misc";
import { registerContainers, serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $assets,
  $breakpoints,
  $dataSources,
  $instances,
  $pages,
  $project,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  executeStagedRuntimeMutation,
  getWebstudioData,
} from "~/shared/instance-utils/data";
import type { Project } from "@webstudio-is/project";
import {
  addToFolderMutable,
  insertCompletedFragment,
  mapInsertedInstanceIds,
  updateWebstudioDataStaged,
} from "./staged-data";

const { toastError, toastInfo } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));
vi.mock("~/shared/builder-api", () => ({
  builderApi: { toast: { error: toastError, info: toastInfo } },
}));
// Spied, not replaced: a factory that imports the original module waits on
// itself in the browser runner (the module is in an import cycle).
vi.mock("~/shared/instance-utils/data", { spy: true });

enableMapSet();
registerContainers();

$registeredComponentMetas.set(
  new Map(Object.entries({ ...defaultMetas, ...coreMetas }))
);
// the builder knows the OrganizeOS metas; the runtime's registry does not
registerComponentLibrary({
  namespace: "@organizeos/site-components",
  components: {},
  metas: organizeosMetas,
  templates: {},
});

const instance = (
  id: Instance["id"],
  component: Instance["component"],
  children: Instance["children"] = [],
  tag?: string
): Instance => ({
  type: "instance",
  id,
  component,
  children,
  ...(tag === undefined ? {} : { tag }),
});

const toMap = (instances: Instance[]): Instances =>
  new Map(instances.map((item) => [item.id, item]));

const setStores = () => {
  serverSyncStore.transactionManager.currentStack = [];
  serverSyncStore.transactionManager.undoneStack = [];
  serverSyncStore.popAll();
  const pages = createDefaultPages({ rootInstanceId: "body" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  $builderMode.set("design");
  $authPermit.set("build");
  $project.set({ id: "project-1" } as Project);
  $instances.set(
    toMap([
      instance("body", "Body", [{ type: "id", value: "box" }]),
      instance("box", "Box"),
    ])
  );
  $props.set(new Map());
  $breakpoints.set(new Map());
  $styleSourceSelections.set(new Map());
  $styleSources.set(new Map());
  $styles.set(new Map());
  $dataSources.set(new Map());
  $resources.set(new Map());
  $assets.set(new Map());
  selectInstance(["body"]);
};

const getStores = () => ({
  pages: $pages.get(),
  instances: $instances.get(),
  props: $props.get(),
  dataSources: $dataSources.get(),
  resources: $resources.get(),
  styles: $styles.get(),
  styleSources: $styleSources.get(),
  styleSourceSelections: $styleSourceSelections.get(),
  breakpoints: $breakpoints.get(),
});

const expectNothingWritten = (before: ReturnType<typeof getStores>) => {
  const after = getStores();
  for (const [name, store] of Object.entries(before)) {
    expect(after[name as keyof typeof after], name).toBe(store);
  }
  expect(serverSyncStore.transactionManager.currentStack).toEqual([]);
};

// A page template, selected without build access: the one place the
// runtime layer refuses a commit (shared/instance-utils/data.ts).
const selectPageTemplateWithoutBuildAccess = () => {
  const pages = $pages.get()!;
  $pages.set({
    ...pages,
    pageTemplates: new Map([
      [
        "template",
        {
          id: "template",
          name: "Template",
          title: "Template",
          rootInstanceId: "body",
          meta: {},
        },
      ],
    ]),
  });
  $selectedPageId.set("template");
  $authPermit.set("view");
};

beforeEach(() => {
  setStores();
  toastError.mockClear();
  toastInfo.mockClear();
});

describe("mapInsertedInstanceIds", () => {
  // two roots; the first holds a collection, an expression and a paragraph
  const fragment: Pick<WebstudioFragment, "children" | "instances"> = {
    children: [
      { type: "id", value: "a" },
      { type: "id", value: "b" },
    ],
    instances: [
      instance(
        "a",
        elementComponent,
        [
          { type: "id", value: "a-list" },
          { type: "expression", value: "1" },
          { type: "id", value: "a-text" },
        ],
        "div"
      ),
      instance("a-list", "ws:collection", [{ type: "id", value: "a-item" }]),
      instance("a-item", elementComponent, [], "p"),
      instance("a-text", elementComponent, [], "p"),
      instance("b", "Box", [{ type: "id", value: "b-child" }]),
      instance("b-child", "Box", [{ type: "id", value: "b-grandchild" }]),
      instance("b-grandchild", "Box"),
    ],
  };

  test("maps every instance of both roots, past an expression child", () => {
    const inserted = toMap([
      instance(
        "A",
        elementComponent,
        [
          { type: "id", value: "A-list" },
          { type: "expression", value: "1" },
          { type: "id", value: "A-text" },
        ],
        "div"
      ),
      instance("A-list", "ws:collection", [{ type: "id", value: "A-item" }]),
      instance("A-item", elementComponent, [], "p"),
      instance("A-text", elementComponent, [], "p"),
      instance("B", "Box", [{ type: "id", value: "B-child" }]),
      instance("B-child", "Box", [{ type: "id", value: "B-grandchild" }]),
      instance("B-grandchild", "Box"),
    ]);

    expect(mapInsertedInstanceIds(fragment, inserted, ["A", "B"])).toEqual(
      new Map([
        ["a", "A"],
        ["a-list", "A-list"],
        ["a-item", "A-item"],
        ["a-text", "A-text"],
        ["b", "B"],
        ["b-child", "B-child"],
        ["b-grandchild", "B-grandchild"],
      ])
    );
  });

  test("stops below an instance whose component differs", () => {
    const inserted = toMap([
      instance("A", elementComponent, [], "div"),
      instance("B", "Box", [{ type: "id", value: "B-child" }]),
      // not the template's Box
      instance("B-child", "Text", [{ type: "id", value: "B-grandchild" }]),
      instance("B-grandchild", "Box"),
    ]);

    expect(mapInsertedInstanceIds(fragment, inserted, ["A", "B"])).toEqual(
      new Map([
        ["a", "A"],
        ["b", "B"],
      ])
    );
  });
});

describe("updateWebstudioDataStaged", () => {
  test("one write is one undo step", async () => {
    const before = getWebstudioData();

    expect(
      await updateWebstudioDataStaged((data) => {
        data.props.set("prop", {
          id: "prop",
          instanceId: "box",
          name: "id",
          type: "string",
          value: "events",
        });
        return "written";
      })
    ).toBe("written");

    expect($props.get().get("prop")).toMatchObject({ value: "events" });
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(1);
    serverSyncStore.undo();
    expect(getWebstudioData()).toEqual(before);
  });

  test("a recipe that changes nothing commits nothing", async () => {
    const before = getStores();

    expect(await updateWebstudioDataStaged(() => false)).toBe(false);

    expectNothingWritten(before);
  });

  test("rejects, staging nothing, without build access", async () => {
    selectPageTemplateWithoutBuildAccess();
    const before = getStores();
    const recipe = vi.fn();

    await expect(updateWebstudioDataStaged(recipe)).rejects.toThrow(
      "Page templates can be edited only in design mode"
    );

    expect(recipe).not.toHaveBeenCalled();
    expectNothingWritten(before);
  });
});

describe("stageWebstudioDataMutable's catalog guard", () => {
  // the ids provisioning derives are v5 UUIDs
  const catalogId = "385fcd4c-92f8-5d7c-abfe-cb941b8f2449";
  const catalogBindingId = "6f1c2a9e-1b2c-5d3e-8f4a-1234567890ab";
  const catalogResource: Resource = {
    id: catalogId,
    name: "Events",
    method: "get",
    url: `"https://app.example.org/api/public/v1/events"`,
    headers: [{ name: "Authorization", value: `"Bearer osk_token"` }],
  };
  const catalogBinding: DataSource = {
    type: "resource",
    id: catalogBindingId,
    scopeInstanceId: ROOT_INSTANCE_ID,
    name: "Events",
    resourceId: catalogId,
  };
  const ownResource: Resource = {
    id: "own-resource",
    name: "Own",
    method: "get",
    url: `"https://example.org/own"`,
    headers: [],
  };
  const withCatalog = () => {
    $resources.set(
      new Map([
        [catalogId, catalogResource],
        [ownResource.id, ownResource],
      ])
    );
    $dataSources.set(new Map([[catalogBindingId, catalogBinding]]));
  };

  test.each([
    [
      "changes a catalog Resource",
      (
        data: Parameters<Parameters<typeof updateWebstudioDataStaged>[0]>[0]
      ) => {
        data.resources.get(catalogId)!.url = `"https://evil.example/"`;
      },
    ],
    [
      "replaces a catalog Resource",
      (
        data: Parameters<Parameters<typeof updateWebstudioDataStaged>[0]>[0]
      ) => {
        data.resources.set(catalogId, { ...catalogResource });
      },
    ],
    [
      "deletes a catalog Resource",
      (
        data: Parameters<Parameters<typeof updateWebstudioDataStaged>[0]>[0]
      ) => {
        data.resources.delete(catalogId);
      },
    ],
    [
      "changes a catalog :root binding",
      (
        data: Parameters<Parameters<typeof updateWebstudioDataStaged>[0]>[0]
      ) => {
        data.dataSources.get(catalogBindingId)!.name = "Renamed";
      },
    ],
    [
      "deletes a catalog :root binding",
      (
        data: Parameters<Parameters<typeof updateWebstudioDataStaged>[0]>[0]
      ) => {
        data.dataSources.delete(catalogBindingId);
      },
    ],
  ])("refuses a recipe that %s, staging nothing", async (_case, recipe) => {
    withCatalog();
    const before = getStores();

    await expect(updateWebstudioDataStaged(recipe)).rejects.toThrow(
      "Cannot change your organization's data catalog."
    );

    expectNothingWritten(before);
  });

  // OrganizeOS fork (the data-automatic plan's D8): the binding loop is the
  // runtime lock's own rule, with its message.
  test.each([
    ["rescopes", { scopeInstanceId: "body" }],
    ["repoints", { resourceId: ownResource.id }],
    ["renames", { name: "Renamed" }],
  ])(
    "refuses a recipe that %s a catalog :root binding through the shared rule",
    async (_case, change) => {
      withCatalog();
      const before = getStores();
      const refusal = updateWebstudioDataStaged((data) => {
        data.dataSources.set(catalogBindingId, {
          ...catalogBinding,
          ...change,
        } as DataSource);
      });
      await expect(refusal).rejects.toBeInstanceOf(BuilderRuntimeError);
      await expect(refusal).rejects.toThrow(catalogChangeMessage);
      expectNothingWritten(before);
    }
  );

  test("adds a missing catalog Resource, and changes the project's own", async () => {
    $resources.set(new Map([[ownResource.id, ownResource]]));

    await updateWebstudioDataStaged((data) => {
      data.resources.set(catalogId, catalogResource);
      data.resources.get(ownResource.id)!.name = "Own (edited)";
      data.dataSources.set(catalogBindingId, catalogBinding);
    });

    expect($resources.get().get(catalogId)).toEqual(catalogResource);
    expect($resources.get().get(ownResource.id)?.name).toBe("Own (edited)");
    expect($dataSources.get().get(catalogBindingId)).toEqual(catalogBinding);
  });

  test("leaves the catalog alone, and writes, when the recipe does not touch it", async () => {
    withCatalog();
    const resources = $resources.get();

    await updateWebstudioDataStaged((data) => {
      data.dataSources.set("page-binding", {
        ...catalogBinding,
        id: "page-binding",
        scopeInstanceId: "body",
      });
    });

    expect($resources.get()).toBe(resources);
    expect($dataSources.get().get(catalogBindingId)).toBe(catalogBinding);
    expect($dataSources.get().has("page-binding")).toBe(true);
  });

  test("refuses an insert whose completion changes the catalog, toasting once", async () => {
    withCatalog();
    const before = getStores();

    expect(
      await insertCompletedFragment({
        fragment: {
          children: [{ type: "id", value: "root" }],
          instances: [instance("root", elementComponent, [], "div")],
          props: [],
          dataSources: [],
          resources: [],
          styleSourceSelections: [],
          styleSources: [],
          styles: [],
          breakpoints: [],
          assets: [],
        },
        complete: (data) => {
          data.resources.delete(catalogId);
        },
      })
    ).toBe(false);

    expectNothingWritten(before);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Cannot change your organization's data catalog."
    );
  });
});

describe("addToFolderMutable", () => {
  test("appends to the root folder", () => {
    const pages = createDefaultPages({ rootInstanceId: "body" });
    addToFolderMutable(pages, "new-page");
    expect(pages.folders.get(pages.rootFolderId)?.children.at(-1)).toBe(
      "new-page"
    );
  });

  test("an unknown folder falls back to the root folder", () => {
    const pages = createDefaultPages({ rootInstanceId: "body" });
    addToFolderMutable(pages, "new-page", "no-such-folder");
    expect(pages.folders.get(pages.rootFolderId)?.children.at(-1)).toBe(
      "new-page"
    );
  });
});

describe("insertCompletedFragment", () => {
  const fragment: WebstudioFragment = {
    children: [{ type: "id", value: "root" }],
    instances: [
      instance(
        "root",
        elementComponent,
        [{ type: "id", value: "inner" }],
        "div"
      ),
      instance("inner", elementComponent, [], "p"),
    ],
    props: [],
    dataSources: [],
    resources: [],
    styleSourceSelections: [],
    styleSources: [],
    styles: [],
    breakpoints: [],
    assets: [],
  };

  test("inserts at the selection, completes the copy by its new ids and selects its root, in one undo step", async () => {
    selectInstance(["box", "body"]);
    const before = getWebstudioData();
    const complete = vi.fn(
      (
        data: Parameters<
          Parameters<typeof insertCompletedFragment>[0]["complete"]
        >[0],
        ids: Map<string, string>,
        rootId: string
      ) => {
        data.props.set("bound", {
          id: "bound",
          instanceId: ids.get("inner")!,
          name: "id",
          type: "string",
          value: rootId,
        });
      }
    );

    expect(await insertCompletedFragment({ fragment, complete })).toBe(true);

    const [[, ids, rootId]] = complete.mock.calls;
    expect(ids.get("root")).toBe(rootId);
    expect(rootId).not.toBe("root");
    expect($instances.get().get("box")?.children).toEqual([
      { type: "id", value: rootId },
    ]);
    expect($instances.get().get(rootId)?.children).toEqual([
      { type: "id", value: ids.get("inner") },
    ]);
    expect($props.get().get("bound")).toMatchObject({
      instanceId: ids.get("inner"),
      value: rootId,
    });
    expect($selectedInstanceSelector.get()).toEqual([rootId, "box", "body"]);
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(1);
    expect(toastError).not.toHaveBeenCalled();

    serverSyncStore.undo();
    expect(getWebstudioData()).toEqual(before);
  });

  test("inserts at the insertable it is given", async () => {
    const complete = vi.fn();

    expect(
      await insertCompletedFragment({
        fragment,
        insertable: { parentSelector: ["body"], position: 0 },
        complete,
      })
    ).toBe(true);

    const [[, , rootId]] = complete.mock.calls;
    expect($instances.get().get("body")?.children).toEqual([
      { type: "id", value: rootId },
      { type: "id", value: "box" },
    ]);
  });

  test("without build access, toasts the refusal once and writes nothing", async () => {
    selectPageTemplateWithoutBuildAccess();
    const before = getStores();
    const complete = vi.fn();

    expect(await insertCompletedFragment({ fragment, complete })).toBe(false);

    expect(complete).not.toHaveBeenCalled();
    expectNothingWritten(before);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "Page templates can be edited only in design mode, with build access."
    );
  });

  test("a refusal while staging toasts its message once and writes nothing", async () => {
    const before = getStores();

    expect(
      await insertCompletedFragment({
        fragment,
        complete: () => {
          throw new BuilderRuntimeError("BAD_REQUEST", "Refused here.");
        },
      })
    ).toBe(false);

    expectNothingWritten(before);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Refused here.");
  });

  // commitRuntimeMutation toasts its own refusal (a block inside MDX content)
  // and then throws it: no second toast (ruling data OQ7)
  test("the commit's own refusal is not toasted again", async () => {
    const before = getStores();
    const actual = await vi.importActual<
      typeof import("~/shared/instance-utils/data")
    >("~/shared/instance-utils/data");
    // the stage runs, then the commit refuses
    vi.mocked(executeStagedRuntimeMutation).mockImplementationOnce((stage) =>
      actual.executeStagedRuntimeMutation(async (accumulator) => {
        await stage(accumulator);
        throw new BuilderRuntimeError("BAD_REQUEST", "Refused by the commit.");
      })
    );

    expect(
      await insertCompletedFragment({ fragment, complete: () => {} })
    ).toBe(false);

    expectNothingWritten(before);
    expect(toastError).not.toHaveBeenCalled();
  });

  test("a fragment with no place to go writes nothing and is left to upstream's own warning", async () => {
    const before = getStores();
    const complete = vi.fn();

    expect(
      await insertCompletedFragment({
        // a descendant goes inside a component that declares it, never a Box
        fragment: {
          ...fragment,
          instances: [instance("root", "ws:descendant")],
        },
        complete,
      })
    ).toBe(false);

    expect(complete).not.toHaveBeenCalled();
    expectNothingWritten(before);
    expect(toastError).not.toHaveBeenCalled();
  });

  test("says once when the project's breakpoints were merged, in one undo step", async () => {
    // the base and eight more: the limit
    $breakpoints.set(
      new Map<Breakpoint["id"], Breakpoint>([
        ["base", { id: "base", label: "Base" }],
        ...Array.from(
          { length: 8 },
          (_, index) =>
            [
              `bp-${index}`,
              {
                id: `bp-${index}`,
                label: `${index}`,
                maxWidth: 100 * (index + 1),
              },
            ] as [Breakpoint["id"], Breakpoint]
        ),
      ])
    );
    const complete = vi.fn();

    expect(
      await insertCompletedFragment({
        fragment: {
          ...fragment,
          breakpoints: [{ id: "extra", label: "Extra", maxWidth: 850 }],
          styleSources: [{ type: "local", id: "local" }],
          styleSourceSelections: [{ instanceId: "root", values: ["local"] }],
          styles: [
            {
              styleSourceId: "local",
              breakpointId: "extra",
              property: "color",
              value: { type: "keyword", value: "red" },
            },
          ],
        },
        complete,
      })
    ).toBe(true);

    expect(complete).toHaveBeenCalledTimes(1);
    expect($breakpoints.get().size).toBe(9);
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith(
      "Some breakpoints were merged because the project reached the breakpoint limit."
    );
    expect(serverSyncStore.transactionManager.currentStack).toHaveLength(1);
  });

  describe("the content model's own warnings", () => {
    // what the builder's metas allow and the runtime's registry, which has no
    // OrganizeOS metas, refuses: Rich Text's descendants
    const richText: WebstudioFragment = {
      ...fragment,
      instances: [
        instance("root", "@organizeos/site-components:RichText", [
          { type: "id", value: "paragraph" },
        ]),
        instance("paragraph", "ws:descendant"),
      ],
      props: [
        {
          id: "selector",
          instanceId: "paragraph",
          name: "selector",
          type: "string",
          value: " p",
        },
      ],
    };

    test("refuse a fragment inserted without the option, toasting once and writing nothing", async () => {
      const before = getStores();
      const complete = vi.fn();

      expect(
        await insertCompletedFragment({ fragment: richText, complete })
      ).toBe(false);

      expect(complete).not.toHaveBeenCalled();
      expectNothingWritten(before);
      expect(toastError).toHaveBeenCalledTimes(1);
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining(
          'Placing "descendant" element inside a "RichText"'
        )
      );
    });

    test("let it in with the option", async () => {
      expect(
        await insertCompletedFragment({
          fragment: richText,
          allowContentModelWarnings: true,
          complete: () => {},
        })
      ).toBe(true);

      expect(toastError).not.toHaveBeenCalled();
      expect(
        [...$instances.get().values()].map(({ component }) => component)
      ).toContain("@organizeos/site-components:RichText");
    });
  });
});
