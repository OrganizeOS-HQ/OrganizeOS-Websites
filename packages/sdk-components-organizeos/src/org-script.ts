import {
  parse,
  parseExpressionAt,
  tokenizer,
  tokTypes,
  type Expression,
  type PrivateIdentifier,
} from "acorn";
import {
  blockBodyComponent,
  blockComponent,
  SYSTEM_VARIABLE_ID,
  blockTemplateComponent,
  collectionComponent,
  contentBlockDocumentProp,
  createScope,
  decodeDataSourceVariable,
  descendantComponent,
  elementComponent,
  findTreeInstanceIds,
  findTreeInstanceIdsExcludingSubtrees,
  getAllPages,
  getFormActions,
  getPageResourceRootIds,
  getParentInstanceById,
  getResourceDataSourceIds,
  getResourceDependencyIds,
  getTransitiveResourceIds,
  isCoreComponent,
  isFormSubmission,
  ROOT_INSTANCE_ID,
  tags,
  type DataSource,
  type Instance,
  type Page,
  type Pages,
  type PageTemplate,
  type Prop,
  type Resource,
} from "@webstudio-is/sdk";
import {
  browserInfoParameterName,
  formDataParameterName,
} from "@webstudio-is/sdk/runtime";
import {
  getExpressionIdentifiers,
  isValidExpression,
  lintExpression,
  parseStaticMemberPath,
  transpileExpression,
} from "@webstudio-is/expression";
import {
  checkAction,
  checkResource,
  checkValueExpression,
  emailExpressionFields,
} from "./code-check";

/**
 * Whether an org's own script may run on its Website: HTML Embeds, Content
 * Embeds, Markdown Embeds, the SVG `animate` and `set` elements, an element
 * whose tag the builder does not offer, the `dangerouslySetInnerHTML` prop,
 * the site-wide custom code, the unsafe values (an address that can run
 * script, `srcdoc`, an event handler attribute, an action whose args or code
 * could run script, an XML element on an HTML page and a redirect to an
 * unsafe address), a component the published page does not import, an
 * instance stored with the global root's id and a data source the page
 * module cannot name as itself. It is off (owner decision, 2026-10-21); what
 * orgs saved is kept, and each org's next publish ships it again once this
 * is on.
 *
 * Turn it on only when both hold (docs/ORGANIZEOS-FORK.md section 10):
 * - org sites are served from {sub}.organizeos.io and the old
 *   {sub}.organizeos.org hosts only redirect (org sites domain step C2);
 * - the platform session is host-only on app.organizeos.org (step D), so the
 *   builder canvas, which stays under organizeos.org, never receives it.
 *
 * It is a constant, not an environment variable: the builder and the CLI read
 * it at the same commit, and a missing or mistyped value cannot fail open.
 * Turning it on is a reviewed change that also edits its test.
 */
export const orgScriptMayRun = (): boolean => false;

/**
 * Which of OrganizeOS's launch requirements the CLI built from this commit
 * meets. The publish workflow reads it beside orgScriptMayRun() and sends it
 * as guardLevel (docs/ORGANIZEOS-FORK.md section 5). Level 1 has work not
 * yet in this repository; the level stays 0 until it lands.
 * packages/cli/src/organizeos-guard-level.test.ts fails if a requirement stops
 * holding or loses its tests, and pins the level; changing the level is a
 * reviewed change that edits that test.
 */
export const ORGANIZEOS_GUARD_LEVEL: number = 0;

/**
 * The SVGs that upstream's own templates put in an HTML Embed (Accordion,
 * Checkbox, Dialog, Navigation Menu, Popover, Radio Group, Select, Sheet,
 * YouTube and Vimeo). They are literal copies, not imports: a project keeps the
 * string it was inserted with, so an upstream change to an icon adds the new
 * string here and never removes the old one. Each is one fixed `<svg>` of
 * paths (the spinner adds a `<style>` of keyframes) with no script, handler,
 * link, `use` or `foreignObject`, and org-script.test.ts keeps it that way.
 */
export const templateIconCodes: ReadonlySet<string> = new Set([
  // CheckMarkIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.091" d="m13.636 3.667-8 8L2 8.03"/></svg>',
  // ChevronDownIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m4 6 4 4 4-4"/></svg>',
  // DotIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>',
  // LargeXIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M12.5 3 3 12.5M3 3l9.5 9.5"/></svg>',
  // MenuIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M2.667 8h10.666M2.667 4h10.666M2.667 12h10.666"/></svg>',
  // PlayIcon
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="100%" height="100%" style="display: block;"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m4 2 9.333 6L4 14V2Z"/></svg>',
  // SpinnerIcon
  '<svg xmlns="http://www.w3.org/2000/svg" id="c765c5cf3__e2CRglijn891" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" viewBox="0 0 128 128" fill="currentColor" width="100%" height="100%" style="display: block;"><style>@keyframes e2CRglijn892_tr__tr{0%{transform:translate(64px,64px) rotate(90deg);animation-timing-function:cubic-bezier(.42,0,.58,1)}50%{transform:translate(64px,64px) rotate(810deg);animation-timing-function:cubic-bezier(.42,0,.58,1)}to{transform:translate(64px,64px) rotate(1530deg)}}@keyframes e2CRglijn892_s_p{0%,to{stroke:#39fbbb}25%{stroke:#4a4efa}50%{stroke:#e63cfe}75%{stroke:#ffae3c}}@keyframes e2CRglijn892_s_do{0%{stroke-dashoffset:251.89}2.5%,52.5%{stroke-dashoffset:263.88;animation-timing-function:cubic-bezier(.42,0,.58,1)}25%,75%{stroke-dashoffset:131.945}to{stroke-dashoffset:251.885909}}#c765c5cf3__e2CRglijn892_tr{animation:e2CRglijn892_tr__tr 3000ms linear infinite normal forwards}#c765c5cf3__e2CRglijn892{animation-name:e2CRglijn892_s_p,e2CRglijn892_s_do;animation-duration:3000ms;animation-fill-mode:forwards;animation-timing-function:linear;animation-direction:normal;animation-iteration-count:infinite}</style><g id="c765c5cf3__e2CRglijn892_tr" transform="translate(64,64) rotate(90)"><circle id="c765c5cf3__e2CRglijn892" r="42" fill="none" stroke="#39fbbb" stroke-dasharray="263.89" stroke-dashoffset="251.89" stroke-linecap="round" stroke-width="16" transform="scale(-1,1) translate(0,0)"/></g></svg>',
]);

/**
 * Whether an HTML Embed with this `code` may run. Only a static string that
 * is byte-identical to a template icon may, unless the switch is on. A value
 * that is not a string is never an icon, even one that becomes an icon string
 * (`String(["<svg…>"])`): upstream's HTML Embed coerces whatever it is given
 * with `String(code)` and writes it into the page.
 */
export const htmlEmbedCodeMayRun = (
  code: unknown,
  mayRun: boolean = orgScriptMayRun()
): boolean =>
  mayRun || (typeof code === "string" && templateIconCodes.has(code));

/**
 * The SVG elements that can set an attribute of their parent from markup, so
 * `<a><animate attributeName="href" values="javascript:…"/></a>` makes a
 * `javascript:` link that no attribute check sees (SMIL). `animateTransform`
 * (a transform list only), `animateMotion` (a position on a path) and `mpath`
 * cannot set an arbitrary attribute and stay. Publishing drops these
 * elements, and the canvas does not make them (`elementTagMayRender`).
 */
export const pausedSvgTags: ReadonlySet<string> = new Set(["animate", "set"]);

/**
 * Props that put raw markup on a page without an HTML Embed. React writes the
 * value of `dangerouslySetInnerHTML` (an object holding `__html`, from a JSON
 * value or an expression) into any element as markup, and neither the props
 * panel, the component generator nor the canvas filters it. Publishing drops
 * these props while the switch is off, and the canvas skips them.
 */
export const pausedPropNames: ReadonlySet<string> = new Set([
  "dangerouslySetInnerHTML",
]);

/**
 * Whether a prop of this name may reach an element. Not one that writes raw
 * markup into it (`pausedPropNames`), unless the switch is on.
 */
export const propNameMayRun = (
  name: string,
  mayRun: boolean = orgScriptMayRun()
): boolean => mayRun || pausedPropNames.has(name) === false;

const offeredTags: ReadonlySet<string> = new Set(tags);

/**
 * Whether an element may be created with this tag. Only a string that is
 * exactly one of the tags the builder offers (`tags` of `@webstudio-is/sdk`,
 * the list the Tag control shows and HTML paste filters on), unless the switch
 * is on. `script` is not one, nor is any other spelling of it: React hoists a
 * `<script async src>` into the document's `<head>` and runs it, creates a
 * `SCRIPT` as a live element, and the generator writes a tag that is JSX
 * syntax into the page module as code. A value that is not a string is never a
 * tag, even one that becomes a tag string.
 *
 * Publishing applies it to every tag it can read (`classify` in the CLI's
 * `organizeos-org-script.ts`), and the canvas to every tag it renders
 * (`elementTagMayRender`), whether it comes from `instance.tag`, `data-ws-tag`
 * or a `tag` prop, held by the component that makes the element or by one that
 * passes its props to it (`checksTagProp`), so an expression that evaluates to
 * `"script"` is caught as well.
 */
export const elementTagMayRun = (
  tag: unknown,
  mayRun: boolean = orgScriptMayRun()
): boolean => mayRun || (typeof tag === "string" && offeredTags.has(tag));

/**
 * Whether the canvas may make an element with this tag: one the builder offers
 * (`elementTagMayRun`) that is not `animate` or `set` (`pausedSvgTags`), unless
 * the switch is on. Publishing drops an element with either kind of tag, and
 * counts them apart; the canvas makes neither, so an `animate` cannot set a
 * link's `href` to a `javascript:` URL that a click in preview would run.
 */
export const elementTagMayRender = (
  tag: unknown,
  mayRun: boolean = orgScriptMayRun()
): boolean =>
  mayRun ||
  (elementTagMayRun(tag, mayRun) && pausedSvgTags.has(tag as string) === false);

/**
 * The props that choose the element of the component that reads them: Box, Text
 * and Heading read `data-ws-tag` (`tagProperty` of `@webstudio-is/sdk/runtime`,
 * which a test pins) before their legacy `tag` prop, and Radix's DialogTitle
 * renders `<Tag>` from `tag` with no check. The component generator also writes
 * `instance.tag` under the first name on every component but `ws:element`.
 *
 * Reading the prop is not the only way it reaches an element. Radix's triggers
 * (Collapsible, Dialog, Popover and Tooltip triggers, and Navigation Menu's
 * link and trigger) render `<Primitive.Trigger asChild {...props}>`, and
 * Radix's Slot merges those props onto the first child, which may be a Box,
 * Text or Heading that makes its element from them. So these names are held to
 * `elementTagMayRun` on every component that is not `ws:element` or in
 * `anyTagComponents`, wherever the prop sits, and on the canvas to
 * `elementTagMayRender`.
 */
export const tagPropNames: readonly string[] = ["data-ws-tag", "tag"];

/**
 * The components that take any tag name by design, so the tag rule leaves their
 * `tag` alone. XML Node (category xml) writes the tag as the name of an XML
 * element (`urlset`, `url`, `loc`, `xhtml:link` in a sitemap) and adds a suffix
 * that no HTML element has, so it never makes a `script`. Its other risks are
 * not this rule's: publishing leaves it out of an HTML page, and an XML page
 * answers sandboxed (`xmlComponents`).
 */
export const anyTagComponents: ReadonlySet<string> = new Set(["XmlNode"]);

/**
 * Whether the tag of an instance of this component (`instance.tag`) must be one
 * the builder offers: every component but XML Node. On `ws:element` it is the
 * element itself, and on the others it is written as `data-ws-tag`, where the
 * component or the child it passes its props to may make an element of it.
 */
export const checksInstanceTag = (component: string): boolean =>
  anyTagComponents.has(component) === false;

/**
 * Whether a prop of this name on this component must hold a tag the builder
 * offers: `data-ws-tag` and `tag` on every component but `ws:element` (an
 * attribute there, on an element that is already made) and XML Node.
 */
export const checksTagProp = (component: string, name: string): boolean =>
  component !== elementComponent &&
  checksInstanceTag(component) &&
  tagPropNames.includes(name);

