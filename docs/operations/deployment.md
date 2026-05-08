# Deployment

## Architecture

Single-host pull-based deployment to AU VPS (172.16.60.113). The VPS is behind a firewall with no inbound SSH from the internet, so it pulls changes from GitHub on a 2-minute timer rather than receiving pushes from GitHub Actions.

```
GitHub (source of truth)
    ↑ git fetch (outbound from VPS every 2 min)
VPS: systemd timer → deploy-pull.sh → git pull → build → pm2 reload
    ↑
Cloudflare → Users
```

## Environments

| Environment | Branch         | Domain                     | Deploy method       |
| ----------- | -------------- | -------------------------- | ------------------- |
| Staging     | develop / main | staging.travellingbuddy.au | Pull-based (2 min)  |

## VPS Setup (One-Time)

### 1. Create deploy user

```bash
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /home/deploy/.ssh
# Add GitHub deploy key (read-only) to deploy user
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
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

### 4. Create application and log directories

```bash
sudo mkdir -p /opt/travellingbuddy
sudo chown deploy:deploy /opt/travellingbuddy
sudo mkdir -p /var/log/travellingbuddy
sudo chown deploy:deploy /var/log/travellingbuddy
```

### 5. Clone the repo

```bash
sudo -u deploy git clone --branch develop \
  git@github.com:Forraxis/Travelling-Buddy-Paperclip-Revised.git \
  /opt/travellingbuddy
```

### 6. Install the deploy timer

```bash
sudo cp /opt/travellingbuddy/scripts/travellingbuddy-deploy.service /etc/systemd/system/
sudo cp /opt/travellingbuddy/scripts/travellingbuddy-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now travellingbuddy-deploy.timer
```

### 7. Verify

```bash
sudo systemctl list-timers travellingbuddy-deploy.timer
sudo journalctl -u travellingbuddy-deploy.service -f
```

## Deploy Process

Deployment is pull-based — the VPS checks for new commits every 2 minutes:

1. **Fetch** — `git fetch origin develop`
2. **Compare** — if local HEAD matches remote, exit (no-op)
3. **Pull** — `git reset --hard origin/develop`
4. **Install** — `npm ci --omit=dev`
5. **Build** — `npx next build`
6. **Migrate** — `npx prisma migrate deploy` (if migrations exist)
7. **Restart** — `pm2 reload` for zero-downtime restart
8. **Health check** — curl localhost:3000

Deploy logs: `/var/log/travellingbuddy/deploy.log`

## Manual Deploy

To trigger an immediate deploy without waiting for the timer:

```bash
sudo systemctl start travellingbuddy-deploy.service
```

Or run the script directly:

```bash
sudo -u deploy /opt/travellingbuddy/scripts/deploy-pull.sh
```

## Cloudflare Configuration

### DNS

Add an A record pointing the staging subdomain to the VPS public IP:

| Type | Name    | Content    | Proxy |
| ---- | ------- | ---------- | ----- |
| A    | staging | `<VPS_IP>` | Yes   |

### SSL/TLS

- Mode: **Full (strict)**
- Edge certificates: Cloudflare-managed (automatic)
- Origin certificate: generate via Cloudflare dashboard and install on VPS at `/etc/ssl/cloudflare/`
- Configure Nginx or Caddy as reverse proxy on port 443 → localhost:3000

### Cache Rules

- Cache static assets (`/_next/static/*`): cache everything, edge TTL 1 year
- Bypass cache for API routes and HTML pages

## Viewing Logs

```bash
# Deploy logs
tail -f /var/log/travellingbuddy/deploy.log

# Application logs (PM2)
pm2 logs travellingbuddy
pm2 logs travellingbuddy --lines 100

# Error log only
tail -f /var/log/travellingbuddy/error.log
```

## Manual Operations

```bash
# Restart
pm2 reload travellingbuddy

# Stop
pm2 stop travellingbuddy

# Status
pm2 status

# Roll back to a specific commit
cd /opt/travellingbuddy
git reset --hard <commit-sha>
npm ci --omit=dev && npx next build
pm2 reload ecosystem.config.cjs --env production
```

## Troubleshooting

| Symptom                         | Check                                                  |
| ------------------------------- | ------------------------------------------------------ |
| Timer not running               | `systemctl status travellingbuddy-deploy.timer`        |
| Deploy script fails             | `journalctl -u travellingbuddy-deploy.service -e`      |
| Git fetch fails                 | Check deploy key: `ssh -T git@github.com` as deploy    |
| App not responding after deploy | `pm2 logs travellingbuddy` for startup errors           |
| 502 from Cloudflare             | Confirm app on port 3000, check reverse proxy config   |
| Migration fails                 | Check `DATABASE_URL` env var in `/opt/travellingbuddy/.env` |
