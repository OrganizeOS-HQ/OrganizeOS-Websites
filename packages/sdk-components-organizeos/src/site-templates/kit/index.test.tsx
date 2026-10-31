import { expect, test } from "vitest";
import { css, ws } from "@webstudio-is/template";
import { BLANK_CANONICAL_VALUES } from "../canonical-variables";
import { checkSiteTemplate } from "../check";
import { renderSiteTemplate } from "../render";
import type { PageContext, SiteTemplate, SiteTemplatePage } from "../types";
import {
  BREAKPOINT,
  CONTAINER,
  type KitStyle,
  type NavVariant,
  type SiteLink,
  footer,
  nav,
  section,
} from "./index";

const links: SiteLink[] = [
  { label: "About", pageKey: "about" },
  { label: "Events", pageKey: "events" },
  { label: "Sign up", href: "#sign-up" },
];

const look: KitStyle = {
  buttonRadius: "999px",
  buttonWeight: 600,
  headingWeight: 700,
};

const body = (
  { pageIds }: PageContext,
  heading: string,
  background: "base" | "accent-1" | "text",
  variant: NavVariant
) => (
  <ws.element
    ws:tag="body"
    ws:style={css`
      background-color: var(--base);
      color: var(--text);
      font-family: var(--font-body);
    `}
  >
    {nav({
      pageIds,
      links,
      cta: { label: "Join", pageKey: "events" },
      variant,
      ...look,
    })}
    {section({
      label: "Hero",
      background,
      id: "sign-up",
      width: "text",
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
      note: <ws.element ws:tag="p">{"[Paid for by the committee]"}</ws.element>,
      ...look,
    })}
  </ws.element>
);

const page = (
  key: string,
  path: string,
  background: "base" | "accent-1" | "text",
  variant: NavVariant
): SiteTemplatePage => ({
  key,
  name: key,
  path,
  title: key,
  description: "Say who you are and who you work with.",
  body: (context) => body(context, `The ${key} page`, background, variant),
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
    page("home", "", "base", "split"),
    page("about", "/about", "accent-1", "centered"),
    page("events", "/events", "text", "split"),
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
