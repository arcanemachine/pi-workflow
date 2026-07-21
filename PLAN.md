# pi-workflow V1 execution plan

Status: Approved architecture and executable implementation plan. Phase 0 and Phase 1 are complete. Implementation starts at Task 1.

## How to use this plan

This is the authoritative V1 execution artifact. It is written so future implementation sessions do not need to reconstruct the architecture or ask the user to select routine mechanisms.

When the user authorizes implementation:

1. use the full-phase coordinated route;
2. assign each `pi-workflow`, `pi-role`, or Practorium task to one fresh Worker session;
3. give that Worker only the task packet and its task-specific required reading;
4. have the Sergeant review, verify, accept, and commit the task before dispatching the next task;
5. use a different fresh Worker for each distinct task;
6. route Task 7 through a fresh interagent `leader`, which must follow that repository's leader/executor workflow instead of the Architect/Sergeant/Worker route;
7. return to the user only for a stop condition, a repository-mandated dispatch gate, or the required user-facing acceptance gate.

Do not reopen decisions recorded under **Accepted architecture**. Do not read every referenced file up front. Each task names the minimum sources its owner must read.

This plan does not authorize pushing, publishing, or releasing packages. Those actions still require explicit user authorization.

## Objective

Create `@arcanemachine/pi-workflow`, a source-loaded Pi extension that deterministically owns macro workflow lifecycle state while retaining Markdown plans as the focal source of project-specific knowledge.

V1 must run the Architect, Sergeant, and Worker workflows proven in Practorium across separate Pi processes with:

- explicit lifecycle ownership;
- legal, revision-checked transitions;
- distinct user gates;
- project-role participant bindings;
- direct structured interagent handoffs;
- durable local recovery;
- focused current-state prompt context;
- sequential fresh Workers without FSM micro-orchestration.

## Completion definition

V1 is complete only when:

- the package is independently installable and matches maintained sibling conventions;
- all four bundled workflows load and validate deterministically;
- lifecycle state and transition history survive Pi and interagent restarts;
- concurrent processes cannot both commit the same revision;
- one active workflow per registered project is enforced;
- separate registered projects can run concurrently;
- macro handoffs use exact project-role identities and structured interagent payloads;
- Workers do not poll or update the FSM during ordinary task execution;
- optional `pi-role` mismatches are detected without making `pi-role` mandatory;
- Practorium successfully executes an accepted real workflow through the extension;
- typecheck, tests, build, formatting, package checks, root workspace checks, live Pi verification, and explicit user acceptance pass;
- deferred features remain outside V1.

## Accepted architecture

These decisions are settled. Implementers must not substitute alternatives without returning to the Architect and user.

### Product and workflow boundaries

- The package name is singular: `pi-workflow`.
- Markdown plans remain authoritative for purpose, decisions, task scope, non-goals, task packets, verification instructions, and acceptance expectations.
- The FSM is authoritative for current lifecycle state, revision, owner, participant bindings, gates, blocking status, and transition history.
- The FSM is coarse. It does not model tool calls, files, tests, todos, Worker progress, or ordinary Sergeant-to-Worker interactions.
- Workers normally do not call or poll the workflow engine.
- V1 bundles only `bounded-work`, `bounded-series`, `seed-planning`, and `full-phase`.
- V1 serves the existing Architect, Sergeant, and Worker contracts first. It is not a generic workflow-authoring platform.
- One registered project may have one active V1 workflow. Different registered projects may each have one.

### Roles and participants

- Roles remain standalone operating contracts.
- Workflows own participant slots, routes, lifecycle ownership, and handoffs.
- `pi-role` remains optional and independently usable.
- `pi-workflow` may validate an effective `pi-role` key but must not activate, reload, disable, or otherwise mutate roles.
- Mandatory authorization comes from the bound participant identity and workflow slot.
- When reliable `pi-role` state exists, an inactive role or mismatched role blocks the transition.
- When `pi-role` is absent and has never published effective state, the transition may proceed with a visible `role-unverified` diagnostic.
- A direct Architect-to-Worker route is valid. That route assigns dispatch, review, integration, acceptance handling, authorized lifecycle updates, final verification, and reporting to the Architect.
- Worker count is dynamic. Plans define substantial tasks; execution allocates fresh sequential Worker identities.

### Identity convention

Concrete interagent identities are:

```text
<participant-prefix>-architect
<participant-prefix>-sergeant
<participant-prefix>-worker
<participant-prefix>-worker-2
<participant-prefix>-worker-3
```

The project registry key is the default participant prefix. A configured `participantPrefix` may override it. Numbered Workers are distinct concrete sessions whose role key is still `worker`.

Workflow delivery always requests exact target resolution. It must never rely on interagent's unique-prefix fallback.

### State and storage

- Authoritative V1 state is owned by `pi-workflow`, not interagent, project files, or Pi session entries.
- Use the built-in `node:sqlite` API. Do not add an ORM, `better-sqlite3`, `sqlite3`, or another storage dependency.
- Require Node.js `>=24.16.0`.
- Isolate all `node:sqlite` imports and SQL behind `src/store/sqlite.ts` and adjacent store types/schema helpers.
- Store the database in the platform user-state directory, never in a project repository.
- All participating V1 Pi processes must share that user-state filesystem.
- Use short `BEGIN IMMEDIATE` transactions, prepared statements, a nonzero busy timeout, and expected-revision writes.
- Store both the current instance record and append-only transition/delivery events in the same transaction when they change together.
- Do not introduce a daemon. Each Pi process opens the same local database as needed.
- Separate machines, isolated containers or home directories, and remote state are deferred.

### Interagent boundary

- Interagent is the only V1 coordination transport.
- Use direct messages only. Do not use pub/sub, broadcasts, filesystem inboxes, or alternate transports.
- Use a versioned targeted custom payload for macro handoffs.
- Handoff messages are notifications to consult authoritative state; they are not lifecycle authority.
- Commit an authorized lifecycle transition before attempting delivery.
- Record delivery as `pending`, `delivered`, or `failed` separately. A retry must not duplicate the lifecycle transition.
- Ordinary task dispatch and Worker reports remain normal direct interagent text messages outside the workflow FSM.

### Dependency policy

Runtime dependencies are limited to what active V1 needs:

- `node:sqlite`, `node:crypto`, `node:fs`, `node:os`, and `node:path` from Node;
- Pi packages as optional peer dependencies;
- no schema library, ORM, YAML dependency, WebSocket client, or generic state-machine framework.

Use TypeScript types plus focused hand-written runtime validators. Use Pi's existing frontmatter parser for plan files.

## Verified Phase 1 findings

