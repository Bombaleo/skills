#!/usr/bin/env python3
"""Group walk screens into top-level-nav modules for the feature-catalog pipeline.

Reads a walk index.json (produced by walk_prototype.py) and buckets every screen
into a module, so the orchestrator can fan out one module-cataloger per module.

Module assignment:
  - With a nav allowlist (`--nav-labels`, recommended): a screen's module is the
    FIRST label in its click path that is in the allowlist. Screens whose path
    contains no nav label (dashboard content, calendar cells, widgets, pagination,
    user menu, search) fold into the "Overview" module. This keeps modules to the
    app's real navigation instead of arbitrary first clicks. Module order follows
    the nav-label order, with Overview first.
  - Without an allowlist (fallback): a screen's module is its first path label;
    the entry screen (empty path) becomes "Overview". Modules sort Overview-first
    then alphabetically. (Naive — on a dashboard-rooted app this mislabels content
    clicks as modules; prefer passing nav labels.)

Usage:
    group_screens.py <index.json> [--out groups.json] [--nav-labels "A,B,C"]
    --nav-labels accepts a comma-separated list, or a JSON array for labels that
    contain commas: --nav-labels '["A","B, with comma"]'

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


def _module_for(path, nav_labels):
    """The module name a screen belongs to."""
    if nav_labels is not None:
        return next((p for p in path if p in nav_labels), OVERVIEW)
    return path[0] if path else OVERVIEW


def group_screens(index: dict, nav_labels=None) -> dict:
    buckets = {}  # name -> {"screen_ids": [...], "screen_files": [...]}
    for s in index.get("screens", []):
        path = s.get("path") or []
        name = _module_for(path, nav_labels)
        b = buckets.setdefault(name, {"screen_ids": [], "screen_files": []})
        if s.get("id") is not None:
            b["screen_ids"].append(s["id"])
        if s.get("txt"):
            b["screen_files"].append(s["txt"])

    if nav_labels is not None:
        order = [OVERVIEW] + list(nav_labels)

        def sort_key(name):
            return (order.index(name), "") if name in order else (len(order), name.lower())
    else:
        def sort_key(name):
            return (0, "") if name == OVERVIEW else (1, name.lower())

    modules = [
        {"slug": slugify(name), "name": name,
         "screen_ids": buckets[name]["screen_ids"],
         "screen_files": buckets[name]["screen_files"]}
        for name in sorted(buckets, key=sort_key)
    ]
    return {"modules": modules}


def parse_labels(arg: str):
    """Comma-separated labels, or a JSON array for labels that contain commas."""
    arg = arg.strip()
    if not arg:
        return None
    if arg.startswith("["):
        return [str(x) for x in json.loads(arg)]
    return [l.strip() for l in arg.split(",") if l.strip()]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("index")
    ap.add_argument("--out", default="")
    ap.add_argument("--nav-labels", default="",
                    help="allowlist of top-level nav labels (comma-separated or JSON array)")
    args = ap.parse_args()
    index = json.loads(Path(args.index).read_text())
    out = group_screens(index, nav_labels=parse_labels(args.nav_labels))
    text = json.dumps(out, indent=2)
    if args.out:
        Path(args.out).write_text(text)
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
