# Walker Below-Fold Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the vendored walker capture below-the-fold content — mount lazy/virtualized content via auto-scroll, take full-page screenshots, and stop truncating long-page text.

**Architecture:** Three changes to `feature-catalog/skills/feature-catalog/scripts/walk_prototype.py`: a pure `screenshot_clip()` helper (unit-tested) feeding a full-page `Page.captureScreenshot`; a Python-driven auto-scroll loop (`_autoscroll`) using two new synchronous JS helpers (`scrollStep`/`scrollTop`) called at the end of `_settle`; and lifted text/table caps in the `outline()` JS. A `--no-autoscroll` flag disables the scroll behavior.

**Tech Stack:** Python 3.9+ stdlib; Chrome DevTools Protocol (existing hand-rolled client); in-page JS helpers.

**Design doc:** `docs/superpowers/specs/2026-07-01-walker-below-fold-capture-design.md`

## Global Constraints

- **Python 3.9+, stdlib only.** Vendored walker ONLY — do not touch the `spec-pipeline`/`prototype-to-spec` original. No `spec-pipeline`/`prototype-to-spec` runtime refs.
- **Auto-scroll is Python-driven** (the CDP client's `cdp.js` does NOT await Promises, so no async JS): sync JS `scrollStep()` scrolls one step + returns `document.body.scrollHeight`; Python loops with `time.sleep`, stopping when height is stable across 2 reads or after **25 steps**; then `scrollTop()`. Best-effort inner containers: first **10** elements with `overflow-y: auto|scroll` and `scrollHeight > clientHeight + 200`.
- **`--no-autoscroll`** (default off → autoscroll ON) disables the scroll loop.
- **Full-page screenshot:** `Page.captureScreenshot(format="png", captureBeyondViewport=True, clip=<screenshot_clip>)`; height capped at **20000px**; fall back to a plain viewport capture when clip is `None`.
- **Lifted caps in `outline()`:** body `innerText` 8000→**40000**; outline total 16000→**60000**; tables `slice(0,6)`→`slice(0,20)`; rows `slice(0,3)`→`slice(0,8)`.
- **Unchanged:** `--max-screens`/`--depth`/`--per-screen`/`--nav`/`--append` behavior, dedup, per-walk cap, screen naming.

---

## File Structure

```
feature-catalog/skills/feature-catalog/scripts/
  walk_prototype.py                    # Tasks 1-3: screenshot_clip(), full-page shot, autoscroll, lifted caps, --no-autoscroll
  test_walk_screenshot_clip.py         # Task 1: unittest for screenshot_clip()
```

**Order:** Task 1 (pure helper, TDD) → Task 2 (wire full-page screenshot, uses the helper) → Task 3 (autoscroll + lifted caps).

---

## Task 1: `screenshot_clip()` pure helper (TDD)

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/scripts/walk_prototype.py` (add module-level function near the other helpers, e.g. after `parse_labels`)
- Test: `feature-catalog/skills/feature-catalog/scripts/test_walk_screenshot_clip.py`

**Interfaces:**
- Produces: `screenshot_clip(metrics: dict, max_px: int = 20000) -> dict | None`. Task 2 calls it with `Page.getLayoutMetrics` output.

- [ ] **Step 1: Write the failing test**

Create `feature-catalog/skills/feature-catalog/scripts/test_walk_screenshot_clip.py`:
```python
import unittest
from walk_prototype import screenshot_clip


class TestScreenshotClip(unittest.TestCase):
    def test_uses_css_content_size(self):
        m = {"cssContentSize": {"x": 0, "y": 0, "width": 1440, "height": 3200}}
        self.assertEqual(screenshot_clip(m),
                         {"x": 0, "y": 0, "width": 1440, "height": 3200, "scale": 1})

    def test_caps_height(self):
        m = {"cssContentSize": {"x": 0, "y": 0, "width": 1440, "height": 99999}}
        self.assertEqual(screenshot_clip(m, max_px=20000)["height"], 20000)

    def test_rounds_floats(self):
        m = {"cssContentSize": {"x": 0, "y": 0, "width": 1440.7, "height": 900.2}}
        c = screenshot_clip(m)
        self.assertEqual((c["width"], c["height"]), (1441, 900))

    def test_falls_back_to_content_size(self):
        m = {"contentSize": {"x": 0, "y": 0, "width": 800, "height": 600}}
        self.assertEqual(screenshot_clip(m),
                         {"x": 0, "y": 0, "width": 800, "height": 600, "scale": 1})

    def test_none_when_missing(self):
        self.assertIsNone(screenshot_clip({}))

    def test_none_when_zero(self):
        self.assertIsNone(screenshot_clip({"cssContentSize": {"width": 0, "height": 0}}))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_walk_screenshot_clip -v`
Expected: FAIL — `ImportError: cannot import name 'screenshot_clip'`.

- [ ] **Step 3: Implement `screenshot_clip`**

In `walk_prototype.py`, add this module-level function immediately AFTER the `parse_labels` function:
```python
def screenshot_clip(metrics: dict, max_px: int = 20000):
    """Full-page screenshot clip from Page.getLayoutMetrics, or None if unavailable.

    Uses cssContentSize (fallback contentSize). Height is capped at max_px to
    bound very long pages. Returns None when metrics are missing or zero so the
    caller falls back to a plain viewport capture.
    """
    size = metrics.get("cssContentSize") or metrics.get("contentSize") or {}
    w = size.get("width") or 0
    h = size.get("height") or 0
    if w <= 0 or h <= 0:
        return None
    return {"x": 0, "y": 0, "width": round(w), "height": min(round(h), max_px), "scale": 1}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd feature-catalog/skills/feature-catalog/scripts && python3 -m unittest test_walk_screenshot_clip -v`
Expected: `Ran 6 tests` — `OK`.

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/walk_prototype.py \
        feature-catalog/skills/feature-catalog/scripts/test_walk_screenshot_clip.py
git commit -m "feat(feature-catalog): add screenshot_clip helper for full-page capture"
```

---

## Task 2: Full-page screenshot in `capture()`

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/scripts/walk_prototype.py` (the screenshot line in `capture()`)

**Interfaces:**
- Consumes: `screenshot_clip()` (Task 1). No new produced interface.

- [ ] **Step 1: Replace the viewport screenshot with a full-page one**

In `capture()`, replace this line:
```python
        shot = self.cdp.cmd("Page.captureScreenshot", format="png")
```
with:
```python
        clip = screenshot_clip(self.cdp.cmd("Page.getLayoutMetrics"))
        if clip:
            shot = self.cdp.cmd("Page.captureScreenshot", format="png",
                                captureBeyondViewport=True, clip=clip)
        else:
            shot = self.cdp.cmd("Page.captureScreenshot", format="png")
```

- [ ] **Step 2: Verify compile + structure + regressions**

Run:
```bash
cd feature-catalog/skills/feature-catalog/scripts
python3 -m py_compile walk_prototype.py && echo COMPILE_OK
grep -q "captureBeyondViewport=True" walk_prototype.py && grep -q "screenshot_clip(self.cdp.cmd(\"Page.getLayoutMetrics\"))" walk_prototype.py && echo WIRED_OK
python3 -m unittest test_walk_screenshot_clip test_walk_append test_normalize_hints test_compute_coverage test_feature_list 2>&1 | tail -2
python3 walk_prototype.py 2>&1 | head -1   # usage/arg error, not a traceback
```
Expected: `COMPILE_OK`, `WIRED_OK`, tests `OK`, and the last line is the argparse usage/error (no traceback).

- [ ] **Step 3: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/walk_prototype.py
git commit -m "feat(feature-catalog): full-page screenshots (captureBeyondViewport + clip)"
```

---

## Task 3: Auto-scroll to mount lazy content + lift text caps

**Files:**
- Modify: `feature-catalog/skills/feature-catalog/scripts/walk_prototype.py` (`JS_HELPERS`: add `scrollStep`/`scrollTop`, lift `outline()` caps; add `_autoscroll` method; call it in `_settle`; add `--no-autoscroll` arg)

**Interfaces:**
- Consumes: nothing new. Produces: `Walker._autoscroll(self)`; JS `window.__walk.scrollStep()`/`scrollTop()`; `--no-autoscroll` CLI flag.

- [ ] **Step 1: Add `scrollStep`/`scrollTop` JS helpers and lift the outline caps**

In `walk_prototype.py`, in the `JS_HELPERS` string:

(a) Lift the `outline()` caps — replace the tables loop line:
```javascript
    for (const t of [...document.querySelectorAll('table')].filter(visible).slice(0, 6)) {
```
with:
```javascript
    for (const t of [...document.querySelectorAll('table')].filter(visible).slice(0, 20)) {
```
replace the rows line:
```javascript
      for (const r of [...rows].slice(0, 3))
```
with:
```javascript
      for (const r of [...rows].slice(0, 8))
```
replace the full-text slice line:
```javascript
    L.push((document.body.innerText || '').slice(0, 8000));
    return L.join('\n').slice(0, 16000);
```
with:
```javascript
    L.push((document.body.innerText || '').slice(0, 40000));
    return L.join('\n').slice(0, 60000);
```

(b) Add the two scroll helpers — replace the return line:
```javascript
  return {candidates, click, outline, signature, settled};
```
with:
```javascript
  const scrollStep = () => {
    window.scrollTo(0, document.body.scrollHeight);
    let n = 0;
    for (const el of document.querySelectorAll('div,ul,ol,section,main,table,tbody')) {
      if (n >= 10) break;
      const st = getComputedStyle(el).overflowY;
      if ((st === 'auto' || st === 'scroll') && el.scrollHeight > el.clientHeight + 200) {
        el.scrollTop = el.scrollHeight; n++;
      }
    }
    return document.body.scrollHeight;
  };
  const scrollTop = () => { window.scrollTo(0, 0); return true; };
  return {candidates, click, outline, signature, settled, scrollStep, scrollTop};
```

- [ ] **Step 2: Add the `_autoscroll` method and call it at the end of `_settle`**

In `walk_prototype.py`, in `_settle()`, change the early settle `return` to `break` so autoscroll always runs. Replace:
```python
            if ok and sig is not None:
                if sig == last:
                    if stable_since and time.time() - stable_since >= 0.4:
                        return
                    stable_since = stable_since or time.time()
                else:
                    last, stable_since = sig, None
            time.sleep(0.25)
        # proceed anyway; outline will show whatever rendered
```
with:
```python
            if ok and sig is not None:
                if sig == last:
                    if stable_since and time.time() - stable_since >= 0.4:
                        break
                    stable_since = stable_since or time.time()
                else:
                    last, stable_since = sig, None
            time.sleep(0.25)
        # proceed anyway; outline will show whatever rendered
        self._autoscroll()
```
Then add this method immediately AFTER `_settle` (before `capture`):
```python
    def _autoscroll(self):
        """Scroll the page (and inner scroll containers) to mount lazy/virtualized
        content, then return to the top. Python-driven so the sync CDP client can
        drive it. Bounded to 25 steps; stops when scrollHeight is stable."""
        if getattr(self.args, "no_autoscroll", False):
            return
        last, stable = -1, 0
        for _ in range(25):
            try:
                h = self.cdp.js("window.__walk && window.__walk.scrollStep()")
            except RuntimeError:
                break
            if not h:
                break
            if h == last:
                stable += 1
                if stable >= 2:
                    break
            else:
                stable, last = 0, h
            time.sleep(0.15)
        try:
            self.cdp.js("window.__walk && window.__walk.scrollTop()")
        except RuntimeError:
            pass
```

- [ ] **Step 3: Add the `--no-autoscroll` flag**

In `main()`, immediately AFTER the `ap.add_argument("--timeout", type=int, default=15)` line, add:
```python
    ap.add_argument("--no-autoscroll", action="store_true",
                    help="disable the auto-scroll pass that mounts lazy/below-fold content")
```

- [ ] **Step 4: Verify compile + structure + regressions**

Run:
```bash
cd feature-catalog/skills/feature-catalog/scripts
python3 -m py_compile walk_prototype.py && echo COMPILE_OK
python3 - <<'EOF'
import pathlib
t = pathlib.Path("walk_prototype.py").read_text()
assert "scrollStep, scrollTop}" in t, "helpers not added to return"
assert "def _autoscroll(self)" in t, "_autoscroll missing"
assert "self._autoscroll()" in t, "_settle does not call _autoscroll"
assert "--no-autoscroll" in t, "flag missing"
assert "slice(0, 40000)" in t and "slice(0, 60000)" in t, "body/outline caps not lifted"
assert "slice(0, 20))" in t and "slice(0, 8))" in t, "table/row caps not lifted"
# the old early-return in _settle is gone (replaced by break)
import re
seg = t[t.index("def _settle"):t.index("def _autoscroll")]
assert "return" not in seg.replace("returned",""), "old early return still in _settle"
assert "prototype-to-spec" not in t and "spec-pipeline" not in t
print("STRUCT_OK")
EOF
python3 -m unittest test_walk_screenshot_clip test_walk_append test_normalize_hints test_compute_coverage test_feature_list 2>&1 | tail -2
python3 walk_prototype.py 2>&1 | head -1
```
Expected: `COMPILE_OK`, `STRUCT_OK`, tests `OK`, argparse usage line (no traceback).

- [ ] **Step 5: Commit**

```bash
git add feature-catalog/skills/feature-catalog/scripts/walk_prototype.py
git commit -m "feat(feature-catalog): autoscroll to mount lazy content + lift outline caps"
```

---

## Post-plan integration validation (not a task — run after the plan)

Scope-walk one known long VMS screen twice into a throwaway dir and compare, to confirm the behavior end-to-end (needs Chrome):
```bash
SCRIPTS=feature-catalog/skills/feature-catalog/scripts
python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/fold-on  --nav '["Settings","Users"]' --max-screens 1 --depth 1
python3 "$SCRIPTS/walk_prototype.py" /tmp/prototype.html --out /tmp/fold-off --nav '["Settings","Users"]' --max-screens 1 --depth 1 --no-autoscroll
# (a) outline captures more with autoscroll; (b) png is full-height, not 900px:
wc -c /tmp/fold-on/*.txt /tmp/fold-off/*.txt
python3 -c "import struct;
for p in __import__('glob').glob('/tmp/fold-on/*.png'):
    d=open(p,'rb').read(); w,h=struct.unpack('>II', d[16:24]); print(p, w, 'x', h)"
```
Expect the autoscroll outline ≥ the `--no-autoscroll` outline, and the PNG height well above 900px.

---

## Self-Review

**Spec coverage** (design → task):
- `screenshot_clip()` pure helper + tests (cssContentSize, contentSize fallback, height cap, rounding, None cases) → Task 1.
- Full-page screenshot via captureBeyondViewport + clip, viewport fallback → Task 2.
- Auto-scroll (Python-driven, sync `scrollStep`/`scrollTop`, window + first-10 inner containers, 25-step stability cap, back-to-top), called in `_settle`, `--no-autoscroll` off-switch → Task 3.
- Lifted caps (body 40000, outline 60000, tables 20, rows 8) → Task 3.
- Vendored-only / independence → Global Constraints + structural asserts.

**Type/contract consistency:** `screenshot_clip(metrics, max_px=20000) -> dict|None` name/shape matches between Task 1 impl, its test, and the Task 2 call site (`clip=` kwarg to `Page.captureScreenshot`). `_autoscroll` reads `self.args.no_autoscroll` (via `getattr` default False) which Task 3 Step 3 adds to argparse — and the Task-1 `screenshot_clip` unit test constructs no args, so it's unaffected. The `_settle` `return→break` change preserves the deadline fall-through path; `_autoscroll` runs on every settle (full + short) unless `--no-autoscroll`.

**Placeholder scan:** none — full code inline; every verification step has exact commands + expected output.

**Note on testing:** only `screenshot_clip` is pure/unit-tested; the autoscroll JS + CDP screenshot are browser-driven and covered by the structural asserts (Tasks 2/3 Step 4) plus the post-plan integration re-walk. This matches how the walker's other browser-driven behavior (`--append` seeding) was handled — a small pure helper unit-tested, the rest validated by an integration run.
