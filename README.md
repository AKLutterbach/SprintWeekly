# Sprint Weekly

**Clear, shareable sprint reports for Jira Cloud.**

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Using Sprint Weekly](#using-sprint-weekly)
- [Support and Contact](#support-and-contact)
- [Versioning and Updates](#versioning-and-updates)
- [Privacy and Data](#privacy-and-data)

## Overview

Sprint Weekly is a Jira Cloud app that generates clean, readable sprint reports for team leads, project managers, and stakeholders. Select a project and sprint, customize which metrics and sections to include, and export a PDF summary in seconds. The app is designed for teams who need to share sprint progress with clients, leadership, or cross-functional partners without requiring direct access to Jira.

## Key Features

- **Project and Sprint Selection** - Choose any accessible project and sprint from dropdown menus in the app
- **Core Sprint Metrics** - View summary cards showing committed work, completed issues, carryover from previous sprints, and mid-sprint additions
- **Issue Tables** - Browse detailed lists of completed and incomplete issues, grouped by status
- **Customizable Report Sections** - Toggle report sections on or off to tailor the output for your audience
- **One-Click PDF Export** - Download a formatted PDF report that includes all selected metrics and issue details, ready to share
- **Dark Mode Support** - Seamless experience in both light and dark Jira themes

## Requirements

- **Jira Cloud** - Sprint Weekly is built on Atlassian Forge and runs exclusively on Jira Cloud
- **Project Access** - Users must have permission to view the selected project and its sprints in Jira
- **Sprint Data** - The app reads sprint information from Jira Software boards; projects must use sprints to generate reports

Sprint Weekly requires the following Jira permissions to function:
- Read access to projects, issues, and sprint data
- Access to issue details including status, assignee, summary, and custom fields (such as story points)

These permissions are requested during installation and managed by your Jira administrator.

## Installation

1. **Install from the Atlassian Marketplace**
   - Visit the [Sprint Weekly listing](https://marketplace.atlassian.com/) on the Atlassian Marketplace
   - Click "Get it now" and select your Jira Cloud site
   - Review and approve the requested permissions

2. **Access the App**
   - After installation, navigate to the **Apps** menu in the top navigation bar of Jira
   - Select **Sprint Weekly** from the dropdown
   - Alternatively, find Sprint Weekly in the project sidebar under the Apps section

3. **Grant Permissions**
   - Ensure your Jira administrator has approved the app permissions
   - Users need view access to the projects and sprints they want to report on

## Using Sprint Weekly

### Generating a Report

1. **Select a Project**
   - Open Sprint Weekly from the Apps menu or project sidebar
   - Choose a project from the "Project" dropdown
   - If no projects appear, verify you have view access to at least one Jira project

2. **Select a Sprint**
   - After selecting a project, choose a sprint from the "Sprint" dropdown
   - Sprints are listed with their current state (active, closed, or future)
   - If no sprints are available, ensure the selected project uses Jira Software boards with sprints configured

3. **Customize Report Options**
   - Use the toggle controls to enable or disable specific report sections
   - Adjust which metrics and issue tables appear in the final output
   - Changes are reflected immediately in the report preview

4. **Generate the Report**
   - Click the "Generate Report" button to build the sprint summary
   - The app retrieves issue data and calculates metrics automatically
   - Reports are cached for 30 minutes to improve performance on repeat views

5. **Export as PDF**
   - Click the "Export PDF" button in the top-right corner of the report
   - The PDF includes all visible sections and metrics from the current report
   - The file is named using the format: `[Project Name]-Report-[Timestamp].pdf`

### Handling Empty States

- **No Projects Available** - If the project dropdown is empty, verify that you have view access to Jira projects on your site
- **No Sprints Available** - If the sprint dropdown is empty after selecting a project, ensure the project has active or closed sprints configured
- **No Issues in Sprint** - If a sprint has no committed or completed issues, the report will display empty tables with appropriate messages

## Support and Contact

If you encounter issues or have questions about Sprint Weekly, please contact our support team:

**Email:** support@datainsightlab.com

When reaching out, please include:
- Your Jira Cloud site URL (e.g., yourcompany.atlassian.net)
- The version of Sprint Weekly you are using (visible in the Manage Apps section of Jira)
- A brief description of the issue or question, including any error messages

We aim to respond to all support requests within 1-2 business days.

## Versioning and Updates

Sprint Weekly receives regular updates with new features, performance improvements, and bug fixes. Updates are deployed automatically to your Jira Cloud site - no manual action is required.

You can view the current version and release notes in the **Manage Apps** section of Jira, or check the [Marketplace listing](https://marketplace.atlassian.com/) for the latest changelog.

## Privacy and Data

Sprint Weekly reads issue and sprint data from your selected Jira projects in order to generate reports. All data processing occurs within the Atlassian Forge environment and remains on your Jira Cloud site.

- **Data Access** - The app accesses project names, sprint details, issue summaries, statuses, assignees, and custom fields (such as story points) for the projects you select
- **Temporary Caching** - Report data is cached for up to 30 minutes to improve performance; cached data is automatically discarded after this period
- **No External Storage** - Sprint Weekly does not store your Jira data in external systems or share it with third parties
- **User Permissions** - The app respects Jira's existing permission model; users can only generate reports for projects and sprints they already have access to in Jira

For more details, see our [Privacy Policy](https://github.com/AKLutterbach/SprintWeekly/blob/master/PRIVACY.md).
