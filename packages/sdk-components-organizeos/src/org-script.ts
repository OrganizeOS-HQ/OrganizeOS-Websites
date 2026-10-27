import { parseExpressionAt, type Expression } from "acorn";
import {
  collectionComponent,
  elementComponent,
  tags,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";

/**
 * Whether an org's own script may run on its Website: HTML Embeds, Content
 * Embeds, Markdown Embeds, the SVG `animate` and `set` elements, an element
 * whose tag the builder does not offer, the `dangerouslySetInnerHTML` prop,
 * the site-wide custom code, and the unsafe values (an address that can run
 * script, `srcdoc`, an event handler attribute, an XML element on an HTML page
 * and a redirect to an unsafe address). It is off (owner decision,
 * 2026-10-21); what orgs saved is kept, and each org's next publish ships it
 * again once this is on.
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
 * as guardLevel (docs/ORGANIZEOS-FORK.md section 5). Level 1 has one
 * requirement not yet in this repository; the level stays 0 until it lands.
 * packages/cli/src/organizeos-guard-level.test.ts fails if it is raised while
 * a requirement is missing; raising it is a reviewed change that edits that
 * test.
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

const expressionMayRun = (node: Expression): boolean => {
  if (node.type === "ParenthesizedExpression") {
    return expressionMayRun(node.expression);
  }
  if (node.type === "ConditionalExpression") {
    return (
      expressionMayRun(node.consequent) && expressionMayRun(node.alternate)
    );
  }
  if (node.type === "LogicalExpression") {
    return expressionMayRun(node.left) && expressionMayRun(node.right);
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
  return expressionMayRun(node);
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
 * Whether publishing keeps this prop. Every prop of an XML element ships. A
 * `srcdoc` never does, nor an `on…` prop that is not an action. An address
 * ships when it is of a type that cannot hold one (a page, an asset, a
 * resource, an action, a number, a boolean), when its static value may run
 * whatever its shape, or when it is bound and its fixed start decides the
 * scheme or the binding cannot run script (`inertSrcComponents`,
 * `inertSrcTags`, `inertHrefComponents`). `data` is an address only on an
 * `object` (`recordDataHolder`).
 */
export const propMayShip = (
  instance: InstanceKind,
  prop: Prop,
  mayRun: boolean = orgScriptMayRun()
): boolean => {
  if (mayRun || xmlComponents.has(instance.component)) {
    return true;
  }
  if (isFrameDocumentName(prop.name)) {
    return false;
  }
  if (isEventAttributeName(prop.name)) {
    return prop.type === "action";
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
    case "action":
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
 * not a function, and every address value that `urlValueMayRun` refuses,
 * whatever its shape (`data` stays only on a `recordDataHolder`). The same
 * object when nothing goes, never a changed input, and the input itself when
 * the switch is on.
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
