**TravellingBuddy**

Master Architecture Overview

The complete technical blueprint for building Australia’s

most comprehensive travel companion platform

Version 1.0 · April 2025 · Confidential

Primary domain: travellingbuddy.com.au

Table of Contents

1. Vision & Purpose

> What is TravellingBuddy?
>
> TravellingBuddy is a comprehensive travel companion platform for Australians who travel by road — towing caravans, touring in 4WDs, or living the van life. It starts as a GVM/GCM compliance calculator and evolves into a full ecosystem covering fuel planning, route optimisation, overnight stops, community data, and travel gear.
>
> The platform earns revenue through contextual advertising, affiliate partnerships, sponsored listings, booking commissions, and eventually product sales.

1.1 The Flywheel

Each phase of the platform feeds the next. The GVM calculator attracts the target audience through SEO. User accounts created during calculator use carry forward to fuel planning. Rig profiles built for fuel planning enable smart route optimisation. Route planning surfaces overnight stop opportunities. Community data from all these interactions creates a dataset that becomes the platform’s competitive moat.

1.2 Target Audience

- Caravan and camper trailer owners (primary — largest market in Australia)

- 4WD tourers and overlanders

- Van lifers and digital nomads

- Grey nomads (retirees travelling Australia long-term)

- Weekend warriors with boat/jet ski/trailer setups

1.3 Revenue Model

| **Revenue Stream**     | **Phase** | **Mechanism**                                                              |
| Google AdSense         | Phase 1   | Display ads on calculator and SEO pages                                    |
| Affiliate links        | Phase 1   | Accessory and GVM upgrade kit recommendations with tracked links           |
| Sponsored listings     | Phase 1   | GVM upgrade providers pay for featured placement when users are over GVM   |
| Lead magnet            | Phase 1   | Email capture via PDF report — builds mailing list for future monetisation |
| Fuel partner referrals | Phase 3   | Fuel discount partnerships or loyalty program integrations                 |
| Booking commissions    | Phase 5   | Commission on caravan park, station stay, and farm stay bookings           |
| Product sales          | Phase 6+  | Direct or curated product sales — bulk buying, white-label, affiliate      |

2. Domain Strategy

2.1 Owned Domains

| **Domain**                 | **Purpose**                                                        | **Status**         |
| **travellingbuddy.com.au** | PRIMARY — Australian launch domain. All canonical URLs point here. | Active             |
| travellingbuddy.au         | Future primary when going global, or AU shortform redirect         | Redirect → .com.au |
| travellingbuddy.co         | Global expansion domain candidate                                  | Parked             |
| travelingbuddy.au          | Typo catch (single L)                                              | Redirect → .com.au |
| travelingbuddy.com.au      | Typo catch (single L)                                              | Redirect → .com.au |
| travelingbuddy.co          | Typo catch (single L)                                              | Redirect → .com.au |

2.2 Redirect Strategy

All non-primary domains must 301 redirect to travellingbuddy.com.au. This consolidates SEO authority onto a single domain. Implement at DNS/CDN level (Cloudflare page rules or similar) — not in the application.

2.3 Global Expansion Path

When expanding beyond Australia, evaluate whether to use travellingbuddy.co as the global root with country-specific subdomains (au.travellingbuddy.co, uk.travellingbuddy.co) or to acquire country-specific TLDs (.co.uk, .co.nz). Decision deferred to post-Phase 3 when traffic data will inform the approach. The application architecture must support multi-region deployment from Phase 1 — no hardcoded AU assumptions in core business logic.

3. Infrastructure & Deployment

3.1 Production Server Topology

| **Node**              | **Role**                                                                          | **Specs**                                   | **Location**             |
| **VPS-1 (Primary)**   | Docker Swarm manager, CockroachDB node 1, Next.js app, Fastify API, Redis primary | 10 vCPU, 38GB RAM, 250GB SSD                | AU region                |
| **VPS-2 (Secondary)** | Swarm worker, CockroachDB node 2, Next.js app (redundancy), Redis replica         | To be provisioned (recommend 8 vCPU, 16GB+) | AU region (different DC) |
| **VPS-3 (Tertiary)**  | Swarm worker, CockroachDB node 3 (quorum), BullMQ workers, background jobs        | To be provisioned (recommend 4 vCPU, 8GB+)  | AU region                |

3.2 Proxmox On-Premises Environment

The Proxmox server (dual EPYC 7713, 1TB RAM, 20TB storage) hosts development, staging, monitoring, and analytics workloads. This keeps all non-production activity off the VPS nodes and provides a full production mirror for testing.

