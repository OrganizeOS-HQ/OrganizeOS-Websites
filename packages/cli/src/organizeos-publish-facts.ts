/**
 * OrganizeOS fork: each publish reports whether the build carries org code
 * (docs/ORGANIZEOS-FORK.md section 10, "Each publish reports whether it carries
 * org code"; spec 2026-11-20-builder-code-embeds-design.md, 4.5, in the
 * OrganizeOS repo).
 *
 * Org code, for this report, is an HTML Embed that a generated page renders
 * and whose `code` is not a static template icon (a bound one counts), a
 * Markdown Embed, or non-blank custom code. JSON-LD does not count: upstream
 * writes it as validated JSON with `<` escaped.
 *
 * The facts are computed where the code is emitted, from the exact instances
 * and props prebuild hands the page generator and the custom code string it
 * compiles, so anything an earlier prebuild step added is counted. A tripwire
 * reads each generated page module and fails the build when it renders an
 * embed the facts say it does not. The facts are written last, through a
 * temporary file and a rename, to the path the publish workflow passes in
 * (`ORGANIZEOS_PUBLISH_FACTS_FILE`), outside the directory it deploys.
 */
import { rename, writeFile } from "node:fs/promises";
import { parse } from "acorn";
import {
  blockTemplateComponent,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";
import { templateIconCodes } from "@organizeos/site-components/org-script";
import { stripGeneratedModule } from "./organizeos-generated-code";

/**
 * Whether a page renders org code: walks from the page's root through its
 * `id` children, skipping a Content Block's templates container as the
 * generator does, and finds a Markdown Embed, or an HTML Embed with a `code`
 * prop that is not a static string identical to a template icon.
 */
export const pageCarriesOrgCode = ({
  rootInstanceId,
  instances,
  props,
}: {
  rootInstanceId: string;
  instances: Map<Instance["id"], Instance>;
  props: Map<Prop["id"], Prop>;
}): boolean => {
  const codeProps = new Map<Instance["id"], Prop[]>();
  for (const prop of props.values()) {
    if (prop.name === "code") {
      const list = codeProps.get(prop.instanceId) ?? [];
      list.push(prop);
      codeProps.set(prop.instanceId, list);
    }
  }
  const visited = new Set<Instance["id"]>();
  const pending = [rootInstanceId];
  while (pending.length > 0) {
    const id = pending.pop() as Instance["id"];
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    const instance = instances.get(id);
    if (
      instance === undefined ||
      instance.component === blockTemplateComponent
    ) {
      continue;
    }
    if (instance.component === "MarkdownEmbed") {
      return true;
    }
    if (instance.component === "HtmlEmbed") {
      const codes = codeProps.get(id) ?? [];
      const isIcon = (prop: Prop) =>
        prop.type === "string" && templateIconCodes.has(prop.value);
      if (codes.some((prop) => isIcon(prop) === false)) {
        return true;
      }
    }
    for (const child of instance.children) {
      if (child.type === "id") {
        pending.push(child.value);
      }
    }
  }
  return false;
};

/** Whether the custom code prebuild emits is org code: any that is not blank. */
export const customCodeCarriesOrgCode = (code: string | undefined): boolean =>
  (code ?? "").trim() !== "";

type SyntaxNode = { type: string; [key: string]: unknown };

const isSyntaxNode = (value: unknown): value is SyntaxNode =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SyntaxNode).type === "string";

const embedNames = new Set(["HtmlEmbed", "MarkdownEmbed"]);

/** The element factory stripGeneratedModule writes JSX with. */
const jsxFactory = "jsxλ";

/**
 * How many times a generated module refers to HTML Embed and Markdown Embed:
 * the local names any import binds to the imported names `HtmlEmbed` or
 * `MarkdownEmbed`, from any source, and every reference to them. An HTML
 * Embed element whose only `code` is a string literal identical to a template
 * icon is not counted; any other reference to it is (an alias included).
 */
