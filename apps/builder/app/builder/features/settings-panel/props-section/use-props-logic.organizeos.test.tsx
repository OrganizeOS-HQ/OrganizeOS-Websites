// OrganizeOS fork: the canvas registers the HTML Embed without "Run scripts
// on canvas" (withOrgScriptPolicy, canvas/organizeos-org-script.tsx). A project
// that saved the prop still lists it, as an added attribute row under its raw
// name, because upstream's props panel lists a saved prop with no meta that
// way. That is accepted (plan A, D13): the canvas ignores the value, and
// hiding the row would mean a change to this upstream module.
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, expect, test } from "vitest";
import type { Instance, Prop } from "@webstudio-is/sdk";
import { canvasComponentLibraries } from "@webstudio-is/sdk-components-registry/canvas";
import { withOrgScriptPolicy } from "~/canvas/organizeos-org-script";
import {
  $registeredComponentMetas,
  selectInstance,
} from "~/shared/nano-states";
import { $instances, $props } from "~/shared/sync/data-stores";
import { usePropsLogic } from "./use-props-logic";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  selectInstance(undefined);
  $instances.set(new Map());
  $props.set(new Map());
});

test("a saved executeScriptOnCanvas shows as an added attribute row", () => {
  const [, library] = canvasComponentLibraries;
  const meta = withOrgScriptPolicy(library, { embedsMayShip: false }).metas
    .HtmlEmbed;
  expect(meta.props).not.toHaveProperty("executeScriptOnCanvas");
  $registeredComponentMetas.set(new Map([["HtmlEmbed", meta]]));
  const instance: Instance = {
    type: "instance",
    id: "embed",
    component: "HtmlEmbed",
    children: [],
  };
  const props: Prop[] = [
    {
      id: "code",
      instanceId: "embed",
      name: "code",
      type: "string",
      value: "<p>x</p>",
    },
    {
      id: "run",
      instanceId: "embed",
      name: "executeScriptOnCanvas",
      type: "boolean",
      value: true,
    },
  ];
  $instances.set(new Map([["embed", instance]]));
  $props.set(new Map(props.map((prop) => [prop.id, prop])));
  selectInstance(["embed"]);

  let result: ReturnType<typeof usePropsLogic> | undefined;
  const Probe = () => {
    result = usePropsLogic({ instance, props, updateProp: () => {} });
    return null;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<Probe />));

  expect(result?.addedProps.map(({ propName }) => propName)).toContain(
    "executeScriptOnCanvas"
  );
  expect(result?.initialProps.map(({ propName }) => propName)).not.toContain(
    "executeScriptOnCanvas"
  );
});