| **VM**         | **Role**                                                                                         | **Specs**               | **Docker Mode**        |
| **Staging-1**  | Swarm manager, CockroachDB node 1, Next.js, Fastify, Redis primary                               | 8 vCPU, 16GB RAM, 200GB | Docker Swarm (manager) |
| **Staging-2**  | Swarm worker, CockroachDB node 2, Next.js (redundancy), Redis replica                            | 6 vCPU, 12GB RAM, 150GB | Docker Swarm (worker)  |
| **Staging-3**  | Swarm worker, CockroachDB node 3, BullMQ workers                                                 | 4 vCPU, 8GB RAM, 100GB  | Docker Swarm (worker)  |
| **Dev**        | Paperclip/Claude Code workspace. Single-node everything. Hot-reload enabled.                     | 8 vCPU, 16GB RAM, 200GB | Docker Compose         |
| **Monitoring** | Prometheus, Grafana, Plausible Analytics, log aggregation, offline CockroachDB analytics replica | 4 vCPU, 8GB RAM, 100GB  | Docker Compose         |

Total Proxmox allocation: 30 vCPU, 60GB RAM — approximately 12% CPU and 6% RAM utilisation of the host.

3.3 Environment Pipeline

Code flows through three environments before reaching users:

- **Dev (Proxmox — Docker Compose):** Active development. Single-node CockroachDB, single Redis. Hot-reload on file changes. Debug logging enabled. Paperclip/Claude Code works here via SSH.

- **Staging (Proxmox — Docker Swarm, 3 VMs):** Production mirror. Same Swarm stack file as production, same 3-node CockroachDB cluster, same service distribution. Used for integration testing, deployment rehearsal, and performance validation before promoting to production.

- **Production (3 VPS nodes — Docker Swarm):** Live environment serving travellingbuddy.com.au. Same Swarm stack file as staging with production secrets, domain config, and Cloudflare integration.

The staging Swarm stack file (docker-stack.yml) is the single source of truth for service definitions. It is used identically in staging and production — only environment variables (.env) differ between environments. This ensures what you test in staging is exactly what you deploy to production.

3.4 Why Docker Swarm

Docker Swarm is the right orchestration choice for this project at this scale. It provides multi-host container orchestration with service discovery, rolling deployments (update one node at a time for zero downtime), built-in load balancing across nodes, and overlay networking for cross-VM communication — all with significantly less operational complexity than Kubernetes.

Swarm runs on the staging 3-VM cluster and the production 3-VPS cluster identically. The Dev VM uses Docker Compose (single-host, no orchestration overhead) for fast iteration.

3.5 Load Balancing & Routing

- Use Cloudflare as CDN and DNS with proxied records for DDoS protection and edge caching

- Cloudflare load balancing between VPS-1 and VPS-2 for the Next.js frontend

- API traffic routes to VPS-1 primary, VPS-2 failover via health-check-based routing

- Docker Swarm ingress routing mesh distributes traffic to healthy containers across nodes

- WebSocket connections (Phase 4+) use sticky sessions on the load balancer

3.6 Deployment Pipeline

- Git repository on GitHub (private)

- CI/CD via GitHub Actions: lint → test → build → push Docker images to registry

- Staging deploy: GitHub Action SSHs to Staging-1 (Swarm manager) and runs docker stack deploy

- Production deploy: manual promotion — same stack file, production secrets, triggered via GitHub Action approval gate

- Database migrations run as a one-shot container in the Swarm stack before app containers start

- Rolling updates: Swarm updates one container at a time with health checks — automatic rollback on failure

- Docker images tagged with git SHA for traceability: travellingbuddy/app:abc1234

3.7 Monitoring & Alerting

The dedicated Monitoring VM on Proxmox centralises observability for all environments.

- **Prometheus:** scrapes metrics from all staging and production nodes. CockroachDB, Redis, Node.js, and host-level metrics.

- **Grafana:** dashboards for infrastructure health, application performance, CockroachDB cluster status, Redis cache hit rates, and business metrics (calculator usage, conversion rates).

- **Plausible Analytics:** self-hosted, privacy-first web analytics. No cookie banner required. Tracks page views, referrers, and custom events (affiliate clicks, share actions).

- **Sentry:** application error tracking and performance monitoring. Integrated into Next.js and Fastify.

- **Log aggregation:** Loki + Grafana for centralised log search across all containers and nodes.

- **Uptime monitoring:** external service (UptimeRobot or Better Stack) for production availability checks.

- **CockroachDB admin UI:** built-in on port 8080, restricted to VPN/SSH tunnel access only.

- **Alerting:** Grafana alerting rules with Slack webhook (or PagerDuty) for critical thresholds — node down, disk \> 80%, error rate spike, CockroachDB quorum loss.

The Monitoring VM also hosts an offline CockroachDB replica that receives periodic data exports from production. This replica is used for heavy analytical queries, reporting, and data exploration without impacting production performance.

4. Technology Stack

4.1 Core Stack

