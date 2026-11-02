# websites-builder: Claude Code context

OrganizeOS's fork of Webstudio: the element-based builder behind the OrganizeOS Website product (`builder.organizeos.org`). Load this first every session.

| For                                                                                                         | Load                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| What the fork changes, its AGPL posture, its environment, and the OrganizeOS loop (provision, SSO, publish) | [`docs/ORGANIZEOS-FORK.md`](docs/ORGANIZEOS-FORK.md)                                                            |
| The platform side, and the contract between the two                                                         | `docs/features/website-builder.md` in [`OrganizeOS-HQ/OrganizeOS`](https://github.com/OrganizeOS-HQ/OrganizeOS) |
| Specs and plans for builder work                                                                            | `docs/superpowers/specs/` and `docs/superpowers/plans/` in the OrganizeOS repo                                  |

Work that touches both sides needs both repositories; attach the other one with the `add_repo` tool.

## Planning

- Specs and plans for builder work live in the OrganizeOS repo, beside the platform half they almost always touch.
- **Every spec and plan gets a Fable review before implementation starts:** dispatch the `spec-reviewer` subagent ([`.claude/agents/spec-reviewer.md`](.claude/agents/spec-reviewer.md): Fable, medium effort, read-only). This holds for a plan written in a session here as much as for one written in the OrganizeOS repo, and for the design of any change to auth, SSO, provisioning, publishing or asset serving that has no spec. Apply its findings or record in the spec or plan why not; a finding that contradicts an owner decision goes to the owner. Implementation subagents stay on Opus or Sonnet.

## Usage efficiency

Owner rules (2026-11-02); the same rules as the OrganizeOS repo's `CLAUDE.md` § Usage efficiency.

- **One session per PR.** Context lives in the docs and plans, not the conversation. Once a PR merges, start the next piece of work in a fresh session.
- **Few agents, matched to the work.** At most two implementation agents per PR; each re-reads the codebase from scratch.
  - Run mechanical work on Sonnet: wording sweeps, test-assertion updates, renames.
  - Keep design, security-sensitive and multi-file logic on Opus.
  - Skip a separate research agent when the build agent will read the same files; give the build agent the paths instead.
- **Parallel agents edit in their own worktree** (`isolation: "worktree"`), and the lead merges their branches. The main checkout stays clean while they run.
- **Commit before you stop.** End every turn with your own work committed and pushed (a `wip:` commit is fine on a `claude/*` branch).
- **Let the PR wake you.** After opening a PR, subscribe to its activity and end the turn. Do not poll CI status; read a job's log only when that job failed.
- **Keep the Fable plan reviews** (see Planning). They cost little and catch real bugs.

## Keep the overlay small

OrganizeOS changes stay in the files `docs/ORGANIZEOS-FORK.md` section 7 lists, so upstream merges stay tractable, and the published-site runtime packages stay byte-identical to upstream (section 1).

## Builder UI: options, not explanations

The owner's rule (2026-10-27) for every OrganizeOS control in the builder's panels. The builder is not the platform: people learn it by trying options and watching the canvas change, or from tutorials.

- Show the options and settings, compactly, and nothing else. No paragraphs of help text, no notes on how a control works, no captions an option's own result already shows.
- Do not visualize results in the panel (reports, reference swatches, previews of what the canvas shows). The canvas is the preview.
- A name that does not fit goes in a tooltip. A warning earns a line only when something is actually wrong, and says what in a few words.
- Fit the panel's width: no row wider than the panel, no grid that crops.