Implementation may rely on these facts:

- Interagent exposes importable Python direct-send, custom-message, and list operations.
- Its server stores connections, channels, and subscriptions only in memory.
- It has no durable message history, extension state, or compare-and-swap facility.
- Server restart clears bus state and undelivered messages.
- Active names and session IDs are server-global; concurrent collisions are rejected.
- Disconnected names and session IDs can reconnect.
- Listing exposes `session_id`, routing `name`, and display-only `label`.
- Routing checks exact names first and then unique prefixes.
- Targeted `custom` frames preserve opaque JSON in the server, but the current Pi integration discards the structured payload when injecting the message into Pi.
- The Pi listener can reconnect, inject a message with `pi.sendMessage`, trigger a turn, and allow `before_agent_start` to refresh context.
- `pi-role` keeps live role state in a private closure and currently persists versioned historical session entries.
- Node 24.16 exposes `node:sqlite` as Stability 1.2, with `DatabaseSync`, prepared statements, raw transaction SQL, and configurable busy timeout.
- A local two-process spike on Node 24.16 and Node 26.5 confirmed that an expected-revision update allows exactly one contender to advance a revision.

## Runtime composition

An active instance is:

```text
bundled workflow definition
+ project Markdown plan/brief
+ SQLite runtime record and event history
+ current participant session context
```

Authority is divided as follows:

| Concern | Authority |
| --- | --- |
| Purpose, decisions, task scope, non-goals | Markdown plan |
| Task packets and verification instructions | Markdown plan/task artifacts |
| Current lifecycle state and revision | SQLite runtime record |
| Current owner and participant bindings | SQLite runtime record |
| Gate evidence and blocking status | SQLite runtime record/events |
| Transition and delivery history | SQLite events |
| Current role instructions | `pi-role` when installed |
| Message delivery and presence | interagent |
| Project-specific product rules | Project agent guidance |

No component may infer current lifecycle state from headings, checkboxes, or prose in the plan.

## Workspace configuration contract

Pi normally starts from `/workspace`. Load global settings first and workspace/project settings second using the same precedence conventions as maintained Pi extensions.

Configuration shape:

```json
{
  "pi-workflow": {
    "dataDir": "~/.local/state/pi-workflow",
    "projects": {
      "practorium": {
        "root": "projects/practorium",
        "plansDir": "plans"
      },
      "inter-agent": {
        "root": "projects/inter-agent",
        "plansDir": "docs/plans"
      },
      "pi-workflow": {
        "root": "projects/pi/packages/pi-workflow",
        "plansDir": "plans"
      }
    }
  }
}
```

Project entry fields:

```ts
interface WorkflowProjectConfig {
  root: string;
  plansDir: string;
  participantPrefix?: string;
  participants?: {
    architect?: string;
    sergeant?: string;
    workerPrefix?: string;
  };
}
```

Rules:

- Registry keys are stable local project namespaces.
- `root` and `plansDir` are required non-empty paths.
- Relative project roots, plan directories, and `dataDir` resolve from Pi's runtime cwd. They do not resolve from the physical target of a symlinked settings file. With Pi started in `/workspace`, `root: "projects/practorium"` resolves to `/workspace/projects/practorium`.
- Normalize and resolve paths before use.
- Reject a project root outside the configured workspace unless the user explicitly configured an absolute root.
- Constrain plan paths to the registered project root and configured plan directory.
- Nested repositories and submodules are valid roots.
- Explicit project selection wins when roots overlap.
- Infer a project only from an explicit plan path and only by the longest matching registered root.
- The registry key is the default participant prefix.
- Default participant identities derive from the convention above; explicit participant fields override only their named slot/prefix.
- `dataDir` is optional. Its platform default is `${XDG_STATE_HOME:-~/.local/state}/pi-workflow` on Linux and the platform application-state location on macOS. Create it with restrictive permissions.
- The database filename is `workflows.db`.
- `PI_WORKFLOW_DATA_DIR` may override the state directory for tests and isolated installations. It takes precedence over settings.

## Plan artifact contract

Every plan or brief used to start a workflow has frontmatter:

```yaml
---
kind: workflow-plan
id: phase-31-example
workflow: full-phase
workflow-version: 1
route: coordinated
user-facing: true
---
```

Required fields:

- `kind`: exactly `workflow-plan`;
- `id`: non-empty stable identifier, unique within the registered project;
- `workflow`: one bundled workflow key;
- `workflow-version`: positive integer matching the bundled definition;
- `route`: a route supported by that definition;
- `user-facing`: boolean controlling the mandatory user-acceptance gate.

Rules:

- Parse with Pi's frontmatter parser.
- Reject missing, unknown, malformed, or mismatched fields with field-specific errors.
- Preserve unknown frontmatter fields for project use but do not let them change lifecycle semantics.
- Store only the project-relative artifact path in runtime state.
- Validate that the artifact exists and remains inside the configured plan directory at workflow start.
- Do not copy long-form Markdown into SQLite.
- Do not parse task checkboxes into lifecycle state.

## Workflow-definition contract

Bundled definitions are typed TypeScript data under `src/workflows/definitions/`. V1 does not load user-authored workflow definitions.

```ts
type ParticipantSlot = "architect" | "sergeant" | "worker" | "user";

type GateKey =
  | "planning-reading"
  | "decision-approval"
  | "workflow-launch"
  | "execution-route"
  | "execution-authorization"
  | "user-acceptance"
  | "architecture-acceptance"
  | "cancellation"
  | "override"
  | "commit-authorization";

type ResponsibilityKey =
  | "planning"
  | "dispatch"
  | "task-execution"
  | "task-review"
  | "integration"
  | "lifecycle-execution"
  | "user-acceptance-handling"
  | "architecture-acceptance"
  | "closeout"
  | "final-verification"
  | "reporting";

type ArtifactKind =
  | "primary-plan"
  | "task-packet"
  | "verification-evidence"
  | "user-acceptance-evidence"
  | "architecture-acceptance-evidence"
  | "correction-evidence"
  | "closeout-evidence"
  | "blocking-resolution-evidence";

interface WorkflowDefinition {
  key: "bounded-work" | "bounded-series" | "seed-planning" | "full-phase";
  version: 1;
  title: string;
  selectionGuidance: string;
  initialState: string;
  terminalStates: string[];
  requiredResponsibilities: ResponsibilityKey[];
  routes: RouteDefinition[];
  gateKeys: GateKey[];
  states: StateDefinition[];
  transitions: TransitionDefinition[];
}

interface RouteDefinition {
  key: string;
  requiredSlots: ParticipantSlot[];
  responsibilityAssignments: Partial<
    Record<ResponsibilityKey, ParticipantSlot>
  >;
}

interface StateDefinition {
  key: string;
  owner:
    | { mode: "route"; byRoute: Record<string, ParticipantSlot> }
    | { mode: "retain-current" };
  instructionsFile: string;
  terminal?: boolean;
}

interface TransitionDefinition {
  key: string;
  from: string[];
  to: string;
  actorByRoute: Record<string, ParticipantSlot>;
  requiredArtifactKinds: ArtifactKind[];
  requiredGateKeys: GateKey[];
  effect?: "normal" | "block" | "resume" | "cancel" | "override";
  handoffByRoute: Record<string, "none" | "macro">;
  correction?: boolean;
}
```

