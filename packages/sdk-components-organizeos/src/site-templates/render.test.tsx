import { describe, expect, test } from "vitest";
import { getStyleDeclKey } from "@webstudio-is/sdk";
import { $, PageValue, css, renderTemplate, ws } from "@webstudio-is/template";
import { cardToken } from "../events/event-card.template";
import { meta as eventListMeta } from "../event-list.template";
import { BLANK_CANONICAL_VALUES } from "./canonical-variables";
import type { BlockKey } from "./place-block";
import { renderSiteTemplate, type RenderedPage } from "./render";
import type { SiteTemplate, SiteTemplatePage } from "./types";

const EventList: BlockKey = "@organizeos/site-components:EventList";

const home: SiteTemplatePage = {
  key: "home",
  name: "Home",
  path: "",
  title: "Home",
  description: "Say in one sentence what your organization is working toward.",
  body: ({ pageIds, placeBlock, image, imageAlt, backgroundImage }) => (
    <ws.element
      ws:tag="body"
      ws:style={[
        ...css`
          color: var(--text);
        `,
        ...backgroundImage("hero.jpg"),
      ]}
    >
      <ws.element ws:tag="h1">{"Your organization's goal"}</ws.element>
      <$.Image
        ws:id="photo"
        src={image("hero.jpg")}
        alt={imageAlt("hero.jpg")}
      />
      <$.Link ws:id="about-link" href={new PageValue(pageIds.about)}>
        {"About us"}
      </$.Link>
      {placeBlock(EventList, "upcoming")}
    </ws.element>
  ),
};

const about: SiteTemplatePage = {
  key: "about",
  name: "About",
  path: "/about",
  title: "About",
  description: "Say who you are and who you work with.",
  body: ({ pageIds }) => (
    <ws.element ws:tag="body">
      <ws.element ws:tag="h1">{"About us"}</ws.element>
      <$.Link ws:id="home-link" href={new PageValue(pageIds.home)}>
        {"Home"}
      </$.Link>
    </ws.element>
  ),
};

const template: SiteTemplate = {
  id: "fixture",
  category: "nonprofit",
  name: "Fixture",
  oneLine: "A two-page fixture",
  styleTags: [],
  status: "draft",
  dependsOn: [],
  thumbnail: "/thumbnail.jpg",
  variables: BLANK_CANONICAL_VALUES,
  images: {
    "hero.jpg": {
      url: "/site-templates/fixture/hero.jpg",
      sourceUrl: "https://example.org/hero",
      alt: "Replace with a photo of your members",
    },
  },
  fonts: {},
  pages: [home, about],
};

const assetIds = new Map([["hero.jpg", "asset-hero"]]);

const pageIdCounter = () => {
  let count = 0;
  return () => {
    count += 1;
    return `page-${count}`;
  };
};

const render = (source: SiteTemplate = template) =>
  renderSiteTemplate(source, { assetIds, generatePageId: pageIdCounter() });

const byKey = (pages: RenderedPage[], key: string) => {
  const page = pages.find((item) => item.key === key);
  if (page === undefined) {
    throw new Error(`No page "${key}"`);
  }
  return page;
};

const propOf = (page: RenderedPage, instanceId: string, name: string) =>
  page.fragment.props.find(
    (prop) => prop.instanceId === instanceId && prop.name === name
  );

