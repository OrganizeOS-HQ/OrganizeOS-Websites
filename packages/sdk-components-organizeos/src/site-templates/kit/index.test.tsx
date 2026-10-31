import { expect, test } from "vitest";
import { css, ws } from "@webstudio-is/template";
import { BLANK_CANONICAL_VALUES } from "../canonical-variables";
import { checkSiteTemplate } from "../check";
import { renderSiteTemplate } from "../render";
import type { PageContext, SiteTemplate, SiteTemplatePage } from "../types";
import { BREAKPOINT, CONTAINER, footer, nav, section } from "./index";

const links = [
  { label: "About", pageKey: "about" },
  { label: "Events", pageKey: "events" },
];

const body = (
  { pageIds }: PageContext,
  heading: string,
  background: "base" | "accent-1" | "text"
) => (
  <ws.element
    ws:tag="body"
    ws:style={css`
      background-color: var(--base);
      color: var(--text);
      font-family: var(--font-body);
    `}
  >
    {nav({ pageIds, links, cta: { label: "Join", pageKey: "events" } })}
    {section({
      label: "Hero",
      background,
      children: (
        <ws.element
          ws:tag="h1"
          ws:style={css`
            max-width: ${CONTAINER.text};
            font-family: var(--font-heading);
            ${BREAKPOINT.portrait} {
              font-size: 32px;
            }
          `}
        >
          {heading}
        </ws.element>
      ),
    })}
    {footer({
      pageIds,
      tagline: "Neighbours working together for [goal].",
      columns: [{ heading: "Take part", links }],
    })}
  </ws.element>
);

const page = (
  key: string,
  path: string,
  background: "base" | "accent-1" | "text"
): SiteTemplatePage => ({
  key,
  name: key,
  path,
  title: key,
  description: "Say who you are and who you work with.",
  body: (context) => body(context, `The ${key} page`, background),
});

const template: SiteTemplate = {
  id: "kit-fixture",
  category: "community",
  name: "Kit fixture",
  oneLine: "Three pages made of the layout kit",
  styleTags: [],
  status: "draft",
  dependsOn: [],
  thumbnail: "hero.jpg",
  variables: BLANK_CANONICAL_VALUES,
  images: {
    "hero.jpg": {
      url: "/site-templates/kit-fixture/hero.jpg",
      sourceUrl: "https://example.org/hero",
      alt: "Replace with a photo of your members",
    },
  },
  pages: [
    page("home", "", "base"),
    page("about", "/about", "accent-1"),
    page("events", "/events", "text"),
  ],
};

test("a template made of the kit passes the template check", () => {
  expect(checkSiteTemplate(template)).toEqual([]);
});

test("the kit uses only the project's max-width breakpoints", () => {
  const pages = renderSiteTemplate(template, {
    assetIds: new Map([["hero.jpg", "asset-hero"]]),
    generatePageId: (() => {
      let count = 0;
      return () => `page-${++count}`;
    })(),
  });
  for (const { fragment } of pages) {
    for (const breakpoint of fragment.breakpoints) {
      expect(breakpoint.minWidth).toBeUndefined();
      expect([undefined, 991, 767, 479]).toContain(breakpoint.maxWidth);
    }
  }
});