Hand-written validation must reject:

- duplicate workflow, route, state, or transition keys;
- missing initial or terminal states;
- transitions referencing unknown states or slots;
- unreachable nonterminal states;
- a route-owned state or transition without an owner/actor entry for every supported route;
- `retain-current` ownership on any state other than `blocked` or a terminal state;
- a transition without a handoff-mode entry for every supported route;
- routes missing a slot required by a state or transition;
- any route that does not assign every `requiredResponsibilities` key;
- responsibility gaps in routes that omit Sergeant;
- a route whose handoff mode is `macro` when its resolved source and destination owner are the same;
- a route whose handoff mode is `none` when its resolved source and destination owner differ;
- a gate key not declared by the workflow;
- instruction files that cannot be loaded;
- unsupported definition versions.

State instructions are Markdown assets under `src/workflows/instructions/`. They contain only generic current-state responsibilities, evidence requirements, legal next actions, and stop conditions. They must not contain Practorium-specific paths, product rules, or verification commands.

## Bundled workflow semantics

The existing Practorium workflow documents are normative behavioral sources. Conversion is transcription and normalization, not redesign. If a source uses project-specific wording, preserve the generic lifecycle obligation and leave the project-specific content in Practorium guidance.

### Common blocking operations

Every bundled workflow supports an orthogonal blocking loop without treating ordinary work as blocked lifecycle traffic:

- `block`: any nonterminal, nonblocked state moves to `blocked`, retains the current owner, and records `previousState`, a non-empty reason, actor, and timestamp;
- `resume`: `blocked` returns to `previousState`, retains the resolved owner for that state and route, and requires non-empty resolution evidence;
- a participant owner may block and resume an operational impediment;
- a blocker whose recorded kind is `user-decision` can be resumed only by a user command;
- cancellation remains available while blocked;
- no other transition may leave `blocked`.

### `full-phase`

Routes:

- `coordinated`: Architect plans and accepts architecture; Sergeant owns execution and closeout; fresh Workers execute substantial tasks.
- `direct`: Architect additionally owns dispatch, review, integration, execution-state advancement, acceptance handling, final verification, and reporting; fresh Workers execute substantial tasks.

`requiredResponsibilities` contains all eleven canonical responsibility keys. Assignments are fixed:

| Responsibility | `coordinated` | `direct` |
| --- | --- | --- |
| planning | Architect | Architect |
| dispatch | Sergeant | Architect |
| task-execution | Worker | Worker |
| task-review | Sergeant | Architect |
| integration | Sergeant | Architect |
| lifecycle-execution | Sergeant | Architect |
| user-acceptance-handling | Architect | Architect |
| architecture-acceptance | Architect | Architect |
| closeout | Sergeant | Architect |
| final-verification | Sergeant | Architect |
| reporting | Sergeant | Architect |

The definition declares all canonical gate keys because full-phase planning and acceptance must keep every approval category distinct. A gate is required only on the transitions that name it.

Macro states and ownership:

```text
planning                             Architect
ready-for-execution                  Sergeant on coordinated route; Architect on direct route
executing                            Sergeant on coordinated route; Architect on direct route
ready-for-architecture-acceptance    Architect
ready-for-closeout                   Sergeant on coordinated route; Architect on direct route
closed                               terminal
cancelled                            terminal
blocked                              current owner retained with blocking reason
```

Required transitions:

- create instance in `planning` under Architect ownership;
- approve ready execution: `planning -> ready-for-execution`, Architect actor, approved plan and execution-route gate required, macro handoff when ownership changes;
- begin execution: `ready-for-execution -> executing`, current execution owner;
- complete integrated execution: `executing -> ready-for-architecture-acceptance`, execution owner, all active-sequence tasks accepted and integrated, macro handoff to Architect;
- accept architecture: `ready-for-architecture-acceptance -> ready-for-closeout`, Architect, architecture evidence required, and user-acceptance evidence required when `user-facing: true`;
- reject architecture: `ready-for-architecture-acceptance -> executing`, Architect, correction evidence required, macro handoff to execution owner;
- complete closeout: `ready-for-closeout -> closed`, closeout owner, final verification and clean-state evidence required;
- return closeout correction: `ready-for-closeout -> executing`, closeout owner, correction evidence required;
- cancel from any nonterminal state through a user-authorized cancellation event;
- override only through a user command with a required reason and explicit destination validation.

The execution owner runs the substantial task loop without FSM transitions:

1. select the next task from the plan;
2. allocate the next unused Worker identity;
3. send that Worker the complete task packet directly;
4. receive the report directly;
5. review scope, behavior, checks, and acceptance status;
6. make only workflow-permitted narrow corrections or return substantive work;
7. accept, integrate, and commit the task;
8. update the Markdown task artifact according to project convention;
9. dispatch the next task to a different fresh Worker;
10. transition only when the complete active task sequence is integrated.

### `bounded-work`

Use for one substantive, well-bounded implementation task.

- Route is `direct`.
- `requiredResponsibilities` contains every canonical responsibility except `architecture-acceptance`.
- Responsibility mapping assigns `task-execution` to Worker and every required remaining responsibility to Architect.
- Gate keys are `planning-reading`, `decision-approval`, `workflow-launch`, `execution-route`, `execution-authorization`, `user-acceptance`, `cancellation`, `override`, and `commit-authorization`.
- Architect owns planning, dispatch, review, integration, acceptance handling, state advancement, final verification, and reporting.
- One fresh Worker executes the task.
- Do not add Sergeant or full-phase architecture-acceptance/closeout ceremony.
- States are `planning`, `ready-for-execution`, `executing`, `ready-for-review`, `closed`, `cancelled`, and `blocked`.
- User acceptance is required before closure only when `user-facing: true`.
- Substantive review failure returns `ready-for-review -> executing` with correction evidence.

### `bounded-series`

Use for a small concrete sequence of settled, low-risk tasks.

