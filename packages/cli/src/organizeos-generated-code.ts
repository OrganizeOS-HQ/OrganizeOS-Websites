/**
 * OrganizeOS fork: while org script is paused, publishing checks every page
 * and server module it generates before it ships (docs/ORGANIZEOS-FORK.md
 * section 10, "Expressions"): each generated module reads no undeclared name,
 * past the globals it may read (`generatedCodeGlobals`), and shadows no
 * import. Anything else fails the publish.
 *
 * `findPausedExpressions` keeps an org's expressions to what the published
 * module declares where they are written; this check holds the generated code
 * itself to the same, whatever the generators change.
 */
import { transform } from "esbuild";
// TypeScript 5's compiler API: the CLI's own typescript is 7, which offers
// no transpileModule
import ts from "typescript-5";
import { parse } from "acorn";
import {
  generatedCodeGlobals,
  orgScriptMayRun,
} from "@organizeos/site-components/org-script";

type SyntaxNode = { type: string; [key: string]: unknown };

type NameScope = {
  names: Set<string>;
  parent?: NameScope;
};

const isSyntaxNode = (value: unknown): value is SyntaxNode =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SyntaxNode).type === "string";

const childNodes = (node: SyntaxNode) =>
  Object.values(node)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(isSyntaxNode);

const isFunctionNode = (node: SyntaxNode) =>
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "ArrowFunctionExpression";

/** What a generated module reads without declaring, and what it shadows */
export type GeneratedCodeNames = {
  /** names read or written that nothing in the module declares */
  undeclared: string[];
  /** imports that a binding below the module's top takes the name of */
  shadowed: string[];
};

/**
 * The names a module of plain JavaScript reads or writes that nothing in it
 * declares, the names it imports, and the names its scopes below the top
 * bind.
 */
