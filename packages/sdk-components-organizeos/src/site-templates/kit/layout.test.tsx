import { describe, expect, test } from "vitest";
import { css, renderTemplate, ws } from "@webstudio-is/template";
import { initialBreakpoints } from "@webstudio-is/sdk";
import { BREAKPOINT, CONTAINER, SPACE, container, section } from "./layout";
import { byLabel, childInstances, propOf, stylesAt } from "./test-helpers";

const renderBody = (children: JSX.Element) =>
  renderTemplate(<ws.element ws:tag="body">{children}</ws.element>);

const content = () => <ws.element ws:tag="p">{"Say who you are."}</ws.element>;

describe("measurements", () => {
  test("BREAKPOINT names the project's own max-width breakpoints", () => {
    const { breakpoints } = renderTemplate(
      <ws.element
        ws:tag="body"
        ws:style={css`
          ${BREAKPOINT.tablet} {
            color: var(--text);
          }
          ${BREAKPOINT.landscape} {
            color: var(--text);
          }
          ${BREAKPOINT.portrait} {
            color: var(--text);
          }
        `}
      />
    );
    const projectWidths = initialBreakpoints.flatMap(({ maxWidth }) =>
      maxWidth === undefined ? [] : [maxWidth]
    );
    expect(
      breakpoints.map(({ minWidth, maxWidth }) => ({ minWidth, maxWidth }))
    ).toEqual(
      projectWidths.map((maxWidth) => ({ minWidth: undefined, maxWidth }))
    );
    expect(projectWidths).toEqual([991, 767, 479]);
  });

  test("SPACE is the shared spacing scale in px", () => {
    expect(Object.values(SPACE)).toEqual([
      "4px",
      "8px",
      "12px",
      "16px",
      "24px",
      "32px",
      "48px",
      "64px",
      "96px",
    ]);
    expect(SPACE[24]).toBe("24px");
  });

  test("CONTAINER holds the text measure, the form width and the content width", () => {
    expect(CONTAINER).toEqual({
      text: "65ch",
      narrow: "40rem",
      wide: "1120px",
    });
  });
});

describe("container", () => {
  const renderContainer = (width: keyof typeof CONTAINER) => {
    const fragment = renderBody(
      <ws.element ws:tag="div" ws:label="Column" ws:style={container(width)} />
    );
    return { fragment, column: byLabel(fragment, "Column") };
  };

  test("centres a column of the width with 40px gutters, 20px on phones", () => {
    const { fragment, column } = renderContainer("text");
    expect(stylesAt(fragment, column, 1440)).toEqual({
      "box-sizing": "content-box",
      "max-width": "65ch",
      "margin-left": "auto",
      "margin-right": "auto",
      "padding-left": "40px",
      "padding-right": "40px",
    });
    for (const width of [768, 991]) {
      expect(stylesAt(fragment, column, width)).toMatchObject({
        "padding-left": "40px",
        "padding-right": "40px",
      });
    }
    for (const width of [767, 479, 390, 320]) {
      expect(stylesAt(fragment, column, width)).toMatchObject({
        "padding-left": "20px",
        "padding-right": "20px",
      });
    }
  });

  test("takes each of the widths", () => {
    for (const width of ["text", "narrow", "wide"] as const) {
      const { fragment, column } = renderContainer(width);
      expect(stylesAt(fragment, column, 1440)["max-width"]).toBe(
        CONTAINER[width]
      );
    }
  });
});

describe("section", () => {
  test("is a labelled full-bleed section around a wide container", () => {
    const fragment = renderBody(
      section({ label: "About", children: content() })
    );
    const outer = byLabel(fragment, "About");
    expect(outer.tag).toBe("section");
    const [inner] = childInstances(fragment, outer);
    expect(stylesAt(fragment, inner, 1440)).toMatchObject({
      "max-width": "1120px",
      "padding-left": "40px",
      "padding-right": "40px",
    });
    expect(stylesAt(fragment, inner, 479)).toMatchObject({
      "padding-left": "20px",
      "padding-right": "20px",
    });
    expect(childInstances(fragment, inner).map((item) => item.tag)).toEqual([
      "p",
    ]);
  });

  test("pads 96px above and below, 56px on phones", () => {
    const fragment = renderBody(
      section({ label: "About", children: content() })
    );
    const outer = byLabel(fragment, "About");
    expect(stylesAt(fragment, outer, 1440)).toMatchObject({
      "padding-top": "96px",
      "padding-bottom": "96px",
    });
    expect(stylesAt(fragment, outer, 767)).toMatchObject({
      "padding-top": "56px",
      "padding-bottom": "56px",
    });
    // full-bleed: no width and no side padding of its own
    expect(stylesAt(fragment, outer, 1440)).not.toHaveProperty("max-width");
    expect(stylesAt(fragment, outer, 320)).not.toHaveProperty("padding-left");
  });

  test("sets one of the checked background pairs, base by default", () => {
    const colours = (background?: "base" | "accent-1" | "text") => {
      const fragment = renderBody(
        section({ label: "Band", background, children: content() })
      );
      const styles = stylesAt(fragment, byLabel(fragment, "Band"), 1440);
      return [styles["background-color"], styles.color];
    };
    expect(colours()).toEqual(["var(--base)", "var(--text)"]);
    expect(colours("base")).toEqual(["var(--base)", "var(--text)"]);
    expect(colours("accent-1")).toEqual(["var(--accent-1)", "var(--base)"]);
    expect(colours("text")).toEqual(["var(--text)", "var(--base)"]);
  });

  test("carries an id for in-page links only when given one", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {section({ label: "Sign-up", id: "sign-up", children: content() })}
        {section({ label: "About", children: content() })}
      </ws.element>
    );
    expect(propOf(fragment, byLabel(fragment, "Sign-up"), "id")).toMatchObject({
      type: "string",
      value: "sign-up",
    });
    expect(propOf(fragment, byLabel(fragment, "About"), "id")).toBeUndefined();
  });

  test("two calls make distinct instances", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {section({ label: "About", children: content() })}
        {section({ label: "About", children: content() })}
      </ws.element>
    );
    const ids = fragment.instances.map((instance) => instance.id);
    // the body, then a section, its container and paragraph per call
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
  });
});
