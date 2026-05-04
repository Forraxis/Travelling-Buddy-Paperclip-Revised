# Contributing to TravellingBuddy Calculator v2

This document summarises the operational rules that govern all work on this project. These rules are non-negotiable and are derived from the build plan (`TravellingBuddy_Calculator_v2_Build_Plan.md`).

## Operational Rules

### Rule 1: One task in flight at a time

No parallel branches, no concurrent work on different tasks. The current task completes, is reviewed, is merged to main, and only then does the next task start.

### Rule 2: Tasks execute in defined order

No reordering, no skipping ahead, no "while I'm here let me also do." If a task seems out of order or missing prerequisites, stop and flag it for human review.

### Rule 3: Verify prerequisites before starting

Each task has explicit prerequisites that must be verified before starting. If any prerequisite is missing, work does not start.

### Rule 4: Respect scope boundaries

Each task has explicit "does NOT" constraints. If you find yourself wanting to touch something outside the explicit scope, stop and flag it for human review.

### Rule 5: Verifiable acceptance criteria

Acceptance criteria include mechanical checks (tests pass, build succeeds, types check) plus human review questions. Both must be satisfied.

### Rule 6: Feature branches with PR review

No direct pushes to main. Branch naming convention: `task/{phase-number}-{task-number}-{slug}`. PRs copy the task description from the build plan.

### Rule 7: Conventional commits

Use `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`. Commits are atomic — one logical change per commit.

### Rule 8: Tests run on every commit via CI

A task is not complete if CI is red. Fixing CI is part of the task, not a separate task.

### Rule 9: Database changes go through Prisma migrations

Never modify the database schema directly. Every schema change is a named migration.

### Rule 10: Secrets in environment variables only

Never in code, never in commits. `.env.example` lists required variables with placeholder values.

### Rule 11: Safety-critical code requires extra review

The physics engine module (`src/lib/physics/`) is safety-critical. Changes require explicit human review of the math. Never modify physics code without sign-off from Tim.

### Rule 12: When in doubt, stop and ask

If a task description is ambiguous, if a prerequisite is unclear, if the desired behaviour isn't obvious from the master spec, stop and surface the question.

## Code Conventions

- **Files:** `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
- **Functions/variables:** `camelCase`
- **Types/interfaces:** `PascalCase`
- **Constants:** `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for runtime config
- **Internationalisation:** All user-facing strings in next-intl translation files, no inline English in components
- **Default locale:** en-AU
