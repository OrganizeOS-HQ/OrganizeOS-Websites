import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import fixture from "./__fixtures__/rich-text-roundtrip.json";

/**
 * The read-only check runs copies of the platform's rich-text-nodes.ts and
 * sanitiser on the platform's sanitize-html, htmlparser2 and entities. The
 * shared round-trip fixture pins all of them; the platform checks its own
 * against the same pins.
 *
 * A package is looked up in the node_modules folders above a directory, as
 * Node does, never through NODE_PATH (which holds every workspace package).
 */
const here = dirname(fileURLToPath(import.meta.url));
const pins = (fixture as unknown as { pins: Record<string, string> }).pins;

const resolveFrom = (from: string, name: string) => {
  for (
    let directory = from;
    directory !== dirname(directory);
    directory = dirname(directory)
  ) {
    const path = join(directory, "node_modules", name, "package.json");
    if (existsSync(path)) {
      const real = realpathSync(path);
      return {
        version: (JSON.parse(readFileSync(real, "utf8")) as { version: string })
          .version,
        directory: dirname(real),
      };
    }
  }
  throw new Error(`${name} does not resolve from ${from}`);
};

test("sanitize-html, htmlparser2 and entities resolve to the pinned versions", () => {
  const sanitize = resolveFrom(here, "sanitize-html");
  const parser = resolveFrom(sanitize.directory, "htmlparser2");
  expect(sanitize.version).toBe(pins["sanitize-html"]);
  expect(parser.version).toBe(pins.htmlparser2);
  expect(resolveFrom(here, "htmlparser2").version).toBe(pins.htmlparser2);
  expect(resolveFrom(parser.directory, "entities").version).toBe(pins.entities);
});

test("the copies of rich-text-nodes.ts and the sanitiser are the platform's", () => {
  const sha = (data: string | Buffer) =>
    createHash("sha256").update(data).digest("hex");
  expect(sha(readFileSync(join(here, "rich-text-nodes.ts")))).toBe(
    pins["rich-text-nodes.ts"]
  );
  const lines = readFileSync(join(here, "rich-text-sanitize.ts"), "utf8").split(
    "\n"
  );
  const from = lines.findIndex((line) =>
    line.startsWith("export const RICH_TEXT_ALLOWED_TAGS")
  );
  const fn = lines.findIndex((line) =>
    line.startsWith("export function sanitizeRichTextHtml")
  );
  const to = lines.findIndex((line, index) => index > fn && line === "}");
  const region = lines
    .slice(from, to + 1)
    .filter((line) => /^\s*(\/\/|\/\*\*|\*|\*\/)/.test(line) === false)
    .join("\n");
  expect(sha(region)).toBe(pins.sanitizer);
});
