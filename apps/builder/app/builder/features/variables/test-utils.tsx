import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { enableMapSet } from "immer";
import type { CssProperty } from "@webstudio-is/css-engine";
import { TooltipProvider } from "@webstudio-is/design-system";
import type { AuthPermit } from "@webstudio-is/trpc-interface/index.server";
import { $authPermit } from "~/shared/nano-states/misc";
import { registerContainers } from "~/shared/sync/sync-stores";
import {
  registerTestMetas,
  root,
  type TestStyle,
} from "~/builder/features/organizeos-panel/test-fixtures";
import {
  $openRailOverlay,
  openRailOverlay,
} from "~/builder/features/rail-overlay/rail-overlay";
import { project } from "./test-stores";
import { VariablesOverlay } from "./variables-overlay";
import { VariablesRailButton } from "./variables-rail-button";

/**
 * Render helpers for the Variables manager's tests: a project the staged
 * path can commit, and the rail button and overlay, opened. Not used by the
 * app.
 */

enableMapSet();
registerContainers();
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export { undoDepth } from "./test-stores";

/** The six Brand variables on Global Root, as a template site has them. */
export const BRAND_SIX: TestStyle[] = [
  ["--base", "#ffffff"],
  ["--accent-1", "#1597b0"],
  ["--accent-2", "#0b5394"],
  ["--text", "#1a1a1a"],
  ["--font-heading", '"Source Serif 4", Georgia, serif'],
  ["--font-body", '"Public Sans", system-ui'],
].map(([property, value]) => ({
  on: root,
  property: property as CssProperty,
  value,
}));

export const setupVariables = ({
  styles = [],
  registry,
  permit,
}: {
  styles?: TestStyle[];
  registry?: unknown;
  permit?: AuthPermit;
} = {}) => {
  registerTestMetas();
  project({
    styles,
    organizeos: registry === undefined ? undefined : { variables: registry },
  });
  $authPermit.set(permit ?? "build");
  $openRailOverlay.set(undefined);
  try {
    localStorage.clear();
  } catch {
    // a browser without storage still runs the suite
  }
};

let reactRoot: Root | undefined;
let container: HTMLElement | undefined;

export const renderManager = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  reactRoot = createRoot(container);
  act(() => {
    reactRoot?.render(
      createElement(
        TooltipProvider,
        null,
        createElement(VariablesRailButton),
        createElement(VariablesOverlay)
      )
    );
  });
  act(() => {
    openRailOverlay("variables");
  });
};

export const cleanupManager = () => {
  act(() => {
    $openRailOverlay.set(undefined);
    reactRoot?.unmount();
  });
  container?.remove();
  reactRoot = undefined;
  container = undefined;
};

export const manager = () =>
  document.querySelector<HTMLElement>("[data-variables-manager]");

export const rowOf = (cssName: string) =>
  document.querySelector<HTMLElement>(`[data-variable-row="${cssName}"]`);

export const rowNames = () =>
  Array.from(
    document.querySelectorAll<HTMLElement>("[data-variable-row]"),
    (row) => row.dataset.variableRow
  );

export const press = (
  key: string,
  target: EventTarget | null = manager(),
  init: KeyboardEventInit = {}
) => {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    (target ?? document.body).dispatchEvent(event);
  });
  return event;
};
