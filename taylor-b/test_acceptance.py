#!/usr/bin/env python3
"""Acceptance criteria tests for migration 01: Project Scaffolding and Sample Data."""

import json
import sys
import os
import subprocess

os.chdir(os.path.dirname(os.path.abspath(__file__)))

results = []
all_pass = True


def test(name, passed, detail=""):
    global all_pass
    status = "PASS" if passed else "FAIL"
    if not passed:
        all_pass = False
    results.append(f"  [{status}] {name}" + (f" -- {detail}" if detail else ""))


# AC1: techs.json has 4 techs
with open("data/techs.json") as f:
    techs = json.load(f)
test("AC1: techs.json has 4 techs", len(techs) == 4, f"got {len(techs)}")
tech_ids = [t["id"] for t in techs]
test(
    "AC1: techs are marcus, tyler, jake, danny",
    set(tech_ids) == {"marcus", "tyler", "jake", "danny"},
    f"got {tech_ids}",
)

# AC2: customers.json has >= 10 customers spanning tiers
with open("data/customers.json") as f:
    customers = json.load(f)
test(
    "AC2: customers.json has >= 10 customers",
    len(customers) >= 10,
    f"got {len(customers)}",
)
tiers = set(c.get("tier") for c in customers)
test(
    "AC2: customers span tiers 1, 2, and 3",
    {1, 2, 3}.issubset(tiers),
    f"tiers found: {tiers}",
)

# Check required customer fields
required_fields = [
    "id", "name", "address", "phone", "customerSince", "tier",
    "lifetimeValue", "jobCount", "referralCount", "notes",
    "complaintHistory", "lastJobDate", "lastJobType",
    "communicationPreference", "paymentHistory",
]
missing_fields = {}
for c in customers:
    missing = [f for f in required_fields if f not in c]
    if missing:
        missing_fields[c.get("id", "unknown")] = missing
test(
    "AC2: all customers have required fields",
    len(missing_fields) == 0,
    f"missing: {missing_fields}" if missing_fields else "",
)

# Check customer names from spec
customer_names = [c.get("name", "").lower() for c in customers]
for expected in ["garcia", "chen", "patterson", "ramirez", "thorpe", "park", "johnson", "webber"]:
    test(
        f"AC2: customer {expected} exists",
        any(expected in n for n in customer_names),
    )

# AC3: schedule.json has 8 jobs and 2 flex slots
with open("data/schedule.json") as f:
    schedule = json.load(f)
jobs = schedule.get("jobs", [])
flex = schedule.get("flexSlots", [])
test("AC3: schedule has 8 jobs", len(jobs) == 8, f"got {len(jobs)}")
test("AC3: schedule has 2 flex slots", len(flex) == 2, f"got {len(flex)}")

# Check required job fields
job_fields = [
    "id", "techId", "time", "durationHrs", "type", "customerId",
    "address", "status", "notes", "bumpable",
]
job_missing = {}
for j in jobs:
    missing = [f for f in job_fields if f not in j]
    if missing:
        job_missing[j.get("id", "unknown")] = missing
test(
    "AC3: all jobs have required fields",
    len(job_missing) == 0,
    f"missing: {job_missing}" if job_missing else "",
)

# AC4: reset.sh works
os.chmod("scripts/reset.sh", 0o755)
# Modify state to test reset
with open("state/history-customer.json", "w") as f:
    json.dump([{"test": True}], f)
subprocess.run(["bash", "scripts/reset.sh"], capture_output=True)

with open("state/techs.json") as f:
    state_techs = json.load(f)
with open("data/techs.json") as f:
    data_techs = json.load(f)
test("AC4: reset.sh restores techs", state_techs == data_techs)

with open("state/customers.json") as f:
    state_cust = json.load(f)
with open("data/customers.json") as f:
    data_cust = json.load(f)
test("AC4: reset.sh restores customers", state_cust == data_cust)

with open("state/schedule.json") as f:
    state_sched = json.load(f)
with open("data/schedule.json") as f:
    data_sched = json.load(f)
test("AC4: reset.sh restores schedule", state_sched == data_sched)

