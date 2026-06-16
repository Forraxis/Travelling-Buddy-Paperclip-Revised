# TravellingBuddy Calculator v2

A physics-grade rig weight and compliance calculator for Australian road travellers. It evaluates whether a touring vehicle (with or without an attached caravan or trailer) is legal, safe, and well-balanced under its current load configuration.

## What makes it different

Most existing Australian towing calculators check three numbers: GVM, GCM, and tow ball mass. They miss the questions that actually fail real-world rigs:

- **Front and rear axle loads.** A vehicle can be under GVM but over its rear axle limit.
- **Caravan tow ball mass as a function of internal load distribution.** TBM depends on where weight sits inside the van relative to the axle.
- **Single vs. dual axle handling.** Different axle configurations have different loading tolerances.

The calculator computes longitudinal centre of gravity for both vehicle and caravan, treating them as beams supported by their axles.

## Who it serves

- **Caravan and camper trailer towers** — grey nomads, families, weekend tourers
- **Touring rig owners without caravans** — 4WD tourers, ute camper users, van lifers, expedition builders

The vehicle is always present. The caravan is an optional attachment.

## Documentation

- **Master Specification:** `TravellingBuddy_Calculator_v2_Specification.md`
- **Build Plan:** `TravellingBuddy_Calculator_v2_Build_Plan.md`
- **Open Decisions:** `TravellingBuddy_Calculator_v2_Open_Decisions.md`
- **Architecture Overview:** `TravellingBuddy_Master_Architecture_Overview_v1_0.md`

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19, TypeScript strict mode
- **Styling:** Tailwind CSS v4
- **Database:** PostgreSQL with Prisma 7 (PrismaPg driver adapter)
- **Auth:** NextAuth v5 (Google OAuth + credentials)
- **Async jobs:** BullMQ + Redis (VLM/OCR, photo post-process), auto-started via `src/instrumentation.ts`
- **Storage / AI / email:** Cloudflare R2 (photos), Tesseract + Qwen VLM (submission OCR), Resend (email)
- **Testing:** Vitest (unit), Playwright (e2e)
- **Hosting:** Self-hosted on Proxmox

## Getting Started

Postgres and Redis run locally in Docker (`tb-postgres` on 5432, `tb-redis` on 6379).

```bash
# 1. Install deps
npm install

# 2. Configure env — copy and fill in. The server validates env at boot
#    (src/lib/env.ts); in production it refuses to start on missing secrets.
cp .env.example .env.local

# 3. Apply migrations + generate the Prisma client.
#    The Prisma CLI does not auto-load .env, so pass DATABASE_URL inline:
DATABASE_URL=postgresql://travelbuddy:travelbuddy_dev@localhost:5432/travellingbuddy \
  npx prisma migrate dev
DATABASE_URL=… npx prisma generate

# 4. Run the dev server (Next + turbopack on port 3070)
npm run dev          # → https://tbr.dev.ragebots.me

# Quality gates (the same checks CI runs)
npm run type-check   # tsc --noEmit
npm run test         # vitest run
npm run lint         # eslint . && prettier --check .
npm run lint:fix     # auto-fix eslint + prettier
```

> After any `schema.prisma` change, regenerate the client **and restart** the dev
> server — the running process holds the old client, otherwise Prisma throws a
> validation error on the new fields.

See `RIG_LAYOUT.md` and `CALIBRATION_SIGNOFF.md` for current feature state, and the
root `CLAUDE.md` for an at-a-glance project orientation.

## License

UNLICENSED — Proprietary. All rights reserved.
