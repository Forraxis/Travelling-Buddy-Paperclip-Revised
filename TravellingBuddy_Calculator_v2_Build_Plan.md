# TravellingBuddy Calculator v2 — Build Plan

**Version:** 1.1
**Date:** May 2026
**Status:** Authoritative build sequence for Phase 1 calculator
**Companion to:** `TravellingBuddy_Calculator_v2_Specification.md`

**Changelog from 1.0:**
- Task 1.2: `VehicleVariant` updated from single `year` field to `year_from`, `year_to`, `is_current_production` with Postgres exclusion constraint. Migration renamed to `vehicle-entities-year-range`. Added three manual review questions for year-range validation
- Task 1.3: `CaravanVariant` updated equivalently. Migration renamed to `caravan-entities-year-range`. Added two manual review questions
- Phase 2: Added scraper guidance for year-range extraction and ingestion-time deduplication
- Phase 11: Added variant CRUD year-range admin actions (split range, advance year_to, close current production, overlap validation)
- Phase 12: Added per-year query capture structural requirements for vehicle/caravan profile page templates and combo pages. Added new sub-task for model-level page templates (vehicle and caravan)
- Note: Phase 1 tasks 1.2 and 1.3 were modified in place — this is expected per the year-range schema patch design

---

## How this document is used

This document defines the order, boundaries, and acceptance criteria for every task in the calculator build. It is the operational document — read linearly, executed in order, no shortcuts.

It is intended to be read by the orchestrating CEO/CTO agent (Paperclip) and by the engineer agents (Paperclip engineers, Claude Code). The CEO/CTO assigns tasks in the order defined here. Engineers execute one task at a time per the constraints below.

The companion master specification (`TravellingBuddy_Calculator_v2_Specification.md`) is the *what* and *why*. This document is the *how* and *in what order*. When a task references "see master spec section X," the agent reads that section before starting.

---

## Operational rules (apply to every task)

These rules are non-negotiable and prevent the failure modes observed in prior Paperclip projects.

**Rule 1: One task in flight at a time.** No parallel branches, no concurrent work on different tasks. The current task completes, is reviewed, is merged to main, and only then does the next task start. This prevents merge conflicts and the git breakage observed previously.

**Rule 2: Tasks execute in the order defined here.** No reordering, no skipping ahead, no "while I'm here let me also do." If a task seems out of order or missing prerequisites, the agent stops and flags it for human review. The CEO/CTO does not authorise out-of-order work.

**Rule 3: Each task has explicit prerequisites that must be verified before starting.** The task description lists files that must exist, tests that must pass, and prior tasks that must be complete. The agent verifies all of these before beginning work. If any prerequisite is missing, work does not start.

**Rule 4: Each task has explicit "does NOT" constraints.** The task description lists what the agent must NOT do during this task — what files not to touch, what dependencies not to add, what scope not to expand into. If the agent finds itself wanting to touch something outside the explicit scope, it stops and flags it for human review rather than proceeding.

**Rule 5: Each task ends with verifiable acceptance criteria.** The acceptance criteria are mechanical checks (tests pass, build succeeds, types check) plus human review questions. Both must be satisfied. The CEO/CTO does not mark a task complete based on the agent's self-report — the human review questions get answered by Tim or a designated reviewer.

**Rule 6: All work happens on feature branches with PR review.** No direct pushes to main. The branch name follows convention: `task/{phase-number}-{task-number}-{slug}`. Example: `task/4-3-vehicle-axle-loads`. The PR description copies the task description from this document. Merge to main after review and CI passes.

**Rule 7: All work is committed in conventional commit format.** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`. Commits are atomic — one logical change per commit, not "WIP" or "stuff" commits.

**Rule 8: Tests run on every commit via CI.** A task is not complete if CI is red. If CI breaks during a task, fixing CI is part of the task — not a separate task.

**Rule 9: Database changes go through Prisma migrations.** Never modify the database schema directly. Every schema change is a named migration that runs as part of deployment.

**Rule 10: Secrets in environment variables only.** Never in code, never in commits, never in this document. `.env.example` lists required variables with placeholder values. Real values live only on the deployment hosts.

**Rule 11: Safety-critical code requires extra review.** The physics engine module (`src/lib/physics/`) is safety-critical. Changes require explicit human review of the math, not just the test pass. Never modify physics code without sign-off from Tim.

**Rule 12: When in doubt, stop and ask.** If a task description is ambiguous, if a prerequisite is unclear, if the desired behaviour isn't obvious from the master spec, the agent stops and surfaces the question. Do not proceed on assumptions.

---

## Task structure

Every task in this document follows this structure:

```
### Task {phase}.{number}: {Title}

Phase: {phase number and name}
Estimated duration: {hours}
Depends on: {list of prior tasks that must be complete}

Context: {1–2 sentences on why this task exists, with reference to master spec section}

Prerequisites that must exist:
- {file paths or task IDs}

Deliverables:
- {file paths or features that this task produces}

This task does NOT:
- {explicit out-of-scope items}

Acceptance criteria (mechanical):
- {tests, builds, type checks}