export const readModuleNames = (code: string) => {
  const undeclared = new Set<string>();
  const imports = new Set<string>();
  const nested = new Set<string>();

  const bind = (pattern: SyntaxNode, names: Set<string>) => {
    if (pattern.type === "Identifier") {
      names.add(pattern.name as string);
    } else if (pattern.type === "ObjectPattern") {
      for (const property of pattern.properties as SyntaxNode[]) {
        bind(
          (property.type === "RestElement"
            ? property.argument
            : property.value) as SyntaxNode,
          names
        );
      }
    } else if (pattern.type === "ArrayPattern") {
      for (const element of pattern.elements as Array<SyntaxNode | null>) {
        if (element !== null) {
          bind(element, names);
        }
      }
    } else if (pattern.type === "RestElement") {
      bind(pattern.argument as SyntaxNode, names);
    } else if (pattern.type === "AssignmentPattern") {
      bind(pattern.left as SyntaxNode, names);
    }
  };

  // var and function declarations, which a function body or the module hoists
  const hoist = (node: SyntaxNode, names: Set<string>) => {
    if (node.type === "VariableDeclaration" && node.kind === "var") {
      for (const declarator of node.declarations as SyntaxNode[]) {
        bind(declarator.id as SyntaxNode, names);
      }
    }
    if (node.type === "FunctionDeclaration") {
      names.add((node.id as SyntaxNode).name as string);
    }
    if (isFunctionNode(node) || node.type === "ClassBody") {
      return;
    }
    for (const child of childNodes(node)) {
      hoist(child, names);
    }
  };

  // let, const, class and import declarations, which a block holds
  const declareLexical = (statements: SyntaxNode[], names: Set<string>) => {
    for (const statement of statements) {
      const declaration =
        statement.type === "ExportNamedDeclaration" ||
        statement.type === "ExportDefaultDeclaration"
          ? (statement.declaration as SyntaxNode | null)
          : statement;
      if (
        declaration?.type === "VariableDeclaration" &&
        declaration.kind !== "var"
      ) {
        for (const declarator of declaration.declarations as SyntaxNode[]) {
          bind(declarator.id as SyntaxNode, names);
        }
      }
      if (declaration?.type === "ClassDeclaration" && declaration.id) {
        names.add((declaration.id as SyntaxNode).name as string);
      }
      if (declaration?.type === "ImportDeclaration") {
        for (const specifier of declaration.specifiers as SyntaxNode[]) {
          names.add((specifier.local as SyntaxNode).name as string);
        }
      }
    }
  };

  const isVisible = (name: string, scope: NameScope | undefined) => {
    for (let current = scope; current; current = current.parent) {
      if (current.names.has(name)) {
        return true;
      }
    }
    return false;
  };

  // every scope below the module's top
  const enter = (names: Set<string>, parent: NameScope): NameScope => {
    for (const name of names) {
      nested.add(name);
    }
    return { names, parent };
  };

  // a pattern binds names; only its defaults and computed keys read any
  const visitPattern = (pattern: SyntaxNode, scope: NameScope) => {
    if (pattern.type === "Identifier") {
      return;
    }
    if (pattern.type === "ObjectPattern") {
      for (const property of pattern.properties as SyntaxNode[]) {
        if (property.type === "RestElement") {
          visitPattern(property.argument as SyntaxNode, scope);
        } else {
          if (property.computed) {
            visit(property.key as SyntaxNode, scope);
          }
          visitPattern(property.value as SyntaxNode, scope);
        }
      }
      return;
    }
    if (pattern.type === "ArrayPattern") {
      for (const element of pattern.elements as Array<SyntaxNode | null>) {
        if (element !== null) {
          visitPattern(element, scope);
        }
      }
      return;
    }
    if (pattern.type === "RestElement") {
      visitPattern(pattern.argument as SyntaxNode, scope);
      return;
    }
    if (pattern.type === "AssignmentPattern") {
      visitPattern(pattern.left as SyntaxNode, scope);
      visit(pattern.right as SyntaxNode, scope);
      return;
    }
    visit(pattern, scope);
  };

  const visitBlock = (statements: SyntaxNode[], scope: NameScope) => {
    const names = new Set<string>();
    declareLexical(statements, names);
    const inner = enter(names, scope);
    for (const statement of statements) {
      visit(statement, inner);
    }
  };

  const visit = (node: SyntaxNode, scope: NameScope): void => {
    switch (node.type) {
      case "Identifier":
        if (isVisible(node.name as string, scope) === false) {
          undeclared.add(node.name as string);
        }
        return;
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "Literal":
      case "TemplateElement":
      case "ThisExpression":
      case "Super":
      case "MetaProperty":
      case "BreakStatement":
      case "ContinueStatement":
        return;
      case "ExportNamedDeclaration":
        if (node.declaration) {
          visit(node.declaration as SyntaxNode, scope);
        } else if (node.source == null) {
          for (const specifier of node.specifiers as SyntaxNode[]) {
            visit(specifier.local as SyntaxNode, scope);
          }
        }
        return;
      case "MemberExpression":
        visit(node.object as SyntaxNode, scope);
        if (node.computed) {
          visit(node.property as SyntaxNode, scope);
        }
        return;
      case "Property":
      case "PropertyDefinition":
      case "MethodDefinition":
        if (node.computed) {
          visit(node.key as SyntaxNode, scope);
        }
        if (isSyntaxNode(node.value)) {
          visit(node.value, scope);
        }
        return;
      case "LabeledStatement":
        visit(node.body as SyntaxNode, scope);
        return;
      case "VariableDeclarator":
        visitPattern(node.id as SyntaxNode, scope);
        if (isSyntaxNode(node.init)) {
          visit(node.init, scope);
        }
        return;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression": {
        const names = new Set<string>();
        if (node.type === "FunctionExpression" && isSyntaxNode(node.id)) {
          names.add(node.id.name as string);
        }
        for (const param of node.params as SyntaxNode[]) {
          bind(param, names);
        }
        const body = node.body as SyntaxNode;
        if (body.type === "BlockStatement") {
          hoist(body, names);
        }
        const inner = enter(names, scope);
        if (node.type !== "ArrowFunctionExpression") {
          inner.names.add("arguments");
        }
        for (const param of node.params as SyntaxNode[]) {
          visitPattern(param, inner);
        }
        if (body.type === "BlockStatement") {
          visitBlock(body.body as SyntaxNode[], inner);
        } else {
          visit(body, inner);
        }
        return;
      }
      case "BlockStatement":
      case "StaticBlock":
        visitBlock(node.body as SyntaxNode[], scope);
        return;
      case "CatchClause": {
        const names = new Set<string>();
        if (isSyntaxNode(node.param)) {
          bind(node.param, names);
        }
        const inner = enter(names, scope);
        if (isSyntaxNode(node.param)) {
          visitPattern(node.param, inner);
        }
        visit(node.body as SyntaxNode, inner);
        return;
      }
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement": {
        const names = new Set<string>();
        const head = (node.init ?? node.left) as SyntaxNode | null;
        if (head?.type === "VariableDeclaration") {
          declareLexical([head], names);
        }
        const inner = enter(names, scope);
        for (const child of childNodes(node)) {
          visit(child, inner);
        }
        return;
      }
      case "ClassDeclaration":
      case "ClassExpression": {
        const names = new Set<string>();
        if (isSyntaxNode(node.id)) {
          names.add(node.id.name as string);
        }
        const inner = enter(names, scope);
        if (isSyntaxNode(node.superClass)) {
          visit(node.superClass, inner);
        }
        visit(node.body as SyntaxNode, inner);
        return;
      }
      case "SwitchStatement": {
        visit(node.discriminant as SyntaxNode, scope);
        const names = new Set<string>();
        for (const switchCase of node.cases as SyntaxNode[]) {
          declareLexical(switchCase.consequent as SyntaxNode[], names);
        }
        const inner = enter(names, scope);
        for (const switchCase of node.cases as SyntaxNode[]) {
          for (const child of childNodes(switchCase)) {
            visit(child, inner);
          }
        }
        return;
      }
      default:
        for (const child of childNodes(node)) {
          visit(child, scope);
        }
    }
  };

  const program = parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  }) as unknown as SyntaxNode;
  const names = new Set<string>();
  hoist(program, names);
  declareLexical(program.body as SyntaxNode[], names);
  for (const statement of program.body as SyntaxNode[]) {
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers as SyntaxNode[]) {
        imports.add((specifier.local as SyntaxNode).name as string);
      }
    }
  }
  const top: NameScope = { names };
  for (const statement of program.body as SyntaxNode[]) {
    visit(statement, top);
  }
  return {
    undeclared: [...undeclared],
    imports: [...imports],
    nested: [...nested],
  };
};

