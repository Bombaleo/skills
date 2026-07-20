#!/usr/bin/env python3
"""Normalize source-mapper entry_hints into clickable nav paths for the walker.

The source-mapper sometimes emits entry_hint as a descriptive string ("A → B → C
(wizard ③ …) → [version] → Delete") instead of a clean array of clickable nav
labels. The walker's --nav needs the latter. This rewrites map.json: each feature
gains a clean `entry_path` (the leading run of static nav labels, truncated at the
first dynamic segment), and a top-level `walk_targets` lists the distinct non-empty
paths for the orchestrator to walk.

Usage:
    normalize_hints.py <map_json>

Stdlib only, Python >= 3.9.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ACTION_VERBS = {
    "add", "edit", "delete", "remove", "apply", "continue", "publish", "pin",
    "download", "save", "cancel", "next", "back", "add rule", "add group",
    "compare changes",
}


def _raw_segments(hint):
    if isinstance(hint, list):
        return [str(s) for s in hint]
    if isinstance(hint, str):
        return [s for s in re.split(r"→|>|,", hint)]
    return []


def _is_stop(seg: str) -> bool:
    s = seg.strip()
    if not s:
        return False  # empty handled by caller (skip, not stop)
    if "[" in s and "]" in s:
        return True
    if s.startswith("("):
        return True
    if s.lower() in ACTION_VERBS:
        return True
    return False


def _clean_label(seg: str) -> str:
    # strip a trailing "(...)" annotation, surrounding brackets, collapse whitespace
    s = re.sub(r"\s*\([^)]*\)\s*$", "", seg).strip()
    s = s.strip("[]").strip()
    return re.sub(r"\s+", " ", s)


def normalize_hint(hint) -> list:
    out = []
    for seg in _raw_segments(hint):
        if _is_stop(seg):
            break
        label = _clean_label(seg)
        if label:
            out.append(label)
    return out


def normalize_map(m: dict) -> dict:
    targets = []
    seen = set()

    def _process(units):
        for u in units:
            for f in u.get("features", []):
                path = normalize_hint(f.get("entry_hint"))
                f["entry_path"] = path
                key = tuple(path)
                if path and key not in seen:
                    seen.add(key)
                    targets.append(path)

    _process(m.get("entities", []))
    _process(m.get("config_areas", []))
    m["walk_targets"] = sorted(targets)
    return m


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("map_json")
    args = ap.parse_args()
    p = Path(args.map_json)
    m = normalize_map(json.loads(p.read_text()))
    p.write_text(json.dumps(m, indent=2))
    print(f"{len(m['walk_targets'])} walk targets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
