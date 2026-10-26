/**
 * @vitest-environment jsdom
 */
import { createRef, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ReactSdkContext } from "@webstudio-is/react-sdk/runtime";
import { canPlayOnCanvasProperty } from "../animate/flag";
import { ConvergenceField } from "./convergence-field";
import { ARM_CENTRE_TRANSFORM, ARM_HEIGHT, ARM_PATH, LEVELS } from "./generate";
import { fixtureCase, type FixtureCase } from "./read-fixture";
import { shapeNames } from "./shape";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const Sdk = ({
  children,
  renderer,
}: {
  children: ReactNode;
  renderer?: "canvas" | "preview";
}) => (
  <ReactSdkContext.Provider
    value={{
      assetBaseUrl: "/",
      imageLoader: ({ src }) => src,
      resources: {},
      breakpoints: [],
      onError: () => {},
      renderer,
    }}
  >
    {children}
  </ReactSdkContext.Provider>
);

/** The page's markup as the server renders it, parsed into a container. */
const serverRender = (node: ReactNode) => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<Sdk>{node}</Sdk>);
  return container;
};

const svgOf = (container: Element) => {
  const svg = container.querySelector("svg");
  if (svg === null) {
    throw new Error("no svg");
  }
  return svg;
};

/** The svg's own `g` children: one per fade level. */
const levelGroupsOf = (container: Element) =>
  [...svgOf(container).children].filter((child) => child.tagName === "g");

/** The arm `use`s in document order: level by level, as the fixture's order within. */
const usesOf = (container: Element) =>
  levelGroupsOf(container)
    .flatMap((group) => [...group.querySelectorAll("use")])
    .map((use) => ({
      href: use.getAttribute("href"),
      transform: use.getAttribute("transform"),
    }));

const expectedTransform = ([x, y, deg, size]: FixtureCase["arms"][number]) =>
  `translate(${x} ${y}) rotate(${deg}) scale(${(size / ARM_HEIGHT).toFixed(3)})`;

/** The fixture's arms in the order the field draws them: by level. */
const byLevel = (item: FixtureCase) =>
  Array.from({ length: LEVELS }, (_, index) =>
    item.arms.filter((arm) => arm[4] === index + 1)
  ).flat();

const groupIds = (container: Element) => {
  const groups = [...svgOf(container).querySelectorAll("defs > g")];
  return groups.map((group) => group.id);
};