Manual review questions (for sign-off):
- {questions the human reviewer must answer}
```

---

## Project conventions

**Project root:** `/home/travelbuddy/travellingbuddy/` (development) or wherever the project is cloned.

**Git remote:** GitHub repository (URL provided to agents at project setup).

**Branch strategy:**
- `main` — production-ready code, protected, no direct pushes
- `develop` — integration branch (optional; tasks may merge directly to main if scope is small)
- `task/*` — feature branches per task

**Commit format:** Conventional commits. Example: `feat(physics): implement vehicle axle load calculation`

**Code style:** Prettier and ESLint configured at project root. CI enforces formatting.

**Type safety:** TypeScript strict mode. No `any` without justification in a comment.

**Testing framework:** Vitest for unit tests, Playwright for end-to-end tests where applicable.

**Naming conventions:**
- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
- Functions and variables: `camelCase`
- Types and interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for runtime configuration

**Internationalisation:**
- All user-facing strings in next-intl translation files (`src/i18n/messages/en-AU.json` etc.)
- No inline English in components
- Default locale: en-AU

**Database:**
- Postgres 16
- Prisma ORM, schema in `prisma/schema.prisma`
- Migrations in `prisma/migrations/`
- Seed data in `prisma/seed/` organised by entity type

---

## Phase overview

The build is structured into 18 phases. Phases are sequential — no phase begins until the prior phase is complete.

| Phase | Name | Approximate scope |
|---|---|---|
| 0 | Environment and project setup | Repo, hosting, CI/CD, base Next.js scaffold |
| 1 | Database schema and migrations | All Prisma models for v1 entities |
| 2 | Vehicle and caravan catalogue | Data layer, admin CRUD, public browse |
| 3 | Accessory catalogue | Data layer, mounting locations, admin CRUD |
| 4 | Physics engine | Pure module, comprehensive tests |
| 5 | Calculator UI shell | Vehicle and caravan selection, blank state |
| 6 | Accessory picker and confirm-add | Search, browse, manual entry, impact preview |
| 7 | Right column results | Verdict, schematic, metrics, recommendations |
| 8 | Advanced panel | Top-down view, raw numbers, methodology |
| 9 | Account and saved setups | Auth, persistence, share URLs |
| 10 | Submission flows | Vehicle, caravan, accessory community submissions |
| 11 | Admin panel | Catalogue management, moderation queue, sponsors |
| 12 | SEO page templates | Vehicle, caravan, combo, accessory, guide pages |
| 13 | Sitemap and structured data | Indexation, schema markup, SEO infrastructure |
| 14 | PDF report generation | Setup PDF for sharing |
| 15 | Monetisation surfaces | AdSense, affiliate tracking, sponsored placements |
| 16 | Operational setup | Cloudflare, backups, monitoring, runbook |
| 17 | Pre-launch QA | Verification, performance, accessibility |
| 18 | Launch | Go live |

Within each phase, tasks are numbered sequentially (Phase 1 has tasks 1.1, 1.2, etc.). Some phases have many tasks; some have few.

---

## Phase 0: Environment and project setup

Phase goal: A working development environment with the empty Next.js application building, deployed to staging, and ready for feature work.

### Task 0.1: Initialise project repository

Phase: 0 (Environment and project setup)
Estimated duration: 1–2 hours
Depends on: nothing — this is the entry task

Context: Establish the git repository, README, license, and the operational rules and conventions in version control. Master spec section 11.5 defines the build structure.

Prerequisites that must exist:
- GitHub organisation or account where the repo will live (Tim provides)
- Git installed locally on the dev machine

Deliverables:
- Git repository initialised
- `README.md` with project overview pointing to master spec and build plan
- `LICENSE` file (Tim chooses; suggest UNLICENSED for now since it's proprietary)
- `.gitignore` configured for Next.js, Node, IDE files
- `.editorconfig` for consistent formatting across editors
- `CONTRIBUTING.md` summarising the operational rules from this document
- Initial commit on `main`
- `develop` branch created (optional but recommended)

This task does NOT:
- Create the Next.js application yet (Task 0.2)
- Configure hosting or CI/CD yet (Tasks 0.4, 0.5)
- Add any application code

Acceptance criteria (mechanical):
- Repository accessible at the GitHub URL
- `main` and `develop` branches exist
- `README.md`, `LICENSE`, `.gitignore`, `.editorconfig`, `CONTRIBUTING.md` exist in the repo

Manual review questions:
- Is the README clear about what the project is and how to find more information?
- Does CONTRIBUTING.md reflect the operational rules from the build plan accurately?

---

### Task 0.2: Scaffold Next.js application

Phase: 0
Estimated duration: 2–3 hours
Depends on: Task 0.1

Context: Create the empty Next.js 16 application with App Router, TypeScript strict mode, Tailwind CSS, and base configuration. Master spec section 11.1 defines the stack.

Prerequisites that must exist:
- Repository from Task 0.1
- Node.js 22 LTS installed locally

Deliverables:
- Next.js 16 application created with `create-next-app`
- App Router enabled (no Pages Router)
- TypeScript strict mode in `tsconfig.json`
- Tailwind CSS configured per design tokens in existing platform doc Section 9
- ESLint and Prettier configured
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `test`, `type-check`
- Basic homepage at `/` showing "TravellingBuddy" placeholder
- `.env.example` with placeholder for required variables

This task does NOT:
- Add any database integration (Phase 1)
- Add authentication (Phase 9)
- Add the calculator engine (Phase 4)
- Add any UI components beyond a placeholder homepage
- Install libraries beyond Next.js, React, Tailwind, ESLint, Prettier

Acceptance criteria (mechanical):
- `npm run dev` starts the dev server and serves the homepage
- `npm run build` succeeds with no errors
- `npm run lint` passes
- `npm run type-check` passes
- Tailwind classes render correctly on the placeholder homepage

Manual review questions:
- Are the Tailwind tokens (colours, fonts, spacing) configured to match the design system in the platform doc Section 9?
- Is TypeScript strict mode enabled?
- Is the project structure aligned with the master spec section 11.5?

---

### Task 0.3: Configure project structure scaffolding

Phase: 0
Estimated duration: 1–2 hours
Depends on: Task 0.2

Context: Create the directory structure for modules, components, lib, prisma, and i18n per master spec section 11.5. Empty placeholder files only — no logic yet.

Prerequisites that must exist:
- Next.js application from Task 0.2

Deliverables:
- Directory structure:
  - `src/modules/calculator/`
  - `src/modules/catalogue/`
  - `src/modules/setup/`
  - `src/modules/admin/`
  - `src/modules/submissions/`
  - `src/modules/auth/`
  - `src/modules/seo/`
  - `src/modules/regulation/`
  - `src/components/ui/`
  - `src/components/schematic/`
  - `src/components/metrics/`
  - `src/components/accessory-picker/`
  - `src/lib/db.ts` (placeholder)
  - `src/lib/physics/` (with placeholder index.ts)
  - `src/lib/i18n/` (placeholder)
  - `src/i18n/messages/en-AU.json` (empty object)
  - `prisma/` (with placeholder schema.prisma)
  - `prisma/seed/` (empty)
- Each directory has a `README.md` describing what goes in it (one paragraph)

This task does NOT:
- Add any actual code beyond placeholder index files
- Install Prisma yet (Task 1.1)
- Install next-intl yet (Task 0.6)
- Implement any module functionality

Acceptance criteria (mechanical):
- All directories exist
- Each has a README.md
- `npm run build` still succeeds (no broken imports)

Manual review questions:
- Does the directory structure match master spec section 11.5?
- Are the README files clear about what belongs in each directory?

---

### Task 0.4: Configure CI/CD pipeline

Phase: 0
Estimated duration: 2–3 hours
Depends on: Task 0.3

Context: Set up GitHub Actions to run lint, type-check, test, and build on every PR and push to main. This is enforcement infrastructure for Operational Rule 8.

Prerequisites that must exist:
- Repository from Task 0.1
- Application from Task 0.2

Deliverables:
- `.github/workflows/ci.yml` with:
  - Trigger on PR to main and develop, push to main
  - Job: install dependencies (Node 22 LTS, npm ci)
  - Job: run `npm run lint`
  - Job: run `npm run type-check`
  - Job: run `npm run test`
  - Job: run `npm run build`
  - All jobs must pass for PR to be mergeable
- Branch protection rules on `main` (set via GitHub UI by Tim, documented in this task):
  - Require PR review before merging
  - Require CI passing before merging
  - No force pushes
  - No deletions

This task does NOT:
- Configure deployment (Task 0.5)
- Add any production secrets to GitHub Actions
- Configure Renovate or dependency update automation (deferred)

Acceptance criteria (mechanical):
- A test PR triggers CI and all jobs run
- All jobs pass on the test PR
- Branch protection rules are visibly active on `main`

Manual review questions:
- Are the CI jobs running in a reasonable amount of time (under 5 minutes)?
- Are branch protection rules configured per the deliverable list?

---

### Task 0.5: Configure deployment to primary VPS

Phase: 0
Estimated duration: 4–6 hours
Depends on: Task 0.4

Context: Set up the deployment pipeline from GitHub Actions to the primary AU VPS. The application deploys via SSH and runs as a systemd service or via a process manager (PM2 or similar). Master spec section 11.3 defines hosting.

Prerequisites that must exist:
- Primary AU VPS accessible via SSH (Tim has this)
- CI from Task 0.4 working
- Node.js 22 LTS installed on the VPS
- Postgres 16 installed on the VPS (configuration done in Phase 1)

Deliverables:
- GitHub Actions workflow `.github/workflows/deploy-staging.yml` that:
  - Triggers on push to `develop` (or main if develop isn't used)
  - Builds the application
  - Deploys to the VPS via SSH (using a deploy key stored in GitHub secrets)
  - Runs database migrations (no-op until Phase 1)
  - Restarts the application service
- Process manager configuration on the VPS (PM2 ecosystem file or systemd service)
- Cloudflare configuration:
  - DNS A record pointing the staging domain to the VPS IP
  - SSL/TLS configured (Cloudflare Full or Full Strict)
  - Cache rules: bypass cache for `/api/*`, cache static assets aggressively
- Application accessible at the staging domain (Tim provides — likely a subdomain or `.dev` variant of `travellingbuddy.com.au`)
- Documented deploy process in `docs/operations/deployment.md`

This task does NOT:
- Configure the home Proxmox warm standby (Phase 16)
- Configure Postgres replication (Phase 16)
- Set up backups (Phase 16)
- Set up monitoring (Phase 16)
- Configure the production domain (Phase 18 — staging only here)

Acceptance criteria (mechanical):
- A push to develop (or main) triggers the deploy workflow
- The application is accessible via the staging URL after deploy
- The placeholder homepage renders
- Logs from the application are accessible on the VPS (`pm2 logs` or `journalctl`)

Manual review questions:
- Is the SSH deploy key stored securely in GitHub Secrets (not in code)?
- Does Cloudflare's TLS configuration match the master spec section 11.3?
- Is the deployment documented well enough that Tim can manually deploy if CI is unavailable?

---

### Task 0.6: Install and configure next-intl

Phase: 0
Estimated duration: 2–3 hours
Depends on: Task 0.5

Context: Set up internationalisation infrastructure from day one per master spec section 9.2. All user-facing strings will go through this from the first feature task.

Prerequisites that must exist:
- Application from Task 0.2
- Project structure from Task 0.3

Deliverables:
- `next-intl` installed and configured for App Router
- Default locale: `en-AU`
- Locale messages file at `src/i18n/messages/en-AU.json` with initial structure:
  - `common.*` for shared strings (yes, no, save, cancel, etc.)
  - `navbar.*` for navigation
  - `errors.*` for error messages
- Middleware for locale routing (configured for single locale at launch but ready for more)
- Documented usage pattern in `src/i18n/README.md`
- Placeholder homepage updated to use `t()` for any text

This task does NOT:
- Add any actual translations beyond en-AU
- Configure US or EU locales
- Set up imperial unit display (deferred, structured for later)
- Configure multi-domain routing (Phase 16 — single domain at launch)

Acceptance criteria (mechanical):
- `npm run build` succeeds
- The placeholder homepage uses `t()` for at least one string
- The translation file is loaded successfully
- A misspelled translation key produces a clear error in dev mode

Manual review questions:
- Is the translation file structure logical and easy to extend?
- Is the usage pattern documented clearly enough for future tasks to follow it?

---

### Task 0.7: Phase 0 sanity check and documentation

Phase: 0
Estimated duration: 1 hour
Depends on: Task 0.6

Context: Verify the entire Phase 0 environment is healthy and document anything specific to this project's setup that future tasks will need.

Prerequisites that must exist:
- All prior Phase 0 tasks complete

Deliverables:
- `docs/operations/development-setup.md` documenting:
  - How to clone the repo and get dev running
  - Required environment variables and where to source them
  - How to run tests, lint, type-check
  - How to deploy
  - Common troubleshooting
- `docs/operations/architecture.md` summarising the deployed architecture (single VPS, Postgres on same host, Cloudflare in front, deploy via GitHub Actions)
- Verification that:
  - `npm install`, `npm run dev`, `npm run build`, `npm run test`, `npm run lint`, `npm run type-check` all work locally
  - CI is green on main
  - Staging deploy works
  - The staging URL serves the placeholder homepage

This task does NOT:
- Document Phase 1+ work
- Set up any Phase 1 infrastructure

Acceptance criteria (mechanical):
- All listed verifications pass
- Documentation files exist and are accurate

Manual review questions:
- Could a new contributor (or Claude Code starting fresh) get the project running locally from these docs?
- Are there any environment-specific gotchas that aren't documented?

**Phase 0 gate:** Phase 1 cannot begin until Tim has reviewed and approved Phase 0. This is the first hard gate. Sign-off in writing (a comment on a tracking PR or a written confirmation).

---

## Phase 1: Database schema and migrations

Phase goal: Complete Prisma schema covering all v1 entities, with migrations applied to dev and staging databases. No application logic yet — just the data layer foundation.

This phase is intentionally large because the schema is the foundation for everything that follows. Getting it right here prevents schema rework in later phases. Master spec section 5 is the authoritative reference for schema decisions.

### Task 1.1: Install and configure Prisma

Phase: 1 (Database schema)
Estimated duration: 1–2 hours
Depends on: Phase 0 complete

Context: Install Prisma, configure it for Postgres, set up the basic schema file with no models yet.

Prerequisites that must exist:
- Phase 0 environment complete and verified
- Postgres installed on the VPS and accessible from the staging deploy
- Local Postgres available for development (Tim's choice — could be Docker, could be local install)

Deliverables:
- `prisma` and `@prisma/client` installed
- `prisma/schema.prisma` with:
  - `generator client` configured for `@prisma/client`
  - `datasource db` configured for Postgres with `DATABASE_URL` env variable
  - No models yet
- `src/lib/db.ts` exporting a singleton Prisma client
- `.env.example` updated with `DATABASE_URL` placeholder
- Local dev `.env.local` with development database URL (not committed)
- Staging deploy environment variables include `DATABASE_URL` for the staging database

This task does NOT:
- Add any models (Tasks 1.2–1.10)
- Run any seed scripts (Phase 2 onward)
- Configure database backups (Phase 16)

Acceptance criteria (mechanical):
- `npx prisma migrate status` runs successfully (with no migrations to apply)
- `src/lib/db.ts` imports without error
- `npm run build` succeeds

Manual review questions:
- Is the Prisma client a singleton (not creating multiple connections)?
- Is `DATABASE_URL` properly configured in all environments (local dev, staging, future production)?

---

### Task 1.2: Define vehicle entity schema

Phase: 1
Estimated duration: 2–3 hours
Depends on: Task 1.1

Context: Implement the vehicle entity hierarchy (Make → Model → Variant) per master spec section 5.1. No data yet — just the schema.

Prerequisites that must exist:
- Prisma configured (Task 1.1)
- Master spec section 5.1 read and understood

Deliverables:
- `prisma/schema.prisma` updated with:
  - `VehicleMake` model: id, name, slug, logo URL, country of origin, created_at, updated_at
  - `VehicleModel` model: id, makeId, name, slug, body type enum, created_at, updated_at
  - `VehicleVariant` model: id, modelId, year_from (int), year_to (int), is_current_production (boolean, default false), name, slug, GVM (kg), GCM (kg), kerb weight (kg), max towing capacity (kg), front axle limit (kg), rear axle limit (kg), wheelbase (mm), front overhang (mm), rear overhang (mm), total length (mm), max tow ball download (kg), fuel tank capacity (L), fuel type enum, market enum (default 'AU'), created_at, updated_at
  - Validation: `year_to >= year_from`; if `is_current_production` is true, `year_to` reflects the highest known model year and must be `<=` current calendar year + 1
  - Postgres exclusion constraint preventing overlapping year ranges per `(model_id, name)`:

  ```sql
  ALTER TABLE "VehicleVariant"
  ADD CONSTRAINT no_overlapping_year_ranges
  EXCLUDE USING gist (
    "modelId" WITH =,
    "name" WITH =,
    int4range("year_from", "year_to" + 1) WITH &&
  );
  ```

  (Requires `btree_gist` extension. Migration must enable it: `CREATE EXTENSION IF NOT EXISTS btree_gist;`)
  - Enums: `VehicleBodyType` (dual_cab_ute, single_cab_ute, extra_cab_ute, wagon, suv, van, troopcarrier, other), `FuelType` (diesel, petrol, hybrid, electric), `Market` (AU, NZ, US, EU, GB)
  - Indexes on slug fields for fast URL routing
  - Foreign key relationships
- Migration generated: `npx prisma migrate dev --name vehicle-entities-year-range`
- Migration applied to local dev database

This task does NOT:
- Seed any data (deferred to Phase 2)
- Add admin UI (Phase 11)
- Add caravan or accessory entities (Tasks 1.3, 1.5)

Acceptance criteria (mechanical):
- Migration applies cleanly
- Prisma client regenerates with new types
- `npx prisma studio` shows the empty tables
- `npm run build` succeeds
- `npm run type-check` succeeds

Manual review questions:
- Do all field names match master spec section 5.1?
- Are units (kg, mm, L) consistent and correctly stored as integers or decimals?
- Does the enum for `Market` include all the markets we want positioned for?
- Are slug fields properly indexed?
- Is `created_at` / `updated_at` consistently applied?
- Is the `btree_gist` extension enabled?
- Does the exclusion constraint reject an attempt to insert an overlapping range (test by inserting two rows with year_from=2018,year_to=2024 and year_from=2022,year_to=2025 for the same model+name — the second should fail)?
- Is `is_current_production` properly defaulting to false?

---

### Task 1.3: Define caravan entity schema

Phase: 1
Estimated duration: 2–3 hours
Depends on: Task 1.2

Context: Implement caravan entity hierarchy (Make → Model → Variant) per master spec section 5.1.

Prerequisites that must exist:
- Vehicle schema (Task 1.2) complete

Deliverables:
- `prisma/schema.prisma` updated with:
  - `CaravanMake` model: id, name, slug, logo URL, country of origin, created_at, updated_at
  - `CaravanModel` model: id, makeId, name, slug, body type enum, created_at, updated_at
  - `CaravanVariant` model: id, modelId, year_from (int), year_to (int), is_current_production (boolean, default false), name, slug, ATM (kg), GTM (kg), Tare (kg), TBM (kg), axle configuration enum, coupling-to-axle distance (mm), axle spacing (mm, nullable for single axle), body length (mm), overall length (mm), fresh water capacity (L), grey water capacity (L), gas bottle config, market enum, created_at, updated_at
  - Validation: `year_to >= year_from`; if `is_current_production` is true, `year_to` reflects the highest known model year and must be `<=` current calendar year + 1
  - Postgres exclusion constraint preventing overlapping year ranges per `(model_id, name)`:

  ```sql
  ALTER TABLE "CaravanVariant"
  ADD CONSTRAINT no_overlapping_caravan_year_ranges
  EXCLUDE USING gist (
    "modelId" WITH =,
    "name" WITH =,
    int4range("year_from", "year_to" + 1) WITH &&
  );
  ```

  (Requires `btree_gist` extension, enabled in the vehicle-entities-year-range migration.)
  - Enums: `CaravanBodyType` (caravan_pop_top, caravan_full_height, off_road_caravan, camper_trailer, hybrid, fifth_wheeler, other), `AxleConfiguration` (single_axle, dual_axle_close_coupled, dual_axle_spread, triple_axle)
- Migration generated: `npx prisma migrate dev --name caravan-entities-year-range`
- Migration applied

This task does NOT:
- Seed data
- Add admin UI
- Add accessory entities (Task 1.5)

Acceptance criteria (mechanical):
- Migration applies cleanly
- Prisma client regenerates
- `npm run build` and `npm run type-check` succeed

Manual review questions:
- Do all field names match master spec section 5.1?
- Is `axle_spacing_mm` correctly nullable (only set for tandems)?
- Is `coupling_to_axle_mm` properly representing the reference frame (master spec section 5.2)?
- Are all unit types consistent?
- Does the exclusion constraint reject an attempt to insert an overlapping range (test by inserting two rows with year_from=2021,year_to=2024 and year_from=2023,year_to=2026 for the same model+name — the second should fail)?
- Is `is_current_production` properly defaulting to false?

---

### Task 1.4: Define accessory base entities

Phase: 1
Estimated duration: 2–3 hours
Depends on: Task 1.3

Context: Brand, category, and accessory base tables per master spec section 5.1. AccessoryFitment is in Task 1.5 (separated for review purposes due to mounting locations complexity).

Prerequisites that must exist:
- Caravan schema (Task 1.3) complete

Deliverables:
- `prisma/schema.prisma` updated with:
  - `AccessoryBrand` model: id, name, slug, logo URL, website URL, status enum (active, inactive), is_partner boolean, created_at, updated_at
  - `AccessoryCategory` model: id, name, slug, description, parent category id (nullable, for hierarchy), display order, icon name, created_at, updated_at
  - `Accessory` model: id, brandId, categoryId, name, slug, description, image URLs (array), price min, price max, currency code (default 'AUD'), affiliate URL, status enum (active, discontinued, placeholder), market enum, created_at, updated_at
  - Enums: `AccessoryStatus` (active, discontinued, placeholder), `BrandStatus` (active, inactive)
- Migration generated: `npx prisma migrate dev --name accessory-base-entities`
- Migration applied

This task does NOT:
- Add AccessoryFitment (Task 1.5)
- Add mounting locations enum (Task 1.5 — kept together for review)
- Seed data
- Add admin UI

Acceptance criteria (mechanical):
- Migration applies cleanly
- `npm run build` and `npm run type-check` succeed

Manual review questions:
- Is `currency_code` properly defaulted with the ability to override per market?
- Is the parent category relationship correctly modelled for hierarchy?
- Are price min/max nullable (some accessories have no listed price)?

---

### Task 1.5: Define accessory fitment and mounting locations

Phase: 1
Estimated duration: 4–5 hours
Depends on: Task 1.4

Context: This is the most complex single schema task. AccessoryFitment links accessories to vehicle/caravan variants with all the position data, mounting locations, and confidence indicators. Master spec section 5.1 and 5.3 are the authoritative references.

Prerequisites that must exist:
- Accessory base entities (Task 1.4) complete
- Master spec sections 5.1 and 5.3 read and understood

Deliverables:
- `prisma/schema.prisma` updated with:
  - `AccessoryFitment` model:
    - id, accessoryId
    - vehicleVariantId (nullable — set if this fitment is for a vehicle)
    - caravanVariantId (nullable — set if this fitment is for a caravan)
    - Constraint: exactly one of vehicleVariantId, caravanVariantId must be set
    - installed_weight_kg (Decimal)
    - position_type enum (POINT, DISTRIBUTED)
    - cog_x_mm (Int, nullable for distributed without override)
    - start_x_mm (Int, nullable, for distributed)
    - end_x_mm (Int, nullable, for distributed)
    - cog_y_mm (Int, nullable, for top-down view lateral offset)
    - mounting_location enum (string) — what this fitment requires (nullable for chassis-direct accessories)
    - provides_mounting_locations (string array) — what this fitment provides
    - mount_offset_x_mm (Int, nullable — offset from parent when mounted to another accessory)
    - mount_offset_y_mm (Int, nullable)
    - capacity_litres (Decimal, nullable, for tanks)
    - fluid_density_kg_per_l (Decimal, nullable, for tanks; defaults provided in code)
    - position_confidence enum (verified, estimated, community)
    - position_source enum (manufacturer, community, estimated_category, measured_inhouse)
    - notes (text, nullable)
    - verified_at (DateTime, nullable)
    - verified_by (userId, nullable, foreign key to User — added when User table exists in Task 1.6)
    - created_at, updated_at
  - Enums:
    - `PositionType` (POINT, DISTRIBUTED)
    - `PositionConfidence` (verified, estimated, community)
    - `PositionSource` (manufacturer, community, estimated_category, measured_inhouse)
    - `MountingLocation` (chassis_front, chassis_rear, chassis_underside, bullbar, bullbar_winch_cradle, bullbar_aerial_mount, bullbar_light_bar, side_step, rock_slider, tray_floor, tray_roof, tray_canopy_side, drawer_top, roof_rack_top, roof_rack_side, roof_rack_front, towbar_tongue, towbar_underslung, caravan_a_frame, caravan_internal_front, caravan_internal_centre, caravan_internal_rear, caravan_roof_top, caravan_roof_side, caravan_rear_bumper, caravan_toolbar_top, caravan_toolbar_internal, other) — extensible enum, more locations can be added in future migrations
- Indexes on (vehicleVariantId, mounting_location), (caravanVariantId, mounting_location), and (accessoryId)
- Migration generated: `npx prisma migrate dev --name accessory-fitments`
- Migration applied

This task does NOT:
- Add user-facing logic for validating mounting compositions (Phase 6)
- Seed data
- Add admin UI
- Implement the position resolution algorithm (Phase 4 physics engine)

Acceptance criteria (mechanical):
- Migration applies cleanly
- Prisma client regenerates with the new types
- TypeScript types for the enum are accessible
- `npm run build` and `npm run type-check` succeed

Manual review questions:
- Is the constraint "exactly one of vehicleVariantId or caravanVariantId" enforced? (Note: Postgres CHECK constraint via Prisma's `@@check` may need raw SQL in migration — confirm approach)
- Are all the mounting locations from master spec covered, plus reasonable extensibility for future additions?
- Is `provides_mounting_locations` stored as an array (Postgres native array type)?
- Are confidence and source enums correctly capturing the data provenance model from master spec section 6.3?
- Are nullability rules correct for tank fields, mount offset fields, etc.?
- Will Tim be able to add new mounting locations later via migration without breaking existing data?

This is a critical task. Recommend Tim or another senior reviewer reads this schema carefully before sign-off.

---

### Task 1.6: Define user, account, and session entities

Phase: 1
Estimated duration: 2–3 hours
Depends on: Task 1.5

Context: NextAuth.js v5 requires specific schema for User, Account, Session, VerificationToken. Master spec section 5.4 covers the user entities and section 11.1 confirms NextAuth as the auth provider.

Prerequisites that must exist:
- Accessory fitment schema (Task 1.5) complete (because AccessoryFitment.verified_by references User)

Deliverables:
- `prisma/schema.prisma` updated with NextAuth-compatible schema:
  - `User` model: id, name, email (unique), emailVerified, image, role enum (user, moderator, admin), home_state enum (nullable, captures user's Australian state for regulation context), trust_tier enum (tier_0, tier_1, tier_2, tier_3), notification_preferences (JSON), created_at, updated_at
  - `Account` model: NextAuth Account schema (provider, providerAccountId, etc.)
  - `Session` model: NextAuth Session schema (sessionToken, userId, expires)
  - `VerificationToken` model: NextAuth schema
  - Enums: `UserRole` (user, moderator, admin), `AustralianState` (NSW, VIC, QLD, WA, SA, TAS, NT, ACT), `TrustTier` (tier_0, tier_1, tier_2, tier_3)
- Foreign key from `AccessoryFitment.verifiedBy` to `User.id` (now resolvable since User exists)
- Migration generated: `npx prisma migrate dev --name user-entities`
- Migration applied

This task does NOT:
- Set up NextAuth runtime (Phase 9)
- Implement auth UI (Phase 9)
- Seed admin users (deferred to Phase 11 admin panel setup)

Acceptance criteria (mechanical):
- Migration applies cleanly
- The User-AccessoryFitment foreign key is established
- `npm run build` and `npm run type-check` succeed

Manual review questions:
- Does the User schema include all NextAuth required fields?
- Is `home_state` correctly nullable (anonymous users have no state set)?
- Is the `notification_preferences` JSON structure documented somewhere (or deferred to Phase 9)?

---

### Task 1.7: Define setup and setup-accessory entities

Phase: 1
Estimated duration: 3–4 hours
Depends on: Task 1.6

Context: User-saved rig configurations per master spec section 5.4.

Prerequisites that must exist:
- User entities (Task 1.6) complete

Deliverables:
- `prisma/schema.prisma` updated with:
  - `Setup` model: id, ownerId, name, description, vehicleVariantId, caravanVariantId (nullable), passenger_count, passenger_avg_weight_kg, vehicle_cargo_kg, vehicle_fuel_pct, vehicle_water_pct (nullable, for vehicles with water tanks), caravan_fresh_water_pct (nullable), caravan_grey_water_pct (nullable), caravan_gear_kg (nullable), vehicle_kerb_calibration_kg (nullable, weighbridge override), caravan_tare_calibration_kg (nullable), share_token (unique UUID, generated on creation), regulation_set_code (defaults to user's home_state), notes, deleted_at (nullable, soft delete), created_at, updated_at
  - `SetupAccessory` model: id, setupId, accessoryFitmentId, parent_setup_accessory_id (nullable, for child accessories like winch on bullbar), quantity (default 1), fill_level_pct (nullable, for tanks), custom_weight_kg (nullable, override), custom_cog_x_mm (nullable, override), created_at, updated_at
  - `SetupCaravanAccessory` model: same structure as SetupAccessory but referencing caravan-side fitments
  - `SetupCustomLoad` model: id, setupId, attached_to enum (vehicle, caravan), description, weight_kg, position_x_mm, position_y_mm (nullable), created_at, updated_at
  - Enum: `LoadAttachment` (vehicle, caravan)
- Indexes on share_token (unique), ownerId, vehicleVariantId
- Migration generated and applied

This task does NOT:
- Add setup CRUD endpoints (Phase 9)
- Add UI (Phase 5+)
- Implement share token generation logic (Phase 9)

Acceptance criteria (mechanical):
- Migration applies cleanly
- All foreign keys established correctly
- `npm run build` and `npm run type-check` succeed

Manual review questions:
- Are all journey assumption fields present per master spec section 5.4?
- Is the parent-child relationship for SetupAccessory correctly modelled (allowing winch-on-bullbar)?
- Is the share_token globally unique?
- Is soft delete via `deleted_at` consistently usable across queries?

---

### Task 1.8: Define submission entities

Phase: 1
Estimated duration: 2–3 hours
Depends on: Task 1.7

Context: Community submission tables per master spec section 5.5.

Prerequisites that must exist:
- All prior schema tasks complete

Deliverables:
- `prisma/schema.prisma` updated with:
  - `VehicleSubmission` model: id, submitterId, status enum (pending, approved, rejected), submitted data (JSON capturing the proposed VehicleVariant fields), compliance_plate_photo_url, additional_photo_urls (string array), notes, decided_by (userId nullable), decided_at (nullable), decision_notes, resulting_variant_id (nullable, set if approved), created_at, updated_at
  - `CaravanSubmission` model: similar structure for caravans
  - `AccessorySubmission` model: id, submitterId, status, brand_id (nullable, can reference existing or be a new brand name), category_id (nullable), submitted data JSON, product_photo_url, installation_photo_url, applies_to_vehicle_variant_id (nullable), applies_to_caravan_variant_id (nullable), notes, decided_by, decided_at, decision_notes, resulting_accessory_id, resulting_fitment_id, created_at, updated_at
  - Enum: `SubmissionStatus` (pending, approved, rejected)
- Indexes on status (for moderator queue queries), submitterId
- Migration generated and applied

This task does NOT:
- Implement submission UI (Phase 10)
- Implement moderation flow (Phase 11)
- Configure photo upload storage (Phase 10)

Acceptance criteria (mechanical):
- Migration applies cleanly
- All foreign keys established
- `npm run build` and `npm run type-check` succeed

Manual review questions:
- Is the JSON submitted data field flexible enough to capture all proposed fields without forcing rigid structure (since submission data may be incomplete)?
- Are photo URL fields appropriate for the eventual storage solution (S3-compatible, signed URLs, or direct upload paths)?

---

### Task 1.9: Define sponsor and regulation entities

Phase: 1
Estimated duration: 2–3 hours
Depends on: Task 1.8

Context: Sponsorship, regulation sets, and audit/moderation tracking per master spec sections 5.6, 5.7, 5.8.

Prerequisites that must exist:
- All prior schema tasks complete

Deliverables:
- `prisma/schema.prisma` updated with:
  - `Sponsor` model: id, name, contact_name, contact_email, billing_reference, status enum, created_at, updated_at
  - `SponsoredPlacement` model: id, sponsorId, placement_type enum (accessory_featured, category_top, recommendation_pinned, vehicle_type_featured), accessory_id (nullable), category_id (nullable), vehicle_body_type (nullable), state_filter (nullable, restricts to specific states), starts_at, ends_at, tier enum, notes, created_at, updated_at
  - `RegulationSet` model: id, code (unique, e.g. 'AU-federal', 'AU-QLD'), name, parent_set_code (nullable, for hierarchical merge), rules (JSON containing GVM upgrade rules, brake thresholds, speed limits, licence thresholds, length limits, overhang rules, authoritative_source_urls), market enum, created_at, updated_at
  - `AuditLog` model: id, entity_type (string, e.g. 'VehicleVariant'), entity_id, action enum (create, update, delete), changed_by (userId), changes (JSON before/after), reason, created_at
  - `ModerationAction` model: id, submission_type (string), submission_id, moderator_id, action enum (approve, reject, request_info), notes, created_at
  - Enums: `SponsorStatus` (active, paused, expired), `PlacementTier` (featured_fit, category_top, recommendation_pinned), `PlacementType` (accessory_featured, category_top, recommendation_pinned, vehicle_type_featured), `AuditAction` (create, update, delete), `ModerationActionType` (approve, reject, request_info)
- Migration generated and applied

This task does NOT:
- Implement sponsorship UI (Phase 11)
- Implement regulation lookup logic (Phase 4 — used by physics engine)
- Implement audit logging triggers (Phase 11 — admin panel adds these)

Acceptance criteria (mechanical):
- Migration applies cleanly
- All foreign keys established
- `npm run build` and `npm run type-check` succeed

Manual review questions:
- Is the regulation_set rules JSON structure documented (even informally) somewhere?
- Does the SponsoredPlacement schema support all placement types described in master spec section 12.3?
- Is the audit log generic enough to track changes on any entity type?

---

### Task 1.10: Phase 1 verification and consolidation

Phase: 1
Estimated duration: 2 hours
Depends on: Tasks 1.1–1.9

Context: Verify the complete schema is internally consistent, all migrations apply cleanly from scratch, and Prisma generates valid TypeScript types.

Prerequisites that must exist:
- All prior Phase 1 tasks complete

Deliverables:
- Verification that `npx prisma migrate reset` followed by `npx prisma migrate deploy` produces a clean database state
- Verification that all foreign key relationships resolve
- A schema diagram (auto-generated via `prisma-erd-generator` or manually maintained) at `docs/schema/erd.md` or similar
- Documentation at `docs/schema/conventions.md` explaining:
  - Naming conventions (snake_case in DB, camelCase in TS)
  - How enums are organised
  - Soft delete pattern (where used)
  - Audit logging pattern
  - Confidence and provenance pattern (used on AccessoryFitment, expandable to other entities later)
- Confirmation that staging environment can apply all migrations

This task does NOT:
- Add seed data (Phase 2 onward)
- Implement any application logic against the schema

Acceptance criteria (mechanical):
- Fresh database setup from migrations succeeds
- `npx prisma validate` passes
- Generated TypeScript types compile without errors
- Documentation files exist and are accurate

Manual review questions:
- Reviewing the full schema, is there anything missing for v1?
- Are there any obvious data integrity issues (missing constraints, ambiguous nullability)?
- Does the schema match master spec section 5 in all material respects?

**Phase 1 gate:** Phase 2 cannot begin until Tim has reviewed and approved the complete schema. This is a hard gate. The schema is the foundation and changes here cascade through every subsequent phase, so review carefully.

---

## Phase 2: Vehicle and caravan catalogue

Phase goal: Data layer, admin CRUD, and public browse for vehicle and caravan catalogues.

**Scraper guidance (year-range extraction):**

Scrapers extract coverage range as a first-class output. Where a manufacturer source publishes specifications under a single page covering multiple model years (the common case for Toyota, Isuzu, Mazda truck/ute pages), the scraper extracts `year_from`, `year_to`, and a flag indicating whether the page implies current production. Where specifications change mid-range (rare; typically captured in a model's revision notes or a sub-page), the scraper emits multiple variant rows representing the split. Single-year scrape outputs are valid (year_from = year_to) for cases where the source publishes year-by-year detail, but the catalogue layer's deduplication pass collapses adjacent identical rows into a range during ingestion review.

*Phase 2 tasks to be defined.*

---

## Phase 11: Admin panel

**Variant CRUD additions (year-range):**

- Variant edit form exposes `year_from`, `year_to`, and `is_current_production` as discrete fields with validation per spec 5.1
- "Split this range" admin action: takes a year within the variant's range and produces two or three new variant rows (before-anomaly, anomaly-year(s), after-anomaly), with regulatory data initially copied from the source row for editor review
- "Advance year_to" admin action: increments `year_to` on a current-production variant (typical use: new model year confirmed identical to prior year). Regenerates slug; creates 301 redirect from prior slug; audit-logs the change
- "Close current production" admin action: sets `is_current_production = false`, locks `year_to`, regenerates slug from the `-current` form to the closed-range form, creates 301 redirect, audit-logs
- Overlap validation on save: relies on the database exclusion constraint; UI surfaces the constraint error in a clear way ("This range overlaps with an existing variant covering YYYY–YYYY")

---

## Phase 12: SEO page templates

**Vehicle and caravan profile page template requirements (year-range):**

Vehicle and caravan profile page templates must implement the per-year query capture structure per spec section 9.4. Specifically:

- Title, H1, meta description, lead paragraph generation must enumerate each year in the variant's range explicitly (no "2018–2024" alone in lead-paragraph plain text — must include "2018, 2019, 2020, 2021, 2022, 2023, and 2024" as enumeration)
- Year selector affordance component renders chips for each year covered
- FAQ generator produces (year × headline-metric) entries up to the 12–15 entry cap; selection priority order per spec section 9.4
- JSON-LD generators produce both FAQPage and Vehicle entities, with `productionDate` set to the ISO 8601 interval
- Adjacent-range link queries follow the heuristic in spec section 9.4 (one per direction maximum)
- Variant sibling links use the hybrid model: strict-overlap siblings displayed prominently, "see all variants" overflow link to the model-level page

Combo page templates inherit this structure on both vehicle and caravan halves. Title format, lead-paragraph cross-product enumeration, and FAQ entry priority order per spec section 9.4.

### New sub-task: Model-level page templates

**Phase:** 12
**Estimated duration:** 4–6 hours
**Depends on:** Phase 1 catalogue schema (year-range), Phase 2 catalogue data layer

**Context:** Model-level pages (`/vehicles/{make}/{model}/` and `/caravans/{make}/{model}/`) aggregate all variants of a model into a single landing page. They capture generation-agnostic search queries and serve as the destination for the "see all variants" overflow link from variant profile pages. Page structure per spec section 9.4 (model-level pages subsection).

**Deliverables:**
- `src/app/vehicles/[make]/[model]/page.tsx` route with SSG
- `src/app/caravans/[make]/[model]/page.tsx` route with SSG
- Model-level page template component (parameterised by entity type)
- Variant aggregation query: groups all variants of the given model by variant-name, sorts within group by `year_from` descending
- Variant table component rendering name, year range (closed or `-present` form), headline specs, and link to variant profile page
- Lead paragraph generator using model-level data (earliest `year_from`, body types covered, variant count)
- Internal links generator for popular combo pages and accessory categories
- JSON-LD generator producing `ItemList` of variant entities
- generateMetadata producing title, description, canonical
- Sitemap entry generation for model-level URLs in the secondary sitemap (per spec section 9.7 tiering)

**This task does NOT:**
- Implement per-variant detail rendering (that's the variant profile page task)
- Add admin UI for managing model-level page content (the page is purely generated from catalogue data)
- Implement make-level pages (`/vehicles/{make}/`) — explicitly out of scope per spec section 9.2

**Acceptance criteria (mechanical):**
- All variant rows render with correct year-range formatting
- Variants are correctly grouped by variant-name and sorted by year_from descending within each group
- "See all variants" links from variant profile pages resolve correctly to the model-level page
- Sitemap includes model-level URLs
- `npm run build` and `npm run type-check` succeed

**Manual review questions:**
- Does the variant table render sensibly for models with high variant counts (e.g. Hilux with all body/drivetrain/transmission combinations across multiple generations)?
- Is the lead paragraph reading naturally for both old discontinued models and current-production models?
- Are popular combo page links surfacing the most-trafficked combos (or sensible defaults pre-launch)?

---

*Build plan continues with remaining phases.*
