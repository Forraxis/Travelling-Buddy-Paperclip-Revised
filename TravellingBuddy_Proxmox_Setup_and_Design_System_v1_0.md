**TravellingBuddy**

Proxmox Environment Setup

& Paperclip Handover Guide

Provisioning scripts, Docker Swarm configuration,

and development environment handover for AI-assisted coding

Version 1.0 · April 2025 · Confidential

Table of Contents

1. Overview

> What this document covers
>
> This guide walks through provisioning 5 VMs on your Proxmox server (dual EPYC 7713, 1TB RAM, 20TB storage) to create development, staging, and monitoring environments for TravellingBuddy.
>
> It includes: VM creation specs, base OS setup, Docker installation, Docker Swarm initialisation for staging, Docker Compose for dev, CockroachDB cluster setup, and the handover instructions for Paperclip/Claude Code to begin development.

1.1 VM Summary

| **VM Name**    | **Hostname** | **vCPU** | **RAM** | **Disk** | **IP (example)** | **Docker Mode** |
| **Staging-1**  | tb-staging-1 | 8        | 16GB    | 200GB    | 10.0.10.11       | Swarm manager   |
| **Staging-2**  | tb-staging-2 | 6        | 12GB    | 150GB    | 10.0.10.12       | Swarm worker    |
| **Staging-3**  | tb-staging-3 | 4        | 8GB     | 100GB    | 10.0.10.13       | Swarm worker    |
| **Dev**        | tb-dev       | 8        | 16GB    | 200GB    | 10.0.10.20       | Compose         |
| **Monitoring** | tb-monitor   | 4        | 8GB     | 100GB    | 10.0.10.30       | Compose         |

Total allocation: 30 vCPU, 60GB RAM, 750GB disk — approximately 12% CPU and 6% RAM of the Proxmox host.

2. VM Provisioning (Tim)

> What you do vs what Paperclip does
>
> You (Tim) provision the VMs in Proxmox, install Ubuntu 24.04, create the travelbuddy user with password auth, and apply the Proxmox firewall rules. Then you hand the SSH credentials to Paperclip.
>
> Paperclip’s first task is to SSH in, run the base setup script (Docker, Node.js, firewall), generate SSH keys, disable password auth, and then proceed with the application setup.
>
> This separation keeps you in control of initial access while letting Paperclip handle the repetitive setup work.

2.1 Create VMs in Proxmox

Create 5 VMs in Proxmox (via GUI or CLI) with the following specs. Install Ubuntu 24.04 LTS Server on each. During install, create the travelbuddy user with a strong password.

| **VM Name**    | **Hostname** | **VMID** | **vCPU** | **RAM** | **Disk** | **Static IP** |
| **Staging-1**  | tb-staging-1 | 101      | 8        | 16GB    | 200GB    | 10.0.10.11    |
| **Staging-2**  | tb-staging-2 | 102      | 6        | 12GB    | 150GB    | 10.0.10.12    |
| **Staging-3**  | tb-staging-3 | 103      | 4        | 8GB     | 100GB    | 10.0.10.13    |
| **Dev**        | tb-dev       | 110      | 8        | 16GB    | 200GB    | 10.0.10.20    |
| **Monitoring** | tb-monitor   | 120      | 4        | 8GB     | 100GB    | 10.0.10.30    |

Total allocation: 30 vCPU, 60GB RAM, 750GB disk — approximately 12% CPU and 6% RAM of your Proxmox host.

2.2 Ubuntu Installation Checklist (per VM)

During Ubuntu 24.04 Server install on each VM:

- Choose ‘Ubuntu Server (minimized)’ for smallest footprint

- Set hostname to the value from the table above (e.g. tb-staging-1)

- Create user: travelbuddy

- Set a strong password (same password across all VMs is fine for initial setup — Paperclip will disable password auth as its first task)

- Enable OpenSSH server when prompted during install

- Configure static IP via Netplan (or set static DHCP lease in your router/Proxmox)

- No additional snaps or packages needed — Paperclip will install everything

2.3 Proxmox Firewall Rules

Apply these rules in the Proxmox firewall to restrict access to your local network only. This prevents any external access to the dev/staging VMs.

- Allow SSH (port 22) from your local network only (e.g. 10.0.10.0/24 or your management VLAN)

- Allow inter-VM traffic between 10.0.10.11, 10.0.10.12, 10.0.10.13, 10.0.10.20, 10.0.10.30 on all ports

- Allow Docker Swarm ports (2377, 7946, 4789) between staging VMs only

- Block all inbound traffic from outside your local network

