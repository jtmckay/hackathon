#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SCHEDULE="state/schedule.json"
TECHS="state/techs.json"
CUSTOMERS="state/customers.json"

DATE=$(jq -r '.date' "$SCHEDULE")

echo "=== SHAMROCK PLUMBING — OPERATIONAL SNAPSHOT ==="
echo "Date: $DATE"
echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

echo "--- TODAY'S SCHEDULE ---"
jq -r '.jobs[] | "  [\(.status | ascii_upcase)] \(.time) - \(.type) | Tech: \(.techId) | Customer: \(.customerId) | Address: \(.address) | Duration: \(.durationHrs)h | Bumpable: \(.bumpable) | Notes: \(.notes)"' "$SCHEDULE"
echo ""

echo "--- FLEX BUFFER SLOTS ---"
jq -r '.flexSlots[] | "  [\(.status | ascii_upcase)] \(.time) - \(.type) | Duration: \(.duration_hrs)h | \(.notes)"' "$SCHEDULE"

# Check for consumed buffers
CONSUMED=$(jq '[.flexSlots[] | select(.status != "available")] | length' "$SCHEDULE")
if [ "$CONSUMED" -gt 0 ]; then
  echo "  ⚠ WARNING: $CONSUMED of 2 flex buffers consumed"
fi
echo ""

echo "--- TECH ROSTER ---"
jq -r '.[] | "  \(.name) (\(.seniority), \(.years)yr) | Status: \(.status) | Location: \(.currentLocation) | Specialties: \(.specialties | join(", ")) | Certs: \(if (.certifications | length) > 0 then (.certifications | join(", ")) else "none" end) | Rating: \(.metrics.avgRating)"' "$TECHS"
echo ""

# Check for overbooked techs (more than 3 jobs in a day)
echo "--- FLAGS ---"
OVERBOOKED=$(jq -r --slurpfile techs "$TECHS" '
  [.jobs | group_by(.techId)[] | select(length > 3) | .[0].techId] |
  if length > 0 then "  ⚠ Overbooked techs: \(join(", "))" else empty end
' "$SCHEDULE")
if [ -n "$OVERBOOKED" ]; then
  echo "$OVERBOOKED"
fi

if [ "$CONSUMED" -gt 0 ]; then
  echo "  ⚠ Flex buffer(s) consumed — reduced emergency capacity"
fi

# Check for techs with no flex gap
jq -r '
  [.jobs | group_by(.techId)[] |
    {tech: .[0].techId, count: length, hours: (map(.durationHrs) | add)} |
    select(.hours >= 7)
  ] | .[] | "  ⚠ \(.tech) is fully booked (\(.hours)h scheduled) — no flex in their day"
' "$SCHEDULE" 2>/dev/null || true

# If no flags, say so
if [ "$CONSUMED" -eq 0 ]; then
  NO_OVERBOOKED=$(jq '[.jobs | group_by(.techId)[] | select(length > 3)] | length' "$SCHEDULE")
  NO_FULLDAY=$(jq '[.jobs | group_by(.techId)[] | {hours: (map(.durationHrs) | add)} | select(.hours >= 7)] | length' "$SCHEDULE")
  if [ "$NO_OVERBOOKED" -eq 0 ] && [ "$NO_FULLDAY" -eq 0 ]; then
    echo "  ✓ All clear — flex buffers available, no overbooked techs"
  fi
fi
echo ""
echo "=== END SNAPSHOT ==="
