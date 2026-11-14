import { describe, expect, test } from "vitest";
import { css, ws } from "@webstudio-is/template";
import { NEUTRAL_LOOK } from "./look";
import { renderStarterPage } from "./render";
import type { StarterPage } from "./types";
import { sampleStarterPage } from "./__fixtures__/sample";

const render = (page: StarterPage, look = NEUTRAL_LOOK) =>
  renderStarterPage(page, { look, generatePageId: () => "page:1" });

describe("renderStarterPage", () => {
  test("renders the body with its placements under a look", () => {
    const rendered = render(sampleStarterPage);
    expect(rendered).toMatchObject({
      key: "sample",
      pageId: "page:1",
      name: "Sample",
      path: "/sample",
      title: "Sample",
    });
    expect(rendered.fragment.children).toHaveLength(1);
    const [root] = rendered.fragment.children;
    const body = rendered.fragment.instances.find(
      (instance) => root.type === "id" && instance.id === root.value
    );
    expect(body?.tag).toBe("body");
    expect(rendered.placements).toEqual([
      { key: "@organizeos/site-components:SignupForm", rootId: "signup" },
    ]);
  });

  test("a look reaches the body", () => {
    const page: StarterPage = {
      ...sampleStarterPage,
      body: ({ look }) => (
        <ws.element ws:tag="body">
          <ws.element
            ws:tag="section"
            ws:label="About"
            ws:style={css`
              border-top-left-radius: ${look.buttonRadius};
            `}
          >
            <ws.element ws:tag="h1">{"About"}</ws.element>
          </ws.element>
        </ws.element>
      ),
    };
    const radius = (look = NEUTRAL_LOOK) =>
      render(page, look).fragment.styles.find(
        (decl) => decl.property === "borderTopLeftRadius"
      )?.value;
    expect(radius({ ...NEUTRAL_LOOK, buttonRadius: "0px" })).toEqual({
      type: "unit",
      unit: "px",
      value: 0,
    });
    expect(radius()).toEqual({ type: "unit", unit: "px", value: 6 });
  });

  test("image() leaves the src out", () => {
    const { fragment } = render(sampleStarterPage);
    // $.Image renders as the component "Image" (shared/proxy.ts)
    const image = fragment.instances.find(
      (instance) => instance.component === "Image"
    );
    expect(image).toBeDefined();
    const names = fragment.props
      .filter((prop) => prop.instanceId === image?.id)
      .map((prop) => prop.name);
    expect(names).toContain("alt");
    expect(names).not.toContain("src");
  });
});
