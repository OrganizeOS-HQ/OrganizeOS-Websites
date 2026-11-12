// OrganizeOS fork: the Variables registry (docs/ORGANIZEOS-FORK.md section 7)
import { expect, test } from "vitest";
import { readVariablesRegistry } from "./organizeos-variables";
import { parseProjectSettings } from "./project-settings";

const registry = {
  version: 1,
  collections: [
    { id: "site", name: "Site", system: "site" },
    { id: "c1", name: "Spacing" },
  ],
  variables: [
    {
      cssName: "brand-blue",
      collectionId: "site",
      type: "color",
      name: "Brand Blue",
    },
  ],
};

const settings = (organizeos: unknown) => ({
  meta: {},
  compiler: {},
  organizeos,
});

test("parseProjectSettings keeps organizeos through a round trip", () => {
  const parsed = parseProjectSettings(settings({ variables: registry }));
  expect(parsed.organizeos).toEqual({ variables: registry });
  expect(parseProjectSettings(JSON.parse(JSON.stringify(parsed)))).toEqual(
    parsed
  );
});

test("absent: no organizeos, or no variables in it", () => {
  expect(readVariablesRegistry(undefined)).toEqual({ status: "absent" });
  expect(readVariablesRegistry({ other: 1 })).toEqual({ status: "absent" });
});

test("readable: version 1, valid", () => {
  expect(readVariablesRegistry({ variables: registry })).toEqual({
    status: "readable",
    registry,
  });
});

test.each([
  ["version 2", { variables: { ...registry, version: 2 } }],
  [
    "an invalid shape",
    {
      variables: {
        ...registry,
        variables: [
          { cssName: "x", collectionId: "site", type: "angle", name: "X" },
        ],
      },
    },
  ],
  ["variables not an object", { variables: "registry" }],
  ["organizeos not an object", "organizeos"],
])("unreadable: %s, and a load never throws", (_, organizeos) => {
  expect(readVariablesRegistry(organizeos)).toEqual({ status: "unreadable" });
  expect(() => parseProjectSettings(settings(organizeos))).not.toThrow();
});

test("unknown keys survive at every level", () => {
  const later = {
    ...registry,
    modes: [],
    brandLinks: {},
    collections: [{ ...registry.collections[0], tint: "x" }],
    variables: [{ ...registry.variables[0], detached: true }],
  };
  expect(readVariablesRegistry({ variables: later })).toEqual({
    status: "readable",
    registry: later,
  });
});

test("arrays are kept as stored: duplicates, stale entries, unknown collections", () => {
  const variables = [
    registry.variables[0],
    registry.variables[0],
    { cssName: "gone", collectionId: "nowhere", type: "size", name: "Gone" },
  ];
  expect(
    readVariablesRegistry({ variables: { ...registry, variables } })
  ).toEqual({ status: "readable", registry: { ...registry, variables } });
});
