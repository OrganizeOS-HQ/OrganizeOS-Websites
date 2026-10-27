import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";
import {
  bundleVersion,
  publishedProjectBundle,
  type PublishedProjectBundle,
} from "@webstudio-is/protocol";
import {
  coreMetas,
  type Instance,
  type Page,
  type Prop,
  type WsComponentMeta,
} from "@webstudio-is/sdk";
import { standardAttributesToReactProps } from "@webstudio-is/react-sdk";
import * as baseComponentMetas from "@webstudio-is/sdk-components-react/metas";
import * as radixComponentMetas from "@webstudio-is/sdk-components-react-radix/metas";
import * as organizeosComponentMetas from "@organizeos/site-components/metas";
import {
  isEventAttributeName,
  isFrameDocumentName,
  isUrlPropName,
  recordDataComponents,
  xmlComponents,
} from "@organizeos/site-components/org-script";
import { dropOrgScript } from "./organizeos-org-script";
import { ORGANIZEOS_NAMESPACE } from "./organizeos-components";

// Publishing leaves unsafe values out while org script is paused: addresses
// that can run script, srcdoc, event handler attributes, XML elements on HTML
// pages and redirects to an unsafe address (docs/ORGANIZEOS-FORK.md section
// 10, propMayShip in @organizeos/site-components/org-script).

type InstanceInit = Partial<Instance> & Pick<Instance, "id" | "component">;

const instance = (init: InstanceInit): [string, Instance] => [
  init.id,
  { type: "instance", children: [], ...init },
];

const ids = (...list: string[]): Instance["children"] =>
  list.map((value) => ({ type: "id", value }));

const prop = (
  instanceId: string,
  name: string,
  type: Prop["type"],
  value: unknown
): [string, Prop] => {
  const id = `${instanceId}:${name}`;
  return [id, { id, instanceId, name, type, value } as Prop];
};

const string = (instanceId: string, name: string, value: string) =>
  prop(instanceId, name, "string", value);

const bound = (instanceId: string, name: string, value: string) =>
  prop(instanceId, name, "expression", value);

type PageInit = Pick<Page, "id" | "path" | "rootInstanceId"> & {
  meta?: Page["meta"];
};

const homeAndAbout: PageInit[] = [
  { id: "home", path: "", rootInstanceId: "root" },
  { id: "about", path: "/about", rootInstanceId: "about-root" },
];

