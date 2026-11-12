import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Spec section 8, Theme: the screen's colours are tokens, so it follows the
 * light and dark schemes. The sample content's pictures are field values,
 * not interface colour, so the sample files are left out.
 */
const directory = fileURLToPath(new URL(".", import.meta.url));

const isScreenSource = (name: string) =>
  /\.(ts|tsx)$/.test(name) &&
  name.startsWith("sample-") === false &&
  /\.test\.tsx?$/.test(name) === false;

const literals = [
  { name: "hex", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "rgb()", pattern: /\brgba?\(/ },
  { name: "hsl()", pattern: /\bhsla?\(/ },
];

describe("the native screen's colours", () => {
  const files = readdirSync(directory).filter(isScreenSource);

  test("the check sees the screen's files", () => {
    expect(files).toContain("cms-screen.tsx");
    expect(files).toContain("rich-text-field.tsx");
  });

  test.each(files)("%s has no colour literal", (file) => {
    const source = readFileSync(`${directory}/${file}`, "utf8");
    const found = literals
      .filter(({ pattern }) => pattern.test(source))
      .map(({ name }) => name);
    expect(found).toEqual([]);
  });
});
