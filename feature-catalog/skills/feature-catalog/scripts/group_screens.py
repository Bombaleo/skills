#!/usr/bin/env python3
"""Group walk screens into top-level-nav modules for the feature-catalog pipeline.

Reads a walk index.json (produced by walk_prototype.py) and buckets every screen
by its first nav-path label, so the orchestrator can fan out one module-cataloger
per module. The entry screen (empty path) becomes the "Overview" module.

Usage:
    group_screens.py <index.json> [--out groups.json]

Stdlib only, Python >= 3.9.
"""
import argparse
import json
import re
import sys
from pathlib import Path

OVERVIEW = "Overview"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def group_screens(index: dict) -> dict:
    buckets = {}  # name -> {"screen_ids": [...], "screen_files": [...]}
    for s in index.get("screens", []):
        path = s.get("path") or []
        name = path[0] if path else OVERVIEW
        b = buckets.setdefault(name, {"screen_ids": [], "screen_files": []})
        b["screen_ids"].append(s.get("id"))
        if s.get("txt"):
            b["screen_files"].append(s["txt"])

    def sort_key(name):
        return (0, "") if name == OVERVIEW else (1, name.lower())

    modules = [
        {"slug": slugify(name), "name": name,
         "screen_ids": buckets[name]["screen_ids"],
         "screen_files": buckets[name]["screen_files"]}
        for name in sorted(buckets, key=sort_key)
    ]
    return {"modules": modules}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("index")
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    index = json.loads(Path(args.index).read_text())
    out = group_screens(index)
    text = json.dumps(out, indent=2)
    if args.out:
        Path(args.out).write_text(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