- Outbound: allow all (needed for apt, Docker Hub, npm, GitHub)

2.4 Verify Access Before Handover

Before handing credentials to Paperclip, verify you can SSH into each VM:

```
ssh travelbuddy@10.0.10.11 # tb-staging-1

ssh travelbuddy@10.0.10.12 # tb-staging-2

ssh travelbuddy@10.0.10.13 # tb-staging-3

ssh travelbuddy@10.0.10.20 # tb-dev

ssh travelbuddy@10.0.10.30 # tb-monitor
```


Also verify each VM can reach the others:

```
# From tb-staging-1, ping the other VMs:

ping -c 2 10.0.10.12

ping -c 2 10.0.10.13

ping -c 2 10.0.10.20

ping -c 2 10.0.10.30
```


2.5 Handover Credentials to Paperclip

Once all VMs are up and accessible, provide Paperclip with the following in its initial prompt or project context:

```
# TravellingBuddy Dev/Staging Environment Access

# SSH User: travelbuddy

# SSH Password: \<YOUR_PASSWORD>

#

# Dev VM: ssh travelbuddy@10.0.10.20

# Staging-1: ssh travelbuddy@10.0.10.11

# Staging-2: ssh travelbuddy@10.0.10.12

# Staging-3: ssh travelbuddy@10.0.10.13

# Monitoring: ssh travelbuddy@10.0.10.30

#

# First task: run the security hardening script (Section 3)

# Then: follow the setup guide in this document
```


3. Security Hardening (Paperclip First Task)

> CRITICAL: Run this FIRST on every VM before any other setup
>
> Paperclip must run the security hardening script on ALL 5 VMs as its very first task. This generates SSH keys, disables password authentication, and configures the firewall. After this step, password login will no longer work — only SSH key auth.
>
> Run on each VM in order: tb-dev first (to verify), then tb-staging-1, tb-staging-2, tb-staging-3, tb-monitor.

7.1 Security Hardening Script

Paperclip should run the following on each VM. The script must be run as the travelbuddy user with sudo access.

```
#!/bin/bash

# === TravellingBuddy Security Hardening ===

# Run as: travelbuddy user (with sudo)

# Run on: ALL 5 VMs

# Step 1: Generate SSH keypair (if not already done)

if [ ! -f ~/.ssh/id_ed25519 ]; then

ssh-keygen -t ed25519 -C "travelbuddy@$(hostname)" -f ~/.ssh/id_ed25519 -N ""

echo "SSH key generated: ~/.ssh/id_ed25519.pub"

fi

# Step 2: Add this VM’s public key to its own authorized_keys

cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

chmod 600 ~/.ssh/authorized_keys

# Step 3: Disable password authentication

sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

sudo sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config

sudo sed -i 's/^#*UsePAM.*/UsePAM no/' /etc/ssh/sshd_config

# Step 4: Disable root login

sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config

# Step 5: Restart SSH service

sudo systemctl restart sshd

echo "Security hardening complete on $(hostname)"

echo "Password auth is now DISABLED. SSH key auth only."
```


7.2 Cross-VM SSH Access

After hardening all VMs, Paperclip needs to distribute SSH keys so it can SSH between VMs (e.g. from tb-dev to tb-staging-1 for deployments). Run from tb-dev:

```
# Copy tb-dev’s public key to all other VMs

# (Do this BEFORE disabling password auth on the target VMs,

# or do it from a VM that still has password auth temporarily)

ssh-copy-id travelbuddy@10.0.10.11 # staging-1

ssh-copy-id travelbuddy@10.0.10.12 # staging-2

ssh-copy-id travelbuddy@10.0.10.13 # staging-3

ssh-copy-id travelbuddy@10.0.10.30 # monitoring
```


> Recommended order
>
> 1. SSH into tb-dev, generate key, copy it to all other VMs (while password auth is still on).
>
> 2. SSH into tb-staging-1, generate key, copy to staging-2 and staging-3 (for Swarm management).
>
> 3. Then run the hardening script on ALL VMs to disable password auth.
>
> 4. Verify key-based SSH works between all required VM pairs before proceeding.

4. Base OS Setup (Paperclip Second Task)

After security hardening, run the following setup script on ALL 5 VMs. This installs Docker, Node.js, and system utilities.

