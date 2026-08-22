# AcademiQ

AcademiQ is a full-stack academic planning engine that turns degree requirements, prerequisites, transfer credit, workload preferences, and career goals into explainable semester-by-semester plans.

The project is currently private while its university catalog data and authentication setup are being prepared for a public demo. This repository documents the implementation and provides a reproducible local verification path.

## Engineering highlights

- Constraint-aware scheduler with prerequisite, availability, credit-load, and internship-term rules
- Three explainable plan strategies: fastest, lowest stress, and most flexible
- Tested 120-credit, eight-semester planning with explicit elective placeholders when catalog data is incomplete
- Dynamic replanning for dropped courses, changed majors, and graduation targets
- React 19 + Vite client with route-level code splitting and a dark OKLCH design system
- Type-safe tRPC API, Drizzle ORM schema, MySQL persistence, and Zod validation
- Context-aware AI advising and a catalog research workflow with deterministic fallbacks

## Architecture

```text
React/Vite client
      │
      ▼
tRPC routers ──► planning + replanning engines
      │                    │
      ▼                    ▼
Drizzle/MySQL       prerequisite graph + scoring
      │
      └────────────► catalog research + AI advising
```

The deterministic planner remains the source of truth. AI features explain plans and assist catalog research; they do not bypass scheduling constraints.

## Local development

Requirements: Node.js 20.19+ and pnpm 10.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Database-backed flows require the connection variables used by `server/db.ts`. AI advising is optional; without an OpenAI key, the tested fallback responses remain available.

## Verification

```bash
pnpm verify
```

This runs the TypeScript check, 40 unit/integration tests, the production client build, and the bundled server build. Tests cover graph ordering, plan generation, eight-term credit balancing, replanning, account deletion/reset, authentication, and academic-agent fallbacks.

## Current scope

- Course-catalog freshness depends on reviewed seed/research imports.
- General-education credits that are not mapped to a specific catalog course are labeled as placeholders instead of being presented as verified course recommendations.
- Authentication and database credentials are environment-specific and are intentionally excluded from source control.