const createBundle = ({
  pages = homeAndAbout,
  instances = [],
  props = [],
  dataSources = [],
  redirects,
}: {
  pages?: PageInit[];
  instances?: Array<[string, Instance]>;
  props?: Array<[string, Prop]>;
  dataSources?: PublishedProjectBundle["build"]["dataSources"];
  redirects?: Array<{ old: string; new: string; status?: "301" | "302" }>;
} = {}): PublishedProjectBundle => {
  const list = pages.map(({ meta = {}, ...page }) => ({
    ...page,
    name: page.id,
    title: `"${page.id}"`,
    meta,
  }));
  return publishedProjectBundle.parse({
    bundleVersion,
    origin: "https://assets.example",
    projectDomain: "example.com",
    projectTitle: "Example",
    page: list[0],
    pages: list,
    assets: [],
    build: {
      id: "build-id",
      projectId: "project-id",
      version: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      pages: {
        meta: { siteName: "Site" },
        ...(redirects === undefined ? {} : { redirects }),
        homePageId: list[0].id,
        rootFolderId: "root-folder",
        pages: list,
        folders: [
          {
            id: "root-folder",
            name: "Root",
            slug: "",
            children: list.map((page) => page.id),
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

/**
 * The same bundle in the legacy pages shape, which keeps the home page in
 * `homePage` beside the other pages (packages/project-migrations pages.ts).
 * The bundle schema reads the current shape only, so this one is built by
 * hand.
 */
const toLegacyShape = (
  bundle: PublishedProjectBundle
): PublishedProjectBundle => {
  const {
    homePageId,
    rootFolderId: _rootFolderId,
    ...pages
  } = bundle.build.pages;
  return {
    ...bundle,
    build: {
      ...bundle.build,
      pages: {
        ...pages,
        homePage: pages.pages.find((page) => page.id === homePageId),
        pages: pages.pages.filter((page) => page.id !== homePageId),
      } as unknown as PublishedProjectBundle["build"]["pages"],
    },
  };
};

const instanceIds = (bundle: PublishedProjectBundle) =>
  bundle.build.instances.map(([id]) => id);

const childrenOf = (bundle: PublishedProjectBundle, id: string) =>
  new Map(bundle.build.instances).get(id)?.children;

const propIds = (bundle: PublishedProjectBundle) =>
  bundle.build.props.map(([id]) => id);

const pageMeta = (bundle: PublishedProjectBundle, id: string) =>
  bundle.build.pages.pages.find((page) => page.id === id)?.meta;

const logOf = (bundle: PublishedProjectBundle) => {
  const log = vi.fn();
  const result = dropOrgScript(bundle, { log });
  return { result, log };
};

const linkOnHome = (props: Array<[string, Prop]>) =>
  createBundle({
    instances: [
      instance({ id: "root", component: "Body", children: ids("link") }),
      instance({ id: "link", component: "Link" }),
    ],
    props,
  });

describe("dropOrgScript leaves unsafe values out", () => {
  test("drops unsafe static addresses and keeps the instance and its other props", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("link", "a", "frame", "form", "button", "svg", "img"),
        }),
        instance({ id: "link", component: "Link" }),
        instance({ id: "a", component: "ws:element", tag: "a" }),
        instance({ id: "frame", component: "ws:element", tag: "iframe" }),
        instance({ id: "form", component: "ws:element", tag: "form" }),
        instance({ id: "button", component: "ws:element", tag: "button" }),
        instance({ id: "svg", component: "ws:element", tag: "a" }),
        instance({ id: "img", component: "Image" }),
      ],
      props: [
        string("link", "href", "javascript:alert(1)"),
        string("link", "id", "link"),
        string("a", "HREF", " \tJaVaScRiPt:alert(1)"),
        string("a", "title", "javascript:alert(1)"),
        string("frame", "src", "data:text/html,<script>alert(1)</script>"),
        string("form", "action", "vbscript:alert(1)"),
        string("button", "formaction", "javascript:alert(1)"),
        string("svg", "xlink:href", "javascript:alert(1)"),
        string("img", "src", "data:image/png;base64,AAAA"),
        // kept
        string("img", "alt", "Image"),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual(instanceIds(bundle));
    expect(propIds(result)).toEqual(["link:id", "a:title", "img:alt"]);
  });

  test("refuses a string[] and a json href and data on an object that join into a javascript: address, and keeps a json data on a Collection", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("object", "list", "collection"),
        }),
        instance({ id: "object", component: "ws:element", tag: "object" }),
        instance({ id: "list", component: "ws:element", tag: "a" }),
        instance({ id: "collection", component: "ws:collection" }),
      ],
      props: [
        prop("object", "data", "json", ["javascript:alert(1)"]),
        prop("object", "href", "json", [["javascript:alert(1)"]]),
        prop("list", "href", "string[]", ["javascript:alert(1)"]),
        prop("collection", "data", "json", ["javascript:alert(1)"]),
        // an object is written [object Object]
        prop("list", "data", "json", { a: 1 }),
      ],
    });

    expect(propIds(dropOrgScript(bundle))).toEqual([
      "collection:data",
      "list:data",
    ]);
  });

  test("drops a bound address that decides nothing, and keeps one whose fixed start decides", () => {
    const bundle = linkOnHome([]);
    const withHref = (value: string, type: Prop["type"] = "expression") =>
      createBundle({
        instances: bundle.build.instances,
        props: [prop("link", "href", type, value)],
      });
    for (const value of [
      "$ws$dataSource$event.url",
      '"" + $ws$dataSource$event.url',
      '"java" + $ws$dataSource$event.url',
      '"javascript:" + $ws$dataSource$event.slug',
      '$ws$dataSource$a || "/a"',
    ]) {
      expect(propIds(dropOrgScript(withHref(value))), value).toEqual([]);
    }
    expect(propIds(dropOrgScript(withHref("parameter", "parameter")))).toEqual(
      []
    );
    for (const value of [
      '"/events/" + $ws$dataSource$event.slug',
      "`https://${$ws$dataSource$event.host}/a`",
      '"mailto:" + $ws$dataSource$event.email',
      '$ws$dataSource$a ? "/a" : "#b"',
    ]) {
      const kept = withHref(value);
      expect(dropOrgScript(kept), value).toBe(kept);
    }
  });

  test("keeps an Image's bound src, a video's bound src and a Collection's bound data", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("image", "video", "collection", "head"),
        }),
        instance({ id: "image", component: "Image" }),
        instance({ id: "video", component: "ws:element", tag: "video" }),
        instance({ id: "collection", component: "ws:collection" }),
        instance({ id: "head", component: "HeadLink" }),
      ],
      props: [
        bound("image", "src", "$ws$dataSource$event.cover_image_url"),
        bound("video", "src", "$ws$dataSource$media.data.url"),
        bound("collection", "data", "$ws$dataSource$events.data"),
        prop("collection", "item", "parameter", "event"),
        bound("head", "href", "$ws$dataSource$system.origin"),
      ],
    });

    expect(dropOrgScript(bundle)).toBe(bundle);
  });

  test("drops srcdoc and every on… prop that is not an action, and keeps an action", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("frame", "custom"),
        }),
        instance({ id: "frame", component: "ws:element", tag: "iframe" }),
        instance({ id: "custom", component: "ws:element", tag: "div" }),
      ],
      props: [
        string("frame", "srcdoc", "<script>alert(1)</script>"),
        bound("frame", "srcDoc", "$ws$dataSource$html"),
        string("custom", "onclick", "alert(1)"),
        bound("custom", "onMouseOver", '"alert(1)"'),
        prop("custom", "onClick", "action", [
          { type: "execute", args: [], code: "" },
        ]),
        string("custom", "is", "x-y"),
      ],
    });

    expect(propIds(dropOrgScript(bundle))).toEqual([
      "custom:onClick",
      "custom:is",
    ]);
  });

  test("drops an XML Node from an HTML page with its subtree and its scoped data, and keeps it on an XML page", () => {
    const bundle = createBundle({
      pages: [
        { id: "home", path: "", rootInstanceId: "root" },
        {
          id: "sitemap",
          path: "/sitemap.xml",
          rootInstanceId: "xml-root",
          meta: { documentType: "xml" },
        },
      ],
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("before", "node", "time"),
        }),
        instance({ id: "before", component: "Box" }),
        instance({ id: "node", component: "XmlNode", children: ids("inner") }),
        instance({ id: "inner", component: "XmlNode" }),
        instance({ id: "time", component: "XmlTime" }),
        instance({ id: "xml-root", component: "Body", children: ids("url") }),
        instance({ id: "url", component: "XmlNode" }),
      ],
      props: [
        string("node", "tag", "x"),
        string("node", "onmouseover", "alert(1)"),
        string("inner", "tag", "y"),
        string("url", "tag", "url"),
        string("url", "href", "https://example.org"),
        string("url", "onmouseover", "alert(1)"),
      ],
      dataSources: [
        [
          "scoped",
          {
            type: "variable",
            id: "scoped",
            scopeInstanceId: "node",
            name: "scoped",
            value: { type: "string", value: "x" },
          },
        ],
      ],
    });
    const { result, log } = logOf(bundle);

    // each XML element the page publishes is counted, the inner one too
    expect(instanceIds(result)).toEqual(["root", "before", "xml-root", "url"]);
    expect(childrenOf(result, "root")).toEqual(ids("before"));
    // on the XML page, every prop ships: the page answers sandboxed
    expect(propIds(result)).toEqual(["url:tag", "url:href", "url:onmouseover"]);
    expect(result.build.dataSources).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 3 XML elements on an HTML page."
    );
  });

  test("drops an XML Node that a Slot shows on an XML page and an HTML page", () => {
    const bundle = createBundle({
      pages: [
        { id: "home", path: "", rootInstanceId: "root" },
        {
          id: "feed",
          path: "/feed.xml",
          rootInstanceId: "xml-root",
          meta: { documentType: "xml" },
        },
      ],
      instances: [
        instance({ id: "root", component: "Body", children: ids("slot") }),
        instance({ id: "xml-root", component: "Body", children: ids("slot") }),
        instance({ id: "slot", component: "Slot", children: ids("fragment") }),
        instance({
          id: "fragment",
          component: "Fragment",
          children: ids("node"),
        }),
        instance({ id: "node", component: "XmlNode" }),
      ],
    });

    const result = dropOrgScript(bundle);

    expect(instanceIds(result)).toEqual([
      "root",
      "xml-root",
      "slot",
      "fragment",
    ]);
    expect(childrenOf(result, "fragment")).toEqual([]);
  });

  describe.each([
    ["the current", (bundle: PublishedProjectBundle) => bundle],
    ["the legacy", toLegacyShape],
  ])("in %s bundle shape", (_shape, shape) => {
    const homeOf = (bundle: PublishedProjectBundle) => {
      const pages = bundle.build
        .pages as PublishedProjectBundle["build"]["pages"] & {
        homePage?: Page;
      };
      return pages.homePage ?? pages.pages.find((page) => page.id === "home");
    };

    test("drops a page redirect to an unsafe target with its 3xx status, on the home page, and keeps a 404 status", () => {
      const bundle = shape(
        createBundle({
          pages: [
            {
              id: "home",
              path: "",
              rootInstanceId: "root",
              meta: { redirect: '"javascript:alert(1)"', status: "302" },
            },
            {
              id: "missing",
              path: "/missing",
              rootInstanceId: "root",
              meta: { redirect: '"data:text/html,x"', status: "404" },
            },
            {
              id: "bound",
              path: "/bound",
              rootInstanceId: "root",
              meta: { redirect: "$ws$dataSource$a.url", status: '"301"' },
            },
            {
              id: "safe",
              path: "/safe",
              rootInstanceId: "root",
              meta: { redirect: '"/about"', status: "301" },
            },
          ],
          instances: [instance({ id: "root", component: "Body" })],
        })
      );
      const { result, log } = logOf(bundle);

      expect(homeOf(result)?.meta).toEqual({});
      expect(pageMeta(result, "missing")).toEqual({ status: "404" });
      expect(pageMeta(result, "bound")).toEqual({});
      expect(pageMeta(result, "safe")).toEqual({
        redirect: '"/about"',
        status: "301",
      });
      expect(log).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 3 redirects to an unsafe address."
      );
    });

    test("finds the home root: drops an XML Node under the home root, and empties a home root that would be dropped", () => {
      const bundle = shape(
        createBundle({
          instances: [
            instance({ id: "root", component: "Body", children: ids("node") }),
            instance({ id: "node", component: "XmlNode" }),
            instance({ id: "about-root", component: "XmlNode" }),
          ],
        })
      );

      const result = dropOrgScript(bundle);

      expect(instanceIds(result)).toEqual(["root", "about-root"]);
      expect(childrenOf(result, "root")).toEqual([]);
      expect(new Map(result.build.instances).get("about-root")).toEqual({
        type: "instance",
        id: "about-root",
        component: "Body",
        children: [],
      });

      // and the home page's root alone, as the legacy shape keeps it
      const homeRoot = shape(
        createBundle({
          pages: [{ id: "home", path: "", rootInstanceId: "root" }],
          instances: [instance({ id: "root", component: "XmlTime" })],
        })
      );
      expect(
        new Map(dropOrgScript(homeRoot).build.instances).get("root")
      ).toEqual({
        type: "instance",
        id: "root",
        component: "Body",
        children: [],
      });
    });
  });

  test("drops a project redirect to an unsafe target and keeps the others in order", () => {
    const bundle = createBundle({
      instances: [instance({ id: "root", component: "Body" })],
      redirects: [
        { old: "/a", new: "/about" },
        { old: "/go", new: "javascript:alert(1)" },
        { old: "/b", new: "https://example.org", status: "302" },
        { old: "/data", new: " DATA:text/html,x" },
        { old: "/c", new: "mailto:a@example.org" },
      ],
    });
    const { result, log } = logOf(bundle);

    expect(result.build.pages.redirects).toEqual([
      { old: "/a", new: "/about" },
      { old: "/b", new: "https://example.org", status: "302" },
      { old: "/c", new: "mailto:a@example.org" },
    ]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 2 redirects to an unsafe address."
    );
  });

  test("counts nothing that sits only in a Content Block's templates, nor the props of an instance dropped anyway", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("block", "embed"),
        }),
        instance({
          id: "block",
          component: "ws:block",
          children: ids("templates"),
        }),
        instance({
          id: "templates",
          component: "ws:block-template",
          children: ids("template-link", "template-node"),
        }),
        instance({ id: "template-link", component: "Link" }),
        instance({ id: "template-node", component: "XmlNode" }),
        instance({ id: "embed", component: "HtmlEmbed" }),
      ],
      props: [
        string("template-link", "href", "javascript:alert(1)"),
        string("template-link", "onclick", "alert(1)"),
        string("embed", "code", "<b>1</b>"),
        string("embed", "href", "javascript:alert(1)"),
        string("embed", "srcdoc", "<script>alert(1)</script>"),
      ],
    });
    const { result, log } = logOf(bundle);

    // the template's link ships nothing, and loses its unsafe props all the same
    expect(propIds(result)).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 HTML Embed."
    );
  });

  test("logs one line that names each kind left out", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("link", "frame", "custom", "node"),
        }),
        instance({ id: "link", component: "Link" }),
        instance({ id: "frame", component: "ws:element", tag: "iframe" }),
        instance({ id: "custom", component: "ws:element", tag: "div" }),
        instance({ id: "node", component: "XmlNode" }),
      ],
      props: [
        string("link", "href", "javascript:alert(1)"),
        string("frame", "src", "data:text/html,x"),
        string("frame", "srcdoc", "<script>alert(1)</script>"),
        string("custom", "onclick", "alert(1)"),
      ],
      redirects: [{ old: "/go", new: "javascript:alert(1)" }],
    });
    const { log } = logOf(bundle);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 XML element on an HTML page, 2 unsafe addresses, 1 srcdoc attribute, 1 event handler attribute and 1 redirect to an unsafe address."
    );
  });

  test("returns the same bundle when the switch is on, and never changes its input", () => {
    const bundle = createBundle({
      pages: [
        {
          id: "home",
          path: "",
          rootInstanceId: "root",
          meta: { redirect: '"javascript:alert(1)"', status: "302" },
        },
      ],
      instances: [
        instance({ id: "root", component: "Body", children: ids("link") }),
        instance({ id: "link", component: "Link" }),
        instance({ id: "node", component: "XmlNode" }),
      ],
      props: [
        string("link", "href", "javascript:alert(1)"),
        string("link", "srcdoc", "<p>"),
      ],
      redirects: [{ old: "/go", new: "javascript:alert(1)" }],
    });
    const copy = structuredClone(bundle);

    expect(dropOrgScript(bundle, { mayRun: true })).toBe(bundle);
    const result = dropOrgScript(bundle);
    expect(result).not.toBe(bundle);
    expect(bundle).toEqual(copy);
  });

  // Upstream's feature project: its bound addresses are a Collection's data,
  // the sitemap XML page's href and an audio and a video src, and its XML
  // Nodes sit on the XML page. None of it is left out for being unsafe.
  test("leaves upstream's feature fixture alone", () => {
    const bundle = publishedProjectBundle.parse(
      JSON.parse(
        readFileSync(
          fileURLToPath(
            new URL(
              "../../../fixtures/webstudio-features/.webstudio/data.json",
              import.meta.url
            )
          ),
          "utf8"
        )
      )
    );
    const { result, log } = logOf(bundle);

    // what it does leave out is the org's own script, embeds and custom code
    expect(log).toHaveBeenCalledTimes(1);
    const [[message]] = log.mock.calls;
    for (const kind of [
      "XML element",
      "unsafe address",
      "srcdoc",
      "event handler",
      "redirect",
    ]) {
      expect(message).not.toContain(kind);
    }
    // every prop of an instance that stays is kept
    const kept = new Set(instanceIds(result));
    expect(propIds(result)).toEqual(
      bundle.build.props
        .filter(([, prop]) => kept.has(prop.instanceId))
        .map(([id]) => id)
    );
    expect(
      result.build.instances.filter(([, instance]) =>
        xmlComponents.has(instance.component)
      )
    ).toHaveLength(
      bundle.build.instances.filter(([, instance]) =>
        xmlComponents.has(instance.component)
      ).length
    );
    expect(result.build.pages.pages).toEqual(bundle.build.pages.pages);
    expect(result.build.pages.redirects).toEqual(bundle.build.pages.redirects);
  });
});

