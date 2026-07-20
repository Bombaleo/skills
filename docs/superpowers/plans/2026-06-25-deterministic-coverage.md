# Deterministic Coverage Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the feature-catalog pipeline's per-entity `coverage` numbers deterministic by recomputing them from capability statuses in a small tested script, instead of trusting the LLM analyst's hand-tally.

**Architecture:** Add `compute_coverage.py` (stdlib, TDD) to the pipeline's scripts dir; wire it into the orchestrator as a new Stage 3.5 between per-entity analysis and synthesis; add one clarifying note each to the analyst and synthesizer agents.

**Tech Stack:** Python 3.9+ (stdlib only); Markdown skill/agent definitions.

**Design doc:** `docs/superpowers/specs/2026-06-25-deterministic-coverage-design.md`

## Global Constraints

- **Python 3.9+, stdlib only** — no third-party imports. Tests run via `python3 -m unittest`.
- **Independence:** no reference to `spec-pipeline`/`prototype-to-spec` at runtime; the script lives under `feature-catalog/skills/feature-catalog/scripts/`.
- **Capabilities-only coverage:** `coverage` counts capability `status` values only; states/transitions do NOT roll into coverage.
- **Status values:** `present | partial | missing`. Counts: `present`/`partial`/`missing` = number of capabilities with that status; `expected_total = len(capabilities)`. A capability whose status is outside the three is counted toward `expected_total` (via len) but no bucket — so `present+partial+missing < expected_total` flags it; warn such cases on stderr.
- **The script only rewrites the `coverage` block** of each `ent_*.json`; all other fields (slug, name, role, states, transitions, capabilities) are preserved byte-for-byte in meaning.

---

## File Structure

```
feature-catalog/skills/feature-catalog/scripts/
  compute_coverage.py          # Task 1 — new
  test_compute_coverage.py     # Task 1 — new unittest
feature-catalog/skills/feature-catalog/SKILL.md                            # Task 2 — +Stage 3.5
feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md # Task 2 — +1 note
feature-catalog/agents/gap-synthesizer/gap-synthesizer.md                   # Task 2 — +1 note
```

**Contract** (consumed by the orchestrator and gap-synthesizer):
- `compute_file_coverage(entity: dict) -> dict` returns `{"present":int,"partial":int,"missing":int,"expected_total":int}`.
- `recompute_dir(catalog_dir: str) -> dict` rewrites every `ent_*.json`'s `coverage` in place and returns the summed overall `{"present","partial","missing","expected_total"}`.
- CLI: `python3 compute_coverage.py <catalog_dir>` prints the overall as JSON plus a one-line summary; warns on out-of-set statuses to stderr.

---

## Task 1: `compute_coverage.py` — deterministic coverage recompute (TDD)

**Files:**
- Create: `feature-catalog/skills/feature-catalog/scripts/compute_coverage.py`
- Test: `feature-catalog/skills/feature-catalog/scripts/test_compute_coverage.py`

**Interfaces:**
- Produces: `compute_file_coverage(entity)`, `recompute_dir(catalog_dir)`, and the CLI above. Task 2's SKILL Stage 3.5 invokes the CLI.

- [ ] **Step 1: Write the failing test**

Create `feature-catalog/skills/feature-catalog/scripts/test_compute_coverage.py`:
```python
import json
import tempfile
import unittest
from pathlib import Path

from compute_coverage import compute_file_coverage, recompute_dir


def _entity(slug, statuses, bogus_coverage):
    return {
        "slug": slug, "name": slug.title(), "role": "r",
        "states": {"observed": ["a"], "expected": ["a", "b"], "missing": ["b"]},
        "transitions": [{"from": "a", "to": "b", "action": "go", "status": "present"}],
        "capabilities": [
            {"name": f"cap{i}", "category": "create", "status": s,
             "evidence": [], "note": ""} for i, s in enumerate(statuses)
        ],
        "coverage": bogus_coverage,
    }


class TestComputeCoverage(unittest.TestCase):
    def test_compute_file_coverage_counts_statuses(self):
        ent = _entity("x", ["present", "present", "partial", "missing"],
                      {"present": 1, "partial": 1, "missing": 1, "expected_total": 4})
        self.assertEqual(
            compute_file_coverage(ent),
            {"present": 2, "partial": 1, "missing": 1, "expected_total": 4})

    def test_empty_capabilities_all_zero(self):
        ent = _entity("e", [], {"present": 9, "partial": 9, "missing": 9, "expected_total": 9})
        self.assertEqual(
            compute_file_coverage(ent),
            {"present": 0, "partial": 0, "missing": 0, "expected_total": 0})

    def test_out_of_set_status_excluded_but_counted_in_total(self):
        ent = _entity("o", ["present", "planned"],
                      {"present": 2, "partial": 0, "missing": 0, "expected_total": 2})
        cov = compute_file_coverage(ent)
        self.assertEqual(cov, {"present": 1, "partial": 0, "missing": 0, "expected_total": 2})
        # the out-of-set status surfaces as a shortfall
        self.assertLess(cov["present"] + cov["partial"] + cov["missing"], cov["expected_total"])

    def test_recompute_dir_rewrites_blocks_and_returns_overall(self):
        with tempfile.TemporaryDirectory() as d:
            a = _entity("a", ["present", "present", "missing"],
                        {"present": 1, "partial": 2, "missing": 0, "expected_total": 3})
            b = _entity("b", ["partial", "missing"],
                        {"present": 5, "partial": 5, "missing": 5, "expected_total": 2})
            Path(d, "ent_a.json").write_text(json.dumps(a))
            Path(d, "ent_b.json").write_text(json.dumps(b))
            overall = recompute_dir(d)
            self.assertEqual(
                overall,
                {"present": 2, "partial": 1, "missing": 2, "expected_total": 5})
            # blocks were rewritten in place
            ra = json.loads(Path(d, "ent_a.json").read_text())
            self.assertEqual(ra["coverage"],
                             {"present": 2, "partial": 0, "missing": 1, "expected_total": 3})

    def test_recompute_dir_preserves_other_fields(self):
        with tempfile.TemporaryDirectory() as d:
            a = _entity("a", ["present"], {"present": 9, "partial": 0, "missing": 0,
                                           "expected_total": 1})
            Path(d, "ent_a.json").write_text(json.dumps(a))
            recompute_dir(d)
            ra = json.loads(Path(d, "ent_a.json").read_text())
            self.assertEqual(ra["slug"], "a")
            self.assertEqual(ra["states"], a["states"])
            self.assertEqual(ra["transitions"], a["transitions"])
            self.assertEqual(ra["capabilities"], a["capabilities"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_compute_coverage -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'compute_coverage'`.

