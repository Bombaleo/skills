#!/usr/bin/env python3
"""Enable all feature flags in a Claude Design standalone HTML export.

Injects a pre-boot <script> that seeds the app's `flexwork.featureFlags`
localStorage map to all-ON, so a subsequent walk render-confirms
flag-gated features. Non-destructive: writes a new file.

Stdlib only, Python >= 3.9.
"""
import base64
import gzip
import html as html_mod
import json
import re

from extract_bundle import grab_script


_ID_RE = re.compile(r"""\bid\s*:\s*["']([^"']+)["']""")
_DEFAULT_ON_RE = re.compile(r"\bdefaultOn\s*:")
_EXCLUDES_RE = re.compile(r"\bexcludes\s*:\s*\[([^\]]*)\]")
_STR_IN_ARR_RE = re.compile(r"""["']([^"']+)["']""")


def decode_bundle_sources(html):
    """Decode every JS/HTML source asset from the bundle manifest."""
    raw_manifest = grab_script(html, "__bundler/manifest")
    if raw_manifest is None:
        return []
    try:
        manifest = json.loads(html_mod.unescape(raw_manifest))
    except (ValueError, TypeError):
        return []
    sources = []
    for entry in manifest.values():
        try:
            data = base64.b64decode(entry["data"])
            if entry.get("compressed"):
                data = gzip.decompress(data)
            text = data.decode("utf-8", errors="replace")
        except (KeyError, ValueError, OSError):
            continue
        sources.append(text)
    return sources


def find_flag_module_in_sources(sources):
    """Return the source text that defines the feature-flag catalog."""
    for text in sources:
        if "FEATURE_FLAG_GROUPS" in text and "defaultOn:" in text:
            return text
    return None


def find_flag_module(html):
    """Decode the bundle and return the feature-flag module text, or None."""
    return find_flag_module_in_sources(decode_bundle_sources(html))


def parse_flag_catalog(source_text):
    """Parse a feature-flag catalog and return real flag IDs and their excludes.

    Returns dict with:
    - 'real_ids': list of flag IDs that have a defaultOn field
    - 'excludes': dict mapping flag ID to list of excluded flag IDs
    """
    ids = [(m.group(1), m.start()) for m in _ID_RE.finditer(source_text)]
    default_positions = [m.start() for m in _DEFAULT_ON_RE.finditer(source_text)]
    exclude_spans = [(m.start(), m.group(1)) for m in _EXCLUDES_RE.finditer(source_text)]

    real_ids = []
    excludes = {}
    for i, (flag_id, start) in enumerate(ids):
        end = ids[i + 1][1] if i + 1 < len(ids) else len(source_text)
        has_default = any(start < p < end for p in default_positions)
        if not has_default:
            continue
        real_ids.append(flag_id)
        targets = []
        for pos, body in exclude_spans:
            if start < pos < end:
                for t in _STR_IN_ARR_RE.findall(body):
                    if t not in targets:
                        targets.append(t)
        if targets:
            excludes[flag_id] = targets
    return {"real_ids": real_ids, "excludes": excludes}


def build_seed(catalog):
    """Build the all-ON feature-flag seed map with exclusion resolution.

    Takes a catalog dict from parse_flag_catalog with 'real_ids' and 'excludes'.
    Returns a dict mapping every flag ID to True, then for each flag (in source order),
    forces its excludes targets to False (source-order-first wins).
    """
    real_ids = catalog.get("real_ids", [])
    excludes = catalog.get("excludes", {})
    seed = {fid: True for fid in real_ids}
    for fid in real_ids:
        if seed.get(fid):
            for target in excludes.get(fid, []):
                seed[target] = False
    return seed


FF_STORAGE_KEY = "flexwork.featureFlags"
MIRROR_KEYS = [
    "flexwork.featureFlags.customFields",
    "flexwork.featureFlags.professionalJobTypes",
]

_SEED_SCRIPT_RE = re.compile(
    r'<script data-enable-all-features="1">.*?</script>', re.S
)


def _seed_script(seed):
    ff_json = json.dumps(seed)
    lines = [
        '<script data-enable-all-features="1">',
        "try{",
        f'localStorage.setItem({json.dumps(FF_STORAGE_KEY)},'
        f'{json.dumps(ff_json)});',
    ]
    for key in MIRROR_KEYS:
        lines.append(f'localStorage.setItem({json.dumps(key)},"true");')
    lines.append("}catch(e){}")
    lines.append("</script>")
    return "".join(lines)


def inject_seed(html, seed):
    script = _seed_script(seed)
    if _SEED_SCRIPT_RE.search(html):
        return _SEED_SCRIPT_RE.sub(lambda _m: script, html, count=1)
    m = re.search(r"<script\b", html, re.I)
    if m:
        return html[: m.start()] + script + html[m.start():]
    m = re.search(r"</head>", html, re.I)
    if m:
        return html[: m.start()] + script + html[m.start():]
    return script + html
