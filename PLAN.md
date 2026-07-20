# pi-workflow V1 implementation plan

Status: Planning baseline complete; implementation has not started. Phase 1 is the next implementation phase.

## Purpose

Create a Pi extension that moves consequential agent-development workflow state out of loose prose and into a deterministic lifecycle engine without turning ordinary agent work into bureaucratic state-machine traffic.

V1 succeeds when the existing Architect, Sergeant, and Worker workflows proven in Practorium can run across separate Pi processes with explicit lifecycle ownership, legal transitions, user gates, role eligibility, direct interagent handoffs, recovery, and focused current-step instructions.

## Why this package exists

Practorium currently has a machine-readable workflow catalog, validation schema, Markdown workflow details, templates, and active planning artifacts. The catalog describes deterministic intent, but most enforcement remains nondeterministic:

- agents interpret legal transitions from prose;
- distinct approvals can be accidentally conflated;
- lifecycle ownership is duplicated across `PLAN.md`, phase plans, task tables, and handoffs;
- agents carry more workflow instructions than their current step requires;
- direct and coordinated routes depend on agents remembering routing mechanics;
- recovery requires reconciling several human-maintained state descriptions.

`pi-workflow` should deterministically own lifecycle state, authorization gates, top-level ownership, and macro handoffs. Markdown remains responsible for rich plans, decisions, task packets, implementation guidance, and review judgment.

## V1 principles

### Coarse lifecycle, substantial work

The FSM tracks top-level authority and lifecycle gates. It does not model ordinary file edits, tool calls, tests, todos, or routine Sergeant-to-Worker interactions.

A transition should correspond to at least one material change in:

- lifecycle ownership;
- execution authority;
- required artifact or evidence;
- user approval or acceptance;
- blocking decision;
- architecture acceptance;
- closeout status.

If none changes, the action probably belongs in Markdown instructions or ordinary agent communication rather than the FSM.

### Plan as focal artifact

The FSM replaces a plan file's control-plane role, not its knowledge-artifact role.

An active workflow instance is composed from:

```text
workflow definition + project plan artifact + runtime FSM state
```

The plan contains durable project-specific knowledge: purpose, decisions, scope, non-goals, task sequence, task packets, verification, and acceptance expectations. The runtime owns current lifecycle state, owner, approvals, route, participant bindings, and transition history.

A plan identifies the workflow it instantiates through frontmatter such as:

```yaml
---
kind: workflow-plan
id: phase-31-example
workflow: full-phase
workflow-version: 1
---
```

The runtime stores the project key and project-relative primary artifact path. It must not copy the plan's long-form content into FSM state.

### Roles and teams

Roles are coherent standalone operating contracts. Workflows own participant composition.

- `pi-role` continues to select and inject one role per Pi session.
- `pi-workflow` defines participant slots, routes, ownership, transitions, and handoffs.
- A workflow may require an expected role for a participant slot and reject a mismatch.
- `pi-workflow` must not activate or change roles.
- V1 may use `pi-role` when installed, but role and workflow packages remain independently usable and share no mutable singleton.

Routes must explicitly reassign responsibilities when a role is omitted. For example, direct Architect-to-Worker routing assigns dispatch, review, acceptance handling, integration, final verification, authorized state updates, and reporting to the Architect rather than silently dropping Sergeant responsibilities.

### Direct interagent coordination

V1 uses the existing interagent system and direct participant identities only. It does not implement pub/sub, filesystem handoffs, alternate transports, or a public adapter ecosystem.

Concrete identities use the convention:

```text
<project>-architect
<project>-sergeant
<project>-worker
<project>-worker-2
<project>-worker-3
```

The project portion is the configured workspace registry key or participant prefix. `worker-2` is a concrete participant ordinal; its role remains `worker`.

Participant slots are bound explicitly to concrete interagent identities. The workflow must not infer role activation or authorization solely from a participant name.

### User control

Agents may recommend workflows and propose transitions. Deterministic launch and material user gates remain explicitly user-confirmed. Approval evidence is recorded separately by gate; approval to read, decide, route, execute, accept, or commit must not be treated as interchangeable.

Routine macro handoffs already authorized by the selected route should occur without repeated confirmation.

## Project registry and configuration

Pi is commonly started from `/workspace` while work occurs in nested repositories. V1 must treat Pi's cwd as a host workspace containing multiple independently namespaced workflow projects.

The workspace `.pi/settings.json` may define:

```json
{
  "pi-workflow": {
    "projects": {
      "practorium": {
        "root": "projects/practorium",
        "plansDir": "plans"
      },
      "interagent": {
        "root": "projects/interagent",
        "plansDir": "plans"
      },
      "pi-workflow": {
        "root": "projects/pi/packages/pi-workflow",
        "plansDir": "plans"
      }
    }
  }
}
```

