# Deployment

## Architecture

Single-host deployment to AU VPS. The application runs as a Next.js production server managed by PM2, behind Cloudflare for DNS, SSL/TLS termination, and caching.

```
GitHub Actions → SSH/rsync → VPS (PM2 + Next.js) ← Cloudflare ← Users
```

## Environments

| Environment | Branch          | Domain                    | Auto-deploy |
| ----------- | --------------- | ------------------------- | ----------- |
| Staging     | develop / main  | staging.travellingbuddy.au | Yes         |

## GitHub Secrets Required

Configure these in **Settings → Environments → staging → Environment secrets**:

| Secret             | Description                                      |
| ------------------ | ------------------------------------------------ |
| `STAGING_SSH_KEY`  | Private SSH key for VPS access (Ed25519 preferred)|
| `STAGING_HOST`     | VPS IP address or hostname                       |
| `STAGING_USER`     | SSH user on VPS (e.g. `deploy`)                  |

## VPS Setup (One-Time)

### 1. Create deploy user

```bash
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/  # or add the deploy public key
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2. Install Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Install PM2

```bash
sudo npm install -g pm2
pm2 startup  # follow the output to enable PM2 on boot
```

### 4. Create application directory and log directory

```bash
sudo mkdir -p /opt/travellingbuddy
sudo chown deploy:deploy /opt/travellingbuddy
sudo mkdir -p /var/log/travellingbuddy
sudo chown deploy:deploy /var/log/travellingbuddy
```

### 5. Grant deploy user sudo for service management

```bash
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/mkdir" | sudo tee /etc/sudoers.d/deploy
```

## Cloudflare Configuration

### DNS

Add an A record pointing the staging subdomain to the VPS IP:

| Type | Name    | Content       | Proxy |
| ---- | ------- | ------------- | ----- |
| A    | staging | `<VPS_IP>`    | Yes   |

### SSL/TLS

- Mode: **Full (strict)**
- Edge certificates: Cloudflare-managed (automatic)
- Origin certificate: generate via Cloudflare dashboard and install on VPS at `/etc/ssl/cloudflare/`
- Configure Nginx or Caddy as reverse proxy on port 443 → localhost:3000

### Cache Rules

- Cache static assets (`/_next/static/*`): cache everything, edge TTL 1 year
- Bypass cache for API routes and HTML pages

### Recommended Page Rules

| URL Pattern                              | Setting              |
| ---------------------------------------- | -------------------- |
| `staging.travellingbuddy.au/_next/static/*` | Cache Level: Cache Everything, Edge TTL: 1 month |
| `staging.travellingbuddy.au/api/*`       | Cache Level: Bypass   |

## Deploy Process

Deployment is fully automated via GitHub Actions (`.github/workflows/deploy-staging.yml`):

1. **Build** — `npm ci && npm run build` on GitHub-hosted runner
2. **Package** — tar the `.next` build output, configs, and prisma directory
3. **Transfer** — rsync the package to VPS via SSH
4. **Install** — `npm ci --omit=dev` on VPS (production dependencies only)
5. **Migrate** — `npx prisma migrate deploy` (if migrations exist)
6. **Restart** — `pm2 reload` for zero-downtime restart
7. **Health check** — curl localhost:3000 to verify the app is responding

## Viewing Logs

```bash
# Live logs
ssh deploy@<VPS_HOST> "pm2 logs travellingbuddy"

# Last 100 lines
ssh deploy@<VPS_HOST> "pm2 logs travellingbuddy --lines 100"

# Error log only
ssh deploy@<VPS_HOST> "tail -f /var/log/travellingbuddy/error.log"
```

## Manual Operations

### Restart the application

```bash
ssh deploy@<VPS_HOST> "pm2 reload travellingbuddy"
```

### Stop the application

```bash
ssh deploy@<VPS_HOST> "pm2 stop travellingbuddy"
```

### Check process status

```bash
ssh deploy@<VPS_HOST> "pm2 status"
```

### Roll back

Re-run the previous successful deploy workflow from the GitHub Actions UI, or:

```bash
# On VPS — restore from previous artifact if saved
pm2 reload ecosystem.config.cjs --env production
```

## Troubleshooting

| Symptom                        | Check                                           |
| ------------------------------ | ------------------------------------------------ |
| Deploy fails at SSH step       | Verify `STAGING_SSH_KEY` secret and VPS firewall |
| App not responding after deploy| `pm2 logs travellingbuddy` for startup errors    |
| 502 from Cloudflare            | Confirm app is running on port 3000, check Nginx |
| Migration fails                | Check DATABASE_URL env var on VPS                |