with open("state/history-customer.json") as f:
    hist_c = json.load(f)
test("AC4: reset.sh clears history-customer", hist_c == [], f"got {hist_c}")

with open("state/history-ops.json") as f:
    hist_o = json.load(f)
test("AC4: reset.sh clears history-ops", hist_o == [], f"got {hist_o}")

# AC5: snapshot.sh runs and produces readable output
os.chmod("scripts/snapshot.sh", 0o755)
snap = subprocess.run(["bash", "scripts/snapshot.sh"], capture_output=True, text=True)
snap_out = snap.stdout
test(
    "AC5: snapshot.sh runs without error",
    snap.returncode == 0,
    f"stderr: {snap.stderr}" if snap.returncode != 0 else "",
)
test(
    "AC5: snapshot.sh output is non-empty",
    len(snap_out.strip()) > 100,
    f"got {len(snap_out)} chars",
)
test(
    "AC5: snapshot mentions schedule/jobs",
    "schedule" in snap_out.lower() or "job" in snap_out.lower(),
)
test(
    "AC5: snapshot mentions tech status",
    any(t in snap_out.lower() for t in ["marcus", "tyler", "jake", "danny"]),
)
test(
    "AC5: snapshot mentions flex buffer",
    "flex" in snap_out.lower() or "buffer" in snap_out.lower(),
)

# AC6: service-area Lehi -> Saratoga Springs
with open("data/service-area.json") as f:
    areas = json.load(f)
lehi_ss = [
    a
    for a in areas
    if a.get("from") == "Lehi" and a.get("to") == "Saratoga Springs"
]
test("AC6: Lehi to Saratoga Springs entry exists", len(lehi_ss) > 0)
if lehi_ss:
    mins = lehi_ss[0].get("minutes")
    test("AC6: drive time is a number", isinstance(mins, (int, float)), f"got {mins}")

# AC7: complaint-history customer with >= 2 complaints
complaint_customers = [
    c for c in customers if len(c.get("complaintHistory", [])) >= 2
]
test(
    "AC7: at least one customer with >= 2 complaints",
    len(complaint_customers) >= 1,
    f"found {len(complaint_customers)}",
)

# AC7b: warranty/policy-flex customer (4+ years, recent work)
warranty_customers = [
    c
    for c in customers
    if c.get("customerSince", "") <= "2022-03-14"
    and c.get("lastJobDate", "") >= "2026-01-01"
]
test(
    "AC7b: long-time customer with recent work for warranty testing",
    len(warranty_customers) >= 1,
    f"found {len(warranty_customers)}",
)

# AC8: All JSON files parse without errors
json_files = [
    "data/techs.json",
    "data/customers.json",
    "data/schedule.json",
    "data/jobs-catalog.json",
    "data/service-area.json",
    "data/policies.json",
    "state/techs.json",
    "state/customers.json",
    "state/schedule.json",
    "state/history-customer.json",
    "state/history-ops.json",
]
for jf in json_files:
    try:
        with open(jf) as f:
            json.load(f)
        test(f"AC8: {jf} is valid JSON", True)
    except Exception as e:
        test(f"AC8: {jf} is valid JSON", False, str(e))

# Check other required files exist
test("File exists: bridge/.env.example", os.path.isfile("bridge/.env.example"))
test("File exists: prompts/system-prompt.md", os.path.isfile("prompts/system-prompt.md"))
test("File exists: scripts/reset.sh", os.path.isfile("scripts/reset.sh"))
test("File exists: scripts/snapshot.sh", os.path.isfile("scripts/snapshot.sh"))

# Print results
print()
print("=" * 60)
print("ACCEPTANCE CRITERIA RESULTS")
print("=" * 60)
for r in results:
    print(r)
print("=" * 60)
passed_count = sum(1 for r in results if "[PASS]" in r)
failed_count = sum(1 for r in results if "[FAIL]" in r)
print(f"\n{passed_count} passed, {failed_count} failed out of {len(results)} checks")
if not all_pass:
    print("\nOVERALL: FAIL")
    sys.exit(1)
else:
    print("\nOVERALL: PASS")
    sys.exit(0)
