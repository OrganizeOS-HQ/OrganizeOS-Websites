import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

// OrganizeOS launches a Website only from a build that carries no org script,
// so the publish workflow reads the switch from the CLI it built, never from
// configuration, and fails the run unless it is off and the address rule is
// there (docs/ORGANIZEOS-FORK.md section 10). The workflow is read as text: a
// change that moves the step, loosens its check or feeds it from elsewhere
// fails here.

const root = fileURLToPath(new URL("../../..", import.meta.url));
const cliDir = join(root, "packages", "cli");
const workflow = readFileSync(
  join(root, ".github", "workflows", "publish-site.yml"),
  "utf8"
);

const stepName = "Read the org script switch";

/** The steps of the publish job, in order, each as its own text. */
const steps = workflow
  .split(/^ {6}- /m)
  .slice(1)
  .map((text) => ({ name: text.match(/^name: (.*)$/m)?.[1], text }));

const step = steps.find((item) => item.name === stepName);

/** The step's `run` script, as the runner gets it. */
const runScript = (() => {
  const lines = step?.text.split("\n") ?? [];
  const start = lines.findIndex((line) => /^ {8}run: \|$/.test(line));
  if (start === -1) {
    return "";
  }
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && line.startsWith(" ".repeat(10)) === false) {
      break;
    }
    body.push(line.slice(10));
  }
  return body.join("\n").trim();
})();

/** The module the step's node command runs. */
const probe = runScript.match(/node --input-type=module -e '([^']*)'/)?.[1];

let outputDir: string | undefined;

afterEach(() => {
  if (outputDir !== undefined) {
    rmSync(outputDir, { recursive: true, force: true });
    outputDir = undefined;
  }
});

