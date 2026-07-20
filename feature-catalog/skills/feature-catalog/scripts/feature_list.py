#!/usr/bin/env python3
"""Render the implemented-features markdown for the feature-catalog pipeline.

Reads entities-report.json (each entity carries a synthesizer-assigned `group`)
and renders features.md: implemented capabilities only (status present or partial,
partial flagged; missing excluded), grouped by logical entity group. Deterministic
— every present/partial capability is rendered; nothing is invented or dropped.

Usage:
    feature_list.py <report_json> <out_md>

Stdlib only, Python >= 3.9.
"""
import argparse
import json
import sys
from pathlib import Path

DEFAULT_GROUP = "Other"
IMPLEMENTED = ("present", "partial")


def implemented_features(entity: dict) -> list:
    return [c for c in entity.get("capabilities", []) if c.get("status") in IMPLEMENTED]


def grouped_entities(report: dict):
    """Return [(group_name, [entities...])], groups sorted alphabetically with the
    default group last; entities within a group sorted by name."""
    buckets = {}
    for e in report.get("entities", []):
        g = e.get("group") or DEFAULT_GROUP
        buckets.setdefault(g, []).append(e)
    for g in buckets:
        buckets[g].sort(key=lambda e: e.get("name", e.get("slug", "")))

    def key(g):
        return (1, "") if g == DEFAULT_GROUP else (0, g.lower())

    return [(g, buckets[g]) for g in sorted(buckets, key=key)]


def render_markdown(report: dict) -> str:
    app = report.get("app", "app")
    L = [f"# {app} — Implemented Features", ""]
    src = report.get("generated_from")
    if src:
        L.append(f"Implemented capabilities found in the prototype `{src}` "
                 f"(items marked *(partial)* are present but not fully confirmed). "
                 f"Generated from the entity-lifecycle catalog.")
        L.append("")
    for group, ents in grouped_entities(report):
        # skip groups whose entities have no implemented features at all
        if not any(implemented_features(e) for e in ents):
            continue
        L.append(f"## {group}")
        L.append("")
        for e in ents:
            feats = implemented_features(e)
            if not feats:
                continue
            L.append(f"### {e.get('name', e.get('slug'))}")
            for f in feats:
                tag = " (partial)" if f.get("status") == "partial" else ""
                L.append(f"- {f['name']}{tag}")
            L.append("")
    return "\n".join(L).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("report_json")
    ap.add_argument("out_md")
    args = ap.parse_args()
    report = json.loads(Path(args.report_json).read_text())
    Path(args.out_md).write_text(render_markdown(report))
    n = sum(len(implemented_features(e)) for e in report.get("entities", []))
    print(f"feature list written: {n} implemented features -> {args.out_md}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
