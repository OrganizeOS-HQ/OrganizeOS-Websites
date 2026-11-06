// OrganizeOS fork: every test file in the repository runs in a leg of the CI
// workflow (.github/workflows/main.yml), or is exempt below with its reason.
//
// Each leg's file list comes from Vitest itself (`vitest list --filesOnly`, in
// the same directory and with the same project the leg runs), so a file no
// include glob matches, or a builder project with no leg, fails the check. It
// lists files only: nothing is run and no browser starts.
//
// A leg counts only if the tests job runs it, so the check also holds the job
// to its shape: the matrix legs, the steps that run them (each as a whole
// block: name, condition, limit, env and command), no job-level key that can
// skip or excuse a leg, and no continue-on-error anywhere in the job.
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

// The tests job, read as text. Comment lines and blank lines carry no
// meaning, so they are skipped; every other line must be one this check
// expects, in the shape below.
const workflowLines = readFileSync(join(root, workflowPath), "utf8")
  .split("\n")
  .map((line) => line.trimEnd());
const meaningful = (line) => line !== "" && /^\s*#/.test(line) === false;
const indentOf = (line) => line.length - line.trimStart().length;
/** The meaningful lines below a key line, up to the next line indented as
 * far as the key or less. */
const blockBelow = (lines, keyIndex) => {
  const keyIndent = indentOf(lines[keyIndex]);
  const block = [];
  for (const line of lines.slice(keyIndex + 1).filter(meaningful)) {
    if (indentOf(line) <= keyIndent) {
      break;
    }
    block.push(line);
  }
  return block;
};

const testsJobIndex = workflowLines.indexOf("  tests:");
const testsJob =
  testsJobIndex === -1 ? [] : blockBelow(workflowLines, testsJobIndex);
if (testsJobIndex === -1) {
  failures.push(`${workflowPath} has no \`tests\` job`);
}

// No key that can skip a leg or let it fail green.
for (const line of testsJob) {
  if (line.includes("continue-on-error")) {
    failures.push(
      `${workflowPath}'s tests job has continue-on-error (\`${line.trim()}\`): a leg must fail the run`
    );
  }
}
const allowedJobKeys = [
  "name",
  "timeout-minutes",
  "runs-on",
  "strategy",
  "steps",
];
for (const line of testsJob.filter((line) => indentOf(line) === 4)) {
  const key = line.trim().split(":")[0];
  if (allowedJobKeys.includes(key) === false) {
    failures.push(
      key === "if"
        ? `${workflowPath}'s tests job has a job-level \`if:\` (\`${line.trim()}\`): every leg runs on every event`
        : `${workflowPath}'s tests job sets \`${key}\`, which this check does not read (it reads ${allowedJobKeys.join(", ")})`
    );
  }
}

/** The legs: the matrix's include entries, each a map of its keys. */
const matrixEntries = [];
const matrixIndex = testsJob.indexOf("      matrix:");
const matrix = matrixIndex === -1 ? [] : blockBelow(testsJob, matrixIndex);
if (matrixIndex === -1) {
  failures.push(`${workflowPath}'s tests job has no matrix`);
}
const unquote = (raw) => raw.replace(/^"(.*)"$/, "$1");
for (const line of matrix) {
  const entryStart = /^ {10}- ([\w-]+): ?(.*)$/.exec(line);
  const entryKey = /^ {12}([\w-]+): ?(.*)$/.exec(line);
  if (line === "        include:") {
    continue;
  }
  if (entryStart !== null) {
    matrixEntries.push(new Map([[entryStart[1], unquote(entryStart[2])]]));
  } else if (entryKey !== null && matrixEntries.length > 0) {
    matrixEntries.at(-1).set(entryKey[1], unquote(entryKey[2]));
  } else {
    failures.push(
      `${workflowPath}'s tests matrix has \`${line.trim()}\`, which this check does not read: list the legs under include, one key per line`
    );
  }
}
const workflowScripts = new Set(
  matrixEntries.flatMap((entry) => entry.get("script") ?? [])
);
const workflowProjects = new Set(
  matrixEntries.flatMap((entry) => entry.get("project") ?? [])
);
if (
  matrixEntries.some(
    (entry) =>
      entry.get("leg") === "packages" && entry.get("script") === "test:packages"
  ) === false
) {
  failures.push(
    `${workflowPath} has no leg \`packages\` that runs \`test:packages\` (the visual-regression step runs in that leg)`
  );
}

// The steps that run the legs, each exactly as below, comment lines aside.
const expectedSteps = [
  [
    "      - name: Install",
    "        id: install",
    "        run: pnpm install --frozen-lockfile",
  ],
  [
    "      - name: Test",
    "        if: matrix.script",
    "        env:",
    "          SCRIPT: ${{ matrix.script }}",
    '        run: pnpm run "$SCRIPT"',
  ],
  [
    "      - name: Test the visual-regression scripts",
    "        if: ${{ !cancelled() && steps.install.outcome == 'success' && matrix.leg == 'packages' }}",
    "        run: pnpm visual-regression:test",
  ],
  [
    "      - name: Test the builder project",
    "        if: matrix.project",
    "        timeout-minutes: 10",
    "        env:",
    "          PROJECT: ${{ matrix.project }}",
    "          DEBUG: vitest:browser:pool",
    '        run: pnpm --filter @webstudio-is/builder exec vitest run --project "$PROJECT"',
  ],
];
const stepsIndex = testsJob.indexOf("    steps:");
const stepBlocks = [];
for (const line of stepsIndex === -1 ? [] : blockBelow(testsJob, stepsIndex)) {
  if (line.startsWith("      - ")) {
    stepBlocks.push([line]);
  } else {
    stepBlocks.at(-1)?.push(line);
  }
}
for (const expected of expectedSteps) {
  const named = stepBlocks.filter((block) => block[0] === expected[0]);
  const name = expected[0].replace("      - name: ", "");
  if (named.length !== 1) {
    failures.push(
      `${workflowPath}'s tests job has ${named.length} steps named "${name}"; it must have one`
    );
    continue;
  }
  if (named[0].join("\n") !== expected.join("\n")) {
    failures.push(
      `${workflowPath}'s step "${name}" differs from what this check expects (a changed condition, env or command can drop legs; if the change is meant, update the check):\n--- expected\n${expected.join("\n")}\n--- found\n${named[0].join("\n")}`
    );
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
