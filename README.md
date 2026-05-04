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

- **Framework:** Next.js (App Router) with TypeScript strict mode
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL 16 with Prisma ORM
- **Testing:** Vitest (unit), Playwright (e2e)
- **Hosting:** Self-hosted on Proxmox

## Getting Started

Application setup instructions will be added in Task 0.2 (Next.js scaffold).

## License

UNLICENSED — Proprietary. All rights reserved.
