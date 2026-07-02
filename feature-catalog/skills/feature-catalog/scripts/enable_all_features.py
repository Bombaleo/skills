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
