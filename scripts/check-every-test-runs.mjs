// OrganizeOS fork: every test file in the repository runs in a leg of the CI
// workflow (.github/workflows/main.yml), or is exempt below with its reason.
//
// Each leg's file list comes from Vitest itself (`vitest list --filesOnly`, in
// the same directory and with the same project the leg runs), so a file no
// include glob matches, or a builder project with no leg, fails the check. It
// lists files only: nothing is run and no browser starts.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = ".github/workflows/main.yml";
const builderName = "@webstudio-is/builder";
const cliName = "webstudio";

/** Upstream's builder e2e harness tests: no builder project includes them,
 * upstream runs none of them either, and the fork does not adopt the e2e
 * suite (owner decision D14 of the 0.309.0 merge). */
const exempt = new Map(
  [
    "apps/builder/e2e/process.test.ts",
    "apps/builder/e2e/run-step.test.ts",
    "apps/builder/e2e/test.test.ts",
  ].map((file) => [file, "upstream's e2e harness, not adopted (D14)"])
);

const testFilePattern = /\.(test|spec)\.[cm]?[jt]sx?$/;
/** The builder's Playwright e2e specs, which D14 leaves out too. */
const e2eSpecPattern = /\.e2e\.[jt]s$/;

const failures = [];

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
}).split("\0");
const trackedTestFiles = trackedFiles.filter((file) =>
  testFilePattern.test(file)
);
const e2eSpecCount = trackedFiles.filter((file) =>
  e2eSpecPattern.test(file)
).length;

const workflow = readFileSync(join(root, workflowPath), "utf8");
const matrixValues = (key) =>
  [
    ...workflow.matchAll(
      new RegExp(`^\\s+${key}:\\s*"?([\\w:.-]+)"?\\s*$`, "gm")
    ),
  ].map((match) => match[1]);
const workflowScripts = new Set(matrixValues("script"));
const workflowProjects = new Set(matrixValues("project"));
// The matrix values above count only if the tests job runs them.
const runSteps = [
  'run: pnpm run "$SCRIPT"',
  'run: pnpm --filter @webstudio-is/builder exec vitest run --project "$PROJECT"',
];
for (const step of runSteps) {
  if (workflow.split("\n").some((line) => line.trim() === step) === false) {
    failures.push(`${workflowPath} has no step \`${step}\``);
  }
}

const rootPackage = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8")
);

const temporaryDirectory = mkdtempSync(join(tmpdir(), "every-test-runs-"));
let listCount = 0;

/** The files `vitest list` collects in a directory, with their projects. */
const listVitestFiles = (directory) => {
  listCount += 1;
  const output = join(temporaryDirectory, `list-${listCount}.json`);
  execFileSync(
    "pnpm",
    ["exec", "vitest", "list", "--filesOnly", `--json=${output}`],
    { cwd: join(root, directory), stdio: ["ignore", "ignore", "inherit"] }
  );
  return JSON.parse(readFileSync(output, "utf8")).map((entry) => ({
    file: relative(root, entry.file),
    project: entry.projectName ?? "",
  }));
};

/** Workspace packages, as pnpm-workspace.yaml lists them. */
const workspacePackages = ["packages", "apps", "fixtures"].flatMap((parent) =>
  readdirSync(join(root, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const directory = `${parent}/${entry.name}`;
      try {
        const manifest = JSON.parse(
          readFileSync(join(root, directory, "package.json"), "utf8")
        );
        return [{ directory, manifest }];
      } catch {
        return [];
      }
    })
);

/** leg name -> files it runs */
const legs = new Map();
const addToLeg = (leg, files) => {
  const list = legs.get(leg) ?? [];
  list.push(...files);
  legs.set(leg, list);
};

const requireScript = (name, expected) => {
  if (rootPackage.scripts?.[name] !== expected) {
    failures.push(
      `package.json script "${name}" is not \`${expected}\`, which this check reads the "${name}" leg as`
    );
  }
  if (workflowScripts.has(name) === false) {
    failures.push(`${workflowPath} has no leg that runs \`pnpm ${name}\``);
  }
};

// The packages leg: `pnpm test:packages`, every package's own `test` script
// but the builder's and the CLI's.
requireScript(
  "test:packages",
  "pnpm -r --filter '!@webstudio-is/builder' --filter '!webstudio' test"
);
// The cli leg: `pnpm test:cli`.
requireScript("test:cli", "pnpm --filter webstudio test");

