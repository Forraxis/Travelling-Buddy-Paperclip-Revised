# Deployment

## Architecture

Single-host pull-based deployment to AU VPS (`tb-staging-1` / 172.16.60.110). The VPS is behind a firewall with no inbound access from the internet, so it pulls changes from GitHub on a 2-minute systemd timer.

```
GitHub (source of truth)
    ↑ git fetch (outbound from VPS every 2 min)
VPS: systemd timer → deploy-pull.sh → git pull → build → pm2 reload
    ↑
Cloudflare → Users
```

## Environments

| Environment | Host          | Branch  | Deploy method      |
| ----------- | ------------- | ------- | ------------------- |
| Staging     | tb-staging-1  | develop | Pull-based (2 min)  |

## VPS Details

- **Host:** tb-staging-1 (172.16.60.110)
- **User:** `travellingbuddy`
- **App directory:** `/opt/travelling-buddy`
- **Log directory:** `/var/log/travelling-buddy`
- **Node.js:** 22.x LTS
- **Process manager:** PM2

## VPS Setup (One-Time)

### 1. Add GitHub deploy key

Generate a key on the VPS and add it to the GitHub repo as a deploy key:

```bash
ssh-keygen -t ed25519 -C "tb-staging-deploy" -f ~/.ssh/tb_deploy_ed25519 -N ""
# Add the public key to GitHub repo → Settings → Deploy keys (read-only)
```

Configure `~/.ssh/config`:

```
Host github.com
  HostName github.com
  IdentityFile ~/.ssh/tb_deploy_ed25519
  IdentitiesOnly yes
```

### 2. Clone the repo

```bash
cd /opt/travelling-buddy
git clone --branch develop git@github.com:Forraxis/Travelling-Buddy-Paperclip-Revised.git .
```

### 3. Create log directory

```bash
sudo mkdir -p /var/log/travelling-buddy
sudo chown travellingbuddy:travellingbuddy /var/log/travelling-buddy
```

### 4. Initial build

```bash
npm ci --omit=dev
npx next build
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # follow output to enable on boot
```

### 5. Install the deploy timer

```bash
sudo cp /opt/travelling-buddy/scripts/travellingbuddy-deploy.service /etc/systemd/system/
sudo cp /opt/travelling-buddy/scripts/travellingbuddy-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now travellingbuddy-deploy.timer
```

### 6. Verify

```bash
systemctl list-timers travellingbuddy-deploy.timer
journalctl -u travellingbuddy-deploy.service -f
```

## Deploy Process

Automated pull-based — the VPS checks for new commits every 2 minutes:

1. **Fetch** — `git fetch origin develop`
2. **Compare** — if local HEAD matches remote, exit (no-op)
3. **Pull** — `git reset --hard origin/develop`
4. **Install** — `npm ci --omit=dev`
5. **Build** — `npx next build`
6. **Migrate** — `npx prisma migrate deploy` (if migrations exist)
7. **Restart** — `pm2 reload` for zero-downtime restart
8. **Health check** — curl localhost:3000

Deploy logs: `/var/log/travelling-buddy/deploy.log`

## Manual Deploy

```bash
# Trigger immediately (on VPS)
sudo systemctl start travellingbuddy-deploy.service

# Or run directly
/opt/travelling-buddy/scripts/deploy-pull.sh
```

## Cloudflare Configuration

### DNS

| Type | Name    | Content    | Proxy |
| ---- | ------- | ---------- | ----- |
| A    | staging | `<VPS_IP>` | Yes   |

### SSL/TLS

- Mode: **Full (strict)**
- Origin certificate from Cloudflare dashboard → install at `/etc/ssl/cloudflare/`
- Reverse proxy (Nginx/Caddy) on port 443 → localhost:3000

### Cache Rules

- `/_next/static/*`: Cache Everything, edge TTL 1 month
- `/api/*`: Bypass

## Viewing Logs

```bash
# Deploy logs
tail -f /var/log/travelling-buddy/deploy.log

# Application logs (PM2)
pm2 logs travellingbuddy
pm2 logs travellingbuddy --lines 100

# Error log
tail -f /var/log/travelling-buddy/error.log
```

## Manual Operations

```bash
pm2 reload travellingbuddy    # restart
pm2 stop travellingbuddy      # stop
pm2 status                    # check status

# Roll back
cd /opt/travelling-buddy
git reset --hard <commit-sha>
npm ci --omit=dev && npx next build
pm2 reload ecosystem.config.cjs --env production
```

## Troubleshooting

| Symptom                         | Check                                                  |
| ------------------------------- | ------------------------------------------------------ |
| Timer not running               | `systemctl status travellingbuddy-deploy.timer`        |
| Deploy script fails             | `journalctl -u travellingbuddy-deploy.service -e`      |
| Git fetch fails                 | `ssh -T git@github.com` as travellingbuddy user        |
| App not responding after deploy | `pm2 logs travellingbuddy`                              |
| 502 from Cloudflare             | Confirm app on port 3000, check reverse proxy          |
| Migration fails                 | Check `DATABASE_URL` in `/opt/travelling-buddy/.env`   |
