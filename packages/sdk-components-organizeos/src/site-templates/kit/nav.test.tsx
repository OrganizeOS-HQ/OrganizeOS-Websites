import { describe, expect, test } from "vitest";
import { renderTemplate, ws } from "@webstudio-is/template";
import { nav } from "./nav";
import {
  byLabel,
  childInstances,
  propOf,
  stateStyles,
  stylesAt,
  textOf,
} from "./test-helpers";

const pageIds = {
  home: "page-home",
  about: "page-about",
  programs: "page-programs",
  events: "page-events",
  news: "page-news",
  contact: "page-contact",
  donate: "page-donate",
};

const links = [
  { label: "About", pageKey: "about" },
  { label: "Programs", pageKey: "programs" },
  { label: "Events", pageKey: "events" },
  { label: "News", pageKey: "news" },
  { label: "Contact", pageKey: "contact" },
];

const renderNav = (options: Omit<Parameters<typeof nav>[0], "pageIds">) => {
  const fragment = renderTemplate(
    <ws.element ws:tag="body">{nav({ pageIds, ...options })}</ws.element>
  );
  return { fragment, header: byLabel(fragment, "Nav") };
};

describe("nav", () => {
  test("is a header labelled Nav: the name, the links, the button", () => {
    const { fragment, header } = renderNav({
      links,
      cta: { label: "Donate", pageKey: "donate" },
    });
    expect(header.tag).toBe("header");
    const [bar] = childInstances(fragment, header);
    expect(childInstances(fragment, bar).map((item) => item.label)).toEqual([
      "Name",
      "Links",
      "Button",
    ]);
  });

  test("the name is text where a logo goes, linking Home", () => {
    const { fragment } = renderNav({ links });
    const name = byLabel(fragment, "Name");
    expect(name.component).toBe("Link");
    expect(textOf(name)).toEqual(["[Organization name]"]);
    expect(propOf(fragment, name, "href")).toMatchObject({
      type: "page",
      value: "page-home",
    });
    const named = renderNav({ links, name: "[Candidate name]" });
    expect(textOf(byLabel(named.fragment, "Name"))).toEqual([
      "[Candidate name]",
    ]);
  });

  test("each link is a Link to its page by key, in order", () => {
    const { fragment } = renderNav({ links });
    const items = childInstances(fragment, byLabel(fragment, "Links"));
    expect(byLabel(fragment, "Links").tag).toBe("nav");
    expect(
      items.map((item) => ({
        component: item.component,
        text: textOf(item),
        href: propOf(fragment, item, "href"),
      }))
    ).toEqual(
      links.map(({ label, pageKey }) => ({
        component: "Link",
        text: [label],
        href: expect.objectContaining({
          type: "page",
          value: pageIds[pageKey as keyof typeof pageIds],
        }),
      }))
    );
  });

  test("the button links its page, and is left out when there is none", () => {
    const { fragment } = renderNav({
      links,
      cta: { label: "Donate", pageKey: "donate" },
    });
    const button = byLabel(fragment, "Button");
    expect(textOf(button)).toEqual(["Donate"]);
    expect(propOf(fragment, button, "href")).toMatchObject({
      type: "page",
      value: "page-donate",
    });
    expect(stylesAt(fragment, button, 1440)).toMatchObject({
      "background-color": "var(--accent-1)",
      color: "var(--base)",
    });
    const without = renderNav({ links });
    expect(
      without.fragment.instances.some((item) => item.label === "Button")
    ).toBe(false);
  });

  test("the name, every link and the button are at least 44px tall, with the focus ring", () => {
    const { fragment } = renderNav({
      links,
      cta: { label: "Donate", pageKey: "donate" },
    });
    const targets = [
      byLabel(fragment, "Name"),
      ...childInstances(fragment, byLabel(fragment, "Links")),
      byLabel(fragment, "Button"),
    ];
    for (const target of targets) {
      for (const width of [1440, 767, 320]) {
        expect(stylesAt(fragment, target, width)["min-height"]).toBe("44px");
      }
      expect(stateStyles(fragment, target, ":focus-visible")).toEqual({
        "outline-width": "2px",
        "outline-style": "solid",
        "outline-color": "var(--accent-2)",
        "outline-offset": "2px",
      });
    }
  });

  test("a link is underlined on hover and as the current page", () => {
    const { fragment } = renderNav({ links });
    const [link] = childInstances(fragment, byLabel(fragment, "Links"));
    // the Link meta's "Current page" state, unquoted
    for (const state of [":hover", "[aria-current=page]"]) {
      expect(stateStyles(fragment, link, state)).toEqual({
        "text-decoration-line": "underline",
      });
    }
  });

  test("on phones the links take a row of their own under the name", () => {
    const { fragment } = renderNav({
      links,
      cta: { label: "Donate", pageKey: "donate" },
    });
    const linksRow = byLabel(fragment, "Links");
    const name = byLabel(fragment, "Name");
    expect(stylesAt(fragment, linksRow, 768)).not.toHaveProperty("order");
    expect(stylesAt(fragment, name, 768)).not.toHaveProperty("flex-grow");
    for (const width of [767, 479, 320]) {
      expect(stylesAt(fragment, linksRow, width)).toMatchObject({
        order: "1",
        "flex-basis": "100%",
        "flex-wrap": "wrap",
      });
      // the name shares its row with the button, wrapping its own text
      expect(stylesAt(fragment, name, width)).toMatchObject({
        "flex-grow": "1",
        "flex-basis": "0",
      });
    }
  });

  test("two calls make distinct instances", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {nav({ pageIds, links })}
        {nav({ pageIds, links })}
      </ws.element>
    );
    const ids = fragment.instances.map((instance) => instance.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      fragment.instances.filter((instance) => instance.label === "Nav")
    ).toHaveLength(2);
  });
});