for (const { directory, manifest } of workspacePackages) {
  const test = manifest.scripts?.test;
  if (test === undefined || manifest.name === builderName) {
    continue;
  }
  // `vitest list` below takes no filter, so a script with one (a path, a
  // project, --exclude) would read as running files it skips.
  if (/^vitest run( --passWithNoTests)?$/.test(test) === false) {
    failures.push(
      `${directory}: its test script \`${test}\` is not \`vitest run\`, so this check cannot list what it runs`
    );
    continue;
  }
  const leg = manifest.name === cliName ? "cli" : "packages";
  addToLeg(
    leg,
    listVitestFiles(directory).map((entry) => entry.file)
  );
}

// The packages leg also runs the visual-regression scripts' tests.
const visualRegressionScript = "tsx --test scripts/visual-regression/*.test.ts";
if (
  rootPackage.scripts?.["visual-regression:test"] !== visualRegressionScript
) {
  failures.push(
    `package.json script "visual-regression:test" is not \`${visualRegressionScript}\``
  );
}
if (/^\s+run: pnpm visual-regression:test\s*$/m.test(workflow) === false) {
  failures.push(`${workflowPath} does not run \`pnpm visual-regression:test\``);
}
addToLeg(
  "packages",
  readdirSync(join(root, "scripts/visual-regression"))
    .filter((name) => name.endsWith(".test.ts"))
    .map((name) => `scripts/visual-regression/${name}`)
);

// The builder: one leg per Vitest project.
const builderDirectory = workspacePackages.find(
  ({ manifest }) => manifest.name === builderName
).directory;
/** project -> files */
const builderProjects = new Map();
for (const { file, project } of listVitestFiles(builderDirectory)) {
  const name = project.replace(/ \(chromium\)$/, "");
  builderProjects.set(name, [...(builderProjects.get(name) ?? []), file]);
}
for (const project of builderProjects.keys()) {
  if (workflowProjects.has(project) === false) {
    failures.push(
      `the builder's Vitest project "${project}" has no leg in ${workflowPath}`
    );
  }
}
for (const project of workflowProjects) {
  if (builderProjects.has(project) === false) {
    failures.push(
      `${workflowPath} runs the builder project "${project}", which collects no file`
    );
    continue;
  }
  addToLeg(`builder ${project}`, builderProjects.get(project));
}

// `pnpm checks` runs the builder the way CI does, one project at a time
// (test:builder:projects): two browser projects in one Vitest run can stall.
const localProjects = new Set(
  rootPackage.scripts?.["test:builder:projects"]
    ?.match(/^for project in ([\w\s-]+); do /)?.[1]
    .trim()
    .split(/\s+/) ?? []
);
for (const project of builderProjects.keys()) {
  if (localProjects.has(project) === false) {
    failures.push(
      `package.json script "test:builder:projects" does not run the builder's Vitest project "${project}"`
    );
  }
}
for (const project of localProjects) {
  if (builderProjects.has(project) === false) {
    failures.push(
      `package.json script "test:builder:projects" runs the builder project "${project}", which collects no file`
    );
  }
}

rmSync(temporaryDirectory, { recursive: true, force: true });

const running = new Set([...legs.values()].flat());
const notRunning = trackedTestFiles.filter(
  (file) => running.has(file) === false && exempt.has(file) === false
);
for (const file of notRunning) {
  failures.push(`${file} runs in no CI leg`);
}
for (const file of exempt.keys()) {
  if (trackedTestFiles.includes(file) === false || running.has(file)) {
    failures.push(`${file} is exempt here but is gone or now runs: drop it`);
  }
}

for (const [leg, files] of [...legs].sort(([a], [b]) => a.localeCompare(b))) {
  console.info(`${leg}: ${new Set(files).size} files`);
}
for (const [file, reason] of exempt) {
  console.info(`exempt: ${file} (${reason})`);
}
console.info(
  `not a test file here: ${e2eSpecCount} builder e2e specs (*.e2e.ts, Playwright, not adopted: D14)`
);
if (failures.length > 0) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}
console.info(
  `OK: ${trackedTestFiles.length - exempt.size} of ${trackedTestFiles.length} test files run in a CI leg; ${exempt.size} are exempt.`
);
