#!/usr/bin/env python3
"""Extract source assets from a Claude Code design standalone HTML export.

The export embeds its assets in a <script type="__bundler/manifest"> tag as
JSON: {uuid: {mime, compressed, data(base64[, gzip])}}, and the app shell in a
<script type="__bundler/template"> tag with UUID placeholders.

Usage:
    extract_bundle.py <prototype.html> <out_dir>

Writes:
    out_dir/_template.html       app shell (UUIDs left as-is)
    out_dir/NNN_<uuid8>.<ext>    each decoded asset
    out_dir/manifest.json        index: filename -> {mime, size, kind}

Stdlib only, Python >= 3.9. Exit codes: 0 ok, 1 bad input, 2 no bundler manifest.
"""
import base64
import gzip
import html as html_mod
import json
import re
import sys
from pathlib import Path

EXT_BY_MIME = {
    "text/javascript": "js",
    "application/javascript": "js",
    "text/html": "html",
    "text/css": "css",
    "image/svg+xml": "svg",
    "image/png": "png",
    "image/jpeg": "jpg",
    "application/json": "json",
}

# Magic bytes that identify the real type when the mime label lies
# (fonts have been seen labelled image/png in real exports).
MAGIC = [(b"OTTO", "otf"), (b"\x00\x01\x00\x00", "ttf"), (b"wOFF", "woff"),
         (b"wOF2", "woff2"), (b"\x89PNG", "png"), (b"GIF8", "gif")]


def sniff_ext(data: bytes, mime: str) -> str:
    for magic, ext in MAGIC:
        if data[: len(magic)] == magic:
            return ext
    return EXT_BY_MIME.get(mime, "bin")


def grab_script(html, script_type):
    m = re.search(
        rf'<script type="{re.escape(script_type)}"[^>]*>(.*?)</script>', html, re.S
    )
    return m.group(1).strip() if m else None


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 1
    src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    if not src.is_file():
        print(f"error: not a file: {src}", file=sys.stderr)
        return 1
    html = src.read_text(errors="replace")

    raw_manifest = grab_script(html, "__bundler/manifest")
    if raw_manifest is None:
        print("error: no __bundler/manifest found — not a standalone design export "
              "(or format changed). Falling back to raw HTML is up to the caller.",
              file=sys.stderr)
        return 2
    manifest = json.loads(html_mod.unescape(raw_manifest))

    out_dir.mkdir(parents=True, exist_ok=True)
    index = {}

    template = grab_script(html, "__bundler/template")
    if template is not None:
        tpl = html_mod.unescape(template)
        (out_dir / "_template.html").write_text(tpl)
        index["_template.html"] = {"mime": "text/html", "size": len(tpl),
                                   "kind": "app shell"}

    for i, (uuid, entry) in enumerate(manifest.items()):
        data = base64.b64decode(entry["data"])
        if entry.get("compressed"):
            data = gzip.decompress(data)
        ext = sniff_ext(data, entry.get("mime", ""))
        name = f"{i:03d}_{uuid[:8]}.{ext}"
        (out_dir / name).write_bytes(data)
        kind = "source" if ext in ("js", "html", "css") else "asset"
        index[name] = {"mime": entry.get("mime", "?"), "size": len(data),
                       "kind": kind, "uuid": uuid}

    (out_dir / "manifest.json").write_text(json.dumps(index, indent=2))

    n_src = sum(1 for v in index.values() if v["kind"] in ("source", "app shell"))
    print(f"extracted {len(index)} files to {out_dir} ({n_src} source/shell). "
          f"Read manifest.json for the index; source files are the .js/.html ones.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