- [ ] **Step 3: Write the implementation**

Create `feature-catalog/skills/feature-catalog/scripts/compute_coverage.py`:
```python
#!/usr/bin/env python3
"""Recompute per-entity coverage deterministically for the feature-catalog pipeline.

The entity-lifecycle-analyst emits a `coverage` block, but LLM hand-tallies are
unreliable. This script is the source of truth: for every ent_*.json in a catalog
directory it recomputes `coverage` from the capabilities' `status` values and writes
it back, then reports the summed overall coverage.

Usage:
    compute_coverage.py <catalog_dir>

Stdlib only, Python >= 3.9.
"""
import argparse
import json
import sys
from pathlib import Path

STATUSES = ("present", "partial", "missing")


def compute_file_coverage(entity: dict) -> dict:
    caps = entity.get("capabilities", [])
    cov = {s: 0 for s in STATUSES}
    for c in caps:
        st = c.get("status")
        if st in cov:
            cov[st] += 1
    cov["expected_total"] = len(caps)
    return cov


def recompute_dir(catalog_dir: str) -> dict:
    overall = {"present": 0, "partial": 0, "missing": 0, "expected_total": 0}
    for path in sorted(Path(catalog_dir).glob("ent_*.json")):
        entity = json.loads(path.read_text())
        cov = compute_file_coverage(entity)
        # surface capabilities whose status is outside the known set
        if cov["present"] + cov["partial"] + cov["missing"] < cov["expected_total"]:
            bad = sorted({c.get("status") for c in entity.get("capabilities", [])
                          if c.get("status") not in STATUSES})
            print(f"warning: {path.name} has out-of-set capability statuses: {bad}",
                  file=sys.stderr)
        entity["coverage"] = cov
        path.write_text(json.dumps(entity, indent=2))
        for k in overall:
            overall[k] += cov[k]
    return overall


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("catalog_dir")
    args = ap.parse_args()
    overall = recompute_dir(args.catalog_dir)
    print(json.dumps(overall))
    print(f"coverage normalized: {overall['present']} present / {overall['partial']} "
          f"partial / {overall['missing']} missing of {overall['expected_total']} expected")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_compute_coverage -v`
Expected: `Ran 5 tests` — `OK`.

- [ ] **Step 5: Smoke-test the CLI**

Run:
```bash
cd feature-catalog/skills/feature-catalog/scripts
tmp=$(mktemp -d)
printf '%s' '{"slug":"x","name":"X","role":"r","states":{},"transitions":[],"capabilities":[{"name":"c1","category":"create","status":"present","evidence":[],"note":""},{"name":"c2","category":"archive","status":"missing","evidence":[],"note":"n"}],"coverage":{"present":0,"partial":0,"missing":0,"expected_total":0}}' > "$tmp/ent_x.json"
python3 compute_coverage.py "$tmp"
python3 -c "import json;print('written:',json.load(open('$tmp/ent_x.json'))['coverage'])"
rm -rf "$tmp"
```
Expected: prints `{"present": 1, "partial": 0, "missing": 1, "expected_total": 2}` and the summary line, then `written: {'present': 1, 'partial': 0, 'missing': 1, 'expected_total': 2}`.

- [ ] **Step 6: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/compute_coverage.py \
        feature-catalog/skills/feature-catalog/scripts/test_compute_coverage.py
