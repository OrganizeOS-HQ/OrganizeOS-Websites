import { describe, expect, test } from "vitest";
import {
  ROOT_FOLDER_ID,
  blockComponent,
  blockTemplateComponent,
  type Instance,
  type Page,
  type Pages,
  type Prop,
} from "@webstudio-is/sdk";
import { MenuIcon } from "@webstudio-is/icons/svg";
import { findPausedScript } from "./organizeos-publish-paused-script";

const createPage = (id: string, name: string): Page => ({
  id,
  name,
  path: id === "home" ? "" : `/${id}`,
  title: `"${name}"`,
  meta: {},
  rootInstanceId: `${id}-root`,
});

const createPages = ({ code }: { code?: string } = {}): Pages => {
  const pages = [createPage("home", "Home"), createPage("about", "About")];
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
          "xml",
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

    expect(find({ instances, props }).map((item) => item.label)).toEqual([
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
      find({ instances, props }).map((item) => item.navigate?.instanceSelector)
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
          "xml",
          "both",
          "embedded",
          "kept-nav"
        ),
      },
      { id: "form", component: "Form", children: ids("donate") },
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

    const items = find({ instances, props });
    expect(new Set(items.map((item) => item.label))).toEqual(
      new Set(["Element with a tag the builder does not offer on Home"])
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
      { id: "form", component: "Form" },
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
    ).toEqual([
      { label: "Custom code (Project settings)", view: "projectSettings" },
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
      "Custom code (Project settings)",
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
});