| **Layer**         | **Technology**           | **Purpose**                                               | **Notes**                             |
| **Frontend**      | Next.js 16 (App Router)  | SSR, SSG, PWA shell, SEO pages                            | TypeScript throughout                 |
| **UI Framework**  | Tailwind CSS + shadcn/ui | Utility-first styling, accessible components              | Radix primitives under shadcn         |
| **API Server**    | Fastify                  | REST API, WebSocket server, background job orchestration  | Modular plugin architecture           |
| **Database**      | CockroachDB              | Primary data store, distributed SQL, spatial queries      | PostgreSQL-compatible, 3-node cluster |
| **ORM**           | Prisma                   | Type-safe database access, migrations, schema management  | CockroachDB adapter available         |
| **Cache / Queue** | Redis                    | Response caching, session store, BullMQ job queue backing | Primary on VPS-1, replica on VPS-2    |
| **Job Queue**     | BullMQ                   | Scheduled fuel polling, data aggregation, email delivery  | Workers on VPS-3                      |
| **Auth**          | NextAuth.js v5           | Email/password + Google OAuth, JWT sessions               | Prisma adapter                        |
| **Email**         | Resend                   | Transactional email (auth, lead magnets, notifications)   |                                       |
| **Analytics**     | Plausible (self-hosted)  | Privacy-first analytics, no cookie banner required        | Host on Proxmox or VPS-3              |
| **Forms**         | React Hook Form + Zod    | Type-safe form validation                                 |                                       |
| **Charts**        | Recharts                 | GVM/GCM gauges, fuel price charts, analytics dashboards   |                                       |
| **Maps**          | Leaflet + OpenStreetMap  | Fuel station map, route display, overnight stop markers   | Free, no API key needed               |

4.2 Architecture Pattern: Modular Monolith

The application follows a modular monolith pattern. All business logic lives in a single TypeScript codebase, but is organised into clearly bounded modules. Each module owns its own Prisma schema segment, API routes, business logic, and types. Modules communicate through well-defined interfaces, not direct database queries across boundaries.

This approach gives you the simplicity of a monolith (one deploy, one codebase, shared types) with the future flexibility to extract any module into a standalone microservice if performance or scaling demands it.

| **Module**     | **Scope**                                                          | **Extraction Trigger**                              |
| **calculator** | GVM/GCM calculation engine, vehicle/caravan data, upgrade pathways | Unlikely to need extraction                         |
| **auth**       | User accounts, sessions, OAuth, trust tiers                        | Unlikely                                            |
| **fuel**       | Fuel station data, price polling, price history, station metadata  | Extract if polling workers need dedicated resources |
| **rig**        | User rig profiles, fuel consumption tracking, range settings       | Unlikely                                            |
| **routing**    | Route planning, fuel stop optimisation, overnight stop suggestions | Extract if computation becomes CPU-intensive        |
| **community**  | User reviews, van-friendly ratings, fuel logs, trust/reputation    | Extract if moderation queue grows large             |
| **bookings**   | Accommodation search, booking interface, commission tracking       | Extract when booking volume justifies it            |
| **products**   | Product catalogue, recommendations, affiliate tracking             | Extract when product range grows                    |

4.3 Frontend Architecture

4.3.1 PWA Configuration

The Next.js application is configured as a Progressive Web App from Phase 1. This provides app-like behaviour on mobile without requiring native app development. The PWA must support: install-to-home-screen prompt, offline fallback page (showing cached data where available), background sync for fuel log submissions when back online, and push notifications (Phase 4+ for fuel price alerts and route updates).

4.3.2 Rendering Strategy

| **Page Type**               | **Rendering**                   | **Cache Strategy**                    |
| Calculator page             | Client-side (CSR)               | No cache — interactive, user-specific |
| Calculator results          | Client-side (CSR)               | No cache — dynamic calculation        |
| Vehicle SEO pages           | Static (SSG)                    | Regenerate on data change (ISR 24h)   |
| Vehicle+Caravan combo pages | Static (SSG)                    | Regenerate on data change (ISR 24h)   |
| Blog posts                  | Static (SSG)                    | Regenerate on publish (ISR 1h)        |
| Fuel station map            | Server (SSR) + client hydration | Redis cache fuel prices (15 min TTL)  |
| Route planner               | Client-side (CSR)               | Cache route segments in Redis         |
| Account dashboard           | Server (SSR)                    | No cache — authenticated              |
| Shared setup view           | Server (SSR)                    | Cache by share token (1h TTL)         |

4.3.3 Native App Path

When the platform outgrows PWA capabilities (complex offline GPS, background location tracking, native payment integration), build native apps using React Native or Capacitor. The Fastify API layer serves both the web frontend and native apps identically — no backend changes required. Target: evaluate native app need after Phase 4 based on user feedback and PWA limitation analysis.

5. Database Architecture

5.1 CockroachDB Configuration