```
#!/bin/bash

# === TravellingBuddy Base OS Setup ===

# Run as: travelbuddy user (with sudo)

# Run on: ALL 5 VMs after security hardening

# Update system

sudo apt update && sudo apt upgrade -y

# Install essentials

sudo apt install -y curl git wget htop net-tools ufw apt-transport-https \\

ca-certificates gnupg lsb-release jq unzip

# Install Docker (official method)

curl -fsSL https://get.docker.com \| sudo sh

sudo usermod -aG docker travelbuddy

sudo systemctl enable docker && sudo systemctl start docker

# Install Docker Compose plugin

sudo apt install -y docker-compose-plugin

# Install Node.js 22 LTS (for local dev tooling)

curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo bash -

sudo apt install -y nodejs

# Configure UFW firewall

sudo ufw allow 22/tcp # SSH

sudo ufw allow 2377/tcp # Swarm cluster management

sudo ufw allow 7946/tcp # Swarm node communication

sudo ufw allow 7946/udp # Swarm node communication

sudo ufw allow 4789/udp # Swarm overlay network

sudo ufw allow 26257/tcp # CockroachDB SQL

sudo ufw allow 8080/tcp # CockroachDB admin UI

sudo ufw allow 3000/tcp # Next.js

sudo ufw allow 3001/tcp # Fastify API

sudo ufw allow 6379/tcp # Redis

sudo ufw allow 9090/tcp # Prometheus

sudo ufw allow 9100/tcp # Node exporter

sudo ufw allow 3100/tcp # Grafana

sudo ufw --force enable

# Create app directories

mkdir -p /home/travelbuddy/travellingbuddy

mkdir -p /data

sudo chown travelbuddy:travelbuddy /data

# Log out and back in for docker group to take effect

echo "Base setup complete on $(hostname). Log out and back in for Docker access."
```


> Important: log out and back in
>
> After running this script, Paperclip must disconnect and reconnect the SSH session for the docker group membership to take effect. Verify with: docker ps (should work without sudo).

5. Staging Environment — Docker Swarm

7.1 Initialise Swarm

**On tb-staging-1 (manager):**

```
docker swarm init --advertise-addr 10.0.10.11
```


This will output a join token. Copy it.

**On tb-staging-2 and tb-staging-3 (workers):**

```
docker swarm join --token \<TOKEN> 10.0.10.11:2377
```


**Verify on tb-staging-1:**

```
docker node ls
```


Should show 3 nodes: 1 Leader, 2 Workers.

7.2 Create Docker Overlay Network

```
docker network create --driver overlay --attachable tb-network
```


5.3 CockroachDB Cluster Setup

CockroachDB runs as a Docker service on each staging node, forming a 3-node cluster with Raft consensus.

**On tb-staging-1:** create data directory and start the first node:

```
mkdir -p /data/cockroach

docker run -d --name=crdb1 --hostname=crdb1 \\

--network=tb-network \\

-p 26257:26257 -p 8080:8080 \\

-v /data/cockroach:/cockroach/cockroach-data \\

cockroachdb/cockroach:latest start \\

--insecure \\

--advertise-addr=crdb1 \\

--join=crdb1,crdb2,crdb3
```


**On tb-staging-2:**

```
mkdir -p /data/cockroach

docker run -d --name=crdb2 --hostname=crdb2 \\

--network=tb-network \\

-p 26257:26257 -p 8081:8080 \\

-v /data/cockroach:/cockroach/cockroach-data \\

cockroachdb/cockroach:latest start \\

--insecure \\

--advertise-addr=crdb2 \\

--join=crdb1,crdb2,crdb3
```


**On tb-staging-3:**

```
mkdir -p /data/cockroach

docker run -d --name=crdb3 --hostname=crdb3 \\

--network=tb-network \\

-p 26257:26257 -p 8082:8080 \\

-v /data/cockroach:/cockroach/cockroach-data \\

cockroachdb/cockroach:latest start \\

--insecure \\

--advertise-addr=crdb3 \\

--join=crdb1,crdb2,crdb3
```


**Initialise the cluster (once, on any node):**

```
docker exec -it crdb1 cockroach init --insecure
```


**Create the database:**

```
docker exec -it crdb1 cockroach sql --insecure \\

-e "CREATE DATABASE travellingbuddy;"
```


**Verify cluster health:**

```
docker exec -it crdb1 cockroach node status --insecure
```


Should show 3 nodes, all live.

5.4 Redis Setup (Staging)

**On tb-staging-1 (primary):**

```
docker run -d --name=redis-primary --network=tb-network \\

-p 6379:6379 \\

-v /data/redis:/data \\

redis:7-alpine redis-server --appendonly yes --requirepass TB_REDIS_PASSWORD
```


**On tb-staging-2 (replica):**

