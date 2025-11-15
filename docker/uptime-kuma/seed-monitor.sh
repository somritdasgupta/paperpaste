#!/usr/bin/env bash
# Seed a Ping monitor into a running Uptime Kuma instance.
# Usage:
#  UPTIME_KUMA_URL=http://localhost:3001 UPTIME_KUMA_EMAIL=admin@example.com UPTIME_KUMA_PASSWORD=secret MONITOR_NAME=paperpaste_ping MONITOR_URL=https://paperpaste.example.com ./seed-monitor.sh

set -euo pipefail

: "${UPTIME_KUMA_URL?Need UPTIME_KUMA_URL}"
: "${UPTIME_KUMA_EMAIL?Need UPTIME_KUMA_EMAIL}"
: "${UPTIME_KUMA_PASSWORD?Need UPTIME_KUMA_PASSWORD}"
: "${MONITOR_NAME?Need MONITOR_NAME}"
: "${MONITOR_URL?Need MONITOR_URL}"

# Login to Uptime Kuma to get token
login_response=$(curl -s -X POST "$UPTIME_KUMA_URL/api/login" -H 'Content-Type: application/json' -d "{\"email\": \"$UPTIME_KUMA_EMAIL\", \"password\": \"$UPTIME_KUMA_PASSWORD\"}")

# The response returns 'token' field on success
token=$(echo "$login_response" | grep -oP '(?<=\"token\":\")[^\"]+' || true)

if [ -z "$token" ]; then
  echo "Login failed or token not found. Response: $login_response"; exit 1
fi

echo "Logged in, got token. Seeding monitor..."

monitor_payload=$(cat <<JSON
{
  "name": "$MONITOR_NAME",
  "type": "https",
  "url": "$MONITOR_URL",
  "interval": 5,
  "maxRedirects": 10,
  "tags": ["keepalive"],
  "ignoreTls": false,
  "retry": 1
}
JSON
)

create_response=$(curl -s -X POST "$UPTIME_KUMA_URL/api/monitor" -H "Content-Type: application/json" -H "Authorization: Bearer $token" -d "$monitor_payload")

echo "Create monitor response: $create_response" || true

echo "Done. You can view Uptime Kuma at: $UPTIME_KUMA_URL" 