Requirements:

- registry keys are authoritative local project namespaces within one interagent server;
- `participantPrefix` may override the registry key when needed;
- custom paths resolve from Pi's runtime cwd, not the physical target of a symlinked settings file;
- project roots and plan paths are normalized and constrained to the configured workspace by default;
- nested repositories and submodules are valid registered roots;
- explicit project selection resolves overlapping roots;
- an omitted project may be inferred only from the longest matching registered root of an explicit plan path;
- each registered project may have one active V1 workflow independent of other projects;
- incoming handoffs carry the project key so recipients select the correct context automatically.

Ordinary installations where Pi starts inside a project may use a simpler single-project configuration. Workspace-registry behavior is the primary V1 acceptance scenario.

## Workflow definitions

V1 should faithfully extract and generalize these proven workflows:

- `bounded-work`;
- `bounded-series`;
- `seed-planning`;
- `full-phase`.

A definition minimally needs:

- stable key and version;
- title and selection guidance;
- lifecycle states;
- initial and terminal states;
- participant slots and route bindings;
- permitted actor slot per transition;
- legal transitions and correction returns;
- required artifacts and evidence;
- distinct user gates;
- deterministic transition effects;
- current-state Markdown instructions;
- macro handoff target when ownership changes.

Do not generalize the schema beyond requirements demonstrated by these workflows. Practorium-specific product boundaries, paths, and verification commands remain project guidance or plan content rather than bundled generic behavior.

## Runtime model

A workflow instance should minimally record:

```text
record version
workflow instance ID
project registry key
workflow key and definition version
primary plan/brief artifact path
selected route
current lifecycle state
current owning participant slot
bound concrete participants
recorded gate evidence
blocking reason, when present
revision
transition history
```

Runtime state is authoritative for lifecycle status. Plans and task packets are authoritative for rich execution content and task scope. Human-readable artifacts may reference workflow keys and instance IDs but must not become competing lifecycle state stores.

The package must define recovery semantics for Pi reload, resume, new session, fork, clone, interagent reconnect, and server restart. Branch-local Pi session entries may record observations or local attachment, but cannot be the sole authority for a workflow shared by several processes.

## Lifecycle shape

### Full phase

The top-level lifecycle is approximately:

```text
planning
  Architect owns planning
    -> ready-for-execution
  Sergeant becomes execution owner
    -> executing
  Sergeant coordinates the complete plan task loop
    -> ready-for-architecture-acceptance
  Architect performs bounded architecture acceptance
    -> ready-for-closeout
  Sergeant performs closeout
    -> closed
```

Architecture rejection returns to `executing` with correction evidence and the expected execution owner. User acceptance or an unresolved material decision may add an explicit blocking gate when authority changes or advancement must stop.

Inside `executing`, the Sergeant performs the existing loop without FSM transitions for each interaction:

1. select the next plan task;
2. dispatch it to a fresh Worker through direct interagent messaging;
3. receive the Worker's report directly;
4. review scope, behavior, checks, and acceptance status;
5. make only permitted narrow mechanical corrections or return substantive work to the appropriate Worker;
6. accept and integrate the task;
7. advance the task plan and dispatch the next task to a different fresh Worker;
8. transition the lifecycle only after all planned tasks are accepted and integrated.

Workers normally do not call the FSM. They read their substantial task packet, execute, and report directly to the dispatching Architect or Sergeant.

### Smaller workflows

Bounded work and bounded series use the same coarse principle with lighter routes and no full-phase architecture-acceptance/closeout ceremony. Seed planning remains Architect-owned and cannot authorize implementation. Exact states and legal correction paths must be derived faithfully from the existing workflow contracts during implementation planning.

## Pi extension surface

Keep the initial surface small. Expected commands include:

```text
/workflow
/workflow start <project> <plan-path>
/workflow status [project]
/workflow cancel <project>
/workflow override <project>
```

The exact transition command/tool shape should be selected after the engine and interagent feasibility investigation. Prefer one narrow agent-facing tool for lifecycle status and transition proposals rather than several overlapping tools.

The extension should automatically inject only:

- active project and workflow;
- current lifecycle state;
- current owning slot and concrete participant;
- the current state's instructions;
- required evidence or pending gate;
- legal next lifecycle actions;
- the primary artifact path.

Agents should not poll the FSM. Context refresh occurs at session attachment, incoming macro handoff, and lifecycle transition boundaries.

## Deterministic macro handoffs

When a legal transition changes top-level ownership, `pi-workflow` should:

1. validate current revision, actor role/slot, required artifact, and gate evidence;
2. record the transition;
3. resolve the bound direct interagent identity;
4. send a structured handoff containing project key, instance ID, revision, state, expected role, authorized next action, and artifact references;
5. attach the recipient process to the workflow context;
6. report a clear recoverable delivery failure rather than silently advancing.

Ordinary Sergeant-to-Worker dispatch and Worker-to-Sergeant reporting during `executing` remain direct interagent workflow activity, not lifecycle transitions.

## Interagent feasibility gate

Do not select or implement the runtime store until this gate is complete.

Investigate the actual interagent client/server implementation and verify:

- whether extensions have a programmatic direct-send API outside LLM tool calls;
- whether the server supports namespaced extension state or a durable event/history facility;
- server restart and message retention semantics;
- concurrent update and revision-check support;
- endpoint registration, collision, disconnect, and reconnect behavior;
- whether a small workflow namespace can be added without embedding workflow policy in interagent;
- how a recipient extension can receive a structured handoff and refresh Pi context;
- how concrete project-role identities are configured and enumerated.

Preferred outcome: reuse the existing interagent server for shared workflow instance state and direct delivery, avoiding project runtime files and a second server.

If the existing server cannot support durable, authoritative shared lifecycle state with a small coherent change, stop and return to the user with evidence and options. Do not silently add a filesystem store, second daemon, or session-local authority.

## Package and repository shape

The completed package must match sibling projects in the `pi-projects` superproject:

```text
AGENTS.md
CHANGELOG.md
IDEAS.md
LICENSE.md
PLAN.md
README.md
package.json
src/
  index.ts
  ...focused modules
tests/
  ...behavior and integration tests
tsconfig.json
```

Package requirements:

- npm name `@arcanemachine/pi-workflow`;
- source-loaded Pi extension from `src/index.ts`;
- `pi.extensions` package manifest entry;
- independently declared runtime dependencies;
- Pi-provided packages as optional peer dependencies;
- Node engine and publication metadata aligned with maintained siblings;
- TypeScript build/typecheck, Vitest, and Prettier scripts aligned with siblings;
- source, README, changelog, and license included in the tarball;
- no bundled roles or Practorium-specific product instructions;
- no sample skills, prompts, themes, or template extension behavior.

The superproject must:

- retain `packages/pi-workflow` as a Git submodule;
- add the extension path to the root `pi.extensions` list only after `src/index.ts` exists and loads safely;
- update the root package list/documentation when the package becomes usable;
- validate with pnpm from the superproject root;
- commit the child repository before each superproject pointer update.

## Implementation sequence

### Phase 0 — Planning baseline (complete)

Deliverables:

- create the independent `pi-workflow` repository and superproject submodule;
- preserve this implementation plan and deferred ideas;
- remove package-template sample behavior;
- commit the child planning baseline, then the superproject pointer;
- remove only superseded generic role/workflow idea records from Practorium, preserving product-level workflow ideas and current project guidance.

Completion condition: the package exists as a clean planning repository with no sample runtime behavior and all repositories have coherent commits.

### Phase 1 — Interagent and role integration investigation

Deliverables:

- identify exact interagent source and protocol anchors;
- resolve the interagent feasibility gate;
- identify the smallest stable optional contract for reading active `pi-role` role state;
- document confirmed runtime, delivery, recovery, and concurrency behavior;
- decide the authoritative state backend with the user if the preferred outcome is unsupported.

Completion condition: implementation tasks do not rely on guessed interagent or role behavior.

### Phase 2 — Package scaffold and workflow model

Deliverables:

- create sibling-aligned package/npm/TypeScript/test scaffolding;
- define and validate versioned workflow definitions and plan frontmatter;
- convert the four proven workflows faithfully;
- keep project-specific instructions outside bundled definitions;
- add deterministic definition and invalid-input tests.

Completion condition: definitions can be loaded and validated independently of a running Pi session.

### Phase 3 — Lifecycle engine and authoritative state

Deliverables:

- implement pure transition validation;
- implement distinct gate evidence and role/slot authorization;
- implement instance creation, revision checks, correction returns, cancellation, override, and recovery;
- implement the approved authoritative store;
- test invalid transitions, stale revisions, separate approvals, restart/recovery, and two independent registered projects.

Completion condition: the engine deterministically preserves lifecycle authority without Pi prompt interpretation.

### Phase 4 — Pi commands and focused context

Deliverables:

- implement workspace registry and single-project configuration;
- implement start, status, cancel, override, and transition proposal surfaces;
- inject only current-state guidance;
- attach/recover sessions without agent polling;
- provide explainable errors and user confirmations in TUI and safe behavior in RPC/print modes.

