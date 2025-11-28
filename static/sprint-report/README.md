# Sprint Weekly Custom UI

This directory contains a Custom UI React application for the Sprint Weekly Forge app. The Custom UI provides pixel-perfect styling that matches the PDF export.

## Overview

The Custom UI is a standalone Vite + React + TypeScript app that:
- Uses `@forge/bridge` to communicate with the Forge backend resolver
- Displays Sprint Status Overview with exact PDF styling (pastel colors, rounded borders, etc.)
- Uses normal HTML/CSS (not UI Kit) for full styling control

## Development

### Install Dependencies
```bash
cd static/sprint-report
npm install
```

### Build for Production
```bash
npm run build
```

This outputs the built files to `static/sprint-report/build/`, which is referenced in the Forge manifest.

### Local Development
```bash
npm run dev
```

Note: For local development with Forge, you'll need to build the app and use `forge tunnel` from the app root.

## Project Structure

```
static/sprint-report/
├── src/
│   ├── components/
│   │   ├── SprintReportPage.tsx    # Main report component
│   │   └── SprintReportPage.css    # Styles matching PDF export
│   ├── types.ts                     # TypeScript type definitions
│   ├── index.tsx                    # App entry point
│   └── index.css                    # Global styles
├── build/                           # Build output (generated)
├── index.html                       # HTML template
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Integration with Forge

The Custom UI is integrated into the Forge app via `manifest.yml`:

```yaml
modules:
  jira:projectPage:
    - key: sprint-weekly-custom-page
      resource: sprint-report-ui
      title: Sprint Weekly (Custom)
      layout: blank

resources:
  - key: sprint-report-ui
    path: static/sprint-report/build
```

## Building as Part of Forge Deployment

The root `package.json` includes a build script that automatically builds the Custom UI:

```bash
npm run build              # Builds both backend + Custom UI
npm run build:custom-ui    # Builds only Custom UI
```

The `predeploy` script ensures the Custom UI is built before `forge deploy`.

## Data Flow

1. Custom UI loads in Jira project page
2. `index.tsx` calls `invoke('getSprintStatusMetrics', {...})` via `@forge/bridge`
3. Backend resolver returns sprint metrics data
4. Data is transformed to match `SprintReportData` type
5. `SprintReportPage` component renders with exact PDF styling

## Styling

The component uses CSS that closely matches the PDF export:

- **Committed**: Light blue pastel border (`rgba(227, 242, 253, 1)`)
- **Complete**: Light green pastel border (`rgba(232, 245, 233, 1)`)
- **Incomplete**: Light orange pastel border (`rgba(255, 243, 224, 1)`)

All styling is in `src/components/SprintReportPage.css`.