- Route is `direct`.
- `requiredResponsibilities` and its mapping match bounded work: `task-execution` belongs to Worker and all remaining required responsibilities belong to Architect.
- Gate keys match bounded work.
- Architect owns the series and the responsibilities assigned to the execution owner above.
- Each distinct substantive task uses a different fresh Worker.
- Task sequencing remains in the Markdown series artifact, not in the FSM.
- States match bounded work: `planning`, `ready-for-execution`, `executing`, `ready-for-review`, `closed`, `cancelled`, and `blocked`.
- Advance to review only after the entire series is accepted and integrated.
- Review failure returns to `executing` with correction evidence.
- Do not promote the series to full-phase ceremony unless evidence shows that its scope or risk no longer fits; that is a stop condition for the Architect.

### `seed-planning`

Use to create or refine a durable future planning seed. It never authorizes implementation.

- Route is `architect-only`.
- `requiredResponsibilities` contains only `planning`, `user-acceptance-handling`, `final-verification`, and `reporting`, all assigned to Architect.
- Gate keys are `planning-reading`, `decision-approval`, `workflow-launch`, `user-acceptance`, `cancellation`, `override`, and `commit-authorization`.
- Architect is the sole participant owner.
- States are `planning`, `ready-for-review`, `closed`, `cancelled`, and `blocked`.
- Closure means the seed preserves verified facts, facts to revalidate, user direction, open decisions, promotion triggers, likely source areas, required future reading, verification implications, acceptance implications, and stop conditions.
- A closed seed remains non-executable until the user separately promotes it into an implementation plan.
- No Worker dispatch, Sergeant ownership, implementation transition, or code-change authority exists in this workflow.

## Runtime record contract