```
docker run -d --name=redis-replica --network=tb-network \\

-p 6379:6379 \\

-v /data/redis:/data \\

redis:7-alpine redis-server --appendonly yes \\

--replicaof redis-primary 6379 --masterauth TB_REDIS_PASSWORD
```


5.5 Staging Docker Stack File

Create this file at /home/travelbuddy/docker-stack.yml on tb-staging-1. This is the same file used in production — only the .env file differs.

```
version: '3.8'

services:

nextjs:

image: travellingbuddy/web:${TAG:-latest}

ports:

\- '3000:3000'

environment:

\- DATABASE_URL=${DATABASE_URL}

\- NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

\- NEXTAUTH_URL=${NEXTAUTH_URL}

\- REDIS_URL=${REDIS_URL}

networks:

\- tb-network

deploy:

replicas: 2

placement:

constraints:

\- node.role != manager # or spread across nodes

update_config:

parallelism: 1

delay: 30s

order: start-first

rollback_config:

parallelism: 1

fastify:

image: travellingbuddy/api:${TAG:-latest}

ports:

\- '3001:3001'

environment:

\- DATABASE_URL=${DATABASE_URL}

\- REDIS_URL=${REDIS_URL}

networks:

\- tb-network

deploy:

replicas: 1

update_config:

parallelism: 1

delay: 10s

worker:

image: travellingbuddy/api:${TAG:-latest}

command: ['node', 'dist/workers/index.js']

environment:

\- DATABASE_URL=${DATABASE_URL}

\- REDIS_URL=${REDIS_URL}

networks:

\- tb-network

deploy:

replicas: 1

placement:

constraints:

\- node.hostname == tb-staging-3

networks:

tb-network:

external: true
```


**Deploy the stack:**

```
docker stack deploy -c docker-stack.yml travellingbuddy
```


6. Dev Environment — Docker Compose

The dev VM (tb-dev) runs everything on a single host using Docker Compose for simplicity. This is where Paperclip/Claude Code does active development.

6.1 Docker Compose File

Create at /home/travelbuddy/docker-compose.yml on tb-dev:

```
version: '3.8'

services:

cockroachdb:

image: cockroachdb/cockroach:latest

command: start-single-node --insecure --store=/cockroach/cockroach-data

ports:

\- '26257:26257'

\- '8080:8080'

volumes:

\- crdb-data:/cockroach/cockroach-data

redis:

image: redis:7-alpine

command: redis-server --appendonly yes

ports:

\- '6379:6379'

volumes:

\- redis-data:/data

volumes:

crdb-data:

redis-data:
```


**Start services:**

```
docker compose up -d
```


**Create the dev database:**

```
docker exec -it $(docker ps -qf name=cockroachdb) \\

cockroach sql --insecure -e "CREATE DATABASE travellingbuddy_dev;"
```


6.2 Application Setup (Dev)

The Next.js application runs directly on the host (not in Docker) for hot-reload during development:

```
cd /home/travelbuddy

git clone git@github.com:YOUR_ORG/travellingbuddy.git

cd travellingbuddy

npm install

cp .env.example .env.local
```


Edit .env.local with dev values:

```
DATABASE_URL="postgresql://root@localhost:26257/travellingbuddy_dev?sslmode=disable"

REDIS_URL="redis://localhost:6379"

NEXTAUTH_SECRET="dev-secret-change-in-production"

NEXTAUTH_URL="http://localhost:3000"
```


Run migrations and seed:

```
npx prisma migrate dev

npx prisma db seed
```


Start the dev server with hot-reload:

```
npm run dev
```


7. Monitoring VM Setup

7.1 Docker Compose for Monitoring

Create at /home/travelbuddy/docker-compose.yml on tb-monitor:

```
version: '3.8'

services:

prometheus:

image: prom/prometheus:latest

ports:

\- '9090:9090'

volumes:

\- ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml

\- prometheus-data:/prometheus

command: --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.retention.time=90d

grafana:

image: grafana/grafana:latest

ports:

\- '3100:3000'

volumes:

\- grafana-data:/var/lib/grafana

environment:

\- GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}

loki:

image: grafana/loki:latest

ports:

\- '3200:3100'

volumes:

\- loki-data:/loki

plausible-db:

image: postgres:16-alpine

volumes:

\- plausible-db:/var/lib/postgresql/data

environment:

\- POSTGRES_PASSWORD=${PLAUSIBLE_DB_PASSWORD}

plausible-events-db:

image: clickhouse/clickhouse-server:latest

volumes:

\- plausible-events:/var/lib/clickhouse

plausible:

image: ghcr.io/plausible/community-edition:latest

ports:

\- '8000:8000'

depends_on:

\- plausible-db

\- plausible-events-db

environment:

\- BASE_URL=http://tb-monitor:8000

\- DATABASE_URL=postgres://postgres:${PLAUSIBLE_DB_PASSWORD}@plausible-db:5432/plausible

\- CLICKHOUSE_DATABASE_URL=http://plausible-events-db:8123/plausible_events_db

\- SECRET_KEY_BASE=${PLAUSIBLE_SECRET}

volumes:

prometheus-data:

grafana-data:

loki-data:

plausible-db:

plausible-events:
```


