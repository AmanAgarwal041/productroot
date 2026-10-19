// Deterministic file generators for checks that can be satisfied by adding a
// new file. Output goes into a pull request the user approves; nothing here
// edits existing files. Legal documents (privacy policy, terms) are
// deliberately not generated: they need jurisdiction-specific review.

export interface GenContext {
  owner: string;
  repo: string;
  productName: string;
  siteUrl: string | null;
  packageManager: string | null;
  /** Root package.json script names. */
  scripts: string[];
  /** A JS/TS manifest was read. */
  js: boolean;
}

export interface GenParam {
  key: string;
  label: string;
  kind: "text" | "email" | "select";
  options?: string[];
  required: boolean;
  default?: string;
  help?: string;
}

export interface GenFile {
  path: string;
  content: string;
}

export interface Generator {
  checkId: string;
  title: string;
  description: string;
  /** null when available, otherwise why not. */
  unavailable(ctx: GenContext): string | null;
  params(ctx: GenContext): GenParam[];
  files(ctx: GenContext, p: Record<string, string>): GenFile[];
}

const pm = (c: GenContext) => c.packageManager ?? "npm";
const run = (c: GenContext, script: string) => (pm(c) === "npm" ? `npm run ${script}` : `${pm(c)} ${script}`);
const install = (c: GenContext) => ({ npm: "npm ci", pnpm: "pnpm install --frozen-lockfile", yarn: "yarn install --frozen-lockfile", bun: "bun install --frozen-lockfile" })[pm(c)] ?? "npm ci";
const has = (c: GenContext, s: string) => c.scripts.includes(s);
const checkScripts = (c: GenContext) => ["lint", "typecheck", "test", "build"].filter((s) => has(c, s));