describe("the server render", () => {
  test("a div holding the decorative svg, then the children", () => {
    const container = serverRender(
      <ConvergenceField id="hero" className="band" data-test="root">
        <p>Content</p>
      </ConvergenceField>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe("DIV");
    expect(root.id).toBe("hero");
    expect(root.className).toBe("band");
    expect(root.dataset.test).toBe("root");
    expect(
      [...root.children].map((child) => child.tagName.toLowerCase())
    ).toEqual(["svg", "p"]);
    const svg = svgOf(container);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid slice");
    expect(svg.getAttribute("viewBox")).toBe("0 0 1800 600");
    expect(svg.getAttribute("style")).toBe(
      "position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none"
    );
  });

  test("one g per fade level, each mixing the outer color into the inner one", () => {
    const container = serverRender(<ConvergenceField />);
    const levels = levelGroupsOf(container);
    expect(levels).toHaveLength(LEVELS);
    expect(levels.map((level) => level.getAttribute("opacity"))).toEqual([
      "0.37",
      "0.48",
      "0.6",
      "0.72",
      "0.83",
      "0.95",
    ]);
    expect(levels[0].getAttribute("style")).toBe(
      "fill:color-mix(in srgb, #F4EFE6 17%, #3FC9E0)"
    );
    expect(levels[5].getAttribute("style")).toBe(
      "fill:color-mix(in srgb, #F4EFE6 100%, #3FC9E0)"
    );
  });

  test("two arm groups in defs, each the centred arm path, turned by the settle property", () => {
    const container = serverRender(<ConvergenceField />);
    const groups = [...svgOf(container).querySelectorAll("defs > g")];
    expect(groups).toHaveLength(2);
    const [plus, minus] = groups;
    expect(plus.id).toMatch(/-arm-plus$/);
    expect(minus.id).toBe(plus.id.replace(/-arm-plus$/, "-arm-minus"));
    expect(plus.getAttribute("style")).toBe(
      "rotate:calc(var(--os-field-settle) * 45deg)"
    );
    expect(minus.getAttribute("style")).toBe(
      "rotate:calc(var(--os-field-settle) * -45deg)"
    );
    for (const group of groups) {
      expect(group.children).toHaveLength(1);
      const path = group.firstElementChild as Element;
      expect(path.tagName).toBe("path");
      expect(path.getAttribute("d")).toBe(ARM_PATH);
      expect(path.getAttribute("transform")).toBe(ARM_CENTRE_TRANSFORM);
      expect(path.getAttribute("transform")).toBe("translate(-21.8 -64.165)");
    }
  });

  test("with no props it draws exactly the fixture's default-band case, in the homepage's transforms", () => {
    const item = fixtureCase("default-band");
    const uses = usesOf(serverRender(<ConvergenceField />));
    expect(uses.map((use) => use.transform)).toEqual(
      byLevel(item).map(expectedTransform)
    );
  });

  test.each(shapeNames)(
    "the defaults on %s draw exactly the fixture's default case",
    (shape) => {
      const item = fixtureCase(`default-${shape.toLowerCase()}`);
      const uses = usesOf(serverRender(<ConvergenceField shape={shape} />));
      expect(uses.map((use) => use.transform)).toEqual(
        byLevel(item).map(expectedTransform)
      );
    }
  );

  test("each arm references the plus or minus group by the parity of its grid offset (i + j)", () => {
    const item = fixtureCase("wide-focus-10-10");
    const container = serverRender(
      <ConvergenceField shape="Wide" focusX={10} focusY={10} />
    );
    const [plusId, minusId] = groupIds(container);
    const uses = usesOf(container);
    const arms = byLevel(item);
    expect(uses).toHaveLength(arms.length);
    const expected = arms.map(([x, y]) => {
      const i = (x - item.focus.x) / item.spacing;
      const j = (y - item.focus.y) / item.spacing;
      expect(Number.isInteger(i) && Number.isInteger(j)).toBe(true);
      return (i + j) % 2 === 0 ? `#${plusId}` : `#${minusId}`;
    });
    expect(uses.map((use) => use.href)).toEqual(expected);
    // both groups are used
    expect(new Set(expected).size).toBe(2);
  });

  test("the props reach the generator through the clamps", () => {
    const item = fixtureCase("wide-density-24");
    const uses = usesOf(
      serverRender(<ConvergenceField shape="Wide" density={10} />)
    );
    expect(uses).toHaveLength(item.arms.length);
    expect(uses.map((use) => use.transform)).toEqual(
      byLevel(item).map(expectedTransform)
    );
  });

  test("the colors reach only the levels' fill style, and an unsafe one falls back", () => {
    const container = serverRender(
      <ConvergenceField
        innerColor="var(--brand-inner, #123456)"
        outerColor="red; background: url(x)"
      />
    );
    const html = container.innerHTML;
    expect(html).not.toContain("url(x)");
    expect(html).not.toContain("background");
    const levels = levelGroupsOf(container);
    expect(levels[2].getAttribute("style")).toBe(
      "fill:color-mix(in srgb, #F4EFE6 50%, var(--brand-inner, #123456))"
    );
    expect(html.split("--brand-inner")).toHaveLength(LEVELS + 1);
    // not on the root
    expect(
      (container.firstElementChild as HTMLElement).getAttribute("style")
    ).toBeNull();
  });

  test("the field props and the play flag never land on the div", () => {
    const container = serverRender(
      <ConvergenceField
        shape="Wide"
        density={40}
        focusX={50}
        focusY={50}
        zoneWidth={60}
        zoneHeight={50}
        innerColor="#000"
        outerColor="#fff"
        motion="Settle"
        {...{ [canPlayOnCanvasProperty]: true }}
      />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttributeNames()).toEqual([]);
  });

  test("two fields on one page have distinct ids, and each references its own", () => {
    const container = serverRender(
      <>
        <ConvergenceField />
        <ConvergenceField />
      </>
    );
    const svgs = [...container.querySelectorAll("svg")];
    expect(svgs).toHaveLength(2);
    const ids = svgs.map((svg) =>
      [...svg.querySelectorAll("defs > g")].map((group) => group.id)
    );
    expect(new Set(ids.flat()).size).toBe(4);
    svgs.forEach((svg, index) => {
      const hrefs = new Set(
        [...svg.querySelectorAll("use")].map((use) => use.getAttribute("href"))
      );
      expect([...hrefs].sort()).toEqual(
        ids[index].map((id) => `#${id}`).sort()
      );
    });
  });
});

describe("in the browser", () => {
  test("forwards its ref to the div", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Sdk>
        <ConvergenceField ref={ref} />
      </Sdk>
    );
    expect(ref.current?.tagName).toBe("DIV");
    expect(ref.current?.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  test("on the canvas it draws the same static field", () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      <Sdk renderer="canvas">
        <ConvergenceField />
      </Sdk>,
      { container }
    );
    expect(usesOf(container).map((use) => use.transform)).toEqual(
      byLevel(fixtureCase("default-band")).map(expectedTransform)
    );
  });

  // The page is rendered to HTML when it is published and hydrated in the
  // visitor's browser: the two must agree, or React discards the server's
  // markup (spec invariant 2).
  test("the markup the server made hydrates without a mismatch", async () => {
    const Page = () => (
      <Sdk>
        <ConvergenceField shape="Wide" innerColor="var(--inner)">
          <h2>Heading</h2>
        </ConvergenceField>
        <ConvergenceField shape="Tall" focusX={30}>
          <p>Text</p>
        </ConvergenceField>
      </Sdk>
    );
    const consoleError = vi.spyOn(console, "error");
    const container = document.createElement("div");
    document.body.append(container);
    container.innerHTML = renderToString(<Page />);
    const serverHtml = container.innerHTML;
    expect(container.querySelectorAll("use").length).toBeGreaterThan(0);

    await act(async () => {
      hydrateRoot(container, <Page />);
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe(serverHtml);
  });
});
