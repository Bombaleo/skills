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