CockroachDB runs as a 3-node cluster across VPS-1, VPS-2, and VPS-3. All nodes are equal peers — CockroachDB has no primary/replica distinction. Any node can serve reads and writes. The cluster tolerates the loss of one node while maintaining full availability.

- **Replication factor:** 3 (default). Every piece of data exists on all 3 nodes.

- **Consistency:** Serialisable isolation by default. Strong consistency for all financial and safety-critical data.

- **Spatial support:** CockroachDB supports GEOMETRY and GEOGRAPHY column types with spatial indexing. Used for fuel station coordinates, route waypoints, and proximity queries.

- **Time-series data:** Fuel price history stored in CockroachDB with a composite index on (station_id, fuel_type, recorded_at). Partition by month using CockroachDB’s hash-sharded index for write distribution. If query performance degrades beyond acceptable thresholds at scale, extract to TimescaleDB.

5.2 Schema Ownership by Module

Each module owns specific tables. Cross-module data access goes through the owning module’s API — never via direct cross-module Prisma queries. This preserves extraction boundaries.

| **Module**     | **Tables Owned**                                                                                                                                                          | **Key Relationships**                                |
| **calculator** | VehicleMake, VehicleModel, VehicleVariant, CaravanMake, CaravanModel, AccessoryCategory, AccessoryBrand, Accessory, GvmUpgradeKit, GvmUpgradeProvider, CaravanUpgradePath | VehicleVariant → UserSetup, GvmUpgradeKit            |
| **auth**       | User, Account, Session, VerificationToken, UserTrustLevel                                                                                                                 | User → UserSetup, FuelLog, Review                    |
| **setups**     | UserSetup, SetupAccessory, SetupCustomItem, SetupLoad, Sponsor                                                                                                            | UserSetup → VehicleVariant, CaravanModel             |
| **fuel**       | FuelStation, FuelPrice, FuelPriceHistory, FuelSource                                                                                                                      | FuelStation has GEOGRAPHY column for spatial queries |
| **rig**        | RigProfile, FuelLog, ConsumptionSegment                                                                                                                                   | RigProfile → VehicleVariant, User                    |
| **routing**    | Route, RouteWaypoint, RouteSegment                                                                                                                                        | References FuelStation, OvernightStop                |
| **community**  | Review, VanFriendlyRating, StopReport, UserReputation                                                                                                                     | Cross-references FuelStation, OvernightStop, User    |
| **bookings**   | OvernightStop, Booking, BookingProvider, Commission                                                                                                                       | OvernightStop has GEOGRAPHY column                   |

5.3 Redis Usage

| **Use Case**            | **Key Pattern**           | **TTL**  | **Notes**                          |
| Current fuel prices     | fuel:station:{id}:current | 15 min   | Refreshed by BullMQ polling worker |
| Vehicle specs cache     | vehicle:variant:{id}      | 24 hours | Avoids DB hit for popular vehicles |
| Session store           | session:{token}           | 7 days   | NextAuth session backing           |
| Rate limiting           | ratelimit:{ip}:{route}    | 1 min    | Sliding window rate limiter        |
| Calculator result cache | calc:{hash}               | 1 hour   | Hash of CalculatorInput as key     |
| Fuel price aggregates   | fuel:avg:{state}:{type}   | 30 min   | Pre-computed state averages        |
| BullMQ job queues       | bull:fuel-poll:\*         | N/A      | Managed by BullMQ                  |

6. API Architecture

6.1 Dual Server Model

Phase 1 uses Next.js API routes for simplicity. From Phase 2 onward, the Fastify server handles all API traffic. Next.js API routes are retained only for NextAuth authentication endpoints. All new API development from Phase 2 uses Fastify.

| **Server**  | **Responsibilities**                                                             | **Port** |
| **Next.js** | SSR/SSG pages, static assets, NextAuth routes (/api/auth/\*), PWA service worker | 3000     |
| **Fastify** | All business API routes (/api/v1/\*), WebSocket server, background job triggers  | 3001     |

6.2 API Versioning

All Fastify API routes are versioned under /api/v1/. This allows breaking changes in future versions without disrupting existing clients (PWA, potential native apps, potential third-party integrations). When a breaking change is needed, introduce /api/v2/ and deprecate the old version with a sunset header.

6.3 API Design Principles

- RESTful resource-based routing: /api/v1/vehicles, /api/v1/fuel-stations, /api/v1/routes

- JSON request/response bodies with Zod validation on all inputs

- Consistent error response format: { error: string, code: string, details?: object }

- Pagination on all list endpoints: ?page=1&limit=20 with Link headers

- Rate limiting: 100 requests/minute for anonymous, 300/minute for authenticated

- CORS configured for travellingbuddy.com.au and localhost (dev)

- All responses include Cache-Control headers appropriate to content freshness

6.4 Authentication Flow

NextAuth.js v5 handles authentication via JWT tokens. The Fastify API validates these tokens on protected routes using a shared secret. Anonymous users can access all read endpoints and the calculator. Write operations (save setup, submit fuel log, write review) require authentication.