/**
 * The props without a `data-ws-tag` or `tag` that the canvas may not render
 * (`elementTagMayRender`: a tag the builder does not offer, `animate` or
 * `set`), for a component that creates an element, or passes its props to a
 * child that does. The same object when nothing goes, and never a changed
 * input. The canvas uses it on what a component receives after its parent's
 * props are merged in, so a tag a Radix trigger passes down is checked as well.
 */
export const withoutBlockedTagProps = <Props extends Record<string, unknown>>(
  component: string,
  props: Props,
  mayRun: boolean = orgScriptMayRun()
): Props => {
  if (mayRun) {
    return props;
  }
  let result = props;
  for (const name of tagPropNames) {
    if (
      name in props &&
      checksTagProp(component, name) &&
      elementTagMayRender(props[name], mayRun) === false
    ) {
      if (result === props) {
        result = { ...props };
      }
      delete result[name];
    }
  }
  return result;
};

/**
 * The core components the generator writes itself rather than import: an
 * element, a Collection, a Content Block, its body, its templates container
 * and a descendant's style rule.
 */
export const generatedComponents: ReadonlySet<Instance["component"]> = new Set([
  elementComponent,
  collectionComponent,
  blockComponent,
  blockBodyComponent,
  blockTemplateComponent,
  descendantComponent,
]);

/**
 * Whether an instance of this component may ship: the generator writes it
 * itself (`generatedComponents`), or the published page imports it, one of
 * `components`, those the CLI's framework imports.
 */
export const componentMayShip = (
  component: unknown,
  components: ReadonlySet<Instance["component"]>
): boolean =>
  typeof component === "string" &&
  (generatedComponents.has(component) || components.has(component));

/**
 * Whether an instance stored with this id may render or ship: any but one
 * with the global root's id (`:root`), which the builder only makes as a
 * virtual instance, unless the switch is on.
 */
export const instanceIdMayRun = (
  id: unknown,
  mayRun: boolean = orgScriptMayRun()
): boolean => mayRun || id !== ROOT_INSTANCE_ID;

/**
 * The URL schemes an address may have while org script is paused. Any other
 * scheme, `javascript:` and `data:` among them, can run script in the site's
 * origin or load a document that does: React writes an address as it is, so a
 * click, a frame, an object, a form or a client-side redirect would run it.
 * `sms` cannot run script, and campaign sites use it ("Text JOIN to…").
 */
export const allowedUrlSchemes: ReadonlySet<string> = new Set([
  "http",
  "https",
  "mailto",
  "tel",
  "sms",
]);

const urlSchemePattern = /^[A-Za-z][A-Za-z0-9+.-]*:/;

// The URL parser's first steps: leading and trailing C0 controls and spaces go,
// then every tab, line feed and carriage return, wherever it is.
const isC0OrSpace = (char: string) => char.charCodeAt(0) <= 0x20;
const withoutTabsAndNewlines = (text: string) => text.replace(/[\t\n\r]/g, "");
const trimStartOfUrl = (text: string) => {
  let start = 0;
  while (start < text.length && isC0OrSpace(text[start])) {
    start += 1;
  }
  return text.slice(start);
};
const trimUrl = (text: string) => {
  let end = text.length;
  while (end > 0 && isC0OrSpace(text[end - 1])) {
    end -= 1;
  }
  return trimStartOfUrl(text.slice(0, end));
};

const schemeMayRun = (scheme: string) =>
  allowedUrlSchemes.has(scheme.slice(0, -1).toLowerCase());

/**
 * Whether an address may reach a published page or the canvas, read as the URL
 * parser reads it. One with no scheme (a relative path, `//host`, `?query`,
 * `#fragment`, the empty string) may, and so may one whose scheme is in
 * `allowedUrlSchemes`; `javascript:`, `data:`, `vbscript:`, `blob:`, `file:`
 * and `about:` may not, however they are spelled, spaced or split by tabs and
 * newlines. The rule guards against script, not against where an address
 * leads: a relative or protocol-relative address (`//evil.example`) can be an
 * open redirect, never script in the site's origin.
 */
export const urlMayRun = (
  url: string,
  mayRun: boolean = orgScriptMayRun()
): boolean => {
  if (mayRun) {
    return true;
  }
  const scheme = withoutTabsAndNewlines(trimUrl(url)).match(
    urlSchemePattern
  )?.[0];
  return scheme === undefined || schemeMayRun(scheme);
};

/**
 * Whether a value written as an address may run, as React writes it: `null`,
 * `undefined`, a boolean and a function write no address; anything else is
 * written as `String(value)`, so an array joins (`["javascript:x"]` is
 * `javascript:x`) and an object is `[object Object]`. A symbol, or a value that
 * cannot be made a string, is refused.
 */
export const urlValueMayRun = (
  value: unknown,
  mayRun: boolean = orgScriptMayRun()
): boolean => {
  if (mayRun) {
    return true;
  }
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "function"
  ) {
    return true;
  }
  if (typeof value === "symbol") {
    return false;
  }
  try {
    return urlMayRun(String(value), false);
  } catch {
    return false;
  }
};

/** The fixed start of an expression's value, as far as the source fixes it */
type FixedStart = {
  text: string;
  /** the start is the whole value */
  complete: boolean;
  /** the value is a string, so a `+` after it adds text */
  string: boolean;
};

const noFixedStart: FixedStart = { text: "", complete: false, string: false };

const fixedStartOf = (node: Expression): FixedStart => {
  if (node.type === "Literal") {
    if (node.regex !== undefined || node.bigint !== undefined) {
      return noFixedStart;
    }
    if (typeof node.value === "string") {
      return { text: node.value, complete: true, string: true };
    }
    if (
      typeof node.value === "number" ||
      typeof node.value === "boolean" ||
      node.value === null
    ) {
      return { text: String(node.value), complete: true, string: false };
    }
    return noFixedStart;
  }
  if (node.type === "TemplateLiteral") {
    const cooked = node.quasis[0]?.value.cooked;
    if (typeof cooked !== "string") {
      return noFixedStart;
    }
    return {
      text: cooked,
      complete: node.expressions.length === 0,
      string: true,
    };
  }
  if (node.type === "ParenthesizedExpression") {
    return fixedStartOf(node.expression);
  }
  if (
    node.type === "BinaryExpression" &&
    node.operator === "+" &&
    node.left.type !== "PrivateIdentifier"
  ) {
    const left = fixedStartOf(node.left);
    if (left.string === false) {
      return noFixedStart;
    }
    if (left.complete === false) {
      return left;
    }
    const right = fixedStartOf(node.right);
    return {
      text: right.string || right.complete ? left.text + right.text : left.text,
      complete: right.complete,
      string: true,
    };
  }
  // a variable, a member, a call, a sequence: nothing is fixed
  return noFixedStart;
};

/**
 * Whether the fixed start of an address decides its scheme, read as the URL
 * parser reads the start of a URL: not empty, and either an allowed scheme, or
 * no scheme whatever follows (a first character that is not an ASCII letter,
 * or a character that cannot be in a scheme before any `:`). A start made only
 * of scheme characters (`"java" + x`) decides nothing.
 */
const urlStartMayRun = (start: string) => {
  const text = withoutTabsAndNewlines(trimStartOfUrl(start));
  if (text === "") {
    return false;
  }
  const scheme = text.match(urlSchemePattern)?.[0];
  if (scheme !== undefined) {
    return schemeMayRun(scheme);
  }
  return /^[A-Za-z]/.test(text) === false || /[^A-Za-z0-9+.-]/.test(text);
};

const addressNodeMayRun = (node: Expression): boolean => {
  if (node.type === "ParenthesizedExpression") {
    return addressNodeMayRun(node.expression);
  }
  if (node.type === "ConditionalExpression") {
    return (
      addressNodeMayRun(node.consequent) && addressNodeMayRun(node.alternate)
    );
  }
  if (node.type === "LogicalExpression") {
    return addressNodeMayRun(node.left) && addressNodeMayRun(node.right);
  }
  const start = fixedStartOf(node);
  return start.complete
    ? urlValueMayRun(start.text, false)
    : urlStartMayRun(start.text);
};

const onlyWhitespace = /^\s*$/;

/**
 * Whether an address bound to an expression may run. Publishing cannot know
 * what a variable, a Resource or a parameter holds when the page renders, so a
 * bound address ships only when the start of its value is fixed in the source
 * and decides the scheme: `"/events/" + x`, `` `https://${x}` ``,
 * `"mailto:" + x`. A JSON literal is judged by its value. The whole string must
 * be one expression; a conditional or a logical expression may run when both
 * of its branches may. Anything else, a parse error included, is refused.
 */
export const urlExpressionMayRun = (
  expression: string,
  mayRun: boolean = orgScriptMayRun()
): boolean => {
  if (mayRun) {
    return true;
  }
  try {
    return urlValueMayRun(JSON.parse(expression), false);
  } catch {
    // not JSON: an expression
  }
  let node: Expression;
  try {
    node = parseExpressionAt(expression, 0, {
      ecmaVersion: "latest",
      preserveParens: true,
    });
  } catch {
    return false;
  }
  if (
    onlyWhitespace.test(expression.slice(0, node.start)) === false ||
    onlyWhitespace.test(expression.slice(node.end)) === false
  ) {
    return false;
  }
  return addressNodeMayRun(node);
};

/**
 * The props that hold an address, compared lower-cased: an HTML parser
 * lower-cases attribute names (`HREF` is an `href`), and the generator and the
 * canvas rename `formaction` and `xlink:href` to React's `formAction` and
 * `xlinkHref` (`standardAttributesToReactProps`).
 */
export const urlPropNames: ReadonlySet<string> = new Set([
  "href",
  "xlink:href",
  "xlinkhref",
  "src",
  "action",
  "formaction",
  "data",
]);

export const isUrlPropName = (name: string): boolean =>
  urlPropNames.has(name.toLowerCase());

/** `srcdoc` in any spelling (React's is `srcDoc`): its markup runs in the
 * page's own origin. */
export const isFrameDocumentName = (name: string): boolean =>
  name.toLowerCase() === "srcdoc";

/** An event handler attribute: React writes a string one on a custom element. */
export const isEventAttributeName = (name: string): boolean =>
  /^on./i.test(name);

/**
 * The components of category xml. Publishing leaves them out of every HTML and
 * text page (a custom element keeps every attribute, `onmouseover` included),
 * and an XML page answers sandboxed, so on an XML page they ship every prop.
 */
export const xmlComponents: ReadonlySet<string> = new Set([
  "XmlNode",
  "XmlTime",
]);

/** Components whose bound `src` cannot run script: an image. */
export const inertSrcComponents: ReadonlySet<string> = new Set(["Image"]);

/** `ws:element` tags whose bound `src` cannot run script: media and images. */
export const inertSrcTags: ReadonlySet<string> = new Set([
  "img",
  "video",
  "audio",
  "source",
  "track",
  "input",
]);

/** Components whose bound `href` cannot run script: a `<link>` in the head. */
export const inertHrefComponents: ReadonlySet<string> = new Set(["HeadLink"]);

/** Components that hold records in `data`, never an address. */
export const recordDataComponents: ReadonlySet<string> = new Set([
  collectionComponent,
  "@organizeos/site-components:SignupForm",
  "@organizeos/site-components:RsvpForm",
]);

type InstanceKind = Pick<Instance, "component" | "tag">;

/**
 * Whether `data` on this instance is never an address: it is one only on an
 * `object`. So a holder of records and a `ws:element` that is not an `object`
 * (a plain attribute there) keep their `data` whatever it holds, and every
 * other holder is held to the rule, whatever the value's shape: React writes
 * `<object data={["javascript:…"]}>` as `data="javascript:…"`.
 */
export const recordDataHolder = (instance: InstanceKind): boolean =>
  recordDataComponents.has(instance.component) ||
  (instance.component === elementComponent && instance.tag !== "object");

const bindingIsInert = (instance: InstanceKind, name: string) =>
  (name === "src" &&
    (inertSrcComponents.has(instance.component) ||
      (instance.component === elementComponent &&
        inertSrcTags.has(instance.tag ?? "")))) ||
  (name === "href" && inertHrefComponents.has(instance.component));

/**
 * An action's arg: a plain ASCII identifier, one name in a parameter list,
 * that cannot be a name the canvas or the generator writes: it starts with a
 * letter, holds no `$`, and is neither `arguments`, `eval` nor a reserved
 * word of a module.
 */
