# Uptime Kuma - Local / Self-hosted Keepalive

This file shows how to run Uptime Kuma locally (or on a small droplet) and how to seed a ping monitor for your app.

## Docker Compose

1. Run Uptime Kuma with Docker Compose:

```bash
docker compose -f docker/uptime-kuma/docker-compose.yml up -d
```

2. Open Uptime Kuma on port 3001 (http://<host>:3001) and create an admin user.

## Seed a Monitor with the script

1. Set variables and run the script to create a ping monitor that pings your app every 5 minutes:

```bash
export UPTIME_KUMA_URL="http://localhost:3001"
export UPTIME_KUMA_EMAIL="admin@example.com"
export UPTIME_KUMA_PASSWORD="password"
export MONITOR_NAME="paperpaste-kuma"
export MONITOR_URL="https://yourapp.example.com"

./docker/uptime-kuma/seed-monitor.sh
```

Note: The script logs in and creates a `https` monitor. Adjust `monitor_payload` in `seed-monitor.sh` if you need different settings (HTTP ping, headers, etc.).

## GitHub Actions Keepalive (Immediate fallback)

If you don't want to self-host Uptime Kuma or need a quick solution to prevent Supabase from sleeping, use the GitHub Actions scheduler in `.github/workflows/keepalive-ping.yml`.

- Add a repository secret `KEEPALIVE_URL` with your app's root URL (e.g., `https://paperpaste.example.com`).
- The workflow runs every 5 minutes and does up to 3 retries to contact the site.

This is a free and quick solution that prevents inactivity by pinging your app, and it doesn't require an external host.

## Notes & Deployment

- Uptime Kuma is self-hosted. You need a host that is always-on for the pings to work.
- If you deploy Uptime Kuma on the same host as the app, it may not help if the platform idles on inactivity. Use an external host (e.g., low-cost VPS) or GitHub Actions as described.

## To-dos
- Add a systemd unit or container orchestration instructions for resilient deployment.
- Optionally, add a daily automated backup of Uptime Kuma's `./data` folder to your cloud storage.