```ts
interface ParticipantBindings {
  architect: string;
  sergeant?: string;
  workerPrefix: string;
}

interface BlockingRecord {
  previousState: string;
  kind: "operational" | "user-decision";
  reason: string;
  recordedAt: string;
  recordedBy: string;
}

interface HandoffRecord {
  deliveryId: string;
  transitionRevision: number;
  targetIdentity: string;
  status: "pending" | "delivered" | "failed";
  attempt: number;
  lastAttemptAt?: string;
  diagnostic?: string;
}

interface WorkflowInstanceRecord {
  recordVersion: 1;
  id: string;
  projectKey: string;
  workflowKey: string;
  workflowVersion: 1;
  artifactPath: string;
  routeKey: string;
  userFacing: boolean;
  state: string;
  ownerSlot: ParticipantSlot;
  participants: ParticipantBindings;
  allocatedWorkers: string[];
  gates: Record<string, GateEvidence>;
  blocking: BlockingRecord | null;
  handoff: HandoffRecord | null;
  revision: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Participant bindings store concrete routing identities, not inferred roles. Worker allocation records every used identity so a completed task cannot silently reuse a Worker for a distinct task.

Gate evidence records:

```ts
interface GateEvidence {
  key: string;
  kind: "user-command" | "user-confirmation" | "participant-evidence";
  actorIdentity?: string;
  actorSlot?: ParticipantSlot;
  recordedAt: string;
  revision: number;
  details: Record<string, unknown>;
}
```

Never allow one gate record to satisfy a differently keyed gate. Reading approval, route approval, execution authorization, user acceptance, architecture acceptance, and commit authority remain distinct.

## SQLite contract

Default database: `<user-state-dir>/pi-workflow/workflows.db`.

Use this schema. Identifier names and column semantics are fixed for schema version 1:

```sql
CREATE TABLE workflow_instances (
  id TEXT PRIMARY KEY,
  project_key TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  workflow_key TEXT NOT NULL,
  state_key TEXT NOT NULL,
  owner_slot TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  record_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX one_active_workflow_per_project
  ON workflow_instances(project_key)
  WHERE active = 1;

CREATE TABLE workflow_events (
  instance_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (instance_id, revision),
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id)
);
```

Store rules:

- Set and validate `PRAGMA user_version`.
- Enable foreign keys.
- Open every connection with a 5000 ms busy timeout.
- Keep transactions short and synchronous.
- Start mutations with `BEGIN IMMEDIATE`.
- Update using `WHERE id = ? AND revision = ?`.
- Treat `changes !== 1` as a stale revision and roll back.
- Increment revision exactly once per committed lifecycle or delivery event.
- Update the current JSON record and append its event in one transaction.
- Always roll back in `catch` when `database.isTransaction` is true.
- Close connections deterministically.
- Fail closed on a newer unsupported schema version.
- Produce actionable errors containing the operation and database path but not secrets or full plan contents.
- Create the state directory with mode `0700` and database with restrictive user access where the platform permits.
- Inject clock and ID generation in tests; production uses UTC ISO timestamps and `crypto.randomUUID()`.

Repository and session forks do not copy SQLite authority. A resumed session reads current state. A cloned session that attempts to reuse an active interagent name receives an identity-collision error and must not mutate workflow state.

## Transition-engine contract

The engine is pure except for its caller-provided time and ID values. It does not read files, SQLite, Pi state, or interagent directly.

Input:

```ts
interface TransitionRequest {
  instance: WorkflowInstanceRecord;
  definition: WorkflowDefinition;
  transitionKey: string;
  expectedRevision: number;
  actor: {
    kind: "user" | "participant";
    identity?: string;
    slot?: ParticipantSlot;
    effectiveRoleKey?: string;
    roleValidation: "matched" | "mismatched" | "inactive" | "unverified";
  };
  evidence: Record<string, unknown>;
  now: string;
}
```

Map effective-role entries before calling the engine: an active matching key is `matched`; an active different key is `mismatched`; a valid inactive entry is `inactive`; no valid effective entry is `unverified`.

Output is either a complete next record plus event or a typed rejection. Engine rejection codes include:

- `INSTANCE_NOT_FOUND`;
- `NO_ACTIVE_WORKFLOW`;
- `ACTIVE_WORKFLOW_EXISTS`;
- `STALE_REVISION`;
- `UNKNOWN_TRANSITION`;
- `ILLEGAL_TRANSITION`;
- `WRONG_OWNER`;
- `WRONG_PARTICIPANT`;
- `ROLE_MISMATCH`;
- `ROLE_INACTIVE`;
- `MISSING_ARTIFACT`;
- `MISSING_EVIDENCE`;
- `MISSING_GATE`;
- `USER_COMMAND_REQUIRED`;
- `BLOCKED`;
- `TERMINAL_INSTANCE`;
- `HANDOFF_PENDING`.

`ROLE_UNVERIFIED` is a nonblocking engine diagnostic, not a rejection. `HANDOFF_TARGET_UNAVAILABLE`, `HANDOFF_DELIVERY_FAILED`, and helper/runtime setup errors belong to the interagent handoff layer, not the pure engine.

Validation order is fixed:

1. instance and record/definition version;
2. expected revision;
3. terminal-instance rejection;
4. blocking rules, allowing only resume or cancel as specified;
5. outstanding handoff rejection for lifecycle transitions, while allowing delivery retry;
6. transition existence and source-state legality;
7. actor identity and route-resolved slot;
8. `mismatched` or `inactive` role rejection; `unverified` adds only the nonblocking diagnostic;
9. required artifacts;
10. required gate keys and whether direct user evidence is required;
11. remaining transition evidence;
12. state effects and route-resolved ownership/handoff effects.

Workflow start, cancellation, override, and transitions requiring a user gate need direct user evidence from a user command or a named TUI confirmation. Agent tools may open that confirmation but must not manufacture, infer, reuse, or bypass its result.

## Effective role and identity contracts

### `pi-role`

Add a stable custom session entry separate from historical UI messages:

```text
customType: pi-role:effective-state
```

```ts
interface EffectiveRoleStateEntry {
  version: 1;
  active: boolean;
  reason:
    | "activated"
    | "reloaded"
    | "restored"
    | "disabled"
    | "new-session"
    | "unavailable";
  key?: string;
  name?: string;
  source?: "user" | "project";
  path?: string;
}
```

`pi-role` appends the effective entry after session startup resolves the actual role and after every role mutation. Active entries include the complete role identity. Inactive entries omit it. Preserve existing `pi-role:state` entries for compatibility.

`pi-workflow` scans the current branch for the latest valid effective entry. It does not import `pi-role`, call its commands, or share its runtime object.

### Pi interagent integration

Formalize its effective identity entry as:

```text
customType: inter-agent:effective-state
```

```ts
interface EffectiveInteragentStateEntry {
  version: 1;
  connected: boolean;
  name?: string;
  label?: string | null;
  reason: "connected" | "restored" | "disconnected" | "listener-failed";
}
```

Publish it whenever listener connection state changes. Preserve the prior entry format only as a migration input if existing sessions require it.

`pi-workflow` uses the latest valid effective identity entry for participant authorization. A saved but disconnected identity cannot authorize a transition that requires a connected sender.

## Interagent handoff contract

Extend interagent targeted `send` and `custom` frames with optional JSON field `exact: boolean`, defaulting to `false` for current prefix-compatible behavior. Targeted custom frames also accept the existing validated `from_name` override used by direct text helpers. Add helper/CLI flags `--exact` and `--from`; workflow calls always send `exact: true` and the current bound participant identity as `from_name`.

Custom type:

```text
pi-workflow.handoff.v1
```

Payload:

```ts
interface WorkflowHandoffV1 {
  version: 1;
  projectKey: string;
  instanceId: string;
  revision: number;
  state: string;
  ownerSlot: ParticipantSlot;
  targetIdentity: string;
  expectedRoleKey?: string;
  authorizedNextActions: string[];
  artifactPaths: string[];
  deliveryId: string;
}
```

Sender sequence:

1. validate the lifecycle transition;
2. commit the transition and its `handoff-pending` record/event atomically at revision R with a new delivery ID;
3. confirm the exact target is currently listed;
4. send a payload containing revision R through the interagent helper with exact targeting;
5. commit `handoff-delivered` or `handoff-failed` as the next record revision without changing lifecycle state;
6. report the resulting lifecycle state, current record revision, and delivery status.

Recipient sequence:

1. Pi interagent integration preserves `custom_type` and JSON payload in the injected custom message;
2. the message triggers a Pi turn;
3. `pi-workflow` refreshes SQLite state during `before_agent_start`;
4. it requires the same project, instance, target identity, owner, lifecycle state, and delivery ID; the current record revision may be greater than payload revision R only because delivery-status events were committed afterward;
5. a changed lifecycle state, owner, delivery ID, lower current revision, or other mismatch makes the notification stale and unable to change state;
6. valid messages inject only current-state instructions and authorized next actions.

Delivery retry does not repeat the lifecycle transition. It atomically replaces the current handoff with a new `deliveryId`, increments `attempt`, sets status to `pending`, and commits record revision R before sending the new payload. The recipient accepts only the latest delivery ID; delayed payloads from earlier attempts become stale. Success or failure then commits the next record revision without changing lifecycle state.

## Pi surface

### User commands

```text
/workflow
/workflow start <project> <plan-path>
/workflow status [project]
/workflow transition <project> <transition-key> --revision <n>
/workflow retry-handoff <project>
/workflow cancel <project> --reason <text>
/workflow override <project> <transition-key> --revision <n> --reason <text>
```

Behavior:

- `/workflow` shows concise usage and active project summaries.
- `start` validates configuration, plan frontmatter, route, artifact path, participant bindings, and absence of another active project workflow before writing anything.
- In TUI mode, `start`, `cancel`, `override`, and any transition with an unsatisfied user gate show a gate-specific summary and require `ctx.ui.confirm`.
- In RPC/print modes without interactive confirmation, user-gated commands require an explicit `--confirm` flag and otherwise fail without mutation; an agent-tool transition returns `USER_COMMAND_REQUIRED` with the exact slash command.
- `status` is read-only and never starts interagent, changes state, or delivers messages.
- `transition` is the user path for transitions requiring user gate evidence. It must include expected revision.
- `retry-handoff` requires an existing failed or pending handoff and does not change lifecycle state.
- `cancel` and `override` require a non-empty reason and generate durable user-command evidence.
- Errors are concise, typed, and actionable.

### Agent tool

Register one narrow tool named `pi_workflow`:

```ts
{
  action: "status" | "transition" | "retry_handoff";
  project?: string;
  transition?: string;
  expectedRevision?: number;
  evidence?: Record<string, unknown>;
}
```

Rules:

- `status` is read-only.
- `transition` is allowed only for a transition authorized to the current connected participant slot.
- In TUI mode, a transition with an unsatisfied user gate opens one gate-specific confirmation and records `user-confirmation` evidence only when accepted.
- Without interactive UI, the tool rejects the unsatisfied user gate and tells the agent the exact slash command the user must invoke.
- `retry_handoff` is allowed only to the current owner and does not repeat the transition.
- Do not create separate overlapping status, transition, gate, or handoff tools.

### Focused prompt context

During `before_agent_start`, inject only:

- project key and workflow key/version;
- current state and revision;
- current owning slot and concrete identity;
- local participant slot and effective role validation status;
- primary artifact path;
- current state's Markdown instructions;
- required evidence or blocking reason;
- legal next lifecycle actions;
- current handoff failure/pending status when relevant.

Do not inject full definitions, transition history, unrelated workflow instructions, all project plans, deferred ideas, or other projects' active state.

Refresh context on session attachment, incoming handoff-triggered turns, and successful transitions. Agents do not poll.

## Package layout

Create this structure:

```text
AGENTS.md
CHANGELOG.md
IDEAS.md
LICENSE.md
PLAN.md
README.md
package.json
tsconfig.json
src/
  index.ts
  config.ts
  errors.ts
  plans.ts
  context.ts
  commands.ts
  roles.ts
  identity.ts
  workflows/
    types.ts
    validate.ts
    load.ts
    definitions/
      bounded-work.ts
      bounded-series.ts
      seed-planning.ts
      full-phase.ts
    instructions/
      bounded-work/
      bounded-series/
      seed-planning/
      full-phase/
  engine/
    types.ts
    transition.ts
    participants.ts
    gates.ts
  store/
    types.ts
    schema.ts
    sqlite.ts
  interagent/
    runtime.ts
    handoff.ts
    payload.ts
