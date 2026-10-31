import { describe, expect, test } from "vitest";
import { renderTemplate, ws } from "@webstudio-is/template";
import { footer } from "./footer";
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
  events: "page-events",
  volunteer: "page-volunteer",
  contact: "page-contact",
};

const columns = [
  {
    heading: "About",
    links: [
      { label: "Who we are", pageKey: "about" },
      { label: "Contact", pageKey: "contact" },
    ],
  },
  {
    heading: "Take part",
    links: [
      { label: "Events", pageKey: "events" },
      { label: "Volunteer", pageKey: "volunteer" },
    ],
  },
];

const tagline = "Neighbours working together for [goal].";

const renderFooter = (
  options: Omit<Parameters<typeof footer>[0], "pageIds">
) => {
  const fragment = renderTemplate(
    <ws.element ws:tag="body">{footer({ pageIds, ...options })}</ws.element>
  );
  return { fragment, outer: byLabel(fragment, "Footer") };
};

describe("footer", () => {
  test("is a footer labelled Footer with the name and the tagline", () => {
    const { fragment, outer } = renderFooter({ tagline });
    expect(outer.tag).toBe("footer");
    const about = byLabel(fragment, "Name and tagline");
    expect(childInstances(fragment, about).map((item) => textOf(item))).toEqual(
      [["[Organization name]"], [tagline]]
    );
    const named = renderFooter({ tagline, name: "[Candidate name]" });
    expect(textOf(byLabel(named.fragment, "Name"))).toEqual([
      "[Candidate name]",
    ]);
  });

  test("is simple without columns", () => {
    const { fragment } = renderFooter({ tagline });
    expect(fragment.instances.some((item) => item.label === "Columns")).toBe(
      false
    );
  });

  test("each column is a heading and Links to its pages by key", () => {
    const { fragment } = renderFooter({ tagline, columns });
    const rendered = childInstances(fragment, byLabel(fragment, "Columns"));
    expect(
      rendered.map((column) => {
        const [heading, ...links] = childInstances(fragment, column);
        return {
          heading: { tag: heading.tag, text: textOf(heading) },
          links: links.map((link) => ({
            component: link.component,
            text: textOf(link),
            href: propOf(fragment, link, "href")?.value,
          })),
        };
      })
    ).toEqual(
      columns.map((column) => ({
        heading: { tag: "h2", text: [column.heading] },
        links: column.links.map(({ label, pageKey }) => ({
          component: "Link",
          text: [label],
          href: pageIds[pageKey as keyof typeof pageIds],
        })),
      }))
    );
  });

  test("every link is at least 44px tall, with the focus ring", () => {
    const { fragment } = renderFooter({ tagline, columns });
    const links = fragment.instances.filter(
      (instance) => instance.component === "Link"
    );
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(stylesAt(fragment, link, 320)["min-height"]).toBe("44px");
      expect(stateStyles(fragment, link, ":focus-visible")).toMatchObject({
        "outline-color": "var(--accent-2)",
        "outline-offset": "2px",
      });
    }
  });

  test("stacks to one column on phones", () => {
    const { fragment, outer } = renderFooter({ tagline, columns });
    const [bar] = childInstances(fragment, outer);
    const columnsRow = byLabel(fragment, "Columns");
    for (const row of [bar, columnsRow]) {
      expect(stylesAt(fragment, row, 768)["flex-direction"]).not.toBe("column");
      expect(stylesAt(fragment, row, 767)["flex-direction"]).toBe("column");
    }
  });

  test("sits on the base colours under a rule in the text colour", () => {
    const { fragment, outer } = renderFooter({ tagline });
    expect(stylesAt(fragment, outer, 1440)).toMatchObject({
      "background-color": "var(--base)",
      color: "var(--text)",
      "border-top-width": "1px",
      "border-top-style": "solid",
      "border-top-color": "var(--text)",
    });
  });

  test("two calls make distinct instances", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {footer({ pageIds, tagline, columns })}
        {footer({ pageIds, tagline, columns })}
      </ws.element>
    );
    const ids = fragment.instances.map((instance) => instance.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      fragment.instances.filter((instance) => instance.label === "Footer")
    ).toHaveLength(2);
  });
});
