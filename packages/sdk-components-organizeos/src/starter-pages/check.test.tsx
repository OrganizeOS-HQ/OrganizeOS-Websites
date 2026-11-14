import { describe, expect, test } from "vitest";
import { AssetValue, PageValue, css, ws } from "@webstudio-is/template";
import { $ } from "../shared/proxy";
import { SITE_TEMPLATES } from "../site-templates/catalog";
import { NEUTRALITY_DENY_LIST } from "../site-templates/check";
import type { BlockKey } from "../site-templates/place-block";
import type { CompleteKitStyle } from "../site-templates/types";
import { checkStarterPage } from "./check";
import { NEUTRAL_LOOK } from "./look";
import type { StarterPage, StarterPageContext } from "./types";
import { sampleStarterPage } from "./__fixtures__/sample";

const SignupForm: BlockKey = "@organizeos/site-components:SignupForm";
const EventList: BlockKey = "@organizeos/site-components:EventList";

const header = () => (
  <ws.element ws:tag="section" ws:label="Page header">
    <ws.element ws:tag="h1">{"Say what this page is for"}</ws.element>
  </ws.element>
);

/** The sample with a body of its own: the header, then `extra`. */
const withBody = (
  extra: (context: StarterPageContext) => JSX.Element
): StarterPage => ({
  ...sampleStarterPage,
  blocks: [],
  body: (context) => (
    <ws.element ws:tag="body">
      {header()}
      {extra(context)}
    </ws.element>
  ),
});

describe("checkStarterPage", () => {
  test("the sample page passes under every look", () => {
    expect(
      checkStarterPage(sampleStarterPage, [
        NEUTRAL_LOOK,
        ...SITE_TEMPLATES.map((template) => template.look),
      ])
    ).toEqual([]);
  });

  test.each(["Nav", "Footer: Columns"])(
    "a section labelled %s is refused",
    (label) => {
      const page = withBody(() => (
        <ws.element ws:tag="nav" ws:label={label}>
          {"Links"}
        </ws.element>
      ));
      expect(checkStarterPage(page)).toContain(
        `Page "sample": "${label}" in the body; a page template has no nav or footer`
      );
    }
  );

  test("a page link is refused", () => {
    const page = withBody(() => (
      <ws.element ws:tag="section" ws:label="About">
        <$.Link ws:label="Learn more" href={new PageValue("somePage")}>
          {"Learn more"}
        </$.Link>
      </ws.element>
    ));
    expect(checkStarterPage(page)).toContain(
      `Page "sample": the "href" of "Learn more" links to a page; a page template links only to platform paths`
    );
  });

  test("an empty default path is refused", () => {
    expect(checkStarterPage({ ...sampleStarterPage, path: "" })).toContain(
      `Page "sample": the default path is empty`
    );
  });

  test("a platform-served default path is refused", () => {
    expect(checkStarterPage({ ...sampleStarterPage, path: "/join" })).toContain(
      `Page "sample" is at /join, which the platform serves on the site's own host, so the page would never show`
    );
  });

  test("a picture missing from images is refused", () => {
    expect(
      checkStarterPage({ ...sampleStarterPage, picture: "x.jpg" })
    ).toContain(`Page "sample": the picture "x.jpg" is not in its images`);
  });

  test("images holding more than the picture are refused", () => {
    const page: StarterPage = {
      ...sampleStarterPage,
      images: {
        ...sampleStarterPage.images,
        "other.jpg": { url: "/other.jpg", sourceUrl: "x", alt: "Other" },
      },
    };
    expect(checkStarterPage(page)).toContain(
      `Page "sample": images holds more than the picture`
    );
  });

  test("a body with a style is refused", () => {
    const page: StarterPage = {
      ...sampleStarterPage,
      blocks: [],
      body: () => (
        <ws.element
          ws:tag="body"
          ws:style={css`
            color: var(--text);
          `}
        >
          {header()}
        </ws.element>
      ),
    };
    expect(checkStarterPage(page)).toContain(
      `Page "sample": the body carries a style; adding the page gives it the site's`
    );
  });

  test("a placed block its blocks do not name is refused", () => {
    expect(checkStarterPage({ ...sampleStarterPage, blocks: [] })).toContain(
      `Page "sample" places SignupForm, which its blocks do not name`
    );
  });

  test("a named block it does not place is refused", () => {
    expect(
      checkStarterPage({
        ...sampleStarterPage,
        blocks: [SignupForm, EventList],
      })
    ).toContain(
      `Page "sample" names EventList in its blocks but does not place it`
    );
  });

  test("an asset image is refused", () => {
    const page = withBody(() => (
      <ws.element ws:tag="section" ws:label="About">
        <$.Image src={new AssetValue("x")} alt="A photo" />
      </ws.element>
    ));
    expect(checkStarterPage(page)).toContain(
      `Page "sample": holds the asset "x"; a page template holds none`
    );
  });

  test("an asset background is refused", () => {
    const page = withBody(() => (
      <ws.element
        ws:tag="section"
        ws:label="About"
        ws:style={[
          {
            property: "background-image",
            value: {
              type: "layers",
              value: [{ type: "image", value: { type: "asset", value: "bg" } }],
            },
          },
        ]}
      />
    ));
    expect(checkStarterPage(page)).toContain(
      `Page "sample": holds the asset "bg"; a page template holds none`
    );
  });

  test("a denied word in the title is refused", () => {
    const [word] = NEUTRALITY_DENY_LIST;
    const result = checkStarterPage({
      ...sampleStarterPage,
      title: `Our ${word} page`,
    });
    expect(
      result.some(
        (line) =>
          line.startsWith(`Page "sample": the title says`) &&
          line.endsWith("which is on the neutrality deny list")
      )
    ).toBe(true);
  });

  test("a look without headingWeight fails", () => {
    const { headingWeight: _, ...rest } = NEUTRAL_LOOK;
    const look = rest as unknown as CompleteKitStyle;
    expect(checkStarterPage(sampleStarterPage, [look])).toContain(
      "Look: headingWeight is not set"
    );
  });

  test("the per-page rules run", () => {
    const page = withBody(() => (
      <ws.element ws:tag="section" ws:label="About">
        <ws.element ws:tag="h1">{"A second heading"}</ws.element>
      </ws.element>
    ));
    expect(checkStarterPage(page)).toContain(
      `Page "sample": has 2 h1 headings; a page has exactly one`
    );
  });

  test("a violation found under every look is listed once", () => {
    const page = { ...sampleStarterPage, blocks: [] };
    const line = `Page "sample" places SignupForm, which its blocks do not name`;
    expect(
      checkStarterPage(page, [NEUTRAL_LOOK, NEUTRAL_LOOK]).filter(
        (item) => item === line
      )
    ).toHaveLength(1);
  });
});
