# Feature-catalog — capture below-the-fold content in the walk

**Date:** 2026-07-01
**Status:** Approved (design)
**Modifies:** the vendored `feature-catalog/skills/feature-catalog/scripts/walk_prototype.py`

## Problem

Checking the walk screenshots revealed the render-walk under-captures content that requires
scrolling:

- The **text outline** (`NNN_*.txt`, which the analysts read) is DOM-based and filters by element
  **size + CSS visibility, not viewport position** (`walk_prototype.py:169-173`), so statically-
  rendered below-the-fold content IS captured — but it is truncated: `document.body.innerText`
  is sliced to **8000** chars (`:239`), the whole outline to 16000, and tables to the first
  **6 tables × 3 rows** (`:230-236`). Long pages/tables get clipped.
- The **screenshot** (`Page.captureScreenshot`, no `captureBeyondViewport`/`clip`, `:396`) is
  **viewport-only** (1440×900) — it shows only the top of the page.
- **Lazy / virtualized content** (rows/sections that only mount into the DOM after scrolling) is
  **missed entirely** — the walker only `scrollIntoView`s an element right before clicking it
  (`:202`); it never scrolls the page to trigger lazy rendering.

Net: static below-fold text is in the outline (truncated on long pages) but not the screenshot;
scroll-triggered content is absent from both.

## Decision

Fix all three, applied **before each screen is outlined/screenshotted**: auto-scroll to mount
lazy content, full-page screenshots, and lifted text caps. Vendored walker only — the
`spec-pipeline`/`prototype-to-spec` original is untouched (independence preserved).

## Components

### 1. Auto-scroll pass (mount lazy/virtualized content)
Add a JS helper `window.__walk.autoscroll()` (in `JS_HELPERS`) that:
- Scrolls the **window** to the bottom in `window.innerHeight` steps, `await`-ing ~150ms between
  steps, looping until `document.body.scrollHeight` stops increasing across two consecutive
  reads OR a cap of **25 steps** (~≤6s) is reached.
- Best-effort scrolls **inner scroll containers**: for the first **10** elements where
  `scrollHeight > clientHeight + 200` and `overflow`/`overflow-y` is `auto|scroll`, set
  `scrollTop = scrollHeight`.
- Restores `window.scrollTo(0, 0)` at the end so the screenshot starts from the top.
- Returns the final `document.body.scrollHeight` (for logging/settle).

Because `__walk` JS helpers are (re)injected after each navigation, `autoscroll` is defined
alongside the existing helpers. The Python side calls it via a new
`self.cdp.js("window.__walk.autoscroll()")` step inside `_settle()` **after** the page settles
and **before** returning — so `outline()`, `signature()`, and the screenshot all observe the
fully-mounted DOM. (Autoscroll runs on both full loads and the short post-click settle.)

Add a `--no-autoscroll` flag (default off, i.e. autoscroll ON) so the behavior can be disabled
if a prototype misbehaves.

### 2. Full-page screenshots
Replace the viewport capture with a full-page one:
- Query `Page.getLayoutMetrics`; read `cssContentSize` (fallback `contentSize`) for width/height.
- Build a `clip` via a pure helper `screenshot_clip(metrics, max_px=20000) -> dict` returning
  `{"x":0,"y":0,"width":W,"height":min(H,max_px),"scale":1}` (W/H rounded ints; height capped at
  `max_px` to avoid runaway images; if metrics are missing/zero, return `None` → caller falls back
  to a plain viewport capture).
- Call `Page.captureScreenshot(format="png", captureBeyondViewport=True, clip=<clip>)` when a clip
  is available, else the current plain call.

### 3. Lift the text caps (in `outline()`)
- `document.body.innerText` slice: **8000 → 40000**.
- Outline total slice: **16000 → 60000**.
- Tables: `slice(0, 6)` → `slice(0, 20)`; rows per table `slice(0, 3)` → `slice(0, 8)`.
Still capped to prevent pathological runaway.

## Interfaces / testing
- **Pure helper (unit-tested):** `screenshot_clip(metrics: dict, max_px: int = 20000) -> dict|None`
  — module-level in `walk_prototype.py`. Tests:
  - normal metrics → clip with full width/height, scale 1;
  - height beyond `max_px` → clipped to `max_px`;
  - missing/zero `cssContentSize` → `None`;
  - `contentSize` fallback when `cssContentSize` absent.
- The autoscroll JS and the CDP screenshot call are browser-driven and validated by an
  **integration re-walk**, not unit tests: scope-walk a known long VMS screen (e.g.
  `Settings → Users` or a requisitions list) with and without `--no-autoscroll`, and confirm
  (a) previously-below-fold text now appears in the `.txt` outline, (b) the `.png` height is the
  full page (not 900px). Also `python3 -m py_compile walk_prototype.py` and the existing suites
  (`test_walk_append`, `test_normalize_hints`, `test_compute_coverage`, `test_feature_list`) stay
  green.
- Default walk flags (`--max-screens`/`--depth`/`--per-screen`/`--nav`/`--append`) unchanged;
  `--append` seeding, dedup, and per-walk cap unchanged.

## Trade-offs / risks
- Autoscroll adds ~1–4s per screen (scroll settle). Bounded by the 25-step / ~6s cap.
- Full-page PNGs are larger; the 20000px height cap bounds worst case.
- Inner-container scrolling is best-effort (first 10 candidates) — exotic nested virtualization
  may still under-capture; acceptable, and the outline is DOM-based so most content is caught.
- No change to the dedup signature semantics beyond it now reflecting post-scroll content (a
  screen's signature is more complete, which is correct).

## Out of scope
- Per-element screenshot stitching / retina scale > 1.
- Clicking "load more" buttons (that is the walker's normal click expansion, unchanged).
- Any change to the `spec-pipeline` original walk script.

## Files
```
feature-catalog/skills/feature-catalog/scripts/walk_prototype.py         # autoscroll JS, full-page screenshot, lifted caps, --no-autoscroll, screenshot_clip()
feature-catalog/skills/feature-catalog/scripts/test_walk_screenshot_clip.py  # new unittest for screenshot_clip()
```
