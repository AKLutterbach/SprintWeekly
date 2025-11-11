High-Level Architecture - how the parts work together

# Overview

Sprint Weekly is a Forge app with:

* Front end: UI Kit screens for config and a Custom UI React app for the report and charts.
* Back end: Forge functions that call Jira Cloud REST, assemble metrics, and create exports.
* Storage: Forge storage for configs, presets, mappings, cached report blobs.
* Identity model: user-as for all v1 views and exports to match Jira permissions.

# Components

1. Project Page module
   Shows the latest or selected report inside the project. Launches the full report view.

2. Dashboard Gadget
   Lightweight metric cards plus a link to the full report. Runs user-as.

3. Full Report view (Custom UI React)
   Tabs: Overview, Detail, Changes, Quality. Renders metric cards, tables, and two small charts.

4. Config screens (UI Kit)
   Scopes, time window preset, mappings for story points and blockers, presets by team.

5. Forge functions (backend)
   Resolvers for: fetch issues, compute metrics, assemble narrative, render PDF, render CSV, manage storage, health checks.

6. Storage
   Collections for Config, Mappings, Presets, and Report Cache. Keys include scope, time window, and locale.

7. Exporters
   PDF via pdf-lib, CSV via json2csv. Both filtered by the requesting user’s visibility.

# Front end

## Technologies

* Custom UI React 18 for the report. Atlaskit for components. Recharts for small charts. React Table for large lists with virtual rows.
* UI Kit for lightweight config dialogs and wizards.

## Responsibilities

* Collect user inputs: scope, week or sprint, which metrics to show.
* Call backend resolvers through @forge/bridge and show loading states.
* Render metric cards, tables, and charts from a typed Report payload.
* Open drill-downs by launching a new Jira search tab with the exact JQL.
* Trigger exports and handle download of returned blobs.

## Interaction model

* Stateless views as much as possible. The front end never trusts local transforms for counts. It always asks the backend for canonical numbers.
* Optimistic preview. After the first full build, switching views or tabs reuses cached payloads.

# Back end

## Technologies

* Forge functions with @forge/resolver entry points.
* @forge/api for Jira REST, storage, and fetch.
* Luxon for timezone and date math. Zod for input validation. Pino for structured logs.

## Responsibilities

* Validate inputs, expand scope to JQL, and page through results.
* Compute metrics, carryover sets, scope change sets, and narrative text.
* Enforce user-as visibility by calling Jira with the viewer’s auth context.
* Cache report payloads keyed by config, time window, and viewer locale. Respect short TTL for freshness.
* Generate PDF and CSV on demand and return as binary for download.

# Front end ↔ back end communication

* @forge/bridge posts typed messages to named resolvers, for example report.build, report.loadFromCache, export.pdf, export.csv, config.save, mappings.get.
* Each call includes a requestId for tracing. Backend replies with a typed payload or an error object with a stable code.

# Data flow: build a report

1. User selects scope and window
   Front end sends: board or project or saved filter, plus Calendar or Sprint window, plus dates.

2. Backend expands scope

* For board: read board filter JQL.
* For sprint: use sprint dates from the board and selected sprint id.
* For project or saved filter: use provided filter JQL.

3. Backend fetches issues

* Page with search REST, fields: summary, status, assignee, story points field id from Mappings, issue type, labels.
* For changes and carryover: request changelog or use two queries within the window to avoid heavy expands if rate limits hit.

4. Compute metrics

* Commitments vs Done uses mapped story points if available. Else fall back to issue count.
* Added and Removed use compare of sprint membership versus sprint start for scrum, or created and status changes for kanban.
* Carryover is last week’s open set that is still open.
* Defects are issue types in Bug or admin list.
* Blockers are union of admin-mapped blocked statuses, label rules, and link type matches.
* Throughput is count moved to Done inside the window.

5. Narrative

* Lightweight summary template populated from deltas and flags. Editable in UI.

6. Cache

* Store the Report payload and a checksum to detect small edits to narrative without recomputing heavy aggregates.

7. Return to front end

* Front end renders metric cards, tables, and two charts from the payload.

# Exports

* PDF: backend renders a simple layout server side using the same Report payload. Embed tables for Done, Changes, and Blockers. Return a binary stream to the browser to save.
* CSV: backend flattens issue lists for Done, Changes, Carryover. Returns a CSV for each list or a zip if multiple.

# Drill-downs

* Each card has a resolver that returns the exact JQL used for the number. Front end opens a new Jira search tab with that JQL. Users see only what they already have rights to.

# Permissions model

* v1 uses user-as everywhere. No scheduled sends.
* Every backend call executes with the current viewer context. Hidden issues never reach the app.
* If the app detects hints of missing items, it shows the Partial Data badge. The hint can be a difference between expected versus returned counts from safe endpoints, or presence of restricted projects in a saved filter the user cannot access.

# Performance and caching

* Parallel fetch: page multiple queries concurrently with Promise.all.
* Chunked fields to avoid changelog on very large sets. Use two-pass strategies for scope-change lists.
* Cached payloads keyed by scope, window, and mapping version. Short TTL. Clear cache on mapping edits.
* Target p95 under 20 seconds. Show a non-blocking in-view “building” banner if a cold build runs. Subsequent views hit cache.

# Error handling and observability

* Zod validation catches bad inputs early.
* Standard error codes: RATE_LIMIT, PERMISSION, BAD_SCOPE, TIMEOUT, EXPORT_SIZE.
* Pino logs with requestId. Minimal metrics: build time, page count, cache hit rate.
* User-facing toasts for transient failures. Offer retry and a lightweight troubleshooting link.

# Storage model

* Config: per project, plus global defaults.
* Mappings: story points field id, blocked labels, blocked statuses, blocked link types.
* Presets: saved scope and metric toggles.
* Report Cache: serialized Report payloads with checksum and TTL.

# Extensibility path

* v1.1 adds scheduled sends. Each recipient render runs user-as.
* v2 adds portfolio view. Same pipeline, but scope expands across many projects with per-user visibility applied at query time.

# Why this will work

* User-as keeps security simple and predictable.
* UI Kit for config keeps bundles small. Custom UI for the report allows richer tables and charts without slowing the whole app.
* Backend computes a single canonical Report object that all surfaces reuse, which reduces drift between the Project Page, Gadget, and exports.

