# Title

Sprint Weekly: Jira App

# Summary

Sprint Weekly creates a crisp weekly snapshot of work activity for a team. It pulls Jira data and produces a shareable report with work completed, in progress, risks, and carryover. Output is available inside Jira on a project page and as a dashboard gadget. Users can export reports.

# Problem

Leads and stakeholders spend time assembling weekly updates from Jira. Data lives in tickets but the summary is manual, slow, and inconsistent.

# Goals

1. One click weekly report for a team or project
2. Consistent view of progress, scope change, blockers, and quality
3. Lightweight setup that respects project permissions
4. Export for sharing outside Jira

# Non Goals

• Replace sprint planning
• Replace full analytics platforms
• Cross instance data aggregation

# Users

• Team leads and scrum masters who send weekly updates
• Project managers who need portfolio visibility
• Engineers who want a quick view of commitments and carryover
• Executives who want a simple summary

# Key Use Cases

1. Generate a weekly report for the current sprint
2. Generate a weekly report for a past week
3. Embed the report on a project page and a dashboard
4. Export to PDF and CSV for attachment or archive

# Scope

**In**: current instance Jira data; scrum and kanban boards; company managed and team managed projects; dashboard gadget; project page; export; basic role based access

**Out**: external data sources; advanced forecasting; custom scripting; scheduled delivery in v1

# Requirements

## Functional

1. **Source selection**: board, project, or saved JQL

2. **Time window**: user selects Calendar week or Sprint per report. Default Calendar week (Sunday to Saturday). Timezone aware

3. **Metrics**

   * Project Timeline section showing epics with start and due dates
   * Counts for Issues done, added, removed, and carried over
   * Commitments vs completed using story points if mapped, else issue count
   * Defects created vs resolved
   * Sections that list Issues Done (this week), In Progress (this week), To Do (Next Week), and Blockers (per mapping)
   * Throughput only in v1. Cycle time arrives in v1.1

4. **Narrative sections** with auto text and optional edit

   * Project title
   * “Weekly Status Report” header
   * Date
   * Summary paragraph with highlights and risks
   * Scope change summary
   * Top blockers and owner next steps

5. **Artifacts**

   * Project Page module that shows the latest report
   * Dashboard Gadget that shows selected metrics and a link to the full report
   * Full Report page with tabs: Overview, Detail, Changes, Quality
   
6. **Export**

   * PDF and CSV for issue lists in v1
   * JSON export in v1.1

7. **Permissions**

   * All views run user as viewer. If a viewer cannot see an issue, exclude it from counts and tables
   * Show a “Partial Data” badge when the current viewer lacks access to items in scope

8. **Configuration**

   * Per project and global defaults
   * Store presets by team

9. **Drill down**

   * Each metric card links to the exact JQL result set in a new tab

## Non Functional

* Performance: generate a report with up to 5k issues in under 20 seconds p95, with caching where possible
* Reliability: exports must retry transient errors and alert the user in UI on failure
* Security: no data sent outside Atlassian cloud. All processing and storage stay in Forge. Exports are user initiated downloads
* Accessibility: keyboard navigation and screen reader support
* Internationalization ready with locale aware dates and numbers

# Data Model

**Config**: id, owner, scope type (board|project|JQL), scope ref, metrics toggles, recipients (v1.1), timezone, layout preset, mappings
**Mappings**: story points field id, blocked status names, blocked labels, blocked link types
**Report**: id, generated at, time window, scope ref, metric values, issue snapshots (id, key, summary, status, points), narrative text, checksum

# Inputs and Rules

* Commitments vs done uses mapped story points; if not mapped, use issue count
* Scope change = issues added to sprint after start date or created in window for kanban
* Carryover = issues in last week not done and still open
* Defects = issueType in Bug or admin list
* Blockers = any of: status name in admin mapped set; link type “is blocked by”; label in admin mapped list

  * Note: Jira statusCategory is only To Do, In Progress, Done. Do not use a Blocked category

# UX

