#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

cp data/techs.json state/techs.json
cp data/customers.json state/customers.json
cp data/schedule.json state/schedule.json
echo '[]' > state/history-customer.json
echo '[]' > state/history-ops.json
echo "State reset to clean Monday morning defaults."
