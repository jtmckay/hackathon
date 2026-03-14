#!/usr/bin/env python3
"""Validate all acceptance criteria for migration 01."""
import json
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)) + "/..")

files = [
    "data/techs.json", "data/customers.json", "data/schedule.json",
    "data/jobs-catalog.json", "data/service-area.json", "data/policies.json",
    "state/techs.json", "state/customers.json", "state/schedule.json",
    "state/history-customer.json", "state/history-ops.json"
]
for f in files:
    try:
        with open(f) as fh:
            json.load(fh)
        print(f"OK: {f}")
    except Exception as e:
        print(f"FAIL: {f} - {e}")
        sys.exit(1)

with open("data/techs.json") as f:
    techs = json.load(f)
assert len(techs) == 4, f"Expected 4 techs, got {len(techs)}"
print(f"Techs count: {len(techs)} - PASS")

with open("data/customers.json") as f:
    customers = json.load(f)
assert len(customers) >= 10, f"Expected 10+ customers, got {len(customers)}"
tiers = set(c["tier"] for c in customers)
assert tiers == {1, 2, 3}, f"Missing tiers: {tiers}"
print(f"Customers count: {len(customers)} (tiers: {sorted(tiers)}) - PASS")

with open("data/schedule.json") as f:
    schedule = json.load(f)
assert len(schedule["jobs"]) == 8, f"Expected 8 jobs, got {len(schedule['jobs'])}"
assert len(schedule["flexSlots"]) == 2, f"Expected 2 flex slots"
print(f"Jobs: {len(schedule['jobs'])}, Flex slots: {len(schedule['flexSlots'])} - PASS")

with open("data/service-area.json") as f:
    sa = json.load(f)
lehi_ss = [e for e in sa if e["from"] == "Lehi" and e["to"] == "Saratoga Springs"]
assert len(lehi_ss) == 1 and isinstance(lehi_ss[0]["minutes"], int)
print(f"Lehi to Saratoga Springs: {lehi_ss[0]['minutes']} min - PASS")

nelson = [c for c in customers if c["id"] == "nelson"][0]
assert len(nelson["complaintHistory"]) >= 2
print(f"Nelson complaints: {len(nelson['complaintHistory'])} - PASS")

with open("state/techs.json") as f:
    assert json.load(f) == techs
with open("state/customers.json") as f:
    assert json.load(f) == customers
with open("state/schedule.json") as f:
    assert json.load(f) == schedule
with open("state/history-customer.json") as f:
    assert json.load(f) == []
with open("state/history-ops.json") as f:
    assert json.load(f) == []
print("State files match data/ - PASS")

print()
print("ALL ACCEPTANCE CRITERIA PASSED")