7.2 Prometheus Configuration

Create at /home/travelbuddy/prometheus/prometheus.yml:

```
global:

scrape_interval: 15s

scrape_configs:

\- job_name: 'cockroachdb-staging'

static_configs:

\- targets: ['10.0.10.11:8080', '10.0.10.12:8081', '10.0.10.13:8082']

\- job_name: 'node-exporter-staging'

static_configs:

\- targets: ['10.0.10.11:9100', '10.0.10.12:9100', '10.0.10.13:9100']

\- job_name: 'redis-staging'

static_configs:

\- targets: ['10.0.10.11:9121']
```


> Note on Prometheus targets
>
> After production VPS nodes are provisioned, add their IPs as additional scrape targets here. The monitoring VM serves both staging and production observability.

8. Paperclip / Claude Code Handover

> How to use this section
>
> This section is the entry point for Paperclip or Claude Code. It provides the SSH connection details, project structure, available services, and the rules of engagement for development work.
>
> The AI coding agent should read this section first, then refer to the Master Architecture Overview for architectural decisions and the Phase 1 Handover Document for calculator-specific implementation details.

8.1 Initial Connection Details

Tim will provide the SSH password separately. On first connection, your first task is to run the security hardening script (Section 3), then the base OS setup (Section 4). After hardening, only SSH key auth will work.

| **Detail**                     | **Value**                                 |
| **SSH user**                   | travelbuddy                               |
| **SSH auth (initial)**         | Password (provided by Tim)                |
| **SSH auth (after hardening)** | SSH key only (password disabled)          |
| **Dev VM**                     | ssh travelbuddy@10.0.10.20 (tb-dev)       |
| **Staging-1 (Swarm manager)**  | ssh travelbuddy@10.0.10.11 (tb-staging-1) |
| **Staging-2 (Swarm worker)**   | ssh travelbuddy@10.0.10.12 (tb-staging-2) |
| **Staging-3 (Swarm worker)**   | ssh travelbuddy@10.0.10.13 (tb-staging-3) |
| **Monitoring**                 | ssh travelbuddy@10.0.10.30 (tb-monitor)   |

8.2 Task Order for Paperclip

Paperclip must complete these tasks in order on first connection:

- 1. SSH into tb-dev using password auth

- 2. Generate SSH keypair on tb-dev (Section 3.1)

- 3. Copy tb-dev’s public key to all other VMs using ssh-copy-id (Section 3.2)

- 4. SSH into each VM (staging-1, staging-2, staging-3, monitoring) and generate their SSH keys

- 5. Copy staging-1’s key to staging-2 and staging-3 (for Swarm management)

- 6. Run the security hardening script on ALL 5 VMs to disable password auth (Section 3.1)

- 7. Verify key-based SSH works between all required VM pairs

- 8. Run the base OS setup script on ALL 5 VMs (Section 4)

- 9. Set up Docker Swarm on staging VMs (Section 5)

- 10. Set up Docker Compose on dev VM (Section 6)

- 11. Set up monitoring VM (Section 7)

- 12. Clone the git repo and set up the application on tb-dev

8.3 Post-Setup Connection Details

After completing the setup tasks above, these are the service endpoints available on the Dev VM:

| **Detail**               | **Value**                                             |
| **Dev VM hostname**      | tb-dev                                                |
| **Dev VM IP**            | 10.0.10.20 (adjust to your network)                   |
| **SSH user**             | travelbuddy                                           |
| **SSH command**          | ssh travelbuddy@10.0.10.20                            |
| **Project directory**    | /home/travelbuddy/travellingbuddy                     |
| **Git remote**           | origin → github.com/YOUR_ORG/travellingbuddy.git      |
| **Dev server URL**       | http://10.0.10.20:3000                                |
| **CockroachDB SQL**      | postgresql://root@localhost:26257/travellingbuddy_dev |
| **CockroachDB admin UI** | http://10.0.10.20:8080                                |
| **Redis**                | redis://localhost:6379                                |

