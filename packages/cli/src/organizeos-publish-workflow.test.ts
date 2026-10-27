import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

// OrganizeOS launches a Website only from a build that carries no org script
// and meets its launch requirements, so the publish workflow reads the switch
// and the guard level from the CLI it built, never from configuration, and
// fails the run unless the switch is off, the address rule is there and the
// level is one OrganizeOS takes (docs/ORGANIZEOS-FORK.md sections 5 and 10).
// No run script holds an expression: every input, variable, secret and step
// output reaches it through its step's env, and the bodies are built with
// node. The workflow is read as text, and its scripts run here as the runner
// runs them, against a fake curl, npm and vercel: a change that moves a step,
// loosens a check or feeds a value from elsewhere fails here.

const root = fileURLToPath(new URL("../../..", import.meta.url));
const cliDir = join(root, "packages", "cli");
const workflow = readFileSync(
  join(root, ".github", "workflows", "publish-site.yml"),
  "utf8"
);

type Step = { name: string | undefined; text: string };

/** The steps of the publish job, in order, each as its own text. */
const steps: Step[] = workflow
  .split(/^ {6}- /m)
  .slice(1)
  .map((text) => ({ name: text.match(/^name: (.*)$/m)?.[1], text }));

const stepNamed = (name: string) => {
  const found = steps.find((item) => item.name === name);
  if (found === undefined) {
    throw new Error(`no step named ${name}`);
  }
  return found;
};

/** The lines under a step's key (`run: |` or `env:`), as the runner gets them. */
const blockOf = (step: Step, key: RegExp) => {
  const lines = step.text.split("\n");
  const start = lines.findIndex((line) => key.test(line));
  if (start === -1) {
    return undefined;
  }
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== "" && line.startsWith(" ".repeat(10)) === false) {
      break;
    }
    body.push(line.slice(10));
  }
  return body.join("\n").trim();
};

/** The step's `run` script. */
const runScriptOf = (step: Step) => blockOf(step, /^ {8}run: \|$/) ?? "";

/** The step's `env`, each key with its value as written. */
const envOf = (step: Step): Record<string, string> =>
  Object.fromEntries(
    (blockOf(step, /^ {8}env:$/) ?? "")
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => {
        const match = line.match(/^([A-Z_]+): (.*)$/);
        if (match === null) {
          throw new Error(`not an env entry: ${line}`);
        }
        return [match[1], match[2]];
      })
  );

/** The module a step's node command runs. */
const probeOf = (script: string) =>
  script.match(/node --input-type=module -e '([^']*)'/)?.[1];

const switchStep = stepNamed("Read the org script switch");
const guardStep = stepNamed("Read the guard level");
const deployStep = stepNamed("Deploy to Vercel");
const callbackStep = stepNamed("Flip the OrganizeOS pointer");
const publishedStep = stepNamed("Report the build as published");
const failedStep = stepNamed("Report the build as failed");

const switchScript = runScriptOf(switchStep);
const guardScript = runScriptOf(guardStep);

let outputDir: string | undefined;

afterEach(() => {
  if (outputDir !== undefined) {
    rmSync(outputDir, { recursive: true, force: true });
    outputDir = undefined;
  }
});

// Stand-ins for the tools the steps call. Each records its arguments, and its
// environment where that matters, in $FAKE_LOG, one JSON line per call.
const fakeTools = {
  // writes $FAKE_CURL_ANSWER to the -o file, prints $FAKE_CURL_STATUS for -w,
  // and exits as --fail-with-body does on a 4xx or 5xx
  curl: `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: "curl", args }) + "\\n");
const status = Number(process.env.FAKE_CURL_STATUS ?? "200");
const answer = process.env.FAKE_CURL_ANSWER ?? "";
const out = args.indexOf("-o");
if (out === -1) {
  process.stdout.write(answer);
} else {
  fs.writeFileSync(args[out + 1], answer);
}
if (args.includes("-w")) {
  process.stdout.write(String(status));
}
process.exit(status >= 400 && args.includes("--fail-with-body") ? 22 : 0);
`,
  npm: `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: "npm", args: process.argv.slice(2), token: process.env.VERCEL_TOKEN ?? null }) + "\\n");
`,
  // prints $FAKE_VERCEL_URL, as vercel deploy prints the deployment's URL
  vercel: `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: "vercel", args: process.argv.slice(2) }) + "\\n");
process.stdout.write(process.env.FAKE_VERCEL_URL ?? "");
`,
};

