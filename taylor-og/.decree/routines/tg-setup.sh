#!/usr/bin/env bash
# Telegram Test Client Setup
#
# Installs gramjs dependencies and runs interactive authentication.
# Saves the session for reuse by tg-send. Requires terminal access
# for phone number and auth code input.
set -euo pipefail

message_file="${message_file:-}"
message_id="${message_id:-}"
message_dir="${message_dir:-}"
chain="${chain:-}"
seq="${seq:-}"

# Pre-check: verify node/npm available
if [ "${DECREE_PRE_CHECK:-}" = "true" ]; then
    command -v node >/dev/null 2>&1 || { echo "node not found" >&2; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo "npm not found" >&2; exit 1; }
    exit 0
fi

CLIENT_DIR="$(cd "$(dirname "$0")/../../test-client" && pwd)"

# Install dependencies if needed
if [ ! -d "$CLIENT_DIR/node_modules" ]; then
    echo "Installing test-client dependencies..."
    (cd "$CLIENT_DIR" && npm install)
fi

# Check for .env — copy from example if missing
if [ ! -f "$CLIENT_DIR/.env" ]; then
    if [ -f "$CLIENT_DIR/.env.example" ]; then
        cp "$CLIENT_DIR/.env.example" "$CLIENT_DIR/.env"
        echo "Created $CLIENT_DIR/.env from .env.example"
        echo "Fill in TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_CUSTOMER_GROUP_ID"
        echo "Get API credentials from https://my.telegram.org"
        exit 1
    fi
fi

# Run interactive setup (needs terminal for phone/code input)
echo "Starting Telegram user authentication..."
(cd "$CLIENT_DIR" && npx tsx setup.ts)