8.4 Available Commands

| **Command**                  | **Purpose**                                            |
| **npm run dev**              | Start Next.js dev server with hot-reload on port 3000  |
| **npx prisma studio**        | Open Prisma database browser on port 5555              |
| **npx prisma migrate dev**   | Run pending database migrations                        |
| **npx prisma db seed**       | Seed database with vehicle/caravan/accessory data      |
| **npx prisma migrate reset** | Reset database to clean state and re-seed              |
| **npm test**                 | Run unit tests (Vitest)                                |
| **npm run build**            | Production build (use to verify before staging deploy) |
| **docker compose up -d**     | Start CockroachDB and Redis (if stopped)               |
| **docker compose down**      | Stop CockroachDB and Redis                             |
| **docker compose down -v**   | Stop and DELETE all data (clean reset)                 |

8.5 Development Rules

> Critical rules for Paperclip / Claude Code
>
> 1. NEVER modify the calculation engine (src/lib/calculator.ts) without explicit approval. This is safety-critical code.
>
> 2. NEVER push directly to main branch. All work on feature branches, merge via pull request.
>
> 3. ALWAYS run npm test before committing. All tests must pass.
>
> 4. ALWAYS run npm run build before pushing. Build must succeed.
>
> 5. NEVER hardcode Australian-specific logic in core modules. Use configuration/adapters for locale-specific behaviour.
>
> 6. NEVER store secrets in code. All secrets go in .env.local (dev) or environment variables (staging/production).
>
> 7. ALL database schema changes go through Prisma migrations. Never modify the database directly.
>
> 8. ALL sponsored content must be labelled 'Sponsored' in the UI. ACCC legal requirement.
>
> 9. The disclaimer banner must appear on every calculator results view. Never remove or hide it.

8.6 Git Workflow

- main branch: production-ready code. Protected. Merge via PR only.

- develop branch: integration branch. PRs from feature branches merge here first.

- Feature branches: feature/phase2-rig-profiles, fix/gvm-calculation-edge-case, etc.

- Commit format: conventional commits — feat: / fix: / chore: / docs:

- Before merging to develop: all tests pass, build succeeds, code reviewed.

- Before merging develop to main: full staging deployment test, manual smoke test.

8.7 Staging Deployment (from Dev)

After completing and testing a feature on the Dev VM, deploy to staging to verify in the production-mirror environment:

```
# On tb-dev: build Docker images

docker build -t travellingbuddy/web:latest -f Dockerfile.web .

docker build -t travellingbuddy/api:latest -f Dockerfile.api .

# Push to registry (or save/load for local Proxmox network)

docker save travellingbuddy/web:latest \| ssh travelbuddy@10.0.10.11 docker load

docker save travellingbuddy/api:latest \| ssh travelbuddy@10.0.10.11 docker load

# On tb-staging-1: deploy updated stack

ssh travelbuddy@10.0.10.11

docker stack deploy -c docker-stack.yml travellingbuddy
```


For production deployment: same process but targeting the VPS nodes, with production .env values. This should go through the GitHub Actions CI/CD pipeline once configured.

8.8 Document Reading Order

Paperclip/Claude Code should read project documents in this order:

- 1. This document (Proxmox Setup & Handover) — understand the environment

- 2. Master Architecture Overview — understand the full system architecture

- 3. Phase 1 Handover Document — understand the existing calculator implementation

- 4. Phase 1 Addendum (GVM Upgrades) — understand upgrade pathway features

- 5. The current phase spec being worked on (Phase 2, Phase 3, etc.)

9. Design System Specification

> Purpose
>
> This section defines the visual design system for TravellingBuddy. All existing and future UI components must conform to this system. When Paperclip reskins the calculator or builds new features, it uses these tokens, patterns, and component specifications.
>
> The design system ensures visual consistency across the calculator, fuel map, route planner, and all future features.

9.1 Design Tokens

9.1.1 Colour Palette

