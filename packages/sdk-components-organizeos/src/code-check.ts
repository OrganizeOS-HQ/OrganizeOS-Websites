import { parseExpressionAt, type Node } from "acorn";
import {
  allowedArrayMethods,
  allowedStringMethods,
  decodeDataVariableId,
  SYSTEM_VARIABLE_ID,
  tags,
  type DataSource,
  type Instance,
  type Page,
  type Pages,
  type PageTemplate,
  type Prop,
  type Resource,
} from "@webstudio-is/sdk";

/**
 * Input validation for the expressions, actions and generated names a build
 * holds, before any of them is compiled or published. One set of rules, used
 * by prebuild, the canvas, the builder's editors, patch save and the Publish
 * dialog alike. It only reads: a value passes or is refused, and is never
 * rewritten.
 *
 * A value passes only if it is exactly one expression made of the kinds of
 * syntax the builder's editors write: literals, templates, arrays and objects
 * with plain keys, variables, member access by a plain name or a literal key,
 * unary, binary, logical and conditional operators, calls to the string and
 * array methods the editors offer, and, in an action, assignment to a
 * variable. Everything else is refused.
 */
export type CodeCheck = { ok: true } | { ok: false; reason: string };

const pass: CodeCheck = { ok: true };
const refuse = (reason: string): CodeCheck => ({ ok: false, reason });

const reasons = {
  empty: "Expression is empty",
  syntax: "Not a valid expression",
  single: "Only one expression is allowed",
  comment: "Comments are not allowed",
  node: "This syntax is not allowed",
  member: "This property is not allowed",
  call: "This function is not allowed",
  variable: "Unknown variable",
  assignment: "Only a variable can be assigned",
  argument: "Not a valid argument name",
  header: "Not a valid header name",
  searchParam: "Not a valid parameter name",
  tag: "Not an allowed tag",
} as const;