tests/
  config.test.ts
  plans.test.ts
  workflow-definitions.test.ts
  engine.test.ts
  participants.test.ts
  gates.test.ts
  sqlite.test.ts
  sqlite-contention.integration.test.ts
  identity.test.ts
  roles.test.ts
  handoff.test.ts
  extension.integration.test.ts
```

Keep modules focused. Do not create generic repositories, service locators, plugin registries, adapter frameworks, or abstractions with only one implementation.

## Execution workflow and task sequence

Execution uses the full-phase coordinated route. Tasks are sequential unless a task explicitly says otherwise. Tasks 1 through 6 and 8 through 10 go to fresh Workers, and the Sergeant reviews and commits accepted work before dispatching the next task. Task 7 is the sole routing exception: interagent repository rules require a separately assigned `leader`, who owns that repository's executor dispatch, acceptance, checks, and commits and then reports the completed integration contract back to the Sergeant.

### Task 1 — Package scaffold

**Repository:** `/workspace/projects/pi/packages/pi-workflow`

**Required reading:**

- `AGENTS.md`
- `PLAN.md` through **Package layout**
- `/workspace/projects/pi/AGENTS.md`
- `/workspace/projects/pi/packages/pi-role/AGENTS.md`
- `/workspace/projects/pi/packages/pi-role/package.json`
- `/workspace/projects/pi/packages/pi-role/tsconfig.json`
- `/workspace/projects/pi/packages/pi-role/CHANGELOG.md`
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`

**Implement:**

- sibling-aligned `package.json`, TypeScript, Vitest, and Prettier setup;
- Node engine `>=24.16.0`;
- `pi.extensions: ["./src/index.ts"]`;
- optional Pi peer dependencies;
- minimal load-safe `src/index.ts` with no workflow behavior yet;
- `CHANGELOG.md` and package metadata;
- package file allowlist including source, workflow Markdown assets, README, changelog, and license.

**Tests and verification:**

- extension module loads without side effects;
- `npm run typecheck`;
- `npm run test`;
- `npm run build`;
- `npm run format`;
- `npm pack --dry-run` includes only intended files.

**Completion:** package is independently buildable and load-safe. Only then add its extension path to the Pi superproject root manifest and run available root checks.

### Task 2 — Plan parsing and bundled workflow definitions

**Repository:** `pi-workflow`

**Required reading:**

- this plan's **Plan artifact contract**, **Workflow-definition contract**, and **Bundled workflow semantics**;
- `/workspace/projects/practorium/AGENTS.md`;
- `/workspace/projects/practorium/.agents/workflows.yaml`;
- `/workspace/projects/practorium/.agents/workflows.schema.json`;
- `/workspace/projects/practorium/.agents/workflows/README.md`;
- `/workspace/projects/practorium/.agents/workflows/bounded-work.md`;
- `/workspace/projects/practorium/.agents/workflows/bounded-series.md`;
- `/workspace/projects/practorium/.agents/workflows/seed-planning.md`;
- `/workspace/projects/practorium/.agents/workflows/full-phase.md`;
- `/workspace/projects/practorium/.agents/workflows/steps/process-feedback.md`;
- `/workspace/projects/practorium/.agents/workflows/steps/user-acceptance-gate.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/architect-acceptance-review-task.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/bounded-series-readme.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/bounded-work-brief.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/bounded-work-routing-prompt.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/phase-readme.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/plan-seed.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/seed-planning-readme.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/sergeant-closeout-task.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/sergeant-review-task.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/user-acceptance-demo.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/worker-task.md`.

**Implement:**

- plan frontmatter parser and path validation;
- typed definition structures and hand-written validators;
- four version-1 bundled definitions;
- generic current-state Markdown instructions;
- route responsibility maps, including explicit Sergeant responsibility reassignment on direct routes.

**Do not:** add user-authored definitions, inheritance, overlays, or project instructions.

**Tests:** every invariant listed in the definition contract, valid/invalid plan fixtures, route responsibility completeness, all state reachability, and exact conversion of the normative lifecycle obligations.

**Completion:** definitions load and validate without SQLite or a running Pi session.

### Task 3 — SQLite store

**Repository:** `pi-workflow`

**Required reading:**

- this plan's **State and storage**, **Runtime record contract**, and **SQLite contract**;
- `https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html` sections for `DatabaseSync`, constructor timeout, `exec`, `prepare`, `StatementSync.run`, and `isTransaction`.

**Implement:**

- platform state-directory resolution;
- schema creation and version checks;
- create/load/list-active/read-history operations;
- atomic expected-revision mutation;
- event append in the same transaction;
- one-active-workflow-per-project enforcement;
- typed serialization validation at the storage boundary;
- actionable busy, stale, corruption, and version errors.

**Tests:** temporary databases, restart/reopen recovery, two project isolation, active uniqueness, rollback, stale revisions, event ordering, unsupported schema version, malformed stored JSON, and a real two-process contention test under Node 24.16.

**Completion:** storage semantics are deterministic without Pi or interagent.

### Task 4 — Pure lifecycle engine

**Repository:** `pi-workflow`

**Required reading:**

- this plan's **Workflow-definition**, **Runtime record**, and **Transition-engine** contracts;
- Task 2 definitions and Task 3 store interfaces.

**Implement:**

- instance creation model;
- transition lookup and deterministic validation order;
- actor slot and participant checks;
- effective-role mismatch handling;
- distinct gate evidence;
- blocking, correction, cancellation, override, and terminal behavior;
- Worker identity allocation without task-level FSM transitions;
- transition and handoff event construction.