7. Trust & Moderation System

7.1 Trust Tiers

User-generated content (fuel logs, van-friendly ratings, overnight stop reviews, vehicle submissions) follows a trust-tier model. New users start at Tier 0 and progress based on verified contributions.

| **Tier** | **Name**    | **Requirements**                                           | **Permissions**                                                       |
| **0**    | New User    | Account created                                            | Submit data — all submissions queued for review                       |
| **1**    | Contributor | 5+ verified submissions, account age \> 7 days             | Submit data — auto-approved for low-risk content (fuel logs, ratings) |
| **2**    | Trusted     | 20+ verified submissions, no flags, account age \> 30 days | All submissions auto-approved, can flag others’ content               |
| **3**    | Moderator   | Manually assigned                                          | Can approve/reject Tier 0 submissions, edit community data            |

7.2 Content Types & Review Requirements

| **Content Type**            | **Tier 0** | **Tier 1**   | **Tier 2+**  | **Risk Level**                                    |
| Fuel price log              | Queued     | Auto-approve | Auto-approve | Low — validated against API data                  |
| Van-friendly rating         | Queued     | Auto-approve | Auto-approve | Low — simple boolean + comment                    |
| Fuel consumption log        | Queued     | Auto-approve | Auto-approve | Low — outliers flagged automatically              |
| Overnight stop review       | Queued     | Queued       | Auto-approve | Medium — public-facing, reputation impact         |
| Vehicle/caravan submission  | Queued     | Queued       | Queued       | High — safety-critical data, always manual review |
| GVM upgrade data correction | Queued     | Queued       | Queued       | High — safety-critical                            |

7.3 Automated Validation

Before any submission enters the review queue or is auto-approved, automated checks run:

- Fuel price logs: reject if price deviates more than 30% from the current API-sourced price for that station

- Fuel consumption logs: flag if L/100km is outside plausible range for vehicle type (e.g., \< 5 or \> 30 for diesel utes)

- Reviews: profanity filter, minimum character count (20), duplicate detection

- Vehicle specs: cross-reference submitted GVM/GCM against known manufacturer ranges for that make/model

8. Phase Roadmap

> How to read this section
>
> This section provides an overview of each phase. Detailed specifications for each phase live in separate companion documents. The master overview defines the architecture and cross-cutting concerns; phase documents define features, schema additions, UI components, and implementation checklists.
>
> Phases are sequential — each builds on the previous. However, some Phase N features may be pulled forward if they create immediate value (e.g., basic rig profiles in Phase 1.5).

8.1 Phase 1 — GVM/GCM Calculator

**Status:** Built and functional. See Phase 1 Handover Document + Addendum for original spec. UI evolved during build from a 5-step wizard to a single-page layout (improvement made by Paperclip during development).

**Goal:** Launch a best-in-class GVM/GCM compliance calculator that becomes the top organic search result for Australian towing weight queries. Generate revenue from day one via AdSense, affiliate links, and sponsored GVM upgrade provider listings.

8.1.1 Current UI Layout (as built)

The calculator uses a two-column layout with the configuration panel on the left and live-updating results on the right. All sections on the left are on a single page — no step navigation. Results update in real-time as the user makes changes.

**Left column (configuration):**

- Vehicle selection: Make (pill/chip selector) → Model (card) → Variant (card with specs). Search input at top. ‘Vehicle not listed? Submit your vehicle’ link at bottom.

- Journey assumptions: Fuel level (Full/75%/50%/25% toggle buttons with calculated kg), Passengers (counter with +/- and configurable average weight).

- Caravan/Trailer (optional): dashed-border ‘Add a caravan or trailer’ prompt. When expanded: Make (pill selector) → Model (card with ATM/GTM/Tare/TBM specs). Van fresh water slider. Remove button to collapse.

- Gear & accessories (collapsible accordion): category tabs (Bullbar, Lighting, Canopy & Tray, Electrical, Fridge, Storage, Recovery, Water, Roof & Rack, Comms, Cooking, Tyres). Checkbox list with brand, name, and weight per item.

- Other loads: Personal gear & food slider (default 80kg), Fresh water in vehicle (litre input), Dog(s) weight input.

**Right column (live results):**

- Weight Headroom bars: horizontal progress bars for GVM, GCM (if towing), and Tow Ball. Colour-coded green/amber/red with status badges (Good, Getting tight, Over limit). Contextual warning messages inline (e.g. ‘GVM getting tight — a GVM upgrade could give you more headroom’).

- Disclaimer box: yellow banner with estimates-only warning.

- Status banner: full-width green (‘Legal — within all limits’) or red (‘Over limit — do not drive’) with vehicle/caravan name.

