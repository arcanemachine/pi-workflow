# Ideas

These directions are deliberately outside V1. Promote an item only when concrete usage demonstrates the need and the user explicitly approves it.

## Multi-workflow and Git worktree coordination

Status: deferred until one active workflow per registered project prevents real concurrent work.

Support multiple active workflow instances for one repository, likely isolated by Git worktree. A future design must address project-level observability, participant ownership, conflicting assignments, worktree identity, shared durable artifacts, and closeout across instances. Do not implement parallel scheduling merely because the state model already uses workflow instance IDs.

## Lazy Agents control plane

Status: deferred until structured workflow and participant state exists across multiple active projects.

Provide a terminal interface showing registered projects, connected participants, active roles, workflow instances, current lifecycle states, blocked gates, and current ownership. Later controls might allow explicit user-authorized nudges, transitions, reassignment, or cancellation. The first version should consume stable workflow state rather than scraping conversations or Markdown.

## Pub/sub project and workflow channels

Status: deferred until direct project-role messages are demonstrably insufficient.

Publish presence and lifecycle events on project or workflow channels for dashboards and broader coordination. V1 uses direct interagent identities such as `practorium-sergeant` and `practorium-worker-2`; it does not require pub/sub.

## Alternate coordination transports

Status: deferred until a user needs `pi-workflow` without interagent.

Possible transports include manual handoff generation, filesystem inboxes, RPC, or another message service. Preserve a narrow internal coordination boundary where inexpensive, but do not build a public adapter framework or proof-of-concept alternate transport in V1.

## External workflow service

Status: deferred until same-server coordination, durability, or operational scale exceeds the existing interagent topology.

A standalone service could host workflow instances, transition history, project namespaces, presence, and remote clients. It would require lifecycle management, authentication, reconnection, version compatibility, and durable storage. Do not introduce a second server while the existing interagent server may satisfy V1.

## Cross-machine project identity

Status: deferred until workflows must coordinate across machines or workspace roots.

A server-assigned namespace, explicit portable project ID, or repository identity scheme may eventually replace workspace-local registry keys. Filesystem paths, repository names, and Git remotes are not universally reliable implicit identities. V1 treats the configured workspace registry key as authoritative within one interagent server.

## Generic workflow authoring

Status: deferred until the bundled workflows have been implemented and exercised outside Practorium.

Allow users to define arbitrary workflow states, transitions, gates, participant slots, templates, and side effects. V1 should first faithfully implement the existing bounded-work, bounded-series, seed-planning, and full-phase lifecycles without prematurely treating their schema as a universal language.

## Capability-aware Worker routing

Status: deferred until interagent or another participant registry exposes reliable capability metadata.

Allow plans to classify substantive tasks as mechanical, standard, or high-reasoning while concrete Worker sessions advertise a capability tier independently of their `worker` role. Dispatch would validate freshness and sufficient capability, permit escalation when work proves harder than expected, and avoid permanently binding tiers to model names. V1 selects fresh sequential Workers without capability tiers.

## Workflow operator helpers

Status: deferred until the core lifecycle proves which manual checks remain repetitive.

Potential helpers include deterministic-check integration, Sergeant checklist views, plan-status summaries, and documentation-seeding assistance. Add only helpers that remove demonstrated friction; do not turn ordinary work into fine-grained workflow bureaucracy.

## Workflow definition inheritance and project overlays

Status: deferred until projects need to alter bundled workflow instructions without copying complete definitions.

Potential overlay behavior includes appending project-specific step guidance, rebinding routes, or tightening gates. Before implementation, decide merge semantics, provenance, validation, invalid-overlay behavior, and whether project agent guidance already provides a sufficient supplement mechanism.

## Nested workflows and reusable subflows

Status: deferred until a real workflow needs a lifecycle nested inside another lifecycle.

Potential subflows include user acceptance, correction loops, or reusable review sequences. V1 may encode explicit correction transitions but should not introduce hierarchical state-machine semantics.

## Task dependency DAGs

Status: deferred until linear plan task ordering materially limits execution.

A future task graph could model dependencies and parallel eligibility separately from the lifecycle FSM. It must not conflate lifecycle ownership with task scheduling. V1 leaves task breakdown and sequential execution in the plan artifact and Sergeant-owned execution loop.

## Fine-grained execution telemetry

Status: deferred until task-level observability provides demonstrated value without adding agent burden.

The runtime might later record current task, dispatch, review, verification, and assignment events without making them lifecycle transitions. V1 deliberately avoids requiring Workers to poll or update the FSM during ordinary execution.

## Workflow simulation and migration tooling

Status: deferred until workflow definitions evolve after persisted instances exist.

Possible tooling includes definition linting, transition visualization, dry-run simulation, instance migration, compatibility checks, and recovery from invalid or removed states. V1 must version definitions and runtime records so later tooling remains possible.