**Tests:** legal path for each route and workflow; every rejection code; separate gate keys; stale requests; correction returns; terminal rejection; override reason; role matched/mismatched/inactive/unverified; fresh Worker allocation; and no Worker FSM requirement.

**Completion:** engine transitions are pure and exhaustively tested.

### Task 5 — Configuration, commands, tool, and context

**Repository:** `pi-workflow`

**Required reading:**

- this plan's **Workspace configuration**, **Pi surface**, and **Focused prompt context**;
- Pi `docs/extensions.md`, `docs/settings.md`, and `docs/session-format.md`;
- Pi examples `plan-mode`, `questionnaire.ts`, and `todo.ts` only for current API usage.

**Implement:**

- settings loading and project registry;
- workspace and project-path resolution;
- user commands exactly as specified;
- the single `pi_workflow` tool;
- TUI confirmation and noninteractive `--confirm` behavior;
- session attachment and focused prompt injection;
- read-only status behavior;
- typed error rendering.

**Tests:** configuration precedence, symlink/path containment, overlapping roots, commands with/without UI, user-only gate rejection from tools, no mutation on failed confirmation, context content boundaries, and two registered projects.

**Completion:** one process can create, inspect, transition, cancel, override, and recover an instance without interagent delivery.

### Task 6 — Stable optional `pi-role` effective-state contract

**Repositories:** `/workspace/projects/pi/packages/pi-role`, then Pi superproject pointer

**Required reading:**

- `/workspace/projects/pi/packages/pi-role/AGENTS.md`;
- `/workspace/projects/pi/packages/pi-role/src/index.ts`;
- `/workspace/projects/pi/packages/pi-role/tests/index.test.ts`;
- `/workspace/projects/pi/packages/pi-role/tests/rpc.integration.test.ts`;
- this plan's **Effective role and identity contracts**.

**Implement:**

- `pi-role:effective-state` version-1 entries;
- publication after startup resolution and every role mutation;
- active/inactive/unavailable semantics exactly as specified;
- exported pure parser and type helpers for the effective entry contract, without a mutable cross-extension singleton;
- preservation of existing state entries and behavior.

**Tests:** new session, explicit activation, reload, disable, resume/restore, unavailable role file, malformed entry, and RPC visibility.

**Verification:** full `pi-role` checks and package dry run. Commit `pi-role` before its superproject pointer.

**Completion:** `pi-workflow` can determine reliable effective role from session entries when `pi-role` is installed.

### Task 7 — Interagent exact custom-handoff support

**Repositories:** `/workspace/projects/inter-agent` and its Pi integration

**Routing:** The user assigns a fresh interagent session the `leader` role. That leader uses this task as the fixed product/architecture boundary, updates the repository's active planning state as required, prepares bounded executor packets, obtains only the dispatch authorization required by interagent's repository workflow, accepts and commits verified work, and returns the final evidence to the `pi-workflow` Sergeant. Executors do not make the protocol or product decisions recorded here.

**Required reading:**

- `/workspace/projects/inter-agent/AGENTS.md`;
- `/workspace/projects/inter-agent/.agents/roles/leader.md`;
- `/workspace/projects/inter-agent/.agents/PLAN.md`;
- `/workspace/projects/inter-agent/integrations/pi/AGENTS.md`;
- `/workspace/projects/inter-agent/ARCHITECTURE.md`;
- `/workspace/projects/inter-agent/spec/asyncapi.yaml`;
- `/workspace/projects/inter-agent/spec/schemas/send.json`;
- `/workspace/projects/inter-agent/spec/schemas/custom.json`;
- `/workspace/projects/inter-agent/spec/schemas/msg.json`;
- `/workspace/projects/inter-agent/src/inter_agent/core/server.py`;
- `/workspace/projects/inter-agent/src/inter_agent/core/send.py`;
- `/workspace/projects/inter-agent/integrations/pi/src/index.ts`;
- `/workspace/projects/inter-agent/tests/conformance/test_target_resolution.py`;
- `/workspace/projects/inter-agent/tests/conformance/test_custom_passthrough.py`;
- `/workspace/projects/inter-agent/tests/test_pi_extension_static.py`;
- `/workspace/projects/inter-agent/tests/integration/test_pi_adapter_live.py`;
- this plan's **Interagent handoff contract**.

**Implement:**

- backward-compatible optional exact-target resolution for targeted direct and custom sends;
- helper/CLI support for structured exact custom sends;
- Pi preservation of custom type and JSON payload in display details and LLM context;
- stable `inter-agent:effective-state` entries;
- no workflow policy in interagent;
- no pub/sub changes.

**Tests:** exact missing target does not prefix-route; ordinary prefix behavior remains compatible; structured payload round-trip; Pi custom-message injection; identity entry connect/restore/disconnect/failure; malformed/oversized payload errors; live delivery.

**Verification:** `./run-checks.sh` plus Pi integration typecheck/build/format and focused live tests. Commit interagent coherently before any consumer pointer or dependency update.

**Completion:** structured exact workflow notifications can reach Pi and expose reliable local identity state.

### Task 8 — End-to-end workflow handoffs

**Repository:** `pi-workflow`

**Required reading:**

- this plan's **Interagent handoff contract**;
- accepted Task 5 command/context code;
- accepted Task 7 helper and Pi contracts.

**Implement:**

- helper runtime resolution matching interagent's documented precedence;
- payload validation;
- exact target presence and delivery;
- pending/delivered/failed event persistence;
- retry without duplicate transition;
- recipient authority refresh;
- stale/mismatched handoff handling;
- identity and optional role enforcement.

**Tests:** offline target, exact-target collision protection, helper failure, stale payload, wrong project/recipient/revision, retry, server restart, Pi reload, resumed session, cloned-name collision, Architect-to-Sergeant, Sergeant-to-Architect, and direct Architect-to-Worker.

**Completion:** separate Pi processes advance macro ownership through authoritative state and structured notifications.

### Task 9 — Practorium migration and real acceptance

**Allowed areas:** `/workspace/.pi/settings.json`; `/workspace/projects/practorium/.agents/`; `/workspace/projects/practorium/plans/`; `/workspace/projects/practorium/docs/`; `/workspace/projects/pi/packages/pi-workflow/README.md`; and `/workspace/projects/pi/packages/pi-workflow/CHANGELOG.md`. Do not change Practorium product code during migration unless the selected real acceptance plan independently requires it.

**Required reading:**