| **Token**                | **Hex**  | **Usage**                                                     |
| **--tb-primary**         | \#1B3A5C | Primary brand colour. Navbar, headings, primary buttons.      |
| **--tb-primary-light**   | \#2E75B6 | Secondary brand. Links, secondary headings, hover states.     |
| **--tb-primary-lighter** | \#E8F0FE | Light backgrounds. Info boxes, selected states.               |
| **--tb-success**         | \#16A34A | Legal/OK status. Green gauges, success banners, confirmation. |
| **--tb-success-light**   | \#DCFCE7 | Success backgrounds. Legal status banner.                     |
| **--tb-warning**         | \#D97706 | Warning/tight status. Amber gauges, approaching-limit alerts. |
| **--tb-warning-light**   | \#FEF3C7 | Warning backgrounds. Disclaimer boxes.                        |
| **--tb-danger**          | \#DC2626 | Over limit/illegal. Red gauges, critical alerts.              |
| **--tb-danger-light**    | \#FEE2E2 | Danger backgrounds. Over-limit banners.                       |
| **--tb-neutral-50**      | \#FAFAFA | Page background.                                              |
| **--tb-neutral-100**     | \#F5F5F5 | Card backgrounds, alt-row shading.                            |
| **--tb-neutral-200**     | \#E5E5E5 | Borders, dividers.                                            |
| **--tb-neutral-500**     | \#737373 | Secondary text, placeholders.                                 |
| **--tb-neutral-700**     | \#404040 | Body text.                                                    |
| **--tb-neutral-900**     | \#171717 | Headings, primary text.                                       |

9.1.2 Typography

| **Element**              | **Font**       | **Size**        | **Weight**     | **Colour**       |
| **Page title (H1)**      | Inter          | 28px / 1.75rem  | 700 (bold)     | --tb-neutral-900 |
| **Section heading (H2)** | Inter          | 22px / 1.375rem | 600 (semibold) | --tb-neutral-900 |
| **Subsection (H3)**      | Inter          | 18px / 1.125rem | 600            | --tb-neutral-700 |
| **Body text**            | Inter          | 16px / 1rem     | 400 (regular)  | --tb-neutral-700 |
| **Small / helper text**  | Inter          | 14px / 0.875rem | 400            | --tb-neutral-500 |
| **Label / badge**        | Inter          | 12px / 0.75rem  | 500 (medium)   | Contextual       |
| **Monospace (data)**     | JetBrains Mono | 14px / 0.875rem | 400            | --tb-neutral-700 |

Font stack: Inter is the primary typeface. Load via Google Fonts or self-host. Fallback: system-ui, -apple-system, sans-serif.

9.1.3 Spacing Scale

Use a 4px base unit. All spacing is a multiple of 4px:

| **Token**  | **Value** | **Usage**                                                 |
| --space-1  | 4px       | Tight inline spacing, icon gaps                           |
| --space-2  | 8px       | Compact padding, small gaps between related items         |
| --space-3  | 12px      | Default padding inside compact components (badges, pills) |
| --space-4  | 16px      | Standard padding inside cards, between form elements      |
| --space-6  | 24px      | Section padding, gap between card groups                  |
| --space-8  | 32px      | Major section separation                                  |
| --space-12 | 48px      | Page-level vertical rhythm between major sections         |

9.1.4 Border Radius

| **Token**     | **Value** | **Usage**                                  |
| --radius-sm   | 4px       | Badges, small elements                     |
| --radius-md   | 8px       | Buttons, inputs, pills                     |
| --radius-lg   | 12px      | Cards, modals, panels                      |
| --radius-xl   | 16px      | Feature cards, hero sections               |
| --radius-full | 9999px    | Pill selectors, avatars, circular elements |

9.2 Component Patterns

9.2.1 Status System (critical for calculator)

The three-tier status system is used throughout TravellingBuddy and must be visually consistent everywhere:

| **Status**            | **Colour**   | **Background**     | **Border**   | **Usage**                                  |
| **OK / Legal / Good** | --tb-success | --tb-success-light | --tb-success | Within limits, legal, safe                 |
| **Warning / Tight**   | --tb-warning | --tb-warning-light | --tb-warning | Approaching limit (\>85%), needs attention |
| **Over / Critical**   | --tb-danger  | --tb-danger-light  | --tb-danger  | Over limit, illegal, do not drive          |

This pattern applies to: gauges, headroom bars, status banners, badge labels, and any future feature that has a compliance/threshold component (fuel level, route feasibility, etc).

9.2.2 Card Pattern