- Gauge section: semicircular gauges for GVM, GCM, and Tow Ball showing percentage, actual kg, limit, and remaining/over amount. Gauges appear side-by-side when caravan attached.

- Warnings and recommendations: amber/red alert cards for limit warnings, blue info cards for recommendations (weighbridge, GVM upgrade).

- Over-limit Summary: shows exact kg deficit per metric when over any limit.

- GVM Upgrade Options: provider-specific kit cards with uplift amount, new GVM, cost range, and ‘Would make you legal’ badge. Disclaimer about indicative pricing.

- Caravan Upgrade Options: ATM upgrade paths with feasibility badge, cost, warranty impact warning.

- Full weight breakdown: collapsible table showing tare, accessories, passengers, fuel, fresh water, personal gear, dog(s), tow ball load, and total.

- Share Setup and Save Setup buttons at bottom.

Key additional deliverables:

- User accounts with saved setups and share links

- SEO pages: 400+ vehicle/caravan combo pages, vehicle profiles, blog content

- PDF lead magnet report via email capture

- Admin seed data: 24 vehicles, 18 caravans, 50+ accessories, 23 GVM upgrade kits, 9 caravan upgrade paths

**Tech:** Next.js 16 API routes (Fastify not yet needed). CockroachDB. Redis for session + cache. Prisma ORM.

**Revenue:** AdSense, affiliate links on accessories and GVM kits, sponsored provider listings.

8.2 Phase 1.5 — Visual Rig Builder + Admin Panel

**Status:** Stretch goal from Phase 1. Build after Phase 1 launch.

**Goal:** Add the 2D SVG visual rig builder (deferred from Phase 1) and create an admin panel for managing vehicle data, accessory data, sponsor listings, and reviewing community submissions.

Key deliverables:

- 2D SVG rig visual that updates as user adds accessories and caravan

- Admin dashboard: vehicle/caravan/accessory CRUD with verification workflow

- Community submission review queue (vehicle and caravan specs)

- Sponsor management interface (add/edit/deactivate sponsors)

- Basic analytics dashboard (calculator usage, conversion rates, popular vehicles)

8.3 Phase 2 — Rig Profiles & Fuel Consumption Tracking

**Status:** To be specced. Depends on Phase 1 user accounts.

**Goal:** Allow users to create detailed profiles of their towing rig, including fuel consumption preferences and travel constraints. This is the foundation for Phases 3 and 4.

Key deliverables:

- Rig profile creation: vehicle + caravan + accessories + configuration

- Fuel consumption settings: average L/100km (loaded, unloaded, towing)

- Range calculator: based on tank size, consumption rate, and minimum fuel threshold

- Travel preferences: max daily distance, preferred driving hours, minimum fuel level (e.g. never below half tank)

- Fuel log submission: record fuel purchases with location, litres, and odometer

- Community consumption data: aggregate L/100km by vehicle type and road segment

- **Introduce Fastify:** migrate API routes from Next.js to Fastify. Next.js retains SSR/SSG and auth routes only.

8.4 Phase 3 — Fuel Station Locator & Price Map

**Status:** To be specced. Depends on Phase 2 rig profiles.

**Goal:** Build a comprehensive fuel station database with real-time pricing from state government APIs. Provide a map-based fuel finder and price comparison tool.

Key deliverables:

- Fuel station database with coordinates, amenities, opening hours, fuel types

- State API integrations: NSW FuelCheck, QLD fuel pricing, VIC, SA, WA, TAS, NT, ACT

- BullMQ workers polling state APIs every 15 minutes for price updates

- Price normalisation layer: different states provide data in different formats

- Map-based fuel finder: stations near me, stations along route, cheapest in area

- Price history charts: daily/weekly/monthly trends per station and region

- Price alerts: notify user when fuel at their preferred station drops below threshold

- Van-friendly station ratings: community feedback on whether large rigs can access the station

- Fuel availability indicator: does the station actually have fuel? (remote area concern)

8.5 Phase 4 — Smart Route Planning

**Status:** To be specced. Depends on Phase 2 rig profiles and Phase 3 fuel data.

**Goal:** Combine rig profiles with fuel station data to provide intelligent route planning that accounts for vehicle range, fuel prices, towing constraints, and community consumption data.

Key deliverables:

- Route planner: enter start and destination, get optimised route for towing rigs

- Fuel stop optimisation: plan stops based on tank range, price, and van-friendly ratings

- Fuel gauge visualisation: overlay showing predicted tank level at each point on route

- Community consumption insights: alert when a road segment typically increases consumption

- Speed and time constraints: respect max towing speed, daily distance limits, rest requirements

- Route comparison: show multiple route options with fuel cost and time tradeoffs

- Share routes: generate shareable route link with all stops and timing

- WebSocket-based real-time updates for live route tracking (Fastify WebSocket)

8.6 Phase 5 — Overnight Stops & Bookings

**Status:** To be specced. Depends on Phase 4 route planning.

