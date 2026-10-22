import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";
import {
  bundleVersion,
  publishedProjectBundle,
  type PublishedProjectBundle,
} from "@webstudio-is/protocol";
import type { Instance, Prop } from "@webstudio-is/sdk";
import { standardAttributesToReactProps } from "@webstudio-is/react-sdk";
import {
  pausedPropNames,
  tagPropsByComponent,
  templateIconCodes,
} from "@organizeos/site-components/org-script";
import {
  describeDroppedOrgScript,
  dropOrgScript,
} from "./organizeos-org-script";

const icons = [...templateIconCodes];
// the Sheet's menu button
const MenuIcon = icons.find((icon) => icon.includes("M2.667 8h10.666")) ?? "";

const DialogTitle = "@webstudio-is/sdk-components-react-radix:DialogTitle";

type InstanceInit = Partial<Instance> & Pick<Instance, "id" | "component">;

const instance = (init: InstanceInit): [string, Instance] => [
  init.id,
  { type: "instance", children: [], ...init },
];

const ids = (...list: string[]): Instance["children"] =>
  list.map((value) => ({ type: "id", value }));

const text = (value: string): Instance["children"][number] => ({
  type: "text",
  value,
});

const stringProp = (
  instanceId: string,
  name: string,
  value: string
): [string, Prop] => [
  `${instanceId}:${name}`,
  { id: `${instanceId}:${name}`, instanceId, name, type: "string", value },
];

const expressionProp = (
  instanceId: string,
  name: string,
  value: string
): [string, Prop] => [
  `${instanceId}:${name}`,
  { id: `${instanceId}:${name}`, instanceId, name, type: "expression", value },
];

const resourceProp = (
  instanceId: string,
  name: string,
  value: string
): [string, Prop] => [
  `${instanceId}:${name}`,
  { id: `${instanceId}:${name}`, instanceId, name, type: "resource", value },
];

const jsonProp = (
  instanceId: string,
  name: string,
  value: unknown
): [string, Prop] => [
  `${instanceId}:${name}`,
  { id: `${instanceId}:${name}`, instanceId, name, type: "json", value },
];

const createBundle = ({
  instances = [],
  props = [],
  dataSources = [],
  code,
}: {
  instances?: Array<[string, Instance]>;
  props?: Array<[string, Prop]>;
  dataSources?: PublishedProjectBundle["build"]["dataSources"];
  code?: string;
} = {}): PublishedProjectBundle => {
  const pages = [
    {
      id: "home",
      name: "Home",
      title: "Home",
      path: "",
      rootInstanceId: "root",
      meta: {},
    },
    {
      id: "about",
      name: "About",
      title: "About",
      path: "/about",
      rootInstanceId: "about-root",
      meta: {},
    },
  ];
  return publishedProjectBundle.parse({
    bundleVersion,
    origin: "https://assets.example",
    projectDomain: "example.com",
    projectTitle: "Example",
    page: pages[0],
    pages,
    assets: [],
    build: {
      id: "build-id",
      projectId: "project-id",
      version: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      pages: {
        meta: { siteName: "Site", ...(code === undefined ? {} : { code }) },
        homePageId: "home",
        rootFolderId: "root-folder",
        pages,
        folders: [
          {
            id: "root-folder",
            name: "Root",
            slug: "",
            children: pages.map((page) => page.id),
          },
        ],
      },
      props,
      instances,
      dataSources,
      resources: [],
      styleSources: [],
      styleSourceSelections: [],
      styles: [],
      breakpoints: [],
    },
  });
};

const instanceIds = (bundle: PublishedProjectBundle) =>
  bundle.build.instances.map(([id]) => id);

const childrenOf = (bundle: PublishedProjectBundle, id: string) =>
  new Map(bundle.build.instances).get(id)?.children;

const propIds = (bundle: PublishedProjectBundle) =>
  bundle.build.props.map(([id]) => id);

