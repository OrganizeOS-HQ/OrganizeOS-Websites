import { describe, expect, test } from "vitest";
import {
  ROOT_FOLDER_ID,
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