**Goal:** Integrate overnight stop planning into route optimisation. Allow users to discover, review, and book accommodation along their route. Generate commission revenue from bookings.

Key deliverables:

- Overnight stop database: caravan parks, free camps, station stays, farm stays, rest areas

- Integration with route planner: suggest stops based on daily distance preferences

- Community reviews and ratings for overnight stops

- Booking interface: direct booking for small operators without online presence

- Commission tracking: revenue share on bookings made through TravellingBuddy

- TravellingBuddy Verified badge: paid listing tier for accommodation providers

- Amenity filtering: power, water, dump point, pet-friendly, phone reception

8.7 Phase 6+ — Products & Global Expansion

**Status:** Future planning. Not yet specced.

**Goal:** Add product sales (affiliate-first, then direct), expand to New Zealand, UK, and other markets with strong caravan/touring culture.

Key deliverables (tentative):

- Curated product recommendations contextual to user’s rig and route

- Affiliate product links integrated into calculator results and route planning

- Bulk-buying program for high-demand accessories

- Marketplace for used touring gear (community-driven)

- Multi-region deployment: NZ regulations, UK towing laws, localised fuel APIs

- Job board for finding work on the road (seasonal, remote, location-based)

9. Phase Dependency Map

Each phase builds on data and infrastructure from the previous phases. This map shows what each phase provides and what it requires.

| **Phase**     | **Provides**                                                                | **Requires**                             | **Can Start After**                |
| **Phase 1**   | User accounts, vehicle/caravan DB, calculator engine, SEO pages, ad revenue | Nothing — greenfield                     | Now                                |
| **Phase 1.5** | Admin panel, visual rig builder, data management tools                      | Phase 1 database and user system         | Phase 1 launch                     |
| **Phase 2**   | Rig profiles, fuel consumption data, travel preferences, Fastify API        | Phase 1 user accounts and vehicle DB     | Phase 1 stable                     |
| **Phase 3**   | Fuel station DB, real-time prices, price history, BullMQ workers            | Phase 2 rig profiles (for range calc)    | Phase 2 core complete              |
| **Phase 4**   | Route planning, fuel stop optimisation, WebSocket real-time                 | Phase 2 rig profiles + Phase 3 fuel data | Phase 3 core complete              |
| **Phase 5**   | Overnight stops, booking system, commission revenue                         | Phase 4 route planner                    | Phase 4 core complete              |
| **Phase 6+**  | Products, global expansion, marketplace                                     | Phases 1–5 mature and generating traffic | Phase 5 stable + market validation |

10. Cross-Cutting Concerns

10.1 Internationalisation Readiness

Although Phase 1 targets Australia exclusively, the architecture must not create barriers to international expansion. Specific requirements:

- All user-facing strings must be extractable for future i18n (use a constants file, not inline strings in components)

- Weight units: always store in kg internally. Display conversion to lbs/imperial is a UI concern only.

- Currency: always store in AUD with currency code. Display conversion is UI concern.

- Fuel units: store in litres. Display conversion to gallons is UI concern.

- Distance: store in km. Display conversion to miles is UI concern.

- Regulations: GVM/GCM rules differ by country. The calculator engine must accept a ‘regulation set’ parameter (AU rules for Phase 1, extensible).

- Fuel API adapters: each state/country’s fuel API is handled by a dedicated adapter class implementing a common interface. Adding a new data source means writing one adapter, not modifying core logic.

10.2 Legal & Compliance

- Calculator disclaimer: must appear on every results view, prominent, not dismissable. Exact wording specified in Phase 1 document.

- Sponsored content: all paid placements must be clearly labelled per ACCC (Australian Competition and Consumer Commission) guidelines. The word ‘Sponsored’ must appear adjacent to any paid listing.

- GVM upgrade information: must include inline disclaimer about indicative nature and requirement for licensed modifier assessment.

- Privacy policy: required for user accounts, email capture, and analytics. Must comply with Australian Privacy Act 1988.

- Cookie consent: if using Plausible (no cookies), no banner needed. If any cookie-setting analytics or tracking is added, implement consent banner.

- Data retention: fuel logs and community submissions are retained indefinitely (they have value as historical data). User account data follows deletion request within 30 days.

10.3 Security

- All traffic over HTTPS (enforce via Cloudflare).

- API rate limiting on all endpoints (Redis-backed sliding window).

- Input validation with Zod on every API route — no unvalidated input reaches business logic.

- SQL injection prevention via Prisma parameterised queries (never raw SQL without parameterisation).

- XSS prevention: React handles output encoding by default. Never use dangerouslySetInnerHTML with user content.

- CSRF: NextAuth handles CSRF tokens for auth routes. Fastify routes use SameSite cookie policy.

- Secrets management: all secrets in environment variables, never committed to git. Use .env.example with placeholder values.