export const findEmbedUses = (
  module: string
): { htmlEmbeds: number; markdownEmbeds: number } => {
  const program = parse(stripGeneratedModule(module), {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as unknown as SyntaxNode;
  const locals = new Map<string, "HtmlEmbed" | "MarkdownEmbed">();
  for (const statement of program.body as SyntaxNode[]) {
    if (statement.type !== "ImportDeclaration") {
      continue;
    }
    for (const specifier of statement.specifiers as SyntaxNode[]) {
      const imported = specifier.imported as SyntaxNode | undefined;
      const importedName =
        imported?.type === "Identifier"
          ? (imported.name as string)
          : (imported?.value as string | undefined);
      if (
        specifier.type === "ImportSpecifier" &&
        importedName !== undefined &&
        embedNames.has(importedName)
      ) {
        locals.set(
          (specifier.local as SyntaxNode).name as string,
          importedName as "HtmlEmbed" | "MarkdownEmbed"
        );
      }
    }
  }
  const uses = { htmlEmbeds: 0, markdownEmbeds: 0 };
  if (locals.size === 0) {
    return uses;
  }
  // An HTML Embed element with one `code`, a template icon's literal, and no
  // spread
  const isIconElement = (call: SyntaxNode) => {
    const props = (call.arguments as SyntaxNode[])[1];
    if (props?.type !== "ObjectExpression") {
      return false;
    }
    const properties = props.properties as SyntaxNode[];
    if (properties.some((property) => property.type !== "Property")) {
      return false;
    }
    const codes = properties.filter((property) => {
      const key = property.key as SyntaxNode;
      return (
        property.computed === false &&
        ((key.type === "Identifier" && key.name === "code") ||
          (key.type === "Literal" && key.value === "code"))
      );
    });
    if (codes.length !== 1) {
      return false;
    }
    const value = codes[0].value as SyntaxNode;
    return (
      value.type === "Literal" &&
      typeof value.value === "string" &&
      templateIconCodes.has(value.value)
    );
  };
  const count = (name: string) => {
    const imported = locals.get(name);
    if (imported === "HtmlEmbed") {
      uses.htmlEmbeds += 1;
    } else if (imported === "MarkdownEmbed") {
      uses.markdownEmbeds += 1;
    }
  };
  const visit = (node: SyntaxNode): void => {
    switch (node.type) {
      case "ImportDeclaration":
        return;
      case "Identifier":
        count(node.name as string);
        return;
      case "MemberExpression":
        visit(node.object as SyntaxNode);
        if (node.computed) {
          visit(node.property as SyntaxNode);
        }
        return;
      case "Property":
        if (node.computed) {
          visit(node.key as SyntaxNode);
        }
        visit(node.value as SyntaxNode);
        return;
      case "CallExpression": {
        const callee = node.callee as SyntaxNode;
        const [component, ...rest] = node.arguments as SyntaxNode[];
        if (
          callee.type === "Identifier" &&
          callee.name === jsxFactory &&
          component?.type === "Identifier" &&
          locals.get(component.name as string) === "HtmlEmbed" &&
          isIconElement(node)
        ) {
          for (const argument of rest) {
            visit(argument);
          }
          return;
        }
        break;
      }
    }
    for (const value of Object.values(node)) {
      for (const child of Array.isArray(value) ? value : [value]) {
        if (isSyntaxNode(child)) {
          visit(child);
        }
      }
    }
  };
  visit(program);
  return uses;
};

/**
 * The tripwire: fails the build when a generated page module renders an
 * embed while the facts say the page carries no org code.
 */
export const assertEmbedFact = async (
  fact: boolean,
  module: string,
  file: string
): Promise<void> => {
  if (fact) {
    return;
  }
  const { htmlEmbeds, markdownEmbeds } = findEmbedUses(module);
  if (htmlEmbeds > 0 || markdownEmbeds > 0) {
    throw new Error(
      `The generated module ${file} renders an embed, and the publish facts say it carries no org code. Nothing was published.`
    );
  }
};

/** Writes the facts through a temporary file and a rename. */
export const writePublishFacts = async (
  file: string,
  facts: { orgScript: boolean }
): Promise<void> => {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(facts), "utf8");
  await rename(temporary, file);
};
