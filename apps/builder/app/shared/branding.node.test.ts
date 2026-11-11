import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * OrganizeOS plans are org entitlements resolved by OrganizeOS, never a
 * checkout in the builder (branding.ts, owner decision D4). So no shipped
 * builder, design-system or server file links Webstudio's pricing page or
 * names a Webstudio plan; a plan-gated control says `planBadgeLabel` alone,
 * with no sentence pointing at a plan page. Upstream merges bring such copy back, and this
 * fails on it with each file and line.
 */
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

/** The trees read for plan copy, each with one file it must hold. */
const trees = [
  ["apps/builder/app", "apps/builder/app/shared/branding.ts"],
  [
    "packages/design-system/src",
    "packages/design-system/src/components/pro-chip.tsx",
  ],
  ["packages/project-build/src", "packages/project-build/src/db/build.ts"],
  ["packages/domain/src", "packages/domain/src/db/domain.ts"],
  ["packages/project/src", "packages/project/src/db/build-patch-core.ts"],
] as const;

/**
 * The part of TypeScript's compiler API that finds comments. The builder's own
 * typescript (7, the native compiler) has no JavaScript API, so it comes from
 * packages/generate-arg-types, which pins typescript 5 for
 * react-docgen-typescript. If that pin goes, the require finds another
 * typescript (the root's 7), so the load checks what it got and throws, naming
 * the cause.
 */
type Token = {
  kind: number;
  pos: number;
  getChildren: (sourceFile: Token) => Token[];
};
type CommentRange = { pos: number; end: number };
type TypeScript = {
  createSourceFile: (
    fileName: string,
    text: string,
    target: number,
    setParentNodes: boolean,
    scriptKind: number
  ) => Token;
  getLeadingCommentRanges: (
    text: string,
    pos: number
  ) => CommentRange[] | undefined;
  getTrailingCommentRanges: (
    text: string,
    pos: number
  ) => CommentRange[] | undefined;
  version: string;
  ScriptTarget: { Latest: number };
  ScriptKind: { TS: number; TSX: number };
  SyntaxKind: {
    JsxText: number;
    JsxTextAllWhiteSpaces: number;
    FirstJSDocNode: number;
    LastJSDocNode: number;
  };
};
const loadTypeScript = (packageJson: string) => {
  const loaded = createRequire(join(repositoryRoot, packageJson))(
    "typescript"
  ) as Partial<TypeScript>;
  if (
    typeof loaded.createSourceFile !== "function" ||
    String(loaded.version).startsWith("5.") === false
  ) {
    throw new Error(
      `The plan guard needs TypeScript 5's compiler API, from the typescript that ${packageJson} pins; it found typescript ${String(loaded.version)}, without createSourceFile.`
    );
  }
  return loaded as TypeScript;
};
const ts = loadTypeScript("packages/generate-arg-types/package.json");

const isShipped = (path: string) =>
  /\.(ts|tsx)$/.test(path) &&
  /\.(test|spec)\.[^/]+$/.test(path) === false &&
  path.endsWith(".stories.tsx") === false &&
  /(^|\/)(__generated__|__fixtures__|node_modules)\//.test(path) === false;

const listFiles = (directory: string): string[] =>
  readdirSync(join(repositoryRoot, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "node_modules" ? [] : listFiles(path);
      }
      return isShipped(path) ? [path] : [];
    }
  );

/**
 * The source with its comments blanked, line breaks kept, so a hit's line is
 * the line in the file. The comments are the ones TypeScript's parser finds in
 * the trivia between tokens: a "/*" in a string, a template, a regular
 * expression or JSX text is not one.
 */
const blankComments = (path: string, source: string) => {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const ranges = new Map<string, CommentRange>();
  const isJSDoc = (node: Token) =>
    node.kind >= ts.SyntaxKind.FirstJSDocNode &&
    node.kind <= ts.SyntaxKind.LastJSDocNode;
  const visit = (node: Token) => {
    // A doc comment is parsed onto the node after it, the end of the file
    // included, as children; its text is in that token's trivia, read below
    const children = node
      .getChildren(sourceFile)
      .filter((child) => isJSDoc(child) === false);
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }
    // JSX text holds no trivia: its "/*" is text
    if (
      node.kind === ts.SyntaxKind.JsxText ||
      node.kind === ts.SyntaxKind.JsxTextAllWhiteSpaces
    ) {
      return;
    }
    for (const range of [
      ...(ts.getLeadingCommentRanges(source, node.pos) ?? []),
      ...(ts.getTrailingCommentRanges(source, node.pos) ?? []),
    ]) {
      ranges.set(`${range.pos}:${range.end}`, range);
    }
  };
  visit(sourceFile);
  let blanked = source;
  for (const { pos, end } of ranges.values()) {
    blanked =
      blanked.slice(0, pos) +
      blanked.slice(pos, end).replace(/[^\n]/g, " ") +
      blanked.slice(end);
  }
  return blanked;
};