## Report Layout

Header with time window and scope
Row of metric cards: Commitments vs Done, Added, Removed, Carryover, Throughput, Defects, Blockers
Highlights box with auto summary and an editable note
Tables: Changes (added and removed), Done, Carryover, Blockers with owner and due
Footer with links to JQL views and export controls

## Config Flow

New Report → pick scope → choose Calendar or Sprint → pick week or sprint → select metrics → preview → save preset
Permissions tab to test visibility
Mappings tab to set Story Points field and Blocked rules

# Integrations

* Jira Cloud REST API for issues, boards, sprints, search
* No Slack or Teams in v1
* Email scheduling arrives in v1.1

# Platform

Atlassian Forge preferred. UI Kit for config. Custom UI for charts and the full report view
Forge storage for config and report cache
Web triggers for on demand generation only
App scopes: read:issue:jira, read:board-scope:jira, read:project:jira, write:attachment:jira if needed for PDF attached to an issue from the UI

# Primary runtime

* Atlassian Forge on Node.js 20 LTS
* Backend: Forge functions
* @forge/api for Jira REST, storage, fetch
* @forge/resolver for function routing
* luxon for timezone safe dates
* zod for input validation
* pino for structured logs
* json2csv for CSV export
* pdf-lib for server side PDF generation

# Custom UI

* React 18 with Atlassian Design System
* @forge/bridge for frontend backend messaging
* recharts for small charts
* react-table for large issue lists with virtual rows
* @emotion/react for styling used by Atlaskit

# Scheduling and delivery

* No scheduled sends in v1
* v1.1 uses Forge Scheduled Triggers. Each recipient is rendered user as to preserve visibility parity. Calendar vs Sprint window follows the saved preset

# Build and quality

* TypeScript 5
* esbuild for Custom UI bundling
* Jest + ts jest for unit tests
* ESLint + Prettier for code style

# Notes

* Prefer fetch from @forge/api
* Keep all data processing inside Forge
* Avoid “project page attachments.” Project pages link to app content or stored artifacts. File attachments target issues only

# Charts

* Minimal, fast charts for throughput and defects. Keep to two charts on Overview
* Cycle time chart arrives in v1.1

# Analytics

* App usage: report views, exports, presets created
* Team outcomes (anonymous, in instance): commitments hit rate, carryover trend, blocker age
* No cross instance aggregation without explicit opt in in a later version

# Success Metrics

* Time saved per report vs manual process. Target 30 minutes saved per team per week
* Weekly active teams using the app. Target 50 by month three
* Export success rate above 99 percent
* User satisfaction CSAT above 4.3 on 5

# Release Plan

## v1

* Core report, project page, dashboard gadget, PDF export, CSV export, manual generation, per project config, mappings, permissions compliance

## v1.1

* Scheduling with email delivery and JSON export
* Cycle time metric and chart
* Presets library and carryover spotlight

## v2

* Portfolio view across many projects for permitted users
* Trend charts and external API

# Risks and Mitigations

* API limits. Use paging, caching, narrow queries
* Permissions edge cases. Show a visible Partial Data banner when the viewer lacks access
* Gadget limits. Provide a deep link to the full view if data is truncated
* Performance. Cache heavy aggregates per scope and window. Show non blocking “building” state when needed

# Acceptance Criteria (v1)

* Given a project with a current sprint, when a user clicks Generate for this week, a report renders in under 20 seconds p95
* Given the viewer cannot see a secure issue, counts and tables exclude it and a Partial Data badge displays
* Given the user chooses Sprint window, metrics reflect the sprint dates. Given Calendar window, metrics reflect the selected Sunday to Saturday range
* Given Story Points mapping is set, commitments vs done uses points. Given it is not set, the metric uses issue count
* Given Blocked mappings are set, the Blockers section includes items matching mapped statuses, labels, or links
* Given the user clicks a metric card, the app opens a new tab with the exact JQL result set
* Given the user exports PDF or CSV, the file includes only issues and fields visible to that user