- `/workspace/projects/practorium/AGENTS.md`;
- `/workspace/projects/practorium/.agents/roles/architect.md`;
- `/workspace/projects/practorium/.agents/roles/sergeant.md`;
- `/workspace/projects/practorium/.agents/roles/worker.md`;
- `/workspace/projects/practorium/.agents/workflows.yaml`;
- `/workspace/projects/practorium/.agents/workflows/README.md`;
- `/workspace/projects/practorium/.agents/workflows/bounded-work.md`;
- `/workspace/projects/practorium/.agents/workflows/bounded-series.md`;
- `/workspace/projects/practorium/.agents/workflows/seed-planning.md`;
- `/workspace/projects/practorium/.agents/workflows/full-phase.md`;
- the exact real Practorium plan selected by the user for acceptance;
- this plan's migration and acceptance requirements.

**Implement:**

- `/workspace` registry configuration for Practorium and intended projects;
- retained Practorium-specific supplements and product boundaries;
- removal of duplicated macro lifecycle authority only after extension behavior is proven;
- migration documentation and recovery instructions;
- no removal of `docs/ideas/agent-workflow-priming.md`.

**Acceptance run:** execute a real user-facing full phase through Architect planning, Sergeant execution with multiple fresh Workers, architecture acceptance or correction, user acceptance, and Sergeant closeout. Also exercise one direct bounded workflow and two concurrent registered projects.

**Completion:** user explicitly accepts the live behavior. Do not integrate or close user-facing migration before that acceptance.

### Task 10 — Release readiness

**Repositories:** `/workspace/projects/pi/packages/pi-workflow`; `/workspace/projects/pi`; `/workspace/projects/pi/packages/pi-role` only if Task 6 release metadata remains pending; and `/workspace/projects/inter-agent/integrations/pi` only if Task 7 release metadata remains pending.

**Required reading:**

- `/workspace/projects/pi/packages/pi-workflow/AGENTS.md`;
- `/workspace/projects/pi/packages/pi-workflow/README.md`;
- `/workspace/projects/pi/packages/pi-workflow/CHANGELOG.md`;
- `/workspace/projects/pi/packages/pi-workflow/package.json`;
- `/workspace/projects/pi/AGENTS.md`;
- `/workspace/projects/pi/README.md`;
- `/workspace/projects/pi/package.json`;
- `/workspace/projects/pi/packages/pi-role/AGENTS.md` when its release metadata remains in scope;
- `/workspace/projects/pi/packages/pi-role/README.md`;
- `/workspace/projects/pi/packages/pi-role/CHANGELOG.md`;
- `/workspace/projects/pi/packages/pi-role/package.json`;
- `/workspace/projects/inter-agent/integrations/pi/AGENTS.md` when its release metadata remains in scope;
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`;
- accepted implementation and migration evidence produced by Tasks 1 through 9.

**Implement:**

- final README usage, configuration, lifecycle, recovery, command, and troubleshooting documentation;
- changelog and npm metadata;
- final superproject extension and package-list integration;
- removal of stale planning-only wording while preserving this durable architecture record or replacing it with equivalent maintained documentation.

**Verification:**

```bash
npm run typecheck
npm run test
npm run build
npm run format
npm pack --dry-run
```

Run Pi superproject pnpm checks, interagent checks for changed integration surfaces, live Pi natural-session scenarios, clean-working-tree checks, and tarball inspection. Exercise the minimum Node 24.16 runtime.

**Completion:** verified, documented, explicitly user-accepted, and ready for a separately authorized publish/release process.

## Required acceptance scenarios

The final verification must demonstrate:

1. Architect starts a full phase from a valid approved plan.
2. Exact structured handoff reaches the configured Sergeant.
3. Sergeant coordinates multiple substantial tasks through distinct fresh Workers without Worker FSM calls.
4. Integrated execution reaches architecture acceptance.
5. Architect accepts or returns it through a legal correction path.
6. A user-facing phase cannot advance without distinct user acceptance evidence.
7. Sergeant closes an accepted phase.
8. Direct bounded work runs Architect-to-Worker without Sergeant.
9. Wrong participant and known wrong-role transitions are rejected.
10. Missing `pi-role` reports unverified status without making the package unusable.
11. Reading approval cannot satisfy route, execution, user acceptance, architecture acceptance, override, or commit gates.
12. Two registered projects maintain isolated active workflows.
13. Two processes racing the same revision produce one winner and one stale-revision rejection.
14. Restarted Pi and interagent processes recover state from SQLite rather than prose.
15. A failed handoff is retryable without duplicating its transition.
16. An absent exact target cannot be replaced by a unique prefix match.
17. A stale handoff notification cannot overwrite or regress authority.

## Explicit non-goals

Do not implement:

- pub/sub workflow channels;
- filesystem handoffs;
- alternate transports;
- a workflow daemon;
- dashboards or a multi-project control-plane TUI;
- remote or cross-machine state;
- multiple workflows in one registered project;
- parallel workflows or Git worktree orchestration;
- task dependency DAGs;
- nested workflows;
- arbitrary user-authored definitions;
- definition inheritance or overlays;
- automatic role activation;
- capability-tier Worker routing;
- per-tool, per-file, per-task, or per-Worker FSM transitions;
- bundled Practorium product instructions;
- migration tooling beyond what the first persisted schema requires;
- release or publish automation beyond sibling conventions.

See `IDEAS.md` for deferred directions and promotion triggers.

## Stop conditions

Stop and return to the Architect and user only if:

- a normative source contradicts an accepted boundary in this plan;
- Pi's current API cannot support a specified command, confirmation, session-entry, or prompt-refresh behavior;
- Node 24.16 does not pass the real SQLite contention and recovery tests;
- exact structured interagent delivery requires workflow policy inside interagent rather than the generic transport changes specified here;
- a required `pi-role` effective-state contract cannot remain optional and declarative;
- the selected workflow no longer fits the substantive task count or risk;
- required user-facing acceptance fails or is withheld;
- a credential, trust, security, destructive migration, or publish decision appears;
- work would enter an explicit non-goal.

Do not stop for naming, module placement, test fixture structure, ordinary error wording, or other routine implementation details already bounded by this plan and repository conventions.

## Source-control rules

- Keep commits atomic by task and repository.
- Workers do not commit unless their assigned workflow explicitly grants that responsibility.
- Commit child repositories before superproject pointer updates.
- Stage only current-task files.
- Do not commit failing checks, generated runtime databases, temporary files, unrelated changes, or work awaiting user acceptance.
- Do not push or publish without explicit authorization.
- Use durable Conventional Commit subjects without session, plan, agent, or commit-hash references.
