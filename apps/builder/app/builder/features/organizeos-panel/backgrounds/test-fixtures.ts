/**
 * Hand-built stores for the style-model and contrast tests. Not used by the
 * app.
 */
import type { CssProperty, StyleValue } from "@webstudio-is/css-engine";
import { camelCaseProperty, parseCssValue } from "@webstudio-is/css-data";
import {
  coreMetas,
  getStyleDeclKey,
  ROOT_INSTANCE_ID,
  type Breakpoint,
  type Instance,
  type Prop,
  type StyleDecl,
  type StyleSource,
  type WsComponentMeta,
} from "@webstudio-is/sdk";
import * as defaultMetas from "@webstudio-is/sdk-components-react/metas";
import * as organizeosMetas from "@organizeos/site-components/metas";
import {
  $registeredComponentMetas,
  $selectedBreakpointId,
} from "~/shared/nano-states";
import {
  $breakpoints,
  $instances,
  $props,
  $styleSourceSelections,
  $styleSources,
  $styles,
} from "~/shared/sync/data-stores";

export const organizeosNamespace = "@organizeos/site-components";

export const registerTestMetas = () => {
  $registeredComponentMetas.set(
    new Map<string, WsComponentMeta>([
      ...Object.entries({ ...defaultMetas, ...coreMetas }),
      ...Object.entries(organizeosMetas).map(
        ([name, meta]) => [`${organizeosNamespace}:${name}`, meta] as const
      ),
    ])
  );
};

export type Node = {
  id: string;
  component: string;
  tag?: string;
  children?: Array<Node | string | { expression: string }>;
};

/** An instance; a string child is text. */
export const el = (
  id: string,
  component: string,
  children: Node["children"] = [],
  tag?: string
): Node => ({ id, component, children, tag });

export type TestStyle = {
  /** an instance id, or ROOT_INSTANCE_ID for Global Root */
  on: string;
  property: CssProperty;
  value: string | StyleValue;
  breakpoint?: string;
  /** a token id; the instance's local source when absent */
  token?: string;
  state?: string;
};

export type TestToken = { id: string; name: string; on: string[] };

const base: Breakpoint = { id: "base", label: "Base" };
const tablet: Breakpoint = { id: "tablet", label: "Tablet", maxWidth: 991 };

export const localId = (instanceId: string) => `local-${instanceId}`;

export const toStyleValue = (property: CssProperty, value: string) => {
  const parsed = parseCssValue(property, value);
  if (parsed.type === "invalid") {
    throw new Error(`Invalid ${property}: ${value}`);
  }
  return parsed;
};

export const setupProject = ({
  tree,
  styles = [],
  tokens = [],
  props = [],
  breakpoint = "base",
}: {
  tree: Node;
  styles?: TestStyle[];
  tokens?: TestToken[];
  props?: Prop[];
  breakpoint?: string;
}) => {
  const instances = new Map<string, Instance>();
  const visit = (node: Node) => {
    instances.set(node.id, {
      type: "instance",
      id: node.id,
      component: node.component,
      ...(node.tag === undefined ? {} : { tag: node.tag }),
      children: (node.children ?? []).map((child) =>
        typeof child === "string"
          ? { type: "text" as const, value: child }
          : "expression" in child
            ? { type: "expression" as const, value: child.expression }
            : { type: "id" as const, value: child.id }
      ),
    });
    for (const child of node.children ?? []) {
      if (typeof child !== "string" && "id" in child) {
        visit(child);
      }
    }
  };
  visit(tree);
  $instances.set(instances);
  $props.set(new Map(props.map((prop) => [prop.id, prop])));
  $breakpoints.set(
    new Map([
      [base.id, base],
      [tablet.id, tablet],
    ])
  );
  $selectedBreakpointId.set(breakpoint);

  const styleSources = new Map<string, StyleSource>();
  const selections = new Map<string, string[]>();
  for (const token of tokens) {
    styleSources.set(token.id, {
      type: "token",
      id: token.id,
      name: token.name,
    });
    for (const instanceId of token.on) {
      selections.set(instanceId, [
        ...(selections.get(instanceId) ?? []),
        token.id,
      ]);
    }
  }
  const decls: StyleDecl[] = [];
  for (const style of styles) {
    let styleSourceId = style.token;
    if (styleSourceId === undefined) {
      styleSourceId = localId(style.on);
      styleSources.set(styleSourceId, { type: "local", id: styleSourceId });
      const values = selections.get(style.on) ?? [];
      if (values.includes(styleSourceId) === false) {
        selections.set(style.on, [...values, styleSourceId]);
      }
    }
    decls.push({
      styleSourceId,
      breakpointId: style.breakpoint ?? "base",
      ...(style.state === undefined ? {} : { state: style.state }),
      property: camelCaseProperty(style.property),
      value:
        typeof style.value === "string"
          ? toStyleValue(style.property, style.value)
          : style.value,
    });
  }
  $styleSources.set(styleSources);
  $styleSourceSelections.set(
    new Map(
      Array.from(selections, ([instanceId, values]) => [
        instanceId,
        { instanceId, values },
      ])
    )
  );
  $styles.set(new Map(decls.map((decl) => [getStyleDeclKey(decl), decl])));
};

/** Global Root's id, for `TestStyle.on`. */
export const root = ROOT_INSTANCE_ID;
