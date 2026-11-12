import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

/**
 * Spec 4.3.3.1 and 8: the four Lexical packages the native CMS editor adds
 * resolve from the builder to the version of `lexical` itself.
 *
 * A package is looked up in the node_modules folders above this file, as
 * Node does, but never through NODE_PATH: the test runner's NODE_PATH holds
 * every package of the workspace, so a package the builder does not list
 * would resolve there too.
 */
type Manifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
};

const readManifest = (path: string): Manifest =>
  JSON.parse(readFileSync(path, "utf8"));

const here = dirname(fileURLToPath(import.meta.url));

/** The package.json of `name` in the nearest node_modules that holds it. */
const readNearestManifest = (name: string): Manifest => {
  for (
    let directory = here;
    directory !== dirname(directory);
    directory = dirname(directory)
  ) {
    const path = join(directory, "node_modules", name, "package.json");
    if (existsSync(path)) {
      const manifest = readManifest(realpathSync(path));
      if (manifest.name === name) {
        return manifest;
      }
    }
  }
  throw new Error(`${name} does not resolve from ${here}`);
};

const versionOf = (name: string) => readNearestManifest(name).version;

const added = [
  "@lexical/rich-text",
  "@lexical/list",
  "@lexical/html",
  "@lexical/code",
];

test.each(added)("%s resolves to lexical's version", (name) => {
  expect(versionOf("lexical")).toEqual(expect.any(String));
  expect(versionOf(name)).toBe(versionOf("lexical"));
});

test("the builder lists the four as ^0.21.0, as lexical", () => {
  const builder = readManifest(
    fileURLToPath(new URL("../../../../../package.json", import.meta.url))
  );
  expect(builder.name).toBe("@webstudio-is/builder");
  const dependencies = builder.dependencies ?? {};
  expect(dependencies.lexical).toBe("^0.21.0");
  for (const name of added) {
    expect(dependencies[name]).toBe(dependencies.lexical);
  }
});
