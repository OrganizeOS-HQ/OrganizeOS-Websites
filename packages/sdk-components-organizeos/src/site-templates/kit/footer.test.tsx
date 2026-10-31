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
      // the placeholder's space is no-break, so it never splits across lines
      [["[Organization\u00A0name]"], [tagline]]
    );
    const named = renderFooter({ tagline, name: "[Candidate name]" });
    expect(textOf(byLabel(named.fragment, "Name"))).toEqual([
      "[Candidate\u00A0name]",
    ]);
  });

  test("is simple without columns", () => {
    const { fragment } = renderFooter({ tagline });
    expect(fragment.instances.some((item) => item.label === "Columns")).toBe(
      false
    );
  });

  test("the simple footer's links are a wrapping row, a nav named Footer, after the name", () => {
    const { fragment, outer } = renderFooter({
      tagline,
      links: [
        { label: "About", pageKey: "about" },
        { label: "Events", pageKey: "events" },
        { label: "Sign up", href: "#sign-up" },
      ],
    });
    const row = byLabel(fragment, "Links");
    expect(row.tag).toBe("nav");
    expect(propOf(fragment, row, "aria-label")?.value).toBe("Footer");
    expect(
      childInstances(fragment, row).map((link) => [
        link.component,
        textOf(link),
        propOf(fragment, link, "href")?.value,
      ])
    ).toEqual([
      ["Link", ["About"], "page-about"],
      ["Link", ["Events"], "page-events"],
      ["Link", ["Sign up"], "#sign-up"],
    ]);
    const [column] = childInstances(fragment, outer);
    const [bar] = childInstances(fragment, column);
    expect(childInstances(fragment, bar).map((item) => item.label)).toEqual([
      "Name and tagline",
      "Links",
    ]);
    for (const width of [1440, 767, 320]) {
      expect(stylesAt(fragment, row, width)).toMatchObject({
        display: "flex",
        "flex-wrap": "wrap",
      });
    }
    // from 768px up the name and tagline start from 18rem and grow, their
    // tagline wrapping, so the links stay beside them on a tablet
    for (const width of [1440, 991, 820, 768]) {
      expect(
        stylesAt(fragment, byLabel(fragment, "Name and tagline"), width)
      ).toMatchObject({
        "flex-grow": "1",
        "flex-shrink": "1",
        "flex-basis": "18rem",
      });
    }
    // on phones, where the bar is a column, they take their own height
    for (const width of [767, 390, 320]) {
      expect(
        stylesAt(fragment, byLabel(fragment, "Name and tagline"), width)[
          "flex-basis"
        ]
      ).toBe("auto");
    }
    const columned = renderFooter({ tagline, columns });
    expect(
      stylesAt(
        columned.fragment,
        byLabel(columned.fragment, "Name and tagline"),
        820
      )
    ).not.toHaveProperty("flex-basis");
    const without = renderFooter({ tagline });
    expect(
      without.fragment.instances.some((item) => item.label === "Links")
    ).toBe(false);
  });

  test("each column is a nav named by its title, the title as text, then its links", () => {
    const { fragment } = renderFooter({
      tagline,
      columns: [
        ...columns,
        { heading: "On this page", links: [{ label: "FAQ", href: "#faq" }] },
      ],
    });
    const rendered = childInstances(fragment, byLabel(fragment, "Columns"));
    expect(
      rendered.map((column) => {
        const [title, ...links] = childInstances(fragment, column);
        return {
          tag: column.tag,
          name: propOf(fragment, column, "aria-label")?.value,
          title: { tag: title.tag, text: textOf(title) },
          links: links.map((link) => ({
            component: link.component,
            text: textOf(link),
            href: propOf(fragment, link, "href")?.value,
          })),
        };
      })
    ).toEqual([
      ...columns.map((column) => ({
        tag: "nav",
        name: column.heading,
        title: { tag: "p", text: [column.heading] },
        links: column.links.map(({ label, pageKey }) => ({
          component: "Link",
          text: [label],
          href: pageIds[pageKey as keyof typeof pageIds],
        })),
      })),
      {
        tag: "nav",
        name: "On this page",
        title: { tag: "p", text: ["On this page"] },
        links: [{ component: "Link", text: ["FAQ"], href: "#faq" }],
      },
    ]);
  });

  test("adds no heading to the page's outline", () => {
    const { fragment } = renderFooter({
      tagline,
      columns,
      note: <ws.element ws:tag="p">{"[Paid for by]"}</ws.element>,
    });
    expect(
      fragment.instances.filter((instance) =>
        /^h[1-6]$/.test(instance.tag ?? "")
      )
    ).toEqual([]);
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
        "outline-color": "var(--focus-ring, var(--accent-2))",
        "outline-offset": "2px",
      });
    }
  });

  test("stacks to one column on phones", () => {
    const { fragment } = renderFooter({ tagline, columns });
    const columnsRow = byLabel(fragment, "Columns");
    const [bar] = fragment.instances.filter((instance) =>
      childInstances(fragment, instance).includes(columnsRow)
    );
    for (const row of [bar, columnsRow]) {
      expect(stylesAt(fragment, row, 768)["flex-direction"]).not.toBe("column");
      expect(stylesAt(fragment, row, 767)["flex-direction"]).toBe("column");
    }
  });

  test("boxes a note under the columns, at 14px, only when given one", () => {
    const { fragment, outer } = renderFooter({
      tagline,
      columns,
      note: <ws.element ws:tag="p">{"[Paid for by the committee]"}</ws.element>,
    });
    const [column] = childInstances(fragment, outer);
    const [bar, note] = childInstances(fragment, column);
    expect(childInstances(fragment, bar).map((item) => item.label)).toEqual([
      "Name and tagline",
      "Columns",
    ]);
    expect(note.label).toBe("Note");
    expect(stylesAt(fragment, column, 1440)["flex-direction"]).toBe("column");
    const box = stylesAt(fragment, note, 320);
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(box).toMatchObject({
        [`border-${side}-width`]: "1px",
        [`border-${side}-style`]: "solid",
        [`border-${side}-color`]: "var(--text)",
      });
    }
    expect(box).toMatchObject({
      "font-size": "14px",
      "align-self": "flex-start",
    });
    expect(childInstances(fragment, note).map((item) => textOf(item))).toEqual([
      ["[Paid for by the committee]"],
    ]);
    const without = renderFooter({ tagline, columns });
    expect(
      without.fragment.instances.some((item) => item.label === "Note")
    ).toBe(false);
  });

  test("sets the template's heading weight on the name and the column titles, and none unasked", () => {
    const weighted = renderFooter({ tagline, columns, headingWeight: 600 });
    const titled = weighted.fragment.instances.filter(
      (instance) =>
        instance.label === "Name" || instance.label === "Column title"
    );
    expect(titled).toHaveLength(3);
    for (const instance of titled) {
      expect(stylesAt(weighted.fragment, instance, 1440)["font-weight"]).toBe(
        "600"
      );
    }
    const plain = renderFooter({ tagline, columns });
    for (const instance of plain.fragment.instances) {
      expect(stylesAt(plain.fragment, instance, 1440)).not.toHaveProperty(
        "font-weight"
      );
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