const pricingPattern = /webstudio\.is\/pricing/;

const planPatterns = [
  /Webstudio\s+Cloud/,
  /upgrade to (a |the )?(Pro|Team)\b/i,
  /\b(Pro|Team)\s+plan\b/i,
  /must have a Pro plan/i,
  /\bPro(\s+\w+)?\s+features?\b/i,
  /\brequires? Pro\b/i,
  /<(Pro)?Chip\b[^>]*>\s*Pro\s*<\/(Pro)?Chip>/i,
];

/**
 * The lines that name Webstudio's service only to replace it: each holds a
 * runtime package's own message, matched where the builder shows something
 * else. A line is allowed by its file and its whole text, so any other copy in
 * that file still fails.
 */
const replacedRuntimeCopy = [
  {
    // packages/sdk/src/schema/response-headers.ts's platform-header message
    path: "apps/builder/app/shared/project-settings/section-headers.tsx",
    line: 'message === "This header is managed by Webstudio Cloud"',
  },
];

const isReplacedRuntimeCopy = (path: string, lineText: string) =>
  replacedRuntimeCopy.some(
    (allowed) => allowed.path === path && allowed.line === lineText.trim()
  );

// Blanking a comment can only remove these words, never make them, so a file
// without them needs no parse
const mayNamePlan = /webstudio|\b(pro|team)\b/i;