/** Runs a script as the runner runs a step (`bash -e`), in packages/cli. */
const runStep = (script: string) => {
  outputDir = mkdtempSync(join(tmpdir(), "publish-workflow-"));
  const output = join(outputDir, "output");
  const result = spawnSync("bash", ["-e", "-c", script], {
    cwd: cliDir,
    env: { ...process.env, GITHUB_OUTPUT: output },
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: existsSync(output) ? readFileSync(output, "utf8") : "",
  };
};

describe("the publish workflow's org script switch", () => {
  test("reads the switch after the build and before the deploy", () => {
    const names = steps.map((item) => item.name);
    const index = names.indexOf(stepName);
    expect(index).toBeGreaterThan(-1);
    expect(names[index - 1]).toBe("Build site");
    expect(names[index + 1]).toBe("Deploy to Vercel");
    // after the build of the CLI it reads, at the same commit
    expect(names.indexOf("Install and build CLI")).toBeLessThan(index);
    // from the CLI's package, where it resolves the blocks package as the CLI
    // does, and under an id later steps can read
    expect(step?.text).toMatch(/^ {8}working-directory: packages\/cli$/m);
    expect(step?.text).toMatch(/^ {8}id: org-script$/m);
  });

  test("fails the run unless the switch reads false and the address rule is there", () => {
    // the module the CLI loads, asked whether it has the address rule with
    // the switch held off, and then for the switch itself
    expect(probe).toBeDefined();
    expect(probe).toContain(
      'import { orgScriptMayRun, urlMayRun } from "@organizeos/site-components/org-script";'
    );
    expect(probe).toContain(
      'if (typeof urlMayRun !== "function" || urlMayRun("javascript:alert(1)", false) !== false) {'
    );
    expect(probe).toContain(
      'throw new Error("this CLI does not check unsafe addresses");'
    );
    expect(probe).toContain(
      "process.stdout.write(JSON.stringify(orgScriptMayRun()));"
    );
    // nothing but the CLI feeds the value
    expect(step?.text).not.toMatch(/\$\{\{/);
    expect(step?.text).not.toMatch(/^ {8}env:/m);

    // the shell around it: anything but false fails, an empty read too, and
    // only false is written out
    const withValue = (value: string) =>
      runScript.replace(
        /\$\(node --input-type=module -e '[^']*'\)/,
        `$(printf '%s' '${value}')`
      );
    for (const value of ["true", "", "null", '"false"']) {
      const run = runStep(withValue(value));
      expect(run.status, value).toBe(1);
      expect(run.stdout, value).toContain(
        `::error::orgScriptMayRun() is ${value === "" ? "unreadable" : value}.`
      );
      expect(run.output, value).toBe("");
    }
    const off = runStep(withValue("false"));
    expect(off.status).toBe(0);
    expect(off.output).toBe("value=false\n");
    // a module without the rule fails the step before the switch is read
    const withoutRule = runStep(
      runScript.replace(
        /\$\(node --input-type=module -e '[^']*'\)/,
        `$(node --input-type=module -e 'throw new Error("this CLI does not check unsafe addresses")')`
      )
    );
    expect(withoutRule.status).not.toBe(0);
    expect(withoutRule.output).toBe("");
  });

  // CI builds the blocks package, with the workspace packages it imports,
  // before the tests (.github/workflows/main.yml), as the publish workflow
  // builds every package before this step
  test("the step's command prints false from the built package", () => {
    for (const built of [
      "packages/sdk-components-organizeos/lib/org-script.js",
      "packages/sdk/lib/index.js",
    ]) {
      expect(
        existsSync(join(root, built)),
        `${built} is missing: build the blocks package with its dependencies first (pnpm --filter "@organizeos/site-components..." build)`
      ).toBe(true);
    }
    const node = spawnSync("node", ["--input-type=module", "-e", probe ?? ""], {
      cwd: cliDir,
      encoding: "utf8",
    });
    expect(node.stderr).toBe("");
    expect(node.stdout).toBe("false");

    const run = runStep(runScript);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.output).toBe("value=false\n");
  });

  // The publish callback stores what the body says (the Launch PR), so the
  // field comes from what this run's CLI said and from nothing a dispatch, a
  // secret, a variable or the environment could set
  test("sends orgScript from the step's output, unquoted, and from nothing else", () => {
    const names = steps.map((item) => item.name);
    const callback = steps.find(
      (item) => item.name === "Flip the OrganizeOS pointer"
    );
    expect(callback).toBeDefined();
    expect(names.indexOf("Flip the OrganizeOS pointer")).toBeGreaterThan(
      names.indexOf(stepName)
    );

    // one orgScript in the whole workflow, unquoted, the step's output alone
    const fields = [...workflow.matchAll(/"orgScript":\s*([^\n]*)/g)].map(
      (match) => match[1].trim().replace(/,$/, "")
    );
    expect(fields).toEqual(["${{ steps.org-script.outputs.value }}"]);
    expect(callback?.text).toContain(
      '"orgScript": ${{ steps.org-script.outputs.value }}\n'
    );
    for (const source of ["secrets.", "vars.", "inputs.", "env."]) {
      expect(fields[0]).not.toContain(source);
    }
    // nothing else reads or overrides the output on the way
    expect(
      steps
        .filter((item) => item.text.includes("steps.org-script"))
        .map((item) => item.name)
    ).toEqual(["Flip the OrganizeOS pointer"]);
    expect(callback?.text).not.toMatch(/^ {8}env:/m);
    expect(step?.text).not.toMatch(/^ {8}env:/m);
    expect(workflow).not.toMatch(/^ {2,4}env:/m);

    // the body is JSON with the four keys the callback accepts, orgScript a
    // boolean, once the runner fills the expressions in
    const body = callback?.text.match(/-d '(\{[^']*\})'/)?.[1] ?? "";
    const filled = body.replace(/\$\{\{\s*([^}]*?)\s*\}\}/g, (_, name) =>
      name === "steps.org-script.outputs.value" ? "false" : `filled-${name}`
    );
    const parsed = JSON.parse(filled);
    expect(Object.keys(parsed).sort()).toEqual([
      "buildId",
      "deploymentUrl",
      "orgScript",
      "organizationId",
    ]);
    expect(parsed.orgScript).toBe(false);
  });
});
