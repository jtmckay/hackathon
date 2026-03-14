#!/usr/bin/env bash
# Telegram Test Client — Send Message
#
# Sends a message to the customer group as a real Telegram user.
# The bot cannot distinguish this from a genuine customer.
#
# Message source (in priority order):
#   1. Decree message file (message_file env var)
#   2. Command-line arguments
#
# Supports --as <Name> to impersonate a specific customer.
# The name is set as the Telegram profile first_name before sending,
# so the bot's customer matching picks it up.
#
# Examples (standalone):
#   ./tg-send.sh "My water heater is making weird noises"
#   ./tg-send.sh --as Garcia "Hi, the kitchen sink is leaking again"
set -euo pipefail

message_file="${message_file:-}"
message_id="${message_id:-}"
message_dir="${message_dir:-}"
chain="${chain:-}"
seq="${seq:-}"

# Pre-check
if [ "${DECREE_PRE_CHECK:-}" = "true" ]; then
    command -v node >/dev/null 2>&1 || { echo "node not found" >&2; exit 1; }
    exit 0
fi

CLIENT_DIR="$(cd "$(dirname "$0")/../../test-client" && pwd)"

# Ensure deps are installed
if [ ! -d "$CLIENT_DIR/node_modules" ]; then
    echo "Installing test-client dependencies..."
    (cd "$CLIENT_DIR" && npm install)
fi

# Ensure session exists
if [ ! -f "$CLIENT_DIR/.tg-session" ]; then
    echo "No session found. Run tg-setup first." >&2
    exit 1
fi

# Build arguments for send.ts
SEND_ARGS=()

# If running via decree, read message from message_file
if [ -n "$message_file" ] && [ -f "$message_file" ]; then
    # Extract optional frontmatter: "as: CustomerName"
    AS_NAME=$(grep -i '^as:' "$message_file" 2>/dev/null | head -1 | sed 's/^as:\s*//i' || true)
    if [ -n "$AS_NAME" ]; then
        SEND_ARGS+=(--as "$AS_NAME")
    fi

    # Message body: everything after frontmatter (lines starting with key:), or the whole file
    MSG=$(sed '/^[a-zA-Z_-]*:/d' "$message_file" | sed '/^$/d' | head -1)
    if [ -z "$MSG" ]; then
        # Fallback: use the whole file content as the message
        MSG=$(cat "$message_file")
    fi
    SEND_ARGS+=("$MSG")
else
    # Use command-line arguments
    SEND_ARGS+=("$@")
fi

if [ ${#SEND_ARGS[@]} -eq 0 ]; then
    echo "Usage: tg-send.sh [--as <Name>] <message>" >&2
    echo "  Or place a message in the decree inbox." >&2
    exit 1
fi

(cd "$CLIENT_DIR" && npx tsx send.ts "${SEND_ARGS[@]}")
