# Changelog

All notable changes to this project will be documented in this file.

## 2025-11-11 — Initial decisions
- Project decisions locked in:
  - Language & build: Full TypeScript (TypeScript 5), esbuild for bundling, Jest + ts-jest for tests.
  - UI: Custom UI (React 18) allowed for the Full Report view; UI Kit for config flows.
  - Export limits: CSV max 5,000 issues OR 10 MB output; PDF max 2,000 issues OR 5 MB output.
  - Cache TTL: 30 minutes (1800 seconds) for report payloads by default.
  - Permissions: All backend calls will run user-as (viewer) to ensure visibility.

## Repo snapshot (key files)
- AGENTS.md
- manifest.yml
- package.json
- README.md
- sprint_weekly_high_level_architecture.md
- sprint_weekly_prd.md
- src/
  - index.js
  - resolvers.js
  - frontend/index.jsx
  - resolvers/index.js