const findHitsInSource = (
  path: string,
  source: string,
  patterns: RegExp[],
  { comments }: { comments: "kept" | "blanked" }
) => {
  if (comments === "blanked" && mayNamePlan.test(source) === false) {
    return [];
  }
  const text = comments === "blanked" ? blankComments(path, source) : source;
  const lines = source.split("\n");
  return patterns.flatMap((pattern) =>
    Array.from(
      text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`)),
      (match) => {
        const line = text.slice(0, match.index).split("\n").length;
        return isReplacedRuntimeCopy(path, lines[line - 1])
          ? []
          : [`${path}:${line} ${match[0]}`];
      }
    ).flat()
  );
};

const findHits = (
  patterns: RegExp[],
  options: { comments: "kept" | "blanked" }
) =>
  trees.flatMap(([directory]) =>
    listFiles(directory).flatMap((path) =>
      findHitsInSource(
        path,
        readFileSync(join(repositoryRoot, path), "utf8"),
        patterns,
        options
      )
    )
  );

// Parsing about a thousand files takes a few seconds
const timeout = 60_000;

describe("the builder sells no Webstudio plan", () => {
  // The pricing address is never a word of a comment either, so the raw
  // source is read
  test(
    "no shipped builder file links webstudio.is/pricing",
    () => {
      expect(findHits([pricingPattern], { comments: "kept" })).toEqual([]);
    },
    timeout
  );

  test(
    "no shipped builder file names a Webstudio plan",
    () => {
      expect(findHits(planPatterns, { comments: "blanked" })).toEqual([]);
    },
    timeout
  );
});

// A guard that reads nothing, or reads the wrong thing, passes for nothing
describe("the plan guard itself", () => {
  test.each(trees)("reads %s", (directory, known) => {
    const files = listFiles(directory);
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(known);
    expect(files).not.toContain(
      "apps/builder/app/shared/branding.node.test.ts"
    );
  });

  test("loads TypeScript 5, and names the cause when it finds another", () => {
    expect(ts.version).toMatch(/^5\./);
    // the builder's own typescript is 7, without the JavaScript API
    expect(() => loadTypeScript("apps/builder/package.json")).toThrow(
      /needs TypeScript 5's compiler API, from the typescript that apps\/builder\/package\.json pins; it found typescript 7\./
    );
  });

  test("blanks only comments, keeping every line", () => {
    const source = [
      'const routes = ["/*", "/"]; // Upgrade to PRO',
      'const field = <input accept="image/*" />;',
      "const pattern = /a\\/*b/;",
      "const text = `a /* kept ${/* gone */ 1} */`;",
      "const element = (",
      "  <Text>",
      "    /* JSX text, kept */",
      "    {/* gone */}",
      "  </Text>",
      ");",
      "/** gone */",
      "export const last = 1; /* gone */",
      "/** a doc comment that ends the file, gone */",
    ].join("\n");
    const blanked = blankComments("planted.tsx", source);
    expect(blanked.split("\n")).toHaveLength(source.split("\n").length);
    expect(blanked).not.toContain("gone");
    expect(blanked).not.toContain("Upgrade to PRO");
    expect(blanked).toContain('["/*", "/"]');
    expect(blanked).toContain('accept="image/*"');
    expect(blanked).toContain("/a\\/*b/");
    expect(blanked).toContain("`a /* kept ${");
    expect(blanked).toContain("/* JSX text, kept */");
  });

  test('finds a pricing link and a plan badge after a "/*" route, before a later marker', () => {
    const source = [
      'const routes = ["/*"];',
      'const upgrade = "https://webstudio.is/pricing";',
      "export const Badge = () => (",
      "  <>",
      "    <ProChip>Pro</ProChip>",
      "    {/* OrganizeOS fork: a later marker */}",
      "  </>",
      ");",
    ].join("\n");
    expect(
      findHitsInSource("planted.tsx", source, [pricingPattern], {
        comments: "kept",
      })
    ).toEqual(["planted.tsx:2 webstudio.is/pricing"]);
    expect(
      findHitsInSource("planted.tsx", source, planPatterns, {
        comments: "blanked",
      })
    ).toEqual(["planted.tsx:5 <ProChip>Pro</ProChip>"]);
  });

  test('finds plan copy after an accept="image/*", before a later doc comment', () => {
    const source = [
      'export const Field = () => <input accept="image/*" />;',
      'const note = "Webstudio Cloud supplies it";',
      "/** a later doc comment */",
      "export const later = note;",
    ].join("\n");
    expect(
      findHitsInSource("planted.tsx", source, planPatterns, {
        comments: "blanked",
      })
    ).toEqual(["planted.tsx:2 Webstudio Cloud"]);
  });

  // Upstream 0.309.0's own spellings
  test.each([
    "<ProChip>PRO</ProChip>",
    "<ProChip>Pro</ProChip>",
    "<ProChip css={{ marginLeft: 4 }}>Pro</ProChip>",
    "<Chip>Pro</Chip>",
    "Redirects are a Pro publishing feature.",
    "Custom headers are a Pro feature.",
    "Following Pro features are used:",
    "Upgrade to a Pro account to publish.",
    "Please upgrade to the Pro plan or higher.",
    "Upgrade to PRO to customize the contact email.",
    "The link's author must have a Pro plan.",
    "Custom headers on a custom domain require Pro.",
    "Webstudio\n      Cloud supplies CSP",
    "Sharing links over insecure channels can expose project access. Upgrade to\n      the Team plan for safer collaboration.",
    "Realtime collaboration is available on the Team plan.",
  ])("finds %j", (copy) => {
    const source = `export const Copy = () => (\n  <Text>\n    ${copy}\n  </Text>\n);\nexport const copy = \`${copy}\`;\n`;
    // the copy as JSX text from line 3, and in a template string after it
    const extra = copy.split("\n").length - 1;
    const lines = findHitsInSource("planted.tsx", source, planPatterns, {
      comments: "blanked",
    }).map((hit) => Number(hit.match(/^planted\.tsx:(\d+) /)?.[1]));
    const inJsx = (line: number) => line >= 3 && line <= 3 + extra;
    const inTemplate = (line: number) =>
      line >= 6 + extra && line <= 6 + 2 * extra;
    expect(lines.some(inJsx), "as JSX text").toBe(true);
    expect(lines.some(inTemplate), "in a template").toBe(true);
    expect(lines.every((line) => inJsx(line) || inTemplate(line))).toBe(true);
  });

  test("allows a replaced runtime message only on its own line in its own file", () => {
    for (const { path, line } of replacedRuntimeCopy) {
      // the line is still there, so the entry cannot outlive it
      expect(
        readFileSync(join(repositoryRoot, path), "utf8")
          .split("\n")
          .map((text) => text.trim())
      ).toContain(line);
      const planted = `const a = (message: string) =>\n  ${line}\n    ? "the platform"\n    : message;\nconst b = "Webstudio Cloud";\n`;
      expect(
        findHitsInSource(path, planted, planPatterns, { comments: "blanked" })
      ).toEqual([`${path}:5 Webstudio Cloud`]);
      expect(
        findHitsInSource("elsewhere.ts", planted, planPatterns, {
          comments: "blanked",
        })
      ).toHaveLength(2);
    }
  });

  test("finds nothing in comments, or in words that only start with Pro", () => {
    const source = [
      "// Upgrade to PRO",
      "/* a Pro feature, Webstudio Cloud */",
      "export const Copy = () => (",
      "  <Text>",
      "    {/* <ProChip>Pro</ProChip> */}",
      "    Project settings, Preview, Production, Provider, Progress",
      "    <ProChip>Not in plan</ProChip>",
      "  </Text>",
      ");",
    ].join("\n");
    expect(
      findHitsInSource("planted.tsx", source, planPatterns, {
        comments: "blanked",
      })
    ).toEqual([]);
  });
});