Completion condition: one process can launch, inspect, transition, cancel, and recover a workflow through Pi.

### Phase 5 — Direct interagent lifecycle handoffs

Deliverables:

- bind workflow participant slots to explicit project-role identities;
- perform direct macro handoffs on approved ownership transitions;
- handle unavailable, conflicting, disconnected, and stale participants recoverably;
- preserve the existing Sergeant-owned sequential Worker loop without FSM micro-transitions;
- verify direct Architect-to-Worker and Architect-to-Sergeant routes.

Completion condition: separate Pi processes can advance one workflow through its macro lifecycle while ordinary task coordination remains direct and efficient.

### Phase 6 — Practorium migration and acceptance

Deliverables:

- configure the `/workspace` project registry for Practorium and other intended projects;
- migrate generic workflow definitions out of Practorium while preserving project supplements, product boundaries, and task templates that remain project-specific;
- replace duplicated top-level `PLAN.md`/phase lifecycle authority with `pi-workflow` state where accepted;
- verify project recovery and documentation;
- remove only superseded generic workflow material after migration is proven.

Completion condition: Practorium uses `pi-workflow` for real work without losing established approval, routing, acceptance, correction, or closeout behavior.

### Phase 7 — Package completion and release readiness

Deliverables:

- complete README usage, configuration, command, lifecycle, and troubleshooting documentation;
- complete changelog and npm metadata;
- add superproject extension loading and package-list integration;
- run typecheck, tests, build, formatting, root workspace checks, and `npm pack --dry-run`;
- verify the extension in live Pi sessions;
- obtain explicit user acceptance for the complete user-facing workflow.

Completion condition: the package is independently installable, sibling-aligned, documented, verified, and ready for an explicitly authorized release process.

## Verification strategy

### Deterministic tests

Test:

- definition and plan validation;
- legal and illegal transitions;
- actor role and participant-slot eligibility;
- distinct approval evidence;
- stale revisions and concurrent attempts;
- correction and user-override transitions;
- workspace registry path normalization and overlap;
- project-role participant binding;
- reload/resume/reconnect recovery;
- unavailable macro-handoff targets;
- isolation of two registered projects.

### Natural session tests

Do not prove role/workflow behavior only with prompts that tell the model the expected answer. Exercise ordinary sessions in which the extension itself supplies current state and instructions.

Required acceptance scenarios:

1. Architect plans a full phase and transitions it to ready for execution.
2. `pi-workflow` directly hands the phase to the configured Sergeant.
3. Sergeant runs multiple substantial task packets through distinct sequential Workers without requiring Worker FSM calls.
4. Sergeant transitions the integrated phase to architecture acceptance.
5. Architect accepts or returns the phase through a legal correction path.
6. Sergeant closes an accepted phase.
7. Direct bounded work runs Architect-to-Worker without a Sergeant.
8. A wrong-role transition is rejected clearly.
9. Reading approval cannot satisfy routing, execution, user acceptance, or commit gates.
10. Two registered projects hold independent active workflows with distinct project-role identities.
11. Restarted or resumed processes recover authoritative state without reconstructing it from prose.

New or materially changed user-facing behavior requires explicit user approval or user-initiated waiver before acceptance, integration, or release readiness.

## Explicit V1 non-goals

Do not implement:

- pub/sub channels;
- filesystem handoffs;
- alternate transports or public adapter plugins;
- a separate workflow daemon;
- dashboards or a multi-project control-plane TUI;
- cross-machine project identity;
- multiple workflows within one registered project;
- parallel workflows or Git worktree orchestration;
- task dependency DAGs;
- nested workflows;
- arbitrary user-authored workflow languages;
- automatic role activation or role-team APIs;
- per-tool, per-file, or per-Worker FSM transitions;
- bundled Practorium product instructions.

See `IDEAS.md` for future directions and their promotion triggers.

## Completion criteria

V1 is complete when:

- all four bundled workflows have versioned validated lifecycle definitions;
- lifecycle authority is deterministic and recoverable across participating Pi processes;
- plan artifacts remain the focal source of rich execution knowledge;
- workspace registry configuration supports multiple nested projects from a Pi process rooted at `/workspace`;
- project-role identities support direct macro handoffs and sequential fresh Workers;
- ordinary Sergeant-to-Worker loops do not incur FSM polling or micro-transition overhead;
- role eligibility and distinct user gates are enforced;
- Practorium successfully uses the extension for accepted real workflow execution;
- package structure, documentation, npm metadata, tests, formatting, tarball, and superproject integration match maintained siblings;
- live Pi verification and explicit user acceptance are complete;
- deferred features remain out of V1.
