import { describe, expect, test } from "vitest";
import { renderTemplate, ws } from "@webstudio-is/template";
import type { SiteLink } from "./links";
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

const links: SiteLink[] = [
  { label: "About", pageKey: "about" },
  { label: "Programs", pageKey: "programs" },
  { label: "Events", pageKey: "events" },
  { label: "News", pageKey: "news" },
  { label: "Contact", pageKey: "contact" },
];

const donate: SiteLink = { label: "Donate", pageKey: "donate" };

const renderNav = (options: Omit<Parameters<typeof nav>[0], "pageIds">) =>
  renderTemplate(
    <ws.element ws:tag="body">{nav({ pageIds, ...options })}</ws.element>
  );

const hrefOf = (
  fragment: ReturnType<typeof renderNav>,
  instance: ReturnType<typeof byLabel>
) => {
  const prop = propOf(fragment, instance, "href");
  return { type: prop?.type, value: prop?.value };
};

describe("nav", () => {
  test("is a header labelled Nav: the name, the links, the button", () => {
    const fragment = renderNav({ links, cta: donate });
    const header = byLabel(fragment, "Nav");
    expect(header.tag).toBe("header");
    const [bar] = childInstances(fragment, header);
    expect(childInstances(fragment, bar).map((item) => item.label)).toEqual([
      "Name",
      "Links",
      "Button",
    ]);
    const linksRow = byLabel(fragment, "Links");
    expect(linksRow.tag).toBe("nav");
    expect(propOf(fragment, linksRow, "aria-label")?.value).toBe("Main");
  });

  test("the name is text where a logo goes, linking Home", () => {
    const fragment = renderNav({ links });
    const name = byLabel(fragment, "Name");
    expect(name.component).toBe("Link");
    // the name keeps its plain spaces, the placeholder's too, so on the
    // smallest phone it wraps at them and the button keeps its place
    expect(textOf(name)).toEqual(["[Organization name]"]);
    expect(hrefOf(fragment, name)).toEqual({
      type: "page",
      value: "page-home",
    });
    const named = renderNav({ links, name: "[Candidate name]" });
    expect(textOf(byLabel(named, "Name"))).toEqual(["[Candidate name]"]);
  });

  test("links go to pages by key or to anchors, in order", () => {
    const fragment = renderNav({
      links: [...links.slice(0, 2), { label: "FAQ", href: "#faq" }],
    });
    const items = childInstances(fragment, byLabel(fragment, "Links"));
    expect(
      items.map((item) => ({
        component: item.component,
        text: textOf(item),
        href: hrefOf(fragment, item),
      }))
    ).toEqual([
      {
        component: "Link",
        text: ["About"],
        href: { type: "page", value: "page-about" },
      },
      {
        component: "Link",
        text: ["Programs"],
        href: { type: "page", value: "page-programs" },
      },
      {
        component: "Link",
        text: ["FAQ"],
        href: { type: "string", value: "#faq" },
      },
    ]);
  });

  test("the button links its page or anchor, and is left out when there is none", () => {
    const fragment = renderNav({ links, cta: donate });
    const button = byLabel(fragment, "Button");
    expect(textOf(button)).toEqual(["Donate"]);
    expect(hrefOf(fragment, button)).toEqual({
      type: "page",
      value: "page-donate",
    });
    expect(stylesAt(fragment, button, 1440)).toMatchObject({
      "background-color": "var(--accent-1)",
      color: "var(--base)",
    });
    const anchored = renderNav({
      links,
      cta: { label: "Add your name", href: "#sign-up" },
    });
    expect(hrefOf(anchored, byLabel(anchored, "Button"))).toEqual({
      type: "string",
      value: "#sign-up",
    });
    const without = renderNav({ links });
    expect(without.instances.some((item) => item.label === "Button")).toBe(
      false
    );
  });

  test("a button to a platform path reloads the page", () => {
    const fragment = renderNav({
      links,
      cta: { label: "Donate", href: "/donate" },
    });
    const button = byLabel(fragment, "Button");
    expect(hrefOf(fragment, button)).toEqual({
      type: "string",
      value: "/donate",
    });
    expect(propOf(fragment, button, "reloadDocument")?.value).toBe(true);
    // a page's button is a client navigation
    const paged = renderNav({ links, cta: donate });
    expect(propOf(paged, byLabel(paged, "Button"), "reloadDocument")).toBe(
      undefined
    );
  });

  test("the name, every link and the button are at least 44px tall, with the focus ring", () => {
    for (const variant of ["split", "centered"] as const) {
      const fragment = renderNav({ links, cta: donate, variant });
      // the centred nav holds the button in its links row
      const targets = new Set([
        byLabel(fragment, "Name"),
        ...childInstances(fragment, byLabel(fragment, "Links")),
        byLabel(fragment, "Button"),
      ]);
      expect(targets.size).toBe(7);
      for (const target of targets) {
        for (const width of [1440, 820, 767, 320]) {
          expect(stylesAt(fragment, target, width)["min-height"]).toBe("44px");
        }
        expect(stateStyles(fragment, target, ":focus-visible")).toEqual({
          "outline-width": "2px",
          "outline-style": "solid",
          "outline-color": "var(--focus-ring, var(--accent-2))",
          "outline-offset": "2px",
        });
      }
    }
  });

  describe("no item is left alone on a row", () => {
    const names = ["[Organization name]", "Riverside Tenants Association"];

    test("from 992px up the bar is one row that never wraps; links wrap in their own box beside the button", () => {
      for (const name of names) {
        const fragment = renderNav({ name, links, cta: donate });
        const [bar] = childInstances(fragment, byLabel(fragment, "Nav"));
        for (const width of [1440, 1024, 992]) {
          expect(stylesAt(fragment, bar, width)["flex-wrap"]).toBe("nowrap");
          const linksRow = stylesAt(
            fragment,
            byLabel(fragment, "Links"),
            width
          );
          expect(linksRow).toMatchObject({ "flex-wrap": "wrap" });
          expect(linksRow).not.toHaveProperty("order");
          expect(
            stylesAt(fragment, byLabel(fragment, "Button"), width)[
              "flex-shrink"
            ]
          ).toBe("0");
        }
      }
    });

    test("at 991px and below (768 and 900 among them) the name and the button share the first row and the links take the next", () => {
      for (const name of names) {
        const fragment = renderNav({ name, links, cta: donate });
        const [bar] = childInstances(fragment, byLabel(fragment, "Nav"));
        for (const width of [991, 900, 820, 768, 767, 479, 320]) {
          expect(stylesAt(fragment, bar, width)["flex-wrap"]).toBe("wrap");
          // the links come last and fill a row of their own
          expect(
            stylesAt(fragment, byLabel(fragment, "Links"), width)
          ).toMatchObject({ order: "1", "flex-basis": "100%" });
          // the name starts from nothing and wraps its own text, so the
          // button always fits beside it
          expect(
            stylesAt(fragment, byLabel(fragment, "Name"), width)
          ).toMatchObject({ "flex-grow": "1", "flex-basis": "0" });
          expect(
            stylesAt(fragment, byLabel(fragment, "Button"), width)
          ).not.toHaveProperty("order");
        }
      }
    });
  });

  test("draws with the template's corners and weights, and declares no weight of its own", () => {
    const styled = renderNav({
      links,
      cta: donate,
      buttonRadius: "999px",
      buttonWeight: 600,
      headingWeight: 700,
    });
    expect(stylesAt(styled, byLabel(styled, "Button"), 1440)).toMatchObject({
      "border-top-left-radius": "999px",
      "border-bottom-right-radius": "999px",
      "font-weight": "600",
    });
    expect(stylesAt(styled, byLabel(styled, "Name"), 1440)["font-weight"]).toBe(
      "700"
    );
    const plain = renderNav({ links, cta: donate });
    for (const label of ["Name", "Button"]) {
      const styles = stylesAt(plain, byLabel(plain, label), 1440);
      expect(styles).not.toHaveProperty("font-weight");
      expect(styles).not.toHaveProperty("border-top-left-radius");
    }
  });

  describe("centered", () => {
    const renderCentered = () =>
      renderNav({
        variant: "centered",
        links: [
          { label: "Why", href: "#why" },
          { label: "FAQ", href: "#faq" },
          { label: "About", pageKey: "about" },
        ],
        cta: { label: "Add your name", href: "#sign-up" },
      });

    test("centres the name over one row of the links and the button", () => {
      const fragment = renderCentered();
      const header = byLabel(fragment, "Nav: Centered");
      expect(header.tag).toBe("header");
      const [bar] = childInstances(fragment, header);
      expect(stylesAt(fragment, bar, 1440)).toMatchObject({
        "flex-direction": "column",
        "align-items": "center",
        "text-align": "center",
      });
      expect(childInstances(fragment, bar).map((item) => item.label)).toEqual([
        "Name",
        "Links",
      ]);
      const linksRow = byLabel(fragment, "Links");
      expect(stylesAt(fragment, linksRow, 320)).toMatchObject({
        "flex-wrap": "wrap",
        "justify-content": "center",
      });
      const items = childInstances(fragment, linksRow);
      expect(items.map((item) => item.label ?? textOf(item)[0])).toEqual([
        "Why",
        "FAQ",
        "About",
        "Button",
      ]);
    });

    test("anchors are plain string hrefs and page keys stay page links", () => {
      const fragment = renderCentered();
      const items = childInstances(fragment, byLabel(fragment, "Links"));
      expect(items.map((item) => hrefOf(fragment, item))).toEqual([
        { type: "string", value: "#why" },
        { type: "string", value: "#faq" },
        { type: "page", value: "page-about" },
        { type: "string", value: "#sign-up" },
      ]);
      expect(hrefOf(fragment, byLabel(fragment, "Name"))).toEqual({
        type: "page",
        value: "page-home",
      });
    });
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