function ciYaml(c: GenContext): string {
  const setup =
    pm(c) === "pnpm"
      ? "      - uses: pnpm/action-setup@v4\n"
      : pm(c) === "bun"
        ? "      - uses: oven-sh/setup-bun@v2\n"
        : "";
  const cache = pm(c) === "bun" ? "" : `          cache: ${pm(c)}\n`;
  const steps = checkScripts(c).map((s) => `      - run: ${run(c, s)}\n`).join("");
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${setup}      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
${cache}      - run: ${install(c)}
${steps}`;
}

export const GENERATORS: Generator[] = [
  {
    checkId: "quality.ci",
    title: "GitHub Actions CI workflow",
    description: "Installs with a frozen lockfile and runs your lint, typecheck, test and build scripts on every push and pull request.",
    unavailable: (c) => (!c.js ? "CI generation currently supports JavaScript/TypeScript projects." : checkScripts(c).length === 0 ? "No lint, typecheck, test or build script found in package.json." : null),
    params: () => [],
    files: (c) => [{ path: ".github/workflows/ci.yml", content: ciYaml(c) }],
  },
  {
    checkId: "oss.license",
    title: "MIT license",
    description: "A permissive license. If you want a different one, pick it on GitHub's 'Add file → LICENSE' page instead.",
    unavailable: () => null,
    params: (c) => [{ key: "holder", label: "Copyright holder", kind: "text", required: true, default: c.owner, help: "Your name or your company's legal name." }],
    files: (_c, p) => [
      {
        path: "LICENSE",
        content: `MIT License

Copyright (c) ${new Date().getUTCFullYear()} ${p.holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`,
      },
    ],
  },
  {
    checkId: "oss.security_policy",
    title: "Security policy (SECURITY.md)",
    description: "Tells researchers how to report vulnerabilities privately.",
    unavailable: () => null,
    params: () => [
      { key: "contact", label: "Private reporting contact", kind: "email", required: false, help: "Leave empty to point reporters at GitHub's private vulnerability reporting (enable it in the repository's Security settings)." },
    ],
    files: (c, p) => [
      {
        path: "SECURITY.md",
        content: `# Security policy

## Reporting a vulnerability

Please do not report security vulnerabilities in public issues.

${
  p.contact
    ? `Email **${p.contact}** with a description of the issue, steps to reproduce, and its impact.`
    : `Use GitHub's [private vulnerability reporting](https://github.com/${c.owner}/${c.repo}/security/advisories/new) to send a report.`
}

We will acknowledge your report within a few working days, keep you updated as we investigate, and credit you in the release notes if you wish.

## Supported versions

Security fixes are applied to the latest release.
`,
      },
    ],
  },
  {
    checkId: "oss.contributing",
    title: "Contributing guide (CONTRIBUTING.md)",
    description: "Development setup, checks to run, and what makes a good pull request.",
    unavailable: () => null,
    params: () => [],
    files: (c) => {
      const checks = checkScripts(c);
      return [
        {
          path: "CONTRIBUTING.md",
          content: `# Contributing to ${c.productName}

Thanks for helping improve ${c.productName}!

## Development setup

\`\`\`bash
git clone https://github.com/${c.owner}/${c.repo}.git
cd ${c.repo}
${c.js ? `${pm(c)} install${has(c, "dev") ? `\n${run(c, "dev")}` : ""}` : "# see README.md for setup"}
\`\`\`
${
  checks.length
    ? `
## Before opening a pull request

\`\`\`bash
${checks.map((s) => run(c, s)).join("\n")}
\`\`\`
`
    : ""
}
## Pull requests

- Keep each pull request focused on one change.
- Describe what changed and why, and link the related issue.
- Add or update tests for behaviour changes.
- Be kind in reviews and discussions.

## Reporting bugs and requesting features

Open an issue using one of the templates. For security issues, see [SECURITY.md](SECURITY.md).
`,
        },
      ];
    },
  },
  {
    checkId: "oss.issue_templates",
    title: "Issue templates",
    description: "Bug report and feature request forms under .github/ISSUE_TEMPLATE.",
    unavailable: () => null,
    params: () => [],
    files: () => [
      {
        path: ".github/ISSUE_TEMPLATE/bug_report.yml",
        content: `name: Bug report
description: Something isn't working
labels: [bug]
body:
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: Include what you expected to happen instead.
    validations:
      required: true
  - type: textarea
    id: reproduce
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. ...
        2. ...
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Version
  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: OS, browser, runtime version, anything relevant.
`,
      },
      {
        path: ".github/ISSUE_TEMPLATE/feature_request.yml",
        content: `name: Feature request
description: Suggest an idea
labels: [enhancement]
body:
  - type: textarea
    id: problem
    attributes:
      label: What problem would this solve?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: What would you like to happen?
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives you've considered
`,
      },
    ],
  },
  {
    checkId: "oss.releases",
    title: "Changelog (CHANGELOG.md)",
    description: "A Keep a Changelog file to record what changes in each release.",
    unavailable: () => null,
    params: () => [],
    files: () => [
      {
        path: "CHANGELOG.md",
        content: `# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

-
`,
      },
    ],
  },
];

export const GENERATOR_BY_CHECK: Record<string, Generator> = Object.fromEntries(GENERATORS.map((g) => [g.checkId, g]));

export type GenerateResult = { ok: true; files: GenFile[] } | { ok: false; error: string };

/** Validate params and produce the files for a set of checks. */
export function generate(ctx: GenContext, checkIds: string[], params: Record<string, Record<string, string>>): GenerateResult {
  if (!checkIds.length) return { ok: false, error: "Choose at least one item to generate." };
  const files: GenFile[] = [];
  for (const id of checkIds) {
    const g = GENERATOR_BY_CHECK[id];
    if (!g) return { ok: false, error: `Nothing can be generated for ${id}.` };
    const why = g.unavailable(ctx);
    if (why) return { ok: false, error: why };
    const given = params[id] ?? {};
    const p: Record<string, string> = {};
    for (const def of g.params(ctx)) {
      const v = (given[def.key] ?? def.default ?? "").trim().slice(0, 200);
      if (def.required && !v) return { ok: false, error: `${def.label} is required.` };
      if (v && def.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: `${def.label} must be an email address.` };
      if (v && /[\r\n<>`]/.test(v)) return { ok: false, error: `${def.label} contains characters that aren't allowed.` };
      p[def.key] = v;
    }
    files.push(...g.files(ctx, p));
  }
  const paths = files.map((f) => f.path);
  if (new Set(paths).size !== paths.length) return { ok: false, error: "Two generators produced the same file." };
  return { ok: true, files };
}
