import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Spec section 8, Theme: the screen's colours are tokens, so it follows the
 * light and dark schemes. The sample content's pictures are field values,
 * not interface colour, so the sample files are left out.
 */
const directory = fileURLToPath(new URL(".", import.meta.url));

const LITERALS = [/#[0-9a-fA-F]{3,8}\b/, /\brgba?\(/, /\bhsla?\(/];

const isScreenSource = (name: string) =>
  /\.(ts|tsx)$/.test(name) &&
  name.startsWith("sample-") === false &&
  /\.test\.tsx?$/.test(name) === false;

// every .ts and .tsx file under the folder, recursively
const walk = (folder: string): string[] =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(folder, entry.name))
      : isScreenSource(entry.name)
        ? [join(folder, entry.name)]
        : []
  );

const hasLiteral = (line: string) =>
  LITERALS.some((pattern) => pattern.test(line));

describe("the native screen's colours", () => {
  const files = walk(directory).map((file) => relative(directory, file));

  test("finds the screen's files, stories included", () => {
    expect(files).toContain("cms-screen.tsx");
    expect(files).toContain("rich-text-field.tsx");
    expect(files).toContain("cms-screen.stories.tsx");
  });

  test("no colour literal outside tests and sample data", () => {
    const found = files.flatMap((file) =>
      readFileSync(join(directory, file), "utf8")
        .split("\n")
        .flatMap((line, index) =>
          hasLiteral(line) ? [`${file}:${index + 1}`] : []
        )
    );
    expect(found).toEqual([]);
  });

  test.each([
    ['"#fff"', true],
    ['"rgb(0, 0, 0)"', true],
    ['"hsl(0 0% 0%)"', true],
    ['cssVar("--border-default")', false],
    ['"transparent"', false],
    ['"#RRGGBB"', false],
  ])("the matcher on %s: %s", (line, expected) => {
    expect(hasLiteral(line)).toBe(expected);
  });
});