- CockroachDB admin UI: restrict to localhost/VPN only. Never expose to public internet.

- Redis: bind to localhost or private network only. Require authentication password.

10.4 Performance Targets

| **Metric**                   | **Target** | **Measurement**                         |
| Lighthouse Performance Score | ≥ 90       | Run on calculator page and SEO pages    |
| Time to First Byte (TTFB)    | \< 200ms   | SSG pages via Cloudflare edge           |
| First Contentful Paint (FCP) | \< 1.5s    | Calculator page on 4G connection        |
| Calculator step transition   | \< 100ms   | Client-side, no API call between steps  |
| Calculation API response     | \< 50ms    | POST /api/calculate (stateless, no DB)  |
| Vehicle search API           | \< 200ms   | With Redis cache hit                    |
| Fuel price map load          | \< 2s      | Initial load with station markers       |
| Route calculation            | \< 5s      | Complex multi-day route with fuel stops |

10.5 SEO Strategy

SEO is the primary traffic acquisition channel. Every feature built must consider its SEO impact.

10.5.1 Content Hierarchy

- Tier 1 (highest value): Vehicle + Caravan combo pages (‘Can a HiLux tow a Jayco Journey?’)

- Tier 1: Vehicle GVM upgrade guide pages (‘HiLux GVM upgrade’)

- Tier 2: Vehicle profile pages (‘Toyota HiLux SR5 towing specs’)

- Tier 2: Caravan profile pages (‘Jayco Journey 21.65 specs’)

- Tier 3: Blog content (‘What is GVM?’, ‘VSB14 explained’, ‘GVM upgrade cost guide’)

- Future: Fuel station pages, route guides, overnight stop guides

10.5.2 Technical SEO Requirements

- generateMetadata on every Next.js page with unique title, description, and og:image

- JSON-LD structured data (FAQPage, WebApplication, Product schemas as appropriate)

- Canonical URLs on all pages pointing to travellingbuddy.com.au

- XML sitemap generated at build time and submitted to Google Search Console

- robots.txt allowing all calculator and content pages, blocking admin and API routes

- Internal linking strategy: every SEO page links to the calculator pre-filled with relevant vehicle/caravan

- Page speed: SSG for all content pages, lazy-load ads and non-critical scripts

11. Companion Document Index

This master overview is supported by detailed phase-specific documents. Each phase document is self-contained but references this master document for architecture decisions, shared patterns, and cross-cutting concerns.

| **Document**                                     | **Status**                                | **Contents**                                                                                                                                                              |
| **Master Architecture Overview (this document)** | Complete — v1.0                           | Vision, infrastructure, tech stack, database architecture, API design, trust system, phase roadmap, cross-cutting concerns                                                |
| **Phase 1: GVM/GCM Calculator Handover**         | Complete — v1.0 (UI evolved during build) | Full spec: project setup, Prisma schema, seed data, calculation engine, single-page calculator UI, authentication, API routes, SEO pages, monetisation, testing checklist |
| **Phase 1 Addendum: GVM & Caravan Upgrades**     | Complete — v1.0                           | GVM upgrade kit data, caravan ATM upgrades, schema additions, UI components (DeficitSummaryBanner, UpgradePathwayCard, AlternativeSolutionsCard), seed data, SEO pages    |
| **Phase 1.5: Visual Rig Builder + Admin Panel**  | Not yet written                           | SVG rig builder spec, admin dashboard, data management, submission review queue                                                                                           |
| **Phase 2: Rig Profiles & Fuel Consumption**     | Not yet written                           | Rig profile schema, fuel consumption tracking, travel preferences, Fastify migration guide                                                                                |
| **Phase 3: Fuel Station Locator & Price Map**    | Not yet written                           | Fuel station schema, state API adapters, BullMQ worker specs, map UI, price history                                                                                       |
| **Phase 4: Smart Route Planning**                | Not yet written                           | Route calculation engine, fuel stop optimisation, WebSocket spec, consumption-aware routing                                                                               |
| **Phase 5: Overnight Stops & Bookings**          | Not yet written                           | Accommodation database, booking interface, commission model, provider verification                                                                                        |

12. Getting Started

> For Paperclip / Claude Code
>
> 1. Read this master document first to understand the full architecture.
>
> 2. Read the Phase 1 Handover Document for the complete GVM calculator specification.
>
> 3. Read the Phase 1 Addendum for GVM/caravan upgrade features.
>
> 4. Work through Phase 1 stages 1–9 in order, committing after each stage.
>
> 5. After completing stage 9, work through the Addendum’s stage 10 checklist.
>
> 6. Do not start any Phase 2 work until Phase 1 is deployed and stable.
>
> 7. When starting Phase 2, re-read sections 4 (Tech Stack), 5 (Database), and 6 (API) of this master document to align with the Fastify migration.

*— End of Master Architecture Overview —*
