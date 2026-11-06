import { describe, expect, test } from "vitest";
import { css, renderTemplate, token, ws } from "@webstudio-is/template";
import { localStylesFirst } from "./style-order";

const first = token(
  "OS First",
  css`
    color: red;
  `
);
const second = token(
  "OS Second",
  css`
    color: blue;
  `
);

const fragment = () =>
  renderTemplate(
    <ws.element ws:tag="div" ws:id="styled">
      <ws.element
        ws:tag="p"
        ws:id="both"
        ws:tokens={[first, second]}
        ws:style={css`
          color: green;
        `}
      />
      <ws.element ws:tag="p" ws:id="tokens" ws:tokens={[second, first]} />
      <ws.element
        ws:tag="p"
        ws:id="local"
        ws:style={css`
          margin: 0;
        `}
      />
    </ws.element>
  );

const valuesOf = (
  source: ReturnType<typeof fragment>,
  instanceId: string
): string[] => {
  const id = source.instances.find(
    (instance) => instance.id === instanceId || instance.id.endsWith(instanceId)
  )?.id;
  const names = new Map(
    source.styleSources.map((styleSource) => [
      styleSource.id,
      styleSource.type === "token" ? styleSource.name : "local",
    ])
  );
  return (
    source.styleSourceSelections
      .find((selection) => selection.instanceId === id)
      ?.values.map((value) => names.get(value) ?? value) ?? []
  );
};

describe("localStylesFirst", () => {
  test("0.309.0's renderer lists a selection's tokens before its local styles", () => {
    expect(valuesOf(fragment(), "both")).toEqual([
      "OS First",
      "OS Second",
      "local",
    ]);
  });

  test("moves the local styles ahead of the tokens, and keeps the tokens' order", () => {
    const ordered = localStylesFirst(fragment());
    expect(valuesOf(ordered, "both")).toEqual([
      "local",
      "OS First",
      "OS Second",
    ]);
    expect(valuesOf(ordered, "tokens")).toEqual(["OS Second", "OS First"]);
    expect(valuesOf(ordered, "local")).toEqual(["local"]);
  });

  test("changes nothing else, nor its input, and twice is once", () => {
    const input = fragment();
    const before = structuredClone(input);
    const ordered = localStylesFirst(input);
    expect(input).toEqual(before);
    expect({ ...ordered, styleSourceSelections: [] }).toEqual({
      ...input,
      styleSourceSelections: [],
    });
    expect(localStylesFirst(ordered)).toEqual(ordered);
  });
});