/** Names that reach an object's prototype chain or its constructor. */
export const forbiddenMemberNames: ReadonlySet<string> = new Set([
  "constructor",
  "prototype",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

const allowedMethods: ReadonlySet<string> = new Set([
  ...allowedStringMethods,
  ...allowedArrayMethods,
]);

const unaryOperators: ReadonlySet<string> = new Set([
  "-",
  "+",
  "!",
  "~",
  "typeof",
  "void",
]);

const dataSourcePrefix = "$ws$dataSource$";
const systemVariable = "$ws$system";
// what `encodeDataVariableId` writes for a nanoid or a UUID
const dataSourceVariable = /^\$ws\$dataSource\$[A-Za-z0-9_]+$/;
// what the builder's `encodeDataVariableName` writes for a variable that is
// not set in this project (an expression pasted from another one)
const unsetVariableName = /^(?:[A-Za-z_]|\$\d+\$)+$/;

type Scope =
  | { kind: "value" }
  | {
      kind: "action";
      args: ReadonlySet<string>;
      dataSourceIds?: ReadonlySet<string>;
    };

type SyntaxNode = Node & { [key: string]: unknown };

const asNode = (value: unknown) => value as SyntaxNode;

const reservedWords: ReadonlySet<string> = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const isDataSourceVariable = (name: string, scope: Scope) => {
  if (dataSourceVariable.test(name) === false) {
    return false;
  }
  if (scope.kind === "action" && scope.dataSourceIds !== undefined) {
    const id = decodeDataVariableId(name);
    return id !== undefined && scope.dataSourceIds.has(id);
  }
  return true;
};

const identifierMayRead = (name: string, scope: Scope) => {
  if (name === "undefined" || name === systemVariable) {
    return true;
  }
  if (name.startsWith(dataSourcePrefix)) {
    return isDataSourceVariable(name, scope);
  }
  if (scope.kind === "action") {
    return scope.args.has(name);
  }
  return unsetVariableName.test(name) && reservedWords.has(name) === false;
};

/** A member's property: a plain name or a literal key, never a forbidden one. */
const checkProperty = (node: SyntaxNode, source: string): CodeCheck => {
  const property = asNode(node.property);
  if (node.computed === false) {
    if (property.type !== "Identifier") {
      return refuse(reasons.node);
    }
    const name = property.name as string;
    if (source.slice(property.start, property.end) !== name) {
      return refuse(reasons.node);
    }
    return forbiddenMemberNames.has(name) ? refuse(reasons.member) : pass;
  }
  if (property.type !== "Literal") {
    return refuse(reasons.member);
  }
  const value = property.value;
  if (typeof value !== "string" && typeof value !== "number") {
    return refuse(reasons.member);
  }
  return forbiddenMemberNames.has(String(value))
    ? refuse(reasons.member)
    : pass;
};

const checkAll = (
  nodes: unknown[],
  source: string,
  scope: Scope
): CodeCheck => {
  for (const node of nodes) {
    const result = checkNode(asNode(node), source, scope);
    if (result.ok === false) {
      return result;
    }
  }
  return pass;
};

const checkAssignmentTarget = (
  node: SyntaxNode,
  source: string,
  scope: Scope
): CodeCheck => {
  if (node.type === "Identifier") {
    const name = node.name as string;
    if (source.slice(node.start, node.end) !== name) {
      return refuse(reasons.node);
    }
    return isDataSourceVariable(name, scope)
      ? pass
      : refuse(reasons.assignment);
  }
  if (node.type === "MemberExpression" && node.optional !== true) {
    const property = checkProperty(node, source);
    if (property.ok === false) {
      return property;
    }
    return checkAssignmentTarget(asNode(node.object), source, scope);
  }
  return refuse(reasons.assignment);
};

const checkNode = (
  node: SyntaxNode,
  source: string,
  scope: Scope
): CodeCheck => {
  switch (node.type) {
    case "Literal":
      return pass;
    case "Identifier": {
      const name = node.name as string;
      // written as it reads, with no escapes
      if (source.slice(node.start, node.end) !== name) {
        return refuse(reasons.node);
      }
      return identifierMayRead(name, scope) ? pass : refuse(reasons.variable);
    }
    case "TemplateLiteral":
      return checkAll(node.expressions as unknown[], source, scope);
    case "ArrayExpression": {
      const elements = node.elements as Array<SyntaxNode | null>;
      if (elements.some((element) => element?.type === "SpreadElement")) {
        return refuse(reasons.node);
      }
      return checkAll(
        elements.filter((element) => element !== null),
        source,
        scope
      );
    }
    case "ObjectExpression": {
      for (const property of node.properties as SyntaxNode[]) {
        if (
          property.type !== "Property" ||
          property.kind !== "init" ||
          property.method === true ||
          property.computed === true
        ) {
          return refuse(reasons.node);
        }
        const key = asNode(property.key);
        const keyName =
          key.type === "Identifier"
            ? (key.name as string)
            : key.type === "Literal"
              ? String(key.value)
              : undefined;
        if (keyName === undefined || forbiddenMemberNames.has(keyName)) {
          return refuse(reasons.member);
        }
        const value = checkNode(asNode(property.value), source, scope);
        if (value.ok === false) {
          return value;
        }
      }
      return pass;
    }
    case "ParenthesizedExpression":
    case "ChainExpression":
      return checkNode(asNode(node.expression), source, scope);
    case "MemberExpression": {
      const object = asNode(node.object);
      if (object.type === "Super") {
        return refuse(reasons.node);
      }
      const property = checkProperty(node, source);
      if (property.ok === false) {
        return property;
      }
      return checkNode(object, source, scope);
    }
    case "UnaryExpression":
      if (unaryOperators.has(node.operator as string) === false) {
        return refuse(reasons.node);
      }
      return checkNode(asNode(node.argument), source, scope);
    case "BinaryExpression":
    case "LogicalExpression":
      return checkAll([node.left, node.right], source, scope);
    case "ConditionalExpression":
      return checkAll(
        [node.test, node.consequent, node.alternate],
        source,
        scope
      );
    case "CallExpression": {
      const callee = asNode(node.callee);
      if (
        callee.type !== "MemberExpression" ||
        callee.computed === true ||
        asNode(callee.property).type !== "Identifier" ||
        allowedMethods.has(asNode(callee.property).name as string) === false
      ) {
        return refuse(reasons.call);
      }
      const args = node.arguments as SyntaxNode[];
      if (args.some((arg) => arg.type === "SpreadElement")) {
        return refuse(reasons.node);
      }
      return checkAll([callee, ...args], source, scope);
    }
    case "AssignmentExpression": {
      if (scope.kind !== "action") {
        return refuse(reasons.node);
      }
      const target = checkAssignmentTarget(asNode(node.left), source, scope);
      if (target.ok === false) {
        return target;
      }
      return checkNode(asNode(node.right), source, scope);
    }
    default:
      return refuse(reasons.node);
  }
};

const onlyWhitespace = /^\s*$/;

const checkCode = (source: string, scope: Scope): CodeCheck => {
  if (typeof source !== "string") {
    return refuse(reasons.syntax);
  }
  if (onlyWhitespace.test(source)) {
    return refuse(reasons.empty);
  }
  let comments = 0;
  let root: SyntaxNode;
  try {
    root = parseExpressionAt(source, 0, {
      ecmaVersion: "latest",
      preserveParens: true,
      onComment: () => {
        comments += 1;
      },
    }) as SyntaxNode;
  } catch {
    return refuse(reasons.syntax);
  }
  if (comments > 0) {
    return refuse(reasons.comment);
  }
  // the parser stops at the end of the first complete expression
  if (onlyWhitespace.test(source.slice(root.end)) === false) {
    return refuse(reasons.single);
  }
  return checkNode(root, source, scope);
};

/**
 * Whether a value expression may be compiled: a prop or child expression, a
 * resource's url, parameter, header or body, or a page setting.
 */
export const checkValueExpression = (expression: string): CodeCheck =>
  checkCode(expression, { kind: "value" });

const plainIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Whether an action's argument name may be written as a parameter. */
export const checkActionArgument = (name: string): CodeCheck =>
  typeof name === "string" &&
  plainIdentifier.test(name) &&
  reservedWords.has(name) === false &&
  name.startsWith("$ws$") === false
    ? pass
    : refuse(reasons.argument);

type ActionEntry = { args: readonly string[]; code: string };

/**
 * Whether an action may be compiled: its argument names are plain names, and
 * each entry's code is one expression that reads only its arguments, the
 * system variable and the build's variables, and assigns only variables. With
 * `dataSourceIds`, every variable must be one of them.
 */
export const checkAction = (
  entries: readonly ActionEntry[],
  { dataSourceIds }: { dataSourceIds?: ReadonlySet<string> } = {}
): CodeCheck => {
  for (const entry of entries) {
    for (const arg of entry.args) {
      const result = checkActionArgument(arg);
      if (result.ok === false) {
        return result;
      }
    }
    const result = checkCode(entry.code, {
      kind: "action",
      args: new Set(entry.args),
      dataSourceIds,
    });
    if (result.ok === false) {
      return result;
    }
  }
  return pass;
};

// HTTP token characters (RFC 9110, 5.6.2)
const headerName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const unsafeSearchParamName = /["\\\n\r\u2028\u2029]/;

/** Whether a resource's header or search parameter name may be generated. */
export const checkResourceName = (
  kind: "header" | "searchParam",
  name: string
): CodeCheck => {
  if (typeof name !== "string") {
    return refuse(kind === "header" ? reasons.header : reasons.searchParam);
  }
  if (kind === "header") {
    return headerName.test(name) ? pass : refuse(reasons.header);
  }
  return unsafeSearchParamName.test(name) ? refuse(reasons.searchParam) : pass;
};

const offeredTags: ReadonlySet<string> = new Set(tags);

/** Whether an instance's tag is one the builder offers. */
export const checkElementTag = (tag: unknown): CodeCheck =>
  typeof tag === "string" && offeredTags.has(tag) ? pass : refuse(reasons.tag);

/**
 * Whether the tag of an instance of this component is checked: every
 * component but XML Node, which writes it as an XML element's name.
 */
const checksTag = (component: string) => component !== "XmlNode";

export type CodeCheckPlace =
  | { type: "page"; id: Page["id"]; path?: string }
  | { type: "instance"; id: Instance["id"] }
  | { type: "resource"; id: Resource["id"] };

export type CodeCheckFailure = {
  place: CodeCheckPlace;
  /** The field that holds the refused value, in a few words. */
  field: string;
  reason: string;
};

export type CheckedBuild = {
  pages?: Iterable<Page | PageTemplate>;
  instances?: Iterable<Instance>;
  props?: Iterable<Prop>;
  resources?: Iterable<Resource>;
  dataSources?: Iterable<DataSource>;
};

/** Every page and page template of a build's pages. */
export const pagesToCheck = (pages: Pages): Array<Page | PageTemplate> => [
  ...pages.pages.values(),
  ...(pages.pageTemplates?.values() ?? []),
];

type PageMeta = Page["meta"];

const pageFields: Array<[string, (page: Page | PageTemplate) => unknown]> = [
  ["title", (page) => page.title],
  ["meta title", (page) => page.meta.title],
  ["description", (page) => page.meta.description],
  ["exclude from search", (page) => page.meta.excludePageFromSearch],
  ["language", (page) => page.meta.language],
  ["social image URL", (page) => page.meta.socialImageUrl],
  ["status", (page) => page.meta.status],
  ["redirect", (page) => page.meta.redirect],
  ["content", (page) => page.meta.content],
];

/** The first value of a page that fails the check. */
export const checkPage = (
  page: Page | PageTemplate
): undefined | { field: string; reason: string } => {
  for (const [field, read] of pageFields) {
    const value = read(page);
    if (value === undefined) {
      continue;
    }
    const result = checkValueExpression(value as string);
    if (result.ok === false) {
      return { field, reason: result.reason };
    }
  }
  const custom: PageMeta["custom"] = page.meta.custom;
  for (const item of custom ?? []) {
    // the generator skips an entry with no property
    if (item.property.trim().length === 0) {
      continue;
    }
    const result = checkValueExpression(item.content);
    if (result.ok === false) {
      return {
        field: `custom metadata "${item.property}"`,
        reason: result.reason,
      };
    }
  }
};

/** The first child expression or tag of an instance that fails the check. */
export const checkInstance = (
  instance: Instance
): undefined | { field: string; reason: string } => {
  if (instance.tag !== undefined && checksTag(instance.component)) {
    const result = checkElementTag(instance.tag);
    if (result.ok === false) {
      return { field: "tag", reason: result.reason };
    }
  }
  for (const child of instance.children) {
    if (child.type === "expression") {
      const result = checkValueExpression(child.value);
      if (result.ok === false) {
        return { field: "text expression", reason: result.reason };
      }
    }
  }
};

/** Whether a prop's expression or action passes. */
export const checkProp = (
  prop: Prop,
  options: { dataSourceIds?: ReadonlySet<string> } = {}
): CodeCheck => {
  if (prop.type === "expression") {
    return checkValueExpression(prop.value);
  }
  if (prop.type === "action") {
    return checkAction(prop.value, options);
  }
  return pass;
};

/** The first field of a resource that fails the check. */
export const checkResource = (
  resource: Resource
): undefined | { field: string; reason: string } => {
  const fail = (field: string, result: CodeCheck) =>
    result.ok ? undefined : { field, reason: result.reason };
  const url = fail("URL", checkValueExpression(resource.url));
  if (url) {
    return url;
  }
  for (const param of resource.searchParams ?? []) {
    const failure =
      fail(
        "search parameter name",
        checkResourceName("searchParam", param.name)
      ) ??
      fail(
        `search parameter "${param.name}"`,
        checkValueExpression(param.value)
      );
    if (failure) {
      return failure;
    }
  }
  for (const header of resource.headers) {
    const failure =
      fail("header name", checkResourceName("header", header.name)) ??
      fail(`header "${header.name}"`, checkValueExpression(header.value));
    if (failure) {
      return failure;
    }
  }
  if (resource.body !== undefined) {
    return fail("body", checkValueExpression(resource.body));
  }
};

/**
 * The first value of a build that fails the check, with the page, instance or
 * resource that holds it, or undefined when every value passes. A resource is
 * named by the instance that loads it when one does.
 */
export const findCodeCheckFailure = (
  build: CheckedBuild
): undefined | CodeCheckFailure => {
  const dataSources = [...(build.dataSources ?? [])];
  const dataSourceIds = new Set<string>([
    SYSTEM_VARIABLE_ID,
    ...dataSources.map((dataSource) => dataSource.id),
  ]);
  for (const page of build.pages ?? []) {
    const failure = checkPage(page);
    if (failure) {
      return {
        place: {
          type: "page",
          id: page.id,
          path: "path" in page ? page.path : undefined,
        },
        ...failure,
      };
    }
  }
  for (const instance of build.instances ?? []) {
    const failure = checkInstance(instance);
    if (failure) {
      return { place: { type: "instance", id: instance.id }, ...failure };
    }
  }
  const props = [...(build.props ?? [])];
  for (const prop of props) {
    const result = checkProp(prop, { dataSourceIds });
    if (result.ok === false) {
      return {
        place: { type: "instance", id: prop.instanceId },
        field: `property "${prop.name}"`,
        reason: result.reason,
      };
    }
  }
  for (const resource of build.resources ?? []) {
    const failure = checkResource(resource);
    if (failure === undefined) {
      continue;
    }
    const holder =
      dataSources.find(
        (dataSource) =>
          dataSource.type === "resource" &&
          dataSource.resourceId === resource.id
      )?.scopeInstanceId ??
      props.find(
        (prop) => prop.type === "resource" && prop.value === resource.id
      )?.instanceId;
    return {
      place:
        holder === undefined
          ? { type: "resource", id: resource.id }
          : { type: "instance", id: holder },
      field: `resource "${resource.name}" ${failure.field}`,
      reason: failure.reason,
    };
  }
};
