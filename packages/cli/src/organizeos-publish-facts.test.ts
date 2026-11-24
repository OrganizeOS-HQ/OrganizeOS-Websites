import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  blockComponent,
  blockTemplateComponent,
  collectionComponent,
  type Instance,
  type Prop,
} from "@webstudio-is/sdk";
import { templateIconCodes } from "@organizeos/site-components/org-script";
import {
  assertEmbedFact,
  customCodeCarriesOrgCode,
  findEmbedUses,
  pageCarriesOrgCode,
  writePublishFacts,
} from "./organizeos-publish-facts";
import { createFrameworkComponentRegistry } from "@webstudio-is/sdk-components-registry/framework";
import * as reactRouterComponents from "@webstudio-is/sdk-components-react-router";

const MenuIcon =
  [...templateIconCodes].find((icon) => icon.includes("M2.667 8h10.666")) ?? "";

const instance = (
  id: string,
  component: string,
  children: string[] = []
): [string, Instance] => [
  id,
  {
    type: "instance",
    id,
    component,
    children: children.map((value) => ({ type: "id", value })),
  },
];

const stringCode = (instanceId: string, value: string): [string, Prop] => [
  `${instanceId}:code`,
  { id: `${instanceId}:code`, instanceId, name: "code", type: "string", value },
];

const page = (
  instances: Array<[string, Instance]>,
  props: Array<[string, Prop]> = []
) =>
  pageCarriesOrgCode({
    rootInstanceId: "body",
    instances: new Map(instances),
    props: new Map(props),
  });

describe("pageCarriesOrgCode", () => {
  test("a script embed", () => {
    expect(
      page(
        [instance("body", "Body", ["embed"]), instance("embed", "HtmlEmbed")],
        [stringCode("embed", "<script>1</script>")]
      )
    ).toBe(true);
  });

  test("a bound embed", () => {
    expect(
      page(
        [instance("body", "Body", ["embed"]), instance("embed", "HtmlEmbed")],
        [
          [
            "embed:code",
            {
              id: "embed:code",
              instanceId: "embed",
              name: "code",
              type: "expression",
              value: "$ws$dataSource$html",
            },
          ],
        ]
      )
    ).toBe(true);
  });

  test("a Markdown Embed", () => {
    expect(
      page(
        [
          instance("body", "Body", ["markdown"]),
          instance("markdown", "MarkdownEmbed"),
        ],
        [stringCode("markdown", "# Title")]
      )
    ).toBe(true);
  });

  test("an embed inside a Slot's Fragment", () => {
    expect(
      page(
        [
          instance("body", "Body", ["slot"]),
          instance("slot", "Slot", ["fragment"]),
          instance("fragment", "Fragment", ["embed"]),
          instance("embed", "HtmlEmbed"),
        ],
        [stringCode("embed", "<b>x</b>")]
      )
    ).toBe(true);
  });

  test("an embed inside a Content Block's body", () => {
    expect(
      page(
        [
          instance("body", "Body", ["block"]),
          instance("block", blockComponent, ["templates", "embed"]),
          instance("templates", blockTemplateComponent),
          instance("embed", "HtmlEmbed"),
        ],
        [stringCode("embed", "<b>x</b>")]
      )
    ).toBe(true);
  });

  test("an embed inside a Collection's item", () => {
    expect(
      page(
        [
          instance("body", "Body", ["collection"]),
          instance("collection", collectionComponent, ["item"]),
          instance("item", "Box", ["embed"]),
          instance("embed", "HtmlEmbed"),
        ],
        [stringCode("embed", "<b>x</b>")]
      )
    ).toBe(true);
  });

  test("icons only", () => {
    expect(
      page(
        [
          instance("body", "Body", ["a", "b"]),
          instance("a", "HtmlEmbed"),
          instance("b", "HtmlEmbed"),
        ],
        [stringCode("a", MenuIcon), stringCode("b", [...templateIconCodes][0])]
      )
    ).toBe(false);
  });

  test("JSON-LD only", () => {
    expect(
      page(
        [instance("body", "Body", ["ld"]), instance("ld", "JsonLd")],
        [
          [
            "ld:code",
            {
              id: "ld:code",
              instanceId: "ld",
              name: "code",
              type: "json",
              value: { "@context": "https://schema.org" },
            },
          ],
        ]
      )
    ).toBe(false);
  });

  test("the empty HTML Embed in a Content Block's templates", () => {
    expect(
      page([
        instance("body", "Body", ["block"]),
        instance("block", blockComponent, ["templates"]),
        instance("templates", blockTemplateComponent, ["empty"]),
        instance("empty", "HtmlEmbed"),
      ])
    ).toBe(false);
    // ... and one a content editor put in the templates is not rendered
    expect(
      page(
        [
          instance("body", "Body", ["block"]),
          instance("block", blockComponent, ["templates"]),
          instance("templates", blockTemplateComponent, ["embed"]),
          instance("embed", "HtmlEmbed"),
        ],
        [stringCode("embed", "<script>1</script>")]
      )
    ).toBe(false);
  });

  test("an embed in no page's tree", () => {
    expect(
      page(
        [instance("body", "Body"), instance("orphan", "HtmlEmbed")],
        [stringCode("orphan", "<script>1</script>")]
      )
    ).toBe(false);
  });
});

