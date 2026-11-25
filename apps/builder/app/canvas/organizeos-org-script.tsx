/**
 * OrganizeOS fork: the builder never runs an org's embed code
 * (docs/ORGANIZEOS-FORK.md section 10, "The builder never runs embed code";
 * spec 2026-11-20-builder-code-embeds-design.md, 4.2, in the OrganizeOS
 * repo).
 *
 * The builder canvas, `p-{projectId}.builder.organizeos.org`, is same-origin
 * with the builder UI. Upstream's HTML Embed puts its code into the page with
 * `innerHTML` in design mode, which fires inline handlers, and re-creates and
 * runs its scripts in preview mode or with "Run scripts on canvas". So the
 * canvas registers its own HTML Embed and Markdown Embed in every mode, which
 * show an embed only through the sanitized insertion path
 * (~/shared/organizeos-untrusted-markup.tsx), and drops "Run scripts on
 * canvas" from the HTML Embed's settings. That is a standing rule, whatever
 * either switch says.
 *
 * While orgEmbedsMayShip() is off, publishing leaves the embeds out, so the
 * canvas also shows them as paused, HTML Embed, Markdown Embed and JSON-LD
 * leave the Components panel and the command palette, and the Content Embed
 * and Markdown Embed templates are left out. Nothing is deleted: the embeds
 * stay in the build. Publish leaves them out
 * (packages/cli/src/organizeos-org-script.ts).
 */
import {
  forwardRef,
  useContext,
  useMemo,
  type ComponentPropsWithoutRef,
  type ExoticComponent,
  type Ref,
} from "react";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import type { TemplateMeta } from "@webstudio-is/template";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import {
  HtmlEmbed,
  MarkdownEmbed,
} from "@webstudio-is/sdk-components-react/components";
import { renderMarkdownHtml } from "@webstudio-is/sdk-components-react/markdown";
import {
  checkElementTag,
  checksInstanceTag,
  elementTagMayRender,
  orgEmbedsMayShip,
  orgScriptMayRun,
  templateIconCodes,
} from "@organizeos/site-components/org-script";
import { platformName } from "~/shared/branding";
import { UntrustedMarkup } from "~/shared/organizeos-untrusted-markup";
// OrganizeOS fork: upstream's own asset URL resolution, by its source path:
// the package's exports map does not export it, and a runtime package stays
// byte-identical to upstream (docs/ORGANIZEOS-FORK.md section 7)
import { resolveHtmlEmbedAssetUrls } from "../../../../packages/sdk-components-react/src/html-embed-assets";

/**
 * The block that stands where an embed shows nothing. HTML Embed's preset
 * style is `display: contents`, which would give the notice no box, so it
 * sets its own display and padding inline, as upstream's own Placeholder does.
 */
const Notice = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<"div"> & { text: string }
>(({ text, ...props }, ref) => (
  <div {...props} ref={ref} style={{ display: "block", padding: 20 }}>
    {text}
  </div>
));
Notice.displayName = "PausedEmbedNotice";

/** The box for an embed with nothing the canvas may show. */
const publishedOnlyText = "Shows on the published site";

const renderPublishedOnly = ({
  ref,
  rest,
}: {
  ref: Ref<HTMLElement>;
  rest: Record<string, unknown>;
}) => (
  <Notice {...rest} ref={ref as Ref<HTMLDivElement>} text={publishedOnlyText} />
);

const htmlEmbedPausedText = `HTML Embed is paused. Its code is kept, but it isn't published and doesn't run here: scripts on your site could read the ${platformName} sign-in of people who visit.`;

const markdownEmbedPausedText = `Markdown Embed is paused. Its content is kept, but it isn't published and isn't shown here: a link in it could run script that reads the ${platformName} sign-in of people who visit.`;

const isTemplateIcon = (code: unknown): code is string =>
  typeof code === "string" && templateIconCodes.has(code);

