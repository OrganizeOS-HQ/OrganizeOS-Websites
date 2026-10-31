import { describe, expect, test } from "vitest";
import { PageValue, renderTemplate, ws } from "@webstudio-is/template";
import { buttonStyles, linkProps, textLink } from "./links";
import { byLabel, propOf, stateStyles, stylesAt } from "./test-helpers";

const pageIds = { home: "page-home", about: "page-about" };

describe("linkProps", () => {
  test("a page key is the page's id, an anchor a plain string", () => {
    expect(linkProps(pageIds, { label: "About", pageKey: "about" })).toEqual({
      href: new PageValue("page-about"),
    });
    expect(linkProps(pageIds, { label: "FAQ", href: "#faq" })).toEqual({
      href: "#faq",
    });
  });

  // A published site's router has no route there: without a document
  // navigation it shows the site's own 404.
  test("a platform path reloads the page", () => {
    expect(linkProps(pageIds, { label: "Donate", href: "/donate" })).toEqual({
      href: "/donate",
      reloadDocument: true,
    });
  });
});

describe("textLink", () => {
  test("to a platform path renders with reloadDocument", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {textLink(pageIds, { label: "Donate", href: "/donate" }, 0)}
      </ws.element>
    );
    const link = fragment.instances.find(
      (instance) => instance.component === "Link"
    );
    if (link === undefined) {
      throw new Error("No link");
    }
    expect(propOf(fragment, link, "href")).toMatchObject({
      type: "string",
      value: "/donate",
    });
    expect(propOf(fragment, link, "reloadDocument")).toMatchObject({
      type: "boolean",
      value: true,
    });
  });
});

describe("textLink", () => {
  test("is underlined on hover and as the current page", () => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        {textLink(pageIds, { label: "About", pageKey: "about" }, 0)}
      </ws.element>
    );
    const link = fragment.instances.find(
      (instance) => instance.component === "Link"
    );
    if (link === undefined) {
      throw new Error("No link");
    }
    expect(stylesAt(fragment, link, 1440)).toMatchObject({
      color: "inherit",
      "text-decoration-line": "none",
      "min-height": "44px",
    });
    // the Link meta's "Current page" state, unquoted
    for (const state of [":hover", "[aria-current=page]"]) {
      expect(stateStyles(fragment, link, state)).toEqual({
        "text-decoration-line": "underline",
      });
    }
  });
});

describe("buttonStyles", () => {
  const renderButton = (styles: ReturnType<typeof buttonStyles>) => {
    const fragment = renderTemplate(
      <ws.element ws:tag="body">
        <ws.element ws:tag="a" ws:label="Button" ws:style={styles} />
      </ws.element>
    );
    return { fragment, button: byLabel(fragment, "Button") };
  };

  test("fills accent-1 with base text, 44px tall, with the focus ring", () => {
    const { fragment, button } = renderButton(buttonStyles());
    expect(stylesAt(fragment, button, 1440)).toMatchObject({
      "background-color": "var(--accent-1)",
      color: "var(--base)",
      "min-height": "44px",
      "padding-left": "24px",
    });
    expect(stylesAt(fragment, button, 390)["padding-left"]).toBe("16px");
    expect(stateStyles(fragment, button, ":focus-visible")).toMatchObject({
      "outline-color": "var(--focus-ring, var(--accent-2))",
    });
  });

  test("takes the template's corners and label weight, and sets none unasked", () => {
    for (const radius of ["3px", "6px", "999px"]) {
      const { fragment, button } = renderButton(
        buttonStyles({ buttonRadius: radius, buttonWeight: 600 })
      );
      const styles = stylesAt(fragment, button, 1440);
      for (const corner of [
        "border-top-left-radius",
        "border-top-right-radius",
        "border-bottom-right-radius",
        "border-bottom-left-radius",
      ]) {
        expect(styles[corner]).toBe(radius);
      }
      expect(styles["font-weight"]).toBe("600");
    }
    const { fragment, button } = renderButton(buttonStyles());
    const styles = stylesAt(fragment, button, 1440);
    expect(styles).not.toHaveProperty("border-top-left-radius");
    expect(styles).not.toHaveProperty("font-weight");
  });
});