/** A generated TSX module compiled to read its undeclared names, its imports kept as they are written */
export const compileGeneratedModule = async (code: string) =>
  (
    await transform(code, {
      loader: "tsx",
      format: "esm",
      jsx: "automatic",
      tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
    })
  ).code;

/**
 * A generated TSX module with its types stripped to read its shadows, its
 * imports kept as they are written and its elements as calls of a factory no
 * binding can take
 */
export const stripGeneratedModule = (code: string) =>
  ts.transpileModule(code, {
    fileName: "module.tsx",
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      jsxFactory: "jsx\u03bb",
      jsxFragmentFactory: "Fragment\u03bb",
      verbatimModuleSyntax: true,
    },
  }).outputText;

/** What a generated module reads without declaring, past the globals it may read, and shadows */
export const findGeneratedCodeProblems = async (
  code: string
): Promise<GeneratedCodeNames> => {
  const compiled = readModuleNames(await compileGeneratedModule(code));
  const stripped = readModuleNames(stripGeneratedModule(code));
  return {
    undeclared: compiled.undeclared.filter(
      (name) => generatedCodeGlobals.has(name) === false
    ),
    shadowed: stripped.imports.filter((name) => stripped.nested.includes(name)),
  };
};

/**
 * Fails the publish when a module prebuild generated reads a name it does not
 * declare, past the globals it may read, or shadows an import, while org
 * script is paused.
 */
export const checkGeneratedModule = async (
  code: string,
  file: string,
  mayRun: boolean = orgScriptMayRun()
) => {
  if (mayRun) {
    return;
  }
  const { undeclared, shadowed } = await findGeneratedCodeProblems(code);
  if (undeclared.length > 0 || shadowed.length > 0) {
    const parts = [
      undeclared.length > 0
        ? `reads names it does not declare: ${undeclared.join(", ")}`
        : undefined,
      shadowed.length > 0 ? `shadows names: ${shadowed.join(", ")}` : undefined,
    ].filter((part) => part !== undefined);
    throw new Error(
      `Org script is paused, and the generated module ${file} ${parts.join("; ")}. Nothing was published.`
    );
  }
};