/**
 * The canvas's HTML Embed, in every mode. It never hands org code to
 * upstream's component, and never runs a script: not in design mode, preview
 * mode, safe mode or with a saved "Run scripts on canvas".
 *
 * - A template icon (a string byte-identical to one) renders through
 *   upstream's component, with scripts off.
 * - While embeds may not ship, anything else shows the paused notice.
 * - Otherwise: missing or blank code shows upstream's placeholder; anything
 *   else is `String(code)` with asset URLs resolved as upstream resolves them
 *   (before sanitizing), put in through the insertion path, and when nothing
 *   renderable is left, the box reading "Shows on the published site".
 */
export const CanvasHtmlEmbed = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof HtmlEmbed>
>((props, ref) => {
  // $ws$executeScripts is the canvas's, given to every HTML Embed
  // (webstudio-component.tsx): only upstream's embed reads it
  const {
    code: savedCode,
    clientOnly: _clientOnly,
    executeScriptOnCanvas: _executeScriptOnCanvas,
    $ws$executeScripts: _executeScripts,
    children: _children,
    ...rest
  } = props;
  // the canvas passes whatever the prop computes to, not only a string
  const code: unknown = savedCode;
  const { assetUrlsByPath } = useContext(ReactSdkContext);
  // Upstream's HTML Embed turns whatever it is given into a string with
  // String(code), so only a string is ever tested against the icons, and a
  // value whose String() throws shows the box
  const markup = useMemo(() => {
    try {
      // as upstream resolves it: a null field renders nothing, not "null"
      return resolveHtmlEmbedAssetUrls(String(code ?? ""), assetUrlsByPath);
    } catch {
      return undefined;
    }
  }, [code, assetUrlsByPath]);
  if (isTemplateIcon(code)) {
    return (
      <HtmlEmbed {...rest} code={code} $ws$executeScripts={false} ref={ref} />
    );
  }
  if (orgEmbedsMayShip() === false) {
    return <Notice {...rest} ref={ref} text={htmlEmbedPausedText} />;
  }
  if (
    code === undefined ||
    code === null ||
    (typeof code === "string" && code.trim() === "")
  ) {
    return (
      <HtmlEmbed
        {...rest}
        code={code === null ? (undefined as never) : savedCode}
        $ws$executeScripts={false}
        ref={ref}
      />
    );
  }
  if (markup === undefined) {
    return <Notice {...rest} ref={ref} text={publishedOnlyText} />;
  }
  return (
    <UntrustedMarkup
      {...rest}
      ref={ref}
      markup={markup}
      renderFallback={renderPublishedOnly}
    />
  );
});
CanvasHtmlEmbed.displayName = "CanvasHtmlEmbed";

/**
 * The canvas's Markdown Embed, in every mode. While embeds may not ship it
 * shows the paused notice; otherwise it renders the Markdown with upstream's
 * renderer and puts the HTML in through the insertion path, since upstream's
 * own filter (`sanitize-html`, which keeps iframes) is not the canvas's
 * boundary.
 */
type MarkdownEmbedProps = ComponentPropsWithoutRef<typeof MarkdownEmbed>;

/**
 * The Markdown, once embeds may ship: rendered and put in through the
 * insertion path, or the box when nothing renderable is left or the renderer
 * (or the canvas's image loader) throws.
 */
const ShippingMarkdownEmbed = forwardRef<HTMLDivElement, MarkdownEmbedProps>(
  (props, ref) => {
    const { code, children: _children, ...rest } = props;
    const { imageLoader, renderer } = useContext(ReactSdkContext);
    const markup = useMemo(() => {
      try {
        return renderMarkdownHtml(typeof code === "string" ? code : "", {
          imageLoader,
          renderer,
        });
      } catch {
        return undefined;
      }
    }, [code, imageLoader, renderer]);
    if (markup === undefined) {
      return <Notice {...rest} ref={ref} text={publishedOnlyText} />;
    }
    return (
      <UntrustedMarkup
        {...rest}
        ref={ref}
        markup={markup}
        renderFallback={renderPublishedOnly}
      />
    );
  }
);
ShippingMarkdownEmbed.displayName = "ShippingMarkdownEmbed";

export const CanvasMarkdownEmbed = forwardRef<
  HTMLDivElement,
  MarkdownEmbedProps