git commit -m "feat(feature-catalog): add deterministic compute_coverage.py"
```

---

## Task 2: Wire Stage 3.5 into the orchestrator and note it in the agents

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/SKILL.md` (insert Stage 3.5 between Stage 3 and Stage 4)
- Modify: `feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md` (one note)
- Modify: `feature-catalog/agents/gap-synthesizer/gap-synthesizer.md` (one note)

**Interfaces:**
- Consumes: `compute_coverage.py` CLI from Task 1 (`python3 "$SCRIPTS/compute_coverage.py" .specwork/catalog`). No new produced interface.

- [ ] **Step 1: Insert Stage 3.5 into SKILL.md**

In `feature-catalog/skills/feature-catalog/SKILL.md`, immediately AFTER the end of the `### Stage 3 — Per-entity lifecycle analysis (parallel)` section (which ends with the line "If any worker produced nothing, stop and name the entity.") and BEFORE `### Stage 4 — Synthesis`, insert this new section verbatim:

```markdown
### Stage 3.5 — Normalize coverage (deterministic)
LLM-tallied coverage is unreliable, so recompute it from the capability statuses before
synthesis. This is the source of truth for all coverage numbers:
```bash
python3 "$SCRIPTS/compute_coverage.py" .specwork/catalog
```
It rewrites each `.specwork/catalog/ent_<slug>.json`'s `coverage` block from its `capabilities`
statuses and prints the overall coverage. A stderr warning naming out-of-set statuses means an
analyst used a status outside present/partial/missing — re-delegate that entity's analyst if so.
```

- [ ] **Step 2: Add the analyst note**

In `feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md`, find the `coverage` bullet under the "Rules:" / output description that currently reads (the line beginning "`coverage`: count capabilities by status; `expected_total`"). Immediately after that line, add:

```markdown
- A deterministic downstream step recomputes `coverage` from your capability `status` values, so
  your responsibility is accurate per-capability `status` — still emit `coverage`, but it is not
  the authoritative tally.
```

- [ ] **Step 3: Add the synthesizer note**

In `feature-catalog/agents/gap-synthesizer/gap-synthesizer.md`, in the step that sums per-entity coverage into `overall_coverage` (the "Compute overall coverage" task step), append this sentence to that step:

```markdown
Each entity's `coverage` block has already been normalized deterministically upstream — trust and
sum these blocks; do not re-tally capabilities yourself.
```

- [ ] **Step 4: Verify the wiring**

Run:
```bash
python3 - <<'EOF'
import pathlib
skill = pathlib.Path("feature-catalog/skills/feature-catalog/SKILL.md").read_text()
assert "### Stage 3.5 — Normalize coverage (deterministic)" in skill, "Stage 3.5 missing"
assert "compute_coverage.py" in skill, "SKILL does not invoke compute_coverage.py"
# Stage 3.5 sits between Stage 3 and Stage 4
i3 = skill.index("### Stage 3 — Per-entity")
i35 = skill.index("### Stage 3.5 — Normalize coverage")
i4 = skill.index("### Stage 4 — Synthesis")
assert i3 < i35 < i4, "Stage 3.5 not positioned between Stage 3 and Stage 4"
analyst = pathlib.Path("feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md").read_text()
assert "deterministic downstream step recomputes" in analyst, "analyst note missing"
synth = pathlib.Path("feature-catalog/agents/gap-synthesizer/gap-synthesizer.md").read_text()
assert "already been normalized deterministically" in synth, "synthesizer note missing"
for f in (skill, analyst, synth):
    assert "prototype-to-spec/scripts" not in f and "spec-pipeline/" not in f
print("VERIFY_OK")
EOF
```
Expected: `VERIFY_OK`.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/SKILL.md \
        feature-catalog/agents/entity-lifecycle-analyst/entity-lifecycle-analyst.md \
        feature-catalog/agents/gap-synthesizer/gap-synthesizer.md
git commit -m "feat(feature-catalog): run deterministic coverage as Stage 3.5"
```

---

## Self-Review

**Spec coverage** (design → task):
- `compute_coverage.py` with `compute_file_coverage` / `recompute_dir` / CLI, capabilities-only, out-of-set handling, writes back only coverage → Task 1.
- SKILL Stage 3.5 invoking the script between analysis and synthesis → Task 2 Step 1.
- Analyst note (still emits coverage, not authoritative) → Task 2 Step 2.
- Synthesizer note (trust pre-normalized blocks) → Task 2 Step 3.
- Tests: corrects mismatch, preserves fields, overall sum, out-of-set, empty → Task 1 Step 1.

**Type/contract consistency:** `compute_file_coverage`/`recompute_dir` names and the `{present,partial,missing,expected_total}` shape match between Task 1 implementation, its test, and the Task 2 SKILL invocation. The CLI path `"$SCRIPTS/compute_coverage.py"` matches where pre-flight already sets `$SCRIPTS` (the scripts dir). gap-synthesizer already sums per-entity `coverage` (unchanged behavior); the note only reinforces it.

**Placeholder scan:** none — full code/tests inline; every step has exact commands and expected output.

**Note on Task 2 anchors:** Step 2/3 target existing lines by quoted content rather than line numbers (line numbers drift); the Step 4 assertions confirm the inserts landed and are correctly ordered.
