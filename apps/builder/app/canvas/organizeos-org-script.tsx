/**
 * OrganizeOS fork: an org's own script is paused until its sites move to their
 * own domain (docs/ORGANIZEOS-FORK.md section 10, orgScriptMayRun()).
 *
 * The builder canvas, `p-{projectId}.builder.organizeos.org`, is same-origin
 * with the builder UI and receives the platform session. Upstream's HTML
 * Embed puts its code into the page with `innerHTML` in every mode, which
 * skips `<script>` but fires inline handlers (`<img src=x onerror=…>`), and
 * runs scripts in preview mode. So an embed one admin writes could read the
 * session of every co-admin who opens the page. This module closes that where
 * the code would run, and leaves upstream's many insert and paste paths alone:
 *
 * - HTML Embed, Content Embed and Markdown Embed leave the Components panel and
 *   the command palette;
 * - an HTML Embed on the canvas shows a notice instead of its code, unless the
 *   code is one of the SVG icons upstream's own templates insert;
 * - a Markdown Embed always shows the notice (it keeps `javascript:` links).
 *
 * Nothing is deleted: the embeds stay in the build and show as paused. Publish
 * leaves them out (packages/cli/src/organizeos-org-script.ts).
 */
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ExoticComponent,
} from "react";
import type { Hook } from "@webstudio-is/react-sdk";
import type { WsComponentMeta } from "@webstudio-is/sdk";
import type { TemplateMeta } from "@webstudio-is/template";
import {
  HtmlEmbed,
  MarkdownEmbed,
} from "@webstudio-is/sdk-components-react/components";
import {
  htmlEmbedCodeMayRun,
  orgScriptMayRun,
} from "@organizeos/site-components/org-script";
import { platformName } from "~/shared/branding";

/**
 * The block that stands where a paused embed is. HTML Embed's preset style is
 * `display: contents`, which would give the notice no box, so it sets its own
 * display and padding inline, as upstream's own Placeholder does.
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

/**
 * The canvas's HTML Embed. It renders upstream's component only for a template
 * icon (or with the switch on), and never puts any other `code` into the DOM:
 * not in design mode, preview mode, safe mode or with "Run scripts on canvas".
 */
export const PausedHtmlEmbed = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof HtmlEmbed>
>((props, ref) => {
  // Upstream's HTML Embed turns whatever it is given into a string with
  // String(code), so only a string is ever tested against the icons.
  if (htmlEmbedCodeMayRun(props.code)) {
    return <HtmlEmbed {...props} ref={ref} />;
  }
  const {
    code: _code,
    clientOnly: _clientOnly,
    executeScriptOnCanvas: _executeScriptOnCanvas,
    children: _children,
    ...rest
  } = props;
  return (
    <Notice
      {...rest}
      ref={ref}
      text={`HTML Embed is paused. Its code is kept, but it isn't published and doesn't run here: scripts on your site could read the ${platformName} sign-in of people who visit.`}
    />
  );
});
PausedHtmlEmbed.displayName = "PausedHtmlEmbed";

/**
 * The canvas's Markdown Embed. Its renderer keeps `javascript:` links
 * (`allowDangerousProtocol`), and no template icon is Markdown, so unlike the
 * HTML Embed it has no exception.
 */
export const PausedMarkdownEmbed = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof MarkdownEmbed>
>((props, ref) => {
  if (orgScriptMayRun()) {
    return <MarkdownEmbed {...props} ref={ref} />;
  }
  const { code: _code, children: _children, ...rest } = props;
  return (
    <Notice
      {...rest}
      ref={ref}
      text={`Markdown Embed is paused. Its content is kept, but it isn't published and isn't shown here: a link in it could run script that reads the ${platformName} sign-in of people who visit.`}
    />
  );
});
PausedMarkdownEmbed.displayName = "PausedMarkdownEmbed";

type Library = {
  namespace?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: Record<string, ExoticComponent<any>>;
  metas: Record<string, WsComponentMeta>;
  hooks?: Hook[];
  templates: Record<string, TemplateMeta>;
};

/**
 * Upstream's base library as the canvas registers it, with org script paused:
 * while the switch is off, HTML Embed and Markdown Embed are hidden from the
 * Components panel and the command palette (`category: "hidden"`; the
 * Navigator, their icons and their labels are unchanged), the Content Embed
 * and Markdown Embed templates are left out, and the canvas renders the paused
 * stand-ins. Everything else passes through by reference, and the input comes
 * back untouched when the switch is on.
 */
export const withOrgScriptPolicy = <Registered extends Library>(
  library: Registered,
  { mayRun = orgScriptMayRun() }: { mayRun?: boolean } = {}
): Registered => {
  if (mayRun) {
    return library;
  }
  const components: Library["components"] = { ...library.components };
  if ("HtmlEmbed" in components) {
    components.HtmlEmbed = PausedHtmlEmbed;
  }
  if ("MarkdownEmbed" in components) {
    components.MarkdownEmbed = PausedMarkdownEmbed;
  }
  const metas: Library["metas"] = { ...library.metas };
  for (const name of ["HtmlEmbed", "MarkdownEmbed"]) {
    if (name in metas) {
      metas[name] = { ...metas[name], category: "hidden" };
    }
  }
  const templates: Library["templates"] = { ...library.templates };
  delete templates.ContentEmbed;
  delete templates.MarkdownEmbed;
  return { ...library, components, metas, templates };
};