describe("renderSiteTemplate", () => {
  test("renders every page with its row fields", () => {
    const pages = render();
    expect(pages).toHaveLength(2);
    expect(
      pages.map(({ key, pageId, name, path, title, description }) => ({
        key,
        pageId,
        name,
        path,
        title,
        description,
      }))
    ).toEqual([
      {
        key: "home",
        pageId: "page-1",
        name: "Home",
        path: "",
        title: "Home",
        description: home.description,
      },
      {
        key: "about",
        pageId: "page-2",
        name: "About",
        path: "/about",
        title: "About",
        description: about.description,
      },
    ]);
  });

  test("a page's root is its body", () => {
    const pages = render();
    for (const page of pages) {
      const [root] = page.fragment.children;
      const body = page.fragment.instances.find(
        (instance) => instance.id === root.value
      );
      expect(body?.tag).toBe("body");
    }
  });

  test("links between pages are page values, before and after the page", () => {
    const pages = render();
    const homePage = byKey(pages, "home");
    const aboutPage = byKey(pages, "about");
    expect(propOf(aboutPage, "home-link", "href")).toMatchObject({
      type: "page",
      value: homePage.pageId,
    });
    expect(propOf(homePage, "about-link", "href")).toMatchObject({
      type: "page",
      value: aboutPage.pageId,
    });
  });

  test("an image prop is the image's asset id", () => {
    const homePage = byKey(render(), "home");
    expect(propOf(homePage, "photo", "src")).toMatchObject({
      type: "asset",
      value: "asset-hero",
    });
    expect(propOf(homePage, "photo", "alt")).toMatchObject({
      type: "string",
      value: "Replace with a photo of your members",
    });
  });

  test("a background image is a layer holding the image's asset", () => {
    const homePage = byKey(render(), "home");
    const bodyId = homePage.fragment.children[0].value;
    const selection = homePage.fragment.styleSourceSelections.find(
      (item) => item.instanceId === bodyId
    );
    const decl = homePage.fragment.styles.find(
      (item) =>
        selection?.values.includes(item.styleSourceId) &&
        item.property === "backgroundImage"
    );
    expect(decl?.value).toEqual({
      type: "layers",
      value: [{ type: "image", value: { type: "asset", value: "asset-hero" } }],
    });
  });

  test("each page lists the blocks it placed", () => {
    const pages = render();
    expect(byKey(pages, "home").placements).toEqual([
      { key: EventList, rootId: "upcoming" },
    ]);
    expect(byKey(pages, "about").placements).toEqual([]);
  });

  test("each page has a placer of its own", () => {
    const listPage = (key: string, path: string): SiteTemplatePage => ({
      ...about,
      key,
      path,
      body: ({ placeBlock }) => (
        <ws.element ws:tag="body">
          <ws.element ws:tag="h1">{"Events"}</ws.element>
          {placeBlock(EventList, "upcoming")}
        </ws.element>
      ),
    });
    const pages = render({
      ...template,
      pages: [home, listPage("events", "/events")],
    });
    expect(byKey(pages, "events").placements).toEqual([
      { key: EventList, rootId: "upcoming" },
    ]);
  });

  test("every page id is generated before any page renders", () => {
    const calls: string[] = [];
    let count = 0;
    const tracked = (page: SiteTemplatePage): SiteTemplatePage => ({
      ...page,
      body: (context) => {
        calls.push(`render ${page.key}`);
        return page.body(context);
      },
    });
    renderSiteTemplate(
      { ...template, pages: [tracked(home), tracked(about)] },
      {
        assetIds,
        generatePageId: () => {
          count += 1;
          calls.push(`id ${count}`);
          return `page-${count}`;
        },
      }
    );
    expect(calls).toEqual(["id 1", "id 2", "render home", "render about"]);
  });

  test("an unknown image throws, naming the page", () => {
    const broken: SiteTemplatePage = {
      ...about,
      body: ({ image }) => (
        <ws.element ws:tag="body">
          <$.Image src={image("missing.jpg")} />
        </ws.element>
      ),
    };
    expect(() => render({ ...template, pages: [home, broken] })).toThrow(
      /Page "about".*"missing\.jpg"/
    );
  });

  test("an image with no asset id throws", () => {
    expect(() =>
      renderSiteTemplate(template, {
        assetIds: new Map(),
        generatePageId: pageIdCounter(),
      })
    ).toThrow(/Page "home".*"hero\.jpg"/);
  });

  test("a page key used twice throws", () => {
    expect(() =>
      render({ ...template, pages: [home, { ...about, key: "home" }] })
    ).toThrow(/"home"/);
  });
});

