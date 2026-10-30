import { describe, expect, test } from "vitest";
import {
  $,
  PageValue,
  PlaceholderValue,
  ResourceValue,
  css,
  expression,
  ws,
} from "@webstudio-is/template";
import { cardToken } from "../events/event-card.template";
import { organizeos } from "../shared/proxy";
import { BLANK_CANONICAL_VALUES } from "./canonical-variables";
import { NEUTRALITY_DENY_LIST, checkSiteTemplate } from "./check";
import type { BlockKey } from "./place-block";
import type { PageContext, SiteTemplate, SiteTemplatePage } from "./types";

const EventCard: BlockKey = "@organizeos/site-components:EventCard";
const EventList: BlockKey = "@organizeos/site-components:EventList";
const SignupForm: BlockKey = "@organizeos/site-components:SignupForm";

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
          background-color: var(--base);
          color: var(--text);
          font-family: var(--font-body);
        `,
        ...backgroundImage("hero.jpg"),
      ]}
    >
      <ws.element
        ws:tag="section"
        ws:label="Hero"
        ws:style={css`
          display: flex;
          color: currentcolor;
          border-top-color: transparent;
          box-shadow: 0 0 4px var(--accent-1);
          background-image: linear-gradient(var(--base), var(--accent-2));
        `}
      >
        <ws.element
          ws:tag="h1"
          ws:style={css`
            font-family: var(--font-heading);
          `}
        >
          {"Say what your organization is working toward"}
        </ws.element>
        <ws.element ws:tag="p">
          {new PlaceholderValue("Describe the people you work with.")}
        </ws.element>
        <$.Image src={image("hero.jpg")} alt={imageAlt("hero.jpg")} />
        <$.Link href={new PageValue(pageIds.about)}>{"Learn more"}</$.Link>
      </ws.element>
      <ws.element ws:tag="section" ws:label="Events">
        {placeBlock(EventCard, "featured")}
        {placeBlock(EventList, "upcoming")}
      </ws.element>
      <ws.element ws:tag="section" ws:label="Sign-up">
        {placeBlock(SignupForm, "signup")}
      </ws.element>
    </ws.element>
  ),
};

type Content = (context: PageContext) => JSX.Element;

const defaultContent: Content = () => (
  <ws.element ws:tag="p">{"Say who you are and who you work with."}</ws.element>
);

const aboutPage = (content: Content = defaultContent): SiteTemplatePage => ({
  key: "about",
  name: "About",
  path: "/about",
  title: "About",
  description: "Say who you are and who you work with.",
  body: (context) => (
    <ws.element ws:tag="body">
      <ws.element ws:tag="h1">{"About us"}</ws.element>
      <$.Link href={new PageValue(context.pageIds.home)}>{"Home"}</$.Link>
      {content(context)}
    </ws.element>
  ),
});

const fixture = (overrides: Partial<SiteTemplate> = {}): SiteTemplate => ({
  id: "fixture",
  category: "nonprofit",
  name: "Fixture",
  oneLine: "A two-page fixture",
  styleTags: [],
  status: "draft",
  dependsOn: [],
  thumbnail: "hero.jpg",
  variables: BLANK_CANONICAL_VALUES,
  images: {
    "hero.jpg": {
      url: "/site-templates/fixture/hero.jpg",
      sourceUrl: "https://example.org/hero",
      alt: "Replace with a photo of your members",
    },
  },
  pages: [home, aboutPage()],
  ...overrides,
});

/** The fixture with one thing added to the About page. */
const checkAbout = (content: Content) =>
  checkSiteTemplate(fixture({ pages: [home, aboutPage(content)] }));

const expectOneViolation = (violations: string[], ...mentions: string[]) => {
  expect(violations).toHaveLength(1);
  for (const mention of mentions) {
    expect(violations[0]).toContain(mention);
  }
};

describe("checkSiteTemplate", () => {
  test("a valid fixture has no violations", () => {
    expect(checkSiteTemplate(fixture())).toEqual([]);
  });

  describe("platform blocks", () => {
    test.each(["SignupForm", "RsvpForm", "ShareCodeCarrier"])(
      "a %s written without placeBlock is a violation",
      (component) => {
        const Block = organizeos[component];
        expectOneViolation(
          checkAbout(() => <Block ws:label="Block" />),
          '"about"',
          component
        );
      }
    );

    test("a placed block's literal border colour is not a violation", () => {
      expect(
        checkAbout(({ placeBlock }) => placeBlock(EventCard, "featured"))
      ).toEqual([]);
    });

    test("a block token used outside a placed block is checked", () => {
      const violations = checkAbout(({ placeBlock }) => (
        <ws.element ws:tag="div">
          {placeBlock(EventCard, "featured")}
          <ws.element ws:tag="article" ws:tokens={[cardToken]} />
        </ws.element>
      ));
      expect(violations).not.toEqual([]);
      for (const violation of violations) {
        expect(violation).toContain('"about"');
        expect(violation).toContain('"OS Card"');
      }
    });
  });

  describe("colours and fonts", () => {
    test.each([
      {
        name: "a literal colour",
        style: css`
          color: #ffffff;
        `,
      },
      {
        name: "a keyword colour",
        style: css`
          color: white;
        `,
      },
      {
        name: "a keyword border colour",
        style: css`
          border-top-color: red;
        `,
      },
      {
        name: "a colour inside an unparsed gradient",
        style: css`
          background-image: linear-gradient(#ffffff, var(--base));
        `,
      },
      {
        name: "an rgba() inside an unparsed gradient",
        style: css`
          background-image: linear-gradient(rgba(0, 0, 0, 0.5), var(--base));
        `,
      },
      {
        name: "a shadow's keyword colour",
        style: css`
          box-shadow: 0 0 4px black;
        `,
      },
      {
        name: "a shadow's literal colour",
        style: css`
          box-shadow: 0 0 4px #000000;
        `,
      },
      {
        name: "a filter's literal colour",
        style: css`
          filter: drop-shadow(0 0 4px #000000);
        `,
      },
      {
        name: "a non-canonical variable",
        style: css`
          color: var(--brand);
        `,
      },
      {
        name: "a non-canonical variable in an unparsed shadow",
        style: css`
          box-shadow: 1px 1px 2px var(--brand);
        `,
      },
      {
        name: "a non-canonical variable on any property",
        style: css`
          row-gap: var(--space);
        `,
      },
      {
        name: "a canonical variable's literal fallback",
        style: css`
          color: var(--text, #000000);
        `,
      },
    ])("$name is a violation", ({ style }) => {
      expectOneViolation(
        checkAbout(() => (
          <ws.element ws:tag="div" ws:label="Broken" ws:style={style} />
        )),
        '"about"',
        '"Broken"'
      );
    });

    test("transparent, currentcolor and the global keywords are not violations", () => {
      expect(
        checkAbout(() => (
          <ws.element
            ws:tag="div"
            ws:style={css`
              color: currentcolor;
              background-color: transparent;
              border-top-color: inherit;
              outline-color: initial;
              caret-color: unset;
            `}
          />
        ))
      ).toEqual([]);
    });

    test("none and auto on colour properties are not violations", () => {
      expect(
        checkAbout(() => (
          <ws.element
            ws:tag="svg"
            ws:style={css`
              fill: none;
              stroke: none;
              caret-color: auto;
            `}
          />
        ))
      ).toEqual([]);
    });

    test("a literal font is a violation; a font variable is not", () => {
      const fontOf = (style: ReturnType<typeof css>) =>
        checkAbout(() => (
          <ws.element ws:tag="div" ws:label="Text" ws:style={style} />
        ));
      expectOneViolation(
        fontOf(css`
          font-family: Georgia;
        `),
        '"about"',
        '"Text"',
        "Georgia"
      );
      expect(
        fontOf(css`
          font-family: var(--font-body);
        `)
      ).toEqual([]);
      expect(
        fontOf(css`
          font-family: inherit;
        `)
      ).toEqual([]);
      expectOneViolation(
        fontOf(css`
          font-family: var(--base);
        `),
        '"Text"',
        "--base"
      );
    });
  });

  test("a Resource is a violation", () => {
    const events = new ResourceValue("Events", {
      url: expression`"https://example.org/events"`,
      method: "get",
      searchParams: [],
      headers: [],
    });
    expectOneViolation(
      checkAbout(() => <ws.element ws:tag="div" data={events} />),
      '"about"',
      "Resource"
    );
  });

  test("a duplicate instance id is a violation", () => {
    expectOneViolation(
      checkAbout(() => (
        <ws.element ws:tag="div">
          <ws.element ws:tag="p" ws:id="twice" />
          <ws.element ws:tag="p" ws:id="twice" />
        </ws.element>
      )),
      '"about"',
      '"twice"'
    );
  });

  describe("headings", () => {
    test("a second h1 is a violation", () => {
      expectOneViolation(
        checkAbout(() => <ws.element ws:tag="h1">{"Again"}</ws.element>),
        '"about"',
        "h1"
      );
    });

    test("no h1 is a violation", () => {
      const about: SiteTemplatePage = {
        ...aboutPage(),
        body: () => (
          <ws.element ws:tag="body">
            <ws.element ws:tag="h2">{"About us"}</ws.element>
          </ws.element>
        ),
      };
      expectOneViolation(
        checkSiteTemplate(fixture({ pages: [home, about] })),
        '"about"',
        "h1"
      );
    });
  });

  describe("pages", () => {
    test("a page rooted at an element that is not the body is a violation", () => {
      const about: SiteTemplatePage = {
        ...aboutPage(),
        body: () => (
          <ws.element ws:tag="div">
            <ws.element ws:tag="h1">{"About us"}</ws.element>
          </ws.element>
        ),
      };
      expectOneViolation(
        checkSiteTemplate(fixture({ pages: [home, about] })),
        '"about"',
        "<body>"
      );
    });

    test("a link to a page the template does not have is a violation", () => {
      expectOneViolation(
        checkAbout(({ pageIds }) => (
          <$.Link ws:label="Broken link" href={new PageValue(pageIds.abuot)}>
            {"About"}
          </$.Link>
        )),
        '"about"',
        '"Broken link"',
        "page"
      );
    });

    test("a link to an element of a page is a violation", () => {
      expectOneViolation(
        checkAbout(({ pageIds }) => (
          <$.Link
            ws:label="Section link"
            href={new PageValue(pageIds.home, "hero")}
          >
            {"Home"}
          </$.Link>
        )),
        '"about"',
        '"Section link"',
        "element"
      );
    });
  });

  describe("paths", () => {
    test("a page at /newsletter is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({ pages: [home, { ...aboutPage(), path: "/newsletter" }] })
        ),
        '"about"',
        "/newsletter"
      );
    });

    test("a path shared by two pages is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({
            pages: [home, aboutPage(), { ...aboutPage(), key: "team" }],
          })
        ),
        '"about"',
        '"team"',
        "/about"
      );
    });

    test("a page at /* is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({ pages: [home, { ...aboutPage(), path: "/*" }] })
        ),
        '"about"',
        "/*"
      );
    });

    test.each(["about", "/About", "/about/", "/about us", "/s/about"])(
      "the path %s is a violation",
      (path) => {
        expectOneViolation(
          checkSiteTemplate(
            fixture({ pages: [home, { ...aboutPage(), path }] })
          ),
          '"about"',
          `"${path}"`
        );
      }
    );

    test("no Home page is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({ pages: [{ ...home, path: "/home" }, aboutPage()] })
        ),
        "Home"
      );
    });
  });

  describe("images", () => {
    test("an image without a source URL is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({
            images: {
              "hero.jpg": { ...fixture().images["hero.jpg"], sourceUrl: "" },
            },
          })
        ),
        '"hero.jpg"',
        "source"
      );
    });

    test.each([
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      "images/hero.jpg",
      "//cdn.example.org/hero.jpg",
    ])("an image at %s is a violation", (url) => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({
            images: { "hero.jpg": { ...fixture().images["hero.jpg"], url } },
          })
        ),
        '"hero.jpg"',
        "URL"
      );
    });

    test("an image at an https URL is not a violation", () => {
      expect(
        checkSiteTemplate(
          fixture({
            images: {
              "hero.jpg": {
                ...fixture().images["hero.jpg"],
                url: "https://example.org/hero.jpg",
              },
            },
          })
        )
      ).toEqual([]);
    });

    test("a thumbnail that is not one of the images is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(fixture({ thumbnail: "/thumbnail.jpg" })),
        "thumbnail",
        '"/thumbnail.jpg"'
      );
    });

    test("an image without alt text is a violation, and so is its Image", () => {
      const violations = checkSiteTemplate(
        fixture({
          images: {
            "hero.jpg": { ...fixture().images["hero.jpg"], alt: " " },
          },
        })
      );
      // The entry, and Home's Image, whose alt is imageAlt("hero.jpg").
      expect(violations).toEqual([
        'Image "hero.jpg" has no alt text',
        expect.stringMatching(/^Page "home": .* has no alt text$/),
      ]);
    });

    test("an image that is not in the template's images is a violation", () => {
      expectOneViolation(
        checkAbout(({ image }) => (
          <$.Image src={image("missing.jpg")} alt="Replace with a photo" />
        )),
        '"about"',
        '"missing.jpg"'
      );
    });

    test("an Image with a literal src is a violation", () => {
      expectOneViolation(
        checkAbout(() => (
          <$.Image
            ws:label="Photo"
            src="https://example.org/photo.jpg"
            alt="Replace with a photo"
          />
        )),
        '"about"',
        '"Photo"',
        "src"
      );
    });

    test("an img with no alt is a violation", () => {
      expectOneViolation(
        checkAbout(({ image }) => (
          <ws.element ws:tag="img" ws:label="Photo" src={image("hero.jpg")} />
        )),
        '"about"',
        '"Photo"',
        "alt"
      );
    });

    test("a background image by URL is a violation", () => {
      expectOneViolation(
        checkAbout(() => (
          <ws.element
            ws:tag="div"
            ws:label="Banner"
            ws:style={css`
              background-image: url(https://example.org/photo.jpg);
            `}
          />
        )),
        '"about"',
        '"Banner"',
        "https://example.org/photo.jpg"
      );
    });
  });

  describe("neutrality", () => {
    test.each(NEUTRALITY_DENY_LIST)("%s in a text is a violation", (word) => {
      expectOneViolation(
        checkAbout(() => (
          <ws.element ws:tag="p">{`Members of the ${word.toUpperCase()} club`}</ws.element>
        )),
        '"about"'
      );
    });

    test.each([
      {
        where: "a placeholder",
        content: () => (
          <ws.element ws:tag="p">
            {new PlaceholderValue("A Republican meeting")}
          </ws.element>
        ),
        about: {},
      },
      {
        where: "a string prop",
        content: () => (
          <ws.element ws:tag="div" aria-label="The Green  Party office" />
        ),
        about: {},
      },
      { where: "the title", content: defaultContent, about: { title: "GOP" } },
      {
        where: "the description",
        content: defaultContent,
        about: { description: "Our Socialist roots" },
      },
    ])("a deny-listed word in $where is a violation", ({ content, about }) => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({ pages: [home, { ...aboutPage(content), ...about }] })
        ),
        '"about"'
      );
    });

    test("a deny-listed word inside another word is not a violation", () => {
      expect(
        checkAbout(() => (
          <ws.element ws:tag="p">
            {"Our magazine on gophers, conservatives and a progressive agenda"}
          </ws.element>
        ))
      ).toEqual([]);
    });
  });

  describe("contrast", () => {
    test("text on base below 4.5:1 is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({ variables: { ...BLANK_CANONICAL_VALUES, text: "#777777" } })
        ),
        "text",
        "base"
      );
    });

    test("base on accent-1 below 4.5:1 is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({
            variables: { ...BLANK_CANONICAL_VALUES, "accent-1": "#999999" },
          })
        ),
        "base",
        "accent-1"
      );
    });

    test("a colour that is not #rrggbb is a violation", () => {
      expectOneViolation(
        checkSiteTemplate(
          fixture({ variables: { ...BLANK_CANONICAL_VALUES, text: "red" } })
        ),
        "text"
      );
    });
  });
});
