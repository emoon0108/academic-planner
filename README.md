# AcademiQ

AcademiQ is a full-stack academic planning engine that turns degree requirements, prerequisites, transfer credit, workload preferences, and career goals into explainable semester-by-semester plans.

![AcademiQ degree-planning interface](docs/academiq-overview.jpg)

This public portfolio project includes an in-memory demo path, so the planning engine and interface can be explored locally without credentials or a hosted database. Database persistence, managed authentication, and external AI services are optional integrations.

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
pnpm dev
```

With no environment file, AcademiQ starts in a local demo mode backed by in-memory data and a non-production demo identity. To exercise optional integrations, copy `.env.example` to `.env` and configure only the services you need.

- `DATABASE_URL` enables MySQL persistence instead of the in-memory repository.
- The OAuth variables enable managed sign-in instead of the development identity.
- `OPENAI_API_KEY` enables live AI advising; deterministic, tested fallback guidance remains available without it.
- The Forge variables enable the original managed storage, media, map, and notification adapters.

## Verification

```bash
pnpm verify
```

This runs the TypeScript check, 43 unit/integration tests, the production client build, and the bundled server build. Tests cover graph ordering, plan generation, eight-term credit balancing, replanning, account deletion/reset, session-secret enforcement, authentication, and academic-agent fallbacks.

## Current scope

- Course-catalog freshness depends on reviewed seed/research imports.
- General-education credits that are not mapped to a specific catalog course are labeled as placeholders instead of being presented as verified course recommendations.
- Authentication and database credentials are environment-specific and are intentionally excluded from source control.

## Data and security

The bundled catalog records are prototype fixtures assembled from public academic information and are not authoritative advising data. Verify course availability, prerequisites, and degree rules with the relevant institution before making enrollment decisions. Do not use real student records in a public demo environment.

Please report security concerns using the process in [SECURITY.md](SECURITY.md).

## License

Original source code is available under the [MIT License](LICENSE). University catalog content, font files, institutional names, and third-party material are excluded or separately licensed as described in [ASSET-LICENSE.md](ASSET-LICENSE.md).