- Background: white (#FFFFFF) or --tb-neutral-100 for grouped cards

- Border: 1px solid --tb-neutral-200

- Border radius: --radius-lg (12px)

- Padding: --space-6 (24px)

- Shadow: 0 1px 3px rgba(0,0,0,0.08) for elevated cards (results panel)

- Hover: shadow increases to 0 2px 8px rgba(0,0,0,0.12) for interactive cards (vehicle selection)

9.2.3 Pill / Chip Selector Pattern (as used in vehicle Make selection)

- Default: white background, 1px --tb-neutral-200 border, --radius-full

- Selected: --tb-primary background, white text

- Hover (unselected): --tb-neutral-100 background

- Font: 14px/500 weight

- Padding: 8px 16px

9.2.4 Button Patterns

| **Variant**   | **Background** | **Text**         | **Border**       | **Usage**                         |
| **Primary**   | --tb-primary   | White            | None             | Main CTA (Save Setup, Calculate)  |
| **Secondary** | White          | --tb-primary     | 1px --tb-primary | Secondary actions (Share Setup)   |
| **Danger**    | --tb-danger    | White            | None             | Destructive (Delete Setup)        |
| **Ghost**     | Transparent    | --tb-neutral-700 | None             | Tertiary actions (Change, Remove) |

All buttons: --radius-md (8px), padding 10px 20px, font 14px/500 weight, subtle hover darkening (5% darker background).

9.2.5 Form Input Patterns

- Border: 1px solid --tb-neutral-200, --radius-md

- Focus: 2px --tb-primary-light ring (box-shadow, not border change to avoid layout shift)

- Padding: 10px 14px

- Font: 16px (prevents iOS zoom on focus)

- Label: 14px/500 weight, --tb-neutral-700, positioned above input with 4px gap

- Helper text: 14px/400, --tb-neutral-500, below input with 4px gap

- Error state: 1px --tb-danger border, helper text in --tb-danger

9.2.6 Collapsible / Accordion Pattern (as used for gear & accessories)

- Header: clickable, full-width, with chevron icon (right-aligned) that rotates on open

- Closed: shows summary text (e.g. ‘Rooftop tent, bull bar, passengers gear...’)

- Open: content slides down with 200ms ease transition

- Border: dashed 1px --tb-neutral-200 when collapsed (as in caravan add prompt), solid when expanded

9.3 Layout Patterns

9.3.1 Two-Column Calculator Layout

The calculator uses a two-column layout on desktop that collapses to single-column on mobile:

- Desktop (\>= 1024px): left column 60% (configuration), right column 40% (results). Gap: --space-6.

- Tablet (768-1023px): left column 55%, right column 45%.

- Mobile (\< 768px): single column. Results section moves below configuration. Results section becomes sticky at bottom of viewport with a summary bar.

The right column (results) is position: sticky on desktop, so it scrolls with the user as they configure their rig. This ensures the impact of every change is immediately visible.

9.3.2 Page Layout

- Max content width: 1280px, centered

- Page padding: --space-6 on desktop, --space-4 on mobile

- Navbar: fixed top, height 64px, white background, bottom border 1px --tb-neutral-200

- Footer: padding-top --space-12, light background (--tb-neutral-50), bottom border top 1px --tb-neutral-200

9.4 Tailwind Configuration

Implement these design tokens in tailwind.config.ts to ensure Tailwind classes map to the design system:

```
// tailwind.config.ts

export default {

theme: {

extend: {

colors: {

tb: {

primary: { DEFAULT: '#1B3A5C', light: '#2E75B6', lighter: '#E8F0FE' },

success: { DEFAULT: '#16A34A', light: '#DCFCE7' },

warning: { DEFAULT: '#D97706', light: '#FEF3C7' },

danger: { DEFAULT: '#DC2626', light: '#FEE2E2' },

},

},

fontFamily: {

sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],

mono: ['JetBrains Mono', 'monospace'],

},

borderRadius: {

sm: '4px', md: '8px', lg: '12px', xl: '16px',

},

},

},

}
```


9.5 Design System Application to Existing Calculator

> Implementation approach
>
> The calculator is already built and functional. Applying the design system is a RESKIN, not a rewrite. The calculation engine, API routes, data layer, and component structure remain unchanged. Only the visual presentation layer (Tailwind classes, colours, fonts, spacing) is updated.
>
> Paperclip should work through the calculator components systematically, updating each to use the design tokens defined above. Start with the Tailwind config, then update components in this order: Navbar/Footer → Vehicle selector → Journey assumptions → Caravan section → Accessories accordion → Results panel (gauges, bars, banners) → Upgrade cards → Weight breakdown.

The screenshots of the current calculator (provided as reference) show the UI is already close to the design system. Key adjustments to align:

- Ensure all colours map to the --tb-\* token palette (no raw hex values in components)

- Verify font is Inter throughout (currently appears to be system font in some areas)

- Ensure spacing uses the 4px-based scale consistently

- Add subtle card shadows to the results panel for visual hierarchy

- Ensure mobile breakpoint behaviour matches the responsive spec in 7.3.1

*— End of Proxmox Setup & Design System Specification —*
