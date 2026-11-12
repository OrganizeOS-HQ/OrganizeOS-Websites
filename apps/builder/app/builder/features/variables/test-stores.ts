import type { CssProperty } from "@webstudio-is/css-engine";
import { ROOT_INSTANCE_ID, type Prop } from "@webstudio-is/sdk";
import {
  createDefaultPages,
  type RegistryVariable,
  type VariablesRegistry,
} from "@webstudio-is/project-build";
import type { Project } from "@webstudio-is/project";
import { selectInstance } from "~/shared/nano-states";
import { $selectedPageId } from "~/shared/nano-states/pages";
import { $authPermit, $builderMode } from "~/shared/nano-states/misc";
import { serverSyncStore } from "~/shared/sync/sync-stores";
import {
  $assets,
  $dataSources,
  $pages,
  $project,
  $projectSettings,
  $props,
  $resources,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";
import {
  el,
  root,
  setupProject,
  type TestStyle,
  type TestToken,
} from "~/builder/features/organizeos-panel/test-fixtures";

/**
 * Store fixtures for the Variables tests that write: a project the staged
 * path can commit, with undo. Not used by the app.
 */

export const undoDepth = () =>
  serverSyncStore.transactionManager.currentStack.length;

export type Fixture = {
  styles?: TestStyle[];
  tokens?: TestToken[];
  props?: Prop[];
  organizeos?: unknown;
  code?: string;
};

export const project = ({
  styles = [],
  tokens = [],
  props = [],
  organizeos,
  code,
}: Fixture) => {
  serverSyncStore.transactionManager.currentStack = [];
  serverSyncStore.transactionManager.undoneStack = [];
  serverSyncStore.popAll();
  const pages = createDefaultPages({ rootInstanceId: "body" });
  $pages.set(pages);
  $selectedPageId.set(pages.homePageId);
  $builderMode.set("design");
  $authPermit.set("build");
  $project.set({ id: "project-1" } as Project);
  setupProject({
    tree: el("body", "Body", [el("box", "Box")]),
    styles,
    tokens,
    props,
  });
  $dataSources.set(new Map());
  $resources.set(new Map());
  $assets.set(new Map());
  $projectSettings.set({
    meta: code === undefined ? {} : { code },
    compiler: {},
    organizeos,
  });
  selectInstance(["body"]);
};

// A page template, selected without build access: the one place the
// runtime layer refuses a commit (shared/instance-utils/data.ts).
export const selectPageTemplateWithoutBuildAccess = () => {
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

export const px = (value: number) =>
  ({ type: "unit", value, unit: "px" }) as const;
export const v = (value: string) => ({ type: "var", value }) as const;
export const teal = { type: "keyword", value: "teal" } as const;

export const css = (pairs: Record<string, string>): TestStyle[] =>
  Object.entries(pairs).map(([property, value]) => ({
    on: root,
    property: property as CssProperty,
    value,
  }));

export const site = (...variables: RegistryVariable[]): VariablesRegistry => ({
  version: 1,
  collections: [
    { id: "site", name: "Site", system: "site" },
    { id: "c1", name: "Spacing" },
  ],
  variables,
});

export const size = (
  cssName: string,
  collectionId = "site"
): RegistryVariable => ({
  cssName,
  collectionId,
  type: "size",
  name: cssName,
});

export const registry = () =>
  ($projectSettings.get()?.organizeos as { variables: VariablesRegistry })
    .variables;

export const allDecls = () => Array.from($styles.get().values());

export const styleOn = (styleSourceId: string | undefined, property: string) =>
  allDecls().find(
    (decl) =>
      decl.styleSourceId === styleSourceId &&
      decl.breakpointId === "base" &&
      decl.state === undefined &&
      decl.property === property
  )?.value;

/** The first local source of an instance's selection, whatever its id. */
export const localSourceOf = (instanceId: string) =>
  $styleSourceSelections
    .get()
    .get(instanceId)
    ?.values.find((id) => $styleSources.get().get(id)?.type === "local");

export const rootStyle = (property: string) =>
  styleOn(localSourceOf(ROOT_INSTANCE_ID), property);
export const boxStyle = (property: string) => styleOn("local-box", property);
export const tokenStyle = (token: string, property: string) =>
  styleOn(token, property);
export const prop = (name: string) =>
  Array.from($props.get().values()).find((item) => item.name === name)?.value;

export const embed = (value: string): Prop => ({
  id: "embed-code",
  instanceId: "box",
  name: "code",
  type: "string",
  value,
});