type Call = { tool: string; args: string[]; token?: string | null };

/**
 * Runs a script as the runner runs a step (`bash -e`), in packages/cli, with
 * the fake tools first on PATH.
 */
const runStep = (script: string, env: Record<string, string> = {}) => {
  outputDir = mkdtempSync(join(tmpdir(), "publish-workflow-"));
  const output = join(outputDir, "output");
  const log = join(outputDir, "calls");
  const bin = join(outputDir, "bin");
  const runnerTemp = join(outputDir, "runner-temp");
  mkdirSync(bin);
  mkdirSync(runnerTemp);
  for (const [name, source] of Object.entries(fakeTools)) {
    writeFileSync(join(bin, name), source);
    chmodSync(join(bin, name), 0o755);
  }
  const result = spawnSync("bash", ["-e", "-c", script], {
    cwd: cliDir,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_OUTPUT: output,
      RUNNER_TEMP: runnerTemp,
      FAKE_LOG: log,
      ...env,
    },
    encoding: "utf8",
  });
  const calls: Call[] = existsSync(log)
    ? readFileSync(log, "utf8")
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line))
    : [];
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    output: existsSync(output) ? readFileSync(output, "utf8") : "",
    calls,
  };
};

/** A build id that breaks out of any shell or JSON it is pasted into. */
const hostileBuildId = `a'b"c$(x)\n`;

const secrets = {
  callbackToken: "callback-token-secret-value",
  serviceToken: "service-token-secret-value",
  vercelToken: "vercel-token-secret-value",
};

/** What the runner fills each expression with. */
const expressions: Record<string, string> = {
  "inputs.build_id": hostileBuildId,
  "inputs.organization_id": "a6b33e8c-3f0e-4c21-9d4e-6b0c1f2e3d4a",
  "vars.BUILDER_ORIGIN": "https://builder.example",
  "secrets.WSTD_SERVICE_TOKEN": secrets.serviceToken,
  "secrets.PUBLISH_CALLBACK_URL": "https://app.example/publish-callback",
  "secrets.PUBLISH_CALLBACK_TOKEN": secrets.callbackToken,
  "secrets.VERCEL_TOKEN": secrets.vercelToken,
  "secrets.VERCEL_ORG_ID": "team_example",
  "secrets.VERCEL_SITES_PROJECT_ID": "prj_example",
  "steps.deploy.outputs.deployment_url": "https://site-abc.vercel.app",
  "steps.org-script.outputs.value": "false",
  "steps.guard-level.outputs.value": "0",
};

/** The step's env as the runner fills it, with some expressions replaced. */
const envFor = (step: Step, replaced: Record<string, string> = {}) => {
  const values = { ...expressions, ...replaced };
  return Object.fromEntries(
    Object.entries(envOf(step)).map(([key, value]) => {
      const name = value.match(/^\$\{\{ ([^}]+) \}\}$/)?.[1];
      if (name === undefined || name in values === false) {
        throw new Error(`${key} is fed by ${value}`);
      }
      return [key, values[name]];
    })
  );
};

const runWithAnswer = (
  step: Step,
  {
    replaced,
    answer = "{}",
    status = 200,
  }: {
    replaced?: Record<string, string>;
    answer?: string;
    status?: number;
  } = {}
) =>
  runStep(runScriptOf(step), {
    ...envFor(step, replaced),
    FAKE_CURL_ANSWER: answer,
    FAKE_CURL_STATUS: String(status),
  });

const argAfter = (call: Call, flag: string) =>
  call.args[call.args.indexOf(flag) + 1];

const expectNoSecretIn = (run: { stdout: string; stderr: string }) => {
  for (const secret of Object.values(secrets)) {
    expect(run.stdout).not.toContain(secret);
    expect(run.stderr).not.toContain(secret);
  }
};

