# Agent Instructions

## Project status

The executable `pi-workflow` V1 plan is complete and implementation has not started. `PLAN.md` is authoritative, Task 1 is next when the user authorizes implementation, and `IDEAS.md` contains explicitly deferred directions.

Do not implement deferred ideas as part of V1. Preserve the resolved SQLite state and interagent handoff boundaries in `PLAN.md`.

## Package boundaries

- Keep the package independently installable and usable as a Pi package.
- Keep workflow lifecycle mechanics separate from role identity and project-specific product guidance.
- `pi-role` remains optional and independently usable.
- Interagent is the only planned V1 coordination transport; do not add alternate transports without user approval.
- Keep authoritative V1 state in the `pi-workflow`-owned `node:sqlite` store under the user-state directory, never in project runtime files or Pi session entries.
- Require Node.js 24.16.0 or newer and isolate `node:sqlite` usage behind one focused storage module.
- Keep the FSM coarse-grained. Ordinary Sergeant-to-Worker execution loops are not FSM transitions.
- Do not ship Practorium-specific product instructions as generic workflow behavior.

## Package style

Match sibling packages in the `pi-projects` superproject:

- source-loaded TypeScript extension under `src/`;
- package manifest with a `pi.extensions` entry;
- runtime dependencies declared by this package;
- Pi-provided packages declared as optional peer dependencies;
- Vitest tests and TypeScript checks;
- Prettier formatting;
- conventional commits;
- `README.md`, `CHANGELOG.md`, `LICENSE.md`, and npm package metadata.

## Verification

Once implementation exists, run:

```bash
npm run typecheck
npm run test
npm run build
npm run format
npm pack --dry-run
```

Verify user-facing changes in a running Pi session before release.

## Source control

Commit coherent completed work. Do not push or publish unless explicitly authorized. When integrated as a submodule, commit this child repository before updating the superproject pointer.