>((props, ref) => {
  // while embeds may not ship nothing is rendered or computed
  if (orgEmbedsMayShip() === false) {
    const { code: _code, children: _children, ...rest } = props;
    return <Notice {...rest} ref={ref} text={markdownEmbedPausedText} />;
  }
  return <ShippingMarkdownEmbed {...props} ref={ref} />;
});
CanvasMarkdownEmbed.displayName = "CanvasMarkdownEmbed";

type Library = {
  namespace?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: Record<string, ExoticComponent<any>>;
  metas: Record<string, WsComponentMeta>;
  // the registry's ids for the component objects upstream's templates name
  componentIds?: ReadonlyMap<object, string>;
  templates: Record<string, TemplateMeta>;
};

/**
 * The components publish leaves out while embeds may not ship, which the
 * Components panel and the command palette do not offer then. JSON-LD renders
 * as inert text on the canvas, so it keeps its component.
 */
const embedMetas = ["HtmlEmbed", "MarkdownEmbed", "JsonLd"];

/** The HTML Embed's meta without "Run scripts on canvas". */
const withoutRunScriptsOnCanvas = (meta: WsComponentMeta): WsComponentMeta => {
  const { executeScriptOnCanvas: _executeScriptOnCanvas, ...props } =
    meta.props ?? {};
  return {
    ...meta,
    props,
    initialProps: meta.initialProps?.filter(
      (name) => name !== "executeScriptOnCanvas"
    ),
  };
};

/**
 * A library of the registry as the canvas registers it. Always: the canvas's
 * own HTML Embed and Markdown Embed (CanvasHtmlEmbed, CanvasMarkdownEmbed),
 * and an HTML Embed meta without "Run scripts on canvas". While embeds may not
 * ship, also: HTML Embed, Markdown Embed and JSON-LD hidden from the Components
 * panel and the command palette (`category: "hidden"`; the Navigator, their
 * icons and their labels are unchanged), and the Content Embed and Markdown
 * Embed templates left out. Everything else, the registry's `componentIds`
 * among it, passes through by reference.
 */
export const withOrgScriptPolicy = <Registered extends Library>(
  library: Registered,
  { embedsMayShip = orgEmbedsMayShip() }: { embedsMayShip?: boolean } = {}
): Registered => {
  const components: Library["components"] = { ...library.components };
  if ("HtmlEmbed" in components) {
    components.HtmlEmbed = CanvasHtmlEmbed;
  }
  if ("MarkdownEmbed" in components) {
    components.MarkdownEmbed = CanvasMarkdownEmbed;
  }
  const metas: Library["metas"] = { ...library.metas };
  if ("HtmlEmbed" in metas) {
    metas.HtmlEmbed = withoutRunScriptsOnCanvas(metas.HtmlEmbed);
  }
  const templates: Library["templates"] = { ...library.templates };
  if (embedsMayShip === false) {
    for (const name of embedMetas) {
      if (name in metas) {
        metas[name] = { ...metas[name], category: "hidden" };
      }
    }
    delete templates.ContentEmbed;
    delete templates.MarkdownEmbed;
  }
  return { ...library, components, metas, templates };
};

/**
 * A library without upstream's "Built with Webstudio" badge template, which
 * puts an upstream ad on the customer's published site. Left out here, where
 * the canvas registers the library, rather than in the registry or
 * @webstudio-is/sdk, which this fork keeps as upstream's
 * (docs/ORGANIZEOS-FORK.md section 1). Only the core library has it.
 */
export const withoutBuiltWithWebstudio = <
  Registered extends Pick<Library, "templates">,
>(
  library: Registered
): Registered => {
  if ("builtWithWebstudio" in library.templates === false) {
    return library;
  }
  const { builtWithWebstudio: _badge, ...templates } = library.templates;
  return { ...library, templates };
};

/**
 * Whether the canvas may make an element from an instance's tag. On every
 * component `checksInstanceTag` names, only a tag the builder offers, whatever
 * the switch says (input validation, code-check.ts); and, while the switch is
 * off, only one `elementTagMayRender` accepts.
 */
export const instanceTagMayRender = (
  component: string,
  tag: unknown,
  mayRun: boolean = orgScriptMayRun()
): boolean =>
  (checksInstanceTag(component) === false || checkElementTag(tag).ok) &&
  elementTagMayRender(tag, mayRun);