/** Replaces the step's node probe with a command that prints `value`. */
const withValue = (script: string, value: string) =>
  script.replace(
    /\$\(node --input-type=module -e '[^']*'\)/,
    `$(printf '%s' '${value}')`
  );

describe("the publish workflow's org script switch", () => {
  test("reads the switch after the build, then the guard level, then deploys", () => {
    const names = steps.map((item) => item.name);
    const index = names.indexOf(switchStep.name);
    expect(names[index - 1]).toBe("Build site");
    expect(names[index + 1]).toBe("Read the guard level");
    expect(names[index + 2]).toBe("Deploy to Vercel");
    // after the build of the CLI it reads, at the same commit
    expect(names.indexOf("Install and build CLI")).toBeLessThan(index);
    // from the CLI's package, where it resolves the blocks package as the CLI
    // does, and under an id later steps can read
    expect(switchStep.text).toMatch(/^ {8}working-directory: packages\/cli$/m);
    expect(switchStep.text).toMatch(/^ {8}id: org-script$/m);
  });

  test("fails the run unless the switch reads false and the address rule is there", () => {
    // the module the CLI loads, asked whether it has the address rule with
    // the switch held off, and then for the switch itself
    const probe = probeOf(switchScript);
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
    expect(switchStep.text).not.toMatch(/\$\{\{/);
    expect(switchStep.text).not.toMatch(/^ {8}env:/m);

    // the shell around it: anything but false fails, an empty read too, and
    // only false is written out
    for (const value of ["true", "", "null", '"false"']) {
      const run = runStep(withValue(switchScript, value));
      expect(run.status, value).toBe(1);
      expect(run.stdout, value).toContain(
        `::error::orgScriptMayRun() is ${value === "" ? "unreadable" : value}.`
      );
      expect(run.output, value).toBe("");
    }
    const off = runStep(withValue(switchScript, "false"));
    expect(off.status).toBe(0);
    expect(off.output).toBe("value=false\n");
    // a module without the rule fails the step before the switch is read
    const withoutRule = runStep(
      switchScript.replace(
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
    const node = spawnSync(
      "node",
      ["--input-type=module", "-e", probeOf(switchScript) ?? ""],
      { cwd: cliDir, encoding: "utf8" }
    );
    expect(node.stderr).toBe("");
    expect(node.stdout).toBe("false");

    const run = runStep(switchScript);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.output).toBe("value=false\n");
  });
});

describe("the publish workflow's guard level", () => {
  test("reads the level from the CLI's package after the switch, under an id", () => {
    const names = steps.map((item) => item.name);
    expect(names.indexOf(guardStep.name)).toBe(
      names.indexOf(switchStep.name) + 1
    );
    expect(guardStep.text).toMatch(/^ {8}working-directory: packages\/cli$/m);
    expect(guardStep.text).toMatch(/^ {8}id: guard-level$/m);
  });

  test("reads only the constant from the module, and nothing feeds it but the CLI", () => {
    expect(guardStep.text).not.toMatch(/\$\{\{/);
    expect(guardStep.text).not.toMatch(/^ {8}env:/m);
    const probe = probeOf(guardScript) ?? "";
    expect(probe).toContain(
      'import { ORGANIZEOS_GUARD_LEVEL } from "@organizeos/site-components/org-script";'
    );
    expect(probe).toContain(
      "process.stdout.write(JSON.stringify(ORGANIZEOS_GUARD_LEVEL));"
    );
    expect(probe.match(/\bimport\b/g)).toHaveLength(1);
    expect(probe).not.toMatch(/process\.env|process\.argv|require\(/);
  });

  test("fails the run unless the level is an integer from 0 to 32767", () => {
    for (const value of [
      "",
      "-1",
      "1.5",
      "01",
      "1e3",
      "32768",
      '"0"',
      "null",
    ]) {
      const run = runStep(withValue(guardScript, value));
      expect(run.status, value).toBe(1);
      expect(run.stdout, value).toContain(
        `::error::ORGANIZEOS_GUARD_LEVEL is ${value === "" ? "unreadable" : value}.`
      );
      expect(run.output, value).toBe("");
    }
    for (const value of ["0", "1", "32767"]) {
      const run = runStep(withValue(guardScript, value));
      expect(run.status, value).toBe(0);
      expect(run.output, value).toBe(`value=${value}\n`);
    }
  });

  test("the step's command prints 0 from the built package, and fails without the export", () => {
    const node = spawnSync(
      "node",
      ["--input-type=module", "-e", probeOf(guardScript) ?? ""],
      { cwd: cliDir, encoding: "utf8" }
    );
    expect(node.stderr).toBe("");
    expect(node.stdout).toBe("0");

    const run = runStep(guardScript);
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.output).toBe("value=0\n");

    // a CLI built before the constant cannot report a level
    const missing = runStep(
      guardScript.replaceAll(
        "ORGANIZEOS_GUARD_LEVEL",
        "ORGANIZEOS_GUARD_LEVEL_MISSING"
      )
    );
    expect(missing.status).not.toBe(0);
    expect(missing.output).toBe("");
  });
});

describe("the publish workflow's expressions", () => {
  test("no run script holds an expression, and there is no workflow- or job-level env", () => {
    const scripts = steps
      .filter((item) => /^ {8}run: \|$/m.test(item.text))
      .map(runScriptOf);
    expect(scripts).toHaveLength(9);
    for (const script of scripts) {
      expect(script).not.toContain("${{");
    }
    // every expression in the file is a step's env value, the temp
    // directory a step runs in, or the concurrency group
    for (const line of workflow
      .split("\n")
      .filter((text) => text.includes("${{"))) {
      expect(
        /^ {10}[A-Z_]+: \$\{\{ [\w.-]+ \}\}$/.test(line) ||
          line === "        working-directory: ${{ runner.temp }}" ||
          line === "  group: publish-${{ inputs.organization_id }}",
        line
      ).toBe(true);
    }
    expect(workflow).not.toMatch(/^ {0,4}env:/m);
  });

  test("feeds orgScript and guardLevel from their steps' outputs alone", () => {
    const env = envOf(callbackStep);
    expect(env.ORG_SCRIPT).toBe("${{ steps.org-script.outputs.value }}");
    expect(env.GUARD_LEVEL).toBe("${{ steps.guard-level.outputs.value }}");
    expect(Object.keys(env).sort()).toEqual([
      "BUILD_ID",
      "CALLBACK_TOKEN",
      "CALLBACK_URL",
      "DEPLOYMENT_URL",
      "GUARD_LEVEL",
      "ORGANIZATION_ID",
      "ORG_SCRIPT",
    ]);
    // nothing else reads the outputs on the way
    for (const id of ["steps.org-script", "steps.guard-level"]) {
      expect(
        steps.filter((item) => item.text.includes(id)).map((item) => item.name)
      ).toEqual([callbackStep.name]);
    }
  });

  test("the deploy writes its URL out only when Vercel answered with one, and installs without the token", () => {
    const deploy = (url: string) =>
      runStep(runScriptOf(deployStep), {
        ...envFor(deployStep),
        FAKE_VERCEL_URL: url,
      });

    const run = deploy("https://site-abc.vercel.app");
    expect(run.status).toBe(0);
    expect(run.output).toBe("deployment_url=https://site-abc.vercel.app\n");
    const npm = run.calls.find((call) => call.tool === "npm");
    expect(npm?.args).toEqual(["install", "--global", "vercel@latest"]);
    expect(npm?.token).toBe(null);
    const vercel = run.calls.find((call) => call.tool === "vercel");
    expect(vercel && argAfter(vercel, "--token")).toBe(secrets.vercelToken);
    expectNoSecretIn(run);

    for (const url of [
      "",
      "https://site-abc.vercel.app\nvalue=true",
      "https://site-abc.vercel.app/path",
      "Error: no deployment",
    ]) {
      const failed = deploy(url);
      expect(failed.status, url).toBe(1);
      expect(failed.stdout, url).toContain(
        "::error::Vercel did not answer with a deployment URL."
      );
      expect(failed.output, url).toBe("");
    }
  });
});

describe("the publish callback", () => {
  test("sends the five keys, the build id verbatim, orgScript false and guardLevel 0", () => {
    const run = runWithAnswer(callbackStep);

    expect(run.status).toBe(0);
    expect(run.calls).toHaveLength(1);
    const [call] = run.calls;
    expect(call.args).toContain(expressions["secrets.PUBLISH_CALLBACK_URL"]);
    expect(call.args).toContain(`Authorization: ${secrets.callbackToken}`);
    const body = JSON.parse(argAfter(call, "--data-binary"));
    expect(body).toEqual({
      organizationId: expressions["inputs.organization_id"],
      buildId: hostileBuildId,
      deploymentUrl: expressions["steps.deploy.outputs.deployment_url"],
      orgScript: false,
      guardLevel: 0,
    });
    expect(Object.keys(body)).toHaveLength(5);
    expectNoSecretIn(run);
  });

  test("sends nothing unless orgScript reads false and guardLevel is an integer from 0 to 32767", () => {
    const refused: Array<Record<string, string>> = [
      { "steps.org-script.outputs.value": "true" },
      { "steps.org-script.outputs.value": "" },
      { "steps.org-script.outputs.value": '"false"' },
      { "steps.guard-level.outputs.value": "x" },
      { "steps.guard-level.outputs.value": "" },
      { "steps.guard-level.outputs.value": "01" },
      { "steps.guard-level.outputs.value": "32768" },
    ];
    for (const replaced of refused) {
      const run = runWithAnswer(callbackStep, { replaced });
      const label = JSON.stringify(replaced);
      expect(run.status, label).not.toBe(0);
      expect(run.stdout, label).toContain("::error::");
      expect(run.calls, label).toEqual([]);
    }
  });

  test("logs live and launchable from the answer, each only as a boolean", () => {
    const logged = (answer: string) => {
      const run = runWithAnswer(callbackStep, { answer });
      expect(run.status, answer).toBe(0);
      return run.stdout
        .split("\n")
        .filter((line) => /^(live|launchable)=/.test(line));
    };

    expect(logged('{"ok":true,"live":false,"launchable":true}')).toEqual([
      "live=false",
      "launchable=true",
    ]);
    expect(logged('{"live":true}')).toEqual(["live=true"]);
    for (const answer of [
      '{"live":"false","launchable":"true"}',
      '{"ok":true}',
      "not json",
      "null",
      "[true,false]",
      "",
    ]) {
      expect(logged(answer), answer).toEqual([]);
    }
  });

  test("a success never prints the raw answer", () => {
    const run = runWithAnswer(callbackStep, {
      answer: '{"ok":true,"live":false,"launchable":false,"note":"raw-answer"}',
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Pointer flipped (200)");
    expect(run.stdout).not.toContain("raw-answer");
    expect(run.stdout).not.toContain("{");
  });

  test("anything but a 2xx fails the step and prints the answer", () => {
    const redirect = runWithAnswer(callbackStep, {
      answer: "moved",
      status: 308,
    });
    expect(redirect.status).toBe(1);
    expect(redirect.stdout).toContain("moved");
    expect(redirect.stdout).toContain(
      "::error::The publish callback answered 308, so the pointer was not flipped."
    );

    const refused = runWithAnswer(callbackStep, {
      answer: '{"error":"bad body"}',
      status: 400,
    });
    expect(refused.status).not.toBe(0);
    expect(refused.stdout).toContain('{"error":"bad body"}');
    expectNoSecretIn(refused);
  });
});

describe("the publish workflow's status reports", () => {
  test.each([
    ["published", publishedStep, "PUBLISHED"],
    ["failed", failedStep, "FAILED"],
  ] as const)(
    "the %s report sends exactly buildId and status, the build id verbatim",
    (_name, step, status) => {
      const run = runWithAnswer(step);

      expect(run.status).toBe(0);
      expect(run.calls).toHaveLength(1);
      const [call] = run.calls;
      expect(call.args).toContain(
        "https://builder.example/internal/publish-status"
      );
      expect(call.args).toContain(`Authorization: ${secrets.serviceToken}`);
      const body = JSON.parse(argAfter(call, "--data-binary"));
      expect(body).toEqual({ buildId: hostileBuildId, status });
      expect(Object.keys(body)).toHaveLength(2);
      expectNoSecretIn(run);
    }
  );
});