// The metas the CLI registers (framework-react-router.ts and prebuild's core
// metas). An upstream merge or a new OrganizeOS block that changes what they
// declare fails here, and gets a decision.
describe("what the registered components declare", () => {
  const metas = new Map<string, WsComponentMeta>(Object.entries(coreMetas));
  for (const [name, meta] of Object.entries(baseComponentMetas)) {
    metas.set(name, meta);
  }
  for (const [name, meta] of Object.entries(radixComponentMetas)) {
    metas.set(`@webstudio-is/sdk-components-react-radix:${name}`, meta);
  }
  for (const [name, meta] of Object.entries(organizeosComponentMetas)) {
    metas.set(`${ORGANIZEOS_NAMESPACE}:${name}`, meta);
  }

  const declaring = (test: (name: string, type: string) => boolean) =>
    [...metas]
      .filter(([, meta]) =>
        Object.entries(meta.props ?? {}).some(([name, prop]) =>
          test(name, prop.type)
        )
      )
      .map(([component]) => component)
      .sort();

  // XML Node and XML Time leave HTML pages and keep every prop on an XML
  // page, which answers sandboxed. A new component of category xml joins
  // xmlComponents.
  test("the components of category xml are exactly xmlComponents", () => {
    expect(
      [...metas]
        .filter(([, meta]) => meta.category === "xml")
        .map(([component]) => component)
        .sort()
    ).toEqual([...xmlComponents].sort());
  });

  // data is an address on an object. A new component with a data prop gets a
  // decision: one that holds records joins recordDataComponents, or publishing
  // holds its data to the rule.
  test("only Collection, Signup Form and RSVP Form declare a data prop", () => {
    expect(declaring((name) => name.toLowerCase() === "data")).toEqual(
      [...recordDataComponents].sort()
    );
  });

  // Publishing drops an on… prop that is not an action, so a component that
  // declares one gets a decision.
  test("no registered component declares a prop matching /^on./i whose type is not action", () => {
    expect(
      declaring((name, type) => /^on./i.test(name) && type !== "action")
    ).toEqual([]);
    // the one there is, an action
    expect(declaring((name) => /^on./i.test(name))).toContain(
      `${ORGANIZEOS_NAMESPACE}:RotationControl`
    );
  });

  // The generator and the canvas rename a standard attribute to its React prop
  // (formaction to formAction, srcdoc to srcDoc, xlink:href to xlinkHref), so
  // the rule must read both names alike.
  test("every renamed attribute that is an address, srcdoc or on… name is one the rule reads", () => {
    const reading = (name: string) => [
      isUrlPropName(name),
      isFrameDocumentName(name),
      isEventAttributeName(name),
    ];
    const renamed = Object.entries(standardAttributesToReactProps).filter(
      ([attribute, reactName]) =>
        [...reading(attribute), ...reading(reactName)].some(Boolean)
    );
    expect(renamed.map(([attribute]) => attribute).sort()).toEqual([
      "formaction",
      "srcdoc",
      "xlink:href",
    ]);
    for (const [attribute, reactName] of renamed) {
      expect(reading(reactName), attribute).toEqual(reading(attribute));
    }
  });
});
