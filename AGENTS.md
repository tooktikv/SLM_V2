# SLM Platform

Supplier Lifecycle Management front-end (React 19 + Vite + TypeScript + Tailwind CSS v4). Frontend-only; all data is mock/in-memory.

## Run (VS Code)

- Terminal > Run Task > `SLM: dev server`, or Run and Debug > `SLM: Chrome (dev)`. Served at http://localhost:5173/.
- Task `SLM: test` runs `npm test` (node:test), `SLM: typecheck` runs `npx tsc --noEmit`.
- Commands run in `SLMproject/`; the workspace root is the parent folder.

## Structure

- `src/modules.ts` - the 13 SLM modules and their sections (single source for sidebar, routing and headers); screens read the active section via `useNavigation()`
- `src/App.tsx` - shell: sidebar + active module screen
- `src/screens/` - one screen per module; `screens/qualification` (module 4), `screens/qsl` (module 5), `screens/administration` (module 13) and other `screens/<module>/` folders hold sub-sections
- `src/components/` - shared components; `src/components/ui` - design-system primitives (import from the barrel)
- `src/qsl/` - Qualification / Capability / QSL domain: `services/assessments.ts` (qualification workflow), `publishing.ts` (eligibility, publish, withdraw), `qslRegister.ts` (eligibility, reports, capability register), `queries.ts`, RBAC, seed, tests
- `src/config`, `src/integration`, `src/samples`, `src/tasks` - settings, integration, sample-request and task services (each with tests)
- `src/data/` - mock master data (suppliers, compliance, performance, samples, organization, onboarding, capability); `src/lib/export.ts` - CSV download

## Conventions

- Tailwind utility classes and the design tokens in `src/index.css`; no Tailwind config file.
- Export screens/components as default exports; domain modules use named exports.
- Node type-stripping for tests: `import type`, `.ts` import extensions, no enums or parameter properties in `src/qsl`, `src/config`, `src/integration`, `src/samples`, `src/tasks`.
