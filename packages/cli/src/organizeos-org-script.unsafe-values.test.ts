import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";
import {
  bundleVersion,
  publishedProjectBundle,
  type PublishedProjectBundle,
} from "@webstudio-is/protocol";
import {
  coreMetas,
  ROOT_INSTANCE_ID,
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
  checkAction,
  isEventAttributeName,
  isFrameDocumentName,
  isUrlPropName,
  plainDataActionProps,
  recordDataComponents,
  xmlComponents,
} from "@organizeos/site-components/org-script";
import { migratePages } from "@webstudio-is/project-migrations/pages";
import { dropOrgScript, publishedComponents } from "./organizeos-org-script";
import { assertBuildCodeValid } from "./organizeos-code-check";
import { ORGANIZEOS_NAMESPACE } from "./organizeos-components";
import { createFramework as createReactRouterFramework } from "./framework-react-router";

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

const mailto = (instanceId: string) =>
  string(instanceId, "href", "mailto:a@example.org");

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
          {
            type: "execute",
            args: [],
            code: `$ws$dataSource$state = "clicked"`,
          },
        ]),
        string("custom", "is", "x-y"),
      ],
      dataSources: [
        [
          "state",
          {
            type: "variable",
            id: "state",
            scopeInstanceId: "root",
            name: "state",
            value: { type: "string", value: "idle" },
          },
        ],
      ],
    });

    expect(propIds(dropOrgScript(bundle))).toEqual([
      "custom:onClick",
      "custom:is",
    ]);
  });

  // The generator writes an action's args as an arrow function's parameters
  // and its code as the body, into a page module the site's server renders,
  // on any prop and any page (actionMayRun)
  test("drops an action that could run script or reach the page, on any prop of any instance, an XML page's included, and counts it as an unsafe action", () => {
    const crafted = [
      {
        type: "execute",
        args: [") => 0, globalThis.pwned = 1, (x"],
        code: "0",
      },
    ];
    const kept = [
      {
        type: "execute",
        args: ["state"],
        code: "$ws$dataSource$state = state",
      },
    ];
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
          children: ids(
            "box",
            "link",
            "form",
            "rotation",
            "form-2",
            "form-3",
            "form-4",
            "form-5",
            "form-6"
          ),
        }),
        instance({ id: "box", component: "Box" }),
        instance({ id: "link", component: "Link" }),
        instance({ id: "form", component: "Form" }),
        instance({ id: "form-2", component: "Form" }),
        instance({ id: "form-3", component: "Form" }),
        instance({ id: "form-4", component: "Form" }),
        instance({ id: "form-5", component: "Form" }),
        instance({ id: "form-6", component: "Form" }),
        instance({ id: "rotation", component: "Box" }),
        instance({ id: "xml-root", component: "Body", children: ids("url") }),
        instance({ id: "url", component: "XmlNode" }),
      ],
      props: [
        prop("box", "onClick", "action", crafted),
        prop("box", "value", "action", crafted),
        prop("link", "href", "action", crafted),
        prop("url", "onClick", "action", crafted),
        // a code that starts with a regular expression
        prop("form", "onSubmit", "action", [
          {
            type: "execute",
            args: [],
            code: "/1}, globalThis.pwned = 1, () => { // 1 + $ws$dataSource$state",
          },
        ]),
        // a code that starts with an object
        prop("box", "onMouseEnter", "action", [
          {
            type: "execute",
            args: [],
            code: '{} / "/}, globalThis.pwned = 1, () => { // "',
          },
        ]),
        // a code that reaches the page through the event
        prop("link", "onClick", "action", [
          {
            type: "execute",
            args: ["event"],
            code: "$ws$dataSource$state = event.target.value",
          },
        ]),
        // a parameter
        prop("rotation", "onValueChange", "action", [
          { type: "execute", args: [], code: '$ws$dataSource$param = "x"' },
        ]),
        // an event set to a variable, where a Box passes one
        prop("box", "onMouseLeave", "action", [
          {
            type: "execute",
            args: ["event"],
            code: "$ws$dataSource$state = event",
          },
        ]),
        // a variable the XML page holds
        prop("box", "onFocus", "action", [
          { type: "execute", args: [], code: "$ws$dataSource$elsewhere = 1" },
        ]),
        // a data source with an empty id
        prop("box", "onBlur", "action", [
          { type: "execute", args: [], code: "$ws$dataSource$ = 1" },
        ]),
        // a member, a call and a < followed later by a >, where the args
        // may be named, and a member with no args
        prop("form-2", "onStateChange", "action", [
          {
            type: "execute",
            args: ["state"],
            code: '$ws$dataSource$state = state.constructor.constructor("globalThis.pwned = 1")()',
          },
        ]),
        prop("form-3", "onStateChange", "action", [
          {
            type: "execute",
            args: ["a", "b", "c"],
            code: "$ws$dataSource$state = a < b > (c)",
          },
        ]),
        prop("box", "onKeyDown", "action", [
          {
            type: "execute",
            args: [],
            code: "$ws$dataSource$state = $ws$dataSource$state.length",
          },
        ]),
        // a regular expression after a `>`
        prop("box", "onKeyUp", "action", [
          {
            type: "execute",
            args: [],
            code: "1 < 2 > /(globalThis.pwned = 1)/g",
          },
        ]),
        // an arg named like a variable
        prop("box", "onDoubleClick", "action", [
          {
            type: "execute",
            args: ["event"],
            code: "$ws$dataSource$state = $ws$dataSource$e",
          },
        ]),
        // an assignment to a Resource
        prop("box", "onDrop", "action", [
          { type: "execute", args: [], code: "$ws$dataSource$res = 1" },
        ]),
        // a data source with no scope
        prop("box", "onDrag", "action", [
          {
            type: "execute",
            args: [],
            code: "$ws$dataSource$state = $ws$dataSource$unscoped",
          },
        ]),
        // a < followed later by a >, with no args and where the args may be
        // named
        prop("box", "onPointerDown", "action", [
          {
            type: "execute",
            args: [],
            code: '$ws$dataSource$state = "s" < 1 >\n ["constructor"] < 1 >\n ["constructor"]',
          },
        ]),
        prop("box", "onPointerUp", "action", [
          {
            type: "execute",
            args: [],
            code: '$ws$dataSource$state = 1 < 2 >\n{} / "/}, globalThis.pwned = 1, () => { // "',
          },
        ]),
        prop("form-4", "onStateChange", "action", [
          {
            type: "execute",
            args: ["state"],
            code: '$ws$dataSource$state = state < 1 >\n["constructor"]',
          },
        ]),
        // an object keyed __proto__
        prop("box", "onCopy", "action", [
          {
            type: "execute",
            args: [],
            code: "$ws$dataSource$state = { __proto__: null }",
          },
        ]),
        // an arg that is a reserved word, and one a variable it reads could
        // be named as
        prop("form-5", "onStateChange", "action", [
          { type: "execute", args: ["let"], code: "$ws$dataSource$state = 1" },
        ]),
        prop("form-6", "onStateChange", "action", [
          {
            type: "execute",
            args: ["formState"],
            code: "$ws$dataSource$state = $ws$dataSource$state || formState",
          },
        ]),
        prop("form", "onStateChange", "action", kept),
        string("url", "tag", "url"),
      ],
      dataSources: [
        [
          "state",
          {
            type: "variable",
            id: "state",
            scopeInstanceId: "root",
            name: "formState",
            value: { type: "string", value: "idle" },
          },
        ],
        [
          "param",
          {
            type: "parameter",
            id: "param",
            scopeInstanceId: "rotation",
            name: "name",
          },
        ],
        [
          "elsewhere",
          {
            type: "variable",
            id: "elsewhere",
            scopeInstanceId: "url",
            name: "elsewhere",
            value: { type: "string", value: "" },
          },
        ],
        [
          "",
          {
            type: "variable",
            id: "",
            scopeInstanceId: "root",
            name: "empty",
            value: { type: "string", value: "" },
          },
        ],
        // a variable named like an arg
        [
          "e",
          {
            type: "variable",
            id: "e",
            scopeInstanceId: "root",
            name: "event",
            value: { type: "string", value: "idle" },
          },
        ],
        [
          "res",
          {
            type: "resource",
            id: "res",
            scopeInstanceId: "root",
            name: "res",
            resourceId: "res-resource",
          },
        ],
        [
          "unscoped",
          {
            type: "variable",
            id: "unscoped",
            name: "unscoped",
            value: { type: "string", value: "" },
          },
        ],
      ],
    });
    const { result, log } = logOf(bundle);

    expect(propIds(result)).toEqual(["form:onStateChange", "url:tag"]);
    expect(JSON.stringify(result.build.props)).not.toContain("pwned");
    // the variable with an empty id, and the parameter, which no page
    // declares
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 24 unsafe actions and 2 variables with a conflicting id."
    );
  });

  // Publishing then checks what stays with input validation, which refuses
  // the build: an action that stays passes it
  test("drops an action that input validation refuses, counts it, and leaves a build that passes input validation", () => {
    const variable = "$ws$dataSource$v";
    const refused = [
      { args: [], code: `${variable} = NaN` },
      { args: [], code: `${variable} = Infinity` },
      { args: [], code: "$ws$dataSource$\\u0076 = 1" },
      { args: [], code: `${variable} = { constructor: 1 }` },
      { args: [], code: `${variable} = { "prototype": 1 }` },
      { args: [], code: `${variable} = { __defineGetter__: 1 }` },
    ];
    const refusedOnForm = [
      { args: ["state"], code: "state = 1" },
      { args: ["state"], code: "state += 1" },
      { args: ["state"], code: `${variable} = state = 1` },
    ];
    const buttons = refused.map((_, index) => `button-${index}`);
    const forms = refusedOnForm.map((_, index) => `form-${index}`);
    const signupForm = "@organizeos/site-components:SignupForm";
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids(...buttons, ...forms, "kept", "kept-form"),
        }),
        ...[...buttons, "kept"].map((id) => instance({ id, component: "Box" })),
        ...[...forms, "kept-form"].map((id) =>
          instance({ id, component: signupForm })
        ),
      ],
      props: [
        ...refused.map((entry, index) =>
          prop(buttons[index], "onClick", "action", [
            { type: "execute", ...entry },
          ])
        ),
        ...refusedOnForm.map((entry, index) =>
          prop(forms[index], "onStateChange", "action", [
            { type: "execute", ...entry },
          ])
        ),
        prop("kept", "onClick", "action", [
          { type: "execute", args: [], code: `${variable} = undefined` },
        ]),
        prop("kept-form", "onStateChange", "action", [
          { type: "execute", args: ["state"], code: `${variable} = state` },
        ]),
      ],
      dataSources: [
        [
          "v",
          {
            type: "variable",
            id: "v",
            scopeInstanceId: "root",
            name: "v",
            value: { type: "string", value: "" },
          },
        ],
      ],
    });
    for (const entry of [...refused, ...refusedOnForm]) {
      expect(checkAction([entry]).ok, entry.code).toBe(false);
    }

    const { result, log } = logOf(bundle);

    expect(propIds(result)).toEqual([
      "kept:onClick",
      "kept-form:onStateChange",
    ]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 9 unsafe actions."
    );
    expect(() =>
      assertBuildCodeValid(result.build, migratePages(result.build.pages))
    ).not.toThrow();
  });

  // An instance no page publishes can still hold one: what is inside an
  // instance that goes stays where another instance holds it
  test("drops an action that names a data source that goes with the instance it is scoped to, so what stays passes input validation", () => {
    const action = (code: string) => [{ type: "execute", args: [], code }];
    const bundle = createBundle({
      instances: [
        instance({ id: "root", component: "Body", children: ids("embed") }),
        instance({ id: "embed", component: "HtmlEmbed", children: ids("box") }),
        // no page publishes it
        instance({ id: "holder", component: "Box", children: ids("box") }),
        instance({ id: "box", component: "Box" }),
      ],
      props: [
        prop("box", "onClick", "action", action("$ws$dataSource$v = 1")),
        prop("holder", "onClick", "action", action("$ws$dataSource$g = 1")),
      ],
      dataSources: [
        [
          "v",
          {
            type: "variable",
            id: "v",
            scopeInstanceId: "embed",
            name: "v",
            value: { type: "string", value: "" },
          },
        ],
        [
          "g",
          {
            type: "variable",
            id: "g",
            scopeInstanceId: ROOT_INSTANCE_ID,
            name: "g",
            value: { type: "string", value: "" },
          },
        ],
      ],
    });
    expect(() =>
      assertBuildCodeValid(bundle.build, migratePages(bundle.build.pages))
    ).not.toThrow();

    const { result, log } = logOf(bundle);

    expect(instanceIds(result)).toEqual(["root", "holder", "box"]);
    expect(result.build.dataSources.map(([id]) => id)).toEqual(["g"]);
    expect(propIds(result)).toEqual(["holder:onClick"]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 HTML Embed."
    );
    expect(() =>
      assertBuildCodeValid(result.build, migratePages(result.build.pages))
    ).not.toThrow();
  });

  // As the Publish dialog lists them: an instance no page publishes, such as
  // one of a page template, ships nothing
  test("counts only the props of instances a page publishes", () => {
    const crafted = [
      {
        type: "execute",
        args: [") => 0, globalThis.pwned = 1, (x"],
        code: "0",
      },
    ];
    const bundle = createBundle({
      instances: [
        instance({ id: "root", component: "Body", children: ids("box") }),
        instance({ id: "box", component: "Box" }),
        instance({
          id: "template-root",
          component: "Body",
          children: ids("tabs"),
        }),
        instance({ id: "tabs", component: "Box" }),
      ],
      props: [
        prop("box", "onClick", "action", crafted),
        prop("tabs", "onClick", "action", crafted),
        string("tabs", "href", "javascript:alert(1)"),
      ],
    });
    const { result, log } = logOf(bundle);

    expect(propIds(result)).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unsafe action."
    );
  });

  test("counts only the instances a page publishes", () => {
    const bundle = createBundle({
      pages: [{ id: "home", path: "", rootInstanceId: "root" }],
      instances: [
        instance({ id: "root", component: "Body", children: ids("embed") }),
        instance({ id: "embed", component: "HtmlEmbed" }),
        // on no page
        instance({ id: "orphan", component: "x:unknown" }),
        instance({ id: "orphan-embed", component: "HtmlEmbed" }),
        // on a page template only
        instance({
          id: "template-root",
          component: "Body",
          children: ids("template-unknown", "template-embed"),
        }),
        instance({ id: "template-unknown", component: "x:unknown" }),
        instance({ id: "template-embed", component: "MarkdownEmbed" }),
      ],
    });
    const withTemplate: PublishedProjectBundle = {
      ...bundle,
      build: {
        ...bundle.build,
        pages: {
          ...bundle.build.pages,
          pageTemplates: [
            {
              id: "template",
              name: "Template",
              title: `"Template"`,
              rootInstanceId: "template-root",
              meta: {},
            },
          ],
        } as unknown as PublishedProjectBundle["build"]["pages"],
      },
    };
    const { result, log } = logOf(withTemplate);

    expect(instanceIds(result)).toEqual(["root", "template-root"]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 HTML Embed."
    );
  });

  // The builder's global root is not an instance it stores: a stored one is
  // left out and counted, and the global data sources stay with the page
  test("keeps the global data sources, and leaves out an instance stored with the global root's id", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("button", ROOT_INSTANCE_ID),
        }),
        instance({ id: "button", component: "Box" }),
        instance({ id: ROOT_INSTANCE_ID, component: "HtmlEmbed" }),
      ],
      props: [
        prop("button", "onClick", "action", [
          {
            type: "execute",
            args: [],
            code: "$ws$dataSource$local = $ws$dataSource$global",
          },
        ]),
        string(ROOT_INSTANCE_ID, "code", "<b>1</b>"),
      ],
      dataSources: [
        [
          "local",
          {
            type: "variable",
            id: "local",
            scopeInstanceId: "root",
            name: "local",
            value: { type: "string", value: "" },
          },
        ],
        [
          "global",
          {
            type: "variable",
            id: "global",
            scopeInstanceId: ROOT_INSTANCE_ID,
            name: "global",
            value: { type: "string", value: "" },
          },
        ],
      ],
    });
    const { result, log } = logOf(bundle);

    expect(instanceIds(result)).toEqual(["root", "button"]);
    expect(childrenOf(result, "root")).toEqual(ids("button"));
    expect(propIds(result)).toEqual(["button:onClick"]);
    expect(result.build.dataSources.map(([id]) => id)).toEqual([
      "local",
      "global",
    ]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 element with a reserved id."
    );
  });

  // A data source's id or name may not be one the page module uses for
  // anything else
  test("drops a data source whose id or name the page module uses for something else, and an action that names it, and counts the data source", () => {
    const variable = (
      id: string,
      { name = id, scopeInstanceId = "root" } = {}
    ): PublishedProjectBundle["build"]["dataSources"][number] => [
      id,
      {
        type: "variable",
        id,
        name,
        scopeInstanceId,
        value: { type: "string", value: "script" },
      },
    ];
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("box", "list", "form"),
        }),
        instance({ id: "box", component: "Box" }),
        instance({ id: "list", component: "ws:collection" }),
        instance({ id: "form", component: "Form" }),
        instance({ id: "orphan", component: "Box" }),
      ],
      props: [
        prop("box", "onClick", "action", [
          {
            type: "execute",
            args: [],
            code: "$ws$dataSource$ok = $ws$dataSource$Box",
          },
        ]),
        prop("box", "onDoubleClick", "action", [
          { type: "execute", args: [], code: "$ws$dataSource$ok = 1" },
        ]),
        prop("box", "data-x", "parameter", "Box"),
      ],
      dataSources: [
        variable("ok"),
        variable("Box", { name: "v" }),
        variable("Body", { name: "v" }),
        variable("set$ok", { name: "v" }),
        variable("list-index", { name: "v" }),
        variable("form", { name: "v" }),
        variable("res-1", { name: "v" }),
        variable("k", { name: "_key" }),
        variable("global-Box", { scopeInstanceId: ROOT_INSTANCE_ID }),
        variable("set$global", { scopeInstanceId: ROOT_INSTANCE_ID }),
        // on an instance no page publishes: left out, not counted
        variable("set$orphan", { scopeInstanceId: "orphan" }),
        [
          "binding",
          {
            type: "resource",
            id: "binding",
            name: "binding",
            scopeInstanceId: "root",
            resourceId: "res-1",
          },
        ],
      ],
    });
    const { result, log } = logOf(bundle);

    expect(result.build.dataSources.map(([id]) => id)).toEqual([
      "ok",
      "global-Box",
      "binding",
    ]);
    // a parameter prop that names one goes with it
    expect(propIds(result)).toEqual(["box:onDoubleClick"]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unsafe action and 8 variables with a conflicting id."
    );
  });

  // The only thing left out is a data source the page module uses for
  // something else, read by a parameter prop
  test("drops a data source whose id the page module uses for something else when nothing else is left out, and counts it", () => {
    for (const id of ["Box", "set$x"]) {
      const bundle = createBundle({
        pages: [{ id: "home", path: "", rootInstanceId: "root" }],
        instances: [
          instance({ id: "root", component: "Body", children: ids("box") }),
          instance({
            id: "box",
            component: "Box",
            children: [{ type: "text", value: "globalThis.pwned = 1" }],
          }),
        ],
        props: [prop("box", "x", "parameter", id)],
        dataSources: [
          [
            id,
            {
              type: "variable",
              id,
              name: "v",
              scopeInstanceId: "root",
              value: { type: "string", value: "script" },
            },
          ],
        ],
      });
      const { result, log } = logOf(bundle);

      expect(result.build.dataSources, id).toEqual([]);
      expect(propIds(result), id).toEqual([]);
      expect(log, id).toHaveBeenCalledWith(
        "Org script is paused until OrganizeOS sites move to their own domain: left out 1 variable with a conflicting id."
      );
    }
  });

  // A parameter is declared as itself only as a page's own or as a
  // Collection's item or key, which only an instance inside it names
  test("drops a parameter the page does not declare, and one a Collection binds that is not its own, with the parameter props and actions that name them, and counts them", () => {
    const dataSource = (
      id: string,
      type: "parameter" | "variable",
      scopeInstanceId: string,
      name = id
    ): PublishedProjectBundle["build"]["dataSources"][number] => [
      id,
      type === "parameter"
        ? { type, id, name, scopeInstanceId }
        : {
            type,
            id,
            name,
            scopeInstanceId,
            value: { type: "string", value: "x" },
          },
    ];
    const bundle = createBundle({
      pages: [
        {
          id: "home",
          path: "",
          rootInstanceId: "root",
          systemDataSourceId: "system",
        } as PageInit,
      ],
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("link", "list", "other", "outside"),
        }),
        instance({ id: "link", component: "Link" }),
        instance({
          id: "list",
          component: "ws:collection",
          children: ids("card"),
        }),
        instance({ id: "card", component: "Box" }),
        instance({
          id: "other",
          component: "ws:collection",
          children: ids("other-card"),
        }),
        instance({ id: "other-card", component: "Box" }),
        instance({ id: "outside", component: "Box" }),
      ],
      props: [
        mailto("link"),
        prop("link", "ref", "parameter", "timer"),
        prop("list", "data", "json", ["a", "b"]),
        prop("list", "item", "parameter", "item"),
        prop("card", "title", "parameter", "item"),
        prop("card", "aria-label", "parameter", "system"),
        prop("other", "data", "json", ["a"]),
        prop("other", "item", "parameter", "v"),
        prop("other-card", "onClick", "action", [
          {
            type: "execute",
            args: [],
            code: "$ws$dataSource$sink = $ws$dataSource$v",
          },
        ]),
        prop("outside", "title", "parameter", "other-item"),
        prop("list", "itemKey", "parameter", "other-item"),
      ],
      dataSources: [
        dataSource("system", "parameter", "root", "system"),
        dataSource("timer", "parameter", "root", "capture"),
        dataSource("item", "parameter", "list"),
        dataSource("v", "variable", "root"),
        dataSource("sink", "variable", "root"),
        dataSource("other-item", "parameter", "list"),
      ],
    });
    const { result, log } = logOf(bundle);

    expect(result.build.dataSources.map(([id]) => id)).toEqual([
      "system",
      "item",
      "sink",
    ]);
    expect(propIds(result)).toEqual([
      "link:href",
      "list:data",
      "list:item",
      "card:title",
      "card:aria-label",
      "other:data",
    ]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unsafe action and 3 variables with a conflicting id."
    );
  });

  // A build holds one entry per id, as the builder reads it: the last
  test("keeps one entry per id, the last, of the pages, instances, props, data sources and Resources, and counts the others", () => {
    const bundle = createBundle({
      pages: [
        { id: "home", path: "", rootInstanceId: "root" },
        {
          id: "feed",
          path: "/feed",
          rootInstanceId: "xml-root",
          meta: { documentType: "xml" },
        },
        { id: "feed", path: "/feed", rootInstanceId: "html-root" },
      ],
      instances: [
        instance({ id: "root", component: "Body", children: ids("box") }),
        instance({ id: "box", component: "x:script" }),
        instance({ id: "box", component: "Box" }),
        instance({ id: "xml-root", component: "Body" }),
        instance({ id: "html-root", component: "Body", children: ids("node") }),
        instance({ id: "node", component: "XmlNode" }),
        instance({ id: "elsewhere", component: "Box" }),
      ],
      props: [
        // stored under another id than its own
        [
          "P-alias",
          {
            id: "P",
            instanceId: "elsewhere",
            name: "title",
            type: "string",
            value: "y",
          },
        ],
        [
          "P",
          {
            id: "P",
            instanceId: "box",
            name: "onClick",
            type: "action",
            value: [
              {
                type: "execute",
                args: [") => 0, globalThis.pwned = 1, (x"],
                code: "0",
              },
            ],
          },
        ],
        [
          "P",
          {
            id: "P",
            instanceId: "elsewhere",
            name: "title",
            type: "string",
            value: "x",
          },
        ],
      ],
      dataSources: [
        [
          "D",
          {
            type: "parameter",
            id: "D",
            name: "capture",
            scopeInstanceId: "root",
          },
        ],
        [
          "D",
          {
            type: "variable",
            id: "D",
            name: "x",
            scopeInstanceId: "elsewhere",
            value: { type: "string", value: "" },
          },
        ],
      ],
    });
    const resource = (url: string) =>
      [
        "R",
        { id: "R", name: "r", method: "get", url, headers: [] },
      ] as PublishedProjectBundle["build"]["resources"][number];
    const template = (rootInstanceId: string) => ({
      id: "template",
      name: "Template",
      title: `"Template"`,
      rootInstanceId,
      meta: {},
    });
    const withResources: PublishedProjectBundle = {
      ...bundle,
      build: {
        ...bundle.build,
        pages: {
          ...bundle.build.pages,
          pageTemplates: [template("xml-root"), template("elsewhere")],
        } as unknown as PublishedProjectBundle["build"]["pages"],
        resources: [
          resource('"https://example.org/first"'),
          resource('"https://example.org/last"'),
        ],
      },
    };
    const { result, log } = logOf(withResources);

    expect(result.build.pages.pages.map((page) => page.rootInstanceId)).toEqual(
      ["root", "html-root"]
    );
    expect(
      (
        result.build.pages as unknown as {
          pageTemplates: Array<{ rootInstanceId: string }>;
        }
      ).pageTemplates.map((page) => page.rootInstanceId)
    ).toEqual(["elsewhere"]);
    expect(result.build.instances).toEqual([
      [
        "root",
        {
          type: "instance",
          id: "root",
          component: "Body",
          children: ids("box"),
        },
      ],
      ["box", { type: "instance", id: "box", component: "Box", children: [] }],
      [
        "xml-root",
        { type: "instance", id: "xml-root", component: "Body", children: [] },
      ],
      [
        "html-root",
        { type: "instance", id: "html-root", component: "Body", children: [] },
      ],
      [
        "elsewhere",
        { type: "instance", id: "elsewhere", component: "Box", children: [] },
      ],
    ]);
    expect(result.build.props.map(([, prop]) => prop.instanceId)).toEqual([
      "elsewhere",
    ]);
    expect(
      result.build.dataSources.map(([, dataSource]) => dataSource.type)
    ).toEqual(["variable"]);
    expect(result.build.resources?.map(([, resource]) => resource.url)).toEqual(
      ['"https://example.org/last"']
    );
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 7 duplicate entries and 1 XML element on an HTML page."
    );
  });

  // Prebuild reads a data source with no scope as held by an instance whose
  // id is empty
  test("counts a data source with no scope where an instance with an empty id stays", () => {
    const counted = (children: string[]) => {
      const { log } = logOf(
        createBundle({
          pages: [{ id: "home", path: "", rootInstanceId: "root" }],
          instances: [
            instance({
              id: "root",
              component: "Body",
              children: ids(...children),
            }),
            instance({
              id: "unknown",
              component: "x:unknown",
              children: ids(""),
            }),
            instance({ id: "", component: "Box" }),
          ],
          dataSources: [
            [
              "set$x",
              {
                type: "variable",
                id: "set$x",
                name: "x",
                value: { type: "string", value: "" },
              },
            ],
          ],
        })
      );
      return log.mock.calls[0]?.[0];
    };
    expect(counted([""])).toBe(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 variable with a conflicting id."
    );
    expect(counted(["unknown"])).toBe(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unknown component."
    );
  });

  // A parameter is declared as itself only on the page that owns it, and a
  // Collection binds one item and one key
  test("drops a page's own parameter held on the global root's id, both parameters a Collection with two item props names, and a Collection item that is not a parameter, and counts them", () => {
    const parameter = (
      id: string,
      scopeInstanceId: string
    ): PublishedProjectBundle["build"]["dataSources"][number] => [
      id,
      { type: "parameter", id, name: id, scopeInstanceId },
    ];
    const bundle = createBundle({
      pages: [{ id: "home", path: "", rootInstanceId: "root" }],
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids("link", "list", "other"),
        }),
        instance({ id: "link", component: "Link" }),
        instance({
          id: "list",
          component: "ws:collection",
          children: ids("card"),
        }),
        instance({ id: "card", component: "Link" }),
        instance({ id: "other", component: "ws:collection" }),
      ],
      props: [
        prop("link", "ref", "parameter", "root-own"),
        prop("list", "data", "json", ["a"]),
        prop("list", "item", "parameter", "first"),
        [
          "list:item:second",
          {
            id: "list:item:second",
            instanceId: "list",
            name: "item",
            type: "parameter",
            value: "last",
          },
        ],
        prop("card", "ref", "parameter", "first"),
        prop("other", "data", "json", ["a"]),
        prop("other", "item", "expression", '"x"'),
      ],
      dataSources: [
        parameter("root-own", ROOT_INSTANCE_ID),
        parameter("first", "list"),
        parameter("last", "list"),
      ],
    });
    const withTemplate: PublishedProjectBundle = {
      ...bundle,
      build: {
        ...bundle.build,
        pages: {
          ...bundle.build.pages,
          pageTemplates: [
            {
              id: "template",
              name: "Template",
              title: `"Template"`,
              rootInstanceId: ROOT_INSTANCE_ID,
              systemDataSourceId: "root-own",
              meta: {},
            },
          ],
        } as unknown as PublishedProjectBundle["build"]["pages"],
      },
    };
    const { result, log } = logOf(withTemplate);

    expect(result.build.dataSources).toEqual([]);
    expect(propIds(result)).toEqual(["list:data", "other:data"]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 Collection item or key that is not a parameter and 3 variables with a conflicting id."
    );
  });

  // Publishing empties a page root it drops into a Body
  test("drops a data source with the id Body when publishing empties a page root", () => {
    const bundle = createBundle({
      pages: [{ id: "home", path: "", rootInstanceId: "root" }],
      instances: [
        instance({ id: "root", component: "x:unknown", children: ids("box") }),
        instance({ id: "box", component: "Box" }),
      ],
      dataSources: [
        [
          "Body",
          {
            type: "variable",
            id: "Body",
            name: "v",
            scopeInstanceId: ROOT_INSTANCE_ID,
            value: { type: "string", value: "script" },
          },
        ],
      ],
    });
    const { result, log } = logOf(bundle);

    expect(result.build.instances).toEqual([
      [
        "root",
        { type: "instance", id: "root", component: "Body", children: [] },
      ],
    ]);
    expect(result.build.dataSources).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 1 unknown component and 1 variable with a conflicting id."
    );
  });

  test("drops an action as a Collection's item or key, and counts it", () => {
    const bundle = createBundle({
      pages: [{ id: "home", path: "", rootInstanceId: "root" }],
      instances: [
        instance({ id: "root", component: "Body", children: ids("list") }),
        instance({ id: "list", component: "ws:collection" }),
      ],
      props: [
        prop("list", "data", "json", ["a"]),
        prop("list", "item", "action", []),
        prop("list", "itemKey", "action", []),
      ],
    });
    const { result, log } = logOf(bundle);

    expect(propIds(result)).toEqual(["list:data"]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 2 unsafe actions."
    );
  });

  // Only a component the page imports, or one the generator writes itself,
  // ships
  test("drops an instance whose component the published page does not import, with what is inside it, counts it, and keeps the registered ones", () => {
    const bundle = createBundle({
      instances: [
        instance({
          id: "root",
          component: "Body",
          children: ids(
            "script",
            "unknown-root",
            "plain",
            "missing-block",
            "box",
            "tabs",
            "signup",
            "element",
            "list"
          ),
        }),
        instance({
          id: "script",
          component: "x:script",
          children: [
            { type: "text", value: "globalThis.pwned = 1" },
            ...ids("inside"),
          ],
        }),
        instance({ id: "inside", component: "Box" }),
        instance({ id: "unknown-root", component: "ws:root" }),
        instance({ id: "plain", component: "script" }),
        instance({
          id: "missing-block",
          component: `${ORGANIZEOS_NAMESPACE}:Missing`,
        }),
        instance({ id: "box", component: "Box" }),
        instance({
          id: "tabs",
          component: "@webstudio-is/sdk-components-react-radix:Tabs",
        }),
        instance({
          id: "signup",
          component: `${ORGANIZEOS_NAMESPACE}:SignupForm`,
        }),
        instance({ id: "element", component: "ws:element", tag: "div" }),
        instance({ id: "list", component: "ws:collection" }),
      ],
      props: [string("plain", "id", "x")],
    });
    const { result, log } = logOf(bundle);

    expect(instanceIds(result)).toEqual([
      "root",
      "box",
      "tabs",
      "signup",
      "element",
      "list",
    ]);
    expect(childrenOf(result, "root")).toEqual(
      ids("box", "tabs", "signup", "element", "list")
    );
    expect(propIds(result)).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      "Org script is paused until OrganizeOS sites move to their own domain: left out 4 unknown components."
    );
    // the components the framework imports decide
    expect(
      instanceIds(
        dropOrgScript(bundle, { components: new Set(["Body", "Box"]) })
      )
    ).toEqual(["root", "box", "element", "list"]);
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
  // Nodes sit on the XML page, and none of them is left out for being unsafe.
  // Its Accordion's action is: it names its arg on a component that is not
  // one of plainDataActionProps.
  test("leaves upstream's feature fixture alone, but for its Accordion's action", () => {
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

    // what it does leave out is the org's own script, embeds and custom code,
    // and the Accordion's action
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
    expect(message).toContain("1 unsafe action");
    const accordionActions = bundle.build.props.filter(
      ([, prop]) =>
        prop.type === "action" &&
        new Map(bundle.build.instances).get(prop.instanceId)?.component ===
          "@webstudio-is/sdk-components-react-radix:Accordion"
    );
    expect(accordionActions.map(([, prop]) => prop.name)).toEqual([
      "onValueChange",
    ]);
    // every other prop of an instance that stays is kept
    const kept = new Set(instanceIds(result));
    expect(propIds(result)).toEqual(
      bundle.build.props
        .filter(
          ([id, prop]) =>
            kept.has(prop.instanceId) && id !== accordionActions[0][0]
        )
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

  // Publishing keeps an instance only of a component the page imports, and
  // prebuild hands it the framework's own map: these are the same
  test("publishedComponents are the components the react-router framework imports", async () => {
    const cwd = process.cwd();
    const dir = await mkdtemp(join(tmpdir(), "organizeos-framework-"));
    try {
      process.chdir(dir);
      await mkdir(join("app", "route-templates"), { recursive: true });
      for (const name of ["html", "xml", "text", "default-sitemap"]) {
        await writeFile(join("app", "route-templates", `${name}.tsx`), "");
      }
      const framework = await createReactRouterFramework();
      expect([...publishedComponents].sort()).toEqual(
        Object.keys(framework.components).sort()
      );
    } finally {
      process.chdir(cwd);
      await rm(dir, { recursive: true, force: true });
    }
  });

  // A component of plainDataActionProps passes its action plain data, so its
  // action may name its args. One that is renamed or no longer registered gets
  // a decision: its action would be left out while org script is paused.
  test("every component whose action may name its args is registered", () => {
    for (const component of plainDataActionProps.keys()) {
      expect(metas.has(component), component).toBe(true);
    }
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
