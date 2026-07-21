# Ideas

V1 is intentionally a small global Markdown catalog, central project workflow list, read-only agent tool, and `/workflow` configuration UI. Promote an item only after concrete use demonstrates the need and the user explicitly approves it.

## Project-local workflow catalogs

Allow a trusted project to supply additional workflow Markdown or override global entries.

Before promotion, decide precedence, trust behavior, collision handling, portability, and whether local workflow content creates unnecessary divergence from the global catalog.

## Public role-catalog integration

Consume a stable read-only role-discovery contract if `pi-role` eventually exposes one.

V1 only scans global role filenames as a best-effort UI hint. Do not add a private import, duplicate full `pi-role` discovery, or create circular package awareness.

## Catalog diagnostics command

Add an explicit user-facing validation or repair view if malformed workflow files and configuration errors become difficult to resolve through `/workflow` diagnostics.

Do not create a separate command merely to duplicate errors already visible in the configuration UI and agent tool.

## Large-catalog indexing

Introduce search, filtering, or bounded pagination only if real global catalogs no longer fit the required one-call metadata listing limit.

Preserve the current preference for bulk metadata over workflow-by-workflow inspection.

## Packaged workflow collections

Allow a separate Pi package to install workflow Markdown collections if manual global-file management becomes burdensome.

Keep workflow content separate from the core extension. Before promotion, define installation paths, updates, user modifications, conflicts, and removal behavior.

## Configuration import and export

Support explicit import/export if users need to move project workflow lists between machines or workspaces.

V1 uses one local `projects.json` and does not synchronize configuration remotely.
