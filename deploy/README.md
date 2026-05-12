# Self-hosted deploy — Ubuntu + Apache + pm2 + Gemini

One-time server setup, then `./deploy/deploy.sh` from your workstation for each release.

## Domain choice: subdomain vs subpath

The configs in this directory assume **`initech.mrballistic.com`** (subdomain). It's the recommended path:

- The Vue build needs no rebasing — assets stay at `/assets/...`, API stays at `/api/...`.
- One vhost, one cert, one `ServerName`.
- Vue router doesn't need a basepath, the frontend's `fetch('/api/...')` works unchanged.
- DNS cost: one A record pointing `initech.mrballistic.com` at the server.

If you'd rather serve it at **`mrballistic.com/initech`** (subpath), you'd need to:

1. Build the SPA with `base: '/initech/'` in `vite.config.ts`.
2. Update Vue router with `createWebHistory('/initech/')`.
3. Change the frontend's fetch calls from `/api/...` to `/initech/api/...` (or rewrite at the proxy layer).
4. In the Apache vhost, swap `DocumentRoot /var/www/initech` for an `Alias /initech /var/www/initech` and adjust `ProxyPass` to `/initech/api/`.
5. Set `FallbackResource /initech/index.html` instead of `/index.html`.

The subpath is a noticeable amount of extra plumbing for a personal site. Subdomain is the easy answer.

## One-time server setup

```bash
# 1. System packages
sudo apt update
sudo apt install -y apache2 certbot python3-certbot-apache curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 2. Service user + directories
sudo useradd -r -m -s /bin/bash initech
sudo mkdir -p /var/www/initech /opt/initech-backend /var/log/pm2
sudo chown www-data:www-data /var/www/initech
sudo chown -R initech:initech /opt/initech-backend /var/log/pm2

# 3. Environment file (NEVER commit this)
sudo install -o root -g initech -m 0640 /dev/null /etc/initech.env
sudo tee /etc/initech.env >/dev/null <<'EOF'
APP_PASSWORD=your-chosen-password
JWT_SECRET=replace-with-openssl-rand-hex-32-output
GEMINI_KEY=your-gemini-api-key-from-aistudio.google.com
PORT=3001
NODE_ENV=production
EOF
sudo chmod 0640 /etc/initech.env

# 4. Apache vhost + TLS
sudo cp deploy/apache-initech.conf /etc/apache2/sites-available/initech.conf
sudo a2enmod proxy proxy_http ssl headers rewrite
sudo a2ensite initech
sudo certbot --apache -d initech.mrballistic.com   # rewrites the 443 block
sudo systemctl reload apache2

# 5. pm2 systemd boot integration
sudo cp deploy/pm2-initech.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pm2-initech.service
```

## Get your Gemini API key

1. https://aistudio.google.com/apikey → Create API key
2. Free tier: 15 RPM, 1M tokens/day on `gemini-2.0-flash` — plenty for single-player
3. Paste into `/etc/initech.env` as `GOOGLE_API_KEY=...`

## Every release

Two flows depending on where you'd rather build.

**From your workstation** (no source clone on the box):
```bash
DEPLOY_HOST=user@your.server ./deploy/deploy.sh
```

**On the box** (after `git pull` in your local checkout):
```bash
cd ~/src/initech-terminal
git pull
./deploy/deploy-local.sh
```

Both scripts do the same five steps:
1. Build the SPA (`npm run build`) and the server (`tsc`)
2. Publish the SPA to `/var/www/initech/` and the server bundle to `/opt/initech-backend/`
3. `npm ci --omit=dev` (so native bindings match the host)
4. `pm2 reload` for zero-downtime swap (or `pm2 start` on first deploy)
5. Hit `/health` to confirm

`deploy-local.sh` uses `sudo` internally (writes `/var/www/initech`, drops to the `initech` user for pm2), so it'll prompt for your password once.

## Operations

```bash
pm2 status                              # cluster view
pm2 logs initech-backend                # follow logs
pm2 logs initech-backend --err          # errors only
pm2 monit                               # interactive dashboard
sudo journalctl -u pm2-initech -f       # systemd-level logs
sudo systemctl restart apache2          # if you tweak the vhost
sudo certbot renew --dry-run            # check cert renewal
```

## Rotating secrets

- **Password change:** `sudo nano /etc/initech.env`, then `pm2 reload initech-backend --update-env`.
- **JWT secret rotation:** same edit. All outstanding tokens become invalid; players will be bounced back to the password gate on their next LLM call.
- **Gemini key rotation:** revoke at https://aistudio.google.com/apikey, paste new `GEMINI_KEY` value, `pm2 reload initech-backend --update-env`.

## Switching to Nginx later

`deploy/nginx-initech.conf` is a drop-in replacement. Disable the Apache site first:

```bash
sudo a2dissite initech && sudo systemctl reload apache2
sudo apt install -y nginx
sudo cp deploy/nginx-initech.conf /etc/nginx/sites-available/initech
sudo ln -s /etc/nginx/sites-available/initech /etc/nginx/sites-enabled/
sudo certbot --nginx -d initech.mrballistic.com
```

## Failover behavior (pm2 cluster mode)

- 2 worker processes, both bound to port 3001 via pm2's master-process load balancer.
- If a worker crashes, pm2 spawns a replacement; the other worker keeps serving traffic. No dropped requests on a single-worker crash.
- Crash-loop protection: 10 restarts × `min_uptime: 10s`. After that pm2 stops trying so you'll see it in `pm2 status`.
- Memory ceiling: 300 MB per worker (auto-restart on excess).
- SIGTERM/SIGINT: each worker drains in-flight requests for up to 10s before exiting — `pm2 reload` is therefore zero-downtime.

## Why not run the SPA out of the same Node process?

Apache is the right tool for static files: byte-range support, sendfile, OS page cache, mod_deflate. Putting Vite assets behind Express works but adds latency and CPU you don't need. Keep the Node process focused on the two API routes.