const actionArgPattern = /^[A-Za-z][A-Za-z0-9_]*$/;
const reservedArgs: ReadonlySet<string> = new Set([
  "arguments",
  "eval",
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
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const actionArgMayRun = (arg: string) =>
  actionArgPattern.test(arg) && reservedArgs.has(arg) === false;

/**
 * The props through which a component passes its action plain data, by
 * component: a form's state (Resource Form, Webhook Form, Signup Form and
 * RSVP Form) and Rotation Control's tab, each a string, and a Resource Form's
 * progress and result, each an object of strings, numbers, booleans, null
 * and arrays. A build stores a Resource Form or a Webhook Form under these
 * names, or as `Form` or `NativeForm`, which publishing reads as one of them
 * first. While org script is paused, only an action on one of these may name
 * its args.
 */
export const plainDataActionProps: ReadonlyMap<
  Instance["component"],
  ReadonlySet<Prop["name"]>
> = new Map([
  [
    "ResourceForm",
    new Set(["onStateChange", "onProgressChange", "onResultChange"]),
  ],
  ["WebhookForm", new Set(["onStateChange"])],
  ["@organizeos/site-components:SignupForm", new Set(["onStateChange"])],
  ["@organizeos/site-components:RsvpForm", new Set(["onStateChange"])],
  ["@organizeos/site-components:RotationControl", new Set(["onValueChange"])],
]);

/**
 * Characters an action's code may not start with. The canvas and the
 * generator write each code on a line of its own after another line, and a
 * code that starts with one of these could be read together with it.
 */
const joinsLineBefore = /^[([{`/+-]/;

/** Names an action reads as values. None can be a data source's name. */
const valueNames: ReadonlySet<string> = new Set(["undefined"]);

/** What an action's rule reads of the build */
export type ActionContext = {
  /** Its instances: the action's holder, by the prop's instance id, and the
   * instances above it */
  instances: ReadonlyMap<
    Instance["id"],
    Pick<Instance, "component" | "children">
  >;
  /** The root instance of each of its pages */
  pageRootIds: ReadonlySet<Instance["id"]>;
  /** The root instance of each of its page templates, which the canvas edits
   * as it does a page: they decide for a holder no page reaches */
  templateRootIds?: ReadonlySet<Instance["id"]>;
  /** Its data sources, without those `collidingDataSourceIds` lists
   * (`actionContextOf`) */
  dataSources: ReadonlyMap<
    DataSource["id"],
    Pick<DataSource, "type" | "scopeInstanceId" | "name">
  >;
};

const noActionContext: ActionContext = {
  instances: new Map(),
  pageRootIds: new Set(),
  dataSources: new Map(),
};

/** The root instance of each page */
export const pageRootIdsOf = (
  pages: undefined | Pages
): ReadonlySet<Instance["id"]> =>
  new Set(
    pages === undefined
      ? []
      : getAllPages(pages).map((page) => page.rootInstanceId)
  );

/** The root instance of each page template */
export const templateRootIdsOf = (
  pages: undefined | Pages
): ReadonlySet<Instance["id"]> =>
  new Set(
    Array.from(
      pages?.pageTemplates?.values() ?? [],
      (page) => page.rootInstanceId
    )
  );

/** What the rule for a data source reads of a page or a page template */
export type PageNames = Pick<Page, "rootInstanceId" | "systemDataSourceId"> & {
  documentType?: Page["meta"]["documentType"];
};

const noPages: readonly PageNames[] = [];
const pagesAndTemplatesByPages = new WeakMap<Pages, readonly PageNames[]>();

/**
 * The root, the own data source and the document type of each page and each
 * page template, the same list for the same pages
 */
export const pagesAndTemplatesOf = (
  pages: undefined | Pages
): readonly PageNames[] => {
  if (pages === undefined) {
    return noPages;
  }
  let found = pagesAndTemplatesByPages.get(pages);
  if (found === undefined) {
    found = [
      ...getAllPages(pages),
      ...(pages.pageTemplates?.values() ?? []),
    ].map(({ rootInstanceId, systemDataSourceId, meta }) => ({
      rootInstanceId,
      systemDataSourceId,
      documentType: (meta as Partial<Page["meta"]> | undefined)?.documentType,
    }));
    pagesAndTemplatesByPages.set(pages, found);
  }
  return found;
};

/**
 * A data source's name made a plain identifier: letters, digits, `_` and `$`,
 * never starting with a digit
 */
const generatedNameOf = (name: string) => {
  const identifier = name.replaceAll(/[^\w$]/g, "");
  if (identifier === "") {
    return "_";
  }
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `_${identifier}`;
};

/**
 * Whether `name` could name a data source called `dataSourceName`: its name
 * made a plain identifier, or that followed by `_`, `_N` or `__N`
 */
const mayBeNamedAs = (dataSourceName: string, name: string) => {
  const base = generatedNameOf(dataSourceName);
  return name.startsWith(base) && /^_?(_\d+)?$/.test(name.slice(base.length));
};

/** Names no data source may take */
const reservedNames: ReadonlySet<string> = new Set([
  "_key",
  "_data",
  "_action",
  "renderText",
  "let",
  "static",
  "Array",
  "Map",
  "Number",
  "Object",
  "String",
]);

/** The props through which a Collection binds its item and its key */
export const collectionBindingNames: ReadonlySet<Prop["name"]> = new Set([
  "item",
  "itemKey",
]);

/** The ids the builder gives a data source */
const dataSourceIdPattern = /^[A-Za-z0-9_-]+$/;

/** What the page module names besides its data sources */
export type BuildNames = {
  instances: ReadonlyMap<
    Instance["id"],
    Pick<Instance, "component" | "children">
  >;
  dataSources: ReadonlyMap<DataSource["id"], DataSource>;
  props: ReadonlyMap<Prop["id"], Prop>;
  resources: ReadonlyMap<Resource["id"], unknown>;
  /** Its pages and page templates (`pagesAndTemplatesOf`) */
  pages: readonly PageNames[];
};

/**
 * The data sources the page module cannot name as themselves:
 * - one stored under another key, or one whose id is not one the builder
 *   gives (letters, digits, `_` and `-`), ends in `-index`, or is `Body`, a
 *   component of the build or a Resource's (a Resource of the build, one a
 *   prop or a data source names, or a Webhook Form's own);
 * - one whose name is one no data source may take (`reservedNames`);
 * - a parameter, unless it is a page's or a page template's own, held on its
 *   root, which is not the global root's id and which no other page or
 *   template and no instance holds, a Collection's item or key, or a Resource
 *   Form's own form data or browser info, which upstream's managed form
 *   binds as its submission's (`getManagedFormParameterBinding`), on a form
 *   that may ship and that a page other than an XML page or a page template
 *   reaches, which a parameter prop names only on the form or inside it, on
 *   every path to it;
 * - a page's own that is not such a parameter;
 * - one a Collection binds as its item or key, unless it is a parameter of
 *   that Collection, which nothing else binds and which a parameter prop
 *   names only on an instance inside the Collection, on every path to it,
 *   the Collection holds no other prop of that name, and the Collection may
 *   ship (`instanceIdMayRun`).
 *
 * While org script is paused publishing leaves them out, the Publish dialog
 * lists them but those `unlistedDataSourceIds` names, and an action may not
 * name them (`actionContextOf`).
 */
export const collidingDataSourceIds = ({
  instances,
  dataSources,
  props,
  resources,
  pages,
}: BuildNames): ReadonlySet<DataSource["id"]> => {
  // every page's root is a Body, and so is a root publishing empties
  const taken = new Set<string>(["Body", ...resources.keys()]);
  const childIds = new Set<Instance["id"]>();
  for (const [id, instance] of instances) {
    taken.add(instance.component);
    if (instance.component === "WebhookForm" || instance.component === "Form") {
      taken.add(id);
    }
    for (const child of instance.children) {
      if (child.type === "id") {
        childIds.add(child.value);
      }
    }
  }
  // what binds a Collection's item or key, how many props of that name the
  // Collection holds, and what other parameter prop names a data source
  const bindings = new Map<DataSource["id"], Prop[]>();
  const bindingProps = new Map<string, number>();
  const bindingKey = (prop: Prop) =>
    JSON.stringify([prop.instanceId, prop.name]);
  const namedOn = new Map<DataSource["id"], Instance["id"][]>();
  for (const prop of props.values()) {
    if (prop.type === "resource") {
      taken.add(prop.value);
    }
    const isBindingProp =
      instances.get(prop.instanceId)?.component === collectionComponent &&
      collectionBindingNames.has(prop.name);
    if (isBindingProp) {
      bindingProps.set(
        bindingKey(prop),
        (bindingProps.get(bindingKey(prop)) ?? 0) + 1
      );
    }
    if (prop.type !== "parameter") {
      continue;
    }
    if (isBindingProp) {
      bindings.set(prop.value, [...(bindings.get(prop.value) ?? []), prop]);
    } else {
      namedOn.set(prop.value, [
        ...(namedOn.get(prop.value) ?? []),
        prop.instanceId,
      ]);
    }
  }
  for (const dataSource of dataSources.values()) {
    if (dataSource.type === "resource") {
      taken.add(dataSource.resourceId);
    }
  }
  const rootIds = new Set(pages.map((page) => page.rootInstanceId));
  const pagesByRoot = new Map<Instance["id"], number>();
  const ownersById = new Map<DataSource["id"], PageNames[]>();
  for (const page of pages) {
    pagesByRoot.set(
      page.rootInstanceId,
      (pagesByRoot.get(page.rootInstanceId) ?? 0) + 1
    );
    if (page.systemDataSourceId !== undefined) {
      ownersById.set(page.systemDataSourceId, [
        ...(ownersById.get(page.systemDataSourceId) ?? []),
        page,
      ]);
    }
  }
  // a page's own: held on its root, which nothing else holds
  const isPageOwn = (dataSource: DataSource) => {
    const owners = ownersById.get(dataSource.id) ?? [];
    const [owner] = owners;
    return (
      owners.length === 1 &&
      dataSource.type === "parameter" &&
      owner.rootInstanceId !== ROOT_INSTANCE_ID &&
      dataSource.scopeInstanceId === owner.rootInstanceId &&
      pagesByRoot.get(owner.rootInstanceId) === 1 &&
      childIds.has(owner.rootInstanceId) === false
    );
  };
  // inside the Collection on every path to it from a page or a template
  const isInside = (holderId: Instance["id"], collectionId: Instance["id"]) => {
    if (holderId === collectionId) {
      return false;
    }
    const { onEveryPath, cyclic } = onEveryPathFrom(
      holderId,
      instances,
      rootIds
    );
    return (
      cyclic === false &&
      (onEveryPath === undefined || onEveryPath.has(collectionId))
    );
  };
  // the roots of what publishes a Resource Form: an XML page publishes none
  const formRootIds = new Set(
    pages
      .filter((page) => page.documentType !== "xml")
      .map((page) => page.rootInstanceId)
  );
  const formShips = (formId: Instance["id"]) => {
    const { onEveryPath, cyclic } = onEveryPathFrom(
      formId,
      instances,
      formRootIds
    );
    return cyclic === false && onEveryPath !== undefined;
  };
  // a Resource Form's own form data or browser info, as upstream's
  // getManagedFormParameterBinding binds them, on a form that ships, named
  // only on the form or inside it
  const isFormParameter = (dataSource: DataSource) => {
    const formId = dataSource.scopeInstanceId;
    return (
      dataSource.type === "parameter" &&
      ownersById.has(dataSource.id) === false &&
      (dataSource.name === formDataParameterName ||
        dataSource.name === browserInfoParameterName) &&
      formId !== undefined &&
      instanceIdMayRun(formId, false) &&
      instances.get(formId)?.component === "ResourceForm" &&
      formShips(formId) &&
      (namedOn.get(dataSource.id) ?? []).every(
        (holderId) => holderId === formId || isInside(holderId, formId)
      )
    );
  };
  const isBinding = (dataSource: DataSource, [binding, ...rest]: Prop[]) =>
    rest.length === 0 &&
    bindingProps.get(bindingKey(binding)) === 1 &&
    instanceIdMayRun(binding.instanceId, false) &&
    dataSource.type === "parameter" &&
    dataSource.scopeInstanceId === binding.instanceId &&
    ownersById.has(dataSource.id) === false &&
    (namedOn.get(dataSource.id) ?? []).every((holderId) =>
      isInside(holderId, binding.instanceId)
    );
  const colliding = new Set<DataSource["id"]>();
  for (const [key, dataSource] of dataSources) {
    try {
      const binds = bindings.get(dataSource.id) ?? [];
      if (
        key !== dataSource.id ||
        dataSourceIdPattern.test(dataSource.id) === false ||
        dataSource.id.endsWith("-index") ||
        taken.has(dataSource.id) ||
        reservedNames.has(generatedNameOf(dataSource.name)) ||
        (binds.length > 0
          ? isBinding(dataSource, binds) === false
          : (dataSource.type === "parameter" ||
              ownersById.has(dataSource.id)) &&
            isPageOwn(dataSource) === false &&
            isFormParameter(dataSource) === false)
      ) {
        colliding.add(key);
      }
    } catch {
      colliding.add(key);
    }
  }
  return colliding;
};

/**
 * The data sources publishing leaves out while org script is paused without
 * counting or listing them, as their author cannot change them: a Content
 * Block's own document, a parameter held on the block that the block's own
 * `document` parameter prop names, and no other parameter prop does.
 */
export const unlistedDataSourceIds = ({
  instances,
  dataSources,
  props,
}: Pick<BuildNames, "instances" | "dataSources" | "props">): ReadonlySet<
  DataSource["id"]
> => {
  const namedBy = new Map<DataSource["id"], Prop[]>();
  for (const prop of props.values()) {
    if (prop.type === "parameter") {
      namedBy.set(prop.value, [...(namedBy.get(prop.value) ?? []), prop]);
    }
  }
  const unlisted = new Set<DataSource["id"]>();
  for (const [key, dataSource] of dataSources) {
    const blockId = dataSource.scopeInstanceId;
    const [prop, ...rest] = namedBy.get(dataSource.id) ?? [];
    if (
      key === dataSource.id &&
      dataSource.type === "parameter" &&
      blockId !== undefined &&
      instances.get(blockId)?.component === blockComponent &&
      prop !== undefined &&
      rest.length === 0 &&
      prop.instanceId === blockId &&
      prop.name === contentBlockDocumentProp
    ) {
      unlisted.add(key);
    }
  }
  return unlisted;
};

const shippableByDataSources = new WeakMap<
  BuildNames["dataSources"],
  BuildNames & { shippable: ActionContext["dataSources"] }
>();

/**
 * The context an action's rule reads, the same for the canvas, publishing and
 * the Publish dialog: the build's data sources without those
 * `collidingDataSourceIds` lists, so an action that names one is refused.
 */
export const actionContextOf = ({
  instances,
  pageRootIds,
  templateRootIds,
  dataSources,
  props,
  resources,
  pages,
}: BuildNames & {
  instances: ActionContext["instances"];
  pageRootIds: ActionContext["pageRootIds"];
  templateRootIds?: ActionContext["templateRootIds"];
}): ActionContext => {
  let found = shippableByDataSources.get(dataSources);
  if (
    found === undefined ||
    found.instances !== instances ||
    found.props !== props ||
    found.resources !== resources ||
    found.pages !== pages
  ) {
    const colliding = collidingDataSourceIds({
      instances,
      dataSources,
      props,
      resources,
      pages,
    });
    found = {
      instances,
      dataSources,
      props,
      resources,
      pages,
      shippable:
        colliding.size === 0
          ? dataSources
          : new Map(
              Array.from(dataSources).filter(
                ([id]) => colliding.has(id) === false
              )
            ),
    };
    shippableByDataSources.set(dataSources, found);
  }
  return {
    instances,
    pageRootIds,
    templateRootIds,
    dataSources: found.shippable,
  };
};

const parentsByInstances = new WeakMap<
  ActionContext["instances"],
  ReadonlyMap<Instance["id"], readonly Instance["id"][]>
>();

const parentsOf = (instances: ActionContext["instances"]) => {
  let parents = parentsByInstances.get(instances);
  if (parents === undefined) {
    const found = new Map<Instance["id"], Instance["id"][]>();
    for (const [id, instance] of instances) {
      for (const child of instance.children) {
        if (child.type === "id") {
          const list = found.get(child.value) ?? [];
          list.push(id);
          found.set(child.value, list);
        }
      }
    }
    parents = found;
    parentsByInstances.set(instances, parents);
  }
  return parents;
};

/**
 * The instances on every path from one of `rootIds` to the holder, the holder
 * included; none when no root reaches it, and `cyclic` when a cycle is above
 * it.
 */
const onEveryPathFrom = (
  holderId: Instance["id"],
  instances: ActionContext["instances"],
  rootIds: ReadonlySet<Instance["id"]>
) => {
  const parents = parentsOf(instances);
  const found = new Map<Instance["id"], undefined | Set<Instance["id"]>>();
  const visiting = new Set<Instance["id"]>();
  let cyclic = false;
  const visit = (id: Instance["id"]): undefined | Set<Instance["id"]> => {
    if (found.has(id)) {
      return found.get(id);
    }
    if (visiting.has(id)) {
      cyclic = true;
      return;
    }
    visiting.add(id);
    let common: undefined | Set<Instance["id"]>;
    if (rootIds.has(id)) {
      common = new Set();
    } else {
      for (const parent of parents.get(id) ?? []) {
        const above = visit(parent);
        if (above !== undefined) {
          common =
            common === undefined
              ? new Set(above)
              : new Set([...common].filter((item) => above.has(item)));
        }
      }
    }
    visiting.delete(id);
    common?.add(id);
    found.set(id, common);
    return common;
  };
  const onEveryPath = visit(holderId);
  return { onEveryPath, cyclic };
};

/**
 * The instances on every path from a page root to the holder, the holder
 * included, or, for a holder no page reaches, from a page template's root.
 * A holder neither reaches, or one with a cycle above it, has only itself.
 */
const onEveryPathTo = (
  holderId: Instance["id"],
  { instances, pageRootIds, templateRootIds }: ActionContext
): ReadonlySet<Instance["id"]> => {
  for (const rootIds of [pageRootIds, templateRootIds ?? new Set()]) {
    const { onEveryPath, cyclic } = onEveryPathFrom(
      holderId,
      instances,
      rootIds
    );
    if (cyclic) {
      break;
    }
    if (onEveryPath !== undefined) {
      return onEveryPath;
    }
  }
  return new Set([holderId]);
};

/** The name of an object's key that is not computed */
const keyNameOf = (key: unknown) => {
  const node = key as { type?: string; name?: unknown; value?: unknown };
  return node.type === "Identifier"
    ? node.name
    : node.type === "Literal"
      ? String(node.value)
      : undefined;
};

/**
 * Whether an action's code is a plain value, by an allowlist of node types:
 * literals but a regular expression, names, templates without a tag, unary
 * operators but `delete`, binary, logical and conditional operators, arrays
 * without a spread, objects of plain properties (not computed, not a getter,
 * a setter or a method, and not keyed `__proto__`), and an assignment to a
 * name that is not `undefined`. Anything else, a member access and a call
 * among them, is not.
 */
const isPlainValue = (node: Expression): boolean => {
  switch (node.type) {
    case "Literal":
      return node.regex === undefined;
    case "Identifier":
      return true;
    case "TemplateLiteral":
      return node.expressions.every(isPlainValue);
    case "UnaryExpression":
      return node.operator !== "delete" && isPlainValue(node.argument);
    case "BinaryExpression":
      return (
        node.left.type !== "PrivateIdentifier" &&
        isPlainValue(node.left) &&
        isPlainValue(node.right)
      );
    case "LogicalExpression":
      return isPlainValue(node.left) && isPlainValue(node.right);
    case "ConditionalExpression":
      return (
        isPlainValue(node.test) &&
        isPlainValue(node.consequent) &&
        isPlainValue(node.alternate)
      );
    case "AssignmentExpression":
      return (
        node.left.type === "Identifier" &&
        valueNames.has(node.left.name) === false &&
        isPlainValue(node.right)
      );
    case "ArrayExpression":
      return node.elements.every(
        (element) =>
          element === null ||
          (element.type !== "SpreadElement" && isPlainValue(element))
      );
    case "ObjectExpression":
      return node.properties.every(
        (property) =>
          property.type === "Property" &&
          property.kind === "init" &&
          property.method === false &&
          property.computed === false &&
          keyNameOf(property.key) !== "__proto__" &&
          isPlainValue(property.value as Expression)
      );
    default:
      return false;
  }
};

/**
 * Whether the code holds a `<` or `<<` token followed anywhere later by a
 * token that starts with `>` (`>`, `>=`, `>>`, `>>=`, `>>>` or `>>>=`), which
 * no action may. Text in a string or a template does not count. Code it
 * cannot read does.
 */
export const holdsAngleBrackets = (code: string): boolean => {
  try {
    let opened = false;
    for (const token of tokenizer(code, { ecmaVersion: "latest" })) {
      if (
        token.type !== tokTypes.relational &&
        token.type !== tokTypes.bitShift &&
        token.type !== tokTypes.assign
      ) {
        continue;
      }
      const operator = code.slice(token.start, token.end);
      if (opened && operator.startsWith(">")) {
        return true;
      }
      opened = opened || operator === "<" || operator === "<<";
    }
    return false;
  } catch {
    return true;
  }
};

/**
 * Whether the code holds a comment, of either kind, anywhere in it, which no
 * action and no expression may. Text in a string or a template does not
 * count. Code it cannot read does.
 */
export const holdsComment = (code: string): boolean => {
  try {
    let found = false;
    for (const _token of tokenizer(code, {
      ecmaVersion: "latest",
      onComment: () => {
        found = true;
      },
    })) {
      if (found) {
        break;
      }
    }
    return found;
  } catch {
    return true;
  }
};

/**
 * Whether the code is exactly one expression, read the same way as a
 * statement: what `parseExpressionAt` reads as the expression is what a
 * script reads as its one statement, and only whitespace follows it.
 */
export const readsAsOneExpression = (code: string): boolean => {
  try {
    const node = parseExpressionAt(code, 0, { ecmaVersion: "latest" });
    const [statement, ...rest] = parse(code, {
      ecmaVersion: "latest",
      sourceType: "script",
    }).body;
    return (
      onlyWhitespace.test(code.slice(node.end)) &&
      rest.length === 0 &&
      statement?.type === "ExpressionStatement" &&
      statement.expression.start === node.start &&
      statement.expression.end === node.end
    );
  } catch {
    return false;
  }
};

/** The names a plain value assigns with an operator that reads them too */
const compoundAssignedNames = (node: Expression): string[] => {
  switch (node.type) {
    case "AssignmentExpression":
      return [
        ...(node.operator !== "=" && node.left.type === "Identifier"
          ? [node.left.name]
          : []),
        ...compoundAssignedNames(node.right),
      ];
    case "TemplateLiteral":
      return node.expressions.flatMap(compoundAssignedNames);
    case "UnaryExpression":
      return compoundAssignedNames(node.argument);
    case "BinaryExpression":
    case "LogicalExpression":
      return [
        ...(node.left.type === "PrivateIdentifier"
          ? []
          : compoundAssignedNames(node.left)),
        ...compoundAssignedNames(node.right),
      ];
    case "ConditionalExpression":
      return [node.test, node.consequent, node.alternate].flatMap(
        compoundAssignedNames
      );
    case "ArrayExpression":
      return node.elements.flatMap((element) =>
        element === null || element.type === "SpreadElement"
          ? []
          : compoundAssignedNames(element)
      );
    case "ObjectExpression":
      return node.properties.flatMap((property) =>
        property.type === "Property"
          ? compoundAssignedNames(property.value as Expression)
          : []
      );
    default:
      return [];
  }
};

const actionCodeMayRun = (
  code: string,
  {
    ownArgs,
    lastArgs,
    argsMayBeNamed,
    inScope,
    dataSources,
  }: {
    ownArgs: readonly string[];
    lastArgs: readonly string[];
    /** the holder passes its action plain data */
    argsMayBeNamed: boolean;
    inScope: (scopeInstanceId: undefined | Instance["id"]) => boolean;
    dataSources: ActionContext["dataSources"];
  }
) => {
  if (
    holdsComment(code) ||
    joinsLineBefore.test(code.trimStart()) ||
    readsAsOneExpression(code) === false
  ) {
    return false;
  }
  const node = parseExpressionAt(code, 0, { ecmaVersion: "latest" });
  if (isPlainValue(node) === false || holdsAngleBrackets(code)) {
    return false;
  }
  // the names the code reads and assigns, as the generators read them
  const assigned = new Map<string, boolean>();
  const read = new Set<string>(compoundAssignedNames(node));
  transpileExpression({
    expression: code,
    executable: true,
    replaceVariable: (name, assignee) => {
      assigned.set(name, assigned.get(name) === true || assignee);
      if (assignee === false) {
        read.add(name);
      }
    },
  });
  // the one name a code that is only `name = value` sets
  const setOnly =
    node.type === "AssignmentExpression" &&
    node.operator === "=" &&
    node.left.type === "Identifier"
      ? node.left.name
      : undefined;
  const availableVariables = new Set<string>();
  for (const [name, isAssigned] of assigned) {
    if (ownArgs.includes(name)) {
      // an action may name only the args its last entry lists
      if (argsMayBeNamed === false || lastArgs.includes(name) === false) {
        return false;
      }
    } else if (valueNames.has(name)) {
      if (isAssigned) {
        return false;
      }
    } else {
      // an action may name only a variable or a Resource in scope, and
      // assign only a variable
      const id = decodeDataSourceVariable(name);
      const dataSource =
        id === undefined || id === "" ? undefined : dataSources.get(id);
      if (
        (dataSource?.type !== "variable" && dataSource?.type !== "resource") ||
        (isAssigned && dataSource.type !== "variable") ||
        inScope(dataSource.scopeInstanceId) === false ||
        // no arg may be named as one it reads
        ((name !== setOnly || read.has(name)) &&
          lastArgs.some((arg) => mayBeNamedAs(dataSource.name, arg)))
      ) {
        return false;
      }
    }
    availableVariables.add(name);
  }
  // no diagnostic
  return (
    lintExpression({
      expression: code,
      availableVariables,
      allowAssignment: true,
    }).length === 0
  );
};

/**
 * Whether an action may run while org script is paused. The builder's canvas
 * and the published page's generator write it as code, an arrow function
 * whose parameters are the last entry's args and whose body is each entry's
 * code, a line each: the canvas runs it as soon as it computes prop values,
 * and the site's server renders it, and a component may call it without a
 * click. So every arg is a plain identifier that is not a reserved word,
 * listed once, and every code:
 * - is exactly one expression, read the same way as a statement
 *   (`readsAsOneExpression`), that starts with none of `joinsLineBefore`'s
 *   characters;
 * - is a plain value (`isPlainValue`, an allowlist): it assigns values and
 *   variables, and reads no member and calls nothing;
 * - holds no `<` followed later by a `>` (`holdsAngleBrackets`), and no
 *   comment (`holdsComment`);
 * - names its args only on a prop through which its holder passes plain data
 *   (`plainDataActionProps`), and only those both its own entry and the last
 *   entry list, since an arg can hold a host object (a React event's `view`
 *   is the window); on any other prop, no entry lists an arg;
 * - names only a variable or a Resource of the context in scope: the
 *   holder's own, one of an instance on every path from a page root to the
 *   holder (from a page template's root, for a holder no page reaches), or a
 *   global one; and `undefined`; and assigns only a variable;
 * - reads no data source that an arg of the last entry could be named as,
 *   and sets one such only where the whole code is `variable = value` and the
 *   value does not name it;
 * - passes the expression linter without a diagnostic, assignment allowed.
 * The action as a whole also passes input validation (`checkAction`).
 * The holder is the context's instance with the prop's instance id. An action
 * with no entries may run, but not as a Collection's item or key. A value of
 * another shape may not.
 */
export const actionMayRun = (
  prop: Extract<Prop, { type: "action" }>,
  context: ActionContext
): boolean => {
  try {
    const holder = context.instances.get(prop.instanceId);
    if (
      holder?.component === collectionComponent &&
      collectionBindingNames.has(prop.name)
    ) {
      return false;
    }
    const argsMayBeNamed =
      holder !== undefined &&
      plainDataActionProps.get(holder.component)?.has(prop.name) === true;
    let scope: undefined | ReadonlySet<Instance["id"]>;
    const inScope = (scopeInstanceId: undefined | Instance["id"]) => {
      if (scopeInstanceId === ROOT_INSTANCE_ID) {
        return true;
      }
      scope ??= onEveryPathTo(prop.instanceId, context);
      return scopeInstanceId !== undefined && scope.has(scopeInstanceId);
    };
    // off those props an action lists no args
    if (
      argsMayBeNamed === false &&
      prop.value.some((entry) => entry.args.length > 0)
    ) {
      return false;
    }
    const lastArgs = prop.value.at(-1)?.args ?? [];
    if (checkAction(prop.value).ok === false) {
      return false;
    }
    return prop.value.every(
      (entry) =>
        entry.args.every(actionArgMayRun) &&
        new Set(entry.args).size === entry.args.length &&
        actionCodeMayRun(entry.code, {
          ownArgs: entry.args,
          lastArgs,
          argsMayBeNamed,
          inScope,
          dataSources: context.dataSources,
        })
    );
  } catch {
    return false;
  }
};

/**
 * Whether a value is plain data: null, a boolean, a number, a string, or an
 * array or an object (of `Object.prototype` or none) of plain data, held in
 * data properties and with no cycle. While org script is paused the canvas
 * stores nothing else in a variable.
 */
export const isPlainData = (value: unknown): boolean => {
  const above = new Set<object>();
  const check = (item: unknown): boolean => {
    if (
      item === null ||
      typeof item === "boolean" ||
      typeof item === "number" ||
      typeof item === "string"
    ) {
      return true;
    }
    if (typeof item !== "object" || above.has(item)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(item);
    const isArray = Array.isArray(item) && prototype === Array.prototype;
    if (
      isArray === false &&
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      return false;
    }
    above.add(item);
    for (const key of Reflect.ownKeys(item)) {
      if (isArray && key === "length") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (
        typeof key === "symbol" ||
        descriptor === undefined ||
        "value" in descriptor === false ||
        check(descriptor.value) === false
      ) {
        return false;
      }
    }
    above.delete(item);
    return true;
  };
  try {
    return check(value);
  } catch {
    return false;
  }
};

/**
 * Whether a prop would hand its element to what it names: a parameter or an
 * expression named `ref`. A variable holds plain data only, so while org
 * script is paused neither ships, and the canvas passes no `ref` prop.
 */
export const isElementReference = (prop: Pick<Prop, "name" | "type">) =>
  prop.name === "ref" &&
  (prop.type === "parameter" || prop.type === "expression");

/**
 * Whether publishing keeps this prop. An action ships when `actionMayRun`
 * says so given `context`, the build's (without it, an action that names its
 * args or a data source does not ship), whatever its name and on any
 * instance: the generator writes it into the page module as code. A
 * Collection's item or key ships only as a parameter. A parameter or an
 * expression named `ref` never ships (`isElementReference`). Every other
 * prop of an XML element ships. A `srcdoc` never does, nor an `on…` prop that
 * is not an action. An address ships when it is of a type that cannot hold
 * one (a page, an asset, a resource, a number, a boolean), when its static
 * value may run whatever its shape, or when it is bound and its fixed start
 * decides the scheme or the binding cannot run script (`inertSrcComponents`,
 * `inertSrcTags`, `inertHrefComponents`). `data` is an address only on an
 * `object` (`recordDataHolder`).
 */
export const propMayShip = (
  instance: InstanceKind,
  prop: Prop,
  mayRun: boolean = orgScriptMayRun(),
  context: ActionContext = noActionContext
): boolean => {
  if (mayRun) {
    return true;
  }
  if (prop.type === "action") {
    return actionMayRun(prop, context);
  }
  // a Collection binds its item and key only through a parameter
  if (
    instance.component === collectionComponent &&
    collectionBindingNames.has(prop.name)
  ) {
    return prop.type === "parameter";
  }
  if (isElementReference(prop)) {
    return false;
  }
  if (xmlComponents.has(instance.component)) {
    return true;
  }
  if (isFrameDocumentName(prop.name)) {
    return false;
  }
  // an on… prop that is not an action
  if (isEventAttributeName(prop.name)) {
    return false;
  }
  if (isUrlPropName(prop.name) === false) {
    return true;
  }
  const name = prop.name.toLowerCase();
  if (name === "data" && recordDataHolder(instance)) {
    return true;
  }
  switch (prop.type) {
    case "page":
    case "asset":
    case "resource":
    case "number":
    case "boolean":
      return true;
    case "string":
    case "json":
    case "string[]":
    // An animation's settings: an object, which React writes as
    // [object Object] (the OrganizeOS Animate Children's `action`)
    case "animationAction":
      return urlValueMayRun(prop.value, false);
    case "expression":
      return (
        urlExpressionMayRun(prop.value, false) || bindingIsInert(instance, name)
      );
    case "parameter":
      return bindingIsInert(instance, name);
    default:
      return false;
  }
};

/**
 * Whether a page's redirect ships: an expression, evaluated per request, held
 * to the rule for a bound address. A client-side navigation to the page would
 * follow it with `window.location`, so a `javascript:` target would run.
 */
export const pageRedirectMayShip = (
  page: { meta: { redirect?: string } },
  mayRun: boolean = orgScriptMayRun()
): boolean =>
  page.meta.redirect === undefined ||
  urlExpressionMayRun(page.meta.redirect, mayRun);

/** Whether a project redirect ships: its target is a static address. */
export const projectRedirectMayShip = (
  redirect: { new: string },
  mayRun: boolean = orgScriptMayRun()
): boolean => urlMayRun(redirect.new, mayRun);

/**
 * The props without what may run script on the canvas, for a component that
 * receives them, its own or passed in by a parent: what
 * `withoutBlockedTagProps` drops, every `srcdoc`, every `on…` value that is
 * not a function, every address value that `urlValueMayRun` refuses,
 * whatever its shape (`data` stays only on a `recordDataHolder`), and every
 * `ref` (`isElementReference`). The same object when nothing goes, never a
 * changed input, and the input itself when the switch is on.
 */
export const withoutPausedProps = <Props extends Record<string, unknown>>(
  instance: InstanceKind,
  props: Props,
  mayRun: boolean = orgScriptMayRun()
): Props => {
  if (mayRun) {
    return props;
  }
  let result = withoutBlockedTagProps(instance.component, props, mayRun);
  for (const [name, value] of Object.entries(result)) {
    // a missing value writes nothing
    if (value === undefined || value === null) {
      continue;
    }
    if (
      name === "ref" ||
      isFrameDocumentName(name) ||
      (isEventAttributeName(name) && typeof value !== "function") ||
      (isUrlPropName(name) &&
        (name.toLowerCase() === "data" && recordDataHolder(instance)) ===
          false &&
        urlValueMayRun(value, false) === false)
    ) {
      if (result === props) {
        result = { ...props };
      }
      delete result[name];
    }
  }
  return result;
};

/**
 * Whether a page's `excludePageFromSearch` leaves it out of the sitemap, read
 * as upstream's sitemap reads it since webstudio-is/webstudio#6614: only a
 * value that is the literal `true` excludes, and nothing is evaluated. Any
 * other value, a bound one included (a collection's item page), keeps the page
 * listed, as before.
 */
export const sitemapExcludesPage = (
  expression: string | undefined
): boolean => {
  if (expression === undefined) {
    return false;
  }
  let node: Expression;
  try {
    node = parseExpressionAt(expression, 0, {
      ecmaVersion: "latest",
      preserveParens: true,
    });
    // As upstream reads it: only whitespace or comments may follow.
    const trailing = tokenizer(expression.slice(node.end), {
      ecmaVersion: "latest",
    }).getToken();
    if (trailing.type.label !== "eof") {
      return false;
    }
  } catch {
    return false;
  }
  while (node.type === "ParenthesizedExpression") {
    node = node.expression;
  }
  return node.type === "Literal" && node.value === true;
};

/**
 * The pages with every `excludePageFromSearch` reduced to what the sitemap
 * reads (sitemapExcludesPage): `"true"`, or none. The runtime package's
 * getStaticSiteMapXml, which the builder's sitemap and prebuild call, then
 * never evaluates a page setting. The pages passed in are not changed.
 */
export const pagesForSitemap = (pages: Pages): Pages => ({
  ...pages,
  pages: new Map(
    Array.from(pages.pages, ([id, page]) => [
      id,
      {
        ...page,
        meta: {
          ...page.meta,
          excludePageFromSearch: sitemapExcludesPage(
            page.meta.excludePageFromSearch
          )
            ? "true"
            : undefined,
        },
      },
    ])
  ),
});

/**
 * The value a variable's JSON text holds, read without running it. The text
 * must be exactly one literal: a string, a number (a negative one too), a
 * boolean, `null`, `undefined`, a template with no substitutions, or an array
 * or object of them whose keys are plain names, strings or numbers. Anything
 * else, or anything after the literal, gives no value. While org script is
 * paused the builder's variable dialog reads values this way.
 */
export const readLiteralValue = (
  text: string
): { value: unknown } | undefined => {
  try {
    // read in parentheses, as upstream's dialog evaluates it, so an object
    // literal and a parenthesized value read the same way
    const program = parse(`(${text})`, {
      ecmaVersion: "latest",
      preserveParens: true,
    });
    const [statement] = program.body;
    if (program.body.length !== 1 || statement.type !== "ExpressionStatement") {
      return;
    }
    return { value: literalNodeValue(statement.expression) };
  } catch {
    return;
  }
};

const notALiteral = () => new Error("not a literal");

const literalNodeValue = (node: Expression): unknown => {
  switch (node.type) {
    case "ParenthesizedExpression":
      return literalNodeValue(node.expression);
    case "Literal":
      if ("regex" in node || typeof node.value === "bigint") {
        throw notALiteral();
      }
      return node.value;
    case "Identifier":
      if (node.name === "undefined") {
        return undefined;
      }
      throw notALiteral();
    case "UnaryExpression":
      if (
        node.operator === "-" &&
        node.argument.type === "Literal" &&
        typeof node.argument.value === "number"
      ) {
        return -node.argument.value;
      }
      throw notALiteral();
    case "TemplateLiteral":
      if (node.expressions.length === 0 && node.quasis.length === 1) {
        return node.quasis[0].value.cooked;
      }
      throw notALiteral();
    case "ArrayExpression":
      return node.elements.map((element) => {
        if (element === null || element.type === "SpreadElement") {
          throw notALiteral();
        }
        return literalNodeValue(element);
      });
    case "ObjectExpression": {
      const value: Record<string, unknown> = {};
      for (const property of node.properties) {
        if (
          property.type !== "Property" ||
          property.kind !== "init" ||
          property.method ||
          property.shorthand ||
          property.computed
        ) {
          throw notALiteral();
        }
        const key =
          property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "Literal" &&
                (typeof property.key.value === "string" ||
                  typeof property.key.value === "number")
              ? String(property.key.value)
              : undefined;
        if (key === undefined) {
          throw notALiteral();
        }
        // an own property, as JSON.parse makes, even for `__proto__`
        Object.defineProperty(value, key, {
          value: literalNodeValue(property.value as Expression),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return value;
    }
    default:
      throw notALiteral();
  }
};

// Expressions: what the canvas evaluates and publishing writes while org
// script is paused (docs/ORGANIZEOS-FORK.md section 10, "Expressions")

/**
 * The globals a generated page or server module may read without declaring
 * them. The CLI's check of each generated module allows these and no other,
 * and no data source may be named as one of them.
 */
export const generatedCodeGlobals: ReadonlySet<string> = new Set([
  "Array",
  "Error",
  "Infinity",
  "Map",
  "NaN",
  "Number",
  "Object",
  "String",
]);

/**
 * The names a data source or a Resource may not take: the globals a module
 * may read (`generatedCodeGlobals`) and a module's own names.
 */
export const generatedModuleNames: ReadonlySet<string> = new Set([
  ...generatedCodeGlobals,
  "_data",
  "_action",
  "_contentData",
  "_contentDocuments",
  "documents",
]);

/** Whether an expression may name this data source where it is written. */
export type ExpressionNames = (dataSourceId: DataSource["id"]) => boolean;

/** Names an expression may read besides the data sources it names */
const expressionValueNames: ReadonlySet<string> = new Set([
  "undefined",
  "NaN",
  "Infinity",
]);

/**
 * The methods an expression may call: the linter's, which org-script.test.ts
 * keeps equal to `allowedStringMethods` and `allowedArrayMethods` of
 * `@webstudio-is/sdk`.
 */
export const expressionCallNames: ReadonlySet<string> = new Set([
  "at",
  "endsWith",
  "includes",
  "join",
  "replace",
  "slice",
  "split",
  "startsWith",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "toLowerCase",
  "toString",
  "toUpperCase",
]);

/** Member names an expression may not read: they lead to a constructor or a prototype. */
const pausedMemberNames: ReadonlySet<string> = new Set([
  "constructor",
  "prototype",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

/**
 * Keys an object literal may not hold: the listed hooks and the methods an
 * expression may call.
 */
const pausedObjectKeys: ReadonlySet<string> = new Set([
  "__proto__",
  "valueOf",
  "toLocaleString",
  "toJSON",
  "then",
  ...expressionCallNames,
]);

const isPrimitiveLiteral = (node: Expression) =>
  node.type === "Literal" &&
  node.regex === undefined &&
  node.bigint === undefined;

/** A call's argument: a primitive literal, or a negative number */
const isLiteralArgument = (node: Expression) =>
  isPrimitiveLiteral(node) ||
  (node.type === "UnaryExpression" &&
    node.operator === "-" &&
    node.argument.type === "Literal" &&
    typeof node.argument.value === "number");

/** The key of a computed member or property, when the source fixes it */
const fixedKeyOf = (node: Expression | PrivateIdentifier) => {
  if (
    node.type === "Literal" &&
    (typeof node.value === "string" || typeof node.value === "number")
  ) {
    return String(node.value);
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
};

/**
 * Whether every node of an expression is one an expression may hold, by an
 * allowlist: parentheses, optional chains, primitive literals, names
 * (`undefined`, `NaN`, `Infinity` and the data sources `mayName` allows),
 * templates without a tag, unary operators but `delete`, binary, logical and
 * conditional operators, arrays without a spread, objects of plain properties
 * (no shorthand) whose keys the source fixes and `pausedObjectKeys` leaves
 * out, members whose keys the source fixes and `pausedMemberNames` leaves out,
 * and calls of an `expressionCallNames` method whose arguments are primitive
 * literals or negative numbers.
 */
const expressionNodeMayRun = (
  node: Expression,
  mayName: ExpressionNames
): boolean => {
  const mayRun = (child: Expression) => expressionNodeMayRun(child, mayName);
  switch (node.type) {
    case "ParenthesizedExpression":
    case "ChainExpression":
      return mayRun(node.expression);
    case "Literal":
      return isPrimitiveLiteral(node);
    case "Identifier": {
      if (expressionValueNames.has(node.name)) {
        return true;
      }
      const id = decodeDataSourceVariable(node.name);
      return id !== undefined && mayName(id);
    }
    case "TemplateLiteral":
      return node.expressions.every(mayRun);
    case "UnaryExpression":
      return node.operator !== "delete" && mayRun(node.argument);
    case "BinaryExpression":
      return (
        node.left.type !== "PrivateIdentifier" &&
        mayRun(node.left) &&
        mayRun(node.right)
      );
    case "LogicalExpression":
      return mayRun(node.left) && mayRun(node.right);
    case "ConditionalExpression":
      return (
        mayRun(node.test) && mayRun(node.consequent) && mayRun(node.alternate)
      );
    case "ArrayExpression":
      return node.elements.every(
        (element) =>
          element === null ||
          (element.type !== "SpreadElement" && mayRun(element))
      );
    case "ObjectExpression":
      return node.properties.every((property) => {
        if (
          property.type !== "Property" ||
          property.kind !== "init" ||
          property.method ||
          property.shorthand
        ) {
          return false;
        }
        const key = property.computed
          ? fixedKeyOf(property.key)
          : property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "Literal"
              ? String(property.key.value)
              : undefined;
        return (
          key !== undefined &&
          pausedObjectKeys.has(key) === false &&
          mayRun(property.value as Expression)
        );
      });
    case "MemberExpression": {
      if (node.object.type === "Super") {
        return false;
      }
      const key = node.computed
        ? fixedKeyOf(node.property)
        : node.property.type === "Identifier"
          ? node.property.name
          : undefined;
      return (
        key !== undefined &&
        pausedMemberNames.has(key) === false &&
        mayRun(node.object)
      );
    }
    case "CallExpression": {
      const { callee } = node;
      return (
        callee.type === "MemberExpression" &&
        callee.computed === false &&
        callee.property.type === "Identifier" &&
        expressionCallNames.has(callee.property.name) &&
        node.arguments.every(
          (argument) =>
            argument.type !== "SpreadElement" && isLiteralArgument(argument)
        ) &&
        mayRun(callee)
      );
    }
    default:
      return false;
  }
};

/**
 * The token ranges of the code, read as a script or as a module, and a mark
 * for every comment it holds
 */
const tokenRangesOf = (code: string, sourceType: "script" | "module") => {
  let ranges = "";
  for (const token of tokenizer(code, { ecmaVersion: "latest", sourceType })) {
    ranges += `${token.start}-${token.end},`;
  }
  return ranges;
};

/**
 * Whether an expression may be evaluated or published while org script is
 * paused. Callers check orgScriptMayRun() first; when org script may run,
 * nothing calls this and nothing changes. Every part must hold, and anything
 * else, a value that is not a string among them, may not run:
 * - it is a non-empty string that is exactly one expression, with only
 *   whitespace around it, read the same way as a script and as a module, and
 *   it holds no comment (`holdsComment`);
 * - it holds no `<` or `<<` followed later by a token that starts with `>`;
 * - the expression linter reports nothing, given every data source it names
 *   and `undefined`, `NaN` and `Infinity`;
 * - every node is one `expressionNodeMayRun` allows;
 * - every data source it names is one `mayName` allows (`$ws$system` is
 *   SYSTEM_VARIABLE_ID). The canvas binds every name, so it passes none;
 * - input validation passes it (`checkValueExpression`).
 */
export const expressionMayRun = (
  expression: unknown,
  mayName: ExpressionNames = () => true
): boolean => {
  try {
    if (typeof expression !== "string" || expression.trim() === "") {
      return false;
    }
    if (checkValueExpression(expression).ok === false) {
      return false;
    }
    const node = parseExpressionAt(expression, 0, {
      ecmaVersion: "latest",
      preserveParens: true,
    });
    if (
      onlyWhitespace.test(expression.slice(0, node.start)) === false ||
      onlyWhitespace.test(expression.slice(node.end)) === false ||
      tokenRangesOf(expression, "script") !==
        tokenRangesOf(expression, "module") ||
      holdsComment(expression)
    ) {
      return false;
    }
    if (holdsAngleBrackets(expression)) {
      return false;
    }
    const availableVariables = new Set<string>(expressionValueNames);
    for (const name of getExpressionIdentifiers(expression)) {
      if (decodeDataSourceVariable(name) !== undefined) {
        availableVariables.add(name);
      }
    }
    if (lintExpression({ expression, availableVariables }).length > 0) {
      return false;
    }
    return expressionNodeMayRun(node, mayName);
  } catch {
    return false;
  }
};

/** A page setting that holds an expression */
export type PageExpressionField =
  | "title"
  | "description"
  | "excludePageFromSearch"
  | "language"
  | "socialImageUrl"
  | "status"
  | "redirect"
  | "content"
  | `custom.${number}`
  | "metaTitle";

/**
 * An expression, or a Resource, that may not be published while org script
 * is paused. One that no page publishes, which input validation alone reads,
 * is `unpublished`: it goes, and is neither counted nor listed.
 */
export type PausedExpression = (
  | {
      kind: "prop";
      instanceId: Instance["id"];
      propId: Prop["id"];
      name: string;
    }
  | { kind: "child"; instanceId: Instance["id"]; index: number }
  | { kind: "page"; pageId: Page["id"]; field: PageExpressionField }
  | { kind: "resource"; resourceId: Resource["id"] }
  | { kind: "dataSource"; dataSourceId: DataSource["id"] }
) & { unpublished?: true };

const pageMetaExpressionFields = [
  "description",
  "excludePageFromSearch",
  "language",
  "socialImageUrl",
  "status",
  "redirect",
  "content",
] as const;

/**
 * What a page publishes, as `findPausedExpressions` reads it: the instances it
 * holds, the Resources it loads that may name another Resource's data, those
 * only a form's submission sends, and the page settings it publishes as text
 */
export type PublishedPage = {
  pageId: Page["id"];
  held: ReadonlySet<Instance["id"]>;
  inGraph: ReadonlySet<Resource["id"]>;
  submission: ReadonlySet<Resource["id"]>;
  text: ReadonlySet<PageExpressionField>;
};

/** The prop whose literal false hides an instance and what is inside it */
const showPropName = "data-ws-show";

/**
 * The instances a page holds, as prebuild selects them: its root (present or
 * not) and everything under it, but a subtree whose root a `ws:show` prop of
 * the literal false hides, and ROOT_INSTANCE_ID. A tree with a cycle is read
 * without following the cycle.
 */
const findPageInstanceIds = (
  instances: ReadonlyMap<Instance["id"], Instance>,
  props: ReadonlyMap<Prop["id"], Prop>,
  rootInstanceId: Instance["id"]
) => {
  const hidden = new Set<Instance["id"]>();
  for (const prop of props.values()) {
    if (
      prop.name === showPropName &&
      prop.type === "boolean" &&
      prop.value === false
    ) {
      hidden.add(prop.instanceId);
    }
  }
  const ids = findTreeInstanceIdsExcludingSubtrees(
    instances as Map<Instance["id"], Instance>,
    rootInstanceId,
    hidden
  );
  ids.add(ROOT_INSTANCE_ID);
  return ids;
};

/** The page settings that publish as text when they read as text */
const pageTextFields: ReadonlySet<string> = new Set([
  "title",
  "description",
  "language",
  "socialImageUrl",
  "redirect",
  "content",
]);

/**
 * Whether a page setting publishes as text: one that is not an expression and
 * names no data source, or a lone word other than `undefined`
 */
const writtenAsText = (expression: string) => {
  const trimmed = expression.trim();
  if (isValidExpression(trimmed)) {
    return (
      parseStaticMemberPath(trimmed)?.length === 1 &&
      trimmed !== "undefined" &&
      trimmed.includes("$ws$") === false
    );
  }
  return trimmed.includes("$ws$") === false;
};

/**
 * The data sources that ship: the build's, without each data source
 * `paused` lists and the `resource` data sources of each Resource it lists.
 * An action is judged against these.
 */
export const withoutPausedDataSources = <Source extends DataSource>(
  dataSources: ReadonlyMap<DataSource["id"], Source>,
  paused: readonly PausedExpression[]
): Map<DataSource["id"], Source> => {
  const pausedIds = new Set<DataSource["id"]>();
  const pausedResources = new Set<Resource["id"]>();
  for (const item of paused) {
    if (item.kind === "dataSource") {
      pausedIds.add(item.dataSourceId);
    } else if (item.kind === "resource") {
      pausedResources.add(item.resourceId);
    }
  }
  return new Map(
    Array.from(dataSources).filter(
      ([id, dataSource]) =>
        pausedIds.has(id) === false &&
        (dataSource.type !== "resource" ||
          pausedResources.has(dataSource.resourceId) === false)
    )
  );
};

/**
 * What publishing reads of a build while org script is paused, in the one
 * order that settles it. The data sources `collidingDataSourceIds` lists go
 * first, and so do those `ships` refuses; `findPausedExpressions` reads the
 * rest, and an expression that names a data source that goes goes too; and
 * an action is judged against the data sources that ship after both
 * (`actionContextOf`). Nothing a later step leaves out changes what an
 * earlier one read: an action that goes takes no instance and no data source
 * with it. The CLI's `dropOrgScript` and the Publish dialog both read it.
 */
export const findPausedPublishing = ({
  pages,
  templates,
  pageNames,
  pageRootIds,
  templateRootIds,
  instances,
  dataSources,
  props,
  resources,
  ships = () => true,
}: {
  /** Every page entry */
  pages: readonly Page[];
  /** The page templates, which publish nothing */
  templates?: readonly PageTemplate[];
  /** Its pages and page templates (`pagesAndTemplatesOf`) */
  pageNames: readonly PageNames[];
  pageRootIds: ActionContext["pageRootIds"];
  templateRootIds?: ActionContext["templateRootIds"];
  instances: ReadonlyMap<Instance["id"], Instance>;
  dataSources: ReadonlyMap<DataSource["id"], DataSource>;
  props: ReadonlyMap<Prop["id"], Prop>;
  resources: ReadonlyMap<Resource["id"], Resource>;
  /** Whether a data source ships, its instance aside */
  ships?: (dataSource: DataSource) => boolean;
}) => {
  const collidingIds = collidingDataSourceIds({
    instances,
    dataSources,
    props,
    resources,
    pages: pageNames,
  });
  const named = new Map(
    Array.from(dataSources).filter(([id]) => collidingIds.has(id) === false)
  );
  const dropped = new Set(collidingIds);
  for (const [id, dataSource] of named) {
    if (ships(dataSource) === false) {
      dropped.add(id);
    }
  }
  const pausedExpressions = findPausedExpressions({
    pages,
    templates,
    instances,
    props: props.values(),
    dataSources: named,
    resources,
    dropped,
  });
  const actionContext = actionContextOf({
    instances,
    pageRootIds,
    templateRootIds,
    dataSources: withoutPausedDataSources(
      new Map(Array.from(named).filter(([, dataSource]) => ships(dataSource))),
      pausedExpressions
    ),
    props,
    resources,
    pages: pageNames,
  });
  return { collidingIds, pausedExpressions, actionContext };
};

/**
 * The settings of a page or a page template that hold an expression: a custom
 * entry with no property publishes nothing
 */
const pageFieldValues = (page: Page | PageTemplate) =>
  [
    ["title", page.title],
    ...pageMetaExpressionFields.map((field) => [field, page.meta[field]]),
    ...(page.meta.custom ?? []).flatMap(({ property, content }, index) =>
      typeof property === "string" && property.trim() === ""
        ? []
        : [[`custom.${index}`, content]]
    ),
  ] as Array<[PageExpressionField, unknown]>;

/**
 * Every expression of a build that may not be published while org script is
 * paused, each once, every Resource that holds one, and every data source
 * named like a module's own name or a global it reads
 * (`generatedModuleNames`). A Resource that a data source or a resource prop
 * of a page names, and that the build does not hold, is paused too. An
 * expression that names a data source that goes (`dropped`, those it pauses
 * and those of a Resource it pauses) is paused, wherever the page holds it.
 * Callers check orgScriptMayRun() first.
 *
 * Each expression a page publishes passes `expressionMayRun` and names only
 * data sources the published module declares where it is written. A page
 * holds what prebuild selects for it, without a subtree a literal `ws:show`
 * of false hides; it may name a data source it does not hold, unless that
 * one goes. A page setting it publishes as text is held to input validation
 * alone. Input validation passes every Resource it reads (`checkResource`). A
 * Resource is listed when any part fails, on any page.
 *
 * What no page publishes is read by input validation alone, and what it
 * refuses is paused as `unpublished`.
 */
export const findPausedExpressions = (build: {
  pages: readonly Page[];
  /** The page templates, which publish nothing */
  templates?: readonly PageTemplate[];
  instances: ReadonlyMap<Instance["id"], Instance>;
  props: Iterable<Prop>;
  dataSources: ReadonlyMap<DataSource["id"], DataSource>;
  resources: ReadonlyMap<Resource["id"], Resource>;
  /** The data sources publishing leaves out before this runs */
  dropped?: ReadonlySet<DataSource["id"]>;
  /** Given what each page publishes, as this reads it (for a test) */
  observe?: (published: PublishedPage) => void;
}): PausedExpression[] => {
  const { instances, dataSources, resources } = build;
  const props = Array.from(build.props);
  const propsById = new Map(props.map((prop) => [prop.id, prop]));
  const propsByInstance = new Map<Instance["id"], Prop[]>();
  for (const prop of props) {
    const list = propsByInstance.get(prop.instanceId) ?? [];
    list.push(prop);
    propsByInstance.set(prop.instanceId, list);
  }
  const paused = new Map<string, PausedExpression>();
  const pause = (key: string, item: PausedExpression) => {
    if (paused.has(key) === false) {
      paused.set(key, item);
    }
  };
  // what goes: an expression that names one goes too
  const goes = new Set(build.dropped);

  // a data source named like a module's own name or a global it reads
  const liveDataSources = new Map<DataSource["id"], DataSource>();
  for (const [id, dataSource] of dataSources) {
    if (generatedModuleNames.has(createScope().getName(id, dataSource.name))) {
      pause(`dataSource:${id}`, { kind: "dataSource", dataSourceId: id });
      goes.add(id);
    } else {
      liveDataSources.set(id, dataSource);
    }
  }

  // what each page selects and generates
  const views = build.pages.map((page) => {
    const held = findPageInstanceIds(instances, propsById, page.rootInstanceId);
    const isXml = page.meta.documentType === "xml";
    // an XML page publishes only the core and XML components
    const generated = new Map<Instance["id"], Instance>();
    for (const id of held) {
      const instance = instances.get(id);
      if (
        instance !== undefined &&
        (isXml === false ||
          isCoreComponent(instance.component) ||
          xmlComponents.has(instance.component))
      ) {
        generated.set(id, instance);
      }
    }
    // and its root is the body's first child
    let rootId = page.rootInstanceId;
    const firstChild = instances.get(rootId)?.children.at(0);
    if (isXml && firstChild?.type === "id") {
      rootId = firstChild.value;
    }
    return { page, held, generated, rootId };
  });
  type PageView = (typeof views)[number];

  const isHeld = (view: PageView, dataSource: DataSource) =>
    view.held.has(dataSource.scopeInstanceId ?? "");
  const isSystem = (view: PageView, dataSource: DataSource) =>
    dataSource.type === "parameter" &&
    dataSource.id === view.page.systemDataSourceId;
  // a Resource Form's own form data or browser info, where the page
  // publishes the form
  const isFormParameter = (view: PageView, dataSource: DataSource) =>
    dataSource.type === "parameter" &&
    (dataSource.name === formDataParameterName ||
      dataSource.name === browserInfoParameterName) &&
    view.generated.get(dataSource.scopeInstanceId ?? "")?.component ===
      "ResourceForm";
  // whether a module of this page may name a data source
  const namesOn =
    (view: PageView, declares: (dataSource: DataSource) => boolean) =>
    (id: DataSource["id"]) => {
      // every module may name the system data, whatever the build stores
      if (id === SYSTEM_VARIABLE_ID) {
        return true;
      }
      if (goes.has(id)) {
        return false;
      }
      const dataSource = liveDataSources.get(id);
      if (dataSource === undefined || isHeld(view, dataSource) === false) {
        return true;
      }
      return (
        dataSource.type === "variable" ||
        isSystem(view, dataSource) ||
        declares(dataSource)
      );
    };

  // The Resources: what each page loads, and what a form's submission
  // sends, until nothing more goes
  const resourceMayRun = (
    resource: Resource | undefined,
    mayName: ExpressionNames
  ) => {
    if (
      resource === undefined ||
      generatedModuleNames.has(
        createScope().getName(resource.id, resource.name)
      )
    ) {
      return false;
    }
    try {
      return (
        checkResource(resource) === undefined &&
        [
          resource.url,
          ...(resource.searchParams ?? []).map(({ value }) => value),
          ...resource.headers.map(({ value }) => value),
          // an empty body is no body
          ...(resource.body === undefined || resource.body === ""
            ? []
            : [resource.body]),
          ...emailExpressionFields.flatMap(([field]) => {
            const value = resource.email?.[field];
            return value === undefined ? [] : [value];
          }),
        ].every((expression) => expressionMayRun(expression, mayName))
      );
    } catch {
      return false;
    }
  };
  const resourcesOf = (view: PageView) => {
    const pageProps = new Map(
      props
        .filter((prop) => view.held.has(prop.instanceId))
        .map((prop) => [prop.id, prop])
    );
    const pageDataSources = new Map(
      Array.from(liveDataSources).filter(
        ([id, dataSource]) => goes.has(id) === false && isHeld(view, dataSource)
      )
    );
    // what the page loads
    const loaded = new Set<Resource["id"]>();
    for (const prop of pageProps.values()) {
      if (prop.type === "resource") {
        loaded.add(prop.value);
      }
    }
    for (const dataSource of pageDataSources.values()) {
      if (dataSource.type === "resource") {
        loaded.add(dataSource.resourceId);
      }
    }
    const pageResources = new Map(
      [...loaded].flatMap((id) => {
        const resource = resources.get(id);
        return resource === undefined ? [] : [[id, resource] as const];
      })
    );
    const transitive = (resourceId: Resource["id"]) =>
      getTransitiveResourceIds({
        resourceId,
        resources: pageResources,
        dataSources: pageDataSources,
      });
    // what only a form's submission sends: what names a form's data, what
    // depends on that, and a form's destination the page does not use
    const formParameterIds = new Set(
      Array.from(pageDataSources.values())
        .filter((dataSource) => isFormParameter(view, dataSource))
        .map(({ id }) => id)
    );
    const submission = new Set(
      Array.from(pageResources.values())
        .filter((resource) =>
          Array.from(getResourceDataSourceIds(resource)).some((id) =>
            formParameterIds.has(id)
          )
        )
        .map(({ id }) => id)
    );
    for (let changed = true; changed;) {
      changed = false;
      for (const resource of pageResources.values()) {
        if (
          submission.has(resource.id) === false &&
          Array.from(
            getResourceDependencyIds({
              resource,
              dataSources: pageDataSources,
            })
          ).some((id) => submission.has(id))
        ) {
          submission.add(resource.id);
          changed = true;
        }
      }
    }
    const parents = getParentInstanceById(
      view.generated as Map<Instance["id"], Instance>
    );
    const isInForm = (instanceId: Instance["id"] | undefined) => {
      const seen = new Set<Instance["id"]>();
      for (
        let current = instanceId;
        current !== undefined && seen.has(current) === false;
        current = parents.get(current)
      ) {
        seen.add(current);
        if (view.generated.get(current)?.component === "ResourceForm") {
          return true;
        }
      }
      return false;
    };
    const used = getPageResourceRootIds({
      page: { ...view.page, rootInstanceId: view.rootId },
      instances: view.generated as Map<Instance["id"], Instance>,
      props: pageProps,
      dataSources: pageDataSources,
    });
    for (const dataSource of pageDataSources.values()) {
      if (
        dataSource.type === "resource" &&
        isInForm(dataSource.scopeInstanceId) === false
      ) {
        used.add(dataSource.resourceId);
      }
    }
    for (const prop of pageProps.values()) {
      if (prop.type === "resource") {
        used.add(prop.value);
      }
    }
    for (const resourceId of [...used]) {
      for (const dependencyId of transitive(resourceId)) {
        used.add(dependencyId);
      }
    }
    // what a form's submission sends: its destinations and what they read
    const sent = new Set<Resource["id"]>();
    for (const prop of pageProps.values()) {
      if (
        prop.type !== "json" ||
        prop.name !== "action" ||
        view.generated.get(prop.instanceId)?.component !== "ResourceForm" ||
        isFormSubmission(prop.value) === false
      ) {
        continue;
      }
      for (const dataSourceId of getFormActions(prop.value)) {
        const dataSource = pageDataSources.get(dataSourceId);
        if (dataSource?.type !== "resource") {
          continue;
        }
        for (const resourceId of [
          dataSource.resourceId,
          ...transitive(dataSource.resourceId),
        ]) {
          sent.add(resourceId);
          if (used.has(resourceId) === false) {
            submission.add(resourceId);
          }
        }
      }
    }
    // a Resource a data source or a resource prop under the root loads may
    // name the Resources' data
    const treeIds = findTreeInstanceIds(
      view.generated as Map<Instance["id"], Instance>,
      view.rootId
    );
    const inGraph = new Set<Resource["id"]>();
    for (const dataSource of pageDataSources.values()) {
      if (dataSource.type === "resource") {
        inGraph.add(dataSource.resourceId);
      }
    }
    for (const prop of pageProps.values()) {
      if (prop.type === "resource" && treeIds.has(prop.instanceId)) {
        inGraph.add(prop.value);
      }
    }
    return { loaded, submission, sent, inGraph };
  };

  const publishedResources = new Set<Resource["id"]>();
  for (let changed = true; changed;) {
    changed = false;
    for (const view of views) {
      const { loaded, submission, sent, inGraph } = resourcesOf(view);
      for (const resourceId of [...loaded].sort()) {
        if (submission.has(resourceId) && sent.has(resourceId) === false) {
          // no form on the page sends it
          continue;
        }
        publishedResources.add(resourceId);
        if (paused.has(`resource:${resourceId}`)) {
          continue;
        }
        const mayName = submission.has(resourceId)
          ? namesOn(
              view,
              (dataSource) =>
                dataSource.type === "resource" ||
                isFormParameter(view, dataSource)
            )
          : namesOn(
              view,
              (dataSource) =>
                dataSource.type === "resource" && inGraph.has(resourceId)
            );
        if (resourceMayRun(resources.get(resourceId), mayName) === false) {
          pause(`resource:${resourceId}`, { kind: "resource", resourceId });
          // a Resource that goes takes its data sources
          for (const dataSource of dataSources.values()) {
            if (
              dataSource.type === "resource" &&
              dataSource.resourceId === resourceId
            ) {
              goes.add(dataSource.id);
            }
          }
          changed = true;
        }
      }
    }
  }
  if (build.observe !== undefined) {
    for (const view of views) {
      const { loaded, submission, sent, inGraph } = resourcesOf(view);
      build.observe({
        pageId: view.page.id,
        held: view.held,
        inGraph: new Set(
          [...inGraph].filter(
            (id) =>
              loaded.has(id) &&
              resources.has(id) &&
              submission.has(id) === false
          )
        ),
        submission: new Set([...submission].filter((id) => sent.has(id))),
        text: new Set(
          pageFieldValues(view.page).flatMap(([field, value]) =>
            typeof value === "string" &&
            (pageTextFields.has(field) || field.startsWith("custom.")) &&
            writtenAsText(value)
              ? [field]
              : []
          )
        ),
      });
    }
  }
  // a Resource no page loads or sends is not published: input validation
  // alone
  for (const [resourceId, resource] of resources) {
    let refused: boolean;
    try {
      refused = checkResource(resource) !== undefined;
    } catch {
      refused = true;
    }
    if (publishedResources.has(resourceId) === false && refused) {
      pause(`resource:${resourceId}`, {
        kind: "resource",
        resourceId,
        unpublished: true,
      });
    }
  }

  const judgedProps = new Set<Prop["id"]>();
  const visitedInstances = new Set<Instance["id"]>();
  for (const view of views) {
    const { page } = view;

    // the page's settings
    const inPageMeta = namesOn(
      view,
      (dataSource) => dataSource.type === "resource"
    );
    for (const [field, value] of pageFieldValues(page)) {
      if (field !== "title" && value === undefined) {
        continue;
      }
      let mayRun: boolean;
      try {
        mayRun =
          typeof value === "string" &&
          ((pageTextFields.has(field) || field.startsWith("custom.")) &&
          writtenAsText(value)
            ? checkValueExpression(value).ok
            : expressionMayRun(value, inPageMeta));
      } catch {
        mayRun = false;
      }
      if (mayRun === false) {
        pause(`page:${page.id}:${field}`, {
          kind: "page",
          pageId: page.id,
          field,
        });
      }
    }

    // the page module, along each path to an instance
    const inPageModule = (parameters: ReadonlySet<DataSource["id"]>) =>
      namesOn(
        view,
        (dataSource) =>
          dataSource.type === "resource" ||
          isFormParameter(view, dataSource) ||
          parameters.has(dataSource.id)
      );
    const visited = new Set<string>();
    const onPath = new Set<Instance["id"]>();
    const visit = (
      instanceId: Instance["id"],
      parameters: ReadonlySet<DataSource["id"]>
    ) => {
      const instance = instances.get(instanceId);
      const visitKey = `${instanceId}\n${[...parameters].sort().join("\n")}`;
      if (
        instance === undefined ||
        view.held.has(instanceId) === false ||
        instance.component === blockTemplateComponent ||
        instance.component === descendantComponent ||
        onPath.has(instanceId) ||
        visited.has(visitKey)
      ) {
        return;
      }
      visited.add(visitKey);
      visitedInstances.add(instanceId);
      const inPage = inPageModule(parameters);
      const instanceProps = propsByInstance.get(instanceId) ?? [];
      const isCollection = instance.component === collectionComponent;
      // the props a page publishes
      const writes = (prop: Prop) =>
        prop.name === showPropName ||
        (isCollection
          ? prop.name === "data" || collectionBindingNames.has(prop.name)
          : instance.component !== blockComponent &&
            instance.component !== blockBodyComponent);
      // a Collection's item and itemKey may each be only a parameter of the
      // Collection's own that nothing around it binds and the other does not
      // name
      const isBinding = (prop: Prop) =>
        isCollection && collectionBindingNames.has(prop.name);
      const bindingMayRun = (prop: Prop) => {
        if (prop.type !== "parameter") {
          return false;
        }
        const dataSource = dataSources.get(prop.value);
        // a binding to a data source the build does not hold, or one that
        // goes for its id first, may stay
        if (dataSource === undefined) {
          return true;
        }
        return (
          instanceProps.filter((other) => other.name === prop.name).length ===
            1 &&
          dataSource.type === "parameter" &&
          dataSource.id !== page.systemDataSourceId &&
          parameters.has(dataSource.id) === false &&
          instanceProps.every(
            (other) =>
              other.name === prop.name ||
              isBinding(other) === false ||
              other.type !== "parameter" ||
              other.value !== prop.value
          )
        );
      };
      let inside = parameters;
      if (isCollection) {
        inside = new Set(parameters);
        for (const prop of instanceProps) {
          if (
            isBinding(prop) &&
            bindingMayRun(prop) &&
            prop.type === "parameter"
          ) {
            (inside as Set<DataSource["id"]>).add(prop.value);
          }
        }
      }
      // a Collection's own children may name its item and itemKey
      const inChildren = isCollection ? inPageModule(inside) : inPage;
      for (const prop of instanceProps) {
        if (writes(prop) === false) {
          continue;
        }
        judgedProps.add(prop.id);
        const mayRun = isBinding(prop)
          ? bindingMayRun(prop)
          : prop.type === "expression"
            ? expressionMayRun(prop.value, inPage)
            : prop.type === "parameter"
              ? goes.has(prop.value) || inPage(prop.value)
              : true;
        if (mayRun === false) {
          pause(`prop:${prop.id}`, {
            kind: "prop",
            instanceId,
            propId: prop.id,
            name: prop.name,
          });
        }
      }
      instance.children.forEach((child, index) => {
        if (
          child.type === "expression" &&
          expressionMayRun(child.value, inChildren) === false
        ) {
          pause(`child:${instanceId}:${index}`, {
            kind: "child",
            instanceId,
            index,
          });
        }
      });
      onPath.add(instanceId);
      for (const child of instance.children) {
        if (child.type === "id") {
          visit(child.value, inside);
        }
      }
      onPath.delete(instanceId);
    };
    visit(page.rootInstanceId, new Set());
  }

  // What no page publishes: input validation alone
  const refusedValue = (value: unknown) =>
    checkValueExpression(value as string).ok === false;
  for (const prop of props) {
    if (
      judgedProps.has(prop.id) === false &&
      prop.type === "expression" &&
      refusedValue(prop.value)
    ) {
      pause(`prop:${prop.id}`, {
        kind: "prop",
        instanceId: prop.instanceId,
        propId: prop.id,
        name: prop.name,
        unpublished: true,
      });
    }
  }
  for (const [instanceId, instance] of instances) {
    if (visitedInstances.has(instanceId)) {
      continue;
    }
    instance.children.forEach((child, index) => {
      if (child.type === "expression" && refusedValue(child.value)) {
        pause(`child:${instanceId}:${index}`, {
          kind: "child",
          instanceId,
          index,
          unpublished: true,
        });
      }
    });
  }
  for (const page of build.pages) {
    if (page.meta.title !== undefined && refusedValue(page.meta.title)) {
      pause(`page:${page.id}:metaTitle`, {
        kind: "page",
        pageId: page.id,
        field: "metaTitle",
        unpublished: true,
      });
    }
  }
  for (const template of build.templates ?? []) {
    const fields: Array<[PageExpressionField, unknown]> = [
      ...pageFieldValues(template),
      ["metaTitle", template.meta.title],
    ];
    for (const [field, value] of fields) {
      if ((field === "title" || value !== undefined) && refusedValue(value)) {
        pause(`page:${template.id}:${field}`, {
          kind: "page",
          pageId: template.id,
          field,
          unpublished: true,
        });
      }
    }
  }
  return [...paused.values()];
};

// Input validation for expressions and generated names, read by the builder
// and the CLI through this entry (code-check.ts).
export * from "./code-check";