describe("customCodeCarriesOrgCode", () => {
  test("blank is not org code; anything else is", () => {
    expect(customCodeCarriesOrgCode(" \n")).toBe(false);
    expect(customCodeCarriesOrgCode(undefined)).toBe(false);
    expect(customCodeCarriesOrgCode("<meta name=x>")).toBe(true);
  });
});

const moduleWith = (imports: string, body: string) => `
${imports}
export const Page = () => {
  return <>${body}</>;
};
`;

const components = `import { HtmlEmbed as HtmlEmbed, MarkdownEmbed as MarkdownEmbed, Box as Box } from "@webstudio-is/sdk-components-react/components";`;

describe("findEmbedUses", () => {
  test("an icon embed is not counted", () => {
    expect(
      findEmbedUses(
        moduleWith(
          components,
          `<HtmlEmbed code={${JSON.stringify(MenuIcon)}} className={\`w-html-embed\`} />`
        )
      )
    ).toEqual({ htmlEmbeds: 0, markdownEmbeds: 0 });
  });

  test("an embed of markup, or bound, is counted", () => {
    expect(
      findEmbedUses(moduleWith(components, `<HtmlEmbed code={"<p>x</p>"} />`))
    ).toEqual({ htmlEmbeds: 1, markdownEmbeds: 0 });
    expect(
      findEmbedUses(moduleWith(components, `<HtmlEmbed code={x} />`))
    ).toEqual({ htmlEmbeds: 1, markdownEmbeds: 0 });
    expect(
      findEmbedUses(moduleWith(components, `<MarkdownEmbed code={"# x"} />`))
    ).toEqual({ htmlEmbeds: 0, markdownEmbeds: 1 });
  });

  test("an aliased import is followed", () => {
    expect(
      findEmbedUses(
        moduleWith(
          `import { HtmlEmbed as HtmlEmbed_1 } from "@webstudio-is/sdk-components-react/components";`,
          `<HtmlEmbed_1 code={"<p>x</p>"} />`
        )
      )
    ).toEqual({ htmlEmbeds: 1, markdownEmbeds: 0 });
  });

  test("the same import from another source is followed", () => {
    expect(
      findEmbedUses(
        moduleWith(
          `import { HtmlEmbed } from "@other/components";`,
          `<HtmlEmbed code={"<p>x</p>"} />`
        )
      )
    ).toEqual({ htmlEmbeds: 1, markdownEmbeds: 0 });
  });

  test("an alias of an icon embed counts", () => {
    expect(
      findEmbedUses(
        `${components}
const E = HtmlEmbed;
export const Page = () => <E code={${JSON.stringify(MenuIcon)}} />;`
      )
    ).toEqual({ htmlEmbeds: 1, markdownEmbeds: 0 });
  });

  test("an icon embed with a second code, or a spread, counts", () => {
    expect(
      findEmbedUses(
        moduleWith(
          components,
          `<HtmlEmbed code={${JSON.stringify(MenuIcon)}} {...x} />`
        )
      ).htmlEmbeds
    ).toBe(1);
  });

  test("the framework imports HtmlEmbed and MarkdownEmbed from the source the tripwire was written against", async () => {
    // as framework-react-router.ts builds its components
    const framework = createFrameworkComponentRegistry({
      routerComponents: reactRouterComponents,
      routerComponentPackage: "@webstudio-is/sdk-components-react-router",
    });
    expect(framework.components.HtmlEmbed).toBe(
      "@webstudio-is/sdk-components-react/components:HtmlEmbed"
    );
    expect(framework.components.MarkdownEmbed).toBe(
      "@webstudio-is/sdk-components-react/components:MarkdownEmbed"
    );
  });
});

describe("assertEmbedFact", () => {
  const module = moduleWith(components, `<HtmlEmbed code={"<p/>"} />`);

  test("refuses a module that renders an embed against a false fact", async () => {
    await expect(assertEmbedFact(false, module, "page.tsx")).rejects.toThrow(
      "The generated module page.tsx renders an embed, and the publish facts say it carries no org code. Nothing was published."
    );
  });

  test("passes it against a true fact", async () => {
    await expect(assertEmbedFact(true, module, "page.tsx")).resolves.toBe(
      undefined
    );
  });
});

describe("writePublishFacts", () => {
  test("writes the JSON and leaves no temporary file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "organizeos-facts-"));
    try {
      const file = join(directory, "facts.json");
      await writePublishFacts(file, { orgScript: true });
      await expect(readFile(file, "utf8")).resolves.toBe('{"orgScript":true}');
      await expect(readdir(directory)).resolves.toEqual(["facts.json"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