describe("dropOrgScript", () => {
  // T11
  test("drops a script embed with its descendants, props, scoped data and the parent's reference", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("before", "box", "after"),
        }),
        instance({ id: "before", component: "Box" }),
        instance({
          id: "box",
          component: "Box",
          children: ids("first", "embed", "last"),
        }),
        instance({ id: "first", component: "Box" }),
        instance({
          id: "embed",
          component: "HtmlEmbed",
          children: ids("heading", "paragraph"),
        }),
        instance({ id: "heading", component: "ws:descendant" }),
        instance({ id: "paragraph", component: "ws:descendant" }),
        instance({ id: "last", component: "Box" }),
        instance({ id: "after", component: "Box" }),
      ],
      props: [
        stringProp("embed", "code", '<script>alert("embed")</script>'),
        stringProp("embed", "clientOnly", "true"),
        stringProp("heading", "selector", " h1"),
        stringProp("paragraph", "selector", " p"),
        stringProp("first", "id", "first"),
        resourceProp("embed", "data", "resource-1"),
      ],
      dataSources: [
        [
          "scoped",
          {
            type: "resource",
            id: "scoped",
            scopeInstanceId: "embed",
            name: "html",
            resourceId: "resource-1",
          },
        ],
        [
          "kept",
          {
            type: "variable",
            id: "kept",
            scopeInstanceId: "box",
            name: "kept",
            value: { type: "string", value: "x" },
          },
        ],
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual([
      "root",
      "before",
      "box",
      "first",
      "last",
      "after",
    ]);
    expect(childrenOf(result, "box")).toEqual(ids("first", "last"));
    expect(childrenOf(result, "root")).toEqual(ids("before", "box", "after"));
    expect(propIds(result)).toEqual(["first:id"]);
    expect(result.build.dataSources.map(([id]) => id)).toEqual(["kept"]);
  });

  test.each(icons)("keeps an embed holding the template icon %#", (icon) => {
    const bundle = createBundle({
      instances: [
        instance({ id: "root", component: "Body", children: ids("embed") }),
        instance({ id: "embed", component: "HtmlEmbed" }),
      ],
      props: [stringProp("embed", "code", icon)],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(["root", "embed"]);
    expect(propIds(result)).toEqual(["embed:code"]);
    expect(childrenOf(result, "root")).toEqual(ids("embed"));
  });

  test("drops an embed whose code is an expression, even one that evaluates to an icon", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("bound", "icon-bound", "resource", "empty", "kept"),
        }),
        instance({ id: "bound", component: "HtmlEmbed" }),
        instance({ id: "icon-bound", component: "HtmlEmbed" }),
        instance({ id: "resource", component: "HtmlEmbed" }),
        // upstream's published page prints "Open the Settings panel to insert
        // HTML code." for an embed with no code
        instance({ id: "empty", component: "HtmlEmbed" }),
        instance({ id: "kept", component: "Box" }),
      ],
      props: [
        expressionProp("bound", "code", "$ws$dataSource$html"),
        expressionProp("icon-bound", "code", JSON.stringify(MenuIcon)),
        resourceProp("resource", "code", "resource-1"),
        stringProp("empty", "clientOnly", "true"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(["root", "kept"]);
    expect(childrenOf(result, "root")).toEqual(ids("kept"));
    expect(propIds(result)).toEqual([]);
  });

  test("drops an embed with a code that is an icon plus markup, or has two code props", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("padded", "double"),
        }),
        instance({ id: "padded", component: "HtmlEmbed" }),
        instance({ id: "double", component: "HtmlEmbed" }),
      ],
      props: [
        stringProp("padded", "code", `${MenuIcon}<script>1</script>`),
        [
          "double:icon",
          {
            id: "double:icon",
            instanceId: "double",
            name: "code",
            type: "string",
            value: MenuIcon,
          },
        ],
        [
          "double:script",
          {
            id: "double:script",
            instanceId: "double",
            name: "code",
            type: "string",
            value: "<script>1</script>",
          },
        ],
      ],
    });

    expect(instanceIds(dropOrgScript(bundle))).toEqual(["root"]);
  });

  test("drops an embed in a Slot's Fragment, and so from every page that uses the Slot", () => {
    const bundle = createBundle({
      instances: [
        instance({ id: "root", component: "Body", children: ids("slot") }),
        instance({
          id: "about-root",
          component: "Body",
          children: ids("slot-2"),
        }),
        instance({ id: "slot", component: "Slot", children: ids("fragment") }),
        instance({
          id: "slot-2",
          component: "Slot",
          children: ids("fragment"),
        }),
        instance({
          id: "fragment",
          component: "Fragment",
          children: ids("embed", "kept"),
        }),
        instance({ id: "embed", component: "HtmlEmbed" }),
        instance({ id: "kept", component: "Box" }),
      ],
      props: [stringProp("embed", "code", "<script>1</script>")],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual([
      "root",
      "about-root",
      "slot",
      "slot-2",
      "fragment",
      "kept",
    ]);
    expect(childrenOf(result, "fragment")).toEqual(ids("kept"));
    expect(childrenOf(result, "slot")).toEqual(ids("fragment"));
    expect(childrenOf(result, "slot-2")).toEqual(ids("fragment"));
  });

  test("keeps a Fragment that another Slot still shows when a dropped element held its Slot", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("script", "slot-2"),
        }),
        instance({
          id: "script",
          component: "ws:element",
          tag: "script",
          children: ids("slot"),
        }),
        instance({ id: "slot", component: "Slot", children: ids("fragment") }),
        instance({
          id: "slot-2",
          component: "Slot",
          children: ids("fragment"),
        }),
        instance({
          id: "fragment",
          component: "Fragment",
          children: ids("kept"),
        }),
        instance({ id: "kept", component: "Box" }),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(["root", "slot-2", "fragment", "kept"]);
    expect(childrenOf(result, "root")).toEqual(ids("slot-2"));
  });

  test("drops an element whose tag is script, in every spelling, and one whose tag injects JSX", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids(
            "remote",
            "inline",
            "upper",
            "jsx",
            "mixed",
            "empty",
            "kept"
          ),
        }),
        instance({
          id: "remote",
          component: "ws:element",
          tag: "script",
        }),
        instance({
          id: "inline",
          component: "ws:element",
          tag: "script",
          children: [text("eval(location.hash.slice(1))")],
        }),
        instance({ id: "upper", component: "ws:element", tag: "SCRIPT" }),
        instance({
          id: "jsx",
          component: "ws:element",
          tag: "div />{globalThis.pwned = 1}<div",
        }),
        instance({ id: "mixed", component: "ws:element", tag: "Script" }),
        instance({ id: "empty", component: "ws:element", tag: "" }),
        instance({ id: "kept", component: "ws:element", tag: "section" }),
      ],
      props: [
        stringProp("remote", "src", "https://evil.example/x.js"),
        stringProp("inline", "type", "module"),
        stringProp("kept", "id", "kept"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(["root", "kept"]);
    expect(childrenOf(result, "root")).toEqual(ids("kept"));
    expect(propIds(result)).toEqual(["kept:id"]);
  });

  test("drops a legacy Box, Text and Heading with a tag of script, and a Box with a tag prop that is not a static tag", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids(
            "box",
            "heading",
            "text",
            "prop-script",
            "prop-expression",
            "prop-resource",
            "prop-unknown",
            "nav",
            "section",
            "svg",
            "plain"
          ),
        }),
        instance({ id: "box", component: "Box", tag: "script" }),
        instance({ id: "heading", component: "Heading", tag: "script" }),
        instance({ id: "text", component: "Text", tag: "script" }),
        instance({ id: "prop-script", component: "Box" }),
        instance({ id: "prop-expression", component: "Box" }),
        instance({ id: "prop-resource", component: "Box" }),
        instance({ id: "prop-unknown", component: "Text" }),
        instance({ id: "nav", component: "Box" }),
        instance({ id: "section", component: "ws:element", tag: "section" }),
        instance({ id: "svg", component: "ws:element", tag: "svg" }),
        instance({ id: "plain", component: "Box" }),
      ],
      props: [
        stringProp("prop-script", "tag", "script"),
        expressionProp("prop-expression", "tag", "$ws$dataSource$tag"),
        resourceProp("prop-resource", "tag", "resource-1"),
        stringProp("prop-unknown", "tag", "div />{pwned}<div"),
        stringProp("nav", "tag", "nav"),
        stringProp("box", "id", "dropped"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual([
      "root",
      "nav",
      "section",
      "svg",
      "plain",
    ]);
    expect(childrenOf(result, "root")).toEqual(
      ids("nav", "section", "svg", "plain")
    );
    expect(propIds(result)).toEqual(["nav:tag"]);
  });

  test("drops a Box, Text and Heading whose data-ws-tag prop is not a static tag, and keeps one that is", () => {
    // These read the `data-ws-tag` prop before their legacy `tag` prop, and the
    // generator emits a user prop of that name like any attribute
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids(
            "box",
            "text",
            "heading",
            "expression",
            "resource",
            "jsx",
            "mixed",
            "both",
            "nav",
            "kept"
          ),
        }),
        instance({ id: "box", component: "Box" }),
        instance({
          id: "text",
          component: "Text",
          children: [text("eval(location.hash.slice(1))")],
        }),
        instance({ id: "heading", component: "Heading" }),
        instance({ id: "expression", component: "Box" }),
        instance({ id: "resource", component: "Text" }),
        instance({ id: "jsx", component: "Box" }),
        instance({ id: "mixed", component: "Box" }),
        // the legacy prop is fine, but the data-ws-tag prop comes first
        instance({ id: "both", component: "Box" }),
        instance({ id: "nav", component: "Box" }),
        instance({ id: "kept", component: "Box", tag: "div" }),
      ],
      props: [
        stringProp("box", "data-ws-tag", "script"),
        stringProp("box", "src", "https://evil.example/x.js"),
        stringProp("text", "data-ws-tag", "script"),
        stringProp("heading", "data-ws-tag", "script"),
        expressionProp("expression", "data-ws-tag", "$ws$dataSource$tag"),
        resourceProp("resource", "data-ws-tag", "resource-1"),
        stringProp("jsx", "data-ws-tag", "div />{pwned}<div"),
        stringProp("mixed", "data-ws-tag", "Script"),
        stringProp("both", "tag", "nav"),
        stringProp("both", "data-ws-tag", "script"),
        stringProp("nav", "data-ws-tag", "nav"),
        stringProp("kept", "id", "kept"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(["root", "nav", "kept"]);
    expect(childrenOf(result, "root")).toEqual(ids("nav", "kept"));
    expect(propIds(result)).toEqual(["nav:data-ws-tag", "kept:id"]);
  });

  test("drops a legacy component whose data-ws-tag prop is animate or set, as for the tag prop", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("animate", "set", "transform"),
        }),
        instance({ id: "animate", component: "Box" }),
        instance({ id: "set", component: "Text" }),
        instance({ id: "transform", component: "Box" }),
      ],
      props: [
        stringProp("animate", "data-ws-tag", "animate"),
        stringProp("set", "data-ws-tag", "set"),
        stringProp("transform", "data-ws-tag", "animateTransform"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(["root", "transform"]);
    expect(propIds(result)).toEqual(["transform:data-ws-tag"]);
  });

  test("drops a Radix DialogTitle whose tag prop is not a static tag, and keeps one that is", () => {
    // DialogTitle renders <Tag> from its `tag` prop, which is typed h1 to h6
    // and checked by nothing at run time
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids(
            "script",
            "expression",
            "resource",
            "jsx",
            "animate",
            "h2",
            "default"
          ),
        }),
        instance({
          id: "script",
          component: DialogTitle,
          children: [text("eval(location.hash.slice(1))")],
        }),
        instance({ id: "expression", component: DialogTitle }),
        instance({ id: "resource", component: DialogTitle }),
        instance({ id: "jsx", component: DialogTitle }),
        instance({ id: "animate", component: DialogTitle }),
        instance({ id: "h2", component: DialogTitle }),
        instance({ id: "default", component: DialogTitle, tag: "h2" }),
      ],
      props: [
        stringProp("script", "tag", "script"),
        expressionProp("expression", "tag", "$ws$dataSource$tag"),
        resourceProp("resource", "tag", "resource-1"),
        stringProp("jsx", "tag", "div />{pwned}<div"),
        stringProp("animate", "tag", "animate"),
        stringProp("h2", "tag", "h2"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(["root", "h2", "default"]);
    expect(childrenOf(result, "root")).toEqual(ids("h2", "default"));
    expect(propIds(result)).toEqual(["h2:tag"]);
  });

  test("leaves a data-ws-tag prop alone where it is only an attribute", () => {
    // ws:element renders instance.tag, DialogTitle reads `tag` only, and
    // XML Node (category xml) is left to the follow-up in the fork doc
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("element", "title", "link"),
        }),
        instance({ id: "element", component: "ws:element", tag: "div" }),
        instance({ id: "title", component: DialogTitle }),
        instance({ id: "link", component: "Link" }),
      ],
      props: [
        stringProp("element", "data-ws-tag", "script"),
        stringProp("element", "tag", "script"),
        stringProp("title", "data-ws-tag", "script"),
        stringProp("link", "data-ws-tag", "script"),
      ],
    });

    expect(instanceIds(dropOrgScript(bundle))).toEqual([
      "root",
      "element",
      "title",
      "link",
    ]);
  });

  test("drops the dangerouslySetInnerHTML prop of any instance, whatever its type, and keeps the instance", () => {
    // React writes its value into the element as raw markup. The props panel
    // accepts the name and a JSON value or an expression for it.
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("json", "expression", "string", "box", "title", "link"),
        }),
        instance({ id: "json", component: "ws:element", tag: "div" }),
        instance({ id: "expression", component: "ws:element", tag: "div" }),
        instance({ id: "string", component: "ws:element", tag: "div" }),
        instance({ id: "box", component: "Box" }),
        instance({ id: "title", component: DialogTitle }),
        instance({ id: "link", component: "Link" }),
      ],
      props: [
        jsonProp("json", "dangerouslySetInnerHTML", {
          __html: "<img src=x onerror=alert(1)>",
        }),
        stringProp("json", "id", "json"),
        expressionProp(
          "expression",
          "dangerouslySetInnerHTML",
          '{__html: "<img src=x onerror=alert(2)>"}'
        ),
        stringProp("string", "dangerouslySetInnerHTML", "<script>3</script>"),
        jsonProp("box", "dangerouslySetInnerHTML", { __html: "<b>4</b>" }),
        jsonProp("title", "dangerouslySetInnerHTML", { __html: "<b>5</b>" }),
        resourceProp("link", "dangerouslySetInnerHTML", "resource-1"),
        // other names stay, however much they look alike
        jsonProp("link", "dangerouslysetinnerhtml", { __html: "x" }),
        stringProp("link", "innerHTML", "x"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual([
      "root",
      "json",
      "expression",
      "string",
      "box",
      "title",
      "link",
    ]);
    expect(propIds(result)).toEqual([
      "json:id",
      "link:dangerouslysetinnerhtml",
      "link:innerHTML",
    ]);
  });

  test("does not count the dangerouslySetInnerHTML prop of an instance that is dropped anyway", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("embed", "script", "kept"),
        }),
        instance({ id: "embed", component: "HtmlEmbed" }),
        instance({ id: "script", component: "ws:element", tag: "script" }),
        instance({ id: "kept", component: "ws:element", tag: "div" }),
      ],
      props: [
        jsonProp("embed", "dangerouslySetInnerHTML", { __html: "1" }),
        jsonProp("script", "dangerouslySetInnerHTML", { __html: "2" }),
        jsonProp("kept", "dangerouslySetInnerHTML", { __html: "3" }),
      ],
    });
    const log = vi.fn();

    const result = dropOrgScript(bundle, { log });

    expect(propIds(result)).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 HTML Embed, 1 element with a tag the builder does not offer and 1 raw HTML property."
    );
  });

  test("leaves other components alone, whatever their tag", () => {
    // other components forward the tag as an attribute and are not touched
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("link", "image"),
        }),
        instance({ id: "link", component: "Link", tag: "script" }),
        instance({ id: "image", component: "Image" }),
      ],
      props: [
        stringProp("image", "tag", "script"),
        stringProp("image", "data-ws-tag", "script"),
      ],
    });

    expect(instanceIds(dropOrgScript(bundle))).toEqual([
      "root",
      "link",
      "image",
    ]);
  });

  test("drops a Markdown Embed with a javascript: link, whatever its code, with its subtree", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("markdown", "kept"),
        }),
        instance({
          id: "markdown",
          component: "MarkdownEmbed",
          children: ids("link"),
        }),
        instance({ id: "link", component: "ws:descendant" }),
        instance({ id: "kept", component: "Box" }),
      ],
      props: [
        stringProp("markdown", "code", "[x](javascript:void0)"),
        stringProp("link", "selector", " a"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(["root", "kept"]);
    expect(childrenOf(result, "root")).toEqual(ids("kept"));
    expect(propIds(result)).toEqual([]);
  });

  test("drops the SVG animate and set elements, and keeps the svg, the link and animateTransform", () => {
    const bundle = createBundle({
      instances: [
        instance({ id: "root", component: "Body", children: ids("svg") }),
        instance({
          id: "svg",
          component: "ws:element",
          tag: "svg",
          children: ids("link"),
        }),
        instance({
          id: "link",
          component: "ws:element",
          tag: "a",
          children: ids("animate", "set", "transform", "motion", "legacy"),
        }),
        instance({
          id: "animate",
          component: "ws:element",
          tag: "animate",
          children: ids("nested"),
        }),
        instance({ id: "nested", component: "ws:element", tag: "title" }),
        instance({ id: "set", component: "ws:element", tag: "set" }),
        instance({
          id: "transform",
          component: "ws:element",
          tag: "animateTransform",
        }),
        instance({
          id: "motion",
          component: "ws:element",
          tag: "animateMotion",
        }),
        instance({ id: "legacy", component: "Box" }),
      ],
      props: [
        stringProp("animate", "attributeName", "href"),
        stringProp("animate", "values", "javascript:void0"),
        stringProp("set", "to", "javascript:void0"),
        stringProp("legacy", "tag", "set"),
        stringProp("transform", "type", "rotate"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual([
      "root",
      "svg",
      "link",
      "transform",
      "motion",
    ]);
    expect(childrenOf(result, "link")).toEqual(ids("transform", "motion"));
    expect(propIds(result)).toEqual(["transform:type"]);
  });

  test("clears the custom code, and keeps the rest of the project's settings", () => {
    const bundle = createBundle({
      code: '<script src="/custom.js"></script>',
      instances: [instance({ id: "root", component: "Body" })],
    });

    const result = dropOrgScript(bundle);

    expect(result.build.pages.meta?.code).toBeUndefined();
    expect(result.build.pages.meta?.siteName).toBe("Site");
    expect(result.build.pages.homePageId).toBe("home");
    expect(result.build.pages.pages).toEqual(bundle.build.pages.pages);
  });

  test("neutralizes a page root that is an embed, so the page still builds", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "HtmlEmbed",
          children: ids("child"),
        }),
        instance({ id: "child", component: "Box" }),
        instance({
          id: "about-root",
          component: "ws:element",
          tag: "script",
        }),
      ],
      props: [
        stringProp("root", "code", "<script>1</script>"),
        stringProp("about-root", "src", "https://evil.example/x.js"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(result.build.instances).toEqual([
      [
        "root",
        { type: "instance", id: "root", component: "Body", children: [] },
      ],
      [
        "about-root",
        { type: "instance", id: "about-root", component: "Body", children: [] },
      ],
    ]);
    expect(propIds(result)).toEqual([]);
  });

  test("returns a deep-equal bundle when the switch is on", () => {
    const bundle = createBundle({
      code: "<script>1</script>",
      instances: [
        instance({ id: "root", component: "Body", children: ids("embed") }),
        instance({ id: "embed", component: "HtmlEmbed" }),
      ],
      props: [stringProp("embed", "code", "<script>1</script>")],
    });
    const before = structuredClone(bundle);

    const result = dropOrgScript(bundle, { mayRun: true });

    expect(result).toEqual(before);
    expect(bundle).toEqual(before);
  });

  test("never changes its input", () => {
    const bundle = createBundle({
      code: "<script>1</script>",
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("embed", "script", "kept"),
        }),
        instance({ id: "embed", component: "HtmlEmbed", children: ids("d") }),
        instance({ id: "d", component: "ws:descendant" }),
        instance({ id: "script", component: "ws:element", tag: "script" }),
        instance({ id: "kept", component: "Box" }),
      ],
      props: [
        stringProp("embed", "code", "<script>1</script>"),
        stringProp("script", "src", "https://evil.example/x.js"),
      ],
      dataSources: [
        [
          "scoped",
          {
            type: "variable",
            id: "scoped",
            scopeInstanceId: "embed",
            name: "x",
            value: { type: "string", value: "x" },
          },
        ],
      ],
    });
    const before = structuredClone(bundle);

    const result = dropOrgScript(bundle);

    expect(result).not.toBe(bundle);
    expect(bundle).toEqual(before);
    expect(instanceIds(result)).toEqual(["root", "kept"]);
  });

  test("leaves a build with no org script as it is", () => {
    const bundle = createBundle({
      instances: [
        instance({ id: "root", component: "Body", children: ids("box") }),
        instance({ id: "box", component: "Box" }),
      ],
      props: [stringProp("box", "id", "box")],
    });
    const log = vi.fn();

    expect(dropOrgScript(bundle, { log })).toEqual(bundle);
    expect(log).not.toHaveBeenCalled();
  });

  test("logs one line for support", () => {
    const bundle = createBundle({
      code: "<script>1</script>",
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("a", "b", "markdown", "script", "animate", "raw"),
        }),
        instance({ id: "a", component: "HtmlEmbed" }),
        instance({ id: "b", component: "HtmlEmbed" }),
        instance({ id: "markdown", component: "MarkdownEmbed" }),
        instance({ id: "script", component: "ws:element", tag: "script" }),
        instance({ id: "animate", component: "ws:element", tag: "animate" }),
        instance({ id: "raw", component: "ws:element", tag: "div" }),
      ],
      props: [
        stringProp("a", "code", "<script>1</script>"),
        jsonProp("raw", "dangerouslySetInnerHTML", { __html: "<b>1</b>" }),
      ],
    });
    const log = vi.fn();

    dropOrgScript(bundle, { log });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 2 HTML Embeds, 1 Markdown Embed, 1 element with a tag the builder does not offer, 1 animate or set element, 1 raw HTML property and the site's custom code."
    );
  });
});