describe("template block tokens", () => {
  /** One page placing a dated Event List, its own styles only at 767px. */
  const eventsPage: SiteTemplatePage = {
    ...about,
    key: "events",
    path: "/events",
    body: ({ placeBlock }) => (
      <ws.element
        ws:tag="body"
        ws:style={css`
          @media (max-width: 767px) {
            color: var(--text);
          }
        `}
      >
        <ws.element ws:tag="h1">{"Events"}</ws.element>
        {placeBlock(EventList, "upcoming", { card: "dated" })}
      </ws.element>
    ),
  };

  /** A page placing only a Signup Form, whose tokens the template leaves. */
  const signupPage: SiteTemplatePage = {
    ...about,
    key: "join",
    path: "/join",
    body: ({ placeBlock }) => (
      <ws.element ws:tag="body">
        <ws.element ws:tag="h1">{"Join"}</ws.element>
        {placeBlock("@organizeos/site-components:SignupForm", "signup")}
      </ws.element>
    ),
  };

  const withTokens: SiteTemplate = {
    ...template,
    pages: [home, eventsPage, signupPage],
    blockTokens: {
      "OS Card": css`
        padding: 24px;
        border-top-color: var(--accent-1);
        text-transform: uppercase;
      `,
      "OS Event Date": css`
        @media (max-width: 767px) {
          color: var(--accent-2);
        }
        @media (max-width: 479px) {
          width: 56px;
        }
      `,
    },
  };

  /** A token's declarations in a page's fragment, by breakpoint width. */
  const tokenStyles = (page: RenderedPage, name: string) => {
    const { fragment } = page;
    const sources = fragment.styleSources.filter(
      (source) => source.type === "token" && source.name === name
    );
    expect(sources).toHaveLength(1);
    return fragment.styles
      .filter((style) => style.styleSourceId === sources[0].id)
      .map((style) => ({
        breakpoint: fragment.breakpoints.find(
          (item) => item.id === style.breakpointId
        ),
        state: style.state,
        property: style.property,
        value: style.value,
      }));
  };

  const declared = (
    styles: ReturnType<typeof tokenStyles>,
    property: string,
    maxWidth?: number
  ) =>
    styles
      .filter(
        (style) =>
          style.property === property &&
          style.state === undefined &&
          style.breakpoint?.maxWidth === maxWidth
      )
      .map((style) => style.value);

  test("a declaration replaces the token's own of the same key, and the others are added", () => {
    const page = byKey(render(withTokens), "events");
    const styles = tokenStyles(page, "OS Card");
    expect(declared(styles, "paddingTop")).toEqual([
      { type: "unit", unit: "px", value: 24 },
    ]);
    expect(declared(styles, "paddingLeft")).toEqual([
      { type: "unit", unit: "px", value: 24 },
    ]);
    expect(declared(styles, "borderTopColor")).toEqual([
      { type: "var", value: "accent-1" },
    ]);
    // the token's own declarations the template does not name are kept
    expect(declared(styles, "borderBottomColor")).toHaveLength(1);
    expect(declared(styles, "display")).toEqual([
      { type: "keyword", value: "flex" },
    ]);
    // and a declaration the token does not have is added
    expect(declared(styles, "textTransform")).toEqual([
      { type: "keyword", value: "uppercase" },
    ]);
    // one declaration per key
    const keys = page.fragment.styles.map(getStyleDeclKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("a declaration under a media query goes on the page's breakpoint for it, added when the page has none", () => {
    const page = byKey(render(withTokens), "events");
    const { breakpoints } = page.fragment;
    // the page's own 767, and the 479 that only the block token uses
    expect(
      breakpoints
        .map(({ minWidth, maxWidth }) => maxWidth ?? minWidth ?? 0)
        .sort((a, b) => a - b)
    ).toEqual([0, 479, 767]);
    expect(new Set(breakpoints.map(({ id }) => id)).size).toBe(3);
    const styles = tokenStyles(page, "OS Event Date");
    expect(declared(styles, "color", 767)).toEqual([
      { type: "var", value: "accent-2" },
    ]);
    expect(declared(styles, "width", 479)).toEqual([
      { type: "unit", unit: "px", value: 56 },
    ]);
    // the token's own base width is kept beside it
    expect(declared(styles, "width")).toHaveLength(1);
  });

  test("breakpoints a token adds have ids of their own", () => {
    const page = byKey(
      render({
        ...withTokens,
        blockTokens: {
          "OS Card": css`
            @media (max-width: 991px) {
              padding: 20px;
            }
            @media (max-width: 479px) {
              padding: 12px;
            }
          `,
        },
      }),
      "events"
    );
    const { breakpoints } = page.fragment;
    expect(
      breakpoints.map(({ maxWidth }) => maxWidth ?? 0).sort((a, b) => a - b)
    ).toEqual([0, 479, 767, 991]);
    expect(new Set(breakpoints.map(({ id }) => id)).size).toBe(4);
    const styles = tokenStyles(page, "OS Card");
    expect(declared(styles, "paddingTop", 991)).toEqual([
      { type: "unit", unit: "px", value: 20 },
    ]);
    expect(declared(styles, "paddingTop", 479)).toEqual([
      { type: "unit", unit: "px", value: 12 },
    ]);
  });

  test("a page that places none of the tokens named is unchanged", () => {
    const plain = byKey(render({ ...withTokens, blockTokens: {} }), "join");
    const styled = byKey(render(withTokens), "join");
    expect(styled.fragment).toEqual(plain.fragment);
  });

  test("leak into no other render: another template, the panel's block and the shared token", () => {
    const tokenBefore = structuredClone(cardToken.styles);
    const panelBefore = renderTemplate(eventListMeta.template);
    const otherBefore = render({ ...withTokens, blockTokens: undefined });

    render(withTokens);

    expect(cardToken.styles).toEqual(tokenBefore);
    expect(renderTemplate(eventListMeta.template)).toEqual(panelBefore);
    expect(render({ ...withTokens, blockTokens: undefined })).toEqual(
      otherBefore
    );
    const other = byKey(otherBefore, "events");
    expect(declared(tokenStyles(other, "OS Card"), "paddingTop")).toEqual([
      { type: "unit", unit: "px", value: 16 },
    ]);
  });
});