describe("describeDroppedOrgScript", () => {
  const none = {
    htmlEmbeds: 0,
    markdownEmbeds: 0,
    elementsWithUnknownTag: 0,
    svgAnimations: 0,
    rawHtmlProps: 0,
    customCode: false,
  };

  test("says nothing when nothing was left out", () => {
    expect(describeDroppedOrgScript(none)).toBeUndefined();
  });

  test("names only what was left out", () => {
    expect(describeDroppedOrgScript({ ...none, htmlEmbeds: 1 })).toBe(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 HTML Embed."
    );
    expect(describeDroppedOrgScript({ ...none, rawHtmlProps: 2 })).toBe(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 2 raw HTML properties."
    );
    expect(describeDroppedOrgScript({ ...none, customCode: true })).toBe(
      "Org script is paused until OrganizeOS sites move to their own domain: left out the site's custom code."
    );
    expect(
      describeDroppedOrgScript({
        ...none,
        htmlEmbeds: 3,
        elementsWithUnknownTag: 2,
      })
    ).toBe(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 3 HTML Embeds and 2 elements with a tag the builder does not offer."
    );
  });
});

// T15. The switch pauses what the fork knows renders org-written markup:
// HTML Embed and Markdown Embed. An upstream merge that adds another
// component writing raw HTML into a page fails here, and gets a decision.
describe("raw HTML in the runtime packages", () => {
  const root = fileURLToPath(new URL("../../..", import.meta.url));

  // The list scripts/check-runtime-upstream.sh holds, so the two cannot drift
  const packages = (() => {
    const script = readFileSync(
      join(root, "scripts/check-runtime-upstream.sh"),
      "utf8"
    );
    const block = script.match(/^packages=\(([\s\S]*?)^\)/m)?.[1] ?? "";
    return block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && line.startsWith("#") === false);
  })();

  const sourceFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "node_modules" || entry.name === "lib"
          ? []
          : sourceFiles(path);
      }
      return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) &&
        /\.(?:test|stories)\./.test(entry.name) === false
        ? [path]
        : [];
    });

  test("reads the eight packages from the check", () => {
    expect(packages).toEqual([
      "packages/sdk",
      "packages/react-sdk",
      "packages/sdk-components-react",
      "packages/sdk-components-react-radix",
      "packages/sdk-components-react-router",
      "packages/sdk-components-react-remix",
      "packages/image",
      "packages/wsauth",
    ]);
  });

  test("only HTML Embed and Markdown Embed use dangerouslySetInnerHTML", () => {
    const users = packages
      .flatMap((name) => sourceFiles(join(root, name)))
      .filter((file) =>
        readFileSync(file, "utf8").includes("dangerouslySetInnerHTML")
      )
      .map((file) => relative(root, file))
      .sort();

    expect(users).toEqual([
      "packages/sdk-components-react/src/html-embed.tsx",
      "packages/sdk-components-react/src/markdown-embed.tsx",
    ]);
  });

  // The generator renames a standard attribute to its React prop (`tabindex` to
  // `tabIndex`), so a paused prop must not be reachable under another name
  test("no standard attribute is renamed to a paused prop", () => {
    const renamed = new Set(Object.values(standardAttributesToReactProps));
    for (const name of pausedPropNames) {
      expect(renamed.has(name)).toBe(false);
      expect(
        standardAttributesToReactProps[name.toLowerCase()]
      ).toBeUndefined();
    }
  });

  // The components that choose their element from a prop are named in
  // tagPropsByComponent, and publishing checks that prop. A merge that adds
  // another one fails here, and gets a decision.
  test("only Box, Text, Heading, Dialog Title and XML Node have a tag prop", () => {
    const users = packages
      .flatMap((name) => sourceFiles(join(root, name)))
      .filter(
        (file) =>
          file.endsWith(".props.ts") &&
          /^ {2}tag: \{/m.test(readFileSync(file, "utf8"))
      )
      .map((file) => relative(root, file))
      .sort();

    expect(users).toEqual([
      "packages/sdk-components-react-radix/src/__generated__/dialog.props.ts",
      "packages/sdk-components-react/src/__generated__/box.props.ts",
      "packages/sdk-components-react/src/__generated__/heading.props.ts",
      "packages/sdk-components-react/src/__generated__/text.props.ts",
      // XML Node (category xml) takes any tag by design
      "packages/sdk-components-react/src/__generated__/xml-node.props.ts",
    ]);
    expect([...tagPropsByComponent.keys()].sort()).toEqual([
      "@webstudio-is/sdk-components-react-radix:DialogTitle",
      "Box",
      "Heading",
      "Text",
    ]);
  });
});
